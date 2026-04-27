# backend/scheduler/greedy.py

from collections import defaultdict
from scheduler.constraints import is_valid_candidate


# -------------------------------
# CONTEXT PREPARATION
# -------------------------------

def prepare_context(employees, shifts, availability, leaves, absences):
    """
    Converts raw DB data into fast lookup structures
    """
    # availability_map:
    # { employee_id: { "Monday": {is_available, preferred_shift} } }
    availability_map = defaultdict(dict)
    for row in availability:
        availability_map[row["employee_id"]][row["day_of_week"].lower()] = {
            "is_available": row["is_available"],
            "preferred_shift": row.get("preferred_shift")
        }

    # leaves_map: { employee_id: set(date_str) }
    leaves_map = defaultdict(set)
    for row in leaves:
        leaves_map[row["employee_id"]].add(row["date"])

    # absences_map: same structure
    absences_map = defaultdict(set)
    for row in absences:
        absences_map[row["employee_id"]].add(row["date"])

    context = {
        "availability_map": availability_map,
        "leaves_map": leaves_map,
        "absences_map": absences_map,
        "assignments": [],
        "assignment_counts": defaultdict(int),
        "candidate_cache": {},
        "context_assignments_by_employee": defaultdict(list)
    }

    hosts = [e for e in employees if e.get("can_be_host")]
    operators = [e for e in employees if e.get("can_be_operator")]

    context["role_pools"] = {
        "host": hosts,
        "operator": operators
    }

    context["employee_map"] = {
        e["employee_id"]: e for e in employees
    }

    return context


# -------------------------------
# SHIFT DIFFICULTY
# -------------------------------

def estimate_candidates(employees, shift, role, context):
    """
    Rough count of how many can fill this shift
    """
    count = 0

    pool = context["role_pools"][role]

    for e in pool:

        if is_valid_candidate(e, shift, role, context):
            count += 1
    return count


def sort_shifts_by_difficulty(shifts, employees, context):
    """
    Harder shifts first (fewer candidates)
    """

    def difficulty(shift):
        host_candidates = estimate_candidates(employees, shift, "host", context)
        op_candidates = estimate_candidates(employees, shift, "operator", context)

        total_candidates = host_candidates + op_candidates

        # fewer candidates → higher priority
        return total_candidates

    return sorted(shifts, key=difficulty)


# -------------------------------
# SCORING
# -------------------------------

def score_employee(employee, shift, role, context):
    """
    Higher score = better candidate
    """
    emp_id = employee["employee_id"]
    score = 0

    # fairness: prefer fewer assignments
    score -= context["assignment_counts"][emp_id]

    # preference match
    day = shift["shift_date"]
    day_name = day.strftime("%A").lower() if hasattr(day, "strftime") else day

    availability = context["availability_map"].get(emp_id, {})
    pref = availability.get(day_name, {}).get("preferred_shift")

    if pref and pref.lower() == shift["shift_type"].lower():
        score += 2

    return score


# -------------------------------
# CANDIDATES
# -------------------------------

def get_candidates(employees, shift, role, context):
    key = (shift["shift_id"], role)

    if key in context["candidate_cache"]:
        return context["candidate_cache"][key]

    # 🔥 USE ROLE POOL INSTEAD OF ALL EMPLOYEES
    pool = context["role_pools"][role]

    candidates = [
        e for e in pool
        if is_valid_candidate(e, shift, role, context)
    ]

    context["candidate_cache"][key] = candidates
    return candidates

# -------------------------------
# ASSIGNMENT
# -------------------------------

def assign_employee(employee, shift, role, context):
    """
    Save assignment in memory
    """
    assignment = {
        "shift_id": shift["shift_id"],
        "shift_date": shift["shift_date"],
        "shift_type": shift["shift_type"],
        "account": shift["account"],
        "employee_id": employee["employee_id"],
        "employee_name": employee["full_name"],
        "role": role
    }

    context["assignments"].append(assignment)
    context["assignment_counts"][employee["employee_id"]] += 1
    context["context_assignments_by_employee"][employee["employee_id"]].append(assignment)
    context["candidate_cache"].pop((shift["shift_id"], role), None)


# -------------------------------
# ROLE FILLING
# -------------------------------

def fill_role(shift, role, required_count, employees, context):
    """
    Greedy assignment per role
    """
    assigned = 0

    for _ in range(required_count):

        candidates = get_candidates(employees, shift, role, context)

        if not candidates:
            return assigned  # stop early

        # pick best
        best = max(candidates, key=lambda e: score_employee(e, shift, role, context))

        assign_employee(best, shift, role, context)
        assigned += 1

    return assigned

def remove_assignment(assignment, context):
    context["assignments"].remove(assignment)
    context["assignment_counts"][assignment["employee_id"]] -= 1
    context["context_assignments_by_employee"][assignment["employee_id"]].remove(assignment)
    context["candidate_cache"].pop(
        (assignment["shift_id"], assignment["role"]),
        None
    )


def try_fill_unfilled_slot(slot, employees, shifts, context):
    shift = context["shift_map"].get(slot["shift_id"])
    role = slot["role"]

    pool = context["role_pools"][role]
    
    for emp in pool:

        emp_id = emp["employee_id"]

        # skip if not valid at all
        if not is_valid_candidate(emp, shift, role, context):
            continue

        # check if already assigned somewhere else
        existing_assignment = None
        existing_list = context["context_assignments_by_employee"].get(emp_id, [])
        existing_assignment = next(iter(existing_list), None)

        # if free → assign directly
        if not existing_assignment:
            assign_employee(emp, shift, role, context)
            return True

        # try swapping
        old_shift = context["shift_map"].get(existing_assignment["shift_id"])
        old_role = existing_assignment["role"]

        # remove temporarily
        remove_assignment(existing_assignment, context)

        # check if someone else can fill old slot
        replacement_pool = context["role_pools"][old_role]

        replacement_candidates = [
            e for e in replacement_pool
            if is_valid_candidate(e, old_shift, old_role, context)
        ]

        if replacement_candidates:
            replacement = max(
                replacement_candidates,
                key=lambda e: score_employee(e, old_shift, old_role, context)
            )

            # assign replacement
            assign_employee(replacement, old_shift, old_role, context)

            # assign original employee to new slot
            assign_employee(emp, shift, role, context)

            return True

        # revert if swap fails
        original_employee = context["employee_map"][existing_assignment["employee_id"]]

        assign_employee(original_employee, old_shift, old_role, context)

    return False


def repair_schedule(unfilled, employees, shifts, context):
    still_unfilled = []

    for slot in unfilled:
        success = try_fill_unfilled_slot(slot, employees, shifts, context)

        if not success:
            still_unfilled.append(slot)

    return still_unfilled

# -------------------------------
# MAIN GENERATOR
# -------------------------------

def generate_schedule(employees, shifts, availability, leaves, absences):
    """
    Main entry point
    """

    context = prepare_context(employees, shifts, availability, leaves, absences)

    context["shift_map"] = {s["shift_id"]: s for s in shifts}
    

    # ================= DEBUG START =================

    print("========== DEBUG INFO ==========")

    # 1. Employees
    print("TOTAL EMPLOYEES:", len(employees))
    hosts = [e for e in employees if e.get("can_be_host")]
    operators = [e for e in employees if e.get("can_be_operator")]
    print("HOSTS:", len(hosts))
    print("OPERATORS:", len(operators))

    # 2. Shifts sample
    print("\n--- SAMPLE SHIFTS ---")
    for s in shifts[:5]:
        print(s)

    # 3. Availability sample
    print("\n--- SAMPLE AVAILABILITY ---")
    for a in availability[:10]:
        print(a)

    # 4. Leaves / Absences
    print("\nLEAVES:", len(leaves))
    print("ABSENCES:", len(absences))

    # 5. Candidate test (CRITICAL)
    print("\n--- CANDIDATE CHECK ---")
    for shift in shifts[:10]:
        host_candidates = [
            e for e in employees
            if is_valid_candidate(e, shift, "host", context)
        ]
        op_candidates = [
            e for e in employees
            if is_valid_candidate(e, shift, "operator", context)
        ]

        print("SHIFT:", shift["shift_date"], shift["shift_type"])
        print("HOST CANDIDATES:", len(host_candidates))
        print("OPERATOR CANDIDATES:", len(op_candidates))
        print("-----")

    print("========== END DEBUG ==========")

    # ================= DEBUG END =================

    # sort shifts (hard → easy)
    sorted_shifts = sort_shifts_by_difficulty(shifts, employees, context)

    unfilled = []

    for shift in sorted_shifts:

        # HOSTS
        assigned_hosts = fill_role(
            shift,
            "host",
            shift.get("required_host_count", 1),
            employees,
            context
        )

        if assigned_hosts < shift.get("required_host_count", 1):
            for _ in range(shift.get("required_host_count", 1) - assigned_hosts):
                unfilled.append({
                    "shift_id": shift["shift_id"],
                    "role": "host"
                })

        # OPERATORS
        assigned_ops = fill_role(
            shift,
            "operator",
            shift.get("required_operator_count", 1),
            employees,
            context
        )

        if assigned_ops < shift.get("required_operator_count", 1):
            for _ in range(shift.get("required_operator_count", 1) - assigned_ops):
                unfilled.append({
                    "shift_id": shift["shift_id"],
                    "role": "operator"
                })

    # NEW: attempt to fix unfilled slots
    unfilled = repair_schedule(unfilled, employees, shifts, context)

    return {
        "assignments": context["assignments"],
        "unfilled_slots": unfilled
    }
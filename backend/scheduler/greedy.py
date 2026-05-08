# backend/scheduler/greedy.py

from collections import defaultdict
from scheduler.constraints import (
    is_valid_candidate,
    is_available,
    is_on_leave,
    is_absent,
    already_assigned,
    already_assigned_same_time,
    assigned_count_same_day,
    working_days,
    normalize_date,
    MAX_WORKING_DAYS
)


# -------------------------------
# CONTEXT PREPARATION
# -------------------------------

def prepare_context(employees, shifts, availability, leaves, absences):
    """
    Converts raw DB data into fast lookup structures
    """
    ##availability_map:
    # { employee_id: { "monday": { "am": {is_available} } } }

    availability_map = defaultdict(lambda: defaultdict(dict))

    for row in availability:
        if not row["preferred_shift"]:
            continue  # skip nulls

        emp_id = row["employee_id"]
        day = row["day_of_week"].lower()
        shift = row["preferred_shift"].lower()

        availability_map[emp_id][day][shift] = {
            "is_available": row["is_available"]
        }


    # leaves_map: { employee_id: set(date_str) }
    leaves_map = leaves   # 👈 already a map

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

    print("\n🔥 LEAVES MAP:", context["leaves_map"])

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
        difficulty_score = total_candidates

        # GY harder
        if shift["shift_type"].upper() == "GY":
            difficulty_score -= 2

        # Weekend harder
        if shift["shift_date"].weekday() >= 5:
            difficulty_score -= 1

        return difficulty_score

    return sorted(shifts, key=difficulty)


# -------------------------------
# SCORING
# -------------------------------

# -------------------------------
# FLEXIBILITY ESTIMATION
# -------------------------------

def estimate_future_options(employee, shifts, role, context):
    """
    Count how many remaining shifts
    this employee can still potentially fill.

    Lower count = more valuable employee.
    """

    count = 0

    for shift in shifts:

        if is_valid_candidate(employee, shift, role, context):
            count += 1

    return count

def score_employee(employee, shift, role, context):
    """
    Higher score = better candidate
    """

    emp_id = employee["employee_id"]

    score = 0

    # --------------------------------
    # 1. FAIRNESS
    # --------------------------------

    assignment_count = context["assignment_counts"][emp_id]

    # stronger fairness penalty
    score -= assignment_count * 3

    # --------------------------------
    # 2. PRESERVE FLEXIBLE EMPLOYEES
    # --------------------------------

    remaining_shifts = [
        s for s in context["remaining_shifts"]
        if s["shift_id"] != shift["shift_id"]
    ]

    future_options = estimate_future_options(
        employee,
        remaining_shifts,
        role,
        context
    )

    # IMPORTANT:
    # More future options = lower priority
    score -= future_options * 0.5

    # --------------------------------
    # 3. PREFERRED SHIFT BONUS
    # --------------------------------

    day_name = shift["shift_date"].strftime("%A").lower()

    availability = context["availability_map"].get(emp_id, {})

    shift_pref = availability.get(day_name, {}).get(
        shift["shift_type"].lower()
    )

    if shift_pref and shift_pref.get("is_available"):
        score += 2

    # --------------------------------
    # 4. GY FATIGUE PENALTY
    # --------------------------------

    if shift["shift_type"].upper() == "GY":

        previous_assignments = context[
            "context_assignments_by_employee"
        ].get(emp_id, [])

        for a in previous_assignments:

            prev_date = a["shift_date"]

            delta = (
                shift["shift_date"] - prev_date
            ).days

            if (
                delta == 1 and
                a["shift_type"].upper() == "GY"
            ):
                score -= 5

    return score


# -------------------------------
# CANDIDATES
# -------------------------------

def get_candidates(employees, shift, role, context):
    key = (shift["shift_id"], role)

    # 🔥 USE ROLE POOL INSTEAD OF ALL EMPLOYEES
    pool = context["role_pools"][role]

    candidates = [
        e for e in pool
        if is_valid_candidate(e, shift, role, context)
    ]

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


def try_fill_unfilled_slot(
    slot,
    employees,
    shifts,
    context,
    depth=0
):
    shift = context["shift_map"].get(slot["shift_id"])
    role = slot["role"]

    MAX_REPAIR_DEPTH = 2

    if depth >= MAX_REPAIR_DEPTH:
        return False

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
                key=lambda e:
                    score_employee(
                        e,
                        old_shift,
                        old_role,
                        context
                    )
            )

            # --------------------------------
            # Assign replacement temporarily
            # --------------------------------

            assign_employee(
                replacement,
                old_shift,
                old_role,
                context
            )

            # --------------------------------
            # Assign original employee
            # to new slot
            # --------------------------------

            assign_employee(
                emp,
                shift,
                role,
                context
            )

            # --------------------------------
            # Check if replacement created
            # another gap elsewhere
            # --------------------------------

            unresolved = []

            for s in shifts:

                for r in ["host", "operator"]:

                    required = s.get(
                        f"required_{r}_count",
                        1
                    )

                    current_count = len([
                        a for a in context["assignments"]
                        if (
                            a["shift_id"] == s["shift_id"]
                            and a["role"] == r
                        )
                    ])

                    if current_count < required:

                        unresolved.append({
                            "shift_id": s["shift_id"],
                            "role": r
                        })

            # --------------------------------
            # Attempt recursive repair
            # --------------------------------

            success = True

            for missing in unresolved:

                repaired = try_fill_unfilled_slot(
                    missing,
                    employees,
                    shifts,
                    context,
                    depth + 1
                )

                if not repaired:
                    success = False
                    break

            if success:
                return True

            # --------------------------------
            # REVERT EVERYTHING
            # --------------------------------

            remove_assignment(
                {
                    "shift_id": old_shift["shift_id"],
                    "employee_id": replacement["employee_id"],
                    "role": old_role,
                    "shift_date": old_shift["shift_date"],
                    "shift_type": old_shift["shift_type"],
                    "account": old_shift["account"],
                    "employee_name": replacement["full_name"]
                },
                context
            )

            remove_assignment(
                {
                    "shift_id": shift["shift_id"],
                    "employee_id": emp["employee_id"],
                    "role": role,
                    "shift_date": shift["shift_date"],
                    "shift_type": shift["shift_type"],
                    "account": shift["account"],
                    "employee_name": emp["full_name"]
                },
                context
            )

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
    
    global_failure_stats = {
        "role_fail": 0,
        "availability_fail": 0,
        "leave_fail": 0,
        "absence_fail": 0,
        "already_assigned": 0,
        "same_time_conflict": 0,
        "max_shift_day": 0,
        "rest_day_fail": 0,
        "valid": 0
    }

    # ================= DEBUG START =================

    print("\n========== GLOBAL DEBUG START ==========")

    for shift in shifts[:10]:  # limit if needed
        print(f"\n🔎 SHIFT: {shift['shift_date']} {shift['shift_type']}")

        reasons = {
            "role_fail": 0,
            "availability_fail": 0,
            "leave_fail": 0,
            "absence_fail": 0,
            "already_assigned": 0,
            "same_time_conflict": 0,
            "max_shift_day": 0,
            "valid": 0
        }

        for e in employees:
            emp_id = e["employee_id"]

            # ROLE
            if not (e.get("can_be_host") or e.get("can_be_operator")):
                reasons["role_fail"] += 1
                continue

            # AVAILABILITY
            if not is_available(emp_id, shift, context["availability_map"]):
                reasons["availability_fail"] += 1
                continue

            # LEAVE
            if is_on_leave(emp_id, shift["shift_date"], context["leaves_map"]):
                reasons["leave_fail"] += 1
                continue

            # ABSENCE
            if is_absent(emp_id, shift["shift_date"], context["absences_map"]):
                reasons["absence_fail"] += 1
                continue

            # ASSIGNMENT CONFLICTS
            if already_assigned(emp_id, shift["shift_id"], context):
                reasons["already_assigned"] += 1
                continue

            if already_assigned_same_time(emp_id, shift, context):
                reasons["same_time_conflict"] += 1
                continue

            if assigned_count_same_day(emp_id, shift, context) >= 1:
                reasons["max_shift_day"] += 1
                continue
            
            days = working_days(emp_id, context)

            candidate_day = normalize_date(
                shift["shift_date"]
            )

            projected_days = set(days)
            projected_days.add(candidate_day)

            if len(projected_days) > MAX_WORKING_DAYS:
                reasons["rest_day_fail"] += 1
                continue

            reasons["valid"] += 1

        for k, v in reasons.items():
            global_failure_stats[k] += v
            
        print("📊 RESULTS:")
        for k, v in reasons.items():
            print(f"   {k}: {v}")

    global_failure_stats["rest_day_fail"] = (
        context.get("rest_day_failures", 0)
    )
    
    print("\n🌍 GLOBAL FAILURE ANALYTICS")

    for k, v in global_failure_stats.items():
        print(f"{k}: {v}")
        
    print("\n========== GLOBAL DEBUG END ==========")

    # ================= DEBUG END =================

    # sort shifts (hard → easy)
    sorted_shifts = sort_shifts_by_difficulty(shifts, employees, context)

    context["remaining_shifts"] = sorted_shifts.copy()

    unfilled = []

    while context["remaining_shifts"]:

        # --------------------------------
        # Dynamically pick hardest shift
        # --------------------------------

        shift = min(
            context["remaining_shifts"],
            key=lambda s:
                estimate_candidates(employees, s, "host", context)
                +
                estimate_candidates(employees, s, "operator", context)
        )

        context["remaining_shifts"].remove(shift)

        # --------------------------------
        # HOSTS
        # --------------------------------

        assigned_hosts = fill_role(
            shift,
            "host",
            shift.get("required_host_count", 1),
            employees,
            context
        )

        if assigned_hosts < shift.get("required_host_count", 1):

            for _ in range(
                shift.get("required_host_count", 1)
                - assigned_hosts
            ):

                unfilled.append({
                    "shift_id": shift["shift_id"],
                    "role": "host"
                })

        # --------------------------------
        # OPERATORS
        # --------------------------------

        assigned_ops = fill_role(
            shift,
            "operator",
            shift.get("required_operator_count", 1),
            employees,
            context
        )

        if assigned_ops < shift.get("required_operator_count", 1):

            for _ in range(
                shift.get("required_operator_count", 1)
                - assigned_ops
            ):

                unfilled.append({
                    "shift_id": shift["shift_id"],
                    "role": "operator"
                })

    # NEW: attempt to fix unfilled slots
    unfilled = repair_schedule(unfilled, employees, shifts, context)

    # ================= UNFILLED DEBUG =================

    if unfilled:
        print("\n🚨 UNFILLED SLOT ANALYSIS START")

        for slot in unfilled:
            shift = context["shift_map"][slot["shift_id"]]
            role = slot["role"]

            print(f"\n❌ UNFILLED SHIFT:")
            print(f"   Date: {shift['shift_date']}")
            print(f"   Shift: {shift['shift_type']}")
            print(f"   Role: {role}")

            reasons = {
                "role_fail": 0,
                "availability_fail": 0,
                "leave_fail": 0,
                "absence_fail": 0,
                "already_assigned": 0,
                "same_time_conflict": 0,
                "max_shift_day": 0,
                "valid": 0
            }

            pool = context["role_pools"][role]

            for e in pool:
                emp_id = e["employee_id"]

                # ROLE CHECK
                if role == "host" and not e.get("can_be_host"):
                    reasons["role_fail"] += 1
                    continue

                if role == "operator" and not e.get("can_be_operator"):
                    reasons["role_fail"] += 1
                    continue

                # AVAILABILITY
                if not is_available(emp_id, shift, context["availability_map"]):
                    reasons["availability_fail"] += 1
                    continue

                # LEAVE
                if is_on_leave(emp_id, shift["shift_date"], context["leaves_map"]):
                    reasons["leave_fail"] += 1
                    continue

                # ABSENCE
                if is_absent(emp_id, shift["shift_date"], context["absences_map"]):
                    reasons["absence_fail"] += 1
                    continue

                # ASSIGNMENT CONFLICTS
                if already_assigned(emp_id, shift["shift_id"], context):
                    reasons["already_assigned"] += 1
                    continue

                if already_assigned_same_time(emp_id, shift, context):
                    reasons["same_time_conflict"] += 1
                    continue

                if assigned_count_same_day(emp_id, shift, context) >= 1:
                    reasons["max_shift_day"] += 1
                    continue

                reasons["valid"] += 1

            print("📊 REASONS:")
            for k, v in reasons.items():
                print(f"   {k}: {v}")

        print("\n🚨 UNFILLED SLOT ANALYSIS END")
        
    return {
        "assignments": context["assignments"],
        "unfilled_slots": unfilled
    }


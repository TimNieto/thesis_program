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
)


# -------------------------------
# CONTEXT PREPARATION
# -------------------------------

def prepare_context(employees, shifts, availability, leaves, absences, settings, account_settings):
    """
    Converts raw DB data into fast lookup structures
    """
    ##availability_map:
    # { employee_id: { "monday": { "am": {is_available} } } }

    availability_map = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(dict)
        )
    )

    for row in availability:
        if not row["preferred_shift"]:
            continue  # skip nulls

        emp_id = row["employee_id"]
        account = row["account"].lower()
        day = row["day_of_week"].lower()
        shift = row["preferred_shift"].lower()

        availability_map[emp_id][account][day][shift] = {
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
        "settings": settings,
         "account_settings": account_settings,
        "assignments": [],
        "assignment_counts": defaultdict(int),
        "context_assignments_by_employee": defaultdict(list),

        "context_flags": {
            "relax_account": False,
            "relax_role": False,
            "allow_double_shift": False
        }
    }

    hosts = [e for e in employees if e.get("can_be_host")]
    operators = [e for e in employees if e.get("can_be_operator")]

    role_pools = {
        "host": hosts,
        "operator": operators
    }

    for shift in shifts:
        for req in shift.get("staffing_requirements", []):
            role_key = req["role_key"]

            if role_key not in role_pools:
                role_pools[role_key] = []

    context["role_pools"] = role_pools

    context["employee_map"] = {
        e["employee_id"]: e for e in employees
    }

    # print("\n🔥 LEAVES MAP:", context["leaves_map"])

    return context


# -------------------------------
# SHIFT DIFFICULTY
# -------------------------------

def estimate_candidates(employees, shift, role, context):
    """
    Rough count of how many can fill this shift
    """
    count = 0

    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])

    for e in pool:

        if is_valid_candidate(e, shift, role, context):
            count += 1
    return count


def sort_shifts_by_difficulty(shifts, employees, context):
    """
    Harder shifts first (fewer candidates)
    """

    def difficulty(shift):
        
        total_candidates = 0

        for req in shift.get("staffing_requirements", []):
            role = req["role_key"]

            total_candidates += estimate_candidates(
                employees,
                shift,
                role,
                context
            )

        account_name = shift["account"]

        account_policy = (
            context["account_settings"]
            .get(account_name, {})
        )

        priority_level = (
            account_policy.get(
                "priority_level",
                999
            )
        )

        # fewer candidates → higher priority
        difficulty_score = total_candidates

        # Higher priority accounts
        # scheduled FIRST
        difficulty_score += (
            priority_level * 100
        )

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

    account_policy = (
        context["account_settings"]
        .get(shift["account"], {})
    )

    operator_policy = (
        account_policy.get(
            "operator_policy",
            "required"
        )
    )

    # print(
    #     "ACCOUNT:",
    #     shift["account"],
    #     "POLICY:",
    #     operator_policy
    # )

    # --------------------------------
    # 1. FAIRNESS
    # --------------------------------

    assignment_count = context["assignment_counts"][emp_id]

    # stronger fairness penalty
    fairness_weight = (
    context["settings"]["fairness_weight"]
        )
    score -= assignment_count * fairness_weight

    # --------------------------------
    # 1.5 MAIN ROLE PRIORITY
    # --------------------------------

    main_role = (employee.get("main_role") or "").strip()

    if role == "host":
        if main_role == "Host":
            score += 8
        elif main_role == "Both":
            score += 4
        else:
            score -= 6

    elif role == "operator":
        if main_role == "Operator":
            score += 8
        elif main_role == "Both":
            score += 4
        else:
            score -= 6


    # --------------------------------
    # OPERATOR POLICY
    # --------------------------------

    if (
        role == "operator"
        and
        operator_policy == "avoid"
    ):

        # discourage assigning operators
        # unless necessary
        score -= 50

    if (
        role == "host"
        and
        operator_policy == "avoid"
    ):
        score += 15

        # print(
        #     f"⚠️ AVOIDING OPERATOR "
        #     f"{employee['employee_id']} "
        #     f"for {shift['account']}"
        # )

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

    account = shift["account"].lower()

    shift_pref = (
        availability
        .get(account, {})
        .get(day_name, {})
        .get(shift["shift_type"].lower())
    )

    if shift_pref and shift_pref.get("is_available"):
        score += 2

    # --------------------------------
    # 4. GY FATIGUE PENALTY
    # --------------------------------

    if shift.get("is_overnight"):

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
                score -= shift.get("fatigue_penalty", 0)

    return score


# -------------------------------
# CANDIDATES
# -------------------------------

def get_candidates(employees, shift, role, context):
    key = (shift["shift_id"], role)

    # 🔥 USE ROLE POOL INSTEAD OF ALL EMPLOYEES
    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])

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

    flags = context["context_flags"]

    if flags["allow_double_shift"]:
        relaxation_level = "double_shift_relaxed"

    elif flags["relax_role"]:
        relaxation_level = "role_relaxed"

    elif flags["relax_account"]:
        relaxation_level = "account_relaxed"

    else:
        relaxation_level = "strict"
        
    slot_index = len([
        a for a in context["assignments"]
        if a["shift_id"] == shift["shift_id"]
        and a["role"] == role
    ])

    assignment = {
        "shift_id": shift["shift_id"],
        "shift_date": shift["shift_date"],
        "shift_type": shift["shift_type"],
        "account": shift["account"],
        "employee_id": employee["employee_id"],
        "employee_name": employee["full_name"],
        "role": role,
        "slot_index": slot_index,
        "relaxation_level": relaxation_level
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

    target = None

    for a in context["assignments"]:

        if (
            a["shift_id"] == assignment["shift_id"]
            and a["employee_id"] == assignment["employee_id"]
            and a["role"] == assignment["role"]
        ):
            target = a
            break

    if not target:
        return

    context["assignments"].remove(target)

    context["assignment_counts"][target["employee_id"]] -= 1

    employee_assignments = context[
        "context_assignments_by_employee"
    ][target["employee_id"]]

    employee_assignments.remove(target)


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

    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])
    
    for emp in pool:

        emp_id = emp["employee_id"]

        # skip if not valid at all
        if not is_valid_candidate(emp, shift, role, context):
            continue

        # check if already assigned somewhere else
        existing_list = context["context_assignments_by_employee"].get(emp_id, [])

        # free employee
        if not existing_list:
            assign_employee(emp, shift, role, context)
            return True

        # try every existing assignment
        for existing_assignment in existing_list[:]:

            old_shift = context["shift_map"].get(
                existing_assignment["shift_id"]
            )

            old_role = existing_assignment["role"]

            # remove temporarily
            remove_assignment(existing_assignment, context)

            # check if someone else can fill old slot
            if context["context_flags"].get("relax_role"):
                replacement_pool = employees
            else:
                replacement_pool = context["role_pools"].get(old_role, [])

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

                assign_employee(
                    replacement,
                    old_shift,
                    old_role,
                    context
                )

                assign_employee(
                    emp,
                    shift,
                    role,
                    context
                )

                unresolved = []

                for s in shifts:

                    for req in s.get("staffing_requirements", []):

                        r = req["role_key"]

                        required = req.get("required_count", 0) or 0

                        if required <= 0:
                            continue

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

                remove_assignment(
                    {
                        "shift_id": old_shift["shift_id"],
                        "employee_id": replacement["employee_id"],
                        "role": old_role
                    },
                    context
                )

                remove_assignment(
                    {
                        "shift_id": shift["shift_id"],
                        "employee_id": emp["employee_id"],
                        "role": role
                    },
                    context
                )

            # restore original assignment
            assign_employee(
                context["employee_map"][existing_assignment["employee_id"]],
                old_shift,
                old_role,
                context
            )

    return False


def repair_schedule(unfilled, employees, shifts, context):
    still_unfilled = []

    for slot in unfilled:
        success = try_fill_unfilled_slot(slot, employees, shifts, context)

        if not success:
            still_unfilled.append(slot)

    return still_unfilled

def fill_shift_staffing_requirements(
    shift,
    employees,
    context,
    unfilled
):
    """
    Fill all database-defined staffing requirements for one shift.
    """

    for req in shift.get("staffing_requirements", []):

        role = req["role_key"]
        required_count = req.get("required_count", 0) or 0

        if required_count <= 0:
            continue

        # Keep existing operator policy behavior
        account_policy = (
            context["account_settings"]
            .get(shift["account"], {})
        )

        operator_policy = account_policy.get(
            "operator_policy",
            "required"
        )

        if role == "operator" and operator_policy == "avoid":
            continue

        assigned_count = fill_role(
            shift,
            role,
            required_count,
            employees,
            context
        )

        if assigned_count < required_count:

            for _ in range(required_count - assigned_count):

                unfilled.append({
                    "shift_id": shift["shift_id"],
                    "role": role
                })
                
# -------------------------------
# MAIN GENERATOR
# -------------------------------

def generate_schedule(employees, shifts, availability, leaves, absences, settings, account_settings):
    """
    Main entry point
    """

    context = prepare_context(employees, shifts, availability, leaves, absences, settings, account_settings)

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
            "rest_day_fail": 0,
            "valid": 0
        }

        for e in employees:
            emp_id = e["employee_id"]

            # ROLE
            if not (e.get("can_be_host") or e.get("can_be_operator")):
                reasons["role_fail"] += 1
                continue

            # AVAILABILITY
            if not is_available(
                        emp_id,
                        shift,
                        context["availability_map"],
                        context
                    ):
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

            max_shifts = (
                2
                if context["context_flags"].get("allow_double_shift")
                else 1
            )

            if assigned_count_same_day(emp_id, shift, context) >= max_shifts:
                reasons["max_shift_day"] += 1
                continue
            
            days = working_days(emp_id, context)

            candidate_day = normalize_date(
                shift["shift_date"]
            )

            projected_days = set(days)
            projected_days.add(candidate_day)

            max_days = context["settings"]["max_working_days"]
            if len(projected_days) > max_days:
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
            key=lambda s: sum(
                estimate_candidates(
                    employees,
                    s,
                    req["role_key"],
                    context
                )
                for req in s.get("staffing_requirements", [])
            )
        )

        context["remaining_shifts"].remove(shift)

        fill_shift_staffing_requirements(
            shift,
            employees,
            context,
            unfilled
        )

    # NEW: attempt to fix unfilled slots
    # --------------------------------
    # STRICT REPAIR
    # --------------------------------

    unfilled = repair_schedule(
        unfilled,
        employees,
        shifts,
        context
    )

    # --------------------------------
    # RELAX ACCOUNT → FULL REBUILD
    # --------------------------------

    if unfilled:

        print("\n🔥 RELAXING ACCOUNT CONSTRAINT")

        context["context_flags"]["relax_account"] = True

        # RESET SCHEDULE
        context["assignments"].clear()
        context["assignment_counts"].clear()
        context["context_assignments_by_employee"].clear()

        # REBUILD
        unfilled = []

        context["remaining_shifts"] = sort_shifts_by_difficulty(
            shifts,
            employees,
            context
        )

        while context["remaining_shifts"]:

            shift = min(
                context["remaining_shifts"],
                key=lambda s: sum(
                    estimate_candidates(
                        employees,
                        s,
                        req["role_key"],
                        context
                    )
                    for req in s.get("staffing_requirements", [])
                )
            )

            context["remaining_shifts"].remove(shift)

            fill_shift_staffing_requirements(
                shift,
                employees,
                context,
                unfilled
            )

        unfilled = repair_schedule(
            unfilled,
            employees,
            shifts,
            context
        )

    # --------------------------------
    # RELAX ROLE → FULL REBUILD
    # --------------------------------

    if unfilled:

        print("\n🔥 RELAXING ROLE CONSTRAINT")

        context["context_flags"]["relax_role"] = True

        context["assignments"].clear()
        context["assignment_counts"].clear()
        context["context_assignments_by_employee"].clear()

        unfilled = []

        context["remaining_shifts"] = sort_shifts_by_difficulty(
            shifts,
            employees,
            context
        )

        while context["remaining_shifts"]:

            shift = min(
                context["remaining_shifts"],
                key=lambda s: sum(
                    estimate_candidates(
                        employees,
                        s,
                        req["role_key"],
                        context
                    )
                    for req in s.get("staffing_requirements", [])
                )
            )

            context["remaining_shifts"].remove(shift)

            fill_shift_staffing_requirements(
                shift,
                employees,
                context,
                unfilled
            )

        unfilled = repair_schedule(
            unfilled,
            employees,
            shifts,
            context
        )

    # --------------------------------
    # DOUBLE SHIFT → FULL REBUILD
    # --------------------------------

    if (
    unfilled and
    context["settings"]["allow_double_shifts"]
        ):

        print("\n🔥 ALLOWING DOUBLE SHIFTS")

        context["context_flags"]["allow_double_shift"] = True

        context["assignments"].clear()
        context["assignment_counts"].clear()
        context["context_assignments_by_employee"].clear()

        unfilled = []

        context["remaining_shifts"] = sort_shifts_by_difficulty(
            shifts,
            employees,
            context
        )

        while context["remaining_shifts"]:

            shift = min(
                context["remaining_shifts"],
                key=lambda s: sum(
                    estimate_candidates(
                        employees,
                        s,
                        req["role_key"],
                        context
                    )
                    for req in s.get("staffing_requirements", [])
                )
            )

            context["remaining_shifts"].remove(shift)

            fill_shift_staffing_requirements(
                shift,
                employees,
                context,
                unfilled
            )

        unfilled = repair_schedule(
            unfilled,
            employees,
            shifts,
            context
        )

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
                "rest_day_fail": 0,
                "valid": 0
            }

            pool = context["role_pools"].get(role, [])

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
                if not is_available(
                            emp_id,
                            shift,
                            context["availability_map"],
                            context
                        ):
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

                max_shifts = (
                    2
                    if context["context_flags"].get("allow_double_shift")
                    else 1
                )

                if assigned_count_same_day(emp_id, shift, context) >= max_shifts:
                    reasons["max_shift_day"] += 1
                    continue

                days = working_days(emp_id, context)

                candidate_day = normalize_date(shift["shift_date"])

                projected_days = set(days)
                projected_days.add(candidate_day)

                max_days = context["settings"]["max_working_days"]
                if len(projected_days) > max_days:
                    reasons["rest_day_fail"] += 1
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


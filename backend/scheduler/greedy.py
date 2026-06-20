#---------------------------------------------
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


# Context preparation
def prepare_context(employees, shifts, availability, leaves, absences, settings, account_settings):
    """
    Converts raw DB data into fast lookup structures
    """

    availability_map = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(dict)
        )
    )

    for row in availability:
        if not row["preferred_shift"]:
            continue

        emp_id = row["employee_id"]
        account = row["account"].lower()
        day = row["day_of_week"].lower()
        shift = row["preferred_shift"].lower()

        availability_map[emp_id][account][day][shift] = {
            "is_available": row["is_available"]
        }

    leaves_map = leaves

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

    required_role_keys = set()

    for shift in shifts:
        for req in shift.get("staffing_requirements", []):
            role_key = str(req["role_key"]).strip().lower()

            if role_key:
                required_role_keys.add(role_key)

    role_pools = {
        role_key: []
        for role_key in required_role_keys
    }

    for employee in employees:
        employee_role_keys = set(
            employee.get("scheduled_role_keys")
            or []
        )

        for role_key in required_role_keys:
            if role_key in employee_role_keys:
                role_pools[role_key].append(employee)

    context["role_pools"] = role_pools

    context["employee_map"] = {
        e["employee_id"]: e for e in employees
    }

    return context


# Shift difficulty
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


def get_account_priority_level(shift, context):
    account_name = shift["account"]

    account_policy = (
        context["account_settings"]
        .get(account_name, {})
    )

    priority_level = account_policy.get(
        "priority_level",
        999
    )

    if isinstance(priority_level, str):
        normalized = priority_level.strip().lower()

        priority_map = {
            "high": 1,
            "medium": 2,
            "low": 3
        }

        if normalized in priority_map:
            return priority_map[normalized]

    try:
        return int(priority_level)
    except (TypeError, ValueError):
        return 999


def get_shift_candidate_count(shift, employees, context):
    requirements = shift.get("staffing_requirements", [])

    if not requirements:
        return 9999

    total_candidates = 0

    for req in requirements:
        role = req.get("role_key")

        if not role:
            continue

        total_candidates += estimate_candidates(
            employees,
            shift,
            role,
            context
        )

    return total_candidates


def shift_selection_score(shift, employees, context):
    priority_level = get_account_priority_level(
        shift,
        context
    )

    candidate_count = get_shift_candidate_count(
        shift,
        employees,
        context
    )

    weekend_boost = (
        0
        if shift["shift_date"].weekday() >= 5
        else 1
    )

    return (
        priority_level,
        candidate_count,
        weekend_boost,
        shift["shift_date"],
        str(shift.get("start_time", "")),
        str(shift.get("account", "")).lower(),
        shift["shift_id"]
    )


def pick_next_shift(remaining_shifts, employees, context):
    return min(
        remaining_shifts,
        key=lambda shift: shift_selection_score(
            shift,
            employees,
            context
        )
    )


def sort_shifts_by_difficulty(shifts, employees, context):
    """
    Sort shifts using the same rule used by the dynamic picker.
    Lower score = scheduled earlier.
    """

    return sorted(
        shifts,
        key=lambda shift: shift_selection_score(
            shift,
            employees,
            context
        )
    )


# Flexibility estimation
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

    # 1. FAIRNESS
    assignment_count = context["assignment_counts"][emp_id]

    try:
        fairness_weight = float(
            context.get("settings", {}).get("fairness_weight", 2) or 0
        )
    except (TypeError, ValueError):
        fairness_weight = 2

    fairness_weight = max(0, fairness_weight)

    if fairness_weight > 0:
        score -= assignment_count * fairness_weight

    # 1.5 ROLE MATCH PRIORITY
    employee_role_keys = set(
        employee.get("scheduled_role_keys")
        or []
    )

    if role in employee_role_keys:
        score += 8
    else:
        score -= 6

    # 2. PRESERVE FLEXIBLE EMPLOYEES
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

    # More future options = lower priority
    score -= future_options * 0.5

    # 3. PREFERRED SHIFT BONUS
    day_name = shift["shift_date"].strftime("%A").lower()

    availability = context["availability_map"].get(emp_id, {})

    account = shift["account"].lower()

    account_availability = (
        availability.get(account)
        or availability.get("default")
        or {}
    )

    shift_pref = (
        account_availability
        .get(day_name, {})
        .get(shift["shift_type"].lower())
    )

    if shift_pref and shift_pref.get("is_available"):
        score += 2

    # 4. NIGHT / OVERNIGHT FATIGUE PENALTY
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
                a.get("is_overnight")
            ):
                score -= shift.get("fatigue_penalty", 0)

    return score

# CANDIDATES
def get_candidates(employees, shift, role, context):

    # USE ROLE POOL INSTEAD OF ALL EMPLOYEES
    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])

    candidates = [
        e for e in pool
        if is_valid_candidate(e, shift, role, context)
    ]

    return candidates

# ASSIGNMENT
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
        "relaxation_level": relaxation_level,
        "is_overnight": bool(shift.get("is_overnight", False)),
        "start_time": shift.get("start_time"),
        "end_time": shift.get("end_time"),
    }

    context["assignments"].append(assignment)
    context["assignment_counts"][employee["employee_id"]] += 1
    context["context_assignments_by_employee"][employee["employee_id"]].append(assignment)

# ROLE FILLING
def fill_role(shift, role, required_count, employees, context):
    """
    Greedy assignment per role
    """
    assigned = 0

    for _ in range(required_count):

        candidates = get_candidates(employees, shift, role, context)

        if not candidates:
            return assigned

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

    if not shift:
        return False

    if depth >= MAX_REPAIR_DEPTH:
        return False

    if context["context_flags"].get("relax_role"):
        pool = employees
    else:
        pool = context["role_pools"].get(role, [])

    # 1. DIRECT REPAIR
    # If someone is already valid for this unfilled slot,
    # assign them immediately. This allows legal double shifts.
    direct_candidates = [
        emp for emp in pool
        if is_valid_candidate(emp, shift, role, context)
    ]

    if direct_candidates:
        def repair_score(emp):
            emp_id = emp["employee_id"]

            score = score_employee(emp, shift, role, context)

            # During repair only, prefer a legal double-shift candidate
            # if double shifting is enabled and the employee already works that day.
            if (
                context["settings"].get("allow_double_shifts")
                and assigned_count_same_day(emp_id, shift, context) > 0
            ):
                score += 100

            return score

        best = max(
            direct_candidates,
            key=repair_score
        )

        assign_employee(best, shift, role, context)
        return True

    # 2. SWAP / BACKTRACK REPAIR
    # Try moving an existing assignment away from a candidate,
    # then use that candidate for this unfilled slot.
    for emp in pool:
        emp_id = emp["employee_id"]

        existing_list = list(
            context["context_assignments_by_employee"].get(emp_id, [])
        )

        for existing_assignment in existing_list:
            old_shift = context["shift_map"].get(
                existing_assignment["shift_id"]
            )

            old_role = existing_assignment["role"]

            if not old_shift:
                continue

            # Temporarily remove employee's old assignment.
            remove_assignment(existing_assignment, context)

            try:
                # After removing old assignment, can this employee now fill
                # the unfilled slot?
                if not is_valid_candidate(emp, shift, role, context):
                    continue

                if context["context_flags"].get("relax_role"):
                    replacement_pool = employees
                else:
                    replacement_pool = context["role_pools"].get(old_role, [])

                replacement_candidates = [
                    replacement
                    for replacement in replacement_pool
                    if replacement["employee_id"] != emp_id
                    and is_valid_candidate(
                        replacement,
                        old_shift,
                        old_role,
                        context
                    )
                ]

                if not replacement_candidates:
                    continue

                replacement = max(
                    replacement_candidates,
                    key=lambda replacement: score_employee(
                        replacement,
                        old_shift,
                        old_role,
                        context
                    )
                )

                # Fill the old slot with replacement.
                assign_employee(
                    replacement,
                    old_shift,
                    old_role,
                    context
                )

                # Fill the original unfilled slot with the moved employee.
                assign_employee(
                    emp,
                    shift,
                    role,
                    context
                )

                return True

            finally:
                # If the swap did not return True, restore the old assignment
                # unless it has already been replaced.
                old_slot_filled = any(
                    a["shift_id"] == old_shift["shift_id"]
                    and a["role"] == old_role
                    for a in context["assignments"]
                )

                new_slot_filled_by_emp = any(
                    a["shift_id"] == shift["shift_id"]
                    and a["role"] == role
                    and a["employee_id"] == emp_id
                    for a in context["assignments"]
                )

                if not new_slot_filled_by_emp and not old_slot_filled:
                    assign_employee(
                        context["employee_map"][emp_id],
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
                
# MAIN GENERATOR
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
            employee_role_keys = set(
                e.get("scheduled_role_keys")
                or []
            )

            required_role_keys = {
                str(req["role_key"]).strip().lower()
                for req in shift.get("staffing_requirements", [])
                if req.get("role_key")
            }

            if required_role_keys and not employee_role_keys.intersection(required_role_keys):
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

        shift = pick_next_shift(
            context["remaining_shifts"],
            employees,
            context
        )

        context["remaining_shifts"].remove(shift)

        fill_shift_staffing_requirements(
            shift,
            employees,
            context,
            unfilled
        )

    # STRICT REPAIR
    unfilled = repair_schedule(
        unfilled,
        employees,
        shifts,
        context
    )
    
    # RELAX ACCOUNT → FULL REBUILD
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

            shift = pick_next_shift(
                context["remaining_shifts"],
                employees,
                context
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

    # RELAX ROLE → FULL REBUILD
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

            shift = pick_next_shift(
                context["remaining_shifts"],
                employees,
                context
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

    # DOUBLE SHIFT → FULL REBUILD
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

            shift = pick_next_shift(
                context["remaining_shifts"],
                employees,
                context
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
                employee_role_keys = set(
                    e.get("scheduled_role_keys")
                    or []
                )

                if role not in employee_role_keys:
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
#---------------------------------------------
# backend/scheduler/constraints.py

from datetime import datetime, timedelta

# Basic helpers
def normalize_date(d):
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    return str(d)

def get_day_of_week(date):
    """
    Convert date (datetime/date/str) → 'Monday', 'Tuesday', etc.
    """
    if isinstance(date, str):
        date = datetime.strptime(date, "%Y-%m-%d")
    return date.strftime("%A").lower()


# Availability
def is_available(employee_id, shift, availability_map, context=None):
    """
    Strict availability:
    - Must match day
    - Must match shift
    - Must be explicitly available
    """

    day = get_day_of_week(shift["shift_date"])
    shift_type = shift["shift_type"].lower()
    account = shift["account"].lower()

    emp_availability = availability_map.get(employee_id, {})

    if not emp_availability:
        return False

    account_data = (
        emp_availability.get(account)
        or emp_availability.get("default")
    )
    

    # STRICT MODE
    if account_data:

        day_data = account_data.get(day)

        if not day_data:
            return False

        shift_data = day_data.get(shift_type)

        if not shift_data:
            return False

        return shift_data.get("is_available", False)

    # RELAX ACCOUNT MODE
    if (
        context and
        context["context_flags"].get("relax_account")
    ):

        for acc_data in emp_availability.values():

            day_data = acc_data.get(day)

            if not day_data:
                continue

            shift_data = day_data.get(shift_type)

            if not shift_data:
                continue

            if shift_data.get("is_available"):
                return True

    return False

# LEAVES & ABSENCES
def is_on_leave(employee_id, shift_date, leaves_map):
    shift_date = normalize_date(shift_date)
    return shift_date in leaves_map.get(employee_id, set())


def is_absent(employee_id, shift_date, absences_map):
    """
    absences_map: same structure as leaves_map
    """
    if isinstance(shift_date, datetime):
        shift_date = shift_date.strftime("%Y-%m-%d")

    return shift_date in absences_map.get(employee_id, set())


def is_unavailable(employee_id, shift, context):
    return (
        not is_available(
            employee_id,
            shift,
            context["availability_map"],
            context
        ) or
        is_on_leave(employee_id, shift["shift_date"], context["leaves_map"]) or
        is_absent(employee_id, shift["shift_date"], context["absences_map"])
    )


# Role check
def has_role(employee, role, context=None):
    role = role.lower()

    # Relax role mode: allow any employee with at least one scheduling permission
    if (
        context and
        context["context_flags"].get("relax_role")
    ):
        account_permissions = employee.get("account_role_permissions", {})

        return any(
            len(role_keys) > 0
            for role_keys in account_permissions.values()
        )

    # Account-specific role check
    if context:
        shift = context.get("current_shift")

        if shift:
            account_name = str(shift.get("account", "")).strip().lower()
            account_permissions = employee.get("account_role_permissions", {})
            allowed_roles = account_permissions.get(account_name, [])

            return role in allowed_roles

    return False


# Assignment checks
def already_assigned(employee_id, shift_id, context):
    assignments = context["context_assignments_by_employee"].get(employee_id, [])

    for a in assignments:
        if a["shift_id"] == shift_id:
            return True

    return False

def already_assigned_same_time(employee_id, shift, context):
    assignments = context["context_assignments_by_employee"].get(employee_id, [])

    for a in assignments:
        if (
            normalize_date(a["shift_date"]) == normalize_date(shift["shift_date"]) and
            a["shift_type"] == shift["shift_type"]
        ):
            return True

    return False

def to_time(value):
    if value is None:
        return None

    if hasattr(value, "hour") and hasattr(value, "minute"):
        return value

    value = str(value).strip()

    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            pass

    return None


def shift_start_end_at(shift):
    shift_date = to_date(shift["shift_date"])
    start_time = to_time(shift.get("start_time"))
    end_time = to_time(shift.get("end_time"))

    if not start_time or not end_time:
        return None, None

    start_at = datetime.combine(shift_date, start_time)
    end_at = datetime.combine(shift_date, end_time)

    if end_at <= start_at:
        end_at += timedelta(days=1)

    return start_at, end_at


def violates_time_overlap_or_min_rest(employee_id, shift, context):
    assignments = context["context_assignments_by_employee"].get(
        employee_id,
        []
    )

    candidate_start, candidate_end = shift_start_end_at(shift)

    # Fallback to old behavior if time data is missing.
    if not candidate_start or not candidate_end:
        return already_assigned_same_time(employee_id, shift, context)

    try:
        min_rest_hours = int(
            context["settings"].get("min_rest_period_hours") or 0
        )
    except (TypeError, ValueError):
        min_rest_hours = 0

    for assignment in assignments:
        existing_start, existing_end = shift_start_end_at(assignment)

        if not existing_start or not existing_end:
            continue

        # Hard block actual overlap.
        if existing_start < candidate_end and existing_end > candidate_start:
            return True

        # Hard block insufficient rest.
        if min_rest_hours > 0:
            if existing_end <= candidate_start:
                rest_hours = (
                    candidate_start - existing_end
                ).total_seconds() / 3600
            elif candidate_end <= existing_start:
                rest_hours = (
                    existing_start - candidate_end
                ).total_seconds() / 3600
            else:
                rest_hours = 0

            if rest_hours < min_rest_hours:
                return True

    return False

def assigned_count_same_day(employee_id, shift, context):
    count = 0

    assignments = context["context_assignments_by_employee"].get(employee_id, [])

    for a in assignments:
        if normalize_date(a["shift_date"]) == normalize_date(shift["shift_date"]):
            count += 1

    return count


# Main validation
def is_valid_candidate(employee, shift, role, context):
    """
    Master function used by scheduler
    """

    employee_id = employee["employee_id"]
    shift_id = shift["shift_id"]

    # Role check
    context["current_shift"] = shift

    if not has_role(employee, role, context):
        return False

    # Availability + leave + absence
    if is_unavailable(employee_id, shift, context):
        return False

    # Already assigned to this shift
    if already_assigned(employee_id, shift_id, context):
        return False
    
    if violates_time_overlap_or_min_rest(employee_id, shift, context):
        return False
    
    allow_double_shifts = context["settings"].get("allow_double_shifts", False)

    configured_max_shifts_per_day = int(
        context["settings"].get("max_shifts_per_day") or 1
    )

    if not allow_double_shifts:
        max_shifts = 1
    else:
        max_shifts = max(2, configured_max_shifts_per_day)

    if assigned_count_same_day(employee_id, shift, context) >= max_shifts:
        return False
    

    max_shifts_per_week = context["settings"].get("max_shifts_per_week")

    if max_shifts_per_week is not None:
        max_shifts_per_week = int(max_shifts_per_week)

        if max_shifts_per_week > 0:
            current_week_count = context["assignment_counts"].get(employee_id, 0)

            if current_week_count >= max_shifts_per_week:
                context["max_shift_week_failures"] = (
                    context.get("max_shift_week_failures", 0) + 1
                )
                return False

    max_consecutive_days = context["settings"].get("max_working_days")

    if max_consecutive_days is not None:
        max_consecutive_days = int(max_consecutive_days)

        if max_consecutive_days > 0:
            projected_consecutive_days = projected_max_consecutive_working_days(
                employee_id,
                shift["shift_date"],
                context
            )

            if projected_consecutive_days > max_consecutive_days:
                context["rest_day_failures"] = (
                    context.get("rest_day_failures", 0) + 1
                )

                return False

    return True

def to_date(value):
    if isinstance(value, datetime):
        return value.date()

    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value

    return datetime.strptime(str(value), "%Y-%m-%d").date()


def projected_max_consecutive_working_days(employee_id, candidate_shift_date, context):
    days = set()

    assignments = context[
        "context_assignments_by_employee"
    ].get(employee_id, [])

    for a in assignments:
        days.add(to_date(a["shift_date"]))

    days.add(to_date(candidate_shift_date))

    sorted_days = sorted(days)

    if not sorted_days:
        return 0

    longest = 1
    current = 1

    for i in range(1, len(sorted_days)):
        previous_day = sorted_days[i - 1]
        current_day = sorted_days[i]

        if (current_day - previous_day).days == 1:
            current += 1
        else:
            current = 1

        longest = max(longest, current)

    return longest

def working_days(employee_id, context):
    days = set()

    assignments = context[
        "context_assignments_by_employee"
    ].get(employee_id, [])

    for a in assignments:
        days.add(normalize_date(a["shift_date"]))

    return days
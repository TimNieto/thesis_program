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

    # Fallback for old behavior
    if role == "host":
        return employee.get("can_be_host", False)

    if role == "operator":
        return employee.get("can_be_operator", False)

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
    
    if already_assigned_same_time(employee_id, shift, context):
        return False
    
    allow_double_shifts = context["settings"]["allow_double_shifts"]

    max_shifts = 2 if allow_double_shifts else 1

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

    days = working_days(employee_id, context)

    candidate_day = normalize_date(shift["shift_date"])

    projected_days = set(days)
    projected_days.add(candidate_day)

    max_days = context["settings"]["max_working_days"]

    if len(projected_days) > max_days:

        context["rest_day_failures"] = (
            context.get("rest_day_failures", 0) + 1
        )

        return False

    return True

def working_days(employee_id, context):
    days = set()

    assignments = context[
        "context_assignments_by_employee"
    ].get(employee_id, [])

    for a in assignments:
        days.add(normalize_date(a["shift_date"]))

    return days
# backend/scheduler/constraints.py

from datetime import datetime

# -------------------------------
# BASIC HELPERS
# -------------------------------

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


# -------------------------------
# AVAILABILITY
# -------------------------------

def is_available(employee_id, shift, availability_map):
    """
    Strict availability:
    - Must match day
    - Must match shift
    - Must be explicitly available
    """

    day = get_day_of_week(shift["shift_date"])   # e.g. 'friday'
    shift_type = shift["shift_type"].lower()     # e.g. 'nn'

    emp_availability = availability_map.get(employee_id, {})

    # ❌ No data at all → NOT available
    if not emp_availability:
        return False

    day_data = emp_availability.get(day)

    # ❌ No record for that day → NOT available
    if not day_data:
        return False

    shift_data = day_data.get(shift_type)

    # ❌ No record for that shift → NOT available
    if not shift_data:
        return False

    # ✅ Final check
    return shift_data.get("is_available", False)


# -------------------------------
# LEAVES & ABSENCES
# -------------------------------

def is_on_leave(employee_id, shift_date, leaves_map):
    """
    leaves_map: {
        employee_id: set(date_str)
    }
    """
    if isinstance(shift_date, datetime):
        shift_date = shift_date.strftime("%Y-%m-%d")

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
        not is_available(employee_id, shift, context["availability_map"]) or
        is_on_leave(employee_id, shift["shift_date"], context["leaves_map"]) or
        is_absent(employee_id, shift["shift_date"], context["absences_map"])
    )


# -------------------------------
# ROLE CHECK
# -------------------------------

def has_role(employee, role):
    """
    role: 'host' or 'operator'
    """
    if role == "host":
        return employee.get("can_be_host", False)

    if role == "operator":
        return employee.get("can_be_operator", False)

    return False


# -------------------------------
# ASSIGNMENT CHECKS
# -------------------------------

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

# -------------------------------
# MAIN VALIDATION
# -------------------------------

MAX_SHIFTS_PER_DAY = 1

def is_valid_candidate(employee, shift, role, context):
    """
    Master function used by scheduler
    """

    employee_id = employee["employee_id"]
    shift_id = shift["shift_id"]

    # Role check
    if not has_role(employee, role):
        return False

    # Availability + leave + absence
    if is_unavailable(employee_id, shift, context):
        return False

    # Already assigned to this shift
    if already_assigned(employee_id, shift_id, context):
        return False
    
    if already_assigned_same_time(employee_id, shift, context):
        return False
    
    if assigned_count_same_day(employee_id, shift, context) >= MAX_SHIFTS_PER_DAY:
        return False

    return True


# def is_valid_candidate(employee, shift, role, context):
#     employee_id = employee["employee_id"]
#     shift_id = shift["shift_id"]

#     print(f"\nCHECKING EMP {employee_id} FOR {role} {shift['shift_type']} {shift['shift_date']}")

#     if not has_role(employee, role):
#         print("❌ role fail")
#         return False

#     if not is_available(employee_id, shift, context["availability_map"]):
#         print("❌ availability fail")
#         return False

#     if is_on_leave(employee_id, shift["shift_date"], context["leaves_map"]):
#         print("❌ on leave")
#         return False

#     if is_absent(employee_id, shift["shift_date"], context["absences_map"]):
#         print("❌ absent")
#         return False

#     if already_assigned(employee_id, shift_id, context):
#         print("❌ already assigned same shift")
#         return False
    
#     if already_assigned_same_time(employee_id, shift, context):
#         print("❌ same time conflict")
#         return False
    
#     if assigned_count_same_day(employee_id, shift, context) >= MAX_SHIFTS_PER_DAY:
#         print("❌ max shifts reached")
#         return False

#     print("✅ VALID")
#     return True

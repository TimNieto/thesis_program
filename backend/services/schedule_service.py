# backend/services/schedule_service.py

from db.database import get_connection
from scheduler.greedy import generate_schedule
from collections import defaultdict


# -------------------------------
# FETCH HELPERS
# -------------------------------

def fetch_employees(cursor):
    cursor.execute("""
        SELECT employee_id, full_name, can_be_host, can_be_operator
        FROM employees
        WHERE employment_status = 'Active'
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "full_name": r[1],
            "can_be_host": r[2],
            "can_be_operator": r[3]
        }
        for r in rows
    ]


def fetch_shifts(cursor):
    cursor.execute("""
    SELECT shift_id, shift_date, account, shift_type,
           required_host_count, required_operator_count
    FROM shifts
    WHERE shift_date BETWEEN '2026-01-01' AND '2026-01-31'
""")
     #WHERE shift_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'

    rows = cursor.fetchall()

    return [
        {
            "shift_id": r[0],
            "shift_date": r[1],
            "account": r[2],  # 🔥 ADD THIS
            "shift_type": r[3],
            "required_host_count": r[4] or 0,
            "required_operator_count": r[5] or 0
        }
        for r in rows
    ]


def fetch_availability(cursor):
    cursor.execute("""
        SELECT employee_id, day_of_week, is_available, preferred_shift
        FROM availability
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "day_of_week": r[1],
            "is_available": r[2],
            "preferred_shift": r[3]
        }
        for r in rows
    ]


def fetch_leaves(cursor):
    cursor.execute("""
        SELECT employee_id, date
        FROM leaves
        WHERE status = 'approved'
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "date": str(r[1])
        }
        for r in rows
    ]


def fetch_absences(cursor):
    cursor.execute("""
        SELECT employee_id, date
        FROM absences
        WHERE status = 'approved'
        AND employee_id IS NOT NULL
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "date": str(r[1])
        }
        for r in rows
    ]

def to_dict(d):
    if isinstance(d, defaultdict):
        return {k: to_dict(v) for k, v in d.items()}
    return d

def group_schedule(assignments):
    """
    Convert flat assignments → nested structure:
    Day → Shift → Role → [employees]
    """
    schedule = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(
                lambda: {
                    "host": [],
                    "operator": []
                }
            )
        )
    )

    day_cache = {}

    for a in assignments:
        
        shift_date = a["shift_date"]

        day = day_cache.get(shift_date)

        if not day:
            day = shift_date.strftime("%A")
            day_cache[shift_date] = day

        shift = a["shift_type"]
        role = a["role"]
        account = a["account"]

        schedule[account][day][shift][role].append({
            "employee_id": a["employee_id"],
            "employee_name": a["employee_name"]
        })

    return to_dict(schedule)

# -------------------------------
# MAIN SERVICE
# -------------------------------

def generate_weekly_schedule():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Fetch all data
        employees = fetch_employees(cursor)
        shifts = fetch_shifts(cursor)
        availability = fetch_availability(cursor)
        leaves = fetch_leaves(cursor)
        absences = fetch_absences(cursor)

        # Run scheduler
        result = generate_schedule(
            employees,
            shifts,
            availability,
            leaves,
            absences
        )

        grouped = group_schedule(result["assignments"])

        return {
            "status": "success",
            "assignments": result["assignments"],      # keep raw (important for debugging)
            "grouped_schedule": grouped,               # ✅ NEW structured data
            "unfilled_slots": result["unfilled_slots"]
        }

    finally:
        cursor.close()
        conn.close()
# backend/services/schedule_service.py

from db.database import get_connection
from scheduler.greedy import generate_schedule
from collections import defaultdict
from datetime import datetime, timedelta


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

def get_next_week_range():
    today = datetime.today()

    days_ahead = 7 - today.weekday()  # Monday = 0
    next_monday = today + timedelta(days=days_ahead)
    next_sunday = next_monday + timedelta(days=6)

    return next_monday.date(), next_sunday.date()

def fetch_shifts(cursor):
    start_date, end_date = get_next_week_range()

    cursor.execute("""
        SELECT shift_id, shift_date, account, shift_type,
               required_host_count, required_operator_count
        FROM shifts
        WHERE shift_date BETWEEN %s AND %s
        ORDER BY shift_date
    """, (start_date, end_date))

    rows = cursor.fetchall()

    return [
        {
            "shift_id": r[0],
            "shift_date": r[1],
            "account": r[2],
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
        ensure_next_week_shifts(cursor)
        conn.commit()
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

        # -------------------------------
        # RESET OLD DATA
        # -------------------------------

        # 🧹 delete ALL cover requests (IMPORTANT)
        cursor.execute("DELETE FROM coverage_requests")

        # -------------------------------
        # SAVE GENERATED SCHEDULE (DRAFT)
        # -------------------------------

        # clear previous draft schedule
        cursor.execute("DELETE FROM generated_schedule")

        # insert new generated schedule
        for a in result["assignments"]:
            cursor.execute("""
                INSERT INTO generated_schedule (
                    shift_id,
                    employee_id,
                    role,
                    shift_date,
                    shift_type,
                    account
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                a["shift_id"],
                a["employee_id"],
                a["role"],
                a["shift_date"],   # ✅ ADD THIS
                a["shift_type"],   # ✅ ADD THIS
                a["account"]       # ✅ ADD THIS
            ))

        conn.commit()

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


def get_generated_schedule():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 
                g.schedule_id,
                s.shift_date,
                s.shift_type,
                s.account,
                e.employee_id,
                e.full_name,
                g.role
            FROM generated_schedule g
            JOIN shifts s ON g.shift_id = s.shift_id
            JOIN employees e ON g.employee_id = e.employee_id
        """)

        rows = cursor.fetchall()

        assignments = [
            {
                "schedule_id": r[0],
                "shift_date": r[1],
                "shift_type": r[2],
                "account": r[3],
                "employee_id": r[4],
                "employee_name": r[5],
                "role": r[6]
            }
            for r in rows
        ]

        grouped = group_schedule(assignments)

        return {
            "status": "success",
            "assignments": assignments,
            "grouped_schedule": grouped
        }

    finally:
        cursor.close()
        conn.close()

def ensure_next_week_shifts(cursor):
    from datetime import datetime, timedelta

    today = datetime.today()
    days_ahead = 7 - today.weekday()
    next_monday = today + timedelta(days=days_ahead)

    # 🔥 Get ONE DAY TEMPLATE ONLY (Jan 1)
    cursor.execute("""
        SELECT account, shift_type,
               start_time, end_time,
               required_host_count, required_operator_count
        FROM shifts
        WHERE shift_date = '2026-01-01'
        ORDER BY account, shift_type
    """)

    template = cursor.fetchall()

    # 🔁 Loop 7 days (Mon → Sun)
    for day_offset in range(7):
        new_date = (next_monday + timedelta(days=day_offset)).date()

        for row in template:
            account, shift_type, start_time, end_time, host_count, op_count = row

            cursor.execute("""
                INSERT INTO shifts (
                    shift_date, account, shift_type,
                    start_time, end_time,
                    required_host_count, required_operator_count
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (shift_date, account, shift_type) DO NOTHING
            """, (
                new_date,
                account,
                shift_type,
                start_time,
                end_time,
                host_count,
                op_count
            ))


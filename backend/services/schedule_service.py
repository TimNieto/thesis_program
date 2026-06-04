# backend/services/schedule_service.py

from db.database import get_connection
from scheduler.hybrid import generate_schedule
from collections import defaultdict
from datetime import datetime, timedelta


# Fetch helpers
def fetch_shift_templates(cursor):

    cursor.execute("""
        SELECT
            shift_template_id,
            shift_name,
            start_time,
            end_time
        FROM shift_templates
        WHERE is_active = TRUE
        ORDER BY start_time
    """)

    rows = cursor.fetchall()

    return [
        {
            "shift_template_id": r[0],
            "shift_name": r[1],
            "start_time": r[2],
            "end_time": r[3]
        }
        for r in rows
    ]

def fetch_active_staffing_roles(cursor):
    cursor.execute("""
        SELECT
            staffing_role_id,
            role_name,
            role_key
        FROM staffing_roles
        WHERE is_active = TRUE
        ORDER BY staffing_role_id
    """)

    rows = cursor.fetchall()

    return [
        {
            "staffing_role_id": r[0],
            "role_name": r[1],
            "role_key": r[2]
        }
        for r in rows
    ]


def fetch_staffing_requirements_map(cursor):
    cursor.execute("""
        SELECT
            ssr.shift_template_id,
            sr.staffing_role_id,
            sr.role_name,
            sr.role_key,
            ssr.required_count
        FROM shift_staffing_requirements ssr

        JOIN staffing_roles sr
            ON ssr.staffing_role_id = sr.staffing_role_id

        WHERE ssr.is_active = TRUE
        AND sr.is_active = TRUE

        ORDER BY sr.staffing_role_id
    """)

    rows = cursor.fetchall()

    requirements_map = {}

    for r in rows:
        shift_template_id = r[0]

        if shift_template_id not in requirements_map:
            requirements_map[shift_template_id] = []

        requirements_map[shift_template_id].append({
            "staffing_role_id": r[1],
            "role_name": r[2],
            "role_key": r[3],
            "required_count": r[4]
        })

    return requirements_map


def build_empty_roles(active_roles):
    empty = {}

    for role in active_roles:
        empty[role["role_key"]] = []

    return empty

def fetch_employees(cursor):
    cursor.execute("""
        SELECT employee_id, full_name, main_role, can_be_host, can_be_operator
        FROM employees
        WHERE employment_status = 'Active'
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "full_name": r[1],
            "main_role": r[2],
            "can_be_host": r[3],
            "can_be_operator": r[4]
        }
        for r in rows
    ]

def get_next_week_range():
    today = datetime.today()

    days_ahead = 7 - today.weekday()
    next_monday = today + timedelta(days=days_ahead)
    next_sunday = next_monday + timedelta(days=6)

    return next_monday.date(), next_sunday.date()

def fetch_shifts(cursor, gy_fatigue_penalty=20):
    start_date, end_date = get_next_week_range()

    staffing_requirements_map = fetch_staffing_requirements_map(cursor)

    cursor.execute("""
        SELECT
            s.shift_id,
            s.shift_date,
            s.account,
            st.shift_template_id,
            st.shift_name,
            st.start_time,
            st.end_time,
            st.fatigue_penalty,
            st.difficulty_weight,
            st.is_overnight

        FROM shifts s

        JOIN shift_templates st
            ON s.shift_template_id = st.shift_template_id
            AND st.is_active = TRUE

        WHERE s.shift_date BETWEEN %s AND %s
        AND EXISTS (
            SELECT 1
            FROM account_settings a
            WHERE LOWER(a.account_name) = LOWER(s.account)
            AND a.pending_delete = FALSE
        )

        ORDER BY
            s.shift_date,
            (
                SELECT a.account_setting_id
                FROM account_settings a
                WHERE a.account_name = s.account
                LIMIT 1
            ),
            st.start_time
    """, (start_date, end_date))

    rows = cursor.fetchall()

    return [
        {
            "shift_id": r[0],
            "shift_date": r[1],
            "account": r[2],
            "shift_template_id": r[3],
            "shift_type": r[4],
            "start_time": r[5],
            "end_time": r[6],
            "fatigue_penalty": (
                gy_fatigue_penalty
                if str(r[4]).upper() == "GY"
                else r[7]
            ),
            "difficulty_weight": r[8],
            "is_overnight": (
                True
                if str(r[4]).upper() == "GY"
                else r[9]
            ),
            "staffing_requirements": staffing_requirements_map.get(r[3], [])
        }
        for r in rows
    ]


def fetch_availability(cursor):
    cursor.execute("""
        SELECT employee_id,
            account,
            day_of_week,
            is_available,
            preferred_shift
        FROM availability
    """)

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "account": r[1],
            "day_of_week": r[2],
            "is_available": r[3],
            "preferred_shift": r[4]
        }
        for r in rows
    ]


def fetch_leaves(cursor):
    cursor.execute("""
        SELECT employee_id, date
        FROM leaves
        WHERE LOWER(status) = 'approved'
    """)
    return cursor.fetchall()

def build_leaves_map(leaves):
    leaves_map = {}

    for emp_id, date in leaves:

        date_str = str(date)

        if emp_id not in leaves_map:
            leaves_map[emp_id] = set()

        leaves_map[emp_id].add(date_str)

    return leaves_map

def fetch_history_scores(cursor):
    cursor.execute("""
        SELECT
            COALESCE(cr.requested_by, gs.employee_id) AS employee_id,
            s.account,
            st.shift_name,
            TRIM(TO_CHAR(s.shift_date, 'Day')) AS day_name,
            gs.role,

            COUNT(cr.id) FILTER (
                WHERE cr.id IS NOT NULL
            ) AS cover_requests,

            COUNT(cr.id) FILTER (
                WHERE cr.request_type = 'emergency'
            ) AS emergency_requests,

            COUNT(sa.id) FILTER (
                WHERE sa.status = 'approved'
            ) AS applications,

            COUNT(gs.schedule_id) FILTER (
                WHERE cr.id IS NULL
            ) AS successful_assignments

        FROM generated_schedule gs

        JOIN shifts s
            ON gs.shift_id = s.shift_id

        JOIN shift_templates st
            ON s.shift_template_id = st.shift_template_id

        LEFT JOIN coverage_requests cr
            ON cr.schedule_id = gs.schedule_id

        LEFT JOIN shift_applications sa
            ON sa.coverage_request_id = cr.id
            AND sa.applicant_id = gs.employee_id

        WHERE gs.is_archived = TRUE

        GROUP BY
            COALESCE(cr.requested_by, gs.employee_id),
            s.account,
            st.shift_name,
            day_name,
            gs.role
    """)

    rows = cursor.fetchall()

    history = {}

    for r in rows:
        key = (
            r[0],
            r[1].lower(),
            r[2].lower(),
            r[3].strip().lower(),
            r[4].lower()
        )

        history[key] = {
            "cover_requests": r[5] or 0,
            "emergency_requests": r[6] or 0,
            "applications": r[7] or 0,
            "successful_assignments": r[8] or 0
        }

    return history

def to_dict(d):
    if isinstance(d, defaultdict):
        return {k: to_dict(v) for k, v in d.items()}
    return d

def group_schedule(assignments, active_roles):
    """
    Convert flat assignments → nested structure:
    Account → Day → Shift → Role → [employees]
    """

    schedule = defaultdict(
        lambda: defaultdict(
            lambda: defaultdict(dict)
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

        if role not in schedule[account][day][shift]:
            schedule[account][day][shift][role] = []

        slot_index = a.get("slot_index")

        if slot_index is None:
            slot_index = len(schedule[account][day][shift][role])

        schedule[account][day][shift][role].append({
            "schedule_id": a.get("schedule_id"),
            "shift_id": a.get("shift_id"),
            "employee_id": a.get("employee_id"),
            "employee_name": a.get("employee_name") or "",
            "slot_index": slot_index
        })

    result = to_dict(schedule)

    for account in result:
        for day in result[account]:
            for shift in result[account][day]:
                for role in result[account][day][shift]:
                    result[account][day][shift][role].sort(
                        key=lambda emp: emp.get("slot_index", 0)
                    )
    for account in result:
        for day in result[account]:
            for shift in result[account][day]:
                for role in active_roles:
                    role_key = role["role_key"]

                    if role_key not in result[account][day][shift]:
                        result[account][day][shift][role_key] = []

    return result

# Main service
def generate_weekly_schedule():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        ensure_next_week_shifts(cursor)
        conn.commit()

        employees = fetch_employees(cursor)

        # Fetch settings
        cursor.execute("""
            SELECT
                max_working_days,
                max_shifts_per_day,
                max_shifts_per_week,
                allow_double_shifts,
                fairness_weight,
                gy_fatigue_penalty
            FROM company_settings
            LIMIT 1
        """)

        settings_row = cursor.fetchone()

        settings = {
            "max_working_days": settings_row[0],
            "max_shifts_per_day": settings_row[1],
            "max_shifts_per_week": settings_row[2],
            "allow_double_shifts": settings_row[3],
            "fairness_weight": settings_row[4],
            "gy_fatigue_penalty": settings_row[5]
        }

        shifts = fetch_shifts(
            cursor,
            settings["gy_fatigue_penalty"]
        )

        availability = fetch_availability(cursor)
        leaves = fetch_leaves(cursor)
        leaves_map = build_leaves_map(leaves)
        absences_map = {}

        # FETCH ACCOUNT SETTINGS
        cursor.execute("""
            SELECT
                account_name,
                priority_level,
                require_host,
                require_operator,
                operator_policy,
                allow_partial_staffing
            FROM account_settings
            WHERE pending_delete = FALSE
            ORDER BY account_setting_id ASC
        """)

        account_rows = cursor.fetchall()

        account_settings = {}

        for row in account_rows:

            account_name = row[0]

            account_settings[account_name] = {
                "priority_level": row[1],
                "require_host": row[2],
                "require_operator": row[3],
                "operator_policy": row[4],
                "allow_partial_staffing": row[5]
            }


        history_scores = fetch_history_scores(cursor)

        result = generate_schedule(
            employees,
            shifts,
            availability,
            leaves_map,
            absences_map,
            settings,
            account_settings,
            history_scores
        )
 
        # ✅ BUILD LOOKUP
        employee_lookup = {
            e["employee_id"]: e["full_name"]
            for e in employees
        }

        # ✅ ATTACH NAMES TO ASSIGNMENTS
        for a in result["assignments"]:
            emp_id = a["employee_id"]
            a["employee_name"] = employee_lookup.get(emp_id, f"Employee {emp_id}")


        active_roles = fetch_active_staffing_roles(cursor)

        grouped = group_schedule(
            result["assignments"],
            active_roles
        )

        shift_templates = fetch_shift_templates(cursor)
        
        for account_name in account_settings.keys():

            if account_name not in grouped:
                grouped[account_name] = {}

            for day in [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ]:

                if day not in grouped[account_name]:
                    grouped[account_name][day] = {}
                
                for template in shift_templates:

                    shift_name = template["shift_name"]

                    if shift_name not in grouped[account_name][day]:

                        grouped[account_name][day][shift_name] = build_empty_roles(active_roles)
        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": grouped, 
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
                g.shift_id,

                s.shift_date,
                s.account,

                st.shift_name,

                e.employee_id,
                e.full_name,

                g.role,
                g.slot_index

            FROM generated_schedule g

            JOIN shifts s
                ON g.shift_id = s.shift_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id

            LEFT JOIN employees e
                ON g.employee_id = e.employee_id

            WHERE g.is_archived = FALSE

            ORDER BY
                s.shift_date,
                st.start_time,
                g.role,
                g.slot_index
        """)

        rows = cursor.fetchall()

        assignments = [
            {
                "schedule_id": r[0],
                "shift_id": r[1],
                "shift_date": r[2],
                "account": r[3],
                "shift_type": r[4],
                "employee_id": r[5],
                "employee_name": r[6] if r[6] else "",
                "role": r[7],
                "slot_index": r[8]
            }
            for r in rows
        ]

        active_roles = fetch_active_staffing_roles(cursor)

        grouped = group_schedule(
            assignments,
            active_roles
        )

        cursor.execute("""
            SELECT account_name
            FROM account_settings
            WHERE pending_delete = FALSE
            ORDER BY account_setting_id ASC
        """)

        account_rows = cursor.fetchall()

        shift_templates = fetch_shift_templates(cursor)

        for row in account_rows:

            account_name = row[0]

            if account_name not in grouped:
                grouped[account_name] = {}

            for day in [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ]:

                if day not in grouped[account_name]:
                    grouped[account_name][day] = {}
                
                for template in shift_templates:

                    shift_name = template["shift_name"]

                    if shift_name not in grouped[account_name][day]:

                        grouped[account_name][day][shift_name] = build_empty_roles(active_roles)

        return {
            "status": "success",
            "assignments": assignments,
            "grouped_schedule": grouped
        }

    finally:
        cursor.close()
        conn.close()

def ensure_next_week_shifts(cursor):

    today = datetime.today()

    days_ahead = 7 - today.weekday()

    next_monday = today + timedelta(days=days_ahead)

    # GET ACCOUNTS
    cursor.execute("""
        SELECT account_name
        FROM account_settings
        WHERE pending_delete = FALSE
        ORDER BY account_setting_id ASC
    """)

    accounts = cursor.fetchall()

    # GET SHIFT TEMPLATES
    cursor.execute("""
        SELECT shift_template_id
        FROM shift_templates
        WHERE is_active = TRUE
        ORDER BY start_time
    """)

    templates = cursor.fetchall()

    # GENERATE 7 DAYS
    for day_offset in range(7):

        new_date = (
            next_monday + timedelta(days=day_offset)
        ).date()

        for account in accounts:

            account_name = account[0]

            for template in templates:

                template_id = template[0]

                cursor.execute("""
                    INSERT INTO shifts (
                        shift_date,
                        account,
                        shift_template_id
                    )
                    VALUES (
                        %s,
                        %s,
                        %s
                    )
                    ON CONFLICT (
                        shift_date,
                        account,
                        shift_template_id
                    )
                    DO NOTHING
                """, (
                    new_date,
                    account_name,
                    template_id
                ))


def cleanup_pending_deleted_accounts(cursor):

    cursor.execute("""
        SELECT account_name
        FROM account_settings
        WHERE pending_delete = TRUE
    """)

    pending_accounts = cursor.fetchall()

    if not pending_accounts:
        return

    for row in pending_accounts:

        account_name = row[0]

        cursor.execute("""
            DELETE FROM availability
            WHERE LOWER(account) = LOWER(%s)
        """, (account_name,))

        cursor.execute("""
            DELETE FROM shifts
            WHERE LOWER(account) = LOWER(%s)
            AND shift_id NOT IN (
                SELECT shift_id
                FROM generated_schedule
                WHERE is_archived = FALSE
            )
        """, (account_name,))

        cursor.execute("""
            DELETE FROM account_settings
            WHERE LOWER(account_name) = LOWER(%s)
            AND pending_delete = TRUE
        """, (account_name,))
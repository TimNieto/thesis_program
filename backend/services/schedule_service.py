#---------------------------------------------
# backend/services/schedule_service.py

from db.database import get_connection
from scheduler.hybrid import generate_schedule
from collections import defaultdict
from datetime import datetime, timedelta


# Fetch helpers
def fetch_shift_templates(cursor, company_id: int):
    cursor.execute("""
        SELECT
            shift_template_id,
            shift_name,
            start_time,
            end_time
        FROM shift_templates
        WHERE company_id = %s
        AND is_active = TRUE
        ORDER BY start_time
    """, (company_id,))

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

def fetch_active_staffing_roles(cursor, company_id: int):
    cursor.execute("""
        SELECT
            role_id,
            role_name,
            role_key
        FROM roles
        WHERE company_id = %s
        AND is_active = TRUE
        AND role_key IN ('host', 'operator')
        ORDER BY role_id
    """, (company_id,))

    rows = cursor.fetchall()

    return [
        {
            "staffing_role_id": r[0],
            "role_name": r[1],
            "role_key": r[2]
        }
        for r in rows
    ]


def fetch_staffing_requirements_map(cursor, company_id: int):
    cursor.execute("""
        SELECT
            ssr.shift_template_id,
            ssr.account_id,
            r.role_id,
            r.role_name,
            r.role_key,
            ssr.required_count
        FROM shift_staffing_requirements ssr
        JOIN roles r
            ON ssr.role_id = r.role_id
            AND ssr.company_id = r.company_id
        WHERE ssr.company_id = %s
        AND ssr.is_active = TRUE
        AND r.is_active = TRUE
        ORDER BY ssr.account_id, r.role_id
    """, (company_id,))

    rows = cursor.fetchall()

    requirements_map = {}

    for row in rows:
        shift_template_id = row[0]
        account_id = row[1]

        key = (shift_template_id, account_id)

        if key not in requirements_map:
            requirements_map[key] = []

        requirements_map[key].append({
            "staffing_role_id": row[2],
            "role_name": row[3],
            "role_key": row[4],
            "required_count": row[5]
        })

    return requirements_map


def build_empty_roles(active_roles):
    empty = {}

    for role in active_roles:
        empty[role["role_key"]] = []

    return empty

def fetch_employees(cursor, company_id: int):
    cursor.execute("""
        SELECT
            e.employee_id,
            e.full_name,
            e.company_id
        FROM employees e
        WHERE e.company_id = %s
        AND e.employment_status = 'Active'
    """, (company_id,))

    employee_rows = cursor.fetchall()
    employees = []

    for employee_id, full_name, emp_company_id in employee_rows:
        # General roles for display/scoring fallback only
        cursor.execute("""
            SELECT r.role_key
            FROM employee_roles er
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            WHERE er.employee_id = %s
            AND er.company_id = %s
            AND r.is_active = TRUE
        """, (employee_id, emp_company_id))

        general_role_keys = [r[0] for r in cursor.fetchall()]

        # Account-specific scheduling permissions
        cursor.execute("""
            SELECT
                a.account_name,
                r.role_key
            FROM account_preferences ap
            JOIN accounts a
                ON ap.account_id = a.account_id
                AND ap.company_id = a.company_id
            JOIN roles r
                ON ap.role_id = r.role_id
                AND ap.company_id = r.company_id
            WHERE ap.employee_id = %s
            AND ap.company_id = %s
            AND a.is_active = TRUE
            AND r.is_active = TRUE
            AND r.role_key IN ('host', 'operator')
        """, (employee_id, emp_company_id))

        account_role_rows = cursor.fetchall()

        account_role_permissions = {}

        for account_name, role_key in account_role_rows:
            account_key = account_name.strip().lower()
            role_key = role_key.strip().lower()

            if account_key not in account_role_permissions:
                account_role_permissions[account_key] = set()

            account_role_permissions[account_key].add(role_key)

        account_role_permissions = {
            account: list(role_keys)
            for account, role_keys in account_role_permissions.items()
        }

        can_be_host = any(
            "host" in role_keys
            for role_keys in account_role_permissions.values()
        )

        can_be_operator = any(
            "operator" in role_keys
            for role_keys in account_role_permissions.values()
        )

        if can_be_host and can_be_operator:
            main_role = "Both"
        elif can_be_host:
            main_role = "Host"
        elif can_be_operator:
            main_role = "Operator"
        elif "hr_manager" in general_role_keys:
            main_role = "Team Leader"
        else:
            main_role = "Employee"

        employees.append({
            "employee_id": employee_id,
            "full_name": full_name,
            "main_role": main_role,
            "can_be_host": can_be_host,
            "can_be_operator": can_be_operator,
            "account_role_permissions": account_role_permissions,
            "company_id": emp_company_id
        })

    return employees

def get_next_week_range():
    today = datetime.today()

    days_ahead = 7 - today.weekday()
    next_monday = today + timedelta(days=days_ahead)
    next_sunday = next_monday + timedelta(days=6)

    return next_monday.date(), next_sunday.date()


def fetch_shifts(cursor, company_id: int, gy_fatigue_penalty=20):
    start_date, end_date = get_next_week_range()

    staffing_requirements_map = fetch_staffing_requirements_map(
        cursor,
        company_id
    )

    cursor.execute("""
        SELECT
            s.shift_id,
            s.shift_date,
            a.account_name,
            st.shift_template_id,
            st.shift_name,
            st.start_time,
            st.end_time,
            st.fatigue_penalty,
            st.difficulty_weight,
            st.is_overnight,
            a.account_id
        FROM shifts s
        JOIN accounts a
            ON s.account_id = a.account_id
            AND s.company_id = a.company_id
            AND a.is_active = TRUE
        JOIN shift_templates st
            ON s.shift_template_id = st.shift_template_id
            AND s.company_id = st.company_id
            AND st.is_active = TRUE
        WHERE s.company_id = %s
        AND s.shift_date BETWEEN %s AND %s
        ORDER BY
            s.shift_date,
            a.account_id,
            st.start_time
    """, (company_id, start_date, end_date))

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
            "staffing_requirements": staffing_requirements_map.get((r[3], r[10]), [])
        }
        for r in rows
    ]

def fetch_availability(cursor, company_id: int):
    cursor.execute("""
        SELECT
            av.employee_id,
            av.day_of_week,
            av.is_available,
            st.shift_name
        FROM availability av
        JOIN shift_templates st
            ON av.shift_template_id = st.shift_template_id
            AND av.company_id = st.company_id
        WHERE av.company_id = %s
        AND st.is_active = TRUE
    """, (company_id,))

    rows = cursor.fetchall()

    return [
        {
            "employee_id": r[0],
            "account": "default",
            "day_of_week": r[1],
            "is_available": r[2],
            "preferred_shift": r[3]
        }
        for r in rows
    ]


def fetch_leaves(cursor, company_id: int):
    cursor.execute("""
        SELECT employee_id, date
        FROM leaves
        WHERE company_id = %s
        AND LOWER(status) = 'approved'
    """, (company_id,))

    return cursor.fetchall()

def build_leaves_map(leaves):
    leaves_map = {}

    for emp_id, date in leaves:

        date_str = str(date)

        if emp_id not in leaves_map:
            leaves_map[emp_id] = set()

        leaves_map[emp_id].add(date_str)

    return leaves_map

def fetch_company_settings(cursor, company_id: int):
    cursor.execute("""
        SELECT
            max_working_days,
            max_shifts_per_day,
            max_shifts_per_week,
            allow_double_shifts,
            fairness_weight,
            gy_fatigue_penalty
        FROM company_settings
        WHERE company_id = %s
        LIMIT 1
    """, (company_id,))

    row = cursor.fetchone()

    if not row:
        raise Exception("Company settings not found")

    return {
        "max_working_days": row[0],
        "max_shifts_per_day": row[1],
        "max_shifts_per_week": row[2],
        "allow_double_shifts": row[3],
        "fairness_weight": row[4],
        "gy_fatigue_penalty": row[5] or 20
    }


def fetch_account_settings(cursor, company_id: int):
    cursor.execute("""
        SELECT
            account_name,
            priority_level,
            operator_policy,
            allow_partial_staffing
        FROM accounts
        WHERE company_id = %s
        AND is_active = TRUE
        ORDER BY account_id ASC
    """, (company_id,))

    rows = cursor.fetchall()

    account_settings = {}

    for row in rows:
        account_name = row[0]

        account_settings[account_name] = {
            "priority_level": row[1],
            "require_host": True,
            "require_operator": True,
            "operator_policy": row[2] or "optional",
            "allow_partial_staffing": row[3]
        }

    return account_settings


def fetch_history_scores(cursor, company_id: int):
    try:
        cursor.execute("""
            SELECT
                COALESCE(cr.requested_by, gs.employee_id) AS employee_id,
                a.account_name,
                st.shift_name,
                TRIM(TO_CHAR(s.shift_date, 'Day')) AS day_name,
                r.role_key,

                COUNT(cr.coverage_request_id) FILTER (
                    WHERE cr.coverage_request_id IS NOT NULL
                ) AS cover_requests,

                COUNT(cr.coverage_request_id) FILTER (
                    WHERE cr.request_type = 'emergency'
                ) AS emergency_requests,

                COUNT(sa.shift_application_id) FILTER (
                    WHERE sa.status = 'approved'
                ) AS applications,

                COUNT(gs.schedule_id) FILTER (
                    WHERE cr.coverage_request_id IS NULL
                ) AS successful_assignments

            FROM generated_schedule gs

            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id

            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id

            JOIN roles r
                ON gs.role_id = r.role_id
                AND gs.company_id = r.company_id

            LEFT JOIN coverage_requests cr
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id

            LEFT JOIN shift_applications sa
                ON sa.coverage_request_id = cr.coverage_request_id
                AND sa.company_id = cr.company_id
                AND sa.applicant_id = gs.employee_id

            WHERE gs.company_id = %s
            AND gs.is_archived = TRUE

            GROUP BY
                COALESCE(cr.requested_by, gs.employee_id),
                a.account_name,
                st.shift_name,
                day_name,
                r.role_key
        """, (company_id,))

        rows = cursor.fetchall()

    except Exception as e:
        print("FETCH HISTORY SCORES SKIPPED:", e)
        return {}

    history = {}

    for r in rows:
        if not r[0] or not r[1] or not r[2] or not r[3] or not r[4]:
            continue

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
def generate_weekly_schedule(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        ensure_next_week_shifts(cursor, company_id)
        conn.commit()

        employees = fetch_employees(cursor, company_id)
        settings = fetch_company_settings(cursor, company_id)
        shifts = fetch_shifts(
            cursor,
            company_id,
            settings["gy_fatigue_penalty"]
        )

        availability = fetch_availability(cursor, company_id)

        leaves = fetch_leaves(cursor, company_id)
        leaves_map = build_leaves_map(leaves)

        absences_map = {}
        account_settings = fetch_account_settings(cursor, company_id)

        history_scores = fetch_history_scores(cursor, company_id)

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

        employee_lookup = {
            e["employee_id"]: e["full_name"]
            for e in employees
        }

        for a in result["assignments"]:
            emp_id = a["employee_id"]
            a["employee_name"] = employee_lookup.get(
                emp_id,
                f"Employee {emp_id}"
            )

        active_roles = fetch_active_staffing_roles(cursor, company_id)

        grouped = group_schedule(
            result["assignments"],
            active_roles
        )

        shift_templates = fetch_shift_templates(cursor, company_id)

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
                        grouped[account_name][day][shift_name] = build_empty_roles(
                            active_roles
                        )

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": grouped,
            "unfilled_slots": result["unfilled_slots"]
        }

    finally:
        cursor.close()
        conn.close()

def get_generated_schedule(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                g.schedule_id,
                g.shift_id,
                s.shift_date,
                a.account_name,
                st.shift_name,
                e.employee_id,
                e.full_name,
                r.role_key,
                g.slot_index
            FROM generated_schedule g

            JOIN shifts s
                ON g.shift_id = s.shift_id
                AND g.company_id = s.company_id

            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id

            JOIN roles r
                ON g.role_id = r.role_id
                AND g.company_id = r.company_id

            LEFT JOIN employees e
                ON g.employee_id = e.employee_id
                AND g.company_id = e.company_id

            WHERE g.company_id = %s
            AND g.is_archived = FALSE

            ORDER BY
                s.shift_date,
                a.account_id,
                st.start_time,
                r.role_key,
                g.slot_index
        """, (company_id,))

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

        active_roles = fetch_active_staffing_roles(cursor, company_id)

        grouped = group_schedule(
            assignments,
            active_roles
        )

        cursor.execute("""
            SELECT account_name
            FROM accounts
            WHERE company_id = %s
            AND is_active = TRUE
            ORDER BY account_id ASC
        """, (company_id,))

        account_rows = cursor.fetchall()

        shift_templates = fetch_shift_templates(cursor, company_id)

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
                        grouped[account_name][day][shift_name] = build_empty_roles(
                            active_roles
                        )

        return {
            "status": "success",
            "assignments": assignments,
            "grouped_schedule": grouped
        }

    finally:
        cursor.close()
        conn.close()

def ensure_next_week_shifts(cursor, company_id: int):
    today = datetime.today()
    days_ahead = 7 - today.weekday()
    next_monday = today + timedelta(days=days_ahead)

    cursor.execute("""
        SELECT account_id
        FROM accounts
        WHERE company_id = %s
        AND is_active = TRUE
        ORDER BY account_id ASC
    """, (company_id,))

    accounts = cursor.fetchall()

    cursor.execute("""
        SELECT shift_template_id
        FROM shift_templates
        WHERE company_id = %s
        AND is_active = TRUE
        ORDER BY start_time
    """, (company_id,))

    templates = cursor.fetchall()

    for day_offset in range(7):
        new_date = (next_monday + timedelta(days=day_offset)).date()

        for account in accounts:
            account_id = account[0]

            for template in templates:
                template_id = template[0]

                cursor.execute("""
                    INSERT INTO shifts (
                        shift_date,
                        account_id,
                        shift_template_id,
                        company_id
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (
                        shift_date,
                        account_id,
                        shift_template_id,
                        company_id
                    )
                    DO NOTHING
                """, (
                    new_date,
                    account_id,
                    template_id,
                    company_id
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
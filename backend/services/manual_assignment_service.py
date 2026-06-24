#---------------------------------------------
# backend/services/manual_assignment_service.py

import json
from datetime import datetime, timedelta

from services.notification_service import create_notification


def normalize_warning_conditions(value):
    if not value:
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    return []


def format_schedule_label(target: dict) -> str:
    return (
        f"{target['account_name']} / {target['shift_name']} "
        f"on {target['shift_date']} "
        f"({target['start_time']} - {target['end_time']})"
    )


def get_manual_assignment_target(cursor, company_id: int, schedule_id: int):
    cursor.execute("""
        SELECT
            gs.schedule_id,
            gs.employee_id,
            gs.shift_id,
            gs.role_id,
            gs.slot_index,

            s.shift_date,
            s.account_id,

            a.account_name,

            st.shift_template_id,
            st.shift_name,
            st.start_time,
            st.end_time,
            st.color_index,

            r.role_key,
            r.role_name,
            r.department_id,

            d.department_name
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
            AND s.account_id = st.account_id

        JOIN roles r
            ON gs.role_id = r.role_id
            AND gs.company_id = r.company_id

        JOIN departments d
            ON r.department_id = d.department_id
            AND r.company_id = d.company_id

        WHERE gs.schedule_id = %s
        AND gs.company_id = %s
        AND gs.is_archived = FALSE
        LIMIT 1
    """, (
        schedule_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        return None

    return {
        "schedule_id": row[0],
        "previous_employee_id": row[1],
        "shift_id": row[2],
        "role_id": row[3],
        "slot_index": row[4],

        "shift_date": row[5],
        "account_id": row[6],

        "account_name": row[7],

        "shift_template_id": row[8],
        "shift_name": row[9],
        "start_time": row[10],
        "end_time": row[11],
        "color_index": row[12],

        "role_key": row[13],
        "role_name": row[14],
        "department_id": row[15],

        "department_name": row[16],
        "company_id": company_id,
    }


def get_active_employee(cursor, company_id: int, employee_id: int):
    cursor.execute("""
        SELECT
            employee_id,
            full_name,
            email,
            company_id
        FROM employees
        WHERE employee_id = %s
        AND company_id = %s
        AND employment_status = 'Active'
        LIMIT 1
    """, (
        employee_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        return None

    return {
        "employee_id": row[0],
        "full_name": row[1],
        "email": row[2],
        "company_id": row[3],
    }


def employee_has_required_role(cursor, company_id: int, employee_id: int, role_id: int):
    cursor.execute("""
        SELECT 1
        FROM employee_roles er

        JOIN roles r
            ON er.role_id = r.role_id
            AND er.company_id = r.company_id

        JOIN departments d
            ON r.department_id = d.department_id
            AND r.company_id = d.company_id

        WHERE er.employee_id = %s
        AND er.company_id = %s
        AND er.role_id = %s
        AND er.is_active = TRUE
        AND r.is_active = TRUE
        AND d.is_active = TRUE
        LIMIT 1
    """, (
        employee_id,
        company_id,
        role_id
    ))

    return cursor.fetchone() is not None


def employee_has_account_permission(
    cursor,
    company_id: int,
    employee_id: int,
    account_id: int,
    role_id: int
):
    cursor.execute("""
        SELECT 1
        FROM account_preferences ap

        JOIN accounts a
            ON ap.account_id = a.account_id
            AND ap.company_id = a.company_id

        JOIN roles r
            ON ap.role_id = r.role_id
            AND ap.company_id = r.company_id

        JOIN departments d
            ON ap.department_id = d.department_id
            AND ap.company_id = d.company_id

        WHERE ap.employee_id = %s
        AND ap.company_id = %s
        AND ap.account_id = %s
        AND ap.role_id = %s
        AND ap.is_active = TRUE
        AND a.is_active = TRUE
        AND r.is_active = TRUE
        AND d.is_active = TRUE
        LIMIT 1
    """, (
        employee_id,
        company_id,
        account_id,
        role_id
    ))

    return cursor.fetchone() is not None


def approved_leave_exists(cursor, company_id: int, employee_id: int, shift_date):
    cursor.execute("""
        SELECT 1
        FROM leaves
        WHERE company_id = %s
        AND employee_id = %s
        AND date = %s
        AND status = 'approved'
        LIMIT 1
    """, (
        company_id,
        employee_id,
        shift_date
    ))

    return cursor.fetchone() is not None


def approved_absence_exists(cursor, company_id: int, employee_id: int, shift_date):
    cursor.execute("""
        SELECT 1
        FROM absences
        WHERE company_id = %s
        AND employee_id = %s
        AND date = %s
        AND status = 'approved'
        LIMIT 1
    """, (
        company_id,
        employee_id,
        shift_date
    ))

    return cursor.fetchone() is not None


def schedule_time_conflict_error(
    cursor,
    employee_id: int,
    target_schedule_id: int,
    company_id: int
):
    cursor.execute("""
        WITH target_shift AS (
            SELECT
                gs.schedule_id,
                s.shift_date,
                st.start_time,
                st.end_time,
                (s.shift_date + st.start_time) AS target_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS target_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            WHERE gs.schedule_id = %s
            AND gs.company_id = %s
            AND gs.is_archived = FALSE
            LIMIT 1
        ),

        existing_assignments AS (
            SELECT
                gs.schedule_id,
                a.account_name,
                st.shift_name,
                s.shift_date,
                st.start_time,
                st.end_time,
                (s.shift_date + st.start_time) AS existing_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS existing_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id
            CROSS JOIN target_shift target
            WHERE gs.company_id = %s
            AND gs.employee_id = %s
            AND gs.is_archived = FALSE
            AND gs.schedule_id <> %s
            AND s.shift_date BETWEEN
                target.shift_date - INTERVAL '1 day'
                AND target.shift_date + INTERVAL '1 day'
        )

        SELECT
            ea.schedule_id,
            ea.account_name,
            ea.shift_name,
            ea.shift_date,
            ea.start_time,
            ea.end_time
        FROM existing_assignments ea
        CROSS JOIN target_shift target
        WHERE ea.existing_start_at < target.target_end_at
        AND ea.existing_end_at > target.target_start_at
        LIMIT 1
    """, (
        target_schedule_id,
        company_id,
        company_id,
        employee_id,
        target_schedule_id,
    ))

    conflict = cursor.fetchone()

    if not conflict:
        return None

    return (
        "Employee already has an overlapping shift: "
        f"{conflict[1]} / {conflict[2]} on {conflict[3]} "
        f"({conflict[4]} - {conflict[5]})."
    )


def schedule_rest_period_warning(
    cursor,
    employee_id: int,
    target_schedule_id: int,
    company_id: int
):
    cursor.execute("""
        WITH settings AS (
            SELECT
                COALESCE(min_rest_period_hours, 0) AS min_rest_hours
            FROM company_settings
            WHERE company_id = %s
            LIMIT 1
        ),

        target_shift AS (
            SELECT
                gs.schedule_id,
                s.shift_date,
                st.start_time,
                st.end_time,
                (s.shift_date + st.start_time) AS target_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS target_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            WHERE gs.schedule_id = %s
            AND gs.company_id = %s
            AND gs.is_archived = FALSE
            LIMIT 1
        ),

        existing_assignments AS (
            SELECT
                gs.schedule_id,
                a.account_name,
                st.shift_name,
                s.shift_date,
                st.start_time,
                st.end_time,
                (s.shift_date + st.start_time) AS existing_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS existing_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id
            CROSS JOIN target_shift target
            WHERE gs.company_id = %s
            AND gs.employee_id = %s
            AND gs.is_archived = FALSE
            AND gs.schedule_id <> %s
            AND s.shift_date BETWEEN
                target.shift_date - INTERVAL '1 day'
                AND target.shift_date + INTERVAL '1 day'
        ),

        rest_checks AS (
            SELECT
                ea.account_name,
                ea.shift_name,
                ea.shift_date,
                ea.start_time,
                ea.end_time,
                settings.min_rest_hours,

                CASE
                    WHEN ea.existing_end_at <= target.target_start_at
                    THEN target.target_start_at - ea.existing_end_at

                    WHEN target.target_end_at <= ea.existing_start_at
                    THEN ea.existing_start_at - target.target_end_at

                    ELSE INTERVAL '0 hours'
                END AS rest_gap
            FROM existing_assignments ea
            CROSS JOIN target_shift target
            CROSS JOIN settings
            WHERE settings.min_rest_hours > 0
            AND NOT (
                ea.existing_start_at < target.target_end_at
                AND ea.existing_end_at > target.target_start_at
            )
        )

        SELECT
            account_name,
            shift_name,
            shift_date,
            start_time,
            end_time,
            min_rest_hours,
            ROUND(EXTRACT(EPOCH FROM rest_gap) / 3600.0, 2) AS rest_hours
        FROM rest_checks
        WHERE rest_gap < (min_rest_hours * INTERVAL '1 hour')
        ORDER BY rest_gap ASC
        LIMIT 1
    """, (
        company_id,
        target_schedule_id,
        company_id,
        company_id,
        employee_id,
        target_schedule_id
    ))

    row = cursor.fetchone()

    if not row:
        return None

    return (
        f"This assignment gives the employee only {row[6]} hours of rest. "
        f"The required minimum is {row[5]} hours. "
        f"Nearby shift: {row[0]} / {row[1]} on {row[2]} "
        f"({row[3]} - {row[4]})."
    )


def total_daily_hours_error(
    cursor,
    company_id: int,
    employee_id: int,
    target_schedule_id: int
):
    cursor.execute("""
        WITH target_shift AS (
            SELECT
                gs.schedule_id,
                s.shift_date,
                (s.shift_date + st.start_time) AS target_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS target_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            WHERE gs.schedule_id = %s
            AND gs.company_id = %s
            AND gs.is_archived = FALSE
            LIMIT 1
        ),

        existing_assignments AS (
            SELECT
                (s.shift_date + st.start_time) AS existing_start_at,
                (
                    s.shift_date
                    + st.end_time
                    + CASE
                        WHEN st.end_time <= st.start_time
                        THEN INTERVAL '1 day'
                        ELSE INTERVAL '0 day'
                    END
                ) AS existing_end_at
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
                AND s.account_id = st.account_id
            CROSS JOIN target_shift target
            WHERE gs.company_id = %s
            AND gs.employee_id = %s
            AND gs.is_archived = FALSE
            AND gs.schedule_id <> %s
            AND s.shift_date = target.shift_date
        )

        SELECT
            ROUND(
                EXTRACT(EPOCH FROM (
                    target.target_end_at - target.target_start_at
                )) / 3600.0,
                2
            ) AS target_hours,

            COALESCE(
                ROUND(
                    SUM(
                        EXTRACT(EPOCH FROM (
                            existing_end_at - existing_start_at
                        )) / 3600.0
                    ),
                    2
                ),
                0
            ) AS existing_hours
        FROM target_shift target
        LEFT JOIN existing_assignments ea
            ON TRUE
        GROUP BY
            target.target_start_at,
            target.target_end_at
    """, (
        target_schedule_id,
        company_id,
        company_id,
        employee_id,
        target_schedule_id
    ))

    row = cursor.fetchone()

    if not row:
        return None

    target_hours = float(row[0] or 0)
    existing_hours = float(row[1] or 0)
    total_hours = existing_hours + target_hours

    if total_hours >= 24:
        return (
            f"Employee would reach {total_hours:.2f} total shift hours "
            "on the same day. Daily total must stay below 24 hours."
        )

    return None


def get_company_settings(cursor, company_id: int):
    cursor.execute("""
        SELECT
            max_working_days,
            max_shifts_per_day,
            max_shifts_per_week,
            allow_double_shifts,
            min_rest_period_hours
        FROM company_settings
        WHERE company_id = %s
        LIMIT 1
    """, (company_id,))

    row = cursor.fetchone()

    if not row:
        return {
            "max_working_days": 7,
            "max_shifts_per_day": 2,
            "max_shifts_per_week": 7,
            "allow_double_shifts": False,
            "min_rest_period_hours": 8,
        }

    return {
        "max_working_days": row[0],
        "max_shifts_per_day": row[1],
        "max_shifts_per_week": row[2],
        "allow_double_shifts": row[3],
        "min_rest_period_hours": row[4],
    }


def same_day_assignment_count(cursor, company_id: int, employee_id: int, target: dict):
    cursor.execute("""
        SELECT COUNT(*)
        FROM generated_schedule gs
        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id
        WHERE gs.company_id = %s
        AND gs.employee_id = %s
        AND gs.is_archived = FALSE
        AND gs.schedule_id <> %s
        AND s.shift_date = %s
    """, (
        company_id,
        employee_id,
        target["schedule_id"],
        target["shift_date"]
    ))

    return cursor.fetchone()[0] or 0


def weekly_assignment_count(cursor, company_id: int, employee_id: int, target: dict):
    shift_date = target["shift_date"]
    week_start = shift_date - timedelta(days=shift_date.weekday())
    week_end = week_start + timedelta(days=6)

    cursor.execute("""
        SELECT COUNT(*)
        FROM generated_schedule gs
        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id
        WHERE gs.company_id = %s
        AND gs.employee_id = %s
        AND gs.is_archived = FALSE
        AND gs.schedule_id <> %s
        AND s.shift_date BETWEEN %s AND %s
    """, (
        company_id,
        employee_id,
        target["schedule_id"],
        week_start,
        week_end
    ))

    return cursor.fetchone()[0] or 0


def max_consecutive_working_days_after_assignment(
    cursor,
    company_id: int,
    employee_id: int,
    target: dict
):
    cursor.execute("""
        SELECT DISTINCT s.shift_date
        FROM generated_schedule gs
        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id
        WHERE gs.company_id = %s
        AND gs.employee_id = %s
        AND gs.is_archived = FALSE
        AND gs.schedule_id <> %s
        ORDER BY s.shift_date
    """, (
        company_id,
        employee_id,
        target["schedule_id"]
    ))

    days = {
        row[0]
        for row in cursor.fetchall()
    }

    days.add(target["shift_date"])

    sorted_days = sorted(days)

    if not sorted_days:
        return 0

    longest = 1
    current = 1

    for i in range(1, len(sorted_days)):
        if (sorted_days[i] - sorted_days[i - 1]).days == 1:
            current += 1
        else:
            current = 1

        longest = max(longest, current)

    return longest


def availability_warning(cursor, company_id: int, employee_id: int, target: dict):
    day_name = target["shift_date"].strftime("%A")

    cursor.execute("""
        SELECT is_available
        FROM availability
        WHERE company_id = %s
        AND employee_id = %s
        AND LOWER(TRIM(day_of_week)) = LOWER(TRIM(%s))
        AND shift_template_id = %s
        LIMIT 1
    """, (
        company_id,
        employee_id,
        day_name,
        target["shift_template_id"]
    ))

    row = cursor.fetchone()

    if not row:
        return {
            "type": "UNAVAILABLE",
            "message": (
                f"Employee has no availability record for {day_name} / "
                f"{target['shift_name']}."
            )
        }

    if not bool(row[0]):
        return {
            "type": "UNAVAILABLE",
            "message": (
                f"Employee is marked unavailable for {day_name} / "
                f"{target['shift_name']}."
            )
        }

    return None


def detect_policy_warnings(
    cursor,
    company_id: int,
    employee_id: int,
    target: dict
):
    warnings = []

    settings = get_company_settings(cursor, company_id)

    rest_warning = schedule_rest_period_warning(
        cursor,
        employee_id,
        target["schedule_id"],
        company_id
    )

    if rest_warning:
        warnings.append({
            "type": "REST_PERIOD",
            "message": rest_warning
        })

    same_day_count = same_day_assignment_count(
        cursor,
        company_id,
        employee_id,
        target
    )

    allow_double_shifts = bool(settings.get("allow_double_shifts"))

    if not allow_double_shifts and same_day_count >= 1:
        warnings.append({
            "type": "DOUBLE_SHIFT_DISABLED",
            "message": (
                "Double shifts are disabled, but the employee already has "
                "another assignment on this date."
            )
        })

    try:
        max_shifts_per_day = int(settings.get("max_shifts_per_day") or 1)
    except (TypeError, ValueError):
        max_shifts_per_day = 1

    if allow_double_shifts:
        allowed_day_count = max(2, max_shifts_per_day)

        if same_day_count + 1 > allowed_day_count:
            warnings.append({
                "type": "MAX_SHIFTS_PER_DAY",
                "message": (
                    f"Employee would have {same_day_count + 1} shifts on this date. "
                    f"The configured daily maximum is {allowed_day_count}."
                )
            })

    try:
        max_shifts_per_week = int(settings.get("max_shifts_per_week") or 0)
    except (TypeError, ValueError):
        max_shifts_per_week = 0

    if max_shifts_per_week > 0:
        week_count = weekly_assignment_count(
            cursor,
            company_id,
            employee_id,
            target
        )

        if week_count + 1 > max_shifts_per_week:
            warnings.append({
                "type": "MAX_SHIFTS_PER_WEEK",
                "message": (
                    f"Employee would have {week_count + 1} shifts this week. "
                    f"The configured weekly maximum is {max_shifts_per_week}."
                )
            })

    try:
        max_working_days = int(settings.get("max_working_days") or 0)
    except (TypeError, ValueError):
        max_working_days = 0

    if max_working_days > 0:
        projected_consecutive_days = max_consecutive_working_days_after_assignment(
            cursor,
            company_id,
            employee_id,
            target
        )

        if projected_consecutive_days > max_working_days:
            warnings.append({
                "type": "MAX_CONSECUTIVE_WORKING_DAYS",
                "message": (
                    f"Employee would reach {projected_consecutive_days} "
                    "consecutive working days. "
                    f"The configured maximum is {max_working_days}."
                )
            })

    unavailable_warning = availability_warning(
        cursor,
        company_id,
        employee_id,
        target
    )

    if unavailable_warning:
        warnings.append(unavailable_warning)

    return warnings


def validate_manual_assignment_override(
    cursor,
    company_id: int,
    schedule_id: int,
    employee_id: int
):
    target = get_manual_assignment_target(
        cursor,
        company_id,
        schedule_id
    )

    if not target:
        return {
            "target": None,
            "employee": None,
            "hard_blocks": ["Active schedule row not found"],
            "warnings": []
        }

    employee = get_active_employee(
        cursor,
        company_id,
        employee_id
    )

    if not employee:
        return {
            "target": target,
            "employee": None,
            "hard_blocks": ["Employee not found or inactive"],
            "warnings": []
        }

    hard_blocks = []

    if not employee_has_required_role(
        cursor,
        company_id,
        employee_id,
        target["role_id"]
    ):
        hard_blocks.append(
            f"Employee does not have the required role: {target['role_name']}."
        )

    if not employee_has_account_permission(
        cursor,
        company_id,
        employee_id,
        target["account_id"],
        target["role_id"]
    ):
        hard_blocks.append(
            "Employee does not have account permission/preference for "
            f"{target['account_name']} / {target['role_name']}."
        )

    if approved_leave_exists(
        cursor,
        company_id,
        employee_id,
        target["shift_date"]
    ):
        hard_blocks.append(
            "Employee has approved leave on this date."
        )

    if approved_absence_exists(
        cursor,
        company_id,
        employee_id,
        target["shift_date"]
    ):
        hard_blocks.append(
            "Employee has approved absence on this date."
        )

    conflict_error = schedule_time_conflict_error(
        cursor,
        employee_id,
        schedule_id,
        company_id
    )

    if conflict_error:
        hard_blocks.append(conflict_error)

    daily_hours_error = total_daily_hours_error(
        cursor,
        company_id,
        employee_id,
        schedule_id
    )

    if daily_hours_error:
        hard_blocks.append(daily_hours_error)

    warnings = []

    if not hard_blocks:
        warnings = detect_policy_warnings(
            cursor,
            company_id,
            employee_id,
            target
        )

    return {
        "target": target,
        "employee": employee,
        "hard_blocks": hard_blocks,
        "warnings": warnings
    }


def archive_cover_history_for_schedule(cursor, company_id: int, schedule_id: int):
    cursor.execute("""
        INSERT INTO coverage_request_history (
            coverage_request_id,
            schedule_id,
            company_id,

            shift_id,
            shift_date,

            account_id,
            account_name,

            shift_template_id,
            shift_name,

            role_id,
            role_key,

            requested_by,
            accepted_by,

            reason,
            status,
            request_type,

            created_at,
            approved_at,
            updated_at,

            archive_reason,
            archived_at
        )
        SELECT
            cr.coverage_request_id,
            cr.schedule_id,
            cr.company_id,

            gs.shift_id,
            s.shift_date,

            a.account_id,
            a.account_name,

            st.shift_template_id,
            st.shift_name,

            gs.role_id,
            r.role_key,

            cr.requested_by,
            cr.accepted_by,

            cr.reason,
            cr.status,
            cr.request_type,

            cr.created_at,
            cr.approved_at,
            cr.updated_at,

            'manual_override',
            NOW()
        FROM coverage_requests cr

        JOIN generated_schedule gs
            ON cr.schedule_id = gs.schedule_id
            AND cr.company_id = gs.company_id

        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id

        JOIN accounts a
            ON s.account_id = a.account_id
            AND s.company_id = a.company_id

        JOIN shift_templates st
            ON s.shift_template_id = st.shift_template_id
            AND s.company_id = st.company_id
            AND s.account_id = st.account_id

        JOIN roles r
            ON gs.role_id = r.role_id
            AND gs.company_id = r.company_id

        WHERE cr.company_id = %s
        AND cr.schedule_id = %s

        ON CONFLICT (company_id, coverage_request_id)
        DO UPDATE SET
            schedule_id = EXCLUDED.schedule_id,
            shift_id = EXCLUDED.shift_id,
            shift_date = EXCLUDED.shift_date,
            account_id = EXCLUDED.account_id,
            account_name = EXCLUDED.account_name,
            shift_template_id = EXCLUDED.shift_template_id,
            shift_name = EXCLUDED.shift_name,
            role_id = EXCLUDED.role_id,
            role_key = EXCLUDED.role_key,
            requested_by = EXCLUDED.requested_by,
            accepted_by = EXCLUDED.accepted_by,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status,
            request_type = EXCLUDED.request_type,
            created_at = EXCLUDED.created_at,
            approved_at = EXCLUDED.approved_at,
            updated_at = EXCLUDED.updated_at,
            archive_reason = EXCLUDED.archive_reason,
            archived_at = NOW()
    """, (
        company_id,
        schedule_id
    ))

    cursor.execute("""
        INSERT INTO shift_application_history (
            shift_application_id,
            coverage_request_id,
            schedule_id,
            company_id,

            shift_id,
            shift_date,

            account_id,
            account_name,

            shift_template_id,
            shift_name,

            role_id,
            role_key,

            requested_by,
            applicant_id,

            reason,
            status,

            applied_at,
            updated_at,

            archive_reason,
            archived_at
        )
        SELECT
            sa.shift_application_id,
            sa.coverage_request_id,
            cr.schedule_id,
            sa.company_id,

            gs.shift_id,
            s.shift_date,

            a.account_id,
            a.account_name,

            st.shift_template_id,
            st.shift_name,

            gs.role_id,
            r.role_key,

            cr.requested_by,
            sa.applicant_id,

            sa.reason,
            sa.status,

            sa.applied_at,
            sa.updated_at,

            'manual_override',
            NOW()
        FROM shift_applications sa

        JOIN coverage_requests cr
            ON sa.coverage_request_id = cr.coverage_request_id
            AND sa.company_id = cr.company_id

        JOIN generated_schedule gs
            ON cr.schedule_id = gs.schedule_id
            AND cr.company_id = gs.company_id

        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id

        JOIN accounts a
            ON s.account_id = a.account_id
            AND s.company_id = a.company_id

        JOIN shift_templates st
            ON s.shift_template_id = st.shift_template_id
            AND s.company_id = st.company_id
            AND s.account_id = st.account_id

        JOIN roles r
            ON gs.role_id = r.role_id
            AND gs.company_id = r.company_id

        WHERE sa.company_id = %s
        AND cr.schedule_id = %s

        ON CONFLICT (company_id, shift_application_id)
        DO UPDATE SET
            coverage_request_id = EXCLUDED.coverage_request_id,
            schedule_id = EXCLUDED.schedule_id,
            shift_id = EXCLUDED.shift_id,
            shift_date = EXCLUDED.shift_date,
            account_id = EXCLUDED.account_id,
            account_name = EXCLUDED.account_name,
            shift_template_id = EXCLUDED.shift_template_id,
            shift_name = EXCLUDED.shift_name,
            role_id = EXCLUDED.role_id,
            role_key = EXCLUDED.role_key,
            requested_by = EXCLUDED.requested_by,
            applicant_id = EXCLUDED.applicant_id,
            reason = EXCLUDED.reason,
            status = EXCLUDED.status,
            applied_at = EXCLUDED.applied_at,
            updated_at = EXCLUDED.updated_at,
            archive_reason = EXCLUDED.archive_reason,
            archived_at = NOW()
    """, (
        company_id,
        schedule_id
    ))


def void_cover_data_for_schedule(cursor, company_id: int, schedule_id: int):
    cursor.execute("""
        SELECT coverage_request_id
        FROM coverage_requests
        WHERE company_id = %s
        AND schedule_id = %s
        AND is_archived = FALSE
    """, (
        company_id,
        schedule_id
    ))

    coverage_request_ids = [
        row[0]
        for row in cursor.fetchall()
    ]

    if not coverage_request_ids:
        return

    archive_cover_history_for_schedule(
        cursor,
        company_id,
        schedule_id
    )

    cursor.execute("""
        DELETE FROM emergency_cover_targets
        WHERE company_id = %s
        AND coverage_request_id = ANY(%s::int[])
    """, (
        company_id,
        coverage_request_ids
    ))

    cursor.execute("""
        DELETE FROM shift_applications
        WHERE company_id = %s
        AND coverage_request_id = ANY(%s::int[])
    """, (
        company_id,
        coverage_request_ids
    ))

    cursor.execute("""
        DELETE FROM coverage_requests
        WHERE company_id = %s
        AND coverage_request_id = ANY(%s::int[])
    """, (
        company_id,
        coverage_request_ids
    ))


def cancel_pending_manual_assignment_requests_for_schedule(
    cursor,
    company_id: int,
    schedule_id: int,
    cancelled_by=None,
    keep_request_id=None
):
    params = [
        company_id,
        schedule_id
    ]

    keep_filter = ""

    if keep_request_id:
        keep_filter = "AND manual_assignment_request_id != %s"
        params.append(keep_request_id)

    cursor.execute(f"""
        SELECT
            manual_assignment_request_id,
            target_employee_id
        FROM manual_assignment_requests
        WHERE company_id = %s
        AND schedule_id = %s
        AND status = 'pending'
        {keep_filter}
    """, tuple(params))

    pending_requests = cursor.fetchall()

    if not pending_requests:
        return

    cursor.execute(f"""
        UPDATE manual_assignment_requests
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE company_id = %s
        AND schedule_id = %s
        AND status = 'pending'
        {keep_filter}
    """, tuple(params))

    for request_id, target_employee_id in pending_requests:
        create_notification(
            cursor,
            target_employee_id,
            "Assignment Request Cancelled",
            "A pending assignment request was cancelled because the schedule slot was updated.",
            "manual_assignment",
            company_id=company_id,
            sender_employee_id=cancelled_by,
            related_id=request_id
        )


def apply_schedule_assignment_update(
    cursor,
    company_id: int,
    schedule_id: int,
    employee_id,
    updated_by=None,
    keep_manual_assignment_request_id=None
):
    target = get_manual_assignment_target(
        cursor,
        company_id,
        schedule_id
    )

    if not target:
        raise ValueError("Active schedule row not found")

    old_employee_id = target["previous_employee_id"]

    cancel_pending_manual_assignment_requests_for_schedule(
        cursor,
        company_id,
        schedule_id,
        cancelled_by=updated_by,
        keep_request_id=keep_manual_assignment_request_id
    )

    void_cover_data_for_schedule(
        cursor,
        company_id,
        schedule_id
    )

    cursor.execute("""
        UPDATE generated_schedule
        SET employee_id = %s
        WHERE schedule_id = %s
        AND company_id = %s
        AND is_archived = FALSE
    """, (
        employee_id,
        schedule_id,
        company_id
    ))

    if employee_id:
        create_notification(
            cursor,
            employee_id,
            "Schedule Assignment Updated",
            f"You were assigned to {format_schedule_label(target)}.",
            "schedule",
            company_id=company_id,
            sender_employee_id=updated_by,
            related_id=schedule_id
        )

    if old_employee_id and old_employee_id != employee_id:
        create_notification(
            cursor,
            old_employee_id,
            "Schedule Assignment Updated",
            f"You were removed from {format_schedule_label(target)}.",
            "schedule",
            company_id=company_id,
            sender_employee_id=updated_by,
            related_id=schedule_id
        )

    return {
        "schedule_id": schedule_id,
        "employee_id": employee_id,
        "previous_employee_id": old_employee_id,
        "target": target
    }


def create_manual_assignment_request(
    cursor,
    company_id: int,
    schedule_id: int,
    requested_by_employee_id: int,
    target_employee_id: int,
    previous_employee_id,
    warning_conditions: list,
    admin_note: str | None = None
):
    cursor.execute("""
        SELECT
            manual_assignment_request_id,
            target_employee_id
        FROM manual_assignment_requests
        WHERE company_id = %s
        AND schedule_id = %s
        AND status = 'pending'
        ORDER BY requested_at DESC
        LIMIT 1
    """, (
        company_id,
        schedule_id
    ))

    existing = cursor.fetchone()

    if existing:
        existing_request_id = existing[0]
        existing_target_employee_id = existing[1]

        if int(existing_target_employee_id) == int(target_employee_id):
            return {
                "manual_assignment_request_id": existing_request_id,
                "already_exists": True
            }

        cursor.execute("""
            UPDATE manual_assignment_requests
            SET
                status = 'cancelled',
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE manual_assignment_request_id = %s
            AND company_id = %s
            AND status = 'pending'
        """, (
            existing_request_id,
            company_id
        ))

        create_notification(
            cursor,
            existing_target_employee_id,
            "Assignment Request Cancelled",
            "A pending assignment request was cancelled.",
            "manual_assignment",
            company_id=company_id,
            sender_employee_id=requested_by_employee_id,
            related_id=existing_request_id
        )

    cursor.execute("""
        INSERT INTO manual_assignment_requests (
            company_id,
            schedule_id,
            requested_by_employee_id,
            target_employee_id,
            previous_employee_id,
            status,
            warning_conditions,
            admin_note
        )
        VALUES (%s, %s, %s, %s, %s, 'pending', %s::jsonb, %s)
        RETURNING manual_assignment_request_id
    """, (
        company_id,
        schedule_id,
        requested_by_employee_id,
        target_employee_id,
        previous_employee_id,
        json.dumps(warning_conditions),
        admin_note
    ))

    request_id = cursor.fetchone()[0]

    target = get_manual_assignment_target(
        cursor,
        company_id,
        schedule_id
    )

    create_notification(
        cursor,
        target_employee_id,
        "New Assignment Request",
        f"An admin requested to assign you to {format_schedule_label(target)}.",
        "manual_assignment",
        company_id=company_id,
        sender_employee_id=requested_by_employee_id,
        related_id=request_id
    )

    return {
        "manual_assignment_request_id": request_id,
        "already_exists": False
    }


def apply_manual_assignment_request(
    cursor,
    request_id: int,
    company_id: int,
    employee_id: int,
    employee_response_note: str | None = None
):
    cursor.execute("""
        SELECT
            manual_assignment_request_id,
            company_id,
            schedule_id,
            requested_by_employee_id,
            target_employee_id,
            previous_employee_id,
            status
        FROM manual_assignment_requests
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
        LIMIT 1
    """, (
        request_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        raise ValueError("Assignment request not found")

    status = row[6]

    if status != "pending":
        raise ValueError("Assignment request is no longer pending")

    target_employee_id = row[4]

    if int(target_employee_id) != int(employee_id):
        raise ValueError("Only the target employee can accept this request")

    validation = validate_manual_assignment_override(
        cursor,
        company_id,
        row[2],
        target_employee_id
    )

    if validation["hard_blocks"]:
        cursor.execute("""
            UPDATE manual_assignment_requests
            SET
                status = 'failed',
                employee_response_note = %s,
                responded_at = NOW(),
                updated_at = NOW()
            WHERE manual_assignment_request_id = %s
            AND company_id = %s
        """, (
            "Request failed because assignment is no longer valid.",
            request_id,
            company_id
        ))

        raise ValueError("; ".join(validation["hard_blocks"]))

    applied = apply_schedule_assignment_update(
        cursor,
        company_id,
        row[2],
        target_employee_id,
        updated_by=target_employee_id,
        keep_manual_assignment_request_id=request_id
    )

    cursor.execute("""
        UPDATE manual_assignment_requests
        SET
            status = 'accepted',
            employee_response_note = %s,
            responded_at = NOW(),
            applied_at = NOW(),
            updated_at = NOW()
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
    """, (
        employee_response_note,
        request_id,
        company_id
    ))

    create_notification(
        cursor,
        row[3],
        "Assignment Request Accepted",
        "An employee accepted a manual assignment request.",
        "manual_assignment",
        company_id=company_id,
        sender_employee_id=target_employee_id,
        related_id=request_id
    )

    return applied


def reject_manual_assignment_request(
    cursor,
    request_id: int,
    company_id: int,
    employee_id: int,
    employee_response_note: str | None = None
):
    cursor.execute("""
        SELECT
            requested_by_employee_id,
            target_employee_id,
            status
        FROM manual_assignment_requests
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
        LIMIT 1
    """, (
        request_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        raise ValueError("Assignment request not found")

    if row[2] != "pending":
        raise ValueError("Assignment request is no longer pending")

    if int(row[1]) != int(employee_id):
        raise ValueError("Only the target employee can reject this request")

    cursor.execute("""
        UPDATE manual_assignment_requests
        SET
            status = 'rejected',
            employee_response_note = %s,
            responded_at = NOW(),
            updated_at = NOW()
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
    """, (
        employee_response_note,
        request_id,
        company_id
    ))

    create_notification(
        cursor,
        row[0],
        "Assignment Request Rejected",
        "An employee rejected a manual assignment request.",
        "manual_assignment",
        company_id=company_id,
        sender_employee_id=employee_id,
        related_id=request_id
    )


def cancel_manual_assignment_request(
    cursor,
    request_id: int,
    company_id: int,
    cancelled_by: int | None = None
):
    cursor.execute("""
        SELECT
            target_employee_id,
            status
        FROM manual_assignment_requests
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
        LIMIT 1
    """, (
        request_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        raise ValueError("Assignment request not found")

    if row[1] != "pending":
        raise ValueError("Only pending assignment requests can be cancelled")

    target_employee_id = row[0]

    cursor.execute("""
        UPDATE manual_assignment_requests
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE manual_assignment_request_id = %s
        AND company_id = %s
    """, (
        request_id,
        company_id
    ))

    create_notification(
        cursor,
        target_employee_id,
        "Assignment Request Cancelled",
        "A pending assignment request was cancelled.",
        "manual_assignment",
        company_id=company_id,
        sender_employee_id=cancelled_by,
        related_id=request_id
    )
#---------------------------------------------
# backend/services/notification_service.py

from datetime import date

def notifications_enabled(cursor, company_id: int | None = None):
    if company_id:
        cursor.execute("""
            SELECT enable_in_app_notifications
            FROM company_settings
            WHERE company_id = %s
            LIMIT 1
        """, (company_id,))
    else:
        cursor.execute("""
            SELECT enable_in_app_notifications
            FROM company_settings
            LIMIT 1
        """)

    row = cursor.fetchone()

    if not row:
        return True

    return row[0]


def get_employee_company_id(cursor, employee_id: int):
    cursor.execute("""
        SELECT company_id
        FROM employees
        WHERE employee_id = %s
        LIMIT 1
    """, (employee_id,))

    row = cursor.fetchone()

    if not row:
        return None

    return row[0]


def create_notification(
    cursor,
    employee_id: int,
    title: str,
    message: str,
    notification_type: str = "general",
    company_id: int | None = None,
    sender_employee_id: int | None = None,
    related_id: int | None = None
):
    if company_id is None:
        company_id = get_employee_company_id(cursor, employee_id)

    if company_id is None:
        return

    if not notifications_enabled(cursor, company_id):
        return

    cursor.execute("""
        INSERT INTO notifications (
            recipient_employee_id,
            sender_employee_id,
            type,
            title,
            message,
            related_id,
            company_id
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        employee_id,
        sender_employee_id,
        notification_type,
        title,
        message,
        related_id,
        company_id
    ))


def notify_absence_limit_if_exceeded(
    cursor,
    company_id: int,
    employee_id: int,
    absence_date,
    sender_employee_id: int | None = None,
    related_id: int | None = None
):
    if isinstance(absence_date, str):
        absence_date = date.fromisoformat(absence_date)

    cursor.execute("""
        SELECT COALESCE(absence_tolerance, 0)
        FROM company_settings
        WHERE company_id = %s
        LIMIT 1
    """, (company_id,))

    setting_row = cursor.fetchone()

    if not setting_row:
        return

    max_absences_per_month = int(setting_row[0] or 0)

    if max_absences_per_month <= 0:
        return

    month_start = absence_date.replace(day=1)

    if month_start.month == 12:
        next_month_start = month_start.replace(
            year=month_start.year + 1,
            month=1,
            day=1
        )
    else:
        next_month_start = month_start.replace(
            month=month_start.month + 1,
            day=1
        )

    cursor.execute("""
        SELECT
            e.full_name,
            COUNT(ab.absence_id) AS absence_count
        FROM employees e
        LEFT JOIN absences ab
            ON ab.employee_id = e.employee_id
            AND ab.company_id = e.company_id
            AND ab.status = 'approved'
            AND ab.date >= %s
            AND ab.date < %s
        WHERE e.employee_id = %s
        AND e.company_id = %s
        GROUP BY e.full_name
        LIMIT 1
    """, (
        month_start,
        next_month_start,
        employee_id,
        company_id
    ))

    employee_row = cursor.fetchone()

    if not employee_row:
        return

    employee_name = employee_row[0]
    absence_count = int(employee_row[1] or 0)

    if absence_count <= max_absences_per_month:
        return

    cursor.execute("""
        SELECT 1
        FROM notifications
        WHERE company_id = %s
        AND type = 'absence'
        AND title = 'Absence Limit Exceeded'
        AND related_id = %s
        AND created_at >= %s
        AND created_at < %s
        LIMIT 1
    """, (
        company_id,
        employee_id,
        month_start,
        next_month_start
    ))

    already_notified = cursor.fetchone()

    if already_notified:
        return

    cursor.execute("""
        SELECT DISTINCT e.employee_id
        FROM employees e
        JOIN employee_roles er
            ON e.employee_id = er.employee_id
            AND e.company_id = er.company_id
        JOIN roles r
            ON er.role_id = r.role_id
            AND er.company_id = r.company_id
        WHERE e.company_id = %s
        AND e.employment_status = 'Active'
        AND er.is_active = TRUE
        AND r.is_active = TRUE
        AND r.is_admin = TRUE
        AND e.employee_id != %s
    """, (
        company_id,
        employee_id
    ))

    admin_rows = cursor.fetchall()

    for admin_row in admin_rows:
        create_notification(
            cursor,
            admin_row[0],
            "Absence Limit Exceeded",
            (
                f"{employee_name} has {absence_count} approved absences "
                f"this month. Company limit: {max_absences_per_month}."
            ),
            "absence",
            company_id=company_id,
            sender_employee_id=sender_employee_id,
            related_id=employee_id
        )
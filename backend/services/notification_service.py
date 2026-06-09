#---------------------------------------------
# backend/services/notification_service.py

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
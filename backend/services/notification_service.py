# backend/services/notification_service.py

def notifications_enabled(cursor):
    cursor.execute("""
        SELECT enable_in_app_notifications
        FROM company_settings
        LIMIT 1
    """)

    row = cursor.fetchone()

    if not row:
        return True

    return row[0]


def create_notification(
    cursor,
    employee_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
    if not notifications_enabled(cursor):
        return

    cursor.execute("""
        INSERT INTO notifications (
            recipient_employee_id,
            title,
            message,
            type
        )
        VALUES (%s, %s, %s, %s)
    """, (
        employee_id,
        title,
        message,
        notification_type
    ))
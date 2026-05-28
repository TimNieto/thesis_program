# backend/services/notification_service.py

def create_notification(
    cursor,
    employee_id: int,
    title: str,
    message: str,
    notification_type: str = "general"
):
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
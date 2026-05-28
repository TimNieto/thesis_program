# backend/routes/notifications.py

from fastapi import APIRouter
from db.database import get_connection

router = APIRouter()


# -----------------------------------
# GET USER NOTIFICATIONS
# -----------------------------------
@router.get("/notifications/{employee_id}")
def get_notifications(employee_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT
                notification_id,
                title,
                message,
                type,
                is_read,
                created_at

            FROM notifications

            WHERE recipient_employee_id = %s

            ORDER BY created_at DESC

            LIMIT 3
        """, (employee_id,))

        rows = cursor.fetchall()

        return [
            {
                "notification_id": r[0],
                "title": r[1],
                "message": r[2],
                "notification_type": r[3],
                "is_read": r[4],
                "created_at": str(r[5])
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

@router.get("/notifications/all/{employee_id}")
def get_all_notifications(employee_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT
                notification_id,
                title,
                message,
                type,
                is_read,
                created_at
            FROM notifications
            WHERE recipient_employee_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (employee_id,))

        rows = cursor.fetchall()

        return [
            {
                "notification_id": r[0],
                "title": r[1],
                "message": r[2],
                "notification_type": r[3],
                "is_read": r[4],
                "created_at": str(r[5])
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

# -----------------------------------
# MARK AS READ
# -----------------------------------
@router.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE notification_id = %s
        """, (notification_id,))

        conn.commit()

        return {
            "message": "Notification marked as read"
        }

    finally:
        cursor.close()
        conn.close()


# -----------------------------------
# MARK ALL AS READ
# -----------------------------------
@router.put("/notifications/{employee_id}/read-all")
def mark_all_notifications_read(employee_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE recipient_employee_id = %s
        """, (employee_id,))

        conn.commit()

        return {
            "message": "All notifications marked as read"
        }

    finally:
        cursor.close()
        conn.close()
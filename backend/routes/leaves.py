from fastapi import APIRouter
from uuid import uuid4
from datetime import datetime, timedelta
from db.database import get_connection

router = APIRouter()

# -------------------------------
# CREATE LEAVE REQUEST
# -------------------------------
@router.post("/leaves")
def create_leave_request(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = payload["employee_id"]
        leave_type = payload["leave_type"]
        reason = payload.get("reason", "")

        start = datetime.strptime(payload["from"], "%Y-%m-%d")
        end = datetime.strptime(payload["to"], "%Y-%m-%d")

        request_id = str(uuid4())

        current = start

        while current <= end:
            cursor.execute("""
                INSERT INTO leaves (request_id, employee_id, date, leave_type, reason, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
            """, (
                request_id,
                employee_id,
                current.date(),
                leave_type,
                reason
            ))

            current += timedelta(days=1)

        conn.commit()

        return {
            "status": "success",
            "request_id": request_id
        }

    finally:
        cursor.close()
        conn.close()


# -------------------------------
# GET EMPLOYEE LEAVE REQUESTS
# -------------------------------
@router.get("/leaves/{employee_id}")
def get_employee_leaves(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT request_id,
                   MIN(date) as start_date,
                   MAX(date) as end_date,
                   leave_type,
                   status
            FROM leaves
            WHERE employee_id = %s
            GROUP BY request_id, leave_type, status
            ORDER BY start_date DESC
        """, (employee_id,))

        rows = cursor.fetchall()

        return [
            {
                "request_id": r[0],
                "from": str(r[1]),
                "to": str(r[2]),
                "leave_type": r[3],
                "status": r[4]
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()
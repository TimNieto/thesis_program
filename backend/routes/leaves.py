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
        print("PAYLOAD RECEIVED:", payload)

        employee_id = payload["employee_id"]
        leave_type = payload["leave_type"]
        reason = payload.get("reason", "")

        start = datetime.strptime(payload["from"], "%Y-%m-%d")
        end = datetime.strptime(payload["to"], "%Y-%m-%d")

        request_id = str(uuid4())

        current = start

        while current <= end:
            print("INSERTING:", employee_id, current.date(), leave_type)

            cursor.execute("""
                INSERT INTO leaves (request_id, employee_id, date, leave_type, reason, status)
                VALUES (%s::uuid, %s, %s, %s, %s, 'pending')
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

    except Exception as e:
        print("ERROR:", str(e))
        return {"error": str(e)}  # 🔥 forces JSON response

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

@router.get("/leaves")
def get_all_leaves():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT request_id,
                   employee_id,
                   MIN(date) as start_date,
                   MAX(date) as end_date,
                   leave_type,
                    MAX(reason) as reason,
                   status
            FROM leaves
            GROUP BY request_id, employee_id, leave_type, status
            ORDER BY start_date DESC
        """)

        rows = cursor.fetchall()

        return [
            {
                "request_id": r[0],
                "employee_id": r[1],
                "from": str(r[2]),
                "to": str(r[3]),
                "leave_type": r[4],
                "reason": r[5],
                "status": r[6]
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.patch("/leaves/{request_id}")
def update_leave_status(request_id: str, payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        status = payload.get("status")

        if status not in ["approved", "rejected"]:
            return {"error": "Invalid status"}

        cursor.execute("""
            UPDATE leaves
            SET status = %s
            WHERE request_id = %s
        """, (status, request_id))

        conn.commit()

        return {"status": "success"}

    finally:
        cursor.close()
        conn.close()

@router.get("/leaves/approved")
def get_approved_leaves(start: str, end: str):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id,
                   date,
                   leave_type,
                   reason
            FROM leaves
            WHERE status = 'approved'
              AND date >= %s::date
              AND date <= %s::date
            ORDER BY employee_id, date
        """, (start, end))

        rows = cursor.fetchall()

        return [
            {
                "employee_id": r[0],
                "date": str(r[1]),
                "leave_type": r[2],
                "reason": r[3]
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()
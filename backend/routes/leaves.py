#---------------------------------------------
# backend/routes/leaves.py

from fastapi import APIRouter, HTTPException
from uuid import uuid4
from datetime import datetime, timedelta
from db.database import get_connection
from services.notification_service import create_notification
from services.role_service import get_company_admin_employee_ids

router = APIRouter()


@router.post("/leaves")
def create_leave_request(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = payload["employee_id"]
        leave_type = payload["leave_type"]
        reason = payload.get("reason", "")

        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND employment_status = 'Active'
        """, (employee_id,))

        employee_row = cursor.fetchone()

        if not employee_row:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_id = employee_row[0]

        start = datetime.strptime(payload["from"], "%Y-%m-%d")
        end = datetime.strptime(payload["to"], "%Y-%m-%d")

        request_id = str(uuid4())
        current = start

        while current <= end:
            cursor.execute("""
                INSERT INTO leaves (
                    request_id,
                    employee_id,
                    date,
                    leave_type,
                    reason,
                    status,
                    company_id
                )
                VALUES (%s::uuid, %s, %s, %s, %s, 'pending', %s)
            """, (
                request_id,
                employee_id,
                current.date(),
                leave_type,
                reason,
                company_id
            ))

            current += timedelta(days=1)

        admin_ids = get_company_admin_employee_ids(
            cursor,
            company_id,
            exclude_employee_id=employee_id
        )

        for admin_id in admin_ids:
            create_notification(
                cursor,
                admin_id,
                "New Leave Request",
                "An employee submitted a leave request.",
                "leave",
                company_id=company_id,
                sender_employee_id=employee_id,
                related_id=None
            )

        conn.commit()

        return {
            "status": "success",
            "request_id": request_id,
            "company_id": company_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE LEAVE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to create leave request"
        )

    finally:
        cursor.close()
        conn.close()


@router.get("/leaves/{employee_id}")
def get_employee_leaves(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            LIMIT 1
        """, (employee_id,))

        employee_row = cursor.fetchone()

        if not employee_row:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_id = employee_row[0]

        cursor.execute("""
            SELECT
                request_id,
                MIN(date) AS start_date,
                MAX(date) AS end_date,
                leave_type,
                MAX(reason) AS reason,
                status
            FROM leaves
            WHERE employee_id = %s
            AND company_id = %s
            GROUP BY request_id, leave_type, status
            ORDER BY start_date DESC
        """, (
            employee_id,
            company_id
        ))

        rows = cursor.fetchall()

        return [
            {
                "request_id": r[0],
                "from": str(r[1]),
                "to": str(r[2]),
                "leave_type": r[3],
                "reason": r[4],
                "status": r[5],
                "company_id": company_id
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.get("/leaves")
def get_all_leaves(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                request_id,
                employee_id,
                MIN(date) AS start_date,
                MAX(date) AS end_date,
                leave_type,
                MAX(reason) AS reason,
                status
            FROM leaves
            WHERE company_id = %s
            GROUP BY request_id, employee_id, leave_type, status
            ORDER BY start_date DESC
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "request_id": r[0],
                "employee_id": r[1],
                "from": str(r[2]),
                "to": str(r[3]),
                "leave_type": r[4],
                "reason": r[5],
                "status": r[6],
                "company_id": company_id
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
        company_id = payload.get("company_id")

        if status not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid status"
            )

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        cursor.execute("""
            SELECT employee_id
            FROM leaves
            WHERE request_id = %s::uuid
            AND company_id = %s
            LIMIT 1
        """, (
            request_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Leave request not found"
            )

        employee_id = employee[0]

        cursor.execute("""
            UPDATE leaves
            SET status = %s,
                updated_at = NOW()
            WHERE request_id = %s::uuid
            AND company_id = %s
        """, (
            status,
            request_id,
            company_id
        ))

        create_notification(
            cursor,
            employee_id,
            f"Leave Request {status.title()}",
            f"Your leave request was {status}.",
            "leave",
            company_id=company_id,
            related_id=None
        )

        conn.commit()

        return {
            "status": "success",
            "company_id": company_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("UPDATE LEAVE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to update leave status"
        )

    finally:
        cursor.close()
        conn.close()


@router.get("/leaves-approved")
def get_approved_leaves(company_id: int, start: str, end: str):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                l.employee_id,
                e.full_name,
                l.date,
                l.leave_type,
                l.reason
            FROM leaves l
            JOIN employees e
                ON l.employee_id = e.employee_id
                AND l.company_id = e.company_id
            WHERE l.company_id = %s
            AND l.status = 'approved'
            AND l.date >= %s::date
            AND l.date <= %s::date
            ORDER BY l.employee_id, l.date
        """, (
            company_id,
            start,
            end
        ))

        rows = cursor.fetchall()

        return [
            {
                "employee_id": r[0],
                "employee_name": r[1],
                "date": str(r[2]),
                "leave_type": r[3],
                "reason": r[4],
                "company_id": company_id
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()
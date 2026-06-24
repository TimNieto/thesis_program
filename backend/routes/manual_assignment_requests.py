#---------------------------------------------
# backend/routes/manual_assignment_requests.py

from fastapi import APIRouter, Body, HTTPException
from db.database import get_connection
from services.manual_assignment_service import (
    normalize_warning_conditions,
    apply_manual_assignment_request,
    reject_manual_assignment_request,
    cancel_manual_assignment_request,
)

router = APIRouter()


def map_manual_assignment_request(row):
    return {
        "manual_assignment_request_id": row[0],
        "id": row[0],
        "company_id": row[1],
        "schedule_id": row[2],

        "requested_by_employee_id": row[3],
        "requested_by_name": row[4],

        "target_employee_id": row[5],
        "target_employee_name": row[6],

        "previous_employee_id": row[7],
        "previous_employee_name": row[8],

        "status": row[9],
        "warning_conditions": normalize_warning_conditions(row[10]),

        "admin_note": row[11],
        "employee_response_note": row[12],

        "requested_at": str(row[13]) if row[13] else None,
        "responded_at": str(row[14]) if row[14] else None,
        "applied_at": str(row[15]) if row[15] else None,
        "cancelled_at": str(row[16]) if row[16] else None,
        "expires_at": str(row[17]) if row[17] else None,

        "account_name": row[18],
        "shift_date": str(row[19]) if row[19] else None,
        "shift_name": row[20],
        "start_time": str(row[21]) if row[21] else None,
        "end_time": str(row[22]) if row[22] else None,
        "shift_template_id": row[23],
        "color_index": row[24],
        "role_key": row[25],
        "role_name": row[26],
    }


def manual_assignment_request_select_sql(extra_where: str = ""):
    return f"""
        SELECT
            mar.manual_assignment_request_id,
            mar.company_id,
            mar.schedule_id,

            mar.requested_by_employee_id,
            requester.full_name AS requested_by_name,

            mar.target_employee_id,
            target.full_name AS target_employee_name,

            mar.previous_employee_id,
            previous.full_name AS previous_employee_name,

            mar.status,
            mar.warning_conditions,

            mar.admin_note,
            mar.employee_response_note,

            mar.requested_at,
            mar.responded_at,
            mar.applied_at,
            mar.cancelled_at,
            mar.expires_at,

            a.account_name,
            s.shift_date,
            st.shift_name,
            st.start_time,
            st.end_time,
            st.shift_template_id,
            st.color_index,
            r.role_key,
            r.role_name
        FROM manual_assignment_requests mar

        JOIN employees requester
            ON mar.requested_by_employee_id = requester.employee_id
            AND mar.company_id = requester.company_id

        JOIN employees target
            ON mar.target_employee_id = target.employee_id
            AND mar.company_id = target.company_id

        LEFT JOIN employees previous
            ON mar.previous_employee_id = previous.employee_id
            AND mar.company_id = previous.company_id

        JOIN generated_schedule gs
            ON mar.schedule_id = gs.schedule_id
            AND mar.company_id = gs.company_id

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

        WHERE 1 = 1
        {extra_where}

        ORDER BY mar.requested_at DESC
    """


@router.get("/manual-assignment-requests")
def get_manual_assignment_requests(
    company_id: int,
    status: str | None = None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        params = [company_id]
        where = "AND mar.company_id = %s"

        if status:
            where += " AND mar.status = %s"
            params.append(status)

        cursor.execute(
            manual_assignment_request_select_sql(where),
            tuple(params)
        )

        return [
            map_manual_assignment_request(row)
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        conn.close()


@router.get("/manual-assignment-requests/employee/{employee_id}")
def get_employee_manual_assignment_requests(
    employee_id: int,
    company_id: int | None = None,
    status: str | None = None
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if not company_id:
            cursor.execute("""
                SELECT company_id
                FROM employees
                WHERE employee_id = %s
                AND employment_status = 'Active'
                LIMIT 1
            """, (employee_id,))

            employee = cursor.fetchone()

            if not employee:
                raise HTTPException(
                    status_code=404,
                    detail="Employee not found"
                )

            company_id = employee[0]

        params = [
            company_id,
            employee_id
        ]

        where = """
            AND mar.company_id = %s
            AND mar.target_employee_id = %s
        """

        if status:
            where += " AND mar.status = %s"
            params.append(status)

        cursor.execute(
            manual_assignment_request_select_sql(where),
            tuple(params)
        )

        return [
            map_manual_assignment_request(row)
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/manual-assignment-requests/{request_id}/accept")
def accept_manual_assignment_request(
    request_id: int,
    payload: dict = Body(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        employee_id = payload.get("employee_id")
        employee_response_note = payload.get("employee_response_note")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not employee_id:
            raise HTTPException(
                status_code=400,
                detail="employee_id is required"
            )

        applied = apply_manual_assignment_request(
            cursor,
            request_id,
            int(company_id),
            int(employee_id),
            employee_response_note
        )

        conn.commit()

        return {
            "message": "Assignment request accepted",
            "schedule_id": applied["schedule_id"],
            "employee_id": applied["employee_id"],
            "previous_employee_id": applied["previous_employee_id"],
        }

    except HTTPException:
        conn.rollback()
        raise

    except ValueError as e:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        conn.rollback()
        print("ACCEPT MANUAL ASSIGNMENT REQUEST ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to accept assignment request"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/manual-assignment-requests/{request_id}/reject")
def reject_manual_assignment_request_route(
    request_id: int,
    payload: dict = Body(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        employee_id = payload.get("employee_id")
        employee_response_note = payload.get("employee_response_note")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not employee_id:
            raise HTTPException(
                status_code=400,
                detail="employee_id is required"
            )

        reject_manual_assignment_request(
            cursor,
            request_id,
            int(company_id),
            int(employee_id),
            employee_response_note
        )

        conn.commit()

        return {
            "message": "Assignment request rejected"
        }

    except HTTPException:
        conn.rollback()
        raise

    except ValueError as e:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        conn.rollback()
        print("REJECT MANUAL ASSIGNMENT REQUEST ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to reject assignment request"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/manual-assignment-requests/{request_id}/cancel")
def cancel_manual_assignment_request_route(
    request_id: int,
    payload: dict = Body(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        cancelled_by = payload.get("cancelled_by")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        cancel_manual_assignment_request(
            cursor,
            request_id,
            int(company_id),
            cancelled_by
        )

        conn.commit()

        return {
            "message": "Assignment request cancelled"
        }

    except HTTPException:
        conn.rollback()
        raise

    except ValueError as e:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        conn.rollback()
        print("CANCEL MANUAL ASSIGNMENT REQUEST ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to cancel assignment request"
        )

    finally:
        cursor.close()
        conn.close()
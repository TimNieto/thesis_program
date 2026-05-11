# backend/routes/schedule.py

from fastapi import APIRouter, HTTPException
from services.schedule_service import generate_weekly_schedule, get_generated_schedule
from db.database import get_connection
from datetime import datetime

router = APIRouter()
SHIFT_STARTS = {
    "GY": 1,
    "AM": 7,
    "NN": 13,
    "PM": 19,
}


@router.get("/generate-schedule")
def generate_schedule():
    try:
        result = generate_weekly_schedule()

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": result["grouped_schedule"],  # ✅ ADD THIS
            "unfilled_slots": result["unfilled_slots"]
        }

    except Exception as e:
        print("ERROR generating schedule:", e)
        raise HTTPException(status_code=500, detail=str(e)) 
    
@router.get("/generated-schedule")
def get_schedule():
    try:
        result = get_generated_schedule()

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": result["grouped_schedule"]
        }

    except Exception as e:
        print("ERROR loading generated schedule:", e)
        raise HTTPException(status_code=500, detail="Failed to load schedule")

    
@router.post("/request-cover/{schedule_id}")
def request_cover(schedule_id: int, payload: dict):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        user_id = payload.get("user_id")
        reason = payload.get("reason")

        if not user_id:
            raise HTTPException(
                status_code=400,
                detail="user_id required"
            )

        # GET SHIFT INFO
        cursor.execute("""
            SELECT
                shift_date,
                shift_type
            FROM generated_schedule
            WHERE schedule_id = %s
        """, (schedule_id,))

        schedule = cursor.fetchone()

        if not schedule:
            raise HTTPException(
                status_code=404,
                detail="Schedule not found"
            )

        shift_date = schedule[0]
        shift_type = schedule[1]

        # DETERMINE SHIFT START
        shift_hour = SHIFT_STARTS.get(shift_type, 7)

        shift_datetime = datetime.combine(
            shift_date,
            datetime.min.time()
        ).replace(hour=shift_hour)

        now = datetime.now()

        diff_hours = (
            shift_datetime - now
        ).total_seconds() / 3600
        print("SHIFT DATETIME:", shift_datetime)
        print("NOW:", now)
        print("DIFF HOURS:", diff_hours)

        # DETERMINE REQUEST TYPE
        request_type = (
            "emergency"
            if diff_hours <= 12
            else "normal"
        )

        # PREVENT DUPLICATES
        cursor.execute("""
            SELECT id
            FROM coverage_requests
            WHERE schedule_id = %s
            AND requested_by = %s
            AND status = 'pending'
            AND is_archived = FALSE
        """, (
            schedule_id,
            user_id
        ))

        existing = cursor.fetchone()

        if existing:
            return {
                "message": "Already requested"
            }

        # CREATE REQUEST
        cursor.execute("""
            INSERT INTO coverage_requests (
                schedule_id,
                requested_by,
                reason,
                request_type
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            schedule_id,
            user_id,
            reason,
            request_type
        ))

        request_id = cursor.fetchone()[0]

        # EMERGENCY LOGIC
        if request_type == "emergency":

            # FIND EMPLOYEES WORKING SAME DAY
            cursor.execute("""
                SELECT DISTINCT employee_id
                FROM generated_schedule
                WHERE shift_date = %s
                AND employee_id != %s
            """, (
                shift_date,
                user_id
            ))

            employees = cursor.fetchall()

            # SAVE TARGETS
            for emp in employees:

                cursor.execute("""
                    INSERT INTO emergency_cover_targets (
                        coverage_request_id,
                        employee_id
                    )
                    VALUES (%s, %s)
                """, (
                    request_id,
                    emp[0]
                ))

        conn.commit()

        return {
            "message": "Cover request submitted",
            "request_type": request_type
        }

    finally:
        cursor.close()
        conn.close()

@router.get("/coverage-requests/{employee_id}")
def get_requests(employee_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""

            SELECT  

                cr.id,

                e.full_name,

                gs.account,

                gs.shift_date,

                gs.shift_type,

                gs.role,

                cr.reason,

                cr.status,

                cr.request_type,
                       
                cr.created_at,

                CASE
                    WHEN ect.employee_id IS NOT NULL
                    THEN TRUE
                    ELSE FALSE
                END AS is_targeted

            FROM coverage_requests cr

            JOIN employees e
                ON cr.requested_by = e.employee_id

            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id

            LEFT JOIN emergency_cover_targets ect
                ON ect.coverage_request_id = cr.id
                AND ect.employee_id = %s

            WHERE

            cr.is_archived = FALSE
                       
            AND gs.is_archived = FALSE

            AND (

                -- employee always sees own requests
                cr.requested_by = %s

                OR

                -- all normal requests visible
                (
                    cr.request_type = 'normal'
                )

                OR

                -- emergency requests only visible to targets
                (
                    cr.request_type = 'emergency'
                    AND ect.employee_id IS NOT NULL
                )

            )
                       
                ORDER BY cr.created_at DESC

        """, (
            employee_id,  # for LEFT JOIN
            employee_id   # for own requests
        ))

        rows = cursor.fetchall()

        result = []

        for r in rows:

            result.append({
                "id": r[0],
                "requester": r[1],
                "livestream": r[2],
                "day": str(r[3]),
                "shift": r[4],
                "role": r[5],
                "reason": r[6],
                "status": r[7],
                "request_type": r[8],
                "created_at": str(r[9]),
                "is_targeted": r[10]
            })

        return result

    finally:
        cursor.close()
        conn.close()

@router.get("/coverage-requests-admin")
def get_all_requests():

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""

            SELECT

                cr.id,

                e.full_name,

                gs.account,

                gs.shift_date,

                gs.shift_type,

                gs.role,

                cr.reason,

                cr.status,

                cr.request_type,

                cr.created_at

            FROM coverage_requests cr

            JOIN employees e
                ON cr.requested_by = e.employee_id

            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id

            WHERE cr.is_archived = FALSE
                       
            AND gs.is_archived = FALSE

            ORDER BY cr.created_at DESC

        """)

        rows = cursor.fetchall()

        result = []

        for r in rows:

            result.append({
                "id": r[0],
                "requester": r[1],
                "livestream": r[2],
                "day": str(r[3]),
                "shift": r[4],
                "role": r[5],
                "reason": r[6],
                "status": r[7],
                "request_type": r[8],
                "created_at": str(r[9])
            })

        return result

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/{id}/approve")
def approve_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE coverage_requests
        SET status = 'approved', approved_at = NOW()
        WHERE id = %s
    """, (id,))

    conn.commit()

    cursor.close()
    conn.close()

    return {"message": "Approved"}

@router.post("/coverage-requests/{id}/deny")
def deny_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE coverage_requests
        SET status = 'denied'
        WHERE id = %s
    """, (id,))

    conn.commit()

    cursor.close()
    conn.close()

    return {"message": "Denied"}


@router.post("/coverage-requests/{id}/apply")
def apply_for_cover(id: int, payload: dict):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        employee_id = payload.get("employee_id")
        reason = payload.get("reason", "")

        if not employee_id:
            raise HTTPException(
                status_code=400,
                detail="employee_id required"
            )

        # CHECK REQUEST EXISTS
        cursor.execute("""
            SELECT id, requested_by
            FROM coverage_requests
            WHERE id = %s
            AND status = 'pending'
            AND is_archived = FALSE
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Cover request not found"
            )

        # PREVENT SELF APPLICATION
        if request[1] == employee_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot apply to own request"
            )

        # PREVENT DUPLICATES
        cursor.execute("""
            SELECT id
            FROM shift_applications
            WHERE coverage_request_id = %s
            AND applicant_id = %s
            AND is_archived = FALSE
        """, (
            id,
            employee_id
        ))

        existing = cursor.fetchone()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Already applied"
            )

        # CREATE APPLICATION
        cursor.execute("""
            INSERT INTO shift_applications (
                coverage_request_id,
                applicant_id,
                reason
            )
            VALUES (%s, %s, %s)
        """, (
            id,
            employee_id,
            reason
        ))

        conn.commit()

        return {
            "message": "Applied successfully"
        }

    finally:
        cursor.close()
        conn.close()

@router.get("/shift-applications")
def get_shift_applications():

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""

            SELECT

                sa.id,

                e.full_name,
                       
                cr.requested_by,

                gs.account,

                gs.shift_date,

                gs.shift_type,

                gs.role,

                sa.reason,

                sa.status,

                cr.id AS coverage_request_id,

                gs.schedule_id,

                e.employee_id

            FROM shift_applications sa

            JOIN employees e
                ON sa.applicant_id = e.employee_id

            JOIN coverage_requests cr
                ON sa.coverage_request_id = cr.id

            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id

            WHERE sa.is_archived = FALSE
            
            AND gs.is_archived = FALSE

            ORDER BY sa.applied_at DESC

        """)

        rows = cursor.fetchall()

        result = []

        for r in rows:

            result.append({
            "id": r[0],
            "applicant": r[1],
            "requested_by": r[2],
            "livestream": r[3],
            "day": str(r[4]),
            "shift": r[5],
            "role": r[6],
            "reason": r[7],
            "status": r[8],
            "coverage_request_id": r[9],
            "schedule_id": r[10],
            "employee_id": r[11]
        })

        return result

    finally:
        cursor.close()
        conn.close()

@router.post("/shift-applications/{id}/approve")
def approve_application(id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # GET APPLICATION INFO
        cursor.execute("""

            SELECT
                sa.applicant_id,
                cr.schedule_id,
                cr.id

            FROM shift_applications sa

            JOIN coverage_requests cr
                ON sa.coverage_request_id = cr.id

            WHERE sa.id = %s

        """, (id,))

        app = cursor.fetchone()

        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )

        applicant_id = app[0]
        schedule_id = app[1]
        coverage_request_id = app[2]

        # TRANSFER SHIFT
        cursor.execute("""
            UPDATE generated_schedule
            SET employee_id = %s
            WHERE schedule_id = %s
        """, (
            applicant_id,
            schedule_id
        ))

        # APPROVE COVER REQUEST
        cursor.execute("""
            UPDATE coverage_requests
            SET
                status = 'approved',
                accepted_by = %s,
                approved_at = NOW()
            WHERE id = %s
        """, (
            applicant_id,
            coverage_request_id
        ))

        # APPROVE APPLICATION
        cursor.execute("""
            UPDATE shift_applications
            SET status = 'approved'
            WHERE id = %s
        """, (id,))

        # DENY OTHER APPLICATIONS
        cursor.execute("""
            UPDATE shift_applications
            SET status = 'denied'
            WHERE coverage_request_id = %s
            AND id != %s
        """, (
            coverage_request_id,
            id
        ))

        conn.commit()

        return {
            "message": "Application approved"
        }

    finally:
        cursor.close()
        conn.close()

@router.post("/shift-applications/{id}/deny")
def deny_application(id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # CHECK EXISTS
        cursor.execute("""
            SELECT id
            FROM shift_applications
            WHERE id = %s
        """, (id,))

        app = cursor.fetchone()

        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )

        # DENY APPLICATION
        cursor.execute("""
            UPDATE shift_applications
            SET status = 'denied'
            WHERE id = %s
        """, (id,))

        conn.commit()

        return {
            "message": "Application denied"
        }

    finally:
        cursor.close()
        conn.close()

@router.post("/save-schedule")
def save_schedule(assignments: list):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ARCHIVE OLD WORKFLOW DATA
        cursor.execute("""
            UPDATE emergency_cover_targets
            SET is_archived = TRUE
        """)

        cursor.execute("""
            UPDATE shift_applications
            SET is_archived = TRUE
        """)

        cursor.execute("""
            UPDATE coverage_requests
            SET is_archived = TRUE
        """)

        # REMOVE OLD GENERATED SCHEDULE

        cursor.execute("""
            UPDATE generated_schedule
            SET is_archived = TRUE
        """)

        for a in assignments:
            cursor.execute("""
                INSERT INTO generated_schedule (
                    shift_id,
                    employee_id,
                    role,
                    shift_date,
                    shift_type,
                    account
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                a["shift_id"],
                a["employee_id"],
                a["role"],
                a["shift_date"],
                a["shift_type"],
                a["account"]
            ))

        conn.commit()

        return {"message": "Schedule saved"}

    finally:
        cursor.close()
        conn.close()
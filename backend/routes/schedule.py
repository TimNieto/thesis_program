#---------------------------------------------
# backend/routes/schedule.py

from fastapi import APIRouter, Body, HTTPException
from services.schedule_service import generate_weekly_schedule, get_generated_schedule
from db.database import get_connection
from services.notification_service import create_notification
from datetime import datetime, timedelta
from services.role_service import get_company_admin_employee_ids

router = APIRouter()

def get_week_bounds_for_shift(cursor, coverage_request_id: int):
    cursor.execute("""
        SELECT
            s.shift_date
        FROM coverage_requests cr
        JOIN generated_schedule gs
            ON cr.schedule_id = gs.schedule_id
        JOIN shifts s
            ON gs.shift_id = s.shift_id
        WHERE cr.id = %s
    """, (coverage_request_id,))

    row = cursor.fetchone()

    if not row:
        return None, None

    shift_date = row[0]

    week_start = shift_date - timedelta(days=shift_date.weekday())
    week_end = week_start + timedelta(days=6)

    return week_start, week_end

def select_best_weekly_cover_applicant(cursor, coverage_request_id: int):
    week_start, week_end = get_week_bounds_for_shift(
        cursor,
        coverage_request_id
    )

    if not week_start or not week_end:
        return None

    cursor.execute("""
        SELECT
            sa.id,
            sa.applicant_id,
            sa.applied_at,
            (
                SELECT COUNT(*)
                FROM shift_applications past_sa
                JOIN coverage_requests past_cr
                    ON past_sa.coverage_request_id = past_cr.id
                JOIN generated_schedule past_gs
                    ON past_cr.schedule_id = past_gs.schedule_id
                JOIN shifts past_s
                    ON past_gs.shift_id = past_s.shift_id
                WHERE past_sa.applicant_id = sa.applicant_id
                AND past_sa.status = 'approved'
                AND past_sa.is_archived = FALSE
                AND past_cr.is_archived = FALSE
                AND past_s.shift_date BETWEEN %s AND %s
            ) AS weekly_approved_cover_count
        FROM shift_applications sa
        WHERE sa.coverage_request_id = %s
        AND sa.status = 'pending'
        AND sa.is_archived = FALSE
        ORDER BY
            weekly_approved_cover_count ASC,
            sa.applied_at ASC
        LIMIT 1
    """, (
        week_start,
        week_end,
        coverage_request_id
    ))

    return cursor.fetchone()

def auto_approve_cover_application(cursor, application_id: int):
    cursor.execute("""
        SELECT
            sa.applicant_id,
            cr.schedule_id,
            cr.id,
            cr.requested_by
        FROM shift_applications sa
        JOIN coverage_requests cr
            ON sa.coverage_request_id = cr.id
        WHERE sa.id = %s
        AND sa.status = 'pending'
        AND cr.status = 'pending'
        AND sa.is_archived = FALSE
        AND cr.is_archived = FALSE
    """, (application_id,))

    row = cursor.fetchone()

    if not row:
        return False

    applicant_id = row[0]
    schedule_id = row[1]
    coverage_request_id = row[2]
    requester_id = row[3]

    cursor.execute("""
        UPDATE generated_schedule
        SET employee_id = %s
        WHERE schedule_id = %s
        AND is_archived = FALSE
    """, (
        applicant_id,
        schedule_id
    ))

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

    cursor.execute("""
        UPDATE shift_applications
        SET status = 'approved'
        WHERE id = %s
    """, (application_id,))

    cursor.execute("""
        UPDATE shift_applications
        SET status = 'denied'
        WHERE coverage_request_id = %s
        AND id != %s
        AND status = 'pending'
        AND is_archived = FALSE
    """, (
        coverage_request_id,
        application_id
    ))

    create_notification(
        cursor,
        requester_id,
        "Cover Request Automatically Approved",
        "Your cover request was automatically assigned.",
        "cover"
    )

    create_notification(
        cursor,
        applicant_id,
        "Cover Application Approved",
        "You were selected to cover a shift.",
        "cover"
    )

    return True



@router.get("/generate-schedule")
def generate_schedule(company_id: int):
    try:
        result = generate_weekly_schedule(company_id)

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": result["grouped_schedule"],
            "unfilled_slots": result["unfilled_slots"]
        }

    except Exception as e:
        print("ERROR generating schedule:", e)
        raise HTTPException(status_code=500, detail=str(e)) 
    
@router.get("/generated-schedule")
def get_schedule(company_id: int):
    try:
        result = get_generated_schedule(company_id)

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
        
        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND employment_status = 'Active'
        """, (user_id,))

        employee_row = cursor.fetchone()

        if not employee_row:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        company_id = employee_row[0]

        # GET SHIFT INFO
        cursor.execute("""
            SELECT
                s.shift_date,
                st.start_time

            FROM generated_schedule gs

            JOIN shifts s
                ON gs.shift_id = s.shift_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id

            WHERE gs.schedule_id = %s
        """, (schedule_id,))

        schedule = cursor.fetchone()

        if not schedule:
            raise HTTPException(
                status_code=404,
                detail="Schedule not found"
            )

        shift_date = schedule[0]

        # DETERMINE SHIFT START
        shift_start = schedule[1]

        shift_datetime = datetime.combine(
            shift_date,
            shift_start
        )

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
                SELECT DISTINCT gs.employee_id

                FROM generated_schedule gs

                JOIN shifts s
                    ON gs.shift_id = s.shift_id

                WHERE s.shift_date = %s
                AND gs.employee_id != %s
                AND gs.is_archived = FALSE
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

        admin_ids = get_company_admin_employee_ids(
            cursor,
            company_id
        )

        for admin_id in admin_ids:
            create_notification(
                cursor,
                admin_id,
                "New Cover Request",
                "An employee submitted a cover request.",
                "cover"
            )

        conn.commit()

        return {
            "message": "Cover request submitted",
            "request_type": request_type
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to request cover"
        )

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
                       
                cr.schedule_id,
                       
                cr.requested_by,

                e.full_name,

                s.account,
                       
                s.shift_date,
                       
                st.shift_name,

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

            JOIN shifts s
                ON gs.shift_id = s.shift_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id

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
            employee_id,
            employee_id
        ))

        rows = cursor.fetchall()

        result = []

        for r in rows:

            result.append({
                "id": r[0],
                "schedule_id": r[1],
                "requested_by": r[2],
                "requester": r[3],
                "livestream": r[4],
                "day": str(r[5]),
                "shift": r[6],
                "role": r[7],
                "reason": r[8],
                "status": r[9],
                "request_type": r[10],
                "created_at": str(r[11]),
                "is_targeted": r[12]
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
                       
                cr.schedule_id,
                       
                cr.requested_by,

                e.full_name,

                s.account,
                       
                s.shift_date,
                       
                st.shift_name,

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

            JOIN shifts s
                ON gs.shift_id = s.shift_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id

            WHERE cr.is_archived = FALSE
                       
            AND gs.is_archived = FALSE

            ORDER BY cr.created_at DESC

        """)

        rows = cursor.fetchall()

        result = []

        for r in rows:

            result.append({
                "id": r[0],
                "schedule_id": r[1],
                "requested_by": r[2],
                "requester": r[3],
                "livestream": r[4],
                "day": str(r[5]),
                "shift": r[6],
                "role": r[7],
                "reason": r[8],
                "status": r[9],
                "request_type": r[10],
                "created_at": str(r[11])
            })

        return result

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/{id}/approve")
def approve_request(id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # GET REQUESTER
        cursor.execute("""
            SELECT requested_by
            FROM coverage_requests
            WHERE id = %s
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Request not found"
            )

        requester_id = request[0]

        # APPROVE REQUEST
        cursor.execute("""
            UPDATE coverage_requests
            SET status = 'approved',
                approved_at = NOW()
            WHERE id = %s
        """, (id,))

        # SEND NOTIFICATION
        create_notification(
            cursor,
            requester_id,
            "Cover Request Approved",
            "Your cover request was approved.",
            "cover"
        )

        conn.commit()

        return {
            "message": "Approved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to approve request"
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/{id}/deny")
def deny_request(id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # GET REQUESTER
        cursor.execute("""
            SELECT requested_by
            FROM coverage_requests
            WHERE id = %s
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Request not found"
            )

        requester_id = request[0]

        # DENY REQUEST
        cursor.execute("""
            UPDATE coverage_requests
            SET status = 'denied'
            WHERE id = %s
        """, (id,))

        # SEND NOTIFICATION
        create_notification(
            cursor,
            requester_id,
            "Cover Request Denied",
            "Your cover request was denied.",
            "cover"
        )

        conn.commit()

        return {
            "message": "Denied"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to deny request"
        )

    finally:
        cursor.close()
        conn.close()


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

        # GET REQUEST TYPE + SCHEDULE
        cursor.execute("""
            SELECT
                cr.request_type,
                cr.schedule_id
            FROM coverage_requests cr
            WHERE cr.id = %s
        """, (id,))

        request_data = cursor.fetchone()

        if not request_data:
            raise HTTPException(
                status_code=404,
                detail="Cover request not found"
            )

        request_type = request_data[0]
        schedule_id = request_data[1]

        # GET ABSENT REPLACEMENT MODE
        cursor.execute("""
            SELECT absence_replacement_mode
            FROM company_settings
            LIMIT 1
        """)

        mode_row = cursor.fetchone()

        replacement_mode = (
            mode_row[0].lower()
            if mode_row and mode_row[0]
            else "manual"
        )

        # DETERMINE IF ADMIN APPROVAL IS NEEDED
        requires_admin = False

        # MANUAL MODE
        if replacement_mode == "manual":
            requires_admin = True

        # HYBRID MODE
        elif replacement_mode == "hybrid":

            if request_type != "emergency":
                requires_admin = True

        # AUTOMATIC MODE
        elif replacement_mode == "automatic":
            requires_admin = False

        # MANUAL APPROVAL FLOW
        if requires_admin:

            cursor.execute("""
                INSERT INTO shift_applications (
                    coverage_request_id,
                    applicant_id,
                    reason,
                    status
                )
                VALUES (%s, %s, %s, 'pending')
            """, (
                id,
                employee_id,
                reason
            ))

            # NOTIFY REQUESTER
            cursor.execute("""
                SELECT requested_by
                FROM coverage_requests
                WHERE id = %s
            """, (id,))

            requester = cursor.fetchone()

            if requester:

                create_notification(
                    cursor,
                    requester[0],
                    "New Cover Applicant",
                    "Someone applied to cover your shift.",
                    "cover"
                )

            conn.commit()

            return {
                "message": "Application submitted for admin approval"
            }
        
        if replacement_mode == "automatic" and request_type == "normal":

            cursor.execute("""
                INSERT INTO shift_applications (
                    coverage_request_id,
                    applicant_id,
                    reason,
                    status
                )
                VALUES (%s, %s, %s, 'pending')
            """, (
                id,
                employee_id,
                reason
            ))

            cursor.execute("""
                SELECT requested_by
                FROM coverage_requests
                WHERE id = %s
            """, (id,))

            requester = cursor.fetchone()

            if requester:
                create_notification(
                    cursor,
                    requester[0],
                    "New Cover Applicant",
                    "Someone applied to cover your shift.",
                    "cover"
                )

            conn.commit()

            return {
                "message": "Application submitted. Automatic weekly-fair selection will happen 12 hours before the shift."
            }

        # TRANSFER SHIFT
        cursor.execute("""
            UPDATE generated_schedule
            SET employee_id = %s
            WHERE schedule_id = %s
        """, (
            employee_id,
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
            employee_id,
            id
        ))

        # SAVE APPROVED APPLICATION
        cursor.execute("""
            INSERT INTO shift_applications (
                coverage_request_id,
                applicant_id,
                reason,
                status
            )
            VALUES (%s, %s, %s, 'approved')
        """, (
            id,
            employee_id,
            reason
        ))

        # NOTIFY REQUESTER
        cursor.execute("""
            SELECT requested_by
            FROM coverage_requests
            WHERE id = %s
        """, (id,))

        requester = cursor.fetchone()

        if requester:

            create_notification(
                cursor,
                requester[0],
                "New Cover Applicant",
                "Someone applied to cover your shift.",
                "cover"
            )

        conn.commit()

        return {
            "message": "Shift automatically transferred"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to apply for cover"
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/process-automatic")
def process_automatic_cover_requests():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT absence_replacement_mode
            FROM company_settings
            LIMIT 1
        """)

        mode_row = cursor.fetchone()

        replacement_mode = (
            mode_row[0].lower()
            if mode_row and mode_row[0]
            else "manual"
        )

        if replacement_mode != "automatic":
            return {
                "message": "Automatic replacement mode is not enabled",
                "processed": 0
            }

        cursor.execute("""
            SELECT
                cr.id
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
            WHERE cr.status = 'pending'
            AND cr.is_archived = FALSE
            AND gs.is_archived = FALSE
            AND cr.request_type = 'normal'
            AND (
                s.shift_date + st.start_time
            ) <= NOW() + INTERVAL '12 hours'
        """)

        requests = cursor.fetchall()

        processed = 0

        for request in requests:
            coverage_request_id = request[0]

            best = select_best_weekly_cover_applicant(
                cursor,
                coverage_request_id
            )

            if not best:
                continue

            application_id = best[0]

            approved = auto_approve_cover_application(
                cursor,
                application_id
            )

            if approved:
                processed += 1

        conn.commit()

        return {
            "message": "Automatic cover requests processed",
            "processed": processed
        }

    except Exception as e:
        conn.rollback()
        print("PROCESS AUTOMATIC COVER ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

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

                s.account,
                       
                s.shift_date,
                       
                st.shift_name,

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

            JOIN shifts s
                ON gs.shift_id = s.shift_id

            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id

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

        cursor.execute("""
            SELECT requested_by
            FROM coverage_requests
            WHERE id = %s
        """, (coverage_request_id,))

        requester = cursor.fetchone()

        if requester:

            create_notification(
                cursor,
                requester[0],
                "Cover Request Approved",
                "Your cover request was approved.",
                "cover"
            )

        conn.commit()

        return {
            "message": "Application approved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to approve application"
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/shift-applications/{id}/deny")
def deny_application(id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # GET APPLICANT
        cursor.execute("""
            SELECT applicant_id
            FROM shift_applications
            WHERE id = %s
        """, (id,))

        app = cursor.fetchone()

        if not app:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )

        applicant_id = app[0]

        # DENY APPLICATION
        cursor.execute("""
            UPDATE shift_applications
            SET status = 'denied'
            WHERE id = %s
        """, (id,))

        # SEND NOTIFICATION
        create_notification(
            cursor,
            applicant_id,
            "Cover Application Denied",
            "Your application to cover a shift was denied.",
            "cover"
        )

        conn.commit()

        return {
            "message": "Application denied"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to deny application"
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/save-schedule")
def save_schedule(payload: dict = Body(...)):
    conn = get_connection()
    cursor = conn.cursor()
    assignments = payload.get("assignments", [])
    saved_by = payload.get("saved_by")

    try:
        cursor.execute("UPDATE emergency_cover_targets SET is_archived = TRUE")
        cursor.execute("UPDATE shift_applications SET is_archived = TRUE")
        cursor.execute("UPDATE coverage_requests SET is_archived = TRUE")
        cursor.execute("UPDATE generated_schedule SET is_archived = TRUE")

        cursor.execute("""
            SELECT
                s.shift_id,
                sr.role_key,
                ssr.required_count
            FROM shifts s
            JOIN shift_staffing_requirements ssr
                ON s.shift_template_id = ssr.shift_template_id
            JOIN staffing_roles sr
                ON ssr.staffing_role_id = sr.staffing_role_id
            WHERE ssr.is_active = TRUE
            AND sr.is_active = TRUE
        """)

        allowed_counts = {
            (r[0], r[1]): r[2]
            for r in cursor.fetchall()
        }

        grouped = {}

        for a in assignments:
            shift_id = a["shift_id"]
            role = a["role"].lower().replace(" ", "_")

            key = (shift_id, role)

            if key not in grouped:
                grouped[key] = []

            grouped[key].append(a)

        for key, items in grouped.items():
            shift_id, role = key
            required_count = allowed_counts.get(key, 0)

            if required_count <= 0:
                continue

            items = sorted(
                items,
                key=lambda x: x.get("slot_index", 0)
            )

            for slot_index, a in enumerate(items[:required_count]):
                cursor.execute("""
                    INSERT INTO generated_schedule (
                        shift_id,
                        employee_id,
                        role,
                        slot_index
                    )
                    VALUES (%s, %s, %s, %s)
                """, (
                    shift_id,
                    a.get("employee_id"),
                    role,
                    a.get("slot_index", slot_index)
                ))

        if saved_by:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE employment_status = 'Active'
                AND employee_id != %s
            """, (saved_by,))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE employment_status = 'Active'
            """)

        employees = cursor.fetchall()

        for emp in employees:

            create_notification(
                cursor,
                emp[0],
                "New Schedule Published",
                "A new schedule has been published.",
                "schedule"
            )

        conn.commit()

        return {"message": "Schedule saved"}

    except Exception as e:
        conn.rollback()
        print("SAVE SCHEDULE ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
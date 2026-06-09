#---------------------------------------------
# backend/routes/schedule.py

from fastapi import APIRouter, Body, HTTPException
from services.schedule_service import generate_weekly_schedule, get_generated_schedule
from db.database import get_connection
from services.notification_service import create_notification
from datetime import datetime, timedelta
from services.role_service import get_company_admin_employee_ids

router = APIRouter()

def record_absence_from_filled_cover(
    cursor,
    requester_id: int,
    schedule_id: int,
    company_id: int
):
    cursor.execute("""
        SELECT
            s.shift_date
        FROM generated_schedule gs
        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id
        WHERE gs.schedule_id = %s
        AND gs.company_id = %s
        LIMIT 1
    """, (
        schedule_id,
        company_id
    ))

    row = cursor.fetchone()

    if not row:
        return

    shift_date = row[0]

    cursor.execute("""
        INSERT INTO absences (
            employee_id,
            date,
            status,
            company_id
        )
        VALUES (%s, %s, 'approved', %s)
        ON CONFLICT (company_id, employee_id, date)
        DO UPDATE SET
            status = 'approved',
            updated_at = NOW()
    """, (
        requester_id,
        shift_date,
        company_id
    ))

def get_week_bounds_for_shift(cursor, coverage_request_id: int):
    cursor.execute("""
        SELECT
            s.shift_date
        FROM coverage_requests cr
        JOIN generated_schedule gs
            ON cr.schedule_id = gs.schedule_id
            AND cr.company_id = gs.company_id
        JOIN shifts s
            ON gs.shift_id = s.shift_id
            AND gs.company_id = s.company_id
        WHERE cr.coverage_request_id = %s
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
            sa.shift_application_id,
            sa.applicant_id,
            sa.applied_at,
            (
                SELECT COUNT(*)
                FROM shift_applications past_sa
                JOIN coverage_requests past_cr
                    ON past_sa.coverage_request_id = past_cr.coverage_request_id
                    AND past_sa.company_id = past_cr.company_id
                JOIN generated_schedule past_gs
                    ON past_cr.schedule_id = past_gs.schedule_id
                    AND past_cr.company_id = past_gs.company_id
                JOIN shifts past_s
                    ON past_gs.shift_id = past_s.shift_id
                    AND past_gs.company_id = past_s.company_id
                WHERE past_sa.applicant_id = sa.applicant_id
                AND past_sa.company_id = sa.company_id
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
            cr.coverage_request_id,
            cr.requested_by,
            cr.company_id
        FROM shift_applications sa
        JOIN coverage_requests cr
            ON sa.coverage_request_id = cr.coverage_request_id
            AND sa.company_id = cr.company_id
        WHERE sa.shift_application_id = %s
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
    company_id = row[4]

    cursor.execute("""
        UPDATE generated_schedule
        SET employee_id = %s
        WHERE schedule_id = %s
        AND company_id = %s
        AND is_archived = FALSE
    """, (
        applicant_id,
        schedule_id,
        company_id
    ))

    record_absence_from_filled_cover(
        cursor,
        requester_id,
        schedule_id,
        company_id
    )

    cursor.execute("""
        UPDATE coverage_requests
        SET
            status = 'approved',
            accepted_by = %s,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE coverage_request_id = %s
        AND company_id = %s
    """, (
        applicant_id,
        coverage_request_id,
        company_id
    ))

    cursor.execute("""
        UPDATE shift_applications
        SET
            status = 'approved',
            updated_at = NOW()
        WHERE shift_application_id = %s
        AND company_id = %s
    """, (
        application_id,
        company_id
    ))

    cursor.execute("""
        UPDATE shift_applications
        SET
            status = 'denied',
            updated_at = NOW()
        WHERE coverage_request_id = %s
        AND company_id = %s
        AND shift_application_id != %s
        AND status = 'pending'
        AND is_archived = FALSE
    """, (
        coverage_request_id,
        company_id,
        application_id
    ))

    create_notification(
        cursor,
        requester_id,
        "Cover Request Automatically Approved",
        "Your cover request was automatically assigned.",
        "cover",
        company_id=company_id,
        related_id=coverage_request_id
    )

    create_notification(
        cursor,
        applicant_id,
        "Cover Application Approved",
        "You were selected to cover a shift.",
        "cover",
        company_id=company_id,
        related_id=coverage_request_id
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
        reason = payload.get("reason", "")

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

        cursor.execute("""
            SELECT
                gs.schedule_id,
                gs.employee_id,
                s.shift_date,
                st.start_time
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            WHERE gs.schedule_id = %s
            AND gs.company_id = %s
            AND gs.is_archived = FALSE
        """, (
            schedule_id,
            company_id
        ))

        schedule = cursor.fetchone()

        if not schedule:
            raise HTTPException(
                status_code=404,
                detail="Schedule not found"
            )

        assigned_employee_id = schedule[1]
        shift_date = schedule[2]
        shift_start = schedule[3]

        if int(assigned_employee_id) != int(user_id):
            raise HTTPException(
                status_code=403,
                detail="You can only request cover for your own assigned shift"
            )

        shift_datetime = datetime.combine(
            shift_date,
            shift_start
        )

        now = datetime.now()

        diff_hours = (
            shift_datetime - now
        ).total_seconds() / 3600

        request_type = (
            "emergency"
            if diff_hours <= 12
            else "normal"
        )

        cursor.execute("""
            SELECT coverage_request_id
            FROM coverage_requests
            WHERE schedule_id = %s
            AND requested_by = %s
            AND company_id = %s
            AND status = 'pending'
            AND is_archived = FALSE
        """, (
            schedule_id,
            user_id,
            company_id
        ))

        existing = cursor.fetchone()

        if existing:
            return {
                "message": "Already requested",
                "coverage_request_id": existing[0]
            }

        cursor.execute("""
            INSERT INTO coverage_requests (
                schedule_id,
                requested_by,
                reason,
                request_type,
                status,
                company_id
            )
            VALUES (%s, %s, %s, %s, 'pending', %s)
            RETURNING coverage_request_id
        """, (
            schedule_id,
            user_id,
            reason,
            request_type,
            company_id
        ))

        request_id = cursor.fetchone()[0]

        if request_type == "emergency":
            cursor.execute("""
                SELECT DISTINCT gs.employee_id
                FROM generated_schedule gs
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                WHERE s.shift_date = %s
                AND gs.company_id = %s
                AND gs.employee_id IS NOT NULL
                AND gs.employee_id != %s
                AND gs.is_archived = FALSE
            """, (
                shift_date,
                company_id,
                user_id
            ))

            employees = cursor.fetchall()

            for emp in employees:
                cursor.execute("""
                    INSERT INTO emergency_cover_targets (
                        coverage_request_id,
                        employee_id,
                        status,
                        company_id
                    )
                    VALUES (%s, %s, 'pending', %s)
                """, (
                    request_id,
                    emp[0],
                    company_id
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
                "cover",
                company_id=company_id,
                sender_employee_id=user_id,
                related_id=request_id
            )

        conn.commit()

        return {
            "message": "Cover request submitted",
            "coverage_request_id": request_id,
            "request_type": request_type
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("REQUEST COVER ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
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
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND employment_status = 'Active'
        """, (employee_id,))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_id = employee[0]

        cursor.execute("""
            SELECT
                cr.coverage_request_id,
                cr.schedule_id,
                cr.requested_by,
                requester.full_name,
                a.account_name,
                s.shift_date,
                st.shift_name,
                r.role_key,
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
            JOIN employees requester
                ON cr.requested_by = requester.employee_id
                AND cr.company_id = requester.company_id
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id
            JOIN roles r
                ON gs.role_id = r.role_id
                AND gs.company_id = r.company_id
            LEFT JOIN emergency_cover_targets ect
                ON ect.coverage_request_id = cr.coverage_request_id
                AND ect.company_id = cr.company_id
                AND ect.employee_id = %s
                AND ect.is_archived = FALSE
            WHERE cr.company_id = %s
            AND cr.is_archived = FALSE
            AND gs.is_archived = FALSE
            AND (
                cr.requested_by = %s
                OR cr.request_type = 'normal'
                OR (
                    cr.request_type = 'emergency'
                    AND ect.employee_id IS NOT NULL
                )
            )
            ORDER BY cr.created_at DESC
        """, (
            employee_id,
            company_id,
            employee_id
        ))

        rows = cursor.fetchall()

        return [
            {
                "id": r[0],
                "coverage_request_id": r[0],
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
                "is_targeted": r[12],
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

@router.get("/coverage-requests-admin")
def get_all_requests(company_id: int | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        params = []

        where_company = ""
        if company_id:
            where_company = "AND cr.company_id = %s"
            params.append(company_id)

        cursor.execute(f"""
            SELECT
                cr.coverage_request_id,
                cr.schedule_id,
                cr.requested_by,
                requester.full_name,
                a.account_name,
                s.shift_date,
                st.shift_name,
                r.role_key,
                cr.reason,
                cr.status,
                cr.request_type,
                cr.created_at
            FROM coverage_requests cr
            JOIN employees requester
                ON cr.requested_by = requester.employee_id
                AND cr.company_id = requester.company_id
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id
            JOIN roles r
                ON gs.role_id = r.role_id
                AND gs.company_id = r.company_id
            WHERE cr.is_archived = FALSE
            AND gs.is_archived = FALSE
            {where_company}
            ORDER BY cr.created_at DESC
        """, tuple(params))

        rows = cursor.fetchall()

        return [
            {
                "id": r[0],
                "coverage_request_id": r[0],
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
                "is_targeted": False,
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/{id}/approve")
def approve_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT requested_by, company_id
            FROM coverage_requests
            WHERE coverage_request_id = %s
            AND is_archived = FALSE
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Request not found"
            )

        requester_id = request[0]
        company_id = request[1]

        cursor.execute("""
            UPDATE coverage_requests
            SET
                status = 'approved',
                approved_at = NOW(),
                updated_at = NOW()
            WHERE coverage_request_id = %s
            AND company_id = %s
        """, (
            id,
            company_id
        ))

        create_notification(
            cursor,
            requester_id,
            "Cover Request Approved",
            "Your cover request was approved.",
            "cover",
            company_id=company_id,
            related_id=id
        )

        conn.commit()

        return {
            "message": "Approved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("APPROVE COVER REQUEST ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/{id}/deny")
def deny_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT requested_by, company_id
            FROM coverage_requests
            WHERE coverage_request_id = %s
            AND is_archived = FALSE
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Request not found"
            )

        requester_id = request[0]
        company_id = request[1]

        cursor.execute("""
            UPDATE coverage_requests
            SET
                status = 'denied',
                updated_at = NOW()
            WHERE coverage_request_id = %s
            AND company_id = %s
        """, (
            id,
            company_id
        ))

        create_notification(
            cursor,
            requester_id,
            "Cover Request Denied",
            "Your cover request was denied.",
            "cover",
            company_id=company_id,
            related_id=id
        )

        conn.commit()

        return {
            "message": "Denied"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DENY COVER REQUEST ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
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

        cursor.execute("""
            SELECT
                cr.coverage_request_id,
                cr.schedule_id,
                cr.requested_by,
                cr.request_type,
                cr.company_id,
                s.shift_date,
                st.start_time
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            WHERE cr.coverage_request_id = %s
            AND cr.status = 'pending'
            AND cr.is_archived = FALSE
            AND gs.is_archived = FALSE
        """, (id,))

        request = cursor.fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Cover request not found"
            )

        coverage_request_id = request[0]
        schedule_id = request[1]
        requested_by = request[2]
        request_type = request[3]
        company_id = request[4]
        shift_date = request[5]
        shift_start = request[6]

        if int(employee_id) == int(requested_by):
            raise HTTPException(
                status_code=400,
                detail="You cannot cover your own shift"
            )

        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
        """, (
            employee_id,
            company_id
        ))

        applicant = cursor.fetchone()

        if not applicant:
            raise HTTPException(
                status_code=404,
                detail="Applicant not found"
            )

        cursor.execute("""
            SELECT shift_application_id
            FROM shift_applications
            WHERE coverage_request_id = %s
            AND applicant_id = %s
            AND company_id = %s
            AND is_archived = FALSE
        """, (
            coverage_request_id,
            employee_id,
            company_id
        ))


        existing = cursor.fetchone()

        if existing:
            return {
                "message": "Already applied",
                "shift_application_id": existing[0]
            }

        shift_datetime = datetime.combine(
            shift_date,
            shift_start
        )

        diff_hours = (
            shift_datetime - datetime.now()
        ).total_seconds() / 3600

        if request_type == "normal" and diff_hours > 12:
            cursor.execute("""
                INSERT INTO shift_applications (
                    coverage_request_id,
                    applicant_id,
                    reason,
                    status,
                    company_id
                )
                VALUES (%s, %s, %s, 'pending', %s)
                RETURNING shift_application_id
            """, (
                coverage_request_id,
                employee_id,
                reason,
                company_id
            ))

            application_id = cursor.fetchone()[0]

            create_notification(
                cursor,
                requested_by,
                "New Cover Applicant",
                "Someone applied to cover your shift.",
                "cover",
                company_id=company_id,
                sender_employee_id=employee_id,
                related_id=coverage_request_id
            )

            conn.commit()

            return {
                "message": "Application submitted",
                "shift_application_id": application_id
            }

        cursor.execute("""
            UPDATE generated_schedule
            SET employee_id = %s
            WHERE schedule_id = %s
            AND company_id = %s
            AND is_archived = FALSE
        """, (
            employee_id,
            schedule_id,
            company_id
        ))

        record_absence_from_filled_cover(
            cursor,
            requested_by,
            schedule_id,
            company_id
        )

        cursor.execute("""
            UPDATE coverage_requests
            SET
                status = 'approved',
                accepted_by = %s,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE coverage_request_id = %s
            AND company_id = %s
        """, (
            employee_id,
            coverage_request_id,
            company_id
        ))

        cursor.execute("""
            INSERT INTO shift_applications (
                coverage_request_id,
                applicant_id,
                reason,
                status,
                company_id
            )
            VALUES (%s, %s, %s, 'approved', %s)
            RETURNING shift_application_id
        """, (
            coverage_request_id,
            employee_id,
            reason,
            company_id
        ))

        application_id = cursor.fetchone()[0]

        create_notification(
            cursor,
            requested_by,
            "Cover Request Filled",
            "Someone accepted your cover request.",
            "cover",
            company_id=company_id,
            sender_employee_id=employee_id,
            related_id=coverage_request_id
        )

        create_notification(
            cursor,
            employee_id,
            "Cover Shift Assigned",
            "You are now assigned to cover the shift.",
            "cover",
            company_id=company_id,
            related_id=coverage_request_id
        )

        conn.commit()

        return {
            "message": "Shift automatically transferred",
            "shift_application_id": application_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("APPLY FOR COVER ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/coverage-requests/process-automatic")
def process_automatic_cover_requests(company_id: int | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if company_id:
            cursor.execute("""
                SELECT absence_replacement_mode
                FROM company_settings
                WHERE company_id = %s
                LIMIT 1
            """, (company_id,))
        else:
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

        params = []
        company_filter = ""

        if company_id:
            company_filter = "AND cr.company_id = %s"
            params.append(company_id)

        cursor.execute(f"""
            SELECT
                cr.coverage_request_id
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            WHERE cr.status = 'pending'
            AND cr.is_archived = FALSE
            AND gs.is_archived = FALSE
            AND cr.request_type = 'normal'
            {company_filter}
            AND (
                s.shift_date + st.start_time
            ) <= NOW() + INTERVAL '12 hours'
        """, tuple(params))

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
def get_shift_applications(company_id: int | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        params = []
        company_filter = ""

        if company_id:
            company_filter = "AND sa.company_id = %s"
            params.append(company_id)

        cursor.execute(f"""
            SELECT
                sa.shift_application_id,
                applicant.full_name,
                cr.requested_by,
                a.account_name,
                s.shift_date,
                st.shift_name,
                r.role_key,
                sa.reason,
                sa.status,
                cr.coverage_request_id,
                gs.schedule_id,
                applicant.employee_id
            FROM shift_applications sa
            JOIN employees applicant
                ON sa.applicant_id = applicant.employee_id
                AND sa.company_id = applicant.company_id
            JOIN coverage_requests cr
                ON sa.coverage_request_id = cr.coverage_request_id
                AND sa.company_id = cr.company_id
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            JOIN shift_templates st
                ON s.shift_template_id = st.shift_template_id
                AND s.company_id = st.company_id
            JOIN accounts a
                ON s.account_id = a.account_id
                AND s.company_id = a.company_id
            JOIN roles r
                ON gs.role_id = r.role_id
                AND gs.company_id = r.company_id
            WHERE sa.is_archived = FALSE
            AND gs.is_archived = FALSE
            {company_filter}
            ORDER BY sa.applied_at DESC
        """, tuple(params))

        rows = cursor.fetchall()

        return [
            {
                "id": r[0],
                "shift_application_id": r[0],
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
                "employee_id": r[11],
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

@router.post("/shift-applications/{id}/approve")
def approve_application(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                sa.applicant_id,
                cr.schedule_id,
                cr.coverage_request_id,
                cr.requested_by,
                cr.company_id
            FROM shift_applications sa
            JOIN coverage_requests cr
                ON sa.coverage_request_id = cr.coverage_request_id
                AND sa.company_id = cr.company_id
            WHERE sa.shift_application_id = %s
            AND sa.is_archived = FALSE
            AND cr.is_archived = FALSE
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
        requester_id = app[3]
        company_id = app[4]

        cursor.execute("""
            UPDATE generated_schedule
            SET employee_id = %s
            WHERE schedule_id = %s
            AND company_id = %s
            AND is_archived = FALSE
        """, (
            applicant_id,
            schedule_id,
            company_id
        ))

        record_absence_from_filled_cover(
            cursor,
            requester_id,
            schedule_id,
            company_id
        )

        cursor.execute("""
            UPDATE coverage_requests
            SET
                status = 'approved',
                accepted_by = %s,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE coverage_request_id = %s
            AND company_id = %s
        """, (
            applicant_id,
            coverage_request_id,
            company_id
        ))

        cursor.execute("""
            UPDATE shift_applications
            SET
                status = 'approved',
                updated_at = NOW()
            WHERE shift_application_id = %s
            AND company_id = %s
        """, (
            id,
            company_id
        ))

        cursor.execute("""
            UPDATE shift_applications
            SET
                status = 'denied',
                updated_at = NOW()
            WHERE coverage_request_id = %s
            AND company_id = %s
            AND shift_application_id != %s
            AND status = 'pending'
            AND is_archived = FALSE
        """, (
            coverage_request_id,
            company_id,
            id
        ))

        create_notification(
            cursor,
            requester_id,
            "Cover Request Approved",
            "Your cover request has been filled.",
            "cover",
            company_id=company_id,
            related_id=coverage_request_id
        )

        create_notification(
            cursor,
            applicant_id,
            "Cover Application Approved",
            "You were approved to cover a shift.",
            "cover",
            company_id=company_id,
            related_id=coverage_request_id
        )

        conn.commit()

        return {
            "message": "Application approved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("APPROVE APPLICATION ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/shift-applications/{id}/deny")
def deny_application(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                applicant_id,
                coverage_request_id,
                company_id
            FROM shift_applications
            WHERE shift_application_id = %s
            AND is_archived = FALSE
        """, (id,))

        application = cursor.fetchone()

        if not application:
            raise HTTPException(
                status_code=404,
                detail="Application not found"
            )

        applicant_id = application[0]
        coverage_request_id = application[1]
        company_id = application[2]

        cursor.execute("""
            UPDATE shift_applications
            SET
                status = 'denied',
                updated_at = NOW()
            WHERE shift_application_id = %s
            AND company_id = %s
        """, (
            id,
            company_id
        ))

        create_notification(
            cursor,
            applicant_id,
            "Cover Application Denied",
            "Your cover application was denied.",
            "cover",
            company_id=company_id,
            related_id=coverage_request_id
        )

        conn.commit()

        return {
            "message": "Application denied"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DENY APPLICATION ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
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
    company_id = payload.get("company_id")

    if not company_id:
        raise HTTPException(
            status_code=400,
            detail="company_id is required"
        )

    try:
        # Archive only this company's current active schedule/requests.
        cursor.execute("""
            UPDATE emergency_cover_targets
            SET is_archived = TRUE
            WHERE company_id = %s
        """, (company_id,))

        cursor.execute("""
            UPDATE shift_applications
            SET is_archived = TRUE
            WHERE company_id = %s
        """, (company_id,))

        cursor.execute("""
            UPDATE coverage_requests
            SET is_archived = TRUE
            WHERE company_id = %s
        """, (company_id,))

        cursor.execute("""
            UPDATE generated_schedule
            SET is_archived = TRUE
            WHERE company_id = %s
        """, (company_id,))

        # Allowed counts per actual shift + role_id.
        cursor.execute("""
            SELECT
                s.shift_id,
                r.role_key,
                r.role_id,
                ssr.required_count
            FROM shifts s

            JOIN shift_staffing_requirements ssr
                ON s.shift_template_id = ssr.shift_template_id
                AND s.account_id = ssr.account_id
                AND s.company_id = ssr.company_id

            JOIN roles r
                ON ssr.role_id = r.role_id
                AND ssr.company_id = r.company_id

            WHERE s.company_id = %s
            AND ssr.company_id = %s
            AND ssr.is_active = TRUE
            AND r.is_active = TRUE
        """, (company_id, company_id))

        allowed_counts = {}
        role_id_map = {}

        for shift_id, role_key, role_id, required_count in cursor.fetchall():
            normalized_role = role_key.lower().replace(" ", "_")

            allowed_counts[(shift_id, normalized_role)] = required_count
            role_id_map[(shift_id, normalized_role)] = role_id

        grouped = {}

        for assignment in assignments:
            shift_id = assignment.get("shift_id")
            role = str(assignment.get("role", "")).lower().replace(" ", "_")

            if not shift_id or not role:
                continue

            key = (shift_id, role)

            if key not in grouped:
                grouped[key] = []

            grouped[key].append(assignment)

        for key, items in grouped.items():
            shift_id, role = key

            required_count = allowed_counts.get(key, 0)
            role_id = role_id_map.get(key)

            if required_count <= 0 or not role_id:
                continue

            items = sorted(
                items,
                key=lambda item: item.get("slot_index", 0)
            )

            # Save only up to the required count.
            for slot_index, assignment in enumerate(items[:required_count]):
                employee_id = assignment.get("employee_id")

                cursor.execute("""
                    INSERT INTO generated_schedule (
                        shift_id,
                        employee_id,
                        role_id,
                        slot_index,
                        is_archived,
                        company_id
                    )
                    VALUES (%s, %s, %s, %s, FALSE, %s)
                """, (
                    shift_id,
                    employee_id,
                    role_id,
                    assignment.get("slot_index", slot_index),
                    company_id
                ))

        # Notify only employees from this company.
        if saved_by:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND employment_status = 'Active'
                AND employee_id != %s
            """, (company_id, saved_by))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND employment_status = 'Active'
            """, (company_id,))

        employees = cursor.fetchall()

        for employee in employees:
            create_notification(
                cursor,
                employee[0],
                "New Schedule Published",
                "A new schedule has been published.",
                "schedule",
                company_id=company_id,
                sender_employee_id=saved_by
            )

        conn.commit()

        return {
            "message": "Schedule saved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("SAVE SCHEDULE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
#---------------------------------------------
# backend/routes/reports.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from datetime import date, timedelta
import math

router = APIRouter()


def get_period_bounds(period: str):
    today = date.today()

    if period == "this-week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)

    elif period == "next-week":
        this_week_start = today - timedelta(days=today.weekday())
        start = this_week_start + timedelta(days=7)
        end = start + timedelta(days=6)

    elif period == "this-month":
        start = today.replace(day=1)

        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)

        end = next_month - timedelta(days=1)

    elif period == "last-month":
        first_this_month = today.replace(day=1)
        end = first_this_month - timedelta(days=1)
        start = end.replace(day=1)

    elif period == "last-3-months":
        end = today
        start = today - timedelta(days=90)

    elif period == "this-year":
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)

    else:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)

    return start, end


def get_weeks_in_period(start: date, end: date):
    days = (end - start).days + 1
    return max(1, math.ceil(days / 7))


@router.get("/reports/general")
def get_general_report(company_id: int, period: str = "this-week"):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        start, end = get_period_bounds(period)

        # Schedule workload:
        # - generated_schedule = current/upcoming active schedules
        # - assignments = completed/finalized schedules
        cursor.execute("""
            WITH params AS (
                SELECT
                    %s::int AS company_id,
                    %s::date AS start_date,
                    %s::date AS end_date
            ),

            active_schedule AS (
                SELECT DISTINCT ON (
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index
                )
                    gs.employee_id,
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id
                FROM generated_schedule gs
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE gs.company_id = p.company_id
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
                ORDER BY
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at DESC
            ),

            completed_schedule AS (
                SELECT
                    ass.employee_id,
                    ass.company_id,
                    ass.shift_id,
                    ass.role_id
                FROM assignments ass
                JOIN shifts s
                    ON ass.shift_id = s.shift_id
                    AND ass.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE ass.company_id = p.company_id
                AND s.shift_date BETWEEN p.start_date AND p.end_date
                AND ass.employee_id IS NOT NULL
                AND LOWER(COALESCE(ass.status, '')) IN (
                    'completed',
                    'worked',
                    'approved'
                )
            ),

            report_schedule AS (
                SELECT * FROM active_schedule
                UNION ALL
                SELECT * FROM completed_schedule
            )

            SELECT
                COUNT(*) AS total_shifts,
                COUNT(employee_id) AS filled_shifts
            FROM report_schedule
        """, (
            company_id,
            start,
            end
        ))

        schedule_row = cursor.fetchone()
        total_shifts = schedule_row[0] or 0
        filled_shifts = schedule_row[1] or 0
        vacant_shifts = total_shifts - filled_shifts

        cursor.execute("""
            SELECT COUNT(*)
            FROM absences
            WHERE company_id = %s
            AND status = 'approved'
            AND date BETWEEN %s AND %s
        """, (company_id, start, end))
        total_absences = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COALESCE(absence_tolerance, 0)
            FROM company_settings
            WHERE company_id = %s
            LIMIT 1
        """, (company_id,))

        absence_limit_row = cursor.fetchone()

        max_absences_per_month = (
            int(absence_limit_row[0] or 0)
            if absence_limit_row
            else 0
        )

        cursor.execute("""
            WITH employee_absences AS (
                SELECT
                    e.employee_id,
                    COUNT(ab.absence_id) AS absence_count
                FROM employees e
                LEFT JOIN absences ab
                    ON ab.employee_id = e.employee_id
                    AND ab.company_id = e.company_id
                    AND ab.status = 'approved'
                    AND ab.date BETWEEN %s AND %s
                WHERE e.company_id = %s
                AND e.employment_status = 'Active'
                GROUP BY e.employee_id
            )

            SELECT
                COUNT(*) AS active_employee_count,
                COUNT(*) FILTER (
                    WHERE absence_count > %s
                ) AS employees_over_absence_limit
            FROM employee_absences
        """, (
            start,
            end,
            company_id,
            max_absences_per_month
        ))

        absence_limit_summary = cursor.fetchone()

        active_employee_count = absence_limit_summary[0] or 0
        employees_over_absence_limit = absence_limit_summary[1] or 0

        cursor.execute("""
            SELECT COUNT(DISTINCT request_id)
            FROM leaves
            WHERE company_id = %s
            AND date BETWEEN %s AND %s
        """, (company_id, start, end))
        total_leave_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(DISTINCT request_id)
            FROM leaves
            WHERE company_id = %s
            AND status = 'approved'
            AND date BETWEEN %s AND %s
        """, (company_id, start, end))
        approved_leave_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(DISTINCT request_id)
            FROM leaves
            WHERE company_id = %s
            AND status = 'pending'
            AND date BETWEEN %s AND %s
        """, (company_id, start, end))
        pending_leave_requests = cursor.fetchone()[0] or 0

        # Cover request stats:
        # - live_coverage = active cover requests still in coverage_requests
        # - history_coverage = finalized/deleted cover requests copied to coverage_request_history
        cursor.execute("""
            WITH params AS (
                SELECT
                    %s::int AS company_id,
                    %s::date AS start_date,
                    %s::date AS end_date
            ),

            live_coverage AS (
                SELECT
                    cr.coverage_request_id,
                    cr.status,
                    cr.request_type
                FROM coverage_requests cr
                JOIN generated_schedule gs
                    ON cr.schedule_id = gs.schedule_id
                    AND cr.company_id = gs.company_id
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE cr.company_id = p.company_id
                AND cr.is_archived = FALSE
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
            ),

            history_coverage AS (
                SELECT
                    crh.coverage_request_id,
                    crh.status,
                    crh.request_type
                FROM coverage_request_history crh
                JOIN params p
                    ON TRUE
                WHERE crh.company_id = p.company_id
                AND crh.shift_date BETWEEN p.start_date AND p.end_date
                AND NOT EXISTS (
                    SELECT 1
                    FROM coverage_requests live_cr
                    WHERE live_cr.company_id = crh.company_id
                    AND live_cr.coverage_request_id = crh.coverage_request_id
                )
            ),

            report_coverage AS (
                SELECT * FROM live_coverage
                UNION ALL
                SELECT * FROM history_coverage
            )

            SELECT
                COUNT(*) AS total_coverage_requests,
                COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(status, '')) = 'approved'
                ) AS approved_coverage_requests,
                COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(status, '')) = 'pending'
                ) AS pending_coverage_requests,
                COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(status, '')) = 'denied'
                ) AS denied_coverage_requests
            FROM report_coverage
        """, (
            company_id,
            start,
            end
        ))

        coverage_row = cursor.fetchone()
        total_coverage_requests = coverage_row[0] or 0
        approved_coverage_requests = coverage_row[1] or 0
        pending_coverage_requests = coverage_row[2] or 0
        denied_coverage_requests = coverage_row[3] or 0

        # Cover application stats:
        # - live_applications = active rows still in shift_applications
        # - history_applications = finalized/deleted rows copied to shift_application_history
        cursor.execute("""
            WITH params AS (
                SELECT
                    %s::int AS company_id,
                    %s::date AS start_date,
                    %s::date AS end_date
            ),

            live_applications AS (
                SELECT
                    sa.shift_application_id,
                    sa.status
                FROM shift_applications sa
                JOIN coverage_requests cr
                    ON sa.coverage_request_id = cr.coverage_request_id
                    AND sa.company_id = cr.company_id
                JOIN generated_schedule gs
                    ON cr.schedule_id = gs.schedule_id
                    AND cr.company_id = gs.company_id
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE sa.company_id = p.company_id
                AND sa.is_archived = FALSE
                AND cr.is_archived = FALSE
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
            ),

            history_applications AS (
                SELECT
                    sah.shift_application_id,
                    sah.status
                FROM shift_application_history sah
                JOIN params p
                    ON TRUE
                WHERE sah.company_id = p.company_id
                AND sah.shift_date BETWEEN p.start_date AND p.end_date
                AND NOT EXISTS (
                    SELECT 1
                    FROM shift_applications live_sa
                    WHERE live_sa.company_id = sah.company_id
                    AND live_sa.shift_application_id = sah.shift_application_id
                )
            ),

            report_applications AS (
                SELECT * FROM live_applications
                UNION ALL
                SELECT * FROM history_applications
            )

            SELECT
                COUNT(*) AS total_cover_applications,
                COUNT(*) FILTER (
                    WHERE LOWER(COALESCE(status, '')) = 'approved'
                ) AS approved_cover_applications
            FROM report_applications
        """, (
            company_id,
            start,
            end
        ))

        application_row = cursor.fetchone()
        total_cover_applications = application_row[0] or 0
        approved_cover_applications = application_row[1] or 0

        return {
            "period": period,
            "start": str(start),
            "end": str(end),
            "isUtilizationApproximate": period not in ("this-week", "next-week"),

            "totalShifts": total_shifts,
            "filledShifts": filled_shifts,
            "vacantShifts": vacant_shifts,

            "totalAbsences": total_absences,
            "maxAbsencesPerMonth": max_absences_per_month,
            "activeEmployeeCount": active_employee_count,
            "employeesOverAbsenceLimit": employees_over_absence_limit,

            "totalLeaveRequests": total_leave_requests,
            "approvedLeaveRequests": approved_leave_requests,
            "pendingLeaveRequests": pending_leave_requests,

            "totalCoverageRequests": total_coverage_requests,
            "approvedCoverageRequests": approved_coverage_requests,
            "pendingCoverageRequests": pending_coverage_requests,
            "deniedCoverageRequests": denied_coverage_requests,

            "totalCoverApplications": total_cover_applications,
            "approvedCoverApplications": approved_cover_applications,
        }

    except Exception as e:
        print("GENERAL REPORT ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()


@router.get("/reports/employees")
def get_employee_report(company_id: int, period: str = "this-week"):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        start, end = get_period_bounds(period)
        weeks_in_period = get_weeks_in_period(start, end)

        cursor.execute("""
            SELECT
                max_shifts_per_week,
                COALESCE(absence_tolerance, 0)
            FROM company_settings
            WHERE company_id = %s
            LIMIT 1
        """, (company_id,))

        settings_row = cursor.fetchone()

        max_shifts_per_week = settings_row[0] if settings_row else 7
        max_absences_per_month = settings_row[1] if settings_row else 0

        if not max_shifts_per_week:
            max_shifts_per_week = 7

        max_absences_per_month = int(max_absences_per_month or 0)

        max_workload = int(max_shifts_per_week) * weeks_in_period

        cursor.execute("""
            WITH params AS (
                SELECT
                    %s::int AS company_id,
                    %s::date AS start_date,
                    %s::date AS end_date
            ),

            active_schedule AS (
                SELECT DISTINCT ON (
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index
                )
                    gs.employee_id,
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id
                FROM generated_schedule gs
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE gs.company_id = p.company_id
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
                ORDER BY
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at DESC
            ),

            completed_schedule AS (
                SELECT
                    ass.employee_id,
                    ass.company_id,
                    ass.shift_id,
                    ass.role_id
                FROM assignments ass
                JOIN shifts s
                    ON ass.shift_id = s.shift_id
                    AND ass.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE ass.company_id = p.company_id
                AND s.shift_date BETWEEN p.start_date AND p.end_date
                AND ass.employee_id IS NOT NULL
                AND LOWER(COALESCE(ass.status, '')) IN (
                    'completed',
                    'worked',
                    'approved'
                )
            ),

            report_schedule AS (
                SELECT * FROM active_schedule
                UNION ALL
                SELECT * FROM completed_schedule
            ),

            assigned_counts AS (
                SELECT
                    employee_id,
                    COUNT(*) AS total_shifts
                FROM report_schedule
                WHERE employee_id IS NOT NULL
                GROUP BY employee_id
            ),

            live_coverage AS (
                SELECT
                    cr.coverage_request_id,
                    cr.requested_by AS employee_id,
                    cr.status
                FROM coverage_requests cr
                JOIN generated_schedule gs
                    ON cr.schedule_id = gs.schedule_id
                    AND cr.company_id = gs.company_id
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE cr.company_id = p.company_id
                AND cr.is_archived = FALSE
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
            ),

            history_coverage AS (
                SELECT
                    crh.coverage_request_id,
                    crh.requested_by AS employee_id,
                    crh.status
                FROM coverage_request_history crh
                JOIN params p
                    ON TRUE
                WHERE crh.company_id = p.company_id
                AND crh.shift_date BETWEEN p.start_date AND p.end_date
                AND NOT EXISTS (
                    SELECT 1
                    FROM coverage_requests live_cr
                    WHERE live_cr.company_id = crh.company_id
                    AND live_cr.coverage_request_id = crh.coverage_request_id
                )
            ),

            report_coverage AS (
                SELECT * FROM live_coverage
                UNION ALL
                SELECT * FROM history_coverage
            ),

            coverage_counts AS (
                SELECT
                    employee_id,
                    COUNT(*) AS coverage_requests,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'approved'
                    ) AS approved_coverage_requests,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'pending'
                    ) AS pending_coverage_requests,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'denied'
                    ) AS denied_coverage_requests
                FROM report_coverage
                WHERE employee_id IS NOT NULL
                GROUP BY employee_id
            ),

            live_applications AS (
                SELECT
                    sa.shift_application_id,
                    sa.applicant_id AS employee_id,
                    sa.status
                FROM shift_applications sa
                JOIN coverage_requests cr
                    ON sa.coverage_request_id = cr.coverage_request_id
                    AND sa.company_id = cr.company_id
                JOIN generated_schedule gs
                    ON cr.schedule_id = gs.schedule_id
                    AND cr.company_id = gs.company_id
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                JOIN params p
                    ON TRUE
                WHERE sa.company_id = p.company_id
                AND sa.is_archived = FALSE
                AND cr.is_archived = FALSE
                AND gs.is_archived = FALSE
                AND s.shift_date BETWEEN p.start_date AND p.end_date
            ),

            history_applications AS (
                SELECT
                    sah.shift_application_id,
                    sah.applicant_id AS employee_id,
                    sah.status
                FROM shift_application_history sah
                JOIN params p
                    ON TRUE
                WHERE sah.company_id = p.company_id
                AND sah.shift_date BETWEEN p.start_date AND p.end_date
                AND NOT EXISTS (
                    SELECT 1
                    FROM shift_applications live_sa
                    WHERE live_sa.company_id = sah.company_id
                    AND live_sa.shift_application_id = sah.shift_application_id
                )
            ),

            report_applications AS (
                SELECT * FROM live_applications
                UNION ALL
                SELECT * FROM history_applications
            ),

            application_counts AS (
                SELECT
                    employee_id,
                    COUNT(*) AS cover_applications,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'approved'
                    ) AS approved_cover_applications,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'pending'
                    ) AS pending_cover_applications,
                    COUNT(*) FILTER (
                        WHERE LOWER(COALESCE(status, '')) = 'denied'
                    ) AS denied_cover_applications
                FROM report_applications
                WHERE employee_id IS NOT NULL
                GROUP BY employee_id
            ),

            absence_counts AS (
                SELECT
                    ab.employee_id,
                    COUNT(*) AS absences
                FROM absences ab
                JOIN params p
                    ON TRUE
                WHERE ab.company_id = p.company_id
                AND ab.status = 'approved'
                AND ab.date BETWEEN p.start_date AND p.end_date
                GROUP BY ab.employee_id
            ),

            leave_counts AS (
                SELECT
                    lv.employee_id,
                    COUNT(DISTINCT lv.request_id) AS leave_requests
                FROM leaves lv
                JOIN params p
                    ON TRUE
                WHERE lv.company_id = p.company_id
                AND lv.date BETWEEN p.start_date AND p.end_date
                GROUP BY lv.employee_id
            )

            SELECT
                e.employee_id,
                e.full_name,

                COALESCE(ac.total_shifts, 0) AS total_shifts,

                COALESCE(cc.coverage_requests, 0) AS coverage_requests,
                COALESCE(cc.approved_coverage_requests, 0) AS approved_coverage_requests,
                COALESCE(cc.pending_coverage_requests, 0) AS pending_coverage_requests,
                COALESCE(cc.denied_coverage_requests, 0) AS denied_coverage_requests,

                COALESCE(app.cover_applications, 0) AS cover_applications,
                COALESCE(app.approved_cover_applications, 0) AS approved_cover_applications,
                COALESCE(app.pending_cover_applications, 0) AS pending_cover_applications,
                COALESCE(app.denied_cover_applications, 0) AS denied_cover_applications,

                COALESCE(abs.absences, 0) AS absences,
                COALESCE(lv.leave_requests, 0) AS leave_requests

            FROM employees e
            JOIN params p
                ON TRUE

            LEFT JOIN assigned_counts ac
                ON e.employee_id = ac.employee_id

            LEFT JOIN coverage_counts cc
                ON e.employee_id = cc.employee_id

            LEFT JOIN application_counts app
                ON e.employee_id = app.employee_id

            LEFT JOIN absence_counts abs
                ON e.employee_id = abs.employee_id

            LEFT JOIN leave_counts lv
                ON e.employee_id = lv.employee_id

            WHERE e.company_id = p.company_id
            AND e.employment_status = 'Active'

            ORDER BY e.full_name ASC
        """, (
            company_id,
            start,
            end
        ))

        rows = cursor.fetchall()

        employees = []

        for row in rows:
            employee_id = row[0]
            name = row[1]
            total_shifts = row[2] or 0

            utilization = 0

            if max_workload > 0:
                utilization = round(
                    (total_shifts / max_workload) * 100,
                    1
                )

            absences = row[11] or 0

            if max_absences_per_month <= 0:
                absence_status = "No Limit"
            elif absences > max_absences_per_month:
                absence_status = "Exceeded"
            elif absences == max_absences_per_month:
                absence_status = "At Limit"
            else:
                absence_status = "OK"

            employees.append({
                "employee_id": employee_id,
                "name": name,

                "totalShifts": total_shifts,
                "maxWorkload": max_workload,
                "assignedWorkload": total_shifts,
                "utilization": utilization,
                "isUtilizationApproximate": period not in ("this-week", "next-week"),

                "coverageRequests": row[3] or 0,
                "approvedCoverageRequests": row[4] or 0,
                "pendingCoverageRequests": row[5] or 0,
                "deniedCoverageRequests": row[6] or 0,

                "coverApplications": row[7] or 0,
                "approvedCoverApplications": row[8] or 0,
                "pendingCoverApplications": row[9] or 0,
                "deniedCoverApplications": row[10] or 0,

                "absences": absences,
                "maxAbsencesPerMonth": max_absences_per_month,
                "absenceStatus": absence_status,
                "isAbsenceLimitExceeded": (
                    max_absences_per_month > 0
                    and absences > max_absences_per_month
                ),

                "leaves": row[12] or 0,
            })

        return {
            "period": period,
            "start": str(start),
            "end": str(end),
            "maxShiftsPerWeekUsed": max_shifts_per_week,
            "maxAbsencesPerMonth": max_absences_per_month,
            "weeksInPeriod": weeks_in_period,
            "maxWorkload": max_workload,
            "isUtilizationApproximate": period not in ("this-week", "next-week"),
            "employees": employees,
        }

    except Exception as e:
        print("EMPLOYEE REPORT ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
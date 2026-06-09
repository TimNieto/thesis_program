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

        cursor.execute("""
            WITH latest_schedule AS (
                SELECT DISTINCT ON (
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index
                )
                    gs.schedule_id,
                    gs.employee_id,
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at
                FROM generated_schedule gs
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                WHERE gs.company_id = %s
                AND s.shift_date BETWEEN %s AND %s
                ORDER BY
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at DESC
            )
            SELECT
                COUNT(*) AS total_shifts,
                COUNT(employee_id) AS filled_shifts
            FROM latest_schedule
        """, (company_id, start, end))

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

        cursor.execute("""
            SELECT COUNT(*)
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE cr.company_id = %s
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        total_coverage_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE cr.company_id = %s
            AND cr.status = 'approved'
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        approved_coverage_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE cr.company_id = %s
            AND cr.status = 'pending'
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        pending_coverage_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
            FROM coverage_requests cr
            JOIN generated_schedule gs
                ON cr.schedule_id = gs.schedule_id
                AND cr.company_id = gs.company_id
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE cr.company_id = %s
            AND cr.status = 'denied'
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        denied_coverage_requests = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
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
            WHERE sa.company_id = %s
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        total_cover_applications = cursor.fetchone()[0] or 0

        cursor.execute("""
            SELECT COUNT(*)
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
            WHERE sa.company_id = %s
            AND sa.status = 'approved'
            AND s.shift_date BETWEEN %s AND %s
        """, (company_id, start, end))
        approved_cover_applications = cursor.fetchone()[0] or 0

        return {
            "period": period,
            "start": str(start),
            "end": str(end),
            "isUtilizationApproximate": period != "this-week",

            "totalShifts": total_shifts,
            "filledShifts": filled_shifts,
            "vacantShifts": vacant_shifts,

            "totalAbsences": total_absences,

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
            SELECT max_shifts_per_week
            FROM company_settings
            WHERE company_id = %s
            LIMIT 1
        """, (company_id,))

        settings_row = cursor.fetchone()
        max_shifts_per_week = settings_row[0] if settings_row else 7

        if not max_shifts_per_week:
            max_shifts_per_week = 7

        max_workload = int(max_shifts_per_week) * weeks_in_period

        cursor.execute("""
            WITH latest_schedule AS (
                SELECT DISTINCT ON (
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index
                )
                    gs.schedule_id,
                    gs.employee_id,
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at
                FROM generated_schedule gs
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                WHERE gs.company_id = %s
                AND s.shift_date BETWEEN %s AND %s
                ORDER BY
                    gs.company_id,
                    gs.shift_id,
                    gs.role_id,
                    gs.slot_index,
                    gs.created_at DESC
            ),

            assigned_counts AS (
                SELECT
                    employee_id,
                    COUNT(*) AS total_shifts
                FROM latest_schedule
                WHERE employee_id IS NOT NULL
                GROUP BY employee_id
            ),

            coverage_counts AS (
                SELECT
                    cr.requested_by AS employee_id,
                    COUNT(*) AS coverage_requests,
                    COUNT(*) FILTER (WHERE cr.status = 'approved') AS approved_coverage_requests,
                    COUNT(*) FILTER (WHERE cr.status = 'pending') AS pending_coverage_requests,
                    COUNT(*) FILTER (WHERE cr.status = 'denied') AS denied_coverage_requests
                FROM coverage_requests cr
                JOIN generated_schedule gs
                    ON cr.schedule_id = gs.schedule_id
                    AND cr.company_id = gs.company_id
                JOIN shifts s
                    ON gs.shift_id = s.shift_id
                    AND gs.company_id = s.company_id
                WHERE cr.company_id = %s
                AND s.shift_date BETWEEN %s AND %s
                GROUP BY cr.requested_by
            ),

            application_counts AS (
                SELECT
                    sa.applicant_id AS employee_id,
                    COUNT(*) AS cover_applications,
                    COUNT(*) FILTER (WHERE sa.status = 'approved') AS approved_cover_applications,
                    COUNT(*) FILTER (WHERE sa.status = 'pending') AS pending_cover_applications,
                    COUNT(*) FILTER (WHERE sa.status = 'denied') AS denied_cover_applications
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
                WHERE sa.company_id = %s
                AND s.shift_date BETWEEN %s AND %s
                GROUP BY sa.applicant_id
            ),

            absence_counts AS (
                SELECT
                    employee_id,
                    COUNT(*) AS absences
                FROM absences
                WHERE company_id = %s
                AND status = 'approved'
                AND date BETWEEN %s AND %s
                GROUP BY employee_id
            ),

            leave_counts AS (
                SELECT
                    employee_id,
                    COUNT(DISTINCT request_id) AS leave_requests
                FROM leaves
                WHERE company_id = %s
                AND date BETWEEN %s AND %s
                GROUP BY employee_id
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

            WHERE e.company_id = %s
            AND e.employment_status = 'Active'

            ORDER BY e.full_name ASC
        """, (
            company_id, start, end,

            company_id, start, end,

            company_id, start, end,

            company_id, start, end,

            company_id, start, end,

            company_id
        ))

        rows = cursor.fetchall()

        employees = []

        for row in rows:
            employee_id = row[0]
            name = row[1]
            total_shifts = row[2] or 0

            utilization = 0
            if max_workload > 0:
                utilization = round((total_shifts / max_workload) * 100, 1)

            employees.append({
                "employee_id": employee_id,
                "name": name,

                "totalShifts": total_shifts,
                "maxWorkload": max_workload,
                "assignedWorkload": total_shifts,
                "utilization": utilization,
                "isUtilizationApproximate": period != "this-week",

                "coverageRequests": row[3] or 0,
                "approvedCoverageRequests": row[4] or 0,
                "pendingCoverageRequests": row[5] or 0,
                "deniedCoverageRequests": row[6] or 0,

                "coverApplications": row[7] or 0,
                "approvedCoverApplications": row[8] or 0,
                "pendingCoverApplications": row[9] or 0,
                "deniedCoverApplications": row[10] or 0,

                "absences": row[11] or 0,
                "leaves": row[12] or 0,
            })

        return {
            "period": period,
            "start": str(start),
            "end": str(end),
            "maxShiftsPerWeekUsed": max_shifts_per_week,
            "weeksInPeriod": weeks_in_period,
            "maxWorkload": max_workload,
            "isUtilizationApproximate": period != "this-week",
            "employees": employees,
        }

    except Exception as e:
        print("EMPLOYEE REPORT ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
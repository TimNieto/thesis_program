#---------------------------------------------
# backend/routes/settings.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from services.notification_service import create_notification

router = APIRouter()

def require_company_admin(cursor, company_id: int, employee_id: int):
    if not employee_id:
        raise HTTPException(
            status_code=403,
            detail="Only company admin can update company settings"
        )

    cursor.execute("""
        SELECT 1
        FROM employees e
        JOIN employee_roles er
            ON e.employee_id = er.employee_id
            AND e.company_id = er.company_id
        JOIN roles r
            ON er.role_id = r.role_id
            AND er.company_id = r.company_id
        WHERE e.employee_id = %s
        AND e.company_id = %s
        AND e.employment_status = 'Active'
        AND er.is_active = TRUE
        AND r.is_active = TRUE
        AND r.is_admin = TRUE
        LIMIT 1
    """, (
        employee_id,
        company_id
    ))

    if not cursor.fetchone():
        raise HTTPException(
            status_code=403,
            detail="Only company admin can update company settings"
        )
    

@router.get("/settings")
def get_settings(company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                c.company_name,
                c.company_type,
                cs.max_working_days,
                cs.min_rest_period_hours,
                cs.max_daily_work_hours,
                cs.max_shifts_per_day,
                cs.max_shifts_per_week,
                cs.allow_double_shifts,
                cs.fairness_weight,
                cs.absence_replacement_mode,
                cs.enable_in_app_notifications,
                cs.gy_fatigue_penalty,
                cs.absence_tolerance,
                cs.max_absences_per_month
            FROM company_settings cs
            JOIN companies c
                ON cs.company_id = c.company_id
            WHERE cs.company_id = %s
            LIMIT 1
        """, (company_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Settings not found for this company"
            )

        return {
            "company_name": row[0],
            "company_type": row[1],
            "max_working_days": row[2],
            "min_rest_period_hours": row[3],
            "max_daily_work_hours": row[4],
            "max_shifts_per_day": row[5],
            "max_shifts_per_week": row[6],
            "allow_double_shifts": row[7],
            "fairness_weight": row[8],
            "absence_replacement_mode": row[9],
            "enable_in_app_notifications": row[10],
            "gy_fatigue_penalty": row[11],
            "absence_tolerance": row[12],
            "max_absences_per_month": row[13],
            "company_id": company_id
        }

    finally:
        cursor.close()
        conn.close()


@router.put("/settings")
def update_settings(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:

        company_id = payload.get("company_id")
        updated_by = payload.get("updated_by")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        require_company_admin(
            cursor,
            company_id,
            updated_by
        )

        gy_fatigue_penalty = payload.get("gy_fatigue_penalty", 20)

        try:
            gy_fatigue_penalty = int(gy_fatigue_penalty)
        except (TypeError, ValueError):
            gy_fatigue_penalty = 20

        gy_fatigue_penalty = max(0, min(100, gy_fatigue_penalty))

        absence_tolerance = payload.get("absence_tolerance", 50)

        try:
            absence_tolerance = int(absence_tolerance)
        except (TypeError, ValueError):
            absence_tolerance = 50

        absence_tolerance = max(0, min(100, absence_tolerance))

        max_absences_per_month = payload.get("max_absences_per_month", 3)

        try:
            max_absences_per_month = int(max_absences_per_month)
        except (TypeError, ValueError):
            max_absences_per_month = 3

        max_absences_per_month = max(0, min(31, max_absences_per_month))

        min_rest_period_hours = payload.get("min_rest_period_hours", 8)

        try:
            min_rest_period_hours = int(min_rest_period_hours)
        except (TypeError, ValueError):
            min_rest_period_hours = 8

        min_rest_period_hours = max(0, min(24, min_rest_period_hours))

        max_daily_work_hours = payload.get("max_daily_work_hours", 24)

        try:
            max_daily_work_hours = int(max_daily_work_hours)
        except (TypeError, ValueError):
            max_daily_work_hours = 24

        max_daily_work_hours = max(0, min(48, max_daily_work_hours))

        company_type = str(payload.get("company_type", "")).strip()

        if not company_type:
            raise HTTPException(
                status_code=400,
                detail="company_type is required"
            )

        cursor.execute("""
            UPDATE companies
            SET
                company_name = %s,
                company_type = %s,
                updated_at = NOW()
            WHERE company_id = %s
        """, (
            payload["company_name"],
            company_type,
            company_id
        ))

        cursor.execute("""
            UPDATE company_settings
            SET
                max_working_days = %s,
                min_rest_period_hours = %s,
                max_daily_work_hours = %s,
                max_shifts_per_day = %s,
                max_shifts_per_week = %s,
                allow_double_shifts = %s,
                fairness_weight = %s,
                absence_replacement_mode = %s,
                enable_in_app_notifications = %s,
                gy_fatigue_penalty = %s,
                absence_tolerance = %s,
                max_absences_per_month = %s,
                updated_at = NOW()
            WHERE company_id = %s
        """, (
            payload["max_working_days"],
            min_rest_period_hours,
            max_daily_work_hours,
            payload["max_shifts_per_day"],
            payload["max_shifts_per_week"],
            payload["allow_double_shifts"],
            payload["fairness_weight"],
            payload["absence_replacement_mode"],
            payload.get("enable_in_app_notifications", True),
            gy_fatigue_penalty,
            absence_tolerance,
            max_absences_per_month,
            company_id
        ))

        if updated_by:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND employment_status = 'Active'
                AND employee_id != %s
            """, (company_id, updated_by))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND employment_status = 'Active'
            """, (company_id,))

        employees = cursor.fetchall()

        for emp in employees:
            create_notification(
                cursor,
                emp[0],
                "Company Settings Updated",
                "Company settings were updated.",
                "settings"
            )

        conn.commit()

        return {
            "status": "success",
            "message": "Company settings updated"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("UPDATE SETTINGS ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
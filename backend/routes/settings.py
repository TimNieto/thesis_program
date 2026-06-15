#---------------------------------------------
# backend/routes/settings.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from services.notification_service import create_notification

router = APIRouter()


@router.get("/settings")
def get_settings(company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                c.company_name,
                cs.max_working_days,
                cs.max_shifts_per_day,
                cs.max_shifts_per_week,
                cs.allow_double_shifts,
                cs.fairness_weight,
                cs.absence_replacement_mode,
                cs.enable_in_app_notifications,
                cs.gy_fatigue_penalty,
                cs.absence_tolerance
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
            "company_type": "Live Selling",
            "max_working_days": row[1],
            "max_shifts_per_day": row[2],
            "max_shifts_per_week": row[3],
            "allow_double_shifts": row[4],
            "fairness_weight": row[5],
            "absence_replacement_mode": row[6],
            "enable_in_app_notifications": row[7],
            "gy_fatigue_penalty": row[8],
            "absence_tolerance": row[9],
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

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
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

        cursor.execute("""
            UPDATE companies
            SET company_name = %s,
                updated_at = NOW()
            WHERE company_id = %s
        """, (
            payload["company_name"],
            company_id
        ))

        cursor.execute("""
            UPDATE company_settings
            SET
                max_working_days = %s,
                max_shifts_per_day = %s,
                max_shifts_per_week = %s,
                allow_double_shifts = %s,
                fairness_weight = %s,
                absence_replacement_mode = %s,
                enable_in_app_notifications = %s,
                gy_fatigue_penalty = %s,
                absence_tolerance = %s,
                updated_at = NOW()
            WHERE company_id = %s
        """, (
            payload["max_working_days"],
            payload["max_shifts_per_day"],
            payload["max_shifts_per_week"],
            payload["allow_double_shifts"],
            payload["fairness_weight"],
            payload["absence_replacement_mode"],
            payload.get("enable_in_app_notifications", True),
            gy_fatigue_penalty,
            absence_tolerance,
            company_id
        ))

        updated_by = payload.get("updated_by")

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
from fastapi import APIRouter
from db.database import get_connection

router = APIRouter()

# -------------------------
# GET SETTINGS
# -------------------------
@router.get("/settings")
def get_settings():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                company_name,
                company_type,
                max_working_days,
                max_shifts_per_day,
                max_shifts_per_week,
                allow_double_shifts,
                fairness_weight,
                gy_shift_penalty,
                absence_replacement_mode
            FROM company_settings
            LIMIT 1
        """)

        row = cursor.fetchone()

        if not row:
            return {"error": "Settings not found"}

        return {
            "company_name": row[0],
            "company_type": row[1],
            "max_working_days": row[2],
            "max_shifts_per_day": row[3],
            "max_shifts_per_week": row[4],
            "allow_double_shifts": row[5],
            "fairness_weight": row[6],
            "gy_shift_penalty": row[7],
            "absence_replacement_mode": row[8]
        }

    finally:
        cursor.close()
        conn.close()


# -------------------------
# UPDATE SETTINGS
# -------------------------
@router.put("/settings")
def update_settings(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE company_settings
            SET
                company_name = %s,
                company_type = %s,
                max_working_days = %s,
                max_shifts_per_day = %s,
                max_shifts_per_week = %s,
                allow_double_shifts = %s,
                fairness_weight = %s,
                gy_shift_penalty = %s,
                absence_replacement_mode = %s,
                updated_at = NOW()
            WHERE settings_id = 1
        """, (
            payload["company_name"],
            payload["company_type"],
            payload["max_working_days"],
            payload["max_shifts_per_day"],
            payload["max_shifts_per_week"],
            payload["allow_double_shifts"],
            payload["fairness_weight"],
            payload["gy_shift_penalty"],
            payload["absence_replacement_mode"]
        ))

        conn.commit()

        return {
            "status": "success"
        }

    finally:
        cursor.close()
        conn.close()
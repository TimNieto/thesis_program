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



@router.get("/account-settings")
def get_account_settings():

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT
                account_setting_id,
                account_name,
                priority_level,
                require_host,
                require_operator,
                allow_partial_staffing
            FROM account_settings
            ORDER BY priority_level
        """)

        rows = cursor.fetchall()

        return [
            {
                "account_setting_id": r[0],
                "account_name": r[1],
                "priority_level": r[2],
                "require_host": r[3],
                "require_operator": r[4],
                "allow_partial_staffing": r[5]
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.put("/account-settings/{account_setting_id}")
def update_account_settings(
    account_setting_id: int,
    payload: dict
):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE account_settings
            SET
                priority_level = %s,
                require_host = %s,
                require_operator = %s,
                allow_partial_staffing = %s,
                updated_at = NOW()
            WHERE account_setting_id = %s
        """, (
            payload["priority_level"],
            payload["require_host"],
            payload["require_operator"],
            payload["allow_partial_staffing"],
            account_setting_id
        ))

        conn.commit()

        return {
            "status": "success"
        }

    finally:
        cursor.close()
        conn.close()
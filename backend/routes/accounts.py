# backend/routes/accounts.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from services.schedule_service import ensure_next_week_shifts

router = APIRouter()

@router.get("/accounts")
def get_accounts():

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
                allow_partial_staffing,
                operator_policy
            FROM account_settings
            WHERE pending_delete = FALSE
            ORDER BY account_setting_id ASC
        """)

        rows = cursor.fetchall()

        return [
            {
                "id": r[0],
                "name": r[1],
                "priority_level": r[2],
                "require_host": r[3],
                "require_operator": r[4],
                "allow_partial_staffing": r[5],
                "operator_policy": r[6]
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/accounts")
def create_account(payload: dict):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        account_name = payload.get(
            "account_name",
            ""
        ).strip()

        if not account_name:

            raise HTTPException(
                status_code=400,
                detail="Account name required"
            )

        cursor.execute("""
            SELECT account_setting_id
            FROM account_settings
            WHERE LOWER(account_name) = LOWER(%s)
        """, (account_name,))

        existing = cursor.fetchone()

        if existing:

            raise HTTPException(
                status_code=400,
                detail="Account already exists"
            )

        priority_level = payload.get(
            "priority_level",
            2
        )

        require_host = payload.get(
            "require_host",
            True
        )

        require_operator = payload.get(
            "require_operator",
            True
        )

        allow_partial_staffing = payload.get(
            "allow_partial_staffing",
            False
        )

        operator_policy = payload.get(
            "operator_policy",
            "required"
        )

        cursor.execute("""
            INSERT INTO account_settings (
                account_name,
                priority_level,
                require_host,
                require_operator,
                allow_partial_staffing,
                operator_policy
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
        """, (
            account_name,
            priority_level,
            require_host,
            require_operator,
            allow_partial_staffing,
            operator_policy
        ))

        ensure_next_week_shifts(cursor)

        conn.commit()

        return {
            "message": "Account created"
        }

    finally:
        cursor.close()
        conn.close()


@router.delete("/accounts/{account_name}")
def delete_account(account_name: str):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE account_settings
            SET
                pending_delete = TRUE,
                updated_at = NOW()
            WHERE LOWER(account_name) = LOWER(%s)
        """, (account_name,))

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Account not found"
            )

        conn.commit()

        return {
            "message": "Account marked for deletion. It will be removed after a new schedule is saved."
        }

    finally:
        cursor.close()
        conn.close()
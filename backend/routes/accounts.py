# backend/routes/accounts.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

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
            ORDER BY priority_level ASC, account_name ASC
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

        # CREATE TEMPLATE SHIFTS
        template_date = "2026-01-01"

        # CREATE DEFAULT SHIFTS FOR ACCOUNT
        cursor.execute("""
            SELECT shift_template_id
            FROM shift_templates
        """)

        templates = cursor.fetchall()

        template_date = "2026-01-01"

        for template in templates:

            template_id = template[0]

            cursor.execute("""
                INSERT INTO shifts (
                    shift_date,
                    account,
                    shift_template_id,
                    required_host_count,
                    required_operator_count
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                ON CONFLICT (
                    shift_date,
                    account,
                    shift_template_id
                )
                DO NOTHING
            """, (
                template_date,
                account_name,
                template_id,
                1 if require_host else 0,
                1 if require_operator else 0
            ))

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

        # PREVENT DELETING ACCOUNTS USED IN SAVED SCHEDULES
        cursor.execute("""
            SELECT gs.schedule_id

            FROM generated_schedule gs

            JOIN shifts s
                ON gs.shift_id = s.shift_id

            WHERE s.account = %s
            AND gs.is_archived = FALSE

            LIMIT 1
        """, (account_name,))

        if cursor.fetchone():

            raise HTTPException(
                status_code=400,
                detail="Cannot remove account with generated schedules"
            )

        # DELETE AVAILABILITY
        cursor.execute("""
            DELETE FROM availability
            WHERE account = %s
        """, (account_name,))

        # DELETE SHIFTS
        cursor.execute("""
            DELETE FROM shifts
            WHERE account = %s
        """, (account_name,))

        # DELETE ACCOUNT
        cursor.execute("""
            DELETE FROM account_settings
            WHERE account_name = %s
        """, (account_name,))

        conn.commit()

        return {
            "message": "Account removed"
        }

    finally:
        cursor.close()
        conn.close()
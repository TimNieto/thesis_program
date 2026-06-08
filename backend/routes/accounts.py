#---------------------------------------------
# backend/routes/accounts.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


@router.get("/account-department-data")
def get_account_department_data(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                d.department_id,
                d.department_name,
                d.is_active AS department_is_active,
                a.account_id,
                a.account_name,
                a.is_active AS account_is_active
            FROM departments d
            LEFT JOIN accounts a
                ON a.department_id = d.department_id
                AND a.company_id = d.company_id
                AND a.is_active = TRUE
            WHERE d.is_active = TRUE
            AND d.company_id = %s
            ORDER BY
                d.department_name ASC,
                a.account_name ASC
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "department_id": r[0],
                "department_name": r[1],
                "department_is_active": r[2],
                "account_id": r[3],
                "account_name": r[4],
                "account_is_active": r[5],
                "status": "Active" if r[2] else "Inactive",
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.get("/accounts")
def get_accounts(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                a.account_id,
                a.account_name,
                a.priority_level,
                a.allow_partial_staffing,
                a.operator_policy,
                d.department_name
            FROM accounts a
            LEFT JOIN departments d
                ON a.department_id = d.department_id
                AND a.company_id = d.company_id
                AND d.is_active = TRUE
            WHERE a.is_active = TRUE
            AND a.company_id = %s
            ORDER BY a.account_id ASC
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "id": r[0],
                "name": r[1],
                "priority_level": r[2],
                "allow_partial_staffing": r[3],
                "operator_policy": r[4],
                "department_name": r[5] or "None",
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
        company_id = payload.get("company_id")
        department_name = payload.get("department_name", "").strip()
        account_name = payload.get("account_name", "").strip()

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="No managed company selected"
            )

        if not department_name:
            raise HTTPException(
                status_code=400,
                detail="Department name is required"
            )

        if not account_name:
            raise HTTPException(
                status_code=400,
                detail="Account name is required"
            )

        priority_level = payload.get("priority_level", 2)
        allow_partial_staffing = payload.get("allow_partial_staffing", False)
        operator_policy = payload.get("operator_policy", "required")

        # Ensure department exists.
        cursor.execute("""
            SELECT department_id
            FROM departments
            WHERE company_id = %s
            AND LOWER(department_name) = LOWER(%s)
            LIMIT 1
        """, (company_id, department_name))

        department_row = cursor.fetchone()

        if department_row:
            department_id = department_row[0]

            cursor.execute("""
                UPDATE departments
                SET is_active = TRUE,
                    updated_at = NOW()
                WHERE department_id = %s
                AND company_id = %s
            """, (department_id, company_id))
        else:
            cursor.execute("""
                INSERT INTO departments (
                    company_id,
                    department_name,
                    is_active
                )
                VALUES (%s, %s, TRUE)
                RETURNING department_id
            """, (company_id, department_name))

            department_id = cursor.fetchone()[0]

        # Check duplicate account under same company.
        cursor.execute("""
            SELECT account_id
            FROM accounts
            WHERE company_id = %s
            AND LOWER(account_name) = LOWER(%s)
            LIMIT 1
        """, (company_id, account_name))

        existing_account = cursor.fetchone()

        if existing_account:
            account_id = existing_account[0]

            cursor.execute("""
                UPDATE accounts
                SET department_id = %s,
                    priority_level = %s,
                    allow_partial_staffing = %s,
                    operator_policy = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE account_id = %s
                AND company_id = %s
            """, (
                department_id,
                priority_level,
                allow_partial_staffing,
                operator_policy,
                account_id,
                company_id,
            ))

            conn.commit()

            return {
                "message": "Account updated",
                "account_id": account_id,
                "department_id": department_id,
            }

        cursor.execute("""
            INSERT INTO accounts (
                company_id,
                department_id,
                account_name,
                priority_level,
                allow_partial_staffing,
                operator_policy,
                is_active
            )
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING account_id
        """, (
            company_id,
            department_id,
            account_name,
            priority_level,
            allow_partial_staffing,
            operator_policy,
        ))

        account_id = cursor.fetchone()[0]

        conn.commit()

        return {
            "message": "Account created",
            "account_id": account_id,
            "department_id": department_id,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as err:
        conn.rollback()
        print("Failed to create account:", err)
        raise HTTPException(
            status_code=500,
            detail="Failed to create account"
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE accounts
            SET is_active = FALSE,
                updated_at = NOW()
            WHERE account_id = %s
        """, (account_id,))

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Account not found"
            )

        conn.commit()

        return {
            "message": "Account deactivated"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as err:
        conn.rollback()
        print("Failed to delete account:", err)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete account"
        )

    finally:
        cursor.close()
        conn.close()
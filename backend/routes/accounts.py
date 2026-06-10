#---------------------------------------------
# backend/routes/accounts.py

import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from db.database import get_connection

router = APIRouter()

def normalize_name(value: str):
    return " ".join(value.strip().split()).title()

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

@router.post("/departments")
def create_department(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        department_name = normalize_name(payload.get("department_name", ""))

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

        cursor.execute("""
            SELECT department_id, is_active
            FROM departments
            WHERE company_id = %s
            AND LOWER(department_name) = LOWER(%s)
            LIMIT 1
        """, (
            company_id,
            department_name
        ))

        department_row = cursor.fetchone()

        if department_row:
            department_id = department_row[0]
            department_is_active = department_row[1]

            cursor.execute("""
                UPDATE departments
                SET department_name = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE department_id = %s
                AND company_id = %s
            """, (
                department_name,
                department_id,
                company_id
            ))

            conn.commit()

            return {
                "message": (
                    "Department already exists"
                    if department_is_active
                    else "Department reactivated"
                ),
                "department_id": department_id
            }

        cursor.execute("""
            INSERT INTO departments (
                company_id,
                department_name,
                is_active
            )
            VALUES (%s, %s, TRUE)
            RETURNING department_id
        """, (
            company_id,
            department_name
        ))

        department_id = cursor.fetchone()[0]

        conn.commit()

        return {
            "message": "Department created",
            "department_id": department_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as err:
        conn.rollback()
        print("Failed to create department:", err)
        raise HTTPException(
            status_code=500,
            detail="Failed to create department"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/accounts")
def create_account(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        department_name = normalize_name(payload.get("department_name", ""))
        account_name = normalize_name(payload.get("account_name", ""))

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
        """, (
            company_id,
            department_name
        ))

        department_row = cursor.fetchone()

        if department_row:
            department_id = department_row[0]

            cursor.execute("""
                UPDATE departments
                SET is_active = TRUE,
                    updated_at = NOW()
                WHERE department_id = %s
                AND company_id = %s
            """, (
                department_id,
                company_id
            ))

        else:
            cursor.execute("""
                INSERT INTO departments (
                    company_id,
                    department_name,
                    is_active
                )
                VALUES (%s, %s, TRUE)
                RETURNING department_id
            """, (
                company_id,
                department_name
            ))

            department_id = cursor.fetchone()[0]

        # Check duplicate account under same company.
        cursor.execute("""
            SELECT account_id, is_active
            FROM accounts
            WHERE company_id = %s
            AND LOWER(account_name) = LOWER(%s)
            LIMIT 1
        """, (
            company_id,
            account_name
        ))

        existing_account = cursor.fetchone()

        if existing_account:
            account_id = existing_account[0]
            account_is_active = existing_account[1]

            if account_is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Account already exists in this company"
                )

            cursor.execute("""
                UPDATE accounts
                SET department_id = %s,
                    account_name = %s,
                    priority_level = %s,
                    allow_partial_staffing = %s,
                    operator_policy = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE account_id = %s
                AND company_id = %s
            """, (
                department_id,
                account_name,
                priority_level,
                allow_partial_staffing,
                operator_policy,
                account_id,
                company_id,
            ))

            conn.commit()

            return {
                "message": "Account reactivated",
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


@router.put("/accounts/{account_id}")
def update_account(account_id: int, payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        priority_level = payload.get("priority_level", 2)
        allow_partial_staffing = payload.get("allow_partial_staffing", False)
        operator_policy = payload.get("operator_policy", "required")

        cursor.execute("""
            UPDATE accounts
            SET
                priority_level = %s,
                allow_partial_staffing = %s,
                operator_policy = %s,
                updated_at = NOW()
            WHERE account_id = %s
            AND company_id = %s
            AND is_active = TRUE
            RETURNING account_id
        """, (
            priority_level,
            allow_partial_staffing,
            operator_policy,
            account_id,
            company_id
        ))

        updated = cursor.fetchone()

        if not updated:
            raise HTTPException(
                status_code=404,
                detail="Account not found"
            )

        conn.commit()

        return {
            "message": "Account updated",
            "account_id": updated[0]
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as err:
        conn.rollback()
        print("Failed to update account:", err)
        raise HTTPException(
            status_code=500,
            detail="Failed to update account"
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

@router.post("/account-department-import")
async def import_account_department_data(
    company_id: int = Form(...),
    file: UploadFile = File(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    created_departments = 0
    reactivated_departments = 0
    existing_departments = 0

    created_accounts = 0
    updated_accounts = 0
    reactivated_accounts = 0

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. Only .csv files are allowed."
            )

        content = await file.read()

        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File must be UTF-8 encoded."
            )

        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File is empty."
            )

        headers = [
            str(header).strip().lower()
            for header in reader.fieldnames
            if header
        ]

        required_headers = ["department_name", "account_name"]

        missing_headers = [
            header for header in required_headers
            if header not in headers
        ]

        if missing_headers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV file. Missing required column(s): "
                    + ", ".join(missing_headers)
                )
            )

        rows = []

        for row_number, row in enumerate(reader, start=2):
            normalized_row = {
                str(key).strip().lower(): value
                for key, value in row.items()
                if key
            }

            department_name = normalize_name(
                normalized_row.get("department_name") or ""
            )

            account_name = normalize_name(
                normalized_row.get("account_name") or ""
            )

            # Ignore fully blank rows.
            if not department_name and not account_name:
                continue

            rows.append({
                "row_number": row_number,
                "department_name": department_name,
                "account_name": account_name
            })

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. No valid data rows found."
            )

        errors = []
        csv_accounts = set()

        for item in rows:
            row_number = item["row_number"]
            department_name = item["department_name"]
            account_name = item["account_name"]

            if not department_name:
                errors.append(
                    f"Row {row_number}: department_name is required."
                )

            if account_name and not department_name:
                errors.append(
                    f"Row {row_number}: account_name cannot exist without department_name."
                )

            if account_name:
                account_key = account_name.lower()

                if account_key in csv_accounts:
                    errors.append(
                        f"Row {row_number}: duplicate account_name in CSV: {account_name}."
                    )
                else:
                    csv_accounts.add(account_key)

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid CSV file. No records were imported.",
                    "errors": errors
                }
            )

        # Check duplicate account conflicts in database.
        if csv_accounts:
            cursor.execute("""
                SELECT account_name
                FROM accounts
                WHERE company_id = %s
                AND LOWER(account_name) = ANY(%s::text[])
                AND is_active = TRUE
            """, (
                company_id,
                list(csv_accounts)
            ))

            existing_active_accounts = cursor.fetchall()

            if existing_active_accounts:
                errors = [
                    f"Account already exists in this company: {row[0]}."
                    for row in existing_active_accounts
                ]

                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "Invalid CSV file. No records were imported.",
                        "errors": errors
                    }
                )

        # Insert only after all validation passes.
        department_id_map = {}

        for item in rows:
            department_name = item["department_name"]

            department_key = department_name.lower()

            if department_key in department_id_map:
                continue

            cursor.execute("""
                SELECT department_id, is_active
                FROM departments
                WHERE company_id = %s
                AND LOWER(department_name) = LOWER(%s)
                LIMIT 1
            """, (
                company_id,
                department_name
            ))

            department_row = cursor.fetchone()

            if department_row:
                department_id = department_row[0]
                department_is_active = department_row[1]

                cursor.execute("""
                    UPDATE departments
                    SET
                        department_name = %s,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE department_id = %s
                    AND company_id = %s
                """, (
                    department_name,
                    department_id,
                    company_id
                ))

                if department_is_active:
                    existing_departments += 1
                else:
                    reactivated_departments += 1

            else:
                cursor.execute("""
                    INSERT INTO departments (
                        company_id,
                        department_name,
                        is_active
                    )
                    VALUES (%s, %s, TRUE)
                    RETURNING department_id
                """, (
                    company_id,
                    department_name
                ))

                department_id = cursor.fetchone()[0]
                created_departments += 1

            department_id_map[department_key] = department_id

        for item in rows:
            department_name = item["department_name"]
            account_name = item["account_name"]

            if not account_name:
                continue

            department_id = department_id_map[department_name.lower()]

            cursor.execute("""
                SELECT account_id, is_active
                FROM accounts
                WHERE company_id = %s
                AND LOWER(account_name) = LOWER(%s)
                LIMIT 1
            """, (
                company_id,
                account_name
            ))

            account_row = cursor.fetchone()

            if account_row:
                account_id = account_row[0]
                account_is_active = account_row[1]

                cursor.execute("""
                    UPDATE accounts
                    SET
                        department_id = %s,
                        account_name = %s,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE account_id = %s
                    AND company_id = %s
                """, (
                    department_id,
                    account_name,
                    account_id,
                    company_id
                ))

                if account_is_active:
                    updated_accounts += 1
                else:
                    reactivated_accounts += 1

            else:
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
                    VALUES (%s, %s, %s, 2, FALSE, 'required', TRUE)
                """, (
                    company_id,
                    department_id,
                    account_name
                ))

                created_accounts += 1

        conn.commit()

        return {
            "message": "Account / department CSV import completed",
            "created_departments": created_departments,
            "existing_departments": existing_departments,
            "reactivated_departments": reactivated_departments,
            "created_accounts": created_accounts,
            "updated_accounts": updated_accounts,
            "reactivated_accounts": reactivated_accounts
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as err:
        conn.rollback()
        print("ACCOUNT DEPARTMENT IMPORT ERROR:", err)
        raise HTTPException(
            status_code=500,
            detail="Failed to import account / department data"
        )

    finally:
        cursor.close()
        conn.close()
# backend/routes/staffing_requirements.py

import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from db.database import get_connection

router = APIRouter()


def normalize_role_key(role_name: str) -> str:
    return role_name.strip().lower().replace(" ", "_")

def normalize_name(value: str) -> str:
    return " ".join(str(value or "").strip().split()).title()


def get_csv_value(row: dict, *keys: str) -> str:
    for key in keys:
        value = row.get(key)

        if value is not None:
            return str(value).strip()

    return ""

def parse_yes_no(value: str, row_number: int, field_name: str) -> bool:
    normalized = str(value or "").strip().lower()

    if normalized == "yes":
        return True

    if normalized == "no":
        return False

    raise HTTPException(
        status_code=400,
        detail=f"Row {row_number}: {field_name} must be yes or no"
    )

@router.get("/staffing-requirements")
def get_staffing_requirements(company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Return all active company roles for the Admin Dashboard Roles section.
        # Keep staffing_role_id for frontend compatibility.
        cursor.execute("""
            SELECT
                r.role_id,
                r.role_name,
                r.role_key,
                r.is_active,
                r.is_admin,
                d.department_name
            FROM roles r
            LEFT JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
                AND d.is_active = TRUE
            WHERE r.company_id = %s
            AND r.is_active = TRUE
            ORDER BY
                COALESCE(d.department_name, ''),
                r.role_id
        """, (company_id,))

        roles = [
            {
                "staffing_role_id": r[0],
                "role_id": r[0],
                "role_name": r[1],
                "role_key": r[2],
                "is_active": r[3],
                "is_admin": r[4],
                "department_name": r[5] or "None"
            }
            for r in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT
                ssr.requirement_id,
                st.shift_template_id,
                st.shift_name,
                r.role_id,
                r.role_name,
                r.role_key,
                ssr.required_count,
                ssr.is_active,
                a.account_id,
                a.account_name
            FROM shift_staffing_requirements ssr

            JOIN shift_templates st
                ON ssr.shift_template_id = st.shift_template_id
                AND ssr.company_id = st.company_id

            JOIN roles r
                ON ssr.role_id = r.role_id
                AND ssr.company_id = r.company_id

            JOIN accounts a
                ON ssr.account_id = a.account_id
                AND ssr.company_id = a.company_id

            WHERE ssr.company_id = %s
            AND st.is_active = TRUE
            AND r.is_active = TRUE
            AND a.is_active = TRUE
            AND ssr.is_active = TRUE

            ORDER BY
                a.account_id,
                st.start_time,
                r.role_id
        """, (company_id,))

        requirements = [
            {
                "requirement_id": r[0],
                "shift_template_id": r[1],
                "shift_name": r[2],
                "staffing_role_id": r[3],
                "role_id": r[3],
                "role_name": r[4],
                "role_key": r[5],
                "required_count": r[6],
                "is_active": r[7],
                "account_id": r[8],
                "account_name": r[9]
            }
            for r in cursor.fetchall()
        ]

        return {
            "roles": roles,
            "requirements": requirements
        }

    finally:
        cursor.close()
        conn.close()


@router.post("/staffing-roles")
def create_staffing_role(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id", 1)
        role_name = normalize_name(payload.get("role_name", ""))
        department_name = payload.get("department_name", "Default Department").strip()
        is_admin_value = payload.get("is_admin", False)

        if isinstance(is_admin_value, bool):
            is_admin = is_admin_value
        elif isinstance(is_admin_value, str):
            is_admin = is_admin_value.strip().lower() == "yes"
        else:
            is_admin = False

        if not role_name:
            raise HTTPException(
                status_code=400,
                detail="Role name required"
            )

        if not department_name:
            department_name = "Default Department"

        role_key = normalize_role_key(role_name)

        # Department must already exist and be active.
        cursor.execute("""
            SELECT department_id, department_name
            FROM departments
            WHERE company_id = %s
            AND LOWER(department_name) = LOWER(%s)
            AND is_active = TRUE
            LIMIT 1
        """, (
            company_id,
            department_name
        ))

        department_row = cursor.fetchone()

        if not department_row:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Department '{department_name}' does not exist in "
                    "Account / Department Data"
                )
            )

        department_id = department_row[0]
        department_name = department_row[1]

        cursor.execute("""
            SELECT
                role_id,
                is_active
            FROM roles
            WHERE company_id = %s
            AND department_id = %s
            AND LOWER(role_key) = LOWER(%s)
        """, (
            company_id,
            department_id,
            role_key
        ))

        existing = cursor.fetchone()

        if existing:
            role_id = existing[0]
            is_active = existing[1]

            if is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Role already exists"
                )

            cursor.execute("""
                UPDATE roles
                SET
                    department_id = %s,
                    role_name = %s,
                    role_key = %s,
                    is_admin = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                AND role_id = %s
                RETURNING role_id
            """, (
                department_id,
                role_name,
                role_key,
                is_admin,
                company_id,
                role_id
            ))

            role_id = cursor.fetchone()[0]

        else:
            cursor.execute("""
                INSERT INTO roles (
                    company_id,
                    department_id,
                    role_name,
                    role_key,
                    is_admin,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING role_id
            """, (
                company_id,
                department_id,
                role_name,
                role_key,
                is_admin
            ))

            role_id = cursor.fetchone()[0]


        conn.commit()

        return {
            "message": "Role saved",
            "role_id": role_id,
            "staffing_role_id": role_id,
            "department_id": department_id,
            "department_name": department_name
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE STAFFING ROLE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/staffing-roles-import")
async def import_staffing_roles(
    company_id: int = Form(...),
    file: UploadFile = File(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    existing_departments = 0

    created_roles = 0
    reactivated_roles = 0

    errors = []

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

        normalized_headers = [
            str(header).strip().lower().replace(" ", "_")
            for header in reader.fieldnames
            if header
        ]

        required_headers = ["department_name", "role_name", "is_admin"]

        if normalized_headers != required_headers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV file. Required exact header: "
                    "department_name,role_name,is_admin"
                )
            )

        rows = []

        for row_number, row in enumerate(reader, start=2):
            normalized_row = {
                str(key).strip().lower().replace(" ", "_"): value
                for key, value in row.items()
                if key
            }

            department_name = normalize_name(
                get_csv_value(
                    normalized_row,
                    "department_name"
                )
            )

            role_name = normalize_name(
                get_csv_value(
                    normalized_row,
                    "role_name"
                )
            )

            is_admin_raw = get_csv_value(
                normalized_row,
                "is_admin"
            )

            if not department_name and not role_name:
                continue

            if not department_name:
                errors.append(f"Row {row_number}: Department is required")
                continue

            if not role_name:
                errors.append(f"Row {row_number}: Role Name is required")
                continue
            
            if not is_admin_raw:
                errors.append(f"Row {row_number}: is_admin is required")
                continue

            rows.append({
                "row_number": row_number,
                "department_name": department_name,
                "role_name": role_name,
                "role_key": normalize_role_key(role_name),
                "is_admin": parse_yes_no(
                    is_admin_raw,
                    row_number,
                    "is_admin"
                )
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid role import data",
                    "errors": errors
                }
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="CSV has no valid role rows"
            )

        for item in rows:
            department_name = item["department_name"]
            role_name = item["role_name"]
            role_key = item["role_key"]
            is_admin = item["is_admin"]

            cursor.execute("""
                SELECT
                    department_id
                FROM departments
                WHERE company_id = %s
                AND LOWER(department_name) = LOWER(%s)
                AND is_active = TRUE
                LIMIT 1
            """, (
                company_id,
                department_name
            ))

            department_row = cursor.fetchone()

            if not department_row:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Row {item['row_number']}: Department "
                        f"'{department_name}' does not exist in Account / Department Data"
                    )
                )

            department_id = department_row[0]
            existing_departments += 1

            cursor.execute("""
                SELECT
                    role_id,
                    is_active
                FROM roles
                WHERE company_id = %s
                AND department_id = %s
                AND LOWER(role_key) = LOWER(%s)
                LIMIT 1
            """, (
                company_id,
                department_id,
                role_key
            ))

            role_row = cursor.fetchone()

            if role_row:
                role_id = role_row[0]
                role_is_active = role_row[1]

                if role_is_active:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Row {item['row_number']}: Role "
                            f"'{role_name}' already exists under department "
                            f"'{department_name}'"
                        )
                    )

                cursor.execute("""
                    UPDATE roles
                    SET
                        department_id = %s,
                        role_name = %s,
                        role_key = %s,
                        is_admin = %s,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE role_id = %s
                    AND company_id = %s
                    RETURNING role_id
                """, (
                    department_id,
                    role_name,
                    role_key,
                    is_admin,
                    role_id,
                    company_id
                ))

                role_id = cursor.fetchone()[0]
                reactivated_roles += 1

            else:
                cursor.execute("""
                    INSERT INTO roles (
                        company_id,
                        department_id,
                        role_name,
                        role_key,
                        is_admin,
                        is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, TRUE)
                    RETURNING role_id
                """, (
                    company_id,
                    department_id,
                    role_name,
                    role_key,
                    is_admin
                ))

                role_id = cursor.fetchone()[0]
                created_roles += 1

        conn.commit()

        return {
            "message": "Roles imported successfully",
            "summary": {
                "existing_departments": existing_departments,
                "created_roles": created_roles,
                "reactivated_roles": reactivated_roles,
                "total_rows": len(rows)
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("IMPORT STAFFING ROLES ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/staffing-roles/{staffing_role_id}")
def delete_staffing_role(staffing_role_id: int, company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT role_id
            FROM roles
            WHERE role_id = %s
            AND company_id = %s
        """, (
            staffing_role_id,
            company_id
        ))

        role = cursor.fetchone()

        if not role:
            raise HTTPException(
                status_code=404,
                detail="Role not found"
            )

        cursor.execute("""
            SELECT COUNT(*)
            FROM employee_roles er
            JOIN employees e
                ON e.employee_id = er.employee_id
                AND e.company_id = er.company_id
            WHERE er.role_id = %s
            AND er.company_id = %s
            AND LOWER(e.employment_status) = 'active'
        """, (
            staffing_role_id,
            company_id
        ))

        active_employee_count = cursor.fetchone()[0]

        if active_employee_count > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot deactivate role. "
                    f"{active_employee_count} active employee(s) are assigned to this role."
                )
            )

        cursor.execute("""
            UPDATE roles
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE role_id = %s
            AND company_id = %s
        """, (
            staffing_role_id,
            company_id
        ))

        conn.commit()

        return {
            "message": "Role removed"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DELETE STAFFING ROLE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.put("/staffing-requirements")
def update_staffing_requirements(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id", 1)
        requirements = payload.get("requirements", [])

        if not isinstance(requirements, list):
            raise HTTPException(
                status_code=400,
                detail="requirements must be a list"
            )

        for item in requirements:
            shift_template_id = item.get("shift_template_id")
            role_id = item.get("role_id") or item.get("staffing_role_id")
            account_id = item.get("account_id")
            required_count = item.get("required_count")

            if not shift_template_id or not role_id:
                raise HTTPException(
                    status_code=400,
                    detail="Missing shift_template_id or staffing_role_id"
                )

            if required_count is None:
                raise HTTPException(
                    status_code=400,
                    detail="required_count is required"
                )

            required_count = int(required_count)

            if required_count < 0:
                raise HTTPException(
                    status_code=400,
                    detail="required_count cannot be negative"
                )

            # If account_id is provided, update one account only.
            if account_id:
                cursor.execute("""
                    INSERT INTO shift_staffing_requirements (
                        company_id,
                        account_id,
                        shift_template_id,
                        role_id,
                        required_count,
                        is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, TRUE)

                    ON CONFLICT (
                        company_id,
                        account_id,
                        shift_template_id,
                        role_id
                    )

                    DO UPDATE SET
                        required_count = EXCLUDED.required_count,
                        is_active = TRUE,
                        updated_at = NOW()
                """, (
                    company_id,
                    account_id,
                    shift_template_id,
                    role_id,
                    required_count
                ))

            # If account_id is missing, apply the same count to all active accounts.
            else:
                cursor.execute("""
                    SELECT account_id
                    FROM accounts
                    WHERE company_id = %s
                    AND is_active = TRUE
                """, (company_id,))

                accounts = cursor.fetchall()

                for account in accounts:
                    cursor.execute("""
                        INSERT INTO shift_staffing_requirements (
                            company_id,
                            account_id,
                            shift_template_id,
                            role_id,
                            required_count,
                            is_active
                        )
                        VALUES (%s, %s, %s, %s, %s, TRUE)

                        ON CONFLICT (
                            company_id,
                            account_id,
                            shift_template_id,
                            role_id
                        )

                        DO UPDATE SET
                            required_count = EXCLUDED.required_count,
                            is_active = TRUE,
                            updated_at = NOW()
                    """, (
                        company_id,
                        account[0],
                        shift_template_id,
                        role_id,
                        required_count
                    ))

        conn.commit()

        return {
            "message": "Staffing requirements saved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("UPDATE STAFFING REQUIREMENTS ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
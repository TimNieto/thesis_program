#---------------------------------------------
# backend/routes/companies.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from passlib.hash import bcrypt
from services.permission_service import ensure_permission_defaults

router = APIRouter()

def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def ensure_company_settings(cursor, company_id: int):
    cursor.execute("""
        INSERT INTO company_settings (
            company_id,
            max_working_days,
            min_rest_period_hours,
            max_shifts_per_day,
            max_shifts_per_week,
            allow_double_shifts,
            fairness_weight,
            absence_replacement_mode,
            enable_in_app_notifications,
            gy_fatigue_penalty,
            absence_tolerance
        )
        VALUES (%s, 7, 8, 2, 7, FALSE, 2, 'Automatic', TRUE, 20, 50)
        ON CONFLICT (company_id)
        DO NOTHING
    """, (company_id,))


def create_default_company_data(cursor, company_id: int):
    # 1. Ensure Default Department exists and is active
    cursor.execute("""
        INSERT INTO departments (
            company_id,
            department_name,
            is_active
        )
        VALUES (%s, 'Default Department', TRUE)
        ON CONFLICT (company_id, department_name)
        DO UPDATE SET
            is_active = TRUE,
            updated_at = NOW()
        RETURNING department_id
    """, (company_id,))

    department_id = cursor.fetchone()[0]

    # 2. Ensure Default Role exists and is active
    cursor.execute("""
        INSERT INTO roles (
            company_id,
            department_id,
            role_key,
            role_name,
            is_admin,
            is_active
        )
        VALUES (%s, %s, 'default_role', 'Default Role', TRUE, TRUE)
        ON CONFLICT (company_id, role_key)
        DO UPDATE SET
            department_id = EXCLUDED.department_id,
            role_name = EXCLUDED.role_name,
            is_admin = TRUE,
            is_active = TRUE,
            updated_at = NOW()
        RETURNING role_id
    """, (
        company_id,
        department_id
    ))

    role_id = cursor.fetchone()[0]

    # 3. Ensure Default Admin Employee exists and is active
    cursor.execute("""
        SELECT company_name
        FROM companies
        WHERE company_id = %s
        LIMIT 1
    """, (company_id,))

    company_row = cursor.fetchone()
    company_name = company_row[0] if company_row else f"company{company_id}"

    safe_company_name = (
        company_name
        .strip()
        .lower()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
    )

    if not safe_company_name:
        safe_company_name = f"company{company_id}"

    default_email = f"{safe_company_name}_defaultaccount@gmail.com"

    # First, try to find the default account by its expected email.
    cursor.execute("""
        SELECT employee_id
        FROM employees
        WHERE company_id = %s
        AND LOWER(email) = LOWER(%s)
        LIMIT 1
    """, (
        company_id,
        default_email
    ))

    employee_row = cursor.fetchone()

    # If the company was renamed, the old default account may have the old email.
    # In that case, find it by the known default identity.
    if not employee_row:
        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE company_id = %s
            AND LOWER(full_name) = 'default admin'
            AND LOWER(COALESCE(nickname, '')) = 'admin'
            ORDER BY employee_id ASC
            LIMIT 1
        """, (company_id,))

        employee_row = cursor.fetchone()

    if employee_row:
        employee_id = employee_row[0]

        cursor.execute("""
            UPDATE employees
            SET
                full_name = 'Default Admin',
                nickname = 'Admin',
                email = %s,
                password = %s,
                employment_status = 'Active',
                contact_number = '0000000000',
                joined_date = COALESCE(joined_date, CURRENT_DATE),
                updated_at = NOW()
            WHERE employee_id = %s
            AND company_id = %s
            RETURNING employee_id
        """, (
            default_email,
            hash_password("1234"),
            employee_id,
            company_id
        ))

        employee_id = cursor.fetchone()[0]

    else:
        cursor.execute("""
            INSERT INTO employees (
                full_name,
                nickname,
                email,
                password,
                employment_status,
                contact_number,
                joined_date,
                company_id
            )
            VALUES (
                'Default Admin',
                'Admin',
                %s,
                %s,
                'Active',
                '0000000000',
                CURRENT_DATE,
                %s
            )
            RETURNING employee_id
        """, (
            default_email,
            hash_password("1234"),
            company_id
        ))

        employee_id = cursor.fetchone()[0]

    # 4. Ensure Default Admin Employee is assigned to Default Role
    cursor.execute("""
        INSERT INTO employee_roles (
            employee_id,
            role_id,
            company_id,
            is_active
        )
        VALUES (%s, %s, %s, TRUE)
        ON CONFLICT (company_id, employee_id, role_id)
        DO UPDATE SET
            is_active = TRUE
    """, (
        employee_id,
        role_id,
        company_id
    ))


@router.get("/companies")
def get_companies():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                c.company_id,
                c.company_name,
                c.company_type,
                c.created_at,
                c.is_active,
                COUNT(e.employee_id) AS employee_count
            FROM companies c
            LEFT JOIN employees e
                ON c.company_id = e.company_id
                AND e.employment_status = 'Active'
            WHERE c.is_active = TRUE
            GROUP BY
                c.company_id,
                c.company_name,
                c.company_type,
                c.created_at,
                c.is_active
            ORDER BY c.company_id ASC
        """)

        rows = cursor.fetchall()

        return [
            {
                "company_id": r[0],
                "company_name": r[1],
                "company_type": r[2],
                "created_at": str(r[3]),
                "is_active": r[4],
                "employee_count": r[5],
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/companies")
def create_company(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_name = payload.get("company_name", "").strip()
        company_type = payload.get("company_type", "").strip()

        if not company_name:
            raise HTTPException(status_code=400, detail="Company name required")

        if not company_type:
            raise HTTPException(status_code=400, detail="Company type required")

        # Check existing company by name, case-insensitive.
        cursor.execute("""
            SELECT
                company_id,
                is_active
            FROM companies
            WHERE LOWER(company_name) = LOWER(%s)
            LIMIT 1
        """, (company_name,))

        existing_company = cursor.fetchone()

        # Existing active company: reject.
        if existing_company and existing_company[1]:
            raise HTTPException(
                status_code=400,
                detail="Company already exists"
            )

        # Existing inactive company:
        # Reactivate the company and restore the default access chain.
        # This prevents dead ends where the default department, role,
        # default admin employee, or default role assignment was deactivated.
        if existing_company and not existing_company[1]:
            company_id = existing_company[0]

            cursor.execute("""
                UPDATE companies
                SET
                    company_name = %s,
                    company_type = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                RETURNING company_id
            """, (
                company_name,
                company_type,
                company_id
            ))

            company_id = cursor.fetchone()[0]

            ensure_company_settings(cursor, company_id)

            create_default_company_data(cursor, company_id)

            ensure_permission_defaults(cursor, company_id)

            conn.commit()

            return {
                "message": "Company reactivated",
                "company_id": company_id
            }

        # Brand-new company: create company, settings, and default login data.
        cursor.execute("""
            INSERT INTO companies (
                company_name,
                company_type,
                is_active
            )
            VALUES (%s, %s, TRUE)
            RETURNING company_id
        """, (
            company_name,
            company_type
        ))

        company_id = cursor.fetchone()[0]

        ensure_company_settings(cursor, company_id)

        create_default_company_data(cursor, company_id)

        ensure_permission_defaults(cursor, company_id)

        conn.commit()

        return {
            "message": "Company created",
            "company_id": company_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()

@router.delete("/companies/{company_id}")
def soft_delete_company(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE companies
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE company_id = %s
            RETURNING company_id, company_name
        """, (company_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Company not found")

        conn.commit()

        return {
            "message": "Company removed",
            "company_id": row[0],
            "company_name": row[1],
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
# backend/routes/auth.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.database import get_connection
from passlib.hash import bcrypt

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


def verify_password(input_password: str, stored_password: str) -> bool:
    if not stored_password:
        return False

    # Supports old plain-text passwords like "1234"
    if input_password == stored_password:
        return True

    # Supports bcrypt hashed passwords
    try:
        return bcrypt.verify(input_password, stored_password)
    except Exception:
        return False


@router.post("/login")
def login(data: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()

    email = data.email.strip().lower()
    password = data.password

    try:
        # 1. Check if user is Super Admin
        cursor.execute(
            """
            SELECT
                super_admin_id,
                full_name,
                email,
                password
            FROM super_admins
            WHERE LOWER(email) = %s
            AND is_active = TRUE
            LIMIT 1
            """,
            (email,),
        )

        super_admin = cursor.fetchone()

        if super_admin:
            super_admin_id, full_name, user_email, stored_password = super_admin

            if not verify_password(password, stored_password):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid credentials"
                )

            return {
                "message": "Login successful",
                "role": "super-admin",
                "displayRole": "Super Admin",
                "user": {
                    "id": super_admin_id,
                    "name": full_name,
                    "email": user_email,
                    "company_id": None,
                    "company_name": None,
                },
            }

        # 2. If not Super Admin, check if user is an active Employee
        cursor.execute(
            """
            SELECT
                e.employee_id,
                e.full_name,
                e.email,
                e.password,
                e.company_id,
                c.company_name
            FROM employees e
            JOIN companies c
                ON e.company_id = c.company_id
            WHERE LOWER(e.email) = %s
            AND e.employment_status = 'Active'
            AND c.is_active = TRUE
            LIMIT 1
            """,
            (email,),
        )

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        (
            employee_id,
            full_name,
            user_email,
            stored_password,
            company_id,
            company_name,
        ) = employee

        if not verify_password(password, stored_password):
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        # 3. If valid employee, check if employee is HR Manager
        cursor.execute(
            """
            SELECT 1
            FROM employee_roles er
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            WHERE er.employee_id = %s
            AND er.company_id = %s
            AND r.role_key = 'hr_manager'
            AND r.is_active = TRUE
            LIMIT 1
            """,
            (employee_id, company_id),
        )

        is_hr_manager = cursor.fetchone() is not None

        # 4. HR Manager goes to admin dashboard
        if is_hr_manager:
            return {
                "message": "Login successful",
                "role": "admin",
                "displayRole": "HR Manager",
                "user": {
                    "id": employee_id,
                    "name": full_name,
                    "email": user_email,
                    "company_id": company_id,
                    "company_name": company_name,
                },
            }

        # 5. All other valid employees go to regular employee dashboard
        return {
            "message": "Login successful",
            "role": "employee",
            "displayRole": "General Employee",
            "user": {
                "id": employee_id,
                "name": full_name,
                "email": user_email,
                "company_id": company_id,
                "company_name": company_name,
            },
        }

    finally:
        cursor.close()
        conn.close()

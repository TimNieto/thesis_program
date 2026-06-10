#---------------------------------------------
# backend/routes/employees.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from passlib.hash import bcrypt
from services.notification_service import create_notification
from services.role_service import get_company_admin_employee_ids

router = APIRouter()


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        if hashed and hashed.startswith("$2"):
            return bcrypt.verify(password, hashed)
    except Exception:
        pass

    return password == hashed


def normalize_list(value):
    if not value:
        return []

    if not isinstance(value, list):
        value = [value]

    cleaned = []

    for item in value:
        item = str(item).strip()

        if item and item.lower() != "none":
            cleaned.append(item)

    return cleaned


def get_display_role(role_keys, role_names):
    if "hr_manager" in role_keys or "admin" in role_keys:
        return "Team Leader"

    if "host" in role_keys and "operator" in role_keys:
        return "Both"

    if "host" in role_keys:
        return "Host"

    if "operator" in role_keys:
        return "Operator"

    return ", ".join(role_names) if role_names else "Employee"


@router.get("/employees")
def get_employees(company_id: int | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if company_id:
            cursor.execute("""
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.email,
                    e.employment_status,
                    e.joined_date,
                    e.contact_number,
                    e.company_id
                FROM employees e
                WHERE e.employment_status = 'Active'
                AND e.company_id = %s
                ORDER BY e.employee_id
            """, (company_id,))
        else:
            cursor.execute("""
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.email,
                    e.employment_status,
                    e.joined_date,
                    e.contact_number,
                    e.company_id
                FROM employees e
                WHERE e.employment_status = 'Active'
                ORDER BY e.employee_id
            """)

        employee_rows = cursor.fetchall()
        employees = []

        for row in employee_rows:
            employee_id = row[0]
            full_name = row[1]
            email = row[2]
            employment_status = row[3]
            joined_date = row[4]
            contact_number = row[5]
            emp_company_id = row[6]

            cursor.execute("""
                SELECT r.role_key, r.role_name
                FROM employee_roles er
                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id
                WHERE er.employee_id = %s
                AND er.company_id = %s
                AND r.is_active = TRUE
                ORDER BY r.role_id
            """, (employee_id, emp_company_id))

            role_rows = cursor.fetchall()
            role_keys = [r[0] for r in role_rows]
            role_names = [r[1] for r in role_rows]

            display_role = get_display_role(role_keys, role_names)

            cursor.execute("""
                SELECT DISTINCT
                    d.department_name,
                    a.account_name
                FROM employee_roles er

                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id

                JOIN departments d
                    ON r.department_id = d.department_id
                    AND r.company_id = d.company_id

                LEFT JOIN accounts a
                    ON a.department_id = d.department_id
                    AND a.company_id = d.company_id
                    AND a.is_active = TRUE

                WHERE er.employee_id = %s
                AND er.company_id = %s
                AND r.is_active = TRUE
                AND d.is_active = TRUE

                ORDER BY d.department_name, a.account_name
            """, (employee_id, emp_company_id))

            assignment_rows = cursor.fetchall()

            department_names = sorted({
                department_name
                for department_name, account_name in assignment_rows
                if department_name
            })

            account_names = sorted({
                account_name
                for department_name, account_name in assignment_rows
                if account_name
            })

            employees.append({
                "id": employee_id,
                "name": full_name,
                "email": email,
                "role": display_role,
                "status": employment_status,
                "totalShifts": 0,
                "joinedDate": str(joined_date) if joined_date else None,
                "accountType": "Employee",
                "account_names": ", ".join(account_names) if account_names else None,
                "accounts": account_names,
                "contactNumber": contact_number,
                "department_name": ", ".join(department_names) if department_names else "None",
                "departments": department_names,
                "company_id": emp_company_id
            })

        return employees

    finally:
        cursor.close()
        conn.close()


@router.get("/employees/{employee_id}")
def get_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                e.employee_id,
                e.full_name,
                e.email,
                e.contact_number,
                e.company_id
            FROM employees e
            WHERE e.employee_id = %s
        """, (employee_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        emp_company_id = row[4]

        cursor.execute("""
            SELECT r.role_key, r.role_name
            FROM employee_roles er
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            WHERE er.employee_id = %s
            AND er.company_id = %s
            AND r.is_active = TRUE
            ORDER BY r.role_id
        """, (employee_id, emp_company_id))

        role_rows = cursor.fetchall()
        role_keys = [r[0] for r in role_rows]
        role_names = [r[1] for r in role_rows]

        display_role = get_display_role(role_keys, role_names)

        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": display_role,
            "contactNumber": row[3],
            "company_id": emp_company_id
        }

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/account-preferences")
def update_employee_account_preferences(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND employment_status = 'Active'
        """, (employee_id,))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_id = employee[0]

        cursor.execute("""
            SELECT role_id, role_key
            FROM roles
            WHERE company_id = %s
            AND role_key IN ('host', 'operator')
            AND is_active = TRUE
        """, (company_id,))

        role_rows = cursor.fetchall()
        role_map = {role_key: role_id for role_id, role_key in role_rows}

        host_role_id = role_map.get("host")
        operator_role_id = role_map.get("operator")

        if not host_role_id or not operator_role_id:
            raise HTTPException(
                status_code=400,
                detail="Host or operator role is missing"
            )

        cursor.execute("""
            DELETE FROM account_preferences
            WHERE employee_id = %s
            AND company_id = %s
        """, (employee_id, company_id))

        for account_name in host_accounts:
            cursor.execute("""
                SELECT account_id
                FROM accounts
                WHERE company_id = %s
                AND LOWER(account_name) = LOWER(%s)
                AND is_active = TRUE
            """, (company_id, account_name))

            account = cursor.fetchone()

            if account:
                cursor.execute("""
                    INSERT INTO account_preferences (
                        employee_id,
                        account_id,
                        role_id,
                        company_id
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (employee_id, account_id, role_id)
                    DO NOTHING
                """, (employee_id, account[0], host_role_id, company_id))

        for account_name in operator_accounts:
            cursor.execute("""
                SELECT account_id
                FROM accounts
                WHERE company_id = %s
                AND LOWER(account_name) = LOWER(%s)
                AND is_active = TRUE
            """, (company_id, account_name))

            account = cursor.fetchone()

            if account:
                cursor.execute("""
                    INSERT INTO account_preferences (
                        employee_id,
                        account_id,
                        role_id,
                        company_id
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (employee_id, account_id, role_id)
                    DO NOTHING
                """, (employee_id, account[0], operator_role_id, company_id))

        conn.commit()

        return {"message": "Employee account preferences updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating account preferences:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to update employee account preferences"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/employees")
def add_employee(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        name = data.get("name", "").strip()
        nickname = data.get("nickname", "").strip()
        email = data.get("email", "").strip().lower()
        contact_number = data.get("contactNumber", "").strip()
        created_by = data.get("created_by")
        company_id = data.get("company_id")

        role = data.get("role", "").strip()

        if not name:
            raise HTTPException(status_code=400, detail="Full name is required")

        if not nickname:
            raise HTTPException(status_code=400, detail="Nickname is required")

        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Valid email is required")

        if not contact_number:
            raise HTTPException(status_code=400, detail="Contact number is required")

        if not company_id:
            if not created_by:
                raise HTTPException(
                    status_code=400,
                    detail="company_id or created_by is required"
                )

            cursor.execute("""
                SELECT company_id
                FROM employees
                WHERE employee_id = %s
                AND employment_status = 'Active'
            """, (created_by,))

            creator = cursor.fetchone()

            if not creator:
                raise HTTPException(
                    status_code=404,
                    detail="Creator employee not found"
                )

            company_id = creator[0]

        cursor.execute("""
            SELECT employee_id, employment_status
            FROM employees
            WHERE LOWER(email) = LOWER(%s)
            AND company_id = %s
        """, (email, company_id))

        existing = cursor.fetchone()

        if existing and existing[1] == "Active":
            raise HTTPException(status_code=400, detail="Employee already exists")

        if existing:
            employee_id = existing[0]

            cursor.execute("""
                UPDATE employees
                SET
                    full_name = %s,
                    nickname = %s,
                    email = %s,
                    password = %s,
                    employment_status = 'Active',
                    contact_number = %s,
                    joined_date = CURRENT_DATE,
                    updated_at = NOW()
                WHERE employee_id = %s
                AND company_id = %s
            """, (
                name,
                nickname,
                email,
                hash_password("1234"),
                contact_number,
                employee_id,
                company_id
            ))

            message = "Employee reactivated"

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
                VALUES (%s, %s, %s, %s, 'Active', %s, CURRENT_DATE, %s)
                RETURNING employee_id
            """, (
                name,
                nickname,
                email,
                hash_password("1234"),
                contact_number,
                company_id
            ))

            employee_id = cursor.fetchone()[0]
            message = "Employee added"

        # Optional role assignment, if frontend sends role.
        role_key_map = {
            "Host": ["host"],
            "Operator": ["operator"],
            "Both": ["host", "operator"],
            "Team Leader": ["hr_manager"],
            "HR Manager": ["hr_manager"],
        }

        role_keys = role_key_map.get(role, [])

        if role_keys:
            cursor.execute("""
                DELETE FROM employee_roles
                WHERE employee_id = %s
                AND company_id = %s
            """, (employee_id, company_id))

            for role_key in role_keys:
                cursor.execute("""
                    SELECT role_id
                    FROM roles
                    WHERE company_id = %s
                    AND role_key = %s
                    AND is_active = TRUE
                    LIMIT 1
                """, (company_id, role_key))

                role_row = cursor.fetchone()

                if role_row:
                    cursor.execute("""
                        INSERT INTO employee_roles (
                            employee_id,
                            role_id,
                            company_id
                        )
                        VALUES (%s, %s, %s)
                        ON CONFLICT (employee_id, role_id)
                        DO NOTHING
                    """, (employee_id, role_row[0], company_id))

            role_rows = cursor.fetchall()
            role_map = {role_key: role_id for role_id, role_key in role_rows}

            cursor.execute("""
                DELETE FROM account_preferences
                WHERE employee_id = %s
                AND company_id = %s
            """, (employee_id, company_id))

            for account_name in host_accounts:
                cursor.execute("""
                    SELECT account_id
                    FROM accounts
                    WHERE company_id = %s
                    AND LOWER(account_name) = LOWER(%s)
                    AND is_active = TRUE
                """, (company_id, account_name))

                account = cursor.fetchone()

                if account and role_map.get("host"):
                    cursor.execute("""
                        INSERT INTO account_preferences (
                            employee_id,
                            account_id,
                            role_id,
                            company_id
                        )
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (employee_id, account_id, role_id)
                        DO NOTHING
                    """, (
                        employee_id,
                        account[0],
                        role_map["host"],
                        company_id
                    ))

            for account_name in operator_accounts:
                cursor.execute("""
                    SELECT account_id
                    FROM accounts
                    WHERE company_id = %s
                    AND LOWER(account_name) = LOWER(%s)
                    AND is_active = TRUE
                """, (company_id, account_name))

                account = cursor.fetchone()

                if account and role_map.get("operator"):
                    cursor.execute("""
                        INSERT INTO account_preferences (
                            employee_id,
                            account_id,
                            role_id,
                            company_id
                        )
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (employee_id, account_id, role_id)
                        DO NOTHING
                    """, (
                        employee_id,
                        account[0],
                        role_map["operator"],
                        company_id
                    ))

        conn.commit()

        return {
            "message": message,
            "employee_id": employee_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR adding employee:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employment_status
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        if row[0] == "Inactive":
            return {"message": "Employee already inactive"}

        cursor.execute("""
            UPDATE employees
            SET employment_status = 'Inactive',
                updated_at = NOW()
            WHERE employee_id = %s
        """, (employee_id,))

        conn.commit()

        return {"message": "Employee marked as inactive"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR deleting employee:", e)
        raise HTTPException(status_code=500, detail="Failed to delete employee")

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/role")
def update_employee_role(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        role = data.get("role", "").strip()

        role_key_map = {
            "Host": ["host"],
            "Operator": ["operator"],
            "Both": ["host", "operator"],
            "Team Leader": ["hr_manager"],
            "HR Manager": ["hr_manager"],
        }

        role_keys = role_key_map.get(role)

        if not role_keys:
            raise HTTPException(status_code=400, detail="Invalid role")

        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND employment_status = 'Active'
        """, (employee_id,))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        company_id = employee[0]

        cursor.execute("""
            DELETE FROM employee_roles
            WHERE employee_id = %s
            AND company_id = %s
        """, (employee_id, company_id))

        for role_key in role_keys:
            cursor.execute("""
                SELECT role_id
                FROM roles
                WHERE company_id = %s
                AND role_key = %s
                AND is_active = TRUE
            """, (company_id, role_key))

            role_row = cursor.fetchone()

            if not role_row:
                raise HTTPException(
                    status_code=400,
                    detail=f"Role not found: {role_key}"
                )

            cursor.execute("""
                INSERT INTO employee_roles (
                    employee_id,
                    role_id,
                    company_id
                )
                VALUES (%s, %s, %s)
                ON CONFLICT (employee_id, role_id)
                DO NOTHING
            """, (employee_id, role_row[0], company_id))

        conn.commit()

        return {"message": "Employee role updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating role:", e)
        raise HTTPException(status_code=500, detail="Failed to update employee role")

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}")
def update_employee(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE employees
            SET full_name = %s,
                contact_number = %s,
                updated_at = NOW()
            WHERE employee_id = %s
        """, (
            data["name"],
            data["contactNumber"],
            employee_id
        ))

        conn.commit()

        return {"message": "Employee updated successfully"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/password")
def change_password(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT password
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        stored_password = row[0]

        current = data.get("currentPassword", "").strip()
        new_password = data.get("newPassword", "").strip()

        if not current or not new_password:
            raise HTTPException(status_code=400, detail="Missing fields")

        if not verify_password(current, stored_password):
            raise HTTPException(status_code=400, detail="Incorrect current password")

        if len(new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters"
            )

        cursor.execute("""
            UPDATE employees
            SET password = %s,
                updated_at = NOW()
            WHERE employee_id = %s
        """, (
            hash_password(new_password),
            employee_id
        ))

        conn.commit()

        return {"message": "Password updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to change password")

    finally:
        cursor.close()
        conn.close()


@router.get("/availability")
def get_availability(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                a.employee_id,
                a.day_of_week,
                a.is_available,
                a.shift_template_id,
                st.shift_name,
                a.company_id
            FROM availability a
            JOIN shift_templates st
                ON a.shift_template_id = st.shift_template_id
                AND a.company_id = st.company_id
            WHERE a.company_id = %s
            ORDER BY
                a.employee_id,
                CASE INITCAP(TRIM(a.day_of_week))
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                    ELSE 8
                END,
                st.start_time
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "employee_id": r[0],
                "day_of_week": r[1],
                "is_available": r[2],
                "shift_template_id": r[3],
                "preferred_shift": r[4],
                "shift_name": r[4],
                "company_id": r[5],
            }
            for r in rows
        ]

    except Exception as e:
        print("ERROR fetching availability:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch availability"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/availability")
def update_availability(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = int(data["employee_id"])
        company_id = int(data["company_id"])
        day_of_week = str(data["day_of_week"]).strip().capitalize()
        is_available = bool(data["is_available"])

        shift_template_id = data.get("shift_template_id")

        if not shift_template_id:
            preferred_shift = str(data.get("preferred_shift", "")).strip().upper()

            cursor.execute("""
                SELECT shift_template_id
                FROM shift_templates
                WHERE company_id = %s
                AND UPPER(shift_name) = %s
                AND is_active = TRUE
                LIMIT 1
            """, (company_id, preferred_shift))

            row = cursor.fetchone()

            if not row:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid shift template"
                )

            shift_template_id = row[0]

        shift_template_id = int(shift_template_id)

        cursor.execute("""
            SELECT availability_id
            FROM availability
            WHERE company_id = %s
            AND employee_id = %s
            AND LOWER(TRIM(day_of_week)) = LOWER(TRIM(%s))
            AND shift_template_id = %s
            LIMIT 1
        """, (
            company_id,
            employee_id,
            day_of_week,
            shift_template_id
        ))

        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE availability
                SET
                    day_of_week = %s,
                    is_available = %s
                WHERE availability_id = %s
            """, (
                day_of_week,
                is_available,
                existing[0]
            ))
        else:
            cursor.execute("""
                INSERT INTO availability (
                    employee_id,
                    company_id,
                    day_of_week,
                    shift_template_id,
                    is_available
                )
                VALUES (%s, %s, %s, %s, %s)
            """, (
                employee_id,
                company_id,
                day_of_week,
                shift_template_id,
                is_available
            ))

        conn.commit()

        return {
            "message": "Availability saved",
            "employee_id": employee_id,
            "company_id": company_id,
            "day_of_week": day_of_week,
            "shift_template_id": shift_template_id,
            "is_available": is_available,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating availability:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
#---------------------------------------------
# backend/routes/employees.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from passlib.hash import bcrypt
from services.notification_service import create_notification

router = APIRouter()

def hash_password(password: str) -> str:
    return bcrypt.hash(password)

def verify_password(password: str, hashed: str) -> bool:

    try:
        if hashed.startswith("$2"):
            return bcrypt.verify(password, hashed)
    except Exception:
        pass

    return password == hashed

@router.get("/employees")
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()

    try:
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
            company_id = row[6]

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
            """, (employee_id, company_id))

            role_rows = cursor.fetchall()

            role_keys = [r[0] for r in role_rows]
            role_names = [r[1] for r in role_rows]

            if "team_leader" in role_keys or "hr_manager" in role_keys or "admin" in role_keys:
                display_role = "Team Leader"
            elif "host" in role_keys and "operator" in role_keys:
                display_role = "Both"
            elif "host" in role_keys:
                display_role = "Host"
            elif "operator" in role_keys:
                display_role = "Operator"
            else:
                display_role = role_names[0] if role_names else "Employee"

            cursor.execute("""
                SELECT
                    a.account_name,
                    r.role_key
                FROM employee_account_roles ear
                JOIN accounts a
                    ON ear.account_id = a.account_id
                    AND ear.company_id = a.company_id
                JOIN roles r
                    ON ear.role_id = r.role_id
                    AND ear.company_id = r.company_id
                WHERE ear.employee_id = %s
                AND ear.company_id = %s
                AND a.is_active = TRUE
                AND r.is_active = TRUE
            """, (employee_id, company_id))

            account_role_rows = cursor.fetchall()

            host_accounts = [
                account_name
                for account_name, role_key in account_role_rows
                if role_key == "host"
            ]

            operator_accounts = [
                account_name
                for account_name, role_key in account_role_rows
                if role_key == "operator"
            ]

            employees.append({
                "id": employee_id,
                "name": full_name,
                "email": email,
                "role": display_role,
                "status": employment_status,
                "totalShifts": 0,
                "joinedDate": str(joined_date) if joined_date else None,
                "accountType": "Employee",
                "can_be_host": len(host_accounts) > 0,
                "host_accounts": ", ".join(host_accounts) if host_accounts else None,
                "can_be_operator": len(operator_accounts) > 0,
                "operator_accounts": ", ".join(operator_accounts) if operator_accounts else None,
                "contactNumber": contact_number,
                "company_id": company_id
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

        company_id = row[4]

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
        """, (employee_id, company_id))

        role_rows = cursor.fetchall()
        role_keys = [r[0] for r in role_rows]
        role_names = [r[1] for r in role_rows]

        if "team_leader" in role_keys or "hr_manager" in role_keys or "admin" in role_keys:
            display_role = "Team Leader"
        elif "host" in role_keys and "operator" in role_keys:
            display_role = "Both"
        elif "host" in role_keys:
            display_role = "Host"
        elif "operator" in role_keys:
            display_role = "Operator"
        else:
            display_role = role_names[0] if role_names else "Employee"

        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": display_role,
            "contactNumber": row[3],
            "company_id": company_id
        }

    finally:
        cursor.close()
        conn.close()



def normalize_accounts(value):
    if not value:
        return None

    if not isinstance(value, list):
        value = [value]

    cleaned = []

    for item in value:
        item = str(item).strip()

        if item and item.lower() != "none":
            cleaned.append(item)

    if not cleaned:
        return None

    return ", ".join(cleaned)

@router.put("/employees/{employee_id}/account-preferences")
def update_employee_account_preferences(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        host_accounts = data.get("host_accounts") or []
        operator_accounts = data.get("operator_accounts") or []

        if not isinstance(host_accounts, list):
            host_accounts = [host_accounts]

        if not isinstance(operator_accounts, list):
            operator_accounts = [operator_accounts]

        host_accounts = [
            str(account).strip()
            for account in host_accounts
            if str(account).strip() and str(account).strip().lower() != "none"
        ]

        operator_accounts = [
            str(account).strip()
            for account in operator_accounts
            if str(account).strip() and str(account).strip().lower() != "none"
        ]

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
            DELETE FROM employee_account_roles
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
                    INSERT INTO employee_account_roles (
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
                    INSERT INTO employee_account_roles (
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
        print("ERROR:", e)
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
        role = data.get("role", "").strip()

        host_account = normalize_accounts(
            data.get("host_accounts")
        )

        operator_account = normalize_accounts(
            data.get("operator_accounts")
        )

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Full name is required"
            )

        if not nickname:
            raise HTTPException(
                status_code=400,
                detail="Nickname is required"
            )

        if not email or "@" not in email:
            raise HTTPException(
                status_code=400,
                detail="Valid email is required"
            )
        
        if not contact_number:
            raise HTTPException(
                status_code=400,
                detail="Contact number is required"
            )
        
        if role not in [
            "Host",
            "Operator",
            "Both",
            "Team Leader"
        ]:
            raise HTTPException(
                status_code=400,
                detail="Invalid role"
            )

        if role == "Host" and not host_account:
            raise HTTPException(
                status_code=400,
                detail="Host account required for Host role"
            )

        if role == "Operator" and not operator_account:
            raise HTTPException(
                status_code=400,
                detail="Operator account required for Operator role"
            )

        if role == "Both":

            if not host_account:
                raise HTTPException(
                    status_code=400,
                    detail="Host account required for Both role"
                )

            if not operator_account:
                raise HTTPException(
                    status_code=400,
                    detail="Operator account required for Both role"
                )

        can_be_host = host_account is not None
        can_be_operator = operator_account is not None

        cursor.execute("""
            SELECT employee_id, employment_status
            FROM employees
            WHERE LOWER(email) = LOWER(%s)
        """, (email,))

        existing = cursor.fetchone()

        if existing:
            employee_id = existing[0]
            employment_status = existing[1]

            if employment_status == "Active":
                raise HTTPException(
                    status_code=400,
                    detail="Employee already exists"
                )

            cursor.execute("""
                UPDATE employees
                SET
                    full_name = %s,
                    nickname = %s,
                    email = %s,
                    main_role = %s,
                    password = %s,
                    employment_status = 'Active',
                    can_be_host = %s,
                    host_account = %s,
                    can_be_operator = %s,
                    operator_account = %s,
                    contact_number = %s,
                    joined_date = CURRENT_DATE
                WHERE employee_id = %s
            """, (
                name,
                nickname,
                email,
                role,
                hash_password("1234"),
                can_be_host,
                host_account,
                can_be_operator,
                operator_account,
                contact_number,
                employee_id
            ))

            conn.commit()

            return {
                "message": "Employee reactivated"
            }

        cursor.execute("""
            INSERT INTO employees (
                full_name,
                nickname,
                email,
                main_role,
                password,
                employment_status,
                can_be_host,
                host_account,
                can_be_operator,
                operator_account,
                contact_number,
                joined_date
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                CURRENT_DATE
            )
        """, (
            name,
            nickname,
            email,
            role,
            hash_password("1234"),
            "Active",
            can_be_host,
            host_account,
            can_be_operator,
            operator_account,
            contact_number
        ))

        created_by = data.get("created_by")

        if created_by:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE main_role = 'Team Leader'
                AND employment_status = 'Active'
                AND employee_id != %s
            """, (created_by,))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE main_role = 'Team Leader'
                AND employment_status = 'Active'
            """)

        admins = cursor.fetchall()

        for admin in admins:

            create_notification(
                cursor,
                admin[0],
                "New Employee Added",
                f"{name} was added to the system.",
                "employee"
            )

        conn.commit()

        return {
            "message": "Employee added"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT employment_status FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        current_status = row[0]

        if current_status == "Inactive":
            return {"message": "Employee already inactive"}

        cursor.execute(
            "UPDATE employees SET employment_status = 'Inactive' WHERE employee_id = %s",
            (employee_id,)
        )

        conn.commit()

        return {"message": "Employee marked as inactive"}

    except Exception as e:
        conn.rollback()
        print("ERROR:", e)
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
            "Team Leader": ["team_leader"],
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

            role_id = role_row[0]

            cursor.execute("""
                INSERT INTO employee_roles (
                    employee_id,
                    role_id,
                    company_id
                )
                VALUES (%s, %s, %s)
                ON CONFLICT (employee_id, role_id)
                DO NOTHING
            """, (employee_id, role_id, company_id))

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
                contact_number = %s
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
        cursor.execute(
            "SELECT password FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
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
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        cursor.execute(
            "UPDATE employees SET password = %s WHERE employee_id = %s",
            (hash_password(new_password), employee_id)
        )

        conn.commit()

        return {"message": "Password updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to change password"
        )

    finally:
        cursor.close()
        conn.close()


@router.get("/availability")
def get_availability():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id,
                account,
                day_of_week,
                is_available,
                preferred_shift
            FROM availability
            ORDER BY employee_id
        """)

        rows = cursor.fetchall()

        availability = [
            {
                "employee_id": r[0],
                "account": r[1],
                "day_of_week": r[2],
                "is_available": r[3],
                "preferred_shift": r[4]
            }
            for r in rows
        ]

        return availability

    except Exception as e:
        print("ERROR fetching availability:", e)
        raise HTTPException(status_code=500, detail="Failed to fetch availability")

    finally:
        cursor.close()
        conn.close()    

@router.post("/availability")
def update_availability(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = data["employee_id"]
        day_of_week = data["day_of_week"]
        preferred_shift = data["preferred_shift"]
        is_available = data["is_available"]
        account = data["account"]

        cursor.execute("""
            SELECT availability_id
            FROM availability
            WHERE employee_id = %s
                AND account = %s
                AND day_of_week = %s
                AND preferred_shift = %s
        """, (employee_id, account, day_of_week, preferred_shift))

        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE availability
                SET is_available = %s
                WHERE availability_id = %s
            """, (is_available, existing[0]))

        else:
            cursor.execute("""
                INSERT INTO availability (
                    employee_id,
                    account,
                    day_of_week,
                    preferred_shift,
                    is_available
                )
                VALUES (%s, %s, %s, %s, %s)
            """, (
                employee_id,
                account,
                day_of_week,
                preferred_shift,
                is_available
            ))

        conn.commit()

        return {"message": "Availability saved"}

    except Exception as e:
        conn.rollback()
        print("ERROR:", e)
        raise HTTPException(status_code=500, detail="Failed to update availability")

    finally:
        cursor.close()
        conn.close()
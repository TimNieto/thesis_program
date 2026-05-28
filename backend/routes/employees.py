# backend/routes/employees.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from passlib.hash import bcrypt
from services.notification_service import create_notification
import traceback
import hashlib

router = APIRouter()

# ✅ ADD THIS FUNCTION
def hash_password(password: str) -> str:
    prehashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return bcrypt.hash(prehashed)

# ✅ ADD THIS TOO (for verification)
def verify_password(password: str, hashed: str) -> bool:
    import hashlib

    # 1. Try new system (SHA256 → bcrypt)
    try:
        prehashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if bcrypt.verify(prehashed, hashed):
            return True
    except Exception:
        pass

    # 2. Try old bcrypt
    try:
        if hashed.startswith("$2"):
            if bcrypt.verify(password, hashed):
                return True
    except Exception:
        pass

    # 3. Try plain text (VERY IMPORTANT)
    if password == hashed:
        return True

    return False

# GET all employees
@router.get("/employees")
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id, full_name, email, main_role, employment_status, joined_date
            FROM employees
            WHERE employment_status = 'Active'
            ORDER BY employee_id
        """)
        rows = cursor.fetchall()

        employees = [
            {
                "id": r[0],
                "name": r[1],
                "email": r[2],
                "role": r[3],
                "status": "Active",
                "totalShifts": 0,
                "joinedDate": str(r[5]) if r[5] else None,
                "accountType": "Employee"
            }
            for r in rows
        ]

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
            SELECT employee_id, full_name, email, main_role, contact_number
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))
        
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "contactNumber": row[4]
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

# ADD employee
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

        # -------------------------
        # VALIDATIONS
        # -------------------------

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

        # -------------------------
        # ROLE RULES
        # -------------------------

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

        # -------------------------
        # CAPABILITIES
        # -------------------------

        can_be_host = host_account is not None
        can_be_operator = operator_account is not None

        # -------------------------
        # EXISTING EMAIL CHECK
        # -------------------------

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

        # -------------------------
        # INSERT
        # -------------------------

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

# DELETE employee
@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # ✅ 1. Check if employee exists
        cursor.execute(
            "SELECT employment_status FROM employees WHERE employee_id = %s",
            (employee_id,)
        )
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        current_status = row[0]

        # ✅ 2. Prevent redundant updates
        if current_status == "Inactive":
            return {"message": "Employee already inactive"}

        # ✅ 3. Soft delete (mark as inactive)
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


# UPDATE role
@router.put("/employees/{employee_id}/role")
def update_role(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "UPDATE employees SET main_role = %s WHERE employee_id = %s",
            (data["role"], employee_id)
        )
        conn.commit()

        return {"message": "Role updated"}

    finally:
        cursor.close()
        conn.close()

# UPDATE employee profile
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

# CHANGE PASSWORD   
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

        current = data.get("currentPassword")
        new_password = data.get("newPassword")

        # ✅ validate + trim
        if not current or not new_password or not current.strip() or not new_password.strip():
            raise HTTPException(status_code=400, detail="Missing fields")

        current = current.strip()
        new_password = new_password.strip()

        # check if stored password is bcrypt (starts with $2b$ or $2a$)
        if not verify_password(current, stored_password):
            raise HTTPException(status_code=400, detail="Incorrect current password")
        
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # store new password as hashed
        cursor.execute(
            "UPDATE employees SET password = %s WHERE employee_id = %s",
            (hash_password(new_password), employee_id)
        )

        conn.commit()

        return {"message": "Password updated"}

    except HTTPException:
        raise  # ✅ preserve original error

    except Exception as e:
        conn.rollback()
        traceback.print_exc()   # 👈 prints real error in Railway logs
        raise HTTPException(status_code=500, detail=str(e))

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

        # 🔍 Check if record already exists
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
            # 🔄 UPDATE existing row
            cursor.execute("""
                UPDATE availability
                SET is_available = %s
                WHERE availability_id = %s
            """, (is_available, existing[0]))

        else:
            # ➕ INSERT new row
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
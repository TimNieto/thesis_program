# backend/routes/employees.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from passlib.hash import bcrypt
import traceback

router = APIRouter()

# GET all employees
@router.get("/employees")
def get_employees():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id, full_name, email, main_role, employment_status
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
                "joinedDate": "2025-01-01",
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

# ADD employee
@router.post("/employees")
def add_employee(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        role = data["role"]

        can_be_host = role in ["Host", "Both"]
        can_be_operator = role in ["Operator", "Both"]

        cursor.execute("""
            INSERT INTO employees 
            (full_name, email, main_role, password, employment_status, can_be_host, can_be_operator, contact_number)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data["name"],
            data["email"],
            role,
            bcrypt.hash("1234"),
            "Active",
            can_be_host,
            can_be_operator,
            data.get("contactNumber")
        ))

        conn.commit()

        return {"message": "Employee added"}

    except Exception as e:
        conn.rollback()
        print("ERROR:", e) 
        raise HTTPException(status_code=500, detail=str(e))

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

        is_valid = False

        # check if stored password is bcrypt (starts with $2b$ or $2a$)
        if stored_password.startswith("$2"):
            try:
                if bcrypt.verify(current, stored_password):
                    is_valid = True
            except Exception:
                pass
        else:
            # legacy plain password
            if current == stored_password:
                is_valid = True

        if not is_valid:
            raise HTTPException(status_code=400, detail="Incorrect current password")
        
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        if len(new_password) > 72:
            raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters")

        # store new password as hashed
        cursor.execute(
            "UPDATE employees SET password = %s WHERE employee_id = %s",
            (bcrypt.hash(new_password), employee_id)
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
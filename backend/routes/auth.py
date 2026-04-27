# backend/routes/auth.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.database import get_connection
from passlib.hash import bcrypt

router = APIRouter()

def verify_password(password: str, hashed: str) -> bool:
    # ✅ support old plain text users
    if password == hashed:
        return True

    # ✅ bcrypt (new passwords)
    try:
        return bcrypt.verify(password, hashed)
    except Exception:
        return False

class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(data: ChangePasswordRequest):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # 1. Get current password
        cursor.execute(
            "SELECT password FROM employees WHERE employee_id = %s",
            (data.user_id,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        db_password = user[0]

        # 2. Verify current password
        if not verify_password(data.current_password, db_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # 3. Validate new password
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        # 4. ✅ Hash new password (THIS FIXES YOUR ERROR)
        new_hashed_password = bcrypt.hash(data.new_password)

        # 5. Save to database
        cursor.execute(
            "UPDATE employees SET password = %s WHERE employee_id = %s",
            (new_hashed_password, data.user_id)
        )
        conn.commit()

        return {"message": "Password changed successfully"}

    finally:
        cursor.close()
        conn.close()

@router.post("/login")
def login(data: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT employee_id, full_name, password, main_role FROM employees WHERE email = %s",
            (data.email,)
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        employee_id, full_name, db_password, main_role = user

        if not verify_password(data.password, db_password):
            raise HTTPException(status_code=401, detail="Invalid password")

        role_map = {
            "Team Leader": "admin",
            "Host": "host",
            "Operator": "operator"
        }

        role = role_map.get(main_role, "employee")

        return {
            "message": "Login successful",
            "role": role,                 # system role (admin, host, etc.)
            "displayRole": main_role,     # 👈 ADD THIS (Human readable)
            "user": {
                "id": employee_id,
                "name": full_name
            }
        }

    finally:
        cursor.close()
        conn.close()
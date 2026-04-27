# backend/routes/auth.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.database import get_connection
from passlib.hash import bcrypt
import hashlib

router = APIRouter()

def verify_password(password: str, hashed: str) -> bool:
    # ✅ VERY OLD (plain text fallback FIRST)
    if password == hashed:
        return True

    # ✅ OLD method (bcrypt only)
    try:
        if bcrypt.verify(password, hashed):
            return True
    except Exception:
        pass

    # ✅ NEW method (SHA256 + bcrypt)
    try:
        prehashed = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if bcrypt.verify(prehashed, hashed):
            return True
    except Exception:
        pass

    return False

class LoginRequest(BaseModel):
    email: str
    password: str

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
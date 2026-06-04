# backend/routes/auth.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.database import get_connection
from passlib.hash import bcrypt

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

def verify_password(password: str, hashed: str) -> bool:
    if password == hashed:
        return True
    try:
        return bcrypt.verify(password, hashed)
    except Exception:
        return False

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
            "role": role,
            "displayRole": main_role,
            "user": {
                "id": employee_id,
                "name": full_name
            }
        }

    finally:
        cursor.close()
        conn.close()
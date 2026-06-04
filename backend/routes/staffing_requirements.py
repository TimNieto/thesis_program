# backend/routes/staffing_requirements.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


def normalize_role_key(role_name: str) -> str:
    return role_name.strip().lower().replace(" ", "_")


@router.get("/staffing-requirements")
def get_staffing_requirements():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                sr.staffing_role_id,
                sr.role_name,
                sr.role_key,
                sr.is_active
            FROM staffing_roles sr
            WHERE sr.is_active = TRUE
            ORDER BY sr.staffing_role_id
        """)

        roles = [
            {
                "staffing_role_id": r[0],
                "role_name": r[1],
                "role_key": r[2],
                "is_active": r[3]
            }
            for r in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT
                ssr.requirement_id,
                st.shift_template_id,
                st.shift_name,
                sr.staffing_role_id,
                sr.role_name,
                sr.role_key,
                ssr.required_count,
                ssr.is_active
            FROM shift_staffing_requirements ssr

            JOIN shift_templates st
                ON ssr.shift_template_id = st.shift_template_id

            JOIN staffing_roles sr
                ON ssr.staffing_role_id = sr.staffing_role_id

            WHERE st.is_active = TRUE
            AND sr.is_active = TRUE
            AND ssr.is_active = TRUE

            ORDER BY st.start_time, sr.staffing_role_id
        """)

        requirements = [
            {
                "requirement_id": r[0],
                "shift_template_id": r[1],
                "shift_name": r[2],
                "staffing_role_id": r[3],
                "role_name": r[4],
                "role_key": r[5],
                "required_count": r[6],
                "is_active": r[7]
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
        role_name = payload.get("role_name", "").strip()

        if not role_name:
            raise HTTPException(
                status_code=400,
                detail="Role name required"
            )

        role_key = normalize_role_key(role_name)

        cursor.execute("""
            SELECT
                staffing_role_id,
                is_active
            FROM staffing_roles
            WHERE LOWER(role_key) = LOWER(%s)
        """, (role_key,))

        existing = cursor.fetchone()

        if existing:
            staffing_role_id = existing[0]
            is_active = existing[1]

            if is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Role already exists"
                )

            cursor.execute("""
                UPDATE staffing_roles
                SET
                    role_name = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE staffing_role_id = %s
            """, (
                role_name,
                staffing_role_id
            ))

        else:
            cursor.execute("""
                INSERT INTO staffing_roles (
                    role_name,
                    role_key,
                    is_active
                )
                VALUES (%s, %s, TRUE)
                RETURNING staffing_role_id
            """, (
                role_name,
                role_key
            ))

            staffing_role_id = cursor.fetchone()[0]

        cursor.execute("""
            SELECT shift_template_id
            FROM shift_templates
            WHERE is_active = TRUE
        """)

        shift_templates = cursor.fetchall()

        for template in shift_templates:
            cursor.execute("""
                INSERT INTO shift_staffing_requirements (
                    shift_template_id,
                    staffing_role_id,
                    required_count,
                    is_active
                )
                VALUES (%s, %s, 1, TRUE)

                ON CONFLICT (
                    shift_template_id,
                    staffing_role_id
                )

                DO UPDATE SET
                    is_active = TRUE,
                    updated_at = NOW()
            """, (
                template[0],
                staffing_role_id
            ))

        conn.commit()

        return {
            "message": "Role saved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save staffing role"
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/staffing-roles/{staffing_role_id}")
def delete_staffing_role(staffing_role_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT staffing_role_id
            FROM staffing_roles
            WHERE staffing_role_id = %s
        """, (staffing_role_id,))

        role = cursor.fetchone()

        if not role:
            raise HTTPException(
                status_code=404,
                detail="Role not found"
            )

        cursor.execute("""
            UPDATE staffing_roles
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE staffing_role_id = %s
        """, (staffing_role_id,))

        cursor.execute("""
            UPDATE shift_staffing_requirements
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE staffing_role_id = %s
        """, (staffing_role_id,))

        conn.commit()

        return {
            "message": "Role removed"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to remove staffing role"
        )

    finally:
        cursor.close()
        conn.close()


@router.put("/staffing-requirements")
def update_staffing_requirements(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        requirements = payload.get("requirements", [])

        if not isinstance(requirements, list):
            raise HTTPException(
                status_code=400,
                detail="requirements must be a list"
            )

        for item in requirements:
            shift_template_id = item.get("shift_template_id")
            staffing_role_id = item.get("staffing_role_id")
            required_count = item.get("required_count")

            if not shift_template_id or not staffing_role_id:
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

            cursor.execute("""
                INSERT INTO shift_staffing_requirements (
                    shift_template_id,
                    staffing_role_id,
                    required_count,
                    is_active
                )
                VALUES (%s, %s, %s, TRUE)

                ON CONFLICT (
                    shift_template_id,
                    staffing_role_id
                )

                DO UPDATE SET
                    required_count = EXCLUDED.required_count,
                    is_active = TRUE,
                    updated_at = NOW()
            """, (
                shift_template_id,
                staffing_role_id,
                required_count
            ))

        conn.commit()

        return {
            "message": "Staffing requirements saved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save staffing requirements"
        )

    finally:
        cursor.close()
        conn.close()
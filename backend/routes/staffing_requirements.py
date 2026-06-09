# backend/routes/staffing_requirements.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


def normalize_role_key(role_name: str) -> str:
    return role_name.strip().lower().replace(" ", "_")


@router.get("/staffing-requirements")
def get_staffing_requirements(company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Return all active company roles for the Admin Dashboard Roles section.
        # Keep staffing_role_id for frontend compatibility.
        cursor.execute("""
            SELECT
                r.role_id,
                r.role_name,
                r.role_key,
                r.is_active,
                r.is_admin
            FROM roles r
            WHERE r.company_id = %s
            AND r.is_active = TRUE
            ORDER BY r.role_id
        """, (company_id,))

        roles = [
            {
                "staffing_role_id": r[0],
                "role_id": r[0],
                "role_name": r[1],
                "role_key": r[2],
                "is_active": r[3],
                "is_admin": r[4]
            }
            for r in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT
                ssr.requirement_id,
                st.shift_template_id,
                st.shift_name,
                r.role_id,
                r.role_name,
                r.role_key,
                ssr.required_count,
                ssr.is_active,
                a.account_id,
                a.account_name
            FROM shift_staffing_requirements ssr

            JOIN shift_templates st
                ON ssr.shift_template_id = st.shift_template_id
                AND ssr.company_id = st.company_id

            JOIN roles r
                ON ssr.role_id = r.role_id
                AND ssr.company_id = r.company_id

            JOIN accounts a
                ON ssr.account_id = a.account_id
                AND ssr.company_id = a.company_id

            WHERE ssr.company_id = %s
            AND st.is_active = TRUE
            AND r.is_active = TRUE
            AND a.is_active = TRUE
            AND ssr.is_active = TRUE

            ORDER BY
                a.account_id,
                st.start_time,
                r.role_id
        """, (company_id,))

        requirements = [
            {
                "requirement_id": r[0],
                "shift_template_id": r[1],
                "shift_name": r[2],
                "staffing_role_id": r[3],
                "role_id": r[3],
                "role_name": r[4],
                "role_key": r[5],
                "required_count": r[6],
                "is_active": r[7],
                "account_id": r[8],
                "account_name": r[9]
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
        company_id = payload.get("company_id", 1)
        role_name = payload.get("role_name", "").strip()

        if not role_name:
            raise HTTPException(
                status_code=400,
                detail="Role name required"
            )

        role_key = normalize_role_key(role_name)

        cursor.execute("""
            SELECT
                role_id,
                is_active
            FROM roles
            WHERE company_id = %s
            AND LOWER(role_key) = LOWER(%s)
        """, (company_id, role_key))

        existing = cursor.fetchone()

        if existing:
            role_id = existing[0]
            is_active = existing[1]

            if is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Role already exists"
                )

            cursor.execute("""
                UPDATE roles
                SET
                    role_name = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                AND role_id = %s
            """, (
                role_name,
                company_id,
                role_id
            ))

        else:
            cursor.execute("""
                INSERT INTO roles (
                    company_id,
                    role_name,
                    role_key,
                    is_active
                )
                VALUES (%s, %s, %s, TRUE)
                RETURNING role_id
            """, (
                company_id,
                role_name,
                role_key
            ))

            role_id = cursor.fetchone()[0]

        # Create default requirement rows for every active account + shift template
        cursor.execute("""
            INSERT INTO shift_staffing_requirements (
                company_id,
                account_id,
                shift_template_id,
                role_id,
                required_count,
                is_active
            )
            SELECT
                a.company_id,
                a.account_id,
                st.shift_template_id,
                %s,
                1,
                TRUE
            FROM accounts a
            JOIN shift_templates st
                ON st.company_id = a.company_id
                AND st.is_active = TRUE
            WHERE a.company_id = %s
            AND a.is_active = TRUE
            AND NOT EXISTS (
                SELECT 1
                FROM shift_staffing_requirements ssr
                WHERE ssr.company_id = a.company_id
                AND ssr.account_id = a.account_id
                AND ssr.shift_template_id = st.shift_template_id
                AND ssr.role_id = %s
            )
        """, (
            role_id,
            company_id,
            role_id
        ))

        conn.commit()

        return {
            "message": "Role saved",
            "role_id": role_id,
            "staffing_role_id": role_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE STAFFING ROLE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/staffing-roles/{staffing_role_id}")
def delete_staffing_role(staffing_role_id: int, company_id: int = 1):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT role_id
            FROM roles
            WHERE role_id = %s
            AND company_id = %s
        """, (
            staffing_role_id,
            company_id
        ))

        role = cursor.fetchone()

        if not role:
            raise HTTPException(
                status_code=404,
                detail="Role not found"
            )

        cursor.execute("""
            UPDATE roles
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE role_id = %s
            AND company_id = %s
        """, (
            staffing_role_id,
            company_id
        ))

        cursor.execute("""
            UPDATE shift_staffing_requirements
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE role_id = %s
            AND company_id = %s
        """, (
            staffing_role_id,
            company_id
        ))

        conn.commit()

        return {
            "message": "Role removed"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DELETE STAFFING ROLE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.put("/staffing-requirements")
def update_staffing_requirements(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id", 1)
        requirements = payload.get("requirements", [])

        if not isinstance(requirements, list):
            raise HTTPException(
                status_code=400,
                detail="requirements must be a list"
            )

        for item in requirements:
            shift_template_id = item.get("shift_template_id")
            role_id = item.get("role_id") or item.get("staffing_role_id")
            account_id = item.get("account_id")
            required_count = item.get("required_count")

            if not shift_template_id or not role_id:
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

            # If account_id is provided, update one account only.
            if account_id:
                cursor.execute("""
                    INSERT INTO shift_staffing_requirements (
                        company_id,
                        account_id,
                        shift_template_id,
                        role_id,
                        required_count,
                        is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, TRUE)

                    ON CONFLICT (
                        company_id,
                        account_id,
                        shift_template_id,
                        role_id
                    )

                    DO UPDATE SET
                        required_count = EXCLUDED.required_count,
                        is_active = TRUE,
                        updated_at = NOW()
                """, (
                    company_id,
                    account_id,
                    shift_template_id,
                    role_id,
                    required_count
                ))

            # If account_id is missing, apply the same count to all active accounts.
            else:
                cursor.execute("""
                    SELECT account_id
                    FROM accounts
                    WHERE company_id = %s
                    AND is_active = TRUE
                """, (company_id,))

                accounts = cursor.fetchall()

                for account in accounts:
                    cursor.execute("""
                        INSERT INTO shift_staffing_requirements (
                            company_id,
                            account_id,
                            shift_template_id,
                            role_id,
                            required_count,
                            is_active
                        )
                        VALUES (%s, %s, %s, %s, %s, TRUE)

                        ON CONFLICT (
                            company_id,
                            account_id,
                            shift_template_id,
                            role_id
                        )

                        DO UPDATE SET
                            required_count = EXCLUDED.required_count,
                            is_active = TRUE,
                            updated_at = NOW()
                    """, (
                        company_id,
                        account[0],
                        shift_template_id,
                        role_id,
                        required_count
                    ))

        conn.commit()

        return {
            "message": "Staffing requirements saved"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("UPDATE STAFFING REQUIREMENTS ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
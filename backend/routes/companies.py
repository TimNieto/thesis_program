# backend/routes/companies.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


@router.get("/companies")
def get_companies():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                c.company_id,
                c.company_name,
                c.company_type,
                c.created_at,
                c.is_active,
                COUNT(e.employee_id) AS employee_count
            FROM companies c
            LEFT JOIN employees e
                ON c.company_id = e.company_id
                AND e.employment_status = 'Active'
            GROUP BY
                c.company_id,
                c.company_name,
                c.company_type,
                c.created_at,
                c.is_active
            ORDER BY c.company_id ASC
        """)

        rows = cursor.fetchall()

        return [
            {
                "company_id": r[0],
                "company_name": r[1],
                "company_type": r[2],
                "created_at": str(r[3]),
                "is_active": r[4],
                "employee_count": r[5],
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/companies")
def create_company(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_name = payload.get("company_name", "").strip()
        company_type = payload.get("company_type", "").strip()

        if not company_name:
            raise HTTPException(status_code=400, detail="Company name required")

        if not company_type:
            raise HTTPException(status_code=400, detail="Company type required")

        cursor.execute("""
            INSERT INTO companies (
                company_name,
                company_type,
                is_active
            )
            VALUES (%s, %s, TRUE)
            RETURNING company_id
        """, (company_name, company_type))

        company_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO company_settings (
                company_id,
                max_working_days,
                max_shifts_per_day,
                max_shifts_per_week,
                allow_double_shifts,
                fairness_weight,
                absence_replacement_mode,
                enable_in_app_notifications,
                gy_fatigue_penalty
            )
            VALUES (%s, 7, 2, 7, FALSE, 2, 'Automatic', TRUE, 20)
        """, (company_id,))

        conn.commit()

        return {
            "message": "Company created",
            "company_id": company_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()


@router.put("/companies/{company_id}/toggle-status")
def toggle_company_status(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE companies
            SET
                is_active = NOT is_active,
                updated_at = NOW()
            WHERE company_id = %s
            RETURNING company_id
        """, (company_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Company not found")

        conn.commit()

        return {"message": "Company status updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


@router.get("/holidays")
def get_company_holidays(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        cursor.execute("""
            SELECT
                holiday_id,
                company_id,
                holiday_name,
                holiday_date,
                is_active
            FROM company_holidays
            WHERE company_id = %s
            AND is_active = TRUE
            ORDER BY holiday_date ASC, holiday_name ASC
        """, (company_id,))

        return [
            {
                "holiday_id": row[0],
                "company_id": row[1],
                "holiday_name": row[2],
                "holiday_date": str(row[3]),
                "is_active": row[4],
            }
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/holidays")
def create_company_holiday(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        holiday_name = str(
            payload.get("holiday_name")
            or payload.get("name")
            or ""
        ).strip()
        holiday_date = payload.get("holiday_date") or payload.get("date")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not holiday_name:
            raise HTTPException(
                status_code=400,
                detail="Holiday name is required"
            )

        if not holiday_date:
            raise HTTPException(
                status_code=400,
                detail="Holiday date is required"
            )

        cursor.execute("""
            SELECT company_id
            FROM companies
            WHERE company_id = %s
            AND is_active = TRUE
            LIMIT 1
        """, (company_id,))

        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail="Company not found"
            )

        cursor.execute("""
            INSERT INTO company_holidays (
                company_id,
                holiday_name,
                holiday_date,
                is_active
            )
            VALUES (%s, %s, %s, TRUE)
            ON CONFLICT (company_id, holiday_date)
            DO UPDATE SET
                holiday_name = EXCLUDED.holiday_name,
                is_active = TRUE,
                updated_at = NOW()
            RETURNING
                holiday_id,
                company_id,
                holiday_name,
                holiday_date,
                is_active
        """, (
            company_id,
            holiday_name,
            holiday_date
        ))

        row = cursor.fetchone()

        conn.commit()

        return {
            "message": "Holiday saved",
            "holiday": {
                "holiday_id": row[0],
                "company_id": row[1],
                "holiday_name": row[2],
                "holiday_date": str(row[3]),
                "is_active": row[4],
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE HOLIDAY ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to save holiday"
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/holidays/{holiday_id}")
def delete_company_holiday(holiday_id: int, company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        cursor.execute("""
            UPDATE company_holidays
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE holiday_id = %s
            AND company_id = %s
            AND is_active = TRUE
            RETURNING holiday_id
        """, (
            holiday_id,
            company_id
        ))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Holiday not found"
            )

        conn.commit()

        return {
            "message": "Holiday removed",
            "holiday_id": holiday_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DELETE HOLIDAY ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to remove holiday"
        )

    finally:
        cursor.close()
        conn.close()
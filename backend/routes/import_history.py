#---------------------------------------------
# backend/routes/import_history.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection

router = APIRouter()


@router.get("/import-history")
def get_import_history(company_id: int, limit: int = 5):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if limit < 1:
            limit = 5

        if limit > 20:
            limit = 20

        cursor.execute("""
            SELECT
                ih.import_history_id,
                ih.category,
                ih.file_name,
                ih.row_count,
                ih.status,
                ih.error_message,
                ih.imported_at,
                e.full_name
            FROM import_history ih
            LEFT JOIN employees e
                ON ih.imported_by_employee_id = e.employee_id
                AND ih.company_id = e.company_id
            WHERE ih.company_id = %s
            ORDER BY ih.imported_at DESC
            LIMIT %s
        """, (
            company_id,
            limit
        ))

        rows = cursor.fetchall()

        return [
            {
                "id": str(row[0]),
                "category": row[1],
                "fileName": row[2],
                "rowCount": row[3],
                "status": row[4],
                "errorMessage": row[5],
                "importedAt": str(row[6]),
                "importedBy": row[7] or "Unknown"
            }
            for row in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/import-history")
def create_import_history(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        imported_by_employee_id = payload.get("imported_by_employee_id")
        category = str(payload.get("category", "")).strip()
        file_name = str(payload.get("file_name", "")).strip()
        row_count = payload.get("row_count", 0)
        status = str(payload.get("status", "")).strip().lower()
        error_message = payload.get("error_message")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not category:
            raise HTTPException(
                status_code=400,
                detail="category is required"
            )

        if not file_name:
            raise HTTPException(
                status_code=400,
                detail="file_name is required"
            )

        if status not in ["success", "error"]:
            raise HTTPException(
                status_code=400,
                detail="status must be success or error"
            )

        try:
            row_count = int(row_count)
        except ValueError:
            row_count = 0

        if row_count < 0:
            row_count = 0

        cursor.execute("""
            INSERT INTO import_history (
                company_id,
                imported_by_employee_id,
                category,
                file_name,
                row_count,
                status,
                error_message
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING import_history_id, imported_at
        """, (
            company_id,
            imported_by_employee_id,
            category,
            file_name,
            row_count,
            status,
            error_message
        ))

        row = cursor.fetchone()

        conn.commit()

        return {
            "message": "Import history saved",
            "id": str(row[0]),
            "importedAt": str(row[1])
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE IMPORT HISTORY ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
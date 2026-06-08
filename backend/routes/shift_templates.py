#---------------------------------------------
# backend/routes/shift_templates.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from datetime import datetime

router = APIRouter()

@router.get("/shift-templates")
def get_shift_templates(company_id: int = 1):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT
                shift_template_id,
                shift_name,
                start_time,
                end_time
            FROM shift_templates
            WHERE company_id = %s
            AND is_active = TRUE
            ORDER BY display_order, start_time
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "shift_template_id": r[0],
                "shift_name": r[1],
                "start_time": str(r[2]),
                "end_time": str(r[3])
            }
            for r in rows
        ]

    finally:
        cursor.close()
        conn.close()

def time_to_minutes(t):

    return t.hour * 60 + t.minute

def build_time_ranges(start, end):

    s = time_to_minutes(start)
    e = time_to_minutes(end)

    if e > s:
        return [
            (s, e)
        ]

    return [
        (s, 1440),
        (0, e)
    ]


def is_overlap(start1, end1, start2, end2):

    ranges1 = build_time_ranges(start1, end1)
    ranges2 = build_time_ranges(start2, end2)

    for s1, e1 in ranges1:
        for s2, e2 in ranges2:

            if max(s1, s2) < min(e1, e2):
                return True

    return False

def parse_time_string(value: str):

    value = value.strip()

    formats = [
        "%H:%M",
        "%H:%M:%S"
    ]

    for fmt in formats:

        try:
            return datetime.strptime(
                value,
                fmt
            ).time()

        except ValueError:
            pass

    raise HTTPException(
        status_code=400,
        detail=f"Invalid time format: {value}"
    )

@router.post("/shift-templates")
def create_shift_template(payload: dict):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        shift_name = payload.get(
            "shift_name",
            ""
        ).strip().upper()

        if not shift_name:
            raise HTTPException(
                status_code=400,
                detail="Shift name required"
            )

        if len(shift_name) > 20:
            raise HTTPException(
                status_code=400,
                detail="Shift name too long"
            )

        start_time = payload.get("start_time")
        end_time = payload.get("end_time")

        if not start_time or not end_time:

            raise HTTPException(
                status_code=400,
                detail="Start and end time required"
            )

        # PARSE TIMES
        start_time_obj = parse_time_string(start_time)
        end_time_obj = parse_time_string(end_time)

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        # CHECK EXISTING NAME, ACTIVE OR INACTIVE
        cursor.execute("""
            SELECT
                shift_template_id,
                is_active
            FROM shift_templates
            WHERE LOWER(shift_name) = LOWER(%s)
        """, (shift_name,))

        existing_template = cursor.fetchone()

        if existing_template:

            existing_id = existing_template[0]
            existing_is_active = existing_template[1]

            if existing_is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Shift already exists"
                )

            # CHECK OVERLAPS EXCLUDING THIS INACTIVE TEMPLATE
            cursor.execute("""
                SELECT
                    shift_name,
                    start_time,
                    end_time
                FROM shift_templates
                WHERE is_active = TRUE
                AND shift_template_id != %s
            """, (existing_id,))

            existing_active_templates = cursor.fetchall()

            for row in existing_active_templates:

                existing_name = row[0]
                existing_start = row[1]
                existing_end = row[2]

                if is_overlap(
                    start_time_obj,
                    end_time_obj,
                    existing_start,
                    existing_end
                ):

                    raise HTTPException(
                        status_code=400,
                        detail=f"Overlaps with {existing_name}"
                    )

            # RESTORE SOFT-DELETED TEMPLATE
            cursor.execute("""
                UPDATE shift_templates
                SET
                    start_time = %s,
                    end_time = %s,
                    is_active = TRUE,
                    updated_at = NOW()
                WHERE shift_template_id = %s
                RETURNING
                    shift_template_id,
                    shift_name,
                    start_time,
                    end_time
            """, (
                start_time_obj,
                end_time_obj,
                existing_id
            ))

            restored = cursor.fetchone()

            conn.commit()

            return {
                "shift_template_id": restored[0],
                "shift_name": restored[1],
                "start_time": str(restored[2]),
                "end_time": str(restored[3])
            }

        # CHECK OVERLAPS
        cursor.execute("""
            SELECT
                shift_name,
                start_time,
                end_time
            FROM shift_templates
            WHERE is_active = TRUE
        """)

        existing = cursor.fetchall()

        for row in existing:

            existing_name = row[0]
            existing_start = row[1]
            existing_end = row[2]

            if is_overlap(
                start_time_obj,
                end_time_obj,
                existing_start,
                existing_end
            ):

                raise HTTPException(
                    status_code=400,
                    detail=f"Overlaps with {existing_name}"
                )

        # INSERT
        cursor.execute("""
            INSERT INTO shift_templates (
                shift_name,
                start_time,
                end_time
            )
            VALUES (%s, %s, %s)
            RETURNING
                shift_template_id,
                shift_name,
                start_time,
                end_time
        """, (
            shift_name,
            start_time_obj,
            end_time_obj
        ))

        created = cursor.fetchone()

        conn.commit()

        return {
            "shift_template_id": created[0],
            "shift_name": created[1],
            "start_time": str(created[2]),
            "end_time": str(created[3])
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create shift template"
        )

    finally:
        cursor.close()
        conn.close()

@router.put("/shift-templates/{shift_template_id}")
def update_shift_template(
    shift_template_id: int,
    payload: dict
):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        shift_name = payload.get(
            "shift_name",
            ""
        ).strip().upper()

        start_time = payload.get("start_time")
        end_time = payload.get("end_time")

        if not shift_name:
            raise HTTPException(
                status_code=400,
                detail="Shift name required"
            )

        if len(shift_name) > 20:
            raise HTTPException(
                status_code=400,
                detail="Shift name too long"
            )

        start_time_obj = parse_time_string(start_time)
        end_time_obj = parse_time_string(end_time)

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        # DUPLICATE NAME CHECK - ACTIVE OR INACTIVE
        cursor.execute("""
            SELECT
                shift_template_id,
                is_active
            FROM shift_templates
            WHERE LOWER(shift_name) = LOWER(%s)
            AND shift_template_id != %s
        """, (
            shift_name,
            shift_template_id
        ))

        existing_name = cursor.fetchone()

        if existing_name:

            existing_is_active = existing_name[1]

            if existing_is_active:
                raise HTTPException(
                    status_code=400,
                    detail="Shift already exists"
                )

            raise HTTPException(
                status_code=400,
                detail="A deleted shift with this name already exists. Add it again using Add Shift instead."
            )

        # OVERLAP CHECK
        cursor.execute("""
            SELECT
                shift_template_id,
                shift_name,
                start_time,
                end_time
            FROM shift_templates
            WHERE shift_template_id != %s
            AND is_active = TRUE
        """, (shift_template_id,))

        rows = cursor.fetchall()

        for row in rows:

            existing_name = row[1]
            existing_start = row[2]
            existing_end = row[3]

            if is_overlap(
                start_time_obj,
                end_time_obj,
                existing_start,
                existing_end
            ):

                raise HTTPException(
                    status_code=400,
                    detail=f"Overlaps with {existing_name}"
                )

        # UPDATE TEMPLATE
        cursor.execute("""
            UPDATE shift_templates
            SET
                shift_name = %s,
                start_time = %s,
                end_time = %s
            WHERE shift_template_id = %s
        """, (
            shift_name,
            start_time_obj,
            end_time_obj,
            shift_template_id
        ))

        conn.commit()

        return {
            "message": "Shift template updated"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update shift template"
        )

    finally:
        cursor.close()
        conn.close()

@router.delete("/shift-templates/{shift_template_id}")
def delete_shift_template(shift_template_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT shift_template_id
            FROM shift_templates
            WHERE shift_template_id = %s
        """, (shift_template_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Shift template not found"
            )

        cursor.execute("""
            UPDATE shift_templates
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE shift_template_id = %s
        """, (shift_template_id,))

        conn.commit()

        return {
            "message": "Shift template deleted successfully"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete shift template"
        )

    finally:
        cursor.close()
        conn.close()
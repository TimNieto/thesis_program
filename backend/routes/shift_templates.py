# backend/routes/shift_templates.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from datetime import datetime

router = APIRouter()

@router.get("/shift-templates")
def get_shift_templates():

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
            ORDER BY start_time
        """)

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

def is_overlap(start1, end1, start2, end2):

    s1 = time_to_minutes(start1)
    e1 = time_to_minutes(end1)

    s2 = time_to_minutes(start2)
    e2 = time_to_minutes(end2)

    # HANDLE OVERNIGHT
    if e1 <= s1:
        e1 += 1440

    if e2 <= s2:
        e2 += 1440

    return max(s1, s2) < min(e1, e2)

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
        start_time_obj = datetime.strptime(
            start_time,
            "%H:%M"
        ).time()

        end_time_obj = datetime.strptime(
            end_time,
            "%H:%M"
        ).time()

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        # CHECK DUPLICATE NAME
        cursor.execute("""
            SELECT shift_template_id
            FROM shift_templates
            WHERE LOWER(shift_name) = LOWER(%s)
        """, (shift_name,))

        if cursor.fetchone():

            raise HTTPException(
                status_code=400,
                detail="Shift already exists"
            )

        # CHECK OVERLAPS
        cursor.execute("""
            SELECT
                shift_name,
                start_time,
                end_time
            FROM shift_templates
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
        """, (
            shift_name,
            start_time_obj,
            end_time_obj
        ))

        conn.commit()

        return {
            "message": "Shift template created"
        }

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

        start_time_obj = datetime.strptime(
            start_time,
            "%H:%M"
        ).time()

        end_time_obj = datetime.strptime(
            end_time,
            "%H:%M"
        ).time()

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        # DUPLICATE NAME CHECK
        cursor.execute("""
            SELECT shift_template_id
            FROM shift_templates
            WHERE LOWER(shift_name) = LOWER(%s)
            AND shift_template_id != %s
        """, (
            shift_name,
            shift_template_id
        ))

        if cursor.fetchone():

            raise HTTPException(
                status_code=400,
                detail="Shift already exists"
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

        # IMPORTANT:

        conn.commit()

        return {
            "message": "Shift template updated"
        }

    finally:
        cursor.close()
        conn.close()

@router.delete("/shift-templates/{shift_template_id}")
def delete_shift_template(shift_template_id: int):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        # --------------------------------
        # GET TEMPLATE INFO
        # --------------------------------
        cursor.execute("""
            SELECT shift_name
            FROM shift_templates
            WHERE shift_template_id = %s
        """, (shift_template_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Shift template not found"
            )

        shift_name = row[0]

        # --------------------------------
        # BLOCK DELETE IF ACTIVE SCHEDULES EXIST
        # --------------------------------
        cursor.execute("""
            SELECT gs.schedule_id
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
            WHERE s.shift_template_id = %s
            AND gs.is_archived = FALSE
            LIMIT 1
        """, (shift_template_id,))

        active_schedule = cursor.fetchone()

        if active_schedule:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete shift template used in active schedules"
            )

        # --------------------------------
        # DELETE FUTURE SHIFTS
        # --------------------------------
        cursor.execute("""
            DELETE FROM shifts
            WHERE shift_template_id = %s
            AND shift_date >= CURRENT_DATE
        """, (shift_template_id,))

        # --------------------------------
        # DELETE TEMPLATE
        # --------------------------------
        cursor.execute("""
            DELETE FROM shift_templates
            WHERE shift_template_id = %s
        """, (shift_template_id,))

        conn.commit()

        return {
            "message": "Shift template deleted successfully"
        }

    finally:
        cursor.close()
        conn.close()
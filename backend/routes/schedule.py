# backend/routes/schedule.py

from fastapi import APIRouter, HTTPException
from services.schedule_service import generate_weekly_schedule, get_generated_schedule
from db.database import get_connection

router = APIRouter()


@router.get("/generate-schedule")
def generate_schedule():
    try:
        result = generate_weekly_schedule()

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": result["grouped_schedule"],  # ✅ ADD THIS
            "unfilled_slots": result["unfilled_slots"]
        }

    except Exception as e:
        print("ERROR generating schedule:", e)
        raise HTTPException(status_code=500, detail=str(e)) 
    
@router.get("/generated-schedule")
def get_schedule():
    try:
        result = get_generated_schedule()

        return {
            "status": "success",
            "assignments": result["assignments"],
            "grouped_schedule": result["grouped_schedule"]
        }

    except Exception as e:
        print("ERROR loading generated schedule:", e)
        raise HTTPException(status_code=500, detail="Failed to load schedule")

    
@router.post("/request-cover/{schedule_id}")
def request_cover(schedule_id: int, payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    user_id = payload.get("user_id")
    reason = payload.get("reason")

    if not user_id:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="user_id is required")

    # prevent duplicate pending request
    cursor.execute("""
        SELECT 1 FROM coverage_requests
        WHERE schedule_id = %s
        AND requested_by = %s
        AND status = 'pending'
    """, (schedule_id, user_id))

    existing = cursor.fetchone()

    if existing:
        cursor.close()
        conn.close()
        return {"message": "Already requested"}

    # insert request
    cursor.execute("""
        INSERT INTO coverage_requests (schedule_id, requested_by, reason)
        VALUES (%s, %s, %s)
    """, (schedule_id, user_id, reason))

    conn.commit()

    cursor.close()
    conn.close()

    return {"message": "Cover request submitted"}

@router.get("/coverage-requests")
def get_requests():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            cr.id,
            e.full_name,
            s.name,
            s.start_time,
            s.end_time,
            gs.role,
            cr.reason,
            cr.status
        FROM coverage_requests cr
        JOIN employees e ON cr.requested_by = e.employee_id
        JOIN generated_schedule gs ON cr.schedule_id = gs.schedule_id
        JOIN shifts s ON gs.shift_id = s.shift_id
        ORDER BY cr.created_at DESC
    """)

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "requester": r[1],
            "shift": r[2],
            "start_time": str(r[3]),
            "end_time": str(r[4]),
            "role": r[5],
            "reason": r[6],
            "status": r[7],
        })

    return result

@router.post("/coverage-requests/{id}/approve")
def approve_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE coverage_requests
        SET status = 'approved', approved_at = NOW()
        WHERE id = %s
    """, (id,))

    conn.commit()

    cursor.close()
    conn.close()

    return {"message": "Approved"}

@router.post("/coverage-requests/{id}/deny")
def deny_request(id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE coverage_requests
        SET status = 'denied'
        WHERE id = %s
    """, (id,))

    conn.commit()

    cursor.close()
    conn.close()

    return {"message": "Denied"}

@router.post("/save-schedule")
def save_schedule(assignments: list):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM generated_schedule")

        for a in assignments:
            cursor.execute("""
                INSERT INTO generated_schedule (
                    shift_id,
                    employee_id,
                    role,
                    shift_date,
                    shift_type,
                    account
                )
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                a["shift_id"],
                a["employee_id"],
                a["role"],
                a["shift_date"],
                a["shift_type"],
                a["account"]
            ))

        conn.commit()

        return {"message": "Schedule saved"}

    finally:
        cursor.close()
        conn.close()
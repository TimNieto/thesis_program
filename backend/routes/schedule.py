# backend/routes/schedule.py

from fastapi import APIRouter, HTTPException
from services.schedule_service import generate_weekly_schedule

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
        raise HTTPException(status_code=500, detail="Failed to generate schedule")
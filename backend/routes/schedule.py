# backend/routes/schedule.py

from fastapi import APIRouter, HTTPException
from services.schedule_service import generate_weekly_schedule, get_generated_schedule

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
#---------------------------------------------
# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import (
    auth,
    employees,
    schedule,
    leaves,
    settings,
    accounts,
    shift_templates,
    staffing_requirements,
    notifications,
    companies,
    reports,
    import_history,
    permissions,
    holidays,
    manual_assignment_requests
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://visioncore.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(schedule.router)
app.include_router(leaves.router)
app.include_router(settings.router)
app.include_router(accounts.router)
app.include_router(shift_templates.router)
app.include_router(staffing_requirements.router)
app.include_router(notifications.router)
app.include_router(companies.router)
app.include_router(reports.router)
app.include_router(import_history.router)
app.include_router(permissions.router)
app.include_router(holidays.router)
app.include_router(manual_assignment_requests.router)

@app.get("/")
def root():
    return {"message": "Backend is working"}
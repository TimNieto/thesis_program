#---------------------------------------------
# backend/routes/permissions.py

from fastapi import APIRouter, HTTPException
from db.database import get_connection
from services.permission_service import (
    company_exists,
    get_company_permissions,
    update_company_permissions,
)

router = APIRouter()


def extract_permission_payload(payload: dict):
    tab_permissions = payload.get("tab_permissions") or {}

    role_permissions = (
        payload.get("rolePermissions")
        or payload.get("role_permissions")
        or {}
    )

    admin_tabs = (
        payload.get("admin_tab_permissions")
        or payload.get("adminTabs")
        or payload.get("hrTabs")
        or role_permissions.get("adminTabs")
        or role_permissions.get("hrTabs")
    )

    employee_tabs = (
        payload.get("employee_tab_permissions")
        or payload.get("employeeTabs")
        or payload.get("generalTabs")
        or role_permissions.get("employeeTabs")
        or role_permissions.get("generalTabs")
    )

    section_permissions = (
        payload.get("section_permissions")
        or payload.get("company_settings_section_permissions")
        or payload.get("companySections")
        or payload.get("companySettingsSections")
        or role_permissions.get("companySections")
        or role_permissions.get("companySettingsSections")
        or {}
    )

    if admin_tabs:
        tab_permissions["admin"] = admin_tabs

    if employee_tabs:
        tab_permissions["employee"] = employee_tabs

    return tab_permissions, section_permissions


@router.get("/permissions")
def get_permissions(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not company_exists(cursor, company_id):
            raise HTTPException(
                status_code=404,
                detail="Company not found"
            )

        permissions = get_company_permissions(cursor, company_id)

        conn.commit()

        return permissions

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("GET PERMISSIONS ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.put("/permissions")
def update_permissions(payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        company_id = int(company_id)

        if not company_exists(cursor, company_id):
            raise HTTPException(
                status_code=404,
                detail="Company not found"
            )

        tab_permissions, section_permissions = extract_permission_payload(payload)

        permissions = update_company_permissions(
            cursor,
            company_id,
            tab_permissions=tab_permissions,
            section_permissions=section_permissions
        )

        conn.commit()

        return {
            "message": "Permissions updated",
            **permissions
        }

    except HTTPException:
        conn.rollback()
        raise

    except ValueError as e:
        conn.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        conn.rollback()
        print("UPDATE PERMISSIONS ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
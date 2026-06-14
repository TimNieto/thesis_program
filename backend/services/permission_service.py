#---------------------------------------------
# backend/services/permission_service.py

ADMIN_TAB_KEYS = [
    "adminDashboard",
    "companySettings",
    "scheduleGenerator",
    "coverRequests",
    "reports",
    "profile",
]

EMPLOYEE_TAB_KEYS = [
    "scheduleGenerator",
    "coverRequests",
    "profile",
]

COMPANY_SETTINGS_SECTION_KEYS = [
    "companyProfile",
    "schedulingRules",
    "schedulerScoring",
    "accountSchedulingPolicies",
    "schedulingBehavior",
    "notificationPreferences",
]


def company_exists(cursor, company_id: int) -> bool:
    cursor.execute("""
        SELECT company_id
        FROM companies
        WHERE company_id = %s
        LIMIT 1
    """, (company_id,))

    return cursor.fetchone() is not None


def parse_enabled(value) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return bool(value)

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in ["true", "1", "yes", "on"]:
            return True

        if normalized in ["false", "0", "no", "off"]:
            return False

    raise ValueError("Permission value must be boolean")


def ensure_permission_defaults(cursor, company_id: int):
    for tab_key in ADMIN_TAB_KEYS:
        cursor.execute("""
            INSERT INTO company_tab_permissions (
                company_id,
                audience,
                tab_key,
                is_enabled
            )
            VALUES (%s, 'admin', %s, TRUE)
            ON CONFLICT (company_id, audience, tab_key)
            DO NOTHING
        """, (
            company_id,
            tab_key
        ))

    for tab_key in EMPLOYEE_TAB_KEYS:
        cursor.execute("""
            INSERT INTO company_tab_permissions (
                company_id,
                audience,
                tab_key,
                is_enabled
            )
            VALUES (%s, 'employee', %s, TRUE)
            ON CONFLICT (company_id, audience, tab_key)
            DO NOTHING
        """, (
            company_id,
            tab_key
        ))

    for section_key in COMPANY_SETTINGS_SECTION_KEYS:
        cursor.execute("""
            INSERT INTO company_settings_section_permissions (
                company_id,
                section_key,
                is_enabled
            )
            VALUES (%s, %s, TRUE)
            ON CONFLICT (company_id, section_key)
            DO NOTHING
        """, (
            company_id,
            section_key
        ))


def get_company_permissions(cursor, company_id: int):
    ensure_permission_defaults(cursor, company_id)

    tab_permissions = {
        "admin": {
            key: True
            for key in ADMIN_TAB_KEYS
        },
        "employee": {
            key: True
            for key in EMPLOYEE_TAB_KEYS
        }
    }

    section_permissions = {
        key: True
        for key in COMPANY_SETTINGS_SECTION_KEYS
    }

    cursor.execute("""
        SELECT
            audience,
            tab_key,
            is_enabled
        FROM company_tab_permissions
        WHERE company_id = %s
        ORDER BY audience, tab_key
    """, (company_id,))

    for audience, tab_key, is_enabled in cursor.fetchall():
        if audience in tab_permissions:
            if tab_key in tab_permissions[audience]:
                tab_permissions[audience][tab_key] = bool(is_enabled)

    cursor.execute("""
        SELECT
            section_key,
            is_enabled
        FROM company_settings_section_permissions
        WHERE company_id = %s
        ORDER BY section_key
    """, (company_id,))

    for section_key, is_enabled in cursor.fetchall():
        if section_key in section_permissions:
            section_permissions[section_key] = bool(is_enabled)

    return {
        "company_id": company_id,
        "tab_permissions": tab_permissions,
        "section_permissions": section_permissions,
        "rolePermissions": {
            "hrTabs": tab_permissions["admin"],
            "adminTabs": tab_permissions["admin"],
            "generalTabs": tab_permissions["employee"],
            "companySections": section_permissions,
        }
    }


def update_company_permissions(
    cursor,
    company_id: int,
    tab_permissions: dict | None = None,
    section_permissions: dict | None = None
):
    ensure_permission_defaults(cursor, company_id)

    valid_tab_keys = {
        "admin": ADMIN_TAB_KEYS,
        "employee": EMPLOYEE_TAB_KEYS,
    }

    if tab_permissions:
        if not isinstance(tab_permissions, dict):
            raise ValueError("tab_permissions must be an object")

        for audience, permissions in tab_permissions.items():
            audience = str(audience).strip().lower()

            if audience not in valid_tab_keys:
                raise ValueError(f"Invalid audience: {audience}")

            if not isinstance(permissions, dict):
                raise ValueError(f"Permissions for {audience} must be an object")

            for tab_key, is_enabled in permissions.items():
                if tab_key not in valid_tab_keys[audience]:
                    raise ValueError(
                        f"Invalid tab_key '{tab_key}' for audience '{audience}'"
                    )

                cursor.execute("""
                    INSERT INTO company_tab_permissions (
                        company_id,
                        audience,
                        tab_key,
                        is_enabled
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (company_id, audience, tab_key)
                    DO UPDATE SET
                        is_enabled = EXCLUDED.is_enabled,
                        updated_at = NOW()
                """, (
                    company_id,
                    audience,
                    tab_key,
                    parse_enabled(is_enabled)
                ))

    if section_permissions:
        if not isinstance(section_permissions, dict):
            raise ValueError("section_permissions must be an object")

        for section_key, is_enabled in section_permissions.items():
            if section_key not in COMPANY_SETTINGS_SECTION_KEYS:
                raise ValueError(f"Invalid section_key: {section_key}")

            cursor.execute("""
                INSERT INTO company_settings_section_permissions (
                    company_id,
                    section_key,
                    is_enabled
                )
                VALUES (%s, %s, %s)
                ON CONFLICT (company_id, section_key)
                DO UPDATE SET
                    is_enabled = EXCLUDED.is_enabled,
                    updated_at = NOW()
            """, (
                company_id,
                section_key,
                parse_enabled(is_enabled)
            ))

    return get_company_permissions(cursor, company_id)
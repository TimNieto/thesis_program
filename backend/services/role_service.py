#---------------------------------------------
# backend/services/role_service.py

def get_company_admin_employee_ids(cursor, company_id: int, exclude_employee_id: int | None = None):
    query = """
        SELECT DISTINCT e.employee_id
        FROM employees e

        JOIN employee_roles er
            ON e.employee_id = er.employee_id
            AND e.company_id = er.company_id

        JOIN roles r
            ON er.role_id = r.role_id
            AND er.company_id = r.company_id

        WHERE e.company_id = %s
        AND e.employment_status = 'Active'
        AND r.role_key = 'hr_manager'
        AND r.is_active = TRUE
    """

    params = [company_id]

    if exclude_employee_id is not None:
        query += " AND e.employee_id != %s"
        params.append(exclude_employee_id)

    cursor.execute(query, tuple(params))

    return [row[0] for row in cursor.fetchall()]
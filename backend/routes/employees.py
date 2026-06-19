#---------------------------------------------
# backend/routes/employees.py

import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from db.database import get_connection
from passlib.hash import bcrypt
from services.notification_service import create_notification
from services.role_service import get_company_admin_employee_ids

router = APIRouter()


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        if hashed and hashed.startswith("$2"):
            return bcrypt.verify(password, hashed)
    except Exception:
        pass

    return password == hashed


def normalize_list(value):
    if not value:
        return []

    if not isinstance(value, list):
        value = [value]

    cleaned = []

    for item in value:
        item = str(item).strip()

        if item and item.lower() != "none":
            cleaned.append(item)

    return cleaned


def get_display_role(role_names):
    return ", ".join(role_names) if role_names else "None"

def normalize_title_text(value: str) -> str:
    return " ".join(str(value or "").strip().split()).title()

def normalize_person_name(value: str) -> str:
    return normalize_title_text(value)


@router.get("/employees")
def get_employees(company_id: int | None = None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if company_id:
            cursor.execute("""
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.nickname,
                    e.email,
                    e.employment_status,
                    e.joined_date,
                    e.contact_number,
                    e.company_id
                FROM employees e
                WHERE e.employment_status = 'Active'
                AND e.company_id = %s
                ORDER BY e.employee_id
            """, (company_id,))
        else:
            cursor.execute("""
                SELECT
                    e.employee_id,
                    e.full_name,
                    e.nickname,
                    e.email,
                    e.employment_status,
                    e.joined_date,
                    e.contact_number,
                    e.company_id
                FROM employees e
                WHERE e.employment_status = 'Active'
                ORDER BY e.employee_id
            """)

        employee_rows = cursor.fetchall()
        employees = []

        for row in employee_rows:
            employee_id = row[0]
            full_name = row[1]
            nickname = row[2]
            email = row[3]
            employment_status = row[4]
            joined_date = row[5]
            contact_number = row[6]
            emp_company_id = row[7]

            cursor.execute("""
                SELECT
                    er.employee_role_id,
                    r.role_id,
                    r.role_key,
                    r.role_name,
                    r.is_admin,
                    d.department_id,
                    d.department_name
                FROM employee_roles er
                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id
                JOIN departments d
                    ON r.department_id = d.department_id
                    AND r.company_id = d.company_id
                WHERE er.employee_id = %s
                AND er.company_id = %s
                AND er.is_active = TRUE
                AND r.is_active = TRUE
                AND d.is_active = TRUE
                ORDER BY d.department_name, r.role_name
            """, (employee_id, emp_company_id))

            assignment_role_rows = cursor.fetchall()

            assignments = [
                {
                    "employee_role_id": assignment_row[0],
                    "role_id": assignment_row[1],
                    "role_key": assignment_row[2],
                    "role_name": assignment_row[3],
                    "is_admin": bool(assignment_row[4]),
                    "department_id": assignment_row[5],
                    "department_name": assignment_row[6],
                }
                for assignment_row in assignment_role_rows
            ]

            role_names = [
                assignment["role_name"]
                for assignment in assignments
                if assignment["role_name"]
            ]

            display_role = get_display_role(role_names)

            department_names = sorted({
                assignment["department_name"]
                for assignment in assignments
                if assignment["department_name"]
            })

            cursor.execute("""
                SELECT DISTINCT
                    a.account_name
                FROM employee_roles er

                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id

                JOIN departments d
                    ON r.department_id = d.department_id
                    AND r.company_id = d.company_id

                LEFT JOIN accounts a
                    ON a.department_id = d.department_id
                    AND a.company_id = d.company_id
                    AND a.is_active = TRUE

                WHERE er.employee_id = %s
                AND er.company_id = %s
                AND er.is_active = TRUE
                AND r.is_active = TRUE
                AND d.is_active = TRUE
                AND a.account_name IS NOT NULL

                ORDER BY a.account_name
            """, (employee_id, emp_company_id))

            account_rows = cursor.fetchall()

            account_names = sorted({
                account_row[0]
                for account_row in account_rows
                if account_row[0]
            })

            employees.append({
                "id": employee_id,
                "name": full_name,
                "nickname": nickname,
                "email": email,
                "role": display_role,
                "status": employment_status,
                "totalShifts": 0,
                "joinedDate": str(joined_date) if joined_date else None,
                "accountType": "Employee",
                "account_names": ", ".join(account_names) if account_names else None,
                "accounts": account_names,
                "contactNumber": contact_number,
                "department_name": ", ".join(department_names) if department_names else "None",
                "departments": department_names,
                "assignments": assignments,
                "company_id": emp_company_id
            })

        return employees

    finally:
        cursor.close()
        conn.close()


@router.get("/employees/{employee_id}")
def get_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                e.employee_id,
                e.full_name,
                e.email,
                e.contact_number,
                e.company_id
            FROM employees e
            WHERE e.employee_id = %s
        """, (employee_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")

        emp_company_id = row[4]

        cursor.execute("""
            SELECT
                er.employee_role_id,
                r.role_id,
                r.role_key,
                r.role_name,
                r.is_admin,
                d.department_id,
                d.department_name
            FROM employee_roles er
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
            WHERE er.employee_id = %s
            AND er.company_id = %s
            AND er.is_active = TRUE
            AND r.is_active = TRUE
            AND d.is_active = TRUE
            ORDER BY d.department_name, r.role_name
        """, (employee_id, emp_company_id))

        assignment_rows = cursor.fetchall()

        assignments = [
            {
                "employee_role_id": assignment_row[0],
                "role_id": assignment_row[1],
                "role_key": assignment_row[2],
                "role_name": assignment_row[3],
                "is_admin": bool(assignment_row[4]),
                "department_id": assignment_row[5],
                "department_name": assignment_row[6],
            }
            for assignment_row in assignment_rows
        ]

        role_names = [
            assignment["role_name"]
            for assignment in assignments
            if assignment["role_name"]
        ]

        display_role = get_display_role(role_names)

        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": display_role,
            "contactNumber": row[3],
            "assignments": assignments,
            "company_id": emp_company_id
        }

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/roles")
def override_employee_roles(employee_id: int, payload: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = payload.get("company_id")
        role_ids = payload.get("role_ids") or []

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        if not isinstance(role_ids, list) or len(role_ids) == 0:
            raise HTTPException(
                status_code=400,
                detail="Select at least one role"
            )

        role_ids = [int(role_id) for role_id in role_ids]

        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (
            employee_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found under this company"
            )

        cursor.execute("""
            SELECT
                r.role_id,
                r.department_id,
                r.is_admin
            FROM roles r
            JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
            WHERE r.company_id = %s
            AND r.role_id = ANY(%s::int[])
            AND r.is_active = TRUE
            AND d.is_active = TRUE
        """, (
            company_id,
            role_ids
        ))

        role_rows = cursor.fetchall()

        if len(role_rows) != len(set(role_ids)):
            raise HTTPException(
                status_code=400,
                detail="One or more selected roles are invalid"
            )

        department_ids = {row[1] for row in role_rows}
        admin_flags = {bool(row[2]) for row in role_rows}

        if len(department_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="Selected roles must belong to one department only"
            )

        if len(admin_flags) > 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot mix admin and non-admin roles"
            )

        selected_is_admin = next(iter(admin_flags))

        cursor.execute("""
            UPDATE employee_roles
            SET is_active = FALSE
            WHERE company_id = %s
            AND employee_id = %s
            AND role_id <> ALL(%s::int[])
            AND is_active = TRUE
        """, (
            company_id,
            employee_id,
            role_ids
        ))

        for role_id in role_ids:
            cursor.execute("""
                INSERT INTO employee_roles (
                    employee_id,
                    role_id,
                    company_id,
                    is_active
                )
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (
                    company_id,
                    employee_id,
                    role_id
                )
                DO UPDATE SET
                    is_active = TRUE
            """, (
                employee_id,
                role_id,
                company_id
            ))

        if selected_is_admin:
            cursor.execute("""
                UPDATE account_preferences
                SET is_active = FALSE
                WHERE company_id = %s
                AND employee_id = %s
                AND is_active = TRUE
            """, (
                company_id,
                employee_id
            ))
        else:
            cursor.execute("""
                UPDATE account_preferences
                SET is_active = FALSE
                WHERE company_id = %s
                AND employee_id = %s
                AND role_id <> ALL(%s::int[])
                AND is_active = TRUE
            """, (
                company_id,
                employee_id,
                role_ids
            ))

        conn.commit()

        return {
            "message": "Employee roles updated",
            "employee_id": employee_id,
            "role_ids": role_ids,
            "is_admin": selected_is_admin
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("OVERRIDE EMPLOYEE ROLES ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to override employee roles"
        )

    finally:
        cursor.close()
        conn.close()


@router.get("/employees/{employee_id}/account-preferences")
def get_employee_account_preferences(employee_id: int, company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (
            employee_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found under this company"
            )

        cursor.execute("""
            SELECT
                ap.account_id,
                a.account_name,
                ap.role_id,
                r.role_name,
                ap.department_id,
                d.department_name
            FROM account_preferences ap
            JOIN accounts a
                ON ap.account_id = a.account_id
                AND ap.company_id = a.company_id
            JOIN roles r
                ON ap.role_id = r.role_id
                AND ap.company_id = r.company_id
            JOIN departments d
                ON ap.department_id = d.department_id
                AND ap.company_id = d.company_id
            WHERE ap.employee_id = %s
            AND ap.company_id = %s
            AND ap.is_active = TRUE
            AND a.is_active = TRUE
            AND r.is_active = TRUE
            AND d.is_active = TRUE
            ORDER BY d.department_name, a.account_name, r.role_name
        """, (
            employee_id,
            company_id
        ))

        return [
            {
                "account_id": row[0],
                "account_name": row[1],
                "role_id": row[2],
                "role_name": row[3],
                "department_id": row[4],
                "department_name": row[5],
            }
            for row in cursor.fetchall()
        ]

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/account-preferences")
def update_employee_account_preferences(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = data.get("company_id")

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
            )

        cursor.execute("""
            SELECT company_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (
            employee_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found under this company"
            )

        preferences = (
            data.get("preferences")
            or data.get("account_preferences")
            or data.get("accountPreferences")
            or []
        )

        if not isinstance(preferences, list):
            raise HTTPException(
                status_code=400,
                detail="preferences must be a list"
            )

        cursor.execute("""
            UPDATE account_preferences
            SET is_active = FALSE
            WHERE employee_id = %s
            AND company_id = %s
            AND is_active = TRUE
        """, (
            employee_id,
            company_id
        ))

        for item in preferences:
            account_name = normalize_title_text(
                item.get("account_name") or item.get("accountName")
            )

            role_name = normalize_title_text(
                item.get("role_name") or item.get("roleName")
            )

            role_id = item.get("role_id") or item.get("roleId")

            if not account_name:
                continue

            if not role_name and not role_id:
                continue

            cursor.execute("""
                SELECT account_id, department_id
                FROM accounts
                WHERE company_id = %s
                AND LOWER(account_name) = LOWER(%s)
                AND is_active = TRUE
                LIMIT 1
            """, (
                company_id,
                account_name
            ))

            account = cursor.fetchone()

            if not account:
                continue

            account_id = account[0]
            department_id = account[1]

            if role_id:
                cursor.execute("""
                    SELECT role_id
                    FROM roles
                    WHERE company_id = %s
                    AND role_id = %s
                    AND department_id = %s
                    AND is_active = TRUE
                    AND is_admin = FALSE
                    LIMIT 1
                """, (
                    company_id,
                    role_id,
                    department_id
                ))
            else:
                cursor.execute("""
                    SELECT role_id
                    FROM roles
                    WHERE company_id = %s
                    AND department_id = %s
                    AND LOWER(role_name) = LOWER(%s)
                    AND is_active = TRUE
                    AND is_admin = FALSE
                    LIMIT 1
                """, (
                    company_id,
                    department_id,
                    role_name
                ))

            role = cursor.fetchone()

            if not role:
                continue

            role_id = role[0]

            cursor.execute("""
                SELECT 1
                FROM employee_roles er
                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id
                WHERE er.company_id = %s
                AND er.employee_id = %s
                AND er.role_id = %s
                AND er.is_active = TRUE
                AND r.is_active = TRUE
                AND r.is_admin = FALSE
                LIMIT 1
            """, (
                company_id,
                employee_id,
                role_id
            ))

            active_employee_role = cursor.fetchone()

            if not active_employee_role:
                continue

            cursor.execute("""
                INSERT INTO account_preferences (
                    employee_id,
                    account_id,
                    role_id,
                    company_id,
                    department_id,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, TRUE)
                ON CONFLICT (
                    company_id,
                    employee_id,
                    account_id,
                    role_id
                )
                DO UPDATE SET
                    department_id = EXCLUDED.department_id,
                    is_active = TRUE
            """, (
                employee_id,
                account_id,
                role_id,
                company_id,
                department_id
            ))

        conn.commit()

        return {"message": "Employee account preferences updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating account preferences:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to update employee account preferences"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/employees")
def add_employee(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        name = normalize_person_name(data.get("name"))
        nickname = str(data.get("nickname") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        contact_number = str(data.get("contactNumber") or "").strip()
        created_by = data.get("created_by")
        company_id = data.get("company_id")

        if not name:
            raise HTTPException(status_code=400, detail="Full name is required")

        if not nickname:
            raise HTTPException(status_code=400, detail="Nickname is required")

        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="Valid email is required")

        if not contact_number:
            raise HTTPException(status_code=400, detail="Contact number is required")

        if not company_id:
            if not created_by:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to identify your company. Please sign in again."
                )

            cursor.execute("""
                SELECT company_id
                FROM employees
                WHERE employee_id = %s
                AND employment_status = 'Active'
            """, (created_by,))

            creator = cursor.fetchone()

            if not creator:
                raise HTTPException(
                    status_code=404,
                    detail="Creator employee not found"
                )

            company_id = creator[0]

        cursor.execute("""
            SELECT employee_id, employment_status
            FROM employees
            WHERE company_id = %s
            AND LOWER(email) = LOWER(%s)
            LIMIT 1
        """, (company_id, email))

        existing_by_email = cursor.fetchone()

        if existing_by_email and existing_by_email[1] == "Active":
            raise HTTPException(
                status_code=400,
                detail="Employee email already exists"
            )

        employee_id_to_exclude = existing_by_email[0] if existing_by_email else None

        # Duplicate full name check.
        # Nickname is intentionally NOT checked, because duplicate nicknames are allowed.
        if employee_id_to_exclude:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND LOWER(full_name) = LOWER(%s)
                AND employment_status = 'Active'
                AND employee_id <> %s
                LIMIT 1
            """, (company_id, name, employee_id_to_exclude))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND LOWER(full_name) = LOWER(%s)
                AND employment_status = 'Active'
                LIMIT 1
            """, (company_id, name))

        existing_name = cursor.fetchone()

        if existing_name:
            raise HTTPException(
                status_code=400,
                detail="Employee name already exists"
            )

        if employee_id_to_exclude:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND contact_number = %s
                AND employment_status = 'Active'
                AND employee_id <> %s
                LIMIT 1
            """, (company_id, contact_number, employee_id_to_exclude))
        else:
            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND contact_number = %s
                AND employment_status = 'Active'
                LIMIT 1
            """, (company_id, contact_number))

        existing_contact = cursor.fetchone()

        if existing_contact:
            raise HTTPException(
                status_code=400,
                detail="Employee contact number already exists"
            )

        if existing_by_email:
            employee_id = existing_by_email[0]

            cursor.execute("""
                UPDATE employees
                SET
                    full_name = %s,
                    nickname = %s,
                    email = %s,
                    password = %s,
                    employment_status = 'Active',
                    contact_number = %s,
                    joined_date = CURRENT_DATE,
                    updated_at = NOW()
                WHERE employee_id = %s
                AND company_id = %s
            """, (
                name,
                nickname,
                email,
                hash_password("1234"),
                contact_number,
                employee_id,
                company_id
            ))

            message = "Employee reactivated"

        else:
            cursor.execute("""
                INSERT INTO employees (
                    full_name,
                    nickname,
                    email,
                    password,
                    employment_status,
                    contact_number,
                    joined_date,
                    company_id
                )
                VALUES (%s, %s, %s, %s, 'Active', %s, CURRENT_DATE, %s)
                RETURNING employee_id
            """, (
                name,
                nickname,
                email,
                hash_password("1234"),
                contact_number,
                company_id
            ))

            employee_id = cursor.fetchone()[0]
            message = "Employee added"

        conn.commit()

        return {
            "message": message,
            "employee_id": employee_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR adding employee:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to add employee"
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/employees-import")
async def import_employees(
    company_id: int = Form(...),
    file: UploadFile = File(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    created_employees = 0
    reactivated_employees = 0

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Unable to identify your company. Please sign in again."
            )

        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. Only .csv files are allowed."
            )

        content = await file.read()

        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File must be UTF-8 encoded."
            )

        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File is empty."
            )

        normalized_headers = [
            str(header).strip().lower().replace(" ", "_")
            for header in reader.fieldnames
            if header
        ]

        required_headers = [
            "full_name",
            "nickname",
            "email",
            "contact_number"
        ]

        if normalized_headers != required_headers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV file. Required exact header: "
                    "full_name,nickname,email,contact_number"
                )
            )

        rows = []
        errors = []
        csv_full_names = set()
        csv_emails = set()
        csv_contact_numbers = set()

        for row_number, row in enumerate(reader, start=2):
            normalized_row = {
                str(key).strip().lower().replace(" ", "_"): value
                for key, value in row.items()
                if key
            }

            full_name = normalize_person_name(normalized_row.get("full_name"))
            nickname = str(normalized_row.get("nickname") or "").strip()
            email = str(normalized_row.get("email") or "").strip().lower()
            contact_number = str(
                normalized_row.get("contact_number") or ""
            ).strip()

            if not full_name and not nickname and not email and not contact_number:
                continue

            if not full_name:
                errors.append(f"Row {row_number}: full_name is required")
            elif full_name.lower() in csv_full_names:
                errors.append(f"Row {row_number}: duplicate full_name in CSV: {full_name}")
            else:
                csv_full_names.add(full_name.lower())

            if not nickname:
                errors.append(f"Row {row_number}: nickname is required")

            if not email:
                errors.append(f"Row {row_number}: email is required")
            elif "@" not in email:
                errors.append(f"Row {row_number}: valid email is required")
            elif email in csv_emails:
                errors.append(f"Row {row_number}: duplicate email in CSV: {email}")
            else:
                csv_emails.add(email)

            if not contact_number:
                errors.append(f"Row {row_number}: contact_number is required")
            elif contact_number in csv_contact_numbers:
                errors.append(
                    f"Row {row_number}: duplicate contact_number in CSV: {contact_number}"
                )
            else:
                csv_contact_numbers.add(contact_number)

            rows.append({
                "row_number": row_number,
                "full_name": full_name,
                "nickname": nickname,
                "email": email,
                "contact_number": contact_number
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid employee import data",
                    "errors": errors
                }
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="CSV has no valid employee rows"
            )

        cursor.execute("""
            SELECT full_name
            FROM employees
            WHERE company_id = %s
            AND LOWER(full_name) = ANY(%s::text[])
            AND employment_status = 'Active'
        """, (
            company_id,
            list(csv_full_names)
        ))

        existing_active_names = cursor.fetchall()

        cursor.execute("""
            SELECT email
            FROM employees
            WHERE company_id = %s
            AND LOWER(email) = ANY(%s::text[])
            AND employment_status = 'Active'
        """, (
            company_id,
            list(csv_emails)
        ))

        existing_active_emails = cursor.fetchall()

        cursor.execute("""
            SELECT contact_number
            FROM employees
            WHERE company_id = %s
            AND contact_number = ANY(%s::text[])
            AND employment_status = 'Active'
        """, (
            company_id,
            list(csv_contact_numbers)
        ))

        existing_active_contacts = cursor.fetchall()

        duplicate_errors = []

        duplicate_errors.extend([
            f"Employee name already exists: {row[0]}"
            for row in existing_active_names
        ])

        duplicate_errors.extend([
            f"Employee email already exists: {row[0]}"
            for row in existing_active_emails
        ])

        duplicate_errors.extend([
            f"Employee contact number already exists: {row[0]}"
            for row in existing_active_contacts
        ])

        if duplicate_errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid employee import data",
                    "errors": duplicate_errors
                }
            )

        for item in rows:
            cursor.execute("""
                SELECT employee_id, employment_status
                FROM employees
                WHERE company_id = %s
                AND LOWER(email) = LOWER(%s)
                LIMIT 1
            """, (
                company_id,
                item["email"]
            ))

            existing_employee = cursor.fetchone()

            if existing_employee:
                employee_id = existing_employee[0]

                cursor.execute("""
                    UPDATE employees
                    SET
                        full_name = %s,
                        nickname = %s,
                        email = %s,
                        password = %s,
                        employment_status = 'Active',
                        contact_number = %s,
                        joined_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE employee_id = %s
                    AND company_id = %s
                """, (
                    item["full_name"],
                    item["nickname"],
                    item["email"],
                    hash_password("1234"),
                    item["contact_number"],
                    employee_id,
                    company_id
                ))

                reactivated_employees += 1

            else:
                cursor.execute("""
                    INSERT INTO employees (
                        full_name,
                        nickname,
                        email,
                        password,
                        employment_status,
                        contact_number,
                        joined_date,
                        company_id
                    )
                    VALUES (%s, %s, %s, %s, 'Active', %s, CURRENT_DATE, %s)
                """, (
                    item["full_name"],
                    item["nickname"],
                    item["email"],
                    hash_password("1234"),
                    item["contact_number"],
                    company_id
                ))

                created_employees += 1

        conn.commit()

        return {
            "message": "Employees imported successfully",
            "summary": {
                "created_employees": created_employees,
                "reactivated_employees": reactivated_employees,
                "total_rows": len(rows)
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("IMPORT EMPLOYEES ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/employee-assignments-import")
async def import_employee_assignments(
    company_id: int = Form(...),
    file: UploadFile = File(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    created_assignments = 0

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Unable to identify your company. Please sign in again."
            )

        if not file.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. Only .csv files are allowed."
            )

        content = await file.read()

        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File must be UTF-8 encoded."
            )

        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file. File is empty."
            )

        normalized_headers = [
            str(header).strip().lower().replace(" ", "_")
            for header in reader.fieldnames
            if header
        ]

        required_headers = [
            "employee_name",
            "department_name",
            "role_name"
        ]

        if normalized_headers != required_headers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV file. Required exact header: "
                    "employee_name,department_name,role_name"
                )
            )

        rows = []
        errors = []
        csv_assignment_keys = set()

        for row_number, row in enumerate(reader, start=2):
            normalized_row = {
                str(key).strip().lower().replace(" ", "_"): value
                for key, value in row.items()
                if key
            }

            employee_name = normalize_title_text(
                normalized_row.get("employee_name")
            )
            department_name = normalize_title_text(
                normalized_row.get("department_name")
            )
            role_name = normalize_title_text(
                normalized_row.get("role_name")
            )

            if not employee_name and not department_name and not role_name:
                continue

            if not employee_name:
                errors.append(f"Row {row_number}: employee_name is required")

            if not department_name:
                errors.append(f"Row {row_number}: department_name is required")

            if not role_name:
                errors.append(f"Row {row_number}: role_name is required")

            assignment_key = (
                employee_name.lower(),
                department_name.lower(),
                role_name.lower()
            )

            if employee_name and department_name and role_name:
                if assignment_key in csv_assignment_keys:
                    errors.append(
                        f"Row {row_number}: duplicate assignment in CSV: "
                        f"{employee_name} / {department_name} / {role_name}"
                    )
                else:
                    csv_assignment_keys.add(assignment_key)

            rows.append({
                "row_number": row_number,
                "employee_name": employee_name,
                "department_name": department_name,
                "role_name": role_name
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid employee assignment import data",
                    "errors": errors
                }
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="CSV has no valid employee assignment rows"
            )

        validated_assignments = []

        # Tracks what this CSV is trying to assign per employee.
        # One employee may only have one department and one admin classification.
        csv_employee_policy = {}

        for item in rows:
            row_number = item["row_number"]
            employee_name = item["employee_name"]
            department_name = item["department_name"]
            role_name = item["role_name"]

            cursor.execute("""
                SELECT employee_id
                FROM employees
                WHERE company_id = %s
                AND LOWER(full_name) = LOWER(%s)
                AND employment_status = 'Active'
                LIMIT 1
            """, (company_id, employee_name))

            employee = cursor.fetchone()

            if not employee:
                errors.append(
                    f"Row {row_number}: active employee not found: {employee_name}"
                )
                continue

            employee_id = employee[0]

            cursor.execute("""
                SELECT department_id
                FROM departments
                WHERE company_id = %s
                AND LOWER(department_name) = LOWER(%s)
                AND is_active = TRUE
                LIMIT 1
            """, (company_id, department_name))

            department = cursor.fetchone()

            if not department:
                errors.append(
                    f"Row {row_number}: active department not found: {department_name}"
                )
                continue

            department_id = department[0]

            cursor.execute("""
                SELECT role_id, is_admin
                FROM roles
                WHERE company_id = %s
                AND department_id = %s
                AND LOWER(role_name) = LOWER(%s)
                AND is_active = TRUE
                LIMIT 1
            """, (company_id, department_id, role_name))

            role = cursor.fetchone()

            if not role:
                errors.append(
                    f"Row {row_number}: active role not found under department "
                    f"'{department_name}': {role_name}"
                )
                continue

            role_id = role[0]
            role_is_admin = bool(role[1])

            cursor.execute("""
                SELECT employee_role_id, is_active
                FROM employee_roles
                WHERE company_id = %s
                AND employee_id = %s
                AND role_id = %s
                LIMIT 1
            """, (company_id, employee_id, role_id))

            existing_assignment = cursor.fetchone()
            inactive_employee_role_id = None

            if existing_assignment:
                existing_employee_role_id = existing_assignment[0]
                existing_is_active = bool(existing_assignment[1])

                if existing_is_active:
                    errors.append(
                        f"Row {row_number}: employee assignment already exists: "
                        f"{employee_name} / {department_name} / {role_name}"
                    )
                    continue

                inactive_employee_role_id = existing_employee_role_id

            # Check the employee's existing active assignments.
            # Existing roles decide the employee's department and admin classification.
            cursor.execute("""
                SELECT DISTINCT
                    r.department_id,
                    d.department_name,
                    r.is_admin
                FROM employee_roles er
                JOIN roles r
                    ON er.role_id = r.role_id
                    AND er.company_id = r.company_id
                JOIN departments d
                    ON r.department_id = d.department_id
                    AND r.company_id = d.company_id
                WHERE er.company_id = %s
                AND er.employee_id = %s
                AND er.is_active = TRUE
                AND r.is_active = TRUE
                AND d.is_active = TRUE
                ORDER BY d.department_name
            """, (company_id, employee_id))

            existing_role_rows = cursor.fetchall()

            existing_department_ids = {
                row[0]
                for row in existing_role_rows
            }

            existing_department_names = {
                row[1]
                for row in existing_role_rows
            }

            existing_admin_values = {
                bool(row[2])
                for row in existing_role_rows
            }

            if len(existing_department_ids) > 1:
                errors.append(
                    f"Row {row_number}: employee already has roles in multiple "
                    f"departments. Remove existing assignments first: {employee_name}"
                )
                continue

            if len(existing_admin_values) > 1:
                errors.append(
                    f"Row {row_number}: employee already has mixed admin and "
                    f"non-admin roles. Remove existing assignments first: {employee_name}"
                )
                continue

            if existing_department_ids:
                existing_department_id = next(iter(existing_department_ids))
                existing_department_name = next(iter(existing_department_names))

                if existing_department_id != department_id:
                    errors.append(
                        f"Row {row_number}: employee already belongs to department "
                        f"'{existing_department_name}'. Remove existing roles first "
                        f"before assigning to '{department_name}': {employee_name}"
                    )
                    continue

            if existing_admin_values:
                existing_is_admin = next(iter(existing_admin_values))

                if existing_is_admin != role_is_admin:
                    errors.append(
                        f"Row {row_number}: employee already has "
                        f"{'admin' if existing_is_admin else 'non-admin'} role access. "
                        f"Remove existing roles first before assigning a "
                        f"{'admin' if role_is_admin else 'non-admin'} role: "
                        f"{employee_name}"
                    )
                    continue

            # Check what this same CSV is assigning for this employee.
            existing_csv_policy = csv_employee_policy.get(employee_id)

            if existing_csv_policy:
                if existing_csv_policy["department_id"] != department_id:
                    errors.append(
                        f"Row {row_number}: employee cannot be assigned roles "
                        f"across multiple departments in the same CSV. "
                        f"Already assigned to '{existing_csv_policy['department_name']}', "
                        f"but row uses '{department_name}': {employee_name}"
                    )
                    continue

                if existing_csv_policy["is_admin"] != role_is_admin:
                    errors.append(
                        f"Row {row_number}: employee cannot mix admin and "
                        f"non-admin roles in the same CSV: {employee_name}"
                    )
                    continue

            else:
                csv_employee_policy[employee_id] = {
                    "department_id": department_id,
                    "department_name": department_name,
                    "is_admin": role_is_admin
                }

            validated_assignments.append({
                "employee_id": employee_id,
                "role_id": role_id,
                "company_id": company_id,
                "inactive_employee_role_id": inactive_employee_role_id
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid employee assignment import data",
                    "errors": errors
                }
            )

        for assignment in validated_assignments:
            if assignment["inactive_employee_role_id"]:
                cursor.execute("""
                    UPDATE employee_roles
                    SET is_active = TRUE
                    WHERE employee_role_id = %s
                    AND company_id = %s
                """, (
                    assignment["inactive_employee_role_id"],
                    assignment["company_id"]
                ))
            else:
                cursor.execute("""
                    INSERT INTO employee_roles (
                        employee_id,
                        role_id,
                        company_id,
                        is_active
                    )
                    VALUES (%s, %s, %s, TRUE)
                """, (
                    assignment["employee_id"],
                    assignment["role_id"],
                    assignment["company_id"]
                ))

            created_assignments += 1

        conn.commit()

        return {
            "message": "Employee assignments imported successfully",
            "summary": {
                "created_assignments": created_assignments,
                "total_rows": len(rows)
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("EMPLOYEE ASSIGNMENTS IMPORT ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to import employee assignments"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/employee-assignments")
def add_employee_assignment(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        company_id = data.get("company_id")
        employee_id = data.get("employee_id")
        department_name = normalize_title_text(data.get("department_name"))
        role_name = normalize_title_text(data.get("role_name"))

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Unable to identify your company. Please sign in again."
            )

        if not employee_id:
            raise HTTPException(
                status_code=400,
                detail="Employee is required"
            )

        if not department_name:
            raise HTTPException(
                status_code=400,
                detail="Department is required"
            )

        if not role_name:
            raise HTTPException(
                status_code=400,
                detail="Role is required"
            )

        cursor.execute("""
            SELECT employee_id, full_name
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (employee_id, company_id))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=400,
                detail="Active employee not found"
            )

        employee_id = employee[0]
        employee_name = employee[1]

        cursor.execute("""
            SELECT department_id, department_name
            FROM departments
            WHERE company_id = %s
            AND LOWER(department_name) = LOWER(%s)
            AND is_active = TRUE
            LIMIT 1
        """, (company_id, department_name))

        department = cursor.fetchone()

        if not department:
            raise HTTPException(
                status_code=400,
                detail=f"Active department not found: {department_name}"
            )

        department_id = department[0]
        department_name = department[1]

        cursor.execute("""
            SELECT role_id, role_name, is_admin
            FROM roles
            WHERE company_id = %s
            AND department_id = %s
            AND LOWER(role_name) = LOWER(%s)
            AND is_active = TRUE
            LIMIT 1
        """, (company_id, department_id, role_name))

        role = cursor.fetchone()

        if not role:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Active role not found under department "
                    f"'{department_name}': {role_name}"
                )
            )

        role_id = role[0]
        role_name = role[1]
        role_is_admin = bool(role[2])

        cursor.execute("""
            SELECT employee_role_id, is_active
            FROM employee_roles
            WHERE company_id = %s
            AND employee_id = %s
            AND role_id = %s
            LIMIT 1
        """, (company_id, employee_id, role_id))

        existing_assignment = cursor.fetchone()
        inactive_employee_role_id = None

        if existing_assignment:
            existing_employee_role_id = existing_assignment[0]
            existing_is_active = bool(existing_assignment[1])

            if existing_is_active:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Employee assignment already exists: "
                        f"{employee_name} / {department_name} / {role_name}"
                    )
                )

            inactive_employee_role_id = existing_employee_role_id

        cursor.execute("""
            SELECT DISTINCT
                r.department_id,
                d.department_name,
                r.is_admin
            FROM employee_roles er
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
            WHERE er.company_id = %s
            AND er.employee_id = %s
            AND er.is_active = TRUE
            AND r.is_active = TRUE
            AND d.is_active = TRUE
            ORDER BY d.department_name
        """, (company_id, employee_id))

        existing_role_rows = cursor.fetchall()

        existing_department_ids = {
            row[0]
            for row in existing_role_rows
        }

        existing_department_names = {
            row[1]
            for row in existing_role_rows
        }

        existing_admin_values = {
            bool(row[2])
            for row in existing_role_rows
        }

        if len(existing_department_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Employee already has roles in multiple departments. "
                    f"Remove existing assignments first: {employee_name}"
                )
            )

        if len(existing_admin_values) > 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Employee already has mixed admin and non-admin roles. "
                    f"Remove existing assignments first: {employee_name}"
                )
            )

        if existing_department_ids:
            existing_department_id = next(iter(existing_department_ids))
            existing_department_name = next(iter(existing_department_names))

            if existing_department_id != department_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Employee already belongs to department "
                        f"'{existing_department_name}'. Remove existing roles "
                        f"first before assigning to '{department_name}': "
                        f"{employee_name}"
                    )
                )

        if existing_admin_values:
            existing_is_admin = next(iter(existing_admin_values))

            if existing_is_admin != role_is_admin:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Employee already has "
                        f"{'admin' if existing_is_admin else 'non-admin'} "
                        f"role access. Remove existing roles first before "
                        f"assigning a "
                        f"{'admin' if role_is_admin else 'non-admin'} role: "
                        f"{employee_name}"
                    )
                )

        if inactive_employee_role_id:
            cursor.execute("""
                UPDATE employee_roles
                SET is_active = TRUE
                WHERE employee_role_id = %s
                AND company_id = %s
            """, (
                inactive_employee_role_id,
                company_id
            ))

            employee_role_id = inactive_employee_role_id
            message = "Employee assignment reactivated successfully"

        else:
            cursor.execute("""
                INSERT INTO employee_roles (
                    employee_id,
                    role_id,
                    company_id,
                    is_active
                )
                VALUES (%s, %s, %s, TRUE)
                RETURNING employee_role_id
            """, (
                employee_id,
                role_id,
                company_id
            ))

            employee_role_id = cursor.fetchone()[0]
            message = "Employee assignment added successfully"

        conn.commit()

        return {
            "message": message,
            "assignment": {
                "employee_role_id": employee_role_id,
                "employee_id": employee_id,
                "employee_name": employee_name,
                "department_name": department_name,
                "role_id": role_id,
                "role_name": role_name,
                "is_admin": role_is_admin
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ADD EMPLOYEE ASSIGNMENT ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to add employee assignment"
        )

    finally:
        cursor.close()
        conn.close()


@router.get("/employee-assignments/{employee_role_id}/deactivation-preview")
def preview_employee_assignment_deactivation(
    employee_role_id: int,
    company_id: int
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                er.employee_role_id,
                er.employee_id,
                er.role_id,
                er.is_active,
                e.full_name,
                d.department_name,
                r.role_name
            FROM employee_roles er
            JOIN employees e
                ON er.employee_id = e.employee_id
                AND er.company_id = e.company_id
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
            WHERE er.employee_role_id = %s
            AND er.company_id = %s
            LIMIT 1
        """, (
            employee_role_id,
            company_id
        ))

        assignment = cursor.fetchone()

        if not assignment:
            raise HTTPException(
                status_code=404,
                detail="Employee assignment not found"
            )

        employee_id = assignment[1]
        role_id = assignment[2]
        is_active = bool(assignment[3])
        employee_name = assignment[4]
        department_name = assignment[5]
        role_name = assignment[6]

        if not is_active:
            return {
                "assignment": {
                    "employee_name": employee_name,
                    "department_name": department_name,
                    "role_name": role_name,
                },
                "cleanup": {
                    "employee_assignment_deactivated": 0,
                    "account_preferences_disabled": 0,
                    "future_schedule_slots_unassigned": 0,
                    "coverage_requests_cancelled": 0,
                    "shift_applications_cancelled": 0,
                    "emergency_cover_targets_cancelled": 0,
                    "historical_finalized_assignments_changed": 0,
                }
            }

        cursor.execute("""
            SELECT
                gs.schedule_id
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE gs.company_id = %s
            AND gs.employee_id = %s
            AND gs.role_id = %s
            AND gs.is_archived = FALSE
            AND s.shift_date >= CURRENT_DATE
        """, (
            company_id,
            employee_id,
            role_id
        ))

        affected_schedule_ids = [
            row[0]
            for row in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT COUNT(*)
            FROM account_preferences
            WHERE company_id = %s
            AND employee_id = %s
            AND role_id = %s
            AND is_active = TRUE
        """, (
            company_id,
            employee_id,
            role_id
        ))

        account_preferences_count = cursor.fetchone()[0]

        affected_coverage_request_ids = []

        if affected_schedule_ids:
            cursor.execute("""
                SELECT coverage_request_id
                FROM coverage_requests
                WHERE company_id = %s
                AND schedule_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_schedule_ids
            ))

            affected_coverage_request_ids = [
                row[0]
                for row in cursor.fetchall()
            ]

        shift_application_count = 0
        emergency_target_count = 0

        if affected_coverage_request_ids:
            cursor.execute("""
                SELECT COUNT(*)
                FROM shift_applications
                WHERE company_id = %s
                AND coverage_request_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_coverage_request_ids
            ))

            shift_application_count = cursor.fetchone()[0]

            cursor.execute("""
                SELECT COUNT(*)
                FROM emergency_cover_targets
                WHERE company_id = %s
                AND coverage_request_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_coverage_request_ids
            ))

            emergency_target_count = cursor.fetchone()[0]

        return {
            "assignment": {
                "employee_name": employee_name,
                "department_name": department_name,
                "role_name": role_name,
            },
            "cleanup": {
                "employee_assignment_deactivated": 1,
                "account_preferences_disabled": account_preferences_count,
                "future_schedule_slots_unassigned": len(affected_schedule_ids),
                "coverage_requests_cancelled": len(affected_coverage_request_ids),
                "shift_applications_cancelled": shift_application_count,
                "emergency_cover_targets_cancelled": emergency_target_count,
                "historical_finalized_assignments_changed": 0,
            }
        }

    finally:
        cursor.close()
        conn.close()


@router.delete("/employee-assignments/{employee_role_id}")
def deactivate_employee_assignment(employee_role_id: int, company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                er.employee_role_id,
                er.employee_id,
                er.role_id,
                er.is_active,
                e.full_name,
                d.department_name,
                r.role_name
            FROM employee_roles er
            JOIN employees e
                ON er.employee_id = e.employee_id
                AND er.company_id = e.company_id
            JOIN roles r
                ON er.role_id = r.role_id
                AND er.company_id = r.company_id
            JOIN departments d
                ON r.department_id = d.department_id
                AND r.company_id = d.company_id
            WHERE er.employee_role_id = %s
            AND er.company_id = %s
            LIMIT 1
        """, (
            employee_role_id,
            company_id
        ))

        assignment = cursor.fetchone()

        if not assignment:
            raise HTTPException(
                status_code=404,
                detail="Employee assignment not found"
            )

        employee_id = assignment[1]
        role_id = assignment[2]
        is_active = bool(assignment[3])
        employee_name = assignment[4]
        department_name = assignment[5]
        role_name = assignment[6]

        if not is_active:
            return {
                "message": (
                    f"Employee assignment already inactive: "
                    f"{employee_name} / {department_name} / {role_name}"
                )
            }

        # Find active future generated schedule rows tied to this exact employee + role.
        cursor.execute("""
            SELECT
                gs.schedule_id
            FROM generated_schedule gs
            JOIN shifts s
                ON gs.shift_id = s.shift_id
                AND gs.company_id = s.company_id
            WHERE gs.company_id = %s
            AND gs.employee_id = %s
            AND gs.role_id = %s
            AND gs.is_archived = FALSE
            AND s.shift_date >= CURRENT_DATE
        """, (
            company_id,
            employee_id,
            role_id
        ))

        affected_schedule_ids = [
            row[0]
            for row in cursor.fetchall()
        ]

        affected_coverage_request_ids = []

        if affected_schedule_ids:
            cursor.execute("""
                SELECT coverage_request_id
                FROM coverage_requests
                WHERE company_id = %s
                AND schedule_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_schedule_ids
            ))

            affected_coverage_request_ids = [
                row[0]
                for row in cursor.fetchall()
            ]

        # Cancel/archive emergency cover targets tied to affected coverage requests.
        if affected_coverage_request_ids:
            cursor.execute("""
                UPDATE emergency_cover_targets
                SET
                    status = 'cancelled',
                    is_archived = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                AND coverage_request_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_coverage_request_ids
            ))

            cursor.execute("""
                UPDATE shift_applications
                SET
                    status = 'cancelled',
                    is_archived = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                AND coverage_request_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_coverage_request_ids
            ))

            cursor.execute("""
                UPDATE coverage_requests
                SET
                    status = 'cancelled',
                    is_archived = TRUE,
                    updated_at = NOW()
                WHERE company_id = %s
                AND coverage_request_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_coverage_request_ids
            ))

        # Option B:
        # Keep future schedule rows, but free the slot by clearing employee_id.
        if affected_schedule_ids:
            cursor.execute("""
                UPDATE generated_schedule
                SET employee_id = NULL
                WHERE company_id = %s
                AND schedule_id = ANY(%s::int[])
                AND is_archived = FALSE
            """, (
                company_id,
                affected_schedule_ids
            ))

        # Soft-deactivate account preferences for this employee + role.
        cursor.execute("""
            UPDATE account_preferences
            SET is_active = FALSE
            WHERE company_id = %s
            AND employee_id = %s
            AND role_id = %s
            AND is_active = TRUE
        """, (
            company_id,
            employee_id,
            role_id
        ))

        # Soft-deactivate the employee-role assignment.
        cursor.execute("""
            UPDATE employee_roles
            SET is_active = FALSE
            WHERE employee_role_id = %s
            AND company_id = %s
        """, (
            employee_role_id,
            company_id
        ))

        conn.commit()

        return {
            "message": (
                f"Employee assignment deactivated: "
                f"{employee_name} / {department_name} / {role_name}"
            ),
            "cleanup": {
                "future_schedule_slots_unassigned": len(affected_schedule_ids),
                "coverage_requests_cancelled": len(affected_coverage_request_ids)
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DEACTIVATE EMPLOYEE ASSIGNMENT ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate employee assignment"
        )

    finally:
        cursor.close()
        conn.close()


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT employee_id, employment_status, company_id
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        employee_id = employee[0]
        employment_status = employee[1]
        company_id = employee[2]

        if employment_status == "Inactive":
            return {"message": "Employee already inactive"}

        cursor.execute("""
            SELECT COUNT(*)
            FROM employee_roles
            WHERE employee_id = %s
            AND company_id = %s
            AND is_active = TRUE
        """, (employee_id, company_id))

        assignment_count = cursor.fetchone()[0]

        if assignment_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate employee. Remove employee assignment first."
            )

        cursor.execute("""
            UPDATE employees
            SET employment_status = 'Inactive',
                updated_at = NOW()
            WHERE employee_id = %s
            AND company_id = %s
        """, (employee_id, company_id))

        conn.commit()

        return {"message": "Employee deactivated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR deleting employee:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to deactivate employee"
        )

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/role")
def update_employee_role(employee_id: int, data: dict):
    raise HTTPException(
        status_code=410,
        detail=(
            "Direct employee role updates are disabled. "
            "Remove existing employee assignments first, then use Employee Assignments import."
        )
    )


@router.put("/employees/{employee_id}")
def update_employee(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE employees
            SET full_name = %s,
                contact_number = %s,
                updated_at = NOW()
            WHERE employee_id = %s
        """, (
            data["name"],
            data["contactNumber"],
            employee_id
        ))

        conn.commit()

        return {"message": "Employee updated successfully"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()


@router.put("/employees/{employee_id}/password")
def change_password(employee_id: int, data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT password
            FROM employees
            WHERE employee_id = %s
        """, (employee_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        stored_password = row[0]

        current = data.get("currentPassword", "").strip()
        new_password = data.get("newPassword", "").strip()

        if not current or not new_password:
            raise HTTPException(status_code=400, detail="Missing fields")

        if not verify_password(current, stored_password):
            raise HTTPException(status_code=400, detail="Incorrect current password")

        if len(new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters"
            )

        cursor.execute("""
            UPDATE employees
            SET password = %s,
                updated_at = NOW()
            WHERE employee_id = %s
        """, (
            hash_password(new_password),
            employee_id
        ))

        conn.commit()

        return {"message": "Password updated"}

    except HTTPException:
        conn.rollback()
        raise

    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to change password")

    finally:
        cursor.close()
        conn.close()


@router.get("/availability")
def get_availability(company_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                a.employee_id,
                a.day_of_week,
                a.is_available,
                a.shift_template_id,
                st.shift_name,
                st.start_time,
                st.end_time,
                a.company_id
            FROM availability a
            JOIN shift_templates st
                ON a.shift_template_id = st.shift_template_id
                AND a.company_id = st.company_id
            WHERE a.company_id = %s
            ORDER BY
                a.employee_id,
                CASE INITCAP(TRIM(a.day_of_week))
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                    ELSE 8
                END,
                st.start_time,
                st.end_time,
                st.shift_name
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "employee_id": r[0],
                "day_of_week": r[1],
                "is_available": r[2],
                "shift_template_id": r[3],
                "preferred_shift": r[4],
                "shift_name": r[4],
                "start_time": str(r[5]),
                "end_time": str(r[6]),
                "availability_group_key": f"{str(r[5])}|{str(r[6])}",
                "company_id": r[7],
            }
            for r in rows
        ]

    except Exception as e:
        print("ERROR fetching availability:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch availability"
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/availability")
def update_availability(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = int(data["employee_id"])
        company_id = int(data["company_id"])
        day_of_week = str(data["day_of_week"]).strip().capitalize()
        is_available = bool(data["is_available"])

        shift_template_id = data.get("shift_template_id")

        if not shift_template_id:
            raise HTTPException(
                status_code=400,
                detail="shift_template_id is required"
            )

        shift_template_id = int(shift_template_id)

        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (
            employee_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=400,
                detail="Employee does not exist or is inactive"
            )

        cursor.execute("""
            SELECT st.shift_template_id
            FROM shift_templates st
            JOIN accounts a
                ON st.account_id = a.account_id
                AND st.company_id = a.company_id
            WHERE st.shift_template_id = %s
            AND st.company_id = %s
            AND st.is_active = TRUE
            AND a.is_active = TRUE
            LIMIT 1
        """, (
            shift_template_id,
            company_id
        ))

        template = cursor.fetchone()

        if not template:
            raise HTTPException(
                status_code=400,
                detail="Invalid shift template"
            )

        cursor.execute("""
            SELECT availability_id
            FROM availability
            WHERE company_id = %s
            AND employee_id = %s
            AND LOWER(TRIM(day_of_week)) = LOWER(TRIM(%s))
            AND shift_template_id = %s
            LIMIT 1
        """, (
            company_id,
            employee_id,
            day_of_week,
            shift_template_id
        ))

        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE availability
                SET
                    day_of_week = %s,
                    is_available = %s
                WHERE availability_id = %s
            """, (
                day_of_week,
                is_available,
                existing[0]
            ))
        else:
            cursor.execute("""
                INSERT INTO availability (
                    employee_id,
                    company_id,
                    day_of_week,
                    shift_template_id,
                    is_available
                )
                VALUES (%s, %s, %s, %s, %s)
            """, (
                employee_id,
                company_id,
                day_of_week,
                shift_template_id,
                is_available
            ))

        conn.commit()

        return {
            "message": "Availability saved",
            "employee_id": employee_id,
            "company_id": company_id,
            "day_of_week": day_of_week,
            "shift_template_id": shift_template_id,
            "is_available": is_available,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating availability:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.post("/availability/global")
def update_global_availability(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        employee_id = int(data["employee_id"])
        company_id = int(data["company_id"])
        day_of_week = str(data["day_of_week"]).strip().capitalize()
        start_time = str(data.get("start_time", "")).strip()
        end_time = str(data.get("end_time", "")).strip()
        is_available = bool(data["is_available"])

        if not start_time:
            raise HTTPException(
                status_code=400,
                detail="start_time is required"
            )

        if not end_time:
            raise HTTPException(
                status_code=400,
                detail="end_time is required"
            )

        cursor.execute("""
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
            AND company_id = %s
            AND employment_status = 'Active'
            LIMIT 1
        """, (
            employee_id,
            company_id
        ))

        employee = cursor.fetchone()

        if not employee:
            raise HTTPException(
                status_code=400,
                detail="Employee does not exist or is inactive"
            )

        cursor.execute("""
            SELECT st.shift_template_id
            FROM shift_templates st
            JOIN accounts a
                ON st.account_id = a.account_id
                AND st.company_id = a.company_id
            WHERE st.company_id = %s
            AND st.start_time = %s::time
            AND st.end_time = %s::time
            AND st.is_active = TRUE
            AND a.is_active = TRUE
            ORDER BY st.shift_template_id
        """, (
            company_id,
            start_time,
            end_time
        ))

        shift_template_rows = cursor.fetchall()

        if not shift_template_rows:
            raise HTTPException(
                status_code=400,
                detail="No active shift templates found for this time range"
            )

        for row in shift_template_rows:
            shift_template_id = row[0]

            cursor.execute("""
                SELECT availability_id
                FROM availability
                WHERE company_id = %s
                AND employee_id = %s
                AND LOWER(TRIM(day_of_week)) = LOWER(TRIM(%s))
                AND shift_template_id = %s
                LIMIT 1
            """, (
                company_id,
                employee_id,
                day_of_week,
                shift_template_id
            ))

            existing = cursor.fetchone()

            if existing:
                cursor.execute("""
                    UPDATE availability
                    SET
                        day_of_week = %s,
                        is_available = %s
                    WHERE availability_id = %s
                """, (
                    day_of_week,
                    is_available,
                    existing[0]
                ))
            else:
                cursor.execute("""
                    INSERT INTO availability (
                        employee_id,
                        company_id,
                        day_of_week,
                        shift_template_id,
                        is_available
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    employee_id,
                    company_id,
                    day_of_week,
                    shift_template_id,
                    is_available
                ))

        conn.commit()

        return {
            "message": "Global availability saved",
            "employee_id": employee_id,
            "company_id": company_id,
            "day_of_week": day_of_week,
            "start_time": start_time,
            "end_time": end_time,
            "availability_group_key": f"{start_time}|{end_time}",
            "is_available": is_available,
            "updated_shift_templates": len(shift_template_rows),
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("ERROR updating global availability:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
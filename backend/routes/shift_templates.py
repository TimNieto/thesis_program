#---------------------------------------------
# backend/routes/shift_templates.py

import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
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
                st.shift_template_id,
                st.account_id,
                a.account_name,
                d.department_id,
                d.department_name,
                st.shift_name,
                st.start_time,
                st.end_time,
                st.is_active
            FROM shift_templates st
            JOIN accounts a
                ON st.account_id = a.account_id
                AND st.company_id = a.company_id
            JOIN departments d
                ON a.department_id = d.department_id
                AND a.company_id = d.company_id
            WHERE st.company_id = %s
            AND st.is_active = TRUE
            AND a.is_active = TRUE
            AND d.is_active = TRUE
            ORDER BY
                d.department_name ASC,
                a.account_name ASC,
                st.start_time ASC,
                st.shift_name ASC
        """, (company_id,))

        rows = cursor.fetchall()

        return [
            {
                "shift_template_id": r[0],
                "account_id": r[1],
                "account_name": r[2],
                "department_id": r[3],
                "department_name": r[4],
                "shift_name": r[5],
                "start_time": str(r[6]),
                "end_time": str(r[7]),
                "is_active": r[8],
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


def normalize_text(value: str) -> str:
    return " ".join(str(value or "").strip().split())


def normalize_shift_name(value: str) -> str:
    return normalize_text(value).upper()


def normalize_csv_header(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "_")


def get_csv_value(row: dict, *keys: str) -> str:
    for key in keys:
        value = row.get(key)

        if value is not None:
            return str(value).strip()

    return ""

def resolve_shift_template_account(
    cursor,
    company_id: int,
    account_id=None,
    account_name=None
):
    if account_id:
        cursor.execute("""
            SELECT
                account_id,
                account_name
            FROM accounts
            WHERE company_id = %s
            AND account_id = %s
            AND is_active = TRUE
            LIMIT 1
        """, (
            company_id,
            int(account_id)
        ))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=400,
                detail="Account does not exist or is inactive"
            )

        return {
            "account_id": row[0],
            "account_name": row[1]
        }

    account_name = normalize_text(account_name)

    if not account_name:
        raise HTTPException(
            status_code=400,
            detail="account_id or account_name is required"
        )

    cursor.execute("""
        SELECT
            account_id,
            account_name
        FROM accounts
        WHERE company_id = %s
        AND LOWER(account_name) = LOWER(%s)
        AND is_active = TRUE
        LIMIT 1
    """, (
        company_id,
        account_name
    ))

    row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=400,
            detail=f"Account '{account_name}' does not exist or is inactive"
        )

    return {
        "account_id": row[0],
        "account_name": row[1]
    }

@router.post("/shift-templates-import")
async def import_shift_templates(
    company_id: int = Form(...),
    file: UploadFile = File(...)
):
    conn = get_connection()
    cursor = conn.cursor()

    created_templates = 0
    reactivated_templates = 0
    errors = []

    try:
        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required"
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
            normalize_csv_header(header)
            for header in reader.fieldnames
            if header
        ]

        required_headers = [
            "account_name",
            "shift_name",
            "start_time",
            "end_time"
        ]

        if normalized_headers != required_headers:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV file. Required exact header: "
                    "account_name,shift_name,start_time,end_time"
                )
            )

        rows = []
        csv_keys = set()

        for row_number, row in enumerate(reader, start=2):
            normalized_row = {
                normalize_csv_header(key): value
                for key, value in row.items()
                if key
            }

            account_name = normalize_text(
                get_csv_value(normalized_row, "account_name")
            )

            shift_name = normalize_shift_name(
                get_csv_value(normalized_row, "shift_name")
            )

            start_time_raw = get_csv_value(normalized_row, "start_time")
            end_time_raw = get_csv_value(normalized_row, "end_time")

            if (
                not account_name and
                not shift_name and
                not start_time_raw and
                not end_time_raw
            ):
                continue

            if not account_name:
                errors.append(f"Row {row_number}: account_name is required")

            if not shift_name:
                errors.append(f"Row {row_number}: shift_name is required")

            if not start_time_raw:
                errors.append(f"Row {row_number}: start_time is required")

            if not end_time_raw:
                errors.append(f"Row {row_number}: end_time is required")

            if shift_name and len(shift_name) > 20:
                errors.append(f"Row {row_number}: shift_name is too long")

            start_time_obj = None
            end_time_obj = None

            if start_time_raw:
                try:
                    start_time_obj = parse_time_string(start_time_raw)
                except HTTPException:
                    errors.append(
                        f"Row {row_number}: Invalid start_time format: {start_time_raw}"
                    )

            if end_time_raw:
                try:
                    end_time_obj = parse_time_string(end_time_raw)
                except HTTPException:
                    errors.append(
                        f"Row {row_number}: Invalid end_time format: {end_time_raw}"
                    )

            if (
                start_time_obj is not None and
                end_time_obj is not None and
                start_time_obj == end_time_obj
            ):
                errors.append(
                    f"Row {row_number}: Start and end time cannot be identical"
                )

            csv_key = (
                account_name.lower(),
                shift_name.lower()
            )

            if account_name and shift_name:
                if csv_key in csv_keys:
                    errors.append(
                        f"Row {row_number}: Duplicate shift '{shift_name}' under account '{account_name}' in CSV"
                    )
                else:
                    csv_keys.add(csv_key)

            rows.append({
                "row_number": row_number,
                "account_name": account_name,
                "shift_name": shift_name,
                "start_time": start_time_obj,
                "end_time": end_time_obj,
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid shift template import data",
                    "errors": errors
                }
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="CSV has no valid shift template rows"
            )

        cursor.execute("""
            SELECT
                account_id,
                account_name
            FROM accounts
            WHERE company_id = %s
            AND is_active = TRUE
        """, (company_id,))

        account_rows = cursor.fetchall()

        account_map = {
            str(row[1]).strip().lower(): {
                "account_id": row[0],
                "account_name": row[1]
            }
            for row in account_rows
        }

        resolved_rows = []

        for item in rows:
            account_key = item["account_name"].lower()
            account = account_map.get(account_key)

            if not account:
                errors.append(
                    f"Row {item['row_number']}: Account '{item['account_name']}' does not exist or is inactive"
                )
                continue

            resolved_rows.append({
                **item,
                "account_id": account["account_id"],
                "account_name": account["account_name"]
            })

        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Invalid shift template import data",
                    "errors": errors
                }
            )

        imported_active_ranges = []

        for item in resolved_rows:
            row_number = item["row_number"]
            account_id = item["account_id"]
            account_name = item["account_name"]
            shift_name = item["shift_name"]
            start_time_obj = item["start_time"]
            end_time_obj = item["end_time"]

            for imported in imported_active_ranges:
                if imported["account_id"] != account_id:
                    continue

                if is_overlap(
                    start_time_obj,
                    end_time_obj,
                    imported["start_time"],
                    imported["end_time"]
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Row {row_number}: Shift '{shift_name}' overlaps with "
                            f"'{imported['shift_name']}' under account '{account_name}'"
                        )
                    )

            cursor.execute("""
                SELECT
                    shift_template_id,
                    is_active
                FROM shift_templates
                WHERE company_id = %s
                AND account_id = %s
                AND LOWER(shift_name) = LOWER(%s)
                LIMIT 1
            """, (
                company_id,
                account_id,
                shift_name
            ))

            existing_template = cursor.fetchone()

            existing_template_id = None

            if existing_template:
                existing_template_id = existing_template[0]
                existing_is_active = existing_template[1]

                if existing_is_active:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Row {row_number}: Shift '{shift_name}' already exists "
                            f"under account '{account_name}'"
                        )
                    )

            cursor.execute("""
                SELECT
                    shift_template_id,
                    shift_name,
                    start_time,
                    end_time
                FROM shift_templates
                WHERE company_id = %s
                AND account_id = %s
                AND is_active = TRUE
                AND shift_template_id != COALESCE(%s, -1)
            """, (
                company_id,
                account_id,
                existing_template_id
            ))

            active_templates = cursor.fetchall()

            for active in active_templates:
                active_name = active[1]
                active_start = active[2]
                active_end = active[3]

                if is_overlap(
                    start_time_obj,
                    end_time_obj,
                    active_start,
                    active_end
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Row {row_number}: Shift '{shift_name}' overlaps with "
                            f"'{active_name}' under account '{account_name}'"
                        )
                    )

            if existing_template_id:
                cursor.execute("""
                    UPDATE shift_templates
                    SET
                        start_time = %s,
                        end_time = %s,
                        is_active = TRUE,
                        fatigue_penalty = 0,
                        difficulty_weight = 0,
                        is_overnight = FALSE,
                        updated_at = NOW()
                    WHERE shift_template_id = %s
                    AND company_id = %s
                    AND account_id = %s
                """, (
                    start_time_obj,
                    end_time_obj,
                    existing_template_id,
                    company_id,
                    account_id
                ))

                reactivated_templates += 1

            else:
                cursor.execute("""
                    INSERT INTO shift_templates (
                        company_id,
                        account_id,
                        shift_name,
                        start_time,
                        end_time,
                        is_active,
                        fatigue_penalty,
                        difficulty_weight,
                        is_overnight
                    )
                    VALUES (%s, %s, %s, %s, %s, TRUE, 0, 0, FALSE)
                """, (
                    company_id,
                    account_id,
                    shift_name,
                    start_time_obj,
                    end_time_obj
                ))

                created_templates += 1

            imported_active_ranges.append({
                "account_id": account_id,
                "account_name": account_name,
                "shift_name": shift_name,
                "start_time": start_time_obj,
                "end_time": end_time_obj
            })

        conn.commit()

        return {
            "message": "Shift templates imported successfully",
            "summary": {
                "created_templates": created_templates,
                "reactivated_templates": reactivated_templates,
                "total_rows": len(resolved_rows)
            }
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("IMPORT SHIFT TEMPLATES ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()


@router.post("/shift-templates")
def create_shift_template(payload: dict):

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

        account = resolve_shift_template_account(
            cursor,
            company_id,
            account_id=payload.get("account_id"),
            account_name=payload.get("account_name")
        )

        account_id = account["account_id"]
        account_name = account["account_name"]

        shift_name = normalize_shift_name(
            payload.get("shift_name", "")
        )

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

        start_time_obj = parse_time_string(start_time)
        end_time_obj = parse_time_string(end_time)

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        cursor.execute("""
            SELECT
                shift_template_id,
                is_active
            FROM shift_templates
            WHERE company_id = %s
            AND account_id = %s
            AND LOWER(shift_name) = LOWER(%s)
            LIMIT 1
        """, (
            company_id,
            account_id,
            shift_name
        ))

        existing_template = cursor.fetchone()

        existing_template_id = None

        if existing_template:
            existing_template_id = existing_template[0]
            existing_is_active = existing_template[1]

            if existing_is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"Shift '{shift_name}' already exists under account '{account_name}'"
                )

        cursor.execute("""
            SELECT
                shift_template_id,
                shift_name,
                start_time,
                end_time
            FROM shift_templates
            WHERE company_id = %s
            AND account_id = %s
            AND is_active = TRUE
            AND shift_template_id != COALESCE(%s, -1)
        """, (
            company_id,
            account_id,
            existing_template_id
        ))

        active_templates = cursor.fetchall()

        for row in active_templates:
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
                    detail=f"Shift '{shift_name}' overlaps with '{existing_name}' under account '{account_name}'"
                )

        if existing_template_id:
            cursor.execute("""
                UPDATE shift_templates
                SET
                    start_time = %s,
                    end_time = %s,
                    is_active = TRUE,
                    fatigue_penalty = 0,
                    difficulty_weight = 0,
                    is_overnight = FALSE,
                    updated_at = NOW()
                WHERE shift_template_id = %s
                AND company_id = %s
                AND account_id = %s
                RETURNING
                    shift_template_id,
                    account_id,
                    shift_name,
                    start_time,
                    end_time,
                    is_overnight,
                    fatigue_penalty,
                    difficulty_weight,
                    is_active
            """, (
                start_time_obj,
                end_time_obj,
                existing_template_id,
                company_id,
                account_id
            ))

            saved = cursor.fetchone()
            message = "Shift template reactivated"

        else:
            cursor.execute("""
                INSERT INTO shift_templates (
                    company_id,
                    account_id,
                    shift_name,
                    start_time,
                    end_time,
                    is_active,
                    fatigue_penalty,
                    difficulty_weight,
                    is_overnight
                )
                VALUES (%s, %s, %s, %s, %s, TRUE, 0, 0, FALSE)
                RETURNING
                    shift_template_id,
                    account_id,
                    shift_name,
                    start_time,
                    end_time,
                    is_overnight,
                    fatigue_penalty,
                    difficulty_weight,
                    is_active
            """, (
                company_id,
                account_id,
                shift_name,
                start_time_obj,
                end_time_obj
            ))

            saved = cursor.fetchone()
            message = "Shift template created"

        conn.commit()

        return {
            "message": message,
            "shift_template_id": saved[0],
            "company_id": company_id,
            "account_id": saved[1],
            "account_name": account_name,
            "shift_name": saved[2],
            "start_time": str(saved[3]),
            "end_time": str(saved[4]),
            "is_overnight": saved[5],
            "fatigue_penalty": saved[6],
            "difficulty_weight": saved[7],
            "is_active": saved[8],
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("CREATE SHIFT TEMPLATE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
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
        cursor.execute("""
            SELECT
                st.shift_template_id,
                st.company_id,
                st.account_id,
                a.account_name
            FROM shift_templates st
            JOIN accounts a
                ON st.account_id = a.account_id
                AND st.company_id = a.company_id
            WHERE st.shift_template_id = %s
            LIMIT 1
        """, (shift_template_id,))

        current = cursor.fetchone()

        if not current:
            raise HTTPException(
                status_code=404,
                detail="Shift template not found"
            )

        company_id = current[1]
        current_account_id = current[2]
        current_account_name = current[3]

        payload_company_id = payload.get("company_id")

        if payload_company_id and int(payload_company_id) != int(company_id):
            raise HTTPException(
                status_code=400,
                detail="Shift template does not belong to this company"
            )

        if payload.get("account_id") or payload.get("account_name"):
            account = resolve_shift_template_account(
                cursor,
                company_id,
                account_id=payload.get("account_id"),
                account_name=payload.get("account_name")
            )
        else:
            account = {
                "account_id": current_account_id,
                "account_name": current_account_name
            }

        account_id = account["account_id"]
        account_name = account["account_name"]

        shift_name = normalize_shift_name(
            payload.get("shift_name", "")
        )

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

        start_time_obj = parse_time_string(start_time)
        end_time_obj = parse_time_string(end_time)

        if start_time_obj == end_time_obj:
            raise HTTPException(
                status_code=400,
                detail="Start and end time cannot be identical"
            )

        cursor.execute("""
            SELECT
                shift_template_id,
                is_active
            FROM shift_templates
            WHERE company_id = %s
            AND account_id = %s
            AND LOWER(shift_name) = LOWER(%s)
            AND shift_template_id != %s
            LIMIT 1
        """, (
            company_id,
            account_id,
            shift_name,
            shift_template_id
        ))

        duplicate = cursor.fetchone()

        if duplicate:
            duplicate_is_active = duplicate[1]

            if duplicate_is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"Shift '{shift_name}' already exists under account '{account_name}'"
                )

            raise HTTPException(
                status_code=400,
                detail=f"A deleted shift named '{shift_name}' already exists under account '{account_name}'. Restore it instead."
            )

        cursor.execute("""
            SELECT
                shift_template_id,
                shift_name,
                start_time,
                end_time
            FROM shift_templates
            WHERE company_id = %s
            AND account_id = %s
            AND is_active = TRUE
            AND shift_template_id != %s
        """, (
            company_id,
            account_id,
            shift_template_id
        ))

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
                    detail=f"Shift '{shift_name}' overlaps with '{existing_name}' under account '{account_name}'"
                )

        cursor.execute("""
            UPDATE shift_templates
            SET
                account_id = %s,
                shift_name = %s,
                start_time = %s,
                end_time = %s,
                updated_at = NOW()
            WHERE shift_template_id = %s
            AND company_id = %s
            RETURNING
                shift_template_id,
                account_id,
                shift_name,
                start_time,
                end_time,
                is_overnight,
                fatigue_penalty,
                difficulty_weight,
                is_active
        """, (
            account_id,
            shift_name,
            start_time_obj,
            end_time_obj,
            shift_template_id,
            company_id
        ))

        updated = cursor.fetchone()

        conn.commit()

        return {
            "message": "Shift template updated",
            "shift_template_id": updated[0],
            "company_id": company_id,
            "account_id": updated[1],
            "account_name": account_name,
            "shift_name": updated[2],
            "start_time": str(updated[3]),
            "end_time": str(updated[4]),
            "is_overnight": updated[5],
            "fatigue_penalty": updated[6],
            "difficulty_weight": updated[7],
            "is_active": updated[8],
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("UPDATE SHIFT TEMPLATE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()

@router.delete("/shift-templates/{shift_template_id}")
def delete_shift_template(
    shift_template_id: int,
    company_id: int
):

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                st.shift_template_id,
                st.shift_name,
                a.account_name
            FROM shift_templates st
            JOIN accounts a
                ON st.account_id = a.account_id
                AND st.company_id = a.company_id
            WHERE st.shift_template_id = %s
            AND st.company_id = %s
            LIMIT 1
        """, (
            shift_template_id,
            company_id
        ))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Shift template not found"
            )

        cursor.execute("""
            SELECT COUNT(*)
            FROM shift_staffing_requirements
            WHERE company_id = %s
            AND shift_template_id = %s
            AND is_active = TRUE
        """, (
            company_id,
            shift_template_id
        ))

        active_staffing_requirement_count = cursor.fetchone()[0]

        if active_staffing_requirement_count > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot deactivate shift. "
                    f"{active_staffing_requirement_count} active staffing "
                    f"requirement(s) use this shift."
                )
            )

        cursor.execute("""
            UPDATE shift_templates
            SET
                is_active = FALSE,
                updated_at = NOW()
            WHERE shift_template_id = %s
            AND company_id = %s
        """, (
            shift_template_id,
            company_id
        ))

        conn.commit()

        return {
            "message": "Shift template deactivated successfully",
            "shift_template_id": row[0],
            "shift_name": row[1],
            "account_name": row[2],
        }


    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()
        print("DELETE SHIFT TEMPLATE ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cursor.close()
        conn.close()
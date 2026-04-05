import pdfplumber
import re
import io


def parse_salary_pdf(file_bytes: bytes) -> dict:
    """
    Parse a salary PDF and extract employee payment details.
    Supports common salary sheet formats with columns like:
    Name, Account Number, IFSC Code, Salary/Amount
    """
    try:
        pdf = pdfplumber.open(io.BytesIO(file_bytes))
        all_text = ""
        all_tables = []

        for page in pdf.pages:
            # Try table extraction first
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    all_tables.append(table)

            # Also get raw text as fallback
            text = page.extract_text()
            if text:
                all_text += text + "\n"

        pdf.close()

        employees = []

        # Try parsing from tables first
        if all_tables:
            employees = _parse_from_tables(all_tables)

        # Fallback: parse from raw text
        if not employees:
            employees = _parse_from_text(all_text)

        return {
            "success": True,
            "employees": employees,
            "total_amount": sum(e.get("salary", 0) for e in employees),
            "count": len(employees),
            "raw_text": all_text[:2000]  # first 2000 chars for debugging
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "employees": [],
            "total_amount": 0,
            "count": 0,
            "raw_text": ""
        }


def _parse_from_tables(tables: list) -> list:
    """Parse employee data from extracted PDF tables."""
    employees = []

    for table in tables:
        if not table or len(table) < 2:
            continue

        # Find header row
        header = None
        header_idx = -1
        for i, row in enumerate(table):
            if not row:
                continue
            row_text = " ".join(str(cell or "").lower() for cell in row)
            # Check if this row looks like a header
            if any(kw in row_text for kw in ["name", "account", "salary", "amount", "ifsc", "employee"]):
                header = row
                header_idx = i
                break

        if header is None:
            continue

        # Map column indices
        col_map = _map_columns(header)
        if not col_map.get("name") and not col_map.get("account"):
            continue

        # Parse data rows
        for row in table[header_idx + 1:]:
            if not row:
                continue
            emp = _extract_employee(row, col_map)
            if emp:
                employees.append(emp)

    return employees


def _map_columns(header: list) -> dict:
    """Map header columns to field names."""
    col_map = {}
    for i, cell in enumerate(header):
        cell_text = str(cell or "").lower().strip()
        # Check bank name BEFORE generic name to avoid "bank name" matching as employee name
        if any(kw in cell_text for kw in ["bank name", "bank"]):
            col_map["bank"] = i
        elif any(kw in cell_text for kw in ["account no", "account number", "acc no", "a/c no", "bank account", "acc num"]):
            col_map["account"] = i
        elif any(kw in cell_text for kw in ["ifsc", "ifsc code", "bank code"]):
            col_map["ifsc"] = i
        elif any(kw in cell_text for kw in ["salary", "amount", "net pay", "net salary", "total", "gross", "ctc", "pay"]):
            col_map["salary"] = i
        elif any(kw in cell_text for kw in ["employee name", "name", "emp name", "employee"]):
            col_map["name"] = i
        elif any(kw in cell_text for kw in ["emp id", "employee id", "id", "sr", "sl", "s.no", "sr.no"]):
            col_map["id"] = i
    return col_map


def _extract_employee(row: list, col_map: dict) -> dict | None:
    """Extract a single employee record from a table row."""
    try:
        name = str(row[col_map["name"]]).strip() if "name" in col_map and row[col_map["name"]] else ""
        account = str(row[col_map["account"]]).strip() if "account" in col_map and row[col_map["account"]] else ""
        ifsc = str(row[col_map["ifsc"]]).strip() if "ifsc" in col_map and row[col_map["ifsc"]] else ""
        salary_str = str(row[col_map["salary"]]).strip() if "salary" in col_map and row[col_map["salary"]] else "0"
        bank = str(row[col_map["bank"]]).strip() if "bank" in col_map and row[col_map["bank"]] else ""

        # Clean salary value - extract number
        salary = _parse_amount(salary_str)

        # Skip empty or header-like rows
        if not name or name.lower() in ["name", "employee name", "total", "grand total", ""]:
            return None
        if salary <= 0:
            return None

        # Clean account number
        account = re.sub(r'[^0-9]', '', account)

        # Validate IFSC format (4 letters + 0 + 6 alphanumeric)
        ifsc = ifsc.upper().strip()

        return {
            "name": name.title(),
            "accountNumber": account,
            "ifsc": ifsc,
            "salary": salary,
            "bank": bank,
            "status": "pending",
            "verified": False
        }
    except (IndexError, KeyError, ValueError):
        return None


def _parse_from_text(text: str) -> list:
    """
    Fallback: Parse employee data from raw text using regex patterns.
    Tries to find patterns like:
    Name | Account Number | IFSC | Amount
    """
    employees = []
    lines = text.split("\n")

    # Pattern: Look for lines with account numbers (9-18 digits) and amounts
    account_pattern = re.compile(r'\b(\d{9,18})\b')
    ifsc_pattern = re.compile(r'\b([A-Z]{4}0[A-Z0-9]{6})\b')
    amount_pattern = re.compile(r'(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{2})?)\b', re.IGNORECASE)

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        account_match = account_pattern.search(line)
        if account_match:
            account = account_match.group(1)
            ifsc_match = ifsc_pattern.search(line)
            ifsc = ifsc_match.group(1) if ifsc_match else ""

            # Find amounts in the line
            amounts = amount_pattern.findall(line)
            salary = 0
            for amt_str in reversed(amounts):  # last amount is likely the salary
                val = _parse_amount(amt_str)
                if val > 100:  # likely a salary, not sr. number
                    salary = val
                    break

            # Name is usually before the account number or on previous line
            name = ""
            before_account = line[:account_match.start()].strip()
            # Remove numbers that look like serial numbers
            before_account = re.sub(r'^\d{1,3}[\.\)\s]+', '', before_account).strip()
            if before_account and len(before_account) > 2:
                name = before_account.split("  ")[0].strip()

            if not name and i > 0:
                prev_line = lines[i - 1].strip()
                if prev_line and not account_pattern.search(prev_line):
                    name = prev_line

            if account and salary > 0:
                employees.append({
                    "name": name.title() if name else f"Employee #{len(employees) + 1}",
                    "accountNumber": account,
                    "ifsc": ifsc,
                    "salary": salary,
                    "bank": "",
                    "status": "pending",
                    "verified": False
                })

        i += 1

    return employees


def _parse_amount(s: str) -> float:
    """Parse a string amount like '45,000.00' or '45000' to float."""
    try:
        cleaned = re.sub(r'[₹,\s]', '', str(s))
        cleaned = re.sub(r'[^\d.]', '', cleaned)
        return float(cleaned) if cleaned else 0
    except (ValueError, TypeError):
        return 0

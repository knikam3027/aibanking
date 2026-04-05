from fastapi import APIRouter, UploadFile, File
from app.services.pdf_service import parse_salary_pdf

router = APIRouter()


@router.post("/parse-salary-pdf")
async def parse_salary_pdf_endpoint(file: UploadFile = File(...)):
    """Parse uploaded salary PDF and extract employee payment details."""
    if not file.filename.lower().endswith('.pdf'):
        return {"success": False, "error": "Only PDF files are accepted", "employees": [], "count": 0, "total_amount": 0}

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB limit
        return {"success": False, "error": "File too large. Maximum 10MB.", "employees": [], "count": 0, "total_amount": 0}

    result = parse_salary_pdf(contents)
    return result

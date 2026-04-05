from fastapi import APIRouter
from app.schemas.models import LoanScoreRequest, LoanScoreResponse
from app.services.loan_service import calculate_loan_score

router = APIRouter()


@router.post("/loan-score", response_model=LoanScoreResponse)
def loan_score(req: LoanScoreRequest):
    result = calculate_loan_score(req.amount, req.balance, req.transactions)
    return LoanScoreResponse(**result)

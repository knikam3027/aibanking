from fastapi import APIRouter
from app.schemas.models import FraudCheckRequest, FraudCheckResponse
from app.services.fraud_service import check_fraud

router = APIRouter()


@router.post("/fraud-check", response_model=FraudCheckResponse)
def fraud_check(req: FraudCheckRequest):
    result = check_fraud(req.amount, req.balance, req.recent_transactions)
    return FraudCheckResponse(**result)

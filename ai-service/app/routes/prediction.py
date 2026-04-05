from fastapi import APIRouter
from app.schemas.models import PredictionRequest, PredictionResponse
from app.services.prediction_service import predict_expenses

router = APIRouter()


@router.post("/predict-expense", response_model=PredictionResponse)
def predict_expense(req: PredictionRequest):
    result = predict_expenses(req.balance, req.transactions)
    return PredictionResponse(**result)

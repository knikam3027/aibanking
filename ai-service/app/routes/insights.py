from fastapi import APIRouter
from app.schemas.models import InsightsRequest, InsightsResponse
from app.services.insights_service import generate_insights

router = APIRouter()


@router.post("/insights", response_model=InsightsResponse)
def insights(req: InsightsRequest):
    result = generate_insights(req.balance, req.transactions)
    return InsightsResponse(**result)

from fastapi import APIRouter
from app.schemas.models import ChatRequest, ChatResponse
from app.services.chat_service import analyze_chat

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    reply = analyze_chat(req.message, req.balance, req.transactions, req.chatHistory)
    return ChatResponse(reply=reply)

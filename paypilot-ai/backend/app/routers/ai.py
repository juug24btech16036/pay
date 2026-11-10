import logging
from fastapi import APIRouter, Depends, status
from app.config import Settings, get_settings
from app.schemas.ai import ParseIntentRequest, ParseIntentResponse
from app.services.ai_service import AIService, ai_service

logger = logging.getLogger("paypilot.router.ai")
router = APIRouter(prefix="/api/ai", tags=["AI Copilot"])


@router.post(
    "/parse-intent",
    response_model=ParseIntentResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse natural-language payment prompt into structured parameters",
)
async def parse_intent(
    request: ParseIntentRequest,
    settings: Settings = Depends(get_settings),
) -> ParseIntentResponse:
    """Parse an untrusted natural-language payment prompt using Google Gemini.

    Returns structured payment parameters (amount, currency, description) or
    clarification requests. Does NOT initiate, authorize, or capture any payments.
    """
    logger.info("Received AI parse request for prompt length: %d", len(request.prompt))
    return await ai_service.parse_intent(request.prompt, settings=settings)

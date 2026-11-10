from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends
from app.config import Settings, get_settings

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/api/health")
async def health_check(settings: Settings = Depends(get_settings)) -> Dict[str, Any]:
    """Health check endpoint to monitor service readiness and PayPal configuration."""
    return {
        "status": "ok",
        "service": "paypilot-ai-backend",
        "paypal_configured": settings.is_paypal_configured(),
        "gemini_configured": settings.is_gemini_configured(),
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

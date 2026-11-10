from app.routers.health import router as health_router
from app.routers.paypal import router as paypal_router
from app.routers.ai import router as ai_router

__all__ = ["health_router", "paypal_router", "ai_router"]

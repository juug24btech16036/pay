from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers.health import router as health_router
from app.routers.paypal import router as paypal_router
from app.routers.ai import router as ai_router

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("paypilot.main")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("PayPilot AI backend initialized.")
    logger.info("CORS allowed origins: %s", settings.allowed_origins)
    if settings.is_paypal_configured():
        logger.info(
            "PayPal Sandbox integration ACTIVE with Client ID: %s",
            settings.get_masked_client_id(),
        )
    else:
        logger.warning(
            "PayPal credentials NOT configured. "
            "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env to enable live Sandbox payments."
        )

    if settings.is_gemini_configured():
        logger.info(
            "Gemini AI parser ACTIVE with model: %s",
            settings.GEMINI_MODEL,
        )
    else:
        logger.warning(
            "Gemini API key NOT configured. "
            "Set GEMINI_API_KEY in backend/.env to enable AI natural-language parsing."
        )

    yield
    # Shutdown
    logger.info("PayPilot AI backend shutting down.")


app = FastAPI(
    title="PayPilot AI API",
    version=settings.VERSION,
    description="Backend REST API for PayPilot AI - PayPal Sandbox Checkout & Autonomous Agent Integration",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(paypal_router)
app.include_router(ai_router)


@app.get("/")
async def root():
    return {
        "name": "PayPilot AI API",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "paypal_configured": settings.is_paypal_configured(),
        "gemini_configured": settings.is_gemini_configured(),
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "client_id": "/api/paypal/client-id",
            "create_order": "POST /api/paypal/create-order",
            "capture_order": "POST /api/paypal/capture-order",
            "get_order": "GET /api/paypal/order/{order_id}",
            "transactions": "GET /api/paypal/transactions",
            "parse_intent": "POST /api/ai/parse-intent",
        },
    }

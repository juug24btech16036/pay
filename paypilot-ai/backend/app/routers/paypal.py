from datetime import datetime, timezone
import logging
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from app.config import Settings, get_settings
from app.schemas.paypal import (
    CaptureOrderRequest,
    CaptureOrderResponse,
    ClientIdResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    TransactionRecord,
)
from app.services.paypal_service import PayPalService, paypal_service
from app.storage.transaction_store import transaction_store

logger = logging.getLogger("paypilot.router")
router = APIRouter(prefix="/api/paypal", tags=["PayPal"])


@router.get("/client-id", response_model=ClientIdResponse)
async def get_client_id(settings: Settings = Depends(get_settings)) -> ClientIdResponse:
    """Return the PayPal Sandbox Client ID for frontend SDK initialization.

    NOTE: The client SECRET is strictly kept on the backend and NEVER exposed.
    """
    is_conf = settings.is_paypal_configured()
    instructions = None
    if not is_conf:
        instructions = (
            "PayPal credentials are not configured yet. "
            "Please add your Sandbox credentials (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET) "
            "to backend/.env to enable live Sandbox checkout."
        )

    return ClientIdResponse(
        client_id=settings.PAYPAL_CLIENT_ID if is_conf else "",
        currency=settings.PAYPAL_CURRENCY_DEFAULT,
        environment=settings.ENVIRONMENT,
        is_configured=is_conf,
        instructions=instructions,
    )


@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    request: CreateOrderRequest,
    settings: Settings = Depends(get_settings),
) -> CreateOrderResponse:
    """Create a new PayPal order using the Orders v2 REST API."""
    logger.info("Received request to create PayPal order: %s %s", request.amount, request.currency)

    order_data = await paypal_service.create_order(
        amount=request.amount,
        currency=request.currency,
        description=request.description or "PayPilot AI Checkout",
    )

    order_id = order_data.get("id")
    if not order_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="PayPal response did not contain an order ID.",
        )

    approval_url = None
    for link in order_data.get("links", []):
        if link.get("rel") == "approve":
            approval_url = link.get("href")

    return CreateOrderResponse(
        id=order_id,
        status=order_data.get("status", "CREATED"),
        links=order_data.get("links"),
        approval_url=approval_url,
        currency=request.currency,
        amount=request.amount,
    )


@router.post("/capture-order", response_model=CaptureOrderResponse)
async def capture_order(request: CaptureOrderRequest) -> CaptureOrderResponse:
    """Capture an approved PayPal order using the Orders v2 REST API."""
    logger.info("Received request to capture order ID: %s", request.order_id)

    capture_data = await paypal_service.capture_order(order_id=request.order_id)
    order_status = capture_data.get("status", "UNKNOWN")

    # Extract capture details safely from PayPal response structure
    capture_id = None
    amount_str = None
    currency_str = None
    fee_str = None
    net_str = None
    description_str = "PayPilot AI Payment"

    purchase_units = capture_data.get("purchase_units", [])
    if purchase_units and isinstance(purchase_units, list):
        unit = purchase_units[0]
        description_str = unit.get("description", description_str)
        payments = unit.get("payments", {})
        captures = payments.get("captures", [])
        if captures and isinstance(captures, list):
            first_capture = captures[0]
            capture_id = first_capture.get("id")
            amt_info = first_capture.get("amount", {})
            amount_str = amt_info.get("value")
            currency_str = amt_info.get("currency_code")

            fee_info = first_capture.get("seller_receivable_breakdown", {}).get("paypal_fee", {})
            if fee_info:
                fee_str = f"{fee_info.get('value')} {fee_info.get('currency_code', '')}"
            net_info = first_capture.get("seller_receivable_breakdown", {}).get("net_amount", {})
            if net_info:
                net_str = f"{net_info.get('value')} {net_info.get('currency_code', '')}"

    payer = capture_data.get("payer", {})
    payer_email = payer.get("email_address")
    payer_name = None
    if "name" in payer and isinstance(payer["name"], dict):
        given_name = payer["name"].get("given_name", "")
        surname = payer["name"].get("surname", "")
        payer_name = f"{given_name} {surname}".strip() or None

    now_iso = datetime.now(timezone.utc).isoformat()

    # Save real transaction record for dashboard
    tx_record = TransactionRecord(
        order_id=request.order_id,
        capture_id=capture_id,
        status=order_status,
        amount=amount_str or "0.00",
        currency=currency_str or "USD",
        description=description_str,
        payer_email=payer_email,
        payer_name=payer_name,
        created_at=now_iso,
        paypal_fee=fee_str,
        net_amount=net_str,
    )
    transaction_store.save(tx_record)

    return CaptureOrderResponse(
        id=request.order_id,
        status=order_status,
        capture_id=capture_id,
        amount=amount_str,
        currency=currency_str,
        payer_email=payer_email,
        payer_name=payer_name,
        create_time=capture_data.get("create_time", now_iso),
        details=capture_data,
    )


@router.get("/order/{order_id}")
async def get_order(order_id: str) -> Dict[str, Any]:
    """Look up an existing order by ID from PayPal Sandbox."""
    order_data = await paypal_service.get_order(order_id=order_id)
    return order_data


@router.get("/transactions", response_model=List[TransactionRecord])
async def list_transactions() -> List[TransactionRecord]:
    """Return list of recent real captured transactions for the dashboard."""
    return transaction_store.list_all()

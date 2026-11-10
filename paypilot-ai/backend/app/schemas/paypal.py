from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# Common supported PayPal currencies
SUPPORTED_CURRENCIES = {
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "JPY",
    "CHF",
    "SGD",
    "HKD",
    "NZD",
    "SEK",
    "NOK",
    "DKK",
    "PLN",
    "CZK",
    "ILS",
    "MXN",
    "BRL",
    "PHP",
    "TWD",
    "THB",
    "INR",
}


class CreateOrderRequest(BaseModel):
    """Payload to create a PayPal checkout order."""

    amount: str = Field(
        ...,
        description="Payment amount as a decimal string, e.g. '15.00'",
        examples=["15.00"],
    )
    currency: str = Field(
        default="USD",
        description="3-letter ISO-4217 currency code. Default is USD for Sandbox prototype.",
        examples=["USD"],
    )
    description: Optional[str] = Field(
        default="PayPilot AI Intelligent Checkout",
        description="Optional purchase description",
        max_length=127,
    )
    custom_id: Optional[str] = Field(
        default=None,
        description="Optional custom identifier / prompt reference",
        max_length=127,
    )

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        code = v.strip().upper()
        if len(code) != 3:
            raise ValueError("Currency must be a 3-letter ISO currency code (e.g. USD).")
        if code not in SUPPORTED_CURRENCIES:
            raise ValueError(
                f"Unsupported currency: {code}. Supported currencies include: {', '.join(sorted(SUPPORTED_CURRENCIES))}"
            )
        return code

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        raw = str(v).strip()
        try:
            val = Decimal(raw)
        except InvalidOperation:
            raise ValueError("Amount must be a valid numeric decimal string (e.g. '10.00').")

        if val <= Decimal("0.00"):
            raise ValueError("Amount must be greater than 0.00.")

        # Check precision: max 2 decimal places
        exponent = val.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise ValueError("Amount can have at most 2 decimal places.")

        # Format to standard 2 decimal places
        return f"{val:.2f}"


class CreateOrderResponse(BaseModel):
    """Response returned upon successful PayPal order creation."""

    id: str
    status: str
    links: Optional[List[Dict[str, Any]]] = None
    approval_url: Optional[str] = None
    currency: str
    amount: str


class AuthVerifyResponse(BaseModel):
    """Response confirming successful OAuth 2.0 authentication with PayPal Sandbox."""

    status: str
    environment: str
    authenticated: bool
    client_id_preview: str
    message: str


class CaptureOrderRequest(BaseModel):
    """Payload to capture an approved PayPal order."""

    order_id: str = Field(
        ...,
        description="The PayPal Order ID generated during order creation and approved by the buyer.",
        min_length=10,
        max_length=64,
    )


class CaptureOrderResponse(BaseModel):
    """Response returned upon successful PayPal order capture."""

    id: str
    status: str
    capture_id: Optional[str] = None
    amount: Optional[str] = None
    currency: Optional[str] = None
    payer_email: Optional[str] = None
    payer_name: Optional[str] = None
    create_time: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class ClientIdResponse(BaseModel):
    """Public client ID and environment configuration for the frontend."""

    client_id: str
    currency: str
    environment: str
    is_configured: bool
    instructions: Optional[str] = None


class TransactionRecord(BaseModel):
    """Stored transaction record for the dashboard."""

    order_id: str
    capture_id: Optional[str] = None
    status: str
    amount: str
    currency: str
    description: str
    payer_email: Optional[str] = None
    payer_name: Optional[str] = None
    created_at: str
    paypal_fee: Optional[str] = None
    net_amount: Optional[str] = None

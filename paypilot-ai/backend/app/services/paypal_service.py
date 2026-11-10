import base64
import logging
import time
import uuid
from typing import Any, Dict, Optional, Tuple
import httpx
from fastapi import HTTPException, status
from app.config import Settings, get_settings

# Configure specialized logger
logger = logging.getLogger("paypilot.paypal")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [PayPilot-PayPal] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class PayPalService:
    """Service class for interfacing with the official PayPal REST Orders API (Sandbox).

    Security note:
    - Never logs client secrets or access tokens.
    - Caches token in-memory safely with expiration margin.
    """

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _ensure_credentials(self) -> None:
        """Validate that credentials are set before attempting API calls."""
        if not self.settings.is_paypal_configured():
            logger.error(
                "PayPal API credentials missing or incomplete. "
                "Ensure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set in backend/.env"
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "PayPal Sandbox credentials are not configured. "
                    "Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env to use PayPal Sandbox."
                ),
            )

    async def get_access_token(self) -> str:
        """Fetch or return cached OAuth 2.0 access token using client_credentials grant.

        Tokens are cached until 60 seconds before expiration.
        """
        self._ensure_credentials()

        # Check if cached token is still valid with a 60-second buffer
        now = time.time()
        if self._cached_token and now < (self._token_expires_at - 60):
            return self._cached_token

        logger.info(
            "Requesting fresh OAuth2 token from PayPal Sandbox (%s)",
            self.settings.get_masked_client_id(),
        )

        url = f"{self.settings.PAYPAL_API_BASE}/v1/oauth2/token"
        headers = {
            "Accept": "application/json",
            "Accept-Language": "en_US",
        }
        data = {"grant_type": "client_credentials"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    url,
                    data=data,
                    headers=headers,
                    auth=(
                        self.settings.PAYPAL_CLIENT_ID,
                        self.settings.PAYPAL_CLIENT_SECRET,
                    ),
                )

            if response.status_code == 401:
                logger.error("PayPal OAuth2 authentication failed: HTTP 401 Unauthorized (Invalid credentials)")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "error": "Invalid PayPal Sandbox credentials",
                        "status_code": 401,
                        "hint": "Check that PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env match your PayPal Sandbox app credentials.",
                    },
                )

            if response.status_code != 200:
                logger.error(
                    "PayPal OAuth2 failure - HTTP status: %d, response: %s",
                    response.status_code,
                    response.text,
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "error": "PayPal authentication failed",
                        "status_code": response.status_code,
                        "hint": "Verify PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env",
                    },
                )

            token_data = response.json()
            access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)

            if not access_token:
                logger.error("PayPal OAuth2 response did not contain access_token")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Invalid token response from PayPal Sandbox.",
                )

            # Store sanitized cache (do NOT log the token itself)
            self._cached_token = access_token
            self._token_expires_at = now + float(expires_in)
            logger.info(
                "Successfully acquired PayPal OAuth2 token (valid for %s seconds)",
                expires_in,
            )
            return access_token

        except httpx.TimeoutException:
            logger.error("Network timeout while authenticating with PayPal Sandbox OAuth endpoint")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Network timeout while connecting to PayPal Sandbox OAuth endpoint. Please check your internet connection.",
            )
        except httpx.RequestError as exc:
            logger.error("Network error communicating with PayPal OAuth endpoint: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Network error communicating with PayPal: {exc.__class__.__name__}",
            )

    async def create_order(
        self, amount: str, currency: str = "USD", description: str = "PayPilot AI Checkout"
    ) -> Dict[str, Any]:
        """Create a PayPal checkout order via POST /v2/checkout/orders.

        Args:
            amount: Formatted decimal string (e.g. '25.00')
            currency: 3-letter currency code (e.g. 'USD')
            description: Payment description

        Returns:
            PayPal order response dictionary containing 'id', 'status', 'links', etc.
        """
        token = await self.get_access_token()
        request_id = str(uuid.uuid4())

        logger.info(
            "Creating PayPal order: amount=%s %s, desc='%s', request_id=%s",
            amount,
            currency,
            description,
            request_id,
        )

        url = f"{self.settings.PAYPAL_API_BASE}/v2/checkout/orders"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "PayPal-Request-Id": request_id,
        }

        payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": "default",
                    "description": description[:127],
                    "amount": {
                        "currency_code": currency,
                        "value": amount,
                    },
                }
            ],
            "application_context": {
                "brand_name": "PayPilot AI",
                "landing_page": "NO_PREFERENCE",
                "user_action": "PAY_NOW",
                "return_url": "http://localhost:5173/",
                "cancel_url": "http://localhost:5173/",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code not in (200, 201):
                logger.error(
                    "PayPal Order Creation error - HTTP status: %d, response: %s",
                    response.status_code,
                    response.text,
                )
                try:
                    err_json = response.json()
                except Exception:
                    err_json = {"raw": response.text}

                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "error": "Failed to create PayPal order",
                        "paypal_response": err_json,
                    },
                )

            data = response.json()
            order_id = data.get("id")
            order_status = data.get("status")
            logger.info("Order created successfully: order_id=%s status=%s", order_id, order_status)
            return data

        except httpx.TimeoutException:
            logger.error("Network timeout while creating PayPal order")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Network timeout while creating PayPal order. Please retry.",
            )
        except httpx.RequestError as exc:
            logger.error("Network error while creating PayPal order: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Network error calling PayPal Orders API: {exc.__class__.__name__}",
            )

    async def capture_order(self, order_id: str) -> Dict[str, Any]:
        """Capture an approved PayPal order via POST /v2/checkout/orders/{id}/capture.

        Args:
            order_id: The PayPal order ID approved by the user

        Returns:
            PayPal capture response dictionary
        """
        token = await self.get_access_token()
        request_id = str(uuid.uuid4())

        logger.info("Capturing PayPal order: order_id=%s, request_id=%s", order_id, request_id)

        url = f"{self.settings.PAYPAL_API_BASE}/v2/checkout/orders/{order_id}/capture"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "PayPal-Request-Id": request_id,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(url, json={}, headers=headers)

            if response.status_code not in (200, 201):
                logger.error(
                    "PayPal Order Capture error for %s - HTTP status: %d, response: %s",
                    order_id,
                    response.status_code,
                    response.text,
                )
                try:
                    err_json = response.json()
                except Exception:
                    err_json = {"raw": response.text}

                # Specific handling for duplicate capture / unprocessable states
                details_list = err_json.get("details", []) if isinstance(err_json, dict) else []
                issues = [d.get("issue") for d in details_list if isinstance(d, dict)]

                if "ORDER_ALREADY_CAPTURED" in issues:
                    logger.warning("Duplicate capture attempted for order: %s", order_id)
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "error": "Duplicate capture: This PayPal order has already been captured.",
                            "order_id": order_id,
                            "paypal_response": err_json,
                        },
                    )

                if "ORDER_NOT_APPROVED" in issues:
                    logger.warning("Capture attempted on unapproved order: %s", order_id)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error": "Order has not yet been approved by buyer in PayPal Sandbox.",
                            "order_id": order_id,
                            "paypal_response": err_json,
                        },
                    )

                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "error": "Failed to capture PayPal order",
                        "order_id": order_id,
                        "paypal_response": err_json,
                    },
                )

            data = response.json()
            status_val = data.get("status")
            logger.info("Order %s captured successfully with status: %s", order_id, status_val)
            return data

        except httpx.TimeoutException:
            logger.error("Network timeout while capturing PayPal order %s", order_id)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Network timeout while capturing PayPal order. Check order status before retrying.",
            )
        except httpx.RequestError as exc:
            logger.error("Network error capturing PayPal order %s: %s", order_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Network error capturing PayPal order: {exc.__class__.__name__}",
            )

    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Lookup order details via GET /v2/checkout/orders/{id}.

        Args:
            order_id: PayPal order ID

        Returns:
            PayPal order details
        """
        token = await self.get_access_token()
        logger.info("Looking up PayPal order: order_id=%s", order_id)

        url = f"{self.settings.PAYPAL_API_BASE}/v2/checkout/orders/{order_id}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers)

            if response.status_code != 200:
                logger.error(
                    "PayPal Order Lookup error for %s - HTTP status: %d, response: %s",
                    order_id,
                    response.status_code,
                    response.text,
                )
                try:
                    err_json = response.json()
                except Exception:
                    err_json = {"raw": response.text}

                raise HTTPException(
                    status_code=response.status_code,
                    detail={
                        "error": f"Failed to retrieve order {order_id}",
                        "paypal_response": err_json,
                    },
                )

            data = response.json()
            logger.info("Order lookup succeeded for %s: status=%s", order_id, data.get("status"))
            return data

        except httpx.RequestError as exc:
            logger.error("Network error looking up PayPal order %s: %s", order_id, str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Network error looking up PayPal order: {exc.__class__.__name__}",
            )


# Service singleton
paypal_service = PayPalService()

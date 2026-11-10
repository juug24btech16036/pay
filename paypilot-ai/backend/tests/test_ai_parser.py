import json
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

client = TestClient(app)


def test_health_endpoint_includes_gemini_status():
    """Verify health endpoint includes gemini_configured boolean without leaking credentials."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "paypal_configured" in data
    assert "gemini_configured" in data
    assert isinstance(data["gemini_configured"], bool)
    assert "timestamp" in data


def test_ai_parse_unconfigured_gemini_key():
    """When GEMINI_API_KEY is missing or placeholder, returns 503 with helpful setup instructions."""
    unconfigured_settings = Settings()
    unconfigured_settings.GEMINI_API_KEY = ""

    app.dependency_overrides[get_settings] = lambda: unconfigured_settings
    try:
        response = client.post(
            "/api/ai/parse-intent",
            json={"prompt": "Pay $25 for inference tokens"},
        )
        assert response.status_code == 503
        data = response.json()
        assert "GEMINI_API_KEY" in data["detail"]
        assert "not configured" in data["detail"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_empty_prompt():
    """Empty prompt is rejected with 422 Unprocessable Entity."""
    response = client.post(
        "/api/ai/parse-intent",
        json={"prompt": ""},
    )
    assert response.status_code == 422


def test_ai_parse_prompt_too_long():
    """Prompt exceeding 500 characters is rejected by Pydantic schema with 422."""
    long_prompt = "pay " + ("a" * 501)
    response = client.post(
        "/api/ai/parse-intent",
        json={"prompt": long_prompt},
    )
    assert response.status_code == 422


def test_ai_parse_success_mocked_gemini():
    """Successful parsing of amount, currency, and description from mocked Gemini."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"
    test_settings.GEMINI_MODEL = "gemini-2.5-flash"

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "amount": "25.00",
                                "currency": "USD",
                                "description": "Autonomous cloud inference tokens",
                                "intent": "Compute Credits",
                                "needs_clarification": False,
                                "clarification_question": None,
                                "explanation": "Extracted $25.00 USD for cloud inference tokens.",
                            })
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $25 for autonomous cloud inference tokens"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["amount"] == "25.00"
            assert data["currency"] == "USD"
            assert data["description"] == "Autonomous cloud inference tokens"
            assert data["intent"] == "Compute Credits"
            assert data["needs_clarification"] is False
            assert data["clarification_question"] is None
            assert "25.00" in data["explanation"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_needs_clarification_missing_amount():
    """When user prompt omits amount, parser requests clarification and does NOT invent amount."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "amount": None,
                                "currency": "USD",
                                "description": "Server hosting renewal",
                                "intent": "Hosting Renewal",
                                "needs_clarification": True,
                                "clarification_question": "Could you please specify how much you would like to pay for the hosting renewal?",
                                "explanation": "Identified hosting renewal intent, but no payment amount was specified.",
                            })
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Renew server hosting plan"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["needs_clarification"] is True
            assert data["amount"] is None
            assert data["clarification_question"] is not None
            assert "how much" in data["clarification_question"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_backend_rejects_negative_or_zero_amount():
    """Backend validator overrides model if it hallucinates non-positive amount."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "amount": "-10.00",
                                "currency": "USD",
                                "description": "Invalid negative payment",
                                "intent": "Refund Attempt",
                                "needs_clarification": False,
                                "clarification_question": None,
                                "explanation": "Negative payment parsed",
                            })
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay -$10 for bad token"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["needs_clarification"] is True
            assert data["amount"] is None
            assert "valid payment amount" in data["clarification_question"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_backend_rejects_unsupported_currency():
    """Backend validator overrides model if currency is not a supported PayPal currency."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    mock_gemini_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "amount": "50.00",
                                "currency": "XYZ",
                                "description": "Custom token",
                                "intent": "Token Purchase",
                                "needs_clarification": False,
                                "clarification_question": None,
                                "explanation": "Extracted XYZ currency",
                            })
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Send 50 XYZ to contractor"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["needs_clarification"] is True
            assert data["amount"] is None
            assert "XYZ" in data["clarification_question"]
            assert "not supported" in data["clarification_question"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_strips_markdown_code_fences():
    """Model returning ```json ... ``` wrapper is cleanly parsed without JSON errors."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    raw_json = json.dumps({
        "amount": "14.99",
        "currency": "EUR",
        "description": "Monthly API subscription",
        "intent": "Subscription",
        "needs_clarification": False,
        "clarification_question": None,
        "explanation": "Extracted 14.99 EUR subscription.",
    })
    wrapped_text = f"```json\n{raw_json}\n```"

    mock_gemini_payload = {
        "candidates": [
            {"content": {"parts": [{"text": wrapped_text}]}}
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay 14.99 euros for monthly API subscription"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["amount"] == "14.99"
            assert data["currency"] == "EUR"
            assert data["needs_clarification"] is False
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_rate_limit_429():
    """Upstream 429 returns clean 429 status and message."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    mock_resp = httpx.Response(
        status_code=429,
        text="Rate limit exceeded",
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $10"},
            )

            assert response.status_code == 429
            assert "rate limit" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_auth_error_401():
    """Upstream 401 returns 502 with message without leaking secret key."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_invalid_dummy_key_12345"

    mock_resp = httpx.Response(
        status_code=401,
        text="API key not valid",
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $10"},
            )

            assert response.status_code == 502
            detail = response.json()["detail"]
            assert "authentication failed" in detail.lower()
            assert test_settings.GEMINI_API_KEY not in detail
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_timeout_504():
    """Network timeout to Gemini returns 504 Gateway Timeout."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Connection timed out")

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $10"},
            )

            assert response.status_code == 504
            assert "timeout" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_network_error_503():
    """Network connection error returns 503 Service Unavailable."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.ConnectError("Connection refused")

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $10"},
            )

            assert response.status_code == 503
            assert "network" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_ai_parse_malformed_json_502():
    """Malformed candidate output returns 502 Bad Gateway."""
    test_settings = Settings()
    test_settings.GEMINI_API_KEY = "test_valid_dummy_key_12345"

    mock_gemini_payload = {
        "candidates": [
            {"content": {"parts": [{"text": "this is not json at all!"}]}}
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_gemini_payload,
        request=httpx.Request("POST", "https://mock.gemini.api"),
    )

    app.dependency_overrides[get_settings] = lambda: test_settings
    try:
        with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp

            response = client.post(
                "/api/ai/parse-intent",
                json={"prompt": "Pay $10"},
            )

            assert response.status_code == 502
            assert "unparseable" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_settings, None)

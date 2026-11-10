import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "paypilot-ai-backend"
    assert "paypal_configured" in data
    assert data["environment"] == "sandbox"


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "PayPilot AI API"
    assert "endpoints" in data


def test_client_id_endpoint_unconfigured():
    response = client.get("/api/paypal/client-id")
    assert response.status_code == 200
    data = response.json()
    assert "client_id" in data
    assert data["currency"] == "USD"
    assert data["environment"] == "sandbox"


def test_create_order_validation_invalid_amount():
    response = client.post(
        "/api/paypal/create-order",
        json={"amount": "-5.00", "currency": "USD"},
    )
    assert response.status_code == 422


def test_create_order_validation_invalid_currency():
    response = client.post(
        "/api/paypal/create-order",
        json={"amount": "10.00", "currency": "INVALID"},
    )
    assert response.status_code == 422


def test_create_order_unconfigured_error():
    # Without credentials, returns 503/502; with valid sandbox credentials, creates order (201)
    response = client.post(
        "/api/paypal/create-order",
        json={"amount": "10.00", "currency": "USD", "description": "Test order"},
    )
    assert response.status_code in (201, 503, 502)


def test_capture_order_validation():
    # Short order id fails min_length validation
    response = client.post(
        "/api/paypal/capture-order",
        json={"order_id": "short"},
    )
    assert response.status_code == 422

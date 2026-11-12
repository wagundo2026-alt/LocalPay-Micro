"""LocalPay health and security smoke checks; no live Supabase credentials needed."""
import os
os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
from app import app

def test_health():
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.json["data"]["status"] == "ok"

def test_private_routes_require_auth():
    client = app.test_client()
    for route in ("/api/merchant/me", "/api/payment-links", "/api/transactions", "/api/dashboard/summary"):
        assert client.get(route).status_code == 401

def test_mock_payment_disabled(monkeypatch):
    monkeypatch.delenv("ENABLE_DEMO_PAYMENTS", raising=False)
    assert app.test_client().post("/api/payments/demo-complete", json={"reference": "fake"}).status_code == 403

def test_webhooks_fail_closed():
    assert app.test_client().post("/api/webhooks/payments", json={"status": "success"}).status_code == 501

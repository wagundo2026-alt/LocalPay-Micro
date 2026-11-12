"""No live keys required: smoke checks for API safety and Paystack signatures."""
import os
import hashlib
import hmac
import json
from datetime import datetime, timezone

os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)
from app import app
from paystack import authentic_webhook, PaystackError, test_key


def test_health():
    response = app.test_client().get("/api/health")
    assert response.status_code == 200
    assert response.json["data"]["status"] == "ok"


def test_root_returns_api_info():
    response = app.test_client().get("/")
    assert response.status_code == 200
    assert response.json["data"]["service"] == "LocalPay Micro API"


def test_private_routes_require_auth():
    client = app.test_client()
    for route in ("/api/merchant/me", "/api/payment-links", "/api/transactions",
                  "/api/dashboard/summary", "/api/dashboard/analytics"):
        assert client.get(route).status_code == 401


def test_mock_payment_disabled(monkeypatch):
    monkeypatch.delenv("ENABLE_DEMO_PAYMENTS", raising=False)
    assert app.test_client().post("/api/payments/demo-complete",
                                  json={"reference": "fake"}).status_code == 403


def test_webhooks_fail_closed_without_key(monkeypatch):
    monkeypatch.delenv("PAYSTACK_SECRET_KEY", raising=False)
    assert app.test_client().post("/api/webhooks/payments",
                                  json={"event": "charge.success"}).status_code == 503


def test_webhook_rejects_forgery(monkeypatch):
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_fake_test_value_only")
    assert app.test_client().post("/api/webhooks/payments",
                                  data=b'{"event":"charge.success"}',
                                  content_type="application/json").status_code == 401


def test_legacy_webhook_hmac(monkeypatch):
    secret = "sk_test_fake_value"
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", secret)
    raw = b'{"event":"charge.success"}'
    signature = hmac.new(secret.encode(), raw, hashlib.sha512).hexdigest()
    assert authentic_webhook({"x-paystack-signature": signature}, raw)
    assert not authentic_webhook({"x-paystack-signature": "0"*128}, raw)


def test_timestamped_webhook_hmac(monkeypatch):
    secret = "whsec_fake_value"
    monkeypatch.setenv("PAYSTACK_WEBHOOK_SECRET", secret)
    ts = int(datetime.now(timezone.utc).timestamp())
    raw = b'{"event":"charge.success"}'
    signature = hmac.new(secret.encode(), str(ts).encode() + b"." + raw, hashlib.sha512).hexdigest()
    header = {"Paystack-Signature": f"t={ts},v1=whk_test:{signature}"}
    assert authentic_webhook(header, raw)
    assert not authentic_webhook({"Paystack-Signature": f"t={ts-3600},v1=whk_test:{signature}"}, raw)


def test_live_key_rejected(monkeypatch):
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_live_never_allowed")
    try:
        test_key()
        assert False, "Live key should not be accepted"
    except PaystackError:
        pass


def test_cors_allows_localpay_vercel_preview():
    response = app.test_client().options(
        "/api/merchant/me",
        headers={
            "Origin": "https://local-pay-micro-ok0e4wu82-low-cost.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.headers.get("Access-Control-Allow-Origin") == "https://local-pay-micro-ok0e4wu82-low-cost.vercel.app"


def test_cors_blocks_unrelated_website():
    response = app.test_client().options(
        "/api/merchant/me",
        headers={"Origin": "https://unrelated.example", "Access-Control-Request-Method": "GET"},
    )
    assert not response.headers.get("Access-Control-Allow-Origin")

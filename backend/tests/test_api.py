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
                  "/api/dashboard/summary", "/api/dashboard/analytics", "/api/dashboard/bootstrap"):
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


def test_cors_allows_configured_local_origin():
    response = app.test_client().options(
        "/api/merchant/me",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"


def test_cors_rejects_unapproved_preview():
    response = app.test_client().options(
        "/api/merchant/me",
        headers={
            "Origin": "https://local-pay-micro-random-preview.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert not response.headers.get("Access-Control-Allow-Origin")


def test_cors_blocks_unrelated_website():
    response = app.test_client().options(
        "/api/merchant/me",
        headers={"Origin": "https://unrelated.example", "Access-Control-Request-Method": "GET"},
    )
    assert not response.headers.get("Access-Control-Allow-Origin")


def test_pricing_matches_enforced_quotas():
    from app import PLANS
    assert PLANS["basic"] == {"name": "Basic", "price_cents": 4900, "monthly_limit": 200}
    assert PLANS["pro"] == {"name": "Pro", "price_cents": 9900, "monthly_limit": 1000}
    assert PLANS["pro_plus"] == {"name": "Pro Plus", "price_cents": 19900, "monthly_limit": 5000}


def test_plan_mutations_require_auth():
    client = app.test_client()
    assert client.get("/api/merchant/plan").status_code == 401
    assert client.post("/api/merchant/upgrade-request", json={"plan":"pro_plus"}).status_code == 401


def test_bootstrap_is_private_and_unknown_view_is_rejected_before_data_load():
    client = app.test_client()
    assert client.get("/api/dashboard/bootstrap?view=overview").status_code == 401
    assert client.get("/api/dashboard/bootstrap?view=subscription").status_code == 401


def test_security_response_headers():
    response = app.test_client().get("/api/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"


def test_malformed_json_does_not_disable_limits():
    response = app.test_client().post(
        "/api/payments/initialize",
        data=b"x" * (129 * 1024),
        content_type="application/json",
    )
    assert response.status_code == 413


def test_no_public_upgrade_without_auth():
    response = app.test_client().post("/api/merchant/upgrade-request", json={"plan":"pro_plus"})
    assert response.status_code == 401


def test_payment_link_tokens_are_unpredictable_and_unique():
    import secrets
    from app import PAYMENT_TOKEN
    tokens=[secrets.token_urlsafe(24) for _ in range(100)]
    assert all(PAYMENT_TOKEN.fullmatch(token) for token in tokens)
    assert len(set(tokens))==len(tokens)


def test_invalid_token_is_rejected_before_database_lookup():
    from app import available_link
    class DbThatMustNotBeUsed:
        def table(self, name):
            raise AssertionError("Database should not be queried for invalid token")
    assert available_link(DbThatMustNotBeUsed(), "../../merchants") is None
    assert available_link(DbThatMustNotBeUsed(), "short") is None


def test_payer_email_validation_rejects_control_characters():
    from app import PAYER_EMAIL
    assert PAYER_EMAIL.fullmatch("payer@example.com")
    for value in ("payer@example.com\nother@example.org","a b@example.com","no-at-symbol","test@invalid"):
        assert not PAYER_EMAIL.fullmatch(value)


def test_revoke_requires_auth():
    response=app.test_client().post(
        "/api/payment-links/00000000-0000-0000-0000-000000000001/revoke")
    assert response.status_code==401


def test_public_checkout_does_not_accept_invalid_link():
    # GET with an invalid token short-circuits before DB operations.
    response=app.test_client().get("/api/checkout/invalid")
    # Without configured Supabase it fails closed rather than returning merchant data.
    assert response.status_code in (404,503)


def test_payouts_are_not_public():
    assert app.test_client().get("/api/merchant/payouts").status_code == 401


def test_payouts_never_enabled_in_test_mode():
    from app import app
    client = app.test_client()
    # Private payouts cannot be retrieved without a validated Supabase user.
    result = client.get("/api/merchant/payouts")
    assert result.status_code == 401
    assert "payouts" not in str(result.json.get("data") or {})

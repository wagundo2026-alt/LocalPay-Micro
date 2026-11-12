"""Paystack TEST MODE integration. No live funds, no marketplace settlement."""
import hashlib
import hmac
import json
import os
import re
import time
from urllib.parse import quote

import requests

API = "https://api.paystack.co"
REFERENCE = re.compile(r"^LPM-[0-9a-f]{32}$")


class PaystackError(Exception):
    pass


def test_key():
    key = os.environ.get("PAYSTACK_SECRET_KEY", "")
    if not key.startswith("sk_test_"):
        raise PaystackError("Paystack TEST secret key is required. Live keys are prohibited for this MVP.")
    return key


def send(method, path, payload=None):
    secret = test_key()
    try:
        result = requests.request(
            method, API + path, json=payload,
            headers={"Authorization": "Bearer " + secret, "Content-Type": "application/json"},
            timeout=(5, 15),
        )
        result.raise_for_status()
        data = result.json()
        if data.get("status") is not True or not isinstance(data.get("data"), dict):
            raise PaystackError("Payment provider did not accept the request.")
        return data["data"]
    except (requests.RequestException, ValueError) as exc:
        raise PaystackError("Payment provider is temporarily unavailable. Please try again.") from exc


def initialize(reference, amount_cents, customer_email, callback_url):
    if not REFERENCE.fullmatch(reference):
        raise PaystackError("Invalid transaction reference.")
    data = send("POST", "/transaction/initialize", {
        "email": customer_email,
        "amount": str(int(amount_cents)),
        "currency": "ZAR",
        "reference": reference,
        "callback_url": callback_url,
        "metadata": json.dumps({"product": "LocalPay Micro", "mode": "test"}),
    })
    url = data.get("authorization_url", "")
    if not url.startswith("https://checkout.paystack.com/"):
        raise PaystackError("Provider returned an unexpected checkout destination.")
    if data.get("reference") and data["reference"] != reference:
        raise PaystackError("Provider reference did not match.")
    return url


def verify(reference):
    if not REFERENCE.fullmatch(reference):
        raise PaystackError("Invalid reference.")
    return send("GET", "/transaction/verify/" + quote(reference, safe=""))


def authentic_webhook(headers, raw_body):
    """Accept the newer timestamped Paystack-Signature or legacy x-paystack-signature."""
    newer = headers.get("Paystack-Signature", "")
    if newer:
        secret = os.environ.get("PAYSTACK_WEBHOOK_SECRET", "")
        if not secret.startswith("whsec_"):
            return False
        timestamp = None
        signatures = []
        for field in newer.split(","):
            field = field.strip()
            if field.startswith("t="):
                try:
                    timestamp = int(field[2:])
                except ValueError:
                    return False
            elif field.startswith("v1="):
                item = field[3:].split(":", 1)
                if len(item) == 2 and item[0].startswith("whk_"):
                    signatures.append(item[1])
        if timestamp is None or abs(time.time() - timestamp) > 300:
            return False
        expected = hmac.new(secret.encode(), str(timestamp).encode() + b"." + raw_body, hashlib.sha512).hexdigest()
        return any(hmac.compare_digest(expected, candidate) for candidate in signatures)
    legacy = headers.get("x-paystack-signature", "")
    if not legacy or not re.fullmatch(r"[0-9a-f]{128}", legacy):
        return False
    expected = hmac.new(test_key().encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, legacy)


def reconcile(db, reference):
    """Only trust Paystack verification matching our immutable DB request and TEST environment."""
    rows = db.table("transactions").select("*").eq("reference", reference).eq("provider", "paystack").limit(1).execute().data
    if not rows:
        raise PaystackError("Transaction not found.")
    tx = rows[0]
    if tx["status"] == "successful":
        return tx
    result = verify(reference)
    if (result.get("status") != "success"
            or result.get("reference") != reference
            or result.get("currency") != "ZAR"
            or result.get("domain") != "test"
            or int(result.get("amount") or 0) != int(tx["amount_cents"])):
        return tx
    # Paystack test account is restricted to a single explicitly selected demo merchant.
    expected_merchant = os.getenv("PAYSTACK_TEST_MERCHANT_ID", "")
    if not expected_merchant or tx["merchant_id"] != expected_merchant:
        raise PaystackError("Unapproved merchant for this test account.")
    updated = (db.table("transactions")
               .update({"status": "successful", "verified_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
                        "provider_reference": str(result.get("id")) if result.get("id") is not None else None})
               .eq("id", tx["id"]).eq("status", "pending").execute().data)
    return updated[0] if updated else db.table("transactions").select("*").eq("id", tx["id"]).single().execute().data

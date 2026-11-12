"""LocalPay Micro Flask API. Hackathon-only payments; no real PSP is connected."""
import os
import uuid
import secrets
import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, request, jsonify, Response
from paystack import PaystackError, initialize as paystack_initialize, reconcile as paystack_reconcile, authentic_webhook
from flask_cors import CORS
import jwt
from jwt import PyJWKClient
from supabase import create_client

app = Flask(__name__)
origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
CORS(app, origins=origins, supports_credentials=False)
URL = os.getenv("SUPABASE_URL", "").rstrip("/")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DB = None
JWKS = None

def get_db():
    global DB
    if not URL or not KEY or "YOUR_" in URL or "YOUR_" in KEY:
        return None
    if DB is None:
        DB = create_client(URL, KEY)
    return DB

def reply(data=None, status=200, error=None):
    return jsonify({"data": data, "error": error}), status

def requires_user(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer ") or not URL:
            return reply(status=401, error="Authentication required")
        try:
            token = header[7:].strip()
            global JWKS
            if JWKS is None:
                JWKS = PyJWKClient(URL + "/auth/v1/.well-known/jwks.json")
            key = JWKS.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, key.key, algorithms=["RS256", "ES256"],
                audience="authenticated", issuer=URL + "/auth/v1"
            )
            request.user_id = claims["sub"]
        except Exception:
            return reply(status=401, error="Invalid authentication session")
        return fn(*args, **kwargs)
    return inner

def get_merchant(db):
    rows = db.table("merchants").select("*").eq("owner_id", request.user_id).limit(1).execute().data
    return rows[0] if rows else None

def requires_merchant(fn):
    @requires_user
    @wraps(fn)
    def inner(*args, **kwargs):
        db = get_db()
        if db is None:
            return reply(status=503, error="Supabase is not configured")
        merchant = get_merchant(db)
        if merchant is None:
            return reply(status=404, error="Complete merchant onboarding first")
        request.merchant = merchant
        return fn(*args, **kwargs)
    return inner

@app.get("/")
def index():
    return reply({
        "service": "LocalPay Micro API",
        "status": "online",
        "message": "This is the backend API, not the merchant website.",
        "health_url": "/api/health",
        "mode": "DEMO"
    })

@app.get("/api/health")
def health():
    return reply({"status": "ok", "mode": "DEMO", "database_configured": bool(URL and KEY)})

@app.post("/api/merchant/onboard")
@requires_user
def onboard():
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    if get_merchant(db):
        return reply(status=409, error="Merchant already exists")
    body = request.get_json(silent=True) or {}
    name = str(body.get("business_name") or "").strip()
    if not 2 <= len(name) <= 100:
        return reply(status=400, error="Business name must contain 2 to 100 characters")
    row = {"owner_id": request.user_id, "business_name": name,
           "category": str(body.get("category") or "Other")[:80],
           "province": str(body.get("province") or "")[:80],
           "town": str(body.get("town") or "")[:80]}
    result = db.table("merchants").insert(row).execute().data
    return reply(result[0], 201)

@app.get("/api/merchant/me")
@requires_merchant
def merchant_me():
    return reply(request.merchant)

@app.patch("/api/merchant/me")
@requires_merchant
def merchant_update():
    body = request.get_json(silent=True) or {}
    updates = {k: str(body[k])[:100] for k in
               ("business_name", "category", "province", "town") if k in body}
    if not updates:
        return reply(status=400, error="No editable fields")
    return reply(get_db().table("merchants").update(updates).eq("id", request.merchant["id"]).execute().data[0])

@app.post("/api/payment-links")
@requires_merchant
def new_link():
    body = request.get_json(silent=True) or {}
    raw = body.get("amount_cents")
    if isinstance(raw, bool) or not isinstance(raw, int):
        return reply(status=400, error="Amount must be an integer number of cents")
    if raw < 100 or raw > 10000000:
        return reply(status=400, error="Amount must be between R1 and R100,000")
    row = {"merchant_id": request.merchant["id"], "amount_cents": raw,
           "token": secrets.token_urlsafe(24),
           "description": str(body.get("description") or "Payment")[:180]}
    return reply(get_db().table("payment_links").insert(row).execute().data[0], 201)

@app.get("/api/payment-links")
@requires_merchant
def payment_links():
    return reply(get_db().table("payment_links").select("*")
                 .eq("merchant_id", request.merchant["id"]).order("created_at", desc=True).execute().data)

@app.get("/api/checkout/<token>")
def checkout(token):
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    rows = db.table("payment_links").select("*").eq("token", token).eq("active", True).limit(1).execute().data
    if not rows:
        return reply(status=404, error="Payment link not available")
    link = rows[0]
    merchants = db.table("merchants").select("business_name").eq("id", link["merchant_id"]).limit(1).execute().data
    return reply({"token": token, "business_name": merchants[0]["business_name"] if merchants else "Merchant",
                  "amount_cents": link["amount_cents"], "description": link["description"], "mode": "DEMO"})

@app.post("/api/payments/initialize")
def initialize_payment():
    """Initialize sandbox payment using a server-trusted payment link and Paystack checkout."""
    db = get_db()
    if db is None:
        return reply(status=503, error="Supabase is not configured")
    if os.getenv("PAYMENT_PROVIDER", "paystack") != "paystack":
        return reply(status=503, error="Only Paystack test checkout is available")
    body = request.get_json(silent=True) or {}
    token = str(body.get("token") or "")
    email = str(body.get("email") or "").strip()
    if len(email) > 254 or "@" not in email or "." not in email.split("@")[-1]:
        return reply(status=400, error="Please enter a valid customer email to continue")
    rows = db.table("payment_links").select("*").eq("token", token).eq("active", True).limit(1).execute().data
    if not rows:
        return reply(status=404, error="Payment link is no longer available")
    link = rows[0]
    if link["merchant_id"] != os.getenv("PAYSTACK_TEST_MERCHANT_ID", ""):
        return reply(status=403, error="This merchant is not enabled for Paystack sandbox checkout yet")
    secret = os.getenv("PAYSTACK_SECRET_KEY", "")
    if not secret.startswith("sk_test_"):
        return reply(status=503, error="Paystack TEST mode is not configured")
    origin = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not origin.startswith("https://") or "/" in origin.removeprefix("https://"):
        return reply(status=503, error="Configure FRONTEND_URL with your Vercel HTTPS origin")
    reference = "LPM-" + uuid.uuid4().hex
    db.table("transactions").insert({
        "merchant_id": link["merchant_id"], "payment_link_id": link["id"],
        "reference": reference, "amount_cents": int(link["amount_cents"]),
        "status": "pending", "provider": "paystack"
    }).execute()
    try:
        redirect = paystack_initialize(reference, int(link["amount_cents"]), email,
                                       origin + "/payment/success?reference=" + reference)
    except PaystackError as exc:
        return reply(status=502, error=str(exc))
    return reply({"reference": reference, "checkout_url": redirect, "mode": "PAYSTACK_TEST"}, 201)

@app.post("/api/payments/demo-complete")
def demo_complete():
    if os.getenv("ENABLE_DEMO_PAYMENTS", "false").lower() != "true":
        return reply(status=403, error="Demo payment simulator disabled")
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    reference = str((request.get_json(silent=True) or {}).get("reference") or "")
    rows = db.table("transactions").select("id,status,provider").eq("reference", reference).limit(1).execute().data
    if not rows or rows[0]["provider"] != "demo":
        return reply(status=404, error="Demo transaction not found")
    if rows[0]["status"] == "successful":
        return reply({"reference": reference, "status": "successful", "mode": "DEMO"})
    result = db.table("transactions").update({
        "status": "successful", "verified_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", rows[0]["id"]).eq("status", "pending").eq("provider", "demo").execute().data
    if not result:
        return reply(status=409, error="Transaction was not pending")
    return reply({"reference": reference, "status": "successful", "mode": "DEMO"})

@app.get("/api/payments/verify/<reference>")
def payment_verify(reference):
    db = get_db()
    if db is None:
        return reply(status=503, error="Supabase is not configured")
    rows = db.table("transactions").select("*").eq("reference", reference).limit(1).execute().data
    if not rows:
        return reply(status=404, error="Unknown reference")
    tx = rows[0]
    if tx["provider"] == "paystack" and tx["status"] == "pending":
        try:
            tx = paystack_reconcile(db, reference)
        except PaystackError:
            # Unavailable verification never changes payment to successful.
            pass
    return reply({"reference": reference, "status": tx["status"],
                  "amount_cents": tx["amount_cents"], "provider": tx["provider"]})

@app.get("/api/transactions")
@requires_merchant
def transactions():
    return reply(get_db().table("transactions").select("*").eq("merchant_id", request.merchant["id"])
                 .order("created_at", desc=True).limit(100).execute().data)

@app.get("/api/dashboard/summary")
@requires_merchant
def dashboard_summary():
    rows = get_db().table("transactions").select("amount_cents,status").eq("merchant_id", request.merchant["id"]).execute().data
    paid = [r for r in rows if r["status"] == "successful"]
    return reply({"gross_cents": sum(int(r["amount_cents"]) for r in paid),
                  "successful_count": len(paid),
                  "pending_count": sum(r["status"] == "pending" for r in rows),
                  "mode": "DEMO"})

@app.get("/api/dashboard/analytics")
@requires_merchant
def dashboard_analytics():
    rows = get_db().table("transactions").select("amount_cents,status,created_at").eq("merchant_id", request.merchant["id"]).execute().data
    daily = defaultdict(lambda: {"total_cents": 0, "count": 0})
    for row in rows:
        if row["status"] == "successful":
            day = row["created_at"][:10]
            daily[day]["total_cents"] += int(row["amount_cents"])
            daily[day]["count"] += 1
    return reply({"daily": [{"date": day, **v} for day, v in sorted(daily.items())], "mode": "DEMO"})

@app.get("/api/transactions/export.csv")
@requires_merchant
def transactions_csv():
    rows = get_db().table("transactions").select("reference,created_at,amount_cents,currency,status,provider").eq("merchant_id", request.merchant["id"]).order("created_at", desc=True).limit(5000).execute().data
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Reference", "Date", "Amount ZAR", "Currency", "Status", "Provider"])
    for row in rows:
        def clean(value):
            s = str(value)
            return "'" + s if s.startswith(("=", "+", "-", "@", "\t", "\r")) else s
        writer.writerow([clean(row["reference"]), clean(row["created_at"]),
                         f'{int(row["amount_cents"]) / 100:.2f}', clean(row["currency"]),
                         clean(row["status"]), clean(row["provider"])])
    return Response(stream.getvalue(), mimetype="text/csv", headers={
        "Content-Disposition": "attachment; filename=localpay-transactions.csv",
        "Cache-Control": "no-store"
    })

@app.get("/api/receipts/<reference>")
def receipt(reference):
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    if not reference.startswith("LPM-") or len(reference) > 96:
        return reply(status=404, error="Receipt not found")
    rows = db.table("transactions").select("reference,amount_cents,currency,status,created_at,merchant_id").eq("reference", reference).limit(1).execute().data
    if not rows:
        return reply(status=404, error="Receipt not found")
    transaction = rows[0]
    merchants = db.table("merchants").select("business_name").eq("id", transaction["merchant_id"]).limit(1).execute().data
    return reply({"reference": reference, "business_name": merchants[0]["business_name"] if merchants else "Merchant",
                  "amount_cents": transaction["amount_cents"], "currency": transaction["currency"],
                  "status": transaction["status"], "created_at": transaction["created_at"], "mode": "DEMO"})

@app.get("/api/subscriptions")
@requires_user
def subscriptions():
    return reply([{"name": "Free", "price_cents": 0},
                  {"name": "Growth", "price_cents": 4900},
                  {"name": "Business", "price_cents": 9900}])

@app.post("/api/webhooks/payments")
def webhook():
    """Authenticate raw bytes first, then verify Paystack directly before crediting."""
    if not os.getenv("PAYSTACK_SECRET_KEY", "").startswith("sk_test_"):
        return reply(status=503, error="Paystack TEST mode is not configured")
    raw = request.get_data(cache=True)
    if len(raw) > 128 * 1024:
        return reply(status=413, error="Webhook is too large")
    try:
        authentic = authentic_webhook(request.headers, raw)
    except PaystackError:
        authentic = False
    if not authentic:
        return reply(status=401, error="Invalid webhook signature")
    body = request.get_json(silent=True) or {}
    if body.get("event") != "charge.success":
        return reply({"received": True})
    data = body.get("data") or {}
    reference = data.get("reference")
    if not isinstance(reference, str):
        return reply(status=400, error="Missing payment reference")
    db = get_db()
    if db is None:
        return reply(status=503, error="Supabase is not configured")
    try:
        paystack_reconcile(db, reference)
    except PaystackError:
        # Retryable failure for provider delivery; never mark paid on failure.
        return reply(status=503, error="Payment verification unavailable")
    return reply({"received": True})

@app.get("/api/admin/summary")
@requires_user
def admin_summary():
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    rows = db.table("platform_admins").select("user_id").eq("user_id", request.user_id).limit(1).execute().data
    return reply({"message": "Admin authenticated", "mode": "DEMO"}) if rows else reply(status=403, error="Admin access required")

if __name__ == "__main__":
    app.run(port=5000, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")

"""LocalPay Micro Flask API. Hackathon-only payments; no real PSP is connected."""
import os
import uuid
import secrets
import csv
import io
import re
from collections import defaultdict
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, request, jsonify, Response
from paystack import PaystackError, initialize as paystack_initialize, reconcile as paystack_reconcile, authentic_webhook
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from supabase import create_client

app = Flask(__name__)
# Reject oversized request bodies before parsing JSON or signed webhooks.
app.config["MAX_CONTENT_LENGTH"] = 128 * 1024
app.config["MAX_FORM_MEMORY_SIZE"] = 16 * 1024
# Per-worker rate limiting in test mode; set RATELIMIT_STORAGE_URI to Redis
# for shared limits across production Gunicorn workers.
limiter = Limiter(
    get_remote_address, app=app, default_limits=[],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://")
)
# Browsers must use explicitly approved origins; production defaults do not
# trust every preview deployment (including third-party fork previews).
origins = [x.strip().rstrip("/") for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False,
     allow_headers=["Authorization", "Content-Type"], methods=["GET", "POST", "PATCH", "OPTIONS"])
URL = os.getenv("SUPABASE_URL", "").rstrip("/")
EXPECTED_SUPABASE_URL = "https://uvjvkutpdwdvwwafhvon.supabase.co"
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DB = None
JWKS = None

def get_db():
    global DB
    if URL and URL != EXPECTED_SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL on Render points to another Supabase project. Use the LocalPay project URL.")
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
            if not token:
                return reply(status=401, error="Authentication required")
            db = get_db()
            if db is None:
                return reply(status=503, error="Supabase is not configured")
            # Supabase Auth validates both legacy HS256 and current asymmetric tokens.
            response = db.auth.get_user(token)
            user = response.user
            if user is None or not user.id:
                return reply(status=401, error="Invalid authentication session")
            request.user_id = user.id
        except Exception:
            return reply(status=401, error="Invalid or expired session. Please sign in again.")
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

@app.get("/api/health/database")
@limiter.limit("10 per minute")
def database_health():
    """Safely check server-side Supabase connectivity without exposing credentials."""
    if not URL or not KEY or "YOUR_" in URL or "YOUR_" in KEY:
        return reply(status=503, error="Render is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    if URL != EXPECTED_SUPABASE_URL:
        return reply(status=503, error="Render SUPABASE_URL points to the wrong Supabase project. Use the project uvjvkutpdwdvwwafhvon URL.")
    try:
        db = get_db()
        db.table("merchants").select("id").limit(1).execute()
        return reply({"status": "ok", "database": "connected"})
    except Exception:
        app.logger.exception("Database connectivity check failed")
        return reply(status=503, error="Render cannot query Supabase. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and Supabase Data API configuration.")

@app.errorhandler(Exception)
def unexpected_error(exc):
    from werkzeug.exceptions import HTTPException
    if isinstance(exc, HTTPException):
        return reply(status=exc.code or 500, error=exc.description if (exc.code or 500) < 500 else "Backend request failed")
    app.logger.exception("Unhandled error while processing %s %s", request.method, request.path)
    code = getattr(exc, "code", None)
    if code == "PGRST205" or "PGRST205" in str(exc):
        return reply(status=503, error="Supabase REST cannot see the merchants table (PGRST205). Verify Render SUPABASE_URL matches the LocalPay project and check public schema exposure.")
    if isinstance(exc, RuntimeError) and "another Supabase project" in str(exc):
        return reply(status=503, error="Render SUPABASE_URL points to another project. Set it to the LocalPay Supabase project URL.")
    return reply(status=500, error="Backend encountered a server error. Check Render Logs for the exception at this request time.")

@app.get("/api/dashboard/bootstrap")
@requires_merchant
@limiter.limit("90 per minute")
def dashboard_bootstrap():
    """One authenticated request per workspace page instead of six parallel requests.

    Only query the tables needed by the requested view. All money figures are
    calculated from server-side, verified transaction status; never cached.
    """
    view = request.args.get("view", "overview")
    allowed = {"overview", "payments", "qr-code", "transactions", "analytics", "subscription", "settings"}
    if view not in allowed:
        return reply(status=400, error="Unknown workspace view")
    db = get_db()
    merchant = request.merchant
    mid = merchant["id"]
    payload = {"merchant": merchant, "view": view}

    if view in {"overview", "payments", "qr-code"}:
        payload["links"] = (db.table("payment_links").select("*")
                            .eq("merchant_id", mid).order("created_at", desc=True)
                            .limit(500).execute().data)

    if view in {"overview", "transactions"}:
        records = (db.table("transactions")
            .select("id,reference,amount_cents,status,provider,created_at", count="exact")
            .eq("merchant_id", mid).order("created_at",desc=True).limit(100).execute())
        payload["transactions"] = records.data
        payload["transaction_count"] = int(records.count or 0)

    if view in {"overview", "analytics"}:
        entries = (db.table("transactions")
                   .select("amount_cents,status,created_at")
                   .eq("merchant_id",mid).execute().data)
        paid = [item for item in entries if item["status"]=="successful"]
        payload["summary"] = {
            "gross_cents": sum(int(item["amount_cents"]) for item in paid),
            "successful_count": len(paid),
            "pending_count": sum(item["status"]=="pending" for item in entries),
            "mode": "DEMO"
        }
        daily = defaultdict(lambda: {"total_cents":0,"count":0})
        for item in paid:
            day = item["created_at"][:10]
            daily[day]["total_cents"] += int(item["amount_cents"])
            daily[day]["count"] += 1
        payload["analytics"] = {"daily":[{"date":day,**entry}
                                          for day,entry in sorted(daily.items())],"mode":"DEMO"}

    if view == "subscription":
        key = merchant_plan(db,mid)
        start,end = month_window_utc()
        result = (db.table("transactions").select("id",count="exact")
                  .eq("merchant_id",mid).gte("created_at",start)
                  .lt("created_at",end).limit(1).execute())
        used = int(result.count or 0)
        pending = (db.table("plan_upgrade_requests")
                   .select("requested_plan,created_at")
                   .eq("merchant_id",mid).eq("status","pending").limit(1).execute().data)
        payload["plan"] = {
            "plan":key,"name":PLANS[key]["name"],"price_cents":PLANS[key]["price_cents"],
            "monthly_limit":PLANS[key]["monthly_limit"],"used":used,
            "remaining":max(0,PLANS[key]["monthly_limit"]-used),
            "next_reset":end,"upgrade_request":pending[0] if pending else None,
            "billing_enabled":False,"mode":"PAYSTACK_TEST"
        }
    return reply(payload)

@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response

@app.post("/api/merchant/onboard")
@limiter.limit("8 per hour")
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

# Proposed merchant plans. Limits count Paystack checkout attempts per UTC calendar month.
# Plan upgrades are never activated from an unverified browser request.
PLANS = {
    "basic": {"name": "Basic", "price_cents": 4900, "monthly_limit": 200},
    "pro": {"name": "Pro", "price_cents": 9900, "monthly_limit": 1000},
    "pro_plus": {"name": "Pro Plus", "price_cents": 19900, "monthly_limit": 5000}
}

def merchant_plan(db, merchant_id):
    rows = db.table("merchant_plan_entitlements").select("plan").eq("merchant_id", merchant_id).limit(1).execute().data
    plan = rows[0]["plan"] if rows else "basic"
    return plan if plan in PLANS else "basic"

def month_window_utc():
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    end = datetime(now.year + (now.month == 12), now.month % 12 + 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat()

@app.get("/api/merchant/plan")
@requires_merchant
def my_plan():
    db = get_db()
    merchant_id = request.merchant["id"]
    key = merchant_plan(db, merchant_id)
    start, end = month_window_utc()
    # Exact count from server, never a client-supplied balance.
    query = (db.table("transactions").select("id", count="exact")
             .eq("merchant_id", merchant_id).gte("created_at", start).lt("created_at", end))
    result = query.limit(1).execute()
    used = int(result.count or 0)
    pending = (db.table("plan_upgrade_requests").select("requested_plan,created_at")
               .eq("merchant_id", merchant_id).eq("status","pending").limit(1).execute().data)
    return reply({"plan": key, "name": PLANS[key]["name"],
                  "price_cents": PLANS[key]["price_cents"],
                  "monthly_limit": PLANS[key]["monthly_limit"],
                  "used": used, "remaining": max(0, PLANS[key]["monthly_limit"] - used),
                  "renewal_period": "UTC calendar month",
                  "next_reset": end,
                  "upgrade_request": pending[0] if pending else None,
                  "billing_enabled": False, "mode": "PAYSTACK_TEST"})

@app.post("/api/merchant/upgrade-request")
@requires_merchant
@limiter.limit("5 per hour")
def request_plan_upgrade():
    body = request.get_json(silent=True) or {}
    requested = body.get("plan")
    current = merchant_plan(get_db(), request.merchant["id"])
    ranks = {"basic":0,"pro":1,"pro_plus":2}
    if requested not in ("pro","pro_plus") or ranks[requested] <= ranks[current]:
        return reply(status=400, error="Choose a higher plan than your current plan.")
    db = get_db()
    existing = (db.table("plan_upgrade_requests").select("requested_plan")
                .eq("merchant_id", request.merchant["id"]).eq("status","pending").limit(1).execute().data)
    if existing:
        return reply(status=409, error="You already have a pending upgrade request. No payment has been charged.")
    db.table("plan_upgrade_requests").insert({
        "merchant_id": request.merchant["id"], "requested_plan": requested,
        "status": "pending"
    }).execute()
    return reply({"requested_plan": requested, "status": "pending",
                  "message": "Upgrade request received. Your plan remains unchanged until approved and activated. No charge was made."}, 201)

# Tokens are secrets embedded in checkout links. Never accept arbitrary strings
# in the public lookup and never log them.
PAYMENT_TOKEN = re.compile(r"^[A-Za-z0-9_-]{32}$")
PAYER_EMAIL = re.compile(r"^[^\\s@]{1,64}@[^\\s@]{1,185}\\.[A-Za-z]{2,63}$")

def available_link(db, token):
    if not PAYMENT_TOKEN.fullmatch(token):
        return None
    rows = (db.table("payment_links").select("*").eq("token",token)
            .eq("active",True).gt("expires_at",datetime.now(timezone.utc).isoformat())
            .is_("consumed_at","null").limit(1).execute().data)
    return rows[0] if rows else None

@app.post("/api/payment-links")
@limiter.limit("30 per minute")
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
@limiter.limit("30 per minute")
def checkout(token):
    db = get_db()
    if not db:
        return reply(status=503, error="Supabase is not configured")
    link = available_link(db, token)
    if not link:
        return reply(status=410, error="This payment request has expired or was already used. Ask the merchant for a new link.")
    merchants = (db.table("merchants").select("business_name,category,town,province")
                 .eq("id", link["merchant_id"]).limit(1).execute().data)
    if not merchants:
        return reply(status=410, error="This merchant is unavailable. Do not continue with payment.")
    merchant = merchants[0]
    return reply({"business_name": merchant["business_name"],
                  "merchant_category": merchant.get("category"),
                  "merchant_town": merchant.get("town"),
                  "merchant_province": merchant.get("province"),
                  "amount_cents": link["amount_cents"], "currency": "ZAR",
                  "description": link["description"], "expires_at": link["expires_at"],
                  "mode": "PAYSTACK_TEST"})

@app.post("/api/payments/initialize")
@limiter.limit("6 per minute; 30 per hour")
def initialize_payment():
    """Initialize sandbox payment using a server-trusted payment link and Paystack checkout."""
    db = get_db()
    if db is None:
        return reply(status=503, error="Supabase is not configured")
    if os.getenv("PAYMENT_PROVIDER", "paystack") != "paystack":
        return reply(status=503, error="Only Paystack test checkout is available")
    body = request.get_json(silent=True) or {}
    token = str(body.get("token") or "")
    email = str(body.get("email") or "").strip().lower()
    payer_name = str(body.get("payer_name") or "").strip()
    if not PAYER_EMAIL.fullmatch(email) or len(email)>254:
        return reply(status=400, error="Please enter a valid payer email.")
    if len(payer_name)<2 or len(payer_name)>100 or any(ord(c)<32 for c in payer_name):
        return reply(status=400, error="Please enter your name (2–100 characters).")
    link = available_link(db, token)
    if not link:
        return reply(status=410, error="This payment request has expired or was already used. Ask the merchant for a new link.")
    if link["merchant_id"] != os.getenv("PAYSTACK_TEST_MERCHANT_ID", ""):
        return reply(status=403, error="This merchant is not enabled for Paystack sandbox checkout yet")
    secret = os.getenv("PAYSTACK_SECRET_KEY", "")
    if not secret.startswith("sk_test_"):
        return reply(status=503, error="Paystack TEST mode is not configured")
    origin = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not origin.startswith("https://") or "/" in origin.removeprefix("https://"):
        return reply(status=503, error="Configure FRONTEND_URL with your Vercel HTTPS origin")
    reference = "LPM-" + uuid.uuid4().hex
    # Atomically reserve one checkout attempt in Postgres, with a per-merchant lock.
    # A browser cannot change its own plan, and concurrent checkouts cannot evade limits.
    quota = db.rpc("localpay_create_checkout_attempt", {
        "p_merchant_id": link["merchant_id"], "p_payment_link_id": link["id"],
        "p_reference": reference, "p_amount_cents": int(link["amount_cents"])
    }).execute().data
    if not quota or not quota.get("allowed"):
        if (quota or {}).get("reason") == "link_unavailable":
            return reply(status=410, error="This payment request was already used or expired. Ask the merchant for a new link.")
        return reply(status=429, error="This merchant reached their monthly checkout limit. Ask them to upgrade their plan.")
    # Payer-supplied identity is recorded for the merchant only; it is NOT
    # proof of legal identity or account ownership.
    db.table("transactions").update({
        "payer_name": payer_name, "payer_email": email
    }).eq("id", quota["transaction_id"]).eq("status","pending").execute()
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
@limiter.limit("20 per minute")
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
@limiter.limit("30 per minute")
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
    return reply([{"id": key, **value, "currency": "ZAR", "billing_interval": "month",
                   "billing_enabled": False, "proposed": True,
                   "usage_metric": "monthly Paystack checkout attempts"}
                  for key, value in PLANS.items()])

@app.post("/api/webhooks/payments")
@limiter.limit("120 per minute")
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

def require_platform_admin():
    db = get_db()
    if db is None:
        return False
    rows = db.table("platform_admins").select("user_id").eq("user_id", request.user_id).limit(1).execute().data
    return bool(rows)


@app.get("/api/admin/summary")
@requires_user
def admin_summary():
    if not require_platform_admin():
        return reply(status=403, error="Administrator access required")
    db = get_db()
    merchants = db.table("merchants").select("id").execute().data
    paid = db.table("transactions").select("amount_cents,status").eq("status", "successful").execute().data
    return reply({"merchants": len(merchants),
                  "verified_test_transactions": len(paid),
                  "test_payment_volume_cents": sum(int(x["amount_cents"]) for x in paid),
                  "mode": "DEMO", "platform_revenue_cents": 0})


@app.get("/api/admin/merchants")
@requires_user
def admin_merchants():
    if not require_platform_admin():
        return reply(status=403, error="Administrator access required")
    rows = get_db().table("merchants").select("id,business_name,category,province,town,created_at").limit(200).execute().data
    return reply(rows)


@app.get("/api/admin/transactions")
@requires_user
def admin_transactions():
    if not require_platform_admin():
        return reply(status=403, error="Administrator access required")
    rows = get_db().table("transactions").select("reference,merchant_id,amount_cents,status,provider,created_at").order("created_at", desc=True).limit(200).execute().data
    return reply(rows)

if __name__ == "__main__":
    app.run(port=5000, debug=False)

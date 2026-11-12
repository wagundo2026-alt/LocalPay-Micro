# LocalPay Micro — South African micro-business payment MVP

**Current state: functional merchant portal + Paystack TEST integration (not a live merchant payments service).**
Designed specifically for informal traders, small restaurants and takeaways, local food stores, street-food stalls, and spaza shop owners.

## What is built

- Human-friendly landing page, pricing, Supabase login/register, password reset and email confirmation
- Authenticated merchant onboarding and workspace
- Sales overview, real merchant-scoped transaction records, activity table and chart
- Fixed-amount payment links, shareable WhatsApp URLs and scan-to-pay QR codes
- Paystack sandbox **hosted checkout**, signed webhook and server-side transaction verification
- Printable test receipts and CSV transaction report
- Sales analytics, business settings and proposed Basic R49 (200 checkout attempts/month), Pro R99 (1,000) and Pro Plus R199 (5,000) plans (billing disabled)
- Restricted platform admin area with server-verified roles

**No live money, merchant settlement, production subscriptions or marketplace transfers are supported.**
A payment screenshot or redirect never marks a transaction successful.

## Technology

- **Frontend:** Next.js App Router + TypeScript + Tailwind/CSS + Lucide + Recharts + QRCodeSVG on Vercel
- **Backend:** Python 3.12, Flask, Gunicorn, PyJWT and Paystack integration on Render
- **Database/Auth:** Supabase Postgres, Supabase Auth, Row-Level Security (server-only writes)

## Configure Supabase

Project: https://supabase.com/dashboard/project/uvjvkutpdwdvwwafhvon

Run the schema migration once if this is a new project: `supabase/migrations/001_initial.sql`.
This project has already had the schema applied to its connected Supabase database; **don't run the initial migration twice on the same database**.

In Supabase Authentication, enable Email and configure your production Vercel origin (Site URL), including `https://YOUR-VERCEL-DOMAIN/auth/callback` under redirect URLs. Enable email confirmation.

## Vercel frontend

Root Directory: `frontend`. Framework: Next.js.

Configure these environment variables, then redeploy:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://uvjvkutpdwdvwwafhvon.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase public publishable key or legacy anon key>
NEXT_PUBLIC_API_URL=https://localpay-micro1.onrender.com
```

The key above is a **public** key. Never put service-role or Paystack secret keys in the frontend.

## Render Flask backend

Service Type: **Web Service**, Root Directory: `backend`, Python 3.12.

Build Command: `pip install -r requirements.txt`

Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`

```dotenv
SUPABASE_URL=https://uvjvkutpdwdvwwafhvon.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service-role/secret key>
FRONTEND_ORIGINS=https://YOUR-PRODUCTION-VERCEL-DOMAIN.vercel.app
FRONTEND_URL=https://YOUR-PRODUCTION-VERCEL-DOMAIN.vercel.app
PAYMENT_PROVIDER=paystack
PAYSTACK_SECRET_KEY=sk_test_<your Paystack TEST secret>
PAYSTACK_WEBHOOK_SECRET=whsec_<your Paystack webhook signing secret>
PAYSTACK_TEST_MERCHANT_ID=<UUID of one approved-for-demo merchant>
ENABLE_DEMO_PAYMENTS=false
```

**Paystack TEST mode only:** `sk_live_` keys are rejected by the backend.

### Configure the demo merchant

1. Sign up, confirm your email and log into LocalPay on Vercel.
2. Complete the merchant onboarding page.
3. Open **Dashboard → Business settings** and copy the read-only **Merchant ID** UUID.
4. Put that UUID in Render `PAYSTACK_TEST_MERCHANT_ID` and save / redeploy.
5. Your Paystack TEST key can now initialize test checkout **for that one merchant only**.

This gate prevents pretending a single Paystack account can freely process and settle money for unrelated merchants. Real multi-merchant payments require provider agreement and a reviewed onboarding/settlement model.

### Paystack webhook

Configure the **TEST** webhook destination in your Paystack Dashboard:

```text
https://localpay-micro1.onrender.com/api/webhooks/payments
```

The webhook verifies the newer timestamped `Paystack-Signature` using your `whsec_` secret, or validates legacy `x-paystack-signature` when the newer header is absent. It then calls Paystack's verify API and checks the transaction reference, amount, currency, test domain, and configured merchant **before** crediting the transaction.

Relevant official docs:
- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/verify-payments/

## Routes

| Area | Route |
|---|---|
| Home | `/` |
| Pricing | `/pricing` |
| Registration | `/register` |
| Login | `/login` |
| Forgot password | `/forgot-password` |
| Merchant onboarding | `/onboarding` |
| Merchant overview | `/dashboard` |
| Payment links | `/dashboard/payments` |
| QR codes | `/dashboard/qr-code` |
| Transactions | `/dashboard/transactions` |
| Analytics | `/dashboard/analytics` |
| Subscription plans | `/dashboard/subscription` |
| Settings | `/dashboard/settings` |
| Customer checkout | `/pay/[id]` |
| Payment verification result | `/payment/success?reference=...` |
| Receipt | `/receipt/[reference]` |
| Platform admin | `/admin` |

## Smoke test

1. Open `https://localpay-micro1.onrender.com/api/health`: expected `data.status = "ok"`.
2. Register and sign in on the Vercel website.
3. Complete merchant onboarding; confirm its business details in the dashboard.
4. Configure `PAYSTACK_TEST_MERCHANT_ID` as above.
5. Create an R20 payment request on the **Payment links** page.
6. Copy the link (or show the QR code) and open the customer checkout page.
7. Enter your test email, continue to Paystack hosted checkout, and use **Paystack test payment details**.
8. After the sandbox checkout returns, LocalPay checks Paystack's verification API.
9. Confirm the test payment appears in **Transactions**, **Overview**, and the printable receipt.

If verification is unavailable, the payment remains **pending**, not successful.

## Safety and production launch limits

- Real merchant funds do **not** pass through LocalPay.
- This is a **sandbox only** integration, not an acquiring or settlement product.
- A live platform requires PSP-approved independent merchant onboarding, FICA/KYC, POPIA controls, fraud monitoring, refunds/dispute operations, monitoring, rate limits, stronger audit/reconciliation, and authorization/legal review as applicable.
- Subscriptions are illustrative UI only. Do not market them as purchased or billed.
- The current test-mode single-instance implementation and webhook retries need additional hardening and testing before live use.

## Development

```bash
# frontend
cd frontend
npm install
npm run dev

# backend (second terminal)
cd backend
pip install -r requirements.txt
python -m pytest -q tests
gunicorn app:app --bind 0.0.0.0:5000
```

Set local environment variables in non-committed `.env.local` and `.env` files based on the provided examples.


## Monthly checkout limits and upgrade requests

- Basic: **R49/month**, **200 initiated Paystack checkout sessions per UTC calendar month**.
- Pro: **R99/month**, **1,000 checkout sessions**.
- Pro Plus: **R199/month**, **5,000 checkout sessions**.
- These count checkout attempts (including abandoned, failed and provider-error attempts); QR/link creation is unlimited. Limits reset at **00:00 UTC on the 1st of each month**.
- Postgres function `localpay_create_checkout_attempt` locks the merchant and atomically reserves a transaction, preventing concurrent overrun. It is callable only by `service_role`, through the authenticated Flask backend.
- All new and existing merchants have Basic sandbox limits unless an authorised back-office action explicitly activates another tier in `merchant_plan_entitlements`.
- The **My plan** dashboard shows actual server-side usage and submits a non-billing upgrade request. An upgrade request **does not change the plan or take money**. Activation/paid billing requires a verified subscription billing integration and operational approval.
- Apply Supabase migration `localpay_tiered_monthly_checkout_quotas` before deploying the backend. The migration has already been applied to the linked LocalPay Supabase project.
- Paystack card processing fees for merchant sales are separate from the software subscription.

# LocalPay Micro — hackathon MVP

**Status: demo-only starter implementation, not production-ready payment infrastructure.** No real money can be accepted. The simulated payment endpoint must be disabled before any live deployment.

## Architecture
- `frontend/`: Next.js App Router, TypeScript, Tailwind, Supabase Auth, QR links. Deploy to Vercel.
- `backend/`: Flask REST API with verified Supabase JWTs (asymmetric JWKS), merchant scoping, mock payment lifecycle. Deploy to Render.
- `supabase/migrations/`: PostgreSQL schema, RLS read policies, no direct client writes.

## Setup
1. Create a Supabase project and execute `supabase/migrations/001_initial.sql` in its SQL editor.
2. Copy `frontend/.env.example` to `frontend/.env.local` and set Supabase URL, **public** anon key and API URL.
3. Copy `backend/.env.example` to `backend/.env` and set Supabase URL, **server-only** service-role key, allowed frontend origins and `ENABLE_DEMO_PAYMENTS=true` for a private hackathon demo only. Never commit `.env`.
4. Run backend: `cd backend && pip install -r requirements.txt && flask --app app run --port 5000`.
5. Run frontend: `cd frontend && npm install && npm run dev`.
6. In Supabase Auth settings, configure Site URL and redirect URLs for localhost and your Vercel domain.
7. Register, verify email, log in, onboard merchant, create R20 payment link, scan QR, simulate demo checkout, inspect transaction dashboard.

## Deployment
- Render: Python web service, root directory `backend`, build command `pip install -r requirements.txt`, start command `gunicorn app:app --bind 0.0.0.0:$PORT`. Set backend environment variables in Render.
- Vercel: root directory `frontend`, Next.js framework, set `NEXT_PUBLIC_*` environment variables. Update `FRONTEND_ORIGINS` to exact Vercel HTTPS domain.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in Vercel or a `NEXT_PUBLIC_` variable.

## Critical limitations and next steps
- This starter uses **demo-only** payments. The `/api/payments/demo-complete` route is intentionally callable by anyone with a demo reference when enabled; **disable it** outside an isolated demo.
- Before processing real money, integrate an approved PSP, hosted checkout, signed webhooks, independent verification, idempotency and reconciliation.
- Add production-grade rate limits, atomic state transitions, audit logging, settlement records, stronger RLS, SSR authentication, testing and observability.
- Before live use: POPIA review, PSP contracts, KYC/FICA and regulatory/security assessment.

## Plans
Free R0, Growth R49/month, Business R99/month; **illustrative pricing, no billing connected**. Provider processing fees are separate.

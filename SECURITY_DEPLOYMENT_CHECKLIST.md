# LocalPay Micro — Security Deployment Checklist (2026-11-12)

## Completed in GitHub
- Browser API proxy now allowlists intended routes; webhook and demo-mutation endpoints are not exposed through Vercel proxy.
- Explicit Render CORS origins, defensive response headers, 128 KiB request limit, reduced checkout rate limits and disabled Flask debug console.
- Next.js anti-framing, nosniff, basic CSP, privacy headers and hidden framework header.
- Authenticated server merchant checks, Paystack test-mode server verification and signed webhook validation remain in place.
- Revoke public execution of the Supabase RLS event-trigger helper, confirmed by direct SQL and Supabase advisor.
- RLS enabled on all public tables; sensitive entitlement and upgrade tables are server-only.

## Mandatory configuration before production
1. Deploy latest GitHub code to Render and Vercel and verify both are running; Vercel currently reports a build-rate limit.
2. Configure Render FRONTEND_ORIGINS as comma-separated exact production HTTPS origins (no wildcard preview domains).
3. Set Render FRONTEND_URL to the public production HTTPS origin without a path. Keep Supabase service-role secret on Render ONLY, never in NEXT_PUBLIC_*.
4. Keep Paystack sk_test_ keys in sandbox and ENABLE_DEMO_PAYMENTS=false; rotate secrets accidentally exposed anywhere.
5. Enable Supabase Auth leaked-password protection in dashboard, review MFA and password strength. Advisor currently warns it is disabled.
6. For scaled or multi-worker production, set RATELIMIT_STORAGE_URI to private authenticated Redis. In-memory rate limits do not share state between workers.
7. Require MFA for repository/cloud owners, enable dependency/secret scanning, restrict project permissions and rotate exposed credentials.
8. Before live payments: validate provider/PSP approval, settlement model, POPIA controls, independent security assessment and merchant agreements.

## Post-deployment acceptance tests
- Unauthenticated merchant/admin endpoints return 401; signed-in non-admin admin requests return 403.
- Cross-merchant data cannot be read or changed through IDs or request bodies.
- Vercel proxy rejects /api/backend/api/webhooks/payments and /api/backend/api/payments/demo-complete with 404.
- Render rejects oversized JSON with 413 and rate-limit violations with 429.
- Invalid signed webhook returns 401; mismatched amount/currency/reference/test-domain never marks payment successful.
- Legitimate sandbox hosted checkout and return URL still work on public production Vercel domain.
- Defensive browser headers are present; privileged RLS event-trigger function remains not callable by anon/authenticated.

These changes improve the test MVP but are not a certification or guarantee of production-grade financial security.
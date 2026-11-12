# LocalPay Micro — Payouts foundation (Paystack TEST)

**Status: test-only merchant payout dashboard, no real bank transfers.**

## Built
- Merchant navigation includes **Payouts** at `/dashboard/payouts`.
- Authenticated `GET /api/merchant/payouts` returns test sales totals, real withdrawable balance (0), provider verification/connection flags, and merchant-scoped payout history.
- Test checkout success is **not a payout**. Test revenue is separate and non-withdrawable.
- The withdraw action is deliberately disabled. Merchant bank details are NOT collected in LocalPay.
- The `public.merchant_payouts` table is RLS-protected, lacks direct browser privileges, and is empty until a future approved provider reconciliation mechanism is implemented.
- Server filters payout rows by the authenticated merchant ID; public users cannot read this endpoint.
- Payout screens include English and draft Tshivenda strings.

## Database applied to connected Supabase project (2026-11-12)
```sql
create table if not exists public.merchant_payouts (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id),
 provider text not null default 'paystack',
 provider_payout_id text unique,
 amount_cents bigint not null check(amount_cents > 0),
 currency text not null default 'ZAR' check(currency = 'ZAR'),
 status text not null check(status in ('pending','processing','paid','failed','reversed')),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 provider_updated_at timestamptz,
 constraint payout_settled_consistency check (status <> 'paid' or settled_at is not null)
);
create index if not exists merchant_payouts_owner_created_idx
 on public.merchant_payouts (merchant_id,created_at desc);
alter table public.merchant_payouts enable row level security;
revoke all on public.merchant_payouts from anon, authenticated;
grant select,insert,update on public.merchant_payouts to service_role;
comment on table public.merchant_payouts is
 'Future provider-confirmed merchant settlements. Do not populate from checkout success, client payloads or test transactions.';
```

## Before LIVE payouts
1. Obtain explicit permission and an approved multi-merchant model from Paystack or another licensed payment provider. The current single test Paystack account cannot settle to unrelated merchants.
2. Implement provider-hosted verified merchant identity and bank account onboarding; do not store raw banking credentials or accept client-asserted account ownership.
3. Require strong authentication and step-up verification to initiate or change settlement instructions, including audit logs and cooling-off/review for sensitive updates.
4. Add a backend-only payout reconciliation ingestion system that authenticates provider messages and retrieves records from provider APIs; enforce idempotency, unique references and allowed status transitions.
5. Derive payout balance from the provider's real settlement ledger (including fees, refunds, chargebacks, reserve, hold periods and reversals), not from LocalPay checkout amount totals.
6. Add failed-payout and dispute workflows, alerts, operational monitoring, approvals and immutable audit logs.
7. Perform security, regulatory and POPIA review, including retention rules, operator/merchant contracts and financial compliance requirements.
8. Only after approvals, live onboarding, reconciliation, dispute support and independent validation, enable production settlements.

This feature is an honest **foundation for future payouts**, not a live cash-out or transfer integration.

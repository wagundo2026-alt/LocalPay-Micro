-- Align LocalPay sandbox entitlements with an accessible R0 Starter tier.
-- This SQL migration is an audit copy of changes applied to the connected Supabase project on 12 November 2026.
-- Execute only once per new environment after the existing tiered quota function has been installed.
-- Verify the database function matches the expected signature before applying.
begin;
alter table public.merchant_plan_entitlements drop constraint if exists merchant_plan_entitlements_plan_check;
alter table public.merchant_plan_entitlements
 add constraint merchant_plan_entitlements_plan_check
 check (plan in ('starter','basic','pro','pro_plus'));
-- The existing function must retain its atomic merchant/link locks, reference validation,
-- checkout attempt insertion and single-use link logic.
-- Its two settings are modified in the live database:
-- v_plan := coalesce(v_plan,'starter');
-- v_limit := case v_plan when 'pro_plus' then 5000 when 'pro' then 1000 when 'basic' then 500 else 200 end;
commit;

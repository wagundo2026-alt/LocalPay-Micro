-- Basic/Pro/Pro Plus checkout quotas; applied to LocalPay Supabase on 2026-11-12.
-- Quota tracks initiated checkout sessions, not QR or payment-link creation.
create table if not exists public.merchant_plan_entitlements (
 merchant_id uuid primary key references public.merchants(id) on delete cascade,
 plan text not null default 'basic' check (plan in ('basic','pro','pro_plus')),
 updated_at timestamptz not null default now(),
 activation_note text
);
alter table public.merchant_plan_entitlements enable row level security;
revoke all on public.merchant_plan_entitlements from anon,authenticated;
grant select,insert,update on public.merchant_plan_entitlements to service_role;

create table if not exists public.plan_upgrade_requests (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete cascade,
 requested_plan text not null check (requested_plan in ('pro','pro_plus')),
 status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
 created_at timestamptz not null default now(),
 decided_at timestamptz
);
create unique index if not exists plan_upgrade_one_pending_per_merchant
 on public.plan_upgrade_requests(merchant_id) where status='pending';
create index if not exists plan_upgrade_request_merchant_date
 on public.plan_upgrade_requests(merchant_id,created_at desc);
alter table public.plan_upgrade_requests enable row level security;
revoke all on public.plan_upgrade_requests from anon,authenticated;
grant select,insert,update on public.plan_upgrade_requests to service_role;

create or replace function public.localpay_create_checkout_attempt(
 p_merchant_id uuid,p_payment_link_id uuid,p_reference text,p_amount_cents bigint
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_plan text;
 v_limit integer;
 v_used bigint;
 v_transaction_id uuid;
 v_start timestamptz;
 v_end timestamptz;
begin
 perform 1 from public.merchants where id=p_merchant_id for update;
 if not found then raise exception 'MERCHANT_NOT_FOUND'; end if;
 select plan into v_plan from public.merchant_plan_entitlements where merchant_id=p_merchant_id;
 v_plan := coalesce(v_plan,'basic');
 v_limit := case v_plan when 'pro_plus' then 5000 when 'pro' then 1000 else 200 end;
 v_start := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_end := v_start + interval '1 month';
 select count(*) into v_used from public.transactions
 where merchant_id=p_merchant_id and created_at>=v_start and created_at<v_end;
 if v_used >= v_limit then
  return jsonb_build_object('allowed',false,'used',v_used,'limit',v_limit,'plan',v_plan);
 end if;
 insert into public.transactions(merchant_id,payment_link_id,reference,amount_cents,status,provider)
 values (p_merchant_id,p_payment_link_id,p_reference,p_amount_cents,'pending','paystack')
 returning id into v_transaction_id;
 return jsonb_build_object('allowed',true,'used',v_used+1,'limit',v_limit,'plan',v_plan,'transaction_id',v_transaction_id);
end;
$$;
revoke all on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint) to service_role;
notify pgrst,'reload schema';

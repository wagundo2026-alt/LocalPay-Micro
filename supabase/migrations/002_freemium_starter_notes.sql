-- LocalPay freemium Starter entitlement migration.
-- Already applied to linked Supabase project on 12 November 2026.
-- For a fresh environment, run after initial merchant/transaction/tier migrations.
begin;
alter table public.merchant_plan_entitlements drop constraint if exists merchant_plan_entitlements_plan_check;
alter table public.merchant_plan_entitlements
  add constraint merchant_plan_entitlements_plan_check
  check (plan in ('starter','basic','pro','pro_plus'));

CREATE OR REPLACE FUNCTION public.localpay_create_checkout_attempt(p_merchant_id uuid, p_payment_link_id uuid, p_reference text, p_amount_cents bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_plan text;
 v_limit integer;
 v_used bigint;
 v_transaction_id uuid;
 v_start timestamptz;
 v_end timestamptz;
 v_link public.payment_links%rowtype;
begin
 -- Serialized per merchant for subscription limits, and per link for single-use.
 perform 1 from public.merchants where id=p_merchant_id for update;
 if not found then raise exception 'MERCHANT_NOT_FOUND'; end if;
 select * into v_link from public.payment_links
  where id=p_payment_link_id and merchant_id=p_merchant_id for update;
 if not found or not v_link.active or v_link.expires_at <= now()
    or v_link.consumed_at is not null
    or v_link.amount_cents != p_amount_cents
    or exists (select 1 from public.transactions where payment_link_id=p_payment_link_id)
 then
   return jsonb_build_object('allowed',false,'reason','link_unavailable');
 end if;
 select plan into v_plan from public.merchant_plan_entitlements
  where merchant_id=p_merchant_id;
 v_plan := coalesce(v_plan,'starter');
 v_limit := case v_plan when 'pro_plus' then 5000 when 'pro' then 1000 when 'basic' then 500 else 200 end;
 v_start := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
 v_end := v_start + interval '1 month';
 select count(*) into v_used from public.transactions
  where merchant_id=p_merchant_id and created_at>=v_start and created_at<v_end;
 if v_used >= v_limit then
   return jsonb_build_object('allowed',false,'reason','limit_reached','used',v_used,'limit',v_limit,'plan',v_plan);
 end if;
 insert into public.transactions
  (merchant_id,payment_link_id,reference,amount_cents,status,provider)
 values (p_merchant_id,p_payment_link_id,p_reference,p_amount_cents,'pending','paystack')
 returning id into v_transaction_id;
 update public.payment_links set active=false,consumed_at=now()
  where id=p_payment_link_id;
 return jsonb_build_object('allowed',true,'used',v_used+1,'limit',v_limit,
    'plan',v_plan,'transaction_id',v_transaction_id);
end;
$function$
;

-- RPC must remain server-only; enforce privileges explicitly.
revoke execute on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint)
  to service_role;
commit;

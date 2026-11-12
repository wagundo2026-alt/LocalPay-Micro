-- Security hardening applied to linked Supabase project on 2026-11-12.
-- New and existing payment requests expire 24h after creation. A checkout
-- attempt consumes the link exactly once under database locks.
-- Payer fields are self-reported, merchant-only and never returned in public receipts.
alter table public.payment_links add column if not exists expires_at timestamptz;
alter table public.payment_links add column if not exists consumed_at timestamptz;
update public.payment_links set expires_at=created_at+interval '24 hours' where expires_at is null;
alter table public.payment_links alter column expires_at set default (now()+interval '24 hours');
alter table public.payment_links alter column expires_at set not null;
alter table public.transactions add column if not exists payer_name text;
alter table public.transactions add column if not exists payer_email text;
alter table public.transactions add constraint transactions_payer_name_length
 check (payer_name is null or char_length(payer_name) <= 100);
create index if not exists payment_links_active_expiry_idx on public.payment_links(expires_at) where active=true;

create or replace function public.localpay_create_checkout_attempt(
 p_merchant_id uuid,p_payment_link_id uuid,p_reference text,p_amount_cents bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_plan text;
 v_limit integer;
 v_used bigint;
 v_transaction_id uuid;
 v_start timestamptz;
 v_end timestamptz;
 v_link public.payment_links%rowtype;
begin
 perform 1 from public.merchants where id=p_merchant_id for update;
 if not found then raise exception 'MERCHANT_NOT_FOUND'; end if;
 select * into v_link from public.payment_links
 where id=p_payment_link_id and merchant_id=p_merchant_id for update;
 if not found or not v_link.active or v_link.expires_at<=now()
 or v_link.consumed_at is not null
 or v_link.amount_cents != p_amount_cents
 or exists(select 1 from public.transactions where payment_link_id=p_payment_link_id) then
  return jsonb_build_object('allowed',false,'reason','link_unavailable');
 end if;
 select plan into v_plan from public.merchant_plan_entitlements where merchant_id=p_merchant_id;
 v_plan:=coalesce(v_plan,'basic');
 v_limit:=case v_plan when 'pro_plus' then 5000 when 'pro' then 1000 else 200 end;
 v_start:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 v_end:=v_start+interval '1 month';
 select count(*) into v_used from public.transactions
  where merchant_id=p_merchant_id and created_at>=v_start and created_at<v_end;
 if v_used>=v_limit then
  return jsonb_build_object('allowed',false,'reason','limit_reached','used',v_used,'limit',v_limit,'plan',v_plan);
 end if;
 insert into public.transactions(merchant_id,payment_link_id,reference,amount_cents,status,provider)
 values(p_merchant_id,p_payment_link_id,p_reference,p_amount_cents,'pending','paystack')
 returning id into v_transaction_id;
 update public.payment_links set active=false,consumed_at=now() where id=p_payment_link_id;
 return jsonb_build_object('allowed',true,'used',v_used+1,'limit',v_limit,
 'plan',v_plan,'transaction_id',v_transaction_id);
end;
$$;
revoke all on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.localpay_create_checkout_attempt(uuid,uuid,text,bigint) to service_role;
notify pgrst,'reload schema';

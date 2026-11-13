-- LocalPay Micro business-management tables (also applied to project uvjvkutpdwdvwwafhvon).
-- Authenticated browsers have no direct access; the verified Flask service
-- authenticates the user and enforces the merchant and plan checks.
create table if not exists public.merchant_expenses (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete cascade,
 label text not null check (char_length(label) between 2 and 120),
 amount_cents integer not null check (amount_cents between 1 and 100000000),
 expense_date date not null default current_date,
 created_at timestamptz not null default now()
);
create index if not exists merchant_expenses_owner_date on public.merchant_expenses (merchant_id, expense_date desc);
alter table public.merchant_expenses enable row level security;
revoke all on public.merchant_expenses from anon, authenticated;
grant select, insert, update, delete on public.merchant_expenses to service_role;

create table if not exists public.merchant_inventory (
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.merchants(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 120),
 quantity integer not null default 0 check (quantity between 0 and 1000000),
 low_stock_threshold integer not null default 5 check (low_stock_threshold between 0 and 1000000),
 created_at timestamptz not null default now(),
 unique (merchant_id, name)
);
create index if not exists merchant_inventory_owner on public.merchant_inventory (merchant_id);
alter table public.merchant_inventory enable row level security;
revoke all on public.merchant_inventory from anon, authenticated;
grant select, insert, update, delete on public.merchant_inventory to service_role;

-- Wielo Credits — the platform metering layer. A per-host wallet keyed by
-- purpose ('quote' now; 'ai' etc. later) + an append-only ledger of every credit
-- movement (grant / purchase / debit / refund / adjustment). Credit packages are
-- sold as a new Products category (product_type = 'wielo_credits') that grants
-- `credit_quantity` of `credit_purpose` to the buyer's wallet on payment.
-- Entitlements stay boolean via check_feature_permission; credits only meter the
-- countable. See docs/features/LOOKING_FOR_LIMITS_CREDITS_NOTIFICATIONS_PLAN.md §4.

-- 1. Products: allow the new category + carry credit qty + purpose.
alter table public.products drop constraint if exists products_product_type_chk;
alter table public.products
  add constraint products_product_type_chk
  check (
    product_type = any (
      array['membership', 'service', 'product', 'wielo_credits']
    )
  );
alter table public.products add column if not exists credit_quantity integer;
alter table public.products add column if not exists credit_purpose text;

comment on column public.products.credit_quantity is
  'For product_type=wielo_credits: how many credits this package grants.';
comment on column public.products.credit_purpose is
  'For product_type=wielo_credits: which credit wallet purpose it tops up (quote, ai, ...).';

-- 2. Wallet — one balance per (host, purpose). Never negative.
create table if not exists public.wielo_credit_wallet (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  purpose text not null default 'quote',
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (host_id, purpose)
);

-- 3. Ledger — append-only history of every credit movement.
create table if not exists public.wielo_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete cascade,
  purpose text not null default 'quote',
  delta integer not null, -- +grant/+purchase/+refund, -debit
  balance_after integer not null,
  kind text not null check (
    kind in ('grant', 'purchase', 'debit', 'refund', 'adjustment')
  ),
  reason text,
  ref_type text, -- 'product_order' | 'quote' | 'subscription' | ...
  ref_id text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_wielo_credit_ledger_host
  on public.wielo_credit_ledger (host_id, purpose, created_at desc);
create index if not exists idx_wielo_credit_ledger_ref
  on public.wielo_credit_ledger (ref_type, ref_id);

-- updated_at bump on the wallet.
create or replace function public.touch_wielo_credit_wallet()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_wielo_credit_wallet on public.wielo_credit_wallet;
create trigger trg_touch_wielo_credit_wallet
before update on public.wielo_credit_wallet
for each row execute function public.touch_wielo_credit_wallet();

-- RLS: a host reads ONLY its own wallet + ledger. All writes go through the
-- service role (the credit engine) — no client write policies, so the ledger is
-- effectively append-only from the app's perspective.
alter table public.wielo_credit_wallet enable row level security;
alter table public.wielo_credit_ledger enable row level security;

drop policy if exists "host reads own credit wallet" on public.wielo_credit_wallet;
create policy "host reads own credit wallet" on public.wielo_credit_wallet
  for select using (
    host_id in (select id from public.hosts where user_id = auth.uid())
  );

drop policy if exists "host reads own credit ledger" on public.wielo_credit_ledger;
create policy "host reads own credit ledger" on public.wielo_credit_ledger
  for select using (
    host_id in (select id from public.hosts where user_id = auth.uid())
  );

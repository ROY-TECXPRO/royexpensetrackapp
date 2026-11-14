-- Expense Planner: initial schema
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- profiles table stores user display name and other profile data
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (id)
);

-- ---------- categories ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text,
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- category rules ----------
create table public.category_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  match_field  text not null default 'counterparty',
  match_value  text not null,
  category_id  uuid not null references public.categories(id) on delete cascade,
  updated_at   timestamptz not null default now(),
  unique (user_id, match_field, match_value)
);

-- ---------- transactions ----------
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  dedupe_key     text not null,                       -- M-Pesa code, or hash for bank SMS
  source         text not null check (source in ('mpesa','coop')),
  type           text not null check (type in
                   ('sent','received','paid','withdraw','deposit','airtime','transfer','fee','unknown')),
  direction      text not null check (direction in ('in','out')),
  amount         bigint not null,                     -- cents
  fee            bigint not null default 0,           -- cents
  counterparty   text,
  category_id    uuid references public.categories(id) on delete set null,
  balance_after  bigint,                              -- cents
  related_ref    text,                                -- e.g. M-Pesa ref quoted inside a bank SMS
  transfer_group text,                                -- same value on both sides of an internal transfer
  occurred_at    timestamptz not null,
  raw_text       text not null,
  device_id      text not null,
  updated_at     timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index idx_tx_user_time    on public.transactions (user_id, occurred_at desc);
create index idx_tx_user_updated on public.transactions (user_id, updated_at);
create index idx_tx_user_group   on public.transactions (user_id, transfer_group) where transfer_group is not null;
create index idx_cat_user_updated  on public.categories (user_id, updated_at);
create index idx_rules_user_updated on public.category_rules (user_id, updated_at);

-- ---------- updated_at trigger (server clock drives pull sync) ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_tx_updated   before insert or update on public.transactions
  for each row execute function public.set_updated_at();
create trigger trg_cat_updated  before insert or update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_rules_updated before insert or update on public.category_rules
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.transactions   enable row level security;
alter table public.categories     enable row level security;
alter table public.category_rules enable row level security;

create policy "own rows" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

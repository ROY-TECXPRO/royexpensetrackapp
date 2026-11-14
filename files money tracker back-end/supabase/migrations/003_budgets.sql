-- Expense Planner: migration 003 - profiles + budgets tables
-- Running: supabase db push or manually via SQL editor

-- ---------- profiles ----------
-- Public profile data linked to Supabase auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated before insert or update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- budgets ---------- 
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  amount_cents bigint not null,
  period       text not null default 'month',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, category_id, period)
);

alter table public.budgets enable row level security;

create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_budgets_updated before insert or update on public.budgets
  for each row execute function public.set_updated_at();

-- Grant access
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
-- Expense Planner: migration 002 - server-side reporting functions
-- Running: supabase db push or manually via SQL editor

-- ============================================================
-- spending_by_period: spending totals per time bucket
-- Excludes rows with transfer_group IS NOT NULL from money_out/money_in
-- Adds internal transfer totals as separate columns
-- ============================================================

create or replace function public.spending_by_period(
  period text,
  from_ts timestamptz,
  to_ts timestamptz
) returns table(
  bucket_start timestamptz,
  money_out bigint,        -- cents, excluding transfer_group
  money_in bigint,         -- cents, excluding transfer_group
  tx_count bigint,         -- transaction count, excluding transfer_group
  transfer_out bigint,     -- cents in internal transfers (outgoing)
  transfer_in bigint       -- cents in internal transfers (incoming)
)
security invoker
language plpgsql
strict volatile
as $$
begin
    return query
    select
        case $1
            when 'day' then date_trunc('day', occurred_at)
            when 'week' then date_trunc('week', occurred_at)
            when 'month' then date_trunc('month', occurred_at)
            when 'year' then date_trunc('year', occurred_at)
            else date_trunc('day', occurred_at) -- fallback
        end as bucket_start,
        -- money_out: amounts going out, excluding transfer_group rows
        sum(case when transfer_group is null and direction = 'out' then amount else 0 end) as money_out,
        -- money_in: amounts coming in, excluding transfer_group rows
        sum(case when transfer_group is null and direction = 'in' then amount else 0 end) as money_in,
        -- tx_count: count of transactions excluding transfer_group rows
        count(case when transfer_group is null then 1 end) as tx_count,
        -- internal transfer totals
        sum(case when transfer_group is not null and direction = 'out' then amount else 0 end) as transfer_out,
        sum(case when transfer_group is not null and direction = 'in' then amount else 0 end) as transfer_in
    from public.transactions
    where occurred_at >= from_ts and occurred_at <= to_ts
    group by case $1
                when 'day' then date_trunc('day', occurred_at)
                when 'week' then date_trunc('week', occurred_at)
                when 'month' then date_trunc('month', occurred_at)
                when 'year' then date_trunc('year', occurred_at)
              end
    order by bucket_start;
end
$$;

-- Grant public access (RLS will still filter by user_id)
grant execute on public.spending_by_period to public;

-- Comment for documentation
comment on function public.spending_by_period(text, timestamptz, timestamptz) is 
  'Spending totals per period (day/week/month/year), excluding internal transfers from money_out/money_in. Returns bucket_start, money_out, money_in, tx_count, transfer_out, transfer_in in cents.';
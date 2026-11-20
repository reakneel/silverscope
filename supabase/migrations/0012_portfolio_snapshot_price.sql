-- Preserve the broker-reported price alongside the imported position value.
-- This is a point-in-time statement field, not a live market quote.
alter table public.portfolio_position_snapshots
  add column if not exists imported_market_price numeric(28,10);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolio_position_snapshots_imported_market_price_nonnegative'
      and conrelid = 'public.portfolio_position_snapshots'::regclass
  ) then
    alter table public.portfolio_position_snapshots
      add constraint portfolio_position_snapshots_imported_market_price_nonnegative
      check (imported_market_price is null or imported_market_price >= 0);
  end if;
end $$;

comment on column public.portfolio_position_snapshots.imported_market_price is
  'Price reported by the originating broker statement at as_of; distinct from independently sourced portfolio_quotes.';

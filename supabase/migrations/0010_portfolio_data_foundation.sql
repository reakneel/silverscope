-- Portfolio data foundation for SilverScope.
-- Brokerage ledger facts and Xueqiu social portfolios are deliberately separate.
-- All writes are server-side (service_role); authenticated clients receive owner-scoped reads only.
-- Do not apply until docs/MIGRATION_RECONCILIATION.md has been completed against the target project.

create table if not exists public.portfolio_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('huatai','tonghuashun','other_broker','xueqiu')),
  account_kind text not null check (account_kind in ('brokerage','social_portfolio')),
  display_name text not null,
  account_ref_masked text,
  base_currency text not null default 'CNY' check (base_currency ~ '^[A-Z]{3}$'),
  markets text[] not null default array['CN']::text[],
  status text not null default 'pending' check (status in ('pending','active','disconnected','needs_reconciliation','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (
    (account_kind = 'brokerage' and provider in ('huatai','tonghuashun','other_broker'))
    or (account_kind = 'social_portfolio' and provider = 'xueqiu')
  )
);
create index if not exists portfolio_accounts_owner_idx
  on public.portfolio_accounts (owner_id, created_at desc);

create table if not exists public.portfolio_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('huatai','tonghuashun','other_broker','xueqiu')),
  import_kind text not null check (import_kind in ('holdings_snapshot','executions','cash_ledger','statement','social_rebalances')),
  original_file_name text not null,
  private_storage_key text not null,
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  parser_id text not null,
  parser_version text not null,
  period_start date,
  period_end date,
  status text not null default 'uploaded' check (status in ('uploaded','validated','committed','partial','rejected','failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  validation_report jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  unique (id, owner_id),
  unique (account_id, file_sha256)
);
create index if not exists portfolio_import_batches_owner_idx
  on public.portfolio_import_batches (owner_id, imported_at desc);

-- Immutable source evidence. Keep the original file in a private Storage bucket;
-- store only normalized row payloads and fingerprints here.
create table if not exists public.portfolio_raw_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 0),
  source_record_key text,
  row_fingerprint text not null check (row_fingerprint ~ '^[a-f0-9]{64}$'),
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, owner_id) references public.portfolio_import_batches(id, owner_id) on delete restrict,
  unique (batch_id, source_row_number),
  unique (batch_id, row_fingerprint)
);
create index if not exists portfolio_raw_records_owner_idx
  on public.portfolio_raw_records (owner_id, created_at desc);

create table if not exists public.portfolio_instruments (
  id uuid primary key default gen_random_uuid(),
  canonical_symbol text not null,
  exchange text not null,
  asset_class text not null check (asset_class in ('equity','etf','fund','bond','convertible_bond','option','future','cash','other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (canonical_symbol, exchange, asset_class)
);

-- Executions and cash-affecting events are append-only source facts.
create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid,
  raw_record_id uuid,
  instrument_id uuid references public.portfolio_instruments(id) on delete restrict,
  source_transaction_id text,
  event_type text not null check (event_type in ('buy','sell','dividend','fee','tax','deposit','withdrawal','transfer_in','transfer_out','split','bonus_share','rights_issue','other')),
  trade_at timestamptz,
  settled_at timestamptz,
  quantity numeric(28,10),
  unit_price numeric(28,10),
  gross_amount numeric(28,10),
  fees numeric(28,10) not null default 0,
  taxes numeric(28,10) not null default 0,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes text,
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  foreign key (batch_id, owner_id) references public.portfolio_import_batches(id, owner_id) on delete restrict,
  foreign key (raw_record_id) references public.portfolio_raw_records(id) on delete restrict,
  unique (account_id, source_fingerprint)
);
create index if not exists portfolio_transactions_account_time_idx
  on public.portfolio_transactions (account_id, trade_at desc);
create index if not exists portfolio_transactions_owner_idx
  on public.portfolio_transactions (owner_id, created_at desc);

create table if not exists public.portfolio_position_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid,
  instrument_id uuid not null references public.portfolio_instruments(id) on delete restrict,
  as_of timestamptz not null,
  total_quantity numeric(28,10) not null,
  sellable_quantity numeric(28,10),
  frozen_quantity numeric(28,10),
  cost_basis numeric(28,10),
  imported_market_value numeric(28,10),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  foreign key (batch_id, owner_id) references public.portfolio_import_batches(id, owner_id) on delete restrict,
  unique (account_id, instrument_id, as_of, source_fingerprint)
);
create index if not exists portfolio_positions_account_asof_idx
  on public.portfolio_position_snapshots (account_id, as_of desc);

create table if not exists public.portfolio_cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid,
  as_of timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total_cash numeric(28,10) not null,
  available_cash numeric(28,10),
  frozen_cash numeric(28,10),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  foreign key (batch_id, owner_id) references public.portfolio_import_batches(id, owner_id) on delete restrict,
  unique (account_id, currency, as_of, source_fingerprint)
);
create index if not exists portfolio_cash_account_asof_idx
  on public.portfolio_cash_snapshots (account_id, as_of desc);

-- Quotes are separate from imported cost basis and always carry independent source/time metadata.
create table if not exists public.portfolio_quotes (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.portfolio_instruments(id) on delete restrict,
  source_id text not null references public.data_sources(id) on delete restrict,
  price numeric(28,10) not null check (price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  is_delayed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (instrument_id, source_id, observed_at)
);
create index if not exists portfolio_quotes_instrument_time_idx
  on public.portfolio_quotes (instrument_id, observed_at desc);

create table if not exists public.portfolio_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  as_of timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  positions_value numeric(28,10),
  cash_value numeric(28,10),
  total_value numeric(28,10),
  completeness numeric(6,5) not null check (completeness >= 0 and completeness <= 1),
  status text not null check (status in ('complete','partial','stale','unavailable','conflicted')),
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  unique (account_id, as_of, currency)
);
create index if not exists portfolio_valuations_owner_time_idx
  on public.portfolio_valuation_snapshots (owner_id, as_of desc);

-- Xueqiu portfolios are not brokerage accounts and cannot be joined into broker assets.
create table if not exists public.portfolio_social_rebalances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid,
  external_rebalance_id text,
  occurred_at timestamptz not null,
  payload jsonb not null,
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict,
  foreign key (batch_id, owner_id) references public.portfolio_import_batches(id, owner_id) on delete restrict,
  unique (account_id, source_fingerprint)
);
create index if not exists portfolio_social_rebalances_account_time_idx
  on public.portfolio_social_rebalances (account_id, occurred_at desc);

-- Reconciliation findings are explicit and auditable; never auto-resolve conflicting sources.
create table if not exists public.portfolio_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  issue_code text not null,
  severity text not null check (severity in ('info','warning','error','critical')),
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  resolution jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (account_id, owner_id) references public.portfolio_accounts(id, owner_id) on delete restrict
);
create index if not exists portfolio_reconciliation_open_idx
  on public.portfolio_reconciliation_issues (owner_id, created_at desc)
  where status = 'open';

-- RLS: clients can read only their own portfolio data. All writes are server-side.
do $$
declare
  t text;
begin
  foreach t in array array[
    'portfolio_accounts',
    'portfolio_import_batches',
    'portfolio_raw_records',
    'portfolio_transactions',
    'portfolio_position_snapshots',
    'portfolio_cash_snapshots',
    'portfolio_valuation_snapshots',
    'portfolio_social_rebalances',
    'portfolio_reconciliation_issues'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = auth.uid() or public.is_admin())',
      t || '_owner_read', t
    );
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

alter table public.portfolio_instruments enable row level security;
alter table public.portfolio_quotes enable row level security;
revoke all on public.portfolio_instruments, public.portfolio_quotes from anon, authenticated;
grant select, insert, update on public.portfolio_instruments, public.portfolio_quotes to service_role;
grant select on public.portfolio_instruments, public.portfolio_quotes to authenticated;
create policy "Authenticated users read instrument catalogue"
  on public.portfolio_instruments for select to authenticated using (true);
create policy "Authenticated users read portfolio quotes"
  on public.portfolio_quotes for select to authenticated using (true);

-- Append-only source evidence: no authenticated UPDATE/DELETE grants or policies exist.
-- Service-role corrections must be represented as new source batches/events and audited.

-- SilverScope initial schema. Apply after provisioning a Supabase project.
create extension if not exists pgcrypto;
create type public.app_role as enum ('member', 'admin');
create type public.data_status as enum ('verified', 'estimated', 'manual', 'stale', 'unavailable');
create type public.ingestion_status as enum ('running', 'succeeded', 'partial', 'failed');
create type public.indicator_group as enum ('inventory_liquidity', 'macro', 'supply_demand', 'positioning');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, email text, role public.app_role not null default 'member', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.data_sources (id text primary key, name text not null, source_url text, source_kind text not null check (source_kind in ('api','file','manual')), license_status text not null default 'unverified', expected_cadence text, enabled boolean not null default false, last_success_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.ingestion_runs (id uuid primary key default gen_random_uuid(), source_id text not null references public.data_sources(id), status public.ingestion_status not null default 'running', started_at timestamptz not null default now(), completed_at timestamptz, fetched_count integer not null default 0 check (fetched_count >= 0), accepted_count integer not null default 0 check (accepted_count >= 0), rejected_count integer not null default 0 check (rejected_count >= 0), error_summary text, metadata jsonb not null default '{}'::jsonb);
create table public.observations (id uuid primary key default gen_random_uuid(), source_id text not null references public.data_sources(id), indicator_key text not null, value numeric not null, unit text not null, observed_at timestamptz not null, published_at timestamptz, fetched_at timestamptz not null default now(), confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1), status public.data_status not null, source_url text, source_record_id text, dedupe_key text not null unique, quality_flags jsonb not null default '[]'::jsonb, raw_payload jsonb, created_at timestamptz not null default now());
create index observations_indicator_observed_idx on public.observations (indicator_key, observed_at desc);
create index observations_source_fetched_idx on public.observations (source_id, fetched_at desc);
create table public.indicators (key text primary key, name text not null, group_key public.indicator_group not null, unit text not null, description text not null, direction smallint not null default 1 check (direction in (-1,1)), freshness_hours integer not null check (freshness_hours > 0), enabled boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.model_versions (id text primary key, description text not null, weights jsonb not null, parameters jsonb not null default '{}'::jsonb, is_active boolean not null default false, created_at timestamptz not null default now());
create table public.scores (id uuid primary key default gen_random_uuid(), model_version_id text not null references public.model_versions(id), score numeric(6,2) not null check (score >= 0 and score <= 100), regime text not null check (regime in ('bullish','neutral','bearish')), coverage numeric(6,4) not null check (coverage >= 0 and coverage <= 1), confidence numeric(6,4) not null check (confidence >= 0 and confidence <= 1), as_of timestamptz not null, input_snapshot jsonb not null, component_scores jsonb not null, created_at timestamptz not null default now());
create index scores_as_of_idx on public.scores (as_of desc);
create table public.signals (id uuid primary key default gen_random_uuid(), score_id uuid references public.scores(id), model_version_id text not null references public.model_versions(id), signal_key text not null, horizon text not null, direction text not null check (direction in ('bullish','neutral','bearish')), confidence numeric(6,4) not null check (confidence >= 0 and confidence <= 1), evidence jsonb not null, invalidation_conditions jsonb not null default '[]'::jsonb, generated_at timestamptz not null default now());
create index signals_generated_idx on public.signals (generated_at desc);
create table public.subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, provider text not null default 'stripe', provider_customer_id text, provider_subscription_id text unique, plan_key text not null default 'free', status text not null default 'inactive', current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, provider));
create table public.alerts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, alert_type text not null, configuration jsonb not null, enabled boolean not null default true, last_triggered_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.audit_events (id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id) on delete set null, event_type text not null, resource_type text not null, resource_id text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id,email) values (new.id,new.email)
  on conflict (id) do update set email=excluded.email,updated_at=now();
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

insert into public.data_sources (id,name,source_url,source_kind,license_status,expected_cadence,enabled) values
('fred','Federal Reserve Economic Data','https://api.stlouisfed.org/fred','api','public_api','daily / weekly',false),
('cftc','Commodity Futures Trading Commission','https://publicreporting.cftc.gov','api','unverified','weekly',false),
('cme-comex','CME / COMEX','https://www.cmegroup.com','api','unverified','daily',false),
('lbma','London Bullion Market Association','https://www.lbma.org.uk','file','unverified','monthly',false)
on conflict (id) do nothing;

insert into public.indicators (key,name,group_key,unit,description,direction,freshness_hours) values
('comex_registered_stocks','COMEX registered stocks','inventory_liquidity','oz','Registered warehouse inventory',-1,48),
('comex_eligible_stocks','COMEX eligible stocks','inventory_liquidity','oz','Eligible warehouse inventory',-1,48),
('lbma_vault_holdings','LBMA vault holdings','inventory_liquidity','tonnes','Monthly vault inventory',-1,1100),
('silver_lease_rate','Silver lease rate','inventory_liquidity','percent','Physical funding tightness',1,168),
('nearby_futures_spread','Nearby futures spread','inventory_liquidity','USD/oz','Futures curve tightness',1,48),
('us_dollar_index','US Dollar Index','macro','index','Broad USD conditions',-1,48),
('us_10y_real_yield','US 10Y real yield','macro','percent','Real yield opportunity cost',-1,48),
('fed_policy_expectations','Fed policy expectations','macro','probability','Market-implied easing expectations',1,168),
('gold_silver_ratio','Gold / silver ratio','macro','ratio','Relative precious-metal valuation',1,48),
('mine_production','Mine production','supply_demand','tonnes','Primary mine supply',-1,1100),
('recycling_supply','Recycling supply','supply_demand','tonnes','Secondary silver supply',-1,1100),
('solar_silver_intensity','Solar silver intensity','supply_demand','mg/W','Photovoltaic silver demand intensity',1,1100),
('industrial_demand','Industrial demand','supply_demand','tonnes','Industrial fabrication demand',1,1100),
('cftc_managed_money_net','CFTC managed money net','positioning','contracts','Managed-money futures positioning',1,168),
('silver_etf_holdings','Silver ETF holdings','positioning','tonnes','Investment holdings and flows',1,168),
('silver_implied_volatility','Silver implied volatility','positioning','percent','Options-implied market risk',1,48)
on conflict (key) do nothing;

insert into public.model_versions (id,description,weights,parameters,is_active) values
('silverscope-composite-0.1.0','Initial research hypothesis; not empirically calibrated.',
 '{"inventory_liquidity":0.30,"macro":0.25,"supply_demand":0.30,"positioning":0.15}'::jsonb,
 '{"minimum_coverage":0.65,"minimum_groups":2,"minimum_confidence":0.35,"max_age_hours":1080,"bearish_maximum":40,"bullish_minimum":60}'::jsonb,true)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.data_sources enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.observations enable row level security;
alter table public.indicators enable row level security;
alter table public.model_versions enable row level security;
alter table public.scores enable row level security;
alter table public.signals enable row level security;
alter table public.subscriptions enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_events enable row level security;
create policy "Users can read own profile" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "Authenticated users can read source registry" on public.data_sources for select to authenticated using (true);
create policy "Authenticated users can read indicator catalogue" on public.indicators for select to authenticated using (true);
create policy "Authenticated users can read model versions" on public.model_versions for select to authenticated using (true);
create policy "Authenticated users can read published scores" on public.scores for select to authenticated using (true);
create policy "Authenticated users can read published signals" on public.signals for select to authenticated using (true);
create policy "Users can read own subscription" on public.subscriptions for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "Users manage own alerts" on public.alerts for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Admins can read audit events" on public.audit_events for select to authenticated using (public.is_admin());
-- Ingestion, observations, score/signal generation and billing writes are server-side only.
-- The Supabase service role bypasses RLS and must never be exposed to a browser.

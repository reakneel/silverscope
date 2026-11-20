# Portfolio integration blueprint

## Decision and repository ownership

SilverScope is the canonical product and repository. portfolio-console is a source of reusable product capabilities and code to be selectively migrated into SilverScope; it is not the destination application. After feature parity, data reconciliation, deployment verification, and an explicit acceptance window, portfolio-console can be archived. Do not delete it during implementation.

## Non-negotiable data integrity rules

1. Never seed, synthesize, or silently fall back to demo holdings, cash, trades, NAV, returns, or account totals.
2. A missing database, failed query, empty account, stale quote, or disconnected provider must be represented as an explicit unavailable / not connected / stale state. It must not render plausible-looking financial figures.
3. Every imported fact must retain provenance: provider, provider account or portfolio identifier (masked in UI), source file or source record identity, import batch, source timestamp, ingestion timestamp, and parser/schema version.
4. Raw imports are immutable. Normalized records may be rebuilt from raw imports; corrections are new versions/events with an audit trail, not destructive edits to source evidence.
5. Idempotency is required. Re-importing the same file or record must not duplicate positions, executions, cash movements, or performance events.
6. Keep actual brokerage facts separate from social-platform portfolios, simulated P&L, watchlists, quotes, and derived analytics. Never combine them into a single real account balance.
7. No browser automation, undocumented private endpoint, credential scraping, or bypass of platform controls. Prefer official APIs or user-exported files. Do not request passwords, session cookies, OTPs, or private keys in chat.

## Source strategy: 同花顺 and 雪球

### 同花顺 (Tonghuashun)

Treat 同花顺 as a user-facing terminal / export channel, not automatically as the legal custodian of the brokerage ledger. The underlying broker statement is authoritative for executed trades, cash movements, fees, and end-of-day positions.

Initial supported path:
- User exports holdings / stock balance and historical executions / delivery statements from the broker-connected 同花顺 client, or directly from the broker's official client if 同花顺 cannot export the required data.
- Import CSV/XLSX (and PDF only if a deterministic parser can be validated) through a local file upload flow.
- Parse into a provider-specific staging format, preview row counts, date coverage, account identity (masked), currencies, fees, and rejected rows, then require user confirmation before committing.
- Support incremental imports and overlapping date ranges with deterministic deduplication.
- Preserve original file bytes and SHA-256 checksum in private storage; do not expose raw statements publicly.

Do not assume all broker integrations expose the same fields or export options. Adapter configuration must identify broker, client/export variant, file encoding, date/number formats, market, and currency.

### 雪球 (Xueqiu)

Keep two separate source classes:
- 雪球组合 / 调仓记录: a model or social portfolio with its own positions and NAV methodology. Store as a social_portfolio dataset, not a brokerage account.
- 雪球模拟盈亏 / linked-account view: treat as a secondary reconciliation/reference view unless the underlying broker statement is independently imported. It is not sufficient evidence for cash, fees, executed quantity, or tax-lot accounting.

Initial support should be user-provided exports or manually downloaded records where the platform permits them. Do not rely on undocumented Xueqiu endpoints or private APIs. Public portfolio pages, where available, must not be interpreted as the user's private brokerage positions.

### Source authority and conflict policy

For brokerage account facts: broker statement / broker-authorized API > broker-connected 同花顺 export > user-confirmed manual correction.
For Xueqiu social portfolios: Xueqiu portfolio/rebalance history is authoritative only for that social portfolio.
Market prices must come from a separately registered licensed/approved quote source and carry their own timestamp and delay metadata. A holding's imported cost basis must never be overwritten by a quote.

If two sources disagree, retain both observations, mark the account/field as conflicted, and require reconciliation. Never silently choose the larger/newer number.

## Target domain model

Use account-scoped, multi-currency records. Suggested entities (final names may follow existing SilverScope conventions):

- portfolio_providers: provider type (broker, 同花顺, 雪球), display name, connection/import mode, terms/permission status.
- portfolio_accounts: owner, provider, masked account reference, account type, base currency, market scope, status.
- portfolio_import_batches: account, source file hash, file name, parser version, import window, row counts, status, validation report, timestamps.
- portfolio_raw_records: immutable source row / JSON payload, batch, source row key, row fingerprint.
- portfolio_instruments: canonical instrument identifier, exchange, symbol, currency, security type, mapping confidence.
- portfolio_transactions: immutable executions and cash events (buy/sell, dividend, fee, tax, transfer, corporate action), source record reference, execution/settlement dates.
- portfolio_positions_snapshots: dated account position observations; distinguish total quantity, sellable quantity, frozen quantity, cost basis and market value.
- portfolio_cash_snapshots: dated cash balances by currency and availability type.
- portfolio_quotes: market price observations with source, observed_at, fetched_at, delay and licence metadata.
- portfolio_valuation_snapshots: reproducible account valuation assembled from positions, cash, FX and quotes, with completeness/staleness flags.
- portfolio_social_portfolios and portfolio_social_rebalances: separate Xueqiu model-portfolio records.
- portfolio_reconciliation_issues: source conflicts, missing periods, unmatched executions and user resolutions.

All owner-facing tables require Supabase RLS policies and owner scoping. Raw files must use private buckets and signed, short-lived access. Do not put broker account numbers or source documents in logs.

## Import and reconciliation pipeline

1. Upload: enforce file size/type limits, compute SHA-256, store original privately, create an import batch.
2. Detect: identify provider/export variant using headers and user-selected adapter; do not guess when ambiguous.
3. Parse: normalize decimal precision, timezone, date, market, currency, side, fees and security identifiers. Preserve original values.
4. Validate: required fields, account identity, supported market, duplicate keys, date range, arithmetic checks (quantity × price, gross/net amount), and row-level errors.
5. Preview: show imported/rejected counts, date coverage, account mask, likely duplicates, and conflicts. No ledger writes before confirmation.
6. Commit: write raw rows and normalized events transactionally; idempotency key includes account, provider, source identity and canonical row fingerprint.
7. Reconcile: compare opening + buys - sells + corporate actions against closing quantities; compare cash movements and fees; report unresolved differences.
8. Value: combine confirmed holdings/cash with a separately sourced quote and FX feed. Display valuation time and stale/missing quote warnings.
9. Re-import: detect identical files and overlapping records; never double count. Newer snapshots supersede only the same snapshot scope, not historical transactions.

## Product-console migration scope

Migrate product behavior, not its seeded dataset:
- portfolio overview, holdings table, closed positions, benchmark comparison, NAV/return/excess-return charts, trades, events and earnings views;
- calculation utilities only after their inputs are replaced with validated ledger and quote data;
- UI patterns and reusable components where compatible with SilverScope's stack and design system.

Do not migrate lib/seed.ts data, seeded NAV/return series, demo account snapshot, or silent demo fallback. The current portfolio-console lib/db.ts returns demo data when the database is missing or errors, and seeds holdings when the table is empty; this behavior is explicitly prohibited in SilverScope. The current holdings CRUD API is not a broker integration.

## SilverScope integration architecture

- Keep silver research / futures analytics as the existing product domain.
- Add a separately permissioned Portfolio workspace and API namespace.
- Reuse shared auth, owner identity, Supabase infrastructure, observability, and data-quality conventions.
- Do not mix personal portfolio records with shared market observations or research datasets.
- Portfolio market data adapters must have independent source/license registry entries. Do not use FRED/CFTC/CME silver datasets as substitutes for stock prices or brokerage records.
- Portfolio ingestion and valuation jobs must be independently observable and must not block silver research workflows.

## Security, privacy and compliance

- Use official APIs only where a provider explicitly documents and authorizes the required account scope.
- Otherwise use user-exported statements. No scraping of logged-in pages, reverse-engineered private APIs, CAPTCHA bypass, or credential reuse.
- Never collect broker passwords, OTPs, cookies, or full account numbers in application logs or chat.
- Encrypt stored source documents and sensitive account references; apply least privilege, owner RLS, retention controls, and auditable deletion/export.
- Verify platform terms, data licences, and jurisdictional requirements before enabling any automated or commercial redistribution.
- Keep the original source file private and provide a user-controlled deletion path subject to audit/retention requirements.

## Intraday NAV and performance delivery

The portfolio workspace exposes an owner-scoped time-series endpoint backed by `portfolio_valuation_snapshots`. The dashboard chart supports intraday, 7-day and 30-day windows and plots only persisted valuation points. It must show an honest empty state when there are no points; it must never interpolate or fabricate market movements.

For a genuinely useful intraday curve, a valuation worker must periodically combine:
- latest eligible quote per holding (source, observed_at, fetched_at, delay/licence metadata);
- latest cash snapshot by currency and an approved FX rate where conversion is required;
- position quantities and corporate-action-adjusted instrument identity;
- fees, taxes and external cash movements, so performance is not confused with deposits/withdrawals.

Sampling should be configurable (e.g. 1–5 minutes during market sessions, slower outside sessions) and respect the quote provider's rate limits and licence. Each persisted point records completeness and status. Missing quote/FX must create a partial point or a gap, not a stale value presented as live. The current UI/API reads these points; it does not itself supply a licensed live quote feed or a background valuation worker.

## Provider-agnostic import strategy

The universal CSV/TXT normalizer is the default import path. It maps common Chinese/English headers to canonical fields, supports explicit header overrides, fingerprints normalized rows and reports unmapped columns. Source-specific adapters remain optional refinements. Preview-only means preview-only: raw source evidence, transaction rows and snapshots are not committed until an audited, idempotent transactional import path and production Storage are enabled. XLSX parsing remains a separate follow-up; CSV/TXT support is not a claim of XLSX support.

## Acceptance gates

- Empty database renders a truthful empty state; it does not seed holdings or fabricate NAV.
- Missing DB/provider and query failures return explicit errors/status; they never return demo figures.
- Same source file imported twice produces zero duplicate normalized events.
- Intraday chart displays persisted valuation snapshots for the selected window and an explicit empty state when none exist.
- Every plotted point has timestamp, currency, completeness and valuation status; no synthetic interpolation is presented as market data.
- Overlapping statement windows do not duplicate executions.
- Quantity and cash reconciliation tests cover buys, sells, partial fills, fees, dividends, transfers and corporate actions.
- Xueqiu social portfolio data never contributes to brokerage account cash/assets or broker performance.
- Stale/missing quote and FX data visibly mark valuation as incomplete.
- RLS tests prove one user cannot read another user's accounts, raw files, imports or positions.
- Audit tests preserve raw source records and record all user corrections.
- No production migration or destructive data cleanup before migration-history reconciliation, verified PostgreSQL backup, and separate Storage backup.
- portfolio-console remains available as read-only rollback/reference until SilverScope passes production acceptance.

## Current blockers / operator inputs

- SilverScope Supabase migration history still needs remote reconciliation because the repository has duplicate 0006 prefixes. Do not run supabase db push until completed.
- No verified production DB backup/restore drill or live ingestion activation has been demonstrated in this session.
- 这些信息不再作为通用解析器开发的前置阻塞：先使用中英文别名和用户自定义列映射覆盖常见 CSV/TXT。正式账本提交前，仍需在导入预览中确认币种、市场、数量单位、时区和来源类别；必要时用脱敏样本校准具体适配器。雪球组合继续与券商账户隔离。

## Delivery sequence

1. Reconcile and close SilverScope's release gates: migration history, backup + restore drill, credentials, real source activation, production health.
2. Add portfolio schema, RLS and source/import audit infrastructure in a dedicated migration PR.
3. Implement the first real 同花顺/broker statement adapter against sanitized sample files; build preview, idempotency and reconciliation tests.
4. Implement Xueqiu social-portfolio adapter as a separate data domain, with no brokerage-account aggregation.
5. Migrate portfolio-console UI and calculations into SilverScope, replacing all seeded data and fallback paths.
6. Run end-to-end reconciliation with user-confirmed real exports and verify production monitoring.
7. Keep portfolio-console read-only during an acceptance window; archive only after explicit sign-off. Do not delete repository history.


## Implementation status — 2026-11-20

Merged into SilverScope main:
- PR #22: this integration blueprint and repository ownership decision.
- PR #23: portfolio account/import/ledger/valuation tables and private source-file bucket migrations (0010 and 0011). These migrations are code only; they have not been applied to Supabase.
- PR #24: Portfolio workspace, account management, and authenticated Huatai CSV/TSV preview. Preview is in-memory only; no source file or ledger rows are persisted.
- PR #25: source-aware valuation, drawdown and excess-return calculation core with missing-data and currency safeguards.
- PR #26: broker-reported market price field on position snapshots (migration 0012). Not applied to Supabase.
- PR #27: owner-scoped latest position/cash read API and real-data dashboard panel. No demo fallback.
- PR #28 (this change): transaction-history API and UI for real broker executions and cash-affecting events.

## Remaining release gates

1. Reconcile the remote Supabase migration history. The repository still has duplicate 0006 migration prefixes; do not run `supabase db push` until the remote `supabase_migrations.schema_migrations` state is inspected.
2. Complete and verify a full PostgreSQL backup/restore drill and a separate Supabase Storage object backup before applying migrations.
3. Configure the SilverScope Vercel production/preview environment with the required Supabase URL, anon key, service-role key and cron secret. The Vercel project currently reports no configured environment variables; no production deploy has been made for the portfolio work.
4. Obtain a sanitized real Huatai export sample to validate actual column names, encoding, timezone, transaction identifiers, fees and statement dates. Current parser aliases are provisional.
5. Implement and verify a confirmed import/commit pipeline for holdings, executions and cash statements. The current import UI is preview-only.
6. Add approved stock quote and FX sources before calculating live market valuation or aggregating foreign-currency assets. Broker statement snapshots remain the only available valuation basis until then.
7. Import and reconcile real statements, verify RLS isolation and duplicate/overlap handling, then migrate the remaining portfolio-console charts/events/earnings features using only real source data.
8. Keep portfolio-console unarchived until production acceptance and an explicit user sign-off.

No production database cleanup, migration, data ingestion, backup/restore, deployment, or portfolio-console archival is claimed as completed by this code status.


## Provider-agnostic analytics engine

The portfolio calculation layer consumes canonical observations and events, not broker-specific column names. Provider adapters should map source data into these canonical inputs; missing optional inputs reduce confidence/completeness rather than disabling unrelated calculations.

Implemented in `lib/portfolio/performance.ts`:
- Time-weighted return (TWR) with external-flow adjustment at observation-period boundaries.
- Modified Dietz return for periods without exact intraperiod NAV.
- Money-weighted annualized return (XIRR), solved with bounded bisection.
- FIFO realized P&L with buy fees capitalized and sell fees/taxes deducted.
- Periodic and cumulative flow-adjusted performance series.
- Annualized volatility, Sharpe, Sortino, and benchmark beta.

Calculation conventions:
- All values in one calculation must be in the same reporting currency. FX conversion is a separate, timestamped input transformation.
- TWR uses cash flows as period-end adjustments unless the caller supplies finer NAV observations. Modified Dietz supports explicit flow weights.
- XIRR requires dated signed cash flows; the ending portfolio value is represented as a positive terminal flow.
- FIFO is the default realized-cost convention here; jurisdiction/accounting-specific tax lots (specific identification, average cost, tax treatment) must remain selectable future policies.
- Risk metrics require aligned return observations and a declared sampling frequency; annualization defaults to 252 periods and should be changed for weekly/monthly series.
- Metrics return null when mathematically undefined or insufficiently observed. They do not synthesize missing prices, cash, FX, or NAV.

This engine is source-neutral by design. Huatai, 同花顺, 雪球 and future API/CSV/XLSX adapters should normalize into the same canonical contracts. A social/model portfolio remains a distinct portfolio identity; it is not merged into a broker account merely because the symbols overlap.

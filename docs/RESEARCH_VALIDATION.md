# Research Validation

## Implemented primitives

- `createWalkForwardFolds`: expanding or rolling chronological training windows, test windows, configurable step size and embargo.
- `calculateBacktestMetrics`: total return, CAGR, annualized volatility, Sharpe, Sortino, maximum drawdown, Calmar, win rate and optional benchmark return.
- `simulateFuturesExecution`: close-of-bar target positions filled at the next bar open, futures multiplier P&L, per-side commissions, adverse slippage, explicit contract roll prices, initial-margin checks and maintenance-margin liquidation.
- `sizeFuturesPosition`: conservative integer contract sizing from equity risk budget, stop distance, maximum position and optional initial-margin cap.
- `simulateVolumeConstrainedOrder`: market-order fills capped by a configured fraction of each bar's reported volume; unfilled quantity is returned explicitly.
- `calculatePortfolioRisk`: multi-contract gross/net notional, additive initial/maintenance margin, risk-group concentration and configurable account-limit checks.
- `createResearchSnapshot`: canonical SHA-256 input snapshots with strict point-in-time availability and provenance validation.
- `createExperimentManifest`: versioned, content-addressed experiment definitions.
- `buildWalkForwardReport`: stitches non-overlapping out-of-sample fold returns and emits aggregate risk metrics without inventing calendar-gap returns.
- `adjustPValuesBonferroni`: family-wise error correction across a declared set of tested hypotheses.
- `evaluatePortfolioScenarios`: per-contract percentage price shocks with marked P&L, stressed notional and initial/maintenance margin shortfalls.
- `evaluateCostSensitivity`: reruns a fixed equity/turnover path under explicit transaction-cost assumptions.
- `simulatePortfolioExecution`: synchronized multi-contract bars, shared equity, next-frame target execution, volume participation, initial-margin admission, maintenance liquidation and residual final positions.
- `buildPointInTimeFeatureSignals`: strict historical feature construction requiring verified observations with known publication timestamps no later than the decision time.

These are deterministic research primitives. They do not establish that a strategy is profitable or reproduce a complete exchange matching engine.

## Execution and margin assumptions

The futures simulator marks P&L from prior close to current open and current open to close. Close-of-bar target positions are executed at the next bar open. Each fill includes per-contract per-side commission and adverse basis-point slippage.

A contract change requires an explicit `rollFromPrice` representing the old contract's executable exit price. The old contract is closed at that price and the new contract is opened at the new contract's open. The calendar spread is not booked as trading P&L. Roll prices must be sourced and verified; they are never inferred.

Initial and maintenance margin rates are optional but must be supplied together. Initial margin is checked before increasing/opening a position. Equity is checked against maintenance margin after each bar mark; if breached, the simulator liquidates at that bar's close with configured slippage and commission. These are simplified percentage-of-notional assumptions, not exchange-specific SPAN or broker house-margin rules.

The position-sizing helper estimates risk as stop distance multiplied by contract multiplier. It floors to whole contracts and applies both risk-budget and initial-margin constraints. It does not guarantee the stop can execute at its stated price; gaps and liquidity can cause larger losses.

## Multi-contract execution assumptions

The portfolio runner requires synchronized frames containing a mark bar for every open contract and an execution bar for every outstanding non-zero target. Close targets execute at the next frame open. Each contract's fill quantity is capped by `floor(volume * maxParticipationRate)`; residual target quantity remains outstanding and is recalculated against the next close target. Contract multipliers, commissions and margin rates must remain stable for each contract ID. A roll is represented as two separate contract positions: close the old contract and open the new contract using their own executable bars; the spread gap is not booked as P&L. Initial margin limits new exposure, maintenance breaches trigger volume-limited close orders, and final liquidation may leave explicit residual open positions if bar capacity is insufficient. The runner never reports a portfolio as flat when residual contracts remain.

The runner is a synchronized OHLCV bar model, not a complete exchange matching engine. It does not model order-book queues, intrabar ordering, bid/ask spread, market impact, funding, exchange expiry calendars, SPAN, broker house margin, cross-margin credits or FX conversion.

## Scenario analysis and execution-cost sensitivity

Portfolio stress scenarios apply explicit percentage price shocks by contract, mark long and short P&L with each contract multiplier, and recompute gross notional plus additive initial/maintenance margin. Unspecified contracts receive a zero shock. Insolvency and margin shortfalls are reported rather than clamped away. Scenario shocks are user-supplied assumptions, not forecasts or calibrated probabilities.

Cost sensitivity re-evaluates a fixed equity and turnover path under a declared set of trading-cost basis-point assumptions. It does not infer spreads, impact or fees from missing market data; the user must supply realistic turnover and cost ranges.

## Out-of-sample reporting and multiple testing

The walk-forward report consumes only explicit test-fold equity series, rejects duplicate fold IDs and overlapping/out-of-order test windows, and chains net per-period returns across the tested windows. It does not invent returns during calendar gaps; therefore aggregate CAGR and Calmar are intentionally null. Volatility and Sharpe are annualized using the caller-supplied `periodsPerYear`, which must match the sampling cadence. Benchmark return is emitted only when every out-of-sample period has benchmark marks. Bonferroni correction controls family-wise error for a declared family of p-values; it does not create p-values or replace a nested validation design. Strategy selection still requires a predeclared hypothesis family and untouched final holdout.

## Immutable research snapshots and experiment manifests

A research snapshot is identified by a SHA-256 hash over canonical JSON containing the dataset identifier, decision time, model and strategy versions, parameters, assumptions and sorted observation records. Object keys are sorted before serialization; non-finite and non-JSON values are rejected. Only verified observations with known publication timestamps and observed/published/fetched times no later than the decision time are accepted. Missing publication timestamps are rejected rather than inferred. Snapshot identity is deterministic and excludes wall-clock creation time.

Migration `0006_research_snapshots.sql` adds append-only experiment manifests, run snapshots and JSON artifacts. RLS scopes reads and inserts to the owning authenticated user (or admin); no update/delete policies are defined. Apply the migration only after a Supabase project is provisioned. The application does not claim that database persistence is active until credentials and migrations are configured.

## Partial-fill and portfolio-risk assumptions

The volume-constrained order helper caps each bar fill at `floor(volume * maxParticipationRate)`, applies configured adverse slippage and per-side commission, and returns both filled and remaining quantity. Remaining quantity is never assumed to execute after the supplied bars. It is a bar-volume capacity approximation, not an order-book simulator: queue priority, bid/ask spread, market impact, latency, and intrabar sequencing remain unmodeled. It is deliberately separate from the single-contract simulator until a multi-instrument order lifecycle can represent partially closed rolls without losing residual positions.

The portfolio risk snapshot aggregates signed and gross notional across unique contract IDs and sums each contract's initial and maintenance margin independently. It supports explicit gross, net, margin, per-instrument contract and risk-group limits. No cross-margin, spread credit, hedge offset, FX conversion, or exchange SPAN calculation is inferred. All positions must use a consistent account currency and point-in-time marks supplied by the caller.

## Point-in-time and walk-forward discipline

1. Sort observations by actual availability timestamp, not merely the date of the underlying event.
2. Construct features using only data published and available at each decision time.
3. Fit calibration and model parameters on the training slice only.
4. Keep the configured embargo between training and test slices where overlapping labels or delayed data may leak information.
5. Freeze the strategy before each test slice; do not retune against test results.
6. Concatenate out-of-sample test returns only after each fold has been evaluated independently.
7. Compare against a documented benchmark and report assumptions, sample sizes and missing-data treatment.

Unknown publication timestamps are rejected by strict historical feature construction. Existing FRED / CFTC adapters may leave `publishedAt` null when upstream payloads do not expose an exact timestamp; such rows are not eligible for strict point-in-time replay until a reliable availability timestamp is sourced.

## Not yet implemented

- Exchange-specific expiry calendars, SPAN / broker margin schedules and intraday margin calls.
- Integrate volume-limited partial fills into a persistent multi-contract order lifecycle, including partial roll exits/entries and residual-order expiry policies.
- Order book queues, bid/ask spread, latency and calibrated market impact.
- Portfolio-level cross-margin, correlated-position stress tests, FX conversion and multi-contract capital allocation.
- Automated roll schedule selection and verified continuous-contract construction.
- Point-in-time feature warehouse and immutable research snapshots.
- Parameter search with nested validation and multiple-testing controls.
- Out-of-sample report aggregation, confidence intervals and regime attribution.
- Benchmark and risk-free data ingestion.
- Experiment registry and immutable run artifacts.

No backtest result or performance claim is published by these primitives. Future strategy evaluation must use verified historical data, point-in-time availability, out-of-sample periods and realistic execution assumptions.

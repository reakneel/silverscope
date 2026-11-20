# Research Validation

## Implemented primitives

- `createWalkForwardFolds`: expanding or rolling chronological training windows, test windows, configurable step size and embargo.
- `calculateBacktestMetrics`: total return, CAGR, annualized volatility, Sharpe, Sortino, maximum drawdown, Calmar, win rate and optional benchmark return.
- `simulateFuturesExecution`: close-of-bar target positions filled at the next bar open, futures multiplier P&L, per-side commissions, adverse slippage, explicit contract roll prices, initial-margin checks and maintenance-margin liquidation.
- `sizeFuturesPosition`: conservative integer contract sizing from equity risk budget, stop distance, maximum position and optional initial-margin cap.
- `buildPointInTimeFeatureSignals`: strict historical feature construction requiring verified observations with known publication timestamps no later than the decision time.

These are deterministic research primitives. They do not establish that a strategy is profitable or reproduce a complete exchange matching engine.

## Execution and margin assumptions

The futures simulator marks P&L from prior close to current open and current open to close. Close-of-bar target positions are executed at the next bar open. Each fill includes per-contract per-side commission and adverse basis-point slippage.

A contract change requires an explicit `rollFromPrice` representing the old contract's executable exit price. The old contract is closed at that price and the new contract is opened at the new contract's open. The calendar spread is not booked as trading P&L. Roll prices must be sourced and verified; they are never inferred.

Initial and maintenance margin rates are optional but must be supplied together. Initial margin is checked before increasing/opening a position. Equity is checked against maintenance margin after each bar mark; if breached, the simulator liquidates at that bar's close with configured slippage and commission. These are simplified percentage-of-notional assumptions, not exchange-specific SPAN or broker house-margin rules.

The position-sizing helper estimates risk as stop distance multiplied by contract multiplier. It floors to whole contracts and applies both risk-budget and initial-margin constraints. It does not guarantee the stop can execute at its stated price; gaps and liquidity can cause larger losses.

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
- Partial fills, order book queues, volume participation, bid-ask spread and market impact.
- Portfolio-level cross-margin, correlated positions and multi-contract capital allocation.
- Automated roll schedule selection and verified continuous-contract construction.
- Point-in-time feature warehouse and immutable research snapshots.
- Parameter search with nested validation and multiple-testing controls.
- Out-of-sample report aggregation, confidence intervals and regime attribution.
- Benchmark and risk-free data ingestion.
- Experiment registry and immutable run artifacts.

No backtest result or performance claim is published by these primitives. Future strategy evaluation must use verified historical data, point-in-time availability, out-of-sample periods and realistic execution assumptions.

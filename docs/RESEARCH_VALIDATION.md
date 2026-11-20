# Research Validation

## Implemented primitives

The TypeScript research core currently provides two deterministic building blocks:

- `createWalkForwardFolds`: expanding or rolling chronological training windows, test windows, configurable step size and an embargo gap.
- `calculateBacktestMetrics`: total return, CAGR, annualized volatility, Sharpe, Sortino, maximum drawdown, Calmar, win rate and optional benchmark return.\n- `simulateFuturesExecution`: close-of-bar target positions filled at the next bar open, futures multiplier P&L, per-side commissions and adverse slippage, position caps, and final liquidation.\n- `buildPointInTimeFeatureSignals`: strict historical feature construction requiring verified observations with known publication timestamps no later than the decision time.

These functions operate on supplied timestamps and equity curves. They do not generate trades, fit or tune a strategy, or establish that a strategy is profitable.

## Cost convention

Each equity point may include a period turnover fraction. Net period return is calculated as:

`net_return = gross_return - turnover × trading_cost_bps / 10,000`

The annual risk-free rate, cost basis points and annualization frequency are explicit options. The futures simulator separately charges commission per contract per side and applies adverse slippage to the reference open / close price. Defaults are zero risk-free rate and zero costs, so production research must provide realistic values. Cost assumptions should include commissions, exchange / clearing fees, bid-ask spread, slippage, market impact and roll costs as appropriate. A single basis-point haircut is only a first-order approximation.

## Walk-forward discipline

1. Sort observations by their actual availability timestamp, not merely the date their underlying event occurred.
2. Construct features using only data published and available at each decision time.
3. Fit calibration and model parameters on the training slice only.
4. Keep the configured embargo between training and test slices where overlapping labels or delayed data may leak information.
5. Freeze the strategy before each test slice; do not retune against test results.
6. Concatenate out-of-sample test returns only after each fold has been evaluated independently.
7. Compare against a documented benchmark and report all assumptions, sample sizes and missing-data treatment.

## Not yet implemented

- Strategy / order generation and event-driven portfolio simulation.
- Point-in-time feature store and publication-time snapshots.
- Futures contract selection, expiry / roll handling and contract multipliers.
- Realistic execution, bid-ask spread, slippage, market impact and liquidity constraints.
- Parameter search with nested validation and multiple-testing controls.
- Out-of-sample report aggregation, confidence intervals and regime attribution.
- Benchmark and risk-free data ingestion.
- Research experiment registry and immutable run artifacts.

The futures simulator assumes one fixed contract and constant multiplier per run; it is not an exchange-grade order book simulator and does not model margin calls, partial fills, limit queues, liquidity impact, financing, or contract rolls.\n\nHistorical point-in-time feature construction rejects rows with unknown publication timestamps. Existing FRED / CFTC adapters may leave `publishedAt` null when the upstream payload does not expose an exact timestamp; those rows are therefore not eligible for strict historical strategy replay until a reliable availability timestamp is sourced.\n\nNo backtest result or performance claim is published by these primitives. Any future strategy evaluation must use verified historical data, point-in-time availability, out-of-sample periods and realistic execution assumptions.

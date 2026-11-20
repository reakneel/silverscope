# Quantitative Model

## Scope
The initial composite model is a transparent research hypothesis, not a validated trading strategy or investment recommendation. Model version: `silverscope-composite-0.1.0`.

## Pipeline
1. Fetch immutable observations with provenance and quality metadata.
2. Select the latest observation for each calibrated indicator.
3. Convert raw units into a directional 0–100 feature score using configured historical mean and standard deviation.
4. Apply freshness, confidence, status and duplicate checks.
5. Aggregate features by group and combine available groups using configured weights.
6. Compute coverage from the fraction of expected indicators present in each group, multiplied by that group's model weight. One observation no longer counts as full coverage for an entire group.
7. Publish a regime classification only when minimum weighted indicator coverage, group count and confidence requirements are met.
8. Persist score and evidence-linked signal snapshots with a stable input fingerprint, so repeated scheduled runs are idempotent.

## Expected indicator breadth
- Inventory / liquidity: 5 indicators (30% weight)
- Macro: 5 indicators (25% weight)
- Supply / demand: 4 indicators (30% weight)
- Positioning: 3 indicators (15% weight)

With only the three currently implemented FRED macro series and one CFTC positioning series, maximum weighted coverage is 20%. The engine correctly withholds a composite score until additional indicators from the other categories are connected and pass validation. This is intentional; a small number of proxies must not masquerade as broad market coverage.

## Calibration
The pipeline requires `SILVER_FEATURE_CALIBRATION_JSON`. Each entry has `indicatorKey`, `group`, `mean`, `standardDeviation` and `direction` (1 or -1). Parameters must be estimated from a documented historical training window, appropriate frequency and point-in-time data. Do not copy illustrative values into production.

The protected `/api/cron/calibration/preview` endpoint derives candidate means and sample standard deviations from verified stored observations, with a minimum of 52 samples per indicator. It is a review aid only: it does not select a training window, account for structural breaks, or prevent look-ahead leakage. Review the output and choose a point-in-time calibration window before activation.

Example schema only (values are deliberately placeholders and must not be deployed):
```json
[
  {
    "indicatorKey": "us_10y_real_yield",
    "group": "macro",
    "mean": 0,
    "standardDeviation": 1,
    "direction": -1
  }
]
```

## Current policy
- Group weights: inventory/liquidity 30%, macro 25%, supply/demand 30%, positioning 15%.
- Minimum weighted indicator coverage: 65%.
- Minimum available groups: 2.
- Minimum confidence: 0.35.
- Maximum observation age: 45 days.
- Composite regime: bullish >= 60, bearish <= 40, otherwise neutral.

## Research validation primitives
The research library now provides a cost-aware equity-curve evaluator and chronological walk-forward fold generator. The evaluator reports total return, CAGR, annualized volatility, Sharpe, Sortino, maximum drawdown, Calmar, win rate and optional benchmark return. Trading costs are applied from per-period turnover and an explicit basis-point assumption; the risk-free rate and annualization frequency are also explicit inputs. Undefined ratios remain null when their denominators are zero.

The walk-forward splitter supports expanding or rolling training windows, test windows, step sizes and an embargo gap. It only partitions chronologically ordered observations; it does not fit models, generate trades, select parameters or guarantee unbiased results. A complete strategy runner still needs point-in-time feature construction, order execution assumptions, corporate / contract roll handling, and out-of-sample evaluation.

## Interpretation
A score is a normalized market-state classification. It is not a probability of profit, a return forecast, or a buy/sell instruction. A signal records the model version, component evidence, accepted inputs and invalidation conditions. Historical performance claims require point-in-time data, walk-forward validation, transaction costs and out-of-sample reporting.

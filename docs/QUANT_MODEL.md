# Quantitative Model

## Scope
The initial composite model is a transparent research hypothesis, not a validated trading strategy or investment recommendation. Model version: `silverscope-composite-0.1.0`.

## Pipeline
1. Fetch immutable observations with provenance and quality metadata.
2. Select the latest observation for each calibrated indicator.
3. Convert raw units into a directional 0–100 feature score using configured historical mean and standard deviation.
4. Apply freshness, confidence, status and duplicate checks.
5. Aggregate features by group and combine available groups using configured weights.
6. Publish a regime classification only when minimum coverage, group count and confidence requirements are met.
7. Persist score and evidence-linked signal snapshots idempotently.

## Calibration
The pipeline requires `SILVER_FEATURE_CALIBRATION_JSON`. Each entry has `indicatorKey`, `group`, `mean`, `standardDeviation` and `direction` (1 or -1). Parameters must be estimated from a documented historical training window, appropriate frequency and point-in-time data. Do not copy illustrative values into production. Until calibration is supplied, score generation returns `calibration_required`.

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
- Minimum group coverage: 65%.
- Minimum available groups: 2.
- Minimum confidence: 0.35.
- Maximum observation age: 45 days.
- Composite regime: bullish >= 60, bearish <= 40, otherwise neutral.

## Interpretation
A score is a normalized market-state classification. It is not a probability of profit, a return forecast, or a buy/sell instruction. A signal records the model version, component evidence, accepted inputs and invalidation conditions. Historical performance claims require point-in-time data, walk-forward validation, transaction costs and out-of-sample reporting.

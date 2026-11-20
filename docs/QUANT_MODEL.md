# Quant Model — Initial Specification

## Components and research weights
| Component | Initial weight | Example features |
|---|---:|---|
| Inventory & liquidity | 30% | COMEX/LBMA stocks, lease rates, curve, spreads |
| Macro | 25% | DXY, real yields, policy expectations |
| Supply & industrial demand | 30% | mine supply, recycling, solar, electronics, substitution |
| Positioning | 15% | CFTC positioning, ETF flows, volatility |

Weights are starting hypotheses, not empirically optimized parameters.

## Pipeline
1. Ingest source observations with provenance.
2. Validate schema, units, timestamps and freshness.
3. Transform each feature into a consistent bullish/bearish orientation.
4. Normalize using documented rolling or economically meaningful thresholds.
5. Aggregate only when minimum data coverage is met.
6. Produce score, component contributions, uncertainty and explanation.
7. Persist immutable model version and input snapshot.
8. Evaluate out-of-sample and against simple baselines.

## Required output
- score 0–100 (only when coverage is sufficient)
- regime: bullish / neutral / bearish
- horizon
- confidence and data coverage
- component contributions
- evidence references and timestamps
- invalidation / risk conditions
- model_version

## Validation
Avoid look-ahead bias and survivorship bias. Use time-based train/test splits, walk-forward evaluation, transaction costs and slippage. Report calibration, drawdown, turnover and benchmark comparisons. Do not publish win rates until reproducible backtests exist.

## Missing data
Missing, stale or low-confidence observations must reduce coverage/confidence or block the score. Do not silently impute values in user-facing signals.

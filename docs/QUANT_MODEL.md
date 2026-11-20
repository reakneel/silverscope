# Quant Model — Version 0.1.0

## Component hypotheses
| Component | Weight | Example features |
|---|---:|---|
| Inventory & liquidity | 30% | COMEX/LBMA stocks, lease rates, curve, spreads |
| Macro | 25% | USD proxies, real yields, policy expectations |
| Supply & industrial demand | 30% | mine supply, recycling, solar, electronics, substitution |
| Positioning | 15% | CFTC positioning, ETF flows, volatility |

These weights are research hypotheses, not empirically optimized parameters.

## Scoring contract
The engine accepts normalized feature signals in the range 0–100. A feature score must be directionally normalized before aggregation; raw values in incompatible units must never be averaged. A positive direction means a stronger silver-market backdrop, while a negative direction must be inverted by the feature adapter before it reaches the composite engine.

Initial descriptive regime thresholds:
- 0–40: bearish
- above 40 and below 60: neutral
- 60–100: bullish

These are not trade recommendations.

## Coverage and confidence
Component weights are inventory/liquidity 30%, macro 25%, supply/demand 30%, and positioning 15%. Coverage is the sum of weights for components with at least one accepted input. The score is withheld unless coverage is at least 65%, at least two components are represented, and aggregate confidence meets the configured minimum.

Within a component, inputs are confidence-weighted. Estimated observations receive a configurable confidence haircut; manual observations receive a larger haircut and can be disabled by policy. Stale, unavailable, malformed, future-dated, duplicate, or low-confidence inputs are rejected.

## Normalization
normalizeZScore maps a direction-adjusted z-score to 50 + 15z, clipped to 0–100. It requires a historical mean and standard deviation computed only from data available at the observation timestamp. It returns no value when the standard deviation is non-positive or inputs are invalid. Production adapters must document the rolling window and prevent look-ahead bias.

## Output and reproducibility
Each score includes model version, as-of timestamp, accepted input keys, rejected inputs and reasons, component contributions, coverage, confidence and thresholds. Persistence must retain the exact input snapshot and model parameters used for each score.

## Validation before publication
Use time-based train/test splits, walk-forward evaluation, transaction costs and slippage. Report drawdown, turnover, calibration and benchmark comparisons. Do not publish win rates or performance claims until reproducible backtests exist.

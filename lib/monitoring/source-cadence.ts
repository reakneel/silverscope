/** Explicit monitoring thresholds. These are operational alert windows, not claims about source publication SLAs. */
export const SOURCE_CADENCE_POLICY: Readonly<Record<string, number>> = {
  fred: 36 * 60 * 60 * 1000,
  cftc: 10 * 24 * 60 * 60 * 1000,
  "cme-comex": 36 * 60 * 60 * 1000,
  "licensed-market-data": 36 * 60 * 60 * 1000,
  lbma: 45 * 24 * 60 * 60 * 1000,
};

export interface LatestMarketObservation {
  indicatorKey: string; value: number; unit: string; observedAt: string;
  fetchedAt: string; status: string; sourceId: string;
}
export interface MarketScore {
  score: number; regime: "bullish" | "neutral" | "bearish";
  coverage: number; confidence: number; asOf: string; modelVersion: string;
  components: Array<{ group: string; score: number | null; coverage: number; confidence: number | null }>;
}
export interface MarketSignal {
  direction: "bullish" | "neutral" | "bearish"; confidence: number;
  generatedAt: string; signalKey: string; modelVersion: string;
}
export interface MarketOverview {
  configured: boolean; observations: Record<string, LatestMarketObservation>;
  score: MarketScore | null; signal: MarketSignal | null; updatedAt: string | null;
}
interface MarketOverviewOptions { baseUrl?: string; serviceRoleKey?: string; fetchImpl?: typeof fetch; }
export async function getMarketOverview(options: MarketOverviewOptions = {}): Promise<MarketOverview> {
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const empty: MarketOverview = { configured: false, observations: {}, score: null, signal: null, updatedAt: null };
  if (!baseUrl || !serviceRoleKey) return empty;
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = baseUrl.replace(/\/$/, "");
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: "application/json" };
  const get = async (path: string) => {
    const response = await fetchImpl(`${root}/rest/v1/${path}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`Market overview query failed (HTTP ${response.status}).`);
    return response.json() as Promise<unknown>;
  };
  try {
    const observationsQuery = new URLSearchParams({
      select: "source_id,indicator_key,value,unit,observed_at,fetched_at,status",
      indicator_key: "in.(cftc_managed_money_net,us_10y_real_yield,us_10y_nominal_yield,us_dollar_index)",
      order: "observed_at.desc", limit: "100",
    });
    const [scoreRows, observationRows, signalRows] = await Promise.all([
      get("scores?select=score,regime,coverage,confidence,as_of,model_version_id,component_scores&order=as_of.desc&limit=1"),
      get(`observations?${observationsQuery.toString()}`),
      get("signals?select=direction,confidence,generated_at,signal_key,model_version_id&order=generated_at.desc&limit=1"),
    ]);
    const scores = Array.isArray(scoreRows) ? scoreRows as Array<Record<string, unknown>> : [];
    const rows = Array.isArray(observationRows) ? observationRows as Array<Record<string, unknown>> : [];
    const signals = Array.isArray(signalRows) ? signalRows as Array<Record<string, unknown>> : [];
    const observations: Record<string, LatestMarketObservation> = {};
    for (const row of rows) {
      const key = String(row.indicator_key ?? "");
      if (!key || observations[key]) continue;
      const value = Number(row.value);
      if (!Number.isFinite(value)) continue;
      observations[key] = {
        indicatorKey: key, value, unit: String(row.unit), observedAt: String(row.observed_at),
        fetchedAt: String(row.fetched_at), status: String(row.status), sourceId: String(row.source_id),
      };
    }
    const rawScore = scores[0];
    const rawComponents = rawScore?.component_scores;
    const score = rawScore && Number.isFinite(Number(rawScore.score)) ? {
      score: Number(rawScore.score), regime: rawScore.regime as MarketScore["regime"],
      coverage: Number(rawScore.coverage), confidence: Number(rawScore.confidence),
      asOf: String(rawScore.as_of), modelVersion: String(rawScore.model_version_id),
      components: Array.isArray(rawComponents) ? rawComponents as MarketScore["components"] : [],
    } : null;
    const rawSignal = signals[0];
    const signal = rawSignal ? {
      direction: rawSignal.direction as MarketSignal["direction"], confidence: Number(rawSignal.confidence),
      generatedAt: String(rawSignal.generated_at), signalKey: String(rawSignal.signal_key),
      modelVersion: String(rawSignal.model_version_id),
    } : null;
    const latestFetch = Object.values(observations).map((item) => Date.parse(item.fetchedAt)).filter(Number.isFinite);
    return {
      configured: true, observations, score, signal,
      updatedAt: latestFetch.length ? new Date(Math.max(...latestFetch)).toISOString() : score?.asOf ?? null,
    };
  } catch {
    return empty;
  }
}

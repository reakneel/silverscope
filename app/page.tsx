import { Clock3, Database, Gauge, ShieldAlert, TrendingUp } from "lucide-react";
import { getMarketOverview } from "@/lib/data/market-overview";

const groups = [
  { key: "inventory_liquidity", name: "Inventory & liquidity", weight: "30%", detail: "COMEX / LBMA stocks, curve and lease rates" },
  { key: "macro", name: "Macro conditions", weight: "25%", detail: "USD, real yields and central-bank expectations" },
  { key: "supply_demand", name: "Supply & industrial demand", weight: "30%", detail: "Mine supply, recycling, solar and electronics" },
  { key: "positioning", name: "Market positioning", weight: "15%", detail: "CFTC positioning, ETF flows and volatility" }
];
const number = (value: number, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const observed = (value: { value: number; unit: string } | undefined) => value ? `${number(value.value, value.unit === "contracts" ? 0 : 2)} ${value.unit}` : "—";
export default async function DashboardPage() {
  const overview = await getMarketOverview();
  const score = overview.score;
  const managedMoney = overview.observations.cftc_managed_money_net;
  const realYield = overview.observations.us_10y_real_yield;
  const silverSpot = overview.observations.silver_spot_usd_oz;
  const componentMap = new Map((score?.components ?? []).map((component) => [component.group, component.score]));
  const live = Object.keys(overview.observations).length > 0 || Boolean(score);
  return <div className="page-wrap">
    <div className="page-heading"><div><div className="eyebrow">RESEARCH WORKSPACE</div><h1>Market overview</h1><p>Understand what is moving silver — and what could change next.</p></div><span className="demo-tag"><span/> {live ? "OBSERVATIONS AVAILABLE" : "DEMO · NO LIVE FEED"}</span></div>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-label">Silver spot</div><div className="metric-value">{silverSpot ? `${number(silverSpot.value)}` : "$—"}</div><div className="metric-change muted">{silverSpot ? `USD/oz · as of ${silverSpot.observedAt.slice(0, 10)}` : "Licensed price feed not connected"}</div></article>
      <article className="metric-card"><div className="metric-label">SilverScope score</div><div className="metric-value">{score ? `${number(score.score)} / 100` : "— / 100"}</div><div className="metric-change muted">{score ? `Coverage ${number(score.coverage * 100, 0)}% · ${score.modelVersion}` : "Awaiting calibrated inputs"}</div></article>
      <article className="metric-card"><div className="metric-label">CFTC managed-money net</div><div className="metric-value">{managedMoney ? number(managedMoney.value, 0) : "—"}</div><div className="metric-change muted">{managedMoney ? `Contracts · as of ${managedMoney.observedAt.slice(0, 10)}` : "CFTC source not connected"}</div></article>
      <article className="metric-card"><div className="metric-label">US 10Y real yield</div><div className="metric-value">{realYield ? `${number(realYield.value)}%` : "—"}</div><div className="metric-change muted">{realYield ? `FRED · as of ${realYield.observedAt.slice(0, 10)}` : "FRED source not connected"}</div></article>
    </section>
    <section className="content-grid">
      <article className="panel chart-panel"><div className="panel-heading"><div><h2>Silver price context</h2><p>Spot reference · USD / troy oz</p></div><span className="range-chip">Chart pending data</span></div><div className="empty-chart"><div className="chart-icon"><TrendingUp size={25}/></div><strong>Connect a verified price feed</strong><span>Price history will appear here when a licensed or approved data source is configured.</span></div><div className="chart-foot"><span><Database size={13}/> Source: not connected</span><span><Clock3 size={13}/> Last update: —</span></div></article>
      <article className="panel score-panel"><div className="panel-heading"><div><h2>Market regime</h2><p>Composite model output</p></div><Gauge size={19} className="muted-icon"/></div><div className="score-placeholder">{score ? number(score.score) : "—"}<small>/100</small></div><div className={score ? `regime-${score.regime}` : "regime-neutral"}>{score ? score.regime.toUpperCase() : "NOT YET SCORED"}</div><p className="score-note">{score ? `Confidence ${number(score.confidence * 100, 0)}% · coverage ${number(score.coverage * 100, 0)}% · as of ${score.asOf.slice(0, 10)}` : "A regime is published only after empirical calibration, freshness checks and minimum cross-group coverage."}</p><div className="score-legend"><span><i className="bull"/> Bullish</span><span><i className="neutral"/> Neutral</span><span><i className="bear"/> Bearish</span></div></article>
    </section>
    <section className="panel drivers-panel"><div className="panel-heading"><div><h2>What drives the score</h2><p>Initial model architecture · weights are hypotheses, not validated parameters</p></div><span className="subtle-label">{score?.modelVersion ?? "MODEL V0.1"}</span></div><div className="driver-list">{groups.map((group) => { const value = componentMap.get(group.key); return <div className="driver-row" key={group.key}><div className="driver-name"><strong>{group.name}</strong><span>{group.detail}</span></div><span className="driver-weight">{group.weight}</span><div className="driver-track"><span style={{ width: value === null || value === undefined ? "0%" : `${Math.max(0, Math.min(100, value))}%` }}/></div><strong className="driver-score">{value === null || value === undefined ? "—" : number(value, 0)}</strong></div>; })}</div></section>
    <section className="notice"><ShieldAlert size={18}/><div><strong>Data integrity first</strong><p>No silver spot price, forecasts, backtest results or performance claims are fabricated. CFTC positioning is Tuesday-as-of data; every observation retains its source, timestamps, status and confidence.</p></div></section>
    {overview.updatedAt && <p className="muted" style={{ marginTop: 12, fontSize: 10 }}>Latest stored observation fetched: {overview.updatedAt}</p>}
  </div>;
}

import { ArrowDownRight, ArrowUpRight, Clock3, Database, Gauge, ShieldAlert, TrendingUp } from "lucide-react";

const metrics = [
  { label: "Silver spot", value: "$—", change: "Feed not connected", direction: "flat" },
  { label: "SilverScope score", value: "— / 100", change: "Awaiting verified inputs", direction: "flat" },
  { label: "COMEX inventory", value: "—", change: "Source not connected", direction: "flat" },
  { label: "Macro pressure", value: "—", change: "Source not connected", direction: "flat" }
];

const drivers = [
  { name: "Inventory & liquidity", weight: "30%", detail: "COMEX / LBMA stocks, curve and lease rates", score: "—" },
  { name: "Macro conditions", weight: "25%", detail: "USD, real yields and central-bank expectations", score: "—" },
  { name: "Supply & industrial demand", weight: "30%", detail: "Mine supply, recycling, solar and electronics", score: "—" },
  { name: "Market positioning", weight: "15%", detail: "CFTC positioning, ETF flows and volatility", score: "—" }
];

export default function DashboardPage() {
  return <div className="page-wrap">
    <div className="page-heading"><div><div className="eyebrow">MONDAY · RESEARCH WORKSPACE</div><h1>Market overview</h1><p>Understand what is moving silver — and what could change next.</p></div><span className="demo-tag"><span/> DEMO · NO LIVE FEED</span></div>
    <section className="metric-grid">{metrics.map((m) => <article className="metric-card" key={m.label}><div className="metric-label">{m.label}</div><div className="metric-value">{m.value}</div><div className="metric-change muted">{m.change}</div></article>)}</section>
    <section className="content-grid">
      <article className="panel chart-panel"><div className="panel-heading"><div><h2>Silver price context</h2><p>Spot reference · USD / troy oz</p></div><span className="range-chip">Chart pending data</span></div><div className="empty-chart"><div className="chart-icon"><TrendingUp size={25}/></div><strong>Connect a verified price feed</strong><span>Price history will appear here when a licensed or approved data source is configured.</span></div><div className="chart-foot"><span><Database size={13}/> Source: not connected</span><span><Clock3 size={13}/> Last update: —</span></div></article>
      <article className="panel score-panel"><div className="panel-heading"><div><h2>Market regime</h2><p>Composite model output</p></div><Gauge size={19} className="muted-icon"/></div><div className="score-placeholder">—<small>/100</small></div><div className="regime-neutral">NOT YET SCORED</div><p className="score-note">A market regime will be calculated after data ingestion, validation and model calibration.</p><div className="score-legend"><span><i className="bull"/> Bullish</span><span><i className="neutral"/> Neutral</span><span><i className="bear"/> Bearish</span></div></article>
    </section>
    <section className="panel drivers-panel"><div className="panel-heading"><div><h2>What drives the score</h2><p>Initial model architecture · weights are hypotheses, not validated parameters</p></div><span className="subtle-label">MODEL V0.1</span></div><div className="driver-list">{drivers.map((d) => <div className="driver-row" key={d.name}><div className="driver-name"><strong>{d.name}</strong><span>{d.detail}</span></div><span className="driver-weight">{d.weight}</span><div className="driver-track"><span/></div><strong className="driver-score">{d.score}</strong></div>)}</div></section>
    <section className="notice"><ShieldAlert size={18}/><div><strong>Data integrity first</strong><p>No market values, forecasts, backtest results or performance claims are fabricated in this demo. Each production observation will carry a source, timestamp, status and confidence level.</p></div></section>
  </div>;
}
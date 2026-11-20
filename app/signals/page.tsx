import { ShieldCheck } from "lucide-react";

const signals = [
  { title: "Inventory tightness", horizon: "Medium term", status: "Pending data", description: "Evaluate registered and eligible warehouse stocks, inventory change rates, lease rates and nearby spreads.", source: "COMEX · LBMA" },
  { title: "Macro impulse", horizon: "Short term", status: "Pending data", description: "Combine the US dollar, real yields and policy expectations after aligning observation timestamps.", source: "FRED · Treasury · CME" },
  { title: "Industrial demand", horizon: "Long term", status: "Pending data", description: "Track solar manufacturing, thrifting, substitution, electronics and automotive demand.", source: "Silver Institute · Industry data" },
  { title: "Futures positioning", horizon: "Weekly", status: "Adapter implemented", description: "Monitor COMEX standard Silver managed-money net positioning from the CFTC Disaggregated Futures Only report; Micro Silver and combined options data are excluded.", source: "CFTC · COMEX Silver 084691" }
];

export default function SignalsPage() {
  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">MODEL OUTPUT</div><h1>Market signals</h1><p>Transparent signal hypotheses, evidence and invalidation conditions.</p></div><span className="demo-tag"><span/> NOT LIVE</span></div>
    <div className="signal-summary"><div><span className="metric-label">Current composite signal</span><h2>Awaiting validated data</h2><p>The scoring and signal pipeline is implemented. Publishing remains gated on empirical calibration, fresh observations and minimum cross-group coverage.</p></div><div className="signal-lock"><ShieldCheck size={20}/><span>Evidence-led<br/>research workflow</span></div></div>
    <div className="signal-list">{signals.map(s=><article className="panel signal-card" key={s.title}><div className="signal-card-top"><div><span className="eyebrow">{s.horizon}</span><h2>{s.title}</h2></div><span className="pending-pill">{s.status}</span></div><p>{s.description}</p><div className="signal-meta"><span>Evidence sources: {s.source}</span><span>Confidence: unavailable</span></div></article>)}</div>
    <div className="notice"><ShieldCheck size={18}/><div><strong>No trade instruction is generated</strong><p>Future signals will include model version, time horizon, source evidence, confidence, data coverage and invalidation criteria. They are research outputs, not personalized investment advice.</p></div></div>
  </div>;
}

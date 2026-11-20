const plans = [
  { name: "Free", price: "$0", suffix: "forever", description: "Explore the research framework.", features: ["Core market dashboard","Selected indicator catalogue","Basic market explainers","Clearly labelled demo / delayed data"], action: "Start exploring", featured: false },
  { name: "Pro", price: "$29", suffix: "per month · proposed", description: "For active silver-market researchers.", features: ["Full composite score and history","Multi-horizon signal analysis","Indicator trends and explanations","Custom research alerts"], action: "Proposed plan", featured: true },
  { name: "Ultra", price: "$99", suffix: "per month · proposed", description: "For advanced scenario research.", features: ["Advanced scenario analysis","Strategy research workspace","Historical model evaluation","API access (planned)"], action: "Proposed plan", featured: false }
];

export default function PricingPage() {
  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">MEMBERSHIP</div><h1>Choose your research depth</h1><p>Transparent access tiers. Pricing is a validation hypothesis; checkout is not enabled.</p></div><span className="demo-tag"><span/> BILLING DISABLED</span></div>
    <div className="pricing-grid">{plans.map(p=><article className={`plan-card ${p.featured ? "plan-featured" : ""}`} key={p.name}>{p.featured&&<span className="popular-label">PROPOSED MOST POPULAR</span>}<h2>{p.name}</h2><p>{p.description}</p><div className="plan-price">{p.price}<small>{p.suffix}</small></div><ul>{p.features.map(f=><li key={f}><span>✓</span>{f}</li>)}</ul><button className={p.featured?"button-primary":"button-secondary"} disabled>{p.action} · coming soon</button></article>)}</div>
    <p className="pricing-footnote">All paid features, prices and entitlements are subject to validation. No payment is collected in this build. SilverScope provides general market research and does not provide personalized investment advice.</p>
  </div>;
}
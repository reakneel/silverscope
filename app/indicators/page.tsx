import { Database, Filter } from "lucide-react";

const groups = [
  { category: "Inventory & liquidity", items: [["COMEX registered stocks","oz","Warehouse inventory"],["COMEX eligible stocks","oz","Warehouse inventory"],["LBMA vault holdings","tonnes","Monthly inventory"],["Silver lease rate","%","Funding / physical tightness"],["Nearby futures spread","USD/oz","Term structure"]] },
  { category: "Macro", items: [["US Dollar Index","index","Currency conditions"],["US 10Y real yield","%","Opportunity cost"],["Fed policy expectations","probability","Policy pricing"],["Gold / silver ratio","ratio","Relative valuation"]] },
  { category: "Supply & demand", items: [["Mine production","tonnes","Primary supply"],["Recycling supply","tonnes","Secondary supply"],["Solar silver intensity","mg/W","PV demand and thrifting"],["Industrial demand","tonnes","Fabrication demand"]] },
  { category: "Positioning", items: [["CFTC managed money net","contracts","Futures positioning"],["Silver ETF holdings","tonnes","Investment flows"],["Implied volatility","%","Options market risk"]] }
];

export default function IndicatorsPage() {
  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">DATA CATALOGUE</div><h1>Market indicators</h1><p>Track the variables behind the silver market model.</p></div><span className="demo-tag"><span/> CATALOGUE · NOT CONNECTED</span></div>
    <div className="indicator-toolbar"><div className="search-placeholder"><Filter size={15}/> All categories</div><span className="muted">15 planned indicators · 0 connected feeds</span></div>
    {groups.map(g=><section className="panel indicator-panel" key={g.category}><div className="panel-heading"><div><h2>{g.category}</h2><p>{g.items.length} indicators planned</p></div></div><div className="table-wrap"><table><thead><tr><th>Indicator</th><th>Unit</th><th>Purpose</th><th>Latest value</th><th>Data status</th></tr></thead><tbody>{g.items.map(row=><tr key={row[0]}><td className="table-primary">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>—</td><td><span className="status-pending">Not connected</span></td></tr>)}</tbody></table></div></section>)}
    <div className="notice"><Database size={18}/><div><strong>Every observation will be traceable</strong><p>Production data records will include source, published_at, observed_at, fetched_at, unit, confidence and data_status (verified / estimated / manual / stale / unavailable).</p></div></div>
  </div>;
}
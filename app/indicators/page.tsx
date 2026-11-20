import { Database, Filter } from "lucide-react";
import { getMarketOverview } from "@/lib/data/market-overview";

const groups = [
  { category: "Price reference", items: [["Silver spot reference","USD/oz","Licensed provider reference; excluded from composite score"]] },
  { category: "Inventory & liquidity", items: [["COMEX registered stocks","oz","Warehouse inventory"],["COMEX eligible stocks","oz","Warehouse inventory"],["COMEX total stocks","oz","Registered + eligible inventory"],["LBMA vault holdings","tonnes","Monthly inventory"],["Silver lease rate","%","Funding / physical tightness"],["Nearby futures spread","USD/oz","Term structure"]] },
  { category: "Macro", items: [["Broad trade-weighted USD index","index","FRED broad USD proxy; not ICE DXY"],["US 10Y real yield","%","FRED DFII10 · opportunity cost"],["US 10Y nominal yield","%","FRED DGS10 · nominal rates"],["Fed policy expectations","probability","Policy pricing"],["Gold / silver ratio","ratio","Relative valuation"]] },
  { category: "Supply & demand", items: [["Mine production","tonnes","Primary supply"],["Recycling supply","tonnes","Secondary supply"],["Solar silver intensity","mg/W","PV demand and thrifting"],["Industrial demand","tonnes","Fabrication demand"]] },
  { category: "Positioning", items: [["CFTC managed money net","contracts","Futures positioning"],["Silver ETF holdings","tonnes","Investment flows"],["Implied volatility","%","Options market risk"]] }
];
const indicatorKeys: Record<string, string> = {
  "Broad trade-weighted USD index": "us_dollar_index",
  "US 10Y real yield": "us_10y_real_yield",
  "US 10Y nominal yield": "us_10y_nominal_yield",
  "CFTC managed money net": "cftc_managed_money_net",
  "COMEX registered stocks": "comex_registered_stocks",
  "COMEX eligible stocks": "comex_eligible_stocks",
  "COMEX total stocks": "comex_total_stocks",
  "Silver spot reference": "silver_spot_usd_oz",
};
const format = (value: number, unit: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: unit === "contracts" ? 0 : 2 }).format(value);

export default async function IndicatorsPage() {
  const overview = await getMarketOverview();
  const connectedCount = Object.keys(overview.observations).length;
  return <div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">DATA CATALOGUE</div><h1>Market indicators</h1><p>Track the variables behind the silver market model.</p></div><span className="demo-tag"><span/> {connectedCount ? "OBSERVATIONS AVAILABLE" : "CATALOGUE · NOT CONNECTED"}</span></div>
    <div className="indicator-toolbar"><div className="search-placeholder"><Filter size={15}/> All categories</div><span className="muted">19 planned indicators · {connectedCount} with stored observations</span></div>
    {groups.map(g=><section className="panel indicator-panel" key={g.category}><div className="panel-heading"><div><h2>{g.category}</h2><p>{g.items.length} indicators planned</p></div></div><div className="table-wrap"><table><thead><tr><th>Indicator</th><th>Unit</th><th>Purpose</th><th>Latest value</th><th>Data status</th></tr></thead><tbody>{g.items.map(row=>{const observationKey=indicatorKeys[row[0]];const observation=observationKey?overview.observations[observationKey]:undefined;return <tr key={row[0]}><td className="table-primary">{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{observation?format(observation.value,row[1]):"—"}</td><td><span className={observation?"status-verified":"status-pending"}>{observation?observation.status:"Not connected"}</span></td></tr>;})}</tbody></table></div></section>)}
    <div className="notice"><Database size={18}/><div><strong>Every observation is traceable</strong><p>Displayed values come from stored observations and retain source, published_at, observed_at, fetched_at, unit, confidence and data_status. No observation means no displayed market value.</p></div></div>
  </div>;
}

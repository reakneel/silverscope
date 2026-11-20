"use client";
import { useEffect, useState } from "react";
import { PortfolioIntradayChart } from "@/components/portfolio/intraday-chart";
type Holding={symbol:string;name:string;quantity:number;costBasis:number|null;marketValue:number|null;unrealizedPnl:number|null;unrealizedPnlPct:number|null;weightPct:number|null;valuationSource:string;currency:string};
type Summary={account:{id:string;display_name:string;provider:string;base_currency:string;status:string};valuation:{cash:number|null;positionsValue:number|null;totalAssets:number|null;completeness:number;status:string;currency:string};holdings:Holding[];positionsAsOf:string|null;cashAsOf:string|null;foreignCurrencyCashCount:number};
type State={summaries:Summary[]};
const money=(v:number|null,c:string)=>v===null?"—":new Intl.NumberFormat("zh-CN",{style:"currency",currency:c,maximumFractionDigits:2}).format(v);const pct=(v:number|null)=>v===null?"—":(v>=0?"+":"")+v.toFixed(2)+"%";
export function PortfolioDashboardPanel(){
 const[data,setData]=useState<State|null>(null);const[error,setError]=useState("");
 useEffect(()=>{fetch("/api/portfolio/dashboard",{cache:"no-store"}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error??"账户数据暂不可用");return b as State;}).then(setData).catch(e=>setError(e instanceof Error?e.message:"账户数据暂不可用"));},[]);
 if(error)return <section className="panel"><strong>真实账本尚不可用</strong><p className="muted">数据库迁移尚未部署，或账户数据尚未接入。系统不会用演示数据替代。</p></section>;
 if(!data)return <section className="panel"><p className="muted">正在读取账户账本…</p></section>;
 if(!data.summaries.length)return <section className="panel"><strong>暂无投资账户</strong><p className="muted">添加账户并导入经过验证的数据后，持仓和资产才会显示在这里。</p></section>;
 return <div className="portfolio-dashboard-list">{data.summaries.map(s=>{const c=s.account.base_currency;return <section className="panel" key={s.account.id}>
 <div className="panel-heading"><div><h2>{s.account.display_name}</h2><p>{s.account.provider.toUpperCase()} · {s.account.status.toUpperCase()} · {s.valuation.status.toUpperCase()}</p></div><span className="status-pending">{Math.round(s.valuation.completeness*100)}% VALUED</span></div>
 <div className="portfolio-preview-stats"><div><span>总资产</span><strong>{money(s.valuation.totalAssets,c)}</strong></div><div><span>持仓市值</span><strong>{money(s.valuation.positionsValue,c)}</strong></div><div><span>现金</span><strong>{money(s.valuation.cash,c)}</strong></div></div>
 <p className="muted portfolio-hash">持仓时点：{s.positionsAsOf??"—"} · 现金时点：{s.cashAsOf??"—"}</p>{s.foreignCurrencyCashCount>0&&<p className="auth-error">检测到其他币种现金；未取得汇率前不会折算进基础币种总资产。</p>}
 <PortfolioIntradayChart accountId={s.account.id} currency={c}/>
 <div className="table-wrap"><table><thead><tr><th>证券</th><th>代码</th><th>数量</th><th>成本价</th><th>市值</th><th>浮动盈亏</th><th>收益率</th><th>仓位</th></tr></thead><tbody>{s.holdings.map(h=><tr key={s.account.id+"-"+h.symbol}><td className="table-primary">{h.name}</td><td>{h.symbol}</td><td>{h.quantity.toLocaleString("zh-CN")}</td><td>{h.costBasis===null?"—":h.costBasis.toFixed(3)}</td><td>{money(h.marketValue,h.currency)}</td><td>{money(h.unrealizedPnl,h.currency)}</td><td>{pct(h.unrealizedPnlPct)}</td><td>{h.weightPct===null?"—":h.weightPct.toFixed(2)+"%"}</td></tr>)}{!s.holdings.length&&<tr><td colSpan={8}>暂无持仓快照</td></tr>}</tbody></table></div>
 <p className="muted portfolio-hash">估值仅使用真实账本快照；曲线只展示已持久化估值点。实时行情尚未配置时不会伪造日内走势。</p></section>;})}</div>;
}

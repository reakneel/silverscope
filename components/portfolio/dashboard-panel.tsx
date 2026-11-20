"use client";

import { useEffect, useState } from "react";

type Holding = {
  symbol: string; name: string; quantity: number; costBasis: number | null;
  marketValue: number | null; unrealizedPnl: number | null; unrealizedPnlPct: number | null;
  weightPct: number | null; valuationSource: string; currency: string;
};
type Summary = {
  account: { id: string; display_name: string; provider: string; base_currency: string; status: string };
  valuation: { cash: number | null; positionsValue: number | null; totalAssets: number | null; completeness: number; status: string; currency: string };
  holdings: Holding[];
  positionsAsOf: string | null;
  cashAsOf: string | null;
  foreignCurrencyCashCount: number;
};
type State = { summaries: Summary[] };

const money = (value: number | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const pct = (value: number | null) => value === null ? "—" : (value >= 0 ? "+" : "") + value.toFixed(2) + "%";

export function PortfolioDashboardPanel() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/portfolio/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "账户数据暂不可用");
        return body as State;
      })
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "账户数据暂不可用"));
  }, []);

  if (error) return <section className="panel"><strong>真实账本尚不可用</strong><p className="muted">数据库迁移尚未部署，或账户数据尚未接入。系统不会用演示数据替代。</p></section>;
  if (!data) return <section className="panel"><p className="muted">正在读取账户账本…</p></section>;
  if (!data.summaries.length) return <section className="panel"><strong>暂无投资账户</strong><p className="muted">添加华泰账户并导入经过验证的券商文件后，持仓和资产才会显示在这里。</p></section>;

  return <div className="portfolio-dashboard-list">
    {data.summaries.map((summary) => {
      const currency = summary.account.base_currency;
      return <section className="panel" key={summary.account.id}>
        <div className="panel-heading">
          <div><h2>{summary.account.display_name}</h2><p>{summary.account.provider.toUpperCase()} · {summary.account.status.toUpperCase()} · {summary.valuation.status.toUpperCase()}</p></div>
          <span className="status-pending">{Math.round(summary.valuation.completeness * 100)}% VALUED</span>
        </div>
        <div className="portfolio-preview-stats">
          <div><span>总资产</span><strong>{money(summary.valuation.totalAssets, currency)}</strong></div>
          <div><span>持仓市值</span><strong>{money(summary.valuation.positionsValue, currency)}</strong></div>
          <div><span>现金</span><strong>{money(summary.valuation.cash, currency)}</strong></div>
        </div>
        <p className="muted portfolio-hash">持仓时点：{summary.positionsAsOf ?? "—"} · 现金时点：{summary.cashAsOf ?? "—"}</p>
        {summary.foreignCurrencyCashCount > 0 && <p className="auth-error">检测到其他币种现金；未取得汇率前不会折算进基础币种总资产。</p>}
        <div className="table-wrap"><table><thead><tr><th>证券</th><th>代码</th><th>数量</th><th>成本价</th><th>市值</th><th>浮动盈亏</th><th>收益率</th><th>仓位</th></tr></thead><tbody>
          {summary.holdings.map((holding) => <tr key={summary.account.id + "-" + holding.symbol}>
            <td className="table-primary">{holding.name}</td><td>{holding.symbol}</td><td>{holding.quantity.toLocaleString("zh-CN")}</td>
            <td>{holding.costBasis === null ? "—" : holding.costBasis.toFixed(3)}</td>
            <td>{money(holding.marketValue, holding.currency)}</td>
            <td>{money(holding.unrealizedPnl, holding.currency)}</td><td>{pct(holding.unrealizedPnlPct)}</td>
            <td>{holding.weightPct === null ? "—" : holding.weightPct.toFixed(2) + "%"}</td>
          </tr>)}
          {!summary.holdings.length && <tr><td colSpan={8}>暂无持仓快照</td></tr>}
        </tbody></table></div>
        <p className="muted portfolio-hash">估值来源仅使用券商持仓快照；未接入实时行情或汇率时，缺失值保持空白。</p>
      </section>;
    })}
  </div>;
}

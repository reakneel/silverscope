"use client";

import { useEffect, useState } from "react";

type Trade = {
  id: string; event_type: string; trade_at: string | null; settled_at: string | null;
  quantity: number | string | null; unit_price: number | string | null; gross_amount: number | string | null;
  fees: number | string; taxes: number | string; currency: string; notes: string | null;
  instrument: { canonical_symbol: string; display_name: string; exchange: string } | null;
};
const labels: Record<string, string> = {
  buy: "买入", sell: "卖出", dividend: "分红", fee: "手续费", tax: "税费",
  deposit: "入金", withdrawal: "出金", transfer_in: "转入", transfer_out: "转出",
  split: "拆股", bonus_share: "送股", rights_issue: "配股", other: "其他",
};
const num = (value: number | string | null) => value === null ? "—" : Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 4 });
const money = (value: number | string | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));

export function PortfolioTradesPanel() {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/portfolio/trades", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "交易记录暂不可用");
        return body.transactions as Trade[];
      })
      .then(setTrades)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "交易记录暂不可用"));
  }, []);

  return <section className="panel portfolio-trades">
    <div className="panel-heading"><div><h2>交易与资金流水</h2><p>来源为券商成交、资金流水和公司行为记录。</p></div></div>
    {error ? <p className="muted">真实交易账本暂不可用；不会显示模拟成交。</p>
      : trades === null ? <p className="muted">正在读取交易记录…</p>
      : !trades.length ? <p className="muted">暂无已导入的真实成交或资金流水。</p>
      : <div className="table-wrap"><table><thead><tr><th>日期</th><th>类型</th><th>证券</th><th>代码</th><th>数量</th><th>价格</th><th>金额</th><th>费用</th><th>税费</th><th>币种</th></tr></thead><tbody>
        {trades.map((trade) => <tr key={trade.id}>
          <td>{trade.trade_at ? new Date(trade.trade_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "—"}</td>
          <td>{labels[trade.event_type] ?? trade.event_type}</td>
          <td className="table-primary">{trade.instrument?.display_name ?? "—"}</td>
          <td>{trade.instrument?.canonical_symbol ?? "—"}</td>
          <td>{num(trade.quantity)}</td><td>{num(trade.unit_price)}</td>
          <td>{money(trade.gross_amount, trade.currency)}</td><td>{money(trade.fees, trade.currency)}</td><td>{money(trade.taxes, trade.currency)}</td><td>{trade.currency}</td>
        </tr>)}
      </tbody></table></div>}
  </section>;
}

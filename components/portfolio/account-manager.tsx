"use client";

import { useEffect, useState } from "react";

type Account = { id: string; provider: string; account_kind: string; display_name: string; account_ref_masked: string | null; base_currency: string; markets: string[]; status: string };
const labels: Record<string, string> = { huatai: "华泰证券", tonghuashun: "同花顺", other_broker: "其他券商", xueqiu: "雪球组合" };

export function PortfolioAccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [provider, setProvider] = useState("huatai");
  const [displayName, setDisplayName] = useState("华泰证券账户");
  const [maskedRef, setMaskedRef] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/portfolio/accounts", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "账户列表暂不可用");
    setAccounts(result.accounts ?? []);
  }
  useEffect(() => { load().catch((cause) => setError(cause instanceof Error ? cause.message : "账户列表暂不可用")); }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/portfolio/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, displayName, maskedAccountRef: maskedRef || null, baseCurrency: "CNY", markets: ["CN"] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "创建账户失败");
      setAccounts((current) => [result.account, ...current]);
      setMaskedRef("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建账户失败"); }
    finally { setBusy(false); }
  }

  return <section className="panel">
    <div className="panel-heading"><div><h2>数据账户</h2><p>只保存账户别名和脱敏标识，不收集交易密码或登录凭证。</p></div></div>
    <form className="account-create-form" onSubmit={create}>
      <label className="auth-field">数据来源
        <select className="auth-input" value={provider} onChange={(event) => { setProvider(event.target.value); setDisplayName(event.target.value === "xueqiu" ? "雪球组合" : labels[event.target.value] + "账户"); }}>
          <option value="huatai">华泰证券（真实券商账本）</option>
          <option value="tonghuashun">同花顺（导出渠道）</option>
          <option value="other_broker">其他券商</option>
          <option value="xueqiu">雪球组合（独立策略数据）</option>
        </select>
      </label>
      <label className="auth-field">账户 / 组合名称
        <input className="auth-input" value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required />
      </label>
      <label className="auth-field">脱敏标识（可选）
        <input className="auth-input" value={maskedRef} maxLength={40} placeholder="例如：尾号 ****1234" onChange={(event) => setMaskedRef(event.target.value)} />
      </label>
      <button className="button-secondary" disabled={busy}>{busy ? "保存中…" : "添加数据账户"}</button>
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="portfolio-account-list">
      {accounts.map((account) => <div className="portfolio-source-row" key={account.id}>
        <strong>{account.display_name}</strong><span className="status-pending">{account.status.toUpperCase()}</span>
        <p>{labels[account.provider] ?? account.provider} · {account.account_kind === "social_portfolio" ? "策略组合（不计入券商资产）" : "券商账户"} · {account.base_currency} · {account.markets.join("/")}</p>
      </div>)}
      {!accounts.length && <p className="muted">尚无账户。数据库结构部署后可在此创建账户。</p>}
    </div>
  </section>;
}

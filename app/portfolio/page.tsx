import Link from "next/link";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { HuataiImportPanel } from "@/components/portfolio/huatai-import-panel";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getCurrentSupabaseUser();
  return <div className="page-wrap">
    <div className="page-heading">
      <div><div className="eyebrow">PERSONAL ACCOUNT WORKSPACE</div><h1>Portfolio</h1><p>Brokerage ledger, source reconciliation and portfolio performance.</p></div>
      <span className="demo-tag"><span/> REAL DATA ONLY</span>
    </div>
    <section className="metric-grid portfolio-metrics">
      <article className="metric-card"><div className="metric-label">Account assets</div><div className="metric-value">—</div><div className="metric-change muted">Not connected · no fabricated values</div></article>
      <article className="metric-card"><div className="metric-label">Holdings</div><div className="metric-value">—</div><div className="metric-change muted">Awaiting verified broker snapshot</div></article>
      <article className="metric-card"><div className="metric-label">Cash balance</div><div className="metric-value">—</div><div className="metric-change muted">Awaiting broker cash statement</div></article>
      <article className="metric-card"><div className="metric-label">Portfolio return</div><div className="metric-value">—</div><div className="metric-change muted">Requires reconciled ledger and quotes</div></article>
    </section>
    {!user ? <section className="panel"><h2>Sign in to continue</h2><p className="muted">Portfolio accounts and imported statements are private to the signed-in user.</p><Link className="button-primary portfolio-link" href="/login">Sign in</Link></section> : <>
      <section className="notice"><strong>Account data is not connected</strong><p>There are no verified Huatai holdings, cash balances or executions in this workspace yet. Values remain blank until source statements are imported and reconciled.</p></section>
      <div className="portfolio-grid">
        <HuataiImportPanel />
        <section className="panel"><div className="panel-heading"><div><h2>Source status</h2><p>Brokerage and social portfolio sources are kept separate.</p></div></div>
          <div className="portfolio-source-row"><strong>华泰证券</strong><span className="status-pending">NOT CONNECTED</span><p>Expected source: broker statements, executions, stock balance and cash ledger.</p></div>
          <div className="portfolio-source-row"><strong>同花顺</strong><span className="status-pending">EXPORT CHANNEL</span><p>Can be used to obtain broker-linked exports; it is not treated as an independent custodian ledger.</p></div>
          <div className="portfolio-source-row"><strong>雪球组合</strong><span className="status-pending">SEPARATE DATASET</span><p>Strategy portfolio and rebalance history will not be included in brokerage assets or actual P&amp;L.</p></div>
        </section>
      </div>
    </>}
  </div>;
}

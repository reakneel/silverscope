import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bell, ChartNoAxesCombined, CircleDollarSign, LayoutDashboard, RadioTower, WalletCards } from "lucide-react";
import "./globals.css";
import { SessionMenu } from "@/components/auth/session-menu";

export const metadata: Metadata = {
  title: "SilverScope — Silver Market Intelligence",
  description: "A research workspace for understanding silver market structure, inventory, macro and industrial demand."
};

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/signals", label: "Signals", icon: RadioTower },
  { href: "/indicators", label: "Indicators", icon: ChartNoAxesCombined },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/pricing", label: "Plans", icon: CircleDollarSign }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link href="/" className="brand"><span className="brand-mark">S</span><span>Silver<span className="brand-light">Scope</span><small>MARKET INTELLIGENCE</small></span></Link>
            <div className="nav-label">WORKSPACE</div>
            <nav>{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="nav-link"><Icon size={17}/>{label}</Link>)}</nav>
            <div className="sidebar-bottom">
              <div className="status-dot"/><span>Research workspace</span>
              <p>Data feeds are not connected. Values remain blank until a verified source is available.</p>
            </div>
          </aside>
          <main className="main-area">
            <header className="topbar"><div className="mobile-brand">SilverScope</div><div className="topbar-right"><span className="market-pill"><Activity size={14}/> MARKET MONITOR</span><button className="icon-button" aria-label="Notifications"><Bell size={17}/></button><SessionMenu authConfigured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)} /></div></header>
            {children}
            <footer className="footer">SilverScope is a market research tool, not investment advice. Market and portfolio values are shown only when source data is available and verified.</footer>
          </main>
        </div>
      </body>
    </html>
  );
}
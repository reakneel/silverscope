import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bell, ChartNoAxesCombined, CircleDollarSign, LayoutDashboard, RadioTower } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SilverScope — Silver Market Intelligence",
  description: "A research workspace for understanding silver market structure, inventory, macro and industrial demand."
};

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/signals", label: "Signals", icon: RadioTower },
  { href: "/indicators", label: "Indicators", icon: ChartNoAxesCombined },
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
              <div className="status-dot"/><span>Research demo environment</span>
              <p>Data feeds are not connected. Values shown are illustrative only.</p>
            </div>
          </aside>
          <main className="main-area">
            <header className="topbar"><div className="mobile-brand">SilverScope</div><div className="topbar-right"><span className="market-pill"><Activity size={14}/> MARKET MONITOR</span><button className="icon-button" aria-label="Notifications"><Bell size={17}/></button><div className="avatar">SS</div></div></header>
            {children}
            <footer className="footer">SilverScope is a market research tool, not investment advice. Demo values are illustrative and are not live market data.</footer>
          </main>
        </div>
      </body>
    </html>
  );
}
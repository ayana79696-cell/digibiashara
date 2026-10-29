import Link from 'next/link';

const modules = [
  { icon: '▦', title: 'Stock across branches', body: 'Know what is available in every shop, with movement history and low-stock alerts.' },
  { icon: '↗', title: 'Sales that reconcile', body: 'Track cash and M-Pesa collections, receipt references, and staff performance.' },
  { icon: '⌖', title: 'Accountable attendance', body: 'Capture check-in/out times and branch location with a configurable radius.' },
];

export default function Home() {
  return (
    <main className="bp-home">
      <div className="bp-glow bp-glow-one" />
      <div className="bp-glow bp-glow-two" />
      <header className="bp-home-header">
        <Link href="/" className="bp-brand" aria-label="BranchPilot home">
          <span className="bp-brand-mark">B<span>↗</span></span>
          <span><strong>BranchPilot</strong><small>RETAIL CONTROL CENTER</small></span>
        </Link>
        <nav className="bp-public-nav">
          <a href="#features">Platform features</a>
          <Link href="/login" className="bp-admin-link">DigiBiashara admin ↗</Link>
        </nav>
      </header>

      <section className="bp-hero">
        <div className="bp-hero-copy">
          <div className="bp-eyebrow"><span className="bp-live-dot" /> BUILT FOR KENYAN RETAILERS</div>
          <h1>Every shop.<br /><em>One clear view.</em></h1>
          <p className="bp-hero-lead">Run your branches with confidence. Keep sales, stock, staff and M-Pesa records connected in one simple workspace.</p>
          <div className="bp-login-choices">
            <Link href="/owner/login" className="bp-choice bp-choice-owner">
              <span className="bp-choice-icon">↗</span>
              <span className="bp-choice-copy"><strong>Owner login</strong><small>Manage branches, stock, staff and reports</small></span>
              <span className="bp-choice-arrow">→</span>
            </Link>
            <Link href="/employee/login" className="bp-choice bp-choice-employee">
              <span className="bp-choice-icon">▣</span>
              <span className="bp-choice-copy"><strong>Employee login</strong><small>Check in, make sales and print receipts</small></span>
              <span className="bp-choice-arrow">→</span>
            </Link>
          </div>
          <p className="bp-home-note"><span>●</span> Secure sign-in · Branch-level access · Data saved to your business</p>
        </div>

        <div className="bp-hero-visual" aria-label="Branch sales overview illustration">
          <div className="bp-dashboard-preview">
            <div className="bp-preview-top"><div><span className="bp-mini-mark">B</span><b>Branch overview</b></div><span className="bp-preview-date">TODAY ↗</span></div>
            <div className="bp-preview-title">Your business, in focus.</div>
            <div className="bp-preview-metrics">
              <div><small>NET SALES</small><strong>KSh 84,320</strong><em>Across branches</em></div>
              <div><small>COLLECTED</small><strong>KSh 78,900</strong><em>Cash + M-Pesa</em></div>
            </div>
            <div className="bp-preview-chart"><div className="bp-chart-meta"><b>Sales activity</b><span>Mon — Sun</span></div><div className="bp-chart-bars">{[35,53,42,76,59,88,67,95,63,78,51,84,71,100,61,82,47,73].map((h,i)=><span key={i} style={{height: h+'%'}} />)}</div><div className="bp-chart-days"><span>MON</span><span>WED</span><span>FRI</span><span>SUN</span></div></div>
            <div className="bp-preview-branches"><div><span className="bp-branch-pin">N</span><span><b>Nakuru branch</b><small>Inventory synced</small></span><strong>+12.8%</strong></div><div><span className="bp-branch-pin bp-branch-pin-alt">N</span><span><b>Naivasha branch</b><small>Inventory synced</small></span><strong>+8.4%</strong></div></div>
            <div className="bp-preview-footer"><span><i /> RECORDS SYNCED</span><span>Updated moments ago</span></div>
          </div>
          <div className="bp-float-card bp-float-mpesa"><span className="bp-float-icon">M</span><span><small>M-PESA RECEIVED</small><b>KSh 12,500</b></span><span className="bp-float-check">✓</span></div>
          <div className="bp-float-card bp-float-stock"><span className="bp-stock-icon">▦</span><span><small>STOCK ALERT</small><b>3 items need restocking</b></span></div>
          <div className="bp-orbit bp-orbit-one" /><div className="bp-orbit bp-orbit-two" />
        </div>
      </section>

      <section id="features" className="bp-features">
        <div className="bp-features-heading"><div className="bp-eyebrow">A BETTER WAY TO RUN RETAIL</div><h2>Built around the work<br />your shops do every day.</h2></div>
        <div className="bp-feature-grid">{modules.map((m)=><article className="bp-feature-card" key={m.title}><span className="bp-feature-icon">{m.icon}</span><h3>{m.title}</h3><p>{m.body}</p></article>)}</div>
      </section>
      <footer className="bp-home-footer"><span>© {new Date().getFullYear()} BranchPilot</span><span>Retail operations made clearer.</span><Link href="/login">DigiBiashara platform administrator</Link></footer>
    </main>
  );
}

import Link from 'next/link';

const features = [
  { icon: '🛒', title: 'Sales & POS', text: 'Record sales and serve customers faster.' },
  { icon: '📦', title: 'Inventory', text: 'Know what is in stock and what needs restocking.' },
  { icon: '💳', title: 'Finance', text: 'Track money in, expenses, and balances.' },
  { icon: '📊', title: 'Reports', text: 'See how your business is performing.' },
];

export default function Home() {
  return <main className="db-home">
    <header className="db-header">
      <Link href="/" className="db-brand"><img src="/digibiashara-logo.svg" alt="DigiBiashara — Grow Your Business" /></Link>
      <nav className="db-links"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#about">About</a></nav>
      <div className="db-header-actions"><Link className="db-signin" href="/login">Login</Link><Link className="db-cta db-cta-small" href="/login">Get Started <span>→</span></Link></div>
    </header>

    <section className="db-hero">
      <div className="db-hero-copy">
        <div className="db-kicker"><span /> BUSINESS MANAGEMENT, REIMAGINED</div>
        <h1>Grow Your Business<br/>Smarter with<br/><em>DigiBiashara</em></h1>
        <p className="db-hero-lead">The all-in-one business management platform for Kenyan businesses. Manage sales, inventory, finance, and more — from one simple workspace.</p>
        <div className="db-hero-actions"><Link href="/login" className="db-cta">Get Started <span>→</span></Link><a href="#features" className="db-outline">Explore Features</a></div>
        <div className="db-trust-row"><span>✓ Easy to use</span><i/><span>◈ Secure workspace</span><i/><span>▣ Access anywhere</span></div>
      </div>
      <div className="db-hero-visual" aria-label="DigiBiashara helps business owners manage their business on the go">
        <div className="db-orbit db-orbit-one"/><div className="db-orbit db-orbit-two"/>
        <div className="db-photo-frame"><img src="/digibiashara-hero.svg" alt="Woman using her phone in her shop" /></div>
        <div className="db-float-card db-sales-float"><small>Today's sales</small><strong>KSh 248,750</strong><span>↗ Growing your business</span><div className="db-mini-chart"><b/><b/><b/><b/><b/><b/><b/></div></div>
        <div className="db-float-card db-stock-float"><span className="db-alert-dot">!</span><div><strong>Stock alert</strong><small>2 items need attention</small></div></div>
        <div className="db-gold-swoosh"/>
      </div>
    </section>

    <section className="db-features" id="features">
      <div className="db-section-head"><div className="db-kicker">EVERYTHING YOU NEED</div><h2>One workspace. <em>More possibilities.</em></h2><p>Run your business confidently with connected tools designed for real growth.</p></div>
      <div className="db-feature-grid">{features.map((f) => <article className="db-feature" key={f.title}><div className="db-feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
    </section>
    <section className="db-bottom-cta" id="how-it-works"><div><div className="db-kicker">READY WHEN YOU ARE</div><h2>Your business. Your goals.<br/><em>One smarter workspace.</em></h2></div><Link href="/login" className="db-cta">Open DigiBiashara <span>→</span></Link></section>
    <footer className="db-footer" id="about"><span>© 2026 DigiBiashara</span><span>Grow Your Business · Powered by Digital Kingdom Solutions</span><Link href="/login">Sign in →</Link></footer>
  </main>;
}

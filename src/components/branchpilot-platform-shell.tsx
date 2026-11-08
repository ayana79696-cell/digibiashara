'use client';

import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sections = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'businesses', label: 'Businesses', icon: '▦' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '◷' },
  { id: 'plans', label: 'Plans & pricing', icon: '◇' },
];

export default function BranchPilotPlatformShell({
  children,
  title,
  subtitle,
  activeSection,
  email,
  onSectionChange,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  activeSection: string;
  email?: string;
  onSectionChange?: (section: string) => void;
  actions?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function openSection(id: string) {
    setMenuOpen(false);
    if (onSectionChange) {
      onSectionChange(id);
      return;
    }
    window.location.href = '/admin?section=' + encodeURIComponent(id);
  }

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      await createClient(url, key, { auth: { persistSession: true } }).auth.signOut();
    }
    localStorage.removeItem('digibiashara_active_business_id');
    window.location.href = '/login';
  }

  return (
    <main className="bp-platform-workspace">
      <button
        type="button"
        className="bp-platform-mobile-toggle"
        aria-expanded={menuOpen}
        aria-controls="bp-platform-sidebar"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? '✕ Close menu' : '☰ Menu'}
      </button>
      <aside id="bp-platform-sidebar" className={'bp-platform-sidebar' + (menuOpen ? ' is-open' : '')}>
        <Link href="/" className="bp-platform-brand" onClick={() => setMenuOpen(false)}>
          <img src="/digibiashara-logo.svg" alt="DigiBiashara" />
          <span><strong>DigiBiashara</strong><small>BRANCHPILOT PLATFORM</small></span>
        </Link>
        <div className="bp-platform-section-label">PLATFORM CONTROL</div>
        <nav className="bp-platform-nav" aria-label="Platform administration">
          {sections.map((item) => (
            <button
              type="button"
              key={item.id}
              className={activeSection === item.id ? 'active' : ''}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={() => openSection(item.id)}
            >
              <span className="bp-platform-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div className="bp-platform-section-label bp-platform-section-label-spaced">MASTER DATA</div>
          <Link
            href="/admin/templates"
            className={activeSection === 'templates' ? 'active' : ''}
            aria-current={activeSection === 'templates' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <span className="bp-platform-nav-icon">▧</span>
            <span>Categories & templates</span>
          </Link>
        </nav>
        <div className="bp-platform-sidebar-foot">
          <div className="bp-platform-user-mark">BP</div>
          <div className="bp-platform-user-copy">
            <strong>Platform administrator</strong>
            <small>{email || 'Secure admin session'}</small>
          </div>
          <button type="button" onClick={signOut} aria-label="Sign out">↗</button>
        </div>
      </aside>
      {menuOpen && <button type="button" className="bp-platform-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <section className="bp-platform-main">
        <header className="bp-platform-topbar">
          <div className="bp-platform-heading">
            <div className="bp-platform-eyebrow"><span /> DIGIBIASHARA / BRANCHPILOT / ADMINISTRATION</div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="bp-platform-actions">
            <span className="bp-platform-live"><i /> Platform connected</span>
            {actions}
          </div>
        </header>
        {children}
        <footer className="bp-platform-footer">
          <span>DigiBiashara · BranchPilot platform administration</span>
          <span>Kenya / KSh / Africa-Nairobi</span>
        </footer>
      </section>
    </main>
  );
}

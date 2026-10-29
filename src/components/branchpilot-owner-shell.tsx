'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const links = [
  ['Dashboard','/admin/dashboard','◫'],
  ['Branches','/admin/branches','⌖'],
  ['Products','/admin/products','▦'],
  ['Inventory','/admin/inventory','▤'],
  ['Stock transfers','/admin/transfers','↔'],
  ['Sales & M-Pesa','/admin/sales','↗'],
  ['Employees','/admin/employees','♙'],
  ['Attendance','/admin/attendance','◷'],
  ['Expenses','/admin/expenses','↘'],
  ['Reports','/admin/reports','▧'],
  ['Analytics','/admin/analytics','⌁'],
  ['Notifications','/admin/notifications','♧'],
  ['Audit log','/admin/audit-log','≡'],
  ['Settings','/admin/settings','⚙'],
];

export default function BranchPilotOwnerShell({ children, title, subtitle, businessName, email, actions }: {
  children: ReactNode; title: string; subtitle?: string; businessName?: string; email?: string; actions?: ReactNode;
}) {
  const pathname = usePathname();
  async function signOut() {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (u && k) await createClient(u,k).auth.signOut();
    localStorage.removeItem('digibiashara_active_business_id');
    location.href = '/';
  }
  return <main className="bp-workspace">
    <aside className="bp-sidebar">
      <Link href="/" className="bp-sidebar-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>OWNER CONTROL CENTER</small></span></Link>
      <div className="bp-side-label">OPERATIONS</div>
      <nav className="bp-side-links">{links.slice(0,8).map(([label,href,icon])=><Link key={href} className={pathname===href?'active':''} href={href}><span>{icon}</span>{label}</Link>)}
        <div className="bp-side-label">BUSINESS CONTROL</div>
        {links.slice(8).map(([label,href,icon])=><Link key={href} className={pathname===href?'active':''} href={href}><span>{icon}</span>{label}</Link>)}
        <div className="bp-side-label">EXISTING DIGIBIASHARA FEATURES</div>
        <Link href="/businesses" className={pathname==='/businesses'?'active':''}><span>▣</span>Business setup & categories</Link>
        <Link href="/business" className={pathname==='/business'?'active':''}><span>⌂</span>Legacy workspace</Link>
      </nav>
      <div className="bp-side-bottom"><span className="bp-side-avatar">BP</span><div><b>{businessName || 'Your business'}</b><small>{email || 'Owner account'}</small></div><button onClick={signOut}>Sign out</button></div>
    </aside>
    <section className="bp-main">
      <header className="bp-topbar"><div><div className="bp-eyebrow">BRANCHPILOT / {title.toUpperCase()}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="bp-topbar-actions"><span className="bp-pill">{businessName || 'Business workspace'}</span>{actions}</div></header>
      {children}
      <footer style={{marginTop:28,color:'#98a398',fontSize:10}}>BranchPilot · Retail operations workspace <span style={{padding:'0 6px'}}>•</span> Existing business categories and platform administration remain available in DigiBiashara.</footer>
    </section>
  </main>;
}

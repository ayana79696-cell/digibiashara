'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const links = [
  ['Dashboard','/admin/dashboard','◫'],['Branches','/admin/branches','⌖'],['Products','/admin/products','▦'],['Inventory','/admin/inventory','▤'],['Stock transfers','/admin/transfers','↔'],['Sales & M-Pesa','/admin/sales','↗'],['Employees','/admin/employees','♙'],['Attendance','/admin/attendance','◷'],['Expenses','/admin/expenses','↘'],['Reports','/admin/reports','▧'],['Analytics','/admin/analytics','⌁'],['Notifications','/admin/notifications','♧'],['Audit log','/admin/audit-log','≡'],['Settings','/admin/settings','⚙'],
];

export default function BranchPilotOwnerShell({ children, title, subtitle, businessName, businessLogo, email, actions }: {
  children: ReactNode; title: string; subtitle?: string; businessName?: string; businessLogo?: string; email?: string; actions?: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen,setMenuOpen] = useState(false);
  async function signOut() {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (u && k) await createClient(u,k).auth.signOut();
    localStorage.removeItem('digibiashara_active_business_id');
    location.href = '/';
  }
  return <main className="bp-workspace">
    <button className="bp-mobile-menu" onClick={()=>setMenuOpen(v=>!v)} aria-label="Toggle navigation">{menuOpen?'✕':'☰'} <span>Menu</span></button>
    <aside className={`bp-sidebar ${menuOpen?'bp-sidebar-open':''}`}>
      <Link href="/" className="bp-sidebar-brand"><img src="/digibiashara-logo.svg" alt="DigiBiashara" /><span><strong>DigiBiashara</strong><small>RETAIL MANAGEMENT</small></span></Link>
      <div className="bp-side-label">OPERATIONS</div>
      <nav className="bp-side-links">{links.slice(0,8).map(([label,href,icon])=><Link key={href} onClick={()=>setMenuOpen(false)} className={pathname===href?'active':''} href={href}><span>{icon}</span>{label}</Link>)}
        <div className="bp-side-label">BUSINESS CONTROL</div>
        {links.slice(8).map(([label,href,icon])=><Link key={href} onClick={()=>setMenuOpen(false)} className={pathname===href?'active':''} href={href}><span>{icon}</span>{label}</Link>)}
        <div className="bp-side-label">PLATFORM FEATURES</div>
        <Link onClick={()=>setMenuOpen(false)} href="/businesses" className={pathname==='/businesses'?'active':''}><span>▣</span>Business setup & categories</Link>
        <Link onClick={()=>setMenuOpen(false)} href="/business" className={pathname==='/business'?'active':''}><span>⌂</span>Legacy workspace</Link>
      </nav>
      <div className="bp-side-bottom"><span className="bp-side-avatar">{businessLogo?<img src={businessLogo} alt="Business logo" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:10}}/>:'DB'}</span><div><b>{businessName||'Your business'}</b><small>{email||'Owner account'}</small></div><button onClick={signOut}>Sign out</button></div>
    </aside>
    <section className="bp-main">
      <header className="bp-topbar"><div><div className="bp-eyebrow">DIGIBIASHARA / {title.toUpperCase()}</div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><div className="bp-topbar-actions"><span className="bp-pill">{businessName||'Business workspace'}</span>{actions}</div></header>
      {children}
      <footer style={{marginTop:28,color:'#8292a3',fontSize:10}}>DigiBiashara · Retail management workspace <span style={{padding:'0 6px'}}>•</span> Platform administration and business categories remain available.</footer>
    </section>
  </main>;
}
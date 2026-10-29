'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

type AccountType = 'owner' | 'employee';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = () => url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export default function BranchPilotLogin({ accountType }: { accountType: AccountType }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const owner = accountType === 'owner';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase();
    if (!db) { setMessage('Secure sign-in is not configured. Contact your system administrator.'); return; }
    setBusy(true); setMessage('');
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) {
      setMessage(error?.message === 'Invalid login credentials' ? 'Email or password is incorrect. Check the details and try again.' : (error?.message || 'Sign-in could not be completed.'));
      setBusy(false); return;
    }
    const { data: memberships, error: membershipError } = await db.from('business_memberships')
      .select('business_id,role,is_active')
      .eq('user_id', data.user.id).eq('is_active', true);
    if (membershipError || !memberships?.length) {
      await db.auth.signOut();
      setMessage('This login is not attached to an active business. Ask the owner or platform administrator for help.');
      setBusy(false); return;
    }
    const normalized = memberships.map((m: any) => ({ ...m, role: String(m.role || '').toLowerCase() }));
    if (owner) {
      const own = normalized.find((m: any) => ['owner','business_owner','admin'].includes(m.role));
      if (!own) {
        await db.auth.signOut();
        setMessage('This is not an Owner account. Use Employee login, or ask your owner to update your access.');
        setBusy(false); return;
      }
      localStorage.setItem('digibiashara_active_business_id', own.business_id);
      const [{ data: business }, { data: subscription }] = await Promise.all([
        db.from('businesses').select('status').eq('id', own.business_id).maybeSingle(),
        db.from('business_subscriptions').select('status,paid_until').eq('business_id', own.business_id).maybeSingle(),
      ]);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
      const paid = subscription?.status === 'paid' && !!subscription?.paid_until && subscription.paid_until >= today;
      if (business?.status === 'suspended' || business?.status === 'closed') {
        setMessage('This business workspace is suspended or closed. Contact platform support.');
        setBusy(false); return;
      }
      if (!paid && business?.status !== 'active') {
        router.push('/businesses'); setBusy(false); return;
      }
      router.push('/admin/dashboard'); return;
    }
    const employee = await db.from('employees').select('id,business_id,branch_id,is_active')
      .eq('user_id', data.user.id).eq('is_active', true).maybeSingle();
    if (employee.error || !employee.data) {
      await db.auth.signOut();
      setMessage('No active branch assignment was found for this employee account. Ask the owner to assign your branch.');
      setBusy(false); return;
    }
    const member = normalized.find((m: any) => m.business_id === employee.data.business_id && !['owner','business_owner','admin'].includes(m.role));
    if (!member) {
      await db.auth.signOut();
      setMessage('This login is not authorized as an employee for the assigned business.');
      setBusy(false); return;
    }
    localStorage.setItem('digibiashara_active_business_id', employee.data.business_id);
    router.push('/employee/dashboard');
  }

  return <main className="bp-auth-page">
    <section className="bp-auth-card">
      <Link href="/" className="bp-auth-back">← Back to BranchPilot</Link>
      <div className="bp-auth-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>{owner ? 'OWNER WORKSPACE' : 'EMPLOYEE WORKSPACE'}</small></span></div>
      <span className="bp-auth-icon">{owner ? '↗' : '▣'}</span>
      <h1>{owner ? 'Welcome back, Owner.' : 'Your shift starts here.'}</h1>
      <p>{owner ? 'Sign in to oversee branches, team activity, stock and sales from one place.' : 'Sign in to check in at your assigned branch, record sales and access your shift.'}</p>
      <form onSubmit={submit}>
        <label htmlFor="bp-email">Email address</label>
        <input id="bp-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.co.ke" />
        <label htmlFor="bp-password">Password</label>
        <input id="bp-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
        {message && <p className="bp-auth-message" role="alert">{message}</p>}
        <button className="bp-auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying secure access…' : owner ? 'Enter owner workspace →' : 'Enter employee workspace →'}</button>
      </form>
      {owner
        ? <Link className="bp-auth-switch" href="/businesses">New business or business setup? Continue to business setup →</Link>
        : <Link className="bp-auth-switch" href="/owner/login">Are you the business owner? Owner login →</Link>}
      <div className="bp-auth-hint">Sign-in access is verified against your saved business role and branch assignment. Your records remain in the business database.</div>
    </section>
  </main>;
}

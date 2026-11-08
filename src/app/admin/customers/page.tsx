'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import BranchPilotOwnerShell from '@/components/branchpilot-owner-shell';

type Customer = { id: string; name: string; phone: string | null; email: string | null; notes: string | null; created_at: string };
const client = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
};

export default function BranchPilotCustomersPage() {
  const router = useRouter();
  const [db, setDb] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  async function load(connection: any, userId: string) {
    setError('');
    const selected = typeof window !== 'undefined' ? localStorage.getItem('digibiashara_active_business_id') : null;
    let query = connection.from('business_memberships')
      .select('business_id,role,is_active')
      .eq('user_id', userId).eq('is_active', true)
      .in('role', ['owner', 'business_owner', 'admin']);
    if (selected) query = query.eq('business_id', selected);
    const { data: membership, error: membershipError } = await query.limit(1).maybeSingle();
    if (membershipError || !membership) {
      setError(membershipError?.message || 'Owner access is required for customer records.');
      setLoading(false);
      return;
    }
    const [{ data: businessRow, error: businessError }, customerResult] = await Promise.all([
      connection.from('businesses').select('id,name,logo_url').eq('id', membership.business_id).maybeSingle(),
      connection.from('customers').select('id,name,phone,email,notes,created_at')
        .eq('business_id', membership.business_id).order('created_at', { ascending: false }),
    ]);
    if (businessError || !businessRow) {
      setError(businessError?.message || 'The selected business could not be loaded.');
      setLoading(false);
      return;
    }
    if (customerResult.error) {
      setError('Customer records could not be loaded: ' + customerResult.error.message);
      setLoading(false);
      return;
    }
    setBusiness(businessRow);
    setRows((customerResult.data || []) as Customer[]);
    localStorage.setItem('digibiashara_active_business_id', businessRow.id);
    setLoading(false);
  }

  useEffect(() => {
    const connection = client();
    if (!connection) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setDb(connection);
    connection.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) {
        router.replace('/owner/login');
        return;
      }
      setUser(data.user);
      await load(connection, data.user.id);
    }).catch((loadError: any) => {
      setError(loadError?.message || 'Customer records could not be loaded.');
      setLoading(false);
    });
  }, [router]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) => [row.name, row.phone || '', row.email || '', row.notes || ''].join(' ').toLowerCase().includes(value));
  }, [rows, search]);

  function clearForm() {
    setEditing(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
  }

  function startEdit(row: Customer) {
    setEditing(row.id);
    setName(row.name);
    setPhone(row.phone || '');
    setEmail(row.email || '');
    setNotes(row.notes || '');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !business || !user) return;
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      business_id: business.id,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    };
    const result = editing
      ? await db.from('customers').update(payload).eq('id', editing).eq('business_id', business.id)
      : await db.from('customers').insert(payload);
    if (result.error) {
      setError('Customer could not be saved: ' + result.error.message);
      setSaving(false);
      return;
    }
    setNotice(editing ? 'Customer details updated.' : 'Customer added to this business.');
    clearForm();
    await load(db, user.id);
    setSaving(false);
  }

  async function remove(row: Customer) {
    if (!db || !business || !user || !window.confirm('Remove ' + row.name + ' from the customer directory?')) return;
    const { error: deleteError } = await db.from('customers').delete().eq('id', row.id).eq('business_id', business.id);
    if (deleteError) {
      setError('Customer could not be removed: ' + deleteError.message);
      return;
    }
    setNotice('Customer removed from the directory.');
    await load(db, user.id);
  }

  if (loading) return <main className="bp-auth-page"><div className="bp-auth-card">Loading BranchPilot customers…</div></main>;
  if (!business) return <main className="bp-auth-page"><div className="bp-auth-card"><h1>Customer access check</h1><p className="bp-auth-message">{error || 'Owner access is required.'}</p></div></main>;

  return (
    <BranchPilotOwnerShell
      title="Customers"
      subtitle="Keep customer contacts and notes together with this business."
      businessName={business.name}
      businessLogo={business.logo_url}
      email={user?.email}
      actions={<button className="bp-button secondary" onClick={() => user && load(db, user.id)}>↻ Refresh</button>}
    >
      {error && <p className="bp-alert" role="alert">{error}</p>}
      {notice && <p className="bp-success" role="status">{notice}</p>}
      <div className="bp-grid bp-kpi-grid">
        <div className="bp-panel"><div className="bp-kpi-label">Customers</div><div className="bp-kpi-value">{rows.length}</div><div className="bp-kpi-sub">Saved in this business directory</div></div>
        <div className="bp-panel"><div className="bp-kpi-label">Search results</div><div className="bp-kpi-value">{filtered.length}</div><div className="bp-kpi-sub">Matching your current search</div></div>
      </div>
      <div className="bp-grid bp-two-col">
        <section className="bp-panel">
          <div className="bp-panel-heading"><div><h2>{editing ? 'Update customer' : 'Add a customer'}</h2><p>Customer records belong only to {business.name}.</p></div></div>
          <form className="bp-form-grid" onSubmit={save}>
            <label>Customer name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name or business name" /></label>
            <label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254…" /></label>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Optional" /></label>
            <label style={{ gridColumn: '1 / -1' }}>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer notes, preferences or contact details" /></label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="bp-button" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save customer changes' : 'Add customer'}</button>
              {editing && <button type="button" className="bp-button secondary" onClick={clearForm}>Cancel</button>}
            </div>
          </form>
        </section>
        <section className="bp-panel">
          <div className="bp-panel-heading"><div><h2>Customer directory</h2><p>{rows.length} saved customer records</p></div></div>
          <input className="bp-field" style={{ width: '100%', marginBottom: 14 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, email or notes…" />
          <div className="bp-table-wrap"><table className="bp-table"><thead><tr><th>CUSTOMER</th><th>PHONE / EMAIL</th><th>ADDED</th><th></th></tr></thead><tbody>
            {filtered.map((row) => <tr key={row.id}><td><strong>{row.name}</strong>{row.notes && <small>{row.notes}</small>}</td><td>{row.phone || '—'}<br /><small>{row.email || ''}</small></td><td>{new Date(row.created_at).toLocaleDateString('en-KE')}</td><td><div style={{ display: 'flex', gap: 6 }}><button className="bp-button secondary" onClick={() => startEdit(row)}>Edit</button><button className="bp-button secondary" onClick={() => remove(row)}>Remove</button></div></td></tr>)}
          </tbody></table>{!filtered.length && <div className="bp-empty">{rows.length ? 'No customers match this search.' : 'No customers have been added to this business yet.'}</div>}</div>
        </section>
      </div>
    </BranchPilotOwnerShell>
  );
}

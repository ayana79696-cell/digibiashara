'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import BranchPilotOwnerShell from '@/components/branchpilot-owner-shell';

type Template = {
  id: string;
  group_id: string;
  group_label: string;
  category_label: string;
  sort_order: number;
  configuration: {
    description?: string;
    product_examples?: { name: string; category?: string; unit?: string; kind?: string }[];
    units?: string[];
    features?: string[];
    supported_modules?: string[];
  };
};
type BusinessRow = {
  id: string;
  name: string;
  business_type: string;
  business_activities: string[] | null;
  status: string;
  created_at: string;
  business_category_template_id: string | null;
  business_template_snapshot: any;
  role: string;
  subscription_status?: string;
  paid_until?: string | null;
};
const client = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
};
const activeToday = (business: BusinessRow) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  return business.status === 'active' && business.subscription_status === 'paid'
    && !!business.paid_until && business.paid_until >= today;
};

export default function OwnerBusinessesPage() {
  const [db, setDb] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [groupId, setGroupId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [showForm, setShowForm] = useState(false);

  const groups = useMemo(
    () => Array.from(new Map(templates.map((template) => [template.group_id, { id: template.group_id, label: template.group_label }])).values()),
    [templates],
  );
  const selectedTemplate = templates.find((template) => template.id === templateId) || null;
  const groupTemplates = templates.filter((template) => template.group_id === groupId);
  const configuration = selectedTemplate?.configuration || {};
  const productExamples = configuration.product_examples || [];

  async function refresh(connection: any, userId: string) {
    setError('');
    const [membershipResult, templateResult] = await Promise.all([
      connection.from('business_memberships')
        .select('business_id,role,is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .in('role', ['owner', 'business_owner', 'admin'])
        .order('created_at'),
      connection.from('business_category_templates')
        .select('id,group_id,group_label,category_label,sort_order,configuration')
        .eq('is_active', true)
        .order('group_id')
        .order('sort_order'),
    ]);
    if (membershipResult.error) {
      setError('Could not load your business access: ' + membershipResult.error.message);
      setLoading(false);
      return;
    }
    if (templateResult.error) {
      setError('Your business list loaded, but category templates could not be read: ' + templateResult.error.message);
    } else {
      const catalogue = (templateResult.data || []) as Template[];
      setTemplates(catalogue);
      if (!templateId && catalogue[0]) {
        setGroupId(catalogue[0].group_id);
        setTemplateId(catalogue[0].id);
      }
    }
    const memberships = membershipResult.data || [];
    const ids = [...new Set(memberships.map((item: any) => item.business_id))];
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const [businessResult, subscriptionResult] = await Promise.all([
      connection.from('businesses')
        .select('id,name,business_type,business_activities,status,created_at,business_category_template_id,business_template_snapshot')
        .in('id', ids)
        .order('created_at'),
      connection.from('business_subscriptions')
        .select('business_id,status,paid_until')
        .in('business_id', ids),
    ]);
    if (businessResult.error) {
      setError('Could not load your business records: ' + businessResult.error.message);
      setLoading(false);
      return;
    }
    const mapped = (businessResult.data || []).map((business: any) => ({
      ...business,
      role: memberships.find((member: any) => member.business_id === business.id)?.role || 'member',
      subscription_status: (subscriptionResult.data || []).find((subscription: any) => subscription.business_id === business.id)?.status,
      paid_until: (subscriptionResult.data || []).find((subscription: any) => subscription.business_id === business.id)?.paid_until,
    }));
    setRows(mapped);
    if (subscriptionResult.error) setError('Business list loaded, but subscription status could not be read.');
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
        location.href = '/owner/login';
        return;
      }
      setUser(data.user);
      await refresh(connection, data.user.id);
    }).catch((loadError: any) => {
      setError(loadError?.message || 'Could not load your businesses.');
      setLoading(false);
    });
  }, []);

  function changeGroup(nextGroup: string) {
    setGroupId(nextGroup);
    setTemplateId(templates.find((template) => template.group_id === nextGroup)?.id || '');
  }

  async function createBusiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user || !selectedTemplate) return;
    setSaving(true);
    setError('');
    setNotice('');
    const modules = configuration.supported_modules || [];
    const featureTemplates = configuration.features || [];
    const { data, error: rpcError } = await db.rpc('create_owner_business', {
      p_name: name.trim(),
      p_business_type: selectedTemplate.category_label,
      p_activities: [selectedTemplate.category_label],
      p_modules: modules,
      p_templates: featureTemplates,
      p_phone: phone.trim() || null,
      p_email: email.trim() || null,
    });
    if (rpcError || !data?.business_id) {
      setError(rpcError?.message || 'The business could not be created.');
      setSaving(false);
      return;
    }
    setNotice('Business created with the ' + selectedTemplate.category_label + ' BranchPilot template. It is pending subscription activation.');
    setName('');
    setPhone('');
    setEmail('');
    setShowForm(false);
    await refresh(db, user.id);
    setSaving(false);
  }

  function openWorkspace(business: BusinessRow) {
    if (!activeToday(business)) {
      setNotice('This business is waiting for activation or subscription confirmation. You can open it once the platform administrator activates access.');
      return;
    }
    localStorage.setItem('digibiashara_active_business_id', business.id);
    location.href = '/admin/dashboard';
  }

  async function signOut() {
    await db?.auth.signOut();
    localStorage.removeItem('digibiashara_active_business_id');
    location.href = '/owner/login';
  }

  const activeCount = rows.filter(activeToday).length;
  const remaining = Math.max(0, 5 - rows.length);

  return (
    <BranchPilotOwnerShell
      title="My businesses"
      subtitle="Choose a business workspace or create another one from the live category catalogue."
      businessName="Owner portfolio"
      email={user?.email}
      actions={<button className="bp-button secondary" onClick={() => user && refresh(db, user.id)}>↻ Refresh</button>}
    >
      {loading ? (
        <div className="bp-panel"><p>Loading your BranchPilot business portfolio…</p></div>
      ) : (
        <>
          {(error || notice) && <p className={error ? 'bp-alert' : 'bp-success'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
          <div className="bp-grid bp-portfolio-stats">
            <div className="bp-panel"><span className="bp-kpi-label">Businesses registered</span><strong className="bp-kpi-value">{rows.length} / 5</strong><span className="bp-kpi-sub">Under this owner login</span></div>
            <div className="bp-panel"><span className="bp-kpi-label">Active workspaces</span><strong className="bp-kpi-value">{activeCount}</strong><span className="bp-kpi-sub">Subscription confirmed</span></div>
            <div className="bp-panel"><span className="bp-kpi-label">Slots available</span><strong className="bp-kpi-value">{remaining}</strong><span className="bp-kpi-sub">Maximum five businesses</span></div>
          </div>

          <section className="bp-panel bp-portfolio-section">
            <div className="bp-panel-heading">
              <div><span className="bp-register-kicker">YOUR BUSINESS NETWORK</span><h2>Business workspaces</h2><p>Each business keeps its own products, stock, team, transactions and category template.</p></div>
              <div className="bp-portfolio-actions">
                {remaining > 0 && <button className="bp-button" onClick={() => setShowForm((current) => !current)}>{showForm ? 'Close setup' : '+ Add a business'}</button>}
                <button className="bp-button secondary" onClick={signOut}>Sign out</button>
              </div>
            </div>
            <div className="bp-grid bp-portfolio-businesses">
              {rows.map((business, index) => {
                const isActive = activeToday(business);
                const category = templates.find((template) => template.id === business.business_category_template_id);
                const snapshot = business.business_template_snapshot || {};
                const examples = snapshot.configuration?.product_examples || [];
                return (
                  <article className="bp-panel bp-portfolio-card" key={business.id}>
                    <div className="bp-portfolio-card-top"><span className="bp-portfolio-index">{String(index + 1).padStart(2, '0')}</span><span className={'bp-status ' + (isActive ? '' : 'warning')}>{isActive ? 'Active workspace' : 'Pending activation'}</span></div>
                    <h3>{business.name}</h3>
                    <p className="bp-portfolio-category">{category?.group_label || snapshot.group_label || 'Business category'} / {category?.category_label || snapshot.category_label || business.business_type}</p>
                    <div className="bp-template-unit-list">{(snapshot.configuration?.supported_modules || []).slice(0, 6).map((module: string) => <span key={module}>{module.replaceAll('_', ' ')}</span>)}</div>
                    <p className="bp-portfolio-detail">{examples.length} category product/service suggestions saved with this workspace</p>
                    <div className="bp-portfolio-card-footer"><small>Created {new Date(business.created_at).toLocaleDateString('en-KE')} · {business.role}</small><button className="bp-button" disabled={!isActive} onClick={() => openWorkspace(business)}>{isActive ? 'Open BranchPilot →' : 'Awaiting activation'}</button></div>
                  </article>
                );
              })}
              {!rows.length && <div className="bp-portfolio-empty"><strong>No business workspaces yet</strong><p>Register or ask the platform administrator to create your first BranchPilot business.</p></div>}
            </div>
          </section>

          {showForm && remaining > 0 && (
            <section className="bp-panel bp-portfolio-section">
              <div className="bp-panel-heading"><div><span className="bp-register-kicker">NEW WORKSPACE / CATEGORY SETUP</span><h2>Create another business</h2><p>Choose a template. Its saved category examples, units and supported modules will be attached automatically.</p></div></div>
              <form className="bp-form-grid" onSubmit={createBusiness}>
                <label>Business name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sunrise Mini Mart" /></label>
                <label>Business phone (optional)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254…" /></label>
                <label>Business email (optional)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="business@example.com" /></label>
                <label>Business group<select required value={groupId} onChange={(event) => changeGroup(event.target.value)}><option value="">Choose a group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
                <label>Business category<select required value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Choose a category</option>{groupTemplates.map((template) => <option key={template.id} value={template.id}>{template.category_label}</option>)}</select></label>
                {selectedTemplate && (
                  <div className="bp-template-preview bp-portfolio-template">
                    <div className="bp-template-preview-head"><div><span className="bp-register-kicker">TEMPLATE PREVIEW</span><h3>{selectedTemplate.category_label}</h3><p>{selectedTemplate.group_label}</p></div><span className="bp-template-preview-mark">BP</span></div>
                    <div className="bp-template-preview-columns">
                      <div><h4>Product & service suggestions <span>{productExamples.length}</span></h4>
                        {productExamples.length ? <div className="bp-template-chips">{productExamples.slice(0, 12).map((item, index) => <span key={item.name + index}>{item.name}<small>{item.category || item.kind || 'Item'} · {item.unit || 'piece'}</small></span>)}</div> : <p className="bp-template-empty">No starter examples are configured for this category yet. Custom items can be added after the workspace is active.</p>}
                      </div>
                      <div><h4>Units & core modules</h4><div className="bp-template-unit-list">{(configuration.units || []).slice(0, 12).map((unit) => <span key={unit}>{unit}</span>)}</div><div className="bp-template-unit-list">{(configuration.supported_modules || []).map((module) => <span key={module}>{module.replaceAll('_', ' ')}</span>)}</div></div>
                    </div>
                    {configuration.features?.length ? <p className="bp-template-feature-row"><b>Template guidance</b> {configuration.features.slice(0, 6).join(' · ')}</p> : null}
                  </div>
                )}
                <div className="bp-form-actions"><button className="bp-button" disabled={saving || !selectedTemplate}>{saving ? 'Creating workspace…' : 'Create business workspace →'}</button></div>
              </form>
            </section>
          )}
        </>
      )}
      <div className="bp-portfolio-footnote">DigiBiashara · BranchPilot workspace portfolio · KSh / Africa-Nairobi</div>
    </BranchPilotOwnerShell>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type CategoryTemplate = {
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
    planned_features?: string[];
    supported_modules?: string[];
    implementation_status?: string;
    main_workflow?: string;
    specialised_fields?: string[];
    default_roles?: string[];
    reports?: string[];
  };
};

const client = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
};

export default function BranchPilotRegister() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  const [groupId, setGroupId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const db = client();
    if (!db) {
      setCatalogueError('The category catalogue is not configured. Please contact support.');
      setCatalogueLoading(false);
      return;
    }
    let mounted = true;
    db.from('business_category_templates')
      .select('id,group_id,group_label,category_label,sort_order,configuration')
      .eq('is_active', true)
      .order('group_id')
      .order('sort_order')
      .then(({ data, error: queryError }) => {
        if (!mounted) return;
        if (queryError) {
          setCatalogueError('We could not load the current category templates: ' + queryError.message);
        } else {
          const rows = (data || []) as CategoryTemplate[];
          setTemplates(rows);
          if (rows[0]) {
            setGroupId(rows[0].group_id);
            setTemplateId(rows[0].id);
          }
        }
        setCatalogueLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const groups = useMemo(
    () => Array.from(new Map(templates.map((item) => [item.group_id, { id: item.group_id, label: item.group_label }])).values()),
    [templates],
  );
  const groupTemplates = templates.filter((item) => item.group_id === groupId);
  const selectedTemplate = templates.find((item) => item.id === templateId) || null;
  const configuration = selectedTemplate?.configuration || {};
  const examples = configuration.product_examples || [];
  const units = configuration.units || [];
  const features = configuration.features || [];
  const plannedFeatures = configuration.planned_features || [];

  function selectGroup(nextGroup: string) {
    setGroupId(nextGroup);
    const first = templates.find((item) => item.group_id === nextGroup);
    setTemplateId(first?.id || '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) {
      setError('Choose a business category from the current catalogue.');
      return;
    }
    const db = client();
    if (!db) {
      setError('Secure registration is not configured.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');

    const { data, error: invokeError } = await db.functions.invoke('register-branchpilot-owner', {
      body: {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        activities: [selectedTemplate.category_label],
        category_template_id: selectedTemplate.id,
        modules: configuration.supported_modules || [],
        templates: features,
      },
    });

    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Registration could not be completed.');
      setBusy(false);
      return;
    }
    setSuccess(data?.message || 'Your BranchPilot owner account has been created.');
    setBusy(false);
  }

  return (
    <main className="bp-auth-page">
      <section className="bp-auth-card bp-register-card">
        <Link href="/" className="bp-auth-back">← Back to DigiBiashara</Link>
        <div className="bp-auth-brand">
          <img src="/digibiashara-logo.svg" alt="DigiBiashara" />
          <span><strong>DigiBiashara</strong><small>BRANCHPILOT OWNER REGISTRATION</small></span>
        </div>
        <div className="bp-register-intro">
          <span className="bp-register-kicker">BUSINESS SETUP / STEP 01</span>
          <h1>Build your business workspace.</h1>
          <p>Your category controls the initial BranchPilot setup, available core modules, suggested product catalogue, units and the workspace experience.</p>
        </div>

        {error && <p className="bp-auth-message" role="alert">{error}</p>}
        {catalogueError && <p className="bp-auth-message" role="alert">{catalogueError}</p>}

        {success ? (
          <>
            <p className="bp-success">{success}</p>
            <Link href="/owner/login" className="bp-auth-submit bp-register-primary-link">Continue to Owner login →</Link>
            <p className="bp-auth-hint">Your category template and product examples have been saved with the business. Your workspace will open when the platform administrator activates the subscription.</p>
          </>
        ) : (
          <form onSubmit={submit} className="bp-register-form">
            <section className="bp-register-section">
              <div className="bp-register-section-head"><span>01</span><div><h2>Owner details</h2><p>Create the secure account that controls this business.</p></div></div>
              <div className="bp-form-grid">
                <label>Full name<input required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
                <label>Business name<input required maxLength={120} value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" /></label>
                <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
                <label>Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="+254…" /></label>
                <label className="bp-register-full">Password<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></label>
              </div>
            </section>

            <section className="bp-register-section">
              <div className="bp-register-section-head"><span>02</span><div><h2>Select your business category</h2><p>Choose from the live 150-category BranchPilot master catalogue.</p></div></div>
              {catalogueLoading ? <p className="bp-register-loading">Loading the current business categories…</p> : (
                <div className="bp-register-category-grid">
                  <label>Business group
                    <select className="bp-field" required value={groupId} onChange={(event) => selectGroup(event.target.value)}>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                    </select>
                  </label>
                  <label>Business category
                    <select className="bp-field" required value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                      {groupTemplates.map((item) => <option key={item.id} value={item.id}>{item.category_label}</option>)}
                    </select>
                  </label>
                </div>
              )}
              {selectedTemplate && (
                <div className="bp-template-preview">
                  <div className="bp-template-preview-head">
                    <div><span className="bp-register-kicker">YOUR SELECTED TEMPLATE</span><h3>{selectedTemplate.category_label}</h3><p>{selectedTemplate.group_label}</p></div>
                    <span className="bp-template-preview-mark">BP</span>
                  </div>
                  {configuration.description && <p className="bp-template-description">{configuration.description}</p>}
                  <div className="bp-template-preview-columns">
                    <div><h4>Product & service suggestions <span>{examples.length}</span></h4>
                      {examples.length ? <div className="bp-template-chips">{examples.slice(0, 12).map((item, index) => <span key={item.name + index}>{item.name}<small>{item.category || item.kind || 'Item'} · {item.unit || 'piece'}</small></span>)}</div> : <p className="bp-template-empty">The master template has no starter examples for this category yet. You can add your actual products and services inside the workspace.</p>}
                    </div>
                    <div><h4>Suggested units</h4><div className="bp-template-unit-list">{units.length ? units.slice(0, 12).map((unit) => <span key={unit}>{unit}</span>) : <span>Set when adding products</span>}</div>
                      <h4 className="bp-template-feature-title">Included core modules</h4><div className="bp-template-unit-list">{(configuration.supported_modules || []).map((module) => <span key={module}>{module.replaceAll('_', ' ')}</span>)}</div>
                    </div>
                  </div>
                  {features.length > 0 && <div className="bp-template-feature-row"><b>Template guidance</b>{features.slice(0, 8).map((feature) => <span key={feature}>{feature}</span>)}</div>}
                  {plannedFeatures.length > 0 && <p className="bp-template-note">Some specialised workflows are planned in the category template and are not switched on until they are implemented and tested.</p>}
                  {configuration.main_workflow && <div className="bp-template-feature-row"><b>Suggested workflow</b><span>{configuration.main_workflow}</span></div>}
                  {(configuration.specialised_fields || []).length > 0 && <div className="bp-template-feature-row"><b>Category-specific fields</b>{configuration.specialised_fields!.slice(0, 12).map((field) => <span key={field}>{field}</span>)}</div>}
                  {(configuration.default_roles || []).length > 0 && <div className="bp-template-feature-row"><b>Suggested roles</b>{configuration.default_roles!.map((role) => <span key={role}>{role}</span>)}</div>}
                  {(configuration.reports || []).length > 0 && <div className="bp-template-feature-row"><b>Reports & indicators</b>{configuration.reports!.slice(0, 8).map((report) => <span key={report}>{report}</span>)}</div>}
                </div>
              )}
            </section>

            <button className="bp-auth-submit" type="submit" disabled={busy || catalogueLoading || !selectedTemplate || !!catalogueError}>
              {busy ? 'Creating your secure workspace…' : 'Register owner account →'}
            </button>
            <p className="bp-auth-hint">Your business starts as pending review. No sample prices or opening stock are invented during registration. You enter real prices and quantities when adding items.</p>
          </form>
        )}
        <Link className="bp-auth-switch" href="/owner/login">Already registered? Owner login →</Link>
      </section>
    </main>
  );
}

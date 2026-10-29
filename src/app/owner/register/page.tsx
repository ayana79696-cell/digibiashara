'use client';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { BUSINESS_CATEGORIES, getBusinessSetup } from '@/lib/business-catalogue';

const client=()=>{const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return u&&k?createClient(u,k):null;};
export default function BranchPilotRegister(){
 const [fullName,setFullName]=useState(''),[businessName,setBusinessName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[category,setCategory]=useState(BUSINESS_CATEGORIES[0]?.id||'retail'),[activities,setActivities]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const group=BUSINESS_CATEGORIES.find(c=>c.id===category)||BUSINESS_CATEGORIES[0];
 const setup=useMemo(()=>getBusinessSetup(activities),[activities]);
 const toggle=(item:string)=>setActivities([item]);
 async function submit(e:FormEvent){e.preventDefault();if(!activities.length){setError('Choose at least one business activity.');return;}const d=client();if(!d){setError('Secure registration is not configured.');return;}setBusy(true);setError('');setSuccess('');
  const {data,error:e1}=await d.functions.invoke('register-branchpilot-owner',{body:{full_name:fullName.trim(),business_name:businessName.trim(),email:email.trim().toLowerCase(),phone:phone.trim(),password,activities,modules:setup.modules,templates:setup.templates}});
  if(e1||data?.error){setError(data?.error||e1?.message||'Registration could not be completed.');setBusy(false);return;}
  setSuccess(data?.message||'Owner account created. Wait for activation before signing in.');setBusy(false);
 }
 return <main className="bp-auth-page"><section className="bp-auth-card" style={{width:'min(100%,660px)'}}>
  <Link href="/" className="bp-auth-back">← Back to BranchPilot</Link>
  <div className="bp-auth-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>OWNER REGISTRATION</small></span></div>
  <h1>Set up your owner account.</h1><p>Create the owner login for your business. The existing DigiBiashara category/setup system is used to configure the right modules for your type of business.</p>
  {error&&<p className="bp-auth-message" role="alert">{error}</p>}
  {success?<><p className="bp-success">{success}</p><Link href="/owner/login" className="bp-auth-submit" style={{display:'block',textAlign:'center'}}>Go to Owner login →</Link><p className="bp-auth-hint">Your business remains pending until the platform administrator activates its subscription. Your business data and selected categories have been saved.</p></>:
  <form onSubmit={submit}>
   <div className="bp-form-grid"><label>Full name<input required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name"/></label><label>Business name<input required maxLength={120} value={businessName} onChange={e=>setBusinessName(e.target.value)} autoComplete="organization"/></label><label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Phone number<input required value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" placeholder="+254…"/></label><label style={{gridColumn:'1/-1'}}>Password<input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters"/></label></div>
   <label style={{display:'grid',gap:6,marginTop:20,fontSize:11,fontWeight:800,color:'#526258'}}>Business category<select className="bp-field" value={category} onChange={e=>{setCategory(e.target.value);setActivities([]);}}>{BUSINESS_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><strong style={{fontSize:12}}>Select your business activities</strong><span className="bp-pill">{activities.length} selected</span></div>
   <div className="bp-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:8,marginTop:11}}>{group.items.map(item=><label key={item} style={{display:'flex',alignItems:'center',gap:8,border:'1px solid #e1e9e2',padding:10,borderRadius:10,fontSize:10,fontWeight:650,color:'#536459',background:activities.includes(item)?'#eef7e7':'white'}}><input type="radio" name="primary-business" checked={activities.includes(item)} onChange={()=>toggle(item)} style={{width:14,height:14,accentColor:'#174b39'}}/>{item}</label>)}</div>
   <p className="bp-auth-hint">Choose one primary business type. DigiBiashara will tailor the initial workspace to that business; additional branches can be configured separately.</p>
   <button className="bp-auth-submit" type="submit" disabled={busy} style={{width:'100%'}}>{busy?'Creating secure account…':'Register owner account →'}</button>
  </form>}
  <Link className="bp-auth-switch" href="/owner/login">Already registered? Owner login →</Link>
 </section></main>;
}

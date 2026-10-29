'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const client=()=>{const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return u&&k?createClient(u,k,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;};
const money=(n:number)=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(Number(n||0));
const dt=(v:string)=>v?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(new Date(v)):'—';
const localStart=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const n=(k:string)=>Number(p.find(x=>x.type===k)?.value);return new Date(Date.UTC(n('year'),n('month')-1,n('day'),-3)).toISOString();};

export default function BranchPilotEmployeeDashboard(){
 const router=useRouter();const [db,setDb]=useState<any>(null),[user,setUser]=useState<any>(null),[employee,setEmployee]=useState<any>(null),[business,setBusiness]=useState<any>(null),[branch,setBranch]=useState<any>(null),[shift,setShift]=useState<any>(null),[sales,setSales]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reload=useCallback(async(d:any,emp:any,uid:string)=>{
  const start=localStart();
  const [open,daySales,br,bi]=await Promise.all([
   d.from('attendance').select('*').eq('employee_id',emp.id).is('check_out_at',null).order('check_in_at',{ascending:false}).limit(1).maybeSingle(),
   d.from('sales').select('id,receipt_number,total,amount_paid,payment_status,sold_at').eq('business_id',emp.business_id).eq('employee_id',emp.id).gte('sold_at',start).order('sold_at',{ascending:false}),
   d.from('branches').select('id,name,address,opening_time,closing_time,latitude,longitude,attendance_radius_m').eq('id',emp.branch_id).maybeSingle(),
   d.from('businesses').select('id,name').eq('id',emp.business_id).maybeSingle()
  ]);
  if(open.error)setError(open.error.message);setShift(open.data||null);setSales(daySales.data||[]);setBranch(br.data||null);setBusiness(bi.data||null);
 },[]);
 useEffect(()=>{const d=client();if(!d){setError('Supabase is not configured.');setLoading(false);return;}setDb(d);
  d.auth.getUser().then(async({data,error:authError})=>{
   if(authError||!data.user){router.replace('/employee/login');return;}setUser(data.user);
   const {data:emp,error:e}=await d.from('employees').select('id,business_id,user_id,branch_id,full_name,email,role,scheduled_start,scheduled_end,is_active,branches(name)').eq('user_id',data.user.id).eq('is_active',true).maybeSingle();
   if(e||!emp){setError('This account has no active employee profile or branch assignment. Contact the owner.');setLoading(false);return;}
   const {data:m,error:me}=await d.from('business_memberships').select('role,is_active').eq('business_id',emp.business_id).eq('user_id',data.user.id).eq('is_active',true).maybeSingle();
   if(me||!m||['owner','business_owner','admin'].includes(String(m.role).toLowerCase())){setError('Employee access could not be verified for this business.');setLoading(false);return;}
   setEmployee(emp);localStorage.setItem('digibiashara_active_business_id',emp.business_id);await reload(d,emp,data.user.id);setLoading(false);
  }).catch((e:any)=>{setError(e?.message||'Could not verify your employee account.');setLoading(false);});
 },[reload,router]);
 async function attendanceAction(action:'check_in'|'check_out'){
  if(!db||!employee)return;setBusy(true);setError('');setNotice('');
  const perform=async(coords:any)=>db.rpc('branchpilot_check_attendance',{p_action:action,p_latitude:coords?.latitude??null,p_longitude:coords?.longitude??null,p_accuracy_m:coords?.accuracy??null});
  let coords:any=null;
  if(typeof navigator!=='undefined'&&navigator.geolocation){coords=await new Promise((resolve)=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:12000,maximumAge:0}));}
  const {data,error:e}=await perform(coords);
  if(e){setError(e.message);setBusy(false);return;}
  setNotice(action==='check_in'?'You are checked in. Your time and location have been recorded.':'You are checked out. Your shift has been closed.');
  await reload(db,employee,user.id);setBusy(false);
 }
 const signOut=async()=>{await db?.auth.signOut();localStorage.removeItem('digibiashara_active_business_id');location.href='/';};
 if(loading)return <main className="bp-auth-page"><div className="bp-auth-card">Loading your employee workspace…</div></main>;
 if(!employee)return <main className="bp-auth-page"><section className="bp-auth-card"><div className="bp-auth-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>EMPLOYEE WORKSPACE</small></span></div><h1>Employee access</h1><p className="bp-auth-message">{error||'Employee access is required.'}</p><Link href="/employee/login">Return to employee login →</Link></section></main>;
 const gross=sales.reduce((n:any,s:any)=>n+Number(s.total||0),0),collected=sales.reduce((n:any,s:any)=>n+Number(s.amount_paid||0),0);
 return <main className="bp-workspace">
  <aside className="bp-sidebar"><Link href="/" className="bp-sidebar-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>EMPLOYEE WORKSPACE</small></span></Link><div className="bp-side-label">YOUR SHIFT</div><nav className="bp-side-links"><Link className="active" href="/employee/dashboard"><span>◫</span>My dashboard</Link><Link href="/employee/new-sale"><span>＋</span>New sale</Link><a href="#todays-sales"><span>▤</span>Today's sales</a></nav><div className="bp-side-bottom"><span className="bp-side-avatar">{String(employee.full_name||'E').slice(0,1).toUpperCase()}</span><div><b>{employee.full_name}</b><small>{branch?.name||'Assigned branch'}</small></div><button onClick={signOut}>Sign out</button></div></aside>
  <section className="bp-main bp-employee-home">
   <header className="bp-topbar"><div><div className="bp-eyebrow">EMPLOYEE WORKSPACE / SHIFT</div><h1>Hello, {String(employee.full_name||'there').split(' ')[0]}.</h1><p>{business?.name||'Your business'} · {branch?.name||'Assigned branch'}</p></div><div className="bp-topbar-actions"><span className="bp-pill">{shift?'Shift open':'Not checked in'}</span><button className="bp-button secondary" onClick={signOut}>Sign out</button></div></header>
   {error&&<p className="bp-alert">{error}</p>}{notice&&<p className="bp-success">{notice}</p>}
   <section className="bp-panel" style={{background:'linear-gradient(120deg,#174b39,#286647)',color:'white',border:0,marginBottom:16}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}><div><div style={{fontSize:10,letterSpacing:1.3,color:'#c8dece',fontWeight:800}}>YOUR CURRENT SHIFT</div><h2 style={{fontSize:22,margin:'9px 0 7px',color:'white'}}>{shift?'You are currently checked in':'Ready to start work?'}</h2><p style={{fontSize:11,lineHeight:1.65,color:'#d4e5d9',margin:0}}>{shift?'Checked in at '+dt(shift.check_in_at):'Use check-in at your assigned branch. If the owner configured a GPS radius, the system will verify your device location.'}</p></div>
    <button className="bp-button lime" disabled={busy} onClick={()=>attendanceAction(shift?'check_out':'check_in')}>{busy?'Saving…':shift?'Check out now':'Check in now'} →</button></div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><span className="bp-pill">{branch?.opening_time?String(branch.opening_time).slice(0,5):'Start time not set'} – {branch?.closing_time?String(branch.closing_time).slice(0,5):'End time not set'}</span><span className="bp-pill">GPS radius: {branch?.attendance_radius_m||150}m</span><span className="bp-pill">{employee.scheduled_start?'Scheduled '+String(employee.scheduled_start).slice(0,5):'Schedule not assigned'}</span></div>
   </section>
   <div className="bp-grid bp-kpi-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><div className="bp-panel"><div className="bp-kpi-label">Today's sales</div><div className="bp-kpi-value">{money(gross)}</div><div className="bp-kpi-sub">{sales.length} saved receipts</div></div><div className="bp-panel"><div className="bp-kpi-label">Collected today</div><div className="bp-kpi-value">{money(collected)}</div><div className="bp-kpi-sub">Recorded payments</div></div><div className="bp-panel"><div className="bp-kpi-label">Attendance</div><div className="bp-kpi-value" style={{fontSize:20}}>{shift?'Checked in':'Not started'}</div><div className="bp-kpi-sub">{shift?'Your active shift is open':'Check in to record your shift'}</div></div></div>
   <div className="bp-grid bp-employee-actions" style={{marginBottom:16}}><Link className="bp-action-tile" href="/employee/new-sale"><span className="tile-icon">＋</span><span><b>New sale</b><small>Select available stock, take payment and generate a receipt.</small></span><strong>→</strong></Link><a className="bp-action-tile" href="#todays-sales"><span className="tile-icon">▤</span><span><b>Today's sales</b><small>Review receipts you recorded on this shift.</small></span><strong>→</strong></a></div>
   <section id="todays-sales" className="bp-panel"><div className="bp-panel-heading"><div><h2>Today's sales</h2><p>Saved receipts recorded by your employee account</p></div><Link href="/employee/new-sale" className="bp-button">＋ New sale</Link></div><div className="bp-table-wrap"><table className="bp-table"><thead><tr><th>DATE / TIME</th><th>RECEIPT</th><th>TOTAL</th><th>PAID</th><th>BALANCE / STATUS</th></tr></thead><tbody>{sales.map((s:any)=><tr key={s.id}><td>{dt(s.sold_at)}</td><td><strong>{s.receipt_number}</strong></td><td>{money(s.total)}</td><td>{money(s.amount_paid)}</td><td>{Number(s.total)>Number(s.amount_paid)?money(Number(s.total)-Number(s.amount_paid)):s.payment_status}</td></tr>)}</tbody></table>{!sales.length&&<div className="bp-empty">No sales recorded by you today.</div>}</div></section>
   <p className="bp-map-note" style={{marginTop:15}}>Your login is restricted to this employee profile and assigned branch. If the GPS check fails, confirm location permission is enabled and that your owner has configured the correct branch coordinates.</p>
  </section>
 </main>;
}

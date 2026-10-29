'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import BranchPilotOwnerShell from '@/components/branchpilot-owner-shell';

const client = () => {
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return u&&k?createClient(u,k,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
};
const money=(n:number)=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(Number(n||0));
const localDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Nairobi'});
const startOfNairobiDay=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=(t:string)=>Number(parts.find(p=>p.type===t)?.value);return new Date(Date.UTC(get('year'),get('month')-1,get('day'),-3,0,0)).toISOString();};

export default function BranchPilotDashboard(){
 const router=useRouter();
 const [db,setDb]=useState<any>(null),[user,setUser]=useState<any>(null),[biz,setBiz]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [kpi,setKpi]=useState({sales:0,cash:0,mpesa:0,profit:0,items:0,low:0,present:0,late:0,expenses:0});
 const [branches,setBranches]=useState<any[]>([]),[topProducts,setTopProducts]=useState<any[]>([]),[weekly,setWeekly]=useState<any[]>([]),[recentMpesa,setRecentMpesa]=useState<any[]>([]);
 const load=useCallback(async(d:any,businessId:string)=>{
   const start=startOfNairobiDay();
   const weekStart=new Date(Date.now()-6*86400000).toISOString();
   const [salesRes,branchesRes,stockRes,attendanceRes,expenseRes,weekRes,mpesaRes,itemsRes]=await Promise.all([
    d.from('sales').select('id,branch_id,total,amount_paid,sold_at').eq('business_id',businessId).gte('sold_at',start).order('sold_at',{ascending:false}),
    d.from('branches').select('id,name,address,is_active').eq('business_id',businessId).eq('is_active',true).order('name'),
    d.from('branch_inventory').select('branch_id,quantity,product_id,products(name,low_stock_threshold)').eq('business_id',businessId),
    d.from('attendance').select('id,branch_id,late_minutes,check_out_at').eq('business_id',businessId).gte('check_in_at',start),
    d.from('expenses').select('amount').eq('business_id',businessId).gte('incurred_at',start),
    d.from('sales').select('id,branch_id,total,sold_at').eq('business_id',businessId).gte('sold_at',weekStart).order('sold_at',{ascending:true}),
    d.from('mpesa_transactions').select('id,transaction_code,amount,transaction_at,branch_id,sale_id,branches(name),employees(full_name),sales(receipt_number)').eq('business_id',businessId).order('transaction_at',{ascending:false}).limit(6),
    d.from('sale_items').select('product_name,quantity,unit_cost,sale_id,sales!inner(business_id,sold_at)').eq('sales.business_id',businessId).gte('sales.sold_at',weekStart),
   ]);
   const errs=[salesRes,branchesRes,stockRes,attendanceRes,expenseRes,weekRes,mpesaRes,itemsRes].filter(r=>r.error);
   if(errs.length) setError('Some dashboard data could not load: '+errs.map(r=>r.error.message).join(' · '));
   const daily=salesRes.data||[];
   const payRows= daily.length ? (await d.from('payments').select('method,amount,sale_id,status').eq('business_id',businessId).in('sale_id',daily.map((s:any)=>s.id))).data||[] : [];
   const amountByMethod=(m:string)=>payRows.filter((p:any)=>p.status==='recorded'&&String(p.method).toLowerCase()===m).reduce((sum:number,p:any)=>sum+Number(p.amount||0),0);
   const stock=stockRes.data||[];
   const low=stock.filter((s:any)=>Number(s.quantity)<=Number(s.products?.low_stock_threshold||0));
   const attendance=attendanceRes.data||[];
   const revenueToday=daily.reduce((s:number,r:any)=>s+Number(r.total||0),0);
   const expensesToday=(expenseRes.data||[]).reduce((s:number,r:any)=>s+Number(r.amount||0),0);
   const todayItems=(itemsRes.data||[]).filter((x:any)=>new Date(x.sales?.sold_at||0)>=new Date(start));
   const cogsToday=todayItems.reduce((s:number,r:any)=>s+Number(r.unit_cost||0)*Number(r.quantity||0),0);
   setKpi({sales:revenueToday,cash:amountByMethod('cash'),mpesa:amountByMethod('mpesa'),profit:revenueToday-cogsToday-expensesToday,
    items:todayItems.reduce((s:number,r:any)=>s+Number(r.quantity||0),0),
    low:low.length,present:attendance.filter((r:any)=>!r.check_out_at).length,late:attendance.filter((r:any)=>Number(r.late_minutes)>0).length,
    expenses:expensesToday});
   const bs=branchesRes.data||[];setBranches(bs.map((b:any)=>({...b,sales:daily.filter((s:any)=>s.branch_id===b.id).reduce((n:number,s:any)=>n+Number(s.total||0),0)})).sort((a:any,b:any)=>b.sales-a.sales));
   const dayMap=new Map<string,number>();
   for(const row of (weekRes.data||[])){const label=new Intl.DateTimeFormat('en-KE',{weekday:'short',timeZone:'Africa/Nairobi'}).format(new Date(row.sold_at));dayMap.set(label,(dayMap.get(label)||0)+Number(row.total||0));}
   const labels=[] as string[];for(let i=6;i>=0;i--){const dt=new Date(Date.now()-i*86400000);labels.push(new Intl.DateTimeFormat('en-KE',{weekday:'short',timeZone:'Africa/Nairobi'}).format(dt));}
   setWeekly(labels.map(label=>({label,value:dayMap.get(label)||0})));
   const productMap=new Map<string,number>();for(const row of (itemsRes.data||[])){const name=String(row.product_name||'Product');productMap.set(name,(productMap.get(name)||0)+Number(row.quantity||0));}
   setTopProducts([...productMap.entries()].map(([name,qty])=>({name,qty})).sort((a,b)=>b.qty-a.qty).slice(0,5));
   setRecentMpesa(mpesaRes.data||[]);
 },[]);
 useEffect(()=>{const d=client();if(!d){setError('Supabase is not configured.');setLoading(false);return;}setDb(d);
  d.auth.getUser().then(async({data,error:authError})=>{if(authError||!data.user){router.replace('/owner/login');return;}setUser(data.user);
   let q=d.from('business_memberships').select('business_id,role,is_active').eq('user_id',data.user.id).eq('is_active',true).in('role',['owner','business_owner','admin']);
   const chosen=typeof window!=='undefined'?localStorage.getItem('digibiashara_active_business_id'):null;if(chosen)q=q.eq('business_id',chosen);
   const {data:m,error:me}=await q.limit(1).maybeSingle();if(me||!m){setError('This area is for business owners. Employee accounts cannot open the Owner dashboard.');setLoading(false);return;}
   const {data:b,error:be}=await d.from('businesses').select('id,name,status,phone,address,logo_url').eq('id',m.business_id).maybeSingle();
   if(be||!b){setError('Could not load the selected business.');setLoading(false);return;}
   setBiz(b);localStorage.setItem('digibiashara_active_business_id',b.id);
   await load(d,b.id);setLoading(false);
  }).catch((e:any)=>{setError(e?.message||'Could not verify your session.');setLoading(false);});
 },[router,load]);
 if(loading)return <main className="bp-auth-page"><div className="bp-auth-card">Loading your BranchPilot workspace…</div></main>;
 if(!biz)return <main className="bp-auth-page"><div className="bp-auth-card"><h1>Owner access check</h1><p className="bp-auth-message">{error||'Owner access is required.'}</p><p><Link href="/owner/login">Return to owner login</Link></p></div></main>;
 return <BranchPilotOwnerShell title="Dashboard" subtitle="A live snapshot of sales, collections, stock and staff activity." businessName={biz.name} businessLogo={biz.logo_url} email={user?.email} actions={<button className="bp-button" onClick={()=>load(db,biz.id)}>↻ Refresh</button>}>
  {error&&<p className="bp-alert">{error}</p>}
  <div className="bp-grid bp-kpi-grid">
   {[['Sales today',money(kpi.sales),'Completed sales recorded today'],['Cash collected',money(kpi.cash),'Recorded cash payments'],['M-Pesa collected',money(kpi.mpesa),'Payments with saved references'],['Items sold',kpi.items.toLocaleString('en-KE'),'Quantity from saved sale items'],['Low stock',kpi.low.toLocaleString('en-KE'),'Branch stock at or below minimum'],['Employees present',kpi.present.toLocaleString('en-KE'),'Open attendance shifts today'],['Late arrivals',kpi.late.toLocaleString('en-KE'),'Check-ins marked late'],['Estimated net profit',money(kpi.profit),'Revenue − cost of goods sold − expenses'],['Expenses today',money(kpi.expenses),'Expenses recorded today']].map(([label,value,sub])=><div className="bp-panel" key={label}><div className="bp-kpi-label">{label}</div><div className="bp-kpi-value">{value}</div><div className="bp-kpi-sub">{sub}</div></div>)}
  </div>
  <div className="bp-grid bp-two-col">
   <section className="bp-panel"><div className="bp-panel-heading"><div><h2>Sales this week</h2><p>Actual sales recorded in the database</p></div><Link href="/admin/reports" className="bp-button secondary">View reports →</Link></div>
    {weekly.every((d:any)=>d.value===0)?<div className="bp-empty">No sales recorded in this period yet. Sales will appear here when saved.</div>:<div className="bp-bar-list">{weekly.map((d:any)=><div className="bp-bar-item" key={d.label}><span>{d.label}</span><div className="bp-bar-track"><span style={{width:(Math.max(...weekly.map((x:any)=>x.value),1)?d.value/Math.max(...weekly.map((x:any)=>x.value),1)*100:0)+'%'}} /></div><strong>{money(d.value)}</strong></div>)}</div>}
   </section>
   <section className="bp-panel"><div className="bp-panel-heading"><div><h2>Branch performance</h2><p>Sales today, grouped by branch</p></div><Link href="/admin/branches" className="bp-button secondary">Branches →</Link></div>
    {!branches.length?<div className="bp-empty">No branches set up. Add your first branch to start tracking by location.</div>:<div className="bp-bar-list">{branches.map((b:any)=><div className="bp-bar-item" key={b.id}><span>{b.name}</span><div className="bp-bar-track"><span style={{width:(Math.max(...branches.map((x:any)=>x.sales),1)?b.sales/Math.max(...branches.map((x:any)=>x.sales),1)*100:0)+'%'}} /></div><strong>{money(b.sales)}</strong></div>)}</div>}
   </section>
   <section className="bp-panel"><div className="bp-panel-heading"><div><h2>Best-selling products</h2><p>Units recorded in saved sale lines this week</p></div><Link href="/admin/analytics" className="bp-button secondary">Analytics →</Link></div>
    {!topProducts.length?<div className="bp-empty">No product sales recorded in this period yet.</div>:<table className="bp-table"><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th></tr></thead><tbody>{topProducts.map((p:any)=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.qty}</td></tr>)}</tbody></table>}
   </section>
   <section className="bp-panel"><div className="bp-panel-heading"><div><h2>Latest M-Pesa transactions</h2><p>Saved transaction codes linked to sales and receipts</p></div><Link href="/admin/sales" className="bp-button secondary">See all →</Link></div>
    {!recentMpesa.length?<div className="bp-empty">No M-Pesa sales transaction codes have been recorded yet.</div>:<div className="bp-table-wrap"><table className="bp-table"><thead><tr><th>CODE</th><th>AMOUNT</th><th>RECEIPT</th></tr></thead><tbody>{recentMpesa.map((p:any)=><tr key={p.id}><td><strong>{p.transaction_code}</strong></td><td>{money(p.amount)}</td><td>{p.sales?.receipt_number||'—'}</td></tr>)}</tbody></table></div>}
   </section>
  </div>
 </BranchPilotOwnerShell>;
}

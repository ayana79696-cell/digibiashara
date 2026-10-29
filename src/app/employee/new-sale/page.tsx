'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const client=()=>{const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return u&&k?createClient(u,k,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;};
const money=(n:number)=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const dt=(v:string)=>v?new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}).format(new Date(v)):'—';

export default function BranchPilotNewSale(){
 const router=useRouter();const [db,setDb]=useState<any>(null),[user,setUser]=useState<any>(null),[business,setBusiness]=useState<any>(null),[employee,setEmployee]=useState<any>(null),[branches,setBranches]=useState<any[]>([]),[branchId,setBranchId]=useState(''),[products,setProducts]=useState<any[]>([]),[stock,setStock]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 const [cart,setCart]=useState<Record<string,number>>({}),[method,setMethod]=useState('cash'),[cashReceived,setCashReceived]=useState(''),[amountPaid,setAmountPaid]=useState(''),[mpesaCode,setMpesaCode]=useState(''),[notes,setNotes]=useState(''),[receipt,setReceipt]=useState<any>(null);
 const loadProducts=useCallback(async(d:any,businessId:string,branch:string)=>{
  if(!branch){setProducts([]);setStock([]);return;}
  const [p,iv]=await Promise.all([
   d.from('products').select('id,name,sku,barcode,category,size,color,selling_price,cost_price,low_stock_threshold,unit,is_active').eq('business_id',businessId).eq('is_active',true).is('archived_at',null).order('name'),
   d.from('branch_inventory').select('product_id,quantity,opening_stock').eq('business_id',businessId).eq('branch_id',branch)
  ]);
  if(p.error||iv.error){setError(p.error?.message||iv.error?.message||'Inventory could not be loaded.');return;}
  setProducts(p.data||[]);setStock(iv.data||[]);
 },[]);
 useEffect(()=>{const d=client();if(!d){setError('Supabase is not configured.');setLoading(false);return;}setDb(d);
  d.auth.getUser().then(async({data,error:authError})=>{
   if(authError||!data.user){router.replace('/employee/login');return;}setUser(data.user);
   const [{data:members,error:me},{data:emp,error:ee}] = await Promise.all([
    d.from('business_memberships').select('business_id,role,is_active').eq('user_id',data.user.id).eq('is_active',true),
    d.from('employees').select('id,business_id,user_id,branch_id,full_name,role,is_active').eq('user_id',data.user.id).eq('is_active',true).maybeSingle()
   ]);
   if(me){setError(me.message);setLoading(false);return;}
   let bizId=localStorage.getItem('digibiashara_active_business_id')||'';
   let member=(members||[]).find((m:any)=>m.business_id===bizId)|| (members||[])[0];
   if(!member){setError('This account is not linked to an active business.');setLoading(false);return;}
   const isOwner=['owner','business_owner','admin'].includes(String(member.role).toLowerCase());
   if(!isOwner&&(!emp||ee)){setError('This employee has no active branch assignment. Ask the owner to assign a branch.');setLoading(false);return;}
   if(!isOwner&&emp&&emp.business_id!==member.business_id){setError('Employee branch assignment and active business do not match.');setLoading(false);return;}
   const {data:b,error:be}=await d.from('businesses').select('id,name').eq('id',member.business_id).maybeSingle();
   if(be||!b){setError('Business details could not be loaded.');setLoading(false);return;}
   setBusiness(b);setEmployee(isOwner?null:emp);localStorage.setItem('digibiashara_active_business_id',b.id);
   const {data:br,error:bre}=await d.from('branches').select('id,name,is_active').eq('business_id',b.id).eq('is_active',true).order('name');
   if(bre){setError(bre.message);setLoading(false);return;}
   setBranches(br||[]);
   const chosen=(!isOwner&&emp)?emp.branch_id:((br||[]).find((x:any)=>x.id===bizId)?.id||(br||[])[0]?.id||'');
   setBranchId(chosen);if(chosen)await loadProducts(d,b.id,chosen);
   setLoading(false);
  }).catch((e:any)=>{setError(e?.message||'Could not verify this account.');setLoading(false);});
 },[loadProducts,router]);
 useEffect(()=>{if(db&&business&&branchId){setError('');void loadProducts(db,business.id,branchId);setCart({});}},[db,business,branchId,loadProducts]);
 const productsById=useMemo(()=>new Map(products.map((p:any)=>[p.id,p])),[products]);
 const stockById=useMemo(()=>new Map(stock.map((s:any)=>[s.product_id,Number(s.quantity||0)])),[stock]);
 const rows=products.filter((p:any)=>(String(p.name+' '+p.sku+' '+p.barcode+' '+p.category+' '+p.size+' '+p.color).toLowerCase().includes(search.toLowerCase()))).map((p:any)=>({...p,available:p.unit==='service'?999999:(stockById.get(p.id)??0)}));
 const cartItems=Object.entries(cart).map(([id,quantity])=>{const p:any=productsById.get(id);if(!p)return null;const qty=Math.min(quantity,p.unit==='service'?999999:(stockById.get(id)||0));return {...p,quantity:qty,line_total:qty*Number(p.selling_price||0)};}).filter((x:any)=>x&&x.quantity>0);
 const total=cartItems.reduce((n:number,p:any)=>n+p.line_total,0);
 const cashTendered=Number(cashReceived||0);const cashChange=method==='cash'?Math.max(0,cashTendered-total):0;
 const paid=method==='cash'?Math.min(total,cashTendered):method==='credit'?0:Math.min(total,Number(amountPaid===''?total:amountPaid)||0);
 function add(id:string){const p:any=productsById.get(id);if(!p)return;const available=p.unit==='service'?999999:(stockById.get(id)||0);if(available<=0){setError('This product has no stock at the selected branch.');return;}setError('');setCart(prev=>({...prev,[id]:Math.min(available,(prev[id]||0)+1)}));}
 function changeQty(id:string,n:number){const p:any=productsById.get(id);const max=p?.unit==='service'?999999:(stockById.get(id)||0);setCart(prev=>{const next={...prev};if(n<=0)delete next[id];else next[id]=Math.min(max,n);return next;});}
 async function submit(e:FormEvent){e.preventDefault();if(!db||!business||!branchId||!cartItems.length){setError('Choose a branch and add at least one item.');return;}
  if(method==='mpesa'&&paid>0&&!mpesaCode.trim()){setError('Enter the M-Pesa transaction code before completing the sale.');return;}
  if(method==='cash'&&cashTendered<total){setError('Cash received must cover the sale total. Enter the amount the customer handed you.');return;}
  if(method!=='cash'&&method!=='credit'&&paid<=0){setError('Enter the amount paid now.');return;}
  if(method!=='cash'&&paid>total){setError('Amount paid cannot exceed the sale total.');return;}
  setBusy(true);setError('');setNotice('');
  const notePayload=method==='cash'?JSON.stringify({note:notes||null,__digibiashara_payment:{cash_tendered:cashTendered,change_due:cashChange}}):(notes||null);
  const {data,error:e1}=await db.rpc('record_branchpilot_sale',{p_business_id:business.id,p_items:cartItems.map((p:any)=>({product_id:p.id,quantity:p.quantity})),p_payment_method:method,p_amount_paid:paid,p_discount:0,p_notes:notePayload,p_mpesa_code:method==='mpesa'?mpesaCode.trim():null,p_branch_id:branchId});
  if(e1||!data){setError(e1?.message||'Sale could not be saved.');setBusy(false);return;}
  setReceipt({receipt_number:data.receipt_number,items:cartItems.map((p:any)=>({name:p.name,quantity:p.quantity,unit_price:Number(p.selling_price),line_total:p.line_total})),total:Number(data.total),paid:Number(data.amount_paid),balance:Math.max(0,Number(data.total)-Number(data.amount_paid)),method,code:method==='mpesa'?mpesaCode.trim():null,cash:method==='cash'?cashTendered:null,change:method==='cash'?cashChange:0,branch:branches.find((b:any)=>b.id===branchId)?.name||'Branch',business:business.name,employee:employee?.full_name||user?.email,date:new Date().toISOString()});
  setCart({});setCashReceived('');setAmountPaid('');setMpesaCode('');setNotes('');setNotice('Sale saved, inventory reduced, payment and audit records submitted.');await loadProducts(db,business.id,branchId);setBusy(false);
 }
 if(loading)return <main className="bp-auth-page"><div className="bp-auth-card">Opening point of sale…</div></main>;
 if(error&&!business)return <main className="bp-auth-page"><section className="bp-auth-card"><h1>Point of sale access</h1><p className="bp-auth-message">{error}</p><Link href={employee?'/employee/dashboard':'/owner/login'}>Back to workspace</Link></section></main>;
 return <main className="bp-workspace">
  <aside className="bp-sidebar"><Link href={employee?'/employee/dashboard':'/admin/dashboard'} className="bp-sidebar-brand"><span className="bp-brand-mark">B<span>↗</span></span><span><strong>BranchPilot</strong><small>POINT OF SALE</small></span></Link><div className="bp-side-label">WORKSPACE</div><nav className="bp-side-links">{employee?<><Link href="/employee/dashboard"><span>◫</span>My dashboard</Link><Link className="active" href="/employee/new-sale"><span>＋</span>New sale</Link></>:<><Link href="/admin/dashboard"><span>◫</span>Owner dashboard</Link><Link href="/admin/sales"><span>↗</span>Sales & M-Pesa</Link><Link href="/admin/inventory"><span>▤</span>Inventory</Link></>}</nav><div className="bp-side-bottom"><span className="bp-side-avatar">BP</span><div><b>{employee?.full_name||business?.name||'Owner'}</b><small>{branches.find((b:any)=>b.id===branchId)?.name||'Choose branch'}</small></div></div></aside>
  <section className="bp-main"><header className="bp-topbar"><div><div className="bp-eyebrow">BRANCHPILOT / SALES</div><h1>New sale</h1><p>Select the items, record the payment and issue a receipt.</p></div><div className="bp-topbar-actions"><Link className="bp-button secondary" href={employee?'/employee/dashboard':'/admin/dashboard'}>← Back</Link></div></header>
   {error&&<p className="bp-alert">{error}</p>}{notice&&<p className="bp-success">{notice}</p>}
   {receipt&&<section className="bp-panel bp-print-receipt" style={{marginBottom:18}}><div className="bp-panel-heading"><div><h2>Sale completed</h2><p>Receipt {receipt.receipt_number} · {dt(receipt.date)}</p></div><div style={{display:'flex',gap:8}}><button className="bp-button" onClick={()=>window.print()}>Print / Save PDF</button><button className="bp-button secondary" onClick={()=>setReceipt(null)}>Close receipt</button></div></div>
    <div className="bp-receipt-content"><div style={{textAlign:'center',paddingBottom:13,borderBottom:'1px dashed #cdd8ce'}}><h2 style={{fontSize:19,margin:'0 0 5px'}}>{receipt.business}</h2><p style={{margin:0,fontSize:11,color:'#66756a'}}>{receipt.branch}</p><p style={{margin:'8px 0 0',fontSize:10}}>Receipt: <strong>{receipt.receipt_number}</strong></p><p style={{margin:'4px 0 0',fontSize:10}}>{dt(receipt.date)}</p></div>
     <table className="bp-table"><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>TOTAL</th></tr></thead><tbody>{receipt.items.map((p:any,i:number)=><tr key={i}><td>{p.name}</td><td>{p.quantity}</td><td>{money(p.unit_price)}</td><td>{money(p.line_total)}</td></tr>)}</tbody></table>
     <div style={{borderTop:'1px dashed #cdd8ce',paddingTop:12,display:'grid',gap:7,fontSize:11}}><div style={{display:'flex',justifyContent:'space-between'}}><span>Total</span><strong>{money(receipt.total)}</strong></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Paid via {receipt.method.toUpperCase()}</span><strong>{money(receipt.paid)}</strong></div>{receipt.code&&<div style={{display:'flex',justifyContent:'space-between',gap:12}}><span>M-Pesa transaction code</span><strong>{receipt.code}</strong></div>}{receipt.method==='cash'&&<><div style={{display:'flex',justifyContent:'space-between'}}><span>Cash received</span><strong>{money(receipt.cash)}</strong></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Change returned</span><strong>{money(receipt.change)}</strong></div></>}<div style={{display:'flex',justifyContent:'space-between'}}><span>Balance due</span><strong>{money(receipt.balance)}</strong></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Served by</span><strong>{receipt.employee}</strong></div></div>
    </div></section>}
   <div className="bp-grid" style={{gridTemplateColumns:'minmax(0,1.2fr) minmax(300px,.8fr)',alignItems:'start'}}>
    <section className="bp-panel"><div className="bp-panel-heading"><div><h2>Choose products</h2><p>Available stock is specific to the selected branch.</p></div><span className="bp-pill">{rows.length} products</span></div>
     {!employee&&<label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginBottom:12}}>Sale branch<select className="bp-field" value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Choose branch</option>{branches.map((b:any)=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>}
     <input className="bp-field" style={{width:'100%',marginBottom:13}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, SKU, barcode or category"/>
     <div className="bp-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))'}}>{rows.map((p:any)=><button type="button" key={p.id} className="bp-action-tile" disabled={p.available<=0&&p.unit!=='service'} onClick={()=>add(p.id)} style={{alignItems:'flex-start',textAlign:'left',cursor:'pointer',opacity:(p.available<=0&&p.unit!=='service')?0.55:1}}><span className="tile-icon">＋</span><span style={{flex:1}}><b>{p.name}</b><small>{p.category||'Retail item'} {p.size?'· '+p.size:''} {p.color?'· '+p.color:''}</small><strong style={{display:'block',marginTop:7,fontSize:12}}>{money(p.selling_price)}</strong><small>{p.unit==='service'?'Service':String(p.available)+' available'}</small></span></button>)}</div>
     {!rows.length&&<div className="bp-empty">No products found. The owner must create products and set opening stock for this branch.</div>}
    </section>
    <form className="bp-panel" onSubmit={submit}><div className="bp-panel-heading"><div><h2>Current sale</h2><p>{cartItems.length} line items · {branches.find((b:any)=>b.id===branchId)?.name||'No branch selected'}</p></div></div>
     {!cartItems.length?<div className="bp-empty">Add a product to begin.</div>:<div style={{display:'grid',gap:11}}>{cartItems.map((p:any)=><div key={p.id} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:7,alignItems:'center',paddingBottom:10,borderBottom:'1px solid #edf1ec'}}><span><b style={{fontSize:11}}>{p.name}</b><small style={{display:'block',fontSize:9,color:'#829086',marginTop:4}}>{money(p.selling_price)} each</small></span><span style={{display:'flex',alignItems:'center',gap:5}}><button type="button" className="bp-button secondary" style={{padding:'5px 8px'}} onClick={()=>changeQty(p.id,p.quantity-1)}>−</button><strong style={{fontSize:11}}>{p.quantity}</strong><button type="button" className="bp-button secondary" style={{padding:'5px 8px'}} onClick={()=>changeQty(p.id,p.quantity+1)}>＋</button></span><span style={{fontSize:10,color:'#526357'}}>{money(p.line_total)}</span><button type="button" className="bp-button secondary" style={{gridColumn:'2',padding:'5px 8px'}} onClick={()=>changeQty(p.id,0)}>Remove</button></div>)}</div>}
     <div style={{display:'flex',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid #e7ede6',fontSize:12}}><span>Sale total</span><strong>{money(total)}</strong></div>
     <label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginTop:13}}>Payment method<select className="bp-field" value={method} onChange={e=>{setMethod(e.target.value);setAmountPaid('');setCashReceived('');}}><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="credit">Credit / pay later</option><option value="other">Other</option></select></label>
     {method==='cash'?<label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginTop:10}}>Cash received (KES)<input className="bp-field" type="number" min={total} step="0.01" required value={cashReceived} onChange={e=>setCashReceived(e.target.value)} placeholder={total.toFixed(2)}/></label>:method!=='credit'?<label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginTop:10}}>Amount paid now (KES)<input className="bp-field" type="number" min="0" max={total} step="0.01" required value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} placeholder={total.toFixed(2)}/></label>:null}
     {method==='mpesa'&&<label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginTop:10}}>M-Pesa transaction code<input className="bp-field" required value={mpesaCode} onChange={e=>setMpesaCode(e.target.value.toUpperCase().replace(/\s/g,''))} maxLength={32} placeholder="e.g. QAB12CDE34"/></label>}
     <label style={{display:'grid',gap:6,fontSize:10,fontWeight:800,color:'#617168',marginTop:10}}>Sale notes (optional)<input className="bp-field" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional note"/></label>
     <div style={{background:'#f5f8f3',borderRadius:12,padding:13,display:'grid',gap:9,marginTop:14,fontSize:11}}><div style={{display:'flex',justifyContent:'space-between'}}><span>Total</span><strong>{money(total)}</strong></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Amount applied</span><strong>{money(paid)}</strong></div>{method==='cash'&&<div style={{display:'flex',justifyContent:'space-between'}}><span>Change to return</span><strong>{money(cashChange)}</strong></div>}<div style={{display:'flex',justifyContent:'space-between'}}><span>Balance due</span><strong>{money(Math.max(0,total-paid))}</strong></div></div>
     <button className="bp-button" style={{width:'100%',marginTop:15,padding:14}} disabled={busy||!cartItems.length||!branchId}>{busy?'Saving sale…':'Complete sale and issue receipt'}</button>
     <p className="bp-map-note" style={{marginTop:10}}>Inventory, payment, receipt reference, M-Pesa transaction code and audit record are saved together by the database transaction. Stock is not allowed to go negative.</p>
    </form>
   </div>
  </section>
  <style jsx global>{`@media print {body *{visibility:hidden!important}.bp-print-receipt,.bp-print-receipt *{visibility:visible!important}.bp-print-receipt{position:absolute!important;left:0!important;top:0!important;width:100%!important;box-shadow:none!important;border:0!important}.bp-print-receipt button{display:none!important}.bp-receipt-content{max-width:680px!important;margin:0 auto!important}.bp-sidebar,.bp-topbar{display:none!important}@page{margin:12mm}}`}</style>
 </main>;
}

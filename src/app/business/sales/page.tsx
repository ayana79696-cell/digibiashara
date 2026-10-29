'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Product = { id: string; name: string; sku: string | null; unit: string; selling_price: number; quantity: number };
type Sale = { id: string; receipt_number: string; subtotal: number; discount: number; total: number; amount_paid: number; payment_status: string; sold_at: string };
type Payment = { id: string; sale_id: string; amount: number; method: string; status: string; paid_at: string; metadata: Record<string, unknown> | null };
type DailySale = Sale & { payment_method: string; payment_amount: number; cash_tendered: number; change_due: number };
type Receipt = {
  receipt_number: string;
  items: { name: string; quantity: number; unit_price: number; line_total: number }[];
  subtotal: number; discount: number; total: number; amount_paid: number; balance: number;
  payment_status: string; payment_method: string; date: string; business_name: string;
  cash_tendered: number | null; change_due: number;
};

const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(Number(value || 0));
const kenyaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
};
const dayRange = (day: string) => {
  const start = new Date(day + 'T00:00:00+03:00');
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
};
const dateTime = (value: string) => new Date(value).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });

export default function SalesPage() {
  const [db, setDb] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [method, setMethod] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reportDate, setReportDate] = useState(kenyaToday);
  const [dailyRows, setDailyRows] = useState<DailySale[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const load = useCallback(async (client: any, uid: string) => {
    setLoading(true);
    setError('');
    const selectedId = typeof window !== 'undefined' ? window.localStorage.getItem('digibiashara_active_business_id') : null;
    let membershipQuery = client.from('business_memberships').select('business_id,role,is_active').eq('user_id', uid).eq('is_active', true);
    if (selectedId) membershipQuery = membershipQuery.eq('business_id', selectedId);
    const { data: membership, error: membershipError } = await membershipQuery.limit(1).maybeSingle();
    if (membershipError || !membership) {
      setError(membershipError?.message || (selectedId ? 'The selected business is not available to your account.' : 'No active business membership found. Ask your administrator to finish account setup.'));
      setLoading(false);
      return;
    }
    const { data: businessRow, error: businessError } = await client.from('businesses').select('id,name,business_type,status').eq('id', membership.business_id).maybeSingle();
    if (businessError || !businessRow) {
      setError(businessError?.message || 'Your business could not be found. Check its status with the administrator.');
      setLoading(false);
      return;
    }
    setBusiness(businessRow);
    const { data: productRows, error: productError } = await client.from('products').select('id,name,sku,unit,selling_price,quantity').eq('business_id', businessRow.id).eq('is_active', true).order('name');
    if (productError) setError(productError.message);
    else setProducts(((productRows || []) as Product[]).filter((p) => p.unit === 'service' || Number(p.quantity) > 0));
    setLoading(false);
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setError('Supabase is not configured.'); setLoading(false); return; }
    const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    setDb(client);
    client.auth.getUser().then(({ data, error: authError }) => {
      if (authError || !data.user) { location.href = '/login'; return; }
      setUser(data.user);
      void load(client, data.user.id);
    });
  }, [load]);

  const loadDailyReport = useCallback(async () => {
    if (!db || !business || !reportDate) return;
    setReportLoading(true);
    setReportError('');
    const range = dayRange(reportDate);
    const { data: saleRows, error: salesError } = await db.from('sales')
      .select('id,receipt_number,subtotal,discount,total,amount_paid,payment_status,sold_at')
      .eq('business_id', business.id).gte('sold_at', range.start).lt('sold_at', range.end).order('sold_at', { ascending: false });
    if (salesError) {
      setReportError('Could not load this day’s sales: ' + salesError.message);
      setDailyRows([]);
      setReportLoading(false);
      return;
    }
    const daySales = (saleRows || []) as Sale[];
    if (!daySales.length) { setDailyRows([]); setReportLoading(false); return; }
    const { data: paymentRows, error: paymentsError } = await db.from('payments')
      .select('id,sale_id,amount,method,status,paid_at,metadata')
      .eq('business_id', business.id).in('sale_id', daySales.map((sale) => sale.id)).order('paid_at', { ascending: false });
    if (paymentsError) {
      setReportError('Sales loaded, but payment details could not be loaded: ' + paymentsError.message);
      setDailyRows([]);
      setReportLoading(false);
      return;
    }
    const bySale = new Map<string, Payment[]>();
    for (const payment of ((paymentRows || []) as Payment[])) bySale.set(payment.sale_id, [...(bySale.get(payment.sale_id) || []), payment]);
    const rows: DailySale[] = daySales.map((sale) => {
      const payments = bySale.get(sale.id) || [];
      const recorded = payments.filter((payment) => payment.status === 'recorded');
      const methods = [...new Set(recorded.map((payment) => payment.method))];
      const tendered = payments.reduce((sum, payment) => {
        if (payment.method !== 'cash') return sum;
        const saved = Number(payment.metadata?.cash_tendered);
        return sum + (Number.isFinite(saved) ? saved : Number(payment.amount || 0));
      }, 0);
      const change = payments.reduce((sum, payment) => {
        const saved = Number(payment.metadata?.change_due || 0);
        return sum + (Number.isFinite(saved) ? saved : 0);
      }, 0);
      return {
        ...sale,
        payment_method: methods.length ? methods.map((value) => value.toUpperCase()).join(' + ') : 'Unpaid / credit',
        payment_amount: recorded.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        cash_tendered: tendered,
        change_due: change,
      };
    });
    setDailyRows(rows);
    setReportLoading(false);
  }, [db, business, reportDate]);

  useEffect(() => { void loadDailyReport(); }, [loadDailyReport]);

  const cartItems = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return product ? { ...product, quantity, line_total: Number(product.selling_price) * quantity } : null;
  }).filter(Boolean) as (Product & { quantity: number; line_total: number })[], [cart, products]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.line_total, 0);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);
  const receivedValue = paid === '' ? (method === 'credit' ? 0 : total) : Math.max(0, Number(paid) || 0);
  const appliedValue = Math.min(total, receivedValue);
  const changeDue = method === 'cash' ? Math.max(0, receivedValue - total) : 0;
  const balanceDue = Math.max(0, total - appliedValue);

  const dailyTotals = useMemo(() => dailyRows.reduce((sum, row) => ({
    sales: sum.sales + Number(row.total || 0),
    collected: sum.collected + Number(row.payment_amount || 0),
    balance: sum.balance + Math.max(0, Number(row.total || 0) - Number(row.amount_paid || 0)),
    cashTendered: sum.cashTendered + Number(row.cash_tendered || 0),
    change: sum.change + Number(row.change_due || 0),
    count: sum.count + 1,
  }), { sales: 0, collected: 0, balance: 0, cashTendered: 0, change: 0, count: 0 }), [dailyRows]);

  function addProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const requested = Math.max(1, Number(qtyInputs[id]) || 1);
    const max = product.unit === 'service' ? 999999 : Number(product.quantity);
    setCart((old) => ({ ...old, [id]: Math.min(max, (old[id] || 0) + requested) }));
    setQtyInputs((old) => ({ ...old, [id]: '1' }));
    setNotice('Item added to the sale.');
    setError('');
  }

  function changeQuantity(id: string, quantity: number) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const max = product.unit === 'service' ? 999999 : Number(product.quantity);
    setCart((old) => {
      const next = { ...old };
      if (quantity <= 0) delete next[id];
      else next[id] = Math.min(max, quantity);
      return next;
    });
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !business || !cartItems.length) return;
    setError('');
    setNotice('');
    if (discountValue > subtotal) { setError('Discount cannot exceed the subtotal.'); return; }
    if (method !== 'cash' && receivedValue > total) { setError('The amount being paid cannot exceed the sale total. Only cash payments can include change returned.'); return; }
    setSaving(true);
    const itemsPayload = cartItems.map((item) => ({ product_id: item.id, quantity: item.quantity }));
    const notesPayload = method === 'cash'
      ? JSON.stringify({ note: notes || null, __digibiashara_payment: { cash_tendered: receivedValue, change_due: changeDue } })
      : (notes || null);
    const { data, error: saveError } = await db.rpc('record_business_sale', {
      p_business_id: business.id,
      p_items: itemsPayload,
      p_payment_method: method,
      p_amount_paid: appliedValue,
      p_discount: discountValue,
      p_notes: notesPayload,
    });
    if (saveError || !data) {
      setError(saveError?.message || 'The sale could not be saved.');
      setSaving(false);
      return;
    }
    const newReceipt: Receipt = {
      receipt_number: data.receipt_number,
      items: cartItems.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: Number(item.selling_price), line_total: item.line_total })),
      subtotal: Number(data.subtotal), discount: Number(data.discount), total: Number(data.total),
      amount_paid: Number(data.amount_paid), balance: Math.max(0, Number(data.total) - Number(data.amount_paid)),
      payment_status: data.payment_status, payment_method: method, date: dateTime(new Date().toISOString()),
      business_name: business.name,
      cash_tendered: method === 'cash' ? Number(data.cash_tendered ?? receivedValue) : null,
      change_due: method === 'cash' ? Number(data.change_due ?? changeDue) : 0,
    };
    setReceipt(newReceipt);
    setCart({});
    setDiscount('0');
    setPaid('');
    setNotes('');
    setNotice('Sale saved successfully. Cash tendered and change returned are included on the receipt.');
    setSaving(false);
    await load(db, user.id);
    await loadDailyReport();
  }

  async function signOut() { await db?.auth.signOut(); location.href = '/login'; }

  function printDailyReport() {
    document.body.classList.add('print-daily-report');
    const cleanup = () => document.body.classList.remove('print-daily-report');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 2500);
  }

  if (loading) return <main className="wrap"><section className="panel">Loading sales workspace…</section></main>;
  if (!business) return (
    <main className="wrap">
      <nav className="nav"><Link className="logo" href="/">DigiBiashara</Link><button className="button alt" onClick={signOut}>Sign out</button></nav>
      <section className="panel form"><h1>Sales access unavailable</h1><p className="notice">{error || 'Your business is not currently available.'}</p><Link className="button" href="/businesses">Return to My Businesses</Link></section>
    </main>
  );

  return (
    <main className="business-shell">
      <aside className="admin-side">
        <Link className="logo" href="/">DigiBiashara<span className="logo-dot">.</span></Link>
        <p className="side-label">BUSINESS WORKSPACE</p>
        <Link className="side-link" href="/business"><span>◫</span>Overview</Link>
        <Link className="side-link" href="/business#stock"><span>▦</span>Inventory</Link>
        <Link className="side-link" href="/business/stock"><span>↕</span>Stock movements</Link>
        <Link className="side-link selected" href="/business/sales"><span>▤</span>Sales & receipts</Link>
        <Link className="side-link" href="/business/expenses"><span>↘</span>Expenses</Link>
        <Link className="side-link" href="/business/customers"><span>♙</span>Customers</Link>
        <Link className="side-link" href="/businesses"><span>⌂</span>My businesses</Link>
        <div className="side-bottom"><span className="avatar">DB</span><div><b>{business.name}</b><small>{user?.email}</small></div><button className="text-button" onClick={signOut}>Sign out</button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-top"><div><div className="eyebrow">{business.business_type?.replaceAll('_', ' ').toUpperCase()}</div><h1>Sales & receipts</h1></div><span className="pill green">● Active workspace</span></header>
        {error && <p className="notice" role="alert">{error}</p>}
        {notice && <p className="success-note" role="status">{notice}</p>}

        {receipt && <section className="receipt-print" aria-label="Sales receipt">
          <div className="receipt-head"><div className="receipt-brand">DigiBiashara</div><h2>{receipt.business_name}</h2><p>SALES RECEIPT</p><strong>{receipt.receipt_number}</strong><small>{receipt.date}</small></div>
          <div className="receipt-lines">{receipt.items.map((item, index) => <div className="receipt-line" key={item.name + '-' + index}><span>{item.name}<small>{item.quantity} × {money(item.unit_price)}</small></span><b>{money(item.line_total)}</b></div>)}</div>
          <div className="receipt-totals">
            <div><span>Subtotal</span><b>{money(receipt.subtotal)}</b></div>
            {receipt.discount > 0 && <div><span>Discount</span><b>-{money(receipt.discount)}</b></div>}
            <div className="receipt-grand"><span>TOTAL</span><b>{money(receipt.total)}</b></div>
            <div><span>Paid via {receipt.payment_method.toUpperCase()}</span><b>{money(receipt.amount_paid)}</b></div>
            {receipt.payment_method === 'cash' && <><div><span>Cash received</span><b>{money(receipt.cash_tendered || 0)}</b></div><div className="receipt-change"><span>CHANGE RETURNED</span><b>{money(receipt.change_due)}</b></div></>}
            <div><span>Balance due</span><b>{money(receipt.balance)}</b></div>
            <div><span>Payment status</span><b>{receipt.payment_status.toUpperCase()}</b></div>
          </div>
          <p className="receipt-thanks">Thank you for your business.</p>
          <div className="receipt-actions"><button className="button" onClick={() => window.print()}>Print receipt</button><button className="button alt" onClick={() => setReceipt(null)}>Close receipt</button></div>
        </section>}

        <div className="sales-layout">
          <section className="content-card">
            <div className="card-heading"><div><h3>Products & services</h3><p>Choose items to add to the sale. Service items do not deduct stock.</p></div></div>
            <div className="product-pick-list">
              {products.map((product) => <div className="product-pick" key={product.id}>
                <div><b>{product.name}</b><small>{product.unit === 'service' ? 'Service · no stock deduction' : (product.sku || product.unit) + ' · ' + product.quantity + ' in stock'}</small><strong>{money(Number(product.selling_price))}</strong></div>
                <div className="pick-action"><input aria-label={'Quantity for ' + product.name} type="number" min="1" max={product.unit === 'service' ? 999999 : product.quantity} step="1" value={qtyInputs[product.id] ?? '1'} onChange={(event) => setQtyInputs((old) => ({ ...old, [product.id]: event.target.value }))} /><button className="button small-button" type="button" onClick={() => addProduct(product.id)}>Add</button></div>
              </div>)}
              {!products.length && <p className="empty">No sellable items found. Add inventory products or service items in your workspace first.</p>}
            </div>
          </section>

          <section className="content-card sale-cart">
            <div className="card-heading"><div><h3>Current sale</h3><p>{cartItems.length} item line(s)</p></div></div>
            <form onSubmit={submitSale}>
              <div className="cart-lines">
                {cartItems.map((product) => <div className="cart-line" key={product.id}>
                  <div><b>{product.name}</b><small>{money(Number(product.selling_price))} each</small></div>
                  <input aria-label={'Sale quantity for ' + product.name} type="number" min="0" max={product.unit === 'service' ? 999999 : product.quantity} step="1" value={product.quantity} onChange={(event) => changeQuantity(product.id, Number(event.target.value))} />
                  <b>{money(product.line_total)}</b>
                </div>)}
                {!cartItems.length && <p className="empty">Add a product or service to begin.</p>}
              </div>
              <label>Discount (KSh)<input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
              <div className="cart-total"><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <div className="cart-total"><span>Sale total</span><b>{money(total)}</b></div>
              <label>Payment method<select value={method} onChange={(event) => { setMethod(event.target.value); setPaid(''); }}>
                <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="credit">Credit / pay later</option><option value="other">Other</option>
              </select></label>
              <label>{method === 'cash' ? 'Cash received from customer (KSh)' : 'Amount being paid now (KSh)'}
                <input type="number" min="0" max={method === 'cash' ? undefined : total} step="0.01" placeholder={String(method === 'credit' ? 0 : total)} value={paid} onChange={(event) => setPaid(event.target.value)} />
              </label>
              <div className="cash-summary" aria-live="polite">
                <div><span>Sale total</span><b>{money(total)}</b></div>
                {method === 'cash' && <><div><span>Cash received</span><b>{money(receivedValue)}</b></div><div className={changeDue > 0 ? 'change-highlight' : ''}><span>Change to return</span><b>{money(changeDue)}</b></div></>}
                <div><span>Payment applied</span><b>{money(appliedValue)}</b></div><div><span>Remaining balance</span><b>{money(balanceDue)}</b></div>
              </div>
              <label>Notes (optional)<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer name or order note" /></label>
              <button className="button full-button" disabled={saving || !cartItems.length}>{saving ? 'Saving sale…' : 'Complete sale & generate receipt'}</button>
              <p className="muted tiny">Cash change is calculated automatically. The sale, payment, receipt and eligible stock movements are saved together.</p>
            </form>
          </section>
        </div>

        <section className="content-card daily-report-print-area">
          <div className="daily-report-heading">
            <div><div className="eyebrow">CASHIER REPORT</div><h3>Daily sales & payments</h3><p>All sales recorded on the selected date, including payment methods, balances and change returned.</p></div>
            <div className="daily-report-controls">
              <label>Report date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
              <button className="button" type="button" disabled={reportLoading} onClick={printDailyReport}>{reportLoading ? 'Loading…' : 'Print / Save PDF'}</button>
              <button className="button alt" type="button" disabled={reportLoading} onClick={() => void loadDailyReport()}>Refresh</button>
            </div>
          </div>
          {reportError && <p className="notice" role="alert">{reportError}</p>}
          <div className="metric-grid daily-report-metrics">
            <div className="metric"><span>Transactions</span><strong>{dailyTotals.count}</strong><small>Selected date</small></div>
            <div className="metric"><span>Total sales</span><strong>{money(dailyTotals.sales)}</strong><small>Net of discounts</small></div>
            <div className="metric"><span>Payments collected</span><strong>{money(dailyTotals.collected)}</strong><small>Recorded payments</small></div>
            <div className="metric"><span>Balance outstanding</span><strong>{money(dailyTotals.balance)}</strong><small>Still owed by customers</small></div>
            <div className="metric"><span>Cash handed over</span><strong>{money(dailyTotals.cashTendered)}</strong><small>Cash tendered</small></div>
            <div className="metric"><span>Change returned</span><strong>{money(dailyTotals.change)}</strong><small>Cash change</small></div>
          </div>
          <div className="daily-report-print-meta"><b>{business.name}</b><span>Daily payments report · {reportDate}</span><span>Currency: KSh</span></div>
          <div className="table-wrap">
            <table className="daily-report-table">
              <thead><tr><th>Time</th><th>Receipt</th><th>Method</th><th>Total</th><th>Paid</th><th>Balance</th><th>Cash tendered</th><th>Change</th><th>Status</th></tr></thead>
              <tbody>{dailyRows.map((sale) => <tr key={sale.id}>
                <td>{new Date(sale.sold_at).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })}</td>
                <td><b>{sale.receipt_number}</b></td><td>{sale.payment_method}</td><td>{money(Number(sale.total))}</td><td>{money(Number(sale.payment_amount))}</td>
                <td>{money(Math.max(0, Number(sale.total) - Number(sale.amount_paid)))}</td><td>{sale.cash_tendered ? money(sale.cash_tendered) : '—'}</td><td>{sale.change_due ? money(sale.change_due) : '—'}</td>
                <td><span className={'status ' + sale.payment_status}>{sale.payment_status}</span></td>
              </tr>)}</tbody>
            </table>
            {!dailyRows.length && !reportLoading && !reportError && <p className="empty">No sales were recorded for {reportDate}.</p>}
            {reportLoading && <p className="empty">Loading daily transactions…</p>}
          </div>
          <div className="daily-report-footer"><span>Generated from DigiBiashara sales and payment entries.</span><span>Printed on {dateTime(new Date().toISOString())}</span></div>
        </section>
        <footer className="admin-footer">DigiBiashara · Sales and receipts · KSh</footer>
      </section>
    </main>
  );
}

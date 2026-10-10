// ===================== rep device: local storage, outbox, sync worker =====================
const BACKOFF = [5, 15, 60, 300];
const Dev = {
  uid:null, st:null, syncing:false, timer:null, onChange:()=>{},
  load(uid){
    this.uid = uid;
    this.st = store.get('oilrep.dev.' + uid) || { outbox:[], cache:null, inv:{}, draft:null, gps:'at_shop', pos:{ lat:24.7136, lng:46.6753 }, lastSync:null };
  },
  save(){ store.set('oilrep.dev.' + this.uid, this.st); },
  pending(){ return this.st.outbox.filter(o => o.status === 'pending' || o.status === 'sending').length; },
  failed(){ return this.st.outbox.filter(o => o.status === 'failed'); },
  syncState(){ return this.failed().length ? 'bad' : this.pending() ? 'warn' : 'ok'; },
  enqueue(op, client_uuid, payload){
    this.st.outbox.push({ id:uuid(), op_type:op, rpc:op, client_uuid, payload, status:'pending', attempts:0, last_error:null, created_at:Date.now(), nextTryAt:0 });
    this.save(); setTimeout(() => this.sync(false), 50);
    return this.st.outbox[this.st.outbox.length - 1];
  },
  start(){ this.stop(); this.timer = setInterval(() => this.sync(false), 4000); },   // spec: every 60 s; shortened so the demo is lively
  stop(){ if (this.timer) clearInterval(this.timer); this.timer = null; },

  async refresh(){
    if (Net.blocked() || this.pending() > 0 || this.failed().length) return false;     // spec: refresh only after the outbox drains
    try {
      const s = await readSnap(this.uid);
      this.st.cache = { at:Date.now(), me:s.me, regions:s.regions, products:s.products, customers:s.customers, van:s.van, transfers:s.transfers,
        invoices:s.invoices, colls:s.colls, open:s.open, targets:s.targets, visits:s.visits, settings:s.settings || {} };
      // local records that the server now owns can go
      Object.keys(this.st.inv).forEach(k => { if (this.st.inv[k].status === 'synced') delete this.st.inv[k]; });
      this.st.outbox = this.st.outbox.filter(o => o.status !== 'synced' || Date.now() - o.created_at < 600000);
      this.save(); return true;
    } catch(e){ return false; }
  },

  async sync(manual){
    if (this.syncing || Net.blocked()) return;
    const now = Date.now();
    const rows = this.st.outbox.filter(o => (o.status === 'pending' && (manual || o.nextTryAt <= now)) || (manual && o.status === 'failed'));
    if (!rows.length) { if (this.st.cache === null || !this.st.cache.at || (this.pending() === 0 && !this.failed().length && now - (this.st.cache.at||0) > 30000)) { await this.refresh(); this.onChange(); } return; }
    this.syncing = true; this.onChange();
    try {
      for (const o of rows.sort((a,b) => a.created_at - b.created_at)) {
        o.status = 'sending'; this.save();
        try {
          const res = await api(this.uid, o.rpc, o.payload);
          o.status = 'synced'; o.result = res; o.last_error = null; this.applySynced(o, res);
        } catch(e) {
          if (e instanceof NetError) { o.status = 'pending'; o.attempts++; o.nextTryAt = Date.now() + BACKOFF[Math.min(o.attempts-1, 3)]*1000; this.save(); break; }
          o.status = 'failed'; o.last_error = e.message; this.markFailed(o); this.save(); break;   // business error: stop and alert
        }
        this.save(); this.onChange();
      }
      this.st.lastSync = Date.now();
    } finally { this.syncing = false; this.save(); }
    if (this.pending() === 0 && !this.failed().length) await this.refresh();
    this.onChange();
  },
  applySynced(o, res){
    if (o.op_type === 'submit_invoice') {
      const l = this.st.inv[o.client_uuid]; if (l) Object.assign(l, { status:'synced', number:res.invoice_number, total:res.total, balance_due:res.balance_due, flags:res.flags, invoice_id:res.invoice_id });
    }
  },
  markFailed(o){ const l = this.st.inv[o.client_uuid]; if (l) l.status = 'failed'; },
  retry(id){ const o = this.st.outbox.find(x => x.id === id); if (o) { o.status = 'pending'; o.nextTryAt = 0; this.save(); this.sync(true); } },
  discard(id){
    const o = this.st.outbox.find(x => x.id === id); if (!o) return;
    this.st.outbox = this.st.outbox.filter(x => x.id !== id); delete this.st.inv[o.client_uuid]; this.save();
    this.refresh().then(() => this.onChange());
  },

  // ---------- cache accessors (always work offline)
  c(){ return this.st.cache || { products:[], customers:[], van:[], transfers:[], invoices:[], colls:[], open:[], targets:[], visits:[], regions:[], settings:{} }; },
  vanQty(pid){ const v = this.c().van.find(x => x.product_id === pid); return v ? v.qty : 0; },
  product(pid){ return this.c().products.find(p => p.id === pid); },
  customer(cid){ return this.c().customers.find(c => c.id === cid); },
  estimate(items){
    let sub = 0, vat = 0;
    Object.entries(items).forEach(([pid, q]) => { const p = this.product(+pid); if (p && q > 0) { sub += q * p.price; vat += r2(q * p.price * p.vat / 100); } });
    return { subtotal:r2(sub), vat:r2(vat), total:r2(sub + vat) };
  },
  allInvoices(){
    const c = this.c(), srv = c.invoices.map(i => ({ ...i, _state:'synced' }));
    const seen = new Set(srv.map(i => i.client_uuid));
    const loc = Object.values(this.st.inv).filter(l => !seen.has(l.client_uuid)).map(l => ({
      id:null, client_uuid:l.client_uuid, invoice_number:l.number, customer_id:l.customer_id, shop_name_snapshot:l.shop, payment_type:l.payment_type,
      total:l.total || l.est_total, paid_at_sale:l.paid, amount_paid:l.paid, balance_due:l.balance_due != null ? l.balance_due : r2((l.est_total||0) - l.paid), due_date:l.due,
      synced_at:new Date(l.created_at).toISOString(), device_created_at:new Date(l.created_at).toISOString(), status:'posted', flags:l.flags||[],
      items:Object.entries(l.items).map(([p,q]) => ({ product_id:+p, qty:q, unit_price:(this.product(+p)||{}).price||0, line_total:r2(q*((this.product(+p)||{}).price||0)) })),
      _state: l.status === 'failed' ? 'failed' : (l.status === 'synced' ? 'synced' : 'pending'), _err:(this.st.outbox.find(o => o.client_uuid === l.client_uuid)||{}).last_error }));
    return [...loc, ...srv].sort((a,b) => new Date(b.device_created_at) - new Date(a.device_created_at));
  },
  // credit documents the rep can collect against, with pending local collections already applied
  openItems(cid){
    const c = this.c(), applied = {};
    this.st.outbox.filter(o => o.op_type === 'record_collection' && o.status !== 'synced').forEach(o => {
      const k = o.payload.invoice_id ? 'i' + o.payload.invoice_id : 'o' + o.payload.opening_receivable_id; applied[k] = (applied[k]||0) + o.payload.amount; });
    const out = [];
    c.invoices.filter(i => i.customer_id === cid && i.status === 'posted' && i.balance_due > 0).forEach(i => out.push({ kind:'invoice', id:i.id, label:i.invoice_number, due:i.due_date, balance:r2(i.balance_due - (applied['i'+i.id]||0)) }));
    c.open.filter(o => o.customer_id === cid && o.balance_due > 0).forEach(o => out.push({ kind:'opening', id:o.id, label:o.note || 'Opening balance', due:o.due_date, balance:r2(o.balance_due - (applied['o'+o.id]||0)) }));
    return out.filter(x => x.balance > 0).sort((a,b) => String(a.due).localeCompare(String(b.due)));
  },
  outstanding(cid){ return r2(this.openItems(cid).reduce((s,x) => s + x.balance, 0)); },
  pseudoSnap(){
    const c = this.c(), me = c.me || { id:this.uid, full_name:'' };
    const pend = this.allInvoices().filter(i => i._state !== 'synced').map(i => ({ ...i, rep_id:this.uid }));
    const pendColl = this.st.outbox.filter(o => o.op_type === 'record_collection' && o.status !== 'synced').map(o => ({ rep_id:this.uid, amount:o.payload.amount, method:o.payload.method, collected_at:o.payload.collected_at }));
    return { targets:c.targets, users:[me], invoices:[...c.invoices.filter(i => i.rep_id === this.uid), ...pend], colls:[...c.colls, ...pendColl] };
  },

  // ---------- simulated GPS (the sandbox cannot give real coordinates)
  gps(cust){
    const m = this.st.gps; if (m === 'denied') return { denied:true };
    const base = cust && cust.loc ? cust.loc : this.st.pos, j = () => (Math.random() - .5) * 0.00018;
    if (m === 'near') return { lat:base.lat + 0.0008, lng:base.lng, acc:20 };
    if (m === 'far') return { lat:base.lat + 0.08, lng:base.lng + 0.03, acc:15 };
    if (m === 'poor') return { lat:base.lat + j(), lng:base.lng + j(), acc:180 };
    if (m === 'mock') return { lat:base.lat + j(), lng:base.lng + j(), acc:8, mock:true };
    return { lat:base.lat + j(), lng:base.lng + j(), acc:12 };
  }
};

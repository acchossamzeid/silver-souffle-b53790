// ===================== Supabase data layer (production build) =====================
const CFG = window.OILREP_CONFIG || {};
const BASE = String(CFG.SUPABASE_URL || '').trim().replace(/\/+$/, '');     // a trailing / in config.js is harmless
class AuthExpired extends NetError {}
class SetupError extends BizError { constructor(code, msg){ super(msg); this.code = code; } }   // a configuration problem, not a typing mistake          // keeps queued work pending; the user just signs in again
const Net = { offline:false, loseNext:0, latency:0, blocked(){ return false; } };   // real fetch errors decide connectivity
const configOk = () => CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/YOUR-|PASTE/i.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY);

const Auth = {
  session: store.get('oilrep.session'), expired:false,
  save(s){ this.session = s; store.set('oilrep.session', s); },
  async _token(grant, body){
    let res; try { res = await fetch(BASE + '/auth/v1/token?grant_type=' + grant, { method:'POST', headers:{ apikey:CFG.SUPABASE_ANON_KEY, 'Content-Type':'application/json' }, body:JSON.stringify(body) }); }
    catch(e){ throw new NetError('network'); }
    if (res.status >= 500) throw new NetError('auth server');
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const m = String(j.msg || j.message || j.error_description || j.error || '');
      if (res.status === 401 || res.status === 403 || /api key|apikey/i.test(m)) throw new SetupError('bad_key', m);
      if (res.status === 404) throw new SetupError('bad_url', m);
      throw new BizError(m || 'login failed');                 // 400 = wrong email or password
    }
    this.save({ access_token:j.access_token, refresh_token:j.refresh_token, expires_at:Date.now() + (j.expires_in || 3600) * 1000, uid:j.user.id });
    this.expired = false; return this.session;
  },
  login(email, password){ return this._token('password', { email:email.trim(), password }); },
  async refresh(){
    if (!this.session) throw new AuthExpired('no session');
    try { return await this._token('refresh_token', { refresh_token:this.session.refresh_token }); }
    catch(e){ if (e instanceof BizError) { this.expired = true; throw new AuthExpired('session expired'); } throw e; }
  },
  async token(){
    if (!this.session) { this.expired = true; throw new AuthExpired('no session'); }
    if (Date.now() > this.session.expires_at - 60000) await this.refresh();
    return this.session.access_token;
  },
  logout(){ this.session = null; this.expired = false; store.del('oilrep.session'); }
};

async function rest(method, path, body, headers, retried){
  const tok = await Auth.token();
  let res;
  try {
    res = await fetch(BASE + '/rest/v1/' + path, { method, headers:{ apikey:CFG.SUPABASE_ANON_KEY, Authorization:'Bearer ' + tok, 'Content-Type':'application/json', ...(headers || {}) }, body:body === undefined ? undefined : JSON.stringify(body) });
  } catch(e){ Net.offline = true; throw new NetError('network'); }
  Net.offline = false;
  if (res.status === 401 && !retried) { await Auth.refresh(); return rest(method, path, body, headers, true); }
  if (res.status === 401) { Auth.expired = true; throw new AuthExpired('unauthorized'); }
  if (res.status >= 500) throw new NetError('server ' + res.status);
  const txt = await res.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch(e){}
  if (!res.ok) {
    const code = j && j.code, m = (j && j.message) || '';
    if ((res.status === 404 && (code === 'PGRST202' || /could not find the function/i.test(m))) || code === '42P01' || /relation .* does not exist/i.test(m)) throw new SetupError('db_missing', m);
    throw new BizError(res.status === 403 ? t('not_allowed') : (m || 'HTTP ' + res.status));
  }
  return j;
}

// app operation name -> real database call
const rpc = (fn, args) => rest('POST', 'rpc/' + fn, args);
const patchOne = async (path, body) => { const r = await rest('PATCH', path, body, { Prefer:'return=representation' }); if (!r || !r.length) throw new BizError(t('not_allowed')); return {}; };
const OPS = {
  request_transfer:p => rpc('request_transfer', { p_client_uuid:p.client_uuid, p_items:p.items, p_notes:p.notes || null }),
  dispatch_transfer:p => rpc('dispatch_transfer', { p_transfer_id:p.transfer_id }),
  receive_transfer:p => rpc('receive_transfer', { p_transfer_id:p.transfer_id, p_received:p.received, p_handover_code:p.handover_code || null }),
  get_handover_qr:p => rpc('get_handover_qr', { p_transfer_id:p.transfer_id }),
  set_setting:p => rpc('set_setting', { p_key:p.key, p_value:p.value }),
  submit_invoice:p => rpc('submit_invoice', { p }),
  record_collection:p => rpc('record_collection', { p }),
  add_customer:p => rpc('add_customer', { p }),
  import_opening_receivable:p => rpc('import_opening_receivable', { p_customer:p.customer_id, p_amount:p.amount, p_due:p.due_date, p_note:p.note || null }),
  receive_from_supplier:p => rpc('receive_from_supplier', { p_product:p.product_id, p_qty:p.qty, p_note:p.note || null }),
  adjust_stock:p => rpc('adjust_stock', { p_location:p.location, p_product:p.product_id, p_rep:p.rep_id || null, p_delta:p.delta, p_reason:p.reason }),
  resolve_stock_exception:p => rpc('resolve_stock_exception', { p_id:p.id, p_note:p.note }),
  cancel_transfer:p => rpc('cancel_transfer', { p_transfer_id:p.transfer_id }),
  resolve_dispute:p => rpc('resolve_dispute', { p_transfer_id:p.transfer_id, p_note:p.note }),
  admin_set_customer:p => patchOne('customers?id=eq.' + p.id, { ...(p.credit_limit != null ? { credit_limit:p.credit_limit } : {}), ...(p.active != null ? { is_active:p.active } : {}) }),
  admin_set_reorder:p => patchOne('warehouse_inventory?product_id=eq.' + p.product_id, { reorder_level:Math.max(0, +p.reorder || 0) }),
  admin_set_rep_active:p => { if (p.rep_id === Auth.session.uid) throw new BizError(t('cant_deactivate_self')); return patchOne('sales_reps?id=eq.' + p.rep_id, { is_active:!!p.active }); },
  admin_set_target:p => rest('POST', 'rep_targets?on_conflict=rep_id,month_start', { rep_id:p.rep_id, month_start:p.month + '-01', collection_target:p.collection_target, carton_target:p.carton_target || null }, { Prefer:'resolution=merge-duplicates,return=minimal' }).then(() => ({})),
  async admin_upsert_product(p){
    const row = { sku:p.sku, brand:p.brand, product_name:p.name, viscosity_grade:p.grade, oil_type:p.type || 'other', unit_size_liters:p.liters ? +p.liters : null, units_per_carton:p.upc, price_per_carton:p.price, is_active:p.active !== false };
    if (p.id) return patchOne('products?id=eq.' + p.id, row);
    const made = await rest('POST', 'products', row, { Prefer:'return=representation' });
    await rest('POST', 'warehouse_inventory', { product_id:made[0].id, qty_on_hand:0, reorder_level:0 }, { Prefer:'return=minimal' });
    return { id:made[0].id };
  }
};
async function api(uid, name, payload){
  if (!Auth.session || Auth.session.uid !== uid) throw new AuthExpired('wrong account');
  const op = OPS[name]; if (!op) throw new BizError('unknown operation ' + name);
  return op(payload || {});
}
async function readSnap(uid){ if (!Auth.session || Auth.session.uid !== uid) throw new AuthExpired('wrong account'); return Remote.refresh(); }

// local mirror of the caller's (already RLS-filtered) data, so the existing screens can read it synchronously
const Remote = {
  snap:null,
  async refresh(){ this.snap = await rpc('get_snapshot', {}); Server.db = this.snap; return this.snap; }
};
const Server = {
  db:{ users:[], wh:[], invoices:[], open:[] },
  user(id){ const u = (this.db.users || []).find(x => x.id === id); if (u) return u; if (Dev.uid === id && Dev.st && Dev.st.cache && Dev.st.cache.me) return Dev.st.cache.me; return null; },
  role(uid){ const u = this.user(uid); return u && u.active ? u.role : null; },
  snapshot(){ return Remote.snap; },
  whRow(pid){ return (this.db.wh || []).find(w => w.product_id === pid); },
  outstanding(cid){ return r2((this.db.invoices || []).filter(i => i.customer_id === cid && i.status === 'posted').reduce((s, i) => s + i.balance_due, 0) + (this.db.open || []).filter(o => o.customer_id === cid).reduce((s, o) => s + o.balance_due, 0)); },
  views:VIEWS
};

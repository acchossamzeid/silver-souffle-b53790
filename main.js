// ===================== screens: login, inactive, demo panel =====================
function loginView(){
  const roleOrder = { rep:0, warehouse:1, admin:2 };
  return `<div class="login stack"><div class="row between"><h1>${t('app_name')}</h1><button class="btn ghost sm" data-a="lang" data-l="${App.lang === 'ar' ? 'en' : 'ar'}">${App.lang === 'ar' ? 'English' : 'العربية'}</button></div>
    <div class="muted">${t('login_tag')}</div><div class="note info">${t('demo_note')}</div>
    <div class="list">${Server.db.users.map(u => `<button class="who" data-a="loginAs" data-id="${u.id}"><span class="avatar">${esc(u.full_name.slice(0, 1))}</span><span class="grow"><b>${esc(u.full_name)}</b><br><span class="muted small">${t('role_' + u.role)}${u.active ? '' : ' · ' + t('inactive')}</span></span>${u.role === 'rep' ? chip('', t('app_rep')) : chip('grey', t('app_admin'))}</button>`).join('')}</div></div>`;
}
function inactiveView(){ return `<div class="login stack"><h1>${t('account_inactive')}</h1><div class="note bad">${t('contact_admin')}</div><button class="btn block" data-a="logout">${t('logout')}</button></div>`; }
function demoPanel(){
  const me = Server.user(App.uid), isRep = me && me.role === 'rep';
  openModal(`<div class="row between"><h2>${t('demo_controls')}</h2><button class="btn ghost sm" data-a="closeModal">${t('close')}</button></div>
  <div class="stack" style="margin-top:1rem">
    <div class="card stack"><h3>${t('connection')}</h3>
      <button class="btn ${Net.offline ? '' : 'ghost'} block" data-a="toggleOffline">${Net.offline ? t('go_online') : t('airplane_on')}</button>
      <button class="btn ghost block" data-a="loseNext">${t('lose_next')}</button><div class="muted small">${t('lose_hint')}${Net.loseNext ? ' <b>(' + Net.loseNext + ')</b>' : ''}</div></div>
    ${isRep ? `<div class="card stack"><h3>${t('gps_sim')}</h3><select id="gpsmode" data-oc="setGps">${['at_shop', 'near', 'far', 'poor', 'mock', 'denied'].map(m => `<option value="${m}" ${Dev.st.gps === m ? 'selected' : ''}>${t('gpsm_' + m)}</option>`).join('')}</select><div class="muted small">${t('gps_hint')}</div></div>` : ''}
    <div class="card stack"><h3>${t('switch_user')}</h3><div class="grid2">${Server.db.users.map(u => `<button class="btn ghost sm" data-a="loginAs" data-id="${u.id}">${esc(u.full_name)}</button>`).join('')}</div></div>
    <div class="row"><button class="btn ghost grow" data-a="lang" data-l="${App.lang === 'ar' ? 'en' : 'ar'}">${App.lang === 'ar' ? 'English' : 'العربية'}</button><button class="btn danger grow" data-a="resetDemo">${t('reset_demo')}</button></div></div>`);
}

// ===================== render =====================
function render(){
  const root = $('#root'); applyLang();
  if (!App.uid || (typeof Auth !== 'undefined' && Auth.expired)) { root.innerHTML = (typeof loginViewRemote === 'function' ? loginViewRemote : loginView)(); if (typeof checkConnection === 'function') checkConnection(); return; }
  const me = Server.user(App.uid);
  if (!me || !me.active) { root.innerHTML = inactiveView(); return; }
  root.innerHTML = me.role === 'rep' ? repShell() : adminShell();
}
function softRender(){
  if (!App.uid) return; const me = Server.user(App.uid); if (!me) return;
  const busy = $('#modal') || (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName));
  const passive = ['home', 'stock', 'invoices', 'settings', 'transfers', 'invoice'];
  if (me.role === 'rep' && passive.includes(App.route.s) && !busy) { const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  document.querySelectorAll('#syncpill').forEach(el => { el.outerHTML = syncPill(); });
  const b = $('#syncbanner'); if (b) b.outerHTML = syncBanner();
}

// ===================== actions =====================
async function admCall(name, payload, msg){
  try { await api(App.uid, name, payload); if (typeof Remote !== 'undefined') await Remote.refresh(); toast(msg || t('saved')); closeModal(); render(); }
  catch(e){ toast(e instanceof NetError ? t('no_connection') : e.message, true); }
}
function afterLogin(){ persistApp(); Dev.onChange = softRender; if (Server.user(App.uid).role === 'rep') Dev.start(); else Dev.stop(); }
const Act = {
  // --- common
  closeModal, lang(el){ App.lang = el.dataset.l; persistApp(); closeModal(); render(); },
  formSubmit(){ if (_formCb) _formCb(formValues()); },
  demo(){ (typeof demoPanelRemote === 'function' ? demoPanelRemote : demoPanel)(); },
  toggleOffline(){ Net.offline = !Net.offline; closeModal(); render(); toast(Net.offline ? t('airplane_on_msg') : t('back_online')); if (!Net.offline && Dev.uid) Dev.sync(true); },
  loseNext(){ Net.loseNext = 2; closeModal(); toast(t('lose_set')); },
  resetDemo(){ if (!confirm(t('reset_confirm'))) return; Object.keys(localStorage).filter(k => k.startsWith('oilrep.dev.')).forEach(k => store.del(k)); Server.reset(); App.uid = null; Dev.stop(); closeModal(); persistApp(); render(); },
  async loginAs(el){
    const id = el.dataset.id, u = Server.user(id); closeModal(); App.hist = [];
    if (!u.active) { App.uid = id; persistApp(); render(); return; }
    if (u.role === 'rep') {
      Dev.load(id);
      if (!Dev.st.cache) { if (Net.offline) { toast(t('first_login_online'), true); return; } await Dev.refresh(); }
      else Dev.refresh();
    } else Dev.uid = null;
    App.uid = id; App.route = { s:u.role === 'rep' ? 'home' : (u.role === 'admin' ? 'dash' : 'transfers'), p:{} }; afterLogin(); render(); window.scrollTo(0, 0);
  },
  logout(){ closeModal(); if (typeof Auth !== 'undefined') { if (Dev.uid && Dev.pending() && !confirm(t('logout_pending'))) return; Auth.logout(); Server.db = { users:[] }; } App.uid = null; Dev.stop(); Dev.uid = null; persistApp(); render(); },
  setGps(el){ Dev.st.gps = el.value; Dev.save(); toast(t('gpsm_' + el.value)); },
  // --- navigation
  go(el){ go(el.dataset.s, { id:el.dataset.id, cid:el.dataset.cid, cu:el.dataset.cu }); },
  tab(el){ tab(el.dataset.s); }, back, goSettings(){ go('settings'); },
  admGo(el){ App.route = { s:el.dataset.s, p:{} }; render(); window.scrollTo(0, 0); if (typeof Remote !== 'undefined') Remote.refresh().then(render).catch(() => {}); },
  // --- sync
  syncNow(){ if (Net.blocked()) { toast(t('offline'), true); return; } Dev.sync(true).then(() => { render(); toast(t('sync_done')); }); },
  retryOb(el){ Dev.retry(el.dataset.id); toast(t('retrying')); },
  discardOb(el){ if (confirm(t('discard_confirm'))) { Dev.discard(el.dataset.id); render(); } },
  // --- rep: stock
  reqQty(el){ const d = Dev.st.reqDraft || (Dev.st.reqDraft = {}), pid = el.dataset.pid; d[pid] = Math.max(0, (d[pid] || 0) + Number(el.dataset.d)); render(); },
  sendRequest(){
    const d = Dev.st.reqDraft || {}, items = Object.entries(d).filter(([, q]) => q > 0).map(([pid, q]) => ({ product_id:+pid, qty:q }));
    if (!items.length) return; const cu = uuid(); const note = ($('#reqnote') || {}).value || '';
    Dev.enqueue('request_transfer', cu, { client_uuid:cu, items, notes:note || null }); Dev.st.reqDraft = {}; Dev.save(); toast(t('request_saved')); go('transfers', {}, { noHist:true });
  },
  async cancelTransfer(el){ try { await api(Dev.uid, 'cancel_transfer', { transfer_id:+el.dataset.id }); await Dev.refresh(); render(); toast(t('saved')); } catch(e){ toast(e instanceof NetError ? t('no_connection') : e.message, true); } },
  rcCheck(el){
    const warn = Object.values(document.querySelectorAll('[data-oi="rcCheck"]')).some(i => Number(i.value) !== Number(i.dataset.sent));
    $('#rcwarn').innerHTML = warn ? `<div class="note warn">${t('mismatch_warn')}</div>` : '';
  },
  async confirmReceive(el){
    const id = +el.dataset.id, tr = Dev.c().transfers.find(x => x.id === id), received = []; let disputed = false;
    if (!tr || tr.status !== 'In-Transit' || Act._receiving) return;
    for (const i of tr.items) { const q = Number(($('#rc_' + i.product_id) || {}).value); if (!(q >= 0) || !Number.isInteger(q)) { toast(t('invalid_qty'), true); return; } received.push({ product_id:i.product_id, qty_received:q }); if (q !== i.qty_sent) disputed = true; }
    const code = cleanCode(($('#hcode') || {}).value) || cleanCode((Dev.st.recvCode || {})[id]);
    if (qrWanted() && !code) { toast(t('qr_required_err'), true); return; }
    Act._receiving = true;
    tr.items.forEach((i, k) => { i.qty_received = received[k].qty_received; const v = Dev.c().van.find(x => x.product_id === i.product_id); if (v) v.qty += i.qty_received; else Dev.c().van.push({ rep_id:Dev.uid, product_id:i.product_id, qty:i.qty_received }); });
    tr.status = disputed ? 'Disputed' : 'Received';
    const item = Dev.enqueue('receive_transfer', uuid(), { transfer_id:id, received, handover_code:code || null });
    // Wait for the server's first answer: a rejected code must be reported NOW, while the keeper is still standing there.
    for (let k = 0; k < 40; k++) { if (item.status === 'synced' || item.status === 'failed' || (item.status === 'pending' && item.attempts > 0)) break; await sleep(200); }
    Act._receiving = false;
    if (Dev.st.recvCode) delete Dev.st.recvCode[id];
    if (item.status === 'failed') { toast(t('receipt_rejected') + ' ' + item.last_error, true); Dev.discard(item.id); Dev.save(); await sleep(500); render(); return; }   // discard restores the true stock from the server
    Dev.save(); toast(t(disputed ? 'received_disputed' : 'received_ok')); go('transfers', {}, { noHist:true });
  },
  scanQR(el){ startHandoverScan(+el.dataset.id); },
  stopScan(){ closeModal(); },
  hcodeInput(el){ Dev.st.recvCode = Dev.st.recvCode || {}; Dev.st.recvCode[el.dataset.id] = cleanCode(el.value); Dev.save(); },
  showQR(el){ showHandoverQR(+el.dataset.id); },
  toggleQR(el){ admCall('set_setting', { key:'require_qr_handover', value:el.dataset.v }); },
  // --- rep: customers
  custSearch(){ const q = ($('#q') || {}).value, r = ($('#regionf') || {}).value; const mode = App.route.s === 'visit' ? 'visit' : 'browse'; $('#custlist').innerHTML = custListHTML(q, r, mode); },
  addShop(){
    const regs = Dev.c().regions.map(r => [r.id, App.lang === 'ar' ? r.name_ar : r.name_en]);
    openForm(t('add_shop'), [{ id:'name', label:t('shop_name') }, { id:'owner', label:t('owner') }, { id:'phone', label:t('phone'), type:'tel' },
      { id:'type', label:t('type'), type:'select', options:['repair_shop', 'gas_station', 'banshar', 'other'].map(x => [x, typeLabel(x)]) },
      { id:'region', label:t('region'), type:'select', options:regs, value:(Dev.c().me || {}).region_id }], v => {
      if (!v.name.trim()) { toast(t('shop_name') + ' ?', true); return; }
      const g = Dev.gps(null); if (g.denied) { toast(t('gps_denied'), true); return; }
      const cu = uuid(), p = { client_uuid:cu, shop_name:v.name.trim(), owner_name:v.owner || null, phone:v.phone || null, shop_type:v.type, region_id:+v.region, lat:g.lat, lng:g.lng };
      Dev.c().customers.push({ id:'tmp-' + cu, shop_name:p.shop_name, owner:p.owner_name, phone:p.phone, type:p.shop_type, region_id:p.region_id, loc:{ lat:g.lat, lng:g.lng }, credit_limit:0, active:true, _pending:true });
      Dev.enqueue('add_customer', cu, p); closeModal(); render(); toast(t('shop_saved'));
    }, t('add_shop'));
  },
  // --- rep: visit + invoice
  newVisit(){ go('visit'); },
  async pickCustomer(el){
    const cid = +el.dataset.id, d = Dev.st.draft;
    if (d && d.customer_id !== cid && Object.values(d.items).some(q => q > 0)) { toast(t('draft_exists'), true); go('visit'); return; }
    if (!d || d.customer_id !== cid) {
      let g = Dev.gps(Dev.customer(cid));
      if (g.nofix) { toast(t('gps_waiting')); for (let i = 0; i < 20 && g.nofix; i++) { await sleep(500); g = Dev.gps(Dev.customer(cid)); } }   // a real phone needs a moment for its first fix
      if (g.denied) { toast(g.nofix ? t('gps_waiting') : t('gps_denied'), true); return; }
      Dev.st.draft = { client_uuid:uuid(), visit_uuid:uuid(), customer_id:cid, check_in_at:new Date().toISOString(), items:{}, payment_type:'cash', amount_paid:'', due_date:dueDefault(), step:'edit' };
      Dev.save();
    }
    go('visit', {}, { noHist:App.route.s === 'visit' });
  },
  qty(el){ const d = Dev.st.draft, pid = el.dataset.pid; d.items[pid] = Math.max(0, (d.items[pid] || 0) + Number(el.dataset.d)); Dev.save(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  payType(el){ Dev.st.draft.payment_type = el.dataset.m; Dev.save(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  draftField(el){ Dev.st.draft[el.dataset.f] = el.value; Dev.save(); },
  toReview(){ Dev.st.draft.step = 'review'; Dev.save(); render(); window.scrollTo(0, 0); },
  backToEdit(){ Dev.st.draft.step = 'edit'; Dev.save(); render(); },
  discardDraft(){ Dev.st.draft = null; Dev.save(); back(); },
  submitInvoice(){
    const d = Dev.st.draft; if (!d || Dev.st.inv[d.client_uuid]) return;         // double-tap guard (server is idempotent too)
    const cust = Dev.customer(d.customer_id), g = Dev.gps(cust); if (g.denied) { toast(g.nofix ? t('gps_waiting') : t('gps_denied'), true); return; }
    const est = Dev.estimate(d.items), items = Object.entries(d.items).filter(([, q]) => q > 0).map(([pid, q]) => ({ product_id:+pid, qty:q }));
    const paid = d.payment_type === 'cash' ? est.total : d.payment_type === 'credit' ? 0 : Number(d.amount_paid || 0);
    const payload = { client_uuid:d.client_uuid, visit_client_uuid:d.visit_uuid, customer_id:d.customer_id, payment_type:d.payment_type, amount_paid:paid,
      due_date:d.payment_type === 'cash' ? null : d.due_date, device_created_at:new Date().toISOString(), check_in_at:d.check_in_at,
      lat:g.lat, lng:g.lng, gps_accuracy_m:g.acc, mock_location:g.mock || undefined, items };
    Dev.st.inv[d.client_uuid] = { client_uuid:d.client_uuid, visit_uuid:d.visit_uuid, number:null, status:'pending', customer_id:d.customer_id, shop:cust.shop_name, items:{ ...d.items },
      est_total:est.total, payment_type:d.payment_type, paid, due:payload.due_date, created_at:Date.now(), flags:[] };
    items.forEach(i => { const v = Dev.c().van.find(x => x.product_id === i.product_id); if (v) v.qty = Math.max(0, v.qty - i.qty); });   // local van deduction
    Dev.st.draft = null; Dev.enqueue('submit_invoice', d.client_uuid, payload);
    App.hist = []; go('invoice', { cu:d.client_uuid, fresh:true }, { noHist:true });
  },
  shareWA(el){
    const i = Dev.allInvoices().find(x => x.client_uuid === el.dataset.cu); if (!i) return;
    const lines = i.items.map(x => `• ${pname(Dev.product(x.product_id))} × ${x.qty} = ${money(x.line_total).replace(/<[^>]+>/g, '')}`).join('\n');
    const txt = `${t('app_name')}\n${i.invoice_number || ''}\n${i.shop_name_snapshot}\n\n${lines}\n\n${t('total')}: ${Number(i.total).toFixed(2)} ${t('sar')}\n${t('balance')}: ${Number(i.balance_due).toFixed(2)} ${t('sar')}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  },
  printInv(){ window.print(); },
  recordCollection(el){
    const k = el.dataset.kind + el.dataset.id, amt = r2(Number(($('#ca_' + k) || {}).value)), bal = Number(el.dataset.bal), method = ($('#cm_' + k) || {}).value;
    if (!(amt > 0) || amt > bal) { toast(t('err_amount', bal), true); return; }
    const cu = uuid(), p = { client_uuid:cu, customer_id:+el.dataset.cid, amount:amt, method, collected_at:new Date().toISOString() };
    if (el.dataset.kind === 'invoice') p.invoice_id = +el.dataset.id; else p.opening_receivable_id = +el.dataset.id;
    Dev.enqueue('record_collection', cu, p); toast(t('payment_saved')); render();
  },
  // --- admin
  async dispatch(el){ await admCall('dispatch_transfer', { transfer_id:+el.dataset.id }, t('dispatched')); },
  cancelT(el){ admCall('cancel_transfer', { transfer_id:+el.dataset.id }); },
  resolveDispute(el){ openForm(t('resolve_dispute'), [{ id:'note', label:t('resolution_note'), type:'textarea', hint:t('dispute_hint') }], v => admCall('resolve_dispute', { transfer_id:+el.dataset.id, note:v.note })); },
  supplierRecv(){ const s = AS(); openForm(t('receive_supplier'), [{ id:'p', label:t('product'), type:'select', options:s.products.map(p => [p.id, pname(p)]) }, { id:'q', label:t('cartons'), type:'number', min:1 }, { id:'n', label:t('note') }], v => admCall('receive_from_supplier', { product_id:+v.p, qty:Number(v.q), note:v.n || null })); },
  adjustWh(){ const s = AS(); openForm(t('adjust_stock') + ' — ' + t('warehouse'), [{ id:'p', label:t('product'), type:'select', options:s.products.map(p => [p.id, pname(p)]) }, { id:'d', label:t('change'), type:'number', hint:t('delta_hint') }, { id:'r', label:t('reason'), type:'textarea' }], v => admCall('adjust_stock', { location:'warehouse', product_id:+v.p, delta:Number(v.d), reason:v.r })); },
  adjustVan(){ const s = AS(); openForm(t('adjust_stock') + ' — ' + t('van'), [{ id:'rep', label:t('rep'), type:'select', options:s.users.filter(u => u.role === 'rep').map(u => [u.id, u.full_name]) }, { id:'p', label:t('product'), type:'select', options:s.products.map(p => [p.id, pname(p)]) }, { id:'d', label:t('change'), type:'number', hint:t('delta_hint') }, { id:'r', label:t('reason'), type:'textarea' }], v => admCall('adjust_stock', { location:'van', rep_id:v.rep, product_id:+v.p, delta:Number(v.d), reason:v.r })); },
  setReorder(el){ const w = Server.whRow(+el.dataset.id); openForm(t('reorder_level'), [{ id:'r', label:t('reorder_level'), type:'number', value:w.reorder, min:0 }], v => admCall('admin_set_reorder', { product_id:+el.dataset.id, reorder:Number(v.r) })); },
  resolveExc(el){ openForm(t('resolve'), [{ id:'n', label:t('resolution_note'), type:'textarea', hint:t('exc_hint') }], v => admCall('resolve_stock_exception', { id:+el.dataset.id, note:v.n })); },
  invDetail(el){
    const s = AS(), i = s.invoices.find(x => x.id === +el.dataset.id), c = custOf(s, i.customer_id);
    const maps = (l) => l ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${l.lat},${l.lng}"><span class="num">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</span></a>` : '–';
    openModal(`<div class="row between"><h2><span class="num">${esc(i.invoice_number)}</span></h2><button class="btn ghost sm" data-a="closeModal">${t('close')}</button></div>
      <div class="stack" style="margin-top:.8rem"><div>${esc(i.shop_name_snapshot)} · ${esc(repName(s, i.rep_id))}</div>
      ${tbl([t('product'), t('qty'), t('price'), t('total')], i.items.map(x => [esc(pname(prodOf(s, x.product_id))), N(x.qty), money(x.unit_price), money(x.line_total)]))}
      <div class="row between"><span>${t('subtotal')}</span>${money(i.subtotal)}</div><div class="row between"><span>${t('vat')}</span>${money(i.vat_amount)}</div><div class="row between"><b>${t('total')}</b><b>${money(i.total)}</b></div>
      <div class="row between"><span>${t('balance')}</span>${money(i.balance_due)}</div>
      <div class="card"><b>${t('location')}</b><div class="small">${t('submitted_at')}: ${maps(i.loc)}</div><div class="small">${t('shop_location')}: ${maps(c.loc)}</div><div class="small">${t('distance')}: <b class="num">${Math.round(i.distance_from_shop_m || 0)} m</b> · ${t('accuracy')}: <span class="num">${Math.round(i.gps_accuracy_m || 0)} m</span></div></div>
      <div class="row wrap">${i.flags.map(flagChip).join('') || chip('ok', t('no_flags'))}</div></div>`);
  },
  importOpen(){ const s = AS(); openForm(t('import_opening'), [{ id:'c', label:t('customer'), type:'select', options:s.customers.map(c => [c.id, c.shop_name]) }, { id:'a', label:t('amount'), type:'number', min:1 }, { id:'d', label:t('due_date'), type:'date', value:todayKey() }, { id:'n', label:t('note'), value:'Balance carried from old books' }], v => admCall('import_opening_receivable', { customer_id:+v.c, amount:Number(v.a), due_date:v.d || null, note:v.n })); },
  newCustomer(){ const s = AS(); openForm(t('add_shop'), [{ id:'name', label:t('shop_name') }, { id:'phone', label:t('phone') }, { id:'type', label:t('type'), type:'select', options:['repair_shop', 'gas_station', 'banshar', 'other'].map(x => [x, typeLabel(x)]) }, { id:'region', label:t('region'), type:'select', options:s.regions.map(r => [r.id, App.lang === 'ar' ? r.name_ar : r.name_en]) }, { id:'limit', label:t('credit_limit'), type:'number', value:0, min:0 }], v => admCall('add_customer', { client_uuid:uuid(), shop_name:v.name, phone:v.phone, shop_type:v.type, region_id:+v.region, credit_limit:Number(v.limit) })); },
  editCustomer(el){ const c = custOf(AS(), +el.dataset.id); openForm(c.shop_name, [{ id:'l', label:t('credit_limit'), type:'number', value:c.credit_limit, min:0, hint:t('limit_hint') }, { id:'a', label:t('status'), type:'select', value:c.active ? '1' : '0', options:[['1', t('active')], ['0', t('inactive')]] }], v => admCall('admin_set_customer', { id:c.id, credit_limit:Number(v.l), active:v.a === '1' })); },
  editProduct(el){ const p = el.dataset.id ? prodOf(AS(), +el.dataset.id) : {};
    openForm(p.id ? t('edit') : t('add_product'), [{ id:'sku', label:t('sku'), value:p.sku }, { id:'brand', label:t('brand'), value:p.brand }, { id:'name', label:t('product'), value:p.name }, { id:'grade', label:t('viscosity'), value:p.grade },
      { id:'liters', label:t('liters'), type:'number', value:p.liters }, { id:'upc', label:t('units_per_carton'), type:'number', value:p.upc, min:1 }, { id:'price', label:t('price_carton'), type:'number', value:p.price, min:0, hint:t('price_note') },
      { id:'active', label:t('status'), type:'select', value:p.id && !p.active ? '0' : '1', options:[['1', t('active')], ['0', t('inactive')]] }],
      v => admCall('admin_upsert_product', { id:p.id, sku:v.sku.trim(), brand:v.brand.trim(), name:v.name.trim(), grade:v.grade.trim(), type:p.type, liters:v.liters, upc:Number(v.upc), price:Number(v.price), active:v.active === '1' })); },
  setTarget(el){ const month = todayKey().slice(0, 7), tg = AS().targets.find(x => x.rep_id === el.dataset.id && x.month === month) || {};
    openForm(t('set_target'), [{ id:'c', label:t('collection_target'), type:'number', value:tg.collection_target || 100000, min:0 }, { id:'k', label:t('carton_target'), type:'number', value:tg.carton_target || '' }], v => admCall('admin_set_target', { rep_id:el.dataset.id, month, collection_target:Number(v.c), carton_target:v.k })); },
  toggleRep(el){ const u = Server.user(el.dataset.id); if (confirm(u.active ? t('deactivate_confirm') : t('activate_confirm'))) admCall('admin_set_rep_active', { rep_id:u.id, active:!u.active }); },
};
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) return; if (el.tagName === 'A') e.preventDefault(); const f = Act[el.dataset.a]; if (f) f(el, e); });
document.addEventListener('input', e => { const el = e.target.closest('[data-oi]'); if (el && Act[el.dataset.oi]) Act[el.dataset.oi](el, e); });
document.addEventListener('change', e => {
  const el = e.target.closest('[data-oc]'); if (!el) return;
  if (el.dataset.oc === 'admFilter') { App.f[el.dataset.g][el.dataset.k] = el.value; render(); return; }
  if (Act[el.dataset.oc]) Act[el.dataset.oc](el, e);
});


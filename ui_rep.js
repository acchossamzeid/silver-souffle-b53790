// ===================== Rep app views =====================
function handoverCard(tr){
  const code = (Dev.st.recvCode || {})[tr.id] || '', need = qrWanted(), canScan = typeof Html5Qrcode !== 'undefined';
  return `<div class="card stack"><h3>${t('handover_section')}</h3>
    ${need ? `<div class="note warn">${t('qr_required_note')}</div>` : ''}
    ${code ? `<div><span class="chip ok">✓ ${t('code_scanned')}</span> <b dir="ltr" class="num">${esc(prettyCode(code))}</b></div>` : ''}
    ${canScan ? `<button class="btn block" data-a="scanQR" data-id="${tr.id}">${t('scan_qr')}</button>` : ''}
    <div class="field"><label for="hcode">${t('type_code')}</label><input id="hcode" dir="ltr" autocapitalize="characters" autocomplete="off" maxlength="14" value="${esc(code ? prettyCode(code) : '')}" data-oi="hcodeInput" data-id="${tr.id}"></div></div>`;
}
function syncPill(){
  const s = Dev.syncState(), n = s === 'bad' ? Dev.failed().length : Dev.pending();
  const txt = Net.offline ? t('offline') : (s === 'ok' ? t('synced_short') : N(n));
  return `<span id="syncpill" class="chip ${Net.offline ? 'grey' : s}" data-a="goSettings" style="cursor:pointer"><i class="dot"></i>${txt}</span>`;
}
function syncBanner(){
  const s = Dev.syncState(), n = s === 'bad' ? Dev.failed().length : Dev.pending();
  const txt = s === 'ok' ? t('sync_ok') : s === 'warn' ? t('sync_wait', n) : t('sync_bad', n);
  return `<div id="syncbanner" class="banner ${s}" data-a="goSettings"><i class="dot"></i><span class="grow">${txt}${Net.offline ? ' — ' + t('offline') : ''}</span></div>`;
}
function dipstick(pct, collected, target){
  const w = Math.max(0, Math.min(100, pct));
  return `<div class="dip"><div class="row between" style="align-items:flex-end"><div class="dip-num">${money0(collected)}</div><div class="muted small">${t('of')} ${money0(target)} ${t('sar')}</div></div>
  <div class="dip-rod" role="img" aria-label="${pct}%"><div class="dip-fill" style="width:${w}%"></div></div>
  <div class="dip-scale"><span class="num">0</span><span class="num">${pct}%</span><span class="num">100%</span></div></div>`;
}
function kpiMine(){
  const s = Dev.pseudoSnap(), month = todayKey().slice(0, 7);
  return Server.views.kpi(s, month)[0] || { collected:0, target:100000, pct:0, cartons:0, carton_target:null };
}
const RepViews = {
  home(){
    const me = Dev.c().me || {}, k = kpiMine(), today = todayKey();
    const vis = new Set([...Dev.c().visits.filter(v => dayKey(v.check_in_at) === today).map(v => v.client_uuid),
      ...Object.values(Dev.st.inv).filter(l => dayKey(new Date(l.created_at).toISOString()) === today).map(l => l.visit_uuid)]).size;
    const cash = Server.views.cashExpectedToday({ ...Dev.pseudoSnap(), users:[{ id:Dev.uid, role:'rep', active:true }] })[0];
    return { title:t('today'), body:`
      <div><h1>${t('hello', esc(me.full_name || ''))}</h1><div class="muted small">${new Date().toLocaleDateString(App.lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { timeZone:RYD, weekday:'long', day:'numeric', month:'long' })}</div></div>
      ${syncBanner()}
      <div class="card"><h3>${t('month_progress')}</h3>${dipstick(k.pct, k.collected, k.target)}</div>
      <div class="row card"><div class="stat"><b>${N(vis)}<span class="muted small"> / 15</span></b><span>${t('visits_today')}</span></div>
        <div class="stat"><b>${money0(cash ? cash.amount : 0)}</b><span>${t('cash_today')}</span></div>
        <div class="stat"><b>${N(k.cartons)}</b><span>${t('cartons_month')}</span></div></div>
      <div class="bigbtns">
        <button class="bigbtn primary" data-a="newVisit">${svg('plus')}${t('new_visit')}</button>
        <button class="bigbtn" data-a="go" data-s="stock">${svg('box')}${t('my_stock')}</button>
        <button class="bigbtn" data-a="go" data-s="request">${svg('truck')}${t('request_stock')}</button>
        <button class="bigbtn" data-a="go" data-s="collect">${svg('cash')}${t('collect_payment')}</button></div>
      <div class="row wrap"><button class="btn ghost sm" data-a="go" data-s="transfers">${t('transfers')}</button><button class="btn ghost sm" data-a="go" data-s="perf">${t('my_performance')}</button></div>` };
  },
  stock(){
    const prods = Dev.c().products.filter(p => p.active);
    return { title:t('my_stock'), body:`<div class="note info">${t('stock_cached')}</div>
      <div class="list">${prods.map(p => { const q = Dev.vanQty(p.id); return `<div class="card row"><div class="grow"><b>${esc(pname(p))}</b><div class="muted small">${esc(p.sku)} · ${N(p.upc)} ${t('units_per_carton')}</div></div>${q <= 5 ? chip(q === 0 ? 'bad' : 'warn', t('low')) : ''}<b style="font-size:1.4rem">${N(q)}</b></div>`; }).join('')}</div>
      <button class="btn block" data-a="go" data-s="request">${t('request_stock')}</button>` };
  },
  request(){
    const d = Dev.st.reqDraft || (Dev.st.reqDraft = {});
    const prods = Dev.c().products.filter(p => p.active);
    return { title:t('request_stock'), back:1, body:`<div class="list">${prods.map(p => `<div class="card row"><div class="grow"><b>${esc(pname(p))}</b><div class="muted small">${t('on_van')}: ${N(Dev.vanQty(p.id))}</div></div>
      <div class="stepper"><button data-a="reqQty" data-pid="${p.id}" data-d="-1" aria-label="-">−</button><b>${N(d[p.id] || 0)}</b><button data-a="reqQty" data-pid="${p.id}" data-d="1" aria-label="+">+</button></div></div>`).join('')}</div>
      <div class="field"><label for="reqnote">${t('notes')}</label><input id="reqnote"></div>
      <button class="btn block" data-a="sendRequest" ${Object.values(d).some(q => q > 0) ? '' : 'disabled'}>${t('send_request')}</button>` };
  },
  transfers(){
    const c = Dev.c(), pendingReq = Dev.st.outbox.filter(o => o.op_type === 'request_transfer' && o.status !== 'synced');
    const rows = [...pendingReq.map(o => ({ pend:true, id:null, status:'PendingSync', requested_at:new Date(o.created_at).toISOString(), items:o.payload.items.map(i => ({ product_id:i.product_id, qty_requested:i.qty })) })),
      ...[...c.transfers].sort((a, b) => b.id - a.id)];
    return { title:t('transfers'), back:1, body: rows.length ? `<div class="list">${rows.map(r => `<div class="card ${r.status === 'In-Transit' ? 'tap' : ''}" ${r.status === 'In-Transit' ? `data-a="go" data-s="receive" data-id="${r.id}"` : ''}>
      <div class="row between"><b>${r.id ? '#' + N(r.id) : t('new')}</b><span>${r.handover_method ? chip(r.handover_method === 'qr' ? 'ok' : 'grey', t('method_' + r.handover_method)) + ' ' : ''}${trChip(r.status)}</span></div>
      <div class="muted small">${fmtDT(r.requested_at)}</div>
      <div class="small" style="margin-top:.4rem">${r.items.map(i => `${esc(pname(Dev.product(i.product_id)))} × ${N(i.qty_sent != null ? i.qty_sent : i.qty_requested)}`).join('<br>')}</div>
      ${r.status === 'In-Transit' ? `<div class="chip" style="margin-top:.5rem">${t('tap_to_receive')}</div>` : ''}
      ${r.status === 'Pending' ? `<button class="btn ghost sm" style="margin-top:.5rem" data-a="cancelTransfer" data-id="${r.id}">${t('cancel_request')}</button>` : ''}</div>`).join('')}</div>` : `<div class="note info">${t('no_transfers')}</div>` };
  },
  receive(p){
    const tr = Dev.c().transfers.find(x => x.id === +p.id); if (!tr) return { title:t('transfers'), back:1, body:'' };
    return { title:t('receive_transfer') + ' #' + tr.id, back:1, body:`<div class="note info">${t('receive_hint')}</div>
      ${handoverCard(tr)}
      <div class="list">${tr.items.map(i => `<div class="card"><b>${esc(pname(Dev.product(i.product_id)))}</b>
        <div class="row between" style="margin-top:.5rem"><span class="muted">${t('qty_sent')}: ${N(i.qty_sent)}</span>
        <input type="number" inputmode="numeric" min="0" style="width:110px" id="rc_${i.product_id}" value="${i.qty_sent}" data-oi="rcCheck" data-sent="${i.qty_sent}"></div></div>`).join('')}</div>
      <div id="rcwarn"></div><button class="btn block" data-a="confirmReceive" data-id="${tr.id}">${t('confirm_receipt')}</button>` };
  },
  customers(){
    return { title:t('customers'), body:`<div class="row"><input id="q" placeholder="${t('search_shop')}" data-oi="custSearch" class="grow"><button class="btn" data-a="addShop">${svg('plus')}</button></div>
      <select id="regionf" data-oc="custSearch"><option value="">${t('all_regions')}</option>${Dev.c().regions.map(r => `<option value="${r.id}">${esc(App.lang === 'ar' ? r.name_ar : r.name_en)}</option>`).join('')}</select>
      <div id="custlist" class="list">${custListHTML('', '', 'browse')}</div>` };
  },
  visit(p){
    const d = Dev.st.draft;
    if (!d) return { title:t('new_visit'), back:1, body:`<div class="row"><input id="q" placeholder="${t('search_shop')}" data-oi="custSearch" class="grow"></div><div id="custlist" class="list">${custListHTML('', '', 'visit')}</div>` };
    const cust = Dev.customer(d.customer_id), prods = Dev.c().products.filter(x => x.active && (Dev.vanQty(x.id) > 0 || d.items[x.id]));
    if (d.step === 'review') return RepViews.review();
    const est = Dev.estimate(d.items), g = Dev.gps(cust);
    const out = Dev.outstanding(d.customer_id);
    return { title:esc(cust.shop_name), back:1, body:`
      ${g.denied ? `<div class="note bad">${t('gps_denied')}</div>` : g.acc > 100 ? `<div class="note warn">${t('gps_poor', Math.round(g.acc))}</div>` : `<div class="chip ok">${svg('pin', 'width="14" height="14"')} ${t('gps_ok', Math.round(g.acc))}</div>`}
      <div class="muted small">${t('credit_limit')}: ${money0(cust.credit_limit)} · ${t('owed')}: ${money0(out)}</div>
      <h2>${t('add_lines')}</h2>
      ${prods.length ? '' : `<div class="note warn">${t('van_empty')}</div>`}
      <div class="list">${prods.map(x => { const q = d.items[x.id] || 0, van = Dev.vanQty(x.id);
        return `<div class="card"><div class="row"><div class="grow"><b>${esc(pname(x))}</b><div class="muted small">${money(x.price)} / ${t('carton')} · ${t('on_van')} ${N(van)}</div></div>
        <div class="stepper"><button data-a="qty" data-pid="${x.id}" data-d="-1" aria-label="-">−</button><b>${N(q)}</b><button data-a="qty" data-pid="${x.id}" data-d="1" aria-label="+">+</button></div></div>
        ${q > van ? `<div class="note warn" style="margin-top:.5rem">${t('over_van', van)}</div>` : ''}</div>`; }).join('')}</div>
      <h2>${t('payment')}</h2>
      <div class="seg">${['cash', 'credit', 'split'].map(m => `<button class="${d.payment_type === m ? 'on' : ''}" data-a="payType" data-m="${m}">${t('pay_' + m)}</button>`).join('')}</div>
      ${d.payment_type === 'split' ? `<div class="field"><label for="paid">${t('amount_paid_now')}</label><input id="paid" type="number" inputmode="decimal" value="${esc(d.amount_paid)}" data-oc="draftField" data-f="amount_paid"></div>` : ''}
      ${d.payment_type !== 'cash' ? `<div class="field"><label for="due">${t('due_date')}</label><input id="due" type="date" value="${esc(d.due_date)}" data-oc="draftField" data-f="due_date"></div>` : ''}
      <div class="card row between"><span class="muted">${t('est_total')}</span><b>${money(est.total)}</b></div>
      <div class="row"><button class="btn block grow" data-a="toReview" ${est.total > 0 ? '' : 'disabled'}>${t('review')}</button><button class="btn ghost" data-a="discardDraft">${t('discard')}</button></div>` };
  },
  review(){
    const d = Dev.st.draft, cust = Dev.customer(d.customer_id), est = Dev.estimate(d.items), g = Dev.gps(cust);
    const paid = d.payment_type === 'cash' ? est.total : d.payment_type === 'credit' ? 0 : Number(d.amount_paid || 0);
    const bal = r2(est.total - paid), out = Dev.outstanding(d.customer_id);
    const problems = [];
    if (d.payment_type === 'split' && !(paid > 0 && paid < est.total)) problems.push(t('err_split'));
    if (bal > 0 && !d.due_date) problems.push(t('err_due'));
    return { title:t('review_invoice'), back:1, body:`
      <div class="card"><b>${esc(cust.shop_name)}</b>
      <div class="list" style="margin-top:.6rem">${Object.entries(d.items).filter(([, q]) => q > 0).map(([pid, q]) => { const p = Dev.product(+pid); return `<div class="row between small"><span>${esc(pname(p))} × ${N(q)}</span><span>${money(q * p.price)}</span></div>`; }).join('')}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:.8rem 0">
      <div class="row between"><span class="muted">${t('subtotal')}</span>${money(est.subtotal)}</div>
      <div class="row between"><span class="muted">${t('vat')} 15%</span>${money(est.vat)}</div>
      <div class="row between"><b>${t('total')}</b><b>${money(est.total)}</b></div>
      <div class="row between"><span class="muted">${t('paid_now')}</span>${money(paid)}</div>
      <div class="row between"><span class="muted">${t('balance')}</span><b>${money(bal)}</b></div>
      ${bal > 0 ? `<div class="row between"><span class="muted">${t('due_date')}</span>${fmtD(d.due_date)}</div>` : ''}</div>
      <div class="note info">${t('server_recalc')}</div>
      ${bal > 0 && out + bal > cust.credit_limit ? `<div class="note warn">${t('credit_over_warn')}</div>` : ''}
      ${g.denied ? `<div class="note bad">${t('gps_denied')}</div>` : g.acc > 100 ? `<div class="note warn">${t('gps_poor', Math.round(g.acc))}</div>` : ''}
      ${problems.map(x => `<div class="note bad">${x}</div>`).join('')}
      <button class="btn block" data-a="submitInvoice" ${g.denied || problems.length ? 'disabled' : ''}>${t('submit_invoice')}</button>
      <button class="btn ghost block" data-a="backToEdit">${t('edit')}</button>` };
  },
  invoices(){
    const list = Dev.allInvoices();
    return { title:t('invoices'), body: list.length ? `<div class="list">${list.map(i => `<div class="card tap" data-a="go" data-s="invoice" data-cu="${i.client_uuid}">
      <div class="row between"><b>${esc(i.shop_name_snapshot)}</b>${invChip(i._state)}</div>
      <div class="row between small muted"><span>${i.invoice_number ? esc(i.invoice_number) : t('number_after_sync')}</span><span>${fmtDT(i.device_created_at)}</span></div>
      <div class="row between" style="margin-top:.3rem"><span class="chip grey">${t('pay_' + i.payment_type)}</span><b>${money(i.total)}</b></div></div>`).join('')}</div>` : `<div class="note info">${t('no_invoices')}</div>` };
  },
  invoice(p){
    const i = Dev.allInvoices().find(x => x.client_uuid === p.cu); if (!i) return { title:t('invoices'), back:1, body:'' };
    const sub = r2(i.items.reduce((s, x) => s + x.line_total, 0)), vat = r2(i.total - sub);
    return { title:i.invoice_number || t('invoice'), back:1, body:`
      ${p.fresh ? `<div class="note info">${t('saved_locally')}</div>` : ''}
      <div class="card"><div class="row between"><b>${esc(i.shop_name_snapshot)}</b>${invChip(i._state)}</div>
      <div class="muted small">${i.invoice_number ? esc(i.invoice_number) : t('number_after_sync')} · ${fmtDT(i.device_created_at)}</div>
      ${i._state === 'failed' ? `<div class="note bad" style="margin-top:.6rem">${esc(i._err || '')}</div>` : ''}
      <div class="list" style="margin:.8rem 0">${i.items.map(x => `<div class="row between small"><span>${esc(pname(Dev.product(x.product_id)))} × ${N(x.qty)}</span><span>${money(x.line_total)}</span></div>`).join('')}</div>
      <div class="row between"><span class="muted">${t('subtotal')}</span>${money(sub)}</div><div class="row between"><span class="muted">${t('vat')}</span>${money(vat)}</div>
      <div class="row between"><b>${t('total')}</b><b>${money(i.total)}</b></div>
      <div class="row between"><span class="muted">${t('pay_' + i.payment_type)}</span>${money(i.amount_paid)}</div>
      <div class="row between"><span class="muted">${t('balance')}</span><b>${money(i.balance_due)}</b></div>
      ${i.balance_due > 0 ? `<div class="row between"><span class="muted">${t('due_date')}</span>${fmtD(i.due_date)}</div>` : ''}
      ${(i.flags || []).length ? `<div class="row wrap" style="margin-top:.6rem">${i.flags.map(flagChip).join('')}</div>` : ''}</div>
      <div class="row hide-print"><button class="btn grow" data-a="shareWA" data-cu="${i.client_uuid}">${t('share_whatsapp')}</button><button class="btn ghost" data-a="printInv">${t('print_pdf')}</button></div>
      ${i.balance_due > 0 && i._state === 'synced' ? `<button class="btn ghost block hide-print" data-a="go" data-s="collect" data-cid="${i.customer_id}">${t('collect_payment')}</button>` : ''}` };
  },
  collect(p){
    const c = Dev.c();
    if (!p.cid) {
      const custs = c.customers.filter(x => Dev.outstanding(x.id) > 0);
      return { title:t('collect_payment'), back:1, body: custs.length ? `<div class="list">${custs.map(x => `<div class="card tap row between" data-a="go" data-s="collect" data-cid="${x.id}"><b>${esc(x.shop_name)}</b><b>${money(Dev.outstanding(x.id))}</b></div>`).join('')}</div>` : `<div class="note info">${t('nothing_owed')}</div>` };
    }
    const cust = Dev.customer(+p.cid), items = Dev.openItems(+p.cid);
    return { title:esc(cust.shop_name), back:1, body:`<div class="note info">${t('collect_hint')}</div>
      <div class="list">${items.map(x => { const k = x.kind + x.id; return `<div class="card"><div class="row between"><b>${x.kind === 'opening' ? t('opening_balance') : esc(x.label)}</b><b>${money(x.balance)}</b></div>
      <div class="muted small">${t('due_date')}: ${fmtD(x.due)}${x.due && x.due < todayKey() ? ' ' + chip('bad', t('overdue')) : ''}</div>
      <div class="grid2" style="margin-top:.6rem"><input type="number" inputmode="decimal" id="ca_${k}" placeholder="${t('amount')}" value="${x.balance}"><select id="cm_${k}"><option value="cash">${t('m_cash')}</option><option value="bank_transfer">${t('m_bank_transfer')}</option><option value="cheque">${t('m_cheque')}</option></select></div>
      <button class="btn block" style="margin-top:.6rem" data-a="recordCollection" data-kind="${x.kind}" data-id="${x.id}" data-cid="${cust.id}" data-bal="${x.balance}">${t('record_payment')}</button></div>`; }).join('')}</div>` };
  },
  perf(){
    const k = kpiMine();
    return { title:t('my_performance'), back:1, body:`<div class="card"><h3>${t('collection_vs_target')}</h3>${dipstick(k.pct, k.collected, k.target)}</div>
      <div class="note info">${t('kpi_rule')}</div>
      <div class="row card"><div class="stat"><b>${N(k.cartons)}</b><span>${t('cartons_month')}</span></div><div class="stat"><b>${N(k.carton_target || '–')}</b><span>${t('carton_target')}</span></div></div>` };
  },
  settings(){
    const ob = [...Dev.st.outbox].sort((a, b) => b.created_at - a.created_at).slice(0, 12);
    return { title:t('settings'), body:`
      <div class="card stack"><h3>${t('language')}</h3><div class="seg" style="grid-template-columns:1fr 1fr"><button class="${App.lang === 'ar' ? 'on' : ''}" data-a="lang" data-l="ar">العربية</button><button class="${App.lang === 'en' ? 'on' : ''}" data-a="lang" data-l="en">English</button></div></div>
      <div class="card stack"><div class="row between"><h3>${t('sync')}</h3>${syncPill()}</div>
        <div class="muted small">${t('pending_items')}: ${N(Dev.pending())} · ${t('last_sync')}: ${Dev.st.lastSync ? fmtDT(new Date(Dev.st.lastSync).toISOString()) : '–'}</div>
        <button class="btn block" data-a="syncNow">${t('sync_now')}</button>
        ${ob.length ? `<div class="list">${ob.map(o => `<div class="card" style="padding:.7rem"><div class="row between"><b class="small">${t('op_' + o.op_type)}</b>${chip({ pending:'warn', sending:'warn', synced:'ok', failed:'bad' }[o.status], t('ob_' + o.status))}</div>
          <div class="muted small">${t('attempts')}: ${N(o.attempts)} · ${fmtDT(new Date(o.created_at).toISOString())}</div>
          ${o.last_error ? `<div class="note bad" style="margin-top:.4rem">${esc(o.last_error)}</div>` : ''}
          ${o.status === 'failed' ? `<div class="row" style="margin-top:.5rem"><button class="btn sm" data-a="retryOb" data-id="${o.id}">${t('retry')}</button><button class="btn ghost sm" data-a="discardOb" data-id="${o.id}">${t('discard')}</button></div>` : ''}</div>`).join('')}</div>` : ''}</div>
      <div class="card row between"><span class="muted">${t('app_version')}</span><b class="num">1.0.0</b></div>
      <button class="btn ghost block" data-a="logout">${t('logout')}</button>` };
  }
};
function repShell(){
  const r = App.route, v = (RepViews[r.s] || RepViews.home)(r.p);
  const tabs = [['home', 'home', t('nav_home')], ['stock', 'box', t('nav_stock')], ['invoices', 'doc', t('nav_invoices')], ['customers', 'users', t('nav_customers')], ['settings', 'more', t('nav_more')]];
  const on = { home:'home', stock:'stock', request:'stock', invoices:'invoices', invoice:'invoices', customers:'customers', settings:'settings' }[r.s];
  return `<div class="rep"><div class="top">${v.back ? `<button class="btn ghost sm" data-a="back" aria-label="${t('back')}"><span class="flip" style="display:inline-flex;width:18px">${svg('back')}</span></button>` : ''}<h1>${v.title}</h1>${syncPill()}<button class="btn ghost sm" data-a="demo" aria-label="${t('demo_controls')}" style="width:40px">${svg('gear')}</button></div>
  <div class="pad stack">${v.body}</div>
  <nav class="nav" aria-label="main">${tabs.map(x => `<button class="${on === x[0] ? 'on' : ''}" data-a="tab" data-s="${x[0]}">${svg(x[1])}${x[2]}</button>`).join('')}</nav></div>`;
}
function custListHTML(q, region, mode){
  q = (q || '').trim().toLowerCase();
  const list = Dev.c().customers.filter(c => c.active && (!q || c.shop_name.toLowerCase().includes(q)) && (!region || String(c.region_id) === String(region)));
  if (!list.length) return `<div class="note info">${t('no_shops')}</div>`;
  const regName = id => { const r = Dev.c().regions.find(x => x.id === id); return r ? (App.lang === 'ar' ? r.name_ar : r.name_en) : ''; };
  return list.map(c => { const pend = c._pending, out = Dev.outstanding(c.id);
    return `<div class="card ${mode === 'visit' && !pend ? 'tap' : ''}" ${mode === 'visit' && !pend ? `data-a="pickCustomer" data-id="${c.id}"` : ''}>
    <div class="row between"><b>${esc(c.shop_name)}</b>${pend ? chip('warn', t('inv_pending')) : chip('grey', typeLabel(c.type))}</div>
    <div class="muted small">${esc(regName(c.region_id))}${c.phone ? ' · <span class="num">' + esc(c.phone) + '</span>' : ''}${out > 0 ? ' · ' + t('owed') + ' ' + money0(out) : ''}</div>
    ${mode === 'browse' && !pend ? `<div class="row" style="margin-top:.5rem"><button class="btn sm" data-a="pickCustomer" data-id="${c.id}">${t('start_visit')}</button>${out > 0 ? `<button class="btn ghost sm" data-a="go" data-s="collect" data-cid="${c.id}">${t('collect_payment')}</button>` : ''}</div>` : ''}
    ${pend && mode === 'visit' ? `<div class="small muted">${t('shop_pending_note')}</div>` : ''}</div>`; }).join('');
}

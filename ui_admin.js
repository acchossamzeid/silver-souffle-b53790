// ===================== Admin console views =====================
App.f = { inv:{ rep:'', pay:'', flag:'' }, ledger:{ prod:'', loc:'', type:'' } };
const AS = () => Server.snapshot(App.uid);
const repName = (s, id) => (s.users.find(u => u.id === id) || {}).full_name || '–';
const prodOf = (s, id) => s.products.find(p => p.id === id);
const custOf = (s, id) => s.customers.find(c => c.id === id);
const regName = (s, id) => { const r = s.regions.find(x => x.id === id); return r ? (App.lang === 'ar' ? r.name_ar : r.name_en) : '–'; };
const tbl = (head, rows, empty) => rows.length ? `<div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="note info">${empty || t('nothing_here')}</div>`;
const sumItems = i => i.items.reduce((a, x) => a + x.qty, 0);

const AdmViews = {
  dash(s){
    const today = todayKey(), month = today.slice(0, 7);
    const invT = s.invoices.filter(i => i.status === 'posted' && dayKey(i.synced_at) === today);
    const cash = Server.views.cashExpectedToday(s).reduce((a, x) => a + x.amount, 0);
    const kpi = Server.views.kpi(s, month).sort((a, b) => b.collected - a.collected);
    const low = Server.views.lowStock(s), flagged = s.invoices.filter(i => i.flags.length).length, exc = s.exc.filter(e => !e.resolved).length;
    const pend = s.transfers.filter(x => x.status === 'Pending').length, disp = s.transfers.filter(x => x.status === 'Disputed').length;
    return `<div class="kpis">
      <div class="card kpi"><b>${N(invT.reduce((a, i) => a + sumItems(i), 0))}</b><span>${t('cartons_today')}</span></div>
      <div class="card kpi"><b>${money0(cash)}</b><span>${t('cash_today')}</span></div>
      <div class="card kpi tap" data-a="admGo" data-s="flags"><b>${N(exc)}</b><span>${t('open_exceptions')}</span></div>
      <div class="card kpi tap" data-a="admGo" data-s="flags"><b>${N(flagged)}</b><span>${t('flagged_invoices')}</span></div>
      <div class="card kpi tap" data-a="admGo" data-s="transfers"><b>${N(pend)}${disp ? ' / <span style="color:var(--red)">' + N(disp) + '</span>' : ''}</b><span>${t('pending_disputed')}</span></div></div>
      <div class="card"><h2>${t('leaderboard')}</h2><div class="list" style="margin-top:.8rem">${kpi.map(k => `<div><div class="row between small"><b>${esc(k.name)}</b><span>${money0(k.collected)} / ${money0(k.target)} · <span class="num">${k.pct}%</span></span></div><div class="bar"><i style="width:${Math.min(100, k.pct)}%"></i></div></div>`).join('')}</div><div class="muted small" style="margin-top:.6rem">${t('kpi_rule')}</div></div>
      <div class="card"><h2>${t('low_stock')}</h2><div style="margin-top:.6rem">${low.length ? low.map(l => `<div class="row between small"><span>${esc(pname(l.product))}</span><span>${chip('bad', N(l.qty) + ' ≤ ' + N(l.reorder))}</span></div>`).join('') : `<span class="muted">${t('all_good')}</span>`}</div></div>`;
  },
  transfers(s){
    const sec = (st, title, limit) => {
      const list = s.transfers.filter(x => x.status === st).sort((a, b) => b.id - a.id).slice(0, limit || 50);
      return `<h2>${title} ${chip('grey', N(list.length))}</h2>` + (list.length ? `<div class="list">${list.map(x => `<div class="card"><div class="row between wrap"><b>#${N(x.id)} · ${esc(repName(s, x.rep_id))} ${x.handover_method ? chip(x.handover_method === 'qr' ? 'ok' : 'grey', t('method_' + x.handover_method)) : ''}</b><span class="muted small">${fmtDT(x.requested_at)}</span></div>
        ${x.notes ? `<div class="small muted" style="margin-top:.3rem">${esc(x.notes)}</div>` : ''}
        <div class="tablewrap" style="margin-top:.6rem"><table><thead><tr><th>${t('product')}</th><th>${t('requested')}</th><th>${t('in_warehouse')}</th>${st !== 'Pending' ? `<th>${t('qty_sent')}</th>` : ''}${st === 'Disputed' || st === 'Received' ? `<th>${t('qty_received')}</th>` : ''}</tr></thead><tbody>
        ${x.items.map(i => { const w = s.wh.find(y => y.product_id === i.product_id), short = w && st === 'Pending' && w.qty < i.qty_requested;
          return `<tr><td>${esc(pname(prodOf(s, i.product_id)))}</td><td>${N(i.qty_requested)}</td><td>${short ? chip('bad', N(w.qty)) : N(w ? w.qty : 0)}</td>${st !== 'Pending' ? `<td>${N(i.qty_sent)}</td>` : ''}${st === 'Disputed' || st === 'Received' ? `<td>${i.qty_received !== i.qty_sent ? chip('bad', N(i.qty_received)) : N(i.qty_received)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
 ${st === 'In-Transit' ? `<div class="row" style="margin-top:.6rem"><button class="btn" data-a="showQR" data-id="${x.id}">${t('show_handover_qr')}</button></div>` : ''}
        ${st === 'Pending' ? `<div class="row" style="margin-top:.6rem"><button class="btn" data-a="dispatch" data-id="${x.id}">${t('dispatch')}</button><button class="btn ghost" data-a="cancelT" data-id="${x.id}">${t('cancel_request')}</button></div>` : ''}
        ${st === 'Disputed' ? `<div class="row wrap" style="margin-top:.6rem"><button class="btn" data-a="resolveDispute" data-id="${x.id}">${t('resolve_dispute')}</button><button class="btn ghost" data-a="adjustVan">${t('adjust_stock')}</button></div>` : ''}</div>`).join('')}</div>` : `<div class="muted small">${t('nothing_here')}</div>`);
    };
    const req = (s.settings || {}).require_qr_handover === 'true', isAdmin = Server.user(App.uid).role === 'admin';
    const bar = `<div class="card row between wrap"><span>${chip(req ? 'ok' : 'grey', t(req ? 'require_qr_on' : 'require_qr_off'))}</span>${isAdmin ? `<button class="btn ghost sm" data-a="toggleQR" data-v="${req ? 'false' : 'true'}">${t(req ? 'make_optional' : 'make_required')}</button>` : ''}</div>`;
    return bar + sec('Pending', t('st_Pending')) + sec('In-Transit', t('st_In-Transit')) + sec('Disputed', t('st_Disputed')) + sec('Received', t('st_Received'), 5);
  },
  warehouse(s){
    return `<div class="row wrap"><button class="btn" data-a="supplierRecv">${t('receive_supplier')}</button><button class="btn ghost" data-a="adjustWh">${t('adjust_stock')}</button></div>` +
      tbl([t('product'), t('sku'), t('on_hand'), t('reorder_level'), ''], s.wh.map(w => { const p = prodOf(s, w.product_id);
        return [esc(pname(p)), `<span class="num">${esc(p.sku)}</span>`, `<b>${N(w.qty)}</b> ${w.qty <= w.reorder ? chip('bad', t('low')) : ''}`, N(w.reorder), `<button class="btn ghost sm" data-a="setReorder" data-id="${w.product_id}">${t('edit')}</button>`]; }));
  },
  vans(s){
    const reps = s.users.filter(u => u.role === 'rep'), prods = s.products.filter(p => p.active);
    return `<div class="row wrap"><button class="btn ghost" data-a="adjustVan">${t('adjust_stock')}</button></div>` +
      `<div class="tablewrap"><table><thead><tr><th>${t('product')}</th>${reps.map(r => `<th>${esc(r.full_name)}</th>`).join('')}</tr></thead><tbody>${prods.map(p => `<tr><td>${esc(pname(p))}</td>${reps.map(r => { const v = s.van.find(x => x.rep_id === r.id && x.product_id === p.id); const q = v ? v.qty : 0; return `<td>${q === 0 ? '<span class="muted">0</span>' : '<b>' + N(q) + '</b>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  },
  invoices(s){
    const f = App.f.inv;
    const list = s.invoices.filter(i => (!f.rep || i.rep_id === f.rep) && (!f.pay || i.payment_type === f.pay) && (!f.flag || (f.flag === 'any' ? i.flags.length : i.flags.includes(f.flag)))).sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
    const sel = (key, opts) => `<select data-oc="admFilter" data-g="inv" data-k="${key}" style="width:auto">${opts.map(o => `<option value="${o[0]}" ${f[key] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    return `<div class="row wrap">${sel('rep', [['', t('all_reps')], ...s.users.filter(u => u.role === 'rep').map(u => [u.id, u.full_name])])}${sel('pay', [['', t('all_payments')], ['cash', t('pay_cash')], ['credit', t('pay_credit')], ['split', t('pay_split')]])}
      ${sel('flag', [['', t('all_flags')], ['any', t('any_flag')], ...['gps_outside_geofence', 'low_gps_accuracy', 'credit_limit_exceeded', 'stock_conflict', 'mock_location'].map(x => [x, t('flag_' + x)])])}</div>` +
      tbl([t('invoice'), t('rep'), t('customer'), t('pay'), t('total'), t('balance'), t('flags'), t('when')], list.map(i => [`<a href="#" data-a="invDetail" data-id="${i.id}"><span class="num">${esc(i.invoice_number)}</span></a>`, esc(repName(s, i.rep_id)), esc(i.shop_name_snapshot), t('pay_' + i.payment_type), money(i.total), money(i.balance_due), i.flags.map(flagChip).join(' '), fmtDT(i.synced_at)]));
  },
  flags(s){
    const exc = s.exc.filter(e => !e.resolved), fl = s.invoices.filter(i => i.flags.length).sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
    return `<h2>${t('stock_exceptions')} ${chip(exc.length ? 'bad' : 'ok', N(exc.length))}</h2><div class="muted small">${t('exceptions_hint')}</div>` +
      tbl([t('rep'), t('product'), t('shortfall'), t('invoice'), t('when'), ''], exc.map(e => [esc(repName(s, e.rep_id)), esc(pname(prodOf(s, e.product_id))), `<b>${N(e.shortfall)}</b>`, `<span class="num">${esc((s.invoices.find(i => i.id === e.invoice_id) || {}).invoice_number)}</span>`, fmtDT(e.created_at), `<button class="btn sm" data-a="resolveExc" data-id="${e.id}">${t('resolve')}</button>`]), t('no_open_exceptions')) +
      `<h2>${t('flagged_invoices')}</h2>` + tbl([t('invoice'), t('rep'), t('customer'), t('flags'), t('distance'), ''], fl.map(i => [`<span class="num">${esc(i.invoice_number)}</span>`, esc(repName(s, i.rep_id)), esc(i.shop_name_snapshot), i.flags.map(flagChip).join(' '), N(Math.round(i.distance_from_shop_m || 0)) + ' m', `<button class="btn ghost sm" data-a="invDetail" data-id="${i.id}">${t('details')}</button>`]), t('nothing_here'));
  },
  credit(s){
    const today = todayKey(), rows = [];
    const docs = [...s.invoices.filter(i => i.status === 'posted' && i.balance_due > 0).map(i => ({ cid:i.customer_id, due:i.due_date, bal:i.balance_due })), ...s.open.filter(o => o.balance_due > 0).map(o => ({ cid:o.customer_id, due:o.due_date, bal:o.balance_due }))];
    const age = d => { if (!d || d >= today) return 0; const days = Math.floor((new Date(today) - new Date(d)) / 864e5); return days <= 30 ? 1 : days <= 60 ? 2 : 3; };
    const by = {}; docs.forEach(d => { const b = by[d.cid] || (by[d.cid] = [0, 0, 0, 0]); b[age(d.due)] += d.bal; });
    Object.entries(by).forEach(([cid, b]) => { const c = custOf(s, +cid), tot = r2(b.reduce((x, y) => x + y, 0)); rows.push([esc(c.shop_name), money0(c.credit_limit), `<b>${money0(tot)}</b>${tot > c.credit_limit ? ' ' + chip('bad', t('over_limit')) : ''}`, money0(b[0]), money0(b[1]), money0(b[2]), b[3] ? `<b style="color:var(--red)">${money0(b[3])}</b>` : '0']); });
    const tot = docs.reduce((a, d) => a + d.bal, 0), opn = s.open.reduce((a, o) => a + o.balance_due, 0);
    return `<div class="kpis"><div class="card kpi"><b>${money0(tot)}</b><span>${t('total_outstanding')}</span></div><div class="card kpi"><b>${money0(opn)}</b><span>${t('opening_balances')}</span></div></div>
      <div class="row wrap"><button class="btn" data-a="importOpen">${t('import_opening')}</button></div>` +
      tbl([t('customer'), t('credit_limit'), t('outstanding'), t('not_due'), '1–30 ' + t('days'), '31–60 ' + t('days'), '60+ ' + t('days')], rows, t('nothing_owed')) +
      `<h2>${t('collections')}</h2>` + tbl([t('rep'), t('customer'), t('amount'), t('method'), t('when')], [...s.colls].sort((a, b) => new Date(b.collected_at) - new Date(a.collected_at)).slice(0, 25).map(c => [esc(repName(s, c.rep_id)), esc(custOf(s, c.customer_id).shop_name), money(c.amount), t('m_' + c.method), fmtDT(c.collected_at)]));
  },
  customers(s){
    return `<div class="row wrap"><button class="btn" data-a="newCustomer">${t('add_shop')}</button></div>` + tbl([t('customer'), t('type'), t('region'), t('location'), t('credit_limit'), t('outstanding'), ''], s.customers.map(c => [`<b>${esc(c.shop_name)}</b>${c.active ? '' : ' ' + chip('grey', t('inactive'))}`, typeLabel(c.type), esc(regName(s, c.region_id)), c.loc ? chip('ok', t('verified')) : chip('warn', t('not_set')), money0(c.credit_limit), money0(Server.outstanding(c.id)), `<button class="btn ghost sm" data-a="editCustomer" data-id="${c.id}">${t('edit')}</button>`]));
  },
  products(s){
    return `<div class="row wrap"><button class="btn" data-a="editProduct" data-id="">${t('add_product')}</button></div><div class="note info">${t('price_note')}</div>` +
      tbl([t('sku'), t('product'), t('units_per_carton'), t('price_carton'), t('status'), ''], s.products.map(p => [`<span class="num">${esc(p.sku)}</span>`, esc(pname(p)), N(p.upc), money(p.price), p.active ? chip('ok', t('active')) : chip('grey', t('inactive')), `<button class="btn ghost sm" data-a="editProduct" data-id="${p.id}">${t('edit')}</button>`]));
  },
  reps(s){
    const month = todayKey().slice(0, 7);
    return tbl([t('rep'), t('phone'), t('region'), t('status'), t('collection_target'), t('carton_target'), ''], s.users.filter(u => u.role === 'rep').map(u => { const tg = s.targets.find(x => x.rep_id === u.id && x.month === month) || {};
      return [`<b>${esc(u.full_name)}</b>`, `<span class="num">${esc(u.phone)}</span>`, esc(regName(s, u.region_id)), u.active ? chip('ok', t('active')) : chip('bad', t('inactive')), money0(tg.collection_target || 0), N(tg.carton_target || '–'),
        `<button class="btn ghost sm" data-a="setTarget" data-id="${u.id}">${t('set_target')}</button> <button class="btn ${u.active ? 'danger' : ''} sm" data-a="toggleRep" data-id="${u.id}">${u.active ? t('deactivate') : t('activate')}</button>`]; }));
  },
  ledger(s){
    const f = App.f.ledger;
    const list = [...s.moves].reverse().filter(m => (!f.prod || m.product_id === +f.prod) && (!f.loc || m.location === f.loc) && (!f.type || m.type === f.type)).slice(0, 150);
    const sel = (key, opts) => `<select data-oc="admFilter" data-g="ledger" data-k="${key}" style="width:auto">${opts.map(o => `<option value="${o[0]}" ${f[key] === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    return `<div class="note info">${t('ledger_hint')}</div><div class="row wrap">${sel('prod', [['', t('all_products')], ...s.products.map(p => [p.id, pname(p)])])}${sel('loc', [['', t('all_locations')], ['warehouse', t('warehouse')], ['van', t('van')]])}
      ${sel('type', [['', t('all_types')], ...['RECEIPT_FROM_SUPPLIER', 'TRANSFER_OUT', 'TRANSFER_IN', 'SALE', 'ADJUSTMENT'].map(x => [x, t('mv_' + x)])])}</div>` +
      tbl([t('when'), t('product'), t('location'), t('type'), t('change'), t('balance_after'), t('by'), t('note')], list.map(m => [fmtDT(m.created_at), esc(pname(prodOf(s, m.product_id))), m.location === 'van' ? esc(repName(s, m.rep_id)) : t('warehouse'), t('mv_' + m.type), `<b style="color:var(${m.delta > 0 ? '--green' : '--red'})">${m.delta > 0 ? '+' : ''}${N(m.delta)}</b>`, N(m.balance_after), esc(repName(s, m.created_by)), esc(m.note || '')]));
  },
  checks(s){
    const bad = Server.views.reconcile(s), cash = Server.views.cashExpectedToday(s), today = todayKey();
    const stuck = s.transfers.filter(x => ['Pending', 'In-Transit', 'Disputed'].includes(x.status) && Date.now() - new Date(x.requested_at) > 864e5);
    const excOpen = s.exc.filter(e => !e.resolved).length, flagsToday = s.invoices.filter(i => i.flags.length && Date.now() - new Date(i.synced_at) < 864e5).length;
    const visits = s.users.filter(u => u.role === 'rep' && u.active).map(u => ({ u, n:s.visits.filter(v => v.rep_id === u.id && dayKey(v.check_in_at) === today).length }));
    const ok = b => b ? chip('ok', t('pass')) : chip('bad', t('check'));
    return `<div class="note info">${t('checks_hint')}</div>
      <div class="card"><div class="row between"><h2>${t('chk_ledger')}</h2>${ok(!bad.length)}</div>${bad.length ? tbl([t('location'), t('product'), t('on_hand'), t('ledger_total')], bad.map(b => [t(b.location === 'van' ? 'van' : 'warehouse') + (b.rep_id ? ' · ' + esc(repName(s, b.rep_id)) : ''), esc(pname(prodOf(s, b.product_id))), N(b.balance), N(b.ledger)])) : `<div class="muted small">${t('chk_ledger_ok')}</div>`}</div>
      <div class="card"><div class="row between"><h2>${t('chk_stuck')}</h2>${ok(!stuck.length)}</div><div class="muted small">${stuck.length ? stuck.map(x => '#' + x.id + ' ' + esc(repName(s, x.rep_id)) + ' (' + t('st_' + x.status) + ')').join(', ') : t('nothing_here')}</div></div>
      <div class="card"><div class="row between"><h2>${t('chk_exc')}</h2>${ok(!excOpen)}</div><div class="muted small">${N(excOpen)} ${t('open_exceptions')} · ${N(flagsToday)} ${t('flagged_invoices')} (24h)</div></div>
      <div class="card"><h2>${t('chk_cash')}</h2><div class="list" style="margin-top:.6rem">${cash.map(c => `<div class="row between"><span>${esc(c.rep.full_name)}</span><b>${money(c.amount)}</b></div>`).join('')}</div><div class="muted small" style="margin-top:.5rem">${t('chk_cash_hint')}</div></div>
      <div class="card"><h2>${t('chk_visits')}</h2><div class="list" style="margin-top:.6rem">${visits.map(v => `<div class="row between"><span>${esc(v.u.full_name)}</span>${chip(v.n >= 12 ? 'ok' : 'warn', N(v.n) + ' / 15')}</div>`).join('')}</div></div>`;
  }
};
function adminShell(){
  const me = Server.user(App.uid), role = me.role, s = AS();
  const items = role === 'admin' ? ['dash', 'transfers', 'warehouse', 'vans', 'invoices', 'flags', 'credit', 'customers', 'products', 'reps', 'ledger', 'checks'] : ['transfers', 'warehouse', 'checks'];
  let cur = App.route.s; if (!items.includes(cur)) cur = items[0];
  const body = AdmViews[cur](s);
  return `<div class="adm"><aside class="side"><h2>${t('app_name')}</h2>${items.map(i => `<button class="${i === cur ? 'on' : ''}" data-a="admGo" data-s="${i}">${t('adm_' + i)}</button>`).join('')}
    <div style="margin-top:1rem;padding:.4rem .6rem" class="muted small">${esc(me.full_name)}<br>${chip('grey', t('role_' + role))}</div>
    <button data-a="demo" style="margin-top:.4rem">${t('demo_controls')}</button></aside>
    <main class="main stack"><div class="row between"><h1>${t('adm_' + cur)}</h1>${Net.offline ? chip('grey', t('offline')) : ''}</div>${body}</main></div>`;
}

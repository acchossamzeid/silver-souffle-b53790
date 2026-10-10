// ===================== UI core =====================
const App = { lang:'ar', uid:null, route:{ s:'login', p:{} }, hist:[], theme:null };
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function t(k, ...a){
  const e = L[k]; if (!e) { console.warn('missing i18n key', k); return k; }
  let s = e[App.lang === 'ar' ? 1 : 0]; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s;
}
const money = n => '<span class="m"><span class="num">' + Number(n||0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '</span> ' + t('sar') + '</span>';
const money0 = n => '<span class="num">' + Number(n||0).toLocaleString('en-US', { maximumFractionDigits:0 }) + '</span>';
const N = n => '<span class="num">' + esc(n) + '</span>';
const fmtDT = iso => iso ? '<span class="num">' + new Date(iso).toLocaleString('en-GB', { timeZone:RYD, day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) + '</span>' : '–';
const fmtD = s => s ? '<span class="num">' + esc(String(s).slice(0,10)) + '</span>' : '–';
const pname = p => p ? `${p.brand} ${p.name} ${p.grade}${p.liters ? ' · ' + p.liters + 'L' : ''}` : '?';
const chip = (cls, txt) => `<span class="chip ${cls}">${txt}</span>`;
const IC = {
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  doc:'<path d="M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8"/>', users:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  truck:'<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8zM6 19a2 2 0 1 0 .1 0M17 19a2 2 0 1 0 .1 0"/>', cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  pin:'<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>', back:'<path d="M15 5l-7 7 7 7"/>', gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
};
const svg = (n, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra||''}>${IC[n]}</svg>`;

function toast(msg, bad){
  const old = $('#toast'); if (old) old.remove();
  const d = document.createElement('div'); d.id = 'toast'; d.className = 'toast' + (bad ? ' bad' : ''); d.setAttribute('role', 'status'); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
}
function go(s, p, opts){
  if (!(opts && opts.noHist)) App.hist.push(App.route);
  if (App.hist.length > 30) App.hist.shift();
  App.route = { s, p:p || {} }; render(); window.scrollTo(0, 0);
}
function tab(s){ App.hist = []; App.route = { s, p:{} }; render(); window.scrollTo(0, 0); }
function back(){ App.route = App.hist.pop() || { s:'home', p:{} }; render(); window.scrollTo(0, 0); }
function persistApp(){ store.set('oilrep.app', { lang:App.lang, uid:App.uid, theme:App.theme }); }
function applyLang(){ document.documentElement.lang = App.lang; document.documentElement.dir = App.lang === 'ar' ? 'rtl' : 'ltr'; document.title = t('app_name'); }

// ---- modal + generic form
function openModal(html){ closeModal(); const d = document.createElement('div'); d.className = 'scrim'; d.id = 'modal'; d.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`; d.addEventListener('click', e => { if (e.target === d) closeModal(); }); document.body.appendChild(d); const f = d.querySelector('input,select,textarea'); if (f) f.focus(); }
function closeModal(){ if (typeof stopScannerSilently === 'function') stopScannerSilently(); const m = $('#modal'); if (m) m.remove(); }
let _formCb = null;
function openForm(title, fields, onSubmit, submitLabel){
  _formCb = onSubmit;
  const fh = fields.map(f => {
    const id = 'f_' + f.id, v = f.value == null ? '' : f.value;
    let inp;
    if (f.type === 'select') inp = `<select id="${id}">${f.options.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') inp = `<textarea id="${id}" rows="2">${esc(v)}</textarea>`;
    else inp = `<input id="${id}" type="${f.type || 'text'}" value="${esc(v)}" ${f.min != null ? 'min="' + f.min + '"' : ''} ${f.step ? 'step="' + f.step + '"' : ''} inputmode="${f.type === 'number' ? 'decimal' : 'text'}">`;
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${inp}${f.hint ? `<span class="small muted">${esc(f.hint)}</span>` : ''}</div>`;
  }).join('');
  openModal(`<h2>${esc(title)}</h2><div class="stack" style="margin-top:1rem">${fh}</div><div class="row" style="margin-top:1.2rem"><button class="btn grow" data-a="formSubmit">${esc(submitLabel || t('save'))}</button><button class="btn ghost" data-a="closeModal">${t('cancel')}</button></div>`);
  _formFields = fields;
}
let _formFields = [];
function formValues(){ const o = {}; _formFields.forEach(f => { const el = $('#f_' + f.id); o[f.id] = el ? el.value : ''; }); return o; }

// ---- status chips
const trChip = s => chip({ Pending:'warn', 'In-Transit':'', Received:'ok', Disputed:'bad', Cancelled:'grey', PendingSync:'warn' }[s] || 'grey', t('st_' + s));
const invChip = st => st === 'synced' ? chip('ok', t('inv_synced')) : st === 'failed' ? chip('bad', t('inv_failed')) : chip('warn', t('inv_pending'));
const flagChip = f => chip(f === 'credit_limit_exceeded' || f === 'stock_conflict' ? 'bad' : 'warn', t('flag_' + f));
const typeLabel = x => t('type_' + x);
const dueDefault = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

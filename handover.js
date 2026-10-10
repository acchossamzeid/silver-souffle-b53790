// ===================== QR handover: warehouse keeper <-> rep =====================
// The keeper's screen shows a QR (made by the database at dispatch). The rep scans it with the camera;
// the server checks the code when the receipt syncs. If the camera or a library is unavailable, the same
// code can be typed, so a broken camera never blocks a delivery.
const HANDOVER_PREFIX = 'OILREP1';
function parseHandover(text){
  const s = String(text || '').trim(), m = s.split('|');
  if (m.length === 3 && m[0] === HANDOVER_PREFIX && /^\d+$/.test(m[1]) && /^[A-Za-z0-9]{6,16}$/.test(m[2])) return { id:+m[1], code:m[2].toUpperCase() };
  const raw = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (/^[A-HJ-NP-Z2-9]{8}$/.test(raw)) return { id:null, code:raw };          // a typed code carries no transfer number
  return null;
}
const prettyCode = c => String(c).replace(/(.{4})(?=.)/g, '$1-');
const cleanCode = c => String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const qrWanted = () => ((Dev.c().settings || {}).require_qr_handover === 'true');

function drawQR(canvas, text, px){
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 4, cell = Math.max(4, Math.floor(px / (n + quiet * 2))), size = (n + quiet * 2) * cell;
  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
}

// ---- warehouse keeper (admin console): show the QR for an In-Transit transfer
async function showHandoverQR(transferId){
  let r;
  try { r = await api(App.uid, 'get_handover_qr', { transfer_id:transferId }); }
  catch(e){ toast(e instanceof NetError ? t('no_connection') : e.message, true); return; }
  const who = repName(Server.snapshot(App.uid), r.rep_id), canQR = typeof qrcode === 'function';
  openModal(`<div class="row between"><h2>${t('handover_qr_title')} #${N(transferId)}</h2><button class="btn ghost sm" data-a="closeModal">${t('close')}</button></div>
    <div class="stack" style="margin-top:.8rem;text-align:center"><b>${esc(who)}</b>
    ${canQR ? '<canvas id="qr-canvas" style="max-width:100%;height:auto;border:1px solid var(--line);border-radius:12px;align-self:center"></canvas>' : ''}
    <div class="muted small">${t('handover_code_label')}</div>
    <div id="qr-code-text" dir="ltr" style="font-size:2rem;font-weight:700;letter-spacing:.12em">${esc(prettyCode(r.code))}</div>
    <div class="note info">${t('handover_qr_hint')}</div></div>`);
  if (canQR) drawQR($('#qr-canvas'), r.payload, 300);
}

// ---- rep: scan with the camera
let _scanner = null, _scanDone = false;
function stopScannerSilently(){ if (_scanner) { const s = _scanner; _scanner = null; Promise.resolve().then(() => s.stop()).then(() => s.clear()).catch(() => {}); } }
async function startHandoverScan(transferId){
  if (typeof Html5Qrcode === 'undefined') { toast(t('scan_unavailable'), true); return; }
  _scanDone = false;
  openModal(`<div class="row between"><h2>${t('scan_title')}</h2><button class="btn ghost sm" data-a="stopScan">${t('close')}</button></div>
    <div class="stack" style="margin-top:.8rem"><div id="qr-reader" style="width:100%"></div><div id="scan-msg" class="muted small">${t('scan_hint')}</div></div>`);
  try {
    _scanner = new Html5Qrcode('qr-reader');
    await _scanner.start({ facingMode:'environment' }, { fps:10, qrbox:{ width:240, height:240 } }, text => {
      if (_scanDone) return;
      const h = parseHandover(text), el = $('#scan-msg');
      if (!h || (h.id !== null && h.id !== transferId)) { if (el) el.innerHTML = `<span style="color:var(--red)">${esc(t(h ? 'scan_wrong_transfer' : 'scan_not_ours'))}</span>`; return; }
      _scanDone = true;
      Dev.st.recvCode = Dev.st.recvCode || {}; Dev.st.recvCode[transferId] = h.code; Dev.save();
      closeModal(); toast(t('scan_ok')); render();
    }, () => {});
  } catch(e){ const el = $('#scan-msg'); if (el) el.innerHTML = `<span style="color:var(--red)">${esc(t('camera_error'))}</span>`; }
}

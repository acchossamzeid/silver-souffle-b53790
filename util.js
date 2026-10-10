// ===================== utilities =====================
const mem = {};
const store = {
  get(k){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] ? JSON.parse(mem[k]) : null); } catch(e){ return mem[k] ? JSON.parse(mem[k]) : null; } },
  set(k,v){ const s = JSON.stringify(v); mem[k] = s; try { localStorage.setItem(k, s); } catch(e){} },
  del(k){ delete mem[k]; try { localStorage.removeItem(k); } catch(e){} }
};
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
function haversine(a, b){
  const R = 6371000, d = x => x*Math.PI/180;
  const dLat = d(b.lat-a.lat), dLng = d(b.lng-a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(d(a.lat))*Math.cos(d(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
class BizError extends Error {}   // server rejected (HTTP 4xx): do not blindly retry
class NetError extends Error {}   // no connection / lost response: safe to retry
const biz = m => new BizError(m);

// Asia/Riyadh helpers (storage is UTC ISO strings)
const RYD = 'Asia/Riyadh';
const dayKey = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: RYD });
const monthKey = iso => dayKey(iso).slice(0,7);
const todayKey = () => dayKey(new Date().toISOString());


// ---- Visible error bar: a blank page becomes a message that can be screenshotted and sent to support
function showFatal(msg){
  if (!msg || /ResizeObserver|^Script error\.?$/.test(String(msg))) return;
  let b = document.getElementById('fatal');
  if (!b) {
    b = document.createElement('div'); b.id = 'fatal'; b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#B3302F;color:#fff;padding:10px 14px;font:14px/1.5 Arial,sans-serif;direction:ltr;text-align:left;max-height:40vh;overflow:auto';
    document.body.appendChild(b);
  }
  b.innerHTML = '<b>حدث خطأ غير متوقع. صوّر الشاشة وأرسلها للدعم · Unexpected error. Screenshot this and send it to support.</b><br><code></code><br><button style="margin-top:6px;padding:4px 12px">OK</button>';
  b.querySelector('code').textContent = String(msg).slice(0, 400);
  b.querySelector('button').onclick = () => b.remove();
}
window.addEventListener('error', e => showFatal(e.message || (e.error && e.error.message)));
window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r instanceof NetError) return; showFatal(r && r.message ? r.message : String(r)); });

// ===================== production login, resume, settings panel =====================
function configProblems(){
  const bad = [], ph = v => !v || /YOUR-|PASTE/i.test(v);
  if (ph(CFG.SUPABASE_URL)) bad.push('SUPABASE_URL');
  if (ph(CFG.SUPABASE_ANON_KEY)) bad.push('SUPABASE_ANON_KEY');
  return bad;
}
function loginViewRemote(){
  const exp = Auth.expired && App.uid;
  if (!configOk()) {
    const missingFile = window.OILREP_CONFIG === undefined;
    return `<div class="login stack"><div class="row between"><h1>${t('app_name')}</h1><button class="btn ghost sm" data-a="lang" data-l="${App.lang === 'ar' ? 'en' : 'ar'}">${App.lang === 'ar' ? 'English' : 'العربية'}</button></div>
      <div class="note bad">${missingFile ? t('config_file_missing') : t('config_missing')}</div>
      ${missingFile ? '' : `<div class="note warn">${t('still_placeholder')} <code dir="ltr">${configProblems().join(', ')}</code></div>`}</div>`;
  }
  return `<div class="login stack"><div class="row between"><h1>${t('app_name')}</h1><button class="btn ghost sm" data-a="lang" data-l="${App.lang === 'ar' ? 'en' : 'ar'}">${App.lang === 'ar' ? 'English' : 'العربية'}</button></div>
    <div class="muted">${t('login_tag')}</div>${exp ? `<div class="note warn">${t('session_expired')}</div>` : ''}<div id="conn" class="small" dir="ltr"></div>
    <div id="loginerr">${App.bootMsg ? `<div class="note bad">${esc(App.bootMsg)}</div>` : ''}</div>
    <div class="field"><label for="em">${t('email')}</label><input id="em" type="email" autocomplete="username" inputmode="email" dir="ltr"></div>
    <div class="field"><label for="pw">${t('password')}</label><input id="pw" type="password" autocomplete="current-password" dir="ltr"></div>
    <button class="btn block" data-a="doLogin">${t('sign_in')}</button></div>`;
}
// Tells the person BEFORE they type a password whether the server address and key in config.js are right.
async function checkConnection(){
  const el = $('#conn'); if (!el || !configOk()) return;
  let host = ''; try { host = new URL(BASE).host; } catch(e){ el.innerHTML = `<div class="note bad">${t('err_bad_url')}</div>`; return; }
  el.innerHTML = `<span class="muted">${t('checking_server')} ${esc(host)}…</span>`;
  try {
    const r = await fetch(BASE + '/auth/v1/settings', { headers:{ apikey:CFG.SUPABASE_ANON_KEY } });
    const box = $('#conn'); if (!box) return;
    if (r.status === 401 || r.status === 403) box.innerHTML = `<div class="note bad">${t('err_bad_key')}</div>`;
    else if (r.status >= 500) box.innerHTML = `<div class="note bad">${t('err_unreachable')}</div>`;
    else box.innerHTML = `<span class="chip ok">✓ ${t('server_ok')}</span> <span class="muted">${esc(host)}</span>`;
  } catch(e){ const box = $('#conn'); if (box) box.innerHTML = `<div class="note bad">${t('err_unreachable')}</div>`; }
}
function loginFailMessage(e){
  if (e instanceof AuthExpired) return t('session_expired');
  if (e instanceof NetError) return t('err_unreachable');
  if (e instanceof SetupError) return t('err_' + e.code);
  return null;
}
function demoPanelRemote(){
  openModal(`<div class="row between"><h2>${t('settings_short')}</h2><button class="btn ghost sm" data-a="closeModal">${t('close')}</button></div>
    <div class="stack" style="margin-top:1rem"><button class="btn ghost block" data-a="lang" data-l="${App.lang === 'ar' ? 'en' : 'ar'}">${App.lang === 'ar' ? 'English' : 'العربية'}</button>
    <button class="btn danger block" data-a="logout">${t('logout')}</button><div class="muted small">${t('version_label')} 1.0.0</div></div>`);
}
async function enterApp(uid){
  App.uid = uid;
  const me = Server.user(uid); if (!me) { Auth.logout(); App.uid = null; render(); return; }
  if (me.role === 'rep') { Dev.load(uid); RealGPS.start(); }      // start listening for a fix right away
  App.route = { s:me.role === 'rep' ? 'home' : (me.role === 'admin' ? 'dash' : 'transfers'), p:{} };
  App.hist = []; afterLogin(); if (me.role === 'rep' && me.active) { await Dev.refresh(); Dev.sync(true); } render(); window.scrollTo(0, 0);
}
Act.doLogin = async function(){
  const em = ($('#em') || {}).value || '', pw = ($('#pw') || {}).value || '', box = $('#loginerr');
  const fail = m => { if (box) box.innerHTML = `<div class="note bad">${esc(m)}</div>`; };
  if (!em || !pw) return;
  App.bootMsg = null;
  try { await Auth.login(em, pw); } catch(e){ fail(loginFailMessage(e) || t('bad_login')); return; }          // only a 400 means wrong email/password
  try { await Remote.refresh(); } catch(e){ Auth.logout(); fail(loginFailMessage(e) || (t('err_generic') + ' ' + e.message)); return; }
  if (!(Remote.snap && Remote.snap.me)) { Auth.logout(); fail(t('err_no_profile')); return; }                  // signed in, but no staff row
  await enterApp(Auth.session.uid);
};
Act.loginAs = undefined;
window.addEventListener('online', () => { if (Dev.uid) Dev.sync(true); });

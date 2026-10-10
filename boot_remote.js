(async function boot(){
  try {
    const prefs = store.get('oilrep.app') || {}; if (prefs.lang) App.lang = prefs.lang;
    applyLang();
    if (!configOk() || !Auth.session) { render(); return; }
    const uid = Auth.session.uid;
    try { await Remote.refresh(); }
    catch(e){
      if (e instanceof AuthExpired) { App.uid = uid; Auth.expired = true; Dev.load(uid); render(); return; }
      if (e instanceof SetupError) { App.bootMsg = loginFailMessage(e); render(); return; }
      Dev.load(uid); if (!Dev.st.cache) { render(); return; }          // offline start: use what this phone already downloaded
    }
    await enterApp(uid);
  } catch(e){ showFatal(e && e.message ? e.message : e); try { render(); } catch(_) {} }
})();
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

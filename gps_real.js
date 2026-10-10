// ===================== real GPS (replaces the demo simulator) =====================
const RealGPS = {
  pos:null, denied:false, on:false,
  start(){
    if (this.on) return; this.on = true;
    if (!navigator.geolocation) { this.denied = true; return; }
    navigator.geolocation.watchPosition(
      p => { this.pos = { lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy, at:Date.now() }; this.denied = false; },
      e => { if (e.code === 1) this.denied = true; },
      { enableHighAccuracy:true, maximumAge:10000, timeout:30000 });
  }
};
// Browsers cannot detect mock-location apps; that flag only comes from a native build.
Dev.gps = function(){
  RealGPS.start();
  if (RealGPS.denied) return { denied:true };
  if (!RealGPS.pos || Date.now() - RealGPS.pos.at > 180000) return { denied:true, nofix:true };
  return { lat:RealGPS.pos.lat, lng:RealGPS.pos.lng, acc:RealGPS.pos.acc };
};

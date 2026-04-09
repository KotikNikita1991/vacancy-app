// api.js
async function api(action, body){
  body = body || {};
  var url = getApiUrl();
  var cfg = (typeof VACANCY_APP !== 'undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  if(!url || String(url).includes('ВСТАВЬ')){
    if(typeof showDemoBar === 'function') showDemoBar();
    return null;
  }
  var ctrl = new AbortController();
  var ms = cfg.API_TIMEOUT_MS || 20000;
  var t = setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, ms);
  try{
    var r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, body)),
      signal: ctrl.signal
    });
    clearTimeout(t);
    if(!r.ok){
      setBarError('HTTP ' + r.status);
      return { ok: false, error: 'HTTP ' + r.status };
    }
    var text = await r.text();
    try{
      return JSON.parse(text);
    }catch(e){
      return { ok: false, error: String(text).slice(0, 200) };
    }
  }catch(e){
    clearTimeout(t);
    setBarError(e && e.name === 'AbortError' ? 'Таймаут запроса' : String(e && (e.message || e) || e));
    return null;
  }
}


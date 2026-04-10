// api.js
async function api(action, body){
  body = body || {};
  var cfg = (typeof VACANCY_APP !== 'undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  var urls = (typeof getApiUrlCandidates === 'function') ? getApiUrlCandidates() : [getApiUrl()];
  urls = urls.filter(function(u){ return u && String(u).indexOf('ВСТАВЬ') === -1; });
  if(!urls.length){
    if(typeof showDemoBar === 'function') showDemoBar();
    return null;
  }
  var lastErr = null;
  for(var i = 0; i < urls.length; i++){
    var url = urls[i];
    var ctrl = new AbortController();
    var ms = cfg.API_TIMEOUT_MS || 20000;
    var t = setTimeout(function(){ try{ ctrl.abort(); }catch(e){} }, ms);
    try{
      var r = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, body)),
        signal: ctrl.signal
      });
      clearTimeout(t);
      if(!r.ok){
        lastErr = { ok: false, error: 'HTTP ' + r.status };
        if(r.status >= 500 || r.status === 0) continue;
        setBarError('HTTP ' + r.status);
        return lastErr;
      }
      var text = await r.text();
      var parsed;
      try{
        parsed = JSON.parse(text);
      }catch(e){
        lastErr = { ok: false, error: String(text).slice(0, 200) };
        continue;
      }
      try{
        if(cfg.LS_API_LAST_OK) sessionStorage.setItem(cfg.LS_API_LAST_OK, url);
      }catch(e2){}
      if(typeof hideBar === 'function' && parsed && parsed.ok) hideBar();
      return parsed;
    }catch(e){
      clearTimeout(t);
      var msg = e && e.name === 'AbortError' ? 'Таймаут запроса' : String(e && (e.message || e) || e);
      if(i === urls.length - 1){
        setBarError(msg);
        return null;
      }
    }
  }
  if(lastErr && lastErr.error){
    setBarError(lastErr.error);
    return lastErr;
  }
  return null;
}


(function(g){
  var C = {
    // Прямой Apps Script (часто доступен там, где Cloudflare Workers режется)
    DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbz5jIKT_KALX1xBBG3r79D2023k0g5YBqgzRiNtplcWAJ1QppZ2WQKmxt3i0EnwQlZolw/exec',
    // Дополнительные URL по очереди, если основной недоступен
    API_URL_FALLBACKS: [
      'https://vacancy-app-proxy.mcnil1991.workers.dev',
      'https://script.google.com/macros/s/AKfycbz35ssvJ0SM-Om3OuDu9NPFRl6-V2iP_gr-eqi3q-odPg_DMQaWuFK89tdSlkvBjzRk_Q/exec'
    ],
    LS_API_URL: 'vacancy_app_api_url',
    LS_API_LAST_OK: 'vacancy_app_api_last_ok',
    LS_DASH_PREFS: 'vacancy_app_dash_prefs',
    LS_PLANS: 'vacancy_app_plans',
    API_TIMEOUT_MS: 20000
  };
  function getApiUrl(){
    try{
      var v = localStorage.getItem(C.LS_API_URL);
      if(v && String(v).trim()) return String(v).trim();
    }catch(e){}
    return C.DEFAULT_API_URL;
  }
  function getApiUrlCandidates(){
    var seen = {};
    var out = [];
    function add(u){
      if(!u || String(u).indexOf('ВСТАВЬ') !== -1) return;
      u = String(u).trim();
      if(!u || seen[u]) return;
      seen[u] = 1;
      out.push(u);
    }
    try{
      var ls = localStorage.getItem(C.LS_API_URL);
      if(ls) add(ls);
    }catch(e){}
    add(C.DEFAULT_API_URL);
    (C.API_URL_FALLBACKS || []).forEach(add);
    try{
      var ok = sessionStorage.getItem(C.LS_API_LAST_OK);
      if(ok && out.indexOf(ok) > 0){
        out = [ok].concat(out.filter(function(x){ return x !== ok; }));
      }
    }catch(e){}
    return out.length ? out : [getApiUrl()];
  }
  g.VACANCY_APP = g.VACANCY_APP || {};
  g.VACANCY_APP.config = C;
  g.getApiUrl = getApiUrl;
  g.getApiUrlCandidates = getApiUrlCandidates;
})(typeof window !== 'undefined' ? window : this);

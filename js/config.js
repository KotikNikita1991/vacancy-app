(function(g){
  var C = {
    // Актуальный деплой веб-приложения (при смене — обновите и задеплойте фронт).
    DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbwZA6uYQTRGk4OziTXxizHm2_S_tX7hmWE00SgbzTLB9fGn6UZpxo9OSIJ0sWJ8c8zqag/exec',
    // Только рабочий деплой. Не добавляйте сюда «запасные» URL без проверки — иначе клиент
    // будет долго перебирать мёртвые адреса (404 / connection reset).
    API_URL_FALLBACKS: [],
    // v2: смена ключа сбрасывает старый URL из localStorage (частая причина «Неизвестный action»).
    LS_API_URL: 'vacancy_app_api_url_v2',
    LS_API_LAST_OK: 'vacancy_app_api_last_ok',
    LS_DASH_PREFS: 'vacancy_app_dash_prefs',
    LS_PLANS: 'vacancy_app_plans',
    // Холодный старт Apps Script + отправка письма (GmailApp) часто > 20 с.
    API_TIMEOUT_MS: 120000
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
    return out.length ? out : [getApiUrl()];
  }
  g.VACANCY_APP = g.VACANCY_APP || {};
  g.VACANCY_APP.config = C;
  g.getApiUrl = getApiUrl;
  g.getApiUrlCandidates = getApiUrlCandidates;
})(typeof window !== 'undefined' ? window : this);

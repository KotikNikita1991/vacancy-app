(function(g){
  var C = {
    DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbz35ssvJ0SM-Om3OuDu9NPFRl6-V2iP_gr-eqi3q-odPg_DMQaWuFK89tdSlkvBjzRk_Q/exec',
    LS_API_URL: 'vacancy_app_api_url',
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
  g.VACANCY_APP = g.VACANCY_APP || {};
  g.VACANCY_APP.config = C;
  g.getApiUrl = getApiUrl;
})(typeof window !== 'undefined' ? window : this);

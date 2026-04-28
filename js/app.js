// ВАЖНО: на верхнем уровне используем var (а не let), чтобы переменные становились
// свойствами window и были доступны другим скриптам (ui-enhancements.js,
// dashboard-enhancements.js). С let они «висят» в lexical-scope текущего скрипта,
// а window.VACS / window.U / window.VAC_SELECTED оказываются undefined — из-за
// чего ломаются чекбоксы, inline-edit и дубликат вакансии.
var U=null, VACS=[], ASSESSMENTS=[], PAGE='dashboard', COLSB=false;
var PERIOD=defPeriod(), FQ='';
// Пустой массив = «все» (мультивыбор фильтров)
var FStat=[], FGrp=[], FRec=[];
const FILTER_STATUS_OPTS=['В работе','Закрыта','Приостановлена','Отменена','Передана'];
// Сортировка таблицы дашборда
var DASH_SORT={key:'date_opened',dir:'desc'};
// Вид дашборда: 'table' | 'kanban'
var VAC_VIEW='table';
// Чекбоксы выбранных вакансий (Set строковых id)
var VAC_SELECTED=new Set();
// Планы: {recruiterId: {month(YYYY-MM): count}}
var PLANS = {};
var UL = [];
var ACTIVE_TRANSFER_USERS = [];

function filterDdHtml(ddId,label,opts,selected){
  const boxes=opts.map(o=>{
    const esc=escapeHtml(o);
    const on=selected.includes(o)?' checked':'';
    return`<label class="filter-dd-item"><input type="checkbox" value="${esc}"${on}><span>${esc}</span></label>`;
  }).join('');
  return`<div class="filter-dd" id="${ddId}">
    <button type="button" class="filter-dd-btn" aria-expanded="false" aria-haspopup="listbox">
      <span class="filter-dd-lbl">${escapeHtml(label)}</span><span class="filter-dd-cnt"></span><span class="filter-dd-chev">▾</span>
    </button>
    <div class="filter-dd-panel" hidden>
      <div class="filter-dd-actions"><button type="button" class="filter-dd-clear">Снять выбор</button></div>
      <div class="filter-dd-list" role="list">${boxes}</div>
    </div>
  </div>`;
}

function filterDdSyncBtn(wrapId,count){
  const w=document.getElementById(wrapId);
  if(!w)return;
  const cnt=w.querySelector('.filter-dd-cnt');
  if(cnt)cnt.textContent=count?` (${count})`:'';
}

function bindFilterDd(wrapId,getArr,setArr,after){
  const w=document.getElementById(wrapId);
  if(!w)return;
  const btn=w.querySelector('.filter-dd-btn');
  const panel=w.querySelector('.filter-dd-panel');
  const list=w.querySelector('.filter-dd-list');
  const clear=w.querySelector('.filter-dd-clear');
  const read=()=>Array.from(list.querySelectorAll('input:checked')).map(i=>i.value);
  const sync=()=>{filterDdSyncBtn(wrapId,getArr().length);};
  sync();
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    const wasOpen=!panel.hidden;
    closeAllFilterDd();
    if(!wasOpen){panel.hidden=false;btn.setAttribute('aria-expanded','true');}
  });
  list.addEventListener('change',()=>{setArr(read());sync();after();});
  if(clear)clear.addEventListener('click',e=>{
    e.stopPropagation();
    list.querySelectorAll('input').forEach(i=>{i.checked=false;});
    setArr([]);sync();after();
  });
  panel.addEventListener('click',e=>e.stopPropagation());
}

function closeAllFilterDd(){
  document.querySelectorAll('.filter-dd-panel').forEach(p=>{p.hidden=true;});
  document.querySelectorAll('.filter-dd-btn').forEach(b=>b.setAttribute('aria-expanded','false'));
}

function initDocFilterDdClose(){
  if(document.body._vacFddDoc)return;
  document.body._vacFddDoc=true;
  document.addEventListener('click',()=>closeAllFilterDd());
}

function salarySortKey(s){
  if(s==null||s==='')return 0;
  const d=String(s).replace(/\D/g,'');
  return parseInt(d.slice(0,9),10)||0;
}

function sortVacanciesForDash(list,key,dir){
  const mult=dir==='desc'?-1:1;
  const val=v=>{
    switch(key){
      case 'date_opened':return v.date_opened||'';
      case 'name':return (v.name||'').toLowerCase();
      case 'vacancy_group':return v.vacancy_group||'';
      case 'recruiter':return v.current_recruiter_name||'';
      case 'status':return v.status||'';
      case 'fact_date':return v.fact_date||'';
      case 'salary_offer':return salarySortKey(v.salary_offer);
      case 'days':return Number(v.days_total)||0;
      default:return'';
    }
  };
  const cmp=(a,b)=>{
    const va=val(a),vb=val(b);
    if(va<vb)return-1;
    if(va>vb)return 1;
    return 0;
  };
  return[...list].sort((a,b)=>cmp(a,b)*mult);
}

const IC_PENCIL='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

// ══ API ══════════════════════════════════════════════
// ══ SESSION (Remember Me) ════════════════════════════
function _sessionCfg(){
  return (typeof VACANCY_APP!=='undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
}
function saveSession(user){
  try{
    const cfg=_sessionCfg();
    if(!cfg.LS_SESSION||!user)return;
    localStorage.setItem(cfg.LS_SESSION, JSON.stringify({user:user, savedAt:Date.now()}));
  }catch(e){}
}
function loadSession(){
  try{
    const cfg=_sessionCfg();
    if(!cfg.LS_SESSION)return null;
    const raw=localStorage.getItem(cfg.LS_SESSION);
    if(!raw)return null;
    const obj=JSON.parse(raw);
    if(!obj||!obj.user||!obj.savedAt)return null;
    const ttl=Number(cfg.SESSION_TTL_MS)||0;
    if(ttl>0 && (Date.now()-Number(obj.savedAt))>ttl){
      localStorage.removeItem(cfg.LS_SESSION);
      return null;
    }
    return obj.user;
  }catch(e){return null;}
}
function clearSession(){
  try{
    const cfg=_sessionCfg();
    if(cfg.LS_SESSION)localStorage.removeItem(cfg.LS_SESSION);
  }catch(e){}
}

// ══ LOGIN ════════════════════════════════════════════
function initLoginPage(){
  ['il','ip'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
  });
  const lb = document.getElementById('lbtn');
  if(lb) lb.addEventListener('click', () => doLogin());

  // Advanced API override: hidden by default (for end users).
  // Show only when opening the page with ?debug=1 (or ?debug=true).
  const apiWrap = document.getElementById('api-url-wrap');
  const qs = (() => { try { return new URLSearchParams(location.search); } catch(e){ return null; } })();
  const debugOn = !!(qs && (qs.get('debug') === '1' || String(qs.get('debug')).toLowerCase() === 'true'));
  if(apiWrap) apiWrap.style.display = debugOn ? '' : 'none';

  const apiOv = document.getElementById('api-url-ov');
  const apiSv = document.getElementById('api-url-save');
  const Cfg = (typeof VACANCY_APP !== 'undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  if(apiOv){
    try{ apiOv.value = localStorage.getItem(Cfg.LS_API_URL) || ''; }catch(e){}
  }
  if(apiSv && apiOv){
    apiSv.addEventListener('click', () => {
      const v = (apiOv.value || '').trim();
      try{
        if(v) localStorage.setItem(Cfg.LS_API_URL, v);
        else localStorage.removeItem(Cfg.LS_API_URL);
        toast('Адрес API сохранён');
      }catch(e){ toast('Не удалось сохранить','err'); }
    });
  }
}

async function doLogin(){
  const login=document.getElementById('il').value.trim();
  const pass=document.getElementById('ip').value;
  const btn=document.getElementById('lbtn');
  if(!login||!pass){showLErr('Введи логин и пароль');return}
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';
  document.getElementById('lerr').style.display='none';

  const res=await api('login',{login,password:pass});
  if(res?.ok&&res.user){if(typeof hideBar==='function')hideBar();U=res.user;saveSession(U);startApp();return;}
  showLErr(res?.error||(res===null?'Сервер недоступен. Попробуйте позже.':'Неверный логин или пароль'));
  rstBtn();
}
function showLErr(m){const e=document.getElementById('lerr');e.textContent=m;e.style.display='block'}
function rstBtn(){const b=document.getElementById('lbtn');b.disabled=false;b.innerHTML='Войти →'}

// ══ APP INIT ═════════════════════════════════════════
async function startApp(){
  document.getElementById('ls').style.display='none';
  document.getElementById('app').style.display='flex';
  // UI-улучшения: тема и хлебные крошки в шапке
  if(window.VAC_UI){
    try{window.VAC_UI.theme.injectButton();}catch(e){}
    try{window.VAC_UI.crumbs.inject();}catch(e){}
  }
  const rc=ROLES[U.role]||{};
  const ini=U.name.split(' ').map(w=>w[0]).join('').slice(0,2);
  document.getElementById('sbav').textContent=ini;
  // Цвет аватарки в сайдбаре — детерминированный по имени (если доступен хелпер)
  document.getElementById('sbav').style.background=(window.VAC_UI&&window.VAC_UI.color)?window.VAC_UI.color(U.name):(rc.c||'#888');
  document.getElementById('sbnm').textContent=U.name;
  document.getElementById('sbrl').textContent=rc.l||U.role;
  document.getElementById('hnm').textContent=U.name;
  const sbt=document.getElementById('btn-sidebar-toggle');
  if(sbt){sbt.replaceWith(sbt.cloneNode(true));document.getElementById('btn-sidebar-toggle').addEventListener('click',()=>toggleSB());}
  const lgo=document.getElementById('btn-logout');
  if(lgo){lgo.replaceWith(lgo.cloneNode(true));document.getElementById('btn-logout').addEventListener('click',()=>doLogout());}
  const b=document.getElementById('hbdg');
  b.textContent=rc.l||U.role;b.style.background=rc.bg||'#eee';b.style.color=rc.c||'#333';
  buildNav();
  initNavDelegation();
  // Планы: сначала берём кэш из localStorage, потом актуальные данные из API
  try{ Object.assign(PLANS, loadPlans()||{}); }catch(e){}
  loadPlansFromApi();
  initGlobalActs();
  initEscClose();
  initDocFilterDdClose();
  const rr=await api('getReference');
  if(rr?.ok){REF=rr.reference;updateGroupNorm();}
  await refreshActiveTransferUsers();
  navigate('dashboard');
}

async function refreshActiveTransferUsers(){
  const res=await api('getUsers',{role:U.role});
  if(res?.ok && Array.isArray(res.users)){
    UL=res.users;
    ACTIVE_TRANSFER_USERS=res.users.filter(u=>u && u.active!==false && String(u.id)!==String(U.id));
    return;
  }
  ACTIVE_TRANSFER_USERS=[];
}
function buildNav(){
  document.getElementById('nav').innerHTML=(NCFG[U.role]||[]).map(it=>`
    <div class="ni" id="ni-${it.id}" data-nav="${it.id}">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[it.ic]}</svg>
      <span class="ni-lbl">${it.lbl}</span>
    </div>`).join('');
}
function navigate(page){
  PAGE=page;
  document.querySelectorAll('.ni').forEach(el=>el.classList.toggle('active',el.id===`ni-${page}`));
  const ttls={dashboard:'Дашборд',analytics:'Аналитика',checklist:'Оценка кандидата',values:'Оценка ценностей',users:'Пользователи'};
  document.getElementById('httl').textContent=ttls[page]||page;
  // Сбрасываем хлебные крошки на корневую страницу
  if(window.VAC_UI&&window.VAC_UI.crumbs){
    try{window.VAC_UI.crumbs.set([{label:ttls[page]||page}]);}catch(e){}
  }
  // Skeleton-загрузка вместо «Загружаем...»
  if(window.VAC_UI&&window.VAC_UI.skeleton){
    try{window.VAC_UI.skeleton.show(page);}catch(e){
      document.getElementById('content').innerHTML=`<div class="loading"><span class="spin spd"></span> Загружаем...</div>`;
    }
  }else{
    document.getElementById('content').innerHTML=`<div class="loading"><span class="spin spd"></span> Загружаем...</div>`;
  }
  renderPage(page).finally(()=>{
    if(window.VAC_UI&&window.VAC_UI.fade){try{window.VAC_UI.fade();}catch(e){}}
    // Обновляем URL: страница в query (не для dashboard, чтобы было чище)
    if(window.VAC_UI&&window.VAC_UI.url){try{window.VAC_UI.url.write();}catch(e){}}
  });
}
function toggleSB(){COLSB=!COLSB;document.getElementById('sidebar').classList.toggle('col',COLSB)}
function doLogout(){
  clearSession();
  U=null;VACS=[];ASSESSMENTS=[];PLANS={};PERIOD=defPeriod();FStat=[];FGrp=[];FRec=[];FQ='';
  document.getElementById('app').style.display='none';
  document.getElementById('ls').style.display='flex';
  document.getElementById('il').value='';
  document.getElementById('ip').value='';
  document.getElementById('lerr').style.display='none';
  rstBtn();
}

// ══ ROUTER ═══════════════════════════════════════════
async function renderPage(p){
  if(!U||!U.role){
    const el=document.getElementById('content');
    if(el)el.innerHTML='<div class="card"><div class="empty" style="padding:48px"><h3>Сессия недоступна</h3><p style="color:var(--ink3);margin-top:8px">Выйдите и войдите снова.</p></div></div>';
    return;
  }
  if(p==='dashboard')await renderDash();
  else if(p==='analytics')await renderAnalytics();
  else if(p==='checklist')await renderChecklist();
  else if(p==='values')await renderValues();
  else if(p==='users')await renderUsers();
  else renderSoon(p);
}

// ══ PERMISSIONS ══════════════════════════════════════
function canEdit()         {return U.role==='manager'||U.role==='admin'}
function canCreate()       {return true}
function canDelete()       {return U.role==='admin'}
function canSetPlan()      {return U.role==='manager'||U.role==='admin'}
// Все роли могут менять статус своих вакансий и передавать их другому рекрутеру
function canChangeStatus() {return true}
function canTransfer()     {return true}

// Поля, которые рекрутер НЕ может редактировать
// ══ DASHBOARD ════════════════════════════════════════
async function renderDash(){
  const vr=await api('getVacancies',{role:U.role,recruiter_id:U.id});
  VACS=vr?.ok?(vr.vacancies||[]):[];
  const recNames=[...new Set(VACS.map(v=>v.current_recruiter_name).filter(Boolean))];
  const groups=[...VAC_GROUPS];
  try{
    const dp=loadDashPrefs();
    if(dp&&typeof dp==='object'){
      if(dp.PERIOD&&dp.PERIOD.from&&dp.PERIOD.to)PERIOD=dp.PERIOD;
      if(Array.isArray(dp.FStat))FStat=dp.FStat;
      else if(dp.FS==='Все'||dp.FS===undefined||dp.FS==='')FStat=[];
      else if(typeof dp.FS==='string')FStat=[dp.FS];
      if(Array.isArray(dp.FGrp))FGrp=dp.FGrp;
      else if(dp.FG==='Все'||dp.FG===undefined||dp.FG==='')FGrp=[];
      else if(typeof dp.FG==='string')FGrp=[dp.FG];
      if(Array.isArray(dp.FRec))FRec=dp.FRec;
      else if(dp.FR==='Все'||dp.FR===undefined||dp.FR==='')FRec=[];
      else if(typeof dp.FR==='string')FRec=[dp.FR];
      if(dp.FQ!==undefined)FQ=dp.FQ;
    }
  }catch(e){}
  // URL имеет приоритет над localStorage — позволяет делиться ссылкой
  if(window.VAC_UI&&window.VAC_UI.url){
    try{
      const u=window.VAC_UI.url.read();
      if(u.PERIOD)PERIOD=u.PERIOD;
      if(u.FStat)FStat=u.FStat;
      if(u.FGrp)FGrp=u.FGrp;
      if(u.FRec)FRec=u.FRec;
      if(u.FQ!==undefined)FQ=u.FQ;
    }catch(e){}
  }
  // Восстановим выбранный вид
  try{const sv=localStorage.getItem('vacancy_app_view');if(sv==='table'||sv==='kanban')VAC_VIEW=sv;}catch(e){}
  document.getElementById('content').innerHTML=buildDash(recNames,groups);
  bindDash();
}

function buildDash(recNames,groups){
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  const presets=[
    {l:'Этот месяц',  f:fd(new Date(y,m,1)),   t:fd(new Date(y,m+1,0))},
    {l:'Прошлый мес.',f:fd(new Date(y,m-1,1)), t:fd(new Date(y,m,0))},
    {l:'Квартал',     f:fd(new Date(y,Math.floor(m/3)*3,1)),t:fd(new Date(y,Math.floor(m/3)*3+3,0))},
    {l:'Год',         f:fd(new Date(y,0,1)),   t:fd(new Date(y,11,31))},
    {l:'Всё время',   f:'2020-01-01',           t:fd(new Date(y+1,0,1))},
  ];
  // showRecFilter — фильтр «Рекрутеры» только для admin/manager (они видят всех)
  // Колонка рекрутера показывается всем — рекрутер видит своё имя и может передать вакансию
  const showRecFilter=U.role!=='recruiter';
  return`
  <div class="toolbar">
    <span class="tbar-lbl">Период</span>
    ${presets.map(p=>`<button class="pbtn${p.f===PERIOD.from&&p.t===PERIOD.to?' on':''}" data-f="${p.f}" data-t="${p.t}">${p.l}</button>`).join('')}
    <span class="tsep">|</span>
    <input type="date" class="dinput" id="pdf" value="${PERIOD.from}">
    <span class="tsep">—</span>
    <input type="date" class="dinput" id="pdt" value="${PERIOD.to}">
    <button class="papply" id="btn-ok">OK</button>
  </div>
  <div class="toolbar" style="margin-bottom:16px">
    <span class="tbar-lbl">Фильтры</span>
    <div class="fsearch">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="fsrch" placeholder="Поиск..." value="${FQ}">
    </div>
    ${filterDdHtml('fdd-dash-st','Статусы',FILTER_STATUS_OPTS,FStat)}
    ${filterDdHtml('fdd-dash-grp','Группы',groups,FGrp)}
    ${showRecFilter?filterDdHtml('fdd-dash-rec','Рекрутеры',recNames,FRec):''}
    <button type="button" class="papply" id="btn-dash-reset">Сбросить</button>
    ${canCreate()?`<button type="button" class="btn-primary" id="btn-new-vac">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Новая вакансия
    </button>`:''}
    <div class="view-toggle" role="tablist" aria-label="Вид">
      <button type="button" class="vt-btn${VAC_VIEW==='table'?' on':''}" data-view="table" title="Таблица">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        Таблица
      </button>
      <button type="button" class="vt-btn${VAC_VIEW==='kanban'?' on':''}" data-view="kanban" title="Канбан">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="11" y="3" width="6" height="11" rx="1"/><rect x="19" y="3" width="2" height="6" rx="1"/></svg>
        Канбан
      </button>
    </div>
  </div>
  <div id="bulk-bar" class="bulk-bar" hidden></div>
  <div id="stats-row" class="stats-row"></div>
  <div class="card">
    <div class="ch">
      <span class="ct">Вакансии</span>
      <span class="csub" id="plbl">${fru(PERIOD.from)} — ${fru(PERIOD.to)}</span>
    </div>
    <div class="tbl-wrap" id="vtbl"></div>
  </div>`;
}

function bindDash(){
  document.querySelectorAll('.pbtn[data-f]').forEach(b=>b.onclick=()=>{
    PERIOD={from:b.dataset.f,to:b.dataset.t};saveDashPrefs();
    const pf=document.getElementById('pdf');const pt=document.getElementById('pdt');
    if(pf)pf.value=PERIOD.from;if(pt)pt.value=PERIOD.to;
    refreshDash();
  });
  const btnOk=document.getElementById('btn-ok');
  if(btnOk)btnOk.onclick=()=>{
    const f=document.getElementById('pdf').value;
    const t=document.getElementById('pdt').value;
    if(f&&t&&f<=t){
      PERIOD={from:f,to:t};
      document.querySelectorAll('.pbtn[data-f]').forEach(b=>b.classList.remove('on'));
      saveDashPrefs();refreshDash();
    }else toast('Укажи корректный диапазон дат','err');
  };
  const fs=document.getElementById('fsrch');
  if(fs)fs.oninput=e=>{FQ=e.target.value;saveDashPrefs();refreshDash()};
  const afterDashFilters=()=>{saveDashPrefs();refreshDash();};
  bindFilterDd('fdd-dash-st',()=>FStat,v=>{FStat=v;},afterDashFilters);
  bindFilterDd('fdd-dash-grp',()=>FGrp,v=>{FGrp=v;},afterDashFilters);
  bindFilterDd('fdd-dash-rec',()=>FRec,v=>{FRec=v;},afterDashFilters);
  const br=document.getElementById('btn-dash-reset');
  if(br)br.addEventListener('click',()=>{resetF();});
  const bn=document.getElementById('btn-new-vac');
  if(bn)bn.addEventListener('click',()=>openVacModal());
  // Переключатель Таблица / Канбан
  document.querySelectorAll('.vt-btn[data-view]').forEach(b=>{
    b.addEventListener('click',()=>{
      const v=b.dataset.view;
      if(v!=='table'&&v!=='kanban')return;
      if(VAC_VIEW===v)return;
      VAC_VIEW=v;
      try{localStorage.setItem('vacancy_app_view',v);}catch(e){}
      document.querySelectorAll('.vt-btn[data-view]').forEach(x=>x.classList.toggle('on',x.dataset.view===v));
      VAC_SELECTED.clear();
      refreshDash();
    });
  });
  refreshDash();
}

function resetF(){
  FStat=[];FGrp=[];FRec=[];FQ='';PERIOD=defPeriod();
  saveDashPrefs();
  navigate('dashboard');
}

function applyF(){
  return VACS.filter(v=>{
    if(!intersectsPeriod(v,PERIOD.from,PERIOD.to))return false;
    if(FStat.length&&!FStat.includes(v.status))return false;
    if(FGrp.length&&!(v.vacancy_group&&FGrp.includes(v.vacancy_group)))return false;
    if(FRec.length&&!FRec.includes(v.current_recruiter_name))return false;
    if(FQ){const q=FQ.toLowerCase();if(!v.name.toLowerCase().includes(q)&&!(v.department||'').toLowerCase().includes(q))return false;}
    return true;
  });
}

function intersectsPeriod(v, from, to){
  const opened = v.date_opened || '';
  if(!opened || opened > to) return false;
  const closed = v.fact_date || '';
  if(closed && closed < from) return false;
  return true;
}

function monthsInRange(from, to){
  const out = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  let y = start.getFullYear();
  let m = start.getMonth();
  const ey = end.getFullYear();
  const em = end.getMonth();
  while(y < ey || (y === ey && m <= em)){
    out.push(`${y}-${String(m + 1).padStart(2,'0')}`);
    m++;
    if(m > 11){ m = 0; y++; }
  }
  return out;
}

function sumPlanForPeriod(recIds, from, to){
  const months = monthsInRange(from, to);
  let total = 0;
  for(const recId of recIds){
    for(const month of months){
      total += Number(PLANS[`${recId}::${month}`] || 0);
    }
  }
  return total;
}

function refreshDash(){
  document.querySelectorAll('.pbtn[data-f]').forEach(b=>b.classList.toggle('on',b.dataset.f===PERIOD.from&&b.dataset.t===PERIOD.to));
  const lbl=document.getElementById('plbl');
  if(lbl)lbl.textContent=`${fru(PERIOD.from)} — ${fru(PERIOD.to)}`;
  const filtered=applyF();
  renderStats(filtered);
  renderVacTbl(filtered);
  // Синхронизируем фильтры в URL
  if(window.VAC_UI&&window.VAC_UI.url){try{window.VAC_UI.url.write();}catch(e){}}
}

function renderStats(vacs){
  const el=document.getElementById('stats-row');if(!el)return;
  const cl=vacs.filter(v=>PLAN_CLOSED_STATUSES.includes(v.status));
  const inWorkPeriod=vacs.filter(v=>intersectsPeriod(v, PERIOD.from, PERIOD.to));
  const inWorkNow=vacs.filter(v=>['В работе','Приостановлена'].includes(v.status));
  const cwn=cl.filter(v=>v.norm_days&&v.days_total!=null);
  const fast=cwn.filter(v=>Number(v.days_total)<Number(v.norm_days));
  const pct=cwn.length?Math.round(fast.length/cwn.length*100):0;
  const closedForAvg=vacs.filter(v=>PLAN_CLOSED_STATUSES.includes(v.status)&&v.days_total);
  const avg=closedForAvg.length?Math.round(closedForAvg.reduce((s,v)=>s+(v.days_total||0),0)/closedForAvg.length):0;
  el.innerHTML=
    sv('Всего',vacs.length,'за период','var(--acc)')+
    sv('В работе за период',inWorkPeriod.length,'В работе + Приостановлена','var(--blue)')+
    sv('В работе сейчас',inWorkNow.length,'актуальный срез','var(--blue)')+
    sv('Закрыто',cl.length,`${pct}% раньше норматива`,pct>=50?'var(--green)':'var(--amber)')+
    sv('Приостановлено',vacs.filter(v=>v.status==='Приостановлена').length,'','var(--amber)')+
    sv('Передано',vacs.filter(v=>v.transferred).length,'между рекрутерами','var(--blue)')+
    sv('Среднее',`${avg}д`,'сред. закрытых','var(--gray)');
}
function sv(lbl,val,sub,col){
  return`<div class="sc"><div class="sc-lbl">${lbl}</div><div class="sc-val">${val}</div>${sub?`<div class="sc-sub" style="color:${col}">${sub}</div>`:''}</div>`;
}

function thSort(key,label){
  const on=DASH_SORT.key===key?` sorted sorted-${DASH_SORT.dir}`:'';
  return`<th class="th-sort${on}" data-sort="${key}" scope="col">${escapeHtml(label)}<span class="sort-ind">${DASH_SORT.key===key?(DASH_SORT.dir==='asc'?'▲':'▼'):''}</span></th>`;
}

function renderVacTbl(vacs){
  const el=document.getElementById('vtbl');if(!el)return;
  // Если выбран канбан-вид — рендерим канбан и выходим
  if(VAC_VIEW==='kanban'&&window.VAC_DASH&&window.VAC_DASH.renderKanban){
    window.VAC_DASH.renderKanban(vacs);
    return;
  }
  // Колонка рекрутера видна всем: рекрутер видит своё имя и может передать вакансию
  const showRecCol=true;
  const showCb=canEdit();
  if(!vacs.length){
    el.innerHTML=`<div class="empty" style="padding:36px"><p style="color:var(--ink3)">Нет вакансий по выбранным фильтрам</p></div>`;
    if(window.VAC_DASH&&window.VAC_DASH.refreshBulkBar)window.VAC_DASH.refreshBulkBar();
    return;
  }
  const sorted=sortVacanciesForDash(vacs,DASH_SORT.key,DASH_SORT.dir);
  const editTitle=canEdit()?'Редактировать':'Просмотр';
  // Чистим выбранные id, которых нет среди отображаемых
  const visibleIds=new Set(sorted.map(v=>String(v.id)));
  Array.from(VAC_SELECTED).forEach(id=>{if(!visibleIds.has(id))VAC_SELECTED.delete(id);});
  const allChecked=sorted.length>0&&sorted.every(v=>VAC_SELECTED.has(String(v.id)));
  el.innerHTML=`<table><thead><tr>
    ${showCb?`<th style="width:32px;padding-left:14px"><input type="checkbox" id="cb-all" ${allChecked?'checked':''} aria-label="Выбрать все" style="accent-color:var(--acc);cursor:pointer"></th>`:''}
    ${thSort('date_opened','Дата')}
    ${thSort('name','Вакансия')}
    ${thSort('vacancy_group','Группа')}
    ${showRecCol?thSort('recruiter','Рекрутер'):''}
    ${thSort('status','Статус')}
    ${thSort('fact_date','Дата закрытия')}
    ${thSort('salary_offer','ЗП оффер')}
    ${thSort('days','Дней / норм')}
    <th></th>
  </tr></thead><tbody>
  ${sorted.map(v=>{
    const sc=SC_MAP[v.status]||'sc2';
    const days=Number(v.days_total)||0;
    const norm=Number(v.norm_days)||0;
    const isClosed=!!(v.fact_date&&FINAL_STATUSES.includes(v.status));
    const isOver=norm>0&&days>norm;
    const fastClosed=isClosed&&norm>0&&days<norm;
    const dc=isOver?'var(--red)':fastClosed?'var(--green)':'var(--ink)';
    const showNormCol=!isClosed&&norm>0;
    const grpBadge=v.vacancy_group?`<span style="font-size:10px;color:var(--ink3);background:var(--bg);padding:2px 7px;border-radius:5px;white-space:nowrap">${escapeHtml(v.vacancy_group)}</span>`:'';
    const overNote=isOver?'<span class="dover" style="color:var(--red)">просрочено</span>':'';
    const nm=escapeHtml(v.name||'');
    const heatCls=(window.VAC_UI&&window.VAC_UI.vacancyHeatClass)?window.VAC_UI.vacancyHeatClass(v):'';
    const checked=VAC_SELECTED.has(String(v.id));
    const trCls=[heatCls,checked?'row-checked':''].filter(Boolean).join(' ');
    return`<tr data-vacid="${escapeHtml(v.id)}"${trCls?` class="${trCls}"`:''}>
      ${showCb?`<td style="padding-left:14px"><input type="checkbox" class="cb-row" data-vacid="${escapeHtml(v.id)}" ${checked?'checked':''} aria-label="Выбрать" style="accent-color:var(--acc);cursor:pointer"></td>`:''}
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${fru(v.date_opened)}</td>
      <td class="td-vac-name">
        <div class="vn-clamp" title="${nm}">${nm}</div>
        <div style="font-size:11px;color:var(--ink3)">${escapeHtml(v.project&&v.project!=='—'?v.project:v.department||'')}</div>
        ${v.transferred?`<div class="btag">↗ от ${escapeHtml(v.transferred_from_name||'')} · ${fru(v.transfer_date)}</div>`:''}
      </td>
      <td>${grpBadge}</td>
      ${showRecCol?`<td class="td-recruiter" data-cell="recruiter" data-vacid="${escapeHtml(v.id)}" style="font-size:12px;color:var(--ink2);white-space:nowrap;${canTransfer()?'cursor:pointer':''}" title="${canTransfer()?'Кликни для передачи вакансии':''}">${escapeHtml(v.current_recruiter_name||'—')}</td>`:''}
      <td class="td-status" data-cell="status" data-vacid="${escapeHtml(v.id)}" style="vertical-align:middle">
        <button type="button" class="badge ${sc}" data-act="status-inline" data-vacid="${escapeHtml(v.id)}" style="border:0;cursor:pointer">${escapeHtml(v.status)}</button>
      </td>
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${fru(v.fact_date||'')||'—'}</td>
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${escapeHtml(v.salary_offer||'—')}</td>
      <td>
        <span class="dv" style="color:${dc}">${days}д</span>
        ${showNormCol?`<span class="dn">/ ${norm}</span>`:''}
        ${overNote}
        ${fastClosed?'<span class="dover" style="color:var(--green)">раньше срока ✓</span>':''}
      </td>
      <td style="white-space:nowrap;display:flex;gap:4px;align-items:center">
        <button type="button" class="btn-icon-pencil" data-act="edit-vac" data-vacid="${escapeHtml(v.id)}" title="${escapeHtml(editTitle)}" aria-label="${escapeHtml(editTitle)}">${IC_PENCIL}</button>
        ${canCreate()?`<button type="button" class="btn-icon-pencil" data-act="dup-vac" data-vacid="${escapeHtml(v.id)}" title="Создать копию" aria-label="Дублировать" style="background:var(--bg);color:var(--ink2);border-color:var(--bg2)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>`:''}
        ${canDelete()?`<button type="button" class="btn-danger" data-act="del-vac" data-vacid="${escapeHtml(v.id)}">✕</button>`:''}
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
  if(window.VAC_DASH&&window.VAC_DASH.refreshBulkBar)window.VAC_DASH.refreshBulkBar();
}

// ══ VACANCY MODAL ════════════════════════════════════
async function openVacModal(vac=null){
  const isEdit=!!vac;
  const v=vac||{};
  const isRecruiter=U.role==='recruiter';
  // Справочники
  const types=REF['Типы']?.length?REF['Типы']:['Новая','Замена'];
  const depts=REF['Подразделения']?.length?REF['Подразделения']:['IT','Финансы','Продажи','Строительство','HR','Маркетинг'];
  const contracts=REF['Формат']?.length?REF['Формат']:['ТД','ГПХ'];
  const reasons=REF['Причины']?.length?REF['Причины']:['Расширение штата','Замена сотрудника','Новый проект','Увольнение','Декретный отпуск'];
  const statuses=['В работе','Приостановлена','Закрыта','Отменена','Передана'];

  // Список рекрутеров для передачи
  if(!ACTIVE_TRANSFER_USERS.length) await refreshActiveTransferUsers();
  const recruiters=ACTIVE_TRANSFER_USERS;

  const opt=(arr,sel)=>arr.map(a=>`<option${a===sel?' selected':''}>${a}</option>`).join('');
  const dis=isEdit&&isRecruiter; // для полей которые рекрутер не может трогать при редактировании
  const grpOpts=VAC_GROUPS.map(g=>`<option${g===(v.vacancy_group||'')?' selected':''}>${g}</option>`).join('');

  const html=`<div class="modal-overlay" id="vac-modal" data-act="vac-overlay">
    <div class="modal">
      <div class="modal-hdr">
        <span class="modal-ttl">${isEdit?(canEdit()?'Редактировать вакансию':'Просмотр вакансии'):'Новая вакансия'}</span>
        <button type="button" class="modal-close" data-act="close-vac-modal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-grid">

          <div class="form-sec">Основное</div>
          <div class="fg full">
            <label class="flbl">Название вакансии <span class="req">*</span></label>
            <input id="f-name" class="finp" placeholder="Например: Frontend разработчик" value="${escapeHtml(v.name||'')}" ${dis&&RECRUITER_LOCKED.includes('name')?'disabled':''}>
          </div>
          <div class="fg">
            <label class="flbl">Тип</label>
            <select id="f-type" class="finp" ${dis&&RECRUITER_LOCKED.includes('type')?'disabled':''}>${opt(types,v.type)}</select>
          </div>
          <div class="fg">
            <label class="flbl">Статус</label>
            <select id="f-status" class="finp">${opt(statuses,v.status||'В работе')}</select>
          </div>
          <div class="fg">
            <label class="flbl">Группа вакансии <span class="req">*</span></label>
            <select id="f-group" class="finp" ${dis&&RECRUITER_LOCKED.includes('vacancy_group')?'disabled':''}>
              <option value="">— выберите —</option>${grpOpts}
            </select>
          </div>
          <div class="fg">
            <label class="flbl">Подразделение <span class="req">*</span></label>
            <select id="f-dept" class="finp">${opt(depts,v.department)}</select>
          </div>
          <div class="fg">
            <label class="flbl">Проект / Объект</label>
            <input id="f-project" class="finp" placeholder="Если есть" value="${escapeHtml(v.project&&v.project!=='—'?v.project:'')}">
          </div>
          <div class="fg">
            <label class="flbl">Формат трудоустройства</label>
            <select id="f-contract" class="finp">${opt(contracts,v.contract)}</select>
          </div>
          <div class="fg">
            <label class="flbl">Причина открытия</label>
            <select id="f-reason" class="finp" ${dis&&RECRUITER_LOCKED.includes('reason')?'disabled':''}>${opt(reasons,v.reason)}</select>
          </div>

          <div class="form-sec">Инициатор и ЗП</div>
          <div class="fg">
            <label class="flbl">Нанимающий менеджер</label>
            <input id="f-init" class="finp" placeholder="ФИО или должность" value="${escapeHtml(v.initiator||'')}">
          </div>
          <div class="fg">
            <label class="flbl">Ссылка на вакансию</label>
            <input id="f-url" class="finp" placeholder="https://..." value="${escapeHtml(v.site_url||'')}">
          </div>
          <div class="fg">
            <label class="flbl">ЗП — оффер</label>
            <input id="f-soffer" class="finp" placeholder="100 000" value="${escapeHtml(v.salary_offer||'')}">
          </div>
          <div class="fg">
            <label class="flbl">ЗП — запрос</label>
            <input id="f-sreq" class="finp" placeholder="110 000" value="${escapeHtml(v.salary_request||'')}">
          </div>

          <div class="form-sec">Сроки</div>
          <div class="fg">
            <label class="flbl">Дата внесения вакансии <span class="req">*</span></label>
            <input id="f-opened" class="finp" type="date" value="${v.date_opened||today()}" ${dis&&!canEdit()?'disabled':''}>
          </div>
          <div class="fg">
            <label class="flbl">Норматив (дней)</label>
            <input id="f-norm" class="finp" type="number" min="1" placeholder="авто по группе" value="${v.norm_days||''}" ${dis?'disabled':''}>
            <span class="field-note">Заполняется автоматически по группе вакансии</span>
          </div>
          ${canEdit()?`
          <div class="fg">
            <label class="flbl">План (дедлайн)</label>
            <input id="f-plan" class="finp" type="date" value="${v.plan_date||''}">
          </div>`:''}
          <div class="fg" id="fact-wrap">
            <label class="flbl" id="lbl-fact">Дата закрытия</label>
            <input id="f-fact" class="finp" type="date" value="${v.fact_date||''}">
          </div>

          <!-- Блок передачи — только выбор рекрутера, дата = f-fact -->
          <div id="transfer-block" style="display:none;grid-column:1/-1">
            <div class="form-sec">Передача вакансии</div>
            <div class="fg">
              <label class="flbl">Передать рекрутеру <span class="req">*</span></label>
              <select id="f-to-rec" class="finp">
                <option value="">— выберите рекрутера —</option>
                ${recruiters.map(r=>`<option value="${r.id}" data-name="${r.name}"${v.current_recruiter_id===r.id?' selected':''}>${r.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-sec">CRM и комментарий</div>
          <div class="fg">
            <label class="flbl">Ссылка / номер CRM</label>
            <input id="f-crm" class="finp" placeholder="TASK-123 или ссылка" value="${escapeHtml(v.crm_link||'')}">
          </div>
          <div class="fg full">
            <label class="flbl">Комментарий рекрутера</label>
            <textarea id="f-comment" class="finp" rows="3" placeholder="Любая информация по работе с вакансией">${escapeHtml(v.comment||'')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div>${canDelete()&&isEdit?`<button type="button" class="btn-danger" data-act="del-vac" data-vacid="${escapeHtml(v.id)}" data-force="1">Удалить вакансию</button>`:''}</div>
        <div style="display:flex;gap:10px">
          <button type="button" class="btn-cancel" data-act="close-vac-modal">Отмена</button>
          <button type="button" class="btn-save" id="btn-save-vac" data-act="vac-save" data-vacid="${isEdit?escapeHtml(v.id):''}">
            ${isEdit?'Сохранить':'Создать вакансию'}
          </button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  const _fs=document.getElementById('f-status');
  const _fg=document.getElementById('f-group');
  if(_fs)_fs.addEventListener('change',e=>onStatusChange(e.target.value));
  if(_fg)_fg.addEventListener('change',e=>onGroupChange(e.target.value));
  onStatusChange(v.status||'В работе');
  // Включаем отслеживание изменений для подтверждения закрытия
  if(window.VAC_UI&&window.VAC_UI.modal){
    try{window.VAC_UI.modal.track(document.getElementById('vac-modal'));}catch(e){}
  }
}

function onGroupChange(grp){
  const norm=GROUP_NORM[grp];
  const inp=document.getElementById('f-norm');
  if(inp&&norm)inp.value=norm;
}

function onStatusChange(status){
  const tb=document.getElementById('transfer-block');
  const fw=document.getElementById('fact-wrap');
  const lbl=document.getElementById('lbl-fact');
  const factInp=document.getElementById('f-fact');
  // Показываем блок передачи только для "Передана"
  if(tb)tb.style.display=status==='Передана'?'block':'none';
  // Поле даты: только для финальных статусов
  if(fw)fw.style.display=FINAL_STATUSES.includes(status)?'block':'none';
  // Для активных статусов — очищаем и блокируем дату закрытия
  if(factInp){
    if(['В работе','Приостановлена'].includes(status)){
      factInp.value='';
      factInp.disabled=true;
    }else{
      factInp.disabled=false;
    }
  }
  if(lbl){
    if(status==='Отменена')lbl.textContent='Дата отмены *';
    else if(status==='Передана')lbl.textContent='Дата передачи *';
    else lbl.textContent='Дата закрытия *';
  }
}

function closeModal(force){
  const m=document.getElementById('vac-modal');
  if(!m)return;
  if(!force&&window.VAC_UI&&window.VAC_UI.modal){
    if(!window.VAC_UI.modal.confirmClose(m))return;
  }
  m.remove();
}

async function openQuickStatusModal(vac){
  if(!vac)return;
  const statuses=['В работе','Приостановлена','Закрыта','Отменена','Передана'];
  if(!ACTIVE_TRANSFER_USERS.length) await refreshActiveTransferUsers();
  const recs=ACTIVE_TRANSFER_USERS;
  const options=statuses.map(s=>`<option${s===vac.status?' selected':''}>${s}</option>`).join('');
  const recOpts=recs.map(r=>`<option value="${r.id}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
  const html=`<div class="modal-overlay" id="qst-modal" data-act="qst-overlay">
    <div class="modal" style="max-width:520px">
      <div class="modal-hdr"><span class="modal-ttl">Быстрая смена статуса</span><button type="button" class="modal-close" data-act="qst-close">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="fg full"><label class="flbl">Вакансия</label><div style="font-size:13px;font-weight:600">${escapeHtml(vac.name||'')}</div></div>
          <div class="fg"><label class="flbl">Статус</label><select id="qst-status" class="finp">${options}</select></div>
          <div class="fg" id="qst-date-wrap"><label class="flbl" id="qst-date-lbl">Дата</label><input id="qst-date" type="date" class="finp" value="${vac.fact_date||today()}"></div>
          <div class="fg" id="qst-rec-wrap" style="display:none"><label class="flbl">Передать пользователю</label><select id="qst-rec" class="finp"><option value="">— выберите —</option>${recOpts}</select></div>
        </div>
      </div>
      <div class="modal-footer"><div></div><div style="display:flex;gap:10px"><button type="button" class="btn-cancel" data-act="qst-close">Отмена</button><button type="button" class="btn-save" data-act="qst-save" data-vacid="${escapeHtml(vac.id)}">Сохранить</button></div></div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  const sync=()=>{
    const st=document.getElementById('qst-status')?.value;
    const dw=document.getElementById('qst-date-wrap');
    const rw=document.getElementById('qst-rec-wrap');
    const lb=document.getElementById('qst-date-lbl');
    const isFinal=['Закрыта','Отменена','Передана'].includes(st);
    if(dw)dw.style.display=isFinal?'':'none';
    if(rw)rw.style.display=st==='Передана'?'':'none';
    if(lb)lb.textContent=st==='Закрыта'?'Дата закрытия':(st==='Отменена'?'Дата отмены':'Дата передачи');
  };
  document.getElementById('qst-status')?.addEventListener('change',sync);
  sync();
  if(window.VAC_UI&&window.VAC_UI.modal){
    try{window.VAC_UI.modal.track(document.getElementById('qst-modal'));}catch(e){}
  }
}

function closeQuickStatusModal(force){
  const m=document.getElementById('qst-modal');
  if(!m)return;
  if(!force&&window.VAC_UI&&window.VAC_UI.modal){
    if(!window.VAC_UI.modal.confirmClose(m))return;
  }
  m.remove();
}

async function saveQuickStatus(vacId){
  const vac=VACS.find(v=>String(v.id)===String(vacId));
  if(!vac)return;
  const st=document.getElementById('qst-status')?.value;
  const dt=document.getElementById('qst-date')?.value||'';
  const recSel=document.getElementById('qst-rec');
  const recId=recSel?.value||'';
  const recName=recId && recSel ? (recSel.options[recSel.selectedIndex].dataset.name||'') : '';
  if(['Закрыта','Отменена','Передана'].includes(st) && !dt){toast('Укажите дату','err');return;}
  if(st==='Передана' && !recId){toast('Укажите кому передана вакансия','err');return;}
  const fields={status:st};
  if(['Закрыта','Отменена','Передана'].includes(st)) fields.fact_date=dt;
  else fields.fact_date='';
  if(st==='Передана'){
    fields.transfer_date=dt;
    fields.transferred=true;
    fields.transferred_from_id=U.id;
    fields.transferred_from_name=U.name;
    fields.current_recruiter_id=recId;
    fields.current_recruiter_name=recName;
  }else{
    fields.transferred = vac.transferred && st!=='Передана' ? vac.transferred : false;
  }
  // Снимаем «снимок» предыдущих значений для возможного отката
  const prev={
    status:vac.status,
    fact_date:vac.fact_date||'',
    transfer_date:vac.transfer_date||'',
    transferred:!!vac.transferred,
    transferred_from_id:vac.transferred_from_id||'',
    transferred_from_name:vac.transferred_from_name||'',
    current_recruiter_id:vac.current_recruiter_id||'',
    current_recruiter_name:vac.current_recruiter_name||''
  };
  const res=await api('updateVacancy',{id:vacId,fields});
  if(res?.ok||res===null){
    Object.assign(vac,fields,{fact_date:fields.fact_date||vac.fact_date,transfer_date:fields.transfer_date||vac.transfer_date,current_recruiter_id:fields.current_recruiter_id||vac.current_recruiter_id,current_recruiter_name:fields.current_recruiter_name||vac.current_recruiter_name});
    if(window.VAC_UI&&window.VAC_UI.modal){try{window.VAC_UI.modal.markClean(document.getElementById('qst-modal'));}catch(e){}}
    closeQuickStatusModal(true);
    refreshDash();
    toast(`Статус: ${prev.status} → ${st}`,'ok',{
      undo:async function(){
        // Откат: применяем prev и отправляем обратно на сервер
        const undoFields={
          status:prev.status,
          fact_date:prev.fact_date,
          transfer_date:prev.transfer_date,
          transferred:prev.transferred,
          transferred_from_id:prev.transferred_from_id,
          transferred_from_name:prev.transferred_from_name,
          current_recruiter_id:prev.current_recruiter_id,
          current_recruiter_name:prev.current_recruiter_name
        };
        Object.assign(vac,undoFields);
        refreshDash();
        const r2=await api('updateVacancy',{id:vacId,fields:undoFields});
        if(r2?.ok||r2===null)toast('Изменение статуса отменено','ok');
        else toast('Откат не удался — обновите страницу','err');
      },
      duration:6000
    });
  }else toast(res?.error||'Не удалось обновить статус','err');
}

async function saveVac(existingId){
  const isEdit=!!existingId;
  const name=document.getElementById('f-name').value.trim();
  const dept=document.getElementById('f-dept').value;
  const grp=document.getElementById('f-group').value;
  const status=document.getElementById('f-status').value;

  if(!name){toast('Укажи название вакансии','err');return}
  if(!grp){toast('Выбери группу вакансии','err');return}

  // Проверяем обязательную дату закрытия для финальных статусов
  if(FINAL_STATUSES.includes(status)){
    const factEl=document.getElementById('f-fact');
    if(!factEl||!factEl.value){
      toast(`При статусе «${status}» обязательно укажи дату закрытия/передачи`,'err');
      return;
    }
  }
  // Проверяем рекрутера для передачи
  if(status==='Передана'){
    const toRec=document.getElementById('f-to-rec')?.value;
    if(!toRec){toast('Выбери рекрутера для передачи','err');return}
  }

  const btn=document.getElementById('btn-save-vac');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';

  const openedDate=document.getElementById('f-opened')?.value||today();
  // Validate: for recruiter, date_opened uses form value (always available)
  const factDate=document.getElementById('f-fact')?.value||'';
  const norm=Number(document.getElementById('f-norm')?.value)||GROUP_NORM[grp]||30;
  const days=factDate?calcDays(openedDate,factDate):calcDays(openedDate);

  // Данные передачи
  const toRecEl=document.getElementById('f-to-rec');
  const toRecId=toRecEl?.value||'';
  const toRecName=toRecId?toRecEl.options[toRecEl.selectedIndex].dataset.name:'';
  // transfer_date = same as fact_date (единое поле для обоих)
  const transferDate=document.getElementById('f-fact')?.value||'';

  const payload={
    name,
    type:         document.getElementById('f-type').value,
    status,
    vacancy_group:grp,
    department:   dept,
    project:      document.getElementById('f-project').value||'—',
    contract:     document.getElementById('f-contract').value,
    reason:       document.getElementById('f-reason').value,
    initiator:    document.getElementById('f-init').value,
    site_url:     document.getElementById('f-url').value,
    salary_offer: document.getElementById('f-soffer').value,
    salary_request:document.getElementById('f-sreq').value,
    norm_days:    norm,
    crm_link:     document.getElementById('f-crm').value,
    comment:      document.getElementById('f-comment').value,
    date_opened:  openedDate,
    plan_date:    document.getElementById('f-plan')?.value||'',
    fact_date:    factDate,
    days_total:   days,
    days_current: days,
    recruiter_id:   isEdit?(VACS.find(v=>v.id===existingId)?.recruiter_id||U.id):U.id,
    recruiter_name: isEdit?(VACS.find(v=>v.id===existingId)?.recruiter_name||U.name):U.name,
  };

  // Если передача
  if(status==='Передана'&&toRecId){
    payload.current_recruiter_id=toRecId;
    payload.current_recruiter_name=toRecName;
    payload.transferred=true;
    payload.transferred_from_id=U.id;
    payload.transferred_from_name=U.name;
    payload.transfer_date=transferDate;
    payload.days_current=calcDays(transferDate);
  }else if(!isEdit){
    payload.current_recruiter_id=U.id;
    payload.current_recruiter_name=U.name;
    payload.transferred=false;
    payload.transferred_from_name='';
    payload.transfer_date='';
  }

  let res;
  if(isEdit){
    res=await api('updateVacancy',{id:existingId,fields:payload});
  }else{
    res=await api('addVacancy',{vacancy:payload});
  }

  // Обновляем локальный список немедленно (FIX #1 — не нужно обновлять страницу)
  if(!res){
    if(isEdit){
      const idx=VACS.findIndex(v=>v.id===existingId);
      if(idx>-1)VACS[idx]={...VACS[idx],...payload};
    }else{
      const newV={
        id:'local-'+Date.now(),
        num:`${U.name.charAt(0).toUpperCase()}-${String(VACS.length+1).padStart(3,'0')}`,
        ...payload,
      };
      VACS.unshift(newV);
    }
  }else if(res.ok){
    if(!isEdit&&res.id){
      const newV={id:res.id,num:res.num||'—',...payload};
      VACS.unshift(newV);
    }else if(isEdit){
      const idx=VACS.findIndex(v=>v.id===existingId);
      if(idx>-1)VACS[idx]={...VACS[idx],...payload};
    }
  }

  // Помечаем модалку «чистой», чтобы при закрытии не спросили про несохранённые изменения
  if(window.VAC_UI&&window.VAC_UI.modal){
    try{window.VAC_UI.modal.markClean(document.getElementById('vac-modal'));}catch(e){}
  }
  closeModal(true);
  toast(isEdit?'Вакансия обновлена ✓':'Вакансия создана ✓');
  refreshDash(); // сразу обновляем таблицу без перезагрузки страницы
}

async function deleteVac(id,fromModal=false){
  if(!canDelete())return;
  // Найдём вакансию и запомним для возможной отмены
  const idx=VACS.findIndex(v=>String(v.id)===String(id));
  if(idx===-1)return;
  const vac=VACS[idx];
  // Оптимистичное удаление из UI; реальный DELETE через 6 сек,
  // если за это время пользователь не нажал «Отменить»
  VACS.splice(idx,1);
  if(fromModal)closeModal();
  refreshDash();
  let cancelled=false;
  const finalize=async ()=>{
    if(cancelled)return;
    const res=await api('deleteVacancy',{id});
    if(!res||(res.ok===false&&!res.silent)){
      // Откатываем локально, если бэк не подтвердил
      VACS.splice(Math.min(idx,VACS.length),0,vac);
      refreshDash();
      toast('Не удалось удалить — восстановлено','err');
    }
  };
  const timer=setTimeout(finalize,6000);
  toast(`Вакансия «${vac.name||''}» удалена`,'ok',{
    undo:function(){
      cancelled=true;
      clearTimeout(timer);
      VACS.splice(Math.min(idx,VACS.length),0,vac);
      refreshDash();
      toast('Удаление отменено','ok');
    },
    duration:6000
  });
}

// ══ ANALYTICS ════════════════════════════════════════
async function renderAnalytics(){
  const el=document.getElementById('content');
  const vr=await api('getVacancies',{role:U.role,recruiter_id:U.id});
  const allV=vr?.ok?(vr.vacancies||[]):[];

  let APeriod={...PERIOD};
  let AStat=[], AGrp=[], ADept=[], ARec=[];
  let ANameFilter='';

  const recNames=[...new Set(allV.map(v=>v.current_recruiter_name).filter(Boolean))];
  const deptNames=[...new Set(allV.map(v=>v.department).filter(Boolean))];
  const groups=[...VAC_GROUPS];
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  const presets=[
    {l:'Этот месяц',  f:fd(new Date(y,m,1)),   t:fd(new Date(y,m+1,0))},
    {l:'Прошлый мес.',f:fd(new Date(y,m-1,1)), t:fd(new Date(y,m,0))},
    {l:'Квартал',     f:fd(new Date(y,Math.floor(m/3)*3,1)),t:fd(new Date(y,Math.floor(m/3)*3+3,0))},
    {l:'Год',         f:fd(new Date(y,0,1)),   t:fd(new Date(y,11,31))},
    {l:'Всё время',   f:'2020-01-01',           t:fd(new Date(y+1,0,1))},
  ];

  const render=()=>{
    const pFrom=APeriod.from, pTo=APeriod.to;

    // Фильтрация по рекрутеру и доп.фильтрам (пустой мультивыбор = все)
    let base=allV;
    if(ARec.length)base=base.filter(v=>ARec.includes(v.current_recruiter_name));
    if(AGrp.length)base=base.filter(v=>v.vacancy_group&&AGrp.includes(v.vacancy_group));
    if(ADept.length)base=base.filter(v=>v.department&&ADept.includes(v.department));
    if(AStat.length)base=base.filter(v=>AStat.includes(v.status));
    if(ANameFilter){const q=ANameFilter.toLowerCase();base=base.filter(v=>v.name.toLowerCase().includes(q));}

    // === МЕТРИКИ ПЕРИОДА ===

    // 1. Открыто за период: вакансии, созданные ВНУТРИ выбранного периода
    const openedInPeriod=base.filter(v=>v.date_opened&&v.date_opened>=pFrom&&v.date_opened<=pTo);

    // 2. В работе на начало периода: 
    //    созданы ДО начала периода + НЕ закрыты до начала периода
    //    = все «хвосты» из прошлых периодов, висящие на рекрутере на 1-е число
    const activeAtStart=base.filter(v=>{
      if(!v.date_opened||v.date_opened>=pFrom)return false;
      if(v.fact_date&&v.fact_date<pFrom)return false;
      return true;
    });

    // 3. Открыто на конец периода (нагрузка на выходе):
    //    открыта ДО конца периода И НЕ закрыта до конца периода
    //    = сколько незакрытых вакансий осталось на последний день периода
    const openAtEndOfPeriod=base.filter(v=>{
      if(!v.date_opened||v.date_opened>pTo)return false;
      if(v.fact_date&&v.fact_date<=pTo)return false;
      return true;
    });

    // 4. В работе за период: пересекает период по жизненному циклу вакансии
    const inWorkPeriod=base.filter(v=>intersectsPeriod(v,pFrom,pTo));

    // 4b. Текущий статус «В работе» + «Приостановлена» (актуальный срез)
    const inWorkNow=base.filter(v=>['В работе','Приостановлена'].includes(v.status));

    // 5. Закрыто за период: статус «Закрыта» или «Отменена», fact_date ВНУТРИ периода
    const closedInPeriod=base.filter(v=>PLAN_CLOSED_STATUSES.includes(v.status)&&v.fact_date&&v.fact_date>=pFrom&&v.fact_date<=pTo);
    const cwn=closedInPeriod.filter(v=>v.norm_days&&v.days_total!=null);
    const fast=cwn.filter(v=>Number(v.days_total)<Number(v.norm_days));
    const pct=cwn.length?Math.round(fast.length/cwn.length*100):0;
    const avgCl=closedInPeriod.length?Math.round(closedInPeriod.reduce((s,v)=>s+(v.days_total||0),0)/closedInPeriod.length):0;

    // === ПО РЕКРУТЕРАМ ===
    const byRec={};
    allV.forEach(v=>{
      if(AGrp.length&&!(v.vacancy_group&&AGrp.includes(v.vacancy_group)))return;
      if(ADept.length&&!(v.department&&ADept.includes(v.department)))return;
      if(AStat.length&&!AStat.includes(v.status))return;
      if(ARec.length&&!ARec.includes(v.current_recruiter_name))return;
      if(ANameFilter&&!v.name.toLowerCase().includes(ANameFilter.toLowerCase()))return;
      const k=v.current_recruiter_id||v.recruiter_id;
      const nm=v.current_recruiter_name||v.recruiter_name;
      if(!k||!nm)return;
      if(!byRec[k])byRec[k]={id:k,name:nm,opened:0,closed:0,in_work_period:0,in_work_now:0,atStart:0,fast:0,nt:0,days:[]};
      // Открыто за период
      if(v.date_opened&&v.date_opened>=pFrom&&v.date_opened<=pTo)byRec[k].opened++;
      // Закрыто за период (Закрыта + Отменена)
      if(PLAN_CLOSED_STATUSES.includes(v.status)&&v.fact_date&&v.fact_date>=pFrom&&v.fact_date<=pTo)byRec[k].closed++;
      // В работе за период
      if(intersectsPeriod(v,pFrom,pTo))byRec[k].in_work_period++;
      // В работе сейчас (текущий статус)
      if(['В работе','Приостановлена'].includes(v.status))byRec[k].in_work_now++;
      // В работе на начало периода
      if(v.date_opened&&v.date_opened<pFrom&&(!v.fact_date||v.fact_date>=pFrom))byRec[k].atStart++;
      // % раньше норматива
      if(v.days_current&&v.norm_days&&PLAN_CLOSED_STATUSES.includes(v.status)&&v.fact_date&&v.fact_date>=pFrom&&v.fact_date<=pTo){
        byRec[k].nt++;
        if(Number(v.days_current)<Number(v.norm_days))byRec[k].fast++;
      }
      if(v.days_current)byRec[k].days.push(Number(v.days_current));
    });
    Object.values(byRec).forEach(r=>{
      r.pct=r.nt?Math.round(r.fast/r.nt*100):0;
      r.avg=r.days.length?Math.round(r.days.reduce((a,b)=>a+b,0)/r.days.length):0;
      // % выполнения плана
      r.plan=sumPlanForPeriod([r.id],pFrom,pTo);
      r.planPct=r.plan>0?Math.min(Math.round(r.closed/r.plan*100),200):null;
    });

    document.getElementById('a-body').innerHTML=`
      ${(()=>{
        // % выполнения плана общий
        const recIds = Object.values(byRec).map(r=>r.id);
        const totalPlan=sumPlanForPeriod(recIds,pFrom,pTo);
        const totalPlanPct=totalPlan>0?Math.min(Math.round(closedInPeriod.length/totalPlan*100),200):null;
        return`<div class="stats-row">
          ${sv('На начало периода',activeAtStart.length,'из прошлых периодов','var(--blue)')}
          ${sv('Открыто за период',openedInPeriod.length,'новых вакансий','var(--acc)')}
          ${sv('В работе за период',inWorkPeriod.length,'пересечение с периодом','var(--blue)')}
          ${sv('В работе сейчас',inWorkNow.length,'актуальный срез','var(--blue)')}
          ${sv('Открыто на конец',openAtEndOfPeriod.length,'нагрузка на выходе','var(--amber)')}
          ${sv('Закрыто',closedInPeriod.length,'Закрыта + Отменена','var(--green)')}
          ${sv('Раньше норматива',pct+'%','Факт < Норматив',pct>=50?'var(--green)':'var(--amber)')}
          ${sv('Сред. время',avgCl+'д','закрытых вакансий','var(--gray)')}
          ${totalPlanPct!==null?sv('% выполнения плана',totalPlanPct+'%',`${closedInPeriod.length} из ${totalPlan}`,totalPlanPct>=100?'var(--green)':totalPlanPct>=70?'var(--amber)':'var(--red)'):''}
        </div>`;
      })()}

      <div class="card" style="margin-bottom:16px">
        <div class="ch">
          <span class="ct">По рекрутерам</span>
          ${canSetPlan()?`<span style="font-size:11px;color:var(--ink3)">Кликни на план чтобы изменить</span>`:''}
        </div>
        ${Object.entries(byRec).length===0
          ?`<div class="empty" style="padding:32px"><p style="color:var(--ink3)">Нет данных за выбранный период</p></div>`
          :Object.entries(byRec).map(([id,r])=>`
          <div class="rec-row">
            <div class="rec-av av-shimmer" style="background:${(window.VAC_UI&&window.VAC_UI.color)?window.VAC_UI.color(r.name):'var(--acc)'}">${(window.VAC_UI&&window.VAC_UI.initials)?window.VAC_UI.initials(r.name,2):r.name.charAt(0)}</div>
            <div style="min-width:140px">
              <div style="font-weight:600;font-size:13px">${r.name}</div>
              <div style="font-size:11px;color:var(--ink3)">${r.opened} откр. · ${r.in_work_period} в работе за период · ${r.atStart} на начало</div>
            </div>
            <div style="display:flex;gap:14px;margin-left:auto;flex-wrap:wrap;align-items:center">
              <div class="rs" style="text-align:right"><div class="rsv">${r.atStart}</div><div class="rsl">На начало</div></div>
              <div class="rs" style="text-align:right"><div class="rsv">${r.opened}</div><div class="rsl">Открыто</div></div>
              <div class="rs" style="text-align:right"><div class="rsv" style="color:var(--blue)">${r.in_work_period}</div><div class="rsl">В работе за период</div></div>
              <div class="rs" style="text-align:right"><div class="rsv" style="color:var(--blue)">${r.in_work_now}</div><div class="rsl">В работе сейчас</div></div>
              <div class="rs" style="text-align:right"><div class="rsv" style="color:var(--green)">${r.closed}</div><div class="rsl">Закрыто</div></div>
              <div class="rs" style="text-align:right"><div class="rsv">${r.avg}д</div><div class="rsl">Сред. дней</div></div>
              <div class="rs" style="text-align:right">
                <div class="rsv" style="color:${r.pct>=50?'var(--green)':'var(--red)'}">${r.pct}%</div>
                <div class="rsl">Раньше норм.</div>
                <div class="pbar"><div class="pfill" style="width:${r.pct}%"></div></div>
              </div>
              <div class="rs" style="text-align:right;min-width:70px">
                ${canSetPlan()
                  ?`<input type="number" class="plan-input" min="0" max="99"
                      value="${r.plan||''}" placeholder="—"
                      onchange="setPlan('${id}','${pFrom.slice(0,7)}',this.value)"
                      title="План закрытия (редактируется по месяцу начала периода)">`
                  :`<div class="rsv">${r.plan||'—'}</div>`
                }
                <div class="rsl">План</div>
              </div>
              <div class="rs" style="text-align:right;min-width:64px">
                ${r.planPct!==null
                  ?`<div class="rsv" style="color:${r.planPct>=100?'var(--green)':r.planPct>=70?'var(--amber)':'var(--red)'}">${r.planPct}%</div>
                    <div class="rsl">Выполнение</div>
                    <div class="pbar"><div class="pfill" style="width:${Math.min(r.planPct,100)}%;background:${r.planPct>=100?'var(--green)':r.planPct>=70?'var(--amber)':'var(--red)'}"></div></div>`
                  :`<div class="rsv" style="color:var(--ink3)">—</div><div class="rsl">Выполнение</div>`
                }
              </div>
            </div>
          </div>`).join('')
        }
      </div>

      ${(()=>{
        // ═══ HEATMAP: нагрузка рекрутеров по месяцам ══════════════════
        // Ось X — последние 12 месяцев (или меньше если данных нет).
        // Ось Y — рекрутеры из byRec.
        // Значение ячейки — количество вакансий, пересекающихся с этим месяцем.
        const recList=Object.values(byRec).sort((a,b)=>b.in_work_period-a.in_work_period);
        if(!recList.length)return'';
        // Строим последние 12 месяцев
        const today=new Date();
        const months=[];
        for(let i=11;i>=0;i--){
          const d=new Date(today.getFullYear(),today.getMonth()-i,1);
          months.push({
            key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
            label:`${d.toLocaleString('ru',{month:'short'})} ${d.getFullYear()}`
          });
        }
        // Для каждого рекрутера × месяц считаем пересечение
        const grid={};
        recList.forEach(rc=>{grid[rc.id]={};});
        allV.forEach(v=>{
          const k=v.current_recruiter_id||v.recruiter_id;
          if(!grid[k])return;
          const opened=v.date_opened||'';
          const closed=v.fact_date||'9999-12-31';
          months.forEach(m=>{
            const mStart=m.key+'-01';
            const mEnd=m.key+'-31';
            if(opened<=mEnd && closed>=mStart){
              grid[k][m.key]=(grid[k][m.key]||0)+1;
            }
          });
        });
        // Максимум для нормализации цвета
        let maxVal=1;
        recList.forEach(rc=>{ months.forEach(m=>{ const v=grid[rc.id][m.key]||0; if(v>maxVal)maxVal=v; }); });
        function heatColor(v){
          if(!v)return'#f7f7f8';
          const t=Math.min(v/maxVal,1);
          // Белый(255,255,255) → фиолетовый(91,56,153)
          const r=Math.round(255-(255-91)*t);
          const g=Math.round(255-(255-56)*t);
          const b=Math.round(255-(255-153)*t);
          return`rgb(${r},${g},${b})`;
        }
        function textColor(v){
          if(!v)return'var(--ink3)';
          return Math.min(v/maxVal,1)>0.5?'#fff':'#2d3748';
        }
        const thStyle='padding:5px 6px;font-size:10px;color:var(--ink3);font-weight:600;text-align:center;white-space:nowrap;border-bottom:1px solid var(--bg2)';
        const tdNameStyle='padding:5px 8px;font-size:11px;font-weight:600;color:var(--ink2);white-space:nowrap;border-right:1px solid var(--bg2)';
        const headerCells=months.map(m=>`<th style="${thStyle}">${m.label}</th>`).join('');
        const rows=recList.map(rc=>{
          const cells=months.map(m=>{
            const v=grid[rc.id][m.key]||0;
            return`<td title="${rc.name} · ${m.label}: ${v} вак." style="padding:4px 3px;text-align:center;font-size:10px;font-weight:${v?'700':'400'};background:${heatColor(v)};color:${textColor(v)};min-width:36px;border:1px solid rgba(0,0,0,0.05)">${v||''}</td>`;
          }).join('');
          const av=window.VAC_UI;
          const avHtml=av?`<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;font-size:9px;font-weight:700;color:#fff;background:${av.color?av.color(rc.name):'var(--acc)'};flex-shrink:0">${av.initials?av.initials(rc.name,1):rc.name.charAt(0)}</span> `:'';
          return`<tr><td style="${tdNameStyle}">${avHtml}${rc.name}</td>${cells}</tr>`;
        }).join('');
        return`<div class="card" style="margin-bottom:16px;overflow-x:auto">
          <div class="ch"><span class="ct">Тепловая карта нагрузки рекрутеров</span><span style="font-size:11px;color:var(--ink3);margin-left:8px">вакансии в работе по месяцам</span></div>
          <div style="overflow-x:auto">
            <table style="border-collapse:collapse;min-width:100%">
              <thead><tr><th style="${thStyle};text-align:left;border-right:1px solid var(--bg2)">Рекрутер</th>${headerCells}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="padding:8px 0 0;font-size:10px;color:var(--ink3);display:flex;align-items:center;gap:6px">
            <span>Интенсивность:</span>
            ${[0,0.2,0.5,0.8,1].map(t=>{
              const v=Math.round(t*maxVal);
              const r=Math.round(255-(255-91)*t);
              const g=Math.round(255-(255-56)*t);
              const b=Math.round(255-(255-153)*t);
              return`<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:18px;border-radius:3px;background:rgb(${r},${g},${b});color:${t>0.5?'#fff':'#2d3748'};font-size:9px;font-weight:700">${v||'0'}</span>`;
            }).join('')}
            <span style="margin-left:4px">(вак.)</span>
          </div>
        </div>`;
      })()}

      <div class="card" style="background:var(--accbg);border-color:#d4c2eb">
        <div class="ch" style="border-color:#d4c2eb"><span class="ct" style="color:var(--acc)">Логика расчётов</span></div>
        <div style="padding:12px 20px 16px;font-size:13px;color:var(--ink2);line-height:1.9">
          <b>Раньше норматива:</b> Факт &lt; Норматив. Для переданных вакансий считаются дни текущего рекрутера.<br>
          <b>В работе на начало периода:</b> все вакансии, созданные ДО начала периода и незакрытые на первый день — «хвосты» из прошлых периодов. Показывает исходную нагрузку рекрутера.<br>
          <b>В работе за период:</b> вакансия попадает в метрику, если её жизненный цикл (от даты открытия до даты закрытия/передачи/отмены) пересекается с выбранным периодом.<br>
          <b>Открыто на конец периода:</b> вакансии, открытые до конца периода и НЕ закрытые до его конца — остаток нагрузки на последний день.<br>
          <b>Период закрытия:</b> минимум 1 день (открытая и закрытая в один день = 1 день).<br>
          <b>% выполнения плана:</b> Закрыто ÷ План × 100% по выбранному периоду. Статус «Передана» — не считается закрытой. «Отменена» — считается.
        </div>
      </div>`;
  };

  el.innerHTML=`
    <div class="toolbar" style="margin-bottom:12px">
      <span class="tbar-lbl">Период</span>
      ${presets.map(p=>`<button class="pbtn${p.f===APeriod.from&&p.t===APeriod.to?' on':''}" id="ap-${p.f}" data-f="${p.f}" data-t="${p.t}">${p.l}</button>`).join('')}
      <span class="tsep">|</span>
      <input type="date" class="dinput" id="apdf" value="${APeriod.from}">
      <span class="tsep">—</span>
      <input type="date" class="dinput" id="apdt" value="${APeriod.to}">
      <button class="papply" id="a-ok">OK</button>
    </div>
    <div class="toolbar" style="margin-bottom:16px">
      <span class="tbar-lbl">Фильтры</span>
      ${filterDdHtml('fdd-a-st','Статусы',FILTER_STATUS_OPTS,AStat)}
      ${filterDdHtml('fdd-a-rec','Рекрутеры',recNames,ARec)}
      ${filterDdHtml('fdd-a-grp','Группы',groups,AGrp)}
      ${filterDdHtml('fdd-a-dept','Подразделения',deptNames,ADept)}
      <div class="fsearch" style="flex:1 1 120px;min-width:100px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="a-name" placeholder="Название...">
      </div>
    </div>
    <div id="a-body"></div>`;

  // Bind analytics period
  document.querySelectorAll('.pbtn[data-f]').forEach(b=>{
    if(!b.id.startsWith('ap-'))return;
    b.onclick=()=>{
      APeriod={from:b.dataset.f,to:b.dataset.t};
      document.getElementById('apdf').value=APeriod.from;
      document.getElementById('apdt').value=APeriod.to;
      document.querySelectorAll('.pbtn[data-f]').forEach(x=>{if(x.id.startsWith('ap-'))x.classList.toggle('on',x===b)});
      render();
    };
  });
  document.getElementById('a-ok').onclick=()=>{
    const f=document.getElementById('apdf').value;
    const t=document.getElementById('apdt').value;
    if(f&&t&&f<=t){APeriod={from:f,to:t};document.querySelectorAll('.pbtn[data-f]').forEach(b=>{if(b.id.startsWith('ap-'))b.classList.remove('on')});render();}
    else toast('Укажи корректный диапазон дат','err');
  };
  bindFilterDd('fdd-a-st',()=>AStat,v=>{AStat=v;},render);
  bindFilterDd('fdd-a-rec',()=>ARec,v=>{ARec=v;},render);
  bindFilterDd('fdd-a-grp',()=>AGrp,v=>{AGrp=v;},render);
  bindFilterDd('fdd-a-dept',()=>ADept,v=>{ADept=v;},render);
  document.getElementById('a-name').oninput=e=>{ANameFilter=e.target.value;render()};
  render();
}

async function loadPlansFromApi(){
  try{
    const res=await api('getPlans');
    if(res?.ok && Array.isArray(res.plans)){
      res.plans.forEach(p=>{
        if(p.recruiter_id && p.month) PLANS[`${p.recruiter_id}::${p.month}`]=Number(p.plan)||0;
      });
      try{ savePlans(PLANS); }catch(e){}
      // Перерисовываем аналитику, если она открыта
      if(PAGE==='analytics') renderAnalytics();
    }
  }catch(e){}
}

async function setPlan(recId,month,val){
  const key=`${recId}::${month}`;
  PLANS[key]=Number(val)||0;
  try{ savePlans(PLANS); }catch(e){}
  // Сохраняем в Google Sheets — все пользователи видят единый план
  try{
    await api('setPlan',{recruiter_id:recId,month,plan:PLANS[key],updated_by:U?.name||''});
  }catch(e){
    console.warn('setPlan API error',e);
  }
}

// ══ CHECKLIST ════════════════════════════════════════
let CL_STATE={vacancyId:'',vacancyName:'',candidateName:'',interviewDate:'',answers:{},notes:'',step:1};

async function deleteAssessment(id){
  if(!canDelete()||!id)return;
  if(!confirm('Удалить эту оценку? Действие необратимо.'))return;
  const res=await api('deleteAssessment',{id, caller_role:U.role});
  if(res?.ok||res===null){
    ASSESSMENTS=ASSESSMENTS.filter(a=>String(a.id)!==String(id));
    toast('Оценка удалена');
    await renderChecklist();
  }else toast(res?.error||'Ошибка','err');
}

async function renderChecklist(){
  const el=document.getElementById('content');
  if(!U||!U.role){if(el)el.innerHTML='<div class="empty" style="padding:40px"><p>Сессия недоступна</p></div>';return;}
  const[ar,vr]=await Promise.all([
    api('getAssessments',{role:U.role,recruiter_id:U.id}),
    api('getVacancies',{role:U.role,recruiter_id:U.id}),
  ]);
  ASSESSMENTS=ar?.ok?ar.assessments:[];
  if(vr?.ok)VACS=vr.vacancies;
  if(!VACS)VACS=[];
  renderAssessmentList(el);
}

function renderAssessmentList(el){
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h2 style="font-size:18px;font-weight:700">Оценки кандидатов</h2>
        <p style="font-size:13px;color:var(--ink3);margin-top:2px">Поведенческое профилирование по 9 блокам</p>
      </div>
      <button type="button" class="btn-primary" data-act="cl-new">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Новая оценка
      </button>
    </div>
    ${ASSESSMENTS.length===0
      ?`<div class="card"><div class="empty" style="padding:60px">
          <div class="empty-ico" style="background:var(--accbg)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC.cl}</svg></div>
          <h3>Ещё нет оценок</h3><p>Нажми «Новая оценка» чтобы провести интервью по чек-листу</p>
          <button type="button" class="btn-primary" style="margin-top:16px" data-act="cl-new">Начать оценку</button>
        </div></div>`
      :`<div class="card"><div class="tbl-wrap"><table>
          <thead><tr><th>Кандидат</th><th>Вакансия</th><th>Рекрутер</th><th>Дата</th><th>Балл</th><th>Действия</th></tr></thead>
          <tbody>${ASSESSMENTS.map(a=>{
            return`<tr>
              <td><div style="font-weight:600;font-size:13px">${escapeHtml(a.candidate_name||'')}</div></td>
              <td><div style="font-size:12px;color:var(--ink2)">${escapeHtml(a.vacancy_name||'—')}</div></td>
              <td><div style="font-size:12px;color:var(--ink2)">${escapeHtml(a.recruiter_name||'')}</div></td>
              <td><div style="font-size:12px;color:var(--ink3)">${escapeHtml(a.interview_date||'')}</div></td>
              <td><div style="font-size:12px;color:var(--ink3)">${Object.keys(a.scores||{}).length}/${CL_BLOCKS.length} блоков</div></td>
              <td style="white-space:nowrap"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <button type="button" class="btn-sm" data-act="cl-view" data-aid="${escapeHtml(a.id)}">Открыть</button>
                ${canDelete()?`<button type="button" class="btn-danger" data-act="cl-del" data-aid="${escapeHtml(a.id)}" title="Удалить">✕</button>`:''}
              </div></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div></div>`
    }`;
}

function startNewAssessment(){
  CL_STATE={vacancyId:'',vacancyName:'',candidateName:'',interviewDate:today(),answers:{},notes:'',step:1};
  renderCLStep1();
}

function renderCLStep1(){
  const el=document.getElementById('content');
  // Вакансии со статусом "В работе" ИЛИ "Приостановлена"
  const availVacs=VACS.filter(v=>ASSESS_STATUSES.includes(v.status));
  el.innerHTML=`
    <div style="max-width:560px">
      ${clBC(1)}
      <div class="card" style="padding:24px 28px;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:700;margin-bottom:18px">Информация о кандидате</h3>
        <div class="form-grid">
          <div class="fg full">
            <label class="flbl">Имя кандидата <span class="req">*</span></label>
            <input id="cl-name" class="finp" placeholder="Иванов Иван Иванович" value="${CL_STATE.candidateName}">
          </div>
          <div class="fg full">
            <label class="flbl">Вакансия <span class="req">*</span></label>
            <select id="cl-vac" class="finp">
              <option value="">— выберите вакансию —</option>
              ${availVacs.map(v=>`<option value="${v.id}" data-name="${v.name}"${v.id===CL_STATE.vacancyId?' selected':''}>${v.num} — ${v.name} (${v.status})</option>`).join('')}
              <option value="__active_employee__" data-name="Действующий сотрудник"${CL_STATE.vacancyId==='__active_employee__'?' selected':''}>Действующий сотрудник</option>
            </select>
            <span class="field-note">Доступны вакансии со статусом «В работе» и «Приостановлена», а также «Действующий сотрудник»</span>
          </div>
          <div class="fg">
            <label class="flbl">Дата интервью</label>
            <input id="cl-date" class="finp" type="date" value="${CL_STATE.interviewDate}">
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button type="button" class="btn-cancel" data-act="cl-list">Отмена</button>
        <button type="button" class="btn-save" data-act="cl-s1-next">Далее → Чек-лист</button>
      </div>
    </div>`;
}

function clStep1Next(){
  const name=document.getElementById('cl-name').value.trim();
  const vacEl=document.getElementById('cl-vac');
  const vacId=vacEl.value;
  const vacName=vacId?vacEl.options[vacEl.selectedIndex].dataset.name:'';
  if(!name){toast('Введи имя кандидата','err');return}
  if(!vacId){toast('Выбери вакансию','err');return}
  CL_STATE.candidateName=name;CL_STATE.vacancyId=vacId;CL_STATE.vacancyName=vacName;
  CL_STATE.interviewDate=document.getElementById('cl-date').value;
  CL_STATE.step=2;renderCLStep2();
}

function renderCLStep2(){
  const el=document.getElementById('content');
  const cmap={green:'var(--green)',amber:'var(--amber)',red:'var(--red)',blue:'var(--blue)'};
  const bgmap={green:'var(--gbg)',amber:'var(--abg)',red:'var(--rbg)',blue:'var(--bbg)'};
  el.innerHTML=`
    ${clBC(2)}
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
      <span style="font-weight:700;font-size:15px">${CL_STATE.candidateName}</span>
      <span style="color:var(--ink3);font-size:13px">→ ${CL_STATE.vacancyName}</span>
      <span id="cl-plbl" style="margin-left:auto;font-size:12px;color:var(--ink3)">0/${CL_BLOCKS.length}</span>
    </div>
    <div style="height:4px;background:var(--bg2);border-radius:2px;margin-bottom:18px;overflow:hidden">
      <div id="cl-pbar" style="height:100%;background:var(--acc);border-radius:2px;transition:width .3s;width:0%"></div>
    </div>
    ${CL_BLOCKS.map(b=>`
    <div class="card" style="margin-bottom:10px" id="cl-block-${b.id}">
      <div style="padding:14px 18px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-size:10px;font-weight:700;color:var(--acc);background:var(--accbg);padding:2px 8px;border-radius:12px">Блок ${b.num}</span>
          <span id="cl-chk-${b.id}" style="display:none"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        </div>
        <h3 style="font-size:13px;font-weight:700;margin-bottom:2px">${b.title}</h3>
        <p style="font-size:11px;color:var(--ink3);margin-bottom:8px">${b.subtitle}</p>
        <div style="background:var(--bg);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px">
          <span style="font-weight:600;color:var(--ink2)">Вопрос: </span><span style="font-style:italic">${b.question}</span>
        </div>
        <div style="font-size:11px;color:var(--ink3);margin-bottom:10px">ℹ ${b.tip}</div>
      </div>
      <div style="padding:0 18px 14px">
        ${b.options.map(opt=>`
        <label class="cl-opt-label${CL_STATE.answers[b.id]===opt.id?' selected':''}" id="cl-opt-${b.id}-${opt.id}">
          <input type="radio" name="cl-${b.id}" value="${opt.id}" style="margin-top:2px;accent-color:var(--acc);flex-shrink:0"
            onchange="clSel('${b.id}','${opt.id}')"${CL_STATE.answers[b.id]===opt.id?' checked':''}>
          <div>
            <div style="font-weight:600;font-size:13px;color:${cmap[opt.color]}">${opt.label}</div>
            <div style="font-size:12px;color:var(--ink2);margin-top:1px">${opt.desc}</div>
          </div>
        </label>`).join('')}
      </div>
    </div>`).join('')}
    <div class="card" style="padding:18px;margin-bottom:16px">
      <h3 style="font-size:13px;font-weight:700;margin-bottom:8px">📝 Ключевые риски / Заметки</h3>
      <textarea id="cl-notes" class="finp" rows="3" placeholder="Любые наблюдения и риски из интервью">${CL_STATE.notes}</textarea>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:40px">
      <button type="button" class="btn-cancel" data-act="cl-back-s1">← Назад</button>
      <div style="display:flex;align-items:center;gap:12px">
        <span id="cl-asub" style="font-size:12px;color:var(--ink3)"></span>
        <button type="button" class="btn-save" id="cl-sub-btn" data-act="cl-submit">Завершить →</button>
      </div>
    </div>`;
  Object.entries(CL_STATE.answers).forEach(([bid,oid])=>hlOpt(bid,oid,true));
  updCLProg();
}

function clSel(bid,oid){
  const b=CL_BLOCKS.find(x=>x.id===bid);
  if(b)b.options.forEach(o=>hlOpt(bid,o.id,false));
  hlOpt(bid,oid,true);
  CL_STATE.answers[bid]=oid;
  const chk=document.getElementById(`cl-chk-${bid}`);
  if(chk)chk.style.display='inline';
  updCLProg();
}
function hlOpt(bid,oid,on){
  const el=document.getElementById(`cl-opt-${bid}-${oid}`);
  if(el){if(on)el.classList.add('selected');else el.classList.remove('selected');}
}
function updCLProg(){
  const answered=Object.keys(CL_STATE.answers).length;
  const pbar=document.getElementById('cl-pbar');
  const plbl=document.getElementById('cl-plbl');
  const asub=document.getElementById('cl-asub');
  if(pbar)pbar.style.width=`${Math.round(answered/CL_BLOCKS.length*100)}%`;
  if(plbl)plbl.textContent=`${answered}/${CL_BLOCKS.length}`;
  if(asub)asub.textContent=answered<CL_BLOCKS.length?`Заполнено ${answered} из ${CL_BLOCKS.length}`:'Все блоки ✓';
}

function calcCL(){
  // Scores kept in storage but not shown to user (per business decision)
  let score=0;
  CL_BLOCKS.forEach(b=>{
    const oid=CL_STATE.answers[b.id];if(!oid)return;
    const opt=b.options.find(o=>o.id===oid);if(opt)score+=opt.score;
  });
  return{score,pct:0,rec:'',cls:'sc2'};
}

async function clSubmit(){
  CL_STATE.notes=document.getElementById('cl-notes')?.value||'';
  const answered=Object.keys(CL_STATE.answers).length;
  if(answered<CL_BLOCKS.length&&!confirm(`Не заполнено ${CL_BLOCKS.length-answered} блоков. Продолжить?`))return;
  const btn=document.getElementById('cl-sub-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
  const{score,pct,rec}=calcCL();
  const scoresJson={};
  CL_BLOCKS.forEach(b=>{if(CL_STATE.answers[b.id])scoresJson[b.id]=CL_STATE.answers[b.id];});
  const assessment={vacancy_id:CL_STATE.vacancyId,vacancy_name:CL_STATE.vacancyName,recruiter_id:U.id,recruiter_name:U.name,candidate_name:CL_STATE.candidateName,interview_date:CL_STATE.interviewDate,scores:scoresJson,total_score:0,max_score:CL_MAX,pct_score:0,recommendation:'',summary:'',notes:CL_STATE.notes};
  const res=await api('addAssessment',{assessment});
  if(!res)ASSESSMENTS.unshift({id:'demo-'+Date.now(),created_at:fru(today()),...assessment,interview_date:fru(CL_STATE.interviewDate)});
  toast('Оценка сохранена ✓');
  CL_STATE.step=3;
  renderCLResult(assessment);
}

function renderCLResult(assessment){
  const el=document.getElementById('content');
  const{pct,rec,cls}=calcCL();
  const cmap={green:'var(--green)',amber:'var(--amber)',red:'var(--red)',blue:'var(--blue)'};
  const bgmap={green:'var(--gbg)',amber:'var(--abg)',red:'var(--rbg)',blue:'var(--bbg)'};
  const rcC='var(--acc)';
  const rcBg='var(--accbg)';
  const rcIcon='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2';
  const blocksHtml=CL_BLOCKS.map(b=>{
    const oid=CL_STATE.answers[b.id];
    const opt=oid?b.options.find(o=>o.id===oid):null;
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bg)">
      <div style="font-size:12px;color:var(--ink2);max-width:60%"><b>Блок ${b.num}</b> — ${b.title}</div>
      ${opt?`<span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:${bgmap[opt.color]};color:${cmap[opt.color]};white-space:nowrap">${opt.label}</span>`:'<span style="font-size:11px;color:var(--ink3)">—</span>'}
    </div>`;
  }).join('');
  el.innerHTML=`
    ${clBC(3)}
    <div style="max-width:640px">
      <div class="card" style="padding:24px 28px;margin-bottom:14px;border-color:${rcC}40">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="width:52px;height:52px;border-radius:13px;background:${rcBg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${rcC}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${rcIcon}"/></svg>
          </div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--ink3)">${CL_STATE.vacancyName}</div>
            <div style="font-size:19px;font-weight:800">${CL_STATE.candidateName}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;color:var(--ink3)">${Object.keys(CL_STATE.answers).length}/${CL_BLOCKS.length} блоков</div>
          </div>
        </div>

      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="ch"><span class="ct">Поведенческий профиль</span></div>
        <div style="padding:4px 18px 8px">${blocksHtml}</div>
      </div>
      ${CL_STATE.notes?`<div class="card" style="margin-bottom:14px;background:var(--accbg);border-color:#d4c2eb">
        <div class="ch" style="border-color:#d4c2eb"><span class="ct" style="color:var(--acc)">Ключевые риски</span></div>
        <div style="padding:10px 18px 14px;font-size:13px;color:var(--ink2);line-height:1.7">${CL_STATE.notes}</div>
      </div>`:''}
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn-cancel" data-act="cl-list">← К списку</button>
        <button type="button" class="btn-primary" data-act="cl-new">+ Новая оценка</button>
      </div>
    </div>`;
}

function viewAssessment(id){
  const a=ASSESSMENTS.find(x=>x.id===id);if(!a)return;
  CL_STATE={vacancyId:a.vacancy_id,vacancyName:a.vacancy_name,candidateName:a.candidate_name,interviewDate:a.interview_date,answers:a.scores||{},notes:a.notes||'',step:3};
  renderCLResult(a);
}

function clBC(step){
  const steps=[{n:1,l:'Кандидат'},{n:2,l:'Чек-лист'},{n:3,l:'Итог'}];
  return`<div style="display:flex;align-items:center;gap:6px;margin-bottom:16px">
    <button type="button" style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--ink3)" data-act="cl-list">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>Оценки</button>
    ${steps.map(s=>`<span style="color:var(--ink3)">/</span>
      <span style="font-size:13px;font-weight:${s.n===step?700:400};color:${s.n===step?'var(--acc)':s.n<step?'var(--ink2)':'var(--ink3)'}">${s.l}</span>`).join('')}
  </div>`;
}

// ══ VALUES (PVQ-RR) ═════════════════════════════════
let VLIST=[];
let V_PROFILE_FILTER='all';
let V_RESULT_CHARTS={bar:null,circle:null,im:null,meta:null};
let V_RESULT_VIEW={mode:'centered',centered:null,base:null,circleCentered:null,circleBase:null};
let V_RESULT_CONTEXT={invite:null,result:null};
const VALUE_SHORT_LABEL_BY_ABBR={
  SDT:'Самостоятельность (М)', SDA:'Самостоятельность (П)', ST:'Стимуляция', HE:'Гедонизм', AC:'Достижение',
  POD:'Власть (Д)', POR:'Власть (Р)', FAC:'Репутация', SEP:'Безопасность (Л)', SES:'Безопасность (О)',
  TR:'Традиция', COR:'Конформизм (П)', COI:'Конформизм (М)', HUM:'Скромность',
  BEC:'Благожелательность (З)', BED:'Благожелательность (ЧД)', UNC:'Забота о других', UNN:'Забота о природе', UNT:'Толерантность'
};
const VALUE_FULL_LABEL_BY_ABBR={
  SDT:'Самостоятельность мысли', SDA:'Самостоятельность поступков', ST:'Стимуляция', HE:'Гедонизм', AC:'Достижение',
  POD:'Власть — доминирование', POR:'Власть — ресурсы', FAC:'Репутация',
  SEP:'Личная безопасность', SES:'Общественная безопасность', TR:'Традиция',
  COR:'Конформизм — правила', COI:'Конформизм — межличностная', HUM:'Скромность',
  BEC:'Благожелательность — забота', BED:'Благожелательность — чувство долга',
  UNC:'Забота о других', UNN:'Забота о природе', UNT:'Толерантность'
};
const VALUE_ABBR_BY_ID_FRONT={
  self_direction_thought:'SDT', self_direction_action:'SDA', stimulation:'ST', hedonism:'HE', achievement:'AC',
  power_dominance:'POD', power_resources:'POR', reputation:'FAC', security_personal:'SEP', security_societal:'SES',
  tradition:'TR', conformity_rules:'COR', conformity_interpersonal:'COI', humility:'HUM',
  benevolence_dependability:'BED', benevolence_caring:'BEC', universalism_concern:'UNC',
  universalism_nature:'UNN', universalism_tolerance:'UNT'
};

async function renderValues(){
  const el=document.getElementById('content');
  if(!U||!U.role){if(el)el.innerHTML='<div class="empty" style="padding:40px"><p>Сессия недоступна</p></div>';return;}
  const rr=await api('getValueAssessments',{role:U.role,recruiter_id:U.id});
  VLIST=rr?.ok?(rr.items||[]):[];
  renderValuesList(el);
}

function renderValuesList(el){
  const filtered = V_PROFILE_FILTER==='all'
    ? VLIST
    : VLIST.filter(v=>String(v.profile_level||'')===V_PROFILE_FILTER);
  const profileBadge=v=>{
    let c=v.profile_level;
    let pct=Number(v.profile_match_pct);
    if((!c||!Number.isFinite(pct)) && typeof v.interpretation==='string'){
      const t=v.interpretation;
      const m=t.match(/(Зел[её]ный|Синий|Ж[её]лтый|Красный)\s*\(?(\d{1,3})?%?\)?/i);
      if(m){
        const l=m[1].toLowerCase();
        if(l.includes('зел')) c='green';
        else if(l.includes('син')) c='blue';
        else if(l.includes('ж')) c='yellow';
        else if(l.includes('крас')) c='red';
        if(m[2]) pct=Number(m[2]);
      }
    }
    if(!c||!Number.isFinite(pct)) return '<span style="font-size:11px;color:var(--ink3)">—</span>';
    const map={red:['Красный','#E35B6A','#ffe9ec'],yellow:['Жёлтый','#B7791F','#fff6dd'],blue:['Синий','#2B6CB0','#e8f1ff'],green:['Зелёный','#2F855A','#e8fff3']};
    const m=map[c]||['—','#4a5568','#edf2f7'];
    return `<span style="font-size:11px;font-weight:700;color:${m[1]};background:${m[2]};padding:3px 8px;border-radius:999px">${m[0]} · ${pct}%</span>`;
  };
  const statusBadge=s=>{
    if(s==='completed')return'<span class="badge sc2">Завершён</span>';
    if(s==='expired')return'<span class="badge sca">Истёк</span>';
    return'<span class="badge sw">Отправлен</span>';
  };
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h2 style="font-size:18px;font-weight:700">Оценка ценностей (PVQ-RR)</h2>
        <p style="font-size:13px;color:var(--ink3);margin-top:2px">67 вопросов (57 PVQ‑RR + 10 контрольных), одноразовая ссылка на 7 дней, диаграмма + круг ценностей</p>
      </div>
      <button type="button" class="btn-primary" data-act="val-new">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Новая оценка ценностей
      </button>
    </div>
    ${filtered.length===0
      ?`<div class="card"><div class="empty" style="padding:60px">
        <div class="empty-ico" style="background:var(--accbg)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC.val}</svg></div>
        <h3>Нет отправленных опросов</h3><p>Отправьте новый опрос кандидату — он появится здесь.</p>
      </div></div>`
      :`<div class="card"><div class="tbl-wrap"><table>
        <thead><tr><th>Сотрудник</th><th>Подразделение</th><th>Группа</th><th>Рекрутер</th><th>Дата отправки</th><th>Статус</th><th>Совпадение</th><th>Действия</th></tr></thead>
        <tbody>${filtered.map(v=>`
          <tr>
            <td><div style="font-weight:600;font-size:13px">${escapeHtml(v.candidate_name||'')}</div><div style="font-size:11px;color:var(--ink3)">${escapeHtml(v.candidate_email||'')}</div></td>
            <td class="td-val-dept" data-vid="${escapeHtml(v.id)}" title="Кликните, чтобы изменить подразделение" style="cursor:${canEdit()?'pointer':'default'}"><div style="font-size:12px;color:var(--ink2)">${escapeHtml(v.department||'—')}</div></td>
            <td class="td-val-grp" data-vid="${escapeHtml(v.id)}" title="Кликните, чтобы изменить группу" style="cursor:${canEdit()?'pointer':'default'}"><div style="font-size:12px;color:var(--ink2)">${escapeHtml(v.employee_group||'—')}</div></td>
            <td><div style="font-size:12px;color:var(--ink2)">${escapeHtml(v.recruiter_name||'')}</div></td>
            <td><div style="font-size:12px;color:var(--ink3)">${escapeHtml(v.sent_at||'')}</div></td>
            <td>${statusBadge(v.status)}</td>
            <td>${profileBadge(v)}</td>
            <td style="white-space:nowrap"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <button type="button" class="btn-sm" data-act="val-view" data-vid="${escapeHtml(v.id)}"${(v.has_result||v.status==='completed') && U.role!=='recruiter'?'':' disabled'}>Результат</button>
              ${canDelete()?`<button type="button" class="btn-danger" data-act="val-del" data-vid="${escapeHtml(v.id)}">✕</button>`:''}
            </div></td>
          </tr>
        `).join('')}</tbody>
      </table></div></div>`
    }`;
}

// Inline-редактирование подразделения / группы для строки списка оценок ценностей.
// Используется делегированием клика (см. initGlobalActs).
async function inlineEditValueField(cell, kind){
  if(!cell||!canEdit())return;
  if(cell.querySelector('select.inline-vfield'))return;
  const vid=cell.dataset.vid;
  const item=VLIST.find(x=>String(x.id)===String(vid));
  if(!item)return;
  const isDept=kind==='dept';
  const cur=isDept?(item.department||''):(item.employee_group||'');
  const opts=isDept
    ? (Array.isArray(REF?.['Подразделения'])&&REF['Подразделения'].length?REF['Подразделения']:['IT','Финансы','Продажи','HR','Производство'])
    : (Array.isArray(REF?.['Группы'])&&REF['Группы'].length?REF['Группы']:['ТОП','Офис','Рабочий','Линейный']);
  const original=cell.innerHTML;
  const optsHtml='<option value="">— не задано —</option>'+
    opts.map(o=>`<option${o===cur?' selected':''}>${escapeHtml(o)}</option>`).join('');
  cell.innerHTML='<select class="inline-vfield finp" style="padding:4px 22px 4px 8px;font-size:12px;background-position:right 6px center">'+optsHtml+'</select>';
  const sel=cell.querySelector('select');
  sel.focus();
  let done=false;
  const restore=()=>{cell.innerHTML=original;};
  sel.addEventListener('change',async ()=>{
    const newVal=sel.value;
    if(newVal===cur){restore();return;}
    done=true;
    const fieldKey=isDept?'department':'employee_group';
    const fields={}; fields[fieldKey]=newVal;
    // Оптимистичное обновление UI
    if(isDept)item.department=newVal; else item.employee_group=newVal;
    cell.innerHTML='<div style="font-size:12px;color:var(--ink2)">'+escapeHtml(newVal||'—')+'</div>';
    const res=await api('updateValueInviteFields',{id:vid,fields});
    if(!res||res.ok===false){
      // Откат
      if(isDept)item.department=cur; else item.employee_group=cur;
      cell.innerHTML=original;
      toast(res?.error||'Не удалось сохранить','err');
      return;
    }
    toast(isDept?'Подразделение обновлено':'Группа обновлена');
  });
  sel.addEventListener('blur',()=>setTimeout(()=>{if(!done)restore();},150));
  sel.addEventListener('keydown',e=>{if(e.key==='Escape')restore();});
}

function pickBarModeData(result){
  const centered = result?.bar_chart || null;
  const base = result?.bar_chart_base || result?.bar_chart_raw || result?.bar_chart_absolute || null;
  return { centered, base };
}

function extractOverallMean(result){
  const keys = ['overall_mean','respondent_mean','mean_response','mean_all','ips_mean','grand_mean','mean57'];
  for(const k of keys){
    const v = Number(result?.[k]);
    if(Number.isFinite(v)) return v;
  }
  return null;
}

function computeBaseFromCentered(result, centered){
  if(!centered || !Array.isArray(centered.labels) || !Array.isArray(centered.data)) return null;
  const m = extractOverallMean(result);
  if(!Number.isFinite(m)) return null;
  return {
    labels: centered.labels.slice(),
    data: centered.data.map(v => Number((Number(v) + m).toFixed(3))),
  };
}

function computeBaseFromRawObject(result, centered){
  const rawObj = result?.raw_scores || result?.base_scores || result?.values_raw || null;
  if(!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj) || !centered?.labels?.length) return null;
  const labels = centered.labels.slice();
  const data = labels.map(lbl=>{
    const v = Number(rawObj[lbl]);
    return Number.isFinite(v) ? v : null;
  });
  if(data.some(v=>v==null)) return null;
  return { labels, data };
}

const META_GROUPS=[
  {label:'Открытость изменениям',abbrs:['SDT','SDA','ST','HE'],     color:'#3B82F6'},
  {label:'Самоутверждение',       abbrs:['AC','POD','POR','FAC'],    color:'#F59E0B'},
  {label:'Сохранение',            abbrs:['SEP','SES','TR','COR','COI'],color:'#10B981'},
  {label:'Самоопределение',       abbrs:['HUM','BEC','BED','UNC','UNN','UNT'],color:'#8B5CF6'}
];

function computeMetaAverages(r){
  // Build abbr→score from raw_scores/base_scores (id keys → abbr via VALUE_ABBR_BY_ID_FRONT)
  const rawObj=r?.raw_scores||r?.base_scores||r?.values_raw||null;
  const scores=r?.scores||null;
  const mean=Number(r?.mean57||0);
  const map={};
  if(rawObj&&typeof rawObj==='object'&&!Array.isArray(rawObj)){
    Object.keys(rawObj).forEach(k=>{
      const abbr=VALUE_ABBR_BY_ID_FRONT[k]||k;
      const v=Number(rawObj[k]);
      if(Number.isFinite(v))map[abbr]=v;
    });
  }
  // Fallback: centered scores + mean57
  if(!Object.keys(map).length&&scores&&Number.isFinite(mean)&&mean!==0){
    Object.keys(scores).forEach(id=>{
      const abbr=VALUE_ABBR_BY_ID_FRONT[id]||id;
      const v=Number(scores[id])+mean;
      if(Number.isFinite(v))map[abbr]=v;
    });
  }
  if(!Object.keys(map).length)return null;
  const avgs=META_GROUPS.map(g=>{
    const vals=g.abbrs.map(a=>map[a]).filter(v=>Number.isFinite(v));
    return vals.length?{label:g.label,color:g.color,avg:vals.reduce((a,b)=>a+b,0)/vals.length}:null;
  }).filter(Boolean);
  return avgs.length>=2?avgs:null;
}

function getBaseBarData(result, centered){
  const direct = result?.bar_chart_base || result?.bar_chart_raw || result?.bar_chart_absolute || null;
  if(direct) return direct;
  const rawBased = computeBaseFromRawObject(result, centered);
  if(rawBased) return rawBased;
  return computeBaseFromCentered(result, centered);
}

function sortBarChartDesc(chart){
  const labels = Array.isArray(chart?.labels) ? chart.labels.slice() : [];
  const data = Array.isArray(chart?.data) ? chart.data.slice() : [];
  const pairs = labels.map((label, i)=>({ label, value:Number(data[i]) || 0 }));
  pairs.sort((a,b)=>b.value-a.value);
  return {
    labels: pairs.map(x=>x.label),
    data: pairs.map(x=>x.value),
  };
}

function renderMetaLegend(containerId, metas, colors){
  const el=document.getElementById(containerId);
  if(!el)return;
  if(!Array.isArray(metas)||!Array.isArray(colors)||!metas.length||metas.length!==colors.length){
    el.innerHTML='';
    return;
  }
  const uniq=[];
  for(let i=0;i<metas.length;i++){
    const m=String(metas[i]||'').trim();
    const c=String(colors[i]||'').trim();
    if(!m||!c)continue;
    if(uniq.some(x=>x.meta===m))continue;
    uniq.push({meta:m,color:c});
  }
  el.innerHTML=uniq.map(x=>`
    <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;background:#f7f7fb;font-size:11px;color:var(--ink2)">
      <span style="width:10px;height:10px;border-radius:50%;background:${x.color};display:inline-block"></span>
      ${escapeHtml(x.meta)}
    </span>
  `).join('');
}


function stripInterpretationSummary(text){
  const raw=String(text||'').replace(/\r/g,'');
  const lines=raw.split('\n').map(s=>s.trim()).filter(Boolean);
  const cleaned=lines.filter(line=>
    !/^Итог соответствия ценностному профилю компании:/i.test(line) &&
    !/^Цветовая шкала:/i.test(line) &&
    !/^Критические зоны риска:/i.test(line)
  );
  return cleaned.join('\n').trim();
}

async function exportValueReport(inv, r, opts){
  opts=opts||{};
  const candidateMode=!!opts.candidate;
  const el=document.getElementById('content');

  // Кандидатский режим: CSS [data-pdf-mode="candidate"] скрывает оценочные блоки
  if(candidateMode) document.body.setAttribute('data-pdf-mode','candidate');

  // В кандидатском режиме скрываем «Эталонный профиль» на диаграммах
  const idealHidden=[];
  if(candidateMode){
    [V_RESULT_CHARTS.bar,V_RESULT_CHARTS.circle].forEach(ch=>{
      if(!ch?.data)return;
      ch.data.datasets.forEach((ds,i)=>{
        if(ds.label==='Эталонный профиль'){
          try{ch.setDatasetVisibility(i,false);}catch(e){}
          idealHidden.push({ch,i});
        }
      });
      try{ch.update('none');}catch(e){}
    });
  }

  // Заголовок страницы → браузер предложит его как имя файла PDF
  const baseName=(inv?.candidate_name||'employee').replace(/[^\wа-яА-ЯёЁ-]+/g,'_');
  const docTitle=(candidateMode?'value-report-candidate-':'value-report-')+baseName;
  const prevTitle=document.title;
  document.title=docTitle;

  // Восстанавливаем всё после закрытия диалога печати
  const restore=()=>{
    if(candidateMode) document.body.removeAttribute('data-pdf-mode');
    idealHidden.forEach(({ch,i})=>{try{ch.setDatasetVisibility(i,true);ch.update('none');}catch(e){}});
    document.title=prevTitle;
    window.removeEventListener('afterprint',restore);
  };
  window.addEventListener('afterprint',restore);

  // Скроллируем в начало — иначе браузер может печатать с текущей позиции
  el.scrollTo(0,0);
  window.scrollTo(0,0);
  toast('Откроется диалог печати → выберите «Сохранить как PDF»');
  await new Promise(res=>setTimeout(res,400));
  window.print();
}
function renderValueBarChart(){
  // Всегда показываем базовые средние (1–6). Если base недоступен — fallback на centered.
  const src = V_RESULT_VIEW.base || V_RESULT_VIEW.centered;
  if(!src) return;
  const abbrs = Array.isArray(V_RESULT_VIEW.abbrs) ? V_RESULT_VIEW.abbrs.slice() : [];
  const labelsRaw = abbrs.length ? abbrs.map(a=>VALUE_SHORT_LABEL_BY_ABBR[a]||a) : (Array.isArray(src?.labels) ? src.labels.slice() : []);
  const dataRaw = Array.isArray(src?.data) ? src.data.slice() : [];
  const idealRaw = Array.isArray(V_RESULT_VIEW.idealBase) ? V_RESULT_VIEW.idealBase.slice() : null;
  const pairs = labelsRaw.map((label,i)=>({label,value:Number(dataRaw[i])||0,ideal:idealRaw?Number(idealRaw[i])||0:null}));
  pairs.sort((a,b)=>b.value-a.value);
  const labels = pairs.map(p=>p.label);
  const data = pairs.map(p=>p.value);
  const ideal = idealRaw ? pairs.map(p=>p.ideal) : null;
  if(V_RESULT_CHARTS.bar)V_RESULT_CHARTS.bar.destroy();
  const _dl=window.ChartDataLabels;
  V_RESULT_CHARTS.bar=new Chart(document.getElementById('val-bar').getContext('2d'),{
    type:'bar',
    ...(_dl?{plugins:[_dl]}:{}),
    data:{
      labels,
      datasets:[
        {
          type:'bar',
          label:'Профиль',
          data,
          backgroundColor:'rgba(123,94,167,0.82)',
          borderColor:'#7B5EA7',
          borderWidth:1,
          borderRadius:4,
          borderSkipped:false,
          order:10,
          ...(_dl?{datalabels:{display:true,anchor:'end',align:'top',offset:-2,color:'#4a5568',backgroundColor:'rgba(255,255,255,0.88)',borderRadius:3,padding:{top:1,bottom:1,left:3,right:3},font:{size:9,weight:'600'},formatter:v=>Number(v).toFixed(2)}}:{})
        },
        ...(ideal ? [{
          type:'line',
          label:'Эталонный профиль',
          data:ideal,
          borderColor:'#E11D48',
          backgroundColor:'rgba(225,29,72,.08)',
          pointBackgroundColor:'#E11D48',
          pointRadius:4,
          pointHoverRadius:6,
          borderWidth:2.5,
          tension:0.2,
          fill:false,
          order:0,
          ...(_dl?{datalabels:{display:false}}:{})
        }] : [])
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{top:_dl?18:4,left:0,right:8}},
      plugins:{
        legend:{display:true,position:'left',align:'start',labels:{font:{size:11},boxWidth:12,padding:10,usePointStyle:false}},
        ...(_dl?{datalabels:{display:false}}:{})
      },
      scales:{
        x:{ticks:{autoSkip:false,maxRotation:45,minRotation:45,font:{size:9},color:'#4a5568'},grid:{color:'rgba(0,0,0,0.04)'}},
        y:{min:1,max:6,beginAtZero:false,title:{display:true,text:'Средние баллы',font:{size:10}},grid:{color:'rgba(0,0,0,0.06)'},ticks:{font:{size:9}}}
      }
    }
  });
}

function renderValueCircleChart(){
  // Всегда показываем базовые средние (1–6). Если base недоступен — fallback на centered.
  const src = V_RESULT_VIEW.circleBase || V_RESULT_VIEW.circleCentered;
  if(!src)return;
  const abbrs = Array.isArray(V_RESULT_VIEW.circleAbbrs) ? V_RESULT_VIEW.circleAbbrs : [];
  const labels = abbrs.length ? abbrs.map(a=>VALUE_SHORT_LABEL_BY_ABBR[a]||a) : (src.labels||[]);
  if(V_RESULT_CHARTS.circle)V_RESULT_CHARTS.circle.destroy();
  const _n=abbrs.length||19;
  const _metaArcPlugin={
    id:'metaArcs',
    afterDraw(chart){
      if(chart.config.type!=='radar')return;
      const sc=chart.scales.r; if(!sc)return;
      const ctx=chart.ctx,cx=sc.xCenter,cy=sc.yCenter,outerR=sc.drawingArea;
      const arcR=outerR+42,ARC_W=9,LABEL_R=arcR+ARC_W/2+14;
      const step=(2*Math.PI)/_n,startA=-Math.PI/2;
      const METAS=[
        {label:'Открытость изменениям',color:'#3B82F6',from:0,to:3},
        {label:'Самоутверждение',color:'#F59E0B',from:4,to:7},
        {label:'Сохранение',color:'#10B981',from:8,to:12},
        {label:'Самоопределение',color:'#8B5CF6',from:13,to:_n-1}
      ];
      METAS.forEach(m=>{
        const a1=startA+step*(m.from-0.5),a2=startA+step*(m.to+0.5),mid=(a1+a2)/2;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx,cy,arcR,a1,a2,false);
        ctx.strokeStyle=m.color; ctx.lineWidth=ARC_W; ctx.lineCap='round'; ctx.stroke();
        const lx=cx+LABEL_R*Math.cos(mid),ly=cy+LABEL_R*Math.sin(mid);
        const txt=m.label;
        ctx.font='bold 12px sans-serif';
        const tw=ctx.measureText(txt).width;
        ctx.fillStyle='rgba(255,255,255,0.92)';
        ctx.fillRect(lx-tw/2-4,ly-9,tw+8,18);
        ctx.fillStyle=m.color;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(txt,lx,ly);
        ctx.restore();
      });
      // Repaint point labels on top of arcs using stable getPointPosition API
      try{
        const plOpts=(chart.options&&chart.options.scales&&chart.options.scales.r&&chart.options.scales.r.pointLabels)||{};
        const fSize=(plOpts.font&&plOpts.font.size)||9;
        const fColor=plOpts.color||'#4a5568';
        // Labels sit at outerR + padding(5) + half font-height
        const labelRadius=outerR+5+fSize/2;
        ctx.save();
        ctx.font=fSize+'px sans-serif';
        ctx.fillStyle=fColor;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        chart.data.labels.forEach(function(lbl,i){
          const pos=sc.getPointPosition(i,labelRadius);
          // White knockout so text is readable over any arc colour
          ctx.strokeStyle='rgba(255,255,255,0.85)';
          ctx.lineWidth=3;
          ctx.lineJoin='round';
          ctx.strokeText(String(lbl),pos.x,pos.y);
          ctx.fillText(String(lbl),pos.x,pos.y);
        });
        ctx.restore();
      }catch(e){}
    }
  };
  const _dlr=window.ChartDataLabels;
  V_RESULT_CHARTS.circle=new Chart(document.getElementById('val-circle').getContext('2d'),{
    type:'radar',
    plugins:[_metaArcPlugin,...(_dlr?[_dlr]:[])],
    data:{
      labels,
      datasets:[
        {
          label:'Профиль',
          data:src.data||[],
          borderColor:'#7B5EA7',
          backgroundColor:'rgba(123,94,167,.15)',
          pointBackgroundColor:'#7B5EA7',
          pointRadius:4,
          pointHoverRadius:6,
          borderWidth:2,
          ...(_dlr?{datalabels:{display:true,anchor:'end',align:'end',offset:4,color:'#7B5EA7',backgroundColor:'rgba(255,255,255,0.88)',borderColor:'#7B5EA7',borderWidth:1,borderRadius:4,padding:{top:1,bottom:1,left:3,right:3},font:{size:9,weight:'700'},formatter:v=>Number(v).toFixed(1)}}:{})
        },
        ...(Array.isArray(V_RESULT_VIEW.circleIdealBase) ? [{
          label:'Эталонный профиль',
          data:V_RESULT_VIEW.circleIdealBase,
          borderColor:'#E11D48',
          backgroundColor:'rgba(225,29,72,.04)',
          pointBackgroundColor:'#E11D48',
          pointRadius:3,
          borderWidth:2,
          ...(_dlr?{datalabels:{display:false}}:{})
        }] : [])
      ],
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      layout:{padding:{top:80,bottom:80,left:90,right:90}},
      plugins:{
        legend:{display:true,position:'left',align:'start',labels:{font:{size:11},boxWidth:12,padding:10,usePointStyle:false}},
        ...(_dlr?{datalabels:{display:false}}:{})
      },
      scales:{r:{min:1,max:6,angleLines:{color:'#e6e1f0'},grid:{color:'#e6e1f0'},pointLabels:{display:false,font:{size:9},color:'#4a5568'},ticks:{backdropColor:'transparent',font:{size:8},stepSize:1}}}
    }
  });
}

function openValueModal(){
  const depts=Array.isArray(REF?.['Подразделения'])&&REF['Подразделения'].length?REF['Подразделения']:['IT','Финансы','Продажи','HR','Производство'];
  const groups=Array.isArray(REF?.['Группы'])&&REF['Группы'].length?REF['Группы']:['ТОП','Офис','Рабочий','Линейный'];
  const html=`<div class="modal-overlay" id="val-modal" data-act="val-overlay">
    <div class="modal" style="max-width:620px">
      <div class="modal-hdr">
        <span class="modal-ttl">Новая оценка ценностей</span>
        <button type="button" class="modal-close" data-act="close-val-modal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="fg full">
            <label class="flbl">ФИО сотрудника <span class="req">*</span></label>
            <input id="val-name" class="finp" placeholder="Иванов Иван Иванович">
          </div>
          <div class="fg">
            <label class="flbl">Подразделение <span class="req">*</span></label>
            <select id="val-dept" class="finp">
              <option value="">— выберите подразделение —</option>
              ${depts.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="flbl">Группа <span class="req">*</span></label>
            <select id="val-group" class="finp">
              <option value="">— выберите группу —</option>
              ${groups.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label class="flbl">Дата направления <span class="req">*</span></label>
            <input id="val-date" class="finp" type="date" value="${today()}">
          </div>
          <div class="fg">
            <label class="flbl">Пол <span class="req">*</span></label>
            <select id="val-gender" class="finp">
              <option value="">— выберите —</option>
              <option value="male">Мужчина</option>
              <option value="female">Женщина</option>
            </select>
          </div>
          <div class="fg full">
            <label class="flbl">Email сотрудника <span class="req">*</span></label>
            <input id="val-email" class="finp" type="email" placeholder="candidate@example.com">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div></div>
        <div style="display:flex;gap:10px">
          <button type="button" class="btn-cancel" data-act="close-val-modal">Отмена</button>
          <button type="button" class="btn-save" id="btn-send-val" data-act="val-send">Отправить ссылку</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  if(window.VAC_UI&&window.VAC_UI.modal){
    try{window.VAC_UI.modal.track(document.getElementById('val-modal'));}catch(e){}
  }
}

function closeValueModal(force){
  const m=document.getElementById('val-modal');
  if(!m)return;
  if(!force&&window.VAC_UI&&window.VAC_UI.modal){
    if(!window.VAC_UI.modal.confirmClose(m))return;
  }
  m.remove();
}

async function sendValueInvite(){
  const candidateName=(document.getElementById('val-name')?.value||'').trim();
  const department=(document.getElementById('val-dept')?.value||'').trim();
  const employeeGroup=(document.getElementById('val-group')?.value||'').trim();
  const sentDate=document.getElementById('val-date')?.value||'';
  const gender=document.getElementById('val-gender')?.value||'';
  const email=(document.getElementById('val-email')?.value||'').trim().toLowerCase();
  if(!candidateName||!department||!employeeGroup||!sentDate||!gender||!email){
    toast('Заполните все обязательные поля','err');return;
  }
  // Клиентская проверка email — те же правила, что на бэке (createValueAssessmentInvite).
  // Сразу прерываемся, чтобы не дёргать API с заведомо невалидным адресом.
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    toast('Адрес e-mail не выглядит действительным','err');
    document.getElementById('val-email')?.focus();
    return;
  }
  const btn=document.getElementById('btn-send-val');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
  const res=await api('createValueAssessmentInvite',{
    candidate_name:candidateName,sent_date:sentDate,
    department,employee_group:employeeGroup,
    gender,email,recruiter_id:U.id,recruiter_name:U.name,
  });
  if(res?.ok){
    toast('Ссылка отправлена кандидату ✓');
    if(window.VAC_UI&&window.VAC_UI.modal){try{window.VAC_UI.modal.markClean(document.getElementById('val-modal'));}catch(e){}}
    closeValueModal(true);
    await renderValues();
  }else{
    toast(res?.error||'Не удалось отправить ссылку','err');
    if(btn){btn.disabled=false;btn.textContent='Отправить ссылку';}
    // На случай, если на бэке остались «фантомные» строки от прошлых багов —
    // обновим список, чтобы пользователь видел реальное состояние, а не предположения UI.
    try{await renderValues();}catch(e){}
  }
}

async function deleteValueAssessment(id){
  if(!canDelete()||!id)return;
  if(!confirm('Удалить эту оценку ценностей? Действие необратимо.'))return;
  const res=await api('deleteValueAssessment',{id,caller_role:U.role});
  if(res?.ok||res===null){
    toast('Оценка удалена');
    await renderValues();
  }else toast(res?.error||'Ошибка','err');
}

function ensureChartJs(){
  return new Promise((resolve,reject)=>{
    if(window.Chart && window.ChartDataLabels) return resolve();
    const loadScript=src=>new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src=src; s.onload=()=>res(); s.onerror=()=>rej(new Error('Не загрузился: '+src));
      document.head.appendChild(s);
    });
    (window.Chart ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/chart.js'))
      .then(()=>window.ChartDataLabels ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js'))
      .then(resolve)
      .catch(reject);
  });
}

function ensureHtml2Pdf(){
  return new Promise((resolve,reject)=>{
    if(window.html2pdf) return resolve();
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('html2pdf не загрузился'));
    document.head.appendChild(s);
  });
}

function ensureJsPdf(){
  return new Promise((resolve,reject)=>{
    if(window.jspdf?.jsPDF) return resolve();
    const urls=[
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ];
    let idx=0;
    const loadNext=()=>{
      if(idx>=urls.length) return reject(new Error('jsPDF не загрузился'));
      const s=document.createElement('script');
      s.src=urls[idx++];
      s.onload=()=>window.jspdf?.jsPDF ? resolve() : loadNext();
      s.onerror=()=>loadNext();
      document.head.appendChild(s);
    };
    loadNext();
  });
}

function ensurePdfMake(){
  return new Promise((resolve,reject)=>{
    if(window.pdfMake?.createPdf) return resolve();
    const load=(src)=>new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=()=>res();
      s.onerror=()=>rej(new Error(`Не загрузился ${src}`));
      document.head.appendChild(s);
    });
    load('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js')
      .then(()=>load('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js'))
      .then(()=>window.pdfMake?.createPdf ? resolve() : reject(new Error('pdfMake недоступен')))
      .catch(reject);
  });
}

async function viewValueResult(id){
  if(U?.role==='recruiter'){
    toast('Детальный результат доступен только Администратору и Руководителю','err');
    return;
  }
  const res=await api('getValueAssessmentResult',{id,role:U?.role,recruiter_id:U?.id});
  if(!res?.ok){toast(res?.error||'Результат не найден','err');return;}
  const inv=res.invite||{};
  const r=res.result||{};
  const profileRaw=r.profile||{};
  const profile=(profileRaw && Object.keys(profileRaw).length) ? profileRaw : (function(){
    const scores=r?.scores||{};
    const mean=Number(r?.mean57||0);
    const toBase=id=>Number(scores?.[id]||0)+mean;
    const keyDefs=[['UNC','universalism_concern',5.0],['BEC','benevolence_caring',5.0],['BED','benevolence_dependability',4.5],['AC','achievement',4.0],['SDA','self_direction_action',4.0],['SDT','self_direction_thought',4.0],['ST','stimulation',3.5]];
    const riskDefs=[['POD','power_dominance',3.0],['TR','tradition',3.0],['FAC','reputation',4.0],['COR','conformity_rules',3.5]];
    const lead=Object.keys(scores).map(id=>({id,score:toBase(id)})).sort((a,b)=>b.score-a.score).slice(0,5).map(x=>({abbr:VALUE_ABBR_BY_ID_FRONT[x.id]||x.id,label:VALUE_FULL_LABEL_BY_ABBR[VALUE_ABBR_BY_ID_FRONT[x.id]]||x.id,score:Number(x.score.toFixed(2))}));
    const keyVals=keyDefs.map(([abbr,id,min])=>({abbr,label:VALUE_FULL_LABEL_BY_ABBR[abbr],score:Number(toBase(id).toFixed(2)),min}));
    const riskVals=riskDefs.map(([abbr,id,max])=>({abbr,label:VALUE_FULL_LABEL_BY_ABBR[abbr],score:Number(toBase(id).toFixed(2)),max})).sort((a,b)=>b.score-a.score);
    const critical=keyVals.filter(x=>x.score<x.min);
    const pts=[...keyVals.map(x=>Math.max(0,Math.min(1,x.score/x.min))),...riskVals.map(x=>x.score<=x.max?1:Math.max(0,Math.min(1,x.max/x.score)))];
    const pct=Math.round((pts.reduce((s,v)=>s+v,0)/(pts.length||1))*100);
    const code=pct>=75?'green':pct>=50?'blue':pct>=25?'yellow':'red';
    const label=code==='green'?'Зелёный':code==='blue'?'Синий':code==='yellow'?'Жёлтый':'Красный';
    return {match_pct:pct,level_code:code,level_label:label,lead_values:lead,key_values:keyVals,risk_values:riskVals,critical_risk_values:critical};
  })();
  V_RESULT_CONTEXT={invite:inv,result:r};
  const interpText = stripInterpretationSummary(r.interpretation||'Интерпретация будет доступна после обработки');
  const interpHtml = escapeHtml(interpText||'Интерпретация будет доступна после обработки').replace(/\n/g,'<br>');
  const im = r.im || {};
  const imSum = Number(im.sum);
  const imLevel = String(im.level || '');
  function levelBadgeHtml(p){
    const map={red:['Красный','#E35B6A','#ffe9ec'],yellow:['Жёлтый','#B7791F','#fff6dd'],blue:['Синий','#2B6CB0','#e8f1ff'],green:['Зелёный','#2F855A','#e8fff3']};
    const t=map[p?.level_code]||['—','#4a5568','#edf2f7'];
    const pct=Number(p?.match_pct);
    return `<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:${t[2]};color:${t[1]};font-weight:700;font-size:12px">${t[0]}${Number.isFinite(pct)?` · ${pct}%`:''}</span>`;
  }
  function renderRows(items, kind){
    if(!Array.isArray(items)||!items.length)return '<div style="font-size:12px;color:var(--ink3)">Данные недоступны для этой записи. Используйте повторную оценку для полного профиля.</div>';
    return items.map(it=>`<div style="padding:8px 0;border-bottom:1px solid var(--bg);font-size:12px;line-height:1.5">
      <div style="font-weight:700">${escapeHtml(VALUE_FULL_LABEL_BY_ABBR[it.abbr]||it.label||it.abbr||'')} — ${Number(it.score||0).toFixed(2)}</div>
      ${kind==='key'?`<div style="color:var(--ink3)">Минимум: ${it.min}</div><div>В управлении: ${escapeHtml(it.needMgmt||'Поддерживать поведение, усиливающее ценность через регулярную обратную связь и практику.')}</div><div>Рекомендация: ${escapeHtml(it.recommend||'При расхождении с профилем компании задайте конкретные поведенческие кейсы и договоритесь о шагах развития.')}</div>`:''}
      ${kind==='risk'?`<div style="color:var(--ink3)">Идеальный максимум: ${it.max}</div><div>Конфликт: ${escapeHtml(it.conflict||'Может конфликтовать с ценностями сотрудничества, гибкости и человекоцентричности.')}</div><div>Рекомендация: ${escapeHtml(it.recommend||'Сбалансируйте управленческие ожидания: добавьте прозрачные правила и критерии взаимодействия.')}</div>`:''}
      ${kind==='critical'?`<div style="color:var(--red)">Ниже минимума ${it.min}</div><div>${escapeHtml(it.recommend||'Нужна приоритетная развивающая работа: уточнить барьеры и закрепить конкретные поведенческие практики.')}</div>`:''}
      ${kind==='lead'?`${(it.meta||it.axis1||it.axis2)?`<div style="color:var(--ink3)">${escapeHtml(it.meta||'')}${it.axis1?' · '+escapeHtml(it.axis1):''}${it.axis2?' · '+escapeHtml(it.axis2):''}</div>`:''}<div>${escapeHtml(it.goal||'Мотивационная цель: выраженное стремление действовать согласно данной ценности.')}</div>`:''}
    </div>`).join('');
  }
  const _mlvl=profile?.level_code||'';
  const _mc={green:['#e8fff3','#68d391','#276749'],yellow:['#fff6dd','#f6ad55','#B7791F'],red:['#ffe9ec','#fc8181','#9b2c2c'],blue:['#e8f1ff','#90cdf4','#2B6CB0']};
  const [_mbg,_mbd,_mtx]=_mc[_mlvl]||['#f7fafc','#e2e8f0','#4a5568'];
  document.getElementById('content').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <h2 style="font-size:18px;font-weight:700">${escapeHtml(inv.candidate_name||'')}</h2>
        <p style="font-size:13px;color:var(--ink3)">${escapeHtml(inv.department||'—')} · ${escapeHtml(inv.employee_group||'—')} · ${escapeHtml(inv.submitted_at||'')}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-sm" data-act="val-export" title="Полный отчёт со всеми данными для рекрутера/руководителя">Экспорт PDF (полный)</button>
        <button type="button" class="btn-sm" data-act="val-export-candidate" title="Сухой нейтральный отчёт без оценок и интерпретаций — можно отдать кандидату">Экспорт PDF (для кандидата)</button>
        <button type="button" class="btn-cancel" data-act="val-list">← К списку</button>
      </div>
    </div>
    ${interpText ? `<div class="card" style="padding:12px 14px;margin-bottom:10px">
      <div style="font-size:13px;color:var(--ink2);line-height:1.7">${interpHtml}</div>
    </div>` : ''}
    <div class="card" data-vprofile="1" style="padding:14px 16px;margin-bottom:10px;background:${_mbg};border-color:${_mbd}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div class="ct" style="color:${_mtx};font-size:15px">Итог соответствия профилю компании</div>
        ${levelBadgeHtml(profile)}
      </div>
      <div style="margin-top:6px;font-size:11px;color:${_mtx};opacity:0.8">
        Совпадение считается по двум частям: насколько профиль по всем 19 ценностям близок к эталону и нет ли выходов за критические пороги риска.
      </div>
    </div>
    <div class="card" data-im-block="1" style="padding:12px 14px;margin-bottom:10px;max-width:980px;margin-left:auto;margin-right:auto">
      <div style="display:flex;gap:0;align-items:stretch;flex-wrap:wrap">
        <!-- IM block -->
        <div style="flex:1;min-width:240px;padding-right:20px;border-right:1px solid var(--bg2)">
          <div class="ct" style="margin-bottom:6px">Контроль социальной желательности (IM)</div>
          <div style="font-size:12px;color:var(--ink3);line-height:1.6">
            Этот показатель не влияет на PVQ‑RR и служит контролем «приукрашивания» ответов.
          </div>
          <div style="display:flex;gap:14px;align-items:center;margin-top:10px;flex-wrap:wrap">
            <div style="flex-shrink:0">
              <div style="font-size:22px;font-weight:800;color:var(--ink2);line-height:1.1">${Number.isFinite(imSum)?imSum:'—'} <span style="font-size:13px;font-weight:600;color:var(--ink3)">/ 60</span></div>
              <div style="font-size:11px;color:var(--ink3);margin-top:2px;max-width:180px">${escapeHtml(imLevel||(!Number.isFinite(imSum)?'IM не записан для этой записи.':''))}</div>
            </div>
            <div style="flex:1;min-width:160px;height:88px">
              <canvas id="im-bar"></canvas>
            </div>
          </div>
        </div>
        <!-- Meta-values donut -->
        <div style="flex:1;min-width:240px;padding-left:20px">
          <div class="ct" style="margin-bottom:6px">Метаценности — средний балл</div>
          <div style="height:140px"><canvas id="meta-donut"></canvas></div>
        </div>
      </div>
    </div>
    <div class="card" style="padding:12px;margin-bottom:10px;max-width:980px;margin-left:auto;margin-right:auto">
      <div class="ct" style="margin-bottom:10px">Столбчатая диаграмма ценностей</div>
      <div style="height:260px"><canvas id="val-bar"></canvas></div>
    </div>
    <div class="card" style="padding:12px;max-width:980px;margin-left:auto;margin-right:auto">
      <div class="ct" style="margin-bottom:10px">Круг ценностей</div>
      <div style="height:600px"><canvas id="val-circle"></canvas></div>
    </div>`;
  try{
    await ensureChartJs();
    if(V_RESULT_CHARTS.bar)V_RESULT_CHARTS.bar.destroy();
    if(V_RESULT_CHARTS.circle)V_RESULT_CHARTS.circle.destroy();
    if(V_RESULT_CHARTS.im)V_RESULT_CHARTS.im.destroy();
    if(V_RESULT_CHARTS.meta)V_RESULT_CHARTS.meta.destroy();
    const barModes=pickBarModeData(r);
    const mean57=Number(r.mean57||0);
    const circleCentered=r.circle_chart||{};
    const circleBase = circleCentered && Array.isArray(circleCentered.data)
      ? { labels:circleCentered.labels||[], data:circleCentered.data.map(v=>Number(v)+mean57), order:circleCentered.order }
      : null;
    V_RESULT_VIEW={
      centered:barModes.centered,
      base:getBaseBarData(r, barModes.centered),
      idealBase:Array.isArray(r?.bar_chart?.ideal_data)?r.bar_chart.ideal_data:null,
      colors:Array.isArray(r?.bar_chart?.colors)?r.bar_chart.colors:null,
      abbrs:Array.isArray(r?.bar_chart?.abbrs)?r.bar_chart.abbrs:null,
      circleCentered,
      circleBase,
      circleAbbrs:Array.isArray(r?.circle_chart?.order)?r.circle_chart.order.map(id=>VALUE_ABBR_BY_ID_FRONT[id]||id):null,
      circleIdealBase:Array.isArray(r?.circle_chart?.ideal_data)?r.circle_chart.ideal_data:null
    };
    renderValueBarChart();
    renderValueCircleChart();

    // IM chart (simple bar 10..60)
    const imChart = im?.chart || null;
    const imData = Array.isArray(imChart?.data) ? imChart.data[0] : (Number.isFinite(imSum)?imSum:null);
    if(imData != null){
      const imVal = Number(imData);
      const imColor = imVal >= 42 ? '#E35B6A' : imVal >= 30 ? '#F2B84B' : '#2FAE7B';
      // Полупрозрачные зоны по порогам (10–30 / 31–41 / 42–60)
      const imBandsPlugin = {
        id: 'imBands',
        beforeDraw(chart){
          const y = chart.scales?.y;
          if(!y) return;
          const {ctx, chartArea} = chart;
          if(!ctx || !chartArea) return;
          const left = chartArea.left;
          const right = chartArea.right;
          const top = chartArea.top;
          const bottom = chartArea.bottom;

          function yPix(v){ return y.getPixelForValue(v); }
          function band(from, to, fill){
            const y1 = yPix(from);
            const y2 = yPix(to);
            const bt = Math.min(y1, y2);
            const bb = Math.max(y1, y2);
            ctx.save();
            ctx.fillStyle = fill;
            ctx.fillRect(left, bt, right - left, bb - bt);
            ctx.restore();
          }

          // Chart.js рисует ось по y: max сверху, min снизу — но пиксели уже учтены.
          band(10, 30, 'rgba(47,174,123,.18)');
          band(31, 41, 'rgba(242,184,75,.22)');
          band(42, 60, 'rgba(227,91,106,.18)');
        }
      };
            const _dlim=window.ChartDataLabels;
      V_RESULT_CHARTS.im = new Chart(document.getElementById('im-bar').getContext('2d'),{
        type:'bar',
        plugins:[imBandsPlugin,...(_dlim?[_dlim]:[])],
        data:{
          labels:[''],
          datasets:[{
            data:[imVal],
            backgroundColor:imColor,
            borderRadius:6,
            maxBarThickness:34,
            ...(_dlim?{datalabels:{display:true,anchor:'center',align:'center',color:'#fff',font:{size:12,weight:'800'},formatter:v=>v}}:{})
          }]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{ display:false }, tooltip:{ enabled:true }, ...(_dlim?{datalabels:{display:false}}:{}) },
          scales:{
            y:{ min:10, max:60, ticks:{ stepSize:10, font:{size:8} }, title:{ display:false }, grid:{color:'rgba(0,0,0,0.04)'} },
            x:{ ticks:{ display:false }, grid:{display:false} }
          }
        }
      });
    }

    // Meta-values doughnut chart — sorted highest→lowest
    const metaAvgsRaw=computeMetaAverages(r);
    const metaCtx=document.getElementById('meta-donut');
    if(metaAvgsRaw&&metaCtx){
      const metaAvgs=[...metaAvgsRaw].sort((a,b)=>b.avg-a.avg);
      const _dlm=window.ChartDataLabels;
      V_RESULT_CHARTS.meta=new Chart(metaCtx.getContext('2d'),{
        type:'doughnut',
        ...(_dlm?{plugins:[_dlm]}:{}),
        data:{
          labels:metaAvgs.map(g=>g.label),
          datasets:[{
            data:metaAvgs.map(g=>g.avg),
            backgroundColor:metaAvgs.map(g=>g.color),
            borderWidth:2,
            borderColor:'#fff',
            hoverOffset:4,
            ...(_dlm?{datalabels:{
              display:true,
              color:'#fff',
              font:{size:11,weight:'700'},
              formatter:v=>v.toFixed(1),
              anchor:'center',
              align:'center'
            }}:{})
          }]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          cutout:'45%',
          plugins:{
            legend:{
              display:true,
              position:'right',
              labels:{
                font:{size:10},
                boxWidth:10,
                padding:6,
                generateLabels(chart){
                  const ds=chart.data.datasets[0];
                  return chart.data.labels.map((lbl,i)=>({
                    text:`${lbl}: ${Number(ds.data[i]).toFixed(1)}`,
                    fillStyle:ds.backgroundColor[i],
                    strokeStyle:'#fff',
                    lineWidth:1,
                    hidden:false,
                    index:i
                  }));
                }
              }
            },
            ...(_dlm?{datalabels:{display:false}}:{}),
            tooltip:{
              callbacks:{
                label:ctx=>`${ctx.label}: ${Number(ctx.raw).toFixed(1)} (ср. балл)`
              }
            }
          }
        }
      });
    }
  }catch(e){
    toast('Не удалось построить диаграммы','err');
  }
}

// ══ SOON ═════════════════════════════════════════════
function renderSoon(page){
  document.getElementById('content').innerHTML=`
    <div class="empty" style="min-height:480px">
      <div class="empty-ico" style="background:var(--accbg)">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC['us']}</svg>
      </div>
      <h3>${page}</h3><p>Раздел в разработке.</p>
    </div>`;
}

// ══ USERS PAGE ════════════════════════════════════════════════
async function renderUsers(){
  const el=document.getElementById('content');
  const res=await api('getUsers',{role:U.role});
  const users=res?.ok?(res.users||[]):[];
  UL=users;

  function userRow(u){
    const rc=ROLES[u.role]||{l:u.role,c:'#888',bg:'#eee'};
    const isMe=u.id===U.id;
    // Храним данные в data-атрибуте, читаем через dataset в обработчике
    const di=users.indexOf(u);
    const _av=(window.VAC_UI&&window.VAC_UI.avatarHtml)?window.VAC_UI.avatarHtml(u.name,32,{shimmer:true}):('<div style="width:32px;height:32px;border-radius:50%;background:'+rc.c+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">'+u.name.charAt(0)+'</div>');
    return '<tr>'
      +'<td><div style="display:flex;align-items:center;gap:10px">'
      +_av
      +'<div><div style="font-weight:600;font-size:13px">'+u.name+(isMe?' <span style="font-size:10px;color:var(--ink3)">(вы)</span>':'')+'</div></div>'
      +'</div></td>'
      +'<td style="font-size:13px;color:var(--ink2)">'+u.login+'</td>'
      +'<td><span class="badge" style="background:'+rc.bg+';color:'+rc.c+'">'+rc.l+'</span></td>'
      +'<td><span class="badge '+(u.active?'sw':'sca')+'">'+(u.active?'Активен':'Деактивирован')+'</span></td>'
      +'<td style="white-space:nowrap;display:flex;gap:6px">'
      +'<button class="btn-edit" data-uidx="'+di+'" data-act="user-edit">Изменить</button>'
      +(!isMe?'<button class="btn-sm" data-uid="'+u.id+'" data-uactive="'+(u.active!==false?'1':'0')+'" data-act="user-toggle">'+(u.active?'Деактив.':'Активировать')+'</button>':'')
      +(!isMe?'<button class="btn-danger" data-uid="'+u.id+'" data-uname="'+escapeHtml(u.name||'')+'" data-act="user-delete">✕</button>':'')
      +'</td></tr>';
  }

  el.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'
    +'<div><h2 style="font-size:18px;font-weight:700">Управление пользователями</h2>'
    +'<p style="font-size:13px;color:var(--ink3);margin-top:2px">Учётные записи и роли доступа</p></div>'
    +'<button type="button" class="btn-primary" data-act="user-new">'
    +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    +' Новый пользователь</button></div>'
    +'<div class="card"><table><thead><tr>'
    +'<th>Пользователь</th><th>Логин</th><th>Роль</th><th>Статус</th><th></th>'
    +'</tr></thead><tbody>'
    +users.map(userRow).join('')
    +'</tbody></table></div>'
    +'<div class="card" style="margin-top:16px;padding:16px 20px;background:var(--accbg);border-color:#d4c2eb">'
    +'<div style="font-size:13px;font-weight:700;color:var(--acc);margin-bottom:8px">Права доступа по ролям</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:12px">'
    +'<div><div style="font-weight:600;color:var(--green);margin-bottom:4px">Рекрутер</div>'
    +'<div style="color:var(--ink2);line-height:1.8">Создание вакансий<br>Редактирование своих полей<br>Оценка кандидатов<br>Просмотр своих вакансий</div></div>'
    +'<div><div style="font-weight:600;color:var(--blue);margin-bottom:4px">Руководитель</div>'
    +'<div style="color:var(--ink2);line-height:1.8">Все права рекрутера<br>Полное редактирование<br>Все вакансии и оценки<br>Аналитика и планы</div></div>'
    +'<div><div style="font-weight:600;color:var(--acc);margin-bottom:4px">Администратор</div>'
    +'<div style="color:var(--ink2);line-height:1.8">Все права руководителя<br>Удаление вакансий<br>Управление пользователями<br>Полный доступ</div></div>'
    +'</div></div>';
}

function openUserModal(user){
  const isEdit=!!user;
  const u=user||{};
  // Сохраняем редактируемого пользователя глобально
  window._editUser=u;
  const div=document.createElement('div');
  div.id='user-modal';
  div.className='modal-overlay';

  const roleOpts=Object.entries(ROLES).map(function(pair){
    const k=pair[0],v=pair[1];
    const sel=(k===u.role)?' selected':'';
    return '<option value="'+k+'"'+sel+'>'+v.l+'</option>';
  }).join('');
  div.innerHTML=
    '<div class="modal" style="max-width:440px">'
    +'<div class="modal-hdr">'
    +'<span class="modal-ttl">'+(isEdit?'Редактировать':'Новый пользователь')+'</span>'
    +'<button type="button" class="modal-close" id="user-modal-x">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    +'</button></div>'
    +'<div class="modal-body"><div class="form-grid">'
    +'<div class="fg full"><label class="flbl">Полное имя *</label>'
    +'<input id="u-name" class="finp" placeholder="Иванов Иван" value="'+(u.name||'')+'"></div>'
    +'<div class="fg"><label class="flbl">Логин *</label>'
    +'<input id="u-login" class="finp" placeholder="ivanov" value="'+(u.login||'')+'"'+(isEdit?' disabled':'')+'></div>'
    +'<div class="fg"><label class="flbl">Роль *</label>'
    +'<select id="u-role" class="finp">'+roleOpts+'</select></div>'
    +'<div class="fg full"><label class="flbl">'+(isEdit?'Новый пароль (пусто — не менять)':'Пароль *')+'</label>'
    +'<input id="u-pass" class="finp" type="password" placeholder="'+(isEdit?'••••••••':'Введи пароль')+'"></div>'
    +'</div></div>'
    +'<div class="modal-footer"><div></div>'
    +'<div style="display:flex;gap:10px">'
    +'<button type="button" class="btn-cancel" id="user-modal-cancel">Отмена</button>'
    +'<button type="button" class="btn-save" id="btn-save-user">'+(isEdit?'Сохранить':'Создать')+'</button>'
    +'</div></div></div>';
  document.body.appendChild(div);
  div.addEventListener('click',(e)=>{if(e.target===div)closeUserModal();});
  const ux=document.getElementById('user-modal-x');
  if(ux)ux.addEventListener('click',()=>closeUserModal());
  const uc=document.getElementById('user-modal-cancel');
  if(uc)uc.addEventListener('click',()=>closeUserModal());
  const sb=document.getElementById('btn-save-user');
  if(sb)sb.addEventListener('click',()=>saveUser());
  if(window.VAC_UI&&window.VAC_UI.modal){
    try{window.VAC_UI.modal.track(document.getElementById('user-modal'));}catch(e){}
  }
}

function closeUserModal(force){
  const m=document.getElementById('user-modal');
  if(!m)return;
  if(!force&&window.VAC_UI&&window.VAC_UI.modal){
    if(!window.VAC_UI.modal.confirmClose(m))return;
  }
  m.remove();
}

async function saveUser(){
  const eu=window._editUser||null;
  const isEdit=!!(eu&&eu.id);
  const existingId=isEdit?eu.id:'';
  const name=document.getElementById('u-name').value.trim();
  const login=document.getElementById('u-login').value.trim();
  const role=document.getElementById('u-role').value;
  const pass=document.getElementById('u-pass').value;
  if(!name){toast('Введи имя','err');return;}
  if(!isEdit&&!login){toast('Введи логин','err');return;}
  if(!isEdit&&!pass){toast('Введи пароль','err');return;}
  const btn=document.getElementById('btn-save-user');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>';
  const fields={name,role};if(pass)fields.password=pass;
  const res=await api(isEdit?'updateUser':'addUser',{
    caller_role:U.role,
    id:isEdit?existingId:undefined,
    fields:isEdit?fields:undefined,
    user:!isEdit?{login,password:pass,name,role}:undefined,
  });
  if(res?.ok||!res){
    toast(isEdit?'Пользователь обновлён ✓':'Пользователь создан ✓');
    if(window.VAC_UI&&window.VAC_UI.modal){try{window.VAC_UI.modal.markClean(document.getElementById('user-modal'));}catch(e){}}
    closeUserModal(true);
    navigate('users');
  }else{
    toast(res.error||'Ошибка','err');
    btn.disabled=false;btn.innerHTML=isEdit?'Сохранить':'Создать';
  }
}

async function toggleUserActive(id,currentActive){
  const wantActive = !currentActive;
  const action = wantActive ? 'activateUser' : 'deactivateUser';
  const res = await api(action,{caller_role:U.role,id});
  if(res?.ok || res===null){
    const i = typeof UL !== 'undefined' ? UL.findIndex(x=>String(x.id)===String(id)) : -1;
    if(i >= 0) UL[i] = {...UL[i], active: wantActive};
    ACTIVE_TRANSFER_USERS=UL.filter(u=>u && u.active!==false && String(u.id)!==String(U.id));
    toast(wantActive?'Пользователь активирован':'Пользователь деактивирован');
    navigate('users');
  }else{
    toast(res?.error||'Ошибка','err');
  }
}

async function deleteUserAccount(id, name){
  if(!id)return;
  if(!confirm(`Удалить пользователя "${name||id}"? Действие необратимо.`))return;
  const res=await api('deleteUser',{caller_role:U.role,caller_id:U.id,id});
  if(res?.ok || res===null){
    UL=UL.filter(u=>String(u.id)!==String(id));
    ACTIVE_TRANSFER_USERS=UL.filter(u=>u && u.active!==false && String(u.id)!==String(U.id));
    toast('Пользователь удалён');
    navigate('users');
  }else{
    toast(res?.error||'Ошибка удаления','err');
  }
}


function initNavDelegation(){
  const nav = document.getElementById('nav');
  if(!nav || nav._vacNavDeleg) return;
  nav._vacNavDeleg = true;
  nav.addEventListener('click', (e)=>{
    const item = e.target.closest('.ni');
    if(!item || item.dataset.nav == null) return;
    navigate(item.dataset.nav);
  });
}

function initGlobalActs(){
  if(document.body._vacGlobalActs) return;
  document.body._vacGlobalActs = true;
  // Делегирование клика по ячейкам подразделения/группы в таблице оценок
  document.addEventListener('click', (ev)=>{
    const dCell=ev.target&&ev.target.closest&&ev.target.closest('td.td-val-dept');
    if(dCell){inlineEditValueField(dCell,'dept');return;}
    const gCell=ev.target&&ev.target.closest&&ev.target.closest('td.td-val-grp');
    if(gCell){inlineEditValueField(gCell,'grp');return;}
  });
  document.addEventListener('click', (ev)=>{
    const _vt=document.getElementById('vtbl');
    const sortTh=ev.target.closest('#vtbl thead th[data-sort]');
    if(_vt&&sortTh&&_vt.contains(sortTh)){
      const k=sortTh.dataset.sort;
      if(DASH_SORT.key===k)DASH_SORT.dir=DASH_SORT.dir==='asc'?'desc':'asc';
      else{DASH_SORT.key=k;DASH_SORT.dir=k==='name'||k==='status'||k==='vacancy_group'||k==='recruiter'?'asc':'desc';}
      refreshDash();
      return;
    }
    const el = ev.target.closest('[data-act]');
    if(!el) return;
    const act = el.dataset.act;
    if(act==='edit-vac'){
      const id = el.dataset.vacid;
      const v = VACS.find(x=> String(x.id)===String(id));
      if(v) openVacModal(v);
    } else if(act==='del-vac'){
      deleteVac(el.dataset.vacid, el.dataset.force==='1');
    } else if(act==='dup-vac'){
      if(window.VAC_DASH&&window.VAC_DASH.duplicateVac)window.VAC_DASH.duplicateVac(el.dataset.vacid);
    } else if(act==='quick-status'){
      // legacy alias — оставляем для обратной совместимости
      const v=VACS.find(x=>String(x.id)===String(el.dataset.vacid));
      if(v)openQuickStatusModal(v);
    } else if(act==='status-inline'){
      // Новый inline-режим: пробует inline-select; если в нём requires modal — откроет
      if(window.VAC_DASH&&window.VAC_DASH.startInlineStatus){
        window.VAC_DASH.startInlineStatus(el.dataset.vacid);
      }else{
        const v=VACS.find(x=>String(x.id)===String(el.dataset.vacid));
        if(v)openQuickStatusModal(v);
      }
    } else if(act==='vac-overlay'){
      if(ev.target===el) closeModal();
    } else if(act==='close-vac-modal'){
      closeModal();
    } else if(act==='vac-save'){
      saveVac(el.dataset.vacid || '');
    } else if(act==='qst-overlay'){
      if(ev.target===el) closeQuickStatusModal();
    } else if(act==='qst-close'){
      closeQuickStatusModal();
    } else if(act==='qst-save'){
      saveQuickStatus(el.dataset.vacid);
    } else if(act==='cl-new'){
      startNewAssessment();
    } else if(act==='cl-view'){
      viewAssessment(el.dataset.aid);
    } else if(act==='cl-list'){
      renderChecklist();
    } else if(act==='cl-s1-next'){
      clStep1Next();
    } else if(act==='cl-back-s1'){
      CL_STATE.step=1; renderCLStep1();
    } else if(act==='cl-submit'){
      clSubmit();
    } else if(act==='cl-del'){
      deleteAssessment(el.dataset.aid);
    } else if(act==='val-new'){
      openValueModal();
    } else if(act==='val-overlay'){
      if(ev.target===el)closeValueModal();
    } else if(act==='close-val-modal'){
      closeValueModal();
    } else if(act==='val-send'){
      sendValueInvite();
    } else if(act==='val-view'){
      if(U?.role==='recruiter'){
        toast('Детальный результат доступен только Администратору и Руководителю','err');
        return;
      }
      viewValueResult(el.dataset.vid);
    } else if(act==='val-filter'){
      V_PROFILE_FILTER=el.dataset.filter||'all';
      renderValuesList(document.getElementById('content'));
    } else if(act==='val-export'){
      exportValueReport(V_RESULT_CONTEXT.invite||{}, V_RESULT_CONTEXT.result||{}).catch((e)=>toast(e?.message||'Не удалось подготовить PDF-экспорт','err'));
    } else if(act==='val-export-candidate'){
      exportValueReport(V_RESULT_CONTEXT.invite||{}, V_RESULT_CONTEXT.result||{}, {candidate:true}).catch((e)=>toast(e?.message||'Не удалось подготовить PDF-экспорт','err'));
    } else if(act==='val-list'){
      renderValues();
    } else if(act==='val-del'){
      deleteValueAssessment(el.dataset.vid);
    } else if(act==='user-toggle'){
      const uid = el.getAttribute('data-uid');
      const ua = el.getAttribute('data-uactive')==='1';
      toggleUserActive(uid, ua);
    } else if(act==='user-delete'){
      deleteUserAccount(el.getAttribute('data-uid'), el.getAttribute('data-uname'));
    } else if(act==='user-new'){
      openUserModal();
    } else if(act==='user-edit'){
      const idx = Number(el.dataset.uidx);
      if(!Number.isNaN(idx) && typeof UL!=='undefined' && UL[idx]) openUserModal(UL[idx]);
    }
  });
}

function initEscClose(){
  if(document.body._vacEsc) return;
  document.body._vacEsc = true;
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    closeAllFilterDd();
    if(document.getElementById('vac-modal')) closeModal();
    if(document.getElementById('qst-modal')) closeQuickStatusModal();
    if(document.getElementById('val-modal')) closeValueModal();
    if(document.getElementById('user-modal')) closeUserModal();
  });
}

function exportCsvVacancies(){
  const rows = sortVacanciesForDash(applyF(),DASH_SORT.key,DASH_SORT.dir);
  const spec = [
    {k:'date_opened',h:'Дата открытия'},
    {k:'name',h:'Вакансия'},
    {k:'status',h:'Статус'},
    {k:'fact_date',h:'Дата закрытия'},
    {k:'vacancy_group',h:'Группа'},
    {k:'current_recruiter_name',h:'Рекрутер'},
    {k:'salary_offer',h:'ЗП оффер'},
    {k:'days_total',h:'Дней'},
    {k:'norm_days',h:'Норматив'},
  ];
  const escField = (v)=>{
    const t = (v==null?'':String(v));
    if(/[;"\n\r]/.test(t)) return '"' + t.replace(/"/g,'""') + '"';
    return t;
  };
  let csv = '\ufeff' + spec.map(x=>x.h).join(';') + '\n';
  for(const v of rows){
    csv += spec.map(x=>escField(v[x.k])).join(';') + '\n';
  }
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vacancies.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

initLoginPage();

// Автовосстановление сессии: если в localStorage есть валидный пользователь —
// сразу запускаем приложение, минуя экран входа.
(function tryRestoreSession(){
  try{
    const u=loadSession();
    if(u&&u.role){U=u;startApp();}
  }catch(e){}
})();

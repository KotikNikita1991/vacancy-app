let U=null, VACS=[], ASSESSMENTS=[], PAGE='dashboard', COLSB=false;
let PERIOD=defPeriod(), FQ='';
// Пустой массив = «все» (мультивыбор фильтров)
let FStat=[], FGrp=[], FRec=[];
const FILTER_STATUS_OPTS=['В работе','Закрыта','Приостановлена','Отменена','Передана'];
// Сортировка таблицы дашборда
let DASH_SORT={key:'date_opened',dir:'desc'};
// Планы: {recruiterId: {month(YYYY-MM): count}}
let PLANS = {};
let UL = [];

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
  if(res?.ok&&res.user){if(typeof hideBar==='function')hideBar();U=res.user;startApp();return;}
  showLErr(res?.error||(res===null?'Сервер недоступен. Попробуйте позже.':'Неверный логин или пароль'));
  rstBtn();
}
function showLErr(m){const e=document.getElementById('lerr');e.textContent=m;e.style.display='block'}
function rstBtn(){const b=document.getElementById('lbtn');b.disabled=false;b.innerHTML='Войти →'}

// ══ APP INIT ═════════════════════════════════════════
async function startApp(){
  document.getElementById('ls').style.display='none';
  document.getElementById('app').style.display='flex';
  const rc=ROLES[U.role]||{};
  const ini=U.name.split(' ').map(w=>w[0]).join('').slice(0,2);
  document.getElementById('sbav').textContent=ini;
  document.getElementById('sbav').style.background=rc.c||'#888';
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
  try{ Object.assign(PLANS, loadPlans()||{}); }catch(e){}
  initGlobalActs();
  initEscClose();
  initDocFilterDdClose();
  const rr=await api('getReference');
  if(rr?.ok){REF=rr.reference;updateGroupNorm();}
  navigate('dashboard');
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
  document.getElementById('content').innerHTML=`<div class="loading"><span class="spin spd"></span> Загружаем...</div>`;
  renderPage(page);
}
function toggleSB(){COLSB=!COLSB;document.getElementById('sidebar').classList.toggle('col',COLSB)}
function doLogout(){
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
function canEdit()   {return U.role==='manager'||U.role==='admin'}
function canCreate() {return true}
function canDelete() {return U.role==='admin'}
function canSetPlan(){return U.role==='manager'||U.role==='admin'}

// Поля, которые рекрутер НЕ может редактировать
// ══ DASHBOARD ════════════════════════════════════════
async function renderDash(){
  const vr=await api('getVacancies',{role:U.role,recruiter_id:U.id});
  VACS=vr?.ok?vr.vacancies:(U.role==='recruiter'?DV.filter(v=>v.recruiter_id===U.id||v.current_recruiter_id===U.id):DV);
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
  const showRec=U.role!=='recruiter';
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
    ${showRec?filterDdHtml('fdd-dash-rec','Рекрутеры',recNames,FRec):''}
    <button type="button" class="papply" id="btn-dash-reset">Сбросить</button>
    ${canCreate()?`<button type="button" class="btn-primary" id="btn-new-vac">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Новая вакансия
    </button>`:''}
    <button type="button" class="papply" id="btn-export-csv-vac">CSV</button>
  </div>
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
  const bx=document.getElementById('btn-export-csv-vac');
  if(bx)bx.addEventListener('click',()=>exportCsvVacancies());
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
  const showRec=U.role!=='recruiter';
  if(!vacs.length){
    el.innerHTML=`<div class="empty" style="padding:36px"><p style="color:var(--ink3)">Нет вакансий по выбранным фильтрам</p></div>`;
    return;
  }
  const sorted=sortVacanciesForDash(vacs,DASH_SORT.key,DASH_SORT.dir);
  const editTitle=canEdit()?'Редактировать':'Просмотр';
  el.innerHTML=`<table><thead><tr>
    ${thSort('date_opened','Дата')}
    ${thSort('name','Вакансия')}
    ${thSort('vacancy_group','Группа')}
    ${showRec?thSort('recruiter','Рекрутер'):''}
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
    return`<tr>
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${fru(v.date_opened)}</td>
      <td class="td-vac-name">
        <div class="vn-clamp" title="${nm}">${nm}</div>
        <div style="font-size:11px;color:var(--ink3)">${escapeHtml(v.project&&v.project!=='—'?v.project:v.department||'')}</div>
        ${v.transferred?`<div class="btag">↗ от ${escapeHtml(v.transferred_from_name||'')} · ${fru(v.transfer_date)}</div>`:''}
      </td>
      <td>${grpBadge}</td>
      ${showRec?`<td style="font-size:12px;color:var(--ink2);white-space:nowrap">${escapeHtml(v.current_recruiter_name||'')}</td>`:''}
      <td style="vertical-align:middle">
        <span class="badge ${sc}">${escapeHtml(v.status)}</span>
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
        ${canDelete()?`<button type="button" class="btn-danger" data-act="del-vac" data-vacid="${escapeHtml(v.id)}">✕</button>`:''}
      </td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ══ VACANCY MODAL ════════════════════════════════════
function openVacModal(vac=null){
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
  const recruiters=DU.filter(u=>u.role==='recruiter'&&u.id!==U.id);

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

function closeModal(){
  const m=document.getElementById('vac-modal');
  if(m)m.remove();
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

  closeModal();
  toast(isEdit?'Вакансия обновлена ✓':'Вакансия создана ✓');
  refreshDash(); // сразу обновляем таблицу без перезагрузки страницы
}

async function deleteVac(id,fromModal=false){
  if(!canDelete())return;
  if(!confirm('Удалить вакансию? Это действие нельзя отменить.'))return;
  const res=await api('deleteVacancy',{id});
  VACS=VACS.filter(v=>v.id!==id);
  if(fromModal)closeModal();
  toast('Вакансия удалена');
  refreshDash();
}

// ══ ANALYTICS ════════════════════════════════════════
async function renderAnalytics(){
  const el=document.getElementById('content');
  const vr=await api('getVacancies',{role:U.role,recruiter_id:U.id});
  const allV=vr?.ok?vr.vacancies:DV;

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
            <div class="rec-av">${r.name.charAt(0)}</div>
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

function setPlan(recId,month,val){
  const key=`${recId}::${month}`;
  PLANS[key]=Number(val)||0;
  try{ savePlans(PLANS); }catch(e){}
  // TODO: сохранить в API api('setPlan',{recruiter_id:recId,month,plan:PLANS[key]})
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
  if(!VACS.length)VACS=U.role==='recruiter'?DV.filter(v=>v.recruiter_id===U.id||v.current_recruiter_id===U.id):DV;
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
let V_RESULT_CHARTS={bar:null,circle:null};
let V_RESULT_VIEW={mode:'centered',centered:null,base:null,circleCentered:null,circleBase:null};

async function renderValues(){
  const el=document.getElementById('content');
  if(!U||!U.role){if(el)el.innerHTML='<div class="empty" style="padding:40px"><p>Сессия недоступна</p></div>';return;}
  const [rr,vr]=await Promise.all([
    api('getValueAssessments',{role:U.role,recruiter_id:U.id}),
    api('getVacancies',{role:U.role,recruiter_id:U.id}),
  ]);
  VLIST=rr?.ok?(rr.items||[]):[];
  if(vr?.ok)VACS=vr.vacancies;
  if(!VACS.length)VACS=U.role==='recruiter'?DV.filter(v=>v.recruiter_id===U.id||v.current_recruiter_id===U.id):DV;
  renderValuesList(el);
}

function renderValuesList(el){
  const statusBadge=s=>{
    if(s==='completed')return'<span class="badge sc2">Завершён</span>';
    if(s==='expired')return'<span class="badge sca">Истёк</span>';
    return'<span class="badge sw">Отправлен</span>';
  };
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <h2 style="font-size:18px;font-weight:700">Оценка ценностей (PVQ-RR)</h2>
        <p style="font-size:13px;color:var(--ink3);margin-top:2px">57 вопросов, одноразовая ссылка на 7 дней, диаграмма + круг ценностей</p>
      </div>
      <button type="button" class="btn-primary" data-act="val-new">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Новая оценка ценностей
      </button>
    </div>
    ${VLIST.length===0
      ?`<div class="card"><div class="empty" style="padding:60px">
        <div class="empty-ico" style="background:var(--accbg)"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IC.val}</svg></div>
        <h3>Нет отправленных опросов</h3><p>Создайте оценку и отправьте кандидату персональную ссылку.</p>
      </div></div>`
      :`<div class="card"><div class="tbl-wrap"><table>
        <thead><tr><th>Кандидат</th><th>Вакансия</th><th>Рекрутер</th><th>Дата отправки</th><th>Статус</th><th>Действия</th></tr></thead>
        <tbody>${VLIST.map(v=>`
          <tr>
            <td><div style="font-weight:600;font-size:13px">${escapeHtml(v.candidate_name||'')}</div><div style="font-size:11px;color:var(--ink3)">${escapeHtml(v.candidate_email||'')}</div></td>
            <td><div style="font-size:12px;color:var(--ink2)">${escapeHtml(v.vacancy_name||'—')}</div></td>
            <td><div style="font-size:12px;color:var(--ink2)">${escapeHtml(v.recruiter_name||'')}</div></td>
            <td><div style="font-size:12px;color:var(--ink3)">${escapeHtml(v.sent_at||'')}</div></td>
            <td>${statusBadge(v.status)}</td>
            <td style="white-space:nowrap"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <button type="button" class="btn-sm" data-act="val-view" data-vid="${escapeHtml(v.id)}"${(v.has_result||v.status==='completed')?'':' disabled'}>Результат</button>
              ${canDelete()?`<button type="button" class="btn-danger" data-act="val-del" data-vid="${escapeHtml(v.id)}">✕</button>`:''}
            </div></td>
          </tr>
        `).join('')}</tbody>
      </table></div></div>`
    }`;
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

function renderValueBarChart(){
  if(!V_RESULT_VIEW.centered)return;
  const mode = V_RESULT_VIEW.mode === 'base' && V_RESULT_VIEW.base ? 'base' : 'centered';
  const src = mode === 'base' ? V_RESULT_VIEW.base : V_RESULT_VIEW.centered;
  const sorted = sortBarChartDesc(src);
  const yTitle = mode === 'base' ? 'Средние баллы' : 'Отклонение от среднего';
  if(V_RESULT_CHARTS.bar)V_RESULT_CHARTS.bar.destroy();
  V_RESULT_CHARTS.bar=new Chart(document.getElementById('val-bar').getContext('2d'),{
    type:'bar',
    data:{
      labels:sorted.labels,
      datasets:[{
        label:mode === 'base' ? 'Баллы (базовые)' : 'Баллы (центрированные)',
        data:sorted.data,
        backgroundColor:'#7B5EA7'
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{maxRotation:60,minRotation:45}},
        y:{beginAtZero:false,title:{display:true,text:yTitle}}
      }
    }
  });
}

function renderValueCircleChart(){
  if(!V_RESULT_VIEW.circleCentered)return;
  const mode = V_RESULT_VIEW.mode === 'base' && V_RESULT_VIEW.circleBase ? 'base' : 'centered';
  const src = mode === 'base' ? V_RESULT_VIEW.circleBase : V_RESULT_VIEW.circleCentered;
  if(V_RESULT_CHARTS.circle)V_RESULT_CHARTS.circle.destroy();
  V_RESULT_CHARTS.circle=new Chart(document.getElementById('val-circle').getContext('2d'),{
    type:'radar',
    data:{
      labels:src.labels||[],
      datasets:[{label:'Круг ценностей',data:src.data||[],borderColor:'#7B5EA7',backgroundColor:'rgba(123,94,167,.15)',pointBackgroundColor:'#7B5EA7'}],
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{r:{angleLines:{color:'#e6e1f0'},grid:{color:'#e6e1f0'}}}}
  });
}

function openValueModal(){
  const availVacs=VACS.filter(v=>ASSESS_STATUSES.includes(v.status));
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
            <label class="flbl">Вакансия <span class="req">*</span></label>
            <select id="val-vac" class="finp">
              <option value="">— выберите вакансию —</option>
              ${availVacs.map(v=>`<option value="${escapeHtml(v.id)}" data-name="${escapeHtml(v.name)}">${escapeHtml(v.num)} — ${escapeHtml(v.name)} (${escapeHtml(v.status)})</option>`).join('')}
              <option value="__active_employee__" data-name="Действующий сотрудник">Действующий сотрудник</option>
            </select>
            <span class="field-note">Доступны вакансии со статусом «В работе» и «Приостановлена», а также «Действующий сотрудник»</span>
          </div>
          <div class="fg full">
            <label class="flbl">ФИО кандидата <span class="req">*</span></label>
            <input id="val-name" class="finp" placeholder="Иванов Иван Иванович">
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
            <label class="flbl">Email кандидата <span class="req">*</span></label>
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
}

function closeValueModal(){
  const m=document.getElementById('val-modal');
  if(m)m.remove();
}

async function sendValueInvite(){
  const vacEl=document.getElementById('val-vac');
  const vacId=vacEl?.value||'';
  const vacName=vacId?vacEl.options[vacEl.selectedIndex].dataset.name:'';
  const candidateName=(document.getElementById('val-name')?.value||'').trim();
  const sentDate=document.getElementById('val-date')?.value||'';
  const gender=document.getElementById('val-gender')?.value||'';
  const email=(document.getElementById('val-email')?.value||'').trim();
  if(!vacId||!candidateName||!sentDate||!gender||!email){
    toast('Заполните все обязательные поля','err');return;
  }
  const btn=document.getElementById('btn-send-val');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
  const res=await api('createValueAssessmentInvite',{
    vacancy_id:vacId,vacancy_name:vacName,candidate_name:candidateName,sent_date:sentDate,
    gender,email,recruiter_id:U.id,recruiter_name:U.name,
  });
  if(res?.ok){
    toast('Ссылка отправлена кандидату ✓');
    closeValueModal();
    await renderValues();
  }else{
    toast(res?.error||'Не удалось отправить ссылку','err');
    if(btn){btn.disabled=false;btn.textContent='Отправить ссылку';}
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
    if(window.Chart)return resolve();
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/chart.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Chart.js не загрузился'));
    document.head.appendChild(s);
  });
}

async function viewValueResult(id){
  const res=await api('getValueAssessmentResult',{id});
  if(!res?.ok){toast(res?.error||'Результат не найден','err');return;}
  const inv=res.invite||{};
  const r=res.result||{};
  document.getElementById('content').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <h2 style="font-size:18px;font-weight:700">${escapeHtml(inv.candidate_name||'')}</h2>
        <p style="font-size:13px;color:var(--ink3)">${escapeHtml(inv.vacancy_name||'')} · ${escapeHtml(inv.submitted_at||'')}</p>
      </div>
      <button type="button" class="btn-cancel" data-act="val-list">← К списку</button>
    </div>
    <div class="card" style="padding:12px 14px;margin-bottom:10px">
      <div style="font-size:13px;color:var(--ink2);line-height:1.7">${escapeHtml(r.interpretation||'Интерпретация будет доступна после обработки')}</div>
    </div>
    <div class="card" style="padding:10px 12px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--ink3)">Показатель:</span>
        <button type="button" class="btn-sm" data-act="val-chart-mode" data-mode="centered">Центрированные</button>
        <button type="button" class="btn-sm" data-act="val-chart-mode" data-mode="base">Базовые средние</button>
      </div>
      <div id="val-base-note" style="margin-top:8px;font-size:12px;color:var(--ink3);display:none"></div>
    </div>
    <div class="card" style="padding:12px;margin-bottom:10px;max-width:980px;margin-left:auto;margin-right:auto">
      <div class="ct" style="margin-bottom:10px">Столбчатая диаграмма ценностей</div>
      <div style="height:260px"><canvas id="val-bar"></canvas></div>
    </div>
    <div class="card" style="padding:12px;max-width:980px;margin-left:auto;margin-right:auto">
      <div class="ct" style="margin-bottom:10px">Круг ценностей</div>
      <div style="height:360px"><canvas id="val-circle"></canvas></div>
    </div>`;
  try{
    await ensureChartJs();
    if(V_RESULT_CHARTS.bar)V_RESULT_CHARTS.bar.destroy();
    if(V_RESULT_CHARTS.circle)V_RESULT_CHARTS.circle.destroy();
    const barModes=pickBarModeData(r);
    const mean57=Number(r.mean57||0);
    const circleCentered=r.circle_chart||{};
    const circleBase = circleCentered && Array.isArray(circleCentered.data)
      ? { labels:circleCentered.labels||[], data:circleCentered.data.map(v=>Number(v)+mean57), order:circleCentered.order }
      : null;
    V_RESULT_VIEW={
      mode:'base',
      centered:barModes.centered,
      base:getBaseBarData(r, barModes.centered),
      circleCentered,
      circleBase
    };
    const noteEl=document.getElementById('val-base-note');
    if(noteEl && !V_RESULT_VIEW.base){
      noteEl.style.display='block';
      noteEl.textContent='Базовые средние не удалось восстановить: backend не вернул ни сырые значения, ни общий средний балл. Показаны центрированные данные.';
    }
    renderValueBarChart();
    renderValueCircleChart();
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
  const users=res?.ok?res.users:DU;
  UL=users;

  function userRow(u){
    const rc=ROLES[u.role]||{l:u.role,c:'#888',bg:'#eee'};
    const isMe=u.id===U.id;
    // Храним данные в data-атрибуте, читаем через dataset в обработчике
    const di=users.indexOf(u);
    return '<tr>'
      +'<td><div style="display:flex;align-items:center;gap:10px">'
      +'<div style="width:32px;height:32px;border-radius:50%;background:'+rc.c+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">'+u.name.charAt(0)+'</div>'
      +'<div><div style="font-weight:600;font-size:13px">'+u.name+(isMe?' <span style="font-size:10px;color:var(--ink3)">(вы)</span>':'')+'</div></div>'
      +'</div></td>'
      +'<td style="font-size:13px;color:var(--ink2)">'+u.login+'</td>'
      +'<td><span class="badge" style="background:'+rc.bg+';color:'+rc.c+'">'+rc.l+'</span></td>'
      +'<td><span class="badge '+(u.active?'sw':'sca')+'">'+(u.active?'Активен':'Деактивирован')+'</span></td>'
      +'<td style="white-space:nowrap;display:flex;gap:6px">'
      +'<button class="btn-edit" data-uidx="'+di+'" data-act="user-edit">Изменить</button>'
      +(!isMe?'<button class="btn-sm" data-uid="'+u.id+'" data-uactive="'+(u.active!==false?'1':'0')+'" data-act="user-toggle">'+(u.active?'Деактив.':'Активировать')+'</button>':'')
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
}

function closeUserModal(){
  const m=document.getElementById('user-modal');if(m)m.remove();
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
    closeUserModal();
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
    const u = DU.find(x=>String(x.id)===String(id));
    if(u) u.active = wantActive;
    const i = typeof UL !== 'undefined' ? UL.findIndex(x=>String(x.id)===String(id)) : -1;
    if(i >= 0) UL[i] = {...UL[i], active: wantActive};
    toast(wantActive?'Пользователь активирован':'Пользователь деактивирован');
    navigate('users');
  }else{
    toast(res?.error||'Ошибка','err');
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
    } else if(act==='vac-overlay'){
      if(ev.target===el) closeModal();
    } else if(act==='close-vac-modal'){
      closeModal();
    } else if(act==='vac-save'){
      saveVac(el.dataset.vacid || '');
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
      viewValueResult(el.dataset.vid);
    } else if(act==='val-chart-mode'){
      const mode=el.dataset.mode;
      if(mode==='centered' || mode==='base'){
        V_RESULT_VIEW.mode=mode;
        renderValueBarChart();
        renderValueCircleChart();
      }
    } else if(act==='val-list'){
      renderValues();
    } else if(act==='val-del'){
      deleteValueAssessment(el.dataset.vid);
    } else if(act==='user-toggle'){
      const uid = el.getAttribute('data-uid');
      const ua = el.getAttribute('data-uactive')==='1';
      toggleUserActive(uid, ua);
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

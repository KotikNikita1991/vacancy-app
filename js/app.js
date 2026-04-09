let U=null, VACS=[], ASSESSMENTS=[], PAGE='dashboard', COLSB=false;
let PERIOD=defPeriod(), FS='Все', FR='Все', FQ='', FG='Все';
// Планы: {recruiterId: {month(YYYY-MM): count}}
let PLANS = {};
let UL = [];

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
  if(res?.ok){if(typeof hideBar==='function')hideBar();U=res.user;startApp();return;}
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
  const ttls={dashboard:'Дашборд',analytics:'Аналитика',checklist:'Оценка кандидата',users:'Пользователи'};
  document.getElementById('httl').textContent=ttls[page]||page;
  document.getElementById('content').innerHTML=`<div class="loading"><span class="spin spd"></span> Загружаем...</div>`;
  renderPage(page);
}
function toggleSB(){COLSB=!COLSB;document.getElementById('sidebar').classList.toggle('col',COLSB)}
function doLogout(){
  U=null;VACS=[];ASSESSMENTS=[];PLANS={};PERIOD=defPeriod();FS='Все';FR='Все';FQ='';FG='Все';
  document.getElementById('app').style.display='none';
  document.getElementById('ls').style.display='flex';
  document.getElementById('il').value='';
  document.getElementById('ip').value='';
  document.getElementById('lerr').style.display='none';
  rstBtn();
}

// ══ ROUTER ═══════════════════════════════════════════
async function renderPage(p){
  if(p==='dashboard')await renderDash();
  else if(p==='analytics')await renderAnalytics();
  else if(p==='checklist')await renderChecklist();
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
  const recNames=['Все',...new Set(VACS.map(v=>v.current_recruiter_name).filter(Boolean))];
  const groups=['Все',...VAC_GROUPS];
  try{
    const dp=loadDashPrefs();
    if(dp&&typeof dp==='object'){
      if(dp.PERIOD&&dp.PERIOD.from&&dp.PERIOD.to)PERIOD=dp.PERIOD;
      if(dp.FS!==undefined)FS=dp.FS;
      if(dp.FR!==undefined)FR=dp.FR;
      if(dp.FG!==undefined)FG=dp.FG;
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
  const statuses=['Все','В работе','Закрыта','Приостановлена','Отменена','Передана'];
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
    <select class="fsel" id="fst">${statuses.map(s=>`<option${s===FS?' selected':''}>${s}</option>`).join('')}</select>
    <select class="fsel" id="fgr">${groups.map(g=>`<option${g===FG?' selected':''}>${g}</option>`).join('')}</select>
    ${showRec?`<select class="fsel" id="frec">${recNames.map(r=>`<option${r===FR?' selected':''}>${r}</option>`).join('')}</select>`:''}
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
  const st=document.getElementById('fst');
  const gr=document.getElementById('fgr');
  const rc=document.getElementById('frec');
  if(fs)fs.oninput=e=>{FQ=e.target.value;saveDashPrefs();refreshDash()};
  if(st)st.onchange=e=>{FS=e.target.value;saveDashPrefs();refreshDash()};
  if(gr)gr.onchange=e=>{FG=e.target.value;saveDashPrefs();refreshDash()};
  if(rc)rc.onchange=e=>{FR=e.target.value;saveDashPrefs();refreshDash()};
  const br=document.getElementById('btn-dash-reset');
  if(br)br.addEventListener('click',()=>{resetF();});
  const bn=document.getElementById('btn-new-vac');
  if(bn)bn.addEventListener('click',()=>openVacModal());
  const bx=document.getElementById('btn-export-csv-vac');
  if(bx)bx.addEventListener('click',()=>exportCsvVacancies());
  refreshDash();
}

function resetF(){
  FS='Все';FR='Все';FQ='';FG='Все';PERIOD=defPeriod();
  saveDashPrefs();
  navigate('dashboard');
}

function applyF(){
  return VACS.filter(v=>{
    const raw=v.date_opened||'';
    if(PERIOD.from&&raw&&raw<PERIOD.from)return false;
    if(PERIOD.to&&raw&&raw>PERIOD.to)return false;
    if(FS!=='Все'&&v.status!==FS)return false;
    if(FG!=='Все'&&v.vacancy_group!==FG)return false;
    if(FR!=='Все'&&v.current_recruiter_name!==FR)return false;
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

function renderVacTbl(vacs){
  const el=document.getElementById('vtbl');if(!el)return;
  const showRec=U.role!=='recruiter';
  if(!vacs.length){
    el.innerHTML=`<div class="empty" style="padding:36px"><p style="color:var(--ink3)">Нет вакансий по выбранным фильтрам</p></div>`;
    return;
  }
  el.innerHTML=`<table><thead><tr>
    <th>№</th><th>Дата</th><th>Вакансия</th><th>Группа</th>
    ${showRec?'<th>Рекрутер</th>':''}
    <th>Статус</th><th>ЗП оффер</th><th>Дней/норм</th><th></th>
  </tr></thead><tbody>
  ${vacs.map(v=>{
    const sc=SC_MAP[v.status]||'sc2';
    const days=Number(v.days_total)||0;
    const norm=Number(v.norm_days)||0;
    const over=!v.fact_date&&days>norm&&norm>0;
    const fast=v.fact_date&&days<norm&&norm>0;
    const dc=over?'var(--red)':fast?'var(--green)':'var(--ink)';
    const grpBadge=v.vacancy_group?`<span style="font-size:10px;color:var(--ink3);background:var(--bg);padding:2px 7px;border-radius:5px;white-space:nowrap">${escapeHtml(v.vacancy_group)}</span>`:''
    return`<tr>
      <td style="font-size:12px;color:var(--ink3);font-weight:500;white-space:nowrap">${escapeHtml(v.num||'—')}</td>
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${fru(v.date_opened)}</td>
      <td>
        <div class="vn">${escapeHtml(v.name)}</div>
        <div style="font-size:11px;color:var(--ink3)">${escapeHtml(v.project&&v.project!=='—'?v.project:v.department||'')}</div>
        ${v.transferred?`<div class="btag">↗ от ${escapeHtml(v.transferred_from_name||'')} · ${fru(v.transfer_date)}</div>`:''}
      </td>
      <td>${grpBadge}</td>
      ${showRec?`<td style="font-size:12px;color:var(--ink2);white-space:nowrap">${escapeHtml(v.current_recruiter_name||'')}</td>`:''}
      <td><span class="badge ${sc}">${escapeHtml(v.status)}</span></td>
      <td style="font-size:12px;color:var(--ink2);white-space:nowrap">${escapeHtml(v.salary_offer||'—')}</td>
      <td>
        <span class="dv" style="color:${dc}">${days}д</span>
        <span class="dn">/ ${norm||'—'}</span>
        ${over?'<span class="dover" style="color:var(--red)">просрочено</span>':''}
        ${fast?'<span class="dover" style="color:var(--green)">раньше срока ✓</span>':''}
      </td>
      <td style="white-space:nowrap;display:flex;gap:4px;align-items:center">
        <button type="button" class="btn-edit" data-act="edit-vac" data-vacid="${escapeHtml(v.id)}">
          ${canEdit()?'Изменить':'Просмотр'}
        </button>
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
            <input id="f-norm" class="finp" type="number" min="1" placeholder="авто по группе" value="${v.norm_days||''}">
            <span class="field-note">Заполняется автоматически по группе вакансии</span>
          </div>
          ${canEdit()?`
          <div class="fg">
            <label class="flbl">План (дедлайн)</label>
            <input id="f-plan" class="finp" type="date" value="${v.plan_date||''}">
          </div>
          <div class="fg" id="fact-wrap">
            <label class="flbl" id="lbl-fact">Дата закрытия</label>
            <input id="f-fact" class="finp" type="date" value="${v.fact_date||''}">
          </div>`:''}

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
  // Показываем блок передачи если статус уже "Передана"
  if(v.status==='Передана')onStatusChange('Передана');
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
  let ARecFilter='Все';
  let AGroupFilter='Все';
  let ANameFilter='';
  let ADeptFilter='Все';

  const recNames=['Все',...new Set(allV.map(v=>v.current_recruiter_name).filter(Boolean))];
  const deptNames=['Все',...new Set(allV.map(v=>v.department).filter(Boolean))];
  const groups=['Все',...VAC_GROUPS];
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

    // Фильтрация по рекрутеру и доп.фильтрам
    let base=allV;
    if(ARecFilter!=='Все')base=base.filter(v=>v.current_recruiter_name===ARecFilter);
    if(AGroupFilter!=='Все')base=base.filter(v=>v.vacancy_group===AGroupFilter);
    if(ADeptFilter!=='Все')base=base.filter(v=>v.department===ADeptFilter);
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
      if(AGroupFilter!=='Все'&&v.vacancy_group!==AGroupFilter)return;
      if(ADeptFilter!=='Все'&&v.department!==ADeptFilter)return;
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
      <select class="fsel" id="a-rec">${recNames.map(r=>`<option>${r}</option>`).join('')}</select>
      <select class="fsel" id="a-grp">${groups.map(g=>`<option>${g}</option>`).join('')}</select>
      <select class="fsel" id="a-dept">${deptNames.map(d=>`<option>${d}</option>`).join('')}</select>
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
  document.getElementById('a-rec').onchange=e=>{ARecFilter=e.target.value;render()};
  document.getElementById('a-grp').onchange=e=>{AGroupFilter=e.target.value;render()};
  document.getElementById('a-dept').onchange=e=>{ADeptFilter=e.target.value;render()};
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

async function renderChecklist(){
  const el=document.getElementById('content');
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
          <thead><tr><th>Кандидат</th><th>Вакансия</th><th>Рекрутер</th><th>Дата</th><th>Балл</th><th>Рекомендация</th><th></th></tr></thead>
          <tbody>${ASSESSMENTS.map(a=>{
            const rc=a.recommendation==='Рекомендован'?'sw':a.recommendation==='Не рекомендован'?'sca':'sp';
            const pct=a.max_score>0?Math.round(a.total_score/a.max_score*100):0;
            return`<tr>
              <td><div style="font-weight:600;font-size:13px">${a.candidate_name}</div></td>
              <td><div style="font-size:12px;color:var(--ink2)">${a.vacancy_name||'—'}</div></td>
              <td><div style="font-size:12px;color:var(--ink2)">${a.recruiter_name}</div></td>
              <td><div style="font-size:12px;color:var(--ink3)">${a.interview_date}</div></td>
              <td><div style="font-size:12px;color:var(--ink3)">${Object.keys(a.scores||{}).length}/${CL_BLOCKS.length} блоков</div></td>
              <td><button type="button" class="btn-sm" data-act="cl-view" data-aid="${escapeHtml(a.id)}">Открыть</button></td>
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
            </select>
            <span class="field-note">Доступны вакансии со статусом «В работе» и «Приостановлена»</span>
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
    if(document.getElementById('vac-modal')) closeModal();
    if(document.getElementById('user-modal')) closeUserModal();
  });
}

function exportCsvVacancies(){
  const rows = applyF();
  const cols = ['num','date_opened','name','status','vacancy_group','current_recruiter_name','salary_offer','days_total','norm_days'];
  const escField = (v)=>{
    const t = (v==null?'':String(v));
    if(/[;"\n\r]/.test(t)) return '"' + t.replace(/"/g,'""') + '"';
    return t;
  };
  let csv = '\ufeff' + cols.join(';') + '\n';
  for(const v of rows){
    csv += cols.map(c=>escField(v[c])).join(';') + '\n';
  }
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vacancies.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

initLoginPage();

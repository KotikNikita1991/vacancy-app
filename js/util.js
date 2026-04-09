// util.js

function escapeHtml(s){
  if(s==null||s==='')return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function loadJson(key, fallback){
  try{
    const r = localStorage.getItem(key);
    if(r==null) return fallback;
    return JSON.parse(r);
  }catch(e){ return fallback; }
}
function saveJson(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}
function loadDashPrefs(){
  const c = (typeof VACANCY_APP!=='undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  return loadJson(c.LS_DASH_PREFS || 'vacancy_app_dash_prefs', null);
}
function saveDashPrefs(){
  const c = (typeof VACANCY_APP!=='undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  saveJson(c.LS_DASH_PREFS || 'vacancy_app_dash_prefs', { PERIOD, FS, FR, FG, FQ });
}
function loadPlans(){
  const c = (typeof VACANCY_APP!=='undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  return loadJson(c.LS_PLANS || 'vacancy_app_plans', {});
}
function savePlans(plans){
  const c = (typeof VACANCY_APP!=='undefined' && VACANCY_APP.config) ? VACANCY_APP.config : {};
  saveJson(c.LS_PLANS || 'vacancy_app_plans', plans);
}
function showDemoBar(){
  const b = document.getElementById('apibar');
  if(b) b.style.display='flex';
}
function hideBar(){
  const b = document.getElementById('apibar');
  if(b) b.style.display='none';
}
function setBarError(msg){
  const b = document.getElementById('apibar');
  if(b){ b.textContent = msg || ''; b.style.display='flex'; }
}

function defPeriod(){
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  return{from:fd(new Date(y,m,1)),to:fd(new Date(y,m+1,0))};
}
function fd(d){return`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`}
function fdt(s){
  if(!s)return'';
  if(s.includes('T'))return s.split('T')[0];
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s;
  if(/^\d{2}\.\d{2}\.\d{4}/.test(s)){const[d,m,y]=s.split('.');return`${y}-${m}-${d}`;}
  return s;
}
function p2(n){return String(n).padStart(2,'0')}
function fru(s){
  if(!s)return'';
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){const[y,m,d]=s.split('T')[0].split('-');return`${d}.${m}.${y}`}
  return s;
}
function today(){return fd(new Date())}
function calcDays(from,to){
  if(!from)return 0;
  const f=new Date(from),t=to?new Date(to):new Date();
  const d=Math.round((t-f)/(864e5));
  return Math.max(1,d);
}

function toast(msg,type='ok'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'),2800);
}


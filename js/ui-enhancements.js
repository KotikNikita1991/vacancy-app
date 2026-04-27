// ui-enhancements.js — UI/UX-улучшения Этапа 1.
// Подключается ПОСЛЕ util.js и ДО app.js, чтобы app.js мог пользоваться
// новыми хелперами (toast-стек, breadcrumbs и т.д.).
// Все функции стараются деградировать тихо: если DOM-элементов нет, ничего не ломается.
(function(){
  'use strict';

  // ═══ ТЁМНАЯ ТЕМА ═══════════════════════════════════════════
  var LS_THEME='vacancy_app_theme'; // 'light' | 'dark' | (отсутствует → системная)
  function getStoredTheme(){
    try{return localStorage.getItem(LS_THEME);}catch(e){return null;}
  }
  function systemPrefersDark(){
    try{return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){return false;}
  }
  function effectiveTheme(){
    var s=getStoredTheme();
    if(s==='light'||s==='dark')return s;
    return systemPrefersDark()?'dark':'light';
  }
  function applyTheme(t){
    var d=document.documentElement;
    if(t==='dark')d.setAttribute('data-theme','dark');
    else d.removeAttribute('data-theme');
    updateThemeButton();
  }
  function setTheme(t){
    try{
      if(t==='light'||t==='dark')localStorage.setItem(LS_THEME,t);
      else localStorage.removeItem(LS_THEME);
    }catch(e){}
    applyTheme(effectiveTheme());
  }
  function toggleTheme(){
    var cur=effectiveTheme();
    setTheme(cur==='dark'?'light':'dark');
  }
  function updateThemeButton(){
    var btn=document.getElementById('btn-theme');
    if(!btn)return;
    var dark=effectiveTheme()==='dark';
    btn.title=dark?'Переключить на светлую тему':'Переключить на тёмную тему';
    btn.innerHTML=dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  // Применяем тему как можно раньше, чтобы избежать вспышки
  applyTheme(effectiveTheme());
  // Слушаем смену системной темы (только если у пользователя нет явного выбора)
  try{
    var mq=window.matchMedia('(prefers-color-scheme: dark)');
    var mqHandler=function(){if(!getStoredTheme())applyTheme(effectiveTheme());};
    if(mq.addEventListener)mq.addEventListener('change',mqHandler);
    else if(mq.addListener)mq.addListener(mqHandler);
  }catch(e){}

  // Хелпер для вставки кнопки в шапку — вызывается из app.js startApp
  function injectThemeButton(){
    if(document.getElementById('btn-theme'))return;
    var hdr=document.getElementById('hdr');
    if(!hdr)return;
    var rightGroup=hdr.querySelector('div[style*="display:flex"]');
    if(!rightGroup)return;
    var b=document.createElement('button');
    b.type='button';
    b.id='btn-theme';
    b.className='btn-theme';
    b.addEventListener('click',toggleTheme);
    // Вставляем перед кнопкой "Выйти"
    var logout=document.getElementById('btn-logout');
    if(logout&&logout.parentNode===rightGroup)rightGroup.insertBefore(b,logout);
    else rightGroup.appendChild(b);
    updateThemeButton();
  }

  // ═══ TOAST-СТЕК с UNDO ════════════════════════════════════
  function ensureToastStack(){
    var s=document.getElementById('toast-stack');
    if(!s){
      s=document.createElement('div');
      s.id='toast-stack';
      document.body.appendChild(s);
    }
    return s;
  }
  function dismissToast(node){
    if(!node||node._gone)return;
    node._gone=true;
    if(node._timer){clearTimeout(node._timer);node._timer=null;}
    node.classList.remove('show');
    node.classList.add('hide');
    setTimeout(function(){if(node.parentNode)node.parentNode.removeChild(node);},250);
  }
  // Новая функция toast, поддерживает opts={undo, undoLabel, duration}.
  // Сохраняет старую сигнатуру toast(msg, type='ok').
  function toastNew(msg,type,opts){
    type=type||'ok';
    opts=opts||{};
    var stack=ensureToastStack();
    // Лимит — не больше 5 одновременно
    while(stack.children.length>=5){
      dismissToast(stack.firstChild);
    }
    var node=document.createElement('div');
    node.className='toast-item '+(type==='err'?'err':type==='ok'?'ok':'');
    var msgEl=document.createElement('span');
    msgEl.className='toast-msg';
    msgEl.textContent=String(msg||'');
    node.appendChild(msgEl);
    if(typeof opts.undo==='function'){
      var u=document.createElement('button');
      u.type='button';
      u.className='toast-undo';
      u.textContent=opts.undoLabel||'Отменить';
      u.addEventListener('click',function(){
        try{opts.undo();}catch(e){console.error(e);}
        dismissToast(node);
      });
      node.appendChild(u);
    }
    var x=document.createElement('button');
    x.type='button';
    x.className='toast-x';
    x.setAttribute('aria-label','Закрыть');
    x.textContent='×';
    x.addEventListener('click',function(){dismissToast(node);});
    node.appendChild(x);
    stack.appendChild(node);
    requestAnimationFrame(function(){node.classList.add('show');});
    var dur=Number(opts.duration)||(opts.undo?6000:2800);
    node._timer=setTimeout(function(){dismissToast(node);},dur);
    return node;
  }
  // Совместимая обёртка: подменяем глобальный toast, но старые вызовы продолжают работать
  window._toastLegacy=window.toast;
  window.toast=function(msg,type,opts){
    // Скрываем старый toast-элемент, если кто-то его ещё показывает
    var legacy=document.getElementById('toast');
    if(legacy)legacy.classList.remove('show');
    return toastNew(msg,type,opts);
  };

  // ═══ ХЛЕБНЫЕ КРОШКИ ═══════════════════════════════════════
  var BREADCRUMBS=[]; // [{label, onClick}]
  function setBreadcrumbs(arr){
    BREADCRUMBS=Array.isArray(arr)?arr.slice():[];
    renderBreadcrumbs();
  }
  function pushBreadcrumb(label,onClick){
    BREADCRUMBS.push({label:label,onClick:onClick||null});
    renderBreadcrumbs();
  }
  function renderBreadcrumbs(){
    var el=document.getElementById('crumbs');
    if(!el)return;
    if(!BREADCRUMBS.length){el.innerHTML='';el.style.display='none';return;}
    el.style.display='flex';
    el.innerHTML=BREADCRUMBS.map(function(c,i){
      var isLast=i===BREADCRUMBS.length-1;
      var safe=String(c.label||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var sep=i>0?'<span class="crumb-sep">/</span>':'';
      return sep+'<span class="crumb '+(isLast?'last':'')+'" data-crumb-i="'+i+'">'+safe+'</span>';
    }).join('');
    // Клики по крумбам
    Array.prototype.forEach.call(el.querySelectorAll('.crumb'),function(span){
      var idx=Number(span.dataset.crumbI);
      var c=BREADCRUMBS[idx];
      if(idx===BREADCRUMBS.length-1)return;
      if(c&&typeof c.onClick==='function'){
        span.addEventListener('click',c.onClick);
      }
    });
  }
  function injectBreadcrumbs(){
    if(document.getElementById('crumbs'))return;
    var hdr=document.getElementById('hdr');
    var ttl=document.getElementById('httl');
    if(!hdr||!ttl)return;
    var c=document.createElement('div');
    c.id='crumbs';
    c.className='crumbs';
    c.style.display='none';
    // Вставляем после заголовка httl, до правой группы
    ttl.parentNode.insertBefore(c,ttl.nextSibling);
  }

  // ═══ SKELETON LOADERS ═════════════════════════════════════
  function skeletonHtml(kind){
    if(kind==='dashboard'){
      return '<div class="skel-stats">'+
        Array(7).fill('<div class="skel skel-stat"></div>').join('')+
        '</div>'+
        '<div class="skel skel-block" style="margin-bottom:12px"></div>'+
        '<div class="card" style="overflow:hidden">'+
        '<div class="ch"><span class="skel" style="height:14px;width:140px"></span></div>'+
        Array(6).fill('<div class="skel-row">'+
          '<span class="skel w-md"></span>'+
          '<span class="skel"></span>'+
          '<span class="skel w-sm"></span>'+
          '<span class="skel w-sm"></span>'+
          '<span class="skel w-md"></span>'+
        '</div>').join('')+
        '</div>';
    }
    if(kind==='analytics'){
      return '<div class="skel-stats">'+
        Array(4).fill('<div class="skel skel-stat"></div>').join('')+
        '</div>'+
        '<div class="card" style="padding:18px;margin-bottom:14px"><div class="skel" style="height:240px"></div></div>'+
        '<div class="card" style="padding:18px"><div class="skel" style="height:160px"></div></div>';
    }
    if(kind==='checklist'||kind==='values'){
      return '<div class="skel skel-block" style="margin-bottom:12px"></div>'+
        '<div class="card" style="padding:18px">'+
        Array(5).fill('<div class="skel skel-line lg" style="margin-bottom:10px"></div>').join('')+
        '</div>';
    }
    if(kind==='users'){
      return '<div class="card" style="overflow:hidden">'+
        Array(6).fill('<div class="skel-row">'+
          '<span class="skel w-sm" style="width:32px;height:32px;border-radius:50%"></span>'+
          '<span class="skel"></span>'+
          '<span class="skel w-md"></span>'+
          '<span class="skel w-sm"></span>'+
        '</div>').join('')+
        '</div>';
    }
    return '<div class="card" style="padding:24px">'+
      Array(4).fill('<div class="skel skel-line"></div>').join('')+
      '</div>';
  }
  function showSkeleton(kind){
    var el=document.getElementById('content');
    if(!el)return;
    el.innerHTML=skeletonHtml(kind);
  }

  // ═══ FADE-АНИМАЦИЯ СТРАНИЦ ════════════════════════════════
  function fadePageIn(){
    var el=document.getElementById('content');
    if(!el)return;
    el.classList.remove('page-fade-exit');
    el.classList.add('page-fade-enter');
    requestAnimationFrame(function(){
      el.classList.add('page-fade-active');
      el.classList.remove('page-fade-enter');
      setTimeout(function(){el.classList.remove('page-fade-active');},170);
    });
  }

  // ═══ ДЕТЕРМИНИРОВАННЫЙ ЦВЕТ ПО ИМЕНИ ══════════════════════
  // Возвращает HSL-цвет, стабильный для одинаковой строки
  function colorFromName(name){
    var s=String(name||'').trim();
    if(!s)return 'hsl(260,30%,55%)';
    var h=0;
    for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}
    var hue=h%360;
    return 'hsl('+hue+',55%,52%)';
  }
  function initialsOf(name,maxLen){
    var s=String(name||'').trim();
    if(!s)return '?';
    var parts=s.split(/\s+/).filter(Boolean);
    var ini=parts.map(function(w){return w[0];}).join('').toUpperCase();
    return ini.slice(0,maxLen||2);
  }
  // Возвращает HTML <span> для аватарки заданного размера
  function avatarHtml(name,size,opts){
    opts=opts||{};
    var sz=Number(size)||32;
    var fs=Math.max(10,Math.round(sz*0.42));
    var bg=colorFromName(name);
    var ini=initialsOf(name,2);
    var cls='av-letter'+(opts.shimmer?' av-shimmer':'');
    var extra=opts.style?(' '+opts.style):'';
    return '<span class="'+cls+'" style="width:'+sz+'px;height:'+sz+'px;background:'+bg+';font-size:'+fs+'px;'+extra+'" title="'+String(name||'').replace(/"/g,'&quot;')+'">'+ini+'</span>';
  }

  // ═══ ПОДТВЕРЖДЕНИЕ ЗАКРЫТИЯ МОДАЛКИ С ИЗМЕНЕНИЯМИ ═════════
  // Снимок значений всех input/select/textarea внутри модалки
  function snapshotModal(modalEl){
    if(!modalEl)return '';
    var fields=modalEl.querySelectorAll('input, select, textarea');
    var snap=[];
    Array.prototype.forEach.call(fields,function(f){
      if(f.type==='checkbox'||f.type==='radio')snap.push(f.id+'='+(f.checked?'1':'0'));
      else snap.push(f.id+'='+(f.value||''));
    });
    return snap.join('|');
  }
  // Сохранить начальное состояние, чтобы потом сравнить
  function trackModalDirty(modalEl){
    if(!modalEl)return;
    // Откладываем — поля могут заполняться асинхронно
    setTimeout(function(){
      modalEl._initialSnap=snapshotModal(modalEl);
    },50);
  }
  function isModalDirty(modalEl){
    if(!modalEl)return false;
    if(modalEl._forceClean)return false;
    if(modalEl._initialSnap==null)return false;
    return snapshotModal(modalEl)!==modalEl._initialSnap;
  }
  function markModalClean(modalEl){
    if(!modalEl)return;
    modalEl._forceClean=true;
  }
  // Обёртка: возвращает true, если можно закрывать (либо чисто, либо подтверждено)
  function confirmModalClose(modalEl){
    if(!modalEl)return true;
    if(!isModalDirty(modalEl))return true;
    return window.confirm('Есть несохранённые изменения. Закрыть без сохранения?');
  }

  // ═══ ФИЛЬТРЫ В URL (для дашборда) ═════════════════════════
  // Сериализуем компактно: ?st=...&gr=...&rec=...&q=...&from=...&to=...
  function buildUrlFromFilters(){
    try{
      var p=new URLSearchParams();
      if(typeof FStat!=='undefined'&&FStat.length)p.set('st',FStat.join(','));
      if(typeof FGrp!=='undefined'&&FGrp.length)p.set('gr',FGrp.join(','));
      if(typeof FRec!=='undefined'&&FRec.length)p.set('rec',FRec.join(','));
      if(typeof FQ!=='undefined'&&FQ)p.set('q',FQ);
      if(typeof PERIOD!=='undefined'&&PERIOD&&PERIOD.from){p.set('from',PERIOD.from);p.set('to',PERIOD.to);}
      if(typeof PAGE!=='undefined'&&PAGE&&PAGE!=='dashboard')p.set('p',PAGE);
      // debug-флаг сохраняем
      try{
        var cur=new URLSearchParams(location.search);
        if(cur.get('debug'))p.set('debug',cur.get('debug'));
      }catch(e2){}
      var qs=p.toString();
      var url=location.pathname+(qs?('?'+qs):'')+location.hash;
      history.replaceState(null,'',url);
    }catch(e){}
  }
  function readFiltersFromUrl(){
    try{
      var p=new URLSearchParams(location.search);
      var out={};
      if(p.has('st'))out.FStat=p.get('st').split(',').filter(Boolean);
      if(p.has('gr'))out.FGrp=p.get('gr').split(',').filter(Boolean);
      if(p.has('rec'))out.FRec=p.get('rec').split(',').filter(Boolean);
      if(p.has('q'))out.FQ=p.get('q');
      if(p.has('from')&&p.has('to'))out.PERIOD={from:p.get('from'),to:p.get('to')};
      if(p.has('p'))out.PAGE=p.get('p');
      return out;
    }catch(e){return {};}
  }

  // ═══ ГОРЯЩИЕ ВАКАНСИИ — определение классов ═══════════════
  // Возвращает '' / 'vac-warn' / 'vac-hot'
  function vacancyHeatClass(v){
    if(!v)return '';
    if(typeof FINAL_STATUSES!=='undefined'&&FINAL_STATUSES.indexOf(v.status)!==-1)return '';
    var days=Number(v.days_total)||0;
    var norm=Number(v.norm_days)||0;
    if(norm>0){
      if(days>norm)return 'vac-hot';
      if(days>=Math.round(norm*0.85))return 'vac-warn';
    }else{
      // Без норматива — эвристика по 30 дням
      if(days>30)return 'vac-hot';
      if(days>=21)return 'vac-warn';
    }
    return '';
  }

  // ═══ КОМАНДНАЯ ПАЛИТРА Ctrl+K ═════════════════════════════
  var CMDK_OPEN=false, CMDK_QUERY='', CMDK_SEL=0, CMDK_RESULTS=[];
  function cmdkClose(){
    var ov=document.getElementById('cmdk-ov');
    if(ov)ov.remove();
    CMDK_OPEN=false;
  }
  function cmdkOpen(){
    if(CMDK_OPEN)return;
    // Не открывать, если пользователь не залогинен
    if(typeof U==='undefined'||!U||!U.role)return;
    CMDK_OPEN=true;
    CMDK_QUERY='';
    CMDK_SEL=0;
    var ov=document.createElement('div');
    ov.className='cmdk-overlay';
    ov.id='cmdk-ov';
    ov.innerHTML=
      '<div class="cmdk" role="dialog" aria-label="Командная палитра">'+
        '<div class="cmdk-input-wrap">'+
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
          '<input id="cmdk-input" class="cmdk-input" placeholder="Поиск по вакансиям, страницам, пользователям…" autocomplete="off">'+
          '<span class="cmdk-hint">esc</span>'+
        '</div>'+
        '<div id="cmdk-list" class="cmdk-list"></div>'+
        '<div class="cmdk-foot">'+
          '<span><kbd>↑</kbd><kbd>↓</kbd>навигация</span>'+
          '<span><kbd>↵</kbd>выбрать</span>'+
          '<span><kbd>esc</kbd>закрыть</span>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)cmdkClose();});
    var inp=document.getElementById('cmdk-input');
    inp.addEventListener('input',function(){CMDK_QUERY=inp.value;cmdkRender();});
    inp.addEventListener('keydown',cmdkKey);
    setTimeout(function(){inp.focus();},10);
    cmdkRender();
  }
  function cmdkBuildItems(query){
    var q=String(query||'').trim().toLowerCase();
    var items=[];
    // 1) Страницы
    var pages=[];
    if(typeof NCFG!=='undefined'&&typeof U!=='undefined'&&U&&NCFG[U.role]){
      pages=NCFG[U.role].map(function(it){
        return {kind:'page',id:it.id,title:it.lbl,subtitle:'Перейти к разделу',tag:'Раздел',action:function(){if(typeof navigate==='function')navigate(it.id);}};
      });
    }
    // 2) Вакансии
    var vacs=[];
    if(typeof VACS!=='undefined'&&Array.isArray(VACS)){
      vacs=VACS.map(function(v){
        return {kind:'vac',id:v.id,title:v.name||'(без названия)',subtitle:[v.vacancy_group,v.current_recruiter_name,v.status].filter(Boolean).join(' · '),tag:'Вакансия',action:function(){
          if(typeof navigate==='function'&&typeof PAGE!=='undefined'&&PAGE!=='dashboard')navigate('dashboard');
          setTimeout(function(){if(typeof openVacModal==='function')openVacModal(v);},100);
        }};
      });
    }
    // 3) Пользователи
    var users=[];
    if(typeof UL!=='undefined'&&Array.isArray(UL)&&typeof U!=='undefined'&&U&&(U.role==='admin'||U.role==='manager')){
      users=UL.map(function(u){
        return {kind:'usr',id:u.id,title:u.name||u.login,subtitle:(u.role||'')+' · '+(u.login||''),tag:'Пользователь',action:function(){if(typeof navigate==='function')navigate('users');}};
      });
    }
    // Фильтрация
    var pool=pages.concat(vacs).concat(users);
    if(!q){
      items=pages.slice(0,10).concat(vacs.slice(0,10));
    }else{
      items=pool.filter(function(it){
        return (it.title||'').toLowerCase().indexOf(q)!==-1
          || (it.subtitle||'').toLowerCase().indexOf(q)!==-1;
      }).slice(0,40);
    }
    return items;
  }
  function cmdkRender(){
    var list=document.getElementById('cmdk-list');
    if(!list)return;
    CMDK_RESULTS=cmdkBuildItems(CMDK_QUERY);
    if(!CMDK_RESULTS.length){
      list.innerHTML='<div class="cmdk-empty">Ничего не найдено</div>';
      return;
    }
    if(CMDK_SEL>=CMDK_RESULTS.length)CMDK_SEL=0;
    var html='';
    var lastKind='';
    CMDK_RESULTS.forEach(function(it,i){
      if(it.kind!==lastKind){
        var label=it.kind==='page'?'Разделы':it.kind==='vac'?'Вакансии':it.kind==='usr'?'Пользователи':'';
        if(label)html+='<div class="cmdk-group">'+label+'</div>';
        lastKind=it.kind;
      }
      var ico=it.kind==='page'?'§':it.kind==='vac'?'V':it.kind==='usr'?'U':'•';
      var safe=function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
      html+='<div class="cmdk-item'+(i===CMDK_SEL?' cmdk-active':'')+'" data-i="'+i+'">'+
        '<div class="cmdk-item-ico">'+ico+'</div>'+
        '<div class="cmdk-item-main">'+
          '<div class="cmdk-item-ttl">'+safe(it.title)+'</div>'+
          (it.subtitle?'<div class="cmdk-item-sub">'+safe(it.subtitle)+'</div>':'')+
        '</div>'+
        '<span class="cmdk-item-tag">'+safe(it.tag)+'</span>'+
      '</div>';
    });
    list.innerHTML=html;
    Array.prototype.forEach.call(list.querySelectorAll('.cmdk-item'),function(el){
      el.addEventListener('click',function(){
        var i=Number(el.dataset.i);
        cmdkPick(i);
      });
      el.addEventListener('mousemove',function(){
        var i=Number(el.dataset.i);
        if(i!==CMDK_SEL){CMDK_SEL=i;cmdkUpdateActive();}
      });
    });
  }
  function cmdkUpdateActive(){
    var list=document.getElementById('cmdk-list');
    if(!list)return;
    Array.prototype.forEach.call(list.querySelectorAll('.cmdk-item'),function(el,i){
      el.classList.toggle('cmdk-active',i===CMDK_SEL);
    });
    // Прокрутить в видимую область
    var act=list.querySelector('.cmdk-item.cmdk-active');
    if(act&&act.scrollIntoView)act.scrollIntoView({block:'nearest'});
  }
  function cmdkPick(i){
    var it=CMDK_RESULTS[i];
    if(!it)return;
    cmdkClose();
    try{it.action();}catch(e){console.error(e);}
  }
  function cmdkKey(e){
    if(e.key==='Escape'){e.preventDefault();cmdkClose();return;}
    if(e.key==='ArrowDown'){e.preventDefault();CMDK_SEL=Math.min(CMDK_SEL+1,CMDK_RESULTS.length-1);cmdkUpdateActive();return;}
    if(e.key==='ArrowUp'){e.preventDefault();CMDK_SEL=Math.max(CMDK_SEL-1,0);cmdkUpdateActive();return;}
    if(e.key==='Enter'){e.preventDefault();cmdkPick(CMDK_SEL);return;}
  }
  // Глобальный хоткей
  document.addEventListener('keydown',function(e){
    var isCmdK=(e.key==='k'||e.key==='K')&&(e.ctrlKey||e.metaKey);
    if(isCmdK){
      e.preventDefault();
      if(CMDK_OPEN)cmdkClose();else cmdkOpen();
    }
  });

  // ═══ HOVER-ПРЕВЬЮ ВАКАНСИИ В ТАБЛИЦЕ ═════════════════════
  var PREVIEW_EL=null, PREVIEW_TIMER=null;
  function previewHide(){
    if(PREVIEW_TIMER){clearTimeout(PREVIEW_TIMER);PREVIEW_TIMER=null;}
    if(PREVIEW_EL){PREVIEW_EL.classList.remove('show');var el=PREVIEW_EL;setTimeout(function(){if(el&&el.parentNode)el.parentNode.removeChild(el);},150);PREVIEW_EL=null;}
  }
  function previewShow(vac,anchorRect){
    previewHide();
    if(!vac)return;
    var el=document.createElement('div');
    el.className='vac-preview';
    var safe=function(s){return String(s||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    var fruR=function(d){return typeof fru==='function'?fru(d):(d||'—');};
    var sc=(typeof SC_MAP!=='undefined'&&SC_MAP[vac.status])||'sc2';
    el.innerHTML=
      '<div class="vac-preview-ttl">'+safe(vac.name)+'</div>'+
      '<div class="vac-preview-meta">'+
        '<span class="badge '+sc+'">'+safe(vac.status)+'</span>'+
        (vac.vacancy_group?'<span style="font-size:10px;color:var(--ink3);background:var(--bg);padding:2px 7px;border-radius:5px">'+safe(vac.vacancy_group)+'</span>':'')+
      '</div>'+
      '<div class="vac-preview-row"><span>Подразделение</span><b>'+safe(vac.department)+'</b></div>'+
      (vac.project&&vac.project!=='—'?'<div class="vac-preview-row"><span>Проект</span><b>'+safe(vac.project)+'</b></div>':'')+
      '<div class="vac-preview-row"><span>Рекрутер</span><b>'+safe(vac.current_recruiter_name)+'</b></div>'+
      '<div class="vac-preview-row"><span>Открыта</span><b>'+fruR(vac.date_opened)+'</b></div>'+
      (vac.fact_date?'<div class="vac-preview-row"><span>Закрыта</span><b>'+fruR(vac.fact_date)+'</b></div>':'')+
      '<div class="vac-preview-row"><span>Дней / норм</span><b>'+(Number(vac.days_total)||0)+(vac.norm_days?' / '+vac.norm_days:'')+'</b></div>'+
      (vac.salary_offer?'<div class="vac-preview-row"><span>ЗП оффер</span><b>'+safe(vac.salary_offer)+'</b></div>':'')+
      (vac.comment?'<div class="vac-preview-cmt">'+safe(vac.comment)+'</div>':'');
    document.body.appendChild(el);
    // Позиционирование: справа от строки, либо слева, если не помещается
    var w=300, h=el.offsetHeight||200;
    var top=Math.max(8,Math.min(window.innerHeight-h-8,anchorRect.top));
    var left=anchorRect.right+12;
    if(left+w>window.innerWidth-8)left=Math.max(8,anchorRect.left-w-12);
    el.style.top=top+'px';
    el.style.left=left+'px';
    PREVIEW_EL=el;
    requestAnimationFrame(function(){el.classList.add('show');});
  }
  // Делегирование hover ТОЛЬКО на ячейку «Вакансия» (.td-vac-name)
  // — чтобы превью не вылезало при наведении на статус, чекбоксы, действия.
  document.addEventListener('mouseenter',function(e){
    var td=e.target&&e.target.closest&&e.target.closest('#vtbl tbody td.td-vac-name');
    if(!td)return;
    var tr=td.parentNode;
    if(!tr||!tr.dataset||!tr.dataset.vacid)return;
    if(typeof VACS==='undefined')return;
    var vac=VACS.find(function(x){return String(x.id)===String(tr.dataset.vacid);});
    if(!vac)return;
    PREVIEW_TIMER=setTimeout(function(){
      var rect=td.getBoundingClientRect();
      previewShow(vac,rect);
    },400);
  },true);
  document.addEventListener('mouseleave',function(e){
    var td=e.target&&e.target.closest&&e.target.closest('#vtbl tbody td.td-vac-name');
    if(!td)return;
    previewHide();
  },true);
  // Скрываем превью при скролле/клике
  document.addEventListener('scroll',function(){previewHide();},true);
  document.addEventListener('click',function(){previewHide();},true);

  // ═══ ЭКСПОРТ В global ═════════════════════════════════════
  window.VAC_UI=window.VAC_UI||{};
  window.VAC_UI.theme={apply:applyTheme,set:setTheme,toggle:toggleTheme,effective:effectiveTheme,injectButton:injectThemeButton};
  window.VAC_UI.toast=toastNew;
  window.VAC_UI.crumbs={set:setBreadcrumbs,push:pushBreadcrumb,inject:injectBreadcrumbs};
  window.VAC_UI.skeleton={show:showSkeleton,html:skeletonHtml};
  window.VAC_UI.fade=fadePageIn;
  window.VAC_UI.color=colorFromName;
  window.VAC_UI.initials=initialsOf;
  window.VAC_UI.avatarHtml=avatarHtml;
  window.VAC_UI.modal={track:trackModalDirty,confirmClose:confirmModalClose,markClean:markModalClean,isDirty:isModalDirty};
  window.VAC_UI.url={write:buildUrlFromFilters,read:readFiltersFromUrl};
  window.VAC_UI.vacancyHeatClass=vacancyHeatClass;
  window.VAC_UI.cmdk={open:cmdkOpen,close:cmdkClose};
})();

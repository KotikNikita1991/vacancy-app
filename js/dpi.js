// dpi.js — Модуль «Деструкторы» (DPI-R)
(function(g){
  'use strict';

  var DPI_INVITE_LIST = [];
  var DPI_RESULT_CONTEXT = {invite:null, result:null};

  // ══ HELPERS ═══════════════════════════════════════════
  function escH(s){if(s==null||s==='')return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function callApi(action,data){if(typeof api==='function')return api(action,data);return Promise.resolve({ok:false,error:'API недоступен'});}
  function showToast(msg,type){if(typeof toast==='function')toast(msg,type);}

  function seededShuffle(arr,seed){
    var a=arr.slice(), s=seed|1;
    for(var i=a.length-1;i>0;i--){
      s=((Math.imul?Math.imul(1664525,s):(1664525*s))+1013904223)|0;
      var j=Math.abs(s)%(i+1), t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }
  function tokenSeed(token){
    var h=0;
    for(var i=0;i<(token||'').length;i++) h=(((Math.imul?Math.imul(31,h):(31*h))|0)+token.charCodeAt(i))|0;
    return Math.abs(h)||1;
  }
  function loadDpiProgress(token){try{var r=localStorage.getItem('dpi_prog_'+token);return r?JSON.parse(r):null;}catch(e){return null;}}
  function saveDpiProgress(token,answers){try{localStorage.setItem('dpi_prog_'+token,JSON.stringify({answers:answers,ts:Date.now()}));}catch(e){}}
  function clearDpiProgress(token){try{localStorage.removeItem('dpi_prog_'+token);}catch(e){}}

  function statusBadge(st){
    var m={sent:['Ожидание','#B7791F','#fff6dd'],completed:['Завершён','#2FAE7B','#e6f9f2'],expired:['Истёк','#9CA3AF','#F3F4F6']};
    var t=m[st]||['—','#9CA3AF','#F3F4F6'];
    return '<span class="val-status" style="background:'+t[2]+';color:'+t[1]+'">'+t[0]+'</span>';
  }


  // ══ PUBLIC FORM ════════════════════════════════════════
  function checkPublicForm(){
    var qs;try{qs=new URLSearchParams(location.search);}catch(e){return;}
    var token=qs.get('dpi_token');
    if(!token)return;
    var ls=document.getElementById('ls');
    var app=document.getElementById('app');
    var pg=document.getElementById('dpi-form-pg');
    if(ls)ls.style.display='none';
    if(app)app.style.display='none';
    if(pg){pg.style.display='flex';renderDpiPublicForm(token,pg);}
  }

  async function renderDpiPublicForm(token,container){
    container.innerHTML='<div class="dpi-pg-loading"><span class="spin spd"></span> Загружаем опрос…</div>';
    var res=await callApi('startDpiSurvey',{token:token});
    if(!res||!res.ok){
      if(res&&res.already_done){
        container.innerHTML='<div class="dpi-pg-msg dpi-pg-msg--ok"><div class="dpi-pg-ico">✓</div>'+
          '<h2>Опрос уже завершён</h2><p>Ваши ответы были успешно сохранены ранее. Спасибо за участие!</p></div>';
      } else {
        container.innerHTML='<div class="dpi-pg-msg dpi-pg-msg--err"><div class="dpi-pg-ico">⚠</div>'+
          '<h2>'+escH(res&&res.error?res.error:'Ссылка недействительна')+'</h2>'+
          '<p>Обратитесь к специалисту по подбору персонала.</p></div>';
      }
      return;
    }
    var invite=res.invite;
    var D=g.DPI_DATA;
    var allQ=D.QUESTIONS.concat(D.IM_QUESTIONS.map(function(q){return {n:q.n,text:q.text,scale:'IM'};}));
    var questions=seededShuffle(allQ,tokenSeed(token));
    var saved=loadDpiProgress(token);
    var answers=saved?saved.answers:{};
    renderDpiForm(container,token,invite,questions,answers);
  }

  function renderDpiForm(container,token,invite,questions,answers){
    var total=questions.length;
    var OPTS=['Совершенно не подходит','Скорее не подходит','Скорее подходит','Полностью подходит'];
    var answered=Object.keys(answers).length;
    var pct=Math.round(answered/total*100);

    var qHtml=questions.map(function(q,idx){
      var ans=Number(answers[q.n])||0;
      var radios=OPTS.map(function(lbl,li){
        var v=li+1;
        var chk=ans===v?' checked':'';
        return '<label class="dpi-opt'+(ans===v?' dpi-opt--sel':'')+'">'+
          '<input type="radio" name="dq_'+q.n+'" value="'+v+'"'+chk+' data-qn="'+q.n+'">'+
          '<span class="dpi-opt-num">'+v+'</span>'+
          '<span class="dpi-opt-lbl">'+escH(lbl)+'</span>'+
        '</label>';
      }).join('');
      return '<div class="dpi-qcard'+(ans?' dpi-qcard--done':'')+'" id="dqc_'+q.n+'">'+
        '<div class="dpi-qnum">'+(idx+1)+'</div>'+
        '<div class="dpi-qbody">'+
          '<div class="dpi-qtext">'+escH(q.text)+'</div>'+
          '<div class="dpi-opts">'+radios+'</div>'+
        '</div>'+
      '</div>';
    }).join('');

    container.innerHTML='<div class="dpi-form-wrap">'+
      '<div class="dpi-form-hdr">'+
        '<div class="dpi-form-logo-ico">ДПИ</div>'+
        '<div>'+
          '<h1 class="dpi-form-title">Опросник деструкторов (DPI-R)</h1>'+
          '<p class="dpi-form-sub">Здравствуйте, <b>'+escH(invite.candidate_name||'участник')+'</b>! '+
          'Ответьте честно на все '+total+' утверждений, опираясь на поведение на работе.</p>'+
        '</div>'+
      '</div>'+
      '<div class="dpi-form-progress">'+
        '<div class="dpi-progress-bar"><div class="dpi-progress-fill" id="dpi-pfill" style="width:'+pct+'%"></div></div>'+
        '<span class="dpi-progress-cnt" id="dpi-pcnt">'+answered+' / '+total+'</span>'+
      '</div>'+
      '<div class="dpi-scale-legend">'+
        OPTS.map(function(l,i){return '<span><b>'+(i+1)+'</b> — '+escH(l)+'</span>';}).join('&nbsp; ·&nbsp; ')+
      '</div>'+
      '<div id="dpi-qlist">'+qHtml+'</div>'+
      '<div class="dpi-form-footer">'+
        '<div id="dpi-sub-err" class="dpi-sub-err" style="display:none"></div>'+
        '<button type="button" class="dpi-submit-btn" id="dpi-submit-btn">Отправить ответы →</button>'+
      '</div>'+
    '</div>';

    document.getElementById('dpi-qlist').addEventListener('change',function(ev){
      var inp=ev.target;
      if(inp.type!=='radio')return;
      var qn=Number(inp.dataset.qn), v=Number(inp.value);
      answers[qn]=v;
      saveDpiProgress(token,answers);
      var card=document.getElementById('dqc_'+qn);
      if(card){
        card.classList.add('dpi-qcard--done');
        card.querySelectorAll('.dpi-opt').forEach(function(lbl){
          lbl.classList.toggle('dpi-opt--sel',Number(lbl.querySelector('input').value)===v);
        });
      }
      var ac=Object.keys(answers).length;
      var pf=document.getElementById('dpi-pfill');
      var pc=document.getElementById('dpi-pcnt');
      if(pf)pf.style.width=Math.round(ac/total*100)+'%';
      if(pc)pc.textContent=ac+' / '+total;
    });

    document.getElementById('dpi-submit-btn').addEventListener('click',function(){
      submitDpiPublicForm(token,answers,questions,container);
    });
  }

  async function submitDpiPublicForm(token,answers,questions,container){
    var total=questions.length;
    var answered=Object.keys(answers).length;
    var errEl=document.getElementById('dpi-sub-err');
    if(answered<total){
      if(errEl){errEl.textContent='Пожалуйста, ответьте на все утверждения. Осталось: '+(total-answered);errEl.style.display='';}
      for(var i=0;i<questions.length;i++){
        if(!answers[questions[i].n]){
          var el=document.getElementById('dqc_'+questions[i].n);
          if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
          break;
        }
      }
      return;
    }
    var btn=document.getElementById('dpi-submit-btn');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span> Отправляем…';}
    var res=await callApi('submitDpiSurvey',{token:token,answers:answers});
    if(res&&res.ok){
      clearDpiProgress(token);
      container.innerHTML='<div class="dpi-pg-msg dpi-pg-msg--ok"><div class="dpi-pg-ico">✓</div>'+
        '<h2>Опрос завершён!</h2><p>Ваши ответы успешно сохранены. Спасибо за участие!</p></div>';
    } else {
      if(btn){btn.disabled=false;btn.innerHTML='Отправить ответы →';}
      if(errEl){errEl.textContent=(res&&res.error)||'Не удалось отправить. Попробуйте снова.';errEl.style.display='';}
    }
  }

  // ══ ADMIN LIST ═════════════════════════════════════════
  async function renderDpiList(el){
    if(!el)return;
    el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем…</div>';
    var rr=await callApi('getDpiAssessments',{role:g.U?g.U.role:'',recruiter_id:g.U?g.U.id:''});
    DPI_INVITE_LIST=rr&&rr.ok?(rr.items||[]):[];
    buildDpiListHtml(el);
  }

  function buildDpiListHtml(el){
    var canDel=g.U&&g.U.role==='admin';
    var rows=DPI_INVITE_LIST.map(function(it){
      var del=canDel?'<button class="btn-icon" data-act="dpi-del" data-did="'+escH(it.id)+'" title="Удалить" style="color:#E35B6A;font-size:16px;line-height:1;padding:2px 6px">×</button>':'';
      var view=it.has_result
        ?'<button class="btn-sm" data-act="dpi-view" data-did="'+escH(it.id)+'">Результат</button>'
        :'<span style="color:var(--ink3);font-size:12px">Нет данных</span>';
      return '<tr>'+
        '<td>'+escH(it.candidate_name||'—')+'</td>'+
        '<td>'+escH(it.department||'—')+'</td>'+
        '<td>'+escH(it.employee_group||'—')+'</td>'+
        '<td>'+statusBadge(it.status)+'</td>'+
        '<td>'+escH(it.sent_at||'—')+'</td>'+
        '<td><div style="display:flex;gap:6px;align-items:center">'+view+del+'</div></td>'+
      '</tr>';
    }).join('');

    el.innerHTML='<div class="card">'+
      '<div class="card-hdr" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<div>'+
          '<div class="card-title">Деструкторы — DPI-R</div>'+
          '<div style="font-size:13px;color:var(--ink3);margin-top:4px">Оценка личностных деструкторов руководителей и специалистов (20 шкал · 6 кластеров · 110 утверждений)</div>'+
        '</div>'+
        '<button type="button" class="btn-primary" data-act="dpi-new">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          ' Новая оценка'+
        '</button>'+
      '</div>'+
      (DPI_INVITE_LIST.length===0
        ?'<div class="empty" style="padding:48px 0"><p style="color:var(--ink3)">Нет оценок. Нажмите «Новая оценка», чтобы отправить приглашение.</p></div>'
        :'<div class="tbl-wrap"><table class="tbl"><thead><tr>'+
          '<th>Сотрудник</th><th>Подразделение</th><th>Группа</th><th>Статус</th><th>Дата</th><th>Действия</th>'+
          '</tr></thead><tbody>'+rows+'</tbody></table></div>'
      )+
    '</div>';
  }

  // ══ SEND INVITE MODAL ══════════════════════════════════
  function openDpiModal(){
    var REF=g.REF||{};
    var depts=Array.isArray(REF['Подразделения'])&&REF['Подразделения'].length?REF['Подразделения']:['IT','Финансы','Продажи','HR','Производство'];
    var groups=Array.isArray(REF['Группы'])&&REF['Группы'].length?REF['Группы']:['ТОП','Офис','Рабочий','Линейный'];
    var today=new Date().toISOString().slice(0,10);
    var dOpts=depts.map(function(d){return'<option>'+escH(d)+'</option>';}).join('');
    var gOpts=groups.map(function(g){return'<option>'+escH(g)+'</option>';}).join('');
    var html='<div class="modal-overlay" id="dpi-modal" data-act="dpi-overlay">'+
      '<div class="modal" style="max-width:480px">'+
        '<div class="modal-hdr"><span class="modal-ttl">Новая оценка деструкторов</span></div>'+
        '<div class="modal-body" style="display:flex;flex-direction:column;gap:14px">'+
          '<div class="fg">'+
            '<label class="flbl">ФИО сотрудника <span class="req">*</span></label>'+
            '<input id="dpi-nm" class="finp" placeholder="Иванов Иван Иванович" autocomplete="off">'+
          '</div>'+
          '<div class="fg">'+
            '<label class="flbl">Подразделение <span class="req">*</span></label>'+
            '<select id="dpi-dp" class="finp"><option value="">— выберите —</option>'+dOpts+'</select>'+
          '</div>'+
          '<div class="fg">'+
            '<label class="flbl">Группа <span class="req">*</span></label>'+
            '<select id="dpi-gr" class="finp"><option value="">— выберите —</option>'+gOpts+'</select>'+
          '</div>'+
          '<div class="fg">'+
            '<label class="flbl">E-mail <span class="req">*</span></label>'+
            '<input id="dpi-em" class="finp" type="email" placeholder="ivanov@company.ru" autocomplete="off">'+
          '</div>'+
          '<div class="fg">'+
            '<label class="flbl">Дата направления <span class="req">*</span></label>'+
            '<input id="dpi-dt" class="finp" type="date" value="'+today+'">'+
          '</div>'+
        '</div>'+
        '<div class="modal-footer">'+
          '<button type="button" class="btn-cancel" data-act="close-dpi-modal">Отмена</button>'+
          '<button type="button" class="btn-save" id="btn-dpi-send" data-act="dpi-send">Отправить ссылку</button>'+
        '</div>'+
      '</div>'+
    '</div>';
    document.body.insertAdjacentHTML('beforeend',html);
  }

  function closeDpiModal(){var m=document.getElementById('dpi-modal');if(m)m.remove();}

  async function sendDpiInvite(){
    var name=(document.getElementById('dpi-nm')?.value||'').trim();
    var dept=(document.getElementById('dpi-dp')?.value||'').trim();
    var group=(document.getElementById('dpi-gr')?.value||'').trim();
    var email=(document.getElementById('dpi-em')?.value||'').trim().toLowerCase();
    var date=document.getElementById('dpi-dt')?.value||'';
    if(!name||!dept||!group||!email||!date){showToast('Заполните все обязательные поля','err');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){showToast('Некорректный e-mail адрес','err');return;}
    var btn=document.getElementById('btn-dpi-send');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
    var res=await callApi('createDpiInvite',{
      candidate_name:name, department:dept, employee_group:group,
      email:email, sent_date:date,
      recruiter_id:g.U?g.U.id:'', recruiter_name:g.U?g.U.name:'',
    });
    if(res&&res.ok){
      showToast('Ссылка отправлена ✓');
      closeDpiModal();
      await renderDpiList(document.getElementById('content'));
    } else {
      showToast((res&&res.error)||'Не удалось отправить ссылку','err');
      if(btn){btn.disabled=false;btn.textContent='Отправить ссылку';}
    }
  }

  // ══ VIEW RESULT ════════════════════════════════════════
  async function viewDpiResult(id){
    if(!id)return;
    var el=document.getElementById('content');
    if(el)el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем результат…</div>';
    var res=await callApi('getDpiAssessmentResult',{id:id,role:g.U?g.U.role:''});
    if(!res||!res.ok){showToast((res&&res.error)||'Не удалось загрузить результат','err');renderDpiList(el);return;}
    DPI_RESULT_CONTEXT={invite:res.invite,result:res.result};
    renderDpiResultView(el,res.invite,res.result);
  }

  function renderDpiResultView(el,invite,result){
    var D=g.DPI_DATA;
    var scales=result.scales||{};
    var clusters=result.clusters||{};
    var im=result.im||{};
    var imLvl=D.getImLevel(im.sum||0);
    var imPct=Math.min(100,Math.round(((im.sum||10)-10)/30*100));

    // ── Верхняя сетка: IM-диаграмма + обзор кластеров ─────────
    var clsMiniRows=D.CLUSTERS.map(function(cl){
      var col=D.CLUSTER_COLORS[cl.code]||'#888';
      var clSc=clusters[cl.code];
      var clLvl=clSc!=null?D.getLevel(clSc):null;
      var clLv=clLvl?D.LEVEL_LABELS[clLvl]:null;
      var clPct=clSc!=null?Math.round((clSc-1)/3*100):null;
      var sColor=clLv?clLv.color:col;
      return '<div class="dpi-cls-mini-row">'+
        '<div class="dpi-cls-mini-name" style="color:'+col+'" title="'+escH(cl.name)+'">'+escH(cl.shortName)+'</div>'+
        '<div class="dpi-viz-track" style="height:8px">'+
          (clPct!=null?'<div class="dpi-viz-marker" style="left:'+clPct+'%;background:'+sColor+';width:12px;height:12px"></div>':'')+
        '</div>'+
        '<div class="dpi-cls-mini-score" style="color:'+sColor+'">'+(clSc!=null?clSc.toFixed(2):'—')+'</div>'+
        (clLv?'<span class="dpi-lvl" style="background:'+clLv.bg+';color:'+clLv.color+';flex-shrink:0">'+clLv.label+'</span>':'')+
      '</div>';
    }).join('');

    var topGrid=
      '<div class="dpi-top-grid">'+
        '<div class="dpi-im-card" style="background:'+imLvl.bg+';border-color:'+imLvl.color+'20">'+
          '<div class="dpi-im-hdr">'+
            '<span class="dpi-im-lbl">Контроль достоверности (IM)</span>'+
            '<span class="dpi-im-val" style="color:'+imLvl.color+'">'+(im.sum||0)+' / 40</span>'+
          '</div>'+
          '<div class="dpi-im-track">'+
            '<div class="dpi-viz-marker" style="left:'+imPct+'%;background:'+imLvl.color+'">'+
              '<span class="dpi-viz-tip" style="color:'+imLvl.color+'">'+imPct+'</span>'+
            '</div>'+
          '</div>'+
          '<div class="dpi-im-lvl-txt" style="color:'+imLvl.color+'">'+escH(imLvl.label)+'</div>'+
        '</div>'+
        '<div class="dpi-cls-overview">'+
          '<div class="dpi-cls-mini-hdr">Кластеры</div>'+
          clsMiniRows+
        '</div>'+
      '</div>';

    // ── Легенда ────────────────────────────────────────────────
    var legendHtml='<div class="dpi-viz-legend">'+
      '<span class="dpi-viz-leg-item"><span class="dpi-viz-leg-dot" style="background:#2FAE7B"></span>Низкий (1.0–1.9)</span>'+
      '<span class="dpi-viz-leg-item"><span class="dpi-viz-leg-dot" style="background:#B7791F"></span>Умеренный (2.0–2.6)</span>'+
      '<span class="dpi-viz-leg-item"><span class="dpi-viz-leg-dot" style="background:#E07000"></span>Повышенный (2.7–3.2)</span>'+
      '<span class="dpi-viz-leg-item"><span class="dpi-viz-leg-dot" style="background:#E35B6A"></span>Высокий (3.3–4.0)</span>'+
    '</div>';

    // ── Профиль: кластеры → шкалы ─────────────────────────────
    var vizHtml=D.CLUSTERS.map(function(cl){
      var col=D.CLUSTER_COLORS[cl.code]||'#888';
      var clSc=clusters[cl.code];
      var clLvl=clSc!=null?D.getLevel(clSc):null;
      var clLv=clLvl?D.LEVEL_LABELS[clLvl]:null;
      var sColor=clLv?clLv.color:col; // цвет балла = цвет уровня, не кластера

      var scRows=D.SCALES.filter(function(sc){return sc.cluster===cl.code;}).map(function(sc){
        var score=scales[sc.code];
        var lvl=score!=null?D.getLevel(score):null;
        var lv=lvl?D.LEVEL_LABELS[lvl]:null;
        var pct=score!=null?Math.round((score-1)/3*100):null;
        var mc=lv?lv.color:'#9ca3af';
        var icon=lvl==='high'?'<span class="dpi-viz-icon" style="color:#E35B6A">⬆</span>':
                 lvl==='elevated'?'<span class="dpi-viz-icon" style="color:#E07000">↑</span>':
                 '<span class="dpi-viz-icon"></span>';
        return '<div class="dpi-viz-row">'+
          '<div class="dpi-viz-sc-name" title="'+escH(sc.name)+'">'+escH(sc.name)+'</div>'+
          '<div class="dpi-viz-track">'+
            (pct!=null?'<div class="dpi-viz-marker" style="left:'+pct+'%;background:'+mc+'"><span class="dpi-viz-tip" style="color:'+mc+'">'+pct+'</span></div>':'')+
          '</div>'+
          '<div class="dpi-viz-score" style="color:'+mc+'">'+(score!=null?score.toFixed(2):'—')+'</div>'+
          icon+
        '</div>';
      }).join('');

      return '<div class="dpi-viz-cluster">'+
        '<div class="dpi-viz-cl-hdr" style="background:'+col+'18;border-left:4px solid '+col+'">'+
          '<span class="dpi-viz-cl-name" style="color:'+col+'">'+escH(cl.name)+'</span>'+
          '<span class="dpi-viz-cl-score" style="color:'+sColor+'">'+(clSc!=null?clSc.toFixed(2):'—')+'</span>'+
          (clLv?'<span class="dpi-lvl" style="background:'+clLv.bg+';color:'+clLv.color+'">'+clLv.label+'</span>':'')+
        '</div>'+
        scRows+
      '</div>';
    }).join('');

    // ── Таблица описаний: сортировка по убыванию балла ─────────
    var sortedScales=D.SCALES.slice().sort(function(a,b){
      var sa=scales[a.code]!=null?scales[a.code]:0;
      var sb=scales[b.code]!=null?scales[b.code]:0;
      return sb-sa;
    });

    var tableRows=sortedScales.map(function(sc){
      var score=scales[sc.code];
      var lvl=score!=null?D.getLevel(score):null;
      var lv=lvl?D.LEVEL_LABELS[lvl]:null;
      var desc=D.SCALE_DESCRIPTIONS[sc.code]||{};
      var cl=D.CLUSTERS.find(function(c){return c.scales.indexOf(sc.code)>=0;});
      var clColor=cl?D.CLUSTER_COLORS[cl.code]:'#888';
      return '<tr>'+
        '<td><span style="font-size:11px;font-weight:700;color:'+clColor+'">'+escH(cl?cl.shortName:'—')+'</span></td>'+
        '<td>'+escH(sc.name)+'</td>'+
        '<td style="font-weight:700;color:'+(lv?lv.color:'#888')+'">'+(score!=null?score.toFixed(2):'—')+'</td>'+
        '<td>'+(lv?'<span class="dpi-lvl" style="background:'+lv.bg+';color:'+lv.color+'">'+lv.label+'</span>':'—')+'</td>'+
        '<td class="dpi-hr-only" style="white-space:nowrap">'+
          (desc.high?'<button class="dpi-desc-expand" data-sc="'+escH(sc.code)+'">Показать ▸</button>':'')+'</td>'+
        '<td class="dpi-hr-only" id="dpi-dexp-'+sc.code+'" style="display:none;min-width:240px">'+
          (desc.high?
            '<div class="dpi-desc-sec"><b>При высокой выраженности:</b> '+escH(desc.high)+'</div>'+
            '<div class="dpi-desc-sec"><b>Адаптивная сторона:</b> '+escH(desc.adaptive)+'</div>'+
            '<div class="dpi-desc-sec dpi-desc-risk"><b>⚠ Риски:</b> '+escH(desc.risks)+'</div>':'')+
        '</td>'+
      '</tr>';
    }).join('');

    el.innerHTML='<div id="dpi-result-card" class="card">'+

      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">'+
        '<button type="button" class="btn-sm" data-act="dpi-list">← Назад</button>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          '<button type="button" class="btn-sm" data-act="dpi-export">📄 PDF (HR)</button>'+
          '<button type="button" class="btn-sm" data-act="dpi-export-participant">📋 PDF (участник)</button>'+
        '</div>'+
      '</div>'+

      '<div class="dpi-res-hdr">'+
        '<div class="dpi-res-name">'+escH(invite.candidate_name||'—')+'</div>'+
        '<div class="dpi-res-meta">'+[invite.department,invite.employee_group,invite.sent_at].filter(Boolean).map(escH).join(' · ')+'</div>'+
      '</div>'+

      topGrid+

      '<div class="dpi-sect-card">'+
        '<div class="dpi-sect-hdr">Профиль деструкторов</div>'+
        legendHtml+
        vizHtml+
      '</div>'+

      '<div class="dpi-sect-card dpi-hr-block">'+
        '<div class="dpi-sect-hdr">Описания шкал <span style="font-size:11px;font-weight:400;color:var(--ink3);margin-left:6px">от высокого к низкому</span></div>'+
        '<div class="tbl-wrap">'+
          '<table class="tbl dpi-scales-tbl">'+
            '<thead><tr>'+
              '<th>Кластер</th><th>Шкала</th><th>Балл</th><th>Уровень</th>'+
              '<th class="dpi-hr-only"></th><th class="dpi-hr-only">Описание</th>'+
            '</tr></thead>'+
            '<tbody>'+tableRows+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>'+

    '</div>';

    el.querySelectorAll('.dpi-desc-expand').forEach(function(btn){
      btn.addEventListener('click',function(){
        var sc=btn.dataset.sc;
        var body=document.getElementById('dpi-dexp-'+sc);
        if(!body)return;
        var open=body.style.display!=='none';
        body.style.display=open?'none':'';
        btn.textContent=open?'Показать ▸':'Скрыть ▴';
      });
    });
  }

  // ══ PDF EXPORT ═════════════════════════════════════════
  function exportDpiReport(opts){
    opts=opts||{};
    var isParticipant=!!opts.participant;
    var invite=DPI_RESULT_CONTEXT.invite||{};
    var prevTitle=document.title;
    document.title='DPI_'+(invite.candidate_name||'Отчёт').replace(/\s+/g,'_');
    document.body.setAttribute('data-pdf-mode',isParticipant?'dpi-participant':'dpi-hr');
    var restore=function(){
      document.body.removeAttribute('data-pdf-mode');
      document.title=prevTitle;
      window.removeEventListener('afterprint',restore);
    };
    window.addEventListener('afterprint',restore);
    window.print();
  }

  // ══ DELETE ══════════════════════════════════════════════
  async function deleteDpiAssessment(id){
    if(!id||!confirm('Удалить эту оценку? Действие необратимо.'))return;
    var res=await callApi('deleteDpiAssessment',{id:id,caller_role:g.U?g.U.role:''});
    if(res&&res.ok){showToast('Оценка удалена');await renderDpiList(document.getElementById('content'));}
    else showToast((res&&res.error)||'Ошибка','err');
  }

  // ══ EXPOSE ══════════════════════════════════════════════
  g.DPI_MODULE={
    renderList:renderDpiList,
    openModal:openDpiModal,
    closeModal:closeDpiModal,
    sendInvite:sendDpiInvite,
    viewResult:viewDpiResult,
    deleteAssessment:deleteDpiAssessment,
    exportReport:exportDpiReport,
  };

  // Check public form URL on load
  if(typeof document!=='undefined'){
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',checkPublicForm);
    } else {
      checkPublicForm();
    }
  }

})(typeof window!=='undefined'?window:this);

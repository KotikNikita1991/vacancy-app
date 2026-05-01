// pif.js — Модуль «Оценка потенциала» (PiF-Q)
(function(g){
  'use strict';

  var PIF_INVITE_LIST = [];
  var PIF_RESULT_CONTEXT = {invite:null, result:null};

  // ── Helpers ───────────────────────────────────────────────
  function escH(s){if(s==null||s==='')return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function callApi(action,data){if(typeof api==='function')return api(action,data);return Promise.resolve({ok:false,error:'API недоступен'});}
  function showToast(msg,type){if(typeof toast==='function')toast(msg,type);}

  function seededShuffle(arr,seed){
    var a=arr.slice(),s=seed|1;
    for(var i=a.length-1;i>0;i--){
      s=((Math.imul?Math.imul(1664525,s):(1664525*s))+1013904223)|0;
      var j=Math.abs(s)%(i+1),t=a[i];a[i]=a[j];a[j]=t;
    }
    return a;
  }
  function tokenSeed(token){
    var h=0;
    for(var i=0;i<(token||'').length;i++) h=(((Math.imul?Math.imul(31,h):(31*h))|0)+token.charCodeAt(i))|0;
    return Math.abs(h)||1;
  }
  function loadPifProgress(token){try{var r=localStorage.getItem('pif_prog_'+token);return r?JSON.parse(r):null;}catch(e){return null;}}
  function savePifProgress(token,answers){try{localStorage.setItem('pif_prog_'+token,JSON.stringify({answers:answers,ts:Date.now()}));}catch(e){}}
  function clearPifProgress(token){try{localStorage.removeItem('pif_prog_'+token);}catch(e){}}

  function statusBadge(st){
    if(st==='completed')return'<span class="badge sc2">Завершён</span>';
    if(st==='expired')return'<span class="badge sca">Истёк</span>';
    return'<span class="badge sw">Ожидание</span>';
  }

  // ══ PUBLIC FORM (index.html?pif_token=…) ════════════════
  function checkPublicForm(){
    var qs;try{qs=new URLSearchParams(location.search);}catch(e){return;}
    var token=qs.get('pif_token');
    if(!token)return;
    var ls=document.getElementById('ls');
    var app=document.getElementById('app');
    var pg=document.getElementById('pif-form-pg');
    if(ls)ls.style.display='none';
    if(app)app.style.display='none';
    if(pg){pg.style.display='flex';renderPifPublicForm(token,pg);}
  }

  async function renderPifPublicForm(token,container){
    container.innerHTML='<div class="pif-pg-loading"><span class="pif-spin"></span> Загружаем опрос…</div>';
    var D=g.PIF_DATA;
    if(!D){container.innerHTML='<div class="pif-pg-msg pif-pg-msg--err"><div class="pif-pg-ico">⚠</div><h2>Данные не загружены</h2><p>Перезагрузите страницу.</p></div>';return;}
    var res=await callApi('startPifSurvey',{token:token});
    if(!res||!res.ok){
      if(res&&res.already_done){
        container.innerHTML='<div class="pif-pg-msg pif-pg-msg--ok"><div class="pif-pg-ico">✓</div><h2>Опрос завершён</h2><p>Вы уже прошли этот опрос. Спасибо!</p></div>';
      } else {
        container.innerHTML='<div class="pif-pg-msg pif-pg-msg--err"><div class="pif-pg-ico">⚠</div><h2>Ссылка недействительна</h2><p>'+(res&&res.error?escH(res.error):'Проверьте правильность ссылки.')+'</p></div>';
      }
      return;
    }
    var inv=res.invite||{};
    var seed=tokenSeed(token);
    var saved=loadPifProgress(token);
    var answers=saved&&saved.answers?saved.answers:{};
    var shuffled=seededShuffle(D.QUESTIONS,seed);
    renderPifForm(container,token,inv,shuffled,answers);
  }

  function renderPifForm(container,token,inv,questions,answers){
    var OPTS=['Совершенно не подходит','Скорее не подходит','Скорее подходит','Полностью подходит'];
    var qCards=questions.map(function(q,idx){
      var cur=answers[q.n]||0;
      var opts=OPTS.map(function(lbl,vi){
        var v=vi+1;
        var sel=cur===v?' pif-opt--sel':'';
        return '<label class="pif-opt'+sel+'">'+
          '<input type="radio" name="q'+q.n+'" value="'+v+'" '+(cur===v?'checked':'')+'>'+
          '<span class="pif-opt-num">'+v+'</span>'+
          '<span>'+escH(lbl)+'</span>'+
        '</label>';
      }).join('');
      var done=cur>0?' pif-qcard--done':'';
      return '<div class="pif-qcard'+done+'" id="pq'+q.n+'">'+
        '<div class="pif-qnum">'+(idx+1)+'</div>'+
        '<div class="pif-qbody">'+
          '<div class="pif-qtext">'+escH(q.text)+'</div>'+
          '<div class="pif-opts">'+opts+'</div>'+
        '</div>'+
      '</div>';
    }).join('');

    var answered=Object.keys(answers).length;
    var total=questions.length;
    var pct=Math.round(answered/total*100);

    container.innerHTML=
      '<div class="pif-form-wrap">'+
        '<div class="pif-form-hdr">'+
          '<div class="pif-form-logo-ico">PiF</div>'+
          '<div>'+
            '<div class="pif-form-title">Оценка потенциала — PiF-Q</div>'+
            '<div class="pif-form-sub">'+escH(inv.candidate_name||'')+(inv.department?(' · '+escH(inv.department)):'')+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="pif-form-progress">'+
          '<div class="pif-progress-bar"><div class="pif-progress-fill" id="pif-pfill" style="width:'+pct+'%"></div></div>'+
          '<div class="pif-progress-cnt" id="pif-pcnt">'+answered+' / '+total+'</div>'+
        '</div>'+
        '<div class="pif-scale-legend">Шкала: <b>1</b> = Совершенно не подходит &nbsp;&nbsp; <b>2</b> = Скорее не подходит &nbsp;&nbsp; <b>3</b> = Скорее подходит &nbsp;&nbsp; <b>4</b> = Полностью подходит</div>'+
        qCards+
        '<div class="pif-form-footer">'+
          '<div id="pif-sub-err" class="pif-sub-err" style="display:none"></div>'+
          '<button type="button" class="pif-submit-btn" id="pif-submit-btn">Отправить результаты</button>'+
        '</div>'+
      '</div>';

    // Event handlers
    container.addEventListener('change',function(e){
      var inp=e.target;
      if(!inp||inp.type!=='radio')return;
      var qn=parseInt(inp.name.replace('q',''),10);
      var v=parseInt(inp.value,10);
      answers[qn]=v;
      savePifProgress(token,answers);
      var card=document.getElementById('pq'+qn);
      if(card){card.classList.add('pif-qcard--done');}
      var labels=inp.closest('.pif-opts')?inp.closest('.pif-opts').querySelectorAll('.pif-opt'):[];
      labels.forEach(function(lb){lb.classList.toggle('pif-opt--sel',lb.querySelector('input')===inp);});
      var answered2=Object.keys(answers).length;
      var pct2=Math.round(answered2/total*100);
      var fill=document.getElementById('pif-pfill');
      var cnt=document.getElementById('pif-pcnt');
      if(fill)fill.style.width=pct2+'%';
      if(cnt)cnt.textContent=answered2+' / '+total;
    });

    var btn=document.getElementById('pif-submit-btn');
    if(btn)btn.addEventListener('click',function(){submitPifPublicForm(token,answers,total,btn);});
  }

  async function submitPifPublicForm(token,answers,total,btn){
    var errEl=document.getElementById('pif-sub-err');
    var answered=Object.keys(answers).length;
    if(answered<total){
      if(errEl){errEl.style.display='';errEl.textContent='Пожалуйста, ответьте на все '+total+' утверждений. Осталось: '+(total-answered)+'.';}
      return;
    }
    if(errEl)errEl.style.display='none';
    if(btn){btn.disabled=true;btn.innerHTML='<span class="pif-spin"></span> Отправляем…';}
    var res=await callApi('submitPifSurvey',{token:token,answers:answers});
    var pg=document.getElementById('pif-form-pg');
    if(!pg)return;
    if(res&&res.ok){
      clearPifProgress(token);
      pg.innerHTML='<div class="pif-pg-msg pif-pg-msg--ok"><div class="pif-pg-ico">✓</div><h2>Готово! Спасибо за участие.</h2><p>Ваши ответы успешно сохранены. Специалист по подбору свяжется с вами при необходимости.</p></div>';
    } else {
      if(btn){btn.disabled=false;btn.textContent='Отправить результаты';}
      if(errEl){errEl.style.display='';errEl.textContent=(res&&res.error)||'Не удалось отправить ответы. Попробуйте ещё раз.';}
    }
  }

  // ══ LIST ════════════════════════════════════════════════
  async function renderPifList(el){
    if(!el)return;
    el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем список оценок…</div>';
    var res=await callApi('getPifAssessments',{role:g.U?g.U.role:'',recruiter_id:g.U?g.U.id:''});
    PIF_INVITE_LIST=res&&res.ok?(res.items||[]):[];
    buildPifListHtml(el);
  }

  function buildPifListHtml(el){
    var canDel=g.U&&(g.U.role==='admin'||g.U.role==='manager');
    var rows=PIF_INVITE_LIST.map(function(it){
      var del=canDel?'<button type="button" class="btn-danger" data-act="pif-del" data-pid="'+escH(it.id)+'">✕</button>':'';
      var view=it.has_result
        ?'<button type="button" class="btn-sm" data-act="pif-view" data-pid="'+escH(it.id)+'">Результат</button>'
        :'<span style="color:var(--ink3);font-size:12px">Нет данных</span>';
      return '<tr>'+
        '<td><div style="font-weight:600;font-size:13px;color:var(--ink)">'+escH(it.candidate_name||'—')+'</div></td>'+
        '<td><div style="font-size:12px;color:var(--ink2)">'+escH(it.department||'—')+'</div></td>'+
        '<td><div style="font-size:12px;color:var(--ink2)">'+escH(it.employee_group||'—')+'</div></td>'+
        '<td><div style="font-size:12px;color:var(--ink2)">'+escH(it.recruiter_name||'—')+'</div></td>'+
        '<td>'+statusBadge(it.status)+'</td>'+
        '<td><div style="font-size:12px;color:var(--ink3)">'+escH(it.sent_at||'—')+'</div></td>'+
        '<td style="white-space:nowrap"><div style="display:flex;gap:6px;align-items:center">'+view+del+'</div></td>'+
      '</tr>';
    }).join('');

    el.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
        '<div>'+
          '<h2 style="font-size:18px;font-weight:700">Оценка потенциала — PiF-Q</h2>'+
          '<p style="font-size:13px;color:var(--ink3);margin-top:2px">10 основных шкал · 9 дополнительных · 77 утверждений · 4 блока</p>'+
        '</div>'+
        '<button type="button" class="btn-primary" data-act="pif-new">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          ' Новая оценка потенциала'+
        '</button>'+
      '</div>'+
      (PIF_INVITE_LIST.length===0
        ?'<div class="card"><div class="empty" style="padding:60px">'+
            '<div class="empty-ico" style="background:#EFF6FF">'+
              '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/></svg>'+
            '</div>'+
            '<h3>Нет оценок потенциала</h3>'+
            '<p>Отправьте приглашение сотруднику — результат появится здесь.</p>'+
          '</div></div>'
        :'<div class="card"><div class="tbl-wrap"><table>'+
            '<thead><tr>'+
              '<th>Сотрудник</th><th>Подразделение</th><th>Группа</th><th>Рекрутер</th><th>Статус</th><th>Дата отправки</th><th>Действия</th>'+
            '</tr></thead>'+
            '<tbody>'+rows+'</tbody>'+
          '</table></div></div>'
      );
  }

  // ══ SEND INVITE MODAL ══════════════════════════════════
  function openPifModal(){
    var _ref=(typeof REF!=='undefined'?REF:null)||{};
    var depts=Array.isArray(_ref['Подразделения'])&&_ref['Подразделения'].length?_ref['Подразделения']:['IT','Финансы','Продажи','HR','Производство'];
    var groups=Array.isArray(_ref['Группы'])&&_ref['Группы'].length?_ref['Группы']:['ТОП','Офис','Рабочий','Линейный'];
    var today=new Date().toISOString().slice(0,10);
    var dOpts=depts.map(function(d){return'<option>'+escH(d)+'</option>';}).join('');
    var gOpts=groups.map(function(gr){return'<option>'+escH(gr)+'</option>';}).join('');
    var html='<div class="modal-overlay" id="pif-modal" data-act="pif-overlay">'+
      '<div class="modal" style="max-width:480px">'+
        '<div class="modal-hdr"><span class="modal-ttl">Новая оценка потенциала (PiF-Q)</span></div>'+
        '<div class="modal-body" style="display:flex;flex-direction:column;gap:14px">'+
          '<div class="fg"><label class="flbl">ФИО сотрудника <span class="req">*</span></label>'+
          '<input id="pif-nm" class="finp" placeholder="Иванов Иван Иванович" autocomplete="off"></div>'+
          '<div class="fg"><label class="flbl">Подразделение <span class="req">*</span></label>'+
          '<select id="pif-dp" class="finp"><option value="">— выберите —</option>'+dOpts+'</select></div>'+
          '<div class="fg"><label class="flbl">Группа <span class="req">*</span></label>'+
          '<select id="pif-gr" class="finp"><option value="">— выберите —</option>'+gOpts+'</select></div>'+
          '<div class="fg"><label class="flbl">E-mail <span class="req">*</span></label>'+
          '<input id="pif-em" class="finp" type="email" placeholder="ivanov@company.ru" autocomplete="off"></div>'+
          '<div class="fg"><label class="flbl">Дата направления <span class="req">*</span></label>'+
          '<input id="pif-dt" class="finp" type="date" value="'+today+'"></div>'+
        '</div>'+
        '<div class="modal-footer">'+
          '<button type="button" class="btn-cancel" data-act="close-pif-modal">Отмена</button>'+
          '<button type="button" class="btn-save" id="btn-pif-send" data-act="pif-send">Отправить ссылку</button>'+
        '</div>'+
      '</div>'+
    '</div>';
    document.body.insertAdjacentHTML('beforeend',html);
  }

  function closePifModal(){var m=document.getElementById('pif-modal');if(m)m.remove();}

  async function sendPifInvite(){
    var name=(document.getElementById('pif-nm')?.value||'').trim();
    var dept=(document.getElementById('pif-dp')?.value||'').trim();
    var group=(document.getElementById('pif-gr')?.value||'').trim();
    var email=(document.getElementById('pif-em')?.value||'').trim().toLowerCase();
    var date=document.getElementById('pif-dt')?.value||'';
    if(!name||!dept||!group||!email||!date){showToast('Заполните все обязательные поля','err');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){showToast('Некорректный e-mail адрес','err');return;}
    var btn=document.getElementById('btn-pif-send');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
    var res=await callApi('createPifInvite',{
      candidate_name:name,department:dept,employee_group:group,
      email:email,sent_date:date,
      recruiter_id:g.U?g.U.id:'',recruiter_name:g.U?g.U.name:'',
    });
    if(res&&res.ok){
      showToast('Ссылка отправлена ✓');
      closePifModal();
      await renderPifList(document.getElementById('content'));
    } else {
      showToast((res&&res.error)||'Не удалось отправить ссылку','err');
      if(btn){btn.disabled=false;btn.textContent='Отправить ссылку';}
    }
  }

  // ══ VIEW RESULT ════════════════════════════════════════
  async function viewPifResult(id){
    if(!id)return;
    var el=document.getElementById('content');
    if(el)el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем результат…</div>';
    var res=await callApi('getPifAssessmentResult',{id:id,role:g.U?g.U.role:''});
    if(!res||!res.ok){showToast((res&&res.error)||'Не удалось загрузить результат','err');renderPifList(el);return;}
    PIF_RESULT_CONTEXT={invite:res.invite,result:res.result};
    renderPifResultView(el,res.invite,res.result);
  }

  function renderPifResultView(el,invite,result){
    var D=g.PIF_DATA;
    var scales=result.scales||{};
    var total=result.total||0;
    var totalLvl=D.getTotalLevel(total);
    var totalPct=Math.round((total-1)/3*100);

    // ── Шапка ──────────────────────────────────────────────
    var hdr='<div class="pif-res-hdr">'+
      '<button type="button" class="btn-sm" data-act="pif-list">← Назад к списку</button>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<button type="button" class="btn-sm" data-act="pif-export">PDF: рекрутёру</button>'+
        '<button type="button" class="btn-sm" data-act="pif-export-candidate">PDF: кандидату</button>'+
      '</div>'+
    '</div>';

    // ── Инфо-карточка ──────────────────────────────────────
    var info='<div class="pif-info-row">'+
      '<div class="pif-info-field"><div class="pif-info-lbl">Сотрудник</div><div class="pif-info-val">'+escH(invite.candidate_name||'—')+'</div></div>'+
      '<div class="pif-info-field"><div class="pif-info-lbl">Подразделение</div><div class="pif-info-val">'+escH(invite.department||'—')+'</div></div>'+
      '<div class="pif-info-field"><div class="pif-info-lbl">Группа</div><div class="pif-info-val">'+escH(invite.employee_group||'—')+'</div></div>'+
      '<div class="pif-info-field"><div class="pif-info-lbl">Рекрутер</div><div class="pif-info-val">'+escH(invite.recruiter_name||'—')+'</div></div>'+
      '<div class="pif-info-field"><div class="pif-info-lbl">Дата отправки</div><div class="pif-info-val">'+escH(invite.sent_at||'—')+'</div></div>'+
    '</div>';

    // ── Итоговый балл PiF-Q ────────────────────────────────
    var scoreCard='<div class="pif-score-card" style="border-color:'+totalLvl.color+'40;background:'+totalLvl.bg+'">'+
      '<div class="pif-score-top">'+
        '<div>'+
          '<div class="pif-score-lbl">Итоговый балл PiF-Q</div>'+
          '<div class="pif-score-sub">Среднее 10 основных шкал · шкала 1.0–4.0</div>'+
        '</div>'+
        '<div class="pif-score-val" style="color:'+totalLvl.color+'">'+total.toFixed(2)+'</div>'+
      '</div>'+
      '<div class="pif-score-track-wrap">'+
        '<div class="pif-score-track">'+
          '<div class="pif-score-zones">'+
            '<div class="pif-zone" style="width:30%;background:#E5E7EB"></div>'+  // low 1.0-1.9 = 30%
            '<div class="pif-zone" style="width:23%;background:#FDE68A"></div>'+  // moderate 2.0-2.7 = 23%
            '<div class="pif-zone" style="width:17%;background:#BFDBFE"></div>'+  // elevated 2.8-3.3 = 17%
            '<div class="pif-zone" style="width:30%;background:#A7F3D0"></div>'+  // high 3.4-4.0 = 30%
          '</div>'+
          '<div class="pif-score-marker" style="left:'+totalPct+'%;background:'+totalLvl.color+'">'+
            '<span class="pif-score-tip" style="color:'+totalLvl.color+'">'+total.toFixed(2)+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="pif-score-ticks"><span>1.0</span><span>1.9</span><span>2.7</span><span>3.3</span><span>4.0</span></div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">'+
        '<span class="pif-lvl-badge" style="background:'+totalLvl.color+';color:#fff">'+escH(totalLvl.label)+'</span>'+
        '<span style="font-size:12px;color:var(--ink2)">'+pifLevelInterpretation(D.getLevel(total,false))+'</span>'+
      '</div>'+
    '</div>';

    // ── Блоки ──────────────────────────────────────────────
    var blockCards=D.BLOCKS.map(function(bl){
      var blScales=D.SCALES.filter(function(sc){return sc.block===bl.code&&sc.isMain;});
      var blScores=blScales.map(function(sc){return scales[sc.code];}).filter(function(v){return v!=null;});
      var blMean=blScores.length?blScores.reduce(function(a,b){return a+b;},0)/blScores.length:null;
      var blLvl=blMean!=null?D.getLevelLabel(blMean,false):null;
      var blPct=blMean!=null?Math.round((blMean-1)/3*100):null;
      return '<div class="pif-block-card" style="border-top:3px solid '+bl.color+';background:'+bl.bg+'">'+
        '<div class="pif-block-lbl" style="color:'+bl.color+'">'+escH(bl.name)+'</div>'+
        '<div class="pif-block-val" style="color:'+(blLvl?blLvl.color:bl.color)+'">'+(blMean!=null?blMean.toFixed(2):'—')+'</div>'+
        (blLvl?'<div class="pif-block-lvl" style="color:'+blLvl.color+'">'+escH(blLvl.label)+'</div>':'')+
        '<div class="pif-mini-track" style="margin-top:6px">'+
          '<div class="pif-mini-fill" style="width:'+(blPct||0)+'%;background:'+(blLvl?blLvl.color:bl.color)+'"></div>'+
        '</div>'+
      '</div>';
    }).join('');

    // ── Профиль основных шкал ──────────────────────────────
    var mainViz=D.BLOCKS.map(function(bl){
      var blScales=D.SCALES.filter(function(sc){return sc.block===bl.code&&sc.isMain;});
      var rows=blScales.map(function(sc){
        var score=scales[sc.code];
        var lvl=score!=null?D.getLevelLabel(score,false):null;
        var pct=score!=null?Math.round((score-1)/3*100):null;
        var mc=lvl?lvl.color:'#9CA3AF';
        return '<div class="pif-viz-row">'+
          '<div class="pif-viz-code" style="color:'+bl.color+'">'+escH(sc.code)+'</div>'+
          '<div class="pif-viz-name" title="'+escH(sc.name)+'">'+escH(sc.name)+'</div>'+
          '<div class="pif-viz-track">'+
            (pct!=null?'<div class="pif-viz-marker" style="left:'+pct+'%;background:'+mc+'"><span class="pif-viz-tip" style="color:'+mc+'">'+pct+'</span></div>':'')+
          '</div>'+
          '<div class="pif-viz-score" style="color:'+mc+'">'+(score!=null?score.toFixed(2):'—')+'</div>'+
          (lvl?'<span class="pif-lvl-sm" style="background:'+lvl.bg+';color:'+lvl.color+'">'+escH(lvl.label)+'</span>':'')+
        '</div>';
      }).join('');
      return '<div class="pif-sect-card">'+
        '<div class="pif-sect-hdr" style="--pif-acc:'+bl.color+'">'+
          '<span class="pif-sect-block-badge" style="background:'+bl.color+'">'+escH(bl.label)+'</span>'+
          escH(bl.name)+
        '</div>'+
        rows+
      '</div>';
    }).join('');

    // ── Дополнительные шкалы ───────────────────────────────
    var addlScales=D.SCALES.filter(function(sc){return!sc.isMain&&!sc.isDestructor;});
    var destrScales=D.SCALES.filter(function(sc){return sc.isDestructor;});

    var addlRows=addlScales.map(function(sc){
      var score=scales[sc.code];
      var lvl=score!=null?D.getLevelLabel(score,false):null;
      var pct=score!=null?Math.round((score-1)/3*100):null;
      var mc=lvl?lvl.color:'#9CA3AF';
      return '<div class="pif-viz-row">'+
        '<div class="pif-viz-code" style="color:#6B7280">'+escH(sc.code)+'</div>'+
        '<div class="pif-viz-name" title="'+escH(sc.name)+'">'+escH(sc.name)+'</div>'+
        '<div class="pif-viz-track">'+
          (pct!=null?'<div class="pif-viz-marker" style="left:'+pct+'%;background:'+mc+'"><span class="pif-viz-tip" style="color:'+mc+'">'+pct+'</span></div>':'')+
        '</div>'+
        '<div class="pif-viz-score" style="color:'+mc+'">'+(score!=null?score.toFixed(2):'—')+'</div>'+
        (lvl?'<span class="pif-lvl-sm" style="background:'+lvl.bg+';color:'+lvl.color+'">'+escH(lvl.label)+'</span>':'')+
      '</div>';
    }).join('');

    var destrRows=destrScales.map(function(sc){
      var score=scales[sc.code];
      var lvl=score!=null?D.getLevelLabel(score,true):null;
      var pct=score!=null?Math.round((score-1)/3*100):null;
      var mc=lvl?lvl.color:'#9CA3AF';
      var isHigh=lvl&&lvl.color==='#DC2626';
      return '<div class="pif-viz-row pif-viz-row--destr">'+
        '<div class="pif-viz-code" style="color:#DC2626">'+escH(sc.code)+'</div>'+
        '<div class="pif-viz-name" title="'+escH(sc.name)+'">'+escH(sc.name)+'</div>'+
        '<div class="pif-viz-track pif-viz-track--destr">'+
          (pct!=null?'<div class="pif-viz-marker" style="left:'+pct+'%;background:'+mc+'"><span class="pif-viz-tip" style="color:'+mc+'">'+pct+'</span></div>':'')+
        '</div>'+
        '<div class="pif-viz-score" style="color:'+mc+'">'+(score!=null?score.toFixed(2):'—')+'</div>'+
        (lvl?'<span class="pif-lvl-sm" style="background:'+lvl.bg+';color:'+lvl.color+'">'+(isHigh?'⚠ ':'')+escH(lvl.label.replace(' ⚠',''))+'</span>':'')+
      '</div>';
    }).join('');

    // ── Описание шкал ──────────────────────────────────────
    var descRows=D.SCALES.map(function(sc){
      var score=scales[sc.code];
      var lvl=score!=null?D.getLevelLabel(score,sc.isDestructor):null;
      var blDef=D.BLOCKS.find(function(b){return b.code===sc.block;})||{color:'#6B7280',name:'Доп.'};
      var blColor=sc.isDestructor?'#DC2626':blDef.color;
      return '<tr>'+
        '<td><span style="font-size:11px;font-weight:700;color:'+blColor+'">'+escH(sc.code)+'</span></td>'+
        '<td>'+escH(sc.name)+'</td>'+
        '<td style="font-size:12px;color:var(--ink2)">'+escH(sc.desc)+'</td>'+
        '<td style="font-weight:700;color:'+(lvl?lvl.color:'#9CA3AF')+'">'+(score!=null?score.toFixed(2):'—')+'</td>'+
        '<td>'+(lvl?'<span class="pif-lvl-sm" style="background:'+lvl.bg+';color:'+lvl.color+'">'+escH(lvl.label.replace(' ⚠',''))+'</span>':'—')+'</td>'+
      '</tr>';
    }).join('');

    el.innerHTML=
      hdr+
      '<div class="pif-res-body">'+
        info+
        scoreCard+
        '<div class="pif-block-grid">'+blockCards+'</div>'+
        '<h3 class="pif-sec-title">Профиль основных шкал</h3>'+
        '<div class="pif-legend">'+
          '<span class="pif-leg-item"><span class="pif-leg-dot" style="background:#6B7280"></span>Низкий (1.0–1.9)</span>'+
          '<span class="pif-leg-item"><span class="pif-leg-dot" style="background:#B7791F"></span>Умеренный (2.0–2.7)</span>'+
          '<span class="pif-leg-item"><span class="pif-leg-dot" style="background:#1D4ED8"></span>Повышенный (2.8–3.3)</span>'+
          '<span class="pif-leg-item"><span class="pif-leg-dot" style="background:#059669"></span>Высокий (3.4–4.0)</span>'+
        '</div>'+
        mainViz+
        '<div class="pif-sect-card pif-sect-addl">'+
          '<div class="pif-sect-hdr" style="--pif-acc:#6B7280">Дополнительные шкалы</div>'+
          '<div style="font-size:12px;color:var(--ink3);margin-bottom:10px;font-style:italic">Не входят в итоговый балл PiF-Q. Дают дополнительную информацию о стиле работы.</div>'+
          addlRows+
        '</div>'+
        '<div class="pif-sect-card pif-sect-destr">'+
          '<div class="pif-sect-hdr pif-sect-hdr--destr" style="--pif-acc:#DC2626">⚠ Шкалы-деструкторы</div>'+
          '<div style="font-size:12px;color:#B91C1C;margin-bottom:10px">Высокий балл — это предупреждение. Деструктор снижает вероятность карьерного успеха руководителя.</div>'+
          destrRows+
        '</div>'+
        '<div class="pif-sect-card">'+
          '<div class="pif-sect-hdr" style="--pif-acc:#6B7280">Таблица шкал</div>'+
          '<div class="tbl-wrap"><table>'+
            '<thead><tr><th>Код</th><th>Шкала</th><th>Описание</th><th>Балл</th><th>Уровень</th></tr></thead>'+
            '<tbody>'+descRows+'</tbody>'+
          '</table></div>'+
        '</div>'+
      '</div>';
  }

  function pifLevelInterpretation(lk){
    if(lk==='high')return'Высокий потенциал — значимый позитивный предиктор успеха в новой роли';
    if(lk==='elevated')return'Выше среднего — хороший признак потенциала';
    if(lk==='moderate')return'Нормативный диапазон — достаточно для текущей роли';
    return'Ниже нормативного — зона развития или риск при новых задачах';
  }

  // ══ PDF EXPORT ═════════════════════════════════════════
  function exportPifReport(opts){
    var candidate=opts&&opts.candidate;
    var mode=candidate?'pif-candidate':'pif';
    document.body.setAttribute('data-pdf-mode',mode);
    var btn1=document.querySelector('[data-act="pif-export"]');
    var btn2=document.querySelector('[data-act="pif-export-candidate"]');
    var backs=document.querySelectorAll('[data-act="pif-list"]');
    [btn1,btn2].forEach(function(b){if(b)b.style.display='none';});
    backs.forEach(function(b){if(b)b.style.display='none';});
    setTimeout(function(){
      window.print();
      setTimeout(function(){
        document.body.removeAttribute('data-pdf-mode');
        [btn1,btn2].forEach(function(b){if(b)b.style.display='';});
        backs.forEach(function(b){if(b)b.style.display='';});
      },500);
    },200);
  }

  // ══ DELETE ═════════════════════════════════════════════
  async function deletePifAssessment(id){
    if(!id)return;
    if(!confirm('Удалить оценку потенциала? Это действие необратимо.'))return;
    var res=await callApi('deletePifAssessment',{id:id,caller_role:g.U?g.U.role:''});
    if(res&&res.ok){
      showToast('Оценка удалена');
      await renderPifList(document.getElementById('content'));
    } else {
      showToast((res&&res.error)||'Не удалось удалить','err');
    }
  }

  // ══ MODULE EXPORT ══════════════════════════════════════
  g.PIF_MODULE = {
    renderList:        renderPifList,
    sendInvite:        sendPifInvite,
    openModal:         openPifModal,
    closeModal:        closePifModal,
    viewResult:        viewPifResult,
    deleteAssessment:  deletePifAssessment,
    exportReport:      exportPifReport,
  };

  if(typeof location!=='undefined') checkPublicForm();
})(typeof window !== 'undefined' ? window : this);

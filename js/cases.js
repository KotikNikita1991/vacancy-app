// cases.js — Модуль «Кейсы» (ситуативная проверка навыков)
(function (g) {
  'use strict';

  var INVITES = [];
  var TEMPLATES = [];
  var TPL_LOAD_OK = true;
  var RESULT_CTX = { invite: null, cases: [], answers: {} };
  var EDITOR = null; // {template, isNew}

  // ── helpers ───────────────────────────────────────────
  function escH(s){ if(s==null||s==='')return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function callApi(action,data){ if(typeof api==='function')return api(action,data); return Promise.resolve({ok:false,error:'API недоступен'}); }
  function showToast(msg,type){ if(typeof toast==='function')toast(msg,type); }
  function role(){ return g.U ? g.U.role : ''; }
  function canEditTpl(){ var r=role(); return r==='admin'||r==='manager'; }
  function canSeeResults(){ var r=role(); return r==='admin'||r==='manager'||r==='rop'; }
  function canDelete(){ return role()==='admin'; }
  function tmpId(p){ return (p||'id')+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
  function countQ(t){ return (t.cases||[]).reduce(function(a,c){return a+((c.questions||[]).length);},0); }

  function statusBadge(st){
    if(st==='completed')return'<span class="badge sc2">Выполнен</span>';
    if(st==='expired')return'<span class="badge sca">Истёк</span>';
    return'<span class="badge sw">Ожидание</span>';
  }
  function modeBadge(m){
    if(m==='platform')return'<span style="font-size:11px;font-weight:600;color:#0e7c7b;background:#dcf1f0;border-radius:999px;padding:3px 9px;white-space:nowrap">🖥 На платформе</span>';
    return'<span style="font-size:11px;font-weight:600;color:#1e3a8a;background:#eff4ff;border-radius:999px;padding:3px 9px;white-space:nowrap">📧 По почте</span>';
  }

  // ══ СПИСОК ═════════════════════════════════════════════
  async function renderList(el){
    if(!el)return;
    el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем…</div>';
    var tr=await callApi('getCaseTemplates',{});
    TPL_LOAD_OK=!!(tr&&tr.ok);
    TEMPLATES=TPL_LOAD_OK?(tr.templates||[]):[];
    var rr=await callApi('getCaseAssessments',{role:role(),recruiter_id:g.U?g.U.id:''});
    INVITES=rr&&rr.ok?(rr.items||[]):[];
    buildList(el);
  }

  function buildList(el){
    var cd=canDelete(), cv=canSeeResults(), ce=canEditTpl();
    var rows=INVITES.map(function(it){
      var del=cd?'<button type="button" class="btn-danger" data-cact="del" data-id="'+escH(it.id)+'">✕</button>':'';
      var view=it.has_result
        ?(cv?'<button type="button" class="btn-sm" data-cact="view" data-id="'+escH(it.id)+'">Ответы</button>'
            :'<span style="color:var(--ink3);font-size:12px">—</span>')
        :'<span style="color:var(--ink3);font-size:12px">Нет ответов</span>';
      return '<tr>'+
        '<td><div style="font-weight:600;font-size:13px;color:var(--ink)">'+escH(it.candidate_name||'—')+'</div></td>'+
        '<td><div style="font-size:12px;color:var(--ink2)">'+escH(it.template_title||it.position||'—')+'</div></td>'+
        '<td>'+modeBadge(it.mode)+'</td>'+
        '<td><div style="font-size:12px;color:var(--ink2)">'+escH(it.recruiter_name||'—')+'</div></td>'+
        '<td>'+statusBadge(it.status)+'</td>'+
        '<td><div style="font-size:12px;color:var(--ink3)">'+escH(it.sent_at||'—')+'</div></td>'+
        '<td style="white-space:nowrap"><div style="display:flex;gap:6px;align-items:center">'+view+del+'</div></td>'+
      '</tr>';
    }).join('');

    var warn = !TPL_LOAD_OK
      ? '<div class="card" style="margin-bottom:14px;padding:14px 18px;background:#fffbeb;border-color:#fde68a">'+
          '<div style="font-size:13px;color:#92400e;line-height:1.6">⚠ Серверная часть модуля «Кейсы» ещё не активна. '+
          'Обновите (передеплойте) Google Apps Script — после этого появятся шаблоны и запуск кейсов.</div></div>'
      : '';

    el.innerHTML=
      warn+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
        '<div>'+
          '<h2 style="font-size:18px;font-weight:700">Кейсы</h2>'+
          '<p style="font-size:13px;color:var(--ink3);margin-top:2px">Ситуативная проверка навыков: прохождение на платформе или по ссылке на почту. Результат — ответы кандидата (без интерпретации).</p>'+
        '</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          (ce?'<button type="button" class="btn-sm" data-cact="templates">⚙ Шаблоны кейсов</button>':'')+
          '<button type="button" class="btn-primary" data-cact="new">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
            ' Новый кейс'+
          '</button>'+
        '</div>'+
      '</div>'+
      (INVITES.length===0
        ?'<div class="card"><div class="empty" style="padding:60px">'+
            '<div class="empty-ico" style="background:#eff4ff">'+
              '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>'+
            '</div>'+
            '<h3>Пока нет запущенных кейсов</h3>'+
            '<p>Нажмите «Новый кейс», чтобы запустить проверку на платформе или отправить ссылку кандидату.</p>'+
          '</div></div>'
        :'<div class="card"><div class="tbl-wrap"><table>'+
            '<thead><tr><th>Кандидат</th><th>Кейс / должность</th><th>Способ</th><th>Рекрутер</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead>'+
            '<tbody>'+rows+'</tbody>'+
          '</table></div></div>'
      );
  }

  // ══ ЗАПУСК (модалка) ═══════════════════════════════════
  function openRunModal(){
    if(!TEMPLATES.length){
      showToast(canEditTpl()?'Сначала создайте шаблон кейса (⚙ Шаблоны кейсов)':'Шаблоны кейсов ещё не созданы','err');
      return;
    }
    var opts=TEMPLATES.filter(function(t){return t.active!==false;}).map(function(t){
      return '<option value="'+escH(t.id)+'">'+escH(t.title)+' ('+countQ(t)+' вопр.)</option>';
    }).join('');
    var html='<div class="modal-overlay" id="case-run-modal" data-cact="run-overlay">'+
      '<div class="modal" style="max-width:480px">'+
        '<div class="modal-hdr"><span class="modal-ttl">Новый кейс</span>'+
          '<button type="button" class="modal-close" data-cact="run-close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'+
        '</div>'+
        '<div class="modal-body" style="display:flex;flex-direction:column;gap:14px">'+
          '<div class="fg"><label class="flbl">Набор кейсов <span class="req">*</span></label>'+
            '<select id="case-tpl" class="finp">'+opts+'</select></div>'+
          '<div class="fg"><label class="flbl">ФИО кандидата <span class="req">*</span></label>'+
            '<input id="case-nm" class="finp" placeholder="Иванов Иван Иванович" autocomplete="off"></div>'+
          '<div class="fg"><label class="flbl">Должность</label>'+
            '<input id="case-pos" class="finp" placeholder="напр. Руководитель проекта" autocomplete="off"></div>'+
          '<div class="fg"><label class="flbl">E-mail <span style="color:var(--ink3);font-weight:400">(для отправки по почте)</span></label>'+
            '<input id="case-em" class="finp" type="email" placeholder="ivanov@company.ru" autocomplete="off"></div>'+
          '<div style="font-size:12px;color:var(--ink3);line-height:1.5;background:var(--bg2,#f3f4f6);border-radius:8px;padding:10px 12px">'+
            '🖥 <b>На платформе</b> — откроется форма в новой вкладке на этом компьютере, кандидат проходит сразу.<br>'+
            '📧 <b>По почте</b> — кандидату уйдёт ссылка (нужен e-mail).'+
          '</div>'+
        '</div>'+
        '<div class="modal-footer" style="gap:10px">'+
          '<button type="button" class="btn-cancel" data-cact="run-close">Отмена</button>'+
          '<div style="display:flex;gap:10px;flex-wrap:wrap">'+
            '<button type="button" class="btn-sm" id="case-btn-platform" data-cact="run-platform">🖥 Пройти на платформе</button>'+
            '<button type="button" class="btn-save" id="case-btn-email" data-cact="send-email">📧 Отправить по почте</button>'+
          '</div>'+
        '</div>'+
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
  }
  function closeRunModal(){ var m=document.getElementById('case-run-modal'); if(m)m.remove(); }

  function readRunForm(){
    return {
      template_id:(document.getElementById('case-tpl')||{}).value||'',
      candidate_name:((document.getElementById('case-nm')||{}).value||'').trim(),
      position:((document.getElementById('case-pos')||{}).value||'').trim(),
      email:((document.getElementById('case-em')||{}).value||'').trim().toLowerCase(),
    };
  }

  async function sendEmail(){
    var f=readRunForm();
    if(!f.template_id){showToast('Выберите набор кейсов','err');return;}
    if(!f.candidate_name){showToast('Укажите ФИО кандидата','err');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)){showToast('Укажите корректный e-mail','err');return;}
    var btn=document.getElementById('case-btn-email');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
    var res=await callApi('createCaseInvite',{
      template_id:f.template_id, candidate_name:f.candidate_name, position:f.position, email:f.email,
      recruiter_id:g.U?g.U.id:'', recruiter_name:g.U?g.U.name:'',
    });
    if(res&&res.ok){ showToast('Ссылка отправлена ✓'); closeRunModal(); await renderList(document.getElementById('content')); }
    else { showToast((res&&res.error)||'Не удалось отправить','err'); if(btn){btn.disabled=false;btn.innerHTML='📧 Отправить по почте';} }
  }

  async function runPlatform(){
    var f=readRunForm();
    if(!f.template_id){showToast('Выберите набор кейсов','err');return;}
    if(!f.candidate_name){showToast('Укажите ФИО кандидата','err');return;}
    var btn=document.getElementById('case-btn-platform');
    if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
    // Открываем вкладку сразу (в обработчике клика), чтобы не блокировал попап-блокер
    var tab=window.open('', '_blank');
    var res=await callApi('createCaseSession',{
      template_id:f.template_id, candidate_name:f.candidate_name, position:f.position, email:f.email,
      recruiter_id:g.U?g.U.id:'', recruiter_name:g.U?g.U.name:'',
    });
    if(res&&res.ok&&res.survey_link){
      if(tab){ try{ tab.location.href=res.survey_link; }catch(e){ window.open(res.survey_link,'_blank'); } }
      else window.open(res.survey_link,'_blank');
      showToast('Кейс открыт в новой вкладке ✓');
      closeRunModal();
      await renderList(document.getElementById('content'));
    } else {
      if(tab){ try{ tab.close(); }catch(e){} }
      showToast((res&&res.error)||'Не удалось запустить','err');
      if(btn){btn.disabled=false;btn.innerHTML='🖥 Пройти на платформе';}
    }
  }

  // ══ ПРОСМОТР ОТВЕТОВ ═══════════════════════════════════
  async function viewResult(id){
    if(!id)return;
    var el=document.getElementById('content');
    if(el)el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем ответы…</div>';
    var res=await callApi('getCaseAssessmentResult',{id:id,role:role()});
    if(!res||!res.ok){ showToast((res&&res.error)||'Не удалось загрузить','err'); renderList(el); return; }
    RESULT_CTX={invite:res.invite||{},cases:res.cases||[],answers:res.answers||{}};
    buildResult(el);
  }

  function answerHtml(text){
    var v=(text==null?'':String(text)).trim();
    if(v==='') return '<div class="case-ans case-ans--empty">— нет ответа —</div>';
    return '<div class="case-ans">'+escH(v)+'</div>';
  }

  function buildResult(el){
    var inv=RESULT_CTX.invite||{}, cases=RESULT_CTX.cases||[], ans=RESULT_CTX.answers||{};
    var meta=[inv.position,inv.template_title,inv.submitted_at].filter(Boolean).map(escH).join(' · ');
    var body=cases.map(function(c){
      var qs=(c.questions||[]).map(function(q,qi){
        return '<div class="case-q">'+
          '<div class="case-q-t"><span style="color:#2563eb;font-weight:800">'+(qi+1)+'.</span> '+escH(q.text)+'</div>'+
          answerHtml(ans[q.id])+
        '</div>';
      }).join('');
      return '<div class="case-block">'+
        '<div class="case-block-hdr">'+escH(c.title||'Кейс')+'</div>'+
        (c.description?'<div class="case-block-desc">'+escH(c.description)+'</div>':'')+
        qs+
      '</div>';
    }).join('');

    el.innerHTML='<div class="card">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:18px">'+
        '<button type="button" class="btn-sm" data-cact="list">← Назад</button>'+
        '<button type="button" class="btn-sm" data-cact="export">📄 Выгрузить в PDF</button>'+
      '</div>'+
      '<div style="margin-bottom:18px">'+
        '<div style="font-size:20px;font-weight:800;color:var(--ink)">'+escH(inv.candidate_name||'—')+'</div>'+
        '<div style="font-size:13px;color:var(--ink3);margin-top:2px">'+(meta||'')+'</div>'+
      '</div>'+
      (inv.instruction?'<div style="font-size:13px;color:var(--ink2);background:#eff4ff;border:1px solid #c7d7fe;border-radius:10px;padding:12px 14px;margin-bottom:16px;line-height:1.6">'+escH(inv.instruction)+'</div>':'')+
      '<style>'+
        '.case-block{border:1px solid var(--bg2,#eef0f3);border-radius:12px;padding:16px;margin-bottom:14px}'+
        '.case-block-hdr{font-size:15px;font-weight:800;color:#2563eb;margin-bottom:6px}'+
        '.case-block-desc{font-size:13px;color:var(--ink2);line-height:1.6;margin-bottom:12px;white-space:pre-wrap}'+
        '.case-q{margin-bottom:14px}'+
        '.case-q-t{font-size:13.5px;font-weight:600;color:var(--ink);margin-bottom:6px;line-height:1.5}'+
        '.case-ans{font-size:13.5px;color:#1a1a2e;background:#fafafa;border:1px solid #e5e7eb;border-left:3px solid #2563eb;border-radius:8px;padding:10px 13px;white-space:pre-wrap;line-height:1.6}'+
        '.case-ans--empty{color:#9ca3af;font-style:italic;border-left-color:#d1d5db}'+
      '</style>'+
      body+
    '</div>';
  }

  // ══ PDF (новая вкладка → печать) ═══════════════════════
  function exportPdf(){
    var inv=RESULT_CTX.invite||{}, cases=RESULT_CTX.cases||[], ans=RESULT_CTX.answers||{};
    function e(s){return escH(s);}
    var meta=[inv.position,inv.template_title,inv.submitted_at].filter(Boolean).map(e).join(' · ');
    var body=cases.map(function(c){
      var qs=(c.questions||[]).map(function(q,qi){
        var v=(ans[q.id]==null?'':String(ans[q.id])).trim();
        return '<div class="q"><div class="qt"><b>'+(qi+1)+'.</b> '+e(q.text)+'</div>'+
          '<div class="a'+(v===''?' empty':'')+'">'+(v===''?'— нет ответа —':e(v))+'</div></div>';
      }).join('');
      return '<div class="blk"><div class="bh">'+e(c.title||'Кейс')+'</div>'+
        (c.description?'<div class="bd">'+e(c.description)+'</div>':'')+qs+'</div>';
    }).join('');
    var html='<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">'+
      '<title>Кейсы — '+e(inv.candidate_name||'кандидат')+'</title>'+
      '<style>'+
      '*{box-sizing:border-box}body{font-family:Arial,system-ui,sans-serif;color:#1a1a2e;margin:0;padding:28px 32px;font-size:13px;line-height:1.55}'+
      'h1{font-size:20px;margin:0 0 2px}.meta{color:#555;font-size:12px;margin-bottom:14px}'+
      '.instr{background:#eef4ff;border:1px solid #c7d7fe;border-radius:8px;padding:10px 12px;font-size:12px;color:#1e3a8a;margin-bottom:16px}'+
      '.blk{border:1px solid #e2e5ea;border-radius:8px;padding:14px;margin-bottom:12px;page-break-inside:avoid}'+
      '.bh{font-size:15px;font-weight:bold;color:#2563eb;margin-bottom:5px}'+
      '.bd{color:#374151;margin-bottom:10px;white-space:pre-wrap}'+
      '.q{margin-bottom:11px;page-break-inside:avoid}.qt{font-weight:600;margin-bottom:5px}'+
      '.a{border:1px solid #e5e7eb;border-left:3px solid #2563eb;border-radius:6px;padding:8px 11px;white-space:pre-wrap;background:#fafafa}'+
      '.a.empty{color:#9ca3af;font-style:italic;border-left-color:#d1d5db}'+
      '@media print{body{padding:0}}'+
      '</style></head><body>'+
      '<h1>'+e(inv.candidate_name||'Кандидат')+'</h1>'+
      '<div class="meta">'+(meta||'')+'</div>'+
      (inv.instruction?'<div class="instr">'+e(inv.instruction)+'</div>':'')+
      body+
      '</body></html>';
    var w=window.open('','_blank');
    if(!w){ showToast('Разрешите всплывающие окна для выгрузки PDF','err'); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(function(){ try{ w.print(); }catch(e){} }, 350);
  }

  // ══ УДАЛЕНИЕ ═══════════════════════════════════════════
  async function deleteAssessment(id){
    if(!id||!confirm('Удалить эту запись кейса вместе с ответами? Действие необратимо.'))return;
    var res=await callApi('deleteCaseAssessment',{id:id,caller_role:role()});
    if(res&&res.ok){ showToast('Удалено'); await renderList(document.getElementById('content')); }
    else showToast((res&&res.error)||'Ошибка','err');
  }

  // ══ РЕДАКТОР ШАБЛОНОВ ══════════════════════════════════
  async function renderEditor(){
    var el=document.getElementById('content');
    if(!canEditTpl()){ showToast('Редактирование шаблонов доступно Руководителю и Администратору','err'); renderList(el); return; }
    el.innerHTML='<div class="loading"><span class="spin spd"></span> Загружаем шаблоны…</div>';
    var tr=await callApi('getCaseTemplates',{});
    TEMPLATES=tr&&tr.ok?(tr.templates||[]):[];
    EDITOR=null;
    buildEditorList(el);
  }

  function buildEditorList(el){
    var cards=TEMPLATES.map(function(t){
      return '<div class="card" style="padding:16px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">'+
        '<div>'+
          '<div style="font-size:15px;font-weight:700;color:var(--ink)">'+escH(t.title)+'</div>'+
          '<div style="font-size:12px;color:var(--ink3);margin-top:3px">'+(t.cases||[]).length+' кейсов · '+countQ(t)+' вопросов'+(t.time_limit_min?' · до '+fmtMin(t.time_limit_min):'')+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:8px">'+
          '<button type="button" class="btn-sm" data-cact="tpl-edit" data-id="'+escH(t.id)+'">Редактировать</button>'+
          '<button type="button" class="btn-danger" data-cact="tpl-del" data-id="'+escH(t.id)+'">Удалить</button>'+
        '</div>'+
      '</div>';
    }).join('');

    el.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
        '<div>'+
          '<h2 style="font-size:18px;font-weight:700">Шаблоны кейсов</h2>'+
          '<p style="font-size:13px;color:var(--ink3);margin-top:2px">Наборы кейсов под должности. Добавляйте, редактируйте и удаляйте кейсы и вопросы.</p>'+
        '</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          '<button type="button" class="btn-sm" data-cact="list">← К списку кейсов</button>'+
          '<button type="button" class="btn-primary" data-cact="tpl-new">+ Новый шаблон</button>'+
        '</div>'+
      '</div>'+
      (TEMPLATES.length===0
        ?'<div class="card"><div class="empty" style="padding:50px"><h3>Шаблонов пока нет</h3><p>Создайте первый набор кейсов.</p></div></div>'
        :cards);
  }

  function fmtMin(m){ m=Number(m)||0; if(!m)return''; var h=Math.floor(m/60),mm=m%60; return (h?h+' ч ':'')+(mm?mm+' мин':(h?'':'0 мин')); }

  function editTemplate(id){
    var t=id?TEMPLATES.filter(function(x){return x.id===id;})[0]:null;
    if(id&&!t){ showToast('Шаблон не найден','err'); return; }
    EDITOR={ isNew:!id, template: t? JSON.parse(JSON.stringify(t)) : { title:'', instruction:'Ответьте письменно на все вопросы. Под каждым вопросом — место для ответа.', time_limit_min:0, cases:[] } };
    // гарантируем id у кейсов/вопросов
    EDITOR.template.cases=(EDITOR.template.cases||[]).map(function(c){
      c.id=c.id||tmpId('c'); c.questions=(c.questions||[]).map(function(q){q.id=q.id||tmpId('q');return q;}); return c;
    });
    buildEditorForm();
  }

  function buildEditorForm(){
    var el=document.getElementById('content');
    var t=EDITOR.template;
    var casesHtml=t.cases.map(function(c,ci){
      var qHtml=(c.questions||[]).map(function(q,qi){
        return '<div class="ce-q-row" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px">'+
          '<span style="font-size:12px;font-weight:700;color:#2563eb;padding-top:9px;min-width:18px">'+(qi+1)+'.</span>'+
          '<textarea class="finp ce-q-input" data-qid="'+escH(q.id)+'" rows="2" style="flex:1;resize:vertical" placeholder="Текст вопроса">'+escH(q.text||'')+'</textarea>'+
          '<button type="button" class="btn-danger" data-cact="ed-del-q" data-ci="'+ci+'" data-qi="'+qi+'" title="Удалить вопрос" style="margin-top:4px">✕</button>'+
        '</div>';
      }).join('');
      return '<div class="ce-case card" data-cid="'+escH(c.id)+'" style="padding:14px 16px;margin-bottom:12px;background:var(--bg,#fff)">'+
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'+
          '<input class="finp ce-case-title-input" value="'+escH(c.title||'')+'" placeholder="Название кейса (напр. Кейс 1)" style="font-weight:700">'+
          '<button type="button" class="btn-sm" data-cact="ed-up-case" data-ci="'+ci+'" title="Выше" '+(ci===0?'disabled':'')+'>↑</button>'+
          '<button type="button" class="btn-sm" data-cact="ed-down-case" data-ci="'+ci+'" title="Ниже" '+(ci===t.cases.length-1?'disabled':'')+'>↓</button>'+
          '<button type="button" class="btn-danger" data-cact="ed-del-case" data-ci="'+ci+'" title="Удалить кейс">Удалить</button>'+
        '</div>'+
        '<textarea class="finp ce-case-desc-input" rows="3" placeholder="Описание ситуации (условие кейса)" style="resize:vertical;margin-bottom:10px">'+escH(c.description||'')+'</textarea>'+
        '<div style="font-size:12px;font-weight:600;color:var(--ink2);margin-bottom:6px">Вопросы</div>'+
        qHtml+
        '<button type="button" class="btn-sm" data-cact="ed-add-q" data-ci="'+ci+'" style="margin-top:4px">+ Вопрос</button>'+
      '</div>';
    }).join('');

    el.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">'+
        '<h2 style="font-size:18px;font-weight:700">'+(EDITOR.isNew?'Новый шаблон кейсов':'Редактирование шаблона')+'</h2>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
          '<button type="button" class="btn-cancel" data-cact="ed-cancel">Отмена</button>'+
          '<button type="button" class="btn-save" data-cact="ed-save">Сохранить</button>'+
        '</div>'+
      '</div>'+
      '<div class="card" style="padding:16px 18px;margin-bottom:14px">'+
        '<div class="fg" style="margin-bottom:12px"><label class="flbl">Название шаблона (должность) <span class="req">*</span></label>'+
          '<input id="ce-title" class="finp" value="'+escH(t.title||'')+'" placeholder="напр. Руководитель проекта"></div>'+
        '<div class="fg" style="margin-bottom:12px"><label class="flbl">Инструкция для кандидата</label>'+
          '<textarea id="ce-instr" class="finp" rows="2" style="resize:vertical">'+escH(t.instruction||'')+'</textarea></div>'+
        '<div class="fg" style="max-width:280px"><label class="flbl">Лимит времени, минут (0 — без лимита)</label>'+
          '<input id="ce-time" class="finp" type="number" min="0" step="5" value="'+(Number(t.time_limit_min)||0)+'"></div>'+
      '</div>'+
      '<div style="font-size:14px;font-weight:700;color:var(--ink);margin:6px 2px 10px">Кейсы ('+t.cases.length+')</div>'+
      casesHtml+
      '<button type="button" class="btn-primary" data-cact="ed-add-case" style="margin-top:4px">+ Добавить кейс</button>';
  }

  function syncEditorFromDOM(){
    if(!EDITOR||!EDITOR.template)return;
    var t=EDITOR.template;
    var tt=document.getElementById('ce-title'); if(tt)t.title=tt.value;
    var ti=document.getElementById('ce-instr'); if(ti)t.instruction=ti.value;
    var tm=document.getElementById('ce-time'); if(tm)t.time_limit_min=Number(tm.value)||0;
    var cases=[];
    document.querySelectorAll('.ce-case').forEach(function(card){
      var titleEl=card.querySelector('.ce-case-title-input');
      var descEl=card.querySelector('.ce-case-desc-input');
      var qs=[];
      card.querySelectorAll('.ce-q-input').forEach(function(qi){
        qs.push({ id:qi.dataset.qid||tmpId('q'), text:qi.value });
      });
      cases.push({ id:card.dataset.cid||tmpId('c'), title:titleEl?titleEl.value:'', description:descEl?descEl.value:'', questions:qs });
    });
    t.cases=cases;
  }

  function addCase(){ syncEditorFromDOM(); EDITOR.template.cases.push({id:tmpId('c'),title:'Кейс '+(EDITOR.template.cases.length+1),description:'',questions:[{id:tmpId('q'),text:''}]}); buildEditorForm(); }
  function delCase(ci){ syncEditorFromDOM(); if(!confirm('Удалить этот кейс целиком?'))return; EDITOR.template.cases.splice(ci,1); buildEditorForm(); }
  function moveCase(ci,dir){ syncEditorFromDOM(); var a=EDITOR.template.cases; var ni=ci+dir; if(ni<0||ni>=a.length)return; var tmp=a[ci];a[ci]=a[ni];a[ni]=tmp; buildEditorForm(); }
  function addQuestion(ci){ syncEditorFromDOM(); EDITOR.template.cases[ci].questions.push({id:tmpId('q'),text:''}); buildEditorForm(); }
  function delQuestion(ci,qi){ syncEditorFromDOM(); EDITOR.template.cases[ci].questions.splice(qi,1); buildEditorForm(); }

  async function saveTemplate(){
    syncEditorFromDOM();
    var t=EDITOR.template;
    if(!(t.title||'').trim()){ showToast('Укажите название шаблона','err'); return; }
    // чистим пустые вопросы
    t.cases=(t.cases||[]).map(function(c){ c.questions=(c.questions||[]).filter(function(q){return (q.text||'').trim()!=='';}); return c; });
    var res=await callApi('saveCaseTemplate',{ template:t, caller_role:role(), caller_name:g.U?g.U.name:'' });
    if(res&&res.ok){ showToast('Шаблон сохранён ✓'); await renderEditor(); }
    else showToast((res&&res.error)||'Не удалось сохранить','err');
  }

  async function deleteTemplate(id){
    if(!id||!confirm('Удалить этот шаблон кейсов? Действие необратимо.'))return;
    var res=await callApi('deleteCaseTemplate',{id:id,caller_role:role(),caller_name:g.U?g.U.name:''});
    if(res&&res.ok){ showToast('Шаблон удалён'); await renderEditor(); }
    else showToast((res&&res.error)||'Ошибка','err');
  }

  // ══ ДЕЛЕГИРОВАНИЕ КЛИКОВ ═══════════════════════════════
  function initDelegation(){
    if(document.body._caseDeleg)return;
    document.body._caseDeleg=true;
    document.body.addEventListener('click',function(ev){
      var el=ev.target.closest&&ev.target.closest('[data-cact]');
      if(!el)return;
      var act=el.getAttribute('data-cact');
      var id=el.getAttribute('data-id');
      var ci=el.hasAttribute('data-ci')?Number(el.getAttribute('data-ci')):null;
      var qi=el.hasAttribute('data-qi')?Number(el.getAttribute('data-qi')):null;
      switch(act){
        case 'new': openRunModal(); break;
        case 'run-overlay': if(ev.target===el)closeRunModal(); break;
        case 'run-close': closeRunModal(); break;
        case 'send-email': sendEmail(); break;
        case 'run-platform': runPlatform(); break;
        case 'view': viewResult(id); break;
        case 'del': deleteAssessment(id); break;
        case 'export': exportPdf(); break;
        case 'list': renderList(document.getElementById('content')); break;
        case 'templates': renderEditor(); break;
        case 'tpl-new': editTemplate(null); break;
        case 'tpl-edit': editTemplate(id); break;
        case 'tpl-del': deleteTemplate(id); break;
        case 'ed-add-case': addCase(); break;
        case 'ed-del-case': delCase(ci); break;
        case 'ed-up-case': moveCase(ci,-1); break;
        case 'ed-down-case': moveCase(ci,1); break;
        case 'ed-add-q': addQuestion(ci); break;
        case 'ed-del-q': delQuestion(ci,qi); break;
        case 'ed-save': saveTemplate(); break;
        case 'ed-cancel': renderEditor(); break;
      }
    });
  }

  // ══ EXPOSE ═════════════════════════════════════════════
  g.CASES_MODULE={ renderList:renderList };
  if(typeof document!=='undefined'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initDelegation);
    else initDelegation();
  }

})(typeof window!=='undefined'?window:this);

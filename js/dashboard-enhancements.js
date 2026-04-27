// dashboard-enhancements.js — Этап 2 UI/UX:
//   • inline-редактирование статуса и рекрутера
//   • bulk-операции с чекбоксами
//   • канбан-вид с drag-and-drop
//   • дубликат вакансии
// Подключается ПОСЛЕ app.js (использует api, VACS, openVacModal, refreshDash...).
(function(){
  'use strict';

  // Проверка готовности зависимостей — модуль ничего не делает без них
  function isReady(){
    return typeof window.VACS!=='undefined'
      && typeof window.api==='function'
      && typeof window.refreshDash==='function';
  }

  // ═══ INLINE-РЕДАКТИРОВАНИЕ СТАТУСА ════════════════════════════════
  // Заменяет бейдж статуса на <select>. Для активных статусов
  // (В работе / Приостановлена) применяется сразу. Для финальных
  // (Закрыта / Отменена / Передана) открывает существующую модалку
  // QSM с предзаполненным новым статусом, чтобы пользователь
  // указал дату/рекрутера.
  function startInlineStatus(vacId){
    if(!isReady())return;
    const vac=window.VACS.find(v=>String(v.id)===String(vacId));
    if(!vac)return;
    if(typeof window.canEdit==='function'&&!window.canEdit()){
      // Рекрутер не может менять статус инлайн — открываем читаемую модалку
      if(typeof window.openQuickStatusModal==='function')window.openQuickStatusModal(vac);
      return;
    }
    const cell=document.querySelector('td.td-status[data-vacid="'+CSS.escape(String(vacId))+'"]');
    if(!cell)return;
    // Если уже открыт inline-select — не открываем второй
    if(cell.querySelector('select.inline-status'))return;
    const statuses=['В работе','Приостановлена','Закрыта','Отменена','Передана'];
    const opts=statuses.map(s=>'<option'+(s===vac.status?' selected':'')+'>'+s+'</option>').join('');
    const original=cell.innerHTML;
    cell.innerHTML='<select class="inline-status finp" style="padding:4px 22px 4px 8px;font-size:12px;background-position:right 6px center">'+opts+'</select>';
    const sel=cell.querySelector('select');
    sel.focus();
    let done=false;
    const restore=()=>{cell.innerHTML=original;};
    const applyImmediate=async (newSt)=>{
      if(done)return;done=true;
      const prev={status:vac.status,fact_date:vac.fact_date||'',transferred:!!vac.transferred,transfer_date:vac.transfer_date||''};
      const fields={status:newSt,fact_date:''};
      vac.status=newSt;vac.fact_date='';
      window.refreshDash();
      const res=await window.api('updateVacancy',{id:vac.id,fields});
      if(res&&res.ok===false){
        // Откат
        vac.status=prev.status;vac.fact_date=prev.fact_date;
        window.refreshDash();
        window.toast(res.error||'Не удалось изменить статус','err');
        return;
      }
      window.toast('Статус: '+prev.status+' → '+newSt,'ok',{
        undo:async ()=>{
          vac.status=prev.status;vac.fact_date=prev.fact_date;
          window.refreshDash();
          const r2=await window.api('updateVacancy',{id:vac.id,fields:{status:prev.status,fact_date:prev.fact_date}});
          if(r2&&r2.ok===false){window.toast('Откат не удался','err');}
          else window.toast('Изменение статуса отменено');
        },
        duration:6000
      });
    };
    sel.addEventListener('change',()=>{
      const newSt=sel.value;
      if(newSt===vac.status){restore();return;}
      const requiresExtra=['Закрыта','Отменена','Передана'].indexOf(newSt)!==-1;
      if(requiresExtra){
        // Открываем модалку с предзаполненным статусом
        restore();
        if(typeof window.openQuickStatusModal==='function'){
          window.openQuickStatusModal(vac);
          // Поставим выбранный статус в <select> модалки
          setTimeout(()=>{
            const qsel=document.getElementById('qst-status');
            if(qsel){
              qsel.value=newSt;
              qsel.dispatchEvent(new Event('change'));
            }
          },30);
        }
        return;
      }
      applyImmediate(newSt);
    });
    sel.addEventListener('blur',()=>setTimeout(()=>{if(!done)restore();},150));
    sel.addEventListener('keydown',e=>{if(e.key==='Escape'){restore();}});
  }

  // ═══ INLINE-РЕДАКТИРОВАНИЕ РЕКРУТЕРА ═════════════════════════════
  function startInlineRecruiter(cell){
    if(!isReady())return;
    if(typeof window.canEdit==='function'&&!window.canEdit())return;
    if(!cell||cell.querySelector('select.inline-rec'))return;
    const vacId=cell.dataset.vacid;
    const vac=window.VACS.find(v=>String(v.id)===String(vacId));
    if(!vac)return;
    const recs=window.ACTIVE_TRANSFER_USERS||[];
    if(!recs.length){
      window.toast('Нет доступных рекрутеров для передачи','err');
      return;
    }
    const original=cell.innerHTML;
    const cur=vac.current_recruiter_id||'';
    const opts='<option value="">— оставить как есть —</option>'+
      recs.map(r=>'<option value="'+r.id+'" data-name="'+(r.name||'').replace(/"/g,'&quot;')+'"'+(String(r.id)===String(cur)?' selected':'')+'>'+(r.name||'')+'</option>').join('');
    cell.innerHTML='<select class="inline-rec finp" style="padding:4px 22px 4px 8px;font-size:12px;background-position:right 6px center">'+opts+'</select>';
    const sel=cell.querySelector('select');
    sel.focus();
    let done=false;
    const restore=()=>{cell.innerHTML=original;};
    sel.addEventListener('change',async ()=>{
      const newId=sel.value;
      if(!newId||String(newId)===String(cur)){restore();return;}
      const newName=sel.options[sel.selectedIndex].dataset.name||'';
      done=true;
      const prev={
        current_recruiter_id:vac.current_recruiter_id||'',
        current_recruiter_name:vac.current_recruiter_name||'',
        transferred:!!vac.transferred,
        transferred_from_id:vac.transferred_from_id||'',
        transferred_from_name:vac.transferred_from_name||'',
        transfer_date:vac.transfer_date||''
      };
      const today=(typeof window.today==='function')?window.today():new Date().toISOString().slice(0,10);
      const fields={
        current_recruiter_id:newId,
        current_recruiter_name:newName,
        transferred:true,
        transferred_from_id:window.U?window.U.id:'',
        transferred_from_name:window.U?window.U.name:'',
        transfer_date:today
      };
      Object.assign(vac,fields);
      window.refreshDash();
      const res=await window.api('updateVacancy',{id:vac.id,fields});
      if(res&&res.ok===false){
        Object.assign(vac,prev);
        window.refreshDash();
        window.toast(res.error||'Не удалось передать вакансию','err');
        return;
      }
      window.toast('Передано рекрутеру: '+newName,'ok',{
        undo:async ()=>{
          Object.assign(vac,prev);
          window.refreshDash();
          const r2=await window.api('updateVacancy',{id:vac.id,fields:prev});
          if(r2&&r2.ok===false)window.toast('Откат не удался','err');
          else window.toast('Передача отменена');
        },
        duration:6000
      });
    });
    sel.addEventListener('blur',()=>setTimeout(()=>{if(!done)restore();},150));
    sel.addEventListener('keydown',e=>{if(e.key==='Escape'){restore();}});
  }

  // ═══ BULK-ОПЕРАЦИИ ═══════════════════════════════════════════════
  function refreshBulkBar(){
    const bar=document.getElementById('bulk-bar');
    if(!bar)return;
    const sel=window.VAC_SELECTED;
    if(!sel||!sel.size){bar.hidden=true;bar.innerHTML='';return;}
    const n=sel.size;
    bar.hidden=false;
    const canDel=typeof window.canDelete==='function'?window.canDelete():false;
    bar.innerHTML=
      '<div class="bulk-bar-info"><b>'+n+'</b> '+pluralize(n,'выделена','выделено','выделено')+'</div>'+
      '<button type="button" class="papply" data-bulk="status">Сменить статус</button>'+
      '<button type="button" class="papply" data-bulk="transfer">Передать</button>'+
      (canDel?'<button type="button" class="btn-danger" data-bulk="delete">Удалить</button>':'')+
      '<button type="button" class="btn-cancel" data-bulk="clear">Сбросить выбор</button>';
    Array.prototype.forEach.call(bar.querySelectorAll('button[data-bulk]'),b=>{
      b.addEventListener('click',()=>{
        const a=b.dataset.bulk;
        if(a==='clear'){window.VAC_SELECTED.clear();window.refreshDash();}
        else if(a==='status')bulkStatusModal();
        else if(a==='transfer')bulkTransferModal();
        else if(a==='delete')bulkDelete();
      });
    });
  }
  function pluralize(n,one,few,many){
    const m10=n%10, m100=n%100;
    if(m10===1&&m100!==11)return one;
    if(m10>=2&&m10<=4&&(m100<10||m100>=20))return few;
    return many;
  }
  // Делегирование чекбоксов
  document.addEventListener('change',function(e){
    const t=e.target;
    if(!t)return;
    if(t.id==='cb-all'){
      const checked=t.checked;
      const rows=document.querySelectorAll('#vtbl tr[data-vacid]');
      Array.prototype.forEach.call(rows,tr=>{
        const id=String(tr.dataset.vacid);
        if(checked)window.VAC_SELECTED.add(id);else window.VAC_SELECTED.delete(id);
        const cb=tr.querySelector('input.cb-row');
        if(cb)cb.checked=checked;
        tr.classList.toggle('row-checked',checked);
      });
      refreshBulkBar();
      return;
    }
    if(t.classList&&t.classList.contains('cb-row')){
      const id=String(t.dataset.vacid);
      if(t.checked)window.VAC_SELECTED.add(id);else window.VAC_SELECTED.delete(id);
      const tr=t.closest('tr');
      if(tr)tr.classList.toggle('row-checked',t.checked);
      // Синхронизируем «выбрать все»
      const all=document.getElementById('cb-all');
      if(all){
        const allRows=document.querySelectorAll('#vtbl input.cb-row');
        const checkedRows=document.querySelectorAll('#vtbl input.cb-row:checked');
        all.checked=allRows.length>0&&checkedRows.length===allRows.length;
        all.indeterminate=checkedRows.length>0&&checkedRows.length<allRows.length;
      }
      refreshBulkBar();
    }
  });

  function selectedVacs(){
    const arr=[];
    if(!window.VACS||!window.VAC_SELECTED)return arr;
    window.VAC_SELECTED.forEach(id=>{
      const v=window.VACS.find(x=>String(x.id)===String(id));
      if(v)arr.push(v);
    });
    return arr;
  }

  // Bulk: смена статуса
  function bulkStatusModal(){
    const vacs=selectedVacs();
    if(!vacs.length)return;
    const statuses=['В работе','Приостановлена','Закрыта','Отменена'];
    const optHtml=statuses.map(s=>'<option>'+s+'</option>').join('');
    const today=(typeof window.today==='function')?window.today():new Date().toISOString().slice(0,10);
    const html='<div class="modal-overlay" id="bulk-modal">'+
      '<div class="modal" style="max-width:460px">'+
        '<div class="modal-hdr"><span class="modal-ttl">Сменить статус ('+vacs.length+')</span><button type="button" class="modal-close" id="bulk-x">✕</button></div>'+
        '<div class="modal-body"><div class="form-grid">'+
          '<div class="fg full"><label class="flbl">Новый статус</label><select id="bulk-status" class="finp">'+optHtml+'</select></div>'+
          '<div class="fg full" id="bulk-date-wrap"><label class="flbl">Дата (для финальных статусов)</label><input id="bulk-date" type="date" class="finp" value="'+today+'"></div>'+
        '</div></div>'+
        '<div class="modal-footer"><div></div><div style="display:flex;gap:10px"><button type="button" class="btn-cancel" id="bulk-cancel">Отмена</button><button type="button" class="btn-save" id="bulk-apply">Применить</button></div></div>'+
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
    const ovl=document.getElementById('bulk-modal');
    const close=()=>{if(ovl)ovl.remove();};
    document.getElementById('bulk-x').onclick=close;
    document.getElementById('bulk-cancel').onclick=close;
    ovl.addEventListener('click',e=>{if(e.target===ovl)close();});
    const sync=()=>{
      const st=document.getElementById('bulk-status').value;
      document.getElementById('bulk-date-wrap').style.display=['Закрыта','Отменена'].indexOf(st)!==-1?'':'none';
    };
    document.getElementById('bulk-status').addEventListener('change',sync);
    sync();
    document.getElementById('bulk-apply').onclick=async ()=>{
      const st=document.getElementById('bulk-status').value;
      const isFinal=['Закрыта','Отменена'].indexOf(st)!==-1;
      const dt=isFinal?document.getElementById('bulk-date').value:'';
      if(isFinal&&!dt){window.toast('Укажи дату','err');return;}
      close();
      const fields={status:st};
      if(isFinal)fields.fact_date=dt;else fields.fact_date='';
      window.toast('Применяем к '+vacs.length+'...','ok',{duration:1500});
      const results=await Promise.all(vacs.map(v=>window.api('updateVacancy',{id:v.id,fields})));
      let okN=0,errN=0;
      results.forEach((r,i)=>{
        if(r&&r.ok===false){errN++;}
        else{okN++;Object.assign(vacs[i],fields);}
      });
      window.VAC_SELECTED.clear();
      window.refreshDash();
      if(errN)window.toast('Готово: '+okN+' успешно, '+errN+' с ошибкой','err');
      else window.toast('Готово: обновлено '+okN);
    };
  }

  // Bulk: передать рекрутеру
  function bulkTransferModal(){
    const vacs=selectedVacs();
    if(!vacs.length)return;
    const recs=window.ACTIVE_TRANSFER_USERS||[];
    if(!recs.length){window.toast('Нет доступных рекрутеров','err');return;}
    const optHtml='<option value="">— выберите рекрутера —</option>'+
      recs.map(r=>'<option value="'+r.id+'" data-name="'+(r.name||'').replace(/"/g,'&quot;')+'">'+(r.name||'')+'</option>').join('');
    const today=(typeof window.today==='function')?window.today():new Date().toISOString().slice(0,10);
    const html='<div class="modal-overlay" id="bulk-modal">'+
      '<div class="modal" style="max-width:460px">'+
        '<div class="modal-hdr"><span class="modal-ttl">Передать ('+vacs.length+')</span><button type="button" class="modal-close" id="bulk-x">✕</button></div>'+
        '<div class="modal-body"><div class="form-grid">'+
          '<div class="fg full"><label class="flbl">Новый рекрутер</label><select id="bulk-rec" class="finp">'+optHtml+'</select></div>'+
          '<div class="fg full"><label class="flbl">Дата передачи</label><input id="bulk-tdate" type="date" class="finp" value="'+today+'"></div>'+
        '</div></div>'+
        '<div class="modal-footer"><div></div><div style="display:flex;gap:10px"><button type="button" class="btn-cancel" id="bulk-cancel">Отмена</button><button type="button" class="btn-save" id="bulk-apply">Применить</button></div></div>'+
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend',html);
    const ovl=document.getElementById('bulk-modal');
    const close=()=>{if(ovl)ovl.remove();};
    document.getElementById('bulk-x').onclick=close;
    document.getElementById('bulk-cancel').onclick=close;
    ovl.addEventListener('click',e=>{if(e.target===ovl)close();});
    document.getElementById('bulk-apply').onclick=async ()=>{
      const recSel=document.getElementById('bulk-rec');
      const recId=recSel.value;
      const recName=recId?recSel.options[recSel.selectedIndex].dataset.name:'';
      const dt=document.getElementById('bulk-tdate').value||today;
      if(!recId){window.toast('Выбери рекрутера','err');return;}
      close();
      const baseFields={
        current_recruiter_id:recId,
        current_recruiter_name:recName,
        transferred:true,
        transferred_from_id:window.U?window.U.id:'',
        transferred_from_name:window.U?window.U.name:'',
        transfer_date:dt
      };
      window.toast('Передаём '+vacs.length+'...','ok',{duration:1500});
      const results=await Promise.all(vacs.map(v=>window.api('updateVacancy',{id:v.id,fields:baseFields})));
      let okN=0,errN=0;
      results.forEach((r,i)=>{
        if(r&&r.ok===false)errN++;
        else{okN++;Object.assign(vacs[i],baseFields);}
      });
      window.VAC_SELECTED.clear();
      window.refreshDash();
      if(errN)window.toast('Готово: '+okN+' успешно, '+errN+' с ошибкой','err');
      else window.toast('Передано: '+okN);
    };
  }

  // Bulk: удалить
  function bulkDelete(){
    const vacs=selectedVacs();
    if(!vacs.length)return;
    if(!window.confirm('Удалить '+vacs.length+' вакансий? Действие можно отменить в течение 6 секунд.'))return;
    // Снимаем из VACS оптимистично
    const removed=vacs.slice();
    removed.forEach(v=>{
      const idx=window.VACS.findIndex(x=>String(x.id)===String(v.id));
      if(idx!==-1)window.VACS.splice(idx,1);
    });
    window.VAC_SELECTED.clear();
    window.refreshDash();
    let cancelled=false;
    const finalize=async ()=>{
      if(cancelled)return;
      const results=await Promise.all(removed.map(v=>window.api('deleteVacancy',{id:v.id})));
      const failed=[];
      results.forEach((r,i)=>{if(r&&r.ok===false)failed.push(removed[i]);});
      if(failed.length){
        // Возвращаем неудалённые
        failed.forEach(v=>window.VACS.unshift(v));
        window.refreshDash();
        window.toast('Не удалены: '+failed.length,'err');
      }
    };
    const timer=setTimeout(finalize,6000);
    window.toast('Удалено: '+removed.length,'ok',{
      undo:()=>{
        cancelled=true;
        clearTimeout(timer);
        removed.forEach(v=>window.VACS.unshift(v));
        window.refreshDash();
        window.toast('Удаление отменено');
      },
      duration:6000
    });
  }

  // ═══ ДУБЛИКАТ ВАКАНСИИ ═══════════════════════════════════════════
  function duplicateVac(vacId){
    if(!isReady())return;
    if(typeof window.canCreate==='function'&&!window.canCreate())return;
    const vac=window.VACS.find(v=>String(v.id)===String(vacId));
    if(!vac){window.toast('Вакансия не найдена','err');return;}
    // Клон с очищенными «личными» полями: id, даты, статус, передача
    const clone=Object.assign({},vac,{
      id:undefined,
      num:undefined,
      date_opened:(typeof window.today==='function')?window.today():new Date().toISOString().slice(0,10),
      fact_date:'',
      transfer_date:'',
      transferred:false,
      transferred_from_id:'',
      transferred_from_name:'',
      status:'В работе',
      days_total:null,
      plan_date:''
    });
    // Префикс «Копия —» к названию (если ещё не дубль)
    if(clone.name&&clone.name.indexOf('Копия')===-1)clone.name='Копия — '+clone.name;
    if(typeof window.openVacModal==='function'){
      window.openVacModal(clone);
      // openVacModal с непустым vac входит в режим «edit»; но id=undefined → saveVac воспримет как create
      // Дополнительно поправим заголовок и кнопку
      setTimeout(()=>{
        const ttl=document.querySelector('#vac-modal .modal-ttl');
        if(ttl)ttl.textContent='Дубликат вакансии';
        const sb=document.getElementById('btn-save-vac');
        if(sb){sb.textContent='Создать вакансию';sb.dataset.vacid='';}
      },20);
      window.toast('Заполни и сохрани — будет создана новая вакансия');
    }
  }

  // ═══ КАНБАН-ВИД С DRAG-AND-DROP ══════════════════════════════════
  function renderKanban(vacs){
    const el=document.getElementById('vtbl');
    if(!el)return;
    if(!vacs.length){
      el.innerHTML='<div class="empty" style="padding:36px"><p style="color:var(--ink3)">Нет вакансий по выбранным фильтрам</p></div>';
      return;
    }
    const cols=[
      {key:'В работе',     cls:'sw',  color:'var(--blue)'},
      {key:'Приостановлена',cls:'sp', color:'var(--amber)'},
      {key:'Закрыта',      cls:'sc2', color:'var(--green)'},
      {key:'Отменена',     cls:'sca', color:'var(--red)'},
      {key:'Передана',     cls:'st',  color:'var(--violet)'}
    ];
    const byStatus={};
    cols.forEach(c=>byStatus[c.key]=[]);
    vacs.forEach(v=>{(byStatus[v.status]||(byStatus[v.status]=[])).push(v);});
    // Сортируем внутри колонки по дате открытия
    cols.forEach(c=>byStatus[c.key].sort((a,b)=>(b.date_opened||'').localeCompare(a.date_opened||'')));
    const fmt=(d)=>typeof window.fru==='function'?window.fru(d):(d||'');
    const escH=(s)=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    function cardHtml(v){
      const heat=(window.VAC_UI&&window.VAC_UI.vacancyHeatClass)?window.VAC_UI.vacancyHeatClass(v):'';
      const days=Number(v.days_total)||0;
      const norm=Number(v.norm_days)||0;
      const grpBadge=v.vacancy_group?'<span style="font-size:9px;color:var(--ink3);background:var(--bg);padding:1px 6px;border-radius:4px">'+escH(v.vacancy_group)+'</span>':'';
      return '<div class="kb-card '+heat+'" draggable="true" data-vacid="'+escH(v.id)+'">'+
        '<div class="kb-card-ttl">'+escH(v.name)+'</div>'+
        '<div class="kb-card-meta">'+
          (grpBadge)+
          (v.current_recruiter_name?'<span class="kb-rec">'+escH(v.current_recruiter_name)+'</span>':'')+
        '</div>'+
        '<div class="kb-card-foot">'+
          '<span class="kb-days">'+days+'д'+(norm?' / '+norm:'')+'</span>'+
          '<span class="kb-date">'+fmt(v.date_opened)+'</span>'+
        '</div>'+
      '</div>';
    }
    el.innerHTML='<div class="kanban-board">'+
      cols.map(c=>{
        const items=byStatus[c.key]||[];
        return '<div class="kb-col" data-col-status="'+escH(c.key)+'">'+
          '<div class="kb-col-hdr"><span class="badge '+c.cls+'">'+escH(c.key)+'</span><span class="kb-cnt">'+items.length+'</span></div>'+
          '<div class="kb-col-body">'+
            (items.length?items.map(cardHtml).join(''):'<div class="kb-empty">Нет</div>')+
          '</div>'+
        '</div>';
      }).join('')+
    '</div>';
    // DnD
    bindKanbanDnd(el);
  }

  let DRAG_ID=null;
  function bindKanbanDnd(root){
    Array.prototype.forEach.call(root.querySelectorAll('.kb-card'),card=>{
      card.addEventListener('dragstart',e=>{
        DRAG_ID=card.dataset.vacid;
        card.classList.add('kb-dragging');
        try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',DRAG_ID);}catch(err){}
      });
      card.addEventListener('dragend',()=>{
        card.classList.remove('kb-dragging');
        DRAG_ID=null;
        Array.prototype.forEach.call(root.querySelectorAll('.kb-col.drop-active'),c=>c.classList.remove('drop-active'));
      });
      // Клик по карточке открывает редактирование
      card.addEventListener('click',()=>{
        const v=window.VACS.find(x=>String(x.id)===String(card.dataset.vacid));
        if(v&&typeof window.openVacModal==='function')window.openVacModal(v);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.kb-col'),col=>{
      col.addEventListener('dragover',e=>{
        if(!DRAG_ID)return;
        e.preventDefault();
        try{e.dataTransfer.dropEffect='move';}catch(err){}
        col.classList.add('drop-active');
      });
      col.addEventListener('dragleave',e=>{
        if(e.target===col)col.classList.remove('drop-active');
      });
      col.addEventListener('drop',async e=>{
        e.preventDefault();
        col.classList.remove('drop-active');
        const id=DRAG_ID;
        DRAG_ID=null;
        if(!id)return;
        const newStatus=col.dataset.colStatus;
        const vac=window.VACS.find(x=>String(x.id)===String(id));
        if(!vac||vac.status===newStatus)return;
        // Если новый статус требует доп. поля — открываем QSM
        const requiresExtra=['Закрыта','Отменена','Передана'].indexOf(newStatus)!==-1;
        if(requiresExtra){
          if(typeof window.openQuickStatusModal==='function'){
            window.openQuickStatusModal(vac);
            setTimeout(()=>{
              const qsel=document.getElementById('qst-status');
              if(qsel){qsel.value=newStatus;qsel.dispatchEvent(new Event('change'));}
            },30);
          }
          return;
        }
        // Иначе применяем сразу
        const prev={status:vac.status,fact_date:vac.fact_date||''};
        vac.status=newStatus;vac.fact_date='';
        window.refreshDash();
        const res=await window.api('updateVacancy',{id:vac.id,fields:{status:newStatus,fact_date:''}});
        if(res&&res.ok===false){
          Object.assign(vac,prev);window.refreshDash();
          window.toast(res.error||'Не удалось изменить статус','err');
          return;
        }
        window.toast('Статус: '+prev.status+' → '+newStatus,'ok',{
          undo:async ()=>{
            Object.assign(vac,prev);window.refreshDash();
            const r2=await window.api('updateVacancy',{id:vac.id,fields:{status:prev.status,fact_date:prev.fact_date}});
            if(r2&&r2.ok===false)window.toast('Откат не удался','err');
          },
          duration:6000
        });
      });
    });
  }

  // ═══ ДЕЛЕГИРОВАНИЕ КЛИКА ПО ЯЧЕЙКЕ РЕКРУТЕРА ════════════════════
  document.addEventListener('click',function(e){
    const cell=e.target&&e.target.closest&&e.target.closest('td.td-recruiter[data-cell="recruiter"]');
    if(!cell)return;
    if(cell.querySelector('select.inline-rec'))return;
    startInlineRecruiter(cell);
  });

  // ═══ ЭКСПОРТ ═════════════════════════════════════════════════════
  window.VAC_DASH={
    startInlineStatus:startInlineStatus,
    refreshBulkBar:refreshBulkBar,
    duplicateVac:duplicateVac,
    renderKanban:renderKanban
  };
})();

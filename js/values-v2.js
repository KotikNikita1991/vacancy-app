// values-v2.js — альтернативный ("V2") расчёт % соответствия профилю компании.
// Работает ПАРАЛЛЕЛЬНО с текущим расчётом: ничего не ломает и не заменяет.
// Подключение: <script src="js/values-v2.js"></script> в index.html после app.js.
// Формула: градиентный штраф за выход из диапазона × вес приоритета. Без жёстких вычетов.
(function(){
  'use strict';

  var COMPANY_PROFILE_V2=[
    {abbr:'SDT',name:'Самостоятельность мысли',     min:4.5,max:6.0,priority:'KEY',      direction:'high'},
    {abbr:'SDA',name:'Самостоятельность поступков', min:4.0,max:5.5,priority:'KEY',      direction:'high'},
    {abbr:'ST', name:'Стимуляция',                  min:3.5,max:5.0,priority:'IMPORTANT',direction:'high'},
    {abbr:'HE', name:'Гедонизм',                    min:2.5,max:4.0,priority:'NEUTRAL',  direction:'high'},
    {abbr:'AC', name:'Достижение',                  min:4.5,max:6.0,priority:'KEY',      direction:'high'},
    {abbr:'POD',name:'Власть: доминирование',       min:1.5,max:3.5,priority:'UNWANTED', direction:'low' },
    {abbr:'POR',name:'Власть: ресурсы',             min:2.5,max:4.0,priority:'NEUTRAL',  direction:'low' },
    {abbr:'FAC',name:'Лицо (репутация)',             min:2.0,max:3.5,priority:'UNWANTED', direction:'low' },
    {abbr:'SEP',name:'Безопасность: личная',        min:3.0,max:4.5,priority:'NEUTRAL',  direction:'high'},
    {abbr:'SES',name:'Безопасность: общественная',  min:2.5,max:4.0,priority:'NEUTRAL',  direction:'high'},
    {abbr:'TR', name:'Традиция',                    min:1.5,max:3.0,priority:'UNWANTED', direction:'low' },
    {abbr:'COR',name:'Конформность: правила',       min:2.0,max:3.5,priority:'UNWANTED', direction:'low' },
    {abbr:'COI',name:'Конформность: межличностная', min:3.0,max:4.5,priority:'NEUTRAL',  direction:'high'},
    {abbr:'HUM',name:'Скромность',                  min:3.5,max:5.0,priority:'IMPORTANT',direction:'high'},
    {abbr:'BEC',name:'Благожелательность: забота',  min:4.5,max:6.0,priority:'KEY',      direction:'high'},
    {abbr:'BED',name:'Благожелательность: долг',    min:4.5,max:6.0,priority:'KEY',      direction:'high'},
    {abbr:'UNC',name:'Универсализм: забота',        min:5.0,max:6.0,priority:'KEY',      direction:'high'},
    {abbr:'UNN',name:'Универсализм: природа',       min:2.0,max:4.0,priority:'NEUTRAL',  direction:'high'},
    {abbr:'UNT',name:'Универсализм: толерантность', min:4.0,max:5.5,priority:'IMPORTANT',direction:'high'}
  ];
  var WEIGHTS_V2={KEY:4,IMPORTANT:2,NEUTRAL:1,UNWANTED:3};

  function escHtml(s){if(s==null||s==='')return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  // Градиентный штраф БЕЗ множителей ×1.5 — чистая дистанционная оценка
  function calcValueScoreV2(score,cfg){
    var min=cfg.min,max=cfg.max;
    if(score>=min&&score<=max)return 1.0;
    var distance,maxDistance,penalty;
    if(score<min){
      distance=min-score; maxDistance=min-1.0;
      penalty=maxDistance>0?distance/maxDistance:1;
    }else{
      distance=score-max; maxDistance=6.0-max;
      penalty=maxDistance>0?distance/maxDistance:1;
    }
    return Math.max(0,1.0-Math.min(1,penalty));
  }

  // Критические флаги — только для отображения как предупреждений, не снижают балл
  function calcCriticalPenaltiesV2(s){
    var flags=[];
    function has(k){return Number.isFinite(Number(s[k]));}
    if(has('UNC')&&s.UNC<4.5){flags.push('UNC < 4.5: невысокая забота о справедливости — уточнить на интервью');}
    if(has('BEC')&&s.BEC<4.0){flags.push('BEC < 4.0: невысокая забота о людях — уточнить на интервью');}
    if(has('POD')&&s.POD>4.0){flags.push('POD > 4.0: выраженное доминирование — проверить управленческий стиль');}
    if(has('TR') &&s.TR >3.5){flags.push('TR > 3.5: высокая традиционность — риск сопротивления развитию');}
    if(has('AC')&&has('BEC')&&s.AC>=5.0&&s.BEC<=2.5){flags.push('AC ≥ 5.0 + BEC ≤ 2.5: конфликт «достижение без заботы» — важно обсудить');}
    if(has('SDT')&&has('SDA')&&s.SDT<3.5&&s.SDA<3.5){flags.push('SDT + SDA оба < 3.5: низкая самостоятельность мышления и действий');}
    return{triggeredFlags:flags};
  }

  function extractRawScoresByAbbrV2(r){
    if(!r||typeof r!=='object')return null;
    var out={};
    var map=(typeof VALUE_ABBR_BY_ID_FRONT!=='undefined')?VALUE_ABBR_BY_ID_FRONT:null;
    var raw=r.raw_scores||r.base_scores||r.values_raw;
    if(raw&&typeof raw==='object'){
      Object.keys(raw).forEach(function(k){
        var n=Number(raw[k]);
        if(!Number.isFinite(n))return;
        var abbr=(map&&map[k])?map[k]:k;
        out[abbr]=n;
      });
      if(Object.keys(out).length>=10)return out;
    }
    var scores=r.scores||{},mean=Number(r.mean57||0);
    if(Number.isFinite(mean)&&map){
      Object.keys(map).forEach(function(id){
        var v=Number(scores[id]);
        if(Number.isFinite(v))out[map[id]]=Number((v+mean).toFixed(3));
      });
    }
    if(Object.keys(out).length<10){
      var p=r.profile||{};
      ['lead_values','key_values','risk_values','critical_risk_values','all_values'].forEach(function(k){
        var arr=Array.isArray(p[k])?p[k]:[];
        arr.forEach(function(it){
          var a=it&&it.abbr, v=Number(it&&it.score);
          if(a&&Number.isFinite(v)&&out[a]==null)out[a]=v;
        });
      });
    }
    return Object.keys(out).length?out:null;
  }

  function computeMatchV2(rawByAbbr){
    if(!rawByAbbr||typeof rawByAbbr!=='object')return null;
    var weightedSum=0,totalWeight=0,breakdown=[];
    COMPANY_PROFILE_V2.forEach(function(cfg){
      var v=Number(rawByAbbr[cfg.abbr]);
      if(!Number.isFinite(v))return;
      var raw=calcValueScoreV2(v,cfg);
      var w=WEIGHTS_V2[cfg.priority]||1;
      weightedSum+=raw*w; totalWeight+=w;
      breakdown.push({abbr:cfg.abbr,name:cfg.name,priority:cfg.priority,score:v,idealMin:cfg.min,idealMax:cfg.max,rawScore:Math.round(raw*100),weight:w,inRange:v>=cfg.min&&v<=cfg.max});
    });
    if(!totalWeight)return null;
    var base=weightedSum/totalWeight;
    // Итог = чистый взвешенный градиент, без вычетов
    var final=Math.round(base*100);
    var level=final>=75?'green':final>=55?'yellow':'red';
    var levelLabel=level==='green'?'Зелёный':level==='yellow'?'Жёлтый':'Красный';
    var crit=calcCriticalPenaltiesV2(rawByAbbr);
    return{finalScore:final,baseScore:final,level:level,levelLabel:levelLabel,triggeredFlags:crit.triggeredFlags,breakdown:breakdown};
  }

  function badgeHtml(m){
    if(!m)return '<span style="font-size:11px;color:var(--ink3)">Недостаточно данных</span>';
    var map={green:['Зелёный','#2F855A','#e8fff3'],yellow:['Жёлтый','#B7791F','#fff6dd'],red:['Красный','#E35B6A','#ffe9ec']};
    var t=map[m.level]||['—','#4a5568','#edf2f7'];
    return '<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:'+t[2]+';color:'+t[1]+';font-weight:700;font-size:12px">V2 · '+t[0]+' · '+m.finalScore+'%</span>';
  }

  function renderCardHtml(m){
    var scoreNote=m?('<div style="margin-top:4px">Взвешенный результат: <b>'+m.finalScore+'%</b> (градиент по всем 19 ценностям).</div>'):'';
    var flagsBlock='';
    if(m&&m.triggeredFlags&&m.triggeredFlags.length){
      flagsBlock='<div style="margin-top:8px;padding:8px 10px;background:#fffbeb;border-radius:6px;font-size:11px;color:#744210;line-height:1.5">'+
        '<div style="font-weight:700;margin-bottom:3px">На заметку — уточнить на интервью:</div>'+
        m.triggeredFlags.map(function(f){return '<div>• '+escHtml(f)+'</div>';}).join('')+'</div>';
    }
    return (
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
        '<div class="ct">V2 · альтернативный расчёт <span style="font-weight:400;color:var(--ink3);font-size:11px">(эксперимент, параллельно основному)</span></div>'+
        badgeHtml(m)+
      '</div>'+
      '<div style="margin-top:6px;font-size:11px;color:var(--ink3);line-height:1.55">'+
        'Метод: для каждой из 19 ценностей — градиентный штраф за выход из идеального диапазона × вес приоритета (КЛЮЧЕВАЯ=4, ВАЖНАЯ=2, НЕЙТРАЛЬНАЯ=1, НЕЖЕЛАТЕЛЬНАЯ=3). Пороги: ≥75% — Зелёный, 55–74% — Жёлтый, &lt;55% — Красный.'+
        scoreNote+
      '</div>'+
      flagsBlock
    );
  }

  function findAnchorCard(root){
    var cards=root.querySelectorAll('.card');
    for(var i=0;i<cards.length;i++){
      if(cards[i].querySelector('[data-v2-card]'))continue;
      var t=cards[i].textContent||'';
      if(t.indexOf('Итог соответствия профилю компании')!==-1)return cards[i];
    }
    return null;
  }

  function injectV2(r){
    var content=document.getElementById('content');
    if(!content)return;
    if(content.querySelector('[data-v2-card]'))return;
    var anchor=findAnchorCard(content);
    if(!anchor)return;
    var match=computeMatchV2(extractRawScoresByAbbrV2(r));
    var node=document.createElement('div');
    node.className='card';
    node.setAttribute('data-v2-card','1');
    node.style.cssText='padding:12px 14px;margin-bottom:10px;border:1px dashed #cbd5e0;background:#fafbff';
    node.innerHTML=renderCardHtml(match);
    anchor.parentNode.insertBefore(node,anchor.nextSibling);
  }

  function currentResult(){
    try{
      if(typeof V_RESULT_CONTEXT!=='undefined'&&V_RESULT_CONTEXT&&V_RESULT_CONTEXT.result)return V_RESULT_CONTEXT.result;
    }catch(e){}
    return null;
  }

  function startObserver(){
    var target=document.getElementById('content');
    if(!target){setTimeout(startObserver,200);return;}
    var obs=new MutationObserver(function(){
      var r=currentResult();
      if(!r)return;
      injectV2(r);
    });
    obs.observe(target,{childList:true,subtree:true});
  }

  window.VALUES_V2={
    COMPANY_PROFILE:COMPANY_PROFILE_V2,
    WEIGHTS:WEIGHTS_V2,
    calcValueScore:calcValueScoreV2,
    calcCriticalPenalties:calcCriticalPenaltiesV2,
    extractRawScoresByAbbr:extractRawScoresByAbbrV2,
    computeMatch:computeMatchV2,
    badgeHtml:badgeHtml,
    renderCardHtml:renderCardHtml,
    inject:injectV2
  };

  // Визуальный инжект карточки V2 отключён — блок убран из интерфейса.
  // window.VALUES_V2 остаётся: extractRawScoresByAbbr нужна values-interpretation.js.
})();
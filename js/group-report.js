// group-report.js — Групповой отчёт ценностей (собирательный образ).
// Загружается после app.js, values-v2.js и values-interpretation.js.
(function(){
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Константы
  // ─────────────────────────────────────────────────────────────────────────

  // Порядок аббревиатур: совпадает с META_GROUPS в app.js (4+4+5+6)
  // чтобы дуговой плагин радара корректно раскрашивал сектора
  var ABBR_ORDER = [
    'SDT','SDA','ST','HE',           // Открытость изменениям (0-3)
    'AC','POD','POR','FAC',          // Самоутверждение (4-7)
    'SEP','SES','TR','COR','COI',    // Сохранение (8-12)
    'HUM','BEC','BED','UNC','UNN','UNT' // Самоопределение (13-18)
  ];

  // Идеальные значения — средина диапазона из профиля компании
  var IDEAL = {
    SDT:5.25, SDA:4.75, ST:4.25, HE:3.25,
    AC:5.25,  POD:2.5,  POR:3.25, FAC:2.75,
    SEP:3.75, SES:3.25, TR:2.25, COR:2.75, COI:3.75,
    HUM:4.25, BEC:5.25, BED:5.25, UNC:5.5, UNN:3.0, UNT:4.75
  };

  // Краткие описания ценностей для тултипа в таблице
  var VALUE_BRIEF = {
    SDT:'Стремление самостоятельно думать, генерировать идеи и исследовать. Ценит любопытство, творчество и интеллектуальную свободу.',
    SDA:'Стремление самостоятельно выбирать, планировать и выполнять действия без внешнего контроля.',
    ST: 'Потребность в новизне, переменах, захватывающих переживаниях. Жажда нестандартного.',
    HE: 'Стремление к удовольствию, наслаждению жизнью и комфорту. Ориентация на положительные эмоции.',
    AC: 'Стремление к личному успеху, признанию компетентности и демонстрации достижений.',
    POD:'Стремление к контролю над людьми, доминированию и сохранению власти и авторитета.',
    POR:'Стремление к контролю над ресурсами — деньгами, имуществом, статусом.',
    FAC:'Стремление поддерживать общественную репутацию, избегать позора и сохранять «лицо».',
    SEP:'Потребность в личной безопасности, стабильности и предсказуемости. Защита себя и близких.',
    SES:'Ориентация на безопасность общества, стабильность социального порядка и соблюдение законов.',
    TR: 'Уважение и следование культурным, религиозным и семейным традициям и устоям.',
    COR:'Следование правилам, регламентам и нормам поведения. Самоконтроль и дисциплинированность.',
    COI:'Стремление не причинять дискомфорта близким, поддерживать гармонию в отношениях.',
    HUM:'Принятие своего места в жизни, скромность, отказ от самовозвеличивания.',
    BEC:'Искренняя забота о благополучии близких, эмпатия, желание поддержать и помочь.',
    BED:'Надёжность, верность обязательствам, ответственность перед людьми и командой.',
    UNC:'Забота о справедливости, равенстве и защите всех людей. Приверженность этическим принципам.',
    UNN:'Забота об окружающей среде и природе. Ответственное отношение к экологии.',
    UNT:'Принятие и уважение людей, отличных от себя. Открытость к разнообразию взглядов и культур.'
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Утилиты
  // ─────────────────────────────────────────────────────────────────────────

  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function getCompleted(){
    var list = (typeof VLIST !== 'undefined') ? VLIST : [];
    // Завершённые — у которых есть profile_level или status === 'completed'
    return list.filter(function(v){ return v.profile_level || v.status === 'completed'; });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Состояние фильтра
  // ─────────────────────────────────────────────────────────────────────────

  var GR_STATE = { selected: new Set() };

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Экран фильтра (выбор выборки)
  // ─────────────────────────────────────────────────────────────────────────

  function renderGroupReportFilter(){
    var el = document.getElementById('content');
    if(!el) return;

    var completed = getCompleted();
    if(!completed.length){
      el.innerHTML =
        '<div class="card" style="padding:24px;text-align:center;color:var(--ink3)">' +
        '<div style="font-size:15px;font-weight:600;margin-bottom:6px">Нет завершённых оценок</div>' +
        '<div style="font-size:12px">Групповой отчёт формируется на основе пройденных оценок ценностей (PVQ‑RR).</div>' +
        '<button type="button" class="btn-cancel" style="margin-top:14px" data-act="val-list">← К списку</button>' +
        '</div>';
      return;
    }

    // Сброс состояния
    GR_STATE.selected = new Set();

    var depts = uniq(completed.map(function(v){return v.department||'';}).filter(Boolean)).sort();
    var groups = uniq(completed.map(function(v){return v.employee_group||'';}).filter(Boolean)).sort();

    el.innerHTML = buildFilterHtml(completed, depts, groups);
    wireFilterEvents(el, completed);
  }

  function uniq(arr){
    return arr.filter(function(v,i,a){ return a.indexOf(v)===i; });
  }

  function buildFilterHtml(completed, depts, groups){
    var deptChips = depts.map(function(d){
      return '<label class="gr-chip"><input type="checkbox" data-kind="dept" value="'+esc(d)+'"><span>'+esc(d)+'</span></label>';
    }).join('');

    var grpChips = groups.map(function(g){
      return '<label class="gr-chip"><input type="checkbox" data-kind="grp" value="'+esc(g)+'"><span>'+esc(g)+'</span></label>';
    }).join('');

    var empRows = completed.map(function(v){
      var lvl = v.profile_level || '';
      var lvlMap = {green:'Зелёный',yellow:'Жёлтый',red:'Красный',blue:'Синий'};
      var lvlCol = {green:'#2F855A',yellow:'#B7791F',red:'#E35B6A',blue:'#2B6CB0'};
      var pct = Number(v.profile_match_pct);
      return (
        '<label class="gr-emp-row" data-id="'+esc(v.id)+'" data-dept="'+esc(v.department||'')+'" data-grp="'+esc(v.employee_group||'')+'">' +
        '<input type="checkbox" data-kind="emp" value="'+esc(v.id)+'">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:13px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(v.candidate_name||'—')+'</div>' +
          '<div style="font-size:11px;color:var(--ink3)">'+esc(v.department||'—')+' · '+esc(v.employee_group||'—')+'</div>' +
        '</div>' +
        (lvl ? '<span style="font-size:11px;font-weight:700;white-space:nowrap;color:'+lvlCol[lvl]+'">'+esc(lvlMap[lvl]||lvl)+(Number.isFinite(pct)?' · '+pct+'%':'')+'</span>' : '') +
        '</label>'
      );
    }).join('');

    return (
      '<div style="max-width:860px;margin:0 auto">' +
      // Шапка
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
        '<div>' +
          '<h2 style="font-size:18px;font-weight:700;margin-bottom:2px">Групповой отчёт ценностей</h2>' +
          '<p style="font-size:12px;color:var(--ink3)">Сформируйте выборку — отчёт покажет усреднённый ценностный профиль группы</p>' +
        '</div>' +
        '<button type="button" class="btn-cancel" data-act="val-list">← К списку</button>' +
      '</div>' +

      // Фильтры
      (depts.length || groups.length
        ? '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
          '<div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--ink1)">Быстрый фильтр</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:20px">' +
            (depts.length ? '<div><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--ink3);margin-bottom:6px;letter-spacing:.04em">Подразделение</div><div class="gr-chips" id="gr-dept-chips">'+deptChips+'</div></div>' : '') +
            (groups.length ? '<div><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--ink3);margin-bottom:6px;letter-spacing:.04em">Группа</div><div class="gr-chips" id="gr-grp-chips">'+grpChips+'</div></div>' : '') +
          '</div>' +
          '<div style="margin-top:8px;font-size:11px;color:var(--ink3)">Фильтр скрывает сотрудников, не снимая уже отмеченных вручную</div>' +
          '</div>'
        : '') +

      // Список сотрудников
      '<div class="card" style="padding:14px 16px;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap">' +
          '<div style="font-size:13px;font-weight:700;color:var(--ink1)">Сотрудники <span style="font-size:11px;font-weight:400;color:var(--ink3)">('+completed.length+' завершили оценку)</span></div>' +
          '<div style="display:flex;gap:8px">' +
            '<button type="button" class="btn-sm" id="gr-sel-all">Выбрать всех</button>' +
            '<button type="button" class="btn-cancel" id="gr-sel-none">Снять всех</button>' +
          '</div>' +
        '</div>' +
        '<div id="gr-emp-list" style="max-height:360px;overflow-y:auto;border:1px solid var(--bg2);border-radius:8px">'+empRows+'</div>' +
      '</div>' +

      // Итог и кнопка
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
        '<div id="gr-sel-count" style="font-size:13px;color:var(--ink3)">Выбрано: 0 сотрудников</div>' +
        '<button type="button" id="gr-build-btn" class="btn-primary" disabled style="opacity:.4;cursor:not-allowed">Сформировать отчёт →</button>' +
      '</div>' +
      '</div>'
    );
  }

  function wireFilterEvents(el, completed){
    function applyFilters(){
      var selDepts = checkVals(el, 'input[data-kind="dept"]:checked');
      var selGrps  = checkVals(el, 'input[data-kind="grp"]:checked');
      el.querySelectorAll('.gr-emp-row').forEach(function(row){
        var dept = row.dataset.dept||'';
        var grp  = row.dataset.grp||'';
        var visible = (!selDepts.length || selDepts.indexOf(dept)>=0) &&
                      (!selGrps.length  || selGrps.indexOf(grp)>=0);
        row.style.display = visible ? '' : 'none';
        // Снимаем галочку, если строка скрыта
        if(!visible){
          var chk = row.querySelector('input[type="checkbox"]');
          if(chk && chk.checked){ chk.checked = false; GR_STATE.selected.delete(chk.value); }
        }
      });
      updateCount();
    }

    function updateCount(){
      var n = GR_STATE.selected.size;
      var cEl = el.querySelector('#gr-sel-count');
      var btn  = el.querySelector('#gr-build-btn');
      if(cEl) cEl.textContent = 'Выбрано: '+n+' сотрудников';
      if(btn){
        btn.disabled = n < 2;
        btn.style.opacity = n < 2 ? '.4' : '1';
        btn.style.cursor  = n < 2 ? 'not-allowed' : 'pointer';
        if(n===1){ cEl.textContent = 'Выбрано: 1 сотрудник (выберите минимум 2 для группового анализа)'; }
      }
    }

    // Чипы фильтра
    el.querySelectorAll('input[data-kind="dept"],input[data-kind="grp"]').forEach(function(inp){
      inp.addEventListener('change', applyFilters);
    });

    // Чекбоксы сотрудников
    el.querySelectorAll('input[data-kind="emp"]').forEach(function(inp){
      inp.addEventListener('change', function(){
        if(this.checked) GR_STATE.selected.add(this.value);
        else GR_STATE.selected.delete(this.value);
        updateCount();
      });
    });

    // Выбрать всех видимых
    var btnAll = el.querySelector('#gr-sel-all');
    if(btnAll) btnAll.addEventListener('click', function(){
      el.querySelectorAll('.gr-emp-row').forEach(function(row){
        if(row.style.display==='none') return;
        var chk = row.querySelector('input[data-kind="emp"]');
        if(chk){ chk.checked = true; GR_STATE.selected.add(chk.value); }
      });
      updateCount();
    });

    // Снять всех
    var btnNone = el.querySelector('#gr-sel-none');
    if(btnNone) btnNone.addEventListener('click', function(){
      el.querySelectorAll('input[data-kind="emp"]').forEach(function(inp){
        inp.checked = false; GR_STATE.selected.delete(inp.value);
      });
      updateCount();
    });

    // Сформировать
    var btnBuild = el.querySelector('#gr-build-btn');
    if(btnBuild) btnBuild.addEventListener('click', function(){
      var ids   = Array.from(GR_STATE.selected);
      var items = completed.filter(function(v){ return GR_STATE.selected.has(String(v.id)); });
      buildGroupReport(ids, items);
    });
  }

  function checkVals(el, sel){
    return Array.from(el.querySelectorAll(sel)).map(function(i){return i.value;});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Загрузка данных и усреднение
  // ─────────────────────────────────────────────────────────────────────────

  async function loadAndAverageScores(ids){
    var BATCH = 8;
    var allScores = [];
    var failedCount = 0;

    for(var i=0; i<ids.length; i+=BATCH){
      var batch = ids.slice(i, i+BATCH);
      var results = await Promise.all(batch.map(function(id){
        return (typeof api==='function'
          ? api('getValueAssessmentResult', {id:id, role:(typeof U!=='undefined'?U?.role:''), recruiter_id:(typeof U!=='undefined'?U?.id:'')})
          : Promise.resolve(null)
        ).catch(function(){ return null; });
      }));

      results.forEach(function(res, idx){
        if(!res || !res.ok){ failedCount++; return; }
        var r = res.result || {};
        var raw = null;
        if(window.VALUES_V2 && typeof window.VALUES_V2.extractRawScoresByAbbr==='function'){
          raw = window.VALUES_V2.extractRawScoresByAbbr(r);
        }
        if(raw && Object.keys(raw).length >= 10) allScores.push(raw);
        else failedCount++;
      });
    }

    if(!allScores.length) return null;

    // Усреднение
    var sums = {}, counts = {};
    allScores.forEach(function(sc){
      Object.keys(sc).forEach(function(abbr){
        var v = Number(sc[abbr]);
        if(!Number.isFinite(v)) return;
        sums[abbr] = (sums[abbr]||0) + v;
        counts[abbr] = (counts[abbr]||0) + 1;
      });
    });
    var avg = {};
    Object.keys(sums).forEach(function(abbr){
      avg[abbr] = sums[abbr] / counts[abbr];
    });

    return {avg:avg, n:allScores.length, failed:failedCount};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Построение и рендер отчёта
  // ─────────────────────────────────────────────────────────────────────────

  async function buildGroupReport(ids, selectedItems){
    var el = document.getElementById('content');
    if(!el) return;
    el.innerHTML = (
      '<div style="padding:60px;text-align:center;color:var(--ink3)">' +
      '<div style="font-size:15px;font-weight:600;margin-bottom:6px">Загружаем данные...</div>' +
      '<div style="font-size:12px">Запрашиваем результаты '+ids.length+' оценок. Это может занять несколько секунд.</div>' +
      '</div>'
    );

    var data = await loadAndAverageScores(ids);
    if(!data){
      if(typeof toast==='function') toast('Не удалось загрузить данные ни для одного из выбранных сотрудников','err');
      renderGroupReportFilter();
      return;
    }
    if(data.failed > 0 && typeof toast==='function'){
      toast('Пропущено '+data.failed+' оценок: недостаточно данных для расчёта');
    }

    renderGroupReportView(data.avg, data.n, selectedItems);
  }

  function renderGroupReportView(avgByAbbr, n, selectedItems){
    var el = document.getElementById('content');
    if(!el) return;

    // Формируем подзаголовок
    var deptNames = uniq(selectedItems.map(function(v){return v.department||'';}).filter(Boolean));
    var grpNames  = uniq(selectedItems.map(function(v){return v.employee_group||'';}).filter(Boolean));
    var subtitle = n+' сотрудников';
    if(deptNames.length) subtitle += ' · '+deptNames.slice(0,3).join(', ')+(deptNames.length>3?' ...':'');
    if(grpNames.length)  subtitle += ' · '+grpNames.slice(0,3).join(', ')+(grpNames.length>3?' ...':'');

    el.innerHTML = buildReportHtml(subtitle);

    // Рендерим таблицу интерпретации
    renderGroupInterpretation(el, avgByAbbr);

    // Рендерим чарты
    if(typeof ensureChartJs==='function'){
      ensureChartJs().then(function(){ initGroupCharts(avgByAbbr); });
    }

    // Кнопка экспорта
    var expBtn = el.querySelector('#gr-export-btn');
    if(expBtn) expBtn.addEventListener('click', function(){
      exportGroupReport(n, subtitle);
    });

    // Кнопка «назад к выборке»
    el.querySelector('[data-grback]').addEventListener('click', function(){
      renderGroupReportFilter();
    });
  }

  function buildReportHtml(subtitle){
    return (
      '<div style="max-width:980px;margin:0 auto">' +
      // Шапка
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
        '<div>' +
          '<h2 style="font-size:18px;font-weight:700;margin-bottom:2px">Групповой профиль ценностей</h2>' +
          '<p style="font-size:12px;color:var(--ink3)">'+esc(subtitle)+'</p>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="btn-sm" id="gr-export-btn">Экспорт PDF</button>' +
          '<button type="button" class="btn-cancel" data-grback="1">← Изменить выборку</button>' +
        '</div>' +
      '</div>' +

      // 1. Метаценности (дынот)
      '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
        '<div class="ct" style="margin-bottom:10px">Средний балл по метаценностям</div>' +
        '<div style="height:180px"><canvas id="gr-meta-donut"></canvas></div>' +
      '</div>' +

      // 2. Таблица интерпретаций
      '<div class="card" id="gr-interp-wrap" style="padding:14px 16px;margin-bottom:10px">' +
        '<div class="ct" style="margin-bottom:6px">Таблица ценностного профиля</div>' +
        '<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">Наведите на название ценности, чтобы увидеть её краткое описание</div>' +
        '<div id="gr-interp-table"><div style="font-size:12px;color:var(--ink3);padding:8px 0">Загрузка...</div></div>' +
      '</div>' +

      // 3. Столбчатая диаграмма
      '<div class="card" style="padding:12px;margin-bottom:10px">' +
        '<div class="ct" style="margin-bottom:10px">Столбчатая диаграмма ценностей</div>' +
        '<div style="height:260px"><canvas id="val-bar"></canvas></div>' +
      '</div>' +

      // 4. Круг ценностей (радар)
      '<div class="card" style="padding:12px">' +
        '<div class="ct" style="margin-bottom:10px">Круг ценностей</div>' +
        '<div style="height:600px"><canvas id="val-circle"></canvas></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Чарты
  // ─────────────────────────────────────────────────────────────────────────

  function initGroupCharts(avgByAbbr){
    // Уничтожаем старые чарты
    ['bar','circle','im','meta'].forEach(function(k){
      try{ if(typeof V_RESULT_CHARTS!=='undefined' && V_RESULT_CHARTS[k]) V_RESULT_CHARTS[k].destroy(); }catch(e){}
    });

    var barData   = ABBR_ORDER.map(function(a){ return Number(avgByAbbr[a])||0; });
    var idealData = ABBR_ORDER.map(function(a){ return IDEAL[a]||0; });

    // Устанавливаем V_RESULT_VIEW (используется renderValueBarChart и renderValueCircleChart)
    if(typeof V_RESULT_VIEW!=='undefined'){
      V_RESULT_VIEW = {
        centered:      null,
        base:          {labels:ABBR_ORDER.slice(), data:barData.slice()},
        idealBase:     idealData.slice(),
        colors:        null,
        abbrs:         ABBR_ORDER.slice(),
        circleCentered:null,
        circleBase:    {labels:ABBR_ORDER.slice(), data:barData.slice()},
        circleAbbrs:   ABBR_ORDER.slice(),
        circleIdealBase: idealData.slice()
      };
    }

    // Столбчатая и радар — существующие функции из app.js
    if(typeof renderValueBarChart==='function')    renderValueBarChart();
    if(typeof renderValueCircleChart==='function') renderValueCircleChart();

    // Метаценности — дынот
    renderGroupMetaDonut(avgByAbbr);
  }

  function renderGroupMetaDonut(avgByAbbr){
    var ctx = document.getElementById('gr-meta-donut');
    if(!ctx || typeof Chart==='undefined') return;

    var MG = (typeof META_GROUPS!=='undefined') ? META_GROUPS : [
      {label:'Открытость изменениям', abbrs:['SDT','SDA','ST','HE'],          color:'#3B82F6'},
      {label:'Самоутверждение',       abbrs:['AC','POD','POR','FAC'],          color:'#F59E0B'},
      {label:'Сохранение',            abbrs:['SEP','SES','TR','COR','COI'],    color:'#10B981'},
      {label:'Самоопределение',       abbrs:['HUM','BEC','BED','UNC','UNN','UNT'], color:'#8B5CF6'}
    ];

    var metaAvgs = MG.map(function(g){
      var vals = g.abbrs.map(function(a){ return Number(avgByAbbr[a]); }).filter(Number.isFinite);
      if(!vals.length) return null;
      return {label:g.label, color:g.color, avg:vals.reduce(function(s,v){return s+v;},0)/vals.length};
    }).filter(Boolean).sort(function(a,b){return b.avg-a.avg;});

    if(!metaAvgs.length) return;

    var _dl = window.ChartDataLabels;
    var metaChart = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      ...(_dl ? {plugins:[_dl]} : {}),
      data: {
        labels: metaAvgs.map(function(g){return g.label;}),
        datasets:[{
          data: metaAvgs.map(function(g){return g.avg;}),
          backgroundColor: metaAvgs.map(function(g){return g.color+'33';}),
          borderColor:     metaAvgs.map(function(g){return g.color;}),
          borderWidth: 2
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'52%',
        plugins:{
          legend:{position:'right', labels:{font:{size:11}, padding:10, boxWidth:12}},
          tooltip:{callbacks:{label:function(c){return ' '+c.label+': '+Number(c.raw).toFixed(2);}}},
          ...(_dl ? {datalabels:{
            display:true,
            formatter:function(v){ return Number(v).toFixed(2); },
            color:'#1a202c', font:{size:11, weight:'700'}
          }} : {})
        }
      }
    });

    // Регистрируем для resize при экспорте
    if(typeof V_RESULT_CHARTS!=='undefined') V_RESULT_CHARTS.meta = metaChart;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Таблица интерпретации с тултипами
  // ─────────────────────────────────────────────────────────────────────────

  function renderGroupInterpretation(el, avgByAbbr){
    var wrap = el.querySelector('#gr-interp-table');
    if(!wrap) return;

    var VI = window.VALUES_INTERP;
    if(!VI || !Array.isArray(VI.CP)){
      wrap.innerHTML = '<div style="font-size:12px;color:var(--ink3)">Таблица недоступна — модуль интерпретации не загружен</div>';
      return;
    }

    var vals = [];
    VI.CP.forEach(function(cfg){
      var sc = Number(avgByAbbr[cfg.a]);
      if(!Number.isFinite(sc)) return;
      vals.push({cfg:cfg, sc:sc});
    });

    if(vals.length < 10){
      wrap.innerHTML = '<div style="font-size:12px;color:var(--ink3)">Недостаточно данных (менее 10 ценностей)</div>';
      return;
    }

    wrap.innerHTML = renderGroupGrid(vals, VI);
    wireTooltips(wrap);
  }

  function renderGroupGrid(vals, VI){
    var META_MAP = VI.META || {};
    var MCOL_MAP = VI.MCOL || {};
    var PCOL = {
      KEY:      {bg:'#ebf8ff',tx:'#2b6cb0',lb:'К'},
      IMPORTANT:{bg:'#f0fff4',tx:'#276749',lb:'В'},
      NEUTRAL:  {bg:'#f7fafc',tx:'#718096',lb:'Н'},
      UNWANTED: {bg:'#fff5f5',tx:'#c53030',lb:'×'}
    };

    function status(sc,cfg){ return sc>=cfg.mn&&sc<=cfg.mx?'in':sc<cfg.mn?'below':'above'; }
    function isBadDir(sc,cfg){ return cfg.p==='UNWANTED'?sc>cfg.mx:sc<cfg.mn; }
    function scol(sc,cfg){
      var st=status(sc,cfg);
      if(st==='in')        return {bg:'#f0fff4',tx:'#276749'};
      if(isBadDir(sc,cfg)) return {bg:'#fff5f5',tx:'#9b2c2c'};
      return {bg:'#fffbeb',tx:'#744210'};
    }

    var head = (
      '<thead><tr style="background:#f7fafc;border-bottom:2px solid #e2e8f0">' +
      '<th style="padding:5px 5px;font-size:10px;text-align:left;color:#4a5568" title="Приоритет">Пр.</th>' +
      '<th style="padding:5px 6px;font-size:10px;text-align:left;color:#4a5568">Код</th>' +
      '<th style="padding:5px 6px;font-size:10px;text-align:left;color:#4a5568">Ценность ↗ hover = описание</th>' +
      '<th style="padding:5px 6px;font-size:10px;text-align:left;color:#4a5568">Метаценность</th>' +
      '<th style="padding:5px 6px;font-size:10px;text-align:left;color:#4a5568">Ср. балл</th>' +
      '<th style="padding:5px 4px;font-size:10px;text-align:left;color:#4a5568">Идеал</th>' +
      '<th style="padding:5px 4px;font-size:10px;text-align:center;color:#4a5568">Ст.</th>' +
      '</tr></thead>'
    );

    var rows = vals.map(function(v){
      var c  = scol(v.sc, v.cfg);
      var st = status(v.sc, v.cfg);
      var icon = st==='in'
        ? '<span style="color:#276749">✓</span>'
        : st==='below'
          ? '<span style="color:#9b2c2c">↓</span>'
          : '<span style="color:#c05621">↑</span>';
      var pp = PCOL[v.cfg.p] || PCOL.NEUTRAL;
      var mt = META_MAP[v.cfg.a]||'—', mc = MCOL_MAP[mt]||'#a0aec0';
      return (
        '<tr style="border-bottom:1px solid #f0f4f8">' +
        '<td style="padding:3px 5px"><span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:2px;font-size:9px;font-weight:800;background:'+pp.bg+';color:'+pp.tx+'">'+pp.lb+'</span></td>' +
        '<td style="padding:3px 6px;font-size:11px;font-weight:700;color:#1a202c;white-space:nowrap">'+esc(v.cfg.a)+'</td>' +
        '<td style="padding:3px 10px 3px 0;font-size:11px;color:#4a5568;cursor:help;border-bottom:1px dashed #cbd5e0" data-vtip="'+esc(v.cfg.a)+'">'+esc(v.cfg.n)+'</td>' +
        '<td style="padding:3px 6px;font-size:10px"><span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:'+mc+';flex-shrink:0;display:inline-block"></span><span style="color:'+mc+';font-weight:600">'+esc(mt)+'</span></span></td>' +
        '<td style="padding:3px 6px;white-space:nowrap"><span style="display:inline-block;padding:1px 7px;border-radius:4px;background:'+c.bg+';color:'+c.tx+';font-weight:700;font-size:11px">'+v.sc.toFixed(2)+'</span></td>' +
        '<td style="padding:3px 4px;font-size:10px;color:#718096;white-space:nowrap">'+v.cfg.mn+'–'+v.cfg.mx+'</td>' +
        '<td style="padding:3px 4px;font-size:13px;text-align:center">'+icon+'</td>' +
        '</tr>'
      );
    });

    var colgroup = (
      '<colgroup>' +
      '<col style="width:5%"><col style="width:7%"><col style="width:28%">' +
      '<col style="width:26%"><col style="width:13%"><col style="width:15%"><col style="width:6%">' +
      '</colgroup>'
    );

    return (
      '<div style="font-size:10px;color:#a0aec0;margin-bottom:6px">' +
      'К — Ключевая &nbsp;·&nbsp; В — Важная &nbsp;·&nbsp; Н — Нейтральная &nbsp;·&nbsp; × — Нежелательная &nbsp;·&nbsp; ✓ в диапазоне &nbsp;·&nbsp; ↑↓ вне диапазона' +
      '</div>' +
      '<table style="border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:4px">' +
      colgroup + head + '<tbody>'+rows.join('')+'</tbody></table>'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Тултипы
  // ─────────────────────────────────────────────────────────────────────────

  function wireTooltips(container){
    var tip = document.getElementById('gr-value-tip');
    if(!tip){
      tip = document.createElement('div');
      tip.id = 'gr-value-tip';
      tip.style.cssText = [
        'position:fixed','z-index:9999','background:#1e293b','color:#f8fafc',
        'font-size:11px','line-height:1.55','padding:9px 13px','border-radius:8px',
        'max-width:300px','pointer-events:none','opacity:0','transition:opacity .12s',
        'box-shadow:0 4px 16px rgba(0,0,0,.25)','border:1px solid rgba(255,255,255,.08)'
      ].join(';');
      document.body.appendChild(tip);
    }

    function show(e){
      var cell = e.target.closest('[data-vtip]');
      if(!cell){ hide(); return; }
      var abbr = cell.dataset.vtip;
      var desc = VALUE_BRIEF[abbr];
      if(!desc){ hide(); return; }
      tip.innerHTML = '<b style="display:block;margin-bottom:4px;font-size:12px">'+esc(abbr)+'</b>'+esc(desc);
      tip.style.opacity = '1';
      position(e);
    }

    function position(e){
      var tw = tip.offsetWidth || 280;
      var th = tip.offsetHeight || 60;
      var x  = e.clientX + 18;
      var y  = e.clientY - 10;
      if(x + tw > window.innerWidth)  x = e.clientX - tw - 8;
      if(y + th > window.innerHeight) y = e.clientY - th - 8;
      if(x < 4) x = 4;
      if(y < 4) y = 4;
      tip.style.left = x+'px';
      tip.style.top  = y+'px';
    }

    function hide(){ tip.style.opacity='0'; }

    container.addEventListener('mouseover',  show);
    container.addEventListener('mousemove',  function(e){
      if(tip.style.opacity==='1') position(e);
    });
    container.addEventListener('mouseout',   function(e){
      if(!e.relatedTarget || !e.relatedTarget.closest('[data-vtip]')) hide();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Экспорт PDF
  // ─────────────────────────────────────────────────────────────────────────

  async function exportGroupReport(n, subtitle){
    var PRINT_W = 680;
    var chartPrintSv = [];
    var prevTitle = document.title;
    document.title = 'group-values-report';

    var restore = function(){
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
      setTimeout(function(){
        chartPrintSv.forEach(function(ch){ try{ch.resize();}catch(e){} });
      }, 150);
    };
    window.addEventListener('afterprint', restore);

    // Растягиваем чарты под A4
    [
      {key:'bar',    w:PRINT_W,                   h:260},
      {key:'circle', w:PRINT_W,                   h:580},
      {key:'meta',   w:Math.round(PRINT_W*0.48),  h:180}
    ].forEach(function(item){
      if(typeof V_RESULT_CHARTS==='undefined') return;
      var ch = V_RESULT_CHARTS[item.key];
      if(!ch) return;
      chartPrintSv.push(ch);
      try{ ch.resize(item.w, item.h); }catch(e){}
    });

    await new Promise(function(res){ requestAnimationFrame(res); });
    await new Promise(function(res){ requestAnimationFrame(res); });

    var el = document.getElementById('content');
    if(el) el.scrollTo(0,0);
    window.scrollTo(0,0);

    if(typeof toast==='function') toast('Откроется диалог печати → выберите «Сохранить как PDF»');
    await new Promise(function(res){ setTimeout(res, 400); });
    window.print();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Публичный API
  // ─────────────────────────────────────────────────────────────────────────

  window.GROUP_REPORT = {
    renderFilter:  renderGroupReportFilter,
    buildReport:   buildGroupReport,
    exportReport:  exportGroupReport
  };

})();

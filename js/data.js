// data.js
let REF = {};

const GROUP_NORM_DEFAULT = {
  'ИТР': 30, 'Рабочий': 30, 'Офис': 30,
  'Руководитель среднего звена': 60, 'ТОП': 90,
};
// Динамически обновляется из справочника
let GROUP_NORM = {...GROUP_NORM_DEFAULT};
let VAC_GROUPS = Object.keys(GROUP_NORM);

function updateGroupNorm() {
  const groups = REF['Группы']||[];
  if (groups.length) {
    VAC_GROUPS = groups;
    // Сохраняем нормативы для известных групп, для новых — 30 дней по умолчанию
    const newNorm = {};
    groups.forEach(g => { newNorm[g] = GROUP_NORM_DEFAULT[g] || GROUP_NORM[g] || 30; });
    GROUP_NORM = newNorm;
  }
}

// Статусы — финальные (требуют дату закрытия)
const FINAL_STATUSES = ['Закрыта', 'Отменена', 'Передана'];
// Статусы считаемые "закрытыми" для плана
const PLAN_CLOSED_STATUSES = ['Закрыта', 'Отменена'];
// Статусы для оценки кандидата
const ASSESS_STATUSES = ['В работе', 'Приостановлена'];
// ══ ROLES / NAV ══════════════════════════════════════
const ROLES={
  recruiter:{l:'Рекрутер',    c:'#2E7D52',bg:'#E8F5EE'},
  manager:  {l:'Руководитель',c:'#1A5FA0',bg:'#E5EFF9'},
  admin:    {l:'Администратор',c:'#7B5EA7',bg:'#F0EBF8'},
};
const NCFG={
  recruiter:[{id:'dashboard',lbl:'Дашборд',ic:'home'},{id:'checklist',lbl:'Оценка кандидата',ic:'cl'}],
  manager:  [{id:'dashboard',lbl:'Дашборд',ic:'home'},{id:'analytics',lbl:'Аналитика',ic:'ch'},{id:'checklist',lbl:'Оценка кандидата',ic:'cl'}],
  admin:    [{id:'dashboard',lbl:'Дашборд',ic:'home'},{id:'analytics',lbl:'Аналитика',ic:'ch'},{id:'checklist',lbl:'Оценка кандидата',ic:'cl'},{id:'users',lbl:'Пользователи',ic:'us'}],
};
const IC={
  home:'<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
  ch:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  cl:'<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>',
  us:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/>',
};
const SC_MAP={'В работе':'sw','Закрыта':'sc2','Приостановлена':'sp','Отменена':'sca','Передана':'st'};

// ══ DEMO DATA ════════════════════════════════════════
const DU=[
  {active:true,id:'1',login:'anna', name:'Анна Смирнова', role:'recruiter'},
  {active:true,id:'2',login:'maria',name:'Мария Козлова', role:'recruiter'},
  {active:true,id:'3',login:'igor', name:'Игорь Петров',  role:'manager'},
  {active:true,id:'4',login:'admin',name:'Администратор', role:'admin'},
];
const DV=[
  {id:'v1',num:'А-001',recruiter_id:'1',recruiter_name:'Анна Смирнова',current_recruiter_id:'1',current_recruiter_name:'Анна Смирнова',date_opened:'2026-01-15',status:'В работе',type:'Новая',name:'Frontend разработчик',department:'IT',project:'Сайт компании',contract:'ТД',vacancy_group:'ИТР',initiator:'Козлов А.А.',reason:'Расширение штата',salary_offer:'120 000',salary_request:'130 000',crm_link:'TASK-401',comment:'',norm_days:30,plan_date:'',fact_date:'',days_total:80,days_current:80,transferred:false,transferred_from_name:'',transfer_date:''},
  {id:'v2',num:'А-002',recruiter_id:'1',recruiter_name:'Анна Смирнова',current_recruiter_id:'1',current_recruiter_name:'Анна Смирнова',date_opened:'2026-01-20',status:'Закрыта',type:'Замена',name:'Бухгалтер',department:'Финансы',project:'—',contract:'ТД',vacancy_group:'Офис',initiator:'Иванов С.В.',reason:'Увольнение',salary_offer:'80 000',salary_request:'85 000',crm_link:'TASK-388',comment:'Принят Сидоров Н.П.',norm_days:30,plan_date:'2026-02-20',fact_date:'2026-02-10',days_total:21,days_current:21,transferred:false,transferred_from_name:'',transfer_date:''},
  {id:'v3',num:'М-001',recruiter_id:'2',recruiter_name:'Мария Козлова',current_recruiter_id:'2',current_recruiter_name:'Мария Козлова',date_opened:'2026-01-25',status:'В работе',type:'Новая',name:'Менеджер по продажам',department:'Продажи',project:'B2B',contract:'ТД',vacancy_group:'Офис',initiator:'Петров И.И.',reason:'Расширение',salary_offer:'70 000 + %',salary_request:'80 000',crm_link:'TASK-443',comment:'',norm_days:30,plan_date:'',fact_date:'',days_total:71,days_current:71,transferred:false,transferred_from_name:'',transfer_date:''},
  {id:'v4',num:'М-002',recruiter_id:'2',recruiter_name:'Мария Козлова',current_recruiter_id:'1',current_recruiter_name:'Анна Смирнова',date_opened:'2026-02-01',status:'Передана',type:'Новая',name:'Строитель (город)',department:'Строительство',project:'Объект №1',contract:'ГПХ',vacancy_group:'Рабочий',initiator:'Сидоров М.П.',reason:'Новый проект',salary_offer:'90 000',salary_request:'100 000',crm_link:'',comment:'Передана Анне',norm_days:30,plan_date:'',fact_date:'2026-03-01',days_total:64,days_current:35,transferred:true,transferred_from_name:'Мария Козлова',transfer_date:'2026-03-01'},
  {id:'v5',num:'А-003',recruiter_id:'1',recruiter_name:'Анна Смирнова',current_recruiter_id:'1',current_recruiter_name:'Анна Смирнова',date_opened:'2026-02-03',status:'Закрыта',type:'Новая',name:'UX/UI Дизайнер',department:'IT',project:'Моб.приложение',contract:'ТД',vacancy_group:'ИТР',initiator:'Козлов А.А.',reason:'Расширение',salary_offer:'100 000',salary_request:'110 000',crm_link:'',comment:'Закрыта досрочно',norm_days:30,plan_date:'2026-03-03',fact_date:'2026-02-20',days_total:17,days_current:17,transferred:false,transferred_from_name:'',transfer_date:''},
  {id:'v6',num:'М-003',recruiter_id:'2',recruiter_name:'Мария Козлова',current_recruiter_id:'2',current_recruiter_name:'Мария Козлова',date_opened:'2026-02-05',status:'Приостановлена',type:'Новая',name:'Строитель (за городом)',department:'Строительство',project:'Объект №2',contract:'ГПХ',vacancy_group:'Рабочий',initiator:'Сидоров М.П.',reason:'Новый проект',salary_offer:'95 000',salary_request:'95 000',crm_link:'',comment:'',norm_days:30,plan_date:'',fact_date:'',days_total:60,days_current:60,transferred:false,transferred_from_name:'',transfer_date:''},
  {id:'v7',num:'А-004',recruiter_id:'1',recruiter_name:'Анна Смирнова',current_recruiter_id:'1',current_recruiter_name:'Анна Смирнова',date_opened:'2026-03-10',status:'Отменена',type:'Замена',name:'HR-менеджер',department:'HR',project:'—',contract:'ТД',vacancy_group:'Офис',initiator:'',reason:'',salary_offer:'85 000',salary_request:'',crm_link:'',comment:'Позиция заморожена',norm_days:30,plan_date:'',fact_date:'2026-03-25',days_total:15,days_current:15,transferred:false,transferred_from_name:'',transfer_date:''},
];

const CL_BLOCKS=[
  {id:'b1',num:1,title:'Ориентация: Процесс vs. Результат',subtitle:'Как человек мыслит — категориями действий или итогов',question:'«Какие задачи вам больше всего нравились на предыдущем месте работы?»',tip:'Слушайте глаголы: процессные (делать, вести) или совершенные (сделать, заключить)',options:[{id:'process',label:'Процесс',desc:'Описывает рутину, содержание работы, общение, детали',score:0,color:'blue'},{id:'result',label:'Результат',desc:'Описывает завершённые этапы, достижения, закрытые сделки',score:1,color:'blue'}]},
  {id:'b2',num:2,title:'Локус контроля: Внутренний vs. Внешний',subtitle:'Кто несёт ответственность за успехи и неудачи',question:'«Расскажите о сложной ситуации или неудаче в работе. В чём была причина?»',tip:'Кого винит в провалах — себя или обстоятельства',options:[{id:'external',label:'Внешний',desc:'Виноваты клиенты, рынок, руководство, погода',score:0,color:'blue'},{id:'internal',label:'Внутренний',desc:'Берёт на себя: «Я недоработал», «Я не учёл риски»',score:1,color:'blue'},{id:'mixed',label:'Смешанный',desc:'Адекватно оценивает и свою роль, и внешние факторы',score:0.5,color:'blue'}]},
  {id:'b3a',num:'3А',title:'Мотивационный профиль — Вектор',subtitle:'Убегает от прошлого или стремится к будущему',question:'«Почему вы решили сменить работу?»',tip:'Фокус на прошлом негативе (ОТ) или на будущих возможностях (К)',options:[{id:'from',label:'ОТ (избегание)',desc:'Фокус на негативе: уйти от начальника, маленькой з/п',score:0,color:'blue'},{id:'to',label:'К (стремление)',desc:'Фокус на будущем: получить развитие, масштабные задачи',score:1,color:'blue'}]},
  {id:'b3b',num:'3Б',title:'Мотивационный профиль — Факторы',subtitle:'Что удерживает и заставляет работать лучше',question:'«Назовите 3–5 главных критериев выбора новой работы»',tip:'Что ставит на первое место: условия/комфорт или содержание/рост',options:[{id:'hygiene',label:'Гигиенические факторы',desc:'З/п, соцпакет, близость к дому, стабильность, график',score:0,color:'blue'},{id:'motivators',label:'Мотиваторы',desc:'Интересные задачи, рост, вызов, признание, обучение',score:1,color:'blue'}]},
  {id:'b4',num:4,title:'Тип референции: Внутренняя vs. Внешняя',subtitle:'На чьё мнение опирается при принятии решений',question:'«Как узнаете, что проект выполнен успешно — до того, как скажет руководитель?»',tip:'Критерий истины: в своих глазах или в чужих',options:[{id:'internal',label:'Внутренняя',desc:'«Я сам вижу, что всё работает» — для экспертов, руководителей',score:0.5,color:'blue'},{id:'external',label:'Внешняя',desc:'«Клиент оставил отзыв», «Выполнил KPI» — для сервиса, продаж',score:0.5,color:'blue'},{id:'mixed',label:'Смешанная',desc:'«Сделал по стандартам, и клиент подтвердил» — золотая середина',score:1,color:'blue'}]},
  {id:'b5',num:5,title:'Отношение к изменениям: Сходство vs. Различие',subtitle:'Ищет стабильность или новизну при адаптации',question:'«Сравните последнее и предыдущее место работы. Что было общего, а что отличного?»',tip:'С чего начнёт и о чём будет говорить больше',options:[{id:'similar',label:'Сходство',desc:'«И там и там продажи», «Коллектив был похожий»',score:0,color:'blue'},{id:'diff_evol',label:'Различие (эволюция)',desc:'«На новой работе больше ответственности», задачи сложнее',score:1,color:'blue'},{id:'diff_revol',label:'Различие (революция)',desc:'Только о разном: «Абсолютно разные сферы»',score:0.5,color:'blue'}]},
  {id:'b6',num:6,title:'Способ мышления: Процедуры vs. Возможности',subtitle:'Ищет готовый алгоритм или новый путь',question:'«Почему вы выбрали именно эту профессию?»',tip:'Ищет «правильный способ» или «варианты решения»',options:[{id:'procedure',label:'Процедуры',desc:'«Так сложилось», «Родители посоветовали» — единственный путь',score:0,color:'blue'},{id:'opportunity',label:'Возможности',desc:'«Я выбирал между маркетингом и продажами, но решил…»',score:1,color:'blue'}]},
  {id:'b7',num:7,title:'Стиль взаимодействия',subtitle:'Насколько человеку нужны другие люди для работы',question:'«Опишите идеальные условия работы. Как должен проходить ваш рабочий день?»',tip:'Упоминает ли других людей как ресурс или как партнёров',options:[{id:'solo',label:'Одиночка',desc:'«Чтобы не трогали», «Дали задачу — ушёл делать»',score:0,color:'blue'},{id:'manager',label:'Менеджер',desc:'«Раздать задачи», «Контролировать процесс»',score:0.5,color:'blue'},{id:'team',label:'Командный игрок',desc:'«Обсудить с коллегами», «Мозговые штурмы»',score:1,color:'blue'}]},
  {id:'b8',num:8,title:'Тип действия: Реактивность vs. Проактивность',subtitle:'Ждёт команды или действует сам',question:'«Сталкивались ли вы с несовершенством процессов? Предлагали ли улучшения?»',tip:'Предлагал системные решения или только «тушил пожары»',options:[{id:'reactive',label:'Реактивный',desc:'«Я сообщил начальнику», «Сделал как сказали» — Исполнитель',score:0,color:'blue'},{id:'proactive',label:'Проактивный',desc:'«Я разработал», «Я предложил внедрить» — Инициатор',score:1,color:'blue'}]},
  {id:'b9',num:9,title:'Лингвистический маркер лояльности',subtitle:'Идентифицирует ли себя с компанией',question:'Слушайте, как говорит о проблемах и задачах прошлой команды',tip:'Местоимения: ОНИ или МЫ',options:[{id:'they',label:'ОНИ (отделение)',desc:'«У них были проблемы», «Руководство решило» — Наёмник',score:0,color:'blue'},{id:'we',label:'МЫ (причастность)',desc:'«У нас были сложности», «Мы решили» — Командный игрок',score:1,color:'blue'}]},
];
const CL_MAX=CL_BLOCKS.length;

// Поля, которые рекрутер НЕ может редактировать
const RECRUITER_LOCKED=['name','type','reason','vacancy_group'];


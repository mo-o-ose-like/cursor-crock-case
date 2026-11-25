// All records and assessments are fictional demonstration data.
export const stages = [
  'Знакомство и выявление потребностей', 'Переговоры', 'Техническая оценка',
  'Согласование бюджета', 'Финальное согласование'
];

const roster = {
  service:   ['Сергей Волков', 'Ирина Крылова', 'Александр Морозов', 'Ольга Соколова', 'Елена Фёдорова', 'Павел Иванов', 'Сергей Кузнецов'],
  network:   ['Алла Кошелева', 'Вадим Седов', 'Артур Демидов', 'Анна Полякова', 'Елена Фёдорова', 'Виктор Лукин', 'Илья Белов'],
  soc:       ['Фёдор Романов', 'Инна Матвеева', 'Олег Пахомов', 'Егор Климов', 'Олег Игнатов', 'Антон Громов', 'Лидия Андреева'],
  vdi:       ['Борис Егоров', 'Лариса Баранова', 'Полина Краснова', 'Дмитрий Ковалёв', 'Анатолий Серов', 'Марина Назарова', 'Иван Руднев'],
  data:      ['Константин Панов', 'Ирина Крылова', 'Вера Сафонова', 'Кирилл Комаров', 'Юрий Миронов', 'Анна Фомина', 'Татьяна Белова'],
  workspace: ['Глеб Семёнов', 'Аркадий Титов', 'Лидия Филатова', 'Ольга Соколова', 'Пётр Долгов', 'Софья Шилова', 'Анна Алексеева'],
  contact:   ['Тимур Фролов', 'Элина Горина', 'Илья Савин', 'Алина Тихонова', 'Татьяна Сидорова', 'Павел Иванов', 'Олег Кузьмин'],
  analytics: ['Тамара Блинова', 'Зоя Данилова', 'Борис Мельников', 'Сергей Кузнецов', 'Григорий Соловьёв', 'Нина Туманова', 'Мария Орлова']
};
const leads = {service:'technical',network:'operations',soc:'technical',vdi:'business',data:'finance',workspace:'business',contact:'procurement',analytics:'business'};

const roles = {
  general: {
    title:'Генеральный директор',dept:'Дирекция',level:'Руководство',
    formal:'Утверждает инвестиционную программу и приоритеты компании.',task:'Финальное утверждение проекта',
    stage:stages[4],state:'planned',role:'Экономический покупатель',influence:'Высокое',
    risks:['Не определён лимит согласования'],goals:['Сопоставить эффект проекта с годовым планом.']
  },
  finance: {
    title:'Финансовый директор',dept:'Финансовый департамент',level:'Руководство',
    formal:'Управляет бюджетом и контролирует окупаемость инвестиций.',task:'Принятие решения о закупке',
    stage:stages[3],role:'Экономический покупатель',decision:true,influence:'Высокое',
    goals:['Уложиться в лимит инвестиционной программы.'],preferences:['Ожидает краткий расчёт затрат и эффекта.'],
    goalHint:'Возможно, важен срок окупаемости до двух лет.',preferenceHint:'Приложить к предложению сравнение двух вариантов бюджета.',
    agreements:[{title:'Расчёт эффекта',date:'2026-11-30',status:'Запланировано',detail:'Подготовить годовую оценку экономии и сценарии затрат.'}]
  },
  technical:{
    title:'Директор по ИТ',dept:'ИТ-департамент',level:'Руководитель подразделения',
    formal:'Отвечает за ИТ-стратегию, корпоративную архитектуру и эксплуатацию инфраструктуры.',task:'Согласование технических требований',
    stage:stages[2],role:'Технический эксперт',influence:'Высокое',
    disc:{D:68,I:72,S:55,C:40},goals:['Снизить риски внедрения.','Сохранить совместимость с существующей инфраструктурой.'],
    preferences:['Предпочитает письменные технические спецификации.','Просит заранее согласовать повестку встречи.'],
    goalHint:'Возможно, ожидает гарантий технической поддержки после запуска.',preferenceHint:'Передать спецификацию до демонстрации.',
    agreements:[
      {title:'Технические требования',date:'2026-11-18',status:'Согласовано',detail:'Подтверждены обязательные интеграции и формат демонстрации.'},
      {title:'Следующая встреча',date:'2026-11-27',status:'Запланировано',detail:'Показать решение ИТ-команде и бизнес-заказчику.'},
      {title:'Согласование ИБ',date:'',status:'Ожидает подтверждения',detail:'Уточнить состав участников со стороны службы информационной безопасности.'}
    ]
  },
  business:{
    title:'Руководитель бизнес-юнита',dept:'Бизнес-подразделение',level:'Руководитель подразделения',
    formal:'Организует работу подразделения и отвечает за показатели команды.',task:'Оценка эффекта и требований пользователей',
    stage:stages[1],attitude:'Нейтрально',role:'Пользователь',influence:'Среднее',
    risks:['Застой','Возможные возражения'],goals:['Уменьшить число ручных операций.'],
    preferences:['Обсуждает изменения на примерах из практики.'],
    goalHint:'Возможно, опасается дополнительной нагрузки во время перехода.',
    preferenceHint:'Проверить сценарий на примере одной рабочей группы.',
    agreements:[{title:'Обратная связь команды',date:'',status:'Ожидает подтверждения',detail:'Собрать вопросы пользователей после демонстрации.'}]
  },
  operations:{
    title:'Руководитель эксплуатации',dept:'ИТ-департамент',level:'Руководитель подразделения',
    formal:'Обеспечивает доступность сервисов и сопровождение систем.',task:'Проверка готовности инфраструктуры',
    stage:stages[2],role:'Технический эксперт',influence:'Среднее',
    goals:['Сохранить доступность действующих сервисов.'],preferences:['Запрашивает план переключения и отката.'],
    agreements:[{title:'Тестовое окно',date:'2026-11-28',status:'Запланировано',detail:'Проверить нагрузку на пилотной площадке.'}]
  },
  procurement:{
    title:'Руководитель закупок',dept:'Отдел закупок',level:'Руководитель подразделения',
    formal:'Организует конкурсные процедуры, проверяет комплектность документов.',task:'Операционное согласование закупки',
    stage:stages[0],state:'finished',role:'Наставник',influence:'Низкое',attitude:'Нейтрально',
    risks:['Требования к комплекту документов давно не уточнялись'],
    goals:['Получить полный комплект документов в срок.'],
    agreements:[{title:'Регламент закупки',date:'2026-11-16',status:'Согласовано',detail:'Передан перечень документов для первичного рассмотрения.'}]
  },
  budget:{
    title:'Финансовый аналитик',dept:'Финансовый департамент',level:'Специалист',
    formal:'Готовит финансовые расчёты и проверяет заявки подразделений.',task:'Проверка бюджетной модели',
    stage:stages[3],state:'planned',role:'Технический эксперт',influence:'Среднее',
    risks:['Не назначена встреча'],preferenceHint:'Уточнить формат расчёта и владельца бюджетной модели.'
  }
};
const ids=Object.keys(roles);
const links={
  org:[['general','finance'],['general','technical'],['general','business'],['general','procurement'],['technical','operations'],['finance','budget']],
  process:[['finance','technical'],['finance','business'],['procurement','technical','limited'],['technical','operations'],['business','budget','assumed'],['budget','general','assumed']],
  influence:[['finance','general'],['technical','finance'],['business','finance','limited'],['operations','technical','limited'],['procurement','business','assumed'],['budget','finance','assumed']]
};
export function isSampleLink(edge){
  return links[edge.kind]?.some(([a,b])=>edge.a===a&&edge.b===b)||false;
}

export function sampleNetwork(deal={}) {
  const names=roster[deal.id] || roster.service;
  const leadId=leads[deal.id] || 'technical';
  const people=ids.map((id,i)=>{
    const profile=structuredClone(roles[id]);
    const person={
      id,name:names[i],state:'active',attitude:'Поддерживает',contact:'Контакт установлен',
      decision:false,primary:false,risks:[],opinions:[],disc:null,goals:[],preferences:[],
      goalHint:'',preferenceHint:'',agreements:[],source:'Демонстрационная CRM',...profile
    };
    if(person.state==='planned'){
      person.attitude='Неизвестно'; person.contact='Контакт планируется';
    }
    if(id===leadId){
      person.primary=true;person.state='active';person.contact='Контакт установлен';
      if(deal.participant)person.name=deal.participant;
      if(deal.position)person.title=deal.position;
      if(deal.stage)person.stage=deal.stage;
      if(deal.notes)person.preferences=[deal.notes,...person.preferences.filter(t=>t!==deal.notes)];
      if(deal.agreement)person.agreements.unshift({title:deal.agreement,date:'2026-11-27',status:'Запланировано',detail:'Следующий шаг по сделке «'+deal.title+'».'});
    }
    return person;
  });
  const lead=people.find(p=>p.id===leadId);
  if(deal.id==='soc'){
    lead.dept='Служба ИБ';lead.formal='Управляет защитой информации, мониторингом и реагированием на инциденты.';lead.task='Согласование мер защиты и требований к мониторингу';
  }
  if(deal.id==='vdi'){
    lead.dept='Разработка';lead.formal='Отвечает за среды разработки и инструменты инженерной команды.';lead.task='Проверка рабочих мест в пилотной группе';
  }
  if(deal.id==='analytics'){
    lead.dept='Производство';lead.decision=true;lead.role='Экономический покупатель';
    lead.formal='Отвечает за производственный план и контроль качества продукции.';lead.task='Оценка эффекта для производства';
  }
  if(leadId==='business'){lead.attitude='Поддерживает';lead.risks=[]}
  // Opinions refer to the people who provided each assessment for this deal.
  const reviewers=people.filter(p=>p!==lead).map(p=>p.name);
  lead.opinions=[
    {label:'Компетентный',authors:reviewers.slice(0,6)},
    {label:'Требовательный',authors:reviewers.slice(0,5)},
    {label:'Открыт к диалогу',authors:reviewers.slice(1,5)},
    {label:'Осторожный',authors:reviewers.slice(3,5)}
  ];
  const edges=Object.entries(links).flatMap(([kind,pairs])=>
    pairs.map(([a,b,strength='strong'])=>({a,b,kind,strength})));
  return {people,edges};
}

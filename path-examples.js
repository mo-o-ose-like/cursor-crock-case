// Isolated preview fixtures. No existing deal is augmented with sample events.
import {sampleNetwork} from './sample-network.js';
const north='АО «Ладога»', cyber='Информационная безопасность', ai='Искусственный интеллект';
const descriptors=[
  ['pilot','Защита филиальной сети',north,cyber,'2026-11',''],
  ['team','Защита удалённых площадок','АО «Меридиан»',cyber,'2026-11',''],
  ['empty','Телеметрия станков','ООО «Кварц»','Промышленная телеметрия','2026-11',''],
  ['start','Защита нового филиала',north,cyber,'2026-12',''],
  ['gateway','Шлюз доступа',north,cyber,'2025-04','Выиграна'],
  ['archive','Защита архива',north,cyber,'2025-09','Проиграна'],
  ['model','Поиск по базе знаний',north,ai,'2026-02','Выиграна'],
  ['other','Контроль внешнего доступа','АО «Контур-Сервис»',cyber,'2026-03','Выиграна']
];
export const exampleDeals=descriptors.map(([key,title,company,direction,period,outcome])=>({
  id:'path-demo-'+key,title,company,direction,period,outcome,demo:true,stage:'Переговоры'
}));
const agenda={
  need:['Запрос клиента','Обсудили задачи подразделения и границы проекта.',['technical','business']],
  test:['Техническая проверка','Проверили решение в тестовой среде.',['operations','technical']],
  budget:['Бюджет','Финансовый директор рассмотрела смету.',['finance','technical']],
  procurement:['Условия закупки','Обсудили условия поставки и комплект документов.',['procurement']],
  contract:['Договор','Подписали договор и согласовали дату запуска.',['finance','procurement']],
  data:['Доступ к данным','Владелец данных согласовал состав документов для пилота.',['business','technical']],
  metrics:['Качество ответов','Команда оценила качество поиска на контрольных вопросах.',['operations','business']]
};
function event(key,date,overrides={}){
  const [title,discussion,ids]=agenda[key]||['','',''];
  return {id:key,topic:key,type:key==='contract'?'Подписание':key==='change'||key==='pause'?'Изменение обстоятельств':'Рабочее взаимодействие',title,date,discussion,status:'done',people:[...ids],source:'Протокол рабочей группы от '+date,...overrides};
}
const guided=['need','budget','test','procurement','contract'];
function historical(deal,key){
  const topics=key==='model'?['need','data','metrics','budget','contract']:guided;
  const days=['02','06','11','16','22'];
  const events=topics.map((t,i)=>event(t,deal.period+'-'+days[i]));
  if(key==='archive'){
    events.splice(3,2,event('pause',deal.period+'-17',{title:'Финансирование снято',people:['finance'],discussion:'Комитет перераспределил инвестиционный лимит.',result:'Закупку закрыли без договора.',source:'Решение бюджетного комитета № 18',circumstance:'Финансирование проекта отменено.'}));
  }
  return events;
}
function current(deal){
  const t=deal.period;
  return [
    event('need',t+'-02',{people:['technical','business','finance','manager'],roles:{technical:'Сформулировал ограничения',manager:'Вёл встречу'},discussion:'Уточнили, какие филиалы войдут в пилот.',agreement:'Проверить две версии оборудования.',source:'Протокол установочной встречи № 1'}),
    event('test',t+'-05',{title:'Тест на стенде',people:['technical','operations','manager'],result:'До подачи сметы нашли несовместимый шлюз и заменили его в спецификации.',source:'Акт стендового теста № 4',positive:'В спецификацию вовремя внесли замену.'}),
    event('brief',t+'-08',{title:'Обзор решения',people:['technical','manager'],discussion:'Показали обзорную презентацию без технических схем.',format:'Обзорная презентация',requested:'Техническая схема',preferencePerson:'technical',source:'Протокол демонстрации № 7',result:'После встречи техническая группа перенесла пилот на следующую неделю.',resultSource:'Письмо технической группы от 9 ноября',uncertainty:'Причина переноса не указана. Связь с форматом презентации не подтверждена.',agreement:'Отправить схему подключения.'}),
    event('budget',t+'-10',{title:'Обсуждение сметы',circumstance:'Лимит на пилот ещё не утверждён.',discussion:'Комитет запросил новую смету с учётом замены шлюза.',risk:'До утверждения лимита закупки могут отложить заказ.',result:'Сумму передали на повторное согласование.',uncertainty:'Дата голосования и итоговая сумма пока неизвестны.',source:'Протокол финансовой встречи № 8'}),
    event('change',t+'-12',{title:'Смена куратора',people:['finance','business'],discussion:'Финансовая дирекция передала координацию в бизнес-подразделение.',circumstance:'Сменился куратор проекта.',sponsorChange:{before:'finance',after:'business',recheck:'Объём пилота и согласованный перечень филиалов.'},result:'Новый куратор получил материалы рабочей группы.',uncertainty:'Позиция нового куратора по срокам и условиям пилота пока неизвестна.',source:'Письмо финансовой дирекции № 12'}),
    event('procurement',t+'-19',{title:'Условия поставки',status:'planned',people:['procurement','manager'],discussion:'В повестке — условия поставки.',source:'Приглашение отдела закупок'}),
    event('spec',t+'-19',{title:'Разбор схемы',status:'planned',people:['technical','manager'],discussion:'Запланирован отдельный разбор технической схемы.',source:'Календарь технической группы'})
  ];
}
export function exampleRecord(deal,settings){
  const key=deal.id.slice('path-demo-'.length), network=sampleNetwork({id:'service'});
  const template=network.people.find(p=>p.id==='technical');
  network.people.push({...template,id:'manager',name:'Анна Лукина',title:'Менеджер сделки',dept:'Команда проекта',side:'team',primary:false,decision:false,agreements:[],preferences:[],opinions:[],disc:null,source:'Демонстрационные данные'});
  template.preferences=['Техническая схема'];
  // The demo roster is specific to each company; identical roles do not identify the same person.
  if(![north].includes(deal.company)){
    const names=['Олег Носов','Мария Левина','Антон Серов','Вера Данилова','Илья Климов','Пётр Власов','Лев Лунёв'];
    network.people.filter(p=>p.id!=='manager').forEach((p,i)=>{p.name=names[i];p.opinions=[]});
  }
  const events=deal.outcome?historical(deal,key):key==='pilot'||key==='team'?current(deal):[];
  for(const p of network.people){
    const attended=events.filter(e=>e.people.includes(p.id));
    p.agreements=attended.filter(e=>e.agreement).map(e=>({title:e.agreement,date:e.date,status:'Согласовано',detail:e.source}));
    if(!attended.some(e=>e.status==='done')){
      p.state='planned';p.contact='Контакт планируется';p.attitude='Неизвестно';
      p.opinions=[];p.disc=null;p.risks=[];p.goalHint='';p.preferenceHint='';
      if(!events.length){p.goals=[];p.preferences=[]}
    }
  }
  const edges=network.edges.filter(e=>e.kind!=='process'||events.length);
  return {deal:{...deal},settings,people:network.people,edges,sources:['Демонстрационные протоколы и договорённости'],
    journey:{direction:deal.direction,solution:deal.direction===cyber?'Защита сети':deal.direction,period:deal.period,outcome:deal.outcome,
      outcomeSource:deal.outcome?'Итоговая запись CRM за '+deal.period:'',events,baseline:[]}};
}

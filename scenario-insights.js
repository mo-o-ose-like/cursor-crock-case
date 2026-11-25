import {scenarios} from './map-layout.js';
import {pairKey} from './relations.js';

const eventNames={lost:'Потерять связь',worse:'Испортить отношения',better:'Улучшить отношения',contract:'Заключить договор'};
const detail=(...fields)=>fields.filter(Boolean).join(' · ');
const card=(p,...fields)=>({label:'Карточка · '+p.name,detail:detail(p.name,...fields),personId:p.id});
const agreement=(p,a)=>({label:'Договорённость · '+a.title,detail:detail(p.name,a.title,a.status,a.date||'Дата не указана',a.detail),personId:p.id,agreement:{title:a.title,date:a.date||''}});
const event=(p,e)=>({label:'Действие в What if',detail:detail(p.name,eventNames[e.kind],e.title,e.date,e.detail),personId:p.id});
const pending=p=>(p?.agreements||[]).filter(a=>a.title&&a.status!=='Согласовано');

export function scenarioInsights(record,graph,events,branch,preset,advice){
  const findings=[];
  const people=new Map(graph.people.map(p=>[p.id,p]));
  const actual=new Map(record.people.map(p=>[p.id,p]));
  const add=(kind,id,text,personId,...sources)=>findings.push({kind,id:kind+'-'+id,text,personId,sources:sources.filter(Boolean)});
  const setting=p=>({label:'Условие сценария',detail:detail(scenarios[preset]?.[0],scenarios[preset]?.[1],p.name),personId:p.id});
  for(const p of graph.people){
    const base=actual.get(p.id);
    const steps=events.filter(e=>e.personId===p.id);
    const lost=steps.findLast(e=>e.kind==='lost');
    const relation=steps.findLast(e=>e.kind==='better'||e.kind==='worse');
    const contract=steps.findLast(e=>e.kind==='contract');
    const obligation=pending(base)[0];
    const duty=base?.task;
    if(p.contact==='Связь потеряна'){
      const cause=lost?event(p,lost):preset==='lost'&&base?.contact!==p.contact?setting(p):card(p,p.contact);
      add('risk','lost-'+p.id,obligation?p.name+' может пропустить согласование «'+obligation.title+'», если связь не восстановится.':p.name+' может оказаться недоступен'+(duty?' для задачи «'+duty+'».':' для следующего шага по сделке.'),p.id,cause,obligation?agreement(base,obligation):base&&card(base,duty,base.contact));
    }
    if(relation){
      const worse=relation.kind==='worse';
      const subject=duty?'обсуждение задачи «'+duty+'»':'обсуждение следующего шага';
      add(worse?'risk':'hypothesis','relationship-'+p.id,p.name+(worse?' может отложить ':' может активнее поддержать ')+subject+'.',p.id,event(p,relation),base&&card(base,duty,base.attitude));
    }
    if(contract){
      add('hypothesis','contract-'+p.id,'Договор «'+contract.title+'» может помочь перейти от переговоров к выполнению условий, если стороны согласуют первый результат.',p.id,event(p,contract));
      if(!contract.date)add('risk','contract-date-'+p.id,'В сценарии для договора «'+contract.title+'» не указана дата. Из-за этого стороны могут по-разному понимать, когда приступать к работе.',p.id,event(p,contract));
    }
    if(preset==='delay'&&base&&graph.presetParticipants.includes(p.id)){
      add('risk','delay-'+p.id,obligation?'Задержка бюджета может сдвинуть договорённость «'+obligation.title+'» ('+p.name+').':p.name+' может отложить '+(duty?'работу по задаче «'+duty+'»':'следующий этап')+' до уточнения бюджета.',p.id,setting(p),obligation?agreement(base,obligation):card(base,duty,base.stage));
    }
    if(preset==='decision'&&p.id==='what-if-new'){
      add('risk','authority','Дополнительный согласующий может вернуть решение на обсуждение, если у него возникнут другие критерии.',p.id,setting(p));
      add('hypothesis','authority','Если заранее сверить критерии с новым ЛПР, его замечания можно будет учесть до финального согласования.',p.id,setting(p));
    }
    if(p.ai&&p.id.startsWith('proposal-')){
      const message=branch.messages.find(m=>'proposal-'+m.id===p.id);
      if(message)add('hypothesis','addition-'+p.id,'Участник «'+p.name+'» может помочь обсуждению, если команда подтвердит его роль и полномочия.',p.id,{label:'Предложение сотрудника',messageId:message.id,detail:message.text,personId:p.id});
    }
  }
  for(const p of record.people){
    const manually=branch.removed.includes(p.id);
    const requested=advice.actions[p.id]==='Убрать из сценария';
    if(!manually&&!requested)continue;
    const source=manually?{label:'Действие в What if',detail:p.name+' исключён из этой ветки сценария.'}:advice.items.findLast(it=>it.id.startsWith('message-')&&it.sources.some(s=>s.personId===p.id)&&it.text.includes('убрать из сценария'))?.sources[0];
    if(!source)continue;
    const obligation=pending(p)[0];
    if(p.task||obligation){
      const subject='«'+(obligation?.title||p.task)+'»';
      const evidence=obligation?agreement(p,obligation):card(p,p.task);
      add('risk','removed-'+p.id,'Если исключить участника «'+p.name+'», вопрос '+subject+' может остаться без ответственного.',p.id,source,evidence);
      add('advice','handover-'+p.id,'Назначьте другого ответственного за '+subject+' и подтвердите с ним следующий шаг.',p.id,source,evidence);
    }
  }
  for(const e of graph.edges.filter(e=>e.assistant)){
    const a=people.get(e.a),b=people.get(e.b);
    if(!a||!b||branch.edits.some(edit=>edit.overlay&&edit.next&&pairKey(edit.next)===pairKey(e)))continue;
    const basis=advice.items.find(it=>it.id===e.basis);
    if(!basis)continue;
    const route=a.name+' → '+b.name;
    const src={label:'Предложенная связь',detail:detail(route,e.text),personId:b.id,edge:[a.id,b.id]};
    if(e.proposal==='remove'){
      add('risk','edge-'+e.a+'-'+e.b,'Если убрать переход '+route+', для передачи вопросов может понадобиться другой маршрут.',b.id,...basis.sources,src);
    }else if(e.basis==='lost-'+b.id){
      add('hypothesis','backup-'+b.id,'Возможно, '+a.name+' поможет восстановить контакт с участником «'+b.name+'». Готовность организовать знакомство ещё нужно проверить.',b.id,...basis.sources,src);
    }else{
      const task=actual.get(b.id)?.task;
      add('hypothesis','edge-'+e.a+'-'+e.b,'Переход '+route+' может '+(task?'помочь обсудить задачу «'+task+'».':'дать возможность напрямую согласовать следующий шаг.'),b.id,...basis.sources,task&&card(actual.get(b.id),task),src);
    }
  }
  const touched=new Set(branch.edits.flatMap(change=>[change.old,change.next&&pairKey(change.next)]).filter(Boolean));
  for(const key of touched){
    const original=record.edges.find(e=>e.kind==='process'&&pairKey(e)===key);
    const next=graph.edges.find(e=>pairKey(e)===key);
    const route=next||original;
    if(!route||!people.has(route.a)||!people.has(route.b))continue;
    const from=people.get(route.a),to=people.get(route.b),label=from.name+' → '+to.name;
    if(next?.assistant&&!branch.edits.some(e=>e.next&&pairKey(e.next)===key))continue;
    if(original&&next&&original.text===next.text&&original.date===next.date&&original.status===next.status&&original.proposal===next.proposal)continue;
    const source={label:'Правка связи в What if',detail:detail(label,next?'Связь в сценарии':'Связь удалена в сценарии',route.text,route.status,route.date),personId:to.id,edge:[from.id,to.id]};
    if(next?.proposal==='remove'||!next)add('risk','manual-'+key,'После исключения перехода '+label+' для следующего контакта может понадобиться другой посредник.',to.id,source);
    else add('hypothesis','manual-'+key,'Если переход '+label+' состоится на указанных условиях, стороны смогут сверить следующий шаг напрямую.',to.id,source);
  }
  for(const message of branch.messages){
    const reply=advice.items.find(it=>it.id==='message-'+message.id);
    if(!reply||reply.requestedKind||findings.some(it=>it.kind==='hypothesis'&&it.sources.some(s=>s.messageId===message.id)))continue;
    const source=reply.sources.find(s=>s.messageId===message.id);
    if(source)add('hypothesis','note-'+message.id,message.text,message.personId,source,...reply.sources.filter(s=>s!==source));
  }
  const active=graph.people.filter(p=>p.state!=='finished'&&advice.actions[p.id]!=='Убрать из сценария');
  if(!findings.some(f=>f.kind==='risk')){
    const p=active.find(p=>actual.has(p.id)&&pending(p).some(a=>!a.date));
    const a=p&&pending(p).find(a=>!a.date);
    if(a){
      add('risk','undated-'+p.id,'«'+a.title+'» может задержаться. В карточке участника «'+p.name+'» пока нет даты этой договорённости.',p.id,agreement(p,a));
      add('advice','date-'+p.id,'Уточните с участником «'+p.name+'» срок по договорённости «'+a.title+'» и внесите его в карточку.',p.id,agreement(p,a));
    }
    else {
      const q=active.find(q=>q.state==='planned'&&q.contact!=='Контакт установлен'&&actual.has(q.id));
      if(q)add('risk','planned-'+q.id,'Пока контакт только планируется, '+q.name+' может подключиться слишком поздно'+(q.task?' для задачи «'+q.task+'».':'.'),q.id,card(q,q.contact,q.task));
    }
  }
  if(!findings.some(f=>f.kind==='hypothesis')){
    const p=active.find(p=>actual.has(p.id)&&pending(p).length);
    const a=p&&pending(p)[0];
    if(a)add('hypothesis','agreement-'+p.id,'Если '+p.name+' подтвердит результат по договорённости «'+a.title+'», команде будет проще спланировать следующий шаг.',p.id,agreement(p,a));
  }
  for(const p of active){
    const base=actual.get(p.id);
    if(!base?.risks?.length||findings.some(it=>it.kind==='risk'&&it.personId===p.id))continue;
    add('risk','recorded-'+p.id,'Может задержаться '+(base.task?'работа по задаче «'+base.task+'».':'следующий шаг с участником.'),p.id,card(base,'Отмеченные риски',...base.risks,base.task));
  }
  const decider=active.find(p=>p.decision&&actual.has(p.id));
  if(decider&&!record.settings?.budget){
    add('risk','budget','Если не уточнить лимит бюджета, согласование суммы может потребовать дополнительной встречи.',decider.id,{label:'Настройки сделки',detail:'Поле «Бюджет» не заполнено.'},card(actual.get(decider.id),'Принимает решение о закупке'));
  }
  return findings;
}

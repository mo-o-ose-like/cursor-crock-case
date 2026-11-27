import {relationData} from './relations.js';

export const statusNames={done:'Состоялось',planned:'Запланировано',inProgress:'В процессе',unknown:'Статус неизвестен'};
export const effects={same:'Существенных отличий не выявлено',positive:'Полезное отличие',risk:'Возможный риск',unknown:'Эффект неизвестен',insufficient:'Недостаточно данных'};
const norm=s=>String(s||'').trim().toLocaleLowerCase('ru');
export function eventsFor(record){
  const recorded=record.journey?.events;
  if(Array.isArray(recorded)&&!record.journey.includeProfileEvents)return recorded;
  const events=[];
  for(const p of record.people){
    for(const [i,a] of (p.agreements||[]).entries()){
      events.push({id:'agreement-'+p.id+'-'+i,topic:a.topic||a.title,type:'Договорённость',title:a.title,date:a.date||'',status:a.status==='Согласовано'?'done':a.status==='Запланировано'?'planned':'unknown',
        people:[p.id],discussion:a.detail,agreement:a.status==='Согласовано'?a.title:'',source:'Карточка '+p.name+' · О чём договорились',roles:{[p.id]:'Участник договорённости'}});
    }
  }
  for(const edge of record.edges.filter(e=>e.kind==='process')){
    const e=relationData(edge,'process',record.people);
    if(!e.text&&!e.date)continue;
    const source=record.people.find(p=>p.id===e.a),to=record.people.find(p=>p.id===e.b);
    if(!source||!to)continue;
    events.push({id:'transition-'+e.a+'-'+e.b,topic:e.topic||'transition',type:'Переход взаимодействия',title:e.status==='planned'?'Знакомство с '+to.name:'Переход контакта',date:e.date,status:e.status==='planned'?'planned':e.status==='done'?'done':e.status==='established'?'inProgress':'unknown',people:[e.a,e.b],discussion:e.text,source:edge.source||'Связь в процессе · '+source.name+' → '+to.name});
  }
  return [...events,...(recorded||[])];
}
export function slots(events){
  const known=new Map(),undated=[];
  for(const e of events){
    if(!e.date){undated.push(e);continue}
    if(!known.has(e.date))known.set(e.date,[]);
    known.get(e.date).push(e);
  }
  const groups=[...known].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>({date,items}));
  if(undated.length)groups.push({date:'',items:undated});
  return groups;
}
// A topic is recorded explicitly on an event. Dates determine sequence only.
function topicOf(e){
  const value=norm(e.topic);
  return ['', 'other', 'transition', 'другое'].includes(value)?null:value;
}
function topicIndex(events){
  const index=new Map();
  for(const e of events){
    const topic=topicOf(e);
    if(topic)index.set(topic,index.has(topic)?null:e);
  }
  return index;
}
export function comparisonZones(baseline,current,notes){
  const baseIndex=topicIndex(baseline),nowIndex=topicIndex(current);
  const zones={base:new Map(),now:new Map()};
  function create(base,now){
    const observations=now?notes.get(now.id)||[]:[];
    const tones=[...new Set(observations.map(m=>m.effect))];
    if(!tones.length)tones.push(base&&now&&base.status==='done'&&now.status==='done'?'same':'insufficient');
    const result={base,now,observations,tones};
    if(base)zones.base.set(base.id,result);
    if(now)zones.now.set(now.id,result);
  }
  for(const now of current){
    const topic=topicOf(now);
    create(topic&&nowIndex.get(topic)===now?baseIndex.get(topic):null,now);
  }
  for(const base of baseline)if(!zones.base.has(base.id))create(base,null);
  return zones;
}
function matchScore(items,other){
  const eligible=items.filter(e=>e.date&&e.status==='done');
  const pairs=eligible.flatMap(a=>eligible.filter(b=>a.date<b.date).map(b=>[a.topic,b.topic]));
  return pairs.filter(([a,b])=>other.some(x=>x.topic===a&&x.date&&other.some(y=>y.topic===b&&x.date<y.date&&y.status==='done')&&x.status==='done')).length;
}
export function comparison(record,records,view){
  const j=record.journey||{},direction=view.direction??j.direction??record.deal.direction??'', scope=view.basis||'client';
  const past=records.filter(r=>r.deal.id!==record.deal.id&&r.journey?.outcome);
  const company=norm(record.deal.company);
  const history=past.filter(r=>company&&norm(r.deal.company)===company).sort((a,b)=>String(b.journey.period).localeCompare(String(a.journey.period)));
  const sameType=r=>norm(r.journey.direction)===norm(direction)&&!!direction&&(!j.solution||direction!==j.direction||!r.journey.solution||norm(r.journey.solution)===norm(j.solution));
  const client=history.filter(r=>sameType(r)&&eventsFor(r).some(e=>e.status==='done'));
  const team=past.filter(r=>norm(r.deal.company)!==company&&sameType(r)&&eventsFor(r).some(e=>e.status==='done'));
  const manual=(j.baseline||[]).filter(e=>e.direction===direction);
  const clientBasis=scope==='client'&&(client.length||manual.length||!team.length);
  const sample=clientBasis?client:team;
  const picked=sample.map(r=>({r,score:sample.reduce((s,other)=>s+matchScore(eventsFor(r),eventsFor(other)),0)})).sort((a,b)=>b.score-a.score)[0]?.r;
  const baseline=picked?eventsFor(picked).filter(e=>e.status==='done'):clientBasis?manual:[];
  return {direction,history,clientBasis:Boolean(clientBasis),sample,picked,baseline,manual,allDirections:[...new Set([record.deal.direction,j.direction,...past.map(x=>x.journey.direction),...(j.baseline||[]).map(e=>e.direction)].filter(Boolean))]};
}
export const aspects={
  process:{label:'Ход сделки',icon:'flow'},
  context:{label:'Обстоятельства',icon:'flag'},
  communication:{label:'Коммуникация',icon:'users'}
};
export function observations(event,record,comparison){
  const results=[];
  const add=(kind,effect,label,text,basis,result,sources,extra={})=>{
    results.push({kind,aspect:aspects[kind].label,effect,label,text,basis,result,
      source:[...new Set(sources.filter(Boolean))],...extra});
  };
  const ref=comparison.picked, base=comparison.baseline;
  const current=eventsFor(record);
  const baseIndex=topicIndex(base),nowIndex=topicIndex(current);
  if(event.date&&event.status==='done'&&nowIndex.get(topicOf(event))===event){
    const reference=baseIndex.get(topicOf(event));
    if(reference?.date){
      for(const other of current){
        if(!other.date||other.date<=event.date||other.status!=='done'||other.topic===event.topic)continue;
        const first=baseIndex.get(topicOf(other));
        if(!first?.date||first.date>=reference.date||nowIndex.get(topicOf(other))!==other)continue;
        const label=event.topic==='test'&&other.topic==='budget'?'Проверка до бюджета':'Изменился порядок';
        add('process',event.positive&&event.result?'positive':'unknown',label,
          '«'+event.title+'» произошло до события «'+other.title+'».',
          'В ориентире «'+(ref?.deal.title||'Запись менеджера')+'» сначала было «'+first.title+'», затем «'+reference.title+'».',
          event.result,[event.source,other.source,first.source,reference.source],{unknown:'Влияние на итог всей сделки не установлено.'});
      }
    }
  }
  if(event.circumstance){
    const change=event.sponsorChange;
    const participant=pid=>record.people.find(p=>p.id===pid)?.name;
    const label=change?'Сменился куратор':event.topic==='budget'?'Бюджет на согласовании':event.title;
    add('context',event.risk?'risk':event.positive&&event.result?'positive':'unknown',label,event.circumstance,event.discussion,
      event.result,[event.source],{before:participant(change?.before),after:participant(change?.after),
        recheck:change?.recheck,hypothesis:event.risk,unknown:event.uncertainty||'Влияние изменения на исход сделки пока неизвестно.'});
  }
  if(event.format&&event.requested){
    const p=record.people.find(p=>p.id===event.preferencePerson&&event.people?.includes(p.id));
    if(p?.preferences?.some(x=>norm(x)===norm(event.requested))&&norm(event.format)!==norm(event.requested))
      add('communication','unknown','Другой формат встречи',
        'На встрече с '+p.name+' использовали формат «'+event.format+'».',
        'В профиле участника записано предпочтение «'+event.requested+'».',event.result,
        [event.source,'Карточка '+p.name+' · Предпочтения',event.resultSource],{unknown:event.uncertainty||'Реакция участника на выбранный формат не подтверждена.'});
  }
  if(ref&&event.status==='done'&&topicOf(event)&&event.date&&event.source&&!baseIndex.has(topicOf(event))&&event.type&&results.some(m=>m.kind==='communication')){
    add('process','insufficient','Отдельный шаг в журнале','В текущей сделке отдельно зафиксировано событие «'+event.title+'».',
      'В журнале «'+ref.deal.title+'» отдельной записи на эту тему нет.',null,[event.source,ref.journey.outcomeSource],
      {unknown:'По журналу нельзя установить, обсуждали ли эту тему в другой встрече.'});
  }
  return results;
}

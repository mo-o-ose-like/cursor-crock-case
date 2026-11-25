import {statusBadge,attitudeTone} from './participant-status.js';
import {esc} from './components.js';
import {field,area,submit,states} from './fields.js';

const actions={better:'Улучшить отношения',worse:'Испортить отношения',lost:'Потерять связь',contract:'Заключить договор'};
const outcomes={better:'Отношения улучшились',worse:'Отношения ухудшились',lost:'Связь потеряна',contract:'Договор заключён'};
const attitudes=['Блокирует','Возражает','Нейтрально','Поддерживает','Активно поддерживает'];

export function eventList(view){return view.histories?.[view.scenario||'base']||[]}
export function setEventList(view,events){view.histories??={};view.histories[view.scenario||'base']=events}

export function projectEvents(graph,events){
  for(const ev of events){
    const p=graph.people.find(x=>x.id===ev.personId);
    if(!p||!Object.hasOwn(actions,ev.kind))continue;
    p.changes=[...(p.changes||[]),ev];
    p.sim=outcomes[ev.kind];
    if(ev.kind==='better'||ev.kind==='worse'){
      const alternate={'Сомневается':1,'Против':0};
      const at=alternate[p.attitude]??attitudes.indexOf(p.attitude);
      p.attitude=attitudes[Math.max(0,Math.min(attitudes.length-1,(at<0?2:at)+(ev.kind==='better'?1:-1)))];
    }else if(ev.kind==='lost'){
      p.contact='Связь потеряна';
      for(const e of graph.edges)if(e.a===p.id||e.b===p.id)e.strength='assumed';
    }else{
      p.agreements=[...p.agreements,{title:ev.title,date:ev.date,status:'Согласовано',detail:ev.detail}];
    }
  }
  const last=events.at(-1),who=last&&graph.people.find(p=>p.id===last.personId);
  if(who&&Object.hasOwn(outcomes,last.kind))graph.message=who.name+' · '+(last.kind==='contract'?'Заключён договор «'+last.title+'»':outcomes[last.kind])+'.';
  return graph;
}
const reachable=p=>p.state!=='finished'&&p.contact==='Контакт установлен';
function alternative(graph,p){
  const neighbors=new Set(graph.edges.filter(e=>e.a===p.id||e.b===p.id).flatMap(e=>[e.a,e.b]));
  const priority=q=>(neighbors.has(q.id)?4:0)+(q.primary?2:0)+(q.decision?1:0);
  return graph.people.filter(q=>q.id!==p.id&&reachable(q)&&attitudeTone(q.attitude)!=='opposed').sort((a,b)=>priority(b)-priority(a))[0];
}
export function scenarioAdvice(record,graph,events,selected){
  const last=events.at(-1);
  const focus=graph.people.find(p=>p.id===selected)||graph.people.find(p=>p.id===last?.personId)||graph.people.find(p=>p.sim)||graph.people.find(p=>p.primary)||graph.people[0];
  if(!focus)return [{title:'Добавьте участника',text:'Для разбора нужен хотя бы один человек на карте закупки.'}];
  const tips=[];
  const relevant=[focus,...graph.people.filter(p=>p.id!==focus.id&&(p.changes?.length||p.sim))];
  for(const p of relevant){
    const who=p.name, steps=p.changes||[], lastRelation=steps.findLast(e=>e.kind==='better'||e.kind==='worse');
    const lost=p.contact==='Связь потеряна';
    const firstTip=tips.length;
    const alt=alternative(graph,p);
    if(lost){
      const pending=p.agreements.find(a=>a.status!=='Согласовано');
      tips.push({title:'Восстановите канал связи',text:'Контакт с КРОК потерян: '+who+'. '+(alt?'На карте доступен контакт — '+alt.name+'. Попросите организовать знакомство или передать запрос.':'Уточните у команды клиента, кто сможет заменить этот контакт.')+(pending?' Проверьте, кто теперь отвечает за «'+pending.title+'».':'')});
    }
    if(lastRelation?.kind==='worse'||(!lastRelation&&attitudeTone(p.attitude)==='opposed')){
      tips.push({title:p.decision?'Снимите возражение ЛПР':'Уточните причину разногласий',text:who+' · отношение в сценарии: '+p.attitude+'. '+(lastRelation?.detail?'Разберите причину «'+lastRelation.detail+'» и согласуйте один критерий решения.':'Уточните главное возражение и договоритесь, чем его можно проверить.')+(lost?' Передайте вопрос через доступного участника.':'')});
    }else if(lastRelation?.kind==='better'){
      tips.push({title:'Закрепите поддержку',text:who+' · отношение в сценарии: '+p.attitude+'. '+(p.decision?'Согласуйте критерии финального решения.':p.primary?'Попросите познакомить команду с тем, кто утверждает бюджет.':'Уточните, какой следующий шаг человек готов поддержать.')+(lastRelation.detail?' Используйте контекст «'+lastRelation.detail+'».':'')});
    }
    const contract=steps.findLast(e=>e.kind==='contract');
    if(contract){
      const next={title:'Переведите договор в план работ',text:who+' · «'+contract.title+'». '+(contract.date?'Сверьте обязательства по договору от '+contract.date.split('-').reverse().join('.')+'. ':'Зафиксируйте дату договора. ')+(contract.detail?'Назначьте ответственного за условия «'+contract.detail+'».':'Согласуйте ответственного и дату первого результата.')+(lost?' Для согласования нужен доступный контакт.':'')};
      if(steps.at(-1)?.kind==='contract')tips.splice(firstTip,0,next);else tips.push(next);
    }
    if(p.sim==='Бюджет задержан')tips.push({title:'Пересмотрите сроки',text:who+' участвует в согласовании бюджета. Зафиксируйте новую дату решения и проверьте связанные этапы.'});
    if(p.sim==='Новый участник')tips.push({title:'Уточните полномочия нового ЛПР',text:'Для участника «'+who+'» запланируйте знакомство и согласуйте его критерии финального решения.'});
    if(p.id===focus.id&&!tips.length){
      const pending=p.agreements.find(a=>a.status!=='Согласовано');
      tips.push({title:pending?'Проверьте ближайшую договорённость':'Уточните следующий шаг',text:who+' · '+(p.stage||'этап пока не указан')+'. '+(pending?'Уточните статус «'+pending.title+'» и ответственного за выполнение.':reachable(p)?'Согласуйте конкретный результат следующей встречи.':'Определите способ первого контакта.')});
    }
  }
  if(!record.settings.budget&&graph.people.some(p=>p.decision)&&tips.length===1)tips.push({title:'Уточните бюджет',text:'В сделке бюджет пока не указан. Уточните лимит и порядок утверждения у ЛПР — '+graph.people.find(p=>p.decision).name+'.'});
  return tips;
}
export function scenarioPanel(p,tip){
  const steps=p.changes||[];
  const history=steps.map(ev=>'<li><div><strong>'+esc(ev.kind==='contract'?ev.title:outcomes[ev.kind])+'</strong>'+(ev.date?'<small>'+esc(ev.date.split('-').reverse().join('.'))+'</small>':'')+(ev.detail?'<p>'+esc(ev.detail)+'</p>':'')+'</div><button type="button" class="undo-step" data-undo="'+esc(ev.id)+'" aria-label="Отменить: '+esc(ev.title||outcomes[ev.kind])+'">Отменить</button></li>').join('');
  const form=(kind,label,fields)=>'<details class="sim-form"><summary>'+label+'</summary><form data-sim-form="'+kind+'" class="edit-form">'+fields+submit('Применить в сценарии')+'</form></details>';
  return '<div class="sim-person"><dl class="facts"><div class="fact"><dt>Отношение к сделке</dt><dd>'+statusBadge(p.attitude,'attitude')+'</dd></div><div class="fact"><dt>Контакт с КРОК</dt><dd>'+statusBadge(p.contact,'contact')+'</dd></div><div class="fact"><dt>Участие · этап</dt><dd>'+esc([states[p.state],p.stage].filter(Boolean).join(' · '))+'</dd></div></dl><h3>Действия с участником</h3>'+
    '<div class="sim-actions"><button type="button" data-sim="better" '+(p.attitude===attitudes.at(-1)?'disabled':'')+'>Улучшить отношения</button>'+
    (p.attitude===attitudes[0]?'<button type="button" disabled>Испортить отношения</button>':form('worse','Испортить отношения',area('Причина (по желанию)','detail','','Что вызвало разногласия?')))+
    '<button type="button" data-sim="lost" '+(p.contact==='Связь потеряна'?'disabled':'')+'>Потерять связь</button>'+
    form('contract','Заключить договор',field('Название договора','title','',{required:true,placeholder:'Например, договор на пилот',extra:'maxlength="200"'})+field('Дата договора','date','',{type:'date'})+area('Условия (по желанию)','detail','','Что согласовали стороны?'))+
    '</div>'+(steps.length?'<h3>Изменения в сценарии</h3><ol class="sim-history">'+history+'</ol>':'')+
    '</div>';
}

import {esc} from './components.js';
import {eventList,projectEvents} from './simulation.js';
import {scenarioGraph,scenarios} from './map-layout.js';
import {proposals} from './assistant-proposals.js';
import {pairKey} from './relations.js';
import {scenarioInsights} from './scenario-insights.js';
import {describeFindings} from './finding-context.js';
export function branchFor(v){
  v.branches??={};return v.branches[v.scenario||'base']??={messages:[],removed:[],edits:[]};
}
function prune(graph,removed){
  const ids=new Set(removed);graph.people=graph.people.filter(p=>!ids.has(p.id));
  const members=new Set(graph.people.map(p=>p.id));graph.edges=graph.edges.filter(e=>members.has(e.a)&&members.has(e.b));
}
function applyEdits(graph,edits){
  for(const {old,next} of edits){
    if(old)graph.edges=graph.edges.filter(e=>pairKey(e)!==old);
    if(next){graph.edges=graph.edges.filter(e=>pairKey(e)!==pairKey(next));graph.edges.push({...next})}
  }
}
export function scenarioBoard(record,view,modelFor){
  const branch=branchFor(view),events=eventList(view);
  const graph=scenarioGraph(record,view.scenario);
  const summary=graph.message;
  projectEvents(graph,events);
  applyEdits(graph,branch.edits.filter(e=>!e.overlay));prune(graph,branch.removed);
  function describe(graph){
    const practice=record.practiceScenarios?.[view.scenario];
    if(practice&&events.length===(practice.events?.length||0)){graph.message=practice.description;return}
    const last=events.findLast(e=>graph.people.some(p=>p.id===e.personId));
    const actor=last&&graph.people.find(p=>p.id===last.personId);
    const changes={lost:'потеряна связь',better:'отношения улучшились',worse:'отношения ухудшились',contract:'заключён договор «'+(last?.title||'')+'»'};
    const title=scenarios[view.scenario]?.[0];
    graph.message=last&&changes[last.kind]?[title,'Действие в песочнице · '+actor.name+' — '+changes[last.kind]].filter(Boolean).join('. '):title?title+'. '+(scenarios[view.scenario]?.[1]||''):summary;
  }
  describe(graph);
  if(!view.assistantEnabled)return {graph,advice:null};
  // Rule-based actions remain for legacy messages; AI questions never execute map commands.
  const advice=proposals(record,graph,events,branch.messages.filter(m=>!m.ai));
  const suggestion=modelFor?.(record,graph,events,branch.messages);
  if(suggestion){
    advice.items.unshift({...suggestion,kind:'advice'});
    if(!advice.edges.some(e=>pairKey(e)===pairKey(suggestion.edge))){
      advice.edges.push(suggestion.edge);
      advice.actions[suggestion.edge.a]??=suggestion.action;
    }
  }
  const suggested=projectEvents({people:advice.people.map(p=>({...p})),edges:[]},events);
  const projected={...graph,people:[...graph.people.map(p=>({...p})),...suggested.people],edges:graph.edges.map(e=>({...e}))};
  for(const edge of advice.edges){
    const existing=projected.edges.find(e=>pairKey(e)===pairKey(edge));
    if(existing)Object.assign(existing,edge,{effect:edge.text,assistant:true});
    else projected.edges.push({...edge,effect:edge.text,assistant:true});
  }
  applyEdits(projected,branch.edits.filter(e=>e.overlay));prune(projected,branch.removed);
  describe(projected);
  advice.items.push(...scenarioInsights(record,projected,events,branch,view.scenario,advice));
  describeFindings(advice,projected,record);
  const findings=advice.items.filter(it=>!it.requestedKind);
  for(const question of advice.items.filter(it=>it.requestedKind)){
    const match=findings.find(it=>it.kind===question.requestedKind&&(!question.personId||(it.personId?it.personId===question.personId:it.sources.some(s=>s.personId===question.personId))));
    if(match){
      Object.assign(question,{text:match.text,sources:match.sources,targets:match.targets,subject:match.subject,heading:match.heading,reason:match.reason,unknown:match.unknown,check:match.check,stage:match.stage});
    }else{
      const person=projected.people.find(p=>p.id===question.personId);
      question.text=(person?person.name+' · ':'')+emptyText[question.requestedKind];
    }
  }
  for(const message of branch.messages.filter(m=>m.ai)){
    const answer=message.answer;
    let text=message.status==='pending'?'Анализирую данные сделки…':message.status==='error'?message.error:answer?.answer||'Ответ не сохранён. Отправьте вопрос ещё раз.';
    if(answer?.suggestions?.length)text+='\n\n'+answer.suggestions.map(s=>'• '+s).join('\n');
    if(answer?.coverage&&answer.coverage.used<answer.coverage.total)text+='\n\nИспользована часть источников: '+answer.coverage.used+' из '+answer.coverage.total+'. Для подробного разбора уточните участника или вопрос.';
    advice.items.push({id:'message-'+message.id,kind:'advice',requestedKind:'conversation',ai:true,heading:'Разбор Cursor',text,
      sources:(answer?.citations||[]).map(s=>({label:'['+s.id+'] '+s.label,detail:s.text,personId:s.personId})),targets:{people:[],edges:[]}});
  }
  for(const p of projected.people){
    const action=advice.actions[p.id];if(action)p.proposalAction=action;
    p.scenarioRisks=findings.filter(it=>it.kind==='risk'&&it.personId===p.id);
  }
  const original=view.comparison==='before'?scenarioGraph(record,'',[]):null;
  if(original)original.message='Исходная карта сделки до изменений сценария.';
  return {graph:original||projected,advice};
}
export function visibleProposals(board,showRemoved=false){
  if(showRemoved||!board.advice)return board.graph;
  const removed=new Set(board.graph.people.filter(p=>p.proposalAction==='Убрать из сценария').map(p=>p.id));
  return {...board.graph,people:board.graph.people.filter(p=>!removed.has(p.id)),edges:board.graph.edges.filter(e=>!removed.has(e.a)&&!removed.has(e.b))};
}
const categories={risk:['Риски','Риск сценария'],hypothesis:['Гипотезы','Гипотеза'],advice:['Советы','Совет']};
const emptyText={risk:'Для этого сценария пока недостаточно данных, чтобы указать конкретный риск.',hypothesis:'Пока нет данных для конкретной гипотезы. Можно изменить сценарий или предложить связь в чате.',advice:'Сформулируйте предложение в чате, чтобы обсудить следующий шаг.'};

function evidenceLinks(advice,it){
  const i=advice.items.indexOf(it);
  return it.sources.map((s,j)=>`<a href="#evidence-${i}-${j}" data-source-item="${i}" data-source-index="${j}">${esc(s.label)}</a>`).join('');
}

function findingHTML(advice,it,branch,interactive=false){
  const label=it.id==='local-model'?'Совет модели устройства':categories[it.kind][1];
  const target=interactive&&it.targets?.people.length;
  const attrs=target?' data-finding="'+esc(it.id)+'"':'';
  const title=it.heading||label;
  const header=target?'<button type="button" data-focus-finding="'+esc(it.id)+'" aria-pressed="false" title="Показать на карте">'+esc(title)+'</button>':'<strong>'+esc(title)+'</strong>';
  const subject=it.subject&&title!==it.subject?'<small class="finding-subject">'+esc(it.subject)+'</small>':'';
  let extra='';
  if(it.kind==='hypothesis'&&it.check){
    const reviewEntry=branch?.reviews?.[it.id];
    const status=reviewEntry?.basis===it.reviewBasis?reviewEntry?.value:'';
    const options=[['','Не проверено'],['confirmed','Подтверждено'],['rejected','Отклонено']];
    const review=interactive&&!it.requestedKind?'<label class="review-status">Статус <select data-review-finding="'+esc(it.id)+'">'+options.map(([val,name])=>'<option value="'+val+'" '+((status||'')===val?'selected':'')+'>'+name+'</option>').join('')+'</select></label>':'';
    extra='<details class="finding-check"><summary>Что уточнить</summary><p>'+esc(it.unknown||'')+'</p><p><b>Как проверить</b> '+esc(it.check)+'</p></details>'+review;
  }else if(it.reason&&it.reason!==it.text){
    extra='<div class="finding-detail"><b>'+(it.kind==='risk'?'Почему':'Зачем')+'</b> '+esc(it.reason)+'</div>';
  }
  if(it.kind==='advice'&&it.stage)extra+='<div class="finding-detail"><b>Этап</b> '+esc(it.stage)+'</div>';
  const location=target?'<p class="finding-location" data-finding-location hidden></p>':'';
  const body=it.ai?it.text.split(/\n+/).filter(Boolean).map(line=>'<p>'+esc(line)+'</p>').join(''):'<p>'+esc(it.text)+'</p>';
  return '<article class="chat-reply finding-'+it.kind+'"'+attrs+'>'+header+subject+body+extra+'<div class="citations" aria-label="Источники">'+evidenceLinks(advice,it)+'</div>'+location+'</article>';
}

export function personRisksHTML(advice,p){
  if(!p.scenarioRisks?.length)return '';
  return '<section class="participant-risks"><h3>Риски в этом сценарии</h3>'+p.scenarioRisks.map(it=>findingHTML(advice,it)).join('')+'</section>';
}

export function chatHTML(advice,branch,selected,kind='risk'){
  const tabs=Object.entries(categories).map(([key,[name]])=>`<button type="button" data-insight-kind="${key}" aria-pressed="${kind===key}" aria-controls="scenario-findings">${name}</button>`).join('');
  const findings=advice.items.filter(it=>it.kind===kind&&!it.requestedKind);
  const list=findings.length?findings.map(it=>findingHTML(advice,it,branch,true)).join(''):'<p class="insight-empty">'+emptyText[kind]+'</p>';
  const conversation=branch.messages.map(m=>{
    const it=advice.items.find(x=>x.id==='message-'+m.id);
    const hypothesis=advice.items.find(f=>f.kind==='hypothesis'&&!f.requestedKind&&f.sources.some(src=>src.messageId===m.id));
    const jump=hypothesis?'<button type="button" class="text-act" data-chat-result="'+esc(hypothesis.id)+'">К гипотезе</button>':'';
    return '<article class="chat-question"><small>Предположение сотрудника</small><p>'+esc(m.text)+'</p></article>'+(it?'<div class="assistant-answer"><small>Разбор Cursor</small>'+findingHTML(advice,it,branch,true)+jump+'</div>':'');
  }).join('');
  const thread=conversation?'<section class="scenario-thread" aria-label="Переписка"><h3>Переписка</h3>'+conversation+'</section>':'';
  return `<div class="inspect-head"><div class="chat-title"><img src="assets/eyes.webp" alt=""><div><h2>Помощник Cursor</h2><small>Демо · разбор сценария</small></div></div><button class="icon-btn" data-map="close-chat" title="Свернуть чат" aria-label="Свернуть чат">×</button></div><div class="insight-tabs" role="group" aria-label="Разбор сценария">${tabs}</div><div class="chat-log"><section id="scenario-findings" aria-label="${categories[kind][0]}">${list}</section>${thread}</div><form id="chat-form" class="chat-form"><label for="proposal-input">${selected?'Предложение об участнике · '+esc(selected.name):'Предложение для сценария'}</label><textarea id="proposal-input" name="message" rows="2" required maxlength="320" placeholder="Например, подключить юриста к встрече"></textarea><button class="btn primary" type="submit">Отправить</button></form>`;
}

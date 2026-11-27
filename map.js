import {openObservation,applyObservation} from './observations.js';
import {drawMapLearning, mapLearningState, nextMapLearning} from './learning-builder.js';
import {caseForModel,inferProposal} from './local-model.js';
import {askGroq} from './groq-chat.js';
import {sourceText} from './source-text.js';
import {loadDesigns,saveDesign,restoreDesign,deleteDesign,dealChanges,changeDetails,designList} from './saved-designs.js';
import {departmentPair,edgeArt,edgeLegend} from './edge-art.js';
import {boardSpace,frameBoard,frameObjects,wasAutomatic} from './board-camera.js';
import {edgeId,recordDiff,applyRecordDiff,viewEdit,historyFor,remember,restoreView} from './map-history.js';
import {departmentRelationCard,editRelation,relationCard,pairKey} from './relations.js';
import {branchFor,scenarioBoard,chatHTML,personRisksHTML,visibleProposals} from './scenario-board.js';
import {eventList,setEventList} from './simulation.js';
import {terms,marked,highlightPanel,searchHits,resultList,filterPerson} from './map-search.js';
import {esc,icon,brand,eyes,button} from './components.js';
import {dealRecord,saveRecord,getView,saveView} from './data.js';
import {stages} from './sample-network.js';
import {modes,scenarios,layout,risksFor,directInfluenceEdges} from './map-layout.js';
import {attitudeTone} from './participant-status.js';
import {avatar,chip,inspector,editParticipant,handlePanel,labelRole,roleName} from './person-panel.js';
import {knowledgeGaps} from './knowledge-gaps.js';
import {field,select,modal,notify,states,submit,valid} from './fields.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const control=(key,glyph,label,on=false,cls='')=>`<button class="tool ${on?'on':''} ${cls}" type="button" data-map="${key}" aria-pressed="${on}">${icon(glyph,16)}<span>${label}</span></button>`;
const iconControl=(key,glyph,label)=>`<button class="icon-btn" type="button" data-map="${key}" aria-label="${label}" title="${label}">${icon(glyph,17)}</button>`;
const xy=n=>`left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px`;
const legendText={
  process:[['finished','Контакт пройден'],['normal','В работе'],['planned','Планируем контакт']],
  org:[], influence:[['purple','ЛПР'],['green','Основной контакт КРОК'],['other','Другой участник']],
  scenario:[['amber','Изменение сценария']]
};
function sideNav(mode,id){
  return `<aside class="map-nav"><a class="map-brand" href="#deals" aria-label="Cursor — ваши сделки">${brand()}</a><span class="nav-label">Режимы</span><nav aria-label="Режимы карты">${Object.entries(modes).map(([key,text])=>`<button class="nav-item ${key===mode?'active':''}" type="button" data-mode="${key}" aria-pressed="${key===mode}" title="${text}">${text}</button>`).join('')}</nav><div class="nav-bottom"><a class="nav-item" href="#learn/${esc(id)}" title="Обучение">${icon('help',18)}<span>Обучение</span></a><a class="nav-item" href="#settings/${esc(id)}" title="Настройки сделки">${icon('settings',18)}<span>Настройки сделки</span></a><a class="nav-item" href="#deals" title="К сделкам">${icon('back',18)}<span>К сделкам</span></a></div></aside>`;
}
function toolBar(mode,v){
  const process=mode==='process';
  const fCount=Object.values(v.filters||{}).filter(Boolean).length;
  return `<div class="map-toolbar"><label class="map-search">${icon('search',17)}<input type="search" id="map-search" placeholder="${mode==='org'?'Поиск по сотрудникам и отделам…':'Поиск по участникам и сведениям…'}" aria-label="Поиск по карте" value="${esc(v.query||'')}"></label><div class="tool-scroll">${control('filters','filter','Фильтры'+(fCount?' · '+fCount:''),!!fCount)}${process?control('risks','warning','Подсветить риски',!!v.risks,'risk-tool')+control('unknown','help','Чего не знаем',false,'unknown-tool'):''}</div></div>`;
}
function card(n,mode,v,matching,tokens,neighbor,ghost,stale=false){
  const mark=value=>marked(value,tokens);
  const p=n.p,selected=v.selected===p.id,tag=p.role?labelRole(p.role):'—';
  const risk=v.risks&&mode==='process'&&risksFor(p);
  const classes=['person-card',mode,mode==='org'&&n.h<90?'compact-org':'',neighbor?'connected-node':'',ghost?'ghost-node':'',p.ai||p.proposalAction?'proposed-node':'',p.proposalAction==='Убрать из сценария'?'proposed-removal':'',mode==='process'||mode==='scenario'?p.state:'',selected?'selected':'',!matching?'dim':tokens.length?'search-match':'',p.sim?'sim':'',risk?.length?'risk':'',mode==='influence'?(p.decision?'decision':p.primary?'primary-person':'other-person'):'',mode==='process'&&v.highlight&&p.decision?'decision-highlight':''].join(' ');
  const shortRole=(mode==='org'||mode==='influence'?p.title:p.task)||p.title||'Уточнить ответственность';
  let detail='';
  if(mode==='process'||mode==='scenario'){
    const attitude=attitudeTone(p.attitude);
    detail=`<div class="card-foot"><span class="relation-line"><i class="dot status-${attitude}" aria-hidden="true"></i><span title="${esc(p.attitude||'Неизвестно')}">${mark(p.attitude||'Неизвестно')}</span></span><span class="contact-line">${icon('handshake',13)}<span title="${esc(p.contact||'Нет данных')}">${mark(p.contact||'Нет данных')}</span></span><b class="mh" title="Miller–Heiman · ${esc(roleName(p)+(p.role&&p.roleStatus!=='confirmed'?' · предполагаемая роль':''))}">${tag}</b></div>`;
  }else if(mode==='influence')detail=`<div class="influence-meta">${p.decision?chip('ЛПР','purple'):''}${p.primary?chip('Основной контакт КРОК','green'):''}<span>${esc(p.influence)} влияние</span></div><small class="contact-caption" title="${esc(p.contact)}">${mark(p.contact)}</small>`;
  const badge=p.proposalAction||p.sim||(risk?.length?risk[0]:mode==='process'&&v.highlight&&p.decision?'ЛПР':'');
  if(mode==='scenario'&&p.scenarioRisks?.length){
    detail+='<span class="scenario-risk-flag" title="'+esc(p.scenarioRisks[0].text)+'">Риск сценария</span>';
  }
  const phase=mode==='process'?({active:'В работе',finished:'Контакт пройден',planned:'Планируем контакт'})[p.state]:'';
  return `<button type="button" class="${classes}${stale?' stale-person':''}" style="${xy(n)}" data-node="${esc(p.id)}" aria-pressed="${selected}" title="${esc([ghost||[p.name,shortRole,p.proposalAction].filter(Boolean).join(' · '),stale?'Сведения изменились после сохранения':''].filter(Boolean).join(' · '))}"><span class="node-flags">${phase?'<span class="phase-flag">'+phase+'</span>':''}${badge?'<span class="node-flag" title="'+esc(badge)+'">'+mark(badge)+'</span>':''}</span><span class="node-main">${avatar(p)}<span class="node-copy"><strong title="${esc(p.name)}">${mark(p.name)}</strong><small title="${esc(shortRole)}">${mark(shortRole)}</small></span>${icon('chevron',13)}</span>${detail}</button>`;
}
function freshMode(){return {query:'',filters:{},positions:{},sections:{},collapsed:[],selected:null,camera:null}}
export function mountMap({id,root,go,signal,search}){
  let record=dealRecord(id);if(!record){go('all');return}
  let training=mapLearningState(id), learningCollapsed=false;
  let savedRecord=structuredClone(record);
  const history=historyFor(id);
  let insightKind='risk';
  let hoverFinding=null,keyFinding=null,pinnedFinding=null,scenarioLayer=null;
  let flyTimer;
  const drafts=new Map();
  const draftKey=()=>JSON.stringify([v.scenario||'base',v.selected||'']);
  let designs=loadDesigns(id),activeDesign=null,differences=[],stalePeople=new Set(),staleEdges=new Set();
  let comparedRecord=null,comparedDesign=null;
  let advice=null,removedCount=0,chatOpen=false,edgeIndex=-1,edgeEditing=false,edgeStart=null,ghostId=null,edgePoint=null;
  const state=getView(id);if(!modes[state.mode])state.mode='process';
  for(const view of Object.values(state.views||{}))for(const branch of Object.values(view.branches||{}))for(const message of branch.messages||[]){
    if(message.ai&&message.status==='pending'){message.status='error';message.error='Запрос прерван при закрытии страницы. Отправьте вопрос ещё раз.';}
  }
  let mode=state.mode,v,graph,model,pop='',transient=null,suppressClick=false;
  let observer=null,layoutSpace=null,dragFrame=0;
  let previewTimer,hideTimer,previewEdge=null;
  const results=new Map();
  const chatResponses=new Map();
  function syncChatResponses(){
    for(const branch of Object.values(state.views.scenario?.branches||{}))for(const message of branch.messages||[]){
      if(message.ai&&message.status==='pending'&&chatResponses.has(message.id))Object.assign(message,chatResponses.get(message.id));
    }
  }
  function localModel(activeRecord,base,events,messages){
    if(!globalThis.LanguageModel)return null;
    const input=caseForModel(activeRecord,base,events,messages);
    if(!results.has(input.key)){
      results.set(input.key,null);
      inferProposal(input,signal).then(result=>{
        if(!result||signal.aborted)return;
        results.set(input.key,result);
        if(mode==='scenario'&&v.assistantEnabled&&!transient){const typed=$('#proposal-input')?.value;refresh();if(typed&&$('#proposal-input'))$('#proposal-input').value=typed}
      });
    }
    return results.get(input.key);
  }
  let hits=[],matchedIds=new Set();
  const $=s=>root.querySelector(s);
  const save=()=>saveView(id,state);
  function findDesign(view){
    const branch=view.scenario||'base';
    const copy=view.restoredCopies?.[branch];
    if(copy)return copy;
    const legacy=designs.find(d=>d.id===view.designIds?.[branch]);
    if(legacy){view.restoredCopies??={};view.restoredCopies[branch]=legacy}
    return legacy;
  }
  function scenarioFor(view,modelFor){
    const design=findDesign(view),base=design?.baseline||record;
    function suggest(r,g,events,messages){
      if(design&&JSON.stringify(events)===JSON.stringify(eventList(design.view))&&JSON.stringify(messages)===JSON.stringify(branchFor(design.view).messages))return design.modelSuggestion;
      return modelFor?.(r,g,events,messages);
    }
    return scenarioBoard({...base,people:base.people.filter(p=>!p.modes||p.modes.includes('scenario'))},view,suggest);
  }
  function replaceSandbox(next,label){
    drafts.clear();
    const step={mode:'scenario',label,workspaceBefore:structuredClone(v),workspaceAfter:structuredClone(next)};
    history.undo.push(step);if(history.undo.length>80)history.undo.shift();history.redo.length=0;
    state.views.scenario=next;selectMode('scenario');
  }
  function designAction(action){
    if(action==='save-design'){
      const body='<form class="edit-form">'+field('Название сценария','name','',{required:true,placeholder:'Например, пилот с финансовым директором',extra:'maxlength="100" autofocus'})+'<p class="error" role="alert" data-design-error></p>'+submit('Сохранить')+'</form>';
      modal('Сохранить сценарий',body,({name},form)=>{
        const title=name.trim();if(!title)return false;
        designs=loadDesigns(id);
        const error=form.querySelector('[data-design-error]');
        if(designs.some(d=>d.name.toLocaleLowerCase('ru')===title.toLocaleLowerCase('ru'))){error.textContent='Сценарий с таким именем уже есть. Введите другое название.';return false}
        try{const design=saveDesign(title,activeDesign?.baseline||record,v,advice?.items.find(item=>item.id==='local-model')||null);designs.unshift(design)}
        catch{error.textContent='Не удалось записать сценарий в браузере. Проверьте доступное место и разрешение на хранение данных.';return false}
        drawControls();transform();notify('Сценарий «'+title+'» сохранён');
      });return;
    }
    if(action==='clear-sandbox'){
      const body='<p>Будут сброшены все черновые изменения What if для этой сделки, включая сообщения помощнику и расположение карточек. Сохранённые сценарии можно будет открыть снова.</p><form class="design-dialog-actions"><button type="button" data-close class="btn secondary" autofocus>Отмена</button>'+submit('Очистить песочницу')+'</form>';
      modal('Очистить песочницу?',body,()=>{replaceSandbox(freshMode(),'Очистка песочницы');notify('Песочница очищена')});return;
    }
    if(action==='saved-designs'){
      designs=loadDesigns(id);
      const search=field('Поиск по названию','query','',{type:'search',placeholder:'Название сценария',extra:'autocomplete="off" autofocus'});
      const dialog=modal('Сохранённое',search+'<div class="saved-results">'+designList(designs)+'</div>');
      const input=dialog.querySelector('input[name="query"]');
      const render=()=>{dialog.querySelector('.saved-results').innerHTML=designList(designs,input.value)};
      input.addEventListener('input',render);
      const syncList=()=>{designs=loadDesigns(id);render()};
      window.addEventListener('storage',syncList);
      dialog.addEventListener('close',()=>window.removeEventListener('storage',syncList),{once:true});
      dialog.addEventListener('click',event=>{
        const remove=event.target.closest('[data-delete-design]');
        if(remove){
          const design=designs.find(d=>d.id===remove.dataset.deleteDesign);if(!design)return;
          const body='<p>Удалить «'+esc(design.name)+'» из сохранённых сценариев?</p><form class="design-dialog-actions"><p class="error" role="alert" data-delete-error></p><button type="button" data-close class="btn secondary" autofocus>Отмена</button>'+submit('Удалить')+'</form>';
          const confirm=modal('Удалить сценарий?',body,(_,form)=>{
            try{deleteDesign(id,design.id)}
            catch{form.querySelector('[data-delete-error]').textContent='Не удалось удалить сценарий из этого браузера.';return false}
            syncList();notify('Сценарий «'+design.name+'» удалён');
            confirm.addEventListener('close',()=>input.focus(),{once:true});
          });
          return;
        }
        const button=event.target.closest('[data-restore-design]');if(!button)return;
        const design=designs.find(d=>d.id===button.dataset.restoreDesign);if(!design)return;
        dialog.close();record=dealRecord(id);savedRecord=structuredClone(record);
        replaceSandbox(restoreDesign(v,design),'Восстановление сценария');
        notify('Восстановлен сценарий «'+design.name+'»');
      });return;
    }
    modal('Изменения в сделке',changeDetails(differences));
  }
  function selectMode(key,person,reset=false){
    if(!modes[key])return;
    resetFinding();
    mode=key;state.mode=key;state.views??={};v=state.views[key]??=freshMode();
    v.layoutMode??=Object.keys(v.positions||{}).length?'free':'auto';v.positions??={};v.sections??={};v.filters??={};
    chatOpen=mode==='scenario'&&!!v.assistantEnabled&&!person;edgeEditing=false;edgeStart=null;edgeIndex=-1;ghostId=person||null;edgePoint=null;
    if(person){
      v.selected=person;
      if(reset){v.filters={};v.query=''}
      if(mode==='org'&&!v.sections[person])v.sections[person]=['formal'];
    }
    pop='';mount();if(person)centerTargets([person],[]);save();
  }
  function editView(label,apply){
    const before=viewEdit(v);apply();const after=viewEdit(v);remember(history,{mode,scenario:v.scenario,label,before,after});
    refresh();save();
  }
  function replay(reverse){
    const source=reverse?history.undo:history.redo,dest=reverse?history.redo:history.undo;
    const step=source.pop();if(!step)return;
    if(step.workspaceBefore){
      state.views.scenario=structuredClone(reverse?step.workspaceBefore:step.workspaceAfter);
      dest.push(step);selectMode(mode);notify((reverse?'Отменено · ':'Возвращено · ')+step.label);return;
    }
    if(step.patch){record=applyRecordDiff(dealRecord(id),step.patch,reverse);saveRecord(record);savedRecord=structuredClone(record)}
    if(step.before){const view=state.views[step.mode]??=freshMode();restoreView(view,reverse?step.after:step.before,reverse?step.before:step.after);if(step.mode===mode&&step.before.layoutMode!==step.after.layoutMode)v.camera=null}
    dest.push(step);pop='';edgeStart=null;refresh();save();notify((reverse?'Отменено · ':'Возвращено · ')+step.label);
  }
  function graphIn(key){
    const people=record.people.filter(p=>!p.modes||p.modes.includes(key));
    if(key==='scenario'){
      const target=state.views.scenario||freshMode();
      return scenarioFor(target).graph;
    }
    const ids=new Set(people.map(p=>p.id));
    const edges=key==='influence'?directInfluenceEdges(record.edges,people):record.edges.filter(e=>e.kind===key&&ids.has(e.a)&&ids.has(e.b));
    return {people,edges};
  }
  function ghostReason(p){
    if(!p||ghostId!==p.id)return '';
    const labels={dept:'Подразделение',level:'Уровень иерархии',state:'Участие в сделке',stage:'Этап закупки'};
    const hidden=Object.entries(v.filters||{}).filter(([k,val])=>val&&labels[k]&&p[k]!==val).map(([k,val])=>labels[k]+' — '+(k==='state'?states[val]||val:val));
    if(terms(v.query).length&&!searchHits([p],mode,v.query,{}).length)hidden.push('Поиск — «'+v.query+'»');
    return hidden.length?'Карточка скрыта условиями отбора: '+hidden.join(', ')+'.':'';
  }
  function mount(){
    document.title=modes[mode]+' · '+record.deal.title+' — Cursor';
    const scenario=mode==='scenario';
    root.innerHTML=`<main class="map-app">${sideNav(mode,id)}<div class="map-work"><header id="tools">${toolBar(mode,v)}</header><div class="board-heading"><div><div class="deal-context">${esc(record.deal.company)}<span>/</span>${esc(record.deal.title)}</div><h1>${modes[mode]}</h1></div><div id="board-actions"></div>${!scenario?button('Участник',{action:'add-person',leading:'plus',variant:'secondary',cls:'add-person'}):''}</div><section id="map-learning" aria-label="Подсказки обучения" hidden></section>${scenario?`<div class="simulation"><label for="scenario">Сценарий</label><select id="scenario"><option value="">Свой сценарий</option>${Object.entries(scenarios).map(([k,[s]])=>'<option value="'+k+'" '+(v.scenario===k?'selected':'')+'>'+s+'</option>').join('')}</select><div id="design-tools" class="design-tools" role="group" aria-label="Сценарии What if"></div></div>`:''}<div class="map-content"><div id="surface" tabindex="0" role="region" aria-label="Доска участников. Стрелки перемещают карту, плюс и минус меняют масштаб."><div id="world"></div><div id="empty-map"></div></div><div id="board-assistant"></div><div id="camera-tools"></div><aside id="inspector" aria-label="Карточка участника" hidden></aside><div id="edge-preview" role="tooltip" hidden></div><div id="map-pop"></div></div>${scenario?'<div class="scenario-result" role="status"></div>':''}</div></main>`;
    if(v.selected||chatOpen){$('.map-content').classList.add('with-panel');$('#inspector').hidden=false}
    refresh();
    observer?.disconnect();
    if(typeof ResizeObserver!=='undefined'){
      let width=$('#surface').clientWidth,height=$('#surface').clientHeight;
      observer=new ResizeObserver(()=>{
        const s=$('#surface');
        if(!s||transient||width===s.clientWidth&&height===s.clientHeight)return;
        width=s.clientWidth;height=s.clientHeight;
        arrange();adjustCamera();drawWorld();drawPopover();
      });
      observer.observe($('#surface'));
    }
  }
  function buildGraph(){
    syncChatResponses();
    activeDesign=mode==='scenario'?findDesign(v):null;
    if(activeDesign!==comparedDesign||record!==comparedRecord){
      differences=activeDesign?dealChanges(activeDesign.baseline,record):[];
      stalePeople=new Set(differences.flatMap(d=>d.ids));
      staleEdges=new Set(differences.map(d=>d.edge).filter(Boolean));
      comparedDesign=activeDesign;comparedRecord=record;
    }
    if(mode==='scenario'){
      const result=scenarioFor(v,localModel);
      scenarioLayer=result.graph;
      removedCount=result.graph.people.filter(p=>p.proposalAction==='Убрать из сценария').length;
      graph=visibleProposals(result,v.showRemoved||!!ghostId&&result.graph.people.some(p=>p.id===ghostId&&p.proposalAction==='Убрать из сценария'));advice=result.advice;
    }else{graph=graphIn(mode);advice=null;scenarioLayer=null}
    hits=searchHits(graph.people,mode,v.query,v.filters);
    matchedIds=new Set(hits.map(h=>h.pid));
    arrange();
  }
  function usableSpace(){
    const s=$('#surface');return {...boardSpace(s.clientWidth||800,s.clientHeight||560,mode==='scenario'),orderByManager:true};
  }
  function arrange(){
    const groups=new Set(graph.people.filter(p=>matchedIds.has(p.id)||p.id===ghostId).map(p=>p.dept||'Подразделение не указано'));
    const options={...v,collapsed:(v.collapsed||[]).filter(g=>!groups.has(g))};
    const s=$('#surface'),space=usableSpace();
    if(v.camera&&!v.cameraMode){
      const previous=layout(graph.people,graph.edges,mode,options);
      v.cameraMode=wasAutomatic(v.camera,previous.bounds,s.clientWidth||800,s.clientHeight||560)?'auto':'manual';
      if(v.cameraMode==='manual'||v.layoutMode==='free')v.layoutViewport={legacy:true};
    }
    if(!v.camera||!v.cameraMode)v.cameraMode='auto';
    const locked=v.layoutMode==='free'||v.cameraMode==='manual';
    layoutSpace=locked?(v.layoutViewport??=space):space;
    const source=scenarioLayer||graph;
    model=layout(source.people,source.edges,mode,options,layoutSpace.legacy?undefined:layoutSpace);
    if(scenarioLayer&&graph.people.length!==source.people.length){
      const ids=new Set(graph.people.map(p=>p.id));
      for(const n of model.nodes.values())if(!ids.has(n.p.id))n.hidden=true;
    }
  }
  function drawWorld(){
    clearPreview();
    syncFindingVisibility();
    const tokens=terms(v.query);
    const matching=new Map(graph.people.map(p=>[p.id,tokens.length?matchedIds.has(p.id):filterPerson(p,v.filters)]));
    const frames=model.groups.map(g=>`<div class="dept-frame ${mode==='influence'?'influence-group':''}" style="${xy(g)}"${mode==='org'?` data-org-group="${esc(g.key)}"`:''}></div>`).join('');
    const labels=model.groups.map(g=>mode==='org'?`<button class="dept-label" style="left:${g.x}px;top:${g.y}px;width:${g.w}px" data-collapse="${esc(g.name)}" data-org-group="${esc(g.key)}" aria-expanded="${!g.collapsed}">${icon('building',15)}<strong title="${esc(g.name)}">${marked(g.name,tokens)}</strong><span>${g.members.length}</span>${icon(g.collapsed?'chevron':'down',14)}</button>`:`<div class="dept-label static" style="left:${g.x}px;top:${g.y}px;width:${g.w}px">${icon('building',15)}<strong title="${esc(g.name)}">${marked(g.name,tokens)}</strong></div>`).join('');
    const neighbors=new Set(graph.edges.filter(e=>e.a===v.selected||e.b===v.selected).flatMap(e=>[e.a,e.b]));
    neighbors.delete(v.selected);
    const lines=edgeArt(graph.edges,model,mode,v.selected,matching,staleEdges);
    $('#world').innerHTML=frames+lines+labels+[...model.nodes.values()].filter(n=>!n.hidden).map(n=>card(n,mode,v,matching.get(n.p.id),tokens,neighbors.has(n.p.id),ghostReason(n.p),stalePeople.has(n.p.id))).join('');
    $('#surface').classList.toggle('free-layout',v.layoutMode==='free'&&!edgeEditing);
    const filtered=v.query||Object.values(v.filters||{}).some(Boolean);
    const total=[...matching.values()].filter(Boolean).length;
    $('#empty-map').innerHTML=!graph.people.length?`<div class="board-empty">${eyes()}<h2>Пока нет участников</h2><p>Добавьте сотрудника, чтобы начать строить карту.</p>${mode!=='scenario'?button('Добавить участника',{action:'add-person',leading:'plus'}):'<button data-mode="process" class="btn secondary">К процессу закупки</button>'}</div>`:filtered?`<div class="match-count" role="status">Найдено: ${total} из ${graph.people.length}${tokens.length?'<button data-map="results">Результаты</button><button data-map="clear-search">Очистить поиск</button>':'<button data-map="clear-filters">Сбросить</button>'}</div>`:'';
    if(mode==='scenario')$('.scenario-result').textContent=graph.message;
    paintFinding();
    transform();
  }
  function drawInspector(){
    const panel=$('#inspector'),p=training&&edgeEditing?null:graph.people.find(x=>x.id===v.selected);
    const chat=mode==='scenario'&&v.assistantEnabled&&chatOpen;
    panel.hidden=!p&&!chat;$('.map-content').classList.toggle('with-panel',!panel.hidden);
    if(chat){panel.setAttribute('aria-label','Чат помощника');panel.innerHTML=chatHTML(advice,branchFor(v),p,insightKind);$('#proposal-input').value=drafts.get(draftKey())||'';$('#chat-form button[type="submit"]').disabled=branchFor(v).messages.some(m=>m.ai&&m.status==='pending');paintFinding();return}
    panel.setAttribute('aria-label','Карточка участника');
    if(p){
      const available=Object.keys(modes).filter(key=>key!==mode&&graphIn(key).people.some(person=>person.id===p.id));
      const related=differences.filter(row=>row.ids.includes(p.id));
      const changes=related.length?'<details class="person-differences" open><summary>Изменилось в сделке</summary>'+changeDetails(related)+'</details>':'';
      const risks=mode==='scenario'&&advice?personRisksHTML(advice,p):'';
      panel.innerHTML=inspector(p,mode,v,available,ghostReason(p),changes+risks);highlightPanel(panel,terms(v.query));
    }else panel.innerHTML='';
  }
  function drawLearning(){
    drawMapLearning($('#map-learning'),{training,record,mode,edgeEditing,edgeStart,pop,collapsed:learningCollapsed});
  }
  function drawControls(){
    drawLearning();
    if(mode==='scenario'){
      const status=activeDesign?'<b class="restored-name">'+esc(activeDesign.name)+'</b>':'';
      const changes=differences.length?'<button type="button" class="design-alert" data-map="design-diff">Изменения в сделке · '+differences.length+'</button>':'';
      $('#design-tools').innerHTML=status+changes+'<button type="button" data-map="save-design">Сохранить сценарий</button><button type="button" class="design-library" data-map="saved-designs">Сохранённое</button><button type="button" class="design-clear" data-map="clear-sandbox">Очистить песочницу</button>';
    }
    const hButton=(key,label,disabled,path)=>`<button class="icon-btn history-btn" type="button" data-map="${key}" title="${label}" aria-label="${label}" ${disabled?'disabled':''}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg></button>`;
    $('#board-actions').innerHTML='<div class="history-tools">'+hButton('undo','Отменить действие',!history.undo.length,'M9 5 4 10l5 5 M4 10h9a6 6 0 0 1 6 6v2')+hButton('redo','Повторить действие',!history.redo.length,'m15 5 5 5-5 5 M20 10h-9a6 6 0 0 0-6 6v2')+'</div><button class="layout-toggle" data-map="layout" aria-expanded="'+(pop==='layout')+'">'+icon('settings',15)+'<span>Управление картой</span></button>';
    const legend=legendText[mode],open=v.legend??false;
    $('#camera-tools').innerHTML=`<div class="legend-box">${open?'<div class="legend-items">'+(legend.length?'<b class="legend-heading">Участники</b>':'')+legend.map(([k,s])=>'<span><i class="key '+k+'"></i>'+s+'</span>').join('')+'</div>'+edgeLegend(mode):''}<button data-map="legend" class="legend-switch" aria-expanded="${open}">${icon('layers',16)} Легенда</button></div><div class="zoom-box">${iconControl('out','minus','Уменьшить масштаб')}<output id="zoom-value"></output>${iconControl('in','plus','Увеличить масштаб')}<i></i>${iconControl('fit','fit','Показать всю карту')}</div>`;
    const assistant=mode==='scenario'?`<button class="eye-toggle" data-map="assistant" aria-label="${v.assistantEnabled?'Выключить':'Включить'} помощника" aria-pressed="${!!v.assistantEnabled}" title="Помощник Cursor"><img src="assets/eyes.webp" alt=""></button>${v.assistantEnabled?'<div class="compare-tabs" aria-label="Сравнение сценариев"><button data-map="before" aria-pressed="'+(v.comparison==='before')+'" title="Состояние сделки до изменений What if">Исходная карта</button><button data-map="after" aria-pressed="'+(v.comparison!=='before')+'" title="Изменения выбранного сценария и предложения помощника">Сценарий с советами</button></div>'+(!chatOpen?'<button class="chat-open" data-map="chat-open">Чат</button>':''):''}`:'';
    $('#board-assistant').innerHTML=(edgeEditing?'<button class="edge-mode-note" data-map="end-edge">'+(edgeStart?'Выберите второго участника':'Выберите стрелку или двух участников')+' · Готово</button>':'')+assistant+(mode==='scenario'&&removedCount?'<button class="chat-open" data-map="show-removed" aria-pressed="'+!!v.showRemoved+'">'+(v.showRemoved?'Скрыть исключённых':'Показать исключённых')+' · '+removedCount+'</button>':'');
  }
  function refresh(){
    buildGraph();drawInspector();drawControls();
    const space=usableSpace();
    if(v.cameraMode!=='manual'&&v.layoutMode!=='free'&&(layoutSpace.w!==space.w||layoutSpace.h!==space.h))arrange();
    adjustCamera();
    drawWorld();drawPopover();
  }
  function animate(element,frames,duration=155){
    if(!element?.animate||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return null;
    return element.animate(frames,{duration,easing:'ease-out'});
  }
  function animateScenario(){
    for(const selector of ['#world','.scenario-result'])animate($(selector),[{opacity:.55},{opacity:1}],180);
  }
  function toggleSection(button){
    const key=button.dataset.section, person=v.selected, old=v.sections[person]||[];
    const closing=old.includes(key), scroll=$('.inspect-scroll').scrollTop;
    v.sections[person]=closing?old.filter(k=>k!==key):[...old,key];save();
    function redraw(){
      drawInspector();$('.inspect-scroll').scrollTop=scroll;
      const current=$('#inspector').querySelector?.('[data-section="'+key+'"]');
      current?.focus?.({preventScroll:true});
      return current?.nextElementSibling;
    }
    if(closing){
      const content=button.nextElementSibling;
      button.setAttribute?.('aria-expanded','false');
      const transition=animate(content,[{height:content?.offsetHeight+'px',opacity:1},{height:'0px',opacity:0}]);
      if(transition){
        content.style.overflow='hidden';content.inert=true;
        transition.onfinish=()=>{if(button.isConnected&&v.selected===person&&!v.sections[person]?.includes(key))redraw()};
      }else redraw();
    }else{
      const content=redraw();
      if(content){
        const transition=animate(content,[{height:'0px',opacity:0},{height:content.offsetHeight+'px',opacity:1}]);
        if(transition){content.style.overflow='hidden';transition.onfinish=()=>content.style.removeProperty('overflow')}
      }
    }
  }
  function adjustCamera(){
    if(v.cameraMode!=='manual'||!v.camera)v.camera=frameBoard(model,usableSpace(),graph.edges,v.selected,v.cameraMode==='overview');
  }
  function manualCamera(){
    v.cameraMode='manual';v.layoutViewport=layoutSpace||usableSpace();
  }
  function centerTargets(ids,pairs){
    const boxes=ids.map(id=>model.nodes.get(id)).filter(n=>n&&!n.hidden);
    for(const [a,b] of pairs){
      const j=graph.edges.findIndex(e=>e.a===a&&e.b===b);
      const path=j>=0&&root.querySelector('[data-edge-index="'+j+'"] .connection-line');
      const rect=path&&path.getBBox?.();
      if(rect)boxes.push({x:rect.x,y:rect.y,w:rect.width,h:rect.height});
    }
    const camera=frameObjects(boxes,usableSpace(),v.camera?.z||1);
    if(!camera)return false;
    manualCamera();v.camera=camera;
    const world=$('#world');world.classList.add('focus-travel');clearTimeout(flyTimer);
    flyTimer=setTimeout(()=>world.classList.remove('focus-travel'),260);
    transform();return true;
  }
  function resetFinding(){hoverFinding=null;keyFinding=null;pinnedFinding=null}
  function selectedFinding(id){return mode==='scenario'&&chatOpen&&advice?.items.find(it=>it.id===id)}
  function paintFinding(){
    const item=selectedFinding(hoverFinding)||selectedFinding(keyFinding)||selectedFinding(pinnedFinding);
    const ids=new Set(item?.targets?.people||[]),pairs=new Set((item?.targets?.edges||[]).map(([a,b])=>pairKey({a,b})));
    for(const n of root.querySelectorAll('[data-node]'))n.classList.toggle('finding-node',ids.has(n.dataset.node));
    for(const el of root.querySelectorAll('[data-edge-index]')){
      const edge=graph.edges[Number(el.dataset.edgeIndex)];
      const exact=edge&&pairs.has(pairKey(edge));
      el.classList.toggle('finding-edge',!!exact);
      el.classList.toggle('finding-context-edge',!!edge&&!pairs.size&&(ids.has(edge.a)||ids.has(edge.b)));
    }
    for(const el of root.querySelectorAll('[data-finding]')){
      el.classList.toggle('finding-current',!!item&&el.dataset.finding===item.id);
      const pinned=el.dataset.finding===pinnedFinding;
      el.querySelector('[data-focus-finding]')?.setAttribute('aria-pressed',String(pinned));
      const location=el.querySelector('[data-finding-location]');
      if(location){
        location.hidden=!pinned;
        if(pinned){
          const targets=selectedFinding(pinnedFinding)?.targets;
          const names=(targets?.people||[]).map(id=>graph.people.find(p=>p.id===id)?.name).filter(Boolean);
          location.textContent=names.length?'На карте · '+names.join(', '):'Участники отсутствуют в этом варианте карты';
          if(targets?.edges.length&&!targets.edges.some(([a,b])=>graph.edges.some(e=>e.a===a&&e.b===b)))location.textContent+='. Связь отсутствует в этом варианте.';
        }
      }
    }
  }
  function focusFinding(id){
    const item=selectedFinding(id);if(!item?.targets?.people.length)return;
    const {people:ids,edges:pairs}=item.targets;
    const missing=ids.filter(id=>!scenarioLayer.people.some(p=>p.id===id));
    if(missing.length){
      const target=v.comparison==='before'?'after':'before';
      const other=scenarioFor({...v,comparison:target}).graph;
      const current=ids.length-missing.length;
      if(other.people.filter(p=>ids.includes(p.id)).length>current){
        v.comparison=target;refresh();notify(target==='before'?'Участник доступен на исходной карте':'Участник доступен в сценарии');
      }
    }
    hoverFinding=null;keyFinding=null;pinnedFinding=id;
    // An excluded participant can be inspected without changing the saved display preference.
    if(syncFindingVisibility())drawWorld();
    const visible=ids.filter(id=>model.nodes.has(id)&&!model.nodes.get(id).hidden);
    if(centerTargets(visible,pairs)){
      paintFinding();save();
      if(visible.length<ids.length)notify('Часть участников отсутствует в этом варианте карты');
    }else notify('Участник отсутствует в этом варианте карты');
  }
  function syncFindingVisibility(){
    if(!scenarioLayer||!removedCount)return false;
    const item=selectedFinding(hoverFinding)||selectedFinding(keyFinding)||selectedFinding(pinnedFinding);
    const wanted=new Set([...(item?.targets?.people||[]),ghostId]);
    const people=scenarioLayer.people.filter(p=>p.proposalAction!=='Убрать из сценария'||v.showRemoved||wanted.has(p.id));
    if(people.length===graph.people.length&&people.every((p,i)=>p.id===graph.people[i].id))return false;
    const shown=new Set(people.map(p=>p.id));
    graph={...scenarioLayer,people,edges:scenarioLayer.edges.filter(e=>shown.has(e.a)&&shown.has(e.b))};
    for(const n of model.nodes.values())n.hidden=!shown.has(n.p.id);
    return true;
  }
  function findingHover(e,on,keyboard){
    const row=e.target.closest?.('[data-finding]');
    if(!row||!selectedFinding(row.dataset.finding)||(!keyboard&&e.pointerType==='touch'))return;
    if(e.relatedTarget instanceof Node&&row.contains(e.relatedTarget))return;
    const id=on?row.dataset.finding:null;
    if(keyboard)keyFinding=id;else hoverFinding=id;
    if(syncFindingVisibility())drawWorld();else paintFinding();
  }
  function transform(){
    if(!v.camera)return;const {x,y,z}=v.camera;
    $('#world').style.transform=`translate(${x}px,${y}px) scale(${z})`;
    $('#zoom-value').textContent=Math.round(z*100)+'%';
    const surface=$('#surface');surface.style.backgroundPosition=`${x}px ${y}px`;
    surface.style.backgroundSize=`${Math.max(13,28*z)}px ${Math.max(13,28*z)}px`;
  }
  function fit(persist=true){
    v.cameraMode='overview';arrange();adjustCamera();drawWorld();if(persist)save();
  }
  function zoom(factor,point){
    const s=$('#surface'),c=v.camera;
    const px=point?.x??s.clientWidth/2,py=point?.y??s.clientHeight/2;
    manualCamera();
    const z=clamp(c.z*factor,Math.min(.22,frameBoard(model,usableSpace(),graph.edges,null,true).z),2.5);const ratio=z/c.z;v.camera={x:px-(px-c.x)*ratio,y:py-(py-c.y)*ratio,z};transform();save();
  }
  function reveal(pid){
    const n=model.nodes.get(pid);if(!n)return;
    const s=$('#surface'),c=v.camera,w=s.clientWidth,h=s.clientHeight;
    if(n.x*c.z+c.x<0||(n.x+n.w)*c.z+c.x>w||n.y*c.z+c.y<0||(n.y+n.h)*c.z+c.y>h){
      c.x=w/2-(n.x+n.w/2)*c.z;c.y=(h-42)/2-(n.y+n.h/2)*c.z;transform();
    }
  }
  function updateRecord(label='Изменение участника'){
    const patch=recordDiff(savedRecord,record);
    record=applyRecordDiff(dealRecord(id),patch);saveRecord(record);
    savedRecord=structuredClone(record);remember(history,{mode,label,patch});refresh();save();
  }
  function saveObservation(change){
    const latest=dealRecord(id);
    const person=latest?.people.find(p=>p.id===change.personId);
    const before=structuredClone(latest);
    applyObservation(person,change);
    savedRecord=before;record=latest;
    updateRecord(change.label);
  }
  function removePerson(){
    const person=graph.people.find(p=>p.id===v.selected);if(!person)return;
    const simulated=mode==='scenario';
    const body='<p>'+esc(person.name)+(simulated?' и связанные стрелки будут убраны из этого сценария.':' и связанные стрелки будут удалены из всех режимов сделки.')+'</p><form class="edit-form confirm-delete">'+submit('Удалить участника')+'</form>';
    modal('Удалить участника?',body,()=>{
      v.selected=null;ghostId=null;
      if(simulated)editView('Удаление участника сценария',()=>branchFor(v).removed.push(person.id));
      else{record.people=record.people.filter(p=>p.id!==person.id);record.edges=record.edges.filter(e=>e.a!==person.id&&e.b!==person.id);updateRecord('Удаление участника')}
    });
  }
  function edit(p,focusField){
    const dialog=editParticipant(record,p,mode,(person,edge)=>{
      const i=record.people.findIndex(x=>x.id===person.id);
      if(i>=0){
        // A profile form may remain open while another tab adds an observation.
        for(const key of ['managerOpinions','discAssessments']){
          if(record.people[i][key])person[key]=record.people[i][key];else delete person[key];
        }
        record.people[i]=person;
      }else record.people.push(person);
      if(edge)record.edges.push(edge);
      v.selected=person.id;v.collapsed=(v.collapsed||[]).filter(n=>n!==person.dept);
      if(i<0){v.query='';v.filters={};v.camera=null}
      updateRecord();reveal(person.id);save();notify('Участник сохранён');
    });
    if(focusField)dialog.querySelector('form').elements.namedItem(focusField)?.focus();
  }
  function filterContent(){
    const f=v.filters||{},all=[['','Все']];
    let fields='';
    if(mode==='org')fields+=select('Подразделение','dept',[...all,...new Set(record.people.map(p=>p.dept).filter(Boolean))],f.dept)+select('Уровень иерархии','level',[...all,...new Set(record.people.map(p=>p.level).filter(Boolean))],f.level)+select('Участие в сделке','state',[...all,...Object.entries(states)],f.state);
    else fields+=select('Этап закупки','stage',[...all,...stages],f.stage);
    if(mode==='process')fields+=`<label class="checkline"><input type="checkbox" name="highlight" ${v.highlight?'checked':''}>Выделить ЛПР</label>`;
    return `<form class="pop-form" id="map-filters">${fields}<div class="pop-footer"><button type="button" class="text-act" data-map="clear-filters">Сбросить</button>${submit('Применить')}</div></form>`;
  }
  function departmentDetails(edge){
    const pair=mode==='org'&&departmentPair(edge,model);
    if(!pair)return null;
    const links=[];
    graph.edges.forEach((candidate,index)=>{
      const other=departmentPair(candidate,model);
      if(other?.from===pair.from&&other.to===pair.to)links.push({edge:candidate,index});
    });
    return {...pair,links};
  }
  function edgeCard(edge,preview,details=departmentDetails(edge)){
    return details?departmentRelationCard(details,model,preview):relationCard(edge,mode,graph.people,preview,advice?.items);
  }
  function drawPopover(){
    const trigger=$('[data-map="unknown"]');
    if(trigger){trigger.setAttribute('aria-expanded',String(pop==='unknown'));trigger.removeAttribute('aria-pressed')}
    if(pop)clearPreview();
    const el=$('#map-pop');el.innerHTML='';el.style.left='';el.style.top='';el.style.maxWidth='';el.style.maxHeight='';if(!pop)return;
    if(pop==='edge'){
      const item=graph.edges[edgeIndex];if(!item)return;
      el.innerHTML=edgeCard(item,false);
      const change=differences.find(d=>d.edge===edgeId(item));
      if(change)el.querySelector('.relation-pop').insertAdjacentHTML('beforeend','<details class="person-differences"><summary>Изменилось в сделке</summary>'+changeDetails([change])+'</details>');
      if(edgePoint)placeAtEdge(el,edgePoint)
      return;
    }
    if(pop==='layout'){
      const row=(key,title,detail,chosen)=>`<button class="layout-row" data-map="${key}" aria-pressed="${chosen}"><span><b>${title}</b><small>${detail}</small></span><i>${chosen?'✓':''}</i></button>`;
      el.innerHTML='<section class="map-popover layout-pop"><div class="pop-head"><h2>Управление картой</h2>'+iconControl('close-pop','close','Закрыть')+'</div>'+row('auto','Упорядочить карту','Автоматическая раскладка и вписывание в экран',v.layoutMode==='auto')+row('free','Свободное расположение',mode==='org'?'Перетаскивать отделы за заголовок и менять порядок карточек внутри':'Перемещать карточки вручную',v.layoutMode==='free')+row('edge-edit','Редактирование связей','Добавить, перенаправить или удалить стрелку',edgeEditing)+'</section>';return;
    }

    if(pop==='results'){
      el.innerHTML='<section class="map-popover results-pop" aria-label="Результаты поиска"><div class="pop-head"><h2>Результаты поиска</h2>'+iconControl('close-pop','close','Закрыть результаты')+'</div>'+resultList(hits,v.query,mode,modes)+'</section>';return;
    }
    const title=pop==='filters'?'Фильтры':'Чего не знаем';
    el.innerHTML=`<div class="map-popover" role="region" aria-label="${title}"><div class="pop-head"><h2>${title}</h2>${iconControl('close-pop','close','Закрыть')}</div>${pop==='filters'?filterContent():gapList()}</div>`;
  }
  function gapList(){
    const {entries,deal}=knowledgeGaps(record);
    if(!entries.length&&!deal.length)return '<p>Все ключевые сведения заполнены.</p>';
    const rows=entries.map(g=>`<button type="button" data-gap-person="${esc(g.personId)}" data-gap-section="${g.section}" data-gap-field="${g.field||''}" data-gap-agreement="${g.index??''}"><strong>${esc(g.name)}</strong><span>${esc(g.question)}</span></button>`);
    for(const gap of deal){
      if(gap.field==='budget'){
        rows.push('<button type="button" data-map="gap-budget"><strong>Сделка</strong><span>'+esc(gap.question)+'</span></button>');
      }else{
        const candidates=graph.people.map(p=>`<button type="button" data-gap-person="${esc(p.id)}" data-gap-section="${gap.field==='decision'?'role':'relations'}" data-gap-field="${gap.field}">${esc(p.name)}</button>`).join('');
        rows.push('<details><summary>'+esc(gap.question)+'</summary>'+candidates+'<button type="button" data-action="add-person" data-gap-new="'+gap.field+'">Добавить участника</button></details>');
      }
    }
    return '<div class="hit-list gap-list">'+rows.join('')+'</div>';
  }
  function openGap(row){
    const {gapPerson:pid,gapSection:key,gapField:field,gapAgreement:index}=row.dataset;
    if(!graph.people.some(p=>p.id===pid))return;
    edgeEditing=false;edgeStart=null;
    v.sections??={};
    v.sections[pid]=[...new Set([...(v.sections[pid]||[]),key])];
    pick(pid);
    centerTargets([pid],[]);save();
    const section=$('#inspector [data-section="'+key+'"]')?.closest('section');
    if(!section)return;
    let target=section.querySelector('.section-toggle');
    if(index!==undefined&&index!==''){
      target=section.querySelector('[data-agreement-index="'+index+'"] button')||target;
    }else if(field){
      const action=document.createElement('button');
      action.type='button';action.className='text-act';action.dataset.gapEdit=field;
      action.textContent=['decision','primary'].includes(field)?'Указать роль участника':'Заполнить поле';
      section.querySelector('.section-inner').append(action);
      target=action;
    }
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'nearest'});
  }
  function resetFilters(){v.query='';v.filters={};v.highlight=false;pop='';mount();save()}
  function changeZoom(key){if(key==='fit')fit();else zoom(key==='in'?1.2:1/1.2)}
  function changeEdge(old=null,from=null,to=null){
    if(graph.people.length<2){notify('Для связи нужны два участника');return}
    const capturedMode=mode;
    const saveEdge=next=>{
      pop='';edgeStart=null;edgeIndex=-1;
      if(capturedMode==='scenario'){
        const overlay=!!(old?.assistant||[old?.a,old?.b,next?.a,next?.b].some(id=>graph.people.some(p=>p.ai&&p.id===id)));
        editView(next?'Изменение связи сценария':'Удаление связи сценария',()=>branchFor(v).edits.push({old:old?pairKey(old):null,next,overlay}));
      }else{
        if(old)record.edges=record.edges.filter(e=>edgeId(e)!==edgeId(old));
        if(next)record.edges.push(next);
        updateRecord(next?'Изменение связи':'Удаление связи');
      }
    };
    editRelation({mode,people:graph.people,edges:graph.edges,old,from,to,endpoints:edgeEditing||mode==='org',onSave:saveEdge,onRemove:()=>saveEdge(null)});
  }
  function selectEdge(index,event){
    if(!graph.edges[index])return;
    if(edgeEditing&&(departmentDetails(graph.edges[index])?.links.length??1)===1){changeEdge(graph.edges[index]);return}
    clearPreview();edgeIndex=index;edgePoint=null;
    if(Number.isFinite(event?.clientX)&&event.detail!==0){
      const r=$('.map-content').getBoundingClientRect();edgePoint={x:event.clientX-r.left,y:event.clientY-r.top};
    }
    if(!edgePoint)edgePoint=edgeAnchor(root.querySelector('[data-edge-index="'+index+'"]'),event);
    pop='edge';drawPopover();
  }
  function sourceDetail(i,j){
    const source=advice?.items[i]?.sources[j];if(!source)return;
    const exists=source.personId&&graph.people.some(p=>p.id===source.personId);
    const participant=graph.people.find(p=>p.id===source.personId);
    const agreement=source.agreement&&participant?participant.agreements.findIndex(a=>a.title===source.agreement.title&&(a.date||'')===source.agreement.date):-1;
    const edgeIndex=source.edge&&v.comparison!=='before'?graph.edges.findIndex(e=>e.a===source.edge[0]&&e.b===source.edge[1]):-1;
    const dialog=modal(source.label,'<div class="source-detail">'+sourceText(source.detail,record).split(/\n+/).filter(Boolean).map(line=>'<p>'+esc(line)+'</p>').join('')+(agreement>=0?'<button class="btn secondary" data-evidence-agreement>Открыть договорённость</button>':'')+(exists?'<button class="btn secondary" data-evidence-person>Открыть участника</button>':'')+(edgeIndex>=0?'<button class="btn secondary" data-evidence-edge>Открыть связь</button>':'')+'</div>');
    dialog.querySelector('[data-evidence-agreement]')?.addEventListener('click',()=>{dialog.close();v.sections[source.personId]=[...new Set([...(v.sections[source.personId]||[]),'agreements'])];pick(source.personId);const row=root.querySelector('[data-agreement-index="'+agreement+'"]');row?.scrollIntoView?.({block:'nearest'});row?.focus()});
    dialog.querySelector('[data-evidence-person]')?.addEventListener('click',()=>{dialog.close();pick(source.personId)});
    dialog.querySelector('[data-evidence-edge]')?.addEventListener('click',()=>{dialog.close();edgeEditing=false;edgeStart=null;pick(source.edge[1]);selectEdge(edgeIndex)});
  }
  function applySimulation(kind,values={}){
    if(mode!=='scenario'||v.assistantEnabled&&v.comparison==='before'||!graph.people.some(p=>p.id===v.selected))return;
    const event={id:crypto.randomUUID(),personId:v.selected,kind,...values};
    editView('Действие в сценарии',()=>setEventList(v,[...eventList(v),event]));
  }
  function expandHits(person){
    const keys=hits.filter(h=>h.pid===person&&h.mode===mode&&h.key).map(h=>h.key);
    v.sections??={};v.sections[person]=[...new Set([...(v.sections[person]||[]),...keys])];
  }
  function scrollHit(hit){
    const panel=$('#inspector');
    const section=hit.key?panel.querySelector('[data-section="'+hit.key+'"]')?.closest('section'):panel;
    const node=section?.querySelector('.section-inner mark')||section?.querySelector('mark')||section;
    if(node!==panel)node?.scrollIntoView?.({block:'nearest'});
  }
  function openHit(hit){
    if(!hit)return;
    if(hit.mode!==mode){
      const query=v.query;selectMode(hit.mode,hit.pid,true);v.query=query;$('#map-search').value=query;buildGraph();
    }
    pick(hit.pid);scrollHit(hit);
  }
  function searchInput(value){
    v.query=value;buildGraph();
    pop=terms(value).length?'results':'';
    if(matchedIds.size===1&&hits[0].mode===mode){
      v.selected=hits[0].pid;expandHits(v.selected);
    }else if(v.selected)expandHits(v.selected);
    drawInspector();drawWorld();drawPopover();
    if(matchedIds.size===1&&hits[0].mode===mode){reveal(v.selected);scrollHit(hits[0])}
    save();
  }

  function pick(pid){
    resetFinding();
    chatOpen=false;ghostId=pid;v.selected=pid;v.sections??={};if(mode==='org'&&!v.sections[pid])v.sections[pid]=['formal'];
    expandHits(pid);pop='';refresh();reveal(pid);save();
  }
  root.addEventListener('click',e=>{
    if(suppressClick){suppressClick=false;e.preventDefault();return}
    const link=e.target.closest('[data-source-item]');if(link){e.preventDefault();sourceDetail(Number(link.dataset.sourceItem),Number(link.dataset.sourceIndex));return}
    const finding=e.target.closest('[data-finding]');
    if(finding&&!e.target.closest('select,label,details,summary,a')){focusFinding(finding.dataset.finding);return}
    const line=e.target.closest('[data-edge-index]');if(line){selectEdge(Number(line.dataset.edgeIndex),e);return}
    const b=e.target.closest('button');
    if(!b){if(pop&&e.target.id!=='map-search'&&!e.target.closest('#map-pop')){pop='';drawPopover()}return}
    if(b.disabled)return;
    if(b.dataset.orgEdgeEdit!==undefined){
      const edge=graph.edges[Number(b.dataset.orgEdgeEdit)];
      if(mode==='org'&&edge)changeEdge(edge);
      return;
    }
    if(mode==='scenario'&&chatOpen&&['risk','hypothesis','advice'].includes(b.dataset.insightKind)){
      const draft=$('#proposal-input').value;
      drafts.set(draftKey(),draft);resetFinding();if(syncFindingVisibility())drawWorld();
      insightKind=b.dataset.insightKind;drawInspector();
      $('#proposal-input').value=draft;
      $('[data-insight-kind="'+insightKind+'"]')?.focus();
      return;
    }
    if(b.dataset.chatResult&&selectedFinding(b.dataset.chatResult)){
      insightKind='hypothesis';resetFinding();drawInspector();
      const row=[...root.querySelectorAll('#scenario-findings [data-focus-finding]')].find(el=>el.dataset.focusFinding===b.dataset.chatResult);
      row?.scrollIntoView?.({block:'nearest'});row?.focus();return;
    }
    if(b.dataset.mapLearning && training){
      const action=b.dataset.mapLearning;
      if(action==='toggle')learningCollapsed=!learningCollapsed;
      else {
        const previous=training;
        training=nextMapLearning(training,record,action==='skip');
        if(!training)notify('Обучение завершено. Карта сохранена.');
        if(previous!==training){edgeEditing=false;edgeStart=null;v.selected=null;pop='';refresh();save();$('#map-learning [data-map-learning=toggle]')?.focus();return}
      }
      drawLearning();return;
    }
    if(b.hasAttribute('data-gap-person')){openGap(b);return}
    if(b.dataset.gapEdit){edit(record.people.find(p=>p.id===v.selected),b.dataset.gapEdit);return}
    if(b.dataset.map==='gap-budget'){go('settings/'+id+'/budget');return}
    if(b.dataset.jump){selectMode(b.dataset.jump,v.selected);return}
    if(b.dataset.hit!==undefined){openHit(hits[Number(b.dataset.hit)]);return}
    if(mode==='scenario'&&b.dataset.sim){applySimulation(b.dataset.sim);return}
    if(mode==='scenario'&&b.dataset.undo){editView('Отмена события сценария',()=>setEventList(v,eventList(v).filter(ev=>ev.id!==b.dataset.undo)));return}
    if(b.dataset.mode){selectMode(b.dataset.mode);return}
    if(b.dataset.node){
      const pid=b.dataset.node;
      if(edgeEditing){if(!edgeStart){edgeStart=pid;v.selected=pid;refresh();return}if(edgeStart!==pid)changeEdge(null,edgeStart,pid);return}
      pick(pid);return
    }
    if(b.hasAttribute('data-collapse')){const k=b.dataset.collapse;v.collapsed=(v.collapsed||[]).includes(k)?v.collapsed.filter(x=>x!==k):[...(v.collapsed||[]),k];refresh();save();return}
    if(b.dataset.section){toggleSection(b);return}
    if(b.dataset.action==='add-person'){edit(null,b.dataset.gapNew);return}
    if(mode==='process'&&b.dataset.observation){
      const p=record.people.find(person=>person.id===v.selected);
      if(p)openObservation(b.dataset.observation,b.dataset.entry,p,saveObservation);
      return;
    }
    const pa=b.dataset.panelAction;
    if(pa==='remove'){removePerson();return}
    if(pa){const p=record.people.find(x=>x.id===v.selected);if(!p)return;
      if(pa==='edit')edit(p);else if(pa==='to-org'||pa==='to-process')selectMode(pa.slice(3),p.id);else handlePanel(pa,p,updateRecord);return}
    const key=b.dataset.map;if(!key)return;
    if(mode==='scenario'&&['save-design','clear-sandbox','saved-designs','design-diff'].includes(key)){designAction(key);return}
    if(['in','out','fit'].includes(key)){changeZoom(key);return}
    if(key==='results'){pop='results';drawPopover();return}
    if(key==='clear-search'){$('#map-search').value='';searchInput('');$('#map-search').focus();return}
    if(key==='undo'||key==='redo'){replay(key==='undo');return}
    if(key==='layout'){pop=pop==='layout'?'':'layout';drawPopover();drawControls();transform();return}
    if(key==='auto'||key==='free'){
      pop='';edgeEditing=false;edgeStart=null;
      if(key==='free'){v.layoutViewport=layoutSpace;v.layoutMode='free';refresh();save();return}
      if(!Object.keys(v.positions).length&&!Object.keys(v.orgGroups||{}).length){v.layoutMode='auto';v.cameraMode='overview';refresh();save();return}
      editView(key==='auto'?'Автоматическая раскладка':'Свободное расположение',()=>{v.layoutMode=key;if(key==='auto'){v.positions={};delete v.orgGroups;v.camera=null}});
      if(key==='auto')fit();return
    }
    if(key==='edge-edit'||key==='end-edge'){if(key==='edge-edit'&&mode==='scenario'&&v.assistantEnabled)v.comparison='after';edgeEditing=key==='edge-edit'&&!edgeEditing;edgeStart=null;pop='';refresh();return}
    if(key==='edit-edge'){
      const e=graph.edges[edgeIndex];
      if(mode==='scenario'&&v.assistantEnabled&&v.comparison==='before'){
        v.comparison='after';pop='';refresh();save();
        const current=graph.edges.find(link=>pairKey(link)===pairKey(e));
        if(current)changeEdge(current);else notify('В этом сценарии связь отсутствует');
      }else changeEdge(e);
      return;
    }
    if(key==='assistant'){
      resetFinding();
      v.assistantEnabled=!v.assistantEnabled;chatOpen=v.assistantEnabled;v.comparison='after';pop='';refresh();save();return
    }
    if(key==='show-removed'){v.showRemoved=!v.showRemoved;ghostId=null;refresh();save();return}
    if(key==='chat-open'||key==='close-chat'){resetFinding();chatOpen=key==='chat-open';refresh();save();return}
    if(key==='before'||key==='after'){if(v.comparison===key)return;resetFinding();v.comparison=key;pop='';refresh();animateScenario();save();return}
    if(key==='legend'){v.legend=!(v.legend??false);drawControls();transform();save();return}
    if(key==='clear-filters'){resetFilters();return}
    if(key==='filters'||key==='unknown'){pop=pop===key?'':key;drawPopover();return}
    if(key==='close-pop'){pop='';drawPopover();return}
    if(key==='close-person'){v.selected=null;refresh();save();return}
    if(key==='risks'){v.risks=!v.risks;$('#tools').innerHTML=toolBar(mode,v);drawWorld();save()}
  },{signal});
  root.addEventListener('submit',e=>{
    if(e.target.id==='chat-form'){
      e.preventDefault();const message=e.target.elements.message.value.trim();
      if(!message||!v.assistantEnabled||mode!=='scenario')return;
      const branch=branchFor(v);
      if(branch.messages.some(m=>m.ai&&m.status==='pending'))return;
      const activeRecord=findDesign(v)?.baseline||record;
      const base=scenarioBoard(activeRecord,{...v,assistantEnabled:false}).graph;
      v.comparison='after';ghostId=null;
      drafts.delete(draftKey());resetFinding();
      const question={id:crypto.randomUUID(),personId:v.selected,text:message,ai:true,status:'pending'};
      editView('Предложение в чате',()=>branch.messages.push(question));
      const log=$('.chat-log');log.scrollTop=log.scrollHeight;
      askGroq({record:structuredClone(activeRecord),graph:structuredClone(base),scenario:{name:v.scenario||'base',label:scenarios[v.scenario]?.[0]||'Свой сценарий',events:eventList(v)},branch,message:question,signal,
        onChange:()=>{
          chatResponses.set(question.id,structuredClone(question));syncChatResponses();
          save();if(signal.aborted)return;
          if(mode==='scenario'){refresh();const log=$('.chat-log');if(log)log.scrollTop=log.scrollHeight;}
        }});
      $('#proposal-input')?.focus();save();return;
    }
    const kind=e.target.dataset?.simForm;
    if(mode==='scenario'&&['worse','contract'].includes(kind)){
      e.preventDefault();if(!valid(e.target))return;
      const values=Object.fromEntries([...new FormData(e.target)].map(([k,val])=>[k,val.trim()]));
      applySimulation(kind,values);return;
    }
    if(e.target.id!=='map-filters')return;e.preventDefault();const {highlight,...filters}=Object.fromEntries(new FormData(e.target));v.filters=filters;v.highlight=!!highlight;pop='';mount();save();
  },{signal});
  window.addEventListener('storage',e=>{
    if(e.key&&e.key!=='cursor.demo.record.v2.'+id&&!e.key.startsWith('cursor.what-if.design.v1.'+encodeURIComponent(id)+'.'))return;
    record=dealRecord(id);savedRecord=structuredClone(record);designs=loadDesigns(id);refresh();
  },{signal});
  root.addEventListener('input',e=>{if(e.target.id==='map-search')searchInput(e.target.value);if(e.target.id==='proposal-input')drafts.set(draftKey(),e.target.value)},{signal});
  root.addEventListener('change',e=>{
    if(e.target.id==='scenario'){resetFinding();v.scenario=e.target.value;v.comparison='after';v.showRemoved=false;v.selected=null;v.camera=null;edgeEditing=false;edgeStart=null;edgeIndex=-1;pop='';ghostId=null;refresh();animateScenario();save()}
    const id=e.target.dataset?.reviewFinding;
    if(id&&selectedFinding(id)?.kind==='hypothesis'&&['','confirmed','rejected'].includes(e.target.value)){
      const value=e.target.value,scroll=$('.chat-log').scrollTop;
      editView('Статус гипотезы',()=>{const branch=branchFor(v);branch.reviews??={};if(value)branch.reviews[id]={value,basis:selectedFinding(id).reviewBasis};else delete branch.reviews[id]});
      $('.chat-log').scrollTop=scroll;
      [...root.querySelectorAll('[data-review-finding]')].find(el=>el.dataset.reviewFinding===id)?.focus();
    }
  },{signal});
  root.addEventListener('wheel',e=>{
    const s=e.target.closest('#surface');if(!s)return;e.preventDefault();const r=s.getBoundingClientRect();
    zoom(Math.exp(clamp(-e.deltaY*.0015,-.35,.35)),{x:e.clientX-r.left,y:e.clientY-r.top});
  },{signal,passive:false});
  root.addEventListener('pointerdown',e=>{
    const surface=e.target.closest('#surface');
    if(!surface||!e.isPrimary||e.button!==0||e.target.closest('#empty-map button,[data-edge-index]'))return;
    const pid=e.target.closest('[data-node]')?.dataset.node;
    const groupKey=e.target.closest('[data-org-group]')?.dataset.orgGroup;
    if((pid||groupKey)&&(v.layoutMode!=='free'||edgeEditing))return;
    const node=pid?model.nodes.get(pid):null;
    const group=groupKey?model.groups.find(g=>g.key===groupKey):node?.group;
    if(pid&&mode==='org'&&group.members.length<2)return;
    const origin=node||group||v.camera;
    const drag={before:pid||groupKey?viewEdit(v):null,id:e.pointerId,x:e.clientX,y:e.clientY,pid,groupKey,start:{x:origin.x,y:origin.y},moved:false};
    if(pid&&mode==='org'){
      const [first,second]=group.members;
      const top=model.nodes.get(first).y;
      const index=group.members.indexOf(pid);
      drag.reorder={key:group.key,members:group.members,top,pitch:model.nodes.get(second).y-top,index,slot:index,
        originalOrder:v.orgGroups?.[group.key]?.order};
    }
    transient=drag;
  },{signal});
  root.addEventListener('pointermove',e=>{
    const t=transient;if(!t||e.pointerId!==t.id)return;
    const dx=e.clientX-t.x,dy=e.clientY-t.y;if(!t.moved&&Math.hypot(dx,dy)<5)return;
    if(!t.moved){manualCamera();$('#surface').setPointerCapture(e.pointerId);t.moved=true;$('#surface').classList.add('dragging')}
    if(!t.before){v.camera.x=t.start.x+dx;v.camera.y=t.start.y+dy;transform();return}
    const point={x:t.start.x+dx/v.camera.z,y:t.start.y+dy/v.camera.z};
    if(t.reorder){
      const {key,members,top,pitch,index,originalOrder}=t.reorder;
      const slot=clamp(Math.round((point.y-top)/pitch),0,members.length-1);
      if(slot===t.reorder.slot)return;
      t.reorder.slot=slot;
      v.orgGroups??={};
      const saved={...v.orgGroups[key]};
      if(slot===index){
        if(originalOrder)saved.order=originalOrder;
        else delete saved.order;
      }else{
        const order=members.filter(id=>id!==t.pid);
        order.splice(slot,0,t.pid);
        saved.order=order;
      }
      if(Object.keys(saved).length)v.orgGroups[key]=saved;
      else delete v.orgGroups[key];
    }else if(t.groupKey){
      v.orgGroups??={};
      v.orgGroups[t.groupKey]={...v.orgGroups[t.groupKey],...point};
    }else v.positions[t.pid]=point;
    if(typeof requestAnimationFrame!=='function'){arrange();drawWorld()}
    else if(!dragFrame)dragFrame=requestAnimationFrame(()=>{dragFrame=0;arrange();drawWorld()});
  },{signal});
  function endDrag(e){
    if(!transient||e.pointerId!==transient.id)return;
    if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0;arrange();drawWorld()}
    if(transient.moved){
      suppressClick=true;setTimeout(()=>suppressClick=false,0);$('#surface')?.classList.remove('dragging');
      if(transient.before){
        remember(history,{mode,label:transient.groupKey?'Перемещение отдела':transient.reorder?'Порядок участников в отделе':'Перемещение участника',before:transient.before,after:viewEdit(v)});
        drawControls();transform();
      }
      save();
    }
    transient=null;
  }
  window.addEventListener('pointerup',endDrag,{signal});window.addEventListener('pointercancel',endDrag,{signal});
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'&&(pinnedFinding||keyFinding||hoverFinding)&&!pop){
      resetFinding();if(syncFindingVisibility())drawWorld();else paintFinding();return;
    }
    const edge=e.target.closest?.('[data-edge-index]');
    if(edge&&['Enter',' '].includes(e.key)){e.preventDefault();selectEdge(Number(edge.dataset.edgeIndex),e);return}
    if((e.ctrlKey||e.metaKey)&&!e.target.closest?.('input,textarea,select,[contenteditable="true"]')){
      const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();replay(key==='z'&&!e.shiftKey);return}
    }
    if(e.target.id==='map-search'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();openHit(hits[0]);return}
    if(e.target.id==='map-search'&&e.key==='ArrowDown'&&hits.length){
      e.preventDefault();pop='results';drawPopover();$('#map-pop [data-hit]')?.focus();return;
    }
    if(e.target.dataset?.hit!==undefined&&['ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const next=Number(e.target.dataset.hit)+(e.key==='ArrowDown'?1:-1);
      if(next<0)$('#map-search').focus();else $('#map-pop [data-hit="'+Math.min(next,hits.length-1)+'"]')?.focus();return;
    }
    if(e.key==='Escape'){if(previewEdge){clearPreview()}else if(pop){pop='';drawPopover()}else if(v.selected){v.selected=null;refresh();save()}return}
    if(e.target!==$('#surface'))return;
    const dirs={ArrowUp:[0,45],ArrowDown:[0,-45],ArrowLeft:[45,0],ArrowRight:[-45,0]};
    if(dirs[e.key]){e.preventDefault();manualCamera();v.camera.x+=dirs[e.key][0];v.camera.y+=dirs[e.key][1];transform();save()}
    if(e.key==='+'||e.key==='=')zoom(1.2);if(e.key==='-')zoom(1/1.2);
  },{signal});
  function markEnds(edge,active,departments){
    if(departments){
      for(const frame of root.querySelectorAll('.dept-frame[data-org-group]')){
        if(frame.dataset.orgGroup===departments.from.key||frame.dataset.orgGroup===departments.to.key)frame.classList.toggle('edge-endpoint',active);
      }
      return;
    }
    for(const node of root.querySelectorAll('[data-node]'))if(node.dataset.node===edge.a||node.dataset.node===edge.b)node.classList.toggle('edge-endpoint',active);
    for(const group of root.querySelectorAll('[data-collapse]'))if([edge.a,edge.b].some(id=>model.nodes.get(id)?.hidden&&model.nodes.get(id)?.group.name===group.dataset.collapse))group.classList.toggle('edge-endpoint',active);
  }
  function clearPreview(){
    clearTimeout(previewTimer);clearTimeout(hideTimer);
    if(!previewEdge)return;
    markEnds(previewEdge.edge,false,previewEdge.departments);
    previewEdge.el.removeAttribute?.('aria-describedby');previewEdge.el.classList.remove('edge-hover');
    const tip=$('#edge-preview');if(tip){tip.hidden=true;tip.innerHTML=''}
    previewEdge=null;
  }
  function edgeAnchor(el,event){
    const box=$('.map-content').getBoundingClientRect();
    if(Number.isFinite(event?.clientX)&&event?.type!=='focusin'&&event?.type!=='keydown'&&(event?.type!=='click'||event.detail!==0))return {x:event.clientX-box.left,y:event.clientY-box.top};
    const path=el?.querySelector('.connection-line');
    if(path?.getTotalLength){
      const matrix=path.getScreenCTM();
      if(matrix){const point=path.getPointAtLength(path.getTotalLength()/2).matrixTransform(matrix);return {x:point.x-box.left,y:point.y-box.top}}
    }
    const bounds=el?.getBoundingClientRect();
    return {x:bounds?(bounds.left+(bounds.width||0)/2-box.left):16,y:bounds?(bounds.top+(bounds.height||0)/2-box.top):16};
  }
  function placeAtEdge(el,point){
    const surface=$('#surface'),w=surface.clientWidth,h=surface.clientHeight;
    el.style.maxWidth=Math.max(1,w-16)+'px';el.style.maxHeight=Math.max(1,h-16)+'px';
    const width=el.offsetWidth||Math.min(w-16,320),height=el.offsetHeight||160;
    const x=point.x+width+14<=w?point.x+10:point.x-width-10;
    const y=point.y+height+14<=h?point.y+8:point.y-height-8;
    el.style.left=clamp(x,8,Math.max(8,w-width-8))+'px';el.style.top=clamp(y,8,Math.max(8,h-height-8))+'px';
  }
  function edgeHover(event,active){
    if(event.pointerType==='touch'||transient||edgeEditing||pop)return;
    if(event.target.closest?.('#edge-preview')){
      clearTimeout(hideTimer);if(!active&&!event.target.closest('#edge-preview').contains(event.relatedTarget))hideTimer=setTimeout(clearPreview,190);
      return;
    }
    const el=event.target.closest?.('[data-edge-index]');
    if(!el||(event.relatedTarget instanceof Node&&el.contains(event.relatedTarget)))return;
    if(!active){
      if(previewEdge?.el===el){clearTimeout(previewTimer);hideTimer=setTimeout(clearPreview,190)}
      return;
    }
    const edge=graph.edges[Number(el.dataset.edgeIndex)];if(!edge)return;
    const departments=departmentDetails(edge);
    clearPreview();previewEdge={el,edge,departments};markEnds(edge,true,departments);el.classList.add('edge-hover');
    const point=edgeAnchor(el,event);
    previewTimer=setTimeout(()=>{
      if(previewEdge?.el!==el||signal.aborted)return;
      const tip=$('#edge-preview');tip.innerHTML=edgeCard(edge,true,departments);tip.hidden=false;
      el.setAttribute('aria-describedby','edge-preview');placeAtEdge(tip,point);
    },event.type==='focusin'?0:160);
  }
  for(const type of ['pointerover','focusin'])root.addEventListener(type,e=>{findingHover(e,true,type==='focusin');edgeHover(e,true)},{signal});
  for(const type of ['pointerout','focusout'])root.addEventListener(type,e=>{findingHover(e,false,type==='focusout');edgeHover(e,false)},{signal});
  signal?.addEventListener('abort',()=>{observer?.disconnect();clearTimeout(flyTimer);if(dragFrame)cancelAnimationFrame(dragFrame);clearPreview()},{once:true});
  selectMode(mode);
  if(search?.hit){
    selectMode(search.hit.mode,search.hit.pid,true);
    v.query=search.query;$('#map-search').value=v.query;buildGraph();openHit(search.hit);
  }
}

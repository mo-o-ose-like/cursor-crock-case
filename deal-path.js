import {esc,icon} from './components.js';
import {field,area,select,modal,submit,notify,valid} from './fields.js';
import {deals,allDeals,dealRecord,saveRecord} from './data.js';
import {eventsFor,comparison,comparisonZones,observations,slots,statusNames,effects,aspects} from './path-data.js';

function stamp(date){
  if(!date)return 'Дата не указана';
  const parsed=new Date(date+'T12:00:00');
  if(Number.isNaN(parsed.getTime()))return String(date);
  return new Intl.DateTimeFormat('ru',{day:'numeric',month:'short',year:'numeric'}).format(parsed);
}
const initials=p=>p.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('');
const attr=(k,v)=>' data-'+k+'="'+esc(v)+'"';
const btn=(act,text,cls='path-text',extra='')=>'<button type="button" class="'+cls+'"'+attr('path',act)+extra+'>'+text+'</button>';
const small=(text)=>'<small>'+esc(text)+'</small>';
const facts=rows=>'<dl class="path-facts">'+rows.filter(([,v])=>v).map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
const effectIcons={same:'minus',positive:'check',risk:'warning',unknown:'help',insufficient:'info'};
function personBtn(person,owner,compact=false,selected=false){
  if(!person)return '';
  const hint=[person.name,person.title].filter(Boolean).join(' · ');
  return btn('person',compact?esc(initials(person)):'<strong>'+esc(person.name)+'</strong>'+small(person.title||''),
    compact?'path-avatar':'path-person',attr('owner',owner)+attr('person',person.id)+' title="'+esc(hint)+'" aria-label="'+esc(hint)+'" aria-pressed="'+selected+'"');
}
function tool(action,glyph,label,style='tool',extra=''){
  return btn(action,icon(glyph,16)+'<span>'+esc(label)+'</span>',style,extra);
}
function legend(){
  const row=(symbol,label)=>'<li>'+symbol+'<span>'+esc(label)+'</span></li>';
  return '<h3>Состояния событий</h3><ul>'+Object.entries(statusNames).map(([key,label])=>
    row('<i class="path-symbol '+key+'"></i>',key==='unknown'?'Неизвестно':label)).join('')+
    '</ul><h3>Тип наблюдения</h3><ul>'+Object.entries(aspects).map(([key,value])=>
    row('<b class="path-type '+key+'">'+icon(value.icon,15)+'</b>',value.label)).join('')+
    '</ul><h3>Эффект наблюдения</h3><ul>'+Object.entries(effects).map(([key,label])=>
    row('<b class="path-effect '+key+'">'+icon(effectIcons[key],14)+'</b>',label)).join('')+'</ul>';
}
export function pathShell(nav,record){
  const d=record.deal;
  return '<main class="map-app path-app">'+nav+'<div class="map-work"><header class="map-toolbar path-toolbar">'+
    '<div class="path-search-wrap"><label class="map-search">'+icon('search',17)+'<input type="search" id="path-search" autocomplete="off" placeholder="Поиск по событиям и участникам…" aria-label="Поиск по событиям и участникам" aria-controls="path-results"></label><div id="path-results" class="path-pop" hidden></div></div>'+
    tool('filters','filter','Фильтры')+tool('history','clock','История')+tool('marks','eye','Показать отклонения','tool',' aria-pressed="false"')+
    '</header><div class="board-heading path-heading"><div><div class="deal-context">'+esc(d.company)+'<span>/</span>'+esc(d.title)+'</div><h1>Путь сделки</h1></div>'+
    '<div class="path-tools">'+tool('roster','users','Участники','btn secondary')+tool('gaps','help','Чего не знаем','btn secondary')+
    '</div></div><div class="map-content path-content"><div class="path-stage"><section id="path-board" aria-label="Дорожки событий"></section>'+
    '<footer class="path-footer"><div class="path-anchor">'+tool('legend','layers','Легенда','legend-switch',' aria-expanded="false" aria-controls="path-legend"')+
    '<section class="path-pop" id="path-legend" aria-label="Легенда" hidden>'+legend()+'</section></div></footer></div><aside id="inspector" hidden></aside></div></div></main>';
}
export function createPath({id,root,getRecord,getView,saveView,refresh,selectPerson,addPerson,showGaps,signal}){
  let state,lanes,records,zones,lockedZone,markers={};
  const $=s=>root.querySelector(s);
  const meta=(key,e)=>attr('lane',key)+attr('event',e.id);
  const getPeople=(rec,e)=>(e.people||[]).map(pid=>rec.people.find(p=>p.id===pid)).filter(Boolean);
  function closePopups(){
    const panel=$('#path-legend'),search=$('#path-results');
    if(panel)panel.hidden=true;
    if(search)search.hidden=true;
    $('[data-path="legend"]')?.setAttribute('aria-expanded','false');
  }
  function search(){
    const input=$('#path-search'),panel=$('#path-results');
    const terms=input.value.trim().toLocaleLowerCase('ru').replaceAll('ё','е').split(/\s+/).filter(Boolean);
    closePopups();if(!terms.length)return;
    const matches=value=>{const text=value.toLocaleLowerCase('ru').replaceAll('ё','е');return terms.every(t=>text.includes(t))};
    const rec=getRecord(),events=lanes.now.events.filter(e=>matches([e.title,e.date,e.discussion,e.agreement,e.result].filter(Boolean).join(' ')));
    const people=rec.people.filter(p=>matches([p.name,p.title,p.dept].filter(Boolean).join(' ')));
    panel.innerHTML=(events.length?'<h3>События</h3>'+events.map(e=>btn('event',esc(e.title)+small(stamp(e.date)),'path-result',meta('now',e))).join(''):'')+
      (people.length?'<h3>Участники</h3>'+people.map(p=>personBtn(p,id)).join(''):'')||
      '<p role="status">По этому запросу ничего не найдено.</p>';
    panel.hidden=false;
  }
  if(signal){
    root.addEventListener('input',e=>{if(e.target.id==='path-search')search()},{signal});
    root.addEventListener('focusin',e=>{if(e.target.id==='path-search'&&e.target.value)search()},{signal});
    document.addEventListener('pointerdown',e=>{
      if(!e.target.closest('.path-anchor,.path-search-wrap'))closePopups();
    },{signal});
    document.addEventListener('keydown',e=>{
      const pop=e.target.closest('.path-app')&&[$('#path-legend'),$('#path-results')].find(el=>el&&!el.hidden);
      if(!pop)return;
      if(e.key==='Escape'){
        e.preventDefault();e.stopPropagation();closePopups();
        if(pop.id==='path-legend')$('[data-path="legend"]').focus();
      }else if(pop.id==='path-results'&&['Enter','ArrowDown','ArrowUp'].includes(e.key)){
        const items=[...pop.querySelectorAll('button')],index=items.indexOf(e.target);
        if(e.key==='Enter'&&e.target.id==='path-search'){e.preventDefault();items[0]?.click()}
        else if(e.key!=='Enter'&&items.length){e.preventDefault();items[(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus()}
      }
    },{signal,capture:true});
  }
  function highlightPair(button){
    button=lockedZone||button;
    root.querySelectorAll('.path-zone').forEach(zone=>zone.classList.toggle('zone-linked',!!button&&(
      button===zone||!!button.dataset.pair&&zone.dataset.pair===button.dataset.pair)));
  }
  if(signal){
    for(const type of ['pointerover','focusin','pointerout','focusout']){
      root.addEventListener(type,event=>{
        const from=event.target.closest('.path-zone');
        const to=event.relatedTarget?.closest?.('.path-zone');
        if(type==='pointerout'||type==='focusout'){if(from)highlightPair(to)}
        else if(from)highlightPair(from);
      },{signal});
    }
  }
  function zoneButton(key,e){
    const z=zones[key]?.get(e.id);
    if(!z)return '';
    const pair=z.base&&z.now;
    const title='Сравнить · '+e.title+' · '+z.tones.map(t=>effects[t]).join(' / ');
    const names=[...new Set(z.observations.map(m=>m.kind))];
    const badge=z.tones.map(t=>'<i class="path-tone '+t+'">'+icon(effectIcons[t],13)+'</i>').join('')+
      names.map(k=>'<i class="path-kind">'+icon(aspects[k].icon,12)+'</i>').join('');
    return btn('compare','<span class="path-tints">'+z.tones.map(t=>'<i class="'+t+'"></i>').join('')+'</span>'+
      '<span class="path-badges" aria-hidden="true">'+badge+'</span>','path-zone',meta(key,e)+
      (pair?attr('pair',z.now.id):'')+' aria-label="'+esc(title)+'" title="'+esc(title)+'"');
  }
  function track(key,title,summary,actions,empty){
    const lane=lanes[key],v=getView();
    const groups=key==='base'&&!state.picked?lane.events.map(e=>({date:e.date,items:[e]})):slots(lane.events);
    function slot(group){
      const first=group.items[0],multi=group.items.length>1;
      const members=[...new Set(group.items.flatMap(e=>e.people||[]))].map(pid=>lane.owner.people.find(p=>p.id===pid)).filter(Boolean);
      const backdrop=v.showMarks&&zones[key]?'<div class="path-zones">'+group.items.map(e=>zoneButton(key,e)).join('')+'</div>':'';
      const common=group.items.every(e=>e.status===first.status)?first.status:'mixed';
      const data=meta(key,first);
      const dotTitle=multi?group.items.map(e=>e.title).join(' · '):first.title+' · '+(statusNames[first.status]||statusNames.unknown);
      const dot=btn(multi?'group':'event','<i class="path-symbol '+esc(common)+'"></i>'+(multi?'<sup>'+group.items.length+'</sup>':''),
        'path-dot',data+' aria-label="'+esc(dotTitle)+'" title="'+esc(dotTitle)+'"');
      const texts=multi?btn('group','<span>'+esc(first.title)+'</span><span class="path-pair-title">'+(group.items.length===2?esc(group.items[1].title):'Ещё '+(group.items.length-1))+' '+icon('down',11)+'</span>','path-title path-pair',data):btn('event',esc(first.title),'path-title',data);
      return '<div class="path-slot" data-slot="'+esc(first.id)+'">'+backdrop+'<div class="path-name">'+texts+'</div>'+
        '<div class="path-line">'+dot+'</div><div class="path-people">'+members.slice(0,3).map(p=>personBtn(p,lane.owner.deal.id,true,lane.owner.deal.id===(v.pathOwner||id)&&p.id===v.selected)).join('')+
        (members.length>3?btn('members','+'+(members.length-3),'path-more',data+' aria-label="Показать остальных участников"'):'')+'</div>'+
        '<time title="'+esc(stamp(group.date))+'">'+esc(group.date?stamp(group.date).replace(/\s+\d{4}.*$/,''):'Без даты')+'</time>'+
        '</div>';
    }
    const n=groups.length;
    return '<section class="path-lane '+key+'"><header><div class="path-lane-heading"><h2>'+esc(title)+'</h2>'+summary+'</div>'+actions+'</header>'+
      (n?'<div class="path-strip" tabindex="0" role="region" aria-label="'+esc(title)+' — события"'+attr('strip',key)+'><div class="path-run" style="--slots:'+n+'">'+groups.map(slot).join('')+'</div></div>':
        '<div class="path-empty">'+empty+'</div>')+'</section>';
  }
  function render(){
    const record=getRecord(),v=getView(),board=$('#path-board');
    if(!board)return;
    const scroll=boardScroll();
    const family=r=>r.deal.demo?'journey-demo':deals.some(seed=>seed.id===r.deal.id)?'cursor-demo':'user';
    records=allDeals().map(d=>dealRecord(d.id)).filter(Boolean);
    state=comparison(record,records.filter(r=>family(r)===family(record)),v);
    const current=eventsFor(record),past=[...state.history,...state.sample].find(r=>r.deal.id===v.archiveId);
    lanes={base:{owner:state.picked||record,events:state.baseline},now:{owner:record,events:current}};
    if(past)lanes.past={owner:past,events:eventsFor(past)};
    markers={};
    for(const [key,lane] of Object.entries(lanes)){
      for(const e of lane.events){
        markers[key+'|'+e.id]=key==='base'?[]:observations(e,lane.owner,key==='now'?state:{picked:null,baseline:[]});
      }
    }
    zones=comparisonZones(lanes.base.events,current,new Map(current.map(e=>[e.id,markers['now|'+e.id]])));
    if(v.selected&&v.pathOwner&&v.pathOwner!==id){
      const owner=records.find(r=>r.deal.id===v.pathOwner);
      if(owner)lanes.profile={owner,events:eventsFor(owner)};
    }
    const toggle=$('[data-path="marks"]');
    toggle.setAttribute('aria-pressed',String(!!v.showMarks));
    toggle.classList?.toggle('on',!!v.showMarks);
    toggle.innerHTML=icon('eye',16)+'<span>Показать отклонения</span>';
    const reference=btn('basis','Основание','path-basis');
    const add=tool('add','plus','Событие','btn primary path-add',' aria-label="+ Событие"');
    const pastSummary=past?'<span class="path-direction">'+esc([past.journey.period,past.journey.outcome].filter(Boolean).join(' · '))+'</span>':'';
    board.innerHTML=track('base',state.clientBasis?'Обычно у клиента':'Ориентир по похожим сделкам','',reference,
        '<p>Пока неизвестно, как клиент принимает решения о покупке.</p>'+btn('manual','Добавить известный порядок','text-act'))+
      track('now','Сейчас наша сделка','',add,'<p>Пока нет зафиксированных взаимодействий.</p>')+
      (past?track('past',past.deal.title,pastSummary,btn('hide','Скрыть','text-act'),'<p>В истории этой сделки нет событий.</p>'):'');
    restoreScroll(scroll);
  }
  function boardScroll(){
    const board=$('#path-board');
    return {top:board.scrollTop,left:Object.fromEntries([...board.querySelectorAll('[data-strip]')].map(el=>[el.dataset.strip,el.scrollLeft]))};
  }
  function restoreScroll(scroll){
    const board=$('#path-board');
    if(!board||!scroll)return;
    board.scrollTop=scroll.top;
    board.querySelectorAll('[data-strip]').forEach(el=>{el.scrollLeft=scroll.left[el.dataset.strip]||0});
  }
  function set(values){Object.assign(getView(),values);saveView();render()}
  function changeJournal(fn){
    const latest=dealRecord(id), existing=latest.journey;
    latest.journey={includeProfileEvents:!Array.isArray(existing?.events),events:[],baseline:[],...existing};
    fn(latest.journey);saveRecord(latest);refresh(latest);
  }
  function dialog(title,content,onSave){
    const d=modal(title,content);d.classList.add('path-dialog');
    const form=d.querySelector('form');
    if(form&&onSave){
      // These forms only update the local deal, including in an embedded, offline preview.
      const save=form.querySelector('button[type="submit"]');
      save.type='button';
      function apply(){
        if(valid(form)&&onSave(Object.fromEntries(new FormData(form)),form)!==false)d.close();
      }
      save.addEventListener('click',apply);
      form.addEventListener('submit',ev=>{ev.preventDefault();apply()});
      form.addEventListener('keydown',ev=>{
        if(ev.key==='Enter'&&!ev.isComposing&&ev.target.matches('input[type="text"],input[type="search"]')){
          ev.preventDefault();apply();
        }
      });
    }
    d.addEventListener('click',ev=>{
      const b=ev.target.closest('[data-path]');if(!b)return;
      d.close();handle(b);
    });
    return d;
  }
  function entry(manual){
    const rec=getRecord(),j=rec.journey||{};
    const topics=['Запрос клиента','Техническая проверка','Бюджет','Условия закупки','Договор','Другое'];
    const topicKeys=['need','test','budget','procurement','contract','other'];
    const dirs=state.allDirections;
    const participants=rec.people.map(p=>'<label class="checkline"><input type="checkbox" name="members" value="'+esc(p.id)+'">'+esc(p.name)+'</label>').join('');
    dialog(manual?'Известный порядок · добавить шаг':'Зафиксировать событие','<form class="edit-form">'+field('Короткое название','title','',{required:true,extra:'maxlength="70"'})+
      select('Тема для сравнения','topic',topics.map((v,i)=>[topicKeys[i],v]))+field('Направление','direction',manual?state.direction:j.direction||rec.deal.direction||'',{required:true,extra:'list="path-directions"'})+
      '<datalist id="path-directions">'+dirs.map(d=>'<option value="'+esc(d)+'">').join('')+'</datalist>'+
      (manual?'<p>Добавьте один шаг в известном порядке. Следующий шаг можно записать после него.</p>':select('Статус','status',Object.entries(statusNames),'done'))+
      field('Дата, если известна','date','',{type:'date'})+area('Что произошло или должно произойти','discussion')+
      (participants?'<details><summary>Участники события</summary>'+participants+'</details>':'')+
      area('Договорённость','agreement')+area('Зафиксированный результат','result')+'<details><summary>Подробности и обстоятельства</summary>'+field('Тип события','type','',{placeholder:'Например, встреча или решение комитета'})+area('Решение','decision')+area('Следующий шаг','next')+area('Что изменилось в обстоятельствах','circumstance')+area('Какое ограничение зафиксировано','risk')+area('Какую пользу зафиксировали','positive')+field('Фактический формат общения','format')+select('Чьё предпочтение учитываем','preferencePerson',[['','Не указано'],...rec.people.map(p=>[p.id,p.name])])+field('Известное предпочтение из профиля','requested')+'</details>'+field('Источник сведений','source','',{required:true,placeholder:'Например, протокол рабочей встречи'})+submit('Сохранить')+'</form>',(values,form)=>{
        const {direction,...fields}=values;
        const e={...fields,title:fields.title.trim(),id:crypto.randomUUID(),source:fields.source.trim(),status:manual?'unknown':fields.status,
          people:new FormData(form).getAll('members'),topic:fields.topic==='other'?fields.title.trim().toLowerCase():fields.topic,direction:direction.trim()};
        if(manual)set({direction:e.direction,basis:'client'});
        changeJournal(j=>{if(!j.direction)j.direction=e.direction;(manual?j.baseline:j.events).push(e)});
        notify(manual?'Шаг сохранён со ссылкой на источник':'Событие добавлено');
      });
  }
  function filters(){
    const v=getView();
    dialog('Фильтры','<form class="edit-form">'+select('Направление сделки','direction',state.allDirections.length?state.allDirections:[['','Не указано']],state.direction)+
      select('Основа сравнения','basis',[['client','Этот клиент — похожие сделки'],['team','Опыт команды по направлению']],v.basis||'client')+
      '<p>Фильтры меняют ориентир. События текущей сделки остаются на дорожке.</p>'+submit('Применить')+'</form>',values=>set(values));
  }
  function explained(m){
    return '<article class="path-analysis"><div class="path-analysis-meta"><span class="path-type '+m.kind+'">'+icon(aspects[m.kind].icon,14)+' '+esc(m.aspect)+'</span><span class="path-effect '+m.effect+'">'+icon(effectIcons[m.effect],14)+' '+esc(effects[m.effect])+'</span></div>'+
      '<h3>'+esc(m.label)+'</h3>'+facts([['Наблюдение',m.text],['Основание',m.basis],['Прежний куратор',m.before],['Новый куратор',m.after],
        ['Перепроверить',m.recheck],['Зафиксированный результат',m.result],['Предполагаемое последствие',m.hypothesis],
        ['Что неизвестно',m.unknown||'Влияние на итог сделки не установлено.'],['Источники',m.source.join(' · ')]])+'</article>';
  }
  function groupFor(key,e){
    return slots(lanes[key].events).find(g=>g.items.some(item=>item.id===e.id));
  }
  function groupDetail(key,e){
    const group=groupFor(key,e);
    dialog(group.date?stamp(group.date):'События без даты','<p>'+(group.date?'События указаны на одну дату. Порядок внутри дня не зафиксирован.':'Даты этих событий не указаны. Их последовательность неизвестна.')+'</p>'+
      group.items.map(item=>btn('event',esc(item.title)+small(statusNames[item.status]||statusNames.unknown),'path-result',meta(key,item))).join(''));
  }
  function highlight(key,e){
    const area=$('[data-strip="'+key+'"]');
    const index=key==='base'&&!state.picked?e.id:groupFor(key,e)?.items[0]?.id;
    const slot=[...(area?.querySelectorAll('[data-slot]')||[])].find(el=>el.dataset.slot===index);
    if(!slot)return;
    area.querySelectorAll('.path-found').forEach(el=>el.classList.remove('path-found'));
    slot.classList.add('path-found');slot.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function detail(key,e){
    const owner=lanes[key].owner;
    const people=(e.people||[]).map(i=>owner.people.find(p=>p.id===i)).filter(Boolean);
    const names=side=>people.filter(p=>(p.side==='team')===side).map(p=>'<div>'+personBtn(p,owner.deal.id)+(e.roles?.[p.id]?small(e.roles[p.id]):'')+'</div>').join('');
    const client=names(false),team=names(true);
    const hints=e.status==='planned'?people.flatMap(p=>[...(p.preferences||[]).map(t=>p.name+' · '+t+' (предпочтения)'),...(p.agreements||[]).filter(a=>a.status!=='Согласовано').map(a=>p.name+' · '+a.title+' (договорённости)')]):[];
    const related=markers[key+'|'+e.id]||[];
    dialog(e.title,'<p class="path-meta">'+esc([statusNames[e.status]||statusNames.unknown,e.date&&stamp(e.date)].filter(Boolean).join(' · '))+'</p>'+
      (client?'<h3>Со стороны клиента</h3>'+client:'')+(team?'<h3>Наша команда</h3>'+team:'')+
      facts([['Тип события',e.type],['Обсуждение',e.discussion],['Решение',e.decision],['Договорённость',e.agreement],['Следующий шаг',e.next],['Обстоятельства',e.circumstance],['Зафиксированный результат',e.result],['Источник',e.source]])+
      (related.length?'<h3>Наблюдения</h3>'+btn('mark','Показать наблюдения · '+related.length,'text-act',meta(key,e)):'')+
      (hints.length?'<h3>К следующему контакту</h3><ul>'+hints.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>':''));
  }
  function showComparison(key,e){
    const z=zones[key]?.get(e.id);
    if(!z)return;
    const historyTitle=state.picked?.deal.title||'Запись менеджера';
    const eventRow=(side,label,item,source)=>item?
      '<div class="path-compare-row">'+small(label)+'<strong>'+esc(item.title)+'</strong>'+small([source,item.date&&stamp(item.date),item.source].filter(Boolean).join(' · '))+btn('event','Открыть событие','path-text',meta(side,item))+'</div>':
      '<div class="path-compare-row">'+small(label)+'<p>Однозначное соответствие не установлено.</p></div>';
    const limitation=!z.base||!z.now?'В выбранных источниках нет однозначной пары для этого события.':
      z.tones.includes('insufficient')?'Тема совпадает. Данных об исполнении или последствиях пока недостаточно.':
      z.tones.includes('same')?'Оба события состоялись. По доступным записям существенных отличий не выявлено. Вывод относится только к этому шагу.':
      'Сопоставление основано на записанной теме события. Последствия оцениваются только по указанным источникам.';
    const d=dialog('Сравнение событий',eventRow('base','Прошлый опыт',z.base,historyTitle)+eventRow('now','Текущая сделка',z.now,getRecord().deal.title)+
      (z.observations.length?z.observations.map(explained).join(''):'<div class="path-analysis-meta">'+z.tones.map(t=>'<span class="path-effect '+t+'">'+icon(effectIcons[t],14)+' '+esc(effects[t])+'</span>').join('')+'</div>')+
      facts([['Ограничения сравнения',limitation]]));
    const button=[...root.querySelectorAll('.path-zone')].find(b=>b.dataset.lane===key&&b.dataset.event===e.id);
    lockedZone=button;highlightPair(button);
    d.addEventListener('close',()=>{if(lockedZone===button)lockedZone=null;highlightPair(null)},{once:true});
  }
  function basis(){
    let rows='',note='';
    if(state.sample.length){
      note=state.sample.length===1?'Основание — одна прошлая сделка. По ней нельзя установить устойчивый порядок закупки.':
        'Сравнили журналы сделок по выбранному направлению. Верхняя дорожка показывает один документированный путь, в котором чаще повторяется порядок шагов из выборки.';
      rows=state.sample.map(r=>btn('archive','<strong>'+esc(r.deal.title)+'</strong>'+
        small([r.deal.company,r.journey.direction,r.journey.outcome,r.journey.period].filter(Boolean).join(' · '))+
        small(['История сделки',r===state.picked?'Показана на верхней дорожке':'Учтена при выборе пути',r.journey.outcomeSource].filter(Boolean).join(' · ')),
        'path-choice path-source',attr('archive',r.deal.id))).join('');
    }else if(state.baseline.length){
      rows=state.baseline.map(e=>btn('event','<strong>'+esc(e.title)+'</strong>'+small(['Запись менеджера',e.direction,e.source||'Источник не указан'].filter(Boolean).join(' · ')),'path-choice path-source',meta('base',e))).join('')+btn('manual','Добавить шаг');
    }else note='Нет сохранённых источников для выбранного направления и основы сравнения.';
    dialog('Основание',(state.sample.length?'<p>'+esc(state.clientBasis?'Опыт этого клиента':'Опыт команды по сделкам других клиентов')+'</p>':'')+
      rows+(note?'<p>'+esc(note)+'</p>':'')+(getRecord().deal.demo?small('В этом примере используются тестовые данные.'):''));
  }
  function handle(b){
    const a=b.dataset.path;if(!a)return false;
    const lane=lanes[b.dataset.lane],e=lane?.events.find(x=>x.id===b.dataset.event);
    if(a==='legend'){
      const panel=$('#path-legend'),open=panel.hidden;
      closePopups();panel.hidden=!open;b.setAttribute('aria-expanded',String(open));
      return true;
    }
    closePopups();
    if(a==='person'){
      selectPerson(b.dataset.person,b.dataset.owner);
    }else if(a==='event'&&e){highlight(b.dataset.lane,e);detail(b.dataset.lane,e)}
    else if(a==='group'&&e)groupDetail(b.dataset.lane,e);
    else if(a==='members'&&e){
      const group=groupFor(b.dataset.lane,e),ids=[...new Set(group.items.flatMap(item=>item.people||[]))];
      dialog('Участники события',ids.map(pid=>lane.owner.people.find(p=>p.id===pid)).filter(Boolean).map(p=>personBtn(p,lane.owner.deal.id)).join(''));
    }else if(a==='compare'&&e)showComparison(b.dataset.lane,e);
    else if(a==='mark'&&e){
      const list=markers[b.dataset.lane+'|'+e.id]||[];
      dialog(e.title,list.map(explained).join('')+btn('event','Открыть событие','text-act',meta(b.dataset.lane,e)));
    }else if(a==='filters')filters();
    else if(a==='marks')set({showMarks:!getView().showMarks});
    else if(a==='basis')basis();
    else if(a==='history'){
      dialog('История клиента',state.history.length?state.history.map(r=>btn('archive','<strong>'+esc(r.deal.title)+'</strong>'+small([r.journey.direction,r.journey.period,r.journey.outcome].filter(Boolean).join(' · ')),'path-choice',attr('archive',r.deal.id))).join(''):'<p>Завершённых сделок с этим клиентом пока нет.</p>');
    }else if(a==='archive'){
      set({archiveId:b.dataset.archive});$('#path-board .past')?.scrollIntoView?.({block:'nearest'});
    }
    else if(a==='hide')set({archiveId:null});
    else if(a==='add'||a==='manual')entry(a==='manual');
    else if(a==='roster')dialog('Участники сделки',getRecord().people.map(p=>personBtn(p,id)).join('')+btn('add-person','Добавить участника'));
    else if(a==='add-person')addPerson();
    else if(a==='gaps')showGaps(lanes.now.events.filter(e=>e.uncertainty),eventId=>{
      const item=lanes.now.events.find(e=>e.id===eventId);if(item){highlight('now',item);detail('now',item)}
    });
    return true;
  }
  function syncSelection(){
    const v=getView();
    root.querySelectorAll('.path-avatar').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.owner===(v.pathOwner||id)&&b.dataset.person===v.selected)));
  }
  function profile(panel,p,owner){
    const key=owner.deal.id===id?'now':'profile';
    if(key==='profile')lanes.profile={owner,events:eventsFor(owner)};
    const events=lanes[key].events.filter(e=>e.people?.includes(p.id));
    const values=Array.isArray(p.values)?p.values:(p.values?[p.values]:[]);
    const container=panel.querySelector('.inspect-scroll');
    if(!container)return;
    if(key==='profile'){
      const head=panel.querySelector('.inspect-title>div:last-child');
      head?.insertAdjacentHTML('beforeend',small('Из сделки «'+owner.deal.title+'»'));
      const jumps=container.querySelector('.other-modes h3');
      if(jumps)jumps.textContent='Другие режимы сделки «'+owner.deal.title+'»';
    }
    let content='';
    if(events.length)content+='<details class="path-person-history"><summary>История взаимодействий</summary>'+events.map(e=>btn('event',esc(e.title)+(e.date?' · '+esc(stamp(e.date)):''),'path-text',attr('lane',key)+attr('event',e.id))).join('')+'</details>';
    if(values.length)content+='<details class="path-person-history"><summary>Ценности</summary><p>'+values.map(esc).join(' · ')+'</p></details>';
    container.insertAdjacentHTML('beforeend',content);
  }
  return {render,handle,profile,syncSelection,boardScroll,restoreScroll};
}

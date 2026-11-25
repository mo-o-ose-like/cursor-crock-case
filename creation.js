import {esc,icon,button,eyes} from './components.js';
import {field,select,submit,backLink,valid,edgeKinds} from './fields.js';
import {blankPerson,saveRecord,defaultSettings,dealRecord} from './data.js';
import {verifyRelation} from './relations.js';
import {sampleNetwork} from './sample-network.js';

const draftKey='cursor.demo.creation.v2';
const sourceTypes={
  crm:['database','Импорт из CRM','Сделка, компания и связанные контакты'],
  web:['globe','Поиск в интернете','Открытые сведения о компании'],
  file:['upload','Загрузить файл','CSV, XLSX, PDF, DOCX'],
  link:['link','Добавить ссылку','Сайт компании, документ или база знаний']
};
let draft;
function saveDraft(){try{sessionStorage.setItem(draftKey,JSON.stringify(draft))}catch{}}
function getDraft(){
  if(!draft){try{draft=JSON.parse(sessionStorage.getItem(draftKey)||'null')}catch{}}
  if(!draft)startDraft();
  return draft;
}
export function startDraft(from='deals'){
  draft={id:crypto.randomUUID(),from,title:'',company:'',types:[],files:[],url:'',people:[],edges:[],step:'new'};saveDraft();
}
function sourceNames(d) {
  return d.types.flatMap(t=>t==='file'?d.files:t==='link'?[d.url]:[t==='crm'?'Демо CRM':'Демо веб-поиск']);
}
export function makeCandidates(d){
  const seed=sampleNetwork();
  const rolesByType={crm:['finance','technical','operations'],web:['general','finance'],file:['technical','business'],link:['general','business']};
  const roles=new Set(d.types.flatMap(t=>rolesByType[t]||[]));
  const provenance=id=>d.types.filter(t=>rolesByType[t]?.includes(id)).flatMap(t=>sourceNames({...d,types:[t]})).join(' · ');
  const people=seed.people.filter(p=>roles.has(p.id)).map(p=>({...blankPerson(),id:p.id,name:p.name,title:p.title,dept:p.dept,source:provenance(p.id)}));
  const edges=seed.edges.filter(e=>roles.has(e.a)&&roles.has(e.b)).map(e=>({...e,strength:e.kind==='influence'?'assumed':e.strength}));
  return {people,edges};
}
function sourceTile(key,d){
  const [glyph,label,detail]=sourceTypes[key];const on=d.types.includes(key);
  let expanded='';
  if(on&&key==='file')expanded=`<label class="file-drop">${icon('file',18)}<span>Выбрать файлы</span><input type="file" name="docs" accept=".csv,.xlsx,.pdf,.docx" multiple></label>${d.files.length?'<small class="source-files">'+d.files.map(esc).join(' · ')+'</small>':''}`;
  if(on&&key==='link')expanded=field('Адрес ссылки','url',d.url,{type:'url',required:true,placeholder:'https://'});
  return `<div class="source-tile ${on?'chosen':''}"><button type="button" class="source-toggle" data-source="${key}" aria-pressed="${on}"><span class="source-icon">${icon(glyph,22)}</span><span><strong>${label}</strong><small>${detail}</small></span><i class="choice">${on?icon('check',13):''}</i></button>${expanded?'<div class="source-extra">'+expanded+'</div>':''}</div>`;
}
function heading(back,title){return `${back}<h1>${title}</h1>`}
function createScreen(d,header){
  return header()+`<main class="form-page"><form id="create-form">${heading(backLink(d.from,'К сделкам'),'Новая сделка')}<div class="form-section first">${field('Название сделки','title',d.title,{required:true,placeholder:'Например, внедрение ERP',extra:'maxlength="160"'})}${field('Компания-клиент','company',d.company,{required:true,placeholder:'Название организации',extra:'maxlength="160"'})}</div><section class="form-section"><h2>Источники данных</h2><p class="sub">Можно выбрать несколько источников или начать с пустой карты.</p><div class="sources">${Object.keys(sourceTypes).map(k=>sourceTile(k,d)).join('')}</div><p class="hint">${icon('info',16)}В демоверсии источники дают примеры данных. Содержимое файлов и ссылок не отправляется на сервер.</p></section><p id="form-error" class="error" role="alert"></p><footer class="form-footer">${submit('Создать карту')}</footer></form></main>`;
}
function editPersonRow(p){
  return `<div class="review-person" data-person="${esc(p.id)}"><div class="review-person-top"><span class="source-credit">${icon('user',15)}${esc(p.source)}</span><button class="icon-btn" type="button" data-remove-person="${esc(p.id)}" aria-label="Удалить участника ${esc(p.name)}">${icon('trash',16)}</button></div><div class="field-grid three">${field('Имя и фамилия','name',p.name,{required:true})}${field('Должность','title',p.title,{placeholder:'Уточнить'})}${field('Подразделение','dept',p.dept,{placeholder:'Уточнить'})}</div></div>`;
}
function editEdge(e,i,d){
  const opts=d.people.map(p=>[p.id,p.name||'Новый участник']);
  return `<div class="review-edge" data-edge="${i}">${select('От кого','a',opts,e.a)}${select('К кому','b',opts,e.b)}${select('Тип связи','kind',Object.entries(edgeKinds),e.kind)}${e.kind==='process'&&(e.status==='planned'||e.strength==='assumed')?field('Запланированная дата','date',e.date||'',{type:'date',required:true}):''}<button type="button" class="icon-btn" data-remove-edge="${i}" aria-label="Удалить связь">${icon('trash',16)}</button></div>`;
}
function reviewScreen(d,header){
  return header()+`<main class="form-page review"><form id="review-form">${heading(backLink('new','К источникам'),'Проверка данных')}<p class="sub">Проверьте участников и предполагаемые связи перед построением карты.</p><section class="form-section"><h2>Компания и сделка</h2><div class="field-grid">${field('Компания-клиент','company',d.company,{required:true})}${field('Название сделки','title',d.title,{required:true})}</div><div class="source-tags">${sourceNames(d).map(s=>'<span>'+icon('link',13)+esc(s)+'</span>').join('')}</div></section><section class="form-section"><div class="section-heading"><h2>Найденные сотрудники <small>${d.people.length}</small></h2>${button('Добавить',{variant:'secondary',leading:'plus',action:'person-add'})}</div>${d.people.map(editPersonRow).join('')||'<p class="sub">Пока нет участников. Вы можете добавить первого вручную.</p>'}</section><section class="form-section"><div class="section-heading"><h2>Предполагаемые связи <small>${d.edges.length}</small></h2>${button('Добавить связь',{variant:'secondary',action:'edge-add',leading:'plus',disabled:d.people.length<2})}</div>${d.edges.map((e,i)=>editEdge(e,i,d)).join('')||'<p class="sub">Связи пока не заданы.</p>'}</section><aside class="unknown-notice">${icon('help',19)}<div><strong>Что ещё нужно уточнить</strong><p>Роли в закупке, контакт с КРОК и степень влияния участников.</p></div></aside><p class="error" id="form-error" role="alert"></p><footer class="form-footer">${submit('Подтвердить и построить карту')}</footer></form></main>`;
}
function finish(d){
  const deal={id:d.id,title:d.title.trim(),company:d.company.trim(),created:Date.now()};
  saveRecord({deal,settings:defaultSettings(deal),people:d.people,edges:d.edges,sources:sourceNames(d)});
  draft=null;try{sessionStorage.removeItem(draftKey)}catch{}
  // Replace the transient step so browser Back cannot resubmit the import.
  location.replace('#map/'+deal.id);
}
const loadSteps=['Получаем данные из выбранных источников','Анализируем информацию','Ищем участников закупки','Определяем связи между участниками','Готовим данные для карты'];
export function mountCreation({route,root,header,go,signal}){
  const d=getDraft();
  if(dealRecord(d.id)){go('map/'+d.id);return}
  if(route==='review'&&d.step!=='review'){go('new');return}
  if(route==='import'&&d.step!=='import'){go(d.step==='review'?'review':'new');return}
  if(route==='import'){
    root.innerHTML=`<main class="entry"><div class="import-loader">${eyes(true)}<h1>Подготовка карты</h1><p>${esc(d.company)}</p><ol aria-live="polite">${loadSteps.map(x=>'<li><i></i>'+x+'</li>').join('')}</ol><div class="hint">Демонстрационная загрузка</div></div></main>`;
    const items=[...root.querySelectorAll('li')];let i=0;
    function advance(){if(signal.aborted)return;items.forEach((el,n)=>el.className=n<i?'complete':n===i?'now':'');if(i++===items.length){if(!d.types.length){finish(d);return}const signature=JSON.stringify([d.types,sourceNames(d)]);if(d.signature!==signature){Object.assign(d,makeCandidates(d));d.signature=signature}d.step='review';saveDraft();location.replace('#review');return}setTimeout(advance,450)}
    advance();return;
  }
  const review=route==='review';
  document.title=(review?'Проверка данных':'Новая сделка')+' — Cursor';
  function draw(){root.innerHTML=review?reviewScreen(d,header):createScreen(d,header)}
  draw();
  root.addEventListener('input',e=>{
    const el=e.target,person=el.closest('[data-person]'),edge=el.closest('[data-edge]');
    if(person){d.people.find(p=>p.id===person.dataset.person)[el.name]=el.value}
    else if(edge){d.edges[Number(edge.dataset.edge)][el.name]=el.value}
    else if(['title','company','url'].includes(el.name)){d[el.name]=el.value}
    saveDraft();
  },{signal});
  root.addEventListener('change',e=>{
    if(e.target.name==='docs'){
      const names=[...e.target.files].map(f=>f.name);
      if(names.some(n=>!/\.(csv|xlsx|pdf|docx)$/i.test(n))){e.target.value='';root.querySelector('#form-error').textContent='Выберите файл CSV, XLSX, PDF или DOCX.';return}
      d.files=names;saveDraft();draw();
    }
    if(review&&e.target.name==='kind'&&e.target.closest('[data-edge]')){draw();return}
    if(review&&e.target.name==='name'){
      const id=e.target.closest('[data-person]').dataset.person;
      for(const opt of root.querySelectorAll('.review-edge option'))if(opt.value===id)opt.textContent=e.target.value||'Новый участник';
    }
  },{signal});
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.source){const k=b.dataset.source;d.types=d.types.includes(k)?d.types.filter(x=>x!==k):[...d.types,k]}
    else if(b.dataset.removePerson){const id=b.dataset.removePerson;d.people=d.people.filter(p=>p.id!==id);d.edges=d.edges.filter(x=>x.a!==id&&x.b!==id)}
    else if(b.hasAttribute('data-remove-edge'))d.edges.splice(Number(b.dataset.removeEdge),1);
    else if(b.dataset.action==='person-add')d.people.push(blankPerson());
    else if(b.dataset.action==='edge-add'&&d.people.length>=2)d.edges.push({a:d.people[0].id,b:d.people[1].id,kind:'process',strength:'strong'});
    else return;
    saveDraft();draw();
    if(b.dataset.action==='person-add')root.querySelector('.review-person:last-child input')?.focus();
  },{signal});
  root.addEventListener('submit',e=>{
    e.preventDefault();if(!valid(e.target))return;
    if(review){
      if(d.edges.some(x=>x.a===x.b)){root.querySelector('#form-error').textContent='Связь должна соединять двух разных участников.';return}
      const seen=new Set();
      d.edges=d.edges.filter(x=>{const k=[x.a,x.b,x.kind].join('|');if(seen.has(k))return false;seen.add(k);return true});
      const org=d.edges.filter(e=>e.kind==='org');
      for(const edge of org){
        const error=verifyRelation(org,edge,edge,'org');
        if(error){root.querySelector('#form-error').textContent=error;return}
      }
      finish(d);
    }else{
      if(d.types.includes('file')&&!d.files.length){root.querySelector('#form-error').textContent='Выберите файл или отключите этот источник.';return}
      if(d.types.includes('link')&&!/^https?:\/\//i.test(d.url)){root.querySelector('#form-error').textContent='Укажите ссылку, начинающуюся с https:// или http://.';return}
      d.step='import';saveDraft();go('import');
    }
  },{signal});
}

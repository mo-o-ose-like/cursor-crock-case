import {mountLearningBuilder} from './learning-builder.js';
import {mountLearning} from './learning.js';
import {icon,brand,eyes,button,crmButton,searchField,dealRow,esc} from './components.js';
import {findParticipants} from './deal-search.js';
import {marked,searchHits,terms} from './map-search.js';
import {mountMap} from './map.js';
import {mountCreation,startDraft} from './creation.js';
import {mountSettings} from './settings.js';
import {notify,modal} from './fields.js';
import {deleteDeal,restoreDeal} from './data.js';
import {allDeals,dealRecord,matches,recent,opened} from './data.js';

const app=document.querySelector('#app');
let query='';
let searchScope='all';
let participantResults=[];
let current='';
let pendingSearch=null;
const destinations=new Map();
let loadingRun=0;
let lifecycle;
let destination='deals';
let signedIn=false;
try{signedIn=sessionStorage.getItem('cursor.demo.session')==='1'}catch{}
function session(on){signedIn=on;try{if(on)sessionStorage.setItem('cursor.demo.session','1');else sessionStorage.removeItem('cursor.demo.session')}catch{}}
function go(hash){if(location.hash==='#'+hash)render();else location.hash=hash}
function loginPage(){
  document.title='Cursor — вход';
  app.innerHTML='<main class="entry"><div class="entry-group"><h1 class="sr-only">Вход в Cursor</h1>'+brand('hero-brand')+crmButton()+'<p class="demo-note">'+icon('lock',15)+'Демонстрационный вход</p></div></main>';
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function login(){
  if(current!=='login')return;
  current='loading';const run=++loadingRun;
  app.innerHTML='<main class="entry"><div class="entry-group load-group">'+eyes(true)+'<h1 class="load-title" tabindex="-1" role="status" aria-live="polite">Подключаем CRM…</h1><div class="progress" aria-hidden="true"><i></i><i></i><i></i></div><p class="demo-note">Демонстрационный режим</p></div></main>';
  document.querySelector('.load-title').focus({preventScroll:true});
  for(const [i,msg] of ['Подключаем CRM…','Проверяем доступ…','Подготавливаем рабочее пространство…'].entries()){
    if(run!==loadingRun)return;
    document.querySelector('.load-title').textContent=msg;
    document.querySelectorAll('.progress i').forEach((b,j)=>b.classList.toggle('done',j<=i));
    await sleep(i===2?950:750);
  }
  if(run!==loadingRun)return;
  session(true);go(destination);
}
function header(){
  return '<header class="appbar"><div class="bar-inner">'+brand('bar-logo')+'<button class="logout" type="button" data-action="logout" aria-label="Выйти из демоверсии">'+icon('exit',18)+'<span>Выйти</span></button><a class="learn-header-link" href="#learn">Обучение</a></div></header>';
}
function empty(foundNone=false){
  return '<div class="empty">'+(foundNone?'<span class="empty-search">'+icon('search',32)+'</span>':eyes())+'<strong>'+(foundNone?'Сделки не найдены':'У вас пока нет недавних карт')+'</strong><p>'+(foundNone?'Попробуйте другое название, имя участника или роль.':'Откройте сделку из общего списка — она появится здесь.')+'</p></div>'
}
function resultBody(){
  const searching=Boolean(query.trim());
  const all=current==='all';
  const catalog=allDeals();
  const data=searching?matches(query):all?catalog:recent().map(r=>catalog.find(d=>d.id===r.id)).filter(Boolean);
  participantResults=searching?findParticipants(catalog.map(d=>dealRecord(d.id)),query):[];
  const showDeals=searchScope!=='people',showPeople=searchScope!=='deals';
  const total=(showDeals?data.length:0)+(showPeople?participantResults.length:0);
  document.querySelector('#list-title').textContent=searching?'Результаты поиска':searchScope==='people'?'Поиск участников':all?'Список сделок':'Недавние карты';
  document.querySelector('#count').textContent=searching||showDeals?String(total):'';
  document.querySelector('#found').textContent=searching?'Найдено сделок: '+data.length+'. Участников в сделках: '+participantResults.length+'.':'';
  document.querySelectorAll('[data-search-scope]').forEach(el=>{
    const scope=el.dataset.searchScope;
    el.setAttribute('aria-pressed',String(scope===searchScope));
    const count=scope==='people'?participantResults.length:scope==='deals'?data.length:data.length+participantResults.length;
    el.querySelector('.scope-count').textContent=searching?String(count):'';
  });
  document.querySelector('.desk-footer')?.toggleAttribute('hidden',searching||!showDeals);
  const list=document.querySelector('#deal-list');
  list.classList.toggle('has-rows',total>0&&(searching||showDeals));
  destinations.clear();
  const tokens=terms(query);
  const mark=text=>marked(text,tokens);
  const settingsLabels={product:'Что продаём',stage:'Стадия сделки',budget:'Бюджет',plan:'План действий',constraints:'Риски и ограничения',goal:'Текущая цель'};
  const dealRows=data.map(d=>{
    if(!searching)return dealRow(d);
    const covers=s=>tokens.every(w=>String(s??'').toLocaleLowerCase('ru').replaceAll('ё','е').includes(w));
    if(covers(d.title+' '+d.company))return dealRow(d,mark);
    const record=dealRecord(d.id),hit=searchHits(record.people,'process',query,{})[0];
    let context='';
    if(hit){
      destinations.set(d.id,{query,hit});
      context=hit.name+' · '+hit.label+' — '+hit.snippet;
    }else{
      const key=Object.keys(settingsLabels).find(k=>covers(record.settings[k]));
      if(key){destinations.set(d.id,{query,key});context=settingsLabels[key]+' — '+record.settings[key]}
      else context=[...(d.tags||[]),d.agreement,d.notes,...(record.sources||[])].find(x=>x&&covers(x))||'';
    }
    return dealRow(d,mark,context?'<small class="deal-hit">'+mark(context)+'</small>':'');
  }).join('');
  const personRows=participantResults.map(({person:p,deal:d},i)=>{
    const initials=p.name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('');
    return '<button type="button" class="participant-result" data-person-result="'+i+'"><span class="person-avatar" aria-hidden="true">'+esc(initials)+'</span><span class="person-result-body"><strong>'+mark(p.name)+'</strong><span class="person-position">'+mark([p.title,p.dept].filter(Boolean).join(' · '))+'</span><span class="person-deal">'+icon('briefcase',16)+'<span>'+mark(d.title)+'<span class="person-company">'+mark(d.company)+'</span></span></span></span><span class="person-result-action">Открыть карточку</span></button>';
  }).join('');
  const group=(label,count,rows)=>'<section class="search-group" aria-label="'+label+'"><h3>'+label+'<span>'+count+'</span></h3>'+rows+'</section>';
  if(searching){
    list.innerHTML=total?(showPeople&&personRows?group('Участники',participantResults.length,personRows):'')+(showDeals&&dealRows?group('Сделки',data.length,dealRows):''):'<div class="empty"><span class="empty-search">'+icon('search',32)+'</span><strong>'+(searchScope==='people'?'Участники не найдены':searchScope==='deals'?'Сделки не найдены':'Ничего не найдено')+'</strong><p>Попробуйте другое имя, должность, отдел или название сделки.</p></div>';
  }else{
    list.innerHTML=showDeals?(dealRows||empty()):'<div class="empty"><span class="empty-search">'+icon('users',32)+'</span><strong>Найдите участника сделки</strong><p>Введите имя, должность или отдел.<br>Покажем человека и сделку, в которой он участвует.</p></div>';
  }
  document.querySelector('.clear').hidden=!query;
}
function dealsPage(){
  const all=current==='all';
  const title=all?'Все сделки':'Ваши сделки';
  document.title=title+' — Cursor';
  app.innerHTML=header()+'<main class="desk"><div class="desk-top">'+(all?'<button class="back" data-action="recent">'+icon('back',16)+'Ваши сделки</button>':'')+'<div class="desk-title"><h1>'+title+'</h1>'+button('Добавить сделку',{leading:'plus',action:'new'})+'</div>'+searchField(query)+'<p id="search-hint" class="search-hint">Ищите по всем сделкам: по названию, имени, должности или отделу</p><div class="search-scopes" role="group" aria-label="Искать среди">'+[['all','Все'],['deals','Сделки'],['people','Участники']].map(([value,label])=>'<button type="button" data-search-scope="'+value+'" aria-pressed="'+(searchScope===value)+'">'+label+'<span class="scope-count"></span></button>').join('')+'</div></div><section aria-labelledby="list-title" class="list-panel"><div class="list-heading"><h2 id="list-title"></h2><span id="count"></span></div><span class="sr-only" id="found" role="status" aria-live="polite"></span><div id="deal-list" class="deal-list"></div></section>'+(!all?'<div class="desk-footer">'+button('Посмотреть все сделки',{variant:'secondary',action:'all'})+'</div>':'')+'</main>';
  resultBody();
}
function render(){
  loadingRun++;
  lifecycle?.abort();lifecycle=new AbortController();
  const hash=location.hash.slice(1);
  if(hash==='preview-deals')session(true);
  if(hash==='login')session(false);
  const [route,id,field]=hash.split('/');
  const routes=['all','new','review','import','map','settings','learn','learn-review'];
  if(!signedIn)destination=routes.includes(route)?hash:'deals';
  current=!signedIn?'login':routes.includes(route)?route:'deals';
  query='';
  searchScope='all';
  document.querySelector('dialog[open]')?.remove();
  const ctx={route:current,id,root:app,header,go,signal:lifecycle.signal,search:pendingSearch?.id===id?pendingSearch:null};
  pendingSearch=null;
  if(current==='login')loginPage();
  else if(['new','review','import'].includes(current))mountCreation(ctx);
  else if(current==='map'){if(dealRecord(id))opened(id);mountMap(ctx)}
  else if(current==='settings')mountSettings(field==='budget'?{...ctx,search:{key:'budget',query:''}}:ctx);
  else if(current==='learn')mountLearningBuilder(ctx);
  else if(current==='learn-review')mountLearning(ctx);
  else dealsPage();
  window.scrollTo(0,0);
}
document.addEventListener('input',e=>{if(e.target.id==='query'){query=e.target.value;resultBody()}});
document.addEventListener('click',e=>{
  const remove=e.target.closest('[data-delete-deal]');
  if(remove){
    const id=remove.dataset.deleteDeal,deal=allDeals().find(d=>d.id===id);if(!deal)return;
    modal('Удалить сделку?', '<p>«'+esc(deal.title)+'» будет удалена из списка сделок.</p><form><div class="delete-deal-actions"><button type="button" class="btn secondary" data-close>Отмена</button><button type="submit" class="btn primary">Удалить</button></div></form>',()=>{
      deleteDeal(id);resultBody();
      document.querySelector('.delete-deal-notice')?.remove();
      const notice=document.createElement('div');notice.className='delete-deal-notice';notice.setAttribute('role','status');
      notice.innerHTML='<span>Сделка удалена</span><button type="button">Восстановить</button>';
      notice.querySelector('button').onclick=()=>{restoreDeal(id);notice.remove();resultBody()};
      document.querySelector('.desk-top').after(notice);
    });return;
  }
  const scope=e.target.closest('[data-search-scope]');
  if(scope){searchScope=scope.dataset.searchScope;resultBody();return}
  const personResult=e.target.closest('[data-person-result]');
  if(personResult){
    const result=participantResults[Number(personResult.dataset.personResult)];
    if(result){
      const {deal,person}=result;
      pendingSearch={id:deal.id,query:'',hit:{pid:person.id,mode:'org',key:''}};
      go('map/'+deal.id);
    }
    return;
  }
  const deal=e.target.closest('[data-deal]');
  if(deal && dealRecord(deal.dataset.deal)){
    const id=deal.dataset.deal,target=destinations.get(id);
    pendingSearch=target?{id,...target}:null;
    go((target?.key?'settings/':'map/')+id);return;
  }
  const action=e.target.closest('[data-action]')?.dataset.action;
  switch(action){
    case 'login':login();break;
    case 'logout':session(false);go('login');break;
    case 'all':go('all');break;
    case 'recent':go('deals');break;
    case 'clear':query='';document.querySelector('#query').value='';resultBody();document.querySelector('#query').focus();break;
    case 'new':startDraft(current==='all'?'all':'deals');go('new');break;
  }
});
window.addEventListener('hashchange',render);
window.addEventListener('cursor-storage-limited',()=>notify('Хранилище браузера недоступно. Изменения останутся только в этой вкладке.'));
window.addEventListener('storage',e=>{if(e.key==='cursor.demo.recent.v1'&&(current==='deals'||current==='all')&&!document.querySelector('dialog'))resultBody()});
render();

import {esc, icon, eyes} from './components.js';
import {dealRecord, defaultSettings, readLearningDraft, saveLearningDraft, saveRecord} from './data.js';
import {field, submit, valid} from './fields.js';
import {modes} from './map-layout.js';

const mapLessons = [
  {mode:'process', title:'Добавьте два контакта', text:'Добавьте основного контакта и ещё одного участника. В карточке укажите должность и роль в закупке. Там же можно добавить фото и Telegram.'},
  {mode:'process', kind:'process', title:'Свяжите участников закупки', text:'Сначала выберите того, кто познакомил, затем того, к кому перешли. Запишите, что произошло или запланировано.'},
  {mode:'org', kind:'org', title:'Покажите подчинение', text:'Выберите руководителя, затем подчинённого. Если формальной связи в вашей сделке нет, этот шаг можно пропустить.'},
  {mode:'influence', kind:'influence', title:'Добавьте влияние', text:'Выберите, кто влияет и на чьё решение. Укажите силу связи и запишите факт или основание для гипотезы.'},
  {title:'Карта готова', text:'Откройте стрелку, чтобы проверить её направление и параметры. Эта карта уже есть в вашем списке сделок. В What if можно сравнить исходную карту с альтернативным сценарием.'}
];

const firstLesson = 2;
const lastLesson = firstLesson + mapLessons.length - 1;

export function mountLearningBuilder({id, root, header, go, signal}) {
  const stored = readLearningDraft();
  const returnId = id && dealRecord(id) ? id : '';
  const mapLink = returnId ? '#map/'+esc(returnId) : '#deals';
  const reviewLink = '#learn-review'+(returnId?'/'+esc(returnId):'');
  let entry = stored?.deal ? 'resume' : 'welcome';
  document.title = 'Создайте карту сделки — Cursor';
  root.innerHTML = header()+`<main class="learning learning-builder">
    <nav class="learn-top-nav" aria-label="Навигация по обучению">
      <a href="${mapLink}" class="back">${icon('back',16)} ${returnId?'К карте сделки':'К сделкам'}</a>
      <a href="${reviewLink}">Разбор готовой карты</a>
    </nav>
    <header class="learn-heading"><h1>Практикум Cursor</h1></header>
    <div id="learn-builder"></div>
  </main>`;
  const content = root.querySelector('#learn-builder');

  function openMap(draft) {
    const deal = {...draft.deal, created:Date.now()};
    if (!dealRecord(deal.id)) {
      saveRecord({deal,people:draft.people || [],edges:draft.edges || [],sources:['Учебная карта · вручную'],settings:defaultSettings(deal)});
    }
    // Carry over progress from the earlier practice screen.
    saveLearningDraft({deal,step:Math.max(firstLesson,Math.min(draft.step,lastLesson))});
    go('map/'+deal.id);
  }
  function draw(focus) {
    const form = entry === 'form';
    content.innerHTML = `<div class="learn-grid">
      <section class="learn-panel learn-instruction"><div class="learn-coach">${eyes()}<span>Помощник Cursor</span></div>
        <h2 tabindex="-1">${entry==='resume'?'Продолжите на своей карте':form?'Назовите сделку':'Создайте свою карту сделки'}</h2>
        <p>${entry==='resume'?'Черновик обучения сохранён. Откройте свою карту и продолжите с того же шага.'
          :form?'Как и в разделе «Ваши сделки», сначала укажите название проекта и компанию.'
          :'Помощник будет подсказывать, какую кнопку нажать прямо на карте. Вы добавите контакты, проведёте связи и получите собственную сделку.'}</p>
      </section>
      <section class="learn-panel learn-practice" aria-label="Начало практикума">
      ${entry==='resume'?`<h3>${esc(stored.deal.title)}</h3><p>${esc(stored.deal.company)}</p>
        <button type="button" class="btn primary" data-learn-builder="resume">Продолжить на карте</button>`
        :form?`<form id="learn-deal-form" class="edit-form">
          ${field('Название сделки','title','',{required:true,placeholder:'Например, внедрение портала',extra:'maxlength="160"'})}
          ${field('Компания-клиент','company','',{required:true,placeholder:'Например, ООО Северная Линия',extra:'maxlength="160"'})}
          ${submit('Создать и открыть карту')}</form>`
        :`<h3>Что вы сделаете</h3><ol class="learn-plan"><li>Добавите двух участников</li><li>Создадите стрелки закупки, подчинения и влияния</li><li>Проверите карту и завершите обучение</li></ol>
          <button type="button" class="btn primary" data-learn-builder="start">Начать</button>`}
      </section></div>`;
    if(focus)content.querySelector('h2').focus();
  }
  draw(false);
  root.addEventListener('click',event=>{
    const action=event.target.closest('[data-learn-builder]')?.dataset.learnBuilder;
    if(action==='start'){entry='form';draw(true)}
    if(action==='resume')openMap(stored);
  },{signal});
  root.addEventListener('submit',event=>{
    if(event.target.id!=='learn-deal-form')return;
    event.preventDefault();
    if(!valid(event.target))return;
    const values=new FormData(event.target);
    openMap({step:firstLesson,deal:{id:crypto.randomUUID(),title:String(values.get('title')).trim(),company:String(values.get('company')).trim()}});
  },{signal});
}

export function mapLearningState(id) {
  const draft=readLearningDraft();
  return draft?.deal?.id===id && Number.isInteger(draft.step) && draft.step>=firstLesson && draft.step<=lastLesson ? draft : null;
}

function lessonDone(lesson, record) {
  return lesson.kind ? record.edges.some(edge=>edge.kind===lesson.kind)
    : !lesson.mode || record.people.length>=2;
}

export function drawMapLearning(panel, {training, record, mode, edgeEditing, edgeStart, pop, collapsed}) {
  const app=panel.closest('.map-app');
  delete app.dataset.learningTarget;
  panel.hidden=!training;
  if(!training){panel.innerHTML='';return}
  const lesson=mapLessons[training.step-firstLesson];
  const done=lessonDone(lesson,record);
  let cue='';
  if(done)cue=lesson.mode?'Шаг выполнен. Нажмите «Дальше».':'Нажмите «Завершить обучение», чтобы убрать подсказки.';
  else if(mode!==lesson.mode){
    cue='Откройте режим «'+modes[lesson.mode]+'» в меню карты.';
    if(!collapsed)app.dataset.learningTarget=lesson.mode;
  }else if(!lesson.kind){
    cue='Нажмите «Участник». Добавлено: '+record.people.length+' из 2.';
    if(!collapsed)app.dataset.learningTarget='person';
  }else if(!edgeEditing){
    cue=pop==='layout'?'Выберите «Редактирование связей».':'Откройте «Управление картой», затем «Редактирование связей».';
    if(!collapsed)app.dataset.learningTarget=pop==='layout'?'edge-mode':'layout';
  }else{
    const person=record.people.find(p=>p.id===edgeStart);
    cue=person?'Выбран '+person.name+'. Нажмите на карточку второго участника.':'Нажмите на карточку первого участника.';
    if(!collapsed)app.dataset.learningTarget='cards';
  }
  const html=`<div class="map-learning-top"><strong>Помощник Cursor · ${training.step-firstLesson+1} из ${mapLessons.length}</strong>
    <button type="button" class="text-act" data-map-learning="toggle" aria-expanded="${!collapsed}">${collapsed?'Показать подсказку':'Свернуть'}</button></div>
    ${collapsed?'':`<div class="map-learning-body"><div><h2>${lesson.title}</h2><p>${lesson.text}</p><p class="map-learning-cue" role="status">${esc(cue)}</p></div>
      <div class="map-learning-actions">${lesson.kind==='org'&&!done?'<button class="text-act" type="button" data-map-learning="skip">Пропустить подчинение</button>':''}
      <button class="btn primary" type="button" data-map-learning="next" ${done?'':'disabled'}>${lesson.mode?'Дальше':'Завершить обучение'}</button></div></div>`}`;
  const action=panel.contains(document.activeElement)?document.activeElement.dataset.mapLearning:null;
  panel.innerHTML=html;
  if(action)panel.querySelector('[data-map-learning="'+action+'"]')?.focus();
}

export function nextMapLearning(training, record, skip) {
  const lesson=mapLessons[training.step-firstLesson];
  if(!lessonDone(lesson,record) && !(skip&&lesson.kind==='org'))return training;
  const next=training.step===lastLesson?null:{...training,step:training.step+1};
  saveLearningDraft(next);
  return next;
}

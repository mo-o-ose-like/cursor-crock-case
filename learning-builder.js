import {esc, icon, eyes} from './components.js';
import {dealRecord, defaultSettings, readLearningDraft, saveLearningDraft, saveRecord} from './data.js';
import {field, submit, valid} from './fields.js';
import {modes} from './map-layout.js';
import {avatar, editParticipant, roleName} from './person-panel.js';
import {editRelation, statuses} from './relations.js';

const slides = [
  {title:'Создайте свою карту сделки',
   text:'Вы ведёте переговоры с заказчиком. К концу обучения у вас будет собственная карта с контактами и связями, которую можно открыть и продолжить редактировать.',
   task:'Возьмите свой пример или придумайте компанию и проект. Для упражнения достаточно двух участников, которые знакомы друг с другом.'},
  {title:'Назовите сделку',
   text:'В списке «Ваши сделки» работа начинается с кнопки «Добавить сделку». В рабочем режиме можно выбрать источники и проверить найденные данные.',
   task:'Введите название проекта и компании. Здесь начнём с пустой карты и добавим участников вручную.'},
  {title:'Добавьте контакты',
   text:'Кнопка «Участник» вверху карты открывает карточку. Запишите имя, должность и подразделение. В карточке также можно указать роль в закупке, отношение к проекту, Telegram и фото.',
   task:'Добавьте минимум двух человек. Например, основного контакта и руководителя, который утверждает бюджет. Отметить их можно флажками «Основной контакт КРОК» и «Лицо, принимающее решение».'},
  {title:'Покажите, как продвигается закупка', kind:'process',
   text:'Стрелка в «Процессе закупки» ведёт от того, кто открыл следующий шаг, к тому, с кем теперь нужно работать.',
   task:'Выберите двух участников: сначала того, кто познакомил, затем того, к кому перешли. В карточке стрелки укажите статус и опишите, что произошло или запланировано.',
   example:'Например, основной контакт представил менеджера финансовому директору.'},
  {title:'Нарисуйте формальное подчинение', kind:'org',
   text:'В «Оргструктуре» стрелка идёт от руководителя к подчинённому. Каждый сотрудник может иметь одного прямого руководителя на карте.',
   task:'Выберите руководителя, затем сотрудника. Если в вашем примере между участниками нет формального подчинения, этот шаг можно пропустить.',
   example:'Например, финансовый директор руководит финансовым контролёром.'},
  {title:'Добавьте влияние на решение', kind:'influence',
   text:'В режиме «Влияние» стрелка идёт от того, кто влияет, к тому, кто принимает решение. Такая связь может идти в обратную сторону по сравнению с подчинением.',
   task:'Выберите, кто влияет и на чьё решение. Укажите силу связи и запишите факт или основание для гипотезы.',
   example:'Например, руководитель ИБ может задержать согласование бюджета, пока не проверены меры защиты.'},
  {title:'Проверьте свою карту',
   text:'Сверьте контакты и направление стрелок. Нажмите на связь, чтобы проверить её параметры: в обычной карте это тоже открывает карточку стрелки.',
   task:'Переключитесь между режимами и сохраните сделку. На рабочей карте можно добавить договорённости, подсветить риски и проверить альтернативный ход событий в What if.'}
];

const kinds = ['process','org','influence'];
const last = slides.length - 1;
const emptyDraft = () => ({step:0,deal:null,people:[],edges:[],skipOrg:false});

export function mountLearningBuilder({id, root, header, go, signal}) {
  let draft = readLearningDraft() || emptyDraft();
  const returnId = id && dealRecord(id) ? id : '';
  const mapLink = returnId ? '#map/'+esc(returnId) : '#deals';
  const reviewLink = '#learn-review'+(returnId?'/'+esc(returnId):'');
  let editing = false, first = '', menu = false, previewMode = 'process';
  let highlighted = null;
  document.title = 'Создайте карту сделки — Cursor';
  root.innerHTML = header()+`<main class="learning learning-builder">
    <nav class="learn-top-nav" aria-label="Навигация по обучению">
      <a href="${mapLink}" class="back">${icon('back',16)} ${returnId?'К карте сделки':'К сделкам'}</a>
      <a href="${reviewLink}">Разбор готовой карты</a>
    </nav>
    <div id="learn-builder"></div>
  </main>`;
  const content = root.querySelector('#learn-builder');

  function commit() {
    saveLearningDraft(draft);
  }
  function switchStep(step) {
    draft.step=step;
    editing=false; first=''; menu=false; highlighted=null;
    commit();
    draw('h2');
  }
  function canAdvance(slide) {
    if (draft.step===1) return Boolean(draft.deal);
    if (draft.step===2) return draft.people.length>=2;
    if (slide.kind) return draft.edges.some(edge=>edge.kind===slide.kind) || (slide.kind==='org'&&draft.skipOrg);
    return true;
  }
  const lessonKind = () => slides[draft.step].kind;
  const name = id => draft.people.find(person=>person.id===id)?.name || '';

  function peopleMarkup(mode) {
    return draft.people.map(person=>{
      const selecting=Boolean(mode)&&editing;
      const label=person.primary?'Основной контакт КРОК':person.decision?'ЛПР':person.role?roleName(person):'';
      const card=avatar(person)+`<span><strong>${esc(person.name)}</strong><small>${esc(person.title||'Должность не указана')}</small>
        ${label?`<small class="learn-person-role">${esc(label)}</small>`:''}</span>`;
      return selecting||draft.step===2
        ? `<button class="learn-person" type="button" data-builder-person="${esc(person.id)}" ${selecting?`aria-pressed="${first===person.id}"`:''}>${card}</button>`
        : `<div class="learn-person">${card}</div>`;
    }).join('');
  }
  function edgeMarkup(mode) {
    const edges=draft.edges.filter(edge=>edge.kind===mode);
    if (!edges.length) return '<p class="learn-board-empty">В этом режиме стрелок пока нет.</p>';
    return `<div class="learn-links">${edges.map(edge=>`<button type="button" class="learn-edge" data-builder-edge="${draft.edges.indexOf(edge)}" aria-pressed="${edge===highlighted}">
      <span>${esc(name(edge.a))}</span><span aria-hidden="true">→</span><span>${esc(name(edge.b))}</span>
    </button>`).join('')}</div>`
      +(highlighted?`<p class="learn-evidence"><strong>${esc(statuses[mode][highlighted.status]||'Связь')}</strong>
        ${highlighted.text?' · '+esc(highlighted.text):''}${highlighted.date?' · '+esc(highlighted.date):''}</p>`:'');
  }
  function board(slide) {
    if (draft.step===0) return `<div class="learn-welcome">${eyes()}<h3>Что вы соберёте</h3>
      <ul><li>Сделку и карточки участников</li><li>Стрелки закупки, подчинения и влияния</li><li>Готовую карту, которую можно открыть из списка сделок</li></ul></div>`;
    if (draft.step===1) return `<form id="learn-deal-form" class="edit-form">
      ${field('Название сделки','title',draft.deal?.title,{required:true,placeholder:'Например, внедрение корпоративного портала',extra:'maxlength="160"'})}
      ${field('Компания-клиент','company',draft.deal?.company,{required:true,placeholder:'Например, ООО Северная Линия',extra:'maxlength="160"'})}
      ${submit('Создать учебную карту')}</form>`;
    const mode=slide.kind || (draft.step===last?previewMode:'');
    const title=mode?modes[mode]:'Контакты';
    const controls=draft.step===2
      ? '<button type="button" class="btn primary" data-builder-action="add-person">＋ Участник</button>'
      : slide.kind?`<button type="button" class="btn secondary" data-builder-action="layout" aria-expanded="${menu}">Управление картой</button>`:'';
    const toolbar=slide.kind && menu?`<div class="learn-mode">
      <button type="button" data-builder-action="edge-mode" aria-pressed="${editing}">Редактирование связей</button>
    </div>`:'';
    const tabs=draft.step===last?`<div class="learn-mode" role="group" aria-label="Режимы готовой карты">${kinds.map(kind=>
      `<button type="button" data-builder-mode="${kind}" aria-pressed="${kind===mode}">${modes[kind]}</button>`).join('')}</div>`:'';
    return `<div class="learn-board-title"><div><small>${esc(draft.deal.company)} / ${esc(draft.deal.title)}</small><h3>${title}</h3></div>${controls}</div>
      ${toolbar}${tabs}
      ${slide.kind?`<p class="learn-board-status" role="status">${esc(editing?(first?name(first)+' → выберите второго участника.':'Выберите первого участника.'):'Откройте «Управление картой» и включите «Редактирование связей».')}</p>`:''}
      <div class="learn-cards">${peopleMarkup(slide.kind)}${draft.people.length?'':'<p>Добавьте первого участника.</p>'}</div>
      ${mode?edgeMarkup(mode):''}`;
  }
  function draw(focus) {
    const slide=slides[draft.step];
    content.innerHTML=`<header class="learn-heading"><h1>Практикум Cursor</h1></header>
      <div class="learn-progress"><label for="builder-progress">Слайд ${draft.step+1} из ${slides.length}</label>
        <progress id="builder-progress" value="${draft.step+1}" max="${slides.length}"></progress></div>
      <div class="learn-grid">
        <section class="learn-panel learn-instruction"><div class="learn-coach">${eyes()}<span>Помощник Cursor</span></div>
          <h2 tabindex="-1">${slide.title}</h2><p>${slide.text}</p>
          <div class="learn-task"><strong>Ваше действие</strong><p>${slide.task}</p></div>
          ${slide.example?`<details><summary>Показать пример</summary><p>${slide.example}</p></details>`:''}
        </section>
        <section class="learn-panel learn-practice" aria-label="Учебная карта">${board(slide)}</section>
      </div>
      <div class="learn-actions learn-slide-actions">
        ${draft.step?`<button type="button" class="btn secondary" data-builder-action="back">Назад</button>`:''}
        ${slide.kind==='org' && !canAdvance(slide)?'<button type="button" class="btn secondary" data-builder-action="skip-org">Пропустить подчинение</button>':''}
        ${draft.step!==1?`<button type="button" class="btn primary" data-builder-action="next" ${canAdvance(slide)?'':'disabled'}>
          ${draft.step===0?'Начать':draft.step===last?'Сохранить и открыть карту':'Дальше'}</button>`:''}
      </div>`;
    if (focus) content.querySelector(focus)?.focus();
  }
  draw();
  root.addEventListener('submit',event=>{
    if (event.target.id!=='learn-deal-form') return;
    event.preventDefault();
    if (!valid(event.target)) return;
    const values=new FormData(event.target);
    draft.deal={
      id:draft.deal?.id || crypto.randomUUID(),
      title:String(values.get('title')).trim(),
      company:String(values.get('company')).trim()
    };
    switchStep(2);
  },{signal});
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button) return;
    const {builderAction, builderPerson, builderMode, builderEdge} = button.dataset;
    const kind=lessonKind();
    if (builderAction==='back') return switchStep(draft.step-1);
    if (builderAction==='skip-org') {
      draft.skipOrg=true;
      return switchStep(draft.step+1);
    }
    if (builderAction==='next') {
      if (!canAdvance(slides[draft.step])) return;
      if (draft.step<last) return switchStep(draft.step+1);
      const deal={...draft.deal,created:Date.now()};
      if (!dealRecord(deal.id)) saveRecord({deal,people:draft.people,edges:draft.edges,sources:['Учебная карта · вручную'],settings:defaultSettings(deal)});
      saveLearningDraft(null);
      go('map/'+deal.id);
      return;
    }
    if (builderMode) {
      previewMode=builderMode;
      highlighted=null;
      draw('[data-builder-mode="'+builderMode+'"]');return;
    }
    if (builderAction==='layout') {
      menu=!menu;
      draw('[data-builder-action="'+(menu?'edge-mode':'layout')+'"]');return;
    }
    if (builderAction==='edge-mode') {
      editing=!editing;first='';
      draw(editing?'[data-builder-person]':'[data-builder-action="edge-mode"]');return;
    }
    if (builderAction==='add-person'||(draft.step===2&&builderPerson)) {
      const existing=draft.people.find(person=>person.id===builderPerson);
      editParticipant(draft,existing,'process',(person,edge)=>{
        const i=draft.people.findIndex(p=>p.id===person.id);
        if(i>=0)draft.people[i]=person;else draft.people.push(person);
        if (edge) draft.edges.push(edge);
        commit();
        draw('[data-builder-person="'+person.id+'"]');
      });
      return;
    }
    if (builderEdge!==undefined) {
      highlighted=draft.edges[Number(builderEdge)];
      draw('[data-builder-edge="'+builderEdge+'"]');return;
    }
    if (!kind||!editing||!builderPerson) return;
    if (!first||first===builderPerson) {
      first=first===builderPerson?'':builderPerson;
      draw('[data-builder-person="'+builderPerson+'"]');return;
    }
    const edges=draft.edges.filter(edge=>edge.kind===kind);
    const old=edges.find(edge=>edge.a===first && edge.b===builderPerson);
    editRelation({mode:kind,people:draft.people,edges,old,from:first,to:builderPerson,endpoints:true,
      onSave:edge=>{
        if (old) draft.edges.splice(draft.edges.indexOf(old),1,edge);
        else draft.edges.push(edge);
        first='';highlighted=edge;commit();draw('[data-builder-action="next"]');
      },
      onRemove:()=>{
        draft.edges=draft.edges.filter(edge=>edge!==old);
        first='';highlighted=null;commit();draw('[data-builder-action="edge-mode"]');
      }
    });
  },{signal});
}

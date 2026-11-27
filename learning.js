import {defenseDeal, defenseRecord} from './defense-demo.js';
import {avatar} from './person-panel.js';
import {esc, icon} from './components.js';
import {dealRecord, normalize, readLearningProgress, saveLearningProgress} from './data.js';

const lessonNames = ['Поиск контакта', 'Оргструктура', 'Влияние', 'Риски', 'What if'];
const lessons = [
  {
    title:'Найдите основной контакт',
    intro:'КРОК готовит доклад о пилоте корпоративного портала. Сначала найдём человека, который курирует пилот со стороны заказчика.',
    task:'Введите «Соколова» в поиск и откройте карточку Ольги.',
    hint:'Поиск работает и по части фамилии. Введите «Сокол» и выберите результат.',
    success:'Ольга Соколова — основной контакт КРОК. В рабочей карте можно открыть её договорённости или нажать «Изменить участника», чтобы указать фото и Telegram.',
    answer:'business'
  },
  {
    title:'Проверьте, кто кому подчиняется',
    intro:'«Оргструктура» показывает формальное подчинение. Стрелка идёт от руководителя к сотруднику.',
    task:'Включите «Оргструктуру», затем откройте связь от ИТ-директора Лидии Филатовой к её подчинённому.',
    hint:'Найдите стрелку, которая начинается у Лидии Филатовой. Она ведёт к главному архитектору.',
    success:'Максим Белов подчиняется Лидии Филатовой. На рабочей карте нажатие на стрелку открывает сведения о связи.',
    answer:'technical-architect'
  },
  {
    title:'Узнайте, кто влияет на решение',
    intro:'В режиме «Влияние» стрелка идёт от того, кто влияет, к тому, чьё решение меняется. Сила и подтверждение связи указаны в её карточке.',
    task:'Включите «Влияние» и откройте связь, которая объясняет, почему ИТ-директор ждёт заключения ИБ.',
    hint:'На решение Лидии об условиях мобильного доступа влияет директор по информационной безопасности.',
    success:'Анна Алексеева влияет на решение Лидии: для приёмки мобильного доступа нужна виза ИБ. В реальной сделке важно сверять основание связи.',
    answer:'security-technical'
  },
  {
    title:'Отделите риски от пробелов в данных',
    intro:'«Подсветить риски» отмечает сотрудников с рисками. «Чего не знаем» собирает вопросы, на которые команде ещё нужно ответить.',
    task:'Включите подсветку рисков, затем откройте список «Чего не знаем».',
    hint:'Нажмите обе кнопки. Так вы увидите и возражение ИБ, и информацию, которой пока нет.',
    success:'Команда знает, что ИБ возражает против мобильного доступа. Дата подтверждения резервного контакта ещё неизвестна.',
    answer:'risk-review'
  },
  {
    title:'Подготовьте запасной маршрут',
    intro:'В What if можно проверить, что будет при потере контакта, задержке бюджета или появлении нового ЛПР. Сравнивайте исходную карту и сценарий перед тем, как принять решение.',
    task:'Выберите «Ключевой контакт выходит» и укажите, через кого продолжить обсуждение пилота.',
    hint:'У Лидии Филатовой уже есть контакт с КРОК, и она ведёт техническую часть пилота.',
    success:'Через Лидию можно запросить встречу и подтвердить, кто возьмёт на себя договорённости Ольги. В рабочем What if выводы помощника можно проверить по источникам и сохранить сценарий для обсуждения.',
    answer:'technical'
  }
];

const names = {
  process:'Путь сделки', org:'Оргструктура', influence:'Влияние'
};

export function mountLearning({id, root, header, signal}) {
  const demo = defenseRecord(defenseDeal);
  const people = new Map(demo.people.map(person=>[person.id,person]));
  const map = id && dealRecord(id) ? id : demo.deal.id;
  const mapLink = '#map/'+esc(map);
  let step = Math.min(lessons.length,readLearningProgress());
  let passed, mode, risks, unknown, scenario, selected, message;
  function resetTask() {
    passed=false; mode='process'; risks=false; unknown=false; scenario=''; selected=''; message='';
  }
  resetTask();
  document.title='Обучение — Cursor';
  root.innerHTML=header()+`<main class="learning">
    <nav class="learn-top-nav" aria-label="Навигация по обучению"><a href="${mapLink}" class="back">${icon('back',16)} К карте сделки</a><a href="#learn${id && dealRecord(id)?'/'+esc(id):''}">Создать свою карту</a></nav>
    <header class="learn-heading"><h1>Обучение Cursor</h1><p>Вы готовите сделку к бюджетному комитету. Пройдите пять заданий на учебной карте и потренируйтесь перед работой с клиентом.</p></header>
    <div id="learning-content"></div>
  </main>`;
  const content = root.querySelector('#learning-content');

  function card(id, choice = false, detail = '') {
    const p = people.get(id);
    const name = esc(p.name);
    const body = avatar(p)+`<span><strong>${name}</strong><small>${esc(p.title)}</small>${detail?'<small>'+esc(detail)+'</small>':''}</span>`;
    return choice
      ? `<button type="button" class="learn-person" data-practice="${esc(id)}">${body}</button>`
      : `<div class="learn-person">${body}</div>`;
  }
  function edges(kind, ids) {
    return demo.edges.filter(e=>e.kind===kind && ids.includes(e.a+'-'+e.b)).map(e=>{
      const key=e.a+'-'+e.b;
      return `<button type="button" class="learn-edge" data-practice="${key}" aria-pressed="${selected===key}">
        <span>${esc(people.get(e.a).name)}</span><span aria-hidden="true">→</span><span>${esc(people.get(e.b).name)}</span>
      </button>`;
    }).join('');
  }
  function modeButtons() {
    return `<div class="learn-mode" role="group" aria-label="Режимы карты">${Object.entries(names).map(([key,name])=>
      `<button type="button" data-learn-mode="${key}" aria-pressed="${mode===key}">${name}</button>`).join('')}</div>`;
  }
  function practice() {
    if (step===0) return `<label class="field"><span>Поиск по карте</span><input id="learn-search" type="search" placeholder="Имя или фамилия" autocomplete="off"></label>
      <div id="learn-results" class="learn-cards"></div><p class="sr-only" id="learn-search-count" role="status"></p>
      ${passed?card('business',false,'Основной контакт КРОК · пилот в двух филиалах'):''}`;
    if (step===1 || step===2) {
      const target = step===1 ? 'org':'influence';
      const examples = step===1 ? ['general-technical','technical-architect'] : ['security-technical','technical-finance'];
      const edge = demo.edges.find(e=>e.kind===target && e.a+'-'+e.b===selected);
      return modeButtons()+(mode===target
        ? `<div class="learn-links">${edges(target,examples)}</div>
          ${edge?`<p class="learn-evidence">${esc(edge.text || 'Формальное подчинение по оргструктуре заказчика.')}</p>`:''}`
        : '<p class="learn-evidence">Выберите режим для задания. Карта закупки показывает этапы и договорённости.</p>');
    }
    if (step===3) return `<div class="learn-mode" role="group" aria-label="Проверка рисков">
      <button type="button" data-learn-toggle="risks" aria-pressed="${risks}">Подсветить риски</button>
      <button type="button" data-learn-toggle="unknown" aria-pressed="${unknown}">Чего не знаем</button></div>
      <div class="learn-cards">${card('security',false,risks?'Риск: без отзыва доступа ИБ не выдаст заключение.':'')}</div>
      ${unknown?'<p class="learn-evidence">Когда Лидия Филатова подтвердит, что сможет подключиться вместо Ольги?</p>':''}`;
    return `<label class="field"><span>Сценарий</span><select id="learn-scenario">
      <option value="">Выберите сценарий</option>
      ${[['lost','Ключевой контакт выходит'],['delay','Задержка бюджета'],['decision','Вовлечение нового ЛПР']].map(([key,name])=>
        `<option value="${key}" ${scenario===key?'selected':''}>${name}</option>`).join('')}
    </select></label>
    ${scenario==='lost'?`<p class="learn-evidence">Ольга недоступна. Кто сможет продолжить обсуждение пилота?</p>
      <div class="learn-cards">${card('technical',true,'Контакт установлен')}${card('general',true,'Контакт планируется')}</div>`:''}`;
  }
  function draw(focus) {
    const completed=step===lessons.length;
    const done=step+(passed&&!completed?1:0);
    const lesson=lessons[step];
    content.innerHTML=`<div class="learn-progress"><label for="learn-progress">Выполнено ${done} из ${lessons.length}</label>
      <progress id="learn-progress" value="${done}" max="${lessons.length}"></progress></div>
      ${completed?`<section class="learn-panel learn-finish"><h2 tabindex="-1">Обучение пройдено</h2>
        <p>Теперь вы можете найти контакт, прочитать связи и проверить, как изменится сделка при потере канала связи.</p>
        <div class="learn-recap">
          <div><h3>Когда ведёте сделку</h3><p>Создайте сделку, проверьте импортированные сведения и запишите ближайшую договорённость в карточке участника. Для следующей встречи проверьте, кого ещё нужно подключить.</p></div>
          <div><h3>Когда проверяете карту</h3><p>Сверьте роли, направление стрелок и источники. В What if сравните исходную карту со сценарием и проверьте, на чём основан совет помощника.</p></div>
        </div>
        <div class="learn-actions"><a class="btn primary" href="${mapLink}">Вернуться к карте</a><button class="btn secondary" type="button" data-learn-action="restart">Пройти ещё раз</button></div></section>`
        : `<div class="learn-grid"><section class="learn-panel learn-instruction">
        <p class="learn-step">Урок ${step+1} из ${lessons.length} · ${lessonNames[step]}</p>
        <h2 tabindex="-1">${lesson.title}</h2><p>${lesson.intro}</p>
        <div class="learn-task"><strong>Задание</strong><p>${lesson.task}</p></div>
        <details><summary>Подсказка</summary><p>${lesson.hint}</p></details>
      </section><section class="learn-panel learn-practice" aria-label="Учебная карта">
        <h3>Учебная карта</h3>${practice()}
        <p class="learn-feedback ${passed?'passed':''}" role="status">${esc(passed?lesson.success:message)}</p>
        <div class="learn-actions"><button type="button" data-learn-action="back" class="btn secondary" ${step?'':'hidden'}>Назад</button>
          <button type="button" data-learn-action="next" class="btn primary" ${passed?'':'disabled'}>${step===lessons.length-1?'Завершить':'Дальше'}</button>
        </div></section></div>`}`;
    if (focus) content.querySelector(focus)?.focus();
  }
  draw();
  root.addEventListener('input',event=>{
    if(event.target.id!=='learn-search')return;
    const value=normalize(event.target.value.trim());
    const matches=value?['business','technical','finance'].filter(id=>normalize(people.get(id).name).includes(value)):[];
    root.querySelector('#learn-results').innerHTML=matches.map(id=>card(id,true)).join('');
    root.querySelector('#learn-search-count').textContent=value?`Найдено: ${matches.length}`:'';
  },{signal});
  root.addEventListener('change',event=>{
    if(event.target.id!=='learn-scenario')return;
    scenario=event.target.value; passed=false;
    message=scenario&&scenario!=='lost'?'Этот сценарий проверяет другой риск. Выберите «Ключевой контакт выходит».':'';
    draw('#learn-scenario');
  },{signal});
  root.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target)return;
    const {learnAction,learnMode,practice,learnToggle}=target.dataset;
    if (learnAction) {
      if(learnAction==='next'&&!passed)return;
      step=learnAction==='restart'?0:step+(learnAction==='back'?-1:1);
      saveLearningProgress(step);resetTask();draw('h2');return;
    }
    if (learnMode) {
      mode=learnMode;selected='';passed=false;message='';draw('[data-learn-mode="'+mode+'"]');return;
    }
    if (learnToggle) {
      if(learnToggle==='risks')risks=!risks;
      else unknown=!unknown;
      passed=risks&&unknown;
      draw(passed?'[data-learn-action="next"]':'[data-learn-toggle="'+learnToggle+'"]');return;
    }
    if (practice) {
      selected=practice;passed=practice===lessons[step].answer;
      message=passed?'':'Посмотрите подсказку и попробуйте ещё раз.';
      if(step===0&&!passed){
        const notice=root.querySelector('.learn-feedback');
        notice.textContent=message;
        return;
      }
      draw(passed?'[data-learn-action="next"]':'[data-practice="'+practice+'"]');
    }
  },{signal});
}

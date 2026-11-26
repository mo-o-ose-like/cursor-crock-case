import {esc, icon} from './components.js';
import {field, select, modal, submit, notify} from './fields.js';

const authorKey = 'cursor.observations.author.v1';
const preliminary = 'Предварительная оценка по наблюдениям';
const scales = [
  ['D', 'Решения', [
    ['decision', 'Предлагает конкретное решение, когда есть выбор?'],
    ['result', 'Возвращает обсуждение к результату и сроку?']
  ]],
  ['I', 'Обсуждение', [
    ['discussion', 'Сам начинает обсуждать идеи с группой?'],
    ['involve', 'Приглашает коллег высказаться?']
  ]],
  ['S', 'Последовательность', [
    ['sequence', 'Просит заранее согласовать порядок действий?'],
    ['continuity', 'Уточняет, как сохранить привычный порядок работы при изменениях?']
  ]],
  ['C', 'Проверка', [
    ['evidence', 'Просит цифры или документы для проверки предложения?'],
    ['criteria', 'Уточняет требования и критерии приёмки?']
  ]]
];
const choices = [['', 'Выберите ответ'], ['0', 'Редко или ни разу'], ['1', 'Иногда'], ['2', 'Часто'], ['unknown', 'Не было возможности наблюдать']];
const categories = ['Компетентный', 'Требовательный', 'Открыт к диалогу', 'Склонен к деталям', 'Осторожный', 'Другое'];
const action = (kind, label, id='', glyph='edit') =>
  '<button type="button" class="text-act" data-observation="'+kind+'" data-entry="'+esc(id)+'">'+icon(glyph,15)+esc(label)+'</button>';

export function scoreDisc(answers) {
  const scores = {};
  for (const [axis,,questions] of scales) {
    const values = questions.map(([key]) => answers[key]);
    if (values.some(value => !['0','1','2','unknown'].includes(value))) throw Error('Ответьте на каждый вопрос или выберите «Не было возможности наблюдать».');
    const observed = values.filter(value => value !== 'unknown');
    if (!observed.length) throw Error('Для шкалы '+axis+' нужен хотя бы один ответ по наблюдениям.');
    scores[axis] = Math.round(50 * observed.reduce((sum, value) => sum + Number(value), 0) / observed.length);
  }
  return scores;
}

function localAuthor() {
  try {
    const author = JSON.parse(localStorage.getItem(authorKey));
    return author?.id && author.name ? author : null;
  } catch { return null; }
}
function identity(name) {
  const current = localAuthor();
  if (current) {
    if (name && name.trim() !== current.name) throw Error('В этом браузере уже выбрана другая подпись. Откройте форму снова.');
    return current;
  }
  if (!name?.trim()) throw Error('Введите своё имя для подписи.');
  const author = {id:crypto.randomUUID(), name:name.trim().slice(0,80)};
  try { localStorage.setItem(authorKey, JSON.stringify(author)); }
  catch { throw Error('Для сохранения подписи разрешите хранение данных сайта в браузере.'); }
  return author;
}
function authorField(author) {
  return author ? '<p class="obs-meta">Автор · '+esc(author.name)+'</p>' :
    field('Ваше имя для подписи','authorName','',{required:true,extra:'maxlength="80" autocomplete="name"'})+
    '<p class="obs-meta">Демовход запомнит подпись в этом профиле браузера.</p>';
}
function stamp(item) {
  const format = iso => new Date(iso).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'});
  return esc(item.authorName)+' · '+esc(format(item.createdAt))+
    (item.updatedAt!==item.createdAt?' · изменено '+esc(format(item.updatedAt)):'');
}
function legacyLabel(person) {
  return /демо/i.test(person.source||'')?'Демонстрационный пример':'Исходные данные · авторство не проверено';
}
function chart(scores, caption) {
  const cx=85,cy=72,size=47;
  const points=values=>values.map((v,i)=>{const angle=i*Math.PI/2-Math.PI/2;return (cx+Math.cos(angle)*size*v/100)+','+(cy+Math.sin(angle)*size*v/100)}).join(' ');
  const values=scales.map(([k])=>Math.min(100,Math.max(0,Number(scores[k])||0)));
  const label=scales.map(([k],i)=>k+' '+values[i]).join(', ');
  return '<figure class="disc-chart"><svg viewBox="0 0 170 146" role="img" aria-label="DISC: '+label+'">'+
    [25,50,75,100].map(v=>'<polygon points="'+points([v,v,v,v])+'" fill="none" stroke="#d2dfe7"/>').join('')+
    '<path d="M85 25v94M38 72h94" stroke="#d2dfe7"/><polygon points="'+points(values)+'" fill="#45759442" stroke="#457594" stroke-width="2"/>'+
    [['D',85,17],['I',145,76],['S',85,137],['C',20,76]].map(([k,x,y],i)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle">'+k+' '+values[i]+'</text>').join('')+
    '</svg><figcaption>'+esc(caption)+'</figcaption></figure>';
}
const scoreLabel = scores => scales.map(([key])=>key+' '+scores[key]).join(' · ');
export function discSection(person) {
  const author=localAuthor();
  const entries=[...(person.discAssessments||[])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const latest=entries[0], own=entries.find(row=>row.authorId===author?.id);
  const original=person.disc?chart(person.disc,legacyLabel(person)):'';
  let body=latest?'<strong>'+preliminary+'</strong>'+chart(latest.scores,'Последняя оценка · '+latest.authorName):
    original||'<p>Наблюдений пока нет.</p>';
  body+=own?action('disc-edit','Пересмотреть оценку',own.id):action('disc-new','Оценить участника','','plus');
  for (const row of entries) {
    const answers=scales.flatMap(([,,questions])=>questions.map(([key,text])=>
      '<div><dt>'+esc(text)+'</dt><dd>'+esc(choices.find(([v])=>v===row.answers[key])?.[1]||'—')+'</dd></div>')).join('');
    body+='<details class="obs-entry"><summary>'+stamp(row)+'</summary><p>'+esc(scoreLabel(row.scores))+'</p><dl>'+answers+'</dl>'+
      (row.authorId===author?.id?action('disc-delete','Удалить оценку',row.id,'trash'):'')+'</details>';
  }
  if (latest&&original)body+='<details class="obs-entry"><summary>Исходная диаграмма</summary>'+original+'</details>';
  return body;
}
export function opinionSection(person) {
  const author=localAuthor();
  const groups=new Map();
  const group=label=>{if(!groups.has(label))groups.set(label,{legacy:[],entries:[]});return groups.get(label)};
  for(const row of person.opinions||[])group(row.label).legacy.push(...(row.authors||[]));
  for(const row of person.managerOpinions||[])group(row.category).entries.push(row);
  const count=g=>g.legacy.length+g.entries.length;
  const max=Math.max(1,...[...groups.values()].map(count));
  let body='<p>Наблюдения сотрудников о клиенте.</p>'+action('opinion-new','Оставить мнение','','plus');
  if(!groups.size)return body+'<p>Мнений пока нет.</p>';
  for(const [label,g] of groups) {
    body+='<details class="vote"><summary><span>'+esc(label)+'</span><i><b style="width:'+count(g)*100/max+'%"></b></i><em>'+count(g)+'</em></summary>';
    for(const row of [...g.entries].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){
      body+='<div class="obs-opinion"><strong>'+stamp(row)+'</strong>'+(row.comment?'<p>'+esc(row.comment)+'</p>':'')+
        (author?.id===row.authorId?action('opinion-edit','Исправить мнение',row.id):'')+'</div>';
    }
    if(g.legacy.length)body+='<p>'+esc(legacyLabel(person))+' · '+esc(g.legacy.join(', '))+'</p>';
    body+='</details>';
  }
  return body;
}

function discForm(existing) {
  return '<p>Вспомните встречи и переписку с этим участником. Как часто вы наблюдали такое поведение?</p>'+
    scales.map(([axis,title,questions])=>'<fieldset class="obs-scale"><legend>'+axis+' · '+title+'</legend>'+
      questions.map(([key,question])=>select(question,key,choices,existing?.answers[key]||'','required')).join('')+'</fieldset>').join('')+
    '<details class="obs-entry"><summary>Как рассчитываются показатели</summary><p>У каждой шкалы два вопроса. «Редко или ни разу» — 0 баллов, «Иногда» — 1, «Часто» — 2. Средний балл по наблюдавшимся ситуациям умножается на 50. Для каждой шкалы нужен хотя бы один такой ответ.</p></details>';
}
function opinionForm(person,existing) {
  const options=[...new Set([...categories,...(person.opinions||[]).map(row=>row.label),...(person.managerOpinions||[]).map(row=>row.category)])];
  return select('Категория','category',[['','Выберите категорию'],...options],existing?.category||'','required')+
    '<label class="field"><span>Короткий комментарий</span><textarea name="comment" rows="3" maxlength="300" placeholder="Что вы заметили на встрече или в переписке?">'+esc(existing?.comment||'')+'</textarea></label>';
}

export function openObservation(kind,entryId,person,commit) {
  const disc=kind.startsWith('disc-'), deleting=kind==='disc-delete';
  const collection=disc?'discAssessments':'managerOpinions';
  const existing=(person[collection]||[]).find(row=>row.id===entryId);
  const author=localAuthor();
  if(!kind.endsWith('-new')&&(!existing||existing.authorId!==author?.id))return;
  const form=deleting?'<p>Удалить вашу оценку DISC для участника «'+esc(person.name)+'»?</p>':
    authorField(author)+(disc?discForm(existing):opinionForm(person,existing));
  const title=deleting?'Удалить оценку DISC':disc?'Оценить участника':existing?'Исправить мнение':'Оставить мнение';
  const body='<form class="edit-form obs-form">'+form+'<p class="error" role="alert"></p><div class="obs-actions"><button type="button" class="btn secondary" data-close>Отмена</button>'+submit(deleting?'Удалить':'Сохранить')+'</div></form>';
  const dialog=modal(title+' · '+person.name,body,(values,formElement)=>{
    const error=formElement.querySelector('[role="alert"]');
    error.textContent='';
    let data;
    try {
      if(!deleting&&disc){
        const answers=Object.fromEntries(scales.flatMap(([,,questions])=>questions.map(([key])=>[key,values[key]])));
        data={answers,scores:scoreDisc(answers)};
      }else if(!deleting)data={category:values.category,comment:values.comment.trim()};
    } catch(e){error.textContent=e.message;return false}
    const save=formElement.querySelector('[type="submit"]');save.disabled=true;
    const persist=()=>{
      const writer=identity(values.authorName);
      const now=new Date().toISOString();
      const next=deleting?null:{id:existing?.id||(disc?writer.id:crypto.randomUUID()),authorId:writer.id,authorName:writer.name,
        createdAt:existing?.createdAt||now,updatedAt:now,...data};
      commit({personId:person.id,collection,previous:existing,next,writer:writer.id,label:deleting?'Удаление оценки DISC':disc?'Оценка DISC':'Мнение сотрудника'});
    };
    const pending=navigator.locks?navigator.locks.request('cursor.observations.write',persist):Promise.resolve().then(persist);
    pending.then(()=>{dialog.close();notify(deleting?'Оценка удалена':disc?'Оценка сохранена':'Мнение сохранено')})
      .catch(e=>{error.textContent=e.message;save.disabled=false});
    return false;
  });
  return dialog;
}

export function applyObservation(person,change) {
  if(!person)throw Error('Участник удалён из сделки. Закройте форму.');
  const {collection,previous,next,writer}=change;
  const rows=person[collection]||[];
  const current=rows.find(row=>row.id===(previous||next).id);
  if ((current&&current.authorId!==writer)||JSON.stringify(current)!==JSON.stringify(previous))
    throw Error('Запись изменилась. Откройте форму снова, чтобы увидеть актуальную версию.');
  if(!next)person[collection]=rows.filter(row=>row.id!==current.id);
  else if(current)person[collection]=rows.map(row=>row.id===current.id?next:row);
  else person[collection]=[...rows,next];
}

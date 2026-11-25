import {esc} from './components.js';
import {edgeId} from './map-history.js';
import {states,edgeKinds} from './fields.js';
import {statuses} from './relations.js';
import {normalize} from './data.js';

const prefix=id=>'cursor.what-if.design.v1.'+encodeURIComponent(id)+'.';
export function loadDesigns(id){
  const designs=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key?.startsWith(prefix(id)))continue;
      try{
        const design=JSON.parse(localStorage.getItem(key));
        if(design?.baseline?.deal?.id===id&&design.view)designs.push(design);
      }catch{/* A damaged entry should not hide the other designs. */}
    }
  }catch{/* Saving will report if browser storage is unavailable. */}
  return designs.sort((a,b)=>b.savedAt-a.savedAt);
}
export function saveDesign(name,baseline,view,modelSuggestion){
  const branch=view.scenario||'base';
  const {histories,branches,designIds,restoredCopies,...screen}=view;
  const design=structuredClone({
    id:crypto.randomUUID(),name,savedAt:Date.now(),baseline,modelSuggestion,
    view:{...screen,histories:{[branch]:histories?.[branch]||[]},branches:{[branch]:branches?.[branch]||{messages:[],removed:[],edits:[]}}}
  });
  localStorage.setItem(prefix(baseline.deal.id)+design.id,JSON.stringify(design));
  return design;
}
export function restoreDesign(draft,design){
  const key=design.view.scenario||'base';
  return structuredClone({...design.view,histories:{...draft.histories,...design.view.histories},
    branches:{...draft.branches,...design.view.branches},designIds:{...draft.designIds,[key]:design.id},
    restoredCopies:{...draft.restoredCopies,[key]:design}});
}
export function deleteDesign(dealId,designId){
  localStorage.removeItem(prefix(dealId)+designId);
}

const labels={
  name:'Имя',title:'Название',company:'Компания',dept:'Подразделение',level:'Уровень иерархии',formal:'Зона ответственности',
  task:'Задача в закупке',stage:'Этап',state:'Участие',attitude:'Отношение к сделке',contact:'Контакт',role:'Роль',
  decision:'ЛПР',primary:'Основной контакт',influence:'Степень влияния',risks:'Риски',opinions:'Мнения',disc:'DISC',
  goals:'Цели',preferences:'Предпочтения',goalHint:'Гипотеза о целях',preferenceHint:'Гипотеза о предпочтениях',
  agreements:'Договорённости',source:'Источник',sources:'Источники',product:'Предложение',budget:'Бюджет',goal:'Цель',
  plan:'План',constraints:'Ограничения',status:'Статус',strength:'Тип связи',text:'Описание',date:'Дата',
  participant:'Участник',position:'Должность',agreement:'Договорённость',tags:'Метки',notes:'Заметки',modes:'Режимы'
};
function display(value,key,kind){
  if(value==null||value==='')return 'Не указано';
  if(typeof value==='boolean')return value?'Да':'Нет';
  if(Array.isArray(value))return value.map(x=>display(x,key,kind)).join(' · ')||'Пусто';
  if(typeof value==='object')return Object.values(value).map(x=>display(x,key,kind)).join(' / ');
  if(key==='state')return states[value]||value;
  if(key==='strength'||key==='status')return statuses[kind]?.[value]||({strong:'Сильная',assumed:'Предполагаемая',limited:'Ограниченная'})[value]||value;
  return String(value);
}
export function dealChanges(previous,current){
  const rows=[];
  function fields(title,before,after,ids=[],edge=null){
    const details=[];
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
      if(['id','a','b','kind','created'].includes(key)||JSON.stringify(before[key])===JSON.stringify(after[key]))continue;
      const label=key==='title'&&ids.length?'Должность':labels[key]||key;
      details.push({label,was:display(before[key],key,before.kind),now:display(after[key],key,after.kind)});
    }
    if(details.length)rows.push({title,details,ids,edge});
  }
  function entities(before,after,keyOf,describe){
    const old=new Map(before.map(x=>[keyOf(x),x])),latest=new Map(after.map(x=>[keyOf(x),x]));
    for(const key of new Set([...old.keys(),...latest.keys()])){
      const a=old.get(key),b=latest.get(key),{title,ids,edge}=describe(a||b);
      if(a&&b)fields(title,a,b,ids,edge);
      else rows.push({title,ids,edge,details:[{label:'Наличие в сделке',was:a?'Есть':'Отсутствует',now:b?'Добавлено':'Удалено'}]});
    }
  }
  fields('Настройки сделки',previous.settings,current.settings);
  fields('Сведения о сделке',previous.deal,current.deal);
  fields('Источники данных',{sources:previous.sources},{sources:current.sources});
  entities(previous.people,current.people,p=>p.id,p=>({title:p.name,ids:[p.id]}));
  const names=new Map([...current.people,...previous.people].map(p=>[p.id,p.name]));
  entities(previous.edges,current.edges,edgeId,e=>({title:(edgeKinds[e.kind]||'Связь')+' · '+names.get(e.a)+' → '+names.get(e.b),ids:[e.a,e.b],edge:edgeId(e)}));
  return rows;
}
export function changeDetails(rows){
  return '<div class="design-differences">'+rows.map(row=>'<section><h3>'+esc(row.title)+'</h3><dl>'+row.details.map(d=>'<dt>'+esc(d.label)+'</dt><dd><span>При сохранении</span> <u>'+esc(d.was)+'</u></dd><dd><span>Сейчас</span> '+esc(d.now)+'</dd>').join('')+'</dl></section>').join('')+'</div>';
}
export function designList(designs,query=''){
  if(!designs.length)return '<p>Здесь появятся сценарии, которые вы сохраните для этой сделки.</p>';
  const words=normalize(query).split(/\s+/);
  const matches=designs.filter(d=>words.every(word=>normalize(d.name).includes(word)));
  if(!matches.length)return '<p role="status">Сценарии с таким названием не найдены.</p>';
  const date=new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'});
  return '<ul class="design-list">'+matches.map(d=>'<li><div class="saved-name"><b>'+esc(d.name)+'</b><small>'+esc(date.format(d.savedAt))+'</small></div><div class="saved-actions"><button type="button" data-restore-design="'+esc(d.id)+'" aria-label="Восстановить сценарий «'+esc(d.name)+'»">Восстановить</button><button type="button" data-delete-design="'+esc(d.id)+'" aria-label="Удалить сценарий «'+esc(d.name)+'»">Удалить</button></div></li>').join('')+'</ul>';
}

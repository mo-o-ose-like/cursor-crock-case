import {esc,icon,button} from './components.js';
import {field,area,select,submit,pair,modal,states,edgeKinds} from './fields.js';
import {stages} from './sample-network.js';
import {blankPerson} from './data.js';
import {scenarioPanel} from './simulation.js';
import {modes,risksFor} from './map-layout.js';

import {statusBadge} from './participant-status.js';
import {labelRole,roleName} from './participant-roles.js';
export {labelRole,roleName};
export const chip=(s,cls='')=>`<span class="chip ${cls}">${esc(s)}</span>`;
export const initials=name=>name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
export function avatar(p,cls=''){return `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(p.name)||'·')}</span>`}
const act=(action,label,ic='plus')=>`<button class="text-act" type="button" data-panel-action="${action}">${icon(ic,15)}${esc(label)}</button>`;
const factList=(...items)=>'<dl class="facts">'+items.join('')+'</dl>';
function agreements(p,editable){
  return (p.agreements.map((a,i)=>{
    const when=a.date?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(a.date+'T12:00:00')):'Дата не назначена';
    return `<article class="agreement-item" data-agreement-index="${i}" tabindex="-1"><div>${chip(a.status,a.status==='Согласовано'?'green':a.status==='Ожидает подтверждения'?'amber':'blue')} <small>${esc(when)}</small></div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></article>`;
  }).join('')||'<p>Договорённостей пока нет.</p>')+(editable?act('agreement','Добавить договорённость'):'');
}
function notes(p,key,hintKey,suggestion,editable){
  const values=p[key];
  return `<div class="note-block"><strong>${key==='goals'?'Заметки менеджера':'Заметки о взаимодействии'}</strong>${values.length?'<ul>'+values.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>Заметок пока нет.</p>'}${editable?act(key,'Добавить заметку'):''}</div>${p[hintKey]?`<div class="suggestion"><strong>${icon('spark',15)} ${suggestion}</strong><small>Демо · требует проверки</small><p>${esc(p[hintKey])}</p>${editable?act(hintKey+'-accept','Подтвердить','check')+act(hintKey+'-reject','Отклонить','close'):''}</div>`:''}`;
}
function radar(d){
  if(!d)return '<p>Подтверждённых результатов DISC пока нет.</p>';
  const cx=85,cy=72,size=47;
  const points=values=>values.map((v,i)=>{const angle=i*Math.PI/2-Math.PI/2;return (cx+Math.cos(angle)*size*v/100)+','+(cy+Math.sin(angle)*size*v/100)}).join(' ');
  return `<figure class="disc-chart"><svg viewBox="0 0 170 146" role="img" aria-label="DISC: D ${d.D}, I ${d.I}, S ${d.S}, C ${d.C}">${[25,50,75,100].map(v=>'<polygon points="'+points([v,v,v,v])+'" fill="none" stroke="#d2dfe7"/>').join('')}<path d="M85 25v94M38 72h94" stroke="#d2dfe7"/><polygon points="${points([d.D,d.I,d.S,d.C])}" fill="#45759442" stroke="#457594" stroke-width="2"/>${[['D',85,17],['I',145,76],['S',85,137],['C',20,76]].map(([k,x,y])=>'<text x="'+x+'" y="'+y+'" text-anchor="middle">'+k+' '+d[k]+'</text>').join('')}</svg><figcaption>Подтверждённый профиль · демоданные</figcaption></figure>`;
}
function opinions(p){
  if(!p.opinions.length)return '<p>Оценок участников пока нет.</p>';
  const max=Math.max(1,...p.opinions.map(o=>o.authors.length));
  return p.opinions.map(o=>`<details class="vote"><summary><span>${esc(o.label)}</span><i><b style="width:${o.authors.length/max*100}%"></b></i><em>${o.authors.length}</em></summary><p>${esc(o.authors.join(', '))}</p></details>`).join('');
}
export function inspector(p,mode,view,available=Object.keys(modes),ghost="",changes=""){
  const baseline=mode==='scenario'&&view.assistantEnabled&&view.comparison==='before';
  const editable=mode!=='scenario';const expanded=view.sections?.[p.id]??[];
  const section=(key,glyph,title,content)=>`<section class="inspect-section"><button type="button" class="section-toggle" data-section="${key}" aria-expanded="${expanded.includes(key)}">${mode==='influence'?'':icon(glyph,17)}<span>${title}</span>${icon('down',15)}</button>${expanded.includes(key)?'<div class="section-inner">'+content+'</div>':''}</section>`;
  const status=(label,value,style)=>'<div class="fact"><dt>'+esc(label)+'</dt><dd>'+statusBadge(value,style)+'</dd></div>';
  const relations=factList(status('Отношение к сделке',p.attitude,'attitude'),status('Контакт с КРОК',p.contact,'contact'),pair('Участие',states[p.state]),p.primary?pair('Канал','Основной контакт КРОК'):'');
  let body='';
  if(mode==='org')body=section('formal','target','Формальная зона ответственности','<p>'+esc(p.formal||'Зона ответственности пока не определена.')+'</p>')+factList(pair('Подразделение',p.dept),pair('Уровень иерархии',p.level));
  else if(mode==='influence')body=section('relations','handshake','Наши отношения',relations)+section('agreements','calendar','О чём договорились',agreements(p,true))+section('contact','user','Текущий статус взаимодействия',factList(pair('Статус',states[p.state]),pair('Степень влияния',p.influence),pair('Канал коммуникации',p.primary?'Основной контакт КРОК':p.contact)))+section('stage','flag','Участие в закупке',factList(pair('Этап',p.stage),pair('В закупке',p.task)));
  else if(mode==='scenario')body=(baseline?relations+'<button type="button" class="text-act" data-map="after">Перейти к действиям в сценарии</button>':scenarioPanel(p))+section('agreements','calendar','О чём договорились',agreements(p,false));
  else body=section('role','briefcase','Роль Miller–Heiman',factList(pair('Должность',p.title),pair('Роль',roleName(p)),p.role?pair('Статус роли',p.roleStatus==='confirmed'?'Подтверждена':'Предполагаемая роль'):'',pair('Что проверяет или согласовывает',p.task||'Задача в закупке пока не уточнена'),pair('Этап',p.stage),p.decision?pair('Полномочия','ЛПР'):''))+section('relations','handshake','Отношения',relations)+section('opinions','users','Мнения участников',opinions(p))+section('disc','chart','DISC',radar(p.disc))+section('goals','target','Индивидуальные цели',notes(p,'goals','goalHint','Предположение Cursor',true))+section('preferences','note','Предпочтения',notes(p,'preferences','preferenceHint','Рекомендация Cursor',true))+section('agreements','calendar','О чём договорились',agreements(p,true))+(risksFor(p).length?section('risks','warning','Риски','<ul>'+risksFor(p).map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>'):'');
  const jumps='<section class="other-modes"><h3>Найти участника в другом режиме</h3><div>'+Object.entries(modes).filter(([key])=>key!==mode).map(([key,title])=>`<button type="button" data-jump="${key}" ${available.includes(key)?'':'disabled title="Участника нет в этом режиме"'}>${title}${available.includes(key)?'':'<small>Нет на карте</small>'}</button>`).join('')+'</div></section>';
  const foot=baseline?'':'<div class="inspect-foot">'+(editable?act('edit','Изменить участника','edit'):'')+'<button type="button" class="remove-link" data-panel-action="remove" title="'+(editable?'Удалить из сделки':'Убрать из текущего сценария')+'">Удалить участника</button></div>';
  return `<div class="inspect-head"><div class="inspect-title">${avatar(p)}<div><h2>${esc(p.name)}</h2><p>${esc(p.title||'Должность не указана')}</p></div></div><button type="button" class="icon-btn" data-map="close-person" aria-label="Закрыть карточку">${icon('close',18)}</button></div>${mode==='influence'&&(p.decision||p.primary)?'<div class="inspect-tags">'+(p.decision?chip('ЛПР','purple'):'')+(p.primary?chip('Основной контакт КРОК','green'):'')+'</div>':''}<div class="inspect-scroll">${changes}${ghost?'<p class="ghost-info">'+esc(ghost)+'</p>':''}${p.proposalAction?'<p class="ai-flag">Предложение · '+esc(p.proposalAction)+'</p>':''}${body}${jumps}</div>${foot}`;
}
export function editParticipant(record,existing,kind,onSave){
  const p=existing??blankPerson();
  const others=record.people.filter(x=>x.id!==p.id);
  const levels=['Руководство','Руководитель подразделения','Специалист'];
  const nullable=arr=>[['','Не указано'],...arr];
  const check=(name,label,on)=>`<label class="checkline"><input type="checkbox" name="${name}" ${on?'checked':''}>${label}</label>`;
  function choice(label,name,items){
    const current=p[name]??'';
    const known=items.some(item=>(Array.isArray(item)?item[0]:item)===current);
    const options=known?items:[...items,[current,current||'Не указано']];
    return select(label,name,options,current);
  }
  const orgOnly=kind==='org'&&!!existing;
  let form=field('Имя и фамилия','name',p.name,{required:true})+field('Должность','title',p.title)+field('Подразделение','dept',p.dept)+choice('Уровень иерархии','level',nullable(levels))+area('Формальная зона ответственности','formal',p.formal);
  if(!orgOnly)form+=area('Зона ответственности в закупке','task',p.task)+choice('Этап закупки','stage',nullable(stages))+choice('Участие в сделке','state',Object.entries(states))+choice('Роль Miller–Heiman','role',nullable([['Технический эксперт','T · Технический согласующий'],['Экономический покупатель','E · Экономический покупатель'],['Пользователь','U · Представитель пользователей'],['Наставник','C · Наставник']]))+select('Статус роли','roleStatus',[['assumed','Предполагаемая роль'],['confirmed','Подтверждена'],...(p.roleStatus&&!['assumed','confirmed'].includes(p.roleStatus)?[[p.roleStatus,p.roleStatus]]:[])],p.roleStatus||'assumed')+choice('Отношение к сделке','attitude',['Неизвестно','Поддерживает','Нейтрально','Сомневается','Против','Возражает'])+choice('Контакт с КРОК','contact',['Нет данных','Контакт установлен','Контакт планируется','Нет контакта'])+choice('Степень влияния','influence',['Неизвестно','Высокое','Среднее','Низкое'])+check('decision','Лицо, принимающее решение',p.decision)+check('primary','Основной контакт КРОК',p.primary);
  if(!existing&&others.length)form+=select('Связать с участником','parent',[['','Без связи'],...others.map(x=>[x.id,x.name])])+select('Тип связи от выбранного участника','kind',Object.entries(edgeKinds),kind==='scenario'?'process':kind);
  modal(existing?'Изменить участника':'Новый участник','<form class="edit-form">'+form+submit('Сохранить')+'</form>',values=>{
    const {parent,kind:edgeKind,decision,primary,...fields}=values;
    const updated={...p,...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.trim()]))};
    if(!p.roleStatus&&updated.roleStatus==='assumed'&&updated.role===p.role)delete updated.roleStatus;
    if(!orgOnly)Object.assign(updated,{decision:!!decision,primary:!!primary});
    onSave(updated,parent?{a:parent,b:p.id,kind:edgeKind,strength:'strong'}:null);
  });
}
export function handlePanel(action,p,commit){
  if(action==='goals'||action==='preferences')modal('Добавить заметку','<form class="edit-form">'+field('Заметка','note','',{required:true})+submit('Добавить')+'</form>',({note})=>{p[action].push(note.trim());commit()});
  else if(action==='agreement')modal('Новая договорённость','<form class="edit-form">'+field('О чём договорились','title','',{required:true})+field('Дата','date','',{type:'date'})+select('Статус','status',['Запланировано','Согласовано','Ожидает подтверждения'])+area('Подробности','detail')+submit('Добавить')+'</form>',v=>{p.agreements.push({...v,title:v.title.trim()});commit()});
  else if(/^(goalHint|preferenceHint)-(accept|reject)$/.test(action)){
    const [key,decision]=action.split('-');if(decision==='accept')p[key==='goalHint'?'goals':'preferences'].push(p[key]);p[key]='';commit();
  }
}

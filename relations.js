import {esc} from './components.js';
import {select,field,area,submit,modal} from './fields.js';
import {exampleRelation} from './relation-examples.js';
import {isSampleLink} from './sample-network.js';

export const statuses={
  org:{formal:'Формальное подчинение'},
  process:{done:'Пройденный путь',established:'Установленный переход',planned:'Планируемый переход'},
  influence:{strong:'Сильное · подтверждено',limited:'Ограниченное · подтверждено',assumed:'Предполагаемое · не подтверждено'},
  scenario:{current:'Текущая связь',new:'Возможная новая связь',change:'Возможно изменение',remove:'Предложено убрать'}
};
export const pairKey=e=>JSON.stringify([e.a,e.b]);
export function relationData(edge,mode,people){
  const name=id=>people.find(p=>p.id===id)?.name||'Участник';
  const demo=people.some(p=>p.id===edge.a&&p.source==='Демонстрационная CRM')&&people.some(p=>p.id===edge.b&&p.source==='Демонстрационная CRM');
  const example=demo&&exampleRelation(edge,people);
  const baseStatus=mode==='process'?(edge.strength==='assumed'?'planned':edge.strength==='limited'?'done':'established'):edge.strength||'limited';
  const status=mode==='scenario'?(edge.proposal||'current'):(edge.status in statuses[mode]?edge.status:mode==='org'?'formal':baseStatus);
  const impact=`Если контакт сохранится, ${name(edge.a)} сможет передать информацию участнику «${name(edge.b)}». Проверьте, готов ли адресат продолжить обсуждение.`;
  const text=mode==='scenario'?(edge.effect||edge.proposal&&edge.text||impact):(edge.text??example?.text??'');
  return {...edge,status,text,date:edge.date??example?.date??''};
}
export function verifyRelation(edges,next,old,mode){
  const same=e=>old&&e.a===old.a&&e.b===old.b;
  if(next.a===next.b)return 'Выберите двух разных участников.';
  const rest=edges.filter(e=>!same(e));
  if(rest.some(e=>e.a===next.a&&e.b===next.b))return 'Такая связь уже есть на карте.';
  if(mode==='org'){
    if(rest.some(e=>e.b===next.b))return 'У сотрудника уже есть руководитель. Измените существующую связь.';
    const queue=[next.b],visited=new Set();
    while(queue.length){
      const id=queue.pop();if(id===next.a)return 'Такое подчинение образует круг. Выберите другого руководителя.';
      if(visited.has(id))continue;visited.add(id);queue.push(...rest.filter(e=>e.a===id).map(e=>e.b));
    }
  }
  return '';
}
const fieldNames={org:['Руководитель','Подчинённый'],process:['Кто познакомил','К кому перешли'],influence:['Кто влияет','На чьё решение'],scenario:['От кого','К кому']};
const descriptions={process:'Как произошёл или пройдёт переход',influence:'Факт или основание для гипотезы',scenario:'Предполагаемый эффект'};
export function editRelation({mode,people,edges,old,from,to,endpoints,onSave,onRemove}){
  const item=old?relationData(old,mode,people):{a:from||people[0]?.id,b:to||people.find(p=>p.id!==(from||people[0]?.id))?.id,status:mode==='scenario'?'new':Object.keys(statuses[mode])[0],text:'',date:''};
  const opts=people.map(p=>[p.id,p.name]);
  const names=fieldNames[mode];
  const direction=endpoints?select(names[0],'a',opts,item.a)+select(names[1],'b',opts,item.b):'<p class="edge-direction">'+esc(people.find(p=>p.id===item.a)?.name)+' → '+esc(people.find(p=>p.id===item.b)?.name)+'</p>';
  const info=mode==='org'?'':select('Статус','status',Object.entries(statuses[mode]),item.status)+area(descriptions[mode],'text',item.text)+field('Дата','date',item.date,{type:'date'});
  const remove=old&&endpoints?'<button class="remove-link" data-remove-relation type="button">Удалить связь</button>':'';
  const dialog=modal(old?'Изменить связь':'Новая связь','<form class="edit-form">'+direction+info+'<p class="error" role="alert" data-edge-error></p><div class="relation-form-foot">'+remove+submit('Сохранить')+'</div></form>',(values,form)=>{
    const status=values.status||'formal',a=values.a||item.a,b=values.b||item.b;
    const next={...old,a,b,kind:mode==='scenario'?'process':mode,status,text:(values.text||'').trim(),date:values.date||''};
    if(!old||old.a!==a||old.b!==b||old.text!==next.text||old.status!==status)next.source='Правка пользователя';
    if(mode==='scenario'){next.proposal=status;next.effect=next.text}
    if(mode==='influence')next.strength=status;
    if(mode==='process')next.strength=({planned:'assumed',done:'limited',established:'strong'})[status];
    const error=verifyRelation(edges,next,old,mode);
    if(error){form.querySelector('[data-edge-error]').textContent=error;return false}
    onSave(next);
  });
  const form=dialog.querySelector('form');
  if(mode!=='org'){
    form.elements.text.required=true;
    const sync=()=>{const planned=mode==='process'&&form.elements.status.value==='planned';form.elements.date.required=planned;form.elements.date.closest('label').querySelector('span').textContent=planned?'Запланированная дата *':'Дата'};
    form.elements.status.addEventListener('change',sync);sync();
  }
  dialog.querySelector('[data-remove-relation]')?.addEventListener('click',()=>{onRemove();dialog.close()});
}
const titles={org:'Формальное подчинение',process:'Переход взаимодействия',influence:'Влияние на решение',scenario:'Изменение в сценарии'};
const progress={done:'Состоялся',established:'В процессе',planned:'Запланирован'};
const strengths={strong:'Сильное',limited:'Ограниченное',assumed:'Не установлена'};

export function relationCard(edge,mode,people,preview=false,findings=[]){
  const item=relationData(edge,mode,people);
  const from=people.find(p=>p.id===edge.a),to=people.find(p=>p.id===edge.b);
  const a=from?.name||'Участник',b=to?.name||'Участник';
  const demo=[from,to].every(p=>p?.source==='Демонстрационная CRM')&&isSampleLink(edge)&&(!edge.text||edge.text===exampleRelation(edge)?.text);
  const source=edge.source||(demo?'Демонстрационная CRM':'');
  const when=item.date?item.date.split('-').reverse().join('.'):'';
  const rows=[];
  function row(label,value){if(value)rows.push('<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>')}
  if(mode==='org'){
    row('Руководитель',a);row('Подчинённый',b);
    row('Подчинение',edge.text||'Прямое подчинение по организационной структуре.');
    row('Источник',source);
  }else if(mode==='process'){
    row('Цель перехода',item.text||'Цель пока не указана');
    row('Статус',progress[item.status]);
    row('Этап закупки',edge.stage||to?.stage||'Не указан');
    row(item.status==='planned'?'Планируемая дата':'Дата',when);
  }else if(mode==='influence'){
    row('Основание',item.text||'Основание пока не указано');
    row('Сила влияния',strengths[item.status]);
    row('Подтверждение',item.status==='assumed'?'Гипотеза, требует проверки':'Подтверждено');
    row('Источник',source||'Не указан');
    row('Дата',when);
  }else{
    const changed=item.status!=='current';
    row('Изменение',statuses.scenario[item.status]);
    const reasoning=findings.find(it=>it.kind!=='advice'&&it.sources.some(s=>s.edge?.[0]===edge.a&&s.edge?.[1]===edge.b));
    if(changed&&edge.assistant&&edge.text)row('Предложение',edge.text);
    row('Возможные последствия',reasoning?.text||(!edge.assistant&&edge.effect)||(changed?{
      new:'Может появиться прямой канал для обсуждения следующего шага.',
      remove:'Может понадобиться другой путь для передачи договорённостей.',
      change:'Возможно, потребуется заново согласовать порядок взаимодействия.'
    }[item.status]:item.text));
    row('Оценка',changed?'Гипотеза сценария':'Текущая связь. Возможные последствия — гипотеза.');
    row('Дата',when);
  }
  const controls=preview?'':'<button class="icon-btn" data-map="close-pop" aria-label="Закрыть">×</button>';
  const edit=preview?'':'<button class="text-act" data-map="edit-edge">Редактировать связь</button>';
  return '<section class="map-popover relation-pop"><div class="pop-head"><h2>'+titles[mode]+'</h2>'+controls+'</div>'+
    (mode==='org'?'':'<p class="edge-direction">'+esc(a)+' → '+esc(b)+'</p>')+
    '<dl class="edge-facts">'+rows.join('')+'</dl>'+edit+'</section>';
}

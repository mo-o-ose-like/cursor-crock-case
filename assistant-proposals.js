import {blankPerson,deals} from './data.js';
import {exampleRelation} from './relation-examples.js';

const lower = s => String(s || '').toLocaleLowerCase('ru').replaceAll('ё','е');
const words = s => lower(s).match(/[а-яa-z]+/gu) || [];
const titles = {lost:'Потерять связь',worse:'Испортить отношения',better:'Улучшить отношения',contract:'Заключить договор'};
const snippet = s => String(s ?? '').trim().slice(0, 320);
const personSource = (p, detail) => ({label:'Карточка · '+p.name,detail,personId:p.id});
const agreementSource = (p,a) => ({
  label:'Договорённость · '+a.title,personId:p.id,agreement:{title:a.title,date:a.date||''},
  detail:[p.name,a.title,a.status,a.date,a.detail].filter(Boolean).join(' · ')
});
const inputSource = m => ({label:'Сообщение сотрудника',messageId:m.id,detail:snippet(m.text),...(m.personId ? {personId:m.personId} : {})});
const eventSource = e => ({label:'Событие сценария',detail:[titles[e.kind] || e.kind,e.title,e.date,e.detail].filter(Boolean).join(' · '),personId:e.personId});
const available = p => p.state!=='finished' && p.contact==='Контакт установлен';
const together = (e, a, b) => (e.a===a && e.b===b) || (e.a===b && e.b===a);

// Resolve explicit names before falling back to the participant selected for the message.
// Short shared first names never resolve to an arbitrary individual.
function namedPeople(text, people) {
  const tokens=words(text);
  const mentions=[];
  for(const p of people){
    const parts=words(p.name).filter(w=>w.length>2);
    const matches=parts.map(part=>{
      const stem=part.replace(/(?:ая|ий|ей|ый|овна|евич|а|я|ь)$/u,'');
      return tokens.findIndex(token=>token===part || (stem.length>=4 && token.startsWith(stem) && token.length-stem.length<=4));
    });
    const surname=matches.at(-1);
    const uniqueFirst=parts[0] && people.filter(x=>words(x.name)[0]===parts[0]).length===1;
    if((surname>=0 && parts.length>1) || (matches[0]>=0 && uniqueFirst))mentions.push({p,first:Math.min(...matches.filter(n=>n>=0))});
  }
  return mentions.sort((a,b)=>a.first-b.first).map(x=>x.p);
}

function newName(text){
  const quoted=text.match(/[«“"]([^»”"\n]{2,75})[»”"]/u);
  if(quoted)return quoted[1];
  const after=text.match(/(?:добав(?:ить|ь|им|ьте)|вовлечь|пригласить|подключить|включить|привлечь)\s+(.+)/iu)?.[1] || '';
  const proper=after.match(/(?:^|\s)([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+){1,2})(?=\s|[,.!?;:]|$)/u);
  if(proper)return proper[1];
  const role=after.replace(/^(?:в сценарий|на карту|в карту)\s+/iu,'').replace(/^(?:(?:нового|новую|ещё одного|еще одного)\s+)?(?:участника|сотрудника|сотрудницу|человека|роль)\s*/iu,'').replace(/\s+(?:в сценарий|на карту|к обсуждению|к встрече|на встречу|для|чтобы|к сделке|и связать|со связью)(?:\s|$).*$/iu,'').split(/[,.;!?\n]/u)[0].trim().slice(0,75);
  return role ? role[0].toLocaleUpperCase('ru')+role.slice(1) : 'Новый участник';
}

const relationClause=/\s+(?:и\s+)?(?:свяж(?:и|ите)|связа(?:ть|в)|соедин(?:и|ить)|со\s+связью)\s+(?:его\s+|её\s+|ее\s+)?(?:с|со)\s+/iu;
function intent(text){
  const link=/связ[ьиьяе]|свя(?:зать|жи)|ребро|лини[юяи]|соедин|влияни|зависимост/u.test(text);
  const remove=/(?:убра|убер|удал|исключ|отключ|разорв|разорва|снять|перестал.{0,15}участв|выш[её]л.{0,12}процесс)/u.test(text);
  const add=/(?:добав|вовле|приглас|привле|включ|подключ)/u.test(text);
  if(/(?:потер|потеря|пропа|восстанов|возобнов|налад|утрат|нет|выйти на).{0,15}связ[ьиья]|связи (?:нет|больше нет|потеряна)/u.test(text))return 'contact';
  if(remove && !link) return 'remove-person';
  if(link && remove) return 'remove-edge';
  if(add && relationClause.test(text) && !/добав.{0,6}связ[ьи]/u.test(text))return 'add-person';
  if(/договор|контракт|подписа|соглашени/u.test(text))return 'contract';
  if(link)return /обнов|измен|перенес|усил|ослаб|поменя|ослаб|уточни/u.test(text)?'change-edge':'add-edge';
  if(/контакт|коммуникаци|пообща|переговор|созвон|связаться|свяжись|связи нет/u.test(text))return 'contact';
  if(add)return 'add-person';
  return 'note';
}
function alternative(graph,p){
  const candidates=graph.people.filter(x=>x.id!==p.id && available(x));
  return candidates.find(x=>x.primary) || candidates.find(x=>graph.edges.some(e=>together(e,x.id,p.id))) || candidates[0];
}
function linkSource(record,graph,edge) {
  const a=graph.people.find(p=>p.id===edge.a), b=graph.people.find(p=>p.id===edge.b);
  const fixture=deals.some(d=>d.id===record.deal?.id) && [a,b].every(p=>p?.source==='Демонстрационная CRM');
  const note=edge.text ? edge : fixture ? exampleRelation(edge) : null;
  return {label:'Связь на карте',detail:[(a?.name||edge.a)+' → '+(b?.name||edge.b),note?.text,note?.date].filter(Boolean).join(' · '),personId:edge.a,edge:[edge.a,edge.b]};
}
function pickDate(text){
  return text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?=$|\W)/u)?.[1] || '';
}

function analysisQuestion(text){
  const ask=/^(?:каки[ехм]|како[йевя]|какая|как\s|что\s|чем\s|есть ли|почему|где\s|покажи|назови|дай|подскажи|перечисли|оцени|расскажи|посоветуй)/u;
  if(!ask.test(text)&&!/^(?:риски|гипотезы|советы)(?:[?!. ]|$)/u.test(text))return '';
  if(/риск|рискуем|пойти не так|сорваться/u.test(text))return 'risk';
  if(/гипотез|предположени|может (?:произойти|измениться|случиться)/u.test(text))return 'hypothesis';
  if(/совет|рекоменд|рекомендаци|следующ.{0,4} шаг|что (?:делать|сделать) дальше/u.test(text))return 'advice';
  return '';
}

export function proposals(record,graph,events=[],messages=[]){
  const {people=[],edges=[]}=graph;
  const items=[], suggestedPeople=[], suggestedEdges=new Map(), actions={};
  const item=(id,text,...sources)=>items.push({id,kind:'advice',text,sources:sources.filter(Boolean)});
  function edge(a,b,proposal,text,extra={}){
    if(!a||!b||a.id===b.id)return;
    const original=edges.find(e=>e.a===a.id && e.b===b.id);
    const start=original?.a||a.id,end=original?.b||b.id;
    suggestedEdges.set([start,end].join('/'),{a:start,b:end,kind:'process',strength:'assumed',proposal:original&&proposal==='new'?'change':proposal,text,...extra});
  }
  const lead=people.find(p=>p.primary);
  const budget=record.settings?.budget;
  const decider=people.find(p=>p.decision);
  if(decider&&!budget){
    item('budget',decider.name+' — уточнить лимит бюджета и порядок утверждения.',
      {label:'Настройки сделки',detail:'Поле «Бюджет» не заполнено.'},personSource(decider,'ЛПР · '+(decider.title||decider.name)));
  }
  const planned=people.find(p=>p.state==='planned' && p.id!==lead?.id && p.contact!=='Контакт установлен');
  if(lead && available(lead) && planned){
    item('introduce-'+planned.id,'Предложить знакомство: '+lead.name+' → '+planned.name+'. Уточнить, готов ли основной контакт организовать встречу.',
      personSource(lead,'Основной контакт КРОК · '+lead.contact),personSource(planned,[planned.contact,planned.stage].filter(Boolean).join(' · ')));
    edge(lead,planned,'new','Попросить основной контакт помочь с первым знакомством.',{status:'Предложение',basis:'introduce-'+planned.id});
    actions[planned.id]='Запланировать знакомство';
  }
  for(const p of people.filter(x=>x.sim || events.some(e=>e.personId===x.id))){
    const last=events.filter(e=>e.personId===p.id).at(-1);
    const source=last?eventSource(last):{label:'Условие сценария',detail:[p.name,p.sim].join(' · '),personId:p.id};
    if(p.contact==='Связь потеряна'||p.sim==='Канал недоступен'){
      const alt=alternative(graph,p);
      const loss=events.findLast(e=>e.personId===p.id&&e.kind==='lost');
      const cause=loss?eventSource(loss):{label:'Контакт в сценарии',detail:p.name+' · '+p.contact,personId:p.id};
      item('lost-'+p.id,alt?'Проверить запасной маршрут связи: '+alt.name+' → '+p.name+'.':p.name+' — спросить у команды клиента, кто может помочь восстановить связь.',
        cause,alt&&personSource(alt,alt.contact));
      actions[p.id]='Восстановить контакт';
      if(alt)edge(alt,p,'new','Запросить знакомство через доступного участника.',{basis:'lost-'+p.id});
    }
    if(graph.presetParticipants?.includes(p.id)){
      const next='Уточнить новый срок согласования бюджета';
      actions[p.id]??=next;
      item('delay-'+p.id,next+' · '+p.name+'.',{label:'Условие сценария',detail:'Согласование бюджета перенесено в модели.',personId:p.id},personSource(p,p.task||p.stage||p.name));
    }
    if(last?.kind==='contract'){
      item('contract-'+p.id,p.name+' — уточнить, кто отвечает за следующий шаг по договору «'+last.title+'».',source);
      actions[p.id]='Согласовать первый шаг по договору';
    }else if(last?.kind==='better'||last?.kind==='worse'){
      const text=last.kind==='better'?'Согласовать следующий шаг':'Уточнить возражение';
      actions[p.id]=text;item('attitude-'+p.id,p.name+' — '+lower(text)+'.',source,personSource(p,p.attitude));
    }else if(p.id==='what-if-new'){
      const text='Проверить полномочия и роль в принятии решения';
      actions[p.id]=text;item('scenario-'+p.id,text+' · '+p.name+'.',source);
    }
  }
  const security=/информационн.{0,5} безопасност|служб.{0,3} ИБ|согласование ИБ/iu;
  const sponsor=people.find(p=>p.agreements?.some(a=>a.status!=='Согласовано'&&security.test(a.title+' '+a.detail)));
  if(sponsor&&!people.some(p=>security.test(p.title+' '+p.dept))){
    const note=sponsor.agreements.find(a=>a.status!=='Согласовано'&&security.test(a.title+' '+a.detail));
    const securityRep={...blankPerson(),id:'assistant-security',name:'Представитель службы ИБ',title:'Участник для уточнения',dept:'Служба ИБ',task:'Проверка требований безопасности',state:'planned',source:'Гипотеза помощника',sim:'Предложен участник',ai:true};
    suggestedPeople.push(securityRep);actions[securityRep.id]='Предложено добавить';
    const introducer=available(sponsor)?sponsor:alternative(graph,sponsor);
    const via=introducer&&introducer.id!==sponsor.id;
    if(introducer)edge(introducer,securityRep,'new','Уточнить у доступного контакта, кто со стороны ИБ может согласовать требования.',{basis:'security-review'});
    const next=introducer?'Уточнить у участника «'+introducer.name+'», кто со стороны ИБ согласует требования.':'Уточнить у команды сделки, кто готов организовать знакомство с представителем службы ИБ.';
    item('security-review',next,agreementSource(sponsor,note),via&&personSource(introducer,introducer.contact));
  }
  const focus=lead||people[0];
  if(!items.length && focus){
    const obligation=focus.agreements?.find(a=>a.status!=='Согласовано');
    if(obligation){
      actions[focus.id]='Проверить договорённость';
      item('agreement-'+focus.id,focus.name+' — уточнить статус договорённости «'+obligation.title+'».',agreementSource(focus,obligation));
    }else{
      actions[focus.id]='Уточнить следующий шаг';
      item('step-'+focus.id,focus.name+' — обсудить следующий шаг по сделке.',personSource(focus,[focus.title,focus.stage,focus.contact].filter(Boolean).join(' · ')||focus.name));
    }
  }
  if(!people.length && !messages.length)item('empty','Введите имя или роль первого участника для сценария.',{label:'Карта сделки',detail:'В карте пока нет участников.'});

  messages.forEach((m,i)=>{
    const text=snippet(m.text);
    if(!text)return;
    const kind=intent(lower(text)), note=inputSource(m), key='message-'+(m.id||i);
    const roster=[...people,...suggestedPeople];
    const names=namedPeople(text,roster), selected=roster.find(p=>p.id===m.personId);
    const target=names[0]||selected;
    const requestedKind=analysisQuestion(lower(text));
    if(requestedKind){
      items.push({id:key,kind:requestedKind,requestedKind,personId:target?.id,text:'',sources:[note]});return;
    }
    // A second named person, or a distinct explicitly selected card, defines the endpoints.
    const other=names[1]||(names[0]&&selected?.id!==names[0].id?selected:null);
    if(kind==='add-person'){
      const [addText,linkText]=text.split(relationClause);
      const duplicate=namedPeople(addText,roster)[0];
      if(duplicate){
        item(key,duplicate.name+' уже есть в сценарии. Уточните роль или нужную связь.',note,personSource(duplicate,duplicate.title||duplicate.name));
        return;
      }
      const name=newName(addText);
      const p={...blankPerson(),id:'proposal-'+(m.id||i),name,title:'Роль требует уточнения',state:'planned',source:'Сообщение сотрудника',sim:'Предложен участник',ai:true};
      if(/лпр|принимающ.{0,12}решени/iu.test(text))p.decision=true;
      suggestedPeople.push(p);actions[p.id]='Проверить и вовлечь';
      item(key,'Вовлечь участника «'+name+'». Уточнить должность и зону ответственности.',note);
      const anchor=linkText?namedPeople(linkText,roster)[0]:selected;
      if(anchor)edge(anchor,p,'new','Уточнить возможность знакомства с новым участником.',{basis:key});
      return;
    }
    if(kind.endsWith('-edge')){
      if(!target||!other){item(key,'Уточните двух участников связи. Можно выбрать одного на карте и назвать второго в сообщении.',note);return}
      const old=edges.find(e=>e.a===target.id && e.b===other.id);
      const suggested=suggestedEdges.get([target.id,other.id].join('/'));
      if(kind==='remove-edge'&&!old&&!suggested){item(key,'Связь между '+target.name+' и '+other.name+' в текущем сценарии отсутствует.',note,personSource(target,target.name),personSource(other,other.name));return}
      const proposal=kind==='remove-edge'?'remove':old||suggested?'change':'new';
      const title={remove:'Убрать связь',change:'Изменить связь',new:'Предложить связь'}[proposal];
      const date=pickDate(text);
      edge(target,other,proposal,text,{...(date?{date}:{}),status:'Предложение',basis:key});
      item(key,title+': '+target.name+' → '+other.name+'.',note,old&&linkSource(record,graph,old));
      return;
    }
    if(!target && kind!=='note'){
      item(key,'Уточните имя участника или выберите его карточку для этого предложения.',note);return;
    }
    if(kind==='remove-person'){
      actions[target.id]='Убрать из сценария';
      const adjacent=edges.filter(e=>e.a===target.id||e.b===target.id);
      for(const e of adjacent){
        edge(roster.find(p=>p.id===e.a),roster.find(p=>p.id===e.b),'remove','Пересмотреть маршрут после исключения участника.',{basis:key});
      }
      item(key,target.name+' — убрать из сценария и проверить связи.',note,personSource(target,target.task||target.title||target.name));return;
    }
    if(kind==='contract'){
      actions[target.id]='Уточнить условия договора';
      item(key,target.name+' — согласовать условия договора и дату следующего шага.',note,personSource(target,target.stage||target.title||target.name));return;
    }
    if(kind==='contact'){
      actions[target.id]='Уточнить контакт';
      item(key,target.name+' — уточнить канал связи и договориться о следующем контакте.',note,personSource(target,target.contact||'Статус контакта не указан.'));return;
    }
    const noteAction='Уточнить следующий шаг по заметке';
    if(target)actions[target.id]=noteAction;
    item(key,'Уточнить, какое изменение предлагает сотрудник'+(target?' для '+target.name:'')+' по записи «'+text+'».',note);
  });
  return {items,people:suggestedPeople,edges:[...suggestedEdges.values()],actions};
}

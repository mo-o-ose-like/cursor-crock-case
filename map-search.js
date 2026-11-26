import {esc} from './components.js';
import {normalize} from './data.js';
import {roleName} from './participant-roles.js';
import {states} from './fields.js';
export function terms(query){
  return [...new Set(normalize(query||'').split(/\s+/).filter(Boolean))];
}
export function pieces(text,tokens){
  const original=String(text??'');
  const value=original.toLocaleLowerCase('ru').replaceAll('ё','е');
  const ranges=[];
  for(const term of tokens){
    if(!term)continue;
    let from=0,index;
    while((index=value.indexOf(term,from))!==-1){
      ranges.push([index,index+term.length]);from=index+term.length;
    }
  }
  ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
  const out=[];let pos=0;
  for(let i=0;i<ranges.length;i++){
    const start=ranges[i][0];let end=ranges[i][1];
    while(i+1<ranges.length&&ranges[i+1][0]<=end)end=Math.max(end,ranges[++i][1]);
    if(start>pos)out.push([original.slice(pos,start),false]);
    out.push([original.slice(start,end),true]);pos=end;
  }
  if(pos<original.length)out.push([original.slice(pos),false]);return out;
}
export const marked=(value,tokens)=>pieces(value,tokens).map(([s,hit])=>hit?'<mark>'+esc(s)+'</mark>':esc(s)).join('');
export function highlightPanel(panel,tokens){
  if(!tokens.length||!panel.ownerDocument)return;
  const doc=panel.ownerDocument,walker=doc.createTreeWalker(panel,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement.closest('svg,script,input,textarea,select,button:not(.section-toggle),.sim-actions,mark'))continue;
    const parts=pieces(node.data,tokens);if(!parts.some(a=>a[1]))continue;
    const frag=doc.createDocumentFragment();
    for(const [s,match] of parts){if(match){const m=doc.createElement('mark');m.textContent=s;frag.append(m)}else frag.append(doc.createTextNode(s))}
    node.replaceWith(frag);
  }
  panel.querySelectorAll('details.vote:has(mark)').forEach(el=>{el.open=true});
}

function entries(p,mode){
  const result=[];
  function entry(key,label,...values){
    const text=values.flat(Infinity).filter(s=>s!==undefined&&s!==null&&s!=='').map(String);
    if(text.length)result.push({key,label,text});
  }
  const agreementFields=p.agreements.flatMap(a=>[a.title,a.status,a.date,a.detail,a.date&&new Intl.DateTimeFormat('ru-RU',{dateStyle:'long'}).format(new Date(a.date+'T12:00:00'))]);
  entry('','Участник',p.name,p.title);
  if(mode==='org'){
    entry('','Подразделение',p.dept,p.level);entry('formal','Формальная зона ответственности',p.formal);
  }else if(mode==='influence'){
    entry('','Подразделение',p.dept);entry('','Роль на карте',p.decision?'ЛПР':'',p.primary?'Основной контакт КРОК':'');
    entry('relations','Наши отношения',p.attitude,p.contact);entry('contact','Текущий статус взаимодействия',states[p.state],p.influence,p.contact);
    entry('stage','Участие в закупке',p.task,p.stage);entry('agreements','О чём договорились',agreementFields);
  }else if(mode==='scenario'){
    entry('','Ответственность в закупке',p.task);entry('','Ситуация участника',p.attitude,p.contact,p.stage,states[p.state],p.sim);
    entry('','Изменения в сценарии',(p.changes||[]).flatMap(e=>[e.title,e.detail,e.date]));entry('agreements','О чём договорились',agreementFields);
  }else{
    entry('role','Роль Miller–Heiman',p.task,p.role,p.role&&roleName(p),p.stage,p.decision?'ЛПР':'');
    entry('relations','Отношения',p.attitude,p.contact,p.primary?'Основной контакт КРОК':'',states[p.state]);
    entry('opinions','Мнения участников',(p.opinions||[]).flatMap(o=>[o.label,...o.authors]),(p.managerOpinions||[]).flatMap(o=>[o.category,o.authorName,o.comment]));
    for(const review of p.discAssessments||[])entry('disc','DISC',review.authorName,...Object.entries(review.scores).map(([k,v])=>k+' '+v));
    if(p.disc)entry('disc','DISC',...Object.entries(p.disc).map(([k,v])=>k+' '+v));
    entry('goals','Индивидуальные цели',p.goals,p.goalHint);entry('preferences','Предпочтения',p.preferences,p.preferenceHint);
    entry('agreements','О чём договорились',agreementFields);entry('risks','Риски',p.risks);
  }
  return result;
}
export function searchPerson(p,mode,tokens){
  if(!tokens.length)return [];
  const fields=entries(p,mode);const corpus=normalize(fields.flatMap(f=>[f.label,...f.text]).join(' '));
  if(!tokens.every(w=>corpus.includes(w)))return [];
  return fields.flatMap(f=>{
    const best=f.text.map(text=>({text,score:tokens.filter(w=>normalize(text).includes(w)).length})).sort((a,b)=>b.score-a.score)[0];
    if(!best?.score&&!tokens.some(w=>normalize(f.label).includes(w)))return [];
    return [{pid:p.id,name:p.name,key:f.key,label:f.label,snippet:best?.text||f.label,score:best?.score||0}];
  }).sort((a,b)=>b.score-a.score||Number(b.label==='Участник')-Number(a.label==='Участник'));
}
export function filterPerson(p,f={}){
  return !(f.stage&&p.stage!==f.stage||f.dept&&p.dept!==f.dept||f.level&&p.level!==f.level||f.state&&p.state!==f.state);
}
export function searchHits(people,mode,query,filters){
  const tokens=terms(query);
  if(!tokens.length)return [];
  const out=[];
  for(const person of people.filter(p=>filterPerson(p,filters))){
    const seen=new Set();
    for(const target of [mode,...['process','org','influence'].filter(m=>m!==mode)]){
      if((person.ai||person.id==='what-if-new')&&target!=='scenario')continue;
      for(const h of searchPerson(person,target,tokens)){
        const signature=[h.label,h.snippet].join('|');
        if(seen.has(signature))continue;
        seen.add(signature);out.push({...h,mode:target});
      }
    }
  }
  return out.sort((a,b)=>Number(b.mode===mode)-Number(a.mode===mode)||b.score-a.score||Number(b.label==='Участник')-Number(a.label==='Участник'));

}
export function resultList(hits,query,mode,names){
  const tokens=terms(query);
  if(!hits.length)return '<p class="no-search-hits" role="status">Совпадений нет. Попробуйте другое слово или измените фильтры.</p>';
  return '<div class="hit-list">'+hits.map((h,i)=>'<button type="button" data-hit="'+i+'"><strong>'+marked(h.name,tokens)+'</strong><small>'+(h.mode===mode?'':esc(names[h.mode])+' · ')+marked(h.label,tokens)+'</small><span>'+marked(h.snippet,tokens)+'</span></button>').join('')+'</div>';
}

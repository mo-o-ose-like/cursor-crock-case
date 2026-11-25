// The optional on-device model selects a grounded next step. Its output contains only
// identifiers; displayed names, evidence and sentences come from the active deal.
const options={expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]};
export function caseForModel(record,graph,events,messages){
  const facts=[],participants=graph.people.map((p,i)=>{
    const add=(key,value,detail)=>{if(value)facts.push({owner:i,type:key,source:{label:p.name+' · карточка',detail,personId:p.id}})};
    add('decision_maker',p.decision,'Принимает решение о закупке.');
    add('main_contact',p.primary,'Основной контакт КРОК.');
    add('contact_established',p.contact==='Контакт установлен',p.contact);
    add('contact_lost',p.contact==='Связь потеряна',p.contact);
    add('participation_planned',p.state==='planned','Планируется вовлечь. '+(p.task||''));
    add('agreement_pending',p.agreements.some(a=>a.status!=='Согласовано'),p.agreements.filter(a=>a.status!=='Согласовано').map(a=>a.title).join(', '));
    return p.id;
  });
  for(const e of events){const owner=participants.indexOf(e.personId);if(owner>=0)facts.push({owner,type:'scenario_'+e.kind,source:{label:'Действие в сценарии',detail:graph.people[owner].name+' · '+(e.title||graph.people[owner].sim||e.kind),personId:e.personId}})}
  if(!record.settings.budget)facts.push({owner:null,type:'budget_missing',source:{label:'Настройки сделки',detail:'Поле «Бюджет» не заполнено.'}});
  const edges=graph.edges.map(e=>[participants.indexOf(e.a),participants.indexOf(e.b)]);
  const evidence=facts.map(({owner,type},i)=>({id:i,participant:owner,fact:type}));
  const context={participants:participants.map((_,i)=>i),facts:evidence,directedEdges:edges};
  const key=JSON.stringify([participants,context,messages.map(m=>m.id),facts.map(f=>f.source)]);
  return {key,context,participants,facts,people:[...graph.people]};
}
export async function inferProposal(input,signal){
  if(!globalThis.LanguageModel||input.participants.length<2||!input.facts.length)return null;
  let session;
  try{
    if(await LanguageModel.availability(options)!=='available'||signal.aborted)return null;
    session=await LanguageModel.create({...options,signal});
    const schema={type:'object',properties:{action:{type:'string',enum:['introduce','review','suspend']},from:{type:'integer'},to:{type:'integer'},evidence:{type:'array',items:{type:'integer'}}},required:['action','from','to','evidence']};
    const prompt='Use this simulated B2B account map to suggest ONE interaction between two distinct participants. Use introduce for a useful new introduction, review for a meaningful change to an existing directed edge, or suspend for an existing edge affected by a lost contact. Cite evidence IDs that support your choice, including at least one relevant fact about EACH person. Keep edge direction. Data: '+JSON.stringify(input.context);
    const output=JSON.parse(await session.prompt(prompt,{responseConstraint:schema,signal}));
    const {from,to,action}=output,sources=[...new Set(output.evidence)].map(i=>input.facts[i]).filter(Boolean);
    if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||!input.people[from]||!input.people[to]||![from,to].every(i=>sources.some(f=>f.owner===i)))return null;
    const exists=input.context.directedEdges.some(([a,b])=>a===from&&b===to);
    if(action==='introduce'&&exists||action!=='introduce'&&!exists)return null;
    if(action==='suspend'&&!sources.some(f=>f.type==='contact_lost'))return null;
    const a=input.people[from],b=input.people[to];
    const words={introduce:'Предложить знакомство',review:'Уточнить порядок взаимодействия',suspend:'Приостановить переход'};
    if(!words[action])return null;
    const text=words[action]+' · '+a.name+' → '+b.name+'.';
    return {id:'local-model',text,sources:sources.map(f=>f.source),edge:{a:a.id,b:b.id,kind:'process',proposal:{introduce:'new',review:'change',suspend:'remove'}[action],text},action:words[action]};
  }catch{return null}finally{session?.destroy()}
}

import {normalize} from './data.js';
import {terms} from './map-search.js';
import {roleName} from './participant-roles.js';

// A result is a person's participation in one deal, not a global identity:
// names and even person IDs can repeat across independent deal maps.
export function findParticipants(records,query){
  const tokens=terms(query);
  if(!tokens.length)return [];
  const results=[];
  for(const record of records){
    const deal=record.deal;
    const context=normalize([deal.title,deal.company].join(' '));
    for(const person of record.people){
      if(person.ai||person.id==='what-if-new')continue;
      const identity=normalize([person.name,person.title,person.dept,person.role?roleName(person):'',person.decision?'ЛПР':'',person.primary?'Основной контакт КРОК':''].join(' '));
      if(!tokens.some(t=>identity.includes(t))||!tokens.every(t=>(identity+' '+context).includes(t)))continue;
      const name=normalize(person.name||'');
      const score=tokens.filter(t=>name.includes(t)).length;
      results.push({deal,person,score});
    }
  }
  return results.sort((a,b)=>b.score-a.score||a.person.name.localeCompare(b.person.name,'ru')||a.deal.company.localeCompare(b.deal.company,'ru'));
}

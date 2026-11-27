import test from 'node:test';
import assert from 'node:assert/strict';
import {allDeals,deleteDeal,restoreDeal,dealRecord,comparisonRecords,matches,saveRecord,saveView,getView,resetNorthernCase} from '../data.js';
import {northernDeal,northernArchives} from '../northern-case.js';
import {comparison,comparisonZones,observations} from '../path-data.js';
import {scenarioBoard} from '../scenario-board.js';
import {scoreDisc} from '../observations.js';
import {knowledgeGaps} from '../knowledge-gaps.js';
import {historyFor} from '../map-history.js';

const id=northernDeal.id, record=()=>dealRecord(id);
test('one shared entry, two independent archives, personal changes and targeted reset',()=>{
 const kv=new Map();globalThis.localStorage={get length(){return kv.size},key:i=>[...kv.keys()][i],getItem:k=>kv.get(k)??null,setItem:(k,v)=>kv.set(k,v),removeItem:k=>kv.delete(k)};
 try{
   assert.equal(allDeals().filter(d=>d.trainingFamily).length,1);
   const personal={deal:{id:'custom-123',title:'Кейс пользователя',company:northernDeal.company},settings:{},people:[],edges:[]};
   saveRecord(personal); const saved=JSON.stringify(personal);
   deleteDeal(personal.deal.id);deleteDeal(id);
   assert.equal(allDeals().some(d=>d.id===personal.deal.id),false);
   assert.equal(allDeals().filter(d=>d.id===id).length,1);
   restoreDeal(personal.deal.id);assert.ok(allDeals().some(d=>d.id===personal.deal.id));
   assert.equal(matches('модернизация защиты').at(0).id,id);
   const r=record();r.people[0].name='Личная правка';saveRecord(r);
   const old=dealRecord(northernArchives[0].id);old.people=[];saveRecord(old);
   saveView(id,{mode:'scenario'});historyFor(id).undo.push({});
   assert.equal(record().people[0].name,'Личная правка');
   assert.equal(allDeals().filter(d=>d.trainingFamily).length,1);
   assert.equal(comparisonRecords(personal).some(x=>x.deal.trainingFamily),false);
   resetNorthernCase(id);assert.notEqual(record().people[0].name,'Личная правка');
   assert.ok(dealRecord(old.deal.id).people.length);assert.deepEqual(historyFor(id).undo,[]);
   assert.equal(getView(id).mode,'org');assert.equal(getView(personal.deal.id).mode,'process');assert.equal(JSON.stringify(dealRecord(personal.deal.id)),saved);
 }finally{delete globalThis.localStorage}
});
test('events, reporting and influence refer to one roster, with independently dated historical profiles',()=>{
 const r=record(), ids=new Set(r.people.map(p=>p.id)),org=r.people.filter(p=>p.modes.includes('org'));
 assert.equal(ids.size,r.people.length);assert.equal(org.length,12);
 assert.equal(org.filter(p=>p.managerId===null).length,1);
 assert.equal(r.edges.filter(e=>e.kind==='org').length,org.length-1);
 for(const e of r.edges){assert.ok(ids.has(e.a)&&ids.has(e.b));assert.ok(e.source)}
 for(const event of r.journey.events){assert.ok(event.people.every(p=>ids.has(p)));assert.ok(event.source&&event.agreement)}
 const boss=r.edges.find(e=>e.kind==='org'&&e.b==='ratnikov');
 assert.equal(boss.a,'klenov');assert.ok(r.edges.some(e=>e.kind==='influence'&&e.a==='ratnikov'&&e.b==='klenov'&&e.status==='strong'));
 const p=r.people.find(p=>p.id==='ratnikov'),disc=p.discAssessments[0];
 assert.deepEqual(scoreDisc(disc.answers),disc.scores);
 const money=r.people.find(p=>p.id==='melekhova');assert.equal(new Set(money.managerOpinions.map(e=>e.authorId)).size,2);
 for(const a of northernArchives){
   const old=dealRecord(a.id);assert.ok(old.journey.outcome);
   for(const p of old.people){assert.equal(p.name,r.people.find(q=>q.id===p.id).name);assert.ok(!p.managerOpinions&&!p.discAssessments)}
 }
 assert.ok(knowledgeGaps(r).entries.some(x=>x.personId==='markova'&&x.field==='attitude'));
});
test('two archived sources drive six evidence-linked comparisons in their own chronological order',()=>{
 const r=record(),basis=comparison(r,comparisonRecords(r),{});
 assert.equal(basis.sample.length,2);assert.equal(basis.picked.deal.id,northernArchives[0].id);
 const ev=r.journey.events,marks=new Map(ev.map(e=>[e.id,observations(e,r,basis)]));
 const z=comparisonZones(basis.baseline,ev,marks);
 for(const [key,tone] of [['need','same'],['test','positive'],['budget','risk'],['change','unknown'],['brief','unknown'],['requirements','positive'],['procurement','insufficient']]){
   assert.ok(z.now.get(key).tones.includes(tone),key);
   for(const m of marks.get(key))assert.ok(m.source.length&&m.unknown);
 }
 assert.ok(marks.get('requirements').some(m=>m.kind==='communication'&&m.source.some(x=>x.includes('ФС-08'))));
 assert.match(marks.get('budget')[0].basis,/6 млн/);
 assert.equal(marks.get('change')[0].after,'Нина Маркова');
 const edited=structuredClone(r);edited.people.find(p=>p.id==='ratnikov').preferences=[];
 assert.equal(observations(edited.journey.events.find(e=>e.id==='requirements'),edited,basis).some(m=>m.kind==='communication'),false);
});
test('two rehearsals change projections only and can both be cleared',()=>{
 const r=record(),original=structuredClone(r);
 for(const [code,seed] of Object.entries(r.practiceScenarios)){
   const v={scenario:code,histories:{[code]:structuredClone(seed.events||[])},branches:{[code]:{removed:seed.removed||[],edits:seed.edits||[],messages:[]}}};
   const g=scenarioBoard(r,v).graph;
   if(code==='contact-leaves'){assert.ok(!g.people.some(p=>p.id==='somova'));assert.ok(!g.edges.some(e=>[e.a,e.b].includes('somova')));assert.ok(g.edges.some(e=>e.a==='belaya'&&e.b==='klenov'))}
   else{assert.ok(g.people.find(p=>p.id==='melekhova').attitude!=='Сомневается');assert.ok(g.edges.some(e=>e.a==='melekhova'&&e.b==='markova'&&e.proposal==='new'))}
 }
 assert.deepEqual(r,original);assert.ok(scenarioBoard(r,{}).graph.people.some(p=>p.id==='somova'));
});

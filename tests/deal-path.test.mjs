import test from 'node:test';
import assert from 'node:assert/strict';
import {comparison,comparisonZones,eventsFor,observations,slots} from '../path-data.js';
import {exampleDeals,exampleRecord} from '../path-examples.js';
import {deals,dealRecord,saveRecord} from '../data.js';
import {createPath,pathShell} from '../deal-path.js';

const records=exampleDeals.map(d=>exampleRecord(d,{}));
const find=key=>records.find(r=>r.deal.id==='path-demo-'+key);
const baseline=(key,v={})=>comparison(find(key),records,v);
const probe=(key,id)=>observations(eventsFor(find(key)).find(e=>e.id===id),find(key),baseline(key));

test('client path uses matching direction and solution, archived outcomes include losses',()=>{
  const result=baseline('pilot');
  assert.equal(result.clientBasis,true);
  assert.deepEqual(new Set(result.sample.map(r=>r.journey.outcome)),new Set(['Выиграна','Проиграна']));
  assert.equal(result.history.length,3);
  assert.ok(result.baseline.some(e=>e.topic==='budget'));
  assert.equal(baseline('pilot',{direction:'Искусственный интеллект'}).picked.deal.id,'path-demo-model');
  assert.deepEqual(baseline('pilot',{basis:'team'}).sample.map(r=>r.deal.id),['path-demo-other']);
});

test('team-only, no comparison, and no current interactions are distinct',()=>{
  assert.equal(baseline('team').clientBasis,false);
  assert.equal(baseline('empty').baseline.length,0);
  assert.equal(eventsFor(find('start')).length,0);
  assert.ok(baseline('start').baseline.length>0);
  assert.equal(find('start').people.flatMap(p=>p.agreements).length,0);
});

test('same-day and undated events are grouped without inventing an order',()=>{
  const events=eventsFor(find('pilot'));
  const groups=slots([...events,{id:'unknown',date:''}]);
  assert.deepEqual(groups.at(-2).items.map(e=>e.id),['procurement','spec']);
  assert.equal(groups.at(-1).date,'');
  assert.equal(groups.at(-2).items.every(e=>e.status==='planned'),true);
});

test('three different observations preserve evidence, with no causal scoring',()=>{
  assert.equal(probe('pilot','test')[0].effect,'positive');
  const sponsor=probe('pilot','change')[0],budget=probe('pilot','budget')[0];
  assert.equal(sponsor.effect,'unknown');
  assert.equal(sponsor.kind,'context');
  assert.equal(sponsor.before,'Ирина Крылова');
  assert.equal(sponsor.after,'Ольга Соколова');
  assert.equal(budget.effect,'risk');
  assert.match(budget.hypothesis,/могут/);
  const communication=probe('pilot','brief')[0];
  assert.equal(communication.effect,'unknown');
  assert.match(communication.source.join(' '),/Предпочтения/);
  assert.match(communication.result,/перенесла пилот/);
  assert.match(communication.unknown,/не подтверждена/);
  const r=structuredClone(find('pilot'));
  r.people.find(p=>p.id==='technical').preferences=[];
  assert.equal(observations(r.journey.events.find(e=>e.id==='brief'),r,baseline('pilot')).some(m=>m.kind==='communication'),false);
  assert.deepEqual(probe('pilot','spec'),[]);
});

test('legacy agreements remain live after first manual entry and reopening',()=>{
  const values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const r=dealRecord('service'), p=r.people.find(x=>x.agreements.length);
  const n=eventsFor(r).length;
  r.journey={includeProfileEvents:true,events:[{id:'memo',topic:'custom',title:'Записано менеджером',status:'done',source:'Протокол'}],baseline:[]};
  saveRecord(r);
  assert.equal(eventsFor(dealRecord('service')).length,n+1);
  p.agreements[0].title='Уточнили дату по звонку';saveRecord(r);
  assert.ok(eventsFor(dealRecord('service')).some(e=>e.title==='Уточнили дату по звонку'));
  assert.ok(eventsFor(r).some(e=>e.status==='inProgress'));
  assert.equal(deals.some(d=>d.id.startsWith('path-demo-')),false);
  assert.doesNotMatch(pathShell('',r),/Выбрать демосделку/);
  delete globalThis.localStorage;
});

test('manual baseline can be reused without archives and retains event source/order',()=>{
  const r=structuredClone(find('empty'));
  r.journey.baseline=[{id:'p1',direction:r.journey.direction,title:'Осмотр',source:'Интервью'},{id:'p2',direction:r.journey.direction,title:'Смета',source:'Письмо'}];
  const result=comparison(r,[],{});
  assert.deepEqual(result.baseline.map(e=>e.title),['Осмотр','Смета']);
  assert.equal(result.baseline[1].source,'Письмо');
});

test('lane controls render events, toggle observations, switch archives and open the correct profile',()=>{
  const values=new Map(records.map(r=>['cursor.demo.record.v2.'+r.deal.id,JSON.stringify(r)]));
  globalThis.localStorage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null};
  try{
    const r=find('pilot'), v={}, board={scrollTop:0,querySelectorAll:()=>[],innerHTML:''};
    const toggle={setAttribute(){}}, root={querySelector:q=>q==='#path-board'?board:toggle};
    const picked=[];
    const ui=createPath({id:r.deal.id,root,getRecord:()=>r,getView:()=>v,saveView(){},selectPerson:(...args)=>picked.push(args),go:()=>assert.fail('Viewing a profile must not route')});
    const click=(path,params={})=>ui.handle({dataset:{path,...params}});
    ui.render();assert.match(board.innerHTML,/Обычно у клиента/);assert.match(board.innerHTML,/Сейчас наша сделка/);
    assert.match(board.innerHTML,/>\+1</);assert.doesNotMatch(board.innerHTML,/Полезное отличие/);
    click('marks');assert.match(board.innerHTML,/Полезное отличие/);click('marks');assert.doesNotMatch(board.innerHTML,/Полезное отличие/);
    click('archive',{archive:'path-demo-archive'});assert.match(board.innerHTML,/class="path-lane past"/);assert.match(board.innerHTML,/Финансирование снято/);
    click('archive',{archive:'path-demo-model'});assert.match(board.innerHTML,/Качество ответов/);
    click('hide');assert.doesNotMatch(board.innerHTML,/class="path-lane past"/);
    click('person',{person:'technical',owner:r.deal.id});click('person',{person:'finance',owner:'path-demo-model'});
    assert.deepEqual(picked,[['technical',r.deal.id],['finance','path-demo-model']]);
  }finally{delete globalThis.localStorage}
});

test('journey toolbar exposes find, people, gaps and an initially closed legend',()=>{
  const shell=pathShell('',find('pilot'));
  for(const action of ['filters','history','marks','roster','gaps','legend']){
    assert.ok(shell.includes('data-path="'+action+'"'));
  }
  assert.match(shell,/type="search" id="path-search"/);
  assert.match(shell,/id="path-legend"[^>]* hidden/);
  assert.doesNotMatch(shell,/Действия со сделкой|data-path="menu"/);
});

test('a missing preference or an uninvolved person does not trigger communication analysis',()=>{
  const record=structuredClone(find('pilot'));
  const event=record.journey.events.find(e=>e.id==='brief');
  event.people=['manager'];
  assert.equal(observations(event,record,baseline('pilot')).some(m=>m.kind==='communication'),false);
  const sponsor=record.journey.events.find(e=>e.id==='change');
  delete sponsor.sponsorChange.before;
  const observation=observations(sponsor,record,baseline('pilot'))[0];
  assert.equal(observation.before,undefined);
  assert.equal(observation.effect,'unknown');
});

test('two lanes share a comparison only for an unambiguous topic, independent of chronology',()=>{
  const r=find('pilot'),ref=baseline('pilot').baseline,current=eventsFor(r);
  const notes=new Map(current.map(e=>[e.id,probe('pilot',e.id)]));
  const z=comparisonZones(ref,current,notes);
  assert.equal(z.base.get('test'),z.now.get('test'));
  assert.equal(z.base.get('test').now.title,'Тест на стенде');
  assert.deepEqual(z.base.get('need').tones,['same']);
  assert.deepEqual(z.now.get('budget').tones,['risk']);
  assert.deepEqual(z.now.get('brief').tones,['unknown','insufficient']);
  assert.equal(z.now.get('brief').observations.length,2);
  assert.deepEqual(z.now.get('spec').tones,['insufficient']);
  assert.equal(z.base.get('contract').now,null);
  for(const topic of ['transition','other','']){
    const step={topic,status:'done',id:'x'};
    assert.ok(!comparisonZones([step],[step],new Map()).now.get('x').base);
  }
  const duplicate=comparisonZones(ref,[...current,{...current[0],id:'second-need'}],notes);
  assert.equal(duplicate.base.get('need').now,null);
  assert.ok(!duplicate.now.get('need').base);
});

test('participants in any lane select a scoped profile without touching history or filters',()=>{
  const values=new Map(records.map(r=>['cursor.demo.record.v2.'+r.deal.id,JSON.stringify(r)]));
  globalThis.localStorage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null};
  try{
    const r=find('archive');
    const v={archiveId:'path-demo-gateway',basis:'client',direction:r.journey.direction,showMarks:true};
    const board={scrollTop:74,querySelectorAll:()=>[],innerHTML:''};
    const toggle={setAttribute(){}},root={querySelector:q=>q==='#path-board'?board:toggle};
    const selections=[];
    const ui=createPath({id:r.deal.id,root,getRecord:()=>r,getView:()=>v,saveView(){},go:()=>assert.fail('Unexpected navigation'),selectPerson:(pid,owner)=>selections.push([pid,owner])});
    ui.render();
    const before=board.innerHTML,view=structuredClone(v);
    for(const owner of ['path-demo-gateway',r.deal.id,'path-demo-gateway']){
      ui.handle({dataset:{path:'person',person:'procurement',owner}});
    }
    assert.deepEqual(selections.map(x=>x[1]),['path-demo-gateway','path-demo-archive','path-demo-gateway']);
    assert.equal(board.innerHTML,before);assert.equal(board.scrollTop,74);
    assert.deepEqual(v,view);assert.match(before,/Финансирование снято/);
  }finally{delete globalThis.localStorage}
});

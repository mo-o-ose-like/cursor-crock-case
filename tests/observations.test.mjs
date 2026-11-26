import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreDisc, applyObservation, discSection, opinionSection} from '../observations.js';
import {sampleNetwork} from '../sample-network.js';
import {dealRecord, saveRecord} from '../data.js';
import {recordDiff, applyRecordDiff} from '../map-history.js';
import {inspector} from '../person-panel.js';

const answers={decision:'2',result:'1',discussion:'unknown',involve:'0',sequence:'1',continuity:'1',evidence:'2',criteria:'2'};
const timestamp='2026-11-26T12:00:00.000Z';
function review(id,author,values){
  return {id,authorId:author,authorName:author,createdAt:timestamp,updatedAt:timestamp,...values};
}
function change(collection,previous,next,writer){
  return {collection,previous,next,writer};
}

test('DISC uses only observed answers and requires evidence for each axis',()=>{
  assert.deepEqual(scoreDisc(answers),{D:75,I:0,S:50,C:100});
  assert.throws(()=>scoreDisc({...answers,involve:'unknown'}),/шкалы I/);
  assert.throws(()=>scoreDisc({...answers,result:''}),/Ответьте/);
});

test('process reviews stay with the deal on reopen, keep legacy examples and enforce ownership',()=>{
  const values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const record=dealRecord('service');
  const p=record.people.find(p=>p.id==='technical');
  const original=structuredClone({disc:p.disc,opinions:p.opinions,attitude:p.attitude});
  const a=review('a','Автор А',{category:'Компетентный',comment:'Запросил спецификацию'});
  const b=review('b','Автор Б',{category:'Компетентный',comment:'Привёл пример'});
  const rating=review('r','Автор А',{answers,scores:scoreDisc(answers)});
  applyObservation(p,change('managerOpinions',undefined,a,a.authorId));
  applyObservation(p,change('managerOpinions',undefined,b,b.authorId));
  applyObservation(p,change('discAssessments',undefined,rating,rating.authorId));
  saveRecord(record);
  const reopened=dealRecord('service');
  const person=reopened.people.find(x=>x.id===p.id);
  const revision={...a,category:'Открыт к диалогу',comment:'Предложил обсудить пилот'};
  assert.throws(()=>applyObservation(person,change('managerOpinions',a,revision,b.authorId)));
  applyObservation(person,change('managerOpinions',a,revision,a.authorId));
  assert.throws(()=>applyObservation(person,change('managerOpinions',a,revision,a.authorId)));
  const updatedAnswers={...answers,decision:'0'};
  const newRating={...rating,answers:updatedAnswers,scores:scoreDisc(updatedAnswers)};
  applyObservation(person,change('discAssessments',rating,newRating,rating.authorId));
  saveRecord(reopened);
  const after=dealRecord('service').people.find(x=>x.id===p.id);
  assert.deepEqual(after.managerOpinions,[revision,b]);
  assert.equal(after.discAssessments[0].scores.D,25);
  assert.match(discSection(after),/Предварительная оценка по наблюдениям/);
  assert.match(opinionSection(after),/Демонстрационный пример/);
  applyObservation(after,change('discAssessments',newRating,null,rating.authorId));
  assert.deepEqual(after.discAssessments,[]);
  assert.deepEqual({disc:after.disc,opinions:after.opinions,attitude:after.attitude},original);
  for(const mode of ['org','influence','scenario'])assert.doesNotMatch(inspector(after,mode,{sections:{[p.id]:['opinions','disc']}}),/data-observation/);
});

test('undoing the first opinion leaves another author’s newer entry intact',()=>{
  const start=sampleNetwork({id:'service'});
  const next=structuredClone(start), other=structuredClone(start);
  const a=review('a','Менеджер А',{category:'Осторожный',comment:''});
  const b=review('b','Менеджер Б',{category:'Другое',comment:'Наблюдение'});
  applyObservation(next.people[0],change('managerOpinions',undefined,a,a.authorId));
  applyObservation(other.people[0],change('managerOpinions',undefined,b,b.authorId));
  const patch=recordDiff(start,next);
  const merged=applyRecordDiff(other,patch);
  assert.deepEqual(new Set(merged.people[0].managerOpinions.map(item=>item.id)),new Set(['a','b']));
  assert.deepEqual(applyRecordDiff(merged,patch,true).people[0].managerOpinions,[b]);
});

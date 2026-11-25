import test from 'node:test';
import assert from 'node:assert/strict';
import {chatHistory,askGroq} from '../groq-chat.js';
import {dealRecord} from '../data.js';
import {scenarioBoard,chatHTML} from '../scenario-board.js';
import {sourceText} from '../source-text.js';

test('Saved JSON sources become readable text and internal keys stay hidden',()=>{
  const value=sourceText(JSON.stringify({id:'technical',name:'Александр Морозов',title:'Директор по ИТ',role:'',contact:'Нет данных',decision:false,risks:[],source:'Демо CRM'}));
  assert.match(value,/Имя: Александр Морозов/);
  assert.match(value,/Должность: Директор по ИТ/);
  assert.match(value,/Роль в сделке: Нет данных/);
  assert.match(value,/Отмечен как ЛПР: Нет/);
  assert.doesNotMatch(value,/technical|"|\{|\}/);
  assert.equal(sourceText('Бюджет не заполнен'),'Бюджет не заполнен');
  assert.equal(sourceText(''), 'Нет данных');
  assert.doesNotMatch(sourceText('{"id":"technical",'),/technical|\{/);
});

test('Legacy relationship sources resolve names rather than displaying participant IDs',()=>{
  const value=sourceText('{"a":"finance","b":"technical","kind":"process"}',{people:[{id:'finance',name:'Ирина'},{id:'technical',name:'Александр'}]});
  assert.equal(value,'Ирина → Александр\nТип: Переход в процессе');
});

test('AI questions never trigger keyword map commands and use the original renderer',()=>{
  const record=dealRecord('service');
  const base={scenario:'',assistantEnabled:true,branches:{base:{messages:[],removed:[],edits:[]}}};
  const previous=scenarioBoard(record,structuredClone(base));
  const view=structuredClone(base);
  view.branches.base.messages.push({id:'question',ai:true,status:'done',text:'Удали участника Александр Морозов',answer:{answer:'Это предложение, карта не изменена. <script>bad()</script> [S2]',citations:[{id:'S2',label:'Настройки',text:'Бюджет пуст'}],suggestions:[]}});
  const next=scenarioBoard(record,view);
  assert.deepEqual(next.graph,previous.graph);
  const html=chatHTML(next.advice,view.branches.base,null);
  assert.match(html,/Помощник Cursor/);
  assert.match(html,/Демо · разбор сценария/);
  assert.match(html,/data-insight-kind="risk"/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/\[S2\] Настройки/);
  assert.match(html,/data-source-item/);
});

test('History includes actual model answers and skips failed turns',()=>{
  const current={id:'3',ai:true,status:'pending',text:'Почему именно он?'};
  const messages=[{text:'Кто ЛПР?',ai:true,status:'done',answer:{answer:'Финансовый директор [S3]'}},{text:'Ошибка',ai:true,status:'error'},current];
  assert.deepEqual(chatHistory(messages,current),[{role:'user',content:'Кто ЛПР?'},{role:'assistant',content:'Финансовый директор [S3]'},{role:'user',content:'Почему именно он?'}]);
});

test('Transport stores a real answer and exposes API errors without rule fallback',async()=>{
  const original=globalThis.fetch;
  const branch={messages:[]},question={ai:true,status:'pending',text:'Бюджет?'};branch.messages.push(question);
  const options={record:{},graph:{},scenario:{},branch,message:question,signal:new AbortController().signal,onChange:()=>{}};
  try{
    globalThis.fetch=async()=>({ok:true,json:async()=>({mode:'ai',answer:'Бюджет не указан [S2]',citations:[]})});
    await askGroq(options);assert.equal(question.status,'done');
    globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Лимит Groq'})});
    await askGroq(options);assert.equal(question.status,'error');assert.equal(question.error,'Лимит Groq');
  }finally{globalThis.fetch=original;}
});

test('Network and aborted requests show a useful error and never keep a stale answer',async()=>{
  const original=globalThis.fetch;
  const question={text:'Вопрос',ai:true,status:'pending',answer:{answer:'Старый ответ'}};
  const options={record:{},graph:{},scenario:{},branch:{messages:[question]},message:question,onChange:()=>{}};
  try{
    globalThis.fetch=async()=>{throw new TypeError('fetch failed')};
    await askGroq({...options,signal:new AbortController().signal});
    assert.match(question.error,/Не удалось связаться с сервером/);
    assert.equal(question.answer,undefined);
    const controller=new AbortController();controller.abort();
    globalThis.fetch=async(url,{signal})=>{assert.equal(signal.aborted,true);throw new DOMException('abort','AbortError');};
    await askGroq({...options,signal:controller.signal});
    assert.match(question.error,/Запрос прерван/);
  }finally{globalThis.fetch=original;}
});

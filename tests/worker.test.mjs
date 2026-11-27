import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createWorker} from '../worker/index.js';
import {makeSources,selectSources,preparePrompt,validateAnswer} from '../worker/chat.js';

const policy = JSON.parse(readFileSync(new URL('../chat-policy.json',import.meta.url)));
const record = {deal:{id:'private-deal',title:'Учебная сделка'},settings:{budget:''}};
const graph = {people:[{id:'technical',name:'Александр Морозов',title:'Директор по ИТ',role:'',agreements:[]}],edges:[]};
const body = () => ({record,graph,messages:[{role:'user',content:'Какой бюджет сделки?'}]});
const request = (data = body(), headers = {}) => new Request('https://example.chatgpt.site/api/chat',{
  method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.chatgpt.site','oai-authenticated-user-id':'test-user',...headers},body:JSON.stringify(data),
});
const env = {AI_API_KEY:'dummy-not-a-real-key',AI_MODEL:'openai/gpt-oss-120b'};
const result = () => new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'Бюджет не указан [S2]',citations:['S2'],suggestions:[]})}}]}));

test('Worker serves exact assets, hides files and does not disclose its key',async()=>{
  const assets = {'/index.html':{data:Buffer.from('<main>Original</main>').toString('base64'),type:'text/html'}};
  const worker = createWorker({assets,policy});
  assert.equal(await (await worker.fetch(new Request('https://example.chatgpt.site/'),env)).text(),'<main>Original</main>');
  for (const path of ['/.env','/server.py','/.git/config','/scripts/build-sites.mjs']) assert.equal((await worker.fetch(new Request('https://example.chatgpt.site'+path),env)).status,404);
  const status = await worker.fetch(new Request('https://example.chatgpt.site/api/status'),env);
  assert.deepEqual(await status.json(),{mode:'ai'});
  assert.equal((await worker.fetch(new Request('https://example.chatgpt.site/api/chat'),env)).status,405);
});

test('Shared API key requires Sites sign-in and rejects foreign origins',async()=>{
  let calls=0;
  const worker = createWorker({assets:{},policy,fetchImpl:async()=>{calls++;return result();}});
  const anonymous=request();anonymous.headers.delete('oai-authenticated-user-id');
  assert.equal((await worker.fetch(anonymous,env)).status,401);
  assert.equal((await worker.fetch(request(body(),{Origin:'https://malicious.example'}),env)).status,403);
  assert.equal((await worker.fetch(request(),{})).status,503);
  assert.equal(calls,0);
});

test('Successful request preserves the chat protocol, readable sources and secret boundary',async()=>{
  let sent;
  const worker = createWorker({assets:{},policy,fetchImpl:async(url,options)=>{sent={url,options};return result();}});
  const response=await worker.fetch(request(),env);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.mode,'ai');
  assert.equal(data.citations[0].text,'Бюджет: Нет данных');
  assert.equal(data.citations[0].id,'S2');
  assert(!JSON.stringify(data).includes(env.AI_API_KEY));
  assert.equal(sent.url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.options.headers.Authorization,'Bearer '+env.AI_API_KEY);
  assert.equal(sent.options.redirect,'manual');
  const payload=JSON.parse(sent.options.body);
  assert.equal(payload.reasoning_effort,'low');
  assert(!JSON.stringify(payload).includes('technical'));
  assert(!JSON.stringify(payload).includes('private-deal'));
});

test('Invalid graph, malformed JSON and streamed oversize bodies never call Groq',async()=>{
  let calls=0;
  const worker = createWorker({assets:{},policy,fetchImpl:async()=>{calls++;return result();}});
  assert.equal((await worker.fetch(request({...body(),graph:{people:[],edges:[{a:'absent',b:'missing'}]}}),env)).status,400);
  const invalid=request();
  const headers=invalid.headers;
  assert.equal((await worker.fetch(new Request(invalid.url,{method:'POST',headers,body:'{' }),env)).status,400);
  assert.equal((await worker.fetch(new Request(invalid.url,{method:'POST',headers,body:'x'.repeat(1500001)}),env)).status,413);
  assert.equal(calls,0);
});

test('Provider rate limits, malformed answers, network failures and timeouts are explicit',async()=>{
  for (const [expected,fetchImpl] of [
    [429,async()=>new Response('private upstream diagnostics',{status:429})],
    [502,async()=>new Response('{')],
    [502,async()=>{throw new TypeError('private network diagnostics');}],
    [504,async()=>{throw new DOMException('timeout','AbortError');}],
    [502,async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'Выдумка [S999]',citations:['S999'],suggestions:[]})}}]}))],
  ]) {
    const worker=createWorker({assets:{},policy,fetchImpl});
    const response=await worker.fetch(request(),env);
    assert.equal(response.status,expected);
    const text=await response.text();
    assert(!text.includes('private'));
    assert(!text.includes(env.AI_API_KEY));
  }
});

test('Citation checking includes suggestions and rejects unfinished output',()=>{
  const sources=makeSources(record,graph,null,policy);
  assert.throws(()=>validateAnswer({message:{content:JSON.stringify({answer:'План',citations:['S1'],suggestions:['Шаг [S999]']})}},sources,3));
  assert.throws(()=>validateAnswer({finish_reason:'length'},sources,3));
});

test('Context budget retains the current question and prioritizes selected and inflected names',()=>{
  const rows=makeSources(record,graph,null,policy);
  assert.equal(selectSources(rows,'Уточнить у Морозова',null)[2].personId,'technical');
  const messages=[{role:'user',content:'история '.repeat(2000)},{role:'assistant',content:'ответ '.repeat(2000)},...body().messages];
  const prompt=preparePrompt(messages,rows,{selected:'technical',totalSources:30},policy.system);
  assert.deepEqual(prompt.messages.at(-1),body().messages[0]);
  assert(!JSON.stringify(prompt.messages).includes('technical'));
  assert(prompt.messages.reduce((sum,m)=>sum+Buffer.byteLength(m.content)/2+12,0)<=5400);
});

test('Python and Worker produce matching sources and selection for the same deal',()=>{
  const dataset=JSON.parse(readFileSync(new URL('../datasets/sales-lab.json',import.meta.url)));
  const sample=dataset.records[0];
  const scenario={label:'Свой сценарий',events:[{personId:sample.people[0].id,kind:'lost',title:'Тест',date:'2026-11-26'}]};
  const python=spawnSync('python3',['-c','import json,sys,server; x=json.load(sys.stdin); rows=server.make_sources(x["record"],x["record"],x["scenario"]); print(json.dumps({"rows":rows,"selected":server.select_sources(rows,"Какой бюджет?",None)},ensure_ascii=False))'],{
    cwd:new URL('../',import.meta.url),input:JSON.stringify({record:sample,scenario}),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},
  });
  assert.equal(python.status,0,python.stderr);
  const expected=JSON.parse(python.stdout);
  const rows=makeSources(sample,sample,scenario,policy);
  assert.deepEqual(rows,expected.rows);
  assert.deepEqual(selectSources(rows,'Какой бюджет?',null),expected.selected);
});

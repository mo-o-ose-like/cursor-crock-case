// Web-standard APIs only: this code runs in the Sites Cloudflare Worker.
const encoder = new TextEncoder();
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cut = (value, limit = 3000) => String(value ?? '').slice(0, limit);
let active = 0; // Per isolate, not a global/distributed rate limit.

class ChatError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const jsonResponse = (status, data) => new Response(JSON.stringify(data), {
  status, headers: {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'},
});

export function validateBody(body) {
  if (!isObject(body) || !isObject(body.record) || !isObject(body.graph)) throw new ChatError(400, 'Нужны данные текущей сделки.');
  const {record, graph, messages, scenario} = body;
  if (!isObject(record.deal ?? {}) || !isObject(record.settings ?? {})) throw new ChatError(400, 'Некорректная карточка сделки.');
  if (!Array.isArray(graph.people) || graph.people.length > 500 || !Array.isArray(graph.edges) || graph.edges.length > 3000) throw new ChatError(400, 'Допустимо до 500 участников и 3000 связей.');
  const ids = new Set();
  for (const p of graph.people) {
    if (!isObject(p) || typeof p.id !== 'string' || ids.has(p.id)) throw new ChatError(400, 'Участникам нужны уникальные строковые ID.');
    ids.add(p.id);
    if (!Array.isArray(p.agreements ?? []) || (p.agreements ?? []).some(a => !isObject(a))) throw new ChatError(400, 'Некорректные договорённости.');
  }
  if (graph.edges.some(e => !isObject(e) || !ids.has(e.a) || !ids.has(e.b))) throw new ChatError(400, 'Связь ссылается на отсутствующего участника.');
  if (!Array.isArray(record.documents ?? []) || (record.documents ?? []).length > 1000 || (record.documents ?? []).some(d => !isObject(d))) throw new ChatError(400, 'Некорректные документы.');
  if (scenario != null && (!isObject(scenario) || !Array.isArray(scenario.events ?? []) || (scenario.events ?? []).some(e => !isObject(e)))) throw new ChatError(400, 'Некорректный сценарий.');
  if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.some(m => !isObject(m) || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.length || m.content.length > 12000)) throw new ChatError(400, 'Некорректная история сообщений.');
  if (messages.at(-1).role !== 'user' || messages.at(-1).content.length > 4000) throw new ChatError(400, 'Последним должен быть вопрос до 4000 символов.');
  return body;
}

function readableFields(data, policy, labels = policy.labels) {
  return Object.entries(labels).filter(([key]) => Object.hasOwn(data, key)).map(([key, label]) => {
    let value = data[key];
    if (typeof value === 'boolean') value = value ? 'Да' : 'Нет';
    else if (Array.isArray(value)) value = value.filter(v => ['string','number'].includes(typeof v)).map(v => cut(v, 500)).join('; ') || 'Нет данных';
    else if (value == null || typeof value === 'object') value = 'Нет данных';
    else value = policy.values[String(value)] || String(value).trim() || 'Нет данных';
    return `${label}: ${value}`;
  }).join('\n') || 'Нет данных';
}

export function makeSources(record, graph, scenario, policy) {
  const rows = [];
  const add = (label, text, personId = null) => rows.push({id:`S${rows.length+1}`, label, text:cut(text), personId});
  add('Карточка сделки', readableFields(record.deal ?? {}, policy));
  add('Настройки сделки', readableFields(record.settings ?? {}, policy));
  const names = new Map(graph.people.map(p => [p.id, p.name || 'Участник без имени']));
  const labels = {name:'Имя', title:'Должность', ...Object.fromEntries(Object.entries(policy.labels).filter(([k]) => !['name','title'].includes(k)))};
  for (const p of graph.people) {
    add(`${names.get(p.id)} · карточка`, readableFields(p, policy, labels), p.id);
    for (const a of p.agreements ?? []) add(`${names.get(p.id)} · договорённость`, readableFields(a, policy), p.id);
  }
  for (const e of graph.edges) {
    const kind = {org:'Подчинение', process:'Переход в процессе', influence:'Влияние'}[e.kind] || 'Связь';
    const strength = {strong:'Подтверждённая', limited:'Ограниченная', assumed:'Предполагаемая'}[e.strength] || 'Не указана';
    add('Связь участников', `${names.get(e.a)} → ${names.get(e.b)}\nТип: ${kind}\nХарактер связи: ${strength}\n` + readableFields(e, policy, {text:'Описание',date:'Дата',status:'Статус'}), e.a);
  }
  for (const doc of record.documents ?? []) add(cut(doc.title, 160), readableFields(doc, policy), doc.personId ?? null);
  if (scenario) {
    const kinds = {lost:'Потеря контакта',better:'Улучшение отношений',worse:'Ухудшение отношений',contract:'Заключение договора'};
    const events = (scenario.events ?? []).map(e => `${names.get(e.personId) || 'Участник не указан'}: ${kinds[e.kind] || 'Изменение сценария'}\n` + readableFields(e, policy));
    add('Изменения What if — гипотетические', events.join('\n') || 'Отдельных событий не задано. Сценарий: ' + (scenario.label || 'Свой сценарий'));
  }
  return rows;
}

export function selectSources(rows, question, selected) {
  const tokens = new Set(question.toLowerCase().replaceAll('ё','е').match(/[а-яa-z0-9]{3,}/g) ?? []);
  for (const token of [...tokens]) if (token.length > 5) tokens.add(token.replace(/(?:ами|ями|ого|ему|ом|ем|ой|ей|а|я|у|ю|ы|и)$/u, ''));
  const score = row => {
    const text = (row.label+' '+row.text).toLowerCase().replaceAll('ё','е');
    return [...tokens].filter(t => text.includes(t)).length + (selected && row.personId === selected ? 20 : 0) + (row.label.includes('What if') ? 5 : 0);
  };
  const result = rows.slice(0,2);
  let size = result.reduce((sum,r) => sum+r.text.length,0);
  for (const row of rows.slice(2).sort((a,b) => score(b)-score(a))) {
    if (size+row.text.length > 10000) continue;
    result.push(row); size += row.text.length;
    if (result.length >= 30) break;
  }
  return result;
}

export function preparePrompt(messages, sources, metadata, system) {
  const history = messages.map(m => ({...m}));
  const evidence = [...sources];
  const {selected, ...publicMetadata} = metadata;
  const build = () => [
    {role:'system',content:system},
    {role:'user',content:'EVIDENCE\n'+JSON.stringify({metadata:publicMetadata,sources:evidence.map(({personId, ...s}) => s)})},
    ...history,
  ];
  const estimate = () => build().reduce((sum,m) => sum+encoder.encode(m.content).length/2+12,0);
  while (estimate()>5400 && history.length>5) history.shift();
  while (estimate()>5400 && evidence.length>2) evidence.pop();
  while (estimate()>5400 && history.length>1) history.shift();
  publicMetadata.partialContext = evidence.length < (metadata.totalSources ?? sources.length);
  if (estimate()>5400) throw new ChatError(400,'Слишком большой вопрос или карточка сделки. Сократите запрос.');
  return {messages:build(), sources:evidence};
}

export function validateAnswer(choice, sources, total) {
  if (choice?.finish_reason === 'length') throw new ChatError(502,'Ответ модели не завершён. Сформулируйте более узкий вопрос.');
  let result;
  try { result = JSON.parse(choice?.message?.content); } catch { throw new ChatError(502,'Модель вернула некорректный ответ. Повторите вопрос.'); }
  const allowed = new Map(sources.map(s => [s.id,s]));
  if (!isObject(result) || typeof result.answer !== 'string' || !result.answer.length || result.answer.length>12000 || !Array.isArray(result.citations) || result.citations.some(c => typeof c !== 'string' || !allowed.has(c)) || !Array.isArray(result.suggestions ?? []) || (result.suggestions ?? []).some(s => typeof s !== 'string')) throw new ChatError(502,'Не удалось проверить ответ и источники модели. Повторите вопрос.');
  const steps = result.suggestions ?? [];
  const inline = [...(result.answer+'\n'+steps.join('\n')).matchAll(/\[(S\d+)\]/g)].map(m => m[1]);
  if (inline.some(id => !result.citations.includes(id))) throw new ChatError(502,'Ссылки в ответе не совпадают с источниками. Повторите вопрос.');
  return {answer:result.answer,citations:[...new Set(result.citations)].map(id => allowed.get(id)),suggestions:steps.slice(0,3),mode:'ai',coverage:{used:sources.length,total}};
}

async function readJsonLimited(message, limit, status) {
  const declared = message.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared)>limit)) throw new ChatError(status,'Превышен допустимый размер данных.');
  const reader = message.body?.getReader();
  if (!reader) throw new ChatError(status===413?400:status,'Ожидаются JSON-данные.');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {value,done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size>limit) { await reader.cancel(); throw new ChatError(status,'Превышен допустимый размер данных.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset=0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ChatError(status===413?400:status,'Не удалось прочитать JSON-данные.'); }
}

export async function handleChat(request, env, policy, fetchImpl = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return jsonResponse(403,{error:'Недопустимый источник запроса.'});
  // Sites supplies identity after platform sign-in. Public visitors cannot spend the shared key by default.
  if (env.AI_REQUIRE_AUTH !== 'false' && !request.headers.get('oai-authenticated-user-id')) return jsonResponse(401,{error:'Для работы помощника войдите через ChatGPT. Владелец сайта должен настроить доступ команды в Sites.'});
  if (!env.AI_API_KEY) return jsonResponse(503,{error:'Владелец сайта ещё не настроил ключ Groq.'});
  if (active>=3) return jsonResponse(429,{error:'Помощник занят. Повторите вопрос через минуту.'});
  active++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),55000);
  try {
    const body = validateBody(await readJsonLimited(request,1500000,413));
    const all = makeSources(body.record,body.graph,body.scenario,policy);
    const query = body.messages.slice(-5).filter(m => m.role==='user').map(m => m.content).join(' ');
    const selected = selectSources(all,query,body.selected);
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const prompt = preparePrompt(body.messages,selected,{today,provenance:body.record.provenance || 'Сведения пользователя; демонстрационные источники вымышлены',totalSources:all.length},policy.system);
    const base = env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
    if (base.replace(/\/$/,'') !== 'https://api.groq.com/openai/v1') throw new ChatError(503,'Настройте AI_BASE_URL=https://api.groq.com/openai/v1.');
    const model = env.AI_MODEL || 'openai/gpt-oss-120b';
    const payload = {model,messages:prompt.messages,response_format:{type:'json_object'},max_completion_tokens:1600};
    if (model.startsWith('openai/gpt-oss-')) Object.assign(payload,{reasoning_effort:'low',include_reasoning:false});
    const upstream = await fetchImpl(base.replace(/\/$/,'')+'/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'CursorMVP/0.1','Authorization':'Bearer '+env.AI_API_KEY},
      // Workers supports manual/follow only. Never forward the shared key to
      // a redirect destination; handle any non-2xx response below instead.
      body:JSON.stringify(payload),signal:controller.signal,redirect:'manual',
    });
    if (!upstream.ok) {
      let detail;
      try{detail=await upstream.json()}catch{}
      console.warn('groq_upstream_error',JSON.stringify({status:upstream.status,code:detail?.error?.code,type:detail?.error?.type,message:String(detail?.error?.message||'').replaceAll(env.AI_API_KEY,'[redacted]').slice(0,350)}));
      const errors = {401:'Groq не принял ключ. Владелец сайта должен проверить настройки.',403:'Groq запретил доступ. Проверьте доступность сервиса и разрешения аккаунта.',404:'Модель не найдена. Проверьте AI_MODEL.',429:'Достигнут лимит Groq. Повторите запрос позже.'};
      throw new ChatError(upstream.status===429?429:502,errors[upstream.status] || 'Groq временно недоступен. Повторите вопрос позже.');
    }
    const data = await readJsonLimited(upstream,200000,502);
    return jsonResponse(200,validateAnswer(data.choices?.[0],prompt.sources,all.length));
  } catch (error) {
    if (error instanceof ChatError) return jsonResponse(error.status,{error:error.message});
    const timedOut = controller.signal.aborted || error?.name==='AbortError';
    return jsonResponse(timedOut?504:502,{error:timedOut?'Модель не ответила вовремя. Повторите запрос.':'Не удалось связаться с Groq. Повторите вопрос позже.'});
  } finally { clearTimeout(timer); active--; }
}

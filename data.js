import {historyFor} from './map-history.js';
import {northernDeal,northernArchives,northernRecord} from './northern-case.js';
import {exampleDeals,exampleRecord} from './path-examples.js';
import {sampleNetwork,stages} from './sample-network.js';
import {defenseDeal,defenseRecord} from './defense-demo.js';
// Local fixtures. All people, companies and map details are illustrative.
export const deals = [
  ...(globalThis.__CURSOR_PATH_PREVIEW__ === true ? exampleDeals : []),
  northernDeal,
  defenseDeal,
  {id:'service',title:'Автоматизация сервис-деска',company:'АО Северный Вектор',participant:'Александр Морозов',position:'Директор по ИТ',role:'Технический эксперт',tags:['Поддерживает','ИТ-департамент'],agreement:'Согласовать технические требования',notes:'Предпочитает письменные спецификации',stage:'Техническая оценка'},
  {id:'network',title:'Модернизация сети филиалов',company:'ГК ПромАльянс',participant:'Елена Фёдорова',position:'Руководитель эксплуатации',role:'Основной контакт КРОК',tags:['Инфраструктура','Филиалы'],agreement:'Подготовить перечень площадок',notes:'Миграция по выходным',stage:'Переговоры'},
  {id:'soc',title:'Центр мониторинга ИБ',company:'ООО Нева Энерго',participant:'Олег Пахомов',position:'Директор по информационной безопасности',role:'Технический эксперт',tags:['Безопасность','ИБ'],agreement:'Провести демонстрацию SOC',notes:'Уточнить требования службы ИБ',stage:'Техническая оценка'},
  {id:'vdi',title:'Импортозамещение VDI',company:'АО ТрансЛогистика',participant:'Дмитрий Ковалёв',position:'Руководитель разработки',role:'Пользователь',tags:['Виртуализация','Рабочие места'],agreement:'Запустить пилот виртуальных рабочих мест',notes:'Нужна совместимость с Linux',stage:'Техническая оценка'},
  {id:'data',title:'Платформа управления данными',company:'Группа компаний Фортис',participant:'Ирина Крылова',position:'Финансовый директор',role:'ЛПР',tags:['Аналитика','Бюджет'],agreement:'Согласовать бюджетный диапазон',notes:'Ожидает расчёт экономического эффекта',stage:'Согласование бюджета'},
  {id:'workspace',title:'Единое рабочее пространство',company:'ООО Балтийские Системы',participant:'Ольга Соколова',position:'Руководитель бизнес-юнита',role:'Пользователь',tags:['Совместная работа','Интранет'],agreement:'Собрать комментарии сотрудников',notes:'Нужен доступ с телефона',stage:'Знакомство и выявление потребностей'},
  {id:'contact',title:'Миграция контакт-центра',company:'АО Городские Коммуникации',participant:'Павел Иванов',position:'Руководитель закупок',role:'Закупщик',tags:['Телефония','Интеграция'],agreement:'Назначить следующую встречу',notes:'Важна непрерывность обслуживания',stage:'Финальное согласование'},
  {id:'analytics',title:'Аналитика производственных данных',company:'Индустриальная группа Маяк',participant:'Сергей Кузнецов',position:'Директор по производству',role:'Экономический покупатель',tags:['Производство','Отчётность'],agreement:'Предоставить пример отчёта',notes:'Фокус на качестве производственной линии',stage:'Переговоры'}
];
export const normalize=s=>s.toLocaleLowerCase('ru').replaceAll('ё','е').trim();

const recordPrefix = 'cursor.demo.record.v2.';
const viewPrefix = 'cursor.demo.view.v2.';
const recentKey = 'cursor.demo.recent.v1';
const memory = new Map();
function read(key, fallback=null) {
  if(memory.has(key))return memory.get(key);
  try { const raw=localStorage.getItem(key); return raw===null ? fallback : JSON.parse(raw); }
  catch { return memory.get(key)??fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(key,JSON.stringify(value)); memory.delete(key); }
  catch { memory.set(key,value); window.dispatchEvent(new Event('cursor-storage-limited')); }
}
export function allDeals() {
  const keys=new Set(memory.keys());
  try { for(let i=0;i<localStorage.length;i++) keys.add(localStorage.key(i)); } catch {}
  const extra=[];
  for(const key of keys) {
    if(!key?.startsWith(recordPrefix)) continue;
    const d=read(key)?.deal;
    if(d && !northernArchives.some(seed=>seed.id===d.id) && !deals.some(seed=>seed.id===d.id)) extra.push(d);
  }
  return [northernDeal,...extra.sort((a,b)=>b.created-a.created),...deals.filter(d=>d.id!==northernDeal.id)];
}
export function dealRecord(id) {
  const stored=read(recordPrefix+id);
  if(stored?.deal && Array.isArray(stored.people) && Array.isArray(stored.edges)) return stored;
  const deal=deals.find(d=>d.id===id)||northernArchives.find(d=>d.id===id);
  if(!deal) return null;
  if(deal.trainingFamily===northernDeal.trainingFamily)return northernRecord(deal);
  if(deal.demo)return exampleRecord(deal,defaultSettings(deal));
  if(id===defenseDeal.id) return defenseRecord(deal);
  return {deal:{...deal},...sampleNetwork(deal),sources:['Демонстрационная CRM'],settings:defaultSettings(deal)};
}
export function comparisonRecords(record){
  if([northernDeal,...northernArchives].some(d=>d.id===record.deal.id))
    return [northernDeal,...northernArchives].map(d=>dealRecord(d.id));
  return allDeals().filter(d=>d.id!==northernDeal.id).map(d=>dealRecord(d.id));
}
export function resetNorthernCase(id){
  if(id!==northernDeal.id)return;
  for(const d of [northernDeal,...northernArchives]){
    const history=historyFor(d.id);history.undo.length=0;history.redo.length=0;
    for(const key of [recordPrefix+d.id,viewPrefix+d.id]){
      memory.delete(key);
      try{localStorage.removeItem(key)}catch{}
    }
  }
}
export function defaultSettings(d) {
  return {product:d.title,stage:d.stage||stages[0],budget:'',goal:'Выйти на ЛПР',plan:'',constraints:''};
}
export const saveRecord=r=>write(recordPrefix+r.deal.id,r);
export const getView=id=>read(viewPrefix+id,{mode:id===northernDeal.id?'org':'process',views:{}});
export const saveView=(id,v)=>write(viewPrefix+id,v);
export function wordsOf(value) {
  if(Array.isArray(value))return value.map(wordsOf).join(' ');
  if(value && typeof value==='object')return Object.entries(value).filter(([key])=>key!=='photo').map(([,entry])=>wordsOf(entry)).join(' ');
  return value==null?'':String(value);
}
export function matches(query) {
  const words=normalize(query).split(/\s+/);
  return allDeals().filter(d=>{
    const r=dealRecord(d.id);
    const text=normalize(wordsOf([d,r.settings,r.people,r.sources]));
    return words.every(w=>text.includes(w));
  });
}
export function recent() {
  const saved=read(recentKey,[]); const ids=new Set(allDeals().map(d=>d.id));
  return (Array.isArray(saved)?saved:[]).filter(r=>ids.has(r?.id)&&Number.isFinite(r.at)).sort((a,b)=>b.at-a.at).slice(0,5);
}
export function opened(id) {
  const items=recent();const at=Math.max(Date.now(),(items[0]?.at??0)+1);
  write(recentKey,[{id,at},...items.filter(r=>r.id!==id)].slice(0,5));
}
export function blankPerson() {
  return {id:crypto.randomUUID(),name:'',title:'',dept:'',level:'',formal:'',task:'',stage:'',state:'active',attitude:'Неизвестно',contact:'Нет данных',role:'',decision:false,primary:false,influence:'Неизвестно',risks:[],opinions:[],disc:null,goals:[],preferences:[],goalHint:'',preferenceHint:'',agreements:[],source:'Вручную'};
}

const learningKey = 'cursor.demo.learning.v1';
export function readLearningProgress() {
  const step = read(learningKey, 0);
  return Number.isInteger(step) && step >= 0 ? step : 0;
}
export const saveLearningProgress = step => write(learningKey, step);

const learningDraftKey = 'cursor.demo.learning-draft.v1';
export const readLearningDraft = () => read(learningDraftKey);
export const saveLearningDraft = draft => write(learningDraftKey, draft);

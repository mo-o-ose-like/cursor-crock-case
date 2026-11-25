import {esc} from './components.js';
import {stages} from './sample-network.js';
import {dealRecord,saveRecord} from './data.js';
import {field,area,select,submit,backLink,notify} from './fields.js';
const goals=['Выйти на ЛПР','Получить поддержку ключевых участников','Преодолеть возражения','Продвинуть согласование закупки'];
export function mountSettings({id,root,header,go,signal,search}){
  const record=dealRecord(id);if(!record){go('all');return}
  const s=record.settings;document.title='О сделке · '+record.deal.title+' — Cursor';
  root.innerHTML=header()+`<main class="form-page"><form id="settings-form">${backLink('map/'+id,'К карте')}<h1>О сделке</h1><p class="sub">${esc(record.deal.company)} · ${esc(record.deal.title)}</p><section class="form-section"><h2>Основная информация</h2>${area('Что продаём?','product',s.product)}<div class="field-grid">${select('Стадия сделки','stage',stages,s.stage)}${field('Бюджет, ₽','budget',s.budget,{type:'number',placeholder:'Не указан',extra:'min="0" step="0.01" inputmode="decimal"'})}</div></section><section class="form-section"><h2>Стратегия продажи</h2><fieldset class="goals"><legend>Текущая цель</legend>${goals.map(g=>`<label class="checkline"><input type="radio" name="goal" value="${esc(g)}" ${s.goal===g?'checked':''}>${esc(g)}</label>`).join('')}</fieldset>${area('Как планируем действовать?','plan',s.plan,'Например, выйти на финансового директора через руководителя ИТ…')}</section><section class="form-section"><h2>Риски и ограничения</h2>${area('Что может помешать продаже?','constraints',s.constraints,'Например, отсутствие бюджета или блокировка закупки…')}</section><footer class="form-footer">${submit('Сохранить')}</footer></form></main>`;
  if(search?.key){
    const el=root.querySelector(search.key==='goal'?'[name="goal"]:checked':'[name="'+search.key+'"]');
    if(el){el.classList.add('settings-hit');requestAnimationFrame(()=>{if(!el.isConnected)return;el.focus();el.scrollIntoView({block:'center'});if(el.tagName==='TEXTAREA'){const from=el.value.toLowerCase().indexOf(search.query.trim().toLowerCase());if(from>=0)el.setSelectionRange(from,from+search.query.trim().length)}})}
  }
  root.addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));const latest=dealRecord(id);latest.settings={...latest.settings,...values};saveRecord(latest);go('map/'+id);notify('Настройки сделки сохранены')},{signal});
}

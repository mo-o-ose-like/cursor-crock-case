import {button,crmButton,searchField,selectField,dealRow} from './components.js';
import {deals,matches} from './data.js';
const swatches=(id,items)=>{document.getElementById(id).innerHTML=items.map(([name,hex])=>'<div class="swatch"><i style="--sw:'+hex+'"></i><div><strong>'+name+'</strong><code>'+hex+'</code></div></div>').join('')};
swatches('palette',[['Фирменный голубой','#457594'],['Наведение','#3A6179'],['Верхняя панель карт','#1D4D6A'],['Боковая панель карт','#BEC0C2'],['Фон экрана','#FFFFFF'],['Разделители','#E2E6EE']]);
swatches('semantics',[['ЛПР','#EAE1F2'],['Контакт КРОК','#E3F1E3'],['Другой участник','#E7E8EB'],['Риск · обводка','#CA3337']]);
document.getElementById('button-demo').innerHTML=crmButton();
document.getElementById('control-demo').innerHTML='<div class="control-row">'+button('Основная',{action:'primary-demo'})+button('Вторичная',{variant:'secondary',action:'secondary-demo'})+button('Недоступна',{disabled:true})+'</div><div class="demo-controls">'+searchField('','guide-query')+'<div>'+selectField('Стадия сделки',['Все стадии',...new Set(deals.map(d=>d.stage))],'stage')+'</div></div><div class="guide-row"></div><div class="guide-status" role="status" aria-live="polite"></div>';
const status=m=>{document.querySelector('.guide-status').textContent=m};
function rows(){
 const q=document.getElementById('guide-query').value;
 const stage=document.getElementById('stage').value;
 const found=matches(q).filter(d=>stage==='Все стадии'||d.stage===stage);
 document.querySelector('.guide-row').innerHTML=found.length?dealRow(found[0]):'<p>Сделки не найдены</p>';
 document.querySelector('.clear').hidden=!q;
 status(found.length?'Выберите строку, чтобы проверить активное состояние.':'Измените поисковый запрос или стадию.');
}
rows();
document.addEventListener('click',e=>{
 const act=e.target.closest('[data-action]')?.dataset.action;
 if(act==='login')location.href='index.html#login';
 if(act==='primary-demo'||act==='secondary-demo')status(act==='primary-demo'?'Нажата основная кнопка.':'Нажата вторичная кнопка.');
 if(act==='clear'){document.getElementById('guide-query').value='';rows();document.getElementById('guide-query').focus()}
 const row=e.target.closest('[data-deal]');if(row){const active=row.getAttribute('aria-pressed')!=='true';row.setAttribute('aria-pressed',String(active));status(active?'Строка выбрана.':'Выбор снят.')}
});
document.getElementById('guide-query').addEventListener('input',rows);
document.getElementById('stage').addEventListener('change',rows);
const links=[...document.querySelectorAll('nav a')];
function current(){const visible=[...document.querySelectorAll('main section')].filter(s=>s.getBoundingClientRect().top<=150).pop();links.forEach(l=>l.toggleAttribute('aria-current',l.hash==='#'+(visible?.id||'screens')))}
window.addEventListener('scroll',current,{passive:true});current();

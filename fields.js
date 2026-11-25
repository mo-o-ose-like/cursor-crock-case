import {esc,icon} from './components.js';
export const attr=esc;
export function field(label,name,value='',{type='text',required=false,placeholder='',extra=''}={}) {
  return `<label class="field"><span>${esc(label)}${required?' <b>*</b>':''}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required?'required':''} ${extra}></label>`;
}
export function area(label,name,value='',placeholder='') {
  return `<label class="field"><span>${esc(label)}</span><textarea rows="3" name="${esc(name)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
}
export function select(label,name,items,selected='',extra='') {
  return `<label class="field"><span>${esc(label)}</span><span class="select-field"><select name="${esc(name)}" ${extra}>${items.map(item=>{
    const [value,text]=Array.isArray(item)?item:[item,item];return `<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(text)}</option>`;
  }).join('')}</select>${icon('down',15)}</span></label>`;
}
export const submit=(label)=>`<button type="submit" class="btn primary">${esc(label)}</button>`;
export const backLink=(route,label)=>`<a class="back form-back" href="#${esc(route)}">${icon('back',16)}${esc(label)}</a>`;
export function modal(title,body,onSave) {
  const opener=document.activeElement;
  const titleId='dialog-title-'+crypto.randomUUID();
  const d=document.createElement('dialog');d.className='modal edit-dialog';d.setAttribute('aria-labelledby',titleId);
  d.innerHTML=`<div class="modal-inner"><button type="button" class="icon-btn modal-close" aria-label="Закрыть" data-close>${icon('close')}</button><h2 id="${titleId}">${esc(title)}</h2>${body}</div>`;
  document.body.append(d);
  d.addEventListener('close',()=>{d.remove();if(opener?.isConnected)opener.focus()},{once:true});
  d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  const f=d.querySelector('form');
  if(f && onSave)f.onsubmit=e=>{e.preventDefault();if(!valid(f))return;const result=onSave(Object.fromEntries(new FormData(f)),f);if(result!==false)d.close()};
  d.showModal();return d;
}
export function valid(form) {
  for(const el of form.querySelectorAll('input[required],textarea[required]')){
    if(el.type!=='file')el.setCustomValidity(el.value.trim()?'':'Заполните поле');
    el.addEventListener('input',()=>el.setCustomValidity(''),{once:true});
  }
  return form.reportValidity();
}
export const pair=(label,value)=>`<div class="fact"><dt>${esc(label)}</dt><dd>${esc(value||'Нет данных')}</dd></div>`;
export function notify(message) {
  document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;
  document.body.append(el);setTimeout(()=>el.remove(),3500);
}
export const edgeKinds={org:'Подчинение',process:'Переход в процессе',influence:'Влияние'};
export const states={active:'Участвует',finished:'Завершил участие',planned:'Планируется вовлечь'};

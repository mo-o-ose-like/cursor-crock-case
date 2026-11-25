import {mapPaths} from './map-icons.js';
export const paths = {
  ...mapPaths,
  search:'<circle cx="10.5" cy="10.5" r="6.8"/><path d="m16 16 4.6 4.6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H5m6 6-6-6 6-6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  exit:'<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4m5-13 5 5-5 5m-6-5h11"/>',
  stack:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.1"/>',
  book:'<path d="M3 5a17 17 0 0 1 9 1 17 17 0 0 1 9-1v14a17 17 0 0 0-9 1 17 17 0 0 0-9-1Zm9 1v14"/>'
};
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(name,size=20){return '<svg class="icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>'}
export function brand(cls=''){return '<img class="brand '+cls+'" src="assets/cursor.webp" width="882" height="563" alt="Cursor">'}
export function eyes(animate=false){return animate?'<span class="moving-eyes" aria-hidden="true"><img src="assets/eye-contours.webp" alt=""><img class="pupils" src="assets/eye-pupils.webp" alt=""></span>':'<img class="empty-eyes" src="assets/eyes.webp" width="292" height="243" alt="">'}
export function button(label,{variant='primary',action='',leading='',trailing='',cls='',disabled=false}={}){
  return '<button type="button" class="btn '+variant+' '+cls+'" '+(action?'data-action="'+esc(action)+'" ':'')+(disabled?'disabled':'')+'>'+(leading?icon(leading):'')+'<span>'+esc(label)+'</span>'+(trailing?icon(trailing):'')+'</button>'
}
export function crmButton(cls=''){return '<span class="crm-wrap '+cls+'"><i class="rays left" aria-hidden="true"></i>'+button('Войти через CRM',{action:'login',cls:'crm'})+'<i class="rays right" aria-hidden="true"></i></span>'}
export function searchField(value='',id='query'){return '<div class="search">'+icon('search')+'<input id="'+esc(id)+'" type="search" autocomplete="off" placeholder="Поиск по сделкам..." aria-label="Поиск по сделкам, компаниям и данным карты" value="'+esc(value)+'"><button type="button" class="clear" data-action="clear" aria-label="Очистить поиск" '+(!value?'hidden':'')+'>'+icon('close',17)+'</button></div>'}
export function dealRow(d,format=esc,context=''){return '<button type="button" class="deal-row" data-deal="'+esc(d.id)+'"><span class="row-text"><strong>'+format(d.title)+'</strong><small>'+format(d.company)+'</small>'+context+'</span><span class="row-go">'+icon('chevron',18)+'</span></button>'}
export function selectField(label,options,id){return '<label class="select-label" for="'+esc(id)+'">'+esc(label)+'</label><div class="select-field"><select id="'+esc(id)+'">'+options.map(v=>'<option>'+esc(v)+'</option>').join('')+'</select>'+icon('down',16)+'</div>'}

// Older saved replies contain JSON citations. Display them as text as well.
const labels={name:'Имя',title:'Название',company:'Компания',participant:'Контакт',position:'Должность',dept:'Подразделение',level:'Уровень',formal:'Ответственность',task:'Задача',stage:'Этап',state:'Участие',attitude:'Отношение',contact:'Контакт',role:'Роль в сделке',roleStatus:'Подтверждение роли',decision:'Отмечен как ЛПР',primary:'Основной контакт КРОК',influence:'Влияние',risks:'Отмеченные риски',goals:'Цели',preferences:'Предпочтения',goalHint:'Предположение о цели',preferenceHint:'Предположение о предпочтениях',source:'Источник',product:'Решение',budget:'Бюджет',goal:'Цель',plan:'План',constraints:'Ограничения',agreement:'Договорённость',notes:'Заметки',date:'Дата',status:'Статус',detail:'Содержание',content:'Содержание',type:'Тип',provenance:'Происхождение',text:'Описание'};
const words={active:'Участвует',planned:'Планируется',finished:'Завершил участие',confirmed:'Подтверждено',assumed:'Предположение',synthetic:'Вымышленные учебные данные'};
function valueText(value){
  if(typeof value==='boolean')return value?'Да':'Нет';
  if(Array.isArray(value))return value.filter(v=>['string','number'].includes(typeof v)).map(valueText).join('; ')||'Нет данных';
  if(value===null||typeof value==='object')return 'Нет данных';
  const text=String(value??'').trim();return words[text]||text||'Нет данных';
}
export function sourceText(value,record={}){
  if(typeof value!=='string'||!value.trim())return 'Нет данных';
  let data;try{data=JSON.parse(value);}catch{return value.trim().startsWith('{')?'Сохранённое описание источника неполное. Откройте карточку участника для актуальных данных.':value;}
  if(!data||Array.isArray(data)||typeof data!=='object')return value;
  const lines=[];
  if(data.a&&data.b){
    const name=id=>record.people?.find(p=>p.id===id)?.name||'Участник не указан';
    lines.push(name(data.a)+' → '+name(data.b));
    const kind={org:'Подчинение',process:'Переход в процессе',influence:'Влияние'}[data.kind];
    if(kind)lines.push('Тип: '+kind);
  }
  for(const [key,label] of Object.entries(labels)){
    if(Object.hasOwn(data,key))lines.push((key==='title'&&data.name?'Должность':label)+': '+valueText(data[key]));
  }
  return lines.join('\n')||'Источник не содержит описательных данных.';
}

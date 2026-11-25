const key=(a,b)=>JSON.stringify([a,b]);
const riskTitles={lost:'Потеря контакта',relationship:'Разногласия с участником','contract-date':'Не определена дата договора',delay:'Задержка бюджета',authority:'Дополнительное согласование',removed:'Передача ответственности',edge:'Разрыв маршрута',manual:'Изменение маршрута',undated:'Нет даты согласования',planned:'Позднее подключение',recorded:'Риск в карточке участника',budget:'Бюджет не уточнён'};

function hypothesisDetail(id,pair){
  if(id.startsWith('hypothesis-backup-'))return ['Запасной контакт','Неизвестно, сможет ли посредник восстановить контакт.','Спросите у посредника, готов ли он организовать знакомство, и согласуйте канал связи.'];
  if(id.startsWith('hypothesis-authority'))return ['Критерии нового ЛПР','Неясно, какие решения вправе утверждать новый участник.','Уточните его полномочия и попросите назвать критерии финального согласования.'];
  if(id.startsWith('hypothesis-contract-'))return ['Первый результат по договору','Не согласовано, кто примет первый результат.','Сверьте с участником исполнителя, дату и критерий приёмки.'];
  if(id.startsWith('hypothesis-relationship-'))return ['Поддержка следующего шага','Готовность участника взять конкретное обязательство пока неизвестна.','Предложите один следующий шаг и попросите подтвердить ответственного и срок.'];
  if(id.startsWith('hypothesis-addition-'))return ['Полномочия нового участника','Неизвестно, отвечает ли предложенный участник за этот вопрос.','Уточните у инициатора его роль и готовность участвовать во встрече.'];
  if(id.startsWith('hypothesis-agreement-'))return ['Результат договорённости','Не подтверждены результат и готовность перейти к следующему шагу.','Сверьте с владельцем договорённости ожидаемый результат и срок.'];
  if(pair)return ['Возможный переход','Неизвестно, согласны ли обе стороны на прямой контакт.','Уточните у первого участника, готов ли он представить второго, и договоритесь о цели разговора.'];
  return ['Предположение сотрудника','Запись менеджера ещё не подтверждена участниками.','Сверьте предположение с участником и зафиксируйте ответ.'];
}

function recommendation(it,graph,people){
  const id=it.id;
  const participant=people.get(it.personId)||people.get(it.sources.find(s=>s.personId)?.personId);
  const route=it.targets.edges[0];
  const stage=graph.people.find(p=>p.id===(route?.[1]||participant?.id))?.stage;
  let heading, reason;
  if(id==='budget'){
    heading='Уточнить бюджет';reason='Лимит не указан в сделке. Без него нельзя сверить предложение с суммой, которую готов утвердить заказчик.';
  }else if(id.startsWith('lost-')){
    heading='Найти резервный контакт';reason='В этой ветке прежний канал связи недоступен. Другой участник может помочь передать вопросы по закупке.';
  }else if(id.startsWith('introduce-')){
    heading='Организовать знакомство';reason='У одного участника контакт уже установлен, а подключение второго ещё планируется.';
  }else if(id.startsWith('delay-')){
    heading='Пересогласовать сроки';reason='В сценарии отложено утверждение бюджета. Новая дата нужна, чтобы проверить зависимые договорённости.';
  }else if(id.startsWith('scenario-')){
    heading='Уточнить полномочия';reason='В финальном согласовании появляется ещё один участник. Его право принимать решение предстоит подтвердить.';
  }else if(id.startsWith('contract-')){
    heading='Определить исполнителя';reason='Договор добавлен в песочницу. Сторонам ещё предстоит назначить ответственного за первый результат.';
  }else if(id.startsWith('attitude-')){
    const improved=it.text.includes('согласовать следующий шаг');
    heading=improved?'Закрепить поддержку':'Разобрать возражение';
    reason=improved?'В сценарии отношение улучшилось. Сейчас можно уточнить, какое действие участник готов поддержать.':'После ухудшения отношений прежние критерии согласования могут потребовать пересмотра.';
  }else if(id==='security-review'){
    heading='Подключить службу ИБ';reason='Открытая договорённость требует участия ИБ. На карте пока не указан представитель службы.';
  }else if(id.startsWith('advice-handover-')){
    heading='Передать ответственность';reason='Участник исключён из сценария, но за ним остаётся задача или договорённость.';
  }else if(id.startsWith('advice-date-')||id.startsWith('agreement-')){
    heading='Проверить договорённость';reason=id.startsWith('advice-date-')?'Срок договорённости не указан. Без даты следующий шаг трудно запланировать.':'Результат договорённости ещё не подтверждён.';
  }else if(id.startsWith('message-')){
    heading='Предложение по записи';reason=route?'Менеджер предложил изменить маршрут. Участникам стоит согласовать его до изменения рабочей карты.':'Менеджер предложил изменение. Уточнение покажет, можно ли применить его в сделке.';
  }else if(id==='local-model'){
    heading=it.action;reason=it.sources.map(s=>s.detail).filter(Boolean).join(' · ');
  }else if(id==='empty'){
    heading='Указать участника';reason='Для проверки связей нужен хотя бы один участник сделки.';
  }else{
    heading='Согласовать следующий шаг';reason='Для этого участника пока не зафиксирован подтверждённый следующий шаг.';
  }
  return {heading,reason,stage};
}

export function describeFindings(advice,graph,baseline){
  const people=new Map([...baseline.people,...graph.people].map(p=>[p.id,p]));
  for(const it of advice.items){
    const ids=new Set(),edges=new Map();
    function person(id){if(id&&people.has(id))ids.add(id)}
    function edge(a,b){if(!people.has(a)||!people.has(b))return;edges.set(key(a,b),[a,b]);person(a);person(b)}
    person(it.personId);
    for(const s of it.sources){person(s.personId);if(s.edge)edge(...s.edge)}
    if(it.edge)edge(it.edge.a,it.edge.b);
    for(const e of graph.edges)if(e.basis===it.id)edge(e.a,e.b);
    if(it.id.startsWith('message-'))person('proposal-'+it.id.slice(8));
    const primary=it.personId;
    if(primary&&['risk-lost-','risk-removed-','risk-delay-'].some(prefix=>it.id===prefix+primary)){
      for(const e of [...baseline.edges.filter(e=>e.kind==='process'),...graph.edges])if(e.a===primary||e.b===primary)edge(e.a,e.b);
    }
    it.targets={people:[...ids],edges:[...edges.values()]};
    const pair=it.sources.find(s=>s.edge)?.edge||it.targets.edges[0];
    it.subject=pair&&it.targets.edges.length===1?pair.map(id=>people.get(id)?.name).join(' → '):people.get(it.personId)?.name||[...ids].map(id=>people.get(id).name).slice(0,3).join(' · ');
    const reason=it.sources.find(s=>s.detail);
    const origin=it.id.replace(/^risk-/,'');
    const type=Object.keys(riskTitles).find(k=>origin===k||origin.startsWith(k+'-'));
    if(it.kind==='risk'){
      it.heading=type==='recorded'&&people.get(primary)?.risks?.[0]||riskTitles[type]||'Риск сценария';
      const person=people.get(primary);
      if(type==='recorded'){
        const other=person?.risks?.slice(1);
        it.reason=other?.length?'Ответственный отметил в карточке также «'+other.join('», «')+'».':'Риск зафиксирован в профиле участника.';
      }else if(type==='lost'){
        it.reason='В этой ветке прямой контакт недоступен.';
      }else if(type==='delay'){
        it.reason='Выбранный сценарий сдвигает согласование бюджета.';
      }else it.reason=reason?.detail;
    }else if(it.kind==='hypothesis'){
      [it.heading,it.unknown,it.check]=hypothesisDetail(it.id,pair);
      it.reviewBasis=JSON.stringify([it.text,it.targets,it.sources.map(s=>s.detail)]);
    }else{
      Object.assign(it,recommendation(it,graph,people));
    }
  }
}

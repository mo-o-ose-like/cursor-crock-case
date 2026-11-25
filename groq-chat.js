// Transport only. Rendering uses the original chatHTML and existing styles.
export function chatHistory(messages, current){
  const result=[];
  for(const m of messages){
    if(m===current){result.push({role:'user',content:m.text});break;}
    // Failed requests must not look like successful turns to the model.
    if(m.ai&&m.status!=='done')continue;
    result.push({role:'user',content:m.text});
    if(m.ai&&m.answer?.answer)result.push({role:'assistant',content:m.answer.answer});
  }
  return result.slice(-19);
}

export async function askGroq({record,graph,scenario,branch,message,signal,onChange}){
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)abort();
  const timer=setTimeout(abort,65000);
  try{
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({record,graph,scenario,selected:message.personId,messages:chatHistory(branch.messages,message)}),signal:controller.signal});
    let data;
    try{data=await response.json();}catch{throw new Error('Сервер не вернул ответ ИИ. Запустите python3 server.py и обновите страницу.');}
    if(!response.ok)throw new Error(data.error||'Не удалось получить ответ. Повторите вопрос.');
    if(data.mode!=='ai'||typeof data.answer!=='string'||!Array.isArray(data.citations))throw new Error('Сервер вернул некорректный ответ. Повторите вопрос.');
    message.answer=data;message.status='done';
  }catch(error){
    delete message.answer;
    message.status='error';message.error=error.name==='AbortError'?'Запрос прерван. Отправьте вопрос ещё раз.':error instanceof TypeError?'Не удалось связаться с сервером. Проверьте, что python3 server.py запущен, и повторите вопрос.':error.message;
  }finally{
    clearTimeout(timer);signal.removeEventListener('abort',abort);onChange();
  }
}

const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const base=process.env.SERVER_URL||'http://127.0.0.1:8080';
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chromium'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const path of ['/.env','/.git/config','/server.py'])assert.equal((await page.request.get(base+path)).status(),404);
    await page.goto(base+'/#preview-deals');
    await page.evaluate(()=>{location.hash='#map/service'});
    await page.locator('[data-mode="scenario"]').click();
    await page.locator('[data-map="assistant"]').click();
    await page.getByRole('heading',{name:'Помощник Cursor'}).waitFor();
    assert.equal(await page.locator('[data-insight-kind]').count(),3);
    assert.equal(await page.locator('#proposal-input').getAttribute('maxlength'),'320');
    const before=await page.evaluate(async()=>{
      const {scenarioBoard}=await import('/scenario-board.js');const {dealRecord,getView}=await import('/data.js');
      return {record:dealRecord('service'),graph:scenarioBoard(dealRecord('service'),getView('service').views.scenario).graph};
    });
    const requests=[];
    await page.route('**/api/chat',async route=>{
      requests.push(route.request().postDataJSON());
      await new Promise(resolve=>setTimeout(resolve,200));
      await route.fulfill({json:{answer:'Проверьте бюджет [S2].\nСумма не подтверждена.',mode:'ai',citations:[{id:'S2',label:'Настройки сделки',text:'Бюджет: Нет данных'},{id:'S4',label:'Александр Морозов · карточка',personId:'technical',text:JSON.stringify({id:'technical',name:'Александр Морозов',title:'Директор по ИТ',contact:'Нет данных',role:'',decision:false,source:'Демо CRM'})}],suggestions:[],coverage:{used:20,total:50}}});
    });
    await page.locator('#proposal-input').fill('Удали Александра Морозова');
    await page.locator('#chat-form button[type="submit"]').click();
    await page.getByText('Проверьте бюджет [S2].',{exact:true}).waitFor();
    const after=await page.evaluate(async()=>{
      const {scenarioBoard}=await import('/scenario-board.js');const {dealRecord,getView}=await import('/data.js');
      return {record:dealRecord('service'),graph:scenarioBoard(dealRecord('service'),getView('service').views.scenario).graph};
    });
    assert.deepEqual(after,before,'AI message cannot change the map');
    await page.getByRole('link',{name:'[S2] Настройки сделки',exact:true}).click();
    await page.locator('dialog').getByText('Бюджет: Нет данных',{exact:true}).waitFor();
    await page.locator('dialog [data-close]').click();
    await page.getByRole('link',{name:'[S4] Александр Морозов · карточка',exact:true}).click();
    await page.locator('dialog').getByText('Должность: Директор по ИТ',{exact:true}).waitFor();
    assert((await page.locator('dialog').innerText()).includes('Роль в сделке: Нет данных'));
    assert(!(await page.locator('dialog').innerText()).includes('technical'));
    assert(!(await page.locator('dialog').innerText()).includes('{'));
    assert.equal(await page.locator('dialog').getByRole('button',{name:'Открыть участника'}).count(),1);
    await page.locator('dialog [data-close]').click();
    await page.locator('#proposal-input').fill('Почему именно он?');
    await page.locator('#chat-form button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#chat-form button[type="submit"]').disabled);
    assert.equal(requests[1].messages.at(-2).role,'assistant');
    assert.equal(requests[1].messages.at(-1).content,'Почему именно он?');
    assert(!JSON.stringify(requests).includes('AI_API_KEY'));
    await page.locator('[data-map="undo"]').click();
    await page.locator('[data-map="redo"]').click();
    await page.waitForFunction(()=>!document.querySelector('#chat-form button[type="submit"]').disabled);
    assert.equal(await page.getByText('Проверьте бюджет [S2].',{exact:true}).count(),2);
    await page.reload();
    await page.getByRole('heading',{name:'Помощник Cursor'}).waitFor();
    assert.equal(await page.getByText('Проверьте бюджет [S2].',{exact:true}).count(),2);
    await page.unroute('**/api/chat');
    await page.route('**/api/chat',route=>route.fulfill({status:429,json:{error:'Тест: достигнут лимит Groq'}}));
    await page.locator('#proposal-input').fill('Ещё вопрос');
    await page.locator('#chat-form button[type="submit"]').click();
    await page.getByText('Тест: достигнут лимит Groq',{exact:true}).waitFor();
    assert.equal(await page.locator('#chat-form button[type="submit"]').isDisabled(),false);
    await page.screenshot({path:process.env.SCREENSHOT_PATH||'tests/chat-desktop.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: original title/tabs/form, model response, source dialog, no map changes, follow-up history, persistence, rate-limit error, secret routes blocked; no JS errors.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

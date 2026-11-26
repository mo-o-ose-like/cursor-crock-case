import {blankPerson} from './data.js';
import {projectEvents} from './simulation.js';
import {filterPerson,searchPerson,terms} from './map-search.js';

export const modes={process:'Процесс закупки',org:'Оргструктура',influence:'Влияние',scenario:'What if'};
// Influence links are direct observations. A two-step chain never creates a
// third inferred link between its endpoints.
export function directInfluenceEdges(edges,people=[]){
  const ids=new Set(people.map(p=>p.id));
  const seen=new Set();
  return edges.filter(e=>e.kind==='influence'&&e.a!==e.b&&ids.has(e.a)&&ids.has(e.b)).filter(e=>{
    const key=e.a+'→'+e.b;if(seen.has(key))return false;seen.add(key);return true;
  });
}
export const scenarios={
  lost:['Ключевой контакт выходит','Текущий канал связи становится недоступен.'],
  decision:['Вовлечение нового ЛПР','Появляется дополнительный участник финального согласования.'],
  delay:['Задержка бюджета','Согласование бюджета сдвигается и замедляет следующие шаги.']
};
export function scenarioGraph(record,code,events=[]){
  const people=record.people.map(p=>({...p}));let edges=record.edges.filter(e=>e.kind==='process').map(e=>({...e}));
  const result={people,edges,presetParticipants:[],message:'Выберите участника на карте, чтобы смоделировать изменение.'};
  if(!people.length)return result;
  if(code==='lost'){
    const p=people.find(x=>x.primary)||people.find(x=>x.state==='active')||people[0];
    p.state='finished';p.contact='Связь потеряна';p.sim='Канал недоступен';
    for(const e of edges)if(e.a===p.id||e.b===p.id)e.strength='assumed';
    result.message=p.name+' выходит из процесса. Потребуется другой контакт для передачи договорённостей.';
  }else if(code==='decision'){
    const p={...blankPerson(),id:'what-if-new',name:'Новый ЛПР',title:'Представитель дирекции',dept:'Дирекция',task:'Финальное согласование',stage:'Финальное согласование',state:'planned',decision:true,sim:'Новый участник'};
    people.push(p);const lead=people.find(x=>x.id!==p.id&&x.decision)||people[0];
    edges.push({a:lead.id,b:p.id,kind:'process',strength:'assumed'});result.message='Появляется дополнительный этап согласования с новым ЛПР.';
  }else if(code==='delay'){
    const affected=people.filter(p=>p.stage==='Согласование бюджета');if(!affected.length)affected.push(people.find(p=>p.decision)||people[0]);
    result.presetParticipants=affected.map(p=>p.id);
    for(const p of affected){p.sim='Бюджет задержан';for(const e of edges)if(e.a===p.id||e.b===p.id)e.strength='assumed'}
    result.message='Сроки зависят от согласования бюджета. Уточните новую дату у '+affected.map(p=>p.name).join(', ')+'.';
  }
  return projectEvents(result,events);
}
export function automaticRisks(p){
  const risks=[];
  if(!p.role)risks.push('Не определена роль');
  if(!p.stage)risks.push('Не определён этап');
  if(!p.contact||p.contact==='Нет данных')risks.push('Неизвестен статус контакта');
  return risks;
}
export function risksFor(p){
  return [...(p.risks??[]),...automaticRisks(p)];
}
export function matchesPerson(p,view,mode='process'){
  const tokens=terms(view.query);
  return filterPerson(p,view.filters)&&(!tokens.length||searchPerson(p,mode,tokens).length>0);
}
const W=248;
const dept=p=>p.dept||'Подразделение не указано';
function arrangementScore(space,width,height,keys,h){
  const all=Math.min(space.w/width,space.h/height);
  if(all>=.88)return 2+all;
  if(keys.length<2)return all;
  const xs=keys.map(p=>p.x),ys=keys.map(p=>p.y);
  const keyZoom=Math.min(space.w/(Math.max(...xs)-Math.min(...xs)+W),space.h/(Math.max(...ys)-Math.min(...ys)+h));
  return Math.min(1,keyZoom)+all*.25;
}
function processPositions(people,edges,h,viewport){
  if(viewport&&people.length){
    const phases=['finished','active','planned'].map(state=>people.filter(p=>(p.state||'active')===state)).filter(list=>list.length);
    const others=people.filter(p=>p.state&&!['finished','active','planned'].includes(p.state));
    if(others.length)phases.push(others);
    const dx=W+34,dy=h+34;
    const keys=phases.map(group=>group.map((p,i)=>p.primary||p.decision?i:-1).filter(i=>i>=0));
    function position(i,count,offset,{horizontal,span,along}){
      const band=Math.floor(i/span);
      const lines=Math.min(span,count-band*span);
      const cross=offset+band,within=i%span+(along-lines)/2;
      return {x:(horizontal?cross:within)*dx,y:(horizontal?within:cross)*dy};
    }
    let bestScore=-1,best;
    // Keep each phase together. Try horizontal and stacked phases for the available board.
    const max=Math.max(...phases.map(list=>list.length));
    for(const horizontal of [true,false]){
      for(let span=1;span<=max;span++){
        const sizes=phases.map(list=>({across:Math.ceil(list.length/span),along:Math.min(span,list.length)}));
        const across=sizes.reduce((n,g)=>n+g.across,0),along=Math.max(...sizes.map(g=>g.along));
        const width=(horizontal?across:along)*dx-34,height=(horizontal?along:across)*dy-34;
        const candidate={horizontal,span,along},keyLocations=[];let offset=0;
        for(const [index,group] of phases.entries()){
          for(const i of keys[index])keyLocations.push(position(i,group.length,offset,candidate));
          offset+=sizes[index].across;
        }
        const score=arrangementScore(viewport,width,height,keyLocations,h);
        if(score<=bestScore)continue;
        bestScore=score;best=candidate;
      }
    }
    const positions={};let offset=0;
    for(const group of phases){
      group.forEach((p,i)=>{positions[p.id]=position(i,group.length,offset,best)});
      offset+=Math.ceil(group.length/best.span);
    }
    return positions;
  }
  const positions={};const dx=W+60,dy=h+64;
  const defaults={finance:[1.35,0],technical:[1,1],business:[2,1],procurement:[0,1],operations:[1,2],budget:[2,2],general:[3,2]};
  if(people.filter(p=>Object.hasOwn(defaults,p.id)).length>=5){
    let extra=0;
    for(const p of people){const [col,row]=defaults[p.id]||[3+(extra++%2),Math.floor(extra/2)];positions[p.id]={x:col*dx,y:row*dy}}
    return positions;
  }
  // Topological layers keep imported roots and isolated people accessible. Cycles share the last layer.
  let rest=[...people];const rows=[];const done=new Set();
  while(rest.length){
    let row=rest.filter(p=>!edges.some(e=>e.b===p.id&&!done.has(e.a)));
    if(!row.length)row=rest;
    for(let i=0;i<row.length;i+=4)rows.push(row.slice(i,i+4));
    row.forEach(p=>done.add(p.id));rest=rest.filter(p=>!done.has(p.id));
  }
  const max=Math.max(1,...rows.map(x=>x.length));
  rows.forEach((row,y)=>row.forEach((p,x)=>positions[p.id]={x:(x+(max-row.length)/2)*dx,y:y*dy}));
  return positions;
}
function layers(names,edges){
  const rows=[],done=new Set();
  let remaining=[...names];
  while(remaining.length){
    const next=remaining.filter(id=>edges.every(e=>e.b!==id||done.has(e.a)));
    if(!next.length)return null;
    rows.push(next);next.forEach(id=>done.add(id));remaining=remaining.filter(id=>!done.has(id));
  }
  return rows;
}
// Reorder peer departments within their existing hierarchy level. Shared endpoints
// use the same lane and therefore do not count as crossed reporting lines.
function alignDepartments(ranks, members, edges) {
  const department=new Map();
  for(const [group,roster] of members)for(const person of roster)department.set(person.id,group);
  const parents=new Map();
  for(const e of edges){
    const from=department.get(e.a),to=department.get(e.b);
    if(from===undefined||to===undefined||from===to)continue;
    if(!parents.has(to))parents.set(to,[]);
    parents.get(to).push(from);
  }
  const lane=new Map();
  for(const row of ranks){
    const preferred=new Map();
    row.forEach((group,index)=>{
      const positions=(parents.get(group)||[]).filter(p=>lane.has(p)).map(p=>lane.get(p));
      preferred.set(group,positions.length?positions.reduce((a,b)=>a+b,0)/positions.length:(index+.5)/row.length);
    });
    row.sort((a,b)=>preferred.get(a)-preferred.get(b));
    row.forEach((group,index)=>lane.set(group,(index+.5)/row.length));
  }
}
function groupPositions(people,mode,h,edges,viewport,collapsed){
  const by=new Map();
  for(const p of people){const key=dept(p);if(!by.has(key))by.set(key,[]);by.get(key).push(p)}
  let keys=[...by.keys()];const top=mode==='org'?people.find(p=>p.id==='general'):people.find(p=>p.decision);
  const first=top?dept(top):keys[0];let rows=[];
  if(first){rows.push([first]);keys=keys.filter(k=>k!==first)}
  const columns=keys.length===4?4:3;
  for(let i=0;i<keys.length;i+=columns)rows.push(keys.slice(i,i+columns));
  if(mode==='org'){
    const names=new Map(people.map(p=>[p.id,dept(p)]));
    const byDepth=layers(people.map(p=>p.id),edges)||[people.map(p=>p.id)];
    const rank=new Map(byDepth.flatMap((ids,i)=>ids.map(id=>[id,i])));
    for(const members of by.values())members.sort((a,b)=>rank.get(a.id)-rank.get(b.id));
    const deptEdges=edges.map(e=>({a:names.get(e.a),b:names.get(e.b)})).filter(e=>e.a!==e.b);
    const grouped=layers([...by.keys()],deptEdges);
    if(grouped)rows=grouped;
    else{
      // Cross-department reporting can return to an earlier department at a deeper level.
      by.clear();rows=byDepth.map((ids,i)=>{
        const groups=[];
        for(const id of ids){const p=people.find(p=>p.id===id),key=i+'|'+dept(p);if(!by.has(key)){by.set(key,[]);groups.push(key)}by.get(key).push(p)}
        return groups;
      });
    }
  }
  const positions={},groups=[];const width=W+32,dx=width+(viewport?28:44),gapY=viewport?34:68;
  const groupHeight=k=>viewport&&mode==='org'&&collapsed.has(dept(by.get(k)[0]))?39:48+by.get(k).length*(h+12);
  if(viewport&&by.size){
    const keyGroups=new Set(people.filter(p=>p.primary||p.decision).map(dept));
    const ranks=mode==='org'?rows:[[...by.keys()].sort((a,b)=>Number(b===first)-Number(a===first)||Number(keyGroups.has(b))-Number(keyGroups.has(a)))];
    if(mode==='org'&&viewport.orderByManager)alignDepartments(ranks,by,edges);
    let best=-1;
    for(let cols=1;cols<=Math.max(...ranks.map(r=>r.length));cols++){
      const trial=[];
      for(const rank of ranks)for(let i=0;i<rank.length;i+=cols)trial.push(rank.slice(i,i+cols));
      const widthUsed=(Math.max(...trial.map(r=>r.length))-1)*dx+width;
      let y=0;const keyLocations=[];
      const maxCols=Math.max(...trial.map(r=>r.length));
      for(const r of trial){
        r.forEach((k,i)=>by.get(k).forEach((p,j)=>{
          if((p.primary||p.decision)&&!(mode==='org'&&collapsed.has(dept(p))))keyLocations.push({x:(i+(maxCols-r.length)/2)*dx+16,y:y+43+j*(h+12)});
        }));
        y+=Math.max(...r.map(groupHeight))+gapY;
      }
      const score=arrangementScore(viewport,widthUsed,y-gapY,keyLocations,h);
      if(score>best){best=score;rows=trial}
    }
  }
  const max=Math.max(1,...rows.map(r=>r.length));
  let y=0;
  for(const row of rows){
    let rh=0;
    row.forEach((name,i)=>{
      const x=(i+(max-row.length)/2)*dx;
      const members=by.get(name);const gh=groupHeight(name);
      groups.push({name:dept(members[0]),x,y,w:width,h:gh,members:members.map(p=>p.id)});
      members.forEach((p,j)=>positions[p.id]={x:x+16,y:y+43+j*(h+12)});
      rh=Math.max(rh,gh);
    });y+=rh+gapY;
  }
  return {positions,groups};
}
export function layout(people,edges,mode,view,viewport){
  const grouped=mode==='org'||mode==='influence';const h=mode==='org'?(viewport?(viewport.orderByManager?90:98):76):mode==='influence'?(viewport?137:125):144;
  const collapsed=new Set(view.collapsed||[]);
  const layout=grouped?groupPositions(people,mode,h,edges,viewport,collapsed):{positions:processPositions(people,edges,h,viewport),groups:[]};
  const nodes=new Map();const inherited=view.layoutMode==='auto'?{}:view.positions||{};
  for(const p of people){const xy=inherited[p.id]??layout.positions[p.id];nodes.set(p.id,{...xy,w:W,h,p})}
  for(const g of layout.groups){
    const boxes=g.members.map(id=>nodes.get(id));const left=Math.min(...boxes.map(n=>n.x))-16,top=Math.min(...boxes.map(n=>n.y))-43;
    g.x=left;g.y=top;g.w=Math.max(...boxes.map(n=>n.x+n.w))-left+16;
    g.collapsed=mode==='org'&&collapsed.has(g.name);g.h=g.collapsed?39:Math.max(...boxes.map(n=>n.y+n.h))-top+14;
    for(const n of boxes){n.group=g;n.hidden=g.collapsed}
  }
  const boxes=[...layout.groups,...[...nodes.values()].filter(n=>!n.hidden)];
  const bounds=boxes.length?{x:Math.min(...boxes.map(n=>n.x)),y:Math.min(...boxes.map(n=>n.y)),r:Math.max(...boxes.map(n=>n.x+n.w)),b:Math.max(...boxes.map(n=>n.y+n.h))}:{x:0,y:0,r:W,b:h};
  return {nodes,groups:layout.groups,bounds};
}
export function connector(a,b){
  if(!a||!b||a===b)return '';
  const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};
  if(Math.abs(bc.y-ac.y)<Math.min(a.h,b.h)*.72){
    const right=bc.x>ac.x,x1=right?a.x+a.w:a.x,x2=right?b.x:b.x+b.w,mid=(x1+x2)/2;
    return `M ${x1} ${ac.y} C ${mid} ${ac.y} ${mid} ${bc.y} ${x2} ${bc.y}`;
  }
  const down=bc.y>ac.y,y1=down?a.y+a.h:a.y,y2=down?b.y:b.y+b.h,mid=(y1+y2)/2;
  const sx=Math.sign(bc.x-ac.x),sy=Math.sign(y2-y1);const bend=Math.min(12,Math.abs(bc.x-ac.x)/2,Math.abs(y2-y1)/3);
  return `M ${ac.x} ${y1} V ${mid-sy*bend} Q ${ac.x} ${mid} ${ac.x+sx*bend} ${mid} H ${bc.x-sx*bend} Q ${bc.x} ${mid} ${bc.x} ${mid+sy*bend} V ${y2}`;
}

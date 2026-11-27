import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layout,departmentPosition} from '../map-layout.js';
import {defenseDeal,defenseRecord} from '../defense-demo.js';

const record=defenseRecord(defenseDeal),viewport={w:1400,h:900,orderByManager:true};
const links=record.edges.filter(e=>e.kind==='formal');
const gap=(a,b)=>Math.max(a.x-b.x-b.w,b.x-a.x-a.w,a.y-b.y-(b.reservedH??b.h),b.y-a.y-(a.reservedH??a.h));
function separated(model){
  for(let i=0;i<model.groups.length;i++)for(const b of model.groups.slice(i+1))assert.ok(gap(model.groups[i],b)>=23.99,'department frames have at least 24px clearance');
  for(const g of model.groups)for(const id of g.members){
    const n=model.nodes.get(id);
    assert.ok(n.x>=g.x&&n.x+n.w<=g.x+g.w,'card stays inside its department');
    if(!g.collapsed)assert.ok(n.y>=g.y+39&&n.y+n.h<=g.y+g.h);
  }
}
for(const mode of ['org','influence'])test(`${mode}: old overlapping positions are repaired and remain stable`,()=>{
  const edges=mode==='org'?links:record.edges.filter(e=>e.kind==='influence');
  const initial=layout(record.people,edges,mode,{layoutMode:'auto'},viewport);
  const view={layoutMode:'free',orgGroups:Object.fromEntries(initial.groups.map(g=>[g.key,{x:100,y:100}]))};
  const repaired=layout(record.people,edges,mode,view,viewport);
  separated(repaired);
  for(const g of repaired.groups)Object.assign(view.orgGroups[g.key],{x:g.x,y:g.y});
  const reopened=layout(record.people,edges,mode,view,viewport);
  assert.deepEqual(reopened.groups.map(g=>[g.key,g.x,g.y]),repaired.groups.map(g=>[g.key,g.x,g.y]));
});
test('dragged department yields to its neighbors, including collapsed reserved space',()=>{
  const initial=layout(record.people,links,'org',{layoutMode:'auto'},viewport);
  const active=initial.groups[2],obstacle=initial.groups[3];
  const view={layoutMode:'free',activeDepartment:active.key,collapsed:[obstacle.name],orgGroups:{[active.key]:{x:obstacle.x,y:obstacle.y}}};
  const dragged=layout(record.people,links,'org',view,viewport);
  separated(dragged);
  assert.equal(dragged.groups[3].x,obstacle.x);
  assert.equal(dragged.groups[3].y,obstacle.y);
  assert.ok(dragged.groups[2].adjusted);
  const safe={x:-900,y:-900,w:300,h:500};
  assert.deepEqual(departmentPosition(safe,dragged.groups),{x:safe.x,y:safe.y},'free movement is unchanged outside occupied space');
});

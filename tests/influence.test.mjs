import assert from 'node:assert/strict';
import {test} from 'node:test';
import {edgeArt,matchesInfluenceEvidence} from '../edge-art.js';
import {layout} from '../map-layout.js';
import {defenseDeal,defenseRecord} from '../defense-demo.js';

const viewport={w:1050,h:620,orderByManager:true};
const people=['a','b','c','d','e','f'].map(id=>({id,name:id,dept:'ИТ'}));
const links=['ab','ba','af','fa','be','bd','cf','df','ec'].map(([a,b],index)=>({
  a,b,kind:'influence',strength:index%2?'assumed':'strong'
}));
const arrange=(edges,mode='influence',view={})=>layout(people,edges,mode,view,viewport);

function pathsFor(model,showEdge){
  const html=edgeArt(links,model,'influence',null,null,null,showEdge);
  return new Map([...html.matchAll(/data-edge-index="(\d+)"[^>]*><path class="connection-hit" d="([^"]+)"/g)]
    .map(([,index,path])=>[Number(index),path]));
}

test('influence cards have room for two adjacent arrows while org spacing stays compact',()=>{
  const gap=model=>model.nodes.get('b').y-model.nodes.get('a').y-model.nodes.get('a').h;
  const influence=arrange(links);
  assert.equal(gap(influence),26);
  assert.equal(gap(arrange([],'org')),24);
  const paths=pathsFor(influence);
  const startX=index=>Number(paths.get(index).match(/^M([\d.]+)/)[1]);
  assert.ok(Math.abs(startX(0)-startX(1))>=14);
  assert.match(paths.get(0),/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
  assert.match(paths.get(1),/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
});

test('department influence uses clear orthogonal paths with straight, perpendicular arrowheads',()=>{
  const record=defenseRecord(defenseDeal),edges=record.edges.filter(e=>e.kind==='influence');
  for(const view of [{layoutMode:'auto'},{layoutMode:'free',orgGroups:{'dept:ИТ-департамент':{x:950,y:730}}},{layoutMode:'auto',collapsed:['Служба ИБ']}]){
    const model=layout(record.people,edges,'influence',view,{w:2600,h:950,orderByManager:true});
    const html=edgeArt(edges,model,'influence');
    const expected=new Set(edges.flatMap(e=>{
      const a=model.nodes.get(e.a).group,b=model.nodes.get(e.b).group;
      return a!==b?[a.key+'→'+b.key]:[];
    }));
    const connections=[...html.matchAll(/<g class="connection [\s\S]*?<\/g>/g)].map(m=>m[0]).filter(s=>s.includes(' · Связей '));
    assert.equal(connections.length,expected.size,'all direct department links remain available');
    for(const connection of connections){
      const path=connection.match(/class="connection-line" d="([^"]+)"/)[1];
      assert.ok(!path.includes('C'),'no sweeping Bézier curves');
      const angle=Number(connection.match(/rotate\(([^)]+)\)/)[1]);
      assert.ok([0,90,180,-90].includes(angle),'arrow meets its frame at a right angle');
      let previous;
      for(const [,command,raw] of path.matchAll(/([MLQ])([^MLQ]*)/g)){
        const n=raw.trim().split(/[ ,]+/).map(Number),end={x:n.at(-2),y:n.at(-1)};
        if(previous){
          if(command==='L')assert.ok(Math.abs(end.x-previous.x)<.11||Math.abs(end.y-previous.y)<.11,'straight sections are horizontal or vertical');
          for(let i=0;i<=20;i++){
            const t=i/20,u=1-t;
            const p=command==='Q'?{x:u*u*previous.x+2*u*t*n[0]+t*t*end.x,y:u*u*previous.y+2*u*t*n[1]+t*t*end.y}:{x:previous.x+(end.x-previous.x)*t,y:previous.y+(end.y-previous.y)*t};
            assert.ok(!model.groups.some(g=>p.x>g.x+1&&p.x<g.x+g.w-1&&p.y>g.y+1&&p.y<g.y+g.h-1),'line stays outside every department');
          }
        }
        previous=end;
      }
      const segments=[...path.matchAll(/([MLQ])([^MLQ]*)/g)].map(([,c,v])=>({c,n:v.trim().split(/[ ,]+/).map(Number)}));
      const last=segments.at(-1).n,before=segments.at(-2).n;
      assert.ok(Math.abs(last[0]-before.at(-2))+Math.abs(last[1]-before.at(-1))>=7,'arrowhead has a straight lead-in');
    }
  }
});

test('overlapping influence spans have distinct lanes, including after reordering',()=>{
  const initial=arrange(links);
  const group=initial.groups[0];
  const moved=arrange(links,'influence',{layoutMode:'free',orgGroups:{
    [group.key]:{x:group.x-41,y:group.y-83,order:['e','b','a','f','d','c']}
  }});
  assert.equal(moved.groups[0].w,group.w);
  assert.equal(moved.groups[0].h,group.h);
  for(const model of [initial,moved]){
    const frame=model.groups[0];
    const paths=pathsFor(model);
    assert.equal(paths.size,links.length);
    const rank=new Map(frame.members.map((id,index)=>[id,index]));
    const lanes=links.flatMap(({a,b},index)=>{
      const first=Math.min(rank.get(a),rank.get(b)),last=Math.max(rank.get(a),rank.get(b));
      if(last-first===1)return [];
      const card=model.nodes.get(a);
      const x=Number(paths.get(index).match(/ Q(-?[\d.]+)/)[1]);
      assert.ok(x>frame.x&&x<frame.x+frame.w);
      assert.ok(x<card.x||x>card.x+card.w);
      return [{first,last,x}];
    });
    for(const [index,lane] of lanes.entries())for(const other of lanes.slice(index+1)){
      if(lane.first<=other.last&&other.first<=lane.last)assert.ok(Math.abs(lane.x-other.x)>=8);
    }
  }
  assert.deepEqual([...pathsFor(moved,edge=>matchesInfluenceEvidence(edge,'assumed')).keys()],[1,3,5,7]);
});

test('long reciprocal department links occupy separate horizontal tracks',()=>{
  const groups=['a','b','c','d'].map((key,i)=>({key,name:key,x:i*360,y:0,w:280,h:330}));
  const nodes=new Map(groups.map(g=>[g.key,{p:{id:g.key,name:g.name},group:g}]));
  const edges=[['a','d'],['d','a'],['a','c'],['c','a']].map(([a,b])=>({a,b,kind:'influence',strength:'strong'}));
  const html=edgeArt(edges,{nodes,groups,bounds:{x:0,y:0,r:1360,b:330}},'influence');
  const paths=[...html.matchAll(/class="connection-line" d="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(paths.length,edges.length);
  const tracks=paths.map(path=>{
    let previous;const ys=[];
    for(const [,command,raw] of path.matchAll(/([MLQ])([^MLQ]*)/g)){
      const n=raw.trim().split(/[ ,]+/).map(Number),end={x:n.at(-2),y:n.at(-1)};
      if(previous&&command==='L'&&end.y===previous.y&&Math.abs(end.x-previous.x)>300)ys.push(end.y);
      previous=end;
    }
    assert.ok(ys.length,'long link uses a horizontal external track');
    return ys;
  });
  for(let i=0;i<tracks.length;i++)for(const other of tracks.slice(i+1))for(const y of tracks[i])assert.ok(other.every(v=>Math.abs(v-y)>=12),'parallel tracks stay separated');
});

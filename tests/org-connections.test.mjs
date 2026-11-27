import assert from 'node:assert/strict';
import {test} from 'node:test';
import {edgeArt} from '../edge-art.js';

const parent={key:'board',name:'Дирекция',x:930,y:0,w:280,h:200};
const children=Array.from({length:7},(_,i)=>({key:'dept'+i,name:'Отдел '+i,x:i*310,y:254,w:280,h:320}));
const edges=children.map(g=>({a:parent.key,b:g.key,kind:'formal'}));
function model(groups){
  return {groups,nodes:new Map(groups.map(g=>[g.key,{x:g.x+16,y:g.y+43,w:248,h:90,group:g,p:{name:g.name}}])),bounds:{x:0,y:0,r:2300,b:700}};
}
function connections(groups){
  const html=edgeArt(edges,model(groups),'org');
  return [...html.matchAll(/<path class="connection-hit" d="([^"]+)"\/>.*?<path class="connection-tip" transform="translate\(([^)]+)\) rotate\(([^)]+)\)"/g)]
    .map(([,d,end,angle])=>({d,end,angle:Number(angle)}));
}
function samples(d){
  let point;const points=[];
  for(const [,command,raw] of d.matchAll(/([MLQ])([^MLQ]*)/g)){
    const n=raw.trim().split(/[ ,]+/).map(Number),end={x:n.at(-2),y:n.at(-1)};
    if(point)for(let i=1;i<=20;i++){
      const t=i/20,u=1-t;
      points.push(command==='Q'?{x:u*u*point.x+2*u*t*n[0]+t*t*end.x,y:u*u*point.y+2*u*t*n[1]+t*t*end.y}:{x:point.x+(end.x-point.x)*t,y:point.y+(end.y-point.y)*t});
    }
    point=end;
  }
  return points;
}
test('seven reporting departments use a common rail and upright arrowheads',()=>{
  const paths=connections([parent,...children]);
  assert.equal(paths.length,7);
  for(const [i,path] of paths.entries()){
    assert.ok(!path.d.includes('C'),'no long diagonal Bézier fans');
    assert.equal(path.angle,90,'arrow enters department from above');
    assert.equal(path.end,`${children[i].x+140} 250`);
    assert.ok(samples(path.d).every(p=>![parent,...children].some(g=>p.x>g.x&&p.x<g.x+g.w&&p.y>g.y&&p.y<g.y+g.h)),'connections stay outside department frames');
  }
  const rails=paths.filter((_,i)=>i!==3).map(p=>Number(p.d.match(/ L[^ ]+ ([\d.]+) Q/)[1]));
  assert.equal(new Set(rails).size,1,'sibling lines have the same first bend level');
});
test('a moved unrelated department is routed around without crossing its frame',()=>{
  const blocker={key:'blocker',name:'Помеха',x:500,y:212,w:90,h:28};
  const groups=[parent,...children,blocker],paths=connections(groups);
  assert.equal(paths.length,7,'all reporting links remain available');
  for(const path of paths)assert.ok(samples(path.d).every(p=>!groups.some(g=>p.x>g.x&&p.x<g.x+g.w&&p.y>g.y&&p.y<g.y+g.h)));
});

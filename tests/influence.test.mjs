import assert from 'node:assert/strict';
import {test} from 'node:test';
import {edgeArt,matchesInfluenceEvidence} from '../edge-art.js';
import {layout} from '../map-layout.js';

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
  assert.equal(gap(arrange([],'org')),12);
  const paths=pathsFor(influence);
  const startX=index=>Number(paths.get(index).match(/^M([\d.]+)/)[1]);
  assert.ok(Math.abs(startX(0)-startX(1))>=14);
  assert.match(paths.get(0),/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
  assert.match(paths.get(1),/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
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

const center=b=>({x:(b.x+b.r)/2,y:(b.y+b.b)/2});
function framed(bounds,space){
  const width=Math.max(1,bounds.r-bounds.x),height=Math.max(1,bounds.b-bounds.y);
  const z=Math.min(space.w/width,space.h/height,1.32);
  const c=center(bounds);
  return {x:space.left+space.w/2-c.x*z,y:space.top+space.h/2-c.y*z,z};
}
function envelope(nodes){
  return {x:Math.min(...nodes.map(n=>n.x)),y:Math.min(...nodes.map(n=>n.y)),r:Math.max(...nodes.map(n=>n.x+n.w)),b:Math.max(...nodes.map(n=>n.y+n.h))};
}
export function frameObjects(boxes,space,zoom=1){
  if(!boxes.length)return null;
  const b=envelope(boxes),padding=14;
  const z=Math.min(Math.max(.95,zoom),1.4,space.w/(b.r-b.x+padding*2),space.h/(b.b-b.y+padding*2));
  const c=center(b);
  return {z,x:space.left+space.w/2-c.x*z,y:space.top+space.h/2-c.y*z};
}
export function boardSpace(width,height,assistant=false){
  const left=width<540?12:20,top=assistant?52:18;
  return {left,top,w:Math.max(1,width-left*2),h:Math.max(1,height-top-(height<360?37:54))};
}
export function frameBoard(model,space,edges,selected,overview){
  const all=framed(model.bounds,space);
  if(overview||all.z>=.88)return all;
  const nodes=[...model.nodes.values()].filter(n=>!n.hidden);
  if(!nodes.length)return all;
  const keys=nodes.filter(n=>n.p.id===selected||n.p.primary||n.p.decision);
  if(!keys.length)keys.push(nodes.find(n=>n.p.state==='active')||nodes[0]);
  const ids=new Set(keys.map(n=>n.p.id));
  const adjacent=new Set(edges.filter(e=>ids.has(e.a)||ids.has(e.b)).flatMap(e=>[e.a,e.b]));
  const target=center(envelope(keys));
  const distance=n=>Math.abs(n.x+n.w/2-target.x)+Math.abs(n.y+n.h/2-target.y);
  const rest=nodes.filter(n=>!ids.has(n.p.id)).sort((a,b)=>Number(adjacent.has(b.p.id))-Number(adjacent.has(a.p.id))||distance(a)-distance(b));
  for(const node of rest){
    if(framed(envelope([...keys,node]),space).z>=.92)keys.push(node);
  }
  return framed(envelope(keys),space);
}
export function wasAutomatic(camera,b,w,h){
  const z=Math.max(.28,Math.min((w-64)/(b.r-b.x),(h-110)/(b.b-b.y),1.12));
  const c=center(b);
  return Math.abs(camera.z-z)<.0001&&Math.abs(camera.x-(w/2-c.x*z))<1&&Math.abs(camera.y-((h-42)/2-c.y*z))<1;
}

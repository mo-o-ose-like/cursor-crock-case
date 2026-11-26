const histories=new Map();
export const edgeId=e=>JSON.stringify([e.kind,e.a,e.b]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=value=>value===undefined?undefined:structuredClone(value);
function changes(before,after,keyOf){
  const left=new Map(before.map(x=>[keyOf(x),x])),right=new Map(after.map(x=>[keyOf(x),x]));
  return [...new Set([...left.keys(),...right.keys()])].filter(key=>!same(left.get(key),right.get(key))).map(key=>({key,from:clone(left.get(key)),to:clone(right.get(key)),fromIndex:before.findIndex(x=>keyOf(x)===key),toIndex:after.findIndex(x=>keyOf(x)===key)}));
}
function mergeRows(rows,patch,keyOf,reverse){
  const out=[...rows];
  for(const item of patch){
    const from=reverse?item.to:item.from,to=reverse?item.from:item.to;
    const i=out.findIndex(x=>keyOf(x)===item.key);
    if(!to){if(i>=0)out.splice(i,1);continue}
    if(!from){if(i<0)out.splice(reverse?item.fromIndex:item.toIndex,0,clone(to));continue}
    if(i<0)continue;
    const updated={...out[i]};
    for(const key of new Set([...Object.keys(from),...Object.keys(to)])){
      if(same(from[key],to[key]))continue;
      if(key==='discAssessments'||key==='managerOpinions'){
        const baseline=from[key]||[],next=to[key]||[];
        const byId=row=>row.id;
        const edits=changes(baseline,next,byId);
        const rows=mergeRows(updated[key]||[],edits,byId,false);
        if(rows.length||to[key])updated[key]=rows;else delete updated[key];
      }else if(to[key]===undefined)delete updated[key];
      else if(Array.isArray(from[key])&&Array.isArray(to[key])&&Array.isArray(updated[key])&&!same(updated[key],from[key])){
        const removals=[...from[key]], additions=[];
        for(const value of to[key]){const index=removals.findIndex(old=>same(old,value));if(index<0)additions.push(clone(value));else removals.splice(index,1)}
        updated[key]=updated[key].filter(value=>{const index=removals.findIndex(old=>same(old,value));if(index<0)return true;removals.splice(index,1);return false}).concat(additions);
      }else updated[key]=clone(to[key]);
    }
    out[i]=updated;
  }
  return out;
}
export function recordDiff(from,to){
  return {people:changes(from.people,to.people,p=>p.id),edges:changes(from.edges,to.edges,edgeId)};
}
export function applyRecordDiff(record,patch,reverse=false){
  const people=mergeRows(record.people,patch.people,p=>p.id,reverse),ids=new Set(people.map(p=>p.id));
  return {...record,people,edges:mergeRows(record.edges,patch.edges,edgeId,reverse).filter(e=>ids.has(e.a)&&ids.has(e.b))};
}
export function viewEdit(view){
  return clone({positions:view.positions||{},layoutMode:view.layoutMode||(Object.keys(view.positions||{}).length?'free':'auto'),histories:view.histories||{},branches:view.branches||{}});
}
export function historyFor(id){
  if(!histories.has(id))histories.set(id,{undo:[],redo:[]});
  return histories.get(id);
}
export function remember(stack,step){
  if(!step.patch?.people.length&&!step.patch?.edges.length&&same(step.before,step.after))return;
  stack.undo.push(step);if(stack.undo.length>80)stack.undo.shift();stack.redo.length=0;
}
export function restoreView(view,oldEdit,newEdit){
  for(const key of Object.keys(newEdit))if(!same(oldEdit[key],newEdit[key]))view[key]=clone(newEdit[key]);
}

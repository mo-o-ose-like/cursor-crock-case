import {esc} from './components.js';

const labels = {
  org: {formal: 'Формальное подчинение'},
  process: {done: 'Пройденный путь', established: 'Установленная связь', planned: 'Запланированная связь'},
  influence: {strong: 'Сильное · подтверждено', limited: 'Ограниченное · подтверждено', assumed: 'Предполагаемое · не подтверждено'},
  scenario: {current: 'Текущая связь', new: 'Предлагается добавить', remove: 'Предлагается удалить', change: 'Предлагается изменить'}
};

function lineType(e, mode) {
  if (mode === 'org') return 'formal';
  if (mode === 'scenario') return Object.hasOwn(labels.scenario, e.proposal) ? e.proposal : 'current';
  if (Object.hasOwn(labels[mode], e.status)) return e.status;
  if (mode === 'influence') return Object.hasOwn(labels.influence, e.strength) ? e.strength : 'limited';
  if (e.strength === 'assumed') return 'planned';
  if (e.strength === 'limited') return 'done';
  return 'established';
}

const sides = {
  top: {x: 0, y: -1}, bottom: {x: 0, y: 1},
  left: {x: -1, y: 0}, right: {x: 1, y: 0}
};
const center = box => ({x: box.x + box.w / 2, y: box.y + box.h / 2});
const shift = (p, dir, distance) => ({x: p.x + dir.x * distance, y: p.y + dir.y * distance});
const length = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const fmt = n => Math.round(n * 10) / 10;
const coords = p => fmt(p.x) + ' ' + fmt(p.y);

function port(box, side, fraction, clearance) {
  const dir = sides[side];
  const c = center(box);
  const edge = dir.x ? {x: c.x + dir.x * box.w / 2, y: box.y + box.h * fraction}
    : {x: box.x + box.w * fraction, y: c.y + dir.y * box.h / 2};
  return shift(edge, dir, clearance);
}

function simplify(points) {
  const vertices = [];
  for (const p of points) {
    const b = vertices.at(-1);
    if (b && length(b, p) < 0.05) continue;
    const a = vertices.at(-2);
    if (a && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) {
      // A reversed segment would point the arrow back into its own shaft.
      if ((b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) < 0) return null;
      vertices.pop();
    }
    vertices.push(p);
  }
  return vertices.length >= 2 ? vertices : null;
}

function intersects(a, b, rect) {
  if (a.x === b.x) return a.x > rect.x && a.x < rect.x + rect.w &&
    Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.h;
  return a.y > rect.y && a.y < rect.y + rect.h &&
    Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.w;
}

function roundedPath(points) {
  let d = 'M' + coords(points[0]);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const r = Math.min(11, length(a, b) / 2, length(b, c) / 2);
    const toward = p => ({x: b.x + Math.sign(p.x - b.x) * r, y: b.y + Math.sign(p.y - b.y) * r});
    d += ' L' + coords(toward(a)) + ' Q' + coords(b) + ' ' + coords(toward(c));
  }
  return d + ' L' + coords(points.at(-1));
}

function preferredSides(a, b, org) {
  const ca = center(a), cb = center(b);
  const horizontal = cb.x >= ca.x ? 'right' : 'left';
  const vertical = cb.y >= ca.y ? 'bottom' : 'top';
  const otherH = horizontal === 'right' ? 'left' : 'right';
  const otherV = vertical === 'bottom' ? 'top' : 'bottom';
  const separateRows = Math.abs(cb.y - ca.y) > (a.h + b.h) / 2 + 8;
  return separateRows && (org || Math.abs(cb.y - ca.y) > Math.abs(cb.x - ca.x) * 0.22)
    ? [vertical, horizontal, otherH, otherV] : [horizontal, vertical, otherV, otherH];
}

// Adjacent links use different portions of a card's side. Stable sorting keeps
// the ports attached to the same people when a card is dragged or filtered.
function portFraction(neighbors, index) {
  const count = neighbors.length;
  return count < 2 ? 0.5 : 0.32 + 0.36 * neighbors.indexOf(index) / (count - 1);
}

// A dense free layout can need more turns than the usual two-elbow connector.
// Walk clear horizontal/vertical tracks just outside the surrounding rectangles.
function clearDetour(s,t,obstacles){
  const margin=48;
  const left=Math.min(s.x,t.x)-margin,right=Math.max(s.x,t.x)+margin;
  const top=Math.min(s.y,t.y)-margin,bottom=Math.max(s.y,t.y)+margin;
  const nearby=obstacles.filter(r=>r.x<=right&&r.x+r.w>=left&&r.y<=bottom&&r.y+r.h>=top);
  const tracks=(start,end,lo,hi,axis,span)=>[...new Set([start,end,lo,hi,...nearby.flatMap(r=>[r[axis]-12,r[axis]+r[span]+12]).filter(v=>v>=lo&&v<=hi)])].sort((a,b)=>a-b);
  const xs=tracks(s.x,t.x,left,right,'x','w'),ys=tracks(s.y,t.y,top,bottom,'y','h');
  const columns=xs.length,first=ys.indexOf(s.y)*columns+xs.indexOf(s.x),last=ys.indexOf(t.y)*columns+xs.indexOf(t.x);
  const previous=new Map([[first,-1]]),queue=[first];
  const point=k=>({x:xs[k%columns],y:ys[Math.floor(k/columns)]});
  for(let i=0;i<queue.length&&!previous.has(last);i++){
    const key=queue[i],col=key%columns,row=Math.floor(key/columns),a=point(key);
    const next=[];
    if(col>0)next.push(key-1);if(col+1<columns)next.push(key+1);
    if(row>0)next.push(key-columns);if(row+1<ys.length)next.push(key+columns);
    next.sort((j,k)=>length(point(j),t)-length(point(k),t));
    for(const n of next){
      if(previous.has(n))continue;
      const b=point(n);
      if(nearby.some(rect=>intersects(a,b,rect)))continue;
      previous.set(n,key);queue.push(n);
    }
  }
  if(!previous.has(last))return null;
  const path=[];for(let key=last;key!==-1;key=previous.get(key))path.push(point(key));
  return path.reverse();
}

function route(a, b, f1, f2, obstacles, org) {
  const fromSides = preferredSides(a, b, org), toSides = preferredSides(b, a, org);
  let best = null, bestScore = Infinity;
  for (const [i, from] of fromSides.entries()) {
    for (const [j, to] of toSides.entries()) {
      const preference = (i + j) * 33;
      const start = port(a, from, f1, 2), end = port(b, to, f2, 3);
      const s = shift(start, sides[from], 14), t = shift(end, sides[to], 10);
      if (length(start, end) + preference >= bestScore) continue;
      const test = bends => {
        const points = simplify([start, s, ...bends, t, end]);
        if (!points) return;
        let score = preference + (points.length - 2) * 10;
        for (let k = 1; k < points.length; k++) {
          const a = points[k - 1], b = points[k];
          score += length(a, b);
          if (score >= bestScore) return;
          for (const o of obstacles) if (intersects(a, b, o)) score += 12000;
        }
        if (score < bestScore) {bestScore = score; best = points}
      };
      // Start with compact orthogonal connectors. Extra lanes pass just outside
      // cards and department headers when a straight route would cross them.
      test([{x: s.x, y: t.y}]);
      test([{x: t.x, y: s.y}]);
      const xs = new Set([(s.x + t.x) / 2, a.x - 12, a.x + a.w + 12, b.x - 12, b.x + b.w + 12]);
      const ys = new Set([(s.y + t.y) / 2, a.y - 13, a.y + a.h + 13, b.y - 13, b.y + b.h + 13]);
      for (const o of obstacles) {
        if (!intersects(s, {x:s.x,y:t.y}, o) && !intersects({x:s.x,y:t.y}, t, o)) continue;
        xs.add(o.x - 11); xs.add(o.x + o.w + 11);
        ys.add(o.y - 11); ys.add(o.y + o.h + 11);
      }
      for (const x of xs) test([{x, y: s.y}, {x, y: t.y}]);
      for (const y of ys) test([{x: s.x, y}, {x: t.x, y}]);
    }
  }
  if(best&&bestScore>=12000&&best.some((p,i)=>i>0&&obstacles.some(o=>intersects(best[i-1],p,o)))){
    for(const from of fromSides)for(const to of toSides){
      const start=port(a,from,f1,2),end=port(b,to,f2,3);
      const s=shift(start,sides[from],14),t=shift(end,sides[to],14);
      if(obstacles.some(o=>intersects(start,s,o)||intersects(t,end,o)))continue;
      const detour=clearDetour(s,t,obstacles);
      const path=detour&&simplify([start,...detour,end]);
      if(path)return path;
    }
  }
  return best;
}

export function edgeLegend(mode) {
  const entries = Object.entries(labels[mode] || {});
  if (!entries.length) return '';
  return '<div class="connection-legend" aria-label="Обозначения связей"><b class="legend-heading">Стрелки</b>' + entries.map(([type, text]) =>
    '<div class="connection-example edge-' + type + '"><svg viewBox="0 0 31 12" width="31" height="12" aria-hidden="true">' +
    '<path class="connection-line" d="M1 6H27"/><path class="connection-tip" d="m22 2 7 4-7 4"/></svg>' +
    '<span>' + text + '</span></div>').join('') + '</div>';
}

export function edgeArt(edges, model, mode, selected, matching, staleEdges) {
  const incidents = new Map();
  const obstacles = [...model.nodes.values()].filter(n => !n.hidden);
  for (const g of model.groups) obstacles.push({x:g.x,y:g.y,w:g.w,h:g.collapsed ? g.h : 38});
  const lines = [];
  edges.forEach((edge, index) => {
    const na = model.nodes.get(edge.a), nb = model.nodes.get(edge.b);
    if (!na || !nb) return;
    const a = na.hidden ? na.group : na, b = nb.hidden ? nb.group : nb;
    if (!a || !b || a === b) return;
    for (const box of [a,b]) {
      if (!incidents.has(box)) incidents.set(box, []);
      incidents.get(box).push(index);
    }
    lines.push({edge, index, na, nb, a, b});
  });
  const groups = lines.map(({edge, index, na, nb, a, b}) => {
    const points = route(a, b, portFraction(incidents.get(a), index),
      portFraction(incidents.get(b), index), obstacles, mode === 'org');
    if (!points) return '';
    const d = roundedPath(points);
    const type = lineType(edge, mode);
    const label = esc(na.p.name + ' → ' + nb.p.name + '. ' + labels[mode][type]);
    const faded = matching && !matching.get(edge.a) && !matching.get(edge.b);
    const incident = edge.a === selected || edge.b === selected;
    const end = points.at(-1), prev = points.at(-2);
    const angle = Math.round(Math.atan2(end.y - prev.y, end.x - prev.x) * 180 / Math.PI);
    const stale=staleEdges?.has(JSON.stringify([edge.kind,edge.a,edge.b]));
    return '<g class="connection edge-' + type + (stale?' stale-connection':'') + (faded ? ' edge-muted' : '') + (incident ? ' edge-incident' : '') +
      '" data-edge-index="' + index + '" role="button" tabindex="0" aria-label="' + label + '">' +
      '<path class="connection-hit" d="' + d + '"/><path class="connection-halo" d="' + d + '"/>' +
      '<path class="connection-line" d="' + d + '"/><path class="connection-tip" transform="translate(' + coords(end) +
      ') rotate(' + angle + ')" d="M-7 -4 0 0-7 4"/></g>';
  }).join('');
  const box = model.bounds;
  // A real viewport makes links interactive at negative coordinates as well.
  const x = box.x - 45, y = box.y - 45, w = Math.max(1, box.r - box.x + 90), h = Math.max(1, box.b - box.y + 90);
  return '<svg class="edges connection-layer" role="group" aria-label="Направленные связи" style="left:' +
    x + 'px;top:' + y + 'px" width="' + w + '" height="' + h + '" viewBox="' +
    [x,y,w,h].join(' ') + '">' + groups + '</svg>';
}

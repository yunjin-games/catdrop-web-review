// Independent web port of reference/kotlin-engine/Rules.kt. No Android dependency.
export const DIRS = { U:[0,-1], D:[0,1], L:[-1,0], R:[1,0], UR:[1,-1], DR:[1,1], DL:[-1,1], UL:[-1,-1] };
export const key = p => `${p[0]},${p[1]}`;
export const same = (a,b) => a[0] === b[0] && a[1] === b[1];
const shift = (p,d) => [p[0]+d[0],p[1]+d[1]];
const sortPos = (a,b) => a[1]-b[1] || a[0]-b[0];
export const colorAt = (cat,turn) => !cat.alt || (turn+(cat.phase||0))%2===0 ? cat.breed : cat.alt;
export const homeAt = (s,p) => s.homes.find(h => h.cells.some(c => same(c,p)));
export const inBoard = (s,p) => s.cells[p[1]]?.[p[0]] === '#';
export const won = s => s.homes.length === 0;
export function createState(level) { return { cols:level.cols,rows:level.rows,cells:level.cells,arrows:level.arrows||[],cats:structuredClone(level.cats),homes:structuredClone(level.homes),queues:structuredClone(level.queues),turn:0 }; }
export function swept(cells,d) {
  if (!d[0] || !d[1]) return [];
  const exclude = new Set([...cells,...cells.map(p=>shift(p,d))].map(key));
  return [...new Map([...cells.map(p=>[p[0]+d[0],p[1]]),...cells.map(p=>[p[0],p[1]+d[1]])].filter(p=>!exclude.has(key(p))).map(p=>[key(p),p])).values()].sort(sortPos);
}
const illegal = reason => ({ok:false,reason});
const finish = (state,events) => { if(won(state)) events.push({type:'won'}); return {ok:true,state,events}; };
export function slide(s,id,direction) {
  const h=s.homes.find(h=>h.id===id), d=DIRS[direction];
  if(!h) return illegal('no-home'); if(!d) return illegal('direction');
  const axis=d[1]===0?'h':d[0]===0?'v':null;
  if(h.axis && h.axis!==axis) return illegal('axis');
  const dest=h.cells.map(p=>shift(p,d)), path=[...swept(h.cells,d),...dest];
  for(const p of path) {
    if(!h.cells.some(c=>same(c,p))) { const arrow=s.arrows.find(a=>a.x===p[0]&&a.y===p[1]); if(arrow&&arrow.dir!==direction) return illegal('oneway'); }
    if(!inBoard(s,p)) return illegal('edge');
    const other=homeAt(s,p); if(other && other.id!==id) return illegal('home');
    const cat=s.cats.find(c=>c.x===p[0]&&c.y===p[1]);
    if(cat?.sleep) return illegal('sleeping'); if(cat?.box) return illegal('boxed');
    if(cat && colorAt(cat,s.turn)!==h.breed) return illegal('cat');
  }
  let count=h.count, cats=structuredClone(s.cats); const events=[];
  for(const p of path) { if(count===0) break; const i=cats.findIndex(c=>c.x===p[0]&&c.y===p[1]); if(i>=0) {cats.splice(i,1);count--;events.push({type:'absorbed',homeId:id,from:p,breed:h.breed});} }
  const adjacent=[...new Map(dest.flatMap(p=>Object.values(DIRS).slice(0,4).map(d=>shift(p,d))).filter(p=>!dest.some(c=>same(c,p))).map(p=>[key(p),p])).values()].sort(sortPos);
  for(const p of adjacent) { const c=cats.find(c=>c.x===p[0]&&c.y===p[1]); if(c?.sleep) { c.sleep=false;events.push({type:'woke',pos:p}); } else if(c?.box) { c.box=false;events.push({type:'opened',pos:p}); } }
  const homes=s.homes.map(x=>x.id===id?{...h,cells:dest,count}:x).filter(x=>x.count>0);
  if(count===0) events.push({type:'homeDone',homeId:id});
  return finish({...s,cats,homes,turn:s.turn+1},events);
}
export function settle(s) {
  const queues=structuredClone(s.queues),homes=[],events=[];
  for(const h of s.homes) {
    let count=h.count;
    queues.forEach((q,qi)=> { if(!h.cells.some(p=>p[0]===q.x&&p[1]===q.y)) return;
      while(count>0&&q.breeds[0]===h.breed) {q.breeds.shift();count--;events.push({type:'absorbed',homeId:h.id,breed:h.breed,queueIndex:qi});}
    });
    if(count===0) events.push({type:'homeDone',homeId:h.id}); else homes.push({...h,count});
  }
  const next={...s,homes,queues}; if(won(next)&&!won(s)) events.push({type:'won'});
  return {ok:true,state:next,events};
}
export function step(s,id,dir) { const a=slide(s,id,dir); if(!a.ok) return a; const b=settle(a.state);return {...b,events:[...a.events,...b.events]}; }
export function magnet(s,id) {
  const h=s.homes.find(h=>h.id===id); if(!h) return illegal('no-home');
  let count=h.count; const events=[],cats=structuredClone(s.cats),queues=structuredClone(s.queues);
  const targets=cats.filter(c=>colorAt(c,s.turn)===h.breed).sort((a,b)=>a.y-b.y||a.x-b.x);
  for(const c of targets) {if(!count) break;cats.splice(cats.indexOf(c),1);count--;events.push({type:'absorbed',homeId:id,breed:h.breed,from:[c.x,c.y]});}
  queues.forEach((q,qi)=>{ while(count>0&&q.breeds.includes(h.breed)) {q.breeds.splice(q.breeds.indexOf(h.breed),1);count--;events.push({type:'absorbed',homeId:id,breed:h.breed,queueIndex:qi});} });
  if(count>0) return illegal('not-enough'); events.push({type:'homeDone',homeId:id});
  return finish({...s,cats,queues,homes:s.homes.filter(h=>h.id!==id)},events);
}
export function moveCat(s,from,to,laser=false) {
  const c=s.cats.find(c=>c.x===from[0]&&c.y===from[1]);
  if(!c) return illegal('no-cat'); if(c.sleep) return illegal('sleeping'); if(c.box) return illegal('boxed');
  if(same(from,to)) return illegal('same'); if(laser && Math.abs(to[0]-from[0])+Math.abs(to[1]-from[1])!==1) return illegal('direction');
  if(!inBoard(s,to)) return illegal('edge'); if(homeAt(s,to)) return illegal('home');
  if(s.cats.some(c=>c.x===to[0]&&c.y===to[1])) return illegal('cat');
  if(s.queues.some(q=>q.x===to[0]&&q.y===to[1]&&q.breeds.length)) return illegal('queue');
  return {ok:true,state:{...s,cats:s.cats.map(x=>x===c?{...c,x:to[0],y:to[1]}:x)},events:[{type:'catMoved',from,to}]};
}
// Android's drag thresholds: split long motion, allow diagonal movement, slide along blocked axes.
export class Drag {
  constructor(state,id) { this.state=state;this.id=id;this.x=0;this.y=0; }
  legal(dir) { return slide(this.state,this.id,dir).ok; }
  drag(dx,dy) {
    const events=[],n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.25));
    const dirOf=(x,y)=>Object.keys(DIRS).find(d=>DIRS[d][0]===Math.sign(x)&&DIRS[d][1]===Math.sign(y));
    for(let i=0;i<n;i++) {
      if(!this.state.homes.some(h=>h.id===this.id)) break;
      let x=this.x+dx/n,y=this.y+dy/n;
      if((x>0&&!this.legal('R'))||(x<0&&!this.legal('L'))) x=0;
      if((y>0&&!this.legal('D'))||(y<0&&!this.legal('U'))) y=0;
      if(x&&y&&!this.legal(dirOf(x,y))) {if(Math.abs(x)>=Math.abs(y)) y=0;else x=0;}
      this.x=x;this.y=y;
      if(Math.max(Math.abs(x),Math.abs(y))<.5) continue;
      const major=Math.abs(x)>=Math.abs(y)?dirOf(x,0):dirOf(0,y);
      const dirs=Math.min(Math.abs(x),Math.abs(y))>=Math.max(Math.abs(x),Math.abs(y))*.4142?[dirOf(x,y),major]:[major];
      for(const dir of dirs) { const r=step(this.state,this.id,dir);if(!r.ok)continue;
        this.state=r.state;events.push(...r.events);const d=DIRS[dir];this.x=d[0]?this.x-d[0]:0;this.y=d[1]?this.y-d[1]:0;break;
      }
    }
    return events;
  }
}

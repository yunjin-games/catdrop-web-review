export const defaults = () => ({version:1,level:1,coins:0,magnet:0,mouse:0,laser:0,chest:0,music:false,sfx:true,granted:[],attendanceDay:0,streak:0,language:null,seenIntros:[]});
export const boosters = {magnet:{level:8,price:200,icon:'ic_magnet',label:'고양이 밥'},mouse:{level:12,price:120,icon:'ic_claw',label:'장난감 쥐'},laser:{level:30,price:80,icon:'ic_laser',label:'레이저'}};
export function decodeProgress(raw) {
  const d=defaults(); if(!raw)return d;
  try {const p=JSON.parse(raw);if(!p||p.version!==1)return d;
    for(const k of ['level','coins','magnet','mouse','laser','chest','attendanceDay','streak']) if(Number.isSafeInteger(p[k])&&p[k]>=0&&p[k]<1e9) d[k]=p[k];
    d.level=Math.max(1,d.level);d.chest%=9;
    for(const k of ['music','sfx'])if(typeof p[k]==='boolean')d[k]=p[k];
    d.granted=Array.isArray(p.granted)?p.granted.filter(k=>Object.hasOwn(boosters,k)):[];
    d.language=['en','ko','ja','zh-CN','zh-TW','de'].includes(p.language)?p.language:null;
    d.seenIntros=Array.isArray(p.seenIntros)?p.seenIntros.filter(k=>['box','chameleon','arrow'].includes(k)):[];return d;
  } catch{return d;}
}
export function cleared(p) {
  const q=structuredClone(p);q.level++;q.coins+=10;q.chest++;
  const rewards=[];
  if(q.chest>=9){q.chest=0;q.coins+=20;q.magnet++;rewards.push({kind:'chest'});}
  for(const [k,b]of Object.entries(boosters))if(q.level>=b.level&&!q.granted.includes(k)){q.granted.push(k);q[k]+=4;rewards.push({kind:'unlock',booster:k});}
  return {progress:q,rewards};
}
export function attend(p,day) {
  if(p.attendanceDay===day)return p;
  const q=structuredClone(p);q.streak=p.attendanceDay===day-1?p.streak+1:1;q.attendanceDay=day;
  const rewards=[{coins:20},{magnet:1},{coins:30},{mouse:1},{coins:50},{magnet:1},{coins:100,mouse:1}];
  for(const [k,v]of Object.entries(rewards[(q.streak-1)%7]))q[k]+=v;
  return q;
}

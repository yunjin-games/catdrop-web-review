import {createState,step,settle,Drag,magnet,moveCat,homeAt,inBoard,colorAt,won,DIRS} from './engine.js';
import {decodeProgress,cleared,boosters,attend} from './progress.js';
import {Platform} from './platform.js';
import {HOUSE_PIECES,drawHouse} from './house.js';
import {t,setLanguage,language,localizePage,languageOptions} from './i18n.js';
import config from './config.js';

const $=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d'),platform=new Platform();
const images=new Map(),breeds=['tabby','blue','siamese','tuxedo','white','black','calico','mackerel'];
const palette={tabby:'#dca45e',blue:'#9cafbf',siamese:'#c7a489',tuxedo:'#9e8b94',white:'#d6c2c6',black:'#8e879d',calico:'#d2ae8b',mackerel:'#a7b58a'};
let progress,state,level,index,number=1,selected=null,drag=null,pointer=null,history=[],mode=null,catFrom=null,geometry,loading=true,clearing=false,toastTimer,adMuted=false;
const dialog=$('dialog');
document.documentElement.dataset.platform=config.platform;
const bgm=new Audio('./assets/audio/bgm.ogg');bgm.loop=true;bgm.volume=.32;
function audioUpdate(){const mute=adMuted||platform.forcedMute||document.hidden||dialog.open;if(!progress?.music||mute)bgm.pause();else bgm.play().catch(()=>{});}
platform.onMute=value=>{adMuted=value;audioUpdate();};
platform.onBusy=value=>{dialog.inert=value;document.getElementById('app').inert=value;};
function sound(name){if(!progress?.sfx||adMuted||platform.forcedMute||document.hidden)return;const a=new Audio(`./assets/audio/${name}.wav`);a.volume=.45;a.play().catch(()=>{});}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
function save(){
  const payload={...progress,game:state&&!won(state)?{number,id:level.id,state}:null};
  platform.write(JSON.stringify(payload));
  $('save-status').textContent=t(platform.storageFailed?'unsaved':'saved');
}
function stats(){
  $('coin-count').textContent=progress.coins.toLocaleString();$('level-number').textContent=number;
  $('chest-count').textContent=`${progress.chest} / 9`;$('chest-fill').style.width=`${progress.chest/9*100}%`;
  $('difficulty').textContent=t(level?.difficulty||'easy');
  $('boosters').replaceChildren(...Object.entries(boosters).map(([k,b])=>{
    const button=document.createElement('button');button.className=`booster ${mode===k?'selected':''}`;button.title=`${t('booster_'+k)} · ${t('unlockAt',{level:b.level})}`;
    button.innerHTML=`<img src="./assets/art/${b.icon}.png" alt=""><b>${progress.granted.includes(k)?progress[k]:`Lv.${b.level}`}</b>${t('booster_'+k)}`;
    button.onclick=()=>{if(loading||clearing||platform.busy)return;if(!progress.granted.includes(k)){toast(t('seeYou',{level:b.level}));return;}if(!progress[k]){shop(k);return;}mode=mode===k?null:k;catFrom=null;drag=null;instructions();stats();draw();};return button;
  }));
  $('undo').disabled=!history.length||clearing;
}
function instructions(){
  $('instruction').textContent=t(mode==='magnet'?'pickHome':mode==='mouse'?(catFrom?'pickEmpty':'pickCat'):mode==='laser'?(catFrom?'pickNeighbor':'pickCat'):'instruction');
}
function modal(html,handlers={}){
  cancelDrag();platform.stop();$('dialog-body').innerHTML=html;
  for(const [id,handler]of Object.entries(handlers))$(id).onclick=handler;
  if(!dialog.open)dialog.showModal();audioUpdate();
}
function closeModal(){if(platform.busy)return;dialog.close();audioUpdate();}
dialog.addEventListener('cancel',e=>{if(clearing||loading){e.preventDefault();return;}closeModal();});
dialog.addEventListener('close',audioUpdate);
function settings(){modal(`<h2>${t('takeBreak')}</h2><p>${t('noRush')}</p><label>${t('music')}<input id="music" type="checkbox" ${progress.music?'checked':''}></label><label>${t('sfx')}<input id="sfx" type="checkbox" ${progress.sfx?'checked':''}></label><label>${t('language')}<select id="language">${Object.entries(languageOptions).map(([code,label])=>`<option value="${code}" ${language===code?'selected':''}>${label}</option>`).join('')}</select></label><button id="daily">${t('daily')}</button><button id="back" class="primary">${t('continue')}</button>`,{back:async()=>{await platform.ad('midgame');closeModal();},daily:attendance});
  $('music').onchange=e=>{progress.music=e.target.checked;save();audioUpdate();};$('sfx').onchange=e=>{progress.sfx=e.target.checked;save();};
  $('language').onchange=e=>{progress.language=setLanguage(e.target.value);localizePage();instructions();save();stats();settings();};
}
function shop(only){
  const entries=Object.entries(boosters).filter(([k])=>!only||only===k);
  modal(`<h2>${t('shop')}</h2><p>${t('balance',{coins:progress.coins.toLocaleString()})}</p>${entries.map(([k,b])=>`<button id="buy-${k}" ${!progress.granted.includes(k)||progress.coins<b.price?'disabled':''}><img src="./assets/art/${b.icon}.png" style="height:30px;vertical-align:middle" alt=""> ${t('booster_'+k)} +1 · 🪙 ${b.price}${!progress.granted.includes(k)?` (Lv.${b.level})`:''}</button>`).join('')}<button id="back" class="close">${t('back')}</button>`,{back:closeModal,...Object.fromEntries(entries.map(([k,b])=>[`buy-${k}`,()=>{if(progress.coins<b.price||!progress.granted.includes(k))return;progress.coins-=b.price;progress[k]++;save();stats();shop(only);sound('coin');}]))});
}
function attendance(){
  // Calendar date in the player's locale, consistent across repeated visits that day.
  const d=new Date(),day=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  const taken=progress.attendanceDay===day;
  modal(`<img class="hero" src="./assets/art/ic_chest.png" alt="${t('giftAlt')}"><h2>${t('welcomeBack')}</h2><p>${t('dailyText',{days:progress.streak})}</p><button id="claim" class="primary" ${taken?'disabled':''}>${t(taken?'claimed':'claim')}</button><button id="back" class="close">${t('back')}</button>`,{back:closeModal,claim:()=>{progress=attend(progress,day);save();stats();sound('chest');attendance();}});
}
async function fetchJSON(path){const r=await fetch(path,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`불러오기 실패 (${r.status})`);return r.json();}
async function load(numberToLoad,resume=null){
  loading=true;clearing=false;cancelDrag();selected=null;mode=null;catFrom=null;history=[];
  $('loading').hidden=false;$('loading').textContent=t('loading');$('loading').style.display='grid';platform.stop();platform.loading(true);
  try{
    number=numberToLoad;const entry=index[(number-1)%index.length];
    level=await fetchJSON(`./assets/levels/${entry.file}`);state=createState(level);
    if(resume&&resume.number===number&&resume.id===level.id&&validSnapshot(resume.state,level))state=resume.state;
    stats();instructions();loading=false;$('loading').style.display='none';platform.loading(false);resize();save();showMechanicIntro();
  }catch{
    platform.loading(false);modal(`<h2>${t('loadTitle')}</h2><p>${t('loadText')}</p><button id="retry" class="primary">${t('retry')}</button>`,{retry:()=>{closeModal();load(numberToLoad,resume);}});
  }
}
function validSnapshot(s,l){
  // Saved snapshots are local, versioned state; malformed data must not break boot.
  try{return s.cols===l.cols&&s.rows===l.rows&&JSON.stringify(s.cells)===JSON.stringify(l.cells)&&Array.isArray(s.cats)&&Array.isArray(s.homes)&&Array.isArray(s.queues)&&Array.isArray(s.arrows)&&Number.isSafeInteger(s.turn)&&s.turn>=0&&s.homes.length>0&&s.homes.every(h=>l.homes.some(x=>x.id===h.id)&&Number.isInteger(h.count)&&h.count>0&&Array.isArray(h.cells)&&h.cells.every(p=>inBoard(s,p)))&&s.cats.every(c=>Number.isInteger(c.x)&&Number.isInteger(c.y)&&breeds.includes(c.breed));}catch{return false;}
}
function showMechanicIntro(){
  const available=[['box',level.cats.some(c=>c.box)],['chameleon',level.cats.some(c=>c.alt)],['arrow',level.arrows?.length>0]];
  const kind=available.find(([key,present])=>present&&!progress.seenIntros.includes(key))?.[0];
  if(!kind)return;
  modal(`<img class="hero" src="./assets/art/intro_${kind}.webp" alt=""><h2>${t('guideTitle')}</h2><p>${t('guide_'+kind)}</p><button id="got-it" class="primary">${t('gotIt')}</button>`,{'got-it':()=>{progress.seenIntros.push(kind);save();closeModal();showMechanicIntro();}});
}
function apply(result){
  if(!result.ok)return false;
  state=result.state;const events=result.events;
  if(events.some(e=>e.type==='homeDone'))sound('home_done');else if(events.some(e=>e.type==='absorbed'))sound('absorb');else if(events.some(e=>e.type==='woke'))sound('wake');
  draw();if(won(state))win();else save();stats();return true;
}
function win(){
  if(clearing)return;clearing=true;platform.stop();sound('win');
  const result=cleared(progress);progress=result.progress;save();
  modal(`<img class="hero" src="./assets/cats/${level.homes[0].breed}_happy.png" alt="${t('happyAlt')}"><h2>${t('won')}</h2><p>${t('clear',{level:number})}${result.rewards.map(x=>`<br>${x.kind==='chest'?t('chestReward'):t('unlockReward',{name:t('booster_'+x.booster)})}`).join('')}</p><button id="next" class="primary">${t('next')}</button>${platform.canReward?`<button id="reward" class="reward">${t('adReward')}</button>`:''}`,{
    next:async()=>{if(platform.busy)return;$('next').disabled=true;await platform.ad('midgame');closeModal();await load(progress.level);},
    ...(platform.canReward?{reward:async()=>{const b=$('reward');b.disabled=true;$('next').disabled=true;const earned=await platform.ad('rewarded');if(earned){progress.coins+=90;save();stats();b.textContent=t('earned');}else{b.textContent=t('adUnavailable');} $('next').disabled=false;}}:{})
  });
}
function cancelDrag(){if(pointer!==null){try{canvas.releasePointerCapture(pointer);}catch{}}pointer=null;drag=null;draw();}
function position(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left-geometry.x)/geometry.cell,(e.clientY-r.top-geometry.y)/geometry.cell];}
function boosterAt(p){
  if(mode==='magnet'){
    const h=homeAt(state,p);if(!h)return toast(t('pickHome'));
    const result=magnet(state,h.id);if(!result.ok)return toast(t('cantFeed'));
    progress.magnet--;history=[];mode=null;sound('magnet');apply(result);
  }else if(!catFrom){
    const c=state.cats.find(c=>c.x===p[0]&&c.y===p[1]);if(!c||c.sleep||c.box)return toast(t('pickCat'));catFrom=p;
  }else{
    const result=moveCat(state,catFrom,p,mode==='laser');if(!result.ok){toast(t(mode==='laser'?'pickNeighbor':'pickEmpty'));return;}
    progress[mode]--;history=[];sound(mode==='laser'?'laser':'claw');mode=null;catFrom=null;apply(result);
  }
  instructions();stats();draw();
}
canvas.addEventListener('pointerdown',e=>{
  if(loading||clearing||dialog.open||platform.busy||pointer!==null||e.button!==0)return;
  e.preventDefault();canvas.focus({preventScroll:true});platform.start();audioUpdate();const p=position(e).map(Math.floor);
  if(mode){boosterAt(p);return;}const h=homeAt(state,p);if(!h){selected=null;draw();return;}
  selected=h.id;drag=new Drag(state,h.id);pointer=e.pointerId;canvas.setPointerCapture(pointer);drag.last=[e.clientX,e.clientY];drag.initial=state;drag.moved=false;sound('pick');draw();
});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==pointer||dialog.open||clearing)return;
  const dx=(e.clientX-drag.last[0])/geometry.cell,dy=(e.clientY-drag.last[1])/geometry.cell;drag.last=[e.clientX,e.clientY];
  const events=drag.drag(dx,dy);if(drag.state!==state){if(!drag.moved){history.push(state);drag.moved=true;}apply({ok:true,state:drag.state,events});}else draw();
});
const release=e=>{if(e.pointerId!==pointer)return;cancelDrag();sound('drop');};
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{pointer=null;drag=null;draw();});
canvas.addEventListener('keydown',e=>{
  if(loading||clearing||dialog.open||platform.busy)return;
  const dir={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',Home:'UL',PageUp:'UR',End:'DL',PageDown:'DR'}[e.key];
  if(!dir||!selected)return;e.preventDefault();platform.start();const r=step(state,selected,dir);if(r.ok){history.push(state);apply(r);}
});
document.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight',' '].includes(e.key)&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))e.preventDefault();
  if((e.key==='Escape'||e.key===' ')&&!dialog.open&&!loading&&!clearing&&!platform.busy)settings();
});
window.addEventListener('wheel',e=>{if(document.documentElement.dataset.platform==='poki'&&!dialog.open)e.preventDefault();},{passive:false});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();platform.stop();}audioUpdate();});
window.addEventListener('blur',()=>{cancelDrag();platform.stop();bgm.pause();});
window.addEventListener('focus',audioUpdate);
$('settings').onclick=$('pause').onclick=()=>{if(!loading&&!clearing&&!platform.busy)settings();};
$('coins').onclick=()=>{if(!loading&&!clearing&&!platform.busy)shop();};$('attendance').onclick=()=>{if(!loading&&!clearing&&!platform.busy)attendance();};
$('undo').onclick=()=>{if(!history.length||clearing||dialog.open)return;cancelDrag();state=history.pop();save();stats();draw();};
$('restart').onclick=()=>{if(loading||clearing||dialog.open||platform.busy)return;modal(`<h2>${t('restartTitle')}</h2><p>${t('restartText')}</p><button id="yes" class="primary">${t('restart')}</button><button id="back" class="close">${t('continue')}</button>`,{yes:()=>{closeModal();load(number);},back:closeModal});};

function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function sprite(name,x,y,w,h=w){const img=images.get(name);if(img)ctx.drawImage(img,x,y,w,h);}
function text(value,x,y,size,color='#66503b'){ctx.font=`${size}px Jua, sans-serif`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,x,y);}
function resize(){
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  if(state){const cell=Math.min(r.width/(state.cols+1.7),r.height/(state.rows+1.7));geometry={cell,x:(r.width-state.cols*cell)/2,y:(r.height-state.rows*cell)/2};}draw();
}
function draw(){
  if(!state||!geometry)return;const {cell:c,x:ox,y:oy}=geometry,r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);
  ctx.fillStyle='#f3ead7';ctx.fillRect(0,0,r.width,r.height);
  for(let y=0;y<state.rows;y++)for(let x=0;x<state.cols;x++){
    if(!inBoard(state,[x,y]))continue;rounded(ox+x*c+1,oy+y*c+1,c-2,c-2,5,'#fffaf0','#e8dcc3');
  }
  for(const a of state.arrows)text({U:'↑',D:'↓',L:'←',R:'→'}[a.dir],ox+(a.x+.5)*c,oy+(a.y+.5)*c,c*.5,'#b7b397');
  for(const cat of state.cats){
    const breed=colorAt(cat,state.turn),x=ox+cat.x*c,y=oy+cat.y*c;
    if(selected&&state.homes.find(h=>h.id===selected)?.breed===breed)rounded(x+1,y+1,c-2,c-2,7,'#e2ebc4');
    if(catFrom&&catFrom[0]===cat.x&&catFrom[1]===cat.y)rounded(x,y,c,c,8,'#e2edb6','#879b61');
    sprite(cat.box?'box':`${breed}_${cat.sleep?'sleep':'sit'}`,x+c*.04,y+c*.03,c*.92,c*.92);
    if(cat.sleep)text('z',x+c*.84,y+c*.18,c*.22,'#947fa3');
    if(cat.alt&&!cat.box){ctx.beginPath();ctx.arc(x+c*.5,y+c*.5,c*.43,0,Math.PI*2);ctx.strokeStyle=palette[cat.alt];ctx.lineWidth=2;ctx.stroke();}
  }
  for(const h of state.homes){
    drawHouse(ctx,images,h,geometry,{
      dx:drag?.id===h.id?drag.x*c:0,
      dy:drag?.id===h.id?drag.y*c:0,
      dragging:drag?.id===h.id,mode,selected:selected===h.id
    });
  }
  for(const q of state.queues){if(!q.breeds.length)continue;
    const d={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[q.side];
    const x=ox+(q.x+.5+d[0]*.75)*c,y=oy+(q.y+.5+d[1]*.75)*c;
    rounded(x-c*.32,y-c*.32,c*.64,c*.64,c*.15,'#fffcf2','#c6af87');sprite(`${q.breeds[0]}_sit`,x-c*.28,y-c*.28,c*.56);
    rounded(x+c*.1,y+c*.1,c*.3,c*.3,c*.1,'#e7bd6e');text(q.breeds.length,x+c*.25,y+c*.25,c*.2,'#fff');
  }
}
new ResizeObserver(resize).observe($('board-wrap'));

async function boot(){
  await platform.init();const raw=platform.read();progress=decodeProgress(raw);let resume=null;try{resume=JSON.parse(raw)?.game;}catch{}
  setLanguage(progress.language||platform.language||navigator.language);localizePage();
  if(platform.storageFailed)$('save-status').textContent=t('unsaved');
  const names=[...breeds.flatMap(b=>[`${b}_sit`,`${b}_sleep`,`${b}_happy`]),'box',...HOUSE_PIECES];
  await Promise.all(names.map(name=>new Promise(resolve=>{const img=new Image();const timer=setTimeout(resolve,8000);img.onload=()=>{clearTimeout(timer);images.set(name,img);resolve();};img.onerror=()=>{clearTimeout(timer);resolve();};img.src=`./assets/${HOUSE_PIECES.includes(name)?'art':'cats'}/${name}.png`;})));
  try{index=await fetchJSON('./assets/levels/index.json');await load(progress.level,resume);}catch{
    modal(`<h2>${t('bootTitle')}</h2><p>${t('connection')}</p><button id="retry" class="primary">${t('retry')}</button>`,{retry:()=>location.reload()});
  }
}
export const ready=boot();

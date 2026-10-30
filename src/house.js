// Same assembly, dimensions and breed tints as Android HouseLayout/BoardCanvas.
// Original PNG pieces are reused without changing the Android project.
export const HOUSE_PIECES=['house_roof_l','house_roof_m','house_roof_r','house_wall','house_door','house_window','house_ear'];
const wallColors={tabby:'#f9c98c',blue:'#b9c6de',siamese:'#f3e6cf',tuxedo:'#8c8c8c',white:'#ffffff',black:'#6a6a6a',calico:'#fff8ee',mackerel:'#c9c9c9'};
const roofColors={tabby:'#e89436',blue:'#7f93b8',siamese:'#8a6446',tuxedo:'#3e3e3e',white:'#c9d3e6',black:'#2e2e2e',calico:'#e8895a',mackerel:'#7a7a7a'};
const badgeColors={tabby:'#f2a340',blue:'#7f93b8',siamese:'#ebd9b4',tuxedo:'#e6e6e6',white:'#fafafa',black:'#ffd84d',calico:'#f5ebdd',mackerel:'#b8b8b8'};
const INK='#5b3a29',tints=new Map();
export function houseLayout(cells){
  const roofRow=Math.min(...cells.map(p=>p[1]));
  const xs=cells.filter(p=>p[1]===roofRow).map(p=>p[0]).sort((a,b)=>a-b),roofRuns=[];
  let start=xs[0],last=start;
  for(const x of xs.slice(1)){if(x!==last+1){roofRuns.push([start,last]);start=x;}last=x;}
  roofRuns.push([start,last]);
  const door=cells.reduce((a,b)=>b[1]>a[1]||b[1]===a[1]&&b[0]>a[0]?b:a);
  return {roofRow,roofRuns,door,windows:cells.filter(p=>p[1]!==roofRow&&p!==door)};
}
function tinted(images,name,color){
  const key=name+color;if(tints.has(key))return tints.get(key);
  const image=images.get(name);if(!image)return null;
  const layer=document.createElement('canvas');layer.width=image.width;layer.height=image.height;
  const g=layer.getContext('2d');g.drawImage(image,0,0);
  const pixels=g.getImageData(0,0,layer.width,layer.height),rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
  // Equivalent to Android BlendMode.Modulate; preserve source alpha and ink detail.
  for(let i=0;i<pixels.data.length;i+=4)for(let channel=0;channel<3;channel++)pixels.data[i+channel]*=rgb[channel];
  g.putImageData(pixels,0,0);tints.set(key,layer);return layer;
}
function outline(cells,c,left,top,inset){
  const path=new Path2D(),set=new Set(cells.map(p=>p.join(','))),has=(x,y)=>set.has(`${x},${y}`),r=Math.max(0,c*.14-inset);
  for(const [x,y]of cells){
    const up=has(x,y-1),down=has(x,y+1),lf=has(x-1,y),rt=has(x+1,y);
    const px=left+x*c+(lf?0:inset),py=top+y*c+(up?0:inset),w=c-(lf?0:inset)-(rt?0:inset),h=c-(up?0:inset)-(down?0:inset);
    path.roundRect(px,py,w,h,[!up&&!lf?r:0,!up&&!rt?r:0,!down&&!rt?r:0,!down&&!lf?r:0]);
  }
  return path;
}
export function drawHouse(ctx,images,h,geometry,{dx=0,dy=0,dragging=false,mode=null,selected=false}={}){
  const c=geometry.cell,left=geometry.x+dx,top=geometry.y+dy-(dragging?c*.05:0),ow=Math.max(c*.045,2);
  const dim=mode==='mouse'||mode==='laser',lit=mode==='magnet';
  ctx.save();ctx.globalAlpha=(dim&&!dragging) ? .45 : 1;
  const outer=outline(h.cells,c,left,top,0),inner=outline(h.cells,c,left,top,ow);
  if(dragging){ctx.save();ctx.shadowColor='#00000065';ctx.shadowBlur=c*.2;ctx.shadowOffsetY=c*.12;ctx.fillStyle=INK;ctx.fill(outer);ctx.restore();}
  if(lit||selected){ctx.strokeStyle=lit?'#ffffffcc':'#c1d59f';ctx.lineWidth=c*(lit?.16:.08);ctx.stroke(outer);}
  ctx.fillStyle=INK;ctx.fill(outer);
  function piece(name,x,y,w,height,color,flip=false){
    const image=tinted(images,name,color);if(!image)return;
    ctx.save();if(flip){ctx.translate(Math.round(x+w),Math.round(y));ctx.scale(-1,1);x=0;y=0;}
    ctx.drawImage(image,Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(height)));ctx.restore();
  }
  ctx.save();ctx.clip(inner);
  for(const [x,y]of h.cells)piece('house_wall',Math.floor(left+x*c),Math.floor(top+y*c),Math.ceil(c)+1,Math.ceil(c)+1,wallColors[h.breed]);
  if(lit){ctx.fillStyle='#ffffff59';ctx.fill(outer);}ctx.restore();
  const layout=houseLayout(h.cells),rh=c*.4,rt=top+layout.roofRow*c+c*.03;
  for(const [i,run]of layout.roofRuns.entries()){
    const l=left+run[0]*c+c*.01,r=left+run[1]*c+c*.99;
    const roofL=images.get('house_roof_l'),roofM=images.get('house_roof_m'),roofR=images.get('house_roof_r');
    if(roofL&&roofM&&roofR){
      const scale=rh/roofL.height,lw=roofL.width*scale,rw=roofR.width*scale,mid=r-l-lw-rw,k=Math.max(1,Math.round(mid/(roofM.width*scale))),tw=mid/k;
      for(let j=0;j<k;j++)piece('house_roof_m',l+lw+j*tw-.5,rt,tw+1,rh,roofColors[h.breed]);
      piece('house_roof_l',l,rt,lw,rh,roofColors[h.breed]);piece('house_roof_r',r-rw,rt,rw,rh,roofColors[h.breed]);
    }
    if(i!==0)continue;
    const ear=images.get('house_ear');if(ear){const eh=c*.26,ew=ear.width*eh/ear.height,ey=rt-eh+c*.08;piece('house_ear',l+c*.08,ey,ew,eh,roofColors[h.breed]);piece('house_ear',r-c*.08-ew,ey,ew,eh,roofColors[h.breed],true);}
    const radius=c*.2,cx=(l+r)/2,cy=rt+rh*.5;
    ctx.beginPath();ctx.arc(cx,cy,radius+ow*.7,0,Math.PI*2);ctx.fillStyle=INK;ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fillStyle='#fffbf2';ctx.fill();
    const cat=images.get(`${h.breed}_sit`),size=radius*1.9;if(cat)ctx.drawImage(cat,Math.round(cx-size/2),Math.round(cy-size/2),Math.round(size),Math.round(size));
  }
  const ws=c*.4;
  for(const [x,y]of layout.windows)piece('house_window',left+(x+.5)*c-ws/2,top+(y+.5)*c-ws/2,ws,ws,wallColors[h.breed]);
  const door=images.get('house_door'),dh=c*.48,dw=door?door.width*dh/door.height:dh*.8;
  const doorX=left+(layout.door[0]+.5)*c-dw/2,doorY=top+layout.door[1]*c+c*.94-dh;
  piece('house_door',doorX,doorY,dw,dh,wallColors[h.breed]);
  const bx=doorX+dw/2,by=doorY+dh*.55,br=Math.max(c*.22,10);
  ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fillStyle=badgeColors[h.breed];ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.stroke();
  ctx.font=`${Math.max(c*.26,13)}px Jua, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#1b1740';ctx.fillText(h.count,bx,by);
  if(h.axis){
    const [doorCol,doorRow]=layout.door;
    const firstCell=h.axis==='h'
      ? h.cells.filter(p=>p[1]===doorRow).reduce((a,b)=>a[0]<b[0]?a:b)
      : h.cells.filter(p=>p[0]===doorCol).reduce((a,b)=>a[1]<b[1]?a:b);
    const tabs=h.axis==='h'
      ? [[firstCell,[-1,0]],[layout.door,[1,0]]]
      : [[firstCell,[0,-1]],[layout.door,[0,1]]];
    for(const [[x,y],[vx,vy]]of tabs){
      const ex=left+(x+.5)*c+vx*c/2,ey=top+y*c+(vy?vy>0?c:0:y===layout.roofRow?c*.68:c*.5),half=c*.18,depth=c*.2,inset=c*.05;
      ctx.beginPath();ctx.moveTo(ex+vx*depth,ey+vy*depth);ctx.lineTo(ex-vx*inset-vy*half,ey-vy*inset+vx*half);ctx.lineTo(ex-vx*inset+vy*half,ey-vy*inset-vx*half);ctx.closePath();ctx.fillStyle=roofColors[h.breed];ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=ow*.8;ctx.lineJoin='round';ctx.stroke();
    }
  }
  ctx.restore();
}

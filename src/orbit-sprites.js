// Reference sprite sheets used by this private prototype. Source and provenance
// are recorded in public/assets/downwell/README.md. Crop once, never per frame.
import {WELL_INK,WELL_RED,WELL_WHITE,pixel} from './orbit-pixels.js';
const images={},frames=new Map(),headRows=new Map();
export async function loadWellSprites(){
  await Promise.all(['spritesheet','terraintiles','reference-atlas'].map(async name=>{
    const i=new Image();i.src=`${import.meta.env.BASE_URL}assets/downwell/${name}.png`;await i.decode();images[name]=i;
  }));
}
export function wellFrame(name,x,y,w,h){
  const key=`${name}:${x},${y},${w},${h}`;if(frames.has(key))return frames.get(key);
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  ctx.drawImage(images[name],x,y,w,h,0,0,w,h);const p=ctx.getImageData(0,0,w,h);
  for(let n=0;n<p.data.length;n+=4){const [r,g,b,a]=p.data.slice(n,n+4);
    if(a<128||(r>180&&b>180&&g<80)){p.data[n+3]=0;continue;}
    const color=r>150&&g<100?[255,0,0]:r>100&&g>100?[255,255,255]:[0,0,0];
    p.data.set([...color,255],n);
  }
  ctx.putImageData(p,0,0);frames.set(key,c);return c;
}
function playerFrame(o){
  let col=0,row=0;
  if(o.grounded){col=o.vx?Math.floor(o.time*15)%8:Math.floor(o.time*4)%4;row=o.vx?16:0;}
  else{row=32;col=o.vy<-180?0:o.vy<-30?1:o.vy<90?2:o.vy<230?3:4;}
  return {col,row};
}
export function referenceMan(c,o,x,y){
  if(o.hurt&&o.health<4&&Math.floor(o.hurt/4)%2)return;
  const {col,row}=playerFrame(o),sprite=wellFrame('spritesheet',col*16,row,16,16);
  c.save();c.translate(Math.round(x/2)*2,Math.round(y/2)*2);c.scale(o.facing||1,1);
  c.drawImage(o.returnInk?returnFrame(sprite):sprite,-16,-30,32,32);
  const key=`${col}:${row}`;
  if(!headRows.has(key)){
    const pixels=sprite.getContext('2d').getImageData(7,0,1,10).data;
    let first=0;while(first<9&&pixels[first*4]<200)first++;
    headRows.set(key,first);
  }
  const headY=-30+headRows.get(key)*2;
  pixel(c,-4,headY,12,2,WELL_RED);pixel(c,-8,headY,4,2,WELL_RED);
  pixel(c,-12,headY+(Math.floor(o.time*12)%2?-2:2),6,2,WELL_RED);
  // Hands wrap around a visible receiver. A long vertical barrel reaches past
  // the feet: neither the flash nor a projectile is attached to a boot.
  const recoil=o.flash?2:0;
  const white=o.returnInk?WELL_INK:WELL_WHITE,black=o.returnInk?WELL_WHITE:WELL_INK;
  const machine=o.weapon==='machine';
  pixel(c,4,-18-recoil,10,machine?28:24,black);
  pixel(c,6,-14-recoil,6,12,white);pixel(c,8,-12-recoil,2,8,black);
  if(machine){
    pixel(c,0,-11-recoil,6,8,white);pixel(c,1,-9-recoil,3,4,black);
    pixel(c,5,-20-recoil,8,5,white);pixel(c,7,-19-recoil,4,2,black);
    for(let yy=-10;yy<-2;yy+=3)pixel(c,11,yy-recoil,2,1,black);
  }
  pixel(c,2,-16-recoil,6,4,white);pixel(c,2,-8-recoil,4,6,white);
  pixel(c,8,-2-recoil,2,machine?12:8,white);c.restore();
}
const returnFrames=new WeakMap();
function returnFrame(sprite){
  if(returnFrames.has(sprite))return returnFrames.get(sprite);
  const image=document.createElement('canvas');image.width=sprite.width;image.height=sprite.height;
  const c=image.getContext('2d');c.drawImage(sprite,0,0);const data=c.getImageData(0,0,image.width,image.height);
  for(let n=0;n<data.data.length;n+=4)if(data.data[n+3]){
    const ink=data.data[n+1]?0:255;data.data[n]=data.data[n+1]=data.data[n+2]=ink;
  }
  c.putImageData(data,0,0);returnFrames.set(sprite,image);return image;
}
export function referenceRock(c,p,n){
  if(p.wall){
    const frame=wellFrame('terraintiles',p.x===0?3*16:6*16,16,16,16);
    for(let yy=0;yy<p.h;yy+=32){const hh=Math.min(32,p.h-yy);c.drawImage(frame,p.x===0?12:0,0,4,hh/2,p.x,p.y+yy,8,hh);}return;
  }
  const mask=(n.right?1:0)+(n.above?2:0)+(n.left?4:0)+(n.below?8:0);
  c.drawImage(wellFrame('terraintiles',mask*16,16,16,16),p.x,p.y,p.w,p.h);
}

export function referenceBurst(c,r){
  if(r.kind==='reload'){if(r.age<8)pixel(c,r.x-10,r.y-34,20,2,WELL_WHITE);return;}
  if(r.kind==='spark'){
    if(r.age<2){pixel(c,r.x-5,r.y-2,10,4);pixel(c,r.x-2,r.y-7,4,9);}
    else if(r.age<7){
      const spread=r.age+2;
      pixel(c,r.x-spread,r.y-spread,2,2);pixel(c,r.x+spread-2,r.y-spread,2,2);
      pixel(c,r.x-1,r.y-spread*2,2,2,r.age<4?WELL_WHITE:WELL_RED);
    }
    return;
  }

  if(r.age<3){pixel(c,r.x-3,r.y-16,6,32,WELL_WHITE);pixel(c,r.x-16,r.y-3,32,6,WELL_WHITE);}
  const frame=r.age<8?[1422,1066,55,55]:[1312,1100,44,42];
  const size=r.age<3?30:r.age<8?66:72+(r.age-8)*2;
  const sprite=wellFrame('reference-atlas',...frame);
  c.drawImage(sprite,Math.round(r.x-size/2),Math.round(r.y-size/2),size,size);
}
export function referenceEnemy(c,e,time,reduced){
  const cycle=reduced?0:Math.floor(time*10+(e.phase||0))%4;
  let source,rect,w,h;
  if(e.type==='seeker'){source='reference-atlas';rect=[1242,1266,28,22];w=30;h=24;}
  else if(e.type==='crawler'){source='reference-atlas';rect=[1170,1368,24,16];w=32;h=22;}
  else if(e.type==='hopper'){source='spritesheet';rect=[cycle*32,128,32,16];w=42;h=e.mode==='crouch'?18:24;}
  else if(e.type==='spike'){source='reference-atlas';rect=[1961,1333,20,18];w=30;h=28;}
  else{source='spritesheet';rect=[cycle*32,128,32,16];w=36+(cycle%2)*4;h=cycle<2?22:28;}
  const sprite=wellFrame(source,...rect);
  c.save();c.translate(Math.round(e.x/2)*2,Math.round(e.y/2)*2);
  if(e.vx<0)c.scale(-1,1);
  c.drawImage(sprite,-w/2,e.type==='hopper'?10-h:-h/2,w,h);
  if(e.hit)c.drawImage(whiteFlash(sprite),-w/2,e.type==='hopper'?10-h:-h/2,w,h);
  if(e.mode==='wake'||e.mode==='crouch'){pixel(c,-1,-h/2-10,2,4,WELL_RED);pixel(c,-1,-h/2-4,2,2,WELL_RED);}
  c.restore();
}

const hitFrames=new WeakMap();
export function whiteFlash(sprite){
  if(hitFrames.has(sprite))return hitFrames.get(sprite);
  const image=document.createElement('canvas');image.width=sprite.width;image.height=sprite.height;
  const c=image.getContext('2d');c.drawImage(sprite,0,0);
  const pixels=c.getImageData(0,0,image.width,image.height);
  for(let i=0;i<pixels.data.length;i+=4){
    if(pixels.data[i]||pixels.data[i+1]||pixels.data[i+2])pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
    else pixels.data[i+3]=0;
  }
  c.putImageData(pixels,0,0);hitFrames.set(sprite,image);return image;
}

const silhouettes=new Map();
function playerSilhouette(p){
  const {col,row}=playerFrame(p),key=`${col}:${row}:${p.facing}:${Math.floor(p.time*12)%2}:${p.flash?1:0}:${p.weapon}`;
  if(silhouettes.has(key))return silhouettes.get(key);
  const image=document.createElement('canvas');image.width=48;image.height=42;
  const c=image.getContext('2d');c.imageSmoothingEnabled=false;referenceMan(c,{...p,hurt:0},24,32);
  const pixels=c.getImageData(0,0,48,42);
  for(let i=0;i<pixels.data.length;i+=4){
    // Only the visible character/gun ink forms the silhouette. Transparent
    // atlas padding and black cutouts must never become rectangular red boxes.
    const lit=pixels.data[i]>0||pixels.data[i+1]>0||pixels.data[i+2]>0;
    pixels.data[i]=255;pixels.data[i+1]=pixels.data[i+2]=0;if(!lit)pixels.data[i+3]=0;
  }
  c.putImageData(pixels,0,0);silhouettes.set(key,image);return image;
}
export function referenceTrail(c,o,reduced=false){
  if(reduced)return;
  c.save();
  for(const p of o.trail||[]){
    c.globalAlpha=(p.enhanced ? .66 : .4)*(1-p.age/p.life)**1.4;
    c.drawImage(playerSilhouette(p),Math.round(p.x/2)*2-24,Math.round(p.y/2)*2-32);
  }
  c.restore();
}
// Squared red wake with a rounded white leading core, travelling downward.
// The tip is at the projectile's collision position; the flame stays behind it.
const projectileFrames=new Map();
function projectileFrame(power,frame,machine=false){
  const key=`${power>1}:${frame}:${machine}`;if(projectileFrames.has(key))return projectileFrames.get(key);
  const hot=power>1,columns=hot?9:machine?5:7,rows=hot?16:machine?11:13;
  const image=document.createElement('canvas');image.width=columns;image.height=rows;
  const c=image.getContext('2d'),cx=Math.floor(columns/2);
  c.fillStyle=WELL_RED;
  c.fillRect(0,3,columns,rows-4);c.fillRect(1,rows-1,columns-2,1);
  c.fillRect(0,frame%2,2,5);c.fillRect(columns-2,(frame+1)%2,2,5);
  c.fillRect(2,2+(frame%2),columns-4,3);
  const core=hot?5:4,top=rows-core-2;
  c.fillStyle=WELL_WHITE;c.fillRect(cx-1,top,3,1);
  c.fillRect(cx-2,top+1,5,core);c.fillRect(cx-1,rows-2,3,2);
  projectileFrames.set(key,image);return image;
}
export function referenceShot(c,s,reduced=false){
  const sprite=projectileFrame(s.power||1,reduced?0:(Math.floor(s.age/2)+(s.volley||0))%3,s.machine);
  c.drawImage(sprite,Math.round(s.x)-sprite.width,Math.round(s.y)-sprite.height*2,sprite.width*2,sprite.height*2);
}
export function referenceMuzzle(c,p,age){
  const spread=age>1?4:2;
  pixel(c,p.x-spread,p.y,spread*2,4,WELL_RED);
  pixel(c,p.x-2,p.y,4,5,WELL_WHITE);pixel(c,p.x-1,p.y+5,2,4,WELL_WHITE);
}
export function referenceGem(c,g,time){
  const frame=g.value>=5?0:1+(Math.floor(time*7+g.x)%3),sprite=wellFrame('spritesheet',frame*16,96,16,16);
  const size=g.value>=5?12:10;c.drawImage(sprite,Math.round(g.x-size/2),Math.round(g.y-size/2),size,size);
}

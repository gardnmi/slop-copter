import { steamState } from './below-layout.js';
import { wellText } from './orbit-pixels.js';
import { BelowScenery } from './below-scenery.js';

const P={ink:'#090e21',deep:'#10182c',back:'#1b2743',steel:'#343c68',side:'#242c4e',mid:'#55659a',edge:'#a7c9e5',light:'#e4f6fa',cyan:'#77e4e8',green:'#80f6c6',red:'#f06183',amber:'#ffc48c',purple:'#8f78c8'};
const rect=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
function line(c,color,points,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x)+.5,Math.round(y)+.5):c.moveTo(Math.round(x)+.5,Math.round(y)+.5));c.stroke();}
function text(c,s,x,y,color=P.light,size=6,align='left'){
  wellText(c,s,x,y+1,size,P.ink,align);wellText(c,s,x,y,size,color,align);
}
function diamond(c,x,y,color,size=5){for(let y1=-size;y1<=size;y1++)rect(c,color,x-(size-Math.abs(y1)),y+y1,(size-Math.abs(y1))*2+1,1);}

// Original tiny commando poses. Everything shares a single pelvis, with a
// red bandana and two cloth ends; the gun stays slung for the climbing chapter.
function man(c,o,time,ghost=false) {
  const dash=o.dashTime>0,climb=o.climbing,grounded=o.grounded;
  const face=o.facing||-1,beat=Math.floor((o.stepDistance||time*18)/3)%6;
  const stride=grounded&&Math.abs(o.vx)>4?[0,2,3,1,-2,-3][beat]:0;
  const squash=o.landSquash>0?1:0,bodyY=grounded?(stride===0?1:0):0;
  c.save();c.translate(Math.round(o.x),Math.round(o.y));c.scale(face,1);
  const r=(color,x,y,w,h)=>rect(c,ghost?'#3c9bd3':color,x,y,w,h);
  // Segmented cloth follows the previous body position, like Celeste's hair.
  if(o.ribbon&&!ghost){
    for(let i=o.ribbon.length-1;i>=0;i--){const p=o.ribbon[i];r(o.dashes?'#db344e':'#559bdb',(p.x-o.x)*face-1,p.y-o.y-1,i<2?3:2,i<3?3:2);if(i<4)r(o.dashes?'#fa5c61':'#8ac6eb',(p.x-o.x)*face,p.y-o.y+2+Math.round(Math.sin(time*12-i)),2,1);}
  }else for(let i=4;i>=0;i--)r(o.dashes?'#c42c4b':'#448aca',-5-i*2,-12+Math.round(Math.sin(time*12-i*.7)*1.2),3,2);
  // A continuous hip and torso; skin, vest and the rifle stay on one pixel grid.
  if(dash&&Math.abs(o.vx)>150){
    r('#122334',-7,-9,11,6);r('#456875',-7,-8,5,3);r('#283f52',-9,-8,5,2);
    r('#111a2d',-11,-7,3,2);r('#60797b',-5,-5,5,2);r('#111a2d',-7,-4,4,2);
    r('#db956d',3,-8,5,2);r('#f5d89b',6,-8,3,2);
  }else{
    const by=bodyY+squash;
    r('#111b2b',-4,-9+by,8,7-by);r('#486969',-3,-8+by,6,4);
    r('#889677',-3,-8+by,2,4);r('#d6b683',0,-8+by,2,3);
    r('#a3865c',-3,-3,6,1);r('#203447',-3,-2,6,1);
    if(climb){
      r('#d59770',3,-12,2,5);r('#f7dca0',3,-13,3,2);
      r('#4b6b78',-3,-2,3,2);r('#93a9a2',1,-4,3,2);r('#142638',2,-2,3,2);r('#172132',-4,0,3,1);
    }else if(!grounded){
      const rising=o.vy<0;r('#3b576b',-4,-2,3,rising?2:3);r('#839c9b',1,-3,3,rising?3:4);
      r('#122133',-5,rising?-1:0,4,2);r('#182638',2,rising?-1:1,3,1);
      r('#df9f76',3,-9,2,3);r('#f1c38c',4,-10,2,2);
    }else{
      r('#365267',-3-Math.max(0,stride),-2,3,2);r('#8da7a6',Math.max(-1,stride),-2,3,2);
      r('#112032',-4-Math.max(0,stride),0,4,1);r('#142739',Math.max(-1,stride)+1,0,4,1);
      r('#db9c73',2+Math.sign(stride),-7+by,2,4);r('#f3d49b',3+Math.sign(stride),-7+by,1,2);
    }
  }
  const hx=dash&&Math.abs(o.vx)>150?3:0,hy=(dash?-1:bodyY)+squash;
  r('#172033',hx-4,hy-15,7,7);r('#5c3137',hx-4,hy-15,7,3);r('#915044',hx-3,hy-16,5,2);
  r('#bd724b',hx+2,hy-14,2,2);r('#f1c48d',hx-2,hy-12,6,4);r('#ffe8b5',hx+1,hy-12,3,3);
  r('#273044',hx+3,hy-12,1,1);r('#ae735c',hx-1,hy-9,4,1);
  r('#a72240',hx-5,hy-13,9,1);r('#ff5a63',hx-4,hy-14,8,1);r('#ed3350',hx-5,hy-13,2,2);
  if(!dash){r('#172231',-5,-9+bodyY,2,7);r('#60757d',-5,-10+bodyY,1,5);r('#c69d76',-4,-7+bodyY,1,3);}
  c.restore();
}

export class BelowArt {
  constructor(){this.surface=document.createElement('canvas');this.surface.width=320;this.surface.height=180;this.scenery=new BelowScenery();this.previous=document.createElement('canvas');this.previous.width=320;this.previous.height=180;this.lastRoom=-1;}
  async load(){await this.scenery.load();}
  draw(target,game,renderer,reduced) {
    const o=game.below,c=this.surface.getContext('2d');c.imageSmoothingEnabled=false;
    if(o.roomIndex!==this.lastRoom){this.previous.getContext('2d').drawImage(this.surface,0,0);this.lastRoom=o.roomIndex;}
    if(o.phase==='collapse'&&o.age<44&&game.boarding.boss){
      renderer.airArt.deck.draw(target,game,renderer.airArt,renderer,reduced);
      const w=target.canvas.width,h=target.canvas.height;
      target.save();target.setTransform(1,0,0,1,0,0);
      // Fractures split outward from the real elevator contact plane.
      const d=game.boarding,fy=(d.y-d.cameraY)/d.height*h;
      for(let i=0;i<5;i++){
        const start=w*(.18+i*.15),reach=Math.min(1,o.age/35)*w*.15;
        line(target,'#101423',[[start,fy],[start+reach*.25,fy-8],[start+reach*.45,fy+9],[start+reach,fy+2]],Math.max(2,w/320));
      }
      target.fillStyle='rgba(8,12,24,.8)';target.fillRect(w*.22,h*.12,w*.56,h*.12);
      target.font=`bold ${Math.max(12,w/50)}px monospace`;target.textAlign='center';target.fillStyle=P.amber;
      target.fillText('FLOOR FAILURE',w/2,h*.19);target.restore();return;
    }
    this.background(c,o,reduced);
    c.save();
    if(!reduced&&o.phase==='collapse')c.translate(Math.round(Math.sin(o.age*2)*1.5),0);
    for(const p of o.room.solids)this.platform(c,p,o.roomIndex,o.roomTicks,reduced,o.room);
    for(const h of o.room.hazards)this.hazard(c,h,o,reduced);
    this.door(c,o);
    for(const r of o.room.refills){
      const y=r.y+(reduced?0:Math.sin(o.time*3+r.x)*1.5);
      if(r.cooldown){line(c,P.mid,[[r.x,y-4],[r.x+4,y],[r.x,y+4],[r.x-4,y],[r.x,y-4]]);continue;}
      c.globalAlpha=.08;diamond(c,r.x,y,'#bafa94',11);c.globalAlpha=.14;diamond(c,r.x,y,'#bafa94',8);c.globalAlpha=1;
      diamond(c,r.x,y,'#edffd4',5);diamond(c,r.x,y,'#8be95b',4);diamond(c,r.x-1,y-1,'#eaffb1',2);
      rect(c,'#fff',r.x-2,y-2,2,2);rect(c,'#5daf55',r.x+1,y+2,2,1);
      if(!reduced){const f=Math.floor(o.time*10)%20;rect(c,'#caff89',r.x-9+f,y+7,1,1);}
    }
    if(o.room.token&&!o.tokens.includes(o.roomIndex)) {
      const [x,y]=o.room.token;diamond(c,x,y,P.amber,4);rect(c,P.ink,x-1,y-2,2,4);rect(c,P.light,x-2,y-3,2,1);
    }
    if(o.room.helicopter)this.helicopter(c,o,reduced);
    for(const t of o.trail){c.globalAlpha=(1-t.age/14)*.4;man(c,{...t,vx:0,vy:t.dy*240,grounded:false,dashTime:1},o.time,true);}c.globalAlpha=1;
    if(o.phase==='collapse')this.fall(c,o,reduced);
    else if(!o.dead&&!(o.phase==='complete'||o.phase==='boarding'&&o.age>42))man(c,o,reduced?0:o.time);
    for(const p of o.particles){c.globalAlpha=1-p.age/p.life;rect(c,p.color,p.x,p.y,2,2);}c.globalAlpha=1;
    if(o.climbing){rect(c,P.ink,o.x-o.facing*8-1,o.y-17,3,15);rect(c,o.stamina<25?P.red:P.green,o.x-o.facing*8,o.y-3-o.stamina/110*12,1,Math.max(1,o.stamina/110*12));}
    c.restore();this.hud(c,o);
    target.save();target.setTransform(1,0,0,1,0,0);target.imageSmoothingEnabled=false;
    const w=target.canvas.width,h=target.canvas.height,fit=Math.min(w/320,h/180),scale=fit>=2?Math.floor(fit):fit;
    target.fillStyle=P.ink;target.fillRect(0,0,w,h);
    const ox=Math.floor((w-320*scale)/2),oy=Math.floor((h-180*scale)/2);
    target.beginPath();target.rect(ox,oy,320*scale,180*scale);target.clip();
    if(o.phase==='transition'&&!reduced){const t=o.age/16,e=t*t*(3-2*t);target.drawImage(this.previous,ox+Math.round(e*320)*scale,oy,320*scale,180*scale);target.drawImage(this.surface,ox-Math.round((1-e)*320)*scale,oy,320*scale,180*scale);}
    else target.drawImage(this.surface,ox,oy,320*scale,180*scale);target.restore();
  }
  background(c,o,reduced) { this.scenery.background(c,o,reduced); }
  platform(c,p,seed,ticks,reduced,room) { this.scenery.platform(c,p,seed,ticks,reduced,room); }
  hazard(c,h,o,reduced) {
    if(h.kind==='spikes'){
      rect(c,'#34495d',h.x,h.y+h.h-2,h.w,3);
      for(let x=h.x;x<h.x+h.w;x+=6)for(let row=0;row<h.h;row++)rect(c,row<4?'#f2fcff':'#94b8d2',x+3-Math.floor(row/2),h.y+row,1+Math.floor(row/2)*2,1);
      return;
    }
    const state=steamState(h,o.roomTicks),base=h.y+h.h;
    rect(c,P.ink,h.x-2,base-2,h.w+4,5);rect(c,P.mid,h.x,base,h.w,3);
    for(let x=h.x+1;x<h.x+h.w;x+=4)rect(c,state==='off'?P.side:P.amber,x,base,2,2);
    if(state==='warning'){
      for(let n=0;n<3;n++)rect(c,P.amber,h.x+2+n*4,base-4-n%2*3,1,2);
      text(c,'!',h.x+h.w/2,base-12,P.amber,7,'center');
    }
    if(state==='active') {
      const age=reduced?0:o.roomTicks;
      c.globalAlpha=.22;rect(c,P.cyan,h.x-2,h.y,h.w+4,h.h);c.globalAlpha=1;
      for(let y=h.y;y<base;y+=4){const offset=reduced?0:Math.round(Math.sin(y+age*.8)*2);rect(c,(y+age)%3?P.edge:P.light,h.x+2+offset,y,h.w-4,3);}
    }
  }
  door(c,o) {
    if(o.room.helicopter)return;
    const [x,y,w,h]=o.room.exit;
    rect(c,'#172938',x,y,w+1,h);rect(c,P.green,x+w-1,y,1,h);rect(c,P.cyan,x,y,w,2);
    line(c,P.green,[[x+8,y+19],[x+4,y+19],[x+6,y+17]]);line(c,P.green,[[x+4,y+19],[x+6,y+21]]);
    text(c,'AFT',x+18,y+8,P.edge,5);
  }
  helicopter(c,o,reduced) {
    // Match the chapter's pixel scale, keeping the familiar Apache silhouette.
    const x=52,y=80;
    rect(c,'#31334a',x-40,y-1,83,1);
    // Tapered tail boom and high fin, carried into the fuselage without gaps.
    for(let i=0;i<31;i++)rect(c,i%7===0?'#788b8f':'#455865',x-35+i,y-19-Math.floor(i/6),1,4+Math.floor(i/8));
    rect(c,P.ink,x-39,y-37,7,24);rect(c,'#506674',x-38,y-35,5,21);
    rect(c,'#91a4a8',x-38,y-35,2,15);rect(c,'#e56477',x-38,y-20,5,2);
    rect(c,P.ink,x-42,y-29,12,2);rect(c,'#536b79',x-37,y-34,2,12);
    // Stepped armor and tandem glass create a long, low attack-helicopter nose.
    rect(c,P.ink,x-9,y-31,43,19);rect(c,P.ink,x-5,y-35,23,22);
    rect(c,'#4f646c',x-8,y-29,41,15);rect(c,'#7e8e8a',x-4,y-32,24,3);
    for(let row=0;row<10;row++)rect(c,row<5?'#657b80':'#3b535f',x+22,y-27+row,11+Math.min(10,row*2),1);
    rect(c,'#1c303f',x-4,y-15,42,3);rect(c,'#8c9f9b',x-6,y-29,14,2);
    rect(c,'#253c4b',x+6,y-34,13,12);rect(c,'#3c697c',x+8,y-32,9,8);
    rect(c,'#9adddf',x+8,y-32,7,2);rect(c,'#628b99',x+8,y-30,2,5);
    for(let row=0;row<8;row++)rect(c,row<2?'#92c9d0':'#366478',x+20,y-29+row,5+row,1);
    rect(c,'#142c3c',x+18,y-31,2,11);rect(c,'#a0aca4',x+20,y-20,18,1);
    rect(c,'#243949',x-10,y-25,15,9);rect(c,'#70878b',x-8,y-25,11,2);
    rect(c,'#0d1d2d',x-10,y-23,4,5);rect(c,'#3c5364',x-10,y-23,2,3);
    rect(c,'#849591',x-5,y-19,13,2);rect(c,'#2d4352',x-5,y-17,14,3);
    rect(c,'#142838',x+37,y-21,7,5);rect(c,'#7b989d',x+39,y-21,3,2);
    rect(c,'#122737',x+31,y-14,4,4);rect(c,'#445b64',x+24,y-10,12,2);
    // Two wheeled legs anchor the machine to the pad.
    for(const gx of [-6,27]){
      rect(c,'#99a6a0',x+gx,y-13,2,8);rect(c,'#3c5260',x+gx+1,y-8,2,4);
      rect(c,P.ink,x+gx-2,y-6,7,5);rect(c,'#738a91',x+gx,y-5,2,2);
    }
    rect(c,P.ink,x+2,y-44,3,12);rect(c,'#738991',x+3,y-43,1,9);
    rect(c,'#3c5261',x-3,y-46,15,4);rect(c,'#9bada9',x-2,y-47,13,2);
    const blade=reduced?0:Math.floor(o.time*14)%3;
    rect(c,'#1a2c3c',x-43+blade*5,y-39,91-blade*8,2);
    rect(c,'#9cadb0',x-42+blade*5,y-39,90-blade*8,1);
    if(o.phase==='complete'){rect(c,P.amber,x+22,y-26,3,3);rect(c,P.red,x+22,y-27,3,1);}
  }
  fall(c,o,reduced) {
    const t=Math.max(0,o.age-44),y=Math.min(160,-60+t*3.4),x=292;
    // Broken lift plates and bolts fall ahead of the player, revealing the hull.
    for(let i=0;i<9;i++) {
      const px=230+i*9+(i-4)*t*.2,py=-35+t*3.4+i%3*9+t*t*.009;
      c.save();c.translate(px,py);if(!reduced)c.rotate((i-4)*t*.017);rect(c,P.steel,-5,-2,10,4);rect(c,P.edge,-5,-2,10,1);c.restore();
    }
    man(c,{x,y,facing:-1,vx:0,grounded:y===160},reduced?0:o.time);
    if(t>40&&t<64)for(let i=0;i<10;i++)rect(c,P.mid,x+(i-5)*(t-40)*.6,159-i%3,2,1);
    if(o.age<90){rect(c,P.ink,80,47,160,33);text(c,'BELOW DECK',160,62,P.light,13,'center');text(c,'GET BACK TO YOUR HELICOPTER',160,73,P.cyan,5,'center');}
  }
  hud(c,o) {
    if((o.age<110&&o.playing)||o.phase==='collapse'){
      c.globalAlpha=o.phase==='collapse'?1:Math.min(1,(110-o.age)/25);
      rect(c,'#09121f',8,7,Math.min(260,o.room.name.length*6+14),15);
      text(c,o.room.name,14,18,'#cadbea',7);c.globalAlpha=1;
    }
    if(o.playing&&o.roomIndex===0&&o.age<300){
      rect(c,'#0b1928',73,64,173,25);
      text(c,'K / SPACE: JUMP',160,74,'#e5eeef',7,'center');
      text(c,'J: DASH   L: CLIMB',160,84,'#a7bdce',7,'center');
    }
    if(o.playing&&o.roomIndex===1&&o.age<210){
      text(c,'CRYSTAL = DASH AGAIN',154,44,'#b4f7b2',7,'center');
      text(c,'AIM + J',154,55,'#e0f4f3',7,'center');
    }
    if(o.refillFlash>0&&o.playing){
      const y=Math.max(27,o.y-27);text(c,'+1 DASH',Math.max(29,Math.min(290,o.x)),y,'#c9ff9d',7,'center');
    }
    if(o.inputHint>0)text(c,'UP + J: AIR DASH',160,164,'#d7f4fa',7,'center');
    if(o.dead)text(c,'AGAIN.',160,88,P.light,9,'center');
    if(o.phase==='complete'){
      rect(c,'#10172b',40,103,240,43);line(c,P.cyan,[[40,103],[280,103]]);
      text(c,'HELICOPTER REACHED',160,122,P.light,12,'center');
      text(c,'BELOW DECK COMPLETE',160,133,P.green,6,'center');
      text(c,'LEVELS: SHIFT + L    RESTART: R',160,141,P.edge,5,'center');
    }
  }
}

import { orbitMuzzle, ORBIT_ACTOR_SCALE } from './orbit-pose.js';
import { OrbitSky } from './orbit-sky.js';
import { OrbitEntryArt } from './orbit-entry-art.js';
import { returnPose } from './orbit-return.js';
import {drawWellTile,drawWellBurst,wellText} from './orbit-pixels.js';
const box=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const text=wellText;
const poly=(c,points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
import {loadWellSprites,referenceMan,referenceRock,referenceBurst,referenceTrail,referenceShot,referenceMuzzle,referenceGem} from './orbit-sprites.js';
import {drawOrbitEnemy} from './orbit-enemy-art.js';
import {drawEater,drawEaterWalls,drawEaterRock,EaterCinema} from './orbit-boss-art.js';
const VIEW_HEIGHT=560;
export class OrbitArt {
  constructor(){this.surface=document.createElement('canvas');this.sky=new OrbitSky();this.entry=new OrbitEntryArt();this.eaterCinema=new EaterCinema();}
  async load(){
    await loadWellSprites();
  }
  draw(target,game,renderer,reduced) {
    const ratio=target.canvas.width/target.canvas.height;
    const w=Math.max(320,Math.round(VIEW_HEIGHT*ratio)),h=Math.max(VIEW_HEIGHT,Math.round(320/ratio));
    if(this.surface.width!==w||this.surface.height!==h){this.surface.width=w;this.surface.height=h;}
    const c=this.surface.getContext('2d');c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;
    if(game.orbit.phase==='breach')this.entry.draw(c,game,renderer,this,reduced,w,h);
    else this.well(c,game,renderer,reduced,w,h);
    this.eaterCinema.draw(c,game.orbit,w,h,reduced);
    if(game.orbit.phase==='return'){this.drawReturn(target,game,renderer,reduced,w,h);return;}
    target.setTransform(1,0,0,1,0,0);target.imageSmoothingEnabled=false;target.drawImage(this.surface,0,0,target.canvas.width,target.canvas.height);
  }
  actor(c,art,x,y,o,reduced,scale=ORBIT_ACTOR_SCALE,angle=0) {
    c.save();c.translate(Math.round(x),Math.round(y));c.rotate(angle);c.scale(scale,scale);
    referenceMan(c,o,0,0);c.restore();
  }

  flame(c,art,x,y,t,size=1,reduced=false) {
    const frame=reduced?2:Math.floor(t*22)%4,length=27+frame*3;
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(size,size);
    poly(c,[[-6,0],[6,0],[5,11],[3,11],[3,length-6],[0,length],[-3,length-6],[-3,11],[-5,11]],'#ff0000');
    poly(c,[[-3,0],[3,0],[3,11],[1,11],[1,length-7],[0,length-3],[-2,length-9],[-2,12],[-3,12]],'#ffffff');
    box(c,-1,length+4,2,3,'#ffffff');c.restore();
  }
  drawReturn(target,game,r,reduced,w,h){
    const o=game.orbit,scene=o.returnScene;
    const pose=returnPose(o,w,h),art=r.airArt.deck.actors;
    // This live classic world also owns the actual fall and hay landing. Its
    // helicopter stays in its normal position; there is no midair catch.
    const morphing=!pose.landed&&pose.morph<1;
    r.draw(scene,{hideJumper:morphing,cameraY:pose.cameraY});
    target.setTransform(target.canvas.width/w,0,0,target.canvas.height/h,0,0);target.imageSmoothingEnabled=false;
    const c=this.surface.getContext('2d');c.save();c.globalAlpha=pose.white;box(c,0,0,w,h,'#fff');c.restore();
    target.save();target.globalAlpha=1-pose.world;target.drawImage(this.surface,0,0);target.restore();
    const size=32*pose.s,left=pose.x-14*pose.s,top=pose.y-size;
    // A top-to-bottom pixel wipe sheds the bandana and handheld gun into the
    // original falling sprite. Once it resolves, the classic renderer owns it.
    if(morphing){target.save();target.beginPath();target.rect(pose.x-32,top+size*pose.morph,64,size*(1-pose.morph)+8);target.clip();
      this.actor(target,art,pose.x,pose.y,{...o,vy:540,grounded:false,hurt:0,facing:1,returnInk:o.returnStart.whiteWell},reduced);target.restore();}
    if(morphing&&pose.morph>0){
      const frame=1+scene.frame%5;
      target.save();target.beginPath();target.rect(left-2*pose.s,top-2*pose.s,32*pose.s,size*pose.morph+4*pose.s);target.clip();
      r.man(frame,left,top,false,2*pose.s);target.restore();
    }
    target.setTransform(1,0,0,1,0,0);
  }

  well(c,game,r,reduced,w,h,{hideActor=false,hudAlpha=1,cameraY}={}) {
    const o=game.orbit,art=r.airArt.deck.actors,ox=Math.round((w-320)/2),depth=cameraY??o.cameraY;
    this.sky.draw(c,o,w,h,reduced);
    // The reference side scenery frames an opaque black action column.
    const framing=1;
    c.save();c.globalAlpha=framing;box(c,ox,0,320,h,o.phase==='return'&&o.returnStart.whiteWell?'#ffffff':'#000000');c.restore();
    c.save();c.globalAlpha=framing;
    box(c,ox,0,1,h,'#ffffff');box(c,ox+319,0,1,h,'#ffffff');
    for(let y=-Math.round(depth)%12;y<h;y+=12){
      const n=Math.floor((y+depth)/12);box(c,ox+2,y,2+n%3,2,'#ffffff');box(c,ox+3,y+3,2,3,'#ffffff');
      box(c,ox+313,y+5,4,2,'#ffffff');box(c,ox+316,y+8,2,3,'#ffffff');
    }
    c.restore();
    c.save();c.beginPath();c.rect(ox+1,0,318,h);c.clip();c.translate(ox,0);
    if(!reduced&&o.shake>.3)c.translate(Math.round(Math.sin(o.time*87)*o.shake),0);
    c.save();c.translate(0,-Math.round(depth));
    drawEaterWalls(c,o,reduced);
    for(const p of o.platforms)if(!p.dead&&p.y+(p.h||8)>depth&&p.y<depth+h) {
      const below=p.solid&&o.platforms.some(q=>!q.dead&&q.solid&&!q.breakable&&q.y===p.y+p.h&&q.x===p.x);
      const above=p.solid&&o.platforms.some(q=>!q.dead&&q.solid&&!q.breakable&&q.y+q.h===p.y&&q.x===p.x);
      const left=p.solid&&o.platforms.some(q=>!q.dead&&q.solid&&!q.breakable&&q.x+q.w===p.x&&q.y===p.y);
      const right=p.solid&&o.platforms.some(q=>!q.dead&&q.solid&&!q.breakable&&q.x===p.x+p.w&&q.y===p.y);
      if(p.solid&&!p.breakable)referenceRock(c,p,{above,left,right,below});
      else drawWellTile(c,p,{above,left,right,below});
      drawEaterRock(c,p,o.eater,reduced);
      if(p.checkpoint!==undefined){text(c,'CHECKPOINT',160,p.y-42,9,'#ffffff','center');text(c,'LAND / RELOAD',160,p.y-27,7,'#ffffff','center');}
    }
    drawEater(c,o,reduced);
    referenceTrail(c,o,reduced);
    for(const gem of o.gemsItems)if(!gem.dead&&gem.y>depth&&gem.y<depth+h)referenceGem(c,gem,o.time);
    for(const e of o.enemies)if(!e.dead&&e.y>depth-20&&e.y<depth+h+20)drawOrbitEnemy(c,e,o.time,reduced);
    for(const s of o.shots)referenceShot(c,s,reduced);
    for(const p of o.particles)if(p.age<14||p.age%2)box(c,p.x,p.y,2,2,p.color);
    if(!hideActor&&o.phase!=='return')this.actor(c,art,o.x,o.y,{...o,dead:false},reduced);
    if(o.combo>=2&&o.comboAge>0&&!o.cinematic){text(c,`${o.combo}`,o.x+1,o.y-33,12,'#ff0000','center');text(c,`${o.combo}`,o.x,o.y-34,12,'#ffffff','center');}
    for(const ring of o.rings||[])referenceBurst(c,ring);
    if(o.flash)referenceMuzzle(c,orbitMuzzle(o),o.flash);
    for(const f of o.floaters){
      const x=Math.max(78,Math.min(242,f.x)),y=f.y-f.age*.3;
      if(f.kind==='combo'){
        if(f.age>65&&f.age%3===0)continue;
        f.lines.forEach((line,i)=>{
          const yy=y+i*18;
          for(const [dx,dy]of [[-2,0],[2,0],[0,-2],[0,2]])text(c,line,x+dx,yy+dy,12,'#000000','center');
          text(c,line,x+1,yy+2,12,'#ff0000','center');text(c,line,x,yy,12,'#ffffff','center');
        });
      }else if(f.age<35||f.age%3)text(c,f.text,x,y,8,f.color,'center');
    }
    c.restore();
    // On wide displays the meters sit outside the well, as in the reference.
    if(o.phase==='eater-death'&&o.age>=200){
      const wash=Math.min(1,(o.age-200)/28),height=Math.ceil(h*wash);
      box(c,0,h-height,320,height,'#ffffff');
    }
    c.restore();c.save();c.translate(ox,0);
    if(o.cinematic&&!['eater-death','breach'].includes(o.phase)||hudAlpha<=0){c.restore();return;}
    c.globalAlpha=hudAlpha;
    const wide=ox>155,hx=wide?-194:12,gx=wide?510:306,mx=wide?354:305;
    // Outlined life bar, lower progress strip, faceted gem and the angled charge
    // column keep the same proportions as the supplied original-game clip.
    box(c,hx,18,166,22,'#ffffff');box(c,hx+2,20,162,18,'#000000');
    box(c,hx+4,22,158*o.health/4,14,'#ff0000');
    text(c,`${o.health}/4`,hx+84,36,15,'#000000','center');text(c,`${o.health}/4`,hx+82,34,15,'#ffffff','center');
    box(c,hx,42,166,10,'#ffffff');box(c,hx+2,44,162,6,'#000000');
    box(c,hx+3,45,Math.round(158*(o.gemMeter||0)/60),4,'#ffffff');
    text(c,`${o.gems}`,gx-32,39,14,'#ff0000','right');text(c,`${o.gems}`,gx-34,37,14,'#ffffff','right');
    poly(c,[[gx-14,23],[gx-2,34],[gx-14,45],[gx-27,34]],'#ff0000');
    poly(c,[[gx-14,23],[gx-14,34],[gx-23,34]],'#ffffff');box(c,gx-110,43,86,2,'#ff0000');
    const meterHeight=Math.min(h-160,360),top=92,bottom=top+meterHeight,cell=meterHeight/o.charge;
    poly(c,[[mx-4,top],[mx+11,top],[mx+19,top+5],[mx+19,bottom+5],[mx+14,bottom+9],[mx-4,bottom+4]],'#ff0000');
    poly(c,[[mx-2,top+2],[mx+10,top+2],[mx+16,top+6],[mx+16,bottom+5],[mx-2,bottom+1]],'#000000');
    for(let i=0;i<o.ammo;i++){
      const yy=bottom-(i+1)*cell,inset=cell<12?1:2,slant=Math.min(4,cell*.22);
      poly(c,[[mx,yy+inset],[mx+8,yy+inset],[mx+13,yy+inset+slant],[mx+13,yy+cell],[mx,yy+cell-slant]],'#ffffff');
    }
    for(const [dx,dy]of [[-2,0],[2,0],[0,-2],[0,2]])text(c,`${o.ammo}`,mx+6+dx,bottom+31+dy,15,'#000000','center');text(c,`${o.ammo}`,mx+8,bottom+33,15,'#ff0000','center');text(c,`${o.ammo}`,mx+6,bottom+31,15,'#ffffff','center');
    if(!o.ammo&&!o.cinematic)text(c,'EMPTY!',Math.max(50,Math.min(270,o.x)),o.y-depth-42,12,'#ffffff','center');

    if(o.playing&&o.gemHigh){
      c.save();if(!wide)c.translate(0,30);
      const meter=o.gemHigh?o.gemHigh/150:o.gemMeter/60;
      box(c,28,28,264,6,'#ff0000');box(c,30,26,Math.round(260*meter),4,'#ffffff');
      if(o.gemHigh){box(c,116,16,88,19,'#000000');text(c,'GEM HIGH',160,33,12,'#ffffff','center');}
      c.restore();
    }
    if(o.dead) {
      box(c,48,190,224,94,'#000000');text(c,'SIGNAL LOST',160,215,17,'#ff0000','center');
      text(c,'RESTARTING CHECKPOINT',160,241,10,'#ffffff','center');
      text(c,`RETRY ${o.label}`,160,265,7,'#ffffff','center');
    }
    c.restore();
  }
}

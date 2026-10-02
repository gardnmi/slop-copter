import {pixel,pixelLine,wellText,WELL_RED as RED,WELL_WHITE as WHITE,WELL_INK as BLACK} from './orbit-pixels.js';
import {eaterWarning,EATER_INTRO_TICKS} from './orbit-boss.js';
import {eaterBitesRock} from './orbit-boss-world.js';
import {wellFrame} from './orbit-sprites.js';
import {eaterSprite,drawEaterBody} from './hay-eater-art.js';
export {drawEaterBody} from './hay-eater-art.js';

function shape(c,points,color){
  c.fillStyle=color;
  for(let y=Math.floor(Math.min(...points.map(p=>p[1])));y<Math.ceil(Math.max(...points.map(p=>p[1])));y++){
    const cuts=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],yy=y+.5;
      if(a[1]<=yy&&b[1]>yy||b[1]<=yy&&a[1]>yy)cuts.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    cuts.sort((a,b)=>a-b);for(let n=0;n<cuts.length;n+=2)c.fillRect(Math.ceil(cuts[n]),y,Math.ceil(cuts[n+1])-Math.ceil(cuts[n]),1);
  }
}

export function drawEaterWalls(c,o,reduced){
  const b=o.eater;if(!b||o.phase==='return')return;
  const start=Math.floor(o.cameraY/16)*16;
  // Organic red seams hug the thin collision walls. They do not imply extra
  // invisible hazards or occupy the open firing corridor.
  for(let yy=start;yy<o.cameraY+900;yy+=16){
    const n=Math.floor(yy/16),pulse=reduced?0:Math.floor(b.age/12);
    for(const side of [-1,1]){
      const x=side<0?3:314,ink=(n+pulse)%5===0?WHITE:RED;
      pixel(c,x,yy,3,4,ink);pixel(c,x+side*-2,yy+5,2,7,RED);
      if(n%3===0)pixel(c,x+side*-4,yy+10,3,2,ink);
    }
  }
}

export function drawEaterRock(c,p,b,reduced){
  if(!p.eater)return;
  const biteWarning=b&&b.attack==='chomp'&&eaterWarning(b)&&eaterBitesRock(b,p);
  if(p.fragile||p.cracking||biteWarning){
    const clock=biteWarning?110-b.cycle:p.cracking;
    const ink=clock&&!reduced&&Math.floor(clock/6)%2?WHITE:RED;
    pixelLine(c,p.x+10,p.y+2,p.x+14,p.y+9,ink,2);
    pixelLine(c,p.x+14,p.y+9,p.x+9,p.y+17,ink,2);
    pixelLine(c,p.x+9,p.y+17,p.x+16,p.y+26,ink,2);
  }
  if(b?.stage===2&&!p.breakable){
    pixel(c,p.x+2,p.y+3,4,2,RED);pixel(c,p.x+22,p.y+5,2,4,RED);
  }
}

export function drawEater(c,o,reduced){
  const b=o.eater;if(!b||o.phase==='return')return;
  drawEaterBody(c,b,b.age+(o.phase==='eater-fight'?0:o.age),{reduced,lookX:o.x,death:o.phase==='eater-death'?o.age:0});
  drawEaterBlood(c,b,reduced);
  for(const p of b.deathBursts||[])drawDeathBurst(c,p,reduced);
  if(o.phase==='eater-break'){
    for(let i=0;i<10;i++){
      const t=o.age,side=i%2?1:-1;
      const x=b.x+side*(22+t*.9+i*3),y=b.y-75-i*2+t*t*.035;
      pixelLine(c,x,y,x+side*9,y+7,WHITE,2);
      pixelLine(c,x+side*3,y+1,x+side*10,y-3,i%3?WHITE:RED);
    }
    if(o.age>=8){
      pixel(c,b.x-97,b.y-175,194,34,BLACK);
      wellText(c,'HAY TORN OPEN',b.x+1,b.y-159,12,RED,'center');
      wellText(c,'HAY TORN OPEN',b.x,b.y-161,12,WHITE,'center');
      wellText(c,'PHASE 2 / EXPOSED EYES',b.x,b.y-146,8,RED,'center');
    }
  }
  for(const d of b.debris||[]){pixel(c,d.x,d.y,4,6,d.red?RED:WHITE);pixel(c,d.x+3,d.y+4,3,2,BLACK);}
}

function drawEaterBlood(c,b,reduced){
  for(const s of b.stains||[]){
    const drip=Math.min(26,Math.floor(s.age/4));
    pixel(c,s.x-s.size/2,s.y,s.size,6,RED);
    pixel(c,s.x-1,s.y+4,2,drip,RED);pixel(c,s.x+2,s.y+3,1,Math.floor(drip*.6),RED);
  }
  for(const [i,p]of (b.blood||[]).entries()){
    if(reduced&&i%3)continue;
    const x=Math.round(p.x/2)*2,y=Math.round(p.y/2)*2;
    if(!reduced)pixelLine(c,p.oldX,p.oldY,x,y,RED,p.chunk?3:2);
    if(p.chunk){
      shape(c,[[x-3,y-2],[x+3,y-4],[x+6,y],[x+3,y+5],[x-3,y+3]],RED);
      pixel(c,x,y,2,2,BLACK);
    }else{pixel(c,x,y,p.size,p.size+1,RED);pixel(c,x+1,y-2,Math.max(1,p.size-2),2,RED);}
  }
}

function drawDeathBurst(c,p,reduced){
  const t=p.age,x=Math.round(p.x),y=Math.round(p.y),size=Math.round(p.size*(.75+Math.min(t,10)*.035));
  c.save();c.translate(x,y);if(p.flip)c.scale(-1,1);
  if(t<3&&!reduced){
    // The round white ignition precedes the red, dithered smoke lobes.
    const r=size*.29;
    for(let yy=-Math.ceil(r);yy<=r;yy++){
      const half=Math.floor(Math.sqrt(Math.max(0,r*r-yy*yy)));pixel(c,-half,yy,half*2,1,WHITE);
    }
  }else if(t<21){
    const frame=t<14?[1366,1066,55,55]:[1422,1066,55,55];
    c.drawImage(wellFrame('reference-atlas',...frame),-size/2,-size/2,size,size);
  }else{
    const spread=(t-18)*2;
    for(let i=0;i<7;i++){
      const a=i*2.4,px=Math.round(Math.cos(a)*spread),py=Math.round(Math.sin(a)*spread);
      pixel(c,px,py,3,2,i%3?RED:WHITE);pixel(c,px-2,py-2,2,3,RED);
    }
  }
  c.restore();
}

function title(c,value,x,y,scale){
  c.save();c.translate(x,y);c.scale(scale,scale);
  wellText(c,value,1,2,12,RED,'center');wellText(c,value,0,0,12,WHITE,'center');c.restore();
}
export class EaterCinema {
  constructor(){
    this.panel=document.createElement('canvas');this.panel.width=480;this.panel.height=144;
    this.portrait=document.createElement('canvas');this.portrait.width=320;this.portrait.height=300;
  }
  draw(c,o,w,h,reduced){
    if(o.phase!=='eater-intro')return;
    const t=o.age,p=this.panel.getContext('2d');p.setTransform(1,0,0,1,0,0);p.imageSmoothingEnabled=false;
    p.fillStyle=BLACK;p.fillRect(0,0,480,144);
    if(t<38){
      const rise=reduced?0:Math.max(0,38-t)*2;
      p.drawImage(eaterSprite(false),0,0,140,52,100,94+rise,280,104);
      for(let i=0;i<18;i++)pixel(p,25+i*26,120+(t+i*13)%24,2,4,i%3?RED:WHITE);
      wellText(p,'REMEMBER THE HAY?',240,55,12,WHITE,'center');
    }else if(t<82){
      const reveal=reduced?1:Math.min(1,(t-38)/14);
      p.save();p.beginPath();p.rect(0,72-72*reveal,480,144*reveal);p.clip();
      p.drawImage(eaterSprite(t>=48),30,7,80,32,0,-12,480,192);p.restore();
      pixel(p,0,132,480,2,RED);
    }else{
      const named=t>=122,pc=this.portrait.getContext('2d');
      pc.clearRect(0,0,320,300);pc.imageSmoothingEnabled=false;
      drawEaterBody(pc,{...o.eater,x:160,y:108,open:true,stage:1,hit:0,cycle:0},t,{reduced});
      p.drawImage(this.portrait,0,0,320,210,named?-3:56,0,246,161);
      if(named){
        shape(p,[[251,0],[480,0],[480,144],[215,144]],BLACK);
        pixelLine(p,251,0,215,144,RED,2);
        wellText(p,'FINAL DESCENT',351,28,8,WHITE,'center');
        title(p,'SLOP',350,76,3);title(p,'EATER',350,122,3);pixel(p,278,130,145,2,RED);
        if(t<134&&!reduced){const x=480-(t-122)*24;shape(p,[[x,0],[x+6,0],[x-36,144],[x-42,144]],WHITE);}
      }else wellText(p,'IT REMEMBERS.',394,82,12,WHITE,'center');
    }
    const reveal=reduced?1:Math.min(1,(t+1)/12,(EATER_INTRO_TICKS-t)/18);
    const scale=Math.min((w-24)/480,h*.32/144),pw=480*scale,ph=144*scale,x=(w-pw)/2,y=(h-ph)/2-14;
    c.save();c.globalAlpha=.94*Math.min(1,(t+1)/12,(EATER_INTRO_TICKS-t)/18);
    pixel(c,0,0,w,h,BLACK);c.globalAlpha=1;
    c.save();c.beginPath();c.rect(x,y+ph*(1-reveal)/2,pw,ph*reveal);c.clip();
    c.drawImage(this.panel,Math.round(x),Math.round(y),Math.round(pw),Math.round(ph));c.restore();
    pixel(c,x,y+ph*(1-reveal)/2-2,pw,1,WHITE);pixel(c,x,y+ph*(1+reveal)/2+1,pw,1,RED);
    if(t>=122&&t<212)wellText(c,'THE HAY BITES BACK.',w/2,y+ph+21,8,WHITE,'center');c.restore();
  }
}

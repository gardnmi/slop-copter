import { ORBIT_ROOMS } from './orbit-rooms.js';

export const WELL_WIDTH = 320;
export const BAND_DEPTH = 2120;
export const WELL_END = BAND_DEPTH * 3;
// Connected terrain and enemy roles are authored together. The seeded deck of
// chunks changes each run; a Continue reconstructs the same terrain and threats.
export function buildOrbitWell(seed=1) {
  const clouds=[],platforms=[],enemies=[],gems=[],chambers=[];
  let state=seed>>>0;
  const random=()=>{state+=0x6D2B79F5;let v=state;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);return((v^(v>>>14))>>>0)/4294967296;};
  const enemyTypes={d:'drone',s:'seeker',h:'hopper',c:'crawler',m:'spike'};
  let previous='';
  for(let band=0;band<3;band++){
    const base=band*BAND_DEPTH;
    if(band)platforms.push({x:126,y:base+164,w:68,h:8,checkpoint:band});
    let pool=ORBIT_ROOMS.filter(r=>(r.minBand||0)<=band);
    for(let room=0;room<5;room++){
      const candidates=pool.filter(r=>r.name!==previous);
      const source=candidates[Math.floor(random()*candidates.length)];previous=source.name;
      pool=pool.filter(r=>r!==source);
      const flip=random()<.5,y=base+380+room*320;
      chambers.push({name:source.name,y,end:y+320,flip});
      const rows=source.rows.map(row=>flip?[...row].reverse().join(''):row);
      rows.forEach((row,iy)=>[...row].forEach((token,ix)=>{
        const x=ix*32,top=y+iy*32;
        if(token==='#'||token==='%')platforms.push({x,y:top,w:32,h:32,solid:true,breakable:token==='%',hp:token==='%'?1:Infinity,grain:Math.floor(random()*29)});
        if(token==='*')gems.push({x:x+16,y:top+16,value:5,dead:false});
        if(enemyTypes[token]){
          const type=enemyTypes[token];
          const ex=x+16,ey=top+(type==='hopper'?22:16);
          enemies.push({x:ex,y:ey,originX:ex,originY:ey,type,hp:type==='spike'?2:1,phase:random()*6.28,
            vx:0,vy:0,age:0,mode:type==='hopper'?'rest':'idle',dir:ix<5?1:-1,dead:false});
        }
      }));
    }
    // A recovery lip before the next chapter; never a full-width floor.
    platforms.push({x:random()<.5?0:260,y:base+BAND_DEPTH-82,w:60,h:8});
  }
  // Only a thin wall borders empty shaft. It swells into the authored shelves
  // where another rock tile joins it; there is no invisible 32px-wide barrier.
  for(const side of [0,288]){
    const border=platforms.filter(p=>p.solid&&p.x===side).sort((a,b)=>a.y-b.y);
    let bottom=320;
    for(const p of border){
      if(p.y>bottom)platforms.push({x:side===0?0:312,y:bottom,w:8,h:p.y-bottom,solid:true,wall:true});
      bottom=Math.max(bottom,p.y+p.h);
      const neighbor=platforms.some(q=>q!==p&&q.solid&&q.y===p.y&&q.x===(side===0?32:256));
      if(!neighbor){p.x=side===0?0:312;p.w=8;p.wall=true;}
    }
    if(bottom<WELL_END)platforms.push({x:side===0?0:312,y:bottom,w:8,h:WELL_END-bottom,solid:true,wall:true});
  }
  // Keep only gems actually buried in debris or pocket interiors; shooting the
  // blocks uncovers caches. There are no prescribed floating gem slalom lanes.
  clouds.sort((a,b)=>a.y-b.y);platforms.sort((a,b)=>a.y-b.y);enemies.sort((a,b)=>a.y-b.y);
  return {clouds,platforms,enemies,gemsItems:gems,chambers};
}

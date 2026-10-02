// Visual history advances with simulation ticks, never display refreshes.
// Store poses at world positions so a scrolling/reversing camera cannot drag
// the trail along with the actor. Each list is replaced to keep forecast copies
// of the simulation from mutating the live player's history.
export function stepOrbitTrail(o){
  o.trail=(o.trail||[]).map(p=>({...p,age:p.age+1})).filter(p=>p.age<p.life);
  if(!(o.playing||o.phase==='eater-death'&&o.age<200)||o.grounded||o.hitStop>0)return;
  const last=o.trail.at(-1);
  if(last&&Math.hypot(o.x-last.x,o.y-last.y)<2)return;
  if(Math.abs(o.vx)+Math.abs(o.vy)<70&&!o.flash)return;
  o.trail.push({x:o.x,y:o.y,vx:o.vx,vy:o.vy,facing:o.facing,time:o.time,flash:o.flash,weapon:o.weapon,
    grounded:false,age:0,life:o.gemHigh?12:7,enhanced:Boolean(o.gemHigh)});
  if(o.trail.length>12)o.trail.shift();
}

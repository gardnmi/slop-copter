// Cosmetic gore only. These droplets never enter enemy/projectile collision
// lists, consume gameplay randomness or change the boss's attack cadence.
export const EATER_BLOOD_LIMIT=160;
const hash=n=>{
  let value=Math.imul(n+17,0x45d9f3b);
  value=Math.imul(value^(value>>>16),0x45d9f3b);
  return ((value^(value>>>16))>>>0)/4294967296;
};
export function spurtEaterBlood(o,x,y,count,force=1){
  const b=o.eater;
  for(let i=0;i<count;i++){
    const n=b.bloodCount++;
    b.blood.push({x,y,oldX:x,oldY:y,vx:((hash(n*7)-.5)*240)*force,
      vy:-(90+hash(n*13)*150)*force,age:0,life:45+Math.floor(hash(n*19)*25),size:2+n%4,chunk:n%3===0});
  }
  if(b.blood.length>EATER_BLOOD_LIMIT)b.blood.splice(0,b.blood.length-EATER_BLOOD_LIMIT);
}
export function stepEaterBlood(o){
  const b=o.eater;
  for(const s of b.stains)s.age++;
  for(const p of b.blood){
    p.oldX=p.x;p.oldY=p.y;p.x+=p.vx*.02;p.y+=p.vy*.02;p.vy+=8;p.age++;
    if(p.x<9||p.x>311){
      b.stains.push({x:p.x<160?5:309,y:p.y,age:0,size:p.size+3});p.age=p.life;
    }
  }
  b.blood=b.blood.filter(p=>p.age<p.life&&p.y<o.cameraY+720);
  b.stains=b.stains.filter(s=>s.age<160&&s.y>o.cameraY-40).slice(-32);
}

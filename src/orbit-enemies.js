const DT=.02;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blocked=(o,x,y)=>o.platforms.some(p=>p.solid&&!p.dead&&x+9>p.x&&x-9<p.x+p.w&&y+9>p.y&&y-9<p.y+p.h);
function move(o,e){
  const x=e.x+e.vx*DT,y=e.y+e.vy*DT;
  if(!blocked(o,x,e.y))e.x=clamp(x,11,309);else e.vx=-e.vx*.5;
  if(!blocked(o,e.x,y))e.y=y;else e.vy=-e.vy*.5;
}
export function stepOrbitEnemy(o,e){
  e.hit=Math.max(0,(e.hit||0)-1);e.age=(e.age||0)+1;
  e.originY??=e.y;e.vx??=0;e.vy??=0;e.mode??='idle';
  const dx=o.x-e.x,dy=o.y-13-e.y,near=Math.abs(dy)<240;
  if(e.type==='morsel'){
    e.x=e.originX+Math.sin(e.age*.05+e.phase)*18;
    e.y=e.originY+Math.sin(e.age*.04)*12;
  }else if(e.type==='seeker'){
    // Pursuit is two-dimensional, with a brief wake-up tell and acceleration.
    // It cannot snap back to its spawn point or pass through solid terrain.
    if(near&&Math.abs(dx)<235&&e.mode==='idle'){e.mode='wake';e.alert=0;}
    if(e.mode==='wake'&&++e.alert>=14)e.mode='hunt';
    if(e.mode==='hunt'){
      const distance=Math.hypot(dx,dy)||1;
      e.vx+=clamp(dx/distance*94-e.vx,-5,5);e.vy+=clamp(dy/distance*94-e.vy,-5,5);move(o,e);
    }
  }else if(e.type==='hopper'){
    if(e.mode==='idle')e.mode='rest';
    if(e.mode==='rest'&&near&&e.age>24){e.mode='crouch';e.clock=16;}
    if(e.mode==='crouch'&&--e.clock<=0){e.mode='jump';e.vx=Math.sign(dx||e.dir||1)*82;e.vy=-260;}
    if(e.mode==='jump'){
      const oldY=e.y;e.vy=Math.min(390,e.vy+900*DT);
      const x=e.x+e.vx*DT;if(!blocked(o,x,e.y))e.x=clamp(x,11,309);else e.vx*=-.5;
      e.y+=e.vy*DT;
      for(const p of o.platforms)if(!p.dead&&e.vy>=0&&e.x+8>p.x&&e.x-8<p.x+p.w&&oldY+10<=p.y+1&&e.y+10>=p.y){
        e.y=p.y-10;e.vx=e.vy=0;e.mode='rest';e.age=0;break;
      }
    }
  }else if(e.type==='crawler'){
    if(e.mode==='idle'){
      e.y=e.originY+Math.sin(e.age*.025+e.phase)*38;
      if(near&&Math.abs(dx)<175&&Math.abs(dy)<90){e.mode='wake';e.alert=0;}
    }else if(e.mode==='wake'){
      if(++e.alert>=20){e.mode='dive';e.vx=e.originX<160?150:-150;e.vy=-70;}
    }else{
      e.vy=Math.min(340,e.vy+440*DT);move(o,e);
    }
  }else{
    const span=e.type==='spike'?22:30,oldX=e.x,oldY=e.y;
    e.x=e.originX+Math.sin(o.time*2.4+e.phase)*span;
    e.y=e.originY+Math.sin(o.time*2+e.phase)*8;
    if(blocked(o,e.x,e.y)){e.x=oldX;e.y=oldY;}
  }
}

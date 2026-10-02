// A local look-ahead player. It only sends horizontal input and Space; it never
// changes live position, health, ammo or enemies. Unlike the old cloud-slalom
// script, it reacts to moving threats, terrain and charge, using visible space.
function input(o,g,x,fire){
  g.controlX=x;
  if(o.eater&&o.jumpLatch&&o.vy<-240)return;
  if(o.grounded){o.releaseAction();o.pressAction();}
  else if(fire){if(o.jumpLatch)o.releaseAction();o.pressAction();}
  else o.releaseAction();
}
function forecast(g,x,fire){
  const source=g.orbit,o=Object.assign(Object.create(Object.getPrototypeOf(source)),source);
  for(const key of ['platforms','enemies','clouds','gemsItems','shots'])o[key]=source[key].filter(p=>p.y>source.y-350&&p.y<source.y+650).map(p=>({...p}));
  o.eater=source.eater?structuredClone(source.eater):null;
  o.particles=[];o.floaters=[];o.rings=[];o.rocket=null;o.checkpoint={...source.checkpoint};
  const model={controlX:x,score:g.score,best:g.best,releaseControls(){this.controlX=0;o.clearInput();}};
  const alive=o.enemies.filter(e=>!e.dead).length;
  for(let i=0;i<(source.grounded?60:24)&&o.playing;i++){input(o,model,x,fire);o.tick(model);}
  let score=(o.health-source.health)*16000+(o.phase==='dead'?-100000:0);
  score+=(o.y-source.y)*(source.eater ? .1 : 1.5)+(alive-o.enemies.filter(e=>!e.dead).length)*140+(o.ammo-source.ammo)*(source.eater?55:9)+(o.gems-source.gems)*.1;
  if(source.eater){
    score+=(source.eater.hp-o.eater.hp)*900;
    if(o.ammo&&o.eater.open)score-=Math.abs(o.x+9*o.facing-o.eater.x)*2;
    if(o.phase==='eater-break'||o.phase==='eater-death')score+=5000;
  }
  if(o.phase==='return')score+=10000;
  // Favour an attainable next stomp/reload when the charge is running out.
  const targets=o.enemies.filter(e=>!e.dead&&e.type!=='spike'&&e.y>o.y+10&&e.y<o.y+180);
  if(targets.length){const dx=Math.min(...targets.map(e=>Math.abs(e.x-o.x)));score-=dx*(o.ammo<3?.7:.14);}
  return score;
}
export function orbitInput(g,route){
  const o=g.orbit;
  if(o.cinematic){o.releaseAction();route.next=0;return;}
  if(o.phase==='orbit'){o.pressAction();route.release=g.frame+7;return;}
  if(g.frame<route.release)return;
  if(!route.next||g.frame>=route.next||o.grounded){
    let best=-Infinity,action;
    for(const x of [-1,0,1])for(const fire of [false,true]){
      const score=forecast(g,x,fire);
      if(score>best){best=score;action={x,fire};}
    }
    route.action=action;route.next=g.frame+4;
  }
  input(o,g,route.action.x,route.action.fire);
}

import {WELL_END} from './orbit-layout.js';
import {seedEaterWorld,stepEaterWorld,tearEaterWall} from './orbit-boss-world.js';
import {spurtEaterBlood,stepEaterBlood} from './orbit-boss-blood.js';

export const EATER_INTRO_TICKS=230, EATER_BREAK_TICKS=65, EATER_DEATH_TICKS=240;
export const EATER_HEALTH=60;
export const EATER_MACHINE_CHARGE=45;
// Shoulder tears in the new hay pile, below the eyes (not the old horn tips).
const HAY_WOUNDS=[[-60,-30],[50,-12]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

export function beginEater(o,game,{intro=true,checkpoint=true}={}){
  o.weapon='machine';o.charge=Math.max(EATER_MACHINE_CHARGE,o.charge);
  if(checkpoint)o.checkpoint={kind:'eater',band:2,score:game.score,gems:o.gems,bestCombo:o.bestCombo,charge:o.charge};
  o.eater={x:160,y:o.cameraY+372,hp:EATER_HEALTH,stage:1,age:0,cycle:0,wave:0,
    hit:0,open:false,exposure:10,attack:'rest',side:-1,spawn:0,scroll:0,
    entry:{x:o.x,y:o.y,cameraY:o.cameraY},awarded:false,blood:[],stains:[],bloodCount:0,wounded:false};
  o.rocket=null;o.shots=[];o.trail=[];o.particles=[];o.rings=[];o.floaters=[];o.enemies=[];o.gemsItems=[];
  o.platforms=[];o.phase='eater-intro';o.age=0;o.grounded=false;
  o.health=4;o.ammo=o.charge;o.shotClock=o.flash=o.hitStop=o.shake=0;o.burning=0;o.band=2;
  game.releaseControls();o.sound('eater-wake');game.message='The hay from the cart is alive. Something is looking back.';
  if(!intro)startFight(o,game);
}

function startFight(o,game){
  const b=o.eater;
  o.phase='eater-fight';o.age=0;o.x=160;o.y=o.cameraY+176;o.vx=0;o.vy=0;
  o.hurt=65;o.grounded=false;o.hitStop=0;o.shotClock=0;o.trail=[];b.cycle=0;b.open=true;
  seedEaterWorld(o);game.releaseControls();o.sound('eater-roar');
  o.note('MACHINE GUN');
  game.message='MACHINE GUN / 45. Hold J / SPACE to fire. Shoot the white eyes when they peek through the hay; land or stomp to reload.';
}

export function eaterWarning(b){return b.attack==='chomp'&&b.cycle>=70&&b.cycle<110;}
export function eaterTarget(o,s){
  const b=o.eater;
  if(o.phase!=='eater-fight'||!b)return null;
  const top=b.y-60;
  return Math.abs(s.x-b.x)<136&&s.oldY<=top&&s.y>=top?top:null;
}

export function hitEater(o,game,shot){
  if(o.phase!=='eater-fight')return;
  const b=o.eater;
  if(!b.open||Math.abs(shot.x-b.x)>25){o.ring(shot.x,b.y-60,'#ffffff','spark');o.sound('rock-hit',shot.x);return;}
  const floor=b.stage===1?EATER_HEALTH/2:0;
  const damage=Math.min(shot.power||1,b.exposure,b.hp-floor);
  b.hp-=damage;b.exposure-=damage;b.open=b.exposure>0;b.hit=shot.machine?2:3;o.shake=1.5;
  o.burst(shot.x,b.y-52,'#ffffff',5);o.sound('eater-hit');
  if(b.wounded)spurtEaterBlood(o,shot.x,b.y-58,4,.8);
  if(b.hp===floor){
    o.phase=b.stage===1?'eater-break':'eater-death';o.age=0;
    o.shots=[];o.hitStop=0;o.flash=0;b.open=false;
    if(b.stage===1){
      b.wounded=true;
      for(const [dx,dy]of HAY_WOUNDS)spurtEaterBlood(o,b.x+dx,b.y+dy,22,1.1);
    }
    // Keep a held trigger through the brief shell break. A real key release
    // still clears it during the animation; the player need not repress Space.
    if(b.stage===2){
      b.deathBursts=[];o.enemies=[];o.hurt=0;o.grounded=false;o.ammo=o.charge;
      spurtEaterBlood(o,b.x,b.y-72,70,1.1);
    }
    o.sound(b.stage===1?'eater-break':'eater-down');
    game.message=b.stage===1?'HAY TORN OPEN / PHASE 2. The wounded eyes are still watching.':'The bottom gives way.';
  }
}

// The creature retreats ahead of the camera as the player descends. Rocks,
// minions and player shots stay in world space, retaining the normal fall/recoil
// physics. Falling past a ledge leads to another stretch of shaft, not an
// invisible arena floor or a death boundary below the screen.
export function stepEaterArena(o,game){
  const b=o.eater,previous=b.y;
  b.y=Math.max(b.y,o.cameraY+372,o.y+150);b.scroll+=b.y-previous;
  b.age++;b.cycle++;b.hit=Math.max(0,b.hit-1);
  b.x=160+Math.sin(b.age*.016)*(b.stage===1?6:10);
  stepEaterWorld(o);
  stepEaterBlood(o);
  if(b.wounded&&b.age%24===0){
    const [dx,dy]=HAY_WOUNDS[Math.floor(b.age/24)%2];
    spurtEaterBlood(o,b.x+dx,b.y+dy,7,.75);
  }
  if(b.cycle>=(b.stage===1?210:180)){b.cycle=0;b.wave++;b.exposure=10;}
  b.open=(b.cycle<70||b.cycle>=138)&&b.exposure>0;
  if(b.cycle===70){
    // Former spread-shot turns are now breathing room. Keep the existing
    // chomp cadence instead of replacing every removed fan with another bite.
    b.attack=b.wave%2?'chomp':'rest';
    if(b.attack==='chomp'){b.side=o.x<160?-1:1;o.sound('eater-warning');}
  }
  if(b.attack==='chomp'&&b.cycle===110){tearEaterWall(o);o.shake=2;o.sound('eater-roar');}
  for(const e of o.enemies)if(!e.dead&&e.eater&&e.y>b.y-70){
    e.dead=true;o.burst(e.x,e.y,'#ff0000',4);
  }
  o.enemies=o.enemies.filter(e=>!e.dead&&e.y>o.cameraY-90&&e.y<b.y+180);
  o.gemsItems=o.gemsItems.filter(g=>!g.dead&&g.y>o.cameraY-80);
}

export function collideEater(o,game){
  const b=o.eater;
  if(Math.abs(o.x-b.x)<136&&o.y>b.y-59&&o.y-23<b.y+86){
    o.hurtPlayer(game,false,Math.sign(o.x-b.x));o.y=b.y-60;o.vy=-390;
  }
}

export function stepEaterCinema(o,game){
  const b=o.eater;
  stepEaterBlood(o);
  if(o.phase==='eater-intro'){
    const glide=smooth(o.age/60);
    o.x=b.entry.x+(160-b.entry.x)*glide;o.y=b.entry.y+(b.entry.cameraY+176-b.entry.y)*glide;
    if(o.age===38)o.sound('eater-scrape');
    if(o.age===82)o.sound('eater-roar');
    if(o.age===122)o.sound('eater-title');
    if(o.age>=EATER_INTRO_TICKS)startFight(o,game);
  }else if(o.phase==='eater-break'){
    b.hit=Math.max(0,b.hit-1);o.shake=o.age<40?2:0;
    if(o.age<45&&o.age%12===0){
      const [dx,dy]=HAY_WOUNDS[Math.floor(o.age/12)%2];
      spurtEaterBlood(o,b.x+dx,b.y+dy,12,1.1);
      o.ring(b.x+Math.sin(o.age)*55,b.y-35,'#ff0000','spark');
    }
    if(o.age>=EATER_BREAK_TICKS){
      b.stage=2;b.cycle=0;b.wave=0;b.open=true;b.exposure=10;o.phase='eater-fight';o.age=0;o.hurt=60;o.ammo=o.charge;
      o.sound('eater-roar');o.note('PHASE 2 / EXPOSED EYES');game.message='PHASE 2 / EXPOSED EYES. Keep falling. Keep firing.';
    }
  }else if(o.phase==='eater-death'){
    b.hit=Math.max(0,b.hit-1);o.shake=o.age<190?1.3:0;
    // Keep steering and firing during the chain reaction, as in the reference.
    // Hazards are gone; the final white wash hands over to the existing ending.
    if(o.age<200)o.stepBossAftermath(game);
    if(o.age===200){game.releaseControls();o.shots=[];o.trail=[];o.sound('explosion');}
    b.y=o.cameraY+372+smooth(o.age/200)*210;
    if(o.age===20){o.platforms=[];o.gemsItems=[];o.sound('explosion');}
    for(const p of b.deathBursts){p.age++;p.y-=.65;}
    if(o.age>16&&o.age<195&&o.age%12===0){
      for(let i=0;i<3;i++){
        const n=Math.floor(o.age/12)*3+i;
        b.deathBursts.push({x:30+(n*83)%260,y:b.y-84-(n*29)%68,age:0,size:66+n%3*18,flip:n%2});
      }
      spurtEaterBlood(o,b.x+Math.sin(o.age)*72,b.y-78,22,1);
      o.burst(b.x+Math.sin(o.age)*95,b.y-74,'#ff0000',9);o.sound('eater-burst');
    }
    b.deathBursts=b.deathBursts.filter(p=>p.age<36);
    if(o.age>=EATER_DEATH_TICKS){
      if(!b.awarded){o.award(game,3000);b.awarded=true;}
      o.beginReturn(game);o.returnStart.whiteWell=true;
    }
  }
}

export function eaterAtEnd(o,game){
  if(o.phase==='falling'&&o.y>WELL_END+40&&!o.eater)beginEater(o,game);
}

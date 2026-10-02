import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel} from '../src/level-select.js';
import {WELL_END} from '../src/orbit-layout.js';
import {EATER_HEALTH,EATER_MACHINE_CHARGE,EATER_INTRO_TICKS,EATER_BREAK_TICKS,EATER_DEATH_TICKS,hitEater,eaterWarning,collideEater,stepEaterArena} from '../src/orbit-boss.js';
import {orbitInput} from './helpers/orbit-playthrough.js';
import {seedEaterWorld,stepEaterWorld,touchEaterRock,tearEaterWall} from '../src/orbit-boss-world.js';
import {EATER_BLOOD_LIMIT} from '../src/orbit-boss-blood.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};

test('the bottom saves a boss checkpoint and plays the reveal once with controls and combat frozen',()=>{
  const g=createLevel('downwell-core'),o=g.orbit;o.y=WELL_END+41;o.grounded=false;tick(g);
  assert.equal(o.phase,'eater-intro');assert.equal(o.checkpoint.kind,'eater');
  assert.equal(g.inCinematic,true);assert.equal(g.drop(),false);
  const hp=o.health;tick(g,100);assert.equal(o.health,hp);assert.equal(o.shots.length,0);assert.equal(o.eater.age,0);
  g.paused=true;const snapshot=JSON.stringify(o);tick(g,50);g.resize(390,844);assert.equal(JSON.stringify(o),snapshot);
  g.paused=false;tick(g,EATER_INTRO_TICKS-100);
  assert.equal(o.phase,'eater-fight');assert.equal(g.inCinematic,false);assert.equal(o.ammo,o.charge);
  assert.equal(o.eater.hp,EATER_HEALTH);assert.equal(o.enemies.length,2);
});

test('armor blocks shots, the open core takes limited volleys, and both phases are required',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;
  hitEater(o,g,{x:b.x+50,power:2});assert.equal(b.hp,EATER_HEALTH);
  assert.equal(b.hit,0,'armor must not flash the boss');
  b.open=false;hitEater(o,g,{x:b.x,power:2});assert.equal(b.hp,EATER_HEALTH);
  assert.equal(b.hit,0,'closed eye must not flash the boss');
  b.open=true;for(let i=0;i<20;i++)hitEater(o,g,{x:b.x,power:1});
  assert.equal(b.hp,EATER_HEALTH-10);assert.equal(b.open,false);
  assert.equal(b.hit,3,'damage gives a short whole-body white flash');
  tick(g,3);assert.equal(b.hit,0,'the flash clears between volleys');
  for(let wave=1;wave<EATER_HEALTH/20;wave++){
    b.cycle=209;tick(g);assert.equal(b.open,true);
    for(let i=0;i<5;i++)hitEater(o,g,{x:b.x,power:2});
  }
  assert.equal(o.phase,'eater-break');assert.equal(b.hp,EATER_HEALTH/2);
  assert.equal(b.wounded,true);assert.ok(b.blood.length>=40);assert.match(g.message,/PHASE 2/);
  assert.equal(g.drop(),false);tick(g,EATER_BREAK_TICKS);
  assert.equal(o.phase,'eater-fight');assert.equal(b.stage,2);assert.equal(o.ammo,o.charge);
  assert.equal(b.wounded,true);assert.ok(b.blood.length>0);assert.match(g.message,/PHASE 2/);
  for(let wave=0;wave<EATER_HEALTH/20;wave++){
    if(wave){b.cycle=179;tick(g);}
    for(let i=0;i<5;i++)hitEater(o,g,{x:b.x,power:2});
  }
  assert.equal(o.phase,'eater-death');assert.equal(b.hp,0);
  const score=g.score;tick(g,EATER_DEATH_TICKS-1);assert.equal(o.phase,'eater-death');tick(g);
  assert.equal(o.phase,'return');assert.equal(g.score,score+5000);
  o.beginReturn(g);assert.equal(g.score,score+5000);
});

test('the shell-break pause preserves a held trigger but honors a key release',()=>{
  for(const release of [false,true]){
    const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;
    o.held=true;b.hp=EATER_HEALTH/2+1;hitEater(o,g,{x:b.x,power:1});
    assert.equal(o.phase,'eater-break');assert.equal(o.held,true);
    if(release)o.releaseAction();
    tick(g,EATER_BREAK_TICKS+1);
    assert.equal(o.phase,'eater-fight');assert.equal(o.held,!release);
    assert.equal(o.ammo,o.charge-(release?0:1));
  }
});

test('the nearest rock blocks a core shot and touching the maw still hurts and knocks the player upward',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;
  o.platforms.push({x:b.x-20,y:b.y-70,w:40,h:8});o.enemies=[];
  o.shots=[{x:b.x,y:b.y-78,oldY:b.y-78,power:2,age:0}];tick(g);
  assert.equal(b.hp,EATER_HEALTH);assert.equal(o.shots.length,0);
  o.hurt=0;o.x=b.x;o.y=b.y-40;collideEater(o,g);
  assert.equal(o.health,3);assert.ok(o.vy<0);assert.equal(o.y,b.y-60);
});

test('both phases rest instead of firing a spread, while chomps still warn and lock their side',()=>{
  for(const stage of [1,2]){
    const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;b.stage=stage;
    b.cycle=69;
    for(let i=0;i<56;i++){
      stepEaterArena(o,g);collideEater(o,g);
      assert.equal(b.attack,'rest');assert.equal(eaterWarning(b),false);
      assert.equal(b.bolts?.length??0,0);assert.notEqual(o.cue.name,'eater-shot');assert.equal(o.health,4);
    }
    b.wave=1;b.cycle=69;o.x=60;stepEaterArena(o,g);
    assert.equal(b.side,-1);assert.equal(b.attack,'chomp');assert.equal(eaterWarning(b),true);
    o.x=240;for(let i=0;i<40;i++)stepEaterArena(o,g);assert.equal(b.side,-1);
    for(const x of [40,260]){
      o.x=x;o.y=b.y-150;o.hurt=0;const health=o.health;collideEater(o,g);
      assert.equal(o.health,health,'the old claw sweep no longer has a hitbox');
    }
  }
});

test('empty ammo is replenished by physical ledges and white enemy stomps',()=>{
  for(const reload of ['ledge','stomp']){
    const g=createLevel('slop-eater-fight'),o=g.orbit;o.ammo=0;o.vy=400;
    const target=reload==='ledge'?o.platforms[0]:o.enemies[0];
    o.x=reload==='ledge'?target.x+30:target.x;o.y=target.y-(reload==='ledge'?1:13);
    tick(g,2);assert.equal(o.ammo,o.charge,reload);
    if(reload==='stomp'){assert.ok(o.vy<0);assert.equal(target.dead,true);}
  }
});

test('falling past a lip extends the shaft, and Continue restores the boss without repeating the title',()=>{
  const g=createLevel('slop-eater-fight',{seed:19}),o=g.orbit;
  o.x=176;o.vy=480;const initial=o.cameraY;tick(g,140);
  assert.equal(o.phase,'eater-fight');assert.ok(o.cameraY>initial+200);
  assert.ok(o.eater.y>o.y+100);assert.ok(o.platforms.some(p=>p.y>o.y));
  const cp={...o.checkpoint};g.score+=500;o.gems+=50;o.eater.stage=2;o.eater.hp=10;
  o.health=1;o.hurt=0;o.hurtPlayer(g);tick(g,31);g.continueSegment();
  assert.equal(o.phase,'eater-fight');assert.equal(o.eater.stage,1);assert.equal(o.eater.hp,EATER_HEALTH);
  assert.equal(o.eater.wounded,false);assert.deepEqual(o.eater.blood,[]);assert.deepEqual(o.eater.stains,[]);
  assert.equal(o.health,4);assert.equal(o.gems,cp.gems);assert.equal(g.score,cp.score);
  assert.equal(o.checkpoint.kind,'eater');assert.equal(o.held,false);
});

test('ordinary controls beat the descending two-stage fight with bounded entities and no player-state edits',()=>{
  const g=createLevel('slop-eater-fight',{seed:19}),o=g.orbit,route={release:0};let count=0;
  for(;count<4000&&!o.dead&&o.phase!=='return';count++){
    orbitInput(g,route);tick(g);
    assert.equal(o.eater.bolts?.length??0,0);assert.ok(o.enemies.filter(e=>!e.dead).length<=5);
    assert.ok(o.eater.blood.length<=EATER_BLOOD_LIMIT);assert.ok(o.eater.stains.length<=32);
    assert.ok(o.platforms.length<=48);assert.ok(o.trail.length<=12);
  }
  assert.equal(o.phase,'return');assert.ok(o.health>0);assert.equal(o.eater.hp,0);
  assert.ok(count>700&&count<1900);assert.ok(o.eater.scroll>500);
});

test('the boss grants rapid fire and 45 charges, keeps the upgrade on Continue and resets it for normal descent',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit;
  assert.equal(o.weapon,'machine');assert.equal(o.charge,EATER_MACHINE_CHARGE);
  o.grounded=false;o.platforms=[];o.enemies=[];o.pressAction();
  tick(g,13);assert.equal(o.ammo,40);assert.equal(o.volley,5);
  assert.ok(o.shots.every(s=>s.machine));o.releaseAction();o.shots=[];
  o.eater.open=true;hitEater(o,g,{x:o.eater.x,machine:true,power:1});
  assert.equal(o.eater.hit,2);tick(g,2);assert.equal(o.eater.hit,0,'rapid fire leaves a red frame between white hit flashes');
  o.combo=15;o.reload(g);assert.equal(o.charge,46,'combo rewards never shrink the larger magazine');
  o.health=1;o.hurt=0;o.hurtPlayer(g);tick(g,31);g.continueSegment();
  assert.equal(o.weapon,'machine');assert.equal(o.ammo,45);
  o.startFall(g,1);assert.equal(o.weapon,'single');assert.equal(o.charge,8);
});

test('the dying boss chains bounded explosions while movement and fire continue, then washes into the ending',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;
  b.stage=2;b.hp=1;o.held=true;hitEater(o,g,{x:b.x,power:1});
  assert.equal(o.phase,'eater-death');assert.equal(o.canAct,true);assert.equal(o.held,true);
  assert.ok(b.blood.length>=70);
  const x=o.x,ammo=o.ammo;g.setYoke(1,0);tick(g,10);
  assert.ok(o.x>x);assert.ok(o.ammo<ammo);g.setYoke(0,0);o.releaseAction();
  tick(g,26);assert.ok(b.deathBursts.length>=4);
  g.paused=true;const before=JSON.stringify(o);tick(g,20);assert.equal(JSON.stringify(o),before);g.paused=false;
  while(o.age<200){tick(g);assert.ok(b.deathBursts.length<=9);assert.ok(b.blood.length<=EATER_BLOOD_LIMIT);assert.ok(b.stains.length<=32);assert.equal(o.health,4);}
  assert.equal(o.canAct,false);assert.equal(o.cinematic,true);
  tick(g,EATER_DEATH_TICKS-200);assert.equal(o.phase,'return');assert.equal(o.returnStart.whiteWell,true);
});

test('boss descent mixes cave geometry and enemy roles with repeatable reload routes',()=>{
  const run=()=>{
    const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;o.seed=19;
    o.platforms=[];o.enemies=[];seedEaterWorld(o);const rooms=[],kinds=new Set(),positions=new Set();
    for(let i=0;i<12;i++){
      o.cameraY+=240;o.y+=240;b.y+=240;b.stage=i>5?2:1;
      o.enemies=[];stepEaterWorld(o);
      rooms.push(b.rooms.at(-1));for(const e of o.enemies)kinds.add(e.type);
      for(const p of o.platforms)positions.add(`${p.x}:${p.breakable}:${p.fragile}`);
      assert.ok(o.platforms.some(p=>!p.dead&&p.y>o.y),'a physical reload route stays below');
      for(const e of o.enemies)assert.ok(e.y>o.y+40,'spawns give the player reaction space');
    }
    return{rooms,kinds:[...kinds].sort(),positions:[...positions].sort()};
  };
  const a=run();assert.deepEqual(a,run());
  assert.ok(new Set(a.rooms.map(r=>r.name)).size>=5);assert.ok(a.kinds.length>=4);
  assert.ok(new Set(a.positions.map(p=>p.split(':')[0])).size>=6);
  assert.ok(a.positions.some(p=>p.includes(':true:')),'breakable paths are present');
  assert.ok(a.positions.some(p=>p.endsWith(':true')),'crumbling shelves are present');
});

test('cracked rock gives time to jump before removal; a warned sweep removes only its side',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater;
  const loose={x:32,y:b.y-110,w:32,h:32,solid:true,eater:true,fragile:true};
  const safe={x:256,y:b.y-110,w:32,h:32,solid:true,eater:true};
  o.platforms=[loose,safe];touchEaterRock(o,loose);
  for(let i=0;i<54;i++)stepEaterWorld(o);
  assert.ok(!loose.dead);stepEaterWorld(o);assert.equal(loose.dead,true);
  assert.ok(b.debris.length>0);assert.ok(!safe.dead);
  const target={...loose,dead:false,cracking:0};o.platforms.push(target);
  b.side=-1;tearEaterWall(o);assert.equal(target.dead,true);assert.ok(!safe.dead);
  stepEaterWorld(o);assert.ok(!o.platforms.includes(target));
});

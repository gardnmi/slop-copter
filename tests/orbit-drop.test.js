import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel} from '../src/level-select.js';
import {ORBIT_TERMINAL} from '../src/orbit-drop.js';
import {orbitInput} from './helpers/orbit-playthrough.js';
import {orbitMuzzle} from '../src/orbit-pose.js';
import {WELL_END,BAND_DEPTH} from '../src/orbit-layout.js';
import {returnFallTicks,returnPose} from '../src/orbit-return.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};
const depart=g=>{g.drop();tick(g);g.orbit.releaseAction();};
const empty=g=>{const o=g.orbit;o.phase='falling';o.rocket=null;o.launchPush=0;o.clouds=[];o.enemies=[];o.platforms=[];o.gemsItems=[];o.hurt=0;return o;};

test('the descent starts in freefall and Space immediately fires downward with finite charge',()=>{
  const g=createLevel('downwell'),o=g.orbit;
  assert.equal(o.phase,'falling');assert.equal(o.grounded,false);assert.equal(o.y,164);
  assert.equal(o.vy,ORBIT_TERMINAL);
  g.drop();tick(g);assert.equal(o.ammo,7);assert.equal(o.shots.length,1);assert.ok(o.vy<40);
  o.platforms=[];o.enemies=[];tick(g,90);assert.equal(o.ammo,0);assert.ok(o.vy>100);
  tick(g,60);assert.equal(o.ammo,0);assert.equal(o.vy,ORBIT_TERMINAL);
});

test('the handheld gun fires one shot from its barrel when facing either direction',()=>{
  for(const facing of [-1,1]){
    const g=createLevel('downwell'),o=empty(g);o.x=160;o.y=250;o.facing=facing;
    o.fire();const muzzle=orbitMuzzle(o);
    assert.equal(o.shots.length,1);assert.equal(o.shots[0].x,muzzle.x);assert.equal(o.shots[0].y,muzzle.y);
    assert.equal(Math.sign(muzzle.x-o.x),facing);assert.ok(muzzle.y>o.y);assert.equal(o.ammo,7);
  }
});

test('landing reloads, ends a combo and cannot auto-jump while Space remains held',()=>{
  const g=createLevel('downwell'),o=empty(g);
  o.platforms=[{x:80,w:150,y:300}];o.y=299;o.vy=180;o.ammo=0;o.combo=9;o.held=true;
  tick(g);assert.equal(o.y,300);assert.equal(o.ammo,8);assert.equal(o.combo,0);assert.equal(g.score,500);assert.equal(o.gems,100);
  tick(g,15);assert.equal(o.y,300);assert.equal(o.grounded,true);
  o.releaseAction();g.drop();tick(g);assert.equal(o.grounded,false);assert.ok(o.y<300);
});

test('pale drones can be stomped to reload without ending the airborne combo; red sentries hurt',()=>{
  for(const type of ['drone','spike']){
    const g=createLevel('downwell'),o=empty(g);o.x=160;o.y=180;o.vy=280;o.ammo=1;o.combo=3;
    const e={x:160,originX:160,y:198,phase:0,type,hp:1};o.enemies=[e];tick(g,4);
    if(type==='drone'){assert.equal(e.dead,true);assert.equal(o.ammo,8);assert.equal(o.combo,4);assert.ok(o.vy<0);}
    else{assert.equal(o.health,3);assert.equal(o.combo,0);assert.ok(!e.dead);}
  }
});

test('the rebuilt well has no Matrix clouds or fire, and the outer borders stay harmless',()=>{
  for(const x of [7,313]){
    const g=createLevel('downwell');depart(g);const o=g.orbit;
    assert.deepEqual(o.clouds,[]);
    o.x=x;o.y=325;o.vy=200;o.hurt=0;tick(g,6);
    assert.equal(o.health,4);assert.equal(o.burning,0);
  }
});

test('a later-band Continue restores the checkpoint score and layout, without replaying the collapse or bosses',()=>{
  const g=createLevel('downwell');depart(g);const o=g.orbit;o.x=170;o.y=BAND_DEPTH+180;o.vy=100;tick(g);
  assert.equal(o.band,1);const saved=o.checkpoint.score;g.score+=1000;o.health=1;o.hurt=0;o.hurtPlayer(g,true);tick(g,31);
  g.continueSegment();assert.equal(o.phase,'falling');assert.equal(o.band,1);assert.equal(o.health,4);assert.equal(o.ammo,8);
  assert.equal(g.score,saved);assert.equal(o.y,BAND_DEPTH+164);assert.equal(o.held,false);assert.equal(o.grounded,true);
});

test('pause, resizing and refresh rates never alter the world or physics',()=>{
  const runs=[];for(const fps of [30,50,60,144]){const g=createLevel('downwell',{seed:5});depart(g);g.setYoke(1,0);for(let n=0;n<fps;n++)g.step(1/fps);runs.push(JSON.stringify(g.orbit));}
  runs.forEach(s=>assert.equal(s,runs[0]));
  const g=createLevel('downwell');g.paused=true;const before=JSON.stringify(g.orbit);tick(g,200);g.resize(390,844);assert.equal(JSON.stringify(g.orbit),before);
});

test('freefall builds speed; upper-third camera and gun recoil leave room to read the next encounter',()=>{
  const free=createLevel('downwell'),brake=createLevel('downwell');
  for(const g of [free,brake]){const o=empty(g);o.y=300;o.vy=0;o.grounded=false;o.cameraY=0;}
  brake.drop();tick(free,40);tick(brake,40);
  assert.ok(free.orbit.y-brake.orbit.y>200);
  const screenY=free.orbit.y-free.orbit.cameraY;
  assert.ok(screenY>180&&screenY<225,'keep the actor near the upper third with reading room below');
  brake.setYoke(1,0);tick(brake);assert.ok(brake.orbit.vx>200);
  brake.setYoke(-1,0);tick(brake);assert.ok(brake.orbit.vx<-200);
  brake.setYoke(0,0);tick(brake);assert.equal(brake.orbit.vx,0);
});

test('first-band Continue returns directly to falling without replaying the collapse',()=>{
  const g=createLevel('downwell');depart(g);const o=g.orbit;
  o.health=1;o.hurt=0;o.hurtPlayer(g);tick(g,31);g.continueSegment();
  assert.equal(o.phase,'falling');assert.equal(o.cameraY,0);assert.equal(o.entry,null);
  assert.equal(o.health,4);assert.equal(o.ammo,8);
  tick(g);assert.equal(o.phase,'falling');assert.equal(o.vy,ORBIT_TERMINAL);assert.equal(o.grounded,false);
});


test('all three longer bands and the Slop Eater can be cleared using movement and Space without health edits',()=>{
  const g=createLevel('downwell',{seed:19}),o=g.orbit,route={release:0};
  const phases=new Set();
  for(let i=0;i<8000&&!o.dead&&o.phase!=='return';i++){orbitInput(g,route);tick(g);phases.add(o.phase);assert.ok(o.shots.length<30);assert.ok(o.particles.length<=160);}
  for(const phase of ['eater-intro','eater-fight','eater-break','eater-death'])assert.ok(phases.has(phase));
  assert.equal(o.phase,'return');assert.equal(o.band,2);assert.ok(o.health>0);assert.ok(o.gems>30);assert.ok(o.bestCombo>=3);
  const score=g.score;tick(g,returnFallTicks(o.returnScene)+44);assert.equal(g.score,score);
  tick(g);assert.equal(g.orbit.active,false);assert.equal(g.completedLoops,1);assert.equal(g.catches,1);assert.ok(g.score>0);assert.ok(g.best>=score);
});


test('wreckage blocks the sides and underside, and drilling opens a real falling route',()=>{
  const g=createLevel('downwell'),o=empty(g);
  o.platforms=[{x:100,y:200,w:48,h:48,solid:true}];
  o.x=91;o.y=236;o.vy=0;g.setYoke(1,0);tick(g,3);assert.equal(o.x,95,'solid side cannot be crossed');
  g.setYoke(0,0);o.x=120;o.y=278;o.vy=-440;tick(g,2);assert.ok(o.y>=271,'underside blocks an upward jump');assert.ok(o.vy>=0);
  o.platforms=[{x:148,y:350,w:24,h:16,solid:true,breakable:true,hp:1}];
  o.x=160;o.y=290;o.vy=100;o.ammo=8;o.grounded=false;g.drop();tick(g,6);
  assert.equal(o.platforms[0].dead,true);o.releaseAction();tick(g,25);assert.ok(o.y>380,'fall through the shot opening');
});

test('the high ending fall slows in the original cloud, lands in moving hay and resumes that scene',()=>{
  const g=createLevel('full-circle',{best:9999,bestRun:750,accelerationTime:.9}),o=g.orbit;
  assert.equal(o.phase,'return');assert.equal(g.inCinematic,true);assert.equal(g.drop(),false);
  const score=g.score;o.beginReturn(g);assert.equal(g.score,score,'completion is awarded only once');
  const scene=o.returnScene,flight=returnFallTicks(scene),copter=[scene.copterX,scene.copterY];
  let lastWhite=0,lastMorph=0,lastCamera=returnPose(o,960,600).cameraY,cloudTicks=0,skyTicks=0;
  assert.ok(scene.jumper.y<-600,'start well above the ordinary playfield');
  const forecastState=JSON.stringify(scene);assert.equal(returnFallTicks(scene),flight);assert.equal(JSON.stringify(scene),forecastState,'forecast must not consume live cloud randomness');
  for(let i=0;i<flight;i++){
    const pose=returnPose(o,960,600);assert.ok(pose.white>=lastWhite);assert.ok(pose.morph>=lastMorph);
    assert.equal(pose.y,(scene.jumper.y+32-pose.cameraY)*pose.s);assert.equal(pose.landed,false);
    assert.ok(pose.cameraY>=lastCamera);lastCamera=pose.cameraY;
    const {x,y}=scene.jumper,cart=scene.cartX;
    lastWhite=pose.white;lastMorph=pose.morph;tick(g);
    if(scene.state==='falling'){
      assert.equal(scene.jumper.y-y,scene.jumper.inCloud?2:8);
      if(scene.jumper.inCloud){cloudTicks++;assert.ok(Math.abs(scene.jumper.x-x)<=4);}
      else{skyTicks++;assert.equal(scene.jumper.x,x);}
    }
    assert.equal(scene.cartX-cart,2);assert.deepEqual([scene.copterX,scene.copterY],copter);
  }
  assert.ok(cloudTicks>=45,'linger inside the cloud for at least 0.9 seconds');assert.ok(skyTicks>=120);
  assert.ok(flight>=180&&flight<300,'give the descent several seconds without changing classic gravity');
  assert.equal(lastCamera,0,'camera has settled into the normal view before the landing');
  assert.equal(scene.state,'result');assert.equal(scene.outcome,'hay');assert.equal(scene.catches,1);
  assert.equal(returnPose(o,960,600).landed,true);assert.equal(returnPose(o,960,600).morph,1);
  tick(g,44);assert.equal(g.orbit,o);const cart=scene.cartX,cloud=scene.cloudX;
  tick(g);assert.equal(g.carriage,scene.carriage);assert.equal(g.cartX,cart+2);assert.equal(g.cloudX,scene.cloudX);
  assert.ok(Math.abs(g.cloudX-cloud)<=2);assert.equal(g.state,'ready');assert.equal(g.drops,1);assert.equal(g.catches,1);
  assert.equal(g.completedLoops,1);assert.equal(g.orbit.active,false);assert.equal(g.boarding.active,false);
  assert.equal(g.assault.active,false);assert.equal(g.runner.active,false);assert.equal(g.shiftCount,0);
  assert.equal(g.counterattack.phase,'dormant');assert.equal(g.boss.phase,'dormant');assert.equal(g.carriage.horseAlive,true);
  assert.equal(g.best,9999);assert.equal(g.runner.best,750);assert.equal(g.accelerationTime,.9);
  assert.equal(g.checkpoint.segment,0);assert.equal(g.score,scene.dropHeight);assert.equal(g.canDrop,true);assert.equal(g.inCinematic,false);
  assert.equal(g.drop(),true);assert.equal(g.state,'falling');tick(g,100);assert.ok(g.misses+g.catches>0);
  g.state='ready';g.orbit.startFall(g,2);g.orbit.y=WELL_END+100;g.orbit.beginReturn(g);tick(g,returnFallTicks(g.orbit.returnScene)+45);
  assert.equal(g.completedLoops,2);assert.equal(g.orbit.active,false);assert.equal(g.shiftCount,0);
});

test('loop handoff preserves the remaining simulation time in a long display frame',t=>{
  t.mock.method(Date,'now',()=>19);
  const g=createLevel('full-circle');tick(g,returnFallTicks(g.orbit.returnScene)+44);const frame=g.orbit.returnScene.frame;
  g.step(.1);
  assert.equal(g.completedLoops,1);assert.equal(g.orbit.active,false);
  assert.equal(g.frame,frame+5,'one handoff tick plus four classic ticks consume the complete frame');
  assert.ok(Math.abs(g.accumulator)<1e-8);
  const split=createLevel('full-circle');tick(split,returnFallTicks(split.orbit.returnScene)+44);
  for(let i=0;i<5;i++)split.step(.02);
  assert.equal(g.cartX,split.cartX);assert.equal(g.cloudX,split.cloudX);
});

test('the returning stuntman still reaches the hay after pausing and resizing during the fall',()=>{
  for(const [width,height]of [[390,844],[844,390],[1400,900]]){
    const g=createLevel('full-circle');tick(g,3);g.paused=true;
    const before=JSON.stringify(g.orbit);tick(g,60);assert.equal(JSON.stringify(g.orbit),before);
    const scene=g.orbit.returnScene,frame=scene.frame,age=g.orbit.age;
    g.resize(width,height);assert.equal(scene.frame,frame);assert.equal(g.orbit.age,age);
    g.paused=false;tick(g,returnFallTicks(scene));assert.equal(scene.outcome,'hay');
    tick(g,45);assert.equal(g.completedLoops,1);assert.equal(g.canDrop,true);assert.equal(g.catches,1);
  }
});

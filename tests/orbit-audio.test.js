import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { OrbitAudio } from '../src/orbit-audio.js';
import { hitEater, stepEaterCinema } from '../src/orbit-boss.js';
const step = (g,n) => { for(let i=0;i<n;i++)g.step(.02); };
function listener(g) {
  const a=new OrbitAudio(),played=[];
  a.context={state:'running'};a.prepare=()=>{};a.play=(...args)=>played.push(args);
  const update=(enabled=true)=>a.update(g,{started:true,enabled}); update();
  return {a,played,update};
}

test('descent rounds, gems, impacts and stomp all survive the last-cue slot',()=>{
  const g=createLevel('downwell'),o=g.orbit,{played,update}=listener(g);
  o.platforms=[];o.enemies=[];o.gemsItems=[];o.pressAction();step(g,1);
  o.collectGem(g);o.kill(g,{x:o.x,y:o.y+50,hp:1},true);
  update();assert.deepEqual(played.map(p=>p[0]),['shot','gem','stomp']);
  update();assert.equal(played.length,3);
  const history=o.audioEvents,serial=o.audioSerial;
  const fork=Object.assign(Object.create(Object.getPrototypeOf(o)),o);fork.sound('gun');
  assert.equal(o.audioEvents,history);assert.equal(o.audioSerial,serial);
  for(let i=0;i<100;i++)o.sound('gem');assert.equal(o.audioEvents.length,64);
});

test('machine gun follows its real shot cadence; a held empty trigger does not chatter',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit;
  o.platforms=[];o.enemies=[];o.gemsItems=[];o.pressAction();
  const serial=o.audioSerial;step(g,30);
  assert.equal(o.audioEvents.filter(e=>e.id>serial&&e.kind==='machine').length,10);
  o.ammo=0;o.releaseAction();o.pressAction();step(g,10);
  assert.equal(o.audioEvents.filter(e=>e.kind==='empty').length,1);
});

test('damage is distinct from death; mute, pause, retry and chapter exit consume old events',()=>{
  const g=createLevel('downwell'),o=g.orbit,{a,played,update}=listener(g);
  o.hurt=0;o.hurtPlayer(g);update();assert.equal(played.at(-1)[0],'player-hit');
  o.sound('gun');update(false);update();assert.equal(played.length,1);
  g.paused=true;const frozen=JSON.stringify(o.audioEvents);step(g,100);update();assert.equal(JSON.stringify(o.audioEvents),frozen);
  g.paused=false;o.hurt=0;o.health=1;o.hurtPlayer(g);o.sound('gem');update();
  assert.equal(played.at(-1)[0],'player-death');
  o.age=30;o.retry(g);update();assert.equal(played.length,2);
  o.sound('gun');update();assert.equal(played.at(-1)[0],'shot');
  o.phase='return';o.sound('gun');update();assert.equal(played.length,3);
  a.reset();assert.equal(a.previous,null);
});

test('hay armour, exposed eyes, torn phase and chain reaction have distinct recorded cues',()=>{
  const g=createLevel('slop-eater-fight'),o=g.orbit,b=o.eater,{played,update}=listener(g);
  b.open=false;hitEater(o,g,{x:b.x,power:1});update();assert.equal(played.at(-1)[0],'rock-hit');
  b.open=true;hitEater(o,g,{x:b.x,power:1});update();assert.equal(played.at(-1)[0],'enemy-hit');
  o.time+=.2;b.hp=31;b.exposure=10;b.open=true;hitEater(o,g,{x:b.x,power:1});update();
  assert.equal(o.phase,'eater-break');assert.equal(played.at(-1)[0],'rock-break');
  o.time+=.2;o.age=65;stepEaterCinema(o,g);update();assert.equal(played.at(-1)[0],'stomp');
  b.hp=1;b.open=true;hitEater(o,g,{x:b.x,power:1});update();assert.equal(played.at(-1)[0],'player-death');
  o.time+=.3;o.age=24;stepEaterCinema(o,g);update();assert.equal(played.at(-1)[0],'rock-break');
});

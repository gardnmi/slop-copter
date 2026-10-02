import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel} from '../src/level-select.js';
import {damageSpacecraft} from '../src/deck-boss.js';
import {steamState,makeBelowRoom} from '../src/below-layout.js';
import {readFileSync} from 'node:fs';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};
function fixture() {
  const g=createLevel('below-deck'),o=g.below;
  o.room.solids=[{x:0,y:160,w:320,h:20}];o.room.hazards=[];o.room.refills=[];
  o.x=180;o.y=160;return g;
}

test('the Warden destruction breaks the floor and enters Below Deck instead of the rocket',()=>{
  const g=createLevel('elevator');tick(g,101);
  damageSpacecraft(g.boarding,g,9999,g.boarding.boss.x,g.boarding.boss.y);
  tick(g,235);assert.equal(g.below.phase,'collapse');assert.equal(g.orbit.active,false);
  const before=structuredClone(g.below);g.paused=true;tick(g,100);assert.deepEqual(structuredClone(g.below),before);
  g.paused=false;tick(g,140);assert.equal(g.below.phase,'playing');assert.equal(g.below.roomIndex,0);
  assert.equal(g.boarding.boss.state,'wreck');assert.equal(g.orbit.active,false);
});

test('jump height responds to release; buffered landing and coyote jumps work',()=>{
  const heights=[];
  for(const hold of [false,true]){
    const g=fixture(),o=g.below;g.drop();let min=o.y;
    for(let i=0;i<35;i++){if(!hold&&i===2)o.releaseJump();tick(g);min=Math.min(min,o.y);}
    heights.push(min);assert.ok(o.grounded);
  }
  assert.ok(heights[1]<heights[0]-12);
  const g=fixture(),o=g.below;
  o.room.solids[0].w=50;o.x=49;g.setYoke(1,0);tick(g,7);
  assert.equal(o.grounded,false);assert.ok(o.coyote>0);g.drop();tick(g);assert.ok(o.vy<0);
  const buffered=fixture(),b=buffered.below;b.y=157;b.vy=100;b.grounded=false;b.coyote=0;
  b.pressJump();tick(buffered,3);assert.ok(b.vy<0);assert.ok(b.y<157);
});

test('eight-way dash spends one charge, ignores repeated presses, and refills on a physical landing',()=>{
  const g=fixture(),o=g.below;o.y=110;o.grounded=false;
  g.setYoke(-1,-1);o.pressDash();tick(g);assert.equal(o.dashes,0);assert.ok(o.dashFreeze>0);
  assert.ok(Math.abs(Math.hypot(o.vx,o.vy)-240)<.001);
  const start=o.x;tick(g,6);assert.ok(o.x<start);const cooldown=o.dashCooldown;
  o.pressDash();tick(g);assert.ok(o.dashCooldown<cooldown);assert.equal(o.dashes,0);
  g.setYoke(0,0);tick(g,55);assert.equal(o.dashes,1);assert.ok(o.grounded);
});

test('wall grab climbs with stamina, wall jumps push away and landing restores stamina',()=>{
  const g=fixture(),o=g.below;o.room.solids.push({x:140,y:50,w:16,h:110});
  o.x=160;o.y=115;o.grounded=false;o.coyote=0;g.setYoke(-1,-1);o.setGrab(true);
  tick(g,15);assert.ok(o.climbing);assert.ok(o.y<105);assert.ok(o.stamina<100);
  o.pressJump();tick(g);assert.ok(o.vx>0);assert.ok(o.vy<0);
  o.releaseJump();o.setGrab(false);g.setYoke(1,0);tick(g,35);assert.equal(o.stamina,110);
});

test('a crystal collected during a dash makes a newly pressed second dash immediately usable in the air',()=>{
  const g=fixture(),o=g.below;o.y=105;o.grounded=false;o.coyote=0;
  o.room.refills=[{x:190,y:99,cooldown:0}];
  g.setYoke(1,0);o.pressDash();tick(g,4);
  assert.equal(o.room.refills[0].cooldown>0,true);
  assert.equal(o.dashes,1);assert.equal(o.grounded,false);
  g.setYoke(0,-1);o.pressDash();tick(g,4);
  assert.equal(o.dashes,0);assert.deepEqual(o.dashDir,[0,-1]);
  const height=o.y;tick(g,5);assert.ok(o.y<height-12);
});

test('moving platforms carry the player and transfer horizontal momentum into a jump',()=>{
  const g=createLevel('below-cargo'),o=g.below,p=o.room.solids.find(p=>p.kind==='mover');
  o.x=p.x+20;o.y=p.y;const offset=o.x-p.x;tick(g,10);assert.ok(Math.abs(o.x-p.x-offset)<.001);
  o.pressJump();tick(g);assert.ok(o.vx>0);assert.ok(o.vy<0);
});

test('steam has a warning window; hazards retry the same room and reset its machinery',()=>{
  const g=createLevel('below-engine'),o=g.below,h=o.room.hazards[0];
  assert.equal(steamState(h,h.period-h.warning),'warning');assert.equal(steamState(h,0),'active');
  g.score=200;o.checkpointScore=200;o.x=h.x+5;o.y=h.y+20;tick(g);assert.equal(o.phase,'dead');
  tick(g,28);assert.equal(o.phase,'playing');assert.equal(o.roomIndex,4);assert.equal(o.deaths,1);
  assert.deepEqual([o.x,o.y],o.room.spawn);assert.equal(g.score,200);assert.equal(o.dashes,1);
  assert.equal(o.roomTicks,0);assert.deepEqual(o.room,makeBelowRoom(4));
});

test('crumbling platforms warn before dropping and refill cells are reusable after cooldown',()=>{
  const g=createLevel('below-engine'),o=g.below;o.enterRoom(g,5);
  const p=o.room.solids.find(p=>p.kind==='crumble');o.x=p.x+16;o.y=p.y;
  tick(g,20);assert.equal(p.gone,false);assert.ok(p.crack>0);tick(g,10);assert.equal(p.gone,true);
  o.enterRoom(g,5);const refill=o.room.refills[0];o.x=refill.x;o.y=refill.y+6;o.dashes=0;tick(g);
  assert.equal(o.dashes,1);assert.ok(refill.cooldown>0);
});

test('fixed-step motion and room checkpoints survive resizing, pauses and different render rates',()=>{
  const states=[];
  for(const fps of [25,50,100]){
    const g=fixture();g.setYoke(-1,0);g.drop();for(let i=0;i<fps*.4;i++)g.step(1/fps);
    g.below.releaseJump();g.below.pressDash();g.resize(480,960);
    for(let i=0;i<fps*.4;i++)g.step(1/fps);
    states.push(JSON.parse(JSON.stringify(g.below)));
  }
  assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);
});

test('all eight authored rooms can be crossed with ordinary controls and finish at the helicopter',()=>{
  // Recorded controller inputs; no teleporting, invulnerability or refill edits.
  const routes=JSON.parse(readFileSync(new URL('./fixtures/below-route.json',import.meta.url)));
  const g=createLevel('below-deck'),o=g.below;
  for(let room=0;room<routes.length;room++) {
    assert.equal(o.roomIndex,room);
    while(o.phase==='transition')tick(g);
    for(const [mx,my,jump,dash,grab,frames] of routes[room]){
      if(jump)o.pressJump();else o.releaseJump();
      if(dash)o.pressDash();o.setGrab(grab);
      for(let t=0;t<frames;t++){g.setYoke(mx,my);tick(g);}
    }
    assert.equal(o.deaths,0,`room ${room+1}`);
    assert.equal(o.phase,room===7?'boarding':'transition',`room ${room+1}`);
  }
  tick(g,100);assert.equal(o.phase,'complete');assert.equal(g.orbit.active,false);
  const score=g.score;tick(g,1000);assert.equal(o.phase,'complete');assert.equal(g.score,score);
  assert.equal(g.canDrop,false);assert.equal(g.orbit.active,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel} from '../src/level-select.js';

const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};
function falling(){
  const g=createLevel('downwell-storm',{seed:19}),o=g.orbit;
  o.platforms=[];o.enemies=[];o.gemsItems=[];o.grounded=false;
  o.x=160;o.y=2200;o.vy=180;o.hurt=0;o.gemHigh=150;
  return g;
}

test('afterimages record previous world poses through turns and never share mutable forecast history',()=>{
  const g=falling(),o=g.orbit;g.setYoke(1,0);tick(g,8);
  const before={x:o.x,y:o.y,facing:o.facing,vy:o.vy},snapshot=JSON.stringify(o.trail),previous=o.trail;
  g.setYoke(-1,0);tick(g);
  assert.equal(JSON.stringify(previous),snapshot);
  const last=o.trail.at(-1);
  assert.deepEqual({x:last.x,y:last.y,facing:last.facing,vy:last.vy},before);
  assert.ok(o.x<last.x);assert.equal(o.facing,-1);
  tick(g,5);assert.ok(o.trail.some(p=>p.facing===1));assert.ok(o.trail.some(p=>p.facing===-1));
  assert.ok(o.trail.length<=12);
});

test('a stopped or paused player leaves no persistent trail, and chapter transitions clear it',()=>{
  const g=falling(),o=g.orbit;g.setYoke(1,0);tick(g,18);
  assert.equal(o.trail.length,12);
  g.paused=true;const before=JSON.stringify(o.trail);tick(g,30);assert.equal(JSON.stringify(o.trail),before);
  g.paused=false;g.setYoke(0,0);o.vy=0;o.grounded=true;
  o.platforms=[{x:0,y:o.y,w:320,h:32,solid:true}];tick(g,13);assert.deepEqual(o.trail,[]);
  o.platforms=[];o.grounded=false;tick(g,10);assert.ok(o.trail.length);
  o.startFall(g,1);assert.deepEqual(o.trail,[]);
  o.grounded=false;o.vy=200;tick(g,3);assert.ok(o.trail.length);
  o.beginReturn(g);assert.deepEqual(o.trail,[]);
});

test('a banked combo displays one ordered reward stack with the actual earned rewards',()=>{
  const g=falling(),o=g.orbit;o.health=3;o.combo=25;
  o.reload(g);
  assert.equal(o.gems,100);assert.equal(o.health,4);assert.equal(o.ammo,9);
  assert.deepEqual(o.floaters.filter(f=>f.kind==='combo').map(f=>f.lines),[
    ['25 COMBO!','COMBO','REWARD!','+100 ◆','+1 AMMO','+1 ♥']
  ]);
});

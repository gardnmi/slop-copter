import test from 'node:test';
import assert from 'node:assert/strict';
import {createLevel} from '../src/level-select.js';
import {buildOrbitWell} from '../src/orbit-layout.js';
import {stepOrbitEnemy} from '../src/orbit-enemies.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};
function empty(){
  const g=createLevel('downwell',{seed:19}),o=g.orbit;
  Object.assign(o,{phase:'falling',rocket:null,launchPush:0,x:160,y:200,vy:0,hurt:0,clouds:[],enemies:[],platforms:[],gemsItems:[]});
  return g;
}

test('seeded encounter chunks vary between runs and never spawn enemies inside terrain',()=>{
  assert.deepEqual(buildOrbitWell(19),buildOrbitWell(19));
  assert.notDeepEqual(buildOrbitWell(19).chambers,buildOrbitWell(41).chambers);
  for(let seed=1;seed<=40;seed++){
    const o=buildOrbitWell(seed);
    assert.equal(o.chambers.length,15);assert.deepEqual(o.clouds,[]);
    for(let i=1;i<o.chambers.length;i++)assert.notEqual(o.chambers[i].name,o.chambers[i-1].name);
    for(const e of o.enemies){
      assert.ok(!o.platforms.some(p=>p.solid&&e.x+9>p.x&&e.x-9<p.x+p.w&&e.y+9>p.y&&e.y-9<p.y+p.h));
      if(e.type==='hopper')assert.ok(o.platforms.some(p=>p.y===e.y+10&&e.x>p.x&&e.x<p.x+p.w));
    }
  }
});

test('sentinels telegraph and pursue in both axes without crossing solid wreckage',()=>{
  const o={x:230,y:300,time:0,platforms:[]},e={type:'seeker',x:90,y:220,originX:90,phase:0};
  stepOrbitEnemy(o,e);assert.equal(e.mode,'wake');assert.equal(e.x,90);
  for(let i=0;i<40;i++)stepOrbitEnemy(o,e);
  assert.equal(e.mode,'hunt');assert.ok(e.x>110);assert.ok(e.y>230);
  o.platforms=[{x:170,y:0,w:20,h:1000,solid:true}];
  for(let i=0;i<120;i++)stepOrbitEnemy(o,e);
  assert.ok(e.x<=161,'pursuit cannot pass through the blocking wall');
});

test('ledge hoppers crouch, leap toward the player and land back on terrain',()=>{
  const o={x:240,y:270,time:0,platforms:[{x:0,y:300,w:320,h:20,solid:true}]};
  const e={type:'hopper',x:100,y:290,originX:100,phase:0,mode:'rest'};
  for(let i=0;i<25;i++)stepOrbitEnemy(o,e);
  assert.equal(e.mode,'crouch');assert.equal(e.y,290);
  for(let i=0;i<16;i++)stepOrbitEnemy(o,e);
  assert.equal(e.mode,'jump');assert.ok(e.y<290);assert.ok(e.vx>0);
  for(let i=0;i<40&&e.mode==='jump';i++)stepOrbitEnemy(o,e);
  assert.equal(e.mode,'rest');assert.equal(e.y,290);assert.ok(e.x>100);
});

test('wall crawlers warn before lunging into the open route',()=>{
  const o={x:140,y:240,time:0,platforms:[]},e={type:'crawler',x:12,y:220,originX:12,phase:0};
  stepOrbitEnemy(o,e);assert.equal(e.mode,'wake');
  for(let i=0;i<19;i++)stepOrbitEnemy(o,e);
  assert.equal(e.x,12);assert.equal(e.mode,'wake');
  for(let i=0;i<8;i++)stepOrbitEnemy(o,e);
  assert.equal(e.mode,'dive');assert.ok(e.x>25);
});

test('gem high strengthens limited gunboots, refreshes on gems, then expires',()=>{
  const g=empty(),o=g.orbit;
  o.collectGem(g,59);assert.equal(o.gemHigh,0);
  o.collectGem(g);assert.equal(o.gemHigh,150);assert.equal(o.cue.name,'pickup');
  o.fire();assert.equal(o.ammo,7);assert.equal(o.shotClock,4);assert.equal(o.shots[0].power,2);
  tick(g,10);assert.ok(o.gemHigh<150);const before=o.gems;
  o.collectGem(g,3);assert.equal(o.gems-before,6);assert.equal(o.gemHigh,150);
  tick(g,150);assert.equal(o.gemHigh,0);assert.equal(o.gemMeter,0);
  o.shotClock=0;o.fire();assert.equal(o.shots.at(-1).power,1);assert.equal(o.shotClock,6);
});

test('landing banks chain rewards once; taking damage loses the unbanked chain',()=>{
  for(const chain of [7,8,15,25]){
    const g=empty(),o=g.orbit;o.health=2;o.combo=chain;o.ammo=0;
    o.reload(g);assert.equal(o.gems,chain>=8?100:0);
    assert.equal(o.charge,chain>=15?9:8);assert.equal(o.ammo,o.charge);
    assert.equal(o.health,chain>=25?3:2);
    const state=[o.gems,o.charge,o.health,g.score];o.reload(g);
    assert.deepEqual([o.gems,o.charge,o.health,g.score],state);
  }
  const g=empty(),o=g.orbit;o.combo=25;o.hurtPlayer(g);o.reload(g);
  assert.equal(o.gems,0);assert.equal(o.charge,8);assert.equal(o.health,3);
});

test('a gem pocket must be opened before its contents magnetize through the shell',()=>{
  const g=empty(),o=g.orbit;o.x=139;o.y=212;
  const shell={x:140,y:170,w:20,h:60,solid:true,breakable:true,hp:1};
  o.platforms=[shell,{x:110,y:212,w:30,h:8}];
  const gem={x:170,y:200,value:5};o.gemsItems=[gem];tick(g,12);
  assert.equal(gem.x,170);assert.equal(o.gems,0);
  shell.dead=true;tick(g,12);assert.equal(gem.dead,true);assert.equal(o.gems,5);
});

test('gunboot shots hit intervening terrain before enemies in the same swept step',()=>{
  const g=empty(),o=g.orbit;o.y=150;
  o.platforms=[{x:140,y:300,w:40,h:8,solid:true}];
  const e={x:160,y:320,originX:160,originY:320,type:'seeker',hp:1,mode:'idle'};o.enemies=[e];
  o.shots=[{x:160,y:295,age:0,power:1}];tick(g);
  assert.equal(o.shots.length,0);assert.equal(e.dead,undefined);assert.equal(e.hp,1);
  assert.ok(o.rings.some(r=>r.kind==='spark'&&r.x===160&&r.y===300));
});

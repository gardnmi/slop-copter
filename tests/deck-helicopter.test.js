import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { damageDeckHelicopter, hitsDeckHelicopter } from '../src/deck-helicopter.js';
import { helicopterInput, deckRouteInput } from './helpers/deck-playthrough.js';
const tick=(g,n=1)=>{for(let i=0;i<n;i++)g.step(.02);};

test('the normal route meets the helicopter after the first crossing, before the cargo and flame pickup',()=>{
  const g=createLevel('deck-raid'),d=g.boarding,route={jump:0};
  for(let n=0;n<800&&d.playing&&!d.miniboss;n++){deckRouteInput(g,route);tick(g);}
  assert.ok(d.miniboss);assert.ok(d.x>=1000&&d.x<1200);assert.equal(d.section,0);
  assert.equal(d.weapon,'heavy');assert.ok(d.ammo>100&&d.ammo<200);
  assert.equal(d.pickups.find(p=>p.type==='flame').dead,undefined);
  assert.equal(d.checkpoint.label,'R-SHOBU');
  for(const level of ['deck-cargo','deck-catwalks','spaceship']){
    const later=createLevel(level);tick(later,10);assert.ok(!later.boarding.miniboss,level);
  }
});

test('R-Shobu enters once and drops three bombs down a locked lane after warning',()=>{
  const g=createLevel('deck-helicopter'),d=g.boarding,b=d.miniboss;
  assert.equal(d.checkpoint.label,'R-SHOBU');tick(g,100);assert.equal(b.state,'hover');
  tick(g,48);assert.equal(b.state,'bombs');const lane=b.targetX;
  g.setYoke(-1,0);tick(g,43);assert.equal(d.bullets.filter(s=>s.kind==='shobu-bomb').length,0);
  tick(g);assert.equal(b.targetX,lane);const bomb=d.bullets.find(s=>s.kind==='shobu-bomb');assert.equal(bomb.vx,0);assert.ok(bomb.vy>0);
  const released=new Set([bomb]);for(let i=0;i<28;i++){tick(g);for(const p of d.bullets)if(p.kind==='shobu-bomb')released.add(p);}
  assert.equal(released.size,3);
  assert.equal(b.targetX,lane);assert.equal(d.miniboss,b);
});

test('the helicopter hull takes swept shots and flashes; the rotor and empty corners are not its hitbox',()=>{
  const g=createLevel('deck-helicopter'),d=g.boarding,b=d.miniboss;tick(g,100);
  assert.equal(hitsDeckHelicopter(b,b.x,b.y+80,b.x,b.y-10),true);
  assert.equal(hitsDeckHelicopter(b,b.x-90,b.y-40,b.x+90,b.y-40),false);
  damageDeckHelicopter(d,g,2,b.x,b.y);assert.equal(b.hp,98);assert.equal(b.hit,3);
  tick(g,4);assert.equal(b.hit,0);
});

test('helicopter death clears its bombs, awards once and releases the final boss',()=>{
  const g=createLevel('deck-helicopter'),d=g.boarding;tick(g,210);
  const before=g.score;damageDeckHelicopter(d,g,1000,d.miniboss.x,d.miniboss.y);
  assert.equal(d.miniboss.state,'dying');assert.ok(!d.bullets.some(b=>b.kind==='shobu-bomb'));
  assert.equal(g.score,before+1500);damageDeckHelicopter(d,g,1000,0,0);assert.equal(g.score,before+1500);
  d.x=3462;tick(g,98);assert.equal(d.boss,null);tick(g,2);assert.equal(d.boss.state,'wake');
});

test('helicopter Continue restores its own entry, ammunition and score; pause is stable',()=>{
  const g=createLevel('deck-helicopter'),d=g.boarding,ammo=d.ammo;tick(g,150);
  d.ammo=12;d.health=1;d.hurt=0;d.hurtPlayer(g);tick(g,30);g.continueSegment();
  const next=g.boarding;assert.equal(next.ammo,ammo);assert.equal(next.miniboss.hp,100);assert.equal(next.miniboss.state,'enter');
  g.paused=true;const state=JSON.stringify(next.miniboss);tick(g,100);g.resize(390,844);assert.equal(JSON.stringify(next.miniboss),state);
});

test('arrow movement and upward gunfire beat the miniboss at both viewport sizes',()=>{
  for(const [width,height]of [[1280,800],[390,844]]){
    const g=createLevel('deck-helicopter',{width,height}),d=g.boarding;
    for(let n=0;n<1400&&d.playing&&d.miniboss.state!=='wreck';n++){helicopterInput(g);tick(g);}
    assert.equal(d.miniboss.state,'wreck');assert.ok(d.health>0);assert.ok(d.ammo>0&&d.ammo<140);
  }
});

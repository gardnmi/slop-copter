import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { DECK_WEAPONS, equipWeapon, fireDeckWeapon, tickDeckShots, currentWeapon } from '../src/deck-weapons.js';
const advance = (g, n) => { for (let i = 0; i < n; i++) g.step(.02); };

test('pistol starts every fresh deck run; only three authored weapon pickups follow H, F, H', () => {
  const g=createLevel('deck-raid'),d=g.boarding;
  assert.equal(currentWeapon(d),'pistol');assert.equal(d.ammo,0);
  assert.deepEqual(Object.keys(DECK_WEAPONS),['pistol','heavy','flame']);
  const weapons=d.pickups.filter(p=>p.type!=='medkit');
  assert.deepEqual(weapons.map(p=>p.type),['heavy','flame','heavy']);
  assert.ok(weapons[0].x<400&&weapons[1].x>1800&&weapons[1].x<2100&&weapons[2].x>3000);
  assert.equal(createLevel('elevator').boarding.pickups.length,0);
  for(const removed of ['rifle','shotgun','rocket','laser'])assert.equal(equipWeapon(d,removed),false);
});

test('both pickups have finite ammunition and return to the unlimited pistol', () => {
  const d=createLevel('deck-raid').boarding;
  for(const type of ['heavy','flame']) {
    equipWeapon(d,type);assert.equal(d.ammo,DECK_WEAPONS[type].ammo);
    d.ammo=1;d.shots=[];fireDeckWeapon(d,100,100,0);
    assert.equal(d.shots[0].weapon,type);assert.equal(d.ammo,0);assert.equal(currentWeapon(d),'pistol');
    fireDeckWeapon(d,100,100,-Math.PI/2);assert.equal(d.shots.at(-1).weapon,'pistol');assert.equal(d.shots.at(-1).vy,-600);
  }
});

test('machine gun rounds spread around the barrel direction; pistol rounds remain straight', () => {
  for(const angle of [0,Math.PI,-Math.PI/2]) {
    const d=createLevel('deck-raid').boarding;equipWeapon(d,'heavy');
    for(let i=0;i<12;i++)fireDeckWeapon(d,113,79,angle);
    const cross=d.shots.map(s=>Math.cos(angle)*s.vy-Math.sin(angle)*s.vx);
    assert.ok(Math.min(...cross)<-20&&Math.max(...cross)>20);
    assert.ok(d.shots.every(s=>s.startX===113&&s.startY===79&&Math.abs(Math.atan2(Math.sin(Math.atan2(s.vy,s.vx)-angle),Math.cos(Math.atan2(s.vy,s.vx)-angle)))<.07));
    equipWeapon(d,'pistol');d.shots=[];for(let i=0;i<12;i++)fireDeckWeapon(d,113,79,angle);
    assert.ok(d.shots.every(s=>Math.abs(Math.cos(angle)*s.vy-Math.sin(angle)*s.vx)<.001));
  }
});

test('flame kills engulf infantry but do not give tanks a human burning death', () => {
  const g=createLevel('deck-raid'),d=g.boarding;
  for(const type of ['soldier','grenadier','turret']) {
    const e={x:500,y:260,hp:3,type};d.hitEnemy(g,e,6,'flame');
    assert.equal(e.dead,true);assert.equal(e.burning,type!=='turret');
  }
  const e={x:500,y:260,hp:1,type:'soldier'};d.hitEnemy(g,e,1,'pistol');assert.equal(e.burning,false);
});

test('flame clouds have short range and damage every pierced target only once', () => {
  const g=createLevel('deck-raid'),d=g.boarding;d.props=[];
  d.enemies=[160,184].map(x=>({x,y:117,hp:30,type:'soldier',dead:false}));
  equipWeapon(d,'flame');fireDeckWeapon(d,120,100,0);const flame=d.shots[0];
  for(let i=0;i<30;i++)tickDeckShots(d,g);
  assert.deepEqual(d.enemies.map(e=>e.hp),[24,24]);assert.equal(d.shots.length,0);assert.ok(flame.x<280);
});

test('weapon and ammo survive checkpoint retry, pause and viewport changes', () => {
  const g=createLevel('deck-cargo'),d=g.boarding;
  equipWeapon(d,'flame');d.ammo=27;d.save(g);d.ammo=9;
  d.health=1;d.hurt=0;d.hurtPlayer(g);advance(g,30);g.continueSegment();
  assert.equal(g.boarding.weapon,'flame');assert.equal(g.boarding.ammo,27);
  g.paused=true;g.resize(390,844);advance(g,80);assert.equal(g.boarding.ammo,27);
});

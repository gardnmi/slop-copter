import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { damageSpacecraft, hitsSpacecraft } from '../src/deck-boss.js';
import { WARDEN_HEALTH, DESCENT_TICKS, liftFloor, LIFT_CENTER } from '../src/deck-elevator.js';
import { equipWeapon } from '../src/deck-weapons.js';
const tick = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.02); };

test('both outside catwalk edges allow a genuine fall to the lower deck', () => {
  for (const [x, direction] of [[3442,-1], [3952,1]]) {
    const g = createLevel('spaceship'), d = g.boarding;
    d.x=x;d.y=158;d.grounded=true;d.boss.age=-1000;
    g.setYoke(direction,0);tick(g,35);
    assert.equal(d.y,260);assert.ok(d.grounded);assert.equal(d.health,5);
    assert.ok(direction < 0 ? d.x < 3432 : d.x > 3963);
  }
});

test('the floor descends continuously, carrying a player from either catwalk without snapping the camera', () => {
  for(const [x,y] of [[3714,260],[3460,158],[3910,158]]) {
    const g=createLevel('spaceship'),d=g.boarding;tick(g,75);
    d.x=x;d.y=y;d.grounded=true;d.vy=0;d.bullets=[];
    damageSpacecraft(d,g,1000,d.boss.x,d.boss.y);
    assert.equal(d.boss.state,'descent');assert.equal(d.x,x);assert.equal(d.y,y);
    let screen=d.y-d.cameraY,worldY=d.y;
    for(let i=0;i<DESCENT_TICKS;i++) {
      tick(g);const next=d.y-d.cameraY;
      assert.ok(Math.abs(next-screen)<3,`camera jump ${next-screen}`);
      assert.ok(d.y>=worldY-.01);screen=next;worldY=d.y;
    }
    assert.equal(d.boss.form,'elevator');assert.equal(d.boss.x,LIFT_CENTER);
    assert.ok(d.lift.depth>450);assert.equal(d.health,5);assert.ok(Math.abs(d.y-liftFloor(d))<.001);
    assert.equal(d.x,x);assert.equal(d.platforms.filter(p=>p.arena).length,0);
  }
});

test('phase two has an independent Continue checkpoint and holds position while paused and resized', () => {
  const g=createLevel('elevator'),d=g.boarding;
  equipWeapon(d,'flame');d.ammo=31;d.save(g);const depth=d.lift.depth;
  tick(g,110);damageSpacecraft(d,g,30,d.boss.x,d.boss.y+40);
  d.health=1;d.hurt=0;d.hurtPlayer(g);tick(g,30);g.continueSegment();
  assert.equal(g.boarding.boss.hp,WARDEN_HEALTH);assert.equal(g.boarding.boss.state,'warden-wake');
  assert.equal(g.boarding.lift.depth,depth);assert.equal(g.boarding.ammo,31);assert.equal(g.boarding.health,5);
  g.paused=true;const state=JSON.stringify(g.boarding.boss);tick(g,100);g.resize(390,844);
  assert.equal(JSON.stringify(g.boarding.boss),state);assert.equal(g.boarding.lift.depth,depth);
  assert.ok(g.boarding.boss.x>g.boarding.cameraX);assert.ok(g.boarding.boss.x<g.boarding.cameraX+g.boarding.width);
});

test('the overhead boss is reachable by both upward weapons but not horizontal ground shots', () => {
  for(const type of ['heavy','flame']){
    const g=createLevel('elevator'),d=g.boarding;tick(g,100);d.boss.age=-1000;
    equipWeapon(d,type);d.setFire(true);g.setYoke(0,0);tick(g,20);
    assert.equal(d.boss.hp,WARDEN_HEALTH);
    g.setYoke(0,-1);tick(g,30);assert.ok(d.boss.hp<WARDEN_HEALTH,type);
  }
});

test('guns warn and lock their aim; the press marks a fixed dodgeable lane; the fan leaves gaps', () => {
  const g=createLevel('elevator'),d=g.boarding,b=d.boss;tick(g,100);
  assert.equal(b.state,'warden-crossfire');const aim=b.aimX;d.x+=100;
  tick(g,b.warning-1);assert.equal(d.bullets.length,0);tick(g);
  assert.equal(b.aimX,aim);assert.equal(d.bullets.length,2);
  for(let i=0;i<250&&b.state!=='warden-press';i++)tick(g);
  assert.equal(b.state,'warden-press');const zone=b.drillX;d.x=zone-85;
  tick(g,b.warning+13);assert.equal(b.drillX,zone);assert.equal(d.health,5);
  for(let i=0;i<250&&b.state!=='warden-fan';i++)tick(g);
  assert.equal(b.state,'warden-fan');tick(g,b.warning);
  assert.equal(d.bullets.filter(s=>s.kind==='warden-orb').length,7);
});

test('destroying the Warden ends in wreckage with one score award and no surviving ship', () => {
  const g=createLevel('elevator'),d=g.boarding;tick(g,100);
  damageSpacecraft(d,g,1000,d.boss.x,d.boss.y+40);const score=g.score;
  assert.equal(d.boss.state,'warden-dying');assert.equal(d.bullets.length,0);
  assert.equal(hitsSpacecraft(d.boss,d.boss.x,d.boss.y+40,d.boss.x,d.boss.y+40),false);
  tick(g,200);assert.equal(d.phase,'cleared');assert.equal(d.boss.state,'wreck');assert.equal(g.score,score+3000);
  while(g.orbit.phase==='breach')tick(g);assert.equal(g.score,score+3000);
});

test('standing still firing loses to the heavy press, while readable dodges win the same fight', async () => {
  const { spacecraftInput } = await import('./helpers/deck-playthrough.js');
  for (const dodge of [false, true]) {
    const g = createLevel('elevator'), d = g.boarding;
    for (let i = 0; i < 2000 && d.playing; i++) {
      if (dodge) spacecraftInput(g); else { g.setYoke(0, -1); d.setFire(true); }
      tick(g);
    }
    assert.equal(d.phase, dodge ? 'cleared' : 'dead');
    if (dodge) assert.ok(d.health >= 3);
  }
});

test('the final boss stays at screen center on ultrawide and portrait displays', () => {
  for (const [width, height] of [[2560, 720], [1280, 800], [390, 844]]) {
    const g = createLevel('elevator', { width, height }), d = g.boarding;
    tick(g, 120);
    assert.ok(Math.abs(d.boss.x - d.cameraX - d.width / 2) < .01);
    g.resize(height, width);
    assert.ok(Math.abs(d.boss.x - d.cameraX - d.width / 2) < .01);
  }
});

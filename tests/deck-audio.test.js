import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel } from '../src/level-select.js';
import { equipWeapon } from '../src/deck-weapons.js';
import { damageSpacecraft } from '../src/deck-boss.js';
import { DeckAudio } from '../src/deck-audio.js';
const ticks = (g, n) => { for (let i = 0; i < n; i++) g.step(.02); };

test('deck sound events follow actual pistol/HMG rounds and retain simultaneous action', () => {
  const g = createLevel('deck-raid'), d = g.boarding;
  d.enemies = []; d.props = []; d.pickups = []; d.setFire(true);
  const serial = d.audioSerial; ticks(g, 50);
  assert.equal(d.audioEvents.filter(e => e.id > serial && e.kind === 'weapon-pistol').length, 6);
  equipWeapon(d, 'heavy'); const heavy = d.audioSerial; ticks(g, 50);
  assert.equal(d.audioEvents.filter(e => e.id > heavy && e.kind === 'weapon-heavy').length, 13);
  assert.equal(d.ammo, 187);
  equipWeapon(d, 'flame'); const from = d.audioSerial; ticks(g, 1);
  const enemy = { x: d.x + 25, y: d.y, hp: 1, type: 'soldier' };
  d.hitEnemy(g, enemy, 6, 'flame'); d.throwGrenade(); d.explodeGrenade(g, d.thrown[0]);
  const kinds = d.audioEvents.filter(e => e.id > from).map(e => e.kind);
  for (const kind of ['weapon-flame', 'rebel-death', 'grenade', 'grenade-explosion']) assert.ok(kinds.includes(kind), kind);
  assert.ok(enemy.burning);
  const frozen = JSON.stringify(d.audioEvents); g.paused = true; ticks(g, 100);
  assert.equal(JSON.stringify(d.audioEvents), frozen);
  for (let i = 0; i < 150; i++) d.emitAudio('impact');
  assert.equal(d.audioEvents.length, 64);
});

test('weapon pickups announce once and boss death has one villain voice separate from its explosions', () => {
  const g = createLevel('deck-raid'), d = g.boarding;
  d.x = 270; const before = d.audioSerial; ticks(g, 1);
  assert.deepEqual(d.audioEvents.filter(e => e.id > before).map(e => e.kind), ['pickup-heavy']);
  const bossGame = createLevel('elevator'), b = bossGame.boarding;
  b.boss.state = 'warden-recover'; damageSpacecraft(b, bossGame, 10000, b.boss.x, b.boss.y);
  ticks(bossGame, 180);
  assert.equal(b.audioEvents.filter(e => e.kind === 'boss-death').length, 1);
  assert.ok(b.audioEvents.filter(e => e.kind === 'heavy-explosion').length > 1);
});

test('deck audio consumes events without changing simulation, replaying history or dropping death to the frame cue', () => {
  const g = createLevel('deck-raid'), d = g.boarding, audio = new DeckAudio(), played = [];
  audio.context = { state: 'running' }; audio.prepare = () => {};
  audio.play = name => { played.push(name); };
  audio.update(g, { started: true, enabled: true });
  d.emitAudio('weapon-pistol'); d.hitEnemy(g, { x: 120, y: 260, hp: 1, type: 'soldier' }, 1);
  const before = JSON.stringify(g);
  audio.update(g, { started: true, enabled: true });
  assert.deepEqual(played, ['pistol', 'rebel-death']);
  audio.update(g, { started: true, enabled: true }); assert.equal(played.length, 2);
  assert.equal(JSON.stringify(g), before);
  d.emitAudio('weapon-heavy'); audio.update(g, { started: true, enabled: false });
  audio.update(g, { started: true, enabled: true }); assert.equal(played.length, 2);
  d.health = 1; d.hurt = 0; d.hurtPlayer(g); d.sound('jump');
  audio.update(g, { started: true, enabled: true });
  assert.equal(played.at(-1), 'player-death');
});

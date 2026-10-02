import { markHit, tickHit } from './hit-flash.js';
import { surfaceBelow, landingSurface } from './deck-layout.js';
import { spacecraftMotion, tickSpacecraftMotion, recoilSpacecraft, spacecraftCannon } from './spacecraft-motion.js';

import { beginDescent, tickElevator } from './deck-elevator.js';
export const SPACECRAFT_TRIGGER = 3460;
export const SPACECRAFT_ARENA = 3420;
export const SPACECRAFT_HEALTH = 240;
const FLOOR = 260;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function startSpacecraft(d, game) {
  if (d.boss) return;
  d.boss = { form: 'ship', maxHp: SPACECRAFT_HEALTH, state: 'wake', age: 0, time: 0, attack: 0, hp: SPACECRAFT_HEALTH,
    x: 3870, y: FLOOR - 54, facing: -1, side: 1, hit: 0, hitWait: 0, marks: [], flash: 0,
    motion: spacecraftMotion(), vents: [], volley: 0 };
  d.enemies = d.enemies.filter(e => !e.parachuting && e.x < SPACECRAFT_ARENA - 150);
  d.chutes = [];
  d.bullets = []; d.shots = []; d.thrown = []; d.impacts = [];
  d.health = 5; d.grenades = Math.max(d.grenades, 8); d.hurt = 100;
  d.save(game); d.sound('boss-wake');
  game.message = 'THAT IS NO RESCUE SHIP. Disable its defense system! J fires · K jumps · L grenades.';
}

export function spacecraftHull(b) {
  if (b.form === 'elevator') return { left: b.x - 64, right: b.x + 64, top: b.y + 8, bottom: b.y + 63 };
  return { left: b.x - 116, right: b.x + 112, top: b.y - 18, bottom: b.y + 43 };
}

// Segment/rectangle collision keeps fast rounds reliable at either frame rate.
export function hitsSpacecraft(b, x0, y0, x1, y1, padding = 0) {
  if (!b || ['wake', 'descent', 'warden-wake', 'warden-dying', 'wreck'].includes(b.state)) return false;
  const r = spacecraftHull(b); let enter = 0, leave = 1;
  for (const [p, velocity, lo, hi] of [[x0, x1 - x0, r.left - padding, r.right + padding], [y0, y1 - y0, r.top - padding, r.bottom + padding]]) {
    if (!velocity) { if (p < lo || p > hi) return false; continue; }
    const a = (lo - p) / velocity, z = (hi - p) / velocity;
    enter = Math.max(enter, Math.min(a, z)); leave = Math.min(leave, Math.max(a, z));
    if (enter > leave) return false;
  }
  return true;
}

export function damageSpacecraft(d, game, damage, x, y) {
  const b = d.boss;
  if (!b || ['wake', 'descent', 'warden-wake', 'warden-dying', 'wreck'].includes(b.state)) return false;
  b.hp = Math.max(0, b.hp - damage); markHit(b);
  d.impact(x, y, -1, 'armor', damage >= 10 ? .9 : .45);
  b.motion.hitKick = Math.min(2, b.motion.hitKick + (damage >= 10 ? 1.8 : .6));
  if (damage >= 10) recoilSpacecraft(b, 1.5);
  if (!b.hp) {
    if (b.form === 'ship') beginDescent(d, game);
    else {
      b.state = 'warden-dying'; b.age = 0; b.marks = []; b.flash = 0;
      d.bullets = []; d.shots = []; d.thrown = []; d.hurt = 200;
      d.sound('boss-down'); d.emitAudio('boss-death', b.x);
      game.message = 'REACTOR RUPTURE. THERE GOES YOUR RIDE.';
    }
  }
  return true;
}

function enterAttack(d, game) {
  const b = d.boss;
  b.state = ['mortar', 'sweep', 'plasma', 'cannon'][b.attack++ % 4]; b.age = 0;
  b.warning = b.hp <= SPACECRAFT_HEALTH / 2 ? 38 : 48;
  b.startX = b.side > 0 ? 3870 : 3560; b.endX = b.side > 0 ? 3560 : 3870;
  b.aimX = d.x; b.aimY = d.y - 20;
  b.cannonAngle = undefined;
  b.marks = b.state === 'mortar' ? [-60, 0, 60].map((offset, port) => mortarMark(d, b, clamp(d.x + offset, SPACECRAFT_ARENA + 30, 3980), port)) : [];
  game.message = { cannon: 'CANNON LOCKED — leave its firing line or change levels.', mortar: 'MORTARS — leave the marked platform.', sweep: 'CROSSING OVERHEAD — move under it and fire UP!', plasma: 'DECK SWEEP — get onto a catwalk or jump the pulses.' }[b.state];
}

function mortarMark(d, b, targetX, port) {
  const targetY = surfaceBelow(d.platforms, targetX)?.y ?? FLOOR, flight = .9;
  const originX = b.x - b.facing * (18 + port * 14), originY = 50;
  const shot = { x: originX, y: originY, vx: (targetX - originX) / flight,
    vy: (targetY - 3 - originY - .5 * 650 * flight * flight) / flight - 650 / 100 };
  // Predict the first actual landing, including intervening upper catwalks.
  // The warning and the fired shell share this stored trajectory.
  let { x, y, vy } = shot;
  for (let i = 0; i < 100; i++) {
    const oldY = y; x += shot.vx * .02; vy += 13; y += vy * .02;
    const surface = vy >= 0 && landingSurface(d.platforms, x, oldY + 3, y + 3, 2);
    if (surface) return { x, y: surface.y, shot, fired: false };
  }
  return { x: targetX, y: targetY, shot, fired: false };
}

export function tickSpacecraft(d, game) {
  if (!d.boss) return;
  const x = d.boss.x;
  tickSpacecraftState(d, game);
  tickSpacecraftMotion(d.boss, d.boss.x - x);
}

function fireFeedback(d, kind, origin, force = 2.5) {
  const b = d.boss;
  recoilSpacecraft(b, force); b.volley++;
  b.vents.push({ ...origin, kind, age: 0 }); b.vents = b.vents.slice(-12);
  d.shake = Math.max(d.shake, kind === 'cannon' ? .75 : .35);
  d.sound('boss-shot');
}

function tickSpacecraftState(d, game) {
  const b = d.boss; if (!b) return;
  b.age++; b.time++; tickHit(b); b.flash = Math.max(0, b.flash - 1);
  for (const v of b.vents) v.age++;
  b.vents = b.vents.filter(v => v.age < 18);
  if (b.state === 'descent' || b.form === 'elevator') { tickElevator(d, game); return; }
  // Low counterattack windows belong in the clear central landing lane. First
  // return above the gantries, then descend; never fly the hull through one.
  if (b.state === 'recover') b.x += (3710 - b.x) * .10;
  const targetY = { wake: 100, mortar: 90, sweep: 70, cannon: 90, plasma: 90,
    recover: Math.abs(b.x - 3710) < 10 ? 145 : 70 }[b.state];
  b.y += (targetY + Math.sin(b.time * .07) * 2 - b.y) * .08;
  if (b.state === 'wake') {
    if (b.age >= 70) enterAttack(d, game);
    return;
  }
  if (b.state === 'recover') {
    if (b.age >= (b.hp <= SPACECRAFT_HEALTH / 2 ? 38 : 55)) enterAttack(d, game);
    return;
  }
  const t = b.age - b.warning;
  if (b.state === 'sweep' && t < 0 && b.y < 104) b.x += (b.startX - b.x) * .2;
  if (b.state === 'sweep' && t >= 0) {
    const progress = clamp(t / 150, 0, 1), eased = progress * progress * (3 - 2 * progress);
    b.x = b.startX + (b.endX - b.startX) * eased;
    b.facing = Math.sign(b.endX - b.startX);
    // Three committed aimed bursts. They do not track after being telegraphed.
    if ([0, 48, 96].includes(t)) { b.aimX = d.x; b.aimY = d.y - 20; b.lockAge = b.age; }
    if ([24, 72, 120].includes(t)) {
      const muzzle = spacecraftCannon(b), { x, y, angle } = muzzle;
      for (const spread of [-.20, 0, .20]) d.bullets.push({ x, y, vx: Math.cos(angle + spread) * 155, vy: Math.sin(angle + spread) * 155, age: 0, kind: 'cannon' });
      b.flash = 3; fireFeedback(d, 'cannon', muzzle);
    }
    if (t >= 150) { b.side *= -1; b.facing = -b.side; b.state = 'recover'; b.age = 0; }
    return;
  }
  if (b.state === 'cannon' && t >= 0 && t <= 50 && t % 10 === 0) {
    if (t === 0) b.cannonAngle = spacecraftCannon(b).angle;
    const muzzle = spacecraftCannon(b);
    d.bullets.push({ x: muzzle.x, y: muzzle.y, vx: Math.cos(b.cannonAngle) * 200, vy: Math.sin(b.cannonAngle) * 200, age: 0, kind: 'cannon' });
    b.flash = 3; fireFeedback(d, 'cannon', muzzle);
  }
  if (b.state === 'mortar' && t >= 0 && t <= 32 && t % 16 === 0) {
    const mark = b.marks[t / 16];
    d.bullets.push({ ...mark.shot,
      age: 0, lob: true, kind: 'mortar', targetX: mark.x });
    mark.fired = true; b.flash = 4; fireFeedback(d, 'mortar', { x: mark.shot.x, y: mark.shot.y, angle: Math.atan2(mark.shot.vy, mark.shot.vx) }, 3);
  }
  if (b.state === 'plasma' && t >= 0 && t <= 50 && t % 50 === 0) {
    for (const [x, vx] of [[3436, 180], [4004, -180]]) d.bullets.push({ x, y: FLOOR - 9, vx, vy: 0, age: 0, kind: 'plasma' });
    b.flash = 4; fireFeedback(d, 'plasma', { x: b.x, y: b.y + 35, angle: Math.PI / 2 }, 4);
  }
  if (t >= (b.state === 'mortar' ? 88 : 92)) { b.state = 'recover'; b.age = 0; b.marks = []; }
}

// Aircraft lift and its overhead command rig. All geometry remains in world
// coordinates; carrying the player and camera by the same delta prevents cuts.
import { breakLift } from './deck-collapse.js';
export const WARDEN_HEALTH = 360;
export const DESCENT_TICKS = 320;
export const LIFT_LEFT = 3408;
export const LIFT_RIGHT = 4020;
export const LIFT_CENTER = (LIFT_LEFT + LIFT_RIGHT) / 2;
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
export const liftFloor = d => 260 + (d.lift?.depth || 0);

function setupLift(d) {
  d.lift ??= { depth: 0, age: 0, speed: 0 };
  d.enemies = []; d.chutes = []; d.bullets = []; d.shots = []; d.thrown = [];
  d.props = d.props.filter(p => p.x < LIFT_LEFT);
  for (const p of d.platforms) if (p.arena) p.lift = true;
  const floor = d.platforms.find(p => p.lift && p.solid);
  floor.h = 26;
}
function carryLift(d, delta) {
  // Airborne actors/projectiles share the lift's reference frame. Gravity and
  // jumping still integrate normally relative to it, including a falling rider.
  d.lift.depth += delta; d.cameraFloor += delta; d.y += delta;
  for (const p of d.platforms) if (p.lift) p.y += delta;
  for (const group of [d.shots, d.bullets, d.thrown, d.explosions, d.impacts, d.particles, d.pickups])
    for (const p of group) if (p.x >= LIFT_LEFT) p.y += delta;
  if (d.boss.form === 'elevator') {
    d.boss.y += delta; d.boss.aimY += delta;
    for (const m of d.boss.marks) m.y += delta;
  }
}
export function beginDescent(d, game) {
  const b = d.boss;
  Object.assign(b, { state: 'descent', age: 0, marks: [], flash: 0, wreckX: b.x, wreckY: b.y });
  setupLift(d); d.hurt = DESCENT_TICKS + 80;
  d.score(game, 1200); d.sound('boss-down');
  game.message = 'The pilot ejects. AIRCRAFT LIFT RELEASED — stay aboard!';
}
export function beginElevator(d, game, direct = false) {
  if (!d.lift) setupLift(d);
  if (direct) {
    carryLift(d, 520 - d.lift.depth);
    d.platforms = d.platforms.filter(p => !p.arena);
    d.x = LIFT_CENTER; d.y = liftFloor(d); d.vx = d.vy = 0; d.grounded = true;
    d.cameraFloor = liftFloor(d) - 20;
  }
  Object.assign(d.boss, { form: 'elevator', state: 'warden-wake', age: 0, hp: WARDEN_HEALTH, maxHp: WARDEN_HEALTH,
    x: LIFT_CENTER, y: liftFloor(d) - 290, attack: 0, warning: 52, marks: [], hit: 0, hitWait: 0, flash: 0,
    aimX: d.x, aimY: d.y - 20, drillX: LIFT_CENTER, drill: 0, leftRecoil: 0, rightRecoil: 0, core: 0, vents: [] });
  d.bullets = []; d.shots = []; d.thrown = []; d.health = 5; d.hurt = 100;
  d.pickups = [];
  d.save(game); d.sound('boss-wake', d.boss.x, 'boss-laugh');
  game.message = 'THE WARDEN — the same pilot, a much bigger machine. Hold ↑ + J to fire at its belly.';
}
export function wardenMuzzles(b) {
  return [-1, 1].map(side => {
    const x = b.x + side * 124, y = b.y + 34;
    const angle = Math.atan2(b.aimY - y, b.aimX - x);
    return { x: x + Math.cos(angle) * 47, y: y + Math.sin(angle) * 47, angle, side, pivot: { x, y } };
  });
}
export function drillExtension(b) {
  if (b.state !== 'warden-press') return 0;
  const t = b.age - b.warning;
  return t < 0 ? 0 : t < 12 ? t / 12 : t < 28 ? 1 : Math.max(0, 1 - (t - 28) / 30);
}
function attack(d, game) {
  const b = d.boss;
  b.state = ['warden-crossfire', 'warden-press', 'warden-fan'][b.attack++ % 3];
  b.age = 0; b.warning = b.hp < WARDEN_HEALTH / 2 ? 44 : 56;
  b.aimX = d.x; b.aimY = d.y - 21; b.drillX = clamp(d.x, LIFT_LEFT + 48, LIFT_RIGHT - 48);
  b.marks = b.state === 'warden-press' ? [{ x: b.drillX, y: liftFloor(d) }] : [];
  game.message = { 'warden-crossfire': 'GUNS LOCKED — move out of the lines, then fire upward.',
    'warden-press': 'HYDRAULIC PRESS — leave the striped landing zone!',
    'warden-fan': 'CORE VENTING — thread the gaps and shoot its underside.' }[b.state];
}
export function tickElevator(d, game) {
  const b = d.boss, lift = d.lift; lift.age++;
  if (b.state === 'descent') {
    if (b.age < 66 && b.age % 11 === 1) { d.burst(b.wreckX + b.age * 23 % 130 - 65, b.wreckY + b.age * .3, 1.5); d.sound('destroy'); }
    // Retract the arena gantries down to the lift, carrying anyone on them.
    for (const p of d.platforms.filter(p => p.arena)) {
      const delta = Math.min(1.6, liftFloor(d) - p.y);
      if (d.grounded && Math.abs(d.y - p.y) < .1 && d.x + 8 > p.x && d.x - 8 < p.x + p.w) d.y += delta;
      p.y += delta;
    }
    d.platforms = d.platforms.filter(p => !p.arena || p.y < liftFloor(d) - 1);
    if (b.age > 60) { lift.speed += (2 - lift.speed) * .045; carryLift(d, lift.speed); }
    if (b.age === 60) d.sound('lift');
    if (b.age >= DESCENT_TICKS) beginElevator(d, game);
    return;
  }
  if (b.state === 'wreck') return;
  lift.speed += ((b.state === 'warden-dying' ? 0 : .48) - lift.speed) * .035;
  carryLift(d, lift.speed);
  b.leftRecoil *= .72; b.rightRecoil *= .72;
  b.core += ((['warden-fan', 'warden-recover'].includes(b.state) ? 1 : .2) - b.core) * .08;
  if (b.state === 'warden-dying') {
    if (b.age < 90 && b.age % 9 === 1) {
      d.burst(b.x + (b.age * 29 % 250) - 125, b.y + (b.age * 13 % 88) - 44, b.age > 80 ? 2.4 : 1.5);
      if (b.age % 27 === 1) d.sound('boss-down');
    }
    if (b.age === 48) { d.burst(b.x - 102, b.y - 40, 1.2); d.burst(b.x + 102, b.y - 40, 1.2); }
    if (b.age >= 48) {
      b.crashVY = (b.crashVY || 0) + .38; b.y += b.crashVY;
      if (b.y + 63 >= liftFloor(d)) {
        b.y = liftFloor(d) - 63;
        breakLift(d, game, LIFT_LEFT, LIFT_RIGHT, liftFloor(d));
      }
    }
    return;
  }
  // The target remains centered; only its suspension heaves. A low belly gives
  // both weapons a viable upward shot from the lift without a required jump.
  const targetY = liftFloor(d) - 172 + Math.sin(b.time * .045) * 3;
  b.y += (targetY - b.y) * (b.state === 'warden-wake' ? .04 : .12);
  if (b.state === 'warden-wake' || b.state === 'warden-recover') {
    if (b.age >= (b.state === 'warden-wake' ? 100 : 60)) attack(d, game);
    return;
  }
  const t = b.age - b.warning;
  if (b.state === 'warden-crossfire' && [0, 20, 40].includes(t)) {
    for (const m of wardenMuzzles(b)) {
      d.bullets.push({ x: m.x, y: m.y, vx: Math.cos(m.angle) * 145, vy: Math.sin(m.angle) * 145, age: 0, kind: 'warden-round' });
      b[m.side < 0 ? 'leftRecoil' : 'rightRecoil'] = 5;
    }
    b.flash = 4; d.sound('boss-shot');
  }
  b.drill = drillExtension(b);
  if (b.state === 'warden-press' && t === 12) {
    d.burst(b.drillX, liftFloor(d) - 6, 1.5); d.shake = 2.5; d.sound('stomp');
    if (Math.abs(d.x - b.drillX) < 30 && d.y > liftFloor(d) - 55) d.hurtPlayer(game, 2);
  }
  if (b.state === 'warden-fan' && [0, 38].includes(t)) {
    // Fixed gaps, not aimed bullets filling the entire play area.
    for (const a of [.38, .74, 1.10, 1.57, 2.04, 2.40, 2.76]) {
      d.bullets.push({ x: b.x, y: b.y + 60, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, age: 0, kind: 'warden-orb' });
    }
    b.flash = 5; d.sound('boss-shot');
  }
  if (t >= 94) { b.state = 'warden-recover'; b.age = 0; b.marks = []; b.drill = 0; }
}

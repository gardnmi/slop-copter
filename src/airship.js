// The hostile flying fortress is separate from the friendly sea carrier.
import { markHit, tickHit } from './hit-flash.js';
export const AIRSHIP_INTRO_TICKS = 110;
export const AIRSHIP_FALL_TICKS = 160;
export function positionAirship(a) {
  const b = a.airship;
  b.width = Math.min(360, a.width * .78);
  b.x = a.width / 2 + Math.sin(b.age / 145) * a.width * .08;
  b.y = Math.min(a.height * .29, 137) - Math.max(0, 1 - b.age / AIRSHIP_INTRO_TICKS) * 250;
  for (const p of b.parts) { p.x = b.x + p.offset * b.width; p.y = b.y + (p.id === 'reactor' ? .025 : .015) * b.width; }
}
export function exposedAirshipParts(a) {
  const wings = a.airship.parts.filter(p => p.id !== 'reactor' && p.hp > 0);
  return wings.length ? wings : a.airship.parts.filter(p => p.hp > 0);
}
export function beginAirship(a, game) {
  a.enemies = []; a.bullets = []; a.shots = []; a.pickups = []; a.wrecks = [];
  a.health = Math.min(6, a.health + 2); a.power = Math.max(2, a.power);
  a.hurt = 100;
  a.airship = { age: 0, x: a.width / 2, y: -250, width: 0, parts: [
    { id: 'port', offset: -.29, hp: 58, maxHp: 58, radius: 25, clock: 90, hit: 0, aim: null },
    { id: 'starboard', offset: .29, hp: 58, maxHp: 58, radius: 25, clock: 130, hit: 0, aim: null },
    { id: 'reactor', offset: 0, hp: 150, maxHp: 150, radius: 32, clock: 85, hit: 0, aim: null },
  ] };
  positionAirship(a); a.enter('airship', game);
  game.message = 'IRON VULTURE. Break the wing weapons, then the reactor. The carrier is beyond it.';
  a.saveCheckpoint(game);
}
export function damageAirship(a, game, part, damage) {
  if (a.phase !== 'airship' || a.airship.age < AIRSHIP_INTRO_TICKS || !exposedAirshipParts(a).includes(part)) return;
  part.hp = Math.max(0, part.hp - damage); markHit(part);
  if (part.hp) { a.emitAudio('impact', part.x); return; }
  part.destroyedAt = a.time;
  a.burst(part.x, part.y, 30); a.sound('destroy', part.x, 'heavy-air'); a.shake = .2; a.addScore(game, 600);
  if (part.id === 'reactor') {
    a.bullets = []; a.shots = []; a.enter('airship-down', game);
    game.message = 'AIRSHIP DOWN. The carrier has cleared you for landing.';
  } else if (exposedAirshipParts(a)[0].id === 'reactor') {
    a.bullets = []; a.hurt = Math.max(a.hurt, 60);
    game.message = 'REACTOR EXPOSED. Stay below the hull and break through!';
  }
}
export function tickAirship(a) {
  const b = a.airship; b.age++; positionAirship(a);
  for (const p of b.parts) { tickHit(p); p.flash = Math.max(0, (p.flash || 0) - 1); }
  if (b.age < AIRSHIP_INTRO_TICKS) return;
  for (const p of exposedAirshipParts(a)) {
    if (Math.hypot(a.x - p.x, a.y - p.y) < 80) { p.clock = Math.max(p.clock, 36); p.aim = null; continue; }
    p.clock--;
    if (p.clock <= 32 && p.aim === null) p.aim = Math.atan2(a.y - p.y, a.x - p.x);
    if (p.clock > 0) continue;
    p.attack = (p.attack || 0) + 1; p.flash = 5;
    a.emitAudio('enemy-fire', p.x);
    // Offset the next fan into the previous gaps instead of repeating a wall.
    const core = p.id === 'reactor', fan = core
      ? p.attack % 2 ? [-.6, -.4, -.2, 0, .2, .4, .6] : [-.5, -.3, -.1, .1, .3, .5]
      : p.attack % 2 ? [-.36, -.18, 0, .18, .36] : [-.27, -.09, .09, .27];
    for (const offset of fan) a.enemyShot(p.x, p.y + 8, p.aim + offset, core ? 142 : 125);
    if (core) for (const side of [-1, 1]) a.enemyShot(b.x + side * b.width * .32, b.y + 15, Math.PI / 2, 115, 40);
    p.clock = core ? 60 : 84; p.aim = null;
  }
}

import { sweptHit } from './air-assault.js';
import { markHit, tickHit } from './hit-flash.js';

export const HELICOPTER_TRIGGER = 1050;
export const HELICOPTER_HEALTH = 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function startDeckHelicopter(d, game) {
  if (d.miniboss) return;
  d.miniboss = { x: d.x + d.width * .65, y: 68, hp: HELICOPTER_HEALTH, age: 0, time: 0,
    state: 'enter', hit: 0, facing: -1, attack: 0, targetX: clamp(d.x + 85, 1080, 1190), vx: 0, dead: false };
  // A separate encounter checkpoint retains the supply picked up on approach.
  d.bullets = []; d.health = Math.min(5, d.health + 1); d.hurt = 80; d.save(game); d.sound('boss-wake');
  game.message = 'R-SHOBU! Shoot upward. Let the bomb column fall, then move underneath.';
}

export function hitsDeckHelicopter(b, x, y, nx, ny, radius = 0) {
  if (!b || b.dead || b.state === 'wreck') return false;
  return [-20, 15].some(offset => sweptHit(x, y, nx, ny, b.x + b.facing * offset, b.y + 7, 32 + radius));
}

export function damageDeckHelicopter(d, game, amount, x, y) {
  const b = d.miniboss;
  if (!b || b.dead) return;
  b.hp = Math.max(0, b.hp - amount); markHit(b); d.impact(x, y, 1, 'armor', .3);
  if (b.hp) return;
  b.dead = true; b.state = 'dying'; b.age = 0;
  d.bullets = d.bullets.filter(p => p.kind !== 'shobu-bomb');
  d.score(game, 1500); d.sound('boss-down');
}

export function tickDeckHelicopter(d, game) {
  if (!d.miniboss && !d.boss && d.x >= HELICOPTER_TRIGGER && d.x < 1230 && d.grounded) startDeckHelicopter(d, game);
  const b = d.miniboss;
  if (!b || b.state === 'wreck') return;
  b.age++; b.time++; tickHit(b);
  if (b.dead) {
    b.y += .22; b.x += Math.sin(b.time * .06) * .25;
    if (b.age % 12 === 1) { d.burst(b.x + b.age * 19 % 62 - 31, b.y + b.age * 7 % 34 - 17, 1.4); d.sound('destroy'); }
    if (b.age >= 100) { b.state = 'wreck'; d.burst(b.x, b.y, 2.6); game.message = 'GO! Through the cargo bay.'; }
    return;
  }
  const lastX = b.x;
  // Hold the first encounter over the clear aft-deck landing. Players can
  // still leave either side; if they run ahead the gunship follows smoothly.
  const pursuit = Math.max(0, d.x - 1330);
  const left = 975 + pursuit, right = 1220 + pursuit;
  if (b.state === 'enter') {
    b.x += (b.targetX - b.x) * .025;
    b.y += (105 - b.y) * .025;
    if (b.age >= 100) { b.state = 'hover'; b.age = 0; }
  } else if (b.state === 'hover') {
    b.y = 106 + Math.sin(b.time * .07) * 4;
    if (b.age >= 48) {
      b.state = 'bombs'; b.age = 0; b.targetX = clamp(d.x, left, right); b.attack++;
    }
  } else if (b.state === 'bombs') {
    // Lock the lane before dropping a visible string. Never chase the player
    // with bombs after release; crossing below the tail is a reliable dodge.
    b.x += clamp(b.targetX - b.x, -2.3, 2.3);
    b.y = 105 + Math.sin(b.time * .07) * 3;
    if ([44, 58, 72].includes(b.age)) {
      d.bullets.push({ x: b.x - 9, y: b.y + 27, vx: 0, vy: 30, age: 0, lob: true, kind: 'shobu-bomb' });
      d.sound('boss-shot');
    }
    if (b.age >= 88) { b.state = 'cross'; b.age = 0; b.targetX = clamp(d.x + (b.attack % 2 ? 90 : -90), left, right); }
  } else {
    b.x += clamp(b.targetX - b.x, -2.1, 2.1);
    b.y = 100 + Math.sin(b.time * .06) * 5;
    if (b.age >= 85) { b.state = 'hover'; b.age = 0; }
  }
  b.vx = b.x - lastX;
  // Side-facing gunship always presents its nose toward the player.
  if (Math.abs(d.x - b.x) > 45) b.facing = d.x < b.x ? -1 : 1;
}

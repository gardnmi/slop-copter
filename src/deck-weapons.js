import { sweptHit } from './air-assault.js';
import { insideSolid } from './deck-layout.js';
import { hitsSpacecraft, damageSpacecraft } from './deck-boss.js';
import { hitsDeckHelicopter, damageDeckHelicopter } from './deck-helicopter.js';

export const DECK_WEAPONS = {
  pistol: { name: 'PISTOL', letter: '', ammo: 0, interval: 9, damage: 1, speed: 600, life: 55 },
  heavy: { name: 'MACHINE GUN', letter: 'H', ammo: 200, interval: 4, damage: 2, speed: 500, life: 65 },
  flame: { name: 'FLAME SHOT', letter: 'F', ammo: 30, interval: 12, damage: 6, speed: 310, life: 24 },
};
export const currentWeapon = d => ['heavy', 'flame'].includes(d.weapon) && d.ammo > 0 ? d.weapon : 'pistol';
export const weaponReadout = d => currentWeapon(d) === 'pistol' ? 'PISTOL ∞' : `${currentWeapon(d) === 'heavy' ? 'HMG' : 'FLAME'} ${d.ammo}`;
export function equipWeapon(d, type, game) {
  if (!DECK_WEAPONS[type]) return false;
  d.weapon = type; d.ammo = DECK_WEAPONS[type].ammo; d.shotClock = 0;
  d.sound('pickup', d.x, type === 'pistol' ? 'equip' : `pickup-${type}`);
  if (game) game.message = `${DECK_WEAPONS[type].name}! J fires · ↑ aims upward.`;
  return true;
}
export function fireDeckWeapon(d, x, y, angle) {
  const type = currentWeapon(d), w = DECK_WEAPONS[type];
  d.shotClock = w.interval; d.flash = 3; d.firedWeapon = type;
  d.shotSerial = (d.shotSerial || 0) + 1;
  // A lively stream of individual rounds, not a shotgun fan. The barrel is
  // always the origin; the pattern is deterministic at every display rate.
  if (type === 'heavy') angle += [0, -.045, .03, -.065, .055, -.02][d.shotSerial % 6];
  d.shots.push({ x, y, startX: x, startY: y, vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
    age: 0, variant: d.shotSerial % 3, damage: w.damage, heavy: type === 'heavy', weapon: type, life: w.life, hits: [] });
  if (type !== 'pistol') d.ammo--;
  d.sound(`weapon-${type}`, x);
}

export function tickDeckShots(d, game) {
  const targets = [...d.enemies.map((e, i) => ({ e, id: `e${i}`, x: e.x, y: e.y - 17, radius: e.type === 'turret' ? 22 : 13 }))
    .filter(t => !t.e.dead && t.x > d.cameraX - 20 && t.x < d.cameraX + d.width + 20),
  ...d.props.map((p, i) => ({ p, id: `p${i}`, x: p.x + p.w / 2, y: p.y + p.h / 2, radius: Math.min(p.w, p.h) / 2 })).filter(t => !t.p.dead)];
  for (const s of d.shots) {
    const x = s.x, y = s.y, flame = s.weapon === 'flame';
    s.hits ??= []; s.age++; s.x += s.vx * .02; s.y += s.vy * .02;
    const radius = flame ? 5 + s.age * .65 : 0;
    const contact = targets.filter(t => !t.e?.dead && !t.p?.dead && !s.hits.includes(t.id) && sweptHit(x, y, s.x, s.y, t.x, t.y, t.radius + radius))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    for (const t of contact) {
      s.hits.push(t.id);
      if (t.e) d.hitEnemy(game, t.e, s.damage, s.weapon); else d.hitProp(game, t.p, s.damage);
      d.impact(s.x, s.y, -Math.sign(s.vx || 1), t.e?.type === 'turret' ? 'armor' : 'spark');
      if (!flame || t.p) { s.dead = true; break; }
    }
    if (!s.dead && !s.hits.includes('helicopter') && hitsDeckHelicopter(d.miniboss, x, y, s.x, s.y, radius)) {
      damageDeckHelicopter(d, game, s.damage, s.x, s.y);
      s.hits.push('helicopter'); if (!flame) s.dead = true;
    }
    if (!s.dead && !s.hits.includes('boss') && hitsSpacecraft(d.boss, x, y, s.x, s.y, radius)) {
      damageSpacecraft(d, game, s.damage, s.x, s.y);
      s.hits.push('boss'); if (!flame) s.dead = true;
    }
    if (!s.dead && insideSolid(d.platforms, s.x, s.y)) { s.dead = true; d.impact(s.x, s.y, -Math.sign(s.vx || 1)); }
  }
  d.shots = d.shots.filter(s => !s.dead && s.age < (s.life || 65) && Math.abs(s.x - d.x) < d.width + 50 && s.y > d.cameraY - 100);
}

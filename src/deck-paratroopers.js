import { landingSurface, surfaceBelow } from './deck-layout.js';

// Finite authored ambushes, restored with the section checkpoint. Their landing
// lanes straddle the upper/lower routes instead of tracking the player's head.
export const PARATROOPER_WAVES = [
  { at: 280, x: [510, 715] }, { at: 1200, x: [1370, 1640] },
  { at: 2290, x: [2420, 2580, 2760] }, { at: 3040, x: [3215, 3360] },
];

export function deployParatroopers(d) {
  if (d.boss) return;
  for (let i = 0; i < PARATROOPER_WAVES.length; i++) {
    const wave = PARATROOPER_WAVES[i];
    if (d.paraWaves.includes(i) || d.x < wave.at) continue;
    d.paraWaves.push(i);
    if (d.x > wave.at + 450) continue; // Direct level shortcuts skip earlier ambushes.
    wave.x.forEach((x, slot) => {
      const floor = surfaceBelow(d.platforms, x);
      d.enemies.push({ x, originX: x, laneX: x, y: Math.min(d.cameraY - 12 - slot * 28, floor.y - 165),
        type: 'soldier', hp: 3, maxHp: 3, age: 0, hit: 0, hitWait: 0, state: 'parachute', clock: 80 + slot * 22,
        facing: -1, flash: 0, aim: 0, dead: false, paratrooper: true, parachuting: true, airborneShots: 0, paraSeed: i * 5 + slot });
    });
  }
}

export function releaseParachute(d, e, killed = false) {
  if (!e.parachuting) return;
  d.chutes.push({ x: e.x, y: e.y - 77, age: 0, killed, seed: e.paraSeed });
  d.chutes = d.chutes.slice(-10); e.parachuting = false;
  if (killed) { e.airDeath = true; e.dropVy = 60; }
}

export function tickChutes(d) {
  for (const c of d.chutes) { c.age++; c.x += .35; c.y += c.killed ? -.2 : 1.65; }
  d.chutes = d.chutes.filter(c => c.age < 38);
}

export function tickParatrooper(d, e) {
  if (e.airDeath) {
    e.deathAge++;
    const oldY = e.y; e.dropVy += 12; e.y += e.dropVy * .02;
    const floor = landingSurface(d.platforms, e.x, oldY, e.y);
    if (floor) { e.y = floor.y; e.airDeath = false; }
    return true;
  }
  if (e.dead) return false;
  if (e.landingAge) { e.landingAge--; e.walking = false; return true; }
  if (!e.parachuting) return false;
  const oldY = e.y;
  e.x = e.laneX + Math.sin(e.age * .036 + e.paraSeed) * 13;
  e.y += 1.05 + Math.sin(e.age * .05 + e.paraSeed) * .12;
  e.facing = e.state === 'air-aim' ? e.shotFacing : Math.sign(d.x - e.x) || -1;
  const surfaces = [...d.platforms, ...d.props.filter(p => !p.dead && p.type !== 'barrel')];
  const floor = landingSurface(surfaces, e.x, oldY, e.y);
  if (floor) {
    e.y = floor.y; e.originX = e.x; e.landingAge = 22;
    e.state = 'patrol'; e.clock = 40; releaseParachute(d, e);
    d.explosions.push({ x: e.x, y: e.y - 4, age: 24, size: .35 }); return true;
  }
  if (e.y > 480) { e.dead = true; e.deathAge = 48; releaseParachute(d, e, true); return true; }
  const onScreen = e.x > d.cameraX + 15 && e.x < d.cameraX + d.width - 15 && e.y > d.cameraY + 88;
  const targetBelow = d.y - e.y > 42;
  if (onScreen && targetBelow && e.airborneShots < 2 && --e.clock <= 0) {
    if (e.state !== 'air-aim') {
      e.state = 'air-aim'; e.clock = 28;
      e.aim = Math.atan2(d.y - 22 - (e.y - 20), d.x - e.x); e.shotFacing = e.facing;
    } else {
      e.facing = e.shotFacing; e.flash = 5;
      d.bullets.push({ x: e.x + e.facing * 18, y: e.y - 20,
        vx: Math.cos(e.aim) * 115, vy: Math.sin(e.aim) * 115, age: 0, kind: 'pararocket' });
      d.sound('boss-shot');
      e.airborneShots++; e.state = 'parachute'; e.clock = 90;
    }
  }
  return true;
}

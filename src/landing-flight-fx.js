import { LANDING } from './carrier-landing.js';

// Cosmetic state runs on the same fixed clock as flight. It survives a pause,
// stays bounded, and never applies forces or consumes additional fuel.
export function tickLandingFlightFX(r) {
  const fx = r.flightFX ??= { age: 0, power: 0, rotor: 0, particles: [], serial: 0 };
  fx.age++;
  const target = r.status === 'flying' ? r.thrust : 0;
  fx.power += (target - fx.power) * (target > fx.power ? .42 : .17);
  if (fx.power < .002) fx.power = 0;
  fx.rotor = (fx.rotor + .36 + fx.power * .88) % (Math.PI * 2);
  for (const p of fx.particles) {
    p.age++; p.x += p.vx / 50; p.y += p.vy / 50;
    p.vx *= .985; p.vy *= .98;
    const onDeck = p.x > r.shipX && p.x < r.shipX + LANDING.shipWidth;
    const floor = onDeck ? r.deckY : LANDING.seaY;
    if (p.kind === 'wash' && p.y + p.size * .3 >= floor) {
      p.y = floor - 3; p.kind = onDeck ? 'dust' : 'spray'; p.age = 8; p.life = 28;
      p.vx = (onDeck ? r.shipSpeed : 0) + p.side * 70; p.vy = -12;
    }
  }
  fx.particles = fx.particles.filter(p => p.age < p.life);
  if (r.status !== 'flying' || fx.power < .06) return;
  const cos = Math.cos(r.angle), sin = Math.sin(r.angle);
  const emit = (lx, ly, data) => fx.particles.push({
    x: r.x + lx * cos - ly * sin, y: r.y - 24 + lx * sin + ly * cos,
    age: 0, variant: fx.serial++ % 6, power: fx.power, ...data,
  });
  if (fx.age % 3 === 0) {
    // Exhaust leaves the aft turbine; the wash fans out below the rotor disk.
    if (target) emit(-14, -8, { kind: 'exhaust', vx: r.vx * .25 - 52 * cos,
      vy: -9 - 15 * sin, life: 25, size: 10, side: -1 });
    for (const side of [-1, 1]) {
      const lane = 17 + fx.serial % 3 * 5;
      emit(side * lane, 20, { kind: 'wash', vx: r.vx * .2 + side * 13 - sin * 105,
        vy: r.vy * .12 + cos * 105, life: 24, size: 20, side });
    }
  }
  // Surface response grows only when the rotor is actually near deck or sea.
  const onDeck = r.x > r.shipX && r.x < r.shipX + LANDING.shipWidth;
  const floor = onDeck ? r.deckY : LANDING.seaY, clearance = floor - r.y;
  if (clearance > 0 && clearance < 75 && fx.age % 4 === 0) {
    for (const side of [-1, 1]) fx.particles.push({
      x: r.x + side * (18 + clearance * .2), y: floor - 3,
      vx: (onDeck ? r.shipSpeed : 0) + side * (45 + fx.power * 55), vy: -10,
      age: 0, life: 30, size: 16, side, variant: fx.serial++ % 6,
      kind: onDeck ? 'dust' : 'spray', power: fx.power * (1 - clearance / 95),
    });
  }
  if (fx.particles.length > 72) fx.particles.splice(0, fx.particles.length - 72);
}

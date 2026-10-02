// Reuse shaded arcade vapor and rotor cells instead of geometric speed lines.
import { LANDING } from './carrier-landing.js';
const tintCache = new WeakMap();
const COLORS = {
  wash: [[82, 114, 126], [234, 247, 240]],
  exhaust: [[82, 90, 96], [214, 223, 219]],
  dust: [[100, 92, 72], [235, 217, 174]],
  spray: [[77, 121, 140], [234, 249, 250]],
};
function vapor(frame, kind) {
  let entries = tintCache.get(frame.sprite);
  if (!entries) { entries = {}; tintCache.set(frame.sprite, entries); }
  if (entries[kind]) return entries[kind];
  const canvas = document.createElement('canvas');
  canvas.width = frame.sprite.width; canvas.height = frame.sprite.height;
  const c = canvas.getContext('2d'); c.drawImage(frame.sprite, 0, 0);
  const image = c.getImageData(0, 0, canvas.width, canvas.height), data = image.data;
  const [shade, light] = COLORS[kind];
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const t = Math.min(1, (data[i] + data[i + 1] + data[i + 2]) / 570);
    for (let k = 0; k < 3; k++) data[i + k] = Math.round(shade[k] + (light[k] - shade[k]) * t);
  }
  c.putImageData(image, 0, 0); entries[kind] = canvas; return canvas;
}
function puff(c, frames, p, age = p.age) {
  const t = age / p.life, image = vapor(frames[p.variant % frames.length], p.kind);
  const size = p.size * (.65 + t * 1.4);
  const width = size * (p.kind === 'exhaust' ? 1.5 : 1.2), height = size * .64;
  c.globalAlpha = Math.sin(t * Math.PI) ** .7 * p.power * (p.kind === 'wash' ? .68 : .7);
  c.drawImage(image, Math.round(p.x - width / 2), Math.round(p.y - height / 2), Math.round(width), Math.round(height));
}

export function drawLandingVapor(c, r, actors, reduced) {
  const fx = r.flightFX;
  if (!fx) return;
  c.save();
  if (!reduced) for (const p of fx.particles) puff(c, actors.liftSmoke, p);
  else if (r.status === 'flying' && r.thrust > 0) {
    // A steady short plume gives the same powered-state cue without flicker.
    const onDeck = r.x > r.shipX && r.x < r.shipX + LANDING.shipWidth;
    const floor = onDeck ? r.deckY : LANDING.seaY, nearSurface = floor - r.y < 30;
    for (const side of [-1, 1]) puff(c, actors.liftSmoke, {
      x: r.x + side * 25, y: nearSurface ? floor - 5 : r.y + 13, size: 18, variant: side + 2,
      kind: nearSurface ? onDeck ? 'dust' : 'spray' : 'wash', life: 24, age: 10, power: r.thrust,
    });
    puff(c, actors.liftSmoke, { x: r.x - 25, y: r.y - 32, size: 12,
      variant: 2, kind: 'exhaust', life: 24, age: 10, power: r.thrust });
  }
  c.restore();
}

export function drawLandingRotors(c, r, actors, reduced) {
  const fx = r.flightFX, power = reduced ? r.thrust : fx?.power || 0;
  const phase = reduced ? 1 : fx?.rotor || 0;
  const frames = actors.shobuRotor;
  const draw = (angle, alpha, y) => {
    const frame = frames[Math.floor(angle / (Math.PI * 2) * frames.length) % frames.length];
    c.globalAlpha = alpha;
    c.drawImage(frame.sprite, -56, y, 142, 7 + power * 4);
  };
  c.save();
  // Ghosted blade poses create a rotor blur which builds with powered lift.
  if (power > .02) {
    draw((phase + 1.7) % (Math.PI * 2), power * .25, -22);
    draw((phase + 3.4) % (Math.PI * 2), power * .18, -21);
  }
  draw(phase, .72 + power * .28, -22);
  // Animate the tail rotor on its actual shaft, not around the tail fin.
  c.globalAlpha = 1; c.translate(-50, -14); c.rotate(phase * 1.5);
  c.fillStyle = '#343d3e'; c.fillRect(-7, -1, 14, 2); c.fillRect(-1, -7, 2, 14);
  c.fillStyle = '#c4cab6'; c.fillRect(-7, -1, 4, 1); c.fillRect(0, 4, 1, 3);
  c.restore();
}

export function drawLandingExhaust(c, r, actors, reduced) {
  if (r.status !== 'flying' || !r.thrust) return;
  const age = reduced ? 2 : r.flightFX?.age || 0;
  const frame = actors.flameShot[1 + Math.floor(age / 2) % 4];
  c.save(); c.translate(-14, -8); c.scale(-1, 1);
  // A short textured hot core sits inside the trailing gray exhaust plume.
  const length = reduced ? 9 : [9, 12, 10, 14][Math.floor(age / 2) % 4];
  c.globalAlpha = .85 * r.thrust;
  c.drawImage(frame.sprite, 0, -3, length, 6);
  c.restore();
}

import { collapseStep } from './deck-collapse.js';
import { LIFT_LEFT, LIFT_RIGHT, LIFT_CENTER } from './deck-elevator.js';

export const WELL_ENTRY_TICKS = 220;
export const WELL_ENTRY_MUSIC_FADE = 110;
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const lerp = (a, b, t) => a + (b - a) * t;

export function beginWellEntry(o, game) {
  const d = game.boarding;
  let distance = 0, velocity = d.vy;
  for (let n = 0; n < WELL_ENTRY_TICKS; n++) { velocity = collapseStep(velocity); distance += velocity * .02; }
  o.entry = { startY: d.y, startScreenY: (d.y - d.cameraY) / d.height, distance };
  o.phase = 'breach'; o.age = 0; o.y = 164 - distance;
  o.x = (d.x - LIFT_LEFT) / (LIFT_RIGHT - LIFT_LEFT) * 320;
  o.facing = d.facing; o.vy = d.vy; o.grounded = false;
  o.cameraY = o.y - o.entry.startScreenY * 560;
  game.releaseControls();
  game.message = 'THE FLOOR GIVES WAY. Keep falling…';
}

export function tickWellEntry(o, game) {
  const d = game.boarding;
  d.tick(game);
  o.y = 164 - o.entry.distance + d.y - o.entry.startY; o.vy = d.vy;
  o.cameraY = o.y - lerp(o.entry.startScreenY * 560, 164, smooth(o.age / WELL_ENTRY_TICKS));
  if (o.age >= WELL_ENTRY_TICKS) {
    // Position/velocity and the visible well are already the gameplay state.
    // Never rebuild the level or insert a launch / jump prompt at this boundary.
    o.phase = 'falling'; o.age = 0; o.entry = null; o.hurt = 45; o.shake = 0;
    o.clearInput(); game.releaseControls();
    game.message = 'LEFT / RIGHT steer. Hold J / SPACE to fire downward and slow your fall. Land or stomp to reload.';
  }
}

export function wellEntryView(o, d, w, h) {
  const frame = smooth(o.age / 180), morph = smooth((o.age - 85) / 105);
  const zoom = lerp(h / d.height, 320 / (LIFT_RIGHT - LIFT_LEFT), frame);
  const screenY = lerp(o.entry.startScreenY * h, 164, smooth(o.age / WELL_ENTRY_TICKS));
  const centerX = lerp((LIFT_CENTER - d.cameraX) * h / d.height, w / 2, frame);
  return { zoom, screenY, x: centerX + (d.x - LIFT_CENTER) * zoom,
    cameraX: LIFT_CENTER - centerX / zoom, cameraY: d.y - screenY / zoom,
    palette: smooth((o.age - 32) / 110), blend: smooth((o.age - 100) / 95), morph,
    hud: smooth((o.age - 190) / 30) };
}

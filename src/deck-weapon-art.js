import { line, box } from './air-art.js';

export function weaponPickup(c, art, item, y) {
  c.save(); c.translate(Math.round(item.x), Math.round(y)); art.draw(c, art.heavy);
  if (item.type !== 'heavy') {
    box(c, '#171e1b', -8, -8, 17, 17);
    art.draw(c, art.flameLetter);
  }
  c.restore();
}

export function weaponShot(c, s, art, reduced) {
  const type = s.weapon || 'heavy', speed = Math.hypot(s.vx, s.vy), dx = s.vx / speed, dy = s.vy / speed;
  c.save();
  // The native tracer is longer than one tick of travel. Clip its tail at the
  // muzzle until it has cleared the gun, so no flash appears behind the hand.
  const reach = Math.hypot(s.x - s.startX, s.y - s.startY);
  if (reach < 70) {
    const angle = Math.atan2(dy, dx);
    c.translate(s.startX, s.startY); c.rotate(angle); c.beginPath(); c.rect(0,-60,1000,120); c.clip();
    c.rotate(-angle); c.translate(-s.startX,-s.startY);
  }
  if (type === 'flame') {
    c.save(); c.translate(Math.round(s.x), Math.round(s.y)); c.rotate(Math.atan2(dy, dx));
    const index = s.age < 12 ? Math.min(8, Math.floor(s.age * .75)) : Math.min(18, 9 + Math.floor((s.age - 12) * .85));
    art.draw(c, art.flameShot[index]); c.restore();
  } else if (type === 'heavy') {
    c.save(); c.translate(Math.round(s.x), Math.round(s.y)); c.rotate(Math.atan2(dy, dx));
    art.draw(c, art.heavyStreak[(s.variant + Math.floor(s.age / 3)) % 3]); c.restore();
  } else {
    line(c, '#d8a253', [[s.x - dx * 5, s.y - dy * 5], [s.x, s.y]], 2);
    line(c, '#fff5ce', [[s.x - dx * 3, s.y - dy * 3], [s.x, s.y]], 1);
  }
  c.restore();
}

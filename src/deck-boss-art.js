import { box, line, label } from './air-art.js';
import { spacecraftCannon } from './spacecraft-motion.js';

export function drawSpacecraft(c, d, art, reduced) {
  const b = d.boss;
  if (b?.form === 'elevator') { art.deck.elevator.draw(c, d, art, reduced); return; }
  if (b?.state === 'descent') { art.deck.elevator.descent(c, d, art, reduced); return; }
  art.deck.spacecraft.draw(c, d, art, reduced);
  if (!b) return;
  for (const xx of [3436, 4004]) {
    art.deck.scenery.draw(c, 'emitter', xx - 9, 248, 18, 12);
    if (b.state === 'plasma') box(c, '#a1f1d2', xx - 1, 252, 3, 3);
    if (b.state === 'plasma' && b.age < b.warning) {
      line(c, '#73c9b6', [[xx - 12, 244], [xx - 8, 240], [xx + 8, 240], [xx + 12, 244]], 1);
    }
  }
  if ((b.state === 'sweep' && b.age - (b.lockAge ?? 0) < 24) || (b.state === 'cannon' && b.age < b.warning)) {
    c.save(); c.globalAlpha = .5; c.setLineDash([3, 7]);
    const muzzle = spacecraftCannon(b);
    line(c, '#de9368', [[muzzle.x, muzzle.y], [b.aimX, b.aimY]], 1); c.restore();
    line(c, '#ffbb78', [[b.aimX - 6, b.aimY], [b.aimX + 6, b.aimY]], 1);
    line(c, '#ffbb78', [[b.aimX, b.aimY - 6], [b.aimX, b.aimY + 6]], 1);
  }
  for (const mark of b.marks) {
    const bright = reduced || Math.floor(b.age / 7) % 2;
    const color = bright ? '#ffbc7b' : '#ac5546';
    line(c, color, [[mark.x - 12, mark.y - 3], [mark.x - 4, mark.y - 3]], 2);
    line(c, color, [[mark.x + 4, mark.y - 3], [mark.x + 12, mark.y - 3]], 2);
    line(c, color, [[mark.x - 4, mark.y - 12], [mark.x, mark.y - 8], [mark.x + 4, mark.y - 12]], 1);
  }
  if (b.state === 'wake') label(c, 'PILOT: YOU ARE NOT TAKING MY SHIP', b.x - 64, b.y - 74, 9, '#f6c184', 'center');
}

export function deckProjectile(c, b, reduced) {
  const x = Math.round(b.x), y = Math.round(b.y);
  if (b.kind === 'warden-orb' || b.kind === 'warden-round') {
    const r = b.kind === 'warden-orb' ? 4 : 3;
    box(c, '#3c211c', x - r - 1, y - r, r * 2 + 2, r * 2);
    box(c, '#e47e38', x - r, y - r, r * 2, r * 2);
    box(c, '#fff4bb', x - r + 1, y - r + 1, r, r);
  } else if (b.kind === 'shockwave') {
    line(c, '#de8049', [[x - 8, y + 5], [x - 4, y - 5], [x + 4, y - 7], [x + 8, y + 5]], 4);
    line(c, '#ffe8aa', [[x - 5, y + 5], [x - 2, y - 3], [x + 3, y - 4], [x + 5, y + 5]], 2);
  } else if (b.kind === 'pararocket') {
    c.save(); c.translate(x, y); c.rotate(Math.atan2(b.vy, b.vx));
    line(c, '#466273', [[-8, 0], [-3, 0]], 3);
    line(c, '#75cddd', [[-4, 0], [3, 0]], 4);
    box(c, '#fff4c8', 0, -1, 4, 2); c.restore();
  } else if (b.kind === 'plasma') {
    const length = reduced ? 7 : 9 + b.age % 3;
    line(c, '#2b726f', [[x + 4, y], [x + length, y]], 5);
    line(c, '#84e7cd', [[x - 3, y], [x + 4, y]], 7);
    box(c, '#edf8c8', x - 3, y - 2, 4, 4); box(c, '#3d9d96', x + 7, y - 1, 3, 2);
  } else if (b.lob) {
    c.save(); c.translate(x, y); c.rotate(reduced ? 0 : b.age * .24);
    box(c, '#192422', -3, -3, 6, 7); box(c, '#849077', -2, -2, 4, 5);
    box(c, '#d7d1a4', -2, -2, 2, 2); box(c, '#e9bb66', 0, -5, 2, 2); c.restore();
  } else {
    const facing = Math.sign(b.vx) || -1, heavy = b.kind === 'cannon';
    line(c, '#593b26', [[x - facing * (heavy ? 8 : 4), y], [x + facing * 2, y]], heavy ? 5 : 3);
    line(c, '#e9b45e', [[x - facing * (heavy ? 6 : 3), y], [x + facing * 2, y]], heavy ? 3 : 2);
    box(c, '#fff0b7', x, y - 1, 2, 2);
  }
}

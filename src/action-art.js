import { CINEMATIC_TICKS, gunnerWeapon } from './counterattack.js';
import { BODY_FRAMES, BODY_ANCHORS, WEAPON_FRAME, WEAPON_PIVOT, WEAPON_MUZZLE, CLOTH_FRAMES, CLOTH_KNOTS, CINEMA_SHOTS } from './action-assets.js';

const box = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function stroke(c, a, b, color, width = 1) {
  let [x, y] = a.map(Math.round); const [endX, endY] = b.map(Math.round);
  const dx = Math.abs(endX - x), dy = -Math.abs(endY - y), sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    box(c, x - Math.floor(width / 2), y - Math.floor(width / 2), width, width, color);
    if (x === endX && y === endY) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}
function caption(c, value, x, y, size, color = '#d8ded0', align = 'left') {
  c.font = `bold ${size}px "Courier New", monospace`; c.fillStyle = color; c.textAlign = align;
  c.fillText(value, x, y); c.textAlign = 'left';
}

// Atlas art is generated from the user's Omacontra visual references. Crop and
// rig coordinates live beside the renderer so the original bitmap stays intact.
export class ActionArt {
  constructor() {
    this.small = document.createElement('canvas'); this.small.width = 80; this.small.height = 48;
    this.bodyFrames = []; this.clothFrames = [];
  }
  async load() {
    const load = async name => {
      const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/${name}.png`;
      await image.decode(); return image;
    };
    [this.atlas, this.cinema] = await Promise.all([load('gunner-atlas'), load('counterattack-cinema')]);
    // Downsample the detailed source once, then keep gameplay pixels crisp.
    // Body silhouettes stay 32 logical pixels tall, regardless of screen size.
    this.bodyFrames = BODY_FRAMES.map((rect, i) => this.prepare(rect, 32 / rect[3], BODY_ANCHORS[i]));
    this.clothFrames = CLOTH_FRAMES.map((rect, i) => this.prepare(rect, 17 / rect[2], CLOTH_KNOTS[i]));
    const scale = 18 / (WEAPON_MUZZLE[0] - WEAPON_PIVOT[0]);
    this.weapon = this.prepare(WEAPON_FRAME, scale, WEAPON_PIVOT);
  }
  prepare(rect, scale, anchor) {
    const [x, y, w, h] = rect, image = document.createElement('canvas');
    // Average source detail into complete world pixels instead of sampling
    // scattered high-resolution highlights at the character's tiny size.
    image.width = Math.max(1, Math.round(w * scale)); image.height = Math.max(1, Math.round(h * scale));
    const c = image.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(this.atlas, x, y, w, h, 0, 0, image.width, image.height);
    return { image, width: w * scale, height: h * scale, anchor: anchor.map(n => n * scale) };
  }
  place(c, sprite, x, y) {
    c.drawImage(sprite.image, x - sprite.anchor[0], y - sprite.anchor[1], sprite.width, sprite.height);
  }
  drawGunner(c, game, reducedMotion) {
    const a = game.counterattack, h = game.hangingPosition, sc = this.small.getContext('2d');
    const beat = reducedMotion ? 0 : Math.floor(game.time * 7);
    const body = this.bodyFrames[reducedMotion ? 0 : Math.floor(game.time * 3) % 2];
    sc.clearRect(0, 0, 80, 48); sc.imageSmoothingEnabled = false;
    sc.save(); sc.translate(36, 0); sc.scale(a.facing, 1);
    // Shoulder straps attach to the skid. Head/body do not swing with the cloth.
    stroke(sc, [-3, 0], [-4, 18], '#71867d'); stroke(sc, [3, 0], [4, 18], '#364a44');
    this.place(sc, this.clothFrames[[0, 1, 2, 1][beat % 4]], -2.5, 8);
    this.place(sc, body, 0, 6);
    sc.save(); sc.translate(4, 15);
    if (game.boss.grenadier) {
      sc.rotate(game.boss.throwTick ? .65 : .45);
      this.place(sc, this.grenadeArms[game.boss.throwTick ? 1 : 0], 0, 0);
    } else {
      sc.rotate(Math.atan2(gunnerWeapon(game).vy, Math.abs(gunnerWeapon(game).vx)));
      this.place(sc, this.weapon, 0, 0);
    }
    sc.restore();
    sc.restore();
    c.drawImage(this.small, Math.round(h.x + 14 - 36), Math.round(h.y));
    const weapon = gunnerWeapon(game);
    if (a.flash && !game.boss.ownsCart && !reducedMotion) {
      const ux = weapon.vx / 18, uy = weapon.vy / 18;
      const along = (n, side = 0) => [weapon.x + ux * n - uy * side, weapon.y + uy * n + ux * side];
      stroke(c, along(1), along(6), '#d47636', 4); stroke(c, along(0), along(6), '#ffefac', 2);
      stroke(c, along(3, -2), along(3, 2), '#ffd36a');
    }
    if (!reducedMotion && a.phase === 'active') {
      const age = game.frame % 5;
      box(c, weapon.shoulder.x - a.facing * (6 + age * 2), weapon.shoulder.y + age, 2, 2, '#d4a552');
    }
  }

  drawBattle(c, game, crew, reducedMotion) {
    const a = game.counterattack;
    for (const wreck of a.wrecks) {
      const fall = Math.min(1, wreck.age / 14);
      c.save(); c.translate(wreck.x, game.deck + 44 - 12 * fall);
      c.rotate(wreck.facing * fall * Math.PI / 2); c.globalAlpha = .75;
      c.drawImage(crew.sprite('standing'), -12, -32); c.restore();
    }
    for (const bullet of a.bullets) {
      stroke(c, [bullet.x - bullet.vx * .8, bullet.y - bullet.vy * .8], [bullet.x, bullet.y], '#ffc967', 2);
      box(c, bullet.x, bullet.y, 2, 3, '#fff3be');
    }
    for (const spark of a.sparks) {
      c.save(); c.globalAlpha = 1 - spark.age / 24;
      box(c, spark.x, spark.y, reducedMotion ? 1 : 2, 2, spark.age < 6 ? '#fff0b7' : '#f3954c'); c.restore();
    }
  }

  drawCinema(c, game, reducedMotion) {
    if (game.counterattack.phase !== 'cinematic') return;
    const t = game.counterattack.cinemaTick;
    const shot = t < 45 ? 0 : t < 110 ? 1 : t < 160 ? 2 : 3;
    const local = t - [0, 45, 110, 160][shot];
    const motion = reducedMotion ? 0 : local;
    const spec = CINEMA_SHOTS[shot], [sx, sy, sw, sh] = spec.rect;
    const scale = Math.min(game.width * .94 / 480, game.height * .34 / 108, 4);
    const w = 480 * scale, h = 108 * scale, x = (game.width - w) / 2, y = (game.height - h) / 2 - 10 * scale;
    const shutter = reducedMotion ? 1 : Math.min(1, (t + 1) / 8, (CINEMATIC_TICKS - t) / 8);
    c.save(); c.globalAlpha = .96; box(c, 0, 0, game.width, game.height, '#020504'); c.globalAlpha = 1;
    c.save(); c.beginPath(); c.rect(x, y + h * (1 - shutter) / 2, w, h * shutter); c.clip();
    c.imageSmoothingEnabled = false;
    // Small pushes into richly illustrated panels, with quick hard cuts.
    const push = 1 + Math.min(1, motion / 70) * .025;
    const dw = w * push, dh = h * push;
    const dx = x - (dw - w) * .55, dy = y - (dh - h) * .45;
    c.drawImage(this.cinema, sx, sy, sw, sh, dx, dy, dw, dh);
    if (spec.cloth) {
      // The base panel has no loose tails: a separate alpha layer supplies
      // both ribbons, anchored to the hand/knot across all wind frames.
      const frame = reducedMotion ? 0 : [0, 1, 2, 1][Math.floor(t / 6) % 4];
      const [cx, cy, cw, ch] = CLOTH_FRAMES[frame], [kx, ky] = CLOTH_KNOTS[frame];
      const [px, py, size] = spec.cloth;
      c.drawImage(this.atlas, cx, cy, cw, ch,
        dx + (px - kx * size) / sw * dw, dy + (py - ky * size) / sh * dh,
        cw * size / sw * dw, ch * size / sh * dh);
    }
    if (shot === 3 && local > 8 && !reducedMotion) {
      const [mx, my] = spec.muzzle;
      const fx = dx + mx * dw, fy = dy + my * dh, burst = Math.floor(local / 4) % 3;
      if (burst !== 2) {
        const length = (burst ? 13 : 19) * scale, [ux, uy] = spec.direction;
        const along = (n, side = 0) => [fx + ux * n - uy * side, fy + uy * n + ux * side];
        const flame = (points, color) => {
          c.fillStyle = color; c.beginPath();
          points.forEach(([n, side], i) => {
            const [px, py] = along(n, side * scale); i ? c.lineTo(px, py) : c.moveTo(px, py);
          });
          c.closePath(); c.fill();
        };
        flame([[0, 0], [length * .3, -4], [length * .36, -1], [length, 0], [length * .4, 2], [length * .25, 4]], '#c37637');
        flame([[0, 0], [length * .3, -1.6], [length * .76, 0], [length * .3, 1.4]], '#ffedb3');
        for (let i = 1; i <= 2; i++) {
          const n = (i * 48 + local % 4 * 9) * scale;
          stroke(c, along(n), along(n + 12 * scale), '#fbc373', scale);
        }
      }
    }
    c.restore();
    box(c, x, y + h * (1 - shutter) / 2 - 1, w, 1, '#586d5d');
    box(c, x, y + h * (1 + shutter) / 2, w, 1, '#586d5d');
    // Let the artwork carry the sequence; just one line beneath the picture.
    const lines = ['ENOUGH.', '', '', 'YOUR TURN.'];
    caption(c, lines[shot], game.width / 2, y + h + 18 * scale, 8 * scale, '#d9d2b7', 'center');
    c.restore();
  }
}

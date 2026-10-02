// Draw on the original one-source-pixel grid, then enlarge with nearest-neighbor
// sampling. The driver's four-by-three hat/profile comes from the wagon itself.
const SCALE = 2, CENTER = 14, GROUND = 24;
const INK = '#000', PAPER = '#fff';
// Five logical pixels per frame: each planted foot travels back ten native
// pixels over half a cycle, matching the twenty logical pixels the cart moves.
const gait = [
  { far: [[0, -8], [-3, -5], [-5, -1]], near: [[-1, -8], [2, -5], [5, -1]] },
  { far: [[0, -8], [-1, -5], [-3, -3]], near: [[-1, -8], [1, -5], [3, -1]] },
  { far: [[0, -8], [2, -6], [0, -4]], near: [[-1, -8], [0, -5], [0, -1]] },
  { far: [[0, -8], [4, -5], [3, -3]], near: [[-1, -8], [-1, -5], [-2, -1]] },
  { far: [[0, -8], [2, -5], [5, -1]], near: [[-1, -8], [-3, -5], [-5, -1]] },
  { far: [[0, -8], [1, -5], [3, -1]], near: [[-1, -8], [-1, -5], [-3, -3]] },
  { far: [[0, -8], [0, -5], [0, -1]], near: [[-1, -8], [2, -6], [0, -4]] },
  { far: [[0, -8], [-1, -5], [-2, -1]], near: [[-1, -8], [4, -5], [3, -3]] },
];
const jacket = [
  '....##..',
  '..####..',
  '.##o##..',
  '.##o#...',
  '.####...',
  '.####...',
  '.####...',
];

function pixel(c, x, y, color, width = 1, height = 1) {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), width, height);
}
function stroke(c, points, color, width = 1) {
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1].map(Math.round);
    const [endX, endY] = points[i].map(Math.round);
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      pixel(c, x, y, color, width, width);
      if (x === endX && y === endY) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }
}

export class DriverRenderer {
  constructor(sheet) {
    const head = document.createElement('canvas'); head.width = 4; head.height = 3;
    const c = head.getContext('2d');
    c.drawImage(sheet, 38, 26, 4, 3, 0, 0, 4, 3);
    this.head = c.getImageData(0, 0, 4, 3).data;
    this.frames = new Map();
  }

  sprite(frame, pose, themed) {
    const key = `${frame}:${pose}:${themed}`;
    if (this.frames.has(key)) return this.frames.get(key);
    const sprite = document.createElement('canvas'); sprite.width = 30; sprite.height = 27;
    const c = sprite.getContext('2d');
    const step = gait[frame], bob = pose === 'step' ? 1 : 0;
    const point = ([x, y]) => [CENTER + x, GROUND + y];
    const leg = points => {
      const p = points.map(point), [x, y] = p.at(-1);
      const ankles = p.map(point => [...point]); ankles.at(-1)[1]--;
      stroke(c, ankles, INK, 2);
      pixel(c, x, y, INK, 3, 1);
    };
    if (pose === 'step') {
      leg([[0, -8], [3, -5], [1, -2]]);
      leg([[-1, -8], [-2, -4], [-3, -1]]);
    } else if (pose === 'hop') {
      leg([[0, -8], [3, -5], [0, -3]]);
      leg([[-1, -8], [-3, -5], [-5, -3]]);
    } else {
      leg(step.far);
      leg(step.near);
    }

    // Compact coat, white shirt opening, and the original forward-facing hat.
    jacket.forEach((row, y) => [...row].forEach((p, x) => {
      if (p !== '.') pixel(c, CENTER - 3 + x, 10 + y + bob, p === '#' ? INK : PAPER);
    }));
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) {
      if (this.head[(y * 4 + x) * 4] < 128) pixel(c, CENTER + x, 7 + y + bob, INK);
    }
    if (pose === 'step' || pose === 'hop') {
      stroke(c, [[CENTER - 1, 12 + bob], [CENTER - 3, 14], [CENTER - 5, 13]], INK);
      stroke(c, [[CENTER + 1, 12 + bob], [CENTER + 3, 15], [CENTER + 2, 17]], INK);
    } else {
      // Sleeves slope back to the handle. Only the cuff is white: a broad
      // white arm outline used to erase the waist and disconnect both legs.
      stroke(c, [[CENTER, 12], [CENTER - 2, 14], [CENTER - 5, 15]], INK);
      stroke(c, [[CENTER + 1, 12], [CENTER - 1, 15], [CENTER - 4, 15]], INK, 2);
      pixel(c, CENTER - 3, 15, PAPER);
      pixel(c, CENTER - 5, 15, INK, 2, 2);
    }

    if (themed) {
      const input = c.getImageData(0, 0, sprite.width, sprite.height), output = c.createImageData(sprite.width, sprite.height);
      const ink = i => i >= 0 && i < sprite.width * sprite.height && input.data[i * 4 + 3] && input.data[i * 4] < 128;
      for (let i = 0; i < sprite.width * sprite.height; i++) {
        const x = i % sprite.width, y = Math.floor(i / sprite.width);
        const outline = ink(i - sprite.width) || ink(i + sprite.width) || (x > 0 && ink(i - 1)) || (x < sprite.width - 1 && ink(i + 1));
        if (!input.data[i * 4 + 3] && !outline) continue;
        const color = ink(i) ? (y < 13 ? [204, 251, 213] : [139, 255, 165]) : [6, 8, 12];
        output.data.set([...color, 255], i * 4);
      }
      c.putImageData(output, 0, 0);
    }
    this.frames.set(key, sprite);
    return sprite;
  }

  draw(target, game, themed) {
    const cart = game.carriage, { x, feet } = cart.driverPosition(game);
    const pulling = cart.phase === 'pulling', progress = cart.driverProgress;
    const pose = pulling ? 'pull' : progress < .23 ? 'step' : progress < .77 ? 'hop' : 'reach';
    const frame = pulling ? Math.floor(cart.pullDistance / 5) % gait.length : 0;
    const left = Math.round(x) - CENTER * SCALE, top = Math.round(feet) - GROUND * SCALE;
    if (pulling || progress > .9) {
      // A rigid shaft stays joined to the hand during every gait frame.
      const shaft = [[game.cartX + 84, game.deck + 27], [x - 10, feet - 16]];
      const native = shaft.map(([px, py]) => [Math.round(px / SCALE), Math.round(py / SCALE)]);
      target.save(); target.scale(SCALE, SCALE);
      if (themed) stroke(target, native.map(([px, py]) => [px - 1, py - 1]), '#06080c', 3);
      stroke(target, native, themed ? '#ccfbd5' : INK);
      target.restore();
    }
    const sprite = this.sprite(frame, pose, themed);
    target.drawImage(sprite, left, top, sprite.width * SCALE, sprite.height * SCALE);
  }

  drawFallen(target, game, themed, reducedMotion) {
    const driver = game.carriage.deadDriver;
    if (!driver) return;
    const progress = reducedMotion ? 1 : Math.min(1, driver.age / 24);
    const sprite = this.sprite(0, 'pull', themed);
    const hip = (driver.feet - 16) * (1 - progress) + (game.deck + 32) * progress;
    target.save();
    target.translate(Math.round(driver.x + progress * 12), Math.round(hip));
    target.rotate(-Math.PI / 2 * progress);
    target.drawImage(sprite, -CENTER * SCALE, -(GROUND - 8) * SCALE, sprite.width * SCALE, sprite.height * SCALE);
    target.restore();
  }
}

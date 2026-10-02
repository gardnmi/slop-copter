import { runnerView } from './runner.js';
import { RUNNER_FRAMES, RUNNER_SCALE } from './runner-assets.js';
import { RescueArt } from './rescue-art.js';

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const hash = n => ((Math.imul(n + 43, 2654435761) >>> 0) % 65536) / 65536;
const box = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
function line(c, color, points, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.stroke();
}
function poly(c, color, points) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.closePath(); c.fill();
}
function text(c, value, x, y, size = 10, color = '#f0f0f3', align = 'left') {
  c.font = `bold ${size}px "Courier New", monospace`; c.textAlign = align;
  c.fillStyle = '#30313c'; c.fillText(value, x + 1, y + 1); c.fillStyle = color; c.fillText(value, x, y); c.textAlign = 'left';
}

export class RunnerArt {
  constructor() { this.surface = document.createElement('canvas'); this.frames = []; this.rescueArt = new RescueArt(); }
  async load() {
    await this.rescueArt.load();
    const atlas = new Image(); atlas.src = `${import.meta.env.BASE_URL}assets/rooftop-runner-atlas.png`; await atlas.decode();
    this.frames = RUNNER_FRAMES.map(({ rect: [x, y, w, h], anchor }) => {
      const image = document.createElement('canvas'); image.width = Math.round(w * RUNNER_SCALE); image.height = Math.round(h * RUNNER_SCALE);
      const c = image.getContext('2d'); c.imageSmoothingQuality = 'high';
      c.drawImage(atlas, x, y, w, h, 0, 0, image.width, image.height);
      // Resolve the large illustrated cels onto a small, opaque pixel grid.
      // Crisp dark boots/gun and a pale face remain readable against the city.
      const pixels = c.getImageData(0, 0, image.width, image.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const d = pixels.data;
        if (d[i + 3] < 90) { d[i + 3] = 0; continue; }
        const red = d[i] > d[i + 1] * 1.5 && d[i] > 65;
        const light = d[i] * .21 + d[i + 1] * .72 + d[i + 2] * .07;
        const color = red ? [181, 57, 70] : light < 55 ? [24, 26, 35] : light < 95 ? [52, 54, 67]
          : light < 140 ? [96, 99, 114] : light < 188 ? [178, 179, 192] : [242, 241, 237];
        d.set([...color, 255], i);
      }
      c.putImageData(pixels, 0, 0);
      return { image, anchor: anchor.map(v => Math.round(v * RUNNER_SCALE)) };
    });
  }
  man(c, frame, x, y, rotation = 0) {
    const sprite = this.frames[frame];
    c.save(); c.translate(Math.round(x), Math.round(y));
    if (rotation) { c.translate(0, -9); c.rotate(rotation); c.translate(0, 9); }
    c.drawImage(sprite.image, -sprite.anchor[0], -sprite.anchor[1]); c.restore();
  }
  draw(target, g, renderer, reduced) {
    const r = g.runner, view = runnerView(g), w = Math.ceil(view.width), h = Math.ceil(view.height);
    if (this.surface.width !== w || this.surface.height !== h) { this.surface.width = w; this.surface.height = h; }
    const c = this.surface.getContext('2d'); c.imageSmoothingEnabled = false;
    c.save(); c.clearRect(0, 0, w, h); box(c, '#adaeba', 0, 0, w, h);
    const shake = reduced ? 0 : Math.min(3, r.shake * 10);
    c.translate(Math.round(Math.sin(r.time * 97) * shake), Math.round(Math.cos(r.time * 83) * shake));
    this.city(c, r, w, h, reduced);
    for (const roof of r.roofs) this.building(c, r, roof, w, h, reduced);
    // The near city layer is already present before the character leaves the rig.
    c.save(); c.globalAlpha = r.phase === 'pursuit' ? clamp((r.chaseProgress - .65) / .35) : 1;
    this.foreground(c, r, w, h); c.restore();
    for (const bird of r.birds) this.bird(c, bird.x - r.cameraX, bird.y - r.cameraY, reduced ? 1 : (bird.age * 15 + bird.phase) % 3, bird.facing, bird.shade);
    for (const piece of r.wreckage) this.wreck(c, piece, r, renderer);
    const airborne = ['pursuit', 'strike', 'caught'].includes(r.phase);
    if (!airborne) this.blast(c, r, w, h, reduced);
    // The gray city is revealed by forward travel, underneath one continuously
    // visible helicopter. No timed cut or duplicate faded helicopter.
    if (airborne) {
      c.restore();
      target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.imageSmoothingEnabled = false;
      target.globalAlpha = r.phase === 'strike' ? 1 : clamp(r.chaseProgress);
      target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
      c.clearRect(0, 0, w, h); c.save();
      this.blast(c, r, w, h, reduced);
      this.copter(c, g, renderer, reduced);
    } else if (!['lifting', 'escaped'].includes(r.phase) && (!r.dead || r.age < 40)) {
      const frame = r.phase === 'roll' ? r.age < 7 || r.age > 28 ? 11 : 10 : r.phase === 'fall' ? r.vy < 0 ? 8 : 9
        : r.dead ? 9 : r.stumble || r.landSquash ? 11 : !r.grounded ? r.vy < 0 ? 8 : 9 : reduced ? 0 : Math.floor(r.x / 12) % 8;
      const spin = r.phase === 'roll' && r.age >= 7 && r.age <= 28 && !reduced ? (r.age - 7) / 21 * Math.PI * 2 : 0;
      if (r.phase === 'rescue' && r.rescue.stage === 'boarding' && !r.grounded) {
        this.rescueArt.man(c, 0, r.x - r.cameraX + 6, r.y - r.cameraY - 22);
      } else {
        c.save(); c.translate(r.x - r.cameraX, r.y - r.cameraY);
        const size = r.phase === 'fall' ? r.departureScale + (1 - r.departureScale) * clamp(r.age / 16) : 1;
        c.scale(size, size); this.man(c, frame, 0, 0, spin); c.restore();
      }
    }
    if (!g.assault.active) this.rescueArt.draw(c, r, reduced);
    this.effects(c, r, reduced);
    c.restore();
    if (!g.assault.active) this.hud(c, r, w, h, reduced);
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.imageSmoothingEnabled = false;
    target.globalAlpha = 1;
    target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
  }
  city(c, r, w, h, reduced) {
    // Distinct low-contrast skyline layers leave dark roof edges easy to read.
    for (let layer = 0; layer < 3; layer++) {
      const rate = [.10, .25, .46][layer], block = [64, 92, 132][layer];
      const origin = Math.floor(r.cameraX * rate / block);
      const base = h * .72 + layer * 20;
      for (let n = origin - 2; n < origin + w / block + 3; n++) {
        const id = n + layer * 301, seed = hash(id), x = n * block - r.cameraX * rate;
        const height = 42 + seed * (layer === 2 ? 160 : 130), y = base - height;
        const color = ['#9394a2', '#777887', '#565864'][layer];
        box(c, color, x, y, block - 4 - seed * 15, h - y);
        box(c, color, x + 8, y - 9, block * .48, 12);
        if (seed > .55) {
          box(c, color, x + block * .3, y - 35, 2, 27);
          line(c, color, [[x + 7, y - 22], [x + block * .6, y - 22]]);
        }
        if (layer > 0) {
          for (let yy = y + 10; yy < Math.min(h, base); yy += 16) for (let xx = x + 7; xx < x + block - 17; xx += 13) {
            if (hash(id * 113 + Math.round((xx - x) / 13) + Math.round((yy - y) / 16) * 77) > .3) box(c, layer === 1 ? '#878895' : '#666975', xx, yy, 5, 8);
          }
        }
        if (layer === 0 && seed > .52) {
          for (let i = 0; i < 7; i++) {
            const drift = reduced ? 0 : r.time * 3 % 10;
            box(c, '#9a9ba8', x + 20 - i * 4 - drift, y - 10 - i * 9, 12 + i * 3, 14);
          }
        }
      }
    }
    const jet = (r.time * 180 + 300) % (w + 900) - 300;
    if (!reduced && jet < w + 40) {
      line(c, '#9294a1', [[jet - 85, 92], [jet, 92]]);
      poly(c, '#575966', [[jet - 12, 91], [jet - 3, 88], [jet + 12, 91], [jet - 2, 94]]);
    }
  }
  blast(c, r, w, h, reduced) {
    if (r.blastX === null) return;
    const edge = r.blastX - r.cameraX;
    if (edge < -80) return;
    const time = reduced ? 0 : Math.floor(r.time * 12);
    c.save();
    const glow = c.createLinearGradient(edge - 85, 0, edge + 35, 0);
    glow.addColorStop(0, 'rgba(41,30,30,.9)'); glow.addColorStop(.62, 'rgba(189,77,35,.9)');
    glow.addColorStop(.77, 'rgba(255,176,66,.8)'); glow.addColorStop(1, 'rgba(255,211,113,0)');
    c.fillStyle = glow; c.fillRect(0, 0, Math.max(0, Math.min(w, edge + 35)), h);
    for (let y = -10; y < h; y += 12) {
      const curl = hash(y * 3 + time) * 16;
      const front = edge + Math.sin(y * .04 - time * .25) * 10 - (y - h * .62) ** 2 / (h * 2.4);
      box(c, '#e18435', front - 18 - curl, y, 18 + curl, 13);
      box(c, '#ffc463', front - 8 - curl / 2, y + 1, 9, 10);
      box(c, '#fff0bc', front - 3 - curl / 2, y + 3, 4, 6);
      if (!reduced) box(c, '#d5b28a', front + 12 + hash(y + time) * 25, y + 4, 2, 2);
    }
    // Dark blocks of debris and smoke follow the luminous pressure front.
    for (let i = 0; i < 30; i++) {
      const x = edge - 25 - hash(i * 53) * 100, y = (i * 43 + time * 3) % (h + 30) - 15;
      box(c, i % 3 ? '#50413d' : '#302e34', x, y, 14 + i % 5 * 5, 14 + i % 3 * 9);
    }
    c.restore();
  }
  building(c, r, roof, w, h, reduced) {
    const x = Math.round(roof.x - r.cameraX), y = Math.round(roof.y - r.cameraY), width = roof.width;
    if (x > w + 25 || x + width < -25) return;
    if (roof.kind === 'crane') {
      box(c, '#363945', x, y, width, 15); box(c, '#d7d7de', x, y, width, 2);
      for (let dx = 0; dx < width; dx += 24) line(c, '#9294a0', [[x + dx, y + 13], [x + dx + 12, y + 3], [x + dx + 24, y + 13]]);
      box(c, '#3f414e', x + width * .6, y + 15, 13, h - y);
      for (let dy = 18; dy < h - y; dy += 28) line(c, '#7d808d', [[x + width * .6, y + dy], [x + width * .6 + 12, y + dy + 25]]);
      line(c, '#424550', [[x + 12, y], [x + width * .6, y - 85], [x + width - 12, y]], 2);
    } else {
      box(c, '#626371', x, y + 8, width, h - y + 100);
      box(c, '#333541', x, y + 5, width, 5); box(c, '#d6d7df', x, y, width, 3);
      box(c, '#9294a0', x, y + 3, width, 2);
      for (let yy = y + 16; yy < h + 10; yy += 30) {
        box(c, '#535663', x, yy + 23, width, 2);
        box(c, '#898b98', x, yy + 25, width, 1);
        const start = Math.max(0, Math.floor(-x / 18));
        for (let i = start; i < width / 18 && x + i * 18 < w; i++) {
          const wx = x + 8 + i * 18;
          box(c, '#323440', wx, yy, 10, 16); box(c, '#454855', wx + 1, yy + 1, 8, 5);
          box(c, '#a4a6b1', wx, yy + 16, 11, 1);
          if (hash(roof.seed + i + yy) > .84) box(c, '#b5b6bf', wx + 2, yy + 4, 5, 6);
        }
      }
      for (let dx = 3; dx < width; dx += 11) box(c, hash(roof.seed + dx) > .5 ? '#f0f0f2' : '#858794', x + dx, y, 5, 2);
      // Fire escape lives on the wall, clearly below the playable edge.
      line(c, '#353845', [[x + width + 2, y + 6], [x + width + 2, h]], 2);
      for (let yy = y + 16; yy < h; yy += 13) line(c, '#414451', [[x + width, yy], [x + width + 10, yy]]);
    }
    if (roof.kind === 'glass') {
      box(c, '#515463', x + 30, y - 66, width - 60, 6); box(c, '#b5b7c2', x + 31, y - 67, width - 62, 2);
      for (let dx = 95; dx < width - 50; dx += 72) { box(c, '#494c5b', x + dx, y - 60, 5, 60); line(c, '#d0d1da', [[x + dx + 5, y - 58], [x + dx + 18, y - 43]]); }
    } else if (roof.kind !== 'crane') {
      const tx = x + width * .7;
      // Non-solid antenna and water tower are behind the running surface.
      line(c, '#484b58', [[tx, y - 1], [tx, y - 55]], 2);
      line(c, '#666977', [[tx - 15, y - 43], [tx + 15, y - 43]]);
      line(c, '#666977', [[tx - 9, y - 49], [tx + 9, y - 49]]);
      if (roof.seed % 3 === 0) {
        box(c, '#4a4d59', x + width - 80, y - 45, 32, 26); box(c, '#858793', x + width - 78, y - 42, 3, 20);
        poly(c, '#666977', [[x + width - 83, y - 45], [x + width - 64, y - 52], [x + width - 45, y - 45]]);
        for (const dx of [0, 22]) line(c, '#474a57', [[x + width - 75 + dx, y - 19], [x + width - 79 + dx, y]], 2);
      }
    }
    if (roof.kind === 'collapse') {
      for (let i = 0; i < 4; i++) {
        const crack = x + 20 + i * width / 4;
        line(c, '#333541', [[crack, y + 4], [crack + 8, y + 17], [crack + 2, y + 25], [crack + 11, y + 40]], 2);
      }
      if (roof.collapse && !reduced) for (let i = 0; i < 8; i++) box(c, '#babcc5', x + hash(roof.seed + i) * width, y + ((r.time * 95 + i * 27) % 150), 3, 3);
    }
    for (const item of roof.items) {
      if (item.hit) continue;
      const ix = item.x - r.cameraX;
      if (item.kind === 'glass') {
        box(c, '#c7cbd6', ix, y - 59, 2, 58); box(c, '#9499a9', ix + 2, y - 59, 4, 58);
        line(c, '#e9e9ee', [[ix + 1, y - 52], [ix + 5, y - 44]]);
      } else {
        box(c, '#353743', ix - 1, y - 16, 16, 16); box(c, '#afb1bc', ix, y - 16, 14, 2);
        box(c, item.kind === 'vent' ? '#777b89' : '#9b9ea9', ix + 1, y - 14, 12, 13);
        if (item.kind === 'vent') for (let n = 0; n < 3; n++) box(c, '#444854', ix + 3, y - 11 + n * 3, 8, 1);
        else line(c, '#5e6270', [[ix + 2, y - 13], [ix + 11, y - 3], [ix + 2, y - 3], [ix + 11, y - 13]]);
      }
    }
    for (const bird of (roof.flock ?? []).slice(0, roof.birds)) if (!bird.launched) this.bird(c, x + bird.offset, y - 3, -1, bird.facing, bird.shade);
  }
  bird(c, x, y, beat, facing = 1, shade = 0) {
    const color = ['#eeeef2', '#cbccd7', '#a5a8b8'][shade], wing = ['#d7d9e1', '#b9bccb', '#9095a7'][shade];
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(facing, 1);
    box(c, color, -3, -1, 5, 3); box(c, color, 1, -3, 3, 3); box(c, '#737988', 4, -2, 2, 1);
    box(c, '#555b6b', 2, -2, 1, 1); box(c, wing, -5, 0, 3, 1);
    if (beat < 0) { box(c, wing, -2, 0, 3, 1); box(c, '#747886', -1, 2, 1, 2); }
    else if (Math.floor(beat) === 0) poly(c, color, [[-2, 0], [-5, -5], [-3, -6], [1, -1]]);
    else if (Math.floor(beat) === 1) { box(c, color, -6, -1, 8, 2); box(c, wing, -7, 0, 3, 1); }
    else poly(c, wing, [[-2, 0], [-4, 5], [-2, 5], [2, 0]]);
    c.restore();
  }
  copter(c, g, renderer, reduced) {
    const r = g.runner, frame = reduced ? 0 : g.frame % 3;
    c.save(); c.translate(Math.round(r.airX), Math.round(r.airY)); c.rotate(clamp(r.airVX / 800, -.15, .15));
    const scale = r.copterScale;
    c.filter = `grayscale(${r.chaseProgress})`;
    let copter = renderer.sprite('copter-wagon', [frame * 74, 0, 74, 26], true);
    if (r.phase === 'strike') {
      this.brokenCopters ??= [];
      if (!this.brokenCopters[frame]) {
        const broken = document.createElement('canvas'); broken.width = 76; broken.height = 28;
        const bc = broken.getContext('2d'); bc.drawImage(copter, 0, 0); bc.clearRect(0, 10, 31, 18);
        this.brokenCopters[frame] = broken;
      }
      copter = this.brokenCopters[frame];
    }
    c.drawImage(copter, -37 * scale, -scale, 76 * scale, 28 * scale);
    c.save(); c.scale(scale / 2, scale / 2); c.translate(-g.copterX, -g.copterY);
    renderer.actionArt.drawGunner(c, g, reduced); c.restore();
    c.filter = 'none'; c.restore();
  }
  foreground(c, r, w, h) {
    // Faster near silhouettes and a grounded dust trail supply motion depth.
    // Keep these below the roof edge, leaving all gaps and hazards unobscured.
    const stride = 380, offset = r.cameraX * 1.65;
    for (let i = Math.floor(offset / stride); i < (offset + w) / stride + 1; i++) {
      const x = i * stride - offset, y = h - 30 - hash(i) * 25;
      box(c, '#292c36', x, y, 7, h - y);
      line(c, '#343744', [[x - 45, h], [x + 3, y + 8], [x + 44, h]], 3);
      box(c, '#464a58', x - 35, y + 8, 74, 3);
    }
  }
  wreck(c, piece, r, renderer) {
    c.save(); c.translate(Math.round(piece.x - r.cameraX), Math.round(piece.y - r.cameraY)); c.rotate(piece.angle); c.scale(r.copterScale, r.copterScale); c.filter = 'grayscale(1)';
    if (piece.type === 'body') c.drawImage(renderer.sprite('copter-wagon', [30, 6, 44, 20], true), -22, -10);
    else if (piece.type === 'rotor') { box(c, '#2a2c38', -35, -1, 70, 2); box(c, '#eeeef1', -31, -2, 56, 1); }
    else c.drawImage(renderer.sprite('copter-wagon', [0, 9, 31, 12], true), -16, -6);
    c.restore();
  }
  effects(c, r, reduced) {
    for (const p of r.particles) {
      const fade = 1 - p.age / p.life;
      c.globalAlpha = fade;
      const color = p.kind === 'blast' ? p.age < .14 ? '#faf5e9' : p.age < .45 ? '#b89288' : '#4b4d5b'
        : p.kind === 'glass' ? '#eff3f6' : p.kind === 'crate' ? '#505460' : p.kind === 'wash' ? '#b1b5ba' : '#ccced5';
      const size = p.kind === 'blast' ? p.size + p.age * 14 : p.size;
      box(c, color, p.x - r.cameraX - size / 2, p.y - r.cameraY - size / 2, reduced ? Math.min(size, 5) : size, reduced ? Math.min(size, 5) : size);
    }
    c.globalAlpha = 1;
  }
  hud(c, r, w, h, reduced) {
    // The countdown and arrow live in the Matrix sky behind the aircraft.
    if (r.phase === 'pursuit') return;
    if (r.phase === 'strike') text(c, 'TAIL HIT — JUMP!', 12, 23, 11, '#f2d7d9');
    else if (r.phase === 'roll') text(c, 'GET UP.', w / 2, h * .35, 20, '#eeeef1', 'center');
    else if (r.phase === 'lifting') {
      text(c, 'HOLD ON.', w - 14, 24, 12, '#ffe2ac', 'right');
    } else if (r.phase === 'escaped') {
      const fade = reduced ? 1 : clamp(r.age / 50);
      c.globalAlpha = fade;
      text(c, 'EXTRACTED', w / 2, h * .72, 24, '#f3efe3', 'center');
      text(c, `${r.distance}m · OUT OF THE FIRE`, w / 2, h * .72 + 20, 9, '#e0d6c6', 'center');
      text(c, 'R · NEW GAME', w - 12, h - 14, 8, '#dedee5', 'right'); c.globalAlpha = 1;
    } else if (r.running || r.dead) {
      text(c, `${r.distance}m`, w - 12, 23, 19, '#f9f9fb', 'right');
      text(c, `BEST ${r.best}m`, w - 13, 36, 7, '#dedee5', 'right');
      if (r.phase === 'rescue') {
        const boarding = r.rescue.stage === 'boarding';
        text(c, boarding ? 'JUMP · GRAB THE RAIL' : r.rescue.stage === 'gone' ? 'THE BLAST IS CLOSING IN' : 'EXTRACTION INBOUND', 12, 22, 10, '#ffe2ac');
        if (boarding) text(c, `SPACE / ↑ / TOUCH  ·  ${Math.ceil(r.rescue.window / 50)}s`, 12, 36, 8, '#ece6d7');
        else if (r.rescue.stage === 'approach') text(c, 'KEEP RUNNING', 12, 36, 8, '#e1e2e8');
      } else if (r.running && r.age < 200) {
        c.globalAlpha = Math.min(1, (200 - r.age) / 40);
        text(c, 'SPACE / ↑ / TOUCH', 12, 22, 9); text(c, 'HOLD TO JUMP FARTHER', 12, 36, 8, '#dddde4'); c.globalAlpha = 1;
      }
      if (r.dead) {
        c.fillStyle = 'rgba(30,31,42,.35)'; c.fillRect(0, 0, w, h);
        text(c, 'ESCAPE INTERRUPTED', w / 2, h * .37, 12, '#efeff4', 'center');
        text(c, `${r.distance} METERS`, w / 2, h * .37 + 35, 25, '#fafafa', 'center');
        text(c, r.reason, w / 2, h * .37 + 56, 9, '#dfdfe8', 'center');
        if (r.age >= 25) text(c, 'RESTARTING CHECKPOINT…', w / 2, h * .37 + 83, 10, '#f4f4f7', 'center');
      }
    }
  }
}

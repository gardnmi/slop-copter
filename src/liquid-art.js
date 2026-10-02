import { LIQUID_TIMINGS, GRENADE_HITS, GRENADE_RELOAD, ROCKET_WARNING, ROCKET_FUEL } from './liquid-boss.js';
import { HUNTER_SCALE, HUNTER_FRAMES, PUDDLE_FRAME, GRENADE_ARMS, hunterFrame } from './liquid-assets.js';

const clamp = n => Math.max(0, Math.min(1, n));
const box = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function line(c, color, points, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
  c.stroke();
}
function label(c, value, x, y, size = 12, color = '#d6e7e4') {
  c.font = `bold ${size}px "Courier New", monospace`; c.fillStyle = color; c.textAlign = 'center';
  c.fillText(value, x, y); c.textAlign = 'left';
}

export class LiquidArt {
  constructor() { this.coat = document.createElement('canvas'); this.coat.width = 150; this.coat.height = 48; }
  async load() {
    this.atlas = new Image(); this.atlas.src = `${import.meta.env.BASE_URL}assets/liquid-hunter-atlas.png`;
    this.carriageAtlas = new Image(); this.carriageAtlas.src = `${import.meta.env.BASE_URL}assets/chrome-carriage-atlas.png`;
    await Promise.all([this.atlas.decode(), this.carriageAtlas.decode()]);
    this.frames = HUNTER_FRAMES.map(frame => this.crop(frame.rect, HUNTER_SCALE, frame.anchor, this.carriageAtlas));
    this.puddle = this.crop(PUDDLE_FRAME, .3);
    this.arms = GRENADE_ARMS.map(frame => this.crop(frame.rect, .041, frame.anchor));
  }
  crop(rect, scale, anchor = [0, 0], atlas = this.atlas) {
    const [x, y, w, h] = rect, source = document.createElement('canvas'); source.width = w; source.height = h;
    const sc = source.getContext('2d'); sc.drawImage(atlas, x, y, w, h, 0, 0, w, h);
    const image = document.createElement('canvas'); image.width = Math.round(w * scale); image.height = Math.round(h * scale);
    const c = image.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(source, 0, 0, image.width, image.height);
    return { image, width: image.width, height: image.height, anchor: anchor.map(v => v * scale) };
  }
  pool(c, x, ground, width, height = 12, time = 0) {
    c.save(); c.translate(Math.round(x), Math.round(ground));
    c.scale(1 + Math.sin(time * .12) * .035, 1);
    c.drawImage(this.puddle.image, -width / 2, -height, width, height); c.restore();
  }
  hostMask(renderer, g) {
    const b = g.boss, c = this.coat.getContext('2d');
    c.clearRect(0, 0, 150, 48); c.globalCompositeOperation = 'source-over';
    const sprite = renderer.sprite('copter-wagon', [0, 26, 73, 22], true);
    c.drawImage(sprite, 0, 0, 150, 48);
    c.clearRect(70, 0, 20, 24); // The surviving driver has already fled.
    if (!b.hostHorse) c.clearRect(90, 0, 60, 48);
    if (b.hostMotor) { c.fillStyle = '#fff'; c.fillRect(68, 12, 22, 18); }
    c.globalCompositeOperation = 'source-in';
    const shine = c.createLinearGradient(0, 0, 0, 48);
    [[0, '#fcffff'], [.16, '#8fa4ae'], [.31, '#26373e'], [.4, '#f4fffa'], [.52, '#c7e3df'], [.65, '#526774'], [.82, '#e7f9f5'], [1, '#162b34']]
      .forEach(([stop, color]) => shine.addColorStop(stop, color));
    c.fillStyle = shine; c.fillRect(0, 0, 150, 48);
    c.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 9; i++) {
      const x = (i * 23 + b.time * .45) % 170 - 10;
      line(c, '#e6fff5', [[x, 48], [x + 4, 28], [x - 5, 13], [x + 2, 0]], i % 2 ? 1 : 2);
    }
    c.globalCompositeOperation = 'source-over'; return this.coat;
  }
  coatHost(c, g, renderer, progress, alpha = 1) {
    const b = g.boss, width = b.hostHorse ? 150 : 92, x = b.hostX - 2, y = g.deck - 2;
    const image = this.hostMask(renderer, g), top = y + 50 * (1 - progress);
    c.save(); c.globalAlpha *= alpha; c.beginPath(); c.moveTo(x, y + 50);
    for (let dx = 0; dx <= width; dx += 2) c.lineTo(x + dx, top + Math.sin(dx * .12 + b.time * .16) * 3 * Math.sin(progress * Math.PI));
    c.lineTo(x + width, y + 50); c.closePath(); c.clip();
    c.drawImage(image, Math.round(x), y); c.restore();
  }
  draw(c, g, renderer, reduced) {
    const b = g.boss, ground = g.deck + 44, time = reduced ? 0 : b.time;
    if (!b.ownsCart || b.phase === 'victory') return;
    if (b.escapeDriver) {
      const d = b.escapeDriver;
      c.drawImage(renderer.driver.sprite(Math.floor(d.age / 3) % 8, 'reach', true), Math.round(d.x) - 28, ground - 48, 60, 54);
    }
    if (b.phase === 'melt' || b.phase === 'flow') {
      const p = b.phase === 'melt' ? clamp(b.age / LIQUID_TIMINGS.melt) : 1;
      for (const part of b.parts) {
        if (p < .96) {
          c.save(); c.globalAlpha = 1 - p * .8;
          c.translate(part.x, ground - 9 * (1 - p)); c.scale(1 + p * .5, Math.max(.03, 1 - p));
          c.rotate(part.facing * Math.PI / 2); c.drawImage(renderer.crew.sprite('standing'), -12, -25); c.restore();
        }
        this.pool(c, part.x, ground, 26 + p * 30, Math.max(1, p * 9), time + part.delay);
        if (b.phase === 'flow') {
          const direction = Math.sign(b.x - part.fromX);
          for (let i = 1; i < 4; i++) this.pool(c, part.x - direction * i * 13, ground, 8 - i, 2, time + i);
        }
      }
      if (b.phase === 'flow') this.pool(c, b.x, ground, 35 + b.age / LIQUID_TIMINGS.flow * 110, 13, time);
      return;
    }
    if (b.phase === 'engulf') {
      const p = clamp(b.age / LIQUID_TIMINGS.engulf);
      this.pool(c, b.x, ground, 150 + Math.sin(p * Math.PI) * 35, 15, time);
      this.coatHost(c, g, renderer, p);
      return;
    }
    const forming = b.phase === 'reveal', dying = b.phase === 'dying' || b.phase === 'won';
    const p = forming ? clamp(b.age / LIQUID_TIMINGS.reveal) : dying ? (b.phase === 'won' ? 1 : clamp(b.age / LIQUID_TIMINGS.dying)) : 0;
    if (forming) { this.pool(c, b.x, ground, 160, 14, time); this.coatHost(c, g, renderer, 1, 1 - p); }
    if (dying) this.pool(c, b.x, ground, 70 + p * 110, 8 + p * 5, time);
    if (b.phase !== 'won') {
      const frame = this.frames[reduced || forming || dying ? 0 : hunterFrame(b)];
      c.save(); c.translate(Math.round(b.x), ground);
      if (forming) { c.globalAlpha = p; c.scale(.82 + p * .18, .85 + p * .15); }
      if (dying) { c.globalAlpha = 1 - p; c.scale(1 + p * .35, 1 - p * .92); }
      c.drawImage(frame.image, -frame.anchor[0], -frame.anchor[1]);
      c.restore();
    }
    if (b.fighting && b.rocketCooldown <= ROCKET_WARNING && b.x > 75 && b.x < g.width - 75) {
      const muzzle = b.launcher(g);
      const pulse = reduced ? 1 : .6 + .4 * Math.sin(b.age * .3);
      c.save(); c.globalAlpha = pulse;
      label(c, 'LOCK', muzzle.x, muzzle.y - 15, 9, '#ff9d8c');
      line(c, '#f88577', [[muzzle.x - 9, muzzle.y - 6], [muzzle.x - 9, muzzle.y - 11], [muzzle.x + 9, muzzle.y - 11], [muzzle.x + 9, muzzle.y - 6]]); c.restore();
    }
    if (b.hitFlash) label(c, `${b.hits} / 5`, b.x, ground - 90, 16, '#f5fff8');
    for (const r of b.rockets) this.rocket(c, r, reduced);
    for (const grenade of b.grenades) {
      c.save(); c.translate(Math.round(grenade.x), Math.round(grenade.y)); c.rotate(reduced ? 0 : grenade.age * .14);
      box(c, '#19241f', -4, -4, 8, 9); box(c, '#a9b885', -2, -4, 4, 8);
      line(c, '#4a6148', [[-3, -1], [3, -1]], 1); line(c, '#4a6148', [[-3, 2], [3, 2]], 1);
      box(c, '#e5edce', -1, -6, 2, 2); c.restore();
    }
    for (const blast of b.blasts) {
      c.save(); c.globalAlpha = (1 - blast.age / 25) * (reduced ? .5 : 1);
      for (let i = 0; i < 15; i++) {
        const a = i * 2.4, radius = blast.age * (1 + i % 3 * .2), size = Math.max(2, 8 - blast.age / 4);
        box(c, blast.metal ? ['#e7fff2', '#72938b', '#d8e6e7'][i % 3] : ['#ffefbd', '#ed9855', '#ad5941'][i % 3], blast.x + Math.cos(a) * radius, Math.min(ground - 1, blast.y + Math.sin(a) * radius), size, size);
      }
      c.restore();
    }
  }
  rocket(c, r, reduced) {
    c.save();
    r.trail.forEach((p, i) => {
      c.globalAlpha = .08 + i / r.trail.length * .28;
      box(c, r.age < ROCKET_FUEL ? '#b6b19c' : '#6c8580', p.x - 2, p.y - 2, 3, 3);
    });
    c.globalAlpha = 1; c.translate(Math.round(r.x), Math.round(r.y)); c.rotate(r.angle);
    if (r.age < ROCKET_FUEL) {
      box(c, '#d37543', -15, -2, reduced ? 5 : 5 + r.age % 3 * 2, 4);
      box(c, '#ffe4a1', -11, -1, 4, 2);
    }
    box(c, '#34433f', -9, -3, 12, 6); box(c, '#d9e9e5', -7, -2, 11, 3);
    box(c, '#faf8df', 3, -1, 3, 2); box(c, '#d96958', 0, -2, 3, 4);
    line(c, '#a8bbb2', [[-7, -2], [-11, -5], [-10, 0], [-11, 5], [-7, 2]], 1); c.restore();
  }
  hud(c, g) {
    // Called inside the dashboard transform, below the playable flight area.
    const b = g.boss, center = 151;
    box(c, '#10151c', 18, 562, 266, 98);
    label(c, b.phase === 'won' ? 'HUNTER DESTROYED  +3000' : 'LIQUID HUNTER', center, 582, 13);
    for (let i = 0; i < GRENADE_HITS; i++) {
      const px = center - 76 + i * 32;
      box(c, i < b.hits ? '#b1eec9' : '#3d5356', px, 596, 24, 10);
      if (i < b.hits) line(c, '#effff5', [[px + 7, 600], [px + 10, 603], [px + 17, 598]], 1);
    }
    label(c, `${b.hits} / 5 GRENADE HITS`, center, 626, 11, '#a6c2b8');
    if (b.fighting) {
      label(c, b.canGrenade ? 'SPACE · DROP GRENADE' : 'RELOADING', center, 649, 11, b.canGrenade ? '#e0edd0' : '#748e82');
      if (b.reload) box(c, '#779887', 32, 656, 238 * (1 - b.reload / GRENADE_RELOAD), 2);
    }
  }
}

import { CLOUD_SIZES, WIDTH, clamp } from './game.js';
import { CLOUD_SPANS } from './cloud-spans.js';
import { dashboardLayout } from './layout.js';
import { EXPLOSION_TICKS } from './combat.js';
import { CrewRenderer } from './crew.js';
import { DriverRenderer } from './driver.js';
import { SkyTitle } from './sky-title.js';
import { LIGHTNING_WARNING_TICKS, LIGHTNING_STRIKE_TICKS } from './lightning.js';
import { ActionArt } from './action-art.js';
import { LiquidArt } from './liquid-art.js';
import { RunnerArt } from './runner-art.js';
import { AirArt } from './air-art.js';
import { drawJumperFire, drawHayFire } from './fire-art.js';
import { OrbitArt } from './orbit-art.js';

export const PALETTE = { background: '#06080c', mint: '#8bffa5', light: '#ccfbd5', jade: '#509c68', muted: '#203a2b', panel: '#10151c', gold: '#deffac', red: '#ff8d9d' };
const assetNames = ['copter-wagon', 'man-numbers', 'dashboard', 'cloud-1', 'cloud-2', 'cloud-3'];
const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function text(c, value, x, y, size = 12, color = PALETTE.light, align = 'left') {
  c.fillStyle = color;
  c.font = `${size}px "Courier New", monospace`;
  c.textAlign = align;
  c.fillText(String(value), x, y);
  c.textAlign = 'left';
}
function line(c, points, color, width = 2) {
  c.strokeStyle = color; c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y)));
  c.stroke();
}
const noise = (x, y, seed) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177)) & 65535) / 65535;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.images = {};
    this.mintImages = {};
    this.cutouts = {};
    this.spriteCache = new Map();
    this.frameCache = new Map();
    this.fieldCache = new Map();
    this.crew = new CrewRenderer();
    this.skyTitle = new SkyTitle();
    this.actionArt = new ActionArt();
    this.bossArt = new LiquidArt();
    this.runnerArt = new RunnerArt();
    this.airArt = new AirArt();
    this.orbitArt = new OrbitArt();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 4;
    const tc = tile.getContext('2d');
    rect(tc, 0, 0, 4, 4, '#fff'); rect(tc, 0, 0, 2, 2, '#000'); rect(tc, 2, 2, 2, 2, '#000');
    this.dither = this.c.createPattern(tile, 'repeat');
  }
  async load() {
    await Promise.all(assetNames.map(async name => {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/${name}.png`;
      await image.decode();
      this.images[name] = image;
      for (const [collection, color] of [[this.mintImages, [204, 251, 213]], [this.cutouts, [0, 0, 0]]]) {
        const target = document.createElement('canvas');
        target.width = image.width; target.height = image.height;
        const context = target.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height);
        for (let p = 0; p < pixels.data.length; p += 4) {
          const black = pixels.data[p] < 128;
          pixels.data[p] = color[0]; pixels.data[p + 1] = color[1]; pixels.data[p + 2] = color[2];
          pixels.data[p + 3] = black ? 255 : 0;
        }
        context.putImageData(pixels, 0, 0);
        collection[name] = target;
      }
    }));
    this.driver = new DriverRenderer(this.images['copter-wagon']);
    await Promise.all([this.actionArt.load(), this.bossArt.load(), this.runnerArt.load(), this.airArt.load(), this.orbitArt.load()]);
    this.actionArt.grenadeArms = this.bossArt.arms;
  }
  blit(name, [sx, sy, w, h], x, y, scale = 2, themed = false, cutout = false) {
    if (themed || name.startsWith('cloud-')) {
      const sprite = this.sprite(name, [sx, sy, w, h], themed);
      this.c.drawImage(sprite, Math.round(x) - scale, Math.round(y) - scale, (w + 2) * scale, (h + 2) * scale);
      return;
    }
    const key = `${name}:${sx},${sy},${w},${h}:${cutout}`;
    if (!this.frameCache.has(key)) {
      // Crop at 1:1 before scaling. The sheet has border ink immediately beside
      // the last rotor frame; sampling the atlas directly can expose that edge.
      const frame = document.createElement('canvas');
      frame.width = w; frame.height = h;
      frame.getContext('2d').drawImage((cutout ? this.cutouts : this.images)[name], sx, sy, w, h, 0, 0, w, h);
      this.frameCache.set(key, frame);
    }
    this.c.drawImage(this.frameCache.get(key), Math.round(x), Math.round(y), w * scale, h * scale);
  }
  sprite(name, [sx, sy, w, h], themed) {
    const key = `${name}:${sx},${sy},${w},${h}:${themed}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const sprite = document.createElement('canvas');
    sprite.width = w + 2; sprite.height = h + 2;
    const c = sprite.getContext('2d');
    c.drawImage(this.images[name], sx, sy, w, h, 1, 1, w, h);
    const source = c.getImageData(0, 0, w + 2, h + 2), stride = w + 2;
    const ink = new Uint8Array(stride * (h + 2));
    for (let i = 0; i < ink.length; i++) ink[i] = source.data[i * 4 + 3] && source.data[i * 4] < 128 ? 1 : 0;
    // Flood the exterior. Only enclosed silhouette pixels receive dark fill;
    // the original white sprite-sheet rectangle stays completely transparent.
    const exterior = new Uint8Array(ink.length), queue = [0];
    exterior[0] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head], x = i % stride;
      const neighbors = [i - stride, i + stride];
      if (x) neighbors.push(i - 1);
      if (x < stride - 1) neighbors.push(i + 1);
      for (const next of neighbors) if (next >= 0 && next < ink.length && !ink[next] && !exterior[next]) {
        exterior[next] = 1; queue.push(next);
      }
    }
    if (name.startsWith('cloud-')) {
      exterior.fill(1);
      CLOUD_SPANS[Number(name.at(-1)) - 1].forEach((spans, y) => {
        for (const [left, right] of spans) for (let x = left; x <= right; x++) exterior[(y + 1) * stride + x + 1] = 0;
      });
    }
    const output = c.createImageData(stride, h + 2);
    for (let i = 0; i < ink.length; i++) {
      const x = i % stride, y = Math.floor(i / stride);
      const outline = themed && [i - stride, i + stride, x ? i - 1 : -1, x < stride - 1 ? i + 1 : -1].some(n => n >= 0 && n < ink.length && ink[n]);
      if (!ink[i] && exterior[i] && !outline) continue;
      const color = ink[i] ? (themed ? (y < h * 0.4 ? [204, 251, 213] : [139, 255, 165]) : [0, 0, 0]) : themed ? [6, 8, 12] : [255, 255, 255];
      output.data.set([...color, 255], i * 4);
    }
    c.putImageData(output, 0, 0);
    this.spriteCache.set(key, sprite);
    return sprite;
  }
  man(index, x, y, themed, scale = 2) {
    this.blit('man-numbers', [(index % 7) * 14, Math.floor(index / 7) * 16, 14, 16], x, y, scale, themed, true);
  }
  numbers(value, x, y) {
    [...String(value).padStart(6, '0').slice(-6)].forEach((digit, i) => {
      const d = Number(digit);
      this.blit('man-numbers', [(d % 5) * 20, 32 + Math.floor(d / 5) * 15, 20, 15], x + i * 42, y);
    });
  }
  field(x, y, w, h, time, seed = 1, opacity = 1) {
    // The field consists of 4px cells. Rasterize that small grid once per
    // simulation tick, then submit one image instead of thousands of canvas
    // commands on every display refresh. Entries are bounded by field seed.
    const columns=Math.ceil(w/4),rows=Math.ceil(h/4);
    let cached=this.fieldCache.get(seed);
    if(!cached||cached.w!==w||cached.h!==h){
      const canvas=document.createElement('canvas');canvas.width=columns;canvas.height=rows;
      const context=canvas.getContext('2d'),pixels=context.createImageData(columns,rows),cells=[];
      for(let row=0;row<rows;row++)for(let col=row%2;col<columns;col+=2){
        const edge=Math.max(Math.abs(col*4-w/2)/(w/2),row*4/h),i=(row*columns+col)*4;
        pixels.data.set([139,255,165,0],i);
        cells.push({row,col,i,edge:(edge-.4)*.6,noise:noise(col,row,seed),alpha:Math.round((.18+.36*noise(row,col,seed+7))*255)});
      }
      cached={w,h,canvas,context,pixels,cells,tick:-1};this.fieldCache.set(seed,cached);
    }
    const tick=this.reducedMotion?0:Math.floor(time*50+1e-6);
    if(tick!==cached.tick){
      cached.tick=tick;const t=tick/50;
      const horizontal=Array.from({length:columns},(_,col)=>.1*Math.sin(col*.43-t*2));
      const vertical=Array.from({length:rows},(_,row)=>.08*Math.sin(row*.7+t));
      for(const cell of cached.cells)cached.pixels.data[cell.i+3]=cell.noise<=Math.max(.02,cell.edge+horizontal[cell.col]+vertical[cell.row])?cell.alpha:0;
      cached.context.putImageData(cached.pixels,0,0);
    }
    this.c.save();this.c.globalAlpha=opacity;this.c.drawImage(cached.canvas,Math.round(x),Math.round(y),columns*4,rows*4);this.c.restore();
  }
  ring(x, y, radius, time, alpha = 1, color = PALETTE.mint) {
    const c = this.c; c.save(); c.globalAlpha = alpha;
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12 + (this.reducedMotion ? 0 : time * 0.6);
      rect(c, Math.round((x + Math.cos(angle) * radius) / 3) * 3, Math.round((y + Math.sin(angle) * radius) / 3) * 3, 3, 3, color);
    }
    c.restore();
  }
  draw(game, { hideCopter = false, hideJumper = false, cameraY = 0 } = {}) {
    const c = this.c;
    if (game.orbit.active) { this.orbitArt.draw(c, game, this, this.reducedMotion); return; }
    if (game.assault.active) { this.airArt.draw(c, game, this, this.reducedMotion); return; }
    if (game.runner.active && !['pursuit', 'caught'].includes(game.runner.phase)) {
      this.runnerArt.draw(c, game, this, this.reducedMotion); return;
    }
    c.setTransform(this.canvas.width / game.width, 0, 0, this.canvas.height / game.height, 0, -cameraY*this.canvas.height/game.height);
    c.imageSmoothingEnabled = false;
    rect(c, 0, cameraY, game.width, game.height, game.fullyThemed ? PALETTE.background : '#fff');
    if (game.fullyThemed) {
      this.field(0, 0, game.width, 140, game.time, 7, 0.55);
      this.field(0, game.deck - 80, game.width, 132, game.time, 8, 0.4);
      c.save();
      if (game.runner.active) c.translate(-game.runner.cameraX * game.width / game.runner.viewWidth * .45, 0);
      this.skyTitle.draw(c, game, this.reducedMotion); c.restore();
    }
    const ground = game.deck + 44;
    rect(c, 0, ground, game.width, 2, game.fullyThemed ? PALETTE.jade : '#000');
    rect(c, 0, ground + 2, game.width, 14, game.fullyThemed ? PALETTE.muted : this.dither);
    if (!game.runner.active && !hideCopter) this.drawCopter(game);
    if(!hideJumper)this.drawJumper(game);
    c.save();
    if (game.runner.active) c.translate(-game.runner.cameraX * game.width / game.runner.viewWidth, 0);
    this.drawCloud(game);
    this.drawCarriage(game);
    if (game.state === 'result' && game.outcome === 'fire' && game.jumper) {
      const frame = 7 + Math.min(5, Math.floor(game.effectTick / 5));
      this.burningMan(frame, game.cartX + game.jumper.cartOffset, game.deck - 14);
    }
    drawHayFire(c, game, this.reducedMotion);
    this.bossArt.draw(c, game, this, this.reducedMotion);
    c.restore();
    this.drawCombat(game);
    if (!this.reducedMotion && game.frame - game.shiftTick < 45 && game.lastShift !== 'world' && game.lastShift !== 'instruments') {
      const age = (game.frame - game.shiftTick) / 45;
      const centers = { cloud: [game.cloudX + game.cloudRect[2] / 2, game.cloudY + game.cloudRect[3] / 2], carriage: [game.cartX + 73, game.deck + 22], copter: [game.copterX, game.copterY + 26], stuntman: [game.copterX + 14, game.copterY + 60] };
      this.ring(...centers[game.lastShift], 25 + age * 85, game.time, 1 - age);
    }
    const hud = dashboardLayout(game);
    rect(c, 0, hud.y, game.width, game.height - hud.y, game.isThemed('instruments') ? PALETTE.background : this.dither);
    c.save();
    c.translate(hud.x, hud.y); c.scale(hud.scale, hud.scale); c.translate(0, -550);
    this.drawDashboard(game);
    c.restore();
    this.actionArt.drawCinema(c, game, this.reducedMotion);
    if (game.runner.active) this.runnerArt.draw(c, game, this, this.reducedMotion);
  }
  drawCopter(g) {
    if (!g.canFly) return;
    const themed = g.isThemed('copter');
    const c = this.c;
    c.save();
    c.translate(g.copterX, g.copterY + 26);
    if (themed) c.rotate(g.copterPitch);
    this.blit('copter-wagon', [(g.frame % 3) * 74, 0, 74, 26], -72, -26, 2, themed);
    if (themed && !this.reducedMotion) {
      for (let i = 0; i < 8; i++) rect(c, 25 + Math.sin(g.time * 19 + i) * 42, -24, 4, 2, PALETTE.mint);
    }
    c.restore();
    if (g.state === 'ready') {
      const hanging = g.hangingPosition;
      if (g.counterattack.armed) this.actionArt.drawGunner(c, g, this.reducedMotion);
      else this.man(0, hanging.x, hanging.y, g.isThemed('stuntman'));
    }
  }
  drawJumper(g) {
    if (!g.jumper) return;
    const j = g.jumper, themed = g.isThemed('stuntman');
    if (g.state === 'falling') {
      if (themed && !this.reducedMotion) {
        const c = this.c; c.save();
        for (let i = 0; i < 20; i++) {
          const age = (g.time * 2 + i / 20) % 1;
          c.globalAlpha = (1 - age) * 0.8;
          rect(c, j.x + 14 + Math.sin(i * 2.4 + g.time * 3) * 22 * age, j.y + 14 - age * 50, 3, 3, PALETTE.mint);
        }
        c.restore();
      }
      if (j.burning) this.burningMan(1 + g.frame % 5, j.x, j.y);
      else this.man(1 + g.frame % 5, j.x, j.y, themed);
    } else if (g.state === 'result' && !['hay', 'fire'].includes(g.outcome)) {
      const frame = 7 + Math.min(5, Math.floor(g.effectTick / 2));
      if (j.burning) this.burningMan(frame, j.x, j.y);
      else this.man(frame, j.x, j.y, themed);
    }
    drawJumperFire(this.c, g, this.reducedMotion);
  }
  burningMan(index, x, y) {
    const key = `burning-man:${index}`;
    if (!this.frameCache.has(key)) {
      const sprite = document.createElement('canvas'); sprite.width = 20; sprite.height = 22;
      const c = sprite.getContext('2d');
      c.drawImage(this.cutouts['man-numbers'], index % 7 * 14, Math.floor(index / 7) * 16, 14, 16, 3, 3, 14, 16);
      const ink = c.getImageData(0, 0, 20, 22).data;
      c.clearRect(0, 0, 20, 22);
      // Use each actual falling pose as the fire silhouette. The whole body is
      // incandescent, with dark red bones inside its bright arcade-style rim.
      for (let py = 0; py < 22; py++) for (let px = 0; px < 20; px++) {
        let distance = 9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx >= 0 && nx < 20 && ny >= 0 && ny < 22 && ink[(ny * 20 + nx) * 4 + 3]) distance = Math.min(distance, dx * dx + dy * dy);
        }
        if (distance > 5) continue;
        const color = distance === 0 ? (py % 3 === 0 ? '#ffb638' : '#8d250b') : distance === 1 ? '#f26724' : distance === 2 ? '#fff0a4' : '#ffca3d';
        rect(c, px, py, 1, 1, color);
      }
      this.frameCache.set(key, sprite);
    }
    this.c.drawImage(this.frameCache.get(key), Math.round(x) - 6, Math.round(y) - 6, 40, 44);
  }
  drawCloud(g) {
    if (!g.cloudEnabled) return;
    const [w, h] = CLOUD_SIZES[g.cloudIndex];
    const themed = g.isThemed('cloud');
    this.blit(`cloud-${g.cloudIndex + 1}`, [0, 0, w, h], g.cloudX, g.cloudY, 2, themed);
    if (themed) {
      for (let i = 0; i < 3; i++) this.ring(g.cloudX + w * (i + 1) / 2, g.cloudY + h, 13 + 5 * Math.sin((this.reducedMotion ? 0 : g.time * 2) + i), g.time + i, 0.4);
      this.drawLightning(g);
    }
  }
  drawLightning(g) {
    const storm = g.lightning, c = this.c, paths = storm.paths(g);
    if (!paths.length) return;
    const [x, y] = paths[0][0];
    c.save();
    if (storm.phase === 'warning') {
      const charge = storm.age / LIGHTNING_WARNING_TICKS;
      c.globalAlpha = .3 + charge * .25;
      rect(c, x, y - 2, 2, 2, PALETTE.mint);
    } else {
      const fade = 1 - storm.age / LIGHTNING_STRIKE_TICKS;
      paths.forEach((path, i) => {
        c.globalAlpha = (this.reducedMotion ? .55 : .5 + fade * .45) * (i ? .75 : 1);
        line(c, path, g.fullyThemed ? PALETTE.mint : PALETTE.jade, i ? 1.5 : 2);
      });
    }
    c.restore();
  }
  drawCarriage(g) {
    const c = this.c, themed = g.isThemed('carriage'), cart = g.carriage;
    const frame = Math.floor(cart.distance / 2) % 3;
    if (cart.deadHorse) this.blit('man-numbers', [81, 94, 29, 22], cart.deadHorse.x, g.deck, 2, themed, true);
    if (cart.looseHorse) this.blit('copter-wagon', [Math.floor(cart.looseHorse.distance / 6) % 3 * 73 + 44, 26, 29, 22], cart.looseHorse.x, g.deck, 2, themed, true);
    this.driver.drawFallen(c, g, themed, this.reducedMotion);
    this.drawCartExhaust(g, themed);
    if (g.boss.ownsCart && g.boss.phase !== 'victory') {
      if (!g.boss.replacesCart) {
        if (cart.motorized) { this.drawMotorCart(g, frame, themed); return; }
        c.save(); c.beginPath();
        c.rect(g.cartX, g.deck, 68, 22); c.rect(g.cartX, g.deck + 22, 88, 22); c.clip();
        this.blit('copter-wagon', [frame * 73, 26, 73, 22], g.cartX, g.deck, 2, themed);
        c.restore();
        if (cart.horseAlive) this.blit('copter-wagon', [44, 26, 29, 22], g.cartX + 88, g.deck, 2, themed, true);
      }
      return;
    }
    if (cart.horseAlive) this.blit('copter-wagon', [frame * 73, 26, 73, 22], g.cartX, g.deck, 2, themed);
    else if (cart.motorized) this.drawMotorCart(g, frame, themed);
    else {
      // Preserve the original hay and both wheels while removing the horse and
      // seated driver. The two clip regions meet below the driver's seat.
      c.save(); c.beginPath();
      c.rect(g.cartX, g.deck, 68, 22); c.rect(g.cartX, g.deck + 22, 88, 22); c.clip();
      this.blit('copter-wagon', [frame * 73, 26, 73, 22], g.cartX, g.deck, 2, themed);
      c.restore();
      if (cart.phase === 'dismount' && cart.transitionTick < 12) {
        this.blit('copter-wagon', [frame * 73 + 34, 26, 11, 11], g.cartX + 68, g.deck, 2, themed);
      } else this.drawCartDriver(g, themed);
    }
    if (g.state === 'result' && g.outcome === 'hay') {
      c.save();
      if (cart.motorized) this.applyMotorRumble(g);
      rect(this.c, g.cartX, g.deck, 56, 20, g.fullyThemed ? PALETTE.background : '#fff');
      this.blit('man-numbers', [81, 62, 28, 10], g.cartX, g.deck, 2, themed);
      if (themed && !this.reducedMotion) this.ring(g.cartX + 28, g.deck + 8, 10 + g.effectTick, g.time, 1 - g.effectTick / 45, PALETTE.gold);
      c.restore();
    }
    if (themed && !this.reducedMotion && cart.motion > 0 && !cart.motorized) {
      const c = this.c; c.save();
      for (let i = 0; i < 18; i++) {
        const age = (g.time * 2 + i / 18) % 1;
        c.globalAlpha = 0.8 * (1 - age);
        rect(c, g.cartX + 30 - age * 75, g.deck + 38 - Math.sin(age * Math.PI) * (8 + i % 4), 3, 3, PALETTE.mint);
      }
      c.restore();
    }
  }
  drawCartDriver(g, themed) {
    this.driver.draw(this.c, g, themed);
  }
  applyMotorRumble(g) {
    if (this.reducedMotion) return;
    const offset = [0, -1, 0, 1, 0, -1, 1, 0][Math.floor(g.carriage.engineTick / 3) % 8];
    const ground = g.deck + 44;
    // Keep the complete buggy joined and its tires on the ground. A one-pixel
    // compression/stretch supplies rumble without separating body and wheels.
    this.c.translate(0, ground);
    this.c.scale(1, (44 - offset) / 44);
    this.c.translate(0, -ground);
  }
  drawMotorCart(g, frame, themed) {
    const c = this.c;
    c.save(); this.applyMotorRumble(g);
    // One unbroken cart silhouette, masked only to remove the seated driver.
    c.save(); c.beginPath();
    c.rect(g.cartX, g.deck, 68, 22); c.rect(g.cartX, g.deck + 22, 88, 22); c.clip();
    this.blit('copter-wagon', [frame * 73, 26, 73, 22], g.cartX, g.deck, 2, themed);
    c.restore();
    c.translate(Math.round(g.cartX), g.deck);
    const ink = themed ? PALETTE.light : '#000', fill = themed ? PALETTE.background : '#fff';
    // A small exposed engine occupies the empty driver's seat. Keep the hay.
    rect(c, 66, 16, 22, 12, ink); rect(c, 68, 18, 18, 8, fill);
    rect(c, 70, 12, 12, 4, ink); rect(c, 82, 10, 4, 6, ink);
    for (const x of [72, 78, 84]) rect(c, x, 18, 2, 8, ink);
    rect(c, 88, 20, 4, 6, ink); rect(c, 90, 20, 2, 2, fill);
    rect(c, -6, 28, 10, 6, ink); rect(c, -6, 30, 8, 2, fill);
    c.restore();
  }
  drawCartExhaust(g, themed) {
    const c = this.c;
    c.save();
    for (const puff of g.carriage.exhaust) {
      const age = this.reducedMotion ? 0 : puff.age;
      const radius = Math.floor((puff.burst ? 4 : 2) + age * .07);
      c.globalAlpha = this.reducedMotion ? .45 : Math.min(.7, 1 - puff.age / puff.life);
      for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y > radius * radius) continue;
        let grain = Math.imul(x + 31, 0x45d9f3b) ^ Math.imul(y + 17, 0x27d4eb2d) ^ Math.imul(puff.seed, 0x9e3779b1);
        grain = Math.imul(grain ^ grain >>> 16, 0x45d9f3b);
        const shade = ((grain ^ grain >>> 16) >>> 0) / 4294967296;
        if (shade < .16) continue;
        const color = themed ? (shade < .65 ? PALETTE.jade : PALETTE.mint) : shade < .65 ? '#666' : '#999';
        rect(c, Math.round(puff.x / 2) * 2 + x * 2, Math.round(puff.y / 2) * 2 + y * 2, 2, 2, color);
      }
    }
    c.restore();
  }
  drawDashboard(g) {
    const c = this.c;
    if (g.isThemed('instruments')) return this.drawDigitalDashboard(g);
    rect(c, 0, 550, WIDTH, 122, this.dither);
    const x = 125, y = 558;
    this.blit('dashboard', [0, 0, 387, 51], x, y);
    c.save(); c.beginPath(); c.rect(133, 566, 86, 86); c.clip();
    this.blit('man-numbers', [0, 62, 81, 81], x - 30 + g.controlX * 10, y - 30 + g.controlY * 10);
    c.restore();
    g.history.forEach((success, i) => this.man(success ? 6 : 13, x + 108 + i * 30, y + (success ? 34 : 68), false));
    if (g.state !== 'game_over' && g.history.length < 5) {
      c.save(); c.globalCompositeOperation = 'difference';
      rect(c, x + 108 + g.history.length * 30, y + 1, 28, 30, '#fff'); c.restore();
    }
    this.numbers(g.score, x + 270, y + 20);
    this.numbers(g.best, x + 270, y + 70);
    text(c, g.heightOfDrop, x + 680, y + 24, 18, '#000');
    text(c, g.wagonLabel, x + 654, y + 59, 17, '#000');
    text(c, ['OH BOY', 'LIGHT', 'MEDIUM', 'HEAVY'][g.gravity - 1], x + 654, y + 94, 17, '#000');
    if (g.state === 'result' && g.outcome === 'hay') {
      const frame = Math.min(13, Math.floor(g.effectTick / 3));
      for (const fx of [27, 933]) this.blit('copter-wagon', [(frame % 7) * 32, 48 + Math.floor(frame / 7) * 41, 32, 41], fx, y + 8);
    }
  }
  drawDigitalDashboard(g) {
    const c = this.c;
    rect(c, 0, 550, WIDTH, 122, PALETTE.background);
    rect(c, 0, 550, WIDTH, 2, PALETTE.jade);
    if (g.boss.replacesCart) this.bossArt.hud(c, g);
    else {
      this.field(0, 554, 297, 118, g.time, 9, 0.8);
      text(c, 'SLOP', 24, 585, 16, PALETTE.jade);
      text(c, 'COPTER', 22, 630, 44);
      text(c, 'FLIGHT SYSTEMS / SIGNAL ACTIVE', 24, 650, 10, PALETTE.jade);
    }
    for (const [x, w] of [[299, 244], [551, 173], [732, 126], [866, 148]]) rect(c, x, 562, w, 98, PALETTE.panel);
    text(c, 'SCORE', 313, 582, 10, PALETTE.mint);
    text(c, `LVL ${String(g.level).padStart(2, '0')}`, 524, 582, 10, PALETTE.jade, 'right');
    text(c, String(g.score).padStart(6, '0').slice(-6), 310, 622, 39);
    text(c, `BEST ${String(g.best).padStart(6, '0').slice(-6)}`, 314, 648, 11, PALETTE.jade);
    text(c, 'HEIGHT', 563, 582, 10, PALETTE.jade); text(c, g.heightOfDrop, 708, 582, 12, PALETTE.light, 'right');
    text(c, 'WAGON', 563, 601, 10, PALETTE.jade); text(c, g.wagonLabel, 708, 601, 12, PALETTE.light, 'right');
    text(c, g.boss.replacesCart ? 'HITS' : g.counterattack.armed ? 'TARGETS' : 'FALL', 563, 620, 10, PALETTE.jade);
    text(c, g.boss.replacesCart ? `${g.boss.hits} / 5` : g.counterattack.armed ? `${g.combat.shooters.length} LEFT` : ['OH BOY', 'LIGHT', 'MED', 'HEAVY'][g.gravity - 1], 708, 620, 12, PALETTE.light, 'right');
    for (let i = 0; i < 5; i++) {
      const outcome = g.history[i];
      rect(c, 564 + i * 30, 635, 22, 14, outcome === true ? PALETTE.mint : outcome === false ? PALETTE.red : PALETTE.muted);
      if (i === g.history.length) rect(c, 572 + i * 30, 639, 6, 6, PALETTE.jade);
    }
    text(c, 'YOKE', 796, 581, 10, PALETTE.jade, 'center');
    line(c, [[752, 618], [840, 618]], PALETTE.muted, 1); line(c, [[796, 590], [796, 650]], PALETTE.muted, 1);
    this.ring(796 + g.controlX * 9, 618 + g.controlY * 7, 6, g.time, 1);
    text(c, 'HULL', 880, 582, 10, PALETTE.jade);
    text(c, g.canFly ? g.combat.hits ? 'DAMAGED' : 'STABLE' : 'MAYDAY', 880, 605, 14, g.combat.hits ? PALETTE.red : PALETTE.mint);
    for (let i = 0; i < 3; i++) rect(c, 880 + i * 40, 616, 31, 13, i < g.combat.hits ? PALETTE.red : PALETTE.muted);
    text(c, `${g.combat.hits} / 3 HITS`, 880, 649, 11, PALETTE.jade);
  }
  drawCombat(g) {
    if (!g.retaliation) return;
    const c = this.c, b = g.combat;
    for (const s of b.shooters) this.crew.draw(c, s, g.deck + 44, this.reducedMotion);
    this.actionArt.drawBattle(c, g, this.crew, this.reducedMotion);
    for (const bullet of b.bullets) {
      line(c, [[bullet.x - bullet.vx, bullet.y - bullet.vy], [bullet.x, bullet.y]], '#ffc778', 3);
      rect(c, bullet.x - 1, bullet.y - 1, 3, 3, '#fff7d1');
    }
    c.save();
    for (const puff of b.smoke) {
      const age = puff.age / 75, r = 3 + age * (b.hits === 1 ? 13 : 23);
      c.globalAlpha = (1 - age) * 0.75;
      rect(c, puff.x - r, puff.y - r * 0.65, r * 2, r * 1.3, '#40494a');
      rect(c, puff.x - r * 0.65, puff.y - r * 0.8, r, r * 0.75, '#929c9a');
    }
    c.restore();
    if (b.hurtTicks > 35 && g.canFly && !this.reducedMotion) this.ring(g.copterX + 22, g.copterY + 24, 33, g.time, 0.9, PALETTE.red);
    if (g.state === 'crashing') {
      c.save(); c.translate(g.copterX + 2, g.copterY + 26);
      c.rotate(this.reducedMotion ? b.angle * 0.1 : b.angle);
      this.blit('copter-wagon', [(g.frame % 3) * 74, 0, 74, 26], -74, -26, 2, true);
      c.restore();
    } else if (g.state === 'exploding' || g.state === 'game_over') {
      this.drawExplosion(g);
    }
  }
  drawExplosion(g) {
    const c = this.c, p = g.combat.explosionTick / EXPLOSION_TICKS, x = g.copterX, y = g.deck + 44;
    rect(c, x - 43, y - 12, 83, 13, '#20252b');
    line(c, [[x - 56, y - 4], [x - 13, y - 13], [x + 14, y - 3], [x + 38, y - 13]], '#63716b', 3);
    line(c, [[x - 16, y - 7], [x - 24, y - 20], [x + 5, y - 8]], '#63716b', 3);
    rect(c, x - 11, y - 6, 4, 3, '#ffb464');
    if (p >= 1) return;
    c.save(); c.globalAlpha = 1 - p;
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.39996, distance = (16 + i % 7 * 8) * Math.sin(p * Math.PI * 0.8);
      const size = Math.max(2, 20 * (1 - p) * (1 + i % 3 * 0.2));
      rect(c, x + Math.cos(angle) * distance - size / 2, y + Math.sin(angle) * distance - p * 22 - size / 2, size, size, ['#ff643d', '#ffa34e', '#ffe797'][i % 3]);
    }
    c.restore();
    if (!this.reducedMotion) this.ring(x, y, 12 + 120 * p, g.time, (1 - p) * 0.8);
  }
}

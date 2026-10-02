import { AIR_ROUTE, AIR_TURN_TICKS } from './air-assault.js';
import { LandingArt } from './landing-art.js';
import { CityArt, cloudlet } from './city-art.js';
import { DeckArt } from './deck-art.js';
import { exposedAirshipParts, AIRSHIP_INTRO_TICKS } from './airship.js';
import { hitSprite } from './hit-flash.js';
import { ArcadeEffects } from './arcade-effects.js';
import { AIR_PLAYER_WIDTH, AIR_WINGMAN_WIDTH, AIR_WINGMAN_OFFSET, AIR_WINGMAN_Y, airPlayerBank } from './air-player.js';
import { drawAirPickup } from './air-pickup-art.js';

export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
export const hash = n => ((Math.imul(n + 43, 2654435761) >>> 0) % 65536) / 65536;
export function box(c, color, x, y, w, h) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); }
export function line(c, color, points, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.stroke();
}
export function poly(c, color, points) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
}
export function label(c, value, x, y, size = 10, color = '#edf1df', align = 'left') {
  c.font = `bold ${size}px "Courier New", monospace`; c.textAlign = align;
  c.fillStyle = '#111d29'; c.fillText(value, x + 1, y + 1); c.fillStyle = color; c.fillText(value, x, y); c.textAlign = 'left';
}
const TYPES = ['tank', 'turret', 'missile', 'radar', 'boat', 'gunship', 'drone', 'train'];
const WIDTHS = { tank: 29, turret: 34, missile: 28, radar: 28, boat: 30, gunship: 48, drone: 40, train: 30 };

export class AirArt {
  constructor() {
    this.surface = document.createElement('canvas'); this.damageSurface = document.createElement('canvas');
    this.landing = new LandingArt(); this.city = new CityArt(); this.deck = new DeckArt(); this.arcade = new ArcadeEffects(); this.sprites = {};
  }
  async load() {
    const names = ['assault-helicopter', 'assault-enemies', 'carrier-top', 'carrier-side', 'spaceplane-atlas', 'iron-vulture'];
    const images = await Promise.all(names.map(async name => {
      const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/${name}.png`; await image.decode(); return image;
    }));
    this.sprites.heli = this.crop(images[0]);
    TYPES.forEach((type, i) => {
      const image = images[1], w = image.width / 4, h = image.height / 2;
      this.sprites[type] = this.crop(image, [i % 4 * w, Math.floor(i / 4) * h, w, h]);
    });
    this.sprites.carrier = this.crop(images[2]); this.sprites.side = this.crop(images[3]);
    this.sprites.island = this.crop(images[3], [1030, 40, 445, 360]);
    this.sprites.ship = this.crop(images[4], [0, 0, 900, images[4].height]);
    this.sprites.shipSide = this.crop(images[4], [915, 0, images[4].width - 915, images[4].height]);
    this.sprites.airship = this.crop(images[5]);
    for (const name of ['heli', ...TYPES]) this.sprites[name] = this.readable(this.sprites[name], name === 'heli' ? AIR_PLAYER_WIDTH - 4 : WIDTHS[name], name === 'heli');
    await Promise.all([this.city.load(), this.deck.load(), this.arcade.load()]);
  }
  crop(image, rect = [0, 0, image.width, image.height]) {
    const [x, y, w, h] = rect, canvas = document.createElement('canvas'); canvas.width = Math.ceil(w); canvas.height = Math.ceil(h);
    const c = canvas.getContext('2d'); c.drawImage(image, x, y, w, h, 0, 0, w, h);
    const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
    for (let yy = 0; yy < canvas.height; yy++) for (let xx = 0; xx < canvas.width; xx++) if (data[(yy * canvas.width + xx) * 4 + 3] > 180) {
      left = Math.min(left, xx); right = Math.max(right, xx); top = Math.min(top, yy); bottom = Math.max(bottom, yy);
    }
    const result = document.createElement('canvas'); result.width = Math.min(680, right - left + 1);
    result.height = Math.round(result.width * (bottom - top + 1) / (right - left + 1));
    const rc = result.getContext('2d'); rc.imageSmoothingQuality = 'high';
    rc.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 0, 0, result.width, result.height); return result;
  }
  sprite(c, name, x, y, width, angle = 0, alpha = 1, hit = false, reduced = false) {
    const image = hit ? hitSprite(this.sprites[name], reduced) : this.sprites[name], height = width * image.height / image.width;
    c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(angle); c.globalAlpha *= alpha;
    c.drawImage(image, -width / 2, -height / 2, width, height); c.restore(); return height;
  }
  readable(source, width, player) {
    const body = document.createElement('canvas'); body.width = width; body.height = Math.round(width * source.height / source.width);
    const bc = body.getContext('2d'); bc.imageSmoothingQuality = 'high'; bc.drawImage(source, 0, 0, body.width, body.height);
    const pixels = bc.getImageData(0, 0, body.width, body.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const d = pixels.data; if (d[i + 3] < 90) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      for (let k = 0; k < 3; k++) d[i + k] = Math.min(240, Math.round((d[i + k] * (player ? 1.4 : 1.2) + (player ? 22 : 14)) / 8) * 8);
    }
    bc.putImageData(pixels, 0, 0);
    const result = document.createElement('canvas'); result.width = body.width + 4; result.height = body.height + 4;
    const c = result.getContext('2d');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.drawImage(body, 2 + dx, 2 + dy);
    c.globalCompositeOperation = 'source-in'; c.fillStyle = player ? '#b3d7d0' : '#7d918e'; c.fillRect(0, 0, result.width, result.height);
    c.globalCompositeOperation = 'source-over'; c.drawImage(body, 2, 2); return result;
  }
  heli(c, x, y, width, time, reduced, bank = 0, enemy = false, hit = false) {
    c.save(); c.translate(x, y); c.rotate(bank);
    this.sprite(c, enemy ? 'gunship' : 'heli', 0, 0, width, 0, 1, hit, reduced);
    const rotorY = enemy ? 0 : -width * .16, span = width * .66;
    // Several short translucent sweeps read as rotation without a giant cross.
    for (let n = 0; n < (reduced ? 1 : 3); n++) {
      c.save(); c.translate(0, rotorY); c.rotate(reduced ? .2 : time * 57 - n * .32);
      c.globalAlpha = n ? .14 : .62;
      line(c, '#9cb0ac', [[-span, 0], [span, 0]], 1);
      line(c, '#4d686b', [[0, -span], [0, span]], 1); c.restore();
    }
    box(c, '#192e36', -2, rotorY - 2, 4, 4); box(c, '#d2e5d8', -1, rotorY - 1, 2, 2);
    c.restore();
  }
  wreck(c, w, a, reduced) {
    // Broken pieces and a scorch mark, never a second intact enemy sprite.
    cloudlet(c, '#15232b', w.x, w.y, w.type === 'train' ? 19 : 12, w.seed * 1000);
    for (let i = 0; i < 8; i++) {
      const seed = Math.floor(w.seed * 1000) + i * 21;
      box(c, i % 3 ? '#455054' : '#747c73', w.x + (hash(seed) - .5) * 25, w.y + (hash(seed + 7) - .5) * 20, 2 + i % 3, 2);
    }
    if (w.age < 100) { c.save(); c.globalAlpha = Math.min(1, (100 - w.age) / 35); this.city.fire(c, w.x, w.y, 4, w.seed * 1000, a.time, reduced); c.restore(); }
  }
  weapon(c, e, a, reduced) {
    if (e.type === 'radar') return;
    const aim = e.aim ?? Math.atan2(a.y - e.y, a.x - e.x);
    const x = e.x + Math.cos(aim) * 11, y = e.y + Math.sin(aim) * 11;
    if (!e.airborne) {
      line(c, '#12252e', [[e.x, e.y], [x, y]], 5);
      line(c, '#a2aca2', [[e.x, e.y], [x, y]], 2);
      box(c, '#768d89', e.x - 3, e.y - 3, 6, 6);
    }
    if (e.warning) {
      const charge = 1 - e.cooldown / 30;
      cloudlet(c, '#953c2e', x, y, 2 + charge * 2, 4);
      box(c, '#ffd49b', x - 1, y - 1, 2, 2);
      if (charge > .4) for (let i = 1; i <= 3; i++) {
        c.save(); c.globalAlpha = .45;
        box(c, '#eeae72', x + Math.cos(aim) * i * 9, y + Math.sin(aim) * i * 9, 1, 1); c.restore();
      }
    }
    if (e.flash) {
      cloudlet(c, '#ef994a', x, y, reduced ? 4 : 4 + e.flash * .4, 9);
      cloudlet(c, '#fff0bd', x, y, 2, 9);
    }
  }
  draw(target, game, renderer, reduced) {
    if (game.boarding.active) { this.deck.draw(target, game, this, renderer, reduced); return; }
    const a = game.assault, w = Math.ceil(a.width), h = Math.ceil(a.height);
    if (this.surface.width !== w || this.surface.height !== h) { this.surface.width = w; this.surface.height = h; }
    const c = this.surface.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, w, h);
    if (a.recovery) this.landing.draw(c, game, this, renderer, reduced);
    else {
      c.save();
      if (!reduced) c.translate(Math.sin(a.time * 97) * a.shake * 7, Math.cos(a.time * 113) * a.shake * 7);
      this.terrain(c, a, w, h, reduced);
      for (const wreck of a.wrecks) this.wreck(c, wreck, a, reduced);
      if (a.carrier) this.carrier(c, a, reduced);
      if (a.airship) this.airship(c, a, reduced);
      for (const e of a.enemies) {
        const angle = e.airborne ? Math.PI - Math.atan2(e.x - e.oldX, e.y - e.oldY) : 0;
        if (e.type === 'gunship') this.heli(c, e.x, e.y, WIDTHS[e.type], a.time, reduced, angle, true, e.hit > 0);
        else this.sprite(c, e.type, e.x, e.y, WIDTHS[e.type], angle, 1, e.hit > 0, reduced);
        this.weapon(c, e, a, reduced);
        if (e.type === 'radar') {
          const angle = reduced ? 0 : a.time * 2;
          line(c, '#8edcb1', [[e.x, e.y], [e.x + Math.cos(angle) * 13, e.y + Math.sin(angle) * 13]]);
        }
      }
      this.effects(c, a, reduced);
      for (const s of a.shots) {
        box(c, '#318ba2', s.x - 1, s.y + 3, 2, 6); box(c, '#d6fbff', s.x, s.y, 1, 7);
      }
      if (!a.dead && a.phase !== 'turn') {
        const alpha = a.hurt && Math.floor(a.age / 4) % 2 ? .8 : 1;
        c.save(); c.globalAlpha = alpha;
        const angle = airPlayerBank(a);
        this.heli(c, a.x, a.y, AIR_PLAYER_WIDTH, a.time, reduced, angle);
        for (let i = 0; i < a.wingmen; i++) this.heli(c, a.x + (i ? 1 : -1) * AIR_WINGMAN_OFFSET, a.y + AIR_WINGMAN_Y, AIR_WINGMAN_WIDTH, a.time + i, reduced, angle);
        c.restore();
      }
      // Supplies stay legible above fire, smoke and wreckage. Enemy rounds
      // remain on top so the brighter badges cannot conceal incoming fire.
      for (const item of a.pickups) drawAirPickup(c,item,reduced);
      for (const b of a.bullets) {
        if (b.homing) {
          line(c, '#dab28b', [[b.x - b.vx * .10, b.y - b.vy * .10], [b.x, b.y]], 2);
          c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
          box(c, '#172a35', -6, -3, 11, 6); box(c, '#fff3d1', -4, -1, 9, 2); box(c, '#ff905a', -7, -2, 3, 4); c.restore();
        } else {
          cloudlet(c, '#381b38', b.x, b.y, 4.5, 0); cloudlet(c, '#ff799e', b.x, b.y, 3.5, 0); box(c, '#fff4e5', b.x - 1, b.y - 1, 2, 2);
        }
      }
      c.restore(); this.hud(c, game, w, h);
    }
    if (a.phase === 'turn') {
      renderer.runnerArt.draw(target, game, renderer, reduced);
      target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = ease(a.age / AIR_TURN_TICKS);
      target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
      // One shared position for the side and overhead silhouettes. The camera
      // reveals the city underneath while the aircraft banks and recedes.
      c.clearRect(0, 0, w, h);
      const r = game.runner, t = ease(a.age / AIR_TURN_TICKS);
      const startX = r.rescue ? (r.rescue.x - r.cameraX - 12) / r.viewWidth * w : w * .62;
      const startY = r.rescue ? (r.rescue.y - r.cameraY - 32) / r.viewHeight * h : h * .26;
      const hx = startX + (a.x - startX) * t, hy = startY + (a.y - startY) * t;
      const dissolve = ease((a.age - 65) / 16), width = (192 * w / r.viewWidth) * (1 - t) + 72 * t;
      c.save(); c.translate(hx, hy); c.rotate(reduced ? 0 : -.10 * Math.sin(t * Math.PI)); c.globalAlpha = 1 - dissolve;
      c.drawImage(renderer.runnerArt.rescueArt.body, -width / 2, -width / 4, width, width / 2);
      const span = width * (reduced ? .46 : .35 + Math.sin(a.time * 50) ** 2 * .13);
      line(c, '#273a3e', [[width * .12 - span, -width * .08], [width * .12 + span, -width * .08]], 2); c.restore();
      c.save(); c.globalAlpha = dissolve;
      this.heli(c, hx, hy, AIR_PLAYER_WIDTH + (128 - AIR_PLAYER_WIDTH) * (1 - t), a.time, reduced, Math.PI / 2 * (1 - t)); c.restore();
      target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1;
      target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
      return;
    }
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1; target.imageSmoothingEnabled = false;
    target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
  }
  terrain(c, a, w, h, reduced) {
    this.city.draw(c, a, w, h, reduced);
    if (a.route === 3 && !a.carrier && !a.airship) {
      const t = a.routeAge / (AIR_ROUTE[3].seconds * 50), width = 12 + t * 26;
      this.sprite(c, 'carrier', w * .5, -80 + t * 160, width, 0, .35 + t * .5);
    }
  }
  carrier(c, a, reduced) {
    const r = a.carrierRect();
    // Friendly recovery ship: no damage targets, weapons or health bars.
    line(c, '#71969c', [[r.x - 10, r.y + r.height], [r.x - 2, r.y + 24], [r.x + r.width / 2, r.y - 8], [r.x + r.width + 3, r.y + 24], [r.x + r.width + 15, r.y + r.height]], 3);
    c.drawImage(this.sprites.carrier, r.x, r.y, r.width, r.height);
    this.sprite(c, 'ship', r.x + r.width * .48, r.y + r.height * .25, r.width * .26);
    for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
      const lit = reduced || (Math.floor(a.age / 5) + i) % 9 < 3;
      box(c, lit ? '#d6ffd5' : '#5a987c', a.width / 2 + side * r.width * .19, r.y + r.height * (.53 + i * .035), 3, 4);
    }
  }
  airship(c, a, reduced) {
    const b = a.airship, dying = a.phase === 'airship-down';
    c.save(); if (dying) { c.translate(0, a.age * .13); c.globalAlpha = Math.max(.1, 1 - a.age / 190); }
    this.sprite(c, 'airship', b.x, b.y, b.width);
    const source = this.sprites.airship, height = b.width * source.height / source.width;
    const surface = this.damageSurface;
    if (surface.width !== Math.ceil(b.width) || surface.height !== Math.ceil(height)) { surface.width = Math.ceil(b.width); surface.height = Math.ceil(height); }
    const dc = surface.getContext('2d'); dc.clearRect(0, 0, surface.width, surface.height); dc.imageSmoothingEnabled = false;
    // Both craters and the struck-metal palette are cut by the actual hull's
    // alpha. Nothing paints an opaque tile over the sea or the wing outline.
    for (const [index, p] of b.parts.entries()) {
      const x = p.x - b.x + b.width / 2, y = p.y - b.y + height / 2;
      if (!p.hp) {
        const size = p.id === 'reactor' ? 32 : 24;
        dc.drawImage(this.arcade.crater, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
        for (let n = 0; n < 5; n++) {
          const angle = n * 1.31 + index;
          line(dc, '#151e24', [[x + Math.cos(angle) * 8, y + Math.sin(angle) * 6],
            [x + Math.cos(angle) * 15, y + Math.sin(angle) * 11], [x + Math.cos(angle + .12) * 19, y + Math.sin(angle) * 14]]);
        }
      } else if (p.hit) {
        dc.save(); dc.beginPath(); dc.arc(x, y, p.radius + 7, 0, Math.PI * 2); dc.clip();
        dc.drawImage(hitSprite(source, reduced), 0, 0, b.width, height); dc.restore();
      }
    }
    dc.globalCompositeOperation = 'destination-in'; dc.drawImage(source, 0, 0, b.width, height); dc.globalCompositeOperation = 'source-over';
    c.drawImage(surface, Math.round(b.x) - b.width / 2, Math.round(b.y) - height / 2);
    const exposed = exposedAirshipParts(a);
    for (const [index, p] of b.parts.entries()) {
      if (!p.hp) {
        const age = Math.max(0, a.time - (p.destroyedAt ?? a.time));
        for (let n = 0; n < (reduced ? 2 : 5); n++) {
          const t = reduced ? n * .3 : (age * .65 + n * .21) % 1;
          c.save(); c.globalAlpha *= (1 - t) * .32;
          cloudlet(c, n % 2 ? '#7b807d' : '#414d52', p.x + Math.sin(n * 3 + index) * (2 + t * 5), p.y - t * 25,
            2 + t * 5, n * 17 + index); c.restore();
        }
      } else if (p.flash) {
        cloudlet(c, '#ffd996', p.x, p.y + 7, 5, index);
        cloudlet(c, '#fff4ca', p.x, p.y + 7, 2, index);
      } else if (exposed.includes(p) && b.age >= AIRSHIP_INTRO_TICKS && p.clock <= 32 && p.aim !== null) {
        const charge = 1 - p.clock / 32;
        cloudlet(c, '#b45e3c', p.x, p.y + 5, 3 + charge * 3, index);
        cloudlet(c, '#ffe1a3', p.x, p.y + 5, 1 + charge * 2, index);
        if (charge > .55) for (let n = 1; n <= 3; n++) box(c, '#ddae7e', p.x + Math.cos(p.aim) * n * 10, p.y + Math.sin(p.aim) * n * 10, 1, 1);
      }
    }
    c.restore();
  }
  effects(c, a, reduced) {
    c.save();
    for (const b of a.explosions) {
      this.arcade.explosion(c, b.x, b.y, b.age, Math.round(b.radius * 2.2), reduced);
    }
    for (const p of a.particles) {
      c.globalAlpha = 1 - p.age / p.life;
      const color = p.age < 5 ? '#fff1b4' : p.age < 14 ? '#f7a54c' : '#737e7b';
      if (p.age < 12) line(c, '#be7144', [[p.x - p.vx * .025, p.y - p.vy * .025], [p.x, p.y]], 1);
      box(c, color, p.x, p.y, p.size, p.size);
    }
    c.restore();
  }
  hud(c, game, w, h) {
    const a = game.assault;
    label(c, a.phase === 'turn' ? 'NEW HEADING / OFFSHORE' : a.sectionName, 12, 18, 10, '#dce9dc');
    for (let i = 0; i < 6; i++) box(c, i < a.health ? '#addbbb' : '#344b4e', 12 + i * 11, 25, 8, 4);
    label(c, a.carrier ? 'FRIENDLY / WEAPONS SAFE' : `CANNON ${'I'.repeat(a.power)} / AUTO`, 12, 42, 8, '#e6c78c');
    label(c, String(game.score).padStart(6, '0'), w - 12, 18, 13, '#f1eac7', 'right');
    const total = AIR_ROUTE.reduce((sum, route) => sum + route.seconds * 50, 0);
    const progress = a.carrier ? 1 : (AIR_ROUTE.slice(0, a.route).reduce((sum, route) => sum + route.seconds * 50, 0) + a.routeAge) / total;
    box(c, '#20373f', w - 110, 28, 98, 2); box(c, '#b9d1af', w - 110, 28, progress * 98, 2);
    label(c, 'CARRIER', w - 12, 41, 7, '#b7d5cc', 'right');
    if (a.phase === 'flight' && a.routeAge < 150) {
      c.globalAlpha = clamp((150 - a.routeAge) / 35);
      label(c, a.route === 0 ? 'ARROWS FLY  /  CANNON AUTO' : 'CHECKPOINT REACHED', w / 2, h - 18, 8, '#f0dfaf', 'center'); c.globalAlpha = 1;
    }
    if (a.phase === 'carrier') label(c, 'OBJECTIVE REACHED / CLEARED TO LAND', w / 2, h * .62, w < 400 ? 9 : 12, '#e7f4ce', 'center');
    if (a.phase === 'airship' && a.age < 110) label(c, 'WARNING / IRON VULTURE', w / 2, h * .56, 15, '#ffc58c', 'center');
    if (a.phase === 'airship-down') label(c, 'AIRSHIP DOWN / CARRIER AHEAD', w / 2, h * .65, 12, '#e8efd6', 'center');
    if (a.dead) {
      box(c, 'rgba(12,25,34,.6)', 0, 0, w, h);
      label(c, 'GUNSHIP DOWN', w / 2, h * .40, 22, '#f1d1b5', 'center');
      label(c, a.checkpoint.label, w / 2, h * .40 + 23, 10, '#dde3d9', 'center');
      if (a.age >= 30) label(c, 'RESTARTING CHECKPOINT…', w / 2, h * .40 + 52, 11, '#fff0ca', 'center');
    }
  }
}

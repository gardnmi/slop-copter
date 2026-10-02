import { terrainProfile } from './air-world.js';

const CHUNK = 224;
const hash = n => { let x = Math.floor(n) | 0; x = Math.imul(x ^ x >>> 16, 0x45d9f3b); x = Math.imul(x ^ x >>> 16, 0x45d9f3b); return ((x ^ x >>> 16) >>> 0) / 4294967296; };
const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
function stroke(c, color, points, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(Math.round(x), Math.round(y)) : c.moveTo(Math.round(x), Math.round(y))); c.stroke();
}
export function cloudlet(c, color, x, y, radius, seed = 0) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = radius * (.83 + hash(seed + i * 91) * .3);
    const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * .8);
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath(); c.fill();
}

// Original pixel scenery viewed straight down, with one continuous road network.
// Cache static chunks; animate only the localized fire, embers and smoke.
export class CityArt {
  constructor() { this.chunks = new Map(); this.width = 0; }
  async load() {
    const atlas = new Image(); atlas.src = `${import.meta.env.BASE_URL}assets/overhead-rooftops.png`; await atlas.decode();
    this.rooftops = Array.from({ length: 16 }, (_, i) => {
      const size = atlas.width / 4, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const c = canvas.getContext('2d'); c.drawImage(atlas, (i % 4) * size, Math.floor(i / 4) * size, size, size, 0, 0, size, size);
      const data = c.getImageData(0, 0, size, size).data;
      let left = size, right = 0, top = size, bottom = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[(y * size + x) * 4 + 3] > 120) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { image: canvas, x: left, y: top, w: right - left + 1, h: bottom - top + 1, id: i };
    });
    this.chunks.clear();
  }
  chunk(index, w) {
    if (this.width !== w) { this.chunks.clear(); this.width = w; }
    if (this.chunks.has(index)) return this.chunks.get(index);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = CHUNK;
    const c = canvas.getContext('2d'), start = index * CHUNK, fires = [];
    for (let y = 0; y < CHUNK; y += 4) {
      const distance = start + CHUNK - y, p = terrainProfile(distance, w);
      rect(c, '#303e43', 0, y, w, 4);
      if (p.harbor > 0) {
        const coast = p.shore + Math.sin(distance / 65) * 6 * p.sea;
        rect(c, '#173643', coast, y, w - coast * 2, 4);
        if (coast > 2) for (const x of [coast - 3, w - coast]) {
          rect(c, '#697b7a', x, y, 2, 4); rect(c, '#23383d', x - 3, y, 3, 4);
        }
      }
      const crossing = p.highway < .65 && p.harbor === 0 && (y < 8 || y >= CHUNK - 8);
      if (crossing) {
        rect(c, '#1e2a31', 0, y, w, 4);
        if (y === 4 || y === CHUNK - 8) rect(c, '#4e5c60', 0, y, w, 1);
      }
      if (p.sea < .98) {
        for (const x of p.lanes) {
          const width = p.roadWidth * (1 - p.harbor) + Math.max(24, w * .075) * p.harbor;
          if (p.sea > 0 && x > p.shore && x < w - p.shore) continue;
          rect(c, '#424d51', x - width / 2 - 4, y, width + 8, 4);
          rect(c, '#1e2a31', x - width / 2, y, width, 4);
          rect(c, '#657275', x - width / 2 + 2, y, 1, 4);
          rect(c, '#657275', x + width / 2 - 3, y, 1, 4);
          if (Math.floor(distance / 4) % 9 < 4) rect(c, '#8a8b73', x, y, 1, 4);
          if (p.highway > .7 && p.harbor < .4) for (const side of [-1, 1]) {
            if (Math.floor(distance / 4) % 8 < 3) rect(c, '#5c6869', x + side * width / 4, y, 1, 4);
          }
        }
        if (p.harbor < .15) {
          rect(c, '#253236', p.rail - 10, y, 20, 4);
          if (Math.floor(distance / 4) % 2 === 0) rect(c, '#566061', p.rail - 8, y, 16, 2);
          rect(c, '#77807c', p.rail - 6, y, 1, 4); rect(c, '#77807c', p.rail + 6, y, 1, 4);
        }
      }
    }
    for (let i = 0; i < w * 1.5; i++) {
      const seed = index * 7919 + i * 31, x = hash(seed) * w, y = hash(seed + 4) * CHUNK;
      const p = terrainProfile(start + CHUNK - y, w);
      if (p.harbor > 0 && x > p.shore && x < w - p.shore) {
        if (i % 4 === 0) rect(c, '#254653', x, y, 3 + hash(seed + 1) * 8, 1);
      } else rect(c, i % 3 ? '#344247' : '#3b484c', x, y, 1 + hash(seed + 2) * 3, 1);
    }
    for (let row = 0; row < 2; row++) {
      const y = row * 104 + 15, distance = start + CHUNK - y - 43, p = terrainProfile(distance, w);
      if (p.sea > .25) continue;
      const half = (p.roadWidth * (1 - p.harbor) + Math.max(24, w * .075) * p.harbor) / 2 + 9;
      const spans = p.harbor < .25
        ? [[8, p.lanes[0] - half], [p.lanes[0] + half, p.lanes[1] - half], [p.lanes[1] + half, p.rail - 17], [p.rail + 17, w - 8]]
        : [[8, p.lanes[0] - half], [p.lanes[0] + half, p.shore - 8], [w - p.shore + 8, p.lanes[1] - half], [p.lanes[1] + half, w - 8]];
      for (const [col, span] of spans.entries()) {
        // Keep land structures clear of the opening harbor channel.
        if (p.harbor > 0) {
          if (span[0] < w / 2) span[1] = Math.min(span[1], p.shore - 7);
          else span[0] = Math.max(span[0], w - p.shore + 7);
        }
        const available = span[1] - span[0], count = Math.max(1, Math.floor(available / 112));
        for (let n = 0; n < count; n++) {
          const seed = index * 1237 + row * 291 + col * 71 + n * 19, cell = available / count;
          if (cell < 22) continue;
          const bw = Math.min(128, cell - 8) * (.83 + hash(seed + 2) * .17), bh = 66 + hash(seed + 5) * 20;
          const x = span[0] + n * cell + 3 + (cell - bw - 6) * hash(seed + 8), yy = y + hash(seed + 3) * 8;
          if (p.highway > .8 && p.harbor < .2 && hash(seed) < .3) { this.yard(c, x, yy, bw, bh, seed); continue; }
          if (p.harbor > .25) this.containers(c, x, yy, bw, bh, seed);
          else this.building(c, x, yy, bw, bh, seed, fires);
        }
      }
    }
    const result = { canvas, fires, start }; this.chunks.set(index, result); return result;
  }
  building(c, x, y, w, h, seed, fires) {
    const sprite = this.rooftops[Math.floor(hash(seed + 11) * this.rooftops.length)];
    const scale = Math.min(w / sprite.w, h / sprite.h), bw = Math.round(sprite.w * scale), bh = Math.round(sprite.h * scale);
    const bx = Math.round(x + (w - bw) / 2), by = Math.round(y + (h - bh) / 2);
    // Paved apron, drains and restrained texture connect the illustrated roof to
    // the code-owned streets without introducing another perspective.
    rect(c, '#38464a', bx - 3, by - 3, bw + 6, bh + 6);
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.filter = 'brightness(0) opacity(.24)';
    c.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h, bx + 3, by + 4, bw, bh);
    c.filter = 'saturate(.65) brightness(.82)';
    c.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h, bx, by, bw, bh); c.restore();
    for (let i = 0; i < 12; i++) {
      const xx = bx + hash(seed + i * 31) * bw, yy = by + bh + hash(seed + i * 59) * 4;
      rect(c, i % 2 ? '#505855' : '#444d4d', xx, yy, 1 + i % 2, 1);
    }
    // Source-specific damaged areas keep flames in exposed structures.
    const damage = { 0: [.22, .69], 2: [.79, .60], 4: [.6, .69], 5: [.68, .14], 6: [.16, .68], 7: [.55, .55],
      9: [.73, .44], 10: [.46, .55], 11: [.37, .79], 12: [.65, .53], 13: [.48, .54], 14: [.49, .62] }[sprite.id];
    if (damage && hash(seed + 9) > .34) fires.push({ x: bx + bw * damage[0], y: by + bh * damage[1], radius: Math.max(4, Math.min(bw, bh) * .1), seed });
  }
  yard(c, x, y, w, h, seed) {
    rect(c, '#29373d', x, y, w, h);
    for (let yy = y + 5; yy < y + h - 5; yy += 12) {
      stroke(c, '#596466', [[x + 2, yy], [x + w - 3, yy]]);
      if (hash(seed + yy) > .4) { rect(c, '#464f4c', x + 7, yy + 3, 14, 7); rect(c, '#283940', x + 11, yy + 4, 5, 4); }
    }
  }
  containers(c, x, y, w, h, seed) {
    rect(c, '#465153', x, y, w, h);
    for (let xx = x + 4; xx < x + w - 12; xx += 19) for (let yy = y + 4; yy < y + h - 22; yy += 29) {
      rect(c, '#26393e', xx + 3, yy + 3, 14, 24);
      rect(c, ['#735347', '#526a70', '#727363'][Math.floor(hash(seed + xx + yy) * 3)], xx, yy, 14, 24);
      rect(c, '#909080', xx, yy, 14, 1);
      for (let k = 3; k < 23; k += 4) rect(c, '#35474b', xx + 2, yy + k, 10, 1);
    }
  }
  fire(c, x, y, r, seed, time, reduced = false) {
    const t = reduced ? 0 : time;
    c.save();
    const glow = c.createRadialGradient(x, y, 0, x, y, r * 3.5);
    glow.addColorStop(0, '#ef793d55'); glow.addColorStop(1, '#ef793d00');
    c.fillStyle = glow; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    for (let i = 0; i < 5; i++) {
      const phase = (t * .8 + hash(seed + i * 29)) % 1;
      const xx = x + Math.sin(i * 2.4 + t * 3) * r * .55, yy = y + Math.cos(i * 3.1) * r * .4;
      const size = r * (.5 + .3 * Math.sin(t * 11 + i * 2));
      cloudlet(c, '#9c432b', xx, yy, size + 2, seed + i);
      cloudlet(c, '#ef8e3f', xx, yy - 1, size, seed + i);
      cloudlet(c, '#ffe5a0', xx, yy - 2, size * .46, seed + i);
      c.globalAlpha = .48 * (1 - phase);
      cloudlet(c, i % 2 ? '#586064' : '#283238', x - phase * 17 + Math.sin(i) * r, y - phase * 24, r * (.8 + phase), seed + i);
      c.globalAlpha = 1;
      rect(c, '#ffd191', x + Math.sin(i * 3 + t) * r * 1.4 - phase * 9, y - phase * 25, 1, 2);
    }
    c.restore();
  }
  draw(c, a, w, h, reduced) {
    const first = Math.floor((a.scroll - h - 60) / CHUNK), last = Math.floor((a.scroll + 60) / CHUNK);
    // Draw all tiles before smoke, which can extend beyond its source tile.
    const visible = [];
    for (let index = first; index <= last; index++) {
      const chunk = this.chunk(index, w), y = Math.round(a.scroll - chunk.start - CHUNK);
      c.drawImage(chunk.canvas, 0, y); visible.push({ ...chunk, y });
    }
    for (const tile of visible) for (const f of tile.fires) this.fire(c, f.x, tile.y + f.y, f.radius, f.seed, a.time, reduced);
    for (const index of this.chunks.keys()) if (index < first - 2 || index > last + 2) this.chunks.delete(index);
  }
}

import { hitSprite } from './hit-flash.js';

// Original generated carrier kit; tight source rectangles preserve real alpha.
// Native sizes are in world pixels, matching the commando's sprite grid.
export const SCENERY_RECTS = {
  vent: [20, 66, 297, 309], door: [327, 62, 299, 313],
  pipes: [637, 66, 292, 309], service: [940, 65, 298, 310],
  catwalk: [14, 561, 326, 120], rail: [353, 561, 359, 116],
  column: [749, 401, 53, 289], brace: [929, 401, 293, 286],
  crate: [64, 786, 180, 180], barrel: [363, 769, 129, 201],
  medkit: [560, 798, 194, 168], cargo: [798, 802, 428, 158],
  deck: [14, 1104, 546, 106], cap: [601, 1022, 94, 195],
  lamp: [760, 1020, 142, 199], emitter: [947, 1024, 279, 185],
};

// Prepare once, then draw 1:1. The 15-bit color steps and opaque edge pixels
// avoid mixing soft high-resolution assets with the native arcade characters.
export function deckPixels(image, rect, width, height, depth = false) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d'); c.imageSmoothingQuality = 'high';
  c.drawImage(image, ...rect, 0, 0, width, height);
  const pixels = c.getImageData(0, 0, width, height), d = pixels.data;
  const gain = depth === 'wall' ? .65 : depth ? .84 : 1.08, saturation = depth ? .75 : .94;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    const light = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(248, Math.round((light + (d[i + k] - light) * saturation) * gain / 8) * 8);
  }
  c.putImageData(pixels, 0, 0); return canvas;
}

export class DeckScenery {
  constructor() { this.cache = new Map(); this.aircraft = new WeakMap(); }
  async load() {
    this.atlas = new Image(); this.atlas.src = `${import.meta.env.BASE_URL}assets/carrier-scenery-atlas.png`;
    await this.atlas.decode();
  }
  sprite(name, w, h, depth = false) {
    const key = `${name}:${w}:${h}:${depth}`;
    if (!this.cache.has(key)) this.cache.set(key, deckPixels(this.atlas, SCENERY_RECTS[name], w, h, depth));
    return this.cache.get(key);
  }
  draw(c, name, x, y, w, h, depth = false) {
    c.drawImage(this.sprite(name, w, h, depth), Math.round(x), Math.round(y));
  }
  // Tile at the same pixel density; clip the last repeat instead of stretching.
  strip(c, name, x, y, w, h, tileW, tileH, depth = false) {
    c.save(); c.beginPath(); c.rect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); c.clip();
    const tile = this.sprite(name, tileW, tileH, depth);
    for (let yy = 0; yy < h; yy += tileH) for (let xx = 0; xx < w; xx += tileW) c.drawImage(tile, Math.round(x + xx), Math.round(y + yy));
    c.restore();
  }
  aircraftSprite(c, source, x, y, width, hit = false, reduced = false) {
    let sizes = this.aircraft.get(source);
    if (!sizes) { sizes = new Map(); this.aircraft.set(source, sizes); }
    if (!sizes.has(width)) sizes.set(width, deckPixels(source, [0, 0, source.width, source.height], width, Math.round(width * source.height / source.width)));
    const body = sizes.get(width);
    c.drawImage(hit ? hitSprite(body, reduced) : body, Math.round(x - body.width / 2), Math.round(y - body.height / 2));
  }
  prop(c, p) {
    if (p.dead) {
      const image = this.sprite(p.type, p.w, p.h);
      c.save(); c.globalAlpha = .8;
      c.drawImage(image, 0, image.height - 6, image.width, 6, Math.round(p.x), Math.round(p.y + p.h - 5), p.w, 5);
      c.restore(); return;
    }
    this.draw(c, p.type, p.x, p.y, p.w, p.h);
  }
}

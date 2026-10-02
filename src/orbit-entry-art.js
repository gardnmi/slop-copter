import { wellEntryView } from './orbit-entry.js';

const thresholds = [55, 130, 170, 90];
// A gradual three-ink treatment of the existing shaft and actor, not a new
// backdrop flashed over them. Work on a small buffer, then use nearest pixels.
function reducePalette(canvas, amount) {
  if (amount <= 0) return;
  const c = canvas.getContext('2d'), image = c.getImageData(0, 0, canvas.width, canvas.height), p = image.data;
  for (let y = 0, i = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++, i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2], l = r * .3 + g * .59 + b * .11;
    const red = r > 100 && r > g * 1.65 && r > b * 1.8;
    const white = l > thresholds[(x & 1) + (y & 1) * 2] ? 255 : 0;
    p[i] += ((red ? 255 : white) - r) * amount;
    p[i + 1] += ((red ? 0 : white) - g) * amount;
    p[i + 2] += ((red ? 0 : white) - b) * amount;
  }
  c.putImageData(image, 0, 0);
}

export class OrbitEntryArt {
  constructor() {
    this.deck = document.createElement('canvas'); this.actor = document.createElement('canvas');
    this.actor.width = 96; this.actor.height = 96;
  }
  draw(c, game, renderer, well, reduced, w, h) {
    const o = game.orbit, d = game.boarding, pose = wellEntryView(o, d, w, h);
    // The well is already scrolling at the same fall speed under the ship art.
    // Its first hazards are below the entire transition, giving control first.
    well.well(c, game, renderer, reduced, w, h, { hideActor: true, hudAlpha: pose.hud, cameraY: o.y - pose.screenY });
    if (pose.blend < 1) {
      // Keep the opening at the same pixel density as the live deck view.
      const dw = w, dh = h;
      if (this.deck.width !== dw || this.deck.height !== dh) { this.deck.width = dw; this.deck.height = dh; }
      const view = Object.assign(Object.create(d), {
        width: w / pose.zoom, height: h / pose.zoom, cameraX: pose.cameraX,
        cameraFloor: pose.cameraY + h / pose.zoom * .73,
      });
      renderer.airArt.deck.draw(this.deck.getContext('2d'), game, renderer.airArt, renderer, reduced,
        { view, hideActor: true, hideHud: true });
      reducePalette(this.deck, pose.palette);
      c.save(); c.globalAlpha = 1 - pose.blend;
      c.drawImage(this.deck, 0, 0, w, h); c.restore();
    }
    // Both bodies share one moving feet anchor. Keep the bandana visible as the
    // detailed commando becomes the small, white well sprite during the fall.
    if (pose.morph < 1) {
      const ac = this.actor.getContext('2d'); ac.clearRect(0, 0, 96, 96);
      renderer.airArt.deck.actors.commando(ac, { ...d, x: 48, y: 72, grounded: false,
        crouching: false, aimUp: false, fireHeld: false, hurt: 0, flash: 0, throwFlash: 0 }, reduced);
      reducePalette(this.actor, pose.palette);
      const size = pose.zoom + (.75 - pose.zoom) * pose.morph;
      c.save(); c.globalAlpha = 1 - pose.morph;
      c.drawImage(this.actor, Math.round(pose.x - 48 * size), Math.round(pose.screenY - 72 * size), 96 * size, 96 * size); c.restore();
    }
    if (pose.morph > 0) {
      c.save(); c.globalAlpha = pose.morph;
      well.actor(c, renderer.airArt.deck.actors, pose.x, pose.screenY, o, reduced); c.restore();
    }
  }
}

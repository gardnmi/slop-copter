// Original generated body/commando artwork, with independently animated rotors.
// All coordinates are relative to the boarding rail; rendering and grab physics
// share that anchor, so the hands cannot float away from the helicopter.
const SCALE = 192 / 1774;
const HERO_SCALE = .05;
export const RESCUE_FRAMES = [
  // Full alpha bounds on the actual 2172 × 724 sheet, including boots and
  // bandana tails. Earlier rectangles were measured on a downscaled preview.
  { rect: [91, 123, 432, 499], hand: [365, 25] },
  { rect: [718, 126, 299, 547], hand: [224, 20] },
  { rect: [1164, 126, 443, 456], hand: [234, 20] },
  { rect: [1693, 126, 364, 502], hand: [306, 20] },
];
const box = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

export class RescueArt {
  async load() {
    const body = new Image(), hero = new Image();
    body.src = `${import.meta.env.BASE_URL}assets/rescue-copter.png`;
    hero.src = `${import.meta.env.BASE_URL}assets/rescue-commando-atlas.png`;
    await Promise.all([body.decode(), hero.decode()]);
    this.body = this.sample(body, [0, 0, body.width, body.height], SCALE);
    this.frames = RESCUE_FRAMES.map(frame => ({ image: this.sample(hero, frame.rect, HERO_SCALE), hand: frame.hand.map(n => Math.round(n * HERO_SCALE)) }));
  }
  sample(source, [x, y, w, h], scale) {
    const image = document.createElement('canvas'); image.width = Math.round(w * scale); image.height = Math.round(h * scale);
    const c = image.getContext('2d'); c.imageSmoothingQuality = 'high';
    c.drawImage(source, x, y, w, h, 0, 0, image.width, image.height);
    return image;
  }
  man(c, frame, x, y) {
    const sprite = this.frames[frame];
    c.drawImage(sprite.image, Math.round(x - sprite.hand[0]), Math.round(y - sprite.hand[1]));
  }
  draw(c, r, reduced) {
    const h = r.rescue;
    if (!h) return;
    const x = Math.round(h.x - r.cameraX), y = Math.round(h.y - r.cameraY);
    const attached = r.phase === 'lifting' || r.phase === 'escaped';
    c.save(); c.translate(x, y);
    // Pitch about the rail (not the body center) keeps the grip consistent.
    const pitch = r.phase === 'lifting' ? -.04 * Math.min(1, r.age / 100) : 0;
    c.rotate(pitch);
    const rotorX = (1105 - 995) * SCALE, rotorY = (300 - 744) * SCALE;
    const beat = reduced ? 0 : Math.floor(r.time * 50) % 3;
    const span = [93, 62, 82][beat];
    box(c, '#33363b', rotorX - span, rotorY - 1, span * 2, 2);
    box(c, '#c1c5c1', rotorX - span + 2, rotorY - 1, span - 6, 1);
    box(c, '#8b9191', rotorX + 4, rotorY + 1, span - 4, 1);
    // Main rotor goes behind the raised radar dome.
    c.drawImage(this.body, Math.round(-995 * SCALE), Math.round(-744 * SCALE));
    const tx = (182 - 995) * SCALE, ty = (350 - 744) * SCALE;
    c.save(); c.translate(tx, ty); c.rotate(beat * Math.PI / 3);
    box(c, '#303638', -10, -1, 20, 2); box(c, '#b8bcb7', -9, -1, 6, 1);
    box(c, '#5f6866', -1, -10, 2, 20); box(c, '#c1c4b7', -1, -9, 1, 5); c.restore();
    // Amber pickup light marks the actual long rail, not an arbitrary hitbox.
    const ready = h.stage === 'boarding' && r.phase === 'rescue';
    if (ready) {
      c.globalAlpha = reduced ? .8 : .65 + Math.sin(r.time * 6) * .25;
      box(c, '#ffd997', -16, 0, 31, 1); c.globalAlpha = 1;
    }
    c.restore();
    if (ready && !reduced) {
      // Rotor wash rakes the roof with quiet streaks behind the player.
      for (let i = 0; i < 4; i++) {
        const drift = (r.time * 85 + i * 19) % 70;
        box(c, '#b9bdc2', x - 42 + drift, h.floor - r.cameraY - 1 - i % 2, 8, 1);
      }
    }
    if (attached) {
      const frame = r.phase === 'escaped' || r.age > 100 ? 3 : reduced ? 1 : Math.floor(r.age / 18) % 2 + 1;
      // Match the rotation of the gripping point on the boarding rail.
      const grip = h.grip + 6;
      this.man(c, frame, x + grip * Math.cos(pitch), y + grip * Math.sin(pitch));
    }
  }
}

import { loadDeckReferenceArt } from './deck-reference-art.js';
import { currentWeapon } from './deck-weapons.js';
import { hitSprite } from './hit-flash.js';
import { commandoFrame } from './deck-commando.js';
import { CLOTH_FRAMES, CLOTH_KNOTS } from './action-assets.js';
import { commandoPose } from './deck-pose.js';
import { ParatrooperArt } from './paratrooper-art.js';

// Native-resolution sprite frames: no resampling or stretched crouch poses.
// The independent torso and legs let the gun recoil without resetting a stride.
// Sheets and source animation maps are credited in assets/reference/README.md.
export class MetalSlugArt {
  async load() {
    this.paratroopers = new ParatrooperArt(); const parachutes = this.paratroopers.load();
    const [rossi, marco, rebel, blast, armor, heavy, bigBlast] = await Promise.all(['rossi', 'marco', 'rebel', 'explosion', 'armor', 'heavy', 'big-explosion'].map(async name => {
      const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/reference/metal-slug-${name}.png`;
      await image.decode(); return image;
    }));
    this.legs = this.row(rossi, 0, 0, 34, 48, 23, [17, 48]);
    this.jump = this.row(rossi, 0, 49, 34, 48, 16, [17, 48]);
    this.idle = this.row(rossi, 0, 156, 40, 30, 4, [15, 43]);
    this.fire = this.row(rossi, 0, 186, 120, 30, 5, [66, 43]);
    this.up = this.row(rossi, 6, 385, 24, 72, 4, [11, 84]);
    // The reference's up row contains firing poses only. Crop below the muzzle
    // for the held aim, so lifting the gun does not conjure a permanent flame.
    this.upIdle = this.frame(rossi, [78, 409, 24, 48], [11, 60]);
    // Register the belt, not the edge of the crop. Even the four resting cells
    // lift the entire torso by different amounts. A shared anchor left an open
    // waist on two frames; one pixel of overlap keeps the belt on the trousers.
    this.idle.forEach((f, i) => { f.anchor = [[15, 42], [15, 41], [15, 40], [15, 40]][i]; });
    this.fire.forEach((f, i) => { f.anchor = [[61, 41], [65, 42], [57, 42], [63, 41], [63, 41]][i]; });
    this.up.forEach((f, i) => { f.anchor = [[13, 85], [14, 85], [15, 84], [14, 84]][i]; });
    this.upIdle.anchor = [14, 60];
    this.pistolIdle = this.row(rossi, 0, 96, 34, 30, 4, [15, 39]);
    // The lowered pistol and hand extend below the actual belt. Register the
    // belt to the hip socket; the heavy-gun anchors leave a visible waist gap.
    this.pistolIdle.forEach((f, i) => { f.anchor = [[15,39],[15,39],[14,39],[13,39]][i]; });
    this.pistolFire = this.row(rossi, 480, 126, 120, 30, 6, [66,39]);
    this.pistolFire.forEach((f, i) => { f.anchor = [[66,39],[67,39],[65,39],[64,39],[64,41],[63,40]][i]; });
    // The rearranged ROSSI up row overlaps an unrelated horizontal pose.
    // Use the clean original cells, including their actual vertical flashes.
    this.pistolUp = [[143,17,26,67],[169,17,26,67],[195,17,26,67]]
      .map((rect,i) => this.frame(marco,rect,[i===2?12:13,80]));
    this.pistolUpIdle = this.frame(marco, [304,41,28,43], [14,56]);
    this.death = this.row(rossi, 0, 216, 40, 41, 17, [20, 41]);
    // Whole-body kneeling and stabbing poses from the original reference sheet.
    // Use the settled kneeling pose, not the transition down into the crouch.
    this.crouch = [[303, 866, 42, 31], [348, 866, 63, 31], [414, 866, 65, 31], [482, 866, 61, 31]]
      .map(rect => this.frame(marco, rect, [12, 31]));
    this.knife = [[13, 274, 42, 35], [58, 274, 42, 35], [103, 274, 35, 35]]
      .map(rect => this.frame(marco, rect, [16, 35]));
    for (const name of ['legs', 'jump']) this[name] = this[name].map(f => commandoFrame(f, [0, 0, 0, 0]));
    this.idle = this.idle.map(f => commandoFrame(f, [5, 0, 22, 14]));
    this.fire = this.fire.map(f => commandoFrame(f, [48, 0, 30, 14], true, [0,0,f.anchor[0]+27,30]));
    this.up = this.up.map(f => commandoFrame(f, [0, 47, 15, 12], true, [0,25,24,47]));
    this.upIdle = commandoFrame(this.upIdle, [0, 23, 15, 12]);
    this.crouch = this.crouch.map(f => commandoFrame(f, [0, 0, 28, 17], true, [0,0,42,31]));
    this.knife = this.knife.map(f => commandoFrame(f, [10, 7, 22, 12]));
    this.pistolIdle = this.pistolIdle.map(f => commandoFrame(f, [6,0,24,15]));
    this.pistolFire = this.pistolFire.map(f => commandoFrame(f, [52,0,29,15], true, [0,0,88,30]));
    this.pistolUp = this.pistolUp.map(f => commandoFrame(f, [0,35,26,22], true, [0,25,26,42]));
    this.pistolUpIdle = commandoFrame(this.pistolUpIdle, [0,13,28,20]);
    this.death = this.death.map((f, i) => commandoFrame(f, undefined, i < 13));
    const gunner = new Image(); gunner.src = `${import.meta.env.BASE_URL}assets/gunner-atlas.png`; await gunner.decode();
    this.cloth = CLOTH_FRAMES.map((rect, i) => {
      const scale = 15 / rect[2], sprite = document.createElement('canvas');
      sprite.width = 15; sprite.height = Math.round(rect[3] * scale);
      const c = sprite.getContext('2d'); c.imageSmoothingQuality = 'high';
      c.drawImage(gunner, ...rect, 0, 0, sprite.width, sprite.height);
      return { sprite, anchor: CLOTH_KNOTS[i].map(v => Math.round(v * scale)) };
    });
    this.rebelRun = this.row(rebel, 0, 0, 35, 42, 12, [18, 42]);
    this.rebelIdle = this.row(rebel, 0, 42, 35, 42, 12, [18, 42]);
    this.rebelFire = this.row(rebel, 0, 126, 57, 45, 9, [40, 45]);
    this.rebelDeath = this.row(rebel, 0, 171, 51, 48, 13, [26, 48]);
    this.rebelThrow = this.row(rebel, 0, 84, 52, 42, 14, [33, 42]);
    this.blast = this.row(blast, 0, 0, 48, 48, 27, [24, 24]);
    this.bigBlast = this.row(bigBlast, 0, 0, 80, 80, 28, [40, 40]);
    const keyed = this.keyBackground(armor);
    this.armorBody = this.frame(keyed, [8, 20, 64, 32], [32, 32]);
    this.armorGun = this.frame(keyed, [8, 439, 55, 27], [40, 45]);
    this.heavy = this.frame(heavy, [0, 0, heavy.width, heavy.height], [heavy.width / 2, heavy.height / 2]);
    await Promise.all([parachutes, loadDeckReferenceArt(this)]);
  }
  keyBackground(image) {
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const c = canvas.getContext('2d'); c.drawImage(image, 0, 0);
    const pixels = c.getImageData(0, 0, canvas.width, canvas.height), d = pixels.data, key = [...d.slice(0, 3)];
    for (let i = 0; i < d.length; i += 4) if (key.every((v, k) => d[i + k] === v)) d[i + 3] = 0;
    c.putImageData(pixels, 0, 0); return canvas;
  }
  row(image, x, y, w, h, count, anchor) {
    return Array.from({ length: count }, (_, i) => this.frame(image, [x + i * w, y, w, h], anchor));
  }
  frame(image, rect, anchor) {
    const sprite = document.createElement('canvas'); sprite.width = rect[2]; sprite.height = rect[3];
    sprite.getContext('2d').drawImage(image, ...rect, 0, 0, sprite.width, sprite.height);
    return { sprite, anchor };
  }
  draw(c, frame, hit = false, reduced = false) {
    const { sprite, anchor } = frame;
    c.drawImage(hit ? hitSprite(sprite, reduced, 'slug') : sprite, -anchor[0], -anchor[1]);
  }
  commando(c, d, reduced) {
    // The native sprite contains both hands AND the gun. Recoil shares its belt anchor.
    const flash = d.flash;
    const pistol = (flash ? d.firedWeapon || currentWeapon(d) : currentWeapon(d)) === 'pistol';
    c.save(); c.translate(Math.round(d.x), Math.round(d.y)); c.scale(d.facing, 1);
    if (d.hurt && Math.floor(d.age / 4) % 2) c.globalAlpha = .7;
    if (d.dead) this.drawCommando(c, this.death[Math.min(16, Math.floor(d.age / 3))], d, reduced);
    else if (d.slash) this.drawCommando(c, this.knife[Math.min(2, Math.floor((9 - d.slash) / 3))], d, reduced);
    else if (d.crouching) {
      if (pistol) {
        // Native kneeling legs and native pistol torso share the same belt.
        c.save(); c.beginPath(); c.rect(-24, -14, 60, 14); c.clip(); this.draw(c, this.crouch[0]); c.restore();
        c.translate(0, 13);
        this.drawCommando(c, flash ? this.pistolFire[3 - flash] : this.pistolFire[3], d, reduced);
      } else this.drawCommando(c, this.crouch[flash ? Math.min(3, 4 - flash) : 0], d, reduced);
    }
    else {
      const pose = commandoPose(d);
      this.draw(c, this[pose.sheet][pose.index]);
      c.translate(...pose.hip);
      if (pistol) this.drawCommando(c, d.aimUp ? flash ? this.pistolUp[3 - flash] : this.pistolUpIdle
        : flash ? this.pistolFire[3 - flash] : d.fireHeld || d.shotClock > 0 ? this.pistolFire[3] : this.pistolIdle[Math.floor(d.time * 7) % 4], d, reduced);
      else this.drawCommando(c, d.aimUp ? flash ? this.up[(3 - flash) % 4] : this.upIdle
        : flash ? this.fire[Math.min(4, 4 - flash)] : this.idle[Math.floor(d.time * 7) % 4], d, reduced);
    }
    c.restore();
  }
  drawCommando(c, frame, d, reduced) {
    if (frame.clothKnot) {
      const beat = reduced || d.dead ? 0 : Math.floor(d.time * (d.vx ? 10 : 7));
      c.save(); c.translate(...frame.clothKnot);
      // Both original cloth ends travel with the head and mirror with the body.
      if (d.dead && d.age >= 39) c.rotate(-Math.PI / 2);
      this.draw(c, this.cloth[[0, 1, 2, 1][beat % 4]]); c.restore();
    }
    this.draw(c, frame);
  }
  soldier(c, e, reduced) {
    if (e.paratrooper && !e.dead || e.airDeath && !e.burning) { this.paratroopers.soldier(c, e, this, reduced); return; }
    c.save(); c.translate(Math.round(e.x), Math.round(e.y)); c.scale(-e.facing, 1);
    if (e.dead && e.burning) {
      const frames = e.deathAge < 32 ? this.rebelBurn : this.rebelBurnFall;
      const index = e.deathAge < 32 ? Math.floor(e.deathAge / 4) : Math.min(13, Math.floor((e.deathAge - 32) / 4));
      c.globalAlpha = Math.min(1, (100 - e.deathAge) / 12);
      this.draw(c, frames[index]);
    } else if (e.dead) {
      c.globalAlpha = Math.min(1, (48 - e.deathAge) / 8);
      this.draw(c, this.rebelDeath[Math.min(12, Math.floor(e.deathAge / 3.5))]);
    } else {
      const firing = e.flash > 0, throwing = e.type === 'grenadier' && (e.state === 'aim' || firing);
      const frame = throwing ? this.rebelThrow[firing ? 10 : Math.min(8, Math.floor((22 - e.clock) / 3))]
        : firing ? this.rebelFire[5 + Math.min(3, 5 - e.flash)]
        : e.state === 'aim' || e.state === 'burst' ? this.rebelFire[3]
        : e.walking ? this.rebelRun[Math.floor(e.age / 3) % 12] : this.rebelIdle[Math.floor(e.age / 7) % 4];
      this.draw(c, frame, e.hit > 0, reduced);
    }
    c.restore();
  }
  explosion(c, effect, reduced) {
    c.save(); c.translate(Math.round(effect.x), Math.round(effect.y));
    const large = effect.size >= 1.5, scale = large ? effect.size / 2 : effect.size || 1;
    c.scale(scale, scale);
    c.globalAlpha = Math.min(1, (42 - effect.age) / 8);
    const frames = large ? this.bigBlast : this.blast;
    this.draw(c, frames[Math.min(frames.length - 1, Math.max(reduced ? 4 : 0, Math.floor(effect.age * .65)))]); c.restore();
  }
  emplacement(c, e, reduced) {
    c.save(); c.translate(Math.round(e.x), Math.round(e.y)); c.scale(-e.facing, 1);
    if (e.dead) c.filter = 'brightness(.5) saturate(.25)';
    this.draw(c, this.armorBody, e.hit > 0 && !e.dead, reduced);
    if (!e.dead) {
      c.translate(e.flash ? 1 : 0, 0); this.draw(c, this.armorGun, e.hit > 0, reduced);
      if (e.flash) { c.fillStyle = '#fff0b8'; c.fillRect(-45, -34, 6, 3); }
    }
    c.restore();
  }
}

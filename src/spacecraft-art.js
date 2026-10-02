import { loadSpacecraftRig } from './spacecraft-rig-art.js';
import { deckPixels } from './deck-scenery.js';
import { hitSprite } from './hit-flash.js';
import { spacecraftCannon, spacecraftMotion } from './spacecraft-motion.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const loopIndex = (tick, length) => ((tick % length) + length) % length;
const cut = (source, x, y, w, h) => {
  const result = canvas(w, h); result.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h); return result;
};
const tint = (source, color) => {
  const result = cut(source, 0, 0, source.width, source.height), c = result.getContext('2d');
  const pixels = c.getImageData(0, 0, result.width, result.height), d = pixels.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) d.set(color(d[i], d[i + 1], d[i + 2]), i);
  c.putImageData(pixels, 0, 0); return result;
};

// A modular ship at the level's native pixel density. The intact hull occludes
// retracting gear and weapons; each mechanism has its own animation clock.
export class SpacecraftArt {
  async load() { this.rig = await loadSpacecraftRig(); }
  prepare(art) {
    if (this.source === art.sprites.shipSide) return;
    this.source = art.sprites.shipSide;
    const native = deckPixels(this.source, [0, 0, this.source.width, this.source.height], 260, 110);
    const parked = canvas(260,110), pc = parked.getContext('2d');
    pc.translate(260,0); pc.scale(-1,1); pc.drawImage(native,0,0);
    this.gear = [[49,82,25,28],[167,88,29,22]].map(rect => ({ sprite: cut(parked,...rect), x: rect[0]-130, y: rect[1]-55 }));
    const body = this.rig.body;
    this.bay = cut(body,89,64,48,16);
    this.hatch = cut(body,140,29,46,9);
    this.pod = this.rig.pod;
    this.closedBay = tint(this.bay,(r,g,b)=>[r*.25,g*.27,b*.29]);
    this.bodies = [body];
    for (let stage = 1; stage <= 2; stage++) {
      const damaged = cut(body, 0, 0, 260, 110), dc = damaged.getContext('2d');
      dc.imageSmoothingEnabled = false;
      for (const [x, y] of [[-25, 10], [49, 1], [83, 20]].slice(0, stage + 1)) dc.drawImage(art.arcade.crater, x + 122, y + 47, 17, 16);
      dc.globalCompositeOperation = 'destination-in'; dc.drawImage(body, 0, 0); this.bodies.push(damaged);
    }
    this.gun = this.rig.gun;
    // The fire atlas has shaded, turbulent flame tongues. Prepare small warm
    // exhaust frames once, instead of stretching a flat cyan muzzle flash.
    this.jets = art.deck.actors.flameShot.slice(3,12).map(f => f.sprite);
    this.smoke = art.deck.actors.blast.slice(15, 25).map(frame => tint(frame.sprite, (r, g, b) => {
      const shade = (r + g + b) / 3; return [shade * .65 + 14, shade * .69 + 16, shade * .73 + 18];
    }));
  }
  paint(c, sprite, x, y, hit, reduced) {
    c.drawImage(hit ? hitSprite(sprite, reduced, 'slug') : sprite, Math.round(x), Math.round(y));
  }
  jet(c, x, y, angle, clock, power, reduced) {
    if (power < .025) return;
    // Offset thruster clocks begin below zero. Wrap them into valid frames;
    // JavaScript's signed remainder would otherwise select an undefined sprite.
    const tick = Math.floor(clock / 3), frame = reduced ? 2 : loopIndex(tick,this.jets.length);
    const pulse = reduced ? 0 : [0,2,-1,1][loopIndex(tick,4)];
    const length = Math.round(7 + power * 19 + pulse), height = Math.round(5 + power * 7);
    c.save(); c.translate(Math.round(x),Math.round(y)); c.rotate(angle);
    c.globalAlpha *= Math.min(1,power*2.5);
    // Hot white core stays at the nozzle; the orange tongue trails outward.
    c.scale(-1,1); c.drawImage(this.jets[frame],-length,-Math.floor(height/2),length+2,height); c.restore();
  }
  draw(c, d, art, reduced) {
    this.prepare(art);
    const b = d.boss, m = b?.motion ?? spacecraftMotion();
    const state = b?.state ?? 'disabled', active = !['disabled', 'dying'].includes(state);
    const x = b?.x ?? 3870, y = b?.y ?? 206, time = b?.time ?? 0;
    const hit = b?.hit > 0, damaged = b && b.hp <= 200, stage = damaged ? b.hp <= 100 ? 2 : 1 : 0;
    c.save(); c.translate(Math.round(x), Math.round(y - (reduced ? 0 : m.recoil * .55)));
    c.scale(-(b?.facing ?? -1), 1); c.rotate(reduced ? 0 : m.pitch);
    if (!reduced && m.hitKick > .3) c.translate(Math.round(Math.sin(time * 2.3) * m.hitKick), 0);
    // Nozzles bank on their actual pivots. Thrust pulses independently from
    // the hull's slower banking and damped recoil.
    for (const yy of [-6,21]) this.jet(c,128,yy,0,time+yy,m.thrust*(state==='sweep'?1.1:.46),reduced);
    for (const [xx, yy, phase] of [[-56,35,0],[42,39,5]]) {
      const cant = reduced ? 0 : (m.vector || 0) + Math.sin((time+phase)*.08)*.018;
      c.save(); c.translate(xx,yy); c.rotate(cant);
      this.jet(c,0,23,Math.PI/2,time+phase,m.thrust*.72,reduced);
      this.paint(c,this.pod,-8,-4,hit,reduced); c.restore();
    }
    for (const gear of this.gear) if (m.gear>.02) this.paint(c,gear.sprite,gear.x,gear.y-Math.round((1-m.gear)*29),hit,reduced);
    // The mortar rack rises from behind the hull. Its mouths meet the same
    // world-space height used by the telegraphed shell trajectories.
    if (m.mortar>.01) {
      const top = (-14)*(1-m.mortar)+(50-y)*m.mortar;
      this.paint(c,this.rig.mortar,10,top,hit,reduced);
    }
    this.paint(c,this.bodies[stage],-130,-55,hit,reduced);
    // The new cockpit already depicts the Warden; no pasted-on portrait.
    c.save(); c.beginPath(); c.rect(-41,9,48,16); c.clip();
    this.paint(c,this.closedBay,-41,9,hit,reduced);
    const doors=hit?hitSprite(this.bay,reduced,'slug'):this.bay, open=Math.round(m.bay*22);
    c.drawImage(doors,0,0,24,16,-41-open,9,24,16);
    c.drawImage(doors,24,0,24,16,-17+open,9,24,16); c.restore();
    const lid=hit?hitSprite(this.hatch,reduced,'slug'):this.hatch, gap=Math.round(m.mortar*19);
    c.drawImage(lid,0,0,23,9,10-gap,-26,23,9);
    c.drawImage(lid,23,0,23,9,33+gap,-26,23,9);
    if (damaged) this.damageVents(c, time, stage, state, art, reduced);
    if (state === 'plasma' && active) {
      const charge = Math.min(1, b.age / b.warning);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i < charge * 4 ? '#b8ffff' : '#2a665f'; c.fillRect(-34 + i * 8, 21, 3, 2);
      }
    }
    c.restore();
    if (active && m.bay > .05 && state !== 'plasma') this.cannon(c, b, reduced);
    for (const vent of b?.vents ?? []) this.shotEffect(c, vent, art, reduced);
  }
  cannon(c, b, reduced) {
    const { pivot, angle } = spacecraftCannon(b), m = b.motion;
    c.save(); c.translate(Math.round(pivot.x),Math.round(pivot.y)); c.rotate(angle);
    const gun=b.hit>0?hitSprite(this.gun,reduced,'slug'):this.gun, kick=Math.round(Math.max(0,m.recoil));
    // The barrel telescopes into the breech; the pivot stays bolted to the bay.
    c.drawImage(gun,28,0,18,14,22-kick,-7,18,14);
    c.drawImage(gun,0,0,30,14,-6,-7,30,14); c.restore();
  }
  damageVents(c, time, stage, state, art, reduced) {
    const points = [[-25, 10], [49, 1], [83, 20]].slice(0, stage + 1);
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i], clock = (time + i * 11) % 34;
      if (state !== 'disabled') {
        const fire = art.deck.actors.blast[reduced ? 7 : 3 + Math.floor((time + i * 3) / 3) % 8].sprite;
        c.drawImage(fire, x - 10, y - 13, 20, 19);
      }
      const age = reduced ? 16 : clock;
      c.save(); c.globalAlpha = (1 - age / 38) * (state === 'disabled' ? .25 : .65);
      const size = 13 + Math.floor(age / 3);
      c.drawImage(this.smoke[Math.min(9, Math.floor(age / 4))], Math.round(x - size / 2 + age * .15), Math.round(y - age * .6 - 14), size, size); c.restore();
    }
  }
  shotEffect(c, effect, art, reduced) {
    if (effect.kind === 'plasma') {
      for (const x of [3436, 4004]) {
        c.save(); c.globalAlpha = Math.max(0, 1 - effect.age / 10);
        this.jet(c, x, 252, x < 3700 ? 0 : Math.PI, effect.age, .8, reduced); c.restore();
      }
      return;
    }
    // Reuse the detailed arcade ignition / flame / smoke frames at the actual
    // shot origin. No fixed orange triangle or rectangular backdrop.
    if (effect.age < 7) {
      const frame = art.deck.actors.blast[Math.min(8, 1 + effect.age)].sprite;
      c.save(); c.translate(Math.round(effect.x), Math.round(effect.y)); c.rotate(effect.angle - Math.PI / 2);
      c.drawImage(reduced && effect.age < 2 ? art.deck.actors.blast[4].sprite : frame, -8, -4, 16, 24); c.restore();
    } else {
      c.save(); c.globalAlpha = (18 - effect.age) / 20;
      c.drawImage(this.smoke[Math.min(9, effect.age - 7)], Math.round(effect.x - 10), Math.round(effect.y - 10 - effect.age * .4), 20, 20); c.restore();
    }
  }
}

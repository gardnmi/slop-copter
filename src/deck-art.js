import { DeckHud } from './deck-hud.js';
import { drawDeckHelicopter, drawShobuBomb } from './deck-reference-art.js';
import { box, line, poly, label } from './air-art.js';
import { DECK_FLOOR } from './deck-raid.js';
import { MetalSlugArt } from './metal-slug-art.js';
import { drawSpacecraft, deckProjectile } from './deck-boss-art.js';
import { drawDeckStructure } from './deck-platform-art.js';
import { DeckScenery, deckPixels } from './deck-scenery.js';
import { ElevatorArt } from './deck-elevator-art.js';
import { weaponPickup, weaponShot } from './deck-weapon-art.js';
import { DECK_WEAPONS } from './deck-weapons.js';
import { SpacecraftArt } from './spacecraft-art.js';

export class DeckArt {
  constructor() { this.surface = document.createElement('canvas'); this.actors = new MetalSlugArt(); this.scenery = new DeckScenery(); this.spacecraft = new SpacecraftArt(); this.elevator = new ElevatorArt(); this.arcadeHud = new DeckHud(); }
  async load() {
    this.background = new Image(); this.background.src = `${import.meta.env.BASE_URL}assets/carrier-deck-panorama.png`;
    await Promise.all([this.background.decode(), this.actors.load(), this.scenery.load(), this.elevator.load(), this.arcadeHud.load(), this.spacecraft.load()]);
    this.backgroundSource = this.background;
    this.prepareBackground(320);
  }
  prepareBackground(viewHeight) {
    // Tall boss views expose more sky. Prepare a native-pixel variant only on
    // resize, keeping the panorama behind the entire view without an empty band.
    const height = Math.max(883, Math.ceil(viewHeight * 1.05));
    if (this.backgroundHeight === height) return;
    this.backgroundHeight = height;
    const source = this.backgroundSource;
    this.background = deckPixels(source, [0, 0, source.width, source.height], Math.round(height * 3), height, true);
  }
  commando(c, d, reduced) { this.actors.commando(c, d, reduced); }
  soldier(c, e, reduced) {
    this.actors.soldier(c, e, reduced);
    if (e.state === 'aim' && !e.dead) label(c, '!', e.x, e.y - 48, 10, '#ffd177', 'center');
  }
  emplacement(c, e, reduced) {
    this.actors.emplacement(c, e, reduced);
    if (e.state === 'aim' && !e.dead) label(c, '!', e.x, e.y - 54, 10, '#ffd177', 'center');
  }
  draw(target, game, art, renderer, reduced, { view, hideActor = false, hideHud = false } = {}) {
    const d = view || game.boarding, w = Math.ceil(d.width), h = Math.ceil(d.height);
    const inShaft = d.lift && d.cameraY >= 260;
    if (!inShaft) this.prepareBackground(h);
    if (this.surface.width !== w || this.surface.height !== h) { this.surface.width = w; this.surface.height = h; }
    const c = this.surface.getContext('2d'); c.imageSmoothingEnabled = false;
    c.save();
    if (!reduced && d.shake > .1) c.translate(Math.round(Math.sin(d.time * 91) * d.shake), Math.round(Math.cos(d.time * 109) * d.shake * .6));
    const floor = DECK_FLOOR - d.cameraY;
    box(c, '#3d4a60', -4, -4, w + 8, h + 8);
    if (!inShaft) c.drawImage(this.background, Math.round(-d.cameraX * .46), Math.round(floor - this.background.height * .80));
    box(c, '#10242f', 0, floor + 4, w, Math.max(0, h - floor));
    c.save(); c.translate(-Math.round(d.cameraX), -Math.round(d.cameraY));
    if (d.lift) this.elevator.environment(c, d, this.scenery);
    drawDeckStructure(c, d, this.scenery);
    // Landed helicopter remains at the aft end, connecting the cinematic to play.
    const heli = renderer.runnerArt.rescueArt.body;
    this.scenery.aircraftSprite(c, heli, 85, DECK_FLOOR - 41, 155);
    line(c, '#1e313a', [[42, DECK_FLOOR - 59], [145, DECK_FLOOR - 59]], 2);
    for (const p of d.props) this.scenery.prop(c, p);
    for (const chute of d.chutes) this.actors.paratroopers.chute(c, chute, reduced);
    for (const e of d.enemies) if (Math.abs(e.x - d.cameraX - w / 2) < w / 2 + 60) {
      if (e.type === 'turret') this.emplacement(c, e, reduced);
      else if (!e.dead || e.deathAge < (e.burning ? 100 : 48)) this.soldier(c, e, reduced);
    }
    for (const item of d.pickups) if (!item.dead) {
      const bob = reduced ? 0 : Math.sin(d.time * 5 + item.x) * 2;
      if (DECK_WEAPONS[item.type]) {
        weaponPickup(c, this.actors, item, item.y + bob);
      } else {
        this.scenery.draw(c, 'medkit', item.x - 9, item.y - 8 + bob, 18, 16);
      }
    }
    drawDeckHelicopter(c, d, this.actors, reduced);
    drawSpacecraft(c, d, art, reduced);
    if (!hideActor) this.commando(c, d, reduced);
    for (const s of d.shots) weaponShot(c, s, this.actors, reduced);
    for (const g of d.thrown) {
      c.save(); c.translate(Math.round(g.x), Math.round(g.y)); c.rotate(g.age * .3);
      poly(c, '#14282b', [[-3, -3], [2, -3], [4, 0], [2, 4], [-2, 4], [-4, 0]]);
      box(c, '#82935b', -2, -2, 4, 5); box(c, '#c7c990', -2, -2, 2, 2);
      box(c, '#e2c895', 0, -5, 2, 2); c.restore();
    }
    for (const effect of d.explosions) this.actors.explosion(c, effect, reduced);
    for (const p of d.impacts) {
      if (p.kind === 'armor') this.actors.explosion(c, { ...p, age: p.age * 2.8 }, reduced);
      if (p.age < 3) {
        line(c, '#fff2bb', [[p.x - 3, p.y], [p.x + 3, p.y]], 2);
        line(c, '#f6b95d', [[p.x, p.y - 4], [p.x, p.y + 4]], 1);
      }
      for (let i = 0; i < 4; i++) {
        const vx = p.facing * (1.1 + i * .65), vy = (i - 1.5) * .9;
        box(c, p.age < 4 ? '#f5dc91' : '#977a51', p.x + vx * p.age, p.y + vy * p.age + p.age * p.age * .04, 1, 1);
      }
    }
    for (const p of d.particles) {
      if (p.kind === 'casing') { box(c, '#edc971', p.x, p.y, 2, 1); continue; }
      c.globalAlpha = 1 - p.age / p.life;
      box(c, p.age < 5 ? '#f6c478' : p.spin % 2 ? '#595d54' : '#b2a481', p.x, p.y, p.size, p.size > 1 ? p.size - 1 : 1);
    }
    c.globalAlpha = 1;
    // Projectiles remain readable above smoke and blast art.
    for (const b of d.bullets) { if (b.kind === 'shobu-bomb') drawShobuBomb(c, b, this.actors); else deckProjectile(c, b, reduced); }
    c.restore(); c.restore();
    // The arena camera pulls back on phones, but its HUD keeps the normal size.
    const hudScale = Math.max(1, w / d.baseWidth);
    c.save(); c.scale(hudScale, hudScale);
    if (!hideHud) this.hud(c, d, game, w / hudScale, h / hudScale);
    c.restore();
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.imageSmoothingEnabled = false;
    target.drawImage(this.surface, 0, 0, target.canvas.width, target.canvas.height); target.restore();
  }
  hud(c, d, game, w, h) {
    this.arcadeHud.header(c, d, game, w, h);
    if (d.age < 210 && d.playing && !d.boss) {
      label(c, 'ARROWS / WASD   J SHOOT   K JUMP   L BOMB', w / 2, h - 17, w < 430 ? 7 : 9, '#f5e0b8', 'center');
    }
    if (d.boss && d.playing) {
      const hint = { wake: 'USE THE CATWALKS  /  ↑ AIM UP', cannon: 'MOVE OFF THE LINE  /  CHANGE LEVELS', mortar: 'LEAVE THE MARKED PLATFORM', sweep: 'MOVE UNDER IT  /  ↑ + J FIRE', plasma: 'CLIMB OR JUMP THE DECK SWEEP', recover: 'J FIRE  /  L GRENADE', descent: 'AIRCRAFT LIFT RELEASED / GOING DOWN', 'warden-wake': 'HOLD ↑ + J / SHOOT ITS UNDERSIDE', 'warden-crossfire': 'GUNS LOCKED / MOVE OUT OF THE LINES', 'warden-press': 'LEAVE THE STRIPED IMPACT ZONE', 'warden-fan': 'DODGE BETWEEN THE SHOTS / ↑ + J', 'warden-recover': 'UNDERSIDE EXPOSED / ↑ + J', 'warden-dying': 'REACTOR RUPTURE / STAND CLEAR' }[d.boss.state];
      label(c, hint, w / 2, h - 17, 9, '#f5ddb1', 'center');
    }
    if (d.phase === 'cleared') label(c, 'THE LIFT IS BREAKING', w / 2, h - 25, 10, '#ffc48c', 'center');
    if (d.dead) {
      box(c, 'rgba(10,23,31,.7)', 0, h * .30, w, 94);
      label(c, 'MAN DOWN', w / 2, h * .30 + 31, w < 430 ? 16 : 22, '#ffe2ac', 'center');
      label(c, `${d.label} / RESTARTING…`, w / 2, h * .30 + 57, 9, '#cfe7d3', 'center');
    }
  }
}

import { startDeckHelicopter } from './deck-helicopter.js';
import { equipWeapon } from './deck-weapons.js';
import { damageSpacecraft } from './deck-boss.js';
import { beginElevator } from './deck-elevator.js';
import { Game, TRANSFORM_ORDER } from './game.js';
import { CINEMATIC_TICKS, TERMINATOR_THRESHOLD } from './counterattack.js';
import { RESCUE_AFTER_TICKS } from './runner.js';
import { DECK_ENTRANCES } from './deck-layout.js';
import { WELL_END } from './orbit-layout.js';
import {beginEater} from './orbit-boss.js';

export const TEST_LEVELS = [
  { id: 'classic', group: 'Stunt flight', name: 'Classic flight', description: 'Start with the original world. Arrows fly; Space drops a stuntman.' },
  { id: 'matrix', group: 'Stunt flight', name: 'Matrix uprising', description: 'The world is fully transformed. Automatic drops build up the eight Terminators.' },
  { id: 'bandana', group: 'Counterattack', name: 'Bandana cutscene', description: 'Watch the commando transformation, then take on all eight Terminators.' },
  { id: 'counterattack', group: 'Counterattack', name: 'Terminator fight', description: 'Start armed with automatic fire and eight targets. Move to sweep the ground.' },
  { id: 'liquid-metal', group: 'Chrome carriage', name: 'Victory / liquid-metal takeover', description: 'Watch the false victory and the machines melt into the horse and buggy.' },
  { id: 'chrome-carriage', group: 'Chrome carriage', name: 'Chrome horse boss', description: 'Fresh helicopter, five grenade hits to win. Space drops grenades; arrows dodge rockets.' },
  { id: 'self-destruct', group: 'Rooftop escape', name: 'Self-destruct escape', description: 'The horse is defeated and the countdown begins. Hold RIGHT to reach the rooftops.' },
  { id: 'rooftops', group: 'Rooftop escape', name: 'Rooftop run', description: 'Start running from the blast. Space or Up jumps; hold for longer leaps.' },
  { id: 'rescue', group: 'Rooftop escape', name: 'Helicopter pickup', description: 'Skip the twenty-second run. Jump to grab the boarding rail when the helicopter arrives.' },
  { id: 'burning-city', group: 'Air assault', name: 'Burning city', route: 0, description: 'Fly the new gunship. Automatic cannon and full armor. Dodge the charged enemy weapons.' },
  { id: 'freeway', group: 'Air assault', name: 'Freeway', route: 1, description: 'Take on missile trucks, radar and armored trains.' },
  { id: 'shipyards', group: 'Air assault', name: 'Shipyards', route: 2, description: 'Fight patrol boats, gunships and harbor defenses.' },
  { id: 'carrier-approach', group: 'Air assault', name: 'Carrier approach', route: 3, description: 'Cross open water toward the carrier and its spacecraft.' },
  { id: 'airship', group: 'Air assault', name: 'Iron Vulture airship boss', description: 'Destroy the giant flying fortress: wing guns first, then the reactor. The carrier waits beyond it.' },
  { id: 'carrier', group: 'Air assault', name: 'Friendly carrier arrival', description: 'Weapons safe. Prepare to catch and land on the moving carrier.' },
  { id: 'landing', group: 'Air assault', name: 'Carrier landing challenge', description: 'Limited fuel. Up / W / Space lifts; Left / Right tilts. Match the moving pad and land gently.' },
  { id: 'deck-raid', group: 'Boarding action', name: 'Carrier deck run-and-gun', description: 'Cross the ship to the spacecraft. Arrows / WASD move, J shoots, K jumps, L throws grenades. Down ducks; Up aims upward.' },
  { id: 'deck-cargo', group: 'Boarding action', name: 'Cargo bay / upper route', description: 'Parachuting reinforcements descend over the cargo hold and its upper gantries.' },
  { id: 'deck-catwalks', group: 'Boarding action', name: 'Hangar catwalk climb', description: 'Climb the hangar gantries and cross the open elevator shaft. K jumps; hold for a full leap.' },
  { id: 'deck-helicopter', group: 'Boarding action', name: 'R-Shobu helicopter miniboss', description: 'Early aft-deck encounter, before the cargo bay. Machine gun equipped; hold Up + J and dodge sideways.' },
  { id: 'elevator', group: 'Boarding action', name: 'Elevator / The Warden', description: 'Fight the pilot’s overhead command rig inside the aircraft lift. Up + J fires; dodge the gun locks and hydraulic press.' },
  { id: 'spaceship', group: 'Boarding action', name: 'Spacecraft boss', description: 'Fight a moving ship above a two-tier arena. Up + J fires overhead. Change platforms to evade mortars and deck sweeps, then descend into the aircraft elevator for phase two.' },
  { id: 'shaft-collapse', group: 'The descent', name: 'Warden crash / shaft collapse', description: 'The defeated Warden crashes through the lift. Fall with its wreckage as the shaft becomes Downwell.' },
  { id: 'downwell', group: 'The descent', name: 'Cloudfall / gun descent', description: 'Start falling at the top of the well. Hold J or Space to fire downward and slow the fall. Arrows / A / D steer. Stomp white enemies to reload; shoot red spiked enemies.' },
  { id: 'downwell-storm', group: 'The descent', name: 'Cloudfall / the depths', description: 'Continue from the second descent checkpoint, with more enemies and breakable reload ledges.' },
  { id: 'downwell-core', group: 'The descent', name: 'Cloudfall / final descent', description: 'Start at the last checkpoint. Clear the switchbacks and reach the Slop Eater.' },
  { id: 'slop-eater', group: 'The descent', name: 'Slop Eater / cinematic reveal', description: 'Watch the horned maw, eye and name reveal, then receive the machine gun for the final fight.' },
  { id: 'slop-eater-fight', group: 'The descent', name: 'Slop Eater / boss fight', description: 'Start with a 45-round machine gun. Shoot its white eye, stomp or land to reload, dodge red volleys and jump from cracking rock.' },
  { id: 'full-circle', group: 'The descent', name: 'Full circle / ending', description: 'Fall from high above, turn back into the stuntman, slow down through a cloud and land in the moving hay cart to resume classic play.' },
];

// Build fresh, playable chapter entrances using the same transitions and
// checkpoints as normal play. Nothing from the previous fight is carried over.
export function createLevel(id, options = {}) {
  if (id === 'rocket-ride') id = 'shaft-collapse'; // Legacy links now show the collapsing lift.
  if (id === 'mecha') id = 'elevator'; // Old dev bookmarks still reach phase two.
  const level = TEST_LEVELS.find(level => level.id === id);
  if (!level) throw new RangeError(`Unknown level: ${id}`);
  const g = new Game(options);
  if (id === 'classic') return g;
  if (['downwell','downwell-storm','downwell-core','slop-eater','slop-eater-fight','full-circle'].includes(id)) {
    g.shiftCount = TRANSFORM_ORDER.length;
    g.orbit.startFall(g, id === 'downwell-storm' ? 1 : ['downwell-core','full-circle'].includes(id)?2:0);
    if(id==='full-circle'){g.orbit.y=WELL_END+100;g.orbit.cameraY=g.orbit.y-235;g.orbit.beginReturn(g,{award:false});}
    if(id==='slop-eater'||id==='slop-eater-fight'){
      g.orbit.y=WELL_END+40;g.orbit.cameraY=g.orbit.y-185;
      beginEater(g.orbit,g,{intro:id==='slop-eater'});
    }
    return g;
  }
  g.shiftCount = TRANSFORM_ORDER.length;
  g.message = 'The simulation is awake. They are jumping on their own. Keep flying!';
  g.saveCheckpoint(1);
  if (id === 'matrix') return g;

  g.retaliation = true;
  for (let i = 0; i < TERMINATOR_THRESHOLD; i++) {
    g.combat.miss(g, g.width * (i + 1) / (TERMINATOR_THRESHOLD + 1) - 14);
    Object.assign(g.combat.shooters[i], { age: 100, cooldown: 80 + i * 12 });
  }
  g.counterattack.waitTicks = 1;
  g.counterattack.beforeWorldTick(g);
  if (id === 'bandana') return g;
  g.counterattack.cinemaTick = CINEMATIC_TICKS - 1;
  g.counterattack.beforeWorldTick(g);
  g.saveCheckpoint(2);
  if (id === 'counterattack') return g;

  g.counterattack.phase = 'cleared';
  g.counterattack.kills = TERMINATOR_THRESHOLD;
  g.counterattack.wrecks = g.combat.shooters.map(s => ({ x: s.x, age: 0, facing: s.facing }));
  g.combat.shooters = [];
  g.boss.begin(g);
  if (id === 'liquid-metal') return g;
  while (g.boss.intro) g.boss.tickIntro(g);
  g.saveCheckpoint(3);
  if (id === 'chrome-carriage') return g;

  g.boss.hits = 5; g.boss.awarded = true;
  g.boss.enter('dying', g);
  g.saveCheckpoint(4);
  if (id === 'self-destruct') return g;

  g.boss.enter('won', g);
  g.runner.beginRun(g);
  if (id === 'rooftops') return g;
  if (id === 'rescue') {
    const r = g.runner;
    r.speed = 400; r.runTicks = RESCUE_AFTER_TICKS;
    // A clear pickup lane gives the same approach and jump window as a retry.
    r.roofs.length = 1; r.roofs[0].width = 4800;
    r.beginRescue(g);
    return g;
  }

  g.assault.begin(g);
  g.assault.startSection(g, level.route ?? 3);
  if (level.route !== undefined) return g;
  if (id === 'airship') { g.assault.beginAirship(g); return g; }
  g.assault.beginCarrier(g);
  if (DECK_ENTRANCES[id] || ['spaceship', 'elevator', 'deck-helicopter', 'shaft-collapse'].includes(id)) {
    g.assault.enter('secured', g); g.boarding.begin(g);
    if (DECK_ENTRANCES[id]) {
      Object.assign(g.boarding, DECK_ENTRANCES[id]); g.boarding.cameraFloor = g.boarding.y;
      if (id !== 'deck-raid') equipWeapon(g.boarding, id === 'deck-catwalks' ? 'flame' : 'heavy');
      for (const p of g.boarding.pickups) if (p.x < g.boarding.x) p.dead = true;
      g.boarding.resize(g); g.boarding.save(g);
    }
    if (id === 'deck-helicopter') { const d = g.boarding; d.x = 1050; d.y = 260; d.section = 0; equipWeapon(d, 'heavy'); d.ammo = 140; for (const p of d.pickups) if (p.x < d.x) p.dead = true; d.resize(g); startDeckHelicopter(d, g); }
    if (['spaceship', 'elevator', 'shaft-collapse'].includes(id)) { equipWeapon(g.boarding, 'heavy'); g.boarding.ammo = id === 'elevator' ? 350 : 550; g.boarding.x = 3480; g.boarding.section = 2; g.boarding.beginBoss(g); if (id !== 'spaceship') beginElevator(g.boarding, g, true); g.boarding.resize(g);
      if (id === 'shaft-collapse') { g.boarding.boss.state = 'warden-recover'; damageSpacecraft(g.boarding, g, 10000, g.boarding.boss.x, g.boarding.boss.y); }
    }
  }
  else if (id === 'landing') {
    g.assault.enter('landing', g);
  }
  return g;
}

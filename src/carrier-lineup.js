import { beginCarrierLanding, LANDING } from './carrier-landing.js';

export const CARRIER_LINEUP_TICKS = 210;

export function beginCarrierLineup(a, game) {
  beginCarrierLanding(a, game, { checkpoint: false });
  a.recovery.status = 'approach';
  game.message = 'BRING HER HOME. Lining up with the carrier…';
  tickCarrierLineup(a, game);
}

export function tickCarrierLineup(a, game) {
  const r = a.recovery, duration = CARRIER_LINEUP_TICKS / 50;
  const t = Math.min(1, a.age / CARRIER_LINEUP_TICKS), left = 1 - t;
  // Close on the stern, ease out of the bank and preserve this exact pose at
  // handoff. No fuel or collision checks until the player has control.
  r.shipX = 290 + LANDING.shipSpeed * a.age / 50;
  r.x = r.shipX - 160 - 60 * left * left - 22 * duration * left;
  r.y = 142 - 55 * left * left;
  r.vx = LANDING.shipSpeed + 120 * left / duration + 22;
  r.vy = 110 * left / duration;
  r.angle = .16 * left * left;
  r.camera = r.x + 105; r.thrust = 0; r.fuel = 100;
  if (a.age >= CARRIER_LINEUP_TICKS) {
    a.phase = 'landing'; a.age = 0; r.status = 'flying';
    game.releaseControls(); a.saveCheckpoint(game);
    game.message = 'YOUR CONTROLS. Up / W / Space: lift. Left / Right: tilt. Catch the moving pad and land gently.';
  }
}

// Side-view recovery uses world coordinates, independent of viewport size.
// Positive Y points down; X speed is measured against the moving deck.
export const LANDING = Object.freeze({
  deckY: 342, seaY: 448, shipWidth: 650, shipSpeed: 30,
  padOffset: 142, padWidth: 152, wheelRadius: 25,
  gravity: 34, lift: 84, fuelBurn: 6.2,
  maxDrift: 24, maxSink: 32, maxTilt: .16, settleTicks: 100,
});
const DT = 1 / 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function landingReadout(r) {
  const padX = r.shipX + LANDING.padOffset;
  const aligned = Math.abs(r.x - padX) <= LANDING.padWidth / 2 - LANDING.wheelRadius;
  const drift = r.vx - r.shipSpeed;
  const sink = r.vy - r.shipVY;
  const level = Math.abs(r.angle) <= LANDING.maxTilt;
  return { padX, aligned, drift, sink, level, safe: aligned && level &&
    Math.abs(drift) <= LANDING.maxDrift && sink <= LANDING.maxSink };
}

export function beginCarrierLanding(a, game, { checkpoint = true } = {}) {
  a.recovery = { status: 'flying', x: 130, y: 142, vx: 52, vy: 0, angle: 0,
    shipX: 290, shipSpeed: LANDING.shipSpeed, shipTicks: 0,
    deckY: LANDING.deckY, shipVY: 24.9,
    camera: 235, fuel: 100, thrust: 0, landedAge: 0, deckOffset: 0 };
  a.enemies = []; a.shots = []; a.bullets = []; a.pickups = [];
  a.reason = '';
  game.message = 'CATCH THE CARRIER. Up / W / Space: lift. Left / Right: tilt. Match the moving pad and land gently. Fuel is limited.';
  if (checkpoint) a.saveCheckpoint(game);
}

function crash(a, game, reason, effect = 'destroy') {
  a.recovery.status = 'crashed'; a.recovery.thrust = 0;
  a.reason = reason; a.enter('dead', game); a.sound('destroy', a.x, effect);
  game.message = `${reason} Restarting the landing with a full tank…`;
}

export function tickCarrierLanding(a, game) {
  const r = a.recovery;
  const oldShip = r.shipX, oldShipSpeed = r.shipSpeed, oldDeck = r.deckY, oldShipVY = r.shipVY;
  // Two gentle swells vary the pace without sudden jumps under the wheels.
  // The local clock is checkpointed, so a retry repeats the same approach.
  const shipTime = ++r.shipTicks * DT;
  r.shipSpeed = LANDING.shipSpeed + Math.sin(shipTime * 1.4) * 4 + Math.sin(shipTime * 2.3) * 2;
  r.deckY = LANDING.deckY + Math.sin(shipTime * 1.65) * 10 + Math.sin(shipTime * 2.8) * 3;
  r.shipVY = (r.deckY - oldDeck) / DT;
  r.shipX += r.shipSpeed * DT;
  if (r.status === 'landed') {
    r.x = r.shipX + r.deckOffset; r.y = r.deckY;
    r.vx = r.shipSpeed; r.vy = r.shipVY;
    r.camera += (r.x - r.camera) * .025;
    if (++r.landedAge >= LANDING.settleTicks) {
      a.enter('secured', game); game.boarding.begin(game);
    }
    return;
  }
  const oldX = r.x, oldY = r.y;
  const targetTilt = game.controlX / 4 * .34;
  r.angle += (targetTilt - r.angle) * .12;
  const requested = clamp(-game.controlY / 3, 0, 1);
  r.thrust = Math.min(requested, r.fuel / (LANDING.fuelBurn * DT));
  r.fuel = Math.max(0, r.fuel - r.thrust * LANDING.fuelBurn * DT);
  r.vx += (Math.sin(r.angle) * LANDING.lift * r.thrust - r.vx * .065) * DT;
  r.vy += (LANDING.gravity - Math.cos(r.angle) * LANDING.lift * r.thrust) * DT;
  r.x += r.vx * DT; r.y += r.vy * DT;
  r.camera += (r.x * .65 + (r.shipX + LANDING.padOffset) * .35 - r.camera) * .04;

  // Sweep through the deck plane so even an unpowered fast fall cannot tunnel
  // through the ship. Both the aircraft and carrier move during the same tick.
  if (oldY <= oldDeck && r.y >= r.deckY) {
    const t = (oldDeck - oldY) / ((r.y - oldY) - (r.deckY - oldDeck) || 1);
    const contact = { ...r, x: oldX + (r.x - oldX) * t,
      shipX: oldShip + (r.shipX - oldShip) * t,
      shipSpeed: oldShipSpeed + (r.shipSpeed - oldShipSpeed) * t,
      shipVY: oldShipVY + (r.shipVY - oldShipVY) * t };
    const check = landingReadout(contact);
    if (contact.x + LANDING.wheelRadius >= contact.shipX && contact.x - LANDING.wheelRadius <= contact.shipX + LANDING.shipWidth) {
      if (check.safe) {
        r.status = 'landed'; r.deckOffset = contact.x - contact.shipX;
        r.x = r.shipX + r.deckOffset; r.y = r.deckY;
        r.vx = r.shipSpeed; r.vy = r.shipVY; r.angle = r.thrust = 0;
        a.sound('touchdown'); game.releaseControls();
        game.message = 'TOUCHDOWN. Hostiles forward — get to the spacecraft!';
      } else crash(a, game, !check.aligned ? 'Missed the lit landing pad.' : check.sink > LANDING.maxSink
        ? 'Hard landing — ease the descent with lift.' : !check.level
          ? 'The helicopter tipped — release tilt before touchdown.' : 'Too much sideways speed — match the carrier.');
      return;
    }
  }
  // The island and parked spacecraft are solid; the aft landing pad stays clear.
  const localX = r.x - r.shipX;
  if (r.y > r.deckY - 99 && r.y - 37 < r.deckY && localX > 310 && localX < 449 ||
      r.y > r.deckY - 41 && r.y - 37 < r.deckY && localX > 490 && localX < 612 ||
      r.y > r.deckY + 4 && r.y - 37 < LANDING.seaY - 8 && localX > -18 && localX < LANDING.shipWidth + 18) {
    crash(a, game, 'Clipped the carrier — approach the clear aft pad.');
  } else if (r.y >= LANDING.seaY) {
    r.y = LANDING.seaY;
    crash(a, game, r.fuel <= 0 ? 'Out of fuel. The helicopter ditched.' : 'Ditched in the sea — use lift to arrest the fall.', 'splash');
  } else if (r.shipX - r.x > 920) crash(a, game, 'The carrier got away. Keep your forward momentum.');
}

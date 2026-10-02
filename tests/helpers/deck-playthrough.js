// A recorded route through the authored level, using only gameplay inputs.
// Full jumps at ledges; drops into the cargo bay; HMG/grenades for nearby armor.
export const DECK_JUMPS = [535, 625, 828, 1755, 2028, 2300, 2438, 2528, 2638, 2798, 2944];
export function deckRouteInput(g, route) {
  const d = g.boarding;
  if (d.miniboss && d.miniboss.state !== 'wreck') { helicopterInput(g); return; }
  g.setYoke(1, 0); d.setFire(true);
  if (d.grounded) {
    d.releaseJump();
    if (d.x >= DECK_JUMPS[route.jump]) { d.pressJump(); route.jump++; }
  }
  if (d.enemies.some(e => !e.dead && e.x > d.x && e.x - d.x < 120 && Math.abs(e.y - d.y) < 80)) d.throwGrenade();
}

export function helicopterInput(g) {
  const d = g.boarding, b = d.miniboss;
  // Move out from under the locked column once the first bomb releases; aim
  // straight up throughout. The native input never edits health or enemies.
  let target = b.x;
  if (b.state === 'bombs' && b.age > 40 || d.bullets.some(p => p.kind === 'shobu-bomb' && Math.abs(p.x - d.x) < 44 && p.y > 155))
    target = b.targetX + (b.attack % 2 ? 65 : -65);
  g.setYoke(Math.abs(target - d.x) > 5 ? Math.sign(target - d.x) : 0, -1);
  d.setFire(!b.dead);
}

export function spacecraftInput(g) {
  const d = g.boarding, b = d.boss;
  if (b.form === 'elevator') {
    let target = b.x;
    if (b.state === 'warden-crossfire') target = b.aimX < b.x ? b.x + 62 : b.x - 62;
    if (b.state === 'warden-press' && Math.abs(b.drillX - b.x) < 45) target = b.x + (b.drillX <= b.x ? 64 : -64);
    if (b.state === 'warden-fan') target = b.x + 38;
    g.setYoke(Math.abs(target - d.x) > 3 ? Math.sign(target - d.x) : 0, -1);
    d.setFire(!['warden-dying', 'wreck'].includes(b.state));
    return;
  }
  if (b.state === 'descent') { g.setYoke(0, 0); d.setFire(false); return; }
  let target = Math.max(3500, Math.min(3900, b.x));
  if (b.state === 'mortar') target = b.marks.some(m => Math.abs(m.x - 3650) < 60) ? 3750 : 3650;
  if (b.state === 'plasma') target = d.x < 3710 ? 3520 : 3850;
  if (b.state === 'cannon') target = b.aimX < 3710 ? 3810 : 3610;
  if (b.state === 'disabled' || b.state === 'dying') target = 3940;
  g.setYoke(Math.abs(d.x - target) > 6 ? Math.sign(target - d.x) : 0, b.state === 'disabled' ? 0 : -1);
  d.setFire(true);
  if (d.grounded) d.releaseJump();
  if (b.state === 'plasma' && d.grounded && d.y > 240 && Math.abs(d.x - target) < 25) d.pressJump();
  if (Math.abs(d.x - b.x) < 180 && (d.y < 240 || b.y > 140) && !['wake', 'disabled', 'dying'].includes(b.state)) d.throwGrenade();
}

// Test pilot uses the public yoke only: no teleporting or resource changes.
export function pilotCarrier(game) {
  const r = game.assault.recovery;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const dx = r.shipX + 142 - r.x;
  const close = Math.abs(dx) <= 55;
  const targetXSpeed = r.shipSpeed + clamp(dx * .3, -35, 48);
  const targetYSpeed = (close ? r.shipVY : 0) + clamp(((close ? r.deckY + 8 : 215) - r.y) * .5, -30, 18);
  game.setYoke(clamp((targetXSpeed - r.vx) / 18, -1, 1), r.vy > targetYSpeed ? -1 : 0);
}

// The final machine's weight breaks the actual lift. Debris and the rider stay
// in deck coordinates until the well camera has finished its continuous reframe.
export const COLLAPSE_GRAVITY = 800, COLLAPSE_TERMINAL = 480;
export function collapseStep(velocity) { return Math.min(COLLAPSE_TERMINAL, velocity + COLLAPSE_GRAVITY * .02); }

export function breakLift(d, game, left, right, floor) {
  const b = d.boss;
  b.state = 'wreck'; b.age = 0;
  d.phase = 'cleared'; d.age = 0;
  d.collapse = { age: 0, floor, startY: d.y, startVY: Math.max(0, d.vy), pieces: [] };
  for (let i = 0; i < 12; i++) {
    const w = (right - left) / 12, x = left + (i + .5) * w, side = Math.sign(x - b.x);
    d.collapse.pieces.push({ x, y: floor, w: w + 2, delay: Math.floor(Math.abs(x - b.x) / 80),
      vx: side * (35 + i % 3 * 19), vy: 35 + (5 - Math.abs(i - 5.5)) * 28,
      angle: 0, spin: side * (.45 + i % 3 * .25), index: i });
  }
  d.platforms = d.platforms.filter(p => !p.lift && !p.arena);
  d.shots = []; d.bullets = []; d.thrown = []; d.pickups = [];
  d.vx = d.flash = d.slash = d.throwFlash = 0; d.vy = d.collapse.startVY;
  d.grounded = false; d.hurt = 999; d.clearInput();
  d.burst(b.x, floor - 8, 4, 'heavy-explosion'); d.shake = 5;
  for (const side of [-1, 1]) d.burst(b.x + side * 130, floor, 1.4);
  d.score(game, 3000); game.releaseControls();
  game.message = 'THE LIFT IS BREAKING!';
}

export function tickLiftCollapse(d) {
  const scene = d.collapse; scene.age++;
  d.vy = collapseStep(d.vy); d.y += d.vy * .02;
  d.boss.y += (d.vy + 120) * .02;
  for (const p of scene.pieces) {
    if (scene.age <= p.delay) continue;
    p.x += p.vx * .02; p.vy += 920 * .02; p.y += p.vy * .02; p.angle += p.spin * .02;
    if (scene.age === p.delay + 1 && p.index % 3 === 0) d.burst(p.x, p.y, .8, 'impact');
  }
  // Follow the actual fall; the rendering reframe adjusts the viewport only.
  d.cameraFloor += (d.y - 20 - d.cameraFloor) * .07;
}

// Chunky two-pixel fire: warm colors make the new hazard legible in both worlds.
// Purely a view of simulation time; drawing never consumes gameplay randomness.
const COLORS = ['#a52d21', '#f26724', '#ffb638', '#fff0a4'];
const block = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
};

function flame(c, x, base, height, time, seed) {
  const sway = Math.round(Math.sin(time * .7 + seed * 2.4)) * 2;
  for (let row = 0; row < height; row += 2) {
    const p = row / height;
    const width = p < .25 ? 10 : p < .6 ? 8 : p < .82 ? 4 : 2;
    const bend = p > .45 ? sway : 0;
    block(c, x - width / 2 + bend, base - row, width, 2, COLORS[0]);
    if (width >= 4) block(c, x - width / 2 + bend + 2, base - row, width - 2, 2, COLORS[1]);
    if (p < .6) block(c, x - 2, base - row, 4, 2, COLORS[2]);
    if (p < .22) block(c, x, base - row, 2, 2, COLORS[3]);
  }
}

function smoke(c, x, base, time, count, spread) {
  for (let i = 0; i < count; i++) {
    const age = (time * .014 + i / count) % 1;
    const y = base - age * 62;
    const px = x + Math.sin(i * 2.4) * spread - age * 16;
    const size = 4 + Math.floor(age * 3) * 2;
    c.globalAlpha = (1 - age) * .5;
    block(c, px, y, size, size, '#73716d');
    if (i % 2 === 0) {
      c.globalAlpha = 1 - age;
      block(c, px + 6, y + 8, 2, 2, '#f26724');
    }
  }
  c.globalAlpha = 1;
}

export function drawJumperFire(c, game, reducedMotion) {
  const j = game.jumper;
  if (!j?.burning || !['falling', 'result'].includes(game.state) || ['hay', 'fire'].includes(game.outcome) && game.state === 'result') return;
  const time = reducedMotion ? 0 : Math.floor(game.frame / 3);
  c.save();
  // The renderer supplies the incandescent body; these taller tongues wrap the
  // full figure and lick above its head, like an arcade burning-hit animation.
  flame(c, j.x + 1, j.y + 28, 34 + Math.round(Math.sin(time) * 4), time, 1);
  flame(c, j.x + 28, j.y + 30, 38 + Math.round(Math.sin(time + 2) * 4), time, 3);
  flame(c, j.x + 14, j.y + 2, 13 + Math.round(Math.sin(time + 4) * 4), time, 5);
  smoke(c, j.x + 14, j.y + 2, time, 7, 12);
  c.restore();
}

export function drawHayFire(c, game, reducedMotion) {
  if (!game.carriage.hayBurning || game.boss.replacesCart) return;
  const time = reducedMotion ? 0 : Math.floor(game.frame / 4);
  const x = game.cartX, y = game.deck;
  c.save();
  smoke(c, x + 30, y - 14, time, 13, 25);
  // Fire sits on the hay's curved silhouette, clear of wheels, horse and driver.
  for (let i = 0; i < 8; i++) {
    const base = y + 18 - Math.round(Math.sin(i / 7 * Math.PI) * 12);
    const height = 14 + Math.round((1 + Math.sin(time * .8 + i * 2.1)) * 5);
    flame(c, x + 4 + i * 8, base, height, time, i);
  }
  if (game.state === 'result' && game.outcome === 'fire' && !reducedMotion) {
    const p = game.effectTick / 36;
    for (let i = 0; i < 9; i++) {
      block(c, x + 30 + Math.sin(i * 2.4) * p * 36, y - p * (22 + i * 4), 2, 2, COLORS[1 + i % 3]);
    }
  }
  c.restore();
}

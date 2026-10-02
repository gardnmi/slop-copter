// Unmodified SNK sheets, cropped at load time. Provenance is recorded beside
// the source PNGs. No chroma-key rectangles or pre-baked background shadows.
export async function loadDeckReferenceArt(art) {
  const [shobu, sfx, rebels, hud] = await Promise.all(['r-shobu', 'weapon-sfx', 'rebel-original', 'hud'].map(async name => {
    const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/reference/metal-slug-${name}.png`;
    await image.decode(); return art.keyBackground(image);
  }));
  art.shobu = [6, 101, 196, 290, 385, 478, 572].map(x => art.frame(shobu, [x, 16, 89, 62], [44, 34]));
  art.shobuRotor = [[10,230,80,18],[96,233,77,13],[178,230,74,17],[254,234,64,15]]
    .map(r => art.frame(shobu, r, [r[2] / 2, r[3] / 2]));
  // Neutral shaded vapor cells also supply the carrier recovery's exhaust,
  // rotor wash and deck dust. Crop above the unrelated CLOUD weapon/labels.
  art.liftSmoke = [[155,5054,38,28],[191,5054,39,28],[228,5054,43,28],
    [271,5054,43,28],[314,5054,47,28],[361,5054,48,28]]
    .map(r => art.frame(sfx, r, [r[2] / 2, r[3] / 2]));
  art.shobuBombs = [7,23,38,53,68,83,98].map(x => art.frame(shobu, [x,479,14,27], [7,13]));
  art.flameLetter = art.frame(hud, [115,1003,15,17], [7,8]);
  art.heavyStreak = [[4,18,30,8],[5,147,23,17],[5,174,23,16]]
    .map(r => art.frame(sfx, r, [r[2], r[3] / 2]));
  art.flameShot = [[4,498,29,16],[36,494,37,25],[76,494,61,24],[140,491,58,30],
    [201,490,62,32],[266,490,64,32],[338,491,61,30],[402,490,65,32],[470,489,65,33],
    [4,527,67,35],[74,527,64,35],[141,527,63,35],[207,527,61,35],[271,527,56,35],
    [330,527,52,35],[385,527,49,35],[437,527,50,35],[490,525,48,37],[541,526,48,36]]
    .map(r => art.frame(sfx, r, [r[2] * .65, r[3] / 2]));
  // The first sequence is an upright burning soldier, the second collapses
  // all the way to a charred body. Keep the feet registered through both.
  art.rebelBurn = [3,63,127,183,246,306,368,430]
    .map(x => art.frame(rebels, [x,5615,50,64], [25,64]));
  art.rebelBurnFall = [3,61,123,192,259,312,369,427,486,547,612,676,746,801]
    .map((x, i) => art.frame(rebels, [x,5691,i === 13 ? 28 : 50,64], [i === 13 ? 14 : 25,64]));
}

export function drawDeckHelicopter(c, d, art, reduced) {
  const b = d.miniboss;
  if (!b || b.state === 'wreck') return;
  c.save(); c.translate(Math.round(b.x), Math.round(b.y)); c.scale(-b.facing * 1.7, 1.7);
  if (!reduced) c.rotate(Math.max(-.05, Math.min(.05, -b.vx * .016)));
  art.draw(c, art.shobu[Math.floor(b.time / 4) % 7], b.hit > 0, reduced);
  c.translate(1, -22);
  art.draw(c, art.shobuRotor[reduced ? 0 : Math.floor(b.time / 2) % 4]); c.restore();
  if (b.hp < 35 && !b.dead) {
    art.explosion(c, { x: b.x - b.facing * 41, y: b.y - 12, age: 16 + b.time % 15, size: .45 }, reduced);
  }
}

export function drawShobuBomb(c, b, art) {
  c.save(); c.translate(Math.round(b.x), Math.round(b.y));
  art.draw(c, art.shobuBombs[2 + Math.floor(b.age / 5) % 3]); c.restore();
}

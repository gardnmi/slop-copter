// Authored carrier geometry. Coordinates are world pixels, never screen pixels.
// Full jump: ~69 px high / 125 px across. Ascending gaps leave a landing margin.
export function createDeckPlatforms() {
  const ground = [
    [0, 580, 260], [580, 850, 216], [922, 1280, 260],
    [1280, 1800, 324], [1800, 2050, 278], [2120, 2350, 260],
    [2350, 2680, 308], [3020, 3210, 248], [3210, 3408, 260], [3408, 4020, 260],
  ];
  const walks = [
    [1230, 1400, 260], [1432, 1580, 216], [1612, 1790, 174], [1790, 1940, 174],
    [2320, 2460, 250], [2490, 2660, 206], [2690, 2820, 160], [2860, 2965, 204],
    [3470, 3575, 208], [3440, 3535, 158], [3800, 3905, 208], [3860, 3955, 158],
  ];
  return [...ground.map(([x, end, y]) => ({ x, y, w: end - x, h: 440 - y, type: 'deck', solid: true, lift: x === 3408 })),
    ...walks.map(([x, end, y]) => ({ x, y, w: end - x, h: 12, type: 'catwalk', solid: false, arena: x > 3400 }))];
}

export const DECK_ENTRANCES = {
  'deck-raid': { x: 100, y: 260, section: 0 },
  'deck-cargo': { x: 1235, y: 260, section: 1 },
  'deck-catwalks': { x: 2325, y: 250, section: 2 },
};

// First top crossed by a descending foot/projectile, including thin catwalks.
export function landingSurface(platforms, x, oldY, y, radius = 0) {
  return platforms.filter(p => !p.dead && x + radius > p.x && x - radius < p.x + p.w && oldY <= p.y + .01 && y >= p.y)
    .sort((a, b) => a.y - b.y)[0];
}

export function surfaceBelow(platforms, x, y = -Infinity) {
  return platforms.filter(p => !p.dead && x >= p.x && x <= p.x + p.w && p.y >= y - 1).sort((a, b) => a.y - b.y)[0];
}

export function insideSolid(platforms, x, y) {
  return platforms.some(p => p.solid && x >= p.x && x <= p.x + p.w && y > p.y + 2 && y < p.y + p.h);
}

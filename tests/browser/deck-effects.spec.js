import { test, expect } from '@playwright/test';

async function open(page, level) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`); await expect(page.locator('#levels')).toBeEnabled();
}

test('the spacecraft hot palette preserves silhouette and metal detail, with a softer reduced-motion version', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'spaceship');
  const result = await page.evaluate(async () => {
    const { AirArt } = await import('/src/air-art.js'); const { hitSprite } = await import('/src/hit-flash.js');
    const { damageSpacecraft } = await import('/src/deck-boss.js');
    const art = new AirArt(); await art.load(); art.deck.spacecraft.prepare(art);
    const source = art.deck.spacecraft.bodies[0];
    const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const original = pixels(source), hot = pixels(hitSprite(source, false, 'slug')), soft = pixels(hitSprite(source, true, 'slug'));
    const colors = new Set(); let leak = 0, warm = 0, count = 0, bright = 0, softBright = 0;
    for (let i = 0; i < original.length; i += 4) {
      if (hot[i + 3] !== original[i + 3] || soft[i + 3] !== original[i + 3]) leak++;
      if (!hot[i + 3]) continue;
      count++; colors.add(`${hot[i]},${hot[i + 1]},${hot[i + 2]}`);
      if (hot[i] > hot[i + 1] && hot[i] > hot[i + 2]) warm++;
      bright = Math.max(bright, hot[i]); softBright = Math.max(softBright, soft[i]);
    }
    const g = window.__stunt.game; window.__stunt.advance(110);
    damageSpacecraft(g.boarding, g, 225, g.boarding.boss.x - 60, g.boarding.boss.y + 10);
    window.__stunt.render(); return { leak, warm, count, colors: colors.size, bright, softBright };
  });
  expect(result.leak).toBe(0); expect(result.colors).toBeGreaterThanOrEqual(6);
  expect(result.warm / result.count).toBeGreaterThan(.9); expect(result.softBright).toBeLessThan(result.bright);
  await page.screenshot({ path: info.outputPath('spacecraft-red-gold-hit.png') });
  await page.evaluate(() => window.__stunt.advance(12));
  await page.screenshot({ path: info.outputPath('spacecraft-damaged-vents.png') });
  expect(errors).toEqual([]);
});

test('the cargo shortcut renders parachuting reinforcements with clean keyed artwork and keeps them stable on pause', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'deck-cargo'); await page.evaluate(() => window.__stunt.advance(160));
  expect(await page.evaluate(() => window.__stunt.game.boarding.enemies.filter(e => e.parachuting).length)).toBe(2);
  const keys = await page.evaluate(async () => {
    const { ParatrooperArt } = await import('/src/paratrooper-art.js'); const art = new ParatrooperArt(); await art.load();
    let leaked = 0, transparent = 0;
    for (const sprite of [...art.canopies, ...art.collapse, ...art.floating, ...art.walk]) {
      const d = sprite.getContext('2d').getImageData(0, 0, sprite.width, sprite.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) transparent++;
        else if (d[i] === 0 && d[i + 1] === 255 && d[i + 2] === 0) leaked++;
      }
    }
    return { leaked, transparent };
  });
  expect(keys.leaked).toBe(0); expect(keys.transparent).toBeGreaterThan(1000);
  await page.screenshot({ path: info.outputPath('cargo-paratroopers.png') });
  await page.keyboard.press('p');
  const snapshot = await page.evaluate(() => JSON.stringify(window.__stunt.game.boarding.enemies));
  await page.evaluate(() => window.__stunt.advance(50));
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.boarding.enemies))).toBe(snapshot);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.boarding.enemies))).toBe(snapshot);
  expect(errors).toEqual([]);
});

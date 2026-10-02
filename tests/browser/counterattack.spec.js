import { test, expect } from '@playwright/test';

async function open(page, frozen = true) {
  if (frozen) await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test');
  await page.getByRole('button', { name: 'Begin flight' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
}
async function army(page) {
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.shiftCount = 6; g.retaliation = true; g.copterX = g.width / 2; g.copterY = 80;
    for (let i = 0; i < 8; i++) g.combat.miss(g, 80 + i * (g.width - 160) / 7 - 14);
    for (const s of g.combat.shooters) s.cooldown = 10000;
    window.__stunt.render();
  });
}

test('eight machines lead to the four-shot interlude, then a small armed gunner and a cleared wave', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page); await army(page);
  await page.evaluate(() => window.__stunt.advance(149));
  await expect(page.locator('#mode-label')).toHaveText('● RETALIATION');
  await page.evaluate(() => window.__stunt.advance(1));
  await expect(page.locator('#mode-label')).toHaveText('● INTERLUDE');
  await expect(page.locator('#drop-button')).toBeDisabled();
  let previous = 0;
  for (const [tick, shot] of [[25, 'eyes'], [85, 'bandana'], [140, 'machine-gun'], [190, 'first-burst']]) {
    await page.evaluate(n => window.__stunt.advance(n), tick - previous); previous = tick;
    await page.screenshot({ path: testInfo.outputPath(`cinema-${shot}.png`) });
  }
  const frozenX = await page.evaluate(() => window.__stunt.game.copterX);
  await page.keyboard.press('p');
  await page.evaluate(() => window.__stunt.advance(100));
  expect(await page.evaluate(() => window.__stunt.game.counterattack.cinemaTick)).toBe(190);
  await page.keyboard.press('p');
  await page.evaluate(() => window.__stunt.advance(40));
  await expect(page.locator('#mode-label')).toHaveText('● COUNTERATTACK');
  expect(await page.evaluate(() => window.__stunt.game.copterX)).toBe(frozenX);
  await page.evaluate(() => window.__stunt.advance(1));
  await page.screenshot({ path: testInfo.outputPath('armed-gunner.png') });
  // Hit every target with real simulated shots, using both firing directions.
  await page.evaluate(async () => {
    const g = window.__stunt.game;
    const { gunnerWeapon } = await import('/src/counterattack.js');
    for (const target of [...g.combat.shooters]) {
      g.counterattack.facing = target.x < g.width / 2 ? -1 : 1;
      g.moveCopter(g.width / 2, g.deck - 160);
      const muzzle = gunnerWeapon(g), dx = (g.deck + 28 - muzzle.y) * muzzle.vx / muzzle.vy;
      g.moveCopter(g.copterX + target.x - muzzle.x - dx, g.copterY);
      window.__stunt.advance(30);
    }
  });
  await expect(page.locator('#mode-label')).toHaveText('● VICTORY');
  expect(await page.evaluate(() => [window.__stunt.game.counterattack.kills, window.__stunt.game.score])).toEqual([8, 2000]);
  await page.screenshot({ path: testInfo.outputPath('area-clear.png') });
  await page.keyboard.press('r');
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  expect(await page.evaluate(() => window.__stunt.game.counterattack.created)).toBe(0);
  expect(errors).toEqual([]);
});

test('the letterbox survives portrait resize and reduced-motion playback', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page); await army(page);
  await page.evaluate(() => window.__stunt.advance(235));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('portrait-bandana.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => window.__stunt.game.counterattack.cinemaTick)).toBe(85);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => window.__stunt.advance(105));
  await page.screenshot({ path: testInfo.outputPath('wide-burst-reduced-motion.png') });
  await page.evaluate(() => window.__stunt.advance(41));
  await expect(page.locator('#mode-label')).toHaveText('● COUNTERATTACK');
  expect(errors).toEqual([]);
});

test('real arrow keys turn automatic fire and Space keeps the gunner aboard', async ({ page }) => {
  await open(page, false); await army(page);
  await page.evaluate(() => window.__stunt.advance(380));
  await expect(page.locator('#mode-label')).toHaveText('● COUNTERATTACK');
  const x = await page.evaluate(() => window.__stunt.game.copterX);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.counterattack.facing)).toBe(-1);
  await expect.poll(() => page.evaluate(() => window.__stunt.game.copterX)).toBeLessThan(x - 20);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.counterattack.facing)).toBe(1);
  await page.keyboard.up('ArrowRight'); await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.jumper)).toBeNull();
  expect(await page.evaluate(() => window.__stunt.game.counterattack.bullets.length)).toBeGreaterThan(0);
});

test('the illustrated gunner has transparent surroundings and moving cloth at the original small body size', async ({ page }, testInfo) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { ActionArt } = await import('/src/action-art.js');
    const { Game } = await import('/src/game.js');
    const art = new ActionArt(); await art.load();
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const c = canvas.getContext('2d'), g = new Game();
    g.copterX = 46; g.copterY = -46; g.counterattack.phase = 'cleared';
    const draw = (time, reduced = false) => {
      c.clearRect(0, 0, 128, 64); g.time = time; art.drawGunner(c, g, reduced);
      return [...c.getImageData(0, 0, 128, 64).data];
    };
    const first = draw(0), next = draw(.16), reduced = draw(0, true), reducedLater = draw(.16, true);
    const redTail = pixels => {
      const coords = [];
      for (let y = 0; y < 24; y++) for (let x = 25; x < 57; x++) {
        const p = (y * 128 + x) * 4;
        if (pixels[p] > 85 && pixels[p] > pixels[p + 1] * 1.8 && pixels[p + 3] > 90) coords.push([x, y]);
      }
      return JSON.stringify(coords);
    };
    // Review at native size and magnified, through the actual renderer.
    const review = document.createElement('canvas'); review.width = 768; review.height = 192;
    const rc = review.getContext('2d'); rc.fillStyle = '#06080c'; rc.fillRect(0, 0, 768, 192); rc.imageSmoothingEnabled = false;
    for (let i = 0; i < 3; i++) {
      draw(i * .16); rc.drawImage(canvas, i * 256, 0, 256, 128); rc.drawImage(canvas, i * 256 + 60, 128);
    }
    return { bodyHeight: art.bodyFrames.map(s => s.height), firstTail: redTail(first), nextTail: redTail(next),
      reducedStill: JSON.stringify(reduced) === JSON.stringify(reducedLater),
      corners: [0, 127, 128 * 63, 128 * 64 - 1].map(i => first[i * 4 + 3]),
      preview: review.toDataURL('image/png').split(',')[1] };
  });
  expect(result.bodyHeight).toEqual([32, 32]);
  expect(result.firstTail).not.toBe('[]'); expect(result.firstTail).not.toBe(result.nextTail);
  expect(result.reducedStill).toBe(true); expect(result.corners).toEqual([0, 0, 0, 0]);
  await testInfo.attach('small-gunner-wind-frames', { body: Buffer.from(result.preview, 'base64'), contentType: 'image/png' });
  await (await import('node:fs/promises')).writeFile(testInfo.outputPath('gunner-wind-frames.png'), Buffer.from(result.preview, 'base64'));
});

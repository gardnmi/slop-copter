import { test, expect } from '@playwright/test';

async function openRun(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.evaluate(() => {
    const g = window.__stunt.game, r = g.runner;
    g.score = 5000; r.phase = 'running'; r.x = r.runOrigin = 100; r.y = 220; r.speed = 300;
    r.roofs = [r.roof(-100, 220, 20000, 'roof')]; r.roofId = r.roofs[0].id; r.grounded = true;
    r.cameraX = r.x - r.viewWidth * .23; r.cameraY = r.y - r.viewHeight * .68;
    window.__stunt.render();
  });
}
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n), n);

test('every rescue pose includes its entire opaque body, boots and bandana from the full-size atlas', async ({ page }) => {
  await openRun(page);
  expect(await page.evaluate(async () => {
    const { RESCUE_FRAMES } = await import('/src/rescue-art.js');
    const image = new Image(); image.src = '/assets/rescue-commando-atlas.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const c = canvas.getContext('2d'); c.drawImage(image, 0, 0);
    const pixels = c.getImageData(0, 0, image.width, image.height).data;
    return RESCUE_FRAMES.map(({ rect: [left, top, width, height] }, frame) => {
      let clipped = 0;
      for (let x = Math.floor(frame * image.width / 4); x < (frame + 1) * image.width / 4; x++) for (let y = 0; y < image.height; y++) {
        if (pixels[(y * image.width + x) * 4 + 3] > 100 && (x < left || x >= left + width || y < top || y >= top + height)) clipped++;
      }
      return clipped;
    });
  })).toEqual([0, 0, 0, 0]);
});

test('twenty seconds opens the helicopter pickup; Space grabs its rail and stays in the scene through extraction', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openRun(page); await advance(page, 999);
  expect(await page.evaluate(() => window.__stunt.game.runner.rescue)).toBeNull();
  await advance(page, 1); await expect(page.locator('#mode-label')).toHaveText('● EXTRACTION');
  await advance(page, 70); await page.screenshot({ path: info.outputPath('01-camera-pullback.png') });
  await page.keyboard.press('p');
  const frozen = await page.evaluate(() => JSON.stringify(window.__stunt.game.runner));
  await advance(page, 200);
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.runner))).toBe(frozen);
  await page.keyboard.press('p'); await advance(page, 55);
  await expect(page.locator('#drop-button')).toBeEnabled();
  await expect(page.locator('#status')).toContainText('JUMP NOW');
  await expect(page.locator('#game')).toHaveAttribute('aria-label', /boarding rail/);
  await page.screenshot({ path: info.outputPath('02-ready-to-grab.png') });
  await page.keyboard.down('Space'); await advance(page, 8); await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__stunt.game.runner.phase)).toBe('lifting');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: info.outputPath('03-grab.png') });
  await advance(page, 110); await page.screenshot({ path: info.outputPath('04-lift.png') });
  await advance(page, 150); await expect(page.locator('#mode-label')).toHaveText('● NEW HEADING');
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.score)).toBe(5000);
  await page.screenshot({ path: info.outputPath('05-escaped.png') });
  expect(errors).toEqual([]);
});

test('missed pickup automatically retries a fresh approach and preserves score and checkpoint distance', async ({ page }) => {
  await openRun(page); await advance(page, 1125);
  const distance = await page.evaluate(() => {
    const r = window.__stunt.game.runner; r.blastX = r.x - 180; r.blastSpeed = r.speed;
    return r.rescueCheckpoint.distance;
  });
  await page.evaluate(() => {
    for (let i = 0; i < 400 && !window.__stunt.game.runner.dead; i++) window.__stunt.advance(1, true);
  });
  expect(await page.evaluate(() => window.__stunt.game.runner.dead)).toBe(true);
  await expect(page.locator('#drop-button')).toBeDisabled();
  await expect(page.locator('#drop-button')).toHaveText('RESTARTING ↻');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => {
    while (!window.__stunt.game.retrySerial) window.__stunt.advance(1, true);
  });
  expect(await page.evaluate(() => {
    const g = window.__stunt.game, r = g.runner;
    return { phase: r.phase, age: r.age, distance: r.distance, stage: r.rescue.stage, score: g.score };
  })).toEqual({ phase: 'rescue', age: 0, distance, stage: 'approach', score: 5000 });
  await advance(page, 125); await page.keyboard.down('ArrowUp'); await advance(page, 8); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.__stunt.game.runner.phase)).toBe('lifting');
  await page.keyboard.press('r'); expect(await page.evaluate(() => window.__stunt.game.runner.rescue)).toBeNull();
});

test('portrait touch and reduced motion can grab the helicopter, and resize preserves attachment', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRun(page); await advance(page, 1125);
  await page.screenshot({ path: info.outputPath('portrait-pickup.png') });
  const button = page.getByRole('button', { name: 'JUMP ↑' }), bounds = await button.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await advance(page, 8);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.runner.phase)).toBe('lifting');
  const position = await page.evaluate(() => { const r = window.__stunt.game.runner; return [r.x, r.y, r.rescue.x, r.rescue.y]; });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => { const r = window.__stunt.game.runner; return [r.x, r.y, r.rescue.x, r.rescue.y]; })).toEqual(position);
  await advance(page, 230); await expect(page.locator('#mode-label')).toHaveText('● EXTRACTED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
  await page.screenshot({ path: info.outputPath('landscape-extraction.png') });
});

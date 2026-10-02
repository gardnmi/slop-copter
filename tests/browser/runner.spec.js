import { test, expect } from '@playwright/test';

async function openEscape(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.shiftCount = 6; g.retaliation = true; g.counterattack.phase = 'cleared'; g.score = 2000;
    g.boss.x = g.boss.oldX = 250; g.boss.enter('hunt', g); g.carriage.phase = 'possessed';
    for (let i = 0; i < 5; i++) g.boss.grenadeHit(g);
    window.__stunt.advance(151);
  });
}
async function phase(page, phase) {
  return page.evaluate(wanted => {
    const g = window.__stunt.game;
    for (let i = 0; i < 1000 && g.runner.phase !== wanted; i++) {
      if (g.runner.flying) g.setYoke(1, 0);
      g.step(1 / 50);
    }
    window.__stunt.render(); return g.runner.phase;
  }, phase);
}
async function flat(page) {
  expect(await phase(page, 'running')).toBe('running');
  await page.evaluate(() => {
    const r = window.__stunt.game.runner; r.x = r.runOrigin = 100; r.y = 220; r.speed = 300;
    r.roofs = [r.roof(-100, 220, 10000, 'roof')]; r.roofId = r.roofs[0].id; r.grounded = true;
    r.blastX = null;
    r.cameraX = r.x - r.viewWidth * .23; window.__stunt.render();
  });
}

test('horse victory flows into the chase, destruction, roll and armed rooftop run without a dialog', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openEscape(page); await expect(page.locator('#mode-label')).toHaveText('● PURSUIT');
  await page.evaluate(() => { window.__stunt.game.setYoke(1, 0); window.__stunt.advance(170); });
  await page.screenshot({ path: info.outputPath('01-pursuit.png') });
  await page.keyboard.press('p');
  const before = await page.evaluate(() => JSON.stringify(window.__stunt.game.runner));
  await page.evaluate(() => window.__stunt.advance(150));
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.runner))).toBe(before);
  await page.keyboard.press('p');
  for (const [wanted, advance] of [['strike', 20], ['fall', 7], ['roll', 18], ['running', 30]]) {
    expect(await phase(page, wanted)).toBe(wanted);
    await page.evaluate(n => window.__stunt.advance(n), advance);
    await expect(page.locator('#overlay')).toBeHidden();
    await page.screenshot({ path: info.outputPath(`${wanted}.png`) });
  }
  await expect(page.locator('#mode-label')).toHaveText('● ROOFTOP ESCAPE');
  await expect(page.locator('#game')).toHaveAttribute('aria-label', /Hold for longer jumps/);
  expect(await page.evaluate(() => ({ score: window.__stunt.game.score, gunfire: window.__stunt.game.counterattack.bullets.length }))).toEqual({ score: 5000, gunfire: 0 });
  expect(errors).toEqual([]);
});

test('keyboard hold/release changes jump height, Up also jumps, and pause clears held input', async ({ page }) => {
  await openEscape(page); await flat(page);
  await page.keyboard.down('Space'); await page.evaluate(() => window.__stunt.advance(6));
  expect(await page.evaluate(() => window.__stunt.game.runner.jumpHeld)).toBe(true);
  const heldVy = await page.evaluate(() => window.__stunt.game.runner.vy);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__stunt.game.runner.vy)).toBe(heldVy);
  await page.evaluate(() => window.__stunt.advance(1));
  expect(await page.evaluate(() => window.__stunt.game.runner.vy)).toBeGreaterThan(heldVy);
  await page.evaluate(() => window.__stunt.advance(40));
  const jumps = await page.evaluate(() => window.__stunt.game.runner.jumps);
  await page.keyboard.down('ArrowUp'); await page.evaluate(() => window.__stunt.advance(3));
  expect(await page.evaluate(() => window.__stunt.game.runner.jumps)).toBe(jumps + 1);
  await page.keyboard.press('p'); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.__stunt.game.runner.jumpHeld)).toBe(false);
  const x = await page.evaluate(() => window.__stunt.game.runner.x);
  await page.evaluate(() => window.__stunt.advance(60));
  expect(await page.evaluate(() => window.__stunt.game.runner.x)).toBe(x);
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(40));
  expect(await page.evaluate(() => window.__stunt.game.runner.grounded)).toBe(true);
});

test('a fall stays in the scene; Space retries the roof, preserves the record, and R restarts the full game', async ({ page }, info) => {
  await openEscape(page); await flat(page); await page.evaluate(() => window.__stunt.advance(100));
  await page.evaluate(() => {
    const g = window.__stunt.game; g.runner.die(g, 'You missed the rooftop.'); window.__stunt.advance(30);
  });
  await expect(page.locator('#overlay')).toBeHidden();
  const best = await page.evaluate(() => window.__stunt.game.runner.best);
  expect(best).toBeGreaterThan(50); await page.screenshot({ path: info.outputPath('rooftop-retry.png') });
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => ({ phase: window.__stunt.game.runner.phase, distance: window.__stunt.game.runner.distance, best: window.__stunt.game.runner.best, score: window.__stunt.game.score })))
    .toEqual({ phase: 'running', distance: 0, best, score: 5000 });
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.game.runner.phase)).toBe('dormant');
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  await page.reload(); await page.getByRole('button', { name: 'Begin flight' }).click();
  expect(await page.evaluate(() => window.__stunt.game.runner.best)).toBe(best);
});

test('portrait touch jump, cancellation and resize retain the same rooftop geometry', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEscape(page); await flat(page);
  await expect(page.locator('.dpad')).toBeHidden();
  const button = page.getByRole('button', { name: 'JUMP ↑' }); await expect(button).toBeEnabled();
  const bounds = await button.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await page.evaluate(() => window.__stunt.advance(6));
  expect(await page.evaluate(() => window.__stunt.game.runner.jumpHeld)).toBe(true);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.runner.jumpHeld)).toBe(false);
  await page.keyboard.press('p');
  const geometry = await page.evaluate(() => JSON.stringify({ x: window.__stunt.game.runner.x, y: window.__stunt.game.runner.y, roofs: window.__stunt.game.runner.roofs }));
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => JSON.stringify({ x: window.__stunt.game.runner.x, y: window.__stunt.game.runner.y, roofs: window.__stunt.game.runner.roofs }))).toBe(geometry);
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(35));
  expect(await page.evaluate(() => window.__stunt.game.runner.grounded)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.__stunt.render());
  await page.screenshot({ path: info.outputPath('portrait-runner.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

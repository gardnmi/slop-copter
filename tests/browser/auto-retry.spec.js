import { test, expect } from '@playwright/test';

async function open(page, level) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`); await expect(page.locator('#begin')).toBeEnabled();
}

test('fatal first-level damage resumes the checkpoint without an overlay, click or stuck input', async ({ page }) => {
  await open(page, 'counterattack');
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => {
    const g = window.__stunt.game; g.combat.hits = 2; g.combat.hurtTicks = 0; g.counterattack.protectionTicks = 0;
    g.combat.hit(g); window.__stunt.advance(156, true);
  });
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.state)).toBe('game_over');
  await page.keyboard.press('p');
  await page.evaluate(() => window.__stunt.advance(100));
  expect(await page.evaluate(() => window.__stunt.game.retrySerial)).toBe(0);
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(60));
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => [window.__stunt.game.retrySerial, window.__stunt.game.counterattack.armed])).toEqual([1, true]);
  await page.evaluate(() => window.__stunt.advance(5, true));
  expect(await page.evaluate(() => window.__stunt.game.controlX)).toBe(0);
  await page.keyboard.up('ArrowRight');
});

test('the Top Gun alignment scene leads into manual landing and is skipped on a crash retry', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'carrier'); await page.evaluate(() => window.__stunt.advance(280));
  expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('lineup');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: info.outputPath('carrier-lineup.png') });
  await page.evaluate(() => window.__stunt.advance(120));
  expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('landing');
  await page.keyboard.down('Space'); await page.evaluate(() => window.__stunt.advance(5, true)); await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBeLessThan(100);
  await page.evaluate(() => {
    const r = window.__stunt.game.assault.recovery; Object.assign(r, { x: -100, y: 447, vy: 100 });
    window.__stunt.advance(1);
  });
  expect(await page.evaluate(() => window.__stunt.game.assault.dead)).toBe(true);
  await page.evaluate(() => window.__stunt.advance(60));
  expect(await page.evaluate(() => [window.__stunt.game.assault.phase, window.__stunt.game.assault.recovery.fuel])).toEqual(['landing', 100]);
  expect(errors).toEqual([]);
});

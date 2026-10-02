import { test, expect } from '@playwright/test';
async function open(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=landing');
  await expect(page.locator('#status')).toContainText('CATCH THE CARRIER');
}

test('landing keyboard controls use fuel, coast, pause and retry the recovery checkpoint', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  await expect(page.locator('#game')).toHaveAttribute('aria-label', /powers lift and uses fuel/);
  await page.keyboard.down('Space'); await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.__stunt.advance(25, true));
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.thrust)).toBe(1);
  await page.keyboard.down('ArrowUp');
  await page.evaluate(() => window.__stunt.advance(10, true));
  await page.keyboard.up('Space');
  await page.evaluate(() => window.__stunt.advance(10, true));
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.thrust)).toBe(1);
  await page.keyboard.down('Space'); await page.keyboard.up('ArrowUp');
  await page.evaluate(() => window.__stunt.advance(5, true));
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.thrust)).toBe(1);
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowRight');
  const powered = await page.evaluate(() => window.__stunt.game.assault.recovery);
  expect(powered.fuel).toBeCloseTo(93.8, 5);
  expect(powered.fuel).toBeLessThan(95); expect(powered.angle).toBeGreaterThan(.3);
  expect(powered.vx).toBeGreaterThan(52); expect(powered.vy).toBeLessThan(0);
  await page.evaluate(() => window.__stunt.advance(10, true));
  const coast = await page.evaluate(() => window.__stunt.game.assault.recovery);
  expect(coast.fuel).toBe(powered.fuel); expect(coast.vx).toBeGreaterThan(powered.vx * .97);
  await page.keyboard.press('p');
  await page.evaluate(() => window.__stunt.advance(200, true));
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery)).toEqual(coast);
  await page.keyboard.press('p');
  await page.evaluate(() => {
    for (let i = 0; i < 750 && !window.__stunt.game.assault.dead; i++) window.__stunt.advance(1, true);
  });
  expect(await page.evaluate(() => window.__stunt.game.assault.dead)).toBe(true);
  await page.screenshot({ path: info.outputPath('landing-crash.png') });
  await page.evaluate(() => window.__stunt.advance(60));
  expect(await page.evaluate(() => {
    const g = window.__stunt.game; return [g.assault.phase, g.assault.recovery.fuel, g.boarding.active];
  })).toEqual(['landing', 100, false]);
  await page.screenshot({ path: info.outputPath('landing-retry.png') });
  expect(errors).toEqual([]);
});

test('portrait touch lift works and resize preserves the moving world', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await page.screenshot({ path: info.outputPath('landing-portrait.png') });
  const bounds = await page.getByRole('button', { name: 'Lift', exact: true }).boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await page.evaluate(() => window.__stunt.advance(30, true));
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const state = await page.evaluate(() => window.__stunt.game.assault.recovery);
  expect(state.fuel).toBeLessThan(100); expect(state.vy).toBeLessThan(0);
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery)).toEqual(state);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
  await page.screenshot({ path: info.outputPath('landing-landscape.png') });
});

import { test, expect } from '@playwright/test';
const advance = (page, n = 1) => page.evaluate(n => window.__stunt.advance(n, true), n);
async function open(page, level) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.testPad = { index: 0, id: 'Test standard controller', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => testPad.connected ? [null, testPad] : [] });
  });
  await page.goto(`/?test${level ? `&level=${level}` : ''}`);
  await expect(page.locator('#begin')).toBeEnabled(); await advance(page);
}
async function button(page, index, down) {
  await page.evaluate(({ index, down }) => { testPad.buttons[index].pressed = down; testPad.buttons[index].value = Number(down); }, { index, down });
  await advance(page);
}
async function tap(page, index) { await button(page, index, true); await button(page, index, false); }

test('controller starts the game, flies, drops, pauses and resumes without keyboard input', async ({ page }) => {
  await open(page); await expect(page.locator('#controller-hint')).toBeVisible();
  await tap(page, 0); await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(0);
  const x = await page.evaluate(() => window.__stunt.game.copterX);
  await page.evaluate(() => testPad.axes[0] = 1); await advance(page, 10);
  expect(await page.evaluate(() => window.__stunt.game.copterX)).toBeGreaterThan(x);
  await tap(page, 0); expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(1);
  await page.evaluate(() => testPad.axes[0] = 0); await tap(page, 9);
  const frame = await page.evaluate(() => window.__stunt.game.frame); await advance(page, 25);
  expect(await page.evaluate(() => window.__stunt.game.frame)).toBe(frame);
  await tap(page, 0); await expect(page.locator('#overlay')).toBeHidden();
});

test('controller menus adjust music and effects independently and do not leak actions into the game', async ({ page }) => {
  await open(page, 'deck-raid'); await tap(page, 8);
  await expect(page.locator('#instructions')).toBeVisible(); await expect(page.locator('#sound')).toBeFocused();
  await tap(page, 13); await expect(page.locator('#music-volume')).toBeFocused();
  await tap(page, 14); await expect(page.locator('#music-volume')).toHaveValue('95');
  await expect(page.locator('#effects-volume')).toHaveValue('100');
  await tap(page, 13); await tap(page, 14); await expect(page.locator('#effects-volume')).toHaveValue('95');
  await tap(page, 1); await expect(page.locator('#instructions')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.boarding.grenades)).toBe(10);
  await tap(page, 0); expect(await page.evaluate(() => window.__stunt.game.paused)).toBe(false);
  expect(await page.evaluate(() => window.__stunt.game.boarding.jumpHeld)).toBe(false);
});

test('A and right trigger supply carrier lift only while held, and arrows still work', async ({ page }) => {
  await open(page, 'landing'); await button(page, 0, true); await advance(page, 20);
  const a = await page.evaluate(() => window.__stunt.game.assault.recovery.fuel);
  expect(a).toBeLessThan(100); await button(page, 0, false); await advance(page, 5);
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBe(a);
  await button(page, 7, true); await advance(page, 5); await button(page, 7, false);
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBeLessThan(a);
  await page.keyboard.down('ArrowRight'); await advance(page, 10); await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.angle)).toBeGreaterThan(0);
});

test('Downwell supports stick movement, A jump, X/trigger fire, and overlapping keyboard holds', async ({ page }) => {
  await open(page, 'downwell-storm');
  await button(page, 0, true); await advance(page, 3);
  expect(await page.evaluate(() => window.__stunt.game.orbit.vy)).toBeLessThan(0);
  await button(page, 0, false);
  await page.evaluate(() => { const o = window.__stunt.game.orbit; o.platforms = []; o.enemies = []; o.grounded = false; o.ammo = 8; testPad.axes[0] = 1; });
  const x = await page.evaluate(() => window.__stunt.game.orbit.x);
  await button(page, 2, true); await advance(page, 8);
  expect(await page.evaluate(() => window.__stunt.game.orbit.x)).toBeGreaterThan(x);
  expect(await page.evaluate(() => window.__stunt.game.orbit.ammo)).toBeLessThan(8);
  await page.keyboard.down('j'); await button(page, 2, false);
  expect(await page.evaluate(() => window.__stunt.game.orbit.held)).toBe(true);
  await page.keyboard.up('j'); expect(await page.evaluate(() => window.__stunt.game.orbit.held)).toBe(false);
  await button(page, 7, true); expect(await page.evaluate(() => window.__stunt.game.orbit.held)).toBe(true);
  await button(page, 7, false); expect(await page.evaluate(() => window.__stunt.game.orbit.held)).toBe(false);
});

test('disconnect pauses, releases fire and jump, and reconnect requires a fresh deliberate press', async ({ page }) => {
  await open(page, 'deck-raid'); await button(page, 7, true); await button(page, 0, true); await advance(page, 5);
  await page.evaluate(() => testPad.connected = false); await advance(page);
  expect(await page.evaluate(() => [window.__stunt.game.paused, window.__stunt.game.boarding.fireHeld, window.__stunt.game.boarding.jumpHeld])).toEqual([true, false, false]);
  const y = await page.evaluate(() => window.__stunt.game.boarding.y); await advance(page, 20);
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBe(y);
  await page.evaluate(() => testPad.connected = true); await advance(page, 5);
  expect(await page.evaluate(() => window.__stunt.game.paused)).toBe(true);
  await page.evaluate(() => testPad.buttons.forEach(b => { b.pressed = false; b.value = 0; })); await advance(page);
  await tap(page, 9); expect(await page.evaluate(() => window.__stunt.game.paused)).toBe(false);
  expect(await page.evaluate(() => window.__stunt.game.boarding.fireHeld)).toBe(false);
  await button(page, 7, true); expect(await page.evaluate(() => window.__stunt.game.boarding.fireHeld)).toBe(true);
});

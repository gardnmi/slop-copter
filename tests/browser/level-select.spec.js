import { test, expect } from '@playwright/test';
import { TEST_LEVELS } from '../../src/level-select.js';

async function open(page, path = '/?test') {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem('slop-copter.completed.v1', 'true');
  });
  await page.goto(path);
  await expect(page.locator('#levels')).toBeEnabled();
}
async function select(page, id) {
  await page.locator('#levels').click();
  await page.locator('#level-select').selectOption(id);
  await page.getByRole('button', { name: 'Start selected level' }).click();
  await expect(page.locator('#level-dialog')).not.toBeVisible();
}

test('every level can be launched from the visible menu and rendered without errors', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  for (const level of TEST_LEVELS) {
    await select(page, level.id);
    await expect(page).toHaveURL(new RegExp(`level=${level.id}(?:&|$)`));
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#status')).toContainText('TEST RUN');
    await expect(page.locator('#game')).toBeFocused();
    await page.evaluate(() => window.__stunt.advance(10));
  }
  await page.locator('#levels').click();
  await page.screenshot({ path: info.outputPath('level-selector.png') });
  expect(errors).toEqual([]);
});

test('the unlocked Levels button pauses for selection; Escape restores the previous pause state', async ({ page }) => {
  await open(page); await page.locator('#begin').click();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('l'); await page.keyboard.press('Shift+l');
  await expect(page.locator('#level-dialog')).toBeHidden();
  await page.locator('#levels').click();
  await expect(page.getByRole('dialog', { name: 'Jump to a level' })).toBeVisible();
  const state = await page.evaluate(() => JSON.stringify(window.__stunt.game));
  await page.evaluate(() => window.__stunt.advance(100));
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game))).toBe(state);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.paused)).toBe(false);
  await expect(page.locator('#game')).toBeFocused();
  await page.keyboard.press('p'); await page.locator('#levels').click(); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.paused)).toBe(true);
  await expect(page.getByText('Take a breather.')).toBeVisible();
});

test('testing leaves records untouched across retry, reload and returning to normal play', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    localStorage.setItem('stunt-combat.best.v1', '1234');
    localStorage.setItem('stunt-combat.rooftop-best.v1', '432');
    localStorage.setItem('stunt-combat.acceleration-time.v1', '0.85');
  });
  await page.reload(); await select(page, 'airship');
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.score = g.best = 99999; g.runner.best = 9999;
    g.assault.health = 1; g.assault.hurt = 0; g.assault.hurtPlayer(g);
    window.__stunt.advance(35);
  });
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('airship');
  await page.reload();
  await expect(page.locator('#mode-label')).toHaveText('● IRON VULTURE');
  expect(await page.evaluate(() => {
    const g = window.__stunt.game; return [g.best, g.runner.best, g.accelerationTime];
  })).toEqual([1234, 432, .85]);
  await page.evaluate(() => { const g = window.__stunt.game; g.best = 99999; g.runner.best = 9999; window.__stunt.render(); });
  await page.keyboard.press('r');
  await expect(page).not.toHaveURL(/level=/);
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  await expect(page.locator('#status')).not.toContainText('TEST RUN');
  expect(await page.evaluate(() => [window.__stunt.game.best, window.__stunt.game.runner.best])).toEqual([1234, 432]);
  expect(await page.evaluate(() => [localStorage.getItem('stunt-combat.best.v1'), localStorage.getItem('stunt-combat.rooftop-best.v1')])).toEqual(['1234', '432']);
});

test('production deep links and invalid links work without exposing the development hook', async ({ page }) => {
  await open(page, 'http://127.0.0.1:4174/?level=landing');
  await expect(page.locator('#mode-label')).toHaveText('● CARRIER LANDING');
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => typeof window.__stunt)).toBe('undefined');
  await page.goto('http://127.0.0.1:4174/?level=unknown');
  await expect(page.locator('#begin')).toBeEnabled();
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  await expect(page.locator('#overlay')).toBeVisible();
});

test('portrait menu fits, supports touch selection and launches a playable rooftop run', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page); await page.locator('#levels').click();
  await page.locator('#level-select').selectOption('rooftops');
  await page.screenshot({ path: info.outputPath('portrait-level-selector.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const dialog = await page.locator('#level-dialog').boundingBox();
  expect(dialog.x).toBeGreaterThanOrEqual(0); expect(dialog.x + dialog.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Start selected level' }).click();
  await expect(page.locator('#drop-button')).toHaveText('JUMP ↑');
  const bounds = await page.locator('#drop-button').boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await page.evaluate(() => window.__stunt.advance(6));
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.runner.jumps)).toBe(1);
});

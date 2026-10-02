import { test, expect } from '@playwright/test';
// Poll the real held-key/touch state just as the animation loop does.
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n, true), n);
async function open(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=deck-raid'); await expect(page.locator('#levels')).toBeEnabled();
}
test('deck keyboard movement, jump, crouch, upward fire, pause and checkpoint retry work', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  await expect(page.locator('#mode-label')).toHaveText('● AFT DECK'); await expect(page.locator('#drop-button')).toBeHidden();
  await page.keyboard.down('j');
  await page.keyboard.down('ArrowRight'); await advance(page, 20); await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__stunt.game.boarding.x)).toBe(160);
  await page.keyboard.down('k'); await advance(page, 10); await page.keyboard.up('k');
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBeLessThan(220);
  await advance(page, 40); await page.keyboard.down('ArrowDown'); await advance(page, 2);
  expect(await page.evaluate(() => window.__stunt.game.boarding.crouching)).toBe(true);
  await page.keyboard.up('ArrowDown'); await page.keyboard.down('ArrowUp'); await advance(page, 10); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.some(s => s.vy < 0))).toBe(true);
  await page.keyboard.press('p');
  const frozen = await page.evaluate(() => JSON.stringify(window.__stunt.game.boarding)); await advance(page, 50);
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.boarding))).toBe(frozen);
  await page.keyboard.press('p');
  await page.evaluate(() => { const g = window.__stunt.game; g.boarding.health = 1; g.boarding.hurt = 0; g.boarding.hurtPlayer(g); window.__stunt.advance(35); });
  await expect(page.locator('[data-deck-action="jump"] small')).toHaveText('RETRY'); await page.keyboard.press('k');
  expect(await page.evaluate(() => [window.__stunt.game.boarding.phase, window.__stunt.game.boarding.health])).toEqual(['raid', 5]);
  await page.screenshot({ path: info.outputPath('deck-raid.png') }); expect(errors).toEqual([]);
});

test('portrait touch jump works alongside the movement pad; resize retains progress', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await expect(page.locator('.dpad')).toBeVisible();
  const bounds = await page.locator('[data-deck-action="jump"]').boundingBox(), touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await advance(page, 8); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBeLessThan(230);
  const before = await page.evaluate(() => [window.__stunt.game.boarding.x, window.__stunt.game.boarding.y]);
  await page.screenshot({ path: info.outputPath('portrait-deck.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => [window.__stunt.game.boarding.x, window.__stunt.game.boarding.y])).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
});

test('the spacecraft is reached with normal inputs and the end remains in the scene', async ({ page }, info) => {
  await open(page);
  expect(await page.evaluate(async () => {
    const { deckRouteInput, spacecraftInput } = await import('/tests/helpers/deck-playthrough.js');
    const g = window.__stunt.game, d = g.boarding, route = { jump: 0 };
    for (let n = 0; n < 5000 && d.playing; n++) {
      if (d.boss) spacecraftInput(g); else deckRouteInput(g, route);
      g.step(.02);
      // Render every boss tick, including the first frame after arena entry.
      if (d.boss) window.__stunt.render();
    }
    window.__stunt.advance(1); return d.phase;
  })).toBe('cleared');
  await expect(page.locator('#mode-label')).toHaveText('● THE FLOOR GIVES WAY'); await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: info.outputPath('spacecraft-reached.png') });
});

test('the hangar shortcut supports a keyboard jump onto the next tier and a drop to the lower bay', async ({ page }, info) => {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=deck-catwalks'); await expect(page.locator('#levels')).toBeEnabled();
  await page.keyboard.down('j'); await page.keyboard.down('ArrowRight'); await advance(page, 38);
  await page.keyboard.down('k'); await advance(page, 34); await page.keyboard.up('k'); await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBe(206);
  await page.screenshot({ path: info.outputPath('hangar-upper-route.png') });
  await page.keyboard.down('ArrowDown'); await advance(page, 1); await page.keyboard.down('k'); await advance(page, 32);
  await page.keyboard.up('k'); await page.keyboard.up('ArrowDown'); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBe(308);
  expect(await page.evaluate(() => window.__stunt.game.boarding.phase)).toBe('raid');
});

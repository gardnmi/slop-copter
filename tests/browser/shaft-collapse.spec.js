import { test, expect } from '@playwright/test';

test('Warden crash keeps the same player through falling debris, palette change and live well controls', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=shaft-collapse'); await expect(page.locator('#levels')).toBeEnabled();
  await page.evaluate(() => window.__stunt.advance(62));
  await page.screenshot({ path: info.outputPath('01-warden-crashes.png') });
  await page.evaluate(() => {
    while (!window.__stunt.game.orbit.active) window.__stunt.advance(1);
  });
  for (const [age, name] of [[12, '02-lift-breaks'], [50, '03-falling-through-shaft'], [115, '04-three-ink-shift'], [175, '05-well-emerges'], [219, '06-before-control']]) {
    await page.evaluate(age => window.__stunt.advance(age - window.__stunt.game.orbit.age), age);
    expect(await page.evaluate(() => window.__stunt.game.orbit.phase)).toBe('breach');
    const state = await page.evaluate(() => JSON.stringify(window.__stunt.game.orbit));
    await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__stunt.render(); });
    expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.orbit))).toBe(state);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
  }
  const mismatch = await page.evaluate(() => {
    const canvas = document.querySelector('#game'), c = canvas.getContext('2d');
    const before = c.getImageData(0, 0, canvas.width, canvas.height).data;
    window.__stunt.advance(1);
    const after = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 0; i < after.length; i += 4)
      if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 80) changed++;
    return changed / (after.length / 4);
  });
  expect(mismatch).toBeLessThan(.035);
  expect(await page.evaluate(() => window.__stunt.game.orbit.phase)).toBe('falling');
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('j');
  await page.evaluate(() => window.__stunt.advance(12, true));
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.__stunt.game.orbit.x)).toBeGreaterThan(175);
  expect(await page.evaluate(() => window.__stunt.game.orbit.ammo)).toBeLessThan(8);
  await page.screenshot({ path: info.outputPath('07-playable-descent.png') });
  expect(errors).toEqual([]);
});

test('collapse pauses and resizes into portrait without losing the rider or restarting the fall', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?test&level=shaft-collapse'); await expect(page.locator('#levels')).toBeEnabled();
  await page.evaluate(() => window.__stunt.advance(150));
  await page.screenshot({ path: info.outputPath('collapse-portrait.png') });
  await page.keyboard.press('p');
  const state = await page.evaluate(() => JSON.stringify(window.__stunt.game.orbit));
  await page.evaluate(() => window.__stunt.advance(100)); await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.orbit))).toBe(state);
  await page.keyboard.press('p');
  await page.evaluate(() => {
    const o = window.__stunt.game.orbit;
    window.__stunt.advance(220 - o.age);
  });
  expect(await page.evaluate(() => [window.__stunt.game.orbit.phase, window.__stunt.game.orbit.health])).toEqual(['falling', 4]);
  await page.screenshot({ path: info.outputPath('collapse-landscape-handoff.png') });
  expect(errors).toEqual([]);
});

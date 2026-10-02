import { test, expect } from '@playwright/test';

async function open(page, frozen = true) {
  if (frozen) await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.evaluate(() => {
    const g = window.__stunt.game; g.shiftCount = 6; g.retaliation = true;
    g.counterattack.phase = 'active'; g.counterattack.created = 8;
    for (let i = 0; i < 8; i++) {
      const s = { x: 70 + i * (g.width - 140) / 7, health: 2 };
      g.combat.shooters.push(s); g.counterattack.hit(g, s, { vx: 10 }); g.counterattack.hit(g, s, { vx: 10 });
    }
    window.__stunt.advance(1);
  });
}

test('Matrix victory keeps the scene visible before eight mercury pools coat the carriage and become the hunter', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await expect(page.locator('#mode-label')).toHaveText('● VICTORY');
  await page.evaluate(() => window.__stunt.advance(90));
  await expect(page.locator('#overlay')).toBeHidden();
  // The old canvas victory card covered the ground and every gameplay sprite.
  expect(await page.evaluate(() => {
    const g = window.__stunt.game, canvas = document.querySelector('#game');
    return [...canvas.getContext('2d').getImageData(10, Math.round((g.deck + 49) * canvas.height / g.height), 1, 1).data];
  })).toEqual([32, 58, 43, 255]);
  await page.screenshot({ path: info.outputPath('01-victory.png') });
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(300));
  expect(await page.evaluate(() => window.__stunt.game.boss.age)).toBe(90);
  await page.keyboard.press('p');
  for (const [ticks, phase, file] of [[130, 'melt', '02-melting'], [80, 'flow', '03-flowing'], [120, 'engulf', '04-coating'], [70, 'reveal', '05-reforming'], [25, 'hunt', '06-hunter']]) {
    await page.evaluate(t => window.__stunt.advance(t), ticks);
    expect(await page.evaluate(() => window.__stunt.game.boss.phase)).toBe(phase);
    await page.screenshot({ path: info.outputPath(`${file}.png`) });
  }
  await expect(page.locator('#mode-label')).toHaveText('● LIQUID HUNTER');
  await expect(page.locator('#game')).toHaveAttribute('aria-label', /Five grenade hits/);
  await page.evaluate(() => window.__stunt.advance(105));
  expect(await page.evaluate(() => window.__stunt.game.boss.rockets.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__stunt.game.counterattack.bullets.length)).toBe(0);
  await page.screenshot({ path: info.outputPath('07-homing-rocket.png') });
  await page.keyboard.press('r');
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  expect(await page.evaluate(() => window.__stunt.game.boss.phase)).toBe('dormant'); expect(errors).toEqual([]);
});

test('real Space drops a grenade while arrow-key steering stays independent and gunfire stays off', async ({ page }) => {
  await open(page, false);
  const victoryX = await page.evaluate(() => window.__stunt.game.copterX);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.copterX)).toBeGreaterThan(victoryX + 20);
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__stunt.game.boss.phase)).toBe('victory');
  await page.evaluate(() => {
    window.__stunt.advance(515); const g = window.__stunt.game;
    g.boss.rocketCooldown = 10000; g.moveCopter(g.boss.x + 25, g.deck - 220); window.__stunt.render();
  });
  await expect(page.locator('#drop-button')).toBeEnabled();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.boss.reload)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__stunt.game.jumper)).toBeNull();
  await expect(page.locator('#drop-button')).toBeDisabled();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBeGreaterThan(1);
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.boss.hits)).toBe(1);
  expect(await page.evaluate(() => window.__stunt.game.counterattack.bullets.length)).toBe(0);
});

test('portrait victory, reduced motion and five touch grenades survive pause and resize', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
  await open(page); await page.screenshot({ path: info.outputPath('portrait-victory.png') });
  await page.evaluate(() => window.__stunt.advance(410));
  await page.keyboard.press('p'); await page.setViewportSize({ width: 430, height: 932 });
  expect(await page.evaluate(() => window.__stunt.game.boss.phase)).toBe('engulf');
  expect(await page.evaluate(() => window.__stunt.game.boss.age)).toBe(35);
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(105));
  for (let hit = 1; hit <= 5; hit++) {
    await page.evaluate(() => {
      const g = window.__stunt.game; g.boss.rocketCooldown = 10000; g.boss.x = g.boss.oldX = 200;
      g.moveCopter(g.boss.x + 25, g.deck - 220); window.__stunt.render();
    });
    await page.getByRole('button', { name: 'GRENADE ↓' }).click();
    await page.evaluate(() => window.__stunt.advance(55));
    expect(await page.evaluate(() => window.__stunt.game.boss.hits)).toBe(hit);
    if (hit < 5) expect(await page.evaluate(() => window.__stunt.game.boss.phase)).toBe('hunt');
    if (hit === 2) await page.screenshot({ path: info.outputPath('portrait-grenades.png') });
  }
  await page.evaluate(() => window.__stunt.advance(85));
  await expect(page.locator('#mode-label')).toHaveText('● HUNTER DOWN');
  await page.screenshot({ path: info.outputPath('portrait-final.png') });
  expect(await page.evaluate(() => window.__stunt.game.score)).toBe(5000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(430);
  expect(errors).toEqual([]);
});

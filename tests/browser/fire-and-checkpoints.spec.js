import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Begin flight' }).click();
}

test('a cloud engulfs the stuntman in fire, hay ignites, and a later landing burns on the moving cart', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.evaluate(async () => {
    const { Game } = await import('/src/game.js'); const g = window.__stunt.game;
    g.random = new Game({ seed: 7 }).random; g.shiftCount = 1;
    g.copterX = 400; g.copterY = 20; g.cloudX = 300; g.cloudY = 130; g.cloudIndex = 2; g.cartX = 164;
  });
  await page.keyboard.press('Space'); await page.evaluate(() => window.__stunt.advance(80));
  expect(await page.evaluate(() => window.__stunt.game.jumper.burning)).toBe(true);
  const warmPixels = await page.evaluate(() => {
    const g = window.__stunt.game, canvas = document.querySelector('#game'), c = canvas.getContext('2d');
    const scale = canvas.width / g.width, { x, y } = g.jumper;
    const data = c.getImageData((x - 8) * scale, (y - 18) * scale, 46 * scale, 58 * scale).data;
    let warm = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 180 && data[i + 1] > 50 && data[i + 2] < 170) warm++;
    return warm;
  });
  expect(warmPixels).toBeGreaterThan(200);
  await page.screenshot({ path: info.outputPath('01-engulfed-stuntman.png') });
  await page.evaluate(() => window.__stunt.advance(15));
  expect(await page.evaluate(() => [window.__stunt.game.outcome, window.__stunt.game.carriage.hayBurning])).toEqual(['hay', true]);
  await page.screenshot({ path: info.outputPath('02-burning-hay.png') });
  await page.evaluate(() => {
    window.__stunt.advance(45); const g = window.__stunt.game;
    g.cloudEnabled = false; g.copterX = g.cartX + 32; g.copterY = g.deck - 72;
  });
  await page.keyboard.press('Space'); await page.evaluate(() => window.__stunt.advance(14));
  expect(await page.evaluate(() => [window.__stunt.game.outcome, window.__stunt.game.catches, window.__stunt.game.misses])).toEqual(['fire', 1, 1]);
  await page.screenshot({ path: info.outputPath('03-fatal-hay.png') });
  await page.keyboard.press('p'); await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => window.__stunt.game.carriage.hayBurning)).toBe(true);
  await page.keyboard.press('p'); await page.evaluate(() => window.__stunt.advance(23));
  expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(2);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.game.carriage.hayBurning)).toBe(false);
  expect(errors).toEqual([]);
});

test('grenade helper draws only inside the dashboard and the hunter automatically retries its checkpoint', async ({ page }, info) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.shiftCount = 6; g.retaliation = true; g.score = 2000;
    g.counterattack.phase = 'cleared'; g.counterattack.created = g.counterattack.kills = 8;
    g.boss.x = 250; g.boss.enter('hunt', g); g.carriage.phase = 'possessed';
    g.copterX = g.width / 2; g.copterY = 14; window.__stunt.advance(1);
  });
  const difference = await page.evaluate(async () => {
    const { Renderer } = await import('/src/render.js');
    const g = window.__stunt.game, canvas = document.createElement('canvas');
    canvas.width = Math.round(g.width); canvas.height = Math.round(g.height);
    const renderer = new Renderer(canvas); await renderer.load(); renderer.draw(g);
    const original = renderer.c.getImageData(0, 0, canvas.width, canvas.height).data;
    renderer.bossArt.hud = () => {}; renderer.draw(g);
    const without = renderer.c.getImageData(0, 0, canvas.width, canvas.height).data;
    let sky = 0, dashboard = 0;
    for (let i = 0; i < original.length; i += 4) if (original[i] !== without[i] || original[i + 1] !== without[i + 1] || original[i + 2] !== without[i + 2]) {
      if (Math.floor(i / 4 / canvas.width) < g.hudY) sky++; else dashboard++;
    }
    return { sky, dashboard };
  });
  expect(difference.sky).toBe(0); expect(difference.dashboard).toBeGreaterThan(1000);
  await page.screenshot({ path: info.outputPath('04-clear-flight-area.png') });
  await page.evaluate(() => {
    const g = window.__stunt.game; g.boss.hits = 3; g.combat.hits = 2; g.counterattack.protectionTicks = 0;
    g.combat.hit(g); window.__stunt.advance(156);
  });
  await expect(page.locator('#overlay')).toBeHidden();
  await page.evaluate(() => window.__stunt.advance(60));
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => [window.__stunt.game.boss.phase, window.__stunt.game.boss.hits, window.__stunt.game.score, window.__stunt.game.combat.hits])).toEqual(['hunt', 0, 2000, 0]);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.boss.grenades.length)).toBe(1);
});

test('the Matrix chapter drops unattended until eight, then stops for the interlude', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.cloudEnabled = false; g.copterX = 750; g.copterY = 20;
    for (let i = 0; i < 6; i++) { g.jumper = { x: g.cartX + 220, y: g.deck - 31 }; g.state = 'falling'; window.__stunt.advance(13); }
    g.combat.hurtTicks = 10000;
  });
  await expect(page.locator('#drop-button')).toContainText('AUTO DROP');
  await page.evaluate(() => {
    const g = window.__stunt.game;
    for (let i = 0; i < 3000 && g.counterattack.phase === 'dormant'; i++) g.step(1 / 50);
    window.__stunt.render();
  });
  expect(await page.evaluate(() => [window.__stunt.game.counterattack.created, window.__stunt.game.counterattack.phase, window.__stunt.game.jumper])).toEqual([8, 'waiting', null]);
  await expect(page.locator('#drop-button')).toBeDisabled();
  await page.evaluate(() => window.__stunt.advance(150));
  await expect(page.locator('#mode-label')).toHaveText('● INTERLUDE');
});

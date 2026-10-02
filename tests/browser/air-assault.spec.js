import { test, expect } from '@playwright/test';

async function open(page, frozen = true) {
  if (frozen) await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test'); await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.evaluate(() => {
    const g = window.__stunt.game; g.shiftCount = 6; g.score = 4200;
    g.assault.begin(g); g.assault.startSection(g); window.__stunt.render();
  });
}
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n), n);

test('overhead flight uses real arrow acceleration, automatic cannon and no bomb action', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page, false);
  await expect(page.locator('#mode-label')).toHaveText('● BURNING CITY');
  const start = await page.evaluate(() => ({ x: window.__stunt.game.assault.x, y: window.__stunt.game.assault.y }));
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.assault.x)).toBeGreaterThan(start.x + 12);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.__stunt.game.assault.y)).toBeLessThan(start.y);
  await expect(page.locator('#drop-button')).toBeHidden();
  await expect(page.locator('#flight-status')).toContainText('AUTO CANNON');
  expect(await page.evaluate(() => window.__stunt.game.assault.shots.length)).toBeGreaterThan(0);
  await page.keyboard.press('Space'); expect(await page.evaluate(() => 'bombs' in window.__stunt.game.assault)).toBe(false);
  await page.keyboard.press('p');
  const frozen = await page.evaluate(() => JSON.stringify(window.__stunt.game.assault));
  await advance(page, 100); expect(await page.evaluate(() => JSON.stringify(window.__stunt.game.assault))).toBe(frozen);
  await page.keyboard.press('p'); await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: info.outputPath('overhead-flight.png') }); expect(errors).toEqual([]);
});

test('the enemy airship falls, friendly carrier arrival leads through landing into the deck raid', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  await page.evaluate(() => { const g = window.__stunt.game; g.assault.beginAirship(g); window.__stunt.advance(150); });
  await page.screenshot({ path: info.outputPath('01-airship-contact.png') });
  expect(await page.evaluate(() => {
    const g = window.__stunt.game, a = g.assault;
    for (let n = 0; n < 3000 && a.phase !== 'landing' && !a.dead; n++) {
      if (a.phase === 'airship') {
        const part = a.airship.parts.find(p => p.hp > 0);
        if (part) g.setYoke((part.x - a.x) / 40, (a.height * .8 - a.y) / 40);
      }
      g.step(1 / 50);
    }
    window.__stunt.render(); return a.phase;
  })).toBe('landing');
  await expect(page.locator('#mode-label')).toHaveText('● CARRIER LANDING');
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.__stunt.advance(35, true));
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: info.outputPath('02-controlled-approach.png') });
  await page.keyboard.press('p');
  const age = await page.evaluate(() => window.__stunt.game.assault.age); await advance(page, 150);
  expect(await page.evaluate(() => window.__stunt.game.assault.age)).toBe(age);
  await page.keyboard.press('p');
  expect(await page.evaluate(async () => {
    const { pilotCarrier } = await import('/tests/helpers/carrier-pilot.js');
    const g = window.__stunt.game;
    for (let i = 0; i < 1500 && g.assault.recovery.status === 'flying'; i++) { pilotCarrier(g); g.step(.02); }
    window.__stunt.render(); return g.assault.recovery.status;
  })).toBe('landed');
  await page.screenshot({ path: info.outputPath('03-touchdown.png') });
  await advance(page, 100); await expect(page.locator('#mode-label')).toHaveText('● AFT DECK');
  await expect(page.locator('#overlay')).toBeHidden(); await expect(page.locator('#status')).toContainText('spacecraft');
  expect(await page.evaluate(() => window.__stunt.game.boarding.playing)).toBe(true);
  await expect(page.locator('#drop-button')).toHaveText('JUMP ↑');
  await page.screenshot({ path: info.outputPath('05-deck-raid.png') }); expect(errors).toEqual([]);
});

test('defeat continues the current assault district and R still resets the original game', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__stunt.game, a = g.assault; a.startSection(g, 2); a.addScore(g, 999);
    a.health = 1; a.hurt = 0; a.hurtPlayer(g); window.__stunt.advance(35);
  });
  await expect(page.locator('#overlay')).toBeHidden(); await expect(page.locator('#drop-button')).toHaveText('RESTARTING ↻');
  await page.evaluate(() => window.__stunt.advance(25));
  expect(await page.evaluate(() => { const g = window.__stunt.game, a = g.assault; return [a.phase, a.route, a.health, g.score]; }))
    .toEqual(['flight', 2, 6, 4200]);
  await page.keyboard.press('r'); expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('dormant');
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
});

test('portrait touch controls return for the assault; steering and landscape resize work with reduced motion', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await expect(page.locator('.dpad')).toBeVisible();
  await expect(page.locator('#drop-button')).toBeHidden();
  const right = page.getByRole('button', { name: 'Fly right', exact: true }), bounds = await right.boundingBox();
  const touch = await page.context().newCDPSession(page);
  const x = await page.evaluate(() => window.__stunt.game.assault.x);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }] });
  await page.evaluate(() => window.__stunt.advance(20, true));
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.assault.x)).toBeGreaterThan(x);
  await advance(page, 160); await page.screenshot({ path: info.outputPath('portrait-air-assault.png') });
  await page.keyboard.press('p');
  const health = await page.evaluate(() => window.__stunt.game.assault.health);
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => window.__stunt.game.assault.health)).toBe(health);
  await page.keyboard.press('p');
  await page.evaluate(() => { const g = window.__stunt.game; g.assault.beginCarrier(g); g.assault.enter('landing', g); window.__stunt.advance(30); });
  await page.screenshot({ path: info.outputPath('landscape-landing.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
});

test('district boundaries scroll as one continuous rendered map, including fire and smoke', async ({ page }) => {
  await open(page);
  const checks = await page.evaluate(async () => {
    const { CityArt } = await import('/src/city-art.js');
    const { DISTRICT_STARTS } = await import('/src/air-world.js');
    const art = new CityArt(); await art.load();
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 300;
    const c = canvas.getContext('2d'), results = [];
    for (const boundary of DISTRICT_STARTS.slice(1)) {
      art.draw(c, { scroll: boundary - 8, time: 4 }, 480, 300, false);
      const before = c.getImageData(0, 0, 480, 284).data;
      art.draw(c, { scroll: boundary + 8, time: 4 }, 480, 300, false);
      const after = c.getImageData(0, 16, 480, 284).data;
      let changed = 0; for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 2) changed++;
      results.push(changed / before.length);
    }
    return results;
  });
  for (const fraction of checks) expect(fraction).toBeLessThan(.001);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`helicopter leap keeps the viewport and camera continuous at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('/?test&level=self-destruct');
    await expect(page.locator('#status')).toContainText('TEST RUN');
    const bounds = await page.locator('#game').boundingBox();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const phases = await page.evaluate(() => {
      const g = window.__stunt.game, seen = [];
      let previous = '', largestSpeedChange = 0, lastVX = 0;
      for (let i = 0; i < 1200; i++) {
        const r = g.runner;
        if (r.flying) g.setYoke(1, 0);
        const was = r.phase; lastVX = r.cameraVX;
        g.step(1 / 50);
        if (['fall', 'roll', 'running'].includes(was)) largestSpeedChange = Math.max(largestSpeedChange, Math.abs(r.cameraVX - lastVX));
        if (r.phase !== previous) { seen.push(r.phase); previous = r.phase; }
        if (r.phase === 'running' && r.age >= 15) break;
      }
      window.__stunt.render();
      return { seen, largestSpeedChange, phase: g.runner.phase };
    });
    expect(phases.seen).toEqual(['dormant', 'pursuit', 'strike', 'fall', 'roll', 'running']);
    expect(phases.largestSpeedChange).toBeLessThanOrEqual(12.001);
    expect(phases.phase).toBe('running');
    expect(await page.locator('#game').boundingBox()).toEqual(bounds);
    await page.screenshot({ path: info.outputPath(`rooftop-handoff-${viewport.width}.png`) });
    expect(errors).toEqual([]);
  });
}

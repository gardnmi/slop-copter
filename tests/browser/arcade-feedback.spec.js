import { test, expect } from '@playwright/test';
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n, true), n);
async function open(page, level = 'deck-raid') {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`); await expect(page.locator('#levels')).toBeEnabled();
}

test('J fires only while held; L and Shift L throw grenades without opening a menu', async ({ page }) => {
  await open(page); await advance(page, 12);
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.length)).toBe(0);
  await page.keyboard.down('j'); await advance(page, 12);
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.length)).toBeGreaterThan(0);
  await page.keyboard.up('j'); await page.evaluate(() => window.__stunt.game.boarding.shots = []); await advance(page, 12);
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.length)).toBe(0);
  await page.keyboard.down('l'); await advance(page, 40);
  expect(await page.evaluate(() => window.__stunt.game.boarding.grenades)).toBe(9);
  await expect(page.locator('#level-dialog')).not.toBeVisible();
  await page.keyboard.up('l'); await page.keyboard.press('Shift+l');
  await expect(page.locator('#level-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.boarding.grenades)).toBe(8);
  await page.keyboard.down('j'); await advance(page, 8); await page.keyboard.press('p');
  await page.keyboard.up('j'); await page.keyboard.press('p');
  await page.evaluate(() => window.__stunt.game.boarding.shots = []); await advance(page, 8);
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.length)).toBe(0);
});

test('touch supports simultaneous movement, shooting and jumping, with a separate green grenade button', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page);
  const cdp = await page.context().newCDPSession(page), points = [];
  for (const [id, selector] of ['[data-direction="right"]', '[data-deck-action="shoot"]', '[data-deck-action="jump"]'].entries()) {
    const r = await page.locator(selector).boundingBox(); points.push({ id, x: r.x + r.width / 2, y: r.y + r.height / 2 });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points }); await advance(page, 10);
  expect(await page.evaluate(() => { const d = window.__stunt.game.boarding; return d.x > 100 && d.y < 230 && d.shots.length > 0; })).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const r = await page.locator('[data-deck-action="grenade"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 4, x: r.x + r.width / 2, y: r.y + r.height / 2 }] });
  await advance(page, 5); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => window.__stunt.game.boarding.grenades)).toBe(9);
  await expect(page.locator('#level-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: info.outputPath('metal-slug-touch-controls.png') });
});

test('standard gamepad movement and action buttons work; disconnect releases held inputs', async ({ page }) => {
  await page.addInitScript(() => {
    window.testPad = { connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => window.testPad.connected ? [window.testPad] : [] });
  });
  await open(page); await advance(page, 1);
  await page.evaluate(() => { testPad.axes[0] = 1; testPad.buttons[2].pressed = testPad.buttons[0].pressed = testPad.buttons[1].pressed = true; });
  await advance(page, 10);
  expect(await page.evaluate(() => { const d = window.__stunt.game.boarding; return d.x > 100 && d.y < 230 && d.shots.length > 0 && d.grenades === 9; })).toBe(true);
  await page.evaluate(() => { testPad.connected = false; window.__stunt.game.boarding.shots = []; }); await advance(page, 10);
  expect(await page.evaluate(() => { const g = window.__stunt.game, d = g.boarding; return [g.paused, d.fireHeld, d.jumpHeld, d.shots.length]; })).toEqual([true, false, false, 0]);
});

test('boss damage stays within the hull alpha and successful hits swap the sprite palette instead of drawing health bars', async ({ page }, info) => {
  await open(page, 'airship');
  const results = await page.evaluate(async () => {
    const { AirArt } = await import('/src/air-art.js');
    const { damageAirship } = await import('/src/airship.js');
    const art = new AirArt(); await art.load();
    const g = window.__stunt.game, a = g.assault; a.shotClock = 1000; window.__stunt.advance(160);
    const c = document.createElement('canvas'); c.width = Math.ceil(a.width); c.height = Math.ceil(a.height);
    const context = c.getContext('2d'); context.imageSmoothingEnabled = false;
    const draw = () => { context.clearRect(0, 0, c.width, c.height); art.airship(context, a, false); return context.getImageData(0, 0, c.width, c.height).data; };
    const full = draw(); a.airship.parts[0].hp = 1; const low = draw();
    const noBar = full.every((value, i) => value === low[i]);
    a.airship.parts[0].hp = 58; damageAirship(a, g, a.airship.parts[0], 1); const hit = draw();
    let brighter = 0; for (let i = 0; i < hit.length; i += 4) if (hit[i] > full[i] + 60) brighter++;
    damageAirship(a, g, a.airship.parts[0], 100); damageAirship(a, g, a.airship.parts[1], 100); draw();
    const damage = art.damageSurface, pixels = damage.getContext('2d').getImageData(0, 0, damage.width, damage.height).data;
    const mask = document.createElement('canvas'); mask.width = damage.width; mask.height = damage.height;
    const mc = mask.getContext('2d'); mc.imageSmoothingEnabled = false;
    const b = a.airship, source = art.sprites.airship; mc.drawImage(source, 0, 0, b.width, b.width * source.height / source.width);
    const alpha = mc.getImageData(0, 0, mask.width, mask.height).data;
    let leaked = 0, painted = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) painted++; if (pixels[i] && !alpha[i]) leaked++; }
    window.__stunt.advance(80); window.__stunt.render(); return { noBar, brighter, leaked, painted };
  });
  expect(results.noBar).toBe(true); expect(results.brighter).toBeGreaterThan(100);
  expect(results.leaked).toBe(0); expect(results.painted).toBeGreaterThan(100);
  await page.screenshot({ path: info.outputPath('damaged-airship-without-bars.png') });
});

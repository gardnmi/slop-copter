import { test, expect } from '@playwright/test';

async function open(page, level = 'burning-city') {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`);
  await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.assault.active)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(async () => {
    window.__stunt.render();
    const audio = window.__stunt.audio.airAudio; await audio.ready;
    window.airPlays = []; const play = audio.play.bind(audio);
    audio.play = (...args) => { window.airPlays.push(args[0]); return play(...args); };
  });
}
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n, true), n);

test('Raiden samples play for actual combat events, with a single restrained helicopter bed', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.buffers.size)).toBe(9);
  await page.evaluate(() => {
    const g = window.__stunt.game, a = g.assault;
    const enemy = a.spawn('tank'); Object.assign(enemy, { x: a.x - 7, y: a.y - 55, hp: 2, speed: 0, cooldown: 200 });
    a.supply(a.x, a.y, 'power');
    for (let i = 0; i < 6; i++) { g.step(1 / 50); window.__stunt.audio.update(g); }
    window.__stunt.render();
  });
  expect(await page.evaluate(() => window.airPlays)).toEqual(expect.arrayContaining(['cannon', 'impact', 'light-ground', 'powerup']));
  const before = await page.evaluate(() => window.airPlays.length);
  await page.evaluate(() => { for (let i = 0; i < 100; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.airPlays.length)).toBe(before);
  const rotor = await page.evaluate(() => {
    const a = window.__stunt.audio.airAudio;
    return { loops: [...a.voices].filter(v => v.source.loop).length, gain: a.rotor.gain.gain.value,
      imported: a.buffers.get('cannon') !== a.fallbacks.get('contact'), duration: a.buffers.get('cannon').duration };
  });
  expect(rotor.loops).toBe(1); expect(rotor.gain).toBeLessThan(.056);
  expect(rotor.imported).toBe(true); expect(rotor.duration).toBeLessThan(.12);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.assault.hurt = 0; g.assault.health = 1; g.assault.hurtPlayer(g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.airPlays)).toContain('dead');
  expect(await page.evaluate(() => !!window.__stunt.audio.airAudio.rotor)).toBe(false);
  expect(errors).toEqual([]);
});

test('Space lift uses the same quiet rotor; mute, pause and chapter exit clean up audio', async ({ page }) => {
  await open(page, 'landing');
  await page.keyboard.down('Space'); await advance(page, 20); await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBeLessThan(100);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.rotor.gain.gain.value)).toBeLessThan(.056);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('suspended');
  const before = await page.evaluate(() => window.airPlays.length); await advance(page, 50);
  expect(await page.evaluate(() => window.airPlays.length)).toBe(before);
  await page.keyboard.press('p');
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.voices.size)).toBe(0);
  await advance(page, 10);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render());
  expect(await page.evaluate(before => window.airPlays.slice(before), before)).toEqual(['turbine', 'rotor']);
  await page.evaluate(() => { const g = window.__stunt.game; g.boarding.begin(g); window.__stunt.render(); });
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.voices.size)).toBe(0);
});

test('landing audio follows throttle, low fuel, touchdown and water impact without replaying cues', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, 'landing');
  const engine = () => page.evaluate(() => {
    const a = window.__stunt.audio.airAudio;
    return { gain: a.turbine?.gain.gain.value, pitch: a.turbine?.source.playbackRate.value,
      loops: [...a.voices].filter(v => v.source.loop).length };
  });
  await expect.poll(async () => (await engine()).gain).toBeLessThan(.02);
  await page.keyboard.down('Space'); await advance(page, 10);
  await expect.poll(async () => (await engine()).gain).toBeGreaterThan(.095);
  expect((await engine()).loops).toBe(2);
  await page.keyboard.up('Space'); await advance(page, 1);
  await expect.poll(async () => (await engine()).gain).toBeLessThan(.04);
  await page.evaluate(() => {
    window.__stunt.game.assault.recovery.fuel = 19; window.__stunt.render();
    for (let i = 0; i < 100; i++) window.__stunt.render();
  });
  expect(await page.evaluate(() => window.airPlays.filter(k => k === 'fuel-low').length)).toBe(1);
  await page.evaluate(() => {
    const g = window.__stunt.game, r = g.assault.recovery;
    r.fuel = 0; window.__stunt.render();
  });
  expect(await page.evaluate(() => window.airPlays.filter(k => k === 'fuel-empty').length)).toBe(1);
  expect(await page.evaluate(() => !!window.__stunt.audio.airAudio.turbine)).toBe(false);
  await page.evaluate(() => {
    const r = window.__stunt.game.assault.recovery;
    Object.assign(r, { x: r.shipX + 142, y: r.deckY - .1, vx: r.shipSpeed, vy: r.shipVY + 10, angle: 0 });
    window.__stunt.advance(1, true);
    for (let i = 0; i < 100; i++) window.__stunt.render();
  });
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.status)).toBe('landed');
  expect(await page.evaluate(() => window.airPlays.filter(k => k === 'touchdown').length)).toBe(1);
  await open(page, 'landing');
  await page.evaluate(() => {
    const r = window.__stunt.game.assault.recovery;
    Object.assign(r, { x: -100, y: 447, vy: 100 }); window.__stunt.advance(1, true);
  });
  expect(await page.evaluate(() => window.airPlays)).toContain('splash');
  expect(await page.evaluate(() => window.airPlays)).not.toContain('dead');
  expect(await page.evaluate(() => [...window.__stunt.audio.airAudio.voices].filter(v => v.source.loop).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('unavailable Raiden files fall back without stopping flight or stacking rotor loops', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/raiden/*.ogg', route => route.abort());
  await open(page); await advance(page, 1);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.buffers.size)).toBe(0);
  expect(await page.evaluate(() => window.airPlays)).toContain('cannon');
  await page.evaluate(() => { for (let i = 0; i < 50; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => [...window.__stunt.audio.airAudio.voices].filter(v => v.source.loop).length)).toBe(1);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.voices.size)).toBe(0);
  expect(errors).toEqual([]);
});

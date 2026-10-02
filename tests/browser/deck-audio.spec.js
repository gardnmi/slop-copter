import { test, expect } from '@playwright/test';

async function open(page, level = 'deck-raid') {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`);
  await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.boarding.active)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(async () => {
    window.__stunt.render(); const a = window.__stunt.audio.deckAudio;
    await a.ready; window.deckPlays = [];
    const play = a.play.bind(a);
    a.play = (...args) => { window.deckPlays.push(args[0]); return play(...args); };
  });
}
const advance = (page, ticks) => page.evaluate(n => { for (let i = 0; i < n; i++) window.__stunt.advance(1, true); }, ticks);

test('recorded pistol, HMG and flame shots follow real keyboard fire and weapon pickup voices', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.buffers.size)).toBe(21);
  await page.keyboard.down('j'); await advance(page, 19); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'pistol').length)).toBe(3);
  await page.evaluate(() => { window.__stunt.game.boarding.x = 270; }); await advance(page, 1);
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'pickup-heavy').length)).toBe(1);
  await page.keyboard.down('j'); await advance(page, 16); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'heavy').length)).toBe(4);
  await page.evaluate(() => {
    const d = window.__stunt.game.boarding;
    d.ammo = 1; d.shotClock = 0;
  });
  await page.keyboard.down('j'); await advance(page, 5); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'heavy').length)).toBe(5);
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'pistol').length)).toBe(4);
  await page.evaluate(() => {
    const d = window.__stunt.game.boarding;
    d.pickups.push({ x: d.x, y: d.y - 12, type: 'flame', ammo: 30 });
  });
  await advance(page, 1);
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'pickup-flame').length)).toBe(1);
  await page.keyboard.down('j'); await advance(page, 13); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'flame').length)).toBe(2);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.buffers.get('heavy').duration)).toBeCloseTo(.08, 2);
  const count = await page.evaluate(() => window.deckPlays.length);
  await page.evaluate(() => { for (let i = 0; i < 100; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.deckPlays.length)).toBe(count);
  expect(errors).toEqual([]);
});

test('simultaneous blast, death, hit and pickup effects survive the last-cue slot; retry and chapter exit clean up', async ({ page }) => {
  await open(page);
  await page.keyboard.press('l');
  await page.evaluate(() => {
    const g = window.__stunt.game, d = g.boarding;
    d.explodeGrenade(g, d.thrown[0]);
    d.hitEnemy(g, { x: d.x + 40, y: d.y, hp: 1, type: 'soldier' }, 2);
    d.hurt = 0; d.hurtPlayer(g); d.sound('pickup'); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.deckPlays)).toEqual(expect.arrayContaining(['grenade-launch', 'grenade-explosion', 'rebel-death', 'hit', 'pickup']));
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('suspended');
  const count = await page.evaluate(() => window.deckPlays.length);
  await advance(page, 100); expect(await page.evaluate(() => window.deckPlays.length)).toBe(count);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => {
    const g = window.__stunt.game, d = g.boarding;
    d.health = 1; d.hurt = 0; d.hurtPlayer(g); window.__stunt.render(); d.age = 30;
  });
  expect(await page.evaluate(() => window.deckPlays.at(-1))).toBe('player-death');
  await page.keyboard.press('k'); await page.evaluate(() => window.__stunt.render());
  expect(await page.evaluate(() => window.__stunt.game.boarding.dead)).toBe(false);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.voices.size)).toBe(0);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.boarding.emitAudio('weapon-heavy'); window.__stunt.render();
    g.orbit.startFall(g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.voices.size)).toBe(0);
});

test('mute drops missed combat sounds and missing optional samples leave controls working', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/metal-slug/pistol.ogg', route => route.abort());
  await page.route('**/assets/audio/arcade-march.ogg', route => route.abort());
  await open(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.failed)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.buffers.has('pistol'))).toBe(false);
  await page.keyboard.down('j'); await advance(page, 10); await page.keyboard.up('j');
  expect(await page.evaluate(() => window.__stunt.game.boarding.shots.length)).toBeGreaterThan(0);
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  const count = await page.evaluate(() => window.deckPlays.length);
  await page.evaluate(() => {
    const d = window.__stunt.game.boarding;
    d.emitAudio('boss-down'); d.sound('pickup'); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.voices.size)).toBe(0);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render());
  expect(await page.evaluate(() => window.deckPlays.length)).toBe(count);
  expect(errors).toEqual([]);
});

test('the Warden uses real impacts, weapon fire and bounded explosions', async ({ page }) => {
  await open(page, 'elevator');
  await page.evaluate(async () => {
    const { damageSpacecraft } = await import('/src/deck-boss.js');
    const g = window.__stunt.game, d = g.boarding, b = d.boss;
    b.state = 'warden-recover'; damageSpacecraft(d, g, 1, b.x, b.y);
    d.sound('boss-shot'); window.__stunt.render();
    damageSpacecraft(d, g, 10000, b.x, b.y); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.deckPlays)).toEqual(expect.arrayContaining(['impact', 'missile', 'boss-death', 'heavy-explosion']));
  await advance(page, 180);
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'boss-death').length)).toBe(1);
  expect(await page.evaluate(() => window.deckPlays.filter(k => k === 'heavy-explosion').length)).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.voices.size)).toBeLessThanOrEqual(16);
});

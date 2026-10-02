import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=deck-raid');
  await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.boarding.active)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render());
}
async function playing(page) {
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.media?.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.media.currentTime)).toBeGreaterThan(0);
}

test('Arcade March decodes in full, loops and stays continuous through every deck boss', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await playing(page);
  const track = await page.evaluate(() => {
    window.deckTrack = window.__stunt.audio.deckAudio.music.media;
    return { duration: window.deckTrack.duration, loop: window.deckTrack.loop, url: window.deckTrack.currentSrc };
  });
  expect(track.duration).toBeCloseTo(157.992, 1); expect(track.loop).toBe(true);
  expect(track.url).toContain('/assets/audio/arcade-march.ogg');
  await page.evaluate(() => { window.deckTrack.currentTime = window.deckTrack.duration - .2; });
  await expect.poll(() => page.evaluate(() => window.deckTrack.currentTime)).toBeLessThan(2);
  const result = await page.evaluate(async () => {
    const { deckRouteInput, spacecraftInput } = await import('/tests/helpers/deck-playthrough.js');
    const g = window.__stunt.game, d = g.boarding, route = { jump: 0 }, phases = new Set();
    window.deckTrack.currentTime = 30;
    for (let n = 0; n < 5000 && d.playing; n++) {
      if (d.boss) spacecraftInput(g); else deckRouteInput(g, route);
      g.step(.02);
      window.__stunt.render();
      if (d.miniboss) phases.add('helicopter');
      if (d.boss) phases.add(d.boss.form);
      if (window.deckTrack !== window.__stunt.audio.deckAudio.music.media || window.deckTrack.paused || window.deckTrack.currentTime < 30)
        throw new Error('Music interrupted during the deck chapter');
    }
    return { phase: d.phase, phases: [...phases] };
  });
  expect(result.phase).toBe('cleared');
  expect(result.phases).toEqual(expect.arrayContaining(['helicopter', 'ship', 'elevator']));
  await page.evaluate(() => window.__stunt.advance(45));
  expect(await page.evaluate(() => window.__stunt.game.orbit.phase)).toBe('breach');
  expect(await page.evaluate(() => window.deckTrack.paused)).toBe(false);
  await page.evaluate(() => window.__stunt.advance(80));
  await expect.poll(() => page.evaluate(() => window.deckTrack.paused)).toBe(true);
  expect(await page.evaluate(() => window.deckTrack.currentTime)).toBe(0);
  expect(errors).toEqual([]);
});

test('deck music preserves position on pause, mute and checkpoint retry, ducks voices and resets on New Game', async ({ page }) => {
  await open(page); await playing(page);
  await page.evaluate(async () => {
    const a = window.__stunt.audio.deckAudio; await a.ready;
    a.music.media.currentTime = 25;
    a.play('pickup-heavy', .58); window.__stunt.render();
  });
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.gain.gain.value)).toBeLessThan(.3);
  await page.evaluate(() => { window.__stunt.audio.deckAudio.duckUntil = 0; window.__stunt.render(); });
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.gain.gain.value)).toBeGreaterThan(.4);
  await page.keyboard.press('p');
  const position = await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.currentTime);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(true);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render()); await playing(page);
  await page.evaluate(() => {
    const g = window.__stunt.game, d = g.boarding;
    d.health = 1; d.hurt = 0; d.hurtPlayer(g); window.__stunt.render(); d.age = 30;
  });
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(true);
  await page.keyboard.press('k'); await page.evaluate(() => window.__stunt.render()); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(true);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render()); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.currentTime)).toBe(0);
});

test('blocked deck music retries on trusted input without spamming play', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play; window.deckAttempts = 0;
    addEventListener('keydown', e => { if (e.isTrusted && e.code === 'KeyX') window.allowDeckMusic = true; }, { capture: true });
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.src.includes('arcade-march')) {
        window.deckAttempts++;
        if (!window.allowDeckMusic) return Promise.reject(new DOMException('Activation needed', 'NotAllowedError'));
      }
      return play.apply(this, args);
    };
  });
  await open(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.blocked)).toBe(true);
  const attempts = await page.evaluate(() => window.deckAttempts);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.deckAttempts)).toBe(attempts);
  await page.keyboard.press('x'); await playing(page);
});

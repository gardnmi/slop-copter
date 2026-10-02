import { test, expect } from '@playwright/test';

async function open(page, level = 'carrier') {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test&level=${level}`);
  await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.assault.active)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render());
}
const playing = async page => {
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.airAudio.music.media?.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.airAudio.music.media.currentTime)).toBeGreaterThan(0);
};

test('Top Gun loop decodes, wraps and keeps its position from arrival through landing and retry', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(true);
  const track = await page.evaluate(() => {
    window.carrierTrack = window.__stunt.audio.airAudio.music.media;
    return { duration: window.carrierTrack.duration, loop: window.carrierTrack.loop, url: window.carrierTrack.currentSrc };
  });
  expect(track.duration).toBeCloseTo(112, 1); expect(track.loop).toBe(true);
  expect(track.url).toContain('/assets/audio/carrier-recovery.ogg');
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.desired)).toBe(false);
  await page.evaluate(() => { window.carrierTrack.currentTime = window.carrierTrack.duration - .2; });
  await expect.poll(() => page.evaluate(() => window.carrierTrack.currentTime)).toBeLessThan(2);
  await page.evaluate(() => { window.carrierTrack.currentTime = 30; window.__stunt.advance(400); });
  expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('landing');
  expect(await page.evaluate(() => window.carrierTrack === window.__stunt.audio.airAudio.music.media)).toBe(true);
  expect(await page.evaluate(() => window.carrierTrack.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const g = window.__stunt.game, r = g.assault.recovery;
    Object.assign(r, { x: -100, y: 447, vy: 100 }); window.__stunt.advance(1);
    g.assault.age = 30;
  });
  expect(await page.evaluate(() => window.carrierTrack.paused)).toBe(true);
  await page.keyboard.press('Space'); await page.evaluate(() => window.__stunt.render()); await playing(page);
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBe(100);
  expect(await page.evaluate(() => window.carrierTrack.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const r = window.__stunt.game.assault.recovery;
    Object.assign(r, { x: r.shipX + 142, y: r.deckY - .1, vx: r.shipSpeed, vy: r.shipVY + 10 });
    window.__stunt.advance(1);
  });
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.status)).toBe('landed');
  expect(await page.evaluate(() => window.carrierTrack.paused)).toBe(false);
  await page.evaluate(() => window.__stunt.advance(100));
  expect(await page.evaluate(() => window.__stunt.game.boarding.active)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.deckAudio.music.media.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.carrierTrack.paused)).toBe(true);
  expect(await page.evaluate(() => window.carrierTrack.currentTime)).toBe(0);
  expect(errors).toEqual([]);
});

test('direct landing music obeys pause, mute and New Game without rewinding on resume', async ({ page }) => {
  await open(page, 'landing'); await playing(page);
  await page.evaluate(() => { window.__stunt.audio.airAudio.music.media.currentTime = 20; });
  await page.keyboard.press('p');
  const position = await page.evaluate(() => window.__stunt.audio.airAudio.music.media.currentTime);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.paused)).toBe(true);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render()); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.paused)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.voices.size)).toBe(0);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(() => window.__stunt.render()); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.paused)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.airAudio.music.media.currentTime)).toBe(0);
});

test('missing recovery music does not interrupt landing effects or flight', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/carrier-recovery.ogg', route => route.abort());
  await open(page, 'landing');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.airAudio.music.failed)).toBe(true);
  await page.keyboard.down('Space'); await page.evaluate(() => window.__stunt.advance(25, true));
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.__stunt.game.assault.recovery.fuel)).toBeLessThan(100);
  expect(await page.evaluate(() => !!window.__stunt.audio.airAudio.turbine)).toBe(true);
  expect(errors).toEqual([]);
});

test('blocked recovery music retries on a trusted keypress instead of every frame', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play; window.carrierAttempts = 0;
    addEventListener('keydown', e => { if (e.isTrusted && e.code === 'KeyX') window.allowCarrierMusic = true; }, { capture: true });
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.src.includes('carrier-recovery')) {
        window.carrierAttempts++;
        if (!window.allowCarrierMusic) return Promise.reject(new DOMException('Activation needed', 'NotAllowedError'));
      }
      return play.apply(this, args);
    };
  });
  await open(page, 'landing');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.airAudio.music.blocked)).toBe(true);
  const attempts = await page.evaluate(() => window.carrierAttempts);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.carrierAttempts)).toBe(attempts);
  await page.keyboard.press('x'); await playing(page);
});

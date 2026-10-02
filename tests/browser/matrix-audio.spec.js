import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.matrixCues = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer.numberOfChannels === 2 && this.buffer.sampleRate === 32000) window.matrixCues.push(this.buffer.duration);
      return start.apply(this, args);
    };
  });
  await page.goto('/?test'); await expect(page.locator('#begin')).toBeEnabled();
  await page.locator('#begin').click();
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page);
}
const advance = (page, n = 1) => page.evaluate(n => window.__stunt.advance(n), n);
async function miss(page) {
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.jumper = { x: g.cartX + 260, y: g.deck - 31, inCloud: false };
    g.state = 'falling'; window.__stunt.advance(13);
  });
}
async function green(page) { for (let i = 0; i < 6; i++) await miss(page); }
async function playing(page) {
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.music?.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBeGreaterThan(0);
}

test('six actual conversions each sound once; the compressed song starts precisely at the green world', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  expect(await page.evaluate(() => !!window.__stunt.audio.matrix.music)).toBe(false);
  for (let stage = 1; stage <= 6; stage++) {
    await miss(page);
    expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(stage);
    expect(await page.evaluate(() => window.matrixCues.length)).toBe(stage);
    if (stage < 6) expect(await page.evaluate(() => window.__stunt.audio.matrix.music.paused)).toBe(true);
  }
  await playing(page);
  const media = await page.evaluate(() => {
    const music = window.__stunt.audio.matrix.music;
    window.savedMusic = music;
    return { url: music.currentSrc, duration: music.duration, loop: music.loop };
  });
  expect(media.url).toContain('/assets/audio/cybernetic-pursuit.ogg');
  expect(media.duration).toBeCloseTo(224.4, 1); expect(media.loop).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 100; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.matrixCues.length)).toBe(6);
  expect(await page.evaluate(() => window.savedMusic === window.__stunt.audio.matrix.music)).toBe(true);
  expect(errors).toEqual([]);
});

test('pause and mute freeze the song position; new game and the ending loop rewind it', async ({ page }) => {
  await open(page); await green(page); await playing(page);
  await page.evaluate(() => { window.__stunt.audio.matrix.music.currentTime = 20; });
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBeGreaterThanOrEqual(20);
  await page.keyboard.press('p');
  const paused = await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime);
  await advance(page, 100); await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBe(paused);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page); await playing(page);
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  const muted = await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime);
  await page.locator('#close-help').click(); await page.keyboard.press('p'); await advance(page, 50);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.paused)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBe(muted);
  await page.locator('#help').click(); await page.locator('#sound').check(); await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page); await playing(page);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBeGreaterThanOrEqual(muted);
  expect(await page.evaluate(() => window.matrixCues.length)).toBe(6);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => [window.__stunt.audio.matrix.music.paused, window.__stunt.audio.matrix.music.currentTime])).toEqual([true, 0]);
  await green(page); await playing(page);
  await page.evaluate(() => { window.__stunt.game.completeLoop(); window.__stunt.render(); });
  expect(await page.evaluate(() => [window.__stunt.audio.matrix.music.paused, window.__stunt.audio.matrix.music.currentTime])).toEqual([true, 0]);
});

test('the track continues into combat and fades away when the rooftop escape takes over', async ({ page }) => {
  await open(page); await green(page); await playing(page);
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.counterattack.phase = 'cinematic'; window.__stunt.render();
  });
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.paused)).toBe(false);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.runner.begin(g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.__stunt.audio.matrix.desired)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.music.paused)).toBe(true);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.music.currentTime)).toBe(0);
});

test('blocked music retries on input without replaying conversion effects or hammering play()', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    window.musicAllowed = false; window.musicAttempts = 0;
    window.addEventListener('keydown', e => { if (e.isTrusted && e.code === 'ArrowRight') window.musicAllowed = true; }, { capture: true });
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.src.includes('cybernetic-pursuit')) {
        window.musicAttempts++;
        if (!window.musicAllowed) return Promise.reject(new DOMException('Activation needed', 'NotAllowedError'));
      }
      return play.apply(this, args);
    };
  });
  await open(page); await green(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.blocked)).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 50; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.musicAttempts)).toBe(1);
  await page.keyboard.press('ArrowRight'); await playing(page);
  expect(await page.evaluate(() => window.matrixCues.length)).toBe(6);
});

test('missing music stays optional while transformations and gameplay continue', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/cybernetic-pursuit.ogg', route => route.abort());
  await open(page); await green(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.failed)).toBe(true);
  expect(await page.evaluate(() => window.matrixCues.length)).toBe(6);
  expect(await page.evaluate(() => window.__stunt.game.fullyThemed)).toBe(true);
  await page.keyboard.press('ArrowRight'); await advance(page, 10);
  expect(errors).toEqual([]);
});

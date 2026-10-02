import { test, expect } from '@playwright/test';

async function open(page, kill = true) {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.escapeStarts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.sampleRate === 24000) window.escapeStarts.push({ duration: this.buffer.duration, loop: this.loop, pitch: this.playbackRate.value });
      return start.apply(this, args);
    };
  });
  await page.goto('/?test&level=chrome-carriage');
  await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.boss.fighting)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  if (kill) await defeat(page);
}

async function defeat(page) {
  await page.evaluate(() => {
    const g = window.__stunt.game;
    for (let i = 0; i < 5; i++) g.boss.grenadeHit(g);
    window.__stunt.render();
  });
}

async function musicPlaying(page) {
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.escapeAudio.music.media?.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.currentTime)).toBeGreaterThan(0);
}

async function advance(page, ticks, until = null) {
  return page.evaluate(({ ticks, until }) => {
    const { game: g, audio } = window.__stunt;
    for (let i = 0; i < ticks; i++) {
      if (g.runner.flying) g.setYoke(1, 0);
      g.step(1 / 50); audio.update(g);
      if (g.runner.phase === until) break;
    }
    window.__stunt.render();
    return { phase: g.runner.phase, countdown: g.runner.detonationTicks, sounds: window.escapeStarts };
  }, { ticks, until });
}

test('fifth hit sounds the countdown, then one distant blast and a continuous chase rumble', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  expect(await page.evaluate(() => window.escapeStarts)).toMatchObject([{ duration: .28, loop: false }]);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.escapeStarts.length)).toBe(1);
  const result = await advance(page, 1400, 'running');
  expect(result.phase).toBe('running');
  expect(result.sounds.filter(s => s.duration === .28).length).toBe(12);
  expect(result.sounds.filter(s => s.duration === .14).length).toBe(10);
  const pitches = result.sounds.filter(s => s.duration === .28 || s.duration === .14).map(s => s.pitch);
  expect(new Set(pitches).size).toBe(22);
  expect(pitches.every((pitch, i) => !i || pitch > pitches[i - 1])).toBe(true);
  expect(result.sounds.filter(s => s.duration === 5.4).length).toBe(1);
  expect(result.sounds.filter(s => s.duration === 1.3).length).toBe(1);
  expect(result.sounds.filter(s => s.loop).length).toBe(1);
  expect(await page.evaluate(() => !!window.__stunt.audio.escapeAudio.rumble)).toBe(true);
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.voices.size)).toBe(0);
  expect(errors).toEqual([]);
});

test('pause freezes the countdown; mute discards missed blasts and resumes only the ongoing rumble', async ({ page }) => {
  await open(page); await musicPlaying(page); await advance(page, 60);
  await page.keyboard.press('p');
  const musicTime = await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.currentTime);
  const before = await page.evaluate(() => [window.__stunt.game.boss.selfDestructTicks, window.escapeStarts.length]);
  await advance(page, 100);
  expect(await page.evaluate(() => [window.__stunt.game.boss.selfDestructTicks, window.escapeStarts.length])).toEqual(before);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('suspended');
  expect(await page.evaluate(() => [window.__stunt.audio.escapeAudio.music.media.paused,
    window.__stunt.audio.escapeAudio.music.media.currentTime])).toEqual([true, musicTime]);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.locator('#help').click(); await page.locator('#sound').uncheck();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.voices.size)).toBe(0);
  const mutedTime = await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.currentTime);
  await advance(page, 690);
  expect(await page.evaluate(() => window.escapeStarts.length)).toBe(before[1]);
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.currentTime)).toBe(mutedTime);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page, 1);
  await musicPlaying(page);
  expect(await page.evaluate(() => window.escapeStarts.slice(-1)[0].loop)).toBe(true);
  expect(await page.evaluate(() => window.escapeStarts.some(s => s.duration === 5.4))).toBe(false);
  // Air assault releases blast effects while continuing the same song.
  await page.evaluate(() => { window.__stunt.game.assault.begin(window.__stunt.game); window.__stunt.render(); });
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.voices.size)).toBe(0);
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.paused)).toBe(false);
});

test('Metallic Tension keeps its position from self-destruct through rooftops, rescue and air assault', async ({ page }) => {
  await open(page, false);
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media?.paused ?? true)).toBe(true);
  await defeat(page); await musicPlaying(page);
  expect(await page.evaluate(() => window.__stunt.audio.matrix.desired)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.matrix.music.paused)).toBe(true);
  const track = await page.evaluate(() => {
    const music = window.__stunt.audio.escapeAudio.music.media;
    window.savedEscapeMusic = music; music.currentTime = 30;
    return { url: music.currentSrc, loop: music.loop, duration: music.duration };
  });
  expect(track.url).toContain('/assets/audio/metallic-tension.ogg');
  expect(track.duration).toBeCloseTo(210.432, 1); expect(track.loop).toBe(true);
  expect((await advance(page, 1400, 'running')).phase).toBe('running');
  expect(await page.evaluate(() => window.savedEscapeMusic.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const { game: g } = window.__stunt;
    g.runner.die(g, 'test retry'); g.runner.age = 25; window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(true);
  await page.keyboard.press('Space'); await advance(page, 1); await musicPlaying(page);
  expect(await page.evaluate(() => window.savedEscapeMusic.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.runner.beginRescue(g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(false);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.runner.enter('lifting', g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(false);
  expect(await page.evaluate(() => window.savedEscapeMusic === window.__stunt.audio.escapeAudio.music.media)).toBe(true);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.runner.enter('escaped', g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(false);
  await advance(page, 21);
  expect(await page.evaluate(() => window.__stunt.game.assault.phase)).toBe('turn');
  expect(await page.evaluate(() => window.savedEscapeMusic.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.assault.startSection(g); window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(false);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.assault.enter('dead', g); g.assault.age = 30; window.__stunt.render();
  });
  expect(await page.evaluate(() => window.savedEscapeMusic.paused)).toBe(true);
  await page.keyboard.press('Space'); await advance(page, 1); await musicPlaying(page);
  expect(await page.evaluate(() => window.savedEscapeMusic.currentTime)).toBeGreaterThanOrEqual(30);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.assault.beginCarrier(g); window.__stunt.render();
  });
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.airAudio.music.media?.paused)).toBe(false);
  expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.desired)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.savedEscapeMusic.paused)).toBe(true);
  expect(await page.evaluate(() => window.savedEscapeMusic.currentTime)).toBe(0);
});

test('direct air-combat level selection plays Metallic Tension', async ({ page }) => {
  for (const level of ['burning-city', 'airship']) {
    await page.goto(`/?test&level=${level}`);
    await expect.poll(() => page.evaluate(() => !!window.__stunt?.game.assault.active)).toBe(true);
    await page.keyboard.press('ArrowRight'); await musicPlaying(page);
    expect(await page.evaluate(() => window.__stunt.audio.escapeAudio.music.media.currentSrc)).toContain('/metallic-tension.ogg');
  }
});

test('a blocked escape track retries on input, without repeated play attempts', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play; window.escapeAttempts = 0;
    addEventListener('keydown', e => { if (e.isTrusted && e.code === 'KeyX') window.allowEscapeMusic = true; }, { capture: true });
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.src.includes('metallic-tension')) {
        window.escapeAttempts++;
        if (!window.allowEscapeMusic) return Promise.reject(new DOMException('Activation needed', 'NotAllowedError'));
      }
      return play.apply(this, args);
    };
  });
  await open(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.escapeAudio.music.blocked)).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.escapeAttempts)).toBe(1);
  await page.keyboard.press('x'); await musicPlaying(page);
});

test('missing escape music leaves the countdown and explosion working', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/metallic-tension.ogg', route => route.abort());
  await open(page);
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.escapeAudio.music.failed)).toBe(true);
  const result = await advance(page, 1400, 'running');
  expect(result.phase).toBe('running');
  expect(result.sounds.filter(s => s.duration === 5.4).length).toBe(1);
  expect(errors).toEqual([]);
});

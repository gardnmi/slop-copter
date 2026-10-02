import { test, expect } from '@playwright/test';

async function open(page, level = '') {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(`/?test${level ? `&level=${level}` : ''}`);
  await expect(page.locator('#begin')).toBeEnabled();
}
async function slider(page, channel, value) {
  await page.locator(`#${channel}-volume`).evaluate((input, value) => {
    input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect(page.locator(`#${channel}-volume-value`)).toHaveText(`${value}%`);
}

test('Levels stays hidden until the ending completes, then persists across reload and New Game', async ({ page }) => {
  await open(page); await page.locator('#begin').click();
  await expect(page.locator('#levels')).toBeHidden();
  await page.keyboard.press('l'); await page.keyboard.press('Shift+l');
  await expect(page.locator('#level-dialog')).toBeHidden();
  await page.evaluate(() => document.querySelector('#levels').click());
  await expect(page.locator('#level-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.__stunt.game.paused)).toBe(false);
  await page.locator('#help').click(); await expect(page.locator('#level-help')).toBeHidden();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await page.evaluate(async () => {
    const g = window.__stunt.game;
    g.orbit.startFall(g); g.orbit.beginReturn(g); window.__stunt.render();
    const { returnFallTicks } = await import('/src/orbit-return.js');
    window.__stunt.advance(returnFallTicks(g.orbit.returnScene) + 44);
  });
  await expect(page.locator('#levels')).toBeHidden();
  await page.evaluate(() => window.__stunt.advance(1));
  await expect(page.locator('#levels')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('slop-copter.completed.v1'))).toBe('true');
  await page.keyboard.press('l'); await page.keyboard.press('Shift+l');
  await expect(page.locator('#level-dialog')).toBeHidden();
  await page.keyboard.press('r'); await expect(page.locator('#levels')).toBeVisible();
  await page.reload(); await expect(page.locator('#levels')).toBeVisible();
  await page.locator('#levels').click(); await expect(page.locator('#level-dialog')).toBeVisible();
});

test('separate volume controls persist, accept keyboard input, and retain values through master mute', async ({ page }, info) => {
  await open(page); await page.locator('#help').click();
  await slider(page, 'music', 35); await slider(page, 'effects', 70);
  await page.locator('#music-volume').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#music-volume-value')).toHaveText('36%');
  await page.locator('#sound').uncheck();
  await slider(page, 'effects', 0);
  await expect(page.locator('#effects-volume')).toHaveAttribute('aria-valuetext', 'Muted');
  await page.reload(); await expect(page.locator('#begin')).toBeEnabled(); await page.locator('#help').click();
  await expect(page.locator('#sound')).not.toBeChecked();
  await expect(page.locator('#music-volume')).toHaveValue('36');
  await expect(page.locator('#effects-volume')).toHaveValue('0');
  await page.locator('#sound').check();
  expect(await page.evaluate(() => window.__stunt.audio.volumes)).toEqual({ music: .36, effects: 0 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('audio-options-phone.png') });
  const bounds = await page.locator('.audio-settings').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('music and effects have independent audible outputs and every chapter uses the correct bus', async ({ page }) => {
  await page.addInitScript(() => {
    window.audioEdges = [];
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (to, ...args) {
      window.audioEdges.push([this, to]); return connect.call(this, to, ...args);
    };
  });
  await open(page, 'downwell'); await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(async () => {
    const a = window.__stunt.audio, c = a.context;
    await a.orbitAudio.ready;
    window.__stunt.render();
    // Known tones let us measure the actual output, independent of song intros.
    window.meters = {};
    for (const [channel, bus] of Object.entries(a.outputs)) {
      const tone = c.createOscillator(), meter = c.createAnalyser();
      tone.frequency.value = channel === 'music' ? 220 : 440;
      tone.connect(bus); bus.connect(meter); tone.start(); window.meters[channel] = meter;
    }
    window.rms = channel => {
      const data = new Float32Array(window.meters[channel].fftSize);
      window.meters[channel].getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    };
  });
  await page.locator('#help').click(); await slider(page, 'music', 0);
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.rms('music'))).toBeLessThan(.0001);
  await expect.poll(() => page.evaluate(() => window.rms('effects'))).toBeGreaterThan(.4);
  await page.locator('#help').click(); await slider(page, 'music', 100); await slider(page, 'effects', 0);
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.rms('effects'))).toBeLessThan(.0001);
  await expect.poll(() => page.evaluate(() => window.rms('music'))).toBeGreaterThan(.4);
  const routing = await page.evaluate(() => {
    const a = window.__stunt.audio, { music, effects } = a.outputs;
    const connected = (from, to) => window.audioEdges.some(([x, y]) => x === from && y === to);
    const tracks = [a.escapeAudio, a.airAudio, a.deckAudio, a.orbitAudio];
    for (const chapter of tracks) chapter.music.prepare();
    a.matrix.prepareMusic(); a.matrix.cue(1);
    a.tone('sine', 0, .1, .1, [[0, 100]]);
    a.escapeAudio.play('warning', .1); a.airAudio.play('hit', .1);
    a.deckAudio.play('pistol', .1); a.orbitAudio.play('shot', .1);
    return {
      onlyBusesReachSpeakers: window.audioEdges.filter(([, to]) => to === a.context.destination)
        .every(([from]) => from === music || from === effects),
      allMusic: tracks.every(chapter => connected(chapter.music.gain, music)) && connected(a.matrix.musicGain, music),
      allEffects: a.classic.destination === effects && a.matrix.output === effects && a.escapeAudio.output === effects &&
        a.airAudio.output === effects && connected(a.deckAudio.bus, effects) && connected(a.orbitAudio.bus, effects),
    };
  });
  expect(routing).toEqual({ onlyBusesReachSpeakers: true, allMusic: true, allEffects: true });
});

test('unavailable storage still allows volume adjustment and an in-session completion unlock', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await open(page, 'full-circle'); await page.locator('#help').click(); await slider(page, 'music', 25);
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await page.evaluate(async () => {
    const { returnFallTicks } = await import('/src/orbit-return.js');
    window.__stunt.advance(returnFallTicks(window.__stunt.game.orbit.returnScene) + 45);
  });
  await expect(page.locator('#levels')).toBeVisible();
  expect(await page.evaluate(() => window.__stunt.audio.volumes.music)).toBe(.25);
});

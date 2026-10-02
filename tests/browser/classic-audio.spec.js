import { test, expect } from '@playwright/test';

test.use({ launchOptions: {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--autoplay-policy=document-user-activation-required'],
} });

async function passive(page, expression) {
  // Playwright's page.evaluate grants user activation. CDP without that flag
  // lets this test observe the actual pre-click autoplay restriction.
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send('Runtime.evaluate', { expression, userGesture: false, awaitPromise: true, returnByValue: true });
    return result.result.value;
  } finally { await session.detach(); }
}

async function open(page, { muted = false } = {}) {
  await page.addInitScript(muted => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem('slop-copter.completed.v1', 'true');
    if (muted) localStorage.setItem('slop-copter.sound.v1', 'false');
    window.audioStarts = [];
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.audioStarts.push({ loop: this.loop, duration: this.buffer.duration });
      return original.apply(this, args);
    };
  }, muted);
  await page.goto('/?test');
  await expect(page.locator('#begin')).toBeEnabled();
  await passive(page, 'window.__stunt.audio.classic.prepare()');
}
const starts = page => passive(page, 'window.audioStarts.filter(s => !s.loop && s.duration > 1).length');
const advance = (page, ticks = 1) => page.evaluate(ticks => window.__stunt.advance(ticks), ticks);

test('startup chime plays once, then the original rotor runs without stacking across pause and restart', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  expect(await starts(page)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => window.__stunt.audio.classic.rotor)).toBeNull();
  await page.locator('#begin').click();
  await expect.poll(() => starts(page)).toBe(1);
  await advance(page);
  expect(await page.evaluate(() => window.__stunt.audio.classic.rotor.source.loop)).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 100; i++) window.__stunt.render(); });
  expect(await page.evaluate(() => window.audioStarts.filter(s => s.loop).length)).toBe(1);
  await page.keyboard.press('r'); await advance(page);
  expect(await starts(page)).toBe(1);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('suspended');
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page); expect(await starts(page)).toBe(1); expect(errors).toEqual([]);
});

test('a browser that rejects autoplay waits for a real interaction and retries the chime', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    // Enforce the blocked branch even when the test browser or its automation
    // grants activation during DOM assertions. Playback still uses real audio.
    let interacted = false;
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, event => {
      if (event.isTrusted) interacted = true;
    }, { capture: true });
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); this.suspend(); }
      resume() {
        if (!interacted) return Promise.reject(new DOMException('User activation required', 'NotAllowedError'));
        return super.resume();
      }
    };
  });
  await open(page);
  expect(await starts(page)).toBe(0);
  await page.locator('#begin').click();
  await expect.poll(() => starts(page)).toBe(1);
  await advance(page);
  expect(await page.evaluate(() => !!window.__stunt.audio.classic.rotor)).toBe(true);
});

test('hay catches play the fanfare, misses play the splat, and the rotor yields then returns', async ({ page }) => {
  await open(page); await page.locator('#begin').click();
  await expect.poll(() => starts(page)).toBe(1);
  for (const [offset, outcome, low, high] of [[30, 'hay', .7, .73], [240, 'ground', .13, .14], [76, 'driver', .13, .14]]) {
    await page.evaluate(offset => {
      const g = window.__stunt.game;
      g.jumper = { x: g.cartX + offset + 2, y: g.deck - 31, inCloud: false };
      g.state = 'falling'; g.dropHeight = 150; window.__stunt.advance(1);
    }, offset);
    expect(await page.evaluate(() => window.__stunt.game.outcome)).toBe(outcome);
    const sound = await page.evaluate(() => ({ rotor: !!window.__stunt.audio.classic.rotor, duration: window.__stunt.audio.classic.effect.source.buffer.duration }));
    expect(sound.rotor).toBe(false); expect(sound.duration).toBeGreaterThan(low); expect(sound.duration).toBeLessThan(high);
    const count = await page.evaluate(() => window.audioStarts.length);
    await page.evaluate(() => { for (let i = 0; i < 15; i++) window.__stunt.render(); });
    expect(await page.evaluate(() => window.audioStarts.length)).toBe(count);
    await expect.poll(() => page.evaluate(() => !!window.__stunt.audio.classic.effect)).toBe(false);
    await advance(page, 50);
    expect(await page.evaluate(() => !!window.__stunt.audio.classic.rotor)).toBe(true);
  }
});

test('saved mute suppresses startup, missed sounds are not replayed, and later chapters stop the loop', async ({ page }) => {
  await open(page, { muted: true }); await page.locator('#begin').click(); await advance(page);
  expect(await page.evaluate(() => window.audioStarts.length)).toBe(0);
  await page.evaluate(() => {
    const g = window.__stunt.game; g.jumper = { x: g.cartX + 260, y: g.deck - 31, inCloud: false }; g.state = 'falling';
    window.__stunt.advance(20);
  });
  await page.locator('#help').click(); await page.locator('#sound').check(); await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page);
  expect(await starts(page)).toBe(0);
  expect(await page.evaluate(() => !!window.__stunt.audio.classic.effect)).toBe(false);
  expect(await page.evaluate(() => !!window.__stunt.audio.classic.rotor)).toBe(true);
  await page.locator('#levels').click(); await page.locator('#level-select').selectOption('rooftops');
  await page.getByRole('button', { name: 'Start selected level' }).click(); await advance(page);
  expect(await page.evaluate(() => !!window.__stunt.audio.classic.rotor)).toBe(false);
  await page.locator('#help').click(); await page.locator('#sound').uncheck(); await page.reload();
  expect(await page.locator('#sound').isChecked()).toBe(false);
  expect(await page.evaluate(() => window.audioStarts.length)).toBe(0);
});

test('missing startup audio leaves the original game effects and controls working', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/audio/mac-startup.wav', route => route.abort());
  await open(page); await page.locator('#begin').click();
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page);
  expect(await page.evaluate(() => !!window.__stunt.audio.classic.rotor)).toBe(true);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(1);
  expect(errors).toEqual([]);
});

test('the final hay landing replays the Mac chord once per loop, before classic controls resume', async ({ page }) => {
  await open(page); await page.locator('#begin').click();
  await expect.poll(() => starts(page)).toBe(1);
  for (let loop = 0; loop < 2; loop++) {
    await page.locator('#levels').click(); await page.locator('#level-select').selectOption('full-circle');
    await page.getByRole('button', { name: 'Start selected level' }).click();
    const flight = await page.evaluate(async () => {
      const { returnFallTicks } = await import('/src/orbit-return.js');
      return returnFallTicks(window.__stunt.game.orbit.returnScene);
    });
    await advance(page, flight - 1); expect(await starts(page)).toBe(loop + 1);
    await advance(page, 1);
    expect(await page.evaluate(() => window.__stunt.game.orbit.returnScene.outcome)).toBe('hay');
    await expect.poll(() => starts(page)).toBe(loop + 2);
    await page.evaluate(() => { for (let n = 0; n < 20; n++) window.__stunt.render(); });
    await page.keyboard.press('p'); await page.keyboard.press('p'); await advance(page, 45);
    expect(await starts(page)).toBe(loop + 2);
    expect(await page.evaluate(() => window.__stunt.game.orbit.active)).toBe(false);
  }
  await page.keyboard.press('r'); await advance(page); expect(await starts(page)).toBe(3);
});

test('a muted final hay landing is not replayed when sound is enabled later', async ({ page }) => {
  await open(page, { muted: true }); await page.locator('#begin').click();
  await page.locator('#levels').click(); await page.locator('#level-select').selectOption('full-circle');
  await page.getByRole('button', { name: 'Start selected level' }).click();
  await page.evaluate(async () => {
    const { returnFallTicks } = await import('/src/orbit-return.js');
    window.__stunt.advance(returnFallTicks(window.__stunt.game.orbit.returnScene));
  });
  expect(await starts(page)).toBe(0);
  await page.locator('#help').click(); await page.locator('#sound').check();
  await page.locator('#close-help').click(); await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.__stunt.audio.context.state)).toBe('running');
  await advance(page, 45); expect(await starts(page)).toBe(0);
});

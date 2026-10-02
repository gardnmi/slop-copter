import { test, expect } from '@playwright/test';

async function open(page) {
  await page.goto('/?test');
  await expect(page.getByRole('button', { name: 'Begin flight' })).toBeEnabled();
  await page.getByRole('button', { name: 'Begin flight' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
}
async function miss(page) {
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.jumper = { x: g.cartX + 200, y: g.deck - 31, inCloud: false };
    g.state = 'falling';
    window.__stunt.advance(13);
  });
}

test('start, steer, drop, pause, resume, and reset using real keyboard input', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?test');
  await expect(page.getByRole('button', { name: 'Begin flight' })).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(page.locator('#overlay')).toBeHidden();
  const x = await page.evaluate(() => window.__stunt.game.copterX);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.copterX)).toBeGreaterThan(x + 20);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.drops)).toBe(1);
  await page.keyboard.press('p');
  await expect(page.getByText('Take a breather.')).toBeVisible();
  const frozen = await page.evaluate(() => JSON.stringify(window.__stunt.game));
  await page.evaluate(() => window.__stunt.advance(120));
  expect(await page.evaluate(() => JSON.stringify(window.__stunt.game))).toBe(frozen);
  await page.keyboard.press('Space');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.keyboard.press('r');
  expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(0);
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  expect(errors).toEqual([]);
});

test('six distinct visual stages precede retaliation, automatic recovery retries Matrix, and R resets', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await open(page);
  await page.screenshot({ path: testInfo.outputPath('classic.png') });
  for (let i = 1; i <= 6; i++) {
    await miss(page);
    expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(i);
    expect(await page.evaluate(() => window.__stunt.game.combat.shooters.length)).toBe(0);
    await expect(page.locator('#mode-label')).toHaveText(i < 6 ? `◈ SIGNAL ${i}/6` : '● SIMULATION');
    if (i === 3) await page.screenshot({ path: testInfo.outputPath('partial-transformation.png') });
  }
  await expect(page.locator('body')).toHaveClass('digital');
  await page.screenshot({ path: testInfo.outputPath('digital.png') });
  await miss(page);
  expect(await page.evaluate(() => window.__stunt.game.combat.shooters.length)).toBe(1);
  await expect(page.locator('#mode-label')).toHaveText('● RETALIATION');
  await page.evaluate(() => window.__stunt.advance(80));
  expect(await page.evaluate(() => window.__stunt.game.combat.bullets.length)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('retaliation.png') });
  await page.evaluate(() => {
    for (let n = 0; n < 2000 && !window.__stunt.game.retrySerial; n++) window.__stunt.advance(1);
  });
  expect(await page.evaluate(() => window.__stunt.game.retrySerial)).toBe(1);
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/digital/);
  expect(await page.evaluate(() => window.__stunt.game.combat.hits)).toBe(0);
  expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(6);
  await page.keyboard.press('r');
  await expect(page.locator('body')).not.toHaveClass(/digital/);
  expect(errors).toEqual([]);
});

test('one successful keyboard drop saves best score across reset and reload', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.cloudEnabled = false;
    g.cartX = 250;
    g.moveCopter(290, g.deck - 80);
    document.querySelector('#game').dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    window.__stunt.advance(5);
  });
  const best = await page.evaluate(() => window.__stunt.game.best);
  expect(best).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__stunt.game.catches)).toBe(1);
  await page.getByRole('button', { name: 'New game' }).click();
  expect(await page.evaluate(() => window.__stunt.game.score)).toBe(0);
  expect(await page.evaluate(() => window.__stunt.game.best)).toBe(best);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Begin flight' })).toBeEnabled();
  expect(await page.evaluate(() => window.__stunt.game.best)).toBe(best);
});

test('two keyboard catches trigger a third-drop dodge that stops during retaliation', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const g = window.__stunt.game;
      g.cloudEnabled = false; g.cartX = 100; g.moveCopter(132, g.deck - 72);
    });
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__stunt.game.drops)).toBe(i + 1);
    await page.evaluate(() => window.__stunt.advance(48));
    expect(await page.evaluate(() => window.__stunt.game.catches)).toBe(Math.min(i + 1, 2));
  }
  expect(await page.evaluate(() => [window.__stunt.game.misses, window.__stunt.game.shiftCount])).toEqual([1, 1]);
  await page.evaluate(() => { const g = window.__stunt.game; g.shiftCount = 6; g.retaliation = true; });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const g = window.__stunt.game; g.cartX = 100; g.moveCopter(132, g.deck - 72);
    });
    await page.keyboard.press('Space');
    await page.evaluate(() => window.__stunt.advance(48));
  }
  expect(await page.evaluate(() => window.__stunt.game.catches)).toBe(5);
  expect(await page.evaluate(() => window.__stunt.game.carriage.dodging)).toBe(false);
});

test('a horse collision shows the original fallen horse and the driver takes over in both themes', async ({ page }, testInfo) => {
  await open(page);
  for (const theme of [0, 2]) {
    await page.getByRole('button', { name: 'New game' }).click();
    await page.evaluate(theme => {
      const g = window.__stunt.game;
      g.shiftCount = theme; g.cloudEnabled = false; g.cartX = 250; g.moveCopter(360, g.deck - 72);
    }, theme);
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__stunt.game.outcome)).toBe('horse');
    expect(await page.evaluate(() => window.__stunt.game.carriage.horseAlive)).toBe(false);
    const corpse = await page.evaluate(() => window.__stunt.game.carriage.deadHorse.x);
    await page.evaluate(() => window.__stunt.advance(12));
    await page.screenshot({ path: testInfo.outputPath(`driver-hopping-${theme}.png`) });
    await page.evaluate(() => window.__stunt.advance(65));
    await expect(page.locator('#flight-status')).toContainText('PULL');
    expect(await page.evaluate(() => window.__stunt.game.carriage.phase)).toBe('pulling');
    expect(await page.evaluate(() => window.__stunt.game.carriage.deadHorse.x)).toBe(corpse);
    const x = await page.evaluate(() => window.__stunt.game.cartX);
    await page.evaluate(() => window.__stunt.advance(20));
    expect(await page.evaluate(() => window.__stunt.game.cartX)).toBeGreaterThan(x);
    await page.screenshot({ path: testInfo.outputPath(`driver-pulling-${theme}.png`) });
  }
});

test('mouse movement and dragging in the playfield do not steer the helicopter', async ({ page }) => {
  await open(page);
  const bounds = await page.locator('#game').boundingBox();
  const position = await page.evaluate(() => {
    const g = window.__stunt.game;
    return [g.copterX, g.copterY];
  });
  await page.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .25);
  await page.evaluate(() => window.__stunt.advance(10));
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .15, bounds.y + bounds.height * .55, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(1);
  await page.evaluate(() => window.__stunt.advance(25));
  expect(await page.evaluate(() => {
    const g = window.__stunt.game;
    return [g.copterX, g.copterY, g.controlX, g.controlY, g.dh, g.dv];
  })).toEqual([...position, 0, 0, 0, 0]);
});

test('hitting a seated or pulling driver starts a smoking motorized cart in both themes', async ({ page }, testInfo) => {
  await open(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const [theme, pulling] of [[0, false], [0, true], [2, true]]) {
    await page.getByRole('button', { name: 'New game' }).click();
    await page.evaluate(({ theme, pulling }) => {
      const g = window.__stunt.game;
      g.shiftCount = theme; g.cloudEnabled = false; g.cartX = 250;
      g.moveCopter(pulling ? 360 : 328, g.deck - 72);
    }, { theme, pulling });
    if (pulling) {
      await page.keyboard.press('Space');
      await page.evaluate(() => window.__stunt.advance(70));
      expect(await page.evaluate(() => window.__stunt.game.carriage.phase)).toBe('pulling');
      await page.evaluate(() => {
        const g = window.__stunt.game; g.moveCopter(g.carriage.driverPosition(g).x, g.deck - 72);
      });
    }
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.__stunt.game.outcome)).toBe('driver');
    expect(await page.evaluate(() => window.__stunt.game.carriage.driverAlive)).toBe(false);
    await page.evaluate(() => window.__stunt.advance(24));
    await expect(page.locator('#flight-status')).toContainText('IGNITION');
    expect(await page.evaluate(() => window.__stunt.game.carriage.exhaust.length)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`engine-starting-${theme}-${pulling}.png`) });
    await page.evaluate(() => window.__stunt.advance(90));
    await expect(page.locator('#flight-status')).toContainText('DRIVE');
    expect(await page.evaluate(() => window.__stunt.game.carriage.motion)).toBeGreaterThan(1.2);
    await page.screenshot({ path: testInfo.outputPath(`engine-driving-${theme}-${pulling}.png`) });
  }
  expect(errors).toEqual([]);
});

test('a transformed cloud briefly flickers with small lightning in both skies', async ({ page }, testInfo) => {
  // Hold the brief effect still for screenshots; advance simulation explicitly.
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await open(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const stage of [1, 6]) {
    await page.evaluate(stage => {
      const g = window.__stunt.game;
      g.shiftCount = stage; g.cloudX = 250; g.cloudY = 120; g.lightning.delay = 1;
      window.__stunt.advance(1);
    }, stage);
    expect(await page.evaluate(() => window.__stunt.game.lightning.phase)).toBe('warning');
    await page.evaluate(() => window.__stunt.advance(4));
    await page.screenshot({ path: testInfo.outputPath(`cloud-warning-${stage}.png`) });
    await page.evaluate(() => window.__stunt.advance(4));
    expect(await page.evaluate(() => window.__stunt.game.lightning.phase)).toBe('strike');
    await page.screenshot({ path: testInfo.outputPath(`cloud-lightning-${stage}.png`) });
    await page.evaluate(async () => {
      const { LIGHTNING_STRIKE_TICKS } = await import('/src/lightning.js');
      window.__stunt.advance(LIGHTNING_STRIKE_TICKS);
    });
    expect(await page.evaluate(() => window.__stunt.game.lightning.phase)).toBe('idle');
  }
  expect(errors).toEqual([]);
});

test('the motorized buggy has no horizontal split throughout its rumble cycle', async ({ page }) => {
  await open(page);
  const gaps = await page.evaluate(async () => {
    const { Renderer } = await import('/src/render.js');
    const { Game } = await import('/src/game.js');
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    const renderer = new Renderer(canvas); await renderer.load();
    const c = renderer.c, g = new Game(), gaps = [];
    renderer.reducedMotion = false; c.imageSmoothingEnabled = false;
    g.cartX = 40; g.deck = 24; g.carriage.phase = 'motor';
    for (const themed of [false, true]) for (let frame = 0; frame < 3; frame++) {
      for (let tick = 0; tick < 24; tick++) {
        g.carriage.engineTick = tick;
        c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
        renderer.drawMotorCart(g, frame, themed);
        const pixels = c.getImageData(g.cartX + 8, g.deck + 24, 76, 11).data;
        for (let row = 0; row < 11; row++) {
          let occupied = false;
          for (let x = 0; x < 76; x++) {
            const i = (row * 76 + x) * 4;
            if (themed ? pixels[i + 1] > 120 && pixels[i] < 240 : pixels[i] < 128) occupied = true;
          }
          if (!occupied) gaps.push({ themed, frame, tick, row });
        }
      }
    }
    return gaps;
  });
  expect(gaps, 'body-to-wheel rows must remain connected').toEqual([]);
});

test('the pulling driver stays joined from hat to both boots throughout his stride', async ({ page }) => {
  await open(page);
  const frames = await page.evaluate(async () => {
    const { DriverRenderer } = await import('/src/driver.js');
    const sheet = new Image(); sheet.src = '/assets/copter-wagon.png'; await sheet.decode();
    const driver = new DriverRenderer(sheet);
    return Array.from({ length: 8 }, (_, frame) => {
      const sprite = driver.sprite(frame, 'pull', false), { width, height } = sprite;
      const data = sprite.getContext('2d').getImageData(0, 0, width, height).data;
      const ink = Array.from({ length: width * height }, (_, i) => data[i * 4 + 3] > 0 && data[i * 4] < 128);
      const head = ink.indexOf(true), visited = new Set([head]), queue = [head];
      for (let i = 0; i < queue.length; i++) {
        const x = queue[i] % width, y = Math.floor(queue[i] / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, n = ny * width + nx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && ink[n] && !visited.has(n)) {
            visited.add(n); queue.push(n);
          }
        }
      }
      // The former arm outline cut through the waist, leaving every leg pixel
      // disconnected. Every pixel in the bottom third must belong to the body.
      return { frame, detachedLegs: ink.some((filled, i) => filled && Math.floor(i / width) >= 18 && !visited.has(i)) };
    });
  });
  for (const frame of frames) expect(frame.detachedLegs, `stride frame ${frame.frame}`).toBe(false);
});

test('arrow keys steer and brake independently of mouse movement and clicking to drop', async ({ page }) => {
  await open(page);
  const bounds = await page.locator('#game').boundingBox();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(4);
  await page.mouse.move(bounds.x + bounds.width * .15, bounds.y + bounds.height * .25);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const g = window.__stunt.game;
    return [g.controlX, g.controlY, g.dh, g.dv, g.drops];
  })).toEqual([4, 0, 4, 0, 1]);
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(0);
  const stopped = await page.evaluate(() => window.__stunt.game.copterX);
  await page.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .55);
  await page.evaluate(() => window.__stunt.advance(10));
  expect(await page.evaluate(() => window.__stunt.game.copterX)).toBe(stopped);
  await page.keyboard.down('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(-4);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(0);
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dv)).toBe(-3);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dv)).toBe(4);
  await page.keyboard.up('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dv)).toBe(0);
});

test('classic and digital yokes steer and release correctly', async ({ page }) => {
  await open(page);
  const bounds = await page.locator('#game').boundingBox();
  for (const themed of [false, true]) {
    if (themed) await page.evaluate(() => { window.__stunt.game.shiftCount = 5; window.__stunt.render(); });
    const control = await page.evaluate(async () => {
      const { yokeRect } = await import('/src/layout.js');
      const g = window.__stunt.game, [x, y, w, h] = yokeRect(g);
      return { x: (x + w * .9) / g.width, y: (y + h * .5) / g.height };
    });
    await page.mouse.move(bounds.x + control.x * bounds.width, bounds.y + control.y * bounds.height);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.__stunt.game.controlX)).toBeGreaterThan(0);
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.__stunt.game.controlX)).toBe(0);
  }
});

test('arrow keys work after toolbar focus and visibly ramp and coast over multiple frames', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__stunt.game, tick = g.tick.bind(g);
    window.flightTrace = [];
    g.tick = () => { tick(); window.flightTrace.push({ target: g.controlX, speed: g.dh }); };
  });
  await page.locator('#fullscreen').focus();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(4);
  await expect(page.locator('#game')).toBeFocused();
  await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.dh)).toBe(0);
  const trace = await page.evaluate(() => window.flightTrace);
  const held = trace.filter(frame => frame.target === 4);
  expect(held[4].speed).toBeCloseTo(.8);
  expect(held.findIndex(frame => frame.speed === 4)).toBe(24);
  const released = trace.slice(trace.findIndex(frame => frame.target === 4) + held.length);
  expect(released[4].speed).toBeCloseTo(3);
  expect(released.findIndex(frame => frame.speed === 0)).toBe(19);
});

test('acceleration slider supports keyboard tuning and persists across reset and reload', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Options' }).click();
  const slider = page.getByRole('slider', { name: 'Acceleration' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('1.5');
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveValue('1.45');
  await expect(page.locator('#acceleration-value')).toHaveText('1.45 s to full speed');
  expect(await page.evaluate(() => window.__stunt.game.controlX)).toBe(0);
  await page.getByRole('button', { name: 'Close options' }).click();
  await page.getByRole('button', { name: 'New game' }).click();
  expect(await page.evaluate(() => window.__stunt.game.accelerationTime)).toBe(1.45);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Begin flight' })).toBeEnabled();
  expect(await page.evaluate(() => window.__stunt.game.accelerationTime)).toBe(1.45);
});

test('digital helicopter banks in both directions while the classic helicopter remains level', async ({ page }, testInfo) => {
  await open(page);
  for (const [theme, direction, sign] of [[0, 1, 0], [3, 1, 1], [3, -1, -1], [3, 0, -1]]) {
    const angle = await page.evaluate(([theme, direction]) => {
      const g = window.__stunt.game;
      g.releaseControls(); g.copterPitch = 0; g.shiftCount = theme; g.copterX = g.width / 2; g.copterY = 150;
      g.setYoke(direction, direction === 0 ? -1 : 0); window.__stunt.advance(12);
      return g.copterPitch;
    }, [theme, direction]);
    if (sign) expect(angle * sign).toBeGreaterThan(.02);
    else expect(angle).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`pitch-${theme}-${direction}.png`) });
  }
});

test('the last rotor frame has no vertical border beside it at fractional display scales', async ({ page }) => {
  await open(page);
  const artifacts = await page.evaluate(async () => {
    const { Renderer } = await import('/src/render.js');
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const renderer = new Renderer(canvas); await renderer.load();
    const c = renderer.c, failures = [];
    for (const themed of [false, true]) for (const scale of [1, 1.25, 1.33, 1.5, 1.625, 2.01]) for (const offset of [0, .25, .5, .75]) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, 512, 256);
      c.setTransform(scale, 0, 0, scale, offset, offset); c.imageSmoothingEnabled = false;
      renderer.blit('copter-wagon', [148, 0, 74, 26], 17, 5, 2, themed);
      const left = Math.ceil(147 * scale + offset), right = Math.ceil(168 * scale + offset);
      const top = Math.ceil(5 * scale + offset), bottom = Math.floor(57 * scale + offset);
      const data = c.getImageData(left, top, right - left, bottom - top).data;
      if (data.some(value => value !== 255)) failures.push({ themed, scale, offset });
    }
    return failures;
  });
  expect(artifacts).toEqual([]);
});

test('window blur pauses and clears held movement; help opens without losing game state', async ({ page }) => {
  await open(page);
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByText('Take a breather.')).toBeVisible();
  expect(await page.evaluate(() => window.__stunt.game.controlX)).toBe(0);
  await page.keyboard.up('ArrowRight');
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await page.getByRole('button', { name: 'Options' }).click();
  await expect(page.locator('#instructions')).toBeVisible();
  expect(await page.evaluate(() => window.__stunt.game.paused)).toBe(true);
});

test('blocked browser storage does not prevent playing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
  });
  await open(page);
  expect(await page.evaluate(() => window.__stunt.game.state)).toBe('ready');
});

test('failed sprite load presents a visible reload action', async ({ page }) => {
  await page.route('**/assets/cloud-2.png', route => route.abort());
  await page.goto('/');
  await expect(page.getByText('Flight equipment missing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload game' })).toBeEnabled();
});

test('production build loads, plays, and contains no test hooks', async ({ page }) => {
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto('http://127.0.0.1:4174/?test');
  await expect(page.getByRole('button', { name: 'Begin flight' })).toBeEnabled();
  expect(await page.evaluate(() => typeof window.__stunt)).toBe('undefined');
  await page.getByRole('button', { name: 'Begin flight' }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('#status')).toHaveText(/Safe landing|did not go as planned|different about that cloud/, { timeout: 5000 });
  expect(failed).toEqual([]); expect(errors).toEqual([]);
});

test('transformed assets have transparent corners instead of rectangular backdrops', async ({ page }, testInfo) => {
  await open(page);
  const corners = await page.evaluate(() => {
    const g = window.__stunt.game;
    g.shiftCount = 4; g.paused = true;
    g.copterX = 300; g.copterY = 80; g.cloudX = 550; g.cloudY = 160; g.cartX = 150;
    window.__stunt.render();
    document.querySelector('#overlay').hidden = true;
    const canvas = document.querySelector('#game'), c = canvas.getContext('2d');
    return [[g.cloudX + 4, g.cloudY + 4], [g.copterX - 68, g.copterY + 48], [g.cartX + 142, g.deck + 40]].map(([x, y]) =>
      [...c.getImageData(Math.round(x * canvas.width / g.width), Math.round(y * canvas.height / g.height), 1, 1).data]);
  });
  expect(corners).toEqual([[255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255]]);
  await page.screenshot({ path: testInfo.outputPath('transparent-assets.png') });
});

test('fullscreen enters and exits through the browser API without resetting the run', async ({ page }) => {
  await open(page);
  await miss(page);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('game-screen');
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(1);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__stunt.game.shiftCount)).toBe(1);
});

test('game fills wide and portrait viewports and preserves a paused run when resized', async ({ page }) => {
  await open(page);
  await miss(page);
  await page.keyboard.press('p');
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const frame = await page.locator('#game-screen').boundingBox();
    expect(frame).toEqual({ x: 0, y: 0, ...viewport });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await expect.poll(() => page.evaluate(() => {
      const g = window.__stunt.game, r = document.querySelector('#game').getBoundingClientRect();
      return Math.abs(g.width / g.height - r.width / r.height);
    })).toBeLessThan(.001);
    expect(await page.evaluate(() => [window.__stunt.game.shiftCount, window.__stunt.game.paused])).toEqual([1, true]);
  }
});

test('a rejected fullscreen request leaves the game usable', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { document.querySelector('#game-screen').requestFullscreen = () => Promise.reject(new Error('Denied')); });
  await page.locator('#fullscreen').click();
  await expect(page.locator('#status')).toHaveText('Fullscreen could not start. You can keep playing in this window.');
  await page.locator('#game').focus();
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__stunt.game.drops)).toBe(1);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('fits the screen, touch controls steer and drop, and canceled input releases', async ({ page }, testInfo) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await expect(page.getByRole('button', { name: 'Fly right' })).toBeVisible();
    const x = await page.evaluate(() => window.__stunt.game.copterX);
    // Send real simultaneous touch points through Chromium's input pipeline.
    const session = await page.context().newCDPSession(page);
    const right = await page.getByRole('button', { name: 'Fly right' }).boundingBox();
    const drop = await page.locator('#drop-button').boundingBox();
    const point = { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect.poll(() => page.evaluate(() => window.__stunt.game.copterX)).toBeGreaterThan(x + 10);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, { x: drop.x + drop.width / 2, y: drop.y + drop.height / 2, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [point] });
    await expect.poll(() => page.evaluate(() => window.__stunt.game.drops)).toBe(1);
    expect(await page.evaluate(() => window.__stunt.game.controlX)).toBe(4);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.__stunt.game.controlX)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('mobile.png') });
  });
});

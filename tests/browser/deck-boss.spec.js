import { test, expect } from '@playwright/test';
const advance = (page, n) => page.evaluate(n => window.__stunt.advance(n, true), n);
async function open(page) {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('/?test&level=spaceship'); await expect(page.locator('#levels')).toBeEnabled();
}

test('boss startup and Continue keep the live animation loop running', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Keep requestAnimationFrame active: skipping straight to a later simulation
  // tick misses rendering failures in the thrusters' opening animation frames.
  await page.goto('/?test&level=spaceship');
  await expect(page.locator('#levels')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.__stunt.game.boarding.boss.time)).toBeGreaterThanOrEqual(80);
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    const g = window.__stunt.game;
    g.boarding.health = 1; g.boarding.hurt = 0; g.boarding.hurtPlayer(g);
  });
  await expect.poll(() => page.evaluate(() => window.__stunt.game.boarding.age)).toBeGreaterThanOrEqual(30);
  await page.keyboard.press('k');
  await expect.poll(() => page.evaluate(() => window.__stunt.game.boarding.boss.time)).toBeGreaterThanOrEqual(80);
  expect(await page.evaluate(() => window.__stunt.game.boarding.playing)).toBe(true);
  expect(errors).toEqual([]);
});

test('the spacecraft fight can be completed with real controls and ends with wreckage after both phases', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page); await expect(page.locator('#mode-label')).toHaveText('● HOSTILE SPACECRAFT');
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp'); await page.keyboard.down('j');
  await advance(page, 110); await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__stunt.game.boarding.boss.hp)).toBeLessThan(240);
  await page.keyboard.down('k'); await advance(page, 38); await page.keyboard.up('k');
  expect(await page.evaluate(() => window.__stunt.game.boarding.y)).toBe(208);
  await page.screenshot({ path: info.outputPath('spacecraft-catwalk-fight.png') });
  await page.keyboard.up('j'); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(async () => {
    const { spacecraftInput } = await import('/tests/helpers/deck-playthrough.js');
    const g = window.__stunt.game;
    for (let i = 0; i < 3500 && g.boarding.playing; i++) { spacecraftInput(g); g.step(.02); }
    window.__stunt.advance(1); return g.boarding.phase;
  })).toBe('cleared');
  expect(await page.evaluate(() => window.__stunt.game.boarding.health)).toBeGreaterThan(0);
  await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: info.outputPath('warden-destroyed.png') });
  expect(errors).toEqual([]);
});

test('boss framing survives a paused phone resize and Continue restarts the spacecraft fight', async ({ page }, info) => {
  await open(page); await advance(page, 100); await page.keyboard.press('p');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => window.__stunt.game.boarding.width)).toBe(600);
  expect(await page.evaluate(() => { const d = window.__stunt.game.boarding; return d.boss.x + 130 <= d.cameraX + d.width && d.x > d.cameraX; })).toBe(true);
  await page.keyboard.press('p');
  await page.screenshot({ path: info.outputPath('spacecraft-phone.png') });
  await page.evaluate(() => { const g = window.__stunt.game; g.boarding.health = 1; g.boarding.hurt = 0; g.boarding.hurtPlayer(g); window.__stunt.advance(35); });
  await page.keyboard.press('k');
  expect(await page.evaluate(() => [window.__stunt.game.boarding.phase, window.__stunt.game.boarding.boss.state, window.__stunt.game.boarding.boss.hp])).toEqual(['raid', 'wake', 240]);
  await page.keyboard.press('Shift+l'); await expect(page.locator('#level-dialog')).toBeHidden();
  expect(await page.locator('#level-select option[value="spaceship"]').count()).toBe(1);
});

test('raised idle aim has no muzzle flame and crouch recoil keeps the red headband in place', async ({ page }, info) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { MetalSlugArt } = await import('/src/metal-slug-art.js'); const art = new MetalSlugArt(); await art.load();
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const pose = { x: 50, y: 100, facing: 1, hurt: 0, age: 80, time: 1, grounded: true, vx: 0, vy: 0, flash: 0 };
    const render = patch => { ctx.clearRect(0, 0, 120, 120); art.commando(ctx, { ...pose, ...patch }, false); return ctx.getImageData(0, 0, 120, 120).data; };
    const muzzleInk = data => { let ink = 0; for (let y = 0; y < 40; y++) for (let x = 0; x < 120; x++) if (data[(y * 120 + x) * 4 + 3]) ink++; return ink; };
    const idle = muzzleInk(render({ aimUp: true })), firing = muzzleInk(render({ aimUp: true, flash: 3 }));
    const bandCenter = data => {
      let xSum = 0, ySum = 0, count = 0;
      for (let y = 65; y < 93; y++) for (let x = 42; x < 68; x++) {
        const i = (y * 120 + x) * 4;
        if (data[i + 3] && data[i] > 150 && data[i] > data[i + 1] * 2 && data[i + 1] < 90) { xSum += x; ySum += y; count++; }
      }
      return [xSum / count, ySum / count, count];
    };
    const crouch = bandCenter(render({ crouching: true })), recoil = bandCenter(render({ crouching: true, flash: 3 }));
    return { idle, firing, crouch, recoil };
  });
  expect(result.idle).toBe(0); expect(result.firing).toBeGreaterThan(30);
  expect(result.crouch[2]).toBeGreaterThan(3); expect(result.recoil[2]).toBeGreaterThan(3);
  expect(Math.abs(result.crouch[0] - result.recoil[0])).toBeLessThanOrEqual(2);
  expect(Math.abs(result.crouch[1] - result.recoil[1])).toBeLessThanOrEqual(2);
});

test('the Rambo torso remains joined to the legs through the full run, recoil, jump and upward-aim cycles', async ({ page }, info) => {
  await open(page);
  const problems = await page.evaluate(async () => {
    const { MetalSlugArt } = await import('/src/metal-slug-art.js');
    const art = new MetalSlugArt(); await art.load();
    const canvas = document.createElement('canvas'); canvas.width = 170; canvas.height = 145;
    const c = canvas.getContext('2d'), failures = [];
    const poses = [];
    for (const facing of [-1, 1]) {
      for (let i = 0; i < 4; i++) poses.push({ facing, time: i / 7 + .001 });
      for (let stride = 0; stride < 190; stride += 10) for (const flash of [0, 1, 2, 3]) poses.push({ facing, vx: 150, stride, flash });
      for (const vy of [-200, 0, 200]) for (const aimUp of [false, true]) poses.push({ facing, grounded: false, vy, aimUp });
      for (const flash of [0, 1, 2, 3]) poses.push({ facing, aimUp: true, flash });
    }
    for (const weapon of ['pistol', 'heavy', 'flame']) for (const pose of poses) {
      c.clearRect(0, 0, 170, 145);
      art.commando(c, { x: 85, y: 112, time: 0, age: 0, grounded: true, facing: 1, vx: 0, vy: 0, flash: 0, weapon, ammo: 30, ...pose }, true);
      const data = c.getImageData(0, 0, 170, 145).data, seen = new Set(); let joined = false;
      // Connected body ink must extend from the red headband into the legs.
      // Muzzle flames and separate fluttering cloth ends may be separate islands.
      for (let i = 0; i < 170 * 145; i++) {
        if (!data[i * 4 + 3] || seen.has(i)) continue;
        const queue = [i]; seen.add(i); let red = 0, feet = 0;
        for (let j = 0; j < queue.length; j++) {
          const k = queue[j], x = k % 170, y = Math.floor(k / 170), a = k * 4;
          if (data[a] > 150 && data[a + 1] < 90 && data[a] > data[a + 1] * 2) red++;
          if (y > 96 && x > 60 && x < 110) feet++;
          for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
            const xx = x + dx, yy = y + dy, n = yy * 170 + xx;
            if (xx < 0 || xx >= 170 || yy < 0 || yy >= 145 || seen.has(n) || !data[n * 4 + 3]) continue;
            seen.add(n); queue.push(n);
          }
        }
        if (red >= 3 && feet >= 10) joined = true;
      }
      if (!joined) failures.push({ weapon, ...pose });
    }
    return failures;
  });
  expect(problems).toEqual([]);
});

test('resting frames seat the belt across the hips and keep the nose skin-colored', async ({ page }) => {
  await open(page);
  const frames = await page.evaluate(async () => {
    const { MetalSlugArt } = await import('/src/metal-slug-art.js');
    const art = new MetalSlugArt(); await art.load();
    const mask = frame => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
      const c = canvas.getContext('2d'); c.translate(45, 80); art.draw(c, frame);
      return c.getImageData(0, 0, 100, 100).data;
    };
    return ['idle', 'pistolIdle'].flatMap(group => art[group].map((frame, index) => {
      const torso = mask(frame), legs = mask(art.legs[index]), columns = new Set();
      for (let i = 0; i < 100 * 100; i++) if (torso[i * 4 + 3] && legs[i * 4 + 3]) columns.add(i % 100);
      // These four source cells place the same nose highlight at different rows.
      const nose = [...frame.sprite.getContext('2d').getImageData(20, [11, 10, 9, 9][index], 1, 1).data];
      return { group, index, beltWidth: columns.size, nose };
    }));
  });
  for (const frame of frames) {
    // A broad belt joins the trousers, rather than just a hand touching one leg.
    expect(frame.beltWidth, `${frame.group} frame ${frame.index}`).toBeGreaterThanOrEqual(10);
    if (frame.group === 'idle') expect(frame.nose).toEqual([248, 248, 232, 255]);
  }
});

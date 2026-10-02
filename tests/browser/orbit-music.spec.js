import {test,expect} from '@playwright/test';

async function open(page,level='slop-eater'){
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(`/?test&level=${level}`);await expect(page.locator('#levels')).toBeEnabled();
  await page.keyboard.press('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(()=>window.__stunt.render());
}
async function playing(page){
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media?.paused)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.currentTime)).toBeGreaterThan(0);
}

test('Slop Eater theme loops in full, continues through both phases and fades into the classic ending',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await playing(page);
  const track=await page.evaluate(()=>{
    window.bossTrack=window.__stunt.audio.orbitAudio.music.media;
    return {duration:window.bossTrack.duration,loop:window.bossTrack.loop,src:window.bossTrack.currentSrc};
  });
  expect(track.duration).toBeCloseTo(189.6,1);expect(track.loop).toBe(true);expect(track.src).toContain('slop-eater-theme.ogg');
  await page.evaluate(()=>{window.bossTrack.currentTime=window.bossTrack.duration-.15;});
  await expect.poll(()=>page.evaluate(()=>window.bossTrack.currentTime)).toBeLessThan(2);
  await page.evaluate(async()=>{
    window.bossTrack.currentTime=17;window.__stunt.advance(230);
    const {hitEater}=await import('/src/orbit-boss.js');
    const g=window.__stunt.game,o=g.orbit,b=o.eater;b.hp=31;b.exposure=10;b.open=true;
    hitEater(o,g,{x:b.x,power:1});window.__stunt.render();
  });
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('eater-break');
  await playing(page);
  await page.evaluate(()=>window.__stunt.advance(65));
  expect(await page.evaluate(()=>window.__stunt.game.orbit.eater.stage)).toBe(2);
  await page.evaluate(async()=>{
    const {hitEater}=await import('/src/orbit-boss.js');
    const g=window.__stunt.game,o=g.orbit,b=o.eater;b.hp=1;b.open=true;b.exposure=10;
    hitEater(o,g,{x:b.x,power:1});window.__stunt.render();
  });
  expect(await page.evaluate(()=>window.bossTrack===window.__stunt.audio.orbitAudio.music.media)).toBe(true);
  expect(await page.evaluate(()=>window.bossTrack.currentTime)).toBeGreaterThanOrEqual(17);
  await playing(page);await page.evaluate(()=>window.__stunt.advance(240));
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('return');
  await expect.poll(()=>page.evaluate(()=>window.bossTrack.paused)).toBe(true);
  expect(await page.evaluate(()=>window.bossTrack.currentTime)).toBe(0);expect(errors).toEqual([]);
});

test('boss music preserves its place on pause, mute and retry; New Game resets it',async({page})=>{
  await open(page,'slop-eater-fight');await playing(page);
  await page.evaluate(()=>{window.__stunt.audio.orbitAudio.music.media.currentTime=32;});
  await page.keyboard.press('p');
  const position=await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.currentTime);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.paused)).toBe(true);
  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(()=>window.__stunt.render());await playing(page);
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.health=1;o.hurt=0;o.hurtPlayer(g);window.__stunt.render();o.age=30;});
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.paused)).toBe(true);
  await page.keyboard.press('j');await page.evaluate(()=>window.__stunt.render());await playing(page);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.locator('#help').click();await page.locator('#sound').uncheck();await page.locator('#close-help').click();await page.keyboard.press('p');
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.paused)).toBe(true);
  await page.locator('#help').click();await page.locator('#sound').check();await page.locator('#close-help').click();await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(()=>window.__stunt.render());await playing(page);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.currentTime)).toBeGreaterThanOrEqual(position);
  await page.keyboard.press('r');
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.paused)).toBe(true);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media.currentTime)).toBe(0);
});

test('music starts with the descent, survives a checkpoint retry, and continues into the boss reveal',async({page})=>{
  await open(page,'downwell');await playing(page);
  await page.evaluate(()=>{window.descentTrack=window.__stunt.audio.orbitAudio.music.media;window.descentTrack.currentTime=32;});
  await page.evaluate(()=>{
    const g=window.__stunt.game,o=g.orbit;o.health=1;o.hurt=0;o.hurtPlayer(g);window.__stunt.render();o.age=30;
  });
  expect(await page.evaluate(()=>window.descentTrack.paused)).toBe(true);
  await page.keyboard.press('j');await page.evaluate(()=>window.__stunt.render());await playing(page);
  expect(await page.evaluate(()=>window.descentTrack.currentTime)).toBeGreaterThanOrEqual(32);
  await page.evaluate(async()=>{
    const {beginEater}=await import('/src/orbit-boss.js');
    const g=window.__stunt.game;beginEater(g.orbit,g);window.__stunt.render();
  });
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('eater-intro');await playing(page);
  expect(await page.evaluate(()=>window.descentTrack===window.__stunt.audio.orbitAudio.music.media)).toBe(true);
  expect(await page.evaluate(()=>window.descentTrack.currentTime)).toBeGreaterThanOrEqual(32);
});

test('music begins when the shaft collapse hands over to Downwell',async({page})=>{
  await open(page,'shaft-collapse');
  await page.evaluate(()=>{
    const g=window.__stunt.game;
    for(let n=0;n<600&&g.orbit.phase!=='breach';n++)window.__stunt.advance(1);
  });
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('breach');
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.music.media?.paused??true)).toBe(true);
  await page.evaluate(()=>{
    while(window.__stunt.game.orbit.phase==='breach')window.__stunt.advance(1);
  });
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('falling');await playing(page);
});

test('a missing descent track never blocks shooting',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/audio/slop-eater-theme.ogg',route=>route.abort());
  await open(page,'downwell');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.orbitAudio.music.failed)).toBe(true);
  await page.keyboard.down('j');await page.evaluate(()=>window.__stunt.advance(10,true));await page.keyboard.up('j');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBeLessThan(8);expect(errors).toEqual([]);
});

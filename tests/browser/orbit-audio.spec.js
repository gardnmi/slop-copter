import {test,expect} from '@playwright/test';
async function open(page,level='downwell'){
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(`/?test&level=${level}`);await expect(page.locator('#levels')).toBeEnabled();
  await page.keyboard.press('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(async()=>{
    window.__stunt.render();const a=window.__stunt.audio.orbitAudio;await a.ready;
    window.orbitPlays=[];const play=a.play.bind(a);
    a.play=(...args)=>{window.orbitPlays.push(args[0]);return play(...args);};
  });
}
const advance=(page,n)=>page.evaluate(n=>{for(let i=0;i<n;i++)window.__stunt.advance(1,true);},n);

test('compressed reference sounds decode, follow J/Space rounds and leave room for gems and impacts',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  const samples=await page.evaluate(()=>[...window.__stunt.audio.orbitAudio.buffers].map(([name,b])=>({name,duration:b.duration,peak:Math.max(...b.getChannelData(0))})));
  expect(samples).toHaveLength(13);for(const s of samples){expect(s.peak,s.name).toBeGreaterThan(.05);expect(s.duration,s.name).toBeGreaterThan(.03);}
  await page.evaluate(()=>{const o=window.__stunt.game.orbit;o.platforms=[];o.enemies=[];o.gemsItems=[];});
  await page.keyboard.down('j');await advance(page,19);await page.keyboard.up('j');
  expect(await page.evaluate(()=>window.orbitPlays.filter(n=>n==='shot').length)).toBe(4);
  await page.evaluate(()=>{
    const g=window.__stunt.game,o=g.orbit;o.collectGem(g);o.kill(g,{x:o.x,y:o.y+50,hp:1},true);window.__stunt.render();
  });
  expect(await page.evaluate(()=>window.orbitPlays)).toEqual(expect.arrayContaining(['gem','stomp']));
  const count=await page.evaluate(()=>window.orbitPlays.length);
  await page.evaluate(()=>{for(let i=0;i<50;i++)window.__stunt.render();});
  expect(await page.evaluate(()=>window.orbitPlays.length)).toBe(count);
  expect(errors).toEqual([]);
});

test('machine gun audio stays bounded; pause, mute, death, continue and classic return clean up',async({page})=>{
  await open(page,'slop-eater-fight');
  await page.keyboard.down('Space');await advance(page,30);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>window.orbitPlays.filter(n=>n==='shot').length)).toBe(10);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.voices.size)).toBeLessThanOrEqual(16);
  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('suspended');
  const count=await page.evaluate(()=>window.orbitPlays.length);await advance(page,50);
  expect(await page.evaluate(()=>window.orbitPlays.length)).toBe(count);
  await page.keyboard.press('p');await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.locator('#help').click();await page.locator('#sound').uncheck();
  await page.locator('#close-help').click();await page.keyboard.press('p');
  await page.evaluate(()=>{const o=window.__stunt.game.orbit;o.sound('eater-roar');o.sound('gun');window.__stunt.render();});
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.voices.size)).toBe(0);
  await page.locator('#help').click();await page.locator('#sound').check();
  await page.locator('#close-help').click();await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__stunt.audio.context.state)).toBe('running');
  await page.evaluate(()=>window.__stunt.render());expect(await page.evaluate(()=>window.orbitPlays.length)).toBe(count);
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.hurt=0;o.health=1;o.hurtPlayer(g);window.__stunt.render();o.age=30;});
  expect(await page.evaluate(()=>window.orbitPlays.at(-1))).toBe('player-death');
  await page.keyboard.press('j');await page.evaluate(()=>window.__stunt.render());
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.voices.size)).toBe(0);
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.sound('eater-roar');window.__stunt.render();o.beginReturn(g);window.__stunt.render();});
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.voices.size)).toBe(0);
});

test('missing optional recordings do not block the descent or its controls',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/audio/downwell/shot.ogg',route=>route.abort());await open(page);
  expect(await page.evaluate(()=>window.__stunt.audio.orbitAudio.buffers.has('shot'))).toBe(false);
  await page.keyboard.down('j');await advance(page,7);await page.keyboard.up('j');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(6);
  expect(errors).toEqual([]);
});

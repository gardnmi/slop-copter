import { test, expect } from '@playwright/test';

async function open(page,level='spaceship') {
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(`/?test&level=${level}`);await expect(page.locator('#levels')).toBeEnabled();
}

test('spacecraft destruction and the elevator battle break the lift and lead continuously into the playable descent',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.evaluate(async()=>{
    const {damageSpacecraft}=await import('/src/deck-boss.js');window.__stunt.advance(80);
    const g=window.__stunt.game;g.boarding.x=3714;
    damageSpacecraft(g.boarding,g,1000,g.boarding.boss.x,g.boarding.boss.y);
    for(let i=0;i<155;i++)window.__stunt.advance(1);
  });
  await page.screenshot({path:info.outputPath('lift-descending.png')});
  await page.evaluate(()=>{for(let i=0;i<270;i++)window.__stunt.advance(1);});
  expect(await page.evaluate(()=>window.__stunt.game.boarding.boss.form)).toBe('elevator');
  await page.screenshot({path:info.outputPath('warden-cockpit-and-gun-lock.png')});
  const result=await page.evaluate(async()=>{
    const {spacecraftInput}=await import('/tests/helpers/deck-playthrough.js');
    const g=window.__stunt.game,seen=new Set();
    for(let i=0;i<2400&&g.boarding.playing;i++){spacecraftInput(g);window.__stunt.advance(1);seen.add(g.boarding.boss.state);}
    return{states:[...seen],phase:g.boarding.phase,hp:g.boarding.health};
  });
  expect(result.phase).toBe('cleared');expect(result.hp).toBeGreaterThan(0);
  expect(result.states).toContain('warden-dying');expect(result.states).toContain('wreck');
  await page.screenshot({path:info.outputPath('warden-wreckage.png')});
  await page.evaluate(()=>window.__stunt.advance(45));
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('breach');
  await expect(page.locator('#mode-label')).toHaveText('● THE FLOOR GIVES WAY');
  await page.screenshot({path:info.outputPath('collapse-after-warden.png')});
  await page.evaluate(()=>window.__stunt.advance(175));
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('falling');
  await expect(page.locator('#overlay')).toBeHidden();expect(errors).toEqual([]);
});

test('both guns stay in the native hands in all directions; elevator Continue works on a phone',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'elevator');
  await page.evaluate(async()=>{
    const {equipWeapon}=await import('/src/deck-weapons.js');
    const g=window.__stunt.game,d=g.boarding;window.__stunt.advance(110);
    for(const type of ['heavy','flame'])for(const direction of [[1,0],[-1,0],[0,-1],[0,1]]){
      equipWeapon(d,type);g.setYoke(...direction);d.setFire(true);
      for(let i=0;i<6;i++)window.__stunt.advance(1);
    }
    d.boss.state='warden-press';d.boss.age=d.boss.warning+12;d.boss.drillX=d.boss.x-60;g.setYoke(0,0);d.setFire(false);window.__stunt.render();
  });
  await page.screenshot({path:info.outputPath('warden-hydraulic-press.png')});
  await page.evaluate(()=>{const g=window.__stunt.game;g.boarding.health=1;g.boarding.hurt=0;g.boarding.hurtPlayer(g);window.__stunt.advance(35);});
  await page.keyboard.press('k');await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{for(let i=0;i<110;i++)window.__stunt.advance(1);});
  expect(await page.evaluate(()=>window.__stunt.game.boarding.boss.form)).toBe('elevator');
  expect(await page.evaluate(()=>window.__stunt.game.boarding.boss.hp)).toBe(360);
  await page.screenshot({path:info.outputPath('elevator-portrait-continue.png')});expect(errors).toEqual([]);
});

test('keyboard movement steps off both outer boss catwalk edges without an invisible wall',async({page})=>{
  await open(page);
  for(const [x,key] of [[3442,'ArrowLeft'],[3952,'ArrowRight']]){
    await page.evaluate(x=>{const d=window.__stunt.game.boarding;d.x=x;d.y=158;d.vy=0;d.grounded=true;d.boss.age=-1000;},x);
    await page.keyboard.down(key);await page.evaluate(()=>window.__stunt.advance(35,true));await page.keyboard.up(key);
    const foot=await page.evaluate(()=>{const d=window.__stunt.game.boarding;return{x:d.x,y:d.y,grounded:d.grounded};});
    expect(foot.y).toBe(260);expect(foot.grounded).toBe(true);
    expect(x<3500?foot.x<3432:foot.x>3963).toBe(true);
  }
});

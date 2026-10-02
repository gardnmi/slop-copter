import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function open(page,level='below-deck') {
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto(`/?test&level=${level}`);
  await expect(page.locator('#mode-label')).toContainText('BELOW DECK');
}
test('keyboard jump, dash and grab belong to Below Deck; pause and Shift L preserve the room',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await expect(page.locator('#game')).toHaveAttribute('aria-label',/J dashes once/);
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('KeyK');
  await page.evaluate(()=>window.__stunt.advance(6,true));
  await page.keyboard.up('KeyK');await page.keyboard.press('KeyJ');
  await page.evaluate(()=>window.__stunt.advance(5,true));
  const result=await page.evaluate(()=>{const g=window.__stunt.game;return{x:g.below.x,y:g.below.y,dashes:g.below.dashes,trail:g.below.trail.length,shots:g.boarding.shots.length,grenades:g.boarding.grenades};});
  expect(result.x).toBeLessThan(280);expect(result.y).toBeLessThan(154);expect(result.dashes).toBe(0);expect(result.trail).toBeGreaterThan(0);expect(result.shots).toBe(0);
  await page.keyboard.down('KeyL');await page.evaluate(()=>window.__stunt.advance(1,true));
  expect(await page.evaluate(()=>window.__stunt.game.below.grabHeld)).toBe(true);
  await expect(page.locator('#level-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>window.__stunt.game.boarding.grenades)).toBe(result.grenades);
  await page.keyboard.up('KeyL');await page.keyboard.up('ArrowLeft');
  await page.screenshot({path:info.outputPath('below-dash.png')});
  await page.keyboard.press('p');const before=await page.evaluate(()=>JSON.stringify(window.__stunt.game.below));
  await page.evaluate(()=>window.__stunt.advance(80,true));expect(await page.evaluate(()=>JSON.stringify(window.__stunt.game.below))).toBe(before);
  await page.keyboard.press('p');await page.keyboard.press('Shift+KeyL');await expect(page.locator('#level-dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close level selector'}).click();expect(errors).toEqual([]);
});
test('the full eight-room route renders through the helicopter ending without entering orbit',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'below-collapse');
  await page.evaluate(()=>window.__stunt.advance(20));await page.screenshot({path:info.outputPath('floor-fracture.png')});
  await page.evaluate(()=>window.__stunt.advance(55));await page.screenshot({path:info.outputPath('hull-fall.png')});
  await page.evaluate(()=>window.__stunt.advance(65));
  const routes=JSON.parse(readFileSync(new URL('../fixtures/below-route.json',import.meta.url)));
  for(let i=0;i<routes.length;i++){
    await page.evaluate(()=>{const g=window.__stunt.game;while(g.below.phase==='transition')g.step(.02);window.__stunt.render();});
    await page.screenshot({path:info.outputPath(`below-room-${i+1}.png`)});
    await page.evaluate(route=>{
      const g=window.__stunt.game,o=g.below;
      for(const [mx,my,jump,dash,grab,frames]of route){
        if(jump)o.pressJump();else o.releaseJump();if(dash)o.pressDash();o.setGrab(grab);
        for(let t=0;t<frames;t++){g.setYoke(mx,my);g.step(.02);}window.__stunt.render();
      }
    },routes[i]);
  }
  await page.evaluate(()=>window.__stunt.advance(100));
  expect(await page.evaluate(()=>({phase:window.__stunt.game.below.phase,orbit:window.__stunt.game.orbit.active,deaths:window.__stunt.game.below.deaths}))).toEqual({phase:'complete',orbit:false,deaths:0});
  await expect(page.locator('#status')).toContainText('Back at the helicopter');
  await page.screenshot({path:info.outputPath('helicopter-reunited.png')});expect(errors).toEqual([]);
});
test('portrait touch dash and room retry work, with a stable world after resize',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page,'below-engine');
  const bounds=await page.getByRole('button',{name:'Dash (J)',exact:true}).boundingBox();
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,id:1}]});
  await page.evaluate(()=>window.__stunt.advance(5,true));
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>window.__stunt.game.below.dashes)).toBe(0);
  await page.screenshot({path:info.outputPath('below-portrait.png')});
  const before=await page.evaluate(()=>{const o=window.__stunt.game.below;return[o.x,o.y,o.roomTicks,o.dashes];});
  await page.setViewportSize({width:844,height:390});
  expect(await page.evaluate(()=>{const o=window.__stunt.game.below;return[o.x,o.y,o.roomTicks,o.dashes];})).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
  await page.evaluate(()=>{const g=window.__stunt.game;g.below.die(g);window.__stunt.advance(28);});
  expect(await page.evaluate(()=>[window.__stunt.game.below.phase,window.__stunt.game.below.roomIndex])).toEqual(['playing',4]);
  expect(errors).toEqual([]);
});

test('real J presses chain an upward second dash immediately after the first dash collects a crystal',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'below-refill');
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('KeyK');
  await page.evaluate(()=>window.__stunt.advance(18,true));await page.keyboard.up('KeyK');
  await page.keyboard.press('KeyJ');await page.evaluate(()=>window.__stunt.advance(9,true));
  const pickup=await page.evaluate(()=>{const o=window.__stunt.game.below;return{dash:o.dashes,refill:o.room.refills[0].cooldown,grounded:o.grounded,y:o.y,flash:o.refillFlash};});
  expect(pickup.dash).toBe(1);expect(pickup.refill).toBeGreaterThan(0);expect(pickup.grounded).toBe(false);expect(pickup.flash).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('crystal-refills-dash.png')});
  await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowUp');await page.keyboard.press('KeyJ');
  await page.evaluate(()=>window.__stunt.advance(10,true));
  const second=await page.evaluate(()=>{const o=window.__stunt.game.below;return{dash:o.dashes,dir:o.dashDir,y:o.y,grounded:o.grounded};});
  expect(second.dash).toBe(0);expect(second.dir).toEqual([0,-1]);expect(second.y).toBeLessThan(pickup.y-15);expect(second.grounded).toBe(false);
  await page.screenshot({path:info.outputPath('second-air-dash.png')});await page.keyboard.up('ArrowUp');expect(errors).toEqual([]);
});

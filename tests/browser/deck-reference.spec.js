import { test, expect } from '@playwright/test';
async function open(page,level='deck-raid') {
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto(`/?test&level=${level}`);await expect(page.locator('#levels')).toBeEnabled();
}

test('pistol, spread tracers and engulfed enemies use keyed native frames without firing behind the barrel',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  const result=await page.evaluate(async()=>{
    const {MetalSlugArt}=await import('/src/metal-slug-art.js');const {weaponShot}=await import('/src/deck-weapon-art.js');
    const {fireDeckWeapon,equipWeapon}=await import('/src/deck-weapons.js');
    const a=new MetalSlugArt();await a.load();
    const c=document.createElement('canvas');c.width=240;c.height=180;const ctx=c.getContext('2d');let behind=0,keys=0,ink=0;
    const flashPixels=a.pistolUp[0].sprite.getContext('2d').getImageData(0,0,26,25).data;
    let redFlash=0;for(let i=0;i<flashPixels.length;i+=4)if(flashPixels[i+3]&&flashPixels[i]>100&&flashPixels[i]>flashPixels[i+1]*2)redFlash++;
    for(const group of [a.shobu,a.shobuRotor,a.shobuBombs,a.heavyStreak,a.flameShot,a.rebelBurn,a.rebelBurnFall])for(const frame of group){
      const p=frame.sprite.getContext('2d').getImageData(0,0,frame.sprite.width,frame.sprite.height).data;
      for(let i=0;i<p.length;i+=4)if(p[i+3]){ink++;if(p[i]===0&&p[i+1]>230&&p[i+2]===0)keys++;}
    }
    for(const type of ['pistol','heavy','flame'])for(const direction of [1,-1]){
      ctx.clearRect(0,0,240,180);const shot={weapon:type,x:120+10*direction,y:90,startX:120,startY:90,vx:500*direction,vy:0,age:1,variant:1};
      weaponShot(ctx,shot,a,false);const p=ctx.getImageData(0,0,240,180).data;
      for(let y=0;y<180;y++)for(let x=0;x<240;x++)if((x-120)*direction<-1&&p[(y*240+x)*4+3])behind++;
    }
    const g=window.__stunt.game,d=g.boarding;const initial=d.weapon;
    d.hurt=0;d.props=[];d.enemies=[{x:205,y:260,hp:3,type:'soldier',age:0,state:'patrol',clock:999,facing:-1,flash:0}];
    equipWeapon(d,'flame');d.setFire(true);window.__stunt.advance(23);
    return{behind,keys,ink,redFlash,initial,burning:d.enemies[0].burning,alive:d.playing};
  });
  expect(result).toMatchObject({behind:0,keys:0,initial:'pistol',burning:true,alive:true});expect(result.ink).toBeGreaterThan(10000);expect(result.redFlash).toBeGreaterThan(15);
  await page.screenshot({path:info.outputPath('native-flame-death-and-arcade-hud.png')});expect(errors).toEqual([]);
});

test('native R-Shobu renders bomb columns and can be beaten from its level-select checkpoint',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'deck-helicopter');
  await page.evaluate(()=>window.__stunt.advance(209));await page.screenshot({path:info.outputPath('r-shobu-bomb-column.png')});
  expect(await page.evaluate(()=>window.__stunt.game.boarding.bullets.some(b=>b.kind==='shobu-bomb'))).toBe(true);
  const result=await page.evaluate(async()=>{
    const {helicopterInput}=await import('/tests/helpers/deck-playthrough.js');const g=window.__stunt.game,d=g.boarding;
    for(let i=0;i<1400&&d.playing&&d.miniboss.state!=='wreck';i++){helicopterInput(g);window.__stunt.advance(1);}
    return{state:d.miniboss.state,hp:d.health};
  });
  expect(result.state).toBe('wreck');expect(result.hp).toBeGreaterThan(0);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('r-shobu-destroyed-go.png')});
});

test('arcade HUD and the new encounter fit a phone and keep working with reduced motion',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});await open(page,'deck-helicopter');
  await page.evaluate(()=>window.__stunt.advance(170));await page.screenshot({path:info.outputPath('r-shobu-portrait.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.keyboard.press('p');const before=await page.evaluate(()=>JSON.stringify(window.__stunt.game.boarding));
  await page.evaluate(()=>window.__stunt.advance(100));expect(await page.evaluate(()=>JSON.stringify(window.__stunt.game.boarding))).toBe(before);
  expect(errors).toEqual([]);
});

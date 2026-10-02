import {test,expect} from '@playwright/test';
async function open(page,level='downwell'){
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;Date.now=()=>19;});
  await page.goto(`/?test&level=${level}`);await expect(page.locator('#levels')).toBeEnabled();
}
const advance=(p,n,controls=true)=>p.evaluate(([n,c])=>window.__stunt.advance(n,c),[n,controls]);

test('J jumps and fires like Space; overlapping action keys stay held until both are released',async({page})=>{
  await open(page,'downwell-storm');
  await page.keyboard.down('j');await advance(page,8);
  expect(await page.evaluate(()=>[window.__stunt.game.orbit.grounded,window.__stunt.game.orbit.jumpLatch,window.__stunt.game.orbit.ammo])).toEqual([false,true,8]);
  await page.keyboard.down('Space');await page.keyboard.up('j');await advance(page,1);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.jumpLatch)).toBe(true);
  await page.keyboard.up('Space');
  expect(await page.evaluate(()=>[window.__stunt.game.orbit.held,window.__stunt.game.orbit.jumpLatch])).toEqual([false,false]);
  await page.keyboard.down('j');await advance(page,1);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(7);
  await page.keyboard.down('Space');await page.keyboard.up('j');await advance(page,7);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(6);
  await page.keyboard.up('Space');await advance(page,7);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(6);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.held)).toBe(false);
});

test('J fires the boss machine gun, resumes pause and continues the descent checkpoint',async({page})=>{
  await open(page,'slop-eater-fight');
  await page.keyboard.down('j');await advance(page,10);await page.keyboard.up('j');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBeLessThan(43);
  await page.keyboard.press('p');const ammo=await page.evaluate(()=>window.__stunt.game.orbit.ammo);
  await advance(page,20);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(ammo);
  await page.keyboard.press('j');expect(await page.evaluate(()=>window.__stunt.game.paused)).toBe(false);
  await page.evaluate(()=>{
    const g=window.__stunt.game,o=g.orbit;o.health=1;o.hurt=0;o.hurtPlayer(g);window.__stunt.advance(31);
  });
  await page.keyboard.press('j');
  expect(await page.evaluate(()=>[window.__stunt.game.orbit.phase,window.__stunt.game.orbit.health,window.__stunt.game.orbit.ammo])).toEqual(['eater-fight',4,45]);
});

test('keyboard fire from freefall, empty charge and pointer isolation work in Cloudfall',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await expect(page.locator('#game')).toBeFocused();await expect(page.locator('.touch-controls')).toBeHidden();
  await page.keyboard.down('Space');await advance(page,1);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(7);
  await page.keyboard.up('Space');await page.locator('#game').click({position:{x:730,y:300}});await advance(page,1);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(7);
  await page.keyboard.down('ArrowRight');await advance(page,20);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.x)).toBeGreaterThan(200);
  await page.keyboard.down('Space');await advance(page,45);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBe(0);
  await page.screenshot({path:info.outputPath('cloudfall-gunboots.png')});expect(errors).toEqual([]);
});

test('the playable well uses three inks, native small sprites and no cloud hazards',async({page},info)=>{
  await open(page,'downwell-storm');
  const result=await page.evaluate(()=>{
    const g=window.__stunt.game;window.__stunt.render();
    const canvas=document.querySelector('#game'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const palette=new Set(['0,0,0','255,255,255','255,0,0']);let other=0;
    for(let i=0;i<pixels.length;i+=4)if(!palette.has(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`))other++;
    return{fraction:other/(pixels.length/4),clouds:g.orbit.clouds.length};
  });
  expect(result.clouds).toBe(0);expect(result.fraction).toBeLessThan(.005);
  await page.screenshot({path:info.outputPath('downwell-three-ink-style.png')});
});

test('red pose echoes follow movement and chunky shots have a white leading tip',async({page},info)=>{
  await open(page,'downwell-storm');
  const art=await page.evaluate(async()=>{
    const {loadWellSprites,referenceShot,referenceTrail}=await import('/src/orbit-sprites.js');
    await loadWellSprites();
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=120;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const inspect=()=>{
      const p=c.getImageData(0,0,96,120).data;let red=0,white=0,top=120,bottom=0,left=96,right=0,whiteTop=120;
      for(let y=0;y<120;y++)for(let x=0;x<96;x++){
        const i=(y*96+x)*4;if(!p[i+3])continue;
        top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
        if(p[i]>0&&p[i+1]===0&&p[i+2]===0)red++;
        if(p[i]===255&&p[i+1]===255&&p[i+2]===255){white++;whiteTop=Math.min(whiteTop,y);}
      }
      return{red,white,top,bottom,width:right-left+1,height:bottom-top+1,whiteTop};
    };
    referenceShot(c,{x:48,y:80,age:3,volley:1,power:1});const regular=inspect();
    c.clearRect(0,0,96,120);referenceShot(c,{x:48,y:80,age:3,volley:1,power:2});const enhanced=inspect();
    c.clearRect(0,0,96,120);
    const trail={trail:[{x:48,y:70,vx:240,vy:300,time:1,facing:1,age:2,life:12,enhanced:true}]};
    referenceTrail(c,trail);const echo=inspect();
    c.clearRect(0,0,96,120);referenceTrail(c,trail,true);const reduced=inspect();
    return{regular,enhanced,echo,reduced};
  });
  for(const shot of [art.regular,art.enhanced]){
    expect(shot.red).toBeGreaterThan(60);expect(shot.white).toBeGreaterThan(60);
    expect(shot.whiteTop).toBeGreaterThan(shot.top+shot.height/2);expect(shot.bottom).toBe(79);
  }
  expect(art.enhanced.width).toBeGreaterThan(art.regular.width);
  expect(art.enhanced.height).toBeGreaterThan(art.regular.height);
  expect(art.echo.white).toBe(0);expect(art.echo.red).toBeGreaterThan(70);
  expect(art.echo.red).toBeLessThan(art.echo.width*art.echo.height*.7);
  expect(art.reduced.red).toBe(0);
  await page.evaluate(()=>{
    const o=window.__stunt.game.orbit;
    o.x=225;o.y=2440;o.cameraY=2250;o.vy=200;o.grounded=false;o.gemHigh=150;
  });
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('Space');await advance(page,10);
  const before=await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit.trail));
  expect(JSON.parse(before).length).toBeGreaterThan(3);
  await page.evaluate(()=>{for(let i=0;i<8;i++)window.__stunt.render();});
  expect(await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit.trail))).toBe(before);
  await page.screenshot({path:info.outputPath('downwell-shots-and-red-echo.png')});
  await page.keyboard.up('ArrowLeft');await page.keyboard.up('Space');
});

test('continuous longer descent and Slop Eater fight use normal inputs and finish in the scene',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  await page.screenshot({path:info.outputPath('01-earth-from-space.png')});
  let route={release:0},result;
  for(const [until,name]of [[2200,'02-middle-descent'],[4200,'03-lower-descent'],[6100,'04-final-rooms'],[7000,'05-slop-eater-arrival']]){
    result=await page.evaluate(async({until,route})=>{
      const {orbitInput}=await import('/tests/helpers/orbit-playthrough.js');const g=window.__stunt.game,o=g.orbit;
      for(let i=0;i<5000&&o.canAct&&o.y<until;i++){orbitInput(g,route);window.__stunt.advance(1);}
      return{phase:o.phase,health:o.health,gems:o.gems,band:o.band,route};
    },{until,route});route=result.route;
    await page.screenshot({path:info.outputPath(`${name}.png`)});
  }
  expect(result.phase).toBe('eater-intro');await advance(page,165,false);
  await page.screenshot({path:info.outputPath('06-slop-eater-title.png')});
  result=await page.evaluate(async route=>{
    const {orbitInput}=await import('/tests/helpers/orbit-playthrough.js');const g=window.__stunt.game,o=g.orbit;
    for(let i=0;i<4000&&!o.dead&&o.phase!=='return';i++){orbitInput(g,route);window.__stunt.advance(1);}
    return{phase:o.phase,health:o.health,gems:o.gems,band:o.band};
  },route);
  expect(result.phase).toBe('return');expect(result.health).toBeGreaterThan(0);expect(result.gems).toBeGreaterThan(30);expect(result.band).toBe(2);
  await expect(page.locator('#overlay')).toBeHidden();expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('freefall-out-of-well.png')});
});

test('Slop Eater name reveal pauses, fits portrait, hands back controls and continues directly into the fight',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'slop-eater');
  await advance(page,55,false);await page.screenshot({path:info.outputPath('slop-eater-eye-closeup.png')});
  await page.keyboard.down('Space');await advance(page,100);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('eater-intro');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.shots.length)).toBe(0);
  await page.screenshot({path:info.outputPath('slop-eater-title.png')});
  await page.keyboard.press('p');const before=await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit));
  await advance(page,50);await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit))).toBe(before);
  await page.keyboard.press('p');await page.evaluate(()=>window.__stunt.render());
  await page.screenshot({path:info.outputPath('slop-eater-title-portrait.png')});
  await advance(page,75,false);expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('eater-fight');
  expect(await page.evaluate(()=>[window.__stunt.game.orbit.weapon,window.__stunt.game.orbit.ammo])).toEqual(['machine',45]);
  await page.keyboard.down('Space');await advance(page,20);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.ammo)).toBeLessThan(45);
  await page.screenshot({path:info.outputPath('slop-eater-fight-portrait.png')});
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.health=1;o.hurt=0;o.hurtPlayer(g);window.__stunt.advance(31);});
  await page.keyboard.press('Space');
  expect(await page.evaluate(()=>[window.__stunt.game.orbit.phase,window.__stunt.game.orbit.health])).toEqual(['eater-fight',4]);
  await expect(page.locator('#overlay')).toBeHidden();expect(errors).toEqual([]);
});

test('hay boss damage flashes its straw silhouette white without a rectangular mask',async({page},info)=>{
  await open(page,'slop-eater-fight');
  const result=await page.evaluate(async()=>{
    const {loadWellSprites}=await import('/src/orbit-sprites.js');await loadWellSprites();
    const {drawEaterBody}=await import('/src/orbit-boss-art.js');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=560;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const boss={...window.__stunt.game.orbit.eater,x:160,y:140,hit:0,open:true};
    const sample=hit=>{c.clearRect(0,0,320,560);drawEaterBody(c,{...boss,hit},0,{reduced:true});return c.getImageData(0,0,320,560).data;};
    const normal=sample(0),flash=sample(3);let red=0,converted=0,spill=0,lower=0,other=0;
    for(let i=0;i<normal.length;i+=4){
      const lit=normal[i+3]&&(normal[i]||normal[i+1]||normal[i+2]);
      if(normal[i+3]&&normal[i]===255&&normal[i+1]===0){
        red++;if(flash[i]===255&&flash[i+1]===255&&flash[i+2]===255){converted++;if(i/4/320>300)lower++;}
      }
      if(!lit&&flash[i+3]&&flash[i+1]===255)spill++;
      if(flash[i+3]&&!((flash[i]===255&&flash[i+1]===255&&flash[i+2]===255)||(flash[i]===0&&flash[i+1]===0&&flash[i+2]===0)))other++;
    }
    const g=window.__stunt.game,o=g.orbit,b=o.eater;
    // A real downward round crosses the exposed eye through normal collision.
    o.enemies=[];o.shots=[{x:b.x,y:b.y-72,age:0,power:1}];window.__stunt.advance(1);
    return{red,converted,spill,lower,other,hp:b.hp,hit:b.hit};
  });
  expect(result.red).toBeGreaterThan(400);expect(result.converted).toBe(result.red);
  expect(result.lower).toBeGreaterThan(50);expect(result.spill).toBe(0);expect(result.other).toBe(0);
  expect(result.hp).toBe(59);expect(result.hit).toBe(3);
  await page.screenshot({path:info.outputPath('slop-eater-whole-body-hit-flash.png')});
});

test('the boss breathes and chomps without side appendages, then erupts and stays white into freefall',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'slop-eater-fight');
  const animation=await page.evaluate(async()=>{
    const {loadWellSprites}=await import('/src/orbit-sprites.js');await loadWellSprites();
    const {drawEaterBody}=await import('/src/orbit-boss-art.js');
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=560;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
    const b={...window.__stunt.game.orbit.eater,x:160,y:270,open:false,hit:0};
    const sample=(t,cycle,reduced=false,stage=1)=>{c.clearRect(0,0,320,560);drawEaterBody(c,{...b,cycle,stage,attack:'chomp'},t,{reduced});return c.getImageData(0,0,320,560).data;};
    const idle=sample(0,0),breathing=sample(18,0),chomp=sample(124,124),quiet=sample(0,0,true),quietLater=sample(18,0,true);
    const changed=(a,b)=>a.reduce((sum,v,i)=>sum+(i%4!==3&&v!==b[i]?1:0),0);
    // Former side claws reached above the crown. Its new animation only lives
    // within the connected head/body silhouette, leaving that airspace empty.
    let floating=0;for(let y=0;y<140;y++)for(let x=0;x<320;x++)if(chomp[(y*320+x)*4+3])floating++;
    const wounded=sample(0,0,true,2),woundedLater=sample(18,0,true,2);
    return{breathing:changed(idle,breathing),chomp:changed(idle,chomp),reduced:changed(quiet,quietLater),floating,
      wounds:changed(quiet,wounded),lastingWounds:changed(wounded,woundedLater)};
  });
  expect(animation.breathing).toBeGreaterThan(2000);expect(animation.chomp).toBeGreaterThan(4000);
  expect(animation.reduced).toBe(0);expect(animation.floating).toBe(0);
  expect(animation.wounds).toBeGreaterThan(1000);expect(animation.lastingWounds).toBe(0);
  await page.keyboard.down('Space');await advance(page,22);
  await page.screenshot({path:info.outputPath('slop-eater-machine-gun.png')});
  await page.evaluate(async()=>{
    const {hitEater}=await import('/src/orbit-boss.js');const g=window.__stunt.game,o=g.orbit,b=o.eater;
    b.stage=2;b.hp=1;b.open=true;b.exposure=10;hitEater(o,g,{x:b.x,power:1});
  });
  await page.keyboard.down('ArrowRight');await advance(page,12);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>window.__stunt.game.orbit.x)).toBeGreaterThan(170);
  await advance(page,60);await page.screenshot({path:info.outputPath('slop-eater-chain-reaction.png')});
  expect(await page.evaluate(()=>window.__stunt.game.orbit.eater.deathBursts.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__stunt.game.orbit.eater.blood.length)).toBeGreaterThan(20);
  await page.keyboard.up('Space');await advance(page,156);
  await page.screenshot({path:info.outputPath('slop-eater-final-white-wash.png')});
  await advance(page,13);expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('return');
  const white=await page.evaluate(()=>{
    const canvas=document.querySelector('#game'),c=canvas.getContext('2d');
    const p=c.getImageData(Math.round(canvas.width*.52),Math.round(canvas.height*.65),1,1).data;return [...p];
  });
  expect(white).toEqual([255,255,255,255]);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('slop-eater-white-freefall-handoff.png')});
});

test('damage, checkpoint Continue, pause and portrait resizing preserve the new chapter',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await open(page,'downwell-storm');
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.hurt=0;o.hurtPlayer(g);window.__stunt.render();});
  await page.screenshot({path:info.outputPath('damage-portrait.png')});
  await page.keyboard.press('p');const before=await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit));
  await advance(page,50);await page.setViewportSize({width:844,height:390});
  expect(await page.evaluate(()=>JSON.stringify(window.__stunt.game.orbit))).toBe(before);await page.keyboard.press('p');
  await page.evaluate(()=>{const g=window.__stunt.game,o=g.orbit;o.health=1;o.hurt=0;o.hurtPlayer(g);window.__stunt.advance(35);});
  await page.keyboard.press('Space');expect(await page.evaluate(()=>[window.__stunt.game.orbit.phase,window.__stunt.game.orbit.band,window.__stunt.game.orbit.health])).toEqual(['falling',1,4]);
  await page.keyboard.press('l');await expect(page.locator('#level-dialog')).toBeHidden();expect(errors).toEqual([]);
});


test('the ending falls into the classic hay and hands back working controls without a scene jump',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,'full-circle');
  const flight=await page.evaluate(async()=>{
    const {returnFallTicks}=await import('/src/orbit-return.js');return returnFallTicks(window.__stunt.game.orbit.returnScene);
  });
  let age=0;
  expect(flight).toBeGreaterThan(180);
  for(const [at,name]of [[0,'freefall'],[60,'morph'],[Math.floor(flight*.7),'cloud'],[flight-1,'approach'],[flight,'hay'],[flight+44,'handoff']]){
    await advance(page,at-age);age=at;await page.screenshot({path:info.outputPath(`ending-${name}.png`)});
    expect(await page.evaluate(()=>window.__stunt.game.orbit.phase)).toBe('return');
    await expect(page.locator('#overlay')).toBeHidden();
    if(name==='cloud'){
      const slowFall=await page.evaluate(()=>{
        const g=window.__stunt.game.orbit.returnScene,y=g.jumper.y;
        const canvas=document.querySelector('#game'),c=canvas.getContext('2d');
        const before=c.getImageData(0,0,canvas.width,canvas.height).data;
        const x=g.jumper.x;g.jumper.x=-10000;window.__stunt.render();
        const without=c.getImageData(0,0,canvas.width,canvas.height).data;
        const hidden=before.every((value,i)=>value===without[i]);
        g.jumper.x=x;window.__stunt.render();
        window.__stunt.advance(1);return {dy:g.jumper.y-y,inCloud:g.jumper.inCloud,hidden};
      });age++;
      expect(slowFall).toEqual({dy:2,inCloud:true,hidden:true});
    }
    if(at>=flight)expect(await page.evaluate(()=>{
      const g=window.__stunt.game.orbit.returnScene;return [g.state,g.outcome,g.catches];
    })).toEqual(['result','hay',1]);
  }
  const mismatch=await page.evaluate(()=>{
    const canvas=document.querySelector('#game'),c=canvas.getContext('2d'),scene=window.__stunt.game.orbit.returnScene;
    // The normal hay celebration ends in the dashboard; compare the actual
    // world above it so that expected HUD change cannot hide a scenery jump.
    const height=Math.floor(scene.hudY/scene.height*canvas.height);
    const before=c.getImageData(0,0,canvas.width,height).data;
    window.__stunt.advance(1);const after=c.getImageData(0,0,canvas.width,height).data;
    let changed=0;for(let i=0;i<after.length;i+=4)if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2])>80)changed++;
    return changed/(after.length/4);
  });
  expect(mismatch).toBeLessThan(.01);
  expect(await page.evaluate(()=>[window.__stunt.game.completedLoops,window.__stunt.game.orbit.active,window.__stunt.game.shiftCount])).toEqual([1,false,0]);
  await expect(page.locator('#mode-label')).toHaveText('● CLASSIC');
  await page.keyboard.down('ArrowRight');await advance(page,15);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>window.__stunt.game.dh)).toBeGreaterThan(0);
  await page.keyboard.press('Space');expect(await page.evaluate(()=>window.__stunt.game.state)).toBe('falling');expect(errors).toEqual([]);
});

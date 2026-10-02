import {test,expect} from '@playwright/test';

test('batched Matrix fields preserve the pixel pattern and reuse their raster',async({page})=>{
  await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
  await page.goto('/?test&level=classic');await expect(page.locator('#levels')).toBeEnabled();
  const result=await page.evaluate(async()=>{
    const {Renderer}=await import('/src/render.js');
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=180;
    const r=new Renderer(canvas),c=r.c;r.reducedMotion=false;c.imageSmoothingEnabled=false;
    const noise=(x,y,s)=>((Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1274126177))&65535)/65535;
    let maxDifference=0,uploads=0;
    for(const time of [0,.02,3.18]){
      c.globalAlpha=1;c.fillStyle='#06080c';c.fillRect(0,0,600,180);c.fillStyle='#8bffa5';
      for(let row=0;row<35;row++)for(let col=row%2;col<150;col+=2){
        const edge=Math.max(Math.abs(col*4-300)/300,row*4/140),threshold=Math.max(.02,(edge-.4)*.6+.1*Math.sin(col*.43-time*2)+.08*Math.sin(row*.7+time));
        if(noise(col,row,7)>threshold)continue;
        c.globalAlpha=(.18+.36*noise(row,col,14))*.55;c.fillRect(col*4,row*4,4,4);
      }
      const before=c.getImageData(0,0,600,140).data;
      c.globalAlpha=1;c.fillStyle='#06080c';c.fillRect(0,0,600,180);r.field(0,0,600,140,time,7,.55);
      const after=c.getImageData(0,0,600,140).data;
      for(let i=0;i<after.length;i++)maxDifference=Math.max(maxDifference,Math.abs(after[i]-before[i]));
    }
    const cached=r.fieldCache.get(7),put=cached.context.putImageData.bind(cached.context);
    cached.context.putImageData=(...args)=>{uploads++;put(...args);};
    for(let i=0;i<120;i++)r.field(0,0,600,140,3.18,7,.55);
    return{maxDifference,uploads,entries:r.fieldCache.size,sameRaster:r.fieldCache.get(7)===cached};
  });
  expect(result.maxDifference).toBeLessThanOrEqual(2);
  expect(result.uploads).toBe(0);expect(result.entries).toBe(1);expect(result.sameRaster).toBe(true);
});

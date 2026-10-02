import {pixelLine,WELL_RED as RED,WELL_WHITE as WHITE} from './orbit-pixels.js';
import {whiteFlash} from './orbit-sprites.js';
import {eaterWarning} from './orbit-boss.js';
import {eaterSprite,hayMaterial,HAY_HEIGHT as HEIGHT,HAY_EYE_Y as EYE_Y} from './hay-eater-sprite.js';
export {eaterSprite} from './hay-eater-sprite.js';

export function drawEaterBody(c,b,t,{reduced=false,death=0,lookX=b.x}={}){
  const wounded=b.wounded||b.stage===2;
  const breath=reduced?0:Math.sin(t*(wounded?.14:.09));
  const charge=reduced||!eaterWarning(b)?0:(b.cycle-70)/40;
  const snap=reduced||b.attack!=='chomp'||b.cycle<110||b.cycle>=138?0:Math.sin((b.cycle-110)/28*Math.PI);
  const gaze=reduced?0:Math.max(-2,Math.min(2,Math.round((lookX-b.x)/48)));
  const sprite=eaterSprite(b.open&&death<12,wounded,gaze,reduced?0:Math.floor(t/7));
  // The two eyes straddle the existing 50px weak point. Breathe about their
  // centre so the visible target never floats away from bullet collision.
  const width=280+Math.round(breath*4+charge*8-snap*10);
  const height=284+Math.round(breath*8-charge*30+snap*32);
  const x=Math.round(b.x-width/2),y=Math.round(b.y-60-EYE_Y*height/HEIGHT);
  if(death>12){
    const collapse=Math.min(1,(death-12)/90),h=Math.round(height*(1-collapse*.68));
    const yy=Math.round(y+collapse*75);
    c.drawImage(hayMaterial(true),x,yy,width,h);
    if(!reduced)for(let i=0;i<22;i++){
      const side=i%2?1:-1,age=(death+i*7)%64;
      const sx=b.x+side*(20+age*.9+i),sy=yy+30+i%5*14+age*age*.022;
      pixelLine(c,sx,sy,sx+side*(4+i%6),sy+8, i%4?WHITE:RED);
    }
    return;
  }
  c.drawImage(sprite,x,y,width,height);
  if(b.hit>0)c.drawImage(whiteFlash(sprite),x,y,width,height);
}

import {WELL_END} from './orbit-layout.js';
import {wellFrame} from './orbit-sprites.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
// Retained for the ending's distance state; gameplay uses the original
// quiet red/white side scenery rather than a giant moving globe.
export function earthApproach(depth){
 const progress=clamp((depth-19)/(WELL_END-19));
 return{progress,altitude:Math.round(380*(1-progress)**2),atmosphere:smooth((progress-.45)/.5),stars:1-smooth((progress-.27)/.52),radius:1+progress*2+progress**3*20,horizon:.48-smooth(progress)*1.11};
}
export class OrbitSky {
 draw(c,o,w,h){
   c.fillStyle='#000000';c.fillRect(0,0,w,h);
   {
     const sky=wellFrame('reference-atlas',0,1848,512,160);
     c.drawImage(sky,0,Math.round(h*.55),w,Math.ceil(h*.45));
   }
   return earthApproach(o.cameraY);
 }
}

import { currentWeapon } from './deck-weapons.js';

// Native arcade glyphs, with the game's actual score, ammunition and health.
// Transparent background: only the ammo panel has a thin mechanical border.
export class DeckHud {
  async load() {
    this.image = new Image(); this.image.src = `${import.meta.env.BASE_URL}assets/reference/metal-slug-hud.png`;
    await this.image.decode(); this.cache = new Map();
  }
  glyph(char, palette = 'silver', large = false) {
    const key = `${char}:${palette}:${large}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let rect;
    if (large) {
      const xs = [402,3,27,74,121,168,215,262,308,355], x = xs[Number(char)];
      rect = [x,106,char === '1' ? 21 : char === '7' ? 43 : 44,48];
    } else if (/[A-Z]/.test(char)) rect = [3 + (char.charCodeAt(0) - 65) * 9,963,8,8];
    else if (/[0-9]/.test(char)) rect = [[82,3,10,19,28,37,46,55,64,73][Number(char)],973,7,8];
    else if (char === '∞') rect = [105,973,17,8];
    else if (char === '-') rect = [96,973,8,8];
    else return null;
    const canvas = document.createElement('canvas'); canvas.width = rect[2]; canvas.height = rect[3];
    const c = canvas.getContext('2d'); c.drawImage(this.image,...rect,0,0,canvas.width,canvas.height);
    const pixels = c.getImageData(0,0,canvas.width,canvas.height), p = pixels.data, visited = new Set(), queue = [];
    // Flood only exterior white. White highlights inside outlined numerals stay.
    for (let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if (!x || !y || x===canvas.width-1 || y===canvas.height-1) queue.push(y*canvas.width+x);
    while(queue.length) {
      const n=queue.pop(); if(visited.has(n))continue; visited.add(n);
      const i=n*4; if(p[i]!==255||p[i+1]!==255||p[i+2]!==255)continue;
      p[i+3]=0; const x=n%canvas.width,y=Math.floor(n/canvas.width);
      if(x)queue.push(n-1);if(x<canvas.width-1)queue.push(n+1);if(y)queue.push(n-canvas.width);if(y<canvas.height-1)queue.push(n+canvas.width);
    }
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++) {
      const i=(y*canvas.width+x)*4;if(!p[i+3])continue;
      const brightness=Math.max(p[i],p[i+1],p[i+2]);
      if(brightness<65) { p[i]=12;p[i+1]=16;p[i+2]=20;continue; }
      const t=y/canvas.height;
      const color=palette==='gold' ? t<.42?[255,242,126]:t<.63?[255,196,58]:[226,105,35]
        :t<.45?[249,249,225]:t<.65?[183,210,212]:[100,131,156];
      const shade=large?.58+brightness/610:1;
      for(let k=0;k<3;k++)p[i+k]=color[k]*shade;
    }
    c.putImageData(pixels,0,0);
    let result=canvas;
    if(large) {
      // The source uses checkerboard shading. Nearest-neighbor halving samples
      // only the dark squares and erases half a numeral, so average once then
      // snap alpha and colors back to a compact pixel palette.
      result=document.createElement('canvas');result.width=25;result.height=28;
      const rc=result.getContext('2d');rc.drawImage(canvas,0,0,25,28);
      const small=rc.getImageData(0,0,25,28);
      for(let i=0;i<small.data.length;i+=4){small.data[i+3]=small.data[i+3]>100?255:0;for(let k=0;k<3;k++)small.data[i+k]=Math.round(small.data[i+k]/16)*16;}
      rc.putImageData(small,0,0);
    }
    this.cache.set(key,result);return result;
  }
  text(c, text, x, y, scale=1, palette='silver', align='left') {
    const width=[...text].reduce((n,ch)=>n+(ch==='∞'?18:9)*scale,0);
    if(align==='right')x-=width;if(align==='center')x-=width/2;
    for(const ch of text) {
      const glyph=this.glyph(ch,palette);if(glyph)c.drawImage(glyph,Math.round(x),Math.round(y),Math.round(glyph.width*scale),Math.round(glyph.height*scale));
      x+=(ch==='∞'?18:9)*scale;
    }
  }
  header(c,d,game,w,h) {
    const scale=w>=600?1.25:1;
    c.save();c.scale(scale,scale);const width=w/scale;
    this.text(c,String(game.score).padStart(6,'0'),14,7,1.1);
    // Five damage units inside the reference's blue checkerboard meter.
    c.fillStyle='#10141c';c.fillRect(11,19,64,8);c.strokeStyle='#c0d8d5';c.strokeRect(11.5,19.5,63,7);
    for(let y=0;y<4;y++)for(let x=0;x<Math.round(d.health/5*58);x++){
      c.fillStyle=(x+y)%2?'#a2e4ee':'#375a7a';c.fillRect(14+x,21+y,1,1);
    }
    this.text(c,`1UP ${d.health}`,13,30,1,'gold');
    c.strokeStyle='#849a9a';c.strokeRect(88.5,7.5,81,23);
    this.text(c,'ARMS',91,9,.8);this.text(c,'BOMB',133,9,.8);
    this.text(c,currentWeapon(d)==='pistol'?'∞':String(d.ammo),93,19,1.15,'gold');
    this.text(c,String(d.grenades).padStart(2,'0'),135,19,1.15,'gold');
    // Elapsed mission time is real; displaying a fake countdown would promise
    // a time limit the game does not have. Continues restore this with the run.
    const time=String(Math.min(99,Math.floor(d.missionTicks/50))).padStart(2,'0');
    let tx=179;
    for(const digit of time){const f=this.glyph(digit,'gold',true);c.drawImage(f,tx,7,25,28);tx+=25;}
    this.text(c,'TIME',185,38,.7);
    if(width>425) {
      this.text(c,'HI-SCORE',width-12,7,.9,'gold','right');
      this.text(c,String(game.best).padStart(6,'0'),width-12,19,1,'silver','right');
    }
    const stage=d.boss?.form==='elevator'?'WARDEN':d.boss?'SPACECRAFT':d.miniboss&&!d.miniboss.dead?'R-SHOBU':['AFT DECK','CARGO BAY','CATWALKS'][d.section];
    this.text(c,stage,12,h/scale-10,.7);
    this.text(c,'CONTINUE ∞',width-10,h/scale-10,.7,'silver','right');
    if(d.miniboss?.state==='wreck'&&!d.boss&&Math.floor(d.time*3)%2)this.text(c,'GO',width-35,65,2,'gold');
    c.restore();
  }
}

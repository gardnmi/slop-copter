// Native-resolution arcade supply badges. Movement is visual only: the real
// pickup remains at its simulation position, well within its collection range.
const INK='#10202c';
const SUPPLIES={
  power:{name:'POWER',glyph:['11110','10001','10001','11110','10000','10000','10000'],face:'#ffd465',edge:'#b47827',light:'#fff5c3'},
  wingman:{name:'WINGMAN',glyph:['10001','10001','10001','10101','10101','11011','10001'],face:'#77c9ff',edge:'#3376af',light:'#e7faff'},
  repair:{name:'REPAIR',glyph:['00000','00100','00100','11111','00100','00100','00000'],face:'#83efb0',edge:'#2a926a',light:'#e6ffe9'},
};
function pixel(c,color,x,y,w=1,h=1){c.fillStyle=color;c.fillRect(x,y,w,h);}
function plate(c,r,cut,color){
  c.fillStyle=color;c.beginPath();
  c.moveTo(-r+cut,-r);c.lineTo(r-cut,-r);c.lineTo(r,-r+cut);c.lineTo(r,r-cut);
  c.lineTo(r-cut,r);c.lineTo(-r+cut,r);c.lineTo(-r,r-cut);c.lineTo(-r,-r+cut);c.closePath();c.fill();
}
function sparkle(c,x,y,color){
  pixel(c,INK,x-1,y-4,3,9);pixel(c,INK,x-4,y-1,9,3);
  pixel(c,color,x,y-3,1,7);pixel(c,color,x-3,y,7,1);pixel(c,'#ffffff',x,y);
}

export function drawAirPickup(c,item,reduced=false){
  const style=SUPPLIES[item.type]??SUPPLIES.power;
  const t=reduced?0:item.age,bob=reduced?0:Math.round(Math.sin(t*.085)*2);
  c.save();c.translate(Math.round(item.x),Math.round(item.y)+bob);
  c.scale(2/3,2/3);

  // A small expanding set of corner lights draws attention without resembling
  // hostile circular bullets or covering the flight path with a large glow.
  const pulse=reduced?0:(t%72)/72,r=20+Math.round(pulse*7);
  c.save();c.globalAlpha=reduced?.75:1-pulse*.8;
  for(const side of [-1,1]){
    const x=side<0?-r:r-5;
    pixel(c,INK,x-1,-r-1,7,4);pixel(c,style.face,x,-r,5,2);
    pixel(c,INK,side<0?-r-1:r-2,-r-1,4,7);pixel(c,style.light,side<0?-r:r-1,-r,2,5);
  }
  c.restore();

  c.save();c.translate(2,3);c.globalAlpha=.6;plate(c,19,7,INK);c.restore();
  plate(c,19,7,INK);plate(c,17,6,style.light);plate(c,15,5,style.edge);
  plate(c,13,4,style.face);
  pixel(c,style.light,-9,-13,18,2);pixel(c,style.light,-13,-9,2,15);
  pixel(c,style.edge,-9,11,18,2);pixel(c,INK,-6,15,12,1);

  // Shine crosses the case under the fixed glyph; the letter never spins away.
  if(!reduced){
    const sweep=t%90;
    if(sweep<26){
      c.save();plate(c,13,4,style.face);c.clip();c.globalAlpha=.45;
      for(let y=-13;y<=13;y++)pixel(c,'#ffffff',Math.round(sweep*2-28-y*.5),y,4,1);
      c.restore();
      pixel(c,style.light,-9,-13,18,2);pixel(c,style.edge,-9,11,18,2);
    }
  }
  for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(style.glyph[y][x]==='1'){
    pixel(c,style.light,x*2-4,y*2-5,2,2);
    pixel(c,INK,x*2-5,y*2-7,2,2);
  }
  pixel(c,INK,-15,-2,2,4);pixel(c,INK,13,-2,2,4);
  pixel(c,style.light,-15,-2,1,2);pixel(c,style.light,13,-2,1,2);

  if(!reduced){
    const spin=t*.045;
    for(let i=0;i<2;i++){
      const angle=spin+i*Math.PI,x=Math.round(Math.cos(angle)*23),y=Math.round(Math.sin(angle)*19);
      if(y<12)sparkle(c,x,y,style.light);
    }
  }
  const width=style.name.length*4+8;
  pixel(c,INK,-width/2,21,width,11);pixel(c,style.edge,-width/2,31,width,1);
  c.font='bold 7px "Courier New", monospace';c.textAlign='center';c.textBaseline='top';
  c.fillStyle=style.light;c.fillText(style.name,0,23);
  c.restore();
}

// Original ship scenery with credited Celeste edge tiles (assets/celeste/README.md).
// Silhouette edges carry detail; deep surfaces stay quiet behind the player.
const R=(c,k,x,y,w,h)=>{c.fillStyle=k;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const hash=(x,y,s=0)=>((Math.imul(x+91,374761393)^Math.imul(y+17,668265263)^Math.imul(s+3,1274126177))>>>0)%1024/1024;
function line(c,k,x,y,tx,ty){const n=Math.max(Math.abs(tx-x),Math.abs(ty-y));for(let i=0;i<=n;i++)R(c,k,x+(tx-x)*i/(n||1),y+(ty-y)*i/(n||1),1,1);}
function disc(c,k,x,y,r){for(let dy=-r;dy<=r;dy++){const w=Math.floor(Math.sqrt(r*r-dy*dy));R(c,k,x-w,y+dy,w*2+1,1);}}
function glow(c,x,y,r,color){c.save();for(let i=3;i>0;i--){c.globalAlpha=.045*(4-i);disc(c,color,x,y,Math.floor(r*i/3));}c.restore();}
function cable(c,x,y,tx,ty,sag,k='#344d5c'){let px=x,py=y;for(let i=1;i<=32;i++){const t=i/32,nx=x+(tx-x)*t,ny=y+(ty-y)*t+Math.sin(t*Math.PI)*sag;line(c,k,px,py,nx,ny);px=nx;py=ny;}}
function pipe(c,x,y,h){R(c,'#090f1c',x-1,y,7,h);R(c,'#263b49',x,y,4,h);R(c,'#435264',x,y,1,h);for(let yy=y+8;yy<y+h;yy+=24){R(c,'#4f5763',x-1,yy,6,2);R(c,'#172939',x-1,yy+2,6,2);}}
function lamp(c,x,y,warm=false){glow(c,x,y,20,warm?'#ffb56c':'#7eacf1');R(c,'#233b4a',x-3,y-6,7,2);R(c,'#829897',x-2,y-4,5,6);R(c,warm?'#f8ca8a':'#b0e7f4',x-1,y-3,3,4);R(c,'#324654',x-3,y+2,7,2);}
function crate(c,x,y,w,h){R(c,'#090f1c',x-1,y-1,w+2,h+2);R(c,'#243541',x,y,w,h);R(c,'#48535d',x,y,w,2);R(c,'#38454c',x,y,2,h);R(c,'#141e2a',x+w-2,y,2,h);for(let xx=x+6;xx<x+w;xx+=7)R(c,'#303f49',xx,y+3,2,h-5);line(c,'#4b5257',x+2,y+3,x+w-4,y+h-3);line(c,'#131f2b',x+3,y+3,x+w-3,y+h-3);}
function lattice(c,x,y,w,h){R(c,'#243a4a',x,y,w,2);R(c,'#182c3e',x,y+h-2,w,2);for(let xx=x;xx<x+w;xx+=8){line(c,'#304557',xx,y+2,xx+6,y+h-3);line(c,'#304557',xx,y+h-3,xx+6,y+2);}}
export class BelowScenery {
  constructor(){this.rooms=new Map();this.plates=new Map();this.textures={};}
  async load(){await Promise.all(['blue-rock','grey-bricks','ibeams'].map(async name=>{const im=new Image();im.src=`${import.meta.env.BASE_URL}assets/celeste/${name}.png`;await im.decode();this.textures[name]=im;}));}
  background(c,o,reduced){
    const id=o.roomIndex;
    if(!this.rooms.has(id)){const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;this.paintRoom(canvas.getContext('2d'),o.room,id);this.rooms.set(id,canvas);}
    c.drawImage(this.rooms.get(id),0,0);
    if(o.room.theme==='engine'){
      // Slow turbine silhouettes sit behind the walkable steel and never look solid.
      const a=reduced?0:o.time*.25;
      for(let i=0;i<6;i++){const q=a+i*Math.PI/3;line(c,'#324656',166+Math.cos(q)*13,87+Math.sin(q)*13,166+Math.cos(q+.3)*37,87+Math.sin(q+.3)*37);line(c,'#273c4c',166+Math.cos(q)*14,88+Math.sin(q)*14,166+Math.cos(q+.3)*36,88+Math.sin(q+.3)*36);}
      disc(c,'#344854',166,87,8);disc(c,'#162737',166,87,5);R(c,'#6f7d80',164,83,3,2);
    }
    // Condensation and distant flecks travel at different rates, not a grid.
    for(let i=0;i<29;i++){const x=(hash(i,3,id)*336+(reduced?0:o.time*(i%3?1.6:3)))%336-8,y=(hash(i,9,id)*180+(reduced?0:o.time*(i%4?2:8)))%180;R(c,i%5?'#35475e':'#99accb',x,y,1,1);}
    if(o.room.theme==='bilge'||o.room.theme==='open')for(let i=0;i<9;i++)R(c,i%3?'#284259':'#49677e',(i*43+(reduced?0:o.time*5))%320,174+i%3*2,4+i%5,1);
  }
  paintRoom(c,room,id){
    R(c,'#060d1c',0,0,320,180);
    if(room.theme==='open'){
      const bands=['#1c2747','#343555','#654560','#9c627c','#d28895','#efb3a5'];
      for(let i=0;i<6;i++)R(c,bands[i],0,i*23,320,24);
      R(c,'#263e58',0,130,320,50);R(c,'#758699',0,130,320,1);
      for(let i=0;i<18;i++){const x=hash(i,8)*320,y=hash(i,9)*110;R(c,'#b1a3b6',x,y,6+i%9,1);}
      // The carrier island and deck cranes recede into the sunset.
      for(let i=0;i<5;i++){const x=168+i*32,y=86+hash(i,8)*22;R(c,'#454b69',x,y,20,130-y);R(c,'#5c5b77',x+2,y-4,12,4);R(c,'#6b657e',x+7,y-25,2,24);}
      lattice(c,182,81,120,6);cable(c,185,79,286,81,13,'#82718a');return;
    }
    // Broad distant bulkheads, changing depth and height, with deep openings.
    for(let i=0;i<6;i++){
      const x=Math.floor(hash(i,11,id)*360)-20,y=Math.floor(hash(i,19,id)*40)+10,w=26+Math.floor(hash(i,27,id)*31);
      R(c,'#102132',x,y,w,180-y);R(c,'#172b3c',x,y,2,180-y);R(c,'#1e3142',x,y,w,2);
      for(let yy=y+12;yy<170;yy+=19){R(c,'#091724',x+5,yy,w-11,12);for(let j=0;j<3;j++)R(c,'#1b2a3b',x+7,yy+2+j*3,w-15,1);}
    }
    // Angled braces and staggered pipework establish depth behind the route.
    for(let i=0;i<3;i++){
      const x=-16+i*133+id*3;R(c,'#1b2c3c',x,8,7,172);R(c,'#34404e',x,8,1,172);
      line(c,'#233443',x+5,20,x+57,70);line(c,'#233443',x+7,20,x+59,70);
      pipe(c,x+24,42+(i%2)*40,115);lattice(c,x,104-i%2*39,95,8);
    }
    for(let i=0;i<7;i++){
      const x=25+i*53,y=18+(i%3)*7;R(c,'#30414e',x,y,3,5);cable(c,x,y+2,x+61,y+7,8+i%3*4);
    }
    if(room.theme==='bilge'){
      // Cold ocean light through a damaged hull window, with layered frames.
      const x=id===0?141:98,y=73;
      disc(c,'#253b4a',x,y,35);disc(c,'#3f5965',x-1,y-1,32);disc(c,'#132b40',x,y,29);
      disc(c,'#1e4056',x-2,y+2,26);
      for(let yy=y-21;yy<y+23;yy+=5){const w=Math.floor(Math.sqrt(Math.max(0,26*26-(yy-y)*(yy-y))));R(c,yy<y?'#29465e':'#31576b',x-w,yy,w*2,2);}
      R(c,'#1b2e41',x-2,y-29,4,58);R(c,'#1b2e41',x-29,y-1,58,3);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;R(c,'#74888d',x+Math.cos(a)*32,y+Math.sin(a)*32,1,1);}
      glow(c,x,y,47,'#497eac');pipe(c,227,0,99);lamp(c,237,62);
      crate(c,19,133,23,24);crate(c,250,130,25,32);
    }else if(room.theme==='cargo'){
      lattice(c,28,34,268,8);R(c,'#304b5d',235,32,14,11);R(c,'#677b84',238,32,8,2);
      cable(c,242,42,237,106,2,'#53626e');R(c,'#627582',233,105,7,2);R(c,'#536875',231,107,3,5);
      crate(c,47,103,44,44);crate(c,27,130,24,28);crate(c,232,123,33,35);crate(c,272,108,30,43);
      crate(c,100,139,39,24);lamp(c,184,46,true);
    }else if(room.theme==='engine'){
      for(const r of [47,44,41])disc(c,r===44?'#405464':r===47?'#101d2b':'#192d3f',166,87,r);
      for(let i=0;i<20;i++){const a=i*Math.PI/10;R(c,'#61737c',166+Math.cos(a)*43,87+Math.sin(a)*43,2,2);}
      for(const x of [45,247]){pipe(c,x,23,125);R(c,'#3f4b57',x-5,53,18,42);R(c,'#1d2e3e',x-3,56,14,36);for(let y=59;y<89;y+=5)R(c,'#655753',x-1,y,9,2);lamp(c,x+2,46,true);}
      R(c,'#34414d',117,135,106,3);for(let x=120;x<222;x+=7)R(c,'#47535b',x,133,2,7);
    }else{
      // Elevator service chimney, ladders and a far deck behind it.
      for(const x of [75,199]){R(c,'#304554',x,0,3,180);R(c,'#4f6470',x,0,1,180);for(let yy=0;yy<180;yy+=12)R(c,'#3a4e5d',x-2,yy,7,2);}
      for(let yy=29;yy<180;yy+=7){R(c,'#273e4d',114,yy,17,1);}R(c,'#355160',113,24,1,156);R(c,'#355160',131,24,1,156);
      lattice(c,22,143,290,8);lamp(c,183,80);lamp(c,40,26,true);
    }
    // Recessed vents, peeling paint, dangling wires and occasional warm indicators.
    for(let i=0;i<7;i++){
      const x=hash(i,39,id)*300,y=40+hash(i,53,id)*105;
      R(c,'#071320',x,y,14,20);R(c,'#304654',x,y,14,1);for(let j=0;j<5;j++)R(c,'#1d3143',x+2,y+3+j*3,10,1);
      if(i%3===0){R(c,'#759782',x+3,y+17,1,1);cable(c,x+7,y+20,x+12,y+37,3,'#31404f');}
    }
    for(let i=0;i<180;i++){const x=Math.floor(hash(i,1,id)*320),y=Math.floor(hash(i,2,id)*180);R(c,i%5?'#152a3b':'#2a3e50',x,y,1+i%3,1);}
  }
  platform(c,p,seed,ticks,reduced,room){
    if(p.gone)return;
    const key=`${seed}:${p.id}:${p.w}:${p.h}:${p.kind}`;
    if(!this.plates.has(key)){
      const canvas=document.createElement('canvas');canvas.width=p.w+8;canvas.height=p.h+16;
      this.paintPlate(canvas.getContext('2d'),p,seed,room);this.plates.set(key,canvas);
    }
    let x=Math.round(p.x),y=Math.round(p.y);if(p.crack&&!reduced)x+=ticks%4<2?1:-1;
    if(p.kind==='mover'){
      const xx=p.baseX+p.w/2,yy=p.baseY+p.h+3;
      line(c,'#344958',xx-(p.axis==='x'?p.range:0),yy-(p.axis==='y'?p.range:0),xx+(p.axis==='x'?p.range:0),yy+(p.axis==='y'?p.range:0));
      for(let i=-p.range;i<=p.range;i+=8)R(c,'#647987',xx+(p.axis==='x'?i:0)-1,yy+(p.axis==='y'?i:0)-1,2,2);
    }
    c.drawImage(this.plates.get(key),x-4,y-3);
    if(p.kind==='crumble'&&p.crack){line(c,p.crack>20?'#f7caa1':'#161a29',x+8,y,x+11,y+3);line(c,'#c28b7c',x+11,y+3,x+6,y+7);}
  }
  paintPlate(c,p,seed,room){
    const x=4,y=3,w=p.w,h=p.h,copper=p.kind==='crumble',moving=p.kind==='mover';
    const base=copper?'#372735':'#0c202c',edge=copper?'#98654e':'#496173',light=copper?'#d69c68':'#829baa';
    const has=(xx,yy)=>room.solids.some(q=>q!==p&&q.kind!=='mover'&&xx>=q.x&&xx<q.x+q.w&&yy>=q.y&&yy<q.y+q.h);
    R(c,'#060d1b',x-1,y,w+2,h+2);R(c,base,x,y,w,h);
    if(!copper&&!moving&&this.textures['blue-rock']){
      // The reference atlas is a 4x nearest-neighbour export of 8px tiles.
      // Use adjacent solids as one silhouette; never outline internal seams.
      const frost=seed===0?p.id%3!==1:seed===1||seed===3||seed===5||p.y===0;
      const im=this.textures[h<=12?'ibeams':frost?'blue-rock':'grey-bricks'];
      const occupied=(xx,yy)=>(xx>=p.x&&xx<p.x+w&&yy>=p.y&&yy<p.y+h)||has(xx,yy);
      c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.imageSmoothingEnabled=false;
      for(let yy=0;yy<h;yy+=8)for(let xx=0;xx<w;xx+=8){
        const n=!occupied(p.x+xx+4,p.y+yy-1),s=!occupied(p.x+xx+4,p.y+Math.min(yy+8,h));
        const l=!occupied(p.x+xx-1,p.y+yy+4),r=!occupied(p.x+Math.min(xx+8,w),p.y+yy+4);
        let tx=l?0:r?4:1+Math.floor(hash(p.baseX+xx,p.baseY+yy,seed)*3);
        let ty=n?0:s?4:1+Math.floor(hash(p.baseX+xx+7,p.baseY+yy+3,seed)*3);
        // Keep large masses dark. The right half of the sheet contains inward
        // corners (including snow); it is not a set of random infill tiles.
        if(!n&&!s&&!l&&!r&&hash(xx+7,yy,seed)<.68){R(c,'#080f13',x+xx,y+yy,8,8);continue;}
        if(im===this.textures.ibeams){tx=Math.min(tx,4);ty=n?0:4;}
        c.drawImage(im,tx*32,ty*32,32,32,x+xx,y+yy,8,8);
      }
      c.restore();return;
    }
    // Sparse interior panels replace the repeated whole-block checkerboard.
    for(let yy=4;yy<h-2;yy+=8)for(let xx=2;xx<w-2;xx+=8){
      const n=hash(p.baseX+xx,p.baseY+yy,seed);
      if(n>.68){R(c,copper?'#67423e':'#1d3441',x+xx,y+yy,Math.min(6,w-xx),Math.min(3,h-yy));R(c,copper?'#96654c':'#2a4755',x+xx,y+yy,Math.min(3,w-xx),1);}
      if(n<.15&&yy+5<h)R(c,'#050f1d',x+xx,y+yy,Math.min(4,w-xx),4);
    }
    for(let xx=0;xx<w;xx+=8){
      const top=!has(p.x+xx+3,p.y-1),bottom=!has(p.x+xx+3,p.y+h);
      if(top){
        R(c,edge,x+xx,y,Math.min(8,w-xx),5);R(c,light,x+xx,y,Math.min(7,w-xx),1);
        for(let j=0;j<3;j++){const nx=xx+Math.floor(hash(xx,j,seed)*6),ny=2+j%2;R(c,j%2?base:light,x+nx,y+ny,2,1);}
      }
      if(bottom){R(c,edge,x+xx,y+h-2,Math.min(8,w-xx),2);R(c,'#132938',x+xx+1,y+h-1,Math.min(5,w-xx-1),1);}
    }
    for(let yy=0;yy<h;yy+=8){
      for(const side of [-1,1]){
        const exposed=!has(side<0?p.x-1:p.x+w,p.y+yy+3);if(!exposed)continue;
        const px=side<0?x:x+w-5;
        R(c,edge,px,y+yy,5,Math.min(8,h-yy));R(c,light,px+(side<0?0:4),y+yy,1,Math.min(7,h-yy));
        R(c,base,px+1,y+yy+2,2,3);R(c,'#304859',px+2,y+yy+6,2,1);
      }
    }
    // Escaping coolant leaves irregular pale caps and cobalt chips along ledges.
    // The bright top remains at exactly the collision height.
    if(!copper&&!moving)for(let xx=0;xx<w;xx++){
      if(has(p.x+xx,p.y-1))continue;
      const n=hash(Math.floor((p.baseX+xx)/3),p.baseY,seed),length=2+Math.floor(n*7);
      R(c,'#568aff',x+xx,y,1,Math.min(h,length));R(c,'#b6d3fd',x+xx,y,1,2);
      if(n>.4)R(c,'#effbff',x+xx,y,1,1);
      if(n>.68&&length<h){R(c,'#3853b0',x+xx,y+length,1,1);if(xx%3===0)R(c,'#afcaff',x+xx,y+length-1,1,1);}
    }
    if(moving){
      R(c,'#4f6671',x,y,w,h);R(c,'#c4e9eb',x,y,w,1);R(c,'#213641',x+3,y+3,w-6,h-5);
      for(let xx=4;xx<w-3;xx+=8){line(c,'#536c7c',x+xx,y+3,x+xx+5,y+h-3);line(c,'#536c7c',x+xx,y+h-3,x+xx+5,y+3);}
      R(c,'#94eebf',x+w/2-2,y+3,4,2);R(c,'#080f1c',x,y+h-1,w,1);
    }
    if(copper)for(let xx=1;xx<w;xx+=7){R(c,'#f0c387',x+xx,y,3,1);R(c,'#312533',x+xx+2,y+1,2,2);}
    // Moss and exposed wires hang from edges, not from the air.
    if(h>=16)for(let xx=6;xx<w-6;xx+=13){
      const n=hash(xx,p.baseY,seed);if(n<.52||p.y+h>=176)continue;
      const len=3+Math.floor(n*9);for(let j=0;j<len;j++){const dx=Math.round(Math.sin(j*.7)*2);R(c,'#355757',x+xx+dx,y+h+j,1,1);if(j%3===0)R(c,'#657f6c',x+xx+dx-1,y+h+j,2,1);}
    }
  }
}

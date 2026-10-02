import {pixel,pixelLine,WELL_RED as RED,WELL_WHITE as WHITE,WELL_INK as BLACK} from './orbit-pixels.js';

// Native three-ink art. Authored, overlapping bundles build a solid haystack.
export const HAY_WIDTH=140,HAY_HEIGHT=154,HAY_EYE_Y=23;
const OUTLINE=[[2,126],[5,116],[2,106],[7,98],[5,89],[11,80],[10,71],
  [18,64],[17,55],[25,49],[26,40],[35,35],[38,25],[47,21],[49,13],
  [59,12],[64,6],[71,10],[78,5],[87,14],[97,16],[103,26],[112,32],
  [111,43],[121,50],[124,63],[131,69],[129,80],[135,90],[133,103],
  [139,115],[137,130],[140,138],[129,146],[115,150],[90,153],
  [58,151],[37,154],[20,149],[8,143],[11,137]];
// Back to front: x, y, width, length, lean, shadow. Sizes are intentionally uneven.
const SHEAVES=[
  [18,99,31,49,-3,1],[46,106,35,47,-5,0],[79,103,34,49,3,1],[115,95,33,54,6,1],
  [17,73,27,49,-3,0],[43,74,34,54,5,0],[73,77,30,55,-4,1],[101,71,32,56,4,0],[125,77,23,48,5,1],
  [22,51,27,47,-8,0],[47,48,34,53,-4,0],[79,48,36,61,6,0],[107,47,30,52,9,1],
  [38,31,26,41,-7,0],[62,28,29,43,-5,0],[87,30,30,44,9,1],[103,33,22,34,7,0],
  [53,17,25,34,-4,0],[76,14,29,39,3,0],[90,22,24,30,5,1],
  [61,11,18,22,-3,0],[80,11,18,22,3,0],
];
const materials=new Map(),sprites=new Map();
const hash=n=>{let v=Math.imul(n+37,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return((v^(v>>>16))>>>0)/4294967296;};

function polygon(c,points,ink){
  c.fillStyle=ink;
  for(let y=Math.floor(Math.min(...points.map(p=>p[1])));y<Math.ceil(Math.max(...points.map(p=>p[1])));y++){
    const cuts=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],yy=y+.5;
      if(a[1]<=yy&&b[1]>yy||b[1]<=yy&&a[1]>yy)cuts.push(a[0]+(yy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    cuts.sort((a,b)=>a-b);
    for(let i=0;i<cuts.length;i+=2)c.fillRect(Math.ceil(cuts[i]),y,Math.ceil(cuts[i+1])-Math.ceil(cuts[i]),1);
  }
}
function sheaf(c,[x,y,w,h,lean,shade],seed){
  const local=points=>points.map(([px,py])=>[x+px,y+py]);
  polygon(c,local([[-w*.22,-2],[w*.18,-3],[w*.4,6],[w*.48+lean*.35,h*.35],
    [w*.49+lean,h*.81],[w*.29+lean,h*.73],[w*.26+lean,h],
    [w*.06+lean,h*.85],[-w*.06+lean,h*.97],[-w*.23+lean,h*.77],
    [-w*.39+lean,h*.85],[-w*.47+lean*.5,h*.38],[-w*.4,6]]),BLACK);
  polygon(c,local([[-w*.17,0],[w*.13,-1],[w*.33,7],[w*.38+lean*.4,h*.4],
    [w*.35+lean,h*.79],[w*.17+lean,h*.75],[w*.16+lean,h*.91],
    [-w*.04+lean,h*.82],[-w*.2+lean,h*.82],[-w*.36+lean*.5,h*.38],[-w*.3,8]]),WHITE);
  // Folded dark faces, long fibres and broken cross-grain give the hay volume.
  polygon(c,local([[w*.13,3],[w*.34,9],[w*.38+lean*.4,h*.4],
    [w*.35+lean,h*.8],[w*.14+lean,h*.74],[w*.02+lean*.5,h*.32]]),shade?RED:BLACK);
  const strands=Math.floor(w/4.5);
  for(let i=0;i<strands;i++){
    const u=(i+.5)/strands-.5,sx=x+u*w*.54,sy=y+3+Math.floor(hash(seed*31+i)*5);
    const ex=x+u*w*.84+lean,ey=y+h*(.71+hash(seed*71+i)*.22),mx=sx+(ex-sx)*.43,my=y+h*.39;
    pixelLine(c,sx,sy,mx,my,BLACK);pixelLine(c,mx,my,ex,ey,BLACK);
    if(i%2===0){pixelLine(c,mx-1,my+2,ex-1,ey-3,WHITE);pixelLine(c,ex-1,ey-3,ex+u*3,ey+3,WHITE);}
    const yy=y+h*(.25+(i%3)*.13),xx=sx+(ex-sx)*(yy-sy)/(ey-sy);
    pixel(c,xx-2,yy,3,1,WHITE);pixel(c,xx+1,yy+2,2,1,BLACK);
  }
  for(let yy=8;yy<h*.74;yy+=2){
    const xx=x+w*.12+lean*(yy/h);
    for(let px=xx;px<xx+3+(shade?2:0);px+=2)pixel(c,px+(yy%4?1:0),y+yy,1,1,WHITE);
  }
  pixelLine(c,x-w*.18,y+2,x-w*.27+lean*.2,y+h*.25,WHITE,2);
}

export function hayMaterial(wounded){
  if(materials.has(wounded))return materials.get(wounded);
  const image=document.createElement('canvas');image.width=HAY_WIDTH;image.height=HAY_HEIGHT;
  const c=image.getContext('2d');polygon(c,OUTLINE,BLACK);c.globalCompositeOperation='source-atop';
  polygon(c,[[18,86],[39,61],[105,66],[126,94],[137,133],[118,150],[23,150],[6,125]],RED);
  SHEAVES.forEach((bundle,i)=>sheaf(c,bundle,i+1));
  // One worn, sagging tie; the second phase actually snaps its centre apart.
  for(let x=11;x<134;x++){
    if(wounded&&x>48&&x<93)continue;
    const y=111+Math.floor(Math.sin((x-10)/123*Math.PI)*7);
    pixel(c,x,y-1,1,5,BLACK);pixel(c,x,y,1,2,(x+Math.floor(x/4))%4<2?WHITE:RED);
    if(x%4===0)pixel(c,x,y-2,1,2,WHITE);
  }
  if(wounded){
    for(const [x,y,side]of [[40,38,-1],[95,47,1],[51,89,-1],[90,122,1]]){
      polygon(c,[[x-6,y],[x+3,y+3],[x+8,y+11],[x+3,y+22],[x-3,y+27],[x-7,y+14]],BLACK);
      polygon(c,[[x-3,y+3],[x+2,y+7],[x+4,y+13],[x,y+24],[x-3,y+18]],RED);
      for(let j=0;j<5;j++){
        const yy=y+j*4;pixelLine(c,x-side*4,yy,x-side*(9+j%2*3),yy-4,WHITE,2);pixel(c,x+1,yy+3,2,2,RED);
      }
    }
    polygon(c,[[62,104],[76,109],[84,129],[78,150],[63,148],[58,130]],BLACK);
    pixelLine(c,68,112,74,145,RED,3);pixelLine(c,66,115,70,144,WHITE);
  }
  c.globalCompositeOperation='source-over';
  for(let i=0;i<OUTLINE.length;i++){
    const a=OUTLINE[i],b=OUTLINE[(i+1)%OUTLINE.length];pixelLine(c,...a,...b,i%4===1?RED:WHITE);
    if(i%3===0){const side=a[0]<70?-1:1;pixelLine(c,a[0],a[1]+3,a[0]-side*3,a[1]+9,WHITE);}
  }
  materials.set(wounded,image);return image;
}

function eyes(c,open,wounded,gaze){
  polygon(c,[[52,18],[56,12],[65,15],[71,20],[78,14],[86,13],[90,21],
    [86,31],[75,34],[69,30],[61,34],[53,28]],BLACK);
  if(open){
    polygon(c,[[58,22],[59,20],[63,20],[69,23],[68,27],[65,29],[59,28],[58,26]],WHITE);
    polygon(c,[[72,23],[77,20],[80,19],[82,22],[82,26],[80,29],[74,28]],WHITE);
    for(const [i,x]of [63,77].entries()){
      pixel(c,x-1+gaze,HAY_EYE_Y-2,3,6,RED);pixel(c,x+gaze,HAY_EYE_Y-1,1,4,BLACK);
      pixel(c,x-1+gaze,HAY_EYE_Y-2,1,1,WHITE);
      pixelLine(c,x-4,HAY_EYE_Y+6,x+3,HAY_EYE_Y+6,wounded?RED:BLACK);
      if(wounded){pixelLine(c,x+i-2,HAY_EYE_Y+7,x+i-4,HAY_EYE_Y+17,RED,2);pixel(c,x+i-4,HAY_EYE_Y+17,3,2,RED);}
    }
  }else{
    pixelLine(c,57,25,68,27,RED);pixelLine(c,73,27,85,24,RED);
    for(let i=0;i<7;i++){
      const x=54+i*5,side=x<70?-1:1;pixelLine(c,x,19,x+side*3,31-i%3,WHITE,2);pixelLine(c,x+2,20,x+side*3+2,28-i%3,BLACK);
    }
  }
  // Uneven heavy straw brows part to show the two clear white weak points.
  polygon(c,[[50,15],[56,10],[63,14],[70,20],[69,23],[61,19],[55,18]],WHITE);
  polygon(c,[[72,22],[74,17],[84,11],[90,14],[85,18],[77,20]],WHITE);
  pixelLine(c,54,14,65,19,BLACK);pixelLine(c,75,20,86,14,BLACK);
  pixelLine(c,55,11,63,15,WHITE);pixelLine(c,79,15,86,12,WHITE);
}

export function eaterSprite(open,wounded=false,gaze=0,rustle=0){
  gaze=Math.max(-2,Math.min(2,Math.round(gaze)));rustle=Math.abs(Math.floor(rustle))%4;
  const key=`${open}:${wounded}:${gaze}:${rustle}`;if(sprites.has(key))return sprites.get(key);
  const image=document.createElement('canvas');image.width=HAY_WIDTH;image.height=HAY_HEIGHT;
  const c=image.getContext('2d');c.drawImage(hayMaterial(wounded),0,0);
  for(const [i,[x,y,side]]of [[0,[35,55,-1]],[1,[107,59,1]],[2,[81,88,1]]]){
    const bend=[0,1,0,-1][(rustle+i)%4];
    for(let j=0;j<4;j++){
      const tx=x+side*(5+j)+bend,ty=y+12+j*2;
      pixelLine(c,x+j*side,y+j*2,tx,ty,BLACK,2);pixelLine(c,x+j*side,y+j*2,tx-1,ty-1,WHITE);
    }
  }
  eyes(c,open,wounded,gaze);sprites.set(key,image);return image;
}

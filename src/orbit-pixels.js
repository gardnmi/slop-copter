// Native low-resolution chapter art. Every edge shares one pixel grid and one
// three-color palette; no shaded sprite-sheet fragments or antialiased paths.
export const WELL_INK='#000000',WELL_WHITE='#ffffff',WELL_RED='#ff0000';
export function pixel(c,x,y,w,h,color=WELL_WHITE){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
export function pixelLine(c,x,y,tx,ty,color=WELL_WHITE,size=1){
  const n=Math.max(Math.abs(tx-x),Math.abs(ty-y));
  for(let i=0;i<=n;i++)pixel(c,x+(tx-x)*i/(n||1),y+(ty-y)*i/(n||1),size,size,color);
}
export function pixelDisc(c,x,y,r,color=WELL_WHITE){
  for(let row=-r;row<=r;row++){const span=Math.floor(Math.sqrt(r*r-row*row));pixel(c,x-span,y+row,span*2+1,1,color);}
}
export function drawWellTile(c,p,neighbors={}){
  const {x,y,w,h}=p;
  pixel(c,x,y,w,h,WELL_INK);
  if(p.breakable){
    pixel(c,x+2,y,w-4,2);pixel(c,x,y+2,2,h-4);pixel(c,x+w-2,y+2,2,h-4);pixel(c,x+2,y+h-2,w-4,2);
    // Broad diagonal brace with broken grain, not a thin generic square icon.
    for(let n=4;n<Math.min(w,h)-4;n+=2){pixel(c,x+n,y+n,4,2);if(n%6===0)pixel(c,x+n+4,y+n-2,2,2);}
    pixel(c,x+4,y+4,4,2);pixel(c,x+w-8,y+h-6,4,2);
    pixel(c,x+4,y+h-10,2,4);pixel(c,x+6,y+h-12,2,2);
    pixel(c,x+w-8,y+6,4,2);
  }else if(p.solid){
    // Slanted white facets with black seams make a continuous rock mass.
    // Pattern coordinates are world-based so tile joins don't form a grid.
    for(let yy=2;yy<h;yy+=8)for(let xx=0;xx<w;xx+=12){
      const row=Math.floor((y+yy)/8),col=Math.floor((x+xx)/12),n=((row*17+col*13)&31);
      const dx=(row%2)*4;
      const px=x+xx+dx,py=y+yy;
      const width=Math.min(8+(n%3)*2,x+w-px-2);
      if(width>0){pixel(c,px,py,width,2);pixel(c,px-2< x?x:px-2,py+2,Math.max(2,width-2),2);if(n%3===0&&py+6<y+h)pixel(c,px+2,py+4,2,2);}
    }
    if(!neighbors.above){pixel(c,x,y,w,2);pixel(c,x+2,y+2,w-4,2,WELL_INK);}
    if(!neighbors.below)pixel(c,x,y+h-2,w,2);
    if(!neighbors.left)pixel(c,x,y,2,h);
    if(!neighbors.right)pixel(c,x+w-2,y,2,h);
    if(!neighbors.above&&!neighbors.left)pixel(c,x,y,2,2,WELL_INK);
    if(!neighbors.above&&!neighbors.right)pixel(c,x+w-2,y,2,2,WELL_INK);
  }else{
    pixel(c,x,y,w,2);for(let i=2;i<w-4;i+=8){pixel(c,x+i,y+2,6,2);pixel(c,x+i-2,y+4,4,2);}
  }
}
export function drawWellBurst(c,r){
  const t=r.age,end=1-t/18;if(end<=0)return;
  if(t<3){
    const radius=8+t*4;
    pixel(c,r.x-radius,r.y-3,radius*2,6);pixel(c,r.x-3,r.y-radius,6,radius*2);
    pixelDisc(c,r.x,r.y,radius-2,WELL_WHITE);return;
  }
  // Expanding, overlapping smoke lobes; white core, stippled late breakup.
  for(let i=0;i<6;i++){
    const a=i*2.4,travel=7+t*.9,radius=Math.max(2,Math.round((12+i%3*3)*end));
    const x=Math.round((r.x+Math.cos(a)*travel)/2)*2,y=Math.round((r.y+Math.sin(a)*travel)/2)*2;
    pixelDisc(c,x,y,radius+2,WELL_INK);pixelDisc(c,x,y,radius,t>12?WELL_RED:WELL_WHITE);
    if(t>7)for(let yy=-radius+2;yy<radius;yy+=4)for(let xx=-radius+2;xx<radius;xx+=4){
      if(xx*xx+yy*yy<radius*radius&&(xx+yy+t)%3===0)pixel(c,x+xx,y+yy,2,2,WELL_INK);
    }
  }
}
const letters={
 A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[15,16,16,16,16,16,15],D:[30,17,17,17,17,17,30],
 E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[15,16,16,23,17,17,15],H:[17,17,17,31,17,17,17],
 I:[31,4,4,4,4,4,31],J:[7,2,2,2,2,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],
 M:[17,27,21,21,17,17,17],N:[17,25,25,21,19,19,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],
 Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],
 U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,27,17],X:[17,17,10,4,10,17,17],
 Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
 0:[14,17,19,21,25,17,14],1:[4,12,4,4,4,4,14],2:[14,17,1,2,4,8,31],3:[30,1,1,14,1,1,30],
 4:[2,6,10,18,31,2,2],5:[31,16,16,30,1,1,30],6:[14,16,16,30,17,17,14],7:[31,1,2,4,8,8,8],
 8:[14,17,17,14,17,17,14],9:[14,17,17,15,1,1,14],
 '/':[1,1,2,4,8,16,16],'+':[0,4,4,31,4,4,0],'-':[0,0,0,31,0,0,0],':':[0,4,4,0,4,4,0],
 '!':[4,4,4,4,4,0,4],'◆':[4,14,31,31,31,14,4],'♥':[0,10,31,31,14,4,0],'.':[0,0,0,0,0,4,4]
};
const boldDigits={
 0:[62,99,103,107,115,99,62],1:[12,28,60,12,12,12,63],2:[62,99,3,14,56,96,127],
 3:[126,3,3,30,3,99,62],4:[6,14,30,54,102,127,6],5:[127,96,96,126,3,99,62],
 6:[30,48,96,126,99,99,62],7:[127,3,6,12,24,24,24],8:[62,99,99,62,99,99,62],9:[62,99,99,63,3,6,60],
 '/':[3,6,12,24,48,96,64]
};
export function wellText(c,value,x,y,size=8,color=WELL_WHITE,align='left'){
  const large=size>=12,s=large?2:1,chars=[...String(value).toUpperCase()];
  const advance=ch=>ch===' '?4:large&&boldDigits[ch]?8:6;
  const width=(chars.reduce((n,ch)=>n+advance(ch),0)-1)*s;
  x=Math.round(x-(align==='center'?width/2:align==='right'?width:0));y=Math.round(y-7*s);
  let cursor=0;
  chars.forEach(ch=>{
    const wide=large&&boldDigits[ch],rows=wide||letters[ch]||[],bits=wide?7:5;
    rows.forEach((row,dy)=>{for(let dx=0;dx<bits;dx++)if(row&(1<<(bits-1-dx)))
      pixel(c,x+(cursor+dx+(large&&dy<3?1:0))*s,y+dy*s,large&&!wide?s+1:s,s,color);
    });
    cursor+=advance(ch);
  });
}

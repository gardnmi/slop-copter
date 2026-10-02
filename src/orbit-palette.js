// A chapter-specific indexed palette. Keep the existing Rambo animation and
// red bandana, but render it at the same graphic density as the well.
export function orbitPalette(canvas,accent=false) {
  const c=canvas.getContext('2d'),image=c.getImageData(0,0,canvas.width,canvas.height),d=image.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<100){d[i+3]=0;continue;}
    const r=d[i],g=d[i+1],b=d[i+2],l=r*.3+g*.59+b*.11;
    // Three inks with ordered dithering preserve the launch silhouette without
    // carrying the preceding chapter's shaded palette into this one.
    const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);
    const threshold=[[24,146],[206,86]][y%2][x%2];
    const color=accent&&r>g*1.7&&r>b*1.6&&r>95?[255,0,0]:l>threshold?[255,255,255]:[0,0,0];
    d[i]=color[0];d[i+1]=color[1];d[i+2]=color[2];d[i+3]=255;
  }
  c.putImageData(image,0,0);return canvas;
}

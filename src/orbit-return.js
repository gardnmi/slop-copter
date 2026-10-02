const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};

const EXTRA_HEIGHT=960;
const CAMERA_EASE=160;

// Use the classic simulation for both speeds: eight pixels in open sky, two
// inside the cloud, including its original sideways wobble.
function orbitView(width,height){
  const ratio=width/height;
  return {width:Math.max(320,Math.round(560*ratio)),height:Math.max(560,Math.round(320/ratio))};
}
function forecastFall(scene){
  if(scene.state!=='falling')return {ticks:0,x:scene.cartX+24};
  // Run an isolated copy of the actual physics. Cloud silhouette, movement and
  // random wobble all affect the arrival; don't consume the live random stream.
  const probe=scene.reset();
  for(const key of ['frame','level','cloudIndex','cloudX','cloudY','cloudEnabled'])probe[key]=scene[key];
  probe.random.setState(scene.random.getState());
  probe.jumper={...scene.jumper};probe.state='falling';
  let ticks=0;
  while(probe.state==='falling'&&ticks<3000){probe.tick();ticks++;}
  return {ticks,x:probe.jumper.x};
}
export function returnFallTicks(scene){return forecastFall(scene).ticks;}
function placeCloud(scene){
  const approach=Math.max(0,Math.ceil((scene.cloudY-scene.jumper.y)/(scene.gravity*2)));
  scene.cloudX=scene.jumper.x-138+Math.floor((scene.frame+approach)/3)*2-Math.floor(scene.frame/3)*2;
}
function lineUpHay(scene){
  const arrival=forecastFall(scene);
  scene.cartX=arrival.x-24-arrival.ticks*scene.wagonStep*2;
}
export function beginReturnScene(o,game){
  const scene=game.reset(),view=orbitView(scene.width,scene.height),s=view.width/scene.width;
  const x=((view.width-320)/2+o.returnStart.x)/s-14;
  const screenFeet=o.returnStart.screenY/s;
  const y=Math.min(screenFeet-32,scene.deck-48)-EXTRA_HEIGHT;
  scene.jumper={x:clamp(x,0,scene.width-28),y,inCloud:false,burning:false};
  scene.state='falling';scene.drops=1;
  scene.copterX=scene.width*.25;
  scene.dropHeight=Math.max(0,Math.trunc((scene.deck-scene.jumper.y+38)/2));
  scene.cloudIndex=2;scene.cloudY=Math.round(scene.deck*.3);
  placeCloud(scene);scene.carriage.beginDrop(scene);lineUpHay(scene);
  o.returnStart.anchorY=Math.min(screenFeet+CAMERA_EASE/2,scene.deck-100);
  o.returnStart.fadeTicks=50;
  o.returnStart.morphTicks=60;
  o.returnScene=scene;
}
export function resizeReturnScene(o,width,height){
  const scene=o.returnScene;if(o.phase!=='return'||!scene)return;
  const oldDeck=scene.deck,cloudOffset=scene.jumper?scene.jumper.x-scene.cloudX:0;
  scene.resize(width,height);
  o.returnStart.anchorY=Math.min(o.returnStart.anchorY*scene.deck/oldDeck,scene.deck-100);
  if(scene.state==='falling'){
    if(scene.jumper.y<scene.cloudY)placeCloud(scene);
    else scene.cloudX=scene.jumper.x-cloudOffset;
    lineUpHay(scene);
  }
}
export function stepReturnScene(o,game){
  const scene=o.returnScene;
  scene.tick();
  if(scene.state==='result'&&scene.effectTick===0){
    o.sound('pickup');game.message='Back in the hay. Here we go again.';
  }
  if(scene.state==='ready'){
    o.phase='looped';game.completeLoop(scene);
  }
}

// Resizing changes coordinates only. Rendering never creates or advances a
// second world; this exact scene becomes the playable game after the hay pose.
export function returnCamera(o){
  const scene=o.returnScene;
  if(scene.state!=='falling')return 0;
  const distance=Math.max(0,o.returnStart.anchorY-scene.jumper.y-32);
  if(distance===0)return 0;
  // Follow the high fall, then ease the camera to the normal ground view well
  // before landing. The man's world speed never changes for the camera move.
  return distance<CAMERA_EASE?-distance*distance/(2*CAMERA_EASE):-distance+CAMERA_EASE/2;
}
export function returnPose(o,w,h){
  const scene=o.returnScene,s=w/scene.width,j=scene.jumper;
  const cameraY=returnCamera(o);
  return {s,cameraY,x:(j?j.x+14:scene.cartX+28)*s,y:((j?j.y+32:scene.deck+18)-cameraY)*s,
    landed:scene.state!=='falling',white:smooth(o.age/o.returnStart.fadeTicks),
    world:smooth(o.age/o.returnStart.fadeTicks),morph:smooth(o.age/o.returnStart.morphTicks)};
}

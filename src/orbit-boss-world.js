// Authored, mirrored cave fragments. Their offsets, silhouettes and enemy roles
// vary together; the boss can actually tear these tiles out of the collision map.
const ROOMS=[
  {name:'broken-stair',gap:224,rocks:[[0,0,3],[0,1,2],[8,3,2]],crumble:[[2,0]],enemies:['drone','crawler']},
  {name:'cracked-crossing',gap:288,rocks:[[0,0,2],[8,3,2]],crates:[[2,0],[3,0],[7,3]],enemies:['seeker']},
  {name:'islands',gap:192,rocks:[[0,0,1],[2,1,2],[8,4,2]],crumble:[[2,1],[3,1]],enemies:['drone','spike']},
  {name:'overhang',gap:256,rocks:[[7,0,3],[8,1,2],[0,4,2]],enemies:['crawler','hopper']},
  {name:'loose-balcony',gap:288,rocks:[[0,0,4],[8,4,2]],crumble:[[1,0],[2,0],[3,0]],enemies:['hopper','seeker']},
  {name:'opposing-jaws',gap:224,rocks:[[0,0,3],[0,1,1],[7,2,3],[9,3,1]],crates:[[3,0]],enemies:['crawler','drone']},
];
export const EATER_ROOMS=ROOMS.map(r=>r.name);

function addChunk(o){
  const b=o.eater,index=b.chunks++,room=ROOMS[(index+(o.seed>>>0)%ROOMS.length)%ROOMS.length];
  const flip=(index+Math.floor((o.seed>>>0)/ROOMS.length))%2===1,base=b.nextTerrain;
  const group=`eater-${index}`,tiles=[];
  const add=(col,row,breakable=false)=>{
    const x=(flip?9-col:col)*32,y=base+row*32;
    const p={x,y,w:32,h:32,solid:true,eater:true,group,breakable,hp:breakable?1:Infinity,
      fragile:room.crumble?.some(([cx,cy])=>cx===col&&cy===row)||false,grain:(index*7+col)%29};
    tiles.push(p);o.platforms.push(p);
  };
  for(const [col,row,n]of room.rocks)for(let i=0;i<n;i++)add(col+i,row);
  for(const [col,row]of room.crates||[])add(col,row,true);
  b.rooms.push({name:room.name,y:base,flip});b.rooms=b.rooms.slice(-6);
  b.nextTerrain+=room.gap;
  return {room,tiles};
}

export function seedEaterWorld(o){
  const b=o.eater;b.chunks=0;b.nextTerrain=b.y-60;b.rooms=[];b.debris=[];
  addChunk(o);b.spawn=0;spawnEaterWave(o,true);
}

export function spawnEaterWave(o,opening=false){
  const b=o.eater,types=opening?['drone','crawler']:ROOMS[(b.spawn+(o.seed>>>0))%ROOMS.length].enemies;
  let slots=5-o.enemies.filter(e=>!e.dead).length;
  for(let i=0;i<types.length&&slots>0;i++){
    const type=types[i];if(type==='spike'&&b.stage===1)continue;
    let x=opening?(i?280:136):type==='crawler'?(b.spawn%2?30:290):[112,204,76,244][(b.spawn+i)%4];
    let y=Math.max(o.y+72,b.y-130-i*48);
    if(type==='hopper'){
      const lip=o.platforms.find(p=>!p.dead&&!p.breakable&&p.y>o.y+65&&p.y<b.y-104);
      if(!lip)continue;x=lip.x+16;y=lip.y-10;
    }else{
      // Never materialize in a solid shelf or against the player's body.
      let tries=0;
      while(o.platforms.some(p=>!p.dead&&p.solid&&x+18>p.x&&x-18<p.x+p.w&&y+16>p.y&&y-16<p.y+p.h)&&tries++<5)y-=32;
      if(y<o.y+52)continue;
    }
    o.enemies.push({type,x,y,originX:x,originY:y,phase:b.spawn*.9+i*2.1,age:0,
      hp:type==='spike'?2:1,vx:0,vy:0,dead:false,mode:type==='hopper'?'rest':'idle',eater:true});slots--;
  }
  b.spawn++;
}

function shatter(o,p){
  if(p.dead)return;p.dead=true;
  o.sound('rock-break',p.x+16);
  for(let i=0;i<4;i++)o.eater.debris.push({x:p.x+4+i*7,y:p.y+3+(i%2)*9,
    vx:(i-1.5)*28,vy:-45-i*13,age:0,red:i%3===0});
  o.ring(p.x+16,p.y+8,'#ffffff','spark');
}

export function touchEaterRock(o,p){
  if(p.fragile&&!p.cracking)p.cracking=55; // 1.1 seconds to reload and jump.
}

export function tearEaterWall(o){
  const b=o.eater;
  for(const p of o.platforms)if(!p.dead&&eaterBitesRock(b,p))shatter(o,p);
}

export function eaterBitesRock(b,p){
  return p.y>b.y-200&&p.y<b.y+20&&(b.side<0?p.x<112:p.x+p.w>208);
}

export function stepEaterWorld(o){
  const b=o.eater;
  o.platforms=o.platforms.filter(p=>!p.dead&&p.y+p.h>o.cameraY-80);
  while(b.nextTerrain<b.y+120){addChunk(o);spawnEaterWave(o);}
  for(const p of o.platforms){
    // The rising maw consumes scenery behind the player; shelves never linger
    // through its body. Ahead of it, only marked loose rocks crumble on contact.
    if(p.y>b.y-50&&p.y<b.y-18&&!p.cracking)p.cracking=40;
    if(p.cracking&&--p.cracking===0)shatter(o,p);
  }
  for(const d of b.debris){d.x+=d.vx*.02;d.y+=d.vy*.02;d.vy+=18;d.age++;}
  b.debris=b.debris.filter(d=>d.age<55&&d.y<o.cameraY+640).slice(-80);
  // A prolonged hover still brings a different enemy role, not another pair
  // of identical blobs. Stompable targets remain available with an empty gun.
  if(b.age%170===0)spawnEaterWave(o);
}

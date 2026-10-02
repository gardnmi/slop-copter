import {stepOrbitTrail} from './orbit-feedback.js';
import { orbitMuzzle } from './orbit-pose.js';
import { BAND_DEPTH, WELL_END, buildOrbitWell } from './orbit-layout.js';
import { beginWellEntry, tickWellEntry } from './orbit-entry.js';
import {beginReturnScene,stepReturnScene,resizeReturnScene} from './orbit-return.js';
import { stepOrbitEnemy } from './orbit-enemies.js';
import {beginEater,stepEaterCinema,stepEaterArena,eaterTarget,hitEater,collideEater,eaterAtEnd} from './orbit-boss.js';
import {touchEaterRock} from './orbit-boss-world.js';
// GBA reference uses 2px movement, .2 gravity, 4 terminal, 4.6 jump and
// 3.4 stomp per 60Hz frame. Sprites here are 2× native size; convert to world
// units/second, then integrate at this game's 50Hz simulation rate.
export const ORBIT_GRAVITY=1440, ORBIT_TERMINAL=480, ORBIT_SPEED=240;
export const ORBIT_JUMP=552, ORBIT_CAMERA=185;
const DT=.02,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function gemObstructed(platforms,x,y,tx,ty){
  return platforms.some(p=>{
    if(p.dead||!p.solid)return false;
    let near=0,far=1;
    for(const [start,delta,min,max]of [[x,tx-x,p.x,p.x+p.w],[y,ty-y,p.y,p.y+p.h]]){
      if(Math.abs(delta)<.001){if(start<=min||start>=max)return false;}
      else{const a=(min-start)/delta,b=(max-start)/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
      if(near>=far)return false;
    }
    return true;
  });
}
export class OrbitDrop {
  constructor(seed=1) {
    this.seed=seed;this.phase='dormant';this.age=0;this.time=0;this.x=160;this.y=164;this.vx=this.vy=0;
    this.grounded=false;this.facing=1;this.health=4;this.charge=8;this.ammo=8;this.shotClock=this.flash=0;
    this.hurt=this.burning=this.shake=0;this.cameraY=0;this.band=0;this.combo=this.bestCombo=this.gems=0;
    this.eater=null;this.weapon='single';this.trail=[];this.shots=[];this.particles=[];this.floaters=[];this.cue={id:0,name:''};
    this.audioEvents=[];this.audioSerial=0;this.audioGeneration=0;this.clearInput();
  }
  get active(){return this.phase!=='dormant';}
  get playing(){return this.phase==='falling'||this.phase==='eater-fight';}
  get canAct(){return this.playing||this.phase==='eater-death'&&this.age<200;}
  get dead(){return this.phase==='dead';}
  get cinematic(){return ['breach','return','eater-intro','eater-break'].includes(this.phase)||this.phase==='eater-death'&&this.age>=200;}
  get label(){return this.phase==='return'?'FULL CIRCLE':this.eater?'SLOP EATER':this.playing||this.dead?['01 / THE SHAFT','02 / THE DEPTHS','03 / THE CORE'][this.band]:'THE FLOOR GIVES WAY';}
  sound(name,x=this.x){
    this.cue={id:this.cue.id+1,name};
    // Replace rather than mutate: look-ahead simulations may share this history.
    this.audioEvents=[...this.audioEvents,{id:++this.audioSerial,kind:name,x,time:this.time}].slice(-64);
  }
  clearInput(){this.held=false;this.pressed=false;this.jumpLatch=false;}
  begin(game) {
    this.startFall(game); beginWellEntry(this, game);
  }
  startFall(game,band=0) {
    this.audioGeneration++;this.audioEvents=[];
    this.eater=null;this.weapon='single';this.returnScene=null;this.entry=null;
    Object.assign(this,buildOrbitWell(this.seed));this.phase='falling';this.age=0;
    this.band=band;this.x=160;this.y=band*BAND_DEPTH+164;this.vx=0;this.vy=band?0:ORBIT_TERMINAL;this.grounded=!!band;
    this.health=4;this.charge=8;this.ammo=8;this.hurt=45;this.burning=0;this.combo=0;this.knock=0;
    this.trail=[];this.shots=[];this.particles=[];this.floaters=[];this.rings=[];this.hitStop=0;
    this.shotClock=this.flash=0;this.gemPulse=0;this.gemMeter=0;this.gemHigh=0;this.comboAge=0;this.volley=0;this.cameraY=Math.max(0,this.y-ORBIT_CAMERA);
    this.checkpoint={band,score:game.score,gems:this.gems,bestCombo:this.bestCombo,charge:this.charge};
    this.clearInput();game.releaseControls();this.sound('reload');
    game.message='LEFT / RIGHT move. J / SPACE jumps on a ledge or fires your gun in the air. Land or stomp to reload.';
  }
  beginReturn(game,{award=true}={}){
    if(this.phase==='return')return;
    this.phase='return';this.age=0;this.returnStart={x:this.x,screenY:this.y-this.cameraY};
    this.burning=this.hurt=this.flash=this.shake=0;this.shots=[];this.trail=[];
    this.vy=ORBIT_TERMINAL;this.grounded=false;if(award)this.award(game,2000);game.releaseControls();
    beginReturnScene(this,game);
    this.sound('escaped');game.message='The clouds are clearing. This place looks familiar…';
  }
  resizeReturn(width,height){resizeReturnScene(this,width,height);}
  retry(game) {
    if(!this.dead||this.age<30)return false;
    const cp=this.checkpoint;this.gems=cp.gems;this.bestCombo=cp.bestCombo;game.score=cp.score;
    this.startFall(game,cp.band);this.charge=this.ammo=cp.charge;this.checkpoint={...cp};
    if(cp.kind==='eater'){
      this.y=WELL_END+40;this.cameraY=this.y-ORBIT_CAMERA;
      beginEater(this,game,{intro:false,checkpoint:false});
    }
    return true;
  }
  pressAction() {
    if(!this.canAct||this.held)return false;
    if(!this.grounded&&!this.ammo)this.sound('empty');
    this.held=true;this.pressed=true;return true;
  }
  releaseAction() {
    this.held=false;this.pressed=false;
    if(this.jumpLatch&&this.vy<-150)this.vy=-150;
    this.jumpLatch=false;
  }
  award(game,points){game.score+=points;game.best=Math.max(game.best,game.score);}
  burst(x,y,color='#ffffff',count=10) {
    for(let i=0;i<count;i++)this.particles.push({x,y,vx:Math.cos(i*2.4+this.time)*60,vy:Math.sin(i*2.4+this.time)*75,age:0,color});
    if(this.particles.length>160)this.particles.splice(0,this.particles.length-160);
  }
  note(text,color='#ffffff'){this.floaters.push({x:this.x,y:this.y-30,text,color,age:0});}
  ring(x,y,color='#ffffff',kind='impact'){this.rings.push({x,y,color,kind,age:0});}
  collectGem(game,value=1){
    const bonus=this.gemHigh>0?2:1;
    this.gems+=value*bonus;this.award(game,value*bonus*5);this.gemPulse=5;this.sound('gem');
    if(this.gemHigh>0)this.gemHigh=150;
    else if((this.gemMeter+=value)>=60){this.gemMeter=60;this.gemHigh=150;this.sound('pickup');this.note('GEM HIGH','#ff0000');this.ring(this.x,this.y);}
  }
  bankCombo(game){
    const chain=this.combo;
    if(chain>=8){this.gems+=100;this.award(game,500);this.sound('combo');}
    if(chain>=15)this.charge=Math.min(this.weapon==='machine'?60:16,this.charge+1);
    if(chain>=25)this.health=Math.min(4,this.health+1);
    if(chain>=8)this.floaters.push({kind:'combo',x:this.x,y:this.y-124,age:0,life:80,
      lines:[`${chain} COMBO!`,'COMBO','REWARD!','+100 ◆',...(chain>=15?['+1 AMMO']:[]),...(chain>=25?['+1 ♥']:[])]});
    this.combo=0;this.comboAge=0;
  }
  reload(game,platform) {
    if(this.ammo<this.charge){this.sound('reload');this.ring(this.x,this.y,'#ffffff','reload');}
    if(this.combo)this.bankCombo(game);
    this.ammo=this.charge;this.burning=0;
    this.combo=0;
    if(platform?.checkpoint>this.band) {
      this.band=platform.checkpoint;this.health=Math.min(4,this.health+1);this.ammo=this.charge;
      this.checkpoint={band:this.band,score:game.score,gems:this.gems,bestCombo:this.bestCombo,charge:this.charge};
      this.note('CHECKPOINT / RELOADED');game.message=`${this.label}. Continue is saved here. Stomp white enemies; shoot red spiked enemies.`;
    }
  }
  kill(game,e,stomp=false) {
    if(e.dead)return;e.dead=true;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);
    this.award(game,25+this.combo*5);this.burst(e.x,e.y);this.shake=stomp?2:1;
    this.sound(stomp?'stomp':'hit',e.x);this.comboAge=85;this.ring(e.x,e.y);this.hitStop=stomp?3:2;
    for(let i=0;i<4;i++)this.gemsItems.push({x:e.x+(i-1.5)*6,y:e.y-5,value:3,vx:(i-1.5)*38,vy:-100-i%2*45,life:0,dead:false});
    if(stomp){this.vy=-408;this.ammo=this.charge;this.grounded=false;this.jumpLatch=this.held;}
  }
  hurtPlayer(game,fire=false,direction=0) {
    if(this.hurt||!this.playing)return false;
    this.health--;this.hurt=65;this.combo=0;this.burning=fire?58:0;this.shake=4;
    this.vy=-145;this.vx=(direction||Math.sign(160-this.x)||1)*120;this.knock=8;this.grounded=false;
    this.sound(this.health?'player-hit':'dead');this.burst(this.x,this.y-12,'#ff0000',16);
    if(!this.health){this.phase='dead';this.age=0;this.clearInput();game.releaseControls();game.message='Restarting this descent checkpoint…';}
    return true;
  }
  fire() {
    if(!this.ammo||this.shotClock)return;
    const machine=this.weapon==='machine';
    this.ammo--;this.shotClock=machine?(this.gemHigh?2:3):this.gemHigh?4:6;
    this.flash=machine?2:3;this.vy=-24;this.sound(machine?'machine':'gun');this.shake=machine?.4:.7;this.volley++;
    const muzzle=orbitMuzzle(this);
    this.shots.push({x:muzzle.x,y:muzzle.y,oldY:muzzle.y,age:0,volley:this.volley,machine,power:this.gemHigh?2:1,width:this.gemHigh?6:4});
  }
  stepBossAftermath(game){
    this.shotClock=Math.max(0,this.shotClock-1);
    const input=Math.sign(game.controlX);this.vx=input*ORBIT_SPEED;if(input)this.facing=input;
    if(this.held)this.fire();this.pressed=false;
    this.x=clamp(this.x+this.vx*DT,7,313);
    this.vy=Math.min(ORBIT_TERMINAL,this.vy+ORBIT_GRAVITY*DT);this.y+=this.vy*DT;
    this.cameraY=Math.max(this.cameraY,this.y-ORBIT_CAMERA);
    for(const s of this.shots){s.oldY=s.y;s.y+=1050*DT;s.age++;}
    this.shots=this.shots.filter(s=>s.age<55);
  }
  tick(game) {
    stepOrbitTrail(this);
    this.age++;this.time+=DT;this.shake*=.75;this.flash=Math.max(0,this.flash-1);
    this.gemPulse=Math.max(0,(this.gemPulse||0)-1);
    for(const r of this.rings||[])r.age++;this.rings=(this.rings||[]).filter(r=>r.age<18);
    for(const p of this.particles){p.x+=p.vx*DT;p.y+=p.vy*DT;p.vy+=110*DT;p.age++;}
    this.particles=this.particles.filter(p=>p.age<25);
    for(const f of this.floaters)f.age++;this.floaters=this.floaters.filter(f=>f.age<(f.life||45));
    if(['eater-intro','eater-break','eater-death'].includes(this.phase)){stepEaterCinema(this,game);return;}
    if(this.phase==='return'){
      this.y+=this.vy*DT;this.cameraY+=this.vy*DT;
      stepReturnScene(this,game);
      return;
    }
    if(this.phase==='breach'){tickWellEntry(this,game);return;}
    if(!this.playing)return;
    if(this.hitStop>0){this.hitStop--;return;}
    if(this.phase==='eater-fight')stepEaterArena(this,game);
    this.comboAge=Math.max(0,this.comboAge-1);
    if(this.gemHigh>0&&--this.gemHigh===0)this.gemMeter=0;
    this.hurt=Math.max(0,this.hurt-1);this.burning=Math.max(0,this.burning-1);this.shotClock=Math.max(0,this.shotClock-1);
    const oldY=this.y,oldX=this.x,wasGrounded=this.grounded,input=Math.sign(game.controlX);
    if(this.knock>0)this.knock--;else this.vx=input*ORBIT_SPEED;
    if(input)this.facing=input;
    if(this.pressed&&this.grounded){this.vy=-ORBIT_JUMP;this.grounded=false;this.jumpLatch=true;this.sound('jump');}
    else if(this.held&&!this.grounded&&!this.jumpLatch)this.fire();
    this.pressed=false;
    this.x=clamp(this.x+this.vx*DT,7,313);
    for(const p of this.platforms)if(p.solid&&!p.dead&&oldY>p.y+.1&&oldY-23<p.y+p.h-.1){
      if(this.vx>0&&oldX+5<=p.x+.1&&this.x+5>p.x)this.x=Math.min(this.x,p.x-5);
      if(this.vx<0&&oldX-5>=p.x+p.w-.1&&this.x-5<p.x+p.w)this.x=Math.max(this.x,p.x+p.w+5);
    }
    this.vy=Math.min(ORBIT_TERMINAL,this.vy+ORBIT_GRAVITY*DT);this.y+=this.vy*DT;this.grounded=false;
    if(this.vy<0)for(const p of this.platforms)if(p.solid&&!p.dead&&this.x+5>p.x&&this.x-5<p.x+p.w&&oldY-23>=p.y+p.h-.1&&this.y-23<p.y+p.h){
      this.y=Math.max(this.y,p.y+p.h+23);this.vy=0;
    }
    for(const p of this.platforms)if(!p.dead&&this.vy>=0&&this.x+5>p.x&&this.x-5<p.x+p.w&&oldY<=p.y+1&&this.y>=p.y) {
      this.y=p.y;this.vy=0;this.grounded=true;
      if(!wasGrounded)this.sound('land');
      this.reload(game,p);touchEaterRock(this,p);break;
    }
    if(!this.playing)return;
    const reached=clamp(Math.floor((this.y-164)/BAND_DEPTH),0,2);
    if(reached>this.band){
      this.band=reached;this.checkpoint={band:this.band,score:game.score,gems:this.gems,bestCombo:this.bestCombo,charge:this.charge};
      this.note('CHECKPOINT');game.message=`${this.label}. Descent checkpoint saved. Land on rock to reload.`;
    }
    for(const e of this.enemies)if(!e.dead&&Math.abs(e.y-this.y)<440){
      e.oldY=e.y;stepOrbitEnemy(this,e);
    }
    for(const s of this.shots) {
      s.oldY=s.y;s.y+=1050*DT;s.age++;
      let target=null,terrain=false,boss=false,first=Infinity;
      for(const p of this.platforms)if(!p.dead&&s.x>=p.x&&s.x<=p.x+p.w&&s.oldY<=p.y&&s.y>=p.y&&p.y<first){target=p;terrain=true;first=p.y;}
      for(const e of this.enemies)if(!e.dead&&Math.abs(e.x-s.x)<11+(s.width||2)&&s.y>=e.y-10&&s.oldY<=e.y+10&&e.y-10<first){target=e;terrain=false;first=e.y-10;}
      const head=eaterTarget(this,s);
      if(head!==null&&head<first){target=this.eater;boss=true;first=head;}
      if(!target)continue;
      s.dead=true;
      if(boss)hitEater(this,game,s);
      else if(terrain){
        this.ring(s.x,first,'#ffffff','spark');
        if(target.breakable&&--target.hp<=0){target.dead=true;this.sound('rock-break',s.x);this.burst(s.x,target.y,'#ffffff');this.gemsItems.push({x:target.x+target.w/2,y:target.y+8,value:2,dead:false});}
        else this.sound('rock-hit',s.x);
      }else{
        target.hit=3;if((target.hp-=s.power||1)<=0)this.kill(game,target);else{this.sound('enemy-hit',s.x);this.burst(s.x,target.y,'#ffffff',5);}
      }
    }
    this.shots=this.shots.filter(s=>!s.dead&&s.age<55);
    // Resolve bullets before body contact; a shot that reaches a target this
    // frame must protect the player. Stomps use relative swept feet positions.
    for(const e of this.enemies)if(!e.dead&&Math.abs(e.x-this.x)<17&&this.y>e.y-10&&this.y-23<e.y+10){
      if(e.type!=='spike'&&this.vy>0&&oldY<=(e.oldY??e.y)-5){this.y=e.y-10;this.kill(game,e,true);}
      else this.hurtPlayer(game,false,Math.sign(this.x-e.x));
    }
    if(!this.playing)return;
    if(this.phase==='eater-fight'){collideEater(this,game);if(!this.playing)return;}
    for(const gem of this.gemsItems)if(!gem.dead){
      if(gem.vx!==undefined){
        gem.life++;gem.x=clamp(gem.x+gem.vx*DT,8,312);gem.y+=gem.vy*DT;
        gem.vx*=.91;gem.vy=Math.min(80,gem.vy+280*DT);
      }
      const dx=this.x-gem.x,dy=this.y-12-gem.y,dist=Math.hypot(dx,dy);
      // A cache cannot be magnetized through its intact shell, even if the gem
      // sits in an empty pocket. Opening a panel makes the route worthwhile.
      if(dist<(this.gemHigh?76:43)&&!gemObstructed(this.platforms,gem.x,gem.y,this.x,this.y-12)){
        gem.x+=dx*.24;gem.y+=dy*.24;
        if(dist<18){gem.dead=true;this.collectGem(game,gem.value||1);}
      }
    }
    // Let the body move through jumps and recoil, then catch up smoothly at
    // roughly one third of the view. Keep upward bounces visible without yo-yoing.
    const target=Math.max(0,this.y-ORBIT_CAMERA+clamp(this.vy*.04,-12,22));
    if(target>this.cameraY)this.cameraY+=(target-this.cameraY)*.22;
    else if(this.y-this.cameraY<110)this.cameraY=Math.max(0,this.cameraY-(110-this.y+this.cameraY)*.22);
    eaterAtEnd(this,game);
  }
}

import { BELOW_ROOMS, makeBelowRoom, steamState } from './below-layout.js';

// Celeste's published controller is the tuning reference (see docs/below-deck.md).
// This controller uses our fixed clock and swept, pixel-sized collision steps.
export const BELOW_PHYSICS = Object.freeze({ run:90, acceleration:1000, gravity:900,
  fall:160, jump:105, dash:240, dashTime:.15, grace:.1, jumpHold:.2, stamina:110 });
const DT=.02, HALF=4, HEIGHT=12;
const approach=(v,to,step)=>v<to?Math.min(to,v+step):Math.max(to,v-step);
const clamp=(n,l,h)=>Math.max(l,Math.min(h,n));
export function belowOverlap(x,y,p,inset=0) {
  return x+HALF-inset>p.x && x-HALF+inset<p.x+p.w && y-inset>p.y && y-HEIGHT+inset<p.y+p.h;
}
export class BelowDeck {
  constructor() {
    this.phase='dormant';this.age=this.time=this.roomTicks=0;this.roomIndex=0;
    this.x=this.y=this.vx=this.vy=0;this.facing=-1;this.dashes=1;this.stamina=110;
    this.deaths=0;this.tokens=[];this.trail=[];this.particles=[];this.cue={id:0,name:''};this.refillFlash=0;this.landSquash=0;this.stepDistance=0;
    this.clearInput();
  }
  get active(){return this.phase!=='dormant';}
  get playing(){return this.phase==='playing';}
  get dead(){return this.phase==='dead';}
  get cinematic(){return ['collapse','transition','boarding'].includes(this.phase);}
  get label(){return this.phase==='complete'?'HELICOPTER REACHED':`BELOW DECK / ${this.room?.name||'FLOOR FAILURE'}`;}
  sound(name){this.cue={id:this.cue.id+1,name};}
  clearInput(){this.jumpHeld=this.grabHeld=false;this.jumpBuffer=this.dashBuffer=0;}
  begin(game,{intro=true,room=0}={}) {
    this.deaths=0;this.tokens=[];this.enterRoom(game,room);
    if(intro){this.phase='collapse';this.age=0;this.sound('collapse');game.message='The lift floor is giving way. Get back to the helicopter!';}
  }
  enterRoom(game,index,{transition=false}={}) {
    this.roomIndex=index;this.room=makeBelowRoom(index);this.roomTicks=0;
    [this.x,this.y]=this.room.spawn;this.vx=this.vy=0;this.grounded=true;this.facing=-1;
    this.ribbon=Array.from({length:6},(_,i)=>({x:this.x+4+i*2,y:this.y-13}));
    this.dashes=1;this.stamina=110;this.coyote=.1;this.jumpTime=this.dashTime=this.dashFreeze=this.dashCooldown=0;
    this.forceTime=0;this.climbing=false;this.wall=0;this.age=0;this.phase=transition?'transition':'playing';
    this.refillFlash=this.landSquash=this.inputHint=0;this.wallSlideTime=1.2;this.stepDistance=0;
    this.trail=[];this.particles=[];this.clearInput();this.checkpointScore=game.score;
    game.releaseControls();game.message=`${this.room.name}. ${this.room.hint}`;
    this.sound('checkpoint');
  }
  pressJump(){if(!this.playing||this.jumpHeld)return false;this.jumpHeld=true;this.jumpBuffer=.12;if(!this.grounded&&!this.wall&&this.coyote<=0&&this.refillFlash>0)this.inputHint=80;return true;}
  releaseJump(){this.jumpHeld=false;this.jumpTime=0;}
  pressDash(){if(this.playing)this.dashBuffer=.16;}
  setGrab(held){this.grabHeld=this.playing&&!!held;}
  solid(x=this.x,y=this.y){return this.room.solids.find(p=>!p.gone&&belowOverlap(x,y,p));}
  wallAt(dir){return !!this.solid(this.x+dir*2,this.y);}
  burst(x,y,color,count=10) {
    for(let i=0;i<count;i++)this.particles.push({x,y,vx:Math.cos(i*2.4+this.time)*55,vy:Math.sin(i*2.4+this.time)*45,life:28,age:0,color});
    if(this.particles.length>100)this.particles.splice(0,this.particles.length-100);
  }
  die(game) {
    if(!this.playing)return;
    this.phase='dead';this.age=0;this.deaths++;this.burst(this.x,this.y-6,'#fa7392',18);this.sound('dead');
    this.clearInput();game.message='Back to this room. Keep going.';
  }
  retry(game){if(!this.dead)return false;game.score=this.checkpointScore;this.enterRoom(game,this.roomIndex);return true;}
  move(axis,amount) {
    while(Math.abs(amount)>.00001) {
      const step=Math.sign(amount)*Math.min(1,Math.abs(amount));
      const nx=this.x+(axis==='x'?step:0),ny=this.y+(axis==='y'?step:0);
      const hit=this.solid(nx,ny);
      if(hit) {
        // Tiny corrections turn a grazed corner into the jump/dash intended.
        if(axis==='y'&&step<0) {
          for(let n=1;n<=4;n++)for(const side of [Math.sign(this.vx)||this.facing,-(Math.sign(this.vx)||this.facing)]) {
            if(!this.solid(this.x+side*n,ny)&&!this.solid(this.x+side*n,this.y)) {this.x+=side*n;this.y=ny;return this.move(axis,amount-step);}
          }
        } else if(axis==='x'&&this.dashTime>0) {
          for(let n=1;n<=4;n++)if(!this.solid(nx,this.y-n)&&!this.solid(this.x,this.y-n)) {this.y-=n;this.x=nx;return this.move(axis,amount-step);}
        }
        if(axis==='x')this.vx=0;
        else {if(step>0&&this.vy>65){this.landSquash=6;this.burst(this.x,hit.y,'#b6cfe0',4);}this.vy=0;if(step>0){this.y=hit.y;this.grounded=true;}else this.jumpTime=0;}
        return;
      }
      this.x=nx;this.y=ny;amount-=step;
    }
  }
  tickPlatforms(game) {
    for(const p of this.room.solids) {
      const rider=!p.gone&&Math.abs(this.y-p.y)<.2&&this.x+HALF>p.x&&this.x-HALF<p.x+p.w;
      p.dx=p.dy=0;
      if(p.kind==='mover') {
        const before=p[p.axis];p[p.axis]=(p.axis==='x'?p.baseX:p.baseY)+Math.sin(this.roomTicks/p.period*Math.PI*2)*p.range;
        p[p.axis==='x'?'dx':'dy']=p[p.axis]-before;
        if(rider){this.x+=p.dx;this.y+=p.dy;}
        else if(belowOverlap(this.x,this.y,p)) {
          if(p.axis==='x')this.x=p.dx>0?p.x+p.w+HALF:p.x-HALF;
          else if(p.dy<0){this.y=p.y;this.grounded=true;this.vy=0;}
          else this.y=p.y+p.h+HEIGHT;
          if(this.room.solids.some(other=>other!==p&&!other.gone&&belowOverlap(this.x,this.y,other)))this.die(game);
        }
      }
      if(p.kind==='crumble') {
        if(rider&&!p.crack)p.crack=1;
        if(p.crack&&++p.crack===30){p.gone=true;this.burst(p.x+p.w/2,p.y,'#8f9cc4',8);}
        if(p.crack>160&&!belowOverlap(this.x,this.y,p)){p.crack=0;p.gone=false;}
      }
    }
  }
  tick(game) {
    this.age++;this.time+=DT;
    this.refillFlash=Math.max(0,this.refillFlash-1);this.landSquash=Math.max(0,this.landSquash-1);this.inputHint=Math.max(0,this.inputHint-1);
    for(const p of this.particles){p.age++;p.x+=p.vx*DT;p.y+=p.vy*DT;p.vy+=80*DT;}
    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const t of this.trail)t.age++;this.trail=this.trail.filter(t=>t.age<14);
    if(this.phase==='collapse'){if(this.age>=140)this.enterRoom(game,0);return;}
    if(this.phase==='transition'){if(this.age>=16){this.phase='playing';this.age=0;}return;}
    if(this.dead){if(this.age>=28)this.retry(game);return;}
    if(this.phase==='boarding'){
      this.x=approach(this.x,52,1);if(this.age>=70){this.phase='complete';this.age=0;game.message='Back at the helicopter. Below Deck complete.';this.sound('escaped');}return;
    }
    if(!this.playing)return;
    if(this.dashFreeze>0){this.dashFreeze=Math.max(0,this.dashFreeze-DT);return;}
    this.roomTicks++;this.tickPlatforms(game);if(!this.playing)return;
    for(const refill of this.room.refills)refill.cooldown=Math.max(0,refill.cooldown-1);
    this.dashCooldown=Math.max(0,this.dashCooldown-DT);
    const mx=Math.sign(game.controlX),my=Math.sign(game.controlY);
    const support=this.solid(this.x,this.y+1);
    this.grounded=!!support;
    this.wall=this.wallAt(-1)?-1:this.wallAt(1)?1:0;
    if(this.grounded){this.coyote=.1;this.stamina=110;this.wallSlideTime=1.2;if(!this.dashCooldown)this.dashes=1;}
    else this.coyote=Math.max(0,this.coyote-DT);
    if(this.dashBuffer>0&&this.dashes&&this.dashCooldown===0) {
      const dx=mx||(!my?this.facing:0),dy=my,length=Math.hypot(dx,dy);
      this.dashDir=[dx/length,dy/length];this.vx=this.dashDir[0]*240;this.vy=this.dashDir[1]*240;
      this.dashes=0;this.dashTime=.15;this.dashFreeze=.04;this.dashCooldown=.2;
      this.dashBuffer=this.jumpTime=0;this.climbing=false;this.grounded=false;
      this.sound('dash');this.burst(this.x,this.y-6,'#89e8f0',7);
      return;
    }
    this.dashBuffer=Math.max(0,this.dashBuffer-DT);
    if(this.dashTime>0) {
      if(this.age%2===0){this.trail.push({x:this.x,y:this.y,facing:this.facing,age:0,dx:this.dashDir[0],dy:this.dashDir[1]});if(this.trail.length>3)this.trail.shift();}
      this.dashTime-=DT;
      if(this.dashDir[0])this.facing=Math.sign(this.dashDir[0]);
      this.move('x',this.vx*DT);this.move('y',this.vy*DT);
      if(this.dashTime<=0){this.vx=this.dashDir[0]*160;this.vy=this.dashDir[1]*160*(this.dashDir[1]<0?.75:1);}
    } else {
      this.climbing=!!(this.wall&&this.grabHeld&&this.stamina>0&&!this.grounded);
      if(mx&&!this.climbing)this.facing=mx;
      if(this.jumpBuffer>0&&(this.coyote>0||this.wall)) {
        const wallJump=this.wall&&this.coyote===0;
        this.vy=-105;this.jumpTime=.2;this.jumpBuffer=this.coyote=0;this.grounded=false;
        if(wallJump){this.vx=-this.wall*130;this.forceTime=.12;this.facing=-this.wall;this.climbing=false;}
        else {this.vx+=mx*40+(support?.dx||0)/DT;this.vy+=Math.min(0,(support?.dy||0)/DT);}
        this.sound('jump');this.burst(this.x,this.y,'#c4d8ea',5);
      }
      this.forceTime=Math.max(0,this.forceTime-DT);
      if(this.climbing) {
        this.facing=this.wall;this.vx=0;this.vy=my*45;this.stamina=Math.max(0,this.stamina-DT*(my<0?45:my===0?10:0));
        if(my<0&&!this.solid(this.x+this.wall*2,this.y-5)) {this.vy=-90;this.vx=this.wall*65;this.forceTime=.1;this.climbing=false;}
      } else {
        if(!this.forceTime)this.vx=approach(this.vx,mx*90,(Math.abs(this.vx)>90&&Math.sign(this.vx)===mx?400:1000)*(this.grounded?1:.65)*DT);
        const peak=Math.abs(this.vy)<40&&this.jumpHeld;
        this.vy=approach(this.vy,my>0?240:160,900*(peak?.5:1)*DT);
        if(this.wall&&mx===this.wall&&this.vy>0){this.wallSlideTime=Math.max(0,this.wallSlideTime-DT);const max=20+(160-20)*(1-this.wallSlideTime/1.2);this.vy=Math.min(this.vy,max);}
        if(this.jumpTime>0&&this.jumpHeld)this.vy=Math.min(this.vy,-105);
      }
      this.jumpTime=Math.max(0,this.jumpTime-DT);this.jumpBuffer=Math.max(0,this.jumpBuffer-DT);
      this.grounded=false;this.move('x',this.vx*DT);this.move('y',this.vy*DT);
    }
    this.x=clamp(this.x,4,316);
    let head={x:this.x-this.facing*4,y:this.y-13};
    for(let i=0;i<this.ribbon.length;i++){
      const p=this.ribbon[i],tx=head.x-this.facing*(i?2:0),ty=head.y+(this.grounded?.8:Math.sign(this.vy)*-.4);
      p.x+=(tx-p.x)*.48;p.y+=(ty-p.y)*.48;
      const dx=p.x-head.x,dy=p.y-head.y,d=Math.hypot(dx,dy);
      if(d>3){p.x=head.x+dx/d*3;p.y=head.y+dy/d*3;}head=p;
    }
    if(this.grounded)this.stepDistance+=Math.abs(this.vx)*DT;
    for(const h of this.room.hazards) {
      if(h.kind==='steam'&&steamState(h,this.roomTicks)!=='active')continue;
      if(belowOverlap(this.x,this.y,h,1)){this.die(game);return;}
    }
    if(this.y>194){this.die(game);return;}
    if(this.y<12){this.y=12;this.vy=Math.max(0,this.vy);}
    for(const r of this.room.refills)if(!r.cooldown&&Math.hypot(this.x-r.x,this.y-6-r.y)<11&&(this.dashes===0||this.stamina<100)) {
      // A real pickup must be usable on the next press, even when reached early
      // in the previous dash. Keeping that dash's lockout ate the second input.
      this.dashes=1;this.stamina=110;this.dashCooldown=0;this.dashFreeze=.04;
      this.refillFlash=45;r.cooldown=125;this.sound('refill');this.burst(r.x,r.y,'#caff91',12);
      game.message='Dash restored. Aim with the arrows and press J again; Up + J dashes upward.';
    }
    if(this.room.token&&!this.tokens.includes(this.roomIndex)&&Math.hypot(this.x-this.room.token[0],this.y-6-this.room.token[1])<10) {
      this.tokens.push(this.roomIndex);game.score+=250;this.checkpointScore=game.score;game.best=Math.max(game.best,game.score);this.sound('refill');
    }
    const [ex,ey,ew,eh]=this.room.exit;
    if(this.x>=ex&&this.x<=ex+ew&&this.y>ey&&this.y-HEIGHT<ey+eh) {
      if(this.roomIndex===BELOW_ROOMS.length-1){this.phase='boarding';this.age=0;this.vx=this.vy=0;game.releaseControls();this.sound('escaped');}
      else this.enterRoom(game,this.roomIndex+1,{transition:true});
    }
  }
}

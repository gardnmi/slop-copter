"""Omarchy-only retaliation, projectiles, damage and crash state machine."""
from dataclasses import dataclass
import math

GET_UP_TICKS = 42
FIRST_SHOT_TICKS = 78
SHOT_INTERVAL = 96
BULLET_SPEED = 8
HIT_GRACE_TICKS = 45
CRASH_TICKS = 90
EXPLOSION_TICKS = 66


@dataclass
class Shooter:
    x: float
    age: int = 0
    cooldown: int = 0
    flash: int = 0
    aim_x: float = 0
    aim_y: float = -1


@dataclass
class Bullet:
    x: float
    y: float
    vx: float
    vy: float
    age: int = 0


@dataclass
class Smoke:
    x: float
    y: float
    age: int = 0
    drift: float = 0


def crosses_rect(x0,y0,x1,y1,rect):
    """Swept bullet collision: a fast shot cannot skip a narrow target."""
    left,top,w,h=rect
    enter,leave=0.,1.
    for origin,delta,low,high in ((x0,x1-x0,left,left+w),(y0,y1-y0,top,top+h)):
        if abs(delta)<1e-9:
            if not low<=origin<=high:return False
        else:
            a,b=(low-origin)/delta,(high-origin)/delta
            enter=max(enter,min(a,b));leave=min(leave,max(a,b))
            if enter>leave:return False
    return True


class Combat:
    def __init__(self):
        self.shooters=[]
        self.bullets=[]
        self.smoke=[]
        self.hits=0
        self.hurt_ticks=0
        self.crash_tick=self.explosion_tick=0
        self.crash_start=(0.,0.)
        self.spin_direction=1
        self.angle=0.

    def miss(self,game,x):
        self.shooters.append(Shooter(max(16,min(game.width-16,x+14))))

    def hit(self,game):
        if game.theme!='omarchy' or self.hurt_ticks or not game.can_fly:return False
        self.hits+=1
        self.hurt_ticks=HIT_GRACE_TICKS
        game.message=f'HIT {self.hits}/3! Keep moving!'
        if self.hits==3:
            self.crash_start=(game.copter_x,game.copter_y)
            self.spin_direction=-1 if game.dh<0 else 1
            game.control_x=game.control_y=game.dh=game.dv=0
            game.jumper=None
            self.bullets.clear()
            game.state='crashing'
            game.message='THIRD HIT! Going down!'
        return True

    def tick(self,game):
        if game.theme!='omarchy' or game.state=='game_over':return
        self.hurt_ticks=max(0,self.hurt_ticks-1)
        if game.state=='crashing':
            self.crash_tick+=1
            p=min(1,self.crash_tick/CRASH_TICKS)
            x,y=self.crash_start
            drift=self.spin_direction*(85*math.sin(p*math.pi/2)+10*p*math.sin(p*math.tau*2))
            game.copter_x=max(85,min(game.width-85,x+drift))
            game.copter_y=y+(game.deck+18-y)*p**1.6
            self.angle=self.spin_direction*(p*p*math.tau*3+p*math.pi)
            if self.crash_tick>=CRASH_TICKS:
                game.state='exploding'
                game.message='COPTER DOWN!'
        elif game.state=='exploding':
            self.explosion_tick+=1
            if self.explosion_tick>=EXPLOSION_TICKS:
                game.state='game_over'
                game.message='Three hits. Click BEGIN to fly again.'
        else:
            self._shooters_tick(game)
            self._bullets_tick(game)
        self._smoke_tick(game)

    def _shooters_tick(self,game):
        for shooter in self.shooters:
            shooter.age+=1
            shooter.flash=max(0,shooter.flash-1)
            shooter.cooldown=max(0,shooter.cooldown-1)
            shoulder_y=game.deck+44-23
            dx,dy=game.copter_x+24-shooter.x,game.copter_y+28-shoulder_y
            distance=max(1,math.hypot(dx,dy))
            shooter.aim_x,shooter.aim_y=dx/distance,dy/distance
            if shooter.age>=FIRST_SHOT_TICKS and shooter.cooldown==0:
                ax,ay=shooter.aim_x,shooter.aim_y
                self.bullets.append(Bullet(shooter.x+ax*17,shoulder_y+ay*17,
                                           ax*BULLET_SPEED,ay*BULLET_SPEED))
                shooter.cooldown=SHOT_INTERVAL
                shooter.flash=6

    def _bullets_tick(self,game):
        remaining=[]
        # Body and tail, rather than the surrounding panel/particle halo.
        targets=((game.copter_x-10,game.copter_y+10,78,38),
                 (game.copter_x-64,game.copter_y+14,60,20))
        for bullet in self.bullets:
            old_x,old_y=bullet.x,bullet.y
            bullet.x+=bullet.vx;bullet.y+=bullet.vy;bullet.age+=1
            if any(crosses_rect(old_x,old_y,bullet.x,bullet.y,r) for r in targets):
                self.hit(game)
                if game.state=='crashing':return
                continue
            if bullet.age<360 and -16<bullet.x<game.width+16 and -16<bullet.y<game.height+16:
                remaining.append(bullet)
        self.bullets=remaining

    def _smoke_tick(self,game):
        for puff in self.smoke:
            puff.age+=1;puff.x+=puff.drift;puff.y-=.7+puff.age*.01
        self.smoke=[p for p in self.smoke if p.age<75]
        if self.hits and game.state not in ('exploding','game_over'):
            if game.frame%(6 if self.hits==1 else 3)==0:
                self.smoke.append(Smoke(game.copter_x+10,game.copter_y+13,
                                        drift=math.sin(game.frame*1.7)*.35))

    def bounds(self,game):
        """Conservative visible effect rectangles for the transparent overlay."""
        if game.theme!='omarchy':return []
        boxes=[]
        for s in self.shooters:
            boxes.append((s.x-25,game.deck-2,50,50))
        for b in self.bullets:
            boxes.append((b.x-14,b.y-14,28,28))
        for p in self.smoke:
            boxes.append((p.x-32,p.y-32,64,64))
        if self.hurt_ticks and game.can_fly:
            boxes.append((game.copter_x-77,game.copter_y-7,158,65))
        if self.hits>=3:
            # Covers the spinning rotor, shock wave, debris, and burnt wreck.
            boxes.append((game.copter_x-218,game.copter_y-194,440,440))
        return boxes

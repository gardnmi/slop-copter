"""Pixel stuntmen, visible shots, engine smoke, spin and explosion."""
import math
import cairo
from combat import GET_UP_TICKS, EXPLOSION_TICKS
from sprites import blit
from theme import color, CYAN, FOREGROUND, BACKGROUND, GOLD, RED, pixel_ring


def shooter(c,game,s):
    if s.age<12:return  # The original splat plays before he gets up.
    rise=min(1,(s.age-12)/(GET_UP_TICKS-12))
    feet=game.deck+44
    hip=(s.x,feet-14*rise)
    neck=(s.x+(1-rise)*8,feet-5-21*rise)
    shoulder=(neck[0],neck[1]+4)
    hand=(shoulder[0]+s.aim_x*9,shoulder[1]+s.aim_y*9)
    muzzle=(shoulder[0]+s.aim_x*17,shoulder[1]+s.aim_y*17)
    c.save();c.set_line_cap(cairo.LINE_CAP_SQUARE)
    # A dark outline keeps the tiny man legible on any desktop.
    for ink,width in ((BACKGROUND,5),(FOREGROUND,2)):
        color(c,ink);c.set_line_width(width)
        c.move_to(s.x-7,feet);c.line_to(*hip);c.line_to(s.x+7,feet)
        c.move_to(*hip);c.line_to(*neck)
        c.move_to(*shoulder);c.line_to(*hand)
        c.move_to(shoulder[0]-4,shoulder[1]+7);c.line_to(*hand);c.stroke()
    color(c,BACKGROUND);c.rectangle(neck[0]-5,neck[1]-8,10,10);c.fill()
    color(c,CYAN);c.rectangle(neck[0]-3,neck[1]-6,6,6);c.fill()
    color(c,RED);c.rectangle(neck[0]+(1 if s.aim_x>=0 else -3),neck[1]-4,2,2);c.fill()
    if rise>=1:
        color(c,BACKGROUND);c.set_line_width(6)
        c.move_to(*hand);c.line_to(*muzzle);c.stroke()
        color(c,GOLD);c.set_line_width(3)
        c.move_to(*hand);c.line_to(*muzzle);c.stroke()
        if s.flash:
            color(c,'#fff5c4')
            c.rectangle(muzzle[0]-4,muzzle[1]-1,9,3)
            c.rectangle(muzzle[0]-1,muzzle[1]-5,3,11);c.fill()
    c.restore()


def smoke(c,puff,hits):
    age=puff.age/75
    radius=3+age*(13 if hits==1 else 23)
    alpha=(1-age)*(.6 if hits==1 else .85)
    x=round(puff.x/3)*3;y=round(puff.y/3)*3
    color(c,'#252a30',alpha)
    c.rectangle(x-radius,y-radius*.65,radius*2,radius*1.3)
    c.rectangle(x-radius*.65,y-radius,radius*1.3,radius*2);c.fill()
    color(c,'#929c9a',alpha*.7)
    c.rectangle(x-radius*.65,y-radius*.8,radius, radius*.75);c.fill()


def draw_wreck(c,game):
    x,y=game.copter_x,game.deck+44
    color(c,'#20252b');c.rectangle(x-43,y-12,83,13);c.fill()
    color(c,'#63716b');c.set_line_width(3)
    c.move_to(x-56,y-4);c.line_to(x-13,y-13);c.line_to(x+14,y-3);c.line_to(x+38,y-13)
    c.move_to(x-16,y-7);c.line_to(x-24,y-20);c.line_to(x+5,y-8);c.stroke()
    color(c,'#ffb464');c.rectangle(x-11,y-6,4,3);c.rectangle(x+16,y-8,3,4);c.fill()


def explosion(c,game):
    combat=game.combat;p=combat.explosion_tick/EXPLOSION_TICKS
    cx,cy=game.copter_x+2,game.copter_y+26
    draw_wreck(c,game)
    if p>=1:return
    # Stepped blast petals, an expanding shock ring, and tumbling fragments.
    for i in range(28):
        angle=i*2.39996
        distance=(16+(i%7)*8)*math.sin(p*math.pi*.8)
        size=max(2,20*(1-p)*(1+(i%3)*.2))
        x=cx+math.cos(angle)*distance;y=cy+math.sin(angle)*distance-p*22
        color(c,('#ff643d','#ffa34e','#ffe797')[i%3],1-p)
        c.rectangle(round(x/4)*4-size/2,round(y/4)*4-size/2,size,size);c.fill()
    if p<.45:
        color(c,'#fff9d5',1-p/.45)
        r=18+32*p;c.rectangle(cx-r,cy-r,r*2,r*2);c.fill()
    pixel_ring(c,cx,cy,12+120*p,game.time,(1-p)*.8,4)
    for i in range(30):
        angle=i*2.39996
        speed=60+(i%9)*11
        x=cx+math.cos(angle)*speed*p
        y=cy+math.sin(angle)*speed*p-75*p+100*p*p
        color(c,('#ffd493','#ed773d','#77837c')[i%3],1-p)
        c.rectangle(round(x/3)*3,round(y/3)*3,4+i%3,3+i%2);c.fill()


def draw_combat(c,game):
    if game.theme!='omarchy':return
    battle=game.combat
    c.save();c.set_antialias(cairo.ANTIALIAS_NONE)
    for s in battle.shooters:shooter(c,game,s)
    for bullet in battle.bullets:
        length=max(1,math.hypot(bullet.vx,bullet.vy))
        tx=bullet.x-bullet.vx/length*9;ty=bullet.y-bullet.vy/length*9
        color(c,BACKGROUND);c.set_line_width(5)
        c.move_to(tx,ty);c.line_to(bullet.x,bullet.y);c.stroke()
        color(c,'#ffc778');c.set_line_width(2)
        c.move_to(tx,ty);c.line_to(bullet.x,bullet.y);c.stroke()
        color(c,'#fff7d1');c.rectangle(bullet.x-1,bullet.y-1,3,3);c.fill()
    for puff in battle.smoke:smoke(c,puff,battle.hits)
    if battle.hurt_ticks>35 and game.can_fly:
        color(c,'#ffb464',.9);c.set_line_width(2)
        x,y=game.copter_x+22,game.copter_y+24
        for i in range(8):
            a=i*math.tau/8
            c.move_to(x+math.cos(a)*18,y+math.sin(a)*18)
            c.line_to(x+math.cos(a)*26,y+math.sin(a)*26)
        c.stroke()
    if game.state=='crashing':
        c.save();c.translate(game.copter_x+2,game.copter_y+26);c.rotate(battle.angle)
        blit(c,'copter-wagon',((game.frame%3)*74,0,74,26),-74,-26,theme='omarchy')
        c.restore()
    elif game.state=='exploding' or (game.state=='game_over' and battle.hits==3):
        explosion(c,game)
    c.restore()

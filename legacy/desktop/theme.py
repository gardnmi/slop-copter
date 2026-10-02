"""Mint pixels, shaded wordmark and checker tides from the Omarchy site video.

All effects use simulation time and deterministic hashes, never the physics RNG.
"""
from functools import lru_cache
from pathlib import Path
import math
import cairo

BACKGROUND = '#06080c'
FOREGROUND = '#ccfbd5'
JADE = '#509c68'
CYAN = '#8bffa5'
GOLD = '#deffac'
MUTED = '#203a2b'
PANEL = '#10151c'
RED = '#ff8d9d'
PIECE_PADDING = 24
FALL_PADDING = 48


@lru_cache(None)
def rgb(value):
    return tuple(int(value[i:i+2],16)/255 for i in (1,3,5))


def color(c, value, alpha=1):
    c.set_source_rgba(*rgb(value),alpha)


def label(c,x,y,text,size=6,ink=FOREGROUND):
    c.new_path();c.select_font_face('monospace',0,0);c.set_font_size(size)
    color(c,ink);c.move_to(x,y);c.show_text(str(text));c.new_path()


def noise(x,y,seed=0):
    return ((x*374761393+y*668265263+seed*1274126177)&65535)/65535


@lru_cache(maxsize=32)
def pixel_grid(w,h,cell,strength,seed):
    cells=[]
    for row in range(math.ceil(h/cell)):
        py=row*cell
        for col in range(row%2,math.ceil(w/cell),2):
            px=col*cell
            base=(max(abs(px-w/2)/(w/2),py/h)-.4)*.8
            n=noise(col,row,seed)
            if n>max(.02,base+.19)*strength:continue
            cells.append((row,col,px,py,min(cell,w-px),min(cell,h-py),base,n,
                          .22+.45*noise(row,col,seed+7)))
    return tuple(cells)


def pixel_field(c,rect,t,cell=4,strength=1,seed=0):
    """Dense checker edges dissolve into loose pixels along a moving wave."""
    x,y,w,h=rect
    columns=[.11*math.sin(col*.43-t*2) for col in range(math.ceil(w/cell))]
    rows=[.08*math.sin(row*.7+t*1.7) for row in range(math.ceil(h/cell))]
    for row,col,px,py,cw,ch,base,n,brightness in pixel_grid(w,h,cell,strength,seed):
        if n>max(.02,base+columns[col]+rows[row])*strength:continue
        color(c,CYAN,brightness);c.rectangle(x+px,y+py,cw,ch);c.fill()


@lru_cache(None)
def wordmark():
    return cairo.ImageSurface.create_from_png(str(Path(__file__).with_name('assets')/'omarchy-wordmark.png'))


def draw_wordmark(c,x,y,w,t):
    mask=wordmark();scale=w/mask.get_width();h=mask.get_height()
    c.save();c.translate(x,y);c.scale(scale,scale)
    color(c,MUTED);c.mask_surface(mask,0,4)
    gradient=cairo.LinearGradient(0,0,0,h)
    for position,ink in ((0,'#d1ffdb'),(.29,'#c2ffd0'),(.30,'#a6ffbb'),(.43,CYAN),
                         (.65,CYAN),(.66,JADE),(.84,JADE),(.85,'#294e36'),(1,'#294e36')):
        gradient.add_color_stop_rgb(position,*(int(ink[i:i+2],16)/255 for i in (1,3,5)))
    c.set_source(gradient);c.mask_surface(mask,0,0)
    beam=(t*.22%1)*mask.get_width()*1.5-mask.get_width()*.25
    shine=cairo.LinearGradient(beam-16,0,beam+16,0)
    shine.add_color_stop_rgba(0,1,1,1,0);shine.add_color_stop_rgba(.5,1,1,1,.28)
    shine.add_color_stop_rgba(1,1,1,1,0)
    c.set_source(shine);c.mask_surface(mask,0,0);c.restore()


def pixel_ring(c,cx,cy,radius,t,alpha=1,cell=3):
    for i in range(32):
        angle=i*math.tau/32+t*.6
        px=round((cx+math.cos(angle)*radius)/cell)*cell
        py=round((cy+math.sin(angle)*radius)/cell)*cell
        color(c,CYAN if i%3 else FOREGROUND,alpha*(.4+.6*(i%4)/3))
        c.rectangle(px,py,cell,cell);c.fill()


def draw_piece_background(c,game,role,rect):
    x,y,w,h=rect;t=game.time
    c.save();c.translate(x,y)
    color(c,BACKGROUND);c.rectangle(0,0,w,h);c.fill()
    # Only the sprite panel is opaque; its checker halo floats on the desktop.
    pixel_field(c,(-20,-20,w+40,h+40),t,4,.6,{'copter':1,'cart':2,'cloud':3}[role])
    if role=='cloud':
        for i in range(3):
            pixel_ring(c,w*(i+1)/4,h*.52,12+5*math.sin(t*2+i),t+i,.3,2)
    c.restore()


def draw_piece_effects(c,game,role,rect):
    x,y,w,h=rect;t=game.time
    c.save();c.translate(x,y)
    p=PIECE_PADDING;c.rectangle(-p,-p,w+p*2,h+p*2);c.clip()
    color(c,JADE,.7);c.set_line_width(1);c.rectangle(.5,.5,w-1,h-1);c.stroke()
    color(c,CYAN);c.set_line_width(2)
    for px,py,sx,sy in ((1,1,1,1),(w-1,1,-1,1),(1,h-1,1,-1),(w-1,h-1,-1,-1)):
        c.move_to(px+sx*8,py);c.line_to(px,py);c.line_to(px,py+sy*6)
    c.stroke()
    for i in range(4):
        color(c,CYAN,.7);c.rectangle((t*34+i*w/4)%w,0,3,2);c.fill()
    if role=='copter':
        for i in range(14):
            phase=t*19+i*.4
            color(c,CYAN,.22+.45*i/14)
            c.rectangle(97+math.sin(phase)*40,1+math.cos(phase)*4,4,2);c.fill()
    elif role=='cart':
        for wx in (16,69):
            color(c,CYAN);c.set_line_width(2)
            for phase in (0,math.pi/2):
                dx=6*math.cos(t*14+phase);dy=6*math.sin(t*14+phase)
                c.move_to(wx-dx,34-dy);c.line_to(wx+dx,34+dy)
            c.stroke()
        for i in range(24):
            age=(t*2+i/24)%1
            color(c,CYAN if i%3 else GOLD,(1-age)*.8)
            c.rectangle(130-age*148,37+math.sin(age*math.pi)*(8+i%4),3,3);c.fill()
        if game.state=='result' and game.outcome=='hay':
            age=game.effect_tick/45
            for i in range(24):
                angle=i*math.tau/24;color(c,GOLD if i%3 else CYAN,1-age)
                c.rectangle(35+math.cos(angle)*(5+age*51),9+math.sin(angle)*(4+age*24),3,3);c.fill()
    else:
        for i in range(18):
            px=w+18-(t*87+i*31)%(w+36);yy=8+(i*17)%max(1,h-16)
            color(c,CYAN,.3+.25*math.sin(t*3+i)**2)
            for k in range(3):c.rectangle(px+k*6,yy,3,2)
            c.fill()
        if game.jumper and game.jumper.in_cloud and game.state=='falling':
            pixel_ring(c,game.jumper.x-x+14,game.jumper.y-y+16,15+(t*40)%18,t,.9,3)
    c.restore()


def draw_fall_effects(c,game):
    j=game.jumper;c.save()
    for i in range(24):
        age=(game.time*2+i/24)%1
        color(c,CYAN if i%3 else FOREGROUND,(1-age)*.85)
        x=j.x+14+math.sin(i*2.4+game.time*3)*27*age;y=j.y+14-age*55
        c.rectangle(round(x/3)*3,round(y/3)*3,3,3);c.fill()
    age=min(1,max(0,(j.y-(game.copter_y+46))/100))
    if age<1:pixel_ring(c,j.x+14,j.y+14,10+age*26,game.time,1-age,2)
    c.restore()


def draw_landing_effects(c,game):
    if game.state!='result' or not game.jumper:return
    hit=game.outcome=='hay';age=game.effect_tick/(45 if hit else 12)
    cx=game.cart_x+35 if hit else game.jumper.x+14
    cy=game.deck+5 if hit else game.jumper.y+14
    for i in range(40 if hit else 18):
        angle=i*2.39996;radius=(16+(i%7)*6)*age
        px=cx+math.cos(angle)*radius;py=cy+math.sin(angle)*radius-age*(1-age)*80
        color(c,(CYAN if i%3 else GOLD) if hit else RED,1-age)
        c.rectangle(round(px/3)*3,round(py/3)*3,3,3);c.fill()


def yoke_rect(game):
    return (400,4,43,43) if game.theme=='omarchy' else (66,4,43,43)


def number(c,text,x,y,pixel=2):
    glyphs=('111/101/101/101/111','010/110/010/010/111','111/001/111/100/111',
            '111/001/111/001/111','101/101/111/001/001','111/100/111/001/111',
            '111/100/111/101/111','111/001/010/010/010','111/101/111/101/111',
            '111/101/111/001/111')
    for i,digit in enumerate(str(text)):
        for row,bits in enumerate(glyphs[int(digit)].split('/')):
            color(c,FOREGROUND if row<2 else CYAN if row<4 else JADE)
            for col,bit in enumerate(bits):
                if bit=='1':c.rectangle(x+(i*4+col)*pixel,y+row*pixel,pixel,pixel)
            c.fill()


def draw_omarchy_dashboard(c,game):
    """512x64 logical units; footer hit boxes match the Classic controls."""
    t=game.time
    color(c,BACKGROUND);c.rectangle(0,0,512,64);c.fill()
    pixel_field(c,(0,0,174,51),t,2,1.25,9)
    draw_wordmark(c,9,7,155,t)
    label(c,13,48,'STUNT COPTER / DESKTOP ARCADE',5,CYAN)
    for x,w in ((178,124),(307,84),(397,49),(451,60)):
        color(c,PANEL);c.rectangle(x,1,w,49);c.fill()
        color(c,MUTED);c.rectangle(x+.5,1.5,w-1,48);c.set_line_width(.5);c.stroke()
    label(c,184,9,'SCORE',5,CYAN);label(c,260,9,'LVL '+f'{game.level:02d}',5,CYAN)
    number(c,f'{game.score:06d}'[-6:],184,14,4.6)
    label(c,184,45,'BEST '+f'{game.best:06d}'[-6:],6)
    label(c,313,10,'HEIGHT',5,JADE);label(c,358,10,game.height_of_drop,7)
    label(c,313,21,'WAGON',5,JADE);label(c,350,21,('WALK','TROT','GALLOP')[game.wagon_step-1],6)
    label(c,313,32,'FALL',5,JADE);label(c,348,32,('OH BOY','LIGHT','MED','HEAVY')[game.gravity-1],6)
    for i in range(5):
        xx=314+i*14;result=game.history[i] if i<len(game.history) else None
        color(c,CYAN if result else RED if result is False else MUTED);c.rectangle(xx,38,9,8);c.fill()
        if i==len(game.history) and game.state!='game_over':
            color(c,CYAN,.55+.35*math.sin(t*4));c.rectangle(xx+2,40,5,4);c.fill()
        if result is True:
            color(c,BACKGROUND);c.set_line_width(1)
            c.move_to(xx+2,42);c.line_to(xx+4,44);c.line_to(xx+7,40);c.stroke()
    xx,yy,ww,hh=yoke_rect(game)
    color(c,JADE);c.set_line_width(.5);c.rectangle(xx,yy,ww,hh)
    c.move_to(xx+ww/2,yy);c.line_to(xx+ww/2,yy+hh)
    c.move_to(xx,yy+hh/2);c.line_to(xx+ww,yy+hh/2);c.stroke()
    px=xx+ww/2+game.control_x/4*17;py=yy+hh/2+game.control_y/4*17
    pixel_ring(c,px,py,5,t,.8,1);color(c,CYAN);c.rectangle(px-1,py-1,3,3);c.fill()
    label(c,457,10,'FLIGHT',5,CYAN)
    status=('PAUSED' if game.paused else 'DOWN' if game.state=='game_over' else
            'MAYDAY' if game.state=='crashing' else 'BOOM' if game.state=='exploding' else
            'DAMAGE' if game.combat.hits else 'CLOUD' if game.jumper and game.jumper.in_cloud else 'LIVE')
    label(c,457,19,status,6)
    label(c,457,30,f'HITS {game.combat.hits}/3',6,RED if game.combat.hits else CYAN)
    for i in range(3):
        color(c,RED if i<game.combat.hits else CYAN)
        c.rectangle(457+i*16,36,12,9);c.fill()
    color(c,JADE);c.rectangle(0,51,512,.5);c.fill()
    status=game.message[:36];label(c,5,60,'> '+status,5.5)
    if int(t*2)%2==0:
        color(c,CYAN);c.rectangle(min(239,12+len(status)*3.3),55,2,6);c.fill()
    for bx,bw,text in ((245,99,'THEME: OMARCHY'),(350,50,'BEGIN' if game.state=='game_over' else 'PLAY' if game.paused else 'PAUSE'),
                       (404,50,'RESET'),(458,49,'QUIT')):
        color(c,CYAN if bx==245 else PANEL);c.rectangle(bx,53,bw,9);c.fill()
        color(c,MUTED);c.rectangle(bx+.5,53.5,bw-1,8);c.stroke()
        label(c,bx+7,60,text,6,BACKGROUND if bx==245 else FOREGROUND)

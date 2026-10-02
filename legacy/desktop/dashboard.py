"""Original dashboard bitmap, digits, thumbs and somersault animation."""
import cairo
from functools import lru_cache, partial
from sprites import blit,man,digits
from theme import BACKGROUND, FOREGROUND, MUTED, CYAN, color, draw_omarchy_dashboard


@lru_cache(None)
def desktop_pattern():
    surface=cairo.ImageSurface(cairo.FORMAT_RGB24,2,2)
    c=cairo.Context(surface);c.set_source_rgb(1,1,1);c.paint()
    c.set_source_rgb(0,0,0);c.rectangle(0,0,1,1);c.rectangle(1,1,1,1);c.fill()
    pattern=cairo.SurfacePattern(surface)
    pattern.set_extend(cairo.EXTEND_REPEAT);pattern.set_filter(cairo.FILTER_NEAREST)
    return pattern


def draw_dashboard(c,game,rect):
    themed=game.theme=='omarchy'
    sprite=partial(blit,theme=game.theme)
    figure=partial(man,theme=game.theme)
    numbers=partial(digits,theme=game.theme)
    x,y,w,h=rect
    c.save();c.translate(x,y);c.scale(w/512,h/64)
    c.set_antialias(cairo.ANTIALIAS_NONE)
    if themed:
        draw_omarchy_dashboard(c,game)
        c.restore()
        return
    # The same two-tone desktop pattern framing the original instruments.
    c.set_source(desktop_pattern());c.rectangle(0,0,512,64);c.fill()
    base=62
    sprite(c,'dashboard',(0,0,387,51),base,0,1)
    # Original crosshair/yoke sprite clipped by the 44x44 instrument window.
    c.save();c.rectangle(base+4,4,43,43);c.clip()
    px=game.control_x/4*20;py=game.control_y/4*20
    sprite(c,'man-numbers',(0,62,81,81),base+25-40+px,25-40+py,1)
    c.restore()
    for i,success in enumerate(game.history):
        figure(c,6 if success else 13,base+54+i*15,17 if success else 34,1)
    if game.state!='game_over' and len(game.history)<5:
        c.save()
        if themed:
            color(c,CYAN,.65);c.set_line_width(1)
            c.rectangle(base+54+len(game.history)*15,.5,14,15);c.stroke()
        else:
            c.set_operator(cairo.OPERATOR_DIFFERENCE);c.set_source_rgb(1,1,1)
            c.rectangle(base+54+len(game.history)*15,0,14,16);c.fill()
        c.restore()
    numbers(c,game.score,base+135,10,1)
    numbers(c,game.best,base+135,35,1)
    c.select_font_face('sans-serif',0,1);c.set_font_size(10)
    def text(tx,ty,value):
        color(c,FOREGROUND if themed else '#000000');c.move_to(tx,ty);c.show_text(str(value))
    text(base+342,12,game.height_of_drop)
    text(base+329,29,('WALK','TROT','GALLOP')[game.wagon_step-1])
    text(base+329,46,('OH BOY','LIGHT','MEDIUM','HEAVY')[game.gravity-1])
    if game.outcome=='hay' and game.state=='result':
        frame=min(14,game.effect_tick//3)%14
        sr=((frame%7)*32,48+(frame//7)*41,32,41)
        for fx in (14,465):sprite(c,'copter-wagon',sr,fx,4,1)
    color(c,MUTED if themed else '#ffffff');c.rectangle(1,52,510,11);c.fill()
    c.set_font_size(7)
    text(5,60,game.message[:39])
    for bx,bw,label in [(245,99,'THEME: '+game.theme.upper()),
                        (350,50,'BEGIN' if game.state=='game_over' else 'PLAY' if game.paused else 'PAUSE'),
                        (404,50,'RESET'),(458,49,'QUIT')]:
        c.rectangle(bx,53,bw,9);color(c,CYAN if themed else '#000000');c.set_line_width(.5);c.stroke()
        text(bx+9,60,label)
    c.restore()

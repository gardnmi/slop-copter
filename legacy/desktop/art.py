"""Exact original sprites on three small white desktop pieces."""
import cairo
from functools import partial
from sprites import blit, man
from dashboard import draw_dashboard
from model import SCALE, CLOUD_SIZES
from combat_art import draw_combat
from theme import (PIECE_PADDING, color, draw_piece_background,
                   draw_piece_effects, draw_fall_effects, draw_landing_effects)


def copter_rect(game):
    return int(game.copter_x-36*SCALE),int(game.copter_y),74*SCALE,40*SCALE


def hud_rect(game):
    w=min(1024,game.width-20)
    return int((game.width-w)/2),int(game.height-140),int(w),128


def input_rects(game):
    return [hud_rect(game)]+([copter_rect(game)] if game.can_fly else [])


def raw_piece_rect(game,role):
    if role=='copter':return copter_rect(game)
    if role=='cloud':return tuple(int(v) for v in game.cloud_rect)
    return int(game.cart_x),int(game.deck),73*SCALE,22*SCALE


def piece_rect(game,role):
    # Native layer surfaces use the visible part of wrapping pieces. Their
    # canvases still paint in desktop coordinates, preserving partial exit.
    x,y,w,h=raw_piece_rect(game,role)
    if game.theme=='omarchy':
        x-=PIECE_PADDING;y-=PIECE_PADDING
        w+=PIECE_PADDING*2;h+=PIECE_PADDING*2
    left,top=max(0,x),max(0,y)
    right,bottom=min(game.width,x+w),min(game.height,y+h)
    return min(left,game.width-1),min(top,game.height-1),max(1,right-left),max(1,bottom-top)


def native_rect(game,role):
    # Keep the cart surface stationary: moving/resizing a native surface on
    # wrap lets the compositor interpolate it across the desktop. Only the
    # white (or themed) sprite panel moves inside this transparent narrow lane.
    if role=='cart':
        p=PIECE_PADDING if game.theme=='omarchy' else 0
        return 0,int(game.deck)-p,int(game.width),22*SCALE+p*2
    return piece_rect(game,role)


def exclude_cloud(c,game):
    # Its white desktop window naturally occludes figures behind it.
    c.rectangle(0,0,game.width,game.height)
    c.rectangle(*game.cloud_rect)
    c.set_fill_rule(cairo.FILL_RULE_EVEN_ODD);c.clip()


def draw(c,game,role='all'):
    themed=game.theme=='omarchy'
    sprite=partial(blit,theme=game.theme)
    figure=partial(man,theme=game.theme)
    c.save();c.set_antialias(cairo.ANTIALIAS_NONE)
    if role in ('all','copter') and not (themed and game.combat.hits>=3):
        x,y,w,h=raw_piece_rect(game,'copter')
        if themed:draw_piece_background(c,game,'copter',(x,y,w,h))
        else:
            color(c,'#ffffff');c.rectangle(x,y,w,h);c.fill()
        sprite(c,'copter-wagon',((game.frame%3)*74,0,74,26),x,y)
        if game.state=='ready':figure(c,0,game.copter_x,game.copter_y+23*SCALE)
        if themed:draw_piece_effects(c,game,'copter',raw_piece_rect(game,'copter'))
    if role in ('all','cart'):
        if themed:draw_piece_background(c,game,'cart',raw_piece_rect(game,'cart'))
        frame=game.frame%3
        sprite(c,'copter-wagon',(frame*73,26,73,22),game.cart_x,game.deck)
        if game.outcome=='hay' and game.state=='result':
            sprite(c,'man-numbers',(81,62,28,10),game.cart_x,game.deck,opaque=True)
        elif game.state=='game_over' and game.outcome in ('horse','driver'):
            if game.outcome=='horse':rect=(81,94,29,22)
            else:rect=(81,72,39,22)
            sprite(c,'man-numbers',rect,game.cart_x+(73-rect[2])*SCALE,game.deck,opaque=True)
        if themed:draw_piece_effects(c,game,'cart',raw_piece_rect(game,'cart'))
    if role in ('all','cloud'):
        if themed:draw_piece_background(c,game,'cloud',raw_piece_rect(game,'cloud'))
        w,h=CLOUD_SIZES[game.cloud_index]
        sprite(c,'cloud-'+str(game.cloud_index+1),(0,0,w,h),game.cloud_x,game.cloud_y)
        if themed:draw_piece_effects(c,game,'cloud',raw_piece_rect(game,'cloud'))
    if role in ('all','overlay'):
        if themed:draw_landing_effects(c,game)
        if game.jumper and game.state=='falling':
            c.save();exclude_cloud(c,game)
            if themed:draw_fall_effects(c,game)
            figure(c,1+game.frame%5,game.jumper.x,game.jumper.y,floating=True)
            c.restore()
        elif game.jumper and game.state=='result' and game.outcome!='hay':
            figure(c,7+min(5,game.effect_tick//2),game.jumper.x,game.jumper.y,floating=True)
        if themed:draw_combat(c,game)
        draw_dashboard(c,game,hud_rect(game))
    c.restore()

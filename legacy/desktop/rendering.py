"""Rasterize before passing frames to GTK's recording/GPU renderer.

Cairo aborted in get_clip_surface while GTK replayed our recorded operations.
Keeping clips and blend operators on image surfaces avoids that replay path.
Only occupied overlay bounds are allocated, not a monitor-sized frame.
"""
import math
import cairo
from art import draw, hud_rect, native_rect
from theme import FALL_PADDING


def frame_bounds(game, role):
    if role != 'overlay':
        return native_rect(game, role)
    x,y,w,h=hud_rect(game)
    left,top,right,bottom=x,y,x+w,y+h
    if game.jumper and game.state in ('falling','result'):
        j=game.jumper
        padding=FALL_PADDING if game.theme=='omarchy' else 2
        jl,jt,jr,jb=j.x-padding,j.y-padding,j.x+28+padding,j.y+32+padding
        if jr>0 and jb>0 and jl<game.width and jt<game.height:
            left=min(left,max(0,math.floor(jl)));top=min(top,max(0,math.floor(jt)))
            right=max(right,min(game.width,math.ceil(jr)));bottom=max(bottom,min(game.height,math.ceil(jb)))
        if game.theme=='omarchy' and game.state=='result' and game.outcome=='hay':
            left=min(left,max(0,math.floor(game.cart_x-26)))
            right=max(right,min(game.width,math.ceil(game.cart_x+98)))
            top=min(top,max(0,int(game.deck-75)))
            bottom=max(bottom,min(game.height,int(game.deck+66)))
    for bx,by,bw,bh in game.combat.bounds(game):
        if bx+bw>0 and by+bh>0 and bx<game.width and by<game.height:
            left=min(left,max(0,math.floor(bx)));top=min(top,max(0,math.floor(by)))
            right=max(right,min(game.width,math.ceil(bx+bw)))
            bottom=max(bottom,min(game.height,math.ceil(by+bh)))
    return int(left),int(top),max(1,int(right-left)),max(1,int(bottom-top))


def rasterize(game, role):
    x,y,w,h=frame_bounds(game,role)
    surface=cairo.ImageSurface(cairo.FORMAT_ARGB32,w,h)
    c=cairo.Context(surface);c.translate(-x,-y)
    draw(c,game,role)
    surface.flush()
    return surface,(x,y,w,h)


def paint_frame(c,game,role):
    surface,(x,y,_,_)=rasterize(game,role)
    c.save()
    # Native piece contexts already have their desktop origin translated.
    c.set_source_surface(surface,x,y)
    c.get_source().set_filter(cairo.FILTER_NEAREST)
    c.paint()
    c.restore()

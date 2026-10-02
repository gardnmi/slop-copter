"""Draw Duane Blehm's original PICT bitmaps, decoded losslessly to PNG.

No resampled or redrawn sprites: the integer scale uses nearest-neighbour pixels.
See assets/PROVENANCE.md for source and extraction details.
"""
from functools import lru_cache
from pathlib import Path
import cairo
from theme import BACKGROUND, FOREGROUND, CYAN, color

ASSETS = Path(__file__).with_name('assets')


@lru_cache(None)
def sheet(name, theme='classic'):
    if theme=='classic':
        return cairo.ImageSurface.create_from_png(str(ASSETS/(name+'.png')))
    source=sheet(name)
    surface=cairo.ImageSurface(cairo.FORMAT_ARGB32,source.get_width(),source.get_height())
    c=cairo.Context(surface)
    source.flush();data=source.get_data()
    color(c,FOREGROUND)
    for y in range(source.get_height()):
        for x in range(source.get_width()):
            if data[y*source.get_stride()+x*4]<128:c.rectangle(x,y,1,1)
    c.fill()
    return surface


def blit(c, name, rect, x, y, scale=2, theme='classic', opaque=False):
    sx,sy,w,h=rect
    c.save()
    c.translate(round(x),round(y));c.scale(scale,scale)
    c.rectangle(0,0,w,h);c.clip()
    if opaque and theme=='omarchy':
        color(c,BACKGROUND);c.paint()
    c.set_source_surface(sheet(name,theme),-sx,-sy)
    c.get_source().set_filter(cairo.FILTER_NEAREST)
    c.paint();c.restore()


def man(c, index, x, y, scale=2, floating=False, theme='classic'):
    rect=((index%7)*14,(index//7)*16,14,16)
    if not floating:
        blit(c,'man-numbers',rect,x,y,scale,theme)
        return
    # White keyline around black pixels keeps the original figure visible on
    # a dark desktop; inside the white piece windows it is visually unchanged.
    surface=sheet('man-numbers');surface.flush();data=surface.get_data()
    c.save();c.translate(round(x),round(y));c.set_antialias(cairo.ANTIALIAS_NONE)
    points=[]
    for py in range(16):
        for px in range(14):
            i=(rect[1]+py)*surface.get_stride()+(rect[0]+px)*4
            if data[i]<128: points.append((px*scale,py*scale))
    color(c,BACKGROUND if theme=='omarchy' else '#ffffff')
    for px,py in points:c.rectangle(px-1,py-1,scale+2,scale+2)
    c.fill();color(c,CYAN if theme=='omarchy' else '#000000')
    for px,py in points:c.rectangle(px,py,scale,scale)
    c.fill();c.restore()


def digits(c, number, x, y, scale=2, theme='classic'):
    for i,char in enumerate(f'{number:06d}'[-6:]):
        digit=int(char)
        blit(c,'man-numbers',((digit%5)*20,32+(digit//5)*15,20,15),x+i*21*scale,y,scale,theme)

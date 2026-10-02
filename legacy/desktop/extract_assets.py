#!/usr/bin/env python3
"""Decode original resources from a local checkout of github.com/gamache/blehm.

Usage: python extract_assets.py /path/to/blehm
No redrawing, filtering, palette changes, or scaling is applied to the PICT bits.
Only the PackBitsRect opcode used by these six original resources is supported.
"""
from pathlib import Path
import struct
import sys
import cairo


def resources(path):
    b=path.read_bytes()
    if struct.unpack_from('>I',b)[0] != 0x00051607:
        raise ValueError('Expected an AppleDouble resource fork')
    for i in range(struct.unpack_from('>H',b,24)[0]):
        kind,start,length=struct.unpack_from('>III',b,26+12*i)
        if kind==2:
            r=b[start:start+length]
            break
    else:raise ValueError('No resource fork')
    data_offset,map_offset,_,_=struct.unpack_from('>IIII',r)
    types=map_offset+struct.unpack_from('>H',r,map_offset+24)[0]
    result={}
    for i in range(struct.unpack_from('>H',r,types)[0]+1):
        kind,count,offset=struct.unpack_from('>4sHH',r,types+2+i*8)
        for k in range(count+1):
            rid,_,attr=struct.unpack_from('>hHI',r,types+offset+k*12)
            start=data_offset+(attr&0xffffff)
            length=struct.unpack_from('>I',r,start)[0]
            result[kind,rid]=r[start+4:start+4+length]
    return result


def decode_pict(b):
    assert b[10:12]==b'\x11\x01' and b[23]==0x98
    pos=24
    rowbytes=struct.unpack_from('>H',b,pos)[0];pos+=2
    bounds=struct.unpack_from('>4h',b,pos);pos+=8
    src=struct.unpack_from('>4h',b,pos);pos+=8
    dst=struct.unpack_from('>4h',b,pos);pos+=8
    assert struct.unpack_from('>H',b,pos)[0]==0;pos+=2
    h,w=dst[2]-dst[0],dst[3]-dst[1]
    rows=[]
    for _ in range(bounds[2]-bounds[0]):
        n=b[pos];pos+=1;end=pos+n;row=bytearray()
        while pos<end:
            control=b[pos];pos+=1
            if control<128:
                row.extend(b[pos:pos+control+1]);pos+=control+1
            elif control>128:
                row.extend(b[pos:pos+1]*(257-control));pos+=1
        assert len(row)==rowbytes
        rows.append(row)
    surface=cairo.ImageSurface(cairo.FORMAT_RGB24,w,h)
    c=cairo.Context(surface);c.set_source_rgb(1,1,1);c.paint();c.set_source_rgb(0,0,0)
    for y in range(h):
        for x in range(w):
            xx=x+src[1]-bounds[1];yy=y+src[0]-bounds[0]
            if rows[yy][xx//8] & (128>>(xx%8)):c.rectangle(x,y,1,1)
    c.fill()
    return surface


def cloud_region(b, height):
    _,top,left,bottom,right=struct.unpack_from('>5h',b)
    rows=[[] for _ in range(height)]
    endpoints=set();pos=10;last_y=top
    while True:
        y=struct.unpack_from('>h',b,pos)[0];pos+=2
        for py in range(last_y,y if y!=32767 else bottom):
            xs=sorted(endpoints)
            if 0<=py-top+1<height:
                # Match the original InsetRgn(-1,0), with PICT's one-pixel border.
                rows[py-top+1]=[[xs[i]-left,xs[i+1]-left+1] for i in range(0,len(xs),2)]
        if y==32767:break
        while True:
            x=struct.unpack_from('>h',b,pos)[0];pos+=2
            if x==32767:break
            if x in endpoints:endpoints.remove(x)
            else:endpoints.add(x)
        last_y=y
    return rows


def main():
    root=Path(__file__).resolve().parent
    fork=next(Path(sys.argv[1]).glob('__MACOSX/Duane*/Stunt*/._StuntCopter:Rsrc'))
    res=resources(fork)
    names={128:'copter-wagon',129:'man-numbers',130:'dashboard',356:'cloud-1',357:'cloud-2',358:'cloud-3'}
    clouds=[]
    for rid,name in names.items():
        surface=decode_pict(res[b'PICT',rid])
        surface.write_to_png(str(root/'assets'/(name+'.png')))
        if rid>=356:clouds.append(cloud_region(res[b'RGN ',rid],surface.get_height()))
    (root/'sprites_data.py').write_text('"""Cloud masks decoded from the original QuickDraw regions."""\nCLOUD_SPANS = '+repr(clouds)+'\n')


if __name__=='__main__':main()

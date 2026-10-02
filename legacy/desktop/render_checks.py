"""Deterministic native-render stress scenes (not normal gameplay)."""
from model import Game, Jumper


def stress_scene(frame, width, height, theme='classic'):
    g=Game(width,height,seed=1)
    g.frame=frame;g.time=frame/60
    g.theme=theme
    g.cloud_index=frame%3
    g.cloud_x=(-420,-12,0,width//2,width-12,width+12)[(frame//8)%6]
    g.cloud_y=max(30,g.copter_y+30)
    g.cart_x=(-145,-18,0,width-12,width+1,300)[(frame//6)%6]
    g.copter_x=(100,width//2,width-40)[(frame//18)%3]
    g.control_x=(frame%9)-4;g.control_y=((frame//3)%8)-3
    g.history=[True,False,True,False][:((frame//4)%5)]
    mode=(frame//12)%4
    if mode==1:
        g.state='falling';g.jumper=Jumper(g.cloud_x+100,g.cloud_y+20+(frame%12)*4)
    elif mode==2:
        g.state='result';g.outcome='hay';g.effect_tick=frame%45
        g.jumper=Jumper(g.cart_x+20,g.deck-14)
    elif mode==3:
        g.state='result';g.outcome='ground';g.effect_tick=frame%12
        g.jumper=Jumper(width//2,g.deck+12)
    return g

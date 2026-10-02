import unittest
import cairo
from art import draw, native_rect
from model import Game
from render_checks import stress_scene
from rendering import paint_frame, rasterize


class RenderingTests(unittest.TestCase):
    def test_raster_frames_match_direct_drawing_through_wraps_and_clouds(self):
        for theme in ('classic','omarchy'):
            for frame in (1,13,25,37,49,67,81,97,113,139):
                g=stress_scene(frame,1000,600,theme)
                expected=cairo.ImageSurface(cairo.FORMAT_ARGB32,1000,600)
                draw(cairo.Context(expected),g)
                actual=cairo.ImageSurface(cairo.FORMAT_ARGB32,1000,600)
                c=cairo.Context(actual)
                for role in ('copter','cart','cloud','overlay'):
                    paint_frame(c,g,role)
                expected.flush();actual.flush()
                with self.subTest(theme=theme,frame=frame):
                    a,b=bytes(actual.get_data()),bytes(expected.get_data())
                    if a!=b and theme=='omarchy':
                        # Translucent landing sparks over a separate cart image
                        # can round RGB by one unit at the compositing boundary.
                        self.assertEqual(a[3::4],b[3::4])
                        self.assertLessEqual(max(abs(x-y) for x,y in zip(a,b)),1)
                    else:self.assertEqual(a,b)

    def test_wagon_native_surface_stays_put_and_clears_old_pixels(self):
        g=Game(1000,600);bounds=native_rect(g,'cart')
        for x in (854,900,998,1000,-146,-144,-60,40):
            g.cart_x=x
            self.assertEqual(native_rect(g,'cart'),bounds)
            surface,_=rasterize(g,'cart');data=surface.get_data()
            for px in range(g.width):
                alpha=data[10*surface.get_stride()+px*4+3]
                self.assertEqual(alpha,255 if x<=px<x+146 else 0)

    def test_omarchy_is_colored_animated_and_leaves_desktop_transparent(self):
        g=Game(1000,600,theme='omarchy')
        first,_=rasterize(g,'copter')
        g.time=.4
        second,_=rasterize(g,'copter')
        self.assertNotEqual(bytes(first.get_data()),bytes(second.get_data()))
        surface=cairo.ImageSurface(cairo.FORMAT_ARGB32,1000,600)
        draw(cairo.Context(surface),g);surface.flush()
        self.assertEqual(bytes(surface.get_data()[0:4]),bytes(4))
        g.theme='classic'
        classic,_=rasterize(g,'copter')
        self.assertNotEqual(bytes(classic.get_data()),bytes(second.get_data()))

    def test_recording_replay_accepts_rasterized_clip_and_blend_scenes(self):
        # Covers the GTK-style recording boundary involved in the native abort.
        # The original crash was intermittent, so this is not a full reproducer.
        for theme in ('classic','omarchy'):
            for frame in (13,25,37,67,97,139):
                g=stress_scene(frame,1000,600,theme)
                recording=cairo.RecordingSurface(cairo.CONTENT_COLOR_ALPHA,None)
                paint_frame(cairo.Context(recording),g,'overlay')
                target=cairo.ImageSurface(cairo.FORMAT_ARGB32,1250,750)
                c=cairo.Context(target);c.scale(1.25,1.25)
                c.rectangle(10,10,990,590);c.clip()
                c.set_source_surface(recording);c.paint()
                self.assertEqual(target.get_width(),1250)

    def test_effects_freeze_on_pause_and_do_not_consume_physics_randomness(self):
        g=Game(1000,600,seed=42,theme='omarchy');g.drop();g.step(.1)
        g.paused=True
        before,_=rasterize(g,'overlay');state=g.rng.getstate()
        g.step(.1)
        after,_=rasterize(g,'overlay')
        self.assertEqual(bytes(before.get_data()),bytes(after.get_data()))
        self.assertEqual(state,g.rng.getstate())

    def test_visual_halo_does_not_enlarge_click_target(self):
        from art import copter_rect
        from theme import yoke_rect
        g=Game(theme='omarchy')
        x,y,w,h=copter_rect(g)
        nx,ny,nw,nh=native_rect(g,'copter')
        self.assertLess(nx,x);self.assertLess(ny,y)
        region=cairo.Region(cairo.RectangleInt(x,y,w,h))
        self.assertFalse(region.contains_point(nx+2,ny+2))
        self.assertTrue(region.contains_point(x+2,y+2))
        self.assertEqual(yoke_rect(g),(400,4,43,43))
        g.theme='classic'
        self.assertEqual(yoke_rect(g),(66,4,43,43))

    def test_full_combat_sequence_stays_inside_overlay_bounds(self):
        from model import Jumper
        from rendering import frame_bounds
        g=Game(1000,600,seed=1)
        g.jumper=Jumper(500,g.deck-31);g.state='falling'
        states=set()
        for frame in range(650):
            g.step(1/60);states.add(g.state)
            if frame%13:continue
            expected=cairo.ImageSurface(cairo.FORMAT_ARGB32,1000,600)
            c=cairo.Context(expected);draw(c,g,'overlay')
            # Erase the allocated region: no effect should remain outside it.
            c.set_operator(cairo.OPERATOR_CLEAR);c.rectangle(*frame_bounds(g,'overlay'));c.fill()
            expected.flush()
            self.assertFalse(any(expected.get_data()),(frame,g.state))
            # Also replay each stage through Cairo's recording boundary.
            recorded=cairo.RecordingSurface(cairo.CONTENT_COLOR_ALPHA,None)
            paint_frame(cairo.Context(recorded),g,'overlay')
            c.set_operator(cairo.OPERATOR_OVER);c.set_source_surface(recorded);c.paint()
        self.assertTrue({'crashing','exploding','game_over'}<=states)

    def test_attackers_and_crashing_copter_are_click_through(self):
        from art import input_rects
        g=Game(theme='omarchy');g.combat.miss(g,200)
        def region():
            r=cairo.Region()
            for rect in input_rects(g):r.union(cairo.RectangleInt(*rect))
            return r
        self.assertFalse(region().contains_point(214,int(g.deck+30)))
        self.assertTrue(region().contains_point(int(g.copter_x),int(g.copter_y)))
        for _ in range(3):g.combat.hurt_ticks=0;g.combat.hit(g)
        self.assertFalse(region().contains_point(int(g.copter_x),int(g.copter_y)))

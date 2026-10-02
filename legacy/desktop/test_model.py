import unittest
from functools import partial
from model import Game as DesktopGame, Jumper, SCALE, HZ

# Isolate the source-game rules from the desktop's first-miss transformation.
Game=partial(DesktopGame,auto_omarchy=False)


class OriginalRulesTests(unittest.TestCase):
    def tick(self,g,count=1):
        for _ in range(count):g.step(1/HZ)

    def land(self,g,where):
        g.jumper=Jumper(g.cart_x+where*SCALE,g.deck-16*SCALE+1)
        g.state='falling';g.drop_height=131
        self.tick(g)
        return g.outcome

    def test_hay_driver_horse_and_ground_are_distinct(self):
        # Wagon advances one source pixel before collision, like Pascal.
        for where,expected in [(-7,'ground'),(-4,'hay'),(33,'hay'),(36,'driver'),(47,'horse'),(74,'ground')]:
            with self.subTest(where=where):self.assertEqual(self.land(Game(),where),expected)

    def test_height_times_level_score(self):
        g=Game();g.level=3
        self.land(g,15)
        self.assertEqual((g.score,g.best),(393,393))
        self.assertEqual(g.history,[True])

    def test_drop_blocks_until_result_animation_finishes(self):
        g=Game();self.land(g,15)
        self.assertFalse(g.drop());self.tick(g,44);self.assertFalse(g.drop())
        self.tick(g);self.assertTrue(g.drop())

    def test_five_perfect_landings_advance_level(self):
        g=Game()
        for _ in range(5):self.land(g,15);self.tick(g,45)
        self.assertEqual((g.level,g.wagon_step,g.gravity),(2,2,4))
        self.assertEqual(g.history,[])
        self.assertEqual(g.state,'ready')

    def test_miss_uses_one_of_five_attempts(self):
        g=Game();self.land(g,-20);self.tick(g,12)
        self.assertEqual(g.state,'ready');self.assertEqual(g.history,[False])
        for _ in range(4):self.land(g,15);self.tick(g,45)
        self.assertEqual(g.state,'game_over')
        self.assertFalse(g.drop())

    def test_horse_or_driver_ends_game_immediately(self):
        for where in (38,55):
            g=Game();self.land(g,where);self.tick(g,12)
            self.assertEqual(g.state,'game_over')
            self.assertEqual(len(g.history),1)

    def test_wagon_wraps_without_reversing(self):
        g=Game();g.cart_x=g.width
        self.tick(g)
        self.assertEqual(g.cart_x,-144)
        self.tick(g);self.assertEqual(g.cart_x,-142)

    def test_wagon_exits_completely_and_preserves_speed_at_every_level(self):
        for level in (1,2,3):
            g=Game();g.level=level;g.cart_x=g.width-145
            for _ in range(200):
                old=g.cart_x;self.tick(g)
                distance=(g.cart_x-old)%(g.width+146)
                self.assertEqual(distance,level*SCALE)
                if g.cart_x<old:
                    self.assertGreaterEqual(old+level*SCALE,g.width)
                    self.assertLessEqual(g.cart_x+146,level*SCALE)
                    break
            else:self.fail('Wagon did not wrap')

    def test_all_three_cloud_shapes_cycle_and_slow_the_man(self):
        from sprites_data import CLOUD_SPANS
        g=Game(seed=1)
        for index in range(3):
            self.assertEqual(g.cloud_index,index)
            g.cloud_x=100;g.cloud_y=100
            row=next(y for y,spans in enumerate(CLOUD_SPANS[index]) if spans and y>10)
            left,right=CLOUD_SPANS[index][row][0]
            x=g.cloud_x+(left+right)//2*SCALE
            g.jumper=Jumper(x,g.cloud_y+row*SCALE);g.state='falling'
            g.frame=0;y=g.jumper.y;self.tick(g)
            self.assertTrue(g.jumper.in_cloud)
            self.assertEqual(g.jumper.y-y,SCALE)
            g.state='ready';g.jumper=None
            g.cloud_x=-g.cloud_rect[2];g.frame=2;self.tick(g)
        self.assertEqual(g.cloud_index,0)

    def test_fall_has_fixed_speed_without_ballistic_acceleration(self):
        g=Game();g.cloud_enabled=False;g.drop();y=g.jumper.y
        self.tick(g,5)
        self.assertEqual(g.jumper.y-y,5*4*SCALE)

    def test_cloud_slows_and_jitters_then_normal_fall_resumes(self):
        g=Game(seed=2);g.cloud_x=300;g.cloud_y=200
        g.jumper=Jumper(400,240);g.state='falling'
        self.assertTrue(g.in_cloud(400,240))
        y=g.jumper.y;self.tick(g,5)
        self.assertEqual(g.jumper.y-y,5*SCALE)
        self.assertTrue(g.jumper.in_cloud)
        g.cloud_enabled=False;x,y=g.jumper.x,g.jumper.y
        self.tick(g,5)
        self.assertEqual(g.jumper.x,x)
        self.assertEqual(g.jumper.y-y,5*4*SCALE)

    def test_cloud_is_shape_aware(self):
        g=Game();g.cloud_x=100;g.cloud_y=100
        self.assertFalse(g.in_cloud(100,100))
        self.assertTrue(g.in_cloud(200,140))

    def test_yoke_accelerates_one_unit_per_frame(self):
        g=Game();g.set_yoke(1,0)
        self.tick(g);self.assertEqual(g.dh,1)
        self.tick(g,3);self.assertEqual(g.dh,4)
        g.set_yoke(-1,0);self.tick(g,8);self.assertEqual(g.dh,-4)

    def test_level_progression_matches_wagon_and_gravity_table(self):
        g=Game()
        for level,step,gravity in [(1,1,4),(2,2,4),(3,3,4),(4,3,3),(5,3,2),(6,3,1),(9,3,1)]:
            g.level=level;self.assertEqual((g.wagon_step,g.gravity),(step,gravity))

    def test_pause_freezes_cloud_wagon_and_man(self):
        g=Game();g.drop();g.paused=True
        before=(g.frame,g.cart_x,g.cloud_x,g.jumper.y)
        self.tick(g,60)
        self.assertEqual(before,(g.frame,g.cart_x,g.cloud_x,g.jumper.y))
        self.assertFalse(g.drop())

    def test_drag_after_release_does_not_steer_the_man(self):
        g=Game();g.drop();x=g.jumper.x
        g.move_copter(100,30)
        self.assertEqual(g.jumper.x,x)

    def test_frame_rate_independence(self):
        snapshots=[]
        for hz in (30,60,120):
            g=Game(seed=1);g.cloud_enabled=False;g.drop()
            for _ in range(hz):g.step(1/hz)
            snapshots.append((g.frame,g.cart_x,g.state,g.score,g.history))
        self.assertEqual(snapshots[0],snapshots[1]);self.assertEqual(snapshots[1],snapshots[2])


if __name__=='__main__':unittest.main()

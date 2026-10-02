import unittest
from model import Game, Jumper, HZ


class FirstMissTransitionTests(unittest.TestCase):
    def ticks(self,g,count):
        for _ in range(count):g.step(1/HZ)

    def land(self,g,offset):
        g.jumper=Jumper(g.cart_x+offset*2,g.deck-31)
        g.state='falling';g.drop_height=100
        self.ticks(g,1)

    def test_opens_in_classic_and_safe_landings_keep_original_graphics(self):
        g=Game()
        self.assertEqual(g.theme,'classic')
        self.land(g,15);self.ticks(g,45)
        self.assertEqual(g.theme,'classic')
        self.assertFalse(g.awakened)
        self.assertFalse(g.combat.shooters)

    def test_first_death_plays_original_splat_then_transforms(self):
        g=Game();g.score=g.best=300
        self.land(g,100)
        self.assertEqual(g.theme,'classic')
        self.assertTrue(g.awakening_pending)
        self.assertEqual(g.state,'result')
        self.assertFalse(g.combat.shooters)
        self.ticks(g,11)
        self.assertEqual(g.theme,'classic')
        self.ticks(g,1)
        self.assertEqual(g.theme,'omarchy')
        self.assertTrue(g.awakened)
        self.assertEqual(g.state,'ready')
        self.assertEqual(len(g.combat.shooters),1)
        self.assertEqual((g.score,g.best),(300,300))
        self.assertEqual(g.history,[False])
        self.assertFalse(g.combat.bullets)
        self.ticks(g,70)
        self.assertTrue(g.combat.bullets)

    def test_first_horse_or_driver_collision_also_transforms(self):
        for offset in (38,55):
            g=Game();self.land(g,offset);self.ticks(g,12)
            self.assertEqual(g.theme,'omarchy')
            self.assertEqual(g.state,'ready')
            self.assertEqual(len(g.combat.shooters),1)

    def test_first_death_on_fifth_jump_still_starts_retaliation(self):
        g=Game();g.history=[True]*4
        self.land(g,100);self.ticks(g,12)
        self.assertEqual((g.state,g.theme,g.level),('ready','omarchy',1))
        self.assertEqual(g.history,[])
        self.assertEqual(len(g.combat.shooters),1)

    def test_pause_delays_transformation(self):
        g=Game();self.land(g,100);g.paused=True
        self.ticks(g,60)
        self.assertEqual(g.theme,'classic')
        g.paused=False;self.ticks(g,12)
        self.assertEqual(g.theme,'omarchy')

    def test_reset_returns_to_original_with_high_score_and_no_attackers(self):
        g=Game();g.best=500;self.land(g,100);self.ticks(g,120)
        g=g.new_game()
        self.assertEqual(g.theme,'classic')
        self.assertFalse(g.awakened)
        self.assertFalse(g.awakening_pending)
        self.assertEqual(g.combat.hits,0)
        self.assertEqual(g.combat.shooters,[])
        self.assertEqual((g.score,g.best),(0,500))
        self.land(g,100);self.ticks(g,12)
        self.assertEqual(g.theme,'omarchy')

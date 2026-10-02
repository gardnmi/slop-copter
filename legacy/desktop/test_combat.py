import copy
import unittest
from combat import (Bullet, Shooter, FIRST_SHOT_TICKS, HIT_GRACE_TICKS,
                    CRASH_TICKS, EXPLOSION_TICKS, crosses_rect)
from model import Game, Jumper, HZ


class CombatTests(unittest.TestCase):
    def ticks(self,g,count):
        for _ in range(count):g.step(1/HZ)

    def miss(self,g):
        g.cart_x=20
        g.jumper=Jumper(g.width/2,g.deck-31)
        g.state='falling';g.drop_height=131
        self.ticks(g,1)

    def aim_at_body(self,g):
        return Bullet(g.copter_x+25,g.copter_y+65,0,-30)

    def test_miss_recovers_before_firing(self):
        g=Game(theme='omarchy');self.miss(g)
        self.assertEqual(len(g.combat.shooters),1)
        self.assertEqual(g.outcome,'ground')
        self.ticks(g,11)
        self.assertEqual(len(g.combat.bullets),0)
        self.ticks(g,1)
        self.assertEqual(g.state,'ready')
        self.ticks(g,FIRST_SHOT_TICKS-14)
        self.assertFalse(g.combat.bullets)
        self.ticks(g,1)
        self.assertEqual(len(g.combat.bullets),1)
        self.assertGreater(g.combat.shooters[0].flash,0)

    def test_classic_misses_never_spawn_attackers_or_take_damage(self):
        g=Game(auto_omarchy=False);self.miss(g)
        self.assertFalse(g.combat.shooters)
        self.assertFalse(g.combat.hit(g))
        g.combat.bullets.append(self.aim_at_body(g))
        self.ticks(g,10)
        self.assertEqual(g.combat.hits,0)

    def test_each_omarchy_miss_including_horse_and_driver_spawns_a_man(self):
        for offset in (38,55,100):
            g=Game(theme='omarchy');g.cart_x=100
            g.jumper=Jumper(g.cart_x+offset*2,g.deck-31);g.state='falling'
            self.ticks(g,13)
            self.assertEqual(g.state,'ready')
            self.assertEqual(len(g.combat.shooters),1)

    def test_failed_omarchy_round_continues_with_existing_damage_and_shooters(self):
        g=Game(theme='omarchy');g.combat.hit(g)
        for _ in range(5):self.miss(g);self.ticks(g,12)
        self.assertEqual(g.state,'ready')
        self.assertEqual(g.history,[])
        self.assertEqual(g.level,1)
        self.assertEqual(g.combat.hits,1)
        self.assertEqual(len(g.combat.shooters),5)

    def test_good_omarchy_round_advances_level(self):
        g=Game(theme='omarchy')
        for _ in range(5):
            g.jumper=Jumper(g.cart_x+30,g.deck-31);g.state='falling'
            self.ticks(g,46)
        self.assertEqual(g.level,2)
        self.assertEqual(g.combat.shooters,[])

    def test_stationary_copter_is_hit_by_real_shots_and_finishes_crash(self):
        g=Game(theme='omarchy');self.miss(g)
        states=set();angles=set()
        for _ in range(900):
            self.ticks(g,1);states.add(g.state)
            if g.state=='crashing':angles.add(round(g.combat.angle,2))
            if g.state=='game_over':break
        self.assertEqual(g.combat.hits,3)
        self.assertTrue({'crashing','exploding','game_over'}<=states)
        self.assertGreater(len(angles),70)
        self.assertFalse(g.combat.bullets)
        self.assertEqual(g.combat.explosion_tick,EXPLOSION_TICKS)

    def test_shot_keeps_its_aim_and_can_be_dodged(self):
        g=Game(theme='omarchy')
        g.combat.shooters=[Shooter(g.copter_x,age=FIRST_SHOT_TICKS)]
        self.ticks(g,1)
        shot=g.combat.bullets[0];velocity=(shot.vx,shot.vy)
        g.combat.shooters.clear()
        g.move_copter(100,30)
        self.ticks(g,50)
        self.assertEqual((shot.vx,shot.vy),velocity)
        self.assertEqual(g.combat.hits,0)

    def test_swept_collision_and_grace_prevent_instant_three_hit_kill(self):
        self.assertTrue(crosses_rect(50,0,50,200,(20,70,60,25)))
        self.assertFalse(crosses_rect(10,0,10,200,(20,70,60,25)))
        g=Game(theme='omarchy')
        g.combat.bullets=[self.aim_at_body(g) for _ in range(3)]
        self.ticks(g,1)
        self.assertEqual(g.combat.hits,1)
        self.assertEqual(g.combat.bullets,[])
        self.ticks(g,HIT_GRACE_TICKS)
        g.combat.bullets=[self.aim_at_body(g)]
        self.ticks(g,1)
        self.assertEqual(g.combat.hits,2)
        self.ticks(g,6)
        self.assertTrue(g.combat.smoke)

    def test_three_hits_lock_flight_drop_and_theme_until_crash_finishes(self):
        g=Game(theme='omarchy')
        for _ in range(3):
            g.combat.hurt_ticks=0;self.assertTrue(g.combat.hit(g))
        self.assertEqual(g.state,'crashing')
        position=(g.copter_x,g.copter_y)
        g.move_copter(100,20);g.set_yoke(1,-1)
        self.assertEqual((g.copter_x,g.copter_y),position)
        self.assertEqual((g.control_x,g.control_y),(0,0))
        self.assertFalse(g.drop());self.assertFalse(g.set_theme('classic'))
        self.ticks(g,CRASH_TICKS+EXPLOSION_TICKS)
        self.assertEqual(g.state,'game_over')

    def test_pause_freezes_every_combat_entity_and_death_animation(self):
        g=Game(theme='omarchy');self.miss(g);self.ticks(g,110)
        g.paused=True
        before=copy.deepcopy(g.combat.__dict__)
        self.ticks(g,100)
        self.assertEqual(g.combat.__dict__,before)
        g.paused=False
        for _ in range(3):g.combat.hurt_ticks=0;g.combat.hit(g)
        self.ticks(g,12);g.paused=True
        snapshot=(g.copter_x,g.copter_y,g.combat.crash_tick,g.combat.angle)
        self.ticks(g,90)
        self.assertEqual((g.copter_x,g.copter_y,g.combat.crash_tick,g.combat.angle),snapshot)

    def test_switching_to_classic_suspends_retaliation(self):
        g=Game(theme='omarchy');self.miss(g);self.ticks(g,110)
        g.set_theme('classic');before=copy.deepcopy(g.combat.__dict__)
        self.ticks(g,60)
        self.assertEqual(g.combat.__dict__,before)
        g.set_theme('omarchy');self.ticks(g,1)
        self.assertNotEqual(g.combat.__dict__,before)

    def test_new_game_clears_damage_shooters_bullets_and_smoke(self):
        g=Game(theme='omarchy');self.miss(g);self.ticks(g,110)
        replacement=g.new_game()
        self.assertEqual(replacement.combat.hits,0)
        self.assertEqual(replacement.combat.shooters,[])
        self.assertEqual(replacement.combat.bullets,[])
        self.assertEqual(replacement.combat.smoke,[])

    def test_fixed_tick_combat_is_frame_rate_independent(self):
        snapshots=[]
        for hz in (30,60,120):
            g=Game(seed=1,theme='omarchy');self.miss(g)
            for _ in range(hz*5):g.step(1/hz)
            snapshots.append((g.state,g.combat.hits,g.combat.crash_tick,g.combat.shooters,
                              g.combat.bullets,g.combat.smoke))
        self.assertEqual(snapshots[0],snapshots[1]);self.assertEqual(snapshots[1],snapshots[2])

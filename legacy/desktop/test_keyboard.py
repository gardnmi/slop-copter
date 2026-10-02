import unittest
from keyboard import Keyboard
from model import Game, HZ


class KeyboardTests(unittest.TestCase):
    def test_opposing_arrows_and_release(self):
        g=Game();k=Keyboard()
        k.press('right',g);self.assertEqual(g.control_x,4)
        k.press('left',g);self.assertEqual(g.control_x,0)
        k.release('left',g);self.assertEqual(g.control_x,4)
        k.press('up',g);self.assertEqual(g.control_y,-3)
        k.clear(g)
        self.assertEqual((g.control_x,g.control_y,g.dh,g.dv),(0,0,0,0))

    def test_focus_loss_stops_motion_and_releases_keys(self):
        g=Game();k=Keyboard();k.press('right',g)
        g.step(1/HZ);x=g.copter_x
        k.clear(g);g.step(1/HZ)
        self.assertEqual(g.copter_x,x)
        k.press('right',g);self.assertEqual(g.control_x,4)

    def test_space_autorepeat_cannot_drop_next_man(self):
        g=Game();k=Keyboard();k.press('space',g)
        self.assertEqual(g.drops,1)
        g.state='ready';g.jumper=None
        k.press('space',g);self.assertEqual(g.drops,1)
        k.release('space',g);k.press('space',g)
        self.assertEqual(g.drops,2)

    def test_paused_space_does_not_drop(self):
        g=Game();g.paused=True;k=Keyboard();k.press('space',g)
        self.assertEqual(g.drops,0)

    def test_shortcuts_and_unhandled_meeting_keys(self):
        g=Game();k=Keyboard()
        self.assertEqual(k.press('t',g),'theme')
        self.assertEqual(k.press('t',g),'handled')
        self.assertEqual(k.press('escape',g),'pause')
        self.assertIsNone(k.press('a',g))

import unittest

import cairo

from art import copter_rect, draw, hud_rect, piece_rect
from model import Game
from sprites import sheet


class OverlayTests(unittest.TestCase):
    def test_empty_desktop_is_transparent(self):
        game = Game(1000, 600)
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, 1000, 600)
        draw(cairo.Context(surface), game)
        surface.flush()
        data = surface.get_data()
        # Transparent pixels contain four zero bytes regardless of endianness.
        for x, y in [(10, 10), (500, 30), (100, 200)]:
            offset = y * surface.get_stride() + x * 4
            self.assertEqual(bytes(data[offset:offset + 4]), bytes(4))
        offset = int(game.copter_y) * surface.get_stride() + int(game.copter_x) * 4
        self.assertNotEqual(bytes(data[offset:offset + 4]), bytes(4))

    def test_input_is_limited_to_copter_and_controls(self):
        game = Game(1920, 1080)
        region = cairo.Region()
        for rect in (copter_rect(game), hud_rect(game)):
            region.union(cairo.RectangleInt(*rect))
        self.assertTrue(region.contains_point(int(game.copter_x), int(game.copter_y)))
        self.assertFalse(region.contains_point(10, 10))
        self.assertFalse(region.contains_point(int(game.cart_x), int(game.deck)))

    def test_each_piece_has_opaque_white_background(self):
        game = Game(1000, 600)
        for role in ('copter', 'cart', 'cloud'):
            x, y, w, h = piece_rect(game, role)
            surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
            c = cairo.Context(surface)
            c.translate(-x, -y)
            draw(c, game, role)
            surface.flush()
            offset = (h - 5) * surface.get_stride() + 5 * 4
            self.assertEqual(bytes(surface.get_data()[offset:offset + 4]), bytes([255] * 4))

    def test_helicopter_preserves_every_original_pixel_at_double_scale(self):
        game = Game(1000, 600)
        x, y, w, h = piece_rect(game, 'copter')
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
        c = cairo.Context(surface)
        c.translate(-x, -y)
        draw(c, game, 'copter')
        surface.flush()
        original = sheet('copter-wagon')
        original.flush()
        target, source = surface.get_data(), original.get_data()
        # The hanging man starts on source row 23, below the helicopter body.
        for py in range(23):
            for px in range(74):
                expected = bytes(source[py*original.get_stride()+px*4:py*original.get_stride()+px*4+3])
                for dy in (0, 1):
                    for dx in (0, 1):
                        offset = (py*2+dy)*surface.get_stride()+(px*2+dx)*4
                        self.assertEqual(bytes(target[offset:offset+3]), expected)

    def test_wrapping_wagon_surface_is_clipped_to_monitor(self):
        game = Game()
        game.cart_x = -60
        self.assertEqual(piece_rect(game, 'cart'), (0, game.deck, 86, 44))
        game.cart_x = game.width - 20
        self.assertEqual(piece_rect(game, 'cart'), (game.width-20, game.deck, 20, 44))


if __name__ == '__main__':
    unittest.main()

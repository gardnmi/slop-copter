#!/usr/bin/env python3
"""Stunt Copter sprites living directly on a Wayland desktop."""
import argparse
from ctypes import CDLL
import json
from pathlib import Path
import signal
import subprocess
import time

import cairo

from art import copter_rect, draw, hud_rect, native_rect, input_rects
from model import Game
from render_checks import stress_scene
from rendering import paint_frame
from keyboard import Keyboard
from theme import yoke_rect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--theme', choices=('classic', 'omarchy'), default='classic')
    parser.add_argument('--preview', type=Path, help='Render a transparent PNG without a desktop')
    parser.add_argument('--smoke-test', action='store_true', help='Check the live overlay, then exit')
    parser.add_argument('--combat-smoke-test', action='store_true', help='Play the first-miss transformation and crash for 12 seconds, check, then exit')
    parser.add_argument('--stress-test', action='store_true', help='Exercise native rendering for 20 seconds, then exit')
    args = parser.parse_args()
    if args.stress_test:
        import resource
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if args.preview:
        game = Game(1000, 600, theme=args.theme)
        game.drop()
        for _ in range(30):
            game.step(1 / 60)
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, 1000, 600)
        draw(cairo.Context(surface), game)
        surface.write_to_png(str(args.preview))
        return

    # Load before GTK for gtk4-layer-shell's Wayland interception.
    CDLL('libgtk4-layer-shell.so')
    import gi
    gi.require_version('Gtk', '4.0')
    gi.require_version('Gdk', '4.0')
    gi.require_version('Gtk4LayerShell', '1.0')
    gi.require_version('GLibUnix', '2.0')
    from gi.repository import Gtk, Gdk, GLib, GLibUnix, Gtk4LayerShell as Layer

    class App(Gtk.Application):
        def __init__(self):
            super().__init__(application_id=None)
            self.sources = []
            self.pieces = {}
            self.closed = False
            self.error = None
            self.window = None
            self.dragging = False
            self.keyboard = Keyboard()
            self.keyboard_active = False
            self.region = None
            self.last = time.monotonic()
            self.stress_frame = 0
            self.combat_states = set()
            self.combat_themes = set()

        def do_activate(self):
            try:
                self.begin()
            except Exception as exc:
                self.error = exc
                self.close()

        def begin(self):
            if not Layer.is_supported():
                raise RuntimeError('A Wayland compositor supporting layer-shell is required.')
            self.window = Gtk.Window(application=self)
            self.window.set_title('Stunt Copter Desktop')
            self.window.set_decorated(False)
            Layer.init_for_window(self.window)
            Layer.set_namespace(self.window, 'stunt-copter-desktop')
            Layer.set_layer(self.window, Layer.Layer.OVERLAY)
            Layer.set_keyboard_mode(self.window, Layer.KeyboardMode.ON_DEMAND)
            Layer.set_exclusive_zone(self.window, -1)
            monitors = Gdk.Display.get_default().get_monitors()
            monitor = monitors.get_item(0)
            try:
                data = json.loads(subprocess.check_output(['hyprctl', '-j', 'monitors'], timeout=2))
                connector = next(m['name'] for m in data if m['focused'])
                for i in range(monitors.get_n_items()):
                    candidate = monitors.get_item(i)
                    if candidate.get_connector() == connector:
                        monitor = candidate
                        break
            except (OSError, ValueError, StopIteration, subprocess.SubprocessError):
                pass
            Layer.set_monitor(self.window, monitor)
            for edge in (Layer.Edge.TOP, Layer.Edge.BOTTOM, Layer.Edge.LEFT, Layer.Edge.RIGHT):
                Layer.set_anchor(self.window, edge, True)
            geometry = monitor.get_geometry()
            self.game = Game(geometry.width, geometry.height, theme=args.theme)
            if args.combat_smoke_test:
                self.game = Game(geometry.width, geometry.height)
                self.game.cloud_enabled = False
                self.game.drop()
            css = Gtk.CssProvider()
            css.load_from_data(b'window, drawingarea { background: transparent; }')
            Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
            self.area = Gtk.DrawingArea()
            self.area.set_draw_func(lambda area, c, w, h: paint_frame(c, self.game, "overlay"))
            self.area.set_focusable(True)
            self.area.connect('resize', self.resize)
            self.window.set_child(self.area)
            self.window.connect('realize', lambda *_: self.update_region())
            self.window.connect('close-request', lambda *_: self.close() or True)
            keys = Gtk.EventControllerKey.new()
            keys.connect('key-pressed', self.key_pressed)
            keys.connect('key-released', self.key_released)
            self.window.add_controller(keys)
            focus = Gtk.EventControllerFocus.new()
            focus.connect('leave', self.focus_left)
            self.window.add_controller(focus)
            self.window.connect('notify::is-active', self.active_changed)
            drag = Gtk.GestureDrag.new()
            drag.set_button(1)
            drag.connect('drag-begin', self.drag_begin)
            drag.connect('drag-update', self.drag_update)
            drag.connect('drag-end', self.drag_end)
            self.area.add_controller(drag)
            right = Gtk.GestureClick.new()
            right.set_button(3)
            right.connect('released', self.right_click)
            self.area.add_controller(right)
            for role in ('copter', 'cart', 'cloud'):
                win = Gtk.Window(application=self)
                win.set_decorated(False)
                win.set_title('Stunt Copter - ' + role)
                Layer.init_for_window(win)
                Layer.set_namespace(win, 'stunt-copter-' + role)
                Layer.set_layer(win, Layer.Layer.OVERLAY)
                Layer.set_keyboard_mode(win, Layer.KeyboardMode.NONE)
                Layer.set_exclusive_zone(win, -1)
                Layer.set_monitor(win, monitor)
                Layer.set_anchor(win, Layer.Edge.TOP, True)
                Layer.set_anchor(win, Layer.Edge.LEFT, True)
                area = Gtk.DrawingArea()
                area.set_draw_func(self.draw_piece, role)
                win.set_child(area)
                win.connect('realize', lambda w: w.get_surface().set_input_region(cairo.Region()))
                win.connect('close-request', lambda *_: self.close() or True)
                self.pieces[role] = (win, area)
            self.sync_pieces()
            for win, area in self.pieces.values():
                win.present()
            # This final transparent surface handles screen-coordinate drags,
            # so moving the copter's native surface cannot disturb drag offsets.
            self.window.present()
            self.sources.append(GLib.timeout_add(16, self.tick))
            for sig in (signal.SIGINT, signal.SIGTERM):
                self.sources.append(GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, sig, self.close))
            if args.smoke_test or args.stress_test or args.combat_smoke_test:
                duration=12000 if args.combat_smoke_test else 20000 if args.stress_test else 2000
                self.sources.append(GLib.timeout_add(duration, self.smoke))

        def draw_piece(self, area, c, width, height, role):
            x, y, _, _ = native_rect(self.game, role)
            c.save()
            c.translate(-x, -y)
            paint_frame(c, self.game, role)
            c.restore()

        def sync_pieces(self):
            for role, (win, area) in self.pieces.items():
                x, y, w, h = native_rect(self.game, role)
                win.set_default_size(w, h)
                Layer.set_margin(win, Layer.Edge.LEFT, max(0, x))
                Layer.set_margin(win, Layer.Edge.TOP, max(0, y))
                area.queue_draw()

        def resize(self, area, width, height):
            if width <= 0 or height <= 0:
                return
            self.game.width, self.game.height = width, height
            self.game.deck = height - 192
            self.game.move_copter(self.game.copter_x, self.game.copter_y)

            self.update_region()

        def update_region(self):
            if not self.window or not self.window.get_surface():
                return
            region = cairo.Region()
            for rect in input_rects(self.game):
                region.union(cairo.RectangleInt(*rect))
            self.region = region
            self.window.get_surface().set_input_region(region)

        def drag_begin(self, gesture, x, y):
            self.origin = (x, y)
            self.start_copter = (self.game.copter_x, self.game.copter_y)
            cx, cy, cw, ch = copter_rect(self.game)
            self.dragging = self.game.can_fly and cx <= x < cx + cw and cy <= y < cy + ch
            self.activating_keyboard = self.dragging and not self.keyboard_active
            if self.dragging:
                self.keyboard_active = True
                self.area.grab_focus()
                self.game.message = 'ARROWS: fly  SPACE: drop  T: theme  P: pause'
            hx, hy, hw, hh = hud_rect(self.game)
            ux, uy = (x-hx)*512/hw, (y-hy)*64/hh
            yx,yy,yw,yh=yoke_rect(self.game)
            self.yoking = yx <= ux <= yx+yw and yy <= uy <= yy+yh
            if self.yoking:
                self.yoke_at(x, y)
            self.moved = False

        def yoke_at(self, x, y):
            hx, hy, hw, hh = hud_rect(self.game)
            yx,yy,yw,yh=yoke_rect(self.game)
            self.game.set_yoke(((x-hx)*512/hw-yx-yw/2)/(yw/2),
                               ((y-hy)*64/hh-yy-yh/2)/(yh/2))

        def drag_update(self, gesture, dx, dy):
            if self.yoking:
                self.yoke_at(self.origin[0]+dx, self.origin[1]+dy)
            elif self.dragging and (self.moved or abs(dx) + abs(dy) > 5):
                self.moved = True
                self.game.move_copter(self.start_copter[0] + dx, self.start_copter[1] + dy)
                self.update_region()
                self.sync_pieces()
                self.area.queue_draw()

        def drag_end(self, gesture, dx, dy):
            if self.yoking:
                self.game.set_yoke(0, 0)
            elif self.dragging:
                if not self.moved and not self.activating_keyboard:
                    if self.game.paused:
                        self.game.paused = False
                    else:
                        self.game.drop()
            else:
                x, y = self.origin
                hx, hy, hw, hh = hud_rect(self.game)
                if hy <= y <= hy + hh and hx <= x <= hx + hw:
                    offset = (x - hx) * 512 / hw
                    row = (y - hy) * 64 / hh
                    if row >= 52:
                        if offset >= 458:
                            self.close()
                        elif offset >= 404:
                            self.reset()
                        elif offset >= 350:
                            self.pause()
                        elif offset >= 245:
                            self.toggle_theme()
            self.dragging = False
            if not self.closed:
                self.update_region()
                self.sync_pieces()
                self.area.queue_draw()

        def key_pressed(self, controller, keyval, keycode, modifiers):
            if not self.keyboard_active:
                return False
            action = self.keyboard.press(Gdk.keyval_name(keyval).lower(), self.game)
            if action == 'pause':
                self.pause()
            elif action == 'reset':
                self.reset()
            elif action == 'theme':
                self.toggle_theme()
            self.area.queue_draw()
            return action is not None

        def key_released(self, controller, keyval, keycode, modifiers):
            self.keyboard.release(Gdk.keyval_name(keyval).lower(), self.game)

        def focus_left(self, *_):
            self.keyboard_active = False
            self.keyboard.clear(self.game)

        def active_changed(self, window, *_):
            if not window.is_active():
                self.focus_left()

        def reset(self):
            self.keyboard.clear(self.game)
            self.game = self.game.new_game()
            self.update_region()
            self.sync_pieces()
            self.area.queue_draw()

        def toggle_theme(self):
            self.game.set_theme('omarchy' if self.game.theme == 'classic' else 'classic')
            self.sync_pieces()
            self.area.queue_draw()

        def right_click(self, gesture, count, x, y):
            hx, hy, hw, hh = hud_rect(self.game)
            yx,yy,yw,yh=yoke_rect(self.game)
            if yx <= (x-hx)*512/hw <= yx+yw and yy <= (y-hy)*64/hh <= yy+yh:
                self.game.drop()
            else:
                self.pause()

        def pause(self):
            if self.game.state == 'game_over':
                self.reset()
                return
            self.game.paused = not self.game.paused
            self.keyboard.clear(self.game)
            self.sync_pieces()
            self.area.queue_draw()

        def tick(self):
            now = time.monotonic()
            dt = min(0.05, now - self.last)
            self.last = now
            if args.stress_test:
                self.stress_frame += 1
                self.game = stress_scene(self.stress_frame, self.game.width, self.game.height, self.game.theme)
            if not self.game.paused and self.game.state != 'game_over':
                self.game.step(dt)
                if args.combat_smoke_test:
                    self.combat_states.add(self.game.state)
                    self.combat_themes.add(self.game.theme)
                self.update_region()
                self.sync_pieces()
                self.area.queue_draw()
            return True

        def smoke(self):
            try:
                assert Layer.is_layer_window(self.window)
                assert Layer.get_keyboard_mode(self.window) == Layer.KeyboardMode.ON_DEMAND
                assert self.window.get_mapped()
                if self.game.can_fly:
                    assert self.region.contains_point(int(self.game.copter_x), int(self.game.copter_y))
                assert not self.region.contains_point(10, 10), 'Empty desktop must be click-through'
                assert not self.region.contains_point(int(self.game.cart_x), int(self.game.deck)), 'Cart must be click-through'
                assert len(self.pieces) == 3
                for win, area in self.pieces.values():
                    assert win.get_mapped() and Layer.is_layer_window(win)
                    assert Layer.get_keyboard_mode(win) == Layer.KeyboardMode.NONE
                if args.combat_smoke_test:
                    assert self.combat_themes=={'classic','omarchy'}, self.combat_themes
                    assert {'falling','result','ready','crashing','exploding','game_over'}<=self.combat_states, self.combat_states
                    assert self.game.combat.hits==3
                    assert len(self.game.combat.shooters)==1
                    print('Combat smoke test: original start, first-death transformation, shooter, three hits, spin, explosion, game over.')
                print('Smoke test: three native pieces plus rasterized overlay; click-to-focus keyboard; empty space click-through.')
            except Exception as exc:
                self.error = exc
            self.close()
            return False

        def close(self, *_):
            if self.closed:
                return False
            self.closed = True
            for source in self.sources:
                GLib.source_remove(source)
            self.sources.clear()
            for win, area in self.pieces.values():
                win.destroy()
            self.pieces.clear()
            if self.window:
                self.window.destroy()
            self.quit()
            return False

    app = App()
    try:
        app.run([])
    finally:
        app.close()
    if app.error:
        raise app.error


if __name__ == '__main__':
    main()

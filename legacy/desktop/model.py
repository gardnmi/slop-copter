"""Desktop adaptation of the original StuntCopter Pascal animation rules.

Original motion is discrete pixels per loop, not ballistic acceleration.
Coordinates here are desktop pixels; artwork and original steps use SCALE=2.
"""
from dataclasses import dataclass
import random
from combat import Combat

WIDTH, HEIGHT = 1024, 768
SCALE = 2
HZ = 60
CLOUD_SIZES = ((119, 44), (210, 45), (140, 73))


@dataclass
class Jumper:
    x: float  # top-left of the original 14x16 sprite
    y: float
    in_cloud: bool = False


class Game:
    def __init__(self, width=WIDTH, height=HEIGHT, seed=None, theme='classic', auto_omarchy=True):
        self.width, self.height = width, height
        self.theme = theme
        self.auto_omarchy = auto_omarchy
        self.awakened = theme=='omarchy'
        self.awakening_pending = False
        self.deck = height - 192  # top of the 73x22 wagon sprite
        self.copter_x = width / 2
        self.copter_y = max(12, self.deck - 270)
        self.cart_x = 40.0
        self.cloud_index = 0
        self.cloud_x = width * 0.68  # left edge, desktop adaptation starts it visible
        self.cloud_y = max(30, self.copter_y + 100)
        self.cloud_enabled = True
        self.rng = random.Random(seed)
        self.jumper = None
        self.score = self.best = self.catches = self.drops = 0
        self.level = 1
        self.history = []
        self.state = 'ready'
        self.outcome = None
        self.effect_tick = 0
        self.frame = 0
        self.time = self.accumulator = 0.0
        self.paused = False
        self.message = 'Click copter: arrows + SPACE'
        self.drop_height = 0
        self.control_x = self.control_y = 0
        self.dh = self.dv = 0
        self.combat = Combat()

    @property
    def can_fly(self):
        return self.state not in ('crashing','exploding','game_over')

    def set_theme(self,theme):
        # Finish a fatal hit visibly; switching skins cannot skip the crash.
        if self.state in ('crashing','exploding'):return False
        self.theme=theme
        if theme=='omarchy':self.awakened=True
        return True

    def new_game(self):
        game=Game(self.width,self.height,auto_omarchy=self.auto_omarchy)
        game.best=self.best
        return game

    @property
    def height_of_drop(self):
        return max(0, int((self.deck + 22*SCALE - self.copter_y - 26*SCALE)/SCALE))

    @property
    def wagon_step(self):
        return min(3, self.level)

    @property
    def gravity(self):
        return max(1, 4 - max(0, self.level - 3))

    @property
    def speed(self):
        return self.wagon_step * SCALE * HZ

    @property
    def cloud_rect(self):
        w, h = CLOUD_SIZES[self.cloud_index]
        return self.cloud_x, self.cloud_y, w*SCALE, h*SCALE

    def move_copter(self, x, y):
        if not self.can_fly:return
        self.copter_x = max(36*SCALE, min(self.width-38*SCALE, x))
        self.copter_y = max(8, min(self.deck-40*SCALE, y))
        self.dh = self.dv = 0

    def set_yoke(self, x, y):
        if not self.can_fly:
            self.control_x=self.control_y=0
            return
        self.control_x = max(-4, min(4, round(x*4)))
        self.control_y = max(-3, min(4, round(y*(3 if y < 0 else 4))))

    def drop(self):
        if self.paused or self.state != 'ready':
            return False
        self.jumper = Jumper(self.copter_x, self.copter_y + 23*SCALE)
        self.drop_height = self.height_of_drop
        self.drops += 1
        self.state = 'falling'
        return True

    def step(self, dt):
        if self.paused:
            return
        self.accumulator += max(0, min(dt, .1))
        while self.accumulator + 1e-9 >= 1/HZ:
            self.accumulator -= 1/HZ
            self._tick()

    def _tick(self):
        self.frame += 1
        self.time = self.frame/HZ
        if self.state == 'game_over':
            return
        if self.state in ('crashing','exploding'):
            self.combat.tick(self)
            return
        for velocity, target in (('dh', self.control_x), ('dv', self.control_y)):
            value = getattr(self, velocity)
            setattr(self, velocity, value + (target > value) - (target < value))
        self.copter_x += self.dh*SCALE
        self.copter_y = max(8, min(self.deck-80, self.copter_y+self.dv*SCALE))
        if self.copter_x-72 > self.width:
            self.copter_x = -76
        elif self.copter_x+76 < 0:
            self.copter_x = self.width+72
        # Wagon never reverses. It exits right and returns from the left.
        self.cart_x += self.wagon_step*SCALE
        if self.cart_x >= self.width:
            self.cart_x -= self.width + 73*SCALE
        if self.frame % 3 == 0:
            self.cloud_x -= SCALE
            if self.cloud_x + self.cloud_rect[2] < 0:
                self.cloud_index = (self.cloud_index+1) % 3
                self.cloud_x = self.width
                self.cloud_y = self.rng.randrange(0, max(1, int(min(128*SCALE, self.deck-150))))
        if self.state == 'falling':
            j = self.jumper
            if j.y + 16*SCALE > self.deck:
                self._land()
            else:
                j.in_cloud = self.cloud_enabled and self.in_cloud(j.x, j.y)
                if j.in_cloud:
                    # Pascal Random div 10924: symmetric integer jitter, no inertia.
                    j.x += int(self.rng.randint(-32768, 32767)/10924)*SCALE
                    j.y += SCALE
                else:
                    j.y += self.gravity*SCALE
        elif self.state == 'result':
            self.effect_tick += 1
            if self.effect_tick >= (45 if self.outcome == 'hay' else 12):
                self._next_attempt()
        if self.theme=='omarchy':self.combat.tick(self)

    def in_cloud(self, x, y):
        # Per-row spans are decoded from the original QuickDraw cloud regions.
        from sprites_data import CLOUD_SPANS
        lx, ly = int((x-self.cloud_x)/SCALE), int((y-self.cloud_y)/SCALE)
        if x < self.cloud_x or y < self.cloud_y:
            return False
        rows = CLOUD_SPANS[self.cloud_index]
        return 0 <= ly < len(rows) and any(left <= lx <= right for left, right in rows[ly])

    def _land(self):
        where = (self.jumper.x-self.cart_x)/SCALE
        self.outcome = ('ground' if where < -6 or where > 70 else
                        'hay' if where < 34 else 'driver' if where < 45 else 'horse')
        success = self.outcome == 'hay'
        self.history.append(success)
        self.effect_tick = 0
        self.state = 'result'
        if success:
            points = self.level*self.drop_height
            self.score += points
            self.best = max(self.best, self.score)
            self.catches += 1
            self.message = f'Safe landing! {self.drop_height} x level {self.level} = {points}'
        else:
            if self.theme=='omarchy':
                self.combat.miss(self,self.jumper.x)
                self.message='Miss! He is getting up. Watch out!'
            elif self.auto_omarchy and not self.awakened:
                self.awakening_pending=True
                self.message='That did not go well...'
            else:
                self.message = {'ground':'Missed the wagon.', 'horse':'You hit the horse. Game over.',
                                'driver':'You hit the driver. Game over.'}[self.outcome]
        # Splat at ground level or on the horse/driver, as in the source.
        self.jumper.y = self.deck + (6 if self.outcome == 'ground' else -7)*SCALE

    def _next_attempt(self):
        if self.awakening_pending:
            self.theme='omarchy'
            self.awakened=True
            self.awakening_pending=False
            self.combat.miss(self,self.jumper.x)
            # His original monochrome splat has already played for 12 ticks.
            self.combat.shooters[-1].age=12
            self.message='He is getting back up. DODGE!'
        self.jumper = None
        if self.theme=='omarchy' and len(self.history)==5:
            if all(self.history):
                self.level+=1
                self.message=f'LEVEL {self.level} — keep dodging!'
            else:self.message='New round. Dodge the angry stuntmen!'
            self.history.clear()
            self.state='ready'
        elif self.theme=='omarchy':
            self.state='ready'
        elif self.outcome in ('horse', 'driver') or (len(self.history) == 5 and not all(self.history)):
            self.state = 'game_over'
            self.control_x = self.control_y = self.dh = self.dv = 0
            self.message = 'Game over. Click BEGIN to try again.'
        elif len(self.history) == 5:
            self.level += 1
            self.history.clear()
            self.state = 'ready'
            self.message = f'LEVEL {self.level}'
        else:
            self.state = 'ready'

// Finer, one-world-pixel metalwork within the same 32-pixel standing height.
// Rendering resolution increases; the character and combat geometry do not.
export const CREW_SHOULDER_HEIGHT = 20;
export const CREW_BARREL_LENGTH = 14;
export const CREW_STAND_TICKS = 42;
const PIXEL_SCALE = 1, CENTER_X = 36, GROUND_Y = 48;

function facingOf(shooter) { return shooter.facing ?? (shooter.aimX < 0 ? -1 : 1); }

export function crewShoulder(shooter, ground) {
  return { x: shooter.x + facingOf(shooter) * 6, y: ground - CREW_SHOULDER_HEIGHT };
}

export function crewMuzzle(shooter, ground) {
  const shoulder = crewShoulder(shooter, ground);
  return { x: shoulder.x + shooter.aimX * CREW_BARREL_LENGTH, y: shoulder.y + shooter.aimY * CREW_BARREL_LENGTH };
}

const skull = [
  '..smmmms..',
  '.smhhhhms.',
  'smhmmmmmms',
  'shXXmmXXms',
  'sXrrXXrrXs',
  '.smXmmXms.',
  '..hshhsh..',
  '...shhs...',
];
const ribs = [
  'shhhhhmmsd',
  'shmmmmsmsd',
  'smmmXXmmms',
  'smhhhhhhms',
  'smXXmmXXms',
  'smhhhhhhms',
  '.smXmmXms.',
  '..smmmms..',
];
const colors = {
  X: '#091017', d: '#24343d', s: '#455d68', m: '#8c9fa7',
  h: '#c4d2d5', H: '#e4eeec', r: '#ff344b',
};

function block(c, x, y, w, h, color) {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h);
}

function stamp(c, rows, left, top) {
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (colors[pixel]) block(c, left + x, top + y, 1, 1, colors[pixel]);
  }));
}

// A metal piston stays crisp, including when aimed diagonally.
function stroke(c, [x0, y0], [x1, y1], color, width = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  c.fillStyle = color;
  for (;;) {
    c.fillRect(x0 - Math.floor(width / 2), y0 - Math.floor(width / 2), width, width);
    if (x0 === x1 && y0 === y1) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
}

export class CrewRenderer {
  constructor() {
    this.layer = document.createElement('canvas');
    this.layer.width = 72; this.layer.height = 56;
    this.c = this.layer.getContext('2d');
    this.sprites = new Map();
  }

  sprite(pose) {
    if (this.sprites.has(pose)) return this.sprites.get(pose);
    const sprite = document.createElement('canvas');
    sprite.width = 24; sprite.height = { standing: 32, kneeling: 26, prone: 12 }[pose];
    const c = sprite.getContext('2d');
    if (pose === 'prone') {
      stamp(c, skull, 14, 0);
      stamp(c, ['..smmmmhhmms..', '.smhhmmXXmms..', 'smmXXmmhhmms..', 'smmmms..smmmms'], 1, 6);
      stamp(c, ['shms', 'smmd', 'smmms'], 15, 8);
      stamp(c, ['smms', 'shmd', 'smmms'], 2, 8);
    } else {
      stamp(c, skull, 7, 0);
      stamp(c, ['ms', 'sm'], 11, 8);
      stamp(c, ['.shhs', 'shmmm', 'smmmd', '.sdd.'], 2, 10);
      stamp(c, ['shhs.', 'mmmhs', 'dmmms', '.dds.'], 17, 10);
      stamp(c, ribs, 7, 10);
      stamp(c, ['smmmms'], 9, 18);
      stamp(c, ['shmmmmhs', 'smmXXmms'], 8, 19);
      if (pose === 'kneeling') {
        stamp(c, [
          '..smmmms..smmmms..',
          '.shhmmms..smhhms..',
          'smhmmmms..smmmms..',
          'smmmmms...smhhmms.',
          '...........smmmms.',
        ], 3, 21);
      } else {
        stamp(c, ['smhs', 'smms', 'smmd', 'dmms'], 7, 21);
        stamp(c, ['shms', 'smms', 'dmms', 'smmd'], 13, 21);
        stamp(c, ['shms', 'smmd'], 6, 25);
        stamp(c, ['shms', 'dmms'], 14, 25);
        stamp(c, ['sms', 'shm', 'smm'], 6, 27);
        stamp(c, ['sms', 'mhs', 'mms'], 15, 27);
        stamp(c, ['.smhhs', 'smmmms'], 4, 30);
        stamp(c, ['shhms.', 'smmmms'], 14, 30);
      }
    }
    this.sprites.set(pose, sprite);
    return sprite;
  }

  draw(target, shooter, ground, reducedMotion = false) {
    const c = this.c, facing = facingOf(shooter);
    const pose = shooter.age < 24 ? 'prone' : shooter.age < CREW_STAND_TICKS ? 'kneeling' : 'standing';
    const body = this.sprite(pose);
    c.clearRect(0, 0, this.layer.width, this.layer.height);
    c.imageSmoothingEnabled = false;
    const shoulderWorld = crewShoulder(shooter, ground);
    const origin = [CENTER_X + (shoulderWorld.x - shooter.x) / PIXEL_SCALE, GROUND_Y - CREW_SHOULDER_HEIGHT / PIXEL_SCALE];
    const kick = reducedMotion ? 0 : shooter.flash / 6;
    const along = (distance, side = 0) => [
      origin[0] + shooter.aimX * (distance - kick) - shooter.aimY * side * facing,
      origin[1] + shooter.aimY * (distance - kick) + shooter.aimX * side * facing,
    ];
    const piston = (from, to) => {
      stroke(c, from, to, colors.X, 4);
      stroke(c, from, to, colors.m, 2);
      block(c, from[0] - 1, from[1], 1, 2, colors.h);
    };
    const joint = at => {
      block(c, at[0] - 1, at[1] - 1, 3, 3, colors.s);
      block(c, at[0] - 1, at[1] - 1, 2, 1, colors.h);
      block(c, at[0], at[1], 1, 1, colors.d);
    };
    const elbow = [CENTER_X - facing * 8, GROUND_Y - 14];
    if (pose === 'standing') {
      piston([CENTER_X - facing * 6, GROUND_Y - 20], elbow);
      piston(elbow, along(8, 2));
      joint(elbow);
    }
    c.save();
    c.translate(CENTER_X, GROUND_Y); c.scale(facing, 1);
    c.drawImage(body, -12, -body.height);
    c.restore();

    if (pose === 'standing') {
      // Gunmetal receiver, bright top rail, vents, magazine, and a slim barrel.
      // Its world-space muzzle remains exactly where combat emits the shot.
      stroke(c, along(-4), along(6), colors.X, 5);
      stroke(c, along(-4), along(6), colors.s, 3);
      stroke(c, along(-2, -2), along(6, -2), colors.m);
      stroke(c, along(-4, -1), along(-2, -1), colors.h);
      stroke(c, along(2, 2), along(1, 4), colors.X, 3);
      stroke(c, along(2, 2), along(1, 4), colors.s);
      stroke(c, along(0), along(3), colors.d);
      stroke(c, along(6), along(CREW_BARREL_LENGTH), colors.X, 4);
      stroke(c, along(6), along(CREW_BARREL_LENGTH), colors.s, 2);
      stroke(c, along(10, -1), along(13, -1), colors.m);
      const shoulder = [CENTER_X + facing * 6, GROUND_Y - 20];
      const frontElbow = [CENTER_X + facing * 8, GROUND_Y - 14];
      piston(shoulder, frontElbow);
      piston(frontElbow, along(2, 2));
      joint(frontElbow);
      for (const grip of [along(2, 2), along(8, 2)]) {
        block(c, grip[0] - 1, grip[1] - 1, 3, 2, colors.s);
        block(c, ...grip, 2, 1, colors.h);
      }
      if (shooter.flash && !reducedMotion) {
        const tip = CREW_BARREL_LENGTH + 1;
        stroke(c, along(tip), along(tip + 4), '#e77941', 3);
        stroke(c, along(tip + 2, -2), along(tip + 2, 2), '#ffe2a2');
        stroke(c, along(tip), along(tip + 3), '#fff3d4');
        block(c, ...along(tip), 1, 1, '#ffffff');
      }
    }
    target.drawImage(this.layer, Math.round(shooter.x) - CENTER_X * PIXEL_SCALE, Math.round(ground) - GROUND_Y * PIXEL_SCALE,
      this.layer.width * PIXEL_SCALE, this.layer.height * PIXEL_SCALE);
  }
}

// Rooftop escape: an independent world, advanced by the game's fixed 50 Hz tick.
// Design research and original Canabalt references: docs/rooftop-runner.md.
export const ESCAPE_TIMINGS = { aftermath: 65, pursuit: 250, strike: 28, roll: 36 };
export const ESCAPE_DISTANCE = 1200;
export const RUN_GRAVITY = 1200;
export const RUN_START_SPEED = 340;
export const RUN_MAX_SPEED = 800;
export const RESCUE_AFTER_TICKS = 20 * 50;
export const RESCUE_APPROACH_TICKS = 125;
export const RESCUE_WINDOW_TICKS = 250;
const DT = 1 / 50;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const ease = n => n * n * (3 - 2 * n);
export function runnerView(game) {
  const aspect = game.width / game.height, width = clamp(aspect * 240, 480, 720) / (game.runner?.zoom ?? 1);
  return { width, height: width / aspect };
}
// Match RunnerArt.copter's scaled and rotated hanging rig at the detach frame.
export function helicopterDeparture(game) {
  const r = game.runner, h = game.hangingPosition, scale = r.copterScale / 2;
  const angle = clamp(r.airVX / 800, -.15, .15);
  const dx = (h.x - game.copterX + 14) * scale, dy = (h.y - game.copterY + 38) * scale;
  return { x: r.airWorldX + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: r.cameraY + r.airY + dx * Math.sin(angle) + dy * Math.cos(angle), scale: 32 * scale / 20 };
}
const holdLimit = speed => Math.min(.35, speed / 2000);
const heldVelocity = age => age < .08 ? -195 : -300;

// Use the actual jump envelope to constrain generated gaps and height changes.
export function jumpFlightTime(speed, landingHeight = 0) {
  let y = 0, vy = -195;
  for (let tick = 1; tick < 120; tick++) {
    const time = tick * DT;
    vy = time <= holdLimit(speed) ? heldVelocity(time) : Math.min(300, vy + RUN_GRAVITY * DT);
    y += vy * DT;
    if (vy > 0 && y >= landingHeight) return time;
  }
  return 0;
}

export class RooftopRun {
  constructor(seed = 1, best = 0) {
    this.seed = seed >>> 0; this.randomState = this.seed;
    this.phase = 'dormant'; this.age = this.time = this.sequence = 0;
    this.x = this.y = this.vy = this.cameraX = this.cameraY = this.cameraVX = 0;
    this.departureScale = 1;
    this.speed = RUN_START_SPEED; this.grounded = false; this.roofId = null;
    this.jumpHeld = false; this.jumpAge = -1; this.jumpBuffer = this.coyote = 0;
    this.airX = this.airY = this.airStartX = this.airStartY = 0;
    this.airVX = this.airVY = this.scroll = this.runOrigin = 0;
    this.airWorldX = this.travel = this.chaseProgress = 0;
    this.copterScale = 1;
    this.detonationTicks = 0; this.blastX = null; this.blastSpeed = 0; this.blastBeat = 0;
    this.landingY = 220; this.landingRoofId = null;
    this.runSequenceStart = 0;
    this.roofs = []; this.particles = []; this.birds = []; this.wreckage = [];
    this.stumble = this.landSquash = this.shake = 0;
    this.distance = 0; this.best = best; this.jumps = this.landed = this.brokenWindows = 0;
    this.reason = ''; this.cue = { id: 0, name: '' }; this.stepBeat = 0;
    this.viewWidth = 480; this.viewHeight = 320;
    this.runTicks = 0; this.zoom = 1; this.rescue = null; this.rescueCheckpoint = null;
  }
  get active() { return this.phase !== 'dormant'; }
  get flying() { return this.phase === 'pursuit'; }
  get running() { return this.phase === 'running' || this.phase === 'rescue'; }
  get dead() { return this.phase === 'dead'; }
  random() { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }
  sound(name) { this.cue = { id: this.cue.id + 1, name }; }
  enter(phase, game) {
    this.phase = phase; this.age = 0;
    const messages = {
      pursuit: 'SELF DESTRUCT. Follow the arrow. Hold RIGHT to escape!',
      strike: 'THE TAIL! JUMP!', fall: 'Make the ledge!', roll: 'Get up. GET UP.',
      running: 'RUN FROM THE BLAST. Space / ↑ / touch to jump. Hold for a longer leap.',
      rescue: 'A helicopter! Keep running. Get ready to jump and grab the boarding rail.',
      lifting: 'GOT IT. Hold on!', escaped: 'EXTRACTED. You escaped the blast. R starts a new game.',
    };
    if (messages[phase]) game.message = messages[phase];
    if (['pursuit', 'strike', 'roll', 'running', 'rescue', 'lifting', 'escaped'].includes(phase)) this.sound(phase);
  }
  begin(game) {
    if (this.active) return;
    const view = runnerView(game), scale = view.width / game.width;
    this.viewWidth = view.width; this.viewHeight = view.height;
    this.airX = this.airStartX = game.copterX * scale;
    this.airY = this.airStartY = game.copterY * scale;
    this.airWorldX = this.airX;
    this.airVX = game.dh * 100 * scale; this.airVY = game.dv * 100 * scale;
    this.copterScale = scale * 2;
    this.detonationTicks = game.boss.selfDestructTicks;
    this.bombX = game.boss.x * scale;
    this.cameraY = 220 - (game.deck + 44) * scale;
    this.startCameraY = this.cameraY;
    this.roofs = [this.roof(view.width + 120, 220, 520, 'roof')];
    this.fillRoofs(view.width + 800);
    game.boss.rockets = []; game.boss.grenades = []; game.combat.bullets = [];
    game.counterattack.bullets = []; game.jumper = null; game.state = 'ready';
    game.releaseControls(); this.enter('pursuit', game);
  }
  roof(x, y, width, kind) {
    const seed = Math.floor(this.random() * 65536), distribution = this.random();
    // Match the reference's occasional scattered flocks, rather than a row of
    // identical pigeons on every roof. Use a separate stream for their detail.
    const birds = kind !== 'glass' && distribution < .35 ? Math.min(24, Math.max(2, Math.floor(width / 120 * (2 + distribution * 34)))) : 0;
    let state = seed; const birdRandom = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const flock = Array.from({ length: birds }, () => {
      const offset = 12 + birdRandom() * (width - 24);
      return { offset, trigger: x + birdRandom() * offset * .5, facing: birdRandom() < .5 ? -1 : 1,
        phase: birdRandom() * 3, shade: Math.floor(birdRandom() * 3), vy: -50 - birdRandom() * 50,
        ax: 20 + birdRandom() * 260, ay: -50 - birdRandom() * 300, launched: false };
    });
    return { id: this.sequence++, x, y, baseY: y, width, kind, seed,
      items: [], birds, flock, disturbed: false, collapse: 0, sink: 0 };
  }
  fillRoofs(until) {
    while (this.roofs.at(-1).x + this.roofs.at(-1).width < until) {
      const last = this.roofs.at(-1), n = this.sequence - this.runSequenceStart;
      const heightChange = n < 3 ? 0 : Math.floor(this.random() * 5 - 2) * 10;
      const y = clamp(last.baseY + heightChange, 170, 260), flight = jumpFlightTime(this.speed, y - last.baseY);
      const gap = Math.max(20, Math.floor(this.speed * flight * (n < 3 ? .4 : .38 + this.random() * .22)));
      const width = Math.round(Math.max(260, this.speed * (1.05 + this.random() * 1.05)) / 8) * 8;
      const kind = n > 3 && n % 7 === 4 ? 'glass' : n > 5 && n % 9 === 6 ? 'collapse' : n > 4 && n % 8 === 5 ? 'crane' : 'roof';
      const roof = this.roof(last.x + last.width + gap, y, width, kind);
      if (n >= 2 && kind !== 'crane' && this.random() < .68) {
        roof.items.push({ x: roof.x + width * (.32 + this.random() * .18), hit: false, kind: this.random() < .5 ? 'crate' : 'vent' });
      }
      if (kind === 'glass') roof.items.push({ x: roof.x + 42, hit: false, kind: 'glass' });
      this.roofs.push(roof);
    }
  }
  particlesAt(x, y, kind, count = 8) {
    for (let i = 0; i < count; i++) {
      this.particles.push({ x, y, vx: (this.random() - .5) * (kind === 'blast' ? 330 : 140), vy: -30 - this.random() * 150,
        age: 0, life: kind === 'blast' ? 1.2 : .7, size: 1 + Math.floor(this.random() * (kind === 'blast' ? 8 : 3)), kind });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }
  pressJump() {
    if (!this.running || this.jumpHeld) return false;
    this.jumpHeld = true; this.jumpBuffer = 5; return true;
  }
  releaseJump() {
    this.jumpHeld = false;
    // Releasing ends lift, but preserves momentum instead of clipping the arc.
    this.jumpAge = -1;
  }
  clearInput() { this.releaseJump(); this.jumpBuffer = 0; }
  beginRescue(game) {
    // Only replace roofs beyond the visible horizon. Already-seen geometry,
    // the current jump and the runner's speed stay intact during the reveal.
    this.fillRoofs(this.cameraX + this.viewWidth * 2 + 500);
    let index = this.roofs.findIndex(roof => roof.kind === 'roof' && !roof.items.length && roof.x <= this.x && roof.x + roof.width > this.x + Math.max(2200, this.speed * 11));
    if (index < 0) {
      this.fillRoofs(Math.max(this.cameraX + this.viewWidth * 2 + 500, this.roofs.at(-1).x + this.roofs.at(-1).width + 1));
      index = this.roofs.findIndex(roof => roof.x > this.cameraX + this.viewWidth + 100);
    }
    const lane = this.roofs[index], previous = this.roofs[index - 1];
    if (previous) lane.y = lane.baseY = previous.baseY;
    lane.kind = 'roof'; lane.items = [];
    lane.width = Math.max(lane.width, 2200, this.speed * 11); lane.collapse = lane.sink = 0;
    this.roofs.length = index + 1; this.sequence = lane.id + 1;
    this.rescue = { x: this.cameraX + this.viewWidth + 150, y: lane.y - 120,
      floor: lane.y, roofId: lane.id, stage: 'approach', window: 0, grip: 0, vx: this.speed };
    this.enter('rescue', game);

    // A pickup retry starts on the clear roof, with its own fresh approach.
    // Distance/score earned during the run are retained; no twenty-second redo.
    const saved = JSON.parse(JSON.stringify(this, (key, value) => key === 'rescueCheckpoint' ? undefined : value));
    const x = Math.max(this.x, lane.x + 40);
    Object.assign(saved, { x, y: lane.y, vy: 0, grounded: true, roofId: lane.id, jumpHeld: false,
      jumpAge: -1, jumpBuffer: 0, coyote: 3, runOrigin: x - this.distance * 10,
      cameraX: x - this.viewWidth * .23, cameraY: lane.y - this.viewHeight * .68,
      blastX: x - 190, blastSpeed: this.speed, particles: [], birds: [], wreckage: [], stumble: 0 });
    saved.roofs = [JSON.parse(JSON.stringify(lane))];
    saved.rescue.x = saved.cameraX + this.viewWidth + 150;
    this.rescueCheckpoint = saved;
  }
  tickRescue(game, oldY) {
    const h = this.rescue, ready = h.stage === 'boarding';
    const roof = this.roofs.find(roof => roof.id === h.roofId);
    if (h.stage === 'approach') {
      const t = ease(clamp(this.age / RESCUE_APPROACH_TICKS, 0, 1));
      h.x = this.x + 16 + (this.viewWidth + 20) * (1 - t);
      h.y = h.floor - 44 - 76 * (1 - t);
      if (this.age >= RESCUE_APPROACH_TICKS && this.grounded && this.roofId === h.roofId && this.x > roof.x + 24) {
        h.stage = 'boarding'; h.window = RESCUE_WINDOW_TICKS; this.sound('pickup');
        game.message = 'JUMP NOW. Hold Space / ↑ / touch to grab the helicopter rail!';
      }
    } else if (ready) {
      h.x = this.x + 16; h.y = h.floor - 44 + Math.sin(this.time * 3) * 1.5;
      h.window--;
      // Swept hand/rail contact supports a quick tap or a held jump even at
      // high speed. A runner staying on the roof can never board automatically.
      const handsY = this.y - 22, oldHandsY = oldY - 22;
      if (!this.grounded && this.vy < 0 && this.x + 6 >= h.x - 19 && this.x + 6 <= h.x + 19 && oldHandsY >= h.y - 3 && handsY <= h.y + 3) {
        h.grip = this.x - h.x; h.vx = this.speed;
        this.x = h.x + h.grip; this.y = h.y + 22; this.vy = 0; this.roofId = null;
        this.clearInput(); this.enter('lifting', game); return;
      }
      if (!h.window) {
        h.stage = 'gone'; game.message = 'MISSED THE PICKUP. The blast is closing in!'; this.sound('alarm');
      }
    } else {
      h.x += (this.speed + 180) * DT; h.y -= 70 * DT;
    }
    if (this.age % 6 === 0 && h.stage !== 'gone' && h.x < this.cameraX + this.viewWidth) {
      this.particlesAt(h.x - 20 + this.random() * 40, h.floor, 'wash', 2);
    }
  }
  tickExtraction(game) {
    const h = this.rescue;
    // The player remains attached at the same hand position while the aircraft
    // accelerates clear. The camera eases upward rather than cutting scenes.
    const lift = ease(clamp((this.age - 20) / 115, 0, 1));
    h.vx += ((this.speed + 230) - h.vx) * .018;
    h.x += h.vx * DT; h.y -= (12 + lift * 74) * DT;
    this.x = h.x + h.grip; this.y = h.y + 22;
    this.cameraX += (h.x - this.viewWidth * .37 - this.cameraX) * .08;
    this.cameraY += (h.y - this.viewHeight * .47 - this.cameraY) * .025;
    if (this.blastX !== null) this.blastX += this.blastSpeed * DT;
    this.fillRoofs(this.cameraX + this.viewWidth + 350);
    this.roofs = this.roofs.filter(roof => roof.x + roof.width > this.cameraX - 250);
    if (this.age >= 225) { this.enter('escaped', game); this.sound('escaped'); }
  }
  retry(game) {
    if (!this.dead || this.age < 25) return false;
    if (this.rescueCheckpoint) {
      const saved = this.rescueCheckpoint, next = new RooftopRun(this.seed, this.best);
      Object.assign(next, JSON.parse(JSON.stringify(saved)));
      next.best = Math.max(this.best, this.distance); next.rescueCheckpoint = saved;
      game.runner = next; next.resize(game); next.clearInput(); next.sound('rescue');
      game.message = 'PICKUP CHECKPOINT. Jump for the boarding rail when the helicopter comes in low.';
      return true;
    }
    const next = new RooftopRun(this.seed + 1, Math.max(this.best, this.distance));
    game.runner = next; next.viewWidth = this.viewWidth; next.viewHeight = this.viewHeight;
    next.beginRun(game); return true;
  }
  beginRun(game) {
    this.resize(game);
    this.x = 100; this.y = 220; this.cameraX = this.x - this.viewWidth * .23;
    this.cameraY = 220 - this.viewHeight * .68;
    this.speed = RUN_START_SPEED; this.cameraVX = this.speed;
    this.roofs = [this.roof(-100, 220, Math.max(720, this.speed * 2.6), 'roof')]; this.fillRoofs(this.viewWidth + 900);
    this.grounded = true; this.roofId = this.roofs[0].id; this.runOrigin = this.x;
    this.blastX = this.x - 160; this.blastSpeed = this.speed * .86;
    this.enter('running', game);
  }
  die(game, reason) {
    if (this.dead) {
      if (this.age < 50) { this.x += this.speed * .2 * DT; this.vy += RUN_GRAVITY * DT; this.y += this.vy * DT; }
      return;
    }
    this.reason = reason; this.best = Math.max(this.best, this.distance);
    this.clearInput(); this.enter('dead', game); this.sound('dead');
    game.message = `${this.distance} m. ${reason} Restarting ${this.rescueCheckpoint ? 'the helicopter pickup' : 'the rooftops'}…`;
  }
  tick(game) {
    this.age++; this.time += DT; this.shake = Math.max(0, this.shake - DT);
    this.stumble = Math.max(0, this.stumble - DT); this.landSquash = Math.max(0, this.landSquash - DT);
    this.tickEffects();
    if (this.phase === 'rescue') {
      this.zoom = 1 - .18 * ease(clamp(this.age / 100, 0, 1));
      const view = runnerView(game);
      this.cameraY += (this.viewHeight - view.height) * .68;
      this.viewWidth = view.width; this.viewHeight = view.height;
    }
    if (this.phase === 'lifting') { this.tickExtraction(game); return; }
    if (this.phase === 'escaped') return;
    if (this.phase === 'pursuit') {
      const accelerate = (v, target) => v + clamp(target - v, -200 * DT / game.accelerationTime, 200 * DT / game.accelerationTime);
      this.airVX = accelerate(this.airVX, game.controlX * 50);
      this.airVY = accelerate(this.airVY, game.controlY * 35);
      const dx = this.airVX * DT;
      this.airWorldX = Math.max(this.cameraX + 38, this.airWorldX + dx);
      this.travel = Math.max(this.travel, this.airWorldX - this.airStartX);
      this.chaseProgress = clamp(this.travel / ESCAPE_DISTANCE, 0, 1);
      this.scroll = Math.max(0, this.airVX);
      const previousCamera = this.cameraX;
      if (dx > 0) this.cameraX += Math.min(dx * 1.5, Math.max(0, this.airWorldX - this.viewWidth * .46 - this.cameraX) * .14);
      this.cameraVX = (this.cameraX - previousCamera) / DT;
      this.airX = this.airWorldX - this.cameraX;
      const cameraTarget = this.startCameraY + (220 - this.viewHeight * .68 - this.startCameraY) * ease(this.chaseProgress);
      this.airY += this.cameraY - cameraTarget; this.cameraY = cameraTarget;
      this.airY = clamp(this.airY + this.airVY * DT, 12, Math.max(50, 220 - this.cameraY - 82));
      this.detonationTicks = Math.max(0, this.detonationTicks - 1);
      if (!this.detonationTicks && this.blastX === null) {
        this.blastX = this.bombX - 120; this.sound('explosion'); this.shake = .35;
        game.message = 'DETONATION. Keep flying. The blast is coming!';
      }
      if (this.blastX !== null) this.blastX += 900 * DT;
      this.fillRoofs(this.cameraX + this.viewWidth + 500);
      this.roofs = this.roofs.filter(r => r.x + r.width > this.cameraX - 300);
      if (this.detonationTicks > 0 && this.detonationTicks % 50 === 1) this.sound('alarm');
      if (this.blastX !== null && this.blastX >= this.airWorldX - 34 * this.copterScale && this.chaseProgress < 1) {
        this.phase = 'caught'; game.state = 'game_over'; game.releaseControls();
        game.message = 'The blast caught you. Restarting the escape — hold RIGHT.';
      } else if (this.blastX !== null && this.blastX >= this.airWorldX - 34 * this.copterScale) {
        this.enter('strike', game); this.shake = .3;
        this.particlesAt(this.airWorldX - 30, this.cameraY + this.airY + 12, 'blast', 25);
        this.wreckage.push({ x: this.airWorldX - 30, y: this.cameraY + this.airY + 12, vx: -160, vy: -80, angle: 0, type: 'tail' });
      }
      return;
    }
    if (this.phase === 'strike') {
      this.cameraVX = 200; this.cameraX += this.cameraVX * DT; this.airWorldX += 200 * DT;
      this.blastX += 145 * DT;
      this.fillRoofs(this.cameraX + this.viewWidth + 900);
      if (this.age >= ESCAPE_TIMINGS.strike) {
        const departure = helicopterDeparture(game);
        this.x = departure.x; this.y = departure.y; this.departureScale = departure.scale;
        const roof = this.roofs.find(roof => roof.x + roof.width - 160 > this.x + 145);
        this.runSequenceStart = roof.id;
        for (const ahead of this.roofs) if (ahead.id >= roof.id && ahead.id < roof.id + 3) {
          ahead.kind = 'roof'; ahead.items = [];
        }
        this.landingY = roof.y; this.landingRoofId = roof.id;
        this.vy = -185;
        const flight = (185 + Math.sqrt(185 ** 2 + 1400 * Math.max(0, roof.y - this.y))) / 700;
        this.speed = Math.max(RUN_START_SPEED, this.airVX * 1.6, (Math.max(this.x + 145, roof.x + 60) - this.x) / flight);
        // Keep enough real roof under the faster leap, roll and first reaction
        // window. Shift later roofs together so their existing gaps stay valid.
        const safeEnd = this.x + this.speed * (flight + ESCAPE_TIMINGS.roll * DT + .85);
        const extra = roof.x + roof.width > this.cameraX + this.viewWidth
          ? Math.max(0, safeEnd - roof.x - roof.width) : 0;
        roof.width += extra;
        for (const next of this.roofs) if (next.id > roof.id) {
          next.x += extra; for (const item of next.items) item.x += extra;
          for (const bird of next.flock ?? []) bird.trigger += extra;
        }
        this.wreckage = [{ x: this.x - 8, y: this.y - 32, vx: -60, vy: -100, angle: 0, type: 'body' },
          { x: this.x - 8, y: this.y - 40, vx: -130, vy: -180, angle: 0, type: 'rotor' }, ...this.wreckage];
        this.particlesAt(this.x, this.y - 32, 'blast', 45); this.shake = .45;
        this.enter('fall', game); this.sound('explosion');
      }
      return;
    }
    if (this.phase === 'fall') {
      this.blastX += 65 * DT;
      this.x += this.speed * DT; this.vy += 700 * DT; this.y += this.vy * DT;
      this.followRunner(.3);
      if (this.y >= this.landingY && this.vy > 0) {
        this.y = this.landingY; this.vy = 0; this.grounded = true; this.roofId = this.landingRoofId;
        this.particlesAt(this.x, this.y, 'dust', 12); this.shake = .16; this.enter('roll', game);
      }
      return;
    }
    if (this.phase === 'roll') {
      this.blastX += 65 * DT;
      this.x += this.speed * DT;
      this.followRunner(.23);
      if (this.age % 6 === 0) this.particlesAt(this.x - 5, this.y, 'dust', 2);
      if (this.age >= ESCAPE_TIMINGS.roll) {
        this.blastSpeed = this.speed * .86;
        this.runOrigin = this.x; this.clearInput(); this.enter('running', game);
      }
      return;
    }
    if (this.dead) return;
    this.tickRun(game);
  }
  followRunner(anchor = .23) {
    // Velocity carries through the cinematic. No direct camera-position assignment
    // when the roll ends; the same controller follows ordinary jumps and running.
    const target = this.speed + (this.x - this.viewWidth * anchor - this.cameraX) * 3;
    this.cameraVX += clamp(target - this.cameraVX, -600 * DT, 600 * DT);
    this.cameraX += this.cameraVX * DT;
  }
  tickRun(game) {
    const oldX = this.x, oldY = this.y;
    this.speed = Math.min(RUN_MAX_SPEED, this.speed + (this.speed < 250 ? 30 : this.speed < 400 ? 20 : this.speed < 600 ? 10 : 4) * DT);
    this.coyote = this.grounded ? 3 : Math.max(0, this.coyote - 1);
    if (this.jumpBuffer && this.coyote) {
      this.jumpBuffer = 0; this.coyote = 0; this.grounded = false; this.roofId = null;
      this.vy = -195; this.jumpAge = 0; this.jumps++; this.sound('jump');
      this.particlesAt(this.x, this.y, 'dust', 3);
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - 1);
    this.x += this.speed * DT;
    if (this.blastX !== null) {
      const target = this.rescue?.stage === 'gone' ? this.speed + 220 : Math.max(75, this.speed + (this.x - this.blastX - this.viewWidth * .2) * .6);
      this.blastSpeed += (target - this.blastSpeed) * .03;
      this.blastX += this.blastSpeed * DT;
      if (this.blastX > this.x - 8) { this.particlesAt(this.x, this.y - 8, 'blast', 20); this.die(game, 'The expanding blast caught you.'); return; }
      const beat = Math.floor(this.blastX / 90);
      if (beat !== this.blastBeat) { this.blastBeat = beat; this.particlesAt(this.blastX, this.y, 'blast', 8); this.shake = .035; }
    }
    if (!this.grounded) {
      this.jumpAge = this.jumpAge < 0 ? -1 : this.jumpAge + DT;
      this.vy = this.jumpHeld && this.jumpAge >= 0 && this.jumpAge <= holdLimit(this.speed)
        ? heldVelocity(this.jumpAge) : Math.min(300, this.vy + RUN_GRAVITY * DT);
      this.y += this.vy * DT;
    }
    this.fillRoofs(this.x + this.viewWidth + 350);
    let support = null;
    for (const roof of this.roofs) {
      if (roof.kind === 'collapse' && this.x + 30 > roof.x && this.x < roof.x + roof.width && !roof.collapse) roof.collapse = 1;
      if (roof.collapse) { roof.collapse++; roof.sink += Math.max(0, roof.collapse - 25) * .012; roof.y = roof.baseY + roof.sink; }
      const across = this.x + 5 >= roof.x && this.x - 5 <= roof.x + roof.width;
      if (across && this.vy >= 0 && (this.grounded && this.roofId === roof.id || oldY <= roof.y + 2 && this.y >= roof.y)) {
        if (!support || roof.y < support.y) support = roof;
      }
      // Entering a building side below its roof is fatal; roof crossings above
      // are handled separately, including fast frames and falling landings.
      if (oldX + 5 <= roof.x && this.x + 5 > roof.x && this.y - 3 > roof.y + 3) {
        this.particlesAt(this.x, this.y - 12, 'dust', 12); this.die(game, 'You hit the edge of the building.'); return;
      }
      for (const bird of (roof.flock ?? []).slice(0, roof.birds)) {
        if (!bird.launched && this.x > bird.trigger) {
          bird.launched = true;
          this.birds.push({ ...bird, x: roof.x + bird.offset, y: roof.y - 4, age: 0, vx: 0, ax: bird.ax * bird.facing });
        }
      }
      roof.disturbed = (roof.flock ?? []).every(bird => bird.launched);
      for (const item of roof.items) {
        if (item.hit || this.x + 7 < item.x || oldX - 7 > item.x + 12) continue;
        if (item.kind === 'glass' && this.y > roof.y - 70 && this.y - 22 < roof.y) {
          item.hit = true; this.brokenWindows++; this.particlesAt(item.x, this.y - 15, 'glass', 22); this.sound('glass'); this.shake = .1;
        } else if (item.kind !== 'glass' && this.y > roof.y - 15 && this.y - 22 < roof.y) {
          item.hit = true; this.speed = Math.max(105, this.speed * .7); this.stumble = .35;
          this.particlesAt(item.x, roof.y - 8, 'crate', 8); this.sound('stumble');
        }
      }
    }
    if (support) {
      if (!this.grounded) { this.landed++; this.landSquash = .12; this.particlesAt(this.x, support.y, 'dust', 4); this.sound('land'); }
      this.y = support.y; this.vy = 0; this.grounded = true; this.roofId = support.id; this.jumpAge = -1;
    } else { this.grounded = false; this.roofId = null; }
    this.followRunner();
    // Camera follows roof height gently, leaving the jump arc visible.
    const floor = support?.y ?? this.roofs.find(r => r.x + r.width > this.x)?.baseY ?? 220;
    this.cameraY += (floor - this.viewHeight * .68 - this.cameraY) * .035;
    this.distance = Math.max(0, Math.floor((this.x - this.runOrigin) / 10));
    this.best = Math.max(this.best, this.distance);
    this.roofs = this.roofs.filter(r => r.x + r.width > this.cameraX - 250);
    if (this.grounded && Math.floor(this.x / 32) !== this.stepBeat) { this.stepBeat = Math.floor(this.x / 32); if (!this.stumble) this.sound('step'); }
    if (this.y > floor + 155) this.die(game, 'You missed the rooftop.');
    if (this.dead) return;
    if (this.phase === 'running' && ++this.runTicks >= RESCUE_AFTER_TICKS) this.beginRescue(game);
    else if (this.phase === 'rescue') this.tickRescue(game, oldY);
  }
  tickEffects() {
    for (const p of this.particles) { p.age += DT; p.x += p.vx * DT; p.y += p.vy * DT; p.vy += (p.kind === 'blast' ? 90 : 420) * DT; }
    this.particles = this.particles.filter(p => p.age < p.life);
    for (const b of this.birds) { b.age += DT; b.vx += b.ax * DT; b.vy += b.ay * DT; b.x += b.vx * DT; b.y += b.vy * DT; }
    this.birds = this.birds.filter(b => b.age < 3 && b.y > this.cameraY - 100).slice(-96);
    for (const w of this.wreckage) { w.x += w.vx * DT; w.vy += 400 * DT; w.y += w.vy * DT; w.angle += DT * (w.type === 'body' ? 2 : 6); }
    this.wreckage = this.wreckage.filter(w => w.y < this.cameraY + this.viewHeight + 100);
  }
  resize(game) {
    const view = runnerView(game);
    if (this.active) {
      this.airX *= view.width / this.viewWidth; this.airY *= view.height / this.viewHeight;
      this.airStartX *= view.width / this.viewWidth; this.airStartY *= view.height / this.viewHeight;
      this.cameraY += (this.viewHeight - view.height) * .68;
      if (!['pursuit', 'strike'].includes(this.phase)) {
        const fraction = (this.x - this.cameraX) / this.viewWidth;
        this.cameraX = this.x - view.width * fraction;
      }
    }
    this.viewWidth = view.width; this.viewHeight = view.height;
  }
}

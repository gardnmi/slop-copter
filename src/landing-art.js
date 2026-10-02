// The same carrier and rescue aircraft, now a playable side-view approach.
import { box, line, label, clamp, hash } from './air-art.js';
import { LANDING, landingReadout } from './carrier-landing.js';
import { CARRIER_LINEUP_TICKS } from './carrier-lineup.js';
import { drawLandingVapor, drawLandingRotors, drawLandingExhaust } from './landing-flight-art.js';
const GOLD = '#ffe0a0', GREEN = '#b4f7c3', RED = '#ff987d';

export class LandingArt {
  draw(c, game, art, renderer, reduced) {
    const a = game.assault, r = a.recovery, w = a.width, h = a.height;
    const approach = a.phase === 'lineup', progress = clamp(a.age / CARRIER_LINEUP_TICKS);
    const ease = progress * progress * (3 - 2 * progress);
    const check = landingReadout(r), normalWidth = Math.max(640, Math.min(1000, w / h * 650));
    const viewWidth = normalWidth + (approach ? (1200 - normalWidth) * (1 - ease) : 0);
    const scale = Math.min(w / viewWidth, Math.max(.2, (h - 90) / 380));
    const cameraX = Math.max(0, r.camera - viewWidth * .36), insetX = (w - viewWidth * scale) / 2;
    // Resizing changes the view, never the aircraft's world coordinates.
    const baseY = h * .72 - LANDING.deckY * scale;
    const offsetY = Math.max(baseY, (w < 440 ? 110 : 80) - (r.y - 63) * scale);
    this.sea(c, a, w, h, Math.min(h * .82, h * .51 + (offsetY - baseY) * .45), cameraX, reduced);
    c.save(); c.translate(insetX - cameraX * scale, offsetY); c.scale(scale, scale);
    this.carrier(c, a, art, check, reduced);
    this.helicopter(c, a, art.deck.actors, renderer, reduced);
    if (r.status === 'landed' && r.landedAge > 35) {
      const walkAge = r.landedAge - 35, distance = walkAge * .9, size = .5;
      // The deck commando keeps his pistol, bandana and registered waist at
      // the smaller recovery-camera scale. His feet follow the moving deck.
      c.save(); c.translate(r.x + 24 + distance, r.deckY); c.scale(size, size);
      art.deck.commando(c, { x: 0, y: 0, facing: 1, grounded: true,
        vx: reduced ? 0 : 45 / size, vy: 0, age: walkAge,
        time: reduced ? 0 : walkAge / 50, stride: distance / size,
        weapon: 'pistol', ammo: 0 }, reduced);
      c.restore();
    }
    c.restore();
    if (approach) {
      const bars = Math.round(h * .075 * Math.min(1, (1 - progress) * 5));
      box(c, '#0c1821', 0, 0, w, bars); box(c, '#0c1821', 0, h - bars, w, bars);
      c.globalAlpha = Math.min(1, (1 - progress) * 7);
      label(c, 'BRING HER HOME', w * .08, h * .18, w < 440 ? 14 : 22, GOLD);
      label(c, 'CLEAR DECK / LINING UP', w * .08, h * .18 + 23, w < 440 ? 8 : 10, '#e0e6da');
      c.globalAlpha = 1;
    } else this.hud(c, a, w, h, check, reduced);
  }
  sea(c, a, w, h, horizon, camera, reduced) {
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#223f58'); sky.addColorStop(.65, '#798b99'); sky.addColorStop(1, '#e4b48a');
    c.fillStyle = sky; c.fillRect(0, 0, w, horizon);
    c.fillStyle = '#ffe1a0'; c.beginPath(); c.arc(w * .8 - camera * .012, horizon * .66, 19, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 12; i++) {
      const x = ((hash(i * 17) * (w + 110) - camera * .025) % (w + 110) + w + 110) % (w + 110) - 55;
      box(c, 'rgba(200,184,171,.24)', x, horizon * (.2 + hash(i * 89) * .5), 28 + hash(i * 127) * 75, 3);
    }
    const sea = c.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, '#476b7b'); sea.addColorStop(1, '#142d45'); c.fillStyle = sea; c.fillRect(0, horizon, w, h - horizon);
    const time = reduced ? 0 : a.time;
    for (let i = 0; i < 170; i++) {
      const v = hash(i * 71), y = horizon + v * v * (h - horizon);
      const x = ((hash(i * 43) * w - camera * (.16 + v * .55) - time * (2 + v * 7)) % (w + 30) + w + 30) % (w + 30) - 15;
      const glow = Math.abs(x - w * .8) < 12 + v * 65;
      box(c, glow ? '#b9a385' : i % 3 ? '#41647a' : '#789298', x, y, 2 + v * 21, 1 + v);
    }
    line(c, '#d5b79b', [[0, horizon], [w, horizon]]);
  }
  carrier(c, a, art, check, reduced) {
    const r = a.recovery, x = r.shipX, y = r.deckY, sw = LANDING.shipWidth;
    const sh = sw * art.sprites.side.height / art.sprites.side.width;
    for (let i = 0; i < 36; i++) {
      const drift = reduced ? i * 7 % 125 : (a.time * 36 + i * 13) % 125;
      c.globalAlpha = .6 * (1 - drift / 150);
      box(c, i % 3 ? '#9fbfcb' : '#d5ddd0', x - drift + i % 4 * 8, y + sh * .38 + i % 5 * 3, 8 + i % 12, 1);
    }
    c.globalAlpha = 1;
    c.drawImage(art.sprites.side, x, y - sh * .59, sw, sh);
    const cw = 109, ch = cw * art.sprites.shipSide.height / art.sprites.shipSide.width;
    c.drawImage(art.sprites.shipSide, x + 495, y - ch - 2, cw, ch);
    const pad = check.padX, half = LANDING.padWidth / 2;
    const ready = check.safe && r.status !== 'crashed', color = ready ? GREEN : GOLD;
    // The lights mark the real contact plane, not the hull's shadow.
    box(c, '#163b42', pad - half, y - 2, half * 2, 3);
    line(c, color, [[pad - half, y - 9], [pad - half, y], [pad + half, y], [pad + half, y - 9]], 2);
    for (let i = 0; i < 9; i++) {
      const lit = reduced || ready || Math.floor(a.age / 5) % 9 === i;
      box(c, lit ? '#fff4ca' : '#678c82', pad - half + 5 + i * 17, y - 3, 3, 2);
    }
    if (r.status === 'flying') {
      label(c, 'LAND HERE  →', pad, y - 13, 11, color, 'center');
      if (r.y < y - 50 && Math.abs(r.x - pad) < half + 25) {
        c.globalAlpha = .28;
        for (let py = r.y + 12; py < y - 25; py += 12) box(c, color, r.x, py, 1, 4);
        c.globalAlpha = 1;
      }
    }
  }
  helicopter(c, a, actors, renderer, reduced) {
    const r = a.recovery;
    if (r.status === 'crashed') {
      const t = a.age;
      for (let i = 0; i < 23; i++) {
        const v = hash(i * 29), age = Math.min(t, 65);
        const x = r.x + Math.cos(i * 2.4) * age * (1 + v), y = r.y - 20 - Math.sin(i * 1.7) * age * 1.3 + age * age * .012;
        c.globalAlpha = clamp(1 - t / 100);
        box(c, i % 4 === 0 ? '#fff1b0' : i % 3 ? '#f3a267' : '#26333b', x, y, 4 + v * 7, 3 + v * 5);
      }
      c.globalAlpha = 1; return;
    }
    drawLandingVapor(c, r, actors, reduced);
    const body = renderer.runnerArt.rescueArt.body, width = 126, height = width / 2;
    c.save(); c.translate(r.x, r.y - 24); c.rotate(r.angle);
    drawLandingRotors(c, r, actors, reduced);
    c.drawImage(body, -width / 2, 24 - height, width, height);
    drawLandingExhaust(c, r, actors, reduced);
    c.restore();
  }

  hud(c, a, w, h, check, reduced) {
    const r = a.recovery, margin = 14, compact = w < 440;
    label(c, 'CARRIER RECOVERY', margin, 20, compact ? 10 : 13, GOLD);
    label(c, '↑ / W / SPACE LIFT    ← → TILT', margin, 35, compact ? 7 : 8, '#e0e6da');
    const fx = compact ? margin : w - 155, fy = compact ? 55 : 19;
    label(c, `FUEL  ${Math.ceil(r.fuel)}%`, fx, fy, 9, r.fuel < 25 ? RED : GOLD);
    const lifting = r.status === 'flying' && r.thrust > 0;
    const liftLabel = r.status === 'landed' ? 'ON DECK' : r.status === 'crashed' ? 'OFFLINE'
      : lifting ? '↑ LIFT ON' : !r.fuel ? 'EMPTY' : 'COAST';
    label(c, liftLabel, fx + 136, fy, 8, lifting ? GREEN : !r.fuel ? RED : '#b3c4cc', 'right');
    box(c, '#1a303c', fx, fy + 5, 136, 7);
    box(c, r.fuel < 25 ? RED : GOLD, fx + 1, fy + 6, 134 * r.fuel / 100, 5);
    // Actual powered lift drives the meter, including partial gamepad input.
    for (let i = 0; i < 8; i++) box(c, lifting && i < Math.ceil(r.thrust * 8) ? GREEN : '#304f5e', fx + i * 17, fy + 15, 14, 3);
    if (lifting && !reduced) {
      const flow = (a.age * 3) % 134;
      box(c, '#f1fff4', fx + flow, fy + 15, 3, 3);
    }
    const infoY = compact ? 89 : 60;
    const driftSafe = Math.abs(check.drift) <= LANDING.maxDrift, sinkSafe = check.sink <= LANDING.maxSink;
    label(c, `DRIFT ${Math.abs(check.drift / 4).toFixed(1)} / 6`, margin, infoY, 8, driftSafe ? GREEN : RED);
    label(c, `${check.sink < 0 ? 'RISE' : 'SINK'} ${Math.abs(check.sink / 4).toFixed(1)} / 8`, margin + 104, infoY, 8, sinkSafe ? GREEN : RED);
    label(c, check.level ? 'LEVEL ✓' : 'LEVEL OUT', margin + 208, infoY, 8, check.level ? GREEN : RED);
    let cue = !check.aligned ? 'CATCH THE MOVING PAD →' : !driftSafe ? 'MATCH THE CARRIER SPEED' : !sinkSafe ? 'LIFT TO SLOW YOUR DESCENT' : !check.level ? 'RELEASE TILT TO LEVEL OUT' : 'ON TARGET · EASY DOWN';
    if (!r.fuel && r.status === 'flying') cue = 'FUEL EMPTY · ENGINE OFF';
    if (r.status === 'landed') cue = 'TOUCHDOWN · DECK SECURED';
    if (r.status === 'crashed') {
      box(c, '#132a37', 0, h * .35, w, 64);
      label(c, 'RECOVERY FAILED', w / 2, h * .35 + 20, 15, GOLD, 'center');
      label(c, a.reason.split(' — ')[0], w / 2, h * .35 + 36, compact ? 7 : 9, '#e0e6da', 'center');
      label(c, 'RESTARTING LANDING…', w / 2, h * .35 + 53, 8, GREEN, 'center');
    }
    if (r.status !== 'crashed') label(c, cue, w / 2, h - 18, compact ? 8 : 11, r.status === 'landed' ? GREEN : GOLD, 'center');
  }
}

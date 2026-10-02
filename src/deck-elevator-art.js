import { deckPixels } from './deck-scenery.js';
import { hitSprite } from './hit-flash.js';
import { box, line, label } from './air-art.js';
import { liftFloor, LIFT_LEFT, LIFT_RIGHT, wardenMuzzles, drillExtension } from './deck-elevator.js';

// Silhouette registration excludes the source atlas's backdrop. Parts are
// reduced once to the same world-pixel grid as the native actor, never stretched
// each frame. Pistons, pod pivots, doors and damage use separate moving parts.
const BODY = [[58,310],[72,268],[104,230],[114,209],[150,184],[179,176],[185,151],[214,145],[246,155],[268,119],[321,114],[334,143],[402,108],[445,95],[480,90],[489,69],[489,47],[500,33],[516,33],[527,47],[527,80],[546,80],[546,31],[551,18],[568,16],[577,29],[577,74],[604,60],[631,43],[697,43],[710,24],[725,14],[808,14],[824,28],[827,43],[893,43],[914,61],[957,77],[963,27],[978,24],[985,43],[985,86],[999,86],[1000,34],[1040,34],[1047,46],[1042,98],[1092,108],[1150,127],[1200,149],[1205,120],[1243,117],[1272,130],[1278,157],[1320,150],[1350,164],[1360,184],[1409,193],[1429,218],[1448,249],[1466,292],[1476,335],[1461,385],[1438,413],[1412,431],[1365,440],[1336,461],[1306,472],[1260,476],[1202,502],[1148,516],[1042,520],[994,511],[926,508],[880,516],[846,532],[788,541],[735,538],[693,523],[660,511],[612,518],[556,532],[499,525],[463,509],[397,519],[337,500],[293,481],[258,463],[222,446],[178,444],[124,422],[88,392],[66,355]];
const GUN = [[181,570],[211,563],[282,564],[310,578],[314,607],[281,635],[295,648],[327,650],[351,671],[365,705],[397,731],[414,774],[408,818],[381,851],[351,864],[350,918],[337,969],[317,988],[282,999],[251,988],[235,972],[218,987],[184,995],[163,980],[154,954],[162,900],[146,856],[117,839],[91,810],[80,770],[92,735],[119,707],[128,672],[159,653],[196,647],[206,630],[185,607]];
const DRILL = [[711,577],[734,567],[805,567],[830,580],[838,603],[818,633],[804,647],[853,646],[884,666],[899,698],[923,719],[917,746],[951,776],[975,828],[990,874],[980,922],[959,961],[929,993],[906,983],[917,952],[921,919],[902,889],[906,857],[880,835],[855,822],[846,855],[819,879],[808,917],[789,947],[773,962],[755,945],[739,917],[730,885],[704,870],[696,842],[670,835],[650,856],[644,882],[631,898],[620,929],[632,960],[650,990],[630,994],[591,967],[568,933],[553,888],[550,851],[561,816],[586,787],[620,774],[637,737],[624,716],[633,682],[650,657],[691,646],[728,648],[715,629],[704,600]];
function piece(image, rect, outline, w, h) {
  const native = document.createElement('canvas'); native.width = rect[2]; native.height = rect[3];
  const c = native.getContext('2d'); c.translate(-rect[0], -rect[1]); c.beginPath();
  outline.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip(); c.drawImage(image, 0, 0);
  return deckPixels(native, [0, 0, ...rect.slice(2)], w, h);
}
export class ElevatorArt {
  async load() {
    const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/elevator-warden-atlas.png`; await image.decode();
    this.body = piece(image, [56, 10, 1424, 535], BODY, 336, 126);
    this.gun = piece(image, [76, 560, 342, 442], GUN, 52, 67);
    this.drill = piece(image, [548, 562, 446, 436], DRILL, 68, 66);
    this.rail = deckPixels(image, [1240, 570, 230, 416], 24, 44);
    this.pilot = deckPixels(image, [657, 72, 224, 132], 27, 16);
  }
  environment(c, d, kit) {
    const floor = liftFloor(d), left = LIFT_LEFT, width = LIFT_RIGHT - left;
    const wallLeft = Math.min(left - 30, d.cameraX - 4), wallRight = Math.max(LIFT_RIGHT + 30, d.cameraX + d.width + 4);
    const top = Math.max(260, Math.floor(d.cameraY / 96) * 96), bottom = d.cameraY + d.height + 100;
    c.save(); c.beginPath(); c.rect(wallLeft, 260, wallRight - wallLeft, Math.max(0, bottom - 260)); c.clip();
    box(c, '#131a1c', wallLeft, top, wallRight - wallLeft, bottom - top);
    for (let y = top; y < bottom; y += 96) {
      for (let x = left - Math.ceil((left - wallLeft) / 96) * 96, col = 0; x < wallRight; x += 96, col++) {
        kit.draw(c, ['service','pipes','vent','door','pipes','service','vent'][(col + Math.floor(y / 96)) % 7], x, y, 96, 96, 'wall');
        kit.strip(c, 'column', x + 91, y, 5, 96, 5, 48, true);
      }
      kit.strip(c, 'deck', wallLeft, y, wallRight - wallLeft, 7, 64, 9, 'wall');
      if (y % 192 === 0) {
        kit.draw(c, 'lamp', left + 46, y + 18, 10, 17);
        kit.draw(c, 'lamp', LIFT_RIGHT - 56, y + 18, 10, 17);
        label(c, `B${Math.floor((y - 260) / 192) + 2}`, left + 75, y + 29, 11, '#776e52');
      }
    }
    box(c, 'rgba(3,8,10,.28)', wallLeft, top, wallRight - wallLeft, bottom - top);
    for (const x of [left + 8, LIFT_RIGHT - 21]) {
      kit.strip(c, 'column', x, top, 13, bottom - top, 13, 72);
      line(c, '#918a70', [[x + 4, top], [x + 4, bottom]], 2);
      for (let y = Math.ceil(top / 24) * 24; y < bottom; y += 24) box(c, '#252a26', x + 7, y, 4, 7);
    }
    c.restore();
    if (d.collapse) {
      for (const p of d.collapse.pieces) {
        c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(p.angle);
        c.beginPath(); c.moveTo(-p.w / 2, 0); c.lineTo(p.w / 2 - 4, 0);
        c.lineTo(p.w / 2, 12); c.lineTo(p.w / 2 - 7, 21); c.lineTo(p.w / 2, 34);
        c.lineTo(-p.w / 2 + 4, 34); c.lineTo(-p.w / 2, 20); c.lineTo(-p.w / 2 + 6, 10); c.closePath(); c.clip();
        kit.strip(c, 'deck', -p.w / 2, 0, p.w, 22, 96, 22);
        kit.strip(c, 'catwalk', -p.w / 2, 20, p.w, 14, 48, 13);
        for (let x = -p.w / 2; x < p.w / 2; x += 16) {
          box(c, '#b79548', x, 3, 9, 3); box(c, '#363b31', x + 9, 3, 7, 3);
        }
        c.restore();
      }
      return;
    }
    // The lift is visible before and throughout the descent; no replacement
    // floor or player reposition occurs at the phase boundary.
    kit.strip(c, 'rail', left + 20, floor - 23, width - 40, 22, 68, 22, true);
    kit.strip(c, 'deck', left, floor, width, 22, 96, 22);
    kit.strip(c, 'catwalk', left, floor + 20, width, 13, 48, 13);
    for (let x = left + 4; x < LIFT_RIGHT - 4; x += 16) {
      box(c, '#b79548', x, floor + 3, 9, 3); box(c, '#363b31', x + 9, floor + 3, 7, 3);
    }
    for (const x of [left + 2, LIFT_RIGHT - 28]) c.drawImage(this.rail, x, Math.round(floor - 30));
  }
  pilotInShip(c) {
    // Native cockpit-sized portrait; the canopy frame remains in front.
    c.save(); c.beginPath(); c.moveTo(-79, -4); c.lineTo(-60, -19); c.lineTo(-39, -18); c.lineTo(-39, -4); c.closePath(); c.clip();
    c.drawImage(this.pilot, -66, -19, 25, 15); c.restore();
    line(c, '#507e85', [[-79, -4], [-60, -20], [-39, -19]], 1);
  }
  descent(c, d, art, reduced) {
    const b = d.boss;
    if (b.age < 72) {
      c.save(); c.translate(b.wreckX, b.wreckY + b.age * .45); c.rotate(b.age * .003);
      c.translate(-b.wreckX, -b.wreckY);
      art.deck.spacecraft.draw(c, { ...d, boss: { ...b, x: b.wreckX, y: b.wreckY } }, art, reduced); c.restore();
    }
    if (b.age > 16 && b.age < 100) {
      const x = b.wreckX, y = b.wreckY - 30 - (b.age - 16) * 2.8;
      art.deck.scenery.draw(c, 'emitter', x - 20, y - 5, 40, 26);
      c.drawImage(this.pilot, x - 13, y);
      art.deck.actors.explosion(c, { x, y: y + 27, age: 5 + b.age % 5, size: .4 }, reduced);
    }
  }
  draw(c, d, art, reduced) {
    const b = d.boss, floor = liftFloor(d), dying = b.state === 'warden-dying', wreck = b.state === 'wreck';
    if (wreck) {
      // Broken armor and the empty core settle separately. No compressed,
      // intact machine (or surviving pilot) sits on the elevator after victory.
      for (const [sx, sy, sw, sh, offset, angle] of [[8,40,74,64,-125,-.35],[77,58,63,52,-63,.24],[142,83,53,40,4,-.2],[205,58,61,53,61,-.32],[267,41,61,63,127,.3]]) {
        c.save();c.translate(Math.round(b.x + offset + (d.collapse?.age || 0) * offset * .004),Math.round(b.y + 53));c.rotate(angle + (d.collapse?.age || 0) * Math.sign(offset) * .006);c.globalAlpha=.72;
        c.drawImage(this.body,sx,sy,sw,sh,-sw/2,-sh*.55,sw,sh);c.restore();
      }
      return;
    }
    const x = Math.round(b.x), y = Math.round(b.y), flash = b.hit > 0;
    const paint = (sprite, xx, yy) => c.drawImage(flash ? hitSprite(sprite, reduced, 'slug') : sprite, Math.round(xx), Math.round(yy));
    // Hoist cables run to a real offscreen ceiling; independently driven drums.
    for (const side of [-1, 1]) {
      const xx = x + side * 102;
      if (dying && b.age >= 48) {
        // Broken hoists recoil above the falling hull instead of stretching
        // impossible unbroken cables all the way down with it.
        const end = d.cameraY + Math.max(12, 80 - (b.age - 48) * 3);
        line(c, '#777763', [[xx - 4, d.cameraY - 10], [xx - 4, end], [xx + side * 9, end + 8]], 2);
        continue;
      }
      line(c, '#101918', [[xx - 4, d.cameraY - 10], [xx - 4, y - 36]], 7);
      line(c, '#777763', [[xx - 4, d.cameraY - 10], [xx - 4, y - 36]], 2);
      for (let yy = Math.floor(d.cameraY / 9) * 9; yy < y - 36; yy += 9) box(c, '#b3a482', xx - 6, yy + (reduced ? 0 : b.time % 9), 4, 2);
    }
    const extension = drillExtension(b);
    if (b.state === 'warden-press') {
      const tipY = y + 97 + extension * (floor - y - 100), dx = b.drillX;
      line(c, '#161d1b', [[x, y + 15], [dx, y + 36]], 14);
      line(c, '#70654e', [[x, y + 15], [dx, y + 36]], 9);
      line(c, '#151e1e', [[dx, y + 35], [dx, tipY - 25]], 15);
      line(c, '#929a89', [[dx - 2, y + 35], [dx - 2, tipY - 25]], 7);
      line(c, '#d2cbaa', [[dx - 4, y + 35], [dx - 4, tipY - 25]], 2);
      paint(this.drill, dx - 34, tipY - 65);
    }
    for (const m of wardenMuzzles(b)) {
      c.save(); c.translate(Math.round(m.pivot.x), Math.round(m.pivot.y)); c.rotate(m.angle - Math.PI / 2);
      paint(this.gun, -26, -10 - (reduced ? 0 : b[m.side < 0 ? 'leftRecoil' : 'rightRecoil'])); c.restore();
      if (b.state === 'warden-crossfire' && b.age < b.warning) {
        c.save(); c.setLineDash([4, 5]); line(c, '#382b1c', [[m.x, m.y], [b.aimX, b.aimY]], 3); line(c, '#ffd28b', [[m.x, m.y], [b.aimX, b.aimY]], 1); c.restore();
      }
      if (b.flash && b.state === 'warden-crossfire') art.deck.actors.explosion(c, { x: m.x, y: m.y, age: 4 + 4 - b.flash, size: .6 }, reduced);
    }
    c.save();
    if (dying && !reduced) c.translate(Math.sin(b.age * .9) * 2, 0);
    paint(this.body, x - 168, y - 63);
    // The ribbed belly plates slide apart to vent. Their native texture moves
    // with the doors instead of a flat glow rectangle pasted over the hull.
    if (b.core > .22) {
      c.save(); c.translate(x, y); c.beginPath(); c.moveTo(-25, 10); c.lineTo(25, 10);
      c.lineTo(29, 42); c.lineTo(15, 57); c.lineTo(-15, 57); c.lineTo(-29, 42); c.closePath(); c.clip();
      box(c, '#261d14', -30, 10, 60, 48);
      art.deck.scenery.draw(c, 'emitter', -24, 10, 48, 48);
      const door = flash ? hitSprite(this.body, reduced, 'slug') : this.body;
      const gap = Math.round(b.core * 11);
      c.drawImage(door, 139, 73, 29, 48, -29 - gap, 10, 29, 48);
      c.drawImage(door, 168, 73, 29, 48, gap, 10, 29, 48);
      c.restore();
    }
    // Discrete burning damage sites; white/gold/red hit palette keeps the art.
    if (b.hp < b.maxHp * .55 || dying) for (const side of [-1, 1]) {
      art.deck.actors.explosion(c, { x: x + side * 96, y: y + 10, age: 8 + Math.floor((b.time + side * 5) / 3) % 18, size: .45 }, reduced);
    }
    c.restore();
    for (const m of b.marks) {
      if (b.age < b.warning) {
        for (let xx = m.x - 28; xx < m.x + 28; xx += 8) line(c, '#efb66c', [[xx, floor - 2], [xx + 4, floor - 6]], 2);
        label(c, '↓', m.x, floor - 14, 13, '#ffda88', 'center');
      }
    }
    if (b.state === 'warden-wake' && b.age > 40) label(c, 'THE WARDEN', x, y + 82, 10, '#efc980', 'center');
  }
}

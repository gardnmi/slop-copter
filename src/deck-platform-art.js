import { box, label } from './air-art.js';

const WALLS = ['vent', 'service', 'door', 'pipes', 'door', 'vent', 'pipes', 'service'];

export function drawDeckStructure(c, d, kit) {
  const visible = p => p.x + p.w > d.cameraX - 30 && p.x < d.cameraX + d.width + 30;
  for (const [x, end, name] of [[1280, 2050, '02 / CARGO'], [2350, 3020, '03 / HANGAR']]) {
    if (!visible({ x, w: end - x })) continue;
    c.save(); c.beginPath(); c.rect(x, 80, end - x, 360); c.clip();
    box(c, '#101820', x, 80, end - x, 360);
    for (let xx = x, col = 0; xx < end; xx += 96, col++) {
      if (!visible({ x: xx, w: 96 })) continue;
      for (let yy = 80, row = 0; yy < 440; yy += 96, row++) {
        kit.draw(c, WALLS[(col + row * 3 + (x > 2000 ? 3 : 0)) % WALLS.length], xx, yy, 96, 96, 'wall');
      }
      // Recessed columns unify panel joins, and cage lamps provide warm accents.
      kit.strip(c, 'column', xx - 3, 80, 7, 360, 7, 42, 'wall');
      if (col % 2 === 0) kit.draw(c, 'lamp', xx + 79, 91, 10, 14);
    }
    kit.strip(c, 'deck', x, 80, end - x, 10, 64, 12, true);
    kit.draw(c, 'deck', x + 18, 107, 94, 17, true);
    label(c, name, x + 65, 117, 7, '#c0b790', 'center');
    c.restore();
  }
  for (const p of d.platforms.filter(visible)) {
    if (d.lift && p.lift && p.solid) continue;
    if (p.arena && p.y >= 260 + (d.lift?.depth || 0)) continue;
    const { x, y, w } = p;
    if (p.solid) {
      c.save(); c.beginPath(); c.rect(x, y + 12, w, p.h - 12); c.clip();
      box(c, '#182028', x, y + 12, w, p.h - 12);
      for (let xx = x, col = 0; xx < x + w; xx += 96, col++) {
        if (!visible({ x: xx, w: 96 })) continue;
        for (let yy = y + 12, row = 0; yy < y + p.h; yy += 96, row++) {
          kit.draw(c, WALLS[(col * 3 + row + Math.floor(x / 96)) % WALLS.length], xx, yy, 96, 96, true);
        }
      }
      c.restore();
      kit.strip(c, 'deck', x, y, w, 18, 96, 18);
      kit.draw(c, 'cap', x, y, 7, 18);
      kit.draw(c, 'cap', x + w - 7, y, 7, 18);
    } else {
      for (const xx of [x + 8, x + w - 18]) {
        kit.strip(c, 'column', xx, y + 10, 10, 440 - y - 10, 10, 56);
      }
      // Brackets are drawn behind the deck, from the post to the inside joist.
      const span = Math.min(36, Math.floor(w / 3));
      kit.draw(c, 'brace', x + 10, y + 10, span, span);
      c.save(); c.translate(x + w - 10, y + 10); c.scale(-1, 1);
      kit.draw(c, 'brace', 0, 0, span, span); c.restore();
      kit.strip(c, 'rail', x + 3, y - 21, w - 6, 21, 64, 21);
      kit.strip(c, 'catwalk', x, y, w, 14, 40, 14);
    }
    // A one-pixel bevel keeps the exact landing surface legible over texture.
    box(c, '#b8b090', x + 2, y, Math.max(0, w - 4), 1);
  }
  for (const [x, y] of [[827, 216], [2026, 278], [2430, 250], [2632, 206], [2792, 160], [2940, 204]]) {
    kit.draw(c, 'deck', x - 10, y - 19, 20, 10);
    const arrow = ['0000100', '0000110', '1111111', '0000110', '0000100'];
    c.fillStyle = '#e0c080';
    for (let row = 0; row < arrow.length; row++) for (let col = 0; col < 7; col++) if (arrow[row][col] === '1') c.fillRect(x - 3 + col, y - 17 + row, 1, 1);
  }
  for (const [x, w] of [[850, 72], [2050, 70], [2680, 340]]) {
    box(c, '#101820', x, 434, w, 10);
    for (let xx = x + 8; xx < x + w - 8; xx += 40) kit.draw(c, 'lamp', xx, 434, 6, 8, true);
  }
}

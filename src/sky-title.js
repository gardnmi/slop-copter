import { LIQUID_TIMINGS } from './liquid-boss.js';

const CELL = 8;
const clamp = n => Math.max(0, Math.min(1, n));
const glyphs = [
  ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
];
const hash = n => (Math.imul(n + 17, 2654435761) >>> 0) / 4294967296;

export class SkyTitle {
  constructor() {
    this.key = '';
    this.atlas = document.createElement('canvas'); this.atlas.width = glyphs.length * CELL; this.atlas.height = CELL * 2;
    const c = this.atlas.getContext('2d');
    for (let bright = 0; bright < 2; bright++) {
      c.fillStyle = bright ? '#ccfbd5' : '#8bffa5';
      glyphs.forEach((rows, i) => rows.forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === '1') c.fillRect(i * CELL + x + 1, bright * CELL + y, 1, 1);
      })));
    }
  }

  layout(game) {
    const key = `${game.width}:${game.deck}`;
    if (key === this.key) return;
    this.key = key;
    this.width = Math.floor(game.width * .88 / CELL) * CELL;
    this.height = Math.floor(Math.max(48, Math.min(220, game.deck - 180)) / CELL) * CELL;
    this.left = Math.round((game.width - this.width) / 2);
    this.top = Math.round((game.deck - this.height) / 2);
    this.columns = Math.floor(this.width / CELL); this.rows = Math.floor(this.height / CELL);
    this.mask = this.makeMask('SLOP COPTER');
    this.victoryMask = this.makeMask('VICTORY');
    this.countdownKey='';
    this.arrowMask = new Uint8Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
      const x = col / this.columns, y = Math.abs(row / this.rows - .5) * 2;
      this.arrowMask[row * this.columns + col] = x > .36 && x < .74 && y < .24 || x >= .66 && x < .96 && y < (.96 - x) / .30 * .9 ? 1 : 0;
    }
  }

  makeMask(title, area = {x:0,y:0,width:this.width,height:this.height}) {
    const canvas = document.createElement('canvas'); canvas.width = this.width; canvas.height = this.height;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const setFont = size => { c.font = `900 ${size}px "Courier New", monospace`; return c.measureText(title); };
    let size = Math.floor(area.height * 1.4), bounds = setFont(size);
    const inkWidth = bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight;
    const inkHeight = bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent;
    size = Math.floor(size * Math.min(1, (area.width - CELL * 2) / inkWidth, (area.height - CELL * 2) / inkHeight));
    bounds = setFont(size);
    // Center the actual ink, not the font's baseline/line box. Leave complete
    // empty code cells around every edge before sampling the letter mask.
    const x = area.x + (area.width - bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2 + bounds.actualBoundingBoxLeft;
    const y = area.y + (area.height + bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2;
    c.fillText(title, x, y);
    const pixels = c.getImageData(0, 0, this.width, this.height).data;
    const mask = new Uint8Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
      mask[row * this.columns + col] = pixels[((row * CELL + 4) * this.width + col * CELL + 4) * 4 + 3] > 100 ? 1 : 0;
    }
    return mask;
  }

  draw(c, game, reducedMotion) {
    this.layout(game);
    const age = (game.frame - game.shiftTick) / 50;
    const b = game.boss;
    const evacuation = b.phase === 'dying' || b.phase === 'won';
    const celebrating = b.phase === 'victory' || evacuation;
    if(evacuation){
      const ticks=game.runner.active?game.runner.detonationTicks:b.selfDestructTicks;
      const seconds=String(Math.max(0,Math.ceil(ticks/50))).padStart(2,'0');
      if(seconds!==this.countdownKey){
        this.countdownKey=seconds;
        this.countdownMask=this.makeMask(seconds,{x:0,y:0,width:this.width*.33,height:this.height});
      }
    }
    const dissolving = b.phase === 'melt' && b.age < 65;
    const event = celebrating || dissolving;
    const ageOfVictory = evacuation ? b.age + (b.phase === 'won' ? LIQUID_TIMINGS.dying : 0) : celebrating ? b.age : LIQUID_TIMINGS.victory + b.age;
    // Simulation time keeps this animation frozen when paused. The ordinary
    // title and the victory use the same code cells, behind every game sprite.
    const time = reducedMotion ? 0 : game.time;
    c.save();
    for (let col = 0; col < this.columns; col++) {
      const seed = hash(col), head = (time * (12 + seed * 8) + seed * (this.rows + 24)) % (this.rows + 24);
      for (let row = 0; row < this.rows; row++) {
        const i = row * this.columns + col;
        const reveal = reducedMotion ? 1 : clamp((ageOfVictory - 9 - seed * 20 - row * 1.05) / 13);
        const dissolve = dissolving ? (reducedMotion ? 1 : clamp((b.age - seed * 18 - row * .55) / 24)) : 0;
        const victory = event ? reveal * (1 - dissolve) : 0;
        const title = this.mask[i] * (1 - victory), won = (evacuation ? (this.arrowMask[i]||this.countdownMask[i]) : this.victoryMask[i]) * victory;
        const filled = title + won;
        const distance = head - row;
        const trail = distance >= 0 && distance < 8 ? 1 - distance / 8 : 0;
        if (!filled && (!trail || reducedMotion)) continue;
        if (!event && !reducedMotion && filled && age < 4 && row > age * 20 - seed * 24) continue;
        const sweep = reducedMotion ? 0 : Math.max(0, 1 - Math.abs(col / this.columns - (ageOfVictory - 58) / 80) * 8);
        const settle = 0;
        c.globalAlpha = filled ? title * (reducedMotion ? .24 : .18 + trail * .48)
          + won * (reducedMotion ? .55 : (.64 + trail * .2 + sweep * .16) * (1 - settle * .5)) : trail * (event ? .11 : .065);
        const glyph = Math.floor(hash(col * 137 + row * 17 + Math.floor(time * (event ? 8 : 3))) * glyphs.length);
        const bright = filled && (trail > .85 || won > .2 && sweep > .55) ? CELL : 0;
        c.drawImage(this.atlas, glyph * CELL, bright, CELL, CELL, this.left + col * CELL, this.top + row * CELL, CELL, CELL);
      }
    }
    c.restore();
  }
}

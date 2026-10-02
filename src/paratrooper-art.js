import { hitSprite } from './hit-flash.js';

export class ParatrooperArt {
  async load() {
    const image = new Image(); image.src = `${import.meta.env.BASE_URL}assets/reference/metal-slug-paratrooper.png`;
    await image.decode(); this.image = image;
    this.canopies = [3, 58, 112, 167, 222, 277, 332, 387].map(x => this.frame([x, 861, x === 58 || x === 387 ? 51 : 52, 43], [0, 255, 0]));
    this.collapse = [[3,953,55,43],[61,955,55,48],[119,958,55,49],[177,963,55,48],
      [235,968,53,44],[291,975,54,40],[348,986,56,34],[407,995,62,26],[3,1025,51,19]]
      .map(rect => this.frame(rect, [0, 255, 0]));
    this.floating = [[277,657,43,53],[321,657,43,53],[367,657,36,53],[406,655,38,55]]
      .map(rect => this.frame(rect, [255, 255, 255]));
    this.firing = this.frame([187,657,43,53], [255, 255, 255]);
    this.standing = [3,43,83,123,163,203].map(x => this.frame([x,2,39,46], [255,255,255]));
    this.walk = [3,47,91,135,179,223,267,311,355,399,443].map(x => this.frame([x,50,42,44], [255,255,255]));
  }
  frame(rect, key) {
    const sprite = document.createElement('canvas'); sprite.width = rect[2]; sprite.height = rect[3];
    const c = sprite.getContext('2d'); c.drawImage(this.image, ...rect, 0, 0, sprite.width, sprite.height);
    const pixels = c.getImageData(0, 0, sprite.width, sprite.height), d = pixels.data;
    for (let i = 0; i < d.length; i += 4) if (key.every((v, j) => v === d[i + j])) d[i + 3] = 0;
    c.putImageData(pixels, 0, 0); return sprite;
  }
  chute(c, item, reduced) {
    const sprite = this.collapse[Math.min(8, Math.floor(item.age / 4))];
    c.save(); c.globalAlpha *= Math.min(1, (38 - item.age) / 10);
    c.drawImage(sprite, Math.round(item.x - sprite.width / 2), Math.round(item.y)); c.restore();
  }
  soldier(c, e, art, reduced) {
    c.save(); c.translate(Math.round(e.x), Math.round(e.y));
    if (e.airDeath) {
      c.scale(-e.facing, 1);
      art.draw(c, art.rebelDeath[Math.min(8, Math.floor(e.deathAge / 3))]); c.restore(); return;
    }
    if (!e.parachuting) {
      c.scale(-e.facing, 1);
      const sprite = e.walking || e.flash ? this.walk[Math.floor(e.age / 4) % this.walk.length] : this.standing[Math.floor(e.age / 7) % 6];
      c.drawImage(e.hit ? hitSprite(sprite, reduced, 'slug') : sprite, -22, -sprite.height);
      c.restore(); return;
    }
    const canopy = this.canopies[reduced ? 0 : Math.floor(e.age / 5) % 8]; c.drawImage(canopy, -26, -77);
    c.scale(-e.facing, 1);
    const firing = e.state === 'air-aim' || e.flash;
    const sprite = firing ? this.firing : this.floating[reduced ? 1 : [0,1,2,1][Math.floor(e.age / 8) % 4]];
    c.drawImage(e.hit ? hitSprite(sprite, reduced, 'slug') : sprite, -22, -sprite.height);
    if (e.state === 'air-aim') {
      c.fillStyle = '#ffcf75'; c.fillRect(-18, -23, 3, 3);
    }
    c.restore();
  }
}

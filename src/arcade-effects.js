// Personal-prototype reference art. Source/credits: assets/reference/README.md.
export class ArcadeEffects {
  async load() {
    this.image = new Image(); this.image.src = `${import.meta.env.BASE_URL}assets/reference/raiden-effects.png`;
    await this.image.decode();
    this.blast = [[3, 0, 31, 33], [35, 0, 30, 33], [65, 0, 29, 33], [94, 0, 31, 33],
      [125, 0, 33, 33], [158, 0, 35, 33], [195, 0, 35, 33], [230, 0, 37, 33], [267, 0, 36, 33]];
    this.crater = this.crop([337, 0, 37, 33]);
  }
  crop(rect) {
    const c = document.createElement('canvas'); c.width = rect[2]; c.height = rect[3];
    c.getContext('2d').drawImage(this.image, ...rect, 0, 0, c.width, c.height); return c;
  }
  explosion(c, x, y, age, diameter, reduced) {
    const index = Math.min(8, Math.floor(age / 3.8)), rect = this.blast[reduced ? Math.max(3, index) : index];
    c.save(); c.globalAlpha *= Math.min(1, (34 - age) / 7);
    c.drawImage(this.image, ...rect, Math.round(x - diameter / 2), Math.round(y - diameter / 2), diameter, diameter); c.restore();
  }
}

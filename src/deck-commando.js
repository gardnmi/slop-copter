// Keep the reference animation, but carry our commando's identity into the deck:
// dark, long hair, a red headband, olive vest and charcoal combat equipment.
// Palette changes are cached per frame; the source sheets remain untouched.
const palette = new Map([
  ['176,64,0', [62,69,42]], ['120,0,0', [34,40,27]], // Sleeveless vest.
  ['56,48,16', [31,35,33]], ['112,104,56', [63,70,61]],
  ['184,176,112', [107,116,98]], // Trousers and pack.
  ['56,48,8', [32,37,36]], ['112,96,56', [66,74,71]], // Gunmetal.
]);
const hair = new Map([['224,152,40', [44,31,24]], ['248,224,72', [87,60,42]]]);
const band = new Map([['248,248,232', [243,71,61]], ['184,176,112', [170,32,35]], ['112,104,56', [101,22,29]]]);

export function commandoFrame(frame, region, longHair = true, bodyRegion) {
  const { sprite, anchor } = frame, c = sprite.getContext('2d');
  const pixels = c.getImageData(0, 0, sprite.width, sprite.height), d = pixels.data;
  const [rx, ry, rw, rh] = region ?? [0, 0, sprite.width, sprite.height];
  let left = sprite.width, top = sprite.height, right = 0;
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
    const i = (y * sprite.width + x) * 4;
    if (d[i + 3] && hair.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x);
    }
  }
  const hasHead = right > left;
  // The white band and the highlight on the nose share a source color. Select
  // the forehead strip spatially; a palette-wide swap paints the face red too.
  let bandY = sprite.height, bandX = sprite.width;
  for (let y = top; y <= top + 6; y++) for (let x = left; x <= right + 1; x++) {
    const i = (y * sprite.width + x) * 4;
    if (d[i + 3] && d[i] === 248 && d[i + 1] === 248 && d[i + 2] === 232 && y <= bandY) {
      if (y < bandY) bandX = sprite.width;
      bandY = y; bandX = Math.min(bandX, x);
    }
  }
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) {
    const i = (y * sprite.width + x) * 4;
    if (!d[i + 3]) continue;
    const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    const head = hasHead && x >= left - 1 && x <= right + 2 && y >= top && y <= top + 14;
    const onBand = head && y >= bandY && y <= bandY + 3 && (y <= bandY + 1 || x < bandX);
    const onBody = !bodyRegion || x >= bodyRegion[0] && y >= bodyRegion[1]
      && x < bodyRegion[0] + bodyRegion[2] && y < bodyRegion[1] + bodyRegion[3];
    // Vest reds also occur in native muzzle flames. Recolor the actor only;
    // otherwise the orange phase of a flash turns into an olive silhouette.
    const color = head ? (y <= top + 8 && hair.get(key)) || (onBand && band.get(key)) : onBody && palette.get(key);
    if (color) d.set(color, i);
  }
  c.putImageData(pixels, 0, 0);
  if (hasHead && longHair) {
    // A few locks extend the native hair silhouette down behind the bare arm.
    // Draw underneath the pose so raised arms and the gun keep their occlusion.
    c.save(); c.globalCompositeOperation = 'destination-over';
    c.fillStyle = '#191918';
    c.fillRect(left - 2, top + 5, 4, 9); c.fillRect(left - 3, top + 10, 3, 6);
    c.fillStyle = '#30221c'; c.fillRect(left - 1, top + 7, 3, 7);
    c.fillStyle = '#57402c'; c.fillRect(left - 1, top + 8, 1, 5);
    c.restore();
  }
  return { ...frame, sprite, anchor, clothKnot: hasHead ? [left + 1 - anchor[0], top + 7 - anchor[1]] : null };
}

// A short palette swap, followed by a recovery interval, keeps automatic fire
// from turning a damageable enemy permanently white.
export const HIT_FLASH_TICKS = 3;
export function markHit(target) {
  if (target.hitWait > 0) return;
  target.hit = HIT_FLASH_TICKS;
  target.hitWait = 6;
}
export function tickHit(target) {
  target.hit = Math.max(0, (target.hit || 0) - 1);
  target.hitWait = Math.max(0, (target.hitWait || 0) - 1);
}
const palettes = new WeakMap();
const SLUG_HEAT = [[42, 5, 9], [83, 9, 11], [135, 16, 12], [190, 35, 14],
  [235, 73, 18], [255, 137, 30], [255, 206, 81], [255, 245, 189]];
export function hitSprite(source, reduced = false, style = 'pale') {
  let pair = palettes.get(source);
  if (!pair) { pair = new Map(); palettes.set(source, pair); }
  const key = `${style}:${reduced}`;
  if (pair.has(key)) return pair.get(key);
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const c = canvas.getContext('2d'); c.drawImage(source, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height), d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const shade = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (style === 'slug') {
      // Preserve panel shadows and bright outlines, as in the supplied clip:
      // deep red metal with gold highlights, rather than a white silhouette.
      const color = reduced ? [70 + shade * .62, 45 + shade * .48, 38 + shade * .37]
        : SLUG_HEAT[Math.min(7, Math.floor(shade / 32))];
      d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; continue;
    }
    const value = reduced ? 85 + shade * .65 : 205 + shade * .19;
    d[i] = value; d[i + 1] = value + 5; d[i + 2] = value + 9;
  }
  c.putImageData(pixels, 0, 0); pair.set(key, canvas); return canvas;
}

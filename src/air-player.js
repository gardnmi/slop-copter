// Shared scale and geometry for the playable overhead helicopter. Coordinates
// follow its native 32-pixel sprite, with the nose pointing up. Rotor sweeps
// remain decorative; cockpit, fuselage, tail boom and weapon pods take hits.
export const AIR_PLAYER_WIDTH = 32;
export const AIR_PLAYER_GUN_X = 5;
export const AIR_PLAYER_GUN_Y = -18;
export const AIR_WINGMAN_WIDTH = 14;
export const AIR_WINGMAN_OFFSET = 28;
export const AIR_WINGMAN_Y = 12;
const HULL = [
  [0, -21, 5], [0, -12, 7], [0, 0, 9],
  [0, 10, 4], [0, 16, 3], [0, 21, 3], [-11, -1, 4], [11, -1, 4],
];
export const airPlayerBank = a => a.vx / 1700;

export function hitsAirPlayer(a, x0, y0, x1, y1, radius = 0, previousX = a.x, previousY = a.y) {
  // Sweep relative to both objects, so steering across a fast round cannot
  // tunnel through it. Undo the same small bank used by the renderer.
  const angle = airPlayerBank(a), co = Math.cos(angle), si = Math.sin(angle);
  const local = (x, y) => [x * co + y * si, -x * si + y * co];
  const [ax, ay] = local(x0 - previousX, y0 - previousY);
  const [bx, by] = local(x1 - a.x, y1 - a.y), dx = bx - ax, dy = by - ay;
  return HULL.some(([x, y, r]) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return (ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2 <= (r + radius) ** 2;
  });
}

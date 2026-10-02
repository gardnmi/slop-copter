// The chrome takeover keeps the original horse-and-buggy proportions. Each
// frame shares the axle/ground anchor; only the trot and wheel spokes change.
export const HUNTER_SCALE = .22;
export const HUNTER_LAUNCH_ANGLE = -.55;
export const HUNTER_FRAMES = [
  { rect: [0, 0, 887, 444], anchor: [450, 426], muzzle: [354, 118] },
  { rect: [887, 0, 887, 444], anchor: [450, 426], muzzle: [354, 118] },
  { rect: [0, 444, 887, 443], anchor: [450, 426], muzzle: [354, 118] },
  { rect: [887, 444, 887, 443], anchor: [450, 426], muzzle: [354, 118] },
];
// Relative to the shared ground anchor: buggy, launcher, horse, head/neck.
export const HUNTER_HITBOXES = [[-91, -47, 96, 47], [-53, -72, 37, 35], [5, -44, 85, 44], [54, -66, 38, 32]];
export const PUDDLE_FRAME = [565, 812, 548, 146];
export const GRENADE_ARMS = [
  { rect: [1121, 578, 331, 179], anchor: [36, 44] },
  { rect: [1130, 766, 337, 181], anchor: [36, 44] },
];
export const hunterFrame = boss => Math.floor(boss.distance / 13) % 4;
export function hunterMuzzle(boss, deck) {
  const { anchor, muzzle } = HUNTER_FRAMES[hunterFrame(boss)];
  return { x: boss.x + (muzzle[0] - anchor[0]) * HUNTER_SCALE, y: deck + 44 + (muzzle[1] - anchor[1]) * HUNTER_SCALE };
}

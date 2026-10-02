// Source-pixel crops and anchors for the generated Omacontra-style atlas.
// Anchors are local to each crop; the body anchor is the hanging head center.
export const BODY_FRAMES = [[130, 58, 282, 611], [610, 58, 289, 611]];
export const BODY_ANCHORS = [[174, 0], [175, 0]];
export const WEAPON_FRAME = [972, 312, 550, 255];
export const WEAPON_PIVOT = [38, 56];
export const WEAPON_MUZZLE = [543, 56];
export const CLOTH_FRAMES = [[70, 750, 397, 193], [582, 744, 394, 212], [1073, 767, 423, 167]];
export const CLOTH_KNOTS = [[374, 87], [374, 91], [404, 69]];
export const CINEMA_SHOTS = [
  { rect: [747, 122, 300, 68] },
  { rect: [0, 0, 1536, 338], cloth: [577, 94, .86] },
  { rect: [0, 346, 1536, 320], cloth: [200, 42, .57] },
  { rect: [0, 676, 1536, 348], cloth: [725, 32, .35], muzzle: [1087 / 1536, 296 / 348], direction: [.87, .49] },
];

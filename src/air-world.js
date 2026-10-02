// Scenery and ground units share this forward distance. Screen Y = scroll - distance.
export const AIR_SCROLL_SPEED = 78;
export const DISTRICT_STARTS = [0, 18 * 78, 34 * 78, 50 * 78];
export const DISTRICT_BLEND = 240;
const smooth = n => { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); };
const mix = (a, b, t) => a + (b - a) * t;
export function terrainProfile(distance, width) {
  const highway = smooth((distance - DISTRICT_STARTS[1]) / DISTRICT_BLEND);
  const harbor = smooth((distance - DISTRICT_STARTS[2]) / DISTRICT_BLEND);
  const sea = smooth((distance - DISTRICT_STARTS[3]) / DISTRICT_BLEND);
  const bend = Math.sin(distance / 380) * .018 * (1 - harbor);
  return { highway, harbor, sea,
    lanes: [mix(mix(.27 + bend, .35, highway), .12, harbor) * width, mix(mix(.68 + bend, .63, highway), .88, harbor) * width],
    roadWidth: mix(Math.max(38, width * .075), Math.max(44, width * .18), highway),
    rail: width * .855,
    shore: mix(width * .48, width * .23, harbor) * (1 - sea),
  };
}
export function groundLane(width, distance, type, lane) {
  const p = terrainProfile(distance, width), side = lane < .5 ? 0 : 1;
  if (type === 'train') return p.rail;
  if (type === 'boat') return width * (side ? .62 : .38);
  return p.lanes[side];
}

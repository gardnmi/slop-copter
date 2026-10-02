// The visible weapon mount and projectile origin share this rig. Cosmetic
// springs never change attack timers, warning targets or collision geometry.
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
const approach = (v, target, speed) => v + (target - v) * speed;

export function spacecraftMotion() {
  return { gear: 1, bay: 0, mortar: 0, thrust: 0, vector: 0, pitch: 0, recoil: 0, velocity: 0, hitKick: 0 };
}
export function recoilSpacecraft(b, force = 2) {
  b.motion ??= spacecraftMotion();
  b.motion.velocity += force;
}
export function tickSpacecraftMotion(b, dx = 0) {
  const m = b.motion ??= spacecraftMotion();
  const parked = b.form === 'elevator' || b.state === 'descent', failing = b.state === 'warden-dying';
  m.gear = approach(m.gear, parked || failing && b.age > 60 ? 1 : 0, .12);
  m.bay = approach(m.bay, ['cannon', 'sweep', 'plasma'].includes(b.state) ? 1 : 0, .15);
  m.mortar = approach(m.mortar, b.state === 'mortar' ? 1 : 0, .16);
  m.thrust = approach(m.thrust, parked ? 0 : failing ? .3 : b.state === 'sweep' ? 1 : .65, .10);
  m.vector = approach(m.vector || 0, clamp(-dx * .045, -.20, .20), .10);
  m.velocity = (m.velocity - m.recoil * .24) * .66;
  m.recoil = clamp(m.recoil + m.velocity, -2, 5);
  m.hitKick *= .60;
  const pitch = parked ? 0 : clamp(dx * b.facing * -.006, -.035, .035) + Math.sin(b.time * .065) * .009;
  m.pitch = approach(m.pitch, pitch, .15);
}
export function spacecraftPoint(b, x, y, reduced = false) {
  const m = b.motion ?? spacecraftMotion(), angle = reduced ? 0 : m.pitch;
  const flip = -(b.facing || -1), heave = reduced ? 0 : -m.recoil * .55;
  return { x: b.x + flip * (x * Math.cos(angle) - y * Math.sin(angle)),
    y: b.y + heave + x * Math.sin(angle) + y * Math.cos(angle) };
}
export function spacecraftCannon(b) {
  const pivot = spacecraftPoint(b, -10, 30 + (b.motion?.bay ?? 1) * 7);
  const angle = b.state === 'cannon' && b.cannonAngle !== undefined ? b.cannonAngle
    : Math.atan2((b.aimY ?? 240) - pivot.y, (b.aimX ?? b.x) - pivot.x);
  const reach = 40 - Math.round(Math.max(0, b.motion?.recoil || 0));
  return { pivot, angle, x: pivot.x + Math.cos(angle) * reach, y: pivot.y + Math.sin(angle) * reach };
}

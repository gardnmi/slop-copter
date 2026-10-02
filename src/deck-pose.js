// Pelvis sockets measured at the top of each native lower-body frame. Shared
// by the actor rig and weapon origins so a tucked jump does not detach bullets.
const WALK_HIPS = [[0,0],[0,0],[0,0],[1,0],[0,0],[0,-3],[2,-4],[-3,-4],[0,-4],[-1,-4],[1,-4],[0,-4],[2,-4],[-3,-4],[-1,-4],[0,-4],[1,-4],[-1,-4],[0,-4],[0,-4],[-1,-4],[-1,-4],[1,-2]];
const JUMP_HIPS = { 6: [1, -9], 10: [0, -8], 14: [0, -8] };
export function commandoPose(d) {
  if (!d.grounded) { const index = d.vy < -120 ? 6 : d.vy < 80 ? 10 : 14; return { sheet: 'jump', index, hip: JUMP_HIPS[index] }; }
  const index = Math.abs(d.vx) > 0 ? 4 + Math.floor((d.stride ?? d.time * 150) / 10) % 19 : Math.floor(d.time * 7) % 4;
  return { sheet: 'legs', index, hip: WALK_HIPS[index] };
}

export function weaponMuzzle(d) {
  const [hx, hy] = d.crouching ? [0, 0] : commandoPose(d).hip;
  const pistol = !['heavy', 'flame'].includes(d.weapon) || d.ammo <= 0;
  return { x: d.x + d.facing * (hx + (d.aimUp ? 0 : pistol ? 26 : 25)),
    y: d.y + hy - (d.aimUp ? pistol ? 54 : 56 : d.crouching ? pistol ? 12 : 16 : 25) };
}

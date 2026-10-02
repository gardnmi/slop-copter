export const ORBIT_ACTOR_SCALE=1;
// Same socket in the simulation and sprite: the handheld gun ends below the
// character, to the facing side. Boot positions are never projectile origins.
export function orbitMuzzle(o){return{x:o.x+9*(o.facing||1),y:o.y+(o.weapon==='machine'?10:6)-(o.flash?2:0)};}

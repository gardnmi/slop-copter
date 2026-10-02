// W3C standard layout: west = X / Square, south = A / Cross,
// east = B / Circle. Stick and directional pad both work.
export function gamepadControls(pad) {
  const pressed = i => Boolean(pad?.connected && pad.buttons?.[i]?.pressed);
  const axis = i => pad?.connected && Math.abs(pad.axes?.[i] || 0) > .22 ? pad.axes[i] : 0;
  return {
    x: Math.max(-1, Math.min(1, Number(pressed(15)) - Number(pressed(14)) || axis(0))),
    y: Math.max(-1, Math.min(1, Number(pressed(13)) - Number(pressed(12)) || axis(1))),
    shoot: pressed(2), jump: pressed(0), grenade: pressed(1), pause: pressed(9),
  };
}

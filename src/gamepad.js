// A missing browser mapping is not a disconnected controller. The G7 SE's
// Linux HID mode exposes 15 buttons and 8 axes, including a hat and triggers.
// Prefer the browser's standard mapping on platforms that already provide it.
export function gamepadLayout(pad) {
  if (!pad?.connected) return null;
  if (pad.mapping === 'standard') return 'standard';
  if (pad.mapping === '' && pad.axes?.length === 8 && pad.buttons?.length === 15 &&
      (/3537.*1082/i.test(pad.id) || /GameSir[- ]G7 SE/i.test(pad.id))) return 'gamesir-g7-hid';
  return null;
}

export function gamepadControls(pad) {
  const layout = gamepadLayout(pad), raw = layout === 'gamesir-g7-hid';
  const pressed = i => Boolean(layout && (pad.buttons?.[i]?.pressed || pad.buttons?.[i]?.value > .5));
  const axis = i => layout && Number.isFinite(pad.axes?.[i]) && Math.abs(pad.axes[i]) > .22 ? pad.axes[i] : 0;
  const hat = i => Math.abs(axis(i)) > .5 ? Math.sign(axis(i)) : 0;
  return {
    x: Math.max(-1, Math.min(1, (raw ? hat(6) : Number(pressed(15)) - Number(pressed(14))) || axis(0))),
    y: Math.max(-1, Math.min(1, (raw ? hat(7) : Number(pressed(13)) - Number(pressed(12))) || axis(1))),
    shoot: raw ? pressed(3) || axis(4) > 0 : pressed(2) || pressed(7),
    jump: pressed(0), grenade: pressed(1), pause: pressed(raw ? 11 : 9), options: pressed(raw ? 10 : 8),
  };
}

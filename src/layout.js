// Expand the world to the available screen instead of stretching/cropping it.
// Portrait screens keep sprites playable at a minimum 640-unit world width.
export function viewportSize(width, height) {
  const scale = Math.min(width / 640, height / 672);
  return { width: width / scale, height: height / scale };
}

export function dashboardLayout(game) {
  const scale = game.hudScale;
  return { x: (game.width - 1024 * scale) / 2, y: game.hudY, scale };
}

export function yokeRect(game) {
  const { x, y, scale } = dashboardLayout(game);
  const [left, top, width, height] = game.isThemed('instruments') ? [748, 40, 96, 62] : [133, 16, 86, 86];
  return [x + left * scale, y + top * scale, width * scale, height * scale];
}

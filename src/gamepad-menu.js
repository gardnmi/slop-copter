// Navigate the same accessible controls used by keyboard and pointer input.
export function controllerMenuItems(root) {
  return [...root.querySelectorAll('button, input, select')]
    .filter(el => !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
}

export function moveControllerMenu(root, x, y) {
  const items = controllerMenuItems(root);
  if (!items.length) return;
  const current = document.activeElement, index = items.indexOf(current);
  if (x && index >= 0 && current.matches('input[type="range"], select')) {
    if (current.matches('select')) {
      current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + x));
    } else {
      const step = current.id === 'acceleration' ? Number(current.step) : 5;
      current.value = String(Math.max(Number(current.min), Math.min(Number(current.max), Number(current.value) + x * step)));
    }
    current.dispatchEvent(new Event('input', { bubbles: true }));
    current.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const next = index < 0 ? 0 : (index + (y || x) + items.length) % items.length;
  items[next].focus({ preventScroll: true });
  items[next].scrollIntoView({ block: 'nearest' });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { gamepadControls, gamepadLayout } from '../src/gamepad.js';

function gamesir() {
  return { id: 'GameSir-G7 SE Controller for Xbox (Vendor: 3537 Product: 1082)',
    connected: true, mapping: '', axes: [0, 0, 0, 0, -1, -1, 0, 0],
    buttons: Array.from({ length: 15 }, () => ({ pressed: false, value: 0 })) };
}

test('GameSir G7 SE raw HID layout detects with neutral triggers and stick drift', () => {
  const pad = gamesir(); pad.axes[0] = .08; pad.axes[1] = -.1;
  assert.equal(gamepadLayout(pad), 'gamesir-g7-hid');
  assert.deepEqual(gamepadControls(pad), gamepadControls(null));
  pad.axes[4] = 0; // Browsers can initially sanitize an untouched axis to zero.
  assert.equal(gamepadControls(pad).shoot, false);
  pad.axes[4] = .8; assert.equal(gamepadControls(pad).shoot, true);
  pad.connected = false;
  assert.deepEqual(gamepadControls(pad), gamepadControls(null));
});

test('GameSir HID maps Xbox A, B, X, View and Menu to the right actions', () => {
  for (const [index, action] of [[0, 'jump'], [1, 'grenade'], [3, 'shoot'], [10, 'options'], [11, 'pause']]) {
    const pad = gamesir(); pad.buttons[index].pressed = true;
    assert.deepEqual(gamepadControls(pad), { ...gamepadControls(null), [action]: true });
  }
  const pad = gamesir(); pad.buttons[7].pressed = true; // RB is not RT.
  assert.equal(gamepadControls(pad).shoot, false);
});

test('GameSir HID hat moves in all four directions and overrides stick drift', () => {
  const pad = gamesir(); pad.axes[0] = .7; pad.axes[1] = -.8;
  assert.equal(gamepadControls(pad).x, .7); assert.equal(gamepadControls(pad).y, -.8);
  pad.axes[6] = -1; pad.axes[7] = 1;
  assert.equal(gamepadControls(pad).x, -1); assert.equal(gamepadControls(pad).y, 1);
  pad.axes[6] = 1; pad.axes[7] = -1;
  assert.equal(gamepadControls(pad).x, 1); assert.equal(gamepadControls(pad).y, -1);
});

test('browser standard mapping takes priority; unknown raw devices are not guessed', () => {
  const pad = gamesir(); pad.mapping = 'standard';
  pad.buttons[2].pressed = true; pad.buttons[9].pressed = true;
  assert.equal(gamepadLayout(pad), 'standard');
  assert.equal(gamepadControls(pad).shoot, true); assert.equal(gamepadControls(pad).pause, true);
  const unknown = gamesir(); unknown.id = 'Unknown wheel'; unknown.buttons[0].pressed = true;
  assert.equal(gamepadLayout(unknown), null);
  assert.deepEqual(gamepadControls(unknown), gamepadControls(null));
});

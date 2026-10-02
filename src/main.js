import { weaponReadout } from './deck-weapons.js';
import './style.css';
import { Game, HZ, DEFAULT_ACCELERATION_TIME } from './game.js';
import { Renderer } from './render.js';
import { viewportSize, yokeRect } from './layout.js';
import { BossAudio } from './boss-audio.js';
import { TEST_LEVELS, createLevel } from './level-select.js';
import { gamepadControls, gamepadLayout } from './gamepad.js';
import { controllerMenuItems, moveControllerMenu } from './gamepad-menu.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);
const audio = new BossAudio();
// Keep the original storage keys so renaming the game preserves records and preferences.
const BEST_KEY = 'stunt-combat.best.v1';
const RUN_BEST_KEY = 'stunt-combat.rooftop-best.v1';
const ACCELERATION_KEY = 'stunt-combat.acceleration-time.v1';
const SOUND_KEY = 'slop-copter.sound.v1';
const COMPLETED_KEY = 'slop-copter.completed.v1';
let levelsUnlocked = false;
try { levelsUnlocked = localStorage.getItem(COMPLETED_KEY) === 'true'; } catch { /* Optional progress storage. */ }
for (const channel of ['music', 'effects']) {
  try {
    const value = localStorage.getItem(`slop-copter.${channel}-volume.v1`);
    if (value !== null) audio.setVolume(channel, Number(value));
  } catch { /* Optional preference. */ }
}
try { audio.setEnabled(localStorage.getItem(SOUND_KEY) !== 'false'); } catch { /* Optional preference. */ }
$('sound').checked = audio.enabled;
void audio.open();
// Retry browser-blocked startup audio on the first real interaction. Repeated
// inputs and restarts never replay the opening chime; the final hay landing does.
function unlockAudio(event) {
  if (event.isTrusted && !event.target.closest?.('label:has(#sound)')) audio.unlock();
}
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
function readBest(key = BEST_KEY) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}
function readAccelerationTime() {
  try {
    const value = localStorage.getItem(ACCELERATION_KEY);
    return value === null ? DEFAULT_ACCELERATION_TIME : Number(value);
  } catch { return DEFAULT_ACCELERATION_TIME; }
}
let game = new Game({ best: readBest(), bestRun: readBest(RUN_BEST_KEY), accelerationTime: readAccelerationTime() });
let observedRetrySerial = game.retrySerial;
let storedBest = game.best;
let storedRunBest = game.runner.best;
let loaded = false, started = false, drag = null, uiSignature = '';
let testLevel = null, levelMenuWasPaused = false;
const levelDialog = $('level-dialog');
const keys = new Set();
const touches = new Map();
const jumpSources = new Set();
const deckTouches = new Map();
const deckButtons = [...document.querySelectorAll('[data-deck-action]')];
let padState = gamepadControls(null), previousPad = gamepadControls(null), padBlocked = false;
let activePad = null, padUsed = false, padReconnecting = false, padMenuDirection = '', padMenuRepeat = 0;
let controllerStatus = '';
const directionButtons = [...document.querySelectorAll('[data-direction]')];
const movementKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
const landingFlight = () => !game.orbit.active && !game.boarding.active &&
  game.assault.phase === 'landing' && game.assault.recovery?.status === 'flying';

function focusGame() { canvas.focus({ preventScroll: true }); }
function resize() {
  const bounds = $('playfield').getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const size = viewportSize(bounds.width, bounds.height);
  game.resize(size.width, size.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  clearInput();
  if (loaded) renderer.draw(game);
}
new ResizeObserver(resize).observe($('playfield'));
window.addEventListener('resize', resize);

function syncFullscreen() {
  const active = Boolean(document.fullscreenElement);
  $('fullscreen').innerHTML = `${active ? 'Exit fullscreen' : 'Fullscreen'} <span class="shortcut">F</span>`;
  $('fullscreen').setAttribute('aria-pressed', String(active));
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.fullscreenEnabled) await $('game-screen').requestFullscreen({ navigationUI: 'hide' });
    else { $('status').textContent = 'Fullscreen is unavailable in this browser. The game already fills the window.'; return; }
    focusGame();
  } catch {
    $('status').textContent = 'Fullscreen could not start. You can keep playing in this window.';
  }
}
document.addEventListener('fullscreenchange', () => { syncFullscreen(); resize(); });
function clearInput() {
  keys.clear(); touches.clear(); deckTouches.clear(); jumpSources.clear(); drag = null;
  padBlocked = true; padState = gamepadControls(null);
  game.releaseControls();
  directionButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
  deckButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
}
function restart() {
  if (!loaded) return;
  audio.reset(); audio.unlock();
  clearInput();
  game = createLevel('classic', levelOptions());
  testLevel = null;
  updateLevelURL(null);
  started = true;
  uiSignature = '';
  syncUI(); focusGame();
}
function begin() {
  if (!loaded) return;
  audio.unlock();
  if (game.state === 'game_over') {
    audio.reset(); clearInput();
    game = game.continueSegment();
    uiSignature = '';
  }
  started = true;
  game.paused = false;
  $('instructions').hidden = true;
  $('help').setAttribute('aria-expanded', 'false');
  clearInput(); syncUI(); focusGame();
}
function pause(force) {
  if (!started) return;
  game.paused = force ?? !game.paused;
  clearInput(); syncUI();
  if (!game.paused) focusGame();
}
function drop() {
  if (!loaded || !started || game.paused) return;
  if (game.orbit.dead) game.orbit.retry(game);
  else if (game.boarding.dead) game.boarding.retry(game);
  else if (game.assault.dead) game.assault.retry(game);
  else if (game.runner.dead) game.runner.retry(game);
  else game.drop();
  syncUI(); focusGame();
}
function pressAction(source) {
  if (game.orbit.active) {
    if (!['Space', 'KeyJ', 'gamepad', 'gamepad-shoot'].includes(source) || jumpSources.has(source) || !game.orbit.canAct && !game.orbit.dead) return;
    jumpSources.add(source); drop(); return;
  }
  if (!game.boarding.active && (game.assault.active || !game.runner.active)) { drop(); return; }
  if (jumpSources.has(source)) return;
  jumpSources.add(source); drop();
}
function releaseAction(source) {
  jumpSources.delete(source);
  if (!jumpSources.size) { game.runner.releaseJump(); game.boarding.releaseJump(); game.orbit.releaseAction(); }
}
function toggleHelp() {
  const show = $('instructions').hidden;
  $('instructions').hidden = !show;
  $('help').setAttribute('aria-expanded', String(show));
  if (show && started && !game.paused) pause(true);
  syncUI();
}

function levelOptions() {
  return { width: game.width, height: game.height, accelerationTime: game.accelerationTime,
    best: storedBest, bestRun: storedRunBest };
}
function updateLevelURL(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('level', id);
  else url.searchParams.delete('level');
  history.replaceState(null, '', url);
}
function describeLevel() {
  const level = TEST_LEVELS.find(level => level.id === $('level-select').value);
  $('level-description').textContent = level.description;
  $('level-link').textContent = `?level=${level.id}`;
}
function openLevels() {
  if (!loaded || !levelsUnlocked || levelDialog.open) return;
  levelMenuWasPaused = game.paused;
  clearInput(); game.paused = true;
  if (testLevel) $('level-select').value = testLevel;
  describeLevel(); levelDialog.showModal(); syncUI();
  $('level-select').focus();
}
function startLevel(id) {
  if (!loaded || !TEST_LEVELS.some(level => level.id === id)) return;
  clearInput(); audio.reset(); audio.unlock();
  game = createLevel(id, levelOptions());
  testLevel = id; started = true;
  $('instructions').hidden = true; $('help').setAttribute('aria-expanded', 'false');
  updateLevelURL(id);
  if (levelDialog.open) levelDialog.close('start');
  uiSignature = ''; lastTime = undefined;
  syncUI(); renderer.draw(game); focusGame();
}
for (const group of new Set(TEST_LEVELS.map(level => level.group))) {
  const options = document.createElement('optgroup'); options.label = group;
  for (const level of TEST_LEVELS.filter(level => level.group === group)) {
    const option = document.createElement('option'); option.value = level.id; option.textContent = level.name;
    options.append(option);
  }
  $('level-select').append(options);
}
$('levels').addEventListener('click', openLevels);
$('level-select').addEventListener('change', describeLevel);
$('level-form').addEventListener('submit', event => { event.preventDefault(); if (levelsUnlocked) startLevel($('level-select').value); });
$('close-levels').addEventListener('click', () => levelDialog.close('cancel'));
levelDialog.addEventListener('cancel', event => { event.preventDefault(); levelDialog.close('cancel'); });
levelDialog.addEventListener('close', () => {
  if (levelDialog.returnValue !== 'start') game.paused = levelMenuWasPaused;
  clearInput(); uiSignature = ''; syncUI(); focusGame();
});

$('begin').addEventListener('click', begin);
$('restart').addEventListener('click', restart);
$('pause').addEventListener('click', () => pause());
$('help').addEventListener('click', toggleHelp);
$('close-help').addEventListener('click', () => { toggleHelp(); focusGame(); });
$('fullscreen').addEventListener('click', toggleFullscreen);
$('sound').addEventListener('change', event => {
  audio.setEnabled(event.target.checked);
  try { localStorage.setItem(SOUND_KEY, String(audio.enabled)); } catch { /* Optional preference. */ }
});
for (const channel of ['music', 'effects']) {
  const slider = $(`${channel}-volume`), output = $(`${channel}-volume-value`);
  function syncVolume() {
    const percent = Math.round(audio.volumes[channel] * 100);
    slider.value = String(percent); output.value = `${percent}%`;
    slider.setAttribute('aria-valuetext', percent === 0 ? 'Muted' : `${percent}%`);
  }
  slider.addEventListener('input', () => {
    audio.setVolume(channel, slider.valueAsNumber / 100); syncVolume();
    try { localStorage.setItem(`slop-copter.${channel}-volume.v1`, String(audio.volumes[channel])); } catch { /* Optional preference. */ }
  });
  syncVolume();
}
function syncFlightTuning() {
  $('acceleration').value = String(game.accelerationTime);
  $('acceleration-value').textContent = `${game.accelerationTime.toFixed(2)} s to full speed`;
}
$('acceleration').addEventListener('input', event => {
  game.setAccelerationTime(event.target.valueAsNumber);
  syncFlightTuning();
  try { localStorage.setItem(ACCELERATION_KEY, String(game.accelerationTime)); } catch { /* Optional preference storage. */ }
});
syncFlightTuning();
$('drop-button').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault();
  $('drop-button').setPointerCapture(event.pointerId);
  pressAction(`pointer:${event.pointerId}`);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('drop-button').addEventListener(name, event => releaseAction(`pointer:${event.pointerId}`));
// A second touch does not generate a click on every browser. Pointerdown handles
// simultaneous steering/drop; detail=0 retains keyboard and assistive activation.
$('drop-button').addEventListener('click', event => { if (event.detail === 0) { drop(); game.runner.releaseJump(); game.boarding.releaseJump(); } });

for (const button of deckButtons) {
  const action = button.dataset.deckAction;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !loaded || !started || game.paused || !game.boarding.active) return;
    event.preventDefault(); focusGame(); button.setPointerCapture(event.pointerId);
    deckTouches.set(event.pointerId, action); button.setAttribute('aria-pressed', 'true');
    if (action === 'jump') pressAction(`deck:${event.pointerId}`);
    else if (action === 'grenade') game.boarding.throwGrenade();
    else game.boarding.queueShot();
    syncUI();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, event => {
    deckTouches.delete(event.pointerId); releaseAction(`deck:${event.pointerId}`);
    button.setAttribute('aria-pressed', String([...deckTouches.values()].includes(action)));
  });
  button.addEventListener('click', event => {
    if (event.detail || game.paused || !started) return;
    if (action === 'jump') { drop(); game.boarding.releaseJump(); }
    else if (action === 'grenade') game.boarding.throwGrenade();
    else game.boarding.queueShot();
  });
}

window.addEventListener('keydown', event => {
  if (levelDialog.open || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (movementKeys.includes(event.code)) {
    if (!loaded || !started || game.paused || !game.canFly) return;
    event.preventDefault();
    focusGame();
    keys.add(event.code);
    if (!game.orbit.active && !game.assault.active && game.runner.active && ['ArrowUp', 'KeyW'].includes(event.code) && !event.repeat) pressAction(event.code);
    return;
  }
  // Keep Space/Enter activation and normal keyboard navigation on menu buttons.
  if (event.target !== canvas) return;
  if (!game.orbit.active && game.boarding.active && ['KeyJ', 'KeyK', 'KeyL'].includes(event.code)) {
    event.preventDefault();
    if (event.repeat || !loaded || !started || game.paused) return;
    if (event.code === 'KeyJ') { keys.add(event.code); game.boarding.queueShot(); }
    else if (event.code === 'KeyK') pressAction('KeyK');
    else game.boarding.throwGrenade();
    syncUI(); return;
  }
  const actionKey = event.code === 'Space' || game.orbit.active && event.code === 'KeyJ';
  if (!actionKey && !['KeyP', 'Escape', 'KeyR', 'Slash', 'KeyF'].includes(event.code)) return;
  event.preventDefault();
  if (event.repeat || !loaded) return;
  if (event.code === 'KeyF') { toggleFullscreen(); return; }
  if (actionKey) {
    if (!started || game.paused || game.state === 'game_over') begin();
    else if (landingFlight()) keys.add('Space');
    else pressAction(event.code);
  } else if (event.code === 'KeyP' || event.code === 'Escape') pause();
  else if (event.code === 'KeyR') restart();
  else toggleHelp();
});
window.addEventListener('keyup', event => { keys.delete(event.code); releaseAction(event.code); });
canvas.addEventListener('blur', () => { if (!touches.size && !deckTouches.size && !drag) clearInput(); });
window.addEventListener('blur', () => { clearInput(); pause(true); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearInput(); pause(true); }
});

function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * game.width / bounds.width, y: (event.clientY - bounds.top) * game.height / bounds.height };
}
function inside({ x, y }, [left, top, width, height]) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}
function moveYoke(p) {
  const [x, y, w, h] = yokeRect(game);
  game.setYoke((p.x - x - w / 2) / (w / 2), (p.y - y - h / 2) / (h / 2));
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !loaded) return;
  event.preventDefault(); focusGame();
  if (game.orbit.active) return;
  if (!started) return begin();
  if (game.paused || !game.canFly || drag) return;
  if (game.runner.active) {
    canvas.setPointerCapture(event.pointerId); pressAction(`pointer:${event.pointerId}`); return;
  }
  const p = point(event);
  const yoke = yokeRect(game);
  if (inside(p, yoke)) drag = { id: event.pointerId };
  else if (p.y < game.hudY) {
    pressAction(`pointer:${event.pointerId}`);
    return;
  }
  if (drag) {
    canvas.setPointerCapture(event.pointerId);
    moveYoke(p);
  }
});
canvas.addEventListener('pointermove', event => {
  if (!loaded || !started || game.paused || !game.canFly || drag?.id !== event.pointerId) return;
  moveYoke(point(event));
});
function finishDrag(event) {
  releaseAction(`pointer:${event.pointerId}`);
  if (!drag || drag.id !== event.pointerId) return;
  drag = null;
  game.setYoke(0, 0);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, finishDrag);
canvas.addEventListener('contextmenu', event => event.preventDefault());
for (const button of directionButtons) {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!loaded || !started || game.paused || !game.canFly) return;
    focusGame();
    touches.set(event.pointerId, button.dataset.direction);
    button.setPointerCapture(event.pointerId);
    button.setAttribute('aria-pressed', 'true');
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => {
      touches.delete(event.pointerId);
      button.setAttribute('aria-pressed', String([...touches.values()].includes(button.dataset.direction)));
    });
  }
}
function pollGamepad() {
  let pad = null, connected = [], unavailable = false;
  try {
    connected = [...(navigator.getGamepads?.() || [])].filter(p => p?.connected);
    const pads = connected.filter(p => gamepadLayout(p));
    pad = pads.find(p => `${p.index ?? 0}:${p.id ?? ''}` === activePad) || pads[0];
  } catch { unavailable = true; }
  const status = pad ? `Controller connected: ${pad.id}. Left stick or D-pad moves. A / Cross confirms; B / Circle goes back. Menu / Start pauses; View / Share opens Options.`
    : connected.length ? `Controller detected: ${connected[0].id}. This controller's button layout is not supported yet. Keyboard controls are available.`
      : unavailable ? 'Controller access is blocked by this browser. Open the game directly in a browser tab.'
        : 'Connect an Xbox, PlayStation or compatible controller and press a button to activate it.';
  if (status !== controllerStatus) {
    controllerStatus = status;
    $('controller-status').textContent = status;
    $('controller-hint').hidden = !pad;
  }
  const identity = pad ? `${pad.index ?? 0}:${pad.id ?? ''}` : null;
  if (identity !== activePad) {
    if (activePad !== null) {
      releaseAction('gamepad'); releaseAction('gamepad-shoot');
      if (padUsed && started) pause(true);
      padState = gamepadControls(null); padReconnecting = true;
    }
    activePad = identity; padUsed = false;
    previousPad = gamepadControls(null);
  }
  const next = gamepadControls(pad);
  if (padReconnecting) {
    if (pad && !Object.values(next).some(Boolean)) padReconnecting = false;
    previousPad = next; padState = gamepadControls(null); return;
  }
  const rise = key => next[key] && !previousPad[key];
  if (Object.values(next).some(Boolean)) { padUsed = true; document.body.classList.add('controller-input'); }
  if (!document.hidden && loaded) {
    if (rise('options') && !levelDialog.open) {
      toggleHelp();
      if (!$('instructions').hidden) $('sound').focus();
      else if (game.paused) $('begin').focus();
      previousPad = next; return;
    }
    if (rise('pause')) {
      if (levelDialog.open) levelDialog.close('cancel');
      else if (!$('instructions').hidden || !started || game.paused) begin();
      else { pause(); $('begin').focus(); }
      previousPad = next; return;
    }
    if (!started || game.paused || levelDialog.open || !$('instructions').hidden) {
      padState = gamepadControls(null);
      const root = levelDialog.open ? levelDialog : !$('instructions').hidden ? $('instructions') : $('game-screen');
      const menuItems = controllerMenuItems(root);
      const x = Math.abs(next.x) > .5 ? Math.sign(next.x) : 0, y = Math.abs(next.y) > .5 ? Math.sign(next.y) : 0;
      const direction = `${x},${y}`;
      if ((x || y) && (direction !== padMenuDirection || ++padMenuRepeat >= 20)) {
        moveControllerMenu(root, x, y); padMenuRepeat = direction !== padMenuDirection ? 0 : 14;
      }
      if (!x && !y) padMenuRepeat = 0;
      padMenuDirection = direction;
      if (rise('jump')) {
        const target = document.activeElement;
        if (levelDialog.open && target === $('level-select')) startLevel(target.value);
        else if (menuItems.includes(target)) target.click();
        else if (levelDialog.open || !$('instructions').hidden) menuItems[0]?.focus();
        else begin();
      } else if (rise('grenade')) {
        if (levelDialog.open) levelDialog.close('cancel');
        else if (!$('instructions').hidden) { toggleHelp(); if (game.paused) $('begin').focus(); }
        else if (started && game.paused) begin();
      }
      previousPad = next; return;
    }
  }
  padMenuDirection = ''; padMenuRepeat = 0;
  if (padBlocked) {
    if (!Object.values(next).some(Boolean)) padBlocked = false;
    previousPad = next; padState = gamepadControls(null); return;
  }
  padState = next;
  if (!next.jump && previousPad.jump) releaseAction('gamepad');
  if (!next.shoot && previousPad.shoot) releaseAction('gamepad-shoot');
  if (loaded && started && !game.paused && !levelDialog.open) {
    if (rise('jump') && !landingFlight()) pressAction('gamepad');
    if (game.orbit.active && rise('shoot')) pressAction('gamepad-shoot');
    if (!game.orbit.active && game.boarding.playing && next.grenade && !previousPad.grenade) game.boarding.throwGrenade();
  }
  previousPad = next;
}
function steer() {
  if (drag) return;
  const held = [...touches.values()];
  const left = keys.has('ArrowLeft') || keys.has('KeyA') || held.includes('left');
  const right = keys.has('ArrowRight') || keys.has('KeyD') || held.includes('right');
  const up = keys.has('ArrowUp') || keys.has('KeyW') || held.includes('up') || (landingFlight() && (keys.has('Space') || padState.jump || padState.shoot));
  const down = keys.has('ArrowDown') || keys.has('KeyS') || held.includes('down');
  // Each chapter interprets the yoke: recovery uses tilt and lift, preserving
  // momentum when the pilot releases the keys.
  game.setYoke(Number(right) - Number(left) || padState.x, Number(down) - Number(up) || padState.y);
  if (!game.orbit.active && game.boarding.active) game.boarding.setFire(keys.has('KeyJ') || [...deckTouches.values()].includes('shoot') || padState.shoot);
}

function syncUI() {
  if (observedRetrySerial !== game.retrySerial) {
    observedRetrySerial = game.retrySerial; clearInput(); uiSignature = '';
  }
  audio.update(game, { started });
  if (!levelsUnlocked && game.completedLoops > 0) {
    levelsUnlocked = true;
    try { localStorage.setItem(COMPLETED_KEY, 'true'); } catch { /* Keep it unlocked for this session. */ }
  }
  $('levels').hidden = !levelsUnlocked;
  $('level-help').hidden = !levelsUnlocked;
  const run = game.runner, air = game.assault, deck = game.boarding, orbit = game.orbit;
  const signature = [started, testLevel, levelDialog.open, game.paused, game.state, game.message, game.shiftCount, game.retaliation, game.counterattack.phase, game.counterattack.kills, game.boss.phase, game.boss.canGrenade, game.level, game.best, game.score, game.wagonLabel, run.phase, run.best, run.distance, run.dead && run.age >= 25, air.phase, air.route, air.health, air.dead && air.age >= 30, $('instructions').hidden].join('|');
  const fullSignature = `${signature}|${deck.phase}|${deck.health}|${deck.ammo}|${deck.grenades}|${deck.section}|${deck.dead && deck.age >= 30}|${orbit.phase}|${orbit.health}|${orbit.ammo}|${orbit.gems}|${orbit.band}`;
  if (fullSignature === uiSignature) return;
  uiSignature = fullSignature;
  const over = game.state === 'game_over';
  document.body.classList.toggle('digital', game.fullyThemed);
  document.body.classList.toggle('combat', game.retaliation);
  document.body.classList.toggle('runner', run.active);
  document.body.classList.toggle('on-foot', run.active && !run.flying && !air.active);
  document.body.classList.toggle('assault', air.active);
  document.body.classList.toggle('deck', deck.active);
  document.body.classList.toggle('orbit', orbit.active);
  $('game-title').textContent = 'SLOP COPTER';
  document.querySelector('meta[name="theme-color"]').content = run.active ? '#343642' : game.fullyThemed ? '#06080c' : '#ffffff';
  $('mode-label').textContent = run.active ? run.flying ? '● PURSUIT' : run.phase === 'escaped' ? '● EXTRACTED' : run.rescue ? '● EXTRACTION' : run.running || run.dead ? '● ROOFTOP ESCAPE' : '● GOING DOWN' : game.boss.phase === 'won' ? '● HUNTER DOWN' : game.boss.fighting ? '● LIQUID HUNTER' : game.boss.phase === 'victory' ? '● VICTORY' : game.boss.ownsCart ? '● SIGNAL RETURNING' : game.counterattack.phase === 'cleared' ? '● VICTORY' : game.counterattack.armed ? '● COUNTERATTACK' : game.inCinematic ? '● INTERLUDE' : game.retaliation ? '● RETALIATION' : game.fullyThemed ? '● SIMULATION' : game.shiftCount ? `◈ SIGNAL ${game.shiftCount}/6` : '● CLASSIC';
  if (air.active) $('mode-label').textContent = air.phase === 'turn' ? '● NEW HEADING' : air.phase === 'secured' ? '● DECK SECURED' : air.phase === 'landing' ? '● CARRIER LANDING' : `● ${air.sectionName}`;
  if (deck.active) $('mode-label').textContent = `● ${deck.label}`;
  if (orbit.active) $('mode-label').textContent = `● ${orbit.label}`;
  $('pause').innerHTML = `${game.paused ? 'Resume' : 'Pause'} <span class="shortcut">P</span>`;
  $('pause').disabled = !started;
  $('drop-button').disabled = !started || game.paused || !(run.dead ? run.age >= 25 : game.canDrop);
  $('drop-button').innerHTML = run.active ? run.dead ? `${run.rescueCheckpoint ? 'RETRY PICKUP' : 'RUN AGAIN'} <span>↻</span>` : run.running ? 'JUMP <span>↑</span>' : run.flying ? 'FLY <span>→</span>' : run.phase === 'escaped' ? 'EXTRACTED <span>✓</span>' : run.phase === 'lifting' ? 'HOLD ON <span>↑</span>' : 'GET READY <span>—</span>' : game.boss.fighting ? `GRENADE <span>${game.boss.canGrenade ? '↓' : 'WAIT'}</span>` : game.boss.ownsCart ? 'HOLD <span>—</span>' : game.counterattack.armed ? 'AUTO <span>FIRE</span>' : game.autoDeploy ? `AUTO DROP <span>${game.counterattack.created}/8</span>` : game.counterattack.phase === 'waiting' || game.inCinematic ? 'GET READY <span>—</span>' : 'DROP <span>↓</span>';
  if (air.active) {
    $('drop-button').disabled = !started || game.paused || !(air.dead && air.age >= 30);
    $('drop-button').innerHTML = air.dead ? 'CONTINUE <span>↻</span>' : air.playing ? 'AUTO <span>FIRE</span>' : air.phase === 'secured' ? 'SECURED <span>✓</span>' : 'STAND BY <span>—</span>';
  }
  $('drop-button').hidden = air.active && !air.dead && !deck.active;
  if (deck.active) {
    $('drop-button').disabled = !started || game.paused || !(deck.dead ? deck.age >= 30 : deck.playing);
    $('drop-button').innerHTML = deck.dead ? 'CONTINUE <span>↻</span>' : deck.playing ? 'JUMP <span>↑</span>' : 'CLEARED <span>✓</span>';
    $('drop-button').hidden = true;
  }
  $('deck-actions').hidden = !deck.active;
  for (const button of deckButtons) {
    const action = button.dataset.deckAction;
    button.disabled = !started || game.paused || (action === 'jump' ? !(deck.playing || deck.dead && deck.age >= 30) : !deck.playing || action === 'grenade' && !deck.grenades);
    const caption = ({shoot:'SHOOT',jump:deck.dead?'RETRY':'JUMP',grenade:'BOMB'})[action];
    button.querySelector('small').textContent = caption;
    button.setAttribute('aria-label', ({shoot:'Shoot (J)',jump:'Jump (K)',grenade:'Throw grenade (L)'})[action]);
  }
  $('runner-help').hidden = !run.active || air.active || orbit.active;
  $('assault-help').hidden = !air.active || orbit.active;
  $('orbit-help').hidden = !orbit.active;
  for (const button of directionButtons) {
    const direction = button.dataset.direction;
    button.setAttribute('aria-label', deck.active ? ({ up: 'Aim up', down: 'Duck', left: 'Move left', right: 'Move right' })[direction]
      : air.recovery ? ({ up: 'Lift', down: 'Cut lift', left: 'Tilt left', right: 'Tilt right' })[direction] : `Fly ${direction}`);
  }
  if (orbit.active) canvas.setAttribute('aria-label', 'Cloudfall. Left and right arrows, A and D, left stick or D-pad move. J, Space or controller A jumps on a ledge; release and press again to fire your gun while airborne. Controller X or right trigger also jumps and fires. Landing or stomping white enemies reloads. Shoot red spiked enemies; they cannot be stomped. Deaths automatically restart the checkpoint. P or Menu pauses. R restarts.');
  else if (deck.active) canvas.setAttribute('aria-label', 'Carrier deck run-and-gun. Arrows or WASD move. J shoots, K jumps, L throws a grenade. Down ducks. Up aims upward. Down plus K drops through catwalks. Gamepad X shoots, A jumps, B throws. Destroy both phases of the spacecraft boss. Deaths automatically restart the checkpoint. P pauses. R restarts.');
  else if (air.recovery) canvas.setAttribute('aria-label', 'Carrier landing. Up, W or Space powers lift and uses fuel. Left and Right or A and D tilt. Release lift to descend; momentum carries on. Catch the moving carrier and land level on the lit aft pad with low relative speed and a gentle descent. Crashes automatically restart the landing. P pauses.');
  else if (air.active) canvas.setAttribute('aria-label', 'Air assault. Arrows or WASD fly. Cannon fires automatically. Defeat the enemy airship and reach the friendly carrier for landing. Deaths automatically restart the checkpoint. P pauses. R restarts.');
  else if (run.active) canvas.setAttribute('aria-label', run.flying ? 'Self-destruct countdown. Hold the right arrow to reach the rooftops before the expanding blast catches the helicopter.' : run.rescue ? 'Helicopter extraction. Space, up arrow or touch jumps to grab the boarding rail when the helicopter flies low. A missed pickup restarts automatically. P pauses. R starts a new game.' : 'Rooftop escape. Run from the expanding explosion automatically. Space, up arrow or touch jumps. Hold for longer jumps. Falls automatically restart the rooftops. P pauses. R starts a new game.');
  else if (game.boss.fighting) canvas.setAttribute('aria-label', 'Slop Copter. Arrow keys fly. Space drops a grenade. Dodge homing rockets. Five grenade hits destroy the chrome horse and buggy.');
  else if (game.autoDeploy) canvas.setAttribute('aria-label', 'Slop Copter. Stuntmen jump automatically until eight Terminators have been created. Keep flying with the arrow keys. P pauses. R restarts.');
  else canvas.setAttribute('aria-label', 'Slop Copter. Hold arrow keys or W A S D to accelerate; release to slow down. Space or click drops the stuntman. P pauses. R restarts. F toggles fullscreen.');
  $('status').textContent = `${testLevel ? 'TEST RUN · ' : ''}${!started ? 'Flight equipment ready. Awaiting pilot.' : game.paused ? 'Paused. Press Space or Resume to keep flying.' : game.message}`;
  $('flight-status').textContent = air.active ? `HULL ${air.health}/6 · AUTO CANNON` : run.active ? `${run.distance} m · BEST ${run.best} m` : `LEVEL ${String(game.level).padStart(2, '0')} · ${game.wagonLabel}`;
  if (air.recovery) $('flight-status').textContent = 'CARRIER RECOVERY · UP / SPACE: LIFT · LEFT / RIGHT: TILT';
  if (deck.active) $('flight-status').textContent = `HEALTH ${deck.health}/5 · ${weaponReadout(deck)} · BOMBS ${deck.grenades}`;
  if (orbit.active) $('flight-status').textContent = orbit.cinematic ? (orbit.phase==='return'?'FULL CIRCLE':orbit.eater?'SLOP EATER':'LIFT COLLAPSE → DOWNWELL') : `HEALTH ${orbit.health}/4 · AMMO ${orbit.ammo}/${orbit.charge} · BEST CHAIN ${orbit.bestCombo}`;
  if (game.awaitingRetry) {
    $('status').textContent = game.paused ? 'Paused. Automatic restart will resume with the game.' : 'Restarting from the last checkpoint…';
    $('drop-button').disabled = true; $('drop-button').innerHTML = 'RESTARTING <span>↻</span>';
    deckButtons.forEach(button => { button.disabled = true; });
  }
  $('overlay').hidden = levelDialog.open || !$('instructions').hidden || (started && !game.paused);
  $('key-guide').hidden = over || run.active || orbit.active;
  if (game.paused) {
    $('dialog-eyebrow').textContent = 'FLIGHT RECORDER / HOLD';
    $('dialog-title').textContent = 'Take a breather.';
    $('dialog-copy').textContent = 'Your flight is paused. Everything can wait.';
    $('begin').textContent = 'Resume flight ↗';
    $('dialog-footnote').textContent = 'Press Space or P to continue.';
  } else if (!started) {
    $('begin').textContent = 'Begin flight ↗';
  }
  if (!testLevel && game.best > storedBest) {
    storedBest = game.best;
    try { localStorage.setItem(BEST_KEY, String(storedBest)); } catch { /* Storage can be unavailable in private/embedded browsers. */ }
  }
  if (!testLevel && run.best > storedRunBest) {
    storedRunBest = run.best;
    try { localStorage.setItem(RUN_BEST_KEY, String(storedRunBest)); } catch { /* Optional record storage. */ }
  }
}

let lastTime;
function frame(now) {
  const dt = lastTime === undefined ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  if (loaded) {
    pollGamepad();
    if (started && !game.paused) { steer(); game.step(dt); }
    renderer.draw(game);
    syncUI();
  }
  requestAnimationFrame(frame);
}

try {
  await renderer.load();
  loaded = true;
  $('begin').disabled = false;
  $('restart').disabled = false;
  $('levels').disabled = false;
  syncUI();
  renderer.draw(game);
  focusGame();
  const requestedLevel = new URLSearchParams(location.search).get('level');
  if (requestedLevel) startLevel(requestedLevel);
  requestAnimationFrame(frame);
} catch (error) {
  $('dialog-title').textContent = 'Flight equipment missing.';
  $('dialog-copy').textContent = 'A sprite could not load. Reload the page to try again.';
  $('begin').textContent = 'Reload game ↻';
  $('begin').disabled = false;
  $('begin').addEventListener('click', () => location.reload());
  $('status').textContent = 'Unable to load game assets.';
  console.error('Failed to load Slop Copter assets:', error);
}

// Deterministic test access is excluded from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.__stunt = {
    get game() { return game; },
    get audio() { return audio; },
    advance(ticks, fromControls = false) {
      for (let i = 0; i < ticks; i++) { if (fromControls) { pollGamepad(); if (!game.paused) steer(); } game.step(1 / HZ); }
      renderer.draw(game); syncUI();
    },
    render() { renderer.draw(game); syncUI(); },
  };
}

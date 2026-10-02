'use strict';
// GROK SKY - keyboard / mouse (pointer lock) / touch input
(() => {
const I = SKY.Input = {
  keys: {}, move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, edges: {}, holds: {}, throttleAbs: null, locked: false, touchMove: { x: 0, y: 0 }, touchYaw: 0,
  edge(n) { const v = !!this.edges[n]; return v; },
  clearEdges() { this.edges = {}; },
  hold(n) { return !!this.holds[n]; },
};
const KEYMAP = { KeyF: 'interact', Space: 'jump', Digit1: 'tool1', Digit2: 'tool2', Digit3: 'tool3', Tab: 'map', Escape: 'pause', KeyV: 'cam', KeyG: 'gear', KeyZ: 'flaps', KeyT: 'ap', KeyP: 'addPax', KeyM: 'mute', KeyC: 'cam', KeyH: 'help', KeyR: 'grab', KeyX: 'drop', KeyL: 'autoland', KeyN: 'horn' };
const HOLDMAP = { ShiftLeft: ['thrUp', 'run'], ShiftRight: ['thrUp', 'run'], ControlLeft: 'thrDown', ControlRight: 'thrDown', KeyQ: 'yawL', KeyE: 'yawR', KeyB: 'brake', Space: 'jump' };
// a key can drive several holds (Shift = throttle up in the cockpit, RUN on foot)
function setHold(code, v) { const h = HOLDMAP[code]; if (!h) return; for (const n of [].concat(h)) I.holds[n] = v; }
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!I.keys[e.code] && KEYMAP[e.code]) I.edges[KEYMAP[e.code]] = true;
  I.keys[e.code] = true; setHold(e.code, true);
  SKY.Audio.init();
});
addEventListener('keyup', (e) => { I.keys[e.code] = false; setHold(e.code, false); });
addEventListener('blur', () => { I.keys = {}; I.holds = {}; });
I.updateMove = function () {
  const k = this.keys;
  let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  if (this.touchMove.x || this.touchMove.y) { x = this.touchMove.x; y = this.touchMove.y; }
  this.move.x = x; this.move.y = y;
};
// mouse
I.bindCanvas = function (cv) {
  cv.addEventListener('mousedown', (e) => {
    SKY.Audio.init();
    if (SKY.isTouch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (!I.locked && SKY.Game && SKY.Game.state === 'play' && !SKY.Game.uiOpen()) { cv.requestPointerLock && cv.requestPointerLock(); }
    if (e.button === 0) { I.edges.action = true; I.holds.action = true; }
    if (e.button === 2) I.edges.grab = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) I.holds.action = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => { if (I.locked) { I.look.dx += e.movementX || 0; I.look.dy += e.movementY || 0; } });
  document.addEventListener('pointerlockchange', () => {
    const was = I.locked; I.locked = document.pointerLockElement === cv;
    if (was && !I.locked && SKY.Game && SKY.Game.state === 'play' && !SKY.Game.uiOpen() && !SKY.Game.ignoreUnlock) SKY.Game.pause(true);
    SKY.Game && (SKY.Game.ignoreUnlock = false);
  });
};
// touch
I.bindTouch = function () {
  const root = document.getElementById('touch'); if (!root) return;
  const joy = document.getElementById('joyzone'), knob = document.getElementById('joyknob'), base = document.getElementById('joybase'), look = document.getElementById('lookzone');
  let joyId = null, jx0 = 0, jy0 = 0, lookId = null, lx = 0, ly = 0;
  const R = 55;
  joy.addEventListener('touchstart', (e) => { e.preventDefault(); SKY.Audio.init(); const t = e.changedTouches[0]; joyId = t.identifier; jx0 = t.clientX; jy0 = t.clientY; base.style.display = 'block'; base.style.left = (jx0 - 60) + 'px'; base.style.top = (jy0 - 60) + 'px'; knob.style.transform = 'translate(0px,0px)'; }, { passive: false });
  const jmove = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { let dx = t.clientX - jx0, dy = t.clientY - jy0; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; I.touchMove.x = dx / R; I.touchMove.y = -dy / R; } };
  const jend = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; I.touchMove.x = 0; I.touchMove.y = 0; base.style.display = 'none'; } };
  joy.addEventListener('touchmove', (e) => { e.preventDefault(); jmove(e); }, { passive: false }); joy.addEventListener('touchend', jend); joy.addEventListener('touchcancel', jend);
  look.addEventListener('touchstart', (e) => { e.preventDefault(); SKY.Audio.init(); const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; }, { passive: false });
  look.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === lookId) { I.look.dx += (t.clientX - lx) * 1.6; I.look.dy += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY; } }, { passive: false });
  const lend = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
  look.addEventListener('touchend', lend); look.addEventListener('touchcancel', lend);
  root.querySelectorAll('[data-act]').forEach((b) => {
    const act = b.dataset.act, hold = b.dataset.hold;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); SKY.Audio.init(); I.edges[act] = true; if (hold) I.holds[hold] = true; b.classList.add('on'); }, { passive: false });
    const up = (e) => { e.preventDefault(); if (hold) I.holds[hold] = false; b.classList.remove('on'); };
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    b.addEventListener('mousedown', (e) => { if (!SKY.isTouch) return; I.edges[act] = true; if (hold) I.holds[hold] = true; });
    b.addEventListener('mouseup', () => { if (hold) I.holds[hold] = false; });
  });
  // 3.5: AUTO LAND button lives outside #touch (it is shown on desktop too)
  I.runOn = false;
  // throttle slider
  const thr = document.getElementById('thrtrack'), thrk = document.getElementById('thrknob');
  const setThr = (t) => { const r = thr.getBoundingClientRect(); const v = SKY.clamp(1 - (t.clientY - r.top) / r.height, 0, 1); I.throttleAbs = v; };
  thr.addEventListener('touchstart', (e) => { e.preventDefault(); setThr(e.changedTouches[0]); }, { passive: false });
  thr.addEventListener('touchmove', (e) => { e.preventDefault(); setThr(e.changedTouches[0]); }, { passive: false });
  I.thrKnob = thrk;
};
// 3.5 AUTO LAND button (desktop + touch): a plain click/tap fires the 'autoland' edge
I.bindAutoLand = function () {
  const b = document.getElementById('albtn'); if (!b || b.bound) return; b.bound = true;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); SKY.Audio.init(); I.edges.autoland = true; });
};
})();

'use strict';
// GROK SKY 3.5.1 - GROK JAIL: getting busted plays a short cartoon arrest (cuffs sparkle), then you sit in the little
// Grok Jail cell at that airport's police office. Three ways out, and you can never get stuck:
//   1 PAY BAIL  (18 coins, out right away; greyed out with a hint if you can't afford it)
//   2 WAIT IT OUT (a 36 s timer that is ALWAYS running; your cellmate Grizz tells terrible aviation jokes)
//   3 ESCAPE    spoon-dig minigame: tap DIG (or Space) fast while the guard's back is turned. Dig while he is looking
//               and you're caught (+10 s on the timer, max 75 s). Dig through in time and you're out free... with 1 ★.
(() => {
const { clamp, choose } = SKY;
const BAIL = 18, WAIT = 36, FAIL_ADD = 10, WAIT_MAX = 75, ESC_TIME = 12, DIG_PER_TAP = 6.5;
const JOKES = [
  'Why did the plane get sent to its room? Bad altitude.', 'I used to be a pilot... but I got grounded.', 'What do you call a sleeping airliner? A KIP-737.',
  'My lawyer says I have a strong case. It\'s a carry-on.', 'Why don\'t cops play hide and seek? Good luck hiding from someone who always finds you guilty!',
  'The guard told me to stop making plane puns. I said I\'d try, but it\'s just how I\'m wired... like the autopilot.', 'Knock knock. — Who\'s there? — Cell. — Cell who? — Cell-ebrate, we\'ve got ' + 'snacks!',
  'I asked for a window seat. They gave me THIS window. 🪟', 'What\'s a jail\'s favourite dance? The Cell-ebration shuffle!', 'Why did the spoon go to jail? It was an accessory to the dig!',
  'I\'m not saying the food here is bad, but the toast filed a complaint.', 'They let me make one phone call. I ordered a pizza. Still waiting.',
];
const J = SKY.Jail = { cur: null, served: 0, escapes: 0, fails: 0 };
const $ = (id) => document.getElementById(id);
const coins = () => (SKY.Places ? SKY.Places.coins() : 0);

J.enter = (apt) => {
  const G = SKY.Game;
  J.cur = { apt, t: 0, left: WAIT, mode: 'menu', joke: choose(JOKES), jokeT: 0, esc: null, msg: '', msgT: 0, guardX: 0.75 };
  G.ui = 'jail'; G.unlockPointer && G.unlockPointer();
  SKY.toast('🔒 Welcome to GROK JAIL (' + apt.code + ' police office). Pay bail, wait it out, or try the spoon…', 'warn');
  if (SKY.holdToasts) SKY.holdToasts(true); // nothing pops over the jail panel; queued toasts show on release
  $('jail').classList.add('show'); render(); draw();
  G.achieve('jailbird');
};
J.release = (how) => {
  const c = J.cur; if (!c) return; J.cur = null; const G = SKY.Game, C = SKY.Cars;
  $('jail').classList.remove('show'); if (G.ui === 'jail') G.ui = null;
  if (SKY.holdToasts) { if (SKY.toastHold) SKY.toastHold = SKY.toastHold.filter(t => t[1] === 'ach'); SKY.holdToasts(false); } // replay achievements only
  if (how === 'bail') SKY.toast('💰 Bail paid (' + BAIL + ' 🪙). You\'re free to go — drive nice!', 'good');
  else if (how === 'wait') { SKY.toast('⏳ Time served. The guard waves you out: "Stay out of trouble, flyboy."', 'good'); J.served++; G.achieve('modelinmate'); }
  else if (how === 'escape') { J.escapes++; if (C && C.setWanted) C.setWanted(1, 'jailbreak'); SKY.toast('🥄 GREAT ESCAPE! You tunnelled out of GROK JAIL… the cops noticed (★ wanted)', 'good'); G.achieve('greatescape'); SKY.Audio.play('whoop'); }
  if (!SKY.isTouch && !G.testMode && G.state === 'play') G.lockPointer && G.lockPointer();
};
J.reset = () => { if (J.cur && SKY.holdToasts) { SKY.toastHold = null; SKY.holdToasts(false); } J.cur = null; const el = $('jail'); if (el) el.classList.remove('show'); if (SKY.Game && SKY.Game.ui === 'jail') SKY.Game.ui = null; };
J.bail = () => {
  const c = J.cur; if (!c || c.mode === 'escape') return false;
  if (coins() < BAIL) { say('Not enough coins for bail (' + coins() + '/' + BAIL + '). No worries — just wait it out!'); SKY.Audio.play('error'); return false; }
  SKY.Places.save.coins -= BAIL; SKY.Places.persist(); SKY.Audio.play('ding'); J.release('bail'); return true;
};
J.wait = () => { const c = J.cur; if (!c || c.mode === 'escape') return; c.mode = 'wait'; c.jokeT = 0; render(); };
J.back = () => { const c = J.cur; if (!c || c.mode === 'escape') return; c.mode = 'menu'; render(); };
J.escape = () => {
  const c = J.cur; if (!c || c.mode === 'escape') return;
  c.mode = 'escape'; c.esc = { t: 0, prog: 0, phase: 'away', pt: 2.4, taps: 0 }; say('Dig while the guard looks away! 👀 = FREEZE'); render(); SKY.Audio.play('pop');
};
// one spoon stroke (DIG button / Space / tapping the cell)
J.dig = () => {
  const c = J.cur; if (!c || c.mode !== 'escape') return; const e = c.esc;
  if (e.phase === 'look') { fail('The guard saw you digging! 🚨'); return; }
  e.prog = Math.min(100, e.prog + DIG_PER_TAP); e.taps++; SKY.Audio.play('bonk', 0.25);
  if (e.prog >= 100) { J.release('escape'); }
};
function fail(why) {
  const c = J.cur; c.left = Math.min(WAIT_MAX, c.left + FAIL_ADD); c.mode = 'menu'; c.esc = null; J.fails++;
  say(why + ' +' + FAIL_ADD + ' s on your time. (Bail and waiting still work.)'); SKY.Audio.play('error'); render();
}
function say(m) { const c = J.cur; if (!c) return; c.msg = m; c.msgT = 4.5; const el = $('jail-msg'); if (el) el.textContent = m; }

J.update = (dt) => {
  const c = J.cur; if (!c) return;
  c.t += dt; c.left -= dt; c.jokeT += dt; if (c.msgT > 0) { c.msgT -= dt; if (c.msgT <= 0) { c.msg = ''; const el = $('jail-msg'); if (el) el.textContent = ''; } }
  if (c.jokeT > 5.5) { c.jokeT = 0; let j; do j = choose(JOKES); while (j === c.joke && JOKES.length > 1); c.joke = j; }
  const e = c.esc;
  if (e) {
    e.t += dt; e.pt -= dt;
    if (e.pt <= 0) { if (e.phase === 'away') { e.phase = 'turn'; e.pt = 0.6; } else if (e.phase === 'turn') { e.phase = 'look'; e.pt = 1.3; SKY.Audio.play('beep'); } else { e.phase = 'away'; e.pt = 1.8 + Math.random() * 1.2; } }
    if (e.t > ESC_TIME && J.cur) fail('Out of time — the spoon bent. 🥄');
  }
  if (J.cur && c.left <= 0) { J.release('wait'); return; }
  if (J.cur) { hud(); draw(); }
};
// ------------------------------------------------------------------ panel
function render() {
  const c = J.cur; if (!c) return; const el = $('jail-acts'); if (!el) return;
  const can = coins() >= BAIL;
  if (c.mode === 'escape') el.innerHTML = `<button id="jail-dig" class="jb dig">🥄 DIG!<small>${SKY.isTouch ? 'tap fast — freeze when 👀' : 'Space / click fast — freeze when 👀'}</small></button>`;
  else if (c.mode === 'wait') el.innerHTML = `<button id="jail-back" class="jb">↩ Other options<small>bail / escape</small></button>`;
  else el.innerHTML = `<button id="jail-bail" class="jb bail${can ? '' : ' off'}">💰 PAY BAIL<small>${can ? BAIL + ' 🪙 · out now' : 'need ' + BAIL + ' 🪙 (you have ' + coins() + ')'}</small></button>`
    + `<button id="jail-wait" class="jb wait">⏳ WAIT IT OUT<small>free when the timer ends</small></button>`
    + `<button id="jail-esc" class="jb esc">🥄 ESCAPE<small>dig with a spoon · ★ if it works</small></button>`;
  const b = (id, f) => { const x = $(id); if (x) x.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); SKY.Audio.init(); f(); }); };
  b('jail-bail', J.bail); b('jail-wait', J.wait); b('jail-esc', J.escape); b('jail-back', J.back); b('jail-dig', J.dig);
  hud();
}
function hud() {
  const c = J.cur; if (!c) return;
  const t = $('jail-timer'); if (t) t.textContent = '⏳ Free in ' + Math.max(0, Math.ceil(c.left)) + ' s' + (c.mode === 'escape' ? ' · 🥄 ' + Math.round(c.esc.prog) + '% dug · ' + Math.max(0, Math.ceil(ESC_TIME - c.esc.t)) + ' s left' : '');
  const m = $('jail-msg'); if (m && !c.msg) m.textContent = c.mode === 'escape' ? (c.esc.phase === 'look' ? '👀 FREEZE! The guard is looking!' : c.esc.phase === 'turn' ? '⚠ He\'s turning around…' : '🥄 Dig dig dig!') : '';
  const sub = $('jail-sub'); if (sub) sub.textContent = c.apt.code + ' airport police office · cell #' + (3 + (c.apt.code.charCodeAt(0) % 6));
}
// cartoon cell: brick wall, bed, cellmate Grizz with a speech bubble, the guard outside the bars, the tunnel when digging
function draw() {
  const c = J.cur, cv = $('jail-cv'); if (!c || !cv) return;
  const W = cv.clientWidth | 0, H = cv.clientHeight | 0; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), PW = Math.round(W * dpr), PH = Math.round(H * dpr); // crisp text on phones
  if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); const t = c.t; const fl = H * 0.78;
  x.fillStyle = '#6b6f7a'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#5c606a'; for (let r = 0; r * 14 < fl; r++) for (let k = -1; k * 34 < W; k++) x.fillRect(k * 34 + (r % 2) * 17 + 1, r * 14 + 1, 32, 12);
  x.fillStyle = '#3d3f46'; x.fillRect(0, fl, W, H - fl);
  // window with bars + sky
  x.fillStyle = '#7ec8ff'; x.fillRect(W * 0.71, H * 0.2, W * 0.14, H * 0.18); x.fillStyle = '#222'; for (let k = 1; k < 4; k++) x.fillRect(W * 0.71 + k * W * 0.035 - 1, H * 0.2, 3, H * 0.18);
  // sign (above the window, right side; the joke bubble owns the left/middle)
  x.fillStyle = '#ffd23d'; x.font = 'bold ' + Math.round(Math.min(H * 0.085, W * 0.05)) + 'px sans-serif'; x.textAlign = 'center'; x.fillText('GROK JAIL', W * 0.78, H * 0.17);
  // bed
  x.fillStyle = '#8d6e63'; x.fillRect(W * 0.03, fl - H * 0.13, W * 0.25, H * 0.13); x.fillStyle = '#eceff1'; x.fillRect(W * 0.03, fl - H * 0.17, W * 0.25, H * 0.05);
  // cellmate Grizz (bobbing, striped shirt)
  const gx = W * 0.17, bob = Math.sin(t * 5) * 2, gy = fl - H * 0.17 + bob; const s = H / 180;
  x.fillStyle = '#212121'; for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#212121' : '#f5f5f5'; x.fillRect(gx - 14 * s, gy - 34 * s + k * 7 * s, 28 * s, 7 * s); }
  x.fillStyle = '#ffcc80'; x.fillRect(gx - 11 * s, gy - 56 * s, 22 * s, 22 * s); x.fillStyle = '#5d4037'; x.fillRect(gx - 12 * s, gy - 60 * s, 24 * s, 6 * s);
  x.fillStyle = '#000'; x.fillRect(gx - 6 * s, gy - 48 * s, 3 * s, 3 * s); x.fillRect(gx + 3 * s, gy - 48 * s, 3 * s, 3 * s); x.fillRect(gx - 5 * s, gy - 40 * s, 10 * s, (Math.sin(t * 9) > 0 ? 3 : 1.5) * s);
  // tunnel hole while digging
  if (c.esc) { const r = 6 + c.esc.prog * 0.32 * s; x.fillStyle = '#1b1b1b'; x.beginPath(); x.ellipse(W * 0.4, fl + (H - fl) * 0.5, r * 1.6, r * 0.5, 0, 0, 6.29); x.fill(); x.font = Math.round(H * 0.12) + 'px sans-serif'; x.fillText('🥄', W * 0.4 + r * 1.2, fl + (H - fl) * 0.6 - Math.abs(Math.sin(t * 20)) * 6); }
  // guard outside the bars (walks; faces you when looking)
  const e = c.esc; const look = e && e.phase === 'look', turn = e && e.phase === 'turn';
  c.guardX = look || turn ? c.guardX : 0.78 + Math.sin(t * 0.9) * 0.12; const ux = W * c.guardX;
  x.fillStyle = '#1a3a8a'; x.fillRect(ux - 13 * s, fl - 60 * s, 26 * s, 40 * s); x.fillRect(ux - 11 * s, fl - 20 * s, 9 * s, 20 * s); x.fillRect(ux + 2 * s, fl - 20 * s, 9 * s, 20 * s);
  x.fillStyle = '#ffcc80'; x.fillRect(ux - 10 * s, fl - 82 * s, 20 * s, 22 * s); x.fillStyle = '#0d1b4a'; x.fillRect(ux - 12 * s, fl - 88 * s, 24 * s, 8 * s); x.fillStyle = '#ffd23d'; x.fillRect(ux - 3 * s, fl - 86 * s, 6 * s, 4 * s);
  x.fillStyle = '#000'; if (look || turn) { x.fillRect(ux - 6 * s, fl - 74 * s, 4 * s, 4 * s); x.fillRect(ux + 2 * s, fl - 74 * s, 4 * s, 4 * s); } else x.fillRect(ux - 10 * s, fl - 74 * s, 3 * s, 3 * s);
  if (look) { x.font = 'bold ' + Math.round(H * 0.14) + 'px sans-serif'; x.textAlign = 'center'; x.fillText('👀', ux, fl - 94 * s); }
  if (turn) { x.font = 'bold ' + Math.round(H * 0.12) + 'px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffd23d'; x.fillText('?!', ux, fl - 94 * s); }
  // bars in front of everything
  x.fillStyle = '#263238'; const n = Math.max(8, Math.round(W / 34)); for (let k = 0; k <= n; k++) x.fillRect(k * W / n - 3, 0, 6, H); x.fillRect(0, H * 0.06, W, 6); x.fillRect(0, H * 0.94, W, 6);
  x.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k <= n; k++) x.fillRect(k * W / n - 2, 0, 2, H);
  // speech bubble — drawn last so the bars never cut it; sized to the wrapped text, shrinking the font until it fits
  const bx = Math.max(6, gx + 16 * s), bR = Math.max(bx + 120, W * 0.66) > W - 6 ? W - 6 : Math.max(bx + 120, W * 0.66), bw = bR - bx;
  const by = 6, maxH = Math.max(40, fl - 8 - by), pad = 7;
  let fs = Math.max(11, Math.min(17, Math.round(H * 0.08))), lines;
  for (;;) { x.font = 'bold ' + fs + 'px sans-serif'; lines = wrapLines(x, 'Grizz: ' + c.joke, bw - pad * 2); if (lines.length * fs * 1.2 + pad * 2 <= maxH || fs <= 9) break; fs--; }
  const lh = fs * 1.2, bh = Math.min(maxH, lines.length * lh + pad * 2 - fs * 0.2);
  x.fillStyle = 'rgba(0,0,0,.25)'; roundRect(x, bx + 2, by + 3, bw, bh, 10); x.fill();
  x.fillStyle = '#fff'; roundRect(x, bx, by, bw, bh, 10); x.fill();
  const mx = gx + 8 * s, my = gy - 44 * s; x.beginPath(); x.moveTo(bx + 10, by + bh - 1); x.lineTo(mx, my); x.lineTo(bx + 30, by + bh - 1); x.closePath(); x.fill();
  x.fillStyle = '#222'; x.textAlign = 'left'; x.textBaseline = 'top';
  lines.forEach((ln, i) => { if (by + pad + i * lh + fs <= by + bh + 1) { if (i === 0) { x.fillStyle = '#c62828'; x.fillText('Grizz:', bx + pad, by + pad); const w0 = x.measureText('Grizz: ').width; x.fillStyle = '#222'; x.fillText(ln.slice(7), bx + pad + w0, by + pad); } else x.fillText(ln, bx + pad, by + pad + i * lh); } });
  x.textBaseline = 'alphabetic';
  J.bubble = { fs, lines: lines.length, fit: lines.length * lh + pad * 2 - fs * 0.2 <= maxH + 0.5, wideOk: lines.every(l => x.measureText(l).width <= bw - pad * 2 + 0.5), top: by, bottom: by + bh, left: bx, right: bx + bw, W, H };
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function wrapLines(x, txt, w) { // word wrap; words wider than the line are split by character
  const out = []; let line = '';
  for (let wd of txt.split(' ')) {
    while (x.measureText(wd).width > w && wd.length > 1) { let k = wd.length - 1; while (k > 1 && x.measureText(wd.slice(0, k)).width > w) k--; if (line) { out.push(line); line = ''; } out.push(wd.slice(0, k)); wd = wd.slice(k); }
    const t2 = line ? line + ' ' + wd : wd; if (x.measureText(t2).width > w && line) { out.push(line); line = wd; } else line = t2;
  }
  if (line) out.push(line); return out;
}
// desktop keys: 1 bail · 2 wait · 3 escape · Space dig
addEventListener('keydown', (e) => {
  if (!J.cur || e.repeat) return;
  if (e.code === 'Digit1') J.bail(); else if (e.code === 'Digit2') J.wait(); else if (e.code === 'Digit3') J.escape(); else if (e.code === 'Space') { e.preventDefault(); J.dig(); }
});
J.bindUI = () => { const cv = $('jail-cv'); if (cv && !cv.bound) { cv.bound = true; cv.addEventListener('pointerdown', (ev) => { if (J.cur && J.cur.mode === 'escape') { ev.preventDefault(); J.dig(); } }); } };
J.BAIL = BAIL; J.WAIT = WAIT; J.FAIL_ADD = FAIL_ADD; J.JOKES = JOKES;
})();

'use strict';
// GROK SKY - shared namespace, math helpers, palette, audio, DOM labels
const SKY = window.SKY = {};
SKY.V3 = THREE.Vector3;
SKY.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
SKY.lerp = (a, b, t) => a + (b - a) * t;
SKY.rand = (a, b) => a + Math.random() * (b - a);
SKY.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
SKY.choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
SKY.ALT_SCALE = 4; // stylized altitude: displayed feet = metres * 3.28 * ALT_SCALE
SKY.toFeet = (y) => y * 3.28084 * SKY.ALT_SCALE;
SKY.feetToY = (ft) => ft / (3.28084 * SKY.ALT_SCALE);
SKY.DT = 1 / 60;
SKY.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
SKY.lowSpec = SKY.isTouch || Math.min(window.innerWidth, window.innerHeight) < 500;
if (/[?&]hq=1/.test(location.search)) SKY.lowSpec = false;
if (/[?&]lq=1/.test(location.search)) SKY.lowSpec = true;
SKY.GRAV = 9.81;

// Palette: [color, hp, flags]  flags: 1 glass, 2 emissive
SKY.PAL = [
  [0x000000, 0, 0],   // 0 empty
  [0xf4f6fa, 3, 0],   // 1 hull white
  [0x1f6fe0, 3, 0],   // 2 hull stripe blue
  [0x7fc8ff, 1, 1],   // 3 cabin window
  [0x5a5f7a, 4, 0],   // 4 floor
  [0x2b4cc8, 2, 0],   // 5 seat
  [0xe8e8e8, 2, 0],   // 6 headrest
  [0xb8c0c8, 4, 0],   // 7 galley steel
  [0x6b7078, 40, 0],  // 8 reinforced bulkhead
  [0xc9ced6, 4, 0],   // 9 wing
  [0x3a3f48, 5, 0],   // 10 engine
  [0x9aa3ad, 5, 0],   // 11 engine fan
  [0xff6a1a, 3, 0],   // 12 tail livery
  [0x4aa8ff, 6, 1],   // 13 windshield
  [0xfafafa, 2, 0],   // 14 lavatory
  [0xdfe3ea, 2, 0],   // 15 bins
  [0x2a2d33, 3, 0],   // 16 radome
  [0xb0283c, 4, 0],   // 17 aisle carpet
  [0x222222, 6, 0],   // 18 oven
  [0x7a8088, 3, 0],   // 19 control surface
  [0x14161a, 6, 0],   // 20 instrument panel
  [0x9ea4ab, 3, 0],   // 21 concrete
  [0x5f86b8, 2, 0],   // 22 window (building)
  [0xa55a3c, 3, 0],   // 23 brick
  [0x6d6f73, 4, 0],   // 24 roof
  [0xe8dcc0, 3, 0],   // 25 cream (paris)
  [0x5d6e85, 3, 0],   // 26 slate roof
  [0x8a5a2b, 6, 0],   // 27 eiffel bronze
  [0xd8403a, 5, 0],   // 28 tokyo red
  [0xffffff, 5, 0],   // 29 white
  [0x3c9a6a, 4, 0],   // 30 liberty green
  [0xd4b072, 4, 0],   // 31 sandstone
  [0xffcc33, 4, 2],   // 32 gold glow
  [0xff2bd6, 2, 2],   // 33 neon pink
  [0x22e6ff, 2, 2],   // 34 neon cyan
  [0x9dff3a, 2, 2],   // 35 neon green
  [0x2e7d32, 2, 0],   // 36 foliage
  [0x7b5a3a, 2, 0],   // 37 trunk
  [0x1b1d22, 3, 0],   // 38 black glass
  [0xc0c6cc, 5, 0],   // 39 saucer silver
  [0x707a6a, 4, 0],   // 40 hangar
  [0xf2a65a, 3, 0],   // 41 terracotta
  [0x4fb3a9, 3, 0],   // 42 teal
  [0xf06292, 3, 0],   // 43 pink
  [0xfff176, 3, 0],   // 44 yellow
  [0x8d6e63, 3, 0],   // 45 stone
  [0x445566, 3, 0],   // 46 dark glass
  [0xff4444, 3, 2],   // 47 red light
  [0x3d4148, 4, 0],   // 48 asphalt/tower dark
  [0x66ff99, 3, 2],   // 49 alien glow
];
SKY.MAT = { HULL: 1, STRIPE: 2, WIN: 3, FLOOR: 4, SEAT: 5, HEAD: 6, STEEL: 7, BULK: 8, WING: 9, ENG: 10, FAN: 11, TAIL: 12, WSHIELD: 13, LAV: 14, BIN: 15, RADOME: 16, AISLE: 17, OVEN: 18, SURF: 19, PANEL: 20 };

// ---------------- Audio (all synthesized) ----------------
SKY.Audio = (() => {
  let ctx = null, master, engOsc1, engOsc2, engGain, engFilt, windGain, windFilt, alarmGain, alarmOsc, noiseBuf;
  let alarmOn = false, alarmT = 0, muted = false;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // engine
    engFilt = ctx.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 400;
    engGain = ctx.createGain(); engGain.gain.value = 0; engFilt.connect(engGain); engGain.connect(master);
    engOsc1 = ctx.createOscillator(); engOsc1.type = 'sawtooth'; engOsc1.frequency.value = 60; engOsc1.connect(engFilt); engOsc1.start();
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 91; const g2 = ctx.createGain(); g2.gain.value = 0.3; engOsc2.connect(g2); g2.connect(engFilt); engOsc2.start();
    const en = ctx.createBufferSource(); en.buffer = noiseBuf; en.loop = true; const eg = ctx.createGain(); eg.gain.value = 0.5; en.connect(eg); eg.connect(engFilt); en.start();
    // wind
    const wn = ctx.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true;
    windFilt = ctx.createBiquadFilter(); windFilt.type = 'bandpass'; windFilt.frequency.value = 600; windFilt.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0; wn.connect(windFilt); windFilt.connect(windGain); windGain.connect(master); wn.start();
    // alarm
    alarmOsc = ctx.createOscillator(); alarmOsc.type = 'square'; alarmOsc.frequency.value = 880;
    alarmGain = ctx.createGain(); alarmGain.gain.value = 0; alarmOsc.connect(alarmGain); alarmGain.connect(master); alarmOsc.start();
  }
  function setEngine(thr, on, inside) {
    if (!ctx) return; const t = ctx.currentTime;
    const f = 45 + thr * 70;
    engOsc1.frequency.setTargetAtTime(f, t, 0.3); engOsc2.frequency.setTargetAtTime(f * 1.51, t, 0.3);
    engFilt.frequency.setTargetAtTime((inside ? 250 : 500) + thr * 900, t, 0.3);
    engGain.gain.setTargetAtTime(on ? (0.05 + thr * 0.13) * (inside ? 0.6 : 1) : 0, t, 0.2);
  }
  function setWind(level) {
    if (!ctx) return; const t = ctx.currentTime;
    windGain.gain.setTargetAtTime(SKY.clamp(level, 0, 1) * 0.5, t, 0.15);
    windFilt.frequency.setTargetAtTime(400 + level * 900, t, 0.2);
  }
  function setAlarm(on) { alarmOn = on; }
  function tick(dt) {
    if (!ctx) return;
    alarmT += dt;
    const beep = alarmOn && (alarmT % 0.5) < 0.25;
    alarmGain.gain.setTargetAtTime(beep ? 0.06 : 0, ctx.currentTime, 0.01);
    alarmOsc.frequency.setTargetAtTime((alarmT % 1) < 0.5 ? 880 : 660, ctx.currentTime, 0.01);
  }
  function noise(dur, freq, vol, type) {
    if (!ctx || muted) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.5 + Math.random();
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type, slide) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(); o.type = type || 'sine'; const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    crunch: (v) => { noise(0.35, 900, 0.5 * (v || 1)); tone(90, 0.25, 0.25 * (v || 1), 'triangle', 40); },
    boom: () => { noise(1.6, 300, 1.0); tone(60, 1.2, 0.6, 'sine', 25); },
    hit: () => { noise(0.12, 2500, 0.35, 'bandpass'); tone(200, 0.1, 0.2, 'square', 90); },
    bonk: () => { tone(520, 0.18, 0.25, 'triangle', 180); noise(0.08, 3000, 0.2, 'highpass'); },
    clang: () => { tone(330, 0.5, 0.2, 'square', 300); tone(495, 0.4, 0.12, 'square', 480); noise(0.1, 4000, 0.2, 'highpass'); },
    chime: () => { tone(880, 0.6, 0.2); setTimeout(() => tone(660, 0.8, 0.2), 250); },
    ding: () => { tone(1320, 0.7, 0.2); },
    beep: () => { tone(1000, 0.07, 0.15, 'square'); },
    error: () => { tone(200, 0.25, 0.2, 'square'); },
    ok: () => { tone(700, 0.1, 0.2, 'square'); setTimeout(() => tone(1050, 0.15, 0.2, 'square'), 100); },
    woosh: () => { noise(1.2, 700, 0.6, 'bandpass'); },
    pop: () => { tone(300, 0.08, 0.3, 'sine', 900); },
    spray: () => { noise(0.25, 5000, 0.18, 'highpass'); },
    yelp: () => { tone(SKY.rand(500, 800), 0.25, 0.12, 'sawtooth', SKY.rand(900, 1300)); },
    eat: () => { noise(0.08, 1500, 0.2, 'bandpass'); setTimeout(() => noise(0.08, 1500, 0.2, 'bandpass'), 150); },
    whoop: () => { tone(300, 0.6, 0.2, 'sine', 1200); },
    splash: () => { noise(1.0, 1200, 0.6, 'bandpass'); },
  };
  function play(name, v) { if (sfx[name]) sfx[name](v); }
  return { init, setEngine, setWind, setAlarm, tick, play, get ready() { return !!ctx; }, mute(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.55; } };
})();

// ---------------- DOM label pool (health bars + speech) ----------------
SKY.Labels = (() => {
  const pool = []; let root = null; let used = 0;
  function ensure() { if (!root) root = document.getElementById('labels'); }
  function begin() { ensure(); used = 0; }
  const tmp = new THREE.Vector3();
  function add(worldPos, cam, w, h, hp, text, color) {
    if (!root || used >= 14) return;
    tmp.copy(worldPos).project(cam);
    if (tmp.z > 1 || tmp.z < -1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) return;
    let el = pool[used];
    if (!el) {
      el = document.createElement('div'); el.className = 'plabel';
      el.innerHTML = '<div class="say"></div><div class="hpb"><i></i></div>';
      root.appendChild(el); pool.push(el); el._say = el.firstChild; el._bar = el.lastChild; el._fill = el.lastChild.firstChild;
    }
    used++;
    el.style.display = 'block';
    el.style.transform = `translate(${((tmp.x + 1) / 2 * w) | 0}px, ${((1 - tmp.y) / 2 * h) | 0}px) translate(-50%, -100%)`;
    if (hp == null) el._bar.style.display = 'none';
    else { el._bar.style.display = 'block'; el._fill.style.width = Math.max(0, hp) + '%'; el._fill.style.background = hp > 60 ? '#3ddc5a' : hp > 25 ? '#ffc23d' : '#ff4b4b'; }
    if (text) { el._say.style.display = 'block'; if (el._say.textContent !== text) el._say.textContent = text; el._say.style.color = color || '#222'; }
    else el._say.style.display = 'none';
  }
  function end() { for (let i = used; i < pool.length; i++) pool[i].style.display = 'none'; }
  return { begin, add, end };
})();

SKY.toastQ = [];
SKY.toast = (msg, cls) => {
  const box = document.getElementById('toasts'); if (!box) return;
  const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = msg;
  box.appendChild(d); while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { d.classList.add('fade'); }, 2600); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 3400);
  SKY.toastQ.push(msg); if (SKY.toastQ.length > 50) SKY.toastQ.shift();
};

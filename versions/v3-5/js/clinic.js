'use strict';
// GROK SKY 3.5 - AIRPORT CLINICS + DOCTOR MODE: every airport has a small signed clinic next to the terminal (an enterable
// place). Cartoon passengers come in with readable, light-hearted ailments; diagnose the symptom, pick the right tool and
// apply it with a quick drag (or taps). Treated patients thank you, earn you coins and walk off to catch their flight.
(() => {
const PL = SKY.Places, W = SKY.World;
const { choose, rand, clamp } = SKY;
const $ = (id) => document.getElementById(id);
const AIL = {
  bump: { icon: '🤕', name: 'Bump on the head', tool: 'ice', spot: 'head', say: ['Ow! I bonked my head on the overhead bin!', 'I walked into the departures board...', 'A suitcase fell on my noggin!'], done: 'The bump is going down already!' },
  ankle: { icon: '🦶', name: 'Sprained ankle', tool: 'splint', spot: 'ankle', say: ['I twisted my ankle running to my gate!', 'I tripped over a rolling suitcase!', 'Ouch, my ankle! Those moving walkways are tricky.'], done: 'Steady as a rock. Walk, don\'t run!' },
  sunburn: { icon: '🥵', name: 'Sunburn', tool: 'lotion', spot: 'arm', say: ['I fell asleep by the pool... I\'m a lobster!', 'Forgot the sunscreen at the beach.', 'My arms are SO red and stingy.'], done: 'Ahh, cool and soothing!' },
  fever: { icon: '🤒', name: 'Fever', tool: 'thermo', spot: 'mouth', say: ['I feel hot and shivery at the same time...', 'I think I have a temperature.', 'Achoo! I feel all warm and wobbly.'], done: '38.2°C — rest, lots of water and a nap on the plane!' },
  motion: { icon: '🤢', name: 'Motion sickness', tool: 'medicine', spot: 'mouth', say: ['That turbulence made my tummy do loops!', 'The room is spinning... bleh.', 'I feel green. Like, actually green.'], done: 'Tummy feels calm again!' },
  cut: { icon: '🩹', name: 'Small cut', tool: 'bandage', spot: 'hand', say: ['I got a paper cut from my boarding pass!', 'Scraped my hand on my suitcase zipper.', 'Ouch, a little cut on my hand!'], done: 'All patched up!' },
};
const TOOLS = { bandage: ['🩹', 'Bandage'], ice: ['🧊', 'Ice pack'], thermo: ['🌡️', 'Thermometer'], medicine: ['💊', 'Medicine'], splint: ['🩼', 'Splint'], lotion: ['🧴', 'Lotion'] };
const SPOT_XY = { head: [0.5, 0.11], mouth: [0.5, 0.22], arm: [0.25, 0.47], hand: [0.8, 0.6], ankle: [0.6, 0.93] };
const NAMES = ['Mrs. Pepper', 'Mr. Noodle', 'Captain Waffles', 'Granny Rose', 'Dr. Who-Me', 'Little Timmy', 'Ms. Biscuit', 'Señor Taco', 'Madame Brie', 'Ken-chan', 'Big Lou', 'Aunt Zelda', 'Professor Plum', 'Sunny', 'Mx. Pickles'];
const FLIGHTS = ['Las Vegas', 'Paris', 'Tokyo', 'New York', 'Mexico City', 'Los Angeles', 'Area 51 (shh)'];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const CL = SKY.Clinic = { cur: null, treated: () => PL.save.treated || 0, AIL, TOOLS };

// ------------------------------------------------------------------ the clinic place (one per airport)
function clinicDef(cid) {
  return {
    id: cid.toLowerCase() + '-clinic', short: 'clinic', name: 'Airport Clinic', icon: '🏥', kind: 'interior', face: 'n', clinic: true,
    doorFn: (c) => { const a = c.apt; return [a.XF + a.side * 88, a.az + a.L / 2 + 22]; },
    fac: { w: 16, d: 12, h: 8, wall: 29, sign: 'CLINIC', signM: 47, awnA: 47, awnB: 29, trim: 47, roof: 29 },
    room: { w: 22, h: 6, d: 20 }, hint: 'Doctor mode! Walk up to a patient and press USE to diagnose & treat them.',
    outside(pl, c) { // big red cross on the roof edge
      const WB = SKY.WB; WB.smallBox(pl.dx, pl.dy + 8.5, pl.dz + 6, 7, 7, 1, 0.5, (g) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const cross = (i >= 2 && i <= 4) || (j >= 2 && j <= 4); g.set(i, j, 0, cross ? 47 : 29); } }, { name: 'red cross' });
    },
    build(ctx, pl) { buildClinic(ctx, pl); },
  };
}
for (const cid of ['LA', 'LAS', 'A51', 'MEX', 'NYC', 'PAR', 'TYO']) { (PL.DEFS[cid] = PL.DEFS[cid] || []).push(clinicDef(cid)); }
PL.isClinic = (pl) => !!(pl && pl.clinic);

function buildClinic(ctx, pl) {
  const c = ctx.c; const apt = c.apt;
  ctx.shell((x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 29 : 42), (x, y, z) => (y > 2.6 ? 29 : y > 2.2 ? 42 : 29), 29);
  ctx.exit(ctx.W / 2, ctx.D - 1, 'n'); ctx.spawn(ctx.W / 2, ctx.D - 4, 0);
  for (let x = 3; x < ctx.W - 1; x += 5) for (let z = 3; z < ctx.D - 1; z += 5) ctx.B(x - 0.5, ctx.H - 0.5, z - 0.5, x + 0.5, ctx.H, z + 0.5, 57);
  // back wall: red cross + sign
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i) <= 1 || Math.abs(j) <= 1) ctx.F(17 + i * 0.5, 3.8 + j * 0.5, 1.0, 47);
  ctx.txt(7, 3.2, 1.1, 'CLINIC', 47, 's', 1);
  // three beds with curtains, a chair in front of each (the patients sit there)
  for (const bx of [5, 11, 17]) {
    ctx.B(bx - 1.2, 0, 1, bx + 1.2, 0.5, 4.5, 56); ctx.B(bx - 1.2, 0.5, 1, bx + 1.2, 1, 4.5, 29); ctx.B(bx - 1.1, 1, 1.1, bx + 1.1, 1.3, 2, 57); ctx.B(bx - 1.2, 0.5, 2.5, bx + 1.2, 1.05, 4.5, 42);
    ctx.B(bx - 0.5, 0, 6.0, bx + 0.5, 0.5, 7, 60); ctx.B(bx - 0.5, 0.5, 5.8, bx + 0.5, 1.5, 6.0, 60);
  }
  for (const cx of [8, 14]) ctx.B(cx - 0.1, 0, 1, cx + 0.1, 3, 5, 42);
  // reception desk + nurse, medicine cabinet, waiting chairs, plants
  ctx.B(2, 0, 11, 8, 1, 12, 29); ctx.B(2, 1, 11, 8, 1.3, 12, 42); ctx.F(3, 1.3, 11.2, 34);
  ctx.B(20.2, 0, 8, 21, 3, 12, 29); for (let z = 8.2; z < 12; z += 0.5) for (let y = 0.5; y < 3; y += 0.75) ctx.F(20.2, y, z, choose([47, 34, 63, 35, 29]));
  for (let x = 13; x < 20; x += 1.5) { ctx.B(x - 0.5, 0, 15, x + 0.5, 0.5, 15.8, 63); ctx.B(x - 0.5, 0.5, 15.6, x + 0.5, 1.4, 15.8, 63); }
  ctx.B(1.5, 0, 17, 2.5, 0.5, 18, 41); ctx.sph(2, 1.3, 17.5, 0.8, 36); ctx.B(19.5, 0, 17, 20.5, 0.5, 18, 41); ctx.sph(20, 1.3, 17.5, 0.8, 36);
  ctx.npc(5, 10.2, { name: 'Nurse Joy', shirt: 0x80deea, yaw: Math.PI, lines: ['Welcome, Doctor! Patients are waiting by the beds.', 'Tip: look at what hurts, then pick the matching tool.', 'You\'re a natural, Doc!', 'Drag the tool onto the sore spot — or just tap it.'] });
  ctx.act(5, 1.2, 12.6, 2.4, '📋 Clinic board: patients treated ' + CL.treated(), () => SKY.toast('📋 Patients treated: ' + CL.treated() + ' · 🏆 First Patient ' + (SKY.Game.ach.patient ? '✓' : '—') + ' · Doctor of the Skies (10) ' + (SKY.Game.ach.doctor ? '✓' : CL.treated() + '/10'), 'good'));
  ctx.photo(17, 1.2, 12, 'the ' + (apt ? apt.code : '') + ' Airport Clinic');
  // patient slots
  const slots = [5, 11, 17].map((x, i) => ({ i, x, z: 6.5, state: 'empty', t: i * 1.2 + 0.2, n: null, ail: null, head: new THREE.Vector3(), ctx }));
  ctx.clinic = { slots, pl };
  for (const s of slots) {
    ctx.act(s.x, 1.6, s.z, 2.8, () => (s.state === 'waiting' && s.n ? '🩺 Treat ' + s.n.p.name + ' — ' + AIL[s.ail].icon + ' "' + s.line + '"' : null), () => CL.open(s));
    const it = ctx.acts[ctx.acts.length - 1]; s.it = it;
  }
  ctx.anim((dt) => tick(ctx, dt));
  // first patients are already waiting when you walk in
  for (const s of slots) spawnPatient(s, true);
}
function spawnPatient(s, seated) {
  const ctx = s.ctx, O = ctx.O; const keys = Object.keys(AIL);
  const used = ctx.clinic.slots.map((q) => q.ail); let ail = choose(keys); for (let k = 0; k < 6 && used.includes(ail); k++) ail = choose(keys);
  s.ail = ail; s.line = choose(AIL[ail].say); s.mistakes = 0;
  const start = seated ? [s.x, s.z] : [11, 17.5];
  const n = PL.addNPC(O.x + start[0], O.y, O.z + start[1], { name: choose(NAMES), sit: !!seated, yaw: Math.PI, skin: ail === 'motion' ? 0xa5d6a7 : ail === 'sunburn' ? 0xff8a80 : choose(SKIN), lines: [AIL[ail].icon + ' ' + s.line] }, { place: true });
  if (ail === 'fever' || ail === 'motion') n.p.woozy = 9999;
  n.p.talk(AIL[ail].icon + ' ' + s.line, 6);
  s.n = n; s.state = seated ? 'waiting' : 'arriving'; s.path = seated ? null : [[11, 9.5], [s.x, 9.5], [s.x, s.z]];
  ctx.npcs.push(n);
}
function walk(s, dt) { // move along s.path; returns true when done
  const n = s.n, p = n.p, O = s.ctx.O; if (!s.path || !s.path.length) return true;
  const tg = s.path[0]; const tx = O.x + tg[0], tz = O.z + tg[1]; const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  p.state = 'walk'; n.o.sit = false;
  if (d < 0.12) { s.path.shift(); return !s.path.length; }
  const st = Math.min(d, 1.7 * dt); p.pos.x += dx / d * st; p.pos.z += dz / d * st; p.yaw = Math.atan2(-dx, -dz);
  return false;
}
function tick(ctx, dt) {
  for (const s of ctx.clinic.slots) {
    s.t -= dt;
    if (s.n) s.head.set(s.n.p.pos.x, s.n.p.pos.y + 1.6, s.n.p.pos.z);
    if (s.it && s.n) s.it.pos.copy(s.head);
    if (s.state === 'empty' && s.t <= 0) spawnPatient(s, false);
    else if (s.state === 'arriving') { if (walk(s, dt)) { s.state = 'waiting'; s.n.o.sit = true; s.n.p.yaw = Math.PI; s.n.p.state = 'sit'; s.n.p.talk(AIL[s.ail].icon + ' ' + s.line, 5); } }
    else if (s.state === 'waiting') { if (!s.n.p.say && Math.random() < dt * 0.25) s.n.p.talk(AIL[s.ail].icon + ' ' + s.line, 4); }
    else if (s.state === 'leaving') { if (walk(s, dt)) { PL.npcs = PL.npcs.filter((q) => q !== s.n); ctx.npcs = ctx.npcs.filter((q) => q !== s.n); s.n = null; s.state = 'empty'; s.t = rand(2.5, 4.5); } }
  }
}
// ------------------------------------------------------------------ doctor mini-game (place panel)
function figure(cv, ail, healed, tool, target) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, w, h);
  const skin = ail === 'motion' && !healed ? '#9ed99f' : ail === 'sunburn' && !healed ? '#ff8f80' : '#f1c27d';
  const cx = w / 2; g.lineCap = 'round';
  // legs, body, arms, head
  g.strokeStyle = '#33415c'; g.lineWidth = w * 0.09; g.beginPath(); g.moveTo(cx - w * 0.07, h * 0.62); g.lineTo(cx - w * 0.1, h * 0.9); g.moveTo(cx + w * 0.07, h * 0.62); g.lineTo(cx + w * 0.1, h * 0.9); g.stroke();
  g.fillStyle = '#1f2937'; g.fillRect(cx - w * 0.17, h * 0.9, w * 0.13, h * 0.04); g.fillRect(cx + w * 0.04, h * 0.9, w * 0.13, h * 0.04);
  g.strokeStyle = ail === 'sunburn' && !healed ? '#ff8f80' : skin; g.lineWidth = w * 0.065; g.beginPath(); g.moveTo(cx - w * 0.14, h * 0.36); g.lineTo(cx - w * 0.27, h * 0.56); g.moveTo(cx + w * 0.14, h * 0.36); g.lineTo(cx + w * 0.3, h * 0.6); g.stroke();
  g.fillStyle = '#ff6a1a'; g.beginPath(); g.roundRect ? g.roundRect(cx - w * 0.16, h * 0.31, w * 0.32, h * 0.33, 10) : g.rect(cx - w * 0.16, h * 0.31, w * 0.32, h * 0.33); g.fill();
  g.fillStyle = skin; g.beginPath(); g.arc(cx, h * 0.18, w * 0.15, 0, 6.3); g.fill();
  // face
  g.fillStyle = '#222'; g.beginPath(); g.arc(cx - w * 0.05, h * 0.165, w * 0.016, 0, 6.3); g.arc(cx + w * 0.05, h * 0.165, w * 0.016, 0, 6.3); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); if (healed) g.arc(cx, h * 0.2, w * 0.05, 0.2, Math.PI - 0.2); else g.arc(cx, h * 0.25, w * 0.045, Math.PI + 0.3, -0.3); g.stroke();
  if (!healed) {
    if (ail === 'bump') { g.fillStyle = '#ff7aa2'; g.beginPath(); g.arc(cx + w * 0.02, h * 0.05, w * 0.05, 0, 6.3); g.fill(); g.fillStyle = '#ffd23d'; g.font = (w * 0.08) + 'px sans-serif'; g.fillText('✦', cx + w * 0.12, h * 0.06); g.fillText('✦', cx - w * 0.2, h * 0.08); }
    if (ail === 'ankle') { g.fillStyle = '#b388ff'; g.beginPath(); g.ellipse(cx + w * 0.1, h * 0.88, w * 0.07, h * 0.03, 0, 0, 6.3); g.fill(); }
    if (ail === 'fever') { g.fillStyle = '#ff5252'; g.beginPath(); g.arc(cx - w * 0.09, h * 0.2, w * 0.025, 0, 6.3); g.arc(cx + w * 0.09, h * 0.2, w * 0.025, 0, 6.3); g.fill(); g.fillStyle = '#4fc3f7'; g.beginPath(); g.arc(cx + w * 0.16, h * 0.1, w * 0.02, 0, 6.3); g.fill(); }
    if (ail === 'motion') { g.strokeStyle = '#2e7d32'; g.lineWidth = 2; g.beginPath(); g.arc(cx + w * 0.22, h * 0.08, w * 0.03, 0, 5); g.stroke(); g.beginPath(); g.arc(cx - w * 0.22, h * 0.12, w * 0.025, 0, 5); g.stroke(); }
    if (ail === 'cut') { g.strokeStyle = '#e53935'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + w * 0.27, h * 0.58); g.lineTo(cx + w * 0.33, h * 0.61); g.stroke(); }
  } else { g.font = (w * 0.1) + 'px sans-serif'; g.fillText('✨', cx + w * 0.17, h * 0.1); }
  if (target) { const sp = SPOT_XY[AIL[ail].spot]; g.strokeStyle = 'rgba(255,200,0,' + (0.6 + 0.4 * Math.sin(performance.now() / 150)) + ')'; g.lineWidth = 4; g.setLineDash([6, 4]); g.beginPath(); g.arc(sp[0] * w, sp[1] * h, w * 0.1, 0, 6.3); g.stroke(); g.setLineDash([]); }
  if (tool && tool.x != null) { g.font = (w * 0.2) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(TOOLS[tool.k][0], tool.x * w, tool.y * h); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
}
CL.open = (s) => {
  if (s.state !== 'waiting') return;
  s.state = 'treating'; s.n.p.talk('Thank goodness, a doctor!', 2);
  const st = CL.cur = { s, step: 'diag', ail: s.ail, mistakes: 0, prog: 0, tool: null, drag: null };
  render(st); SKY.Audio.play('beep');
};
function render(st) {
  const A = AIL[st.ail], name = st.s.n.p.name; const M = SKY.Mini;
  let html = '<div class="dr"><canvas id="dr-cv" width="200" height="260"></canvas><div class="dr-side"><p class="dr-say">' + A.icon + ' <b>' + name + ':</b> "' + st.s.line + '"</p>';
  if (st.step === 'diag') {
    const keys = Object.keys(AIL); const opts = [st.ail]; while (opts.length < 4) { const k = choose(keys); if (!opts.includes(k)) opts.push(k); } opts.sort(() => Math.random() - 0.5); st.opts = opts;
    html += '<p class="dr-q">Step 1 · What\'s wrong?</p><div class="dr-grid">' + opts.map((k) => '<button id="dr-sym-' + k + '" class="dr-b">' + AIL[k].icon + ' ' + AIL[k].name + '</button>').join('') + '</div>';
  } else if (st.step === 'tool') {
    html += '<p class="dr-q">✅ ' + A.name + '! Step 2 · Pick the right tool:</p><div class="dr-grid t6">' + Object.keys(TOOLS).map((k) => '<button id="dr-tool-' + k + '" class="dr-b">' + TOOLS[k][0] + '<small>' + TOOLS[k][1] + '</small></button>').join('') + '</div>';
  } else if (st.step === 'apply') {
    html += '<p class="dr-q">Step 3 · Drag the ' + TOOLS[A.tool][0] + ' ' + TOOLS[A.tool][1].toLowerCase() + ' onto the glowing spot and hold it there (or tap the spot a few times)</p><div class="dr-prog"><span id="dr-prog" style="width:0%"></span></div>';
  } else if (st.step === 'done') {
    html += '<p class="dr-q">🎉 ' + A.done + '</p><p class="big" id="dr-msg">' + st.msg + '</p><div class="row"><button id="dr-ok" class="go">👍 Next patient</button></div>';
  }
  html += '<p class="fine" id="dr-hint">' + (st.hint || '') + '</p></div></div>';
  SKY.Mini.loop = null; M.open('🩺 Doctor mode · ' + name, html, 'doctor');
  const cv = $('dr-cv');
  const redraw = () => { if ($('dr-cv') !== cv) return; figure(cv, st.ail, st.step === 'done', st.step === 'apply' ? (st.drag || { k: A.tool, x: 0.5, y: 0.85 }) : null, st.step === 'apply'); };
  redraw();
  if (st.step === 'diag') for (const k of st.opts) { const b = $('dr-sym-' + k); if (b) b.onclick = (e) => { e.stopPropagation(); CL.diagnose(k); }; }
  if (st.step === 'tool') for (const k of Object.keys(TOOLS)) { const b = $('dr-tool-' + k); if (b) b.onclick = (e) => { e.stopPropagation(); CL.pickTool(k); }; }
  if (st.step === 'done') { const b = $('dr-ok'); if (b) b.onclick = (e) => { e.stopPropagation(); SKY.Game.closeUI(); }; }
  if (st.step === 'apply') {
    st.drag = { k: A.tool, x: 0.5, y: 0.85, down: false }; const sp = SPOT_XY[A.spot];
    const rel = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    const onSpot = (x, y) => Math.hypot(x - sp[0], (y - sp[1]) * 1.3) < 0.14;
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); const [x, y] = rel(e); st.drag.down = true; st.drag.x = x; st.drag.y = y; if (onSpot(x, y)) CL.applyTap(); try { cv.setPointerCapture(e.pointerId); } catch (er) { } });
    cv.addEventListener('pointermove', (e) => { if (!st.drag.down) return; const [x, y] = rel(e); st.drag.x = x; st.drag.y = y; });
    const up = () => { st.drag.down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    SKY.Mini.loop = { update(dt) { if (CL.cur !== st || st.step !== 'apply') return; if (st.drag.down && onSpot(st.drag.x, st.drag.y)) CL.addProg(dt / 1.1); redraw(); }, state: st, stop() { if (CL.cur === st && st.step !== 'done') { st.s.state = 'waiting'; CL.cur = null; } } };
  } else SKY.Mini.loop = { update() { }, state: st, stop() { if (CL.cur === st && st.step !== 'done') { st.s.state = 'waiting'; CL.cur = null; } if (CL.cur === st && st.step === 'done') { CL.cur = null; } } };
}
CL.diagnose = (k) => {
  const st = CL.cur; if (!st || st.step !== 'diag') return false;
  if (k === st.ail) { st.step = 'tool'; st.hint = ''; SKY.Audio.play('ding'); render(st); return true; }
  st.mistakes++; st.hint = '🤔 Hmm, not quite — look at the picture and what ' + st.s.n.p.name + ' said. Try again!'; SKY.Audio.play('bonk');
  const b = $('dr-sym-' + k); if (b) { b.disabled = true; b.classList.add('wrong'); } const h = $('dr-hint'); if (h) h.textContent = st.hint; return false;
};
CL.pickTool = (k) => {
  const st = CL.cur; if (!st || st.step !== 'tool') return false;
  if (k === AIL[st.ail].tool) { st.step = 'apply'; st.prog = 0; st.hint = ''; SKY.Audio.play('ding'); render(st); return true; }
  st.mistakes++; st.hint = '🙃 A ' + TOOLS[k][1].toLowerCase() + ' won\'t help with a ' + AIL[st.ail].name.toLowerCase() + '. Try another tool!'; SKY.Audio.play('bonk');
  const b = $('dr-tool-' + k); if (b) { b.disabled = true; b.classList.add('wrong'); } const h = $('dr-hint'); if (h) h.textContent = st.hint; return false;
};
CL.applyTap = () => { const st = CL.cur; if (!st || st.step !== 'apply') return; CL.addProg(0.26); SKY.Audio.play('pop'); };
CL.addProg = (v) => {
  const st = CL.cur; if (!st || st.step !== 'apply') return;
  st.prog = clamp(st.prog + v, 0, 1); const el = $('dr-prog'); if (el) el.style.width = Math.round(st.prog * 100) + '%';
  if (st.prog >= 1) finish(st);
};
function finish(st) {
  const s = st.s, n = s.n, PL2 = SKY.Places; const coins = Math.max(3, 8 - st.mistakes * 2) + (st.mistakes === 0 ? 2 : 0);
  PL2.save.treated = (PL2.save.treated || 0) + 1; PL2.earn(coins); PL2.persist();
  const G = SKY.Game; G.achieve('patient'); if (PL2.save.treated >= 10) G.achieve('doctor');
  st.step = 'done'; st.msg = '+' + coins + ' 🪙' + (st.mistakes === 0 ? ' (perfect diagnosis bonus!)' : '') + ' · patients treated: ' + PL2.save.treated;
  CL.last = { ail: st.ail, coins, mistakes: st.mistakes, treated: PL2.save.treated };
  n.p.woozy = 0; n.p.talk('😊 Thank you, Doc! Off to catch my flight to ' + choose(FLIGHTS) + '! ✈', 4);
  n.p.skin = SKIN[0];
  SKY.Audio.play('chime');
  s.state = 'leaving'; s.path = [[s.x, 9.5], [11, 9.5], [11, 18]];
  render(st);
}
// test / harness helper: solve the current patient end-to-end through the same API the buttons use
CL.autoTreat = () => { const st = CL.cur; if (!st) return null; CL.diagnose(st.ail); CL.pickTool(AIL[st.ail].tool); for (let i = 0; i < 4 && st.step === 'apply'; i++) CL.applyTap(); return CL.last; };
})();

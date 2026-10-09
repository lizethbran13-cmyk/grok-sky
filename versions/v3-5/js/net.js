'use strict';
// GROK SKY 3.6 - ONLINE MULTIPLAYER (2 players by default, 3 max, each on their own device)
// Built on grok-net.js (PeerJS / WebRTC, star topology: the host relays). Same URL params as the other Grok games:
//   ?mp=host|join&code=XXXXX&name=..&color=..  (+ optional &n=2|3 &city=LA &start=pilot|cabin)
// or the in-game 🌐 ONLINE menu (title screen / pause) with a 5-letter room code.
// Everyone flies their own plane; we see each other's plane, car or on-foot avatar with name tags (smoothly
// interpolated ~120 ms behind), the partner on the minimap + big map, join / leave / disconnect messages.
// The HOST runs the police AI for everyone (cops chase whoever is wanted; each player's wanted level, bust and
// GROK JAIL stay their own). Taking a parked car hides it on the other screens; leaving it parks it there for all.
(() => {
const GN = window.GrokNet;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hyp = Math.hypot;
if (GN) GN.PREFIX = 'groksky-'; // own peer-id namespace: a Grok Sky code never lands in another game's room
const DELAY = 120, EXTRA_MAX = 350, SEND_MS = 100; // interpolation delay / max extrapolation (ms) / state rate
const COLORS = GN ? GN.COLORS : ['#ff4fd8', '#3ff0ff', '#ffe14d', '#4ade80', '#ff7a3d', '#a78bfa'];
const N = SKY.Net = { room: null, remotes: {}, prof: null, n: 2, auto: null, stats: { sent: 0, recv: 0, pol: 0 }, lastErr: null };

N.active = () => !!(N.room && N.room.opened && !N.room.destroyed && (N.room.isHost || N.room._welcomed));
N.isHost = () => !!(N.room && N.room.isHost && !N.room.destroyed);
N.isClient = () => !!(N.room && !N.room.isHost && !N.room.destroyed && N.room.opened);
N.myPid = () => (N.room ? N.room.pid : null);
N.count = () => (N.room && !N.room.destroyed ? N.room.count() : 1);
N.me = () => (N.room ? N.room.me() : null);
const now = () => performance.now();

// ------------------------------------------------------------------ profile (name / colour) remembered on this device
function loadProf() {
  const sp = GN ? GN.savedProfile() : { name: 'Player', color: COLORS[0] };
  N.prof = { name: sp.hasName ? sp.name : 'Pilot' + Math.floor(10 + Math.random() * 89), color: sp.color };
}
function saveProf() { if (GN) GN.saveProfile(N.prof.name, N.prof.color); }

// ------------------------------------------------------------------ room lifecycle
N.host = (o) => N.open(Object.assign({ role: 'host' }, o || {}));
N.join = (code, o) => N.open(Object.assign({ role: 'join', code }, o || {}));
N.open = (o) => {
  if (!GN || typeof window.Peer !== 'function') { N.lastErr = { code: 'nopeer', title: 'Online play unavailable', message: 'The multiplayer library did not load.' }; panelStatus('⚠ Online play unavailable (the multiplayer library did not load).', 'bad'); return null; }
  if (N.room) N.leave(true);
  const role = o.role, n = Math.max(2, Math.min(3, +o.n || N.n || 2)); N.n = n;
  const name = GN.cleanName(o.name || N.prof.name), color = GN.cleanColor(o.color || N.prof.color);
  N.prof.name = name; N.prof.color = color; saveProf();
  const code = role === 'host' ? (GN.validCode(o.code) ? o.code : GN.makeCode()) : GN.normalizeCode(o.code);
  if (role === 'join' && !GN.validCode(code)) { panelStatus('Enter the 5-letter room code from your friend.', 'bad'); return null; }
  N.lastErr = null; N.byeFrom = {};
  const room = N.room = GN.createRoom({ role, code, name, color, pid: o.pid, slot: o.slot, max: role === 'host' ? n : 3, autoCode: role === 'host' && !o.code, rejoin: !!o.rejoin, state: { v: 36 } });
  room.on('status', (t) => { if (N.room === room) panelStatus(t); });
  room.on('open', () => {
    if (N.room !== room) return;
    if (room.isHost) { room.setMeta({ game: 'groksky', city: SKY.Game.state === 'play' ? curCity() : SKY.Game.startCity, started: SKY.Game.state !== 'title', n }); SKY.toast('🌐 Room ' + room.code + ' is open — share the code! (' + room.count() + '/' + n + ')', 'good'); }
    else { const h = room.players().find((p) => p.host); SKY.toast('🌐 Connected to ' + (h ? h.name + '\'s' : 'the') + ' room ' + room.code + '!', 'good'); }
    if (room.count() > 1) SKY.Game.achieve('together');
    N.removeLocalPolice(); renderPanel(); maybeAutoStart();
  });
  room.on('players', () => { if (N.room !== room) return; syncRemotes(); renderPanel(); });
  room.on('join', (p) => { if (N.room !== room || p.pid === room.pid) return; SKY.toast('🌐 ' + p.name + ' joined (' + room.count() + '/' + (room.isHost ? n : (room.meta().n || 3)) + ') — look for the coloured name tag & minimap dot', 'good'); SKY.Audio.play('ok'); SKY.Game.achieve('together'); syncRemotes(); renderPanel(); });
  room.on('leave', (p) => { if (N.room !== room) return; const bye = N.byeFrom[p.pid]; delete N.byeFrom[p.pid]; SKY.toast(bye ? '👋 ' + p.name + ' left the game' : '📡 ' + p.name + ' disconnected (connection lost)', 'warn'); dropRemote(p.pid); renderPanel(); });
  room.on('meta', (m) => { if (N.room !== room) return; renderPanel(); maybeAutoStart(); });
  room.on('message', (d, from) => { if (N.room === room) onMsg(d, from); });
  room.on('reconnecting', () => { if (N.room === room) { SKY.toast('📡 Lost the connection to the host — reconnecting…', 'warn'); renderPanel(); } });
  room.on('reconnected', () => { if (N.room === room) { SKY.toast('🌐 Reconnected to room ' + room.code, 'good'); renderPanel(); } });
  room.on('error', (err) => {
    if (N.room !== room) return; N.lastErr = err;
    const wasOpen = room.opened; N.room = null; clearRemotes();
    if (err.code === 'hostleft') SKY.toast('🏠 The host left — the room closed. You keep playing solo.', 'warn');
    else if (wasOpen) SKY.toast('📡 Online: ' + err.title + ' — ' + err.message, 'bad');
    panelStatus('⚠ ' + err.title + ' — ' + err.message, 'bad'); renderPanel();
    if (!wasOpen && N.auto) showPanel(true);
  });
  room.start(); renderPanel();
  return room;
};
N.leave = (silent) => {
  const room = N.room; if (!room) return;
  try { room.broadcast({ t: 'bye' }); } catch (e) { }
  N.room = null; setTimeout(() => room.leave(), 60);
  clearRemotes();
  if (!silent) SKY.toast('👋 You left the online room — solo again', '');
  renderPanel();
};
function curCity() { const P = SKY.Player, pl = SKY.Game.plane; const ref = P.frame === 'world' ? P.pos : pl.pos; return SKY.World.nearestCity(ref.x, ref.z).city.id; }
// URL / lobby auto start: the host flies right away, joiners start in the host's city once the room is up
function maybeAutoStart() {
  const G = SKY.Game, room = N.room; if (!room || !N.active() || G.state !== 'title') return;
  if (room.isHost) { if (N.auto) { N.auto = null; G.start(N.autoCity || G.startCity, N.autoMode || G.startMode); } return; }
  const m = room.meta(); if (!N.auto && !N.wantStart) return;
  if (!m.started) { showPanel(true); return; } // lobby: wait for the host's PLAY (or tap PLAY to go first)
  N.auto = null; N.wantStart = false;
  SKY.toast('🛫 ' + ((room.players().find((p) => p.host) || {}).name || 'The host') + ' is flying — joining in ' + ((SKY.World.city(m.city) || {}).name || 'their city') + '!', 'good');
  G.start(m.city || N.autoCity || G.startCity, N.autoMode || G.startMode);
}
// called by Game.start: tell the room where we are, and spread players out so planes don't spawn inside each other
N.onStart = (city, mode) => {
  const room = N.room; showPanel(false);
  if (room && room.isHost && N.active()) room.setMeta({ city: city.id, started: true });
  const me = room && room.me(); const slot = me ? me.slot : 0; if (!slot || !room) return;
  const pl = SKY.Game.plane, apt = city.apt;
  if (mode === 'pilot') {
    if (apt && apt.rwys[1] && slot === 1) pl.pos.x = apt.rwys[1].x; // the parallel runway
    else pl.pos.z -= 300 * (apt && apt.rwys[1] ? 1 : slot);        // further up the same runway
  } else { pl.pos.x += 160 * slot; pl.pos.y += 40 * slot; }
  pl.group.updateMatrixWorld(true);
};

// ------------------------------------------------------------------ outgoing state (10 Hz, also while paused / on the title)
let sendI = null, prevCar = null, prevJail = false, prevBust = false;
function myState() {
  const G = SKY.Game, P = SKY.Player, pl = G.plane, C = SKY.Cars, PL = SKY.Places, J = SKY.Jail;
  const r2 = (v) => Math.round(v * 100) / 100;
  const s = { t: 's', ts: Math.round(now()), m: 'title' };
  s.pp = [r2(pl.pos.x), r2(pl.pos.y), r2(pl.pos.z)]; s.pq = [pl.quat.x, pl.quat.y, pl.quat.z, pl.quat.w].map((v) => Math.round(v * 1e4) / 1e4); s.pv = [r2(pl.vel.x), r2(pl.vel.y), r2(pl.vel.z)]; s.gr = pl.gearDown && !pl.gearBroken ? 1 : 0; s.cr = pl.crashed ? 1 : 0;
  if (G.state === 'title' || !G.stats) return s;
  const car = C && C.cur;
  let p = P.pos, yaw = P.yaw, m;
  if (J && J.cur) m = 'jail';
  else if (P.dead) m = 'dead';
  else if (car) { m = 'car'; p = car.pos; yaw = car.yaw; }
  else if (PL && PL.cur && PL.cur.kind === 'interior') { m = 'inside'; p = PL.mapRef(); }
  else if (P.frame === 'plane') { m = P.mode === 'pilot' ? 'pilot' : 'cabin'; p = pl.toWorld(P.pos.clone().setY(P.pos.y + 1)); }
  else m = P.chute ? 'chute' : 'foot';
  s.m = m; s.p = [r2(p.x), r2(p.y), r2(p.z)]; s.yw = Math.round(yaw * 1000) / 1000;
  s.v = car ? [r2(Math.sin(car.yaw) * car.speed), 0, r2(Math.cos(car.yaw) * car.speed)] : P.frame === 'world' ? [r2(P.vel.x), r2(P.vel.y), r2(P.vel.z)] : s.pv;
  s.run = P.running ? 1 : 0;
  if (car) s.car = { k: carKey(car), ty: car.type, c: car.col, sp: r2(car.speed), st: car.stolen ? 1 : 0, br: car.braking ? 1 : 0 };
  if (m === 'inside') s.pn = PL.cur.place.name;
  if (C) { s.w = C.wanted; s.nc = C.evadeT <= 0.5 ? 1 : 0; s.hd = (PL && PL.cur) || P.frame !== 'world' || (J && J.cur) || C.busted ? 1 : 0; }
  if (J && J.cur) s.jl = Math.ceil(J.cur.left);
  s.city = curCity();
  return s;
}
function carKey(car) { if (!car.key) car.key = 'r:' + (N.myPid() || 'x') + ':' + car.id; return car.key; }
function tick() {
  if (!N.active()) return;
  const room = N.room, C = SKY.Cars, G = SKY.Game;
  if (room.isHost && G.state === 'title' && room.meta().city !== G.startCity) room.setMeta({ city: G.startCity }); // joiners start where the host picked
  if (room.count() < 2) { prevCar = C ? C.cur : null; return; }
  room.broadcast(myState()); N.stats.sent++;
  // cars I took / left: hide them on the other screens while I drive, park them where I left them
  const cur = C ? C.cur : null;
  if (prevCar && prevCar !== cur) {
    if (prevCar.gone) room.broadcast({ t: 'cg', k: carKey(prevCar) });
    else room.broadcast({ t: 'cd', k: carKey(prevCar), ty: prevCar.type, c: prevCar.col, x: +prevCar.pos.x.toFixed(2), z: +prevCar.pos.z.toFixed(2), y: +prevCar.yaw.toFixed(3) });
  }
  prevCar = cur;
  // busted / jail / free events -> a message on the partner's screen
  const J = SKY.Jail, nm = N.prof.name;
  const bust = !!(C && C.busted); if (bust && !prevBust) room.broadcast({ t: 'ev', e: 'bust', n: nm }); prevBust = bust;
  const jail = !!(J && J.cur); if (jail !== prevJail) room.broadcast({ t: 'ev', e: jail ? 'jail' : 'free', how: J && J.lastHow, n: nm }); prevJail = jail;
  // host: police for everyone
  if (room.isHost && C) {
    const me = N.myPid();
    const l = C.police().filter((c) => !c.gone).map((c) => [c.id, Math.round(c.pos.x * 100) / 100, Math.round(c.pos.z * 100) / 100, Math.round(c.yaw * 1000) / 1000, Math.round(c.speed * 100) / 100, c.siren ? 1 : 0, c.tgt || me]);
    room.broadcast({ t: 'pol', ts: Math.round(now()), l }); N.stats.pol++;
  }
}

// ------------------------------------------------------------------ incoming
function onMsg(d, from) {
  if (!d || typeof d !== 'object' || from === N.myPid()) return;
  N.stats.recv++;
  if (d.t === 's') { const r = remote(from); if (!r) return; pushState(r, d); }
  else if (d.t === 'pol') { if (!N.isHost()) applyPolice(d); }
  else if (d.t === 'cd') carDrop(d);
  else if (d.t === 'cg') carGone(d.k);
  else if (d.t === 'bye') N.byeFrom[from] = true;
  else if (d.t === 'ev') {
    const n = esc(d.n || 'Your partner');
    if (d.e === 'bust') SKY.toast('🚔 ' + d.n + ' got BUSTED — off to GROK JAIL!', 'warn');
    else if (d.e === 'jail') { }
    else if (d.e === 'free') SKY.toast(d.how === 'escape' ? '🥄 ' + d.n + ' tunnelled out of GROK JAIL (★ wanted)!' : d.how === 'bail' ? '💰 ' + d.n + ' paid bail and is free' : '🔓 ' + d.n + ' is out of GROK JAIL', 'good');
    void n;
  }
}
function remote(pid) {
  const room = N.room; if (!room) return null; const p = room.player(pid); if (!p) return null;
  let r = N.remotes[pid];
  if (!r) r = N.remotes[pid] = { pid, name: p.name, color: p.color, slot: p.slot, buf: [], off: null, offs: [], last: null, cur: null, plane: null, person: null, car: null, tag: null };
  r.name = p.name; r.color = p.color; r.slot = p.slot; r.host = p.host; r.ping = p.ping;
  return r;
}
function syncRemotes() { const room = N.room; if (!room) return; for (const p of room.players()) if (p.pid !== room.pid) remote(p.pid); for (const k in N.remotes) if (!room.player(k)) dropRemote(k); }
function pushState(r, s) {
  const t = now(); const o = t - s.ts; // clock offset + one-way latency; the smallest recent value is the best guess
  r.offs.push(o); if (r.offs.length > 40) r.offs.shift(); r.off = Math.min.apply(null, r.offs);
  if (r.buf.length && s.ts <= r.buf[r.buf.length - 1].ts) return; // out of order
  s.rt = t; r.buf.push(s); if (r.buf.length > 30) r.buf.shift(); r.last = s;
  if (r.last.m !== 'car') r.lastCarKey = null; else r.lastCarKey = s.car && s.car.k;
}
function dropRemote(pid) {
  const r = N.remotes[pid]; if (!r) return; delete N.remotes[pid];
  if (r.plane) { r.plane.parent && r.plane.parent.remove(r.plane); if (r.planeGrid) r.planeGrid.dispose(); }
  if (r.tag) r.tag.remove(); if (r.chute) r.chute.parent && r.chute.parent.remove(r.chute);
  const C = SKY.Cars; if (C) { for (const c of C.police().slice()) if (c.tgt === pid && N.isHost()) c.tgtLost = true; for (const c of C.list) if (c.key && c.netHidden && c.key === r.lastCarKey) c.netHidden = false; }
}
function clearRemotes() { for (const k of Object.keys(N.remotes)) dropRemote(k); N.removeNetPolice(); const C = SKY.Cars; if (C) for (const c of C.list) c.netHidden = false; prevCar = null; }

// interpolation: render ~120 ms in the past between two received states, extrapolate a little if packets are late
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const lerpA = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * f; };
function sample(r) {
  const b = r.buf; if (!b.length) return null;
  const rt = now() - r.off - DELAY; // render time in the sender's clock
  let i = b.length - 1; while (i > 0 && b[i - 1].ts > rt) i--;
  const B = b[i], A = i > 0 ? b[i - 1] : null;
  const out = { m: B.m, s: B };
  const v3 = (k, f, a, bb) => [a[k][0] + (bb[k][0] - a[k][0]) * f, a[k][1] + (bb[k][1] - a[k][1]) * f, a[k][2] + (bb[k][2] - a[k][2]) * f];
  if (A && rt <= B.ts && rt >= A.ts) {
    const f = (rt - A.ts) / Math.max(1, B.ts - A.ts);
    out.pp = v3('pp', f, A, B); _qa.fromArray(A.pq); _qb.fromArray(B.pq); out.pq = _qa.slerp(_qb, f).toArray();
    if (A.p && B.p && A.m === B.m && hyp(B.p[0] - A.p[0], B.p[2] - A.p[2]) < 60) { out.p = v3('p', f, A, B); out.yw = lerpA(A.yw, B.yw, f); } else if (B.p) { out.p = B.p.slice(); out.yw = B.yw; }
    out.lag = 0;
  } else { // newest state is older than the render time -> extrapolate along its velocity (capped)
    const L = b[b.length - 1]; const dt = Math.max(0, Math.min(EXTRA_MAX, rt - L.ts)) / 1000;
    out.s = L; out.m = L.m;
    out.pp = [L.pp[0] + L.pv[0] * dt, L.pp[1] + L.pv[1] * dt, L.pp[2] + L.pv[2] * dt]; out.pq = L.pq.slice();
    if (L.p) { const v = L.v || [0, 0, 0]; out.p = [L.p[0] + v[0] * dt, L.p[1] + (L.m === 'chute' ? v[1] * dt : 0), L.p[2] + v[2] * dt]; out.yw = L.yw; }
    out.lag = rt - L.ts;
  }
  return out;
}

// ------------------------------------------------------------------ remote visuals
const remPlaneMat = {};
function buildPlane(r) {
  const G = SKY.Game; const fake = {}; const grid = SKY.Plane.prototype.buildGrid.call(fake); const g = new THREE.Group(); grid.build(g);
  // colour flash on the tail fin + wingtips so you can tell planes apart at a glance
  const col = new THREE.Color(r.color); const m = remPlaneMat[r.color] || (remPlaneMat[r.color] = new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.25) }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 3.4), m); fin.position.set(0, 4.9, 14.6); g.add(fin);
  for (const sx of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.8), m); tip.position.set(sx * 14.6, 0.1, 3.4); g.add(tip); }
  const gear = new THREE.Group(); const gm = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const gp of [[0, -11], [-2.4, 1.6], [2.4, 1.6]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.9), gm); w.position.set(gp[0], -2.3, gp[1]); gear.add(w); }
  g.add(gear); g.userData.gear = gear;
  G.scene.add(g); r.plane = g; r.planeGrid = grid;
}
let writer = null;
function person(r) {
  if (!writer) writer = new SKY.CharWriter(SKY.Game.scene, 3 * 8);
  if (!r.person) { const p = r.person = new SKY.Person('pax', 'world'); p.shirt = new THREE.Color(r.color).getHex(); p.name = r.name; p.state = 'idle'; p.pose(0, true); }
  return r.person;
}
function tagEl(r) {
  if (r.tag) return r.tag;
  const box = $('mptags'); if (!box) return null;
  const el = document.createElement('div'); el.className = 'mptag'; el.innerHTML = '<b></b><small></small>'; box.appendChild(el); r.tag = el; return el;
}
const MODE_ICON = { pilot: '🧑‍✈️ flying', cabin: '💺 on board', foot: '🚶', chute: '🪂', car: '🚗', inside: '🏠', jail: '🔒 GROK JAIL', dead: '💫 KO', title: '⏳ on the title screen' };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
// per rendered frame (Game.render): place remote planes / avatars / cars / tags, smooth the host's police on clients
N.frame = (dt) => {
  const G = SKY.Game, C = SKY.Cars;
  if (C) C.extra = [];
  if (writer) writer.begin();
  const on = N.active() && G.state !== 'title' && !!G.stats;
  const keys = new Set();
  for (const pid in N.remotes) {
    const r = N.remotes[pid]; const S = on ? sample(r) : null; r.cur = S;
    if (!S || S.m === 'title' || !S.pp) { if (r.plane) r.plane.visible = false; if (r.tag) r.tag.style.display = 'none'; continue; }
    // their plane (always: parked, taxiing or flying)
    if (!r.plane) buildPlane(r);
    r.plane.visible = true; r.plane.position.set(S.pp[0], S.pp[1], S.pp[2]); r.plane.quaternion.fromArray(S.pq); r.plane.userData.gear.visible = !!S.s.gr;
    // their body / car
    let anchor = null, extraY = 2.3;
    if (S.p) {
      if (S.m === 'car' && S.s.car && C) {
        const T = C.TYPES[S.s.car.ty] || C.TYPES.sedan;
        const gc = r.car || (r.car = { T, pos: new THREE.Vector3(), yaw: 0, col: 0, siren: false, braking: false, speed: 0, kind: 'remote', remote: r });
        gc.T = T; gc.col = S.s.car.c; gc.pos.set(S.p[0], SKY.World.heightAt(S.p[0], S.p[2]), S.p[2]); gc.yaw = S.yw; gc.speed = S.s.car.sp; gc.braking = !!S.s.car.br;
        C.extra.push(gc); if (S.s.car.k) keys.add(S.s.car.k); anchor = _v.set(gc.pos.x, gc.pos.y + T.h1 + T.h2 + 1.3, gc.pos.z);
      } else if (S.m === 'foot' || S.m === 'jail' || S.m === 'chute' || S.m === 'dead') {
        const p = person(r); const vx = S.s.v ? hyp(S.s.v[0], S.s.v[2]) : 0;
        p.pos.set(S.p[0], S.p[1], S.p[2]); p.yaw = S.yw; p.state = S.m === 'chute' ? 'para' : S.m === 'dead' ? 'sit' : vx > 0.6 ? 'walk' : 'idle'; p.anim += dt * (S.s.run ? 1.8 : 1); p.panic = 0;
        p.pose(dt, false); p.render(writer); anchor = _v.set(S.p[0], S.p[1] + 2.25, S.p[2]);
      } else if (S.m === 'pilot' || S.m === 'cabin') anchor = _v.set(S.pp[0], S.pp[1] + 6, S.pp[2]);
      else anchor = _v.set(S.p[0], (S.p[1] || 0) + 3, S.p[2]);
    } else anchor = _v.set(S.pp[0], S.pp[1] + 6, S.pp[2]);
    void extraY;
    // name tag
    const el = tagEl(r); if (!el) continue;
    _w.copy(anchor).project(G.camera); const d = anchor.distanceTo(G.camPos);
    const vis = _w.z < 1 && _w.z > -1 && Math.abs(_w.x) < 1.05 && Math.abs(_w.y) < 1.05 && d < 25000;
    el.style.setProperty('--c', r.color);
    const stars = S.s.w > 0 ? ' ' + '★'.repeat(S.s.w) : '';
    const sub = (S.m === 'jail' ? '🔒 GROK JAIL · ' + (S.s.jl || 0) + ' s' : S.m === 'inside' ? '🏠 in ' + (S.s.pn || 'a place') : MODE_ICON[S.m] || '') + ' · ' + (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km');
    const top = esc(r.name) + stars;
    if (el._t !== top) { el.firstChild.innerHTML = top; el._t = top; } if (el._s !== sub) { el.lastChild.textContent = sub; el._s = sub; }
    el.classList.toggle('wanted', S.s.w > 0); el.classList.toggle('lag', S.lag > 2000);
    if (!vis) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; const tx = (_w.x + 1) / 2 * G.W | 0, ty = (1 - _w.y) / 2 * G.H | 0; el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-100%)';
    el.classList.toggle('under', underTouch(tx - el.offsetWidth / 2, ty - el.offsetHeight, tx + el.offsetWidth / 2, ty)); // phone: a tag never hides a button
  }
  for (const pid in N.remotes) { const r = N.remotes[pid]; if (!on && r.tag) r.tag.style.display = 'none'; }
  if (writer) writer.end();
  // cars my partners are driving are hidden here (their ghost car is drawn instead)
  if (C) for (const c of C.list) if (c.key) { const h = keys.has(c.key) && c !== C.cur; if (c.netHidden !== h) c.netHidden = h; }
  if (on && N.isClient()) smoothPolice(dt);
  // formation achievement: both airborne within 300 m
  if (on && G.plane && !G.plane.onGround && SKY.Player.mode === 'pilot') for (const pid in N.remotes) { const S = N.remotes[pid].cur; if (S && S.m === 'pilot' && S.pp && S.pp[1] - SKY.World.heightAt(S.pp[0], S.pp[2]) > 60 && hyp(S.pp[0] - G.plane.pos.x, S.pp[1] - G.plane.pos.y, S.pp[2] - G.plane.pos.z) < 300) G.achieve('formation'); }
  badge();
};

// ------------------------------------------------------------------ police (host authoritative)
// target info for the host's police AI: latest state of that player, extrapolated to now
N.target = (pid) => {
  const r = N.remotes[pid]; if (!r || !r.last || !r.last.p) return null; const L = r.last;
  if (L.m === 'title') return null;
  const dt = Math.min(0.5, (now() - L.rt) / 1000); const v = L.v || [0, 0, 0];
  const inCar = L.m === 'car' && !!L.car;
  return { pid, pos: new THREE.Vector3(L.p[0] + v[0] * dt, L.p[1], L.p[2] + v[2] * dt), inCar, speed: inCar ? L.car.sp : 0, yaw: inCar ? L.yw : -L.yw, wanted: L.w || 0, hidden: !!L.hd, needCops: !!L.nc };
};
N.wantedTargets = () => { const out = []; for (const pid in N.remotes) { const t = N.target(pid); if (t && t.wanted > 0) out.push(t); } return out; };
// client: the host's cruisers replace any local police
let polT = 0;
function applyPolice(d) {
  const C = SKY.Cars; if (!C) return; polT = now(); N.stats.polRecv = (N.stats.polRecv || 0) + 1;
  const seen = new Set();
  for (const a of d.l) {
    const [id, x, z, yaw, sp, siren, tgt] = a; seen.add(id);
    let car = C.list.find((c) => c.net && c.netId === id);
    if (!car) { car = C.make('police', x, z, yaw, { kind: 'police', net: true, netId: id, siren: !!siren }); car.speed = sp; }
    car.nx = x; car.nz = z; car.nyaw = yaw; car.nsp = sp; car.nt = now(); car.siren = !!siren; car.tgt = tgt;
  }
  for (const c of C.list.slice()) if (c.kind === 'police' && (!c.net || !seen.has(c.netId))) C.remove(c);
}
function smoothPolice(dt) {
  const C = SKY.Cars; const t = now();
  for (const c of C.list) {
    if (!c.net || c.nx == null) continue;
    const e = Math.min(0.4, (t - c.nt) / 1000); const tx = c.nx + Math.sin(c.nyaw) * c.nsp * e, tz = c.nz + Math.cos(c.nyaw) * c.nsp * e;
    const d = hyp(tx - c.pos.x, tz - c.pos.z);
    if (d > 25) { c.pos.x = tx; c.pos.z = tz; c.yaw = c.nyaw; } else { const f = Math.min(1, dt * 10); c.pos.x += (tx - c.pos.x) * f; c.pos.z += (tz - c.pos.z) * f; c.yaw = lerpA(c.yaw, c.nyaw, f); }
    c.speed = c.nsp; c.pos.y = SKY.World.heightAt(c.pos.x, c.pos.z);
  }
}
N.removeLocalPolice = () => { const C = SKY.Cars; if (!C || N.isHost()) return; for (const c of C.police().slice()) if (!c.net) C.remove(c); };
N.removeNetPolice = () => { const C = SKY.Cars; if (!C) return; for (const c of C.police().slice()) if (c.net || c.tgt) C.remove(c); };
// is this cruiser chasing ME? (host: its own cops have no target id; clients: the host tags each cop with its target)
N.mine = (c) => !c.tgt || c.tgt === N.myPid();

// ------------------------------------------------------------------ shared cars
function carDrop(d) {
  const C = SKY.Cars; if (!C || !d.k) return;
  let car = C.list.find((c) => c.key === d.k);
  if (car === C.cur) return;
  if (!car) { if (!C.TYPES[d.ty]) return; car = C.make(d.ty, d.x, d.z, d.y, { kind: 'parked', col: d.c, key: d.k }); }
  car.pos.set(d.x, SKY.World.heightAt(d.x, d.z), d.z); car.yaw = d.y; car.speed = 0; car.netHidden = false;
  if (car.kind === 'npc') { car.kind = 'parked'; car.path = null; }
}
function carGone(k) { const C = SKY.Cars; if (!C) return; const car = C.list.find((c) => c.key === k); if (car && car !== C.cur) C.remove(car); }

// ------------------------------------------------------------------ minimap + big map
N.drawMini = (x, ref, sc, hdg, S) => {
  if (!N.active()) return;
  for (const pid in N.remotes) {
    const r = N.remotes[pid], c = r.cur; if (!c || c.m === 'title') continue;
    const wp = c.p && c.m !== 'pilot' && c.m !== 'cabin' ? c.p : c.pp; if (!wp) continue;
    let dx = (wp[0] - ref.x) * sc, dz = (wp[2] - ref.z) * sc; const L = hyp(dx, dz), R = S / 2 - 9; let edge = false;
    if (L > R) { dx *= R / L; dz *= R / L; edge = true; }
    x.save(); x.translate(dx, dz); x.rotate(hdg);
    x.fillStyle = r.color; x.strokeStyle = '#fff'; x.lineWidth = 2;
    x.beginPath(); if (edge) { x.arc(0, 0, 5, 0, 6.29); } else { x.arc(0, 0, 6, 0, 6.29); } x.fill(); x.stroke();
    x.font = 'bold 10px sans-serif'; x.textAlign = edge ? 'center' : 'left'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.8)';
    const t = r.name.slice(0, 8) + (edge ? ' ➚' : ''); const tx = edge ? 0 : 8, ty = edge ? -8 : 4; x.strokeText(t, tx, ty); x.fillStyle = r.color; x.fillText(t, tx, ty);
    x.restore(); N.stats.mini = (N.stats.mini || 0) + 1;
  }
};
N.drawBigMap = (x, mb, sx, sz) => {
  if (!N.active()) return;
  for (const pid in N.remotes) {
    const r = N.remotes[pid], c = r.cur || sample(r); if (!c || c.m === 'title') continue; const wp = c.p && c.m !== 'pilot' && c.m !== 'cabin' ? c.p : c.pp; if (!wp) continue;
    const px = (wp[0] - mb.x0) * sx, pz = (wp[2] - mb.z0) * sz;
    x.fillStyle = r.color; x.beginPath(); x.arc(px, pz, 7, 0, 6.29); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
    x.font = 'bold 13px sans-serif'; x.lineWidth = 3; x.strokeStyle = '#000'; x.strokeText(r.name, px + 9, pz + 4); x.fillStyle = r.color; x.fillText(r.name, px + 9, pz + 4); x.lineWidth = 1;
  }
};

// ------------------------------------------------------------------ HUD badge
// phone touch buttons (rects cached ~1 s): name tags that drift under one fade out so the button stays readable
let tbR = [], tbT = 0;
function underTouch(l, t, r, b) {
  if (!document.body.classList.contains('touchdev')) return false;
  const T = now(); if (T - tbT > 1000) { tbT = T; tbR = []; document.querySelectorAll('#touch button, #touch .tb, #touch .ts, #joybase, #minimap').forEach((e) => { const q = e.getBoundingClientRect(); if (q.width > 2 && q.height > 2 && e.offsetParent !== null) tbR.push([q.left, q.top, q.right, q.bottom]); }); }
  for (const q of tbR) if (l < q[2] && r > q[0] && t < q[3] && b > q[1]) return true; return false;
}
function badge() {
  const b = $('mpbadge'); if (!b) return;
  const G = SKY.Game, room = N.room;
  if (!room || G.state === 'title') { b.style.display = 'none'; return; }
  b.style.display = 'block';
  const lost = !N.active(); const n = room.count(), max = room.isHost ? N.n : (room.meta().n || 3);
  const ms = room.ping | 0; const cls = lost ? 'off' : ms > 180 ? 'bad' : ms > 90 ? 'mid' : '';
  const txt = '🌐 ' + room.code + ' · ' + n + '/' + max + (lost ? ' · …' : n > 1 ? '<span class="ms"> · ' + ms + 'ms</span>' : '');
  if (b._t !== txt) { b.innerHTML = '<i></i>' + txt; b._t = txt; } if (b._c !== cls) { b.className = cls; b._c = cls; }
  // the WANTED ★ banner sits in the same top-centre spot on desktop / landscape: it wins, the badge steps aside
  const w = $('wanted'); let hide = false;
  if (w && w.style.display === 'block') { const r1 = b.getBoundingClientRect(), r2 = w.getBoundingClientRect(); hide = r1.left < r2.right && r1.right > r2.left && r1.top < r2.bottom && r1.bottom > r2.top; }
  b.style.visibility = hide ? 'hidden' : '';
}

// ------------------------------------------------------------------ lobby panel (title screen + pause menu)
function panelStatus(t, cls) { const s = $('mp-status'); if (!s) return; s.textContent = t || ''; s.className = cls || ''; }
function showPanel(on) {
  const p = $('mp'); if (!p) return;
  p.classList.toggle('show', !!on);
  if (on) { renderPanel(); SKY.Game.unlockPointer && SKY.Game.unlockPointer(); }
}
N.showPanel = showPanel;
function renderPanel() {
  const p = $('mp'); if (!p) return;
  const room = N.room, G = SKY.Game;
  const connected = !!room && N.active();
  $('mp-setup').style.display = room ? 'none' : 'block';
  $('mp-room').style.display = room ? 'block' : 'none';
  if (!room) return;
  $('mp-codebig').textContent = room.code;
  $('mp-codehint').textContent = room.isHost ? 'Share this code — friends tap 🌐 ONLINE → JOIN (up to ' + N.n + ' players)' : connected ? 'You are in this room' : 'Connecting…';
  const list = room.players();
  $('mp-list').innerHTML = list.map((pl) => { const r = N.remotes[pl.pid]; const S = r && r.cur; const where = pl.pid === room.pid ? 'you' : S ? (MODE_ICON[S.m] || S.m) + (S.s && S.s.city ? ' · ' + S.s.city : '') : '…';
    return '<div class="mprow"><i style="background:' + esc(pl.color) + '"></i><b>' + esc(pl.name) + '</b>' + (pl.host ? '<em>HOST</em>' : '') + '<small>' + esc(where) + (pl.pid !== room.pid && pl.ping ? ' · ' + pl.ping + ' ms' : '') + '</small></div>'; }).join('') +
    (connected && list.length < (room.isHost ? N.n : 3) ? '<div class="mprow wait"><i></i><b>Waiting for a friend…</b><small>code ' + room.code + '</small></div>' : '');
  const play = $('mp-play'); const m = room.meta();
  play.textContent = G.state === 'title' ? (room.isHost ? '▶ PLAY (' + (SKY.World.city(G.startCity) || {}).name + ')' : '▶ PLAY' + (m.city ? ' in ' + ((SKY.World.city(m.city) || {}).name || m.city) : '')) : '▶ Back to the game';
  play.disabled = !connected && G.state === 'title' && !room.isHost;
  const others = list.filter((pl) => pl.pid !== room.pid);
  const go = $('mp-goto'); go.style.display = G.state !== 'title' && others.length ? '' : 'none'; if (others.length) go.textContent = '📍 Fly to ' + others[0].name;
}
function buildPanel() {
  const p = $('mp'); if (!p) return;
  ['keydown', 'keyup'].forEach((t) => p.addEventListener(t, (e) => e.stopPropagation()));
  const nm = $('mp-name'); nm.value = N.prof.name; nm.addEventListener('input', () => { N.prof.name = GN ? GN.cleanName(nm.value) : nm.value; saveProf(); });
  const cs = $('mp-colors'); cs.innerHTML = COLORS.map((c) => '<button data-c="' + c + '" style="background:' + c + '" aria-label="colour ' + c + '"></button>').join('');
  const selC = () => cs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.c === N.prof.color));
  cs.querySelectorAll('button').forEach((b) => b.onclick = () => { N.prof.color = b.dataset.c; saveProf(); selC(); });
  selC();
  const ns = $('mp-n'); const selN = () => ns.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', +b.dataset.n === N.n));
  ns.querySelectorAll('button').forEach((b) => b.onclick = () => { N.n = +b.dataset.n; selN(); }); selN();
  const code = $('mp-code'); code.addEventListener('input', () => { const v = GN ? GN.normalizeCode(code.value) : code.value; if (v !== code.value) code.value = v; });
  $('mp-host').onclick = () => { SKY.Audio.init(); N.host({ n: N.n }); };
  $('mp-join').onclick = () => { SKY.Audio.init(); if (SKY.Game.state === 'title') N.wantStart = true; N.join(code.value); };
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('mp-join').click(); });
  $('mp-leave').onclick = () => { N.leave(); panelStatus(''); };
  $('mp-x').onclick = () => showPanel(false);
  $('mp-play').onclick = () => { const G = SKY.Game, room = N.room; showPanel(false); N.wantStart = false; N.auto = null; if (G.state === 'title') { const m = room && !room.isHost ? room.meta() : {}; G.start(m.city || G.startCity); } else if (G.state === 'paused') G.resume(); };
  $('mp-goto').onclick = () => N.gotoPartner();
  const tb = $('t-online'); if (tb) tb.onclick = () => { SKY.Audio.init(); showPanel(true); };
  const pb = $('p-online'); if (pb) pb.onclick = () => showPanel(true);
}
// fast-travel next to a partner: same city, parked at a gate if they're on the ground, on final approach if they're flying
N.gotoPartner = (pid) => {
  const G = SKY.Game; const r = pid ? N.remotes[pid] : Object.values(N.remotes)[0]; const S = r && (r.cur || sample(r)); if (!S || !S.s) return false;
  const wp = S.p || S.pp; const city = SKY.World.nearestCity(wp[0], wp[2]).city; const air = S.m === 'pilot' && S.pp[1] - SKY.World.heightAt(S.pp[0], S.pp[2]) > 80;
  showPanel(false); if (G.state === 'paused') G.resume();
  G.fastTravel(city.id, city.apt ? (air ? 'approach' : 'gate') : 'runway');
  SKY.toast('📍 Heading to ' + r.name + ' in ' + city.name, 'good');
  return true;
};

// ------------------------------------------------------------------ boot
N.init = () => {
  loadProf(); buildPanel();
  sendI = setInterval(() => { try { tick(); } catch (e) { console.warn('net tick', e); } }, SEND_MS);
  const prm = GN && GN.params();
  if (prm) { // launched with ?mp=host|join&code=..
    const q = prm.q; N.auto = prm.mode; N.autoCity = (q.get('city') || '').toUpperCase() || null; if (N.autoCity && !SKY.World.city(N.autoCity)) N.autoCity = null;
    const st = q.get('start'); N.autoMode = st === 'cabin' ? 'cabin' : st === 'pilot' ? 'pilot' : null;
    N.prof.name = prm.name; N.prof.color = prm.color; N.n = prm.n;
    const nm = $('mp-name'); if (nm) nm.value = prm.name;
    N.open({ role: prm.mode, code: prm.code, name: prm.name, color: prm.color, pid: prm.pid, slot: prm.slot, n: prm.n, rejoin: false });
  }
};
// test hook
N.sampleNow = (pid) => { const r = pid ? N.remotes[pid] : Object.values(N.remotes)[0]; const S = r && sample(r); return S ? { m: S.m, p: S.p, pp: S.pp, lag: S.lag, t: now() } : null; };
N.debug = () => {
  const room = N.room; const C = SKY.Cars;
  const rem = Object.values(N.remotes).map((r) => { const c = sample(r) || r.cur; return { pid: r.pid, name: r.name, color: r.color, m: c && c.m, p: c && c.p && c.p.map((v) => +v.toFixed(2)), pp: c && c.pp && c.pp.map((v) => +v.toFixed(1)), lag: c ? Math.round(c.lag) : null, buf: r.buf.length, plane: !!(r.plane && r.plane.visible), tag: !!(r.tag && r.tag.style.display === 'block'), tagText: r.tag ? r.tag.textContent : '', w: c && c.s && c.s.w, jl: c && c.s && c.s.jl }; });
  return { on: N.active(), host: N.isHost(), code: room && room.code, count: N.count(), pid: N.myPid(), slot: room && room.me() ? room.me().slot : null, meta: room ? room.meta() : null, remotes: rem, stats: Object.assign({}, N.stats), police: C ? C.police().map((c) => ({ id: c.id, net: !!c.net, tgt: c.tgt || null, x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), sp: +(c.speed || 0).toFixed(1), siren: !!c.siren })) : [], hidden: C ? C.list.filter((c) => c.netHidden).map((c) => c.key) : [], extra: C && C.extra ? C.extra.length : 0, err: N.lastErr };
};
})();

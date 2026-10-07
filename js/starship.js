'use strict';
// GROK SKY 4.0 - STARSHIP: board at the Starbase tower (or a Moon / Mars base pad) → countdown → liftoff → hot staging +
// Mechazilla booster catch → a quick trip through space (skippable) → belly-flop + flip landing at the base → walk out.
// Deterministic timeline, so friends who board together ride the same flight (net.js relays board / skip messages).
(() => {
const W = SKY.World;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const SS = SKY.Starship = { ride: null, ghost: null, statics: {}, padBShip: false, caughtT: 0 };
const DEST = { MOON: { icon: '🌕', name: 'Moon Base Artemis', short: 'the Moon' }, MARS: { icon: '🔴', name: 'Mars Base Alpha', short: 'Mars' }, SBX: { icon: '🌍', name: 'Starbase, Earth', short: 'Earth' } };
SS.DEST = DEST;
// ---------------------------------------------------------------- models (stainless steel stack, origin = bottom centre)
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = { steel: new THREE.MeshLambertMaterial({ color: 0xc9ced6 }), dark: new THREE.MeshLambertMaterial({ color: 0x2b2d33 }), tile: new THREE.MeshLambertMaterial({ color: 0x1c1d22 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    core: new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    smoke: new THREE.MeshLambertMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0.55, depthWrite: false }) };
  return MAT;
}
function flame(R, L) { const M = mats(); const g = new THREE.Group(); const o = new THREE.Mesh(new THREE.ConeGeometry(R, L, 14, 1, true), M.flame); o.rotation.x = Math.PI; o.position.y = -L / 2; g.add(o); const c = new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, L * 0.6, 10, 1, true), M.core); c.rotation.x = Math.PI; c.position.y = -L * 0.3; g.add(c); g.visible = false; return g; }
function shipModel() {
  const M = mats(); const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 36, 24), M.steel); body.position.y = 18; g.add(body);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(4.56, 4.56, 48, 24, 1, true, -Math.PI / 2, Math.PI), M.tile); shield.position.y = 24; g.add(shield);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 4.5, 14, 24), M.steel); nose.position.y = 43; g.add(nose);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), M.steel); tip.position.y = 50; g.add(tip);
  for (const s of [-1, 1]) { const af = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7, 0.5), M.tile); af.position.set(s * 6.2, 4.5, 1.5); g.add(af); const ff = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), M.tile); ff.position.set(s * 4.9, 41, 1.6); ff.rotation.z = s * 0.12; g.add(ff); }
  for (const s of [-1, 1]) for (const t of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), M.dark); leg.position.set(s * 3.2, -1.2, t * 3.2); g.add(leg); }
  const f = flame(3.2, 26); g.add(f); g.userData.flame = f;
  return g;
}
function boosterModel() {
  const M = mats(); const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 71, 24), M.steel); body.position.y = 35.5; g.add(body);
  const soot = new THREE.Mesh(new THREE.CylinderGeometry(4.56, 4.56, 10, 24, 1, true), M.dark); soot.position.y = 5; g.add(soot);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 2.2, 24), M.dark); ring.position.y = 72.1; g.add(ring);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.6, 3.2), M.dark); fin.position.set(Math.cos(a) * 5.6, 66, Math.sin(a) * 5.6); fin.rotation.y = -a; g.add(fin); }
  const f = flame(5, 40); g.add(f); g.userData.flame = f;
  return g;
}
function stackModel() { const g = new THREE.Group(); const b = boosterModel(), s = shipModel(); s.position.y = 73.2; g.add(b); g.add(s); g.userData.booster = b; g.userData.ship = s; return g; }
// ---------------------------------------------------------------- places
const city = (id) => W.city(id);
function mountPos(out) { const c = city('SBX'), S = SKY.SB; return out.set(c.x + S.pad[0], S.mountY, c.z + S.pad[1]); }
function padPos(id, out) {
  const c = city(id); if (id === 'SBX') return out.set(c.x + SKY.SB.padB[0], 1.0, c.z + SKY.SB.padB[1]);
  const p = SKY.SpaceBase.pad; return out.set(c.x + p[0], 1.0, c.z + p[1]);
}
SS.boardPos = (id) => { const v = new THREE.Vector3(); if (id === 'SBX') { const c = city('SBX'); return v.set(c.x + SKY.SB.tower[0] + 16, 1.2, c.z + SKY.SB.tower[1] + 2); } padPos(id, v); v.x += 9; v.z += 9; v.y = 1.2; return v; };
// interactables (registered with the city build: removed again when it unloads)
SS.register = (c) => {
  const pos = SS.boardPos(c.id);
  W.interactables.push({ city: c, pos, r: 7, label: () => (SS.ride ? null : '🚀 Board Starship → ' + (c.id === 'SBX' ? 'Moon / Mars' : 'Earth / ' + (c.id === 'MOON' ? 'Mars' : 'Moon'))), act: () => SS.panel(c.id) });
  if (c.id === 'SBX') W.interactables.push({ city: c, pos: new THREE.Vector3(c.x + SKY.SB.padB[0], 1.2, c.z + SKY.SB.padB[1] + 20), r: 8, label: () => (SS.padBShip && !SS.ride ? '🚀 Board the landed Starship → Moon / Mars' : null), act: () => SS.panel('SBX') });
};
// ---------------------------------------------------------------- static ships (on the pads)
function ensureStatics() {
  const G = SKY.Game; if (!G || !G.scene) return; const v = new THREE.Vector3();
  for (const id of ['SBX', 'MOON', 'MARS']) {
    const c = city(id); let s = SS.statics[id];
    if (c.built && !s) {
      s = SS.statics[id] = id === 'SBX' ? stackModel() : shipModel();
      if (id === 'SBX') mountPos(s.position); else padPos(id, s.position).y += 2.7;
      G.scene.add(s); if (!c._ssReg) { c._ssReg = true; SS.register(c); }
      if (id === 'SBX') { const pb = SS.padB = shipModel(); padPos('SBX', pb.position).y += 2.7; pb.visible = false; G.scene.add(pb); }
    } else if (!c.built && s) { G.scene.remove(s); SS.statics[id] = null; c._ssReg = false; if (id === 'SBX' && SS.padB) { G.scene.remove(SS.padB); SS.padB = null; } }
    void v;
  }
}
// ---------------------------------------------------------------- UI
function overlay() {
  let o = $('ssov'); if (o) return o;
  o = document.createElement('div'); o.id = 'ssov'; o.innerHTML = '<div id="ss-big"></div><div id="ss-sub"></div><button id="ss-skip">⏩ Skip to landing</button>'; document.body.appendChild(o);
  $('ss-skip').addEventListener('click', (e) => { e.stopPropagation(); SS.skip(true); }); $('ss-skip').addEventListener('pointerdown', (e) => e.stopPropagation());
  return o;
}
function ovSet(big, sub, skip) { const o = overlay(); o.style.display = 'block'; if ($('ss-big')._t !== big) { $('ss-big').textContent = big; $('ss-big')._t = big; } if ($('ss-sub')._t !== sub) { $('ss-sub').textContent = sub; $('ss-sub')._t = sub; } $('ss-skip').style.display = skip ? '' : 'none'; }
function ovHide() { const o = $('ssov'); if (o) o.style.display = 'none'; }
SS.panel = (from) => {
  const opts = from === 'SBX' ? ['MOON', 'MARS'] : from === 'MOON' ? ['SBX', 'MARS'] : ['SBX', 'MOON'];
  const partner = SKY.Net && SKY.Net.active && SKY.Net.active() && SKY.Net.count() > 1;
  const html = '<p>Strap in! Countdown → liftoff' + (from === 'SBX' ? ' → hot staging (watch the chopsticks catch the booster!)' : '') + ' → space → landing. About a minute (you can skip the space part).</p>' +
    (partner ? '<p class="fine">🤝 Your friend gets a "Ride along" button if they are nearby — board together and land together!</p>' : '') +
    '<div class="row">' + opts.map((d) => '<button class="go big" id="ss-go-' + d + '">' + DEST[d].icon + ' ' + DEST[d].name + '</button>').join('') + '</div>';
  SKY.Mini.open('🚀 Starship — choose your destination', html, 'starship');
  for (const d of opts) $('ss-go-' + d).onclick = (e) => { e.stopPropagation(); SKY.Game.closeUI(); SS.start(from, d); };
};
// ---------------------------------------------------------------- ride
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const COUNT = (from) => (from === 'SBX' ? 10 : 5), ASC = (from) => (from === 'SBX' ? 27 : 9), SPACE = 15, LAND = 14;
SS.start = (from, dest, o) => {
  o = o || {}; const G = SKY.Game, P = SKY.Player;
  if (SS.ride || G.state !== 'play') return false;
  if (SKY.Places && SKY.Places.cur) SKY.Places.reset(); if (SKY.Cars && SKY.Cars.cur) return false;
  if (P.held) P.dropHeld();
  W.ensureCity(city(from)); ensureStatics();
  const R = SS.ride = { from, dest, phase: 'count', t: o.t0 || 0, T: 0, seat: o.seat || 0, crew: o.crew || [], model: null, booster: null, caught: false, sep: null, net: !!o.join, lastSec: -1 };
  // the ride model replaces the static ship we are standing next to
  R.model = from === 'SBX' ? stackModel() : shipModel(); G.scene.add(R.model);
  if (from === 'SBX') { if (SS.padBShip && o.fromPadB) { SS.padBShip = false; } mountPos(R.model.position); R.base = R.model.position.clone(); } else { padPos(from, R.model.position).y += 2.7; R.base = R.model.position.clone(); }
  const st = SS.statics[from]; if (st) st.visible = false;
  P.mode = 'ride'; P.frame = 'world'; P.vel.set(0, 0, 0); P.target = null; P.pos.copy(R.base);
  document.body.classList.add('ssride');
  SKY.Audio.play('beep'); G.achieve('starship');
  if (!o.join && SKY.Net && SKY.Net.ssBoard) SKY.Net.ssBoard(from, dest);
  SKY.toast('🚀 Boarding Starship → ' + DEST[dest].icon + ' ' + DEST[dest].name + '. Strap in!', 'good');
  return true;
};
SS.active = () => !!SS.ride;
SS.skip = (local) => { const R = SS.ride; if (!R) return; if (R.phase === 'space' || (R.phase === 'ascent' && R.t > (R.from === 'SBX' ? 14 : 4))) { R.phase = 'land'; R.t = 0; landInit(R); if (local && SKY.Net && SKY.Net.ssSkip) SKY.Net.ssSkip(); } };
function cleanup() {
  const R = SS.ride, G = SKY.Game; if (!R) return; SS.ride = null;
  if (R.model && R.model.parent) R.model.parent.remove(R.model); if (R.booster && R.booster.parent) R.booster.parent.remove(R.booster);
  for (const id in SS.statics) if (SS.statics[id]) SS.statics[id].visible = true;
  document.body.classList.remove('ssride'); ovHide(); void G;
}
SS.abort = () => { if (SS.ride) cleanup(); };
// stack / ship pose during the ascent (shared by riders and by friends watching the launch)
function ascentPose(R, t, out) {
  const b = R.base; const sb = R.from === 'SBX';
  const y = sb ? 1.5 * t * t + t * t * t / 12 : 2.2 * t * t + t * t * t / 5;
  const x = sb ? (t > 6 ? 1.2 * (t - 6) ** 2 : 0) : (t > 3 ? 2 * (t - 3) ** 2 : 0);
  out.p = (out.p || new THREE.Vector3()).set(b.x + x, b.y + y, b.z);
  const vy = sb ? 3 * t + t * t / 4 : 4.4 * t + 0.6 * t * t, vx = sb ? (t > 6 ? 2.4 * (t - 6) : 0) : (t > 3 ? 4 * (t - 3) : 0);
  out.tilt = Math.atan2(vx, Math.max(0.01, vy)); return out;
}
const _pose = {};
function landInit(R) {
  const G = SKY.Game; W.ensureCity(city(R.dest)); ensureStatics();
  if (R.model && R.model.parent) R.model.parent.remove(R.model); if (R.booster && R.booster.parent) { R.booster.parent.remove(R.booster); R.booster = null; }
  R.model = shipModel(); G.scene.add(R.model); R.pad = padPos(R.dest, new THREE.Vector3()); R.pad.y += 2.7;
  const st = SS.statics[R.dest]; if (st) st.visible = false; if (R.dest === 'SBX' && SS.padB) SS.padB.visible = false;
  SKY.Player.pos.copy(R.pad);
  if (R.from === 'SBX' && !R.caught) { R.caught = true; boosterHome(); }
}
function boosterHome() { const st = SS.statics.SBX; if (st) { st.userData.booster.position.set(0, 8, 0); SS.caughtT = 25; } }
SS.update = (dt) => {
  ensureStatics();
  const G = SKY.Game, P = SKY.Player, R = SS.ride;
  // the static stack's booster stays in the chopsticks for a while after a catch, then is lowered back on the mount
  if (SS.caughtT > 0) { SS.caughtT -= dt; const st = SS.statics.SBX; if (st && SS.caughtT <= 0) st.userData.booster.position.set(0, 0, 0); }
  if (SS.padB) SS.padB.visible = SS.padBShip && !(R && R.dest === 'SBX' && R.phase === 'land');
  if (SS.ghost) ghostStep(dt);
  if (!R) return;
  if (P.mode !== 'ride' && R.phase !== 'exit') { cleanup(); return; } // fast travel / reset / death interrupted the ride
  R.t += dt; R.T += dt;
  const m = R.model, sb = R.from === 'SBX';
  if (R.phase === 'count') {
    const left = COUNT(R.from) - R.t; const sec = Math.ceil(left);
    if (sec !== R.lastSec) { R.lastSec = sec; if (sec > 0) SKY.Audio.play('beep'); }
    ovSet(left > 0 ? 'T-' + Math.max(0, sec) : 'LIFTOFF!', DEST[R.dest].icon + ' Starship to ' + DEST[R.dest].name + (left < 3 ? ' · engines igniting…' : ' · stand by'), false);
    const f = (sb ? m.userData.booster : m).userData.flame; f.visible = left < 2.5; f.scale.setScalar(0.3 + clamp(2.5 - left, 0, 2.5) * 0.25);
    if (left <= 0) { R.phase = 'ascent'; R.t = 0; SKY.Audio.play('boom'); G.shake(1.2); spawnSmoke(R.base); }
  } else if (R.phase === 'ascent') {
    const t = R.t; ascentPose(R, t, _pose);
    if (sb && t >= 14 && !R.sep) { // hot staging: the ship lights up and leaves the booster
      R.sep = { p: m.position.clone().add(new THREE.Vector3(0, 0, 0)), tilt: _pose.tilt };
      const b = R.booster = m.userData.booster; m.remove(b); G.scene.add(b); b.position.copy(m.position); b.rotation.z = -_pose.tilt;
      const s = m.userData.ship; s.position.y = 0; R.shipBase = 73.2; R.sepT = t;
      SKY.Audio.play('boom'); SKY.toast('🔥 Hot staging! Ship engines lit — the Super Heavy booster heads home…', 'good');
    }
    if (!R.sep) { m.position.copy(_pose.p); m.rotation.z = -_pose.tilt; const f = (sb ? m.userData.booster : m).userData.flame; f.visible = true; f.scale.setScalar(1 + Math.random() * 0.15); }
    else {
      // ship continues (offset up the stack), booster: boost-back flip then falls back to the tower
      const up = new THREE.Vector3(-Math.sin(-_pose.tilt) * 0, 1, 0); void up;
      m.position.copy(_pose.p).add(new THREE.Vector3(Math.sin(_pose.tilt) * (R.shipBase + (t - R.sepT) * 25), Math.cos(_pose.tilt) * (R.shipBase + (t - R.sepT) * 25), 0)); m.rotation.z = -_pose.tilt;
      const sf = m.userData.ship.userData.flame; sf.visible = true; sf.scale.setScalar(0.9 + Math.random() * 0.2);
      const b = R.booster, bt = t - R.sepT;
      if (t < 20) { b.position.copy(R.sep.p).add(new THREE.Vector3(-bt * 8, bt * 6, 0)); b.rotation.z = -R.sep.tilt + Math.min(Math.PI, bt * 1.1); b.userData.flame.visible = bt > 1.5; }
      else { // catch: drop from high above the tower into the chopsticks
        const M = mountPos(_w); const f = clamp((t - 20) / 6, 0, 1); const e = 1 - (1 - f) * (1 - f);
        b.position.set(M.x, M.y + 8 + (1 - e) * 650, M.z); b.rotation.z = 0; b.userData.flame.visible = f < 0.97; b.userData.flame.scale.setScalar(0.6);
        if (f >= 1 && !R.caught) { R.caught = true; SKY.Audio.play('ding'); G.shake(0.4); SKY.toast('🥢 CAUGHT! Mechazilla\'s chopsticks grabbed the booster out of the air!', 'good'); G.achieve('catch'); }
      }
    }
    ovSet(sb && t > 20 ? '🥢 Booster catch' : sb && t > 14 ? 'Hot staging' : 'T+' + Math.floor(t) + ' s', 'Altitude ' + Math.round((m.position.y) * 3.28) + ' ft · ' + DEST[R.dest].icon + ' ' + DEST[R.dest].short, sb ? t > 14 : t > 4);
    P.pos.copy(m.position);
    if (t > 3 && t < 8) G.shake(0.3);
    if (t >= ASC(R.from)) { if (R.booster && !R.caught) { R.caught = true; } if (sb) { if (R.booster && R.booster.parent) R.booster.parent.remove(R.booster); R.booster = null; boosterHome(); } R.phase = 'space'; R.t = 0; spaceInit(R); }
  } else if (R.phase === 'space') {
    ovSet('🌌 ' + (R.dest === 'SBX' ? 'Heading home to Earth' : 'Coasting to ' + DEST[R.dest].short), 'Days of travel, sped up for you ✨', true);
    if (R.t >= SPACE) { R.phase = 'land'; R.t = 0; landInit(R); }
  } else if (R.phase === 'land') {
    const t = R.t, f = clamp(t / LAND, 0, 1), pad = R.pad; const moon = R.dest === 'MOON';
    const h = 1400 * (1 - ease(Math.min(1, f * 1.04))) ** 1.3; m.position.set(pad.x + (1 - f) * 220, pad.y + h, pad.z);
    const flip = moon ? 0 : clamp((0.7 - f) / 0.14, 0, 1); // belly-flop (horizontal) then flip upright for the landing burn
    m.rotation.set(0, 0, flip * Math.PI / 2 * 0.98);
    const burn = moon ? f > 0.15 : f > 0.62; m.userData.flame.visible = burn && f < 0.995; m.userData.flame.scale.setScalar(0.7 + Math.random() * 0.2);
    ovSet(f < 0.6 && !moon ? '🪂 Belly flop' : f < 0.99 ? '🔥 Landing burn' : '✅ Touchdown!', DEST[R.dest].icon + ' ' + DEST[R.dest].name + ' · ' + Math.round(h * 3.28) + ' ft', false);
    P.pos.copy(m.position);
    if (f >= 1) { R.phase = 'exit'; R.t = 0; SKY.Audio.play('ding'); }
  } else if (R.phase === 'exit') {
    if (R.t > 0.8) arrive(R);
  }
};
function arrive(R) {
  const G = SKY.Game, P = SKY.Player, d = R.dest; const pad = R.pad;
  if (d === 'SBX') SS.padBShip = true;
  cleanup();
  const st = SS.statics[d]; if (st) st.visible = true; if (d === 'SBX' && SS.padB) SS.padB.visible = true;
  const s = R.seat || 0; const x = pad.x + 15 + s * 2.6, z = pad.z + 13 + s * 1.2;
  const gy = W.heightAt(x, z) + (W.solidAt(x, 0.5, z) ? 1.05 : 0.05); if (SKY.Places) SKY.Places.putPlayer(x, gy, z, Math.atan2(x - pad.x, z - pad.z));
  G.camInit = false; if (G.stats) G.stats.cities.add(d);
  if (d === 'MOON') { G.achieve('moonwalk'); SKY.toast('🌕 Welcome to Moon Base Artemis! Gravity is 1/6 — try jumping! Domes, a rover and the Artemis Habitat to explore. Ride back at the pad.', 'good'); }
  else if (d === 'MARS') { G.achieve('martian'); SKY.toast('🔴 Welcome to Mars Base Alpha! 38% gravity — big bouncy jumps. Rovers, the greenhouse lab, and a Starship home at the pad.', 'good'); }
  else SKY.toast('🌍 Welcome home to Starbase! Your plane is still parked at BRO.', 'good');
}
SS.arriveNow = (dest, seat) => { // test / net helper: skip straight to standing next to the ship at a base
  const R = { dest, seat: seat || 0, pad: padPos(dest, new THREE.Vector3()) }; R.pad.y += 2.7; W.ensureCity(city(dest)); ensureStatics(); SKY.Player.mode = 'foot'; arrive(R);
};
// smoke puffs at liftoff
const puffs = [];
function spawnSmoke(p) {
  const G = SKY.Game, M = mats(); const geo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const s = new THREE.Mesh(geo, M.smoke); s.position.set(p.x + Math.cos(a) * 12, 4, p.z + Math.sin(a) * 12); s.userData = { v: new THREE.Vector3(Math.cos(a) * 14, 2 + Math.random() * 3, Math.sin(a) * 14), t: 0 }; s.scale.setScalar(6); G.scene.add(s); puffs.push(s); }
}
function smokeStep(dt) { for (let i = puffs.length - 1; i >= 0; i--) { const s = puffs[i], u = s.userData; u.t += dt; s.position.addScaledVector(u.v, dt); u.v.multiplyScalar(1 - dt * 0.4); s.scale.setScalar(6 + u.t * 5); if (u.t > 9) { s.parent && s.parent.remove(s); puffs.splice(i, 1); } } }
// friends watching a launch they did not board: the static stack flies the same ascent (no camera takeover)
SS.watch = (from, dest) => {
  const st = SS.statics[from]; if (!st || SS.ghost || (SS.ride && SS.ride.from === from)) return;
  const m = from === 'SBX' ? stackModel() : shipModel(); m.position.copy(st.position); m.rotation.copy(st.rotation); SKY.Game.scene.add(m); st.visible = false;
  SS.ghost = { from, dest, t: -COUNT(from), model: m, base: st.position.clone() };
};
function ghostStep(dt) {
  const g = SS.ghost; g.t += dt; const sb = g.from === 'SBX';
  if (g.t < 0) { const f = (sb ? g.model.userData.booster : g.model).userData.flame; f.visible = g.t > -2.5; return; }
  ascentPose(g, Math.min(g.t, 14), _pose); g.model.position.copy(_pose.p); g.model.rotation.z = -_pose.tilt; (sb ? g.model.userData.booster : g.model).userData.flame.visible = true;
  if (g.t > (sb ? 14 : 9) + 6) { g.model.parent && g.model.parent.remove(g.model); SS.ghost = null; const st = SS.statics[g.from]; if (st) st.visible = true; if (sb) boosterHome(); }
}
// ---------------------------------------------------------------- camera
SS.camera = (cam, dt) => {
  const R = SS.ride; smokeStep(dt); if (!R || R.phase === 'space' || R.phase === 'exit') return false;
  const m = R.model, sb = R.from === 'SBX';
  if (R.phase === 'count') { const b = R.base; const a = R.t * 0.05; cam.position.set(b.x + 95 * Math.cos(a), b.y + 6, b.z + 120 + 10 * Math.sin(a)); cam.up.set(0, 1, 0); cam.lookAt(b.x, b.y + (sb ? 62 : 25), b.z); }
  else if (R.phase === 'ascent') {
    if (sb && R.t > 20) { const M = mountPos(_w); cam.position.set(M.x + 75, 45, M.z + 120); cam.up.set(0, 1, 0); cam.lookAt(M.x, 80, M.z); }
    else { const tgt = _v.copy(m.position); tgt.y += sb && !R.sep ? 70 : 25; const d = R.t < 6 ? 110 : 150 + R.t * 6; cam.position.set(tgt.x + d * 0.35, Math.max(8, tgt.y - d * 0.25), tgt.z + d); cam.up.set(0, 1, 0); cam.lookAt(tgt); }
  } else if (R.phase === 'land') { const tgt = _v.copy(m.position); tgt.y += 18; cam.position.set(tgt.x - 40, Math.max(tgt.y - 10, 6), tgt.z + 150); cam.up.set(0, 1, 0); cam.lookAt(tgt); }
  if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
  return true;
};
// ---------------------------------------------------------------- space scene (its own little solar system)
let SP = null;
function planetTex(kind) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
  const blob = (col, n, r0, r1) => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(Math.random() * 256, 14 + Math.random() * 100, r0 + Math.random() * r1, (r0 + Math.random() * r1) * 0.6, 0, 0, 6.3); g.fill(); } };
  if (kind === 'earth') { g.fillStyle = '#2f74b5'; g.fillRect(0, 0, 256, 128); blob('#4f9a3c', 14, 8, 22); blob('#c9b27a', 6, 4, 10); blob('rgba(255,255,255,0.75)', 26, 4, 14); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 7); g.fillRect(0, 121, 256, 7); }
  else if (kind === 'moon') { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 128); blob('#7a7a7a', 30, 2, 9); blob('#b5b5b5', 20, 1, 5); }
  else { g.fillStyle = '#c1440e'; g.fillRect(0, 0, 256, 128); blob('#8a3a1e', 20, 4, 16); blob('#e07a4a', 14, 3, 10); g.fillStyle = '#f2e6dc'; g.fillRect(0, 0, 256, 5); }
  const t = new THREE.CanvasTexture(cv); return t;
}
function spaceBuild() {
  if (SP) return SP;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x02030a);
  const pts = []; for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(9000); pts.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
  sc.add(new THREE.AmbientLight(0xffffff, 0.35)); const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(1, 0.4, 0.6); sc.add(sun);
  const body = (kind, r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), new THREE.MeshLambertMaterial({ map: planetTex(kind) })); m.position.set(x, y, z); sc.add(m); return m; };
  const B = { SBX: body('earth', 600, 0, 0, 0), MOON: body('moon', 165, 2300, 260, -1500), MARS: body('mars', 330, -2800, -150, -4600) };
  const ship = shipModel(); ship.scale.setScalar(1.2); sc.add(ship);
  const cam = new THREE.PerspectiveCamera(60, 1, 1, 20000);
  SP = { sc, B, ship, cam }; return SP;
}
function spaceInit(R) { const S = spaceBuild(); R.sp = { a: S.B[R.from].position, ra: S.B[R.from].geometry.parameters.radius, b: S.B[R.dest].position, rb: S.B[R.dest].geometry.parameters.radius }; }
SS.render = (renderer) => {
  const R = SS.ride; if (!R || R.phase !== 'space') return false;
  const S = spaceBuild(), G = SKY.Game; const f = clamp(R.t / SPACE, 0, 1), sp = R.sp;
  const dir = _v.subVectors(sp.b, sp.a).normalize(); const A = _w.copy(sp.a).addScaledVector(dir, sp.ra + 12);
  const Bp = new THREE.Vector3().copy(sp.b).addScaledVector(dir, -(sp.rb + 12));
  const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize(); const L = A.distanceTo(Bp);
  const ctrl = new THREE.Vector3().addVectors(A, Bp).multiplyScalar(0.5).addScaledVector(side, L * 0.12).add(new THREE.Vector3(0, L * 0.08, 0));
  const e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f); const u = 1 - e;
  const pos = new THREE.Vector3().copy(A).multiplyScalar(u * u).addScaledVector(ctrl, 2 * u * e).addScaledVector(Bp, e * e);
  const e2 = Math.min(1, e + 0.01), u2 = 1 - e2; const nxt = new THREE.Vector3().copy(A).multiplyScalar(u2 * u2).addScaledVector(ctrl, 2 * u2 * e2).addScaledVector(Bp, e2 * e2);
  const fwd = nxt.sub(pos).normalize(); if (fwd.lengthSq() < 0.5) fwd.copy(dir);
  S.ship.position.copy(pos); _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd); S.ship.quaternion.copy(_q);
  S.ship.userData.flame.visible = f < 0.12 || f > 0.9; S.ship.userData.flame.scale.setScalar(1.2);
  const back = 70 + Math.sin(f * Math.PI) * 140; S.cam.position.copy(pos).addScaledVector(fwd, -back).addScaledVector(side, back * 0.35).add(new THREE.Vector3(0, back * 0.3, 0));
  S.cam.up.set(0, 1, 0); S.cam.lookAt(f > 0.8 ? new THREE.Vector3().copy(pos).lerp(sp.b, (f - 0.8) * 2.5) : pos);
  S.cam.aspect = G.camera.aspect; S.cam.updateProjectionMatrix();
  for (const k in S.B) S.B[k].rotation.y += 0.0015;
  renderer.render(S.sc, S.cam); return true;
};
// ---------------------------------------------------------------- sky + gravity of the space zones
SS.sky = (G) => {
  const sp = W.spaceAt(G.camPos.x, G.camPos.z); const bg = G.scene.background;
  if (!sp) { if (SS.earthSky) SS.earthSky.visible = false; return false; }
  if (sp.id === 'MOON') bg.setRGB(0.02, 0.025, 0.05); else bg.setRGB(0.85, 0.66, 0.5);
  G.scene.fog.color.copy(bg);
  if (!SS.earthSky) { const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 20), new THREE.MeshBasicMaterial({ map: planetTex('earth'), fog: false })); const c = city('MOON'); m.position.set(c.x + 7000, 5200, c.z - 12000); G.scene.add(m); SS.earthSky = m;
    const pts = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(15000); pts.push(c.x + v.x, v.y, c.z + v.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false })); G.scene.add(st); SS.stars = st; }
  SS.earthSky.visible = sp.id === 'MOON'; SS.stars.visible = sp.id === 'MOON';
  return true;
};
SS.gravScale = (x, z) => { const sp = x > 100000 ? W.spaceAt(x, z) : null; return sp ? sp.grav : 1; };
SS.hudMode = () => { const R = SS.ride; return R ? '🚀 STARSHIP → ' + DEST[R.dest].short.toUpperCase() : null; };
})();

'use strict';
// GROK SKY 3.5 - AUTO LAND: when the player flies near any runway end (in range and inside the approach cone) an AUTO LAND
// button (phones) / [L] prompt (desktop) appears. Engaging flies a guided approach: intercept the extended centreline,
// follow a 3° glide path, flare, touch down, brake to a stop on the runway. Any flight input cancels it.
(() => {
const { clamp } = SKY;
const hyp = Math.hypot;
const GS = Math.tan(3 * Math.PI / 180);
const AL = SKY.AutoLand = { active: null, offer: null, why: '', t: 0 };
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _d = new THREE.Vector3();
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// every runway end of every airport. dir = -1: landing toward -z (north-bound, the 's' number); +1: toward +z
function ends() {
  const out = [];
  for (const apt of (SKY.Airport ? SKY.Airport.list : [])) for (const r of apt.rwys) {
    out.push({ apt, r, name: r.s, dir: -1, x: r.x, thrZ: apt.az + apt.len / 2, endZ: apt.az - apt.len / 2, hdg: 0 });
    out.push({ apt, r, name: r.n, dir: 1, x: r.x, thrZ: apt.az - apt.len / 2, endZ: apt.az + apt.len / 2, hdg: Math.PI });
  }
  return out;
}
// along-track distance before the threshold (s>0 = on approach) and signed lateral offset
function geo(e, p) { return { s: (p.z - e.thrZ) * -e.dir, lat: p.x - e.x }; }
AL.label = (e) => e.apt.code + ' ' + e.name;
// best runway end the plane could auto-land on right now (or null + reason)
AL.evaluate = () => {
  const G = SKY.Game, pl = G.plane, P = SKY.Player;
  AL.why = '';
  if (!(P.mode === 'pilot' && P.frame === 'plane') || pl.crashed || pl.onGround || (SKY.Airport && SKY.Airport.dock)) return null;
  if (pl.gearBroken) { AL.why = 'gear damaged'; return null; }
  const agl = pl.altitude(), spd = pl.speed();
  const f = pl.axes().f; const hdg = Math.atan2(f.x, -f.z);
  const vh = hyp(pl.vel.x, pl.vel.z), trk = vh > 5 ? Math.atan2(pl.vel.x, -pl.vel.z) : hdg;
  let best = null, bestScore = 1e9, near = null;
  for (const e of ends()) {
    const { s, lat } = geo(e, pl.pos);
    if (s < 350 || s > 14000) continue;
    near = near || e;
    const cone = Math.max(350, s * 0.36);           // ~20° funnel, at least 350 m wide near the runway
    if (Math.abs(lat) > cone) continue;
    const herr = Math.abs(wrap(trk - e.hdg));
    if (herr > 1.15) continue;                       // within ~65° of the runway heading
    const minS = 1400 + Math.max(0, spd - 80) * 22;  // room to slow down
    if (s < minS) { AL.why = 'too fast / too close for ' + AL.label(e); continue; }
    const gsH = (s + 150) * GS; const maxDrop = 12 * s / Math.max(spd, 70) * 0.85;
    if (agl - gsH > maxDrop) { AL.why = 'too high for ' + AL.label(e) + ' — descend'; continue; }
    if (agl > 2200) { AL.why = 'too high'; continue; }
    const score = s * 0.0005 + Math.abs(lat) / cone + herr;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (!best && !AL.why && near) AL.why = 'line up with ' + AL.label(near);
  return best;
};
AL.engage = (e) => {
  const G = SKY.Game, pl = G.plane; e = e || AL.offer || AL.evaluate(); if (!e) { SKY.toast('🛬 Auto-land unavailable' + (AL.why ? ' — ' + AL.why : ': fly toward a runway, roughly lined up'), 'warn'); SKY.Audio.play('error'); return false; }
  pl.ap.on = false; if (SKY.Airport) SKY.Airport.taxi = null;
  AL.active = { e, phase: 'approach', t: 0, label: AL.label(e) };
  pl.gearDown = true; pl.flaps = 2;
  SKY.toast('🤖 Auto-landing: ' + AL.label(e) + ' — gear down, flaps 2. Any flight input takes back control.', 'good'); SKY.Audio.play('chime');
  return true;
};
AL.cancel = (why) => { if (!AL.active) return; const lbl = AL.active.label; AL.active = null; if (why !== 'silent') { SKY.toast('🛬 Auto-land cancelled' + (why ? ' (' + why + ')' : '') + ' — you have the controls (' + lbl + ')', 'warn'); SKY.Audio.play('beep'); } };
AL.reset = () => { AL.active = null; AL.offer = null; AL.t = 0; };
// called from Player.updatePilot with the raw input: any real flight input cancels the auto-land
AL.checkInput = (I) => {
  if (!AL.active) return;
  const moved = Math.abs(I.move.x) > 0.25 || Math.abs(I.move.y) > 0.25;
  const other = I.hold('yawL') || I.hold('yawR') || I.hold('thrUp') || I.hold('thrDown') || I.hold('brake') || I.throttleAbs !== null || I.edge('gear') || I.edge('flaps') || I.edge('ap');
  if (moved || other) AL.cancel('flight input');
};
// control output for this step (throttle / brakes set directly). The guidance itself is applied in post() after physics.
AL.control = (dt) => {
  const G = SKY.Game, pl = G.plane, A = AL.active; const out = { pitch: 0, roll: 0, yaw: 0 };
  if (!A) return out;
  A.t += dt;
  const e = A.e, { s, lat } = geo(e, pl.pos); const spd = pl.speed(), agl = pl.altitude();
  if (pl.crashed || pl.gearBroken) { AL.cancel('aborted'); return out; }
  if (A.phase === 'rollout' || pl.onGround) {
    if (A.phase !== 'rollout') { A.phase = 'rollout'; A.tdS = s; SKY.Audio.play('crunch', 0.3); }
    pl.throttle = 0; pl.brake = true;
    // heading / centreline are held in post()
    if (spd < 0.8) { const lbl = A.label; AL.active = null; SKY.toast('✅ Auto-land complete: stopped on runway ' + lbl + '.', 'good'); SKY.Audio.play('ok'); G.achieve('autoland'); if (SKY.TaxiGate) SKY.TaxiGate.offerAfterLanding(); }
    return out;
  }
  const tgtV = s > 2500 ? 74 : 68;
  if (agl < 6) { A.phase = 'flare'; pl.throttle = 0; }
  else { if (agl < 14) A.phase = 'flare'; pl.throttle = clamp(0.32 + (tgtV - spd) * 0.04, 0, 0.9); }
  pl.brake = false; pl.gearDown = true; if (pl.flaps < 2) pl.flaps = 2;
  return out;
};
// guidance after the physics step: blend velocity + attitude toward the approach path (smooth, acceleration-limited)
AL.post = (dt) => {
  const G = SKY.Game, pl = G.plane, A = AL.active; if (!A) return;
  const e = A.e, { s, lat } = geo(e, pl.pos); const agl = pl.altitude(); const spd = pl.speed();
  const fwdX = 0, fwdZ = e.dir; // runway direction (unit)
  if (A.phase === 'rollout') {
    // keep the roll-out on the centreline and the nose on the runway heading
    const f = pl.axes().f; const hdg = Math.atan2(f.x, -f.z); const err = wrap(e.hdg - hdg);
    const yawFix = clamp(err, -0.6 * dt, 0.6 * dt);
    _q.setFromAxisAngle(_v.set(0, 1, 0), -yawFix); pl.quat.premultiply(_q).normalize();
    const vlat = clamp(-lat * 0.3, -3, 3); pl.vel.x += (vlat - pl.vel.x) * Math.min(1, 2 * dt);
    pl.w.y *= 0.5; return;
  }
  // desired ground speed along the approach
  const V = A.phase === 'flare' ? 64 : (s > 2500 ? 74 : 68);
  // lateral: converge on the centreline (intercept angle limited to ~35°)
  const vlat = clamp(-lat * (s > 3000 ? 0.035 : 0.07), -V * 0.55, V * 0.55) * (s < 600 ? 1.4 : 1);
  const valong = Math.sqrt(Math.max(1, V * V - vlat * vlat));
  // vertical: 3° glide path to an aim point 150 m past the threshold, then flare
  let vy;
  if (A.phase === 'flare') vy = -(0.7 + Math.max(0, agl) * 0.12);
  else { const gsH = (s + 150) * GS; vy = clamp(-valong * GS + (gsH - agl) * 0.12, -12, 8); if (agl < 25 && s > 1500) vy = Math.max(vy, 1.5); }
  _d.set(vlat + fwdX * valong, vy, fwdZ * valong);
  // acceleration-limited blend
  const k = A.phase === 'flare' ? 4 : 1.4, amax = A.phase === 'flare' ? 9 : 6;
  const dv = _v.copy(_d).sub(pl.vel).multiplyScalar(1 - Math.exp(-k * dt));
  const lim = amax * dt; if (dv.length() > lim) dv.setLength(lim);
  if (A.phase === 'flare') { dv.y = (_d.y - pl.vel.y) * Math.min(1, 6 * dt); }
  pl.vel.add(dv);
  // attitude: nose along the flight path (+ a little alpha), bank into the lateral correction
  const vh = hyp(pl.vel.x, pl.vel.z) || 1; const trk = Math.atan2(pl.vel.x, -pl.vel.z);
  const gam = Math.atan2(pl.vel.y, vh);
  const pitch = A.phase === 'flare' ? 0.07 : clamp(gam + 0.04, -0.15, 0.2);
  const desTrk = Math.atan2(_d.x, -_d.z);
  const bank = A.phase === 'flare' ? 0 : clamp(wrap(desTrk - trk) * 2.2, -0.42, 0.42);
  _e.set(pitch, -trk, -bank); _q.setFromEuler(_e);
  pl.quat.slerp(_q, 1 - Math.exp(-(A.phase === 'flare' ? 5 : 3) * dt)).normalize();
  pl.w.multiplyScalar(0.4);
  pl.group.updateMatrixWorld(true);
};
// per step: offer detection (cheap) + input edge
AL.update = (dt, I) => {
  AL.t -= dt;
  if (AL.active) { AL.offer = null; return; }
  if (AL.t <= 0) { AL.t = 0.2; AL.offer = AL.evaluate(); }
  const P = SKY.Player;
  if (I.edge('autoland') && P.mode === 'pilot' && P.frame === 'plane') { AL.offer = AL.evaluate(); AL.engage(AL.offer); }
};
// HUD text for the banner / button
AL.hud = () => {
  const G = SKY.Game, pl = G.plane, A = AL.active;
  if (A) { const { s } = geo(A.e, pl.pos); const ph = { approach: s > 0 ? 'on approach ' + (s / 1000).toFixed(1) + ' km' : 'over the runway', flare: 'FLARE', rollout: 'braking ' + Math.round(pl.speed() * 1.944) + ' kts' }[A.phase]; return { mode: 'active', text: '🤖 Auto-landing: ' + A.label + ' · ' + ph + ' · ' + Math.round(pl.speed() * 1.944) + ' kts' }; }
  if (AL.offer) return { mode: 'offer', text: '🛬 AUTO LAND · ' + AL.label(AL.offer) };
  return null;
};
})();

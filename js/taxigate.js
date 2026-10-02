'use strict';
// GROK SKY 3.5.1 - TAXI TO GATE assist: on the ground at an airport, slow or stopped (e.g. right after an auto-land), a
// TAXI TO GATE button (phones) / [G] key (desktop) appears. Engaging plans a route over the airport's taxi network
// (runway -> connector -> taxiway A -> apron entry -> gate lane -> gate) to the nearest free gate and drives the plane
// along it at realistic taxi speeds (~23 kts on long straights, ~8 kts in turns, ~4 kts into the gate), holding for apron
// vehicles that cross its path. At the gate the existing docking system snaps it onto the stop bar, the jet bridge
// extends and the L1 door opens. A dashed green path with arrows is drawn on the ground. Any throttle / steering /
// brake input (or G / tapping the banner again) cancels it.
(() => {
const { clamp } = SKY;
const hyp = Math.hypot;
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const KTS = 1.944;
const V_MAX = 12, V_TWY = 9.5, V_TURN = 4.2, V_GATE = 2.0, ACC = 0.7, DEC = 0.75, BRAKE = 1.6, R_MIN = 12, LAT_MAX = 1.6;
const HALF_SPAN = 15.6, HALF_LEN = 16.4;
const OFFER_V = 10.5; // ~20 kts: "slow or stopped"
const TG = SKY.TaxiGate = { active: null, offer: null, why: '', t: 0, prompt: 0, done: null };

// ------------------------------------------------------------------ taxi network (built once per airport, pure data)
function graph(apt) {
  if (apt.tg) return apt.tg;
  const N = [], E = [], idx = {};
  const node = (x, z, tag) => { const k = Math.round(x * 2) + ',' + Math.round(z * 2); if (idx[k] != null) return idx[k]; N.push({ x, z, tag, adj: [] }); return (idx[k] = N.length - 1); };
  const link = (a, b, kind) => { if (a === b) return; const d = hyp(N[a].x - N[b].x, N[a].z - N[b].z); N[a].adj.push([b, d]); N[b].adj.push([a, d]); E.push([a, b, kind]); };
  const chain = (ids, kind) => { const s = [...new Set(ids)].sort((p, q) => N[p].z - N[q].z); for (let i = 0; i < s.length - 1; i++) link(s[i], s[i + 1], kind); };
  const { ax, az, len, side, twyX, laneX, L } = apt, def = apt.def;
  const conns = apt.conns, zEnd0 = az - len / 2 + 8, zEnd1 = az + len / 2 - 8;
  const zN = az - L / 2 - 40, zS = az + L / 2 + 40;
  // main runway centreline (+ its ends so a plane that rolled past the last exit still projects onto it)
  const R1 = conns.map((z) => node(ax, z, 'rwy')); chain(R1.concat([node(ax, zEnd0, 'rwy'), node(ax, zEnd1, 'rwy')]), 'rwy');
  // taxiway A (+ the two apron entry rows)
  const A = conns.map((z) => node(twyX, z, 'twyA')); const AN = node(twyX, zN, 'twyA'), AS = node(twyX, zS, 'twyA'); chain(A.concat([AN, AS]), 'twyA');
  conns.forEach((z, k) => link(R1[k], A[k], 'conn'));
  // parallel runway + taxiway B + crossing connectors
  if (def.parallel) {
    const rx2 = ax - side * 230, bx = ax - side * 115;
    const R2 = conns.map((z) => node(rx2, z, 'rwy2')); chain(R2.concat([node(rx2, zEnd0, 'rwy2'), node(rx2, zEnd1, 'rwy2')]), 'rwy2');
    const B = [0, 2, 4].map((k) => node(bx, conns[k], 'twyB')); chain(B, 'twyB');
    [0, 2, 4].forEach((k, j) => { link(R2[k], B[j], 'conn'); link(B[j], R1[k], 'conn'); });
  }
  // apron: entry rows -> gate lane -> one node per gate
  const LN = node(laneX, zN, 'lane'), LS = node(laneX, zS, 'lane');
  link(AN, LN, 'entry'); link(AS, LS, 'entry');
  const G = apt.gates.map((g) => node(laneX, g.gz, 'lane'));
  chain([LN, LS].concat(G), 'lane');
  apt.tg = { N, E, gateNode: G };
  return apt.tg;
}
function dijkstra(gr, src) {
  const n = gr.N.length, d = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  d[src] = 0;
  for (;;) { let u = -1; for (let i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i; if (u < 0) break; done[u] = true; for (const [v, w] of gr.N[u].adj) if (d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; } }
  return { d, prev };
}
const pathTo = (prev, t) => { const out = []; for (let u = t; u >= 0; u = prev[u]) out.unshift(u); return out; };
function projSeg(px, pz, a, b) { const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1; const t = clamp(((px - a.x) * dx + (pz - a.z) * dz) / l2, 0, 1); const x = a.x + dx * t, z = a.z + dz * t; return { t, x, z, d: hyp(px - x, pz - z) }; }
// gate final: lane node -> turn toward the terminal -> straight onto the stop bar
function gateTail(apt, g) { const s = apt.side; return [[g.stop.x - s * 14, g.gz], [g.stop.x - s * 4, g.gz], [g.stop.x, g.gz]]; }
const gateFree = (apt, g) => !g.ai && !(SKY.Airport.dock && SKY.Airport.dock.gate === g);
// best route from the plane's pose to a free gate: {gate, pts, len}
TG.plan = (apt, pos, hdg, wantGate) => {
  const gr = graph(apt); const fx = Math.sin(hdg), fz = -Math.cos(hdg);
  // nearest network edge
  let best = null; for (const [a, b, kind] of gr.E) { const pr = projSeg(pos.x, pos.z, gr.N[a], gr.N[b]); if (!best || pr.d < best.pr.d) best = { a, b, kind, pr }; }
  if (!best) return null;
  const gates = apt.gates.filter((g) => (wantGate ? g === wantGate : gateFree(apt, g)));
  let bestR = null;
  for (const n0 of [best.a, best.b]) {
    const nd = gr.N[n0]; const dx = nd.x - best.pr.x, dz = nd.z - best.pr.z, dl = hyp(dx, dz);
    const back = dl > 6 && (dx * fx + dz * fz) / dl < -0.3; // that end is behind us: needs a U-turn
    const dj = dijkstra(gr, n0);
    for (const g of gates) {
      const gi = apt.gates.indexOf(g), t = gr.gateNode[gi]; if (!(dj.d[t] < Infinity)) continue;
      const nodes = pathTo(dj.prev, t);
      if (!back && dl > 6 && nodes.length > 1) { const n1 = gr.N[nodes[1]]; const ex = n1.x - nd.x, ez = n1.z - nd.z, el = hyp(ex, ez) || 1; if ((ex * dx + ez * dz) / (el * dl) < -0.5) continue; } // would drive ahead only to reverse: the other end (with a U-turn) covers it
      const cost = hyp(pos.x - best.pr.x, pos.z - best.pr.z) + dl + dj.d[t] + (back ? 250 : 0);
      if (!bestR || cost < bestR.cost) bestR = { cost, gate: g, nodes, back };
    }
  }
  if (!bestR) return null;
  const pts = [[pos.x, pos.z]];
  const push = (x, z) => { const q = pts[pts.length - 1]; if (hyp(q[0] - x, q[1] - z) > 3) pts.push([x, z]); };
  if (bestR.back) { // teardrop U-turn: roll ahead a little, swing round toward the open side, come back onto the line
    const s = apt.side; const rx = -fz, rz = fx; const sgn = Math.sign(rx * s) || 1; // turn toward the terminal side
    const cx = pos.x + fx * 14 + rx * sgn * R_MIN * 1.15, cz = pos.z + fz * 14 + rz * sgn * R_MIN * 1.15;
    for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; const ox = -rx * sgn * Math.cos(a) + fx * Math.sin(a), oz = -rz * sgn * Math.cos(a) + fz * Math.sin(a); push(cx + ox * R_MIN * 1.15, cz + oz * R_MIN * 1.15); }
  }
  if (best.pr.d > 4 && !bestR.back) push(best.pr.x, best.pr.z);
  for (const n of bestR.nodes) push(gr.N[n].x, gr.N[n].z);
  for (const q of gateTail(apt, bestR.gate)) push(q[0], q[1]);
  // drop tiny zig-zags right at the start (projection point almost on the first node)
  let len = 0; for (let i = 0; i < pts.length - 1; i++) len += hyp(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return { gate: bestR.gate, pts, len, edge: best.kind };
};

// ------------------------------------------------------------------ availability
TG.airside = (apt, p) => {
  const u = (p.x - apt.ax) * apt.side; const back = apt.def.parallel ? 262 : 40;
  return u > -back && u < 300 - 3 && Math.abs(p.z - apt.az) < apt.len / 2 + 160;
};
TG.evaluate = () => {
  const G = SKY.Game, pl = G.plane, P = SKY.Player, A = SKY.Airport; TG.why = '';
  if (!A || !(P.mode === 'pilot' && P.frame === 'plane') || pl.crashed || !pl.onGround || A.dock || (SKY.AutoLand && SKY.AutoLand.active)) return null;
  if (pl.ap.on && (pl.ap.mode === 'takeoff' || (pl.ap.mode === 'taxi' && A.taxi))) return null;
  const apt = A.nearest(pl.pos.x, pl.pos.z, 1500); if (!apt || !apt.built || !TG.airside(apt, pl.pos)) return null;
  if (pl.gearBroken || !pl.gearDown) { TG.why = 'gear damaged'; return null; }
  if (pl.speed() > OFFER_V) { TG.why = 'slow down to taxi'; return null; }
  const g = apt.gates.find((q) => gateFree(apt, q)); if (!g) { TG.why = 'no free gate'; return null; }
  const r = TG.plan(apt, pl.pos, pl.heading() * Math.PI / 180); if (!r) { TG.why = 'no route'; return null; }
  return { apt, gate: r.gate, len: r.len };
};

// ------------------------------------------------------------------ engage / cancel
TG.engage = (o) => {
  const G = SKY.Game, pl = G.plane, A = SKY.Airport; o = o || TG.offer || TG.evaluate();
  if (!o) { SKY.toast('🚕 Taxi to gate unavailable' + (TG.why ? ' — ' + TG.why : ': stop on a runway or taxiway at an airport'), 'warn'); SKY.Audio.play('error'); return false; }
  const hdg = pl.heading() * Math.PI / 180; const r = TG.plan(o.apt, pl.pos, hdg);
  if (!r) { SKY.toast('🚕 No free gate at ' + o.apt.code, 'warn'); return false; }
  A.taxi = null; pl.ap.on = false; pl.ap.mode = 'hold'; pl.flaps = 0;
  TG.active = { apt: o.apt, gate: r.gate, pts: r.pts, len: r.len, cross: crossings(o.apt, r.pts), i: 0, v: Math.min(pl.speed(), V_TURN), t: 0, remain: r.len, hold: '', holdT: 0, stopT: 0, label: o.apt.code + ' Gate ' + r.gate.name };
  TG.offer = null; TG.prompt = 0; TG.done = null;
  SKY.toast('🚕 Taxiing to ' + TG.active.label + ' (' + Math.round(r.len) + ' m) — ' + (SKY.isTouch ? 'moving the stick or throttle' : 'any throttle / steering key') + ' takes back control', 'good'); SKY.Audio.play('chime');
  return true;
};
TG.cancel = (why) => {
  const A0 = TG.active; if (!A0) return; TG.active = null; const pl = SKY.Game.plane; pl.throttle = 0;
  hidePath();
  if (why !== 'silent') { SKY.toast('🚕 Taxi to gate cancelled' + (why ? ' (' + why + ')' : '') + ' — you have the controls', 'warn'); SKY.Audio.play('beep'); }
};
TG.reset = () => { TG.active = null; TG.offer = null; TG.prompt = 0; TG.done = null; TG.t = 0; hidePath(); };
// auto-land just stopped on the runway: offer the assist with a prompt
TG.offerAfterLanding = () => { TG.t = 0; TG.offer = TG.evaluate(); TG.prompt = 12; if (TG.offer) SKY.toast('🚕 ' + (SKY.isTouch ? 'Tap TAXI TO GATE' : 'Press [G] (TAXI TO GATE)') + ' and the plane taxis itself to a free gate', 'good'); };
// desktop G key while the button is up -> taxi (gear can't be raised on the ground anyway)
TG.wantsKey = () => !!(TG.active || TG.offer);
// called from Player.updatePilot with the raw input: any throttle / steering / brake input takes back control
TG.checkInput = (I) => {
  if (!TG.active) return;
  const moved = Math.abs(I.move.x) > 0.25 || Math.abs(I.move.y) > 0.25;
  const other = I.hold('yawL') || I.hold('yawR') || I.hold('thrUp') || I.hold('thrDown') || I.hold('brake') || I.throttleAbs !== null || I.edge('ap');
  if (moved || other) { TG.cancel(moved ? 'steering input' : I.throttleAbs !== null || I.hold('thrUp') || I.hold('thrDown') ? 'throttle input' : 'pilot input'); I.edges.ap = false; }
};
TG.update = (dt, I) => {
  TG.t -= dt; if (TG.prompt > 0) TG.prompt -= dt; if (TG.done) { TG.done.t -= dt; if (TG.done.t <= 0) TG.done = null; }
  const P = SKY.Player;
  if (I.edge('taxigate') && P.mode === 'pilot' && P.frame === 'plane') { if (TG.active) TG.cancel('stopped by pilot'); else { TG.offer = TG.evaluate(); TG.engage(TG.offer); } return; }
  if (TG.active) { TG.offer = null; return; }
  if (TG.t <= 0) { TG.t = 0.2; TG.offer = TG.evaluate(); }
};

// ------------------------------------------------------------------ guidance
// Apron vehicles. Ambient baggage trains / fuel trucks drive fixed service loops that cross the gate legs: the route
// stores every point where it crosses a loop. Before the plane's nose reaches a crossing it holds while any vehicle is
// within CROSS_R of it; while the plane is over a crossing, vehicles approaching it wait instead. The plane only ever
// waits before a crossing and vehicles only wait while the plane is on one, so the two rules can never deadlock.
// Real cars (SKY.Cars) anywhere in the corridor ahead also make the plane hold.
const CROSS_R = 27, CROSS_STOP = 24;
function segX(a, b, c, d) { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-6) return null; const qp = [c[0] - a[0], c[1] - a[1]]; const t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null; }
function crossings(apt, pts) {
  const out = []; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = hyp(b[0] - a[0], b[1] - a[1]);
    for (const loop of apt.service || []) for (let k = 0; k < loop.length; k++) { const c = loop[k], d = loop[(k + 1) % loop.length]; const t = segX(a, b, c, d); if (t != null) out.push({ s: acc + t * l, x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, on: false }); }
    acc += l;
  }
  return out;
}
function cars(apt) { const out = []; if (SKY.Cars) for (const c of SKY.Cars.list) if (c !== SKY.Cars.cur && Math.abs(c.pos.x - apt.ax) < 700 && Math.abs(c.pos.z - apt.az) < apt.len) out.push([c.pos.x, c.pos.z]); return out; }
function frame(pl) { const h = pl.heading() * Math.PI / 180; return { h, fx: Math.sin(h), fz: -Math.cos(h) }; }
function rel(pl, x, z) { const { fx, fz } = frame(pl); const dx = x - pl.pos.x, dz = z - pl.pos.z; return [dx * fx + dz * fz, dx * -fz + dz * fx]; }
// returns what the plane must hold for (or null); also marks the crossings the plane is currently over
TG.blockedAhead = (pl, look) => {
  const T = TG.active; if (!T) return null; const sCur = T.len - T.remain; let blk = null;
  const boxes = SKY.Ambient && SKY.Ambient.apronVehicles ? SKY.Ambient.apronVehicles(T.apt.c, [], true) : []; // (vehicles already waiting for us are parked well clear)
  for (const c of T.cross) {
    const ds = c.s - sCur; c.on = Math.abs(ds) <= HALF_LEN + 4;
    if (!blk && ds > HALF_LEN + 4 && ds < HALF_LEN + 4 + look) for (const q of boxes) if (hyp(q[0] - c.x, q[1] - c.z) < CROSS_R) { blk = q; break; }
  }
  if (!blk) for (const q of cars(T.apt)) { const r = rel(pl, q[0], q[1]); if (r[0] > 8 && r[0] < HALF_LEN + look && Math.abs(r[1]) < HALF_SPAN + 2) { blk = q; break; } }
  return blk;
};
// called by ambient.js for each baggage train / truck: boxes = [[x,z],...] at its next position, lead first
TG.vehicleYield = (boxes) => {
  const T = TG.active; if (!T || !T.cross) return false;
  for (const c of T.cross) if (c.on && hyp(boxes[0][0] - c.x, boxes[0][1] - c.z) < CROSS_STOP) return true;
  return false;
};
TG.control = () => { const pl = SKY.Game.plane; pl.throttle = TG.active ? 0.05 : 0; pl.brake = false; return { pitch: 0, roll: 0, yaw: 0 }; };
const _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);
// after the physics step: steer (pure pursuit, rate-limited) + set the ground speed along the nose
TG.post = (dt) => {
  const G = SKY.Game, pl = G.plane, A = SKY.Airport, T = TG.active; if (!T) return;
  T.t += dt;
  if (pl.crashed || pl.gearBroken) { TG.cancel('aborted'); return; }
  if (A.dock && A.dock.gate) { finish(A.dock.gate); return; }
  if (!pl.onGround && pl.altitude() > 3) { TG.cancel('airborne?'); return; }
  const p = pl.pos, pts = T.pts, n = pts.length;
  // advance along the polyline
  for (;;) { if (T.i >= n - 2) break; const a = pts[T.i], b = pts[T.i + 1]; const pr = projSeg(p.x, p.z, { x: a[0], z: a[1] }, { x: b[0], z: b[1] }); if (pr.t >= 0.999 || hyp(b[0] - p.x, b[1] - p.z) < 4) T.i++; else break; }
  const a = pts[T.i], b = pts[T.i + 1]; const pr = projSeg(p.x, p.z, { x: a[0], z: a[1] }, { x: b[0], z: b[1] });
  T.proj = [pr.x, pr.z];
  // remaining length + distance/angle of upcoming corners
  let remain = hyp(b[0] - pr.x, b[1] - pr.z); const corners = []; { let acc = remain; for (let k = T.i + 1; k < n - 1; k++) { const p0 = pts[k - 1], p1 = pts[k], p2 = pts[k + 1]; const th = Math.abs(wrap(Math.atan2(p2[0] - p1[0], -(p2[1] - p1[1])) - Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])))); corners.push([acc, th]); const l = hyp(p2[0] - p1[0], p2[1] - p1[1]); acc += l; remain += l; } }
  if (T.i >= n - 2) remain = hyp(pts[n - 1][0] - pr.x, pts[n - 1][1] - pr.z) * (pr.t >= 0.999 ? 0 : 1);
  T.remain = remain;
  // lookahead point
  const Ld = clamp(T.v * 1.5 + 5, 6, 20); let tx = pts[n - 1][0], tz = pts[n - 1][1];
  { let acc = 0, px = pr.x, pz = pr.z; for (let k = T.i + 1; k < n; k++) { const q = pts[k]; const d = hyp(q[0] - px, q[1] - pz); if (acc + d >= Ld) { const f = (Ld - acc) / d; tx = px + (q[0] - px) * f; tz = pz + (q[1] - pz) * f; break; } acc += d; px = q[0]; pz = q[1]; } }
  if (remain < Ld) { const e = pts[n - 1], e0 = pts[n - 2]; const l = hyp(e[0] - e0[0], e[1] - e0[1]) || 1; tx = e[0] + (e[0] - e0[0]) / l * (Ld - remain); tz = e[1] + (e[1] - e0[1]) / l * (Ld - remain); } // extend past the stop bar so the nose stays aligned
  const { h } = frame(pl); const want = Math.atan2(tx - p.x, -(tz - p.z)); const alpha = wrap(want - h);
  // target speed
  let vt = V_MAX;
  const leg = hyp(b[0] - a[0], b[1] - a[1]); if (leg < 300) vt = V_TWY;
  for (const [d, th] of corners) { if (d > 160) break; const vc = th > 1.1 ? V_TURN : th > 0.6 ? 5.5 : th > 0.25 ? 7.5 : V_MAX; vt = Math.min(vt, Math.sqrt(vc * vc + 2 * DEC * Math.max(0, d - 6))); }
  vt = Math.min(vt, Math.max(V_TURN * 0.6, V_MAX * (1 - Math.abs(alpha) / 1.0)));
  vt = Math.min(vt, Math.sqrt(0.09 + 2 * 0.5 * remain));        // smooth brake onto the stop bar
  if (remain < 40) vt = Math.min(vt, V_GATE + remain * 0.05);   // walking pace into the gate
  // hold for vehicles crossing ahead
  const blk = TG.blockedAhead(pl, T.v * T.v / (2 * BRAKE) + 18);
  if (blk) { vt = 0; T.hold = 'vehicle'; T.holdT += dt; } else { T.hold = ''; T.holdT = 0; }
  const stop = remain < 0.35 || (T.i >= n - 2 && pr.t >= 0.999);
  if (stop) vt = 0;
  T.v = vt > T.v ? Math.min(vt, T.v + ACC * dt) : Math.max(vt, T.v - (blk || stop ? BRAKE * 1.5 : BRAKE) * dt);
  // steering: pure-pursuit curvature, limited by min turn radius and lateral acceleration
  if (Math.abs(alpha) < Math.PI / 2) T.turnDir = 0; else if (!T.turnDir) T.turnDir = Math.sign(alpha) || 1; // commit to one direction for big turns
  let k = !T.turnDir ? 2 * Math.sin(alpha) / Ld : T.turnDir / R_MIN;
  const kMax = Math.min(1 / R_MIN, LAT_MAX / Math.max(1, T.v * T.v)); k = clamp(k, -kMax, kMax);
  const rate = T.v * k;
  _q.setFromAxisAngle(_Y, -rate * dt); pl.quat.premultiply(_q).normalize();
  const f = pl.axes().f; const fl = hyp(f.x, f.z) || 1;
  pl.vel.x = f.x / fl * T.v; pl.vel.z = f.z / fl * T.v; if (pl.vel.y > 0.5) pl.vel.y = 0.5;
  pl.w.y = 0; pl.w.x *= 0.5; pl.w.z *= 0.5;
  pl.group.updateMatrixWorld(true);
  if (stop && T.v < 0.05) { T.stopT += dt; pl.vel.x = 0; pl.vel.z = 0; pl.brake = true; if (T.stopT > 0.4 && !A.dock) A.dockAt(T.apt, T.gate, false); }
  // guidance for the minimap (dashed line) + the ground path
  A.guide = { apt: T.apt, route: { pts: [T.proj].concat(pts.slice(T.i + 1)), i: 0 }, txt: 'Taxiing to gate ' + T.gate.name };
  drawPath(T);
};
function finish(g) {
  const T = TG.active; TG.active = null; hidePath();
  TG.done = { t: 6, label: T ? T.label : g.name };
  SKY.toast('🅿 Taxi complete: parked at ' + (T ? T.label : 'gate ' + g.name) + ' — jet bridge connecting', 'good');
  SKY.Game.achieve && SKY.Game.ach && SKY.Game.achieve('taxigate');
}

// ------------------------------------------------------------------ dashed ground path + arrows (two instanced meshes)
let dash = null, chev = null; const MAXD = 160, MAXC = 50, _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Quaternion();
function ensureMeshes() {
  if (dash) return; const sc = SKY.Game.scene; const PO = { polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -24 }; // the ground decal layers use offsets up to -5/-10: stay on top of them
  const mat = new THREE.MeshBasicMaterial(Object.assign({ color: 0x57ff7a, transparent: true, opacity: 0.92, depthWrite: false }, PO));
  dash = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, MAXD); dash.frustumCulled = false; dash.count = 0; dash.renderOrder = 2; sc.add(dash);
  const cg = new THREE.BufferGeometry(); // flat chevron (arrow head pointing -z)
  const v = [0, 0, -2.2, -2.4, 0, 1.2, -1.4, 0, 1.2, 0, 0, -0.6, 0, 0, -2.2, -1.4, 0, 1.2, 0, 0, -2.2, 1.4, 0, 1.2, 2.4, 0, 1.2, 0, 0, -2.2, 0, 0, -0.6, 1.4, 0, 1.2];
  cg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); cg.computeVertexNormals();
  chev = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial(Object.assign({ color: 0xfff35a, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }, PO)), MAXC); chev.frustumCulled = false; chev.count = 0; chev.renderOrder = 3; sc.add(chev);
}
function hidePath() { if (dash) { dash.count = 0; chev.count = 0; } }
function drawPath(T) {
  ensureMeshes(); const W = SKY.World; const pts = [T.proj].concat(T.pts.slice(T.i + 1));
  let nd = 0, nc = 0; const step = 6, phase = (T.t * 6) % step; let carry = -phase + 18; // start a bit ahead of the nose
  for (let k = 0; k < pts.length - 1 && nd < MAXD; k++) {
    const a = pts[k], b = pts[k + 1]; const l = hyp(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue; const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l; const ang = Math.atan2(-ux, -uz);
    let s = Math.max(0, carry);
    for (; s < l && nd < MAXD; s += step) {
      const x = a[0] + ux * s, z = a[1] + uz * s, y = W.heightAt(x, z) + 0.2; _r.setFromAxisAngle(_Y, ang);
      const idx = Math.round((T.len - T.remain + s) / step);
      if (idx % 5 === 0 && nc < MAXC) { _p.set(x, y + 0.02, z); _s.set(1, 1, 1); _m.compose(_p, _r, _s); chev.setMatrixAt(nc++, _m); }
      else { _p.set(x, y, z); _s.set(0.7, 0.08, 3.2); _m.compose(_p, _r, _s); dash.setMatrixAt(nd++, _m); }
    }
    carry = s - l;
  }
  dash.count = nd; chev.count = nc; dash.instanceMatrix.needsUpdate = true; chev.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ HUD
TG.hud = () => {
  const pl = SKY.Game.plane, T = TG.active;
  if (T) { const kts = Math.round(pl.speed() * KTS); return { mode: 'active', title: '🚕 Taxiing to ' + T.label, sub: (T.hold ? '⏸ holding for a vehicle · ' : '') + (T.remain > 1000 ? (T.remain / 1000).toFixed(1) + ' km' : Math.round(T.remain) + ' m') + ' · ' + kts + ' kts', text: '🚕 Taxiing to ' + T.label + ' · ' + Math.round(T.remain) + ' m · ' + kts + ' kts' + (T.hold ? ' · holding for a vehicle' : '') }; }
  if (TG.done) return { mode: 'done', title: '🅿 Parked at ' + TG.done.label, sub: 'jet bridge connecting · L1 door opening', text: '🅿 Parked at ' + TG.done.label };
  if (TG.offer) { const o = TG.offer; return { mode: 'offer' + (TG.prompt > 0 ? ' prompt' : ''), title: '🚕 TAXI TO GATE ' + o.gate.name, sub: o.apt.code + ' · ' + Math.round(o.len) + ' m', text: '🚕 TAXI TO GATE ' + o.gate.name }; }
  return null;
};
})();

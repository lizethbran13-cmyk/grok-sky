'use strict';
// GROK SKY - functioning mini airports: runways + markings + lights, taxiways, apron, terminal with gates & jet bridges,
// tower, hangars, parked airliners, docking at gates, pushback, auto-taxi (pure pursuit), departures board, fast travel to gate
(() => {
const { clamp } = SKY;
const W = SKY.World, WB = SKY.WB;
const GW = 55, TD = 40;
const WHITE = 0xf2f2f2, YEL = 0xffd23d;
const LIVERY = { LAX: [67, 68], LAS: [63, 67], XTA: [67, 29], MEX: [64, 67], JFK: [68, 60], CDG: [60, 67], HND: [67, 29] };
const A = SKY.Airport = { dock: null, taxi: null, dep: null, landedAt: null, list: [] };
const hyp = Math.hypot, wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ============================================================ planning (data + ground decals)
A.plan = (P, c, d) => {
  const side = d.side, len = d.len || 2400, n = d.gates || 4, L = n * GW + 60;
  const ax = P.X(d.x), az = P.Z(d.z);
  c.ax = ax; c.az = az; c.rwyLen = len; c.rwyW = 50;
  const XF = ax + side * 300, lv = side > 0 ? -1 : 1; // lv: z-direction of the parked plane's left (door) side
  const apt = c.apt = { c, code: d.code, name: d.name, side, lv, ax, az, len, XF, L, twyX: ax + side * 110, laneX: XF - side * 70, gates: [], rwys: [], def: d, nh: d.hangars || 2, restricted: !!d.restricted };
  A.list.push(apt);
  const nums = d.nums || (d.parallel ? (side > 0 ? ['36R', '18L', '36L', '18R'] : ['36L', '18R', '36R', '18L']) : ['36', '18']);
  apt.rwys.push({ x: ax, s: nums[0], n: nums[1] }); if (d.parallel) apt.rwys.push({ x: ax - side * 230, s: nums[2], n: nums[3] });
  apt.zs = az + len / 2 - 60; apt.conns = [az + len / 2 - 60, az + len * 0.25, az, az - len * 0.25, az - len / 2 + 60];
  for (let i = 0; i < n; i++) { const gz = az + ((n - 1) / 2 - i) * GW; apt.gates.push({ i, name: 'A' + (i + 1), gz, stop: new THREE.Vector3(XF - side * 22.2, 0, gz), hdg: side > 0 ? Math.PI / 2 : -Math.PI / 2, ai: (d.ai || []).includes(i), bridge: null, ext: 0, target: 0, base: null }); }
  const zH = az - L / 2 - 110 - (apt.nh - 1) * 64 - 50; apt.apronZ = [Math.min(az - L / 2 - 70, zH), az + L / 2 + 70];
  const op = (Ly, o) => P.ops[Ly].push(o);
  const R = (Ly, x0, z0, x1, z1, col) => op(Ly, { rect: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], col });
  const desert = c.id === 'LAS' || c.id === 'A51';
  const xs = [ax - side * (d.parallel ? 300 : 80), XF + side * (TD + 125)];
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = az - len / 2 - 120, bz1 = az + len / 2 + 120;
  apt.bounds = [bx0, bz0, bx1, bz1];
  R(0, bx0, bz0, bx1, bz1, desert ? 0xc6ab7c : 0x86ad5e); P.reserves.push({ rect: [bx0, bz0 - 300, bx1, bz1] });
  // runways
  for (const r of apt.rwys) R(3, r.x - 25, az - len / 2, r.x + 25, az + len / 2, 0x3a3d42);
  // taxiway A + connectors; taxiway B between parallels
  R(3, apt.twyX - 11.5, az - len / 2 + 40, apt.twyX + 11.5, az + len / 2 - 40, 0x6c6f74);
  for (const zc of apt.conns) R(3, ax + side * 25, zc - 11.5, apt.twyX, zc + 11.5, 0x6c6f74);
  if (d.parallel) { const bx = ax - side * 115; R(3, bx - 11.5, az - len / 2 + 40, bx + 11.5, az + len / 2 - 40, 0x6c6f74); for (const zc of [apt.conns[0], apt.conns[2], apt.conns[4]]) R(3, ax - side * 230 + side * 25, zc - 11.5, ax - side * 25, zc + 11.5, 0x6c6f74); }
  // apron, terminal floor, landside
  R(1, ax + side * 121, apt.apronZ[0], XF, apt.apronZ[1], 0xa4a7ab);
  R(1, XF, az - L / 2, XF + side * TD, az + L / 2, 0xd8d4cc);
  const curbX = XF + side * (TD + 14);
  op(3, { line: [[curbX, az - L / 2 - 40], [curbX, az + L / 2 + 20]], w: 12, col: 0x505359 });
  R(1, XF + side * (TD + 24), az - L / 2, XF + side * (TD + 115), az + L / 2, 0x737679);
  for (let z = az - L / 2 + 8; z < az + L / 2; z += 16) for (let x = TD + 30; x < TD + 112; x += 5) R(4, XF + side * x, z, XF + side * (x + 0.3), z + 5, WHITE);
  if (d.link) { const lx = P.X(d.link[0]), lz = P.Z(d.link[1]); P.road([[curbX - c.x, az - L / 2 - 40 - c.z], [lx - c.x, az - L / 2 - 40 - c.z], [lx - c.x, lz - c.z]], 'blvd', { palms: c.id === 'LAX' || c.id === 'LAS' || c.id === 'LA' ? 30 : 0, trees: c.id === 'PAR' || c.id === 'TYO' ? 30 : 0 }); }
  else P.road([[curbX - c.x, az - L / 2 - 40 - c.z], [curbX - c.x + side * 200, az - L / 2 - 40 - c.z]], 'blvd');
  // ---- markings ----
  for (const r of apt.rwys) {
    const z0 = az - len / 2, z1 = az + len / 2, x = r.x;
    for (const s of [-1, 1]) R(4, x + s * 23, z0, x + s * 24, z1, WHITE);
    op(4, { dash: [[x, z1 - 160], [x, z0 + 160]], w: 0.9, col: WHITE, on: 30, off: 20 });
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const xa = x + s * (3 + k * 5); R(4, xa - 0.9, z1 - 51, xa + 0.9, z1 - 6, WHITE); R(4, xa - 0.9, z0 + 6, xa + 0.9, z0 + 51, WHITE); }
    const tw = (t) => (t.length * 4 - 1) * 3;
    op(4, { text: r.s, ox: x - tw(r.s) / 2, oz: z1 - 92, R: [1, 0], D: [0, 1], cw: 3, ch: 6, col: WHITE });
    op(4, { text: r.n, ox: x + tw(r.n) / 2, oz: z0 + 92, R: [-1, 0], D: [0, -1], cw: 3, ch: 6, col: WHITE });
    for (const s of [-1, 1]) { R(4, x + s * 6, z1 - 345, x + s * 15, z1 - 300, WHITE); R(4, x + s * 6, z0 + 300, x + s * 15, z0 + 345, WHITE); for (const dz of [150, 450, 600]) { R(4, x + s * 6, z1 - dz - 22, x + s * 8, z1 - dz, WHITE); R(4, x + s * 10, z1 - dz - 22, x + s * 12, z1 - dz, WHITE); R(4, x + s * 6, z0 + dz, x + s * 8, z0 + dz + 22, WHITE); R(4, x + s * 10, z0 + dz, x + s * 12, z0 + dz + 22, WHITE); } }
  }
  op(4, { line: [[apt.twyX, az - len / 2 + 40], [apt.twyX, az + len / 2 - 40]], w: 0.45, col: YEL });
  for (const zc of apt.conns) { op(4, { line: [[ax, zc], [apt.twyX, zc]], w: 0.45, col: YEL }); for (const q of [0, 1.2]) R(4, ax + side * (64 + q), zc - 11, ax + side * (64.4 + q), zc + 11, YEL); }
  op(4, { line: [[apt.laneX, apt.apronZ[0] + 10], [apt.laneX, apt.apronZ[1] - 10]], w: 0.45, col: YEL });
  op(4, { line: [[apt.twyX, az - L / 2 - 40], [apt.laneX, az - L / 2 - 40]], w: 0.45, col: YEL }); op(4, { line: [[apt.twyX, az + L / 2 + 40], [apt.laneX, az + L / 2 + 40]], w: 0.45, col: YEL });
  for (const g of apt.gates) {
    op(4, { line: [[apt.laneX, g.gz], [XF - side * 6, g.gz]], w: 0.45, col: YEL });
    R(4, XF - side * 6.4, g.gz - 4, XF - side * 5.6, g.gz + 4, YEL);
    for (const s of [-1, 1]) R(4, XF - side * 45, g.gz + s * 16, XF - side * 3, g.gz + s * 16.4, 0xd04040);
    const t = g.name, w = (t.length * 4 - 1) * 1.6;
    if (side > 0) op(4, { text: t, ox: XF - 50 - 8, oz: g.gz + w / 2 * 1 - w, R: [0, 1], D: [-1, 0], cw: 1.6, ch: 1.6, col: YEL });
    else op(4, { text: t, ox: XF + 50 + 8, oz: g.gz + w / 2, R: [0, -1], D: [1, 0], cw: 1.6, ch: 1.6, col: YEL });
  }
  // ---- structures (built lazily with the city) ----
  P.job(() => buildAirport(apt)); apt.gates.forEach((g, gi) => P.job(() => buildGate(apt, g, gi))); P.job(() => buildMisc(apt));
  // apron service loops for baggage carts / fuel truck (used by ambient.js)
  apt.service = [[[XF - side * 8, az - L / 2 + 10], [XF - side * 8, az + L / 2 - 10], [XF - side * 50, az + L / 2 - 10], [XF - side * 50, az - L / 2 + 10]], [[XF + side * 10, az + L / 2 + 95], [XF - side * 40, az + L / 2 + 60], [XF - side * 40, az - L / 2 + 30], [XF - side * 10, az - L / 2 + 30], [XF - side * 10, az + L / 2 + 40]]];
  P.label(XF + side * 80, az - L / 2 - 70, d.code);
};

A.planLights = (P, c) => {
  const apt = c.apt; if (!apt) return; const L = P.lights; const { az, len, side } = apt;
  const z0 = az - len / 2, z1 = az + len / 2;
  for (const r of apt.rwys) {
    for (let z = z0; z <= z1; z += 60) for (const s of [-1, 1]) L.push([r.x + s * 27, z, 0, 0xfff3c0]);
    for (let x = -24; x <= 24; x += 4) { L.push([r.x + x, z1 + 2, 0, 0x33ff66]); L.push([r.x + x, z0 - 2, 0, 0xff3333]); }
  }
  // approach lighting system south of the main runway + PAPI
  const x = apt.ax;
  for (let d = 30; d <= 330; d += 30) for (let q = -2; q <= 2; q++) L.push([x + q * 3, z1 + d, Math.min(6, d / 60), 0xffffff]);
  for (let d = 30; d <= 90; d += 30) for (const s of [-1, 1]) for (let q = 0; q < 3; q++) L.push([x + s * (10 + q * 2), z1 + d, 0.5, 0xff3333]);
  for (let k = 0; k < 4; k++) L.push([x - side * (40 + k * 9), z1 - 300, 0.6, k < 2 ? 0xffffff : 0xff2222]);
  // taxiway edge (blue)
  for (let z = z0 + 40; z <= z1 - 40; z += 50) for (const s of [-1, 1]) L.push([apt.twyX + s * 13, z, 0, 0x3d6bff]);
  // apron flood + gate lights
  for (const g of apt.gates) L.push([apt.XF - side * 2, g.gz + apt.lv * 7, 9, 0x57ff7a]);
};

// ============================================================ voxel structures
function buildAirport(apt) {
  const c = apt.c, { side, lv, XF, L, az, ax } = apt; const d = apt.def;
  const liv = LIVERY[apt.code] || [67, 68];
  // ---- terminal shell (s=4) with gate openings and landside doors; code letters on the roof ----
  const tcx = XF + side * TD / 2;
  const term = WB.shape(tcx, 0, az, TD, 16, L, 4, (px, y, pz, i, j, k) => {
    const u = side * px + TD / 2, zz = az + pz;
    if (y > 12) return (u < 4 || u > TD - 4 || Math.abs(pz) > L / 2 - 4) ? 56 : 21;
    const wallA = u < 4, wallL = u > TD - 4, wallE = Math.abs(pz) > L / 2 - 4;
    if (!wallA && !wallL && !wallE) return 0;
    if (wallA) { if (j === 0) for (const g of apt.gates) if (Math.abs(zz - (g.gz + lv * 7)) < 2.6) return 0; return j === 0 ? 46 : 22; }
    if (wallL) { if (j === 0 && Math.abs(((pz + L / 2) % 40) - 20) < 2.5) return 0; return j === 1 ? 22 : 21; }
    return (j === 1) ? 22 : 21;
  }, { name: apt.code + ' terminal', post: (g) => {
    const jR = g.ny - 1; const txt = apt.code; const tw = txt.length * 4 - 1; const k0 = Math.floor((g.nz - tw) / 2); const F = SKY.FONT;
    let p = 0; for (const ch of txt) { const f = F[ch] || F[' ']; for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) if (f[r * 3 + cc] === '1') { const i = side > 0 ? 7 - r : 2 + r; const k = side > 0 ? k0 + p + cc : g.nz - 1 - (k0 + p + cc); g.set(i, jR, k, 63); } p += 4; }
  } });
  term.anchorJ = 0;
  // exterior name sign on the landside roof edge
  SKY.signBoard(XF + side * (TD + 1), 16, az, [{ t: apt.code, m: 63, sc: 2 }, { t: apt.name }], 0.5, 70, 57, side > 0 ? 'e' : 'w');
  // ---- interior modules per gate (s=1): seats, desk, gate sign; departures board, cafe, check-in ----
}
function buildGate(apt, g, gi) {
  const c = apt.c, { side, lv, XF, L, az, ax } = apt; const d = apt.def;
  const liv = LIVERY[apt.code] || [67, 68];
    const x0 = XF + side * 4, x1 = XF + side * (TD - 4);
    WB.shape((x0 + x1) / 2, 0, g.gz, TD - 8, 12, GW - 1, 1, (px, y, pz) => {
      const u = side * px + (TD - 8) / 2 + 4, w = (pz) * lv; // u from facade, w toward corridor side
      const ui = Math.floor(u), wi = Math.floor(w), yi = Math.floor(y);
      for (const ru of [13, 17, 21]) { if ((wi >= -22 && wi <= 1) || (wi >= 12 && wi <= 22)) { if (ui === ru && yi === 0) return 60; if (ui === ru + 1 && yi <= 1) return 60; } }
      if (ui >= 6 && ui <= 7 && wi >= 12 && wi <= 15 && yi === 0) return yi === 0 ? 21 : 0;
      if (ui === 4 && yi >= 5 && yi <= 10 && wi >= 1 && wi <= 13) return 70;
      if (gi === Math.floor(apt.gates.length / 2) && ui === TD - 5 && yi >= 2 && yi <= 7 && wi >= -14 && wi <= 2) return (yi > 2 && yi < 7 && wi > -14 && wi < 2) ? ((wi + yi * 3) % 4 === 0 ? 63 : (wi % 3 === 0 ? 57 : 70)) : 70;
      if (gi === 0 && ui >= 24 && ui <= 25 && wi >= -20 && wi <= -12 && yi === 0) return 37;
      if (gi === 0 && ui === 26 && wi >= -20 && wi <= -12 && yi <= 2) return yi === 2 ? 62 : 58;
      if (gi === apt.gates.length - 1 && ui >= 27 && ui <= 28 && yi === 0 && wi >= -22 && wi <= 2 && (wi % 4 !== 0)) return ui === 27 ? 21 : 60;
      return 0;
    }, { name: 'gate ' + g.name, post: (gr, st) => { const o = st.min; const ii = Math.floor((XF + side * 4.5 - o.x) / 1); const kk0 = Math.floor(g.gz + lv * 3 - o.z); WB.writeTextZ(gr, g.name, ii, 6, kk0, 57, lv, 1); } });
    // exterior gate number above the bridge
    SKY.signBoard(XF - side * 0.6, 6.5, g.gz + lv * 7, [{ t: g.name, m: 57 }], 0.5, 70, 57, side > 0 ? 'w' : 'e');
    // jet bridge (dynamic so it can extend / retract)
    g.bridge = buildBridge(apt, g); g.ext = g.ai ? 1 : 0; g.target = g.ext; placeBridge(g, apt);
    if (g.ai) buildAirliner(apt, g, liv);
    W.interactables.push({ city: c, pos: new THREE.Vector3(XF + side * 7, 1.2, g.gz + lv * 13.5), r: 4, label: () => '🎫 Gate ' + g.name + ' — ' + gateStatus(apt, g), act: () => gateDesk(apt, g) });
}
function buildMisc(apt) {
  const c = apt.c, { side, lv, XF, L, az, ax } = apt; const d = apt.def;
  const liv = LIVERY[apt.code] || [67, 68];
  const mid = apt.gates[Math.floor(apt.gates.length / 2)];
  W.interactables.push({ city: c, pos: new THREE.Vector3(XF + side * (TD - 5.5), 4.5, mid.gz - lv * 6), r: 9, label: () => '📋 Departures board', act: () => departures(apt) });
  const g0 = apt.gates[0];
  W.interactables.push({ city: c, pos: new THREE.Vector3(XF + side * 24.5, 1.2, g0.gz - lv * 16), r: 5, label: () => '☕ Airport café — grab a coffee', act: () => { const P = SKY.Player; P.hp = Math.min(100, P.hp + 10); SKY.toast('☕ A ' + SKY.choose(['latte', 'flat white', 'cold brew', 'café de olla', 'matcha']) + ' at the ' + apt.code + ' café (+10 HP)', 'good'); SKY.Audio.play('eat'); } });
  const gl = apt.gates[apt.gates.length - 1];
  W.interactables.push({ city: c, pos: new THREE.Vector3(XF + side * 27.5, 1.2, gl.gz - lv * 10), r: 6, label: () => '🧳 Check-in counter', act: () => SKY.toast('🧳 Checked in! Boarding pass: ' + apt.code + ' → ' + SKY.Game.nextCity(c).name + ' · Gate ' + (freeGate(apt) || apt.gates[0]).name + ' · Seat ' + (10 + Math.floor(Math.random() * 20)) + SKY.choose(['A', 'C', 'D', 'F']), 'good') });
  // ---- control tower ----
  const tx = XF - side * 30, tz = az + L / 2 + 110;
  WB.shape(tx, 0, tz, 14, 52, 14, 1, (px, y, pz) => { const r = hyp(px, pz); if (y < 4) return Math.abs(px) < 6 && Math.abs(pz) < 6 ? 21 : 0; if (y < 38) return r < 2.6 ? 29 : 0; if (y < 40) return r < 6 ? 21 : 0; if (y < 45) return r < 5.6 && r > 4.4 ? (Math.abs(px) < 1 || Math.abs(pz) < 1 ? 70 : 22) : 0; if (y < 47) return r < 6.2 ? 70 : 0; if (y < 51) return r < 0.6 ? (y > 49 ? 47 : 56) : 0; return 0; }, { name: apt.code + ' tower' });
  // ---- hangars (arched), opening toward the runway ----
  for (let k = 0; k < apt.nh; k++) {
    const R = d.bigHangars ? 22 : 16, hz = az - L / 2 - 110 - k * 64, hx = ax + side * 220;
    WB.shape(hx, 0, hz, 34, R + 2, R * 2 + 4, 2, (px, y, pz) => { const u = side * px, dd = hyp(pz, y); if (Math.abs(u) > 16 || dd > R) return 0; if (dd > R - 2.2) return d.bigHangars ? 40 : 56; if (u > 14) return 21; if (u < -14 && dd > R * 0.82) return 63; return 0; }, { name: 'hangar' });
  }
  // ---- fuel farm ----
  for (let k = 0; k < 3; k++) WB.shape(XF + side * 20, 0, az + L / 2 + 70 + k * 15, 12, 8, 12, 1, (px, y, pz) => (hyp(px, pz) < 5.5 ? (y > 7 ? 21 : (y > 5 && y < 6 ? liv[0] : 29)) : 0), { name: 'fuel tank' });
  // ---- windsock ----
  const wx = ax - side * 70, wz = az + apt.len / 2 - 350;
  WB.shape(wx, 0, wz, 6, 9, 2, 0.5, (px, y, pz) => { if (Math.abs(px + 2.5) < 0.3 && Math.abs(pz) < 0.3 && y < 8.5) return 56; if (px > -2.2 && y > 7 && y < 8.6 - (px + 2.2) * 0.12 && y > 7 + (px + 2.2) * 0.12 && Math.abs(pz) < 0.75 - (px + 2.2) * 0.1) return Math.floor((px + 2.2) / 1) % 2 ? 29 : 62; return 0; }, { name: 'windsock' });
  // ---- entrance sign with code ----
  const sx = XF + side * (TD + 30), sz = az - L / 2 - 52;
  SKY.signBoard(sx, 1, sz, [{ t: apt.code, m: liv[0] === 29 ? 67 : liv[0], sc: 2 }, { t: apt.name }], 0.5, 29, 70, 'n');
  // ---- signature buildings ----
  const sig = d.sig;
  const curb = XF + side * (TD + 70);
  if (sig === 'LAX') {
    WB.shape(curb, 0, az, 64, 34, 64, 1, (px, y, pz) => { // Theme Building: crossing parabolic arches + saucer
      for (const [a, b] of [[px, pz], [pz, px]]) { const t = Math.abs(a) / 30; const ay = 30 * (1 - t * t); if (Math.abs(b) < 1.2 && Math.abs(y - ay) < 1.2 && t < 1) return 29; }
      const r = hyp(px, pz); if (y > 17 && y < 20 && r < 16 - Math.abs(y - 18.5) * 3) return y > 18.5 ? 29 : 22; if (y < 18 && r < 3) return 29; return 0;
    }, { name: 'Theme Building' });
    apt.pylons = true;
  } else if (sig === 'JFK') {
    WB.shape(curb, 0, az - 60, 70, 20, 50, 1, (px, y, pz) => { const wing = (Math.abs(px) < 32 && Math.abs(pz) < 20 && y < 18 - Math.abs(px) * 0.25 + (Math.abs(pz) < 2 ? 0 : 0) && y > 14 - Math.abs(px) * 0.28 - pz * pz * 0.01); if (wing) return 29; if (y < 8 && Math.abs(px) < 10 && Math.abs(pz) < 12 && (Math.abs(pz) > 10 || Math.abs(px) > 8)) return 22; return 0; }, { name: 'TWA Flight Center' });
  } else if (sig === 'CDG') {
    WB.shape(curb, 0, az, 70, 26, 70, 2, (px, y, pz) => { const r = hyp(px, pz); if (r < 32 && r > 16 && y < 22) return (y % 6 < 2) ? 21 : (Math.floor(Math.atan2(pz, px) * 6) % 2 ? 21 : 22); return 0; }, { name: 'Terminal 1' });
  } else if (sig === 'HND') {
    WB.shape(curb, 0, az + 70, 16, 34, 16, 1, (px, y, pz) => { for (let t = 0; t < 5; t++) { const b = t * 6, hw = 5 - t * 0.6; if (y >= b && y < b + 4 && Math.abs(px) < hw - 1.5 && Math.abs(pz) < hw - 1.5) return 28; if (y >= b + 4 && y < b + 6 && Math.abs(px) < hw + 1 && Math.abs(pz) < hw + 1) return 70; } return 0; }, { name: 'pagoda' });
  } else if (sig === 'MEX') {
    WB.shape(curb, 0, az + 60, 20, 40, 20, 1, (px, y, pz) => { if (Math.abs(px + 6) < 0.6 && Math.abs(pz) < 0.6) return 56; if (y > 26 && y < 36 && px > -5.5 && px < 6 && Math.abs(pz) < 0.5) return px < -1.8 ? 64 : px < 2 ? 29 : 67; return 0; }, { name: 'flag' });
  } else if (sig === 'LAS') {
    SKY.signBoard(curb, 6, az + 40, [{ t: 'WELCOME TO', m: 67 }, { t: 'LAS VEGAS', m: 60 }], 0.5, 29, 67, side > 0 ? 'e' : 'w', { diamond: true, bulbs: true });
    for (let k = 0; k < 6; k++) WB.shape(curb + side * 20, 0, az - 100 + k * 30, 6, 8, 6, 1, (px, y, pz) => (y < 1 ? (Math.abs(px) < 2.5 && Math.abs(pz) < 2.5 ? 69 : 0) : (y < 7 && hyp(px, pz) < 0.6 ? 33 + (k % 3) : 0)), { name: 'neon post' });
  }
  apt.built = true;
}
// jet bridge cells in its own local frame: u_b (0 at facade .. 13.5 outward), v (2.5 .. 9.5 from the parked plane centreline)
function buildBridge(apt, g) {
  const { side, lv, XF } = apt; const s = 0.5;
  const xA = XF, xB = XF - side * 13.5; const zA = g.gz + lv * 2.5, zB = g.gz + lv * 9.5;
  const st = WB.newStruct(Math.min(xA, xB), 0, Math.min(zA, zB) + lv * 3, 27, 14, 14, s, { name: 'jet bridge ' + g.name });
  const gr = st.grid, o = st.min;
  for (let k = 0; k < 14; k++) for (let i = 0; i < 27; i++) {
    const wx = o.x + (i + 0.5) * s, wz = o.z - lv * 3 + (k + 0.5) * s;
    const ub = (XF - wx) * side, v = (wz - g.gz) * lv;
    for (let j = 0; j < 14; j++) {
      const y = (j + 0.5) * s; let m = 0;
      if (ub >= 0 && ub < 9.5 && v >= 5 && v <= 9) {
        const f = 0.5 + 0.5 * Math.min(6, Math.floor(ub / 1.5));
        const wall = v < 5.5 || v > 8.5;
        if (y < f && y > f - 0.5) m = 66;
        else if (wall && y > f && y < f + 2.5) m = (y > f + 1 && y < f + 2) ? 22 : 66;
        else if (y > f + 2.5 && y < f + 3) m = 66;
        else if (ub > 7.5 && ub < 8.5 && Math.abs(v - 7) < 0.6 && y < f - 0.5) m = 56;
      } else if (ub >= 9.5 && ub <= 13.5 && v >= 2.5 && v <= 9.5) {
        const wallU = ub > 13 || (ub < 10 && !(v > 5.5 && v < 8.5)), wallV = v > 9 || (v < 3 && !(ub > 10 && ub < 12.5));
        if (y > 3 && y < 3.5) m = 66;
        else if (y > 3.5 && y < 6 && (wallU || wallV)) m = (y > 4.5 && y < 5.5 && !(v < 3)) ? 22 : 66;
        else if (y > 6 && y < 6.5) m = 66;
        else if (y < 3 && Math.abs(ub - 11.5) < 0.6 && Math.abs(v - 7) < 0.6) m = 56;
        else if (y < 0.5 && Math.abs(ub - 11.5) < 1.1 && Math.abs(v - 7) < 1.1) m = 70;
      }
      if (m) gr.set(i, j, k, m);
    }
  }
  st.anchorJ = -1; WB.finish(st); W.setDynamic(st); st.base = st.min.clone();
  return st;
}
function placeBridge(g, apt) { const st = g.bridge; if (!st || !st.base) return; W.moveStruct(st, st.base.x, 0, st.base.z - apt.lv * 3 * g.ext); }
// voxel airliner parked at a gate (static, destructible)
function buildAirliner(apt, g, liv) {
  const { side } = apt; const fw = side; // +x forward when side>0
  WB.shape(g.stop.x, 0, g.gz, 36, 13, 32, 1, (px, y, pz) => {
    const a = px * fw; const az = Math.abs(pz);
    // fuselage
    let r = 2.5, cy = 4.5; if (a > 11) { const t = (a - 11) / 5.2; if (t > 1) r = 0; else { r = 2.5 * Math.sqrt(Math.max(0, 1 - t * t * t)); cy = 4.5 - 0.6 * t * t; } } else if (a < -8) { const t = (-8 - a) / 8; if (t > 1) r = 0; else { r = 2.5 * (1 - 0.72 * t); cy = 4.5 + 1.35 * t; } }
    if (r > 0 && hyp(pz, y - cy) < r) { if (Math.abs(y - (cy + 0.7)) < 0.5 && az > r - 1.2 && a > -8 && a < 10 && Math.floor(a) % 2 === 0) return 70; if (a > 10.5 && y > cy + 0.3 && y < cy + 1.1 && az < 1.8) return 70; return y < cy - 1.2 ? liv[1] : (Math.abs(y - (cy - 0.7)) < 0.5 ? liv[0] : 29); }
    // wings (swept), engines, tail
    if (y >= 2.5 && y < 3.5 && az < 15.4 && az > 2 && a < 2 - az * 0.32 && a > -4 - az * 0.32) return 29;
    for (const s of [-1, 1]) if (hyp(pz - s * 5.6, y - 2) < 1.15 && a > -3.3 && a < 0.7) return a > 0.3 ? 70 : 56;
    if (az < 0.6 && y > 6 && y < 12 && a > -15.5 + (y - 6) * 0.45 && a < -10 + (y - 6) * 0.1) return liv[0];
    if (y >= 5.5 && y < 6.5 && az < 6 && a < -12.5 && a > -16) return 29;
    if (y < 2.5 && ((a > 10 && a < 11 && az < 0.6) || (a > -1.5 && a < -0.5 && Math.abs(az - 3) < 0.6))) return 70;
    return 0;
  }, { name: apt.code + ' airliner' });
}
function gateStatus(apt, g) {
  if (A.dock && A.dock.gate === g) return 'YOUR PLANE (docked)';
  if (g.ai) return 'BOARDING → ' + SKY.Game.nextCity(apt.c).id;
  return 'AVAILABLE';
}
function gateDesk(apt, g) {
  if (A.dock && A.dock.gate === g) { SKY.toast('🎫 Your plane is at gate ' + g.name + '. Walk down the jet bridge to the front (L1) door to reboard.', 'good'); return; }
  if (g.ai) SKY.toast('🎫 Gate ' + g.name + ': flight to ' + SKY.Game.nextCity(apt.c).name + ' now boarding. (That one is not yours!)');
  else SKY.toast('🎫 Gate ' + g.name + ' is free. Taxi in and stop on the yellow line to dock.');
}
function departures(apt) {
  const t = new Date(); const lines = []; const others = W.cities.filter((x) => x !== apt.c && x.apt && !x.apt.restricted);
  others.slice(0, 5).forEach((o, i) => { const m = t.getHours() * 60 + t.getMinutes() + 15 + i * 25; lines.push(String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + ' ' + o.apt.code + ' ' + ['ON TIME', 'BOARDING', 'DELAYED', 'ON TIME', 'FINAL CALL'][i]); });
  SKY.toast('📋 ' + apt.code + ' DEPARTURES · ' + lines.join(' · '), 'good');
}
function freeGate(apt) { return apt.gates.find((g) => !g.ai && !(A.dock && A.dock.gate === g)); }
A.freeGate = freeGate;

// ============================================================ runtime
A.nearest = (x, z, maxD) => { let best = null, bd = maxD || 6000; for (const apt of A.list) { const d = hyp(apt.ax - x, apt.az - z) - apt.len / 2; if (d < bd) { bd = d; best = apt; } } return best; };
A.dropCity = (c) => { if (A.dock && A.dock.apt.c === c) A.dock = null; if (c.apt) { for (const g of c.apt.gates) g.bridge = null; c.apt.built = false; } };
A.onRunway = (apt, p) => { for (const r of apt.rwys) if (Math.abs(p.x - r.x) < 45 && Math.abs(p.z - apt.az) < apt.len / 2 + 150) return r; return null; };
const _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
function setPose(pl, x, z, h) { pl.pos.x = x; pl.pos.z = z; pl.quat.setFromAxisAngle(_y, -h); pl.vel.set(0, 0, 0); pl.w.set(0, 0, 0); pl.prevVel.set(0, 0, 0); pl.group.updateMatrixWorld(true); }
function l1(pl) { return pl.cabinDoors.find((d) => d.D === pl.consts.DOOR_L1) || pl.cabinDoors[0]; }
A.dockAt = (apt, g, instant) => {
  const pl = SKY.Game.plane;
  A.dock = { apt, gate: g, phase: instant ? 'docked' : 'snap', t: 0, from: { x: pl.pos.x, z: pl.pos.z, h: pl.heading() * Math.PI / 180 } };
  A.taxi = null; pl.ap.mode = 'hold'; pl.throttle = 0; pl.brake = true;
  if (instant) { setPose(pl, g.stop.x, g.stop.z, g.hdg); pl.pos.y = 3.62; g.target = 1; g.ext = 1; placeBridge(g, apt); l1(pl).target = 1; l1(pl).open = 1; A.onDocked(apt, g, true); }
};
A.onDocked = (apt, g, quiet) => {
  const pl = SKY.Game.plane; const P = SKY.Player; g.target = 1; l1(pl).target = 1;
  if (P.frame === 'plane' && P.pos.z < pl.consts.COCK_Z + 0.3) { pl.cockpitDoor.locked = false; pl.cockpitDoor.target = 1; pl.cockpitDoor.autoClose = 0; }
  if (!quiet) { SKY.toast('🅿 Docked at ' + apt.code + ' gate ' + g.name + '! Jet bridge connected, L1 door open. Leave your seat and walk into the terminal.', 'good'); SKY.Audio.play('chime'); }
  A.landedAt = null; // arrived: next auto-taxi goes to the runway
  SKY.Game.achieve('gate'); SKY.Game.stats && SKY.Game.stats.cities.add(apt.c.id);
};
A.startPushback = (byAI) => {
  const D = A.dock; if (!D || D.phase === 'push' || D.phase === 'retract') return;
  const pl = SKY.Game.plane; D.phase = 'retract'; D.t = 0; D.byAI = byAI; D.gate.target = 0; l1(pl).target = 0;
  SKY.toast(byAI ? '🛄 Captain: "Cabin crew, doors to automatic. Pushing back."' : '🚜 Jet bridge retracting · pushback in progress…', 'good');
};
function pushPose(D, t) { // t 0..1 → pose along straight + quarter-circle path (tail swings north)
  const g = D.gate, apt = D.apt, side = apt.side, sx = g.stop.x;
  const s1 = 20, s2 = Math.PI / 2 * 25, tot = s1 + s2; const s = t * tot;
  if (s < s1) return [sx - side * s, g.gz, g.hdg];
  const a = (s - s1) / 25; const cx = sx - side * 20, cz = g.gz - 25;
  return [cx - side * 25 * Math.sin(a), cz + 25 * Math.cos(a), g.hdg + side * a];
}
let tug = null;
function tugMesh() { if (!tug) { tug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0xffd23d })); SKY.Game.scene.add(tug); } return tug; }
// taxi routes ------------------------------------------------
A.routeToGate = (apt, p, g) => {
  const { ax, side, twyX, laneX } = apt; const pts = [];
  let cur = [p.x, p.z];
  if (Math.abs(p.x - ax) < 40 || A.onRunway(apt, p)) {
    let zc = apt.conns.slice().sort((a, b) => b - a).find((z) => z < p.z - 70); if (zc === undefined) zc = apt.conns[apt.conns.length - 1];
    pts.push([ax, zc + 45], [ax + side * 45, zc - 4], [twyX, zc - 30]); cur = [twyX, zc - 30];
  }
  const zA0 = apt.az - apt.L / 2 - 40, zA1 = apt.az + apt.L / 2 + 40; const zE = clamp(cur[1], zA0, zA1);
  if (Math.abs(cur[1] - zE) > 5) pts.push([twyX, zE]);
  const dir = Math.sign(g.gz - zE) || 1;
  pts.push([laneX, zE + dir * 25]);
  if (Math.abs(g.gz - zE) > 70) pts.push([laneX, g.gz - dir * 40]);
  pts.push([laneX + side * 18, g.gz - dir * 4], [g.stop.x - side * 14, g.gz], [g.stop.x, g.gz]);
  return { pts, kind: 'gate', gate: g, apt, i: 0 };
};
A.routeToRunway = (apt, p) => {
  const { ax, side, twyX, laneX, zs } = apt; const pts = [];
  if (Math.abs(p.x - laneX) < 60) pts.push([laneX, p.z + 30]);
  pts.push([twyX, Math.max(p.z + 60, Math.min(zs - 120, p.z + 200))]);
  pts.push([twyX, zs - 40], [ax + side * 70, zs + 12], [ax + side * 14, zs - 20], [ax, zs - 70], [ax, zs - 160]);
  return { pts, kind: 'runway', apt, i: 0 };
};
A.taxiCtl = (pl, dt) => {
  const r = A.taxi; const out = { pitch: 0, roll: 0, yaw: 0 };
  if (!r) { pl.throttle = 0; pl.brake = true; return out; }
  const p = pl.pos, hdg = pl.heading() * Math.PI / 180, spd = pl.speed();
  while (r.i < r.pts.length - 1) { const a = r.pts[r.i], b = r.pts[r.i + 1]; const da = hyp(a[0] - p.x, a[1] - p.z); const past = (p.x - a[0]) * (b[0] - a[0]) + (p.z - a[1]) * (b[1] - a[1]) > 0 && da < 40; if (da < 10 || past) r.i++; else break; }
  // lookahead point
  const LA = clamp(spd * 2.2, 10, 24); let tgt = r.pts[r.pts.length - 1];
  { let acc = 0; let px = p.x, pz = p.z; for (let k = r.i; k < r.pts.length; k++) { const q = r.pts[k]; const d = hyp(q[0] - px, q[1] - pz); if (acc + d >= LA) { const f = (LA - acc) / d; tgt = [px + (q[0] - px) * f, pz + (q[1] - pz) * f]; break; } acc += d; px = q[0]; pz = q[1]; tgt = q; } }
  const end = r.pts[r.pts.length - 1]; const dEnd = hyp(end[0] - p.x, end[1] - p.z);
  let remain = 0; { let px = p.x, pz = p.z; for (let k = r.i; k < r.pts.length; k++) { remain += hyp(r.pts[k][0] - px, r.pts[k][1] - pz); px = r.pts[k][0]; pz = r.pts[k][1]; } }
  const want = Math.atan2(tgt[0] - p.x, -(tgt[1] - p.z)); const err = wrap(want - hdg);
  out.yaw = clamp(err * 2.4, -1, 1);
  let tsp = Math.min(r.kind === 'runway' ? 10 : 8.5, remain * 0.22 + 1.2) * clamp(1.15 - Math.abs(err) * 0.9, 0.3, 1);
  if (r.kind === 'runway' && r.i >= r.pts.length - 2) { // lined up → hand over to the takeoff autopilot
    if (Math.abs(p.x - r.apt.ax) < 6 && Math.abs(wrap(0 - hdg)) < 0.2) { A.taxi = null; pl.ap.mode = 'takeoff'; pl.ap.rwyX = r.apt.ax; pl.ap.hdg = 0; pl.ap.on = true; if (!pl.ap.dest) pl.ap.dest = SKY.Game.nextCity(r.apt.c); pl.ap.alt = Math.max(pl.ap.alt || 0, 1900); SKY.toast('🛫 Lined up on runway ' + r.apt.rwys[0].s + ' at ' + r.apt.code + ' — cleared for takeoff!', 'good'); return out; }
  }
  if (r.kind === 'gate' && (dEnd < 1.5 || (r.i >= r.pts.length - 2 && dEnd < 4))) { pl.throttle = 0; pl.brake = true; if (spd < 0.6) { A.taxi = null; } return out; }
  if (spd < tsp - 0.3) { pl.throttle = clamp(0.07 + (tsp - spd) * 0.06, 0.05, 0.32); pl.brake = false; } else if (spd > tsp + 1.2) { pl.throttle = 0; pl.brake = true; } else { pl.throttle = 0.045; pl.brake = false; }
  return out;
};
// player pressed autopilot while on the ground → smart ground autopilot
A.groundAP = (pl) => {
  const apt = A.nearest(pl.pos.x, pl.pos.z, 1500); if (!apt || !apt.built) return false;
  if (A.dock) { A.startPushback(false); A.dock.thenTaxi = true; pl.ap.on = true; pl.ap.by = 'player'; pl.ap.mode = 'hold'; return true; }
  if (pl.speed() > 25) return false;
  const nearRwyStart = Math.abs(pl.pos.x - apt.ax) < 10 && pl.pos.z > apt.zs - 200 && Math.abs(wrap(pl.heading() * Math.PI / 180)) < 0.25;
  if (nearRwyStart) { pl.ap.on = true; pl.ap.by = 'player'; pl.ap.mode = 'takeoff'; pl.ap.rwyX = apt.ax; pl.ap.hdg = 0; pl.ap.alt = 1900; pl.ap.dest = SKY.Game.nextCity(apt.c); SKY.toast('🛫 Autopilot takeoff from ' + apt.code, 'good'); return true; }
  const g = A.landedAt === apt ? freeGate(apt) : null;
  A.taxi = g ? A.routeToGate(apt, pl.pos, g) : A.routeToRunway(apt, pl.pos);
  pl.ap.on = true; pl.ap.by = 'player'; pl.ap.mode = 'taxi';
  SKY.toast(g ? '🚕 Auto-taxi to ' + apt.code + ' gate ' + g.name : '🚕 Auto-taxi to runway ' + apt.rwys[0].s + ' at ' + apt.code, 'good');
  return true;
};
A.placeAtGate = (c) => { const apt = c.apt; if (!apt) return false; W.ensureCity(c); const g = freeGate(apt) || apt.gates[0]; const pl = SKY.Game.plane; pl.place(c, 'runway'); pl.flaps = 0; A.taxi = null; A.dep = null; A.dockAt(apt, g, true); return g; };
A.reset = () => { if (A.dock) { const g = A.dock.gate; g.target = 0; } A.dock = null; A.taxi = null; A.dep = null; A.landedAt = null; if (tug) tug.visible = false; };

A.update = (dt) => {
  const G = SKY.Game, pl = G.plane, P = SKY.Player;
  // bridges animate
  for (const apt of A.list) { if (!apt.built) continue; for (const g of apt.gates) if (g.bridge && Math.abs(g.ext - g.target) > 1e-3) { g.ext += clamp(g.target - g.ext, -dt / 2.5, dt / 2.5); placeBridge(g, apt); } }
  const D = A.dock;
  if (pl.crashed) { if (D) { D.gate.target = 0; A.dock = null; } A.taxi = null; A.dep = null; return; }
  if (!D) {
    // docking detection
    if (pl.onGround && pl.speed() < 1.2 && pl.gearDown) {
      const apt = A.nearest(pl.pos.x, pl.pos.z, 900);
      if (apt && apt.built) for (const g of apt.gates) { if (g.ai) continue; const d = hyp(pl.pos.x - g.stop.x, pl.pos.z - g.stop.z); if (d < 14 && Math.abs(wrap(pl.heading() * Math.PI / 180 - g.hdg)) < 0.55) { A.dockAt(apt, g, false); break; } }
    }
  } else {
    const g = D.gate; D.t += dt;
    if (D.phase === 'snap') { const t = Math.min(1, D.t / 1.4), e = t * t * (3 - 2 * t); setPose(pl, D.from.x + (g.stop.x - D.from.x) * e, D.from.z + (g.stop.z - D.from.z) * e, D.from.h + wrap(g.hdg - D.from.h) * e); pl.throttle = 0; if (t >= 1) { D.phase = 'docked'; D.t = 0; A.onDocked(D.apt, g); } }
    else if (D.phase === 'docked') {
      setPose(pl, g.stop.x, g.stop.z, g.hdg); if (pl.pos.y > 3.8) pl.pos.y = 3.62;
      const flying = P.mode === 'pilot' && P.frame === 'plane';
      if (flying && pl.throttle > 0.15 && !pl.ap.on) { pl.throttle = 0; A.startPushback(false); }
      // AI departure: player seated as passenger, pilots in the cockpit
      if (P.frame === 'plane' && P.mode === 'seat' && SKY.Crowd.pilots().length) { D.boardT = (D.boardT || 0) + dt; if (D.boardT > 6) { A.startPushback(true); D.thenTaxi = true; } } else D.boardT = 0;
    } else if (D.phase === 'retract') {
      setPose(pl, g.stop.x, g.stop.z, g.hdg);
      if (D.t > 2.6) { D.phase = 'push'; D.t = 0; }
    } else if (D.phase === 'push') {
      const T = 14, t = Math.min(1, D.t / T), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const ps = pushPose(D, e); setPose(pl, ps[0], ps[1], ps[2]); pl.throttle = 0;
      const tg = tugMesh(); tg.visible = true; const f = new THREE.Vector3(Math.sin(ps[2]), 0, -Math.cos(ps[2])); tg.position.set(ps[0] + f.x * 19, 0.8, ps[1] + f.z * 19); tg.rotation.y = -ps[2];
      if (t >= 1) {
        tg.visible = false; const apt = D.apt; const then = D.thenTaxi, byAI = D.byAI; A.dock = null; G.achieve('pushback');
        if (then || byAI) { A.taxi = A.routeToRunway(apt, pl.pos); pl.ap.on = true; pl.ap.mode = 'taxi'; if (byAI) { pl.ap.by = 'pilots'; pl.ap.dest = G.nextCity(apt.c); } SKY.toast('🚕 Taxiing to runway ' + apt.rwys[0].s + ' via taxiway A', 'good'); }
        else SKY.toast('✅ Pushback complete. Taxi to runway ' + apt.rwys[0].s + ' (follow the yellow line, or press T for auto-taxi)', 'good');
      }
    }
  }
  // guidance for the HUD / minimap
  A.guide = null;
  const apt = A.nearest(pl.pos.x, pl.pos.z, 1200);
  if (apt && pl.onGround && !A.dock) {
    if (A.taxi) A.guide = { apt, route: A.taxi, txt: A.taxi.kind === 'gate' ? 'Auto-taxi → gate ' + A.taxi.gate.name : 'Auto-taxi → runway ' + apt.rwys[0].s };
    else if (A.landedAt === apt) { const g = freeGate(apt); if (g) { const dx = g.stop.x - pl.pos.x, dz = g.stop.z - pl.pos.z; const h = pl.heading() * Math.PI / 180; const fwd = dx * Math.sin(h) - dz * Math.cos(h), right = dx * Math.cos(h) + dz * Math.sin(h); A.guide = { apt, gate: g, route: A.routeToGate(apt, pl.pos, g), txt: 'Gate ' + g.name + ': ' + Math.round(hyp(dx, dz)) + ' m' + (hyp(dx, dz) < 120 ? ' (' + (fwd > 0 ? Math.round(fwd) + ' ahead' : 'behind') + ', ' + Math.abs(Math.round(right)) + (right > 0 ? ' R' : ' L') + ')' : '') }; } }
  }
  // terminal visit
  if (P.frame === 'world') {
    for (const a of A.list) { if (!a.built) continue; const u = (P.pos.x - a.XF) * a.side; if (u > 0 && u < TD && Math.abs(P.pos.z - a.az) < a.L / 2 && P.pos.y < 6) { if (A.inTerm !== a) { A.inTerm = a; SKY.toast('🏢 Welcome to the ' + a.code + ' terminal (' + a.name + ')', 'good'); G.achieve('terminal'); } } else if (A.inTerm === a && (u < -2 || u > TD + 2 || Math.abs(P.pos.z - a.az) > a.L / 2 + 2)) A.inTerm = null; }
  } else A.inTerm = null;
};
A.isDocked = () => !!(A.dock && A.dock.phase === 'docked');
})();

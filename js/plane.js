'use strict';
// GROK SKY - the voxel airliner: build, flight model, collisions, destruction, doors, decompression, masks, galley
(() => {
const { clamp, rand, MAT } = SKY;
const S = 0.4, NX = 78, NY = 26, NZ = 82, F = 7;
const OX = -NX * S / 2, OY = -(F + 1) * S, OZ = -NZ * S / 2;
const R = 2.5, CY = 0.9, NOSE_TIP = -16.2, NOSE_END = -10.6, TAIL_START = 8.6, TAIL_END = 16.2;
const cxI = (i) => OX + (i + 0.5) * S, cyJ = (j) => OY + (j + 0.5) * S, czK = (k) => OZ + (k + 0.5) * S;
const iX = (x) => Math.floor((x - OX) / S), jY = (y) => Math.floor((y - OY) / S), kZ = (z) => Math.floor((z - OZ) / S);
function profile(z) { // returns [r, cy] of fuselage at z, or null
  if (z < NOSE_TIP || z > TAIL_END) return null;
  if (z < NOSE_END) { const t = (NOSE_END - z) / (NOSE_END - NOSE_TIP); return [R * Math.sqrt(Math.max(0, 1 - t * t * t)), CY - 0.6 * t * t]; }
  if (z > TAIL_START) { const t = (z - TAIL_START) / (TAIL_END - TAIL_START); return [R * (1 - 0.72 * t), CY + 1.35 * t]; }
  return [R, CY];
}
const PART = { FUS: 0, WL: 1, WR: 2, EL: 3, ER: 4, HS: 5, VS: 6, COCK: 7, INT: 8 };
const ROW_K0 = 18, ROWS = 12, BULK_K = 10, REAR_BULK_K = 71;
const SEAT_X = [-1.8, -1.4, -1.0, 1.0, 1.4, 1.8];
const DOOR_L1 = { k0: 12, k1: 14, z0: czK(12) - S / 2, z1: czK(14) + S / 2 };
const DOOR_L2 = { k0: 55, k1: 57, z0: czK(55) - S / 2, z1: czK(57) + S / 2 };
const COCK_Z = czK(BULK_K); // -12.2
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

// ============================================================ 4.0 plane types (real-world inspired)
// cls 'jet': walkable airliner cabin (same interior on every jet, the exterior changes); cls 'small': seats only (no aisle)
// sv = speed scale vs the 737 baseline (lift qk = 150*(m/60000)/sv^2), tk = thrust/weight vs baseline
const TYPES = {
  C172: { id: 'C172', name: 'Cessna 172 Skyhawk', short: 'Cessna 172', icon: '🛩️', cls: 'small', seats: 4, blurb: 'High-wing trainer with a propeller. Slow, gentle and forgiving — lands almost anywhere.',
    mass: 1100, I: [8300, 10300, 5700], sv: 0.38, tk: 1.3, cd0: 0.02, rates: [0.85, 1.9, 0.5], resp: 1.35, vr: 29, vapp: 31, vclimb: 38, vcruise: 58, alt: 1200, vsMax: 7, rotPitch: 0.2,
    rwy: 350, eng: { mul: 1.75, prop: true }, gearH: 1.25, fixedGear: true, cam: [13, 1.4], door: { x: -1.3, z: -1.2 }, S: 0.25,
    gear: [[0, -3.9], [-1.35, 0.25], [1.35, 0.25]], anchor: [-1.1, 1.1, -0.6, 0.3, -2.6, 0.6], engines: [[0, 0.5, -4.6]], spanW: 7.2 },
  BIZ: { id: 'BIZ', name: 'Gulfstream G650 business jet', short: 'Gulfstream G650', icon: '💼', cls: 'small', seats: 8, blurb: 'Sleek private jet with T-tail and rear engines. Fast, agile and quick to climb.',
    mass: 40000, I: [1.3e6, 1.63e6, 0.9e6], sv: 0.9, tk: 1.3, cd0: 0, rates: [0.75, 1.9, 0.38], resp: 1.2, vr: 60, vapp: 60, vclimb: 165, vcruise: 235, alt: 2800, vsMax: 18, rotPitch: 0.17,
    rwy: 1200, eng: { mul: 1.35 }, gearH: 1.75, cam: [22, 2], door: { x: -1.6, z: -7.6 }, S: 0.3,
    gear: [[0, -8.4], [-1.7, 0.4], [1.7, 0.4]], anchor: [-1.3, 1.3, -0.8, 0.2, -6, 3], engines: [[-2.4, 1.15, 6.5], [2.4, 1.15, 6.5]], spanW: 13 },
  B737: { id: 'B737', name: 'Boeing 737', short: 'Boeing 737', icon: '✈️', cls: 'jet', seats: 74, blurb: 'The classic short-haul workhorse. Balanced and predictable — the original GROK Air jet.',
    mass: 60000, I: [3.2e6, 4.0e6, 2.2e6], sv: 1, tk: 1, cd0: 0, rates: [0.6, 1.4, 0.3], resp: 1, vr: 70, vapp: 68, vclimb: 150, vcruise: 200, alt: 1900, vsMax: 22, rotPitch: 0.16,
    rwy: 1500, eng: { mul: 1 }, gearH: 3.6, cam: [30, 3], door: { x: -2.4, z: null },
    gear: [[0, -11.0], [-2.4, 1.6], [2.4, 1.6]], anchor: [-2.3, 2.3, -3.3, 0.3, -2.7, 3.9], engines: [[-5.6, -1.6, -4], [5.6, -1.6, -4]], spanW: 15.4,
    geo: { span: 15.4, le0: -3.2, sweep: 0.5, ch0: 6.4, chTip: 1.8, eng: [{ x: 5.6, y: -2.2, r: 0.98, z0: -6.0, z1: -3.0 }], flatEng: true, winglet: 'blend', liv: { stripe: 2, tail: 12 } } },
  A320: { id: 'A320', name: 'Airbus A320', short: 'Airbus A320', icon: '✈️', cls: 'jet', seats: 74, blurb: 'Fly-by-wire jet with sharklets: bank and pitch protections plus ALPHA FLOOR keep you safe.',
    mass: 64000, I: [3.4e6, 4.2e6, 2.3e6], sv: 0.98, tk: 1.02, cd0: 0, rates: [0.6, 1.45, 0.3], resp: 1.05, fbw: true, vr: 68, vapp: 67, vclimb: 150, vcruise: 205, alt: 1900, vsMax: 22, rotPitch: 0.16,
    rwy: 1500, eng: { mul: 1.12 }, gearH: 3.6, cam: [30, 3], door: { x: -2.4, z: null },
    gear: [[0, -11.0], [-2.5, 1.4], [2.5, 1.4]], anchor: [-2.3, 2.3, -3.3, 0.3, -2.7, 3.9], engines: [[-5.8, -1.6, -4.5], [5.8, -1.6, -4.5]], spanW: 15.8,
    geo: { span: 15.8, le0: -3.4, sweep: 0.48, ch0: 6.6, chTip: 1.7, nose: 'round', eng: [{ x: 5.8, y: -2.15, r: 1.06, z0: -6.6, z1: -3.2 }], winglet: 'shark', liv: { stripe: 68, tail: 67 } } },
  B747: { id: 'B747', name: 'Boeing 747 Jumbo', short: 'Boeing 747', icon: '🛫', cls: 'jet', seats: 74, blurb: 'The Queen of the Skies: four engines and the famous hump. Heavy, stable and slow to turn.',
    mass: 180000, I: [12.8e6, 16e6, 8.8e6], sv: 1.12, tk: 0.95, cd0: 0, rates: [0.45, 0.95, 0.22], resp: 0.7, vr: 78, vapp: 76, vclimb: 165, vcruise: 235, alt: 2100, vsMax: 20, rotPitch: 0.15,
    rwy: 2100, eng: { mul: 0.8 }, gearH: 3.6, cam: [42, 4], door: { x: -2.4, z: null },
    gear: [[0, -11.0], [-2.4, 1.0], [2.4, 1.0], [-4.0, 2.6], [4.0, 2.6]], anchor: [-2.3, 2.3, -3.3, 0.3, -2.7, 3.9], engines: [[-7, -1.7, -6], [7, -1.7, -6], [-12.6, -1.1, -3], [12.6, -1.1, -3]], spanW: 20.5,
    geo: { padX: 13, padB: 16, padTop: 6, tailExt: 4.4, tailK: 1.12, finK: 1.3, hsK: 1.35, span: 20.5, le0: -4.6, sweep: 0.62, ch0: 8.4, chTip: 2.0,
      eng: [{ x: 7.0, y: -2.3, r: 1.05, z0: -7.6, z1: -4.3 }, { x: 12.6, y: -1.6, r: 1.0, z0: -4.6, z1: -1.4 }], winglet: 'blend',
      lobe: { z0: -10.6, ramp: 3.2, z1: -0.6, back: 6.5, dy: 1.6, r: 2.2, wins: [-6.5, -3.4] }, liv: { stripe: 67, tail: 68 } } },
  A380: { id: 'A380', name: 'Airbus A380 Superjumbo', short: 'Airbus A380', icon: '🛬', cls: 'jet', seats: 74, blurb: 'Full double-deck giant with four engines. The biggest, heaviest and calmest plane in the sky.',
    mass: 250000, I: [18.8e6, 23.5e6, 13e6], sv: 1.1, tk: 0.9, cd0: 0, rates: [0.42, 0.85, 0.2], resp: 0.62, fbw: true, vr: 76, vapp: 72, vclimb: 160, vcruise: 230, alt: 2100, vsMax: 18, rotPitch: 0.15,
    rwy: 2200, eng: { mul: 0.7 }, gearH: 3.6, cam: [46, 5], door: { x: -2.4, z: null },
    gear: [[0, -11.0], [-2.3, 0.8], [2.3, 0.8], [-4.2, 2.4], [4.2, 2.4]], anchor: [-2.3, 2.3, -3.3, 0.3, -2.7, 3.9], engines: [[-7.6, -1.7, -6], [7.6, -1.7, -6], [-13.6, -1.0, -3], [13.6, -1.0, -3]], spanW: 22.5,
    geo: { padX: 19, padB: 18, padTop: 8, tailExt: 5.2, tailK: 1.15, finK: 1.42, hsK: 1.5, span: 22.5, le0: -5.2, sweep: 0.55, ch0: 9.6, chTip: 2.4,
      eng: [{ x: 7.6, y: -2.3, r: 1.15, z0: -8.0, z1: -4.4 }, { x: 13.6, y: -1.5, r: 1.1, z0: -4.8, z1: -1.3 }], winglet: 'fence',
      lobe: { z0: -13.4, ramp: 2.8, z1: 99, back: 1, dy: 2.05, r: 2.35, wins: [-9.5, 9.5] }, liv: { stripe: 53, tail: 67 } } },
};
const TYPE_ORDER = ['C172', 'BIZ', 'B737', 'A320', 'B747', 'A380'];
for (const id of TYPE_ORDER) { const T = TYPES[id]; T.qk = 150 * (T.mass / 60000) / (T.sv * T.sv); T.thrust = 250000 * (T.mass / 60000) * T.tk; T.vref = 70 * T.sv; }
SKY.PlaneTypes = TYPES; SKY.PlaneTypeOrder = TYPE_ORDER;
SKY.planeType = (id) => TYPES[id] || TYPES.B737;

// fuselage profile of a jet type (main circle) — identical to the 737 in the cabin, longer tail on the heavies
function profJet(z, G) {
  const ts = TAIL_START + (G.tailExt || 0), te = ts + (TAIL_END - TAIL_START) * (G.tailK || 1);
  if (z < NOSE_TIP || z > te) return null;
  if (z < NOSE_END) { const t = (NOSE_END - z) / (NOSE_END - NOSE_TIP); if (G.nose === 'round') return [R * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.5))), CY - 0.45 * t * t]; return [R * Math.sqrt(Math.max(0, 1 - t * t * t)), CY - 0.6 * t * t]; }
  if (z > ts) { const t = (z - ts) / (te - ts); return [R * (1 - 0.72 * t), CY + 1.35 * (G.tailK || 1) * t]; }
  return [R, CY];
}
function lobeAt(z, G, m) {
  const L = G.lobe; if (!L || !m || z < L.z0) return null;
  let f = m[0] / R; f *= Math.sqrt(clamp((z - L.z0) / L.ramp, 0, 1));
  if (L.z1 < 90) { if (z > L.z1) return null; if (z > L.z1 - L.back) f *= Math.sqrt(clamp((L.z1 - z) / L.back, 0, 1)); }
  if (f < 0.08) return null;
  return [L.r * f, m[1] + L.dy * (m[0] / R)];
}
// ------------------------------------------------------------ jet builder (generalised 737 airliner; cabin interior identical)
function buildJet(T, ctx) {
  const G = T.geo, padX = G.padX || 0, padB = G.padB || 0, padT = G.padTop || 0;
  const nx = NX + padX * 2, ny = NY + padT, nz = NZ + padB, ox = OX - padX * S;
  const g = new SKY.VoxGrid(nx, ny, nz, S); g.origin.set(ox, OY, OZ);
  const hullA = ctx.hull = new Uint8Array(g.n);
  const cx = (i) => ox + (i + 0.5) * S, ix = (x) => Math.floor((x - ox) / S), I = (i0) => i0 + padX;
  const set = (i, j, k, m, p, hull) => { if (!g.inb(i, j, k)) return; g.set(i, j, k, m, p); hullA[g.id(i, j, k)] = hull ? 1 : 0; };
  const liv = G.liv, wk1 = 66 + Math.round((G.tailExt || 0) / S * 0.5);
  for (let k = 0; k < nz; k++) {
    const z = czK(k), pr = profJet(z, G); if (!pr) continue;
    const [r, cy] = pr; const pressurized = k <= REAR_BULK_K; const lb = lobeAt(z, G, pr);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = cx(i), y = cyJ(j), d = Math.hypot(x, y - cy);
      if (d > r) {
        if (!lb) continue;
        const dl = Math.hypot(x, y - lb[1]); if (dl > lb[0] || dl < lb[0] - 0.58) continue;
        let m = MAT.HULL; const L = G.lobe;
        if (L.wins && Math.abs(x) > 0.9 && y > lb[1] + 0.15 && y < lb[1] + 0.95 && z > L.wins[0] && z < L.wins[1] && k % 2 === 0) m = MAT.WIN;
        if (y < lb[1] + 0.15 && y > lb[1] - 0.3 && Math.abs(x) > 1.4) m = liv.stripe;
        set(i, j, k, m, k < BULK_K ? PART.COCK : PART.FUS, false);
        continue;
      }
      const cap = r < 0.9 || k === REAR_BULK_K || k >= nz - 2;
      const shell = d > r - 0.58;
      if (shell || cap) {
        let m = MAT.HULL;
        if (k <= 3 && y < cy) m = MAT.RADOME;
        if (shell && Math.abs(x) > 1.6 && j === F + 2) m = liv.stripe;
        if (shell && Math.abs(x) > 1.7 && (j === F + 3 || j === F + 4) && k > 16 && k < wk1 && k % 2 === 0 && !(k >= DOOR_L2.k0 - 1 && k <= DOOR_L2.k1 + 1)) m = MAT.WIN;
        if (shell && k >= 1 && k <= 6 && j >= F + 4 && j <= F + 6 && y < cy + r - 0.25) m = MAT.WSHIELD;
        if (k <= 1 && r < 0.9) m = MAT.RADOME;
        set(i, j, k, m, k < BULK_K ? PART.COCK : PART.FUS, pressurized && shell);
      }
      if (j === F && !shell && k >= 2 && k < REAR_BULK_K) set(i, j, k, Math.abs(x) < 0.8 && k > BULK_K ? MAT.AISLE : MAT.FLOOR, k < BULK_K ? PART.COCK : PART.FUS);
    }
  }
  // livery: GROK on both sides
  const FONT = { G: '111100101101111', R: '110101110101101', O: '111101101101111', K: '101110100110101' };
  let col = 0;
  for (const ch of 'GROK') { const f = FONT[ch]; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') { const j = F + 9 - r; for (const side of [1, -1]) { const k = side > 0 ? 40 - (col + c) : 25 + col + c; for (let i = 0; i < nx; i++) { const x = cx(i); if (x * side > 1.0 && Math.abs(x) < 2.6) { const id = g.id(i, j, k); if (g.mat[id] === MAT.HULL) g.mat[id] = liv.tail; } } } } col += 4; }
  // door openings L1 / L2 (left side)
  for (const D of [DOOR_L1, DOOR_L2]) for (let k = D.k0; k <= D.k1; k++) for (let j = F + 1; j <= F + 5; j++) for (let i = 0; i < nx; i++) if (cx(i) < -1.6 && g.get(i, j, k)) { g.set(i, j, k, 0); hullA[g.id(i, j, k)] = 0; }
  // cockpit bulkhead with door gap
  for (let j = F + 1; j < NY; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), y = cyJ(j), pr = profJet(COCK_Z, G); if (Math.hypot(x, y - pr[1]) > pr[0] - 0.4) continue;
    if ((i === I(38) || i === I(39)) && j <= F + 5) continue;
    set(i, j, BULK_K, MAT.BULK, PART.COCK);
  }
  for (let k = 4; k <= 5; k++) for (let j = F + 1; j <= F + 3; j++) for (let i = I(33); i <= I(44); i++) { const pr = profJet(czK(k), G); if (Math.hypot(cx(i), cyJ(j) - pr[1]) < pr[0] - 0.5) set(i, j, k, MAT.PANEL, PART.COCK); }
  const seats = ctx.seats = [];
  for (const [i0, x] of [[37, -0.6], [40, 0.6]]) { const i = I(i0); set(i, F + 1, 7, MAT.SEAT, PART.COCK); for (let j = F + 1; j <= F + 3; j++) set(i, j, 8, j === F + 3 ? MAT.HEAD : MAT.SEAT, PART.COCK); seats.push({ x, z: czK(7), y: 0.4, cockpit: true, captain: x < 0, occupant: null, row: -1, mask: -1 }); }
  for (let r = 0; r < ROWS; r++) {
    const k = ROW_K0 + r * 3;
    for (const x of SEAT_X) {
      const i = ix(x); set(i, F + 1, k, MAT.SEAT, PART.INT);
      for (let j = F + 1; j <= F + 3; j++) set(i, j, k + 1, j === F + 3 ? MAT.HEAD : MAT.SEAT, PART.INT);
      seats.push({ x, z: czK(k), y: 0.4, cockpit: false, occupant: null, row: r, mask: -1 });
    }
  }
  for (let k = ROW_K0 - 1; k <= ROW_K0 + ROWS * 3; k++) for (let j = F + 6; j <= F + 7; j++) for (let i = 0; i < nx; i++) { const x = cx(i); if (Math.abs(x) < 1.0) continue; const pr = profJet(czK(k), G); if (Math.hypot(x, cyJ(j) - pr[1]) < pr[0] - 0.5 && !g.get(i, j, k)) set(i, j, k, MAT.BIN, PART.INT); }
  for (let k = 12; k <= 15; k++) for (let j = F + 1; j <= F + 2; j++) for (const i0 of [41, 42, 43]) set(I(i0), j, k, MAT.STEEL, PART.INT);
  for (let k = 58; k <= 63; k++) for (let j = F + 1; j <= F + 2; j++) for (const i0 of [41, 42, 43]) set(I(i0), j, k, MAT.STEEL, PART.INT);
  for (let k = 59; k <= 60; k++) for (let j = F + 3; j <= F + 4; j++) for (const i0 of [42, 43]) set(I(i0), j, k, MAT.OVEN, PART.INT);
  for (let k = 58; k <= 63; k++) for (let j = F + 5; j <= F + 7; j++) for (const i0 of [42, 43]) if (j > F + 5) set(I(i0), j, k, MAT.STEEL, PART.INT);
  for (let j = F + 1; j <= F + 6; j++) {
    for (let i0 = 34; i0 <= 37; i0++) { set(I(i0), j, 60, MAT.LAV, PART.INT); set(I(i0), j, 65, MAT.LAV, PART.INT); }
    for (let k = 60; k <= 65; k++) if (!(k >= 62 && k <= 63 && j <= F + 5)) set(I(37), j, k, MAT.LAV, PART.INT);
  }
  set(I(34), F + 1, 64, MAT.LAV, PART.INT); set(I(35), F + 1, 64, MAT.LAV, PART.INT); set(I(34), F + 2, 64, MAT.LAV, PART.INT);
  // wings (span / sweep / chord per type)
  const jwAt = (ax) => F - 3 + Math.floor(ax / 5);
  for (let i = 0; i < nx; i++) {
    const x = cx(i), ax = Math.abs(x); if (ax > G.span) continue;
    const le = G.le0 + ax * G.sweep, ch = G.ch0 - (G.ch0 - G.chTip) * ax / G.span, jw = jwAt(ax);
    for (let k = 0; k < nz; k++) {
      const z = czK(k); if (z < le || z > le + ch) continue;
      const pr = profJet(z, G); const inside = pr && Math.hypot(x, cyJ(jw) - pr[1]) < pr[0] - 0.3;
      const part = (pr && Math.hypot(x, cyJ(jw) - pr[1]) < pr[0] + 0.3) ? PART.FUS : (x < 0 ? PART.WL : PART.WR);
      const m = z > le + ch * 0.72 && ax > 3 ? MAT.SURF : MAT.WING;
      if (!inside || jw < F) set(i, jw, k, m, part);
      if (ax < 7 || (G.span > 18 && ax < 10)) set(i, jw + 1, k, m, part);
      if (ax >= 5 && (ax % 5) < 0.6 && !g.get(i, jw - 1, k)) set(i, jw - 1, k, m, part);
      // winglets
      if (ax > G.span - 0.45) {
        const part2 = x < 0 ? PART.WL : PART.WR;
        if (G.winglet === 'blend') for (let q = 1; q <= 3; q++) if (z > le + ch * 0.15 * q) set(i, jw + q, k, MAT.WING, part2);
        if (G.winglet === 'shark') for (let q = 1; q <= 5; q++) if (z > le + ch * 0.12 * q + q * 0.08) set(i, jw + q, k, liv.tail, part2);
        if (G.winglet === 'fence') for (const q of [-2, -1, 1, 2]) if (z > le + ch * 0.25) set(i, jw + q, k, q > 0 ? liv.tail : MAT.WING, part2);
      }
    }
  }
  // engines (+ pylons)
  const iXg = ix;
  for (const e0 of G.eng) for (const sgn of [-1, 1]) {
    const ex = e0.x * sgn, ey = e0.y, er = e0.r, part = ex < 0 ? PART.EL : PART.ER;
    const kz0 = kZ(e0.z0), kz1 = kZ(e0.z1);
    for (let k = kz0; k <= kz1; k++) for (let j = 0; j < ny; j++) for (let i = iXg(ex - er - 0.3); i <= iXg(ex + er + 0.3); i++) {
      const y = cyJ(j); const d = Math.hypot(cx(i) - ex, y - ey);
      if (d > er) continue;
      if (G.flatEng && y < ey - er * 0.62) continue;
      if (k === kz0) set(i, j, k, d < 0.3 ? MAT.RADOME : MAT.FAN, part);
      else if (d > er - 0.48) set(i, j, k, k === kz1 ? MAT.FAN : MAT.ENG, part);
    }
    const jw = jwAt(Math.abs(ex));
    // booth #35: the pylon runs back until it overlaps the wing (on the 747/A380 it used to stop short, so the engines were never joined to the
    // wing and the first scrape anywhere made all 4 engines fall off -> no thrust -> crash). It also gets 2 voxels wide so it can't be cut by a nick.
    const leW = G.le0 + Math.abs(ex) * G.sweep, kEnd = Math.max(kZ(e0.z1 + 2.8), kZ(leW + 0.8));
    for (let k = kZ(e0.z0 + 2.6); k <= kEnd; k++) { const jb = k > kZ(e0.z1) ? jY(ey + er - 0.25) : jY(ey + er * 0.55); for (let j = Math.min(jb, jw), j1 = Math.max(jb, jw - 1); j <= j1; j++) for (const i of [iXg(ex), iXg(ex) + (ex < 0 ? 1 : -1)]) { if (!g.get(i, j, k)) set(i, j, k, MAT.ENG, part); } }
  }
  // horizontal stabiliser
  const te = G.tailExt || 0, hsK = G.hsK || 1, hsSpan = 6.2 * hsK;
  for (let i = 0; i < nx; i++) { const x = cx(i), ax = Math.abs(x); if (ax > hsSpan) continue; const le = 12.2 + te + ax * 0.55 - (hsK - 1) * 2.2, ch = (2.8 - ax * 0.2 / hsK) * hsK; for (let k = 0; k < nz; k++) { const z = czK(k); if (z < le || z > le + ch) continue; const j = jY(1.7 + (hsK - 1) * 0.6); if (!g.get(i, j, k)) set(i, j, k, z > le + ch * 0.7 ? MAT.SURF : MAT.HULL, ax > 1.2 ? PART.HS : PART.FUS); } }
  // vertical stabiliser (737: dorsal fin fillet)
  const fk = G.finK || 1;
  for (let j = jY(2.4); j < ny; j++) { const y = cyJ(j); const yy = (y - 2.4) / fk; const le = 9.8 + te + yy * 0.95 * fk - (fk - 1) * 2.5, ch = (4.6 - yy * 0.5) * fk; if (ch < 0.8 * fk) continue; for (let k = 0; k < nz; k++) { const z = czK(k); if (z < le || z > le + ch || z > 16.3 + te * 1.25) continue; for (const i0 of [38, 39]) { const i = I(i0); if (!g.get(i, j, k)) set(i, j, k, y > 2.4 + 4.0 * fk ? MAT.HULL : liv.tail, y > 3.2 ? PART.VS : PART.FUS); } } }
  if (G.flatEng) for (let k = kZ(7.0); k <= kZ(10.5); k++) { const z = czK(k), top = 3.3 + (z - 7.0) * 0.32; for (let j = jY(3.0); j <= jY(top); j++) for (const i0 of [38, 39]) if (!g.get(I(i0), j, k)) set(I(i0), j, k, liv.tail, PART.FUS); }
  return g;
}
// ------------------------------------------------------------ small planes (seats only)
function smallGrid(T, nx, ny, nz, s, ox, oy, oz, ctx) {
  const g = new SKY.VoxGrid(nx, ny, nz, s); g.origin.set(ox, oy, oz); ctx.hull = new Uint8Array(g.n);
  const X = (i) => ox + (i + 0.5) * s, Y = (j) => oy + (j + 0.5) * s, Z = (k) => oz + (k + 0.5) * s;
  const set = (i, j, k, m, p) => { if (g.inb(i, j, k)) g.set(i, j, k, m, p); };
  const at = (x, y, z) => [Math.floor((x - ox) / s), Math.floor((y - oy) / s), Math.floor((z - oz) / s)];
  const put = (x, y, z, m, p) => { const [i, j, k] = at(x, y, z); set(i, j, k, m, p); };
  const fill = (fn) => { for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const r = fn(X(i), Y(j), Z(k)); if (r) set(i, j, k, r[0], r[1]); } };
  return { g, X, Y, Z, set, put, at, fill };
}
function seatBlock(B, x, z, w, mat, cockpit, part) { // cushion + backrest, 0.5 m wide
  for (let xx = x - w / 2 + 0.06; xx < x + w / 2; xx += 0.12) { for (let zz = z - 0.22; zz < z + 0.22; zz += 0.12) for (let y = 0.05; y < 0.42; y += 0.12) B.put(xx, y, zz, mat, part); for (let y = 0.05; y < 1.05; y += 0.12) B.put(xx, y, z + 0.32, y > 0.85 ? MAT.HEAD : mat, part); }
}
function buildCessna(T, ctx) {
  const s = T.S, B = smallGrid(T, 60, 17, 48, s, -7.5, -1.0, -5.3, ctx);
  const red = 67;
  const sect = (z) => { // [halfW, bottom, top] of the fuselage at z
    if (z < -5.0 || z > 6.4) return null;
    if (z < -4.6) return [0.3, 0.25, 0.75];
    if (z < -2.8) { const t = (z + 4.6) / 1.8; return [0.55 + 0.45 * t, 0.0 - 0.3 * t, 0.85 + 0.25 * t]; }
    if (z < 0.8) return [1.0, -0.35, 1.85];
    const t = (z - 0.8) / 5.6; return [1.0 * (1 - 0.82 * t), -0.35 + 1.0 * t, 1.85 - 0.95 * Math.min(1, t * 1.6) + 0.1 * t];
  };
  B.fill((x, y, z) => {
    const p = sect(z);
    if (p) {
      const [hw, b, t] = p; const ax = Math.abs(x); const rc = 0.3;
      let inside = ax <= hw && y >= b && y <= t; if (inside && y > t - rc && ax > hw - rc && Math.hypot(ax - (hw - rc), y - (t - rc)) > rc) inside = false;
      if (inside) {
        const shell = ax > hw - s || y < b + s || y > t - s || z < -4.5 || z > 6.1;
        const cabin = z > -2.8 && z < 0.8;
        if (cabin && Math.abs(y) < s * 0.5 + 0.001 && y < 0) return [MAT.FLOOR, PART.FUS];
        if (!shell && !(z > -2.85 && z < -2.55 && y > 0.4 && y < 1.0)) return null;
        if (z > -2.85 && z < -2.55 && y > 0.4 && y < 1.0 && !shell) return [MAT.PANEL, PART.COCK];
        if (z < -4.6) return [MAT.RADOME, PART.EL];
        if (z < -2.8) return [y > 0.6 ? MAT.HULL : 29, PART.EL];
        if (cabin && ax > hw - s && y > 0.75 && y < 1.55 && z > -2.5 && z < 0.5 && !(z > -1.15 && z < -0.95)) return [MAT.WIN, PART.FUS];
        if (z >= -2.8 && z < -2.2 && y > 0.95) return [MAT.WSHIELD, PART.COCK];
        if (z > 0.8 && z < 1.9 && y > 1.15 && ax < hw - 0.1) return [MAT.WIN, PART.FUS];
        if (ax > hw - s && y > 0.2 && y < 0.5) return [red, PART.FUS];
        return [MAT.HULL, PART.FUS];
      }
    }
    // high wing
    const ax = Math.abs(x);
    if (ax < 7.2 && y >= 1.85 && y < 2.2 && z > -2.65 + ax * 0.01 && z < -0.85 - ax * 0.02) return [ax > 6.6 ? red : (z > -1.3 && ax > 1.2 ? MAT.SURF : MAT.WING), ax < 1.1 ? PART.FUS : (x < 0 ? PART.WL : PART.WR)];
    // struts
    for (const sg of [-1, 1]) { const ax0 = 1.0, y0 = -0.15, ax1 = 3.4, y1 = 1.85; const t = clamp((x * sg - ax0) / (ax1 - ax0), 0, 1); if (x * sg >= ax0 - 0.05 && x * sg <= ax1 + 0.05 && Math.abs(y - (y0 + (y1 - y0) * t)) < 0.16 && Math.abs(z + 1.5) < 0.14) return [56, sg < 0 ? PART.WL : PART.WR]; }
    // h-stab
    if (ax < 2.6 && y > 0.5 && y < 0.72 && z > 5.0 + ax * 0.1 && z < 6.4) return [z > 5.9 ? MAT.SURF : MAT.HULL, ax > 0.6 ? PART.HS : PART.FUS];
    // fin + dorsal
    if (ax < 0.26 && y > 0.9 && y < 3.0) { const le = 4.3 + (y - 0.9) * 0.55; if (z > le && z < 6.5 && !(y > 2.6 && z < le + 0.4)) return [y > 1.9 ? red : MAT.HULL, y > 1.3 ? PART.VS : PART.FUS]; }
    if (ax < 0.26 && y > 0.85 && y < 1.4 && z > 2.6 && z < 4.6 && y < 0.85 + (z - 2.6) * 0.3) return [MAT.HULL, PART.FUS];
    // wheel pants
    for (const [gx, gz] of [[-1.35, 0.25], [1.35, 0.25], [0, -3.9]]) if (Math.abs(x - gx) < 0.2 && y > -1.15 && y < -0.65 && Math.abs(z - gz) < 0.45) return [red, PART.FUS];
    return null;
  });
  const seats = ctx.seats = [];
  for (const [x, z, ck] of [[-0.45, -1.75, true], [0.45, -1.75, true], [-0.45, -0.45, false], [0.45, -0.45, false]]) { seatBlock(B, x, z, 0.62, MAT.SEAT, ck, ck ? PART.COCK : PART.INT); seats.push({ x, z, y: 0.4, cockpit: ck, captain: ck && x < 0, occupant: null, row: ck ? -1 : 0, mask: -1 }); }
  return B.g;
}
function buildBiz(T, ctx) {
  const s = T.S, B = smallGrid(T, 92, 24, 92, s, -13.8, -1.2, -12.9, ctx);
  const Rb = 1.45, CYb = 0.75, gold = 53, navy = 68;
  const prof = (z) => { if (z < -12.6 || z > 12.8) return null; if (z < -8.4) { const t = (-8.4 - z) / 4.2; return [Rb * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))), CYb - 0.35 * t * t]; } if (z > 4.5) { const t = (z - 4.5) / 8.3; return [Rb * (1 - 0.8 * t), CYb + 0.75 * t]; } return [Rb, CYb]; };
  B.fill((x, y, z) => {
    const p = prof(z); const ax = Math.abs(x);
    if (p) {
      const d = Math.hypot(x, y - p[1]);
      if (d <= p[0]) {
        const shell = d > p[0] - s * 1.05 || z > 12.4 || z < -12.3 || (z > 9.6 && z < 9.9);
        if (!shell) { if (Math.abs(y + 0.15) < 0.15 && z > -10.4 && z < 9.6) return [MAT.FLOOR, PART.FUS]; if (z > -10.4 && z < -10.0 && y > 0.4 && y < 1.0) return [MAT.PANEL, PART.COCK]; return null; }
        if (z < -11.4 && y < p[1]) return [MAT.RADOME, PART.COCK];
        if (z > -10.9 && z < -9.6 && y > p[1] + 0.15 && y < p[1] + 1.0 && ax < 1.2) return [MAT.WSHIELD, PART.COCK];
        if (ax > 1.1 && y > 0.75 && y < 1.4 && z > -7.0 && z < 4.2) { const q = ((z + 7.0) % 1.5 + 1.5) % 1.5; if (q > 0.3 && q < 1.0) return [MAT.WIN, PART.FUS]; }
        if (y > p[1] - 0.95 && y < p[1] - 0.6 && ax > 0.9) return [gold, PART.FUS];
        if (y < p[1] - 1.0) return [navy, PART.FUS];
        return [MAT.HULL, z < -9.8 ? PART.COCK : PART.FUS];
      }
    }
    // low swept wing + winglets
    if (ax < 13 && ax > 0.9) { const le = -2.6 + ax * 0.55, ch = 4.4 - ax * 0.23, yw = -0.55 + ax * 0.04; if (z > le && z < le + ch && Math.abs(y - yw) < 0.2) return [z > le + ch * 0.75 && ax > 2.5 ? MAT.SURF : MAT.WING, x < 0 ? PART.WL : PART.WR]; }
    if (ax > 12.6 && ax < 13.2) { const yw = -0.55 + 13 * 0.04; const le = -2.6 + 13 * 0.55; if (y > yw && y < yw + 1.4 && z > le + (y - yw) * 0.6 && z < le + 1.4 + (y - yw) * 0.4) return [gold, x < 0 ? PART.WL : PART.WR]; }
    // rear engines + pylons
    for (const sg of [-1, 1]) { const ex = 2.4 * sg, ey = 1.15; const dd = Math.hypot(x - ex, y - ey); if (z > 4.9 && z < 8.6 && dd < 0.78) { if (z < 5.25) return [dd < 0.25 ? MAT.RADOME : MAT.FAN, sg < 0 ? PART.EL : PART.ER]; if (dd > 0.45) return [z > 8.3 ? MAT.FAN : MAT.ENG, sg < 0 ? PART.EL : PART.ER]; return null; } if (z > 6.0 && z < 8.0 && Math.abs(y - ey) < 0.18 && x * sg > 0.8 && x * sg < ex * sg - 0.5) return [MAT.ENG, sg < 0 ? PART.EL : PART.ER]; }
    // T-tail: fin + stab on top
    if (ax < 0.16 && y > 1.6 && y < 5.4) { const le = 8.4 + (y - 1.6) * 0.95, ch = 3.4 - (y - 1.6) * 0.25; if (z > le && z < le + ch) return [y > 2.4 ? navy : MAT.HULL, y > 2.2 ? PART.VS : PART.FUS]; }
    if (ax < 4.4 && y > 5.05 && y < 5.4) { const le = 11.3 + ax * 0.5, ch = 2.0 - ax * 0.18; if (z > le && z < le + ch) return [z > le + ch * 0.7 ? MAT.SURF : navy, PART.HS]; }
    return null;
  });
  const seats = ctx.seats = [];
  for (const x of [-0.5, 0.5]) { seatBlock(B, x, -9.0, 0.62, MAT.SEAT, true, PART.COCK); seats.push({ x, z: -9.0, y: 0.4, cockpit: true, captain: x < 0, occupant: null, row: -1, mask: -1 }); }
  let row = 0; for (const z of [-6.2, -4.4, -1.2, 0.6, 2.4]) { for (const x of [-0.62, 0.62]) { if (z === 2.4 && x > 0) continue; seatBlock(B, x, z, 0.7, 50, false, PART.INT); seats.push({ x, z, y: 0.4, cockpit: false, occupant: null, row, mask: -1 }); } row++; }
  return B.g;
}
function buildGridT(T, ctx) { if (T.id === 'C172') return buildCessna(T, ctx); if (T.id === 'BIZ') return buildBiz(T, ctx); return buildJet(T, ctx); }
class Plane {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.interior = new THREE.Group(); this.group.add(this.interior);
    this.fxLocal = new SKY.FXSet(this.interior);
    this.consts = { S, F, R, CY, COCK_Z, DOOR_L1, DOOR_L2, ROW_K0, czK, cxI };
    this.mass = 60000; this.I = new THREE.Vector3(3.2e6, 4.0e6, 2.2e6); this.T = TYPES.B737; this.typeId = 'B737'; this.small = false; this.follow = null;
    this.pos = this.group.position; this.quat = this.group.quaternion;
    this.vel = new THREE.Vector3(); this.w = new THREE.Vector3(); this.prevVel = new THREE.Vector3();
    this.acc = new THREE.Vector3(); this.gLocal = new THREE.Vector3(0, -9.81, 0); this.kick = new THREE.Vector3();
    this.dz = { thr: [1, 1], brake: 1, ctl: 1, pack: false, gearJam: false, flapsJam: false, asymK: 1, flame: [] };
    this.buildMeshes(); this.setType('B737');
  }
  // ------------------------------------------------------------------ build
  buildGrid(T) { return buildGridT(T || this.T || TYPES.B737, this); }
  // 4.0: switch aircraft type (rebuilds gear meshes / hides cabin systems on small planes; grid is rebuilt by reset)
  setType(id) {
    const T = TYPES[id] || TYPES.B737; this.T = T; this.typeId = T.id; this.small = T.cls === 'small';
    this.mass = T.mass; this.I.set(T.I[0], T.I[1], T.I[2]);
    if (this.gearGroup) { this.group.remove(this.gearGroup); this.gearGroup = null; }
    if (this.prop) { this.group.remove(this.prop); this.prop = null; }
    this.buildGear();
    for (const o of [this.cdGroup, this.keypadMesh, this.ovenGlow, this.extMarker, this.drawerMarker, this.beltSign]) if (o) o.visible = !this.small;
    for (const d of this.cabinDoors) d.mesh.visible = !this.small;
  }
  buildGear() {
    const T = this.T, gh = T.gearH;
    this.gearGroup = new THREE.Group(); this.group.add(this.gearGroup);
    const strutM = new THREE.MeshLambertMaterial({ color: 0x888c94 }), wheelM = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const small = T.cls === 'small', sc = small ? 0.6 : 1;
    this.gearPts = [];
    T.gear.forEach((g, n) => {
      const gp = new THREE.Vector3(g[0], -gh, g[1]); if (n < 3) this.gearPts.push(gp);
      const sh = gh - (small ? 0.35 : 1.4);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.2 * sc, Math.max(0.3, sh), 0.2 * sc), strutM); s.position.set(gp.x, gp.y + 0.4 * sc + sh / 2, gp.z); this.gearGroup.add(s);
      const dxs = small ? [0] : (n >= 3 ? [-0.3, 0.3] : [-0.3, 0.3]);
      for (const dz of (n > 0 && !small && T.gear.length > 3 ? [-0.5, 0.5] : [0])) for (const dx of dxs) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.3 * sc, 0.8 * sc, 0.8 * sc), wheelM); w.position.set(gp.x + dx, gp.y + 0.4 * sc, gp.z + dz); this.gearGroup.add(w); }
    });
    if (T.id === 'C172') { // spinning propeller
      const pg = new THREE.Group(); pg.position.set(0, 0.5, -5.08);
      const bm = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.06), bm); pg.add(b1);
      const tip = new THREE.MeshLambertMaterial({ color: 0xffd200 });
      for (const sy of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 0.07), tip); t.position.y = sy * 1.08; pg.add(t); }
      this.group.add(pg); this.prop = pg;
    }
  }
  buildMeshes() {
    // cockpit door: 4x10 small cubes
    const dg = new THREE.Group(); dg.position.set(-0.4, 0, COCK_Z + 0.05); this.interior.add(dg); this.cdGroup = dg;
    this.cdMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.12), new THREE.MeshLambertMaterial({ color: 0x8a9099 }), 40);
    const m4 = new THREE.Matrix4(); for (let q = 0; q < 40; q++) { m4.makeTranslation(0.1 + (q % 4) * 0.2, 0.1 + Math.floor(q / 4) * 0.2, 0); this.cdMesh.setMatrixAt(q, m4); }
    dg.add(this.cdMesh);
    const kp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05), new THREE.MeshBasicMaterial({ color: 0x33ff88 })); kp.position.set(0.55, 1.2, COCK_Z + 0.25); this.interior.add(kp); this.keypadMesh = kp;
    // cabin doors
    this.cabinDoors = [];
    for (const D of [DOOR_L1, DOOR_L2]) {
      const m = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, D.z1 - D.z0), new THREE.MeshLambertMaterial({ color: 0xe9edf2 })); p.position.y = 1.0; m.add(p);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x7fc8ff })); win.position.y = 1.4; m.add(win);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0xff3b3b })); h.position.set(0.05, 1.0, 0); m.add(h);
      m.position.set(-2.18, 0, (D.z0 + D.z1) / 2); this.interior.add(m);
      this.cabinDoors.push({ D, mesh: m, open: 0, target: 0, arm: 0, zc: (D.z0 + D.z1) / 2, name: D === DOOR_L1 ? 'front' : 'rear' });
    }
    // oven glow
    this.ovenGlow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.7), new THREE.MeshBasicMaterial({ color: 0x331100 })); this.ovenGlow.position.set(1.18, 1.2, (czK(59) + czK(60)) / 2); this.interior.add(this.ovenGlow);
    // masks (instanced): cups + tubes
    this.maskCup = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0xffd400 }), 90);
    this.maskTube = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 1, 0.025), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }), 90);
    this.maskCup.frustumCulled = false; this.maskTube.frustumCulled = false; this.maskCup.count = 0; this.maskTube.count = 0;
    this.interior.add(this.maskCup); this.interior.add(this.maskTube);
    // extinguisher bracket marker, drawer marker (tiny visuals)
    const ext = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.4), new THREE.MeshLambertMaterial({ color: 0x555555 })); ext.position.set(-1.9, 1.1, czK(59)); this.interior.add(ext); this.extMarker = ext;
    const dr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x8090a0 })); dr.position.set(0.98, 0.55, czK(61) + 0.2); this.interior.add(dr); this.drawerMarker = dr;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0x223322 })); sign.position.set(0, 2.55, -9.6); this.interior.add(sign); this.beltSign = sign;
  }
  // ------------------------------------------------------------------ reset / placement
  reset(opts) {
    if (opts.type && opts.type !== this.typeId) this.setType(opts.type);
    this.follow = null;
    if (this.grid) { this.group.remove(this.grid.group); this.grid.dispose(); }
    this.grid = this.buildGrid(); this.grid.build(this.group);
    this.computeSamples(); this.groundLimits();
    for (const s of this.seats) s.occupant = null;
    this.crashed = false; this.crashT = 0; this.gearDown = true; this.gearBroken = false; this.flaps = 0; this.throttle = 0; this.brake = false;
    this.ap = { on: false, mode: 'off', alt: 2400, hdg: 0, dest: null, by: null, spd: 200 }; this.alphaFloor = 0; this.propA = 0;
    this.pressure = 1; this.decomp = false; this.masksDown = false; this.maskT = 0; this.openings = []; this.leakArea = 0;
    this.fires = []; this.turb = { t: rand(40, 80), on: 0, str: 0 }; this.belt = false;
    this.dz = { thr: [1, 1], brake: 1, ctl: 1, pack: false, gearJam: false, flapsJam: false, asymK: 1, flame: [] }; // 4.1 disasters
    this.cockpitDoor = { hp: 100, locked: true, open: 0, target: 0, broken: false, lockout: 0, cubes: 40, autoClose: 0 };
    this.cdMesh.count = 40; this.cdGroup.visible = !this.small; this.cdGroup.rotation.y = 0;
    if (this.small) { this.cockpitDoor.broken = true; this.cockpitDoor.locked = false; this.cockpitDoor.open = 1; }
    for (const d of this.cabinDoors) { d.open = 0; d.target = 0; d.arm = 0; d.mesh.visible = !this.small; d.mesh.position.x = -2.18; d.mesh.rotation.y = 0; }
    this.code = String(SKY.randi(1000, 9999)); this.codeSpot = SKY.choose(['drawer', 'lav', 'attendant']); this.codeFound = false;
    this.oven = { state: 'idle', t: 0, ing: [], spoiled: false };
    this.connDirty = false; this.wingEff = [1, 1]; this.engEff = [1, 1]; this.hsEff = 1; this.vsEff = 1;
    this.fxLocal.clear(); this.maskCup.count = 0; this.maskTube.count = 0;
    this.stall = false; this.onGround = false; this.integrity = 1; this.alpha = 0; this.dP = 0; this.ambient = 1; this.impactLog = 0; this.maxImpact = 0; this.lastHit = 0;
    this.place(opts.city, opts.mode);
  }
  place(city, mode) {
    this.vel.set(0, 0, 0); this.w.set(0, 0, 0); this.quat.identity();
    const T = this.T, sv = T.vapp / 68;
    if (mode === 'runway') {
      this.pos.set(city.ax, T.gearH + 0.02, city.az + city.rwyLen / 2 - 80); this.throttle = 0; this.gearDown = true; this.flaps = 1;
    } else if (mode === 'approach') {
      const dist = 4200 * Math.max(0.5, sv);
      this.pos.set(city.ax, 330 * Math.max(0.5, sv), city.az + city.rwyLen / 2 + dist); this.vel.set(0, -4.0 * sv, -78 * sv); this.throttle = 0.42; this.gearDown = true; this.flaps = 2;
      this.quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.03);
    } else { // cruise departing city northward
      this.pos.set(city.x + 2000, Math.min(1900, T.alt), city.z + 6000); this.vel.set(0, 0, -T.vcruise * 0.95); this.throttle = 0.6; this.gearDown = !!T.fixedGear; this.flaps = 0;
    }
    this.skipKick = 2;     this.prevVel.copy(this.vel); this.group.updateMatrixWorld(true);
    this.prevSamples = null;
  }
  // booth #35 ground guard: with the wheels down and close to the runway, no tail, engine or wingtip may be rotated into the ground.
  // Each frame we find the lowest non-wheel point of the airframe; if it gets close to the ground, any pitch/roll that would push it
  // lower fades out and a small push lifts it back. Works for every plane and any mix of pitch + bank (rotation, wobbly stick, flare).
  groundLimits() { this.gRest = new Map(); for (const sm of this.samples) this.gRest.set(sm.id, sm.p.y + this.T.gearH); }
  groundGuard(dt, spd) {
    if (!this.gearDown || this.gearBroken || this.follow || spd < 2 || !this.samples.length) return;
    const gH = SKY.World.heightAt(this.pos.x, this.pos.z), alt0 = this.pos.y - gH;
    if (alt0 > this.T.gearH + 14) return;
    const M = this.small ? 0.35 : 0.6, w = this.w, q = this.quat, v = new THREE.Vector3();
    let worst = 1e9, ws = null, wc = 0, wm = M;
    for (const sm of this.samples) {
      v.copy(sm.p).applyQuaternion(q); const c = alt0 + v.y;
      const rest = this.gRest && this.gRest.has(sm.id) ? this.gRest.get(sm.id) : sm.p.y + this.T.gearH;
      const m = clamp(rest * 0.6, 0.05, M); const r = c / m;
      if (r < worst) { worst = r; ws = sm; wc = c; wm = m; }
    }
    if (!ws || worst >= 1) return;
    const rp = ws.p, kk = clamp(worst, 0, 1);
    const gx = v.set(0, -rp.z, rp.y).applyQuaternion(q).y; // how fast the point rises per unit nose-up rate
    const gz = v.set(-rp.y, rp.x, 0).applyQuaternion(q).y; // ... per unit roll rate
    if (w.x * gx < 0) w.x *= kk; if (w.z * gz < 0) w.z *= kk;
    const push = (wm - wc) * 2.2;
    if (gx < 0) w.x += Math.sign(gx) * push * dt * 30 * Math.abs(gx) / (Math.abs(gx) + Math.abs(gz) + 1e-6) * 0.05; // nose-down only (tail points)
    w.z += Math.sign(gz) * push * dt * 30 * Math.abs(gz) / (Math.abs(gx) + Math.abs(gz) + 1e-6) * 0.05;
  }
  computeSamples() {
    const g = this.grid, pts = [];
    const add = (id) => { if (id >= 0 && !pts.includes(id)) pts.push(id); };
    const step = this.small ? 3 : 4;
    for (let i = 0; i < g.nx; i += step) for (let k = 0; k < g.nz; k += step) {
      let lo = -1, hi = -1;
      for (let j = 0; j < g.ny; j++) if (g.get(i, j, k)) { if (lo < 0) lo = g.id(i, j, k); hi = g.id(i, j, k); }
      add(lo); add(hi);
    }
    // extremes
    let ext = { nose: -1, tail: -1, wl: -1, wr: -1, top: -1, nz: 1e9, tz: -1, wlx: 1e9, wrx: -1, ty: -1 };
    g.forEachSolid((id) => { const [i, j, k] = g.ijk(id); if (k < ext.nz) { ext.nz = k; ext.nose = id; } if (k > ext.tz) { ext.tz = k; ext.tail = id; } if (i < ext.wlx) { ext.wlx = i; ext.wl = id; } if (i > ext.wrx) { ext.wrx = i; ext.wr = id; } if (j > ext.ty) { ext.ty = j; ext.top = id; } });
    add(ext.nose); add(ext.tail); add(ext.wl); add(ext.wr); add(ext.top);
    this.samples = pts.map((id) => ({ id, p: g.center(id, new THREE.Vector3()), prev: new THREE.Vector3() }));
  }
  // ------------------------------------------------------------------ helpers
  get fwd() { return _v.set(0, 0, -1).applyQuaternion(this.quat); }
  axes() { return { f: new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat), u: new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat), r: new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat) }; }
  speed() { return this.vel.length(); }
  altitude() { return this.pos.y - this.T.gearH - SKY.World.heightAt(this.pos.x, this.pos.z); }
  gearH() { return this.T.gearH; }
  heading() { const f = this.axes().f; let h = Math.atan2(f.x, -f.z) * 180 / Math.PI; if (h < 0) h += 360; return h; }
  toWorld(p, out) { return (out || new THREE.Vector3()).copy(p).applyQuaternion(this.quat).add(this.pos); }
  toLocal(p, out) { _q.copy(this.quat).invert(); return (out || new THREE.Vector3()).copy(p).sub(this.pos).applyQuaternion(_q); }
  dirToWorld(d, out) { return (out || new THREE.Vector3()).copy(d).applyQuaternion(this.quat); }
  dirToLocal(d, out) { _q.copy(this.quat).invert(); return (out || new THREE.Vector3()).copy(d).applyQuaternion(_q); }
  pointVel(local, out) { // world velocity of a local point
    const r = _v3.copy(local).applyQuaternion(this.quat); const ww = _v2.copy(this.w).applyQuaternion(this.quat);
    return (out || new THREE.Vector3()).copy(ww).cross(r).add(this.vel);
  }
  solidLocal(x, y, z) {
    if (this.grid.solid(x, y, z)) return true;
    if (this.small) return false;
    // cockpit door
    const cd = this.cockpitDoor;
    if (!cd.broken && cd.open < 0.5 && z > COCK_Z - 0.2 && z < COCK_Z + 0.2 && x > -0.45 && x < 0.45 && y > 0 && y < 2.05) return true;
    for (const d of this.cabinDoors) if (d.open < 0.5 && x < -1.72 && x > -2.6 && z > d.D.z0 && z < d.D.z1 && y > -0.05 && y < 2.05) return true;
    return false;
  }
  isOutside(p) {
    if (this.small) { const a = this.T.anchor; return Math.abs(p.x) > (this.T.id === 'C172' ? 1.3 : 1.7) || p.y < -0.8 || p.y > 2.6 || p.z < (this.T.id === 'C172' ? -3.2 : -11) || p.z > (this.T.id === 'C172' ? 1.6 : 10); }
    const pr = this.T.geo ? profJet(p.z, this.T.geo) : profile(p.z); if (!pr) return true; if (p.y < -3.4) return true; return Math.hypot(p.x, p.y - pr[1]) > pr[0] + 0.35;
  }
  inCockpit(p) { return p.z < COCK_Z; }
  // ------------------------------------------------------------------ damage
  damage(local, r, power, fxWorld, interiorFx, maxHp) {
    const rem = this.grid.damageSphere(local, r, power, maxHp);
    if (!rem.length) return rem;
    const n = Math.min(rem.length, SKY.lowSpec ? 12 : 30);
    for (let q = 0; q < n; q++) {
      const e = rem[(q * 7) % rem.length]; _v.set(e.x, e.y, e.z);
      if (interiorFx) this.fxLocal.chip.spawn(e.x, e.y, e.z, rand(-2, 2), rand(0, 3), rand(-2, 2), rand(1.5, 3), S * 0.5, e.col);
      else if (fxWorld) { const wp = this.toWorld(_v); const pv = this.pointVel(_v); fxWorld.chip.spawn(wp.x, wp.y, wp.z, pv.x * 0.85 + rand(-5, 5), pv.y * 0.85 + rand(0, 6), pv.z * 0.85 + rand(-5, 5), rand(2, 4), S * 0.8, e.col); }
    }
    for (const e of rem) {
      if (this.hull[e.id] && e.x < 99) {
        this.hull[e.id] = 0;
        let found = null; for (const o of this.openings) if (o.kind === 'hole' && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 + (o.z - e.z) ** 2 < 1.6) { found = o; break; }
        if (found) found.area += 0.16; else if (this.openings.length < 40) this.openings.push({ x: e.x, y: e.y, z: e.z, area: 0.16, kind: 'hole' });
      }
    }
    if (this.cockpitDoor && !this.cockpitDoor.broken && Math.abs(local.z - COCK_Z) < r + 0.3 && Math.abs(local.x) < r + 0.5 && power > 6) this.hitCockpitDoor(power * 2, true);
    this.connDirty = true;
    return rem;
  }
  hitCockpitDoor(dmg, silent) {
    const cd = this.cockpitDoor; if (cd.broken) return;
    cd.hp -= dmg;
    const want = Math.max(0, Math.round(40 * cd.hp / 100));
    while (this.cdMesh.count > want && this.cdMesh.count > 0) {
      // remove random cube by swapping into end
      const n = this.cdMesh.count, a = Math.floor(Math.random() * n), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
      this.cdMesh.getMatrixAt(a, m1); this.cdMesh.getMatrixAt(n - 1, m2); this.cdMesh.setMatrixAt(a, m2); this.cdMesh.setMatrixAt(n - 1, m1);
      this.cdMesh.count--; this.cdMesh.instanceMatrix.needsUpdate = true;
      const p = new THREE.Vector3().setFromMatrixPosition(m1); this.fxLocal.chip.spawn(p.x - 0.4, p.y, COCK_Z + 0.15, rand(-1, 1), rand(0, 2), rand(0.5, 2), 2, 0.12, 0x8a9099);
    }
    if (cd.hp <= 0) {
      cd.broken = true; cd.locked = false; this.cdGroup.visible = false;
      for (let q = 0; q < 30; q++) this.fxLocal.chip.spawn(rand(-0.4, 0.4), rand(0.1, 2), COCK_Z, rand(-2, 2), rand(0, 3), rand(-4, 1), 3, 0.15, 0x8a9099);
      SKY.Audio.play('crunch'); if (!silent) SKY.toast('💥 The cockpit door gives way!', 'warn');
      if (SKY.Game) SKY.Game.achieve('breach');
    }
  }
  checkDetach(fxWorld) {
    this.connDirty = false;
    const g = this.grid;
    const A = this.T.anchor, o = g.origin, gs = g.s, gnx = g.nx, gny = g.ny;
    const i0 = Math.floor((A[0] - o.x) / gs), i1 = Math.floor((A[1] - o.x) / gs), j0 = Math.floor((A[2] - o.y) / gs), j1 = Math.floor((A[3] - o.y) / gs), k0 = Math.floor((A[4] - o.z) / gs), k1 = Math.floor((A[5] - o.z) / gs);
    const comps = g.floating((id) => { const i = id % gnx, j = ((id / gnx) | 0) % gny, k = (id / (gnx * gny)) | 0; return j >= j0 && j <= j1 && i >= i0 && i <= i1 && k >= k0 && k <= k1; });
    const out = [];
    for (const comp of comps) {
      if (comp.length < 8) { for (const id of comp) { g.center(id, _v); const wp = this.toWorld(_v); if (fxWorld) fxWorld.chip.spawn(wp.x, wp.y, wp.z, this.vel.x + rand(-3, 3), this.vel.y + rand(0, 3), this.vel.z + rand(-3, 3), 3, S, SKY.PAL[g.mat[id]][0]); g.remove(id); } continue; }
      const parts = {}; for (const id of comp) parts[g.part[id]] = (parts[g.part[id]] || 0) + 1;
      const ex = g.extract(comp);
      const m = new THREE.Matrix4().multiplyMatrices(this.group.matrixWorld, new THREE.Matrix4().makeTranslation(ex.offset.x, ex.offset.y, ex.offset.z));
      const center = ex.offset.clone().add(new THREE.Vector3(ex.grid.nx, ex.grid.ny, ex.grid.nz).multiplyScalar(g.s / 2));
      const v = this.pointVel(center).add(new THREE.Vector3(rand(-3, 3), rand(-1, 4), rand(-3, 3)));
      const d = SKY.World.addDebris(ex.grid, m, v, new THREE.Vector3(rand(-1.5, 1.5), rand(-1, 1), rand(-1.5, 1.5)));
      d.fromPlane = true;
      const names = { 1: 'LEFT WING', 2: 'RIGHT WING', 3: 'LEFT ENGINE', 4: 'RIGHT ENGINE', 5: 'TAIL', 6: 'FIN', 0: 'FUSELAGE SECTION', 7: 'COCKPIT', 8: 'CABIN PIECE' };
      let best = 0, bp = 0; for (const p in parts) if (parts[p] > best) { best = parts[p]; bp = +p; }
      if (comp.length > 30) { SKY.toast('⚠ ' + names[bp] + ' DETACHED!', 'bad'); SKY.Audio.play('crunch', 1.4); }
      // bounding box in local space for entity transfer
      out.push({ min: ex.offset.clone(), max: ex.offset.clone().add(new THREE.Vector3(ex.grid.nx, ex.grid.ny, ex.grid.nz).multiplyScalar(g.s)), size: comp.length, part: bp });
      // fires where parts tore off
      if (comp.length > 30 && this.fires.length < 8) this.fires.push({ x: center.x, y: center.y, z: center.z, hp: 6, ext: true, t: 0 });
    }
    // re-evaluate samples whose cells died
    this.samples = this.samples.filter((s) => g.mat[s.id]);
    if (this.samples.length < 30) this.computeSamples();
    return out;
  }
  partEff() {
    const g = this.grid, pc = g.partCount, p0 = g.partCount0;
    const r = (p) => p0[p] ? pc[p] / p0[p] : 1;
    this.wingEff[0] = r(PART.WL); this.wingEff[1] = r(PART.WR); this.engEff[0] = r(PART.EL); this.engEff[1] = r(PART.ER);
    if (!p0[PART.ER]) this.engEff[1] = this.engEff[0];
    this.hsEff = r(PART.HS); this.vsEff = r(PART.VS);
    this.integrity = g.count / g.count0;
  }
  // ------------------------------------------------------------------ flight physics
  update(dt, ctl, fxWorld) {
    const W = SKY.World, TT = this.T;
    if (this.follow) { this.followStep(dt); return; }
    this.partEff();
    if (TT.fixedGear) this.gearDown = true;
    const DZ = this.dz; if (DZ.gearJam) this.gearDown = false; // 4.1 disasters: gear stuck up until cranked down
    if (this.prop) { this.propA += dt * (8 + this.throttle * 60) * (this.crashed ? 0 : 1); this.prop.rotation.z = this.propA; }
    const { f, u, r } = this.axes();
    const spd = this.vel.length();
    const rhoF = Math.max(0.3, Math.exp(-this.pos.y / 5500));
    let alpha = 0, beta = 0;
    if (spd > 1) { alpha = Math.atan2(-this.vel.dot(u), this.vel.dot(f)); beta = Math.atan2(this.vel.dot(r), this.vel.dot(f)); }
    this.alpha = alpha;
    const wEff = (this.wingEff[0] + this.wingEff[1]) / 2;
    // lift coefficient with stall
    const AST = 0.27; let cl;
    const aa = Math.abs(alpha);
    if (aa < AST) cl = 0.25 + 5.2 * alpha; else cl = Math.sign(alpha) * (0.25 + 5.2 * AST) * Math.max(0.25, 1 - (aa - AST) * 2.5);
    if (aa > Math.PI / 2) cl = 0;
    cl += this.flaps * 0.32;
    this.stall = aa > AST && spd > 20 && !this.onGround;
    const q = TT.qk * rhoF * spd * spd;
    const F = _v.set(0, -SKY.GRAV * this.mass, 0);
    if (spd > 1) {
      const vdir = _v2.copy(this.vel).divideScalar(spd);
      const liftDir = _v3.copy(u).addScaledVector(vdir, -u.dot(vdir)); if (liftDir.lengthSq() > 1e-6) liftDir.normalize();
      F.addScaledVector(liftDir, q * 0.55 * cl * wEff);
      const cd = 0.03 + TT.cd0 + 0.03 * cl * cl + (this.gearDown ? 0.018 : 0) + this.flaps * 0.025 + Math.abs(beta) * 0.25 + (1 - this.integrity) * 0.15 + (aa > 0.5 ? 0.6 : 0);
      F.addScaledVector(vdir, -q * cd);
      F.addScaledVector(r, -this.vel.dot(r) * TT.qk * rhoF * spd * 0.25);
    }
    const engE = (this.engEff[0] * DZ.thr[0] + this.engEff[1] * DZ.thr[1]) / 2;
    const thrust = this.throttle * TT.thrust * engE * (0.55 + 0.45 * rhoF) * (this.crashed ? 0 : 1);
    F.addScaledVector(f, thrust);
    // turbulence
    const T = this.turb; T.t -= dt;
    if (T.t <= 0 && !this.onGround && this.pos.y > 800) { if (T.on > 0) { T.on = 0; T.t = rand(60, 120); } else { T.on = rand(6, 10); T.str = rand(0.5, 1.2); T.t = T.on; if (SKY.Game) SKY.Game.onTurbulence(T.str); } }
    if (T.on > 0 && !this.onGround && this.pos.y > 300) { F.y += Math.sin(performance.now() * 0.013) * rand(0, 1) * this.mass * 4.5 * T.str; this.w.z += rand(-0.25, 0.25) * dt * T.str; this.w.x += rand(-0.15, 0.15) * dt * T.str; }
    else if (T.on > 0 && this.onGround) { T.on = 0; T.t = rand(60, 120); }
    this.vel.addScaledVector(F, dt / this.mass);
    // ---- rotation control (local rates) ----
    const ctrl = clamp(spd / TT.vref, 0, 1.3) * Math.sqrt(rhoF);
    let pitchRate = ctl.pitch * TT.rates[0] * this.hsEff * DZ.ctl, rollRate = -ctl.roll * TT.rates[1] * Math.min(this.wingEff[0], this.wingEff[1]) ** 0.5 * DZ.ctl; const yawRate = -ctl.yaw * TT.rates[2] * this.vsEff * DZ.ctl;
    if (TT.fbw && !this.crashed && !this.onGround) { // Airbus-style protections: bank 67° max (back to 33° hands-off), pitch +30/-15°, ALPHA FLOOR
      const bank = Math.asin(clamp(-r.y, -1, 1)), pit = Math.asin(clamp(f.y, -1, 1));
      if (Math.abs(ctl.roll || 0) < 0.1 && Math.abs(bank) > 0.58) rollRate = Math.sign(bank) * 0.18;
      if (Math.abs(bank) > 1.17 && rollRate * Math.sign(bank) < 0) rollRate = Math.sign(bank) * 0.25;
      if (pit > 0.52 && pitchRate > 0) pitchRate = 0; if (pit < -0.26 && pitchRate < 0) pitchRate = 0;
      if (alpha > AST * 0.85 && spd > 20) { pitchRate = Math.min(pitchRate, -0.12); this.throttle = 1; if (this.alphaFloor <= 0) { SKY.toast('🛡 ALPHA FLOOR — fly-by-wire lowered the nose and set TOGA thrust', 'warn'); } this.alphaFloor = 4; }
    }
    this.alphaFloor = Math.max(0, (this.alphaFloor || 0) - dt);
    const k = Math.min(1, TT.resp * 2.5 * dt * ctrl);
    const w = this.w;
    if (!this.crashed) {
      w.x += (pitchRate - w.x) * k; w.z += (rollRate - w.z) * k; w.y += (yawRate - w.y) * k * 0.6;
      this.groundGuard(dt, spd);
    }
    // aero stability: nose follows velocity
    if (spd > 10) {
      w.x += -alpha * 0.9 * ctrl * dt * (this.onGround ? 0 : 1) * (0.4 + 0.6 * this.hsEff);
      w.y -= beta * 1.2 * ctrl * dt * (0.3 + 0.7 * this.vsEff);
      // asymmetric lift
      const asym = (this.wingEff[1] - this.wingEff[0]) * q * 0.55 * Math.abs(cl) / (this.mass * 9.81) * 2.5;
      w.z += asym * dt;
      // engine asymmetry yaw
      w.y += (this.engEff[1] * DZ.thr[1] - this.engEff[0] * DZ.thr[0]) * this.throttle * 0.25 * dt * DZ.asymK;
      if (this.stall) { w.x -= 0.7 * dt; w.z += (Math.random() - 0.5) * 0.8 * dt; }
    }
    w.multiplyScalar(1 - (this.crashed ? 0.2 : 0.3) * dt);
    // ---- integrate ----
    this.pos.addScaledVector(this.vel, dt);
    const wl = w.length(); if (wl > 1e-6) { _q.setFromAxisAngle(_v.copy(w).divideScalar(wl), wl * dt); this.quat.multiply(_q).normalize(); }
    // ---- ground contacts ----
    this.contacts(dt, ctl, fxWorld);
    // ---- buildings ----
    this.buildingHits(dt, fxWorld);
    if (this.connDirty) { this.lastDetach = this.checkDetach(fxWorld); } else this.lastDetach = null;
    // apparent gravity for interior (local frame)
    if (this.skipKick > 0) { this.skipKick--; this.prevVel.copy(this.vel); }
    this.acc.subVectors(this.vel, this.prevVel).divideScalar(dt);
    this.prevVel.copy(this.vel);
    const appW = _v.set(0, -SKY.GRAV, 0).sub(this.acc);
    const lim = 9.81 * 4; const extra = appW.length() > lim ? appW.length() - lim : 0;
    if (extra > 0) { this.kick.copy(appW).setLength(Math.min(extra * dt, 30)); appW.setLength(lim); } else this.kick.set(0, 0, 0);
    this.dirToLocal(appW, this.gLocal);
    this.dirToLocal(this.kick, this.kick);
    this.group.updateMatrixWorld(true);
    // fires
    for (const fi of this.fires) {
      fi.t += dt;
      if (Math.random() < (SKY.lowSpec ? 0.4 : 0.8)) {
        _v.set(fi.x + rand(-0.3, 0.3), fi.y, fi.z + rand(-0.3, 0.3));
        if (fi.ext) { const wp = this.toWorld(_v); fxWorld.fire.spawn(wp.x, wp.y, wp.z, rand(-1, 1), rand(1, 3), rand(-1, 1), rand(0.4, 0.9), rand(0.6, 1.4), Math.random() < 0.5 ? 0xff7a1a : 0xffc23d); if (Math.random() < 0.5) fxWorld.smoke.spawn(wp.x, wp.y + 1, wp.z, rand(-1, 1), rand(2, 4), rand(-1, 1), rand(3, 6), 1.5, 0x333333); }
        else { this.fxLocal.fire.spawn(_v.x, _v.y, _v.z, rand(-0.2, 0.2), rand(0.3, 0.8), rand(-0.2, 0.2), rand(0.3, 0.6), rand(0.15, 0.3), Math.random() < 0.5 ? 0xff7a1a : 0xffc23d); if (Math.random() < 0.4) this.fxLocal.smoke.spawn(_v.x, _v.y + 0.3, _v.z, rand(-0.2, 0.2), rand(0.3, 0.6), rand(-0.2, 0.2), rand(2, 4), 0.3, 0x444444); }
      }
    }
    this.fires = this.fires.filter((fi) => fi.hp > 0);
  }
  contacts(dt, ctl, fxWorld) {
    const W = SKY.World; const m = this.mass, I = this.I;
    this.onGround = false; let maxPen = 0; let gearContact = 0;
    const qinv = _q.copy(this.quat).invert().clone();
    const r = new THREE.Vector3(), n = new THREE.Vector3(0, 1, 0), vp = new THREE.Vector3(), rl = new THREE.Vector3(), nl = new THREE.Vector3(), tmp = new THREE.Vector3(), J = new THREE.Vector3();
    const wWorld = new THREE.Vector3();
    const applyImp = (Jw, rw) => {
      this.vel.addScaledVector(Jw, 1 / m);
      rl.copy(rw).applyQuaternion(qinv); tmp.copy(Jw).applyQuaternion(qinv);
      const t = rl.clone().cross(tmp); this.w.x += t.x / I.x; this.w.y += t.y / I.y; this.w.z += t.z / I.z;
    };
    const effMass = (rw, dir) => { rl.copy(rw).applyQuaternion(qinv); nl.copy(dir).applyQuaternion(qinv); const c = rl.clone().cross(nl); c.x /= I.x; c.y /= I.y; c.z /= I.z; return 1 / m + c.cross(rl).dot(nl); };
    const pts = [];
    if (this.gearDown && !this.gearBroken) for (const gp of this.gearPts) pts.push({ l: gp, gear: true });
    for (const s of this.samples) pts.push({ l: s.p, gear: false, s });
    const f = this.axes().f;
    let worst = 0, worstPt = null, water = false;
    for (const P of pts) {
      r.copy(P.l).applyQuaternion(this.quat);
      const wx = this.pos.x + r.x, wy = this.pos.y + r.y, wz = this.pos.z + r.z;
      const h = W.heightAt(wx, wz);
      if (wy >= h) continue;
      const pen = h - wy; if (pen > maxPen) maxPen = pen;
      wWorld.copy(this.w).applyQuaternion(this.quat);
      vp.copy(wWorld).cross(r).add(this.vel);
      const vn = vp.y;
      if (P.gear) gearContact++; else this.onGround = this.onGround || true;
      if (!P.gear) { const imp = Math.max(-vn, 0) + (vp.length() > 25 ? vp.length() * 0.08 : 0); if (imp > worst) { worst = imp; worstPt = P; } }
      else if (-vn > 7.5) { this.gearBroken = true; SKY.toast('⚠ Landing gear collapsed!', 'bad'); SKY.Audio.play('crunch'); }
      if (vn < 0) {
        const em = effMass(r, n); const j = -(1 + (P.gear ? 0.0 : 0.15)) * vn / em;
        J.copy(n).multiplyScalar(j); applyImp(J, r);
        // friction
        vp.copy(this.w).applyQuaternion(this.quat).cross(r).add(this.vel); vp.y = 0;
        if (P.gear) {
          const fh = tmp.copy(f); fh.y = 0; fh.normalize();
          const vf = vp.dot(fh); const side = vp.clone().addScaledVector(fh, -vf);
          const brake = (this.brake || this.throttle < 0.04) ? Math.max(0.012, 0.35 * this.dz.brake) : 0.012;
          const jf = Math.min(Math.abs(vf) / effMass(r, fh), brake * j) * Math.sign(vf);
          applyImp(fh.clone().multiplyScalar(-jf), r);
          const sl = side.length(); if (sl > 1e-4) { side.divideScalar(sl); const js = Math.min(sl / effMass(r, side), 0.9 * j); applyImp(side.multiplyScalar(-js), r); }
        } else {
          const vt = vp.length(); if (vt > 1e-4) { vp.divideScalar(vt); const jt = Math.min(vt / effMass(r, vp), 0.45 * j); applyImp(vp.multiplyScalar(-jt), r); }
        }
      }
      if (W.isWater(wx, wz)) water = true;
    }
    if (maxPen > 0) this.pos.y += maxPen * 0.6;
    if (gearContact) {
      this.onGround = true;
      // nose wheel steering
      const spd = this.vel.length(); const steer = clamp((ctl.yaw || 0) + (ctl.roll || 0) * 0.7, -1, 1);
      const tgt = -steer * 0.35 * clamp(spd / 6, 0, 1) * clamp(30 / Math.max(spd, 1), 0.2, 1);
      this.w.y += (tgt - this.w.y) * Math.min(1, 6 * dt);
      this.w.z *= (1 - 4 * dt);
    }
    // impacts
    const spd = this.vel.length();
    if (worstPt) {
      const pl = worstPt.l;
      if (water && spd > 25 && !this.crashed) { this.crash(pl, fxWorld, 'ditched'); }
      else if (worst > 14 && !this.crashed) this.crash(pl, fxWorld, 'ground');
      else if (worst > 3) {
        const now = performance.now();
        const rr = 0.5 + worst * 0.09;
        this.damage(pl, rr, worst * 0.6, fxWorld, false);
        if (now - this.lastHit > 150) { SKY.Audio.play('crunch', Math.min(1.5, worst / 8)); this.lastHit = now; }
        if (worst > this.maxImpact) this.maxImpact = worst;
        if (SKY.Game) SKY.Game.shake(worst * 0.03);
      }
      if (this.crashed && worst > 4) { this.damage(pl, 0.6 + worst * 0.12, worst * 0.8, fxWorld, false); }
    }
    if (gearContact && water && spd > 8 && !this.crashed) this.crash(this.gearPts[1], fxWorld, 'ditched');
    if (this.gearBroken && gearContact === 0 && this.onGround && spd > 30 && Math.random() < 0.05 && fxWorld) { const wp = this.toWorld(_v.set(0, -1.6, 2)); for (let q = 0; q < 3; q++) fxWorld.fire.spawn(wp.x + rand(-1, 1), 0.3, wp.z, rand(-3, 3), rand(1, 3), rand(-3, 3), 0.4, 0.4, 0xffd23d); }
  }
  crash(localPt, fxWorld, kind) {
    const spd = this.vel.length();
    this.crashed = true; this.crashKind = kind; this.crashT = 0; this.throttle = 0;
    const rr = clamp(2 + spd * 0.035, 2, 7);
    this.damage(localPt, rr, 25, fxWorld, false);
    const wp = this.toWorld(localPt);
    if (kind === 'ditched') { SKY.Audio.play('splash'); for (let q = 0; q < 60; q++) fxWorld.chip.spawn(wp.x, 0.5, wp.z, rand(-12, 12), rand(5, 22), rand(-12, 12), rand(1.5, 3), rand(0.5, 1.2), q % 2 ? 0xffffff : 0x7fc8ff); }
    else { SKY.Audio.play('boom'); for (let q = 0; q < 40; q++) fxWorld.fire.spawn(wp.x + rand(-3, 3), wp.y + rand(0, 3), wp.z + rand(-3, 3), rand(-6, 6), rand(2, 10), rand(-6, 6), rand(0.8, 1.6), rand(1.5, 3), q % 2 ? 0xff7a1a : 0xffd23d); for (let q = 0; q < 20; q++) fxWorld.smoke.spawn(wp.x + rand(-4, 4), wp.y + rand(0, 4), wp.z + rand(-4, 4), rand(-2, 2), rand(2, 5), rand(-2, 2), rand(5, 9), 3, 0x2a2a2a); }
    // engines burn
    for (const e of this.T.engines) if (this.fires.length < 8) this.fires.push({ x: e[0], y: e[1], z: e[2], hp: 6, ext: true, t: 0 });
    // wing stress: big impacts shear off wings / tail
    if (spd > 55) {
      const sw = this.T.spanW * 0.58, sm = this.small;
      for (const pt of (sm ? [[-sw, this.T.id === 'C172' ? 2 : -0.4, -1.5], [sw, this.T.id === 'C172' ? 2 : -0.4, -1.5], [0, 1.6, this.T.id === 'C172' ? 5.4 : 10]] : [[-sw, -1.2, 1], [sw, -1.2, 1], [0, 2.2, 13 + (this.T.geo.tailExt || 0)]])) if (Math.random() < 0.75) this.damage(new THREE.Vector3(pt[0], pt[1], pt[2]), sm ? 0.9 : 1.4, 30, fxWorld, false);
      if (spd > 80) this.damage(new THREE.Vector3(0, sm ? 0.6 : 1, sm ? rand(-2, 1) : rand(-4, 6)), sm ? 1.2 : 2.2, 30, fxWorld, false);
    }
    if (SKY.Game) SKY.Game.onCrash(kind, spd);
  }
  buildingHits(dt, fxWorld) {
    const W = SKY.World; const spd = this.vel.length();
    if (this.pos.y > 700) { this.prevSamples = null; return; }
    const nc = W.nearestCity(this.pos.x, this.pos.z); if (nc.dist > 6500) { this.prevSamples = null; return; }
    // broadphase
    const R0 = 18 + spd * dt;
    let near = false; for (const s of nc.city.structs) if (this.pos.x + R0 > s.min.x && this.pos.x - R0 < s.max.x && this.pos.y + R0 > s.min.y && this.pos.y - R0 < s.max.y && this.pos.z + R0 > s.min.z && this.pos.z - R0 < s.max.z) { near = true; break; }
    if (W.saucer && W.saucer.st.city === nc.city) { const s = W.saucer.st; if (this.pos.distanceTo(s.min) < 60) near = true; }
    const cur = this.samples.map((s) => this.toWorld(s.p));
    if (near && this.prevSamples && this.prevSamples.length === cur.length) {
      let hit = null, hs = null;
      for (let i = 0; i < cur.length; i += 1) { const h = W.segmentHit(this.prevSamples[i], cur[i]); if (h && (!hit || h.dist < hit.dist)) { hit = h; hs = this.samples[i]; } }
      if (hit) {
        const rel = spd;
        const removed = W.damage(hit.point, clamp(rel / 9, 3, 12), clamp(rel / 3, 2, 40), this.vel, fxWorld);
        SKY.Audio.play('crunch', 1.5);
        if (SKY.Game) SKY.Game.shake(Math.min(1.2, rel / 60));
        if (rel > 28 && !this.crashed) this.crash(hs.p, fxWorld, 'building');
        else { this.damage(hs.p, clamp(rel / 20, 0.6, 4), rel * 0.5, fxWorld, false); }
        // momentum loss
        const loss = clamp(removed * 0.004 + 0.05, 0.05, 0.6);
        this.vel.multiplyScalar(1 - loss);
        if (rel < 28) { this.vel.addScaledVector(hit.n, -Math.min(0, this.vel.dot(hit.n)) * 1.2); this.pos.addScaledVector(hit.n, 0.3); }
      }
    }
    this.prevSamples = cur;
  }
  // ------------------------------------------------------------------ cabin systems
  updateCabin(dt, fxWorld) {
    // doors anim
    for (const d of this.cabinDoors) {
      d.open += clamp(d.target - d.open, -dt * 1.5, dt * 1.5);
      d.mesh.position.x = -2.18 - d.open * 0.6; d.mesh.rotation.y = d.open * 1.4; d.mesh.position.z = d.zc - d.open * 0.5;
      d.arm = Math.max(0, d.arm - dt);
    }
    const cd = this.cockpitDoor;
    if (cd.autoClose > 0) { cd.autoClose -= dt; if (cd.autoClose <= 0) cd.target = 0; }
    cd.open += clamp(cd.target - cd.open, -dt * 2, dt * 2); this.cdGroup.rotation.y = cd.open * 1.6;
    cd.lockout = Math.max(0, cd.lockout - dt);
    this.keypadMesh.material.color.setHex(cd.broken ? 0x333333 : cd.locked ? (cd.lockout > 0 ? 0xff3333 : 0xffaa33) : 0x33ff88);
    // openings from doors
    this.openings = this.openings.filter((o) => o.kind !== 'door');
    for (const d of this.cabinDoors) if (d.open > 0.3) this.openings.push({ x: -2.3, y: 1.0, z: d.zc, area: 2.4 * d.open, kind: 'door' });
    this.leakArea = this.openings.reduce((a, o) => a + o.area, 0);
    // pressure
    const ft = SKY.toFeet(this.pos.y);
    const amb = ft < 9000 ? 1 : clamp(1 - (ft - 9000) / 31000 * 0.75, 0.22, 1);
    this.ambient = amb;
    const prev = this.pressure;
    if (this.leakArea > 0.01 || this.dz.pack) this.pressure += (amb - this.pressure) * Math.min(1, Math.max(this.leakArea * 0.35, this.dz.pack ? 0.3 : 0) * dt); // 4.1: pressurisation failure
    else this.pressure += (1 - this.pressure) * Math.min(1, 0.08 * dt);
    if (amb >= 0.99 && this.pressure < 1 && !this.dz.pack) this.pressure = Math.min(1, this.pressure + 0.04 * dt);
    this.dP = Math.max(0, (prev - this.pressure) / dt); // drop rate
    const wasDecomp = this.decomp;
    this.decomp = this.pressure < 0.78;
    if (this.decomp && !wasDecomp && SKY.Game) SKY.Game.onDecompression();
    if (this.decomp && !this.masksDown) { this.masksDown = true; this.maskT = 0; SKY.Audio.play('chime'); }
    if (this.masksDown) this.maskT += dt;
    // oven
    const ov = this.oven;
    if (ov.state === 'cooking') {
      ov.t += dt;
      if (ov.t > 16 && !this.fires.some((f) => !f.ext)) { ov.state = 'fire'; this.fires.push({ x: 1.3, y: 1.3, z: czK(59) + 0.2, hp: 4, ext: false, t: 0 }); SKY.toast('🔥 The oven is on fire! Grab the extinguisher!', 'bad'); SKY.Audio.play('error'); }
      if (ov.t > 7 && ov.t - dt <= 7) SKY.Audio.play('ding');
    }
    if (ov.state === 'fire' && !this.fires.some((f) => !f.ext)) { ov.state = 'idle'; ov.ing = []; SKY.toast('Fire out. The meal is charcoal.', ''); }
    const glow = ov.state === 'cooking' ? (ov.t > 10 ? 0xff3300 : ov.t > 7 ? 0x55ff55 : 0xff9900) : ov.state === 'fire' ? 0xff2200 : 0x331100;
    this.ovenGlow.material.color.setHex(glow);
    this.beltSign.material.color.setHex(this.belt ? ((performance.now() / 500 | 0) % 2 ? 0xffee55 : 0xaa9922) : 0x223322);
    this.fxLocal.update(dt, this.gLocal, (x, y, z) => (this.solidLocal(x, y - 0.05, z) ? y : (y < 0.02 && Math.abs(x) < 1.6 && !this.isOutside({ x, y: 0.5, z }) && this.grid.solid(x, -0.2, z) ? 0.02 : null)));
  }
  // suction acceleration at a local point (for people/props)
  suction(p, out) {
    out.set(0, 0, 0);
    if (!this.openings.length) return out;
    const spd = this.vel.length();
    const surge = clamp(this.dP * 25, 0, 60) + (this.decomp ? 1.5 : 0);
    const wind = clamp((spd - 40) / 120, 0, 1) * 3.6;
    for (const o of this.openings) {
      const dx = o.x - p.x, dy = o.y - p.y, dz = o.z - p.z; const d2 = dx * dx + dy * dy + dz * dz; const d = Math.sqrt(d2) + 1e-3;
      const sMag = (surge * o.area * 2.2 + wind * Math.min(o.area, 2.4)) / (d2 * 0.35 + 1);
      out.x += dx / d * sMag; out.y += dy / d * sMag; out.z += dz / d * sMag;
    }
    return out;
  }
  updateMasks(people, dt) {
    if (!this.masksDown) { this.maskCup.count = 0; this.maskTube.count = 0; return; }
    const drop = clamp(this.maskT / 0.7, 0, 1);
    let n = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const sway = Math.sin(performance.now() * 0.004);
    for (let si = 0; si < this.seats.length && n < 90; si++) {
      const s = this.seats[si];
      const anchor = new THREE.Vector3(s.x, s.cockpit ? 2.3 : 2.15, s.z + 0.05);
      let cup;
      const user = s.occupant && s.occupant.masked ? s.occupant : null;
      if (user && user.headPos) cup = user.headPos.clone().add(new THREE.Vector3(0, -0.05, -0.14));
      else cup = anchor.clone().add(new THREE.Vector3(sway * 0.05 * drop + this.gLocal.x * -0.01, -0.85 * drop, this.gLocal.z * -0.01 + Math.cos(si) * 0.03));
      m4.makeTranslation(cup.x, cup.y, cup.z); this.maskCup.setMatrixAt(n, m4);
      const dir = cup.clone().sub(anchor); const len = dir.length(); q.setFromUnitVectors(up, dir.clone().normalize().negate());
      sc.set(1, Math.max(0.01, len), 1); m4.compose(anchor.clone().addScaledVector(dir, 0.5), q, sc); this.maskTube.setMatrixAt(n, m4);
      s.mask = n; s.maskPos = cup; n++;
    }
    this.maskCup.count = n; this.maskTube.count = n;
    this.maskCup.instanceMatrix.needsUpdate = true; this.maskTube.instanceMatrix.needsUpdate = true;
  }
  // ------------------------------------------------------------------ autopilot
  autopilot(dt, mode) {
    const ap = this.ap; const { f, u, r } = this.axes();
    const spd = this.vel.length(); const pitch = Math.asin(clamp(f.y, -1, 1)); const bank = Math.asin(clamp(-r.y, -1, 1));
    const hdg = Math.atan2(f.x, -f.z);
    const out = { pitch: 0, roll: 0, yaw: 0 };
    let tHdg = ap.hdg;
    if (ap.dest) { tHdg = Math.atan2(ap.dest.x - this.pos.x, -(ap.dest.z - this.pos.z)); const dd = Math.hypot(ap.dest.x - this.pos.x, ap.dest.z - this.pos.z); if (dd < 3500) tHdg = hdg + 0.35; }
    let tAlt = ap.alt; if (this.decomp || this.pressure < 0.9) tAlt = Math.min(tAlt, SKY.feetToY(9000));
    const TT = this.T; let tSpd = this.pos.y < Math.min(900, TT.alt * 0.75) ? TT.vclimb : TT.vcruise;
    // ground modes: hold (parked / waiting), taxi (pure-pursuit along an airport route), takeoff (explicit only)
    if (ap.mode === 'taxi' && this.onGround) { const c = SKY.Airport ? SKY.Airport.taxiCtl(this, dt) : out; if (ap.mode === 'taxi') return c; }
    if (this.onGround && ap.mode !== 'takeoff') { ap.mode = 'hold'; this.throttle = 0; this.brake = true; out.yaw = 0; return out; }
    if (ap.mode === 'takeoff') { out.yaw = clamp(-((this.pos.x - (ap.rwyX ?? this.pos.x)) * 0.04) - wrap(ap.hdg - hdg) * -2, -1, 1);
      this.throttle = 1; this.brake = false; this.flaps = 1;
      if (spd > TT.vr) out.pitch = clamp((TT.rotPitch - pitch) * 3, -1, 1);
      if (this.altitude() > 25 && !TT.fixedGear) { this.gearDown = false; }
      if (this.altitude() > (this.small ? 150 : 250)) { ap.mode = 'climb'; this.flaps = 0; }
      return out;
    }
    const err = wrap(tHdg - hdg);
    const tBank = clamp(-err * 1.4, -0.45, 0.45) * -1;
    out.roll = clamp((tBank - bank) * 2.2 - this.w.z * -0.3, -1, 1);
    const tVS = clamp((tAlt - this.pos.y) * 0.06, -TT.vsMax, TT.vsMax * 0.64);
    const kv = clamp(Math.sqrt(70 / TT.vref), 0.9, 1.7);
    const tPitch = clamp(0.03 + ((tVS - this.vel.y) * 0.015 + tVS * 0.012) * kv, -0.22, 0.25);
    out.pitch = clamp((tPitch - pitch) * 4 / Math.max(0.5, Math.cos(bank)), -1, 1);
    this.throttle = clamp(this.throttle + ((tSpd - spd) * 0.02 - (this.throttle - 0.55) * 0.05) * dt * 3, 0.05, 1);
    if (TT.fixedGear && tAlt - this.pos.y > 60 && spd > TT.vr) this.throttle = Math.max(this.throttle, 0.95); // props climb at full power
    if (this.gearDown && this.altitude() > 60 && !TT.fixedGear) this.gearDown = false;
    return out;
  }
  // 4.0 co-op: this plane mirrors a friend's plane (we ride along) — pose comes from the net interpolation
  followStep(dt) {
    const f = this.follow; this.partEff();
    if (f.ok) { this.pos.copy(f.p); this.quat.copy(f.q); this.vel.copy(f.v); this.throttle = f.th || 0; this.gearDown = f.gr !== 0; this.flaps = f.fl || 0; }
    if (this.prop) { this.propA += dt * (8 + this.throttle * 60); this.prop.rotation.z = this.propA; }
    this.onGround = this.altitude() < 0.5;
    if (this.skipKick > 0) { this.skipKick--; this.prevVel.copy(this.vel); }
    const a = _v2.subVectors(this.vel, this.prevVel).divideScalar(dt); this.prevVel.copy(this.vel);
    if (a.length() > 40) a.setLength(40);
    this.acc.lerp(a, 0.08);
    const appW = _v.set(0, -SKY.GRAV, 0).sub(this.acc); if (appW.length() > 9.81 * 3) appW.setLength(9.81 * 3);
    this.dirToLocal(appW, this.gLocal); this.kick.set(0, 0, 0);
    this.lastDetach = null; this.stall = false;
    this.group.updateMatrixWorld(true);
  }
}
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
SKY.wrapAngle = wrap;
SKY.Plane = Plane;
Plane.buildGridFor = (id) => buildGridT(TYPES[id] || TYPES.B737, {});
SKY.PlaneConst = { S, F, R, CY, COCK_Z, DOOR_L1, DOOR_L2, czK, cxI, profile, ROW_K0 };
})();

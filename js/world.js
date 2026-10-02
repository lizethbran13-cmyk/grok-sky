'use strict';
// GROK SKY - world: terrain, 6 city zones (+Area 51), airports, destructible voxel buildings, landmarks
(() => {
const { clamp, rand } = SKY;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CITIES = [
  { id: 'LA', name: 'Los Angeles', x: 0, z: 0, biome: 0x9fae5c, seed: 11 },
  { id: 'LAS', name: 'Las Vegas', x: 14000, z: -9000, biome: 0xd7a86e, seed: 22 },
  { id: 'A51', name: 'Area 51', x: 21500, z: -17500, biome: 0xcf9f6a, seed: 33, secret: true },
  { id: 'MEX', name: 'Mexico City', x: 9000, z: 16000, biome: 0x7fa552, seed: 44 },
  { id: 'NYC', name: 'New York', x: 41000, z: -6000, biome: 0x5f9a4c, seed: 55 },
  { id: 'PAR', name: 'Paris', x: 64000, z: -13000, biome: 0x6ea84a, seed: 66 },
  { id: 'TYO', name: 'Tokyo', x: -36000, z: -4000, biome: 0x5c9a50, seed: 77 },
];
for (const c of CITIES) { c.ax = c.x + 3200; c.az = c.z; c.rwyLen = c.id === 'A51' ? 3400 : 2400; c.rwyW = 50; }
const LAND = [
  { x: 8000, z: 2000, rx: 10500, rz: 22000 }, { x: 25000, z: -5000, rx: 20500, rz: 17000 },
  { x: 64000, z: -12000, rx: 13000, rz: 12000 }, { x: -36000, z: -4000, rx: 7500, rz: 15000 },
];
const W = SKY.World = { cities: CITIES, structs: [], debris: [], hills: [], interactables: [], waterPatches: [] };
W.isLand = (x, z) => { for (const b of LAND) { const dx = (x - b.x) / b.rx, dz = (z - b.z) / b.rz; if (dx * dx + dz * dz < 1) return true; } return false; };
W.isWater = (x, z) => { if (!W.isLand(x, z)) return true; for (const p of W.waterPatches) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return true; return false; };
W.heightAt = (x, z) => {
  let h = 0;
  for (const hl of W.hills) { const dx = x - hl.x; if (dx > hl.r || dx < -hl.r) continue; const dz = z - hl.z; if (dz > hl.r || dz < -hl.r) continue; const d = Math.sqrt(dx * dx + dz * dz); if (d < hl.r) { const v = hl.h * (1 - d / hl.r); if (v > h) h = v; } }
  return h;
};
W.nearestCity = (x, z) => { let best = null, bd = 1e18; for (const c of CITIES) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c; } } return { city: best, dist: Math.sqrt(bd) }; };
W.city = (id) => CITIES.find((c) => c.id === id);

// ---------- structure helpers ----------
let curCity = null;
function newStruct(wx, wy, wz, nx, ny, nz, s, opts) {
  const g = new SKY.VoxGrid(nx, ny, nz, s);
  const st = { grid: g, min: new THREE.Vector3(wx, wy, wz), max: new THREE.Vector3(wx + nx * s, wy + ny * s, wz + nz * s), city: curCity, dynamic: false, name: (opts && opts.name) || 'building', anchorJ: 0 };
  g.group.position.set(wx, wy, wz);
  return st;
}
function finish(st) {
  st.grid.build(curCity.group);
  st.grid.group.updateMatrixWorld(true);
  W.structs.push(st); curCity.structs.push(st);
  return st;
}
const FONT = { H: '101101111101101', O: '111101101101111', L: '100100100100111', Y: '101101010010010', W: '101101101111101', D: '110101101101110', G: '111100101101111', R: '110101110101101', K: '101110100110101', C: '111100100100111', A: '010101111101101', S: '111100111001111', I: '111010010010111', N: '101111111101101', T: '111010010010010', E: '111100110100111', P: '110101110100100', M: '101111101101101', X: '101101010101101', U: '101101101101111', V: '101101101101010', 5: '111100111001111', 1: '010110010010111', ' ': '000000000000000' };
function writeText(g, text, i0, j0, k, m, flip) {
  let x = i0;
  for (const ch of text) { const f = FONT[ch] || FONT[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') g.set(flip ? i0 - (x - i0) - c : x + c, j0 + 4 - r, k, m); x += 4; }
}
// generic building at world (x,z), footprint w x d cells, height h cells (voxel size s)
function building(x, z, w, d, h, style, r, s) {
  s = s || 4;
  const extra = style === 'paris' ? 2 : style === 'casino' ? 3 : style === 'tower' ? 3 : 1;
  const st = newStruct(x - w * s / 2, 0, z - d * s / 2, w, h + extra, d, s);
  const g = st.grid;
  const pal = {
    glass: [46, 22], brick: [23, 22], concrete: [21, 22], paris: [25, 22], mex: [SKY.choose([41, 42, 43, 44]), 21], neon: [38, 22], casino: [21, 32], tower: [46, 22], terminal: [21, 22],
  }[style] || [21, 22];
  const wall = pal[0], win = pal[1];
  for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) for (let i = 0; i < w; i++) {
    const edge = i === 0 || k === 0 || i === w - 1 || k === d - 1;
    if (!edge && j !== h - 1 && j % 4 !== 0) continue;
    if (!edge) { g.set(i, j, k, j === h - 1 ? 24 : wall); continue; }
    const corner = (i === 0 || i === w - 1) && (k === 0 || k === d - 1);
    let m = wall;
    if (!corner && j > 0 && j < h - 1) {
      if (style === 'glass' || style === 'tower') m = (j % 3 === 0) ? wall : win;
      else if (style === 'neon') m = (j % 5 === 2) ? SKY.choose([33, 34, 35, 47]) : ((i + k) % 2 ? win : wall);
      else if ((i + k) % 2 === 1 && j % 2 === 1) m = win;
    }
    if (style === 'casino' && j === h - 1) m = SKY.choose([32, 33, 34]);
    g.set(i, j, k, m);
  }
  if (style === 'paris') { // mansard slate roof
    for (let k = 1; k < d - 1; k++) for (let i = 1; i < w - 1; i++) g.set(i, h, k, 26);
    for (let k = 2; k < d - 2; k++) for (let i = 2; i < w - 2; i++) g.set(i, h + 1, k, 26);
  }
  if (style === 'tower') { const ci = w >> 1, ck = d >> 1; for (let j = h; j < h + 3; j++) g.set(ci, j, ck, j === h + 2 ? 47 : 21); }
  if (style === 'casino') { for (let i = 0; i < w; i++) { g.set(i, h, 0, (i % 2) ? 33 : 34); g.set(i, h + 1, 0, 32); } }
  return finish(st);
}
// lattice tower (Eiffel / Tokyo tower)
function latticeTower(x, z, s, H, B, T, curve, cols, decks, spire) {
  const N = 2 * Math.ceil(B) + 5, c = N >> 1;
  const st = newStruct(x - N * s / 2, 0, z - N * s / 2, N, H + spire + 2, N, s, { name: 'tower' });
  const g = st.grid;
  for (let j = 0; j < H; j++) {
    const f = j / H, hw = T + (B - T) * Math.pow(1 - f, curve);
    const th = Math.max(1, Math.round(3.2 - 2.4 * f));
    const col = cols(j);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const ci = Math.round(c + sx * hw), ck = Math.round(c + sz * hw);
      for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) g.set(ci - sx * a, j, ck - sz * b, col);
    }
    const ring = (j % 7 === 3) || decks.includes(j);
    if (ring) {
      const R = Math.round(hw) + (decks.includes(j) ? 1 : 0);
      for (let a = -R; a <= R; a++) { g.set(c + a, j, c - R, col); g.set(c + a, j, c + R, col); g.set(c - R, j, c + a, col); g.set(c + R, j, c + a, col); }
      if (decks.includes(j)) for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (Math.abs(a) > R - 3 || Math.abs(b) > R - 3) g.set(c + a, j, c + b, col);
    }
  }
  for (let j = H; j < H + spire; j++) g.set(c, j, c, j === H + spire - 1 ? 47 : cols(j));
  return finish(st);
}
function steppedPyramid(x, z, s, base, tiers, tierH, m, stairM, topExtra) {
  const st = newStruct(x - base * s / 2, 0, z - base * s / 2, base, tiers * tierH + 4, base, s, { name: 'pyramid' });
  const g = st.grid; let j = 0;
  for (let t = 0; t < tiers; t++) {
    const inset = Math.round(t * base / (2 * tiers + 1));
    for (let y = 0; y < tierH; y++, j++) for (let k = inset; k < base - inset; k++) for (let i = inset; i < base - inset; i++) {
      const edge = i === inset || k === inset || i === base - inset - 1 || k === base - inset - 1 || y === tierH - 1;
      if (!edge) continue;
      const stair = stairM && Math.abs(i - base / 2 + 0.5) < 2 && k >= base - inset - 2;
      g.set(i, j, k, stair ? stairM : m);
    }
  }
  if (topExtra) topExtra(g, j);
  return finish(st);
}
function smallBox(x, y, z, nx, ny, nz, s, fill) { // custom shape via callback(g)
  const st = newStruct(x - nx * s / 2, y, z - nz * s / 2, nx, ny, nz, s, {}); fill(st.grid); return finish(st);
}

// ---------- shared instanced decoration (trees, lights) ----------
const decoTrees = [], decoPalms = [], decoLights = [];
function hill(x, z, r, h, col, cap) { W.hills.push({ x, z, r, h, col, cap }); }

// ---------- city builders ----------
function genericBlocks(c, R, n, styles, hmin, hmax, rnd, avoid) {
  let placed = 0, tries = 0;
  const taken = [];
  while (placed < n && tries < n * 30) {
    tries++;
    const a = rnd() * Math.PI * 2, d = 150 + Math.sqrt(rnd()) * R;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    if (Math.abs(x - c.ax) < 400) continue;
    if (avoid && avoid.some((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 < p[2] * p[2])) continue;
    const w = 4 + Math.floor(rnd() * 5), dd = 4 + Math.floor(rnd() * 5);
    if (taken.some((t) => Math.abs(t[0] - x) < (t[2] + w) * 2 + 12 && Math.abs(t[1] - z) < (t[3] + dd) * 2 + 12)) continue;
    taken.push([x, z, w, dd]);
    const h = Math.floor(hmin + (hmax - hmin) * Math.pow(rnd(), 1.5) * (1 - d / R * 0.6));
    building(x, z, w, dd, Math.max(2, h), styles[Math.floor(rnd() * styles.length)], rnd);
    placed++;
  }
}
function airport(c) {
  // terminal + tower beside runway (east side)
  building(c.ax + 160, c.az - 300, 8, 30, 4, 'terminal', null, 4);
  smallBox(c.ax + 140, 0, c.az + 260, 4, 22, 4, 2, (g) => { for (let j = 0; j < 18; j++) for (let k = 0; k < 4; k++) for (let i = 0; i < 4; i++) if (i % 3 === 0 || k % 3 === 0) g.set(i, j, k, 21); g.box(0, 18, 0, 3, 20, 3, 46); g.box(0, 21, 0, 3, 21, 3, 24); });
  for (let z = -c.rwyLen / 2; z <= c.rwyLen / 2; z += 120) { decoLights.push([c.ax - c.rwyW / 2 - 2, z + c.az]); decoLights.push([c.ax + c.rwyW / 2 + 2, z + c.az]); }
}
const BUILDERS = {
  LA(c, r, low) {
    genericBlocks(c, 1100, low ? 16 : 34, ['concrete', 'brick', 'glass'], 2, 10, r);
    // downtown towers
    for (let q = 0; q < (low ? 4 : 8); q++) building(c.x - 300 + (q % 4) * 70, c.z - 700 + Math.floor(q / 4) * 80, 6, 6, 18 + Math.floor(r() * 22), 'tower', r);
    // Hollywood sign on hill
    hill(c.x - 200, c.z - 2300, 900, 260, 0x8f8a5a);
    const sx = c.x - 200, sz = c.z - 2300 + 430, y0 = W.heightAt(sx, sz);
    const st = newStruct(sx - 54, y0 - 9, sz, 36, 9, 1, 3, { name: 'HOLLYWOOD sign' });
    writeText(st.grid, 'HOLLYWOOD', 0, 4, 0, 29); for (let i = 0; i < 36; i += 2) for (let j = 0; j < 4; j++) if (i % 4 !== 3) st.grid.set(i, j, 0, 37);
    st.anchorJ = 0; finish(st);
    for (let q = 0; q < 50; q++) decoPalms.push([c.x - 2300 + r() * 300, c.z - 2000 + q * 80]);
    for (let q = 0; q < 40; q++) decoPalms.push([c.x - 1400 + r() * 2800, c.z + (r() - 0.5) * 2800]);
  },
  LAS(c, r, low) {
    for (let q = 0; q < (low ? 6 : 12); q++) building(c.x - 300 + (q % 2) * 160, c.z - 1300 + Math.floor(q / 2) * 230, 10, 8, 8 + Math.floor(r() * 12), q % 3 ? 'casino' : 'neon', r);
    genericBlocks(c, 1100, low ? 8 : 18, ['concrete', 'casino'], 2, 6, r, [[c.x - 220, c.z, 500]]);
    steppedPyramid(c.x + 400, c.z + 700, 2, 44, 11, 2, 38, 0, (g, j) => { for (let y = j; y < j + 4; y++) g.set(22, y, 22, 32); });
    latticeTower(c.x + 350, c.z - 600, 2, 100, 1.6, 1.4, 1, () => 21, [], 6);
    // stratosphere pod
    smallBox(c.x + 350, 180, c.z - 600, 11, 6, 11, 2, (g) => { for (let j = 0; j < 6; j++) for (let k = 0; k < 11; k++) for (let i = 0; i < 11; i++) { const d = Math.hypot(i - 5, k - 5); if (d < 5.5 - Math.abs(j - 2.5) * 0.6 && (d > 3.5 || j === 0 || j === 5)) g.set(i, j, k, j === 2 ? 34 : 21); } });
    // GROK casino neon text
    smallBox(c.x - 300, 60, c.z + 1150, 17, 6, 1, 3, (g) => writeText(g, 'GROK', 0, 0, 0, 33));
    for (let q = 0; q < 6; q++) hill(c.x - 4000 + q * 1500, c.z - 5000 + (q % 2) * 900, 700, 220 + q * 30, 0xa8714a);
  },
  A51(c, r, low) {
    for (let q = 0; q < 4; q++) smallBox(c.ax + 260, 0, c.az - 800 + q * 160, 24, 9, 16, 2, (g) => { for (let k = 0; k < 16; k++) for (let j = 0; j < 9; j++) for (let i = 0; i < 24; i++) { const d = Math.hypot(i - 11.5, j); if (d < 11.6 && (d > 10.4 || k === 0 && d > 6 || k === 15)) g.set(i, j, k, 40); } });
    smallBox(c.ax + 200, 0, c.az + 500, 9, 14, 9, 2, (g) => { g.box(3, 0, 3, 5, 6, 5, 21); for (let k = 0; k < 9; k++) for (let i = 0; i < 9; i++) for (let j = 7; j < 14; j++) { const d = Math.hypot(i - 4, k - 4, (j - 13) * 1.2); if (d < 4.8 && d > 3.6 && j < 12) g.set(i, j, k, 29); } });
    // the saucer (easter egg)
    const s = smallBox(c.ax + 220, 1, c.az + 150, 19, 7, 19, 1, (g) => { for (let k = 0; k < 19; k++) for (let j = 0; j < 7; j++) for (let i = 0; i < 19; i++) { const d = Math.hypot(i - 9, k - 9); if ((j <= 2 && d < 9.5 - Math.abs(j - 1) * 2.5) || (j > 2 && d < 4 - (j - 3) * 0.8)) g.set(i, j, k, j === 1 && d > 8 ? 49 : j > 2 ? 3 : 39); } });
    s.name = 'saucer'; s.dynamic = true; s.anchorJ = -1; W.saucer = { st: s, state: 'parked', t: 0, home: s.grid.group.position.clone() };
    W.interactables.push({ pos: new THREE.Vector3(c.ax + 220, 2, c.az + 150), r: 14, label: () => W.saucer.state === 'parked' ? 'Touch the mysterious saucer' : null, act: () => { W.saucer.state = 'rising'; SKY.Audio.play('whoop'); SKY.toast('👽 The saucer powers up!', 'good'); SKY.Game && SKY.Game.achieve('saucer'); } });
    smallBox(c.ax + 400, 0, c.az - 1100, 4, 2, 60, 2, (g) => g.box(0, 0, 0, 3, 1, 59, 21));
    for (let q = 0; q < 3; q++) hill(c.x - 3000 + q * 1800, c.z - 2500, 900, 300, 0xa8714a);
  },
  MEX(c, r, low) {
    genericBlocks(c, 1000, low ? 18 : 40, ['mex', 'mex', 'mex', 'concrete'], 2, 5, r, [[c.x + 800, c.z - 900, 260], [c.x, c.z, 150]]);
    for (let q = 0; q < (low ? 2 : 5); q++) building(c.x - 600 + q * 90, c.z + 600, 6, 6, 14 + Math.floor(r() * 10), 'glass', r);
    steppedPyramid(c.x + 800, c.z - 900, 2, 56, 5, 6, 31, 45, (g, j) => g.box(25, j, 25, 30, j + 2, 30, 45));
    // Angel of Independence
    smallBox(c.x, 0, c.z, 6, 30, 6, 2, (g) => { g.box(0, 0, 0, 5, 2, 5, 45); g.box(2, 3, 2, 3, 24, 3, 29); g.box(2, 25, 2, 3, 26, 3, 32); g.box(0, 26, 2, 5, 27, 3, 32); g.set(2, 28, 2, 32); g.set(3, 28, 2, 32); });
    // cathedral
    smallBox(c.x - 400, 0, c.z - 300, 22, 22, 12, 2, (g) => { for (let j = 0; j < 12; j++) for (let k = 0; k < 12; k++) for (let i = 4; i < 18; i++) if (i === 4 || i === 17 || k === 0 || k === 11 || j === 11) g.set(i, j, k, 45); g.box(0, 0, 0, 4, 20, 4, 45); g.box(17, 0, 0, 21, 20, 4, 45); g.box(1, 21, 1, 3, 21, 3, 32); g.box(18, 21, 1, 20, 21, 3, 32); });
    hill(c.x + 5000, c.z + 3000, 2400, 900, 0x7e7060, true); hill(c.x + 7500, c.z + 1000, 1800, 650, 0x7e7060, true);
  },
  NYC(c, r, low) {
    let n = 0;
    for (let gx = -4; gx <= 4; gx++) for (let gz = -5; gz <= 5; gz++) {
      if (Math.abs(gx) <= 1 && gz >= -4 && gz <= -1) continue; // central park
      if (low && (gx + gz) % 2) continue;
      if (r() < 0.25) continue;
      const x = c.x + gx * 120, z = c.z + gz * 110; if (gx === 0 && gz === 2) continue;
      const centre = 1 - Math.hypot(gx, gz) / 8;
      building(x, z, 6, 6, Math.floor(8 + r() * 30 * centre + 6), SKY.choose(['glass', 'brick', 'concrete', 'tower']), r); n++;
    }
    // Empire State
    smallBox(c.x, 0, c.z + 220, 20, 120, 14, 2, (g) => {
      const tiers = [[0, 0, 19, 13, 0, 12], [2, 2, 17, 11, 13, 70], [5, 3, 14, 10, 71, 92], [7, 5, 12, 8, 93, 100]];
      for (const t of tiers) for (let j = t[4]; j <= t[5]; j++) for (let k = t[1]; k <= t[3]; k++) for (let i = t[0]; i <= t[2]; i++) { const e = i === t[0] || i === t[2] || k === t[1] || k === t[3]; if (e || j === t[5] || j % 10 === 0) g.set(i, j, k, e && (i + j) % 2 && j % 2 ? 22 : 25); }
      g.box(9, 101, 6, 10, 108, 7, 21); g.box(9, 109, 6, 9, 118, 6, 29); g.set(9, 119, 6, 47);
    });
    // Statue of Liberty on harbor island
    W.waterPatches.push({ x0: c.x - 1300, x1: c.x + 1300, z0: c.z + 1000, z1: c.z + 3000 });
    smallBox(c.x - 200, 0, c.z + 2000, 16, 48, 16, 1.5, (g) => {
      g.box(2, 0, 2, 13, 6, 13, 45); g.box(4, 7, 4, 11, 14, 11, 45);
      for (let j = 15; j < 38; j++) { const rr = 3.6 - (j - 15) * 0.07; for (let k = 0; k < 16; k++) for (let i = 0; i < 16; i++) if (Math.hypot(i - 7.5, k - 7.5) < rr) g.set(i, j, k, 30); }
      g.box(6, 38, 6, 9, 41, 9, 30); for (let a = 0; a < 5; a++) g.set(5 + a, 42, 7, 30);
      g.box(10, 32, 7, 10, 44, 8, 30); g.box(9, 45, 7, 11, 46, 8, 32); g.box(4, 30, 6, 4, 33, 7, 45);
    });
    for (let q = 0; q < 70; q++) decoTrees.push([c.x - 180 + r() * 360, c.z - 470 + r() * 360]);
  },
  PAR(c, r, low) {
    W.waterPatches.push({ x0: c.x - 2200, x1: c.x + 2200, z0: c.z + 60, z1: c.z + 120 });
    genericBlocks(c, 1000, low ? 18 : 40, ['paris'], 5, 8, r, [[c.x - 600, c.z + 400, 230], [c.x + 500, c.z - 500, 150], [c.x, c.z + 90, 80], [c.x + 300, c.z + 450, 80]]);
    latticeTower(c.x - 600, c.z + 400, 2, 64, 17, 1.2, 2.4, () => 27, [9, 26, 50], 6);
    smallBox(c.x + 500, 0, c.z - 500, 26, 26, 12, 2, (g) => { for (let j = 0; j < 25; j++) for (let k = 0; k < 12; k++) for (let i = 0; i < 26; i++) { const inArch = Math.abs(i - 12.5) < 5 && (j < 12 || Math.hypot(i - 12.5, j - 12) < 5) || (Math.abs(k - 5.5) < 2.5 && j < 10 && (i < 4 || i > 21) === false && Math.abs(i - 12.5) > 9); if (!inArch) g.set(i, j, k, j > 22 ? 45 : 25); } });
    steppedPyramid(c.x + 300, c.z + 450, 2, 13, 6, 1, 3, 0);
    for (let q = 0; q < 50; q++) decoTrees.push([c.x - 600 + (r() - 0.5) * 300, c.z + 650 + r() * 500]);
  },
  TYO(c, r, low) {
    for (let q = 0; q < (low ? 18 : 40); q++) {
      const a = r() * 6.28, d = 150 + r() * 950;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (Math.hypot(x - c.x - 400, z - c.z + 400) < 120 || Math.abs(x - c.ax) < 400) continue;
      building(x, z, 5 + Math.floor(r() * 3), 5 + Math.floor(r() * 3), 8 + Math.floor(r() * 25), 'neon', r);
    }
    latticeTower(c.x + 400, c.z - 400, 2, 72, 11, 1.2, 2, (j) => (Math.floor(j / 8) % 2 ? 29 : 28), [16, 40], 8);
    smallBox(c.x - 400, 0, c.z + 400, 14, 12, 2, 2, (g) => { g.box(2, 0, 0, 3, 10, 1, 28); g.box(10, 0, 0, 11, 10, 1, 28); g.box(0, 10, 0, 13, 11, 1, 28); g.box(1, 8, 0, 12, 8, 1, 28); });
    smallBox(c.x - 100, 80, c.z + 900, 17, 6, 1, 3, (g) => writeText(g, 'GROK', 0, 0, 0, 34));
    hill(c.x - 6000, c.z - 3500, 3600, 1150, 0x6d6f7a, true);
  },
};

W.build = function (scene) {
  const low = SKY.lowSpec;
  W.scene = scene;
  // --- ground mesh (vertex coloured) ---
  const X0 = -50000, X1 = 82000, Z0 = -40000, Z1 = 40000, SX = low ? 88 : 132, SZ = low ? 54 : 80;
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SX, SZ); geo.rotateX(-Math.PI / 2); geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); W.groundColor(x, z, col); cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground); W.ground = ground;
  // --- cities ---
  for (const c of CITIES) {
    c.group = new THREE.Group(); c.structs = []; scene.add(c.group); curCity = c;
    // urban pad + runway
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1700, 24), new THREE.MeshLambertMaterial({ color: new THREE.Color(c.biome).lerp(new THREE.Color(0x85888c), 0.7), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(c.x, 0.05, c.z); c.group.add(pad);
    for (let q = -2; q <= 2; q++) { const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 3400), roadMat()); road.rotation.x = -Math.PI / 2; road.position.set(c.x + q * 520, 0.08, c.z); c.group.add(road); const r2 = road.clone(); r2.rotation.z = Math.PI / 2; r2.position.set(c.x, 0.08, c.z + q * 520); c.group.add(r2); }
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(c.rwyW, c.rwyLen), runwayMat()); rw.rotation.x = -Math.PI / 2; rw.position.set(c.ax, 0.12, c.az); c.group.add(rw);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 900), new THREE.MeshLambertMaterial({ color: 0x8c8f94, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); apron.rotation.x = -Math.PI / 2; apron.position.set(c.ax + 150, 0.1, c.az - 100); c.group.add(apron);
    airport(c);
    BUILDERS[c.id](c, rng(c.seed), low);
  }
  for (const p of W.waterPatches) { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), new THREE.MeshLambertMaterial({ color: 0x2f74b5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.rotation.x = -Math.PI / 2; m.position.set((p.x0 + p.x1) / 2, 0.14, (p.z0 + p.z1) / 2); scene.add(m); }
  // --- hills ---
  for (const h of W.hills) {
    const cg = new THREE.ConeGeometry(h.r, h.h, 9, 1).toNonIndexed(); cg.computeVertexNormals(); const m = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: h.col }));
    m.position.set(h.x, h.h / 2, h.z); scene.add(m);
    if (h.cap) { const cpg = new THREE.ConeGeometry(h.r * 0.3, h.h * 0.3, 9, 1).toNonIndexed(); cpg.computeVertexNormals(); const cp = new THREE.Mesh(cpg, new THREE.MeshLambertMaterial({ color: 0xffffff })); cp.position.set(h.x, h.h * 0.85 + 2, h.z); cp.scale.setScalar(1.02); scene.add(cp); }
  }
  // --- deco instanced ---
  const inst = (geo, mat, list, y, fn) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); const m4 = new THREE.Matrix4(); list.forEach((p, i) => { m4.makeTranslation(p[0], y, p[1]); if (fn) fn(m4, i); im.setMatrixAt(i, m4); }); im.frustumCulled = false; scene.add(im); };
  inst(new THREE.BoxGeometry(1.2, 14, 1.2), new THREE.MeshLambertMaterial({ color: 0x7b5a3a }), decoPalms, 7);
  inst(new THREE.BoxGeometry(7, 2, 7), new THREE.MeshLambertMaterial({ color: 0x3f9a3a }), decoPalms, 14.5);
  inst(new THREE.BoxGeometry(6, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }), decoTrees, 6);
  inst(new THREE.BoxGeometry(1.2, 1, 1.2), new THREE.MeshBasicMaterial({ color: 0xffe066 }), decoLights, 0.6);
  // clouds
  const cl = []; const r = rng(99);
  for (let q = 0; q < (low ? 70 : 160); q++) { const cx = -45000 + r() * 125000, cz = -35000 + r() * 70000, cy = 900 + r() * 900; for (let b = 0; b < 4; b++) cl.push([cx + (r() - 0.5) * 300, cz + (r() - 0.5) * 200, cy + (r() - 0.5) * 60, 120 + r() * 200]); }
  const cim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), cl.length);
  const m4 = new THREE.Matrix4(); cl.forEach((c, i) => { m4.makeScale(c[3], c[3] * 0.25, c[3] * 0.7); m4.setPosition(c[0], c[2], c[1]); cim.setMatrixAt(i, m4); }); cim.frustumCulled = false; scene.add(cim); W.clouds = cl;
  W.buildMapCanvas();
};
let _roadMat = null, _rwMat = null;
function roadMat() { return _roadMat || (_roadMat = new THREE.MeshLambertMaterial({ color: 0x55585e, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); }
function runwayMat() {
  if (_rwMat) return _rwMat;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 1024; const x = cv.getContext('2d');
  x.fillStyle = '#34373c'; x.fillRect(0, 0, 64, 1024);
  x.fillStyle = '#f2f2f2'; for (let y = 60; y < 964; y += 36) x.fillRect(31, y, 2, 18);
  for (let i = 0; i < 6; i++) { x.fillRect(6 + i * 9, 6, 4, 14); x.fillRect(6 + i * 9, 1004, 4, 14); }
  x.fillRect(2, 0, 1, 1024); x.fillRect(61, 0, 1, 1024);
  x.fillStyle = '#ffd23d'; x.fillRect(29, 48, 6, 6); x.fillRect(29, 970, 6, 6);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
  return (_rwMat = new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
}
W.groundColor = (x, z, out) => {
  if (!W.isLand(x, z)) { out.setHex(0x2f74b5); const n = Math.sin(x * 0.0013) * Math.cos(z * 0.0011) * 0.05; out.offsetHSL(0, 0, n); return out; }
  const { city } = W.nearestCity(x, z); out.setHex(city.biome);
  const n = (Math.sin(x * 0.0021 + z * 0.0013) + Math.cos(z * 0.0027 - x * 0.0009)) * 0.04; out.offsetHSL(0, 0, n);
  // beach near coast
  let near = false; for (const s of [[-600, 0], [600, 0], [0, -600], [0, 600]]) if (!W.isLand(x + s[0], z + s[1])) near = true;
  if (near) out.setHex(0xe6d39a);
  return out;
};
W.buildMapCanvas = () => {
  const cv = document.createElement('canvas'); cv.width = 528; cv.height = 320; const x = cv.getContext('2d');
  const col = new THREE.Color();
  for (let py = 0; py < 160; py++) for (let px = 0; px < 264; px++) { const wx = -50000 + px * 500, wz = -40000 + py * 500; W.groundColor(wx, wz, col); x.fillStyle = '#' + col.getHexString(); x.fillRect(px * 2, py * 2, 2, 2); }
  W.mapCanvas = cv; W.mapBounds = { x0: -50000, z0: -40000, w: 132000, h: 80000 };
};

// ---------- queries ----------
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
W.solidAt = (x, y, z) => {
  for (const s of W.structs) { if (x < s.min.x || y < s.min.y || z < s.min.z || x > s.max.x || y > s.max.y || z > s.max.z) continue; const g = s.grid, o = g.group.position; if (g.solid(x - o.x, y - o.y, z - o.z)) return s; }
  return null;
};
W.segmentHit = (a, b) => {
  const minx = Math.min(a.x, b.x), maxx = Math.max(a.x, b.x), miny = Math.min(a.y, b.y), maxy = Math.max(a.y, b.y), minz = Math.min(a.z, b.z), maxz = Math.max(a.z, b.z);
  _d.subVectors(b, a); const len = _d.length(); if (len < 1e-6) return null; _d.divideScalar(len);
  let best = null;
  for (const s of W.structs) {
    if (maxx < s.min.x || minx > s.max.x || maxy < s.min.y || miny > s.max.y || maxz < s.min.z || minz > s.max.z) continue;
    const o = s.grid.group.position; _p.subVectors(a, o);
    const h = s.grid.raycast(_p, _d, len);
    if (h && (!best || h.dist < best.dist)) best = { st: s, id: h.id, dist: h.dist, point: a.clone().addScaledVector(_d, h.dist), n: new THREE.Vector3(h.nx, h.ny, h.nz) };
  }
  return best;
};
// damage world structures around a world point
W.damage = (pt, r, power, vel, fx) => {
  let total = 0;
  for (const s of W.structs) {
    if (pt.x + r < s.min.x || pt.x - r > s.max.x || pt.y + r < s.min.y || pt.y - r > s.max.y || pt.z + r < s.min.z || pt.z - r > s.max.z) continue;
    const o = s.grid.group.position; _p.subVectors(pt, o);
    const rem = s.grid.damageSphere(_p, Math.max(r, s.grid.s * 0.6), power);
    if (!rem.length) continue; total += rem.length;
    if (fx) for (let q = 0; q < Math.min(rem.length, SKY.lowSpec ? 10 : 24); q++) { const e = rem[q]; fx.chip.spawn(e.x + o.x, e.y + o.y, e.z + o.z, (vel ? vel.x * 0.3 : 0) + rand(-6, 6), rand(2, 10), (vel ? vel.z * 0.3 : 0) + rand(-6, 6), rand(2, 4), s.grid.s * rand(0.3, 0.7), e.col); }
    if (fx && rem.length > 3) for (let q = 0; q < 4; q++) fx.smoke.spawn(pt.x + rand(-r, r), pt.y + rand(-r, r) * 0.5, pt.z + rand(-r, r), rand(-2, 2), rand(1, 3), rand(-2, 2), rand(3, 6), s.grid.s * 1.5, 0x9a9a9a);
    W.checkSupport(s, vel);
  }
  return total;
};
W.checkSupport = (s, vel) => {
  if (s.anchorJ < 0) return;
  const g = s.grid;
  const comps = g.floating((id) => (id / g.nx | 0) % g.ny === 0);
  for (const comp of comps) {
    if (comp.length < 3) { for (const id of comp) g.remove(id); continue; }
    const ex = g.extract(comp);
    const m = new THREE.Matrix4().makeTranslation(g.group.position.x + ex.offset.x, g.group.position.y + ex.offset.y, g.group.position.z + ex.offset.z);
    W.addDebris(ex.grid, m, vel ? vel.clone().multiplyScalar(0.25) : new THREE.Vector3(), new THREE.Vector3(rand(-0.3, 0.3), rand(-0.2, 0.2), rand(-0.3, 0.3)));
  }
};
W.addDebris = (grid, m, vel, w) => {
  const d = new SKY.Debris(W.scene, grid, m, vel, w);
  d.hitCb = (db, imp) => { if (imp > 8 && db.age - db.lastImpact > 0.4) { db.lastImpact = db.age; if (SKY.Game) SKY.Game.debrisImpact(db, imp); } };
  W.debris.push(d);
  const max = SKY.lowSpec ? 10 : 22;
  while (W.debris.length > max) { const o = W.debris.shift(); o.dispose(); }
  return d;
};
W.update = (dt, camPos) => {
  const far = SKY.lowSpec ? 11000 : 17000;
  for (const c of CITIES) { const d = Math.hypot(c.x - camPos.x, c.z - camPos.z); c.group.visible = d < far + 2000; }
  for (const d of W.debris) d.step(dt, W);
  for (let i = W.debris.length - 1; i >= 0; i--) if (W.debris[i].age > 90) { W.debris[i].dispose(); W.debris.splice(i, 1); }
  // saucer
  const S = W.saucer;
  if (S && S.st.grid.count > 0) {
    const g = S.st.grid.group; S.t += dt;
    if (S.state === 'rising') { g.position.y += dt * 8; if (g.position.y > S.home.y + 120) { S.state = 'hover'; S.t = 0; } }
    else if (S.state === 'hover') { g.position.x = S.home.x + Math.sin(S.t * 0.25) * 600; g.position.z = S.home.z + Math.cos(S.t * 0.25) * 600; g.position.y = S.home.y + 120 + Math.sin(S.t) * 10; }
    S.st.min.copy(g.position); S.st.max.set(g.position.x + 19, g.position.y + 7, g.position.z + 19);
  }
};
})();

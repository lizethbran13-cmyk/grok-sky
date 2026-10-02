'use strict';
// GROK SKY - world core: terrain/ocean, zone registry, lazy city build + unload (LOD), far impostors,
// spatial hash for destructible voxel structs, layered ground decals, district planner, voxel building helpers, queries
(() => {
const { clamp, rand } = SKY;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
SKY.rng = rng;

const CITIES = [
  { id: 'LA', name: 'Los Angeles', x: 0, z: 0, biome: 0x9fae5c, urban: 0xb3ad9c, seed: 11 },
  { id: 'LAS', name: 'Las Vegas', x: 14000, z: -9000, biome: 0xd7a86e, urban: 0xc9b089, seed: 22 },
  { id: 'A51', name: 'Area 51', x: 21500, z: -17500, biome: 0xcf9f6a, urban: 0xc9a273, seed: 33, secret: true },
  { id: 'MEX', name: 'Mexico City', x: 9000, z: 16000, biome: 0x7fa552, urban: 0xb6ab98, seed: 44 },
  { id: 'NYC', name: 'New York', x: 41000, z: -6000, biome: 0x5f9a4c, urban: 0x9c9fa3, seed: 55 },
  { id: 'PAR', name: 'Paris', x: 64000, z: -13000, biome: 0x6ea84a, urban: 0xb5ad9d, seed: 66 },
  { id: 'TYO', name: 'Tokyo', x: -36000, z: -4000, biome: 0x5c9a50, urban: 0xa7a8a8, seed: 77 },
];
for (const c of CITIES) { c.ax = c.x + 3200; c.az = c.z; c.rwyLen = 2400; c.rwyW = 50; c.built = false; c.complete = false; c.structs = []; }
const LAND = [
  { x: 8000, z: 2000, rx: 10500, rz: 22000 }, { x: 25000, z: -5000, rx: 20500, rz: 17000 },
  { x: 64000, z: -12000, rx: 13000, rz: 12000 }, { x: -36000, z: -4000, rx: 7500, rz: 15000 },
];
const W = SKY.World = { cities: CITIES, structs: [], debris: [], hills: [], interactables: [], waterPatches: [], landPatches: [], rivers: [], waterCircles: [], landmarks: [] };
W.isLand = (x, z) => { for (const b of LAND) { const dx = (x - b.x) / b.rx, dz = (z - b.z) / b.rz; if (dx * dx + dz * dz < 1) return true; } return false; };
W.isWater = (x, z) => {
  for (const p of W.landPatches) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return false;
  if (!W.isLand(x, z)) return true;
  for (const p of W.waterPatches) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return true;
  for (const p of W.waterCircles) if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) return true;
  for (const r of W.rivers) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    for (let i = 0; i < r.pts.length - 1; i++) if (segDist2(x, z, r.pts[i], r.pts[i + 1]) < r.hw * r.hw) return true;
  }
  return false;
};
function segDist2(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1]; const L = dx * dx + dz * dz; let t = L > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + dx * t - x, pz = a[1] + dz * t - z; return px * px + pz * pz; }
W.segDist2 = segDist2;
W.heightAt = (x, z) => {
  let h = 0;
  for (const hl of W.hills) { const dx = x - hl.x; if (dx > hl.r || dx < -hl.r) continue; const dz = z - hl.z; if (dz > hl.r || dz < -hl.r) continue; const d = Math.sqrt(dx * dx + dz * dz); if (d < hl.r) { const v = hl.h * (1 - d / hl.r); if (v > h) h = v; } }
  return h;
};
W.nearestCity = (x, z) => { let best = null, bd = 1e18; for (const c of CITIES) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c; } } return { city: best, dist: Math.sqrt(bd) }; };
W.city = (id) => CITIES.find((c) => c.id === id);
// distance to a zone = min(city centre, airport)
W.zoneDist = (c, x, z) => { let d = Math.hypot(c.x - x, c.z - z); if (c.apt) d = Math.min(d, Math.hypot(c.ax - x, c.az - z) - c.rwyLen * 0.5); return Math.max(0, d); };

// ---------- struct spatial hash ----------
const HC = 250; const hash = new Map(); const dyn = []; let qid = 1;
const hkey = (i, k) => (i + 600) * 2048 + (k + 600);
function hashAdd(st) {
  if (st.dynamic) { if (!dyn.includes(st)) dyn.push(st); return; }
  const i0 = Math.floor(st.min.x / HC), i1 = Math.floor(st.max.x / HC), k0 = Math.floor(st.min.z / HC), k1 = Math.floor(st.max.z / HC);
  st.hk = [];
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const key = hkey(i, k); let a = hash.get(key); if (!a) hash.set(key, a = []); a.push(st); st.hk.push(key); }
}
function hashRemove(st) {
  const di = dyn.indexOf(st); if (di >= 0) dyn.splice(di, 1);
  if (st.hk) for (const key of st.hk) { const a = hash.get(key); if (!a) continue; const i = a.indexOf(st); if (i >= 0) a.splice(i, 1); if (!a.length) hash.delete(key); }
  st.hk = null;
}
W.setDynamic = (st) => { hashRemove(st); st.dynamic = true; st.grid.group.matrixAutoUpdate = true; hashAdd(st); };
// visit structs whose AABB cell overlaps the xz box
function query(x0, z0, x1, z1, fn) {
  const id = ++qid;
  const i0 = Math.floor(x0 / HC), i1 = Math.floor(x1 / HC), k0 = Math.floor(z0 / HC), k1 = Math.floor(z1 / HC);
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const a = hash.get(hkey(i, k)); if (a) for (const st of a) if (st._q !== id) { st._q = id; if (fn(st)) return; } }
  for (const st of dyn) if (st._q !== id) { st._q = id; if (fn(st)) return; }
}
W.query = query;

// ---------- struct helpers ----------
let curCity = null;
function newStruct(wx, wy, wz, nx, ny, nz, s, opts) {
  const g = new SKY.VoxGrid(Math.max(1, nx | 0), Math.max(1, ny | 0), Math.max(1, nz | 0), s);
  g.groundFloor = Math.abs(wy) < 0.05;
  const st = { grid: g, min: new THREE.Vector3(wx, wy, wz), max: new THREE.Vector3(wx + g.nx * s, wy + g.ny * s, wz + g.nz * s), city: curCity, dynamic: false, name: (opts && opts.name) || 'building', anchorJ: 0, viewR: 0, fixedViewR: opts && opts.viewR };
  g.group.position.set(wx, wy, wz);
  return st;
}
function finish(st) {
  const g = st.grid;
  if (!g.count && !hasAny(g)) return st;
  g.build(curCity.group);
  g.group.updateMatrixWorld(true);
  g.group.matrixAutoUpdate = st.dynamic;
  const size = Math.max(st.max.x - st.min.x, st.max.y - st.min.y, st.max.z - st.min.z);
  st.viewR = st.fixedViewR ? st.fixedViewR * (SKY.lowSpec ? 0.75 : 1) : (SKY.lowSpec ? 1 : 1.5) * clamp(450 + size * 28, 650, 9000);
  st.cx = (st.min.x + st.max.x) / 2; st.cz = (st.min.z + st.max.z) / 2;
  W.structs.push(st); curCity.structs.push(st); hashAdd(st);
  return st;
}
function hasAny(g) { for (let i = 0; i < g.n; i++) if (g.mat[i]) return true; return false; }
function removeStruct(st) {
  hashRemove(st); if (st.sup) { const S = st.sup; S.members = S.members.filter((m) => m !== st); S.dirty = true; st.sup = null; }
  if (st.imp) { if (st.imp.parent) st.imp.parent.remove(st.imp); st.imp.geometry.dispose(); st.imp = null; } st.grid.dispose(); if (st.grid.group.parent) st.grid.group.parent.remove(st.grid.group);
  const i = W.structs.indexOf(st); if (i >= 0) W.structs.splice(i, 1);
}
W.removeStruct = removeStruct;
W.moveStruct = (st, x, y, z) => { st.grid.group.position.set(x, y, z); const g = st.grid; st.min.set(x, y, z); st.max.set(x + g.nx * g.s, y + g.ny * g.s, z + g.nz * g.s); st.cx = (st.min.x + st.max.x) / 2; st.cz = (st.min.z + st.max.z) / 2; st.grid.group.updateMatrix(); st.grid.group.updateMatrixWorld(true); if (!st.dynamic) { hashRemove(st); hashAdd(st); } };

function writeText(g, text, i0, j0, k, m, flip) { // along +i (or -i when flip)
  let x = i0; const F = SKY.FONT;
  for (const ch of text) { const f = F[ch] || F[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') g.set(flip ? i0 - (x - i0) - c : x + c, j0 + 4 - r, k, m); x += 4; }
}
function writeTextZ(g, text, i, j0, k0, m, dir, scale) { // along k (dir +1/-1), optional pixel scale
  const F = SKY.FONT; const sc = scale || 1; let p = 0;
  for (const ch of text) { const f = F[ch] || F[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) g.set(i, j0 + (4 - r) * sc + b, k0 + dir * ((p + c) * sc + a), m); p += 4; }
}
function writeTextX(g, i0, j0, k, text, m, dir, scale) { // along i
  const F = SKY.FONT; const sc = scale || 1; let p = 0;
  for (const ch of text) { const f = F[ch] || F[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) g.set(i0 + dir * ((p + c) * sc + a), j0 + (4 - r) * sc + b, k, m); p += 4; }
}
const textW = (t, sc) => (t.length * 4 - 1) * (sc || 1);

// paint a building into an existing grid at cell offset (i0,k0)
const STYLE = {
  glass: { wall: 46, win: 22 }, tower: { wall: 46, win: 22 }, brick: { wall: 23, win: 22 }, concrete: { wall: 21, win: 22 }, paris: { wall: 25, win: 22 },
  mex: { wall: 41, win: 21 }, neon: { wall: 38, win: 22 }, casino: { wall: 21, win: 32 }, terminal: { wall: 21, win: 22 }, stucco: { wall: 50, win: 22 },
  tokyo: { wall: 29, win: 22 }, hotel: { wall: 50, win: 22 }, brown: { wall: 58, win: 22 }, gold: { wall: 53, win: 53 }, silver: { wall: 56, win: 46 },
};
function paint(g, i0, k0, w, d, h, style, r, low, j0) {
  j0 = j0 || 0; r = r || Math.random;
  const pal = STYLE[style] || STYLE.concrete;
  let wall = pal.wall, win = pal.win;
  if (style === 'mex') wall = [41, 42, 43, 44, 59, 50, 54][Math.floor(r() * 7)];
  if (style === 'stucco') wall = [50, 50, 29, 43, 44, 41][Math.floor(r() * 6)];
  if (style === 'brick') wall = [23, 23, 58, 45, 25][Math.floor(r() * 5)];
  if (style === 'tokyo') wall = [29, 21, 56, 25, 46][Math.floor(r() * 5)];
  if (style === 'glass') { const q = Math.floor(r() * 5); wall = [46, 46, 56, 38, 21][q]; win = [22, 46, 22, 46, 22][q] === wall ? 22 : [22, 46, 22, 46, 22][q]; }
  const neonC = [33, 34, 35, 47, 69, 32];
  const setb = (style === 'tower' || style === 'glass') && h > 18 && w > 5 && d > 5 ? Math.floor(h * (0.6 + r() * 0.2)) : 999;
  const slabs = false; // interior floor slabs removed (invisible from outside, ~20% of voxels)
  for (let j = 0; j < h; j++) {
    const ins = j >= setb ? 1 : 0;
    const a0 = ins, a1 = w - 1 - ins, b0 = ins, b1 = d - 1 - ins;
    for (let k = b0; k <= b1; k++) for (let i = a0; i <= a1; i++) {
      const edge = i === a0 || k === b0 || i === a1 || k === b1;
      const top = j === h - 1 || (j === setb - 1);
      if (!edge && !top && !(slabs && j % 4 === 0 && j > 0)) continue;
      if (!edge) { g.set(i0 + i, j0 + j, k0 + k, top ? 24 : wall); continue; }
      const corner = (i === a0 || i === a1) && (k === b0 || k === b1);
      let m = wall;
      if (!corner && j > 0 && j < h - 1) {
        if (style === 'glass' || style === 'tower' || style === 'gold' || style === 'silver') m = (j % 3 === 0) ? wall : win;
        else if (style === 'neon') m = (j % 5 === 2) ? neonC[(i + k + j) % neonC.length] : ((i + k) % 2 ? win : wall);
        else if (style === 'tokyo') m = (j % 2 === 1) ? win : wall;
        else if (style === 'hotel') m = (j % 2 === 1 && (i + k) % 2 === 0) ? win : wall;
        else if ((i + k) % 2 === 1 && j % 2 === 1) m = win;
      } else if (j === 0 && !corner && (style === 'mex' || style === 'paris' || style === 'stucco') && (i + k) % 3 === 1) m = 22;
      if (style === 'casino' && j === h - 1) m = neonC[(i + k) % 3];
      g.set(i0 + i, j0 + j, k0 + k, m);
    }
  }
  const H = j0 + h;
  if (style === 'paris') { for (let k = 1; k < d - 1; k++) for (let i = 1; i < w - 1; i++) g.set(i0 + i, H, k0 + k, 26); for (let k = 2; k < d - 2; k++) for (let i = 2; i < w - 2; i++) if ((i + k) % 3) g.set(i0 + i, H + 1, k0 + k, 26); if (r() < 0.7) g.set(i0 + 1, H + 1, k0 + 1, 23); }
  else if (style === 'tower' || (style === 'glass' && h > 14)) { const ci = w >> 1, ck = d >> 1; for (let j = H; j < H + 3; j++) g.set(i0 + ci, j, k0 + ck, j === H + 2 ? 47 : 21); }
  else if (style === 'casino') { for (let i = 0; i < w; i++) { g.set(i0 + i, H, k0, (i % 2) ? 33 : 34); g.set(i0 + i, H + 1, k0, 32); } }
  else if (style === 'brick' && r() < 0.45 && h > 3) { const ti = 1 + Math.floor(r() * (w - 2)), tk = 1 + Math.floor(r() * (d - 2)); g.set(i0 + ti, H, k0 + tk, 37); } // NYC water tank
  else if (style === 'neon' || style === 'tokyo') { if (r() < 0.6 && h > 3) { const side = r() < 0.5; const c = neonC[Math.floor(r() * 5)]; for (let j = 2; j < h + 1; j++) g.set(i0 + (side ? -0 : w - 1), j0 + j, k0 + (side ? d >> 1 : 0), c); } if (r() < 0.4) for (let i = 1; i < w - 1; i++) g.set(i0 + i, H, k0, neonC[Math.floor(r() * 6)]); }
  else if (style === 'mex' || style === 'stucco') { if (r() < 0.5) for (let i = 0; i < w; i++) { g.set(i0 + i, H, k0, wall); g.set(i0 + i, H, k0 + d - 1, wall); } }
}
const EXTRA = (style) => style === 'paris' ? 2 : (style === 'tower' || style === 'glass' || style === 'casino') ? 3 : 1;
function building(x, z, w, d, h, style, r, s, low) {
  s = s || 4;
  const st = newStruct(x - w * s / 2, 0, z - d * s / 2, w, h + EXTRA(style), d, s);
  paint(st.grid, 0, 0, w, d, h, style, r, low === undefined ? SKY.lowSpec : low);
  return finish(st);
}
// several district buildings packed into one grid (fewer draw calls)
function blockStruct(specs, r) {
  const s = specs[0].s || 4;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, H = 1;
  for (const b of specs) { x0 = Math.min(x0, b.x - b.w * s / 2); z0 = Math.min(z0, b.z - b.d * s / 2); x1 = Math.max(x1, b.x + b.w * s / 2); z1 = Math.max(z1, b.z + b.d * s / 2); H = Math.max(H, b.h + EXTRA(b.style)); }
  x0 = Math.floor(x0 / s) * s; z0 = Math.floor(z0 / s) * s;
  const st = newStruct(x0, 0, z0, Math.ceil((x1 - x0) / s) + 1, H, Math.ceil((z1 - z0) / s) + 1, s, { name: 'block' });
  for (const b of specs) paint(st.grid, Math.round((b.x - b.w * s / 2 - x0) / s), Math.round((b.z - b.d * s / 2 - z0) / s), b.w, b.d, b.h, b.style, r, SKY.lowSpec);
  return finish(st);
}
// implicit-shape struct: fn(x, y, z, i, j, k) -> material (x/z relative to centre, y relative to base)
function shape(cx, y0, cz, sx, sy, sz, s, fn, opts) {
  const nx = Math.max(1, Math.ceil(sx / s)), ny = Math.max(1, Math.ceil(sy / s)), nz = Math.max(1, Math.ceil(sz / s));
  const st = newStruct(cx - nx * s / 2, y0, cz - nz * s / 2, nx, ny, nz, s, opts);
  const g = st.grid;
  for (let k = 0; k < nz; k++) { const z = (k + 0.5) * s - nz * s / 2; for (let j = 0; j < ny; j++) { const y = (j + 0.5) * s; for (let i = 0; i < nx; i++) { const m = fn((i + 0.5) * s - nx * s / 2, y, z, i, j, k); if (m) g.set(i, j, k, m); } } }
  if (opts && opts.post) opts.post(g, st);
  if (opts && opts.anchorJ !== undefined) st.anchorJ = opts.anchorJ;
  return finish(st);
}
function smallBox(x, y, z, nx, ny, nz, s, fill, opts) { const st = newStruct(x - nx * s / 2, y, z - nz * s / 2, nx, ny, nz, s, opts || {}); fill(st.grid, st); return finish(st); }
function latticeTower(x, z, s, H, B, T, curve, cols, decks, spire, y0) {
  const N = 2 * Math.ceil(B) + 5, c = N >> 1;
  const st = newStruct(x - N * s / 2, y0 || 0, z - N * s / 2, N, H + spire + 2, N, s, { name: 'tower' });
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
function steppedPyramid(x, z, s, base, tiers, tierH, m, stairM, topExtra, stairSide) {
  const st = newStruct(x - base * s / 2, 0, z - base * s / 2, base, tiers * tierH + 5, base, s, { name: 'pyramid' });
  const g = st.grid; let j = 0;
  for (let t = 0; t < tiers; t++) {
    const inset = Math.round(t * base / (2 * tiers + 1));
    for (let y = 0; y < tierH; y++, j++) for (let k = inset; k < base - inset; k++) for (let i = inset; i < base - inset; i++) {
      const edge = i === inset || k === inset || i === base - inset - 1 || k === base - inset - 1 || y === tierH - 1;
      if (!edge) continue;
      let stair = false;
      if (stairM) { if (stairSide === 'w') stair = Math.abs(k - base / 2 + 0.5) < 2 && i <= inset + 1; else stair = Math.abs(i - base / 2 + 0.5) < 2 && k >= base - inset - 2; }
      g.set(i, j, k, stair ? stairM : m);
    }
  }
  if (topExtra) topExtra(g, j);
  return finish(st);
}
// Ferris wheel in the x-y plane (axis along z) or z-y plane (axis along x)
function wheel(x, z, R, s, axis, rimM, cabM, legM, y0) {
  const cy = R + 3 * s;
  return shape(x, y0 || 0, z, axis === 'z' ? 2 * R + 4 * s : 8 * s, cy + R + 2 * s, axis === 'z' ? 8 * s : 2 * R + 4 * s, s, (px, y, pz) => {
    const u = axis === 'z' ? px : pz, w = axis === 'z' ? pz : px;
    const dy = y - cy, d = Math.hypot(u, dy);
    if (Math.abs(w) < s * 1.1 && Math.abs(d - R) < s * 0.6) return rimM;
    if (Math.abs(w) < s * 0.6 && d < R) { const a = Math.atan2(dy, u); const sp = ((a / (Math.PI * 2)) * 16 % 1 + 1) % 1; if (sp < 0.09 || sp > 0.91) return rimM; if (d < s * 1.2) return legM; }
    if (Math.abs(w) < s * 2.6 && Math.abs(w) > s * 1.1) { // cabins
      const a = Math.atan2(dy, u); const n = Math.round(a / (Math.PI * 2) * 16); const ca = n / 16 * Math.PI * 2; const cxp = Math.cos(ca) * (R + s), cyp = Math.sin(ca) * (R + s);
      if (Math.abs(u - cxp) < s * 1.1 && Math.abs(dy - cyp) < s * 1.1) return cabM;
    }
    // A-frame legs
    if (y < cy && Math.abs(Math.abs(w) - s * 2) < s * 0.7) { const t = 1 - y / cy; if (Math.abs(Math.abs(u) - t * R * 0.45) < s * 0.8) return legM; }
    return 0;
  }, { name: 'wheel' });
}
SKY.WB = { newStruct, finish, building, blockStruct, shape, smallBox, latticeTower, steppedPyramid, wheel, writeText, writeTextZ, writeTextX, textW, paint, get city() { return curCity; } };

// ---------- ground decal builder (merged, vertex coloured) ----------
const _col = new THREE.Color();
class GB {
  constructor() { this.p = []; this.c = []; }
  tri(ax, az, bx, bz, cx, cz, y, r, g, b) {
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) { const tx = bx, tz = bz; bx = cx; bz = cz; cx = tx; cz = tz; }
    this.p.push(ax, y, az, bx, y, bz, cx, y, cz); this.c.push(r, g, b, r, g, b, r, g, b);
  }
  quad(pts, y, col) { _col.setHex(col); const [a, b, c, d] = pts; this.tri(a[0], a[1], b[0], b[1], c[0], c[1], y, _col.r, _col.g, _col.b); this.tri(a[0], a[1], c[0], c[1], d[0], d[1], y, _col.r, _col.g, _col.b); }
  rect(x0, z0, x1, z1, y, col) { this.quad([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, col); }
  seg(ax, az, bx, bz, w, y, col, ext) {
    let dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; const e = ext || 0;
    ax -= dx * e; az -= dz * e; bx += dx * e; bz += dz * e; const nx = -dz * w / 2, nz = dx * w / 2;
    this.quad([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], y, col);
  }
  line(pts, w, y, col) { for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, y, col, w * 0.5); }
  dashes(pts, w, y, col, on, off) {
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1]; const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = carry; t < L; t += on + off) { const t1 = Math.min(L, t + on); this.seg(ax + ux * t, az + uz * t, ax + ux * t1, az + uz * t1, w, y, col); carry = t + on + off - L; }
    }
  }
  poly(pts, y, col) { _col.setHex(col); for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], y, _col.r, _col.g, _col.b); }
  circle(x, z, r, y, col, n) { n = n || 28; const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); } this.poly(pts, y, col); }
  ellipse(x, z, rx, rz, y, col, n) { n = n || 32; const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([x + Math.cos(a) * rx, z + Math.sin(a) * rz]); } this.poly(pts, y, col); }
  ring(x, z, r0, r1, y, col, n) { n = n || 32; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; this.quad([[x + Math.cos(a) * r0, z + Math.sin(a) * r0], [x + Math.cos(a) * r1, z + Math.sin(a) * r1], [x + Math.cos(b) * r1, z + Math.sin(b) * r1], [x + Math.cos(b) * r0, z + Math.sin(b) * r0]], y, col); } }
  // pixel text on the ground: origin = top-left, R = reading direction, D = "down" direction (unit vectors), cell size cw x ch
  text(str, ox, oz, Rx, Rz, Dx, Dz, cw, ch, y, col) {
    const F = SKY.FONT; let p = 0;
    for (const chr of str) { const f = F[chr] || F[' ']; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') { const u0 = (p + c) * cw, v0 = r * ch; const P = (u, v) => [ox + Rx * u + Dx * v, oz + Rz * u + Dz * v]; this.quad([P(u0, v0), P(u0 + cw, v0), P(u0 + cw, v0 + ch), P(u0, v0 + ch)], y, col); } p += 4; }
  }
  mesh(mat) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry(); const pos = new Float32Array(this.p); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}
SKY.GB = GB;
const LAYER_MATS = [];
function layerMat(i) { return LAYER_MATS[i] || (LAYER_MATS[i] = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 - i, polygonOffsetUnits: -2 - i * 2 })); }
// ground layers: 0 urban base, 1 parks/plazas/apron, 2 water, 3 roads/runways, 4 markings
const LY = [0.04, 0.07, 0.1, 0.13, 0.16];
const LY7 = [0.025, 0.04, 0.07, 0.1, 0.115, 0.13, 0.16];
const AREA = { urban: [0, null], grass: [0, 0x7fa85a], park: [1, 0x5a9e48], plaza: [1, 0xcbbf9f], beach: [1, 0xe6d39a], lakebed: [1, 0xe6dfcf], apron: [1, 0xa4a7ab], parking: [1, 0x737679], dirt: [1, 0xc8a874], sand: [1, 0xdcc48e], water: [2, 0x2f74b5], dark: [1, 0x4b7f3e] };
const ROADW = { street: 10, ave: 18, blvd: 26, fwy: 30, path: 4, alley: 6, strip: 36, taxi: 23, runway: 50 };
const ROADC = { street: 0x505359, ave: 0x505359, blvd: 0x505359, fwy: 0x505359, path: 0xb9a77f, alley: 0x505359, strip: 0x505359, taxi: 0x6c6f74, runway: 0x3a3d42 }; // same asphalt so overlapping intersections never z-fight

// ---------- planner (per city, at load: cheap data only) ----------
class Planner {
  constructor(c) {
    this.c = c; this.r = rng(c.seed); this.low = SKY.lowSpec;
    this.ops = [[], [], [], [], []]; this.roads = []; this.lms = []; this.districts = []; this.specs = []; this.reserves = [];
    this.palms = []; this.trees = []; this.lamps = []; this.labels = []; this.walks = []; this.extraJobs = []; this.anims = []; this.cones = [];
  }
  X(x) { return this.c.x + x; } Z(z) { return this.c.z + z; }
  W(pts) { return pts.map((p) => [this.c.x + p[0], this.c.z + p[1]]); }
  area(kind, sh, col) {
    const a = AREA[kind] || AREA.urban; const color = col || a[1] || this.c.urban; const L = a[0];
    const o = { L, col: color, kind };
    if (sh.rect) o.rect = [this.X(sh.rect[0]), this.Z(sh.rect[1]), this.X(sh.rect[2]), this.Z(sh.rect[3])];
    if (sh.circle) o.circle = [this.X(sh.circle[0]), this.Z(sh.circle[1]), sh.circle[2]];
    if (sh.ellipse) o.ellipse = [this.X(sh.ellipse[0]), this.Z(sh.ellipse[1]), sh.ellipse[2], sh.ellipse[3]];
    if (sh.poly) o.poly = this.W(sh.poly);
    this.ops[L].push(o);
    if (kind === 'water') {
      if (o.rect) W.waterPatches.push({ x0: Math.min(o.rect[0], o.rect[2]), x1: Math.max(o.rect[0], o.rect[2]), z0: Math.min(o.rect[1], o.rect[3]), z1: Math.max(o.rect[1], o.rect[3]) });
      if (o.circle) W.waterCircles.push({ x: o.circle[0], z: o.circle[1], r: o.circle[2] });
    }
    if (kind !== 'urban' && kind !== 'grass') this.reserves.push(o);
    return o;
  }
  water(x0, z0, x1, z1) { return this.area('water', { rect: [x0, z0, x1, z1] }); }
  land(x0, z0, x1, z1, kind) { W.landPatches.push({ x0: this.X(x0), z0: this.Z(z0), x1: this.X(x1), z1: this.Z(z1) }); this.ops[2].push({ L: 2, rect: [this.X(x0), this.Z(z0), this.X(x1), this.Z(z1)], col: (kind && AREA[kind] && AREA[kind][1]) || this.c.urban, over: true }); }
  river(pts, w) {
    const P = this.W(pts); const r = { pts: P, hw: w / 2, x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
    for (const p of P) { r.x0 = Math.min(r.x0, p[0] - w); r.x1 = Math.max(r.x1, p[0] + w); r.z0 = Math.min(r.z0, p[1] - w); r.z1 = Math.max(r.z1, p[1] + w); }
    W.rivers.push(r); const o = { L: 2, line: P, w, col: AREA.water[1] }; this.ops[2].push(o); this.reserves.push({ line: P, w: w + 16 });
    return r;
  }
  road(pts, kind, opts) {
    const w = (opts && opts.w) || ROADW[kind] || 10; const P = this.W(pts);
    const L = kind === 'path' ? 4 : 3; const o = { L, line: P, w, col: (opts && opts.col) || ROADC[kind] || ROADC.street, kind };
    this.ops[L].push(o); this.reserves.push({ line: P, w: w + 6 });
    const traffic = opts && opts.traffic !== undefined ? opts.traffic : (kind === 'ave' || kind === 'blvd' || kind === 'fwy' || kind === 'strip');
    const rd = { pts: P, w, kind, traffic, name: opts && opts.name }; this.roads.push(rd);
    if (kind === 'fwy' || kind === 'blvd' || kind === 'strip') this.ops[4].push({ dash: P, w: 0.5, col: 0xf2f2f2, on: 8, off: 10 });
    else if (kind === 'ave') this.ops[4].push({ dash: P, w: 0.4, col: 0xffd23d, on: 6, off: 8 });
    if (opts && opts.palms) this.palmRow(pts, opts.palms, w / 2 + 3);
    if (opts && opts.trees) this.treeRow(pts, opts.trees, w / 2 + 3);
    if (opts && opts.walk !== false && (kind !== 'fwy' && kind !== 'path' && kind !== 'taxi' && kind !== 'runway')) this.walks.push({ pts: P, off: w / 2 + 2.5 });
    if (kind === 'path') this.walks.push({ pts: P, off: 0 });
    return rd;
  }
  grid(x0, z0, x1, z1, dx, dz, kind, opts) { if (dx) for (let x = x0; x <= x1 + 0.1; x += dx) this.road([[x, z0], [x, z1]], kind, opts); if (dz) for (let z = z0; z <= z1 + 0.1; z += dz) this.road([[x0, z], [x1, z]], kind, opts); }
  mark(o) { this.ops[4].push(o); }
  palmRow(pts, sp, off) { this._row(pts, sp, off, this.palms); }
  treeRow(pts, sp, off) { this._row(pts, sp, off, this.trees); }
  _row(pts, sp, off, list) {
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; for (let t = sp / 2; t < L; t += sp) for (const s of off ? [-1, 1] : [0]) list.push([this.X(a[0] + ux * t - uz * off * s), this.Z(a[1] + uz * t + ux * off * s)]); }
  }
  treesIn(x0, z0, x1, z1, n) { for (let i = 0; i < n; i++) this.trees.push([this.X(x0 + this.r() * (x1 - x0)), this.Z(z0 + this.r() * (z1 - z0))]); }
  hill(x, z, r, h, col, cap) { W.hills.push({ x: this.X(x), z: this.Z(z), r, h, col, cap }); }
  // landmark: name (minimap/tourist), local pos, reserve radius, build fn(world x, world z, helpers), impostor [w,h,d,col]
  lm(name, x, z, rr, fn, imp, opts) {
    const o = { name, x: this.X(x), z: this.Z(z), rr, fn, imp, city: this.c, label: opts && opts.label, visit: !(opts && opts.noVisit) && !!name };
    this.lms.push(o); if (rr) this.reserves.push({ circle: [o.x, o.z, rr] });
    if (name && o.visit) W.landmarks.push(o);
    return o;
  }
  reserveRect(x0, z0, x1, z1) { this.reserves.push({ rect: [this.X(x0), this.Z(z0), this.X(x1), this.Z(z1)] }); }
  district(o) { this.districts.push(o); }
  label(x, z, t) { this.labels.push([this.X(x), this.Z(z), t]); }
  job(fn) { this.extraJobs.push(fn); }
  walk(pts) { this.walks.push({ pts: this.W(pts), off: 0 }); }
}
SKY.Planner = Planner;

// raster at 8 m for building placement (summed-area table)
const RS = 8;
function rasterize(P, bx0, bz0, bx1, bz1) {
  const nx = Math.ceil((bx1 - bx0) / RS) + 1, nz = Math.ceil((bz1 - bz0) / RS) + 1;
  const g = new Uint8Array(nx * nz);
  const cell = (x, z) => [Math.floor((x - bx0) / RS), Math.floor((z - bz0) / RS)];
  const fillRect = (x0, z0, x1, z1) => { const [i0, k0] = cell(Math.min(x0, x1), Math.min(z0, z1)), [i1, k1] = cell(Math.max(x0, x1), Math.max(z0, z1)); for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) g[k * nx + i] = 1; };
  const fillCircle = (x, z, r) => { const [i0, k0] = cell(x - r, z - r), [i1, k1] = cell(x + r, z + r); for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) { const cx = bx0 + (i + 0.5) * RS, cz = bz0 + (k + 0.5) * RS; if ((cx - x) ** 2 + (cz - z) ** 2 < (r + RS) ** 2) g[k * nx + i] = 1; } };
  const fillLine = (pts, w) => { for (let s = 0; s < pts.length - 1; s++) { const a = pts[s], b = pts[s + 1]; const hw = w / 2 + RS * 0.75; const [i0, k0] = cell(Math.min(a[0], b[0]) - hw, Math.min(a[1], b[1]) - hw), [i1, k1] = cell(Math.max(a[0], b[0]) + hw, Math.max(a[1], b[1]) + hw); for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) { const cx = bx0 + (i + 0.5) * RS, cz = bz0 + (k + 0.5) * RS; if (segDist2(cx, cz, a, b) < hw * hw) g[k * nx + i] = 1; } } };
  const fillPoly = (pts) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } const [i0, k0] = cell(x0, z0), [i1, k1] = cell(x1, z1); for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) if (inPoly(bx0 + (i + 0.5) * RS, bz0 + (k + 0.5) * RS, pts)) g[k * nx + i] = 1; };
  for (const o of P.reserves) { if (o.rect) fillRect(o.rect[0], o.rect[1], o.rect[2], o.rect[3]); else if (o.circle) fillCircle(o.circle[0], o.circle[1], o.circle[2]); else if (o.ellipse) fillPoly(ellPts(o.ellipse)); else if (o.line) fillLine(o.line, o.w); else if (o.poly) fillPoly(o.poly); }
  const sat = new Int32Array((nx + 1) * (nz + 1)); const W1 = nx + 1;
  for (let k = 0; k < nz; k++) { let row = 0; for (let i = 0; i < nx; i++) { row += g[k * nx + i]; sat[(k + 1) * W1 + i + 1] = sat[k * W1 + i + 1] + row; } }
  return { free(x0, z0, x1, z1) { let [i0, k0] = cell(x0, z0), [i1, k1] = cell(x1, z1); i0 = Math.max(0, i0); k0 = Math.max(0, k0); i1 = Math.min(nx - 1, i1); k1 = Math.min(nz - 1, k1); if (i1 < i0 || k1 < k0) return true; return sat[(k1 + 1) * W1 + i1 + 1] - sat[k0 * W1 + i1 + 1] - sat[(k1 + 1) * W1 + i0] + sat[k0 * W1 + i0] === 0; } };
}
function inPoly(x, z, pts) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
function ellPts(e) { const p = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; p.push([e[0] + Math.cos(a) * e[2], e[1] + Math.sin(a) * e[3]]); } return p; }
W.inPoly = inPoly;

function fillDistricts(P) {
  if (!P.districts.length) return;
  const c = P.c; let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
  for (const d of P.districts) { bx0 = Math.min(bx0, P.X(d.rect[0])); bz0 = Math.min(bz0, P.Z(d.rect[1])); bx1 = Math.max(bx1, P.X(d.rect[2])); bz1 = Math.max(bz1, P.Z(d.rect[3])); }
  const R = rasterize(P, bx0 - 40, bz0 - 40, bx1 + 40, bz1 + 40);
  const taken = new Map(); const TK = 64;
  const overlaps = (x0, z0, x1, z1) => { for (let i = Math.floor(x0 / TK); i <= Math.floor(x1 / TK); i++) for (let k = Math.floor(z0 / TK); k <= Math.floor(z1 / TK); k++) { const a = taken.get(i * 7919 + k); if (a) for (const t of a) if (x0 < t[2] && x1 > t[0] && z0 < t[3] && z1 > t[1]) return true; } return false; };
  const take = (x0, z0, x1, z1) => { for (let i = Math.floor(x0 / TK); i <= Math.floor(x1 / TK); i++) for (let k = Math.floor(z0 / TK); k <= Math.floor(z1 / TK); k++) { const key = i * 7919 + k; let a = taken.get(key); if (!a) taken.set(key, a = []); a.push([x0, z0, x1, z1]); } };
  const r = P.r;
  // phone budget: dense real-world cities are thinned so each city stays around ~300k voxels
  const DENS = { LA: 0.85, LAS: 1, MEX: 0.72, NYC: 0.55, PAR: 0.42, TYO: 0.5 };
  const dm = DENS[c.id] || 1;
  for (const d of P.districts) {
    const s = d.s || 4, lot = d.lot || 40, fill = (d.fill || 0.8) * dm * (P.low ? (d.lowFill || 0.62) : 1);
    for (let lz = d.rect[1] + lot / 2; lz < d.rect[3]; lz += lot) for (let lx = d.rect[0] + lot / 2; lx < d.rect[2]; lx += lot) {
      if (d.poly && !inPoly(lx, lz, d.poly)) continue;
      const hm = d.hf ? d.hf(lx, lz) : 1; if (hm <= 0) continue;
      if (r() > fill * Math.min(1, 0.4 + hm)) continue;
      const maxc = Math.floor((lot - (d.gap || 8)) / s);
      const w = Math.max(3, Math.floor(maxc * (0.65 + r() * 0.35))), dd = Math.max(3, Math.floor(maxc * (0.65 + r() * 0.35)));
      const x = P.X(lx + (r() - 0.5) * (lot - w * s - 4) * 0.5), z = P.Z(lz + (r() - 0.5) * (lot - dd * s - 4) * 0.5);
      const x0 = x - w * s / 2 - 2, x1 = x + w * s / 2 + 2, z0 = z - dd * s / 2 - 2, z1 = z + dd * s / 2 + 2;
      if (!R.free(x0, z0, x1, z1) || overlaps(x0, z0, x1, z1)) continue;
      if (W.isWater(x, z) || W.isWater(x0, z0) || W.isWater(x1, z1) || W.isWater(x0, z1) || W.isWater(x1, z0)) continue;
      if (W.heightAt(x0, z0) > 0.5 || W.heightAt(x1, z1) > 0.5 || W.heightAt(x0, z1) > 0.5 || W.heightAt(x1, z0) > 0.5) continue;
      const h = Math.max(2, Math.round((d.h[0] + (d.h[1] - d.h[0]) * Math.pow(r(), d.pow || 1.6)) * hm));
      const style = d.styles[Math.floor(r() * d.styles.length)];
      take(x0, z0, x1, z1);
      P.specs.push({ x, z, w, d: dd, h, style, s });
    }
  }
}

// ---------- impostor (far LOD): one merged mesh of boxes per city ----------
const IMP_COL = { glass: 0x55667a, tower: 0x50627a, brick: 0x9a5a44, concrete: 0x9ea4ab, paris: 0xd8ccb0, mex: 0xd49a6a, neon: 0x3a3340, casino: 0xd8d0c0, stucco: 0xe6dccb, tokyo: 0xc8cacd, hotel: 0xe0d6c0, brown: 0x8e5040, gold: 0xc9a030, silver: 0xb8bcc2 };
function impMesh(specs, lms, skip) {
  const pos = [], col = [], c = new THREE.Color();
  const box = (x, z, w, h, d, hex) => {
    c.setHex(hex); const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const F = [[[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], 1.0], [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], 0.85], [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], 0.7], [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], 0.8], [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], 0.75]];
    for (const f of F) { const s = f[4]; for (const ix of [0, 1, 2, 0, 2, 3]) { pos.push(...f[ix]); col.push(c.r * s, c.g * s, c.b * s); } }
  };
  for (const b of specs) if (!skip || !skip(b)) box(b.x, b.z, b.w * b.s, b.h * b.s, b.d * b.s, IMP_COL[b.style] || 0x9ea4ab);
  if (lms) for (const l of lms) if (l.imp) box(l.x + (l.imp[4] || 0), l.z + (l.imp[5] || 0), l.imp[0], l.imp[1], l.imp[2], l.imp[3]);
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, IMP_MAT || (IMP_MAT = new THREE.MeshBasicMaterial({ vertexColors: true }))); m.matrixAutoUpdate = false;
  return m;
}
let IMP_MAT = null;
// per-block far LOD: the voxel block is swapped for merged boxes beyond its view range; damaged buildings drop out
function attachImp(c, st, specs) {
  if (!st || !st.grid.group.parent) return;
  st.specs = specs; st.liveSpecs = specs; st.imp = impMesh(specs); if (!st.imp) return;
  st.imp.visible = false; c.group.add(st.imp);
  const tall = specs.length === 1 && specs[0].h > 22;
  st.viewR = SKY.lowSpec ? (tall ? 1300 : 650) : (tall ? 2000 : 1000);
  // far blocks are drawn through ~960 m 'super' impostors (one draw call for up to 16 blocks) when all members are out of voxel range
  if (!c.supers) c.supers = new Map();
  const key = Math.floor(st.cx / 960) * 7919 + Math.floor(st.cz / 960); let S = c.supers.get(key);
  if (!S) c.supers.set(key, S = { members: [], mesh: null, dirty: true, c });
  S.members.push(st); st.sup = S;
  st.onDamage = (s) => { s.impDirty = true; if (s.sup) s.sup.dirty = true; };
}
function refreshImp(st) {
  st.impDirty = false; const g = st.grid, o = st.min, s = g.s;
  const gone = (b) => { const i = Math.floor((b.x - o.x) / s), k = Math.floor((b.z - o.z) / s); for (let j = b.h - 1; j >= Math.max(0, b.h - 3); j--) if (g.get(i, j, k)) return false; return true; };
  st.liveSpecs = st.specs.filter((b) => !gone(b));
  const par = st.imp && st.imp.parent; if (st.imp) { if (par) par.remove(st.imp); st.imp.geometry.dispose(); }
  st.imp = impMesh(st.liveSpecs); if (st.imp && par) { st.imp.visible = false; par.add(st.imp); }
}
function superMesh(S) {
  S.dirty = false; if (S.mesh) { if (S.mesh.parent) S.mesh.parent.remove(S.mesh); S.mesh.geometry.dispose(); S.mesh = null; }
  const all = []; for (const m of S.members) { if (m.impDirty) refreshImp(m); for (const b of m.liveSpecs) all.push(b); }
  S.mesh = impMesh(all); if (S.mesh && S.c.group) { S.mesh.visible = false; S.c.group.add(S.mesh); }
}
function cullSupers(c) {
  if (!c.supers) return;
  for (const S of c.supers.values()) {
    let allHidden = S.members.length > 0; for (const m of S.members) if (m.grid.group.visible) { allHidden = false; break; }
    if (allHidden) { if (S.dirty || !S.mesh) superMesh(S); if (S.mesh) S.mesh.visible = true; for (const m of S.members) if (m.imp) m.imp.visible = false; }
    else { if (S.mesh) S.mesh.visible = false; for (const m of S.members) { const vis = m.grid.group.visible; if (!vis && m.impDirty) refreshImp(m); if (m.imp) m.imp.visible = !vis; } }
  }
}
function buildImpostor(P) {
  const pos = [], col = [], c = new THREE.Color();
  const box = (x, z, w, h, d, hex) => {
    c.setHex(hex); const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const F = [[[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], 1.0], [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], 0.85], [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], 0.7], [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], 0.8], [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], 0.75]];
    for (const f of F) { const s = f[4]; for (const ix of [0, 1, 2, 0, 2, 3]) { pos.push(...f[ix]); col.push(c.r * s, c.g * s, c.b * s); } }
  };
  for (const b of P.specs) box(b.x, b.z, b.w * b.s, b.h * b.s, b.d * b.s, IMP_COL[b.style] || 0x9ea4ab);
  for (const l of P.lms) if (l.imp) box(l.x + (l.imp[4] || 0), l.z + (l.imp[5] || 0), l.imp[0], l.imp[1], l.imp[2], l.imp[3]);
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })); m.matrixAutoUpdate = false;
  return m;
}

// ---------- local city map (minimap zoom) ----------
function buildCityMap(P) {
  const c = P.c; const size = 9000, N = 512; const cx = c.apt ? (c.x + c.ax) / 2 : c.x, cz = c.apt ? (c.z + c.az) / 2 : c.z;
  const x0 = cx - size / 2, z0 = cz - size / 2, sc = N / size;
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N; const x = cv.getContext('2d');
  const tx = (v) => (v - x0) * sc, tz = (v) => (v - z0) * sc;
  const hex = (h) => '#' + ('000000' + (h || 0).toString(16)).slice(-6);
  for (let L = 0; L < 4; L++) for (const o of P.ops[L]) {
    x.fillStyle = hex(o.col); x.strokeStyle = hex(o.col);
    if (o.rect) x.fillRect(tx(Math.min(o.rect[0], o.rect[2])), tz(Math.min(o.rect[1], o.rect[3])), Math.abs(o.rect[2] - o.rect[0]) * sc, Math.abs(o.rect[3] - o.rect[1]) * sc);
    else if (o.circle) { x.beginPath(); x.arc(tx(o.circle[0]), tz(o.circle[1]), o.circle[2] * sc, 0, 6.29); x.fill(); }
    else if (o.ellipse) { x.beginPath(); x.ellipse(tx(o.ellipse[0]), tz(o.ellipse[1]), o.ellipse[2] * sc, o.ellipse[3] * sc, 0, 0, 6.29); x.fill(); }
    else if (o.poly) { x.beginPath(); o.poly.forEach((p, i) => (i ? x.lineTo(tx(p[0]), tz(p[1])) : x.moveTo(tx(p[0]), tz(p[1])))); x.fill(); }
    else if (o.line) { x.lineWidth = Math.max(1, o.w * sc * (L === 3 ? 1.6 : 1)); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); o.line.forEach((p, i) => (i ? x.lineTo(tx(p[0]), tz(p[1])) : x.moveTo(tx(p[0]), tz(p[1])))); x.stroke(); }
  }
  x.fillStyle = 'rgba(70,70,80,0.9)';
  for (const b of P.specs) x.fillRect(tx(b.x - b.w * b.s / 2), tz(b.z - b.d * b.s / 2), Math.max(1, b.w * b.s * sc), Math.max(1, b.d * b.s * sc));
  c.mapCv = cv; c.mapB = { x0, z0, size };
}

// ---------- build / unload (lazy, time-sliced) ----------
const jobs = [];
const decoGeo = {};
function decoMeshes(c, P) {
  const low = SKY.lowSpec; const out = [];
  const inst = (key, geoFn, mat, list, y, fn) => { if (!list.length) return; const geo = decoGeo[key] || (decoGeo[key] = geoFn()); const im = new THREE.InstancedMesh(geo, mat, list.length); const m4 = new THREE.Matrix4(); list.forEach((p, i) => { m4.makeTranslation(p[0], y + (p[2] || 0), p[1]); if (fn) fn(m4, i, p); im.setMatrixAt(i, m4); }); im.computeBoundingSphere && im.computeBoundingSphere(); im.frustumCulled = false; c.group.add(im); out.push(im); return im; };
  const palms = low ? P.palms.filter((_, i) => i % 2 === 0) : P.palms, trees = low ? P.trees.filter((_, i) => i % 2 === 0) : P.trees;
  const ph = (p) => W.heightAt(p[0], p[1]);
  const sc = new THREE.Matrix4();
  inst('palmT', () => new THREE.BoxGeometry(1.2, 14, 1.2), mats.trunk, palms, 7, (m, i, p) => m.elements[13] += ph(p));
  inst('palmL', () => { const g = new THREE.BoxGeometry(8, 1.2, 2.2); const g2 = new THREE.BoxGeometry(2.2, 1.2, 8); const m = mergeGeos([g, g2]); return m; }, mats.palm, palms, 14.5, (m, i, p) => { m.elements[13] += ph(p); sc.makeRotationY(i * 0.7); m.multiply(sc); });
  inst('tree', () => new THREE.BoxGeometry(6, 7, 6), mats.tree, trees, 5.5, (m, i, p) => { m.elements[13] += ph(p); const s = 0.75 + ((i * 37) % 10) / 20; m.multiply(sc.makeScale(s, s, s)); });
  inst('trunk', () => new THREE.BoxGeometry(0.9, 2.5, 0.9), mats.trunk, trees, 1.25, (m, i, p) => m.elements[13] += ph(p));
  if (P.lights && P.lights.length) {
    const im = inst('light', () => new THREE.BoxGeometry(0.9, 0.5, 0.9), mats.light, P.lights, 0.35);
    if (im) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P.lights.length * 3), 3); const cc = new THREE.Color(); P.lights.forEach((l, i) => { cc.setHex(l[3] || 0xffe066); im.instanceColor.setXYZ(i, cc.r, cc.g, cc.b); }); }
  }
  if (P.cones.length) inst('cone', () => new THREE.BoxGeometry(1.5, 1, 1.5), mats.light, P.cones, 0.5);
  return out;
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) { const p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); } const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); off += p.length / 3; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
SKY.mergeGeos = mergeGeos;
const mats = {};
function initMats() {
  mats.trunk = new THREE.MeshLambertMaterial({ color: 0x7b5a3a }); mats.palm = new THREE.MeshLambertMaterial({ color: 0x3f9a3a }); mats.tree = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  mats.light = new THREE.MeshBasicMaterial({ color: 0xffffff });
}
W.mats = mats;

function groundMeshes(c, P) {
  // land patches (islands, reclaimed airports): cut them out of rectangular water so nothing below (aprons, parks) is overpainted;
  // patches over round/river water go to an extra 'over' layer drawn between water and roads
  const lands = P.ops[2].filter((o) => o.over), waters = P.ops[2].filter((o) => !o.over);
  const ovl = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const cut = (r, l) => { if (!ovl(r, l)) return [r]; const out = []; if (l[0] > r[0]) out.push([r[0], r[1], l[0], r[3]]); if (l[2] < r[2]) out.push([l[2], r[1], r[2], r[3]]); const x0 = Math.max(r[0], l[0]), x1 = Math.min(r[2], l[2]); if (l[1] > r[1]) out.push([x0, r[1], x1, l[1]]); if (l[3] < r[3]) out.push([x0, l[3], x1, r[3]]); return out; };
  const bbox = (o) => o.rect ? o.rect : o.circle ? [o.circle[0] - o.circle[2], o.circle[1] - o.circle[2], o.circle[0] + o.circle[2], o.circle[1] + o.circle[2]] : o.ellipse ? [o.ellipse[0] - o.ellipse[2], o.ellipse[1] - o.ellipse[3], o.ellipse[0] + o.ellipse[2], o.ellipse[1] + o.ellipse[3]] : o.line ? o.line.reduce((b, q) => [Math.min(b[0], q[0] - o.w), Math.min(b[1], q[1] - o.w), Math.max(b[2], q[0] + o.w), Math.max(b[3], q[1] + o.w)], [1e9, 1e9, -1e9, -1e9]) : null;
  const ops = [[], P.ops[0], P.ops[1], [], [], P.ops[3], P.ops[4]];
  for (const o of waters) {
    if (!o.rect) { ops[3].push(o); continue; }
    let rs = [[Math.min(o.rect[0], o.rect[2]), Math.min(o.rect[1], o.rect[3]), Math.max(o.rect[0], o.rect[2]), Math.max(o.rect[1], o.rect[3])]];
    for (const l of lands) { const lr = [Math.min(l.rect[0], l.rect[2]), Math.min(l.rect[1], l.rect[3]), Math.max(l.rect[0], l.rect[2]), Math.max(l.rect[1], l.rect[3])]; rs = rs.flatMap((r) => cut(r, lr)); }
    for (const r of rs) if (r[2] - r[0] > 0.5 && r[3] - r[1] > 0.5) ops[3].push({ rect: r, col: o.col });
  }
  for (const l of lands) { const lr = [Math.min(l.rect[0], l.rect[2]), Math.min(l.rect[1], l.rect[3]), Math.max(l.rect[0], l.rect[2]), Math.max(l.rect[1], l.rect[3])]; const under = waters.some((w) => !w.rect && bbox(w) && ovl(bbox(w), lr)); if (under) ops[4].push(l); else ops[0].push(l); }
  const gbs = [new GB(), new GB(), new GB(), new GB(), new GB(), new GB(), new GB()];
  for (let L = 0; L < 7; L++) for (const o of ops[L]) {
    const g = gbs[L], y = LY7[L];
    if (o.rect) g.rect(o.rect[0], o.rect[1], o.rect[2], o.rect[3], y, o.col);
    else if (o.circle) g.circle(o.circle[0], o.circle[1], o.circle[2], y, o.col, o.n || 28);
    else if (o.ellipse) g.ellipse(o.ellipse[0], o.ellipse[1], o.ellipse[2], o.ellipse[3], y, o.col);
    else if (o.poly) g.poly(o.poly, y, o.col);
    else if (o.line) g.line(o.line, o.w, y, o.col);
    else if (o.dash) g.dashes(o.dash, o.w, y, o.col, o.on, o.off);
    else if (o.seg) g.seg(o.seg[0], o.seg[1], o.seg[2], o.seg[3], o.w, y, o.col, o.ext);
    else if (o.ring) g.ring(o.ring[0], o.ring[1], o.ring[2], o.ring[3], y, o.col);
    else if (o.text) g.text(o.text, o.ox, o.oz, o.R[0], o.R[1], o.D[0], o.D[1], o.cw, o.ch, y, o.col);
    else if (o.quad) g.quad(o.quad, y, o.col);
  }
  const out = [];
  gbs.forEach((g, i) => { const m = g.mesh(layerMat(i)); if (m) { m.position.y = 0.012 * (i + 1); m.updateMatrix(); m.matrixAutoUpdate = false; m.renderOrder = -10 + i; c.group.add(m); out.push(m); } });
  return out;
}

W.buildCity = function (c, sync) {
  if (c.built) { if (sync) W.flushCity(c); return; }
  c.built = true; c.complete = false; c.group = new THREE.Group(); c.group.matrixAutoUpdate = false; W.scene.add(c.group); c.structs = [];
  c.builtAt = performance.now();
  const P = c.plan;
  const q = [];
  q.push(() => { c.ground = groundMeshes(c, P); });
  for (const l of P.lms) q.push(() => { try { l.fn(l.x, l.z, c, l); } catch (e) { console.warn('landmark ' + l.name + ' failed: ' + e.message); } });
  // district buildings: pack into ~160 m block grids; tall ones alone
  const blocks = new Map();
  for (const b of P.specs) {
    if (b.h > 22) { q.push(() => attachImp(c, building(b.x, b.z, b.w, b.d, b.h, b.style, P.r, b.s), [b])); continue; }
    const key = Math.floor(b.x / 240) * 9973 + Math.floor(b.z / 240); let a = blocks.get(key); if (!a) blocks.set(key, a = []); a.push(b);
  }
  for (const a of blocks.values()) q.push(() => attachImp(c, blockStruct(a, P.r), a));
  for (const f of P.extraJobs) q.push(() => f(c));
  q.push(() => { c.deco = decoMeshes(c, P); if (SKY.Ambient) SKY.Ambient.initCity(c); });
  q.push(() => { c.complete = true; if (c.impostor) c.impostor.visible = false; c.buildMs = performance.now() - c.builtAt; });
  for (const f of q) jobs.push({ c, f });
  if (sync) W.flushCity(c);
};
W.flushCity = (c) => { const prev = curCity; for (let i = 0; i < jobs.length; i++) if (jobs[i].c === c) { curCity = c; jobs[i].f(); jobs.splice(i, 1); i--; } curCity = prev; };
W.ensureCity = (c) => { if (!c.built) W.buildCity(c, true); else W.flushCity(c); };
W.unloadCity = function (c) {
  if (!c.built) return;
  for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].c === c) jobs.splice(i, 1);
  for (const st of c.structs.slice()) removeStruct(st);
  c.structs = [];
  W.interactables = W.interactables.filter((it) => it.city !== c);
  if (SKY.Ambient) SKY.Ambient.dropCity(c);
  if (SKY.Airport) SKY.Airport.dropCity(c);
  c.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh && o.geometry && !Object.values(decoGeo).includes(o.geometry)) o.geometry.dispose(); });
  W.scene.remove(c.group); c.group = null; c.built = false; c.complete = false; c.supers = null;
  if (c === W.saucerCity) W.saucer = null;
  if (c.impostor) c.impostor.visible = true;
};
function runJobs(budgetMs) {
  const t0 = performance.now(); const prev = curCity;
  while (jobs.length && performance.now() - t0 < budgetMs) { const j = jobs.shift(); curCity = j.c; j.f(); }
  curCity = prev;
}
W.pendingJobs = () => jobs.length;
// run builder code (WB.finish etc.) on behalf of a city outside the job queue (enterable interiors)
W.withCity = (c, fn) => { const prev = curCity; curCity = c; try { return fn(); } finally { curCity = prev; } };

W.build = function (scene) {
  const low = SKY.lowSpec;
  W.scene = scene; initMats();
  // --- plan all zones (data only; cheap) ---
  for (const c of CITIES) {
    const P = new Planner(c); c.plan = P; curCity = c;
    if (SKY.CityDefs && SKY.CityDefs[c.id]) SKY.CityDefs[c.id](P, c, P.r, low);
    if (SKY.Airport && c.aptDef) SKY.Airport.plan(P, c, c.aptDef);
    if (SKY.Places) SKY.Places.plan(P, c);
    fillDistricts(P);
    P.lights = P.lights || [];
    if (SKY.Airport && c.apt) SKY.Airport.planLights(P, c);
  }
  curCity = null;
  // --- ground mesh (vertex coloured) ---
  const X0 = -50000, X1 = 82000, Z0 = -40000, Z1 = 40000, SX = low ? 88 : 132, SZ = low ? 54 : 80;
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SX, SZ); geo.rotateX(-Math.PI / 2); geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); W.groundColor(x, z, col); cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(ground); W.ground = ground;
  // --- far impostors + local maps ---
  for (const c of CITIES) { c.impostor = buildImpostor(c.plan); if (c.impostor) scene.add(c.impostor); buildCityMap(c.plan); }
  // --- hills ---
  for (const h of W.hills) {
    const cg = new THREE.ConeGeometry(h.r, h.h, 12, 1).toNonIndexed(); cg.computeVertexNormals(); const m = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: h.col }));
    m.position.set(h.x, h.h / 2, h.z); scene.add(m);
    if (h.cap) { const cpg = new THREE.ConeGeometry(h.r * 0.3, h.h * 0.3, 12, 1).toNonIndexed(); cpg.computeVertexNormals(); const cp = new THREE.Mesh(cpg, new THREE.MeshLambertMaterial({ color: 0xffffff })); cp.position.set(h.x, h.h * 0.85 + 2, h.z); cp.scale.setScalar(1.02); scene.add(cp); }
  }
  // clouds
  const cl = []; const r = rng(99);
  for (let q = 0; q < (low ? 70 : 160); q++) { const cx = -45000 + r() * 125000, cz = -35000 + r() * 70000, cy = 900 + r() * 900; for (let b = 0; b < 4; b++) cl.push([cx + (r() - 0.5) * 300, cz + (r() - 0.5) * 200, cy + (r() - 0.5) * 60, 120 + r() * 200]); }
  const cim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), cl.length);
  const m4 = new THREE.Matrix4(); cl.forEach((c, i) => { m4.makeScale(c[3], c[3] * 0.25, c[3] * 0.7); m4.setPosition(c[0], c[2], c[1]); cim.setMatrixAt(i, m4); }); cim.frustumCulled = false; scene.add(cim); W.clouds = cl;
  W.buildMapCanvas();
  // the title scene sits at LA
  W.buildCity(W.city('LA'), true);
};
W.groundColor = (x, z, out) => {
  if (!W.isLand(x, z)) { out.setHex(0x2f74b5); const n = Math.sin(x * 0.0013) * Math.cos(z * 0.0011) * 0.05; out.offsetHSL(0, 0, n); return out; }
  const { city } = W.nearestCity(x, z); out.setHex(city.biome);
  const n = (Math.sin(x * 0.0021 + z * 0.0013) + Math.cos(z * 0.0027 - x * 0.0009)) * 0.04; out.offsetHSL(0, 0, n);
  let near = false; for (const s of [[-600, 0], [600, 0], [0, -600], [0, 600]]) if (!W.isLand(x + s[0], z + s[1])) near = true;
  if (near) out.setHex(0xe6d39a);
  return out;
};
W.buildMapCanvas = () => {
  const cv = document.createElement('canvas'); cv.width = 528; cv.height = 320; const x = cv.getContext('2d');
  const col = new THREE.Color();
  for (let py = 0; py < 160; py++) for (let px = 0; px < 264; px++) { const wx = -50000 + px * 500, wz = -40000 + py * 500; W.groundColor(wx, wz, col); if (W.isWater(wx, wz)) col.setHex(0x2f74b5); x.fillStyle = '#' + col.getHexString(); x.fillRect(px * 2, py * 2, 2, 2); }
  W.mapCanvas = cv; W.mapBounds = { x0: -50000, z0: -40000, w: 132000, h: 80000 };
};

// ---------- queries ----------
const _p = new THREE.Vector3(), _d = new THREE.Vector3();
W.solidAt = (x, y, z) => {
  let hit = null;
  query(x, z, x, z, (s) => { if (x < s.min.x || y < s.min.y || z < s.min.z || x > s.max.x || y > s.max.y || z > s.max.z) return false; const g = s.grid, o = g.group.position; if (g.solid(x - o.x, y - o.y, z - o.z)) { hit = s; return true; } return false; });
  return hit;
};
W.segmentHit = (a, b) => {
  const minx = Math.min(a.x, b.x), maxx = Math.max(a.x, b.x), miny = Math.min(a.y, b.y), maxy = Math.max(a.y, b.y), minz = Math.min(a.z, b.z), maxz = Math.max(a.z, b.z);
  _d.subVectors(b, a); const len = _d.length(); if (len < 1e-6) return null; _d.divideScalar(len);
  let best = null;
  query(minx, minz, maxx, maxz, (s) => {
    if (maxx < s.min.x || minx > s.max.x || maxy < s.min.y || miny > s.max.y || maxz < s.min.z || minz > s.max.z) return false;
    const o = s.grid.group.position; _p.subVectors(a, o);
    const h = s.grid.raycast(_p, _d, len);
    if (h && (!best || h.dist < best.dist)) best = { st: s, id: h.id, dist: h.dist, point: a.clone().addScaledVector(_d, h.dist), n: new THREE.Vector3(h.nx, h.ny, h.nz) };
    return false;
  });
  return best;
};
W.damage = (pt, r, power, vel, fx) => {
  let total = 0; const hits = [];
  query(pt.x - r, pt.z - r, pt.x + r, pt.z + r, (s) => { if (!(pt.x + r < s.min.x || pt.x - r > s.max.x || pt.y + r < s.min.y || pt.y - r > s.max.y || pt.z + r < s.min.z || pt.z - r > s.max.z)) hits.push(s); return false; });
  for (const s of hits) {
    const o = s.grid.group.position; _p.subVectors(pt, o);
    const rem = s.grid.damageSphere(_p, Math.max(r, s.grid.s * 0.6), power);
    if (!rem.length) continue; total += rem.length;
    if (fx) for (let q = 0; q < Math.min(rem.length, SKY.lowSpec ? 10 : 24); q++) { const e = rem[q]; fx.chip.spawn(e.x + o.x, e.y + o.y, e.z + o.z, (vel ? vel.x * 0.3 : 0) + rand(-6, 6), rand(2, 10), (vel ? vel.z * 0.3 : 0) + rand(-6, 6), rand(2, 4), s.grid.s * rand(0.3, 0.7), e.col); }
    if (fx && rem.length > 3) for (let q = 0; q < 4; q++) fx.smoke.spawn(pt.x + rand(-r, r), pt.y + rand(-r, r) * 0.5, pt.z + rand(-r, r), rand(-2, 2), rand(1, 3), rand(-2, 2), rand(3, 6), s.grid.s * 1.5, 0x9a9a9a);
    W.checkSupport(s, vel);
    if (s.onDamage) s.onDamage(s);
  }
  return total;
};
W.checkSupport = (s, vel) => {
  if (s.anchorJ < 0) return;
  const g = s.grid;
  const comps = g.floating((id) => (id / g.nx | 0) % g.ny === 0);
  for (const comp of comps) {
    if (comp.length < 3) { for (const id of comp) g.remove(id); continue; }
    if (comp.length > 6000) continue; // huge chunks stay put (cartoon physics)
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
let cullT = 0;
W.update = (dt, camPos, focus) => {
  const low = SKY.lowSpec; const far = low ? 11000 : 17000;
  const BUILD = low ? 6500 : 8500, UNLOAD = low ? 9500 : 12000;
  const fp = focus || camPos;
  for (const c of CITIES) {
    const d = Math.min(W.zoneDist(c, camPos.x, camPos.z), W.zoneDist(c, fp.x, fp.z));
    if (!c.built && d < BUILD) W.buildCity(c, false);
    else if (c.built && d > UNLOAD) W.unloadCity(c);
    if (c.group) c.group.visible = d < far + 2000;
    if (c.impostor) c.impostor.visible = (!c.complete) && d < far + 3000;
  }
  runJobs(low ? 5 : 9);
  // per-struct distance culling (small things vanish first)
  cullT -= dt;
  if (cullT <= 0) {
    cullT = 0.25;
    for (const s of W.structs) { if (!s.viewR) continue; const dx = s.cx - camPos.x, dz = s.cz - camPos.z, dy = Math.max(0, camPos.y - (s.imp ? 150 : 400)) * 0.5; const vis = dx * dx + dz * dz + dy * dy < s.viewR * s.viewR; s.grid.group.visible = vis; if (s.specs && !s.sup) { if (!vis && s.impDirty) refreshImp(s); if (s.imp) s.imp.visible = !vis; } }
    for (const c of CITIES) if (c.built) cullSupers(c);
  }
  for (const d of W.debris) d.step(dt, W);
  for (let i = W.debris.length - 1; i >= 0; i--) if (W.debris[i].age > 90) { W.debris[i].dispose(); W.debris.splice(i, 1); }
  // saucer
  const S = W.saucer;
  if (S && S.st.grid.count > 0 && S.st.grid.meshes.some((m) => m)) {
    const g = S.st.grid.group; S.t += dt;
    if (S.state === 'rising') { g.position.y += dt * 8; if (g.position.y > S.home.y + 120) { S.state = 'hover'; S.t = 0; } }
    else if (S.state === 'hover') { g.position.x = S.home.x + Math.sin(S.t * 0.25) * 600; g.position.z = S.home.z + Math.cos(S.t * 0.25) * 600; g.position.y = S.home.y + 120 + Math.sin(S.t) * 10; }
    S.st.min.copy(g.position); S.st.max.set(g.position.x + 19, g.position.y + 7, g.position.z + 19); S.st.cx = g.position.x; S.st.cz = g.position.z;
  }
};
// stats for perf testing
W.stats = () => { let vox = 0, drawn = 0, meshes = 0, cells = 0, vis = 0, imps = 0; for (const s of W.structs) { vox += s.grid.count; cells += s.grid.n; const dr = s.grid.drawn(); drawn += dr; if (s.grid.group.visible) vis += dr; if (s.imp && s.imp.visible) imps++; if (s.sup && s.sup.mesh && s.sup.mesh.visible && s.sup.members[0] === s) imps++; meshes += s.grid.meshes.filter((m) => m).length; } return { structs: W.structs.length, vox, drawn, visDrawn: vis, imps, cellsM: +(cells / 1e6).toFixed(1), meshes, built: CITIES.filter((c) => c.built).map((c) => c.id), jobs: jobs.length }; };
})();

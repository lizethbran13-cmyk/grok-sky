'use strict';
// GROK SKY - mini cities laid out like the real ones (compressed). Local coords: +x east, +z south (north = -z).
// Each def plans roads / areas / water / landmarks / districts; voxels are only built when you get near (see world.js).
(() => {
const WB = SKY.WB, W = SKY.World;
const D = SKY.CityDefs = {};
const hyp = Math.hypot;
// ---- shared landmark helpers (world coords) ----
const glassTower = (x, z, w, d, h, style) => WB.building(x, z, w, d, h, style || 'glass');
function signBoard(x, y, z, lines, s, board, ink, facing, opts) { // facing: 's' (readable from south), 'n', 'e', 'w'
  const sc = lines.map((l) => (l.sc || 1));
  const wid = Math.max(...lines.map((l, i) => WB.textW(l.t, sc[i]))) + 4, hgt = lines.reduce((a, l, i) => a + 5 * sc[i] + 2, 2);
  const alongX = facing === 's' || facing === 'n';
  const nx = alongX ? wid : 2, nz = alongX ? 2 : wid;
  return WB.smallBox(x, y, z, nx, hgt + (opts && opts.legs ? 0 : 0), nz, s, (g) => {
    for (let j = 0; j < hgt; j++) for (let a = 0; a < wid; a++) { if (opts && opts.diamond) { const u = Math.abs(a - wid / 2) / (wid / 2), v = Math.abs(j - hgt / 2) / (hgt / 2); if (u * 0.35 + v > 1.15) continue; } const m = (opts && opts.bulbs && (a === 0 || a === wid - 1 || j === 0 || j === hgt - 1)) ? ((a + j) % 2 ? 32 : 57) : board; if (alongX) g.set(a, j, facing === 's' ? 0 : 1, m); else g.set(facing === 'e' ? 0 : 1, j, a, m); }
    let j0 = hgt - 2;
    lines.forEach((l, i) => {
      j0 -= 5 * sc[i]; const tw = WB.textW(l.t, sc[i]); const a0 = Math.floor((wid - tw) / 2); const col = l.m || ink;
      if (facing === 's') WB.writeTextX(g, a0, j0, 1, l.t, col, 1, sc[i]);
      else if (facing === 'n') WB.writeTextX(g, wid - 1 - a0, j0, 0, l.t, col, -1, sc[i]);
      else if (facing === 'e') WB.writeTextZ(g, l.t, 1, j0, wid - 1 - a0, col, -1, sc[i]);
      else WB.writeTextZ(g, l.t, 0, j0, a0, col, 1, sc[i]);
      j0 -= 2;
    });
  }, { name: 'sign' });
}
SKY.signBoard = signBoard;
const onHill = (x, z) => W.heightAt(x, z);
// sampled 3D curve -> cells close to it (coasters, cables)
function curveStruct(pts, s, rad, mat, opts) {
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
  x0 -= rad + s; z0 -= rad + s; x1 += rad + s; z1 += rad + s; y1 += rad + s; const yb = Math.max(0, y0 - rad - s);
  const st = WB.newStruct(Math.floor(x0), opts && opts.y0 !== undefined ? opts.y0 : 0, Math.floor(z0), Math.ceil((x1 - x0) / s) + 1, Math.ceil((y1 - (opts && opts.y0 !== undefined ? opts.y0 : 0)) / s) + 1, Math.ceil((z1 - z0) / s) + 1, s, opts);
  const g = st.grid, o = st.min;
  for (let q = 0; q < pts.length - 1; q++) {
    const a = pts[q], b = pts[q + 1]; const L = hyp(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const n = Math.max(1, Math.ceil(L / (s * 0.5)));
    for (let t = 0; t <= n; t++) { const f = t / n; const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f; const r = Math.max(0, Math.ceil(rad / s - 0.5)); for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) for (let dk = -r; dk <= r; dk++) g.set(Math.floor((x - o.x) / s) + di, Math.floor((y - o.y) / s) + dj, Math.floor((z - o.z) / s) + dk, mat); }
  }
  if (opts && opts.post) opts.post(g, st);
  return WB.finish(st);
}
SKY.curveStruct = curveStruct;
// pillar(s) from ground up to a 3D curve every n samples
const pillars = (pts, every, s, mat) => { const out = []; for (let i = 0; i < pts.length; i += every) { const p = pts[i]; if (p[1] > 3) out.push([[p[0], 0, p[2]], [p[0], p[1], p[2]]]); } return out; };
function cylTower(x, z, y0, R, H, s, wall, win, crown) {
  return WB.shape(x, y0, z, R * 2 + s * 2, H + 30, R * 2 + s * 2, s, (px, y, pz) => {
    const d = hyp(px, pz); let r = R; if (y > H * 0.82) r = R * 0.8; if (y > H * 0.92) r = R * 0.6; if (y > H) return crown && y < H + 8 && d < R * 0.5 && d > R * 0.5 - s * 1.2 ? 57 : (y < H + 24 && d < s * 0.8 ? (y > H + 20 ? 47 : 56) : 0);
    if (d < r) return d > r - s * 1.2 ? ((Math.floor(y / s) % 3) ? win : wall) : (y % (s * 5) < s ? 24 : 0);
    return 0;
  }, { name: 'tower' });
}
SKY.cylTower = cylTower;

// =====================================================================================  LOS ANGELES
D.LA = (P, c, r, low) => {
  // coast (ocean west of x=-2440), beach, hills
  P.water(-6000, -4500, -2440, 5200);
  P.area('beach', { rect: [-2440, -3200, -2290, 4200] });
  P.area('urban', { rect: [-2290, -1650, 1700, 1250] }); P.area('urban', { rect: [-1110, 1250, 1700, 2300] }); P.area('urban', { rect: [-1110, 2300, 900, 3000] });
  P.hill(-200, -2300, 900, 260, 0x8f8a5a); P.hill(-1350, -2450, 800, 200, 0x8a8656); P.hill(850, -2550, 900, 230, 0x948f5f); P.hill(1900, -2300, 700, 160, 0x8f8a5a);
  // roads
  P.road([[-2275, -1650], [-2275, 1250]], 'ave', { palms: 22, name: 'Ocean Ave' });
  P.road([[-2275, -300], [1650, -300]], 'blvd', { palms: 30, name: 'Wilshire Blvd' });
  P.road([[-2275, -1150], [-1200, -1100], [-600, -1190], [0, -1150], [600, -1100], [1650, -1000]], 'ave', { palms: 44, name: 'Sunset Blvd' });
  P.road([[-950, -1390], [600, -1390]], 'ave', { palms: 26, name: 'Hollywood Blvd' });
  P.road([[-2275, -650], [-950, -760], [600, -900]], 'ave', { name: 'Santa Monica Blvd' });
  P.road([[-2275, 250], [1650, 250]], 'fwy', { name: 'I-10' });
  P.road([[-1040, -1650], [-1040, 1250], [-950, 2300], [-950, 3950]], 'fwy', { name: 'I-405' });
  P.road([[1250, -700], [1250, 2300]], 'fwy', { name: 'I-110' });
  P.road([[-650, -1520], [300, -930], [1250, -700]], 'fwy', { name: '101' });
  P.road([[-1230, 2600], [-950, 2600], [700, 2600]], 'blvd', { palms: 36, name: 'Century Blvd' });
  P.road([[-600, -1200], [-600, -300]], 'street', { palms: 18, name: 'Rodeo Dr' });
  for (const x of [-1950, -1650, -1300, -750, -300, 100, 450, 850]) P.road([[x, -1600], [x, 1250]], 'street');
  for (const z of [-1450, -900, 0, 550, 900]) P.road([[-2275, z], [1650, z]], 'street');
  for (const x of [-700, -300, 100, 500, 900]) P.road([[x, 1250], [x, 2300]], 'street');
  P.road([[-1110, 1600], [1650, 1600]], 'street'); P.road([[-1110, 2000], [1650, 2000]], 'street');
  // walk of fame stars
  for (let x = -930; x < 590; x += 12) for (const s of [-1, 1]) P.mark({ rect: [P.X(x), P.Z(-1390 + s * 17), P.X(x + 2.2), P.Z(-1390 + s * 17 + 2.2)], col: 0xf06292 });
  // ---- Hollywood sign on the hill ----
  P.lm('Hollywood Sign', -200, -1870, 0, (x, z) => {
    const y0 = W.heightAt(x, z);
    const st = WB.newStruct(x - 54, y0 - 9, z, 36, 9, 1, 3, { name: 'HOLLYWOOD sign' });
    WB.writeText(st.grid, 'HOLLYWOOD', 0, 4, 0, 29); for (let i = 0; i < 36; i += 2) for (let j = 0; j < 4; j++) if (i % 4 !== 3) st.grid.set(i, j, 0, 37);
    WB.finish(st);
  }, [108, 30, 4, 0xffffff], { label: true });
  P.lm('Griffith Observatory', 720, -1990, 40, (x, z) => {
    const h0 = onHill(x, z);
    WB.shape(x, h0 - 6, z, 50, 26, 26, 2, (px, y, pz) => {
      const yy = y - 6; if (yy < 0) return Math.abs(px) < 24 && Math.abs(pz) < 12 ? 45 : 0;
      if (Math.abs(px) < 20 && Math.abs(pz) < 7 && yy < 8) return (yy > 2 && yy < 6 && Math.abs(pz) > 5 && (Math.floor(px / 2) % 2)) ? 22 : 29;
      if (yy >= 8 && px * px + (yy - 8) ** 2 + pz * pz < 64) return 48;
      for (const sx of [-17, 17]) if (yy >= 8 && (px - sx) ** 2 + (yy - 8) ** 2 + pz * pz < 14) return 56;
      return 0;
    }, { name: 'Griffith Observatory' });
  }, [44, 30, 18, 0xffffff]);
  // ---- Downtown LA ----
  P.lm('US Bank Tower', 1260, -470, 26, (x, z) => cylTower(x, z, 0, 15, 200, 4, 46, 22, true), [30, 220, 30, 0x55667a]);
  P.lm('Wilshire Grand', 1080, -400, 24, (x, z) => { glassTower(x, z, 9, 6, 52, 'glass'); WB.shape(x, 216, z, 12, 64, 8, 2, (px, y, pz) => (Math.abs(pz) < 1.5 && Math.abs(px) < 5 * (1 - y / 64) + 0.5 ? (y > 60 ? 47 : 56) : 0), { name: 'spire' }); }, [36, 270, 24, 0x55667a]);
  P.lm('LA City Hall', 1430, -640, 34, (x, z) => WB.shape(x, 0, z, 56, 150, 40, 4, (px, y, pz) => {
    if (y < 32 && Math.abs(px) < 26 && Math.abs(pz) < 18) return (Math.abs(px) > 22 || Math.abs(pz) > 14) ? ((Math.floor(y / 4) % 2) ? 22 : 29) : (y > 28 ? 24 : 0);
    if (y < 116 && Math.abs(px) < 12 && Math.abs(pz) < 12) return (Math.abs(px) > 8 || Math.abs(pz) > 8) ? ((Math.floor(y / 4) % 3) ? 29 : 22) : 0;
    const t = (y - 116) / 30; if (t < 1 && Math.abs(px) < 12 * (1 - t) && Math.abs(pz) < 12 * (1 - t)) return t > 0.85 ? 47 : 29;
    return 0;
  }, { name: 'City Hall' }), [52, 140, 36, 0xf0f0f0]);
  P.lm('Walt Disney Concert Hall', 1110, -660, 34, (x, z) => WB.shape(x, 0, z, 64, 26, 54, 2, (px, y, pz) => {
    const blobs = [[0, 0, 16, 11, 20], [-14, 6, 12, 14, 16], [12, -8, 13, 9, 24], [4, 12, 10, 8, 14]];
    for (const b of blobs) { const dx = (px - b[0]) / b[2], dz = (pz - b[1]) / b[3], dy = y / b[4]; if (dx * dx + dz * dz + dy * dy < 1 && dx * 0.6 + dz * 0.5 < 0.9 - dy * 0.6) return 56; }
    return 0;
  }, { name: 'Disney Hall' }), [56, 22, 50, 0xc8ccd2]);
  for (const t of [[900, -560, 7, 7, 34], [960, -150, 8, 6, 28], [1380, -350, 7, 8, 40], [1450, -150, 6, 6, 24], [1100, -100, 8, 8, 30], [1350, -60, 7, 6, 36], [1520, -420, 6, 6, 22], [880, -420, 6, 7, 20]])
    P.lm(null, t[0], t[1], Math.max(t[2], t[3]) * 2 + 8, (x, z) => glassTower(x, z, t[2], t[3], t[4], low ? 'glass' : 'tower'), [t[2] * 4, t[4] * 4, t[3] * 4, 0x55667a]);
  P.district({ rect: [800, -760, 1660, 200], lot: 44, fill: 0.75, styles: ['glass', 'concrete', 'glass', 'brick'], h: [6, 18], hf: (x, z) => 1.4 - hyp(x - 1200, z + 380) / 700 });
  // ---- Hollywood ----
  P.lm('TCL Chinese Theatre', -400, -1420, 24, (x, z) => WB.shape(x, 0, z - 6, 36, 26, 22, 2, (px, y, pz) => {
    if (y < 10 && Math.abs(px) < 16 && pz > -8 && pz < 8 && (Math.abs(px) > 14 || pz < -6 || (pz > 6 && Math.abs(px) > 5))) return 28;
    for (let t = 0; t < 3; t++) { const yb = 10 + t * 5, hw = 17 - t * 4; if (y >= yb && y < yb + 2 && Math.abs(px) < hw && Math.abs(pz) < 9 - t) return t === 2 ? 32 : 51; if (y >= yb + 2 && y < yb + 5 && Math.abs(px) < hw - 3 && Math.abs(pz) < 6 - t) return 28; }
    if (y < 18 && pz > 7 && pz < 10 && (Math.abs(px - 7) < 1.2 || Math.abs(px + 7) < 1.2)) return 28;
    return 0;
  }, { name: 'Chinese Theatre' }), [34, 24, 20, 0xd8403a]);
  P.lm('Capitol Records', 120, -1450, 20, (x, z) => WB.shape(x, 0, z, 24, 74, 24, 2, (px, y, pz) => {
    const d = hyp(px, pz); const fl = Math.floor(y / 4); const R = 10 - Math.max(0, fl - 8) * 0.35;
    if (y < 52) { if (y % 4 < 2 && d < R + 1) return 29; if (d < R - 1 && d > R - 3) return 22; return 0; }
    if (d < 1.2 && y < 72) return y > 68 ? 47 : 56; return 0;
  }, { name: 'Capitol Records' }), [22, 52, 22, 0xe0e0e0]);
  // ---- Santa Monica pier, wheel, coaster, beach ----
  P.lm('Santa Monica Pier', -2600, -100, 0, (x, z) => {
    WB.shape(-2610 + c.x + 0, -3.5, z, 340, 4, 36, 4, () => 37, { name: 'pier deck' });
    signBoard(c.x - 2448, 0.5, z, [{ t: 'SANTA MONICA' }, { t: 'PIER' }], 0.5, 60, 57, 'e');
    WB.wheel(c.x - 2680, z - 2, 15, 1, 'x', 63, 47, 56, 0.5);
    const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push([c.x - 2580 + Math.cos(a) * 34, 6 + Math.sin(a * 3) * 4 + Math.cos(a) * 3, z + Math.sin(a) * 12]); }
    curveStruct(pts, 1, 0.5, 47, { name: 'coaster' });
    for (const pp of pillars(pts, 8, 1, 56)) curveStruct(pp, 1, 0.4, 56, { name: 'coaster leg' });
  }, [340, 30, 36, 0x7b5a3a, -10, 0], { label: true });
  for (const lz of [-900, 450, 1300]) P.lm(null, -2370, lz, 0, (x, z) => WB.shape(x, 0, z, 4, 5, 4, 0.5, (px, y, pz) => (y < 2 ? (Math.abs(px) > 1.5 && Math.abs(pz) > 1.5 ? 56 : 0) : y < 4 ? (Math.abs(px) < 1.7 && Math.abs(pz) < 1.7 && (Math.abs(px) > 1.2 || Math.abs(pz) > 1.2 || y < 2.5) ? (pz > 1.2 ? 22 : 60) : 0) : (Math.abs(px) < 2 && Math.abs(pz) < 2 ? 67 : 0)), { name: 'lifeguard tower' }));
  // ---- districts ----
  P.district({ rect: [-2260, -1620, -1700, 1240], lot: 40, fill: 0.7, styles: ['stucco', 'stucco', 'concrete', 'glass'], h: [2, 7], hf: (x, z) => (Math.abs(z + 300) < 300 ? 1.4 : 0.8) });
  P.district({ rect: [-1700, -1620, -1060, 1240], lot: 44, fill: 0.5, styles: ['stucco', 'stucco', 'brick'], h: [2, 4] });
  P.district({ rect: [-1020, -1620, 790, -1000], lot: 40, fill: 0.6, styles: ['stucco', 'concrete', 'brick'], h: [2, 7] });
  P.district({ rect: [-1020, -1000, 790, 1240], lot: 44, fill: 0.5, styles: ['stucco', 'concrete', 'brick', 'glass'], h: [2, 6], hf: (x, z) => (Math.abs(z + 300) < 120 ? 2.6 : 0.8) });
  P.district({ rect: [-1100, 1260, 1650, 2300], lot: 48, fill: 0.35, styles: ['stucco', 'concrete'], h: [2, 4] });
  P.district({ rect: [-900, 2450, 700, 2780], lot: 44, fill: 0.7, styles: ['hotel', 'glass', 'concrete'], h: [4, 11] });
  P.label(-2000, -400, 'SANTA MONICA'); P.label(-300, -1500, 'HOLLYWOOD'); P.label(1150, -250, 'DOWNTOWN'); P.label(-1300, -700, 'BEVERLY HILLS'); P.label(-400, 1700, 'SOUTH LA');
  c.aptDef = { code: 'LAX', name: 'LOS ANGELES INTL', x: -1600, z: 2600, side: 1, parallel: true, gates: 4, ai: [2, 3], link: [-950, 2600], airline: 'GROK', sig: 'LAX' };
};

// =====================================================================================  LAS VEGAS
D.LAS = (P, c, r, low) => {
  P.area('urban', { rect: [-1050, -2950, 1350, 700] }); P.area('urban', { rect: [-1050, 700, 470, 1800] });
  for (let q = 0; q < 5; q++) P.hill(-4600 - (q % 2) * 700, -3200 + q * 1500, 1000, 280 + q * 30, 0xa8714a);
  P.hill(4600, -1800, 1200, 300, 0xa06a46); P.hill(4200, 2500, 900, 200, 0xa8714a);
  // the Strip (Las Vegas Blvd) with median palms, cross streets, I-15
  P.road([[0, 1800], [0, -1800]], 'strip', { name: 'Las Vegas Strip' }); P.palmRow([[0, 1760], [0, -1760]], 34, 0); P.palmRow([[0, 1760], [0, -1760]], 40, 24);
  P.road([[0, -1800], [120, -2300], [140, -2950]], 'ave', { name: 'Las Vegas Blvd N' });
  P.road([[-950, 680], [1300, 680]], 'blvd', { name: 'Tropicana Ave' }); P.road([[-950, -320], [950, -320]], 'blvd', { name: 'Flamingo Rd' });
  P.road([[-950, 200], [700, 200]], 'ave'); P.road([[-950, -820], [950, -820]], 'ave'); P.road([[-950, -1450], [950, -1450]], 'blvd', { name: 'Sahara Ave' });
  P.road([[-950, 1480], [460, 1480]], 'ave', { name: 'Russell Rd' });
  P.road([[-760, 3000], [-760, -3000]], 'fwy', { name: 'I-15' });
  P.road([[330, 680], [330, -1450]], 'street'); P.road([[620, 700], [620, -1450]], 'ave', { name: 'Paradise Rd' });
  P.road([[1300, 680], [1300, 1000]], 'blvd');
  for (const z of [-2100, -2350, -2750]) P.road([[-950, z], [900, z]], 'street');
  for (const x of [-450, 400, 700]) P.road([[x, -2950], [x, -1600]], 'street');
  // ---- Strip resorts, south -> north ----
  P.lm('Welcome to Fabulous Las Vegas', 0, 1640, 0, (x, z) => {
    signBoard(x, 6, z, [{ t: 'WELCOME', m: 67 }, { t: 'FABULOUS', m: 60 }, { t: 'LAS VEGAS', m: 67, sc: 1 }], 0.5, 29, 67, 's', { diamond: true, bulbs: true });
    WB.smallBox(x, 0, z, 18, 12, 1, 0.5, (g) => { for (let j = 0; j < 12; j++) { g.set(4, j, 0, 29); g.set(13, j, 0, 29); } }, { name: 'sign posts' });
  }, [20, 18, 2, 0xffffff], { label: true });
  P.lm('Mandalay Bay', -240, 1340, 70, (x, z) => WB.shape(x, 0, z, 120, 130, 120, 4, (px, y, pz) => {
    const H = 112; if (y > H + 4) return 0; const a = Math.atan2(pz, px); let best = 1e9;
    for (const ang of [Math.PI * 0.5, Math.PI * 0.5 + 2.094, Math.PI * 0.5 - 2.094]) { const ux = Math.cos(ang), uz = Math.sin(ang); const t = px * ux + pz * uz; const perp = Math.abs(-px * uz + pz * ux); if (t > -6 && t < 56 - (y > 80 ? (y - 80) * 0.6 : 0) && perp < 9) best = 0; }
    if (best) return y < 16 && Math.abs(px) < 50 && Math.abs(pz) < 30 ? (y < 12 ? 50 : 24) : 0;
    return y > H ? 32 : 53;
  }, { name: 'Mandalay Bay' }), [100, 112, 90, 0xd9a520]);
  P.lm('Luxor', -250, 1060, 75, (x, z) => {
    WB.shape(x, 0, z, 126, 80, 126, 3, (px, y, pz) => { const t = y / 76; const hw = 60 * (1 - t); return Math.abs(px) < hw && Math.abs(pz) < hw ? (t > 0.94 ? 32 : 38) : 0; }, { name: 'Luxor pyramid' });
    WB.shape(x + 90, 0, z, 30, 20, 16, 1, (px, y, pz) => { // sphinx facing the Strip
      if (y < 6 && px > -12 && px < 10 && Math.abs(pz) < 5) return 65; if (px > 8 && px < 15 && Math.abs(pz) < 2 && y < 3) return 65; if (px > 2 && px < 10 && Math.abs(pz) < 4.5 && y >= 6 && y < 15) return (y > 12 && Math.abs(pz) > 3) ? 60 : 65; return 0;
    }, { name: 'Sphinx' });
    WB.shape(x + 70, 0, z + 40, 4, 34, 4, 1, (px, y, pz) => (Math.abs(px) < 2 * (1 - y / 40) + 0.4 && Math.abs(pz) < 2 * (1 - y / 40) + 0.4 ? (y > 31 ? 32 : 65) : 0), { name: 'obelisk' });
    P.beams = P.beams || []; P.beams.push([x, 76, z]);
  }, [120, 76, 120, 0x1b1d22], { label: true });
  P.lm('Excalibur', -230, 800, 70, (x, z) => WB.shape(x, 0, z, 110, 90, 110, 2, (px, y, pz) => {
    for (const t of [[-30, -30], [30, -30], [-30, 30], [30, 30], [0, -40], [0, 40], [-40, 0]]) { const d = hyp(px - t[0], pz - t[1]); if (y < 30 && d < 6) return y > 26 ? 29 : (y % 8 < 2 ? 22 : 29); if (y >= 30 && y < 42 && d < 7 * (1 - (y - 30) / 12)) return [67, 60, 63][Math.abs(t[0] + t[1]) % 3]; }
    if (y < 20 && Math.abs(px) < 26 && Math.abs(pz) < 26 && (Math.abs(px) > 23 || Math.abs(pz) > 23 || y > 17)) return y > 17 ? 67 : 29;
    for (const t of [[-44, -14], [-44, 14]]) if (Math.abs(px - t[0]) < 7 && Math.abs(pz - t[1]) < 12 && y < 70) return y > 66 ? 67 : (y % 4 < 2 ? 22 : 29);
    return 0;
  }, { name: 'Excalibur' }), [100, 70, 100, 0xf0f0f0]);
  P.lm('New York-New York', -230, 550, 70, (x, z) => {
    const T = [[-30, -20, 8, 72], [-12, -24, 7, 96], [8, -18, 8, 60], [-28, 12, 9, 52], [-8, 10, 8, 84], [16, 14, 7, 64], [30, -4, 6, 46]];
    WB.shape(x, 0, z, 90, 110, 80, 2, (px, y, pz) => {
      for (const t of T) { const hw = t[2] - (y > t[3] * 0.7 ? 2 : 0) - (y > t[3] * 0.88 ? 2 : 0); if (Math.abs(px - t[0]) < hw && Math.abs(pz - t[1]) < hw && y < t[3]) return (Math.abs(px - t[0]) > hw - 2 || Math.abs(pz - t[1]) > hw - 2) ? ((Math.floor(y / 2) % 3) ? [25, 23, 45, 56][Math.abs(t[0]) % 4] : 22) : 0; if (Math.abs(px - t[0]) < 1 && Math.abs(pz - t[1]) < 1 && y < t[3] + 12) return y > t[3] + 9 ? 47 : 56; }
      return 0;
    }, { name: 'NYNY skyline' });
    WB.shape(x + 52, 0, z + 30, 6, 26, 6, 1, (px, y, pz) => (y < 6 ? (Math.abs(px) < 3 && Math.abs(pz) < 3 ? 45 : 0) : (y < 22 && hyp(px, pz) < 1.6 - (y - 6) * 0.04) ? 30 : (y >= 20 && y < 26 && Math.abs(px - 1.2) < 0.6 && Math.abs(pz) < 0.6) ? (y > 24 ? 32 : 30) : 0), { name: 'mini Liberty' });
    const pts = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; pts.push([x + Math.cos(a) * 44, 18 + Math.sin(a * 2) * 10, z + Math.sin(a) * 34]); }
    curveStruct(pts, 1, 0.5, 67, { name: 'coaster' });
  }, [80, 96, 70, 0xc0b0a0]);
  P.lm('MGM Grand', 250, 520, 80, (x, z) => WB.shape(x, 0, z, 140, 100, 120, 4, (px, y, pz) => {
    const wing = (Math.abs(pz) < 10 && px > -60 && px < 60) || (Math.abs(px) < 10 && pz > -54 && pz < 54);
    if (wing && y < 88) return (Math.floor(y / 4) % 2) ? 52 : 46;
    if (y < 16 && Math.abs(px) < 64 && Math.abs(pz) < 56) return y > 12 ? 24 : 52;
    if (y < 24 && hyp(px + 60, pz - 50) < 8) return 32; // golden lion
    return 0;
  }, { name: 'MGM Grand' }), [130, 88, 110, 0x2fbf71]);
  P.lm('Park MGM & Aria', -240, 300, 60, (x, z) => { WB.shape(x, 0, z, 100, 140, 60, 4, (px, y, pz) => { const a = (px + 20) * (px + 20) / 900 + pz * pz / 120; if (a < 1 && a > 0.6 && y < 128 && Math.abs(px + 20) < 28) return (Math.floor(y / 4) % 3) ? 56 : 46; if (Math.abs(px - 30) < 10 && Math.abs(pz) < 16 && y < 96) return (Math.floor(y / 4) % 2) ? 46 : 22; return 0; }, { name: 'Aria' }); }, [90, 128, 50, 0x8899aa]);
  P.lm('Cosmopolitan', -200, 80, 40, (x, z) => { glassTower(x - 14, z - 12, 7, 6, 46, 'glass'); glassTower(x + 14, z + 12, 7, 6, 46, 'glass'); WB.shape(x, 0, z, 70, 20, 50, 4, (px, y, pz) => (y < 12 && Math.abs(px) < 30 && Math.abs(pz) < 22 ? (y > 8 ? 33 : 38) : 0), { name: 'Cosmo podium' }); }, [60, 184, 50, 0x445566]);
  P.area('water', { rect: [-262, -285, -48, -32] });
  P.lm('Bellagio', -380, -160, 60, (x, z) => WB.shape(x, 0, z, 70, 150, 130, 4, (px, y, pz) => {
    const arc = hyp(px - 60, pz) ; if (arc > 62 && arc < 76 && Math.abs(pz) < 56 && y < 132 - Math.abs(pz) * 0.6) return y > 124 - Math.abs(pz) * 0.6 ? 54 : ((Math.floor(y / 4) % 2) ? 50 : 22);
    if (y < 16 && px > -30 && px < 30 && Math.abs(pz) < 60) return y > 12 ? 54 : 50; return 0;
  }, { name: 'Bellagio' }), [60, 130, 120, 0xefe3c8], { label: true });
  P.anims.push({ type: 'fountain', x: P.X(-155), z: P.Z(-158), rx: 95, rz: 110 });
  P.lm('Paris Las Vegas', 170, -150, 70, (x, z) => {
    WB.latticeTower(x - 20, z, 2, 56, 11, 1, 2.4, () => 27, [6, 18, 40], 4);
    WB.shape(x + 40, 0, z, 60, 80, 100, 4, (px, y, pz) => (Math.abs(px) < 22 && Math.abs(pz) < 46 && y < 64 ? (y > 58 ? 26 : ((Math.floor(y / 4) % 2) ? 25 : 22)) : (y < 12 && Math.abs(px) < 28 && Math.abs(pz) < 50 ? 25 : 0)), { name: 'Paris LV hotel' });
    WB.shape(x - 20, 0, z + 54, 18, 22, 10, 1, (px, y, pz) => (y < 16 && Math.abs(px) < 8 && Math.abs(pz) < 4 && !(Math.abs(px) < 3 && y < 10) ? 25 : 0), { name: 'mini Arc' });
    WB.shape(x - 10, 0, z - 50, 14, 30, 14, 1, (px, y, pz) => { const d = hyp(px, y - 20, pz); if (d < 6.5) return [67, 60, 63, 29][Math.floor(Math.atan2(pz, px) * 2 + 8) % 4]; if (y < 14 && hyp(px, pz) < 1) return 56; return 0; }, { name: 'Paris balloon sign' });
  }, [80, 115, 100, 0xe8dcc0], { label: true });
  P.lm("Caesars Palace", -280, -500, 80, (x, z) => WB.shape(x, 0, z, 120, 130, 140, 4, (px, y, pz) => {
    const T = [[-20, -40, 12, 30, 104], [-30, 10, 30, 12, 92], [10, 40, 12, 26, 112], [-40, 50, 26, 10, 80]];
    for (const t of T) if (Math.abs(px - t[0]) < t[2] && Math.abs(pz - t[1]) < t[3] && y < t[4]) return y > t[4] - 4 ? 32 : ((Math.floor(y / 4) % 2) ? 29 : 22);
    if (y < 16 && px > 20 && px < 52 && Math.abs(pz) < 60) return (y < 12 && Math.abs(pz) % 8 > 4 && px > 44) ? 0 : 29;
    return 0;
  }, { name: 'Caesars Palace' }), [100, 112, 130, 0xf4f4f0]);
  P.road([[18, -440], [380, -440]], 'path', { w: 14 });
  P.lm('High Roller', 400, -440, 70, (x, z) => WB.wheel(x, z, 56, 2, 'x', 29, 34, 56, 0), [8, 120, 120, 0xe0e0e0], { label: true });
  P.lm('The Mirage', -260, -800, 70, (x, z) => {
    WB.shape(x - 20, 0, z, 110, 110, 110, 4, (px, y, pz) => { for (const ang of [0, 2.094, -2.094]) { const ux = Math.cos(ang), uz = Math.sin(ang); const t = px * ux + pz * uz, perp = Math.abs(-px * uz + pz * ux); if (t > -6 && t < 48 && perp < 9 && y < 96) return y > 92 ? 32 : ((Math.floor(y / 4) % 2) ? 29 : 53); } return 0; }, { name: 'Mirage' });
    WB.shape(x + 60, 0, z, 40, 18, 40, 2, (px, y, pz) => { const d = hyp(px, pz); if (d < 18 * (1 - y / 18)) return y > 12 ? 62 : 45; return 0; }, { name: 'volcano' });
  }, [100, 96, 100, 0xf0e0c0]);
  P.lm('The Venetian', 260, -800, 70, (x, z) => {
    WB.shape(x + 40, 0, z, 60, 100, 90, 4, (px, y, pz) => (Math.abs(px) < 12 && Math.abs(pz) < 42 && y < 92 ? ((Math.floor(y / 4) % 2) ? 50 : 22) : (Math.abs(pz) < 12 && Math.abs(px) < 28 && y < 80 ? 50 : 0)), { name: 'Venetian tower' });
    WB.shape(x - 30, 0, z + 20, 10, 70, 10, 2, (px, y, pz) => (Math.abs(px) < 4 && Math.abs(pz) < 4 && y < 52 ? (y > 46 && (Math.abs(px) < 2 || Math.abs(pz) < 2) ? 0 : 58) : (y >= 52 && Math.abs(px) < 3.5 * (1 - (y - 52) / 14) && Math.abs(pz) < 3.5 * (1 - (y - 52) / 14) ? 51 : 0)), { name: 'campanile' });
    WB.shape(x - 30, 0, z - 20, 30, 20, 30, 2, (px, y, pz) => (Math.abs(px) < 14 && Math.abs(pz) < 12 && y < 16 ? (y % 4 < 2 ? 43 : 29) : 0), { name: "Doge's palace" });
  }, [90, 92, 90, 0xefe3c8]);
  P.lm('Treasure Island', -230, -1020, 50, (x, z) => glassTower(x, z, 14, 6, 26, 'hotel'), [56, 104, 24, 0xe0d6c0]);
  P.lm('Wynn', 260, -1060, 60, (x, z) => WB.shape(x, 0, z, 60, 150, 100, 4, (px, y, pz) => { const a = hyp(px + 70, pz); if (a > 72 && a < 84 && Math.abs(pz) < 44 && y < 140) return (Math.floor(y / 4) % 3) ? 55 : 38; if (y < 16 && Math.abs(px) < 26 && Math.abs(pz) < 48) return 55; return 0; }, { name: 'Wynn' }), [50, 140, 90, 0x8a5a32]);
  P.lm('Sahara', 200, -1350, 50, (x, z) => { glassTower(x, z - 20, 8, 12, 30, 'hotel'); glassTower(x + 30, z + 20, 12, 7, 24, 'casino'); }, [60, 120, 80, 0xe0d6c0]);
  P.lm('The STRAT', 110, -1650, 40, (x, z) => {
    WB.latticeTower(x, z, 2, 100, 1.6, 1.4, 1, () => 21, [], 6);
    WB.smallBox(x, 180, z, 13, 8, 13, 2, (g) => { for (let j = 0; j < 8; j++) for (let k = 0; k < 13; k++) for (let i = 0; i < 13; i++) { const d = hyp(i - 6, k - 6); if (d < 6.5 - Math.abs(j - 3.5) * 0.7 && (d > 4.2 || j === 0 || j === 7)) g.set(i, j, k, j === 3 ? 34 : (j === 4 ? 22 : 21)); } }, { name: 'Strat pod' });
    WB.shape(x, 0, z + 30, 70, 50, 40, 4, (px, y, pz) => (Math.abs(px) < 30 && Math.abs(pz) < 12 && y < 44 ? ((Math.floor(y / 4) % 2) ? 29 : 22) : 0), { name: 'Strat hotel' });
  }, [20, 216, 20, 0xc0c0c0], { label: true });
  // ---- downtown: Fremont Street Experience ----
  P.area('plaza', { rect: [-140, -2582, 540, -2518] });
  P.lm('Fremont Street', 200, -2550, 0, (x, z) => {
    WB.shape(x, 0, z, 680, 28, 64, 4, (px, y, pz) => { const ap = Math.abs(pz); if (y >= 20 && y < 24 && ap < 26) return [33, 34, 35, 32, 69][Math.floor((px + 400) / 16 + ap / 8) % 5]; if (y < 20 && ap > 22 && ap < 26 && (Math.floor(px) % 48 + 48) % 48 < 4) return 56; return 0; }, { name: 'Fremont canopy' });
    WB.shape(x - 40, 0, z - 52, 50, 50, 30, 2, (px, y, pz) => (Math.abs(px) < 22 && Math.abs(pz) < 12 && y < 44 ? (y > 40 ? 32 : ((Math.floor(y / 2) % 3) ? 50 : 32)) : 0), { name: 'Golden Nugget' });
    WB.shape(x + 120, 0, z + 44, 30, 40, 20, 2, (px, y, pz) => (Math.abs(px) < 13 && Math.abs(pz) < 8 && y < 34 ? ((Math.floor(y / 2) % 2) ? 38 : 33) : 0), { name: "Binion's" });
    WB.smallBox(x + 30, 0, z - 34, 14, 24, 1, 1, (g) => { const fig = ['00011110000', '00111111100', '00001110000', '00011111000', '00111111100', '01101110110', '01001110010', '00001110000', '00011011000', '00011011000', '00011011000', '00110001100']; fig.forEach((row, rI) => { for (let i = 0; i < row.length; i++) if (row[i] === '1') { for (const dy of [0, 1]) g.set(i + 1, 23 - rI * 2 - dy, 0, rI < 2 ? 63 : rI < 7 ? 33 : 34); } }); for (let j = 0; j < 4; j++) g.set(6, j, 0, 56); }, { name: 'Vegas Vic' });
  }, [600, 26, 60, 0xd040c0], { label: true });
  // ---- districts ----
  P.district({ rect: [80, -1500, 1000, 650], lot: 48, fill: 0.45, styles: ['hotel', 'casino', 'concrete', 'stucco'], h: [3, 14], hf: (x) => (x > 600 ? 0.5 : 1) });
  P.district({ rect: [-740, -1500, -60, 1500], lot: 48, fill: 0.3, styles: ['concrete', 'stucco', 'hotel'], h: [2, 7], hf: (x) => (x < -480 ? 0.7 : 1) });
  P.district({ rect: [-1040, -2900, -780, 1750], lot: 44, fill: 0.55, styles: ['stucco', 'stucco', 'concrete'], h: [2, 3] });
  P.district({ rect: [-300, -2950, 650, -1800], lot: 40, fill: 0.6, styles: ['neon', 'casino', 'brick', 'concrete'], h: [3, 12] });
  P.label(-120, 400, 'THE STRIP'); P.label(200, -2450, 'FREMONT ST');
  c.aptDef = { code: 'LAS', name: 'HARRY REID INTL', x: 850, z: 2100, side: 1, parallel: true, nums: ['01R', '19L', '01L', '19R'], gates: 4, ai: [2, 3], link: [1300, 680], airline: 'DESERT STAR', sig: 'LAS' };
};
SKY._cityHelpers = { glassTower, signBoard, curveStruct, cylTower, pillars, onHill };
})();

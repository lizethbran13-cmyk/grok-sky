'use strict';
// GROK SKY 4.0 - mini cities part 3: London, Rio de Janeiro, Quito, Starbase (Boca Chica) + the Moon and Mars bases.
(() => {
const WB = SKY.WB, W = SKY.World, D = SKY.CityDefs;
const { glassTower, signBoard, curveStruct, onHill } = SKY._cityHelpers;
const hyp = Math.hypot;
// hollow dome with a doorway facing +z (walk-in), optional frame ribs
function dome(x, y0, z, R, s, glass, frame, name) {
  return WB.shape(x, y0, z, R * 2 + s * 2, R + s * 2, R * 2 + s * 2, s, (px, y, pz) => {
    const d = hyp(px, y, pz); if (d > R || d < R - s * 1.15) return (y < s && d < R) ? 21 : 0;
    if (pz > R * 0.6 && Math.abs(px) < 2.2 && y < 3.4) return 0; // doorway
    const a = Math.atan2(pz, px); if (frame && (Math.abs(((a / (Math.PI * 2)) * 12 % 1 + 1) % 1 - 0.5) > 0.45 || Math.abs(y - R * 0.5) < s * 0.6)) return frame;
    return y < 1.2 ? (frame || 29) : glass;
  }, { name: name || 'dome' });
}
SKY.dome = dome;
// standing statue with outstretched arms (Christ the Redeemer)
function redeemer(x, y0, z, H, s, m) {
  return WB.shape(x, y0, z, H * 1.05, H + 2, H * 0.3, s, (px, y, pz) => {
    const ax = Math.abs(px), az = Math.abs(pz); const u = y / H;
    if (u < 0.12) return ax < H * 0.12 && az < H * 0.12 ? 45 : 0; // pedestal
    if (u < 0.78) { const hw = H * (0.07 + (0.78 - u) * 0.09); return ax < hw && az < H * 0.07 ? m : 0; } // robe
    if (u < 0.86) { if (ax < H * 0.5 && az < H * 0.045 && u > 0.79) return m; return ax < H * 0.08 && az < H * 0.07 ? m : 0; } // arms
    if (u < 0.97) return hyp(px, y - H * 0.915, pz) < H * 0.06 ? m : 0; // head
    return 0;
  }, { name: 'statue' });
}
// double-decker bus (decor, along x or z)
function bus(x, z, alongX) {
  return WB.shape(x, 0, z, alongX ? 11 : 3, 5, alongX ? 3 : 11, 0.5, (px, y, pz) => {
    const u = alongX ? px : pz, v = alongX ? pz : px; if (Math.abs(u) > 5.2 || Math.abs(v) > 1.25) return 0;
    if (y < 0.5) return (Math.abs(Math.abs(u) - 3.5) < 0.6) ? 70 : 0; if (y > 4.4) return 67;
    if ((y > 1.6 && y < 2.4) || (y > 3.1 && y < 3.9)) return Math.abs(v) > 1.0 || Math.abs(u) > 5.0 ? 3 : 0; return Math.abs(v) > 1.0 || Math.abs(u) > 5.0 || y < 1 ? 67 : 0;
  }, { name: 'bus' });
}
function phoneBox(x, z) { return WB.shape(x, 0, z, 1.5, 3, 1.5, 0.25, (px, y, pz) => { if (Math.abs(px) > 0.6 || Math.abs(pz) > 0.6) return 0; if (y > 2.5) return 67; const e = Math.abs(px) > 0.45 || Math.abs(pz) > 0.45; if (!e) return 0; return (y > 1 && y < 2.2 && (Math.abs(px) < 0.3 || Math.abs(pz) < 0.3)) ? 3 : 67; }, { name: 'phone box' }); }

// =====================================================================================  LONDON
D.LON = (P, c, r, low) => {
  P.area('urban', { rect: [-2900, -2300, 2700, 2200] });
  // the Thames, looping through Westminster and past the Tower
  const thames = [[-3400, 500], [-2200, 380], [-1300, 560], [-600, 420], [-330, 120], [-300, -120], [100, -230], [800, -120], [1500, 80], [2300, 120], [3400, -60]];
  P.river(thames, 90);
  for (const b of [[-560, 250, -380, 340], [-400, -40, -200, 10], [200, -320, 220, -140], [700, -210, 720, -40], [-1300, 470, -1300, 650]]) P.road([[b[0], b[1]], [b[2], b[3]]], 'ave', { walk: false });
  P.area('park', { rect: [-2400, -1000, -1500, -350] }); P.treesIn(-2380, -980, -1520, -370, low ? 40 : 90); P.water(-2150, -760, -1750, -700); // Hyde Park + Serpentine
  P.area('park', { rect: [-1250, -300, -600, -150] }); P.treeRow([[-1250, -230], [-640, -230]], 18, 0); // St James's Park / The Mall
  P.road([[-1100, -60], [-560, -360]], 'blvd', { name: 'The Mall', trees: 20 });
  P.road([[-2900, -1100], [2600, -1100]], 'ave', { name: 'Oxford St' }); P.road([[-560, -360], [1100, -500]], 'ave', { name: 'Strand / Fleet St' });
  P.road([[-560, -360], [-560, 1600]], 'ave', { name: 'Whitehall' }); P.road([[-2900, 1300], [2600, 1300]], 'ave'); P.road([[1700, -2200], [1700, -100]], 'ave');
  for (const z of [-1800, -1500, -700, 800, 1800]) P.road([[-2800, z], [2600, z]], 'street'); for (const x of [-2600, -1800, -1000, 0, 500, 1200, 2200]) P.road([[x, -2200], [x, -250]], 'street');
  for (const x of [-1600, -200, 900, 2000]) P.road([[x, 300], [x, 2100]], 'street');
  P.area('plaza', { rect: [-640, -420, -480, -300] }); // Trafalgar Square
  P.lm("Nelson's Column", -560, -360, 0, (x, z) => WB.shape(x, 0, z, 10, 54, 10, 1, (px, y, pz) => { const d = Math.max(Math.abs(px), Math.abs(pz)); if (y < 6) return d < 4 ? 45 : 0; if (y < 46) return hyp(px, pz) < 1.8 ? 25 : 0; if (y < 48) return d < 2.2 ? 27 : 0; return hyp(px, pz) < 0.8 ? 27 : 0; }, { name: "Nelson's Column" }), [8, 52, 8, 0xd8ccb0]);
  // Palace of Westminster + Big Ben (Elizabeth Tower) on the west bank
  P.lm('Big Ben', -385, -10, 0, (x, z) => {
    WB.shape(x, 0, z, 14, 100, 14, 1, (px, y, pz) => { const ax = Math.abs(px), az = Math.abs(pz), m = Math.max(ax, az);
      if (y < 60) return m < 6 ? ((m > 5 && Math.floor(y / 3) % 2 && Math.min(ax, az) < 3) ? 22 : 31) : 0;
      if (y < 72) { if (m < 6.6 && m > 5.4 && y > 62 && y < 70) return (hyp(Math.min(ax, az), y - 66) < 3.4) ? (hyp(Math.min(ax, az), y - 66) < 0.6 ? 70 : 29) : 27; return m < 6.6 ? 31 : 0; }
      if (y < 80) return m < 5 ? (y % 3 < 1 ? 27 : 31) : 0;
      const w = 5 * (1 - (y - 80) / 18); return m < w ? (y > 96 ? 53 : 68) : 0; }, { name: 'Big Ben' });
    WB.shape(x + 10, 0, z + 150, 30, 36, 280, 2, (px, y, pz) => { if (Math.abs(px) > 12 || Math.abs(pz) > 138) return 0; if (y < 22) return (y > 4 && y < 20 && Math.abs(px) > 11 && Math.floor(pz / 3) % 2) ? 22 : 31; if (y < 26) return (Math.floor(pz / 4) % 2 === 0) ? 31 : 0; if (Math.abs(pz - 130) < 9 && y < 34) return 31; return 0; }, { name: 'Palace of Westminster' });
    WB.shape(x + 6, 0, z + 300, 22, 104, 22, 2, (px, y, pz) => { const m = Math.max(Math.abs(px), Math.abs(pz)); if (y < 90) return m < 10 ? ((m > 9 && Math.floor(y / 4) % 2 && Math.min(Math.abs(px), Math.abs(pz)) < 5) ? 22 : 31) : 0; if (y < 100) return m < 10 && m > 7 && Math.min(Math.abs(px), Math.abs(pz)) > 7 ? 31 : 0; return 0; }, { name: 'Victoria Tower' });
  }, [30, 96, 300, 0xd8c08a, 10, 150], { label: true });
  // London Eye on the opposite bank
  P.lm('London Eye', -190, 160, 40, (x, z) => WB.wheel(x, z, 62, 2, 'x', 29, 3, 29), [8, 135, 130, 0xf0f0f0], { label: true });
  // Tower Bridge + the Tower of London
  P.lm('Tower Bridge', 1500, 80, 0, (x, z) => WB.shape(x, 0, z, 24, 72, 280, 2, (px, y, pz) => {
    if (Math.abs(px) > 9) return 0; const u = Math.abs(pz);
    if (u < 125 && y >= 14 && y < 18 && Math.abs(px) < 8) return y < 16 ? 21 : (Math.abs(px) > 7 ? 68 : 0); // deck
    for (const tz of [-46, 46]) { const dz = Math.abs(pz - tz); if (dz < 9 && y < 60) { if (y < 14) return dz < 7 ? 45 : 0; if (y < 52) return (dz > 7.5 || Math.abs(px) > 7.5) ? ((Math.floor(y / 4) % 2 && dz < 3) ? 22 : 31) : 0; return dz < 8 - (y - 52) && Math.abs(px) < 8 - (y - 52) ? 68 : 0; } }
    if (u < 37 && y > 48 && y < 52) return 60; // high walkways
    if (u > 55 && u < 125 && Math.abs(px) > 7 && y > 18 && y < 48 && Math.abs(y - (18 + (u - 55) * 0.42 > 48 ? 48 : 48 - (u - 55) * 0.42)) < 1.5) return 60; // suspension chains
    return 0; }, { name: 'Tower Bridge' }), [18, 64, 250, 0xb8b0a0], { label: true });
  P.area('park', { rect: [1260, -240, 1460, -60] });
  P.lm('Tower of London', 1360, -150, 0, (x, z) => WB.shape(x, 0, z, 120, 34, 120, 2, (px, y, pz) => { const m = Math.max(Math.abs(px), Math.abs(pz)); if (m < 56 && m > 52 && y < 10) return (y > 8 && Math.floor((px + pz) / 2) % 2) ? 0 : 45; if (Math.abs(px) < 16 && Math.abs(pz) < 14 && y < 26) return (y > 24 && Math.floor((px + pz) / 2) % 2) ? 0 : 29; for (const cx of [-16, 16]) for (const cz of [-14, 14]) if (hyp(px - cx, pz - cz) < 3 && y < 32) return y > 28 ? 51 : 29; return 0; }, { name: 'Tower of London' }), [112, 30, 112, 0xd8d0c0], { label: true });
  P.lm("St Paul's Cathedral", 650, -430, 0, (x, z) => WB.shape(x, 0, z, 60, 110, 150, 2, (px, y, pz) => {
    const ax = Math.abs(px); if (ax < 20 && Math.abs(pz) < 70 && y < 30) return (y > 6 && y < 24 && ax > 19 && Math.floor(pz / 4) % 2) ? 22 : 25;
    if (ax < 28 && Math.abs(pz) < 22 && y < 30) return 25; if (y >= 30 && y < 46 && hyp(px, pz) < 18) return (y < 44 && hyp(px, pz) > 16 && Math.floor(Math.atan2(pz, px) * 6) % 2) ? 22 : 25;
    if (y >= 46 && hyp(px, y - 46, pz) < 20) return 56; if (y >= 66 && y < 84 && hyp(px, pz) < 3) return y > 80 ? 53 : 25;
    for (const tx of [-14, 14]) if (Math.abs(px - tx) < 5 && Math.abs(pz - 66) < 5 && y < 64) return y > 56 ? 56 : 25; return 0; }, { name: "St Paul's" }), [56, 84, 140, 0xd8ccb0], { label: true });
  P.lm('The Shard', 1050, 280, 30, (x, z) => WB.shape(x, 0, z, 60, 312, 60, 4, (px, y, pz) => { const w = 28 * (1 - y / 312); const ax = Math.abs(px), az = Math.abs(pz); if (ax > w || az > w) return 0; if (ax < w - 4.5 && az < w - 4.5) return y % 16 < 4 ? 46 : 0; return (Math.floor(y / 4) % 4) ? 46 : 22; }, { name: 'The Shard' }), [40, 300, 40, 0x9fc4d8], { label: true });
  P.lm('Buckingham Palace', -1180, -40, 30, (x, z) => { WB.shape(x, 0, z, 120, 30, 70, 2, (px, y, pz) => { if (Math.abs(px) > 56 || Math.abs(pz) > 30) return 0; if (Math.abs(pz) < 18 && Math.abs(px) < 44) return 0; if (y < 22) return (y > 4 && y < 20 && Math.floor(px / 3) % 2 && Math.abs(Math.abs(pz) - 29) < 2) ? 22 : 25; if (y < 26 && Math.abs(px) < 8) return 25; return 0; }, { name: 'Buckingham Palace' }); WB.shape(x + 90, 0, z - 30, 10, 20, 10, 1, (px, y, pz) => { const d = hyp(px, pz); if (y < 4) return d < 4.5 ? 29 : 0; if (y < 16) return d < 1.6 ? 29 : 0; return d < 1.4 ? 53 : 0; }, { name: 'Victoria Memorial' }); }, [112, 26, 60, 0xd8ccb0], { label: true });
  P.job(() => { bus(c.x - 560, c.z - 600, false); bus(c.x - 900, c.z - 1100, true); bus(c.x + 300, c.z - 1100, true); bus(c.x - 560, c.z + 700, false); for (const p of [[-540, -330], [-600, -460], [-370, -60], [640, -380], [1400, 30]]) phoneBox(c.x + p[0], c.z + p[1]); });
  P.job(() => signBoard(c.x - 470, 0, c.z - 300, [{ t: 'LONDON', m: 67, sc: 2 }, { t: 'MIND THE GAP' }], 0.5, 68, 29, 'e'));
  P.district({ rect: [-2850, -2250, 2650, -320], lot: 38, fill: 0.85, lowFill: 0.6, styles: ['brick', 'brick', 'paris', 'concrete', 'brick'], h: [3, 7], pow: 1.2 });
  P.district({ rect: [-2850, 250, 2650, 2150], lot: 40, fill: 0.75, lowFill: 0.55, styles: ['brick', 'concrete', 'brick', 'glass'], h: [2, 6] });
  P.district({ rect: [1600, -1000, 2600, -300], lot: 40, fill: 0.7, styles: ['glass', 'tower'], h: [12, 40], pow: 1.6 }); // the City
  P.label(-2000, -1050, 'HYDE PARK'); P.label(-385, -90, 'WESTMINSTER'); P.label(1900, -1050, 'THE CITY'); P.label(0, 600, 'SOUTHWARK'); P.label(-1200, 380, 'THAMES');
  c.aptDef = { code: 'LHR', name: 'LONDON HEATHROW', x: -3900, z: 500, side: 1, parallel: true, nums: ['09L', '27R', '09R', '27L'], gates: 4, ai: [1, 3], link: [-2800, 1300], airline: 'BRITANNIA', sig: 'LHR' };
};

// =====================================================================================  RIO DE JANEIRO
D.RIO = (P, c, r, low) => {
  P.water(-6000, 1450, 7000, 7000); // the Atlantic (south)
  P.water(1500, -4200, 7000, 1450); // Guanabara Bay (east)
  P.area('beach', { poly: [[-2600, 1250], [-1200, 1180], [0, 1220], [900, 1150], [1500, 1180], [1500, 1450], [-2600, 1450]] });
  P.area('urban', { rect: [-2800, -2600, 1500, 1180] });
  // hills: Corcovado (Christ), Sugarloaf in the bay, Two Brothers, Tijuca forest
  P.hill(-900, -100, 650, 360, 0x4f7f3a); P.hill(1850, 1150, 170, 230, 0x6f7d58); P.hill(1650, 1250, 120, 120, 0x6f7d58);
  P.hill(-2400, 900, 450, 300, 0x4f7f3a); P.hill(-1900, -1300, 900, 260, 0x4a7a36);
  P.lm('Christ the Redeemer', -900, -100, 0, (x, z) => redeemer(x, onHill(x, z) - 2, z, 34, 0.5, 29), [30, 30, 8, 0xf2f2f2, 0, 0], { label: true });
  P.lm('Sugarloaf', 1850, 1150, 0, (x, z) => { // cable car from Urca
    const p0 = [x - 330, 2, z - 40], p1 = [x, onHill(x, z) + 6, z]; const pts = []; for (let i = 0; i <= 40; i++) { const f = i / 40; pts.push([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f - Math.sin(f * Math.PI) * 25, p0[2] + (p1[2] - p0[2]) * f]); }
    curveStruct(pts, 1, 0.4, 56, { name: 'cable' }); WB.shape(pts[20][0], pts[20][1] - 4, pts[20][2], 4, 4, 4, 0.5, (px, y, pz) => (Math.abs(px) < 1.6 && Math.abs(pz) < 1.6 && y < 3.2) ? (y > 1.2 && y < 2.4 ? 3 : 47) : 0, { name: 'bondinho' });
    WB.shape(x, onHill(x, z) - 1, z, 12, 8, 12, 1, (px, y, pz) => (Math.abs(px) < 5 && Math.abs(pz) < 5 && y < 6) ? (y > 2 && y < 5 ? 3 : 29) : 0, { name: 'cable station' });
  }, [60, 230, 60, 0x6f7d58, 0, 0], { label: true });
  // Copacabana: beach avenue with the famous wave pavement
  const av = [[-2600, 1170], [-1200, 1110], [0, 1150], [900, 1080], [1450, 1110]];
  P.road(av, 'blvd', { palms: 40, name: 'Av. Atlantica' });
  for (let i = 0; i < av.length - 1; i++) { const a = av[i], b = av[i + 1]; const L = hyp(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 6) { const f = s / L, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f + 24 + Math.sin(s / 6) * 2.5; P.mark({ seg: [P.X(x), P.Z(z), P.X(x + 3), P.Z(z)], w: 2.2, col: (Math.floor(s / 6) % 2) ? 0x111111 : 0xf2f2f2 }); } }
  P.lm('Copacabana Beach', -600, 1300, 0, (x, z) => { for (let i = 0; i < 8; i++) WB.shape(x - 700 + i * 200, 0, z + (i % 2) * 20, 6, 4, 6, 0.5, (px, y, pz) => { const d = hyp(px, pz); if (y > 2.6 && y < 3.2 && d < 2.6) return [67, 63, 60, 64][i % 4]; return (d < 0.3 && y < 3) ? 29 : 0; }, { name: 'parasol' }); }, null, { label: true });
  P.lm('Maracana Stadium', -400, -1700, 60, (x, z) => WB.shape(x, 0, z, 240, 34, 200, 4, (px, y, pz) => { const e = hyp(px / 110, pz / 90); if (e > 1) return 0; if (e > 0.96) return y < 30 ? (y % 8 < 4 ? 29 : 56) : 0; if (e > 0.62) { const t = (e - 0.62) / 0.34; if (y < t * 28 && y > t * 28 - 4) return (Math.floor(Math.atan2(pz, px) * 8) % 2) ? 60 : 63; if (y > 26 && y < 30 && e > 0.75) return 29; return 0; } return y < 1 ? 36 : 0; }, { name: 'Maracana' }), [220, 30, 180, 0xe0e0e0], { label: true });
  P.lm('Selaron Steps', 300, -300, 0, (x, z) => WB.shape(x, 0, z, 12, 26, 70, 1, (px, y, pz) => { if (Math.abs(px) > 5) return 0; const step = Math.floor((pz + 35) / 2.6); const h = 26 - step; if (y > h || h < 0) return 0; if (Math.abs(px) > 4) return y > h - 2 ? 29 : 0; return [67, 63, 64, 60, 28, 29][(step + Math.floor(px + 5)) % 6]; }, { name: 'Selaron Steps' }), [10, 24, 70, 0xe53935]);
  P.lm('Rio Cathedral', 600, -800, 30, (x, z) => WB.shape(x, 0, z, 60, 56, 60, 2, (px, y, pz) => { const R = 28 * (1 - y / 84); const d = hyp(px, pz); if (d > R || y > 54) return 0; if (d > R - 2.4) return (Math.floor(Math.atan2(pz, px) * 4) % 3 === 0) ? 3 : 45; return 0; }, { name: 'Metropolitan Cathedral' }), [50, 50, 50, 0x9e9a90]);
  P.job(() => signBoard(c.x - 200, 0, c.z + 1250, [{ t: 'RIO', m: 64, sc: 2 }, { t: 'COPACABANA' }], 0.5, 63, 68, 's'));
  P.job(() => { const rr = SKY.rng(c.seed + 5); for (let i = 0; i < (low ? 30 : 70); i++) { const a = rr() * Math.PI * 2, d = 540 + rr() * 260; const x = c.x - 2400 + Math.cos(a) * d * 0.7, z = c.z + 900 + Math.sin(a) * d * 0.7; if (W.isWater(x, z)) continue; const h = W.heightAt(x, z); if (h < 6) continue; WB.shape(x, h - 2, z, 8, 9, 8, 1, (px, y, pz) => (Math.abs(px) < 3.5 && Math.abs(pz) < 3.5 && y < 7) ? [28, 63, 60, 64, 50, 47][i % 6] : 0, { name: 'favela house' }); } });
  P.road([[-2800, 600], [1450, 600]], 'ave'); P.road([[-2800, -500], [1450, -500]], 'ave', { name: 'Av. Presidente Vargas' }); P.road([[-1500, -2600], [-1500, 1100]], 'ave'); P.road([[900, -2600], [900, 1080]], 'ave');
  for (const z of [-2200, -1200, 0, 300, 900]) P.road([[-2700, z], [1400, z]], 'street'); for (const x of [-2600, -1100, -200, 400, 1300]) P.road([[x, -2500], [x, 1100]], 'street');
  P.road([[-2800, -1100], [-3300, -1100]], 'fwy', { name: 'Linha Vermelha' });
  P.district({ rect: [-2750, -2550, 1450, 1050], lot: 36, fill: 0.8, lowFill: 0.55, styles: ['stucco', 'concrete', 'hotel', 'glass', 'mex'], h: [3, 12], pow: 1.5, hf: (x, z) => (z > 700 ? 1.5 : 0.8) });
  P.label(-900, -260, 'CORCOVADO'); P.label(1850, 950, 'PAO DE ACUCAR'); P.label(-600, 1380, 'COPACABANA'); P.label(-400, -1880, 'MARACANA'); P.label(3500, -1500, 'BAIA DE GUANABARA');
  c.aptDef = { code: 'SDU', name: 'SANTOS DUMONT', x: -3600, z: -1200, side: 1, parallel: false, gates: 4, ai: [1, 2], link: [-2800, -1100], airline: 'SAMBA', sig: 'SDU' };
};

// =====================================================================================  QUITO
D.UIO = (P, c, r, low) => {
  P.area('urban', { rect: [-2200, -3000, 2000, 1800] });
  P.hill(-2900, -500, 1500, 820, 0x5d7a45); // Pichincha
  P.hill(300, 5200, 2300, 1250, 0x6f6a5c, true); // Cotopaxi (snow cap)
  P.hill(0, 650, 260, 55, 0x6a8f48); // El Panecillo
  P.hill(-6000, 3500, 2400, 900, 0x6f7d58, true);
  P.lm('El Panecillo Virgin', 0, 650, 0, (x, z) => WB.shape(x, onHill(x, z) - 1, z, 30, 44, 12, 0.5, (px, y, pz) => {
    const ax = Math.abs(px), az = Math.abs(pz), u = y / 42; if (u < 0.2) return ax < 6 && az < 6 ? 45 : 0;
    if (u < 0.84) { const hw = 1.2 + (0.84 - u) * 4; if (ax < hw && az < 1.8) return 56; if (u > 0.5 && u < 0.78 && az < 0.6 && ax < 3 + (u - 0.5) * 30 && ax > hw) return 56; return 0; } // wings
    if (u < 0.95) return hyp(px, y - 0.9 * 42, pz) < 1.6 ? 56 : 0; return (hyp(px, y - 41, pz) < 2.6 && hyp(px, y - 41, pz) > 2.0) ? 53 : 0;
  }, { name: 'Virgen de Quito' }), [12, 42, 6, 0xc0c4c8], { label: true });
  P.area('plaza', { rect: [-60, -160, 60, -40] }); P.treesIn(-50, -150, 50, -50, 10);
  P.lm('Plaza Grande', 0, -100, 0, (x, z) => { WB.shape(x, 0, z - 90, 80, 30, 24, 2, (px, y, pz) => { if (Math.abs(px) > 38 || Math.abs(pz) > 10) return 0; if (y < 16) return (y > 4 && y < 14 && Math.floor(px / 3) % 2 && pz > 8) ? 22 : 29; if (y < 20) return 60; if (Math.abs(px) < 6 && y < 26) return 29; return 0; }, { name: 'Palacio de Carondelet' }); WB.shape(x, 0, z, 6, 20, 6, 1, (px, y, pz) => { const d = hyp(px, pz); if (y < 4) return d < 2.8 ? 29 : 0; if (y < 16) return d < 1 ? 29 : 0; return d < 1.3 ? 53 : 0; }, { name: 'Independence monument' }); }, [80, 24, 24, 0xf2f2f2, 0, -90], { label: true });
  P.lm('Basilica del Voto Nacional', -300, -520, 0, (x, z) => WB.shape(x, 0, z, 50, 120, 140, 2, (px, y, pz) => {
    const ax = Math.abs(px); if (ax < 18 && Math.abs(pz) < 60 && y < 34) return (y > 6 && y < 30 && ax > 17 && Math.floor(pz / 4) % 2) ? 22 : 45;
    if (ax < 18 - (y - 34) * 1.1 && Math.abs(pz) < 58 && y >= 34 && y < 48) return 70;
    for (const tx of [-12, 12]) if (Math.abs(px - tx) < 6 && Math.abs(pz - 60) < 6) { if (y < 96) return ((y > 40 && y < 80 && Math.abs(px - tx) < 1.5) || (y > 50 && y < 60 && Math.abs(pz - 60) < 1.5)) ? 22 : 45; if (y < 116 && Math.abs(px - tx) < 6 - (y - 96) * 0.3 && Math.abs(pz - 60) < 6 - (y - 96) * 0.3) return 45; }
    if (y > 30 && y < 40 && pz > 58 && pz < 62 && hyp(px, y - 35) < 5) return hyp(px, y - 35) < 1 ? 47 : 3; // rose window
    if (Math.abs(pz + 30) < 6 && ax < 6 && y < 70) return y > 60 ? 64 : 45; return 0;
  }, { name: 'Basilica' }), [36, 116, 120, 0x8a8a84], { label: true });
  // Mitad del Mundo + the equator line (latitude 0 runs east-west across the north of the city)
  P.mark({ seg: [P.X(-2600), P.Z(-2600), P.X(2000), P.Z(-2600)], w: 3, col: 0xffd23d });
  P.lm('Mitad del Mundo', -700, -2600, 30, (x, z) => WB.shape(x, 0, z, 30, 40, 30, 1, (px, y, pz) => { const w = 9 - y * 0.12; if (y < 30) return (Math.abs(px) < w && Math.abs(pz) < w) ? ((Math.abs(pz) < 0.6) ? 63 : 45) : 0; const d = hyp(px, y - 34, pz); if (d < 5 && d > 4.2) return ((Math.floor(Math.atan2(pz, px) * 4) + Math.floor(y)) % 2) ? 27 : 60; return (d < 0.8) ? 27 : 0; }, { name: 'Mitad del Mundo' }), [20, 40, 20, 0xb0a890], { label: true });
  P.job(() => signBoard(c.x - 700, 0, c.z - 2570, [{ t: 'LATITUD 0 0 0', m: 63 }, { t: 'MITAD DEL MUNDO', sc: 2, m: 29 }], 0.5, 68, 29, 's'));
  // TelefériQo up Pichincha (cable + gondolas)
  P.lm('TelefériQo', -1500, -500, 0, (x, z) => { const top = [c.x - 2500, W.heightAt(c.x - 2500, c.z - 520) + 6, c.z - 520]; const p0 = [x, 4, z]; const pts = []; for (let i = 0; i <= 50; i++) { const f = i / 50; pts.push([p0[0] + (top[0] - p0[0]) * f, p0[1] + (top[1] - p0[1]) * f - Math.sin(f * Math.PI) * 40, p0[2] + (top[2] - p0[2]) * f]); }
    curveStruct(pts, 1, 0.4, 56, { name: 'teleferico' }); for (const k of [10, 22, 34, 44]) WB.shape(pts[k][0], pts[k][1] - 4, pts[k][2], 4, 4, 4, 0.5, (px, y, pz) => (Math.abs(px) < 1.6 && Math.abs(pz) < 1.6 && y < 3.2) ? (y > 1.2 && y < 2.4 ? 3 : 47) : 0, { name: 'gondola' });
    WB.shape(x, 0, z, 16, 10, 16, 1, (px, y, pz) => (Math.abs(px) < 7 && Math.abs(pz) < 7 && y < 8) ? (y > 2 && y < 6 && (Math.abs(px) > 6 || Math.abs(pz) > 6) ? 3 : 63) : 0, { name: 'teleferico station' }); WB.shape(top[0], top[1] - 6, top[2], 16, 12, 16, 1, (px, y, pz) => (Math.abs(px) < 7 && Math.abs(pz) < 7 && y < 10) ? 63 : 0, { name: 'teleferico top' }); }, [16, 10, 16, 0xffd23d], { label: true });
  P.road([[-2100, -1400], [1900, -1400]], 'ave', { name: 'Av. Naciones Unidas', trees: 24 }); P.road([[-1000, -3000], [-800, 0], [-500, 1700]], 'ave', { name: 'Av. 10 de Agosto' }); P.road([[600, -3000], [400, 1700]], 'ave', { name: 'Av. Amazonas' });
  P.road([[400, -400], [2000, -400], [3200, -800]], 'fwy', { name: 'Ruta Viva' });
  for (const z of [-2300, -1900, -900, -300, 200, 1200]) P.road([[-2100, z], [1900, z]], 'street'); for (const x of [-1700, -400, 200, 1200]) P.road([[x, -2900], [x, 1700]], 'street');
  P.district({ rect: [-1300, -400, 1300, 1700], lot: 24, fill: 0.9, lowFill: 0.7, styles: ['stucco', 'stucco', 'mex'], h: [2, 3], hf: (x, z) => 1 }); // colonial old town
  P.district({ rect: [-2100, -2950, 1900, -420], lot: 36, fill: 0.75, lowFill: 0.55, styles: ['concrete', 'glass', 'stucco', 'concrete'], h: [3, 14], pow: 1.6 }); // modern north
  P.label(-2900, -800, 'PICHINCHA'); P.label(300, 4600, 'COTOPAXI'); P.label(0, 480, 'EL PANECILLO'); P.label(0, 200, 'CENTRO HISTORICO'); P.label(-700, -2700, 'EQUATOR 0');
  c.aptDef = { code: 'UIO', name: 'MARISCAL SUCRE', x: 3300, z: -900, side: -1, parallel: false, gates: 4, ai: [1, 2], link: [2000, -400], airline: 'CONDOR', sig: 'UIO' };
};

// =====================================================================================  STARBASE (Boca Chica, Texas)
const SB = SKY.SB = { pad: [-1100, 1500], tower: [-1068, 1500], mountY: 21, padB: [-1500, 1650] };
D.SBX = (P, c, r, low) => {
  P.water(-7000, 2400, 8000, 7000); // Gulf of Mexico
  P.area('beach', { rect: [-7000, 2050, 8000, 2400] }); P.area('sand', { rect: [-2200, 1000, 400, 2050] });
  P.area('dirt', { rect: [-1260, 1360, -940, 1640] }); P.area('apron', { circle: [SB.padB[0], SB.padB[1], 45] });
  P.area('urban', { rect: [-900, -1500, 700, 300] }); P.area('lakebed', { rect: [-4000, -800, -1600, 900] }); // tidal flats
  P.road([[2600, -600], [600, -600], [-400, 600], [-1100, 1360]], 'ave', { name: 'Highway 4' }); P.road([[-1100, 1360], [-1500, 1600]], 'street');
  P.road([[-700, -1300], [-700, 200]], 'street'); P.road([[-200, -1300], [-200, 200]], 'street', { palms: 10 }); P.road([[-800, -800], [600, -800]], 'street'); P.road([[-800, -300], [600, -300]], 'street');
  // orbital launch mount + Mechazilla tower with its chopsticks
  P.lm('Mechazilla Tower', SB.tower[0], SB.tower[1], 70, (x, z) => {
    const tx = x + 6, mx = P.X(SB.pad[0]), mz = P.Z(SB.pad[1]);
    WB.shape(tx, 0, z, 14, 150, 14, 1, (px, y, pz) => { const ax = Math.abs(px), az = Math.abs(pz); if (ax > 6 || az > 6) return 0; const edge = ax > 5 && az > 5; if (edge) return 70; if ((ax > 5 || az > 5) && ((Math.floor(y) % 6) === 0 || Math.abs(((y % 12) - 6) - (ax > 5 ? pz : px)) < 0.7)) return 70; if (y > 146 && ax < 2 && az < 2) return 47; return 0; }, { name: 'Mechazilla tower' });
    WB.shape(tx - 22, 96, z, 34, 6, 30, 1, (px, y, pz) => { if (px > 15) return (Math.abs(pz) < 6 && y < 6) ? 70 : 0; for (const s of [-1, 1]) { const zz = s * (8 + (px + 15) * 0.05); if (Math.abs(pz - zz) < 1.6 && y > 1 && y < 5) return y > 4 ? 63 : 56; } return 0; }, { name: 'chopsticks' });
    WB.shape(tx - 10, 70, z, 18, 4, 4, 1, (px, y, pz) => (y < 3 && Math.abs(pz) < 1.6) ? 56 : 0, { name: 'crew access arm' });
    WB.shape(mx, 0, mz, 24, SB.mountY + 1, 24, 1, (px, y, pz) => { const d = hyp(px, pz); if (y >= SB.mountY - 3) return (d < 11 && d > 5.2) ? 56 : 0; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; if (hyp(px - Math.cos(a) * 9, pz - Math.sin(a) * 9) < 1.4) return 56; } return y < 1 && d < 12 ? 21 : 0; }, { name: 'launch mount' });
    WB.shape(tx + 4, 0, z + 2, 8, 72, 8, 1, (px, y, pz) => { if (Math.abs(px) > 3 || Math.abs(pz) > 3) return 0; if (y < 0.5) return 21; return (Math.abs(px) > 2.5 || Math.abs(pz) > 2.5) && (Math.floor(y) % 4 === 0 || (Math.abs(px) > 2.5 && Math.abs(pz) > 2.5)) ? 63 : 0; }, { name: 'crew elevator' });
  }, [40, 150, 30, 0x2a2a2e, -10, 0], { label: true });
  P.lm('Tank Farm', -1250, 1150, 0, (x, z) => { for (let i = 0; i < 6; i++) WB.shape(x + (i % 3) * 22, 0, z + Math.floor(i / 3) * 24, 14, 30, 14, 1, (px, y, pz) => { const d = hyp(px, pz); return (d < 6 && (y < 28 - d * 0.5)) ? (Math.floor(y) % 7 === 0 ? 56 : 29) : 0; }, { name: 'tank' }); }, [60, 28, 40, 0xe0e0e0, 22, 12]);
  P.lm('Starship Landing Pad', SB.padB[0], SB.padB[1], 0, (x, z) => WB.shape(x, 0, z, 60, 1, 60, 1, (px, y, pz) => { const d = hyp(px, pz); if (d > 28) return 0; if (d > 26) return 63; if (Math.abs(d - 12) < 1) return 29; return (Math.abs(px) < 1 && d < 10) || (Math.abs(pz) < 1 && d < 10) ? 29 : 21; }, { name: 'pad B' }), null, { noVisit: true });
  // build site: Mega Bay + Starfactory + rocket garden
  P.lm('Starfactory', 300, -100, 60, (x, z) => { WB.shape(x, 0, z, 120, 30, 70, 2, (px, y, pz) => { if (Math.abs(px) > 58 || Math.abs(pz) > 34) return 0; if (y < 26) return (Math.abs(px) > 56 || Math.abs(pz) > 32) ? ((y > 4 && y < 22 && Math.floor(px / 6) % 2 && pz < -30) ? 3 : 29) : 0; return 29; }, { name: 'Starfactory' }); WB.shape(x - 120, 0, z - 10, 50, 96, 40, 2, (px, y, pz) => { if (Math.abs(px) > 24 || Math.abs(pz) > 19) return 0; if (y < 92) return (Math.abs(px) > 22 || Math.abs(pz) > 17) ? (Math.abs(pz) > 17 && Math.abs(px) < 12 && y < 80 ? 56 : 29) : 0; return 29; }, { name: 'Mega Bay' }); signBoard(x, 30, z - 35, [{ t: 'STARFACTORY', m: 70, sc: 2 }], 1, 29, 70, 'n'); }, [120, 30, 70, 0xf0f0f0, 0, 0], { label: true });
  P.lm('Rocket Garden', -300, 150, 30, (x, z) => { for (let i = 0; i < 4; i++) WB.shape(x + i * 22, 0, z, 12, 56 - i * 6, 12, 1, (px, y, pz) => { const d = hyp(px, pz), H = 52 - i * 6; if (y > H) return d < 4.5 * (1 - (y - H) / 6) ? 56 : 0; return d < 4.5 ? (y < 2 ? 70 : (i === 1 && pz > 3 ? 70 : 56)) : 0; }, { name: 'prototype' }); }, [80, 52, 12, 0xc9ced6, 33, 0], { label: true });
  P.job(() => signBoard(c.x + 600, 0, c.z - 560, [{ t: 'STARBASE', m: 29, sc: 2 }, { t: 'TEXAS', m: 63 }], 0.5, 70, 29, 's'));
  P.district({ rect: [-880, -1480, 680, -380], lot: 30, fill: 0.55, lowFill: 0.4, styles: ['stucco', 'concrete', 'stucco'], h: [1, 3] });
  P.label(-1100, 1420, 'ORBITAL LAUNCH SITE'); P.label(300, -200, 'BUILD SITE'); P.label(-300, -1100, 'STARBASE TOWN'); P.label(0, 2250, 'GULF OF MEXICO');
  c.aptDef = { code: 'BRO', name: 'STARBASE BROWNSVILLE', x: 3000, z: -900, side: 1, parallel: false, gates: 3, ai: [1], link: [2600, -600], airline: 'STARLINER', sig: 'BRO' };
};

// =====================================================================================  MOON + MARS BASES (reached by Starship)
function spaceBase(P, c, r, low, o) {
  P.area('dirt', { circle: [0, 0, 700] }, o.flat);
  for (let i = 0; i < (low ? 30 : 60); i++) { const a = r() * Math.PI * 2, d = 400 + r() * 6000, R = 20 + r() * 180; P.area('dark', { circle: [Math.cos(a) * d, Math.sin(a) * d, R] }, o.crater); P.area('dirt', { circle: [Math.cos(a) * d, Math.sin(a) * d, R * 0.82] }, o.floor); }
  for (const h of o.hills) P.hill(h[0], h[1], h[2], h[3], o.hillC, h[4]);
  P.area('apron', { circle: [o.pad[0], o.pad[1], 50] }, 0x7a7d82);
  P.lm(o.name + ' pad', o.pad[0], o.pad[1], 0, (x, z) => WB.shape(x, 0, z, 64, 1, 64, 1, (px, y, pz) => { const d = hyp(px, pz); if (d > 30) return 0; if (d > 28) return 63; if (Math.abs(d - 12) < 1) return 29; return (Math.abs(px) < 1 && d < 10) || (Math.abs(pz) < 1 && d < 10) ? 29 : 21; }, { name: 'landing pad' }), null, { noVisit: true });
  // habitat domes linked by tubes
  P.lm(o.name, 0, 0, 120, (x, z) => {
    dome(x, 0, z, 18, 1, 3, 56, 'main dome'); dome(x - 60, 0, z - 10, 12, 1, 3, 56, 'lab dome'); dome(x + 55, 0, z - 20, 13, 1, o.greenM, 56, 'greenhouse');
    WB.shape(x - 30, 0, z - 5, 26, 5, 5, 1, (px, y, pz) => (Math.abs(pz) < 2.2 && y < 4 && !(Math.abs(pz) < 1.4 && y < 3.2)) ? 56 : 0, { name: 'tube' });
    WB.shape(x + 30, 0, z - 10, 24, 5, 5, 1, (px, y, pz) => (Math.abs(pz) < 2.2 && y < 4 && !(Math.abs(pz) < 1.4 && y < 3.2)) ? 56 : 0, { name: 'tube' });
    WB.shape(x + 55, 0, z - 20, 18, 3, 18, 1, (px, y, pz) => (y < 1.2 && hyp(px, pz) < 10 && Math.floor(px + pz) % 3 === 0) ? 36 : 0, { name: 'crops' });
    for (let i = 0; i < 6; i++) WB.shape(x - 100 + i * 14, 0, z + 60, 10, 5, 6, 0.5, (px, y, pz) => { if (hyp(px, pz) < 0.4 && y < 3) return 56; if (y > 3 && y < 3.5 && Math.abs(px) < 4.5 && Math.abs(pz) < 2.5) return (Math.floor(px * 2) % 3) ? 68 : 56; return 0; }, { name: 'solar panel' });
    WB.shape(x + 30, 0, z + 30, 3, 12, 6, 0.5, (px, y, pz) => { if (Math.abs(px) < 0.25 && Math.abs(pz) < 0.25 && y < 11) return 56; if (y > 8 && y < 11 && px > 0 && px < 0.5 && pz > 0 && pz < 5) return o.flag(pz, y); return 0; }, { name: 'flag' });
    signBoard(x, 19, z + 16, [{ t: o.sign, m: 63, sc: 2 }], 0.5, 70, 63, 's');
  }, [140, 18, 80, 0xd8d8d8, 0, 0], { label: true });
}
D.MOON = (P, c, r, low) => spaceBase(P, c, r, low, { name: 'Moon Base Artemis', sign: 'ARTEMIS BASE', flat: 0xa9a9a9, crater: 0x6e6e6e, floor: 0x8e8e8e, hillC: 0x8a8a8a, greenM: 3, pad: [-40, 160],
  hills: [[-2500, -3000, 2200, 600], [3500, -2500, 1800, 500], [-4000, 2500, 2600, 700], [2000, 4500, 1600, 380]], flag: (pz, y) => (pz < 2 && y > 9.5 ? 68 : ((Math.floor(y * 2) % 2) ? 67 : 29)) });
D.MARS = (P, c, r, low) => spaceBase(P, c, r, low, { name: 'Mars Base Alpha', sign: 'MARS BASE ALPHA', flat: 0xb5653a, crater: 0x7a3a1e, floor: 0xa0552e, hillC: 0xa04a26, greenM: 3, pad: [-40, 160],
  hills: [[-5000, -4500, 5200, 1700], [4000, -3000, 2000, 500], [3000, 4000, 2600, 650]], flag: (pz, y) => (y > 9.5 ? 63 : 70) });
SKY.SpaceBase = { pad: [-40, 160] };
})();

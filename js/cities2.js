'use strict';
// GROK SKY - mini cities part 2: Area 51, Mexico City, New York, Paris, Tokyo
(() => {
const WB = SKY.WB, W = SKY.World, D = SKY.CityDefs;
const { glassTower, signBoard, curveStruct, cylTower, pillars, onHill } = SKY._cityHelpers;
const hyp = Math.hypot;
// suspension bridge: deck along x (axis 'x') or z, ramps at both ends, two towers, cables
function bridge(P, x0, z0, x1, z1, H, towers, s, deckM, towerM, cableM, name) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0); const L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ramp = Math.min(160, L * 0.22);
  const hAt = (u) => { const a = u + L / 2; return Math.min(H, (a / ramp) * H, ((L - a) / ramp) * H); };
  WB.shape(cx, 0, cz, alongX ? L : 16, H + 2, alongX ? 16 : L, s, (px, y, pz) => { const u = alongX ? px : pz, v = alongX ? pz : px; if (Math.abs(v) > 7) return 0; const h = hAt(u); return (y < h && y > h - s * 1.01) ? (Math.abs(v) > 6 ? cableM : deckM) : 0; }, { name: name + ' deck', anchorJ: -1 });
  for (const t of towers) {
    const tx = alongX ? cx + t * L / 2 : cx, tz = alongX ? cz : cz + t * L / 2; const TH = H + 46;
    WB.shape(tx, 0, tz, alongX ? 10 : 22, TH, alongX ? 22 : 10, s, (px, y, pz) => { const v = alongX ? pz : px; if (Math.abs(v) > 10) return 0; if (Math.abs(v) < 6 && y < H + 22) return 0; if (Math.abs(v) < 6 && y > H + 30 && y < TH - 8) return 0; return towerM; }, { name: name + ' tower' });
  }
  for (const side of [-7, 7]) {
    const pts = []; const tA = towers[0] * L / 2, tB = towers[1] * L / 2; const TH = H + 42;
    for (let q = 0; q <= 40; q++) { const u = -L / 2 + (L * q) / 40; let y; if (u < tA) y = hAt(u) + (TH - hAt(u)) * Math.pow((u + L / 2) / (tA + L / 2), 2); else if (u > tB) y = hAt(u) + (TH - hAt(u)) * Math.pow((L / 2 - u) / (L / 2 - tB), 2); else { const m = (u - tA) / (tB - tA); y = H + 2 + (TH - H - 2) * Math.pow(2 * m - 1, 2); } pts.push(alongX ? [cx + u, y, cz + side] : [cx + side, y, cz + u]); }
    curveStruct(pts, s, s * 0.4, cableM, { name: name + ' cable', anchorJ: -1 });
  }
}
SKY.bridge = bridge;

// =====================================================================================  AREA 51
D.A51 = (P, c, r, low) => {
  P.area('lakebed', { ellipse: [-900, -300, 1300, 1800] });
  for (let q = 0; q < 3; q++) P.hill(-3000 + q * 1800, -2700, 900, 300, 0xa8714a);
  P.hill(-3400, 900, 1100, 340, 0xa06a46); P.hill(3200, -2600, 900, 260, 0xa8714a);
  P.road([[1180, 0], [3800, 0], [5200, 600]], 'street', { name: 'Groom Lake Rd', walk: false });
  P.road([[1100, 380], [1100, 760]], 'street', { walk: false });
  // saucer compound south-east of the apron
  P.area('apron', { rect: [1040, 400, 1260, 620] });
  P.lm('The Saucer', 1150, 500, 0, (x, z, cc) => {
    const s = WB.smallBox(x, 1, z, 19, 7, 19, 1, (g) => { for (let k = 0; k < 19; k++) for (let j = 0; j < 7; j++) for (let i = 0; i < 19; i++) { const d = hyp(i - 9, k - 9); if ((j <= 2 && d < 9.5 - Math.abs(j - 1) * 2.5) || (j > 2 && d < 4 - (j - 3) * 0.8)) g.set(i, j, k, j === 1 && d > 8 ? 49 : j > 2 ? 3 : 39); } }, { name: 'saucer' });
    s.anchorJ = -1; W.setDynamic(s); W.saucer = { st: s, state: 'parked', t: 0, home: s.grid.group.position.clone() }; W.saucerCity = cc;
    W.interactables.push({ city: cc, pos: new THREE.Vector3(x, 2, z), r: 14, label: () => (W.saucer && W.saucer.state === 'parked' ? 'Touch the mysterious saucer' : null), act: () => { W.saucer.state = 'rising'; SKY.Audio.play('whoop'); SKY.toast('👽 The saucer powers up!', 'good'); SKY.Game && SKY.Game.achieve('saucer'); } });
  }, null, { noVisit: true });
  P.lm('Radar', 1250, 760, 30, (x, z) => {
    WB.smallBox(x, 0, z, 9, 14, 9, 2, (g) => { g.box(3, 0, 3, 5, 6, 5, 21); for (let k = 0; k < 9; k++) for (let i = 0; i < 9; i++) for (let j = 7; j < 14; j++) { const d = hyp(i - 4, k - 4, (j - 13) * 1.2); if (d < 4.8 && d > 3.6 && j < 12) g.set(i, j, k, 29); } }, { name: 'radar dome' });
    WB.shape(x + 60, 0, z, 30, 24, 8, 1, (px, y, pz) => { if (hyp(px, pz) < 1.2 && y < 14) return 56; if (y >= 14 && y < 22 && Math.abs(pz) < 1 && Math.abs(px) < 13 - Math.abs(y - 18) * 1.5) return (Math.floor(px) % 2 ? 21 : 56); return 0; }, { name: 'radar array' });
  }, [30, 28, 20, 0xd0d0d0]);
  // perimeter fence (instanced posts + wire) and warning signs
  const fx0 = 380, fx1 = 1400, fz0 = -1950, fz1 = 1950;
  const fence = [[fx0, fz0], [fx1, fz0], [fx1, fz1], [fx0, fz1], [fx0, fz0]];
  P.fence = fence;
  P.job(() => {
    const posts = []; for (let i = 0; i < fence.length - 1; i++) { const a = fence[i], b = fence[i + 1]; const L = hyp(b[0] - a[0], b[1] - a[1]); for (let t = 0; t < L; t += 12) { const x = P.X(a[0] + (b[0] - a[0]) * t / L), z = P.Z(a[1] + (b[1] - a[1]) * t / L); if (Math.abs(z - P.Z(0)) < 14 && Math.abs(x - P.X(fx1)) < 2) continue; posts.push([x, z, Math.abs(b[0] - a[0]) > 1 ? 0 : 1]); } }
    const geo = new THREE.BoxGeometry(0.3, 3, 0.3), wire = new THREE.BoxGeometry(12, 0.08, 0.08);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9aa0a6 });
    const imP = new THREE.InstancedMesh(geo, mat, posts.length), imW = new THREE.InstancedMesh(wire, mat, posts.length * 3);
    const m = new THREE.Matrix4(), rr = new THREE.Matrix4();
    posts.forEach((p, i) => { m.makeTranslation(p[0], 1.5, p[1]); imP.setMatrixAt(i, m); for (let q = 0; q < 3; q++) { rr.makeRotationY(p[2] ? Math.PI / 2 : 0); m.makeTranslation(p[0] + (p[2] ? 0 : 6), 0.8 + q * 0.95, p[1] + (p[2] ? 6 : 0)); m.multiply(rr); imW.setMatrixAt(i * 3 + q, m); } });
    imP.frustumCulled = false; imW.frustumCulled = false; WB.city.group.add(imP); WB.city.group.add(imW);
  });
  const signs = [[fx1 + 6, 30, 'e', [{ t: 'RESTRICTED', m: 67 }, { t: 'AREA' }, { t: 'NO TRESPASSING' }]], [fx1 + 6, -30, 'e', [{ t: 'WARNING', m: 67 }, { t: 'PHOTOGRAPHY' }, { t: 'PROHIBITED' }]], [2600, 24, 's', [{ t: 'USE OF DEADLY', m: 67 }, { t: 'FORCE' }, { t: 'AUTHORIZED' }]], [fx0 - 6, 0, 'w', [{ t: 'RESTRICTED', m: 67 }, { t: 'AREA' }]], [900, fz0 - 6, 'n', [{ t: 'NO TRESPASSING', m: 67 }]]];
  for (const sg of signs) P.lm(null, sg[0], sg[1], 0, (x, z) => { signBoard(x, 1.5, z, sg[3], 0.25, 29, 70, sg[2]); WB.smallBox(x, 0, z, 1, 6, 1, 0.25, (g) => { for (let j = 0; j < 6; j++) g.set(0, j, 0, 56); }, { name: 'post' }); });
  P.label(1500, 300, 'RESTRICTED');
  c.aptDef = { code: 'XTA', name: 'GROOM LAKE', x: 600, z: 0, len: 3400, side: 1, parallel: false, gates: 2, ai: [1], airline: 'JANET', hangars: 4, bigHangars: true, sig: 'A51', restricted: true };
};

// =====================================================================================  MEXICO CITY
D.MEX = (P, c, r, low) => {
  P.area('urban', { rect: [-2700, -1400, 1900, 1500] });
  P.hill(6500, -500, 2600, 1000, 0x6f8f4a, true); P.hill(5500, 2800, 2200, 800, 0x6f8f4a, true); P.hill(-4200, -2500, 1500, 380, 0x6f8f4a); P.hill(-4600, 1600, 1600, 420, 0x6f8f4a);
  // Zocalo + centro
  P.area('plaza', { rect: [-90, -90, 90, 90] });
  P.road([[-700, -110], [700, -110]], 'street'); P.road([[-700, 110], [700, 110]], 'street'); P.road([[-110, -700], [-110, 700]], 'street'); P.road([[110, -700], [110, 700]], 'street');
  P.road([[-380, -1300], [-380, 1450]], 'ave', { name: 'Eje Central' }); P.road([[-900, -1300], [-900, 1450]], 'blvd', { name: 'Insurgentes', trees: 40 });
  P.road([[-2650, -1300], [-2650, 1450]], 'fwy', { name: 'Periferico' }); P.road([[-2650, 1000], [1850, 1000]], 'fwy', { name: 'Viaducto' });
  P.road([[-2650, -900], [1850, -900]], 'ave'); P.road([[-1500, 300], [1850, 300]], 'ave'); P.road([[600, -1300], [600, 1450]], 'ave');
  P.road([[-560, -160], [-800, -60], [-1000, 140], [-1500, 420], [-2050, 700]], 'blvd', { trees: 22, name: 'Paseo de la Reforma' });
  P.area('plaza', { circle: [-1000, 140, 34] });
  for (let x = -650; x <= 500; x += 100) if (Math.abs(x + 380) > 30) P.road([[x, -700], [x, 700]], 'street');
  for (let z = -600; z <= 600; z += 100) if (Math.abs(z) > 150) P.road([[-700, z], [700, z]], 'street');
  P.lm('Zocalo', 0, 0, 0, (x, z) => WB.shape(x, 0, z, 16, 54, 4, 1, (px, y, pz) => { if (Math.abs(px + 7) < 0.8 && Math.abs(pz) < 0.8) return 56; if (y > 40 && y < 52 && px > -6.5 && px < 7.5 && Math.abs(pz) < 0.5) return px < -1.8 ? 64 : px < 2.8 ? (hyp(px - 0.5, y - 46) < 1.5 ? 55 : 29) : 67; return 0; }, { name: 'Zocalo flag' }), [16, 54, 2, 0xffffff], { label: true });
  P.lm('Metropolitan Cathedral', 0, -150, 0, (x, z) => WB.shape(x, 0, z, 70, 70, 56, 2, (px, y, pz) => {
    if (y < 30 && Math.abs(px) < 22 && pz > -24 && pz < 22) return (y > 26 || Math.abs(px) > 20 || pz > 20 || pz < -22) ? ((y > 10 && y < 20 && Math.floor(px / 4) % 2 && pz > 20) ? 70 : 45) : 0;
    for (const tx of [-16, 16]) { if (Math.abs(px - tx) < 7 && pz > 14 && pz < 26 && y < 52) return (y > 34 && y < 46 && Math.abs(px - tx) < 4) ? 0 : 45; if (y >= 52 && y < 62 && hyp(px - tx, pz - 20) < 6 - (y - 52) * 0.6) return 41; }
    if (y >= 30 && hyp(px, pz) + Math.max(0, y - 30) * 0.9 < 9 && y < 46) return 41; if (hyp(px, pz) < 1 && y < 52) return 32;
    return 0;
  }, { name: 'Cathedral' }), [44, 60, 48, 0xc8b8a0], { label: true });
  P.lm('National Palace', 150, 0, 0, (x, z) => WB.shape(x, 0, z, 40, 22, 200, 4, (px, y, pz) => { const edge = Math.abs(px) > 16 || Math.abs(pz) > 96 || (Math.abs(px) < 3) || (Math.abs(pz % 48) < 3); if (!edge) return y < 3 ? 45 : 0; return y > 16 ? 45 : ((y > 4 && Math.floor(pz / 4) % 2) ? 22 : 59); }, { name: 'National Palace' }), [40, 20, 200, 0x9a4a3a]);
  P.lm('Templo Mayor', 90, -190, 0, (x, z) => WB.steppedPyramid(x, z, 2, 18, 4, 2, 45, 59, (g, j) => { g.box(4, j, 5, 4, 3, 4, 59); g.box(10, j, 5, 4, 3, 4, 33); }), [36, 24, 36, 0x9a8a70]);
  P.lm('Torre Latinoamericana', -380, 60, 26, (x, z) => { glassTower(x, z, 7, 7, 44, 'glass'); WB.smallBox(x, 176, z, 1, 14, 1, 2, (g) => { for (let j = 0; j < 14; j++) g.set(0, j, 0, j > 12 ? 47 : 56); }, { name: 'antenna' }); }, [28, 200, 28, 0x55667a], { label: true });
  P.area('park', { rect: [-760, -10, -540, 110] }); P.treesIn(-750, 0, -550, 100, low ? 20 : 40);
  P.lm('Palacio de Bellas Artes', -480, 50, 30, (x, z) => WB.shape(x, 0, z, 56, 44, 44, 2, (px, y, pz) => {
    if (y < 22 && Math.abs(px) < 24 && Math.abs(pz) < 18) return (y > 18 || Math.abs(px) > 22 || Math.abs(pz) > 16) ? ((y > 6 && y < 16 && Math.floor(pz / 3) % 2 && Math.abs(px) > 22) ? 22 : 29) : 0;
    const d = hyp(px, pz); if (y >= 22 && d < 12 - (y - 22) * 0.45 && d > 9 - (y - 22) * 0.45) return 54; if (y >= 22 && y < 40 && d < 2) return 54; if (y >= 40 && y < 43 && d < 1.2) return 32;
    for (const tx of [-18, 18]) if (y >= 22 && y < 30 && hyp(px - tx, pz) < 5 - (y - 22) * 0.6) return 54;
    return 0;
  }, { name: 'Bellas Artes' }), [48, 40, 36, 0xf0e8d8]);
  P.lm('Angel of Independence', -1000, 140, 34, (x, z) => WB.shape(x, 0, z, 20, 54, 20, 1, (px, y, pz) => {
    const d = hyp(px, pz); if (y < 4) return Math.abs(px) < 9 && Math.abs(pz) < 9 ? 45 : 0; if (y < 8) return Math.abs(px) < 6 && Math.abs(pz) < 6 ? 45 : 0;
    if (y < 44) return d < 2.2 ? 45 : 0; if (y < 46) return d < 3 ? 45 : 0;
    if (y < 52 && d < 1.2) return 32; if (y >= 47 && y < 51 && Math.abs(pz) < 0.6 && Math.abs(px) < 4 && Math.abs(px) > 1) return 32; return 0;
  }, { name: 'El Angel' }), [10, 52, 10, 0xd4af37], { label: true });
  for (const t of [[-1220, 330, 8, 8, 50], [-1380, 250, 7, 6, 36], [-1650, 560, 9, 8, 58], [-1820, 520, 7, 7, 40], [-850, -30, 6, 6, 30], [-1120, -40, 7, 7, 34], [-1500, 260, 6, 6, 26]])
    P.lm(null, t[0], t[1], 24, (x, z) => glassTower(x, z, t[2], t[3], t[4], 'glass'), [t[2] * 4, t[4] * 4, t[3] * 4, 0x55667a]);
  // Chapultepec
  P.area('park', { poly: [[-2050, 450], [-1900, 650], [-2000, 1000], [-2450, 1100], [-2600, 800], [-2450, 450]] });
  P.area('water', { ellipse: [-2350, 900, 90, 50] });
  P.treesIn(-2450, 500, -1950, 1050, low ? 50 : 110);
  P.hill(-2180, 700, 190, 42, 0x5a8e44);
  P.lm('Chapultepec Castle', -2180, 700, 0, (x, z) => WB.shape(x, 34, z, 64, 30, 36, 2, (px, y, pz) => {
    if (y < 8) return Math.abs(px) < 30 && Math.abs(pz) < 16 ? 45 : 0;
    if (y < 18 && Math.abs(px) < 28 && Math.abs(pz) < 14 && (Math.abs(px) > 26 || Math.abs(pz) > 12 || y > 16)) return y > 16 ? 45 : ((Math.floor(px / 3) % 2) ? 29 : 22);
    if (y < 28 && hyp(px - 18, pz) < 4) return y > 24 ? 64 : 29; if (y < 22 && Math.abs(px + 12) < 6 && Math.abs(pz) < 5) return 50; return 0;
  }, { name: 'Chapultepec Castle' }), [56, 60, 32, 0xece4d4, 0, 0], { label: true });
  // Teotihuacan (outside the city, north-east)
  P.area('dirt', { rect: [3350, -4100, 3900, -2550] });
  P.road([[3600, -3950], [3600, -2650]], 'path', { w: 26 });
  P.lm('Pyramid of the Sun', 3720, -3300, 130, (x, z) => WB.steppedPyramid(x, z, 4, 56, 5, 3, 45, 65, null, 'w'), [224, 60, 224, 0x9a8a70], { label: true });
  P.lm('Pyramid of the Moon', 3600, -3880, 90, (x, z) => WB.steppedPyramid(x, z, 4, 36, 4, 3, 45, 65), [144, 48, 144, 0x9a8a70]);
  P.lm('Citadel', 3600, -2780, 70, (x, z) => WB.steppedPyramid(x, z, 4, 20, 3, 2, 58, 65), [80, 24, 80, 0x8a7a60]);
  for (const k of [[3600, -3600], [3600, -3450], [3540, -3100], [3660, -3100]]) P.lm(null, k[0], k[1], 0, (x, z) => WB.steppedPyramid(x, z, 2, 10, 3, 2, 45, 0));
  // districts
  P.district({ rect: [-700, -700, 700, 700], lot: 36, fill: 0.85, styles: ['mex', 'mex', 'stucco', 'brown'], h: [2, 5] });
  P.district({ rect: [-2600, -1300, -720, 400], lot: 40, fill: 0.6, styles: ['mex', 'concrete', 'glass', 'stucco'], h: [2, 9], hf: (x, z) => 0.7 + Math.max(0, 1 - Math.abs((z - 140) - (x + 1000) * -0.5) / 250) });
  P.district({ rect: [-1900, 400, -720, 1450], lot: 40, fill: 0.7, styles: ['mex', 'stucco', 'concrete'], h: [2, 6] });
  P.district({ rect: [700, -1300, 1850, 1450], lot: 40, fill: 0.55, styles: ['mex', 'concrete', 'stucco'], h: [2, 4] });
  P.district({ rect: [-700, 700, 700, 1450], lot: 40, fill: 0.6, styles: ['mex', 'concrete'], h: [2, 5] });
  P.district({ rect: [-700, -1300, 700, -700], lot: 40, fill: 0.6, styles: ['mex', 'stucco'], h: [2, 4] });
  P.label(0, 220, 'CENTRO'); P.label(-1300, 120, 'REFORMA'); P.label(-2250, 1150, 'CHAPULTEPEC'); P.label(3600, -2500, 'TEOTIHUACAN');
  c.aptDef = { code: 'MEX', name: 'BENITO JUAREZ INTL', x: 2400, z: 200, side: -1, parallel: true, gates: 4, ai: [1, 2], link: [1850, 300], airline: 'AGUILA', sig: 'MEX' };
};

// =====================================================================================  NEW YORK
D.NYC = (P, c, r, low) => {
  // water: Hudson (west), East River, Harlem River, Upper Bay; Manhattan's rounded tip
  P.water(-1150, -3600, -480, 1750); P.water(470, -2200, 770, 1750); P.water(-480, -1900, 770, -1760); P.water(-2400, 1750, 800, 3800);
  P.area('water', { circle: [-640, 1800, 300] }); P.area('water', { circle: [620, 1820, 250] });
  P.land(-1090, 2370, -910, 2530, 'park'); P.land(-1240, 2100, -1110, 2200, 'park');
  P.area('urban', { rect: [-480, -1760, 470, 1750] }); P.area('urban', { rect: [-2700, -3600, -1150, 1750] }); P.area('urban', { rect: [770, -2200, 2300, 3800] }); P.area('urban', { rect: [-480, -3600, 2300, -1900] });
  // Manhattan grid
  for (let x = -420; x <= 420; x += 120) P.road([[x, -1740], [x, 1500 - Math.abs(x) * 0.6]], 'ave');
  for (let z = -1680; z <= 1400; z += 80) { if (z > -540 && z < 180) { P.road([[-470, z], [-112, z]], 'street', { w: 8 }); P.road([[92, z], [460, z]], 'street', { w: 8 }); continue; } P.road([[-470, z], [460, z]], 'street', { w: 8 }); }
  P.road([[-300, -1740], [-120, -540], [-40, 500], [70, 880], [0, 1150], [-160, 1650]], 'ave', { name: 'Broadway' });
  P.road([[-468, -1740], [-468, 1600]], 'ave', { name: 'West Side Hwy' }); P.road([[458, -1740], [458, 1500]], 'ave', { name: 'FDR Drive' });
  // Central Park (correct spot: upper-middle Manhattan)
  P.area('park', { rect: [-112, -540, 92, 180] }); P.area('water', { ellipse: [-10, -300, 70, 50] });
  P.road([[-100, 150], [-60, -100], [40, -200], [-30, -470]], 'path', { w: 5 }); P.road([[80, 150], [20, 0], [70, -420]], 'path', { w: 5 });
  P.treesIn(-105, -530, 85, 170, low ? 70 : 160);
  // landmarks
  P.lm('Empire State Building', 60, 720, 40, (x, z) => WB.shape(x, 0, z, 64, 290, 44, 4, (px, y, pz) => {
    let hx, hz; if (y < 24) { hx = 30; hz = 20; } else if (y < 72) { hx = 22; hz = 15; } else if (y < 200) { hx = 13; hz = 10; } else if (y < 216) { hx = 9; hz = 7; } else if (y < 236) { hx = 5; hz = 5; } else return (Math.abs(px) < 2 && Math.abs(pz) < 2 && y < 284) ? (y > 278 ? 47 : 56) : 0;
    if (Math.abs(px) >= hx || Math.abs(pz) >= hz) return 0; if (Math.abs(px) < hx - 4 && Math.abs(pz) < hz - 4) return 0;
    return y > 216 ? 57 : ((Math.floor(y / 4) % 3) && (Math.floor((px + pz + 100) / 4) % 2) ? 22 : 45);
  }, { name: 'Empire State' }), [60, 280, 40, 0xbdb6a8], { label: true });
  P.lm('Chrysler Building', 200, 520, 30, (x, z) => WB.shape(x, 0, z, 40, 200, 40, 2, (px, y, pz) => {
    const a = Math.max(Math.abs(px), Math.abs(pz)); if (y < 20) return a < 18 && a > 16 ? (y % 4 < 2 ? 22 : 45) : 0; if (y < 140) return a < 10 && a > 8 ? (y % 4 < 2 ? 22 : 45) : 0;
    if (y < 176) { const R = 10 - (y - 140) / 4; if (a < R && a > R - 2) return (Math.floor((y - 140) / 4) % 2 && (Math.floor(px + pz) % 3 === 0)) ? 57 : 56; return 0; }
    return (a < 1.2 && y < 196) ? 56 : 0;
  }, { name: 'Chrysler' }), [36, 190, 36, 0xc0c4c8], { label: true });
  P.lm('Flatiron Building', 70, 900, 20, (x, z) => WB.shape(x, 0, z, 26, 46, 52, 2, (px, y, pz) => { const hw = 12 * (pz + 25) / 50 + 0.5; if (pz < -25 || pz > 25 || Math.abs(px) > hw || y > 44) return 0; const edge = Math.abs(px) > hw - 2.2 || pz > 23; if (!edge) return 0; return y > 40 ? 45 : (y % 4 < 2 ? 22 : 25); }, { name: 'Flatiron' }), [24, 44, 50, 0xd8ccb0]);
  P.lm('Times Square', -40, 500, 0, (x, z) => {
    const T = [[-30, -30, 'neon', 40], [30, -30, 'neon', 34], [-32, 30, 'neon', 28], [32, 32, 'neon', 44], [0, -60, 'neon', 30]];
    for (const t of T) WB.building(x + t[0], z + t[1], 6, 6, t[3] / 4 | 0, t[2]);
    WB.shape(x, 0, z, 60, 40, 90, 1, (px, y, pz) => { if (y < 10 || y > 36) return 0; const faces = [[-18, 1], [18, -1]]; for (const f of faces) if (Math.abs(px - f[0]) < 0.6 && Math.abs(pz) < 40 && (Math.floor((pz + 40) / 10) % 2 === 0)) return [33, 34, 35, 69, 62][Math.floor((pz + 40) / 10 + y / 8) % 5]; return 0; }, { name: 'Times Sq billboards' });
  }, [60, 44, 90, 0x3a3340], { label: true });
  P.lm('One World Trade Center', -180, 1440, 40, (x, z) => WB.shape(x, 0, z, 44, 340, 44, 4, (px, y, pz) => {
    if (y > 264) return (Math.abs(px) < 2 && Math.abs(pz) < 2 && y < 336) ? (y > 330 ? 47 : 56) : 0;
    const hw = 20 - (y / 264) * 6, ch = (y / 264) * hw; const ax = Math.abs(px), az = Math.abs(pz);
    if (ax > hw || az > hw || ax + az > 2 * hw - ch) return 0; if (ax < hw - 5 && az < hw - 5 && ax + az < 2 * hw - ch - 6) return 0;
    return (Math.floor(y / 4) % 4) ? 46 : 22;
  }, { name: 'One WTC' }), [40, 330, 40, 0x7a90a8], { label: true });
  for (const t of [[-80, 1320, 7, 7, 46], [60, 1300, 6, 6, 40], [-300, 1300, 7, 6, 36], [120, 1450, 6, 7, 52], [-60, 1560, 6, 6, 30], [-250, 650, 6, 7, 60], [-150, 380, 7, 7, 54], [150, 300, 6, 6, 62], [-280, 300, 6, 6, 48], [280, 600, 6, 7, 44], [-120, 220, 4, 4, 100]])
    P.lm(null, t[0], t[1], Math.max(t[2], t[3]) * 2 + 6, (x, z) => glassTower(x, z, t[2], t[3], t[4], 'tower'), [t[2] * 4, t[4] * 4, t[3] * 4, 0x50627a]);
  P.lm('Brooklyn Bridge', 680, 1400, 0, () => bridge(P, P.X(330), P.Z(1400), P.X(980), P.Z(1400), 36, [-0.42, 0.42], 2, 45, 58, 56, 'Brooklyn Bridge'), [650, 80, 20, 0x8a7a68], { label: true });
  P.road([[230, 1400], [330, 1400]], 'ave'); P.road([[980, 1400], [1200, 1400]], 'ave');
  P.lm('Statue of Liberty', -1000, 2450, 0, (x, z) => WB.shape(x, 0, z, 32, 66, 32, 1, (px, y, pz) => {
    const ax = Math.abs(px), az = Math.abs(pz);
    if (y < 6) return (ax + az < 20 && ax < 14 && az < 14) ? 45 : 0;
    if (y < 24) { const h = 6.5 - (y - 6) * 0.06; return ax < h && az < h ? (y > 21 ? 58 : 45) : 0; }
    const d = hyp(px, pz);
    if (y < 46) return d < 4.4 - (y - 24) * 0.08 ? 30 : 0;
    if (y < 50) return d < 2.2 ? 30 : 0;
    if (y < 53) return d < 1.8 ? 30 : (y === 51.5 && d < 3.4 && Math.floor(Math.atan2(pz, px) * 7 / Math.PI) % 2 === 0 ? 30 : 0);
    if (px > 2.4 && px < 4.4 && az < 1.1 && y < 60) return 30; if (px > 2.2 && px < 4.6 && az < 1.4 && y >= 60 && y < 63) return y > 61 ? 62 : 32;
    if (px < -3 && px > -4.6 && az < 1.6 && y > 38 && y < 44) return 30;
    return 0;
  }, { name: 'Statue of Liberty' }), [20, 64, 20, 0x5fae8f], { label: true });
  P.lm('Ellis Island', -1175, 2150, 0, (x, z) => WB.building(x, z, 12, 6, 5, 'brick'), [48, 24, 24, 0x9a5a44], { noVisit: true });
  // districts: Midtown + Downtown peaks
  const nyH = (x, z) => 0.55 + 1.6 * Math.exp(-(((z - 560) / 420) ** 2)) + 1.4 * Math.exp(-(((z - 1380) / 260) ** 2));
  P.district({ rect: [-470, -1740, 460, 1650], lot: 40, fill: 0.92, lowFill: 0.7, styles: ['brick', 'concrete', 'glass', 'brown', 'tower'], h: [4, 14], hf: nyH, gap: 6 });
  P.district({ rect: [790, -2150, 2300, 3700], lot: 44, fill: 0.6, styles: ['brick', 'brown', 'concrete'], h: [2, 6], hf: (x, z) => (z > 1200 && z < 1700 && x < 1200 ? 2 : 1) });
  P.district({ rect: [-2650, -3500, -1170, 1700], lot: 44, fill: 0.55, styles: ['brick', 'concrete', 'glass'], h: [2, 7], hf: (x, z) => (x > -1450 && z > 900 ? 3 : 1) });
  P.district({ rect: [-470, -3500, 2300, -1920], lot: 44, fill: 0.55, styles: ['brick', 'brown', 'concrete'], h: [2, 6] });
  P.road([[770, 300], [2300, 300]], 'blvd', { name: 'Queens Blvd' }); P.road([[1000, -2100], [1000, 3700]], 'fwy', { name: 'BQE' });
  P.road([[-2650, 1200], [-1170, 1200]], 'ave'); P.road([[-1300, -3500], [-1300, 1700]], 'ave');
  P.label(-10, -560, 'CENTRAL PARK'); P.label(-60, 400, 'MIDTOWN'); P.label(1500, 2200, 'BROOKLYN'); P.label(1600, -800, 'QUEENS'); P.label(-1900, 0, 'NEW JERSEY'); P.label(-1000, 2600, 'LIBERTY IS');
  c.aptDef = { code: 'JFK', name: 'JOHN F KENNEDY INTL', x: 2900, z: 1500, side: -1, parallel: true, gates: 4, ai: [1, 3], link: [1000, 300], airline: 'EMPIRE', sig: 'JFK' };
};

// =====================================================================================  PARIS
D.PAR = (P, c, r, low) => {
  P.area('urban', { rect: [-2900, -2100, 2250, 1900] }); P.area('urban', { rect: [-2900, -2600, 1800, -2100] });
  P.hill(-150, -1500, 450, 75, 0x8aa05a);
  // the Seine curving through, widened round the Ile de la Cite
  P.river([[2600, 820], [1700, 560], [1100, 300], [750, 150], [300, 20], [-200, -40], [-600, -20], [-950, 170], [-1250, 380], [-1600, 700], [-2600, 1100]], 70);
  P.water(560, 85, 900, 215); P.land(610, 122, 850, 178, 'urban');
  // bridges (decals over water)
  for (const b of [[180, -60, 180, 90], [-480, -120, -480, 60], [-1150, 200, -1050, 400], [700, 60, 700, 240], [1300, 260, 1350, 460], [-200, -120, -200, 50]]) P.road([[b[0], b[1]], [b[2], b[3]]], 'ave', { walk: false });
  // axes & boulevards
  P.road([[-1450, -560], [-480, -150]], 'blvd', { trees: 18, name: 'Champs-Elysees' });
  P.road([[-480, -150], [920, -110]], 'ave', { name: 'Rue de Rivoli' }); P.road([[-1100, -430], [400, -430]], 'ave', { trees: 24, name: 'Bd Haussmann' });
  P.road([[-750, 300], [-300, 220], [600, 320], [1100, 420]], 'ave', { trees: 24, name: 'Bd Saint-Germain' });
  P.area('plaza', { circle: [-1450, -560, 75] });
  for (const a of [[-2500, -950], [-2300, -250], [-1230, 160], [-900, -1180], [-1950, -1300], [-1650, 100]]) P.road([[-1450 + (a[0] + 1450) * 0.06, -560 + (a[1] + 560) * 0.06], a], 'ave', { trees: 26 });
  const peri = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; peri.push([-250 + Math.cos(a) * 2350, -150 + Math.sin(a) * 1750]); } P.road(peri, 'fwy', { name: 'Peripherique' });
  for (const z of [-1200, -800, 600, 1000, 1400]) P.road([[-2300, z], [1900, z]], 'street');
  for (const x of [-2000, -900, -400, 300, 900, 1500]) P.road([[x, -1700], [x, 1500]], 'street');
  P.area('plaza', { circle: [-480, -150, 50] });
  // landmarks
  P.area('park', { rect: [-1000, 440, -750, 760] }); P.area('park', { rect: [-1340, 80, -1150, 230] });
  P.lm('Eiffel Tower', -1064, 392, 70, (x, z) => WB.latticeTower(x, z, 4, 82, 11, 1, 2.6, (j) => (j < 4 ? 27 : 27), [6, 15, 40], 5), [88, 330, 88, 0x7a5a3a], { label: true });
  P.lm('Trocadero', -1250, 150, 0, (x, z) => WB.shape(x, 0, z, 160, 26, 30, 4, (px, y, pz) => { const a = Math.atan2(pz + 60, px) ; const d = hyp(px, pz + 60); return (d > 66 && d < 78 && pz < 12 && y < 20) ? (y > 16 ? 26 : 25) : 0; }, { name: 'Trocadero' }), [150, 20, 30, 0xd8ccb0], { noVisit: true });
  P.lm('Arc de Triomphe', -1450, -560, 0, (x, z) => WB.shape(x, 0, z, 46, 52, 26, 2, (px, y, pz) => { if (Math.abs(px) > 22 || Math.abs(pz) > 12 || y > 50) return 0; if (Math.abs(px) < 8 && y < 30 - Math.max(0, Math.abs(px) - 4) * 1.2) return 0; if (Math.abs(pz) < 5 && Math.abs(px) > 12 && Math.abs(px) < 18 && y < 18) return 0; return y > 44 ? 45 : 25; }, { name: 'Arc de Triomphe' }), [44, 50, 24, 0xd8ccb0], { label: true });
  P.area('park', { rect: [-430, -215, 60, -85] }); P.treeRow([[-420, -200], [50, -200]], 16, 0); P.treeRow([[-420, -100], [50, -100]], 16, 0);
  P.lm('Place de la Concorde', -480, -150, 0, (x, z) => WB.shape(x, 0, z, 6, 30, 6, 1, (px, y, pz) => { const h = 2.2 - y * 0.05; return y < 3 ? (Math.abs(px) < 2.8 && Math.abs(pz) < 2.8 ? 45 : 0) : (Math.abs(px) < h && Math.abs(pz) < h && y < 26) ? 65 : (y < 28 && Math.abs(px) < 0.6 && Math.abs(pz) < 0.6 ? 32 : 0); }, { name: 'Obelisk' }), [6, 28, 6, 0xdcc48e]);
  P.area('plaza', { rect: [80, -170, 330, -80] });
  P.lm('The Louvre', 200, -125, 0, (x, z) => {
    WB.shape(x + 30, 0, z, 300, 30, 140, 4, (px, y, pz) => { const inN = pz < -48 && pz > -68, inS = pz > 48 && pz < 68, inE = px > 120 && px < 146 && Math.abs(pz) < 68; if (!(inN || inS || inE) || Math.abs(px) > 146) return 0; if (y < 20) return (y > 4 && y < 16 && Math.floor((px + pz) / 4) % 2) ? 22 : 25; if (y < 28) { const e = Math.min(Math.abs(Math.abs(pz) - 58), inE ? Math.abs(px - 133) : 99); return e < 8 - (y - 20) ? 48 : 0; } return 0; }, { name: 'Louvre' });
    WB.shape(x - 30, 0, z, 36, 22, 36, 1, (px, y, pz) => { const hw = 17 * (1 - y / 21); if (Math.abs(px) < hw && Math.abs(pz) < hw && (Math.abs(px) > hw - 1.4 || Math.abs(pz) > hw - 1.4)) return ((Math.floor(px) + Math.floor(y)) % 3 === 0) ? 56 : 22; return 0; }, { name: 'Louvre Pyramid' });
  }, [300, 28, 140, 0xd8ccb0, 30, 0], { label: true });
  P.lm('Notre-Dame', 760, 150, 0, (x, z) => WB.shape(x, 0, z, 64, 92, 26, 1, (px, y, pz) => {
    const ax = Math.abs(pz); if (px < -30 || px > 30) return 0;
    if (px < -18 && ax < 11 && y < 64) { if (ax < 3 && y > 46) return 0; if (px > -28 && px < -20 && ax > 3 && ax < 9 && y > 46) return 0; return (y > 20 && y < 30 && px < -27 && hyp(ax, y - 25) < 3.2) ? 22 : 25; }
    if (ax < 7 && y < 32) return (y > 28) ? 48 : ((Math.abs(ax - 6.5) < 0.6 && y > 6 && y < 26 && Math.floor(px / 3) % 2) ? 22 : 25);
    if (ax < 10 && ax >= 7 && y < 14) return 25; if (ax >= 10 && ax < 11 && y < 18 && Math.floor(px / 4) % 2 === 0) return 25;
    if (y >= 32 && y < 36 && ax < 7 - (y - 32) * 1.5) return 48;
    if (Math.abs(px - 8) < 1 + Math.max(0, 70 - y) * 0.02 && ax < 1 + Math.max(0, 70 - y) * 0.02 && y < 88) return 48;
    return 0;
  }, { name: 'Notre-Dame' }), [60, 64, 22, 0xd8ccb0], { label: true });
  P.lm('Sacre-Coeur', -150, -1420, 0, (x, z) => { const h0 = onHill(x, z) - 4; WB.shape(x, h0, z, 46, 60, 48, 2, (px, y, pz) => { const yy = y - 4; if (yy < 0) return Math.abs(px) < 22 && Math.abs(pz) < 22 ? 29 : 0; if (yy < 16 && Math.abs(px) < 16 && Math.abs(pz) < 18) return (yy > 4 && yy < 12 && Math.floor(px / 3) % 2 && Math.abs(pz) > 16) ? 22 : 29; if (yy >= 16 && hyp(px, pz, (yy - 16) * 0.8) < 10) return 29; if (yy >= 24 && yy < 38 && hyp(px, pz) < 2.4 - (yy - 24) * 0.12) return 29; for (const t of [[-12, 12], [12, 12], [-12, -14], [12, -14]]) if (yy >= 16 && hyp(px - t[0], pz - t[1], (yy - 16) * 1.2) < 4) return 29; return 0; }, { name: 'Sacre-Coeur' }); }, [44, 48, 44, 0xf4f4f0], { label: true });
  P.lm('Opera Garnier', -80, -520, 30, (x, z) => WB.shape(x, 0, z, 50, 36, 70, 2, (px, y, pz) => { if (Math.abs(px) < 22 && Math.abs(pz) < 32 && y < 20) return (y > 4 && y < 16 && pz > 30 && Math.floor(px / 3) % 2) ? 22 : 25; if (y >= 20 && hyp(px, pz + 2, (y - 20) * 1.3) < 12) return 51; if (y >= 20 && y < 24 && Math.abs(px) < 22 && pz > 20 && pz < 32) return 32; return 0; }, { name: 'Opera Garnier' }), [44, 34, 64, 0xd8ccb0]);
  P.lm('La Defense', -2700, -950, 60, (x, z) => { WB.shape(x, 0, z, 60, 64, 20, 4, (px, y, pz) => { if (Math.abs(px) > 28 || y > 60) return 0; if (Math.abs(px) < 20 && y > 8 && y < 52) return 0; return Math.abs(pz) < 9 ? 29 : 0; }, { name: 'Grande Arche' }); for (const t of [[-120, -60, 8, 8, 40], [100, -40, 7, 7, 50], [-60, 110, 8, 6, 34], [130, 100, 6, 6, 44]]) glassTower(x + t[0], z + t[1], t[2], t[3], t[4], 'glass'); }, [300, 200, 260, 0x55667a]);
  // Haussmann districts
  P.district({ rect: [-2300, -1800, 1900, 1550], lot: 40, fill: 0.88, lowFill: 0.65, styles: ['paris', 'paris', 'paris', 'concrete'], h: [5, 7], pow: 1, hf: (x, z) => (hyp(x + 250, z + 150) > 2250 ? 0 : 1) });
  P.district({ rect: [-2850, -2550, 2200, 1850], lot: 44, fill: 0.5, styles: ['concrete', 'brick', 'paris'], h: [2, 8], hf: (x, z) => (hyp(x + 250, z + 150) < 2400 ? 0 : 1) });
  P.label(-1064, 470, 'TOUR EIFFEL'); P.label(-150, -1600, 'MONTMARTRE'); P.label(700, 100, 'ILE DE LA CITE'); P.label(-2700, -1100, 'LA DEFENSE');
  c.aptDef = { code: 'CDG', name: 'CHARLES DE GAULLE', x: 2700, z: -2300, side: -1, parallel: true, gates: 4, ai: [1, 2], link: [1900, -1400], airline: 'LUMIERE', sig: 'CDG' };
};

// =====================================================================================  TOKYO
D.TYO = (P, c, r, low) => {
  P.water(200, 500, 4400, 4800); P.land(1500, 1300, 2400, 1700, 'urban'); P.land(-100, 1700, 1250, 4300, 'grass');
  P.area('urban', { rect: [-2800, -2500, 1900, 500] }); P.area('urban', { rect: [-2800, 500, 200, 1700] });
  P.hill(-6000, 3200, 3200, 1150, 0x6a7f8a, true);
  P.river([[900, -2500], [760, -1300], [820, -400], [650, 300], [600, 560]], 60);
  // Imperial Palace with moat
  P.area('park', { rect: [-610, -510, -90, 10] });
  P.water(-650, -550, -50, -510); P.water(-650, 10, -50, 50); P.water(-650, -510, -610, 10); P.water(-90, -510, -50, 10);
  P.treesIn(-600, -500, -100, 0, low ? 40 : 90);
  P.lm('Imperial Palace', -350, -250, 0, (x, z) => {
    WB.shape(x, 0, z, 120, 18, 60, 2, (px, y, pz) => { if (Math.abs(px) < 50 && Math.abs(pz) < 20 && y < 8) return (Math.abs(px) > 48 || Math.abs(pz) > 18 || y > 6) ? (y > 6 ? 70 : 29) : 0; if (y >= 8 && y < 12 && Math.abs(px) < 52 - (y - 8) * 2 && Math.abs(pz) < 22 - (y - 8) * 2) return 51; return 0; }, { name: 'Imperial Palace' });
    WB.shape(x + 150, 0, z - 160, 20, 28, 20, 1, (px, y, pz) => { for (let t = 0; t < 3; t++) { const b = t * 8, hw = 8 - t * 2; if (y >= b && y < b + 6 && Math.abs(px) < hw && Math.abs(pz) < hw) return 29; if (y >= b + 6 && y < b + 8 && Math.abs(px) < hw + 1.5 && Math.abs(pz) < hw + 1.5) return 51; } return 0; }, { name: 'Fujimi keep' });
    for (const bx of [-30, 30]) WB.shape(x + 230 + bx * 0.1, 0, z + 255 + bx * 0.2, 8, 3, 30, 1, (px, y, pz) => (y < 1 || (y < 3 && Math.abs(px) > 3.5)) ? 45 : 0, { name: 'Nijubashi' });
  }, [110, 16, 50, 0x2f6f5a], { label: true });
  P.lm('Tokyo Station', 150, -220, 0, (x, z) => WB.shape(x, 0, z, 30, 30, 220, 2, (px, y, pz) => { if (Math.abs(px) > 12 || Math.abs(pz) > 106) return 0; if (y < 16) return (y > 4 && y < 14 && px < -10 && Math.floor(pz / 3) % 2) ? 22 : (y % 6 === 1 ? 29 : 58); for (const dz of [-96, 0, 96]) if (y < 26 && hyp(px, pz - dz, (y - 16) * 1.4) < 10) return 70; return 0; }, { name: 'Tokyo Station' }), [24, 24, 212, 0x8e4434], { label: true });
  P.lm('Tokyo Tower', -250, 700, 50, (x, z) => WB.latticeTower(x, z, 2, 82, 12, 1, 2.2, (j) => (Math.floor(j / 7) % 2 ? 29 : 54), [22, 50], 10), [52, 184, 52, 0xff6a2a], { label: true });
  P.lm('Tokyo Skytree', 1150, -1200, 40, (x, z) => WB.shape(x, 0, z, 34, 320, 34, 2, (px, y, pz) => {
    const d = hyp(px, pz); if (y > 300) return 0; if (y > 260) return d < 1.5 ? (y > 296 ? 47 : 56) : 0;
    const R = 15 - (y / 260) * 9; if ((y > 168 && y < 184) || (y > 220 && y < 228)) return d < R + 4 ? (d > R + 1.5 ? 22 : 56) : 0;
    if (d < R && d > R - 2.2) { const a = Math.atan2(pz, px); return ((Math.floor(a * 6 + y / 6) % 3) === 0) ? 56 : (y % 8 < 2 ? 29 : 0); } return d < 3 ? 29 : 0;
  }, { name: 'Skytree' }), [30, 300, 30, 0xe8eef4], { label: true });
  P.area('plaza', { rect: [420, -1470, 480, -1260] });
  P.lm('Senso-ji', 450, -1360, 0, (x, z) => {
    WB.shape(x, 0, z + 95, 24, 14, 8, 1, (px, y, pz) => { if (y < 9 && Math.abs(px) > 6 && Math.abs(px) < 10 && Math.abs(pz) < 2) return 28; if (y >= 9 && y < 12 && Math.abs(px) < 12 - (y - 9) && Math.abs(pz) < 4) return 70; if (y >= 4 && y < 9 && hyp(px, pz) < 2.4) return y < 5 || y > 8 ? 70 : 67; return 0; }, { name: 'Kaminarimon' });
    WB.shape(x, 0, z - 70, 50, 26, 34, 2, (px, y, pz) => { if (y < 10 && Math.abs(px) < 18 && Math.abs(pz) < 12) return (Math.abs(px) > 16 || Math.abs(pz) > 10) ? 28 : 0; if (y >= 10 && y < 22 && Math.abs(px) < 24 - (y - 10) * 1.6 && Math.abs(pz) < 16 - (y - 10) * 1.1) return 51; return 0; }, { name: 'Senso-ji hall' });
    WB.shape(x + 60, 0, z - 30, 14, 40, 14, 1, (px, y, pz) => { for (let t = 0; t < 5; t++) { const b = t * 7; const hw = 5 - t * 0.5; if (y >= b && y < b + 5 && Math.abs(px) < hw - 1.5 && Math.abs(pz) < hw - 1.5) return 28; if (y >= b + 5 && y < b + 7 && Math.abs(px) < hw + 1 && Math.abs(pz) < hw + 1) return 70; } return (y < 40 && hyp(px, pz) < 0.6) ? 32 : 0; }, { name: 'pagoda' });
  }, [60, 30, 200, 0xc03a2a], { label: true });
  // Shibuya scramble crossing
  P.road([[-2600, 350], [-800, 350]], 'blvd'); P.road([[-1700, -400], [-1700, 1500]], 'blvd');
  P.area('plaza', { rect: [-1745, 305, -1655, 395] }, 0x505359);
  for (const d of [[-1, 0], [1, 0], [0, -1], [0, 1]]) for (let q = -5; q <= 5; q++) { const cx = -1700 + d[0] * 40, cz = 350 + d[1] * 40; const ox = d[0] ? 0 : q * 3, oz = d[0] ? q * 3 : 0; P.mark({ rect: [P.X(cx + ox - (d[0] ? 4 : 0.8)), P.Z(cz + oz - (d[0] ? 0.8 : 4)), P.X(cx + ox + (d[0] ? 4 : 0.8)), P.Z(cz + oz + (d[0] ? 0.8 : 4))], col: 0xf2f2f2 }); }
  for (let q = -8; q <= 8; q++) { P.mark({ seg: [P.X(-1730 + q * 2.6), P.Z(320 + q * 2.6), P.X(-1724 + q * 2.6), P.Z(326 + q * 2.6)], w: 1.4, col: 0xf2f2f2 }); P.mark({ seg: [P.X(-1730 + q * 2.6), P.Z(380 - q * 2.6), P.X(-1724 + q * 2.6), P.Z(374 - q * 2.6)], w: 1.4, col: 0xf2f2f2 }); }
  P.lm('Shibuya Crossing', -1700, 350, 0, (x, z) => {
    WB.shape(x - 70, 0, z - 70, 34, 50, 34, 2, (px, y, pz) => { const d = hyp(px + 4, pz + 4); if (d < 14 && y < 44) return (y > 30 && d > 12) ? 69 : (y % 4 < 2 ? 22 : 29); return 0; }, { name: 'Shibuya 109' });
    for (const t of [[70, -70, 9, 9, 18], [70, 70, 8, 10, 14], [-70, 70, 10, 8, 12], [140, -40, 8, 8, 58]]) WB.building(x + t[0], z + t[1], t[2], t[3], t[4], t[4] > 30 ? 'glass' : 'neon');
    WB.shape(x, 0, z, 180, 40, 180, 1, (px, y, pz) => { if (y < 12 || y > 34) return 0; const f = [[-52, 0], [52, 0], [0, -52], [0, 52]]; for (const q of f) { const onX = q[0] !== 0; const near = onX ? Math.abs(px - q[0]) < 0.6 && Math.abs(pz) > 22 && Math.abs(pz) < 50 : Math.abs(pz - q[1]) < 0.6 && Math.abs(px) > 22 && Math.abs(px) < 50; if (near) return [33, 34, 35, 69, 62, 57][Math.floor((onX ? pz : px) / 9 + y / 7 + 20) % 6]; } return 0; }, { name: 'Shibuya screens' });
    WB.shape(x + 34, 0, z + 34, 3, 3, 2, 0.5, (px, y, pz) => (y < 1 ? 45 : (y < 2.4 && Math.abs(px) < 1 && Math.abs(pz) < 0.6) || (y < 3 && px > 0.6 && Math.abs(pz) < 0.4) ? 37 : 0), { name: 'Hachiko' });
  }, [180, 50, 180, 0x3a3340], { label: true });
  P.lm('Shinjuku', -1800, -700, 60, (x, z) => { WB.shape(x, 0, z, 70, 250, 40, 4, (px, y, pz) => { for (const tx of [-18, 18]) { const ax = Math.abs(px - tx), az = Math.abs(pz); if (ax < 12 && az < 14 && y < 160) return (ax > 9 || az > 11) ? (y % 8 < 4 ? 22 : 21) : 0; if (y >= 160 && y < 244 && ax < 8 && az < 10 && (ax > 5 || az > 7)) return (Math.floor(y / 4) % 3 ? 21 : 22); } if (Math.abs(px) < 30 && Math.abs(pz) < 14 && y < 40) return y % 8 < 4 ? 22 : 21; return 0; }, { name: 'Metropolitan Govt Bldg' }); for (const t of [[-110, -40, 8, 8, 50], [100, 30, 9, 7, 56], [-60, 110, 7, 7, 46], [110, -120, 8, 8, 44], [0, -140, 7, 9, 52]]) glassTower(x + t[0], z + t[1], t[2], t[3], t[4], 'glass'); }, [260, 240, 280, 0x55667a], { label: true });
  P.lm('Ginza', 320, 120, 0, (x, z) => { WB.shape(x, 0, z, 14, 36, 14, 2, (px, y, pz) => { const d = hyp(px, pz); if (y < 26 && d < 6) return y % 4 < 2 ? 22 : 29; if (y >= 26 && y < 32 && d < 4) return (y > 27 && y < 31 && Math.abs(pz) > 3) ? 57 : 55; return 0; }, { name: 'Wako clock' }); }, [12, 32, 12, 0xe0e0e0], { noVisit: false });
  P.lm('Rainbow Bridge', 1900, 900, 0, () => bridge(P, P.X(1900), P.Z(420), P.X(1900), P.Z(1360), 40, [-0.32, 0.32], 2, 29, 29, 29, 'Rainbow Bridge'), [20, 90, 940, 0xf0f0f0], { label: true });
  P.lm('Odaiba', 1950, 1500, 0, (x, z) => { WB.shape(x, 0, z, 60, 60, 40, 4, (px, y, pz) => { if (Math.abs(pz) < 16 && (Math.abs(px + 20) < 6 || Math.abs(px - 20) < 6) && y < 52) return (y % 8 < 4 ? 22 : 29); if (y > 36 && y < 44 && Math.abs(pz) < 16 && Math.abs(px) < 26) return 29; if (hyp(px, y - 40, pz) < 10) return 56; return 0; }, { name: 'Fuji TV' }); }, [52, 56, 36, 0xd0d0d0]);
  // roads
  const ring = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; ring.push([-350 + Math.cos(a) * 950, -250 + Math.sin(a) * 750]); } P.road(ring, 'fwy', { name: 'Shuto Expressway' });
  P.road([[-2700, -1000], [1800, -1000]], 'ave'); P.road([[-2700, 900], [200, 900]], 'ave'); P.road([[-900, -2400], [-900, 1600]], 'ave'); P.road([[150, -2400], [150, 1600]], 'ave');
  P.road([[250, 470], [250, 2840]], 'fwy', { name: 'Route 1 Haneda' }); P.road([[-2700, -1800], [1800, -1800]], 'street'); P.road([[-2400, -2400], [-2400, 1600]], 'street');
  for (const z of [-2200, -1500, -600, 0, 600, 1250]) P.road([[-2700, z], [1800, z]], 'street'); for (const x of [-2100, -1300, -500, 450, 1300]) P.road([[x, -2400], [x, 1600]], 'street');
  const tyH = (x, z) => 0.6 + 2.2 * Math.exp(-((hyp(x + 1800, z + 700) / 380) ** 2)) + 1.4 * Math.exp(-((hyp(x - 100, z + 250) / 300) ** 2)) + 0.9 * Math.exp(-((hyp(x + 1700, z - 350) / 260) ** 2));
  P.district({ rect: [-2750, -2450, 1850, 1650], lot: 36, fill: 0.85, lowFill: 0.6, styles: ['tokyo', 'tokyo', 'concrete', 'glass', 'neon'], h: [3, 10], hf: tyH, gap: 6 });
  P.label(-1700, 450, 'SHIBUYA'); P.label(-1800, -820, 'SHINJUKU'); P.label(450, -1500, 'ASAKUSA'); P.label(320, 220, 'GINZA'); P.label(1950, 1600, 'ODAIBA'); P.label(-6000, 2000, 'MT FUJI');
  c.aptDef = { code: 'HND', name: 'TOKYO HANEDA', x: 800, z: 3000, side: -1, parallel: true, nums: ['34L', '16R', '34R', '16L'], gates: 4, ai: [2, 3], link: [250, 2840], airline: 'SAKURA', sig: 'HND' };
};
})();

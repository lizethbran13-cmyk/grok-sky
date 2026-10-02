'use strict';
// GROK SKY 3.5 - CARS: drivable arcade cars, ambient parked + slowly cruising cars at every airport and city, a car rental
// counter at each airport, stealing (break-in bar) with a 1-3 star wanted level, cartoon police chases (flashing lights +
// siren) that can bust you (lose a few coins, respawn at the airport police office) or be escaped. All cars are drawn
// with two instanced meshes (body + lights) so the whole fleet costs ~2 draw calls.
(() => {
const { clamp, rand, choose } = SKY;
const W = SKY.World;
const hyp = Math.hypot;
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// car types: W/H/L metres, vmax m/s, accel m/s², steering, colours
const TYPES = {
  compact: { name: 'Grok Mini', icon: '🚙', desc: 'Compact · zippy & easy', W: 1.8, h1: 0.7, h2: 0.65, L: 3.7, vmax: 24, acc: 8, steer: 2.3, col: 0xffd23d, price: 10, stars: 2 },
  sports: { name: 'Sky Racer', icon: '🏎', desc: 'Sports car · fastest', W: 2.0, h1: 0.55, h2: 0.48, L: 4.4, vmax: 36, acc: 12, steer: 2.1, col: 0xe53935, price: 25, stars: 4, spoiler: true },
  suv: { name: 'Desert Cruiser', icon: '🚐', desc: 'SUV · big & tough', W: 2.2, h1: 0.95, h2: 0.8, L: 4.7, vmax: 29, acc: 9, steer: 1.9, col: 0x2e7d32, price: 16, stars: 3 },
  sedan: { name: 'sedan', icon: '🚗', W: 1.9, h1: 0.7, h2: 0.6, L: 4.3, vmax: 26, acc: 8, steer: 2.0, col: 0x1976d2 },
  police: { name: 'police cruiser', icon: '🚓', W: 2.0, h1: 0.72, h2: 0.6, L: 4.6, vmax: 26, acc: 10, steer: 2.3, col: 0xf4f6fa, police: true },
};
const SEDAN_COLS = [0x1976d2, 0xeeeeee, 0x212121, 0x9e9e9e, 0xff7043, 0x5e35b1, 0x00897b, 0xc62828, 0xf9a825];
const POLICE_VMAX = [0, 22, 26, 30]; // by wanted level: a compact can outrun 1 star, the sports car outruns all
const C = SKY.Cars = { list: [], cur: null, wanted: 0, evadeT: 0, bustT: 0, breakIn: null, busted: null, spawned: {}, policeCD: 0, rammedCD: 0, sirenLvl: 0, TYPES, stats: { busted: 0, escaped: 0, stolen: 0, rented: 0 } };
let uid = 1;
// ------------------------------------------------------------------ airport landside layout (u = metres landward of the apron edge)
const AX = (apt, u) => apt.XF + apt.side * u;
const Lz = (apt) => apt.az + apt.L / 2;
C.lotRect = (apt) => { const a = AX(apt, 104), b = AX(apt, 158); return [Math.min(a, b), Lz(apt) + 14, Math.max(a, b), Lz(apt) + 66]; };
C.counterPos = (apt) => new THREE.Vector3(AX(apt, 118), 0, Lz(apt) + 19);
C.policePos = (apt) => new THREE.Vector3(AX(apt, 70), 0, Lz(apt) + 23);
C.inLot = (apt, p) => { const r = C.lotRect(apt); return p.x > r[0] && p.x < r[2] && p.z > r[1] && p.z < r[3]; };
C.lotAt = (p) => { for (const apt of SKY.Airport.list) if (C.inLot(apt, p)) return apt; return null; };
// ground decals (called from Airport.plan, before the ground is rasterized)
C.planAirport = (P, apt) => {
  const R = (Ly, x0, z0, x1, z1, col) => P.ops[Ly].push({ rect: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], col });
  const z0 = Lz(apt);
  R(1, AX(apt, 44), z0 + 6, AX(apt, 166), z0 + 18, 0x505359);                 // service road past the clinic / rental / police
  R(1, AX(apt, 104), z0 + 18, AX(apt, 158), z0 + 66, 0x6a6d72);                // rental lot
  for (let u = 108; u <= 154; u += 6) R(4, AX(apt, u), z0 + 36, AX(apt, u + 0.3), z0 + 44, 0xf2f2f2);
  for (let u = 108; u <= 154; u += 6) R(4, AX(apt, u), z0 + 54, AX(apt, u + 0.3), z0 + 62, 0xf2f2f2);
  R(4, AX(apt, 104), z0 + 18, AX(apt, 158), z0 + 18.6, 0xffd23d);
  R(1, AX(apt, 60), z0 + 18, AX(apt, 80), z0 + 40, 0x5d6e85);                  // police pad
  R(1, AX(apt, 80), z0 + 16, AX(apt, 97), z0 + 22, 0xd8d4cc);                  // clinic forecourt
  for (let k = 0; k < 4; k++) R(4, AX(apt, 85 + k * 2), z0 + 17, AX(apt, 86 + k * 2), z0 + 21, 0xffffff);
};
// voxel booths + signs (built lazily with the airport)
C.buildAirport = (apt) => {
  const WB = SKY.WB, side = apt.side, z0 = Lz(apt);
  // rental counter booth (front faces north, toward the terminal)
  const bx = AX(apt, 118);
  WB.shape(bx, 0, z0 + 25, 12, 5, 7, 0.5, (px, y, pz) => {
    const ex = Math.abs(px) > 5.5, ez = pz > 3 || pz < -3; if (y > 4.5) return 60; if (y > 4) return 63;
    if (pz < -3 && Math.abs(px) < 4 && y > 1.2 && y < 3.6) return 0; // service window
    if (pz < -3 && Math.abs(px) < 4 && y <= 1.2 && y > 0.7) return 29;
    return ex || ez ? (y < 1 ? 60 : 29) : 0;
  }, { name: apt.code + ' car rental' });
  SKY.signBoard(bx, 5.2, z0 + 21.5, [{ t: 'CAR RENTAL', m: 63 }, { t: 'RENT A RIDE', m: 29 }], 0.35, 60, 63, 'n');
  WB.smallBox(AX(apt, 156), 0, z0 + 19, 1, 14, 1, 0.5, (g) => { for (let j = 0; j < 14; j++) g.set(0, j, 0, 56); }, { name: 'post' });
  SKY.signBoard(AX(apt, 156), 7, z0 + 19, [{ t: 'RENTAL', m: 63 }, { t: 'RETURN HERE', m: 29 }], 0.25, 60, 63, 'n');
  // police office
  const px0 = AX(apt, 70);
  WB.shape(px0, 0, z0 + 32, 12, 5.5, 8, 0.5, (px, y, pz) => {
    const ex = Math.abs(px) > 5.5, ez = Math.abs(pz) > 3.5; if (y > 5) return (Math.abs(px) < 1 && Math.abs(pz) < 1) ? (px < 0 ? 47 : 34) : 68;
    if (pz < -3.5 && Math.abs(px) < 1.2 && y < 3) return 38; // door
    if (pz < -3.5 && Math.abs(px) > 2 && Math.abs(px) < 4.5 && y > 1.5 && y < 3.5) return 22;
    return ex || ez ? (y < 1.5 ? 68 : 29) : 0;
  }, { name: apt.code + ' police' });
  SKY.signBoard(px0, 5.6, z0 + 27.7, [{ t: 'POLICE', m: 29 }], 0.5, 68, 29, 'n');
};
// ------------------------------------------------------------------ rendering (instanced boxes)
let wBody = null, wLight = null;
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(), _p = new THREE.Vector3();
function writers() {
  if (wBody) return;
  const sc = SKY.Game.scene;
  wBody = new SKY.CharWriter(sc, 70 * 12); wLight = new SKY.CharWriter(sc, 70 * 6);
  wLight.mesh.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
}
function box(w, car, lx, ly, lz, sx, sy, sz, col) {
  _p.set(car.pos.x + _X.x * lx + _Z.x * lz, car.pos.y + ly, car.pos.z + _X.z * lx + _Z.z * lz);
  w.box(_p, _X, _Y, _Z, sx, sy, sz, col);
}
function drawCar(car, t) {
  const T = car.T; const a = car.yaw; _X.set(Math.cos(a), 0, -Math.sin(a)); _Z.set(Math.sin(a), 0, Math.cos(a));
  const Wd = T.W, L = T.L, h1 = T.h1, h2 = T.h2, base = 0.32;
  const body = car.col;
  box(wBody, car, 0, base + h1 / 2, 0, Wd, h1, L, body);
  if (T.police) box(wBody, car, 0, base + h1 * 0.45, 0, Wd + 0.04, h1 * 0.5, L * 0.42, 0x1b1b1f);
  const cz = -L * 0.06, cl = L * (T.spoiler ? 0.42 : 0.5);
  box(wBody, car, 0, base + h1 + h2 / 2, cz, Wd * 0.84, h2, cl, 0x24323f);
  box(wBody, car, 0, base + h1 + h2 + 0.05, cz, Wd * 0.86, 0.1, cl * 0.96, body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(wBody, car, sx * (Wd / 2 - 0.05), 0.36, sz * L * 0.32, 0.32, 0.72, 0.72, 0x151515);
  if (T.spoiler) box(wBody, car, 0, base + h1 + 0.35, -L / 2 + 0.25, Wd * 0.9, 0.08, 0.4, 0x1b1b1f);
  if (car.taxi) box(wBody, car, 0, base + h1 + h2 + 0.25, cz, 0.7, 0.3, 0.35, 0xfff176);
  // lights
  const ly = base + h1 * 0.62;
  for (const sx of [-1, 1]) { box(wLight, car, sx * Wd * 0.32, ly, L / 2 + 0.02, 0.42, 0.18, 0.06, 0xfff6c0); box(wLight, car, sx * Wd * 0.32, ly, -L / 2 - 0.02, 0.42, 0.18, 0.06, car.braking ? 0xff2020 : 0x9a1010); }
  if (T.police) {
    const on = car.siren; const ph = Math.floor(t * 6) % 2;
    box(wLight, car, -0.36, base + h1 + h2 + 0.2, cz, 0.62, 0.2, 0.36, on && ph ? 0xff2a2a : 0x6a1010);
    box(wLight, car, 0.36, base + h1 + h2 + 0.2, cz, 0.62, 0.2, 0.36, on && !ph ? 0x2a6aff : 0x10206a);
  }
}
C.render = (cam) => {
  if (!SKY.Game || !SKY.Game.scene) return; writers();
  wBody.begin(); wLight.begin(); const t = SKY.Game.time;
  const far = SKY.lowSpec ? 330 : 520;
  for (const car of C.list) { if (car.gone) continue; const d = (car.pos.x - cam.x) ** 2 + (car.pos.z - cam.z) ** 2; if (d > far * far && car !== C.cur) continue; drawCar(car, t); }
  wBody.end(); wLight.end();
};
// ------------------------------------------------------------------ car objects
function makeCar(type, x, z, yaw, o) {
  const T = TYPES[type]; o = o || {};
  const car = Object.assign({ id: uid++, type, T, pos: new THREE.Vector3(x, W.heightAt(x, z), z), yaw, speed: 0, steer: 0, kind: 'parked', col: o.col != null ? o.col : T.col, city: null, stuckT: 0, revT: 0, braking: false, siren: false, path: null, s: 0, dir: 1 }, o);
  C.list.push(car); return car;
}
C.make = makeCar;
function removeCar(car) { car.gone = true; C.list = C.list.filter((c) => c !== car); if (C.cur === car) C.cur = null; }
C.remove = removeCar;
const fwd = (car) => ({ x: Math.sin(car.yaw), z: Math.cos(car.yaw) });
// polyline helpers
function polyLen(pts) { let L = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const l = hyp(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; } return { pts, seg, L }; }
function along(path, s, out) { const { pts, seg } = path; let i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; } const a = pts[i], b = pts[i + 1]; const f = seg[i] > 0 ? clamp(s / seg[i], 0, 1) : 0; const l = seg[i] || 1; out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.dx = (b[0] - a[0]) / l; out.dz = (b[1] - a[1]) / l; return out; }
const _a = {};
// ------------------------------------------------------------------ per-city ambient cars
function spawnCity(c) {
  const r = SKY.rng(c.seed + 991); const low = SKY.lowSpec; const tag = { city: c };
  const apt = c.apt;
  if (apt) {
    const z0 = Lz(apt);
    // parked cars in the landside parking lot (stalls: 5 m wide along u, rows every 16 m)
    const n = low ? 5 : 8; const used = new Set();
    for (let i = 0; i < n * 3 && used.size < n; i++) {
      const row = Math.floor(r() * Math.floor((apt.L - 10) / 16)), col = Math.floor(r() * 16); const key = row * 100 + col; if (used.has(key)) continue;
      const u = 72.5 + col * 5; if (u > 150) continue; const z = apt.az - apt.L / 2 + 8 + row * 16 + 2.5;
      const x = AX(apt, u); if (W.solidAt(x, 1, z) || W.solidAt(x, 1, z + 2) || W.solidAt(x, 1, z - 2)) continue;
      used.add(key); makeCar('sedan', x, z, r() < 0.5 ? 0 : Math.PI, { kind: 'parked', col: SEDAN_COLS[Math.floor(r() * SEDAN_COLS.length)], city: c, taxi: c.id === 'NYC' && r() < 0.4 });
    }
    // rental fleet on display (one of each) + the airport police cruiser
    ['compact', 'sports', 'suv'].forEach((t, i) => makeCar(t, AX(apt, 112 + i * 6 + 3), z0 + 58, Math.PI, { kind: 'parked', fleet: true, city: c }));
    makeCar('police', AX(apt, 64), z0 + 37, Math.PI, { kind: 'decor', city: c });
    // cars slowly cruising the landside loop (curb road ↔ service road)
    const loop = polyLen([[AX(apt, 50), apt.az - apt.L / 2 - 40], [AX(apt, 50), z0 + 12], [AX(apt, 162), z0 + 12], [AX(apt, 162), apt.az - apt.L / 2 - 40], [AX(apt, 50), apt.az - apt.L / 2 - 40]]);
    for (let k = 0; k < (low ? 1 : 2); k++) { const car = makeCar('sedan', 0, 0, 0, { kind: 'npc', col: SEDAN_COLS[(k * 3 + 2) % SEDAN_COLS.length], city: c, path: loop, s: loop.L * (k / 2 + 0.1), dir: 1, loop: true, lane: 2.2, v: 7, taxi: c.id === 'NYC' }); placeOnPath(car); }
  }
  // city streets: a few parked cars + slow cruisers on traffic roads near the centre
  const roads = (c.plan.roads || []).filter((rd) => rd.traffic && rd.pts && rd.pts.length > 1).map((rd) => Object.assign(polyLen(rd.pts), { w: rd.w || 12 })).filter((rd) => rd.L > 160);
  roads.sort((a, b) => dCenter(a, c) - dCenter(b, c));
  const near = roads.slice(0, 6);
  if (near.length) {
    for (let i = 0; i < (low ? 3 : 6); i++) {
      const rd = near[i % near.length]; const s = r() * rd.L; along(rd, s, _a); const side = r() < 0.5 ? 1 : -1; const off = rd.w * 0.42 * side;
      const x = _a.x - _a.dz * off, z = _a.z + _a.dx * off; if (W.solidAt(x, 1, z) || W.isWater(x, z)) continue;
      makeCar('sedan', x, z, Math.atan2(_a.dx * side, _a.dz * side), { kind: 'parked', col: SEDAN_COLS[Math.floor(r() * SEDAN_COLS.length)], city: c, taxi: c.id === 'NYC' && r() < 0.5 });
    }
    for (let k = 0; k < (low ? 1 : 2) && k < near.length; k++) { const rd = near[k]; const car = makeCar('sedan', 0, 0, 0, { kind: 'npc', col: SEDAN_COLS[(k * 5 + 1) % SEDAN_COLS.length], city: c, path: rd, s: rd.L * 0.3, dir: 1, loop: false, lane: rd.w * 0.22, v: 8, taxi: c.id === 'NYC' }); placeOnPath(car); }
  }
  C.spawned[c.id] = true;
}
function dCenter(rd, c) { let b = 1e9; for (const p of rd.pts) b = Math.min(b, hyp(p[0] - c.x, p[1] - c.z)); return b; }
function placeOnPath(car) { along(car.path, car.s, _a); const fx = _a.dx * car.dir, fz = _a.dz * car.dir; car.pos.x = _a.x - fz * car.lane; car.pos.z = _a.z + fx * car.lane; car.pos.y = W.heightAt(car.pos.x, car.pos.z); car.yaw = Math.atan2(fx, fz); }
function despawnCity(c) { for (const car of C.list.slice()) if (car.city === c && car !== C.cur) removeCar(car); C.spawned[c.id] = false; }
// ------------------------------------------------------------------ collisions
function solidPt(x, y, z) {
  if (W.solidAt(x, y, z)) return true;
  const pl = SKY.Game.plane; if (Math.abs(pl.pos.x - x) < 22 && Math.abs(pl.pos.z - z) < 22) { const lp = pl.toLocal(_p.set(x, y, z)); if (pl.solidLocal(lp.x, lp.y, lp.z)) return true; }
  return false;
}
function blocked(car, x, z, dirSign) {
  const T = car.T; const f = { x: Math.sin(car.yaw), z: Math.cos(car.yaw) }; const rx = f.z, rz = -f.x; const y = W.heightAt(x, z);
  const L = T.L / 2 * dirSign, hw = T.W / 2 - 0.1;
  for (const k of [-1, 0, 1]) { const px = x + f.x * L + rx * hw * k, pz = z + f.z * L + rz * hw * k; if (solidPt(px, y + 0.7, pz) || solidPt(px, y + 1.3, pz)) return true; }
  if (car.kind !== 'npc' && W.isWater(x + f.x * L, z + f.z * L)) return true;
  return false;
}
// ------------------------------------------------------------------ driving physics (player + police share it)
function physics(car, dt, thr, steer, hand) {
  const T = car.T; const vmax = car.vmax || T.vmax;
  car.braking = false;
  if (thr >= -0.05) car.revT = 0;
  if (thr > 0.05) { if (car.speed < -0.5) { car.speed += 16 * thr * dt; car.braking = true; } else car.speed += T.acc * thr * dt * (1 - Math.max(0, car.speed) / (vmax * 1.05)); }
  else if (thr < -0.05) { if (car.speed > 0.5) { car.speed += 16 * thr * dt; car.braking = true; car.revT = 0; } else { car.revT = (car.revT || 0) + dt; if (car.revT > 0.4) car.speed = Math.max(-8, car.speed + T.acc * 0.6 * thr * dt); else { car.speed = Math.max(0, car.speed - 4 * dt); car.braking = true; } } } // brake, then (after a beat) reverse
  else { car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), (1.2 + Math.abs(car.speed) * 0.25) * dt); }
  if (hand) { car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 20 * dt); car.braking = true; }
  car.speed = clamp(car.speed, -8, vmax);
  car.steer += (steer - car.steer) * Math.min(1, 8 * dt);
  const sp = Math.abs(car.speed);
  const yawRate = car.steer * T.steer * clamp(sp / 7, 0, 1) * (1 - 0.4 * clamp(sp / vmax, 0, 1)) * Math.sign(car.speed || 1) * (hand ? 1.35 : 1);
  const ny = car.yaw - yawRate * dt;
  const f = { x: Math.sin(ny), z: Math.cos(ny) };
  const nx = car.pos.x + f.x * car.speed * dt, nz = car.pos.z + f.z * car.speed * dt;
  const oy = car.yaw; car.yaw = ny;
  let hit = 0;
  if (blocked(car, nx, nz, car.speed >= 0 ? 1 : -1)) { car.yaw = oy; hit = Math.abs(car.speed); car.speed *= -0.25; }
  else { car.pos.x = nx; car.pos.z = nz; }
  car.pos.y += (W.heightAt(car.pos.x, car.pos.z) - car.pos.y) * Math.min(1, 12 * dt);
  return hit;
}
function carCollisions(dt) {
  const L = C.list; const P = SKY.Player;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const R = (a.T.L + b.T.L) * 0.32; const d2 = dx * dx + dz * dz; if (d2 > R * R || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), pen = R - d, nx = dx / d, nz = dz / d;
    const aStatic = a.kind === 'parked' || a.kind === 'decor', bStatic = b.kind === 'parked' || b.kind === 'decor';
    const wa = aStatic && !bStatic ? 0 : bStatic && !aStatic ? 1 : 0.5;
    if (!(aStatic && bStatic)) { a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa; b.pos.x += nx * pen * (1 - wa); b.pos.z += nz * pen * (1 - wa); }
    const rel = Math.abs(a.speed - b.speed);
    if (a === C.cur || b === C.cur) {
      const other = a === C.cur ? b : a;
      if (other.kind === 'police' && rel > 8 && C.rammedCD <= 0 && C.wanted > 0 && C.wanted < 3) { C.rammedCD = 8; C.setWanted(C.wanted + 1, '🚓 You bumped a police cruiser!'); }
      if (rel > 6) { SKY.Audio.play('crunch', Math.min(1, rel / 20)); SKY.Game.shake(Math.min(0.5, rel / 40)); }
    }
    if (rel > 1) { a.speed *= 0.7; b.speed *= 0.7; }
  }
  // cars vs the walking player: gentle cartoon shove (no damage)
  if (P.frame === 'world' && P.mode === 'foot') for (const car of L) {
    const dx = P.pos.x - car.pos.x, dz = P.pos.z - car.pos.z; const d = hyp(dx, dz); if (d > car.T.L * 0.55 || Math.abs(P.pos.y - car.pos.y) > 2.5) continue;
    if (Math.abs(car.speed) > 2) { P.vel.x += dx / (d || 1) * 4; P.vel.z += dz / (d || 1) * 4; P.vel.y = Math.max(P.vel.y, 2); car.speed *= 0.3; if (car.kind === 'npc') SKY.toast('🚗 *HONK* "Watch it, pal!"'); SKY.Audio.play('horn'); }
    else { P.pos.x = car.pos.x + dx / (d || 1) * car.T.L * 0.55; P.pos.z = car.pos.z + dz / (d || 1) * car.T.L * 0.55; }
  }
}
// ------------------------------------------------------------------ NPC + police AI
function npcStep(car, dt) {
  const P = SKY.Player; const f = fwd(car);
  // stop for the player / other cars ahead
  let want = car.v; const tx = P.frame === 'world' ? P.pos : null;
  const ahead = (x, z) => { const dx = x - car.pos.x, dz = z - car.pos.z; const fa = dx * f.x + dz * f.z, sd = Math.abs(dx * f.z - dz * f.x); return fa > 0 && fa < 10 && sd < 3; };
  if (tx && ahead(tx.x, tx.z)) want = 0;
  for (const o of C.list) if (o !== car && ahead(o.pos.x, o.pos.z)) { want = 0; break; }
  if (C.breakIn && C.breakIn.car === car) want = 0;
  car.speed += clamp(want - car.speed, -10 * dt, 3 * dt); car.braking = car.speed > want + 0.1;
  car.s += car.speed * car.dir * dt;
  if (car.loop) { if (car.s > car.path.L) car.s -= car.path.L; if (car.s < 0) car.s += car.path.L; }
  else { if (car.s > car.path.L - 6) { car.s = car.path.L - 6; car.dir = -1; } if (car.s < 6) { car.s = 6; car.dir = 1; } }
  const oy = car.yaw; placeOnPath(car); let dy = wrap(car.yaw - oy); car.yaw = oy + clamp(dy, -2.5 * dt, 2.5 * dt);
}
function policeStep(car, dt) {
  const P = SKY.Player; const tgt = C.cur ? C.cur.pos : P.pos; const tv = C.cur ? C.cur.speed : 0;
  car.vmax = POLICE_VMAX[Math.max(1, C.wanted)] || 24; car.siren = C.wanted > 0;
  if (C.wanted <= 0) { // give up: drive away and vanish
    car.leaveT = (car.leaveT || 0) + dt; physics(car, dt, 0.6, 0.2, false); if (car.leaveT > 6) removeCar(car); return;
  }
  const dx = tgt.x - car.pos.x, dz = tgt.z - car.pos.z, d = hyp(dx, dz);
  let ax = tgt.x, az = tgt.z;
  if (C.cur && d < 30 && tv > 4) { const f = fwd(C.cur); ax += f.x * Math.min(10, tv * 0.6); az += f.z * Math.min(10, tv * 0.6); } // cut in front to block
  const want = Math.atan2(ax - car.pos.x, az - car.pos.z); const err = wrap(want - car.yaw);
  let thr = 1, steer = clamp(-err * 2.2, -1, 1);
  if (!C.cur && d < 14) thr = car.speed > 7 ? -0.6 : 0.4;         // on foot: don't flatten anyone, just stop next to them
  else if (C.cur && d < 9 && Math.abs(tv) < 4) thr = car.speed > 3 ? -1 : 0.2;
  if (Math.abs(err) > 1.9 && d < 25) { thr = -0.7; steer = -steer; } // target behind: back up & swing round
  // stuck → reverse briefly
  if (car.revT > 0) { car.revT -= dt; thr = -1; steer = car.revSteer; }
  else if (Math.abs(car.speed) < 1 && thr > 0.3 && d > 10) { car.stuckT += dt; if (car.stuckT > 1.2) { car.stuckT = 0; car.revT = 1.1; car.revSteer = Math.random() < 0.5 ? 1 : -1; } } else car.stuckT = 0;
  physics(car, dt, thr, steer, false);
}
function spawnPolice() {
  const P = SKY.Player; const ref = C.cur ? C.cur.pos : P.pos; const back = C.cur ? C.cur.yaw + Math.PI : -P.yaw;
  for (let k = 0; k < 16; k++) {
    const ang = back + (k === 0 ? 0 : rand(-1.6, 1.6)), dist = k < 10 ? rand(85, 115) : rand(60, 85); // inside the 120 m 'lost them' radius
    const x = ref.x + Math.sin(ang) * dist, z = ref.z + Math.cos(ang) * dist; const y = W.heightAt(x, z);
    if (W.isWater(x, z) || y > 30) continue;
    let ok = true; for (const o of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) if (W.solidAt(x + o[0], y + 0.8, z + o[1]) || W.solidAt(x + o[0], y + 1.6, z + o[1])) { ok = false; break; }
    if (!ok) continue;
    const car = makeCar('police', x, z, Math.atan2(ref.x - x, ref.z - z), { kind: 'police', siren: true }); car.speed = 8; return car;
  }
  return null;
}
C.police = () => C.list.filter((c) => c.kind === 'police');
C.setWanted = (n, why) => {
  const before = C.wanted; C.wanted = clamp(n, 0, 3); if (!before) C.copsSeen = false;
  if (C.wanted > before) { C.evadeT = 0; SKY.toast((why || '🚨 Wanted!') + ' WANTED ' + '★'.repeat(C.wanted) + ' — lose the cops or return the car to a rental lot', 'bad'); SKY.Audio.play('error'); C.policeCD = Math.min(C.policeCD, 1.2); }
};
C.clearWanted = (how) => {
  if (!C.wanted) return; C.wanted = 0; C.evadeT = 0; C.bustT = 0; C.copsSeen = false;
  if (how === 'escaped') { SKY.toast('😎 You lost the cops! Wanted level cleared.', 'good'); SKY.Audio.play('ok'); C.stats.escaped++; SKY.Game.achieve('getaway'); }
  else if (how === 'returned') SKY.toast('🔑 Car returned — the police lose interest. Wanted level cleared.', 'good');
};
// ------------------------------------------------------------------ player: enter / exit / steal / rent / return
C.enter = (car) => {
  const P = SKY.Player; if (P.held) P.dropHeld();
  if (car.kind === 'npc') { car.kind = 'parked'; car.path = null; }
  C.cur = car; car.owner = 'player'; car.city = null; P.mode = 'drive'; P.frame = 'world'; P.vel.set(0, 0, 0); P.target = null; P.pos.copy(car.pos);
  const G = SKY.Game; G.camOrbit.yaw = 0; G.camOrbit.pitch = 0; G.camInit = false; G.carCam = null;
  SKY.Audio.play('beep');
  SKY.toast('🚗 ' + car.T.name + (SKY.isTouch ? ' — steer with the joystick, GAS / BRAKE pedals, EXIT to get out' : ' — W/S gas & brake, A/D steer, Space handbrake, F exit'), 'good');
};
C.exit = () => {
  const P = SKY.Player, car = C.cur; if (!car) return;
  const apt = C.returnLot(car);
  if (apt && Math.abs(car.speed) < 4) { returnCar(car, apt); return; }
  if (Math.abs(car.speed) > 6) { SKY.toast('🛑 Slow down before you hop out!', 'warn'); return; }
  const f = fwd(car); const rx = f.z, rz = -f.x;
  let placed = false;
  for (const s of [-1, 1]) { const x = car.pos.x + rx * s * (car.T.W / 2 + 1.0), z = car.pos.z + rz * s * (car.T.W / 2 + 1.0); const y = W.heightAt(x, z); _p.set(x, y + 0.05, z); if (!P.bodyHit(_p)) { P.pos.copy(_p); placed = true; break; } }
  if (!placed) P.pos.set(car.pos.x - f.x * (car.T.L / 2 + 1.2), car.pos.y + 0.05, car.pos.z - f.z * (car.T.L / 2 + 1.2));
  car.speed = 0; car.steer = 0; car.braking = false; C.cur = null;
  P.mode = 'foot'; P.frame = 'world'; P.vel.set(0, 0, 0); P.yaw = Math.atan2(-f.x, -f.z); P.pitch = 0; P.grounded = true;
  SKY.Game.camInit = false; SKY.Audio.play('beep');
};
function returnCar(car, apt) {
  const P = SKY.Player; const stolen = car.stolen;
  C.cur = null; removeCar(car);
  const cp = C.counterPos(apt); P.mode = 'foot'; P.frame = 'world'; P.pos.set(cp.x + apt.side * 2, 0.05, cp.z + 3); P.vel.set(0, 0, 0); P.yaw = 0; P.grounded = true; SKY.Game.camInit = false;
  if (C.wanted) C.clearWanted('returned');
  SKY.toast(stolen ? '🔑 You returned the "borrowed" ' + car.T.name + ' to ' + apt.code + ' Car Rental. No harm done!' : '🔑 ' + car.T.name + ' returned to ' + apt.code + ' Car Rental. Thanks for driving GROK!', 'good'); SKY.Audio.play('ok');
}
// a car can be returned in any rental lot once it has been driven out of the lot it was picked up in (or if it's stolen)
C.returnLot = (car) => { const apt = C.lotAt(car.pos); if (!apt) return null; return car.leftLot || car.stolen || car.kind !== 'rental' || car.rentedAt !== apt.code ? apt : null; };
C.startSteal = (car) => {
  if (C.breakIn) return;
  C.breakIn = { car, t: 0, dur: 2.0 };
  SKY.Audio.play('clang');
  if (car.kind === 'npc') SKY.toast('😠 "HEY! That\'s my car!" — the driver hops out and runs off', 'warn'); else SKY.toast('🚨 *BEEP BEEP BEEP* car alarm!', 'warn');
};
function finishSteal() {
  const b = C.breakIn; C.breakIn = null; const car = b.car; if (car.gone) return;
  car.stolen = true; C.stats.stolen++;
  C.enter(car);
  C.setWanted(Math.max(1, C.wanted + 1), '🚨 Car stolen!');
  SKY.Game.achieve('joyride');
}
C.rentPanel = (apt) => {
  const M = SKY.Mini; const PL = SKY.Places;
  const rows = ['compact', 'sports', 'suv'].map((k) => { const T = TYPES[k]; const sw = '#' + T.col.toString(16).padStart(6, '0'); return '<div class="prow"><span class="pe">' + T.icon + '</span><b>' + T.name + '<small><i class="swatch" style="background:' + sw + '"></i> ' + T.desc + ' · speed ' + '●'.repeat(T.stars) + '○'.repeat(5 - T.stars) + '</small></b><button id="rent-' + k + '" class="go">Rent · 🪙' + T.price + '</button></div>'; }).join('');
  M.open('🚗 ' + apt.code + ' Car Rental', '<p class="fine">Pick a ride! It\'s parked right outside. Bring it back to any airport rental lot (drive into the lot and press EXIT) to return it.</p>' + rows, 'rent');
  for (const k of ['compact', 'sports', 'suv']) { const b = document.getElementById('rent-' + k); if (b) b.onclick = (e) => { e.stopPropagation(); C.rent(apt, k); }; }
};
C.rent = (apt, type) => {
  const PL = SKY.Places; const T = TYPES[type]; if (!PL.spend(T.price)) return null;
  SKY.Game.closeUI();
  // spawn in the lot's open aisle (z0+48), east of the booth, nose toward the service road (north) with a clear run out
  const z0 = Lz(apt); let x = AX(apt, 132), z = z0 + 48;
  for (let k = 0; k < 5; k++) { const xx = AX(apt, 132 + k * 6); if (!C.list.some((c) => hyp(c.pos.x - xx, c.pos.z - z) < 4)) { x = xx; break; } }
  const car = makeCar(type, x, z, Math.PI, { kind: 'rental', owner: 'player', rentedAt: apt.code });
  C.stats.rented++;
  SKY.toast('🔑 You rented the ' + T.icon + ' ' + T.name + ' (−' + T.price + ' 🪙). Have fun out there!', 'good'); SKY.Audio.play('ok');
  SKY.Game.achieve('rental');
  C.enter(car);
  return car;
};
// interaction targets for the walking player (merged into Player.updateTarget)
C.targets = () => {
  const P = SKY.Player, out = [];
  if (P.frame !== 'world' || P.mode !== 'foot' || C.breakIn || (SKY.Places && SKY.Places.cur)) return out;
  for (const car of C.list) {
    const d = hyp(car.pos.x - P.pos.x, car.pos.z - P.pos.z); if (d > 5.5 || Math.abs(car.pos.y - P.pos.y) > 3) continue;
    const pos = new THREE.Vector3(car.pos.x, car.pos.y + 1.2, car.pos.z);
    if (car.owner === 'player') out.push({ pos, r: 5.5, label: () => '🚗 Drive your ' + car.T.name, act: () => C.enter(car) });
    else if (car.kind === 'parked' || car.kind === 'npc') out.push({ pos, r: 5.5, label: () => '🔓 STEAL this ' + (car.fleet ? car.T.name : car.T.name) + ' (wanted ★)', act: () => C.startSteal(car) });
  }
  // rental counters
  for (const apt of SKY.Airport.list) { if (!apt.built) continue; const cp = C.counterPos(apt); if (hyp(cp.x - P.pos.x, cp.z - P.pos.z) > 6) continue; out.push({ pos: new THREE.Vector3(cp.x, 1.3, cp.z), r: 5, label: () => '🚗 CAR RENTAL — rent a car (' + apt.code + ')', act: () => C.rentPanel(apt) }); }
  return out;
};
// ------------------------------------------------------------------ main update (called by game.js every step)
// returns true when player input should be frozen (break-in bar / busted screen)
C.preUpdate = (dt, I) => {
  if (C.busted) return true;
  if (C.breakIn) {
    const b = C.breakIn, P = SKY.Player; b.t += dt; b.car.speed *= 0.8;
    if (P.mode !== 'foot' || P.frame !== 'world' || hyp(b.car.pos.x - P.pos.x, b.car.pos.z - P.pos.z) > 8) { C.breakIn = null; return false; }
    if (Math.floor(b.t * 4) !== Math.floor((b.t - dt) * 4)) SKY.Audio.play('beep');
    if (b.t >= b.dur) finishSteal();
    return true;
  }
  return false;
};
// player driving (called from Player.update when P.mode === 'drive')
C.drive = (dt, I) => {
  const P = SKY.Player, car = C.cur;
  if (!car || car.gone) { P.mode = 'foot'; C.cur = null; return; }
  if (I.edge('interact')) { C.exit(); return; }
  if (I.edge('horn')) SKY.Audio.play('horn');
  let thr = clamp(I.move.y, -1, 1); if (I.hold('gas')) thr = 1; if (I.hold('brake')) thr = -1;
  const steer = clamp(I.move.x, -1, 1); const hand = I.hold('jump');
  const hit = physics(car, dt, thr, steer, hand);
  if (!car.leftLot && !C.lotAt(car.pos)) car.leftLot = true;
  if (hit > 7) { SKY.Audio.play('crunch', Math.min(1, hit / 25)); SKY.Game.shake(Math.min(0.6, hit / 35)); }
  P.pos.copy(car.pos); P.vel.set(Math.sin(car.yaw) * car.speed, 0, Math.cos(car.yaw) * car.speed); P.grounded = true;
};
C.update = (dt) => {
  const G = SKY.Game, P = SKY.Player;
  C.policeCD -= dt; C.rammedCD -= dt;
  if (C.cur && (P.mode !== 'drive' || C.cur.gone)) { C.cur = null; if (P.mode === 'drive') P.mode = 'foot'; }
  // spawn / despawn ambient cars with their city
  for (const c of W.cities) { if (c.complete && !C.spawned[c.id]) spawnCity(c); else if (!c.built && C.spawned[c.id]) despawnCity(c); }
  const ref = C.cur ? C.cur.pos : P.pos;
  for (const car of C.list.slice()) {
    if (car === C.cur) continue;
    if (car.kind === 'npc') { if (hyp(car.pos.x - G.camPos.x, car.pos.z - G.camPos.z) < 900) npcStep(car, dt); }
    else if (car.kind === 'police') policeStep(car, dt);
    else if (Math.abs(car.speed) > 0.05) physics(car, dt, 0, 0, true); // abandoned car coasting to a stop
  }
  carCollisions(dt);
  // ---- wanted level / police / evade / busted
  const cops = C.police();
  if (C.wanted > 0 && !C.busted) {
    let minD = 1e9; for (const cp of cops) minD = Math.min(minD, hyp(cp.pos.x - ref.x, cp.pos.z - ref.z));
    const hidden = (SKY.Places && SKY.Places.cur) || P.frame !== 'world';
    if (cops.length) C.copsSeen = true;
    if (hidden || (minD > 120 && C.copsSeen)) C.evadeT += dt; // the clock only runs once the police have actually shown up (or you're hiding) else if (minD < 75) C.evadeT = Math.max(0, C.evadeT - dt * 1.5);
    for (const cp of cops) if (hyp(cp.pos.x - ref.x, cp.pos.z - ref.z) > 400 || cp.pos.y > 60) removeCar(cp);
    if (C.police().length < C.wanted && C.evadeT <= 0.5 && C.policeCD <= 0 && !hidden) { C.policeCD = 3; spawnPolice(); }
    if (C.evadeT >= 10) C.clearWanted('escaped');
    // busted: a cruiser right next to you while you're (nearly) stopped, or on foot
    const close = !hidden && cops.some((cp) => hyp(cp.pos.x - ref.x, cp.pos.z - ref.z) < (C.cur ? 7.5 : 5.5));
    const slow = C.cur ? Math.abs(C.cur.speed) < 3 : true;
    if (close && slow) C.bustT += dt; else C.bustT = Math.max(0, C.bustT - dt * 0.6);
    if (C.bustT >= (C.cur ? 1.6 : 1.3)) bust();
  } else { C.bustT = 0; C.evadeT = 0; }
  // siren loudness = nearest chasing cruiser
  let sl = 0; if (C.wanted > 0) for (const cp of cops) sl = Math.max(sl, clamp(1 - hyp(cp.pos.x - G.camPos.x, cp.pos.z - G.camPos.z) / 260, 0, 1));
  C.sirenLvl = sl;
  // busted screen
  if (C.busted) { const B = C.busted; B.t += dt; if (B.t > 1.0 && !B.moved) { B.moved = true; respawnAtPolice(B); } if (B.t > 3.2) { C.busted = null; const el = document.getElementById('busted'); if (el) el.classList.remove('show'); } }
};
function bust() {
  const P = SKY.Player, PL = SKY.Places; const fine = Math.min(PL.coins(), 15);
  C.busted = { t: 0, fine, moved: false }; C.stats.busted++;
  if (fine > 0) { PL.save.coins -= fine; PL.persist(); }
  const el = document.getElementById('busted'); if (el) { el.querySelector('.bsub').textContent = (fine ? '−' + fine + ' 🪙 fine · ' : '') + choose(['"Rules of the road, pal!"', '"Nice try, speed racer."', '"License and registration... oh, wait."', '"You have the right to remain cartoony."']); el.classList.add('show'); }
  SKY.Audio.play('error'); SKY.Game.achieve('busted');
}
function respawnAtPolice(B) {
  const P = SKY.Player; const car = C.cur; const ref = car ? car.pos : P.pos;
  const apt = SKY.Airport.nearest(ref.x, ref.z, 1e9) || SKY.Airport.list[0];
  if (car) { C.cur = null; if (car.stolen || car.kind === 'rental') removeCar(car); }
  for (const cp of C.police()) removeCar(cp);
  C.wanted = 0; C.evadeT = 0; C.bustT = 0; C.breakIn = null;
  W.ensureCity(apt.c);
  if (SKY.Places && SKY.Places.cur) SKY.Places.clearCur();
  const pp = C.policePos(apt); P.mode = 'foot'; P.frame = 'world'; P.chute = false; P.pos.set(pp.x, W.heightAt(pp.x, pp.z) + 0.05, pp.z); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; P.grounded = true; SKY.Game.camInit = false;
  SKY.toast('🚔 Busted! Released from the ' + apt.code + ' airport police office' + (B.fine ? ' after paying a ' + B.fine + '-coin fine' : '') + '. Drive nice!', 'warn');
}
C.reset = () => { for (const car of C.list.slice()) if (car.kind === 'police' || car.owner === 'player') removeCar(car); C.cur = null; C.wanted = 0; C.evadeT = 0; C.bustT = 0; C.breakIn = null; C.busted = null; const el = document.getElementById('busted'); if (el) el.classList.remove('show'); };
// chase camera (called from Game.updateCamera)
C.camera = (cam, dt, O) => {
  const car = C.cur, G = SKY.Game; if (O.t > 0) O.t -= dt; else { O.yaw *= 1 - 2 * dt; O.pitch *= 1 - 2 * dt; }
  const back = car.yaw + Math.PI + O.yaw; const dist = car.T.L * 1.6 + 3.5 + Math.min(4, Math.abs(car.speed) * 0.12), pitch = 0.32 + O.pitch * 0.6;
  const want = new THREE.Vector3(car.pos.x + Math.sin(back) * Math.cos(pitch) * dist, car.pos.y + 1.2 + Math.sin(pitch) * dist, car.pos.z + Math.cos(back) * Math.cos(pitch) * dist);
  const gh = W.heightAt(want.x, want.z) + 0.6; if (want.y < gh) want.y = gh;
  if (!G.carCam || !G.camInit) { G.carCam = want.clone(); G.camInit = true; }
  G.carCam.lerp(want, Math.min(1, 7 * dt));
  cam.position.copy(G.carCam); cam.up.set(0, 1, 0); cam.lookAt(car.pos.x, car.pos.y + 1.3, car.pos.z);
};
// HUD (called from Game.updateHUD)
C.hud = () => {
  const P = SKY.Player, $ = (id) => document.getElementById(id);
  const wn = $('wanted');
  if (wn) {
    if (C.wanted > 0) { wn.style.display = 'block'; const ev = C.evadeT > 0.2 ? '<small>🏃 losing them… ' + Math.max(0, Math.ceil(10 - C.evadeT)) + 's</small>' : '<small>🚓 police chasing — get 120 m away for 10 s</small>'; wn.innerHTML = '<b>' + '★'.repeat(C.wanted) + '<i>' + '★'.repeat(3 - C.wanted) + '</i></b>' + ev + (C.bustT > 0.15 ? '<div class="bust"><span style="width:' + Math.round(clamp(C.bustT / 1.6, 0, 1) * 100) + '%"></span>🚔 PULL OVER!</div>' : ''); }
    else wn.style.display = 'none';
  }
  const bar = $('carbar');
  if (bar) { if (C.breakIn) { bar.style.display = 'block'; bar.innerHTML = '🔓 Breaking in… <div><span style="width:' + Math.round(C.breakIn.t / C.breakIn.dur * 100) + '%"></span></div>'; } else bar.style.display = 'none'; }
  const car = C.cur;
  document.body.classList.toggle('drive', !!car);
  const sp = $('carspd'); if (sp) sp.textContent = car ? Math.round(Math.abs(car.speed) * 3.6) + ' km/h' : '';
  const inLot = car && C.returnLot(car);
  for (const id of ['tcarexit', 'carexit']) { const b = $(id); if (b) b.innerHTML = inLot ? '🔑<small>RETURN</small>' : '🚪<small>EXIT</small>'; }
};
C.hint = () => {
  const car = C.cur; if (!car) return C.wanted ? '🚨 WANTED ' + '★'.repeat(C.wanted) + ' — run! Hide indoors or get far away from the police' : null;
  const apt = C.returnLot(car);
  if (!apt && C.lotAt(car.pos) && !car.leftLot) return '🔑 ' + car.T.name + ' — drive out of the lot and have fun! (bring it back to any rental lot later)';
  if (apt) return '🅿 In the ' + apt.code + ' rental lot — stop & press EXIT to return the car' + (C.wanted ? ' (clears your wanted level)' : '');
  return '🚗 ' + car.T.name + (car.stolen ? ' (stolen!)' : '') + ' · ' + Math.round(Math.abs(car.speed) * 3.6) + ' km/h' + (C.wanted ? ' · 🚨 lose the cops or return the car to a rental lot' : ' · rental lots are next to every airport terminal');
};
})();

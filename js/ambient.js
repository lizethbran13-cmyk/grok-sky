'use strict';
// GROK SKY - ambient life near the active city: instanced cars on boulevards, pedestrians on sidewalks & in terminals,
// apron baggage trains + fuel trucks, Bellagio fountain show, Luxor sky beam, LAX light pylons. Distance-culled, cheap.
(() => {
const W = SKY.World;
const Amb = SKY.Ambient = {};
const geo = {}, mats = {};
const CAR_COLS = [0xd32f2f, 0x1976d2, 0xfbc02d, 0xeeeeee, 0x212121, 0x388e3c, 0x9e9e9e, 0xff7043, 0x5e35b1];
const PED_COLS = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0xff7043, 0x546e7a, 0xffffff, 0x6d4c41];
function init() {
  if (geo.car) return;
  geo.car = (() => { const a = new THREE.BoxGeometry(2, 1.1, 4.4); a.translate(0, 0.75, 0); const b = new THREE.BoxGeometry(1.8, 0.8, 2.2); b.translate(0, 1.6, -0.2); return SKY.mergeGeos([a, b]); })();
  geo.ped = (() => { const a = new THREE.BoxGeometry(0.5, 1.15, 0.32); a.translate(0, 0.95, 0); const b = new THREE.BoxGeometry(0.34, 0.34, 0.34); b.translate(0, 1.72, 0); const l = new THREE.BoxGeometry(0.42, 0.42, 0.28); l.translate(0, 0.21, 0); return SKY.mergeGeos([a, b, l]); })();
  geo.box = new THREE.BoxGeometry(1, 1, 1);
  mats.lam = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mats.glow = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mats.jet = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.75, depthWrite: false });
  mats.beam = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
}
function polyLen(pts) { let L = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; } return { L, seg }; }
function along(path, s, out) { // position + direction at distance s
  const { pts, seg } = path; let i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
  const a = pts[i], b = pts[i + 1], f = seg[i] > 0 ? Math.min(1, s / seg[i]) : 0; const dx = b[0] - a[0], dz = b[1] - a[1], l = seg[i] || 1;
  out.x = a[0] + dx * f; out.z = a[1] + dz * f; out.dx = dx / l; out.dz = dz / l; return out;
}
function instMesh(c, g, m, n, colors) {
  const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (colors) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); const cc = new THREE.Color(); for (let i = 0; i < n; i++) { cc.setHex(colors[i % colors.length]); im.instanceColor.setXYZ(i, cc.r, cc.g, cc.b); } }
  c.group.add(im); return im;
}
Amb.initCity = (c) => {
  init(); const P = c.plan, low = SKY.lowSpec; const r = SKY.rng(c.seed + 5);
  const a = c.amb = { cars: [], peds: [], trains: [], t: 0 };
  // cars on traffic roads (weighted by length)
  const roads = P.roads.filter((rd) => rd.traffic).map((rd) => { const pl = polyLen(rd.pts); return { pts: rd.pts, seg: pl.seg, L: pl.L, w: rd.w, kind: rd.kind }; }).filter((rd) => rd.L > 80);
  const totalL = roads.reduce((s, rd) => s + rd.L, 0);
  const nCars = roads.length ? Math.min(low ? 60 : 170, Math.floor(totalL / (low ? 160 : 70))) : 0;
  for (let i = 0; i < nCars; i++) { let x = r() * totalL, rd = roads[0]; for (const q of roads) { if (x < q.L) { rd = q; break; } x -= q.L; } const dir = r() < 0.5 ? 1 : -1; a.cars.push({ rd, s: r() * rd.L, dir, lane: (rd.w * 0.25) * (rd.kind === 'fwy' || rd.kind === 'strip' ? (r() < 0.5 ? 0.6 : 1.2) : 1), v: (rd.kind === 'fwy' ? 26 : rd.kind === 'strip' ? 9 : 14) * (0.8 + r() * 0.4) }); }
  if (nCars) a.carMesh = instMesh(c, geo.car, mats.lam, nCars, CAR_COLS);
  // pedestrians on sidewalks + terminal concourse
  const walks = P.walks.map((w) => { const pts = w.off ? offsetPts(w.pts, w.off * (r() < 0.5 ? 1 : -1)) : w.pts; const pl = polyLen(pts); return { pts, seg: pl.seg, L: pl.L }; }).filter((w) => w.L > 30);
  if (c.apt) { const ap = c.apt; for (const u of [10, 26]) { const pts = [[ap.XF + ap.side * u, ap.az - ap.L / 2 + 8], [ap.XF + ap.side * u, ap.az + ap.L / 2 - 8]]; const pl = polyLen(pts); for (let k = 0; k < 6; k++) walks.push({ pts, seg: pl.seg, L: pl.L, term: true }); } }
  const nPeds = walks.length ? (low ? 50 : 140) : 0;
  for (let i = 0; i < nPeds; i++) { const term = i < (low ? 10 : 24) && c.apt; const pool = term ? walks.filter((w) => w.term) : walks; const w = pool[Math.floor(r() * pool.length)]; a.peds.push({ w, s: r() * w.L, dir: r() < 0.5 ? 1 : -1, v: 1.1 + r() * 0.6, side: (r() - 0.5) * (term ? 6 : 1.4) }); }
  if (nPeds) a.pedMesh = instMesh(c, geo.ped, mats.lam, nPeds, PED_COLS);
  // apron service vehicles: baggage tug + 3 carts, fuel truck
  if (c.apt && c.apt.service) {
    const loops = c.apt.service.map((pts) => { const p2 = pts.concat([pts[0]]); const pl = polyLen(p2); return { pts: p2, seg: pl.seg, L: pl.L }; });
    const specs = [];
    loops.forEach((lp, li) => { const n = li === 0 ? 3 : 2; for (let k = 0; k < n; k++) specs.push({ lp, s: lp.L * k / n, kind: li === 1 && k === 0 ? 'fuel' : 'bag' }); });
    a.trains = specs; let nBox = 0; for (const t of specs) nBox += t.kind === 'fuel' ? 2 : 4;
    a.trainMesh = instMesh(c, geo.box, mats.lam, nBox); const cc = new THREE.Color(); a.trainMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nBox * 3), 3);
    let q = 0; for (const t of specs) { const cols = t.kind === 'fuel' ? [0xffffff, 0xd32f2f] : [0xffd23d, 0x9aa0a6, 0x9aa0a6, 0x9aa0a6]; for (const h of cols) { cc.setHex(h); a.trainMesh.instanceColor.setXYZ(q++, cc.r, cc.g, cc.b); } }
  }
  // Bellagio fountains
  for (const an of P.anims) if (an.type === 'fountain') { const jets = []; for (let i = 0; i < (low ? 18 : 36); i++) { const t = i / (low ? 18 : 36); jets.push([an.x + Math.cos(t * Math.PI * 1.2 + 2.2) * an.rx * 0.75, an.z + Math.sin(t * Math.PI * 1.2 + 2.2) * an.rz * 0.6 + an.rz * 0.15, t]); } a.fountain = { jets, mesh: instMesh(c, geo.box, mats.jet, jets.length) }; }
  // Luxor beam
  if (P.beams) for (const b of P.beams) { const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 2400, 8, 1, true), mats.beam); m.position.set(b[0], b[1] + 1200, b[2]); m.matrixAutoUpdate = false; m.updateMatrix(); c.group.add(m); a.beam = m; }
  // LAX pylons along Century Blvd
  if (c.apt && c.apt.pylons) { const ap = c.apt; const list = []; for (let k = 0; k < 15; k++) list.push([ap.XF + ap.side * (TD_() + 140 + k * 30) , ap.az - ap.L / 2 - 40 + (k % 2 ? 22 : -22)]); a.pylons = { list, mesh: instMesh(c, geo.box, mats.glow, list.length) }; a.pylons.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3); const m4 = new THREE.Matrix4(); list.forEach((p, i) => { m4.makeScale(3, 22 + (i % 3) * 4, 3); m4.setPosition(p[0], 11 + (i % 3) * 2, p[1]); a.pylons.mesh.setMatrixAt(i, m4); }); }
};
const TD_ = () => 40;
function offsetPts(pts, off) { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; out.push([pts[i][0] - dz / l * off, pts[i][1] + dx / l * off]); } return out; }
Amb.dropCity = (c) => { c.amb = null; };
const _m = new THREE.Matrix4(), _p = {}, _c = new THREE.Color();
Amb.update = (dt, cam) => {
  for (const c of W.cities) {
    const a = c.amb; if (!a || !c.group || !c.group.visible) continue;
    const dCity = Math.min(Math.hypot(cam.x - c.x, cam.z - c.z), c.apt ? Math.hypot(cam.x - c.apt.XF, cam.z - c.apt.az) : 1e9);
    if (dCity > 7000) { if (a.carMesh) a.carMesh.visible = false; if (a.pedMesh) a.pedMesh.visible = false; continue; }
    a.t += dt;
    if (a.carMesh) {
      a.carMesh.visible = cam.y < 2500;
      if (a.carMesh.visible) {
        let i = 0;
        for (const car of a.cars) {
          car.s += car.v * car.dir * dt; if (car.s > car.rd.L) car.s -= car.rd.L; if (car.s < 0) car.s += car.rd.L;
          along(car.rd, car.s, _p); const fx = _p.dx * car.dir, fz = _p.dz * car.dir; const x = _p.x - fz * car.lane, z = _p.z + fx * car.lane;
          const far = (x - cam.x) ** 2 + (z - cam.z) ** 2 > 2600 * 2600;
          if (far) { _m.makeScale(0, 0, 0); } else { const ang = Math.atan2(fx, fz); _m.makeRotationY(ang); _m.setPosition(x, W.heightAt(x, z), z); }
          a.carMesh.setMatrixAt(i++, _m);
        }
        a.carMesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (a.pedMesh) {
      a.pedMesh.visible = cam.y < 700;
      if (a.pedMesh.visible) {
        let i = 0;
        for (const p of a.peds) {
          p.s += p.v * p.dir * dt; if (p.s > p.w.L) { p.s = p.w.L; p.dir = -1; } if (p.s < 0) { p.s = 0; p.dir = 1; }
          along(p.w, p.s, _p); const fx = _p.dx * p.dir, fz = _p.dz * p.dir; const x = _p.x - fz * p.side, z = _p.z + fx * p.side;
          if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 700 * 700) _m.makeScale(0, 0, 0);
          else { _m.makeRotationY(Math.atan2(fx, fz)); const bob = Math.abs(Math.sin(a.t * 6 + p.s)) * 0.06; _m.setPosition(x, W.heightAt(x, z) + bob, z); }
          a.pedMesh.setMatrixAt(i++, _m);
        }
        a.pedMesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (a.trainMesh) {
      let q = 0;
      for (const t of a.trains) {
        t.s = (t.s + (t.kind === 'fuel' ? 6 : 5) * dt) % t.lp.L;
        const n = t.kind === 'fuel' ? 2 : 4;
        for (let k = 0; k < n; k++) {
          const s = (t.s - k * (t.kind === 'fuel' ? 4.2 : 3.4) + t.lp.L) % t.lp.L; along(t.lp, s, _p);
          const ang = Math.atan2(_p.dx, _p.dz); _m.makeRotationY(ang);
          if (t.kind === 'fuel') _m.scale(k === 0 ? new THREE.Vector3(2.4, 2.4, 3) : new THREE.Vector3(2.4, 2.6, 6)); else _m.scale(k === 0 ? new THREE.Vector3(1.6, 1.4, 2.6) : new THREE.Vector3(1.5, 1.2, 2.6));
          _m.setPosition(_p.x, k === 0 || t.kind !== 'fuel' ? 0.8 : 1.4, _p.z); a.trainMesh.setMatrixAt(q++, _m);
        }
      }
      a.trainMesh.instanceMatrix.needsUpdate = true;
    }
    if (a.fountain && dCity < 5000) {
      const f = a.fountain; const show = (a.t % 40) < 22; let i = 0;
      for (const j of f.jets) { const h = show ? Math.max(0.1, 18 + 22 * Math.sin(a.t * 2.2 - j[2] * 9) * Math.sin(a.t * 0.6 + j[2] * 3)) : 0.01; _m.makeScale(1.2, h, 1.2); _m.setPosition(j[0], h / 2, j[1]); f.mesh.setMatrixAt(i++, _m); }
      f.mesh.instanceMatrix.needsUpdate = true;
    }
    if (a.pylons) { const m = a.pylons.mesh; a.pylons.list.forEach((p, i) => { _c.setHSL(((a.t * 0.05 + i * 0.07) % 1), 0.85, 0.6); m.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); }); m.instanceColor.needsUpdate = true; }
  }
};
})();

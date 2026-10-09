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

class Plane {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.interior = new THREE.Group(); this.group.add(this.interior);
    this.fxLocal = new SKY.FXSet(this.interior);
    this.consts = { S, F, R, CY, COCK_Z, DOOR_L1, DOOR_L2, ROW_K0, czK, cxI };
    this.mass = 60000; this.I = new THREE.Vector3(3.2e6, 4.0e6, 2.2e6);
    this.pos = this.group.position; this.quat = this.group.quaternion;
    this.vel = new THREE.Vector3(); this.w = new THREE.Vector3(); this.prevVel = new THREE.Vector3();
    this.acc = new THREE.Vector3(); this.gLocal = new THREE.Vector3(0, -9.81, 0); this.kick = new THREE.Vector3();
    this.buildMeshes();
  }
  // ------------------------------------------------------------------ build
  buildGrid() {
    const g = new SKY.VoxGrid(NX, NY, NZ, S); g.origin.set(OX, OY, OZ);
    this.hull = new Uint8Array(g.n);
    const set = (i, j, k, m, p, hull) => { if (!g.inb(i, j, k)) return; g.set(i, j, k, m, p); this.hull[g.id(i, j, k)] = hull ? 1 : 0; };
    for (let k = 0; k < NZ; k++) {
      const z = czK(k), pr = profile(z); if (!pr) continue;
      const [r, cy] = pr; const pressurized = k <= REAR_BULK_K;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const x = cxI(i), y = cyJ(j), d = Math.hypot(x, y - cy);
        if (d > r) continue;
        const cap = r < 0.9 || k === REAR_BULK_K || k >= NZ - 2;
        const shell = d > r - 0.58;
        if (shell || cap) {
          let m = MAT.HULL;
          if (k <= 3 && y < cy) m = MAT.RADOME;
          if (shell && Math.abs(x) > 1.6 && j === F + 2) m = MAT.STRIPE;
          if (shell && Math.abs(x) > 1.7 && (j === F + 3 || j === F + 4) && k > 16 && k < 66 && k % 2 === 0 && !(k >= DOOR_L2.k0 - 1 && k <= DOOR_L2.k1 + 1)) m = MAT.WIN;
          if (shell && k >= 1 && k <= 6 && j >= F + 4 && j <= F + 6 && y < cy + r - 0.25) m = MAT.WSHIELD;
          if (k <= 1 && r < 0.9) m = MAT.RADOME;
          set(i, j, k, m, k < BULK_K ? PART.COCK : PART.FUS, pressurized && shell);
        }
        // floor
        if (j === F && !shell && k >= 2 && k < REAR_BULK_K) set(i, j, k, Math.abs(x) < 0.8 && k > BULK_K ? MAT.AISLE : MAT.FLOOR, k < BULK_K ? PART.COCK : PART.FUS);
      }
    }
    // livery: GROK on both sides
    const FONT = { G: '111100101101111', R: '110101110101101', O: '111101101101111', K: '101110100110101' };
    let col = 0;
    for (const ch of 'GROK') { const f = FONT[ch]; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r * 3 + c] === '1') { const j = F + 9 - r; for (const side of [1, -1]) { const k = side > 0 ? 40 - (col + c) : 25 + col + c; for (let i = 0; i < NX; i++) { const x = cxI(i); if (x * side > 1.0) { const id = g.id(i, j, k); if (g.mat[id] === MAT.HULL) g.mat[id] = MAT.TAIL; } } } } col += 4; }
    // door openings L1 / L2 (left side)
    for (const D of [DOOR_L1, DOOR_L2]) for (let k = D.k0; k <= D.k1; k++) for (let j = F + 1; j <= F + 5; j++) for (let i = 0; i < NX / 2; i++) if (g.get(i, j, k)) { g.set(i, j, k, 0); this.hull[g.id(i, j, k)] = 0; }
    // cockpit bulkhead with door gap
    for (let j = F + 1; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = cxI(i), y = cyJ(j), pr = profile(COCK_Z); if (Math.hypot(x, y - pr[1]) > pr[0] - 0.4) continue;
      if ((i === 38 || i === 39) && j <= F + 5) continue;
      set(i, j, BULK_K, MAT.BULK, PART.COCK);
    }
    // rear bulkhead already capped. cockpit interior: panel + seats
    for (let k = 4; k <= 5; k++) for (let j = F + 1; j <= F + 3; j++) for (let i = 33; i <= 44; i++) { const pr = profile(czK(k)); if (Math.hypot(cxI(i), cyJ(j) - pr[1]) < pr[0] - 0.5) set(i, j, k, MAT.PANEL, PART.COCK); }
    this.seats = [];
    for (const [i, x] of [[37, -0.6], [40, 0.6]]) { set(i, F + 1, 7, MAT.SEAT, PART.COCK); for (let j = F + 1; j <= F + 3; j++) set(i, j, 8, j === F + 3 ? MAT.HEAD : MAT.SEAT, PART.COCK); this.seats.push({ x, z: czK(7), y: 0.4, cockpit: true, captain: x < 0, occupant: null, row: -1, mask: -1 }); }
    // passenger seats
    for (let r = 0; r < ROWS; r++) {
      const k = ROW_K0 + r * 3;
      for (const x of SEAT_X) {
        const i = iX(x); set(i, F + 1, k, MAT.SEAT, PART.INT);
        for (let j = F + 1; j <= F + 3; j++) set(i, j, k + 1, j === F + 3 ? MAT.HEAD : MAT.SEAT, PART.INT);
        this.seats.push({ x, z: czK(k), y: 0.4, cockpit: false, occupant: null, row: r, mask: -1 });
      }
    }
    // overhead bins along cabin
    for (let k = ROW_K0 - 1; k <= ROW_K0 + ROWS * 3; k++) for (let j = F + 6; j <= F + 7; j++) for (let i = 0; i < NX; i++) { const x = cxI(i); if (Math.abs(x) < 1.0) continue; const pr = profile(czK(k)); if (Math.hypot(x, cyJ(j) - pr[1]) < pr[0] - 0.5 && !g.get(i, j, k)) set(i, j, k, MAT.BIN, PART.INT); }
    // front galley (right side)
    for (let k = 12; k <= 15; k++) for (let j = F + 1; j <= F + 2; j++) for (const i of [41, 42, 43]) set(i, j, k, MAT.STEEL, PART.INT);
    // aft galley (right side) + oven
    for (let k = 58; k <= 63; k++) for (let j = F + 1; j <= F + 2; j++) for (const i of [41, 42, 43]) set(i, j, k, MAT.STEEL, PART.INT);
    for (let k = 59; k <= 60; k++) for (let j = F + 3; j <= F + 4; j++) for (const i of [42, 43]) set(i, j, k, MAT.OVEN, PART.INT);
    for (let k = 58; k <= 63; k++) for (let j = F + 5; j <= F + 7; j++) for (const i of [42, 43]) if (j > F + 5) set(i, j, k, MAT.STEEL, PART.INT);
    // lavatory (left, aft)
    for (let j = F + 1; j <= F + 6; j++) {
      for (let i = 34; i <= 37; i++) { set(i, j, 60, MAT.LAV, PART.INT); set(i, j, 65, MAT.LAV, PART.INT); }
      for (let k = 60; k <= 65; k++) if (!(k >= 62 && k <= 63 && j <= F + 5)) set(37, j, k, MAT.LAV, PART.INT);
    }
    set(34, F + 1, 64, MAT.LAV, PART.INT); set(35, F + 1, 64, MAT.LAV, PART.INT); set(34, F + 2, 64, MAT.LAV, PART.INT);
    // wings
    for (let i = 0; i < NX; i++) {
      const x = cxI(i), ax = Math.abs(x); if (ax > 15.4) continue;
      const le = -3.2 + ax * 0.5, ch = 6.4 - ax * 0.3, jw = F - 3 + Math.floor(ax / 5);
      for (let k = 0; k < NZ; k++) {
        const z = czK(k); if (z < le || z > le + ch) continue;
        const pr = profile(z); const inside = pr && Math.hypot(x, cyJ(jw) - pr[1]) < pr[0] - 0.3;
        const part = (pr && Math.hypot(x, cyJ(jw) - pr[1]) < pr[0] + 0.3) ? PART.FUS : (x < 0 ? PART.WL : PART.WR);
        const m = z > le + ch * 0.72 && ax > 3 ? MAT.SURF : MAT.WING;
        if (!inside || jw < F) set(i, jw, k, m, part);
        if (ax < 7) set(i, jw + 1, k, m, part);
        if (ax >= 5 && (ax % 5) < 0.6 && !g.get(i, jw - 1, k)) set(i, jw - 1, k, m, part);
      }
    }
    // engines
    for (const ex of [-5.6, 5.6]) {
      const ey = -2.2, part = ex < 0 ? PART.EL : PART.ER;
      for (let k = kZ(-6.0); k <= kZ(-3.0); k++) for (let j = 0; j < F; j++) for (let i = iX(ex - 1.2); i <= iX(ex + 1.2); i++) {
        const d = Math.hypot(cxI(i) - ex, cyJ(j) - ey);
        if (d > 0.98) continue;
        if (k === kZ(-6.0)) set(i, j, k, d < 0.3 ? MAT.RADOME : MAT.FAN, part);
        else if (d > 0.5) set(i, j, k, k === kZ(-3.0) ? MAT.FAN : MAT.ENG, part);
      }
      for (let k = kZ(-3.4); k <= kZ(-0.2); k++) for (let j = jY(-1.5); j <= jY(-0.9); j++) { const i = iX(ex); if (!g.get(i, j, k)) set(i, j, k, MAT.ENG, part); }
    }
    // horizontal stabiliser
    for (let i = 0; i < NX; i++) { const x = cxI(i), ax = Math.abs(x); if (ax > 6.2) continue; const le = 12.2 + ax * 0.55, ch = 2.8 - ax * 0.2; for (let k = 0; k < NZ; k++) { const z = czK(k); if (z < le || z > le + ch) continue; const j = jY(1.7); if (!g.get(i, j, k)) set(i, j, k, z > le + ch * 0.7 ? MAT.SURF : MAT.HULL, ax > 1.2 ? PART.HS : PART.FUS); } }
    // vertical stabiliser
    for (let j = jY(2.4); j < NY; j++) { const y = cyJ(j); const le = 9.8 + (y - 2.4) * 0.95, ch = 4.6 - (y - 2.4) * 0.5; if (ch < 0.8) continue; for (let k = 0; k < NZ; k++) { const z = czK(k); if (z < le || z > le + ch || z > 16.3) continue; for (const i of [38, 39]) if (!g.get(i, j, k)) set(i, j, k, y > 6.4 ? MAT.HULL : MAT.TAIL, y > 3.2 ? PART.VS : PART.FUS); } }
    return g;
  }
  buildMeshes() {
    // landing gear (simple meshes)
    this.gearGroup = new THREE.Group(); this.group.add(this.gearGroup);
    const strutM = new THREE.MeshLambertMaterial({ color: 0x888c94 }), wheelM = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    this.gearPts = [new THREE.Vector3(0, -3.6, -11.0), new THREE.Vector3(-2.4, -3.6, 1.6), new THREE.Vector3(2.4, -3.6, 1.6)];
    for (const gp of this.gearPts) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), strutM); s.position.set(gp.x, gp.y + 1.4, gp.z); this.gearGroup.add(s);
      for (const dx of [-0.3, 0.3]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.8), wheelM); w.position.set(gp.x + dx, gp.y + 0.4, gp.z); this.gearGroup.add(w); }
    }
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
    const ext = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.4), new THREE.MeshLambertMaterial({ color: 0x555555 })); ext.position.set(-1.9, 1.1, czK(59)); this.interior.add(ext);
    const dr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x8090a0 })); dr.position.set(0.98, 0.55, czK(61) + 0.2); this.interior.add(dr);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0x223322 })); sign.position.set(0, 2.55, -9.6); this.interior.add(sign); this.beltSign = sign;
  }
  // ------------------------------------------------------------------ reset / placement
  reset(opts) {
    if (this.grid) { this.group.remove(this.grid.group); if (this.grid.geo) this.grid.geo.dispose(); }
    this.grid = this.buildGrid(); this.grid.build(this.group);
    this.computeSamples();
    for (const s of this.seats) s.occupant = null;
    this.crashed = false; this.crashT = 0; this.gearDown = true; this.gearBroken = false; this.flaps = 0; this.throttle = 0; this.brake = false;
    this.ap = { on: false, mode: 'off', alt: 2400, hdg: 0, dest: null, by: null, spd: 200 };
    this.pressure = 1; this.decomp = false; this.masksDown = false; this.maskT = 0; this.openings = []; this.leakArea = 0;
    this.fires = []; this.turb = { t: rand(40, 80), on: 0, str: 0 }; this.belt = false;
    this.cockpitDoor = { hp: 100, locked: true, open: 0, target: 0, broken: false, lockout: 0, cubes: 40, autoClose: 0 };
    this.cdMesh.count = 40; this.cdGroup.visible = true; this.cdGroup.rotation.y = 0;
    for (const d of this.cabinDoors) { d.open = 0; d.target = 0; d.arm = 0; d.mesh.visible = true; d.mesh.position.x = -2.18; d.mesh.rotation.y = 0; }
    this.code = String(SKY.randi(1000, 9999)); this.codeSpot = SKY.choose(['drawer', 'lav', 'attendant']); this.codeFound = false;
    this.oven = { state: 'idle', t: 0, ing: [], spoiled: false };
    this.connDirty = false; this.wingEff = [1, 1]; this.engEff = [1, 1]; this.hsEff = 1; this.vsEff = 1;
    this.fxLocal.clear(); this.maskCup.count = 0; this.maskTube.count = 0;
    this.stall = false; this.onGround = false; this.integrity = 1; this.alpha = 0; this.dP = 0; this.ambient = 1; this.impactLog = 0; this.maxImpact = 0; this.lastHit = 0;
    this.place(opts.city, opts.mode);
  }
  place(city, mode) {
    this.vel.set(0, 0, 0); this.w.set(0, 0, 0); this.quat.identity();
    if (mode === 'runway') {
      this.pos.set(city.ax, 3.6 + 0.02, city.az + city.rwyLen / 2 - 80); this.throttle = 0; this.gearDown = true; this.flaps = 1;
    } else if (mode === 'approach') {
      this.pos.set(city.ax, 330, city.az + city.rwyLen / 2 + 4200); this.vel.set(0, -4.0, -78); this.throttle = 0.42; this.gearDown = true; this.flaps = 2;
      this.quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.03);
    } else { // cruise departing city northward
      this.pos.set(city.x + 2000, 1900, city.z + 6000); this.vel.set(0, 0, -190); this.throttle = 0.6; this.gearDown = false; this.flaps = 0;
    }
    this.skipKick = 2;     this.prevVel.copy(this.vel); this.group.updateMatrixWorld(true);
    this.prevSamples = null;
  }
  computeSamples() {
    const g = this.grid, pts = [];
    const add = (id) => { if (id >= 0 && !pts.includes(id)) pts.push(id); };
    for (let i = 0; i < NX; i += 4) for (let k = 0; k < NZ; k += 4) {
      let lo = -1, hi = -1;
      for (let j = 0; j < NY; j++) if (g.get(i, j, k)) { if (lo < 0) lo = g.id(i, j, k); hi = g.id(i, j, k); }
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
  altitude() { return this.pos.y - 3.6 - SKY.World.heightAt(this.pos.x, this.pos.z); }
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
    // cockpit door
    const cd = this.cockpitDoor;
    if (!cd.broken && cd.open < 0.5 && z > COCK_Z - 0.2 && z < COCK_Z + 0.2 && x > -0.45 && x < 0.45 && y > 0 && y < 2.05) return true;
    for (const d of this.cabinDoors) if (d.open < 0.5 && x < -1.72 && x > -2.6 && z > d.D.z0 && z < d.D.z1 && y > -0.05 && y < 2.05) return true;
    return false;
  }
  isOutside(p) { const pr = profile(p.z); if (!pr) return true; if (p.y < -3.4) return true; return Math.hypot(p.x, p.y - pr[1]) > pr[0] + 0.35; }
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
    const comps = g.floating((id) => { const i = id % NX, j = ((id / NX) | 0) % NY, k = (id / (NX * NY)) | 0; return j <= F + 1 && i >= 33 && i <= 44 && k >= 34 && k <= 50; });
    const out = [];
    for (const comp of comps) {
      if (comp.length < 8) { for (const id of comp) { g.center(id, _v); const wp = this.toWorld(_v); if (fxWorld) fxWorld.chip.spawn(wp.x, wp.y, wp.z, this.vel.x + rand(-3, 3), this.vel.y + rand(0, 3), this.vel.z + rand(-3, 3), 3, S, SKY.PAL[g.mat[id]][0]); g.remove(id); } continue; }
      const parts = {}; for (const id of comp) parts[g.part[id]] = (parts[g.part[id]] || 0) + 1;
      const ex = g.extract(comp);
      const m = new THREE.Matrix4().multiplyMatrices(this.group.matrixWorld, new THREE.Matrix4().makeTranslation(ex.offset.x, ex.offset.y, ex.offset.z));
      const center = ex.offset.clone().add(new THREE.Vector3(ex.grid.nx, ex.grid.ny, ex.grid.nz).multiplyScalar(S / 2));
      const v = this.pointVel(center).add(new THREE.Vector3(rand(-3, 3), rand(-1, 4), rand(-3, 3)));
      const d = SKY.World.addDebris(ex.grid, m, v, new THREE.Vector3(rand(-1.5, 1.5), rand(-1, 1), rand(-1.5, 1.5)));
      d.fromPlane = true;
      const names = { 1: 'LEFT WING', 2: 'RIGHT WING', 3: 'LEFT ENGINE', 4: 'RIGHT ENGINE', 5: 'TAIL', 6: 'FIN', 0: 'FUSELAGE SECTION', 7: 'COCKPIT', 8: 'CABIN PIECE' };
      let best = 0, bp = 0; for (const p in parts) if (parts[p] > best) { best = parts[p]; bp = +p; }
      if (comp.length > 30) { SKY.toast('⚠ ' + names[bp] + ' DETACHED!', 'bad'); SKY.Audio.play('crunch', 1.4); }
      // bounding box in local space for entity transfer
      out.push({ min: ex.offset.clone(), max: ex.offset.clone().add(new THREE.Vector3(ex.grid.nx, ex.grid.ny, ex.grid.nz).multiplyScalar(S)), size: comp.length, part: bp });
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
    this.hsEff = r(PART.HS); this.vsEff = r(PART.VS);
    this.integrity = g.count / g.count0;
  }
  // ------------------------------------------------------------------ flight physics
  update(dt, ctl, fxWorld) {
    const W = SKY.World;
    this.partEff();
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
    const q = 150 * rhoF * spd * spd;
    const F = _v.set(0, -SKY.GRAV * this.mass, 0);
    if (spd > 1) {
      const vdir = _v2.copy(this.vel).divideScalar(spd);
      const liftDir = _v3.copy(u).addScaledVector(vdir, -u.dot(vdir)); if (liftDir.lengthSq() > 1e-6) liftDir.normalize();
      F.addScaledVector(liftDir, q * 0.55 * cl * wEff);
      const cd = 0.03 + 0.03 * cl * cl + (this.gearDown ? 0.018 : 0) + this.flaps * 0.025 + Math.abs(beta) * 0.25 + (1 - this.integrity) * 0.15 + (aa > 0.5 ? 0.6 : 0);
      F.addScaledVector(vdir, -q * cd);
      F.addScaledVector(r, -this.vel.dot(r) * 150 * rhoF * spd * 0.25);
    }
    const engE = (this.engEff[0] + this.engEff[1]) / 2;
    const thrust = this.throttle * 250000 * engE * (0.55 + 0.45 * rhoF) * (this.crashed ? 0 : 1);
    F.addScaledVector(f, thrust);
    // turbulence
    const T = this.turb; T.t -= dt;
    if (T.t <= 0 && !this.onGround && this.pos.y > 800) { if (T.on > 0) { T.on = 0; T.t = rand(60, 120); } else { T.on = rand(6, 10); T.str = rand(0.5, 1.2); T.t = T.on; if (SKY.Game) SKY.Game.onTurbulence(T.str); } }
    if (T.on > 0 && !this.onGround && this.pos.y > 300) { F.y += Math.sin(performance.now() * 0.013) * rand(0, 1) * this.mass * 4.5 * T.str; this.w.z += rand(-0.25, 0.25) * dt * T.str; this.w.x += rand(-0.15, 0.15) * dt * T.str; }
    else if (T.on > 0 && this.onGround) { T.on = 0; T.t = rand(60, 120); }
    this.vel.addScaledVector(F, dt / this.mass);
    // ---- rotation control (local rates) ----
    const ctrl = clamp(spd / 70, 0, 1.3) * Math.sqrt(rhoF);
    const pitchRate = ctl.pitch * 0.6 * this.hsEff, rollRate = -ctl.roll * 1.4 * Math.min(this.wingEff[0], this.wingEff[1]) ** 0.5, yawRate = -ctl.yaw * 0.3 * this.vsEff;
    const k = Math.min(1, 2.5 * dt * ctrl);
    const w = this.w;
    if (!this.crashed) {
      w.x += (pitchRate - w.x) * k; w.z += (rollRate - w.z) * k; w.y += (yawRate - w.y) * k * 0.6;
    }
    // aero stability: nose follows velocity
    if (spd > 10) {
      w.x += -alpha * 0.9 * ctrl * dt * (this.onGround ? 0 : 1) * (0.4 + 0.6 * this.hsEff);
      w.y -= beta * 1.2 * ctrl * dt * (0.3 + 0.7 * this.vsEff);
      // asymmetric lift
      const asym = (this.wingEff[1] - this.wingEff[0]) * q * 0.55 * Math.abs(cl) / (this.mass * 9.81) * 2.5;
      w.z += asym * dt;
      // engine asymmetry yaw
      w.y += (this.engEff[1] - this.engEff[0]) * this.throttle * 0.25 * dt;
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
          const brake = (this.brake || this.throttle < 0.04) ? 0.35 : 0.012;
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
    for (const ex of [-5.6, 5.6]) if (this.fires.length < 8) this.fires.push({ x: ex, y: -1.6, z: -4, hp: 6, ext: true, t: 0 });
    // wing stress: big impacts shear off wings / tail
    if (spd > 55) {
      for (const pt of [[-9, -1.2, 1], [9, -1.2, 1], [0, 2.2, 13]]) if (Math.random() < 0.75) this.damage(new THREE.Vector3(pt[0], pt[1], pt[2]), 1.4, 30, fxWorld, false);
      if (spd > 80) this.damage(new THREE.Vector3(0, 1, rand(-4, 6)), 2.2, 30, fxWorld, false);
    }
    if (SKY.Game) SKY.Game.onCrash(kind, spd);
  }
  buildingHits(dt, fxWorld) {
    const W = SKY.World; const spd = this.vel.length();
    if (this.pos.y > 700) { this.prevSamples = null; return; }
    const nc = W.nearestCity(this.pos.x, this.pos.z); if (nc.dist > 4200) { this.prevSamples = null; return; }
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
    if (this.leakArea > 0.01) this.pressure += (amb - this.pressure) * Math.min(1, this.leakArea * 0.35 * dt);
    else this.pressure += (1 - this.pressure) * Math.min(1, 0.08 * dt);
    if (amb >= 0.99 && this.pressure < 1) this.pressure = Math.min(1, this.pressure + 0.04 * dt);
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
    let tSpd = this.pos.y < 900 ? 150 : 200;
    if (this.onGround || ap.mode === 'takeoff') {
      ap.mode = 'takeoff'; out.yaw = clamp(-((this.pos.x - (ap.rwyX ?? this.pos.x)) * 0.04) - wrap(ap.hdg - hdg) * -2, -1, 1);
      this.throttle = 1; this.brake = false; this.flaps = 1;
      if (spd > 70) out.pitch = clamp((0.16 - pitch) * 3, -1, 1);
      if (this.altitude() > 25) { this.gearDown = false; }
      if (this.altitude() > 250) { ap.mode = 'climb'; this.flaps = 0; }
      return out;
    }
    const err = wrap(tHdg - hdg);
    const tBank = clamp(-err * 1.4, -0.45, 0.45) * -1;
    out.roll = clamp((tBank - bank) * 2.2 - this.w.z * -0.3, -1, 1);
    const tVS = clamp((tAlt - this.pos.y) * 0.06, -22, 14);
    const tPitch = clamp(0.03 + (tVS - this.vel.y) * 0.015 + tVS * 0.012, -0.22, 0.25);
    out.pitch = clamp((tPitch - pitch) * 4 / Math.max(0.5, Math.cos(bank)), -1, 1);
    this.throttle = clamp(this.throttle + ((tSpd - spd) * 0.02 - (this.throttle - 0.55) * 0.05) * dt * 3, 0.05, 1);
    if (this.gearDown && this.altitude() > 60) this.gearDown = false;
    return out;
  }
}
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
SKY.wrapAngle = wrap;
SKY.Plane = Plane;
SKY.PlaneConst = { S, F, R, CY, COCK_Z, DOOR_L1, DOOR_L2, czK, cxI, profile, ROW_K0 };
})();

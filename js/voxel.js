'use strict';
// GROK SKY - voxel grids (instanced, destructible), rigid debris, particle FX
(() => {
const { clamp } = SKY;
const _m4 = new THREE.Matrix4();
const _c = new THREE.Color();
const MATS = {};
function sharedMat(type) {
  if (!MATS[type]) {
    if (type === 0) MATS[0] = new THREE.MeshLambertMaterial({ color: 0xffffff });
    else if (type === 1) MATS[1] = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false });
    else MATS[2] = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }
  return MATS[type];
}
const typeOf = (m) => { const f = SKY.PAL[m][2]; return f & 1 ? 1 : f & 2 ? 2 : 0; };
let stampGlobal = 1;

class VoxGrid {
  constructor(nx, ny, nz, size) {
    this.nx = nx; this.ny = ny; this.nz = nz; this.s = size;
    this.n = nx * ny * nz;
    this.mat = new Uint8Array(this.n); this.part = new Uint8Array(this.n);
    this.hp = new Float32Array(this.n); this.inst = new Int32Array(this.n).fill(-1);
    this.visit = null; this.groundFloor = false;
    this.origin = new THREE.Vector3(); // local position of cell (0,0,0) min corner
    this.group = new THREE.Group();
    this.meshes = [null, null, null]; this.cellOf = [null, null, null];
    this.count = 0; this.partCount = new Int32Array(32); this.partCount0 = new Int32Array(32);
    this.dirty = false; this.version = 0;
  }
  id(i, j, k) { return i + this.nx * (j + this.ny * k); }
  inb(i, j, k) { return i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz; }
  set(i, j, k, m, p) { if (!this.inb(i, j, k)) return; const id = this.id(i, j, k); this.mat[id] = m; this.hp[id] = m ? SKY.PAL[m][1] : 0; this.part[id] = p || 0; }
  get(i, j, k) { return this.inb(i, j, k) ? this.mat[this.id(i, j, k)] : 0; }
  ijk(id) { const i = id % this.nx; const t = (id - i) / this.nx; const j = t % this.ny; return [i, j, (t - j) / this.ny]; }
  cellAt(x, y, z) {
    const i = Math.floor((x - this.origin.x) / this.s), j = Math.floor((y - this.origin.y) / this.s), k = Math.floor((z - this.origin.z) / this.s);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return -1;
    return i + this.nx * (j + this.ny * k);
  }
  solid(x, y, z) { const c = this.cellAt(x, y, z); return c >= 0 && this.mat[c] !== 0; }
  center(id, out) { const [i, j, k] = this.ijk(id); return out.set(this.origin.x + (i + 0.5) * this.s, this.origin.y + (j + 0.5) * this.s, this.origin.z + (k + 0.5) * this.s); }
  // fill helper: box in cell coords inclusive
  box(i0, j0, k0, i1, j1, k1, m, p) { for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.set(i, j, k, m, p); }
  // a voxel is drawn only if at least one face can be seen (neighbour empty, glass, or grid edge)
  exposed(id) {
    const nx = this.nx, ny = this.ny, nz = this.nz, nxy = nx * ny;
    const i = id % nx, t = (id - i) / nx, j = t % ny, k = (t - j) / ny;
    if (i === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) return true;
    if (j === 0 && !this.groundFloor) return true;
    const M = this.mat, P = SKY.PAL;
    const occ = (n) => { const m = M[n]; return m !== 0 && !(P[m][2] & 1); };
    return !(occ(id - 1) && occ(id + 1) && (j === 0 || occ(id - nx)) && occ(id + nx) && occ(id - nxy) && occ(id + nxy));
  }
  addInst(id) {
    const m = this.mat[id], t = typeOf(m), mesh = this.meshes[t]; if (!mesh || this.inst[id] >= 0) return;
    const ii = mesh.count++;
    const s = this.s, i = id % this.nx, tt = (id - i) / this.nx, j = tt % this.ny, k = (tt - j) / this.ny;
    _m4.makeTranslation(this.origin.x + (i + 0.5) * s, this.origin.y + (j + 0.5) * s, this.origin.z + (k + 0.5) * s); mesh.setMatrixAt(ii, _m4);
    _c.setHex(SKY.PAL[m][0]); const v = t === 2 ? 1 : 0.9 + ((id * 2654435761) >>> 0) % 1000 / 1000 * 0.16; _c.multiplyScalar(v);
    mesh.instanceColor.setXYZ(ii, _c.r, _c.g, _c.b);
    this.cellOf[t][ii] = id; this.inst[id] = ii;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  build(parent) {
    const cnt = [0, 0, 0];
    for (let id = 0; id < this.n; id++) if (this.mat[id]) cnt[typeOf(this.mat[id])]++;
    const s = this.s;
    if (this.geo) this.geo.dispose();
    this.geo = new THREE.BoxGeometry(s, s, s);
    const ex = new THREE.Vector3(this.nx * s, this.ny * s, this.nz * s);
    this.geo.boundingSphere = new THREE.Sphere(this.origin.clone().addScaledVector(ex, 0.5), ex.length() * 0.5 + s);
    this.geo.boundingBox = new THREE.Box3(this.origin.clone(), this.origin.clone().add(ex));
    for (let t = 0; t < 3; t++) {
      if (this.meshes[t]) { this.group.remove(this.meshes[t]); this.meshes[t].dispose(); this.meshes[t] = null; }
      if (!cnt[t]) continue;
      const mesh = new THREE.InstancedMesh(this.geo, sharedMat(t), cnt[t]);
      mesh.count = 0; mesh.matrixAutoUpdate = false;
      if (t === 1) mesh.renderOrder = 2;
      this.meshes[t] = mesh; this.cellOf[t] = new Int32Array(cnt[t]);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cnt[t] * 3), 3);
      this.group.add(mesh);
    }
    this.count = 0; this.partCount.fill(0); this.inst.fill(-1);
    for (let id = 0; id < this.n; id++) {
      const m = this.mat[id]; if (!m) continue;
      this.count++; this.partCount[this.part[id]]++;
      if (this.exposed(id)) this.addInst(id);
    }
    this.partCount0.set(this.partCount); this.count0 = this.count;
    for (const m of this.meshes) if (m) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    if (parent) parent.add(this.group);
    return this;
  }
  drawn() { let n = 0; for (const m of this.meshes) if (m) n += m.count; return n; }
  dispose() { for (const m of this.meshes) if (m) { if (m.parent) m.parent.remove(m); m.dispose(); } this.meshes = [null, null, null]; if (this.geo) this.geo.dispose(); this.geo = null; }
  remove(id) {
    const m = this.mat[id]; if (!m) return;
    const ii = this.inst[id];
    if (ii >= 0) {
      const t = typeOf(m), mesh = this.meshes[t], last = mesh.count - 1;
      if (ii !== last) {
        const a = mesh.instanceMatrix.array, c = mesh.instanceColor.array;
        for (let q = 0; q < 16; q++) a[ii * 16 + q] = a[last * 16 + q];
        for (let q = 0; q < 3; q++) c[ii * 3 + q] = c[last * 3 + q];
        const moved = this.cellOf[t][last]; this.cellOf[t][ii] = moved; this.inst[moved] = ii;
      }
      mesh.count--; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
    this.inst[id] = -1; this.mat[id] = 0; this.hp[id] = 0;
    this.partCount[this.part[id]]--; this.count--;
    this.version++;
    // neighbours that were hidden inside become visible
    if (!this.meshes[0] && !this.meshes[1] && !this.meshes[2]) return;
    const nx = this.nx, nxy = nx * this.ny, i = id % nx, tt = (id - i) / nx, j = tt % this.ny, k = (tt - j) / this.ny;
    const M = this.mat, I = this.inst;
    if (i > 0 && M[id - 1] && I[id - 1] < 0) this.addInst(id - 1);
    if (i < nx - 1 && M[id + 1] && I[id + 1] < 0) this.addInst(id + 1);
    if (j > 0 && M[id - nx] && I[id - nx] < 0) this.addInst(id - nx);
    if (j < this.ny - 1 && M[id + nx] && I[id + nx] < 0) this.addInst(id + nx);
    if (k > 0 && M[id - nxy] && I[id - nxy] < 0) this.addInst(id - nxy);
    if (k < this.nz - 1 && M[id + nxy] && I[id + nxy] < 0) this.addInst(id + nxy);
  }
  forEachSolid(fn) { const M = this.mat; for (let id = this.n - 1; id >= 0; id--) if (M[id]) fn(id); }
  // damage voxels in sphere (local coords). returns array of {x,y,z,col,part,id}
  damageSphere(c, r, power, maxHp) {
    const s = this.s, o = this.origin, out = [];
    const i0 = Math.max(0, Math.floor((c.x - r - o.x) / s)), i1 = Math.min(this.nx - 1, Math.floor((c.x + r - o.x) / s));
    const j0 = Math.max(0, Math.floor((c.y - r - o.y) / s)), j1 = Math.min(this.ny - 1, Math.floor((c.y + r - o.y) / s));
    const k0 = Math.max(0, Math.floor((c.z - r - o.z) / s)), k1 = Math.min(this.nz - 1, Math.floor((c.z + r - o.z) / s));
    const r2 = r * r;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = i + this.nx * (j + this.ny * k); const m = this.mat[id]; if (!m) continue;
      const x = o.x + (i + 0.5) * s, y = o.y + (j + 0.5) * s, z = o.z + (k + 0.5) * s;
      const d2 = (x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2; if (d2 > r2) continue;
      if (maxHp && SKY.PAL[m][1] > maxHp) { this.hp[id] -= power * 0.15; } else this.hp[id] -= power * (1 - 0.5 * Math.sqrt(d2) / r);
      if (this.hp[id] <= 0) out.push({ x, y, z, col: SKY.PAL[m][0], part: this.part[id], mat: m, id });
    }
    for (const e of out) this.remove(e.id);
    return out;
  }
  // DDA raycast in local space; returns {id, dist, nx,ny,nz} or null
  raycast(o, d, maxDist) {
    const s = this.s;
    let x = (o.x - this.origin.x) / s, y = (o.y - this.origin.y) / s, z = (o.z - this.origin.z) / s;
    // clip ray start to grid box
    let tStart = 0;
    const tmin = [0, 0, 0], dims = [this.nx, this.ny, this.nz], pos = [x, y, z], dir = [d.x, d.y, d.z];
    let t0 = 0, t1 = maxDist / s;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-9) { if (pos[a] < 0 || pos[a] > dims[a]) return null; continue; }
      let ta = (0 - pos[a]) / dir[a], tb = (dims[a] - pos[a]) / dir[a]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
    }
    tStart = t0 + 1e-6; x += d.x * tStart; y += d.y * tStart; z += d.z * tStart;
    let i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const si = d.x > 0 ? 1 : -1, sj = d.y > 0 ? 1 : -1, sk = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tmx = d.x > 0 ? (i + 1 - x) * tdx : (x - i) * tdx; if (!isFinite(tmx)) tmx = 1e9;
    let tmy = d.y > 0 ? (j + 1 - y) * tdy : (y - j) * tdy; if (!isFinite(tmy)) tmy = 1e9;
    let tmz = d.z > 0 ? (k + 1 - z) * tdz : (z - k) * tdz; if (!isFinite(tmz)) tmz = 1e9;
    let t = tStart, nX = 0, nY = 0, nZ = 0;
    const tEnd = t1 + 1e-6;
    for (let it = 0; it < 2000; it++) {
      if (i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz) {
        const id = i + this.nx * (j + this.ny * k);
        if (this.mat[id]) return { id, dist: t * s, nx: nX, ny: nY, nz: nZ };
      } else if (it > 0) return null;
      if (tmx < tmy && tmx < tmz) { t = tStart + tmx; if (t > tEnd) return null; tmx += tdx; i += si; nX = -si; nY = 0; nZ = 0; }
      else if (tmy < tmz) { t = tStart + tmy; if (t > tEnd) return null; tmy += tdy; j += sj; nX = 0; nY = -sj; nZ = 0; }
      else { t = tStart + tmz; if (t > tEnd) return null; tmz += tdz; k += sk; nX = 0; nY = 0; nZ = -sk; }
    }
    return null;
  }
  // flood fill from anchors; returns array of components (arrays of ids) not connected
  floating(isAnchor) {
    if (!this.visit) this.visit = new Uint32Array(this.n);
    const stamp = ++stampGlobal; const vis = this.visit; const q = []; const nx = this.nx, ny = this.ny, nz = this.nz, nxy = nx * ny;
    this.forEachSolid((id) => { if (isAnchor(id)) { vis[id] = stamp; q.push(id); } });
    const spread = (queue, st, collect) => {
      let h = 0;
      while (h < queue.length) {
        const id = queue[h++]; if (collect) collect.push(id);
        const i = id % nx, j = ((id / nx) | 0) % ny, k = (id / nxy) | 0;
        if (i > 0) { const n = id - 1; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
        if (i < nx - 1) { const n = id + 1; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
        if (j > 0) { const n = id - nx; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
        if (j < ny - 1) { const n = id + nx; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
        if (k > 0) { const n = id - nxy; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
        if (k < nz - 1) { const n = id + nxy; if (this.mat[n] && vis[n] !== st) { vis[n] = st; queue.push(n); } }
      }
    };
    spread(q, stamp, null);
    if (q.length === this.count) return [];
    const comps = [];
    this.forEachSolid((id) => {
      if (vis[id] === stamp) return;
      vis[id] = stamp; const cq = [id]; const comp = []; spread(cq, stamp, comp); comps.push(comp);
    });
    return comps;
  }
  // move given cells into a new grid; returns {grid, offset (local min corner of new grid in this grid's space)}
  extract(ids) {
    let i0 = 1e9, j0 = 1e9, k0 = 1e9, i1 = -1, j1 = -1, k1 = -1;
    const cells = ids.map((id) => { const c = this.ijk(id); i0 = Math.min(i0, c[0]); j0 = Math.min(j0, c[1]); k0 = Math.min(k0, c[2]); i1 = Math.max(i1, c[0]); j1 = Math.max(j1, c[1]); k1 = Math.max(k1, c[2]); return c; });
    const g = new VoxGrid(i1 - i0 + 1, j1 - j0 + 1, k1 - k0 + 1, this.s);
    ids.forEach((id, q) => { const c = cells[q]; g.set(c[0] - i0, c[1] - j0, c[2] - k0, this.mat[id], this.part[id]); });
    const offset = new THREE.Vector3(this.origin.x + i0 * this.s, this.origin.y + j0 * this.s, this.origin.z + k0 * this.s);
    for (const id of ids) this.remove(id);
    return { grid: g, offset };
  }
}
SKY.VoxGrid = VoxGrid;

// ---------------- Particle pools ----------------
class Pool {
  constructor(parent, max, kind) {
    this.max = max; this.kind = kind;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    let mat;
    if (kind === 'chip') mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    else if (kind === 'fire') mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    else mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    parent.add(this.mesh);
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max);
    this.size = new Float32Array(max); this.rot = new Float32Array(max); this.col = new Float32Array(max * 3); this.n = 0;
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.sv = new THREE.Vector3(); this.pv = new THREE.Vector3();
  }
  spawn(x, y, z, vx, vy, vz, life, size, color) {
    let i = this.n; if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.ml[i] = life; this.size[i] = size; this.rot[i] = Math.random() * 6;
    _c.setHex(color); this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
  }
  clear() { this.n = 0; this.mesh.count = 0; }
  update(dt, gx, gy, gz, floorFn) {
    const k = this.kind;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap remove
        const l = --this.n; if (i !== l) { for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[l * 3 + a]; this.v[i * 3 + a] = this.v[l * 3 + a]; this.col[i * 3 + a] = this.col[l * 3 + a]; } this.life[i] = this.life[l]; this.ml[i] = this.ml[l]; this.size[i] = this.size[l]; this.rot[i] = this.rot[l]; } i--; continue;
      }
      const o = i * 3;
      if (k === 'chip' || k === 'foam') { this.v[o] += gx * dt; this.v[o + 1] += gy * dt; this.v[o + 2] += gz * dt; }
      else { this.v[o + 1] += (k === 'fire' ? 3 : 1.2) * dt; const dmp = 1 - 1.5 * dt; this.v[o] *= dmp; this.v[o + 2] *= dmp; }
      this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
      if (floorFn && (k === 'chip' || k === 'foam')) {
        const f = floorFn(this.p[o], this.p[o + 1], this.p[o + 2]);
        if (f !== null && this.p[o + 1] < f) { this.p[o + 1] = f; this.v[o + 1] *= -0.3; this.v[o] *= 0.6; this.v[o + 2] *= 0.6; }
      }
      this.rot[i] += dt * 4;
    }
    const mesh = this.mesh; mesh.count = this.n;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3, t = this.life[i] / this.ml[i];
      let sc = this.size[i];
      if (k === 'smoke') sc *= (1 + (1 - t) * 3) * Math.min(1, t * 4);
      else if (k === 'fire') sc *= t;
      else if (t < 0.2) sc *= t / 0.2;
      this.e.set(this.rot[i], this.rot[i] * 0.7, 0); this.q.setFromEuler(this.e);
      this.sv.set(sc, sc, sc); this.pv.set(this.p[o], this.p[o + 1], this.p[o + 2]);
      _m4.compose(this.pv, this.q, this.sv); mesh.setMatrixAt(i, _m4);
      mesh.instanceColor.setXYZ(i, this.col[o], this.col[o + 1], this.col[o + 2]);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
}
SKY.FXSet = class {
  constructor(parent, scale) {
    const m = SKY.lowSpec ? 0.5 : 1;
    this.chip = new Pool(parent, (500 * m) | 0, 'chip');
    this.smoke = new Pool(parent, (260 * m) | 0, 'smoke');
    this.fire = new Pool(parent, (200 * m) | 0, 'fire');
    this.foam = new Pool(parent, (200 * m) | 0, 'foam');
  }
  clear() { this.chip.clear(); this.smoke.clear(); this.fire.clear(); this.foam.clear(); }
  update(dt, g, floorFn) { this.chip.update(dt, g.x, g.y, g.z, floorFn); this.foam.update(dt, g.x, g.y, g.z, floorFn); this.smoke.update(dt, 0, 0, 0); this.fire.update(dt, 0, 0, 0); }
  burst(x, y, z, n, col, spd, size, vx, vy, vz) {
    for (let i = 0; i < n; i++) this.chip.spawn(x, y, z, (vx || 0) + SKY.rand(-spd, spd), (vy || 0) + SKY.rand(-spd * 0.3, spd), (vz || 0) + SKY.rand(-spd, spd), SKY.rand(1.5, 3.5), size * SKY.rand(0.5, 1), col);
  }
};

// ---------------- Rigid debris chunks ----------------
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
class Debris {
  // grid: VoxGrid (origin 0); worldMatrix: Matrix4 placing grid local into world
  constructor(scene, grid, worldMatrix, vel, angVel) {
    this.grid = grid; grid.build();
    const com = new THREE.Vector3(); let n = 0; const p = new THREE.Vector3();
    grid.forEachSolid((id) => { grid.center(id, p); com.add(p); n++; }); com.divideScalar(Math.max(1, n));
    this.mass = n * grid.s * grid.s * grid.s * 400 + 1; this.n = n;
    const ext = new THREE.Vector3(grid.nx, grid.ny, grid.nz).multiplyScalar(grid.s);
    const L2 = ext.lengthSq();
    this.invI = 1 / (this.mass * L2 / 10 + 1);
    this.group = new THREE.Group(); grid.group.position.copy(com).negate(); this.group.add(grid.group);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
    worldMatrix.decompose(pos, quat, sc);
    this.group.position.copy(com).applyQuaternion(quat).add(pos); this.group.quaternion.copy(quat);
    scene.add(this.group); this.scene = scene;
    this.vel = vel.clone(); this.w = angVel ? angVel.clone() : new THREE.Vector3(SKY.rand(-1, 1), SKY.rand(-1, 1), SKY.rand(-1, 1));
    // sample points: bbox corners shrunk + some voxels
    this.pts = [];
    const ids = []; grid.forEachSolid((id) => ids.push(id));
    for (let q = 0; q < Math.min(14, ids.length); q++) { const id = ids[(q * 7919) % ids.length]; this.pts.push(grid.center(id, new THREE.Vector3()).sub(com)); }
    let mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const id of ids) { grid.center(id, p); mn.min(p); mx.max(p); }
    for (let a = 0; a < 8; a++) {
      const c = new THREE.Vector3(a & 1 ? mx.x : mn.x, a & 2 ? mx.y : mn.y, a & 4 ? mx.z : mn.z);
      if (grid.solid(c.x, c.y, c.z)) this.pts.push(c.sub(com));
    }
    this.radius = ext.length() / 2;
    this.age = 0; this.sleep = 0; this.hitCb = null; this.lastImpact = 0;
  }
  step(dt, world) {
    this.age += dt;
    if (this.sleep > 1.5) return;
    const g = this.group;
    this.vel.y -= SKY.GRAV * dt;
    const sp = this.vel.length(); if (sp > 1) this.vel.multiplyScalar(1 - Math.min(0.5, 0.0009 * sp) * dt);
    g.position.addScaledVector(this.vel, dt);
    const wl = this.w.length();
    if (wl > 1e-5) { _q.setFromAxisAngle(_v.copy(this.w).divideScalar(wl), wl * dt); g.quaternion.premultiply(_q); g.quaternion.normalize(); }
    this.w.multiplyScalar(1 - 0.1 * dt);
    let maxPen = 0, impact = 0;
    for (const lp of this.pts) {
      _r.copy(lp).applyQuaternion(g.quaternion); const wx = g.position.x + _r.x, wy = g.position.y + _r.y, wz = g.position.z + _r.z;
      const h = world.heightAt(wx, wz);
      if (wy >= h) continue;
      maxPen = Math.max(maxPen, h - wy);
      _w.copy(this.w).cross(_r).add(this.vel); // point velocity
      const vn = _w.y; if (vn >= 0) continue;
      impact = Math.max(impact, -vn);
      _n.set(0, 1, 0);
      _t.copy(_r).cross(_n); const denom = 1 / this.mass + _t.lengthSq() * this.invI;
      const j = -(1 + 0.25) * vn / denom;
      this.applyImpulse(_n.multiplyScalar(j), _r);
      // friction
      _w.copy(this.w).cross(_r).add(this.vel); _w.y = 0; const vt = _w.length();
      if (vt > 1e-4) { const jt = Math.min(vt / denom, 0.6 * j); _w.multiplyScalar(-jt / vt); this.applyImpulse(_w, _r); }
    }
    if (maxPen > 0) g.position.y += maxPen * 0.8;
    if (impact > 4 && this.hitCb) this.hitCb(this, impact);
    if (maxPen > 0 && this.vel.lengthSq() < 0.3 && this.w.lengthSq() < 0.05) this.sleep += dt; else this.sleep = 0;
  }
  applyImpulse(J, r) {
    this.vel.addScaledVector(J, 1 / this.mass);
    _t.copy(r).cross(J).multiplyScalar(this.invI); this.w.add(_t);
    if (this.w.lengthSq() > 64) this.w.setLength(8);
  }
  dispose() { this.scene.remove(this.group); this.grid.dispose(); }
}
SKY.Debris = Debris;
})();

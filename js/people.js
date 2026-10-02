'use strict';
// GROK SKY - passengers, crew and pilots: verlet ragdolls, health, AI, rendering (instanced)
(() => {
const { clamp, rand, choose } = SKY;
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4423];
const SHIRT = [0xe53935, 0x43a047, 0xfdd835, 0x8e24aa, 0x00acc1, 0xfb8c00, 0xec407a, 0x7cb342, 0x5c6bc0, 0xffffff];
const PANTS = [0x263238, 0x37474f, 0x3e2723, 0x1a237e, 0x4e342e];
const HAIR = [0x2b1b0e, 0x111111, 0x8d5524, 0xe6c35c, 0xb0b0b0, 0xa0402a];
const NAMES = ['Ana', 'Ben', 'Chen', 'Dmitri', 'Eli', 'Fatima', 'Gus', 'Hana', 'Ivan', 'Jo', 'Kenji', 'Lupe', 'Mo', 'Nia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq', 'Uma', 'Vic', 'Wen', 'Ximena', 'Yuki', 'Zoe', 'Luis', 'Marta', 'Pierre', 'Aiko'];
// point indices
const HEAD = 0, NECK = 1, PELV = 2, HL = 3, HR = 4, FL = 5, FR = 6;
const CONS = [[HEAD, NECK, 0.24], [NECK, PELV, 0.55], [NECK, HL, 0.62], [NECK, HR, 0.62], [PELV, FL, 0.9], [PELV, FR, 0.9], [HEAD, PELV, 0.79], [HL, HR, -0.25], [FL, FR, -0.18], [HL, PELV, -0.3], [HR, PELV, -0.3], [FL, NECK, -0.7], [FR, NECK, -0.7]];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
let uid = 1;

class Person {
  constructor(role, frame) {
    this.id = uid++; this.role = role; this.frame = frame;
    this.name = role === 'captain' ? 'Captain Rex' : role === 'fo' ? 'First Officer Kim' : role === 'crew' ? choose(['Flight Attendant Lola', 'Flight Attendant Theo', 'Flight Attendant Mei', 'Purser Dana']) : choose(NAMES);
    this.skin = choose(SKIN);
    this.shirt = role === 'captain' || role === 'fo' ? 0xf5f5f5 : role === 'crew' ? choose([0x1e3a8a, 0xb71c1c, 0x00695c]) : choose(SHIRT);
    this.pants = role === 'pax' ? choose(PANTS) : 0x1b1f3a;
    this.hair = role === 'captain' || role === 'fo' ? 0x1b1f3a : choose(HAIR);
    this.pts = []; for (let i = 0; i < 7; i++) this.pts.push({ p: new THREE.Vector3(), o: new THREE.Vector3() });
    this.pos = new THREE.Vector3(); this.yaw = 0; this.state = 'idle'; this.hp = 100; this.woozy = 0; this.masked = false; this.o2 = 100;
    this.seat = null; this.path = []; this.say = ''; this.sayT = 0; this.ragT = 0; this.anim = Math.random() * 10; this.t = rand(2, 10);
    this.headPos = new THREE.Vector3(); this.panic = 0; this.eatT = 0; this.mealFx = null; this.job = null; this.hitCD = 0; this.chute = false; this.airT = 0;
    this.side = new THREE.Vector3(1, 0, 0); this.ko = false; this.carry = false; this.refuse = 0; this.slumpT = 0; this.helped = 0;
  }
  get conscious() { return this.hp > 0 && !this.ko && this.state !== 'rag' && this.state !== 'slump'; }
  talk(t, dur) { this.say = t; this.sayT = dur || 2.5; }
  sitIn(seat) { if (seat.occupant && seat.occupant !== this) return false; if (this.seat && this.seat !== seat && this.seat.occupant === this) this.seat.occupant = null; this.seat = seat; seat.occupant = this; this.state = 'sit'; this.pos.set(seat.x, 0, seat.z); this.yaw = 0; this.pose(0, true); return true; }
  leaveSeat() { if (this.seat && this.seat.occupant === this) this.seat.occupant = null; this.seat = null; }
  hurt(n, msg) {
    if (n <= 0) return;
    this.hp -= n; this.hitCD = 0.6;
    if (SKY.Game) SKY.Game.stats.injuries += n > 4 ? 1 : 0;
    if (this.hp <= 0 && !this.ko) { this.hp = 0; this.ko = true; this.knock(null); this.talk('💫 KO', 3); if (SKY.Game) SKY.Game.onKO(this); }
    else if (n > 6 && this.conscious) { this.talk(choose(['Ow!', 'Ouch!', 'Hey!!', 'Yikes!', 'Oof!']), 1.5); if (Math.random() < 0.4) SKY.Audio.play('yelp'); }
  }
  // switch to ragdoll, optional impulse (velocity) in the person's frame
  knock(vel) {
    if (this.state !== 'rag') { if (this.seat && this.state === 'sit') this.leaveSeat(); this.state = 'rag'; this.ragT = 0; }
    if (vel) for (const pt of this.pts) pt.o.addScaledVector(vel, -SKY.DT * rand(0.8, 1.2));
  }
  // procedural pose → pts
  pose(dt, snap) {
    const P = this.pts; const y = this.yaw;
    const fx = -Math.sin(y), fz = -Math.cos(y), sx = Math.cos(y), sz = -Math.sin(y);
    const b = this.pos; let st = this.state;
    for (const pt of P) pt.o.copy(pt.p);
    const set = (i, x, yy, z) => P[i].p.set(x, yy, z);
    const wob = this.woozy > 0 ? Math.sin(this.anim * 3) * 0.12 : 0;
    if (st === 'sit' || st === 'eat' || st === 'slump') {
      const px = b.x - fx * 0.12, pz = b.z - fz * 0.12, py = b.y + 0.55; // b.y is 0 in the cabin
      const lean = st === 'slump' ? 0.35 : 0;
      set(PELV, px, py, pz);
      set(NECK, px + sx * wob + fx * lean, py + 0.55 - lean * 0.4, pz + fz * lean + 0.02);
      set(HEAD, px + sx * wob * 1.4 + fx * lean * 1.4, py + 0.79 - lean * 0.6, pz + fz * lean * 1.3);
      const panic = this.panic > 0 && st === 'sit';
      for (const s of [-1, 1]) {
        const hi = s < 0 ? HL : HR;
        if (panic) set(hi, px + sx * s * 0.3, py + 1.15 + Math.sin(this.anim * 9 + s) * 0.12, pz - 0.05);
        else if (st === 'eat' && s > 0) set(hi, px + sx * 0.12 + fx * 0.2, py + 0.55 + Math.max(0, Math.sin(this.anim * 5)) * 0.2, pz + fz * 0.2);
        else if (st === 'slump') set(hi, px + sx * s * 0.32, py - 0.15, pz);
        else set(hi, px + sx * s * 0.17 + fx * 0.3, py + 0.08, pz + fz * 0.3);
        set(s < 0 ? FL : FR, px + sx * s * 0.13 + fx * 0.55, b.y + 0.03, pz + fz * 0.55);
      }
    } else if (st === 'brace') {
      set(PELV, b.x, 0.45, b.z); set(NECK, b.x + fx * 0.3, 0.85, b.z + fz * 0.3); set(HEAD, b.x + fx * 0.45, 0.95, b.z + fz * 0.45);
      for (const s of [-1, 1]) { set(s < 0 ? HL : HR, b.x + sx * s * 0.2 + fx * 0.45, 1.05, b.z + sz * s * 0.2 + fz * 0.45); set(s < 0 ? FL : FR, b.x + sx * s * 0.18 + fx * 0.3, 0.02, b.z + sz * s * 0.18 + fz * 0.3); }
    } else { // standing / walking / panic / para
      const walking = st === 'walk' || st === 'panic';
      if (walking) this.anim += dt * (st === 'panic' ? 11 : 7);
      const sw = walking ? Math.sin(this.anim) * 0.28 : 0;
      const by = b.y + (walking ? Math.abs(Math.cos(this.anim)) * 0.04 : 0);
      set(PELV, b.x + sx * wob, by + 0.92, b.z + sz * wob);
      set(NECK, b.x + sx * wob * 1.5, by + 1.47, b.z + sz * wob * 1.5);
      set(HEAD, b.x + sx * wob * 1.8, by + 1.71, b.z + sz * wob * 1.8);
      for (const s of [-1, 1]) {
        const hi = s < 0 ? HL : HR, fi = s < 0 ? FL : FR;
        if (st === 'panic' || st === 'para' || st === 'wave') {
          const wv = st === 'wave' && s > 0 ? Math.sin(this.anim * 8) * 0.25 : 0; if (st === 'wave') this.anim += dt;
          set(hi, b.x + sx * s * 0.32 + sx * wv, by + 2.0 + Math.sin(this.anim * 2 + s) * 0.08, b.z + sz * s * 0.32 + sz * wv);
        } else if (this.carry && s > 0) set(hi, b.x + sx * 0.2 + fx * 0.35, by + 1.1, b.z + sz * 0.2 + fz * 0.35);
        else set(hi, b.x + sx * s * 0.25 + fx * sw * s, by + 0.86, b.z + sz * s * 0.25 + fz * sw * s);
        set(fi, b.x + sx * s * 0.12 - fx * sw * s, by + (st === 'para' ? -0.05 : 0.02), b.z + sz * s * 0.12 - fz * sw * s);
      }
    }
    if (snap) for (const pt of P) pt.o.copy(pt.p);
    this.side.set(sx, 0, sz);
  }
  ragStep(dt, g, solid, ground, extra) {
    const P = this.pts; this.ragT += dt;
    const damp = 0.992;
    let maxImp = 0;
    for (let i = 0; i < 7; i++) {
      const pt = P[i];
      _a.subVectors(pt.p, pt.o).multiplyScalar(damp);
      pt.o.copy(pt.p);
      _b.copy(g); if (extra) _b.add(extra);
      if (this.frame === 'world') { const v = _a.length() / dt; if (v > 0.1) { const c = this.chute ? 0.27 : 0.0039; const drag = Math.min(v, c * v * v * dt); _a.multiplyScalar(1 - drag / v); } }
      pt.p.add(_a).addScaledVector(_b, dt * dt);
    }
    // constraints
    for (let it = 0; it < 4; it++) for (const c of CONS) {
      const A = P[c[0]].p, B = P[c[1]].p; _a.subVectors(B, A); const d = _a.length() || 1e-4; const L = Math.abs(c[2]);
      if (c[2] < 0 && d > L) continue; // min-distance only
      const diff = (d - L) / d * 0.5; A.addScaledVector(_a, diff); B.addScaledVector(_a, -diff);
    }
    // collisions
    for (let i = 0; i < 7; i++) {
      const pt = P[i], p = pt.p, o = pt.o;
      if (ground) { const h = ground(p.x, p.z); if (p.y < h) { const imp = (o.y - p.y) / dt; maxImp = Math.max(maxImp, imp); p.y = h; o.x = p.x - (p.x - o.x) * 0.6; o.z = p.z - (p.z - o.z) * 0.6; o.y = p.y; } }
      if (solid(p.x, p.y, p.z)) {
        const sp = _c.subVectors(p, o).length() / dt;
        if (!solid(o.x, p.y, p.z)) { p.x = o.x; o.y = p.y - (p.y - o.y) * 0.7; o.z = p.z - (p.z - o.z) * 0.7; }
        else if (!solid(p.x, o.y, p.z)) { p.y = o.y; o.x = p.x - (p.x - o.x) * 0.6; o.z = p.z - (p.z - o.z) * 0.6; }
        else if (!solid(p.x, p.y, o.z)) { p.z = o.z; o.x = p.x - (p.x - o.x) * 0.7; o.y = p.y - (p.y - o.y) * 0.7; }
        else p.copy(o);
        maxImp = Math.max(maxImp, sp);
      }
    }
    if (maxImp > 7.5 && this.hitCD <= 0) this.hurt((maxImp - 7.5) * 4.5);
    this.pos.set((P[FL].p.x + P[FR].p.x) / 2, Math.min(P[FL].p.y, P[FR].p.y), (P[FL].p.z + P[FR].p.z) / 2);
    return maxImp;
  }
  vel(out) { return out.subVectors(this.pts[PELV].p, this.pts[PELV].o).divideScalar(SKY.DT); }
  restVel() { let m = 0; for (const pt of this.pts) m = Math.max(m, pt.p.distanceToSquared(pt.o)); return Math.sqrt(m) / SKY.DT; }
  standUp(floorY) {
    const pl = this.pts[PELV].p; this.pos.set(pl.x, floorY, pl.z);
    const h = this.pts[HEAD].p; this.yaw = Math.atan2(-(h.x - pl.x), -(h.z - pl.z));
    this.state = 'idle'; this.t = rand(0.5, 2); this.path = []; this.pose(0, true);
  }
  // ---------- render into instanced writer ----------
  render(w) {
    const P = this.pts;
    const up = _a.subVectors(P[NECK].p, P[PELV].p); const tl = up.length(); up.divideScalar(tl || 1);
    const side = _b.subVectors(P[HR].p, P[HL].p).add(_c.subVectors(P[FR].p, P[FL].p));
    if (this.state !== 'rag') side.copy(this.side);
    side.addScaledVector(up, -side.dot(up)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0).addScaledVector(up, -up.x); side.normalize();
    const back = _c.copy(side).cross(up);
    const sick = this.woozy > 0 ? 0.5 : 0;
    const headCol = sick ? lerpCol(this.skin, 0x7ccf4a, sick) : this.skin;
    // torso
    _d.addVectors(P[NECK].p, P[PELV].p).multiplyScalar(0.5);
    w.box(_d, side, up, back, 0.42, tl + 0.12, 0.24, this.shirt);
    // head
    _e.subVectors(P[HEAD].p, P[NECK].p).normalize(); if (_e.lengthSq() < 0.5) _e.copy(up);
    const hb = new THREE.Vector3().copy(side).cross(_e);
    w.box(P[HEAD].p, side, _e, hb, 0.27, 0.28, 0.27, this.ko ? 0xbbbbbb : headCol);
    this.headPos.copy(P[HEAD].p);
    // hair / hat / mask
    if (this.masked) { _d.copy(P[HEAD].p).addScaledVector(hb, -0.15); w.box(_d, side, _e, hb, 0.16, 0.13, 0.1, 0xffd400); }
    else { _d.copy(P[HEAD].p).addScaledVector(_e, 0.15).addScaledVector(hb, 0.02); w.box(_d, side, _e, hb, this.role === 'captain' || this.role === 'fo' ? 0.31 : 0.29, 0.07, 0.3, this.hair); }
    // limbs
    limb(w, P[NECK].p, P[HL].p, side, 0.11, this.shirt, -0.21);
    limb(w, P[NECK].p, P[HR].p, side, 0.11, this.shirt, 0.21);
    limb(w, P[PELV].p, P[FL].p, side, 0.15, this.pants, -0.11);
    limb(w, P[PELV].p, P[FR].p, side, 0.15, this.pants, 0.11);
  }
}
function lerpCol(a, b, t) { const c1 = new THREE.Color(a), c2 = new THREE.Color(b); return c1.lerp(c2, t).getHex(); }
const _l1 = new THREE.Vector3(), _l2 = new THREE.Vector3(), _l3 = new THREE.Vector3(), _l4 = new THREE.Vector3();
function limb(w, a, b, side, th, col, off) {
  _l4.copy(a).addScaledVector(side, off);
  _l1.subVectors(b, _l4); const L = _l1.length() || 0.01; _l1.divideScalar(L);
  _l2.copy(side).addScaledVector(_l1, -side.dot(_l1)); if (_l2.lengthSq() < 1e-4) _l2.set(0, 0, 1); _l2.normalize();
  _l3.copy(_l2).cross(_l1);
  _l4.addScaledVector(_l1, L / 2);
  w.box(_l4, _l2, _l1, _l3, th, L, th, col);
}
SKY.Person = Person;

// ---------- instanced renderer ----------
class CharWriter {
  constructor(parent, max) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; parent.add(this.mesh); this.max = max; this.n = 0;
    this.m = new THREE.Matrix4(); this.col = new THREE.Color();
  }
  begin() { this.n = 0; }
  box(pos, x, y, z, sx, sy, sz, col) {
    if (this.n >= this.max) return;
    const e = this.m.elements;
    e[0] = x.x * sx; e[1] = x.y * sx; e[2] = x.z * sx; e[3] = 0;
    e[4] = y.x * sy; e[5] = y.y * sy; e[6] = y.z * sy; e[7] = 0;
    e[8] = z.x * sz; e[9] = z.y * sz; e[10] = z.z * sz; e[11] = 0;
    e[12] = pos.x; e[13] = pos.y; e[14] = pos.z; e[15] = 1;
    this.mesh.setMatrixAt(this.n, this.m); this.col.setHex(col); this.mesh.instanceColor.setXYZ(this.n, this.col.r, this.col.g, this.col.b); this.n++;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
}
SKY.CharWriter = CharWriter;

// ---------- crowd manager ----------
const Crowd = SKY.Crowd = {
  list: [],
  init(plane, scene) {
    this.plane = plane; this.scene = scene;
    this.wPlane = new CharWriter(plane.interior, 90 * 7);
    this.wWorld = new CharWriter(scene, 50 * 7);
    this.chutes = [];
    const cm = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
    for (let i = 0; i < 10; i++) { const c = new THREE.Group(); const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 2.2), cm); top.position.y = 3.2; c.add(top); const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.31, 2.21), new THREE.MeshLambertMaterial({ color: 0xffffff })); s.position.y = 3.2; c.add(s); c.visible = false; scene.add(c); this.chutes.push(c); }
  },
  clear() { for (const p of this.list) p.leaveSeat(); this.list = []; },
  spawn(role, seat) {
    const p = new Person(role, 'plane');
    if (seat) p.sitIn(seat); else p.pose(0, true);
    this.list.push(p); return p;
  },
  populate(nPax, cabinStart) {
    const pl = this.plane; this.clear();
    const cock = pl.seats.filter((s) => s.cockpit);
    const cap = this.spawn('captain', cabinStart ? cock[0] : null); if (!cabinStart) { this.list.pop(); cap.leaveSeat(); }
    this.spawn('fo', cock[1]);
    const crew1 = this.spawn('crew'); crew1.pos.set(0.4, 0, -11.0); crew1.yaw = Math.PI; crew1.post = new THREE.Vector3(0.4, 0, -11.2); crew1.pose(0, true); crew1.lead = true;
    const crew2 = this.spawn('crew'); crew2.pos.set(0.4, 0, 9.0); crew2.post = new THREE.Vector3(0.5, 0, 9.0); crew2.pose(0, true);
    const free = pl.seats.filter((s) => !s.cockpit);
    for (let i = 0; i < nPax && free.length; i++) { const s = free.splice(Math.floor(Math.random() * free.length), 1)[0]; this.spawn('pax', s); }
  },
  addPassenger() { const free = this.plane.seats.filter((s) => !s.cockpit && !s.occupant); if (!free.length) { SKY.toast('No free seats!'); return null; } const p = this.spawn('pax', choose(free)); p.talk('Hi! 👋', 2); SKY.toast('➕ ' + p.name + ' boarded', 'good'); return p; },
  addCrew() { const p = this.spawn('crew'); p.pos.set(0.3, 0, rand(-8, 4)); p.post = p.pos.clone(); p.pose(0, true); p.talk('Reporting for duty!', 2); SKY.toast('➕ ' + p.name + ' joined the crew', 'good'); return p; },
  pilots() { return this.list.filter((p) => (p.role === 'captain' || p.role === 'fo') && p.frame === 'plane' && p.seat && p.seat.cockpit && p.conscious); },
  // move a plane-frame person to world frame
  toWorld(p) {
    const pl = this.plane;
    if (p.seat) p.leaveSeat();
    for (const pt of p.pts) { const v = _a.subVectors(pt.p, pt.o).divideScalar(SKY.DT); const wv = pl.dirToWorld(v).add(pl.pointVel(pt.p)); pl.toWorld(pt.p, pt.p); pt.o.copy(pt.p).addScaledVector(wv, -SKY.DT); }
    p.frame = 'world'; p.state = 'rag'; p.ragT = 0; p.airT = 0; p.chute = false; p.masked = false; p.job = null; p.carry = false;
    if (SKY.Game) SKY.Game.onEjected(p);
  },
  walkTo(p, x, z, then) {
    p.leaveSeat();
    const path = [];
    if (Math.abs(p.pos.x) > 0.3) path.push(new THREE.Vector3(0, 0, p.pos.z));
    path.push(new THREE.Vector3(0, 0, z)); path.push(new THREE.Vector3(x, 0, z));
    p.path = path; p.state = 'walk'; p.then = then || null;
  },
  update(dt, ctx) {
    const pl = this.plane; const g = pl.gLocal; const kick = pl.kick;
    const solidL = (x, y, z) => pl.solidLocal(x, y, z);
    const W = SKY.World; const gW = new THREE.Vector3(0, -SKY.GRAV, 0);
    const solidW = (x, y, z) => !!W.solidAt(x, y, z);
    const sucV = new THREE.Vector3();
    const emergency = pl.decomp || pl.turb.on > 0 || pl.crashed || pl.fires.length > 0 || (pl.integrity < 0.9);
    const kickMag = kick.length() / SKY.DT * SKY.DT; // velocity change this step (m/s)
    const horizG = Math.hypot(g.x, g.z);
    let ci = 0;
    for (const p of this.list) {
      p.sayT -= dt; if (p.sayT <= 0) p.say = ''; p.hitCD -= dt; p.anim += dt;
      if (p.woozy > 0) { p.woozy -= dt; if (p.conscious && Math.random() < dt * 0.4) p.talk(choose(['urgh...', '🤢', 'I feel funny', 'blergh', 'the room is spinning']), 2); if ((p.state === 'walk' || p.state === 'idle') && Math.random() < dt * 0.15) p.knock(new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1))); if ((p.role === 'captain' || p.role === 'fo') && p.state === 'sit' && p.woozy > 0) { p.slumpT += dt; if (p.slumpT > 12) { p.state = 'slump'; p.talk('zzz... 😵', 4); if (SKY.Game) SKY.Game.onPilotDown(p); } } }
      if (p.state === 'slump' && p.woozy <= 0 && p.hp > 0) { p.state = 'sit'; p.slumpT = 0; p.talk('Whoa... what happened?', 3); }
      if (p.frame === 'plane') this.updatePlanePerson(p, dt, g, kick, kickMag, horizG, solidL, sucV, emergency, ctx);
      else this.updateWorldPerson(p, dt, gW, solidW, ci);
      if (p.frame === 'world' && p.state === 'para') ci++;
    }
    for (let i = 0; i < this.chutes.length; i++) this.chutes[i].visible = false;
    let k = 0; for (const p of this.list) if (p.frame === 'world' && p.state === 'para' && k < this.chutes.length) { const c = this.chutes[k++]; c.visible = true; c.position.copy(p.pts[NECK].p); }
    // remove far-away world people
    this.list = this.list.filter((p) => p.frame !== 'world' || p.pts[PELV].p.distanceTo(ctx.camPos) < 6000);
    // render
    this.wPlane.begin(); this.wWorld.begin();
    for (const p of this.list) p.render(p.frame === 'plane' ? this.wPlane : this.wWorld);
    if (ctx.playerBody) ctx.playerBody(this.wPlane, this.wWorld);
    this.wPlane.end(); this.wWorld.end();
  },
  updatePlanePerson(p, dt, g, kick, kickMag, horizG, solidL, sucV, emergency, ctx) {
    const pl = this.plane;
    // oxygen
    if (pl.pressure < 0.9 && !p.masked) { p.o2 -= (0.95 - pl.pressure) * 5 * dt; if (p.o2 <= 0 && !p.ko) { p.o2 = 0; p.ko = true; p.talk('😵 (passed out)', 3); if (p.state === 'sit') p.state = 'slump'; else p.knock(null); if ((p.role === 'captain' || p.role === 'fo') && SKY.Game) SKY.Game.onPilotDown(p); } }
    else { p.o2 = Math.min(100, p.o2 + 8 * dt); if (p.ko && p.hp > 0 && p.o2 > 60) { p.ko = false; if (p.state === 'slump' && p.woozy <= 0) p.state = 'sit'; p.talk('Huh?! I\'m awake!', 2); } }
    pl.suction(p.pts[PELV].p, sucV);
    const suc = sucV.length();
    if (p.state === 'sit' || p.state === 'eat' || p.state === 'slump') {
      if (kickMag > 7) { p.hurt((kickMag - 6) * 2.5); if (kickMag > 20 || p.seat === null) { p.knock(kick.clone().multiplyScalar(1)); return; } }
      if (suc > 40) { p.knock(sucV.clone().multiplyScalar(0.05)); p.talk('AAAAH!', 2); return; }
      if (p.seat && !pl.grid.solid(p.seat.x, 0.2, p.seat.z)) { p.knock(null); return; } // seat destroyed
      p.panic = emergency && p.role === 'pax' ? 1 : 0;
      if (p.panic && Math.random() < dt * 0.05) { p.talk(choose(['AAAH!', 'We\'re gonna crash!', 'Mommy!', 'Is this normal?!', 'OMG OMG']), 2); if (Math.random() < 0.3) SKY.Audio.play('yelp'); }
      if (pl.masksDown && !p.masked && pl.maskT > 1 + (p.id % 5) * 0.6) { p.masked = true; }
      if (!pl.decomp && pl.pressure > 0.95 && p.masked && Math.random() < dt * 0.1) p.masked = false;
      if (p.state === 'eat') { p.eatT -= dt; if (p.eatT <= 0) { p.state = 'sit'; if (p.mealFx) { p.mealFx(p); p.mealFx = null; } } }
      // passenger wanders to the lavatory now and then
      if (p.role === 'pax' && p.state === 'sit' && !emergency && !pl.belt && Math.random() < dt * 0.004 && ctx.wanderers < 2 && !pl.crashed) {
        p.homeSeat = p.seat; this.walkTo(p, -1.2, SKY.PlaneConst.czK(62) + 0.2, (q) => { q.state = 'idle'; q.t = rand(4, 8); q.next = 'home'; });
      }
      p.pose(dt);
      return;
    }
    if (p.state === 'rag') {
      const sv = sucV.clone();
      p.ragStep(dt, g, solidL, null, sv);
      if (kickMag > 0.5) for (const pt of p.pts) pt.o.addScaledVector(kick, -1);
      // left the fuselage?
      const pel = p.pts[PELV].p;
      if (pl.isOutside(pel)) { this.toWorld(p); SKY.Audio.play('woosh'); return; }
      if (p.grabbed) return;
      if (p.ragT > 2.5 && p.hp > 0 && !p.ko && p.restVel() < 0.6 && g.y < -6 && horizG < 4 && suc < 5) {
        // find floor under pelvis
        let fy = null; for (let y = pel.y + 0.2; y > pel.y - 1.5; y -= 0.1) if (solidL(pel.x, y - 0.05, pel.z)) { fy = y; break; }
        if (fy !== null) { p.standUp(Math.max(fy, 0)); p.talk(choose(['I\'m okay!', 'Ugh...', 'That hurt.', 'Who did that?!']), 2); }
      }
      return;
    }
    // standing / walking states
    if (kickMag > 2 || horizG > 5.5 || suc > 6 || (pl.turb.on && pl.turb.str > 0.9 && Math.random() < dt * 0.3)) { p.knock(kick.clone().add(sucV.clone().multiplyScalar(0.04))); if (suc > 6) p.talk('WHOAAA!', 2); return; }
    if (!solidL(p.pos.x, p.pos.y - 0.1, p.pos.z) && !solidL(p.pos.x, p.pos.y - 0.3, p.pos.z)) { p.knock(null); return; }
    if (p.state === 'walk' || p.state === 'panic') ctx.wanderers++;
    if (p.state === 'brace') { if (!pl.decomp && pl.pressure > 0.95) { p.state = 'idle'; p.masked = false; } else { if (pl.maskT > 3) p.masked = true; p.pose(dt); return; } }
    if (p.state === 'walk') {
      const tgt = p.path[0];
      if (!tgt) { p.state = 'idle'; if (p.then) { const f = p.then; p.then = null; f(p); } p.pose(dt); return; }
      const dx = tgt.x - p.pos.x, dz = tgt.z - p.pos.z, d = Math.hypot(dx, dz);
      const sp = (p.panicRun ? 2.6 : 1.3) * (p.woozy > 0 ? 0.6 : 1);
      if (d < 0.08) p.path.shift();
      else { const st = Math.min(d, sp * dt); p.pos.x += dx / d * st; p.pos.z += dz / d * st; p.yaw = Math.atan2(-dx, -dz); }
      // blocked by player? wait
      if (ctx.playerLocal && ctx.playerLocal.distanceTo(p.pos) < 0.45) { p.pos.x -= dx / (d || 1) * sp * dt; if (Math.random() < dt * 0.3) p.talk('Excuse me!', 1.5); }
      p.pose(dt); return;
    }
    // idle
    p.t -= dt;
    if (pl.decomp && p.role === 'crew') { p.state = 'brace'; p.talk('Masks on! Stay seated!', 3); p.pose(dt); return; }
    if (p.role === 'pax') {
      if (p.next === 'home' && p.t <= 0) { p.next = null; const s = (p.homeSeat && !p.homeSeat.occupant) ? p.homeSeat : this.plane.seats.find((s) => !s.cockpit && !s.occupant); if (s) this.walkTo(p, s.x, s.z, (q) => q.sitIn(s)); }
      else if (!p.next && p.t <= 0) { const s = this.plane.seats.filter((s) => !s.cockpit && !s.occupant).sort((a, b) => Math.hypot(a.x - p.pos.x, a.z - p.pos.z) - Math.hypot(b.x - p.pos.x, b.z - p.pos.z))[0]; if (s) this.walkTo(p, s.x, s.z, (q) => q.sitIn(s)); p.t = 5; }
    } else if (p.role === 'crew') this.crewAI(p, dt, emergency, ctx);
    else if (p.role === 'captain' || p.role === 'fo') {
      if (p.t <= 0) { const s = this.plane.seats.find((s) => s.cockpit && !s.occupant && (s.captain === (p.role === 'captain'))) || this.plane.seats.find((s) => s.cockpit && !s.occupant); if (s && !ctx.playerInSeat(s)) this.walkTo(p, s.x, s.z, (q) => q.sitIn(s)); p.t = 6; }
    }
    p.pose(dt);
  },
  crewAI(p, dt, emergency, ctx) {
    const pl = this.plane; const C = SKY.PlaneConst;
    if (p.job && p.job.type === 'meal') {
      const j = p.job;
      if (j.step === 0) { p.carry = true; this.walkTo(p, 0, C.COCK_Z + 0.7, () => { j.step = 1; p.t = 1; }); p.talk('Meal for the flight deck!', 2); return; }
      if (j.step === 1 && p.t <= 0) {
        const cd = pl.cockpitDoor;
        if (!cd.broken) { cd.target = 1; cd.autoClose = 6; SKY.Audio.play('beep'); }
        this.walkTo(p, 0.1, -13.0, () => { j.step = 2; p.t = 1.2; });
        return;
      }
      if (j.step === 2 && p.t <= 0) {
        const pilot = this.list.find((q) => (q.role === 'captain' || q.role === 'fo') && q.frame === 'plane' && q.state === 'sit' && !q.fed);
        if (pilot) { pilot.fed = true; SKY.Game.feed(pilot, j.meal); p.talk('Bon appétit, ' + (pilot.role === 'captain' ? 'Captain' : 'First Officer') + '!', 2.5); }
        p.carry = false; j.step = 3; this.walkTo(p, p.post.x, p.post.z, () => { p.job = null; p.yaw = Math.PI; });
        const cd = pl.cockpitDoor; if (!cd.broken) cd.autoClose = 3.5;
        return;
      }
      return;
    }
    // first aid
    if (p.t <= 0) {
      const hurt = this.list.filter((q) => q !== p && q.frame === 'plane' && (q.ko || q.hp < 60) && q.hp >= 0 && q.helped <= 0 && !pl.inCockpit(q.pts[PELV].p)).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
      if (hurt && !emergency) {
        const tp = hurt.pts[PELV].p; hurt.helped = 8;
        this.walkTo(p, clamp(tp.x, -0.5, 0.5), tp.z + 0.5, () => { p.talk('Let me help you!', 2); hurt.hp = Math.min(100, Math.max(hurt.hp, 0) + 35); if (hurt.ko && hurt.o2 > 40) { hurt.ko = false; hurt.talk('Thanks... 🙏', 2); } p.t = rand(3, 6); });
        return;
      }
      if (p.post) { if (Math.random() < 0.5) this.walkTo(p, 0.3, rand(-8, 4), () => { p.t = rand(3, 7); p.talk(choose(['Something to drink?', 'Peanuts?', 'Please keep the aisle clear.', 'Lovely flight today!', 'Seatbelts on during turbulence please.']), 2.2); }); else this.walkTo(p, p.post.x, p.post.z, () => { p.t = rand(6, 12); }); }
      else p.t = 5;
    }
    for (const q of this.list) if (q.helped > 0) q.helped -= dt * 0.1;
  },
  updateWorldPerson(p, dt, gW, solidW, ci) {
    const W = SKY.World;
    if (p.state === 'rag') {
      p.airT += dt;
      const pel = p.pts[PELV].p; const hgt = pel.y - W.heightAt(pel.x, pel.z);
      if (p.role !== 'player' && !p.chute && p.airT > 1.6 && hgt > 40) { p.chute = true; p.state = 'para'; p.pos.copy(pel).y -= 0.9; p.pv = p.vel(new THREE.Vector3()); p.talk('Wheee! 🪂', 3); return; }
      p.ragStep(dt, gW, solidW, (x, z) => W.heightAt(x, z) + 0.02, null);
      if (p.ragT > 3 && hgt < 1.5 && p.hp > 0 && !p.ko && p.restVel() < 0.5) { p.standUp(W.heightAt(pel.x, pel.z)); p.state = 'wave'; }
      return;
    }
    if (p.state === 'para') {
      p.pv.y += (-5 - p.pv.y) * Math.min(1, 2 * dt); p.pv.x *= 1 - 0.8 * dt; p.pv.z *= 1 - 0.8 * dt;
      p.pos.addScaledVector(p.pv, dt);
      const h = W.heightAt(p.pos.x, p.pos.z);
      if (p.pos.y <= h) { p.pos.y = h; p.state = 'wave'; p.chute = false; p.talk('Made it! 🙌', 3); }
      p.pose(dt); return;
    }
    p.pose(dt);
  },
};
})();

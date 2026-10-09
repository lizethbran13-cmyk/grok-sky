'use strict';
// GROK SKY - player: walking (plane frame & world), tools, grab/throw, interactions, galley cooking, keypad, props
(() => {
const { clamp, rand, choose } = SKY;
const C = () => SKY.PlaneConst;
const TOOLS = [
  { name: 'HANDS', icon: '✊', cd: 0.35, vox: 0.4, ppl: 3, push: 3.5, door: 0.4, range: 1.9 },
  { name: 'HAMMER', icon: '🔨', cd: 0.4, vox: 1.0, ppl: 9, push: 4, door: 2, range: 2.2 },
  { name: 'CROWBAR', icon: '🔧', cd: 0.7, vox: 2.2, ppl: 14, push: 5.5, door: 4.5, range: 2.4 },
];
SKY.TOOLS = TOOLS;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

// ---------------------------------------------------------------- props
const Props = SKY.Props = {
  list: [],
  init(plane, scene) { this.plane = plane; this.scene = scene; },
  clear() { for (const p of this.list) if (p.mesh.parent) p.mesh.parent.remove(p.mesh); this.list = []; },
  make(kind, x, y, z, extra) {
    const defs = { bag: [0.5, 0.32, 0.26, choose([0x6a1b9a, 0x2e7d32, 0xc62828, 0x283593, 0x4e342e, 0xff8f00])], cup: [0.09, 0.12, 0.09, 0xffffff], pillow: [0.42, 0.12, 0.3, 0x9ecbff], cart: [0.36, 0.95, 0.7, 0xb8c0c8], ext: [0.16, 0.48, 0.16, 0xe02020], tray: [0.42, 0.05, 0.3, 0x555b66] };
    const d = defs[kind];
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(d[0], d[1], d[2]), new THREE.MeshLambertMaterial({ color: d[3] })); g.add(m);
    if (kind === 'ext') { const n = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.18), new THREE.MeshLambertMaterial({ color: 0x222222 })); n.position.set(0, 0.26, -0.06); g.add(n); }
    if (kind === 'tray') { const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), new THREE.MeshLambertMaterial({ color: extra && extra.meal ? extra.meal.color : 0xffaa55 })); f.position.y = 0.06; g.add(f); }
    if (kind === 'bag') { const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), new THREE.MeshLambertMaterial({ color: 0x111111 })); h.position.y = 0.19; g.add(h); }
    const p = { kind, mesh: g, frame: 'plane', pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), half: new THREE.Vector3(d[0] / 2, d[1] / 2, d[2] / 2), held: false, mounted: false, spin: new THREE.Vector3(), mass: kind === 'cart' ? 4 : 1, ...(extra || {}) };
    g.position.copy(p.pos); this.plane.interior.add(g); this.list.push(p); return p;
  },
  populate() {
    this.clear(); const cz = C().czK;
    for (let i = 0; i < (SKY.lowSpec ? 5 : 9); i++) this.make(choose(['bag', 'bag', 'pillow', 'cup']), rand(-0.5, 0.5), 0.3, rand(-9, 4));
    this.make('cart', 0.5, 0.48, cz(64) + 0.2);
    this.ext = this.make('ext', -1.82, 1.1, cz(59)); this.ext.mounted = true;
    this.make('cup', 1.2, 0.9, cz(61)); this.make('cup', 1.3, 0.9, cz(13));
  },
  collides(p, pos, solid) {
    const h = p.half;
    for (let a = 0; a < 8; a++) if (solid(pos.x + (a & 1 ? h.x : -h.x) * 0.9, pos.y + (a & 2 ? h.y : -h.y) * 0.95, pos.z + (a & 4 ? h.z : -h.z) * 0.9)) return true;
    return false;
  },
  update(dt) {
    const pl = this.plane, W = SKY.World;
    const solidL = (x, y, z) => pl.solidLocal(x, y, z);
    const solidW = (x, y, z) => y < W.heightAt(x, z) || !!W.solidAt(x, y, z) || (SKY.Places && SKY.Places.solid(x, y, z));
    const suc = new THREE.Vector3();
    for (const p of this.list) {
      if (p.held || p.mounted) { p.mesh.position.copy(p.pos); continue; }
      const plane = p.frame === 'plane';
      const solid = plane ? solidL : solidW;
      if (plane) { p.vel.addScaledVector(pl.gLocal, dt); pl.suction(p.pos, suc); p.vel.addScaledVector(suc, dt * 1.4 / p.mass); p.vel.add(pl.kick); }
      else { p.vel.y -= SKY.GRAV * dt; p.vel.multiplyScalar(1 - 0.02 * dt * p.vel.length()); }
      const sp = p.vel.length(); if (sp > 60) p.vel.setLength(60);
      let hitSp = 0;
      for (const ax of ['x', 'y', 'z']) {
        const nv = p.pos[ax] + p.vel[ax] * dt; _v.copy(p.pos); _v[ax] = nv;
        if (this.collides(p, _v, solid)) { hitSp = Math.max(hitSp, Math.abs(p.vel[ax])); p.vel[ax] *= -0.25; if (ax === 'y') { p.vel.x *= 0.85; p.vel.z *= 0.85; p.spin.multiplyScalar(0.8); } }
        else p.pos[ax] = nv;
      }
      if (hitSp > 4 && SKY.Game) { SKY.Game.propHit(p, hitSp); }
      if (sp > 1.5) p.spin.set(p.vel.z * 2, 0, -p.vel.x * 2); else p.spin.multiplyScalar(0.9);
      p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.z += p.spin.z * dt;
      if (sp < 0.5) { p.mesh.rotation.x *= 0.9; p.mesh.rotation.z *= 0.9; }
      p.mesh.position.copy(p.pos);
      if (plane && pl.isOutside(p.pos)) this.toWorld(p);
    }
    this.list = this.list.filter((p) => { if (p.frame === 'world' && p.pos.distanceTo(SKY.Game.camPos) > 3000) { this.scene.remove(p.mesh); return false; } return true; });
  },
  // world-frame prop (food trays from stands / restaurants)
  makeWorld(kind, x, y, z, extra) {
    const p = this.make(kind, 0, 0, 0, extra); if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    p.frame = 'world'; p.pos.set(x, y, z); p.mesh.position.copy(p.pos); this.scene.add(p.mesh); return p;
  },
  // carry a world prop into the cabin (boarding with a tray in hand)
  toPlane(p, lx, ly, lz) {
    if (p.mesh.parent) p.mesh.parent.remove(p.mesh); p.frame = 'plane'; p.pos.set(lx, ly, lz); p.vel.set(0, 0, 0); p.mesh.position.copy(p.pos); this.plane.interior.add(p.mesh);
  },
  toWorld(p) {
    const pl = this.plane; const wv = pl.dirToWorld(p.vel).add(pl.pointVel(p.pos));
    pl.toWorld(p.pos, p.pos); p.vel.copy(wv); p.frame = 'world';
    pl.interior.remove(p.mesh); this.scene.add(p.mesh); p.mesh.position.copy(p.pos);
  },
};

// ---------------------------------------------------------------- meals
const INGREDIENTS = [
  { n: 'Chicken', e: '🍗', bad: false }, { n: 'Pasta', e: '🍝', bad: false }, { n: 'Rice', e: '🍚', bad: false }, { n: 'Veggies', e: '🥦', bad: false },
  { n: 'Cheese', e: '🧀', bad: false }, { n: 'Bread', e: '🥖', bad: false }, { n: 'Tomato', e: '🍅', bad: false }, { n: 'Omelette', e: '🍳', bad: false },
  { n: 'Mystery Fish (EXP 2019)', e: '🐟', bad: true }, { n: 'Old Yogurt (puffy lid)', e: '🥛', bad: true }, { n: 'Warm Egg Salad', e: '🥚', bad: true }, { n: 'Fuzzy Sandwich', e: '🥪', bad: true },
];
SKY.INGREDIENTS = INGREDIENTS;
function makeMeal(oven) {
  const t = oven.t; const ing = oven.ing; let q, heal, spoiled = oven.spoiled, color = 0xffaa55;
  if (t < 4) { q = 'RAW'; heal = 0; spoiled = true; color = 0xffd0c0; }
  else if (t < 7) { q = 'Underdone'; heal = 15; color = 0xffc080; }
  else if (t <= 10.5) { q = 'PERFECT'; heal = 50; color = 0xff9a3c; }
  else { q = 'Burnt'; heal = 5; color = 0x3a2a1a; }
  if (spoiled) { heal = 0; color = 0x9acd32; }
  const name = ing.map((i) => i.n.split(' (')[0]).join(' & ');
  return { name, q, heal, spoiled, color, emoji: ing.map((i) => i.e).join('') };
}

// ---------------------------------------------------------------- player
const P = SKY.Player = {
  init(plane, scene, fxWorld, camera) {
    this.plane = plane; this.scene = scene; this.fxWorld = fxWorld; this.camera = camera;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.eye = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, -1);
    this.body = new SKY.Person('pax', 'plane'); this.body.role = 'player'; this.body.name = 'You'; this.body.shirt = 0xff6a1a; this.body.hair = 0x222222;
    // view model
    this.vm = new THREE.Group(); camera.add(this.vm); this.vm.position.set(0.3, -0.26, -0.55); this.vm.scale.setScalar(0.6);
    const mk = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); return m; };
    this.vmTools = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    this.vmTools[0].add(mk(0.12, 0.12, 0.16, 0xe0ac69, 0, 0, 0)); this.vmTools[0].add(mk(0.12, 0.1, 0.3, 0xff6a1a, 0, -0.02, 0.2));
    this.vmTools[1].add(mk(0.04, 0.04, 0.42, 0x8b5a2b, 0, 0, 0)); this.vmTools[1].add(mk(0.08, 0.16, 0.08, 0x666666, 0, 0.04, -0.21));
    this.vmTools[2].add(mk(0.035, 0.035, 0.6, 0x3355aa, 0, 0, 0)); this.vmTools[2].add(mk(0.035, 0.14, 0.035, 0x3355aa, 0, 0.06, -0.3));
    for (const t of this.vmTools) { t.rotation.x = -0.5; this.vm.add(t); }
    this.vmHeld = new THREE.Group(); this.vm.add(this.vmHeld);
    this.swing = 0;
  },
  reset(mode) {
    const pl = this.plane;
    this.frame = 'plane'; this.vel.set(0, 0, 0); this.hp = 100; this.o2 = 100; this.masked = false; this.woozy = 0; this.tool = 0; this.held = null;
    this.toolCD = 0; this.sprayT = 0; this.camMode = 'fp'; this.chute = false; this.airT = 0; this.maxFall = 0; this.dead = null; this.yaw = 0; this.pitch = 0; this.pilotCam = 'chase';
    this.seat = null; this.grounded = true; this.target = null; this.lastSafe = new THREE.Vector3();
    if (mode === 'pilot') { this.sitPilot(pl.seats.find((s) => s.captain)); }
    else { const s = pl.seats.filter((s) => !s.cockpit && !s.occupant)[0]; if (s) this.sitSeat(s); else { this.mode = 'foot'; this.pos.set(0, 0.01, 0); } }
  },
  sitSeat(s) { this.leaveSeat(); this.seat = s; s.occupant = this; this.mode = 'seat'; this.pos.set(s.x, 0, s.z); this.vel.set(0, 0, 0); this.yaw = 0; this.pitch = 0; },
  sitPilot(s) { this.leaveSeat(); this.seat = s; s.occupant = this; this.mode = 'pilot'; this.pos.set(s.x, 0, s.z); this.vel.set(0, 0, 0); this.yaw = 0; this.pitch = -0.05; this.plane.ap.on = false; SKY.toast('🧑‍✈️ You have the controls', 'good'); },
  leaveSeat() {
    if (this.seat) { if (this.seat.occupant === this) this.seat.occupant = null; const s = this.seat; this.seat = null; this.mode = 'foot'; this.pos.set(s.cockpit ? 0 : 0, 0.02, s.cockpit ? s.z + 0.5 : s.z); this.vel.set(0, 0, 0); if (s.cockpit && this.plane.ap.on) SKY.toast('Autopilot holding course', ''); }
    this.mode = this.mode === 'pilot' || this.mode === 'seat' ? 'foot' : this.mode;
  },
  isMe(seat) { return this.seat === seat; },
  solid(x, y, z) {
    if (this.frame === 'plane') return this.plane.solidLocal(x, y, z);
    const W = SKY.World; if (y < W.heightAt(x, z)) return true; if (W.solidAt(x, y, z)) return true;
    if (SKY.Places && SKY.Places.solid(x, y, z)) return true;
    return false;
  },
  bodyHit(pos) {
    const hw = 0.22;
    for (const h of [0.03, 0.42, 0.85, 1.25, 1.66]) for (const sx of [-hw, hw]) for (const sz of [-hw, hw]) if (this.solid(pos.x + sx, pos.y + h, pos.z + sz)) return true;
    return false;
  },
  gravity() { return this.frame === 'plane' ? this.plane.gLocal : _v3.set(0, -SKY.GRAV, 0); },
  // ------------------------------------------------------------ update
  update(dt, I) {
    const pl = this.plane, G = SKY.Game;
    if (this.dead) return;
    this.toolCD -= dt; this.swing = Math.max(0, this.swing - dt * 4);
    if (this.woozy > 0) this.woozy -= dt;
    // look
    const sens = SKY.isTouch ? 0.0045 : 0.0023;
    if (this.mode === 'drive') { G.camOrbit.yaw -= I.look.dx * sens; G.camOrbit.pitch = clamp(G.camOrbit.pitch - I.look.dy * sens, -0.5, 0.7); if (I.look.dx || I.look.dy) G.camOrbit.t = 2.5; }
    else if (this.mode === 'pilot' && this.pilotCam === 'chase') { G.camOrbit.yaw -= I.look.dx * sens; G.camOrbit.pitch = clamp(G.camOrbit.pitch - I.look.dy * sens, -0.9, 0.7); if (I.look.dx || I.look.dy) G.camOrbit.t = 2.5; }
    else { this.yaw -= I.look.dx * sens; this.pitch = clamp(this.pitch - I.look.dy * sens, -1.5, 1.5); }
    I.look.dx = 0; I.look.dy = 0;
    // 3.5: driving a car (look = orbit the chase camera, handled in updateCamera)
    if (this.mode === 'drive') { SKY.Cars.drive(dt, I); this.target = null; this.computeView(); this.vitals(dt); for (let i = 0; i < 3; i++) this.vmTools[i].visible = false; this.vmHeld.visible = false; return; }
    if (this.woozy > 0) { this.yaw += Math.sin(performance.now() * 0.002) * 0.004; }
    // tools
    if (I.edge('tool1')) this.setTool(0); if (I.edge('tool2')) this.setTool(1); if (I.edge('tool3')) this.setTool(2);
    if (I.edge('toolNext')) this.setTool((this.tool + 1) % 3);
    if (I.edge('cam')) { if (this.mode === 'pilot') { this.pilotCam = this.pilotCam === 'chase' ? 'cockpit' : 'chase'; this.yaw = 0; this.pitch = -0.05; } else this.camMode = this.camMode === 'fp' ? 'tp' : 'fp'; }
    // mode logic
    if (this.mode === 'pilot') this.updatePilot(dt, I);
    else if (this.mode === 'seat') { if (I.edge('jump')) this.leaveSeat(); this.seatedChecks(dt); }
    else this.updateFoot(dt, I);
    this.computeView();
    this.updateHeld(dt);
    if (this.mode !== 'pilot') { this.updateTarget(); if (I.edge('interact') && this.target) this.target.act(); else if (I.edge('interact') && this.held && this.held.kind === 'tray') this.eatHeld(); }
    else if (I.edge('interact')) { this.leaveSeat(); SKY.toast('You left the seat'); }
    if (this.mode !== 'pilot') {
      if (this.held && this.held.kind === 'ext' && I.hold('action')) this.spray(dt);
      else if (I.edge('action') || (I.hold('action') && this.toolCD <= 0 && this.tool > 0)) this.useTool();
      if (I.edge('grab')) this.grab();
      if (I.edge('drop') && this.held) this.dropHeld();
    }
    this.vitals(dt);
    // view model
    for (let i = 0; i < 3; i++) this.vmTools[i].visible = !this.held && this.tool === i && this.mode !== 'pilot' && this.camMode === 'fp' && !(this.mode === 'pilot');
    this.vmHeld.visible = !!this.held && this.camMode === 'fp';
    const sw = Math.sin(this.swing * Math.PI);
    this.vm.rotation.x = -sw * 1.0; this.vm.position.z = -0.55 - sw * 0.15;
  },
  setTool(i) { this.tool = i; SKY.Audio.play('beep'); },
  updatePilot(dt, I) {
    const pl = this.plane;
    if (SKY.AutoLand) SKY.AutoLand.checkInput(I); // any flight input cancels auto-land
    const TG = SKY.TaxiGate; if (TG) TG.checkInput(I); // 3.5.1: any throttle / steering input cancels taxi-to-gate
    const inv = SKY.Game.settings.invert ? -1 : 1;
    const ctl = { pitch: -I.move.y * inv, roll: I.move.x, yaw: (I.hold('yawR') ? 1 : 0) - (I.hold('yawL') ? 1 : 0) };
    if (I.throttleAbs !== null) { pl.throttle = I.throttleAbs; I.throttleAbs = null; }
    if (I.hold('thrUp')) pl.throttle = clamp(pl.throttle + dt * 0.5, 0, 1);
    if (I.hold('thrDown')) pl.throttle = clamp(pl.throttle - dt * 0.5, 0, 1);
    if (I.edge('gKey') && TG && TG.wantsKey()) I.edges.taxigate = true; // desktop G on the ground = TAXI TO GATE (gear stays down)
    else if (I.edge('gear')) { if (!pl.gearBroken) { pl.gearDown = !pl.gearDown; SKY.toast('Gear ' + (pl.gearDown ? 'DOWN' : 'UP')); } }
    if (I.edge('flaps')) { pl.flaps = (pl.flaps + 1) % 3; SKY.toast('Flaps ' + pl.flaps); }
    if (I.edge('ap') && !pl.ap.on && pl.onGround && SKY.Airport && SKY.Airport.groundAP(pl)) { /* ground autopilot: auto-taxi / pushback / takeoff */ }
    else if (I.edge('ap')) { if (pl.ap.on && SKY.Airport) SKY.Airport.taxi = null; pl.ap.on = !pl.ap.on; if (pl.ap.on) { pl.ap.alt = Math.max(pl.pos.y, 400); pl.ap.hdg = pl.heading() * Math.PI / 180; pl.ap.dest = null; pl.ap.mode = 'cruise'; pl.ap.by = 'player'; } SKY.toast('Autopilot ' + (pl.ap.on ? 'ON (holding alt/hdg)' : 'OFF')); }
    pl.brake = I.hold('brake');
    if (pl.ap.on && (Math.abs(ctl.pitch) > 0.3 || Math.abs(ctl.roll) > 0.3)) { pl.ap.on = false; SKY.toast('Autopilot disengaged'); }
    this.ctl = pl.ap.on ? null : ctl;
    if (I.edge('jump') && pl.onGround && pl.speed() < 3) this.leaveSeat();
    this.seatedChecks(dt);
  },
  seatedChecks(dt) {
    const pl = this.plane; const k = pl.kick.length();
    if (k > 8) this.hurt((k - 7) * 2, 'crash');
    if (this.seat && !pl.grid.solid(this.seat.x, 0.2, this.seat.z) && !this.seat.cockpit) { this.leaveSeat(); }
  },
  updateFoot(dt, I) {
    const pl = this.plane, g = this.gravity();
    // movement dir in frame coords
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const mx = I.move.x, my = I.move.y;
    // 3.5 RUN: hold Shift / the RUN button (or tap it to toggle); lenient stamina so it never gets annoying
    if (I.edge('runToggle')) { I.runOn = !I.runOn; SKY.Audio.play('beep'); }
    if (this.stam == null) this.stam = 100;
    const moving = Math.abs(mx) + Math.abs(my) > 0.2;
    const wantRun = (I.hold('run') || I.runOn) && moving && !this.chute;
    if (this.winded && this.stam > 35) this.winded = false;
    this.running = wantRun && !this.winded && this.woozy <= 0;
    if (this.running) { this.stam = Math.max(0, this.stam - 7 * dt); if (this.stam <= 0) { this.winded = true; SKY.toast('😮‍💨 Out of breath — walk for a moment', ''); } this.runT = (this.runT || 0) + dt; if (this.runT > 4 && SKY.Game.achieve) SKY.Game.achieve('sprinter'); }
    else this.stam = Math.min(100, this.stam + (moving ? 18 : 30) * dt);
    const speed = (this.woozy > 0 ? 2.2 : 3.6) * (this.running ? 1.9 : 1);
    let wx = (cy * mx - sy * my) * speed, wz = (-sy * mx - cy * my) * speed;
    if (this.woozy > 0) { wx += Math.sin(performance.now() * 0.003) * 0.8; }
    const inChute = this.frame === 'world' && this.chute;
    const grip = 1 / (1 + (this.sucMag || 0) * 0.6);
    if (this.grounded) { const k = Math.min(1, 12 * dt * grip); this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k; }
    else { const k = Math.min(1, (inChute ? 1.2 : 1.5) * dt); this.vel.x += (wx * (inChute ? 3 : 0.4) - this.vel.x) * k * 0.5; this.vel.z += (wz * (inChute ? 3 : 0.4) - this.vel.z) * k * 0.5; }
    this.vel.addScaledVector(g, dt);
    if (this.frame === 'plane') {
      this.vel.add(pl.kick);
      const suc = pl.suction(_v.set(this.pos.x, this.pos.y + 0.9, this.pos.z), new THREE.Vector3());
      this.vel.addScaledVector(suc, dt * (this.grounded ? 1.0 : 1.3));
      this.sucMag = suc.length();
      // fire damage
      for (const f of pl.fires) if (!f.ext && Math.hypot(f.x - this.pos.x, f.y - this.pos.y - 1, f.z - this.pos.z) < 1.3) this.hurt(10 * dt, 'fire');
    } else {
      // air drag / parachute
      const sp = this.vel.length();
      if (!this.grounded) { const c = this.chute ? 0.3 : 0.0039; const dr = Math.min(sp, c * sp * sp * dt); if (sp > 0) this.vel.multiplyScalar(1 - dr / sp); }
    }
    if (I.edge('jump')) {
      if (this.grounded) { const up = this.frame === 'plane' ? 1 : 1; this.vel.y = 4.6 * up; this.grounded = false; }
      else if (this.frame === 'world' && !this.chute && this.altAboveGround() > 25) { this.chute = true; SKY.Audio.play('pop'); SKY.toast('🪂 Parachute deployed!', 'good'); }
    }
    // integrate with collisions (axis separated)
    const spd = this.vel.length(); if (spd > 90) this.vel.setLength(90);
    const steps = Math.ceil(spd * dt / 0.3) || 1, sdt = dt / steps;
    let impact = 0; this.grounded = false;
    for (let s = 0; s < steps; s++) for (const ax of ['x', 'z', 'y']) {
      const d = this.vel[ax] * sdt; if (!d) continue;
      _v.copy(this.pos); _v[ax] += d;
      if (!this.bodyHit(_v)) { this.pos[ax] = _v[ax]; continue; }
      if (ax !== 'y' && this.frame !== 'none') { // step up
        _v.y += this.frame === 'world' ? 0.55 : 0.45; if (!this.bodyHit(_v) && this.vel.y <= 0.5) { this.pos.copy(_v); continue; }
      }
      impact = Math.max(impact, Math.abs(this.vel[ax]));
      if (ax === 'y' && this.vel.y < 0) this.grounded = true;
      this.vel[ax] = 0;
    }
    if (this.frame === 'world') { const h = Math.max(SKY.World.heightAt(this.pos.x, this.pos.z), SKY.Places ? SKY.Places.groundAt(this.pos.x, this.pos.y + 0.3, this.pos.z) : -1e9); if (this.pos.y < h) { impact = Math.max(impact, -this.vel.y); this.pos.y = h; this.vel.y = 0; this.grounded = true; } }
    if (this.grounded && this.frame === 'world') { if (this.chute) { this.chute = false; SKY.toast('Landed safely! 🙌', 'good'); impact = Math.min(impact, 3); } }
    const lim = this.frame === 'world' ? 13 : 9;
    if (impact > lim) this.hurt((impact - lim) * (this.frame === 'world' ? 6 : 5), impact > 30 ? 'splat' : 'impact');
    // left the plane?
    if (this.frame === 'plane' && pl.isOutside(this.pos.clone().setY(this.pos.y + 0.9))) this.toWorld();
    if (this.frame === 'world' && this.pos.y < -50) this.pos.y = 5;
    // walked back through an open L1 door (e.g. from the jet bridge) → reboard
    if (this.frame === 'world' && !pl.crashed && pl.speed() < 2) {
      const D = C().DOOR_L1, door = pl.cabinDoors.find((d) => d.D === D);
      if (door && door.open > 0.5) { const lp = pl.toLocal(this.pos, new THREE.Vector3()); if (lp.x > -2.65 && lp.x < -1.3 && lp.z > D.z0 - 0.4 && lp.z < D.z1 + 0.4 && lp.y > -0.7 && lp.y < 1.2) this.board(); }
    }
  },
  altAboveGround() { return this.pos.y - Math.max(SKY.World.heightAt(this.pos.x, this.pos.z), SKY.Places ? SKY.Places.groundAt(this.pos.x, this.pos.y, this.pos.z) : -1e9); },
  toWorld() {
    const pl = this.plane;
    if (this.held && this.held.kind) { this.held.held = false; Props.toWorld(this.held); this.held = null; }
    const wv = pl.dirToWorld(this.vel).add(pl.pointVel(this.pos));
    const look = new THREE.Vector3(0, 0, -1).applyEuler(_e.set(0, this.yaw, 0)); pl.dirToWorld(look, look);
    pl.toWorld(this.pos, this.pos); this.vel.copy(wv); this.frame = 'world'; this.yaw = Math.atan2(-look.x, -look.z); this.pitch = 0; this.masked = false;
    this.airT = 0;
    const agl = this.altAboveGround();
    if (agl > 20) { SKY.toast('😱 You fell out of the plane! Press JUMP to open your parachute!', 'bad'); SKY.Audio.play('woosh'); }
    SKY.Game.onPlayerExit();
  },
  board() { // enter plane from ground
    const pl = this.plane; this.frame = 'plane'; this.mode = 'foot'; this.chute = false;
    const D = C().DOOR_L1; this.pos.set(-1.0, 0.05, (D.z0 + D.z1) / 2); this.vel.set(0, 0, 0); this.yaw = -Math.PI / 2; this.pitch = 0;
    const h = this.held; if (h && !h.person && h.frame === 'world') { Props.toPlane(h, -1.0, 1.0, (D.z0 + D.z1) / 2); if (h.meal) SKY.toast('🥡 You brought ' + h.meal.emoji + ' ' + h.meal.name + ' aboard — serve it to someone or eat it yourself.', 'good'); }
    SKY.toast('Boarded the plane', 'good');
  },
  hurt(n, cause) {
    if (this.dead || n <= 0) return; this.hp -= n; this.lastCause = cause; SKY.Game.flash(n);
    if (this.hp <= 0) { this.hp = 0; this.dead = cause || 'impact'; SKY.Game.onPlayerDown(this.dead); }
  },
  vitals(dt) {
    const pl = this.plane;
    if (this.frame === 'plane') {
      // mask: must stay near a dropped mask
      if (this.masked) { const ms = this.nearestMask(); if (!ms || ms.d > 1.1) { this.masked = false; SKY.toast('The mask tube pulled off!'); } }
      if (pl.pressure < 0.9 && !this.masked && !(this.mode === 'pilot')) this.o2 -= (0.95 - pl.pressure) * 8 * dt;
      else if (pl.pressure < 0.9 && this.mode === 'pilot' && !this.masked) { this.o2 -= (0.95 - pl.pressure) * 2 * dt; if (pl.masksDown && this.o2 < 99 && !this.pilotMaskTold) { this.pilotMaskTold = true; SKY.toast('😷 Crew oxygen mask donned automatically in the pilot seat'); } this.masked = true; }
      else this.o2 = Math.min(100, this.o2 + 12 * dt);
    } else this.o2 = Math.min(100, this.o2 + 12 * dt);
    if (this.o2 <= 0) { this.o2 = 0; this.hurt(999, 'hypoxia'); }
    if (this.hp < 100 && this.hp > 0) this.hp = Math.min(100, this.hp + dt * 0.4);
  },
  nearestMask() {
    const pl = this.plane; if (!pl.masksDown) return null; let best = null, bd = 9;
    const hx = this.pos.x, hy = this.pos.y + (this.mode === 'seat' ? 1.1 : 1.6), hz = this.pos.z;
    for (const s of pl.seats) { if (!s.maskPos || (s.occupant && s.occupant !== this && s.occupant.masked)) continue; const d = Math.hypot(s.maskPos.x - hx, s.maskPos.y - hy, s.maskPos.z - hz); if (d < bd) { bd = d; best = s; } }
    return best ? { s: best, d: bd } : null;
  },
  computeView() {
    // eye + dir in current frame coords
    let eh = 1.6;
    if (this.mode === 'seat') eh = 1.12; else if (this.mode === 'pilot') eh = 1.25;
    this.eye.set(this.pos.x, this.pos.y + eh, this.pos.z);
    if (this.mode === 'seat' || this.mode === 'pilot') this.eye.z -= 0.08;
    _e.set(this.pitch, this.yaw, 0); this.dir.set(0, 0, -1).applyEuler(_e);
  },
  // ------------------------------------------------------------ targeting / tools
  pick(range, wantVoxel) {
    const o = this.eye, d = this.dir; let best = null;
    const consider = (t, obj) => { if (t >= 0 && t <= range && (!best || t < best.t)) best = { t, ...obj }; };
    const plane = this.frame === 'plane';
    for (const p of SKY.Crowd.list) {
      if ((p.frame === 'plane') !== plane) continue;
      for (const pt of p.pts) { _v.subVectors(pt.p, o); const t = _v.dot(d); if (t < 0 || t > range) continue; const dist = _v.addScaledVector(d, -t).length(); if (dist < 0.28) consider(t, { type: 'person', obj: p }); }
    }
    for (const pr of Props.list) { if (pr.held || (pr.frame === 'plane') !== plane) continue; _v.subVectors(pr.pos, o); const t = _v.dot(d); const dist = _v.addScaledVector(d, -t).length(); if (dist < Math.max(0.22, pr.half.length())) consider(t, { type: 'prop', obj: pr }); }
    if (plane) {
      const pl = this.plane, cd = pl.cockpitDoor, cz = C().COCK_Z;
      if (!cd.broken && cd.open < 0.5 && Math.abs(d.z) > 1e-4) { const zp = o.z > cz ? cz + 0.12 : cz - 0.12; const t = (zp - o.z) / d.z; const hx = o.x + d.x * t, hy = o.y + d.y * t; if (t > 0 && Math.abs(hx) < 0.42 && hy > 0 && hy < 2.05) consider(t, { type: 'door' }); }
      const h = pl.grid.raycast(o, d, range); if (h) consider(h.dist, { type: 'voxel', id: h.id, n: new THREE.Vector3(h.nx, h.ny, h.nz) });
    } else {
      const h = SKY.World.segmentHit(o, _v2.copy(o).addScaledVector(d, range)); if (h) consider(h.dist, { type: 'wvoxel', hit: h });
      const lo = this.plane.toLocal(o), ld = this.plane.dirToLocal(d); const ph = this.plane.grid.raycast(lo, ld, range); if (ph) consider(ph.dist, { type: 'pvoxel', id: ph.id });
    }
    return best;
  },
  useTool() {
    if (this.toolCD > 0) return;
    const T = TOOLS[this.tool]; this.toolCD = T.cd; this.swing = 1;
    if (this.held) { if (this.held.kind !== 'ext') { this.throwHeld(6); } return; }
    const h = this.pick(T.range); if (!h) { SKY.Audio.play('woosh'); return; }
    const pl = this.plane; const plane = this.frame === 'plane';
    if (h.type === 'person') {
      const p = h.obj; const dmg = T.ppl;
      p.hurt(dmg, 'player'); if (p.conscious || p.state === 'rag') p.knock(_v.copy(this.dir).setY(Math.max(0.15, this.dir.y)).multiplyScalar(T.push));
      SKY.Audio.play(this.tool === 0 ? 'hit' : 'bonk');
      if (p.conscious && p.role === 'crew') p.talk('Sir! Calm down!', 2);
      SKY.Game.stats.hits++;
    } else if (h.type === 'prop') {
      h.obj.vel.addScaledVector(this.dir, T.push * 2 / h.obj.mass); h.obj.mounted = false; SKY.Audio.play('hit');
    } else if (h.type === 'door') {
      const cd = pl.cockpitDoor; pl.hitCockpitDoor(T.door); SKY.Audio.play(this.tool === 0 ? 'hit' : 'clang'); SKY.Game.shake(0.05);
      SKY.Game.onDoorBash(cd);
    } else if (h.type === 'voxel') {
      const c = pl.grid.center(h.id, new THREE.Vector3()); const m = pl.grid.mat[h.id];
      const rem = pl.damage(c, 0.22, T.vox, null, true);
      SKY.Audio.play(rem.length ? 'crunch' : (m === SKY.MAT.BULK ? 'clang' : 'hit'), rem.length ? 0.6 : 1);
      if (!rem.length) for (let q = 0; q < 3; q++) pl.fxLocal.chip.spawn(c.x + h.n.x * 0.2, c.y + h.n.y * 0.2, c.z + h.n.z * 0.2, rand(-1, 1), rand(0, 2), rand(-1, 1), 0.6, 0.05, 0xffee88);
      if (m === SKY.MAT.BULK && !rem.length && Math.random() < 0.3) SKY.toast('Reinforced bulkhead! Try the door (or a keycode).');
    } else if (h.type === 'wvoxel') {
      const s = h.hit.st; const c = h.hit.point.clone().addScaledVector(this.dir, s.grid.s * 0.3);
      const n = SKY.World.damage(c, s.grid.s * 0.55, T.vox * 1.5, null, this.fxWorld);
      SKY.Audio.play(n ? 'crunch' : 'hit', 0.7);
    } else if (h.type === 'pvoxel') {
      const c = pl.grid.center(h.id, new THREE.Vector3()); pl.damage(c, 0.22, T.vox, this.fxWorld, false); SKY.Audio.play('crunch', 0.6);
    }
  },
  spray(dt) {
    this.sprayT -= dt; if (this.sprayT > 0) return; this.sprayT = 0.05;
    const plane = this.frame === 'plane'; const fx = plane ? this.plane.fxLocal : this.fxWorld;
    const o = _v.copy(this.eye).addScaledVector(this.dir, 0.6).y -= 0.2;
    const base = plane ? new THREE.Vector3() : this.vel;
    for (let q = 0; q < 3; q++) fx.foam.spawn(_v.x, _v.y - 0.2, _v.z, base.x + this.dir.x * 9 + rand(-0.8, 0.8), base.y + this.dir.y * 9 + rand(-0.5, 0.8), base.z + this.dir.z * 9 + rand(-0.8, 0.8), rand(0.6, 1.2), rand(0.06, 0.14), 0xffffff);
    if (Math.random() < 0.3) SKY.Audio.play('spray');
    // recoil
    this.vel.addScaledVector(this.dir, this.grounded ? -0.25 : -1.2);
    // effects in a cone
    const inCone = (p, maxD) => { _v2.subVectors(p, this.eye); const d = _v2.length(); return d < maxD && _v2.dot(this.dir) / (d || 1) > 0.85; };
    if (plane) {
      const pl = this.plane;
      for (const f of pl.fires) if (inCone(_v3.set(f.x, f.y, f.z), 4.5)) { f.hp -= 0.12; if (f.hp <= 0) { SKY.toast('🧯 Fire extinguished!', 'good'); SKY.Game.achieve('firefighter'); } }
      const cz = C().COCK_Z; const cd = pl.cockpitDoor;
      if (!cd.broken && inCone(_v3.set(0, 1, cz), 1.6) && Math.random() < 0.12) { pl.hitCockpitDoor(2.5); SKY.Audio.play('clang'); SKY.Game.onDoorBash(cd); }
    }
    for (const p of SKY.Crowd.list) if ((p.frame === 'plane') === plane && inCone(p.pts[1].p, 4)) { if (p.state === 'rag') for (const pt of p.pts) pt.o.addScaledVector(this.dir, -0.012); else if (Math.random() < 0.05) { p.talk('Pfff! Hey!', 1.5); if (Math.random() < 0.3) p.knock(this.dir.clone().multiplyScalar(1.5)); } }
    for (const pr of Props.list) if (!pr.held && (pr.frame === 'plane') === plane && inCone(pr.pos, 4)) { pr.vel.addScaledVector(this.dir, 0.5 / pr.mass); pr.mounted = false; }
  },
  grab() {
    if (this.held) { this.throwHeld(11); return; }
    const h = this.pick(2.8);
    if (!h) return;
    if (h.type === 'prop') { const p = h.obj; p.held = true; p.mounted = false; this.held = p; this.setHeldVM(); SKY.Audio.play('pop'); if (p.kind === 'ext') SKY.toast('🧯 Fire extinguisher: hold ACTION to spray', ''); }
    else if (h.type === 'person') { const p = h.obj; if (p.state !== 'rag') p.knock(null); p.grabbed = true; this.held = { person: p }; this.setHeldVM(); SKY.Audio.play('pop'); if (p.conscious) p.talk('Put me down!!', 2); }
  },
  setHeldVM() {
    while (this.vmHeld.children.length) this.vmHeld.remove(this.vmHeld.children[0]);
    if (this.held && this.held.mesh) { const c = this.held.mesh.clone(); c.position.set(-0.1, 0.05, -0.15); c.rotation.set(0, 0, 0); this.vmHeld.add(c); }
  },
  updateHeld(dt) {
    const h = this.held; if (!h) return;
    const target = _v.copy(this.eye).addScaledVector(this.dir, h.person ? 1.3 : 0.9);
    if (h.person) {
      const p = h.person; if (p.frame !== this.frame || p.state !== 'rag') { p.grabbed = false; this.held = null; return; }
      const nk = p.pts[1]; nk.p.lerp(target, 0.5);
    } else {
      if (h.frame !== this.frame) { h.held = false; this.held = null; return; }
      target.y -= 0.25; h.vel.subVectors(target, h.pos).divideScalar(Math.max(dt, 1e-3)); h.pos.copy(target);
      h.mesh.visible = this.camMode !== 'fp'; h.mesh.rotation.set(0, this.yaw, 0);
    }
  },
  throwHeld(sp) {
    const h = this.held; if (!h) return; this.held = null; this.setHeldVM();
    if (h.person) { h.person.grabbed = false; for (const pt of h.person.pts) pt.o.addScaledVector(this.dir, -sp * 0.6 * SKY.DT); SKY.Audio.play('woosh'); h.person.talk('WAAAH!', 1.5); }
    else { h.held = false; h.mesh.visible = true; h.vel.copy(this.dir).multiplyScalar(sp / h.mass); SKY.Audio.play('woosh'); }
  },
  dropHeld() { const h = this.held; if (!h) return; this.held = null; this.setHeldVM(); if (h.person) h.person.grabbed = false; else { h.held = false; h.mesh.visible = true; h.vel.set(0, 0, 0); } },
  eatHeld() {
    const h = this.held; if (!h || !h.meal) return; const m = h.meal;
    this.dropHeld(); Props.list = Props.list.filter((p) => p !== h); if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
    SKY.Audio.play('eat');
    if (m.spoiled) { this.woozy = 25; SKY.toast('🤢 Ugh... that was spoiled. You feel woozy.', 'bad'); }
    else { this.hp = Math.min(100, this.hp + m.heal); SKY.toast('😋 ' + m.q + ' ' + m.name + ' (+' + m.heal + ' HP)', 'good'); }
  },
  // ------------------------------------------------------------ interaction targets
  updateTarget() {
    const cands = [];
    const add = (pos, r, label, act) => { if (!label) return; _v.subVectors(pos, this.eye); const d = _v.length(); if (d > r) return; const t = _v.dot(this.dir); const perp = Math.sqrt(Math.max(0, d * d - t * t)); if (t < -0.2 && d > 0.8) return; cands.push({ score: perp + d * 0.25 + (t < 0 ? 1 : 0), label, act }); };
    const pl = this.plane, G = SKY.Game, Cn = C();
    const addP = (prio, ...a) => { const n = cands.length; add(...a); if (cands.length > n) cands[n].prio = prio; };
    if (this.mode === 'seat') add(this.eye.clone().add(this.dir), 2, 'Stand up', () => this.leaveSeat());
    if (this.frame === 'plane') {
      const cz = Cn.COCK_Z;
      // seats
      for (const s of pl.seats) {
        if (Math.abs(s.z - this.pos.z) > 1.6) continue;
        const sp = new THREE.Vector3(s.x, 0.6, s.z);
        if (s.cockpit) {
          const occ = s.occupant;
          if (occ === this) continue;
          if (!occ) add(sp, 1.8, 'Take the controls (' + (s.captain ? 'Captain' : 'First Officer') + ' seat)', () => this.sitPilot(s));
          else if (occ.conscious) add(sp, 1.8, 'Ask ' + occ.name + ' to let you fly', () => { occ.refuse++; if (occ.refuse < 3) { occ.talk(choose(['Absolutely not!', 'Please return to your seat.', 'Not a chance, pal.', 'Who let you in here?!']), 2.5); SKY.Audio.play('error'); } else { occ.talk('FINE. Your airplane! 🙄', 3); occ.leaveSeat(); occ.state = 'idle'; occ.pos.set(0.2, 0, -12.7); occ.t = 999; occ.pose(0, true); this.sitPilot(s); } });
          else add(sp, 1.8, 'Move ' + occ.name + ' and take the seat', () => { occ.leaveSeat(); occ.state = 'rag'; for (const pt of occ.pts) pt.o.copy(pt.p); occ.pts.forEach((pt) => pt.p.x += 0.5); this.sitPilot(s); });
        } else if (!s.occupant) add(sp, 1.2, 'Sit down', () => this.sitSeat(s));
      }
      // cockpit door
      const cd = pl.cockpitDoor;
      if (!cd.broken) {
        const cabinSide = this.pos.z > cz;
        const dp = new THREE.Vector3(cabinSide ? 0.5 : 0, 1.1, cz);
        if (cabinSide && cd.locked) add(dp, 1.7, cd.lockout > 0 ? 'Keypad locked (' + Math.ceil(cd.lockout) + 's)' : 'Use cockpit keypad', () => { if (cd.lockout <= 0) G.openKeypad(); });
        else add(dp, 1.7, cd.target > 0.5 ? 'Close cockpit door' : (cabinSide ? 'Open cockpit door' : 'Open cockpit door (from inside)'), () => { cd.target = cd.target > 0.5 ? 0 : 1; cd.autoClose = 0; if (!cabinSide) cd.locked = false; SKY.Audio.play('beep'); });
        if (!cabinSide && cd.target < 0.5 && !cd.locked) add(new THREE.Vector3(0, 1.4, cz), 1.7, 'Lock cockpit door', () => { cd.locked = true; SKY.toast('Door locked'); });
      }
      // cabin doors
      for (const d of pl.cabinDoors) {
        const dp = new THREE.Vector3(-1.9, 1.1, d.zc);
        const flying = !pl.onGround || pl.speed() > 5;
        if (d.target < 0.5) add(dp, 1.6, d.arm > 0 ? '⚠ FORCE the ' + d.name + ' door open!' : (flying && pl.pressure > 0.9 && SKY.toFeet(pl.pos.y) > 9000 ? 'Open ' + d.name + ' door (pressurized!)' : 'Open ' + d.name + ' door'), () => {
          if (flying && d.arm <= 0 && pl.pressure > 0.9 && SKY.toFeet(pl.pos.y) > 9000) { d.arm = 3; SKY.toast('⚠ The cabin is pressurized! Press INTERACT again to force it.', 'warn'); SKY.Audio.play('error'); return; }
          d.target = 1; SKY.Audio.play('woosh'); if (flying) SKY.Game.achieve('door');
        });
        else add(dp, 1.6, 'Close ' + d.name + ' door', () => { d.target = 0; SKY.Audio.play('beep'); });
      }
      // oven
      const ov = pl.oven; const op = new THREE.Vector3(1.2, 1.1, Cn.czK(59) + 0.2);
      if (ov.state === 'idle') add(op, 1.6, '🍳 Cook a meal (galley oven)', () => G.openCook());
      else if (ov.state === 'cooking') add(op, 1.6, '🍽 Take meal out (' + ov.t.toFixed(1) + 's)', () => this.takeMeal());
      // drawer / lav
      add(new THREE.Vector3(1.0, 0.6, Cn.czK(61) + 0.2), 1.4, 'Search galley drawer', () => this.search('drawer'));
      add(new THREE.Vector3(-1.4, 1.1, Cn.czK(63)), 1.4, 'Search lavatory cabinet', () => this.search('lav'));
      // extinguisher
      if (Props.ext && Props.ext.mounted) add(Props.ext.pos, 1.6, '🧯 Take fire extinguisher', () => { const p = Props.ext; p.mounted = false; p.held = true; if (this.held) this.dropHeld(); this.held = p; this.setHeldVM(); SKY.toast('🧯 Hold ACTION to spray', ''); });
      // masks
      if (pl.masksDown) { const ms = this.nearestMask(); if (ms && ms.d < 1.0) addP(this.masked ? 0 : 3, ms.s.maskPos, 1.6, this.masked ? 'Remove oxygen mask' : '😷 Put on oxygen mask', () => { this.masked = !this.masked; SKY.Audio.play('pop'); if (this.masked) SKY.toast('Mask on. Breathe normally.', 'good'); }); }
      // people
      for (const p of SKY.Crowd.list) {
        if (p.frame !== 'plane') continue;
        const hp = p.pts[0].p;
        if (Math.abs(hp.z - this.pos.z) > 2.5) continue;
        if (this.held && this.held.meal) { add(hp, 2.0, 'Serve ' + this.held.meal.emoji + ' to ' + p.name, () => this.serve(p)); continue; }
        if (p.role === 'crew' && p.lead && pl.codeSpot === 'attendant' && !pl.codeFound) { if (p.ko || p.state === 'rag') add(hp, 2.0, 'Search ' + p.name + '\'s pockets', () => this.search('attendant')); else add(hp, 2.0, 'Ask ' + p.name + ' for the cockpit code', () => { p.talk(choose(['Nice try! It stays in my pocket.', 'Absolutely not, sir.', 'The code? Never heard of it.']), 2.5); }); continue; }
        if ((p.role === 'captain' || p.role === 'fo') && p.seat && p.seat.occupant === p) continue; // the seat prompt covers seated pilots
        if (p.conscious) add(hp, 2.0, 'Talk to ' + p.name, () => this.talkTo(p));
      }
    } else {
      // world interactables
      for (const it of SKY.World.interactables) { const l = it.label(); if (l) add(it.pos, it.r, l, it.act); }
      if (SKY.Cars) for (const it of SKY.Cars.targets()) addP(0.6, it.pos, it.r, it.label(), it.act);
      if (this.plane.speed() < 3) { const dp = this.plane.toWorld(new THREE.Vector3(-2.4, 0, (C().DOOR_L1.z0 + C().DOOR_L1.z1) / 2)); const near = Math.hypot(dp.x - this.pos.x, dp.z - this.pos.z) < 7 && Math.abs(dp.y - this.pos.y) < 6; if (near) add(new THREE.Vector3(this.pos.x, this.pos.y + 1.4, this.pos.z).addScaledVector(this.dir, 1), 3, '✈ Board the plane', () => this.board()); }
    }
    for (const c of cands) if (c.prio) c.score -= c.prio;
    cands.sort((a, b) => a.score - b.score);
    this.target = cands[0] || null;
  },
  talkTo(p) {
    const lines = {
      pax: ['Are we there yet?', 'I asked for the window seat...', 'Is it true the pilot is a robot?', 'I love GROK Air!', 'Can you keep it down? I\'m napping.', 'Did you hear that noise?'],
      crew: ['The galley oven is ours, but go ahead, chef.', 'Please don\'t touch the doors.', 'Fresh meals make everyone feel better!', 'The pilots get hungry too... I usually bring them food.'],
      captain: ['Sit back and enjoy the flight!', 'I\'ve got 20,000 hours. Relax.', 'Do NOT touch anything.'],
      fo: ['Smooth air ahead.', 'Want to see the instruments? ...No.', 'I\'m starving, honestly.'],
    };
    p.talk(choose(lines[p.role] || lines.pax), 3);
  },
  search(spot) {
    const pl = this.plane;
    if (pl.codeSpot === spot && !pl.codeFound) { pl.codeFound = true; SKY.Audio.play('ok'); SKY.toast('🔑 Found a note: COCKPIT CODE ' + pl.code, 'good'); SKY.Game.achieve('code'); }
    else if (spot === 'drawer') SKY.toast(choose(['Plastic forks and a sad lemon.', 'Napkins. So many napkins.', 'A coupon for GROK Air miles.']));
    else if (spot === 'lav') SKY.toast(choose(['Tiny soaps. Smells like lavender.', 'A "No smoking" sticker.', 'Someone left a rubber duck.']));
    else SKY.toast('Just lint and a peppermint.');
  },
  takeMeal() {
    const pl = this.plane, ov = pl.oven; if (ov.state !== 'cooking') return;
    const meal = makeMeal(ov); ov.state = 'idle'; ov.ing = [];
    if (this.held) this.dropHeld();
    const tray = Props.make('tray', 1.0, 1.0, C().czK(59), { meal }); tray.held = true; this.held = tray; this.setHeldVM();
    SKY.Audio.play('ding');
    SKY.toast((meal.q === 'PERFECT' ? '⭐ ' : '') + meal.q + ' ' + meal.name + (meal.spoiled ? ' (smells... off 🤢)' : '') + ' — serve it to someone!', meal.spoiled ? 'warn' : 'good');
    if (meal.q === 'PERFECT' && !meal.spoiled) SKY.Game.achieve('chef');
  },
  serve(p) {
    const tray = this.held; if (!tray || !tray.meal) return; const meal = tray.meal;
    this.held = null; this.setHeldVM(); Props.list = Props.list.filter((q) => q !== tray); if (tray.mesh.parent) tray.mesh.parent.remove(tray.mesh);
    if (p.role === 'crew' && p.conscious && !p.job && SKY.Crowd.pilots().length && p.hp > 50) { p.job = { type: 'meal', meal, step: 0 }; p.path = []; p.state = 'idle'; p.talk('I\'ll bring this to the flight deck!', 2.5); SKY.toast(p.name + ' is taking the meal to the pilots...'); return; }
    SKY.Game.feed(p, meal);
  },
};
SKY.makeMeal = makeMeal;
})();

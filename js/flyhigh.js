'use strict';
// GROK SKY - DLC: Fly High Item Pack (Mini Pack). 8 cartoony high-tech gadgets and the ⚡ ZipDrop delivery app
// on a new in-game 📱 phone. A drone flies your order to you in a few seconds. ZipDrop also sells snacks and stuff.
// Unlocked by localStorage 'grokDLC.sky.fly_high_item_pack' (set by the Grok Arcade DLC Machine). It unlocks live, with no reload.
// Co-op: the host shares the pack through the room meta (fh:1), so guests can use and buy gadgets in that room.
(() => {
const { clamp, rand, choose } = SKY;
const $ = (id) => document.getElementById(id);
const FH = SKY.FlyHigh = { KEY: 'grokDLC.sky.fly_high_item_pack', ARCADE: 'https://lizethbran13-cmyk.github.io/grok-arcade/', PRICE: 25 };
const SAVE = 'grokSkyFlyHigh';
let S = { own: [], orders: 0 };
try { S = Object.assign(S, JSON.parse(localStorage.getItem(SAVE) || '{}') || {}); } catch (e) { }
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } };
FH.save = S;
FH.owned = () => { try { return localStorage.getItem(FH.KEY) != null; } catch (e) { return false; } };
FH.shared = () => { const N = SKY.Net; return !!(N && N.isClient && N.isClient() && N.room && N.room.meta && (N.room.meta() || {}).fh); };
FH.can = () => FH.owned() || FH.shared();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- materials & smooth 3D model helpers
const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.35, metalness: 0.15 }, o || {}));
const glow = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i == null ? 0.9 : i, roughness: 0.3 });
const glass = (c, op) => new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: op == null ? 0.4 : op, shininess: 140, specular: 0xffffff, depthWrite: false });
const M = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; };
const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 20);
const sph = (r, a, b) => new THREE.SphereGeometry(r, a || 20, b || 14);
const tor = (r, t, arc) => new THREE.TorusGeometry(r, t, 12, 28, arc || Math.PI * 2);
function capsule(r, len, mat, parent) { // r128 has no CapsuleGeometry: cylinder + two spheres
  const g = new THREE.Group(); M(cyl(r, r, len, 22), mat, 0, 0, 0, g); M(sph(r, 22, 14), mat, 0, len / 2, 0, g); M(sph(r, 22, 14), mat, 0, -len / 2, 0, g); if (parent) parent.add(g); return g;
}
const MAT = {
  wood: std(0xb07040, { roughness: 0.6 }), steel: std(0xd6dde6, { metalness: 0.75, roughness: 0.22 }), dark: std(0x2a3346, { roughness: 0.4 }),
  purple: std(0x8a3cff), pink: std(0xff4fb0), yellow: std(0xffd23a), orange: std(0xff7a1a), red: std(0xff3a3a), white: std(0xf6f8ff), green: std(0x3ad17a), teal: std(0x18c8d8),
  ice: glow(0x7fe8ff, 0.7), iceG: glass(0xaeeaff, 0.5), bub: glass(0xd8f4ff, 0.32), cyanG: glow(0x3ff0ff, 1.1), magG: glow(0xff4fe0, 1.0), flame: glow(0xffa020, 1.4),
};
// gadget view models (held in front of the camera, same scale as the base tools)
function vmAxe() {
  const g = new THREE.Group();
  M(cyl(0.022, 0.026, 0.5), MAT.wood, 0, 0, 0, g).rotation.x = Math.PI / 2;
  M(cyl(0.03, 0.03, 0.06), MAT.dark, 0, 0, 0.2, g).rotation.x = Math.PI / 2; // grip
  const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.quadraticCurveTo(0.09, -0.07, 0.15, -0.14); sh.quadraticCurveTo(0.2, 0, 0.15, 0.14); sh.quadraticCurveTo(0.09, 0.07, 0, 0.05); sh.lineTo(0, -0.05);
  const blade = M(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 16 }), MAT.steel, 0.02, 0, -0.22, g);
  blade.rotation.set(0, Math.PI / 2, Math.PI / 2); blade.position.set(-0.015, 0.02, -0.2);
  const edge = M(tor(0.16, 0.008, 1.6), MAT.cyanG, 0, 0.03, -0.2, g); edge.rotation.set(0, Math.PI / 2, -0.8); edge.position.set(0, -0.0, -0.21); edge.scale.set(0.95, 0.95, 1);
  const jet = M(cyl(0.025, 0.035, 0.07), MAT.orange, 0, -0.04, -0.2, g); jet.rotation.x = Math.PI;
  M(sph(0.022), MAT.flame, 0, -0.085, -0.2, g);
  return g;
}
function blaster(bodyMat, accent, tip) {
  const g = new THREE.Group();
  const body = capsule(0.055, 0.16, bodyMat, g); body.rotation.x = Math.PI / 2;
  const grip = capsule(0.028, 0.08, MAT.dark, g); grip.position.set(0, -0.08, 0.06); grip.rotation.x = 0.35;
  const barrel = M(cyl(0.03, 0.045, 0.16), MAT.steel, 0, 0.0, -0.17, g); barrel.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const r = M(tor(0.05 - i * 0.006, 0.009), accent, 0, 0, -0.12 - i * 0.04, g); }
  if (tip) { tip.position.set(0, 0, -0.27); g.add(tip); }
  return g;
}
function vmFreeze() {
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), MAT.ice); crystal.scale.set(0.8, 1.3, 0.8);
  const g = blaster(MAT.white, MAT.cyanG, crystal);
  const tank = M(new THREE.OctahedronGeometry(0.05, 0), MAT.ice, 0, 0.075, 0.02, g); tank.scale.set(0.8, 1.2, 0.8); g.userData.spin = tank;
  return g;
}
function vmBubble() {
  const ring = M(tor(0.05, 0.01), MAT.pink); ring.rotation.y = 0;
  const g = blaster(MAT.teal, MAT.pink, ring);
  const tank = M(sph(0.06, 24, 18), MAT.bub, 0, 0.08, 0.02, g);
  for (let i = 0; i < 4; i++) M(sph(0.012 + i * 0.004), MAT.bub, rand(-0.02, 0.02), 0.08 + rand(-0.02, 0.02), 0.02 + rand(-0.02, 0.02), g);
  void tank; return g;
}
function vmParty() {
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), std(0xe8eef8, { metalness: 0.9, roughness: 0.12, flatShading: true }));
  const g = blaster(MAT.purple, MAT.magG, ball); g.userData.spin = ball; return g;
}
function vmMagnet() {
  const g = new THREE.Group();
  const u = M(tor(0.08, 0.03, Math.PI), MAT.red, 0, 0, -0.18, g); u.rotation.set(Math.PI / 2, 0, Math.PI);
  for (const s of [-1, 1]) { const tip = M(cyl(0.03, 0.03, 0.06), MAT.steel, s * 0.08, 0, -0.27, g); tip.rotation.x = Math.PI / 2; }
  const h = capsule(0.03, 0.14, MAT.dark, g); h.rotation.x = Math.PI / 2; h.position.z = -0.02;
  const core = M(sph(0.03), MAT.cyanG, 0, 0, -0.1, g); g.userData.pulse = core;
  return g;
}
function vmBlower() {
  const g = new THREE.Group();
  const tube = M(cyl(0.045, 0.035, 0.36), MAT.green, 0, 0, -0.2, g); tube.rotation.x = Math.PI / 2;
  M(tor(0.046, 0.01), MAT.yellow, 0, 0, -0.38, g);
  const motor = M(sph(0.085, 22, 16), MAT.yellow, 0, 0.0, 0.04, g); motor.scale.set(1, 0.85, 1.1);
  const fan = new THREE.Group(); fan.position.set(0, 0, 0.13); g.add(fan); for (let i = 0; i < 4; i++) { const b = M(sph(0.03, 10, 8), MAT.white, 0, 0.035, 0, fan); b.scale.set(0.5, 1.2, 0.2); const p = new THREE.Group(); p.rotation.z = i * Math.PI / 2; p.add(b); fan.add(p); }
  g.userData.fan = fan; return g;
}
function vmBomb() {
  const g = new THREE.Group(); const b = bombMesh(); b.scale.setScalar(1.4); b.position.set(0, 0.02, -0.12); g.add(b); return g;
}
function bombMesh() {
  const g = new THREE.Group();
  M(sph(0.07, 24, 18), MAT.pink, 0, 0, 0, g);
  for (const [c, y] of [[MAT.yellow, 0.035], [MAT.teal, -0.03]]) { const r = M(tor(0.062 - Math.abs(y) * 0.4, 0.012), c, 0, y, 0, g); r.rotation.x = Math.PI / 2; }
  M(cyl(0.022, 0.026, 0.03), MAT.dark, 0, 0.075, 0, g);
  const f = M(cyl(0.005, 0.005, 0.05, 6), MAT.wood, 0.01, 0.1, 0, g); f.rotation.z = -0.4;
  const sp = M(sph(0.015), MAT.flame, 0.022, 0.125, 0, g); g.userData.spark = sp;
  return g;
}
function bootMesh(mat) {
  const g = new THREE.Group();
  const shin = capsule(0.045, 0.07, mat, g); shin.position.y = 0.06;
  const foot = M(sph(0.06, 20, 14), mat, 0, -0.01, -0.03, g); foot.scale.set(0.9, 0.6, 1.5);
  M(tor(0.048, 0.01), MAT.yellow, 0, 0.1, 0, g).rotation.x = Math.PI / 2;
  const noz = M(cyl(0.03, 0.04, 0.05), MAT.steel, 0, -0.03, 0.06, g); noz.rotation.x = 0.3;
  const fl = M(new THREE.ConeGeometry(0.03, 0.09, 14), MAT.flame, 0, -0.08, 0.07, g); fl.rotation.x = Math.PI; g.userData.flame = fl;
  return g;
}
function vmBoots() {
  const g = new THREE.Group(); const a = bootMesh(MAT.orange), b = bootMesh(MAT.orange); a.position.set(-0.07, -0.04, -0.1); b.position.set(0.07, -0.04, -0.1); g.add(a, b); g.userData.boots = [a, b]; g.rotation.x = 0.3; return g;
}

// ---------------------------------------------------------------- catalog
const GADGETS = [
  { id: 'axe', name: 'TURBO AXE', icon: '🪓', price: 15, desc: 'Jet-powered axe. Chops through walls, trees, cars and buildings in one swing.', tool: { cd: 0.45, vox: 3.4, ppl: 8, push: 7, door: 7, range: 2.7 }, vm: vmAxe },
  { id: 'freeze', name: 'FREEZE RAY', icon: '❄️', price: 25, desc: 'Turns people, cars and fires into ice for 8 s. Ices up any wall it hits.', vm: vmFreeze, cd: 0.5, use: useFreeze },
  { id: 'bubble', name: 'BUBBLE BLASTER', icon: '🫧', price: 20, desc: 'Fires giant bubbles. Whoever you hit floats up for a while, then drifts back down.', vm: vmBubble, cd: 0.55, use: useBubble },
  { id: 'party', name: 'PARTY RAY', icon: '🪩', price: 15, desc: 'One zap and people break into a rainbow dance party.', vm: vmParty, cd: 0.5, use: useParty },
  { id: 'magnet', name: 'MEGA MAGNET', icon: '🧲', price: 20, desc: 'Hold to pull bags, carts and floppy people toward you.', vm: vmMagnet, cd: 0.05, use: useMagnet },
  { id: 'blower', name: 'LEAF BLOWER 3000', icon: '💨', price: 15, desc: 'Hold for a hurricane in a tube. Blows people over and sends props flying.', vm: vmBlower, cd: 0.06, use: useBlower },
  { id: 'bomb', name: 'CONFETTI BOMB', icon: '🎉', price: 10, desc: 'Toss it. KA-POOF! It blasts a hole in anything, plus a lot of confetti.', vm: vmBomb, cd: 1.1, use: useBomb },
  { id: 'boots', name: 'ROCKET BOOTS', icon: '🥾', price: 30, desc: 'Equip, then hold JUMP to fly. They also stop fall damage.', vm: vmBoots, cd: 0.3, use: useBoots },
];
const STUFF = [
  { id: 'pizza', icon: '🍕', name: 'Hot pizza', price: 6, desc: '+40 HP', heal: 40 },
  { id: 'donut', icon: '🍩', name: 'Sprinkle donut', price: 3, desc: '+20 HP', heal: 20 },
  { id: 'juice', icon: '🧃', name: 'Rocket juice', price: 2, desc: '+15 HP · 10 s of super speed', heal: 15, speed: 10 },
  { id: 'ext', icon: '🧯', name: 'Fire extinguisher', price: 5, desc: 'Delivered to your hands', prop: 'ext' },
  { id: 'mystery', icon: '🎁', name: 'Mystery box', price: 8, desc: 'Could be 0–20 coins… or a surprise!', mystery: true },
];
FH.GADGETS = GADGETS; FH.STUFF = STUFF;
const gById = (id) => GADGETS.find((g) => g.id === id);

// ---------------------------------------------------------------- tool list sync (base 3 + owned gadgets)
const base = SKY.TOOLS.slice(0, 3);
const vms = {};
let synced = '';
FH.sync = () => {
  const P = SKY.Player; if (!P || !P.vmTools) return;
  const list = FH.can() ? GADGETS.filter((g) => S.own.includes(g.id)) : [];
  const key = list.map((g) => g.id).join(',');
  if (key === synced) return; synced = key;
  const T = SKY.TOOLS, cur = T[P.tool];
  T.length = 3; for (let i = 0; i < 3; i++) T[i] = base[i];
  for (const v of P.vmTools.slice(3)) { v.visible = false; }
  P.vmTools.length = 3;
  for (const g of list) {
    T.push(Object.assign({ name: g.name, icon: g.icon, cd: g.cd || 0.4, vox: 0, ppl: 0, push: 0, door: 0, range: 2.2, fh: g.id, use: g.use || null }, g.tool || {}));
    if (!vms[g.id]) { const v = vms[g.id] = g.vm(); v.rotation.x = -0.5; v.visible = false; P.vm.add(v); }
    P.vmTools.push(vms[g.id]);
  }
  const ni = T.indexOf(cur); P.tool = ni >= 0 ? ni : 0;
};
FH.toolIndex = (id) => SKY.TOOLS.findIndex((t) => t.fh === id);
FH.equip = (id) => { FH.sync(); const i = FH.toolIndex(id); if (i >= 0) { SKY.Player.setTool(i); return true; } return false; };

// ---------------------------------------------------------------- effect space helpers (plane cabin vs world)
const inPlane = () => SKY.Player.frame === 'plane';
const space = () => inPlane() ? SKY.Player.plane.interior : SKY.Game.scene;
const fxs = () => inPlane() ? SKY.Player.plane.fxLocal : SKY.Game.fx;
const sameFrame = (p) => (p.frame === 'plane') === inPlane();
function muzzle(out) { const P = SKY.Player; return out.copy(P.eye).addScaledVector(P.dir, 0.55).addScaledVector(P.gravity().clone().normalize(), 0.18); }
const tmp = []; // short-lived meshes {m, t, life, upd}
function addTmp(m, life, upd, parent) { (parent || space()).add(m); tmp.push({ m, t: 0, life, upd }); return m; }
// sounds (the base synth: tone/noise are private, so these are built from its named effects plus our own WebAudio)
let actx = null;
function tone(f, d, v, type, slide) {
  try {
    if (!SKY.Audio.ready || (SKY.Game.settings && SKY.Game.settings.muted)) return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.05);
  } catch (e) { }
}
const SFX = {
  zap: () => { tone(1800, 0.25, 0.08, 'sawtooth', 300); tone(2400, 0.18, 0.05, 'triangle', 900); },
  freeze: () => { tone(2600, 0.5, 0.06, 'sine', 1200); setTimeout(() => tone(3200, 0.3, 0.05, 'sine', 2600), 90); },
  bubble: () => { tone(260, 0.2, 0.12, 'sine', 700); },
  popb: () => { tone(900, 0.06, 0.12, 'sine', 1800); },
  party: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 0.07, 'square'), i * 70)); },
  chop: () => { SKY.Audio.play('crunch'); tone(140, 0.2, 0.15, 'square', 60); },
  hum: () => { tone(110, 0.08, 0.05, 'sawtooth', 120); },
  whoosh: () => { SKY.Audio.play('spray'); },
  kapoof: () => { SKY.Audio.play('boom'); [784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.06, 'triangle'), 120 + i * 60)); },
  jet: () => { tone(180, 0.12, 0.05, 'sawtooth', 90); },
  drone: () => { tone(320, 0.6, 0.04, 'sawtooth', 340); },
  deliver: () => { SKY.Audio.play('ok'); setTimeout(() => tone(1320, 0.3, 0.07, 'sine'), 160); },
  phone: () => { tone(1200, 0.06, 0.06, 'sine'); setTimeout(() => tone(1600, 0.08, 0.06, 'sine'), 70); },
};
FH.sfx = SFX;

// ---------------------------------------------------------------- statuses on people / cars
const ICE_T = 8, BUB_T = 6.5, PARTY_T = 8;
function freezePerson(p) { if (!p.fhIce) { p.talk(choose(['❄️ !!!', 'Brrr—', '🥶']), 1.2); } p.fhIce = ICE_T; p.fhBub = 0; }
function bubblePerson(p) { if (p.fhIce > 0) return; p.fhBub = BUB_T; p.fhBubY = p.fhBubY || 0; p.talk(choose(['Wheee! 🫧', 'I\'m floating!', 'Put me dowwwn!']), 2.5); }
function partyPerson(p) { if (p.fhIce > 0) return; p.fhParty = PARTY_T; if (p.state === 'rag' && p.hp > 0 && !p.ko) { /* they'll stand up on their own */ } p.talk(choose(['💃 Fiesta!', '🕺 Let\'s gooo!', '🎶 Dance break!', '🪩 Woo!']), 2.5); }
FH.freezePerson = freezePerson; FH.bubblePerson = bubblePerson; FH.partyPerson = partyPerson;
const Crowd = SKY.Crowd;
const PROTO = SKY.Person.prototype;
// statuses run before the normal person step; returning true skips it
function holdPerson(p, dt) {
  if (p.fhIce > 0) { p.fhIce -= dt; if (p.fhIce <= 0) { p.fhIce = 0; p.talk(choose(['Brrr! 🥶', '…that was COLD', 'Achoo!']), 2); } return true; }
  if (p.fhBub > 0) {
    p.fhBub -= dt; const t = BUB_T - p.fhBub;
    const target = p.fhBub > 1.6 ? Math.min(2.4, t * 1.4) : Math.max(0, p.fhBub / 1.6 * 2.4);
    const dy = target - (p.fhBubY || 0); p.fhBubY = target;
    const sx = Math.sin(t * 2.1) * 0.006;
    const up = p.frame === 'plane' ? _v.set(0, 1, 0) : _v.set(0, 1, 0);
    for (const pt of p.pts) { pt.p.addScaledVector(up, dy); pt.p.x += sx; pt.o.copy(pt.p); }
    if (p.fhBub <= 0) { p.fhBub = 0; p.fhBubY = 0; popAt(p.pts[2].p, p.frame); if (p.state === 'rag') p.ragT = 0; }
    return true;
  }
  if (p.fhParty > 0) {
    p.fhParty -= dt; if (p.fhParty <= 0) p.fhParty = 0;
    if (p.state !== 'rag' && p.state !== 'para' && p.conscious && !p.seat) { p.yaw += dt * 4.2; p.pose(dt); const hop = Math.abs(Math.sin(p.anim * 7)) * 0.12; for (const pt of p.pts) pt.p.y += hop; return true; }
    if (p.seat && p.conscious) { p.pose(dt); const sway = Math.sin(p.anim * 6) * 0.08; p.pts[0].p.x += sway; p.pts[3].p.y += 0.35 + sway; p.pts[4].p.y += 0.35 - sway; return true; }
  }
  return false;
}
const oWP = Crowd.updateWorldPerson, oPP = Crowd.updatePlanePerson;
Crowd.updateWorldPerson = function (p, dt) { if ((p.fhIce > 0 || p.fhBub > 0 || p.fhParty > 0) && holdPerson(p, dt)) return; return oWP.apply(this, arguments); };
Crowd.updatePlanePerson = function (p, dt) { if ((p.fhIce > 0 || p.fhBub > 0 || p.fhParty > 0) && holdPerson(p, dt)) return; return oPP.apply(this, arguments); };
const oRender = PROTO.render;
const ICE_COL = { skin: 0xd6f6ff, shirt: 0x8fe0ff, pants: 0x5cc2ee, hair: 0xc4f0ff };
PROTO.render = function (w) {
  if (this.fhIce > 0) { const s = [this.skin, this.shirt, this.pants, this.hair]; this.skin = ICE_COL.skin; this.shirt = ICE_COL.shirt; this.pants = ICE_COL.pants; this.hair = ICE_COL.hair; oRender.call(this, w); [this.skin, this.shirt, this.pants, this.hair] = s; return; }
  if (this.fhParty > 0) { const s = this.shirt; this.shirt = new THREE.Color().setHSL((performance.now() * 0.0006 + this.id * 0.17) % 1, 0.9, 0.55).getHex(); oRender.call(this, w); this.shirt = s; return; }
  return oRender.call(this, w);
};
// ice shells & bubbles (smooth meshes wrapped around the ragdoll)
const shellGeo = new THREE.IcosahedronGeometry(1, 1), bubGeo = sph(1, 28, 20);
const iceMat = new THREE.MeshPhongMaterial({ color: 0xaeeaff, transparent: true, opacity: 0.5, shininess: 150, specular: 0xffffff, flatShading: true, depthWrite: false });
const shells = [], bubbles = [];
function poolMesh(pool, i, geo, mat) { if (!pool[i]) { pool[i] = new THREE.Mesh(geo, mat); pool[i].renderOrder = 3; } return pool[i]; }
function placeStatus() {
  let si = 0, bi = 0;
  for (const p of Crowd.list) {
    if (!(p.fhIce > 0 || p.fhBub > 0)) continue;
    const par = p.frame === 'plane' ? SKY.Player.plane.interior : SKY.Game.scene;
    const pel = p.pts[2].p, nk = p.pts[1].p;
    _v.subVectors(nk, pel); const L = _v.length() || 0.5; _v.divideScalar(L);
    _v2.addVectors(nk, pel).multiplyScalar(0.5).addScaledVector(_v, -0.15);
    const m = p.fhIce > 0 ? poolMesh(shells, si++, shellGeo, iceMat) : poolMesh(bubbles, bi++, bubGeo, MAT.bub);
    if (m.parent !== par) par.add(m);
    m.visible = true; m.position.copy(_v2); m.quaternion.setFromUnitVectors(_up, _v);
    if (p.fhIce > 0) { const melt = Math.min(1, p.fhIce / 1.2); m.scale.set(0.5 * melt + 0.05, 1.05 * melt + 0.05, 0.42 * melt + 0.05); }
    else { const wob = 1 + Math.sin(performance.now() * 0.006 + p.id) * 0.04; m.scale.set(0.78 * wob, 0.95 / wob, 0.78 * wob); }
  }
  for (let i = si; i < shells.length; i++) shells[i].visible = false;
  for (let i = bi; i < bubbles.length; i++) bubbles[i].visible = false;
}
// frozen cars: the host/ambient car step is undone while the ice is on
const frozenCars = new Map();
function freezeCar(car) {
  if (!car || car === SKY.Cars.cur) return false;
  let f = frozenCars.get(car);
  if (!f) {
    const T = car.T || {}; const m = new THREE.Mesh(shellGeo, iceMat); m.renderOrder = 3; SKY.Game.scene.add(m);
    m.scale.set((T.W || 2) * 0.62, ((T.h1 || 0.7) + (T.h2 || 0.6)) * 0.62, (T.L || 4) * 0.6);
    f = { m, pos: car.pos.clone(), yaw: car.yaw }; frozenCars.set(car, f);
  }
  f.t = ICE_T; car.speed = 0; return true;
}
FH.freezeCar = freezeCar; FH.frozenCars = frozenCars;
if (SKY.Cars && SKY.Cars.update) {
  const oCars = SKY.Cars.update;
  SKY.Cars.update = function (dt) {
    for (const [car, f] of frozenCars) { if (car.gone) { f.t = 0; } }
    const r = oCars.apply(this, arguments);
    for (const [car, f] of frozenCars) {
      f.t -= dt;
      if (f.t <= 0 || car.gone) { if (f.m.parent) f.m.parent.remove(f.m); frozenCars.delete(car); continue; }
      car.pos.copy(f.pos); car.yaw = f.yaw; car.speed = 0;
      if (car.mesh) { car.mesh.position.copy(car.pos); }
      const melt = Math.min(1, f.t / 1.2); f.m.position.copy(car.pos); f.m.position.y += ((car.T && car.T.h1) || 0.7) * 0.75; f.m.rotation.y = car.yaw; f.m.visible = melt > 0.05;
    }
    return r;
  };
}
// ice crystals on walls (they melt away)
const crystals = [];
function iceCluster(pt, nrm) {
  const g = new THREE.Group(); g.position.copy(pt);
  const n = 4 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.12, 0.26), 0), i % 2 ? MAT.ice : iceMat);
    c.scale.set(0.55, rand(1.2, 2.1), 0.55); c.position.set(rand(-0.25, 0.25), rand(-0.15, 0.2), rand(-0.25, 0.25));
    c.rotation.set(rand(-0.6, 0.6), rand(0, 6), rand(-0.6, 0.6)); g.add(c);
  }
  if (nrm) g.quaternion.setFromUnitVectors(_up, nrm);
  space().add(g); crystals.push({ g, t: 14 });
  while (crystals.length > 40) { const o = crystals.shift(); if (o.g.parent) o.g.parent.remove(o.g); }
}
function popAt(pt, frame) {
  const fx = frame === 'plane' ? SKY.Player.plane.fxLocal : SKY.Game.fx;
  for (let i = 0; i < 14; i++) fx.foam.spawn(pt.x, pt.y + 0.5, pt.z, rand(-2, 2), rand(-0.5, 2), rand(-2, 2), rand(0.4, 0.8), rand(0.05, 0.12), 0xdff6ff);
  SFX.popb();
}

// ---------------------------------------------------------------- gadget behaviour
const raySegs = [];
function beam(to, col) {
  const P = SKY.Player; const from = muzzle(new THREE.Vector3());
  const d = _v3.subVectors(to, from); const L = d.length(); if (L < 0.05) return;
  const g = new THREE.Group();
  const core = M(cyl(0.025, 0.025, L, 10), glow(col, 1.6)); core.position.y = L / 2; g.add(core);
  const halo = M(cyl(0.07, 0.07, L, 14), glass(col, 0.28)); halo.position.y = L / 2; g.add(halo);
  g.position.copy(from); g.quaternion.setFromUnitVectors(_up, d.normalize());
  addTmp(g, 0.18, (o, k) => { o.scale.set(1 - k, 1, 1 - k); });
  raySegs.push(1); void P;
}
function hitPoint(h, range) { const P = SKY.Player; return new THREE.Vector3().copy(P.eye).addScaledVector(P.dir, h ? h.t : range); }
function carsOnRay(range, rad) {
  const P = SKY.Player; if (inPlane() || !SKY.Cars) return [];
  const out = [];
  for (const c of SKY.Cars.list) { if (c === SKY.Cars.cur || c.gone) continue; _v.copy(c.pos); _v.y += 0.8; _v.sub(P.eye); const t = _v.dot(P.dir); if (t < 0 || t > range) continue; if (_v.addScaledVector(P.dir, -t).length() < rad) out.push({ c, t }); }
  return out.sort((a, b) => a.t - b.t);
}
function useFreeze(P) {
  const R = 32; const h = P.pick(R); const cars = carsOnRay(R, 1.6);
  SFX.zap(); P.swing = 0.45;
  if (cars.length && (!h || cars[0].t < h.t)) { const c = cars[0].c; freezeCar(c); beam(_v2.copy(P.eye).addScaledVector(P.dir, cars[0].t), 0x5ff4ff); SFX.freeze(); SKY.toast('❄️ Car frozen solid!', 'good'); FH.stats.frozen++; return; }
  const pt = hitPoint(h, R); beam(pt, 0x5ff4ff);
  const fx = fxs(); for (let i = 0; i < 10; i++) fx.foam.spawn(pt.x, pt.y, pt.z, rand(-1.5, 1.5), rand(0, 2), rand(-1.5, 1.5), rand(0.4, 0.9), rand(0.04, 0.1), 0xc8f6ff);
  if (!h) return;
  if (h.type === 'person') { freezePerson(h.obj); SFX.freeze(); FH.stats.frozen++; }
  else if (h.type === 'prop') { h.obj.vel.set(0, 0, 0); iceCluster(h.obj.pos, null); SFX.freeze(); }
  else { iceCluster(pt, h.n || null); SFX.freeze(); }
  if (inPlane()) for (const f of P.plane.fires) if (_v.set(f.x, f.y, f.z).distanceTo(pt) < 2.6 && f.hp > 0) { f.hp = 0; SKY.toast('❄️ Fire frozen out!', 'good'); SKY.Game.achieve && SKY.Game.achieve('firefighter'); }
}
const shots = [];
function useBubble(P) {
  SFX.bubble(); P.swing = 0.35;
  const near = P.pick(2.2); if (near && near.type === 'person' && !(near.obj.fhIce > 0)) { bubblePerson(near.obj); FH.stats.bubbled++; return; } // point blank: the bubble forms around them
  const m = new THREE.Mesh(bubGeo, MAT.bub); m.scale.setScalar(0.32);
  const pos = muzzle(new THREE.Vector3()); m.position.copy(pos); space().add(m);
  shots.push({ kind: 'bub', m, pos, vel: P.dir.clone().multiplyScalar(9), t: 0, plane: inPlane() });
}
function useParty(P) {
  const R = 28; const h = P.pick(R); const pt = hitPoint(h, R); beam(pt, 0xff4fe0); SFX.party(); P.swing = 0.4;
  const fx = fxs(); for (let i = 0; i < 16; i++) fx.chip.spawn(pt.x, pt.y, pt.z, rand(-2, 2), rand(0, 3), rand(-2, 2), rand(1, 2), rand(0.04, 0.08), choose([0xff4fe0, 0xffd23a, 0x3ff0ff, 0x7cff6a]));
  let n = 0; for (const p of Crowd.list) if (sameFrame(p) && p.pts[2].p.distanceTo(pt) < 2.4) { partyPerson(p); n++; }
  if (n) FH.stats.parties++;
}
function useMagnet(P) {
  P.swing = 0.08; if (Math.random() < 0.25) SFX.hum();
  const inCone = (pos, maxD, dot) => { _v2.subVectors(pos, P.eye); const d = _v2.length(); return d < maxD && d > 1.0 && _v2.dot(P.dir) / (d || 1) > dot; };
  let n = 0;
  for (const pr of SKY.Props.list) if (!pr.held && (pr.frame === 'plane') === inPlane() && inCone(pr.pos, 16, 0.75)) { _v.subVectors(P.eye, pr.pos).normalize(); pr.vel.addScaledVector(_v, 1.6 / Math.max(0.5, pr.mass)); pr.mounted = false; n++; }
  for (const p of Crowd.list) { if (!sameFrame(p) || p.fhIce > 0 || p.grabbed) continue; const pel = p.pts[2].p; if (!inCone(pel, 12, 0.8)) continue; _v.subVectors(P.eye, pel).normalize(); if (p.state !== 'rag') { if (Math.random() < 0.08) { p.knock(_v.clone().multiplyScalar(2)); p.talk(choose(['Whoa—magnet!', 'My belt buckle!!', 'Heyyy!']), 1.5); } } else for (const pt of p.pts) pt.o.addScaledVector(_v, -0.012); n++; }
  if (n && Math.random() < 0.3) { const fx = fxs(); const m = muzzle(_v3); fx.foam.spawn(m.x, m.y, m.z, P.dir.x * 2, P.dir.y * 2, P.dir.z * 2, 0.25, 0.04, 0x9ff8ff); }
}
const blowCD = new WeakMap();
function useBlower(P) {
  P.swing = 0.1; if (Math.random() < 0.35) SFX.whoosh();
  const fx = fxs(); const m = muzzle(_v3); const base = inPlane() ? _v.set(0, 0, 0) : P.vel;
  for (let i = 0; i < 3; i++) fx.foam.spawn(m.x, m.y, m.z, base.x + P.dir.x * 16 + rand(-1.5, 1.5), base.y + P.dir.y * 16 + rand(-1, 1.5), base.z + P.dir.z * 16 + rand(-1.5, 1.5), rand(0.4, 0.7), rand(0.04, 0.09), choose([0x8fe07a, 0xffd23a, 0xff9a3a, 0xffffff]));
  const inCone = (pos, maxD) => { _v2.subVectors(pos, P.eye); const d = _v2.length(); return d < maxD && _v2.dot(P.dir) / (d || 1) > 0.8; };
  for (const pr of SKY.Props.list) if (!pr.held && (pr.frame === 'plane') === inPlane() && inCone(pr.pos, 9)) { pr.vel.addScaledVector(P.dir, 1.4 / Math.max(0.5, pr.mass)); pr.mounted = false; }
  const now = performance.now();
  for (const p of Crowd.list) { if (!sameFrame(p) || p.fhIce > 0) continue; if (!inCone(p.pts[1].p, 8)) continue; if (p.state === 'rag') { for (const pt of p.pts) pt.o.addScaledVector(P.dir, -0.02); continue; } if ((blowCD.get(p) || 0) > now) continue; blowCD.set(p, now + 700); p.knock(P.dir.clone().setY(0.35).multiplyScalar(5)); p.talk(choose(['WAAAH!', 'My hair!!', 'Pffff—', 'Too windy!']), 1.5); FH.stats.blown++; }
  P.vel.addScaledVector(P.dir, P.grounded ? -0.08 : -0.5);
}
function useBomb(P) {
  SFX.bubble(); P.swing = 1;
  const m = bombMesh(); m.scale.setScalar(2.4);
  const pos = muzzle(new THREE.Vector3()); m.position.copy(pos); space().add(m);
  const g = P.gravity().clone().normalize();
  const base = inPlane() ? new THREE.Vector3() : P.vel.clone();
  shots.push({ kind: 'bomb', m, pos, vel: P.dir.clone().multiplyScalar(inPlane() ? 7 : 12).addScaledVector(g, -3).add(base), t: 0, plane: inPlane() });
}
function kapoof(s) {
  const P = SKY.Player, pt = s.pos; SFX.kapoof(); SKY.Game.shake && SKY.Game.shake(0.15);
  const fx = s.plane ? P.plane.fxLocal : SKY.Game.fx;
  for (let i = 0; i < 60; i++) fx.chip.spawn(pt.x, pt.y, pt.z, rand(-6, 6), rand(1, 8), rand(-6, 6), rand(1.5, 3), rand(0.05, 0.11), choose([0xff4fe0, 0xffd23a, 0x3ff0ff, 0x7cff6a, 0xff7a1a, 0xffffff]));
  for (let i = 0; i < 10; i++) fx.smoke.spawn(pt.x, pt.y, pt.z, rand(-1, 1), rand(0.5, 2), rand(-1, 1), rand(0.8, 1.4), rand(0.3, 0.6), 0xffe8f6);
  // ring flash
  const ring = M(tor(0.6, 0.12), glow(0xff4fe0, 1.4)); ring.position.copy(pt); ring.rotation.x = Math.PI / 2;
  addTmp(ring, 0.45, (o, k) => { o.scale.setScalar(1 + k * 5); o.material.opacity = 1 - k; o.material.transparent = true; }, s.plane ? P.plane.interior : SKY.Game.scene);
  try {
    if (s.plane) P.plane.damage(pt, 0.9, 3.5, SKY.Game.fx, true);
    else SKY.World.damage(pt, 2.2, 6, null, SKY.Game.fx);
  } catch (e) { }
  for (const p of Crowd.list) { if ((p.frame === 'plane') !== s.plane) continue; const pel = p.pts[2].p; const d = pel.distanceTo(pt); if (d > 4) continue; if (p.fhIce > 0) { p.fhIce = 0.01; continue; } _v.subVectors(pel, pt).setY(0.6).normalize(); p.knock(_v.multiplyScalar(6 * (1 - d / 4) + 2)); p.hurt(3, 'player'); p.talk(choose(['🎉 KA-POOF!', 'Confetti?!', 'Wheee!']), 2); }
  for (const pr of SKY.Props.list) { if ((pr.frame === 'plane') !== s.plane || pr.held) continue; const d = pr.pos.distanceTo(pt); if (d < 4) { _v.subVectors(pr.pos, pt).setY(0.5).normalize(); pr.vel.addScaledVector(_v, 8 / Math.max(0.5, pr.mass)); pr.mounted = false; } }
  if (!s.plane) for (const c of (SKY.Cars ? SKY.Cars.list : [])) if (!c.gone && c !== SKY.Cars.cur && c.pos.distanceTo(pt) < 5) { c.speed = 0; c.yaw += rand(-0.6, 0.6); }
  FH.stats.booms++;
}
function useBoots(P) { // tap = little hop boost (hold JUMP to fly)
  if (P.mode !== 'foot') return; const g = P.gravity().clone().normalize(); P.vel.addScaledVector(g, -4); P.grounded = false; SFX.jet(); P.swing = 0.2;
}
function stepShots(dt) {
  const P = SKY.Player;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.t += dt;
    const g = s.plane ? P.plane.gLocal : _v.set(0, -SKY.GRAV, 0);
    if (s.kind === 'bomb') s.vel.addScaledVector(g, dt);
    else s.vel.multiplyScalar(1 - 0.6 * dt), s.vel.y += 0.4 * dt;
    s.pos.addScaledVector(s.vel, dt); s.m.position.copy(s.pos);
    let done = s.t > (s.kind === 'bomb' ? 1.6 : 3.2);
    if (s.kind === 'bomb') { s.m.rotation.x += dt * 6; s.m.rotation.z += dt * 3; const sp = s.m.userData.spark; if (sp) sp.scale.setScalar(0.7 + Math.random() * 0.8); }
    else { const k = Math.min(1, s.t * 3); s.m.scale.setScalar(0.32 + k * 0.4); }
    // collisions
    if (s.kind === 'bub' && !done) for (const p of Crowd.list) { if ((p.frame === 'plane') !== s.plane || p.fhBub > 0 || p.fhIce > 0) continue; if (p.pts[2].p.distanceTo(s.pos) < 0.8 || p.pts[1].p.distanceTo(s.pos) < 0.7) { bubblePerson(p); FH.stats.bubbled++; done = 'hit'; break; } }
    if (s.kind === 'bomb' && !done) for (const p of Crowd.list) if ((p.frame === 'plane') === s.plane && p.pts[1].p.distanceTo(s.pos) < 0.6) { done = true; break; }
    if (!done) { const solid = s.plane ? P.plane.solidLocal(s.pos.x, s.pos.y, s.pos.z) : (s.pos.y < SKY.World.heightAt(s.pos.x, s.pos.z) + 0.15 || !!SKY.World.solidAt(s.pos.x, s.pos.y, s.pos.z)); if (solid && s.t > 0.05) done = true; }
    if (done) {
      if (s.m.parent) s.m.parent.remove(s.m);
      if (s.kind === 'bomb') kapoof(s); else if (done !== 'hit') popAt(_v2.copy(s.pos).y -= 0.5, s.plane ? 'plane' : 'world');
      shots.splice(i, 1);
    }
  }
}
// rocket boots flight (hold JUMP while the boots are equipped)
let jetT = 0;
function stepBoots(dt, I) {
  const P = SKY.Player, T = SKY.TOOLS[P.tool];
  const on = T && T.fh === 'boots' && P.mode === 'foot' && !P.dead && I.hold('jump') && !SKY.Game.ui;
  const v = vms.boots; if (v) for (const b of v.userData.boots) { const f = b.userData.flame; f.visible = on; if (on) f.scale.set(1, 0.8 + Math.random() * 0.8, 1); }
  if (!on) { P.fhJet = false; return; }
  const g = P.gravity(); const gm = g.length() || 9.8; const up = _v.copy(g).divideScalar(-gm);
  const vu = P.vel.dot(up);
  if (vu < 7) P.vel.addScaledVector(up, (gm + 11) * dt);
  P.grounded = false; P.maxFall = 0; P.airT = 0; P.fhJet = true;
  jetT -= dt; if (jetT <= 0) { jetT = 0.12; SFX.jet(); }
  const fx = inPlane() ? P.plane.fxLocal : SKY.Game.fx; const base = inPlane() ? _v2.set(0, 0, 0) : P.vel;
  for (const s of [-0.15, 0.15]) fx.fire.spawn(P.pos.x + s, P.pos.y + 0.05, P.pos.z, base.x - up.x * 4 + rand(-0.4, 0.4), base.y - up.y * 4, base.z - up.z * 4 + rand(-0.4, 0.4), rand(0.25, 0.45), rand(0.12, 0.2), choose([0xffa020, 0xffe060, 0xff6a1a]));
}
FH.stats = { frozen: 0, bubbled: 0, parties: 0, blown: 0, booms: 0, chops: 0, delivered: 0 };

// ---------------------------------------------------------------- delivery drone
const drones = [];
function droneMesh() {
  const g = new THREE.Group();
  const body = M(sph(0.42, 28, 20), MAT.purple, 0, 0, 0, g); body.scale.set(1, 0.48, 1.15);
  M(tor(0.42, 0.045), MAT.yellow, 0, 0, 0, g).rotation.x = Math.PI / 2;
  const dome = M(sph(0.22, 22, 14), glass(0x9ff8ff, 0.55), 0, 0.14, 0.12, g); dome.scale.set(1, 0.7, 1);
  for (const s of [-1, 1]) M(sph(0.05), MAT.cyanG, s * 0.12, 0.05, 0.43, g); // LED eyes
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
    const arm = M(cyl(0.035, 0.035, 0.62, 10), MAT.dark, x / 2, 0.02, z / 2, g); arm.rotation.z = Math.PI / 2; arm.rotation.y = -a;
    M(cyl(0.06, 0.07, 0.1), MAT.steel, x, 0.06, z, g);
    const ring = M(tor(0.3, 0.025), MAT.pink, x, 0.12, z, g); ring.rotation.x = Math.PI / 2;
    const r = new THREE.Group(); r.position.set(x, 0.13, z); g.add(r); rotors.push(r);
    for (let k = 0; k < 2; k++) { const b = M(sph(0.14, 12, 8), glass(0xffffff, 0.55), 0, 0, 0, r); b.scale.set(1.8, 0.06, 0.28); b.rotation.y = k * Math.PI / 2; }
  }
  // the package on a little cable
  const cable = M(cyl(0.012, 0.012, 1, 6), MAT.dark, 0, -0.5, 0, g);
  const box = new THREE.Group(); box.position.y = -0.55; g.add(box);
  M(new THREE.BoxGeometry(0.46, 0.36, 0.46), std(0xd7a35e, { roughness: 0.8 }), 0, 0, 0, box);
  for (const r of [0, Math.PI / 2]) { const t = M(new THREE.BoxGeometry(0.48, 0.38, 0.07), MAT.purple, 0, 0, 0, box); t.rotation.y = r; }
  const bolt = M(new THREE.OctahedronGeometry(0.08, 0), MAT.yellow, 0, 0.24, 0, box); bolt.scale.set(0.6, 1.4, 0.3);
  g.userData = { rotors, cable, box };
  return g;
}
FH.droneMesh = droneMesh;
function deliver(item, kind) {
  const P = SKY.Player, G = SKY.Game;
  const seated = P.mode === 'pilot' || P.mode === 'seat' || P.mode === 'drive' || P.mode === 'ride';
  S.orders++; persist();
  SKY.toast('⚡ ZipDrop: order #' + (1000 + S.orders) + ' (' + item.icon + ' ' + item.name + ') is on the way! ETA 3 s', 'good');
  if (seated) { setTimeout(() => grant(item, kind, true), 1200); return; }
  const plane = inPlane(); const par = space();
  const m = droneMesh(); const sc = plane ? 0.42 : 1; m.scale.setScalar(sc);
  const g = P.gravity().clone().normalize(); const up = g.clone().negate();
  const fwd = _v.copy(P.dir).addScaledVector(up, -P.dir.dot(up)); if (fwd.lengthSq() < 1e-3) fwd.set(0, 0, -1); fwd.normalize();
  const dest = P.pos.clone().addScaledVector(fwd, plane ? 1.1 : 2.4).addScaledVector(up, plane ? 0.9 : 1.6);
  const start = dest.clone().addScaledVector(up, plane ? 0.6 : 26).addScaledVector(fwd, plane ? 6 : 30);
  if (plane) { start.z = clamp(start.z, P.plane.T ? -999 : -20, 999); }
  m.position.copy(start); par.add(m);
  drones.push({ m, start, dest, up, t: 0, item, kind, plane, sc, phase: 'fly' }); SFX.drone();
}
function stepDrones(dt) {
  const P = SKY.Player;
  for (let i = drones.length - 1; i >= 0; i--) {
    const d = drones[i]; d.t += dt; const U = d.m.userData;
    for (const r of U.rotors) r.rotation.y += dt * 40;
    if (d.phase === 'fly') {
      // follow the player while flying in, so moving targets still get their parcel
      const fwd = _v.copy(P.dir).addScaledVector(d.up, -P.dir.dot(d.up)); if (fwd.lengthSq() > 1e-3) fwd.normalize();
      if (!d.plane === !inPlane()) d.dest.copy(P.pos).addScaledVector(fwd, d.plane ? 1.1 : 2.4).addScaledVector(d.up, d.plane ? 0.9 : 1.6);
      const k = Math.min(1, d.t / 2.4), e = 1 - Math.pow(1 - k, 3);
      d.m.position.lerpVectors(d.start, d.dest, e); d.m.position.addScaledVector(d.up, Math.sin(k * Math.PI) * (d.plane ? 0.2 : 3));
      d.m.rotation.z = Math.sin(d.t * 5) * 0.08 * (1 - k); d.m.rotation.x = -0.3 * (1 - k);
      if (k >= 1) { d.phase = 'drop'; d.t = 0; SFX.phone(); }
    } else if (d.phase === 'drop') {
      const k = Math.min(1, d.t / 0.7); U.cable.scale.y = 1 + k * 1.3; U.cable.position.y = -0.5 - k * 0.65; U.box.position.y = -0.55 - k * 1.3;
      if (k >= 1) { d.phase = 'open'; d.t = 0; grant(d.item, d.kind, false); const bp = U.box.getWorldPosition(new THREE.Vector3()); if (d.plane) P.plane.interior.worldToLocal(bp); const fx = d.plane ? P.plane.fxLocal : SKY.Game.fx; for (let q = 0; q < 26; q++) fx.chip.spawn(bp.x, bp.y, bp.z, rand(-2.5, 2.5), rand(1, 4), rand(-2.5, 2.5), rand(1, 2), rand(0.04, 0.08), choose([0xff4fe0, 0xffd23a, 0x3ff0ff, 0x8a3cff])); U.box.visible = false; }
    } else {
      U.cable.scale.y = Math.max(0.01, U.cable.scale.y - dt * 3); d.m.position.addScaledVector(d.up, dt * (d.plane ? 1.5 : 9) * Math.min(1, d.t * 2)); d.m.rotation.y += dt * 2;
      if (d.t > 2.2) { if (d.m.parent) d.m.parent.remove(d.m); drones.splice(i, 1); }
    }
  }
}
FH.drones = drones;
function grant(item, kind, seated) {
  const P = SKY.Player; SFX.deliver(); FH.stats.delivered++;
  if (kind === 'gadget') {
    if (!S.own.includes(item.id)) S.own.push(item.id); persist(); FH.sync();
    const i = FH.toolIndex(item.id);
    SKY.toast('📦 Delivered: ' + item.icon + ' ' + item.name + '!' + (i >= 0 ? ' Equipped — press ' + (i < 9 ? i + 1 : '🔧') + ' or 🔧 to switch' : ''), 'good');
    if (i >= 0 && !P.held) P.setTool(i);
    return;
  }
  if (item.heal) { P.hp = Math.min(100, P.hp + item.heal); SKY.Audio.play('eat'); }
  if (item.speed) FH.speedT = item.speed;
  if (item.prop && !seated && SKY.Props && !P.held) {
    try { const plane = inPlane(); const p = SKY.Props.make(item.prop, P.pos.x, P.pos.y + 1, P.pos.z); if (!plane) { P.plane.interior.remove(p.mesh); SKY.Game.scene.add(p.mesh); p.frame = 'world'; p.pos.copy(P.pos); p.pos.y += 1; } p.held = true; P.held = p; P.setHeldVM && P.setHeldVM(); } catch (e) { }
  }
  if (item.mystery) {
    const r = Math.random(); const PL = SKY.Places;
    if (r < 0.7 && PL) { const c = (Math.random() * 21) | 0; PL.save.coins += c; PL.persist && PL.persist(); SKY.toast('🎁 Mystery box: ' + (c ? '+' + c + ' 🪙!' : 'a single sock. 🧦 Better luck next time!'), c ? 'good' : ''); }
    else { P.hp = 100; SKY.toast('🎁 Mystery box: a golden energy bar! ❤️ Full HP', 'good'); }
    return;
  }
  SKY.toast('📦 Delivered: ' + item.icon + ' ' + item.name + (item.heal ? ' · ❤️ +' + item.heal + ' HP' : '') + (item.speed ? ' · ⚡ super speed!' : ''), 'good');
}
FH.grant = grant;
// rocket juice: faster walking (scale the foot move a little each step)
function stepSpeed(dt) { if (!(FH.speedT > 0)) return; FH.speedT -= dt; const P = SKY.Player; if (P.mode === 'foot' && P.grounded) { const g = P.gravity().clone().normalize(); const vh = _v.copy(P.vel).addScaledVector(g, -P.vel.dot(g)); if (vh.length() > 0.5 && vh.length() < 12) P.vel.addScaledVector(vh, 0.06); } }

// ---------------------------------------------------------------- 📱 phone + ⚡ ZipDrop app
let tab = 'gadgets', app = 'home';
FH.isOpen = () => SKY.Game.ui === 'phone';
FH.open = (a) => {
  const G = SKY.Game; if (G.state !== 'play') return false;
  if (G.ui && G.ui !== 'phone') G.closeUI();
  app = a || 'home'; G.ui = 'phone'; G.unlockPointer(); $('fhPhone').classList.add('show'); SFX.phone(); render(); return true;
};
FH.close = () => { $('fhPhone').classList.remove('show'); if (SKY.Game.ui === 'phone') SKY.Game.closeUI(); };
FH.toggle = () => { if (FH.isOpen()) FH.close(); else FH.open(); };
const coins = () => (SKY.Places && SKY.Places.coins) ? SKY.Places.coins() : 0;
function clock() { const d = new Date(); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
function render() {
  const el = $('fhScreen'); if (!el) return;
  const can = FH.can(), own = FH.owned();
  let h = '<div class="fhStatus"><b>' + clock() + '</b><span>📶 🔋 · 🪙 ' + coins() + '</span></div>';
  if (app === 'home') {
    h += '<div class="fhWall"><div class="fhHello">Grok<span>Phone</span></div><div class="fhApps">' +
      '<button class="fhApp zip' + (can ? '' : ' locked') + '" data-app="zip"><i>⚡</i><small>ZipDrop' + (can ? '' : ' 🔒') + '</small></button>' +
      '<button class="fhApp gad' + (can ? '' : ' locked') + '" data-app="mine"><i>🧰</i><small>My Gadgets</small></button>' +
      '<button class="fhApp wal" data-app="wallet"><i>🪙</i><small>Wallet</small></button>' +
      '</div><p class="fhTip">' + (can ? 'ZipDrop delivers anything in seconds, even to a plane at 30,000 ft ✈️' : 'NEW: ⚡ ZipDrop + 8 gadgets in the Fly High Item Pack') + '</p></div>';
  } else if (app === 'wallet') {
    h += head('🪙 Wallet') + '<div class="fhBody"><div class="fhBig">🪙 ' + coins() + '</div><p class="fhTip">Earn coins by snapping tourist photos, at casinos and arcades, and with clinic tips.</p><p class="fhTip">ZipDrop orders: ' + S.orders + '</p></div>';
  } else if (!can) {
    h += head('⚡ ZipDrop') + '<div class="fhBody fhLock"><div class="fhBadge">MINI PACK · DLC</div><h3>Fly High Item Pack</h3><p>You get 8 cartoony high-tech gadgets and the ⚡ ZipDrop app. A drone delivers your order in seconds.</p>' +
      '<div class="fhList">' + GADGETS.map((g) => '<span>' + g.icon + ' ' + g.name + '</span>').join('') + '</div>' +
      '<p class="fhHow">🔒 Unlock it at the <b>DLC Machine 3000</b> in Grok Arcade for <b>' + FH.PRICE + ' 🎟️</b>. It turns on right away. Online, if the host owns it, everyone in the room can use it.</p>' +
      '<a class="fhBtn" id="fhArcade" href="' + FH.ARCADE + '" target="_blank" rel="noopener">OPEN GROK ARCADE</a></div>';
  } else if (app === 'mine') {
    const mine = GADGETS.filter((g) => S.own.includes(g.id));
    h += head('🧰 My Gadgets') + '<div class="fhBody">' + (mine.length ? mine.map((g) => { const i = FH.toolIndex(g.id); const on = i === SKY.Player.tool; return '<div class="fhRow"><i>' + g.icon + '</i><b>' + g.name + '<small>' + (i >= 0 && i < 9 ? 'key ' + (i + 1) + ' · ' : '') + g.desc + '</small></b><button class="fhBuy' + (on ? ' on' : '') + '" data-eq="' + g.id + '">' + (on ? 'IN HAND' : 'EQUIP') + '</button></div>'; }).join('') : '<p class="fhTip">No gadgets yet. Order some on ⚡ ZipDrop!</p>') + '</div>';
  } else {
    h += head('⚡ ZipDrop', '<span class="fhEta">⏱ 3 s delivery</span>') + '<div class="fhTabs"><button data-tab="gadgets" class="' + (tab === 'gadgets' ? 'on' : '') + '">🛠 Gadgets</button><button data-tab="stuff" class="' + (tab === 'stuff' ? 'on' : '') + '">🍕 Snacks &amp; stuff</button></div><div class="fhBody">';
    if (tab === 'gadgets') h += GADGETS.map((g) => { const has = S.own.includes(g.id); return '<div class="fhRow"><i>' + g.icon + '</i><b>' + g.name + '<small>' + g.desc + '</small></b>' + (has ? '<button class="fhBuy owned" data-eq="' + g.id + '">OWNED · EQUIP</button>' : '<button class="fhBuy" data-buy="' + g.id + '">🪙 ' + g.price + '</button>') + '</div>'; }).join('');
    else h += STUFF.map((s) => '<div class="fhRow"><i>' + s.icon + '</i><b>' + s.name + '<small>' + s.desc + '</small></b><button class="fhBuy" data-stuff="' + s.id + '">🪙 ' + s.price + '</button></div>').join('');
    h += '</div>';
  }
  h += '<button class="fhHome" id="fhHomeBtn" aria-label="Home"></button>';
  el.innerHTML = h;
  el.querySelectorAll('[data-app]').forEach((b) => b.onclick = () => { app = b.dataset.app; SFX.phone(); render(); });
  el.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
  el.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => FH.buy(b.dataset.buy));
  el.querySelectorAll('[data-stuff]').forEach((b) => b.onclick = () => FH.order(b.dataset.stuff));
  el.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => { FH.equip(b.dataset.eq); render(); });
  el.querySelectorAll('.fhBack').forEach((b) => b.onclick = () => { app = 'home'; render(); });
  $('fhHomeBtn').onclick = () => { if (app === 'home') FH.close(); else { app = 'home'; render(); } };
}
function head(t, extra) { return '<div class="fhHead"><button class="fhBack">‹</button><b>' + t + '</b>' + (extra || '') + '</div>'; }
FH.render = render;
FH.buy = (id) => {
  const g = gById(id); if (!g || !FH.can()) return false; if (S.own.includes(id)) return false;
  if (SKY.Places && !SKY.Places.spend(g.price)) return false;
  FH.close(); deliver(g, 'gadget'); return true;
};
FH.order = (id) => {
  const s = STUFF.find((x) => x.id === id); if (!s || !FH.can()) return false;
  if (SKY.Places && !SKY.Places.spend(s.price)) return false;
  FH.close(); deliver(s, 'stuff'); return true;
};

// ---------------------------------------------------------------- DOM, title badge, live unlock, co-op share
function injectDom() {
  if ($('fhPhone')) return;
  const ph = document.createElement('div'); ph.id = 'fhPhone'; ph.innerHTML = '<div class="fhFrame"><div class="fhNotch"></div><div id="fhScreen"></div></div>';
  ph.addEventListener('pointerdown', (e) => { if (e.target === ph) FH.close(); });
  document.body.appendChild(ph);
  const b = document.createElement('button'); b.id = 'fhPhoneBtn'; b.type = 'button'; b.innerHTML = '📱<small>PHONE</small><em>🔒</em>';
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); SKY.Audio.init(); FH.toggle(); });
  document.body.appendChild(b);
  const card = document.querySelector('#title .card');
  if (card) { const a = document.createElement('a'); a.id = 'fhBadge'; a.className = 'fhTitleBadge'; a.target = '_blank'; a.rel = 'noopener'; const vt = card.querySelector('.vertag'); card.insertBefore(a, vt ? vt.nextSibling : card.firstChild); }
  refresh();
}
let lastCan = null;
function refresh() {
  const can = FH.can(), own = FH.owned();
  const b = $('fhPhoneBtn'); if (b) b.classList.toggle('locked', !can);
  const bd = $('fhBadge'); if (bd) { bd.innerHTML = own ? '📱 FLY HIGH ITEM PACK UNLOCKED · tap 📱 PHONE (O) in game' : '📱 NEW DLC: FLY HIGH ITEM PACK 🔒'; bd.classList.toggle('own', own); if (own) bd.removeAttribute('href'); else bd.href = FH.ARCADE; }
  if (lastCan !== null && can !== lastCan) {
    if (can) { SKY.toast(own ? '🎉 Fly High Item Pack unlocked! Open your 📱 phone (O) → ⚡ ZipDrop' : '🤝 The host shares the Fly High Item Pack: open your 📱 phone → ⚡ ZipDrop', 'good'); SKY.Audio.play('chime'); }
    else SKY.toast('📱 Fly High gadgets are off: the host who shared them left', 'warn');
  }
  lastCan = can; FH.sync(); if (FH.isOpen()) render();
}
FH.refresh = refresh;
addEventListener('storage', (e) => { if (e.key === FH.KEY || e.key === null) refresh(); });
setInterval(() => {
  refresh();
  const N = SKY.Net; if (N && N.isHost && N.isHost() && N.room) { const m = N.room.meta() || {}; const v = FH.owned() ? 1 : 0; if ((m.fh || 0) !== v) N.room.setMeta({ fh: v }); }
  if (FH.isOpen() && app !== 'zip') { const st = document.querySelector('#fhScreen .fhStatus span'); if (st) st.textContent = '📶 🔋 · 🪙 ' + coins(); }
}, 1000);
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const G = SKY.Game; if (!G || G.state !== 'play') return;
  if (e.code === 'KeyO') { FH.toggle(); return; }
  if (G.ui) return;
  const m = /^Digit(\d)$/.exec(e.code); if (m) { const n = +m[1]; const i = n === 0 ? 9 : n - 1; if (i >= 3 && i < SKY.TOOLS.length) SKY.Player.setTool(i); }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectDom); else injectDom();

// ---------------------------------------------------------------- per-step hook (runs inside the game step, after the crowd)
const oProps = SKY.Props.update;
SKY.Props.update = function (dt) {
  const r = oProps.apply(this, arguments);
  try { FH.update(dt); } catch (e) { if (!FH.err) { FH.err = 1; console.warn('flyhigh', e); } }
  return r;
};
FH.update = (dt) => {
  const P = SKY.Player, I = SKY.Input;
  stepShots(dt); stepDrones(dt); stepBoots(dt, I); stepSpeed(dt); placeStatus();
  for (let i = tmp.length - 1; i >= 0; i--) { const o = tmp[i]; o.t += dt; const k = o.t / o.life; if (o.upd) o.upd(o.m, Math.min(1, k)); if (k >= 1) { if (o.m.parent) o.m.parent.remove(o.m); tmp.splice(i, 1); } }
  for (let i = crystals.length - 1; i >= 0; i--) { const c = crystals[i]; c.t -= dt; if (c.t < 1.5) c.g.scale.setScalar(Math.max(0.01, c.t / 1.5)); if (c.t <= 0) { if (c.g.parent) c.g.parent.remove(c.g); crystals.splice(i, 1); } }
  // view-model idle animation
  const t = performance.now() * 0.001;
  for (const id in vms) { const v = vms[id]; if (!v.visible) continue; if (v.userData.spin) v.userData.spin.rotation.y = t * 2; if (v.userData.pulse) v.userData.pulse.scale.setScalar(0.8 + Math.sin(t * 8) * 0.25 + (I.hold('action') ? 0.5 : 0)); if (v.userData.fan) v.userData.fan.rotation.z += dt * (I.hold('action') ? 40 : 4); }
  const b = $('fhPhoneBtn'); if (b) b.style.display = SKY.Game.state === 'play' ? '' : 'none';
};
FH.reset = () => {
  for (const s of shots) if (s.m.parent) s.m.parent.remove(s.m); shots.length = 0;
  for (const d of drones) if (d.m.parent) d.m.parent.remove(d.m); drones.length = 0;
  for (const c of crystals) if (c.g.parent) c.g.parent.remove(c.g); crystals.length = 0;
  for (const [, f] of frozenCars) if (f.m.parent) f.m.parent.remove(f.m); frozenCars.clear();
  for (const o of tmp) if (o.m.parent) o.m.parent.remove(o.m); tmp.length = 0;
  for (const m of shells.concat(bubbles)) m.visible = false;
  FH.speedT = 0; if (FH.isOpen()) FH.close();
};
const oTitle = SKY.Game.toTitle; SKY.Game.toTitle = function () { FH.reset(); return oTitle.apply(this, arguments); };
const oClose = SKY.Game.closeUI; SKY.Game.closeUI = function () { const ph = $('fhPhone'); if (ph) ph.classList.remove('show'); return oClose.apply(this, arguments); };
const oStart = SKY.Game.start; SKY.Game.start = function () { FH.reset(); const r = oStart.apply(this, arguments); FH.sync(); return r; };
})();

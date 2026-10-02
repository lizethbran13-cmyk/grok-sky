'use strict';
// GROK SKY - enterable places: storefront facades + glowing doors in every city, small voxel interiors built on demand
// (one at a time, floating high above the active city so nothing else is drawn), elevators to real observation decks,
// open-air food stands, the climbable Pyramid of the Sun, NPCs, coins, souvenirs, telescopes and photo spots.
(() => {
const W = SKY.World, WB = SKY.WB;
const { clamp, rand, choose } = SKY;
const IY = 5000, DS = 0.5;
const hyp = Math.hypot;
const FACE = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }; // outward normal of a door
const RIGHT = { s: [1, 0], n: [-1, 0], e: [0, -1], w: [0, 1] }; // viewer's right when looking at that door
const yawOf = (fx, fz) => Math.atan2(-fx, -fz);

// ---------------------------------------------------------------- save (coins, souvenirs, high scores)
const SAVE = 'grokSkyPlaces';
const S = { coins: 60, souv: [], hi: {}, visited: [], ate: [], photos: [] };
try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) { }
const persist = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } };

const PL = SKY.Places = { list: [], byCity: {}, cur: null, npcs: [], markers: [], scope: null, trans: null, save: S, IY, keycard: false, t: 0 };
PL.persist = persist;
PL.coins = () => S.coins;
PL.spend = (n) => {
  if (S.coins < n) { SKY.toast('🪙 Not enough coins (' + S.coins + '/' + n + '). Win some at a casino or arcade, or snap tourist photos!', 'warn'); SKY.Audio.play('error'); return false; }
  S.coins -= n; persist(); SKY.Audio.play('beep'); return true;
};
PL.earn = (n, why) => { if (n <= 0) return; S.coins += n; persist(); if (why) SKY.toast('🪙 +' + n + ' coins ' + why, 'good'); };
PL.addSouvenir = (e, n) => {
  S.souv.push(e + ' ' + n); if (S.souv.length > 60) S.souv.shift(); persist();
  SKY.toast('🎁 Souvenir: ' + e + ' ' + n + ' (' + S.souv.length + ' collected)', 'good'); SKY.Audio.play('ok'); SKY.Game.achieve('souvenir');
};
PL.eat = (item, city) => {
  const P = SKY.Player; const before = P.hp; P.hp = Math.min(100, P.hp + item.heal); P.woozy = 0;
  SKY.Audio.play('eat'); SKY.toast('😋 ' + item.e + ' ' + item.n + ' (+' + Math.round(P.hp - before) + ' HP)', 'good');
  const cid = (city || (PL.cur && PL.cur.place.city) || W.nearestCity(P.pos.x, P.pos.z).city).id;
  if (!S.ate.includes(cid)) { S.ate.push(cid); persist(); }
  if (S.ate.length >= 3) SKY.Game.achieve('foodie');
};
PL.togo = (item) => {
  const P = SKY.Player; if (P.held) P.dropHeld();
  const meal = { name: item.n, q: 'Fresh', heal: item.heal, spoiled: false, color: item.col || 0xffaa55, emoji: item.e };
  const p = SKY.Props.makeWorld('tray', P.pos.x, P.pos.y + 1.2, P.pos.z, { meal }); p.held = true; P.held = p; P.setHeldVM();
  SKY.Audio.play('ding'); SKY.toast('🥡 ' + item.e + ' ' + item.n + ' to go! USE (facing nothing) to eat it, or carry it back to your plane and serve it to someone.', 'good');
};
PL.photo = (name) => {
  const G = SKY.Game; const key = '📸 ' + name;
  const f = document.getElementById('flash'); if (f) { f.style.background = 'rgba(255,255,255,.9)'; f.style.opacity = 0.9; setTimeout(() => { f.style.opacity = 0; setTimeout(() => { f.style.background = ''; }, 300); }, 90); }
  SKY.Audio.play('pop');
  if (G.stats && !G.stats.seen.has(key)) {
    G.stats.seen.add(key); if (!S.photos.includes(name)) { S.photos.push(name); persist(); PL.earn(3); }
    SKY.toast('📸 Photo: ' + name + ' — tourist spots ' + Math.min(G.stats.seen.size, 5) + '/5 · +3 🪙', 'good');
    if (G.stats.seen.size >= 5) G.achieve('tourist');
  } else SKY.toast('📸 Another lovely photo of ' + name + '!');
};
PL.markVisited = (pl) => {
  if (!S.visited.includes(pl.id)) { S.visited.push(pl.id); persist(); }
  SKY.Game.achieve('enter');
  const zones = new Set(S.visited.map((id) => (PL.list.find((q) => q.id === id) || {}).cid).filter(Boolean));
  if (['LA', 'LAS', 'A51', 'MEX', 'NYC', 'PAR', 'TYO'].every((z) => zones.has(z))) SKY.Game.achieve('explorer');
};

// ---------------------------------------------------------------- shared meshes
let MK = null;
function mkInit() {
  if (MK) return MK;
  MK = {
    gem: new THREE.OctahedronGeometry(0.55, 0), ring: new THREE.RingGeometry(1.1, 1.6, 24), box: new THREE.BoxGeometry(1, 1, 1),
    ringMat: new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    gemMats: {}, lam: new THREE.MeshLambertMaterial({ color: 0xffffff }), glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
  MK.ring.rotateX(-Math.PI / 2);
  return MK;
}
const gemMat = (col) => { const m = mkInit(); return m.gemMats[col] || (m.gemMats[col] = new THREE.MeshBasicMaterial({ color: col })); };
// glowing door marker: spinning gem above + pulsing ring on the floor
PL.addMarker = (parent, x, y, z, col, tag) => {
  const m = mkInit(); const g = new THREE.Group(); g.position.set(x, y, z);
  const gem = new THREE.Mesh(m.gem, gemMat(col || 0xffd23d)); gem.position.y = 4.4; g.add(gem);
  const ring = new THREE.Mesh(m.ring, m.ringMat); ring.position.y = 0.06; g.add(ring);
  parent.add(g); const mk = { g, gem, ring, parent, tag, ph: Math.random() * 6 }; PL.markers.push(mk); return mk;
};

// ---------------------------------------------------------------- NPCs (instanced Person renderer)
let writer = null;
const SHIRTS = [0xe53935, 0x43a047, 0xfdd835, 0x8e24aa, 0x00acc1, 0xfb8c00, 0xec407a, 0x5c6bc0, 0xffffff, 0x26a69a];
PL.addNPC = (x, y, z, o, tag) => {
  const p = new SKY.Person('pax', 'world');
  p.name = o.name || choose(['Alex', 'Bea', 'Carlos', 'Dee', 'Emi', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jun', 'Kai', 'Lola', 'Max', 'Noor', 'Ola', 'Pablo', 'Rin', 'Sol', 'Tess', 'Vera']);
  if (o.shirt != null) p.shirt = o.shirt; else p.shirt = choose(SHIRTS);
  if (o.pants != null) p.pants = o.pants; if (o.hair != null) p.hair = o.hair; if (o.skin != null) p.skin = o.skin;
  p.pos.set(x, y, z); p.yaw = o.yaw || 0; p.state = o.sit ? 'sit' : (o.wave ? 'wave' : 'idle'); p.pose(0, true);
  const n = { p, o, tag, wp: o.walk ? o.walk.map((q) => new THREE.Vector3(q[0], y, q[1])) : null, wi: 0, t: rand(0.5, 4), head: new THREE.Vector3(x, y + 1.75, z), home: new THREE.Vector3(x, y, z), talkT: rand(2, 8) };
  if (o.key) PL.npcs = PL.npcs.filter((q) => q.o.key !== o.key);
  PL.npcs.push(n); return n;
};
PL.talkNPC = (n) => { const L = n.o.lines || ['Hi!']; n.p.talk(L[n.li = ((n.li == null ? -1 : n.li) + 1) % L.length], 3.2); SKY.Audio.play('beep'); n.p.yaw = yawOf(SKY.Player.pos.x - n.p.pos.x, SKY.Player.pos.z - n.p.pos.z); n.t = 3; };
function updateNPCs(dt, cam) {
  PL.npcs = PL.npcs.filter((n) => !n.tag || !n.tag.city || n.tag.city.built);
  const P = SKY.Player;
  for (const n of PL.npcs) {
    const p = n.p; if (cam.distanceToSquared(p.pos) > 160 * 160) { n.far = true; continue; } n.far = false;
    p.sayT -= dt; if (p.sayT <= 0) p.say = ''; p.anim += dt;
    if (n.o.sit) { p.state = 'sit'; }
    else if (n.wp && n.wp.length) {
      if (p.state === 'walk') { const tg = n.wp[n.wi]; const dx = tg.x - p.pos.x, dz = tg.z - p.pos.z, d = hyp(dx, dz); if (d < 0.15) { p.state = 'idle'; n.t = rand(1.5, 5); n.wi = (n.wi + 1) % n.wp.length; } else { const st = Math.min(d, 1.1 * dt); p.pos.x += dx / d * st; p.pos.z += dz / d * st; p.yaw = yawOf(dx, dz); } }
      else { n.t -= dt; if (n.t <= 0) p.state = 'walk'; }
    } else if (n.o.wave) { n.t -= dt; if (n.t <= 0) { p.state = p.state === 'wave' ? 'idle' : 'wave'; n.t = rand(2, 5); } }
    // chatter when the player is close
    const dP = P.frame === 'world' ? hyp(P.pos.x - p.pos.x, P.pos.z - p.pos.z) + Math.abs(P.pos.y - p.pos.y) : 99;
    n.talkT -= dt; if (dP < 6 && n.talkT <= 0 && n.o.lines && !p.say) { n.talkT = rand(7, 14); p.talk(choose(n.o.lines), 3); }
    p.pose(dt); n.head.set(p.pos.x, p.pos.y + 1.8, p.pos.z);
  }
}
function renderNPCs() {
  if (!writer) { writer = new SKY.CharWriter(SKY.Game.scene, 40 * 7); }
  writer.begin(); let k = 0;
  for (const n of PL.npcs) { if (n.far || k >= 40) continue; n.p.render(writer); k++; }
  writer.end();
}

// ---------------------------------------------------------------- voxel builder context (metres, local to an origin)
// interiors: origin = room min corner with the floor top at y=0; stands/decks: origin in the real world
function makeCtx(c, O, Wd, H, Dd, opts) {
  opts = opts || {};
  const ctx = { c, O, W: Wd, H, D: Dd, structs: [], acts: [], anims: [], npcs: [], group: new THREE.Group(), spawnAt: null, persistent: !!opts.persistent, tag: opts.tag || null };
  ctx.group.position.set(O.x, O.y, O.z);
  let g = null; const yOff = opts.yOff || 0; // detail grid can start below the origin (stands on slopes)
  const grid = () => { if (!g) { const st = WB.newStruct(O.x, O.y - yOff, O.z, Math.ceil(Wd / DS), Math.ceil((H + yOff) / DS) + 1, Math.ceil(Dd / DS), DS, { name: opts.name || 'interior' }); g = st.grid; ctx.structs.push(st); } return g; };
  const R = (v) => Math.round(v / DS); const RY = (v) => Math.round((v + yOff) / DS);
  ctx.grid = grid;
  ctx.B = (x0, y0, z0, x1, y1, z1, m) => { const gg = grid(); const i0 = R(Math.min(x0, x1)), i1 = Math.max(i0, R(Math.max(x0, x1)) - 1), j0 = RY(Math.min(y0, y1)), j1 = Math.max(j0, RY(Math.max(y0, y1)) - 1), k0 = R(Math.min(z0, z1)), k1 = Math.max(k0, R(Math.max(z0, z1)) - 1); gg.box(i0, j0, k0, i1, j1, k1, m); };
  ctx.F = (x, y, z, m) => grid().set(Math.floor(x / DS), Math.floor((y + yOff) / DS), Math.floor(z / DS), m);
  ctx.cyl = (cx, cz, r, y0, y1, m, wall) => { const gg = grid(); for (let k = R(cz - r) - 1; k <= R(cz + r); k++) for (let i = R(cx - r) - 1; i <= R(cx + r); i++) { const d = hyp((i + 0.5) * DS - cx, (k + 0.5) * DS - cz); if (d > r || (wall && d < r - wall)) continue; for (let j = RY(y0); j < RY(y1); j++) gg.set(i, j, k, typeof m === 'function' ? m(i, j, k) : m); } };
  ctx.sph = (cx, cy, cz, r, m) => { const gg = grid(); for (let k = R(cz - r) - 1; k <= R(cz + r); k++) for (let j = RY(cy - r) - 1; j <= RY(cy + r); j++) for (let i = R(cx - r) - 1; i <= R(cx + r); i++) if (hyp((i + 0.5) * DS - cx, (j + 0.5) * DS - yOff - cy, (k + 0.5) * DS - cz) < r) gg.set(i, j, k, typeof m === 'function' ? m(i, j, k) : m); };
  // text: its own fine (0.25 m) voxel struct so letters are ~1.25 m tall (sc=2 doubles); face = side it reads from
  ctx.txt = (x, y, z, text, m, face, sc) => {
    sc = sc || 1; const TS = 0.25; const w = WB.textW(text, sc); if (w <= 0) return; const h = 5 * sc; const alongX = face === 's' || face === 'n';
    const st = WB.newStruct(O.x + (alongX ? x - w * TS / 2 : x - TS / 2), O.y + y, O.z + (alongX ? z - TS / 2 : z - w * TS / 2), alongX ? w : 1, h, alongX ? 1 : w, TS, { name: 'text' });
    const g = st.grid;
    if (face === 's') WB.writeTextX(g, 0, 0, 0, text, m, 1, sc); else if (face === 'n') WB.writeTextX(g, w - 1, 0, 0, text, m, -1, sc);
    else if (face === 'w') WB.writeTextZ(g, text, 0, 0, 0, m, 1, sc); else WB.writeTextZ(g, text, 0, 0, w - 1, m, -1, sc);
    ctx.structs.push(st);
  };
  // s=1 room shell: floor (fn(x,z)->mat), walls (mat or fn(x,y,z)), ceiling
  ctx.shell = (floor, wall, ceil) => {
    const st = WB.newStruct(O.x, O.y - 1, O.z, Wd, H + 2, Dd, 1, { name: (opts.name || 'interior') + ' shell' }); const sg = st.grid; ctx.structs.push(st);
    for (let k = 0; k < Dd; k++) for (let i = 0; i < Wd; i++) {
      sg.set(i, 0, k, typeof floor === 'function' ? floor(i + 0.5, k + 0.5) : floor);
      sg.set(i, H + 1, k, typeof ceil === 'function' ? ceil(i + 0.5, k + 0.5) : ceil);
      if (i === 0 || k === 0 || i === Wd - 1 || k === Dd - 1) for (let j = 1; j <= H; j++) sg.set(i, j, k, typeof wall === 'function' ? wall(i + 0.5, j - 0.5, k + 0.5) : wall);
    }
    ctx.bounds = { x0: O.x, x1: O.x + Wd, z0: O.z, z1: O.z + Dd, y0: O.y, y1: O.y + H };
  };
  ctx.wp = (x, y, z) => new THREE.Vector3(O.x + x, O.y + y, O.z + z);
  ctx.mesh = (o) => { ctx.group.add(o); return o; };
  ctx.act = (x, y, z, r, label, fn) => { const it = { city: c, pos: ctx.wp(x, y, z), r, label: typeof label === 'function' ? label : () => label, act: fn, place: !ctx.persistent }; ctx.acts.push(it); return it; };
  ctx.menu = (x, y, z, label, title, items, r) => ctx.act(x, y, z, r || 2.6, label, () => SKY.Mini.menu(title, items, c));
  ctx.shop = (x, y, z, label, title, items, r) => ctx.act(x, y, z, r || 2.6, label, () => SKY.Mini.shop(title, items));
  ctx.photo = (x, y, z, name, r) => ctx.act(x, y, z, r || 2.4, '📸 Take a photo: ' + name, () => PL.photo(name));
  ctx.npc = (x, z, o) => { o = o || {}; const y = o.y || 0; if (o.walk) o.walk = o.walk.map((q) => [O.x + q[0], O.z + q[1]]); const n = PL.addNPC(O.x + x, O.y + y, O.z + z, o, ctx.persistent ? { city: c } : { place: true }); ctx.npcs.push(n); if (o.lines && !o.noTalk) { const it = { city: c, pos: n.head, r: 2.6, label: () => '💬 Talk to ' + n.p.name, act: () => PL.talkNPC(n), place: !ctx.persistent }; ctx.acts.push(it); } return n; };
  ctx.anim = (fn) => ctx.anims.push(fn);
  ctx.spawn = (x, z, yaw) => { ctx.spawnAt = { x, z, yaw }; };
  // exit door on a wall (face = direction pointing back into the room)
  ctx.exit = (x, z, face, label) => {
    const f = FACE[face], rt = RIGHT[face];
    for (let a = -1.5; a < 1.5; a += DS) for (let y = 0; y < 3.5; y += DS) { const edge = a < -1 || a >= 1 || y >= 3; ctx.F(x + rt[0] * a + f[0] * 0.25, y, z + rt[1] * a + f[1] * 0.25, edge ? 57 : 38); }
    ctx.txt(x + f[0] * 0.25, 3.8, z + f[1] * 0.25, 'EXIT', 47, face, 1);
    const mx = x + f[0] * 1.6, mz = z + f[1] * 1.6;
    ctx.marker = [mx, 0, mz, 0x57ff7a];
    ctx.act(mx, 1.2, mz, 3.2, label || '🚪 EXIT to the street', () => PL.exit());
  };
  ctx.chaser = (pts, cols, size) => {
    const m = mkInit(); const im = new THREE.InstancedMesh(m.box, m.glow, pts.length); im.frustumCulled = false;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(pts.length * 3), 3);
    const m4 = new THREE.Matrix4(), cc = new THREE.Color(); const s = size || 0.3;
    pts.forEach((p, i) => { m4.makeScale(s, s, s); m4.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
    ctx.mesh(im); let acc = 0;
    ctx.anim((dt, t) => { acc += dt; if (acc < 0.12) return; acc = 0; const ph = Math.floor(t * 8); for (let i = 0; i < pts.length; i++) { cc.setHex(cols[(i + ph) % cols.length]); im.instanceColor.setXYZ(i, cc.r, cc.g, cc.b); } im.instanceColor.needsUpdate = true; });
    return im;
  };
  ctx.picture = (x, y, z, w, h, face, draw, px, py) => {
    const cv = document.createElement('canvas'); cv.width = px || 32; cv.height = py || 48; draw(cv.getContext('2d'), cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    const f = FACE[face]; mesh.position.set(x + f[0] * 0.02, y, z + f[1] * 0.02); mesh.rotation.y = Math.atan2(f[0], f[1]);
    mesh.userData.cv = cv; mesh.userData.tex = tex; ctx.mesh(mesh); return mesh;
  };
  ctx.finish = () => {
    W.withCity(c, () => { for (const st of ctx.structs) { WB.finish(st); if (!ctx.persistent) st.viewR = 0; } });
    if (!ctx.persistent) for (const it of ctx.acts) W.interactables.push(it); else for (const it of ctx.acts) W.interactables.push(it);
    return ctx;
  };
  return ctx;
}
PL.makeCtx = makeCtx;

// ---------------------------------------------------------------- exterior pieces (built lazily with the city)
// storefront facade: door centre (x,z) on the front face; the body extends behind it
function facade(x, z, face, w, d, h, wallM, sign, signM, awnA, awnB, opts) {
  opts = opts || {}; const f = FACE[face], rt = RIGHT[face]; const y0 = opts.y0 || 0;
  const cx = x - f[0] * d / 2, cz = z - f[1] * d / 2; const alongX = face === 's' || face === 'n';
  const sx = alongX ? w : d, sz = alongX ? d : w;
  WB.shape(cx, y0, cz, sx, h + 1, sz, 1, (px, y, pz, i, j, k) => {
    const wx = cx + px, wz = cz + pz; const u = (wx - x) * rt[0] + (wz - z) * rt[1], v = -((wx - x) * f[0] + (wz - z) * f[1]);
    const nx = Math.ceil(sx), nz = Math.ceil(sz);
    const edge = i === 0 || k === 0 || i === nx - 1 || k === nz - 1;
    if (y > h) return edge && (Math.floor(u) % 2 === 0) ? (opts.trim || 24) : 0;
    if (y > h - 1) return opts.roof || 24;
    if (!edge) return 0;
    if (v < 1 && Math.abs(u) < 1.6 && y < 3.4) return 0; // door opening (filled by the portal)
    if (v < 1 && y > 0.5 && y < 3.2 && Math.abs(u) > 3 && Math.abs(u) < w / 2 - 1.5) return opts.window || 22;
    if (opts.stripe && Math.floor(y) % 3 === 2) return opts.stripe;
    return wallM;
  }, { name: 'facade ' + sign });
  // door portal (glowing frame + dark glass)
  portal(x - f[0] * 0.5, z - f[1] * 0.5, y0, face, opts.doorM);
  // awning
  if (awnA) {
    const ax = x + f[0] * 0.75, az = z + f[1] * 0.75; const aw = Math.min(w - 2, 12);
    WB.smallBox(ax, y0 + 3.6, az, alongX ? aw / 0.5 : 3, 2, alongX ? 3 : aw / 0.5, 0.5, (g) => { const nx = g.nx, nz = g.nz; for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const a = alongX ? i : k; const out = alongX ? (f[1] > 0 ? k : nz - 1 - k) : (f[0] > 0 ? i : nx - 1 - i); g.set(i, out > 1 ? 0 : 1, k, (a >> 1) % 2 ? awnA : awnB); } }, { name: 'awning' });
  }
  // sign board above the awning
  if (sign) { const cells = WB.textW(sign, 1) + 4; const ss = Math.max(0.25, Math.min(0.5, (w - 2) / cells)); SKY.signBoard(x + f[0] * 0.6, y0 + 4.7, z + f[1] * 0.6, [{ t: sign, m: signM || 57 }], ss, opts.board || 70, signM || 57, face); }
}
// standalone door portal (for real landmarks); y = ground height
function portal(x, z, y, face, doorM) {
  const alongX = face === 's' || face === 'n';
  WB.smallBox(x, y, z, alongX ? 7 : 1, 8, alongX ? 1 : 7, 0.5, (g) => { for (let a = 0; a < 7; a++) for (let j = 0; j < 8; j++) { const edge = a === 0 || a === 6 || j === 7; g.set(alongX ? a : 0, j, alongX ? 0 : a, edge ? 57 : (doorM || 38)); } }, { name: 'door' });
}
PL.facade = facade; PL.portal = portal;

// ---------------------------------------------------------------- planning: register places per city
PL.plan = (P, c) => {
  const defs = (PL.DEFS || {})[c.id]; if (!defs) return;
  PL.byCity[c.id] = [];
  for (const d of defs) {
    const pl = Object.assign({ cid: c.id, city: c }, d);
    pl.dx = d.door ? P.X(d.door[0]) : 0; pl.dz = d.door ? P.Z(d.door[1]) : 0;
    if (d.doorFn) { const q = d.doorFn(c); pl.dx = q[0]; pl.dz = q[1]; }
    const f = FACE[pl.face || 's']; pl.f = f;
    pl.ax = pl.dx + f[0] * 2.2; pl.az = pl.dz + f[1] * 2.2; // approach point in front of the door
    if (pl.reserve !== false) { const fd = pl.fac ? pl.fac.d : 8; P.reserves.push({ circle: [pl.dx - f[0] * fd / 2, pl.dz - f[1] * fd / 2, (pl.fac ? Math.max(pl.fac.w, pl.fac.d) / 2 + 6 : 10)] }); }
    PL.list.push(pl); PL.byCity[c.id].push(pl);
    P.job(() => buildExterior(pl));
  }
};
function buildExterior(pl) {
  const c = pl.city; if (pl.ground) pl.groundY = pl.ground(pl, c); pl.dy = pl.groundY != null ? pl.groundY : W.heightAt(pl.dx, pl.dz); pl.ay = pl.groundY != null ? pl.groundY : W.heightAt(pl.ax, pl.az);
  try {
    if (pl.fac) { const q = pl.fac; facade(pl.dx, pl.dz, pl.face, q.w, q.d, q.h, q.wall, q.sign, q.signM, q.awnA, q.awnB, Object.assign({ y0: pl.dy }, q)); }
    else if (pl.portal !== false && pl.kind !== 'stand' && pl.kind !== 'climb') portal(pl.dx - pl.f[0] * 0.5, pl.dz - pl.f[1] * 0.5, pl.dy, pl.face);
    if (pl.outside) pl.outside(pl, c);
  } catch (e) { console.warn('place exterior ' + pl.id + ' failed: ' + e.message); }
  PL.addMarker(c.group, pl.ax, pl.ay, pl.az, pl.kind === 'deck' ? 0x57d8ff : pl.kind === 'stand' ? 0xff9a3c : pl.kind === 'climb' ? 0xff5ea8 : 0xffd23d, pl);
  if (pl.kind === 'stand' || pl.kind === 'climb') return;
  W.interactables.push({ city: c, pos: new THREE.Vector3(pl.ax, pl.ay + 1.3, pl.az), r: 4.6, place: false, door: pl,
    label: () => (PL.cur || PL.trans ? null : (pl.kind === 'deck' ? '🛗 ENTER elevator → ' + pl.name : '🚪 ENTER ' + pl.icon + ' ' + pl.name)), act: () => PL.enter(pl) });
}

// ---------------------------------------------------------------- enter / exit / decks / transitions
PL.transition = (text, mode, floors, then) => {
  PL.trans = { t: 0, dur: mode === 'door' ? 0.8 : 2.2, text, mode, floors: floors || 0, then, fired: false };
  const ov = document.getElementById('ptrans'); if (ov) { ov.style.display = 'flex'; ov.style.opacity = 0; }
  SKY.Audio.play(mode === 'door' ? 'woosh' : 'chime');
};
PL.enter = (pl) => {
  const P = SKY.Player; if (PL.trans || P.frame !== 'world' || P.dead) return;
  PL.markVisited(pl);
  if (pl.kind === 'deck') PL.transition('🛗 ' + pl.name, 'up', pl.deck.floors || 80, () => PL.goDeck(pl));
  else PL.transition(pl.icon + ' ' + pl.name, 'door', 0, () => PL.goInterior(pl));
};
PL.exit = () => {
  const cu = PL.cur; if (!cu || PL.trans) return;
  PL.transition(cu.kind === 'deck' ? '🛗 Going down…' : '🚪 Back outside', cu.kind === 'deck' ? 'down' : 'door', cu.kind === 'deck' ? (cu.place.deck.floors || 80) : 0, () => {
    const pl = cu.place; PL.clearCur(); PL.putPlayer(pl.ax + pl.f[0] * 1.2, pl.ay + 0.05, pl.az + pl.f[1] * 1.2, yawOf(pl.f[0], pl.f[1]));
    SKY.toast('📍 Back on the street at ' + pl.name, '');
  });
};
PL.putPlayer = (x, y, z, yaw) => {
  const P = SKY.Player; if (P.seat) P.leaveSeat();
  if (P.held && P.held.frame === 'plane') P.dropHeld();
  if (P.held && P.held.person) P.dropHeld();
  P.frame = 'world'; P.mode = 'foot'; P.chute = false; P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.yaw = yaw; P.pitch = -0.05; P.grounded = true; P.target = null;
  if (P.held && P.held.pos) P.held.pos.set(x, y + 1.2, z);
};
PL.goInterior = (pl) => {
  PL.clearCur();
  const c = pl.city; const spec = pl.room; const O = new THREE.Vector3(c.x - spec.w / 2, IY, c.z - spec.d / 2);
  const ctx = makeCtx(c, O, spec.w, spec.h, spec.d, { name: pl.short });
  try { pl.build(ctx, pl); } catch (e) { console.warn('interior ' + pl.id + ' failed: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  ctx.finish(); SKY.Game.scene.add(ctx.group);
  if (ctx.marker) { const m = ctx.marker; ctx.markerObj = PL.addMarker(SKY.Game.scene, O.x + m[0], O.y + m[1], O.z + m[2], m[3], 'interior'); }
  PL.cur = { place: pl, kind: 'interior', ctx, b: ctx.bounds, t: 0 };
  const sp = ctx.spawnAt || { x: spec.w / 2, z: spec.d - 3, yaw: 0 };
  PL.putPlayer(O.x + sp.x, O.y + 0.05, O.z + sp.z, sp.yaw);
  SKY.toast(pl.icon + ' Welcome to ' + pl.name + '! ' + (pl.hint || ''), 'good');
};
PL.goDeck = (pl) => {
  PL.clearCur();
  const c = pl.city, d = pl.deck; const cx = c.x + d.at[0], cz = c.z + d.at[1];
  const R = d.R || 16; const O = new THREE.Vector3(cx - R, d.y, cz - R);
  const ctx = makeCtx(c, O, R * 2, 6, R * 2, { name: pl.short + ' deck', yOff: 1 });
  try { pl.build(ctx, pl); } catch (e) { console.warn('deck ' + pl.id + ' failed: ' + e.message); }
  ctx.finish(); SKY.Game.scene.add(ctx.group);
  if (ctx.marker) { const m = ctx.marker; ctx.markerObj = PL.addMarker(SKY.Game.scene, O.x + m[0], O.y + m[1], O.z + m[2], m[3], 'interior'); }
  PL.cur = { place: pl, kind: 'deck', ctx, floor: { y: d.y, cx, cz, fn: d.floor }, t: 0 };
  const sp = ctx.spawnAt || { x: R, z: R + 8, yaw: 0 };
  PL.putPlayer(O.x + sp.x, d.y + 0.05, O.z + sp.z, sp.yaw);
  SKY.toast('🏙 ' + pl.name + ' — ' + Math.round(SKY.toFeet(d.y) / SKY.ALT_SCALE) + ' ft up! Coin telescopes, photos and the best view in town.', 'good');
  SKY.Game.achieve('deck');
};
PL.clearCur = () => {
  const cu = PL.cur; if (!cu) return; PL.cur = null; PL.setScope(null);
  const c = cu.place.city, ctx = cu.ctx;
  for (const st of ctx.structs) { W.removeStruct(st); if (c.structs) { const i = c.structs.indexOf(st); if (i >= 0) c.structs.splice(i, 1); } }
  const mk = mkInit();
  ctx.group.traverse((o) => { if (!o.isMesh) return; if (o.geometry && o.geometry !== mk.box && !(PL.sharedGeo && PL.sharedGeo(o.geometry))) o.geometry.dispose(); if (o.material && o.material !== mk.glow && o.material !== mk.lam) o.material.dispose(); if (o.userData.tex) o.userData.tex.dispose(); });
  if (ctx.group.parent) ctx.group.parent.remove(ctx.group);
  W.interactables = W.interactables.filter((it) => !it.place);
  PL.npcs = PL.npcs.filter((n) => !(n.tag && n.tag.place));
  PL.markers = PL.markers.filter((m) => { if (m.tag === 'interior') { if (m.g.parent) m.g.parent.remove(m.g); return false; } return true; });
  PL.keycard = false;
};
PL.reset = () => { PL.clearCur(); PL.trans = null; const ov = document.getElementById('ptrans'); if (ov) ov.style.display = 'none'; };
PL.inside = () => PL.cur;
PL.nearest = (x, z, maxD) => { let best = null, bd = maxD || 1e9; for (const q of PL.list) { if (!q.city.built) continue; const d = hyp(q.ax - x, q.az - z); if (d < bd) { bd = d; best = q; } } return best ? { place: best, dist: bd } : null; };
PL.hintText = () => {
  const P = SKY.Player, cu = PL.cur, T = SKY.isTouch ? 'USE' : 'F';
  if (cu) return cu.place.icon + ' ' + (cu.place.hint || cu.place.name) + (cu.kind === 'deck' ? ' · Coin telescopes 🔭 · the blue ring = elevator down' : ' · the green EXIT ring takes you back outside') + ' · 🪙 ' + S.coins;
  if (P.frame !== 'world' || P.dead) return null;
  const n = PL.nearest(P.pos.x, P.pos.z, 160); if (!n) return null;
  const q = n.place; return n.dist < 6 ? q.icon + ' ' + q.name + ' — press ' + T + ' at the glowing ring' : '✨ ' + q.icon + ' ' + q.name + ' ' + Math.round(n.dist) + ' m away — follow the glowing marker (MAP → Places lists every spot)';
};
PL.mapRef = () => (PL.cur && PL.cur.kind === 'interior' ? new THREE.Vector3(PL.cur.place.ax, 0, PL.cur.place.az) : null);
// telescope view: camera from a fixed spot, look around with the normal look controls
PL.setScope = (s) => {
  const P = SKY.Player, G = SKY.Game, ov = document.getElementById('scopeov');
  if (s) { PL.scope = Object.assign({ fov: 16 }, s, { saved: [P.yaw, P.pitch] }); P.yaw = s.yaw || P.yaw; P.pitch = s.pitch || 0; if (ov) ov.style.display = 'block'; SKY.Audio.play('beep'); SKY.toast('🔭 ' + (s.text || 'Telescope') + ' — look around · USE or JUMP to step back', ''); }
  else if (PL.scope) { const sv = PL.scope.saved; PL.scope = null; P.yaw = sv[0]; P.pitch = sv[1]; if (ov) ov.style.display = 'none'; if (G.camera) { G.camera.fov = SKY.lowSpec ? 75 : 70; G.camera.updateProjectionMatrix(); } }
};

// ---------------------------------------------------------------- physics hooks used by the player / props
PL.solid = (x, y, z) => {
  const cu = PL.cur; if (!cu) return false;
  if (cu.b) { const b = cu.b; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return y < b.y0; return y > b.y0 - 6 && y < b.y1 + 6 && x > b.x0 - 40 && x < b.x1 + 40 && z > b.z0 - 40 && z < b.z1 + 40; }
  if (cu.floor) { const f = cu.floor; if (y < f.y && y > f.y - 1.0 && f.fn(x - f.cx, z - f.cz)) return true; }
  return false;
};
PL.groundAt = (x, y, z) => {
  const cu = PL.cur; if (!cu) return -1e9;
  if (cu.b) { const b = cu.b; if (x > b.x0 - 40 && x < b.x1 + 40 && z > b.z0 - 40 && z < b.z1 + 40 && y > b.y0 - 8) return b.y0; }
  if (cu.floor) { const f = cu.floor; if (y >= f.y - 1 && f.fn(x - f.cx, z - f.cz)) return f.y; }
  return -1e9;
};

// ---------------------------------------------------------------- per-step update (called by game.js)
// returns true when player input should be frozen (transitions / telescope)
PL.preUpdate = (dt, I) => {
  const T = PL.trans;
  if (T) {
    T.t += dt; const ov = document.getElementById('ptrans'), tx = document.getElementById('ptrans-t');
    const k = T.t / T.dur; const op = clamp(Math.min(k / 0.3, (1 - k) / 0.3), 0, 1);
    if (ov) ov.style.opacity = op.toFixed(2);
    if (tx) tx.textContent = T.mode === 'door' ? T.text : T.text + '   ' + (T.mode === 'up' ? '▲ ' + Math.max(1, Math.round(clamp(k * 1.6, 0, 1) * T.floors)) : '▼ ' + Math.max(1, Math.round((1 - clamp(k * 1.6, 0, 1)) * T.floors)));
    if (!T.fired && k >= 0.5) { T.fired = true; try { T.then(); } catch (e) { console.warn('place transition failed: ' + e.message); } }
    if (k >= 1) { PL.trans = null; if (ov) ov.style.display = 'none'; }
    return true;
  }
  if (PL.scope) { if (I.edge('interact') || I.edge('jump') || I.edge('action')) { I.edges = {}; PL.setScope(null); } return true; }
  return false;
};
PL.update = (dt, camPos) => {
  PL.t += dt; const P = SKY.Player, cu = PL.cur;
  // left the place some other way (fast travel, boarded, died, restart)
  if (cu && (P.frame !== 'world' || (cu.kind === 'interior' && P.pos.y < IY - 30))) { if (P.frame === 'world' && cu.kind === 'interior') { const pl = cu.place; PL.clearCur(); PL.putPlayer(pl.ax, pl.ay + 0.05, pl.az, yawOf(pl.f[0], pl.f[1])); } else PL.clearCur(); }
  if (PL.cur) { PL.cur.t += dt; for (const f of PL.cur.ctx.anims) f(dt, PL.t); }
  // markers
  PL.markers = PL.markers.filter((m) => m.tag === 'interior' || (m.tag.city.group && m.parent === m.tag.city.group));
  for (const m of PL.markers) { if (m.g.position.distanceToSquared(camPos) > 400 * 400) { m.g.visible = false; continue; } m.g.visible = true; m.gem.rotation.y += dt * 2; m.gem.position.y = 4.4 + Math.sin(PL.t * 2.5 + m.ph) * 0.3; const s = 1 + Math.sin(PL.t * 4 + m.ph) * 0.12; m.ring.scale.set(s, 1, s); }
  // stand/outdoor anims + achievements
  for (const pl of PL.list) if (pl.city.built && pl.tick) pl.tick(pl, dt, P);
  updateNPCs(dt, camPos); renderNPCs();
};
// NPC speech bubbles (drawn by game.js through SKY.Labels)
PL.labels = (cam, add) => { let k = 0; for (const n of PL.npcs) { if (n.far || !n.p.say || k > 5) continue; const d = n.head.distanceTo(cam.position); if (d > 18) continue; add(n.head, n.p.say); k++; } };
// fast travel straight to a place entrance (plane gets parked at the city's gate)
PL.travel = (id) => {
  const pl = PL.list.find((q) => q.id === id); if (!pl) return false;
  const G = SKY.Game, P = SKY.Player, c = pl.city;
  PL.reset();
  // park the plane at this city's gate (also restarts after a crash), then step outside at the door
  const far = P.frame === 'plane' || G.plane.crashed || P.dead || G.state === 'over' || Math.hypot(G.plane.pos.x - c.x, G.plane.pos.z - c.z) > 9000;
  if (far && c.apt) G.fastTravel(c.id, 'gate'); else W.ensureCity(c);
  if (P.held && P.held.frame === 'plane') P.dropHeld();
  if (pl.ay == null) { pl.ay = W.heightAt(pl.ax, pl.az); }
  PL.putPlayer(pl.ax + pl.f[0] * 1.5, pl.ay + 0.05, pl.az + pl.f[1] * 1.5, yawOf(-pl.f[0], -pl.f[1]));
  G.camInit = false; if (G.stats) G.stats.cities.add(c.id);
  G.closeMap();
  SKY.toast('📍 ' + pl.icon + ' ' + pl.name + ' (' + c.name + ') — walk into the glowing ring and press ' + (SKY.isTouch ? 'USE' : 'F') + (c.apt ? '. Your plane is parked at ' + c.apt.code + '.' : ''), 'good');
  return true;
};
})();

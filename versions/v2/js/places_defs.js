'use strict';
// GROK SKY - the enterable places of every zone: door positions (city-local metres), storefront facades and the
// interiors / decks / stands themselves. Built by SKY.Places (places.js); mini-games live in minigames.js.
(() => {
const PL = SKY.Places, W = SKY.World, WB = SKY.WB;
const { rand, choose } = SKY;
const hyp = Math.hypot;
const M = () => SKY.Mini;
const D = PL.DEFS = {};

// ------------------------------------------------------------------ shared interior furniture (room coords)
function lightsGrid(ctx, step, m) { for (let x = step / 2; x < ctx.W - 1; x += step) for (let z = step / 2; z < ctx.D - 1; z += step) ctx.B(x - 0.5, ctx.H - 0.5, z - 0.5, x + 0.5, ctx.H, z + 0.5, m || 57); }
function counter(ctx, x0, z0, x1, z1, m, top) { ctx.B(x0, 0, z0, x1, 1, z1, m); ctx.B(x0, 1, z0, x1, 1.5, z1, top || 29); }
function shelf(ctx, x0, z0, x1, z1, cols, h) {
  h = h || 2.5; ctx.B(x0, 0, z0, x1, 0.5, z1, 37);
  const alongX = (x1 - x0) > (z1 - z0);
  for (let y = 0.5; y < h; y += 1) {
    ctx.B(x0, y + 0.5, z0, x1, y + 1, z1, 37);
    for (let a = 0; a < (alongX ? x1 - x0 : z1 - z0); a += 0.5) if (Math.random() < 0.8) { const c = cols[Math.floor(Math.random() * cols.length)]; if (alongX) ctx.F(x0 + a + 0.01, y, (z0 + z1) / 2, c); else ctx.F((x0 + x1) / 2, y, z0 + a + 0.01, c); }
  }
}
function table(ctx, x, z, m, stools, sm) {
  ctx.B(x - 0.5, 0, z - 0.5, x + 0.5, 0.5, z + 0.5, 56); ctx.B(x - 1, 0.5, z - 1, x + 1, 1, z + 1, m || 37);
  if (stools) for (const d of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]].slice(0, stools)) ctx.B(x + d[0] - 0.25, 0, z + d[1] - 0.25, x + d[0] + 0.25, 0.5, z + d[1] + 0.25, sm || 17);
}
function plant(ctx, x, z) { ctx.B(x - 0.5, 0, z - 0.5, x + 0.5, 0.5, z + 0.5, 41); ctx.sph(x, 1.3, z, 0.9, 36); }
function rug(ctx, x0, z0, x1, z1, m, edge) { for (let x = x0; x < x1; x += 0.5) for (let z = z0; z < z1; z += 0.5) ctx.F(x + 0.01, 0, z + 0.01, edge && (x < x0 + 0.5 || x >= x1 - 0.5 || z < z0 + 0.5 || z >= z1 - 0.5) ? edge : m); }
// game cabinet / slot machine standing at (x,z), screen facing `face`
function cabinet(ctx, x, z, face, body, screen, top) {
  const f = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[face];
  ctx.B(x - 0.5, 0, z - 0.5, x + 0.5, 2, z + 0.5, body); ctx.B(x - 0.5, 2, z - 0.5, x + 0.5, 2.5, z + 0.5, top || 32);
  ctx.F(x + f[0] * 0.3 - 0.24, 1.0, z + f[1] * 0.3 - 0.24, screen); ctx.F(x + f[0] * 0.3 - 0.24, 1.5, z + f[1] * 0.3 - 0.24, screen);
  ctx.F(x + f[0] * 0.75 - 0.24, 0.5, z + f[1] * 0.75 - 0.24, body);
  return [x + f[0] * 1.4, z + f[1] * 1.4];
}
function wallPaint(m1, m2, band) { return (x, y, z) => (y > band ? m2 : m1); }
const FOOD = {
  taco: { e: '🌮', n: 'Taco', heal: 22, price: 3, col: 0xf2b134 }, burrito: { e: '🌯', n: 'Burrito', heal: 35, price: 5, col: 0xe8d4a0 },
  burger: { e: '🍔', n: 'Cheeseburger', heal: 35, price: 6, col: 0xb5651d }, fries: { e: '🍟', n: 'Fries', heal: 12, price: 2, col: 0xffd54f },
  pizza: { e: '🍕', n: 'Pizza slice', heal: 28, price: 3, col: 0xff7043 }, donut: { e: '🍩', n: 'Donut', heal: 14, price: 2, col: 0xf48fb1 },
  coffee: { e: '☕', n: 'Coffee', heal: 8, price: 2, col: 0x6d4c41 }, croissant: { e: '🥐', n: 'Croissant', heal: 18, price: 2, col: 0xe0a14a },
  ramen: { e: '🍜', n: 'Tonkotsu ramen', heal: 45, price: 7, col: 0xf3e2c7 }, onigiri: { e: '🍙', n: 'Onigiri', heal: 15, price: 2, col: 0xffffff },
  lemonade: { e: '🍋', n: 'Lemonade', heal: 8, price: 2, col: 0xfff176 }, churro: { e: '🥖', n: 'Churros', heal: 14, price: 2, col: 0xc68642 },
};
const F = (k, o) => Object.assign({}, FOOD[k], o || {});
const GOODS = [33, 34, 35, 32, 47, 62, 60, 44, 43, 29];
const roomBase = (ctx, floor, wall, ceil) => { ctx.shell(floor, wall, ceil || 24); ctx.exit(ctx.W / 2, ctx.D - 1, 'n'); ctx.spawn(ctx.W / 2, ctx.D - 4, 0); };

// open-air food stand in the real world: counter, striped roof, menu sign, cook (built with the city)
function standOutside(pl, c, o) {
  const f = pl.f, alongX = pl.face === 's' || pl.face === 'n';
  // stand body sits behind the door point; origin = min corner
  const w = alongX ? 8 : 5, d = alongX ? 5 : 8; const cx = pl.dx - f[0] * 3, cz = pl.dz - f[1] * 3;
  const y = pl.dy; const O = new THREE.Vector3(cx - w / 2, y, cz - d / 2);
  const ctx = PL.makeCtx(c, O, w, 6, d, { persistent: true, name: pl.short, yOff: 1 });
  const lx = (u, v) => [w / 2 + (alongX ? u : v), d / 2 + (alongX ? v : u)]; // u along the counter, v toward the door (+)
  const sgn = alongX ? f[1] : f[0];
  const P2 = (u, v) => { const q = lx(u, sgn * v); return q; };
  ctx.B(0, -1, 0, w, 0, d, o.floor || 65);
  const a = P2(-3.5, 1.5), b = P2(3.5, 2.5); counter(ctx, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), o.body || 29, o.top || 56);
  for (const u of [-3.75, 3.75]) for (const v of [-2.25, 2.25]) { const q = P2(u, v); ctx.B(q[0] - 0.25, 0, q[1] - 0.25, q[0] + 0.25, 3.5, q[1] + 0.25, 56); }
  for (let u = -4; u < 4; u += 0.5) for (let v = -2.5; v < 3.5; v += 0.5) { const q = P2(u + 0.25, v + 0.25); ctx.F(q[0], 3.5 + (v > 2.5 ? -0.5 : 0), q[1], (Math.floor((u + 4) / 1)) % 2 ? o.awnA : o.awnB); }
  const g = P2(0, -2); ctx.B(g[0] - 1, 0, g[1] - 1, g[0] + 1, 1, g[1] + 1, 18); ctx.F(g[0] - 0.2, 1, g[1] - 0.2, 62);
  if (o.stools) for (const u of [-2.5, 0, 2.5]) { const q = P2(u, 3.6); ctx.B(q[0] - 0.25, 0, q[1] - 0.25, q[0] + 0.25, 0.5, q[1] + 0.25, 17); }
  const cook = P2(0, 0.2);
  ctx.npc(cook[0], cook[1], { name: o.cook, shirt: 0xffffff, yaw: Math.atan2(-f[0], -f[1]) + Math.PI, lines: o.lines, key: pl.id + '-cook' });
  ctx.act(cook[0] + f[0] * 3.2, 1.2, cook[1] + f[1] * 3.2, 3.6, '🍽 Order at ' + pl.name, () => { PL.markVisited(pl); M().menu(pl.icon + ' ' + pl.name, o.menu, c); });
  if (o.photo) { const q = P2(5, 4); ctx.photo(q[0], 1.2, q[1], o.photo, 2.5); }
  ctx.finish();
  SKY.signBoard(pl.dx - f[0] * 3, y + 4.1, pl.dz - f[1] * 3, [].concat(o.sign).map((t) => ({ t, m: o.signM || 32 })), 0.25, 70, 32, pl.face);
}
// elevator kiosk for decks without a usable street-level door
function booth(pl, c, sign) {
  const f = pl.f, x = pl.dx - f[0] * 2.5, z = pl.dz - f[1] * 2.5, y = pl.dy;
  WB.smallBox(x, y, z, 8, 9, 8, 0.5, (g) => { for (let j = 0; j < 9; j++) for (let k = 0; k < 8; k++) for (let i = 0; i < 8; i++) { const e = i === 0 || k === 0 || i === 7 || k === 7; if (j === 8) g.set(i, j, k, 56); else if (e) g.set(i, j, k, (i + k) % 3 === 0 ? 56 : 3); } }, { name: 'elevator kiosk' });
  PL.portal(pl.dx - f[0] * 0.5, pl.dz - f[1] * 0.5, y, pl.face, 56);
  SKY.signBoard(pl.dx + f[0] * 0.2, y + 4.6, pl.dz + f[1] * 0.2, [{ t: sign, m: 34 }], 0.5, 70, 34, pl.face);
}
function deckSign(pl, c, sign) { SKY.signBoard(pl.dx + pl.f[0] * 0.3, pl.dy + 4.2, pl.dz + pl.f[1] * 0.3, [{ t: sign, m: 34 }], 0.5, 70, 34, pl.face); }

// observation deck builder (deck coords: origin = centre - R, y=0 is the deck floor)
function deckBuild(ctx, pl, o) {
  const R = ctx.W / 2, fl = pl.deck.floor;
  for (let x = 0; x < ctx.W; x += 0.5) for (let z = 0; z < ctx.D; z += 0.5) {
    const dx = x + 0.25 - R, dz = z + 0.25 - R; if (!fl(dx, dz)) continue;
    if (!W.solidAt(ctx.O.x + x + 0.25, ctx.O.y - 0.25, ctx.O.z + z + 0.25)) ctx.F(x + 0.01, -0.5, z + 0.01, ((Math.floor(x) + Math.floor(z)) % 2) ? 21 : 66);
    // railing where a neighbour cell is outside the floor
    const edge = !fl(dx + 0.5, dz) || !fl(dx - 0.5, dz) || !fl(dx, dz + 0.5) || !fl(dx, dz - 0.5);
    if (edge && o.rail !== false) { const outer = !fl(dx + 0.5, dz) && hyp(dx + 0.5, dz) > hyp(dx, dz) || !fl(dx - 0.5, dz) && hyp(dx - 0.5, dz) > hyp(dx, dz) || !fl(dx, dz + 0.5) && hyp(dx, dz + 0.5) > hyp(dx, dz) || !fl(dx, dz - 0.5) && hyp(dx, dz - 0.5) > hyp(dx, dz); if (outer) { ctx.F(x + 0.01, 0, z + 0.01, 56); ctx.F(x + 0.01, 0.5, z + 0.01, 3); ctx.F(x + 0.01, 1.0, z + 0.01, (Math.floor((x + z) * 2) % 6 === 0) ? 57 : 56); } }
  }
  const ev = o.elev; // [x,z, faceInto]
  const fv = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[ev[2]], rt = { s: [1, 0], n: [-1, 0], e: [0, -1], w: [0, 1] }[ev[2]];
  for (let a = -1.5; a < 1.5; a += 0.5) for (let y = 0; y < 3.5; y += 0.5) ctx.F(R + ev[0] + rt[0] * a, y, R + ev[1] + rt[1] * a, (a < -1 || a >= 1 || y >= 3) ? 57 : 56);
  const mx = R + ev[0] + fv[0] * 1.8, mz = R + ev[1] + fv[1] * 1.8;
  ctx.marker = [mx, 0, mz, 0x57d8ff];
  ctx.act(mx, 1.2, mz, 3.2, '🛗 Elevator ↓ back to the street', () => PL.exit());
  for (const t of o.scopes) { // coin telescopes pointing outwards
    const x = R + t[0], z = R + t[1]; ctx.B(x - 0.25, 0, z - 0.25, x + 0.25, 1, z + 0.25, 56); ctx.B(x - 0.5, 1, z - 0.5, x + 0.5, 1.5, z + 0.5, 60); ctx.F(x - 0.25 + Math.sign(t[0]) * 0.5 * (Math.abs(t[0]) >= Math.abs(t[1])), 1.5, z - 0.25 + Math.sign(t[1]) * 0.5 * (Math.abs(t[1]) > Math.abs(t[0])), 38);
    const yaw = Math.atan2(-t[0], -t[1]);
    ctx.act(x - Math.sign(t[0]) * 1.2 * (Math.abs(t[0]) >= Math.abs(t[1])), 1.2, z - Math.sign(t[1]) * 1.2 * (Math.abs(t[1]) > Math.abs(t[0])), 2.2, '🔭 Coin telescope (1 🪙)', () => { if (!PL.spend(1)) return; PL.setScope({ x: ctx.O.x + x, y: ctx.O.y + 1.8, z: ctx.O.z + z, yaw, pitch: -0.18, fov: 14, text: pl.name + ' telescope' }); });
  }
  ctx.photo(R + o.photo[0], 1.2, R + o.photo[1], pl.name);
  for (const n of o.npcs) ctx.npc(R + n[0], R + n[1], { lines: n[2], walk: n[3] ? n[3].map((q) => [R + q[0], R + q[1]]) : null, wave: !n[3] });
  ctx.spawn(R + o.spawn[0], R + o.spawn[1], o.spawn[2]);
}

// ==================================================================== LOS ANGELES
D.LA = [
  { id: 'la-studio', short: 'studio', name: 'Grok Studios Soundstage 7', icon: '🎬', kind: 'interior', door: [300, -1412], face: 's',
    fac: { w: 26, d: 18, h: 9, wall: 25, stripe: 0, sign: 'GROK STUDIOS', signM: 32, awnA: 47, awnB: 29, trim: 32, window: 38 },
    room: { w: 34, h: 9, d: 30 }, hint: 'Star in a scene, shop the Walk of Fame and grab craft-services snacks.',
    build(ctx) {
      roomBase(ctx, (x, z) => (z > 22 ? (((Math.floor(x / 2) + Math.floor(z / 2)) % 2) ? 43 : 48) : 48), wallPaint(70, 48, 6), 24);
      // catwalk + stage lights
      ctx.B(2, 7.5, 3, 32, 8, 4, 56); ctx.B(2, 7.5, 13, 32, 8, 14, 56);
      for (let x = 4; x < 32; x += 4) { ctx.F(x, 7, 4, 32); ctx.F(x, 7, 13, 57); }
      // set 1: western saloon (north-west)
      ctx.B(2, 0, 1, 14, 6, 1.5, 37); ctx.B(2, 6, 1, 14, 6.5, 1.5, 58); ctx.txt(8, 4.5, 1.5, 'SALOON', 44, 's', 1);
      ctx.B(6.5, 0, 1.4, 9.5, 3.5, 1.6, 0); for (let x = 3; x < 14; x += 3) ctx.B(x, 0, 4, x + 0.5, 3, 4.5, 37); ctx.B(2, 3, 3.5, 14, 3.5, 5, 37);
      ctx.B(4, 0, 6, 5, 1, 7, 37); ctx.B(11, 0, 6, 12, 1, 7, 37); ctx.B(7, 0, 7, 9, 1.5, 8, 65); // hay + trough
      // set 2: spaceship bridge (north-east)
      ctx.B(19, 0, 1, 32, 0.5, 9, 39); ctx.B(19, 0.5, 1, 32, 5, 1.5, 56); for (let x = 20; x < 32; x += 1) ctx.F(x, 3, 1.5, (x % 3) ? 34 : 69);
      ctx.B(21, 0.5, 4, 30, 1.5, 5, 38); for (let x = 21; x < 30; x += 1) ctx.F(x, 1.5, 4.25, choose([34, 47, 35, 32]));
      ctx.B(24.5, 0.5, 6.5, 26.5, 1, 8.5, 17); ctx.B(24.5, 1, 8, 26.5, 2.5, 8.5, 17); // captain chair
      // green screen corner (east wall)
      ctx.B(32.5, 0, 12, 33, 7, 21, 35); ctx.B(28, 0, 12, 33, 0.5, 21, 35);
      // camera on dolly + director chair
      ctx.B(15, 0, 11, 18, 0.5, 13, 56); ctx.B(16, 0.5, 11.5, 17, 2, 12.5, 56); ctx.B(15.5, 2, 11, 17.5, 3, 13, 70); ctx.F(16.25, 2.5, 10.75, 38);
      ctx.B(19, 0, 15, 20.5, 1, 16.5, 37); ctx.B(19, 1, 16, 20.5, 2.5, 16.5, 17); ctx.txt(19.75, 1.5, 16.75, 'DIR', 29, 's', 1);
      ctx.act(16.5, 1.2, 14.5, 2.8, '🎬 Star in a scene (free!)', () => M().movie());
      ctx.photo(8, 1.2, 9, 'Hollywood Soundstage');
      // Walk of Fame gift shop (south-west)
      counter(ctx, 2, 18, 9, 19, 23, 32); shelf(ctx, 1, 20, 1.5, 27, GOODS); shelf(ctx, 3, 26, 9, 26.5, GOODS);
      ctx.txt(5.5, 3.5, 17.5, 'GIFTS', 32, 's', 1);
      ctx.npc(5.5, 17.2, { name: 'Shopkeeper Rosa', shirt: 0xffd54f, yaw: Math.PI, lines: ['Every star on the floor is a legend!', 'Oscars are 15 coins. You deserve one.', 'Hooray for Hollywood!'] });
      ctx.shop(5.5, 1.2, 20.5, '🎁 Walk of Fame gift shop', '🎁 Walk of Fame Gifts', [{ e: '🏆', n: 'Golden statuette', price: 15 }, { e: '🎬', n: 'Clapperboard', price: 8 }, { e: '🕶', n: 'Movie-star shades', price: 6 }, { e: '⭐', n: 'Walk of Fame star', price: 10 }]);
      // craft services (south-east)
      counter(ctx, 24, 18, 32, 19.5, 29, 66); ctx.F(25, 1.5, 18.5, 43); ctx.F(26, 1.5, 18.5, 62); ctx.F(29, 1.5, 18.5, 44); ctx.F(30.5, 1.5, 18.5, 18);
      ctx.txt(28, 3.5, 17.5, 'SNACKS', 29, 's', 1);
      ctx.menu(28, 1.2, 21, '🍩 Craft services snacks', '🍩 Craft Services', [F('donut'), F('coffee'), { e: '🥪', n: 'Club sandwich', heal: 28, price: 4, col: 0xd7a86e }]);
      // stars on the floor are part of the shell floor; people
      ctx.npc(17.5, 15.5, { name: 'Director Vic', shirt: 0x1b1f3a, lines: ['ACTION! ...cut. Again!', 'You! You have the face of a pilot. Want a part?', 'Quiet on set!'] });
      ctx.npc(8, 7, { name: 'Cowboy Cal', shirt: 0x8d6e63, walk: [[5, 8], [12, 8], [12, 6]], lines: ['This town ain\'t big enough for the two of us.', 'Howdy, partner.'] });
      ctx.npc(26, 6, { name: 'Captain Nova', shirt: 0x5c6bc0, sit: false, wave: true, lines: ['Set phasers to... lunch.', 'Engage!'] });
      ctx.npc(14, 20, { name: 'Grip Joe', shirt: 0x37474f, walk: [[14, 20], [22, 20], [22, 24], [14, 24]], lines: ['Mind the cables.', 'Lunch is at craft services.'] });
    } },
  { id: 'la-taco', short: 'taco', name: 'Venice Beach Tacos & Burgers', icon: '🌮', kind: 'stand', door: [-2372, -30], face: 'e',
    outside(pl, c) { standOutside(pl, c, { sign: ['TACOS', 'BURGERS'], signM: 62, awnA: 62, awnB: 29, floor: 37, stools: true, cook: 'Chef Lupe', photo: 'Venice Beach Taco Stand', lines: ['Fish tacos, fresh off the boat!', 'Burgers are smashed to order.', 'Eat on the beach, mi amor!'], menu: [F('taco', { n: 'Fish taco', heal: 25, price: 4 }), F('burger'), F('fries'), F('lemonade')] }); } },
  { id: 'la-griffith', short: 'griffith', name: 'Griffith Observatory', icon: '🔭', kind: 'interior', door: [720, -1981], face: 's', portal: true, reserve: false,
    ground: (pl, c) => W.heightAt(c.x + 720, c.z - 1990),
    outside(pl, c) { SKY.signBoard(pl.dx, pl.dy + 4.4, pl.dz + 0.3, [{ t: 'OBSERVATORY', m: 29 }], 0.5, 68, 29, 's'); },
    room: { w: 30, h: 12, d: 30 }, hint: 'Look through the big telescope, watch the pendulum and the Tesla coil.',
    build(ctx) {
      roomBase(ctx, (x, z) => { const r = hyp(x - 15, z - 13); return Math.abs(r - 5) < 0.5 ? 32 : r < 5 ? 45 : 31; }, wallPaint(25, 29, 7), (x, z) => (hyp(x - 15, z - 13) < 9 ? (Math.random() < 0.06 ? 57 : 68) : 25));
      // Foucault pendulum: pit with pegs + animated bob
      ctx.cyl(15, 13, 4, -0.5, 0, 48); for (let a = 0; a < 24; a++) ctx.F(15 + Math.cos(a / 24 * 6.283) * 3.6, 0, 13 + Math.sin(a / 24 * 6.283) * 3.6, 55);
      ctx.cyl(15, 13, 4.5, 0, 1, 56, 0.5);
      const bob = ctx.mesh(new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc9a227 })));
      const cable = ctx.mesh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 10.5, 4), new THREE.MeshBasicMaterial({ color: 0x333333 })));
      ctx.anim((dt, t) => { const sw = Math.sin(t * 0.95) * 0.3, pr = t * 0.05; const ox = Math.cos(pr) * sw, oz = Math.sin(pr) * sw; bob.position.set(15 + ox * 10.5, 1.0, 13 + oz * 10.5); cable.position.set(15 + ox * 5.25, 1.0 + 5.25, 13 + oz * 5.25); cable.rotation.set(oz * 1, 0, -ox * 1); });
      ctx.act(15, 1.2, 8.5, 2.6, '🕰 Foucault pendulum: proof the Earth spins', () => { SKY.toast('🌍 The pendulum keeps swinging in one plane while the Earth turns beneath it. Science!', ''); PL.photo('Foucault Pendulum'); });
      // planets hanging from the dome
      const planets = [[0xff9800, 1.3, 4, 4], [0x90caf9, 0.7, 25, 5], [0xd84315, 0.6, 6, 22], [0xffe082, 1.6, 24, 21], [0x64b5f6, 1.0, 9, 9]];
      for (const p of planets) { const m = ctx.mesh(new THREE.Mesh(new THREE.SphereGeometry(p[1], 12, 10), new THREE.MeshLambertMaterial({ color: p[0], emissive: p[0], emissiveIntensity: 0.25 }))); m.position.set(p[2], 9, p[3]); m.userData.spin = 1; }
      const sat = ctx.mesh(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.25, 4, 24), new THREE.MeshLambertMaterial({ color: 0xffcc80 }))); sat.position.set(24, 9, 21); sat.rotation.x = 1.2;
      // Tesla coil (cage, flickering arcs)
      ctx.cyl(25, 6, 1.6, 0, 0.5, 56); ctx.cyl(25, 6, 0.6, 0.5, 5, 55); ctx.sph(25, 5.5, 6, 1.1, 39); ctx.cyl(25, 6, 3, 0, 3, 56, 0.5);
      const arc = ctx.mesh(new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshBasicMaterial({ color: 0xb388ff, wireframe: true }))); arc.position.set(25, 5.5, 6);
      ctx.anim((dt, t) => { arc.visible = Math.sin(t * 17) + Math.sin(t * 5.3) > 0.4; arc.rotation.set(t * 7, t * 3, t * 11); arc.scale.setScalar(0.8 + Math.random() * 0.6); });
      ctx.act(25, 1.2, 9.6, 2.6, '⚡ Tesla coil demo', () => { SKY.Audio.play('clang'); SKY.toast('⚡ BZZZT! 1,000,000 volts of pure showmanship.', 'good'); });
      // big telescope (Zeiss) on a pier: view from the real observatory roof
      ctx.B(4, 0, 12, 7, 1.5, 15, 45); ctx.B(5, 1.5, 13, 6, 3, 14, 56); for (let k = 0; k < 7; k++) ctx.F(5 + k * 0.5, 3 + k * 0.5, 13.5, k > 5 ? 38 : 39);
      ctx.act(7.5, 1.2, 13.5, 2.8, '🔭 Look through the great telescope', () => { const c = ctx.c; const ox = c.x + 720, oz = c.z - 1990, sx = c.x - 200, sz = c.z - 1870;
        // raise the eyepiece above any ridge on the line of sight, then aim at the sign
        let gy = W.heightAt(ox, oz) + 19; for (let t = 0.05; t < 0.95; t += 0.05) gy = Math.max(gy, W.heightAt(ox + (sx - ox) * t, oz + (sz - oz) * t) + 6);
        const sy = W.heightAt(sx, sz) + 8, dist = Math.hypot(sx - ox, sz - oz);
        PL.setScope({ x: ox, y: gy, z: oz, yaw: Math.atan2(-(sx - ox), -(sz - oz)), pitch: Math.atan2(sy - gy, dist), fov: 12, text: 'Griffith telescope — the Hollywood Sign (look right for downtown LA)' }); PL.photo('Hollywood Sign (telescope)'); });
      // astronomy shop + astronaut snacks
      counter(ctx, 21, 22, 28, 23, 68, 34); shelf(ctx, 28.5, 18, 29, 26, GOODS);
      ctx.shop(24.5, 1.2, 24.6, '🪐 Astronomy shop', '🪐 Stellar Gift Shop', [{ e: '🌕', n: 'Moon rock (probably real)', price: 9 }, { e: '🪐', n: 'Saturn keychain', price: 4 }, { e: '🚀', n: 'Model rocket', price: 12 }]);
      ctx.menu(24.5, 1.2, 20.8, '🍨 Astronaut ice cream', '🍨 Café at the End of the Universe', [{ e: '🍨', n: 'Astronaut ice cream', heal: 12, price: 2, col: 0xf8bbd0 }, F('coffee'), { e: '🥧', n: 'Moon pie', heal: 18, price: 3, col: 0xbcaaa4 }]);
      ctx.npc(24.5, 21.8, { name: 'Astronomer Iris', shirt: 0x283593, yaw: 0, lines: ['On a clear night you can see Saturn\'s rings!', 'The telescope has been here since 1935.', 'The pendulum knocks down a peg every few minutes.'] });
      ctx.npc(10, 20, { walk: [[10, 20], [20, 20], [20, 6], [10, 6]], lines: ['Whoa, look at the dome!', 'Can we see the Hollywood sign from here?'] });
      ctx.photo(15, 1.2, 20, 'Griffith Observatory');
    } },
];

// ==================================================================== LAS VEGAS
D.LAS = [
  { id: 'las-casino', short: 'casino', name: 'Grok Royale Casino', icon: '🎰', kind: 'interior', door: [-30, -560], face: 'e',
    fac: { w: 34, d: 22, h: 12, wall: 53, sign: 'CASINO', signM: 32, awnA: 47, awnB: 32, trim: 33, window: 38, stripe: 33 },
    room: { w: 40, h: 9, d: 40 }, hint: 'Slots, roulette and blackjack — fun coins only. Cashier comps if you go broke.',
    build(ctx) {
      roomBase(ctx, (x, z) => (((x * 1.3 + z) % 4 < 2) ? 17 : 68), wallPaint(17, 53, 5), (x, z) => (((Math.floor(x) * 7 + Math.floor(z) * 3) % 17 === 0) ? 32 : 70));
      // slot machine rows
      let n = 0;
      for (const rowz of [6, 12]) for (let x = 4; x <= 16; x += 2) { const q = cabinet(ctx, x, rowz, 's', choose([47, 69, 60, 33]), 34, (x / 2) % 2 ? 32 : 47); const id = 'las-slot-' + (n++); ctx.act(q[0], 1.2, q[1], 1.3, '🎰 Play slot machine', () => M().slots(id)); }
      // chaser lights around the slot area + along walls
      const pts = []; for (let x = 2; x <= 18; x += 0.6) { pts.push([x, 3.2, 3.5]); pts.push([x, 3.2, 15]); } for (let z = 0.5; z < 39; z += 0.8) { pts.push([1, 5.5, z]); pts.push([39, 5.5, z]); }
      ctx.chaser(pts, [0xff3355, 0xffcc33, 0x33e6ff, 0xff33dd, 0x9dff3a], 0.28);
      // roulette tables
      for (const [x, z] of [[27, 8], [33, 8]]) { ctx.B(x - 2, 0, z - 1.5, x + 2, 1, z + 1.5, 37); ctx.B(x - 2, 1, z - 1.5, x + 2, 1.5, z + 1.5, 64); ctx.cyl(x - 1, z, 1, 1.5, 2, 37); ctx.cyl(x - 1, z, 0.6, 1.5, 2, 70); ctx.act(x, 1.2, z + 2.6, 2.4, '🎡 Roulette table', () => M().roulette()); }
      const wheel = ctx.mesh(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 18), new THREE.MeshLambertMaterial({ color: 0xb71c1c }))); wheel.position.set(26, 2.08, 8); ctx.anim((dt) => { wheel.rotation.y += dt * 2; });
      ctx.npc(27, 5.6, { name: 'Croupier Max', shirt: 0xffffff, pants: 0x111111, yaw: Math.PI, lines: ['Place your bets!', 'No more bets!', 'Red or black, friend?'] });
      // blackjack tables (semicircles)
      for (const [x, z] of [[27, 18], [33, 18]]) { ctx.cyl(x, z, 2.2, 0, 1, (i, j, k) => 37); ctx.cyl(x, z, 2.2, 1, 1.5, 64); ctx.B(x - 2.5, 0, z - 3, x + 2.5, 1.5, z - 1.5, 37); ctx.act(x, 1.2, z + 3, 2.4, '🃏 Blackjack', () => M().blackjack()); }
      ctx.npc(27, 15.5, { name: 'Dealer Dee', shirt: 0xffffff, pants: 0x111111, yaw: Math.PI, lines: ['Dealer stands on 17.', 'Blackjack pays 3 to 2!', 'Good luck!'] });
      ctx.npc(33, 15.5, { name: 'Dealer Sam', shirt: 0xffffff, pants: 0x111111, yaw: Math.PI, lines: ['Hit or stand?', 'Feeling lucky?'] });
      // cashier cage + bar
      ctx.B(2, 0, 22, 12, 1.5, 23, 55); for (let x = 2; x < 12; x += 1) ctx.B(x, 1.5, 22, x + 0.5, 3.5, 22.5, 32); ctx.B(2, 3.5, 22, 12, 4, 23, 55); ctx.txt(7, 4.5, 23.25, 'CASHIER', 32, 's', 1);
      ctx.act(7, 1.2, 24.4, 2.6, () => '💵 Cashier (' + PL.coins() + ' 🪙)', () => M().cashier());
      ctx.npc(7, 21.3, { name: 'Cashier Lou', shirt: 0x2e7d32, yaw: Math.PI, lines: ['Need change?', 'House always wins... but not today, maybe!'] });
      counter(ctx, 22, 26, 36, 27.5, 38, 32); shelf(ctx, 22, 29.5, 36, 30, [47, 32, 35, 34, 29]);
      ctx.menu(29, 1.2, 25, '🍸 Casino bar', '🍸 Lucky 7 Bar', [{ e: '🍹', n: 'Mocktail', heal: 10, price: 2, col: 0xff4081 }, { e: '🥤', n: 'Soda', heal: 6, price: 1, col: 0x8d6e63 }, { e: '🥨', n: 'Pretzels', heal: 10, price: 2, col: 0xc68642 }]);
      for (const x of [24, 28, 32]) ctx.B(x, 0, 24, x + 0.5, 0.5, 24.5, 17);
      // chandeliers
      for (const [x, z] of [[10, 9], [30, 13], [20, 28]]) { ctx.sph(x, 7.4, z, 1.2, (i, j, k) => ((i + j + k) % 2 ? 53 : 57)); ctx.B(x - 0.25, 8, z - 0.25, x + 0.25, 9, z + 0.25, 55); }
      for (const [x, z] of [[18, 30], [14, 34], [30, 34]]) plant(ctx, x, z);
      ctx.photo(20, 1.2, 20, 'Vegas Casino Floor');
      ctx.npc(9, 9, { walk: [[9, 9], [19, 9], [19, 16], [9, 16]], lines: ['Come on, lucky sevens!', 'I\'m up 40 coins!', 'One more spin...'] });
      ctx.npc(5, 13.5, { sit: true, name: 'Grandma Pearl', yaw: Math.PI, lines: ['This one is MY machine, honey.', 'Jackpot was last Tuesday.'] });
      ctx.npc(24, 22, { walk: [[24, 22], [34, 22], [34, 12]], shirt: 0xffd54f, lines: ['Is this the buffet?', 'The lights! The sounds!'] });
    } },
  { id: 'las-buffet', short: 'buffet', name: 'Golden Buffet', icon: '🍤', kind: 'interior', door: [30, -660], face: 'w',
    fac: { w: 26, d: 18, h: 9, wall: 25, sign: 'BUFFET', signM: 32, awnA: 32, awnB: 47, trim: 32, window: 53 },
    room: { w: 30, h: 7, d: 26 }, hint: 'All you can eat: 10 coins for a full heal!',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? 25 : 31), wallPaint(37, 25, 3), 25);
      lightsGrid(ctx, 6, 32);
      // buffet lines (sneeze guards)
      for (const z of [5, 11]) { ctx.B(4, 0, z, 26, 1, z + 1.5, 56); for (let x = 4.5; x < 26; x += 1.5) ctx.F(x, 1, z + 0.5, choose([62, 44, 47, 35, 29, 41, 64])); ctx.B(4, 2, z + 0.5, 26, 2.5, z + 1, 3); ctx.B(4, 1, z + 0.5, 4.5, 2, z + 1, 56); ctx.B(25.5, 1, z + 0.5, 26, 2, z + 1, 56); }
      ctx.B(4, 0, 1, 26, 1, 2.5, 56); ctx.B(12, 1, 1.5, 18, 3, 2, 32); ctx.txt(15, 4, 2.6, 'ALL YOU CAN EAT', 32, 's', 1);
      ctx.act(15, 1.2, 8.2, 3, '🍤 All-you-can-eat buffet (10 🪙 = full heal)', () => M().menu('🍤 Golden Buffet', [{ e: '🍽', n: 'All-you-can-eat plate', heal: 100, price: 10, col: 0xffcc66 }, { e: '🦐', n: 'Shrimp cocktail', heal: 20, price: 3, col: 0xff8a65 }, { e: '🍰', n: 'Dessert plate', heal: 18, price: 3, col: 0xf8bbd0 }, { e: '🥩', n: 'Prime rib', heal: 40, price: 6, col: 0x8d4b3b }], ctx.c));
      for (const [x, z] of [[6, 16], [12, 16], [18, 16], [24, 16], [9, 20.5], [21, 20.5]]) table(ctx, x, z, 29, 4, 17);
      ctx.npc(15, 3.5, { name: 'Chef Antoine', shirt: 0xffffff, yaw: Math.PI, lines: ['The crab legs are fresh!', 'Seconds? Thirds? Go for it!'] });
      ctx.npc(6, 14.5, { sit: true, yaw: Math.PI, lines: ['I\'ve been here since breakfast.', 'Fourth plate. No regrets.'] });
      ctx.npc(18, 17.5, { sit: true, yaw: 0, lines: ['Mmm, the prime rib!'] });
      ctx.npc(10, 9, { walk: [[6, 9], [24, 9]], lines: ['Where are the desserts?', 'So many choices!'] });
      ctx.photo(15, 1.2, 13.5, 'Vegas Buffet');
    } },
  { id: 'las-strat', short: 'strat', name: 'STRAT SkyPod Deck', icon: '🗼', kind: 'deck', door: [94, -1650], face: 'w', fac: null, portal: false,
    outside(pl, c) { booth(pl, c, 'STRAT SKYPOD'); },
    deck: { at: [110, -1650], y: 196, R: 16, floors: 108, floor: (dx, dz) => { const r = hyp(dx, dz); return r <= 14 && r > 1.6; } },
    build(ctx, pl) {
      deckBuild(ctx, pl, { elev: [0, 2.5, 's'], scopes: [[12, 0], [-12, 0], [0, -12], [0, 12]], photo: [6, -6], spawn: [0, 5.5, Math.PI], npcs: [[-6, 6, ['The whole Strip is lit up!', 'I can see the airport!']], [5, -8, ['My knees are shaking.'], [[5, -8], [8, 2], [-2, 9], [-8, -2]]]] });
      ctx.cyl(16, 16, 1.6, 0, 5.5, 21); ctx.cyl(16, 16, 1.7, 5.5, 6, 47);
      // SkyJump platform
      ctx.B(29, -0.5, 14.5, 32, 0, 17.5, 63); ctx.txt(28.6, 2.3, 16, 'SKYJUMP', 63, 'w', 1);
      ctx.act(28, 1.2, 16, 2.6, '🪂 SKYJUMP off the tower!', () => { const P = SKY.Player; const x = ctx.O.x + 33.5, z = ctx.O.z + 16, y = ctx.O.y + 0.5; PL.clearCur(); PL.putPlayer(x, y, z, -Math.PI / 2); P.vel.set(5, 2, 0); P.grounded = false; P.chute = true; SKY.Audio.play('whoop'); SKY.toast('🪂 SKYJUMP! Wheeee! (Parachute deployed, steer with the stick)', 'good'); SKY.Game.achieve('deck'); });
    } },
];

// ==================================================================== AREA 51
D.A51 = [
  { id: 'a51-hangar', short: 'hangar', name: 'Hangar 18 (Restricted)', icon: '🛸', kind: 'interior', face: 'w', reserve: false,
    doorFn: (c) => { const a = c.apt; return [a.ax + a.side * 220 - 21, a.az - a.L / 2 - 110 + 14]; },
    outside(pl, c) { SKY.signBoard(pl.dx + 0.3, pl.dy + 4.4, pl.dz, [{ t: 'HANGAR 18', m: 63 }, { t: 'NO ENTRY', m: 47 }], 0.5, 70, 63, 'w'); },
    room: { w: 40, h: 14, d: 44 }, hint: 'Find the keycard to open the secret lab…',
    build(ctx) {
      const lab = 16; // lab occupies z < lab
      ctx.shell((x, z) => (z < lab ? 29 : ((Math.floor(x / 4) + Math.floor(z / 4)) % 2 ? 66 : 21)), (x, y, z) => (z < lab ? (y > 4 ? 48 : 56) : (y < 1 ? 63 : 40)), (x, z) => (z < lab ? 48 : ((Math.floor(x) % 6) ? 40 : 57)));
      ctx.exit(20, 43, 'n', '🚪 EXIT (act natural)'); ctx.spawn(20, 39.5, 0);
      // the saucer on a cradle
      ctx.cyl(20, 28, 2, 0, 1.5, 56); ctx.cyl(20, 28, 7, 1.5, 2.5, 39); ctx.cyl(20, 28, 5.5, 2.5, 3.5, 39); ctx.sph(20, 3.5, 28, 2.6, (i, j, k) => (j * 0.5 > 3.5 + 0.5 ? 3 : 39));
      for (let a = 0; a < 12; a++) ctx.F(20 + Math.cos(a / 12 * 6.283) * 6.5, 1.5, 28 + Math.sin(a / 12 * 6.283) * 6.5, 49);
      ctx.act(20, 1.2, 35.5, 3, '🛸 Inspect the saucer', () => { SKY.Audio.play('chime'); SKY.toast('🛸 The hull is warm. Something inside hums back at you…', ''); PL.photo('The Saucer (Hangar 18)'); });
      // crates, forklift, scaffold
      for (const [x, z, s] of [[4, 20, 2], [4, 23, 2], [6.5, 20, 2], [34, 34, 3], [34, 38, 2], [31, 38, 2]]) { ctx.B(x, 0, z, x + s, s, z + s, 37); ctx.B(x, s / 2 - 0.25, z + s, x + s, s / 2 + 0.25, z + s + 0.02, 47); }
      ctx.B(30, 0, 22, 34, 1, 25, 63); ctx.B(30, 1, 22, 31.5, 3, 25, 63); ctx.B(34, 0, 23, 36, 0.5, 24, 56);
      // desk with the keycard
      ctx.B(8, 0, 32, 12, 1, 34, 56); ctx.B(8, 1, 32, 12, 1.5, 34, 66); ctx.B(9, 1.5, 32.5, 10, 2.5, 33, 38); ctx.F(9.25, 2, 33, 35);
      const card = ctx.mesh(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.32), new THREE.MeshBasicMaterial({ color: 0x9dff3a }))); card.position.set(11, 1.55, 33);
      ctx.anim((dt, t) => { card.visible = !PL.keycard; card.rotation.y = t; card.position.y = 1.6 + Math.sin(t * 3) * 0.05; });
      ctx.act(11, 1.2, 35.2, 2.4, () => (PL.keycard ? '🖥 Terminal: ACCESS LEVEL 5' : '🪪 Grab the keycard'), () => { if (!PL.keycard) { PL.keycard = true; SKY.Audio.play('ok'); SKY.toast('🪪 Got keycard "MAJESTIC-12". The lab door is at the north end…', 'good'); } else SKY.toast('🖥 > PROJECT: GROK SKY  > STATUS: [REDACTED]', ''); });
      // keycard wall + door into the lab
      ctx.B(0, 0, lab - 1, 18, 14, lab, 56); ctx.B(22, 0, lab - 1, 40, 14, lab, 56); ctx.B(18, 4, lab - 1, 22, 14, lab, 56);
      ctx.txt(20, 5, lab + 0.01, 'LAB', 47, 's', 2); ctx.B(23, 1, lab, 23.5, 2, lab + 0.5, 47);
      // the door itself is its own struct so it can be removed
      const doorSt = WB.newStruct(ctx.O.x + 18, ctx.O.y, ctx.O.z + lab - 1, 8, 8, 2, 0.5, { name: 'lab door' }); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) for (let k = 0; k < 2; k++) doorSt.grid.set(i, j, k, (i === 0 || i === 7 || j === 7) ? 63 : ((i + j) % 4 ? 56 : 48)); ctx.structs.push(doorSt);
      let open = false;
      ctx.act(20, 1.2, lab + 1.4, 2.8, () => (open ? null : PL.keycard ? '🪪 Swipe keycard: open the lab' : '🔒 Keycard door (find a keycard)'), () => {
        if (open) return; if (!PL.keycard) { SKY.Audio.play('error'); SKY.toast('🔒 ACCESS DENIED. A keycard might be lying around somewhere…', 'warn'); return; }
        open = true; SKY.Audio.play('woosh'); W.removeStruct(doorSt); const cs = ctx.c.structs, i = cs.indexOf(doorSt); if (i >= 0) cs.splice(i, 1); ctx.structs = ctx.structs.filter((s) => s !== doorSt);
        SKY.toast('🔓 ACCESS GRANTED. Welcome to the lab, Agent.', 'good');
      });
      // the lab: specimen tanks with aliens, bubbles, terminals
      const bub = [];
      for (const [x, z] of [[5, 5], [11, 4], [29, 4], [35, 5], [8, 10.5], [32, 10.5]]) {
        ctx.cyl(x, z, 1.6, 0, 0.5, 56); ctx.cyl(x, z, 1.6, 4.5, 5, 56); ctx.cyl(x, z, 1.5, 0.5, 4.5, 3, 0.5); ctx.cyl(x, z, 1.4, 0.5, 0.6, 49);
        ctx.B(x - 0.25, 0.5, z - 0.25, x + 0.25, 2.5, z + 0.25, 49); ctx.sph(x, 3, z, 0.55, 49); ctx.B(x - 0.75, 1.5, z - 0.25, x + 0.75, 2, z + 0.25, 49); ctx.F(x - 0.35, 3, z + 0.3, 70); ctx.F(x + 0.1, 3, z + 0.3, 70);
        for (let b = 0; b < 3; b++) { const m = ctx.mesh(new THREE.Mesh(PL_BUB(), new THREE.MeshBasicMaterial({ color: 0xccffcc }))); m.position.set(x, rand(0.6, 4.4), z); bub.push([m, x, z, rand(0.6, 1.4)]); }
        ctx.act(x, 1.2, z + 2.6, 2.3, '👽 Tap the glass', () => { SKY.Audio.play('bonk'); SKY.toast(choose(['👽 It… blinked.', '👽 It waved at you!', '👽 *muffled bloop*', '👽 It pressed its hand against the glass.']), 'good'); SKY.Game.achieve('xfiles'); PL.photo('Alien Specimen'); });
      }
      ctx.anim((dt) => { for (const b of bub) { b[0].position.y += dt * b[3]; if (b[0].position.y > 4.4) b[0].position.y = 0.6; b[0].position.x = b[1] + Math.sin(b[0].position.y * 3) * 0.3; } });
      for (let x = 15; x < 26; x += 1.5) { ctx.B(x, 0, 2, x + 1, 1, 3, 56); ctx.F(x + 0.25, 1, 2.25, (x % 3) ? 35 : 34); ctx.F(x + 0.25, 1.5, 2.25, 38); }
      ctx.txt(20, 6, 1.01, 'MAJESTIC 12', 49, 's', 1);
      ctx.act(20, 1.2, 4.6, 2.4, '🖥 Read the classified files', () => { SKY.toast('📁 ROSWELL 1947: "weather balloon" (lol). GROOM LAKE: test pilot program for "the visitors".', ''); SKY.Game.achieve('xfiles'); });
      ctx.npc(20, 8, { name: 'Dr. Okafor', shirt: 0xffffff, walk: [[14, 8], [26, 8], [26, 12], [14, 12]], lines: ['You are not supposed to be in here.', 'Specimen 4 has been restless.', 'Don\'t tap the glass!'] });
      ctx.npc(26, 30, { name: 'Dr. Stein', shirt: 0xffffff, walk: [[26, 30], [26, 36], [14, 36], [14, 30]], lines: ['The propulsion is... impossible.', 'Do you have clearance?'] });
      ctx.npc(30, 40, { name: 'Sgt. Hayes', shirt: 0x556b2f, pants: 0x556b2f, lines: ['Move along, civilian.', 'Nothing to see here.', 'You did NOT see a saucer.'] });
      ctx.photo(15, 1.2, 20, 'Hangar 18');
      lightsGrid(ctx, 8, 57);
    } },
];
let _bub = null; function PL_BUB() { return _bub || (_bub = new THREE.SphereGeometry(0.09, 5, 4)); }
PL.sharedGeo = (g) => g === _bub;

// ==================================================================== MEXICO CITY
D.MEX = [
  { id: 'mex-mercado', short: 'mercado', name: 'Mercado de la Merced', icon: '🌮', kind: 'interior', door: [-125, 40], face: 'e',
    fac: { w: 30, d: 20, h: 8, wall: 54, sign: 'MERCADO', signM: 62, awnA: 64, awnB: 47, trim: 44, window: 64, board: 70 },
    room: { w: 34, h: 8, d: 30 }, hint: 'Tacos al pastor, churros, aguas frescas and souvenirs.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 41 : 54), wallPaint(64, 50, 3), 24);
      // papel picado garlands
      for (let z = 4; z < 28; z += 4) for (let x = 1; x < 33; x += 0.5) if ((x * 2) % 3 < 2) ctx.F(x, 6.5 - Math.sin(x / 33 * Math.PI) * 0.5, z, [33, 44, 34, 35, 62, 69][Math.floor(x) % 6]);
      const stall = (x, z, col, sign, menuTitle, items, cookName, lines) => {
        ctx.B(x - 3, 0, z - 1, x + 3, 1, z, col); ctx.B(x - 3, 1, z - 1, x + 3, 1.5, z, 29);
        for (const dx of [-3, 2.5]) ctx.B(x + dx, 0, z - 4, x + dx + 0.5, 3.5, z - 3.5, 37);
        for (let a = -3; a < 3; a += 0.5) for (let b = -4; b < 0.5; b += 0.5) ctx.F(x + a, 3.5, z + b, Math.floor((a + 3)) % 2 ? col : 29);
        ctx.txt(x, 4.2, z + 0.51, sign, 29, 's', 1);
        ctx.npc(x, z - 2, { name: cookName, shirt: 0xffffff, yaw: Math.PI, lines });
        ctx.menu(x, 1.2, z + 1.6, '🍽 ' + menuTitle, menuTitle, items, 2.6);
      };
      stall(7, 6, 47, 'PASTOR', '🌮 Tacos El Güero', [F('taco', { n: 'Taco al pastor', heal: 24 }), F('burrito'), { e: '🥑', n: 'Guacamole & totopos', heal: 14, price: 2, col: 0x7cb342 }], 'Don Güero', ['¡Pásele, pásele!', 'Al pastor con piña, joven?', 'Con todo?']);
      stall(17, 6, 62, 'CHURROS', '🥖 Churrería', [F('churro'), { e: '🍫', n: 'Chocolate caliente', heal: 10, price: 2, col: 0x5d4037 }, { e: '🍮', n: 'Flan', heal: 16, price: 3, col: 0xffcc80 }], 'Doña Mari', ['Churros calientitos!', 'Con azúcar y canela.']);
      stall(27, 6, 35, 'AGUAS', '🥤 Aguas Frescas', [{ e: '🍉', n: 'Agua de sandía', heal: 10, price: 1, col: 0xef5350 }, { e: '🌺', n: 'Agua de jamaica', heal: 10, price: 1, col: 0xad1457 }, { e: '🥭', n: 'Mango con chile', heal: 14, price: 2, col: 0xffb300 }], 'Lupita', ['Bien fría!', 'De horchata, jamaica o sandía.']);
      // fruit & piñata stalls
      for (let x = 2; x < 12; x += 1) for (let z = 13; z < 16; z += 1) ctx.F(x, 0.5 + (z - 13) * 0.25, z, choose([44, 47, 62, 35, 64]));
      ctx.B(2, 0, 13, 12, 0.5, 16, 37);
      for (const [x, z, c] of [[22, 13, 33], [25, 14, 44], [28, 13, 34]]) { ctx.sph(x, 4.5, z, 0.8, c); ctx.B(x - 0.1, 5.3, z - 0.1, x + 0.1, 8, z + 0.1, 29); }
      ctx.B(19, 0, 15, 31, 1, 16.5, 37); shelf(ctx, 19, 17.5, 31, 18, [33, 44, 34, 35, 62, 69, 59]);
      ctx.shop(25, 1.2, 14, '🎁 Artesanías (souvenirs)', '🎁 Artesanías', [{ e: '🪅', n: 'Piñata', price: 8 }, { e: '💀', n: 'Sugar skull', price: 5 }, { e: '🪇', n: 'Maracas', price: 4 }, { e: '👒', n: 'Sombrero', price: 10 }]);
      ctx.npc(25, 17, { name: 'Don Pepe', shirt: 0x8d6e63, yaw: 0, lines: ['Hecho a mano!', 'Para tu mamá, un recuerdo?'] });
      // mariachi band
      for (const [i, sh] of [[0, 0x111111], [1, 0x111111], [2, 0x111111]]) ctx.npc(8 + i * 2, 22, { name: 'Mariachi ' + ['Juan', 'Chuy', 'Beto'][i], shirt: sh, pants: 0x111111, wave: true, lines: ['🎺 Ay ay ay ay, canta y no llores!', '🎻 Cielito lindo…', '🎸 ¡Otra! ¡Otra!'] });
      ctx.act(10, 1.2, 25, 3, '🎺 Request a song from the mariachis (2 🪙)', () => { if (!PL.spend(2)) return; SKY.Audio.play('chime'); SKY.toast('🎶 The mariachis play "Cielito Lindo" just for you! 🎺🎻🎸', 'good'); for (const n of PL.npcs) if (n.p.name && n.p.name.startsWith('Mariachi')) n.p.talk('🎶 Ay, ay, ay, ay…', 4); });
      for (const [x, z] of [[20, 23], [26, 23]]) table(ctx, x, z, 64, 3, 47);
      ctx.npc(20, 21.5, { sit: true, yaw: Math.PI, lines: ['¡Qué rico!', 'Best tacos in the city.'] });
      ctx.photo(17, 1.2, 12, 'Mercado de la Merced');
    } },
  { id: 'mex-cart', short: 'cart', name: 'Zócalo Taco Cart', icon: '🌯', kind: 'stand', door: [70, 75], face: 's',
    outside(pl, c) { standOutside(pl, c, { sign: 'TACOS', signM: 44, awnA: 64, awnB: 47, stools: false, cook: 'Don Chava', lines: ['¡Tacos de suadero!', 'Salsa verde o roja?'], menu: [F('taco', { n: 'Taco de suadero' }), F('burrito', { n: 'Gringa' }), { e: '🌽', n: 'Elote', heal: 14, price: 2, col: 0xffeb3b }] }); } },
  { id: 'mex-cathedral', short: 'cathedral', name: 'Catedral Metropolitana', icon: '⛪', kind: 'interior', door: [0, -127.2], face: 's', reserve: false,
    room: { w: 26, h: 16, d: 40 }, hint: 'Light a candle and admire the golden Altar of the Kings.',
    build(ctx) {
      roomBase(ctx, (x, z) => (Math.abs(x - 13) < 1.5 ? 17 : ((Math.floor(x) + Math.floor(z)) % 2 ? 45 : 31)), (x, y, z) => ((y > 4 && y < 10 && Math.floor(z) % 6 === 3) ? [47, 60, 44, 69][Math.floor(z / 6) % 4] : 45), (x, z) => ((Math.floor(z) % 4 === 0) ? 31 : 45));
      // columns
      for (let z = 6; z < 34; z += 6) for (const x of [6, 20]) ctx.cyl(x, z, 0.8, 0, 16, 45);
      // pews
      for (let z = 12; z < 34; z += 2.5) for (const [x0, x1] of [[2.5, 10.5], [15.5, 23.5]]) { ctx.B(x0, 0, z, x1, 1, z + 0.5, 37); ctx.B(x0, 0, z + 0.5, x1, 2, z + 1, 37); }
      // golden altar (Altar de los Reyes)
      ctx.B(4, 0, 1, 22, 1, 5, 45); ctx.B(8, 1, 2, 18, 2, 3.5, 32);
      for (let y = 0; y < 13; y += 0.5) for (let x = 5; x < 21; x += 0.5) { const w = 8 - y * 0.4; if (Math.abs(x - 13) < w) ctx.F(x, y + 1, 1, (Math.floor(x * 2 + y * 2) % 5 === 0) ? 57 : (Math.floor(y) % 3 === 0 ? 55 : 32)); }
      ctx.B(12.5, 3, 1.5, 13.5, 8, 2, 29); ctx.B(11, 6, 1.5, 15, 7, 2, 29);
      // candle racks
      const flames = [];
      for (const x of [3, 21]) { ctx.B(x - 1, 0, 9, x + 1, 1, 10, 55); }
      const lit = []; ctx.act(4.5, 1.2, 9.5, 2.4, '🕯 Light a candle (1 🪙)', () => { if (!PL.spend(1)) return; const m = ctx.mesh(new THREE.Mesh(PL_BUB(), new THREE.MeshBasicMaterial({ color: 0xffb300 }))); m.position.set(2.2 + (lit.length % 4) * 0.5, 1.15, 9.3 + Math.floor(lit.length / 4) % 2 * 0.4); lit.push(m); flames.push(m); SKY.Audio.play('chime'); SKY.toast('🕯 You light a candle. A moment of peace…', 'good'); if (lit.length === 1) PL.photo('Catedral Metropolitana candles'); });
      ctx.anim((dt, t) => { for (const f of flames) f.scale.setScalar(1 + Math.sin(t * 20 + f.position.x * 9) * 0.25); });
      ctx.photo(13, 1.2, 8, 'Catedral Metropolitana');
      ctx.act(13, 1.2, 25, 2, '🙏 Sit quietly in a pew', () => { SKY.Player.hp = Math.min(100, SKY.Player.hp + 10); SKY.toast('🙏 A peaceful moment. (+10 HP)', 'good'); });
      ctx.npc(13, 6, { name: 'Padre Miguel', shirt: 0x111111, pants: 0x111111, lines: ['Bienvenido, hijo.', 'The cathedral took 250 years to build.', 'The floor is sinking a little every year…'] });
      ctx.npc(8, 18, { sit: true, yaw: 0, lines: ['Shhh…'] }); ctx.npc(18, 23, { sit: true, yaw: 0, lines: ['…amén.'] });
      ctx.npc(12, 30, { walk: [[12, 30], [12, 12], [14, 12], [14, 30]], lines: ['¡Qué bonito!', 'Look at the gold!'] });
      lightsGrid(ctx, 8, 32);
    } },
  { id: 'mex-pyramid', short: 'pyramid', name: 'Pyramid of the Sun (climb)', icon: '🔺', kind: 'climb', door: [3720 - 112 - 23, -3300], face: 'w', reserve: false, groundY: 0,
    outside(pl, c) {
      const x0 = c.x + 3720 - 112, z = c.z - 3300; const insets = [0, 5, 10, 15, 20];
      // stairs up the west face: one flight per tier
      for (let t = 0; t < 5; t++) {
        const wx = x0 + insets[t] * 4; const y0 = 12 * t;
        WB.smallBox(wx - 9, y0, z, 37, 26, 12, 0.5, (g) => { for (let i = 0; i < 37; i++) { const top = Math.min(24, Math.floor((i + 1) / 1.5)); for (let k = 0; k < 12; k++) for (let j = 0; j <= top && j < 26; j++) g.set(i, j, k, (k === 0 || k === 11) ? 45 : (j === top ? 65 : 31)); } }, { name: 'pyramid stairs' });
      }
      // summit: altar, flag, photo spot
      const tx = c.x + 3720, ty = 60;
      WB.smallBox(tx, ty, z, 6, 4, 6, 0.5, (g) => { g.box(0, 0, 0, 5, 1, 5, 45); g.box(1, 2, 1, 4, 2, 4, 59); g.box(2, 3, 2, 3, 3, 3, 62); }, { name: 'summit altar' });
      WB.smallBox(tx + 4, ty, z + 4, 4, 20, 2, 0.5, (g) => { g.box(0, 0, 0, 0, 19, 0, 56); for (let j = 13; j < 20; j++) for (let i = 1; i < 4; i++) g.set(i, j, 0, i === 1 ? 64 : i === 2 ? 29 : 67); g.box(1, 13, 1, 3, 19, 1, 0); }, { name: 'summit flag' });
      const ctx = PL.makeCtx(c, new THREE.Vector3(tx - 10, ty, z - 10), 20, 4, 20, { persistent: true, name: 'summit' });
      ctx.photo(10, 1.2, 14, 'Summit of the Pyramid of the Sun', 3);
      ctx.act(14, 1.2, 10, 2.6, '🌄 Admire the Avenue of the Dead', () => { SKY.toast('🌄 The Avenue of the Dead stretches north to the Pyramid of the Moon. You climbed 248 steps!', 'good'); SKY.Game.achieve('summit'); });
      ctx.finish();
      SKY.signBoard(pl.dx + 2, 0, pl.dz + 22, [{ t: 'CLIMB', m: 62 }, { t: 'TEOTIHUACAN', m: 44 }], 0.5, 70, 44, 'w');
    },
    tick(pl, dt, P) { if (P.frame === 'world' && P.pos.y > 58 && Math.abs(P.pos.x - (pl.city.x + 3720)) < 22 && Math.abs(P.pos.z - (pl.city.z - 3300)) < 22 && !pl.summited) { pl.summited = true; PL.markVisited(pl); SKY.Audio.play('whoop'); SKY.toast('🔺 You reached the summit of the Pyramid of the Sun! (+5 🪙)', 'good'); PL.earn(5); SKY.Game.achieve('summit'); } if (P.pos.y < 40 && pl.summited && Math.hypot(P.pos.x - (pl.city.x + 3720), P.pos.z - (pl.city.z - 3300)) > 200) pl.summited = false; } },
];

// ==================================================================== NEW YORK
D.NYC = [
  { id: 'nyc-candy', short: 'candy', name: 'Times Square Candy & Toy World', icon: '🍬', kind: 'interior', door: [-70, 600], face: 'e',
    fac: { w: 26, d: 18, h: 14, wall: 47, sign: 'CANDY TOYS', signM: 44, awnA: 44, awnB: 47, trim: 34, window: 34, stripe: 44 },
    room: { w: 30, h: 8, d: 28 }, hint: 'A wall of candy, giant teddy bears and NYC souvenirs.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? 29 : 44), wallPaint(33, 34, 4), 29);
      lightsGrid(ctx, 5, 57);
      // candy wall: tubes of colourful candy (glowing)
      for (let x = 2; x < 28; x += 1) for (let y = 0.5; y < 5; y += 0.5) ctx.F(x, y, 1, [47, 32, 35, 34, 33, 62, 69][(x + Math.floor(y * 2)) % 7]);
      for (let x = 1.5; x < 28.5; x += 3) ctx.B(x, 0, 1, x + 0.5, 5.5, 1.5, 3);
      ctx.txt(15, 5.5, 1.51, 'CANDY WALL', 29, 's', 1);
      ctx.menu(15, 1.2, 3.6, '🍫 Candy wall', '🍬 Candy Wall', [{ e: '🍫', n: 'Chocolate candies', heal: 10, price: 2, col: 0x6d4c41 }, { e: '🍭', n: 'Giant lollipop', heal: 8, price: 1, col: 0xff4081 }, { e: '🧁', n: 'Cupcake', heal: 15, price: 3, col: 0xf8bbd0 }, F('donut', { n: 'NYC black & white cookie' })]);
      // giant mascot statues
      for (const [x, z, c] of [[5, 10, 47], [25, 10, 35]]) { ctx.cyl(x, z, 1.8, 0, 3.6, c); ctx.sph(x, 3.2, z, 1.9, c); ctx.F(x - 0.75, 3.5, z + 1.7, 29); ctx.F(x + 0.25, 3.5, z + 1.7, 29); ctx.F(x - 0.75, 3.5, z + 1.9, 70); ctx.F(x + 0.25, 3.5, z + 1.9, 70); ctx.B(x - 2.5, 1.5, z - 0.25, x + 2.5, 2, z + 0.25, c); }
      ctx.photo(5, 1.2, 13.5, 'Times Square Candy Store');
      // teddy bear pyramid + toy shelves
      for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) ctx.sph(14 + (j - i / 2) * 1.6, (3 - i) * 1.3 + 0.7, 12, 0.7, [62, 37, 43, 29][i]);
      shelf(ctx, 1, 16, 1.5, 24, GOODS); shelf(ctx, 28.5, 16, 29, 24, GOODS); shelf(ctx, 9, 18, 21, 18.5, GOODS);
      counter(ctx, 18, 21.5, 26, 22.5, 60, 29);
      ctx.shop(22, 1.2, 24, '🎁 NYC souvenirs', '🗽 Big Apple Souvenirs', [{ e: '🗽', n: 'Mini Statue of Liberty', price: 8 }, { e: '🧸', n: 'Giant teddy bear', price: 14 }, { e: '🍎', n: '"I ❤ NY" T-shirt', price: 6 }, { e: '🚕', n: 'Toy taxi', price: 5 }]);
      ctx.npc(22, 20.8, { name: 'Clerk Tony', shirt: 0x1565c0, yaw: Math.PI, lines: ['Welcome to the crossroads of the world!', 'Fuhgeddaboudit — best candy in Manhattan.'] });
      ctx.npc(12, 8, { walk: [[8, 7], [22, 7], [22, 14], [8, 14]], lines: ['Mom, can I get the giant bear?', 'So much candy!!'] });
      ctx.npc(6, 20, { walk: [[4, 20], [8, 25], [4, 25]], lines: ['Is this the M&M store?', 'I need ALL the colours.'] });
    } },
  { id: 'nyc-arcade', short: 'arcade', name: 'Broadway Arcade', icon: '🕹', kind: 'interior', door: [-70, 680], face: 'e',
    fac: { w: 24, d: 18, h: 10, wall: 70, sign: 'ARCADE', signM: 33, awnA: 33, awnB: 34, trim: 33, window: 69 },
    room: { w: 28, h: 7, d: 26 }, hint: 'GROK INVADERS, the claw machine and skee-ball. Win coins!',
    build(ctx) {
      roomBase(ctx, (x, z) => (((Math.floor(x) * 7 + Math.floor(z) * 3) % 11 === 0) ? 69 : ((Math.floor(x) + Math.floor(z)) % 9 === 0 ? 34 : 70)), wallPaint(68, 70, 4), 70);
      for (let x = 1; x < 27; x += 2) ctx.F(x, 6.5, 1, x % 4 ? 33 : 34);
      const cabs = [[4, 4, 's', 47, 'nyc-inv-1', 'GROK INVADERS'], [7, 4, 's', 60, 'nyc-inv-2', 'GROK INVADERS'], [10, 4, 's', 69, 'nyc-inv-3', 'GROK INVADERS']];
      for (const q of cabs) { const a = cabinet(ctx, q[0], q[1], q[2], q[3], 35, 33); ctx.act(a[0], 1.2, a[1], 1.4, '🕹 Play ' + q[5] + ' (1 🪙)', () => M().invaders(q[4], q[5])); }
      // claw machine
      ctx.B(16, 0, 3, 19, 1.5, 6, 33); ctx.B(16, 1.5, 3, 16.5, 4, 6, 3); ctx.B(18.5, 1.5, 3, 19, 4, 6, 3); ctx.B(16, 1.5, 5.5, 19, 4, 6, 3); ctx.B(16, 1.5, 3, 19, 4, 3.5, 3); ctx.B(16, 4, 3, 19, 4.5, 6, 33);
      for (let i = 0; i < 10; i++) ctx.F(16.6 + (i % 4) * 0.5, 1.5, 3.6 + Math.floor(i / 4) * 0.5, choose([47, 32, 35, 34, 43]));
      ctx.act(17.5, 1.2, 7.4, 1.8, '🧸 Claw machine (2 🪙)', () => M().claw());
      // skee-ball lanes
      for (const x of [22, 25]) { ctx.B(x - 1, 0, 2, x + 1, 1, 9, 37); ctx.B(x - 1, 1, 2, x + 1, 3, 3, 37); ctx.F(x - 0.25, 2, 3.1, 47); ctx.F(x - 0.25, 1.5, 3.1, 32); for (let z = 3; z < 9; z += 0.5) ctx.F(x - 0.25, 1, z, 29); }
      ctx.act(23.5, 1.2, 10.5, 2.4, '🎳 Skee-ball (1 🪙)', () => M().skee());
      // prize counter
      counter(ctx, 2, 17, 10, 18, 69, 34); shelf(ctx, 1, 19.5, 10, 20, GOODS, 3.5);
      ctx.shop(6, 1.2, 15.6, '🎟 Prize counter', '🎟 Prize Counter', [{ e: '🦖', n: 'Plush dinosaur', price: 12 }, { e: '🪀', n: 'Yo-yo', price: 3 }, { e: '🕹', n: 'Mini joystick keychain', price: 5 }, { e: '👾', n: 'Space invader plush', price: 9 }]);
      ctx.npc(6, 18.8, { name: 'Prize Pete', shirt: 0x7b1fa2, yaw: Math.PI, lines: ['Got tickets? I got prizes!', 'The dinosaur is VERY popular.'] });
      ctx.npc(7, 6.5, { name: 'Gamer Gabe', shirt: 0x263238, yaw: 0, lines: ['My high score on Invaders is untouchable.', 'Bet you can\'t beat 600.'] });
      ctx.npc(20, 14, { walk: [[14, 12], [24, 12], [24, 18], [14, 18]], lines: ['Anyone got quarters?', 'The claw is rigged, I swear.'] });
      const pts = []; for (let x = 1; x < 27; x += 0.7) pts.push([x, 6.6, 12]); ctx.chaser(pts, [0xff2bd6, 0x22e6ff, 0x9dff3a, 0xffcc33], 0.25);
      ctx.photo(14, 1.2, 9, 'Broadway Arcade');
    } },
  { id: 'nyc-pizza', short: 'pizza', name: "Tony's NY Pizza", icon: '🍕', kind: 'interior', door: [-50, 600], face: 'w',
    fac: { w: 18, d: 14, h: 9, wall: 23, sign: 'PIZZA', signM: 47, awnA: 47, awnB: 29, trim: 64, window: 22 },
    room: { w: 22, h: 6, d: 20 }, hint: 'A dollar slice (well, 3 coins) heals you right up.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 29 : 70), wallPaint(29, 23, 2), 29);
      lightsGrid(ctx, 5, 57);
      counter(ctx, 3, 5, 19, 6.5, 29, 3); for (let x = 4; x < 18; x += 2.5) { ctx.cyl(x + 0.75, 5.75, 0.9, 1.5, 2, 62); ctx.F(x + 0.5, 1.5, 5.5, 47); }
      ctx.B(4, 0, 1, 9, 3, 2.5, 23); ctx.B(5, 0.5, 2.5, 8, 2, 2.6, 62); ctx.B(12, 0, 1, 18, 2, 2.5, 56); // brick oven + steel ovens
      ctx.txt(11, 3.6, 1.01, 'SINCE 1971', 47, 's', 1);
      ctx.menu(11, 1.2, 8, '🍕 Order pizza', "🍕 Tony's NY Pizza", [F('pizza', { n: 'Cheese slice' }), F('pizza', { n: 'Pepperoni slice', heal: 32, price: 4 }), { e: '🫓', n: 'Garlic knots', heal: 15, price: 2, col: 0xe0c080 }, { e: '🥤', n: 'Soda', heal: 6, price: 1, col: 0x8d6e63 }]);
      for (const [x, z] of [[5, 12], [11, 12], [17, 12], [8, 15.5], [14, 15.5]]) table(ctx, x, z, 47, 2, 70);
      ctx.npc(9, 3.6, { name: 'Tony', shirt: 0xffffff, yaw: 0, lines: ['Hey! Fresh outta the oven!', 'You fold it, like a real New Yorker.', 'Pineapple? Get outta here!'] });
      ctx.npc(14, 3.6, { name: 'Gina', shirt: 0xffffff, walk: [[14, 3.6], [17, 3.6]], lines: ['Pepperoni\'s up!', 'Extra cheese, coming right up.'] });
      ctx.npc(5, 13.5, { sit: true, yaw: 0, lines: ['Best slice in the city.', 'Mmm.'] });
      ctx.photo(17, 1.2, 9, "Tony's Pizza");
    } },
  { id: 'nyc-empire', short: 'empire', name: 'Empire State Observatory', icon: '🏙', kind: 'deck', door: [60, 741.5], face: 's', reserve: false,
    outside(pl, c) { deckSign(pl, c, 'OBSERVATORY 86'); },
    deck: { at: [60, 720], y: 200, R: 16, floors: 86, floor: (dx, dz) => Math.abs(dx) <= 14 && Math.abs(dz) <= 11 && !(Math.abs(dx) < 8 && Math.abs(dz) < 6) },
    build(ctx, pl) { deckBuild(ctx, pl, { elev: [8.25, 0, 'e'], scopes: [[13, 0], [-13, 0], [0, 10], [0, -10], [12, 9], [-12, -9]], photo: [-11, 8], spawn: [11, 0, -Math.PI / 2], npcs: [[11, -8, ['You can see all the way to the Statue of Liberty!', 'Look, Central Park!']], [-10, 3, ['It\'s windy up here!'], [[-10, 3], [-10, -8], [10, -8], [10, 8], [-10, 8]]]] }); } },
];

// ==================================================================== PARIS
D.PAR = [
  { id: 'par-cafe', short: 'cafe', name: 'Boulangerie du Coin', icon: '🥐', kind: 'interior', door: [-250, -418], face: 'n',
    fac: { w: 18, d: 14, h: 10, wall: 25, sign: 'BOULANGERIE', signM: 32, awnA: 68, awnB: 29, trim: 26, window: 3, roof: 26 },
    room: { w: 22, h: 6, d: 20 }, hint: 'Fresh croissants, pain au chocolat and café crème.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x * 2) + Math.floor(z * 2)) % 2 ? 29 : 70), wallPaint(37, 25, 2.5), 25);
      lightsGrid(ctx, 6, 32);
      // pastry display case + bread racks
      ctx.B(3, 0, 5, 19, 1, 6.5, 37); ctx.B(3, 1, 5, 19, 2, 6.5, 3); for (let x = 3.5; x < 19; x += 1) ctx.F(x, 1, 5.5, choose([62, 44, 37, 43, 29]));
      for (let x = 3; x < 19; x += 0.5) for (let y = 0.5; y < 4; y += 1) { ctx.F(x, y, 1.5, 37); if (Math.random() < 0.7) ctx.F(x, y + 0.5, 1.5, (x * 2) % 3 < 1 ? 31 : 62); }
      ctx.txt(11, 4.6, 2.01, 'PATISSERIE', 32, 's', 1);
      ctx.menu(11, 1.2, 8, '🥐 Commander (order)', '🥐 Boulangerie du Coin', [F('croissant'), { e: '🍫', n: 'Pain au chocolat', heal: 20, price: 3, col: 0x8d6e63 }, { e: '🥖', n: 'Baguette', heal: 30, price: 3, col: 0xd7a86e }, { e: '🍰', n: 'Macarons', heal: 12, price: 4, col: 0xf48fb1 }, F('coffee', { n: 'Café crème' })]);
      ctx.npc(9, 3.6, { name: 'Madame Claire', shirt: 0xffffff, yaw: 0, lines: ['Bonjour ! Un croissant ?', 'Tout frais, sorti du four !', 'Merci, bonne journée !'] });
      for (const [x, z] of [[5, 12], [11, 12], [17, 12], [8, 15.5], [14, 15.5]]) { ctx.cyl(x, z, 0.9, 1, 1.5, 29); ctx.B(x - 0.25, 0, z - 0.25, x + 0.25, 1, z + 0.25, 70); ctx.B(x + 1.2, 0, z - 0.25, x + 1.7, 0.5, z + 0.25, 70); }
      shelf(ctx, 20.5, 9, 21, 16, GOODS);
      ctx.shop(19, 1.2, 12.5, '🎁 Souvenirs de Paris', '🗼 Souvenirs de Paris', [{ e: '🗼', n: 'Mini Eiffel Tower', price: 6 }, { e: '🎨', n: 'Beret', price: 5 }, { e: '🖼', n: 'Mona Lisa postcard', price: 2 }, { e: '🧀', n: 'Fromage (stinky)', price: 4 }]);
      ctx.npc(5, 13.5, { sit: true, yaw: Math.PI, lines: ['Ah, Paris…', 'Le café est parfait.'] });
      ctx.npc(14, 10, { walk: [[14, 10], [18, 9], [6, 9]], lines: ['Deux croissants, s\'il vous plaît !', 'Ça sent bon !'] });
      ctx.photo(11, 1.2, 15, 'Parisian Café');
    } },
  { id: 'par-louvre', short: 'louvre', name: 'Musée du Louvre', icon: '🖼', kind: 'interior', door: [170, -106.5], face: 's', reserve: false,
    room: { w: 20, h: 9, d: 46 }, hint: 'The Grande Galerie — find the Mona Lisa!',
    build(ctx) {
      roomBase(ctx, (x, z) => (Math.abs(x - 10) < 2 ? 17 : ((Math.floor(x) + Math.floor(z)) % 2 ? 37 : 31)), wallPaint(25, 31, 6), (x, z) => ((Math.floor(z) % 4 === 0) ? 3 : 25));
      lightsGrid(ctx, 6, 57);
      // gallery paintings (canvas textures)
      const pal = [['#3b6ea5', '#f2d16b', '#2e7d32'], ['#7b1fa2', '#ffb74d', '#263238'], ['#c62828', '#fff3e0', '#5d4037'], ['#00695c', '#ffe082', '#37474f'], ['#1a237e', '#ff8a65', '#fafafa'], ['#4e342e', '#a5d6a7', '#ffecb3']];
      const titles = ['Water Lilies', 'Liberty Leading the People', 'The Raft of the Medusa', 'Starry Night (on loan)', 'The Coronation', 'A Sunday Afternoon'];
      let pi = 0;
      for (let z = 6; z < 40; z += 7) for (const side of [1, 19]) {
        const face = side === 1 ? 'e' : 'w', t = titles[pi % titles.length], cols = pal[pi % pal.length]; pi++;
        ctx.B(side === 1 ? 1 : 18.5, 1.5, z - 2, side === 1 ? 1.5 : 19, 5, z + 2, 32);
        ctx.picture(side === 1 ? 1.55 : 18.45, 3.25, z, 3.4, 3, face, (g, w, h) => { g.fillStyle = cols[0]; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = cols[1 + (i % 2)]; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1 + Math.random() * 4); } }, 32, 28);
        ctx.act(side === 1 ? 3 : 17, 1.2, z, 2.2, '🖼 "' + t + '"', () => { SKY.toast('🖼 "' + t + '" — magnifique.', ''); });
      }
      // the Mona Lisa: north wall, behind glass, velvet rope, winks
      ctx.B(7.5, 1.5, 1, 12.5, 6, 1.5, 55); ctx.B(7, 1, 1, 7.5, 6.5, 2.5, 55); ctx.B(12.5, 1, 1, 13, 6.5, 2.5, 55);
      const draw = (wink) => (g, w, h) => {
        g.fillStyle = '#4a5a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b7f55'; g.fillRect(0, 0, w, h * 0.45); g.fillStyle = '#2b2118'; g.fillRect(w * 0.18, h * 0.42, w * 0.64, h * 0.6);
        g.fillStyle = '#d9b28a'; g.fillRect(w * 0.34, h * 0.2, w * 0.32, h * 0.3); g.fillStyle = '#1e140c'; g.fillRect(w * 0.28, h * 0.12, w * 0.44, h * 0.1); g.fillRect(w * 0.26, h * 0.18, w * 0.09, h * 0.36); g.fillRect(w * 0.65, h * 0.18, w * 0.09, h * 0.36);
        g.fillStyle = '#222'; g.fillRect(w * 0.4, h * 0.3, 2, wink ? 1 : 2); if (wink) g.fillRect(w * 0.55, h * 0.31, 3, 1); else g.fillRect(w * 0.57, h * 0.3, 2, 2);
        g.fillStyle = '#8a4a3a'; g.fillRect(w * 0.44, h * 0.42, w * 0.14, 1); g.fillStyle = '#d9b28a'; g.fillRect(w * 0.36, h * 0.78, w * 0.28, h * 0.08);
      };
      const mona = ctx.picture(10, 3.75, 1.5, 3.4, 4.2, 's', draw(false), 32, 40);
      const glass = ctx.mesh(new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.12, depthWrite: false }))); glass.position.set(10, 3.75, 2.4);
      const winkCv = document.createElement('canvas'); winkCv.width = 32; winkCv.height = 40; draw(true)(winkCv.getContext('2d'), 32, 40);
      const normCv = mona.userData.cv; let winkT = 0;
      ctx.anim((dt) => { if (winkT > 0) { winkT -= dt; if (winkT <= 0) { mona.material.map.image = normCv; mona.material.map.needsUpdate = true; } } });
      for (let x = 6; x <= 14; x += 0.5) ctx.F(x, 0.5, 5, x === 6 || x === 14 ? 55 : 0); ctx.B(6, 0, 5, 6.5, 1, 5.5, 55); ctx.B(13.5, 0, 5, 14, 1, 5.5, 55);
      ctx.mesh(new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0xb71c1c }))).position.set(10.25, 0.95, 5.25);
      ctx.act(10, 1.2, 6.8, 2.6, '🖼 Gaze at the Mona Lisa', () => {
        mona.material.map.image = winkCv; mona.material.map.needsUpdate = true; winkT = 1.2; SKY.Audio.play('ding');
        SKY.toast('😉 …did the Mona Lisa just WINK at you?!', 'good'); SKY.Game.achieve('monalisa'); PL.photo('Mona Lisa');
      });
      ctx.txt(10, 6.6, 1.01, 'MONA LISA', 32, 's', 1);
      for (let z = 9; z < 42; z += 7) { ctx.B(9, 0, z, 11, 0.5, z + 1, 45); ctx.B(9.5, 0.5, z + 0.25, 10.5, 1, z + 0.75, 45); }
      ctx.B(9, 0, 42, 11, 1, 43, 45); ctx.B(9.5, 1, 42.25, 10.5, 3, 42.75, 29); ctx.sph(10, 3.4, 42.5, 0.45, 29); // Venus de Milo-ish
      ctx.npc(10, 8, { name: 'Guard Hélène', shirt: 0x1a237e, lines: ['No flash photography, please.', 'She is smaller than you expected, non?', 'Some say she winks at those who look long enough…'] });
      for (let i = 0; i < 4; i++) ctx.npc(6 + i * 2.5, 7.5 + (i % 2), { wave: i % 2 === 0, lines: ['Wow, it\'s tiny!', 'Selfie time!', 'Can\'t see over the crowd!', 'Magnifique!'] });
      ctx.npc(10, 30, { walk: [[10, 40], [10, 12]], lines: ['So many paintings!', 'Where is the Mona Lisa?'] });
      ctx.photo(10, 1.2, 20, 'Louvre Grande Galerie');
      ctx.shop(16, 1.2, 43.5, '🎁 Louvre gift shop', '🎁 Boutique du Louvre', [{ e: '🖼', n: 'Mona Lisa print', price: 8 }, { e: '🗿', n: 'Venus de Milo mini', price: 10 }, { e: '🔺', n: 'Glass pyramid paperweight', price: 6 }]);
      counter(ctx, 14, 41, 18.5, 42, 55, 29);
    } },
  { id: 'par-eiffel', short: 'eiffel', name: 'Eiffel Tower Summit', icon: '🗼', kind: 'deck', door: [-1064, 397], face: 's', reserve: false, portal: false,
    outside(pl, c) { booth(pl, c, 'SOMMET'); },
    deck: { at: [-1064, 392], y: 284, R: 16, floors: 3, floor: (dx, dz) => { const ax = Math.abs(dx), az = Math.abs(dz); if (ax > 14 || az > 14) return false; return !(ax >= 2 && ax <= 6 && az >= 2 && az <= 6); } },
    build(ctx, pl) { deckBuild(ctx, pl, { elev: [0, 1, 's'], scopes: [[13, 0], [-13, 0], [0, 13], [0, -13]], photo: [10, 10], spawn: [8, 8, -Math.PI / 2], npcs: [[-9, 9, ['Je vois Notre-Dame !', 'C\'est magnifique !']], [9, -9, ['Will you marry me?! ...oh, wrong person.'], [[9, -9], [-9, -9], [-9, 9]]]] }); ctx.B(14, 0, 14, 18, 3.5, 18, 27); ctx.cyl(16, 16, 1.2, 3.5, 4, 47); } },
];

// ==================================================================== TOKYO
D.TYO = [
  { id: 'tyo-arcade', short: 'arcade', name: 'Akiba Game Center', icon: '👾', kind: 'interior', door: [-1500, 332], face: 's',
    fac: { w: 24, d: 18, h: 16, wall: 70, sign: 'GAME CENTER', signM: 33, awnA: 33, awnB: 34, trim: 35, window: 69, stripe: 34 },
    room: { w: 28, h: 7, d: 26 }, hint: 'Playable GROK INVADERS cabinet, UFO catchers, taiko drums and purikura photo booth.',
    build(ctx) {
      roomBase(ctx, (x, z) => (((Math.floor(x) + Math.floor(z) * 2) % 7 === 0) ? 33 : 68), wallPaint(70, 69, 5), 70);
      const pts = []; for (let x = 1; x < 27; x += 0.6) { pts.push([x, 6.6, 1.2]); pts.push([x, 6.6, 12]); } ctx.chaser(pts, [0xff2bd6, 0x22e6ff, 0x9dff3a, 0xffcc33, 0xff3355], 0.25);
      // the playable cabinet row
      for (const [x, id, c] of [[4, 'tyo-inv-1', 47], [7, 'tyo-inv-2', 33], [10, 'tyo-inv-3', 60], [13, 'tyo-inv-4', 35]]) { const a = cabinet(ctx, x, 4, 's', c, 34, 32); ctx.act(a[0], 1.2, a[1], 1.4, '👾 Play GROK INVADERS (1 🪙)', () => M().invaders(id, 'GROK INVADERS')); }
      ctx.txt(8.5, 4, 1.01, 'HIGH SCORE', 32, 's', 1);
      // UFO catchers
      for (const x of [18, 22]) { ctx.B(x - 1.5, 0, 3, x + 1.5, 1.5, 6, x === 18 ? 33 : 34); for (const [a, b] of [[x - 1.5, 3], [x + 1, 3]]) ctx.B(a, 1.5, b, a + 0.5, 4, b + 3, 3); ctx.B(x - 1.5, 1.5, 5.5, x + 1.5, 4, 6, 3); ctx.B(x - 1.5, 4, 3, x + 1.5, 4.5, 6, x === 18 ? 33 : 34); for (let i = 0; i < 8; i++) ctx.F(x - 1 + (i % 4) * 0.5, 1.5, 3.6 + Math.floor(i / 4) * 0.5, choose([43, 44, 29, 35])); ctx.act(x, 1.2, 7.4, 1.8, '🛸 UFO catcher (2 🪙)', () => M().claw()); }
      // taiko drums
      ctx.cyl(25, 10, 1, 0, 1.5, 28); ctx.cyl(25, 10, 0.9, 1.5, 2, 25); ctx.act(23, 1.2, 10, 2.2, '🥁 Taiko drum game (1 🪙)', () => M().taiko());
      // purikura photo booth
      ctx.B(2, 0, 15, 7, 3.5, 20, 43); ctx.B(3, 0, 19.5, 6, 3, 20, 0); ctx.txt(4.5, 2.6, 20.01, 'PURI', 29, 's', 1);
      ctx.act(4.5, 1.2, 21.5, 2.2, '📸 Purikura photo booth (1 🪙)', () => { if (!PL.spend(1)) return; PL.photo('Tokyo Purikura ✨'); SKY.toast('✨ Kawaii! Your purikura sticker has sparkles and cat ears. 🐱', 'good'); });
      // prize counter + souvenirs
      counter(ctx, 18, 16, 26, 17, 33, 34); shelf(ctx, 26.5, 14, 27, 22, GOODS);
      ctx.shop(22, 1.2, 18.5, '🎁 Prize counter', '🎁 Keihin (prizes)', [{ e: '🐱', n: 'Lucky cat (maneki-neko)', price: 7 }, { e: '🤖', n: 'Giant robot figure', price: 15 }, { e: '🎴', n: 'Trading cards', price: 3 }, { e: '🍡', n: 'Dango plush', price: 5 }]);
      ctx.npc(22, 15.3, { name: 'Tanaka-san', shirt: 0xff7043, yaw: Math.PI, lines: ['Irasshaimase!', 'Ganbatte!', 'Top score wins a robot!'] });
      ctx.npc(7, 6.4, { name: 'Pro gamer Rin', shirt: 0x111111, yaw: 0, lines: ['My score: 900. Beat that.', 'Shoot the UFO for bonus points!'] });
      ctx.npc(15, 14, { walk: [[12, 10], [16, 10], [16, 18], [12, 18]], lines: ['Sugoi!', 'One more credit...'] });
      ctx.photo(14, 1.2, 9, 'Akihabara Game Center');
    } },
  { id: 'tyo-ramen', short: 'ramen', name: 'Ichiban Ramen', icon: '🍜', kind: 'interior', door: [-1440, 332], face: 's',
    fac: { w: 18, d: 14, h: 9, wall: 37, sign: 'RAMEN', signM: 29, awnA: 28, awnB: 28, trim: 28, window: 47, board: 28 },
    room: { w: 20, h: 5, d: 16 }, hint: 'Slurp a bowl of tonkotsu at the counter.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 37 : 48), wallPaint(37, 25, 2.5), 37);
      for (let x = 2; x < 18; x += 2) { ctx.sph(x, 4.2, 9, 0.45, 47); ctx.F(x - 0.25, 4.6, 8.75, 70); } // lanterns
      counter(ctx, 2, 5, 18, 6.5, 37, 25); ctx.B(2, 0, 1, 18, 1, 2.5, 56); for (let x = 3; x < 17; x += 2.5) { ctx.cyl(x + 0.75, 1.75, 0.6, 1, 1.8, 56); ctx.F(x + 0.5, 1.8, 1.5, 62); }
      for (let x = 3; x < 18; x += 2) ctx.B(x - 0.25, 0, 7.5, x + 0.25, 0.5, 8, 28);
      ctx.txt(10, 2.8, 1.01, 'ICHIBAN', 28, 's', 1);
      ctx.act(16, 1.2, 12, 2, '🎫 Ticket machine (ramen menu)', () => M().menu('🍜 Ichiban Ramen', [F('ramen'), { e: '🍜', n: 'Spicy miso ramen', heal: 45, price: 7, col: 0xe65100 }, { e: '🥟', n: 'Gyoza', heal: 18, price: 3, col: 0xffe0b2 }, { e: '🍵', n: 'Green tea', heal: 6, price: 1, col: 0x8bc34a }], ctx.c));
      ctx.B(16, 0, 13, 17.5, 2, 14, 47); ctx.F(16.25, 1.5, 12.75, 57);
      ctx.menu(10, 1.2, 8.5, '🍜 Order at the counter', '🍜 Ichiban Ramen', [F('ramen'), { e: '🥟', n: 'Gyoza', heal: 18, price: 3, col: 0xffe0b2 }, { e: '🍚', n: 'Chashu rice bowl', heal: 30, price: 5, col: 0xffffff }]);
      ctx.npc(8, 3.6, { name: 'Taishō Kenji', shirt: 0xffffff, yaw: 0, lines: ['Irasshaimase!!', 'Slurping is a compliment!', 'Broth simmered 18 hours.'] });
      ctx.npc(5, 7.8, { sit: true, yaw: Math.PI, lines: ['*slurrrp*', 'Oishii!'] }); ctx.npc(13, 7.8, { sit: true, yaw: Math.PI, lines: ['Kaedama, please!'] });
      ctx.photo(4, 1.2, 12, 'Tokyo Ramen Shop');
    } },
  { id: 'tyo-konbini', short: 'konbini', name: 'GrokMart Konbini', icon: '🏪', kind: 'interior', door: [-1500, 368], face: 'n',
    fac: { w: 18, d: 14, h: 6, wall: 29, sign: 'GROKMART', signM: 35, awnA: 35, awnB: 60, trim: 60, window: 3, board: 60 },
    room: { w: 20, h: 5, d: 18 }, hint: 'Onigiri, melon pan, drinks — open 24/7.',
    build(ctx) {
      roomBase(ctx, 29, wallPaint(29, 60, 3.5), 29); lightsGrid(ctx, 3, 57);
      shelf(ctx, 4, 6, 4.5, 13, GOODS); shelf(ctx, 8, 6, 8.5, 13, GOODS); shelf(ctx, 12, 6, 12.5, 13, GOODS);
      for (let x = 2; x < 18; x += 1) for (let y = 0.5; y < 3; y += 0.5) ctx.F(x, y, 1, (y === 0.5 || y === 2.5) ? 56 : choose([60, 47, 35, 44, 29, 62])); ctx.B(2, 0, 1.5, 18, 3, 1.6, 3);
      counter(ctx, 14, 12, 19, 13, 29, 60); ctx.B(17.5, 1.5, 12, 18.5, 2.5, 13, 38);
      ctx.menu(16, 1.2, 14.6, '🍙 Konbini snacks', '🏪 GrokMart', [F('onigiri'), { e: '🍞', n: 'Melon pan', heal: 16, price: 2, col: 0xc5e1a5 }, { e: '🍱', n: 'Bento box', heal: 40, price: 5, col: 0xffcc80 }, { e: '🍗', n: 'Fried chicken', heal: 24, price: 3, col: 0xd84315 }, { e: '🧃', n: 'Calpis soda', heal: 6, price: 1, col: 0xe1f5fe }]);
      ctx.shop(10, 1.2, 3.4, '🎁 Character goods', '🎁 Konbini goodies', [{ e: '🍬', n: 'Kit-Kat (matcha)', price: 2 }, { e: '🐼', n: 'Panda keychain', price: 3 }, { e: '☂️', n: 'Clear umbrella', price: 2 }]);
      ctx.npc(16.5, 11.2, { name: 'Clerk Yui', shirt: 0x43a047, yaw: Math.PI, lines: ['Irasshaimase~!', 'Would you like that heated up?', 'Point card?'] });
      ctx.npc(6, 9, { walk: [[6, 5], [6, 14], [10, 14], [10, 5]], lines: ['Where is the melon pan?', 'Konbini egg sandwich is the best.'] });
      ctx.photo(3.5, 1.2, 15.5, 'Tokyo Konbini');
    } },
  { id: 'tyo-skytree', short: 'skytree', name: 'Tokyo Skytree Tembo Deck', icon: '🗼', kind: 'deck', door: [1150, -1184.5], face: 's', reserve: false,
    outside(pl, c) { deckSign(pl, c, 'SKYTREE 350'); },
    deck: { at: [1150, -1200], y: 184, R: 16, floors: 350, floor: (dx, dz) => { const r = hyp(dx, dz); return r >= 9 && r <= 14; } },
    build(ctx, pl) { deckBuild(ctx, pl, { elev: [9.5, 0, 'e'], scopes: [[13, 0], [-13, 0], [0, 13], [0, -13], [9, 9], [-9, -9]], photo: [-8, 9], spawn: [11.5, 2.5, -Math.PI / 2], npcs: [[-11, 2, ['On a clear day you can see Mount Fuji!', 'Sugoi!']], [8, -9, ['The trains look like toys.'], [[8, -9], [-8, -9], [-11, 0], [-8, 9]]]] }); } },
];
})();

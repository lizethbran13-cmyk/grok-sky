'use strict';
// GROK SKY 4.0 - enterable places for London, Rio, Quito, Starbase and the Moon / Mars bases.
(() => {
const PL = SKY.Places, W = SKY.World;
const { choose } = SKY;
const D = PL.DEFS;
const M = () => SKY.Mini;
function lightsGrid(ctx, step, m) { for (let x = step / 2; x < ctx.W - 1; x += step) for (let z = step / 2; z < ctx.D - 1; z += step) ctx.B(x - 0.5, ctx.H - 0.5, z - 0.5, x + 0.5, ctx.H, z + 0.5, m || 57); }
function counter(ctx, x0, z0, x1, z1, m, top) { ctx.B(x0, 0, z0, x1, 1, z1, m); ctx.B(x0, 1, z0, x1, 1.5, z1, top || 29); }
function table(ctx, x, z, m, stools, sm) { ctx.B(x - 0.5, 0, z - 0.5, x + 0.5, 0.5, z + 0.5, 56); ctx.B(x - 1, 0.5, z - 1, x + 1, 1, z + 1, m || 37); if (stools) for (const d of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]].slice(0, stools)) ctx.B(x + d[0] - 0.25, 0, z + d[1] - 0.25, x + d[0] + 0.25, 0.5, z + d[1] + 0.25, sm || 17); }
const wallPaint = (m1, m2, band) => (x, y, z) => (y > band ? m2 : m1);
const roomBase = (ctx, floor, wall, ceil) => { ctx.shell(floor, wall, ceil || 24); ctx.exit(ctx.W / 2, ctx.D - 1, 'n'); ctx.spawn(ctx.W / 2, ctx.D - 4, 0); };
// open-air food stand (shares the look of the 3.x stands)
function stand(pl, c, o) {
  const f = pl.f, alongX = pl.face === 's' || pl.face === 'n';
  const w = alongX ? 8 : 5, d = alongX ? 5 : 8; const cx = pl.dx - f[0] * 3, cz = pl.dz - f[1] * 3;
  const O = new THREE.Vector3(cx - w / 2, pl.dy, cz - d / 2);
  const ctx = PL.makeCtx(c, O, w, 6, d, { persistent: true, name: pl.short, yOff: 1 });
  const lx = (u, v) => [w / 2 + (alongX ? u : v), d / 2 + (alongX ? v : u)]; const sgn = alongX ? f[1] : f[0]; const P2 = (u, v) => lx(u, sgn * v);
  ctx.B(0, -1, 0, w, 0, d, o.floor || 65);
  const a = P2(-3.5, 1.5), b = P2(3.5, 2.5); counter(ctx, Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), o.body || 29, 56);
  for (const u of [-3.75, 3.75]) for (const v of [-2.25, 2.25]) { const q = P2(u, v); ctx.B(q[0] - 0.25, 0, q[1] - 0.25, q[0] + 0.25, 3.5, q[1] + 0.25, 56); }
  for (let u = -4; u < 4; u += 0.5) for (let v = -2.5; v < 3.5; v += 0.5) { const q = P2(u + 0.25, v + 0.25); ctx.F(q[0], 3.5 + (v > 2.5 ? -0.5 : 0), q[1], (Math.floor(u + 4)) % 2 ? o.awnA : o.awnB); }
  const cook = P2(0, 0.2);
  ctx.npc(cook[0], cook[1], { name: o.cook, shirt: o.shirt || 0xffffff, yaw: Math.atan2(-f[0], -f[1]) + Math.PI, lines: o.lines, key: pl.id + '-cook' });
  ctx.act(cook[0] + f[0] * 3.2, 1.2, cook[1] + f[1] * 3.2, 3.6, '🍽 Order at ' + pl.name, () => { PL.markVisited(pl); M().menu(pl.icon + ' ' + pl.name, o.menu, c); });
  if (o.photo) { const q = P2(5, 4); ctx.photo(q[0], 1.2, q[1], o.photo, 2.5); }
  ctx.finish();
  SKY.signBoard(pl.dx - f[0] * 3, pl.dy + 4.1, pl.dz - f[1] * 3, [].concat(o.sign).map((t) => ({ t, m: o.signM || 32 })), 0.25, 70, 32, pl.face);
}
const tea = { e: '🫖', n: 'Cup of tea', heal: 10, price: 2, col: 0xb07a4a };

// ==================================================================== LONDON
D.LON = [
  { id: 'lon-pub', short: 'pub', name: 'The Grok & Crown (pub)', icon: '🍺', kind: 'interior', door: [-470, -460], face: 'e',
    fac: { w: 16, d: 14, h: 9, wall: 68, sign: 'GROK AND CROWN', signM: 63, awnA: 68, awnB: 63, trim: 27, window: 3, roof: 70 },
    room: { w: 22, h: 6, d: 20 }, hint: 'Fish & chips, a cuppa and a game of darts.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 37 : 58), wallPaint(58, 68, 2.5), 37);
      lightsGrid(ctx, 6, 62);
      counter(ctx, 3, 3, 19, 4.5, 37, 27); for (let x = 4; x < 19; x += 2) ctx.B(x - 0.25, 1.5, 3.5, x + 0.25, 2.5, 4, 56);
      for (let x = 3; x < 19; x += 0.5) for (let y = 1; y < 4; y += 1) if (Math.random() < 0.7) ctx.F(x, y + 0.5, 1.5, choose([62, 44, 31, 37]));
      ctx.txt(11, 4.5, 2.01, 'FISH AND CHIPS', 63, 's', 1);
      ctx.menu(11, 1.2, 6.5, '🍟 Order at the bar', '🍺 The Grok & Crown', [{ e: '🐟', n: 'Fish & chips', heal: 40, price: 7, col: 0xe0a14a }, tea, { e: '🥧', n: 'Shepherd\'s pie', heal: 38, price: 6, col: 0x8d6e63 }, { e: '🫓', n: 'Scone with jam', heal: 15, price: 3, col: 0xe8c48a }, { e: '🥤', n: 'Ginger beer', heal: 6, price: 2, col: 0xd9b26a }]);
      ctx.npc(11, 2.4, { name: 'Barkeep Alfie', shirt: 0xffffff, yaw: 0, lines: ['Alright, mate? What can I get you?', 'Lovely weather for ducks, innit.', 'Mind the gap on your way out!'] });
      for (const [x, z] of [[5, 10], [11, 10], [17, 10], [8, 15], [14, 15]]) table(ctx, x, z, 37, 4, 58);
      ctx.B(20.5, 1.5, 9, 21, 3.5, 11, 29); ctx.cyl(20.75, 10, 0.9, 2.1, 2.9, 67); // dartboard
      ctx.act(18.5, 1.2, 10, 2.4, '🎯 Throw a dart', () => { const s = Math.random(); SKY.Audio.play('pop'); SKY.toast(s > 0.9 ? '🎯 BULLSEYE! The whole pub cheers!' : s > 0.5 ? '🎯 Treble 20 — not bad!' : '🎯 ...it hit the wall. Cheers anyway!', s > 0.5 ? 'good' : ''); });
      ctx.npc(5, 11.5, { sit: true, yaw: Math.PI, lines: ['Brilliant!', 'Fancy a cuppa?'] });
      ctx.npc(14, 13, { walk: [[14, 13], [18, 8], [6, 8]], lines: ['Cheerio!', 'Another round, please!'] });
      ctx.photo(11, 1.2, 17, 'London Pub');
      ctx.shop(3, 1.2, 15, '🎁 London souvenirs', '🇬🇧 London souvenirs', [{ e: '💂', n: 'Royal Guard bear hat', price: 7 }, { e: '🚌', n: 'Red bus model', price: 5 }, { e: '☎', n: 'Phone box money bank', price: 4 }, { e: '🫖', n: 'Royal teapot', price: 6 }]);
    } },
  { id: 'lon-tea', short: 'tea', name: 'Thames Tea Kiosk', icon: '🫖', kind: 'stand', door: [-250, -190], face: 'w',
    outside(pl, c) { stand(pl, c, { sign: ['TEA', 'SCONES'], signM: 63, awnA: 68, awnB: 29, cook: 'Auntie Margaret', photo: 'Big Ben from the river', lines: ['Milk first or tea first, love?', 'Big Ben\'s bong is right on time.', 'Ta-ra, enjoy London!'], menu: [tea, { e: '🫓', n: 'Scone with clotted cream', heal: 16, price: 3, col: 0xe8c48a }, { e: '🥪', n: 'Cucumber sandwich', heal: 12, price: 3, col: 0xaed581 }, { e: '🍰', n: 'Victoria sponge', heal: 18, price: 3, col: 0xf8bbd0 }] }); } },
  { id: 'lon-shard', short: 'shard', name: 'The View from The Shard', icon: '🔺', kind: 'deck', door: [1050, 309.5], face: 's', reserve: false,
    outside(pl, c) { SKY.signBoard(pl.dx + pl.f[0] * 0.3, pl.dy + 4.2, pl.dz + pl.f[1] * 0.3, [{ t: 'THE SHARD', m: 34 }], 0.5, 70, 34, pl.face); },
    deck: { at: [1050, 280], y: 232, R: 10, floors: 72, floor: (dx, dz) => Math.abs(dx) < 6.5 && Math.abs(dz) < 6.5 },
    build(ctx, pl) { PL.deckBuild(ctx, pl, { elev: [0, -5, 's'], scopes: [[5.5, 0], [-5.5, 0], [0, 5.5]], photo: [3, 3], spawn: [0, 2, 0], npcs: [[-3, 3, ['You can see all of London!', 'Look, Tower Bridge!']]] }); } },
];

// ==================================================================== RIO DE JANEIRO
D.RIO = [
  { id: 'rio-acai', short: 'acai', name: 'Copacabana Açaí Stand', icon: '🥥', kind: 'stand', door: [-300, 1205], face: 'n',
    outside(pl, c) { stand(pl, c, { sign: ['ACAI', 'COCO'], signM: 64, awnA: 64, awnB: 63, floor: 65, cook: 'Tia Bia', photo: 'Copacabana Beach', lines: ['Oi! Açaí bem gelado?', 'Água de coco direto do coco!', 'Tchau, aproveita a praia!'], menu: [{ e: '🫐', n: 'Açaí bowl', heal: 25, price: 4, col: 0x6a1b9a }, { e: '🥥', n: 'Coconut water', heal: 12, price: 2, col: 0xf1f8e9 }, { e: '🧀', n: 'Pão de queijo', heal: 15, price: 2, col: 0xf2c46b }, { e: '🍢', n: 'Grilled cheese on a stick', heal: 14, price: 2, col: 0xffe082 }] }); } },
  { id: 'rio-churrasco', short: 'churrasco', name: 'Churrascaria Samba', icon: '🍖', kind: 'interior', door: [-1300, -480], face: 'n',
    fac: { w: 18, d: 14, h: 9, wall: 63, sign: 'CHURRASCARIA', signM: 64, awnA: 64, awnB: 63, trim: 64, window: 3, roof: 28 },
    room: { w: 24, h: 6, d: 20 }, hint: 'All-you-can-eat Brazilian barbecue and samba music.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 31 : 29), wallPaint(37, 63, 2.5), 29);
      lightsGrid(ctx, 6, 62);
      counter(ctx, 4, 3, 20, 4.5, 37, 56); for (let x = 5; x < 20; x += 1.5) ctx.F(x, 1.5, 3.5, choose([62, 44, 37, 64]));
      ctx.txt(12, 4.5, 2.01, 'RODIZIO', 64, 's', 1);
      ctx.menu(12, 1.2, 6.5, '🍖 Order rodízio', '🍖 Churrascaria Samba', [{ e: '🍖', n: 'Picanha', heal: 45, price: 8, col: 0x8d3a2a }, { e: '🍚', n: 'Feijoada', heal: 40, price: 6, col: 0x3e2723 }, { e: '🧀', n: 'Pão de queijo', heal: 15, price: 2, col: 0xf2c46b }, { e: '🍮', n: 'Brigadeiro', heal: 10, price: 2, col: 0x4e342e }, { e: '🥤', n: 'Guaraná', heal: 6, price: 2, col: 0xc62828 }]);
      ctx.npc(12, 2.4, { name: 'Chef Rodrigo', shirt: 0xffffff, yaw: 0, lines: ['Bem-vindo! Mais picanha?', 'Flip your card to green for more meat!', 'Obrigado, volte sempre!'] });
      for (const [x, z] of [[6, 10], [12, 10], [18, 10], [9, 15], [15, 15]]) table(ctx, x, z, 37, 4, 63);
      ctx.act(21.5, 1.2, 15, 2.4, '💃 Dance some samba', () => { SKY.Audio.play('ding'); SKY.toast('💃 Samba! Everyone joins in — one, two, three…', 'good'); });
      ctx.npc(20, 13, { wave: true, lines: ['Samba!', 'Ê ô!'] }); ctx.npc(6, 11.5, { sit: true, yaw: Math.PI, lines: ['Delícia!', 'I came for the Christ, stayed for the picanha.'] });
      ctx.photo(12, 1.2, 17, 'Churrascaria Samba');
      ctx.shop(3, 1.2, 15, '🎁 Rio souvenirs', '🇧🇷 Rio souvenirs', [{ e: '⚽', n: 'Maracanã football', price: 6 }, { e: '🩴', n: 'Flip-flops', price: 4 }, { e: '🗿', n: 'Mini Christ the Redeemer', price: 7 }, { e: '🎭', n: 'Carnival mask', price: 5 }]);
    } },
];

// ==================================================================== QUITO
D.UIO = [
  { id: 'uio-cafe', short: 'cafe', name: 'Café Quiteño', icon: '🫔', kind: 'interior', door: [80, -100], face: 'w',
    fac: { w: 14, d: 14, h: 9, wall: 29, sign: 'CAFE QUITENO', signM: 60, awnA: 60, awnB: 29, trim: 60, window: 3, roof: 60 },
    room: { w: 22, h: 6, d: 20 }, hint: 'Empanadas de viento, locro de papa and hot chocolate in the old town.',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 28 : 31), wallPaint(60, 29, 2.5), 37);
      lightsGrid(ctx, 6, 62);
      counter(ctx, 3, 3, 19, 4.5, 37, 29); for (let x = 3.5; x < 19; x += 1) ctx.F(x, 1.5, 3.5, choose([62, 44, 31, 63]));
      ctx.txt(11, 4.5, 2.01, 'BIENVENIDOS', 60, 's', 1);
      ctx.menu(11, 1.2, 6.5, '🫔 Pedir (order)', '🫔 Café Quiteño', [{ e: '🥟', n: 'Empanada de viento', heal: 20, price: 2, col: 0xf2c46b }, { e: '🍲', n: 'Locro de papa', heal: 38, price: 5, col: 0xffd54f }, { e: '🫔', n: 'Humita', heal: 22, price: 3, col: 0xc5e1a5 }, { e: '🍫', n: 'Ecuadorian hot chocolate', heal: 12, price: 2, col: 0x5d4037 }, { e: '🥭', n: 'Fresh mango juice', heal: 10, price: 2, col: 0xffb300 }]);
      ctx.npc(11, 2.4, { name: 'Doña Rosa', shirt: 0xffffff, yaw: 0, lines: ['¡Bienvenidos a Quito, mijo!', 'The empanadas are fresh, with sugar on top!', 'We are 2,850 metres up — drink some water!', '¡Chévere! Come back soon.'] });
      for (const [x, z] of [[5, 10], [11, 10], [17, 10], [8, 15], [14, 15]]) table(ctx, x, z, 37, 4, 60);
      ctx.npc(5, 11.5, { sit: true, yaw: Math.PI, lines: ['¡Qué rico!', 'Did you stand on the equator yet?'] });
      ctx.npc(14, 13, { walk: [[14, 13], [18, 8], [6, 8]], lines: ['¡Achachay, qué frío!', '¡Arrarray, qué calor!'] });
      ctx.photo(11, 1.2, 17, 'Café in Old Quito');
      ctx.shop(3, 1.2, 15, '🎁 Ecuador souvenirs', '🇪🇨 Ecuador souvenirs', [{ e: '👒', n: 'Panama hat (made in Ecuador!)', price: 8 }, { e: '🍫', n: 'Ecuadorian chocolate bar', price: 3 }, { e: '🦙', n: 'Alpaca plush', price: 6 }, { e: '🧣', n: 'Otavalo scarf', price: 5 }]);
    } },
  { id: 'uio-equator', short: 'equator', name: 'Equator Chocolate Stand', icon: '🍫', kind: 'stand', door: [-640, -2540], face: 's',
    outside(pl, c) { stand(pl, c, { sign: ['CHOCOLATE', 'LATITUD 0'], signM: 63, awnA: 63, awnB: 60, cook: 'Don Segundo', photo: 'Standing on the Equator', lines: ['One foot in each hemisphere!', 'Ecuador has the best cacao in the world.', 'Try balancing an egg on the line!'], menu: [{ e: '🍫', n: 'Cacao bar', heal: 12, price: 2, col: 0x4e342e }, { e: '☕', n: 'Hot chocolate', heal: 10, price: 2, col: 0x6d4c41 }, { e: '🍌', n: 'Chifles (plantain chips)', heal: 12, price: 2, col: 0xffe082 }] }); } },
];

// ==================================================================== STARBASE
D.SBX = [
  { id: 'sbx-control', short: 'control', name: 'Starbase Mission Control', icon: '🛰', kind: 'interior', door: [-300, -560], face: 'n',
    fac: { w: 18, d: 14, h: 9, wall: 29, sign: 'MISSION CONTROL', signM: 70, awnA: 70, awnB: 29, trim: 70, window: 3, roof: 70 },
    room: { w: 24, h: 7, d: 20 }, hint: 'Watch the screens and learn about the Moon & Mars trips. Board Starship at the launch tower!',
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 70 : 21), wallPaint(70, 56, 3), 70);
      lightsGrid(ctx, 6, 57);
      ctx.B(2, 1.5, 1, 22, 5.5, 1.5, 70);
      ctx.picture(12, 3.5, 1.55, 18, 3.6, 's', (g, w, h) => { g.fillStyle = '#05070d'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f74b5'; g.beginPath(); g.arc(w * 0.18, h * 0.55, h * 0.35, 0, 6.3); g.fill(); g.fillStyle = '#ccc'; g.beginPath(); g.arc(w * 0.5, h * 0.4, h * 0.14, 0, 6.3); g.fill(); g.fillStyle = '#c1440e'; g.beginPath(); g.arc(w * 0.85, h * 0.5, h * 0.22, 0, 6.3); g.fill(); g.strokeStyle = '#ffd23d'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(w * 0.22, h * 0.4); g.quadraticCurveTo(w * 0.35, h * 0.1, w * 0.48, h * 0.35); g.moveTo(w * 0.53, h * 0.38); g.quadraticCurveTo(w * 0.7, h * 0.1, w * 0.83, h * 0.38); g.stroke(); }, 120, 24);
      for (let r = 0; r < 3; r++) for (let x = 4; x < 21; x += 4) { const z = 6 + r * 4; ctx.B(x - 1.5, 0, z, x + 1.5, 1, z + 1, 70); ctx.F(x - 0.75, 1, z + 0.25, 34); ctx.F(x + 0.25, 1, z + 0.25, 38); ctx.B(x - 0.25, 0, z + 1.6, x + 0.25, 0.5, z + 2.1, 17); }
      ctx.act(12, 1.2, 4, 3, '🛰 Mission briefing', () => SKY.toast('🚀 Starship trip: board at the Mechazilla tower crew elevator → countdown → liftoff → booster catch → space → land at Moon Base Artemis or Mars Base Alpha. Ride back from the base pad any time!', 'good'));
      ctx.npc(8, 7.5, { sit: true, yaw: Math.PI, name: 'Flight Director Kim', lines: ['T-minus whenever you are ready!', 'The chopsticks catch the booster — it\'s wild.', 'Low gravity on the Moon: jump really high!'] });
      ctx.npc(16, 11.5, { sit: true, yaw: Math.PI, lines: ['Telemetry looks nominal.', 'Go for launch!'] });
      ctx.npc(12, 15, { walk: [[12, 15], [20, 15], [4, 15]], lines: ['Did you see the tower?', 'Next stop: Mars!'] });
      ctx.photo(12, 1.2, 17, 'Mission Control');
      ctx.shop(21, 1.2, 17, '🎁 Starbase gift shop', '🚀 Starbase gift shop', [{ e: '🚀', n: 'Starship model', price: 9 }, { e: '🧑‍🚀', n: 'Astronaut helmet', price: 8 }, { e: '🌕', n: 'Moon rock (replica)', price: 4 }, { e: '🔴', n: 'Mars dust jar', price: 4 }]);
    } },
  { id: 'sbx-bbq', short: 'bbq', name: 'Flame Trench Texas BBQ', icon: '🍖', kind: 'stand', door: [-400, -140], face: 'e',
    outside(pl, c) { stand(pl, c, { sign: ['TEXAS BBQ'], signM: 62, awnA: 70, awnB: 62, cook: 'Pitmaster Joe', photo: 'Starbase BBQ', lines: ['Howdy! Brisket\'s smokin\'.', 'Fuel up before you fly to Mars, partner.', 'Y\'all come back now!'], menu: [{ e: '🍖', n: 'Brisket plate', heal: 42, price: 6, col: 0x5d2f1e }, { e: '🌭', n: 'Sausage wrap', heal: 25, price: 3, col: 0xc0392b }, { e: '🌽', n: 'Corn on the cob', heal: 12, price: 2, col: 0xffeb3b }, { e: '🥤', n: 'Sweet tea', heal: 8, price: 2, col: 0x8d6e63 }] }); } },
];

// ==================================================================== MOON + MARS habitats
function habitat(o) {
  return { id: o.id, short: 'hab', name: o.name, icon: o.icon, kind: 'interior', door: [-60, 5.5], face: 's', reserve: false, room: { w: 22, h: 6, d: 20 }, hint: o.hint,
    outside(pl, c) { SKY.signBoard(pl.dx, pl.dy + 4.4, pl.dz + 0.3, [{ t: o.sign, m: 63 }], 0.5, 70, 63, 's'); },
    build(ctx) {
      roomBase(ctx, (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? 56 : 29), wallPaint(29, 56, 3), 29);
      lightsGrid(ctx, 5, 57);
      ctx.B(1, 1.5, 1, 21, 4.5, 1.5, 3); // big window to the outside
      ctx.picture(11, 3, 1.6, 18, 3, 's', o.view, 120, 20);
      counter(ctx, 3, 5, 9, 6, 56, 29); ctx.menu(6, 1.2, 7.4, '🧑‍🚀 Space food', o.icon + ' ' + o.name, o.menu);
      for (const [x, z] of [[14, 8], [18, 8]]) { ctx.B(x - 1, 0, z - 2, x + 1, 1.5, z + 2, 56); ctx.B(x - 0.75, 1.5, z - 1.75, x + 0.75, 2, z + 1.75, 68); } // bunks
      for (let x = 3; x < 10; x += 1.5) { ctx.B(x, 0, 12, x + 1, 0.5, 16, 56); for (let z = 12.25; z < 16; z += 0.75) ctx.F(x + 0.25, 0.5, z, o.crop); }
      ctx.act(6, 1.2, 14, 2.6, o.cropLabel, () => { SKY.Audio.play('ding'); SKY.toast(o.cropToast, 'good'); });
      ctx.npc(6, 3.6, { name: o.npc, shirt: 0xf2f2f2, yaw: 0, lines: o.lines });
      ctx.npc(16, 14, { walk: [[16, 14], [20, 11], [12, 11]], shirt: 0xff9800, lines: o.lines2 });
      ctx.photo(11, 1.2, 17, o.name);
      ctx.act(18, 1.2, 15, 2.6, '🏋 Low-gravity treadmill', () => { SKY.toast('🏃 Bounce, bounce! Exercise keeps your bones strong in ' + o.g + ' gravity.', 'good'); });
    } };
}
D.MOON = [habitat({ id: 'moon-hab', name: 'Artemis Habitat', icon: '🌕', sign: 'HABITAT', hint: 'Space food, bunks and a view of the Earth.', g: '1/6',
  view: (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = '#fff'; g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1, 1); } g.fillStyle = '#9a9a9a'; g.fillRect(0, h * 0.7, w, h); g.fillStyle = '#2f74b5'; g.beginPath(); g.arc(w * 0.7, h * 0.3, h * 0.18, 0, 6.3); g.fill(); g.fillStyle = '#4caf50'; g.fillRect(w * 0.68, h * 0.25, 3, 2); },
  menu: [{ e: '🍦', n: 'Freeze-dried ice cream', heal: 12, price: 3, col: 0xf8bbd0 }, { e: '🌯', n: 'Space tortilla', heal: 25, price: 3, col: 0xe8d4a0 }, { e: '🥤', n: 'Juice pouch', heal: 8, price: 2, col: 0xff9800 }],
  crop: 36, cropLabel: '🌱 Check the hydroponic lettuce', cropToast: '🥬 The Moon lettuce is growing nicely under the LED lights!',
  npc: 'Commander Ada', lines: ['Welcome to the Moon! Mind the dust.', 'That blue marble out the window is home.', 'Try jumping outside — you weigh 1/6 here!'], lines2: ['Moonwalk time!', 'One small step…'] })];
D.MARS = [habitat({ id: 'mars-hab', name: 'Mars Greenhouse Lab', icon: '🔴', sign: 'GREENHOUSE LAB', hint: 'Space potatoes, science and red dust.', g: '3/8',
  view: (g, w, h) => { g.fillStyle = '#d99a6c'; g.fillRect(0, 0, w, h); g.fillStyle = '#b5653a'; g.fillRect(0, h * 0.65, w, h); g.fillStyle = '#8a3a1e'; g.beginPath(); g.moveTo(w * 0.1, h * 0.65); g.lineTo(w * 0.35, h * 0.35); g.lineTo(w * 0.6, h * 0.65); g.fill(); },
  menu: [{ e: '🥔', n: 'Martian potato', heal: 30, price: 3, col: 0xc8a874 }, { e: '🍅', n: 'Greenhouse tomato', heal: 12, price: 2, col: 0xe53935 }, { e: '🥤', n: 'Recycled water (yum?)', heal: 6, price: 1, col: 0xb3e5fc }],
  crop: 37, cropLabel: '🥔 Dig up a Mars potato', cropToast: '🥔 You harvested a potato grown in Martian soil. Science!',
  npc: 'Dr. Mae', lines: ['Welcome to Mars! Sunsets here are blue.', 'We grow potatoes in the regolith.', 'Gravity is 38% — enjoy the bounce!'], lines2: ['Red planet, red dust, red everything.', 'Next: a Starship back home.'] })];

for (const cid of ['LON', 'SBX', 'UIO', 'RIO']) { /* airport clinics are added by clinic.js */ }
})();

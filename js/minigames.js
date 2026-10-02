'use strict';
// GROK SKY - place panel UI + mini-games: food menus, souvenir shops, slots, roulette, blackjack,
// GROK INVADERS (arcade), claw machine, skee-ball, taiko and the movie-scene game. Fun coins only.
(() => {
const $ = (id) => document.getElementById(id);
const PL = SKY.Places;
const Mi = SKY.Mini = { loop: null, kind: null };
const G = () => SKY.Game;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coinsTxt = () => '🪙 ' + PL.coins();
function open(title, html, kind) {
  const g = G(); Mi.stop(); g.ui = 'place'; Mi.kind = kind || 'panel'; g.unlockPointer();
  $('pp-title').textContent = title; $('pp-body').innerHTML = html; Mi.refresh(); $('placePanel').classList.add('show');
  return $('pp-body');
}
Mi.refresh = () => { const c = $('pp-coins'); if (c) c.textContent = coinsTxt(); };
Mi.stop = () => { if (Mi.loop && Mi.loop.stop) Mi.loop.stop(); Mi.loop = null; Mi.kind = null; };
Mi.close = () => { Mi.stop(); $('placePanel').classList.remove('show'); };
Mi.isOpen = () => G().ui === 'place';
Mi.update = (dt) => { if (Mi.loop && G().ui === 'place') { Mi.loop.update(dt); Mi.refresh(); } };
const btn = (label, id, cls) => '<button id="' + id + '" class="' + (cls || '') + '">' + label + '</button>';
const on = (id, fn) => { const b = $(id); if (b) b.onclick = (e) => { e.stopPropagation(); fn(); }; };
// hold-buttons for touch (pointer events)
const hold = (id, key) => { const b = $(id); if (!b) return; const set = (v) => (e) => { e.preventDefault(); Mi.held[key] = v; }; b.addEventListener('pointerdown', set(true)); b.addEventListener('pointerup', set(false)); b.addEventListener('pointerleave', set(false)); b.addEventListener('pointercancel', set(false)); };
Mi.held = {};

// ---------------------------------------------------------------- food
Mi.menu = (title, items, city) => {
  const rows = items.map((it, i) => '<div class="prow"><span class="pe">' + it.e + '</span><b>' + esc(it.n) + '<small>+' + it.heal + ' HP</small></b>' + btn('Eat · 🪙' + it.price, 'pm-e' + i, 'go') + btn('🥡 To go', 'pm-t' + i) + '</div>').join('');
  open(title, '<p class="fine">❤️ HP ' + Math.round(SKY.Player.hp) + '/100 · food heals you. "To go" puts it on a tray you can carry — even onto your plane to serve a passenger.</p>' + rows, 'menu');
  items.forEach((it, i) => {
    on('pm-e' + i, () => { if (!PL.spend(it.price)) return; PL.eat(it, city); Mi.refresh(); const p = $('pp-body').querySelector('.fine'); if (p) p.textContent = '❤️ HP ' + Math.round(SKY.Player.hp) + '/100 · ' + it.e + ' Yum!'; });
    on('pm-t' + i, () => { if (!PL.spend(it.price)) return; G().closeUI(); PL.togo(it); });
  });
};
// ---------------------------------------------------------------- souvenirs
Mi.shop = (title, items) => {
  const rows = items.map((it, i) => '<div class="prow"><span class="pe">' + it.e + '</span><b>' + esc(it.n) + '</b>' + btn('Buy · 🪙' + it.price, 'ps-' + i, 'go') + '</div>').join('');
  open(title, '<p class="fine">Souvenirs collected: <span id="ps-n">' + PL.save.souv.length + '</span>. Earn coins with photos 📸, slots 🎰 and arcade games 🕹.</p>' + rows, 'shop');
  items.forEach((it, i) => on('ps-' + i, () => { if (!PL.spend(it.price)) return; PL.addSouvenir(it.e, it.n); $('ps-n').textContent = PL.save.souv.length; Mi.refresh(); }));
};
// ---------------------------------------------------------------- cashier
Mi.cashier = () => {
  const S = PL.save; const hs = Object.keys(S.hi).map((k) => k + ': ' + S.hi[k]).join(' · ') || '—';
  const b = open('💵 Cashier', '<p>Balance: <b>' + coinsTxt() + '</b></p><p class="fine">Souvenirs (' + S.souv.length + '): ' + esc(S.souv.slice(-12).join(', ') || 'none yet') + '</p><p class="fine">High scores: ' + esc(hs) + '</p><div class="row">' + btn('🎁 Ask for a comp', 'pc-comp', 'go') + '</div><p id="pc-msg" class="fine"></p>', 'cashier');
  on('pc-comp', () => {
    const now = Date.now(); if (PL.coins() >= 10) { $('pc-msg').textContent = '"You look like you\'re doing just fine, friend!" (comps are for balances under 10)'; return; }
    if (S.compT && now - S.compT < 60000) { $('pc-msg').textContent = '"Come back in a minute, hon."'; return; }
    S.compT = now; PL.earn(25, '(casino comp)'); Mi.refresh(); $('pc-msg').textContent = '"On the house! Good luck!" +25 🪙';
  });
  return b;
};
// ---------------------------------------------------------------- slots
const SYM = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
Mi.slots = (id) => {
  open('🎰 Lucky Grok Slots', '<div class="reels"><span id="r0">7️⃣</span><span id="r1">7️⃣</span><span id="r2">7️⃣</span></div><p id="sl-msg" class="big">Three 7️⃣ = JACKPOT (50×) · three alike 10× · two alike 2×</p><div class="row">' + btn('SPIN · 🪙1', 'sl-1', 'go') + btn('SPIN · 🪙5', 'sl-5', 'go') + '</div>', 'slots');
  const st = { spin: 0, bet: 0, res: null, t: 0 };
  const spin = (bet) => { if (st.spin > 0) return; if (!PL.spend(bet)) return; st.bet = bet; st.t = 0; st.spin = 1.4; const f = Mi.forceSlots; Mi.forceSlots = null; st.res = f ? f.slice() : [0, 1, 2].map(() => (Math.random() < 0.16 ? 5 : Math.floor(Math.random() * 6))); $('sl-msg').textContent = 'Spinning…'; SKY.Audio.play('woosh'); Mi.stats.spins++; };
  on('sl-1', () => spin(1)); on('sl-5', () => spin(5));
  Mi.loop = { id, update(dt) {
    if (st.spin <= 0) return; st.spin -= dt; st.t += dt;
    for (let i = 0; i < 3; i++) { const stopT = 0.55 + i * 0.4; const el = $('r' + i); if (!el) return; el.textContent = st.t < stopT ? SYM[Math.floor(st.t * 18 + i * 2) % 6] : SYM[st.res[i]]; }
    if (st.spin <= 0) {
      const r = st.res; let mult = 0, msg;
      if (r[0] === 5 && r[1] === 5 && r[2] === 5) { mult = 50; msg = '💥 JACKPOT!!! 7️⃣7️⃣7️⃣'; G().achieve('jackpot'); SKY.Audio.play('whoop'); }
      else if (r[0] === r[1] && r[1] === r[2]) { mult = 10; msg = '🎉 THREE OF A KIND!'; SKY.Audio.play('chime'); }
      else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) { mult = 2; msg = '👍 A pair!'; SKY.Audio.play('ding'); }
      else { msg = 'No luck… spin again?'; SKY.Audio.play('bonk'); }
      const win = st.bet * mult; if (win) { PL.earn(win); Mi.stats.won += win; } Mi.lastSlot = { r: r.slice(), win };
      $('sl-msg').textContent = msg + (win ? ' +' + win + ' 🪙' : '');
    }
  } };
};
Mi.stats = { spins: 0, won: 0 };
// ---------------------------------------------------------------- roulette
Mi.roulette = () => {
  open('🎡 Roulette', '<div class="reels"><span id="ru-n" style="min-width:3em">--</span></div><p id="ru-msg" class="big">Red / Black pays 2× · Green 0 pays 14×</p><div class="row">' + btn('🔴 RED · 🪙2', 'ru-r', 'go') + btn('⚫ BLACK · 🪙2', 'ru-b', 'go') + btn('🟢 0 · 🪙1', 'ru-g', 'go') + '</div>', 'roulette');
  const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const st = { t: 0, pick: null, n: 0, bet: 0 };
  const go = (pick, bet) => { if (st.t > 0) return; if (!PL.spend(bet)) return; st.pick = pick; st.bet = bet; st.t = 1.6; st.n = Math.floor(Math.random() * 37); SKY.Audio.play('woosh'); };
  on('ru-r', () => go('red', 2)); on('ru-b', () => go('black', 2)); on('ru-g', () => go('green', 1));
  Mi.loop = { update(dt) {
    if (st.t <= 0) return; st.t -= dt; const el = $('ru-n'); if (!el) return;
    const show = st.t > 0 ? Math.floor(Math.random() * 37) : st.n; const col = show === 0 ? 'green' : RED.includes(show) ? 'red' : 'black';
    el.textContent = (col === 'red' ? '🔴 ' : col === 'black' ? '⚫ ' : '🟢 ') + show;
    if (st.t <= 0) { const win = col === st.pick ? (col === 'green' ? 14 : 2) * st.bet : 0; if (win) { PL.earn(win); SKY.Audio.play('chime'); } else SKY.Audio.play('bonk'); $('ru-msg').textContent = (win ? '🎉 ' + col.toUpperCase() + '! You win ' + win + ' 🪙' : 'House wins. ' + col + ' ' + st.n); }
  } };
};
// ---------------------------------------------------------------- blackjack
Mi.blackjack = () => {
  open('🃏 Blackjack', '<div class="bj"><div>Dealer: <span id="bj-d"></span> <i id="bj-dv"></i></div><div>You: <span id="bj-p"></span> <i id="bj-pv"></i></div></div><p id="bj-msg" class="big">Bet 2 🪙 · Blackjack pays 3:2</p><div class="row">' + btn('DEAL · 🪙2', 'bj-deal', 'go') + btn('HIT', 'bj-hit') + btn('STAND', 'bj-st') + '</div>', 'blackjack');
  const suits = ['♠', '♥', '♦', '♣'], ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const st = { deck: [], p: [], d: [], live: false };
  const draw = () => { if (!st.deck.length) { for (const s of suits) for (const r of ranks) st.deck.push(r + s); st.deck.sort(() => Math.random() - 0.5); } return st.deck.pop(); };
  const val = (h) => { let v = 0, a = 0; for (const c of h) { const r = c.slice(0, -1); v += r === 'A' ? 11 : 'JQK'.includes(r) ? 10 : +r; if (r === 'A') a++; } while (v > 21 && a) { v -= 10; a--; } return v; };
  const show = (hide) => { $('bj-p').textContent = st.p.join(' '); $('bj-pv').textContent = '(' + val(st.p) + ')'; $('bj-d').textContent = hide ? st.d[0] + ' 🂠' : st.d.join(' '); $('bj-dv').textContent = hide ? '' : '(' + val(st.d) + ')'; };
  const end = (msg, pay) => { st.live = false; show(false); if (pay) PL.earn(pay); SKY.Audio.play(pay > 2 ? 'chime' : pay === 2 ? 'ding' : 'bonk'); $('bj-msg').textContent = msg + (pay ? ' +' + pay + ' 🪙' : ''); Mi.refresh(); };
  const stand = () => { if (!st.live) return; while (val(st.d) < 17) st.d.push(draw()); const p = val(st.p), d = val(st.d); if (d > 21 || p > d) end('🎉 You win!', 4); else if (p === d) end('Push.', 2); else end('Dealer wins.', 0); };
  on('bj-deal', () => { if (st.live || !PL.spend(2)) return; st.p = [draw(), draw()]; st.d = [draw(), draw()]; st.live = true; show(true); $('bj-msg').textContent = 'Hit or stand?'; if (val(st.p) === 21) end('🃏 BLACKJACK!', 5); });
  on('bj-hit', () => { if (!st.live) return; st.p.push(draw()); show(true); if (val(st.p) > 21) end('💥 Bust!', 0); });
  on('bj-st', stand);
  Mi.loop = { update() { } };
};
// ---------------------------------------------------------------- GROK INVADERS (canvas arcade)
Mi.invaders = (id, title) => {
  if (!PL.spend(1)) return;
  const hi = PL.save.hi[id] || 0;
  open('👾 ' + (title || 'GROK INVADERS'), '<canvas id="inv" width="240" height="280"></canvas><p id="inv-msg" class="fine">◀ ▶ to move (arrow keys / A D) · auto-fire · 60 s · HIGH ' + hi + '</p><div class="row">' + btn('◀', 'inv-l', 'pad') + btn('▶', 'inv-r', 'pad') + '</div>', 'invaders');
  hold('inv-l', 'l'); hold('inv-r', 'r'); Mi.held = {};
  const cv = $('inv'), g = cv.getContext('2d');
  const s = { x: 120, t: 60, score: 0, lives: 3, shots: [], bombs: [], fireT: 0, dir: 1, step: 0, ufo: null, over: false, inv: [], boom: [] };
  const wave = () => { s.inv = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) s.inv.push({ x: 24 + c * 24, y: 28 + r * 20, r, alive: true }); s.dir = 1; };
  wave();
  const finish = () => {
    s.over = true; const coins = Math.floor(s.score / 50); if (coins) PL.earn(coins, '(GROK INVADERS score ' + s.score + ')');
    const best = PL.save.hi[id] || 0; let msg = 'GAME OVER · score ' + s.score + ' · +' + coins + ' 🪙';
    if (s.score > best) { PL.save.hi[id] = s.score; PL.persist(); msg += ' · 🏆 NEW HIGH SCORE!'; SKY.Audio.play('whoop'); }
    if (s.score >= 500) G().achieve('arcade');
    Mi.lastInvaders = { id, score: s.score, coins };
    const m = $('inv-msg'); if (m) m.textContent = msg + ' (USE the cabinet to play again)';
  };
  const I = SKY.Input;
  const step = (dt, auto) => {
    if (s.over) return;
    s.t -= dt; if (s.t <= 0 || s.lives <= 0) { finish(); return; }
    let mv = (Mi.held.l || I.keys.ArrowLeft || I.keys.KeyA ? -1 : 0) + (Mi.held.r || I.keys.ArrowRight || I.keys.KeyD ? 1 : 0);
    if (auto) { let best = null, bd = 1e9; for (const e of s.inv) if (e.alive) { const d = Math.abs(e.x - s.x) - e.y * 0.2; if (d < bd) { bd = d; best = e; } } const danger = s.bombs.find((b) => b.y > 200 && Math.abs(b.x - s.x) < 10); mv = danger ? (danger.x > s.x ? -1 : 1) : best ? Math.sign(best.x - s.x) * (Math.abs(best.x - s.x) > 2 ? 1 : 0) : 0; }
    s.x = Math.max(10, Math.min(230, s.x + mv * 140 * dt));
    s.fireT -= dt; if (s.fireT <= 0 && s.shots.length < 3) { s.fireT = 0.32; s.shots.push({ x: s.x, y: 250 }); }
    for (const b of s.shots) b.y -= 260 * dt; s.shots = s.shots.filter((b) => b.y > 0 && !b.hit);
    // formation march
    const alive = s.inv.filter((e) => e.alive); const speed = 14 + (32 - alive.length) * 2.2;
    let minX = 999, maxX = -999; for (const e of alive) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); }
    if ((s.dir > 0 && maxX > 228) || (s.dir < 0 && minX < 12)) { s.dir = -s.dir; for (const e of alive) e.y += 8; }
    for (const e of alive) e.x += s.dir * speed * dt;
    if (alive.some((e) => e.y > 236)) { s.lives = 0; }
    if (Math.random() < dt * (1.2 + (32 - alive.length) * 0.05) && alive.length) { const e = alive[Math.floor(Math.random() * alive.length)]; s.bombs.push({ x: e.x, y: e.y + 6 }); }
    for (const b of s.bombs) b.y += 110 * dt; s.bombs = s.bombs.filter((b) => { if (b.y > 246 && b.y < 262 && Math.abs(b.x - s.x) < 9) { s.lives--; s.boom.push({ x: s.x, y: 252, t: 0.4 }); SKY.Audio.play('hit'); return false; } return b.y < 290; });
    if (!s.ufo && Math.random() < dt * 0.12) s.ufo = { x: -10, y: 14 };
    if (s.ufo) { s.ufo.x += 60 * dt; if (s.ufo.x > 260) s.ufo = null; }
    for (const b of s.shots) {
      for (const e of alive) if (e.alive && Math.abs(b.x - e.x) < 9 && Math.abs(b.y - e.y) < 8) { e.alive = false; b.hit = true; s.score += (4 - e.r) * 10; s.boom.push({ x: e.x, y: e.y, t: 0.25 }); if (!auto) SKY.Audio.play('pop'); break; }
      if (s.ufo && !b.hit && Math.abs(b.x - s.ufo.x) < 12 && Math.abs(b.y - s.ufo.y) < 7) { b.hit = true; s.score += 100; s.boom.push({ x: s.ufo.x, y: s.ufo.y, t: 0.4 }); s.ufo = null; }
    }
    if (!s.inv.some((e) => e.alive)) { s.score += 50; wave(); }
    for (const b of s.boom) b.t -= dt; s.boom = s.boom.filter((b) => b.t > 0);
  };
  const draw = () => {
    g.fillStyle = '#05050f'; g.fillRect(0, 0, 240, 280);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect((i * 97) % 240, (i * 53 + s.t * 10) % 280, 1, 1); }
    const cols = ['#ff4d6d', '#ffd23d', '#3dffb2', '#3dc8ff'];
    for (const e of s.inv) if (e.alive) { g.fillStyle = cols[e.r]; const fr = Math.floor(s.t * 3) % 2; g.fillRect(e.x - 7, e.y - 4, 14, 7); g.fillRect(e.x - 9, e.y + (fr ? -2 : 2), 3, 4); g.fillRect(e.x + 6, e.y + (fr ? -2 : 2), 3, 4); g.fillStyle = '#05050f'; g.fillRect(e.x - 4, e.y - 2, 2, 2); g.fillRect(e.x + 2, e.y - 2, 2, 2); }
    if (s.ufo) { g.fillStyle = '#c0c6cc'; g.fillRect(s.ufo.x - 11, s.ufo.y - 2, 22, 5); g.fillStyle = '#9dff3a'; g.fillRect(s.ufo.x - 5, s.ufo.y - 6, 10, 4); }
    g.fillStyle = '#fff'; for (const b of s.shots) g.fillRect(b.x - 1, b.y - 4, 2, 6);
    g.fillStyle = '#ff9a3c'; for (const b of s.bombs) g.fillRect(b.x - 1, b.y - 3, 3, 6);
    // player: a tiny airliner
    g.fillStyle = '#f4f6fa'; g.fillRect(s.x - 2, 246, 4, 14); g.fillRect(s.x - 10, 252, 20, 3); g.fillRect(s.x - 5, 258, 10, 2); g.fillStyle = '#1f6fe0'; g.fillRect(s.x - 1, 247, 2, 3);
    g.fillStyle = '#ffcc33'; for (const b of s.boom) { g.globalAlpha = Math.min(1, b.t * 4); g.fillRect(b.x - 8, b.y - 1, 16, 2); g.fillRect(b.x - 1, b.y - 8, 2, 16); g.globalAlpha = 1; }
    g.fillStyle = '#fff'; g.font = 'bold 12px monospace'; g.fillText('SCORE ' + s.score, 6, 274); g.fillText('⏱' + Math.max(0, Math.ceil(s.t)), 112, 274); g.fillText('✈'.repeat(Math.max(0, s.lives)), 190, 274);
    if (s.over) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 100, 240, 60); g.fillStyle = '#ffd23d'; g.font = 'bold 18px monospace'; g.fillText('GAME OVER', 72, 128); g.font = '12px monospace'; g.fillText('SCORE ' + s.score, 82, 148); }
  };
  Mi.loop = { update(dt) { step(Math.min(dt, 0.05)); draw(); }, state: s, simulate(sec) { for (let t = 0; t < sec && !s.over; t += 1 / 60) step(1 / 60, true); draw(); return s.score; }, stop() { Mi.held = {}; } };
  draw();
};
// ---------------------------------------------------------------- timing-meter games (claw, skee-ball, taiko, movie)
function meterGame(title, intro, btnLabel, rounds, speed, onHit, onEnd) {
  open(title, '<p class="fine">' + intro + '</p><div class="meter"><i id="mt-zone"></i><b id="mt-cur"></b></div><p id="mt-msg" class="big">Round 1/' + rounds + '</p><div class="row">' + btn(btnLabel, 'mt-go', 'go big') + '</div>', 'meter');
  const st = { p: 0, d: 1, round: 0, total: 0, zone: 0.4 + Math.random() * 0.3, done: false, results: [] };
  const z = $('mt-zone'); const setZone = () => { if (z) { z.style.left = (st.zone * 100 - 7) + '%'; } }; setZone();
  const press = () => {
    if (st.done) return; const acc = 1 - Math.min(1, Math.abs(st.p - st.zone) / 0.5); const pts = onHit(acc, st.round); st.total += pts; st.results.push(acc); st.round++;
    $('mt-msg').textContent = (acc > 0.86 ? '🎯 PERFECT! ' : acc > 0.6 ? '👍 Nice! ' : '😅 Meh. ') + '+' + pts + (st.round < rounds ? ' · Round ' + (st.round + 1) + '/' + rounds : '');
    SKY.Audio.play(acc > 0.86 ? 'chime' : acc > 0.6 ? 'ding' : 'bonk');
    st.zone = 0.15 + Math.random() * 0.7; setZone();
    if (st.round >= rounds) { st.done = true; const m = onEnd(st.total, st.results); $('mt-msg').textContent = m; Mi.lastMeter = { title, total: st.total }; }
  };
  on('mt-go', press);
  Mi.loop = { update(dt) { if (st.done) return; st.p += st.d * dt * speed * (1 + st.round * 0.15); if (st.p > 1) { st.p = 1; st.d = -1; } if (st.p < 0) { st.p = 0; st.d = 1; } const c = $('mt-cur'); if (c) c.style.left = (st.p * 100) + '%'; }, press, state: st, auto() { st.p = st.zone; press(); } };
}
Mi.claw = () => { if (!PL.spend(2)) return; meterGame('🧸 Claw machine', 'Stop the claw over the glowing prize!', '⬇ DROP', 1, 1.3, (acc) => (acc > 0.8 ? 1 : 0), (t) => { if (t) { const pr = SKY.choose([['🧸', 'Claw-machine teddy'], ['🐙', 'Octopus plush'], ['👽', 'Alien plush'], ['🐱', 'Cat plush']]); PL.addSouvenir(pr[0], pr[1]); return '🎉 You grabbed a prize! ' + pr[0]; } return '😩 It slipped out of the claw… (USE the machine to try again)'; }); };
Mi.skee = () => { if (!PL.spend(1)) return; meterGame('🎳 Skee-ball', 'Roll when the power is in the glowing zone. 5 balls.', '🎳 ROLL', 5, 1.6, (acc) => (acc > 0.9 ? 100 : acc > 0.75 ? 50 : acc > 0.5 ? 30 : 10), (t) => { const c = Math.floor(t / 60); PL.earn(c); if (t >= 400) SKY.Game.achieve('arcade'); return '🎳 Total ' + t + ' points · +' + c + ' 🪙'; }); };
Mi.taiko = () => { if (!PL.spend(1)) return; meterGame('🥁 Taiko drums', 'Hit DON when the beat lines up! 8 beats.', '🥁 DON!', 8, 2.2, (acc) => (acc > 0.86 ? 50 : acc > 0.6 ? 20 : 0), (t) => { const c = Math.floor(t / 70); PL.earn(c); return '🥁 Score ' + t + (t >= 300 ? ' · FULL COMBO-ish! ' : ' · ') + '+' + c + ' 🪙'; }); };
Mi.movie = () => {
  open('🎬 Star in a scene', '<p>Pick your genre, then deliver your line on cue!</p><div class="row">' + btn('🤠 Western', 'mv-w', 'go') + btn('🚀 Sci-fi', 'mv-s', 'go') + btn('💘 Romance', 'mv-r', 'go') + '</div>', 'movie');
  const lines = { w: ['"Reach for the sky!"', '"This town ain\'t big enough…"', '"Saddle up!"'], s: ['"Engage the hyperdrive!"', '"We come in peace."', '"I\'ve got a bad feeling about this."'], r: ['"Here\'s looking at you, kid."', '"You complete me."', '"I\'ll never let go."'] };
  const go = (k) => meterGame('🎬 ACTION!', 'Your line: ' + SKY.choose(lines[k]) + ' — hit SAY IT when the timing is right. 3 takes.', '🎤 SAY IT', 3, 1.4, (acc) => Math.round(acc * 5), (t) => { const stars = Math.max(1, Math.min(5, Math.round(t / 3))); PL.earn(stars); PL.photo('Movie Star at Grok Studios'); return '⭐'.repeat(stars) + ' "That\'s a wrap!" +' + stars + ' 🪙'; });
  on('mv-w', () => go('w')); on('mv-s', () => go('s')); on('mv-r', () => go('r'));
};
})();

'use strict';
// GROK SKY 4.1 - DISASTERS: trigger failures on demand (🚨 panel) or at random, emergency checklists, damage FX,
// alarms + HUD warnings, ATC mayday, a safe-landing score. Cartoon only: a crash is a cartoon reset, nobody gets hurt.
// Co-op: the plane's pilot (leader) owns the emergencies; riders mirror them (s.dz) and can tap steps / trigger (t:'dz').
(() => {
const { clamp, rand } = SKY;
const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _c = new THREE.Color();
const FT10K = () => SKY.feetToY(10000);
// ------------------------------------------------------------------ definitions
const DEFS = {
  engfire: { icon: '🔥', name: 'Engine fire', desc: 'An engine catches fire', alert: '🔥 ENGINE FIRE', land: true },
  blowout: { icon: '💥', name: 'Engine blowout', desc: 'BANG! An engine quits', alert: '💥 ENGINE FAILURE', land: true },
  gear: { icon: '🛞', name: 'Landing gear failure', desc: 'Gear stuck up — crank it down', alert: '🛞 GEAR UNSAFE', land: true },
  brakes: { icon: '🛑', name: 'Brake failure', desc: 'Brakes stop working', alert: '🛑 BRAKES FAILED', land: true },
  depress: { icon: '😷', name: 'Cabin depressurization', desc: 'Pressure drops, masks drop', alert: '😷 CABIN PRESSURE', land: true },
  hyd: { icon: '🛢', name: 'Hydraulic failure', desc: 'Controls go mushy, flaps stuck', alert: '🛢 HYDRAULICS', land: true },
  elec: { icon: '🔌', name: 'Electrical failure', desc: 'Screens go dark, radio dead', alert: '🔌 ELECTRICAL FAILURE', land: false },
  meteor: { icon: '☄️', name: 'Meteor shower', desc: 'Space rocks rain down!', alert: '☄️ METEOR SHOWER', land: false, fantasy: true },
  storm: { icon: '🌩', name: 'Lightning storm', desc: 'Bolts everywhere — you will get zapped', alert: '🌩 LIGHTNING STORM', land: false, fantasy: true },
};
const ORDER = ['engfire', 'blowout', 'gear', 'brakes', 'depress', 'hyd', 'elec', 'meteor', 'storm'];
const RANDOM = { off: null, rare: [300, 480], normal: [120, 200], chaos: [35, 60] };
// steps: k, label, kind (tap | timed | crank | cond), opt = optional (bonus)
function stepsFor(id, e) {
  const en = e.engName;
  const S = (k, label, kind, extra) => Object.assign({ k, label, kind, done: false, prog: 0, run: false }, extra || {});
  const L = S('land', '🛬 Land at the nearest airport (or stop)', 'cond');
  const M = S('mayday', '📻 Declare MAYDAY', 'tap', { opt: true });
  switch (id) {
    case 'engfire': return [S('shut', '🛑 Shut down ' + en, 'tap'), S('ext', '🧯 Fire extinguisher ' + en, 'tap'), M, L];
    case 'blowout': return [S('shut', '🛑 Shut down ' + en, 'tap'), S('trim', '🦶 Rudder trim (fly straight)', 'tap'), M, L];
    case 'gear': return [S('crank', '🔧 Crank the gear down (tap ×10)', 'crank'), M, L];
    case 'brakes': return [S('alt', '🔁 Switch to alternate brakes', 'timed', { dur: 5 }), M, L];
    case 'depress': return [S('mask', '😷 Put on your oxygen mask', 'tap'), S('desc', '⬇ Descend below 10,000 ft', 'cond'), M, L];
    case 'hyd': return [S('backup', '🔁 Switch to backup hydraulics', 'timed', { dur: 5 }), M, L];
    case 'elec': return [S('apu', '🔋 Start the APU (backup power)', 'timed', { dur: 7 }), M];
    case 'meteor': return [S('dodge', '↔ Keep flying — dodge the rocks!', 'cond'), S('ext', '🧯 Fire suppression', 'tap'), M];
    case 'storm': return [S('hold', '🤞 Hold on — fly through the storm', 'cond'), S('reset', '🔄 Reset tripped systems', 'tap', { opt: true }), M];
  }
  return [M, L];
}
const D = SKY.Disasters = {
  DEFS, ORDER, list: [], sess: null, mode: 'off', nextT: 60, mirrored: false, silenced: false, atcQ: [], atcT: 0,
  meteors: [], meteorT: 0, stormT: 0, bolts: [], boltT: 0, hitT: 0, glitchT: 0, foamT: 0, extFires: [], wasAir: false, tdVy: 0, best: 0, uid: 0,
  init() {
    try { this.mode = localStorage.getItem('grokSkyDzRandom') || 'off'; if (!(this.mode in RANDOM)) this.mode = 'off'; this.best = +localStorage.getItem('grokSkyDzBest') || 0; } catch (e) { }
    this.buildUI();
    this.reset();
  },
  pl() { return SKY.Game.plane; },
  reset() {
    const pl = this.pl(); this.list = []; this.sess = null; this.mirrored = false; this.silenced = false; this.atcQ = []; this.atcT = 0;
    this.meteorT = 0; this.stormT = 0; this.glitchT = 0; this.foamT = 0; this.extFires = []; this.wasAir = false; this.crashCartoon = false;
    for (const m of this.meteors) m.mesh.visible = false; for (const b of this.bolts) b.g.visible = false;
    if (pl && pl.dz) this.resetPlane(pl);
    this.rollNext(); this.sig = ''; this.renderList(true);
    const a = $('atc'); if (a) a.classList.remove('show');
    document.body.classList.remove('dz-elec', 'dz-on');
  },
  resetPlane(pl) { Object.assign(pl.dz, { thr: [1, 1], brake: 1, ctl: 1, pack: false, gearJam: false, flapsJam: false, asymK: 1, flame: [] }); },
  rollNext() { const r = RANDOM[this.mode]; this.nextT = r ? rand(r[0], r[1]) : 1e9; },
  setMode(m) { if (!(m in RANDOM)) return; this.mode = m; try { localStorage.setItem('grokSkyDzRandom', m); } catch (e) { } this.rollNext(); this.renderPanel(); },
  riding() { const pl = this.pl(); return !!(pl && pl.follow); },
  active() { return this.list.length > 0 || this.meteorT > 0 || this.stormT > 0; },
  has(id) { return this.list.some((e) => e.id === id); },
  // engines numbered left -> right
  engines() { const T = this.pl().T; return T.engines.map((p, i) => ({ i, x: p[0], p })).sort((a, b) => a.x - b.x).map((e, n) => Object.assign(e, { n: n + 1 })); },
  engFailed() { const s = new Set(); for (const e of this.list) if ((e.id === 'engfire' || e.id === 'blowout') && e.eng != null) s.add(e.eng); return s; },
  // ------------------------------------------------------------------ availability
  why(id) {
    const G = SKY.Game, pl = this.pl(), P = SKY.Player;
    if (G.state !== 'play' || !G.stats) return 'Start a flight first';
    if (P.mode === 'ride') return 'Not on a rocket!';
    if (pl.crashed) return 'The plane already crashed';
    if (P.frame === 'world' && !this.riding() && P.pos.distanceTo(pl.pos) > 400) return 'Get back to your plane';
    if (id === 'engfire' || id === 'blowout') { const f = this.engFailed(); if (this.engines().every((e) => f.has(e.i))) return 'Every engine is already out'; return null; }
    if (this.has(id)) return 'Already happening';
    if (id === 'gear') { if (pl.T.fixedGear) return 'This plane\'s wheels are bolted on'; if (pl.onGround || pl.altitude() < 30) return 'Only in the air'; }
    if (id === 'depress' && pl.T.id === 'C172') return 'The Cessna isn\'t pressurised';
    return null;
  },
  // ------------------------------------------------------------------ trigger
  trigger(id, opt) {
    opt = opt || {};
    if (this.mirrored && !opt.mirror) { if (SKY.Net && SKY.Net.dzSend({ a: 'go', id })) SKY.toast('🚨 Sent to the pilot: ' + DEFS[id].name, 'warn'); return null; }
    const why = opt.mirror ? null : this.why(id); if (why) { SKY.toast('🚫 ' + why, 'warn'); return null; }
    const pl = this.pl(), def = DEFS[id];
    const e = { id, def, t: 0, uid: ++this.uid, eng: null, engName: '', hits: 0, dents: 0, by: opt.by || null };
    if (id === 'engfire' || id === 'blowout') {
      const eng = this.engines(), f = this.engFailed();
      let pick = opt.eng != null ? eng.find((q) => q.i === opt.eng) : null;
      if (!pick) { const free = eng.filter((q) => !f.has(q.i)); pick = free[Math.floor(Math.random() * free.length)] || eng[0]; }
      e.eng = pick.i; e.engName = eng.length > 1 ? 'ENGINE ' + pick.n : 'THE ENGINE';
    }
    e.steps = stepsFor(id, e);
    this.list.push(e); this.silenced = false;
    if (!this.sess) this.sess = { t0: SKY.Game.time, steps: 0, handled: 0, mayday: false, wasAir: !pl.onGround && pl.altitude() > 20, names: new Set(), hits: 0, belly: false, maxVy: 0 };
    this.sess.names.add(id);
    if (!opt.mirror) this.applyStart(e);
    else this.startFx(e);
    SKY.toast(def.icon + ' ' + def.alert + (e.engName ? ' — ' + e.engName : '') + (opt.by ? ' (by ' + opt.by + ')' : '') + '! Follow the checklist 🚨', 'bad');
    SKY.Audio.play('error'); setTimeout(() => SKY.Audio.play('error'), 260);
    SKY.Game.achieve('disaster');
    this.renderList(true);
    return e;
  },
  // start-of-emergency effects (authoritative side)
  applyStart(e) {
    const pl = this.pl(), G = SKY.Game, fx = G.fx;
    this.startFx(e);
    if (e.id === 'blowout') {
      const p = this.engLocal(e.eng); pl.damage(p, pl.small ? 0.45 : 0.75, 12, fx, false);
      const w = pl.toWorld(p); fx.burst(w.x, w.y, w.z, SKY.lowSpec ? 25 : 50, 0xffe066, 14, 0.35, pl.vel.x * 0.9, pl.vel.y * 0.9, pl.vel.z * 0.9);
      SKY.Audio.play('boom'); G.shake(1); G.flash(20);
      if (Math.random() < 0.5) setTimeout(() => { if (this.list.includes(e) && !this.list.some((q) => q.id === 'engfire' && q.eng === e.eng)) this.trigger('engfire', { eng: e.eng }); }, 2500);
    }
    if (e.id === 'engfire') { SKY.Audio.play('crunch'); G.shake(0.4); }
    if (e.id === 'gear') { pl.dz.gearJam = true; if (pl.gearDown) { pl.gearDown = false; SKY.Audio.play('clang'); } }
    if (e.id === 'brakes') pl.dz.brake = 0.06;
    if (e.id === 'depress') { pl.dz.pack = true; pl.masksDown = true; pl.maskT = 0; SKY.Audio.play('woosh'); SKY.Audio.play('chime'); G.shake(0.5); if (!pl.small) for (let q = 0; q < 26; q++) pl.fxLocal.smoke.spawn(rand(-1.5, 1.5), rand(1.2, 2.2), rand(-9, 8), rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3), rand(2, 3.5), 0.5, 0xf2f6ff); }
    if (e.id === 'hyd') { pl.dz.ctl = 0.4; pl.dz.flapsJam = true; SKY.Audio.play('crunch', 0.6); }
    if (e.id === 'elec') { SKY.Audio.play('pop'); if (pl.ap.on && pl.ap.by === 'player') { pl.ap.on = false; SKY.toast('⚠ AUTOPILOT OFF — no power!', 'bad'); } }
    if (e.id === 'meteor') { this.meteorT = 28; this.meteorSpawn = 1; }
    if (e.id === 'storm') { this.stormT = 26; this.hitT = 2.5; }
    this.applyFlags();
  },
  startFx(e) { if (e.id === 'meteor' && this.meteorT <= 0) this.meteorT = 28; if (e.id === 'storm' && this.stormT <= 0) { this.stormT = 26; this.hitT = 2.5; } },
  engLocal(i) { const p = this.pl().T.engines[i] || [0, 0, 0]; return new THREE.Vector3(p[0], p[1], p[2]); },
  // recompute plane flags from the emergency list (thrust per side etc.)
  applyFlags() {
    const pl = this.pl(); if (!pl.dz) return; const dz = pl.dz;
    const eng = this.engines(); const out = new Set();
    for (const e of this.list) {
      if (e.id === 'blowout') out.add(e.eng);
      if (e.id === 'engfire') { if (e.steps[0].done) out.add(e.eng); }
    }
    for (const f of dz.flame || []) out.add(f.i);
    const side = (x) => (x < -0.01 ? [0] : x > 0.01 ? [1] : [0, 1]);
    const tot = [0, 0], dead = [0, 0];
    for (const q of eng) for (const s of side(q.x)) { tot[s]++; if (out.has(q.i)) dead[s]++; }
    dz.thr = [tot[0] ? 1 - dead[0] / tot[0] : 1, tot[1] ? 1 - dead[1] / tot[1] : 1];
    // burning but still running: sputters
    for (const e of this.list) if (e.id === 'engfire' && !e.steps[0].done) for (const s of side(eng.find((q) => q.i === e.eng).x)) dz.thr[s] = Math.min(dz.thr[s], 0.55);
    const trimmed = this.list.some((e) => e.id === 'blowout' && e.steps[1].done) || this.list.some((e) => e.id === 'engfire' && e.steps[1].done);
    dz.asymK = trimmed ? 0.15 : 1;
    const g = this.list.find((e) => e.id === 'gear'); dz.gearJam = !!(g && !g.steps[0].done);
    const b = this.list.find((e) => e.id === 'brakes'); dz.brake = b ? (b.steps[0].done ? 0.7 : 0.06) : 1;
    const h = this.list.find((e) => e.id === 'hyd'); dz.ctl = h ? (h.steps[0].done ? 0.8 : 0.4) : 1; dz.flapsJam = !!(h && !h.steps[0].done);
    dz.pack = this.has('depress');
  },
  elecOut() { const e = this.list.find((q) => q.id === 'elec'); return !!(e && !e.steps[0].done) || this.glitchT > 0; },
  // ------------------------------------------------------------------ steps
  stepAt(uid, k) { const e = this.list.find((q) => q.uid === uid); return e && e.steps.find((s) => s.k === k) ? [e, e.steps.find((s) => s.k === k)] : [null, null]; },
  tap(uid, k, by) {
    const [e, s] = this.stepAt(uid, k); if (!e || s.done) return;
    if (k === 'mask') { this.doMask(); if (!this.mirrored && SKY.Player.masked) this.done(e, s, by); return; }
    if (this.mirrored) { if (SKY.Net) SKY.Net.dzSend({ a: 'step', id: e.id, eng: e.eng, k }); SKY.Audio.play('beep'); return; }
    const pl = this.pl(), G = SKY.Game;
    if (k === 'mayday') return this.mayday(by);
    if (s.kind === 'cond') { SKY.toast('ℹ ' + s.label + ' — this one ticks itself when you do it', ''); return; }
    if (s.kind === 'crank') { s.prog = Math.min(1, s.prog + 0.1); SKY.Audio.play(s.prog >= 1 ? 'ok' : 'clang'); if (s.prog >= 0.999) { this.done(e, s, by); pl.gearDown = true; SKY.toast('✅ Gear DOWN and locked — three green!', 'good'); } return; }
    if (s.kind === 'timed') { if (!s.run) { s.run = true; SKY.Audio.play('beep'); SKY.toast('⏳ ' + s.label.replace(/^\S+\s/, '') + '…', ''); } return; }
    if (e.id === 'engfire' && k === 'ext' && !e.steps[0].done) { SKY.Audio.play('spray'); SKY.toast('🔥 The fire flares back up — SHUT DOWN the engine first, then the extinguisher!', 'warn'); this.sprayFx(e); return; }
    if (k === 'ext') { this.sprayFx(e); SKY.Audio.play('spray'); if (e.id === 'meteor') this.extFires = []; SKY.toast('🧯 Fire out!', 'good'); }
    if (k === 'shut') { SKY.Audio.play('pop'); SKY.toast('🛑 ' + e.engName + ' shut down. Fly on the other ' + (pl.T.engines.length > 1 ? 'engine' + (pl.T.engines.length > 2 ? 's' : '') : '… glide!'), ''); }
    if (k === 'trim') SKY.toast('🦶 Rudder trimmed — she flies straight now', 'good');
    if (k === 'reset') { pl.dz.flame = []; this.glitchT = 0; SKY.toast('🔄 Breakers reset — systems back online', 'good'); }
    this.done(e, s, by); void G;
  },
  doMask() {
    const P = SKY.Player, pl = this.pl();
    if (P.frame !== 'plane') return SKY.toast('You\'re not in the plane', 'warn');
    if (P.mode === 'seat' || P.mode === 'pilot') { if (!pl.masksDown) { pl.masksDown = true; pl.maskT = 0; } P.masked = true; SKY.Audio.play('pop'); SKY.toast('😷 Mask on. Breathe normally.', 'good'); return; }
    const ms = P.nearestMask && P.nearestMask(); if (ms && ms.d < 1.6) { P.masked = true; SKY.Audio.play('pop'); SKY.toast('😷 Mask on. Breathe normally.', 'good'); }
    else SKY.toast('😷 Sit in a seat or walk to a dangling yellow mask (USE)', 'warn');
  },
  done(e, s, by) {
    if (s.done) return; s.done = true; s.run = false; s.prog = 1;
    if (this.sess) this.sess.steps++;
    if (by) SKY.toast('✅ ' + by + ': ' + s.label, 'good');
    this.applyFlags(); this.renderList(true);
  },
  mayday(by) {
    if (!this.list.length) return;
    if (this.list.some((e) => e.id === 'elec' && !e.steps[0].done)) { SKY.toast('📻 Radio is dead — start the APU first!', 'warn'); SKY.Audio.play('error'); return; }
    for (const e of this.list) { const m = e.steps.find((s) => s.k === 'mayday'); if (m && !m.done) { m.done = true; if (this.sess) this.sess.steps++; } }
    if (this.sess && !this.sess.mayday) { this.sess.mayday = true; this.atcCall(); SKY.Game.achieve('mayday'); }
    if (by) SKY.toast('📻 ' + by + ' declared MAYDAY', 'good');
    this.renderList(true);
  },
  atcCall() {
    const pl = this.pl(), A = SKY.Airport; const what = this.list.map((e) => e.def.name.toLowerCase()).slice(0, 2).join(' and ');
    this.atc('🧑‍✈️ YOU', 'MAYDAY MAYDAY MAYDAY! GROK Air 1, ' + (what || 'emergency') + ', requesting emergency landing!');
    const apt = A && A.nearest(pl.pos.x, pl.pos.z, 1e9);
    if (apt) {
      const dx = apt.ax - pl.pos.x, dz = apt.az - pl.pos.z; let h = Math.atan2(dx, -dz) * 180 / Math.PI; if (h < 0) h += 360;
      const km = Math.hypot(dx, dz) / 1000; this.atcApt = apt;
      this.atc('🗼 ATC', 'GROK Air 1, roger MAYDAY! Turn heading ' + String(Math.round(h / 5) * 5 % 360).padStart(3, '0') + '°, ' + apt.code + ' runway ' + apt.rwys[0].s + ' is ' + km.toFixed(km < 10 ? 1 : 0) + ' km away. Fire trucks rolling 🚒');
      this.atc('🗼 ATC', 'All other planes hold short — GROK Air 1 has priority. Good luck, Captain! 👍');
    } else this.atc('🗼 ATC', 'GROK Air 1, roger MAYDAY! Land anywhere flat. We\'re cheering for you! 📣');
  },
  atc(who, text) { this.atcQ.push([who, text]); if (this.atcQ.length > 6) this.atcQ.shift(); },
  // ------------------------------------------------------------------ per-step update (authoritative or mirrored)
  update(dt) {
    const G = SKY.Game, pl = this.pl(); if (!pl || !pl.dz) return;
    this.updateAtc(dt);
    if (G.state !== 'play') return;
    const P = SKY.Player;
    // random disasters (leader only, in the air)
    if (!this.mirrored && !this.riding() && RANDOM[this.mode] && !pl.crashed && P.mode !== 'ride') {
      if (!pl.onGround && pl.altitude() > 120) this.nextT -= dt;
      const cap = this.mode === 'chaos' ? 3 : 1;
      if (this.nextT <= 0) { this.rollNext(); if (this.list.length < cap) { const ok = ORDER.filter((id) => !this.why(id)); if (ok.length) { const id = ok[Math.floor(Math.random() * ok.length)]; SKY.toast('🎲 Random disaster!', 'warn'); this.trigger(id); } } }
    }
    const air = !pl.onGround && pl.altitude() > 25;
    if (air) this.wasAir = true;
    if (this.sess && air) this.sess.wasAir = true;
    if (this.sess && pl.onGround && this.wasAirPrev) this.sess.maxVy = Math.max(this.sess.maxVy, this.lastVy || 0);
    this.wasAirPrev = !pl.onGround; this.lastVy = -pl.vel.y;
    for (const e of this.list) {
      e.t += dt;
      for (const s of e.steps) {
        if (s.done) continue;
        if (s.kind === 'timed' && s.run && !this.mirrored) { s.prog = Math.min(1, s.prog + dt / s.dur); if (s.prog >= 1) { this.done(e, s); SKY.Audio.play('ok'); SKY.toast('✅ ' + s.label.replace(/^\S+\s/, '') + ' — done!', 'good'); } }
        if (s.kind === 'cond' && !this.mirrored) {
          if (s.k === 'desc' && SKY.toFeet(pl.pos.y) < 10000) this.done(e, s);
          if (s.k === 'dodge' && this.meteorT <= 0) { this.done(e, s); const ex = e.steps.find((q) => q.k === 'ext'); if (ex && !ex.done && !this.extFires.length) this.done(e, ex); if (e.hits > 0 && !e.steps.some((q) => q.k === 'land')) { e.steps.push({ k: 'land', label: '🛬 Land and get the dents checked', kind: 'cond', done: false, prog: 0 }); e.def = Object.assign({}, e.def, { land: true }); } }
          if (s.k === 'hold' && this.stormT <= 0) this.done(e, s);
        }
      }
      const mk = e.steps.find((q) => q.k === 'mask'); if (mk && !mk.done && !this.mirrored && SKY.Player.masked) this.done(e, mk);
      if (e.id === 'engfire') this.fireTick(e, dt);
    }
    // finished emergencies that don't need a landing
    if (!this.mirrored) for (const e of this.list.slice()) {
      const need = e.steps.filter((s) => !s.opt && s.k !== 'land');
      if (need.every((s) => s.done) && !e.steps.some((s) => s.k === 'land')) { e.clearT = (e.clearT || 0) + dt; if (e.clearT > 1.5) { this.list.splice(this.list.indexOf(e), 1); if (this.sess) this.sess.handled++; SKY.toast('✅ ' + e.def.name + ' handled! Nice flying 👍', 'good'); SKY.Audio.play('ok'); this.applyFlags(); this.renderList(true); } }
    }
    if (!this.mirrored && this.sess && !this.list.length && this.meteorT <= 0 && this.stormT <= 0) { this.sess = null; }
    // safe landing / safe stop
    if (!this.mirrored && this.list.length && pl.onGround && !pl.crashed && pl.speed() < 2.5 && !pl.follow) {
      const crit = this.list.every((e) => e.steps.every((s) => s.done || s.opt || s.k === 'land'));
      if (this.sess && (this.sess.wasAir || crit) && this.meteorT <= 0 && this.stormT <= 0) this.finishLanding();
    }
    if (!this.mirrored && pl.crashed && this.sess) { this.crashCartoon = true; this.list = []; this.sess = null; this.meteorT = 0; this.stormT = 0; this.applyFlags(); this.renderList(true); }
    // flameouts (lightning) relight by themselves
    if (pl.dz.flame && pl.dz.flame.length) { for (const f of pl.dz.flame) f.t -= dt; const before = pl.dz.flame.length; pl.dz.flame = pl.dz.flame.filter((f) => f.t > 0); if (pl.dz.flame.length !== before) { SKY.toast('🔄 Engine relit by itself — phew!', 'good'); this.applyFlags(); } }
    this.glitchT = Math.max(0, this.glitchT - dt);
    if (this.elecOut() && pl.ap.on && pl.ap.by === 'player' && !this.mirrored) { pl.ap.on = false; SKY.toast('⚠ AUTOPILOT needs power', 'warn'); }
    this.updateFx(dt);
    this.updateMeteors(dt);
    this.updateStorm(dt);
    document.body.classList.toggle('dz-elec', this.elecOut());
    document.body.classList.toggle('dz-on', this.list.length > 0);
  },
  fireTick(e, dt) {
    if (this.mirrored || e.steps[1].done) return;
    const pl = this.pl(); e.burn = (e.burn || 0) + dt;
    if (e.burn > 10 && e.dents < 6) { e.burn = 0; e.dents++; const p = this.engLocal(e.eng).add(_v.set(rand(-0.6, 0.6), rand(-0.2, 0.5), rand(-1, 1))); pl.damage(p, pl.small ? 0.35 : 0.55, 7, SKY.Game.fx, false); SKY.Audio.play('crunch', 0.5); if (e.dents === 2) SKY.toast('🔥 The fire is spreading — SHUT DOWN + EXTINGUISHER!', 'bad'); }
  },
  // ------------------------------------------------------------------ landing score
  finishLanding() {
    const pl = this.pl(), A = SKY.Airport, st = this.sess, G = SKY.Game;
    const apt = A && A.nearest(pl.pos.x, pl.pos.z, 400), rw = apt && A.onRunway(apt, pl.pos);
    const rows = []; let sc = 0; const add = (t, v) => { rows.push([t, v]); sc += v; };
    add(st.wasAir ? '🛬 Safe landing' : '🛑 Safe stop', st.wasAir ? 500 : 300);
    const n = st.names.size; add('🚨 Emergencies survived ×' + n, n * 150);
    add('✅ Checklist steps ×' + st.steps, st.steps * 50);
    if (st.mayday) add('📻 Called MAYDAY', 150);
    if (st.wasAir && rw) add('🎯 On a runway (' + apt.code + ')', 300);
    else if (st.wasAir) add('🌾 Off-airport landing', 50);
    if (st.wasAir) { const vy = st.maxVy; if (vy < 2.5) add('🪶 Butter-smooth touchdown', 250); else if (vy < 5) add('👍 Firm touchdown', 120); else add('🫨 Bouncy touchdown', 20); }
    if (this.list.some((e) => e.id === 'gear' && !e.steps[0].done)) add('🦭 Belly-landing hero', 300);
    add('✈ Plane in one piece (' + Math.round(pl.integrity * 100) + '%)', Math.round(pl.integrity * 200));
    const stars = sc >= 1800 ? 3 : sc >= 1100 ? 2 : 1;
    const best = sc > this.best; if (best) { this.best = sc; try { localStorage.setItem('grokSkyDzBest', String(sc)); } catch (e) { } }
    G.achieve('hero'); if (stars === 3) G.achieve('hero3');
    this.list = []; this.sess = null; this.applyFlags(); this.renderList(true);
    this.foamT = 3; this.lastScore = { sc, stars, rows, best, air: st.wasAir };
    this.atc('🗼 ATC', 'GROK Air 1, welcome down! Fire trucks are giving you a foam bath 🚒🫧');
    SKY.Audio.play('ok');
    this.showScore(this.lastScore);
    if (SKY.Net && SKY.Net.dzBroadcast) SKY.Net.dzBroadcast({ a: 'land', sc, stars, air: st.wasAir ? 1 : 0 });
  },
  showScore(r, who) {
    const el = $('dzScore'); if (!el) return;
    el.querySelector('h2').textContent = (who ? who + ': ' : '') + (r.air ? '🏅 SAFE LANDING!' : '🏅 SAFE STOP!');
    el.querySelector('.dzstars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    el.querySelector('.dzrows').innerHTML = (r.rows || []).map((q) => '<div><span>' + q[0] + '</span><b>+' + q[1] + '</b></div>').join('') + '<div class="tot"><span>SCORE</span><b>' + r.sc.toLocaleString() + '</b></div>' + (r.best ? '<div class="nb">🎉 NEW BEST!</div>' : '<div class="nb dim">Best: ' + this.best.toLocaleString() + '</div>');
    const G = SKY.Game; if (G.ui && G.ui !== 'dzscore') G.closeUI(); G.ui = 'dzscore'; G.unlockPointer(); el.classList.add('show');
  },
  // ------------------------------------------------------------------ visuals
  updateFx(dt) {
    const pl = this.pl(), fx = SKY.Game.fx; if (pl.crashed) return;
    const low = SKY.lowSpec, pv = pl.vel;
    for (const e of this.list) {
      if (e.id !== 'engfire' && e.id !== 'blowout') continue;
      const lp = this.engLocal(e.eng); lp.z += pl.small ? 0.6 : 1.4; const w = pl.toWorld(lp, _v);
      const burning = e.id === 'engfire' && !e.steps[1].done, big = burning && !e.steps[0].done;
      if (burning && Math.random() < (low ? 0.45 : 0.85)) fx.fire.spawn(w.x + rand(-0.4, 0.4), w.y + rand(-0.2, 0.4), w.z + rand(-0.4, 0.4), pv.x * 0.8 + rand(-1, 1), pv.y * 0.8 + rand(0.5, 2), pv.z * 0.8 + rand(-1, 1), rand(0.35, 0.8), rand(big ? 0.8 : 0.5, big ? 1.6 : 1.0), Math.random() < 0.5 ? 0xff7a1a : 0xffc23d);
      const smokeP = burning ? 0.5 : e.id === 'blowout' && !e.steps[0].done ? 0.45 : 0.18;
      if (Math.random() < smokeP * (low ? 0.5 : 1)) fx.smoke.spawn(w.x, w.y + 0.3, w.z, pv.x * 0.85 + rand(-1, 1), pv.y * 0.85 + rand(0.5, 2), pv.z * 0.85 + rand(-1, 1), rand(2.5, 5), burning ? 1.4 : 1.0, burning ? 0x2e2e2e : 0x6a6a6a);
      if (e.id === 'blowout' && !e.steps[0].done) { if (Math.random() < 0.25) fx.chip.spawn(w.x, w.y, w.z, pv.x * 0.9 + rand(-4, 4), pv.y * 0.9 + rand(0, 4), pv.z * 0.9 + rand(-4, 4), rand(0.4, 0.9), 0.18, Math.random() < 0.5 ? 0xffe066 : 0xffffff); if (Math.random() < dt * 3) SKY.Game.shake(0.15); }
    }
    // meteor fires on the skin
    for (const f of this.extFires) if (Math.random() < (low ? 0.3 : 0.6)) { const w = pl.toWorld(f, _v); fx.fire.spawn(w.x, w.y, w.z, pv.x * 0.8 + rand(-1, 1), pv.y * 0.8 + rand(0.5, 2), pv.z * 0.8 + rand(-1, 1), rand(0.3, 0.6), rand(0.5, 1), Math.random() < 0.5 ? 0xff7a1a : 0xffc23d); if (Math.random() < 0.4) fx.smoke.spawn(w.x, w.y + 0.3, w.z, pv.x * 0.85, pv.y * 0.85 + 1, pv.z * 0.85, rand(2, 4), 1, 0x333333); }
    // belly slide sparks (gear stuck up on the ground)
    if (pl.onGround && pl.dz.gearJam && pl.speed() > 5) for (let q = 0; q < (low ? 2 : 4); q++) { const w = pl.toWorld(_v2.set(rand(-1.2, 1.2), -2.5, rand(-8, 6)), _v); fx.chip.spawn(w.x, SKY.World.heightAt(w.x, w.z) + 0.2, w.z, pv.x * 0.5 + rand(-3, 3), rand(1, 4), pv.z * 0.5 + rand(-3, 3), rand(0.3, 0.7), 0.15, Math.random() < 0.5 ? 0xffe066 : 0xffa020); }
    // foam bath after a safe landing
    if (this.foamT > 0) { this.foamT -= dt; const { r } = pl.axes(); for (const sd of [-1, 1]) for (let q = 0; q < (low ? 2 : 4); q++) { const o = _v.copy(pl.pos).addScaledVector(r, sd * (pl.T.spanW * 0.7 + 6)); o.y = SKY.World.heightAt(o.x, o.z) + 2; fx.foam.spawn(o.x, o.y, o.z, -r.x * sd * rand(5, 9) + rand(-1, 1), rand(6, 10), -r.z * sd * rand(5, 9) + rand(-2, 2), rand(1.5, 2.5), rand(0.3, 0.6), 0xffffff); } }
  },
  sprayFx(e) {
    const pl = this.pl(), fx = SKY.Game.fx; const pts = e.id === 'meteor' ? this.extFires.slice() : [this.engLocal(e.eng)];
    for (const p of pts) { const w = pl.toWorld(p, _v); for (let q = 0; q < (SKY.lowSpec ? 10 : 22); q++) fx.foam.spawn(w.x + rand(-0.5, 0.5), w.y + rand(0, 0.5), w.z + rand(-0.5, 0.5), pl.vel.x * 0.9 + rand(-2, 2), pl.vel.y * 0.9 + rand(0, 3), pl.vel.z * 0.9 + rand(-2, 2), rand(0.5, 1), 0.3, 0xffffff); }
  },
  // ---- meteors
  meteorMesh() {
    let m = this.meteors.find((q) => !q.on); if (m) return m;
    if (this.meteors.length >= 10) return null;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshBasicMaterial({ color: 0x5a3a2a })); g.add(rock);
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(3.1, 0), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.55 })); g.add(glow);
    SKY.Game.scene.add(g); m = { mesh: g, on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), aimed: false }; this.meteors.push(m); return m;
  },
  updateMeteors(dt) {
    const pl = this.pl(), G = SKY.Game, fx = G.fx, W = SKY.World;
    if (this.meteorT > 0) {
      this.meteorT -= dt; this.meteorSpawn -= dt;
      if (this.meteorSpawn <= 0) {
        this.meteorSpawn = rand(0.6, 1.2);
        const m = this.meteorMesh();
        if (m) {
          const th = 3.2, aimed = Math.random() < 0.3;
          const tgt = _v.copy(pl.pos).addScaledVector(pl.vel, th);
          if (aimed) tgt.add(_v2.set(rand(-3, 3), rand(-1, 2), rand(-3, 3))); else tgt.add(_v2.set(rand(-160, 160), rand(-60, 30), rand(-160, 160)));
          m.p.copy(tgt).add(_v2.set(rand(-260, 260), rand(380, 520), rand(-260, 260)));
          m.v.copy(tgt).sub(m.p).divideScalar(th); m.on = true; m.aimed = aimed; m.mesh.visible = true; m.mesh.position.copy(m.p);
          SKY.Audio.play('whoop');
        }
      }
      if (this.meteorT <= 0) SKY.toast('☄️ The meteor shower is over!', 'good');
    }
    for (const m of this.meteors) {
      if (!m.on) continue;
      m.p.addScaledVector(m.v, dt); m.mesh.position.copy(m.p); m.mesh.rotation.x += dt * 3; m.mesh.rotation.y += dt * 2;
      if (Math.random() < (SKY.lowSpec ? 0.5 : 1)) fx.fire.spawn(m.p.x, m.p.y, m.p.z, m.v.x * 0.05 + rand(-1, 1), rand(0, 1), m.v.z * 0.05 + rand(-1, 1), rand(0.4, 0.8), rand(1.8, 3), Math.random() < 0.5 ? 0xff7a1a : 0xffd23d);
      if (Math.random() < 0.4) fx.smoke.spawn(m.p.x, m.p.y, m.p.z, 0, 1, 0, rand(2, 4), 2, 0x444444);
      const hitR = pl.T.spanW * 0.45 + 2.5;
      if (!pl.crashed && m.p.distanceTo(pl.pos) < hitR) { m.on = false; m.mesh.visible = false; this.meteorHit(m); continue; }
      const gh = W.heightAt(m.p.x, m.p.z);
      if (m.p.y < gh + 1 || m.p.y < -50) {
        m.on = false; m.mesh.visible = false;
        if (m.p.distanceTo(G.camPos) < 1500) { fx.burst(m.p.x, gh + 1, m.p.z, SKY.lowSpec ? 12 : 26, 0x8a6a4a, 10, 1.2); for (let q = 0; q < 6; q++) fx.smoke.spawn(m.p.x + rand(-3, 3), gh + 2, m.p.z + rand(-3, 3), rand(-2, 2), rand(2, 5), rand(-2, 2), rand(3, 6), 4, 0x6b5a4a); if (m.p.distanceTo(G.camPos) < 600) SKY.Audio.play('crunch', 0.7); }
      }
    }
  },
  meteorHit(m) {
    const pl = this.pl(), G = SKY.Game, fx = G.fx;
    const e = this.list.find((q) => q.id === 'meteor'); if (e) e.hits++;
    if (this.sess) this.sess.hits++;
    // a random spot on the skin, toward where it came from
    const pts = pl.samples; const s = pts[Math.floor(Math.random() * pts.length)]; const lp = s ? s.p.clone() : new THREE.Vector3(0, 1, 0);
    const w = pl.toWorld(lp);
    fx.burst(w.x, w.y, w.z, SKY.lowSpec ? 18 : 36, 0xffc23d, 12, 0.4, pl.vel.x * 0.9, pl.vel.y * 0.9, pl.vel.z * 0.9);
    SKY.Audio.play('boom'); G.shake(0.8); G.flash(14);
    if (!this.mirrored) {
      pl.damage(lp, pl.small ? 0.4 : 0.65, 9, fx, false);
      if (Math.random() < 0.35 && this.extFires.length < 4) { this.extFires.push(lp.clone()); const st = e && e.steps.find((q) => q.k === 'ext'); if (st && st.done) { st.done = false; this.renderList(true); } }
      pl.vel.addScaledVector(_v.set(rand(-1, 1), -1, rand(-1, 1)), 2.5); pl.w.x += rand(-0.08, 0.08); pl.w.z += rand(-0.15, 0.15);
    }
    SKY.toast('☄️ METEOR HIT! ' + (this.mirrored ? '' : 'Dent: plane ' + Math.round(pl.integrity * 100) + '%'), 'bad');
  },
  // ---- lightning
  boltMesh() {
    let b = this.bolts.find((q) => !q.on); if (b) return b;
    if (this.bolts.length >= 4) return null;
    const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xe8f4ff }); const mat2 = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.45 });
    const segs = []; for (let i = 0; i < 10; i++) { const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat2); g.add(a); g.add(c); segs.push([a, c]); }
    g.visible = false; SKY.Game.scene.add(g); b = { g, segs, on: false, t: 0 }; this.bolts.push(b); return b;
  },
  bolt(from, to, thick) {
    const b = this.boltMesh(); if (!b) return;
    b.on = true; b.t = 0.28; b.g.visible = true;
    const pts = [from.clone()]; for (let i = 1; i < 10; i++) { const p = from.clone().lerp(to, i / 10); const j = from.distanceTo(to) * 0.05; p.x += rand(-j, j); p.z += rand(-j, j); pts.push(p); } pts.push(to.clone());
    const up = new THREE.Vector3(0, 1, 0);
    b.segs.forEach(([a, c], i) => {
      const p0 = pts[i], p1 = pts[i + 1], d = _v.subVectors(p1, p0), len = d.length();
      for (const [m, k] of [[a, 1], [c, 3.2]]) { m.position.copy(p0).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(up, _v2.copy(d).normalize()); m.scale.set(thick * k, len, thick * k); }
    });
  },
  updateStorm(dt) {
    const pl = this.pl(), G = SKY.Game, fx = G.fx, W = SKY.World;
    for (const b of this.bolts) if (b.on) { b.t -= dt; if (b.t <= 0) { b.on = false; b.g.visible = false; } }
    this.flashT = Math.max(0, (this.flashT || 0) - dt);
    if (this.stormT <= 0) return;
    this.stormT -= dt; this.boltT -= dt; this.hitT -= dt;
    const c = G.camPos;
    if (this.boltT <= 0) { // bolts all around
      this.boltT = rand(0.5, 1.1);
      const x = c.x + rand(-900, 900), z = c.z + rand(-900, 900), gy = W.heightAt(x, z);
      this.bolt(_v.set(x + rand(-60, 60), Math.max(c.y, pl.pos.y) + rand(350, 600), z + rand(-60, 60)).clone(), new THREE.Vector3(x, gy, z), 2.2);
      this.flashT = 0.12; if (Math.random() < 0.4) this.wflash(0.35); const d = Math.hypot(x - c.x, z - c.z); setTimeout(() => SKY.Audio.play('boom'), Math.min(1500, d * 1.2));
    }
    if (this.hitT <= 0 && !pl.crashed) { // ZAP — you can't dodge these
      this.hitT = rand(3.5, 5.5);
      const lp = pl.samples.length ? pl.samples[Math.floor(Math.random() * pl.samples.length)].p.clone() : new THREE.Vector3();
      const w = pl.toWorld(lp);
      this.bolt(w.clone().add(new THREE.Vector3(rand(-40, 40), 420, rand(-40, 40))), w.clone(), 1.4);
      this.bolt(w.clone(), w.clone().add(new THREE.Vector3(rand(-30, 30), -380, rand(-30, 30))), 1.0);
      this.flashT = 0.25; this.wflash(0.85); this.zaps = (this.zaps || 0) + 1; G.shake(0.7); SKY.Audio.play('boom'); SKY.Audio.play('clang');
      fx.burst(w.x, w.y, w.z, SKY.lowSpec ? 16 : 34, 0xcfe8ff, 9, 0.3, pl.vel.x * 0.9, pl.vel.y * 0.9, pl.vel.z * 0.9);
      if (!this.mirrored) {
        const r = Math.random(), e = this.list.find((q) => q.id === 'storm');
        if (r < 0.4) { this.glitchT = 4; SKY.toast('⚡ ZAP! Instruments glitched', 'bad'); }
        else if (r < 0.7 && pl.dz) { const eng = this.engines(); const q = eng[Math.floor(Math.random() * eng.length)]; pl.dz.flame = (pl.dz.flame || []).filter((f) => f.i !== q.i); pl.dz.flame.push({ i: q.i, t: 7 }); this.applyFlags(); SKY.toast('⚡ ZAP! ' + (eng.length > 1 ? 'Engine ' + q.n : 'The engine') + ' flamed out — reset systems or wait', 'bad'); }
        else { pl.damage(lp, 0.35, 5, fx, false); SKY.toast('⚡ ZAP! Scorch mark on the skin', 'bad'); }
        if (e) { const st = e.steps.find((q) => q.k === 'reset'); if (st && st.done && (this.glitchT > 0 || (pl.dz.flame || []).length)) { st.done = false; this.renderList(true); } }
      } else SKY.toast('⚡ ZAP!', 'bad');
    }
    if (this.stormT <= 0) SKY.toast('🌤 The storm passed!', 'good');
  },
  // sky tint during the storm / meteor shower (called after the normal altitude tint)
  sky(scene) {
    const k = this.stormT > 0 ? clamp(this.stormT / 3, 0, 1) * clamp((26 - this.stormT) / 2, 0, 1) : 0, km = this.meteorT > 0 ? clamp(this.meteorT / 3, 0, 1) * clamp((28 - this.meteorT) / 2, 0, 1) * 0.5 : 0;
    const bg = scene.background;
    if (k > 0) { const f = (this.flashT || 0) > 0 ? 1 : 0; bg.lerp(_c.setRGB(0.16, 0.16, 0.24), k * 0.85); if (f) bg.setRGB(0.85, 0.9, 1); scene.fog.color.copy(bg); }
    if (km > 0) { bg.lerp(_c.setRGB(0.42, 0.22, 0.18), km); scene.fog.color.copy(bg); }
  },
  wflash(o) { const f = $('flash'); if (!f) return; f.style.background = 'rgba(235,245,255,.95)'; f.style.opacity = o || 0.8; clearTimeout(this._wf); this._wf = setTimeout(() => { f.style.opacity = 0; setTimeout(() => { f.style.background = ''; }, 300); }, 90); },
  // ------------------------------------------------------------------ HUD
  alerts() {
    const out = [];
    for (const e of this.list) { const todo = e.steps.some((s) => !s.done && !s.opt && s.k !== 'land'); out.push(e.def.alert + (e.engName ? ' ' + e.engName.replace('ENGINE ', '#') : '') + (todo ? '' : ' ✔')); }
    if (this.pl().dz && this.pl().dz.flame && this.pl().dz.flame.length) out.push('⚡ ENGINE FLAMEOUT');
    return out.slice(0, 3);
  },
  alarm() { return !this.silenced && (this.list.some((e) => e.steps.some((s) => !s.done && !s.opt && s.k !== 'land')) || this.meteorT > 0 || this.stormT > 0); },
  hud() {
    const el = $('dzcl'); if (!el) return;
    const G = SKY.Game, show = this.list.length > 0 && G.state === 'play';
    el.style.display = show ? 'block' : 'none';
    if (!show) return;
    const al = $('alerts'); if (al) { const b = al.getBoundingClientRect(); el.style.top = Math.round(Math.max(b.bottom, 40) + 4) + 'px'; }
    this.renderList();
    // progress bars + live labels
    for (const e of this.list) for (const s of e.steps) {
      const bar = el.querySelector('[data-u="' + e.uid + '"][data-k="' + s.k + '"] i'); if (bar) bar.style.width = Math.round(s.prog * 100) + '%';
    }
    const ft = el.querySelector('.dzalt'); if (ft) ft.textContent = Math.round(SKY.toFeet(this.pl().pos.y) / 100) * 100 + ' ft';
  },
  renderList(force) {
    const el = $('dzcl'); if (!el) return;
    const sig = this.list.map((e) => e.uid + ':' + e.steps.map((s) => (s.done ? 1 : 0) + (s.run ? 'r' : '')).join('')).join('|') + (this.silenced ? 's' : '') + (this.mirrored ? 'm' : '') + (this.expand ? 'x' : '');
    if (!force && sig === this.sig) return; if (sig === this.sig && force !== true) return; this.sig = sig;
    let h = '<div class="dzhead"><b>🚨 CHECKLIST</b>' + (this.mirrored ? '<small>pilot\'s plane</small>' : '') + '<span><button data-a="exp">' + (this.expand ? '▴' : '☰') + '</button><button data-a="mute">' + (this.silenced ? '🔕' : '🔔') + '</button></span></div>';
    for (const e of this.list) {
      const next = e.steps.find((s) => !s.done && !s.opt && s.k !== 'land'), nd = e.steps.filter((s) => s.done).length;
      h += '<div class="dzc"><div class="dzt">' + e.def.icon + ' ' + e.def.name + (e.engName ? ' · ' + e.engName.replace('ENGINE ', 'ENG ') : '') + ' <small>' + nd + '/' + e.steps.length + '</small></div><div class="dzs">';
      for (const s of e.steps) {
        const show = this.expand || s === next || (!next && s.k === 'land' && !s.done) || (s.k === 'mayday' && !s.done);
        if (!show) continue;
        const cls = s.done ? 'done' : s === next ? 'next' : s.kind === 'cond' ? 'cond' : '';
        const lab = s.label + (s.k === 'desc' && !s.done ? ' <em class="dzalt"></em>' : '');
        if (s.done) h += '<span class="dzb done">✔ ' + s.label.replace(/^\S+\s/, '') + '</span>';
        else if (s.kind === 'cond') h += '<span class="dzb cond ' + cls + '">' + lab + '</span>';
        else h += '<button class="dzb ' + cls + (s.k === 'mayday' ? ' may' : '') + '" data-u="' + e.uid + '" data-k="' + s.k + '">' + (s.k === 'mayday' && !this.expand ? '📻 MAYDAY' : lab) + (s.kind === 'timed' || s.kind === 'crank' ? '<i></i>' : '') + '</button>';
      }
      h += '</div></div>';
    }
    el.innerHTML = h;
  },
  // ------------------------------------------------------------------ panel
  buildUI() {
    if ($('dzPanel')) return;
    const p = document.createElement('div'); p.id = 'dzPanel'; p.className = 'panel';
    p.innerHTML = '<div class="pp-head"><h2>🚨 Disasters</h2><button id="dz-x">✕</button></div><p class="fine">Tap one to make it happen right now. Then follow the 🚨 checklist, call MAYDAY and land safely for a score! (Cartoon only — nobody gets hurt.)</p><div id="dz-grid"></div><h3>🎲 Random disasters</h3><div id="dz-mode"></div><div class="row"><button id="dz-clear">🧰 Fix everything</button></div><p class="fine" id="dz-best"></p>';
    document.body.appendChild(p);
    const cl = document.createElement('div'); cl.id = 'dzcl'; document.body.appendChild(cl);
    const atc = document.createElement('div'); atc.id = 'atc'; document.body.appendChild(atc);
    const sc = document.createElement('div'); sc.id = 'dzScore'; sc.className = 'panel'; sc.innerHTML = '<h2>🏅 SAFE LANDING!</h2><div class="dzstars"></div><div class="dzrows"></div><button id="dz-ok" class="go">👍 Nice!</button>'; document.body.appendChild(sc);
    const btn = document.createElement('button'); btn.id = 'dzbtn'; btn.innerHTML = '🚨<small>DISASTERS [K]</small>'; document.body.appendChild(btn);
    btn.addEventListener('click', (e) => { e.stopPropagation(); this.togglePanel(); });
    $('dz-x').onclick = () => this.closePanel();
    $('dz-ok').onclick = () => { sc.classList.remove('show'); const G = SKY.Game; if (G.ui === 'dzscore') G.closeUI(); };
    $('dz-clear').onclick = () => { if (this.mirrored) { if (SKY.Net) SKY.Net.dzSend({ a: 'clear' }); } else this.clearAll(true); this.closePanel(); };
    $('dz-grid').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b || b.classList.contains('off')) { if (b) SKY.toast('🚫 ' + b.dataset.why, 'warn'); return; } this.closePanel(); this.trigger(b.dataset.id); });
    $('dz-mode').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) this.setMode(b.dataset.m); });
    const tap = (e) => {
      const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); SKY.Audio.init();
      if (b.dataset.a === 'mute') { this.silenced = !this.silenced; this.renderList(true); return; }
      if (b.dataset.a === 'exp') { this.expand = !this.expand; this.renderList(true); return; }
      if (b.dataset.k) this.tap(+b.dataset.u, b.dataset.k);
    };
    cl.addEventListener('pointerdown', tap);
    cl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  },
  renderPanel() {
    const g = $('dz-grid'); if (!g) return;
    g.innerHTML = ORDER.map((id) => { const d = DEFS[id], w = this.mirrored ? null : this.why(id); return '<button data-id="' + id + '" class="dzp' + (w ? ' off' : '') + (d.fantasy ? ' fan' : '') + '" data-why="' + (w || '') + '"><span>' + d.icon + '</span><b>' + d.name + '</b><small>' + (w || d.desc) + '</small></button>'; }).join('');
    $('dz-mode').innerHTML = this.mirrored ? '<p class="fine">The pilot picks this in their plane.</p>' : Object.keys(RANDOM).map((m) => '<button data-m="' + m + '" class="' + (m === this.mode ? 'sel' : '') + '">' + { off: '🚫 Off', rare: '🙂 Rare', normal: '😬 Normal', chaos: '🤪 CHAOS' }[m] + '</button>').join('');
    $('dz-best').textContent = this.best ? '🏅 Best safe-landing score: ' + this.best.toLocaleString() : '';
  },
  togglePanel() { if ($('dzPanel').classList.contains('show')) this.closePanel(); else this.openPanel(); },
  openPanel() {
    const G = SKY.Game; if (G.state !== 'play') return; if (G.ui && G.ui !== 'dz') G.closeUI();
    this.renderPanel(); G.ui = 'dz'; G.unlockPointer(); $('dzPanel').classList.add('show');
  },
  closePanel() { $('dzPanel').classList.remove('show'); const G = SKY.Game; if (G.ui === 'dz') G.closeUI(); },
  clearAll(say) {
    this.list = []; this.sess = null; this.meteorT = 0; this.stormT = 0; this.extFires = []; this.glitchT = 0;
    const pl = this.pl(); if (pl.dz) { this.resetPlane(pl); pl.gearDown = pl.gearDown || pl.onGround; }
    this.applyFlags(); this.renderList(true);
    if (say) { SKY.toast('🧰 The GROK Air fairy mechanics fixed everything ✨', 'good'); SKY.Audio.play('ok'); }
  },
  // ------------------------------------------------------------------ ATC bubble
  updateAtc(dt) {
    const el = $('atc'); if (!el) return;
    this.atcT -= dt;
    if (this.atcT <= 0) {
      if (this.atcQ.length) { const [who, text] = this.atcQ.shift(); el.innerHTML = '<b>📻 ' + who + '</b> ' + text; el.classList.add('show'); el.classList.toggle('me', /YOU/.test(who)); this.atcT = 4.2; SKY.Audio.play('beep'); this.atcLog = (this.atcLog || []).concat([who + ': ' + text]).slice(-10); }
      else el.classList.remove('show');
    }
  },
  // ------------------------------------------------------------------ co-op
  netState() {
    if (this.mirrored || !this.list.length && this.meteorT <= 0 && this.stormT <= 0) return null;
    return { e: this.list.map((e) => [e.id, e.eng == null ? -1 : e.eng, e.steps.reduce((m, s, i) => m | (s.done ? 1 << i : 0), 0), e.steps.map((s) => Math.round(s.prog * 100)).join('.'), e.steps.length]), m: this.meteorT > 0 ? 1 : 0, l: this.stormT > 0 ? 1 : 0, ma: this.sess && this.sess.mayday ? 1 : 0 };
  },
  mirror(dz) { // rider: copy the leader's emergencies
    const pl = this.pl();
    if (!dz) { if (this.mirrored) { this.list = []; this.mirrored = false; this.sess = null; this.meteorT = 0; this.stormT = 0; if (pl.dz) this.resetPlane(pl); this.renderList(true); } return; }
    if (!this.mirrored) { this.list = []; this.sess = null; }
    this.mirrored = true;
    const keep = [];
    for (const q of dz.e || []) {
      const [id, eng, mask, prog, n] = q; if (!DEFS[id]) continue;
      let e = this.list.find((x) => x.id === id && (x.eng == null ? -1 : x.eng) === eng);
      if (!e) e = this.trigger(id, { mirror: true, eng: eng < 0 ? null : eng }); if (!e) continue;
      while (e.steps.length < n) e.steps.push({ k: 'land', label: '🛬 Land and get the dents checked', kind: 'cond', done: false, prog: 0 });
      const pr = String(prog || '').split('.');
      e.steps.forEach((s, i) => { s.done = !!(mask & (1 << i)); s.prog = (+pr[i] || 0) / 100; });
      keep.push(e);
    }
    this.list = keep;
    if (dz.m && this.meteorT <= 0) this.meteorT = 20; if (!dz.m) this.meteorT = 0;
    if (dz.l && this.stormT <= 0) { this.stormT = 20; this.hitT = 2.5; } if (!dz.l) this.stormT = 0;
    if (dz.ma && this.sess && !this.sess.mayday) { this.sess.mayday = true; this.atcCall(); }
    if (pl.dz) { pl.dz.pack = this.has('depress'); if (pl.dz.pack && !pl.masksDown) { pl.masksDown = true; pl.maskT = 0; SKY.Audio.play('chime'); } }
    this.renderList();
  },
  onNet(d) { // leader: a rider asked for something
    const nm = String(d.n || 'Your co-pilot').slice(0, 14);
    if (d.a === 'land') { if (this.mirrored || this.riding()) this.showScore({ sc: d.sc, stars: d.stars, rows: [], air: !!d.air }, nm); else SKY.toast('🏅 ' + nm + ' made a safe emergency landing: ' + d.sc + ' pts ' + '★'.repeat(d.stars), 'good'); return; }
    if (this.riding()) return;
    if (d.a === 'go' && DEFS[d.id]) this.trigger(d.id, { by: nm });
    else if (d.a === 'step') { const e = this.list.find((q) => q.id === d.id && (q.eng == null ? -1 : q.eng) === (d.eng == null ? -1 : d.eng)); if (e) this.tap(e.uid, d.k, nm); }
    else if (d.a === 'clear') { this.clearAll(false); SKY.toast('🧰 ' + nm + ' called the fairy mechanics — all fixed ✨', 'good'); }
  },
  // other players' separate planes: smoke / fire trail when they are in trouble
  remoteFx(obj, s) {
    if (!s.dz || !obj || !obj.visible) return; const fx = SKY.Game.fx;
    const fire = (s.dz.e || []).some((q) => q[0] === 'engfire' || q[0] === 'blowout');
    if (fire && Math.random() < 0.5) { const p = obj.position, v = s.pv || [0, 0, 0]; fx.smoke.spawn(p.x + rand(-2, 2), p.y, p.z + rand(-2, 2), v[0] * 0.85, v[1] * 0.85 + 1, v[2] * 0.85, rand(2.5, 4.5), 1.6, 0x333333); if (Math.random() < 0.5) fx.fire.spawn(p.x, p.y, p.z, v[0] * 0.8, v[1] * 0.8 + 1, v[2] * 0.8, 0.5, 1.2, 0xff7a1a); }
  },
};
})();

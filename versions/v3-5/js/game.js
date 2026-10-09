'use strict';
// GROK SKY - main: renderer, loop, camera, HUD, menus, game events, fast travel, test hooks
(() => {
const { clamp, rand, choose } = SKY;
const I = SKY.Input;
const $ = (id) => document.getElementById(id);
const ACH = {
  takeoff: ['🛫', 'Wheels Up', 'Take off'], land: ['🛬', 'Greaser', 'Land on a runway'], chef: ['⭐', 'Top Chef', 'Cook a PERFECT meal'], spoiled: ['🤢', 'Food Poisoning (Cartoon)', 'Serve a spoiled meal'],
  code: ['🔑', 'Detective', 'Find the cockpit code'], breach: ['🚪', 'Door Buster', 'Get into the cockpit'], door: ['🌬', 'Fresh Air', 'Open a door mid-flight'], masks: ['😷', 'Breathe Normally', 'Wear a mask during decompression'],
  saucer: ['👽', 'They\'re Real', 'Wake the Area 51 saucer'], gate: ['🅿', 'On Blocks', 'Dock at an airport gate'], terminal: ['🏢', 'Frequent Flyer', 'Walk into an airport terminal'], pushback: ['🚜', 'Pushback', 'Push back from a gate'], tourist: ['📸', 'Tourist', 'Visit 5 famous landmarks'], firefighter: ['🧯', 'Firefighter', 'Put out a fire'], crash: ['💥', 'Insurance Claim', 'Crash the plane'], globe: ['🌍', 'Globetrotter', 'Visit all 6 cities'],
  enter: ['🚪', 'Come On In', 'Walk into a place in a city'], explorer: ['🧭', 'City Explorer', 'Enter a place in all 7 zones'], jackpot: ['🎰', 'JACKPOT!', 'Hit 7-7-7 on a slot machine'],
  arcade: ['👾', 'Arcade Legend', 'Score 500+ on GROK INVADERS'], foodie: ['🌮', 'Foodie', 'Eat in 3 different cities'], souvenir: ['🎁', 'Souvenir Hunter', 'Buy a souvenir'],
  deck: ['🏙', 'Top of the World', 'Ride an elevator to an observation deck'], monalisa: ['😉', 'She Winked', 'Gaze at the Mona Lisa'], xfiles: ['👽', 'The Truth Is In There', 'Get into the Area 51 lab'],
  summit: ['🔺', 'Summit', 'Climb the Pyramid of the Sun'],
  autoland: ['🤖', 'Hands Free', 'Complete an AUTO LAND'], sprinter: ['🏃', 'Sprinter', 'Run for 4 seconds'], rental: ['🔑', 'Road Trip', 'Rent a car at an airport'],
  joyride: ['🔓', 'Joyride', 'Steal a car (cartoon crime!)'], busted: ['🚔', 'Busted!', 'Get caught by the police'], getaway: ['😎', 'Getaway Driver', 'Lose the police'],
  patient: ['🩺', 'First Patient', 'Treat a patient at an airport clinic'], doctor: ['👩‍⚕️', 'Doctor of the Skies', 'Treat 10 patients'],
  taxigate: ['🚕', 'Follow Me', 'Park at a gate with TAXI TO GATE (3.5.1)'], jailbird: ['🔒', 'Jailbird', 'Get thrown in GROK JAIL'],
  greatescape: ['🥄', 'The Great Escape', 'Dig out of GROK JAIL with a spoon'], modelinmate: ['😇', 'Model Inmate', 'Wait out your GROK JAIL time'],
  together: ['🌐', 'Better Together', 'Play online with a friend'], formation: ['🛩', 'Formation Flight', 'Fly within 300 m of your online partner']
};
const G = SKY.Game = {
  state: 'title', settings: { invert: false, muted: false }, ach: {}, stats: null, camPos: new THREE.Vector3(), camOrbit: { yaw: 0, pitch: 0, t: 0 }, shakeAmt: 0, testMode: false,
  startCity: 'LA', startMode: 'pilot', ui: null, hudT: 0, time: 0,
  init() {
    const low = SKY.lowSpec;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2)); r.setSize(innerWidth, innerHeight);
    $('game').appendChild(r.domElement);
    const sc = this.scene = new THREE.Scene(); sc.background = new THREE.Color(0x9fd4ff); sc.fog = new THREE.Fog(0x9fd4ff, low ? 1200 : 2000, low ? 11000 : 17000);
    this.camera = new THREE.PerspectiveCamera(low ? 75 : 70, innerWidth / innerHeight, 0.08, low ? 16000 : 24000); sc.add(this.camera);
    sc.add(new THREE.HemisphereLight(0xe6f2ff, 0x6a6050, 0.62));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.7); sun.position.set(0.5, 1, 0.35); sc.add(sun);
    const amb = new THREE.AmbientLight(0xffffff, 0.06); sc.add(amb);
    SKY.World.build(sc);
    this.fx = new SKY.FXSet(sc);
    this.plane = new SKY.Plane(sc);
    SKY.Crowd.init(this.plane, sc); SKY.Props.init(this.plane, sc);
    SKY.Player.init(this.plane, sc, this.fx, this.camera);
    I.bindCanvas(r.domElement); I.bindTouch(); if (I.bindAutoLand) I.bindAutoLand(); if (I.bindTaxiGate) I.bindTaxiGate(); if (SKY.Jail) SKY.Jail.bindUI();
    const ce = $('carexit'); if (ce) ce.addEventListener('click', (e) => { e.stopPropagation(); if (SKY.Cars && SKY.Cars.cur) SKY.Cars.exit(); });
    addEventListener('resize', () => this.resize()); this.resize();
    this.buildUI();
    if (SKY.Net) SKY.Net.init(); // 3.6 online multiplayer (lobby, ?mp= URL params)
    if (SKY.isTouch) document.body.classList.add('touchdev');
    // idle title scene: plane parked at LA
    this.plane.reset({ city: SKY.World.city('LA'), mode: 'cruise' }); SKY.Crowd.populate(0, true);
    this.titleT = 0;
    let last = performance.now(), acc = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      let dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (!this.testMode) {
        acc += dt; let n = 0;
        while (acc >= SKY.DT && n < (low ? 3 : 4)) { this.update(SKY.DT); if (n === 0) I.clearEdges(); acc -= SKY.DT; n++; }
        if (n >= (low ? 3 : 4)) acc = 0;
      }
      if (this.noRender) { if (SKY.Net) SKY.Net.frame(dt); } else this.render(dt); // noRender: headless multi-device tests (sim + net only)
    };
    requestAnimationFrame(frame);
  },
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.W = w; this.H = h; },
  // -------------------------------------------------------------- game start / reset
  start(cityId, mode) {
    this.startCity = cityId || this.startCity; this.startMode = mode || this.startMode;
    const city = SKY.World.city(this.startCity);
    const pl = this.plane;
    for (const d of SKY.World.debris) d.dispose(); SKY.World.debris = [];
    if (SKY.Places) SKY.Places.reset();
    if (SKY.Cars) SKY.Cars.reset(); if (SKY.AutoLand) SKY.AutoLand.reset(); if (SKY.TaxiGate) SKY.TaxiGate.reset();
    this.fx.clear();
    if (SKY.Airport) SKY.Airport.reset();
    SKY.World.ensureCity(city);
    pl.reset({ city, mode: this.startMode === 'pilot' ? 'runway' : 'cruise' });
    SKY.Crowd.populate(SKY.lowSpec ? 14 : 26, this.startMode !== 'pilot');
    SKY.Props.populate();
    SKY.Player.reset(this.startMode);
    if (this.startMode !== 'pilot') { pl.ap.on = true; pl.ap.by = 'pilots'; pl.ap.alt = 1900; pl.ap.mode = 'cruise'; pl.ap.dest = this.nextCity(city); }
    else { pl.ap.dest = this.nextCity(city); }
    if (SKY.Net) SKY.Net.onStart(city, this.startMode); // 3.6: room meta + spread partners' planes out
    this.stats = { injuries: 0, hits: 0, ko: 0, time: 0, cities: new Set([city.id]), ejected: 0, spoiled: 0, start: city.name, seen: new Set() };
    this.wasAirborne = this.startMode !== 'pilot'; this.overT = -1; this.crashShown = false; this.bashes = 0; this.pilotsDownT = 0; this.apDisc = -1;
    this.camOrbit.yaw = 0; this.camOrbit.pitch = 0; this.camInit = false;
    if (SKY.Jail) SKY.Jail.reset();
    this.state = 'play'; this.hideScreens(); this.closeUI();
    document.body.classList.add('playing');
    SKY.Audio.init();
    SKY.toast(this.startMode === 'pilot' ? '🧑‍✈️ ' + city.name + (city.apt ? ' (' + city.apt.code + ' runway ' + city.apt.rwys[0].s + ')' : '') + ' — throttle up (Shift / slider), pull back (S / stick down) at ~130 kts' : '💺 Cruising out of ' + city.name + '. Explore the cabin!', 'good');
    if (!SKY.isTouch && !this.testMode) this.lockPointer();
  },
  nextCity(c) { const order = ['LA', 'LAS', 'MEX', 'NYC', 'PAR', 'TYO']; const i = order.indexOf(c.id); return SKY.World.city(order[(i + 1) % order.length] || 'LAS'); },
  fastTravel(id, mode) {
    const city = SKY.World.city(id); const pl = this.plane; const P = SKY.Player;
    const A = SKY.Airport;
    if (this.state === 'over' || pl.crashed || pl.integrity < 0.5 || P.dead) { this.startMode = 'pilot'; this.start(id, 'pilot'); if (mode === 'approach') { pl.place(city, 'approach'); this.wasAirborne = true; } else if (mode === 'gate' && A) A.placeAtGate(city); this.closeMap(); return; }
    if (A) A.reset();
    if (SKY.AutoLand) SKY.AutoLand.reset(); if (SKY.TaxiGate) SKY.TaxiGate.reset();
    if (SKY.Cars && SKY.Cars.cur) { SKY.Cars.cur = null; P.mode = 'foot'; }
    SKY.World.ensureCity(city);
    SKY.Crowd.list = SKY.Crowd.list.filter((p) => p.frame === 'plane');
    SKY.Props.list = SKY.Props.list.filter((p) => { if (p.frame === 'world') { this.scene.remove(p.mesh); return false; } return true; });
    let gate = null;
    if (mode === 'gate' && A && city.apt) gate = A.placeAtGate(city); else pl.place(city, mode === 'gate' ? 'runway' : mode);
    if (P.frame === 'world') { P.board(); }
    if (P.mode !== 'pilot' && !SKY.Crowd.pilots().length) P.sitPilot(pl.seats.find((s) => s.captain && !s.occupant) || pl.seats.find((s) => s.cockpit && !s.occupant) || pl.seats[0]);
    if (mode === 'approach' && P.mode !== 'pilot') { pl.ap.on = true; pl.ap.by = 'pilots'; pl.ap.alt = 600; pl.ap.dest = city; pl.ap.mode = 'cruise'; }
    if (mode === 'runway') { pl.ap.mode = 'takeoff'; pl.ap.rwyX = city.ax; pl.ap.hdg = 0; pl.ap.on = P.mode !== 'pilot'; pl.ap.dest = this.nextCity(city); pl.ap.alt = 1900; }
    if (mode === 'gate') { pl.ap.on = false; pl.ap.mode = 'hold'; pl.ap.dest = this.nextCity(city); }
    this.wasAirborne = mode === 'approach'; this.camInit = false;
    this.stats.cities.add(city.id);
    const code = city.apt ? city.apt.code : '';
    SKY.toast('✈ Fast travel: ' + city.name + ' ' + code + (mode === 'approach' ? ' — on final for runway ' + city.apt.rwys[0].s + ', gear down. Line up & land!' : mode === 'gate' ? ' — parked at gate ' + (gate ? gate.name : '') + ', jet bridge connected. Leave your seat and walk into the terminal!' : ' — lined up on runway ' + city.apt.rwys[0].s), 'good');
    this.closeMap();
  },
  // -------------------------------------------------------------- per-step update
  update(dt) {
    I.updateMove();
    if (I.edge('mute')) { this.settings.muted = !this.settings.muted; SKY.Audio.mute(this.settings.muted); }
    if (this.state === 'title') { this.titleUpdate(dt); return; }
    if (this.state !== 'play') { if (I.edge('pause') && this.state === 'paused') this.resume(); if (I.edge('map') && this.ui === 'map') this.closeMap(); return; }
    if (I.edge('pause')) { if (this.ui) this.closeUI(); else { this.pause(); return; } }
    if (I.edge('map')) { this.openMap(); return; }
    if (I.edge('addPax')) SKY.Crowd.addPassenger();
    if (I.edge('help')) $('help').classList.toggle('show');
    this.time += dt; this.stats.time += dt;
    const pl = this.plane, P = SKY.Player, Crowd = SKY.Crowd;
    // player (UI open → freeze player input)
    if (this.ui) { I.move.x = 0; I.move.y = 0; I.look.dx = 0; I.look.dy = 0; I.edges = {}; I.holds.action = false; }
    const PLc = SKY.Places; // place transitions / telescopes freeze walking
    if (PLc && PLc.preUpdate(dt, I)) { I.move.x = 0; I.move.y = 0; I.edges = {}; I.holds.action = false; I.holds.jump = false; if (!PLc.scope) { I.look.dx = 0; I.look.dy = 0; } }
    const Cars = SKY.Cars, AL = SKY.AutoLand; // 3.5: car break-in bar / busted screen freeze input too
    if (Cars && Cars.preUpdate(dt, I)) { I.move.x = 0; I.move.y = 0; I.edges = {}; I.holds.action = false; I.holds.jump = false; I.holds.gas = false; I.holds.brake = false; }
    P.update(dt, I);
    if (AL) AL.update(dt, I);
    const TG = SKY.TaxiGate; if (TG) TG.update(dt, I); // 3.5.1 taxi to gate
    if (SKY.Mini) SKY.Mini.update(dt);
    if (SKY.Jail) SKY.Jail.update(dt); // 3.5.1 GROK JAIL timer / minigame (runs while its panel freezes the player)
    // plane control source
    const pilots = Crowd.pilots();
    const playerFlying = P.mode === 'pilot' && P.frame === 'plane';
    let ctl;
    if (playerFlying && P.ctl) ctl = P.ctl;
    else if (pl.ap.on && (playerFlying || pl.ap.by === 'player' || pilots.length || this.apDisc > 0)) ctl = pl.autopilot(dt);
    else if (pilots.length && !playerFlying) { pl.ap.on = true; pl.ap.by = 'pilots'; if (!pl.ap.dest) pl.ap.dest = this.nextCity(SKY.World.nearestCity(pl.pos.x, pl.pos.z).city); if (pl.ap.mode === 'off') pl.ap.mode = pl.onGround ? 'hold' : 'cruise'; if (pl.ap.mode === 'takeoff') { pl.ap.rwyX = pl.pos.x; pl.ap.hdg = pl.heading() * Math.PI / 180; } ctl = pl.autopilot(dt); }
    else { pl.ap.on = false; ctl = { pitch: -0.04 + Math.sin(this.time * 0.13) * 0.05, roll: Math.sin(this.time * 0.07) * 0.12, yaw: 0 }; }
    if (!pilots.length && pl.ap.by === 'pilots' && !playerFlying && pl.ap.on) { if (this.apDisc < 0) this.apDisc = 15; this.apDisc -= dt; if (this.apDisc <= 0) { pl.ap.on = false; this.apDisc = -1; SKY.toast('⚠ AUTOPILOT DISCONNECT — nobody is flying!', 'bad'); SKY.Audio.play('error'); } }
    else if (pilots.length) this.apDisc = -1;
    if (AL && AL.active) { if (playerFlying) ctl = AL.control(dt); else AL.cancel('silent'); }
    if (TG && TG.active) { ctl = TG.control(dt); pl.ap.on = false; } // keeps taxiing even if the captain gets up for a stretch
    if (pl.crashed) { ctl = { pitch: 0, roll: 0, yaw: 0 }; pl.throttle = 0; }
    pl.update(dt, ctl, this.fx);
    if (AL && AL.active) AL.post(dt);
    if (SKY.Airport) SKY.Airport.update(dt);
    if (TG && TG.active) TG.post(dt);
    pl.updateCabin(dt, this.fx);
    if (pl.lastDetach) for (const reg of pl.lastDetach) this.transferRegion(reg);
    // entities
    const ctx = { camPos: this.camPos, wanderers: 0, playerLocal: P.frame === 'plane' && P.mode === 'foot' ? P.pos : null, playerInSeat: (s) => P.seat === s, playerBody: (wp, ww) => this.renderPlayerBody(wp, ww) };
    Crowd.update(dt, ctx);
    SKY.Props.update(dt);
    pl.updateMasks(Crowd.list, dt);
    SKY.World.update(dt, this.camPos, P.frame === 'world' ? P.pos : pl.pos);
    if (SKY.Places) SKY.Places.update(dt, this.camPos);
    if (SKY.Ambient) SKY.Ambient.update(dt, this.camPos);
    if (Cars) Cars.update(dt);
    this.fx.update(dt, new THREE.Vector3(0, -SKY.GRAV, 0), (x, y, z) => SKY.World.heightAt(x, z) + 0.05);
    this.events(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);
  },
  transferRegion(reg) {
    const P = SKY.Player, pl = this.plane; const inR = (p) => p.x > reg.min.x - 0.3 && p.x < reg.max.x + 0.3 && p.y > reg.min.y - 0.3 && p.y < reg.max.y + 0.5 && p.z > reg.min.z - 0.3 && p.z < reg.max.z + 0.3;
    if (reg.size < 40) return;
    if (P.frame === 'plane' && inR(P.pos.clone().setY(P.pos.y + 0.5))) { P.leaveSeat(); P.mode = 'foot'; P.toWorld(); }
    for (const p of SKY.Crowd.list) if (p.frame === 'plane' && inR(p.pts[2].p)) SKY.Crowd.toWorld(p);
    for (const pr of SKY.Props.list) if (pr.frame === 'plane' && !pr.held && inR(pr.pos)) SKY.Props.toWorld(pr);
  },
  events(dt) {
    const pl = this.plane, P = SKY.Player, W = SKY.World;
    const alt = pl.altitude();
    if (!pl.onGround && alt > 50 && !this.wasAirborne) { this.wasAirborne = true; this.achieve('takeoff'); }
    if (pl.onGround && this.wasAirborne && !pl.crashed && pl.speed() < 70 && pl.gearDown && !pl.gearBroken) {
      this.wasAirborne = false; const nc = W.nearestCity(pl.pos.x, pl.pos.z).city;
      const A = SKY.Airport, apt = A && A.nearest(pl.pos.x, pl.pos.z, 400), rw = apt && A.onRunway(apt, pl.pos);
      if (rw) { A.landedAt = apt; const g = A.freeGate(apt); SKY.toast('🛬 Touchdown at ' + apt.code + ' runway ' + (pl.heading() > 90 && pl.heading() < 270 ? rw.n : rw.s) + ', ' + nc.name + '! Taxi to gate ' + (g ? g.name : '') + ' (follow the yellow line) — or ' + (SKY.isTouch ? 'tap TAXI TO GATE' : 'press G (TAXI TO GATE)') + ' once slow', 'good'); this.achieve('land'); this.stats.cities.add(nc.id); }
      else if (Math.abs(pl.pos.x - nc.ax) < 45 && Math.abs(pl.pos.z - nc.az) < nc.rwyLen / 2 + 150) { SKY.toast('🛬 Touchdown at ' + nc.name + '! Nice landing!', 'good'); this.achieve('land'); this.stats.cities.add(nc.id); }
      else SKY.toast('Landed... somewhere that is not a runway. Bold!', 'warn');
    }
    const ref = P.frame === 'world' ? P.pos : pl.pos;
    const nc = W.nearestCity(ref.x, ref.z);
    if (nc.dist < 5000 && !this.stats.cities.has(nc.city.id)) { this.stats.cities.add(nc.city.id); SKY.toast('📍 Welcome to ' + nc.city.name + '!', 'good'); }
    if (['LA', 'LAS', 'MEX', 'NYC', 'PAR', 'TYO'].every((c) => this.stats.cities.has(c))) this.achieve('globe');
    if (pl.decomp && P.masked) this.achieve('masks');
    // landmark sightseeing (on foot nearby, or flying low past it)
    this.lmT = (this.lmT || 0) - dt;
    if (this.lmT <= 0) {
      this.lmT = 0.5; const low = P.frame === 'world' ? 1 : (pl.altitude() < 350 ? 1 : 0);
      if (low) for (const l of W.landmarks) { if (this.stats.seen.has(l.name)) continue; const d = Math.hypot(l.x - ref.x, l.z - ref.z); if (d < (P.frame === 'world' ? 160 : 260) + (l.rr || 0)) { this.stats.seen.add(l.name); SKY.toast('📸 ' + l.name + ' (' + l.city.name + ')', ''); if (this.stats.seen.size >= 5) this.achieve('tourist'); } }
    }
    // crash → game over screen (can keep exploring)
    if (pl.crashed) { pl.crashT += dt; if (pl.crashT > 4 && !this.crashShown && !P.dead) { this.crashShown = true; this.gameOver('crash'); } }
    if (P.dead && this.overT < 0) this.overT = 1.8;
    if (this.overT > 0) { this.overT -= dt; if (this.overT <= 0) this.gameOver(P.dead); }
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
  },
  // -------------------------------------------------------------- camera
  updateCamera(dt) {
    const cam = this.camera, pl = this.plane, P = SKY.Player;
    const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
    if (this.camOverride) { const o = this.camOverride; cam.position.set(o[0], o[1], o[2]); cam.up.set(0, 1, 0); cam.lookAt(o[3], o[4], o[5]); this.camPos.copy(cam.position); return; } // test/photo hook
    if (P.mode === 'drive' && SKY.Cars && SKY.Cars.cur) { SKY.Cars.camera(cam, dt, this.camOrbit); }
    else if (P.dead && P.frame === 'world') { const t = this.time * 0.2; cam.position.set(P.pos.x + Math.cos(t) * 12, P.pos.y + 6, P.pos.z + Math.sin(t) * 12); cam.lookAt(P.pos); }
    else if (P.mode === 'pilot' && P.pilotCam === 'chase' && P.frame === 'plane') {
      const O = this.camOrbit; if (O.t > 0) O.t -= dt; else { O.yaw *= 1 - 2 * dt; O.pitch *= 1 - 2 * dt; }
      const f = pl.axes().f; const hdg = Math.atan2(-f.x, -f.z);
      const yaw = hdg + O.yaw, pitch = 0.18 + O.pitch;
      const dist = 30;
      const target = pl.pos.clone().add(new THREE.Vector3(0, 3, 0));
      const want = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist).add(target);
      const gh = SKY.World.heightAt(want.x, want.z) + 2; if (want.y < gh) want.y = gh;
      if (!this.camInit) { this.chasePos = want.clone(); this.camInit = true; }
      // keep the camera locked relative to plane motion, smooth only the angular offset
      this.chasePos.add(pl.vel.clone().multiplyScalar(dt)); this.chasePos.lerp(want, Math.min(1, 6 * dt));
      cam.position.copy(this.chasePos); cam.up.set(0, 1, 0); cam.lookAt(target);
    } else if (P.frame === 'plane') {
      const eye = P.eye.clone();
      e.set(P.pitch, P.yaw, 0); q.setFromEuler(e);
      if (P.camMode === 'tp' && P.mode !== 'pilot') {
        const back = P.dir.clone().negate(); let d = 0; const p = new THREE.Vector3();
        for (d = 0.2; d < 3.0; d += 0.1) { p.copy(eye).addScaledVector(back, d).y += d * 0.15; if (pl.solidLocal(p.x, p.y, p.z)) { d -= 0.25; break; } }
        eye.addScaledVector(back, Math.max(0.1, d)).y += Math.max(0.1, d) * 0.15;
      }
      cam.position.copy(pl.toWorld(eye)); cam.quaternion.copy(pl.quat).multiply(q);
    } else {
      const eye = P.eye.clone(); e.set(P.pitch, P.yaw, 0); cam.quaternion.setFromEuler(e);
      const PLs = SKY.Places, scope = PLs && PLs.scope;
      if (scope) eye.set(scope.x, scope.y, scope.z);
      else if ((P.camMode === 'tp' || P.chute) && PLs && PLs.cur) { // indoors / on a deck: pull the camera in so it never clips through walls
        const back = P.dir.clone().negate(); const p = new THREE.Vector3(); let d;
        for (d = 0.3; d < 4; d += 0.2) { p.copy(eye).addScaledVector(back, d); p.y += d * 0.25; if (P.solid(p.x, p.y, p.z)) { d -= 0.35; break; } }
        d = Math.max(0.15, d); eye.addScaledVector(back, d).y += d * 0.25;
      } else if (P.camMode === 'tp' || P.chute) { const back = P.dir.clone().negate(); eye.addScaledVector(back, 4).y += 1; const gh = SKY.World.heightAt(eye.x, eye.z) + 0.3; if (eye.y < gh) eye.y = gh; }
      cam.position.copy(eye);
    }
    if (this.shakeAmt > 0) { const s = this.shakeAmt * (P.mode === 'pilot' && P.pilotCam === 'chase' ? 2 : 0.25); cam.position.x += rand(-s, s); cam.position.y += rand(-s, s); cam.position.z += rand(-s, s); }
    if (P.woozy > 0) { cam.rotateZ(Math.sin(this.time * 1.7) * 0.06); }
    const sc = SKY.Places && SKY.Places.scope; const fov = sc && P.frame === 'world' ? sc.fov : (SKY.lowSpec ? 75 : 70);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    this.camPos.copy(cam.position);
  },
  shake(a) { this.shakeAmt = Math.min(1.5, Math.max(this.shakeAmt, a)); },
  flash(n) { const f = $('flash'); f.style.opacity = Math.min(0.6, n / 30 + 0.15); clearTimeout(this._fl); this._fl = setTimeout(() => { f.style.opacity = 0; }, 120); },
  renderPlayerBody(wp, ww) {
    const P = SKY.Player; const showTP = P.camMode === 'tp' || (P.mode === 'pilot' && P.pilotCam === 'chase');
    if (!showTP || P.dead || P.mode === 'drive') return;
    const b = P.body; b.frame = P.frame; b.pos.copy(P.pos); b.yaw = P.yaw;
    b.state = P.mode === 'seat' || P.mode === 'pilot' ? 'sit' : (P.frame === 'world' && P.chute ? 'para' : (Math.hypot(P.vel.x, P.vel.z) > 0.5 ? 'walk' : 'idle'));
    b.masked = P.masked; b.woozy = P.woozy; b.carry = !!P.held; b.panic = 0;
    if (b.state === 'sit' && P.seat) b.pos.set(P.seat.x, 0, P.seat.z);
    b.pose(SKY.DT); b.render(P.frame === 'plane' ? wp : ww);
  },
  // -------------------------------------------------------------- audio
  updateAudio(dt) {
    const pl = this.plane, P = SKY.Player; const A = SKY.Audio; if (!A.ready) return;
    const inside = P.frame === 'plane' && !(P.mode === 'pilot' && P.pilotCam === 'chase');
    const dist = this.camPos.distanceTo(pl.pos);
    const car = SKY.Cars && SKY.Cars.cur;
    if (car) A.setEngine(clamp(Math.abs(car.speed) / car.T.vmax, 0, 1) * 0.7 + 0.1, true, true);
    else A.setEngine(pl.throttle * ((pl.engEff[0] + pl.engEff[1]) / 2), !pl.crashed && dist < 3000, inside);
    if (A.setSiren) A.setSiren(SKY.Cars ? SKY.Cars.sirenLvl : 0);
    const spd = pl.speed();
    let wind = 0;
    if (P.frame === 'world' && !P.grounded) wind = clamp(P.vel.length() / 60, 0, 1);
    else if (inside) wind = clamp(pl.leakArea * 0.4, 0, 1) * clamp(spd / 100, 0.2, 1) + (pl.dP > 0.01 ? 0.6 : 0);
    else if (P.mode === 'pilot') wind = clamp(spd / 260, 0, 0.45);
    A.setWind(wind);
    const pilotsDown = !SKY.Crowd.pilots().length && P.mode !== 'pilot' && !pl.ap.on && !pl.onGround;
    A.setAlarm((pl.decomp && pl.dP > 0.002) || pl.stall || (pl.fires.some((f) => !f.ext)) || (P.mode === 'pilot' && pl.altitude() < 150 && pl.vel.y < -12 && !pl.crashed) || (pilotsDown && !pl.crashed) || (P.o2 < 30 && P.frame === 'plane'));
    A.tick(dt);
  },
  // -------------------------------------------------------------- events from systems
  achieve(id) {
    if (this.ach[id]) return; this.ach[id] = true; const a = ACH[id]; if (!a) return;
    SKY.toast('🏆 ' + a[0] + ' ' + a[1] + ' — ' + a[2], 'ach'); SKY.Audio.play('ok');
    try { localStorage.setItem('grokSkyAch', JSON.stringify(this.ach)); } catch (e) { }
  },
  onCrash(kind, spd) { this.achieve('crash'); this.shake(1.5); SKY.toast(kind === 'ditched' ? '🌊 DITCHED IN THE WATER!' : kind === 'building' ? '🏢 CRASHED INTO A BUILDING!' : '💥 CRASH! (' + Math.round(spd * 1.94) + ' kts)', 'bad'); },
  onDecompression() { SKY.toast('⚠ CABIN DECOMPRESSION — oxygen masks deployed! Put one on (INTERACT near a mask)', 'bad'); SKY.Audio.play('woosh'); this.shake(0.6); },
  onTurbulence(str) { this.plane.belt = true; setTimeout(() => { if (this.plane) this.plane.belt = false; }, 14000); SKY.Audio.play('chime'); SKY.toast('🔔 Turbulence ahead — fasten your seatbelts!', 'warn'); },
  onKO(p) { if (this.stats) this.stats.ko++; },
  onPilotDown(p) { const left = SKY.Crowd.pilots(); SKY.toast(left.length ? '⚠ ' + p.name + ' is out! ' + left[0].name + ' takes over.' : '⚠ BOTH PILOTS INCAPACITATED — someone has to fly this thing!', 'bad'); },
  onEjected(p) { if (this.stats) this.stats.ejected++; if (p.role !== 'player') SKY.toast('😱 ' + p.name + ' got sucked out! (Don\'t worry: GROK Air seats come with parachutes 🪂)', 'warn'); },
  onPlayerExit() { },
  onPlayerDown(cause) { SKY.Audio.play('boom'); },
  onDoorBash(cd) {
    this.bashes++;
    const pil = SKY.Crowd.list.filter((p) => (p.role === 'captain' || p.role === 'fo') && p.conscious && p.frame === 'plane');
    if (this.bashes % 4 === 1 && pil.length) choose(pil).talk(choose(['Go away! This door is reinforced!', 'Security! SECURITY!', 'I\'m calling ground control!', 'Knock it off out there!', 'Nice try, buddy.']), 2.5);
    if (this.bashes % 12 === 0 && pil.length && !this.plane.onGround) { this.plane.turb.on = 3; this.plane.turb.str = 1.1; this.plane.turb.t = 3; pil[0].talk('Hold on to something, troublemaker!', 2.5); }
    if (this.bashes % 6 === 3) { const crew = SKY.Crowd.list.find((p) => p.role === 'crew' && p.conscious && p.frame === 'plane'); if (crew) crew.talk('Sir, step AWAY from the cockpit door!', 2.5); }
    if (cd.hp > 0 && this.bashes % 5 === 0) SKY.toast('Cockpit door: ' + Math.max(0, Math.round(cd.hp)) + '% — keep going (crowbar works best) or find the code');
  },
  propHit(pr, sp) {
    for (const p of SKY.Crowd.list) { if ((p.frame === 'plane') !== (pr.frame === 'plane')) continue; if (p.pts[0].p.distanceTo(pr.pos) < 0.5 || p.pts[2].p.distanceTo(pr.pos) < 0.5) { p.hurt(sp * pr.mass * 1.2); if (p.conscious && sp > 8) p.knock(pr.vel.clone().multiplyScalar(0.3)); } }
    const P = SKY.Player; if (P.frame === pr.frame && P.pos.clone().setY(P.pos.y + 1).distanceTo(pr.pos) < 0.6 && !pr.held && sp > 6) P.hurt(sp * pr.mass * 0.8, 'impact');
  },
  debrisImpact(db, imp) {
    if (db.grid.count > 6 && this.camPos.distanceTo(db.group.position) < 400) SKY.Audio.play('crunch', Math.min(1, imp / 25));
    const P = SKY.Player; if (P.frame === 'world' && P.pos.distanceTo(db.group.position) < db.radius + 1) P.hurt(imp * 3, 'debris');
    for (const p of SKY.Crowd.list) if (p.frame === 'world' && p.pts[2].p.distanceTo(db.group.position) < db.radius) p.hurt(imp * 3);
  },
  feed(p, meal) {
    SKY.Audio.play('eat');
    if (meal.spoiled) { p.woozy = (p.role === 'captain' || p.role === 'fo') ? 45 : 30; p.talk('🤢 ...this tastes funny', 3); this.achieve('spoiled'); if (this.stats) this.stats.spoiled++; }
    else { p.hp = Math.min(100, Math.max(p.hp, 0) + meal.heal); if (p.ko && meal.heal >= 15 && p.o2 > 30) { p.ko = false; p.hp = Math.max(p.hp, 30); } p.woozy = 0; p.talk(meal.q === 'PERFECT' ? '😋 Delicious! 5 stars!' : meal.q === 'Burnt' ? '*cough* ...crunchy.' : 'Thanks, that hits the spot!', 3); }
    if (p.state === 'sit') { p.state = 'eat'; p.eatT = 3; }
    SKY.toast(p.name + ' ate the ' + meal.q + ' ' + meal.name + (meal.spoiled ? ' 🤢' : ' 😋'));
  },
  // -------------------------------------------------------------- render
  render(dt) {
    const pl = this.plane, P = SKY.Player;
    if (this.state === 'title') { this.titleCam(dt); }
    // sky tint with altitude
    const a = clamp(this.camPos.y / 2600, 0, 1);
    this.scene.background.setRGB(0.62 - a * 0.25, 0.83 - a * 0.18, 1.0 - a * 0.05); this.scene.fog.color.copy(this.scene.background);
    // labels
    SKY.Labels.begin();
    if (this.state === 'play' || this.state === 'over') {
      const tmp = new THREE.Vector3();
      const cand = [];
      for (const p of SKY.Crowd.list) {
        tmp.copy(p.pts[0].p); if (p.frame === 'plane') pl.toWorld(tmp, tmp);
        const d = tmp.distanceTo(this.camPos); if (d > 16 || (p.hp >= 100 && !p.say && p.woozy <= 0)) continue;
        cand.push([d, tmp.clone().add(new THREE.Vector3(0, 0.35, 0).applyQuaternion(p.frame === 'plane' ? pl.quat : new THREE.Quaternion())), p]);
      }
      cand.sort((x, y) => x[0] - y[0]);
      for (const c of cand.slice(0, 10)) SKY.Labels.add(c[1], this.camera, this.W, this.H, c[2].hp < 100 || c[2].ko ? c[2].hp : null, c[2].say || (c[2].woozy > 0 ? '🤢' : ''), c[2].ko ? '#888' : '#222');
      if (SKY.Places) SKY.Places.labels(this.camera, (pos, txt) => SKY.Labels.add(pos, this.camera, this.W, this.H, null, txt, '#222'));
    }
    SKY.Labels.end();
    if (SKY.Net) SKY.Net.frame(dt); // 3.6: partners' planes / avatars / cars / name tags (before the cars are drawn)
    if (SKY.Cars && (this.state === 'play' || this.state === 'over' || this.state === 'paused')) SKY.Cars.render(this.camPos);
    this.renderer.render(this.scene, this.camera);
    this.hudT -= dt; if (this.hudT <= 0 && this.state !== 'title') { this.hudT = 0.1; this.updateHUD(); }
  },
  // -------------------------------------------------------------- title scene
  titleUpdate(dt) {
    const pl = this.plane; this.titleT += dt;
    pl.ap.on = true; pl.ap.alt = 1900; pl.ap.dest = null; pl.ap.hdg = 0; pl.ap.mode = 'cruise';
    pl.update(dt, pl.autopilot(dt), this.fx); pl.updateCabin(dt, this.fx);
    SKY.World.update(dt, this.camPos); this.fx.update(dt, new THREE.Vector3(0, -9.8, 0), (x, y, z) => 0);
    if (pl.pos.z < -30000 || pl.crashed) pl.reset({ city: SKY.World.city('LA'), mode: 'cruise' });
  },
  titleCam() {
    const pl = this.plane, t = this.titleT * 0.15; const cam = this.camera;
    cam.position.set(pl.pos.x + Math.cos(t) * 40, pl.pos.y + 8 + Math.sin(t * 0.7) * 6, pl.pos.z + Math.sin(t) * 40); cam.up.set(0, 1, 0); cam.lookAt(pl.pos); this.camPos.copy(cam.position);
  },
  // -------------------------------------------------------------- HUD
  updateHUD() {
    const pl = this.plane, P = SKY.Player; if (!this.stats) return;
    const ft = SKY.toFeet(pl.pos.y - SKY.World.heightAt(pl.pos.x, pl.pos.z) - 3.6), kts = pl.speed() * 1.944, vs = pl.vel.y * 3.28 * SKY.ALT_SCALE * 60;
    const nc = SKY.World.nearestCity((P.frame === 'world' ? P.pos : pl.pos).x, (P.frame === 'world' ? P.pos : pl.pos).z);
    const apH = SKY.Airport && SKY.Airport.nearest((P.frame === 'world' ? P.pos : pl.pos).x, (P.frame === 'world' ? P.pos : pl.pos).z, 1500);
    $('h-city').textContent = (nc.dist < 6500 ? '📍 ' + nc.city.name + (apH ? ' · ✈ ' + apH.code : '') : '🌐 ' + (nc.dist / 1000).toFixed(1) + ' km from ' + nc.city.name);
    const modeTxt = P.mode === 'drive' && SKY.Cars && SKY.Cars.cur ? '🚗 DRIVING ' + SKY.Cars.cur.T.name : P.frame === 'world' ? (P.chute ? '🪂 PARACHUTING' : P.grounded ? (P.running ? '🏃 RUNNING' : '🚶 ON FOOT (ground)') : '😱 FALLING') : P.mode === 'pilot' ? '🧑‍✈️ PILOT' : P.mode === 'seat' ? '💺 SEATED' : '🚶 ON FOOT (cabin)';
    const PLh = SKY.Places, inside = PLh && PLh.cur;
    $('h-mode').textContent = inside ? (inside.kind === 'deck' ? '🏙 ' : '🏠 INSIDE: ') + inside.place.name + ' · 🪙 ' + PLh.coins() : modeTxt + (P.frame === 'world' && PLh ? ' · 🪙 ' + PLh.coins() : '');
    $('i-alt').textContent = Math.max(0, Math.round(ft / 10) * 10).toLocaleString() + ' ft';
    $('i-spd').textContent = Math.round(kts) + ' kts';
    $('i-vs').textContent = (vs >= 0 ? '+' : '') + Math.round(vs / 50) * 50 + ' fpm';
    $('i-hdg').textContent = String(Math.round(pl.heading())).padStart(3, '0') + '°';
    $('i-thr').style.height = Math.round(pl.throttle * 100) + '%'; $('i-thrv').textContent = Math.round(pl.throttle * 100) + '%';
    $('i-flags').innerHTML = `<b class="${pl.gearDown && !pl.gearBroken ? 'on' : pl.gearBroken ? 'bad' : ''}">GEAR</b><b class="${pl.flaps ? 'on' : ''}">FLAP ${pl.flaps}</b><b class="${pl.ap.on ? 'on' : ''}">AP</b><b class="${pl.brake || (pl.onGround && pl.throttle < 0.04) ? 'on' : ''}">BRK</b>`;
    if (SKY.Input.thrKnob) SKY.Input.thrKnob.style.bottom = 'calc(' + Math.round(pl.throttle * 100) + '% - 14px)';
    const integ = Math.round((pl.integrity || 1) * 100);
    $('v-hp').style.width = P.hp + '%'; $('v-hpt').textContent = Math.round(P.hp);
    $('v-o2').style.width = P.o2 + '%'; $('v-o2t').textContent = Math.round(P.o2) + (P.masked ? ' 😷' : '');
    $('v-cab').style.width = Math.round(pl.pressure * 100) + '%'; $('v-cabt').textContent = Math.round(pl.pressure * 100) + '%';
    $('v-int').style.width = integ + '%'; $('v-intt').textContent = integ + '%';
    // toolbar
    const tb = SKY.TOOLS.map((t, i) => `<span class="${i === P.tool && !P.held ? 'sel' : ''}">${i + 1} ${t.icon} ${t.name}</span>`).join('');
    $('toolbar').innerHTML = tb + (P.held ? `<span class="sel">✋ ${P.held.person ? P.held.person.name : P.held.meal ? 'Meal: ' + P.held.meal.emoji + ' ' + P.held.meal.q : P.held.kind}</span>` : '') + (pl.codeFound ? `<span class="code">🔑 ${pl.code}</span>` : '');
    // prompt
    const pr = $('prompt');
    if (P.target && P.mode !== 'pilot' && !this.ui && !(SKY.Places && (SKY.Places.scope || SKY.Places.trans))) { pr.textContent = (SKY.isTouch ? '👆 ' : '[F] ') + P.target.label; pr.style.display = 'block'; pr.classList.toggle('enter', /^(🚪|🛗|🍽|🪂|🚗|🔓|🩺)/u.test(P.target.label)); }
    else if (P.mode === 'pilot') { pr.textContent = SKY.isTouch ? 'USE (hand) = leave seat' : '[F] leave seat  [V] camera  [T] autopilot  [G] gear (taxi to gate on the ground)  [Z] flaps  [B] brake'; pr.style.display = this.time % 20 < 6 ? 'block' : 'none'; }
    else pr.style.display = 'none';
    // alerts
    const al = [];
    if (pl.crashed) al.push('💥 CRASHED');
    if (pl.decomp) al.push('⚠ CABIN DECOMPRESSION');
    if (pl.stall) al.push('⚠ STALL');
    if (!pl.crashed && P.mode === 'pilot' && pl.altitude() < 200 && pl.vel.y < -12) al.push('⚠ PULL UP');
    if (pl.fires.some((f) => !f.ext)) al.push('🔥 CABIN FIRE');
    if (!SKY.Crowd.pilots().length && P.mode !== 'pilot' && !pl.ap.on && !pl.onGround && !pl.crashed) al.push('⚠ NOBODY IS FLYING');
    if (P.o2 < 35 && !P.dead) al.push('😵 HYPOXIA — FIND A MASK OR DESCEND');
    if (pl.turb.on > 0) al.push('🔔 TURBULENCE');
    if (pl.oven.state === 'cooking') al.push('🍳 Oven ' + pl.oven.t.toFixed(1) + 's ' + (pl.oven.t < 7 ? '(cooking...)' : pl.oven.t <= 10.5 ? '(PERFECT — take it out!)' : '(BURNING!)'));
    if (P.frame === 'world' && !P.grounded && !P.chute && P.altAboveGround() > 25) al.push('🪂 PRESS JUMP FOR PARACHUTE');
    $('alerts').innerHTML = al.map((a) => `<div>${a}</div>`).join('');
    $('vignette').style.opacity = P.o2 < 50 ? (1 - P.o2 / 50) * 0.85 : 0;
    $('woozy').style.opacity = P.woozy > 0 ? 0.25 : 0;
    document.body.classList.toggle('pilot', P.mode === 'pilot');
    // 3.5: auto-land button / banner, cars HUD, run button state, stamina
    document.body.classList.toggle('foot', P.mode === 'foot' && !P.dead);
    document.body.classList.toggle('worldf', P.frame === 'world' && P.mode !== 'pilot'); // on the ground / driving: hide plane-only HUD
    document.body.classList.toggle('running', !!P.running || !!I.runOn);
    const rb = $('trun'); if (rb) { rb.classList.toggle('active', !!I.runOn); rb.classList.toggle('going', !!P.running); }
    const stb = $('stamina'); if (stb) { const show = P.mode === 'foot' && P.stam != null && P.stam < 99; stb.style.display = show ? 'block' : 'none'; if (show) { stb.firstElementChild.style.width = Math.round(P.stam) + '%'; stb.classList.toggle('low', !!P.winded); } }
    const alb = $('albtn'); const alh = SKY.AutoLand && SKY.AutoLand.hud();
    if (alb) { if (alh && this.state === 'play') { alb.style.display = 'block'; alb.className = alh.mode; alb.innerHTML = alh.mode === 'active' ? alh.text + '<small>' + (SKY.isTouch ? 'move the stick to take over' : 'any flight key takes over') + '</small>' : alh.text + '<small>' + (SKY.isTouch ? 'TAP to engage' : 'press [L] or click') + '</small>'; } else alb.style.display = 'none'; }
    const tgb = $('tgbtn'); const tgh = SKY.TaxiGate && this.state === 'play' && !(alh) && SKY.TaxiGate.hud(); // 3.5.1 TAXI TO GATE (shares the auto-land slot; never shown together)
    if (tgb) { if (tgh) { tgb.style.display = 'block'; tgb.className = tgh.mode; const sub = tgh.mode === 'active' ? tgh.sub + ' · ' + (SKY.isTouch ? 'tap / stick = stop' : '[G] / any key = stop') : tgh.mode === 'done' ? tgh.sub : tgh.sub + ' · ' + (SKY.isTouch ? 'TAP to taxi' : 'press [G] or click'); const html = tgh.title + '<small>' + sub + '</small>'; if (tgb._h !== html) { tgb.innerHTML = html; tgb._h = html; } } else tgb.style.display = 'none'; }
    if (SKY.Cars) SKY.Cars.hud();
    // hint/objective
    $('h-obj').textContent = this.objectiveHint();
    this.drawMinimap();
  },
  objectiveHint() {
    const pl = this.plane, P = SKY.Player;
    const ch = SKY.Cars && SKY.Cars.hint(); if (ch && !(SKY.Places && SKY.Places.cur)) return ch;
    if (SKY.AutoLand && SKY.AutoLand.active) return SKY.AutoLand.hud().text;
    if (SKY.TaxiGate && SKY.TaxiGate.active) return SKY.TaxiGate.hud().text + ' · follow the green arrows';
    const ph = SKY.Places && SKY.Places.hintText(); if (ph) return ph;
    const A = SKY.Airport;
    if (A) {
      const D = A.dock;
      if (D && P.mode === 'pilot') return D.phase === 'docked' ? '🅿 Docked at ' + D.apt.code + ' gate ' + D.gate.name + ' — leave the seat (Space/F), walk out the front L1 door & down the jet bridge into the terminal · throttle up (or T) = pushback' : '🚜 Pushback in progress…';
      if (D && P.frame === 'plane' && P.mode !== 'pilot') return '🅿 At ' + D.apt.code + ' gate ' + D.gate.name + ' — exit through the open front-left (L1) door onto the jet bridge · sit in a seat and the crew will fly you to the next city';
      if (P.frame === 'world' && A.inTerm) return '🏢 ' + A.inTerm.code + ' terminal — check the departures board, café & check-in · walk back down the jet bridge to reboard your plane';
      if (P.frame === 'world' && D) return '🛂 Your plane is at ' + D.apt.code + ' gate ' + D.gate.name + ' — walk through the jet bridge to the terminal, or back to the L1 door to reboard';
      if (A.guide && P.mode === 'pilot') return '🚕 ' + A.guide.txt + (A.taxi ? '' : ' · stop on the yellow stop bar to dock · ' + (SKY.isTouch ? 'TAXI TO GATE button' : 'G = taxi to gate'));
    }
    if (P.mode === 'pilot' && pl.onGround && pl.speed() < 5) return 'Throttle up to take off · ' + (SKY.isTouch ? 'TAXI TO GATE button' : 'G = taxi to gate') + ' · T on the ground = auto-taxi · Space: leave seat when stopped';
    if (P.mode === 'pilot') return pl.ap.dest ? 'Fly anywhere — or open the MAP to fast-travel to a runway approach' : 'Fly anywhere · MAP for fast travel';
    if (!this.ach.code && !this.ach.breach) return 'Rumor: the cockpit code is hidden in the cabin (galley drawer? lavatory? the lead attendant?)';
    if (!this.ach.chef) return 'Try the galley oven at the back — cook 7-10 s for a PERFECT meal';
    if (!this.ach.breach) return 'Use the keypad on the cockpit door (code: ' + (pl.codeFound ? pl.code : '????') + ')';
    return 'Sandbox! Open doors, smash stuff, fly to Area 51...';
  },
  drawMinimap() {
    const cv = $('minimap'); const x = cv.getContext('2d'); const S = cv.width; const W = SKY.World, pl = this.plane, P = SKY.Player;
    const ref = (SKY.Places && SKY.Places.mapRef()) || (P.frame === 'world' ? P.pos : pl.pos); const hdg = P.frame === 'world' ? -P.yaw : pl.heading() * Math.PI / 180;
    // zoom into the local city map when low / on foot near a city
    let local = null; for (const c of W.cities) if (c.mapCv && W.zoneDist(c, ref.x, ref.z) < 4500) local = c;
    const lowish = P.frame === 'world' || pl.altitude() < 1500;
    const range = local && lowish ? (P.frame === 'world' ? 700 : (pl.onGround ? 1100 : 2600)) : 26000, sc = S / 2 / range;
    x.save(); x.clearRect(0, 0, S, S); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, 6.29); x.clip();
    x.fillStyle = '#2f74b5'; x.fillRect(0, 0, S, S);
    x.translate(S / 2, S / 2); x.rotate(-hdg);
    const mb = W.mapBounds; const mc = W.mapCanvas;
    x.drawImage(mc, (mb.x0 - ref.x) * sc, (mb.z0 - ref.z) * sc, mb.w * sc, mb.h * sc);
    if (range < 5000) {
      const lb = local.mapB; x.drawImage(local.mapCv, (lb.x0 - ref.x) * sc, (lb.z0 - ref.z) * sc, lb.size * sc, lb.size * sc);
      const A = SKY.Airport, apt = local.apt;
      const lbl = (wx, wz, t, col, f) => { x.save(); x.translate((wx - ref.x) * sc, (wz - ref.z) * sc); x.rotate(hdg); x.font = f || 'bold 10px sans-serif'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.7)'; x.strokeText(t, 3, -3); x.fillStyle = col || '#fff'; x.fillText(t, 3, -3); x.restore(); };
      if (apt) {
        for (const g of apt.gates) { x.fillStyle = A && A.dock && A.dock.gate === g ? '#57ff7a' : g.ai ? '#ff9800' : '#ffeb3b'; x.fillRect((g.stop.x - ref.x) * sc - 2, (g.gz - ref.z) * sc - 2, 4, 4); if (range < 1500) lbl(g.stop.x, g.gz, g.name, '#ffeb3b', 'bold 9px sans-serif'); }
        lbl(apt.XF + apt.side * 20, apt.az - apt.L / 2 - 30, '✈ ' + apt.code, '#ffeb3b', 'bold 12px sans-serif');
        const gd = A && A.guide; if (gd && gd.route) { x.strokeStyle = '#57ff7a'; x.lineWidth = 2; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(0, 0); for (const q of gd.route.pts.slice(gd.route.i || 0)) x.lineTo((q[0] - ref.x) * sc, (q[1] - ref.z) * sc); x.stroke(); x.setLineDash([]); }
      }
      for (const l of W.landmarks) if (l.city === local && l.label !== false) { const d = Math.hypot(l.x - ref.x, l.z - ref.z); if (d > range * 1.5) continue; x.fillStyle = '#ff5ea8'; x.beginPath(); x.arc((l.x - ref.x) * sc, (l.z - ref.z) * sc, 2.5, 0, 6.29); x.fill(); if (range < 3000 && (l.label || range < 1200)) lbl(l.x, l.z, l.name, '#ffd6ec', '9px sans-serif'); }
      if (SKY.Places) for (const q of SKY.Places.byCity[local.id] || []) { const d = Math.hypot(q.dx - ref.x, q.dz - ref.z); if (d > range * 1.5) continue; x.save(); x.translate((q.dx - ref.x) * sc, (q.dz - ref.z) * sc); x.rotate(hdg); x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(0, 0, 8, 0, 6.29); x.fill(); x.strokeStyle = '#ffd23d'; x.lineWidth = 1.5; x.stroke(); x.font = '10px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(q.icon, 0, 1); x.restore(); }
    }
    for (const c of W.cities) { const cx = (c.x - ref.x) * sc, cz = (c.z - ref.z) * sc; x.fillStyle = c.id === 'A51' ? '#7dff7d' : '#ffeb3b'; x.beginPath(); x.arc(cx, cz, 4, 0, 6.29); x.fill(); x.save(); x.translate(cx, cz); x.rotate(hdg); x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.fillText(c.id, 5, -4); x.restore(); }
    if (SKY.Net) SKY.Net.drawMini(x, ref, sc, hdg, S); // 3.6: partners (clamped to the rim when far away)
    x.restore();
    x.fillStyle = '#ff6a1a'; x.beginPath(); x.moveTo(S / 2, S / 2 - 7); x.lineTo(S / 2 - 5, S / 2 + 6); x.lineTo(S / 2 + 5, S / 2 + 6); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, 6.29); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 11px sans-serif'; x.save(); x.translate(S / 2, S / 2); x.rotate(-hdg); x.fillText('N', -4, -S / 2 + 12); x.restore();
    // compass tape
    const hd = Math.round(P.frame === 'world' ? ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360 : pl.heading());
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; $('compass').textContent = dirs[Math.round(hd / 45) % 8] + ' ' + String(hd).padStart(3, '0') + '°';
  },
  // -------------------------------------------------------------- UI screens
  hideScreens() { for (const id of ['title', 'pause', 'over', 'mapScreen']) $(id).classList.remove('show'); },
  uiOpen() { return !!this.ui || this.state !== 'play'; },
  lockPointer() { const c = this.renderer.domElement; if (c.requestPointerLock && !SKY.isTouch) { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } } }, // (promise form rejects without a user gesture, e.g. an online auto-start)
  unlockPointer() { if (document.pointerLockElement) { this.ignoreUnlock = true; document.exitPointerLock(); } },
  pause(fromUnlock) { if (this.state !== 'play') return; this.state = 'paused'; $('pause').classList.add('show'); this.renderAch(); if (!fromUnlock) this.unlockPointer(); SKY.Audio.setAlarm(false); },
  resume() { this.state = 'play'; this.hideScreens(); if (!SKY.isTouch) this.lockPointer(); },
  gameOver(reason) {
    const P = SKY.Player, pl = this.plane, st = this.stats;
    const titles = { crash: pl.crashKind === 'ditched' ? '🌊 DITCHED!' : '💥 CRASHED!', hypoxia: '😵 YOU PASSED OUT', splat: '🪨 YOU HIT THE GROUND', impact: '💫 KNOCKED OUT', fire: '🔥 TOO HOT!', debris: '🧱 BONKED BY DEBRIS', crash2: '💥 CRASHED' };
    const subs = { crash: P.dead ? 'You did not walk away from this one.' : 'You survived! Explore the wreckage, or try again.', hypoxia: 'Not enough oxygen. Next time grab a mask or get below 10,000 ft.', splat: 'Gravity always wins. (Press JUMP to open your parachute!)', impact: 'You got knocked out cold. Cartoon stars everywhere.', fire: 'Fire extinguishers exist for a reason.', debris: 'Watch out for falling buildings.' };
    $('o-title').textContent = titles[reason] || '💫 GAME OVER'; $('o-sub').textContent = subs[reason] || '';
    const pax = SKY.Crowd.list; const hurt = pax.filter((p) => p.hp < 100).length, ko = pax.filter((p) => p.ko).length;
    $('o-stats').innerHTML = `Flight time <b>${Math.floor(st.time / 60)}:${String(Math.floor(st.time % 60)).padStart(2, '0')}</b> · Cities <b>${st.cities.size}</b> · Plane integrity <b>${Math.round(pl.integrity * 100)}%</b><br>People hurt <b>${hurt}</b> · Knocked out <b>${ko}</b> · Sucked out <b>${st.ejected}</b> · Spoiled meals <b>${st.spoiled}</b>`;
    $('o-explore').style.display = reason === 'crash' && !P.dead ? '' : 'none';
    this.state = 'over'; $('over').classList.add('show'); this.unlockPointer(); SKY.Audio.setAlarm(false); SKY.Audio.setEngine(0, false, false);
  },
  openMap() {
    this.ui = 'map'; this.prevState = this.state; this.state = 'map'; $('mapScreen').classList.add('show'); this.unlockPointer();
    const cv = $('bigmap'); const x = cv.getContext('2d'); const W = SKY.World; const mb = W.mapBounds;
    x.drawImage(W.mapCanvas, 0, 0, cv.width, cv.height);
    const sx = cv.width / mb.w, sz = cv.height / mb.h;
    for (const c of W.cities) { const px = (c.x - mb.x0) * sx, pz = (c.z - mb.z0) * sz; x.fillStyle = c.id === 'A51' ? '#7dff7d' : '#ffeb3b'; x.beginPath(); x.arc(px, pz, 6, 0, 6.29); x.fill(); x.strokeStyle = '#000'; x.stroke(); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(c.name, px + 8, pz - 6); x.fillText(c.name, px + 8, pz - 6); x.lineWidth = 1; }
    for (const c of W.cities) if (c.apt) { const px = (c.apt.XF - mb.x0) * sx, pz = (c.apt.az - mb.z0) * sz; x.fillStyle = '#fff'; x.fillRect(px - 3, pz - 3, 6, 6); x.font = 'bold 11px sans-serif'; x.lineWidth = 3; x.strokeStyle = '#000'; x.strokeText('✈ ' + c.apt.code, px + 5, pz + 12); x.fillStyle = '#ffeb3b'; x.fillText('✈ ' + c.apt.code, px + 5, pz + 12); x.lineWidth = 1; }
    this.renderPlaces();
    if (SKY.Net) SKY.Net.drawBigMap(x, mb, sx, sz);
    const P = SKY.Player, ref = P.frame === 'world' ? P.pos : this.plane.pos; x.fillStyle = '#ff6a1a'; x.beginPath(); x.arc((ref.x - mb.x0) * sx, (ref.z - mb.z0) * sz, 7, 0, 6.29); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); x.lineWidth = 1;
  },
  // Places list per city in the map: tap to fast-travel to the entrance (plane gets parked at that city's gate)
  renderPlaces() {
    const PLp = SKY.Places; let box = $('placelist'); if (!PLp) return;
    if (!box) { box = document.createElement('div'); box.id = 'placelist'; $('maplist').after(box); }
    const vis = PLp.save.visited; let h = '<h3>🚪 Places you can walk into · tap to go to the entrance <span class="fine">(🪙 ' + PLp.coins() + ' · visited ' + vis.length + '/' + PLp.list.length + ')</span></h3>';
    for (const c of SKY.World.cities) { const L = PLp.byCity[c.id]; if (!L || !L.length) continue; h += '<div class="pcity"><b>' + c.name + '</b>' + L.map((q) => '<button data-place="' + q.id + '" class="' + (vis.includes(q.id) ? 'seen' : '') + '">' + q.icon + ' ' + q.name + (vis.includes(q.id) ? ' ✓' : '') + '</button>').join('') + '</div>'; }
    box.innerHTML = h; box.querySelectorAll('[data-place]').forEach((b) => { b.onclick = () => PLp.travel(b.dataset.place); });
  },
  closeMap() { if (this.ui === 'map') { this.ui = null; this.state = (this.prevState === 'over' ? 'over' : 'play'); if (this.state === 'over' && this.plane.crashed === false) this.state = 'play'; $('mapScreen').classList.remove('show'); if (this.state === 'play') { $('over').classList.remove('show'); if (!SKY.isTouch && !this.testMode) this.lockPointer(); } } },
  closeUI() { if (this.ui === 'jail') return; if (this.ui === 'map') return this.closeMap(); this.ui = null; $('cook').classList.remove('show'); $('keypad').classList.remove('show'); if (SKY.Mini) SKY.Mini.close(); if (this.state === 'play' && !SKY.isTouch && !this.testMode) this.lockPointer(); },
  openCook() {
    this.ui = 'cook'; this.unlockPointer(); const box = $('cook-ings'); box.innerHTML = '';
    const pool = SKY.INGREDIENTS.slice(); const good = pool.filter((i) => !i.bad), bad = pool.filter((i) => i.bad);
    const pick = []; while (pick.length < 4) { const g = choose(good); if (!pick.includes(g)) pick.push(g); } pick.push(choose(bad)); if (Math.random() < 0.5) { const b = choose(bad); if (!pick.includes(b)) pick.push(b); }
    pick.sort(() => Math.random() - 0.5);
    this.cookSel = [];
    for (const ing of pick) {
      const b = document.createElement('button'); b.className = 'ing' + (ing.bad ? ' bad' : ''); b.innerHTML = `<span class="em">${ing.e}</span>${ing.n}`;
      b.onclick = () => { const i = this.cookSel.indexOf(ing); if (i >= 0) { this.cookSel.splice(i, 1); b.classList.remove('sel'); } else if (this.cookSel.length < 3) { this.cookSel.push(ing); b.classList.add('sel'); } SKY.Audio.play('beep'); $('cook-go').disabled = this.cookSel.length < 1; };
      box.appendChild(b);
    }
    $('cook-go').disabled = true; $('cook').classList.add('show');
  },
  startCooking(sel) {
    const ov = this.plane.oven; sel = sel || this.cookSel; if (!sel || !sel.length) return;
    ov.state = 'cooking'; ov.t = 0; ov.ing = sel.slice(); ov.spoiled = sel.some((i) => i.bad);
    SKY.toast('🔥 Oven on! Take it out at 7–10 s for a perfect meal (INTERACT on the oven)'); SKY.Audio.play('beep'); this.closeUI();
  },
  openKeypad() { this.ui = 'keypad'; this.unlockPointer(); this.kpEntry = ''; $('kp-disp').textContent = '____'; $('keypad').classList.add('show'); },
  keypadPress(k) {
    const cd = this.plane.cockpitDoor;
    if (k === 'C') this.kpEntry = ''; else if (k === 'E') { this.submitCode(this.kpEntry); return; } else if (this.kpEntry.length < 4) this.kpEntry += k;
    SKY.Audio.play('beep'); $('kp-disp').textContent = (this.kpEntry + '____').slice(0, 4);
  },
  submitCode(code) {
    const pl = this.plane, cd = pl.cockpitDoor;
    if (cd.lockout > 0) { SKY.Audio.play('error'); return false; }
    if (code === pl.code) { cd.locked = false; cd.target = 1; SKY.Audio.play('ok'); SKY.toast('✅ Access granted. The cockpit door clicks open.', 'good'); this.achieve('breach'); this.closeUI(); const p = SKY.Crowd.pilots()[0]; if (p) p.talk('Wait... how did you get the code?!', 3); return true; }
    cd.fails = (cd.fails || 0) + 1; SKY.Audio.play('error'); $('kp-disp').textContent = 'DENIED'; this.kpEntry = '';
    if (cd.fails % 3 === 0) { cd.lockout = 15; SKY.toast('⛔ Keypad locked for 15 s', 'bad'); this.closeUI(); }
    return false;
  },
  renderAch() { $('achlist').innerHTML = Object.keys(ACH).map((k) => `<div class="${this.ach[k] ? 'got' : ''}">${ACH[k][0]} <b>${ACH[k][1]}</b> <small>${ACH[k][2]}</small></div>`).join(''); },
  buildUI() {
    try { this.ach = JSON.parse(localStorage.getItem('grokSkyAch') || '{}') || {}; } catch (e) { this.ach = {}; }
    // title city buttons
    const cb = $('cities');
    for (const c of SKY.World.cities) { const b = document.createElement('button'); b.className = 'city' + (c.id === this.startCity ? ' sel' : ''); b.dataset.id = c.id; b.innerHTML = `<b>${c.id}</b><span>${c.name}${c.id === 'A51' ? ' 👽' : ''}</span>`; b.onclick = () => { this.startCity = c.id; cb.querySelectorAll('.city').forEach((x) => x.classList.toggle('sel', x === b)); SKY.Audio.init(); SKY.Audio.play('beep'); }; cb.appendChild(b); }
    document.querySelectorAll('.mode').forEach((b) => b.onclick = () => { this.startMode = b.dataset.mode; document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('sel', x === b)); SKY.Audio.init(); SKY.Audio.play('beep'); });
    $('play').onclick = () => this.start();
    $('p-resume').onclick = () => this.resume();
    $('p-map').onclick = () => { this.state = 'play'; this.hideScreens(); this.openMap(); };
    $('p-pax').onclick = () => SKY.Crowd.addPassenger();
    $('p-crew').onclick = () => SKY.Crowd.addCrew();
    $('p-invert').onclick = () => { this.settings.invert = !this.settings.invert; $('p-invert').textContent = 'Invert pitch: ' + (this.settings.invert ? 'ON' : 'OFF'); };
    $('p-mute').onclick = () => { this.settings.muted = !this.settings.muted; SKY.Audio.mute(this.settings.muted); $('p-mute').textContent = 'Sound: ' + (this.settings.muted ? 'OFF' : 'ON'); };
    $('p-quality').textContent = 'Graphics: ' + (SKY.lowSpec ? 'LOW' : 'HIGH') + ' (tap to switch)';
    $('p-quality').onclick = () => { location.search = SKY.lowSpec ? '?hq=1' : '?lq=1'; };
    $('p-restart').onclick = () => this.start();
    $('p-title').onclick = () => this.toTitle();
    $('o-retry').onclick = () => this.start();
    $('o-map').onclick = () => { this.prevState = 'over'; $('over').classList.remove('show'); this.state = 'play'; this.openMap(); this.prevState = 'over'; };
    $('o-explore').onclick = () => { $('over').classList.remove('show'); this.state = 'play'; if (!SKY.isTouch) this.lockPointer(); };
    $('o-title').parentNode.querySelector('#o-titlebtn').onclick = () => this.toTitle();
    $('m-close').onclick = () => this.closeMap();
    $('pp-x').onclick = () => this.closeUI();
    document.body.appendChild($('prompt')); // above the touch layer so phones can tap it
    $('prompt').addEventListener('pointerdown', (e) => { if (SKY.Player.target && !this.ui) { I.edges.interact = true; e.preventDefault(); e.stopPropagation(); } });
    const ml = $('maplist');
    for (const c of SKY.World.cities) { const row = document.createElement('div'); row.className = 'mrow'; row.innerHTML = `<b>${c.name}${c.id === 'A51' ? ' 👽' : ''}</b><small>${c.apt ? c.apt.code + ' · ' + c.apt.name : ''}</small>`; const a = document.createElement('button'); a.textContent = '🛬 Approach'; a.onclick = () => this.fastTravel(c.id, 'approach'); const r = document.createElement('button'); r.textContent = '🛫 Runway'; r.onclick = () => this.fastTravel(c.id, 'runway'); const g = document.createElement('button'); g.textContent = '🅿 Gate'; g.onclick = () => this.fastTravel(c.id, 'gate'); row.appendChild(a); row.appendChild(r); row.appendChild(g); ml.appendChild(row); }
    $('cook-go').onclick = () => this.startCooking();
    $('cook-x').onclick = () => this.closeUI();
    document.querySelectorAll('#keypad [data-k]').forEach((b) => b.onclick = () => this.keypadPress(b.dataset.k));
    $('kp-x').onclick = () => this.closeUI();
    $('help-x').onclick = () => $('help').classList.remove('show');
    $('t-help').onclick = () => $('help').classList.add('show');
    addEventListener('keydown', (e) => { if (this.ui === 'keypad') { if (/^Digit\d$/.test(e.code)) this.keypadPress(e.code.slice(5)); if (e.code === 'Enter') this.keypadPress('E'); if (e.code === 'Backspace') this.keypadPress('C'); } if (this.ui === 'cook' && e.code === 'Enter' && this.cookSel && this.cookSel.length) this.startCooking(); });
  },
  toTitle() { if (SKY.Places) SKY.Places.reset(); if (SKY.Cars) SKY.Cars.reset(); if (SKY.AutoLand) SKY.AutoLand.reset(); if (SKY.TaxiGate) SKY.TaxiGate.reset(); if (SKY.Jail) SKY.Jail.reset(); if (SKY.Audio.setSiren) SKY.Audio.setSiren(0); document.body.classList.remove('drive', 'foot', 'running'); this.state = 'title'; this.hideScreens(); this.closeUI(); $('title').classList.add('show'); document.body.classList.remove('playing', 'pilot'); this.unlockPointer(); this.plane.reset({ city: SKY.World.city('LA'), mode: 'cruise' }); SKY.Crowd.populate(0, true); SKY.Props.clear(); SKY.Audio.setAlarm(false); },
  // -------------------------------------------------------------- test hooks
  step(n, inp) {
    inp = inp || {};
    for (let i = 0; i < n; i++) {
      if (inp.move) { I.touchMove.x = inp.move[0]; I.touchMove.y = inp.move[1]; } else { I.touchMove.x = 0; I.touchMove.y = 0; }
      if (inp.look && i === 0) { I.look.dx += inp.look[0]; I.look.dy += inp.look[1]; }
      I.holds = Object.assign({}, inp.hold || {});
      if (i === 0 && inp.edge) for (const k of inp.edge) I.edges[k] = true;
      if (inp.throttle != null) I.throttleAbs = inp.throttle;
      this.update(SKY.DT); I.clearEdges();
    }
    I.touchMove.x = 0; I.touchMove.y = 0; I.holds = {}; I.throttleAbs = null;
  },
};
window.__sky = G;
addEventListener('load', () => G.init());
})();

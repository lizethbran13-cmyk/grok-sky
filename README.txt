GROK SKY - a voxel airliner sandbox
===================================

GROK SKY is a fully destructible voxel airliner sandbox that runs in a web
browser. You can fly it between six cartoon-sized cities. You can also walk the
cabin, cook in the galley, open a door at 25,000 ft, or try to get into the
locked cockpit. Content is cartoony: injuries are ragdoll flops and health bars,
and spoiled food only makes people woozy.

HOW TO RUN
----------
Everything is static files with relative paths: no build, no CDN, and three.js
r128 is included in the folder.
  cd grok-sky
  python3 -m http.server 8000
  open http://localhost:8000/
The folder also works as-is on GitHub Pages or any other static host.
Options you can add to the URL:
  ?lq=1  forces low quality (this is automatic on phones and touch devices)
  ?hq=1  forces high quality

FILES
-----
index.html     the page, HUD, menus and touch UI
style.css      styles; responsive and safe-area aware
three.min.js   three.js r128 (included in the folder)
js/util.js     namespace, palette, WebAudio synth (all sounds are generated in code), labels, toasts
js/voxel.js    voxel grids (instanced cubes), DDA raycast, connectivity and floating-chunk detection, particles, rigid debris
js/world.js    terrain, ocean, 7 zones, destructible buildings and landmarks, runways, clouds, minimap
js/plane.js    the voxel airliner: build, flight model, autopilot, ground and building collisions, damage,
               parts detaching, doors, pressure and decompression, oxygen masks, galley oven
js/people.js   passengers, crew and pilots: verlet ragdolls, poses, health, AI
js/input.js    keyboard, mouse (pointer lock) and touch controls
js/player.js   the player (on foot, seated, piloting, falling or on a parachute), tools, grab and throw,
               extinguisher, all interactions, cooking and serving, cockpit code
js/game.js     main loop, cameras, HUD, events, achievements, menus, fast travel, game over

CONTROLS - DESKTOP
------------------
Click the game to capture the mouse. Esc pauses the game and frees the mouse.
On foot:   WASD move, mouse look, Space jump (or open your parachute while falling),
           F interact, left click to use the tool or throw, right click (or R) to grab or throw,
           X drop, 1/2/3 to pick HANDS / HAMMER / CROWBAR, V or C to switch between
           first and third person
Piloting:  W/S pitch (nose down/up), A/D roll, Q/E yaw (rudder), Shift/Ctrl throttle up/down,
           G gear, Z flaps, T autopilot, B brakes, V camera (chase or cockpit),
           mouse to orbit the chase camera, F to leave the seat (Space also works once
           the plane has stopped on the ground)
Any time:  Tab map and fast travel, P add a passenger, H help, M mute, Esc pause

CONTROLS - PHONE (switched on automatically for touch devices; built for landscape)
-------------------------------------------------------------------------------------
Left side    joystick: move on foot, or pitch and roll in the pilot seat
Right side   drag to look (or to orbit the chase camera)
Buttons      ACTION (use tool, throw, spray), USE (interact), GRAB, JUMP
Top bar      tool switch, camera, map, pause
Piloting     THR throttle slider, plus GEAR, FLAP, AP, BRK and rudder ◀ ▶ buttons

THINGS TO DO
------------
* Fly: take off (rotate at about 130 kts), climb, turn, and land on any runway. The take-off
  direction is north. Stall, flaps, gear and brakes all matter. Touch down gently: keep the HUD
  V/S under about -4,000 fpm. Harder than that collapses the gear. Hitting the ground, water or a building
  wrecks the plane.
* Destroy: everything is made of voxels. Crashes chip the hull, and wings, engines and tail
  pieces break off as tumbling debris. Losing a wing or engine makes the plane roll and yaw.
  Buildings and landmarks crumble too. Use the hammer or crowbar to chip at voxels.
* Cabin life: 26 passengers (14 on phones; press P to add more), 2 flight attendants and 2 pilots. They walk to the lavatory, panic in turbulence,
  brace when things go wrong, and get knocked around (ragdoll and health bar). Crew give first
  aid. You can push, punch, grab and throw people and luggage (cartoon style).
* Galley: interact with the oven, pick up to 3 ingredients, then take the meal out at 7-10 s for
  a PERFECT result. Fresh meals heal. Meals with a "bad" ingredient (old yogurt, mystery fish...)
  make people woozy. Leave the oven too long and it catches fire: grab the extinguisher.
  If you give a meal to a crew member, they take it to the pilots.
* Door: open a cabin door in flight. Press interact twice to force it against cabin pressure.
  You get explosive decompression: wind, alarms, loose objects and people pulled toward the hole
  (with cartoon auto-parachutes), and oxygen masks dropping from the ceiling. Your O2 bar drains
  unless you wear a mask (interact near a dangling mask) or the plane gets below about 10,000 ft.
  The autopilot or pilots start an emergency descent.
* Cockpit: the door is reinforced and locked. Find the 4-digit code (it is hidden in the galley
  drawer, the lavatory cabinet, or the lead flight attendant's pocket, and changes every flight)
  and enter it on the keypad. Three wrong tries lock the keypad. Or bash the door down: the
  crowbar is best, the hammer is slower, and the extinguisher works too. The pilots fly on
  autopilot. If they get knocked out or woozy, the autopilot gives up after a while and somebody
  has to take the seat. Ask a pilot three times and they'll hand you the controls.
* World: Los Angeles (HOLLYWOOD sign, beach, palms), Las Vegas (the Strip, pyramid, Stratosphere,
  GROK sign), Area 51 (hangars, radar, a suspicious saucer: touch it), Mexico City (pyramid, Angel
  of Independence, cathedral), New York (skyline, Empire State, Statue of Liberty, Central Park),
  Paris (Eiffel Tower, Arc de Triomphe, Louvre pyramid, Seine) and Tokyo (Tokyo Tower, neon towers,
  torii gate, Mt Fuji). Each has an airport and runway. Distances are hugely compressed: cities
  are 15-40 km apart. Use the map (Tab) to fast travel to a final approach or a runway.
* Achievements are saved in your browser (check the pause menu).

NOTES / KNOWN ROUGH EDGES
-------------------------
* The flight model is arcade-style. Shown altitude is scaled x4 so cruise reads about 25,000 ft
  over a compact world. The autopilot does not land; you do that yourself.
* Walking around outside on the ground is a bonus mode. Collision with the plane from outside
  is approximate. Board through the front left door when the plane has stopped.
* On phones, quality drops automatically: fewer debris pieces, shorter view distance, lower
  pixel ratio.

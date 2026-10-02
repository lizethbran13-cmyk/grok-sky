GROK SKY - a voxel airliner sandbox (v3.5)
==========================================

GROK SKY is a fully destructible voxel airliner sandbox that runs in a web
browser. You can fly it between six cartoon-sized cities (plus Area 51), each laid out like
the real one and each with a small working airport. You can also walk the
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
js/world.js    terrain, ocean, 7 zones, lazy per-city build/unload, city planner (roads, districts, water,
               ground decals), destructible buildings, far LOD impostors, per-city minimaps
js/cities.js   mini Los Angeles and mini Las Vegas (street layout + landmarks), shared builders
js/cities2.js  Area 51, Mexico City, New York, Paris and Tokyo, plus the bridge builder
js/airport.js  the 7 mini airports: runways/taxiways/apron markings, terminal with gates and jet bridges,
               tower, hangars, parked airliners, lights, windsock, docking, pushback, auto-taxi, routes
js/ambient.js  cheap instanced life: cars on the streets, people walking, baggage carts and fuel trucks,
               Bellagio fountains, Luxor beam
js/plane.js    the voxel airliner: build, flight model, autopilot, ground and building collisions, damage,
               parts detaching, doors, pressure and decompression, oxygen masks, galley oven
js/people.js   passengers, crew and pilots: verlet ragdolls, poses, health, AI
js/input.js    keyboard, mouse (pointer lock) and touch controls
js/places.js   enterable places engine: storefront facades + glowing door markers, interiors built on
               demand (one at a time, floating high above the active city), elevators to real observation
               decks, NPCs, coins/souvenirs save, telescopes, photo spots, place fast travel
js/places_defs.js  the places of every zone (door positions, interiors, decks, food stands, pyramid climb)
js/minigames.js    the place panel: food menus (eat here / to go), souvenir shops, slots, roulette,
               blackjack, GROK INVADERS arcade, claw machine, skee-ball, taiko, movie scene
js/autoland.js 3.5 AUTO LAND: approach-cone detection for every runway end, guided glide path, flare, rollout and stop
js/cars.js     3.5 cars: rental lots and counters, ambient parked and cruising cars, stealing, wanted stars, police AI, busted/escape
js/clinic.js   3.5 airport clinics (one enterable place per airport) and the doctor mini-game
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
NEW IN 3.5
* AUTO LAND: when you fly toward any runway roughly lined up, a big orange AUTO LAND button appears
  (desktop: press L). It names the runway (for example "LAX 36R"), flies the approach, flares, touches down
  and brakes to a stop. Any stick, rudder, throttle, brake, gear, flaps or AP input hands control back to you.
* RUN: hold Shift on desktop. On phones, tap the 🏃 RUN button to toggle it (it turns green) or hold it.
  Running is 1.9x walking speed, with a lenient stamina bar that only shows while it isn't full.
* CARS: every airport has a yellow CAR RENTAL counter by the parking lot. Rent a Grok Mini (10 coins),
  a Sky Racer (25) or a Desert Cruiser (16). Drive with WASD (Space = handbrake, N = horn, F = exit).
  On phones, the joystick steers (up = gas) and there are big GAS / BRAKE / EXIT / HORN pedals.
  Holding brake stops the car and then reverses it. Park in any rental lot and EXIT to return the car.
* STEAL: walk up to a parked or passing car and press STEAL to start a 2-second break-in. You get wanted
  stars and police cruisers (flashing lights and siren) chase you. To clear the wanted level, stay more than
  120 m from them for 10 s, hide indoors, or return the car to a rental lot. If they catch you while you're
  stopped you're BUSTED: a fine of up to 15 coins and release at the airport police office.
* CLINICS: every airport has a CLINIC with a red cross next to the rental lot. Step up to a patient and press
  USE. Pick the symptom, pick the tool (bandage, ice pack, thermometer, medicine, splint or lotion), then drag
  it onto the glowing spot or tap it. Rewards are 6-10 coins plus the achievements First Patient and
  Doctor of the Skies (10 patients).

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
* Airports: every city has a small working airport (LAX, LAS Harry Reid, XTA Groom Lake, MEX,
  JFK, CDG, HND Haneda). Each one has numbered runways with markings, approach/edge/threshold
  lights and PAPIs, taxiways, an apron, a terminal with 2-4 gates and jet bridges, a control tower,
  hangars, parked airliners, a windsock, an airport sign and a signature building (LAX Theme
  Building, JFK TWA terminal, CDG Terminal 1 ring, Haneda pagoda...).
  - Land, then taxi to a free gate (follow the yellow line; the HUD and minimap show the way) or
    press T / AP on the ground for auto-taxi. Stop on the gate's stop bar (nose toward the
    terminal) and the plane docks: the jet bridge swings out and the front-left (L1) door opens.
  - Leave the seat, walk out the L1 door, down the jet bridge and into the terminal: gate seats,
    departures board, cafe (+HP) and check-in desks. Walk back down the bridge into the door to
    reboard.
  - Take the controls and throttle up (or press T) to push back. The tug pushes you out, then T
    auto-taxis you to the runway and the autopilot takes off. If you sit in a passenger seat at a
    gate instead, the pilots push back and fly you to the next city.
  - The map (Tab) lists each airport code with Approach / Runway / Gate fast travel.
* Cities (compressed, laid out like the real ones; everything is destructible voxels):
  - Los Angeles: HOLLYWOOD sign and Griffith Observatory on the hills, Downtown LA towers
    (US Bank, Wilshire Grand, City Hall, Disney Hall), Hollywood Blvd, Wilshire/Sunset palm
    boulevards and freeways, Santa Monica pier with Ferris wheel and coaster, beach, LAX by the coast.
  - Las Vegas: one Strip boulevard south to north: Welcome to Fabulous Las Vegas sign, Mandalay,
    Luxor pyramid + beam, Excalibur, New York-New York, MGM, Aria, Cosmopolitan, Bellagio with
    its fountain lake, Paris (Eiffel replica), Caesars, High Roller, Mirage volcano, Venetian,
    Treasure Island, Wynn, Sahara, STRAT tower. Fremont Street canopy downtown. LAS just east of
    the south end of the Strip.
  - Area 51: separate, out on the dry lakebed: Groom Lake strip, big hangars, radar dome, fence
    and warning signs, and a suspicious saucer (touch it).
  - Mexico City: Zocalo with flag, Cathedral, National Palace, Templo Mayor, Torre
    Latinoamericana, Bellas Artes, Paseo de la Reforma with the Angel of Independence,
    Chapultepec park, lake and castle, Teotihuacan pyramids outside the city, volcanoes.
  - New York: Manhattan grid between the Hudson and East rivers, Broadway, Central Park
    (with reservoir) in the right spot, Times Square neon, Empire State, Chrysler, Flatiron,
    One WTC at the south tip, Brooklyn Bridge, Statue of Liberty and Ellis Island in the harbor,
    JFK out in Queens.
  - Paris: the Seine curving through with bridges and the Ile de la Cite, Eiffel Tower and
    Trocadero, Arc de Triomphe with the Champs-Elysees leading to Concorde, Tuileries and the
    Louvre pyramid, Notre-Dame, Sacre-Coeur on its hill, Opera, La Defense, Haussmann blocks,
    the Peripherique. CDG to the northeast.
  - Tokyo: Shibuya scramble crossing with neon and screens, Tokyo Tower, Skytree, Imperial Palace
    with its moat, Senso-ji gate and pagoda, Ginza, Shinjuku towers, Rainbow Bridge to Odaiba,
    Mt Fuji in the distance, Haneda on the bay.
  Distances between cities are hugely compressed (15-40 km). Walking around a city on foot works:
  streets have cars and people. Visiting 5 landmarks earns an achievement.
* Achievements are saved in your browser (check the pause menu).
* ENTERABLE PLACES (walk in on foot; MAP -> "Places" lists them all and fast-travels you to the
  door, parking your plane at that city's gate). Each door has a spinning gem and a glowing ring:
  stand in the ring and press F / USE (or tap the orange ENTER prompt on a phone). A short fade
  takes you inside; the green EXIT ring takes you back out to the same door.
  - Los Angeles: Grok Studios Soundstage 7 on Hollywood Blvd (western + sci-fi sets, star in a scene,
    Walk of Fame gift shop, craft services), Venice Beach Tacos & Burgers stand, Griffith Observatory
    (Foucault pendulum, Tesla coil, planets, the great telescope looks at the Hollywood Sign).
  - Las Vegas: Grok Royale Casino (slots, roulette, blackjack, cashier comps, bar, chaser lights),
    Golden Buffet (all you can eat = full heal), STRAT SkyPod deck by elevator (+ SkyJump!).
  - Area 51: Hangar 18 with the saucer; find the keycard to open the secret lab with alien tanks.
  - Mexico City: Mercado (tacos al pastor, churros, aguas frescas, souvenirs, mariachis), Zocalo taco
    cart, the Cathedral (light a candle, golden altar), climbable Pyramid of the Sun at Teotihuacan.
  - New York: Times Square Candy & Toy World, Broadway Arcade (Invaders, claw, skee-ball), Tony's
    pizza, Empire State observation deck by elevator.
  - Paris: Boulangerie (croissants), the Louvre gallery (gaze at the Mona Lisa...), Eiffel summit.
  - Tokyo: Akiba Game Center (playable GROK INVADERS, UFO catchers, taiko, purikura), Ichiban Ramen,
    GrokMart konbini, Skytree deck by elevator.
  Food heals you (or take it "to go" on a tray: eat it later with USE, or carry it onto your plane
  and serve it). Fun coins (start with 60) come from photo spots, slots, the arcade and skee-ball and
  buy souvenirs. Photo spots count toward the Tourist achievement. Decks have coin telescopes.
  Coins, souvenirs, high scores and visited places are saved in your browser.

NOTES / KNOWN ROUGH EDGES
-------------------------
* The flight model is arcade-style. Shown altitude is scaled x4 so cruise reads about 25,000 ft
  over a compact world. The autopilot taxis and takes off but does not land; you do that yourself.
* Collision with the plane from outside is approximate. Board through the front left door when
  the plane has stopped (at a gate: walk down the jet bridge into the door).
* On phones, quality drops automatically: fewer debris pieces, shorter view distance, lower
  pixel ratio, fewer district buildings, cars and people.
* Performance: only the city you are near is built (in small time slices so the game keeps
  running); far cities are a single merged impostor. Inside a city, voxel blocks beyond about
  1 km (650 m on phones) are swapped for merged box impostors, grouped into large cells so far
  scenery is a handful of draw calls. Hidden voxels are not drawn, and cars, people and lights are
  instanced. Damaged buildings drop out of the impostors.
* City layouts are compressed caricatures; ordinary buildings are hollow shells. The enterable
  places are separate small interiors you step into through their doors (only one is built at a
  time, and only while you are inside), so they cost nothing while you fly.

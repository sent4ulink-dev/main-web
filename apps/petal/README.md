# Petal Isle

An interactive floating-garden date invitation built with Three.js and Vite, called “Petal Isle”. A visitor starts in a sky full of clouds, flies down through them to a question garden, answers a heart-stone “Yes”, then walks a little bunny up one path: a paw-print trail leads to the four gardens to either side of it (the adventure, the day, the place, the keepsake book), and the big gate at the path's end swings open as she walks up to it, on the islands beyond: picking flowers, riding a hot-air balloon, dancing on the Music Isle, making wishes, and watching the weather change. Once the keepsake book has been opened the other bunny stays, and the two walk the island hand in hand.

Everything runs in one forward render pass and is tuned for phone GPUs.

## Run locally

```sh
npm install
npm run dev
```

Open the printed URL (the compressed 3D assets need the dev server; `file:` URLs will not work).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint (correctness rules) over `src/` and `tests/` |
| `npm test` | Unit tests (Vitest) |
| `npm run check` | Lint, test and build — what CI runs |
| `npm run check:island` | Flood-fill the baked walk map: every place must be reachable |

Addresses: the bare site is the studio, where invitation links are made; `?share=<id>` is one invitation (see Making and editing links). Switches: `?debug` exposes `window.__grove` (scene, player, environment, animals…), `?phone-preview=1` frames the page like a phone.

## The walkthrough

**The start.** The page opens on a sky full of clouds and one question: “Shall we begin our little journey?”. Tapping “Let’s go ♡” parts the clouds (each bank drifts off outwards as it fades, with a rush of air) while the camera dives down to the question garden. After “Yes” there are no buttons: a moment to take it in, then you are your bunny, standing by the heart stones.

**One path, and the gate.** There is only ever one way to go. From the question garden a path winds north, a long island of its own with cobbles down its middle, a rope fence along both sides and lamp posts by the way. Four gardens stand to either side of it, each a wide round island of its own over a little bridge, with a fence round its rim, a bench to sit on and a tree or two: the activity board (right), the calendar tree (left), the treasure map (right) and the keepsake book (left), every board facing whoever walks up the path, and a numbered signpost at each turning (“1 · Adventure Garden”…). The path is a walk of its own: four flower arches to pass under, each with a little heart lantern, and two runs of pastel heart stones in place of the cobbles that chime as they are stepped on, each stone a note higher (a scale on the first run, “Twinkle, twinkle” on the second; step on all eight in turn for a puff of hearts). At the path's end stands the big gate, two stone pillars and a round arch with a glowing heart on top and two tall pink leaves that meet in a heart. It opens by itself as the bunny walks up to it, in a shower of sparkles (the first time a line says what lies beyond), and swings shut again behind her once she has gone on. Beyond it a bridge leads to the crossroads, and from there one bridge each to the Bunny Meadow, the Music Isle, the Lantern Grove (with the Star Perch up its stepping stones) and the Lily Pond; every island has a fence round its rim, low enough to hop over (the secret gardens' stepping stones start beyond it). While walking, a little strip at the top says how far the plan has come and what is next (“♥♡♡♡ 2/4 · Choose your day”).

**The paw-print trail.** Little glowing paw prints, with hearts hovering over them, run from your bunny to the one thing to do next, and a heart bobs over it: the activity board first, then the calendar, the treasure map, the keepsake book, and last up to the gate and out through it. It always goes by the path and the bridges (from a secret garden, which is only reached by hopping, it shows no prints, just the heart). A line at the top says where it leads (“Follow the little paw prints…”). When you get there, the view turns round to the board and a hint at the bottom says what to tap. The trail rests while a board is open; once you choose, “…is part of our story now” shows, then the prints lead on to the next stop. After the book dance the trail is done. It finds its way round posts and pots, and starts again from wherever you wander.

**Controls.** Move with WASD / arrow keys, the on-screen joystick, or a gamepad (one easy pace, no sprinting). Space / ⤒ jumps — hold it after the top of the hop and the bunny flutters her ears to glide. E / the pink button does whatever is nearby, C sits, P takes a photo, M opens the island map (while the invitation can still be edited), V changes the telescope view. The camera follows behind her as she turns; drag the scene (or use the right stick) to look around, and a moment after you let go it settles back behind her.

**Every object has a body, its real size.** Benches, rocks, fences, mushrooms, bushes, the well, the balloon basket and more are solid: you can hop onto them and stand on top, exactly where they are, while trunks and posts are walls. Paths and bridges are wide enough to walk side by side.

**The Music Isle.** Beyond the gate, north-west of the crossroads over its own bridge, a little island with a round checkered dance floor, fairy lights strung between posts, benches and two sakuras. An old gramophone stands at the far side: its record spins, its flower-striped horn nods to the beat and little notes float out of it. Its tune is an original musette waltz (an accordion's two warbling reeds, an oom-pah-pah bass and piano), heard through the gramophone's narrow, crackling, slightly wobbling sound; it grows as you come near, while the island's lullaby fades. On the floor the pink button says “💃 Dance”: the other bunny pops in and the two of you dance — a bow, a waltz round and round each other, a twirl, side-hops, claps, a double spin, cheek to cheek, a bow and a big heart — while the camera circles slowly and the record plays up (a tap or a push on the controls ends it early).

**The floor's lantern.** A pink-and-cream paper lantern floats over the middle of the dance floor. As night falls it glows, and a warm light falls from it onto the floor, the gramophone and whoever dances there (one point light, always in the scene and at no strength by day, so nothing is rebuilt at dusk).

**A song from YouTube.** The Music Isle can play a song of your own instead of the waltz: paste its YouTube link under ⚙ → “Music Isle song” and press “Save” (watch, youtu.be, Shorts, Music and embed links all work, with a start time if the link has one). Near the island the song plays in the background, louder as you come near, and its name shows for a moment (“♪ …”); it pauses as you walk away and goes on when you come back. The YouTube player itself stays tucked out of sight (see-through and out of reach, but full size, so YouTube plays it as usual; YouTube's embed rules do ask for a visible player, so this may not always be allowed). It only comes up, at the top of the screen, when the song stands still for three seconds although it should be playing: the first time, some phones want a tap on its ▶ (a hint says so), and YouTube may show an ad first or ask whether you are still there. Once the song moves, it tucks away again. In the dance the round of moves (the waltz, the twirl, the side-hops, the claps and a spin, the two bunnies taking turns) goes on for as long as the song plays; when it ends they finish cheek to cheek with the big heart, and the song starts again after. If YouTube can't play a song (its owner turned embedding off, or it is private), a line says so and the gramophone's waltz plays. The song is kept in the browser; to make it play for someone else, save it under ⚙ while editing an invitation link: the invitation carries it. The player comes from youtube-nocookie.com, and only once you are near the island.

**Things to do:** find the 12 hidden hearts, pick a bouquet of 12 flowers, feed a bunny a carrot, make a wish at the well, carve a drawing into the big sakura, splash in the lily pond, ride the swing, look through the telescope, pet the sleepy cat, ride the balloon and dance on the Music Isle. (There is no journal or checklist: nothing is ticked off.) In the meadow the picnic, the carrot patch and the balloon each have a corner of their own, and when a bunny grazes by the carrots the button offers whichever is nearer. Picking happens right on the boards, with no dialogs: tap the calendar, the activity board or the treasure map and the camera frames it while the other bunny (the boy if you play the girl, and the other way round) pops up with a little heart wand; tap a picture (or a day) and it runs over to point at it (finding its way round posts and pots); for the ones out of reach it hops and stretches up on tiptoe, and once a few tries have worn it out it stops, flushed and panting, to catch its breath; every so often it turns round to you (“this one?”), and it faces you while it waits and when it cheers; tap the same one again to choose it, and it cheers. On a phone held upright the board fills the screen, the other bunny waits in front of it, and the camera moves in on the picture or week you tap so it can be read; tap away from the board to close it. The calendar's carved arrows browse the months. Once the day, the adventure and the place are chosen, tap the keepsake book: the two bunnies meet in front of it for a little dance — a wave, a cheer, a twirl, a dance and a clap, a bow and a big heart — under a ribbon that reads “It’s a date!” with your plan (a tap skips it). Every lantern is lit from the start.

**The two of you.** The fourth heart of the strip fills when the keepsake book is opened with the whole plan made (even if the dance is cut short), and from then on the other bunny no longer goes away (`gameplay/couple.js`). It walks at your side, paw in paw: on the side whose paw is free (your bouquet is in one paw, a carrot or the umbrella in the other), behind you where a ledge is one bunny wide, and it hops and glides when you do. Stand still and you turn to each other. Sit down — on a bench (you share the seat), the picnic blanket or the grass — and it sits beside you, cheek to cheek, with a heart rising now and then and a nuzzle every so often; rest long enough and you both doze off. On the swing it goes round behind and pushes, the swing goes higher and the one on the seat is all smiles (the seat hangs low, a knee above the grass, so at the back of a swing it comes to the pusher's paws). The balloon you ride is bigger than the one that drifts by, with a basket wide enough for two: you each take a side of its front rim. It stands by at the telescope. It dresses for the weather as you do: a scarf in the snow, and in the rain an umbrella of its own, held in its far paw while it walks on the side away from yours, so the two canopies meet over your joined paws. When a board or a dance needs it, it goes off to that and comes back after. A new visit starts with the two together if the book was opened before.

**Gateways.** Every island's rim has a split-rail fence, open at each bridge. Where stepping stones lead off an island (up to the Star Perch, out to the five secret gardens) the fence has a little flower gateway: two white posts and a hoop of blossoms, with the way up to it kept clear of trees and benches.

**Sky and weather.** A day–night cycle (or your own clock, or a fixed hour) moves the sun along a real arc, with sunsets, a moon, twinkling stars, a faint Milky Way and shooting stars. The weather is always a surprise: it starts on a random one and changes by itself, cross-fading between sunny, cloudy, petal breeze, soft rain (wet ground, pond rings, then a rainbow at the true 42° angle), first snow (settling on every upward surface) and mist. Both bunnies open an umbrella in the rain and wear a scarf in the snow; lanterns glow brighter at night, fireflies come out at dusk, birds shelter, bunnies sleep, an owl appears. Every picture on the boards has a little brass lamp over it (a clip-on one on each page of the keepsake book, a bracket lamp on the calendar's tree); after dark its bulb and hood glow, a soft beam falls from it and the picture is lit warmly from the top down, so every choice can be read at night. No real lights are used: the pictures' own materials add the lamp's light (`world/board-lamps.js`). The lettering glows after dark too: the map's title and place names in warm gold, the carved calendar's numbers and words like gold in the bark, the question on the stone in pink, and the signposts brighter.

**The residents.** Bunnies graze, twitch their ears, come closer if you stand still, cuddle up when you sit on the grass, and follow you after a carrot. A mother duck leads her ducklings (bottoms up now and then), frogs puff their throats, koi jump, two swans meet and bend their necks into a heart, songbirds peck and fly off, an owl watches the Lantern Grove after dark, and a cat naps on a bench. Pet any of them.

**Map, photos, settings.** The screen stays clear while you walk; the header holds only ⚙ and ♪. The ⚙ sheet opens with “Your walk”: a polaroid photo to save, in edit mode the choice of bunny, and, once the plan is made, “💌 Share your date”. Below that it sets the time of day and the music and sound-effect volumes, and it links the artwork credits. What only whoever makes the invitation needs shows only while it can still be edited (and in the studio): the island map with place names (it reveals the island as you explore), the Music Isle's song (a YouTube link), camera speed and invert-Y. A finished invitation keeps the sheet short. There is no weather or graphics setting: the weather is a surprise and the picture is always the best the device holds.

**Sound.** Everything you hear is synthesised in the browser, with no audio files. A little waltz plays in the background: an original lullaby for music box, harp, a soft pad and glockenspiel, a bit different every time round, softer at night and muffled in the rain. Under it, the island sounds the way the weather, the hour and your place make it: gusty wind with leaves rustling, songbirds and a far-off dove by day, crickets and an owl at night, rain hissing and pattering, and a babbling brook that swells near the pond and the waterfalls. The effects are built from how real things sound: a landing from bursts of tiny grains for grass, leaves, sand and snow (a knock on wood, a tap on stone; walking itself is quiet), water from bubbles that ring and rise in pitch, bells and music-box tines from their true overtones, a duck's quack through the formants of its bill. Animal calls come from the side they are on. Near the Music Isle the gramophone (or your song) takes over (see above). Sound starts with the first tap or key press; ♪ turns the music and nature sounds off, and the choice is remembered.

## Language

Every word a visitor reads is English: the defaults in `app/content.js` (edited in place on each invitation link), the island names on the signposts and the map (`content.isles`), the buttons, hints, settings and the credits page. Dates are written with `Intl` (`en-US`) in `core/dates.js`, and the carved calendar starts its week on Monday. Cormorant Garamond is used for headings and lettering, Nunito for the interface. Old share links (`#c=…`) keep the words they were made with.

## Architecture

```
src/
  main.js               App shell: the cloud intro, slot dialogs, settings button
  app/                  Content model, edit mode (edit-mode.js), share links
                        (share-client.js), photos (photo.js), the plan to
                        share (plan.js), the lullaby (music.js), the
                        Music Isle's gramophone waltz (gramophone.js), its YouTube
                        player (jukebox.js) and the nature soundscape (ambience.js)
  core/                 Engine-level helpers, no game rules
    math.js               damp, springs, angles, seeded random
    input.js              Keyboard, joystick and gamepad → one intent per frame
    settings.js           Versioned, sanitised settings store (localStorage)
    sharpness.js          The graphics tier a device starts on, and how sharp to draw
    dates.js              English month names and date formatting
    youtube.js            Reads a YouTube link (video id and start time)
    homography.js         Lays a flat box onto four screen points (CSS matrix3d)
    uniforms.js           Shader uniforms shared by every material (time, wind,
                          wet, snow, night, sun, player position)
    geometry.js           Vertex-coloured primitive helpers
  world/
    stage.js              Renderer, cameras, the flight in, the trail's stops, frame governor, loop
    island.js             Loads the island GLB, materials, flower chunking
    layout.js             The island's layout as the build wrote it down (play.json): where
                          each garden was moved to, the path, the gate, the island's parts
    walkmap.js            Walk map v2 queries (surfaces, bodies, water, colliders)
    environment.js        Clock + weather director → lights, fog, sky, uniforms
    sky.js                Sky dome (sun, moon, stars, rainbow), clouds, meteors
    precipitation.js      GPU rain / snow / petals (one draw call)
    slot-art.js           Painted canvases for the interactive picture frames (the calendar is carved)
    surface.js            The point and normal at a texture spot on a mesh
    board-lamps.js        The lamps over the boards' pictures, which light them after dark
                          and the “It’s a date!” ribbon
    pathfind.js           A* round posts and pots on the walk map (the host, the dance partner)
    map-balloon.js        The little balloon that tours the treasure map
  actors/
    player.js             Controller: physics, jumps, glide, seats, camera
    bunny.js              The bunny model and its procedural animation rig
    herd.js               GPU part animation for instanced animals
    species.js            Animal designs (parts, pivots, channels)
    animals.js            Animal behaviour
    host.js               The other bunny, who presents the picking boards, and your
                          stand-in for the book dance
    pond.js               Pond navigation: swimming lanes, bank spots, koi jumps
    cat.js                The articulated cat
  gameplay/
    play.js               Orchestrates activities, HUD, actions
    chooser.js            Picking on the boards: camera, host, choose
    framing.js            Camera poses for the boards and the book (fitted to phone screens)
    celebration.js        The keepsake-book dance: staging, camera, cues, ribbon
    trail.js              The paw-print trail that leads to each board in turn
    gate.js               The big gate at the path's end: it opens as you walk up to it
    chimes.js             The path's heart stones, which chime a tune as they are stepped on
    ballroom.js           The Music Isle: the gramophone, its notes, and the dance
    couple.js             The other bunny at your side: hand in hand, sitting together,
                          pushing the swing
    progress.js           The hidden hearts found (saved in the browser)
    pickables.js, lamps.js, hearts.js, swing.js, carving.js, scope.js,
    telescope.js, extras.js (balloons, fireflies)
  fx/                   Pooled particles; audio.js (one audio context, garden reverb,
                        synthesised instruments, water, birdsong) and sfx.js (effects)
  ui/                   Settings, map, photo booth, the plan sheet, the
                        studio lock and link sheet (studio.js), DOM helpers
  styles/               app.css (page) and game-ui.css (sheets, HUD, map)
server/                 The share links' server (api.js) and a local bucket for dev/tests
tests/                  Vitest unit tests (walk map, path finding, framing, the trail, pond, calendar, settings…)
```

Data flows one way each frame: **input → player physics → rig animation → environment → animals/game → render**. Systems talk through small APIs and events (`onEvent`), not globals; the only shared state is the uniform block in `core/uniforms.js`.

### Walk map v2

`public/island/walkmap.bin` is baked by Blender: one `uint16` per 10 cm cell — `0` is open sky, bits 0–13 are the surface height, bit 14 marks the top of a solid body, bit 15 marks pond water — followed by one material byte per cell (grass, stone, wood, water, leaf, cloth, metal) for footsteps and dust. A body's top in a cell is the highest point the prop really has there (nine rays across the cell); a cell that only grazes a prop's side stays open floor, unless that prop is a wall (over 1.2 m: a trunk, a post, the well), which keeps a cell of padding — so nothing stands on air beside a mushroom or a bush. Props built in the browser (swing posts, telescope, balloon basket) register colliders at runtime. `tools/check_reachability.py` flood-fills the map with the bunny’s real movement rules (step 0.32 m, hop 0.85 m up / 1.35 m across) and fails if any garden, bench, lantern, heart, secret garden, the dance floor or the balloon's landing spot cannot be reached. At a bridge's end the turf shows through the gaps between the planks and the deck can stand a hand above the lawn it lands on; the bake closes those slots and ramps the turf up to the deck, so there is never a step there (the trail's path-finder wants even footing).

## Assets

The island is rebuilt from the supplied Blender scene by `tools/build_cute_isle.ps1` (Blender 5.1 + `gltf-transform`, Windows PowerShell):

```powershell
./tools/build_cute_isle.ps1 -Samples 24
```

`tools/build_cute_isle.py` restyles the scene (vertex-colour palette, ray-cast ambient occlusion, GPU-instanced flowers, per-region merged meshes). The source scene crowds its five gardens round one middle; `tools/cute_isle_layout.py` first moves each of them (never turning it: every board keeps facing south, up the path) to its place along one path, and takes away its old cliff and the fences and rocks along its old rim. `tools/cute_isle_expansion.py` then lays a wide lawn round each garden (`build_apron`: tucked in under the garden's own rim, with a cliff of its own. Where a garden's old lawn ran down at its rim or dipped, it is lifted level with the new lawn first, so no hollow is left. The garden's waterfalls are set again at the new rim, outside the fence: each fall over the very edge, its little pool just behind it, and no fence post in the water), builds the winding path island with its cobbles, lamp posts, signposts and flower arches, a bridge to each garden, the gate (its two leaves stay objects of their own, hinged in the browser, and are no part of the walk map), the crossroads and the outer islands, their bridges and props, a split-rail fence round every island's rim (open at each bridge) and a rope fence down the path, and the secret-garden trails, `tools/cute_isle_ground.py` rolls the turf over every lawn edge (grassy banks where terraces overlap), patches accidental gaps, beds the stepping stones and stands the lanterns on whatever is under them, and builds the activity board and the keepsake book, and the script bakes `walkmap.*` and `play.json` (positions of benches, lanterns, hearts, zones…). Every build also audits the props: any two whose real geometry meets are listed under `overlaps`, and props resting on nothing under `floating`, in `public/island/petal-isle-cute-report.json` (and in the build log), so nothing grows through a bench or hangs in the air unnoticed. The bunnies come from `tools/build_bunny.py` (`BUNNY_STYLE=boy` for the boy). Their clothes are cut to the measured body (rays cast all round it), with a set gap: the girl wears a pink dress with a fitted bodice, a white Peter Pan collar, a gathered skirt in soft folds with white piping, and rose bows at the collar and the back, plus a flower crown and a bow on her right ear (part of the ear, so it bends with it); the boy wears a striped shirt with a pointed collar and a navy bow tie, blue shorts cut as two legs with cuffs, suspenders that cross at the back, and a little straw boater tipped forward in front of his ears. The hems end above the feet, the necklines stay well under the head, and the fluffy tail sits on the skirt or shorts (it moves with the cloth). The build ends with an audit that fails if any of the outfit cuts into the body or the head, or an ear comes near the hat; in the browser the paws are kept outside the body and clothes (and the snow scarf) in every pose (`clearOfOutfit` in `actors/bunny.js`). After a rebuild, optimise each GLB with the gltf-transform CLI (`optimize --compress meshopt --instance false --join false --flatten false --simplify false --palette false`) and bump the `?v=` keys in `actors/bunny.js`; after an island rebuild, bump them in `world/island.js`, `actors/player.js` (`WALKMAP_VERSION`) and `world/stage.js`.

## Performance

- One forward pass, no post-processing, no real-time shadows (baked AO + blob shadows).
- The island is merged per region and flowers are instanced in ~11 m chunks, so the camera skips what it cannot see; on phones, distant flower chunks are skipped while walking.
- The quality tier is chosen automatically, with no setting, and as high as the device can hold: the best tier on any phone or computer with 4 GB of memory or more, balanced at 3 GB, battery saver only for clearly weak devices (Safari reports 4 cores on every iPhone, so the core count is not trusted). Tiers scale pixel ratio, flower density, particle counts and detail distance; small screens draw more pixels per CSS pixel, so a phone gets a 1080p-class picture (`core/sharpness.js`).
- A frame governor lowers resolution in small steps down to a still-sharp floor (1.5× on high-density screens) before capping to 30 fps, then draws the flowers less far (32 m, then 22 m), and judges slow frames against the screen's own pace, so a phone holding pages to 30 fps in low-power mode keeps its sharpness.
- Weather particles, flower wind, the sky and animal animation all run in shaders; the CPU writes a few numbers per animal per frame.

## Accessibility

On phones the game behaves like an app, not a page: pinching or double-tapping never zooms it, and tapping the controls fast never picks up text or opens a long-press menu (text fields still work, and are 16 px so an iPhone doesn't zoom in on them). Keyboard and gamepad play everything; dialogs are native `<dialog>`s with labelled titles and focus return; `prefers-reduced-motion` pauses motion and skips camera flights; the map has text labels.

## Making and editing links

Each invitation is one short link, `?share=<id>`, and its words live on Petal Isle's own server (`server/api.js`, a Cloudflare Pages Function), one object per link in an R2 bucket:

1. **Make a link.** Open the bare site: it is the studio. When a studio password is set, it asks for it first (the server checks it; two wrong tries lock that address out for a day). Press “🔗 Generate link”: a sheet shows the new link to copy or open. The corner shows how many links were made.
2. **Edit it.** Open the link: one just made opens ready to edit; otherwise press ✎ in the header. Whoever has the link can edit it for five days (the corner counts down: “Editing time left: 4 days 23 hours”), until it is finished. Every change saves itself a moment later; “Save” saves at once and shows the invitation as it will be seen (✎ goes on editing).
3. **Finish it.** “Finish for good” asks Yes / No (it can't be undone), then locks the link for good and shows it to send. The link stays the same; from then on nobody can edit it. After five days it locks by itself.

Edit mode edits every word right where it shows, in the same place, font and layout: there is no side panel or form, only a thin pink outline on what can be edited. Words on the page (the intro, the start button, a message in the invitation's own words) become editable where they are; words painted on the island (the question on the stone and its hearts, the wooden sign, the activity titles, the calendar's title, the map's title and places, and the love letter and signature on the keepsake book's right page) get an invisible box laid exactly over them, bent to the board's perspective (`core/homography.js`), and the island redraws them as you type. Only the words of the screen shown can be tapped (others may be hidden behind a tree). The signposts and the island's name are not edited, nor the book's left page (it shows the activity, date and place the visitor picks). One line ends with Enter; the stone, the sign and the letter take line breaks. A compact toolbar sits in its own strip above the page (it never covers it): Previous and Next step through the screens (the start, the question, the activities, the calendar, the map, the keepsake book), Save and Finish. On a phone Previous and Next are two big buttons in a strip of their own under the page, where a thumb reaches them, with the screen's name and a dot for each screen between them; the strip on top keeps Save and Finish. The screens go on from whatever is in view when ✎ is pressed. Save (and the demo's Finish) puts the visitor back where they were before the screens were stepped through: the clouds, the question's two hearts, or walking at the same spot. Who the visitor plays is chosen while editing only (⚙ → “🐰 Choose character”, or when the walk begins), and so is the Music Isle's song (⚙); a finished link has no chooser. Old links that carried their words in the address (`#c=…`) still open, view-only.

**Photos (optional).** While editing, each board picture (the three activities and the three places) and the keepsake book have a pink “📷 Add picture” button right on the picture (on the screens “Adventure”, “Map” and “Keepsake book”, where the toolbar says so too): put a photo of your own there, or ✕ to go back to the island's drawing. On the book's right page the photo becomes a polaroid above the letter, slightly tilted and taped, its frame the photo's own shape (wide, tall or square); the letter fits itself into the room left. A photo is made small on the phone before it is sent (at most 1280 px on its longest side, turned the way the camera held it) and saved as WebP, or JPEG where a browser can't make WebP; AVIF would be a little smaller, but no browser can make it and converting on the server would be slow. The server keeps one photo per place in R2 (`images/<id>/<name>-<w>x<h>.webp`, at most 2 MB, checked by its first bytes), deletes the one it replaces or removes, and serves them at `/api/images/…`. A page can't point a picture anywhere else.

After the dance at the keepsake book (and from ⚙ once all three are picked) a sheet offers the plan: a 1080×1920 picture (title, activity, date, place, the letter and the signature on a fixed pink design, no buttons in it) made as a PNG file and handed to the phone's share sheet, or saved where sharing files isn't supported; a text message opened in the phone's messaging app (`sms:` with `&body=` on iPhone and `?body=` elsewhere; nothing is sent by itself); and a calendar file (`.ics`, an all-day event) once the date is today or later (`app/plan.js`, `ui/plan-sheet.js`). The picture and the calendar file are made in the browser; nothing is uploaded. Choices and progress stay in the visitor's browser and are never sent anywhere.

## Deploy

Cloudflare Pages, one project for the site and its server together: the Vite build in `dist/` plus `functions/api/[[path]].js`, with the invitations in an R2 bucket. `wrangler.toml` holds the settings. **Deploy with `npm run deploy`** (`scripts/deploy-card.mjs` at the repository root): Pages looks upwards for its config and would find the root `wrangler.jsonc`, and it refuses `--config`, so the card is staged in an empty folder first:

```
npx wrangler r2 bucket create sent4u-petal-shares          # once
npm run deploy                                             # build + staged wrangler pages deploy
npx wrangler pages secret put STUDIO_PASSWORD --project-name sent4u-petal
```

`public/_headers` sets security headers and long-lived caching for the versioned assets. Variables (in `wrangler.toml`): `ORDERS_API_BASE` (the sent4u orders server) and `CORS_ORIGIN` (the sites that may save changes: `https://sent4u.link`, which shows the card through its gateway, and the card's own pages.dev address). Secrets: `STUDIO_PASSWORD` (the private studio at the card's own address; without it the studio makes no links) and, optionally, `SHARE_CREATE_SECRET`.

**Selling through sent4u.** When an order is paid, the orders server makes the id and gives the buyer `https://sent4u.link/?share=<id>`. The gateway asks the orders server which style the id belongs to and shows this card; the first time the link is opened, this server asks the orders server (`GET /links/<id>`, which must answer `{ ok: true, product: "petal" }`) and makes the invitation. The “Open live demo” link is `?share=test-petal` (`?share=test` too), a demo anyone can edit, kept only in that browser for a day (no server and no finishing). Its photos never leave the phone: a photo is made small there (960 px at most) and kept with the demo's words in the browser's own storage.

In development `npm run dev` answers `/api` itself (`vite.config.js`) with a bucket kept in `node_modules/.petal-isle/shares.json`; set `STUDIO_PASSWORD` in the environment to try the lock.

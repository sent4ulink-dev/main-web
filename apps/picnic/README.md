# Birthday web 1 — a 3D birthday picnic

A real-time 3D birthday gift in a storybook style: a picnic table under a big tree at twilight, with
string lights, polaroids, balloons, food and presents. The camera glides from one surprise to the next and
stops square in front of each one. The words float in the scene beside each object, with no boxes or
borders. The sky deepens from pink dusk to a starry night, and the evening ends with a fireworks show and
one last photo.

**Language:** Mongolian (Cyrillic). All text lives in `src/content.js` and the chapter strings in `src/story/story.js`.

**Chapters:** the letter → a little magic (a crystal ball writes the name in the stars, two lines for long
names) → wishes (glowing jar) → moments (big polaroids on a line) → our date (a Mongolian month calendar with
the day circled) → our song (cassette with a photo label, reels over the walkman's spindles) → blow out the
candles (the camera backs off for the sparkle-and-confetti celebration) → the wish (fireworks, and *Энэ агшныг
мөнхлөх*: the instant camera flies out to frame the whole table with the name in the stars, you press the
shutter in its viewfinder, and it prints an HD polaroid that develops as it floats to you).

**Save image:** a 1080×1920 phone-story PNG drawn in the browser — logo (or brand text) at the top, the photo
cropped square, who / when / from, and a short Mongolian line at the bottom. On phones it opens the share
sheet (`navigator.share` with the file); elsewhere it downloads. Set `share.logo` in `content.js` to draw your
own logo image.

## Links and editing (like the other 56 Moments WebCards)

| URL | What it is |
| --- | --- |
| `/` | Private studio: studio password → edit the card inline → **Save** → **🔗 Generate link** makes a `?share=<id>` link from that saved version. |
| `/?share=test` | Local demo on this device (browser storage only): edit, save, finish, **↺ Reset** resets it. Never touches the server. |
| `/?share=<id>` | A saved card. Its holder may edit for **5 days from the first visit**, then **Finish for good** (Yes/No) locks it for good; viewing always works. |

- **Inline editing** (`src/share/editor.js`): every word is edited where it is shown, in its own font and size, with a subtle dashed outline. Content fields use `data-k` (e.g. name, wishes, photo captions, the date); built-in labels are saved in `content.texts` by their original wording. The letter is edited through a text layer laid exactly over the 3D page, and the date opens the phone's date picker. The toolbar (Save · ‹ Previous · Next › · Finish for good) takes its own strip at the top and pushes the scene down, so it never covers anything. Edits repaint the envelope, letter, stars, polaroids and calendar live.
- **Server** (`server/api.js`, run by `functions/api/[[path]].js` on Cloudflare Pages; `edge/cardkit.js` is the shared WebCards toolkit): links are 32-character ids (192 random bits), saved as `shares/<id>.json` in the R2 bucket bound as `SHARES` (`birthday-shares`, see `wrangler.toml`). Studio sessions are signed tokens kept only in page memory; wrong passwords are rate limited; stale saves are refused (revisions); finishing is atomic and permanent. 56moments.com can sell links: `POST /api/invitations/<id>/ensure` (with `SHARE_CREATE_SECRET` sent as `x-card-create-secret`, or the store confirming the sale) and `DELETE` when it takes one back.
- **Cloudflare settings**: R2 bucket `birthday-shares` (binding `SHARES`) and `PUBLIC_ORIGIN` (the address used in generated links) are in `wrangler.toml`. Secrets on the Pages project (Settings → Variables and secrets): `STUDIO_PASSWORD` (required) and `SHARE_CREATE_SECRET` (the same value goes to the 56moments store when it sells this card).
- **Local**: `npm run dev` serves the same API with links in ignored `.sites-runtime/`; put `STUDIO_PASSWORD=...` in `.env.local`. `npm test` checks the studio, links, the five days, permanent finishing and the content rules.
- **Last-moment card**: the photo's story image (share sheet / PNG), **Мессежээр илгээх** (opens the SMS composer, never sends) and **Хуанлид нэмэх** (a yearly `.ics` birthday reminder).

## Personalise it
Everything you'd want to change is in **`src/content.js`**: name, sender, letter, the magic
lines, wishes, photo captions, special date, song title (and which photo goes on the cassette) and finale text.

**Photos:** put image files in `public/photos/` and set `src` in `content.js`, e.g.
`{ src: 'photos/beach.jpg', caption: 'Summer 2025' }`. Empty `src` = a painted placeholder.

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production files in dist/
npm run preview    # serve the production build
```
Upload the `dist/` folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
Paths are relative, so it also works from a sub-folder.

### Cloudflare Pages
The site is the Cloudflare Pages project **picnic-birthday**, connected to the GitHub repo and auto-deploying from `main` (build `npm run build`, output `dist`), at **https://picnic.56moments.com** — like the other 56 Moments WebCards. `wrangler.toml` holds the R2 binding and plain variables; cache headers are in `public/_headers`. Manual deploy (rarely needed):
```bash
npx wrangler login   # once, in the browser
npm run deploy       # build + upload dist/ to the "picnic-birthday" Pages project
```

Debug helpers: `?debug` exposes `window.__app`, `?q=0..3` forces a quality level,
`?ch=0..8` jumps straight to a chapter, `?cam=x,y,z,tx,ty,tz` sets the camera, `?orbit` enables orbit
controls, `?dpr=1` pins the pixel ratio. In dev, `window.__snap('name')` saves the current frame to
`art/snaps/name.jpg`. `window.__frame(n)` steps the loop by hand, which is useful in a background tab.

## How it's built
- **three.js r186** (WebGL 2) + **postprocessing** (bloom, depth of field, Khronos PBR Neutral tone mapping, vignette, grain), **GSAP** for animation (ticked from the render loop so tweens and frames stay in sync).
- **Floating text, no UI boxes:** each chapter's words are anchored to a point in 3D and re-projected every frame (`src/ui/ui.js`), so they drift with the camera beside the object they describe. Close-ups are composed with the object left of centre so the words have room; on portrait screens they sit underneath.
- **Storybook look:** every surface uses toon shading: a soft 3-band ramp, a pink fresnel rim and ink outlines (inverted hulls with smoothed normals). Shared code is in `src/style/toon.js`.
- **Painted sky, no HDRI:** a gradient-dome shader with a pink sunset glow and twinkling stars. Soft clouds modelled in Blender sit in front of it. Hemisphere and key lights plus warm string-light glow light the scene, and a small environment map for the glass and balloons is rendered from the same painted sky.
- **One wind for everything:** a shared wind system sways the grass, the tree, the flowers, the gingham tablecloth hem, balloons and polaroids. It also drives the volume of the wind recording, so the gust you see is the gust you hear.
- **Made in Blender:** Python scripts build all the table food and presents (`art/blender/scripts/stylized_food.py`): bread basket with grapes, lattice cherry pie, layered cake, berries, cheese, sausage board, olives, dip, wine, potted plant and wrapped gifts. They also build the forest of pines, round trees and flowering bushes, plus the clouds (`stylized_nature.py`), and the instant camera, crystal-ball stand and magic wand (`stylized_props.py`). Run `blender -b --factory-startup --python <script> -- out.glb preview.png`, then `npm run assets:models`.
- **Poly Haven (CC0):** the picnic table, the big tree (thinned from 1M to ~180k triangles in Blender, `tree_hero.py`), the stump and the cassette player. Toon shading is applied in the browser.
- **Audio:** CC0 field recordings (birds, wind) loop seamlessly with crossfades; CC0 recorded fireworks arrive late by the speed of sound (343 m/s) and are panned by direction; crickets, music box, paper, shutter and sparkles are synthesised live with the Web Audio API. The microphone (optional) only measures breath loudness to blow out the candles — nothing is recorded.
- **Smooth on any GPU:** adaptive quality (4 levels: resolution, MSAA, depth of field, grass density, shadow size) that steps down when frames run long and up when there's headroom; shadows refresh at 30 Hz; all shaders pre-compiled before the intro; no transmission materials (they would double the render cost).

## Asset pipeline (already done — only needed to rebuild assets)
```bash
npm run assets:fetch    # download the 5 CC0 models from Poly Haven → art/downloads/
npm run assets:models   # glTF + Blender exports → web .glb (WebP textures, meshopt)
npm run assets:audio    # trim/encode CC0 recordings → MP3
node scripts/build-credits.mjs   # regenerate CREDITS.md + in-app credits
```
Sounds (OpenGameArt) were downloaded manually into `art/downloads/audio/` — see CREDITS.md for links.

## Credits
All assets are CC0 / public domain / open licence — no copyrighted material. Full list with every creator in
**[CREDITS.md](CREDITS.md)** and in the in-app ⓘ panel.

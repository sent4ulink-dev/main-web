# sent4u — main web

The marketing site for sent4u: a static page (no framework, no bundler) plus a small Cloudflare Worker that keeps the reviews and the claimed link names in an R2 bucket.

```
index.html  style.css  script.js  finale.js  earth-scene.js  viewport.js   the site
vendor/                                                        Three.js, Anime.js and Lenis, copied in (no install needed to run the site)
assets/                                                        the land outlines, the font, the 3D models, reviews.json
worker/                                                        the Cloudflare Worker (reviews + "claim your link"); see worker/README.md
scripts/build.mjs                                              copies just the site into dist/ for Pages
```

## Run it locally

```bash
npm run dev        # serves the folder at http://localhost:4173
npm test           # the Worker's tests (they need no Cloudflare account)
```

## Deploy

**The site → Cloudflare (Workers & Pages).** Connect this repository in the dashboard, then set:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

The root `wrangler.jsonc` tells `wrangler deploy` to publish the `dist/` folder, which holds only what the browser needs, so `worker/` and the notes are never served. (If you use a classic Pages project instead, set the build output directory to `dist` and leave the deploy command empty.)

**The reviews and claims → the Worker.** Follow [worker/README.md](worker/README.md) (about 10 minutes: create the R2 bucket, set two secrets, `wrangler deploy`). Then:

1. In `worker/wrangler.toml`, put the real address of the site in `ALLOWED_ORIGINS` (for example `https://sent4u.link`) and deploy the Worker again.
2. In `index.html`, on the `<section class="section reviews" …>` tag, set `data-api` to the Worker's address (`https://sent4u-reviews.<you>.workers.dev`). The "claim your link" box in the last section uses the same address.
3. Push. Pages rebuilds the site.

Until `data-api` is set, reviews come from `assets/data/reviews.json` and claiming is a demo that lives in the visitor's own browser.

## Credits

- [Three.js](https://threejs.org), [Anime.js](https://animejs.com) and [Lenis](https://lenis.darkroom.engineering): MIT licensed, copied into `vendor/`.
- "Satellite" and "Paper airplane" 3D models by Poly by Google, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/), via [poly.pizza](https://poly.pizza).
- Land outlines: [Natural Earth](https://www.naturalearthdata.com), public domain.
- The LCD font in `assets/fonts` is from the Pixel product's own site.

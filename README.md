# sent4u — main web

The marketing site for sent4u: a static page (no framework, no bundler) plus a small Cloudflare Worker that keeps the reviews and the claimed link names in an R2 bucket, plus a gateway Worker that makes every invitation link — for all three apps — live at `sent4u.link/?share=<id>`, with no separate domain per app.

```
index.html  style.css  script.js  finale.js  earth-scene.js  viewport.js  tilt.js   the site
vendor/                                                        Three.js, Anime.js and Lenis, copied in (no install needed to run the site)
assets/                                                        the land outlines, the font, the 3D models, reviews.json
worker/                                                        the Cloudflare Worker (reviews + orders + "claim your link"); see worker/README.md
gateway/index.js                                                the Worker script behind sent4u.link itself — routes ?share=<id> to the right app
apps/{pixel,pinky,winxp}/                                       the three apps sold as invitation links; each has its own README
scripts/build.mjs                                              copies just the site into dist/ for Pages
```

## The gateway

`sent4u.link/?share=<id>` always looks the same, no matter which of the three apps the id belongs to. `gateway/index.js` (deployed as part of this same `main-web` Worker, via `wrangler.jsonc`'s `main`) decides which app that is and reverse-proxies the request there, so that app's real hosting URL never appears in the address bar. Everything else — the marketing site, reviews, pricing — is served straight from this Worker's own static assets, unchanged.

- `test-pixel`, `test-pinky`, `test-winxp` are reserved demo ids — the three "Open live demo" links on the marketing site use them. They resolve locally, no network call.
- Any other id is looked up with the orders Worker's `GET /links/:id` (see `worker/`) to find out which product it's for. A real id only resolves once it's actually been paid for.

Wire it up once each app is deployed by setting, in `wrangler.jsonc`'s `vars` (or the Cloudflare dashboard): `PIXEL_ORIGIN`, `PINKY_ORIGIN`, `WINXP_ORIGIN` (each app's real deployed origin) and `ORDERS_API_BASE` (the orders Worker's address). Until an app's origin is set, its share links just fall through to the marketing site instead of erroring — so this Worker can be deployed before every app is live, and each app can go live independently.

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

**The reviews and the orders → the Worker.** Follow [worker/README.md](worker/README.md) (about 10 minutes: create the R2 bucket, set the secrets, `wrangler deploy`). It also runs selling the links ($1.99 for 1, $9.99 for 8): the section "Orders" there says how to connect your payment provider. Then:

1. In `worker/wrangler.toml`, put the real address of the site in `ALLOWED_ORIGINS` (for example `https://sent4u.link`) and deploy the Worker again.
2. In `index.html`, set `data-api` to the Worker's address (`https://sent4u-reviews.<you>.workers.dev`) on the `<section class="section reviews" …>` tag and on the pricing section (`id="pricing"`; it falls back to the reviews one if left empty).
3. Push. Pages rebuilds the site.

Until `data-api` is set, reviews come from `assets/data/reviews.json` and buying is a demo that lives in the visitor's own browser (nothing is charged, and the links it makes are placeholders).

## Credits

- [Three.js](https://threejs.org), [Anime.js](https://animejs.com) and [Lenis](https://lenis.darkroom.engineering): MIT licensed, copied into `vendor/`.
- "Satellite" and "Paper airplane" 3D models by Poly by Google, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/), via [poly.pizza](https://poly.pizza).
- Land outlines: [Natural Earth](https://www.naturalearthdata.com), public domain.
- The LCD font in `assets/fonts` is from the Pixel product's own site.

# Pinky — neon, after dark

A black-stage, neon-glow date invitation: a glowing pink speech bubble and a big, dramatic Yes/No split screen. React + TypeScript + Vite frontend; a Cloudflare Worker backend.

## Run

```sh
npm install
npm run dev          # frontend at http://localhost:3000, proxies /api to the local Worker
npm run worker:dev    # the Worker itself, at http://localhost:8787 (wrangler simulates R2 locally, no Cloudflare account needed)
```

Open `http://localhost:3000/?share=test` for the public demo (entirely browser-local, no backend calls). A bare `http://localhost:3000/` has nothing to show — a real invitation only exists once it's been paid for; see below.

## Cloudflare Pages

Connect this repository to a Pages project, build command `npm run build`, output directory `dist`. Set `VITE_API_BASE_URL` to the Worker's deployed origin (see below) — this value is public build-time configuration.

## Share API

The API is a Cloudflare Worker, in `worker/` (its own `wrangler.toml`, separate from the frontend's Pages deployment above). It exposes `GET /health`, `POST /api/shares/:id/ensure`, `GET/PUT /api/shares/:id`, `POST /api/shares/:id/finalize`, and `GET /api/maps/resolve` + `GET /api/maps/photo` (the "Fetch from Maps" feature). Deploy with `npm run worker:deploy`.

There is no public studio and no password: a real invitation is created lazily, the first time its link is opened, by self-healing against the sent4u orders Worker's `GET /links/:id` (see `ORDERS_API_BASE` in `worker/wrangler.toml`) — that confirms the id was really paid for and is really for Pinky before creating anything. `POST /api/shares/:id/ensure` exists for a future direct-provisioning call and is gated by the shared secret `SHARE_CREATE_SECRET` (`npx wrangler secret put SHARE_CREATE_SECRET` from inside `worker/`); nothing calls it today. Whoever holds a share URL can edit or finalize it within its edit window — the link itself is the credential.

Each invitation is stored as its own object in a private R2 bucket (`shares/<id>`, created once with `npx wrangler r2 bucket create pinky-shares`), read and written through the native R2 binding — never exposed to the browser.

Sharing modes use query parameters only: a bare visit shows nothing, `/?share=test` is the browser-local public demo, and `/?share=<id>` loads a persisted invitation. A real invitation remains editable for five days unless it's finalized first.

### "Fetch from Maps"

Optional. Set `GOOGLE_PLACES_API_KEY` (`npx wrangler secret put GOOGLE_PLACES_API_KEY`) to a Google Cloud API key with the Places API enabled, and the Restaurant editor's "Fetch from Maps" button resolves a pasted Google Maps link to that place's name, rating, hours and photo. The key never reaches the browser — `/api/maps/resolve` does the lookup server-side, and `/api/maps/photo` proxies the photo itself. Leave it unset to disable the feature; the manual fields still work.

### CORS

Set `CORS_ORIGIN` in `worker/wrangler.toml` to the frontend's exact deployed origin (e.g. `https://sent4u.link`), no trailing slash. Empty allows any origin, which is fine for local dev.

## Check

```sh
npm run lint    # tsc --noEmit
npm test        # vitest — component tests plus worker/test for the Worker's share API and self-heal
npm run build
```

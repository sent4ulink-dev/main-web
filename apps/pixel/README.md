# A little signal, a little love

A responsive monochrome LCD date invitation. Original canvas artwork, a guarded scene reducer, recorded Nokia effects and an original synthesized celebration, and a grid-based Love Snake game. Media is bundled and served locally. The bundled VT323 font is licensed under the SIL Open Font License (see `public/fonts/OFL.txt`).

## Run

`npm install` then `npm run dev`. Production build: `npm run build`.

## Cloudflare Pages

Connect this repository to the `pixel-dom` Pages project and use `npm run build` as the build command. The tracked `wrangler.jsonc` selects `dist/pages` as the output directory. The build produces a standalone client-rendered `index.html`, so the Pages root URL works without a server function.

Set `VITE_API_BASE_URL` to the API origin. This value is public configuration.

## Share API

The API is a Cloudflare Worker, in `worker/` (its own `wrangler.toml`, separate from the frontend's Pages deployment above). It exposes `POST /shares/:id/ensure`, `GET/PUT /shares/:id`, `POST /shares/:id/finalize`, and `GET /health`. Run it locally with `npm run worker:dev` (wrangler simulates R2 locally, no Cloudflare account needed for that); deploy with `npm run worker:deploy`.

There is no public studio and no password: a real invitation is created lazily, the first time its link is opened, by self-healing against the sent4u orders Worker's `GET /links/:id` (see `ORDERS_API_BASE` in `worker/wrangler.toml`) — that confirms the id was really paid for and is really for Pixel before creating anything. `POST /shares/:id/ensure` exists for a future direct-provisioning call and is gated by the shared secret `SHARE_CREATE_SECRET` (`npx wrangler secret put SHARE_CREATE_SECRET` from inside `worker/`); nothing calls it today. Whoever holds a share URL can edit or finalize it within its edit window — the link itself is the credential.

Each invitation is stored as its own object in a private R2 bucket (`shares/<id>.json`, created once with `npx wrangler r2 bucket create pixel-shares`), read and written through the native R2 binding — never exposed to the browser.

Sharing modes use query parameters only: a bare visit shows a "this link doesn't look right" screen, `/?share=test` is the browser-local public demo, and `/?share=<id>` loads a persisted invitation. A real invitation remains editable for five days unless it's finalized first.

## Personalize

Edit `lib/date-config.ts` to customize activities, suggested places, the message sender, default time, and date duration. After collecting seven hearts, visitors choose an activity, a future day and time, and a suggested or custom venue. Their picks populate both the Nokia inbox message and the `.ics` calendar download. Times use the visitor's local timezone. Choices remain in the current page session; they are not sent as a real SMS or submitted to a server.

## Play

Arrow keys / WASD, swipe on the board, or use the directional pad. Collect seven hearts to unlock the date pickers. Edges wrap. Space (with the board focused) or Escape pauses. Switching away pauses automatically. A self-collision offers a fresh retry. Snake is mandatory and has no skip action or shortcut to the pickers.

## Check

`node --test tests/core.test.mjs` (Node 24+) checks state transitions, repeated actions, playful No replies, mandatory game completion, picker validation, back navigation, message consistency, Snake mechanics, and calendar serialization. `npx tsc --noEmit` checks types. Lint excludes the unmodified vendored UI catalog.

Motion follows `prefers-reduced-motion`; audio starts muted. Only the boot-seen flag is stored for this browser session. The invitation response is not transmitted or persisted.

## September 2026 update

The UI and screen-reader labels are in English. `Love LCD` extends the OFL-licensed VT323 base with original pixel-grid glyphs; its generated WOFF2/TTF and reproducible source live in `public/fonts` and `scripts/build_pixel_font.py`. The logo is a plain "sent4u" wordmark set in this font.

Calendar navigation is controlled explicitly. Time choices use 15-minute intervals and exclude elapsed times, refreshing every 15 seconds and on window focus. Clicking an already selected activity, day, or place confirms that step; a high-contrast confirmation button remains available. Framed opaque panels protect text from scenery. Snake touch targets are 64 × 64 CSS pixels.

Sound starts muted. The SMS recording is identified by its uploader as a Nokia 3310. The keypad recording is a documented Nokia 6820 fallback, **not verified as a 3310 sound**. See `public/audio/CREDITS.txt` for sources and CC BY attribution. Celebration uses an original roughly three-second synthesized melody. All fonts, logo and audio files are served from this site; no third-party audio requests occur in the visitor's browser.

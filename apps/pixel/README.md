# A little signal, a little love

A responsive monochrome LCD date invitation. Original canvas artwork, a guarded scene reducer, recorded Nokia effects and an original synthesized celebration, and a grid-based Love Snake game. Media is bundled and served locally. The bundled VT323 font is licensed under the SIL Open Font License (see `public/fonts/OFL.txt`).

## Run

`npm install` then `npm run dev`. Production build: `npm run build`.

## Cloudflare Pages

Connect this repository to the `pixel-dom` Pages project and use `npm run build` as the build command. The tracked `wrangler.jsonc` selects `dist/pages` as the output directory. The build produces a standalone client-rendered `index.html`, so the Pages root URL works without a server function.

Set `VITE_API_BASE_URL` to the API origin. This value is public configuration.

## Share API

Deploy the included `render.yaml` as a Render Blueprint. The API exposes `POST /shares/:id/ensure`, `GET/PUT /shares/:id`, `POST /shares/:id/finalize`, and `GET /health`.

There is no public studio and no password: an invitation only ever comes into existence because the sent4u order Worker calls `POST /shares/:id/ensure` server-to-server the moment it's paid for, gated by the shared secret `SHARE_CREATE_SECRET`. Whoever holds the resulting share URL can edit or finalize it within its edit window — the link itself is the credential.

The API stores records in `server/data/shares.json` by default. For durable production storage, create a private Cloudflare R2 bucket and set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` on Render. Each invitation is stored privately as `shares/<id>.json`; the bucket is never exposed to the browser.

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

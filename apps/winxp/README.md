# Heart Desktop ♡

A complete romantic invitation in an original early-2000s desktop. React + TypeScript + Vite frontend; Node + Express backend. Story text is in English. The landscape and SVG icons are original. The startup image was supplied by the user. Archived Microsoft Windows XP WAV sounds are included locally with source records in `public/sounds/sources.json`; see `public/ASSETS.md`.

## Local development

Use Node 22.12+ and npm. From this directory:

```sh
npm ci
cp .env.example .env
```

There is no public studio and no password: an invitation only ever comes into existence because the sent4u order Worker calls `POST /shares/:id/ensure` server-to-server, gated by a shared secret. Set that secret as `SHARE_CREATE_SECRET` in `.env` (leave unset in local dev for an open, unsecured `/ensure`), then use two terminals:

```sh
npm run server
npm run dev
```

Open `http://127.0.0.1:5173/?share=test` for the public demo. A bare `http://127.0.0.1:5173/` has nothing to show, since no real invitation exists yet — mint one first with `curl -X POST http://127.0.0.1:3001/shares/<id>/ensure -H "x-date-create-secret: <your secret>"`, then open `http://127.0.0.1:5173/?share=<id>`. Opening `index.html` as a file does not run the application. Vite proxies API calls to port 3001; `DEV_API_TARGET` can override this locally. No `.env` file is committed.

The demo makes **no backend requests**, including image uploads. It saves edited story content only when Save is clicked, using a separate `localStorage` key. Start → Reset demonstration restores the sample content and restarts the experience. Generated demo images use native file sharing or a local download. The sound preference is also local. Browser storage must be available for demo persistence.

## Using the invitation

There is no public studio: a real invitation only ever exists because it was paid for, and whoever holds its share URL can edit or finalize it within its edit window — the link itself is the credential, same trust model as Pinky and Pixel. Choose Edit Invitation from Start, then edit text directly where it appears inside the invitation. Editable text keeps its existing typography and layout with only a dotted outline. The compact toolbar provides Save, Previous screen, Next screen, and Permanently finish editing. It occupies its own row above the desktop only while editing, including on phones. Outside editing mode the desktop has no extra top bar. The Start menu contains Edit Invitation and Finish edit, with the remaining five-day edit time above them; the demo also has Reset demonstration. Editor navigation is separate from the recipient state machine and does not bypass the game. URL navigation remounts the selected mode, clearing in-memory access and the previous mode's invitation state. Empty, malformed and unknown share IDs remain unavailable invitations rather than falling back to the demo.

Save in a real share writes the whole validated content object and returns to preview without closing editing access. Real links remain editable for five days, then become read-only. Permanently Finish Editing requires confirmation, saves and irreversibly finalizes the link on the backend. In the demo it saves locally and returns to preview, with reset and editing still available from Start.

Recipients must click Yes and find all five hearts in Heart Sweeper. The first tile always contains a heart; numbers count adjacent hearts. Wrong tiles display harmless dialogs. A repeated click on the selected activity, date (with valid time), or place confirms the choice. Confirm buttons provide an alternative. Back preserves scheduling choices; changing activity clears the old place. Dates and times are checked in the visitor's local timezone, including confirmation-time validation.

The final confirmed plan is a snapshot shared by the keepsake, calendar, SMS text and image renderer. Its messenger-style card includes a framed emoticon, separate plan-detail rows, and a yellow note bubble. In editing mode, choose from six original glossy emoticons directly inside the card. Save persists the choice; recipients see the selected face without the picker, and the same face appears in the exported PNG. Older invitations default to the love face. Clicking the face opens Love Assistant. The complete plan and all four actions fit the available phone height. Calendar files use the confirmed local start time and a two-hour end time; the action disables after that date and time passes. The `.ics` generator escapes special characters and folds at 75 UTF-8 octets. SMS uses the platform-appropriate iOS or Android URL and opens a populated composer without sending anything.

The Canvas renderer waits for fonts and the fixed local background, then produces a real 1080×1920 PNG `File`. Its portrait card contains only the confirmed title, activity, date, time, place, and message—never editor controls or temporary interface text. Native file sharing is attempted first. If file sharing is unavailable, the PNG downloads automatically. The image is never uploaded and no temporary image URL is created. iOS/Android share-sheet and SMS behavior still depends on the device.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm run check` runs all checks in order. To use an already installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome`. Browser tests start isolated servers on ports 5174 and 3002 with an in-memory test database. They never touch the development shares. The test fulfillment secret is a fixture only and is not included in the frontend bundle.

Coverage includes the story gate, duplicate events, game solvability, date validation, exports, strict content validation, the fulfillment secret, self-heal against the order Worker, create/read/update/finalize, async JSON failures and atomic storage. Browser checks complete the flow at 320×568, 375×667, 390×844, 430×932, 768×1024, 1366×768 and 1920×1080; they check overflow, editor spacing, calendar navigation, image dimensions, local-only demo persistence, and that a finalized real invitation stays viewable but never editable again. Screenshots go to `artifacts/screenshots`; failed traces and the HTML report go to `test-results` and `playwright-report`.

## Frontend — Cloudflare Pages

Connect the repository to Cloudflare Pages. Use:

- Build command: `npm ci --include=dev && npm run build`
- Output directory: `dist`
- Node version: 22.12 or newer
- `VITE_API_BASE_URL=https://your-render-service.onrender.com`

This frontend value is public build-time configuration. **Never put `SHARE_CREATE_SECRET`, R2 keys, or any secret in Vite or Cloudflare Pages variables.** Redeploy Pages whenever a Vite variable changes. `public/_headers` supplies basic security headers and `public/_redirects` supports the SPA. The only sharing format is `/?share=<id>`.

## Backend — Render

`render.yaml` is a Blueprint for one Node web service. Alternatively create a Web Service manually:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/health`
- `SHARE_CREATE_SECRET`: shared secret matching the sent4u order Worker; gates `POST /shares/:id/ensure`
- `ORDERS_API_BASE`: the order Worker's origin, used to self-heal a share that isn't in storage yet
- `CORS_ALLOWED_ORIGINS`: exact frontend origins separated by commas; no trailing slash
- `PHOTO_TTL_MINUTES`: optional, defaults to 15, clamped to 1–60
- `DATA_FILE`: optional local storage path
- Use Render's supplied `PORT`

Deploy the API first, copy its HTTPS URL into the Pages Vite configuration, deploy Pages, then set its actual origin in Render's CORS configuration and redeploy the API. The API can be built before the frontend origin is known; browser access will be rejected until CORS is configured correctly.

The JSON fallback writes atomically and creates a missing file. Invalid existing storage is preserved and produces a structured error rather than being overwritten. The Blueprint attaches a 1 GB persistent disk at `/var/data` and sets `DATA_FILE=/var/data/shares.json`. For an existing manually configured Render service, attach that disk and set the variable yourself, or configure R2. Committing the Blueprint does not attach a disk to a service created outside a Blueprint. Render's ordinary filesystem is ephemeral; do not rely on it for lasting invitations.

## Cloudflare R2

Create a private bucket and an R2 API token with Object Read & Write access scoped to that bucket. Set these **on Render only**:

```text
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket
```

All four must be present, or none. The S3-compatible adapter stores each share as `shares/<id>.json`, validates loaded objects, and paginates aggregate listing. Keep the bucket private; all public access is through the API. The Blueprint lists R2 fields because R2 is recommended; omit all four when using a persistent local disk.

## API

| Endpoint                    | Behavior                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /shares/:id/ensure`   | Requires header `x-date-create-secret: <SHARE_CREATE_SECRET>`; creates the share at that id if it doesn't already exist, never overwrites |
| `GET /shares/:id`           | Returns public share content and edit metadata; self-heals against the order Worker on a miss      |
| `PUT /shares/:id`           | Replaces validated content only during editing window                                              |
| `POST /shares/:id/finalize` | Permanently finalizes only during editing window                                                   |
| `POST /photos`              | `image/png`, maximum 5 MiB; validates signature, dimensions, chunks, CRC and bounded decompression |
| `GET /photos/:id`           | Temporary PNG; expired/missing images return structured JSON                                       |

All responses use string `status` discriminants. Invalid content/IDs return 400, forbidden `/ensure` calls 403, missing shares 404, finalized edits 409, expired edits 410, excessive requests 429 and unexpected failures 500. The API uses async error wrappers and a JSON error handler. There is no public, unauthenticated "create a share" endpoint: the id itself is chosen by the sent4u order Worker at checkout time, and `/ensure` only ever creates a share at that exact id.

## Security and operational limits

- `SHARE_CREATE_SECRET` is compared only on the server via a direct header check, and gates `/ensure` alone. It is never sent to or checked by the browser; the frontend has no password or unlock flow at all.
- `trust proxy` is exactly `1`, intended for Render's single trusted reverse-proxy hop (used by the photo-upload throttle). Configure the deployment so clients cannot bypass that hop. If the hosting topology changes, reassess IP trust before deployment.
- Possession of a real share URL intentionally grants editing during the open window — the URL is a capability, not a secondary secret. Do not post editable invitations publicly.
- Local JSON and R2 mutations are serialized within **one API process** so finalization and update requests cannot race. Run a single Render instance. Horizontal scaling requires distributed conditional writes/locking; the current storage contract does not provide those.
- Upload throttling and temporary images are in memory. They reset on process restart. Durable state would be needed for multiple instances.
- Temporary images expire automatically, have a 64 MiB total memory limit, and are limited to six uploads per IP per minute. Photos and demo data never count as invitations. Generated image links can stop working early after server restarts.
- Content has strict schemas, per-field limits, list limits and a 32 KB serialized limit. Unknown keys are rejected. React renders text without raw HTML. There are no import/export draft controls.
- The system does not automatically send messages, make reservations, or persist recipient selections to the share backend. Reloading a recipient link restarts their invitation. Shared content persists through JSON/R2; recipient choices stay in memory.
- Live Render, Cloudflare Pages, R2 credentials, CORS against the real domain, and physical-device share sheets require deployment-account access and are not configured by local testing.
- Optional WebMCP tools expose read-back and calendar download for an already confirmed plan. They are feature-detected and cannot bypass the invitation. Native WebMCP integration was not verified because this local browser test environment does not provide that proposed API.

## Desktop apps

Double-click or double-tap a desktop icon (or press Enter while focused) to open its app. The pulsing envelope opens the invitation. Music replaces Our Memories; Notes opens Notepad. The desktop contains My Computer, My Documents, Music, Notes, and the invitation; Internet Explorer and Recycle Bin are intentionally omitted. Minimize keeps any app in the taskbar. Close removes Music, Notes, folders, Mail, and the final plan from the taskbar. The main invitation stays there so its Yes/No, game, and activity progress cannot be lost. Maximize fills the available workspace; Restore returns its original size.

Choose **Edit Invitation** from Start, then open Music or Notes. The Music player accepts a YouTube video URL and provides **Save & Play**. Notes text is edited directly on its paper surface and saved with the compact toolbar. YouTube runs as audio through the media player's Play, Stop, Restart, and Mute controls; the video picture is hidden behind the ribbon visualization. An external YouTube link remains available if an owner disables embedding. Empty music links use the original synthesized melody. The media player's left navigation remains visible on phone screens.

The XP startup screen appears on reload. Its sound starts at the first pointer interaction to comply with browser audio restrictions. All interface and exported image text requests Tahoma, with Arial/sans-serif fallback on devices where Tahoma is not installed. No font binary is redistributed.

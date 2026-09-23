# Deploying Urilga on Render

Two services, both on Render:

1. **`urilga-api`** — a Web Service running the Express server (`server/index.js`). Stores every `?share=id` you generate.
2. **`urilga-frontend`** — a Static Site running the built React app (`dist/`).

Every URL in this app is just `/` with a `?share=xyz` query string (never a real path), so there's no SPA rewrite rule to configure — a plain static file host works as-is.

Deploy the API first (you need its URL for the frontend's env var), then the frontend, then circle back and set `CORS_ORIGIN` on the API.

---

## 1. Deploy the API (`urilga-api`)

The repo already has a `render.yaml` Blueprint for this service, so the easiest path:

1. On [dashboard.render.com](https://dashboard.render.com), click **New → Blueprint**.
2. Connect the `Gabbi1114/date` repo. Render reads `render.yaml` and proposes the `urilga-api` service with its persistent disk already configured.
3. It'll ask you to fill in the env vars marked `sync: false` before the first deploy:
   - **`CORS_ORIGIN`** — leave a placeholder like `https://placeholder.onrender.com` for now (you'll fix this in step 3, once the frontend's real URL exists).
   - **`GOOGLE_PLACES_API_KEY`** — optional, only needed for the "Fetch from Maps" button. Leave blank to skip that feature.
   - **`STUDIO_PASSWORD`** — optional, see "Setting the studio password" below. Leave blank if you don't want the lock screen yet.
4. Deploy. Once it's live, copy its URL — something like `https://urilga-api.onrender.com`. You'll need it in step 2.

**Don't skip the disk.** `render.yaml` already mounts a 1GB persistent disk at `server/data` — without it, Render's filesystem is wiped on every redeploy/restart and every share link you've ever generated disappears. If you ever create this service manually instead of via the Blueprint, add the disk yourself (Render dashboard → the service → **Disks** → mount path `/opt/render/project/src/server/data`).

No manual build/start commands needed if you use the Blueprint — they're in `render.yaml` (`npm install` / `node server/index.js`).

---

## 2. Deploy the frontend (`urilga-frontend`)

This one isn't in `render.yaml` (static-site Blueprint syntax varies enough across Render's docs that manual setup is more reliable than a YAML you can't preview) — create it by hand:

1. **New → Static Site**, connect the same repo.
2. **Build Command:** `npm install && npm run build`
3. **Publish Directory:** `dist`
4. **Environment Variables:**
   - **`VITE_API_BASE_URL`** — the API URL from step 1, e.g. `https://urilga-api.onrender.com` (no trailing slash).
   - **`VITE_STUDIO_LOCK_ENABLED`** — set to `true` if you set `STUDIO_PASSWORD` on the API in step 1. This one isn't secret (it's just a UI flag, not the password itself) — see "Setting the studio password" below.
5. Deploy. Copy this service's URL too, e.g. `https://urilga-frontend.onrender.com` (or attach your own custom domain in the service's **Settings**).

---

## 3. Close the loop: set `CORS_ORIGIN`

Back on the **`urilga-api`** service → **Environment** → set `CORS_ORIGIN` to the frontend's *exact* origin from step 2 (e.g. `https://urilga-frontend.onrender.com`, or your custom domain if you attached one) — no path, no trailing slash. Save; Render redeploys the API automatically. Without this, the browser will block the frontend's requests to the API.

---

## Setting the studio password (lock screen)

The bare studio (`https://your-frontend-url/`, no `?share=` param) is gated by a password — anyone you actually send a `?share=id` link to never sees this gate, only you editing from a fresh browser does.

The password is checked **server-side only**: set `STUDIO_PASSWORD` on the **API** service (`urilga-api`) to whatever password you want, in plain text. The frontend posts your typed attempt to `/api/studio/unlock` and only gets a yes/no answer back — the actual password never ships inside the built JS bundle, so nobody can read it via dev tools or the page source (an earlier version of this compared a `VITE_`-prefixed var client-side, which did ship the real password in plain text; don't go back to that).

Also set `VITE_STUDIO_LOCK_ENABLED` to `true` on the **frontend** service — this just tells the UI to show the lock screen at all before it even asks the server anything; it isn't secret itself. Without it, the studio renders unlocked directly (the default, so local dev doesn't need a password configured to work).

Once you unlock it from a browser, it stays unlocked on that device (stored in `localStorage`) — you won't need to re-enter it every visit.

Leaving `STUDIO_PASSWORD` unset disables the lock server-side too (the unlock endpoint just always rejects), regardless of the frontend flag.

**Env vars only take effect on the *next build/deploy*** — if you add or change either of these after a service has already deployed once, trigger a fresh deploy on that service (Render redeploys `STUDIO_PASSWORD` changes on the API automatically since it's read at request time; but `VITE_STUDIO_LOCK_ENABLED` on the frontend needs **Manual Deploy → Deploy latest commit**, since Vite bakes it in at build time).

---

## Storing shares in Cloudflare R2

By default every generated `?share=id` is stored in one JSON file on the API's Render disk. Set these four env vars on the **`urilga-api`** service and it switches to Cloudflare R2 instead — **one object per share** (`shares/<id>.json`), so you can open the bucket in the Cloudflare dashboard and see every link you've ever generated as its own file. Leave any of the four unset and it silently falls back to the disk file — nothing breaks either way, including local dev.

1. **Create the bucket**: Cloudflare dashboard → **R2** → **Create bucket** → name it (e.g. `urilga-shares`) → Create.
2. **Get your Account ID**: still on the R2 Overview page, it's shown in the right-hand panel (a long hex string) — copy it.
3. **Create an API token**: R2 → **Manage R2 API Tokens** → **Create API Token**. Set:
   - **Permissions**: Object Read & Write
   - **Specify bucket(s)**: just the one you made (don't grant account-wide access)
   - Create it, then copy the **Access Key ID** and **Secret Access Key** it shows you — the secret is shown exactly once; if you lose it you'll need to create a new token.
4. On the **`urilga-api`** Render service → **Environment**, add:
   - `R2_ACCOUNT_ID` — from step 2
   - `R2_BUCKET_NAME` — the bucket name from step 1
   - `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — from step 3
5. Save — Render redeploys the API automatically. Check its **Logs** tab for the startup line: `Share storage: R2 (bucket "urilga-shares")` confirms it took.

Any shares already sitting in the old disk file stay there — they aren't auto-migrated. New shares created after this point go to R2; old links keep working exactly the same (the API doesn't care where a given share is stored), they just won't show up in the bucket. If you want everything in one place, regenerate links for anything still active after switching over.

Once R2 is confirmed working, the Render disk is no longer doing anything for new shares — you can leave it (harmless) or remove it from the service's **Disks** tab if you'd rather not pay for it.

---

## Quick reference: all env vars

| Var | Where | Required | Purpose |
|---|---|---|---|
| `CORS_ORIGIN` | API service | Yes | Only this origin may call the API |
| `GOOGLE_PLACES_API_KEY` | API service | No | Powers "Fetch from Maps" in the Restaurant editor |
| `STUDIO_PASSWORD` | API service | No | The actual studio password, checked server-side |
| `R2_ACCOUNT_ID` | API service | No | Cloudflare R2 storage for shares (all 4 R2_* vars together) |
| `R2_BUCKET_NAME` | API service | No | ″ |
| `R2_ACCESS_KEY_ID` | API service | No | ″ |
| `R2_SECRET_ACCESS_KEY` | API service | No | ″ |
| `VITE_API_BASE_URL` | Frontend service | Yes | Where the frontend sends share reads/writes |
| `VITE_STUDIO_LOCK_ENABLED` | Frontend service | No | UI flag: show the lock screen at all (not secret) |

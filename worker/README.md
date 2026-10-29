# sent4u reviews — Cloudflare Worker + R2

Anyone can leave a review on the site and it is on the wall straight away. There is no approval step.
The reviews live in a Cloudflare **R2** bucket; this Worker is the small server in front of it.

```
GET    /reviews        the public list, newest first (max 100)
POST   /reviews        add a review
DELETE /reviews/:id    remove one (you only)

GET    /claims/:name   is this link name free?   ->  { "available": true }
POST   /claims         reserve a link name for the "Claim your link" box at the bottom of the site
DELETE /claims/:name   free a name again (you only)
```

The same Worker also runs the "Claim your link" box in the last section of the page. A name is stored as its own file in R2 (`claims/<name>.json`, holding the name and the optional
email) and R2 refuses to overwrite a file that already exists, so every name is unique even if two people ask at the same instant. At most 4 names a day and one every 20 seconds per visitor.

## Orders: selling packs of links

The site sells **1 link for $3.99** and **8 links for $14.99** (one price worldwide, see PRICING.md), through **Paddle** (a Merchant of Record: Paddle is the legal seller on every
transaction and handles VAT/GST/sales tax worldwide, so this site never has to register for it). After paying, the buyer chooses how many of
each style (Pixel, Pinky, WinXP) to make, up to the number they paid for (with 8: for example 3 Pixel, 2 Pinky and 3 WinXP, in one go or over
several visits).

```
POST /checkout                { "pack": "single" | "pack" }   ->  { token, checkoutUrl }     (creates a Paddle transaction; the site sends the buyer to checkoutUrl)
GET  /orders/:token           the order: status, credits, remaining, links made so far          (the token is the buyer's key)
POST /orders/:token/generate  { "items": { "pixel": 3, "pinky": 2, "winxp": 3 } }              (only once paid; never more than were paid for)
POST /orders/:token/confirm   mark it paid by hand   (owner only: Authorization: Bearer <ORDER_SECRET>)
POST /orders/:token/refund    payment refunded: the order's links stop working  (same secret)
POST /orders/:token/refund-request   the buyer undoes the purchase themselves, within 10 minutes of paying: asks Paddle for a full
                              refund and stops the links at once (the token is the buyer's key; refused after the 10 minutes)
POST /webhooks/paddle         Paddle calls this itself when a transaction completes, and for refunds and chargebacks
                              (authenticated by Paddle's own signature)
```

### Setting up Paddle

1. Sign up as a seller at [paddle.com](https://www.paddle.com). You do not need a registered company to start — an individual account works,
   though check Paddle's own onboarding for what it asks of you.
2. **Dashboard → Catalog → Products.** Create two products, each with one **non-recurring** (one-time) Price:
   - "1 link" — Price: **$3.99 USD**
   - "8 links" — Price: **$14.99 USD**

   Copy each Price's id (it looks like `pri_01h...`) — you'll set these as `PADDLE_PRICE_SINGLE` and `PADDLE_PRICE_PACK` below.
3. **Dashboard → Checkout → Checkout settings.** Set the **default payment link** to `https://sent4u.link/pay` (the domain must be approved under
   *My account → Settings → Website approval*). That page (`pay.html`) runs Paddle.js: the checkout link the Worker gets back from Paddle is that
   address with `?_ptxn=<transaction id>` on the end, and Paddle.js opens the payment window by itself. Create a **client-side token** under
   *My account → Settings → Authentication → Client-side tokens* and put it in `pay.html`. After paying, the buyer goes to `/?paid=1`, where the
   site's own JS picks the order back up.
4. **Dashboard → Developer Tools → Authentication.** Create an API key with **Transactions: read/write** and **Adjustments: read/write**
   (the second is what refunds need). This is `PADDLE_API_KEY`. It has an expiry date: make a new one before it runs out.
5. **Dashboard → Developer Tools → Notifications.** Add a webhook destination pointing at `https://<your-worker>.workers.dev/webhooks/paddle`,
   subscribed to **`transaction.completed`**, **`adjustment.created`** and **`adjustment.updated`**. Copy its signing secret — this is `PADDLE_WEBHOOK_SECRET`.
6. Set the Worker's secrets and vars:
   ```bash
   npx wrangler secret put PADDLE_API_KEY
   npx wrangler secret put PADDLE_WEBHOOK_SECRET
   npx wrangler secret put ORDER_SECRET        # any long random text — lets you confirm/refund an order by hand
   ```
   and in `wrangler.toml`, uncomment and fill in `PADDLE_PRICE_SINGLE` and `PADDLE_PRICE_PACK` with the two Price ids from step 2, then `npx wrangler deploy`.
7. In `index.html`, put the Worker's address in `data-api` on the pricing section (`id="pricing"`). Without it the buying flow runs as a demo
   in the visitor's browser: nothing is charged and the links are placeholders.

Test it with a real (small) purchase once it's live — Paddle's sandbox (`PADDLE_API_BASE = "https://sandbox-api.paddle.com"` in `wrangler.toml`,
with a sandbox API key/webhook secret from Paddle's sandbox dashboard) is worth trying first if you'd rather not spend real money to check the wiring.

**Getting the money into MNT:** set Paddle's own payout method (Dashboard → your account → Payout details) to a **Wise** account — Paddle can
pay out via wire transfer to Wise's routing details. From your Wise balance, convert and send to your Golomt or TDB account in MNT; Wise pays
Mongolian bank accounts directly in tögrög. This keeps Paddle handling the tax side while the money still ends up in your own bank, in your own
currency.

**Refunds.** For 10 minutes after paying, the buyer can undo the purchase from the order window or "My links" (`/orders/<token>/refund-request`):
the links stop at once and Paddle is asked for a full refund. Paddle reviews most refunds before the money moves and reports back through the
webhook: approved makes the order `refunded`, rejected gives the buyer the links back. A full refund or a chargeback made in the Paddle
dashboard stops the links the same way; a partial refund leaves them working. `/orders/<token>/refund` (with `ORDER_SECRET`) is still there
for fixing an order by hand.

The buyer's browser comes back to the site, waits for the webhook to land, and then shows the "choose your links" step. Links are 128-bit random
ids, made by the Worker, and each is stored as `links/<id>.json` (product, order) so the page that serves `?share=<id>` can check that a link
exists, which product it is, and whether it was revoked. Buyers can find their order again from "My links" in the footer.

```bash
# confirm or refund an order by hand (Paddle's webhook normally does the first one automatically)
curl -X POST https://sent4u-reviews.<your-name>.workers.dev/orders/<token>/confirm -H "Authorization: Bearer <ORDER_SECRET>"
curl -X POST https://sent4u-reviews.<your-name>.workers.dev/orders/<token>/refund  -H "Authorization: Bearer <ORDER_SECRET>"
```

## Signing in: no passwords

A visitor can create an account with just an email — no password to choose, store, or reset. They enter their email and get a link that opens
a confirmation page (a mail scanner that opens the link can't use it up). In the browser that asked, it is one button; opened on another
device, it asks for the two-digit number the first screen shows, and that screen then signs in by itself. A session lasts 90 days from its
last use, so a browser that has signed in once needs no more emails. This is what lets someone see every order they've ever paid for (not just the most recent one their browser
remembers via "My links", which still works exactly as before — signing in is additive, never required to buy).

```
POST /auth/request-link   { email }  ->  { ok: true, code } and a waiting cookie (always this, whether the email is well-formed,
                          rate-limited, or the send fails — never reveals which emails have signed in before)
GET  /auth/confirm        ?token=<from the email>  ->  the confirmation page (only shows it; /auth/verify in older emails shows it too)
POST /auth/confirm        token [, choice]  ->  signs in this browser (303 to /?signedin=1), or approves the waiting one when
                          choice is the number it shows (a wrong number cancels the request)
GET  /auth/status         the waiting browser asks this every few seconds  ->  { signedIn } (and its session cookie once confirmed)
POST /auth/logout         clears the session cookie
GET  /me                  the signed-in visitor's own orders  ->  { email, orders: [...] }, or 401 if not signed in
```

The site's own `/auth/*` and `/me` calls go through the gateway (`sent4u.link/auth/...`, see `gateway/` at the repo root) rather than straight
to this Worker's address — that's what makes the session cookie a first-party `sent4u.link` cookie instead of one shared cross-site with this
Worker's own `*.workers.dev` address, which browsers increasingly restrict.

### Setting up Resend (sends the sign-in email)

Resend now requires a verified domain before it will send to any real recipient — there's no more no-setup fallback via a shared
`onboarding@resend.dev` sender. It's still only about 10 minutes:

1. Sign up at [resend.com](https://resend.com) — the free tier (3,000 emails/month) is plenty for this.
2. **Dashboard → Domains → Add Domain.** Use a subdomain, not the root domain (Resend's own recommendation, keeps sending reputation
   isolated) — this project uses `mail.sent4u.link`.
3. Add the DNS records Resend shows (SPF/DKIM TXT records, maybe a CNAME) to the domain's DNS — this proves you're really allowed to send
   as that domain. If a record is a CNAME, leave it unproxied ("DNS only" in Cloudflare — no orange cloud) or verification won't complete.
   Usually verifies within about 15 minutes.
4. **Dashboard → API Keys → Create API Key** (a "Sending access"-scoped key is enough — no need for full access). Set it:
   `npx wrangler secret put RESEND_API_KEY`.
5. Set `EMAIL_FROM` in `wrangler.toml` to any address at the verified subdomain, e.g. `EMAIL_FROM = "sent4u <hello@mail.sent4u.link>"`.

### The KV namespace

One-time login links (15-minute TTL) and sessions (30-day TTL) live in KV, not R2 — R2 has no built-in expiry, and these need to disappear on
their own. Create it once:

```bash
npx wrangler kv namespace create sent4u-auth
```

then paste the id it prints into `wrangler.toml`'s `[[kv_namespaces]]` block.

## Set it up (about 10 minutes)

You need a free Cloudflare account. From this `worker/` folder:

```bash
npm install
npx wrangler login
npx wrangler r2 bucket create sent4u-reviews
npx wrangler secret put ADMIN_TOKEN        # type any long random password; you'll use it to delete reviews
npx wrangler deploy
```

`deploy` prints the Worker's address, something like `https://sent4u-reviews.<your-name>.workers.dev`.

1. Open `wrangler.toml` and put your real site address in `ALLOWED_ORIGINS` (for example `https://sent4u.link`), then run `npx wrangler deploy` again. Only those sites can send reviews.
2. In `index.html`, on the `<section class="section reviews" …>` tag, set `data-api` to the Worker's address. The claim box in the last section (`id="cta"`) uses the same address by default; give that section its own `data-api` only if you want a different one.

That's it — reviews now go to R2 and show for everyone.

## Names that have been claimed

Every claimed name is a file in the bucket: `claims/<name>.json`. Open the bucket in the Cloudflare dashboard to see them (each holds the name, the email the visitor optionally gave, and a time).
To free a name (say someone claimed something they shouldn't have):

```bash
curl -X DELETE https://sent4u-reviews.<your-name>.workers.dev/claims/<name> -H "Authorization: Bearer <your ADMIN_TOKEN>"
```

Until `data-api` is set, the box works as a demo only: it remembers the name in that visitor's own browser and tells them so.

## Removing a review

Every review has an id (visible in `GET /reviews`). To delete one:

```bash
curl -X DELETE https://sent4u-reviews.<your-name>.workers.dev/reviews/<id> -H "Authorization: Bearer <your ADMIN_TOKEN>"
```

## What stops spam (since nothing is approved first)

- Server-side checks on every field (lengths, star rating, product name), links are refused, and text is only ever shown as plain text.
- One review per visitor per minute, five a day, and the same words twice are refused. Only a hash of the visitor's IP is kept, for that purpose.
- A hidden trap field for bots, and the Worker refuses posts from sites that aren't in `ALLOWED_ORIGINS`.
- **Optional, recommended once the site is public:** Cloudflare Turnstile, a free human check.
  1. Cloudflare dashboard → Turnstile → add a widget for your site → copy the *site key* and *secret key*.
  2. `npx wrangler secret put TURNSTILE_SECRET` and paste the secret key.
  3. Put the site key in `data-turnstile` on the reviews section in `index.html`.
- Optional: `npx wrangler secret put IP_SALT` with any random text, so the stored IP hashes can't be reversed.

## Privacy

Each review's own file in R2 (`reviews/<id>.json`) also holds the email the reviewer optionally gave, and a hash of their IP.
Neither is ever sent to the site. The form says the name and review will be shown publicly; link your Privacy page in the footer
and mention that reviews are stored with Cloudflare.

## Trying it without Cloudflare

```bash
npm test          # runs the Worker against an in-memory bucket (reviews, claims and orders — Paddle itself is faked, including real signed webhooks)
npm run local     # serves it at http://localhost:8787 with an in-memory bucket; reviews and orders vanish when you stop it
```

For `npm run local`, set `data-api="http://localhost:8787"` on the reviews and pricing sections while testing, and put it back afterwards. It plays
the part of Paddle too — "checkout" lands on a local stand-in payment page that sends a real, correctly signed `transaction.completed` webhook
back to itself before redirecting to `?paid=1`, so the whole buy → webhook → choose-your-links flow can be tried end to end with no real Paddle account.

## Notes

- The public list is cached in the browser for 20 seconds, so a visitor's own review is also kept in their browser for a few minutes to make sure it shows up right away.
- Everything in `worker/` is server code. When you publish the site itself, publish everything except this folder.

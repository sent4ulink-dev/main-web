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

The site sells **1 link for $1.99** and **8 links for $9.99**, through **Paddle** (a Merchant of Record: Paddle is the legal seller on every
transaction and handles VAT/GST/sales tax worldwide, so this site never has to register for it). After paying, the buyer chooses how many of
each style (Pixel, Pinky, WinXP) to make, up to the number they paid for (with 8: for example 3 Pixel, 2 Pinky and 3 WinXP, in one go or over
several visits).

```
POST /checkout                { "pack": "single" | "pack" }   ->  { token, checkoutUrl }     (creates a Paddle transaction; the site sends the buyer to checkoutUrl)
GET  /orders/:token           the order: status, credits, remaining, links made so far          (the token is the buyer's key)
POST /orders/:token/generate  { "items": { "pixel": 3, "pinky": 2, "winxp": 3 } }              (only once paid; never more than were paid for)
POST /orders/:token/confirm   mark it paid by hand   (owner only: Authorization: Bearer <ORDER_SECRET>)
POST /orders/:token/refund    payment refunded: the order's links stop working  (same secret)
POST /webhooks/paddle         Paddle calls this itself when a transaction completes (authenticated by Paddle's own signature)
```

### Setting up Paddle

1. Sign up as a seller at [paddle.com](https://www.paddle.com). You do not need a registered company to start — an individual account works,
   though check Paddle's own onboarding for what it asks of you.
2. **Dashboard → Catalog → Products.** Create two products, each with one **non-recurring** (one-time) Price:
   - "1 link" — Price: **$1.99 USD**
   - "8 links" — Price: **$9.99 USD**

   Copy each Price's id (it looks like `pri_01h...`) — you'll set these as `PADDLE_PRICE_SINGLE` and `PADDLE_PRICE_PACK` below.
3. **Dashboard → Checkout → Checkout settings.** Set the **default payment link** (where a buyer lands after paying) to `https://sent4u.link/?paid=1`.
   The site's own JS is already watching for that `?paid=1` and picks the order back up from there — you don't need to build anything for this step.
4. **Dashboard → Developer Tools → Authentication.** Create an API key. This is `PADDLE_API_KEY`.
5. **Dashboard → Developer Tools → Notifications.** Add a webhook destination pointing at `https://<your-worker>.workers.dev/webhooks/paddle`,
   subscribed to at least the **`transaction.completed`** event. Copy its signing secret — this is `PADDLE_WEBHOOK_SECRET`.
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

**Refunds aren't wired up automatically yet.** Paddle's refund payload needs confirming against a real refund before this trusts it — for now,
when a refund or chargeback comes in, call `/orders/<token>/refund` by hand with `ORDER_SECRET` (see below). This is easy to automate later once
we've seen what a real refund notification looks like.

The buyer's browser comes back to the site, waits for the webhook to land, and then shows the "choose your links" step. Links are 128-bit random
ids, made by the Worker, and each is stored as `links/<id>.json` (product, order) so the page that serves `?share=<id>` can check that a link
exists, which product it is, and whether it was revoked. Buyers can find their order again from "My links" in the footer.

```bash
# confirm or refund an order by hand (Paddle's webhook normally does the first one automatically)
curl -X POST https://sent4u-reviews.<your-name>.workers.dev/orders/<token>/confirm -H "Authorization: Bearer <ORDER_SECRET>"
curl -X POST https://sent4u-reviews.<your-name>.workers.dev/orders/<token>/refund  -H "Authorization: Bearer <ORDER_SECRET>"
```

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

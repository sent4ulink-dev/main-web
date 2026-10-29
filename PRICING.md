# sent4u pricing

One price for the whole world, in US dollars, sold through Paddle (the seller of record: it charges the buyer, works out and pays the VAT/sales tax, and sends you the rest).

| Product | Price | What it is |
|---|---|---|
| 1 link (`pri_01m3964d9twgc370knhkc64cfn`) | **$3.99** | one invitation link, any style |
| 8 links (`pri_01m3965bx3qsk98x12gmzchr4t`) | **$14.99** ($1.87 a link, 53% cheaper) | eight links, mix and match |

No country has its own price (an earlier version had 61 local prices; they were removed on 25 Oct 2026).

## How the money works

- **Paddle's fee:** 5% + $0.50 on every sale, taken from the *whole* amount the buyer pays (tax included). The $0.50 is why a $1.99 price lost about 30% to fees; at $3.99 Paddle takes about 18%, and on the 8-link pack only about 8%.
- **Tax:** in the US and Canada sales tax is added **on top** at checkout, so you keep the full price. Almost everywhere else (Europe, UK, Japan, India, Australia...) the VAT/GST is **inside** the price, so you keep a little less there. Paddle works it out and pays it for you.
- **Your costs:** Cloudflare and Resend cost a few cents a month at this size, so almost everything left after Paddle is profit. Payouts also pay a bank/wire fee: keep the payout threshold at $500 or more so it stays small.

## What you keep per sale (after tax and Paddle's fee, before payout fees)

| Where the buyer is | Tax inside the price | You keep on 1 link ($3.99) | You keep on 8 links ($14.99) |
|---|---|---|---|
| US, Canada, Hong Kong | none (added on top, or no tax) | **$3.29** | **$13.74** |
| Japan, Australia, Mongolia | 10% | **$2.93** | **$12.38** |
| India | 18% | **$2.69** | **$11.45** |
| Germany | 19% | **$2.65** | **$11.35** |
| UK, France | 20% | **$2.63** | **$11.24** |
| Spain, Netherlands | 21% | **$2.60** | **$11.14** |
| Hungary (the highest VAT) | 27% | **$2.44** | **$10.55** |

Every sale makes at least $2.44, and the pack makes at least $10.55.

## Changing a price later

1. Paddle → Catalog → Products → the product → the price → **Edit price** → change the base price → Save.
2. Then change the numbers written in the website: `index.html` (`$3.99`, `$14.99`, `$1.87`, `53`%), `PACKS` in `script.js` (cents) and in `worker/src/index.js` (amount), and redeploy the site and the orders Worker.

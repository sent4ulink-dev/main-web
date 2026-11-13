-- The site's visit counts (D1 database "sent4u-stats"). Written by the gateway (gateway/index.js, one batch per page visit),
-- read by the orders Worker for the owner's stats page (sent4u.link/stats). No cookies and nothing personal: a visitor is a
-- salted hash of their address and browser that changes every day, so nobody can be followed from one day to the next.
-- Apply once: npx wrangler d1 execute sent4u-stats --remote --file worker/stats-schema.sql
-- (days are in the owner's time zone: see STATS_TZ_OFFSET_MIN)

-- page visits per day: kind = home | demo | link | guest | pay, product = the card for demo/link/guest ('' otherwise)
CREATE TABLE IF NOT EXISTS hits (day TEXT NOT NULL, kind TEXT NOT NULL, product TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, product)) WITHOUT ROWID;
-- different visitors per day (h: the day's hash; counted, never read back)
CREATE TABLE IF NOT EXISTS visitors (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h)) WITHOUT ROWID;
-- where visits come from: the country (Cloudflare's) and the site that sent them (its host only)
CREATE TABLE IF NOT EXISTS countries (day TEXT NOT NULL, country TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, country)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS referrers (day TEXT NOT NULL, host TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, host)) WITHOUT ROWID;

/* The finale of the page.

   1. A night sky with a dot-matrix Earth rising from the bottom edge (the same land outlines as the hero globe), message arcs flying between
      cities, and a plane that flies in from the claim form and lands on the globe.
   2. "Claim your link": a name field with a live check. Claiming sends a paper plane from the button to a city (always the same city for the
      same name) and drops a permanent beacon there.
   3. The big footer wordmark, whose letters rise and light up around the cursor.

   The land outlines are Natural Earth (public domain). */

import { onRealResize } from './viewport.js';
import { tilt } from './tilt.js';

const DEG = Math.PI / 180;
const phone = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;   // fewer, slightly bigger dots and a lower frame rate
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapAngle = a => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// cities in the northern half of the sky's view, where the top of the globe shows (name, latitude, longitude)
const CITIES = [
  ['Ulaanbaatar', 47.92, 106.92], ['Tokyo', 35.68, 139.69], ['Seoul', 37.57, 126.98], ['Beijing', 39.90, 116.40],
  ['Istanbul', 41.01, 28.98], ['Moscow', 55.76, 37.62], ['Berlin', 52.52, 13.40], ['London', 51.51, -0.13],
  ['Paris', 48.86, 2.35], ['Madrid', 40.42, -3.70], ['Rome', 41.90, 12.50], ['Stockholm', 59.33, 18.07],
  ['New York', 40.71, -74.01], ['Toronto', 43.65, -79.38], ['Chicago', 41.88, -87.63], ['San Francisco', 37.77, -122.42],
];
const CITY_VECS = CITIES.map(([, lat, lon]) => [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)]);

export function initFinale({ reduceMotion }) {
  const sec = document.getElementById('cta');
  if (!sec) return;
  // the copy fades up piece by piece when the section arrives
  const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) { sec.classList.add('is-in'); seen.disconnect(); } }, { threshold: 0.12 });
  if (reduceMotion) sec.classList.add('is-in'); else seen.observe(sec);

  const globe = initGlobe(sec, reduceMotion);
  initClaim(sec, globe);
  initWordmark(reduceMotion);
}

/* ---------------- the globe ---------------- */

function initGlobe(sec, reduceMotion) {
  const canvas = document.getElementById('ctaGlobe');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return null;

  let W = 0, H = 0, cx = 0, cy = 0, R = 0;
  let PX = new Float32Array(0), PY = new Float32Array(0), PZ = new Float32Array(0), ready = false;
  let yaw = 0.7, pitch = 0.42, focus = null, pointerYaw = 0, pointerTarget = 0, scrub = 0;
  let clock = 0, last = 0, active = false, raf = 0, nextArc = 0.5;
  let arcs = [], pulses = [], flights = [], stars = [], backdrop = null, minGap = phone ? 45 : 30;
  const claimed = new Set();
  const light = (() => { const v = [-0.42, 0.52, 0.74], n = Math.hypot(...v); return v.map(c => c / n); })();

  // ---- the land, as points on a sphere, from the same outlines as the hero globe
  async function buildLand() {
    const geo = await (await fetch('assets/data/ne_110m_land.geojson')).json();
    const MW = 1440, MH = 720;
    const mask = document.createElement('canvas');
    mask.width = MW; mask.height = MH;
    const m = mask.getContext('2d', { willReadFrequently: true });
    m.fillStyle = '#fff';
    m.beginPath();
    for (const f of geo.features) {
      const g = f.geometry;
      const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      for (const poly of polys) for (const ring of poly) {
        ring.forEach(([lon, lat], i) => {
          const x = (lon + 180) / 360 * MW, y = (90 - lat) / 180 * MH;
          if (i) m.lineTo(x, y); else m.moveTo(x, y);
        });
        m.closePath();
      }
    }
    m.fill('evenodd');
    const data = m.getImageData(0, 0, MW, MH).data;
    const isLand = (lat, lon) => {
      const x = clamp(Math.floor((lon + 180) / 360 * MW), 0, MW - 1), y = clamp(Math.floor((90 - lat) / 180 * MH), 0, MH - 1);
      return data[(y * MW + x) * 4] > 128;
    };
    const xs = [], ys = [], zs = [], STEP = phone ? 2 : 1.25;
    for (let lat = -84; lat <= 84; lat += STEP) {
      const c = Math.cos(lat * DEG), lonStep = STEP / Math.max(c, 0.05);
      for (let lon = -180; lon < 180; lon += lonStep) {
        if (!isLand(lat, lon)) continue;
        xs.push(c * Math.sin(lon * DEG)); ys.push(Math.sin(lat * DEG)); zs.push(c * Math.cos(lon * DEG));
      }
    }
    PX = Float32Array.from(xs); PY = Float32Array.from(ys); PZ = Float32Array.from(zs);
    ready = true;
  }

  function resize() {
    const dpr = 1;                                       // dots and lines stay crisp at 1x, and this canvas is big
    W = sec.clientWidth; H = sec.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = clamp(W * (W < 700 ? 1.05 : 0.55), 380, 820);
    cx = W / 2; cy = H * 0.54 + R;                       // the top of the globe sits just over halfway down the section
    const n = Math.round(clamp(W * H / 9000, 60, 160));
    stars = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H * 0.75), r: rnd(0.5, 1.5), a: rnd(0.25, 0.8) }));
    backdrop = document.createElement('canvas');
    backdrop.width = canvas.width; backdrop.height = canvas.height;
    const b = backdrop.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBackdrop(b);
  }

  // the stars, the glow around the planet and the ocean never change: they are painted once per size and copied in on every frame
  function paintBackdrop(g) {
    for (const s of stars) { g.fillStyle = `rgba(255,255,255,${s.a.toFixed(3)})`; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.2832); g.fill(); }
    const halo = g.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.18);
    halo.addColorStop(0, 'rgba(110,180,255,.42)'); halo.addColorStop(0.35, 'rgba(110,150,255,.14)'); halo.addColorStop(1, 'rgba(110,150,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.18, 0, 6.2832); g.fill();
    const sea = g.createRadialGradient(cx + light[0] * R * 0.55, cy - light[1] * R * 0.55, R * 0.05, cx, cy, R * 1.05);
    sea.addColorStop(0, '#2266cc'); sea.addColorStop(0.45, '#0e3b8a'); sea.addColorStop(0.85, '#071a47'); sea.addColorStop(1, '#040b22');
    g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.fill();
  }

  // a point on the unit sphere → its place on screen (and how much it faces us)
  let cY = 1, sY = 0, cP = 1, sP = 0;
  const setView = () => { const y = yaw + pointerYaw * 0.35 + scrub; cY = Math.cos(y); sY = Math.sin(y); cP = Math.cos(pitch); sP = Math.sin(pitch); };
  const proj = (x, y, z, out) => {
    const x1 = x * cY + z * sY, z1 = -x * sY + z * cY, y2 = y * cP - z1 * sP, z2 = y * sP + z1 * cP;
    out[0] = cx + x1 * R; out[1] = cy - y2 * R; out[2] = z2; return out;
  };
  const tmp = [0, 0, 0];
  const cityAt = (i, out = [0, 0, 0]) => proj(CITY_VECS[i][0], CITY_VECS[i][1], CITY_VECS[i][2], out);
  const cityVisible = i => { const p = cityAt(i, tmp); return p[2] > 0.15 && p[1] > 40 && p[1] < H - 40 && p[0] > 20 && p[0] < W - 20; };

  function spawnArc() {
    const seen = CITIES.map((_, i) => i).filter(cityVisible);
    if (seen.length < 2) return;
    const a = seen[Math.floor(Math.random() * seen.length)];
    let b = seen[Math.floor(Math.random() * seen.length)], guard = 0;
    while (b === a && guard++ < 8) b = seen[Math.floor(Math.random() * seen.length)];
    if (a === b) return;
    const va = CITY_VECS[a], vb = CITY_VECS[b], dot = clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1), om = Math.acos(dot);
    if (om < 0.12 || om > 1.9) return;
    arcs.push({ a, b, va, vb, om, age: 0, dur: rnd(1.5, 2.1), lift: 0.05 + 0.22 * Math.min(1, om / 1.6) });
  }
  const arcPoint = (arc, u, out) => {
    const s = Math.sin(arc.om) || 1, w1 = Math.sin((1 - u) * arc.om) / s, w2 = Math.sin(u * arc.om) / s, k = 1 + arc.lift * Math.sin(Math.PI * u);
    return proj((arc.va[0] * w1 + arc.vb[0] * w2) * k, (arc.va[1] * w1 + arc.vb[1] * w2) * k, (arc.va[2] * w1 + arc.vb[2] * w2) * k, out);
  };

  function drawPlane(x, y, ang, scale, trail) {
    if (trail.length > 1) {
      const g = ctx.createLinearGradient(trail[0][0], trail[0][1], x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.7)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.4 * scale;
      ctx.beginPath(); trail.forEach(([tx, ty], i) => (i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty))); ctx.lineTo(x, y); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 44 * scale);
    glow.addColorStop(0, 'rgba(255,140,190,.6)'); glow.addColorStop(1, 'rgba(255,140,190,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 44 * scale, 0, 6.2832); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(0.9 * scale, 0.9 * scale);
    ctx.fillStyle = 'rgba(255,255,255,.98)'; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(-24, -19); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(216,210,255,.95)'; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(-11, 0); ctx.lineTo(-24, 19); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw(dt) {
    setView();
    ctx.clearRect(0, 0, W, H);

    ctx.drawImage(backdrop, 0, 0, W, H);

    // land: only the dots that face us and land inside the picture, grouped by how brightly they are lit
    if (ready) {
      const N = PX.length, dotR = clamp(R / 640 * 1.5, 1.1, 2.1) * (phone ? 1.35 : 1), paths = Array.from({ length: 6 }, () => new Path2D());
      for (let i = 0; i < N; i++) {
        const x = PX[i], y = PY[i], z = PZ[i];
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY, y2 = y * cP - z1 * sP, z2 = y * sP + z1 * cP;
        if (z2 <= 0.03) continue;
        const sx = cx + x1 * R, sy = cy - y2 * R;
        if (sy > H + 3 || sy < -3 || sx < -3 || sx > W + 3) continue;
        const lit = clamp(x1 * light[0] + y2 * light[1] + z2 * light[2], 0, 1), r = dotR * (0.55 + 0.65 * z2), p = paths[Math.min(5, Math.floor(lit * 6))];
        p.moveTo(sx + r, sy); p.arc(sx, sy, r, 0, 6.2832);
      }
      for (let b = 0; b < 6; b++) {
        const t = b / 5;
        ctx.fillStyle = `rgba(${Math.round(lerp(24, 110, t))},${Math.round(lerp(110, 250, t))},${Math.round(lerp(66, 150, t))},${(0.42 + 0.58 * t).toFixed(3)})`;
        ctx.fill(paths[b]);
      }
    }
    ctx.strokeStyle = 'rgba(150,205,255,.32)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

    // city beacons
    const p = [0, 0, 0];
    CITIES.forEach((_, i) => {
      cityAt(i, p);
      if (p[2] < 0.05 || p[1] < -10 || p[1] > H + 10) return;
      ctx.fillStyle = 'rgba(255,107,157,.85)'; ctx.beginPath(); ctx.arc(p[0], p[1], 2 + p[2], 0, 6.2832); ctx.fill();
    });
    // the names people have claimed stay lit
    claimed.forEach(i => {
      cityAt(i, p);
      if (p[2] < 0.02) return;
      const pulse = 1 + 0.25 * Math.sin(clock * 3.2), g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 34 * pulse);
      g.addColorStop(0, 'rgba(255,190,220,.75)'); g.addColorStop(1, 'rgba(255,107,157,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], 34 * pulse, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.6, 0, 6.2832); ctx.fill();
    });

    // message arcs
    if (dt > 0) { nextArc -= dt; if (nextArc <= 0 && arcs.length < 5) { spawnArc(); nextArc = rnd(0.45, 1.0); } }
    for (const arc of arcs) {
      arc.age += dt;
      const head = clamp(arc.age / arc.dur, 0, 1), tail = clamp((arc.age - 0.55 * arc.dur) / arc.dur, 0, 1), STEPS = 34;
      const k0 = Math.floor(tail * STEPS), k1 = Math.floor(head * STEPS);
      let prev = null;
      for (let k = k0; k <= k1; k++) {
        const q = arcPoint(arc, k / STEPS, [0, 0, 0]);
        if (prev && q[2] > -0.02 && prev[2] > -0.02) {
          ctx.strokeStyle = `rgba(255,${Math.round(lerp(120, 220, (k - k0) / Math.max(1, k1 - k0)))},190,${(0.85 * (k - k0) / Math.max(1, k1 - k0)).toFixed(3)})`;
          ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
        prev = q;
      }
      if (head < 1 && prev && prev[2] > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(prev[0], prev[1], 2.6, 0, 6.2832); ctx.fill(); }
      if (head >= 1 && !arc.landed) { arc.landed = true; pulses.push({ city: arc.b, t0: clock, size: 30 }); }
    }
    arcs = arcs.filter(a => a.age < a.dur * 1.55);
    pulses = pulses.filter(pu => clock - pu.t0 < 1.1);
    for (const pu of pulses) {
      cityAt(pu.city, p);
      if (p[2] < 0.02) continue;
      const u = (clock - pu.t0) / 1.1, r = pu.size * (0.3 + u), a = Math.pow(1 - u, 2) * 0.7;
      ctx.strokeStyle = `rgba(255,190,220,${a.toFixed(3)})`; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * (0.35 + 0.65 * p[2]), 0, 0, 6.2832); ctx.stroke();
    }

    // planes flying in from the claim form
    for (const f of flights) {
      f.age += dt;
      const t = clamp(f.age / f.dur, 0, 1), e = t * t * (3 - 2 * t), dest = cityAt(f.city, [0, 0, 0]);
      const p0 = [f.fx, f.fy], p2 = [dest[0], dest[1]], p1 = [(p0[0] + p2[0]) / 2 + f.off, Math.min(p0[1], p2[1]) - 230];
      const bez = q => { const w = 1 - q; return [w * w * p0[0] + 2 * w * q * p1[0] + q * q * p2[0], w * w * p0[1] + 2 * w * q * p1[1] + q * q * p2[1]]; };
      const [x, y] = bez(e), [x2, y2] = bez(Math.min(1, e + 0.02));
      f.trail.push([x, y]); if (f.trail.length > 26) f.trail.shift();
      drawPlane(x, y, Math.atan2(y2 - y, x2 - x), lerp(1.3, 0.55, e), f.trail);
      if (t >= 1 && !f.landed) {
        f.landed = true; claimed.add(f.city);
        pulses.push({ city: f.city, t0: clock, size: 80 }, { city: f.city, t0: clock + 0.18, size: 46 });
        f.done();
        setTimeout(() => { focus = null; }, 1400);
      }
    }
    flights = flights.filter(f => !f.landed);
  }

  function frame(now) {
    if (!active) { raf = 0; return; }
    if (!flights.length && last && now - last < minGap) { raf = requestAnimationFrame(frame); return; }   // ~30 fps is plenty for a slow turn; a flight gets every frame
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; clock += dt;
    if (focus) yaw += wrapAngle(focus.target - yaw) * (1 - Math.exp(-dt / 0.32)); else yaw += 0.05 * dt;   // it turns slowly, or brings a city to the front
    if (tilt.active) pointerTarget = tilt.x * 1.6;   // a phone: its lean turns the globe like the mouse does
    pointerYaw += (pointerTarget - pointerYaw) * (1 - Math.exp(-dt / 0.4));
    const r = sec.getBoundingClientRect(), vh = window.innerHeight;
    scrub = clamp((vh - r.top) / (vh + r.height), 0, 1) * 1.1;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  resize();
  buildLand().then(() => { if (reduceMotion) { draw(0); } }).catch(err => console.error('finale: could not build the globe', err));
  onRealResize(() => { resize(); if (reduceMotion && ready) draw(0); });
  if (reduceMotion) return { launch: () => Promise.resolve(), markClaimed: i => claimed.add(i) };

  window.addEventListener('sent4u:lite', () => { minGap = 50; });
  sec.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pointerTarget = ((e.clientX / window.innerWidth) - 0.5) * 1.2; });
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active && !raf) { last = 0; raf = requestAnimationFrame(frame); } }, { rootMargin: '120px' }).observe(sec);

  return {
    // fly a plane from (fromX, fromY) on the canvas to a city; resolves when it lands
    launch(fromX, fromY, city) {
      return new Promise(resolve => {
        if (!ready) { claimed.add(city); resolve(); return; }
        focus = { target: -CITIES[city][2] * DEG };                                   // turn the globe until the city faces us
        flights.push({ fx: fromX, fy: fromY, city, age: 0, dur: 1.9, off: rnd(-170, 170), trail: [], done: resolve });
      });
    },
    markClaimed(city) { claimed.add(city); },
    canvas,
  };
}

/* ---------------- claim your link ---------------- */

const RESERVED = new Set(['admin', 'administrator', 'support', 'help', 'sent4u', 'sent', 'www', 'api', 'app', 'root', 'mail', 'email', 'billing', 'security',
  'about', 'blog', 'careers', 'terms', 'privacy', 'login', 'logout', 'signup', 'register', 'account', 'settings', 'pricing', 'status', 'team', 'staff',
  'official', 'contact', 'press', 'legal', 'escrow', 'marketplace', 'pixel', 'pinky', 'winxp', 'send', 'null', 'undefined']);

function nameProblem(h) {                              // the same rules the server applies
  if (!/^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/.test(h)) return 'Use 3–24 letters, numbers, - or _ (not at the start or end).';
  if (/[-_]{2}/.test(h)) return 'Keep the dashes and underscores apart.';
  if (RESERVED.has(h)) return 'That name is reserved.';
  return '';
}
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function initClaim(sec, globe) {
  const form = document.getElementById('claimForm'), done = document.getElementById('claimDone');
  if (!form || !done) return;
  const input = form.elements.handle, btn = form.querySelector('button[type="submit"]'), label = btn.querySelector('.btn-label');
  const hint = document.getElementById('claimHint');
  // the same address as the reviews, unless this section names its own
  const reviewsApi = (document.getElementById('reviews') || {}).dataset ? document.getElementById('reviews').dataset.api : '';
  const api = String(sec.dataset.api || reviewsApi || '').trim().replace(/[/]+$/, '');
  const KEY = 'sent4u.claim', IDLE = 'Pick the name for your link: 3–24 letters, numbers, - or _.';
  let timer = 0, seq = 0, busy = false;

  const setState = (state, msg) => { form.dataset.state = state; hint.textContent = msg; form.classList.toggle('is-open', state === 'ok'); };
  const cityName = i => CITIES[i][0];

  input.addEventListener('input', () => {
    const v = input.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (v !== input.value) input.value = v;
    clearTimeout(timer); seq++;
    if (!v) return setState('idle', IDLE);
    if (v.length < 3) return setState('idle', 'A little longer: at least 3 characters.');
    const problem = nameProblem(v);
    if (problem) return setState('bad', problem);
    setState('checking', `Checking sent4u.link/${v}…`);
    const mine = seq;
    timer = setTimeout(async () => {
      let free = true, reason = 'That one is taken.', known = !api;
      if (api) {
        try {
          const json = await (await fetch(`${api}/claims/${encodeURIComponent(v)}`, { cache: 'no-cache' })).json();
          free = json.available === true; reason = json.reason || reason; known = true;
        } catch { /* couldn't ask: let them try, the server checks again when they claim */ }
      }
      if (mine !== seq) return;
      if (!free) setState('bad', reason);
      else setState('ok', known ? `sent4u.link/${v} is free.` : `sent4u.link/${v} looks good. We’ll check it when you claim it.`);
    }, 380);
  });

  function showDone(handle, city, fresh) {
    form.hidden = true; done.hidden = false;
    document.getElementById('claimDoneLink').textContent = `sent4u.link/${handle}`;
    document.getElementById('claimDoneSub').textContent = api
      ? (fresh ? `It just landed in ${cityName(city)}, and it’s on the map.` : `It’s on the map, in ${cityName(city)}.`)
      : `It landed in ${cityName(city)}. (Demo: nothing was sent anywhere. Claiming isn’t switched on for this site yet.)`;
    if (fresh) done.querySelector('.claim-done-title').focus({ preventScroll: true });
    done.dataset.handle = handle;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const handle = input.value.trim().toLowerCase();
    if (!handle) { setState('bad', 'Type the name you want first.'); input.focus(); return; }
    const problem = nameProblem(handle);
    if (problem) { setState('bad', problem); input.focus(); return; }
    if (form.dataset.state === 'bad') { input.focus(); return; }

    busy = true; btn.disabled = true; label.textContent = 'Claiming…';
    const fail = msg => { setState('bad', msg); busy = false; btn.disabled = false; label.textContent = 'Claim it'; };
    if (api) {
      try {
        const res = await fetch(`${api}/claims`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle, email: String(form.elements.email.value || '').trim(), website: String(form.elements.website.value || '') }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) return fail(out.error || 'We couldn’t claim that just now. Please try again.');
      } catch { return fail('We couldn’t reach the server. Please try again in a moment.'); }
    }
    const city = hash(handle) % CITIES.length;
    if (globe && globe.canvas) {
      const b = btn.getBoundingClientRect(), c = globe.canvas.getBoundingClientRect();
      form.classList.add('is-sending');
      await globe.launch(b.left + b.width / 2 - c.left, b.top + b.height / 2 - c.top, city);
    }
    try { localStorage.setItem(KEY, JSON.stringify({ handle, city })); } catch {}
    showDone(handle, city, true);
  });

  done.querySelector('#claimCopy').addEventListener('click', async e => {
    const text = `https://sent4u.link/${done.dataset.handle}`, chip = e.currentTarget, was = chip.firstChild.textContent;
    try { await navigator.clipboard.writeText(text); chip.firstChild.textContent = 'Copied ✓'; } catch { chip.firstChild.textContent = text; }
    setTimeout(() => { chip.firstChild.textContent = was; }, 1800);
  });
  done.querySelector('#claimAgain').addEventListener('click', () => {
    try { localStorage.removeItem(KEY); } catch {}
    done.hidden = true; form.hidden = false; form.classList.remove('is-sending'); form.reset();
    busy = false; btn.disabled = false; label.textContent = 'Claim it'; setState('idle', IDLE); input.focus();
  });

  // someone who already claimed a name here gets it back
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.handle === 'string' && Number.isInteger(saved.city) && CITIES[saved.city] && !nameProblem(saved.handle)) {
      showDone(saved.handle, saved.city, false);
      if (globe) globe.markClaimed(saved.city);
    }
  } catch {}
  setState('idle', IDLE);
}

/* ---------------- the footer wordmark ---------------- */

function initWordmark(reduceMotion) {
  const mark = document.querySelector('.ft-mark');
  if (!mark || reduceMotion || window.matchMedia('(hover: none)').matches) return;
  const letters = [...mark.querySelectorAll('span')], foot = mark.closest('footer');
  foot.addEventListener('pointermove', e => {
    for (const l of letters) {
      const r = l.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      l.style.setProperty('--gx', `${(e.clientX - r.left).toFixed(0)}px`);
      l.style.setProperty('--gy', `${(e.clientY - r.top).toFixed(0)}px`);
      l.style.setProperty('--k', clamp(1 - d / 440, 0, 1).toFixed(3));
    }
  });
  foot.addEventListener('pointerleave', () => letters.forEach(l => l.style.setProperty('--k', '0')));
}

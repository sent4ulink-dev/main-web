import {
  animate, createTimeline, createTimer, createAnimatable,
  splitText, stagger, onScroll, utils, engine
} from './vendor/animejs.js';
import Lenis from './vendor/lenis.js';
import { initFinale } from './finale.js';
import { onRealResize, pinnedHeight } from './viewport.js';
import { tilt, initTilt } from './tilt.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Smooth scroll (Lenis) driving Anime's engine ---------------- */
let lenis = null; // shared so the full-screen menu can pause scrolling
function initSmoothScroll(){
  if (reduceMotion) return;
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  engine.useDefaultMainLoop = false;
  function raf(time){
    lenis.raf(time);
    engine.update(); // tick every frame, not only when Lenis fires 'scroll'
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

/* ---------------- Custom cursor ---------------- */
function initCursor(){
  if (window.matchMedia('(hover: none)').matches) return;
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  // moved with transforms only (left/top would make the browser lay the page out again on every mouse move)
  const ringMove = createAnimatable(ring, { x: 0, y: 0, unit: 'px', ease: 'out(3)', duration: 550 });

  window.addEventListener('mousemove', e => {
    utils.set(dot, { x: e.clientX, y: e.clientY });
    ringMove.x(e.clientX);
    ringMove.y(e.clientY);
  }, { passive: true });

  document.querySelectorAll('a, button, [data-magnetic]').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  });
}

/* ---------------- Magnetic buttons ---------------- */
function initMagnetic(){
  if (reduceMotion || window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('[data-magnetic]').forEach($btn => {
    const magnet = createAnimatable($btn, { x: 0, y: 0, duration: 450, ease: 'out(3)' });
    $btn.addEventListener('mousemove', e => {
      const r = $btn.getBoundingClientRect();
      magnet.x((e.clientX - r.left - r.width / 2) * .35);
      magnet.y((e.clientY - r.top - r.height / 2) * .5);
    });
    $btn.addEventListener('mouseleave', () => { magnet.x(0); magnet.y(0); });
  });
}

/* ---------------- Scroll progress bar ---------------- */
function initProgressBar(){
  createTimer({
    duration: 1000,
    onUpdate: self => utils.set('#progressBar', { scaleX: self.progress }),
    autoplay: onScroll({ target: document.body, sync: true })
  });
}

/* ---------------- Sticky header shrink ---------------- */
function initHeader(){
  const header = document.getElementById('siteHeader');
  const toggle = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', toggle, { passive: true });
  toggle();
}

/* ---------------- Generic direction-based scroll reveals ---------------- */
function initReveals(){
  const variants = {
    fade:  { opacity: [0, 1], y: [16, 0] },
    left:  { opacity: [0, 1], x: [-70, 0] },
    right: { opacity: [0, 1], x: [70, 0] },
    up:    { opacity: [0, 1], y: [46, 0] },
  };
  document.querySelectorAll('[data-reveal]').forEach(el => {
    if (el.closest('.hero')) return; // hero handled by the preloader sequence
    const from = variants[el.dataset.reveal] || variants.fade;
    animate(el, {
      ...from,
      duration: 750,
      ease: 'out(3)',
      autoplay: reduceMotion ? true : onScroll({ target: el, enter: 'bottom-=60 top' })
    });
  });
}

/* ---------------- Hero: split text + layered parallax ---------------- */
let heroSplit;
function prepareHero(){
  heroSplit = splitText('#heroTitle', { words: { wrap: 'clip' } });
  utils.set(heroSplit.words, { y: '110%' });
}

function startHeroReveal(){
  window.dispatchEvent(new Event('sent4u:hero-in'));   // the hero's chat starts now, not behind the loading screen
  animate(heroSplit.words, {
    y: ['110%', '0%'],
    duration: 900,
    ease: 'out(4)',
    delay: stagger(55),
  });
  animate('.hero .eyebrow, .hero .hero-demo, .hero .hero-sub, .hero .hero-ctas, .hero .hero-note, .hero .scroll-cue', {
    opacity: [0, 1],
    y: [16, 0],
    duration: 700,
    delay: stagger(90, { start: 250 }),
    ease: 'out(3)',
  });
}

function initHeroParallax(){
  if (reduceMotion) return;

  // One shared Animatable per layer drives BOTH axes — two separate Anime.js
  // controllers (an animate() for scroll-y + a createAnimatable for cursor-x)
  // fighting over the same element's transform is what was freezing this earlier.
  const layers = Array.from(document.querySelectorAll('[data-parallax-speed]')).map(el => ({
    el,
    speed: parseFloat(el.dataset.parallaxSpeed),
    depthMag: parseFloat(el.dataset.cursorDepth || '0'),
    animatable: createAnimatable(el, { x: 0, y: 0, ease: 'out(3)', duration: 500 })
  }));

  createTimer({
    duration: 1000,
    onUpdate: self => layers.forEach(({ animatable, speed }) => {
      animatable.y(-260 * speed * self.progress);
    }),
    autoplay: onScroll({ target: '.hero', sync: true })
  });

  if (window.matchMedia('(hover: none)').matches) return;
  const heroEl = document.querySelector('.hero');
  heroEl.addEventListener('mousemove', e => {
    const r = heroEl.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    layers.forEach(({ animatable, depthMag }) => { if (depthMag) animatable.x(nx * depthMag); });
  });
}

/* ---------------- Hero: a chat where a sent4u link arrives, is tapped, and opens into the real card ----------------
   What the site is, at a glance. Three scenes in turn (Thanksgiving, a birthday, a date), each about eight seconds: a message comes
   in, the sent4u link goes out, it's seen, a tap, and the card opens on the phone. Steps added as classes (a1…a5) on #heroDemo;
   the movement is CSS (opacity and transforms). It pauses while the hero is off screen or the tab is hidden. */
const HERO_SCENES = [
  { name: 'Family 🦃', av: 'linear-gradient(135deg,#f2a03d,#b8323f)', ask: 'who’s hosting thanksgiving this year?', kind: 'Thanksgiving', title: 'Thanksgiving with the Millers 🍂', img: 'assets/showcase/tg-1-arrive.webp' },
  { name: 'Mia', av: 'linear-gradient(135deg,#ffb86b,#ff6b9d)', ask: 'can’t believe I’m turning 25 tomorrow 😭', kind: 'Birthday', title: 'Happy birthday, Mia 🎈', img: 'assets/styles/picnic.webp' },
  { name: 'Naraa', av: 'linear-gradient(135deg,#7c5cff,#5ce1ff)', ask: 'so… what are we doing friday? 👀', kind: 'Date invitation', title: 'Will you go on a date with me? 💌', img: 'assets/styles/pixel.webp' },
];
function initHeroDemo(){
  const demo = document.getElementById('heroDemo');
  if (!demo) return;
  const $ = s => demo.querySelector(s);
  const steps = [...demo.querySelectorAll('.hd-steps span')];
  let n = 0, timers = [], running = false, onScreen = true;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const state = cls => { demo.className = `hero-demo ${cls}`; };
  const step = i => steps.forEach((el, j) => el.classList.toggle('on', j === i));
  function fill(s){
    $('.hd-name').textContent = s.name; $('.hd-av').style.background = s.av; $('.hd-m1').textContent = s.ask;
    const t = $('.hd-title'); t.textContent = ''; const k = document.createElement('small'); k.textContent = `sent4u.link · ${s.kind}`; t.append(k, s.title);
    $('.hd-thumb img').src = s.img; $('.hd-card img').src = s.img;
  }
  // where the finger taps: the middle of the link, and the card grows out of that same spot
  function aim(){
    const scr = $('.hd-screen').getBoundingClientRect(), b = $('.hd-link').getBoundingClientRect();
    if (!scr.width) return;
    demo.style.setProperty('--tx', `${(((b.left + b.width / 2) - scr.left) / scr.width * 100).toFixed(1)}%`);
    demo.style.setProperty('--ty', `${(((b.top + b.height * 0.45) - scr.top) / scr.height * 100).toFixed(1)}%`);
  }
  function play(){
    timers.forEach(clearTimeout); timers = []; running = true;
    const s = HERO_SCENES[n++ % HERO_SCENES.length];
    state(''); fill(s); step(0);
    new Image().src = HERO_SCENES[n % HERO_SCENES.length].img;   // the next scene's card, ready in time
    at(400, () => state('a1'));
    at(1300, () => state('a1 a2'));
    at(2250, () => state('a1 a2 a3'));
    at(2950, () => { aim(); step(1); state('a1 a2 a3 a4'); });
    at(3400, () => { step(2); state('a1 a2 a3 a4 a5'); });
    at(7900, () => state('a1 a2 a3'));   // the card closes back into the chat…
    at(8500, () => { if (onScreen && !document.hidden) play(); else running = false; });   // …and the next scene starts
  }
  if (reduceMotion){ fill(HERO_SCENES[0]); step(2); state('a1 a2 a3 a5'); return; }
  let shown = false;   // (from the moment the loading screen lifts)
  window.addEventListener('sent4u:hero-in', () => { shown = true; if (onScreen && !running) play(); }, { once: true });
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (shown && onScreen && !running) play(); }).observe(demo);
  document.addEventListener('visibilitychange', () => { if (shown && !document.hidden && onScreen && !running) play(); });
}

/* ---------------- How it works: a pinned page that slides right → left as you scroll ---------------- */
function initHow(){
  const wrap = document.getElementById('how');
  const track = document.getElementById('howTrack');
  if (!wrap || !track) return;
  const panels = [...wrap.querySelectorAll('.how-panel')];
  const cards = panels.map(p => p.querySelector('.how-card'));
  const segs = [...wrap.querySelectorAll('.hp-seg')];
  const bars = segs.map(sg => sg.querySelector('.hp-bar i'));
  const N = panels.length;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  let vw = 0, vh = 0, endX = 0, range = 1;

  // each card's contents pop in one after another as its step becomes active, in step with the scroll — not a timed
  // animation, a direct function of scroll position, so it scrubs and reverses exactly like everything else on this page
  const revealItems = cards.map(card => [...card.querySelectorAll('.hc-ui > *')]
    .flatMap(el => el.classList.contains('hc-steps') ? [...el.children] : [el]));
  const STAGGER = 0.1;
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; t = clamp(t, 0, 1); return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };

  function measure(){
    vw = window.innerWidth; vh = pinnedHeight();
    endX = -N * vw;                                     // every slide is one screen wide: the intro plus N panels
    range = Math.max(wrap.offsetHeight - 120 - vh, 1);  // the wrapper keeps 120px below the pinned part
  }
  // what was last written to each element: a value is written only when it changes (an unchanged write still costs a style pass)
  const was = new Map();
  const put = (el, key, v, write) => { const m = was.get(el) || {}; if (m[key] !== v){ m[key] = v; was.set(el, m); write(v); } };
  function render(p, now = 0){
    put(track, 't', `translate3d(${(endX * p).toFixed(1)}px,0,0)`, v => { track.style.transform = v; });
    const s = p * N; // slide position: 0 = the intro is centred, k = panel k is centred
    panels.forEach((_, k) => {
      const off = clamp(s - (k + 1), -1.2, 1.2); // -1 entering from the right … 0 centred … +1 leaving on the left
      // the cards move a little faster than their page and tilt as they pass: a bit of depth
      put(cards[k], 't', `translate3d(${(-off * vw * 0.08).toFixed(1)}px,0,0) rotate(${(off * 2.2).toFixed(2)}deg)`, v => { cards[k].style.transform = v; });
      const f = clamp(s - k, 0, 1);
      put(bars[k], 'f', f.toFixed(3), v => bars[k].style.setProperty('--f', v));
      segs[k].classList.toggle('is-done', f >= 0.999);
      segs[k].classList.toggle('is-active', f > 0 && (f < 0.999 || k === N - 1));
      revealItems[k].forEach((item, i) => {
        const r = reduceMotion ? 1 : easeOutBack((f - i * STAGGER) / (1 - i * STAGGER));
        put(item, 'r', r.toFixed(3), v => item.style.setProperty('--r', v));
      });
    });
  }

  let pS = -1, active = false, raf = 0, last = 0;
  function frame(now){
    if (!active){ raf = 0; return; }
    const p = clamp(-wrap.getBoundingClientRect().top / range, 0, 1);
    const dt = last ? now - last : 16.7; last = now;
    pS = pS < 0 || reduceMotion ? p : pS + (p - pS) * (1 - Math.exp(-dt / 70)); // Lenis already smooths the scroll; this only rounds it off
    render(pS, now);
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active && !raf){ pS = -1; last = 0; raf = requestAnimationFrame(frame); }
  }, { rootMargin: '150px' }).observe(wrap);
  onRealResize(measure);
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  render(0);
}

/* ---------------- Tides: the light backdrop behind sections 2–3, and the waves that rise over the hero and over section 3 ---------------- */
function initTides(){
  const main = document.getElementById('mainContent');
  const intro = document.getElementById('intro');
  const how = document.getElementById('how');
  const panel = document.getElementById('lightPanel');
  const light = document.getElementById('tideLight'), dark = document.getElementById('tideDark');
  if (!main || !intro || !how || !panel) return;
  const tides = [light, dark].map(el => el && { el, layers: [...el.querySelectorAll('.tide-layer')], last: [] });
  const flooding = !reduceMotion && tides.every(Boolean);
  document.body.classList.toggle('tide-on', flooding);

  const DELTA = 210;          // each tide reaches this far into the next section, where that section's own backdrop takes over
  const WH = 130;             // height of a wave's svg (matches --wh in the CSS)
  const F = 1.7;              // a wave climbs this many px for every px you scroll
  const LEADS = [92, 46, 0];  // how far each layer runs ahead of the last one (the last one is the destination colour)
  const SPREAD = 420;         // the layers fan out over this many px of climb, so they all rise out of the bottom edge together
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  function place(){
    const introTop = intro.offsetTop, howBottom = how.offsetTop + how.offsetHeight, vh = window.innerHeight;
    // the plain panel begins under the first tide (or right at the section when motion is reduced) and ends under the second
    const y0 = flooding ? introTop + DELTA - 2 : introTop, y1 = flooding ? howBottom + 2 : howBottom;
    panel.style.top = `${y0}px`; panel.style.height = `${Math.max(y1 - y0, 0)}px`;
    if (!flooding) return;
    light.style.top = `${introTop - vh}px`;  light.style.height = `${vh + DELTA}px`;
    dark.style.top = `${howBottom - vh}px`; dark.style.height = `${vh + DELTA}px`;
  }

  // A tide is an overlay covering the last screen before `boundary`. Its highest wave enters at the bottom of the screen when
  // you reach `start`, then climbs at F px per px scrolled; the other layers trail it by LEADS. Once the last layer is above the
  // top of the screen the overlay is one solid colour, identical to what lies beneath it.
  function render(){
    if (!flooding) return;
    const vh = window.innerHeight, sy = window.scrollY, howRange = Math.max(how.offsetHeight - 120 - pinnedHeight(), 1);
    const jobs = [
      [tides[0], intro.offsetTop, Math.max(0, intro.offsetTop - vh) + 0.12 * vh],                          // light: just after you leave the hero
      [tides[1], how.offsetTop + how.offsetHeight, how.offsetTop + howRange + 0.05 * vh],                  // dark: once the sliding page has unpinned
    ];
    for (const [tide, boundary, start] of jobs){
      const overlayTop = boundary - vh - sy;        // where the overlay's top is on screen
      const d = F * (sy - start);                   // how far the leading wave has climbed
      const spread = smoothstep01(d / SPREAD);
      tide.layers.forEach((layer, i) => {
        const crest = vh - d - LEADS[i] * spread;   // screen y of this layer's wave
        const t = clamp(crest - overlayTop + WH, 0, vh + DELTA + WH + 40);
        if (tide.last[i] === undefined || Math.abs(t - tide.last[i]) >= 0.25){
          tide.last[i] = t;
          layer.style.transform = `translate3d(0,${t.toFixed(1)}px,0)`;
        }
      });
    }
  }
  const smoothstep01 = x => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

  place(); render();
  window.addEventListener('scroll', render, { passive: true });
  onRealResize(() => { place(); tides.forEach(t => t && (t.last = [])); render(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { place(); render(); }).observe(main);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { place(); render(); });
}

/* ---------------- Letter-roll hover (nav, links, headings) ----------------
   Every letter becomes a two-line stack (the letter + a copy below it). On hover the stack
   slides up one line, staggered left to right, so the word appears to roll over. Links roll
   as a whole; headings roll one word at a time. Pure CSS transition — see .roll-* in style.css. */
function initLetterRoll(){
  if (reduceMotion || window.matchMedia('(hover: none)').matches) return;   // it only reacts to hovering, so a touch screen doesn't need it
  const targets = document.querySelectorAll(
    '.main-nav a, .text-link, .footer-col a, .menu-link-inner, .menu-social a, main h2, main h3'
  );
  targets.forEach($el => {
    if ($el.closest('.hero-text, .preloader, .phone-copy') || $el.dataset.rolled) return;
    $el.dataset.rolled = '1';
    const isHeading = /^H[23]$/.test($el.tagName);
    $el.classList.add(isHeading ? 'roll-heading' : 'rollable');
    if (!isHeading) $el.setAttribute('aria-label', $el.textContent.trim());

    // split every text node into words → letters, leaving child elements (<br>, spans) alone
    const walker = document.createTreeWalker($el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let i = 0;
    nodes.forEach($text => {
      const frag = document.createDocumentFragment();
      $text.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const $word = document.createElement('span');
        $word.className = 'roll-word';
        $word.setAttribute('aria-hidden', 'true');
        let w = 0;
        for (const ch of part){
          const $c = document.createElement('span');
          $c.className = 'roll-char';
          $c.style.setProperty('--i', isHeading ? w++ : i++);
          $c.innerHTML = '<span></span><span></span>';
          $c.children[0].textContent = $c.children[1].textContent = ch;
          $word.append($c);
        }
        frag.append($word);
      });
      $text.replaceWith(frag);
    });
    // headings keep their text for screen readers via a visually-hidden copy
    if (isHeading){
      const $sr = document.createElement('span');
      $sr.className = 'sr-only';
      $sr.textContent = $el.textContent.replace(/\s+/g, ' ').trim();
      $el.prepend($sr);
    }
  });
}

/* ---------------- Full-screen menu ---------------- */
function initMenu(){
  const $toggle = document.getElementById('menuToggle');
  const $overlay = document.getElementById('menuOverlay');
  if (!$toggle || !$overlay) return;
  const $label = $toggle.querySelector('.menu-pill-label');
  let open = false;

  function setOpen(next){
    if (next === open) return;
    open = next;
    document.body.classList.toggle('menu-open', open);
    $toggle.setAttribute('aria-expanded', String(open));
    $overlay.setAttribute('aria-hidden', String(!open));
    $overlay.inert = !open;
    $label.textContent = open ? 'Close' : 'Menu';
    if (lenis) open ? lenis.stop() : lenis.start();
    else document.documentElement.style.overflow = open ? 'hidden' : '';
    if (open) $overlay.querySelector('.menu-link').focus({ preventScroll: true });
    else $toggle.focus({ preventScroll: true });
  }

  $toggle.addEventListener('click', () => setOpen(!open));
  window.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  $overlay.querySelectorAll('a[href^="#"]').forEach($a => {
    $a.addEventListener('click', e => {
      const $dest = document.querySelector($a.getAttribute('href'));
      setOpen(false);
      if (!$dest) return;
      e.preventDefault();
      // let the overlay start lifting before the page scrolls underneath it
      setTimeout(() => {
        if (lenis) lenis.scrollTo($dest, { duration: 1.4 });
        else $dest.scrollIntoView({ behavior: 'smooth' });
      }, 260);
    });
  });
}

/* ---------------- Reviews: a tilted wall of cards, fed by assets/data/reviews.json, plus the leave-a-review form ---------------- */
const REVIEWS_URL = 'assets/data/reviews.json';
const PENDING_KEY = 'sent4u.reviews.pending';   // reviews this visitor sent, kept in their own browser until they appear in reviews.json
const LAST_SENT_KEY = 'sent4u.reviews.lastSent';
const REVIEW_TOOLS = { Send: '#7c5cff', Pixel: '#8fb84a', Pinky: '#ff2e7e', WinXP: '#3d8bff', 'Petal Isle': '#f08fb0', Picnic: '#e8843c', Heritage: '#b0314f', Salon: '#b0314f', Mission: '#d9a441', Halloween: '#8a5cff', 'Halloween Night': '#ff7a1a', Thanksgiving: '#d2691e', Marketplace: '#5ce1ff' };   // Salon: Heritage's old name, for reviews written before the rename

const pendingStore = {
  read(){ try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; } },
  write(list){ try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch {} },
};

// Everything that comes from the JSON file or from storage goes through here before it reaches the page: only known fields,
// clamped lengths, and it is only ever put into the DOM as text.
function cleanReview(r){
  if (!r || typeof r !== 'object') return null;
  const name = String(r.name || '').trim().slice(0, 40), text = String(r.text || '').trim().slice(0, 280);
  const rating = Math.round(Number(r.rating));
  if (!name || text.length < 10 || !(rating >= 1 && rating <= 5)) return null;
  return { name, text, rating, role: String(r.role || '').trim().slice(0, 40), tool: REVIEW_TOOLS[r.tool] ? r.tool : 'Marketplace', sample: r.sample === true, pending: r.pending === true };
}

function reviewCard(r){
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const card = mk('figure', 'rv-card' + (r.pending ? ' is-pending' : ''));
  card.style.setProperty('--c', REVIEW_TOOLS[r.tool]);
  const parts = r.name.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const who = mk('div', 'rv-who');
  who.append(mk('b', null, r.name), mk('small', null, r.role || (r.pending ? 'Only on this device' : 'sent4u user')));
  const top = mk('div', 'rv-top');
  top.append(mk('span', 'rv-avatar', (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase()), who, mk('span', 'rv-tool', r.pending ? 'Pending' : (r.tool === 'Marketplace' ? 'sent4u' : r.tool)));
  const stars = mk('div', 'rv-cardstars');
  stars.setAttribute('aria-label', `${r.rating} out of 5`);
  stars.append(mk('span', null, '★'.repeat(r.rating)));
  if (r.rating < 5) stars.append(mk('span', 'off', '★'.repeat(5 - r.rating)));
  card.append(top, stars, mk('blockquote', null, r.text));
  return card;
}

// an empty stand-in for a review: the shape of a card, no names, no words
function ghostCard(tool, lines){
  const mk = (tag, cls) => { const n = document.createElement(tag); n.className = cls; return n; };
  const card = mk('figure', 'rv-card rv-ghost');
  card.setAttribute('aria-hidden', 'true');
  card.style.setProperty('--c', REVIEW_TOOLS[tool]);
  const who = mk('div', 'rv-who'); who.append(mk('i', 'g g-name'), mk('i', 'g g-role'));
  const top = mk('div', 'rv-top'); top.append(mk('i', 'g g-av'), who);
  card.append(top, mk('i', 'g g-stars'));
  for (let i = 0; i < lines; i++){ const l = mk('i', 'g g-line'); l.style.width = i === lines - 1 ? '58%' : '100%'; card.append(l); }
  return card;
}
const GHOSTS = [['Send', 3], ['Pinky', 2], ['Marketplace', 4], ['Pixel', 3], ['WinXP', 2], ['Send', 4], ['Marketplace', 3], ['Pinky', 3]];

function initReviews(){
  const sec = document.getElementById('reviews');
  const stage = document.getElementById('rvStage'), wall = document.getElementById('rvWall');
  if (!sec || !stage || !wall) return;
  const cols = [...wall.querySelectorAll('.rv-col')];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // the score counts up when the section arrives (reduced motion: straight to the final numbers)
  let counters = [];
  const countUp = instant => {
    counters.forEach(a => a.pause());   // a count started before the numbers arrived must not overwrite the ones that did
    counters = [];
    sec.querySelectorAll('.rv-count').forEach(el => {
      const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10), suffix = el.dataset.suffix || '';
      const show = v => { el.textContent = v.toFixed(dec) + suffix; };
      if (instant) return show(to);
      const o = { v: 0 };
      counters.push(animate(o, { v: to, duration: 1600, delay: 250, ease: 'outExpo', onUpdate: () => show(o.v) }));
    });
  };

  // Repeat every column's cards so its endless loop (translateY 0 → -50%) has no seam: the track is made of 2·m copies of the
  // set, where m copies are at least as tall as the wall, so the loop never runs out of cards on screen.
  const originals = new Map(cols.map(col => [col, [...col.querySelector('.rv-track').children]]));
  function fill(){
    const need = wall.offsetHeight * 1.15;
    cols.forEach(col => {
      const track = col.querySelector('.rv-track');
      const set = originals.get(col);
      track.replaceChildren(...set);
      if (reduceMotion || !set.length || !track.offsetParent) return; // still wall, or hidden at this breakpoint
      const m = Math.max(1, Math.ceil(need / (track.scrollHeight || 1)));
      for (let i = 1; i < 2 * m; i++){
        set.forEach(card => {
          const copy = card.cloneNode(true);
          copy.setAttribute('aria-hidden', 'true');
          track.append(copy);
        });
      }
    });
  }
  // spread a list of reviews over the columns, each column starting somewhere different
  function place(list){
    cols.forEach((col, k) => {
      const per = Math.min(4, list.length);
      originals.set(col, Array.from({ length: per }, (_, j) => { const r = list[(k * 5 + j) % list.length]; return r.ghost ? ghostCard(r.tool, r.lines) : reviewCard(r); }));
    });
    fill();
  }

  // The copy has two states. With fewer than three real reviews it invites people to write one; from three up it shows the score
  // (worked out from the real reviews) under a headline that says what people think.
  const heading = sec.querySelector('h2'), lead = sec.querySelector('.rv-lead'), scoreBox = sec.querySelector('.rv-score'), facts = sec.querySelector('.rv-facts');
  function updateScore(real){
    const n = real.length;
    scoreBox.hidden = n < 1;
    facts.hidden = n < 3;
    if (n >= 3){
      const line = document.createElement('span'); line.className = 'rv-hl'; line.textContent = 'this way.';
      heading.replaceChildren('People love', document.createElement('br'), 'sending links ', line);
      lead.hidden = true;
    }
    if (!n) return;
    const avg = real.reduce((t, r) => t + r.rating, 0) / n, pct = Math.round(real.filter(r => r.rating >= 4).length / n * 100);
    const big = sec.querySelector('.rv-big .rv-count'), num = sec.querySelector('.rv-rating .rv-count');
    Object.assign(big.dataset, { count: avg.toFixed(1), decimals: '1' });
    Object.assign(num.dataset, { count: String(n), suffix: '' });
    sec.querySelector('.rv-word').textContent = n === 1 ? 'review' : 'reviews';
    sec.querySelector('.rv-fact-rec b').textContent = `${pct}%`;
    sec.querySelector('.rv-rating').setAttribute('aria-label', `Rated ${avg.toFixed(1)} out of 5`);
    if (sec.classList.contains('is-in')) countUp(reduceMotion);   // the section is already showing: count up to the real numbers
  }

  const api = (sec.dataset.api || '').trim().replace(/[/]+$/, '');   // the Worker that keeps reviews in R2 (empty: static file only)
  const apiMode = !!api;
  let published = [], showSamples = false;   // what the shared list (or reviews.json) holds
  function refresh(){
    const shared = published.filter(r => !r.sample), samples = published.filter(r => r.sample);
    const key = r => `${r.name}|${r.text}`.toLowerCase();
    const live = new Set(published.map(key));
    // Reviews sent from this browser. With a shared list they are ordinary cards, kept for a few minutes so they still show while the
    // list is cached. Without one they are marked Pending and only ever live in this browser.
    const now = Date.now(), stored = pendingStore.read();
    const kept = stored.filter(x => x && (!apiMode || now - Number(x.at || 0) < 10 * 60000));
    if (apiMode && kept.length !== stored.length) pendingStore.write(kept);
    const mine = kept.map(cleanReview).filter(Boolean).map(r => ({ ...r, pending: !apiMode }));
    const stillPending = mine.filter(r => !live.has(key(r)));           // already in the list: no double
    if (!apiMode && stillPending.length !== mine.length) pendingStore.write(stillPending);
    const shown = stillPending.concat(shared, showSamples ? samples : []);
    // until there are three real reviews, empty placeholder cards fill out the wall
    const ghosts = shown.length < 3 ? GHOSTS.map(([tool, lines]) => ({ ghost: true, tool, lines })) : [];
    place(shown.concat(ghosts));
    updateScore(shared);
  }
  const getJson = url => fetch(url, { cache: 'no-cache' }).then(res => res.ok ? res.json() : Promise.reject());
  (apiMode ? getJson(`${api}/reviews`).catch(() => getJson(REVIEWS_URL)) : getJson(REVIEWS_URL))
    .then(json => { published = (json.reviews || []).map(cleanReview).filter(Boolean); showSamples = json.showSamples === true; })
    .catch(() => {})
    .finally(refresh);
  initReviewForm(sec, {
    api,
    onAdded: review => {                        // a review that was just sent goes to the top of the wall at once
      if (review) published.unshift(review);
      refresh();
    },
  });

  let refill = 0;
  onRealResize(fill, 200);
  if (reduceMotion){
    sec.classList.add('is-in', 'is-still');
    countUp(true);
  } else {
    fill();
    const seen = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      sec.classList.add('is-in'); // the copy fades up, the stars pop in, the wall rises
      countUp(false);
      seen.disconnect();
    }, { threshold: 0.2 });
    seen.observe(sec);
  }

  // the card under the cursor lights up in its product's colour
  wall.addEventListener('pointermove', e => {
    const card = e.target.closest('.rv-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${(clamp((e.clientX - r.left) / r.width, 0, 1) * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(clamp((e.clientY - r.top) / r.height, 0, 1) * 100).toFixed(1)}%`);
  });
  if (reduceMotion) return;

  // the whole wall leans toward the cursor, and its columns drift against each other as the page scrolls
  const small = window.matchMedia('(max-width:760px)');
  const scene = sec.querySelector('.rv-scene'), inner = sec.querySelector('.rv-inner');
  let tx = 0, ty = 0, cx = 0, cy = 0, active = false, raf = 0, last = 0, lastTf = '', lastFade = '', lastDrift = '';
  sec.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.7, 0.7);
    ty = clamp((e.clientY - r.top) / r.height - 0.5, -0.7, 0.7);
  });
  sec.addEventListener('pointerleave', () => { tx = ty = 0; });

  function frame(now){
    if (!active){ raf = 0; return; }
    const dt = last ? Math.min(now - last, 64) : 16.7; last = now;
    const k = 1 - Math.exp(-dt / 180);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
    const lite = document.body.classList.contains('lite');
    const [rx, ry, rz] = lite ? [0, 0, 4] : small.matches ? [8, 0, 3] : [12, -10, 5];   // lite: a flat wall, no 3D
    const tf = `rotateX(${(rx - cy * 7).toFixed(2)}deg) rotateY(${(ry + cx * 9).toFixed(2)}deg) rotateZ(${rz}deg)`;
    if (tf !== lastTf){ wall.style.transform = tf; lastTf = tf; }
    const r = sec.getBoundingClientRect(), vh = window.innerHeight;
    const p = clamp((vh - r.top) / (vh + r.height), 0, 1); // 0 as the section enters, 1 as it leaves
    const ease = t => t * t * (3 - 2 * t);
    const fade = (ease(clamp(p / 0.3, 0, 1)) * (1 - ease(clamp((p - 0.7) / 0.3, 0, 1)))).toFixed(3); // in over the first 30% of the pass, out over the last 30%
    if (fade !== lastFade){ scene.style.opacity = fade; inner.style.opacity = fade; lastFade = fade; }
    const drift = p.toFixed(3);
    if (drift !== lastDrift){ lastDrift = drift; cols.forEach((col, i) => { col.style.transform = `translate3d(0,${((p - 0.5) * (i % 2 ? 130 : -130)).toFixed(1)}px,0)`; }); }
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active && !raf){ last = 0; raf = requestAnimationFrame(frame); }
  }, { rootMargin: '120px' }).observe(sec);
}

/* The leave-a-review dialog. With a Worker address in the section's data-api, a review is POSTed there as JSON and is on the wall the
   moment it is saved: no approval step. (The Worker checks everything again, limits how fast one visitor can post, and can ask for a
   Cloudflare Turnstile human check when data-turnstile holds a site key.) A copy is kept in this browser for a few minutes so it shows
   even while the shared list is still cached. With no Worker address, the review is only kept in this browser, marked "Pending". */
function initReviewForm(sec, { api, onAdded }){
  const modal = document.getElementById('reviewModal');
  if (!modal) return;
  const panel = modal.querySelector('.rvm-panel'), form = modal.querySelector('form'), done = modal.querySelector('.rvm-done');
  const errBox = modal.querySelector('.rvm-error'), counter = modal.querySelector('.rvm-count'), send = form.querySelector('.rvm-submit');
  const lockables = [document.getElementById('mainContent'), document.getElementById('siteHeader')].filter(Boolean);
  let lastFocus = null, closeTimer = 0;
  const turnstileKey = (sec.dataset.turnstile || '').trim();
  let turnstileToken = '', widgetId = null;
  function mountTurnstile(){                      // the human check loads the first time the dialog opens
    if (!api || !turnstileKey || widgetId !== null) return;
    const box = modal.querySelector('.rvm-turnstile');
    box.hidden = false;
    const ready = window.turnstile ? Promise.resolve() : new Promise(resolve => {
      const tag = document.createElement('script');
      tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      tag.async = true; tag.onload = resolve; tag.onerror = resolve;
      document.head.append(tag);
    });
    ready.then(() => {
      if (!window.turnstile || widgetId !== null) return;
      widgetId = window.turnstile.render(box, {
        sitekey: turnstileKey, theme: 'light',
        callback: token => { turnstileToken = token; },
        'expired-callback': () => { turnstileToken = ''; },
        'error-callback': () => { turnstileToken = ''; },
      });
    });
  }
  const resetTurnstile = () => { turnstileToken = ''; if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId); };
  const showError = msg => { errBox.textContent = msg; errBox.hidden = !msg; };

  function open(){
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    form.hidden = false; done.hidden = true; showError('');
    modal.hidden = false;
    lockables.forEach(el => { el.inert = true; });            // keeps focus (and screen readers) inside the dialog
    if (lenis) lenis.stop(); else document.documentElement.style.overflow = 'hidden';
    mountTurnstile();
    requestAnimationFrame(() => { modal.classList.add('is-open'); panel.focus({ preventScroll: true }); });
  }
  function close(){
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    lockables.forEach(el => { el.inert = false; });
    if (lenis) lenis.start(); else document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    closeTimer = setTimeout(() => { modal.hidden = true; }, 380);
  }
  document.querySelectorAll('[data-review-open]').forEach(b => b.addEventListener('click', open));
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  form.elements.text.addEventListener('input', e => { counter.textContent = `${e.target.value.length} / 280`; });
  form.addEventListener('input', () => showError(''));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const val = k => String(fd.get(k) || '').trim();
    const review = { rating: Number(fd.get('rating') || 0), tool: val('tool'), text: val('text'), name: val('name'), role: val('role') };
    const email = val('email');

    // a bot filled in the hidden field: look like it worked, send nothing
    if (val('website')){ form.hidden = true; done.hidden = false; return; }

    let problem = '';
    if (!review.rating) problem = 'Pick a star rating first.';
    else if (!review.tool) problem = 'Choose what you used.';
    else if (review.text.length < 20) problem = 'Tell us a little more — at least 20 characters.';
    else if (!review.name) problem = 'Add your name — a first name and initial is fine.';
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problem = 'That email address doesn’t look right.';
    else if (!fd.get('consent')) problem = 'Tick the box so we’re allowed to show your review.';
    else if (api && turnstileKey && !turnstileToken) problem = 'Please complete the human check first.';
    else if (Date.now() - Number(localStorage.getItem(LAST_SENT_KEY) || 0) < 30000) problem = 'That was quick — give it half a minute before sending another.';
    if (problem){ showError(problem); return; }

    send.disabled = true;
    const label = send.firstChild; const was = label.textContent; label.textContent = 'Sending…';
    let saved = null;                                     // the review as the shared list stored it
    if (api){
      const failed = message => {
        showError(message || 'We couldn’t send that just now. Please try again in a moment.');
        send.disabled = false; label.textContent = was;
        resetTurnstile();
      };
      try {
        const res = await fetch(`${api}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...review, email, consent: true, website: '', turnstileToken, page: location.href }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) return failed(out.error);
        saved = cleanReview(out.review);
      } catch { return failed(); }
      resetTurnstile();
    }
    try { localStorage.setItem(LAST_SENT_KEY, String(Date.now())); } catch {}
    pendingStore.write([{ ...review, at: Date.now() }].concat(pendingStore.read()).slice(0, 5));
    form.reset(); counter.textContent = '0 / 280';
    send.disabled = false; label.textContent = was;
    form.hidden = true; done.hidden = false;
    done.querySelector('.rvm-done-text').textContent = api
      ? 'Your review is on the wall now. Thank you for taking the time to write it!'
      : 'Your review is saved in this browser and shows on the wall marked Pending. Review collection isn’t switched on for this site yet, so it hasn’t been sent anywhere.';
    done.querySelector('h3').focus({ preventScroll: true });
    onAdded(saved);
  });
}

/* ---------------- Bridge: one wave that everything between the reviews and the pricing rides ----------------
   Everything on this canvas is driven by the same clock and the same wave function: the lattice of dots swells and glows as a crest
   passes, nine ribbons weave the crest, a formation of paper planes flies along the middle ribbon, and every time a crest reaches the
   centre a ring pulses out. Scrolling scrubs the wave forward and back, and the whole thing swells toward the middle of the pass.

   And you can play it:
     move    the dots part around the cursor and light up, the planes bend toward it as they pass, and fast movement stirs the whole wave up
     click   a shockwave rolls out from that spot (every dot it crosses jumps and glows) and a new paper plane launches from it onto the wave
     drag    pushes the wave sideways (it keeps its momentum when you let go); dragging up or down makes it taller or flatter */
function initBridge(){
  const sec = document.getElementById('bridge');
  const canvas = document.getElementById('bridgeCanvas');
  const hit = sec && sec.querySelector('.bridge-hit');   // the middle of the band, which takes the pointer
  const ctx = canvas && canvas.getContext('2d');
  if (!sec || !ctx || !hit) return;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const PALETTE = [[124, 92, 255], [255, 107, 157], [255, 201, 77]];    // the reviews' violet, then pink, then the pricing's gold
  const tint = u => {
    const s = clamp(u, 0, 1) * 2, i = Math.min(Math.floor(s), 1), f = s - i, a = PALETTE[i], b = PALETTE[i + 1];
    return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))];
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

  const ROWS = 7;             // rows of dots on either side of the middle line
  const RIBBONS = 9, MID = 4; // nine ribbons; the middle one is the flight path
  const OMEGA = 1.7;          // radians per second: the one clock
  const PERIOD = Math.PI * 2 / OMEGA;
  const LENS = 150;           // how far the cursor's push reaches, in px
  const SHOCK_LIFE = 1.7, SHOCK_SPEED = 560;
  let W = 0, H = 0, active = false, raf = 0, clock = 0, last = 0, rings = [], pulses = 0;

  // what the visitor is doing
  const ptr = { x: -9999, y: -9999, sx: -9999, sy: -9999, inside: false, lens: 0, down: false, moved: 0, lx: 0, ly: 0, lt: 0 };
  let energy = 0;             // 0–1: stirred up by quick movement, settles again
  let userPhase = 0, userVel = 0, userAmp = 0;       // the wave's phase and height as pushed by dragging
  let shocks = [], flyers = [];

  function resize(){
    const dpr = document.body.classList.contains('lite') ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
    W = sec.clientWidth; H = sec.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPlane(x, y, ang, col, trail){
    if (trail && trail.length > 1){                                 // a tail that follows the path the plane just took
      const t0 = trail[0], g = ctx.createLinearGradient(t0[0], t0[1], x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, rgba([255, 255, 255], 0.6));
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); trail.forEach(([tx, ty], i) => i ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty)); ctx.lineTo(x, y); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 30);
    glow.addColorStop(0, rgba(col, 0.55)); glow.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.2832); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(0.62, 0.62);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(-24, -19); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(216,210,255,.9)'; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(-11, 0); ctx.lineTo(-24, 19); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  let ribbonW = -1, ribbonGrads = [];
  const RIBBON_ORDER = Array.from({ length: RIBBONS }, (_, i) => i).sort((p, q) => Math.abs(q - MID) - Math.abs(p - MID));
  function draw(t, p, dt){
    const cy = H / 2, lam = Math.max(W * 0.6, 520), K = Math.PI * 2 / lam;
    const scrub = p * Math.PI * 5;                                    // scrolling moves the wave
    const swell = 0.55 + 0.45 * Math.sin(clamp(p, 0, 1) * Math.PI);  // biggest in the middle of the pass, calm at the ends
    const A = H * 0.15 * swell * (1 + 0.55 * energy + userAmp);
    const env = x => 0.55 + 0.45 * Math.exp(-Math.pow((x / W - 0.5) / 0.5, 2));    // a little stronger in the middle, but strong all the way across
    const phase = x => K * x - OMEGA * t - scrub - userPhase;
    // ribbon i of the nine: each is the same wave a little later than its neighbour and a little higher or lower, so together they weave a sheet
    const ribbonY = (x, i) => { const d = i - MID; return cy + d * H * 0.026 + A * (1 - Math.abs(d) * 0.05) * env(x) * Math.sin(phase(x) + 1.1 + d * 0.48); };

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // a soft light under the cursor
    if (ptr.lens > 0.02){
      const g = ctx.createRadialGradient(ptr.sx, ptr.sy, 0, ptr.sx, ptr.sy, LENS * 1.1);
      g.addColorStop(0, rgba(tint(ptr.sx / W), 0.2 * ptr.lens)); g.addColorStop(1, rgba(tint(ptr.sx / W), 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ptr.sx, ptr.sy, LENS * 1.1, 0, 6.2832); ctx.fill();
    }

    // the lattice: every dot's height, size and glow come from the wave; the cursor and any shockwaves push and light them too
    const lite = document.body.classList.contains('lite');   // fewer dots on a phone
    const N = lite ? Math.max(10, Math.round(W / 30)) : Math.max(12, Math.round(W / 24)), sx = W / N, sy = H * 0.058, rowStep = lite ? 2 : 1;
    for (let c = 0; c < N; c++){
      const x0 = (c + 0.5) * sx, col = tint(x0 / W), e = env(x0);
      for (let r = -ROWS; r <= ROWS; r += rowStep){
        const s = Math.sin(phase(x0) + r * 0.34), depth = 1 - Math.abs(r) / (ROWS + 2) * 0.55;
        let b = 0.5 + 0.5 * s, x = x0, y = cy + r * sy + A * e * s * (1 - Math.abs(r) / (ROWS + 2) * 0.4);
        if (ptr.lens > 0.01){
          const dx = x - ptr.sx, dy = y - ptr.sy, d = Math.hypot(dx, dy) || 1;
          if (d < LENS){ const f = Math.pow(1 - d / LENS, 2) * ptr.lens; x += dx / d * f * 40; y += dy / d * f * 40; b = Math.min(1, b + f * 0.75); }
        }
        for (const sh of shocks){
          const u = t - sh.t, dx = x - sh.x, dy = y - sh.y, d = Math.hypot(dx, dy) || 1;
          const k = Math.exp(-Math.pow((d - u * SHOCK_SPEED) / 48, 2)) * (1 - u / SHOCK_LIFE);
          if (k > 0.02){ x += dx / d * k * 16; y += dy / d * k * 16; b = Math.min(1, b + k * 0.9); }
        }
        const rad = (0.9 + 2.4 * b) * depth, alpha = (0.14 + 0.86 * b * b) * depth * (0.5 + 0.5 * e);
        ctx.fillStyle = rgba(col, alpha);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
        if (b > 0.86){ ctx.fillStyle = rgba(col, alpha * 0.16); ctx.beginPath(); ctx.arc(x, y, rad * 3.4, 0, 6.2832); ctx.fill(); }
      }
    }

    // a ring leaves the centre each time the wave completes a cycle
    const cycle = Math.floor(t / PERIOD);
    if (cycle !== pulses){ pulses = cycle; rings.push(t); }
    rings = rings.filter(t0 => t - t0 < 2.1);
    for (const t0 of rings){
      const u = (t - t0) / 2.1, rx = W * (0.05 + 0.52 * u), a = Math.pow(1 - u, 2) * 0.55;
      for (const [k, w] of [[1, 2.2], [0.72, 1]]){
        ctx.strokeStyle = rgba(tint(0.5 + (u - 0.5) * 0.4), a * (k === 1 ? 1 : 0.6)); ctx.lineWidth = w;
        ctx.beginPath(); ctx.ellipse(W / 2, cy, rx * k, rx * k * 0.26, 0, 0, 6.2832); ctx.stroke();
      }
    }
    // …and the ring of each click, spreading from where you clicked
    shocks = shocks.filter(sh => t - sh.t < SHOCK_LIFE);
    for (const sh of shocks){
      const u = (t - sh.t) / SHOCK_LIFE, R = (t - sh.t) * SHOCK_SPEED, a = Math.pow(1 - u, 1.6) * 0.6;
      ctx.strokeStyle = rgba(tint(sh.x / W), a); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, R, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = rgba([255, 255, 255], a * 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sh.x, sh.y, R * 0.82, 0, 6.2832); ctx.stroke();
    }

    // nine ribbons weave the wave, outer ones first so the middle one lies on top; they reach almost to both edges
    // (their gradients depend only on the band's width: made once per width, not every frame)
    if (ribbonW !== W){
      ribbonW = W;
      ribbonGrads = RIBBON_ORDER.map(i => {
        const d = Math.abs(i - MID), a = 0.86 - d * 0.1, g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, rgba(tint(0), 0)); g.addColorStop(0.06, rgba(tint(0.06), a)); g.addColorStop(0.3, rgba(tint(0.3), a)); g.addColorStop(0.5, rgba(tint(0.5), a));
        g.addColorStop(0.7, rgba(tint(0.7), a)); g.addColorStop(0.94, rgba(tint(0.94), a)); g.addColorStop(1, rgba(tint(1), 0));
        return g;
      });
    }
    for (let j = 0; j < RIBBON_ORDER.length; j++){
      const i = RIBBON_ORDER[j], d = Math.abs(i - MID);
      ctx.strokeStyle = ribbonGrads[j]; ctx.lineWidth = 2.7 - d * 0.36;
      ctx.beginPath();
      for (let x = -8; x <= W + 8; x += 8) x < 0 ? ctx.moveTo(x, ribbonY(x, i)) : ctx.lineTo(x, ribbonY(x, i));
      ctx.stroke();
    }

    // paper planes fly along the middle ribbon in a V, faster than the wave itself, so they climb and dive with it;
    // near the cursor they bend toward it
    const speed = OMEGA / K * 2.2, span = W + 260;
    for (let i = 0; i < (lite ? 3 : 5); i++){
      const rank = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1), off = side * rank * 15;
      const yAt = xq => {
        const base = ribbonY(xq, MID) + off;
        return ptr.lens > 0.02 ? base + (ptr.sy - base) * 0.3 * ptr.lens * Math.exp(-Math.pow((xq - ptr.sx) / 170, 2)) : base;
      };
      const x = (((t * speed - rank * 58) % span) + span) % span - 130, y = yAt(x);
      const trail = []; for (let j = 150; j > 0; j -= 10) trail.push([x - j, yAt(x - j)]);
      drawPlane(x, y, Math.atan2(yAt(x + 3) - yAt(x - 3), 6), tint(clamp(x / W, 0, 1)), trail);
    }
    // planes launched by clicks: they start where you clicked and settle onto the wave as they fly off
    for (const f of flyers){
      f.age += dt; f.x += speed * 1.5 * dt;
      const m = 1 - Math.exp(-f.age * 2.4), yAt = xq => lerp(f.y0, ribbonY(xq, MID), m), y = yAt(f.x);
      f.trail.push([f.x, y]); if (f.trail.length > 16) f.trail.shift();
      drawPlane(f.x, y, Math.atan2(yAt(f.x + 3) - yAt(f.x - 3), 6), tint(clamp(f.x / W, 0, 1)), f.trail);
    }
    flyers = flyers.filter(f => f.x < W + 140);
    ctx.globalCompositeOperation = 'source-over';
  }

  const progress = () => {
    const r = sec.getBoundingClientRect(), vh = window.innerHeight;
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  };
  // 30 fps: the band is a layer of its own, so the page still scrolls at the screen's full rate past it; its slow wave looks the
  // same, and the hundreds of dots it draws cost half as much (they were most of the work near the reviews and the prices)
  let minGap = 30;
  window.addEventListener('sent4u:lite', () => { minGap = 40; resize(); });
  function frame(now){
    if (!active){ raf = 0; return; }
    if (minGap && last && now - last < minGap){ raf = requestAnimationFrame(frame); return; }
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; clock += dt;
    if (tilt.active){                                       // on a phone the lean of the phone rolls the light around the band, like a marble
      ptr.x = W * (0.5 + tilt.x * 0.42); ptr.y = H * (0.5 + tilt.y * 0.3); ptr.inside = true;
      if (ptr.sx < -999){ ptr.sx = ptr.x; ptr.sy = ptr.y; }
      energy = Math.min(1, energy + Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) * 0.0016);   // a quick lean stirs the wave up
    }
    // ease the cursor's light and the drag's momentum
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt / 0.06)); ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt / 0.06));
    ptr.lens += ((ptr.inside ? 1 : 0) - ptr.lens) * (1 - Math.exp(-dt / 0.18));
    energy *= Math.exp(-dt / 0.9);
    if (!ptr.down){ userPhase += userVel * dt; userVel *= Math.exp(-dt / 0.9); userAmp *= Math.exp(-dt / 2.5); }
    draw(clock, progress(), dt);
    raf = requestAnimationFrame(frame);
  }

  resize();
  if (reduceMotion){ draw(1.2, 0.5, 0); window.addEventListener('resize', () => { resize(); draw(1.2, 0.5, 0); }); return; }

  // ---- playing with it: a mouse on a desktop. On a phone the tilt does it (see tilt.js) and the band leaves the page free to scroll
  if (!window.matchMedia('(hover: none)').matches){
    const place = e => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; };
    hit.addEventListener('pointerenter', e => { place(e); ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.inside = true; ptr.lx = e.clientX; ptr.ly = e.clientY; ptr.lt = e.timeStamp; });
    hit.addEventListener('pointerleave', () => { if (!ptr.down) ptr.inside = false; });
    hit.addEventListener('pointerdown', e => {
      place(e); ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.inside = true; ptr.down = true; ptr.moved = 0; ptr.lx = e.clientX; ptr.ly = e.clientY; ptr.lt = e.timeStamp;
      try { hit.setPointerCapture(e.pointerId); } catch {}          // keeps the drag going if the pointer leaves the band
      hit.classList.add('is-drag');
    });
    hit.addEventListener('pointermove', e => {
      place(e);
      const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly, dtm = Math.max(e.timeStamp - ptr.lt, 8);
      ptr.lx = e.clientX; ptr.ly = e.clientY; ptr.lt = e.timeStamp;
      energy = Math.min(1, energy + Math.hypot(dx, dy) / dtm * 0.02);     // quick movement stirs the wave up
      if (!ptr.down) return;
      ptr.moved += Math.hypot(dx, dy);
      if (ptr.moved > 6){                                                  // it is a drag, not a click
        userPhase += dx * 0.011;
        userVel = clamp(0.6 * userVel + 0.4 * (dx * 0.011 / (dtm / 1000)), -9, 9);
        userAmp = clamp(userAmp - dy * 0.004, -0.45, 0.9);
      }
    });
    const release = (e, cancelled) => {
      if (!ptr.down) return;
      ptr.down = false; hit.classList.remove('is-drag');
      if (!cancelled && ptr.moved < 6){                                    // a click: shockwave + a plane
        shocks.push({ x: ptr.x, y: ptr.y, t: clock }); shocks = shocks.slice(-6);
        flyers.push({ x: ptr.x, y0: ptr.y, age: 0, trail: [] }); flyers = flyers.slice(-8);
        energy = 1;
      }
      if (e.pointerType !== 'mouse') ptr.inside = false;
    };
    hit.addEventListener('pointerup', e => release(e, false));
    hit.addEventListener('pointercancel', e => release(e, true));
  }

  let rt = 0;
  onRealResize(resize, 200);
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active && !raf){ last = 0; raf = requestAnimationFrame(frame); } }, { rootMargin: '100px' }).observe(sec);
}

/* ---------------- Pricing: fanning 3D cards, foil, slot-machine prices, a star network that follows the cursor ---------------- */
function initPricing(){
  const sec = document.getElementById('pricing');
  if (!sec) return;
  const scene = document.getElementById('prScene');
  const cards = [...sec.querySelectorAll('.price-card')];
  const prices = [...sec.querySelectorAll('.pc-price[data-price]')];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // Each price is a row of odometer wheels (a strip of 0–9 twice over, so a roll can spin a whole turn before it lands); the point stays put.
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const buildOdo = (el, text, symbol = '$', after = false) => {
    const odo = mk('span', 'odo'); odo.setAttribute('aria-hidden', 'true');
    let k = 0;
    for (const ch of text){
      if (!/[0-9]/.test(ch)){ odo.append(mk('span', 'odo-dot', ch)); continue; }
      const strip = mk('span', 'odo-strip'); strip.style.setProperty('--k', k++);
      for (let i = 0; i < 20; i++) strip.append(mk('i', null, String(i % 10)));
      const col = mk('span', 'odo-col'); col.append(strip); odo.append(col);
    }
    const cur = mk('span', after ? 'pc-cur is-after' : 'pc-cur', symbol); cur.setAttribute('aria-hidden', 'true');
    el.replaceChildren(...(after ? [odo, cur] : [cur, odo]));
  };
  prices.forEach(el => buildOdo(el, el.dataset.price));
  const setPrice = (el, value) => {
    const digits = String(value).replace(/[^0-9]/g, '');
    [...el.querySelectorAll('.odo-strip')].forEach((strip, k) => strip.style.setProperty('--d', String(Number(digits[k] || 0) + 10))); // the second turn of the strip, so a change rolls the short way
    el.setAttribute('aria-label', el.dataset.label || `$${value}`);
  };
  const snapToZero = el => {                                // jump every wheel back to 0 without animating
    const strips = [...el.querySelectorAll('.odo-strip')];
    strips.forEach(st => { st.style.transition = 'none'; st.style.setProperty('--d', '0'); });
    void el.offsetWidth;
    strips.forEach(st => { st.style.transition = ''; });
  };

  // the prices start on 0 and roll to their numbers when the section arrives
  prices.forEach(snapToZero);
  const arrive = () => { sec.classList.add('is-in'); prices.forEach(el => setPrice(el, el.dataset.price)); };
  if (reduceMotion) arrive();
  else {
    const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting){ arrive(); seen.disconnect(); } }, { threshold: 0, rootMargin: '0px 0px 8% 0px' }); // starts as soon as the top edge arrives, so the heading is already there when the wave hands over
    seen.observe(sec);
  }

  // each card turns toward the cursor, is lit from where it points, and hovering it spins its price like a slot machine
  const rolledAt = new WeakMap();
  cards.forEach(card => {
    const inner = card.querySelector('.pc-inner'), fx = card.querySelector('.pc-fx'), price = card.querySelector('.pc-price[data-price]');
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduceMotion) return;
      const r = inner.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
      inner.style.transform = `perspective(800px) rotateX(${((0.5 - y) * 13).toFixed(2)}deg) rotateY(${((x - 0.5) * 16).toFixed(2)}deg)`;
      fx.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);       // only the two light layers read these
      fx.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    card.addEventListener('pointerenter', e => {
      if (!price || e.pointerType !== 'mouse' || reduceMotion || !sec.classList.contains('is-in')) return;
      const now = performance.now();
      if (now - (rolledAt.get(price) || 0) < 1800) return;   // once per visit, not on every twitch
      rolledAt.set(price, now);
      snapToZero(price);
      setPrice(price, price.dataset.price);
    });
  });

  if (reduceMotion) return;
  initPricingStars(sec, scene);

  // scroll: the cards fan in from the sides as the section approaches the middle of the screen and out again after; the scene fades with the section
  let active = false, raf = 0, lastFan = '', lastFade = '';
  const ease = t => t * t * (3 - 2 * t);
  const wide = window.matchMedia('(min-width:981px)');
  const fans = cards.map((card, i) => ({ el: card.querySelector('.pc-fan'), side: [-1, 1][i], lift: i === 1 ? 22 : 70, s: i === 1 ? 1.04 : 1 }));
  function frame(){
    if (!active){ raf = 0; return; }
    const r = sec.getBoundingClientRect(), vh = window.innerHeight;
    const fan = clamp((r.top + r.height / 2 - vh / 2) / (vh * 0.75), -1, 1), key = fan.toFixed(3);
    if (key !== lastFan){                              // the cards are moved directly (a custom property on the grid would restyle everything inside it)
      lastFan = key;
      for (const f of fans) f.el.style.transform = wide.matches ? `translate3d(0,${(fan * f.lift).toFixed(1)}px,0) rotateY(${(fan * f.side * -22).toFixed(2)}deg) scale(${(f.s - fan * fan * 0.05).toFixed(4)})` : '';
    }
    const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
    const fade = (ease(clamp(p / 0.3, 0, 1)) * (1 - ease(clamp((p - 0.7) / 0.3, 0, 1)))).toFixed(3);
    if (fade !== lastFade){ scene.style.opacity = fade; lastFade = fade; }
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active && !raf) raf = requestAnimationFrame(frame); }, { rootMargin: '120px' }).observe(sec);
}

/* A network of drifting stars behind the pricing cards: near neighbours join up with faint lines, the cursor pulls its own bright lines
   out of the stars around it, and now and then a comet crosses. It only runs while the section is on screen. */
function initPricingStars(sec, scene){
  const canvas = document.getElementById('prStars');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let w = 0, h = 0, pts = [], shots = [], mx = -9999, my = -9999, active = false, raf = 0, last = 0, clock = 0, nextShot = 1.2, minGap = 30;
  const LINK = 112, REACH = 190;
  const cursorLight = scene.querySelector('.pr-cursor');
  window.addEventListener('sent4u:lite', () => { minGap = 50; });

  function build(){
    const dpr = 1;                                    // thin lines and dots look the same at 1x, and this canvas is as tall as the section
    w = sec.clientWidth; h = sec.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(clamp(w * h / 15000, 34, 100));
    pts = Array.from({ length: n }, () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-14, 14), vy: rnd(-10, 10), r: rnd(0.7, 1.9), ph: rnd(0, 6.28), sp: rnd(0.6, 1.8) }));
  }
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  function frame(now){
    if (!active){ raf = 0; return; }
    if (last && now - last < minGap){ raf = requestAnimationFrame(frame); return; }   // slow drifting stars need ~30 fps, not 60
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now; clock += dt;
    ctx.clearRect(0, 0, w, h);

    for (const p of pts){
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      const dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy;
      if (d2 < REACH * REACH && d2 > 1){ const d = Math.sqrt(d2), pull = (1 - d / REACH) * 26 * dt; p.x += dx / d * pull * 4; p.y += dy / d * pull * 4; } // the stars lean toward the cursor
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++){
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++){
        const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > LINK * LINK) continue;
        ctx.strokeStyle = `rgba(170,150,255,${((1 - Math.sqrt(d2) / LINK) * 0.3).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const dx = mx - a.x, dy = my - a.y, d2 = dx * dx + dy * dy;
      if (d2 < REACH * REACH){
        ctx.strokeStyle = `rgba(255,120,175,${((1 - Math.sqrt(d2) / REACH) * 0.75).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
      }
      const tw = 0.4 + 0.45 * Math.sin(clock * a.sp + a.ph);
      ctx.fillStyle = `rgba(255,255,255,${tw.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
    }

    // comets
    nextShot -= dt;
    if (nextShot <= 0){ shots.push({ x: rnd(0, w * 0.7), y: rnd(-20, h * 0.25), vx: rnd(650, 950), vy: rnd(240, 420), age: 0, life: rnd(0.8, 1.2) }); nextShot = rnd(2.4, 5.2); }
    shots = shots.filter(s => s.age < s.life);
    for (const s of shots){
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const k = 1 - s.age / s.life, tail = 0.16;
      const g = ctx.createLinearGradient(s.x - s.vx * tail, s.y - s.vy * tail, s.x, s.y);
      g.addColorStop(0, 'rgba(160,140,255,0)'); g.addColorStop(1, `rgba(255,255,255,${(0.9 * k).toFixed(3)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x - s.vx * tail, s.y - s.vy * tail); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    raf = requestAnimationFrame(frame);
  }

  sec.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = sec.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    cursorLight.style.transform = `translate3d(${mx.toFixed(0)}px,${my.toFixed(0)}px,0)`; cursorLight.style.opacity = '1';
  });
  sec.addEventListener('pointerleave', () => { mx = my = -9999; cursorLight.style.opacity = '0'; });
  let rt = 0;
  onRealResize(build, 200);
  build();
  new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active && !raf){ last = 0; raf = requestAnimationFrame(frame); } }, { rootMargin: '80px' }).observe(sec);
}

/* ---------------- Performance ----------------
   1. A section that is well off screen stops animating: the browser would otherwise keep running every CSS animation on the page.
   2. If the page runs slowly on this machine (well under ~35 frames a second), a "lite" mode drops pure decoration and lightens
      the canvases. It is decided once the page has settled, from real frame times, and never switches off again. */
function initOffscreenPause(){
  const io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '250px 0px' });
  document.querySelectorAll('#hero, #how, #apps, #reviews, #bridge, #pricing, #cta, .tide, .site-footer').forEach(el => io.observe(el));
}

function initPerfGuard(){
  // ?lite forces the lite mode and ?nolite keeps it off (handy for testing). It is a class on <body>: the smooth-scroll library rewrites the class list of <html>.
  const query = new URLSearchParams(location.search);
  if (query.has('nolite')) return;
  if (query.has('lite')){ document.body.classList.add('lite'); window.dispatchEvent(new CustomEvent('sent4u:lite')); return; }
  if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700){   // phones and tablets: lighter from the start
    document.body.classList.add('lite'); window.dispatchEvent(new CustomEvent('sent4u:lite')); return;
  }
  if (reduceMotion) return;                                 // the timing tests below are for computers that haven't asked for less motion
  const goLite = () => { if (document.body.classList.contains('lite')) return; document.body.classList.add('lite'); window.dispatchEvent(new CustomEvent('sent4u:lite')); };

  // A laptop with built-in graphics can be smooth while the page sits still and stutter as soon as it scrolls, which the
  // still-page test below never sees: count the frames that miss a 60 Hz beat (over 30 ms) while the page is moving, and
  // eight of them within three seconds switch lite mode on — early, before the stutter is felt for long.
  let movedAt = 0, slow = [];
  window.addEventListener('scroll', () => { movedAt = performance.now(); }, { passive: true });
  (function watch(prev){
    requestAnimationFrame(now => {
      if (document.body.classList.contains('lite')) return;
      if (!document.hidden && now > 4000 && now - movedAt < 250 && now - prev > 30){   // (the first seconds are the loading screen)
        slow.push(now);
        slow = slow.filter(t => now - t < 3000);
        if (slow.length >= 8){ goLite(); return; }
      }
      watch(now);
    });
  })(performance.now());

  let attempts = 0;
  function sample(){
    const gaps = []; let last = 0;
    (function tick(now){
      if (document.hidden){ last = 0; return requestAnimationFrame(tick); }
      if (last) gaps.push(now - last);
      last = now;
      if (gaps.length < 90) return requestAnimationFrame(tick);
      gaps.sort((a, b) => a - b);
      if (gaps[gaps.length >> 1] > 28) goLite();            // the middle frame took over 28 ms: under ~35 fps
      else if (++attempts < 3) setTimeout(sample, 9000);
    })(performance.now());
  }
  setTimeout(sample, 5000);                                 // after the preloader and the first paint
}

/* ---------------- Preloader ---------------- */
function initPreloader(){
  const pre = document.getElementById('preloader');
  const fill = document.getElementById('preloaderFill');
  const pct = document.getElementById('preloaderPct');
  const word = document.getElementById('preloaderWord');

  if (reduceMotion) {
    pre.style.display = 'none';
    startHeroReveal();
    return;
  }

  animate(word, { opacity: [0, 1], scale: [.94, 1], duration: 700, ease: 'outCubic' });

  createTimer({
    duration: 1000,
    onUpdate: self => {
      const p = Math.round(self.progress * 100);
      fill.style.width = p + '%';
      pct.textContent = p;
    },
    onComplete: () => {
      animate(pre, {
        opacity: 0,
        duration: 500,
        ease: 'inOutQuad',
        onComplete: () => { pre.style.display = 'none'; }
      });
      startHeroReveal();
    }
  });
}

/* ---------------- Snake line: one continuous, wavy line with a paper plane at its head ----------------
   The route is a single smooth wave — a slow sine-like sweep from side to side as you go down the page,
   entering from the left under the hero. Nothing is random: the wave's wavelength and swing are derived
   from the viewport, and its steepness is capped so the plane never has to rush to keep up with the
   scroll (it moves at most ~1.5px along the line per px scrolled).                                  */
function initSnake(){
  const svg = document.getElementById('snake');
  const body = document.getElementById('snakeBody');
  const head = document.getElementById('snakeHead');
  const plane = document.getElementById('snakePlane');
  const grad = document.getElementById('snakeGrad');
  const glow = document.getElementById('snakeGlow');
  const main = document.getElementById('mainContent');
  const firstBelow = document.getElementById('intro'); // section 2 (first section under the hero)
  const howEl = document.getElementById('how'); // the line runs through section 2 and ends with the pinned section 3
  if (!svg || !body || !head || !plane || !main || !firstBelow || !howEl || reduceMotion){ if (svg) svg.style.display = 'none'; return; }

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const smooth = t => t * t * (3 - 2 * t);
  const $ = (sel, i = 0) => document.querySelectorAll(sel)[i] || null;

  // objects that light up softly as the plane passes their height
  const glowDefs = [
    () => $('.intro-card'),
  ];

  // offset position ignores CSS transforms (reveal slides, tilts), unlike getBoundingClientRect
  function pageBox(el){
    let x = 0, y = 0, n = el;
    while (n){ x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  // Centripetal Catmull-Rom -> cubic bezier through pts
  function ctrl(pa, pb, pc){
    const da = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) ** 0.5, db = Math.hypot(pc[0] - pb[0], pc[1] - pb[1]) ** 0.5;
    if (da < 1e-3) return [pb[0] + (pc[0] - pb[0]) / 3, pb[1] + (pc[1] - pb[1]) / 3];
    const k = 3 * da * (da + db), m = 2 * da * da + 3 * da * db + db * db;
    return [(da * da * pc[0] - db * db * pa[0] + m * pb[0]) / k, (da * da * pc[1] - db * db * pa[1] + m * pb[1]) / k];
  }
  function pathD(pts){
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++){
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const c1 = ctrl(p0, p1, p2), c2 = ctrl(p3, p2, p1);
      d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }

  let H = 0, W = 0, total = 0, bodyLen = 0, top = 0;
  let pin0 = -1, pin1 = -1; // page band (svg coordinates) where section 3 is pinned: the plane there is drawn by initHow
  const clipTop = document.getElementById('snakeClipTop'), clipBot = document.getElementById('snakeClipBot');
  let running = false, calm = 0, lastMainH = 0, lastMainW = 0;
  let cur = 0, target = 0; // position of the head along the path (chases `target` for a flowing feel)
  let sampleLen = [], sampleY = []; // path length -> y (y only ever increases along this line)
  let hits = []; // { el, len, on }

  function yToLen(y){
    let lo = 0, hi = sampleY.length - 1;
    while (lo < hi){ const mid = (lo + hi) >> 1; if (sampleY[mid] < y) lo = mid + 1; else hi = mid; }
    if (lo === 0) return sampleLen[0];
    const y0 = sampleY[lo - 1], y1 = sampleY[lo];
    return sampleLen[lo - 1] + (sampleLen[lo] - sampleLen[lo - 1]) * (y1 > y0 ? (y - y0) / (y1 - y0) : 0);
  }

  function build(){
    top = firstBelow.offsetTop;
    const vh = window.innerHeight;
    // Section 3 slides right → left while it is pinned, so the line hands over to the plane flying across that page (see
    // initHow) and ends there: before the pin the wave swings off the right edge, and the plane leaves at the left.
    const range = Math.max(howEl.offsetHeight - 120 - pinnedHeight(), 1);
    pin0 = howEl.offsetTop - top + vh * 0.7;   // where the head is when the pin starts (it rides at 70% of the screen)
    pin1 = pin0 + range;
    H = Math.max(pin1 + 40, 1);
    W = main.clientWidth;
    svg.style.top = top + 'px';
    svg.style.height = H + 'px';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    grad.setAttribute('y2', H);

    // ---- the wave: x = centre + swing(y) · sin(2π·y/λ + φ) ----
    const lam = clamp(vh * 2.1, 1300, 1900);              // one full S-sweep every ~2 screens
    const swingMax = Math.min(W * 0.33, lam * 1.3 / (Math.PI * 2)); // steepness cap: slope ≤ 1.3 → ≤ ~1.6px of line per px scrolled
    const phase = -Math.PI * 0.35;                         // starts heading right after coming in from the left
    const enter = Math.min(1100, H * 0.3);                   // length of the sweep-in from the left edge
    const pts = [];
    const step = lam / 14;
    const waveAt = y => {
      const swing = swingMax * (0.86 + 0.14 * Math.sin(y / (lam * 1.7) + 1.2)); // very slow breathing of the amplitude
      const w = W * 0.5 + swing * Math.sin(Math.PI * 2 * y / lam + phase);
      const k = smooth(clamp(y / enter, 0, 1));
      return (-0.06 * W) * (1 - k) + w * k;
    };

    const E = 1000, RIGHT = W * 1.09, LEFT = -W * 0.09;
    const xAt = y => {
      if (pin0 < 0) return waveAt(y);
      if (y >= pin1){ const b = smooth(clamp((y - pin1) / E, 0, 1)); return LEFT * (1 - b) + waveAt(y) * b; }
      if (y >= (pin0 + pin1) / 2) return LEFT;
      if (y >= pin0) return RIGHT;
      const a = smooth(clamp((y - (pin0 - E)) / E, 0, 1));
      return waveAt(y) * (1 - a) + RIGHT * a;
    };
    for (let y = 0; y <= H + step; y += step) pts.push([xAt(y), Math.min(y, H)]);
    if (clipTop && clipBot){ // hide the line inside the pinned band
      const y0 = pin0 < 0 ? H : pin0 - 40, y1 = pin0 < 0 ? H : pin1 + 40;
      clipTop.setAttribute('x', -W); clipTop.setAttribute('y', 0); clipTop.setAttribute('width', W * 3); clipTop.setAttribute('height', Math.max(y0, 0));
      clipBot.setAttribute('x', -W); clipBot.setAttribute('y', y1); clipBot.setAttribute('width', W * 3); clipBot.setAttribute('height', Math.max(H - y1, 0));
    }
    const d = pathD(pts);
    body.setAttribute('d', d); if (glow) glow.setAttribute('d', d);
    total = body.getTotalLength();
    bodyLen = Math.min(total * 0.9, vh * 1.15);
    body.style.strokeDasharray = `${bodyLen} ${total + bodyLen}`;
    if (glow) glow.style.strokeDasharray = body.style.strokeDasharray;

    // path length ↔ y lookup (monotonic in y because the line is a graph of y), and the points themselves every LUT px of
    // length: the frame reads them from here (getPointAtLength on a path this long costs a lot, three times a frame)
    sampleLen = []; sampleY = [];
    const n = Math.ceil(total / LUT) + 1;
    lutX = new Float32Array(n); lutY = new Float32Array(n);
    let maxY = -1;
    for (let i = 0; i < n; i++){
      const L = Math.min(i * LUT, total), pt = body.getPointAtLength(L);
      lutX[i] = pt.x; lutY[i] = pt.y;
      if (i % 2 === 0 || L === total){ maxY = Math.max(maxY, pt.y); sampleLen.push(L); sampleY.push(maxY); }
    }
    sampleLen.push(total); sampleY.push(Math.max(maxY, H));

    hits = glowDefs.map(g => g()).filter(Boolean).map(el => {
      const b = pageBox(el), len = yToLen(b.y + b.h * 0.45 - top);
      return { el, len, on: cur >= len - 40 };
    });
  }

  function readTarget(){
    const yWanted = clamp(window.scrollY + window.innerHeight * 0.7 - top, 0, H);
    target = yWanted >= H ? total + bodyLen * 0.2 : yToLen(yWanted);
    if (running || Math.abs(target - cur) > 0.05) wake();   // (a scroll further down the page, with the line long settled, changes nothing)
  }
  const LUT = 8;
  let lutX = new Float32Array(1), lutY = new Float32Array(1);
  const pointAt = len => {
    const f = clamp(len, 0, total) / LUT, i = Math.min(Math.floor(f), lutX.length - 2), k = f - i;
    if (i < 0) return { x: lutX[0], y: lutY[0] };
    return { x: lutX[i] + (lutX[i + 1] - lutX[i]) * k, y: lutY[i] + (lutY[i + 1] - lutY[i]) * k };
  };
  const shown = { dash: '', head: '', plane: '', op: '' };   // what was last written: nothing is written again unchanged
  // the line only draws while it is still moving; once it has settled it stops until the next scroll
  function wake(){ if (!running){ running = true; calm = 0; lastT = 0; requestAnimationFrame(frame); } }

  // the plane's heading is smoothed (shortest way round, capped turn rate) so it never snaps
  let ang = 0, bank = 0, vel = 0, dirSign = 1, lastT = 0, planeReady = false;
  const wrap = a => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  function frame(now){
    const dt = lastT ? Math.min(now - lastT, 100) : 16.7; lastT = now;
    const prev = cur;
    // soft chase with a speed limit: even after a big flick of the wheel the plane glides, it never rushes
    const maxStep = 1700 * dt / 1000;
    cur += clamp((target - cur) * (1 - Math.exp(-dt / 230)), -maxStep, maxStep);
    const headPos = clamp(cur, 0, total);
    const dash = (-(cur - bodyLen)).toFixed(1);
    if (dash !== shown.dash){ shown.dash = dash; body.style.strokeDashoffset = dash; if (glow) glow.style.strokeDashoffset = dash; }
    const pt = pointAt(headPos);

    // tangent from a short look-ahead / look-behind; face backwards while scrolling up
    const a1 = pointAt(Math.max(0, headPos - 44)), a2 = pointAt(Math.min(total, headPos + 44));
    vel += ((cur - prev) / dt * 16.7 - vel) * 0.12; // px moved per 60fps frame, smoothed
    if (Math.abs(vel) > 0.8) dirSign = vel > 0 ? 1 : -1;
    const want = Math.atan2(a2.y - a1.y, a2.x - a1.x) + (dirSign < 0 ? Math.PI : 0);
    if (!planeReady){ ang = want; planeReady = true; }
    const diff = wrap(want - ang);
    const maxTurn = 3 * dt / 1000; // ≤ ~170°/s
    ang += clamp(diff * (1 - Math.exp(-dt / 240)), -maxTurn, maxTurn);
    bank += (clamp(diff * 1.4, -0.7, 0.7) - bank) * (1 - Math.exp(-dt / 300)); // lean into the sweep
    const grow = smooth(clamp(cur / 90, 0, 1)) * smooth(clamp((total - cur) / 90, 0, 1)); // eases in at the start, out at the end
    const inPin = pin0 >= 0 && pt.y > pin0 - 40 && pt.y < pin1 + 40; // the pinned page has its own plane
    const op = cur <= 1 || cur >= total || inPin ? '0' : '1';
    if (op !== shown.op){ shown.op = op; head.style.opacity = op; }
    if (op === '1'){   // (a hidden plane needs no moving)
      const ht = `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`;
      const pl = `rotate(${(ang * 180 / Math.PI).toFixed(1)}) scale(${grow.toFixed(3)} ${(grow * Math.cos(bank)).toFixed(3)})`;
      if (ht !== shown.head){ shown.head = ht; head.setAttribute('transform', ht); }
      if (pl !== shown.plane){ shown.plane = pl; plane.setAttribute('transform', pl); }
    }

    for (const h of hits){
      if (!h.on && cur >= h.len - 40){
        h.on = true;
        h.el.classList.remove('snake-hit');
        void h.el.offsetWidth; // restart the animation if it's re-triggered
        h.el.classList.add('snake-hit');
      } else if (h.on && cur < h.len - 260){
        h.on = false;
      }
    }
    calm = (Math.abs(target - cur) > 0.05 || Math.abs(diff) > 0.002 || Math.abs(bank) > 0.002) ? 0 : calm + 1;
    if (calm > 24){ running = false; lastT = 0; return; }
    requestAnimationFrame(frame);
  }
  main.addEventListener('animationend', e => e.target.classList.remove('snake-hit'));

  build();
  readTarget();
  cur = target;
  hits.forEach(h => { h.on = cur >= h.len - 40; });
  window.addEventListener('scroll', readTarget, { passive: true });
  onRealResize(() => { build(); readTarget(); });
  // section heights change (images and fonts loading) — re-anchor, but only when the page really changed size, and not more than once in a while
  if ('ResizeObserver' in window){
    let timer = 0;
    lastMainH = main.clientHeight; lastMainW = main.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(main.clientHeight - lastMainH) < 2 && main.clientWidth === lastMainW) return;
      clearTimeout(timer);
      timer = setTimeout(() => { lastMainH = main.clientHeight; lastMainW = main.clientWidth; build(); readTarget(); }, 150);
    }).observe(main);
  }
  wake();
}

/* ---------------- The app: pinned phone driven by scroll ----------------
   One tall track with a sticky stage; scroll progress p (0..1) drives everything.
     0   → .28   the phone rises between a split headline · the card's chapters burst out of it as pills on dashed "signal" lines
     .28 → 1     the pills dock along the bottom as the nav · the phone plays Thanksgiving chapter by chapter (the real card, one
                 still per chapter) while the autumn farm behind it acts each one out: the farmhouse lights up and its door opens,
                 the string lights come on, a turkey pops up and fans its tail, a football flies over, the camera flashes. */
function initPhoneSection(){
  const track = document.getElementById('phoneTrack');
  if (!track) return;
  const $ = s => track.querySelector(s);
  const $$ = s => [...track.querySelectorAll(s)];
  const sticky = $('#phoneSticky'), phone = $('#phone'), intro = $('#phoneIntro'), ringCopy = $('#phoneRingCopy');
  const linksEl = $('#phoneLinks'), lines = $$('#phoneLinks line');
  const idle = $('.pscreen.idle'), idleLogo = $('.idle-logo'), glow = $('.phone-glow');
  const pills = $$('.tool-pill'), feat = $('.pfeature'), screen = $('.pscreen.s-tg'), word = $('.phone-word');
  const inner = feat.querySelector('.pf-inner'), shots = $$('.s-tg img');
  const CH = pills.length;   // the card's chapters, a pill each
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

  // On a phone (the lite mode) the phone mockup is one flat card: a stack of 3D layers with clipped, fading screens inside is just what a
  // phone's GPU drops (it showed up as screens that never appeared). The phone's own tilt takes the mouse's place.
  let flat = document.body.classList.contains('lite');
  window.addEventListener('sent4u:lite', () => { flat = true; });
  const wordsBox = $('.phone-words');

  // backdrop: the intro's navy, turning to Thanksgiving's dusk plum as the card comes on
  const BASE = [13, 10, 36], TINT = [42, 21, 56], DARK = [8, 8, 12];
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

  // phone body: a stack of rounded-rect layers between the front and back faces
  const LAYERS = 9, DEPTH = 15;
  for (let i = 0; i < LAYERS; i++){
    const l = document.createElement('i');
    l.style.transform = `translateZ(${(i / (LAYERS - 1) - 0.5) * DEPTH}px)`;
    if (i === 0) l.className = 'back';
    $('#phoneLayers').append(l);
  }
  // tiny paper planes drifting across the backdrop (same motif as the hero globe)
  const planeEls = [];
  for (let i = 0; i < 7; i++){
    const size = 20 + Math.random() * 20;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'phone-plane');
    svg.innerHTML = '<path d="M2.5 11.5 21.5 3 15 21 11 13.2z"/><path d="M11 13.2 21.5 3"/>';
    svg.style.cssText = `left:${Math.random() * 100}%;top:${10 + Math.random() * 80}%;width:${size}px;height:${size}px;opacity:${0.16 + Math.random() * 0.22}`;
    planeEls.push({ el: svg, vx: 120 + Math.random() * 260, vy: -(40 + Math.random() * 120), rot: -20 - Math.random() * 25 });
    $('#phonePlanes').append(svg);
  }

  // ---- Thanksgiving: the autumn farm behind the phone, drawn from the card's own things ----
  const tg = document.getElementById('phoneTg');
  const leaves = [], burst = [];
  const LEAF_COLORS = ['#e8742a', '#c8401f', '#f2b33d', '#d2691e', '#a8321e'];
  const MAPLE = '<path d="M12 1.5l2 4.4 3.2-1.5-.6 4.4 4.4-.5-2.3 3.3 2.9 1.9-4.4 1.4 1.1 3.3-4.2-1.4-.4 6.7h-1.4l-.4-6.7-4.2 1.4 1.1-3.3-4.4-1.4 2.9-1.9-2.3-3.3 4.4.5-.6-4.4L10 5.9z"/>';
  const OVAL = '<path d="M12 2C5 8 5 16 12 22c7-6 7-14 0-20z"/><path class="vein" d="M12 4v17"/>';
  function buildTgScene(root){
    let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    // stars: two twinkling layers of box-shadow dots in the upper sky
    const starsA = root.querySelector('.tg-stars'), starsB = starsA.cloneNode(); starsB.classList.add('b'); starsA.after(starsB);
    for (const layer of [starsA, starsB]){
      layer.style.boxShadow = Array.from({ length: 26 }, () =>
        `${(rnd() * 100).toFixed(1)}vw ${(rnd() * 46).toFixed(1)}vh 0 ${rnd() < 0.2 ? 1 : 0}px rgba(255,236,210,${(0.3 + rnd() * 0.6).toFixed(2)})`).join(',');
    }
    // string lights across the sky in two swags; each bulb lights when --l passes its own --i
    const SWAGS = [[[-2, 6], [24, 62], [50, 10]], [[50, 10], [76, 62], [102, 6]]];
    const BULBS = ['#ffcf6b', '#ff8a4c', '#ffe9a8', '#f25c54'];
    let n = 0;
    for (const [a, b, c] of SWAGS) for (let j = 0; j < 8; j++){
      const s = (j + 0.5) / 8, u = 1 - s;
      const x = u * u * a[0] + 2 * u * s * b[0] + s * s * c[0], y = u * u * a[1] + 2 * u * s * b[1] + s * s * c[1];
      const el = document.createElement('i');
      el.className = 'tg-bulb'; el.innerHTML = '<b></b>';
      el.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--i:${n};--c:${BULBS[n % 4]}`;
      root.querySelector('.tg-lights').append(el); n++;
    }

    // leaves drifting down over everything (fewer on a slow phone: see .lite in the CSS)
    for (let i = 0; i < 14; i++){
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'tg-leaf'); svg.innerHTML = i % 3 ? MAPLE : OVAL;
      svg.style.fill = LEAF_COLORS[i % 5];
      root.querySelector('.tg-leaves').append(svg);
      leaves.push({ el: svg, x0: rnd(), off: rnd(), vy: 34 + rnd() * 42, amp: 14 + rnd() * 34, f: 0.6 + rnd() * 0.9, ph: rnd() * 6.28,
                    vr: (rnd() < 0.5 ? -1 : 1) * (30 + rnd() * 80), s: 0.7 + rnd() * 0.8 });
    }
    // the family photo's burst of leaves, out from behind the phone
    for (let i = 0; i < 16; i++){
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'tg-leaf'); svg.innerHTML = i % 2 ? MAPLE : OVAL;
      svg.style.fill = LEAF_COLORS[(i + 2) % 5];
      root.querySelector('.tg-burst').append(svg);
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
      burst.push({ el: svg, dx: Math.cos(a), dy: Math.sin(a), r: 300 + rnd() * 300, rot: (rnd() - 0.5) * 540, s: 1.1 + rnd() * 0.9 });   // (far enough to clear the phone)
    }
  }
  if (tg) buildTgScene(tg);

  // ---- the farm itself: painted to the stage's own size (a phone's tall screen gets its own layout), in three depth layers that
  // drift a little apart as you scroll. Far: misty hills, tree lines, a barn and silo. Mid: the rolling field with its crop rows,
  // autumn trees, the path up to the farmhouse (its windows, door and porch light act out the chapters), the turkey, hay and
  // pumpkins. Front: grass and wheat in silhouette. Repainted only when the stage really changes size.
  const FARM = tg ? { far: tg.querySelector('.tg-far'), mid: tg.querySelector('.tg-mid'), front: tg.querySelector('.tg-front'), smoke: tg.querySelector('.tg-smoke'), motes: tg.querySelector('.tg-motes') } : null;
  const HOUSE = `<rect class="tg-chimney" x="512" y="190" width="18" height="46"/><rect class="tg-wall" x="360" y="252" width="200" height="100"/>
    <path class="tg-wall-shade" d="M360 252h200v14H360z"/>
    <path class="tg-roof" d="M344 258L460 182L576 258Z"/><path class="tg-roof-shade" d="M460 182L576 258H540L460 204z"/><path class="tg-trim" d="M344 258L460 182L576 258"/>
    <circle class="tg-win" cx="460" cy="228" r="11"/><path class="tg-mull" d="M449 228h22M460 217v22"/><rect class="tg-eave" x="350" y="252" width="220" height="10"/>
    <rect class="tg-win" x="378" y="276" width="46" height="46"/><rect class="tg-win" x="496" y="276" width="46" height="46"/>
    <path class="tg-mull" d="M401 276v46M378 299h46M519 276v46M496 299h46"/><path class="tg-shutter" d="M367 276h10v46h-10zM425 276h10v46h-10zM485 276h10v46h-10zM543 276h10v46h-10z"/>
    <rect class="tg-doorway" x="440" y="284" width="40" height="68"/>
    <g class="tg-door"><rect x="440" y="284" width="40" height="68"/><circle class="tg-wreath" cx="460" cy="304" r="8"/><path class="tg-bow" d="M456 311l4-3 4 3-4 2z"/></g>
    <circle class="tg-lamp-glow" cx="433" cy="292" r="16"/><circle class="tg-lamp-glow" cx="487" cy="292" r="16"/><circle class="tg-lamp" cx="433" cy="292" r="3.2"/><circle class="tg-lamp" cx="487" cy="292" r="3.2"/>
    <path class="tg-post" d="M352 262h8v90h-8zM560 262h8v90h-8z"/>
    <path class="tg-rail" d="M366 352V320M384 352V320M402 352V320M420 352V320M500 352V320M518 352V320M536 352V320M554 352V320M356 321H434M486 321H564"/>
    <rect class="tg-porch" x="346" y="350" width="228" height="9"/><path class="tg-step" d="M436 359h48v10h-48zM430 369h60v10h-60z"/>`;
  const FEATHERS = [['-76deg', '#b8323f', '#d9545e'], ['-51deg', '#e8742a', '#f59a52'], ['-25deg', '#f2b33d', '#ffd27a'], ['0deg', '#d2691e', '#ec8f45'],
                    ['25deg', '#f2b33d', '#ffd27a'], ['51deg', '#e8742a', '#f59a52'], ['76deg', '#b8323f', '#d9545e']];
  const TURKEY = `<g class="tg-tk"><g transform="translate(0 -40)">${FEATHERS.map(([a, c, l]) => `<g class="tg-fth" style="--a:${a}"><path fill="${c}" d="M0 0C-15 -16 -17 -48 0 -66C17 -48 15 -16 0 0Z"/><path fill="${l}" d="M0 -8C-7 -18 -8 -42 0 -56C8 -42 7 -18 0 -8Z"/></g>`).join('')}</g>
    <ellipse class="tg-body" cx="0" cy="-30" rx="24" ry="26"/><ellipse class="tg-belly" cx="0" cy="-24" rx="14" ry="15"/><path class="tg-wing" d="M-21 -36q-9 13 3 24 5-11-3-24zM21 -36q9 13-3 24-5-11 3-24z"/>
    <g class="tg-head"><circle class="tg-neck" cx="0" cy="-62" r="13"/><circle class="tg-eye" cx="-5" cy="-65" r="4.2"/><circle class="tg-eye" cx="5" cy="-65" r="4.2"/><circle class="tg-pupil" cx="-4.2" cy="-64.4" r="2.1"/><circle class="tg-pupil" cx="5.8" cy="-64.4" r="2.1"/>
    <circle class="tg-cheek" cx="-9.5" cy="-57.5" r="2.6"/><circle class="tg-cheek" cx="9.5" cy="-57.5" r="2.6"/><path class="tg-beak" d="M-3.4 -59.5h6.8L0 -53.5z"/><path class="tg-wattle" d="M1.6 -56q4.6 3.4 2.2 9.6-4.4.8-4.4-4.4z"/></g></g>`;
  const PUMPKIN = (x, y, s) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})"><ellipse class="tg-pk-rib" cx="-15" cy="-22" rx="19" ry="21"/><ellipse class="tg-pk-rib" cx="15" cy="-22" rx="19" ry="21"/>
    <ellipse class="tg-pk" cx="0" cy="-22" rx="18" ry="22"/><path class="tg-pk-stem" d="M-2 -42q1-8 7-10l2 3q-4 2-5 8z"/><path class="tg-pk-leaf" d="M3 -45q9-7 15-1-8 4-15 1z"/><ellipse cx="-6" cy="-30" rx="5" ry="9" fill="#fff" opacity=".14"/></g>`;
  const HAY = (x, y, s) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})"><rect class="tg-hay" x="-56" y="-44" width="112" height="44" rx="7"/>
    <path class="tg-hay-l" d="M-49 -28H49M-49 -14H49"/><path class="tg-twine" d="M-25 -42v40M25 -42v40"/></g>`;
  const TREE = (x, y, s, k) => { const c = [['#e8843c', '#c8552b', '#f2b33d'], ['#d9542a', '#a8321e', '#e8742a'], ['#f2b33d', '#d98c2a', '#ffd27a']][k];
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})"><path d="M-6 0c2-24 1-42-3-58h10c-2 16-3 34-1 58z" fill="#3a2214"/>
      <circle cx="-17" cy="-62" r="24" fill="${c[1]}"/><circle cx="15" cy="-67" r="27" fill="${c[0]}"/><circle cx="-2" cy="-88" r="25" fill="${c[2]}"/><circle cx="19" cy="-45" r="16" fill="${c[1]}"/>
      <circle cx="-9" cy="-84" r="10" fill="#fff" opacity=".13"/><circle cx="24" cy="-60" r="9" fill="#000" opacity=".1"/></g>`; };
  let farmKey = '';
  function paintFarm(W, H){
    if (!FARM || !W || !H) return;
    const key = `${W}x${H}`;
    if (key === farmKey) return;
    farmKey = key;
    const portrait = W / H < 0.9;
    const u = portrait ? clamp(W / 600, 0.5, 0.95) : clamp(Math.min(W / 1440, H / 900), 0.55, 1.3);
    let seed = 23; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const f = n => n.toFixed(1);
    const roll = (base, amp, waves, ph) => x => base + amp * (0.62 * Math.sin(x / W * Math.PI * waves + ph) + 0.38 * Math.sin(x / W * Math.PI * waves * 2.3 + ph * 1.7));
    const edge = (y, step = 14) => { let d = `M-4 ${f(y(0))}`; for (let x = step; x < W + step; x += step) d += `L${f(Math.min(x, W + 4))} ${f(y(Math.min(x, W)))}`; return d; };
    const under = y => `${edge(y)}L${W + 4} ${H + 80}L-4 ${H + 80}Z`;   // (past the bottom: the layers drift up and down a little)
    const yA = roll(H * (portrait ? 0.43 : 0.55), 26 * u, 2.2, 0.6), yB = roll(H * (portrait ? 0.49 : 0.615), 17 * u, 3.1, 2.1);
    const yM = roll(H * (portrait ? 0.565 : 0.695), 13 * u, 1.6, 4.0), yF = roll(H * (portrait ? 0.86 : 0.935), 9 * u, 2.4, 1.2);

    // far: two misty ranges, a tree line along the nearer one, a little barn and silo with a lit window
    let trees = '';
    for (let x = -10; x < W + 20; x += (7 + rnd() * 9) * u) { if (rnd() < 0.3) continue; const r = (5 + rnd() * 8) * u; trees += `<circle cx="${f(x)}" cy="${f(yB(x) + r * 0.3)}" r="${f(r)}"/>`; }
    const xb = W * (portrait ? 0.84 : 0.33), sb = 0.6 * u;
    FARM.far.setAttribute('viewBox', `0 0 ${W} ${H}`);
    FARM.far.innerHTML = `<defs><linearGradient id="tgFarA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0647e"/><stop offset=".6" stop-color="#7e4064"/></linearGradient>
        <linearGradient id="tgFarB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#70365a"/><stop offset=".7" stop-color="#4a2244"/></linearGradient>
        <linearGradient id="tgHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb38a" stop-opacity="0"/><stop offset="1" stop-color="#ffb38a" stop-opacity=".22"/></linearGradient></defs>
      <path d="${under(yA)}" fill="url(#tgFarA)"/>
      <rect x="0" y="${f(H * (portrait ? 0.38 : 0.5))}" width="${W}" height="${f(H * 0.14)}" fill="url(#tgHaze)"/>
      <g fill="#5a294d">${trees}</g><path d="${under(yB)}" fill="url(#tgFarB)"/>
      <g transform="translate(${f(xb)} ${f(yB(xb) + 3 * u)}) scale(${f(sb)})"><rect x="24" y="-60" width="20" height="60" rx="9" fill="#7a3346"/><path d="M24 -50a10 9 0 0 1 20 0z" fill="#a24f5c"/>
        <path d="M-30 0V-34l20-16 20 16V0z" fill="#8e2f2a"/><path d="M-34 -32l24-21 24 21-3 3-21-18-21 18z" fill="#5a1f1c"/><path d="M-16 0v-16h12V0z" fill="#5a1f1c"/>
        <rect class="tg-win" x="-15" y="-29" width="10" height="9"/></g>`;

    // mid: the field, its crop rows, autumn trees, the path to the house, the house and its yard
    const xh = W * (portrait ? 0.13 : 0.75), sh = (portrait ? 0.62 : 0.86) * u, yh = yM(xh) + 26 * sh;
    let rows = '';
    for (let k = 1; k <= 8; k++) rows += `<path d="${edge(x => yM(x) + Math.pow(k, 1.6) * 7 * u)}" fill="none" stroke="rgba(40,26,6,${(0.12 + k * 0.025).toFixed(3)})" stroke-width="${f((0.8 + k * 0.4) * u)}"/>`;
    const treeAt = portrait ? [[0.95, 1.05, 2], [0.86, 0.75, 0], [0.33, 0.55, 1]] : [[0.03, 1.25, 1], [0.11, 0.95, 0], [0.23, 0.7, 2], [0.52, 0.6, 1], [0.6, 0.5, 2], [0.9, 1.45, 0], [0.975, 1.05, 2]];
    const tx = W * (portrait ? 0.9 : 0.86), ty = yh + 18 * sh, ts = sh * 0.95;   // the turkey, beside the house
    const px0 = W * (portrait ? 0.5 : 0.58);
    const path = `M${f(xh - 12 * sh)} ${f(yh)}Q${f((xh + px0) / 2)} ${f(yh + (H - yh) * 0.25)} ${f(px0 - 120 * u)} ${f(H + 80)}L${f(px0 + 130 * u)} ${f(H + 80)}Q${f((xh + px0) / 2 + 40 * u)} ${f(yh + (H - yh) * 0.3)} ${f(xh + 12 * sh)} ${f(yh)}Z`;
    let fence = '';
    for (let i = 0; i < 9; i++) { const x = xh - (300 + i * 46) * sh; if (x < -20) break; const y = yM(x) + 30 * sh; fence += `M${f(x)} ${f(y)}v${f(-26 * sh)}`; }
    const pumpkins = (portrait ? [[0.62, 0.7, 0.55], [0.74, 0.6, 0.5]] : [[0.37, 0.75, 0.7], [0.42, 0.62, 0.55], [0.63, 0.7, 0.6], [0.68, 0.58, 0.5]])
      .map(([x, s, d]) => PUMPKIN(W * x, yM(W * x) + d * 90 * u, s * u)).join('');
    FARM.mid.setAttribute('viewBox', `0 0 ${W} ${H}`);
    FARM.mid.innerHTML = `<defs><linearGradient id="tgMeadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f7f36"/><stop offset=".35" stop-color="#6c5c27"/><stop offset="1" stop-color="#3a3016"/></linearGradient>
        <radialGradient id="tgSpill"><stop offset="0" stop-color="#ffcf73" stop-opacity=".6"/><stop offset="1" stop-color="#ffcf73" stop-opacity="0"/></radialGradient>
        <clipPath id="tgTk"><rect x="0" y="0" width="${W}" height="${f(ty - 2 * ts)}"/></clipPath></defs>
      ${treeAt.filter(([x]) => x < 0.5 || portrait).map(([x, s, k]) => TREE(W * x, yM(W * x) + 6 * u, s * u, k)).join('')}
      <path d="${under(yM)}" fill="url(#tgMeadow)"/>${rows}
      <path d="${path}" fill="#d9b076" opacity=".28"/>
      <path d="${fence}${fence ? `M${f(xh - 300 * sh)} ${f(yM(xh - 300 * sh) + 14 * sh)}L${f(Math.max(-20, xh - 668 * sh))} ${f(yM(Math.max(0, xh - 668 * sh)) + 14 * sh)}` : ''}" class="tg-fence-line" stroke-width="${f(5 * sh)}"/>
      ${treeAt.filter(([x]) => x >= 0.5 && !portrait).map(([x, s, k]) => TREE(W * x, yM(W * x) + 10 * u, s * u, k)).join('')}
      <ellipse class="tg-spill" cx="${f(xh)}" cy="${f(yh + 6 * sh)}" rx="${f(220 * sh)}" ry="${f(46 * sh)}" fill="url(#tgSpill)"/>
      <g transform="translate(${f(xh)} ${f(yh)}) scale(${f(sh)}) translate(-460 -379)">${HOUSE}</g>
      ${PUMPKIN(xh - 30 * sh, yh - 12 * sh, 0.34 * sh)}${PUMPKIN(xh + 34 * sh, yh - 10 * sh, 0.28 * sh)}
      <g clip-path="url(#tgTk)"><g style="transform:translateY(calc((1 - var(--t,0)) * ${f(124 * ts)}px))"><g transform="translate(${f(tx)} ${f(ty)}) scale(${f(ts)})">${TURKEY}</g></g></g>
      ${HAY(tx - 8 * ts, ty + 6 * ts, ts)}${pumpkins}`;
    // the chimney's smoke (HTML puffs, moved on the GPU): at the chimney's top, the same size as the house
    if (FARM.smoke) { FARM.smoke.style.cssText = `left:${f(xh + 61 * sh)}px;top:${f(yh - 198 * sh)}px;--s:${f(14 * sh)}px`; }

    // front: grass and wheat in silhouette along the bottom
    let blades = '';
    for (let x = -4; x < W + 4; x += 4.5 * u) {
      const y = yF(x) + 2, side = x < W * 0.18 || x > W * 0.82, h = (7 + rnd() * 20) * u * (side ? 1.8 : 1), lean = (rnd() - 0.5) * 12 * u;
      blades += `M${f(x - 2.2 * u)} ${f(y)}Q${f(x + lean * 0.4)} ${f(y - h * 0.6)} ${f(x + lean)} ${f(y - h)}Q${f(x + lean * 0.3)} ${f(y - h * 0.5)} ${f(x + 2.2 * u)} ${f(y)}Z`;
    }
    let wheat = '';
    for (const [a, b] of [[0, 0.12], [0.88, 1]]) for (let i = 0; i < 9; i++) {
      const x = W * (a + rnd() * (b - a)), y = yF(x) + 4, h = (60 + rnd() * 70) * u, lean = (rnd() - 0.5) * 26 * u;
      wheat += `<path d="M${f(x)} ${f(y)}Q${f(x + lean * 0.3)} ${f(y - h * 0.6)} ${f(x + lean)} ${f(y - h)}" class="tg-stalk" stroke-width="${f(1.6 * u)}"/><ellipse cx="${f(x + lean)}" cy="${f(y - h - 8 * u)}" rx="${f(3.4 * u)}" ry="${f(10 * u)}" transform="rotate(${f(lean / u * 1.2)} ${f(x + lean)} ${f(y - h - 8 * u)})" class="tg-head-w"/>`;
    }
    FARM.front.setAttribute('viewBox', `0 0 ${W} ${H}`);
    FARM.front.innerHTML = `${wheat}<path d="${under(yF)}" class="tg-front-ground"/><path d="${blades}" class="tg-front-ground"/>`;

    // fireflies over the field
    if (FARM.motes && !FARM.motes.childElementCount) {
      for (let i = 0; i < 12; i++) { const m = document.createElement('i'); m.style.cssText = `left:${f(4 + rnd() * 92)}%;top:${f((portrait ? 50 : 62) + rnd() * 30)}%;animation-delay:${f(-rnd() * 7)}s;animation-duration:${f(5 + rnd() * 5)}s`; FARM.motes.append(m); }
    }
  }

  // ---- timing ----
  // the intro plays p 0 → F0; the card is on from ON, and its chapters share p ON → T1 (the rest lets the family photo sit a moment).
  // U is one "beat" of the spotlight's scroll, used to stage the copy and the phone.
  const F0 = 0.28, U = (1 - F0) / 4, ON = F0 + 0.025 * U, T1 = 1 - 0.275 * U;
  const chapterP = c => Math.max(F0 + 0.36 * U, lerp(ON, T1, (c + 0.3) / CH));   // where a pill jumps to
  // the intro keeps its own length of scroll however long the spotlight is: the track's first INTRO of scroll plays p 0 → F0
  const INTRO = 0.22;
  const toP = r => r < INTRO ? r * F0 / INTRO : F0 + (r - INTRO) * (1 - F0) / (1 - INTRO);
  const toR = p => p < F0 ? p * INTRO / F0 : INTRO + (p - F0) * (1 - INTRO) / (1 - F0);
  let W = 0, H = 0, S = 1, mobile = false, keys = [], scatter = [], dockPos = [], dockY = 0, dockScale = 1;
  const pose = (x, y, s, rx, ry, rz) => ({ x, y, s, rx, ry, rz });
  function measure(){
    W = window.innerWidth; H = (document.getElementById('phoneSticky') || {}).clientHeight || window.innerHeight; mobile = W <= 900;
    S = mobile ? Math.min(H * 0.45 / 580, W * 0.66 / 280) : clamp(H * 0.7 / 580, 0.5, 1.2);
    const py = mobile ? -H * 0.17 : 0, y0 = mobile ? H * 0.14 : 0;
    intro.style.setProperty('--gap', `${Math.round(280 * S + 70)}px`);
    const card = pose(0, py, S, 3, -15, 3);   // turned a little toward its copy
    keys = [
      [0,    pose(0, y0 + H * 0.55, S * 0.92, 0, -20, 8)],
      [0.08, pose(0, y0, S, 5, -12, 4)],
      [0.16, pose(0, y0 * 0.6, S * 1.02, 4, 10, -3)],
      [0.27, pose(0, 0, S, 3, -8, 3)],
      [F0 + 0.3 * U, card],
      [1, card],
    ];

    // where the pills scatter to (loose, sticker-like) and where they dock (a row along the bottom)
    const ux = clamp(Math.min(W * 0.34, H * 0.5), 110, 340), uy = clamp(H * 0.28, 120, 260);
    scatter = [[-0.95, -0.7, -6], [0.92, -0.85, 5], [-0.9, 0.5, -4], [0.98, -0.05, -3], [0.9, 0.72, 7]]
      .map(([a, b, r]) => ({ x: a * ux, y: b * uy, r }));
    const gap = 8, ws = pills.map(p => p.offsetWidth);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (CH - 1);
    dockScale = Math.min(1, (W - 32) / total);
    let x = -total * dockScale / 2;
    dockPos = ws.map(w => { const cx = x + w * dockScale / 2; x += (w + gap) * dockScale; return cx; });
    dockY = H / 2 - (mobile ? 40 : 52);
    paintFarm(W, H);
  }
  function poseAt(p){
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++){
      if (p <= keys[i][0]){
        const [pa, a] = keys[i - 1], [pb, b] = keys[i];
        const t = pb > pa ? smooth((p - pa) / (pb - pa)) : 1;
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t),
                 rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), rz: lerp(a.rz, b.rz, t) };
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---- the farm: everything on it is a function of the chapter progress t, so it plays forward and back with the scroll in step
  // with the chapter on the phone (t 0–.2 come on in · .2–.4 the table · .4–.6 the wishbone · .6–.8 game day · .8–1 the family photo).
  // Only the leaves also drift with time.
  const tgVars = {}, ball = tg && tg.querySelector('.tg-ball'), flash = tg && tg.querySelector('.tg-flash'), moon = tg && tg.querySelector('.tg-moon');
  const planesBox = $('#phonePlanes');
  let tgLive = false, tgOp = '', ballOn = false, burstOn = false;
  const setVar = (k, v) => { const s = v.toFixed(3); if (tgVars[k] !== s){ tgVars[k] = s; tg.style.setProperty(k, s); } };
  function renderTg(t, ws, cx, cy, now){
    const live = ws > 0.005;
    if (live !== tgLive){ tgLive = live; tg.classList.toggle('is-live', live); }
    const op = ws.toFixed(3);
    if (op !== tgOp){ tgOp = op; tg.style.opacity = op; if (planesBox) planesBox.style.opacity = (1 - ws).toFixed(3); }   // the paper planes give the sky to the leaves
    if (!live) return;

    setVar('--w', smooth(seg(t, 0.02, 0.09)));     // 1 · "Come on in": the farmhouse lights up…
    setVar('--d', smooth(seg(t, 0.09, 0.17)));     //     …and its door swings open
    setVar('--l', seg(t, 0.21, 0.35));             // 2 · "The table": the string lights come on, bulb by bulb
    setVar('--t', smooth(seg(t, 0.41, 0.48)));     // 3 · "Wishbone": a turkey pops up behind the hay and fans its tail
    const f = smooth(seg(t, 0.81, 0.87));
    setVar('--f', f);                              // 5 · "Family photo": the moon glows

    // 4 · "Game day": a football spirals over the farm
    const b = seg(t, 0.61, 0.77);
    if (b > 0 && b < 1){
      const x = lerp(-0.08, 1.08, b) * W, y = H * (0.42 - Math.sin(b * Math.PI) * 0.33);   // (its peak passes over the phone, not behind it)
      ball.style.opacity = (seg(b, 0, 0.05) * (1 - seg(b, 0.95, 1))).toFixed(3);
      ball.style.transform = `translate3d(${(x - 23).toFixed(1)}px,${(y - 13).toFixed(1)}px,0) rotate(${(-30 + b * 60).toFixed(1)}deg) scaleX(${(0.85 + 0.15 * Math.cos(b * 40)).toFixed(3)})`;
      ballOn = true;
    } else if (ballOn){ ballOn = false; ball.style.opacity = '0'; }

    // 5 · the camera flashes, and a burst of leaves flies out from behind the phone
    flash.style.opacity = (smooth(seg(t, 0.815, 0.825)) * (1 - smooth(seg(t, 0.825, 0.9))) * 0.85).toFixed(3);
    const fb = seg(t, 0.82, 0.96), bo = smooth(seg(t, 0.82, 0.85)) * (1 - seg(t, 0.93, 0.99));
    if (bo > 0.002){
      burstOn = true;
      const e = 1 - Math.pow(1 - fb, 3);
      burst.forEach(s => {
        s.el.style.opacity = bo.toFixed(3);
        s.el.style.transform = `translate3d(${(cx + s.dx * s.r * e - 11).toFixed(1)}px,${(cy + s.dy * s.r * e + fb * fb * 70 - 11).toFixed(1)}px,0) rotate(${(s.rot * fb).toFixed(1)}deg) scale(${s.s.toFixed(2)})`;
      });
    } else if (burstOn){ burstOn = false; burst.forEach(s => { s.el.style.opacity = '0'; }); }

    moon.style.transform = `translate3d(0,${((1 - t) * 30).toFixed(1)}px,0) scale(${(1 + f * 0.06).toFixed(3)})`;
    if (FARM) for (const [el, k] of [[FARM.far, 8], [FARM.mid, 18], [FARM.smoke, 18], [FARM.front, 34]]){
      const v = `translate3d(0,${((0.5 - t) * k).toFixed(1)}px,0)`;
      if (el && el.dataset.t !== v){ el.dataset.t = v; el.style.transform = v; }
    }
    // the leaves fall with time (and a little faster as you scroll), swaying as they go
    const s = reduceMotion ? 0 : now / 1000, span = H + 80;
    leaves.forEach(L => {
      const y = ((s * L.vy + L.off * span + t * H * 0.8) % span) - 40;
      const x = L.x0 * W + Math.sin(s * L.f + L.ph + t * 5) * L.amp;
      L.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(L.ph * 57 + s * L.vr + t * 220).toFixed(1)}deg) scale(${L.s.toFixed(2)})`;
    });
  }

  // ---- one frame ----
  let cur = -2, mx = 0, my = 0, tmx = 0, tmy = 0, lastTint = '';
  function render(p, now){
    const w = smooth(seg(p, 0.2, F0));   // how much the card owns the stage (0 → 1 as the intro ends)
    let c = BASE.map((v, i) => lerp(v, TINT[i], w));
    if (p > 0.93) c = mix(c, DARK, smooth(seg(p, 0.93, 1)));   // settle back to the page colour before the next section
    const tint = `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
    if (tint !== lastTint){ lastTint = tint; sticky.style.backgroundColor = tint; }
    glow.style.opacity = 1 - w * 0.6;
    const q = poseAt(p);
    const bob = reduceMotion ? 0 : Math.sin(now * 0.0012) * 6;
    const t = seg(p, ON, T1);
    if (tg) renderTg(t, w, W / 2 + q.x, H / 2 + q.y + bob, now);
    if (flat){
      phone.style.transform =
        `perspective(1200px) translate3d(${q.x}px,${q.y + bob}px,0) rotateX(${(-my * 14).toFixed(2)}deg) rotateY(${(mx * 18).toFixed(2)}deg) rotateZ(${q.rz}deg) scale(${q.s})`;
      if (wordsBox) wordsBox.style.transform = `translate3d(${(-mx * 18).toFixed(1)}px,${(-my * 10).toFixed(1)}px,0)`;   // the big word sits further back
    } else {
      phone.style.transform =
        `translate3d(${q.x}px,${q.y + bob}px,0) rotateX(${q.rx - my * 4}deg) rotateY(${q.ry + mx * 5}deg) rotateZ(${q.rz}deg) scale(${q.s})`;
      planeEls.forEach(({ el, vx, vy, rot }) => { el.style.transform = `translate3d(${p * vx}px,${p * vy}px,0) rotate(${rot}deg)`; });
    }

    const io = seg(p, 0.07, 0.14);
    intro.style.opacity = 1 - io;
    intro.style.transform = `translate3d(0,${-io * 40}px,0)`;
    ringCopy.style.opacity = seg(p, 0.16, 0.2) * (1 - seg(p, 0.26, 0.3));
    idleLogo.style.opacity = 1 - seg(p, 0.05, 0.11);

    // pills: burst out of the phone → scatter → dock along the bottom as the chapter nav
    const appear = seg(p, 0.08, 0.15), fly = smooth(seg(p, 0.15, 0.25)), dock = smooth(seg(p, F0, F0 + 0.39 * U));
    const cy = H / 2 + q.y, cx = W / 2;
    const linkOp = fly * (1 - smooth(seg(p, 0.25, 0.31)));
    linksEl.style.opacity = linkOp;
    pills.forEach((el, k) => {
      const sc = scatter[k];
      const wob = reduceMotion ? 0 : Math.sin(now * 0.0011 + k * 1.7) * 6 * (1 - dock);
      const x = lerp(lerp(0, sc.x, fly), dockPos[k], dock);
      const y = lerp(lerp(0, sc.y, fly) + wob, dockY, dock);
      const s = lerp(0.4, 1, appear) * lerp(1, dockScale, dock);
      el.style.opacity = appear;
      el.style.transform = `translate(-50%,-50%) translate3d(${x}px,${y}px,0) rotate(${sc.r * fly * (1 - dock)}deg) scale(${s})`;
      el.classList.toggle('is-live', appear > 0.8);
      if (linkOp > 0.01){   // the dotted lines are only redrawn while they can be seen
        const ln = lines[k];
        ln.setAttribute('x1', cx); ln.setAttribute('y1', cy);
        ln.setAttribute('x2', cx + x); ln.setAttribute('y2', H / 2 + y);
        ln.style.strokeDashoffset = reduceMotion || flat ? 0 : -now * 0.02;
      }
    });

    // the copy and the giant word behind the phone
    const inn = seg(p, F0 + 0.12 * U, F0 + 0.34 * U);
    feat.style.visibility = inn > 0.01 ? 'visible' : 'hidden';
    inner.style.opacity = inn;
    inner.style.transform = `translate3d(0,${(1 - inn) * 34}px,0)`;
    const wi = seg(p, F0 - 0.1 * U, F0 + 0.3 * U);
    word.style.opacity = wi;
    word.style.transform = `translate3d(${(1 - wi) * W * 0.35}px,-50%,0)`;

    // what the phone shows: the logo, then the card's chapter (its still, and its pill lit in the dock)
    const ch = p < ON ? -1 : Math.min(CH - 1, Math.floor(t * CH));
    if (ch !== cur){
      const was = cur; cur = ch;
      if ((was < 0) !== (ch < 0)){ idle.dataset.s = ch < 0 ? 'on' : 'before'; screen.dataset.s = ch < 0 ? 'after' : 'on'; }
      if (ch >= 0) shots.forEach((im, i) => im.classList.toggle('is-on', i === ch));
      pills.forEach((b, i) => b.classList.toggle('is-on', i === ch));
    }
  }

  let pS = -1, active = false, raf = 0, last = 0;
  function frame(now){
    if (!active){ raf = 0; return; }
    const r = track.getBoundingClientRect();
    const p = toP(clamp(-r.top / Math.max(r.height - H, 1), 0, 1));
    // exponential smoothing that doesn't depend on the frame rate (≈ .14 per frame at 60fps)
    const dt = last ? now - last : 16.7; last = now;
    pS = pS < 0 || reduceMotion ? p : pS + (p - pS) * (1 - Math.exp(-dt / 110));
    if (tilt.active){ tmx = tilt.x; tmy = tilt.y; }   // a phone: its lean stands in for the mouse
    const k = 1 - Math.exp(-dt / (tilt.active ? 120 : 265));
    mx += (tmx - mx) * k; my += (tmy - my) * k;
    render(pS, now);
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active && !raf){ pS = -1; last = 0; raf = requestAnimationFrame(frame); }
  }, { rootMargin: '200px' }).observe(track);

  if (!reduceMotion && !window.matchMedia('(hover: none)').matches){
    window.addEventListener('mousemove', e => { tmx = (e.clientX / W - 0.5) * 2; tmy = (e.clientY / H - 0.5) * 2; }, { passive: true });
  }
  onRealResize(measure);
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure); // pill widths depend on the webfont
  render(0, 0);

  // a pill jumps straight to its chapter
  function goTo(c){
    const r = track.getBoundingClientRect();
    const y = window.scrollY + r.top + toR(chapterP(c)) * (r.height - H);
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  pills.forEach(b => b.addEventListener('click', () => goTo(+b.dataset.k)));
}

/* ---------------- The styles: one list drives the order dialog, the account view and the gallery ----------------
   id = what the orders server and the gateway call it (see worker/ and gateway/); the demo link is /?share=test-<id>.
   live: false = not deployed yet: shown as "coming soon" and left out of the order dialog. */
const STYLES = [
  { id: 'thanksgiving', name: 'Thanksgiving', blurb: 'The whole family at the farmhouse', color: '#d2691e', glyph: '❦', group: 'holiday', live: true },
  { id: 'pixel',     name: 'Pixel',      blurb: 'A Game Boy love letter',                  color: '#6d9b3a', glyph: 'px', group: 'date', live: true },
  { id: 'pinky',     name: 'Pinky',      blurb: 'Neon, after dark',                        color: '#ff2e7e', glyph: '♥',  group: 'date', live: true },
  { id: 'winxp',     name: 'WinXP',      blurb: 'A retro desktop',                         color: '#2a63d8', glyph: 'xp', group: 'date', live: true },
  { id: 'petal',     name: 'Petal Isle', blurb: 'A floating island to explore together',  color: '#f08fb0', glyph: '✿',  group: 'date', live: true },
  { id: 'picnic',    name: 'Picnic',     blurb: 'A birthday picnic under the stars',       color: '#e8843c', glyph: '☆',  group: 'birthday', live: true },
  { id: 'salon',     name: 'Heritage',   blurb: 'A candle-lit birthday from another century', color: '#b0314f', glyph: '♪',  group: 'birthday', live: true },
  { id: 'mission',   name: 'Mission',    blurb: 'A birthday mission at a desert base',     color: '#d9a441', glyph: '★',  group: 'birthday', live: true },
  // out of season: hidden from the gallery and the order list (links already bought still open). Set hidden: false next October.
  { id: 'spooky',    name: 'Halloween Night', blurb: 'A haunted hill with your date plan', color: '#ff7a1a', glyph: '☠',  group: 'holiday', live: true, hidden: true },
  { id: 'halloween', name: 'Halloween',  blurb: 'A spooky quest for two',                  color: '#8a5cff', glyph: '☾',  group: 'holiday', live: true, hidden: true },
];
const STYLE_NAMES = Object.fromEntries(STYLES.map(s => [s.id, s.name]));
const STYLE_COLORS = Object.fromEntries(STYLES.map(s => [s.id, s.color]));

/* ---------------- Orders: buy a pack, then choose which links to make ----------------
   1 link costs $3.99 and a pack of 8 costs $14.99, the same price everywhere (USD). After paying, the buyer chooses how many of each style (see STYLES above) to create,
   up to the number of links they paid for: with 8 they could make 3 Pixel, 2 Picnic and 3 Heritage, in one go or over several visits.

   With a Worker address in the pricing section's data-api (see worker/): "Buy" asks the Worker for a checkout, sends the buyer to it, and the
   Worker marks the order paid when the payment provider confirms. The buyer comes back to /?order=<token>, the dialog waits for the
   confirmation, and links are created by the Worker. With no address this all runs as a demo in the visitor's own browser: nothing is
   charged, and the links it makes are placeholders that open nothing. */
/* ---------------- Undoing a purchase: for 10 minutes after paying, the buyer can get their money back themselves ----------------
   A countdown and a button that asks twice ("tap again"), since it switches every link in the order off. ask(order) makes the
   request and resolves with the updated order; done(order) is called once the refund has been asked for. Returns null when the
   order can't be refunded (any more). */
function refundControl(order, { ask, done, compact = false }){
  if (!order || order.status !== 'paid' || !order.refundableUntil || order.refundableUntil <= Date.now()) return null;
  const box = document.createElement('div'); box.className = compact ? 'od-refund is-compact' : 'od-refund';
  const text = document.createElement('p');
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'od-refund-btn';
  const err = document.createElement('p'); err.className = 'od-refund-err'; err.setAttribute('role', 'alert'); err.hidden = true;
  if (!compact) box.append(text);
  box.append(btn, err);
  let armed = false, armTimer = 0, busy = false;
  const clock = ms => { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  function paint(){
    const left = order.refundableUntil - Date.now();
    if (left <= 0){ box.remove(); clearInterval(tick); return; }
    if (busy) return;
    text.innerHTML = `Changed your mind? Until you make your first link, you can get a full refund for <b>${clock(left)}</b> more.`;
    btn.textContent = armed ? (compact ? 'Tap again to refund' : 'Tap again: refund and switch the links off') : (compact ? `Refund · ${clock(left)}` : 'Refund this order');
    btn.classList.toggle('is-armed', armed);
  }
  const tick = setInterval(paint, 1000);
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (!armed){ armed = true; paint(); clearTimeout(armTimer); armTimer = setTimeout(() => { armed = false; paint(); }, 5000); return; }
    clearTimeout(armTimer); busy = true; btn.disabled = true; btn.textContent = 'Refunding…'; err.hidden = true;
    try {
      const next = await ask(order);
      clearInterval(tick);
      done(next);
    } catch (e){
      busy = false; armed = false; btn.disabled = false;
      err.textContent = e.message || 'That didn’t work. Please try again.'; err.hidden = false;
      paint();
    }
  });
  paint();
  return box;
}

function initOrders(){
  const modal = document.getElementById('orderModal');
  if (!modal) return;
  const PACKS = { single: { credits: 1, cents: 399, label: '1 link' }, pack: { credits: 8, cents: 1499, label: '8 links' } };
  const NAMES = STYLE_NAMES, COLORS = STYLE_COLORS;
  const KEY = 'sent4u.order', HOST = 'https://sent4u.link';
  const money = cents => `$${(cents / 100).toFixed(2)}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);
  const pricing = $('pricing'), reviews = $('reviews');
  const api = String((pricing && pricing.dataset.api) || (reviews && reviews.dataset.api) || '').trim().replace(/[/]+$/, '');

  const panel = modal.querySelector('.rvm-panel');
  const views = Object.fromEntries([...modal.querySelectorAll('[data-view]')].map(v => [v.dataset.view, v]));
  // the style rows, built from STYLES (name, one line, colour, a + and − each)
  $('odProducts').innerHTML = STYLES.filter(s => s.live && !s.hidden).map(s => `
        <li class="od-prod" data-product="${s.id}" style="--c:${s.color}">
          <span class="od-swatch" aria-hidden="true">${s.glyph}</span>
          <div class="od-name"><b>${s.name}</b><small>${s.blurb}</small></div>
          <div class="od-step"><button type="button" data-dec aria-label="One less ${s.name}">−</button><output aria-live="polite">0</output><button type="button" data-inc aria-label="One more ${s.name}">+</button></div>
        </li>`).join('');
  const rows = [...modal.querySelectorAll('.od-prod')];
  const createBtn = $('odCreate'), errBox = views.choose.querySelector('.rvm-error');
  const lockables = [$('mainContent'), $('siteHeader')].filter(Boolean);
  const counts = Object.fromEntries(STYLES.filter(s => s.live && !s.hidden).map(s => [s.id, 0]));
  const clearCounts = () => { for (const id in counts) counts[id] = 0; };
  let order = null, pendingPack = '', busy = false, run = 0, lastFocus = null, closeTimer = 0, made = 0;

  const store = {
    read(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
    write(v){ try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  };
  const total = () => Object.values(counts).reduce((a, b) => a + b, 0);

  /* ---- the dialog ---- */
  function show(name){
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    requestAnimationFrame(() => { const h = views[name].querySelector('h3'); if (h) h.focus({ preventScroll: true }); });
    panel.scrollTop = 0;
  }
  function open(){
    clearTimeout(closeTimer);
    if (modal.hidden){
      lastFocus = document.activeElement;
      modal.hidden = false;
      lockables.forEach(el => { el.inert = true; });
      if (lenis) lenis.stop(); else document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(() => modal.classList.add('is-open'));
    }
  }
  function close(){
    if (modal.hidden) return;
    run++;                                                     // stops any waiting for a payment
    modal.classList.remove('is-open');
    lockables.forEach(el => { el.inert = false; });
    if (lenis) lenis.start(); else document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    closeTimer = setTimeout(() => { modal.hidden = true; }, 380);
  }
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  const fail = (text, title = 'Something went wrong') => { $('odErrTitle').textContent = title; $('odErrText').textContent = text; open(); show('error'); };

  /* ---- undoing the purchase (10 minutes) ---- */
  let refundBox = null;
  function mountRefund(where){
    if (refundBox) refundBox.remove();
    refundBox = order.demo ? null : refundControl(order, {
      ask: o => request(`/orders/${encodeURIComponent(o.token)}/refund-request`, {}),
      done: next => { order = next; showRefunded(); },
    });
    if (refundBox) where.after(refundBox);
  }
  function showRefunded(){
    const asked = order.status === 'refunding';
    $('odRefundedTitle').textContent = asked ? 'Refund on its way' : 'This order was refunded';
    $('odRefundedText').textContent = asked
      ? `We've asked Paddle to refund your ${PACKS[order.pack] ? PACKS[order.pack].label : 'order'} (${money(order.amount)}). The money goes back to the card or account you paid with: Paddle checks it first, then it usually shows within a few business days. The links from this order no longer work.`
      : 'The money for this order has been returned, so its links no longer work.';
    open(); show('refunded');
  }

  /* ---- choosing ---- */
  function renderChoose(){
    const left = order.remaining - total();
    const spent = order.credits - order.remaining;
    $('odPaid').textContent = spent
      ? `Payment received for ${plural(order.credits, 'link')}. ${plural(spent, 'link')} already made. Choose the rest.`
      : `Payment received for ${plural(order.credits, 'link')}. Choose which ones to create.`;
    $('odLeft').textContent = left;
    $('odLeftLabel').textContent = left === 1 ? 'link left to choose' : 'links left to choose';
    rows.forEach(row => {
      const p = row.dataset.product, n = counts[p];
      row.classList.toggle('has', n > 0);
      row.querySelector('output').textContent = n;
      row.querySelector('[data-dec]').disabled = n === 0 || busy;
      row.querySelector('[data-inc]').disabled = busy || (order.remaining > 1 && left === 0);   // with one link left, a tap simply moves it
    });
    createBtn.disabled = busy || total() === 0;
    createBtn.firstChild.nodeValue = total() ? `Create ${plural(total(), 'link')}` : 'Choose at least one';
  }
  rows.forEach(row => {
    const p = row.dataset.product;
    row.querySelector('[data-inc]').addEventListener('click', () => {
      errBox.hidden = true;
      if (order.remaining === 1){ clearCounts(); counts[p] = 1; }
      else if (total() < order.remaining) counts[p]++;
      renderChoose();
    });
    row.querySelector('[data-dec]').addEventListener('click', () => { errBox.hidden = true; if (counts[p] > 0) counts[p]--; renderChoose(); });
  });

  function showChoose(){ clearCounts(); busy = false; errBox.hidden = true; show('choose'); renderChoose(); mountRefund(createBtn); }

  createBtn.addEventListener('click', async () => {
    if (busy || !total()) return;
    const items = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0));
    busy = true; errBox.hidden = true; renderChoose();
    try {
      order = order.demo ? demoGenerate(items) : await request(`/orders/${encodeURIComponent(order.token)}/generate`, { items });
      made = total();
      busy = false;
      showDone();
    } catch (err){
      busy = false; renderChoose();
      errBox.textContent = err.message || 'That didn’t work. Please try again.'; errBox.hidden = false;
    }
  });

  /* ---- done ---- */
  function showDone(){
    $('odDoneSub').textContent = `${made ? `${plural(made, 'link')} made. ` : ''}${order.remaining ? `${plural(order.remaining, 'link')} still to create.` : 'That’s your whole pack.'}`;
    $('odMore').hidden = order.remaining === 0;
    $('odFine').textContent = order.demo
      ? 'Demo links: they look real, but they don’t open anything yet.'
      : 'Open a link to edit it: you have five days to change anything, then it becomes read-only. This page stays yours: find it again under “My links” in the footer.';
    const list = $('odLinks'); list.replaceChildren();
    [...order.links].sort((a, b) => b.at - a.at).forEach(l => {   // the newest batch first, each batch in the order it was chosen
      const li = document.createElement('li'); li.className = 'od-link'; li.style.setProperty('--c', COLORS[l.product] || '#7c5cff');
      const tag = document.createElement('span'); tag.className = 'od-tag'; tag.textContent = NAMES[l.product] || l.product;
      const url = document.createElement('span'); url.className = 'od-url'; url.textContent = l.url.replace(/^https?:[/][/]/, ''); url.title = l.url;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'od-copy'; copy.textContent = 'Copy';
      copy.addEventListener('click', () => copyText(l.url, copy));
      li.append(tag, url, copy);
      if (!order.demo){
        const a = document.createElement('a'); a.className = 'od-open'; a.textContent = 'Open'; a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
        li.append(a);
      }
      list.append(li);
    });
    show('done');
    mountRefund(views.done.querySelector('.od-actions'));
  }
  $('odMore').addEventListener('click', showChoose);
  async function copyText(text, btn){
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    const was = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = was; }, 1600);
  }

  /* ---- the Worker ---- */
  async function request(path, body){
    const res = await fetch(api + path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok){ const err = new Error(data.error || 'That didn’t work. Please try again.'); err.status = res.status; throw err; }
    return data;
  }

  /* ---- the demo (no Worker): the order lives in this browser ---- */
  const demoId = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  function demoGenerate(items){
    const next = { ...order, links: [...order.links], remaining: order.remaining }, at = Date.now();
    Object.entries(items).forEach(([product, n]) => {
      for (let i = 0; i < n && next.remaining > 0; i++){
        const id = `demo-${demoId()}`;
        next.links.push({ product, id, url: `${HOST}/?share=${id}`, at });
        next.remaining--;
      }
    });
    store.write(next);
    return next;
  }

  /* ---- flows ---- */
  const toNext = () => { order.remaining > 0 ? showChoose() : (made = 0, showDone()); };

  async function buy(pack){
    if (!PACKS[pack]) return;
    const my = ++run;
    open();
    if (!api){                                                  // demo: a pretend checkout
      pendingPack = pack;
      $('odDemoPack').textContent = PACKS[pack].label;
      $('odDemoPrice').textContent = money(PACKS[pack].cents);
      show('demo');
      return;
    }
    $('odTitle').textContent = 'Taking you to checkout…'; $('odWaitText').textContent = 'One moment.';
    show('wait');
    try {
      const data = await request('/checkout', { pack });
      if (my !== run) return;
      if (!data.checkoutUrl) throw new Error('Checkout isn’t available right now. Please try again in a moment.');
      store.write({ token: data.token });
      location.assign(data.checkoutUrl);
    } catch (err){ if (my === run) fail(err.message, 'Couldn’t start checkout'); }
  }
  $('odDemoPay').addEventListener('click', async () => {
    const my = ++run;
    $('odTitle').textContent = 'Confirming your payment…'; $('odWaitText').textContent = 'This only takes a moment.';
    show('wait');
    await sleep(1500);
    if (my !== run) return;
    const pack = pendingPack;
    order = { token: `demo-${demoId()}`, pack, credits: PACKS[pack].credits, remaining: PACKS[pack].credits, amount: PACKS[pack].cents, status: 'paid', links: [], demo: true };
    store.write(order);
    made = 0; showChoose();
  });

  // back from the payment page (or "My links"): wait until the payment provider has told the Worker the money arrived
  async function resume(token){
    const my = ++run;
    $('odTitle').textContent = 'Confirming your payment…'; $('odWaitText').textContent = 'This only takes a moment.';
    open(); show('wait');
    for (let i = 0; i < 48 && my === run; i++){
      try {
        order = await request(`/orders/${encodeURIComponent(token)}`);
        if (order.status === 'paid'){ if (my === run){ made = 0; toNext(); } return; }
        if (order.status === 'refunding' || order.status === 'refunded'){ if (my === run) showRefunded(); return; }
      } catch (err){
        if (err.status === 404){ if (my === run) fail('We couldn’t find that order. Check the link you were sent, or get in touch and we’ll sort it out.', 'Order not found'); return; }
      }
      await sleep(2500);
    }
    if (my === run) fail('Your payment hasn’t been confirmed yet. If you’ve paid, give it a minute and refresh this page: nothing is lost.', 'Still waiting');
  }

  function openSaved(){
    const saved = store.read();
    if (!saved){ fail('You haven’t bought a pack on this device yet. Pick 1 link or 8 links in the pricing section.', 'No order yet'); return; }
    if (saved.demo){ order = saved; open(); made = 0; toNext(); return; }
    resume(saved.token);
  }

  document.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buy(b.dataset.buy)));
  document.querySelectorAll('[data-order-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openSaved(); }));

  // back from the payment page: the provider sends the buyer to /?paid=1 (the token was saved in this browser before leaving) or to /?order=<token>
  const params = new URLSearchParams(location.search);
  if (api && (params.has('order') || params.has('paid'))){
    const token = params.get('order') || (store.read() || {}).token;
    history.replaceState(null, '', location.pathname + location.hash);   // the address bar goes back to normal; the token stays in this browser
    if (token){ store.write({ token }); resume(token); }
    else fail('We couldn’t tell which order that was. Open “My links” in the footer on the device you paid from, or get in touch and we’ll sort it out.', 'Order not found');
  }
}

/* ---------------- Sign in: no password, an emailed link to confirm it's you (see worker/'s /auth/* routes) ----------------
   Calls go to relative paths (/auth/*, /me) rather than a data-api address: the gateway (see gateway/) proxies
   those to the orders Worker so the session cookie it sets is a first-party sent4u.link cookie, not one shared
   cross-site with the Worker's own *.workers.dev address, which browsers increasingly restrict or block. Clicking
   the link in the email is a normal page load, not something this script drives — it lands back here at
   /?signedin=1 with the cookie already set. */
function initAuth(){
  const modal = document.getElementById('authModal');
  if (!modal) return;
  const $ = id => document.getElementById(id);
  const trigger = $('authTrigger');
  const panel = modal.querySelector('.rvm-panel');
  const views = Object.fromEntries([...modal.querySelectorAll('[data-view]')].map(v => [v.dataset.view, v]));
  const lockables = [$('mainContent'), $('siteHeader')].filter(Boolean);
  const NAMES = STYLE_NAMES, COLORS = STYLE_COLORS;
  const PACKS = { single: '1 link', pack: '8 links' };
  let me = null, lastFocus = null, closeTimer = 0;

  function show(name){
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    requestAnimationFrame(() => { const h = views[name].querySelector('h3'); if (h) h.focus({ preventScroll: true }); });
    panel.scrollTop = 0;
  }
  function open(){
    clearTimeout(closeTimer);
    if (modal.hidden){
      lastFocus = document.activeElement;
      modal.hidden = false;
      lockables.forEach(el => { el.inert = true; });
      if (lenis) lenis.stop(); else document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(() => modal.classList.add('is-open'));
    }
  }
  function close(){
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    lockables.forEach(el => { el.inert = false; });
    if (lenis) lenis.start(); else document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    closeTimer = setTimeout(() => { modal.hidden = true; }, 380);
  }
  modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  const fail = (text, title = 'Something went wrong') => { $('auErrTitle').textContent = title; $('auErrText').textContent = text; open(); show('error'); };

  async function request(path, opts = {}){
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok){ const err = new Error(data.error || 'That didn’t work. Please try again.'); err.status = res.status; throw err; }
    return data;
  }

  async function copyText(text, btn){
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    const was = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = was; }, 1600);
  }

  function renderAccount(){
    $('auMeEmail').textContent = me.email;
    const list = $('auOrders'); list.replaceChildren();
    $('auEmpty').hidden = me.orders.length > 0;
    me.orders.forEach(order => {
      const li = document.createElement('li'); li.className = 'au-order';
      const head = document.createElement('div'); head.className = 'au-order-head';
      const pack = document.createElement('span'); pack.textContent = PACKS[order.pack] || order.pack;
      const status = document.createElement('span'); status.className = `au-status${order.status === 'paid' ? ' is-paid' : ''}`;
      status.textContent = { paid: 'paid', pending: 'waiting for payment', refunding: 'refund requested', refunded: 'refunded' }[order.status] || order.status;
      head.append(pack, status);
      const refund = refundControl(order, {
        compact: true,
        ask: o => request(`/orders/${encodeURIComponent(o.token)}/refund-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
        done: next => { me.orders = me.orders.map(o => (o.token === next.token ? next : o)); renderAccount(); },
      });
      if (refund) head.append(refund);
      const links = document.createElement('ul'); links.className = 'od-links';
      [...order.links].sort((a, b) => b.at - a.at).forEach(l => {
        const item = document.createElement('li'); item.className = 'od-link'; item.style.setProperty('--c', COLORS[l.product] || '#7c5cff');
        const tag = document.createElement('span'); tag.className = 'od-tag'; tag.textContent = NAMES[l.product] || l.product;
        const url = document.createElement('span'); url.className = 'od-url'; url.textContent = l.url.replace(/^https?:[/][/]/, ''); url.title = l.url;
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'od-copy'; copy.textContent = 'Copy';
        copy.addEventListener('click', () => copyText(l.url, copy));
        const openLink = document.createElement('a'); openLink.className = 'od-open'; openLink.textContent = 'Open'; openLink.href = l.url; openLink.target = '_blank'; openLink.rel = 'noopener';
        item.append(tag, url, copy, openLink);
        links.append(item);
      });
      li.append(head, links);
      list.append(li);
    });
    show('account');
  }

  function signedIn(data){
    me = data;
    trigger.textContent = me.email;
    trigger.title = `Signed in as ${me.email}`;
  }

  // The email can be opened anywhere: this browser asks every few seconds whether it has been confirmed yet (on this device, or on
  // another one by picking the number shown here), and signs in by itself. The link lasts 15 minutes; so does the waiting.
  let waitRun = 0;
  async function waitForConfirmation(){
    const my = ++waitRun, until = Date.now() + 15 * 60 * 1000;
    $('auWait').textContent = 'Waiting for you to confirm…'; $('auRetry').hidden = true;
    while (my === waitRun && Date.now() < until){
      await new Promise(resolve => setTimeout(resolve, document.hidden ? 6000 : 3000));
      if (my !== waitRun) return;
      let status;
      try { status = await request('/auth/status'); } catch { continue; }
      if (status.signedIn){
        waitRun++;
        try { signedIn(await request('/me')); if (!modal.hidden) renderAccount(); } catch {}
        return;
      }
      if (status.expired) break;
    }
    if (my !== waitRun) return;
    $('auWait').textContent = 'This sign-in link has expired or was cancelled.'; $('auRetry').hidden = false;
  }
  $('auRetry').addEventListener('click', () => { show('signin'); requestAnimationFrame(() => $('auEmail').focus()); });

  const EMAIL_KEY = 'sent4u.email';   // the address last used here, so it's already filled in next time
  trigger.addEventListener('click', () => {
    open();
    if (me){ renderAccount(); return; }
    try { if (!$('auEmail').value) $('auEmail').value = localStorage.getItem(EMAIL_KEY) || ''; } catch {}
    show('signin');
    requestAnimationFrame(() => $('auEmail').focus());
  });

  $('auForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('auEmail').value.trim();
    $('auSubmit').disabled = true; $('auError').hidden = true;
    try {
      const sent = await request('/auth/request-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      try { localStorage.setItem(EMAIL_KEY, email); } catch {}
      $('auSentTo').textContent = email;
      $('auCode').textContent = sent.code || '··';
      show('sent');
      waitForConfirmation();
    } catch (err){
      $('auError').textContent = err.message || 'That didn’t work. Please try again.'; $('auError').hidden = false;
    } finally {
      $('auSubmit').disabled = false;
    }
  });

  $('auSignOut').addEventListener('click', async () => {
    try { await request('/auth/logout', { method: 'POST' }); } catch {}
    me = null; waitRun++;
    trigger.textContent = 'Sign in';
    trigger.removeAttribute('title');
    close();
  });

  // /?signin (the stats page's "Go to sign in"): open the sign-in window straight away
  if (new URLSearchParams(location.search).has('signin')){ history.replaceState(null, '', location.pathname + location.hash); trigger.click(); }

  // Already signed in from an earlier visit? Quietly check once on load — no modal, just updates the header button.
  request('/me').then(signedIn).catch(() => {});

  // Just came back from clicking the emailed link: the session cookie is already set, so this /me call succeeds —
  // open straight to the account view instead of making them click "Sign in" again.
  if (new URLSearchParams(location.search).has('signedin')){
    history.replaceState(null, '', location.pathname + location.hash);
    open();   // no view shown yet — renderAccount()/fail() below picks one the moment /me resolves, which is almost immediate
    request('/me').then(data => { signedIn(data); renderAccount(); })
      .catch(() => fail('That sign-in link didn’t work. Please ask for a new one.', 'Sign-in failed'));
  }
}

/* ---------------- The styles gallery: a card per style (from STYLES), filtered by the tabs above it ---------------- */
function initStyles(){
  const grid = document.getElementById('sgGrid');
  if (!grid) return;
  grid.innerHTML = STYLES.filter(s => !s.hidden).map(s => {
    const shot = s.live
      ? `<img src="assets/styles/${s.id}.webp" alt="A preview of the ${s.name} style" width="520" height="853" loading="lazy" decoding="async">`
      : `<span class="sg-soon" aria-hidden="true">${s.glyph}</span>`;
    const inner = `<span class="sg-shot">${shot}</span><span class="sg-name">${s.name}</span><span class="sg-blurb">${s.blurb}</span><span class="sg-demo">${s.live ? 'Try it free' : 'Coming soon'}</span>`;
    return `<li class="sg-item" data-group="${s.group}" style="--c:${s.color}">${s.live
      ? `<a class="sg-card" href="/?share=test-${s.id}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="sg-card is-soon">${inner}</div>`}</li>`;
  }).join('');
  const tabs = [...document.querySelectorAll('.sg-tabs [data-filter]')];
  tabs.forEach(tab => tab.addEventListener('click', () => {
    const f = tab.dataset.filter;
    tabs.forEach(b => b.setAttribute('aria-selected', String(b === tab)));
    grid.querySelectorAll('.sg-item').forEach(li => { li.hidden = f !== 'all' && li.dataset.group !== f; });
  }));
}

/* ---------------- Boot ---------------- */
/* ---------------- Support band: a tip jar on Ko-fi (not Paddle: Paddle doesn't allow donations) ---------------- */
// The Ko-fi page's address. While it is empty the band and its footer link stay hidden, so nobody is sent to a page that
// isn't ours.
const KOFI_URL = '';
function initSupport(){
  if (!/^https:\/\/ko-fi\.com\/[A-Za-z0-9_]+\/?$/.test(KOFI_URL)) return;
  const band = document.getElementById('support');
  if (!band) return;
  document.getElementById('supportLink').href = KOFI_URL;
  band.hidden = false;
  document.querySelectorAll('[data-support-link]').forEach(a => { a.hidden = false; });
}

document.addEventListener('DOMContentLoaded', () => {
  initSupport();
  initTilt();
  prepareHero();
  initSmoothScroll();
  initCursor();
  initMagnetic();
  initProgressBar();
  initHeader();
  initHeroParallax();
  initHeroDemo();
  initHow();
  initLetterRoll();
  initMenu();
  initReviews();
  initBridge();
  initPricing();
  initOrders();
  initAuth();
  initStyles();
  initFinale({ reduceMotion });
  initOffscreenPause();
  initPerfGuard();
  initReveals();
  initPhoneSection();
  initTides();
  initSnake();
  initPreloader();
});

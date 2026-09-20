/* Phone tilt.

   A touch screen has no cursor, so the effects that follow the mouse (the phone that turns, the globes that swing, the wave that is pushed
   around) have nothing to follow. On a phone the motion sensor takes the mouse's place: lean the phone and they lean with it.

   `tilt.x` and `tilt.y` are each -1..1 (right / down), measured from how the phone is being held: the resting position slowly follows the
   phone, so it doesn't matter whether you read it flat on a table or upright in your hand, and a lean always eases back to centre.
   `tilt.active` turns true when the first real reading arrives, so the pages know whether to use it.

   Android just works over https. On iPhones and iPads (iOS 13+) the browser wants a tap first, so a small "Tilt to explore" button asks. */

const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

export const tilt = { x: 0, y: 0, active: false };

const RANGE = 20;        // degrees of lean that count as "all the way"
const SETTLE = 6000;     // ms the resting position takes to follow where the phone is held
const SMOOTH = 70;       // ms of smoothing on the readings (the sensor is a little jittery)

let baseX = null, baseY = null, lastT = 0, listening = false;
const wrap = d => ((d + 540) % 360) - 180;

const screenAngle = () => {
  const a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0);
  return ((a % 360) + 360) % 360;
};

function onOrient(e) {
  if (e.gamma == null || e.beta == null) return;         // a desktop browser sends one empty event
  let x = e.gamma, y = e.beta;                            // gamma leans right, beta leans the top of the phone up
  const turn = screenAngle();
  if (turn === 90) [x, y] = [y, -x];
  else if (turn === 180) [x, y] = [-x, -y];
  else if (turn === 270) [x, y] = [-y, x];
  const now = performance.now(), dt = lastT ? Math.min(now - lastT, 200) : 16;
  lastT = now;
  if (baseX === null) { baseX = x; baseY = y; }
  const follow = 1 - Math.exp(-dt / SETTLE);
  baseX += wrap(x - baseX) * follow; baseY += wrap(y - baseY) * follow;
  const tx = Math.max(-1, Math.min(1, wrap(x - baseX) / RANGE)), ty = Math.max(-1, Math.min(1, wrap(y - baseY) / RANGE));
  const k = 1 - Math.exp(-dt / SMOOTH);
  tilt.x += (tx - tilt.x) * k; tilt.y += (ty - tilt.y) * k;
  if (!tilt.active) { tilt.active = true; window.dispatchEvent(new CustomEvent('sent4u:tilt')); }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('deviceorientation', onOrient, { passive: true });
  document.addEventListener('visibilitychange', () => { baseX = baseY = null; lastT = 0; });   // start again from wherever the phone is held now
}

/* ---- the little button / hint ---- */
let pill = null, hideTimer = 0;
function showPill(label, { button, gone }) {
  if (!pill) {
    pill = document.createElement(button ? 'button' : 'div');
    pill.className = 'tilt-pill';
    if (button) pill.type = 'button';
    pill.setAttribute(button ? 'aria-label' : 'role', button ? 'Turn on tilt: move things by tilting your phone' : 'status');
    document.body.append(pill);
  }
  pill.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2.4"/><path d="M4 8 2 12l2 4M20 8l2 4-2 4"/></svg><span></span>';
  pill.lastChild.textContent = label;
  requestAnimationFrame(() => pill.classList.add('is-on'));
  clearTimeout(hideTimer);
  if (gone) hideTimer = setTimeout(hidePill, gone);
  return pill;
}
function hidePill() {
  if (!pill) return;
  const el = pill; pill = null;
  el.classList.remove('is-on');
  setTimeout(() => el.remove(), 500);
}

export function initTilt() {
  if (!touch || typeof DeviceOrientationEvent === 'undefined') return;

  // iOS 13+: the sensor is behind a permission that can only be asked for from a tap
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = showPill('Tilt to explore', { button: true });
    setTimeout(() => p.classList.add('is-min'), 9000);      // shrinks to just the icon after a while, but stays
    p.addEventListener('click', async () => {
      try {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer === 'granted') { hidePill(); hintOnce(); listen(); }
        else { p.querySelector('span').textContent = 'Tilt isn’t available'; setTimeout(hidePill, 2600); }
      } catch { hidePill(); }
    });
    return;
  }

  // Android and anything else: it just works, so say so once the first reading arrives
  hintOnce();
  listen();
}

// once the first reading arrives, a short "it works" note
function hintOnce() {
  window.addEventListener('sent4u:tilt', () => showPill('Tilt your phone to explore', { button: false, gone: 3800 }), { once: true });
}

/* Viewport helpers, shared by the page's modules.

   Phone browsers fire "resize" whenever the address bar slides in or out while you scroll. Nothing about the layout has changed except the
   height, by a few dozen pixels, but the page used to redo its layout work (measuring sections, rebuilding the snake's path, resizing the
   canvases) on every one of those, which is a big part of why scrolling stuttered on phones. */

const coarse = window.matchMedia('(pointer: coarse)').matches;

// Runs `fn` when the window really changed size: any width change, and on touch screens only a large height change (a rotated
// phone, not the address bar). On a desktop every resize counts. `delay` waits for the resizing to settle.
export function onRealResize(fn, delay = 0) {
  let w = window.innerWidth, h = window.innerHeight, timer = 0;
  window.addEventListener('resize', () => {
    const nw = window.innerWidth, nh = window.innerHeight;
    if (coarse && nw === w && Math.abs(nh - h) < h * 0.2) return;
    w = nw; h = nh;
    clearTimeout(timer);
    if (delay) timer = setTimeout(fn, delay); else fn();
  });
}

// The height of the pinned "How it works" page. It is sized in CSS with svh (the part of the screen that is always visible, even when
// the phone's address bar is showing), so scroll maths that depends on it asks the element rather than window.innerHeight, which changes
// as the bar moves.
export const pinnedHeight = () => {
  const el = document.getElementById('howSticky');
  return (el && el.clientHeight) || window.innerHeight;
};

// Unified player input. Keyboard, the on-screen joystick and gamepads all
// produce the same intent, polled once per frame, and the same button events
// (action, sit, view, photo, map) for the game layer.
//
//   Keyboard: WASD / arrows move, Space jumps (hold to flutter), E / Enter
//             acts, C sits, M the map, P a photo, V changes view.
//   Gamepad:  left stick moves, right stick looks, A jumps, X acts, B sits,
//             Select view.
//   Touch:    joystick and the on-screen buttons.

const KEYS = {
  KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
};
const BUTTON_EVENTS = { KeyE: "action", Enter: "action", KeyC: "sit", KeyV: "view", KeyP: "photo", KeyM: "map" };
const PAD_EVENTS = { 2: "action", 1: "sit", 8: "view" };
const DEAD_ZONE = 0.18;

export function createInput(dom) {
  const held = new Set();
  const stick = { x: 0, y: 0 };
  const listeners = new Map();
  const life = new AbortController();
  const signal = life.signal;
  let enabled = false;
  let jumpHeld = false;
  let jumpQueued = false;
  const padPrev = [];

  const emit = (name) => listeners.get(name)?.forEach((fn) => fn());
  const typing = (event) => event.target?.closest?.("input, textarea, select, dialog, [contenteditable]");

  window.addEventListener("keydown", (event) => {
    if (!enabled || typing(event)) return;
    if (KEYS[event.code]) {
      held.add(KEYS[event.code]);
      event.preventDefault();
    } else if (event.code === "Space") {
      if (!event.repeat) jumpQueued = true;
      jumpHeld = true;
      event.preventDefault();
    } else if (BUTTON_EVENTS[event.code] && !event.repeat) {
      event.preventDefault();
      emit(BUTTON_EVENTS[event.code]);
    }
  }, { signal });
  window.addEventListener("keyup", (event) => {
    if (KEYS[event.code]) held.delete(KEYS[event.code]);
    if (event.code === "Space") jumpHeld = false;
  }, { signal });
  window.addEventListener("blur", () => {
    held.clear();
    jumpHeld = false;
  }, { signal });

  // On-screen joystick.
  const pad = document.createElement("div");
  pad.className = "walk-stick";
  pad.hidden = true;
  pad.setAttribute("aria-hidden", "true");
  const knob = document.createElement("div");
  knob.className = "walk-knob";
  pad.append(knob);
  dom.append(pad);
  let stickId = null;
  const padMove = (event) => {
    const rect = pad.getBoundingClientRect();
    const r = rect.width / 2;
    let x = (event.clientX - rect.left - r) / r;
    let y = (event.clientY - rect.top - r) / r;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    stick.x = x;
    stick.y = -y;
    knob.style.transform = `translate(${x * r * 0.55}px, ${y * r * 0.55}px)`;
  };
  const release = () => {
    stickId = null;
    stick.x = stick.y = 0;
    knob.style.transform = "";
  };
  pad.addEventListener("pointerdown", (event) => {
    stickId = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    padMove(event);
  }, { signal });
  pad.addEventListener("pointermove", (event) => {
    if (event.pointerId === stickId) padMove(event);
  }, { signal });
  pad.addEventListener("pointerup", release, { signal });
  pad.addEventListener("pointercancel", release, { signal });

  function readGamepad() {
    const pads = navigator.getGamepads?.() || [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const axis = (i) => {
        const v = gp.axes[i] || 0;
        return Math.abs(v) < DEAD_ZONE ? 0 : (v - Math.sign(v) * DEAD_ZONE) / (1 - DEAD_ZONE);
      };
      const pressed = (i) => Boolean(gp.buttons[i]?.pressed);
      for (const [index, name] of Object.entries(PAD_EVENTS)) {
        if (pressed(index) && !padPrev[index]) emit(name);
      }
      const jump = pressed(0);
      const result = {
        x: axis(0), y: -axis(1), lookX: axis(2), lookY: axis(3),
        jumpPressed: jump && !padPrev[0], jumpHeld: jump,
      };
      gp.buttons.forEach((b, i) => (padPrev[i] = b.pressed));
      return result;
    }
    return null;
  }

  const intent = { x: 0, y: 0, jumpPressed: false, jumpHeld: false, lookX: 0, lookY: 0, active: false };
  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      pad.hidden = !on;
      if (!on) {
        held.clear();
        release();
        jumpHeld = jumpQueued = false;
      }
    },
    // On-screen jump button: press, and release (holding flutters).
    pressJump() {
      jumpQueued = true;
      jumpHeld = true;
    },
    releaseJump() {
      jumpHeld = false;
    },
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    poll() {
      let x = stick.x + (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      let y = stick.y + (held.has("up") ? 1 : 0) - (held.has("down") ? 1 : 0);
      let lookX = 0;
      let lookY = 0;
      let jumpPressed = jumpQueued;
      let jumpDown = jumpHeld;
      const gp = enabled ? readGamepad() : null;
      if (gp) {
        x += gp.x;
        y += gp.y;
        lookX = gp.lookX;
        lookY = gp.lookY;
        jumpPressed ||= gp.jumpPressed;
        jumpDown ||= gp.jumpHeld;
      }
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      jumpQueued = false;
      intent.x = enabled ? x : 0;
      intent.y = enabled ? y : 0;
      intent.jumpPressed = enabled && jumpPressed;
      intent.jumpHeld = enabled && jumpDown;
      intent.lookX = lookX;
      intent.lookY = lookY;
      intent.active = Math.hypot(intent.x, intent.y) > 0.05 || intent.jumpPressed || intent.jumpHeld || Math.hypot(lookX, lookY) > 0.05;
      return intent;
    },
    dispose() {
      life.abort();
      pad.remove();
      listeners.clear();
    },
  };
}

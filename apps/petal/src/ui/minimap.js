import { button, el, sheet } from "./dom.js";

// The island map. It is painted once from the walk map (lawns shaded by
// height, paths, bridges, water, and every solid body), and a soft fog lifts
// wherever you have walked — remembered in this browser. open() shows the
// whole island with place names for the parts you have discovered (a small
// round map that turns with the camera can be shown in a corner with
// `corner: true`).

const EXPLORED_KEY = "petal-isle-explored-2"; // (2: the island along one path)
const FOG_CELL = 1; // metres
const REVEAL = 7; // metres around the bunny
const PALETTE = {
  grassLow: [143, 206, 138], grassHigh: [199, 236, 178], water: [127, 203, 232], stone: [239, 228, 238],
  wood: [217, 168, 119], cloth: [255, 196, 214], leaf: [111, 174, 106], metal: [154, 152, 166],
  bodyStone: [207, 194, 214], bodyWood: [168, 118, 79], rim: [183, 166, 222],
};

function paintBase(map) {
  const canvas = document.createElement("canvas");
  canvas.width = map.cols;
  canvas.height = map.rows;
  const g = canvas.getContext("2d");
  const image = g.createImageData(map.cols, map.rows);
  const data = image.data;
  for (let r = 0; r < map.rows; r += 1) {
    for (let c = 0; c < map.cols; c += 1) {
      const x = map.bounds.x0 + c * map.cell;
      const z = map.bounds.z0 + r * map.cell;
      const s = map.sample(x, z);
      if (s.kind === "void") continue;
      let rgb;
      if (s.kind === "body") {
        rgb = s.material === "wood" ? PALETTE.bodyWood : s.material === "leaf" ? PALETTE.leaf : s.material === "metal" ? PALETTE.metal : PALETTE.bodyStone;
      } else if (s.water) rgb = PALETTE.water;
      else if (s.material === "stone") rgb = PALETTE.stone;
      else if (s.material === "wood") rgb = PALETTE.wood;
      else if (s.material === "cloth") rgb = PALETTE.cloth;
      else if (s.material === "leaf") rgb = PALETTE.leaf;
      else {
        const t = Math.min(1, Math.max(0, (s.height + 0.5) / 4.5));
        rgb = PALETTE.grassLow.map((v, i) => v + (PALETTE.grassHigh[i] - v) * t);
      }
      // A soft lavender rim along the cliffs.
      const edge = map.rawAt(c - 1, r) === 0 || map.rawAt(c + 1, r) === 0 || map.rawAt(c, r - 1) === 0 || map.rawAt(c, r + 1) === 0;
      if (edge) rgb = PALETTE.rim;
      const i = (r * map.cols + c) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

function encode(bits) {
  let out = "";
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let k = 0; k < 8; k += 1) if (bits[i + k]) byte |= 1 << k;
    out += String.fromCharCode(byte);
  }
  return btoa(out);
}

function decode(text, length) {
  const bits = new Uint8Array(length);
  try {
    const raw = atob(text || "");
    for (let i = 0; i < length; i += 1) bits[i] = (raw.charCodeAt(i >> 3) >> (i & 7)) & 1;
  } catch {
    // Start with an unexplored map.
  }
  return bits;
}

export function createMinimap(host, { map, places = [], landmarks = [], storage = globalThis.localStorage, getStats = () => [], corner = true }) {
  const { bounds } = map;
  const width = bounds.x1 - bounds.x0;
  const depth = bounds.z1 - bounds.z0;
  const base = paintBase(map);

  // Exploration fog, one cell per metre.
  const fogCols = Math.ceil(width / FOG_CELL) + 1;
  const fogRows = Math.ceil(depth / FOG_CELL) + 1;
  let stored = null;
  try {
    stored = storage?.getItem(EXPLORED_KEY);
  } catch {
    stored = null;
  }
  const explored = decode(stored, fogCols * fogRows);
  const land = new Uint8Array(fogCols * fogRows);
  for (let r = 0; r < fogRows; r += 1) {
    for (let c = 0; c < fogCols; c += 1) {
      land[r * fogCols + c] = map.surface(bounds.x0 + c * FOG_CELL, bounds.z0 + r * FOG_CELL) !== null ? 1 : 0;
    }
  }
  const landTotal = land.reduce((a, b) => a + b, 0) || 1;
  const fog = document.createElement("canvas");
  fog.width = fogCols;
  fog.height = fogRows;
  const fogContext = fog.getContext("2d");
  const fogImage = fogContext.createImageData(fogCols, fogRows);
  function paintFog() {
    for (let i = 0; i < explored.length; i += 1) {
      fogImage.data.set(explored[i] ? [0, 0, 0, 0] : [74, 62, 112, 215], i * 4);
    }
    fogContext.putImageData(fogImage, 0, 0);
  }
  paintFog();
  let dirty = false;
  let saveTimer = 0;

  // Small round map (a button: it opens the big one).
  const small = button("", { className: "minimap", ariaLabel: "Open the island map" });
  const canvas = el("canvas");
  small.append(canvas);
  small.hidden = !corner;
  if (corner) host.append(small);
  const context = canvas.getContext("2d");
  const size = () => Math.round(small.getBoundingClientRect().width || 132);
  let scale = 1;

  // Big map sheet.
  const panel = sheet("map-sheet", "Petal Isle");
  const bigCanvas = el("canvas", "map-canvas");
  const stats = el("p", "map-stats");
  panel.body.append(bigCanvas, stats);
  host.append(panel.dialog);
  function open() {
    panel.open();
    drawBig();
  }
  small.addEventListener("click", open);

  const last = { x: 0, z: 0, heading: 0, yaw: 0 };
  function drawIcon(g, text, x, z, rotation, px) {
    g.save();
    g.translate(x, z);
    g.rotate(rotation);
    g.scale(1 / px, 1 / px);
    g.font = "14px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 0, 0);
    g.restore();
  }

  function drawSmall() {
    const s = size();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== s * dpr) {
      canvas.width = canvas.height = s * dpr;
      scale = dpr;
    }
    const g = context;
    const px = (s * scale) / 34; // canvas pixels per metre (34 m across)
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.beginPath();
    g.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#b6c8f4";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.translate(canvas.width / 2, canvas.height / 2);
    g.rotate(last.yaw);
    g.scale(px, px);
    g.translate(-last.x, -last.z);
    g.imageSmoothingEnabled = false;
    g.drawImage(base, bounds.x0 - map.cell / 2, bounds.z0 - map.cell / 2, map.cols * map.cell, map.rows * map.cell);
    g.imageSmoothingEnabled = true;
    g.drawImage(fog, bounds.x0 - FOG_CELL / 2, bounds.z0 - FOG_CELL / 2, fogCols * FOG_CELL, fogRows * FOG_CELL);
    for (const mark of landmarks) {
      if (!isExplored(mark.x, mark.z)) continue;
      drawIcon(g, typeof mark.icon === "function" ? mark.icon() : mark.icon, mark.x, mark.z, -last.yaw, px);
    }
    // The bunny: a pink arrow.
    g.save();
    g.translate(last.x, last.z);
    g.rotate(Math.atan2(Math.sin(last.heading), -Math.cos(last.heading)));
    g.scale(1 / px, 1 / px);
    g.fillStyle = "#ff5c95";
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2 * scale;
    g.beginPath();
    g.moveTo(0, -8 * scale);
    g.lineTo(6 * scale, 7 * scale);
    g.lineTo(0, 3.5 * scale);
    g.lineTo(-6 * scale, 7 * scale);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.restore();
  }

  function drawBig() {
    const rect = panel.body.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(280, Math.min(760, rect.width || 600));
    const h = Math.round((w * depth) / width);
    bigCanvas.width = w * dpr;
    bigCanvas.height = h * dpr;
    bigCanvas.style.width = `${w}px`;
    bigCanvas.style.height = `${h}px`;
    const g = bigCanvas.getContext("2d");
    const px = bigCanvas.width / width;
    g.setTransform(px, 0, 0, px, -bounds.x0 * px, -bounds.z0 * px);
    g.fillStyle = "#c7d4f6";
    g.fillRect(bounds.x0, bounds.z0, width, depth);
    g.imageSmoothingEnabled = false;
    g.drawImage(base, bounds.x0, bounds.z0, map.cols * map.cell, map.rows * map.cell);
    g.imageSmoothingEnabled = true;
    g.drawImage(fog, bounds.x0 - FOG_CELL / 2, bounds.z0 - FOG_CELL / 2, fogCols * FOG_CELL, fogRows * FOG_CELL);
    for (const mark of landmarks) {
      if (isExplored(mark.x, mark.z)) drawIcon(g, typeof mark.icon === "function" ? mark.icon() : mark.icon, mark.x, mark.z, 0, px / dpr);
    }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `italic 600 ${16 * dpr}px "Cormorant Garamond", Georgia, serif`;
    g.textAlign = "center";
    for (const place of places) {
      const known = isExplored(place.x, place.z);
      const sx = (place.x - bounds.x0) * px;
      const sy = (place.z - bounds.z0) * px - 14 * dpr;
      g.fillStyle = known ? "#6f3d55" : "#6f3d5566";
      g.fillText(known ? place.name : "?", sx, sy);
    }
    // You are here.
    const sx = (last.x - bounds.x0) * px;
    const sy = (last.z - bounds.z0) * px;
    g.fillStyle = "#ff5c95";
    g.strokeStyle = "#fff";
    g.lineWidth = 3 * dpr;
    g.beginPath();
    g.arc(sx, sy, 6 * dpr, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
    const percent = Math.round((100 * explored.reduce((sum, v, i) => sum + (v && land[i] ? 1 : 0), 0)) / landTotal);
    stats.replaceChildren(...[`Discovered ${percent}%`, ...getStats()].map((text) => el("span", "", text)));
  }

  function isExplored(x, z) {
    const c = Math.round((x - bounds.x0) / FOG_CELL);
    const r = Math.round((z - bounds.z0) / FOG_CELL);
    return c >= 0 && r >= 0 && c < fogCols && r < fogRows && explored[r * fogCols + c] === 1;
  }

  function reveal(x, z) {
    const c0 = Math.round((x - bounds.x0) / FOG_CELL);
    const r0 = Math.round((z - bounds.z0) / FOG_CELL);
    const reach = Math.ceil(REVEAL / FOG_CELL);
    for (let r = r0 - reach; r <= r0 + reach; r += 1) {
      for (let c = c0 - reach; c <= c0 + reach; c += 1) {
        if (c < 0 || r < 0 || c >= fogCols || r >= fogRows) continue;
        if ((c - c0) ** 2 + (r - r0) ** 2 > reach * reach) continue;
        const i = r * fogCols + c;
        if (!explored[i]) {
          explored[i] = 1;
          fogImage.data.set([0, 0, 0, 0], i * 4);
          dirty = true;
        }
      }
    }
  }

  let redraw = 0;
  return {
    element: small,
    open,
    setVisible(on) {
      small.hidden = !on || !corner;
    },
    isExplored,
    get explored() {
      return explored.reduce((sum, v, i) => sum + (v && land[i] ? 1 : 0), 0) / landTotal;
    },
    update(dt, player, heading, yaw) {
      if (!player) return;
      last.x = player.x;
      last.z = player.z;
      last.heading = heading;
      last.yaw = yaw;
      reveal(player.x, player.z);
      if (dirty) {
        fogContext.putImageData(fogImage, 0, 0);
        saveTimer -= dt;
        if (saveTimer <= 0) {
          saveTimer = 2;
          dirty = false;
          try {
            storage?.setItem(EXPLORED_KEY, encode(explored));
          } catch {
            // Exploration is kept for this visit.
          }
        }
      }
      redraw -= dt;
      if (redraw <= 0 && !small.hidden) {
        redraw = 0.1;
        drawSmall();
      }
      if (panel.dialog.open) drawBig();
    },
    dispose() {
      small.remove();
      panel.dialog.remove();
    },
  };
}

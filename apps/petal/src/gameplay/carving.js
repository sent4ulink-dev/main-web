import * as THREE from "three";
import { button, el } from "../ui/dom.js";

// Carve a drawing into the big sakura. You draw with a finger or the mouse;
// the drawing becomes a groove with a light lip on the bark and is kept in
// this browser.

const KEY = "petal-isle-carving";

export function createCarving({ world, host, sfx, storage = globalThis.localStorage, onCarved = () => {} }) {
  const mesh = world.getObjectByName("CARVE_Tree");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  let material = null;
  if (mesh) {
    material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mesh.material = material;
    mesh.renderOrder = 2;
  }

  function engrave(source) {
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, 512, 512);
    const layer = (color, dx, dy) => {
      const tint = document.createElement("canvas");
      tint.width = tint.height = 512;
      const t = tint.getContext("2d");
      t.drawImage(source, 0, 0, 512, 512);
      t.globalCompositeOperation = "source-in";
      t.fillStyle = color;
      t.fillRect(0, 0, 512, 512);
      g.drawImage(tint, dx, dy);
    };
    layer("rgba(255,236,214,0.55)", 0, 4);
    layer("rgba(92,52,36,0.92)", 0, 0);
    texture.needsUpdate = true;
  }
  try {
    const stored = storage?.getItem(KEY);
    if (stored) {
      const image = new Image();
      image.onload = () => engrave(image);
      image.src = stored;
    }
  } catch {
    // No saved carving.
  }

  const dialog = el("dialog", "sheet carve-dialog");
  dialog.setAttribute("aria-labelledby", "carve-title");
  const title = el("h2", "", "Carve into the sakura tree");
  title.id = "carve-title";
  const hint = el("p", "", "Draw with your finger or mouse: a heart, an initial, anything.");
  const pad = document.createElement("canvas");
  pad.width = pad.height = 512;
  pad.className = "carve-pad";
  pad.setAttribute("aria-label", "Drawing area");
  const context = pad.getContext("2d");
  const actions = el("div", "sheet-actions");
  const clear = button("Clear", { className: "sheet-button" });
  const cancel = button("Cancel", { className: "sheet-button" });
  const save = button("Carve ♡", { className: "sheet-button primary" });
  actions.append(clear, cancel, save);
  dialog.append(title, hint, pad, actions);
  host.append(dialog);

  let drawing = null;
  const point = (event) => {
    const rect = pad.getBoundingClientRect();
    return [(event.clientX - rect.left) * (512 / rect.width), (event.clientY - rect.top) * (512 / rect.height)];
  };
  pad.addEventListener("pointerdown", (event) => {
    pad.setPointerCapture(event.pointerId);
    drawing = point(event);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 16;
    context.strokeStyle = "#ffffff";
  });
  pad.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const p = point(event);
    context.beginPath();
    context.moveTo(...drawing);
    context.lineTo(...p);
    context.stroke();
    drawing = p;
    if (Math.random() < 0.25) sfx.carve();
  });
  pad.addEventListener("pointerup", () => (drawing = null));
  clear.addEventListener("click", () => context.clearRect(0, 0, 512, 512));
  cancel.addEventListener("click", () => dialog.close());
  save.addEventListener("click", () => {
    engrave(pad);
    try {
      storage?.setItem(KEY, pad.toDataURL("image/png"));
    } catch {
      // The carving still shows for this visit.
    }
    dialog.close();
    onCarved();
  });

  return {
    available: Boolean(mesh),
    open() {
      dialog.showModal();
    },
    dispose() {
      dialog.remove();
      texture.dispose();
      material?.dispose();
    },
  };
}

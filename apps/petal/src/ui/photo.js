import { longDate } from "../core/dates.js";
import { button, el, sheet } from "./dom.js";

// Photo mode: the scene is rendered once more, framed as a polaroid with a
// handwritten caption and the date, and offered as a download. Nothing leaves
// the device.

export function createPhotoBooth(host, { capture, caption = () => "Our little world ♡", onPhoto = () => {} }) {
  const panel = sheet("photo-sheet", "A little picture");
  const preview = el("img", "photo-preview");
  preview.alt = "Your picture of Petal Isle";
  const actions = el("div", "sheet-actions");
  const save = el("a", "sheet-button primary", "Save the picture");
  const again = button("Take another", { className: "sheet-button" });
  actions.append(again, save);
  panel.body.append(preview, actions);
  host.append(panel.dialog);

  function frame(shot) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const pad = Math.round(image.width * 0.045);
        const bottom = Math.round(image.width * 0.16);
        const canvas = document.createElement("canvas");
        canvas.width = image.width + pad * 2;
        canvas.height = image.height + pad + bottom;
        const g = canvas.getContext("2d");
        g.fillStyle = "#fffdf8";
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.drawImage(image, pad, pad);
        g.fillStyle = "#8a4466";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `italic 600 ${Math.round(bottom * 0.34)}px "Cormorant Garamond", Georgia, serif`;
        g.fillText(caption(), canvas.width / 2, image.height + pad + bottom * 0.42);
        g.fillStyle = "#b08aa0";
        g.font = `${Math.round(bottom * 0.14)}px "Nunito", sans-serif`;
        const now = new Date();
        const date = longDate(`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`);
        g.fillText(`Petal Isle · ${date}`, canvas.width / 2, image.height + pad + bottom * 0.75);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      image.src = shot;
    });
  }

  async function take() {
    host.classList.add("photo-flash");
    const shot = capture();
    setTimeout(() => host.classList.remove("photo-flash"), 350);
    if (!shot) return;
    const framed = await frame(shot);
    preview.src = framed;
    save.href = framed;
    save.download = `petal-isle-${new Date().toISOString().slice(0, 10)}.jpg`;
    panel.open();
    onPhoto();
  }
  again.addEventListener("click", () => {
    panel.close();
    setTimeout(take, 250);
  });
  return {
    take,
    dispose() {
      panel.dialog.remove();
    },
  };
}

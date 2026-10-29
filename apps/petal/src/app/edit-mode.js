import { findTextPath, getPath, setPath } from "./content.js";
import { quadMapping } from "../core/homography.js";

// Edit mode (the ✎ on a share link): every word is edited right where it
// shows, in the same place, size, font and colour, so the page keeps looking
// like the finished invitation while it is edited. Words on the page (marked
// data-edit="content.path") become editable where they are; words painted on
// the 3D island get an invisible box fitted exactly over them (the island
// redraws them as you type, so what shows is always the real thing). A thin
// outline marks what can be edited. A compact toolbar, in its own strip
// above the page (it never covers it), saves, steps through the screens and
// finishes editing for good. On a phone the two buttons that step through
// the screens are big ones in a strip of their own under the page.

export const SCREENS = [
  { id: "intro", label: "Home" },
  { id: "question", label: "Question" },
  { id: "activities", label: "Adventure" },
  { id: "calendar", label: "Calendar" },
  { id: "map", label: "Map" },
  { id: "keepsake", label: "Keepsake book" },
];

// Which screen shows the words at a content path.
const SCREEN_OF = { intro: "intro", question: "question", activities: "activities", calendar: "calendar", map: "map", book: "keepsake" };
export function screenOf(path) {
  return SCREEN_OF[path.split(".")[0]] ?? null;
}

// The words an element holds as typed (line breaks only where allowed).
export function readWords(element) {
  const text = (element.innerText ?? element.textContent ?? "").replace(/\r/g, "").replaceAll(String.fromCharCode(160), " ");
  return element.dataset.multiline === "true" ? text.replace(/\n+$/, "") : text.replace(/\n/g, " ");
}

// A canvas font ("italic 600 92px Serif") at another scale.
export function scaleFont(font, scale) {
  return font.replace(/(\d+(?:\.\d+)?)px/, (_, size) => `${+(size * scale).toFixed(2)}px`);
}

// Makes an element editable right where it is (no copy of it, no field):
// what is typed goes into the content at its path. Words on one line end
// with Enter. Returns a function that stops editing it.
export function editInPlace(element, { content, onInput = () => {}, onDone = () => {}, plaintext = true }) {
  const path = element.dataset.edit;
  element.setAttribute("contenteditable", plaintext ? "plaintext-only" : "true");
  element.setAttribute("spellcheck", "false");
  const input = () => {
    const words = readWords(element);
    setPath(content, path, words);
    onInput(path, words);
  };
  const keydown = (event) => {
    if (event.key === "Enter" && element.dataset.multiline !== "true") {
      event.preventDefault();
      element.blur();
    } else if (event.key === "Escape") element.blur();
    event.stopPropagation(); // typing never walks the bunny
  };
  const stop = () => {
    element.removeEventListener("input", input);
    element.removeEventListener("keydown", keydown);
    element.removeEventListener("blur", stop);
    element.removeAttribute("contenteditable");
    onDone(path);
  };
  element.addEventListener("input", input);
  element.addEventListener("keydown", keydown);
  element.addEventListener("blur", stop);
  return stop;
}

// onSave() and onFinish() answer (a promise of) true when it worked;
// isDirty() says whether words are still waiting to be saved.
export function createEditMode({
  doc = document, root, content, world, screens = SCREENS, hint = "Tap any word to edit it right there",
  goTo = () => {}, onChange = () => {}, onSave = async () => true, onFinish = async () => true, isDirty = () => false,
  onPhoto = () => {}, onPhotoRemove = () => {}, photos = true,
}) {
  const body = doc.body;
  body.classList.add("editing");
  const plaintext = (() => {
    const probe = doc.createElement("div");
    probe.setAttribute("contenteditable", "plaintext-only");
    return probe.contentEditable === "plaintext-only";
  })();

  // ------------------------------------------------------------ toolbar --
  const bar = doc.createElement("nav");
  bar.className = "edit-bar";
  bar.setAttribute("aria-label", "Edit mode");
  const make = (tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  // A button with an icon, whose words hide on narrow phones.
  const action = (className, icon, words, label = words) => {
    const node = make("button", className);
    node.type = "button";
    node.title = label;
    node.setAttribute("aria-label", label);
    const mark = make("span", "edit-icon", icon);
    mark.setAttribute("aria-hidden", "true");
    const text = make("span", "edit-words", words);
    text.setAttribute("aria-hidden", "true");
    if (className === "edit-next") node.append(text, mark);
    else node.append(mark, text);
    return node;
  };
  const prev = action("edit-prev", "‹", "Previous", "Previous screen");
  const next = action("edit-next", "›", "Next", "Next screen");
  const where = make("div", "edit-where");
  const screenLabel = make("span", "edit-screen");
  const status = make("span", "edit-status");
  status.setAttribute("role", "status");
  where.append(screenLabel, status);
  const save = action("edit-save", "💾", "Save");
  const finish = action("edit-finish", "✓", "Finish for good", "Finish editing for good");
  bar.append(prev, where, next, save, finish);
  body.insertBefore(bar, body.firstChild);
  // Phones: Previous and Next move down into a strip under the page, with
  // the screen's name and a dot for each screen between them.
  const pages = doc.createElement("nav");
  pages.className = "edit-pages";
  pages.setAttribute("aria-label", "Switch screen");
  const pagesWhere = make("div", "edit-pages-where");
  const pagesLabel = make("span", "edit-screen");
  const dots = make("span", "edit-dots");
  dots.setAttribute("aria-hidden", "true");
  dots.append(...screens.map(() => make("i", "")));
  pagesWhere.append(pagesLabel, dots);
  body.append(pages);
  const narrow = typeof matchMedia === "function" ? matchMedia("(max-width: 560px)") : null;
  function layOut() {
    const phone = Boolean(narrow?.matches);
    pages.hidden = !phone;
    if (phone) pages.append(prev, pagesWhere, next);
    else {
      bar.insertBefore(prev, where);
      where.after(next);
    }
  }
  layOut();
  narrow?.addEventListener?.("change", layOut);

  let screen = 0;
  // The screens whose pictures can be photos of your own say so.
  const PHOTO_SCREENS = ["activities", "map", "keepsake"];
  const photoHint = "📷 Tap the button on a picture to add your own";
  function showScreen() {
    screenLabel.textContent = `${screen + 1}/${screens.length} · ${screens[screen].label}`;
    pagesLabel.textContent = screens[screen].label;
    [...dots.children].forEach((dot, index) => dot.classList.toggle("on", index === screen));
    prev.disabled = screen === 0;
    next.disabled = screen === screens.length - 1;
    if (photos) setStatus(PHOTO_SCREENS.includes(screens[screen].id) ? photoHint : hint);
  }
  function setStatus(text) {
    status.textContent = text;
  }
  showScreen();
  setStatus(hint);
  prev.addEventListener("click", () => {
    if (screen > 0) goTo(screens[--screen].id);
    showScreen();
  });
  next.addEventListener("click", () => {
    if (screen < screens.length - 1) goTo(screens[++screen].id);
    showScreen();
  });
  save.addEventListener("click", async () => {
    save.disabled = true;
    setStatus("Saving…");
    const ok = await onSave();
    save.disabled = false;
    if (!ok) setStatus("Could not save. Please try again.");
  });

  // Finishing for good: a plain Yes / No first.
  const confirm = doc.createElement("dialog");
  confirm.className = "sheet edit-confirm";
  confirm.setAttribute("aria-labelledby", "edit-confirm-title");
  const title = make("h2", "", "Finish editing for good?");
  title.id = "edit-confirm-title";
  const warning = make("p", "", "After you finish, nobody can edit this invitation again. The link stays the same, so send it to the one you love.");
  const trouble = make("p", "edit-confirm-trouble");
  trouble.setAttribute("role", "status");
  const answers = make("div", "sheet-actions");
  const no = make("button", "sheet-button", "No");
  no.type = "button";
  const yes = make("button", "sheet-button primary", "Yes, finish");
  yes.type = "button";
  answers.append(no, yes);
  confirm.append(title, warning, trouble, answers);
  root.append(confirm);
  finish.addEventListener("click", () => {
    trouble.textContent = "";
    confirm.showModal();
  });
  no.addEventListener("click", () => confirm.close());
  yes.addEventListener("click", async () => {
    yes.disabled = no.disabled = true;
    trouble.textContent = "Finishing…";
    const ok = await onFinish();
    yes.disabled = no.disabled = false;
    if (ok) confirm.close();
    else trouble.textContent = "Could not finish. Check your connection and try again.";
  });

  const beforeUnload = (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  addEventListener("beforeunload", beforeUnload);

  // ---------------------------------------------------- words in place --
  const changed = (path, words) => onChange(path, words);
  let stopEditing = null;
  // Any element marked data-edit, now or later (a message on screen).
  const begin = (event) => {
    const element = event.target?.closest?.("[data-edit]");
    if (!element || element.isContentEditable) return;
    stopEditing?.();
    stopEditing = editInPlace(element, { content, onInput: changed, onDone: () => (stopEditing = null), plaintext });
    if (event.type === "focusin") return;
    // Let the tap place the caret where it landed.
    setTimeout(() => {
      if (doc.activeElement !== element) element.focus();
    });
  };
  doc.addEventListener("pointerdown", begin, true);
  doc.addEventListener("focusin", begin, true);

  // ------------------------------------------- words painted on the island --
  const layer = make("div", "edit-layer");
  const canvas = root.querySelector("canvas");
  canvas?.after(layer);
  const boxes = new Map();
  // A picture on a board (or the book's polaroid): a photo of your own can be
  // put there, or taken away again (back to the island's drawing).
  function photoBox(path) {
    const box = make("div", "edit-photo");
    const actions = make("div", "edit-photo-actions");
    const change = make("button", "edit-photo-change");
    change.type = "button";
    const camera = make("span", "edit-photo-icon", "📷");
    camera.setAttribute("aria-hidden", "true");
    const words = make("span", "edit-photo-words");
    change.append(camera, words);
    const remove = make("button", "edit-photo-remove", "✕");
    remove.type = "button";
    remove.title = "Remove the picture";
    remove.setAttribute("aria-label", "Remove the picture");
    change.addEventListener("click", () => onPhoto(path));
    remove.addEventListener("click", () => onPhotoRemove(path));
    actions.append(change, remove);
    box.append(actions);
    // Its words always show: beside the camera, or under it on a small picture.
    box.show = (has, small) => {
      const label = has ? "Change picture" : "Add picture";
      if (words.textContent !== label) words.textContent = label;
      change.classList.toggle("small", small);
      change.title = label;
      change.setAttribute("aria-label", label);
      remove.hidden = !has;
      box.classList.toggle("has-photo", has);
    };
    return box;
  }
  // Each box is laid out at about the size it shows on screen (so the caret
  // and the outline stay a pixel thick), then bent onto its four corners.
  // Only the words of the screen shown (others may be hidden behind a tree);
  // while walking, the ones near enough to read.
  function place() {
    const seen = new Set();
    const walking = doc.body.dataset.state === "walking";
    const here = screens[screen].id;
    for (const target of world.editTargets()) {
      if (target.kind === "photo" && !photos) continue;
      if (walking) {
        const xs = target.quad.map((corner) => corner[0]);
        if (Math.max(...xs) - Math.min(...xs) < 48) continue;
      } else if (screenOf(target.path) !== here) continue;
      const [[x0, y0], [x1, y1], , [x3, y3]] = target.quad;
      const scale = Math.max(0.05, (Math.hypot(x1 - x0, y1 - y0) / target.box.w + Math.hypot(x3 - x0, y3 - y0) / target.box.h) / 2);
      const w = target.box.w * scale;
      const h = target.box.h * scale;
      const lineHeight = target.lineHeight * scale;
      const mapping = quadMapping(w, h, target.quad);
      if (!mapping) continue;
      let box = boxes.get(target.key);
      if (!box) {
        box = target.kind === "photo" ? photoBox(target.path) : make("div", "edit-3d");
        if (target.kind !== "photo") box.tabIndex = 0;
        layer.append(box);
        boxes.set(target.key, box);
      }
      seen.add(target.key);
      box.hidden = false;
      if (target.kind === "photo") {
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
        box.style.transform = mapping.css;
        box.show(target.has, w < 170);
        continue;
      }
      box.dataset.edit = target.path;
      box.dataset.multiline = String(target.multiline);
      const words = String(getPath(content, target.path) ?? "");
      const lines = target.wrap ? h / lineHeight : words.split("\n").length;
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      box.style.font = scaleFont(target.font, scale);
      box.style.lineHeight = `${lineHeight}px`;
      box.style.paddingTop = `${Math.max(0, (h - lines * lineHeight) / 2)}px`;
      box.style.textAlign = target.align || "center";
      box.style.whiteSpace = target.wrap ? "pre-wrap" : target.multiline ? "pre" : "nowrap";
      box.style.transform = mapping.css;
      if (doc.activeElement !== box && box.textContent !== words) box.textContent = words;
    }
    for (const [key, box] of boxes) if (!seen.has(key) && doc.activeElement !== box) box.hidden = true;
  }
  let frame = 0;
  const loop = () => {
    place();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    get content() { return content; },
    setStatus,
    // A message on screen whose words are the content's own becomes
    // editable too, and stays up while it is being edited.
    editMessage(element, text) {
      const path = findTextPath(content, text);
      if (path) element.dataset.edit = path;
      else delete element.dataset.edit;
      return Boolean(path);
    },
    // Where Previous and Next go from, after the game moved on by itself.
    setScreen(id) {
      const index = screens.findIndex((s) => s.id === id);
      if (index >= 0) {
        screen = index;
        showScreen();
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      stopEditing?.();
      removeEventListener("beforeunload", beforeUnload);
      doc.removeEventListener("pointerdown", begin, true);
      doc.removeEventListener("focusin", begin, true);
      narrow?.removeEventListener?.("change", layOut);
      pages.remove();
      bar.remove();
      layer.remove();
      confirm.remove();
      body.classList.remove("editing");
    },
  };
}

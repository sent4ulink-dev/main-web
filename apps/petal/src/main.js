import "./styles/app.css";
import "./styles/game-ui.css";
import { createAmbience } from "./app/ambience.js";
import { IMAGE_SLOTS, loadContent, mergeContent, setPath } from "./app/content.js";
import { createJukebox } from "./app/jukebox.js";
import {
  createAutosave, createShare, editTimeLeft, finalizeShare, loadShare, removeImage, saveShare, shareIdFrom, shareUrl, studioInfo,
  uploadImage,
} from "./app/share-client.js";
import { longDate } from "./core/dates.js";
import { createSettingsStore } from "./core/settings.js";
import { sfx } from "./fx/sfx.js";

if (new URLSearchParams(location.search).has("phone-preview")) {
  document.documentElement.classList.add("phone-preview");
}

const $ = (selector) => document.querySelector(selector);
// Three ways in: the bare address is the studio, where links are made (behind
// the studio password); a share link (?share=id) is one invitation, which
// whoever has it can edit (✎) for five days or until it is finished; an old
// link (#c=...) carries its words in the address and is only shown.
// The sent4u showcase opens ?share=test-petal (or ?share=test): a demo anyone can edit, kept only
// in that browser (a day), with no server or finishing; its photos stay in
// that browser too (see keepDemoPhoto).
const DEMO_KEY = "petal-isle-demo";
const demo = ["test", "test-petal"].includes(new URLSearchParams(location.search).get("share"));
const shareId = demo ? "test" : shareIdFrom();
const mode = demo ? "demo" : shareId ? "link" : new URLSearchParams(location.hash.slice(1)).has("c") ? "old" : "studio";
// The step editor's live preview (?embed=1, in its frame): the island itself, silent, with nothing to tap (app/easy/embed.js).
const EMBED = new URLSearchParams(location.search).has("embed") && window.parent !== window;
if (EMBED) document.documentElement.classList.add("embed");
function demoWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    return saved && Date.now() - saved.at < 24 * 60 * 60 * 1000 ? saved.content : null;
  } catch {
    return null;
  }
}
function saveDemo(words) {
  let kept = true;
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify({ at: Date.now(), content: words }));
  } catch {
    kept = false; // (no room, or storage is off): kept for this visit only
  }
  return { ok: true, kept };
}
const JUST_MADE = "petal-isle-just-made"; // open a new link straight in edit mode
const FINISHED_NOTE = "petal-isle-finished"; // show the link to send once finished
let share = null; // a share link's { editUntil, finalized }
let editMode = null;
let content = null;
const canEdit = () => mode === "demo" || (mode === "link" && Boolean(share) && !share.finalized && share.editUntil > Date.now());

function applyIntro() {
  const intro = content.intro;
  $("#intro .eyebrow").textContent = intro.eyebrow;
  const headline = document.createElement("span");
  headline.dataset.edit = "intro.headline";
  headline.textContent = intro.headline;
  const accent = document.createElement("em");
  accent.dataset.edit = "intro.headlineAccent";
  accent.textContent = intro.headlineAccent;
  $("#intro h1").replaceChildren(headline, document.createElement("br"), accent);
  $("#intro p").textContent = intro.copy;
  if (!$("#enter").disabled) setEnterLabel();
}
function setEnterLabel() {
  $("#enter").textContent = content.intro.button;
}

// The first scene is a sky full of clouds: soft puffs heaped into banks that
// cover everything. When the journey begins they part, each bank drifting
// off the way it lies from the middle and fading, as the camera dives in.
function buildClouds() {
  const bank = $("#intro .cloud-bank");
  const rand = (a, b) => a + Math.random() * (b - a);
  const spots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) spots.push([((col + 0.5) / 5) * 100 + rand(-6, 6), ((row + 0.5) / 4) * 100 + rand(-7, 7)]);
  }
  spots.push([50, 46], [36, 56], [64, 40]); // a few big ones behind the words
  for (const [x, y] of spots) {
    const cloud = document.createElement("span");
    cloud.className = "cloud";
    let dx = x - 50;
    let dy = y - 50;
    if (Math.hypot(dx, dy) < 8) {
      const a = rand(0, Math.PI * 2);
      dx = Math.cos(a);
      dy = Math.sin(a);
    }
    const length = Math.hypot(dx, dy);
    const push = rand(75, 105);
    cloud.style.cssText = [
      `--x:${x}%`, `--y:${y}%`, `--size:${rand(38, 60)}vmax`,
      `--dx:${((dx / length) * push).toFixed(1)}vmax`, `--dy:${((dy / length) * push).toFixed(1)}vmax`,
      `--drift-x:${rand(-2, 2).toFixed(2)}vmax`, `--drift-y:${rand(-1.2, 1.2).toFixed(2)}vmax`, `--drift:${rand(6, 11).toFixed(1)}s`,
    ].join(";");
    for (let i = 0; i < 5; i += 1) {
      const puff = document.createElement("span");
      const tint = Math.random();
      puff.className = `puff${tint < 0.18 ? " rose" : tint < 0.32 ? " lilac" : ""}`;
      const size = rand(45, 75);
      puff.style.cssText = `width:${size}%;height:${size}%;left:${rand(0, 100 - size)}%;top:${rand(12, 100 - size)}%`;
      cloud.append(puff);
    }
    bank.append(cloud);
  }
}
buildClouds();
let cloudTimer = 0;
const settings = createSettingsStore();
const ambience = createAmbience({ music: settings.get().music, nature: settings.get().effects });
// The Music Isle's song from YouTube: the one saved in ⚙ Settings, else the
// invitation's own (content.music.song), else the gramophone's waltz.
const jukebox = createJukebox({ host: $("#experience"), onFail: (text) => notify(text), onPlay: (title) => notify(`♪ ${title}`) });
const currentSong = () => settings.get().song || content?.music?.song || "";
if (new URLSearchParams(location.search).has("debug")) window.__jukebox = jukebox;
let settingsPanel = null;
// Settings live in the header, available on every screen.
const settingsButton = document.createElement("button");
settingsButton.id = "settings";
settingsButton.className = "icon-button";
settingsButton.type = "button";
settingsButton.setAttribute("aria-label", "Settings");
settingsButton.title = "Settings";
settingsButton.textContent = "⚙";
$(".controls").prepend(settingsButton);
async function openSettings() {
  if (!settingsPanel) {
    const { createSettingsPanel } = await import("./ui/settings-panel.js");
    // A song saved while editing goes into the invitation (see below).
    settingsPanel = createSettingsPanel($("#experience"), {
      settings, extras: settingsExtras, inviteSong: () => content?.music?.song || "", full: makerTools,
    });
  }
  settingsPanel.open();
}
settingsButton.addEventListener("click", openSettings);
// The island map, the Music Isle's song and the camera's settings are for
// whoever makes the invitation: they show while it can still be edited (and
// in the studio), not on a finished one.
const makerTools = () => mode === "studio" || canEdit();
// ⚙ also holds, while walking, a photo and the rest; in edit mode, who you
// play; and once the plan is made, sharing it.
const planComplete = () => Boolean(selections.activity && selections.place && selections.date);
function settingsExtras() {
  const items = [...(world?.extras?.() || [])];
  if (editMode && !items.some((item) => item.label.includes("character"))) {
    items.push({ label: "🐰 Choose character", run: () => world?.chooseCharacter() });
  }
  if (planComplete()) items.push({ label: "💌 Share your date", run: openPlan });
  return items;
}
// The finished plan to take along: a picture, a text message, a calendar file.
let planSheet = null;
async function openPlan() {
  if (!planSheet) {
    const [{ createPlanSheet }, { currentPlan }] = await Promise.all([import("./ui/plan-sheet.js"), import("./app/plan.js")]);
    planSheet = createPlanSheet($("#experience"), { getPlan: () => currentPlan(content, selections) });
  }
  planSheet.open();
}
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let world,
  paused = reduced.matches,
  state = "loading",
  toastTimer;
// The choices made on the boards, kept per invitation.
const CHOICES_KEY = shareId ? `petal-isle-choices:${shareId}` : "petal-isle-choices";
let selections = {};
try {
  selections = JSON.parse(localStorage.getItem(CHOICES_KEY) || "{}");
} catch {
  selections = {};
}
// In edit mode a message in the invitation's own words can be edited right
// there, so it stays up longer (and for as long as it is being edited).
function notify(text) {
  const message = $("#message");
  if (message.isContentEditable) return;
  message.textContent = text;
  const editable = editMode?.editMessage(message, text);
  message.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => message.classList.remove("visible"), editable ? 9000 : 4000);
}
function updateState(next) {
  state = next;
  document.body.dataset.state = next;
  noteCheckpoint(next);
  // Back at the start (a restart), the clouds close in again.
  if (next === "intro") {
    clearTimeout(cloudTimer);
    $("#intro").classList.remove("parting", "gone");
  }
  $("#intro").inert = next !== "intro";
  $("#yes-heart").disabled = next !== "invitation";
  $("#no-heart").disabled = next !== "invitation";
  if (next !== "walking") $("#walk-hint").hidden = true;
  $("#skip").hidden = next !== "journey";
  $("#recenter").hidden = !["invitation", "celebrating"].includes(next);
  $("#guide").textContent =
    next === "intro"
      ? "A garden floating above the clouds. A question waiting for you."
      : next === "invitation"
        ? "Choose one of the two heart stones."
        : next === "celebrating"
          ? "You, me, and five little gardens to open."
          : next === "exploring" ? "Tap a framed surface to make this part of the story your own."
          : next === "wandering" ? "The camera is taking you to the next garden."
          : next === "walking" ? (matchMedia("(pointer: coarse)").matches
            ? "Walk with the joystick · drag to look around."
            : "Walk with WASD or the arrow keys · drag to look around.")
          : "Drag to look around. The butterflies know the way.";
}

// While walking, a little strip at the top says how far the plan has come and
// what to do next (the same order the paw-print trail leads in): a heart for
// each of the four stops, then the big gate.
const STEPS = [
  ["activity", "Choose your adventure"], ["calendar", "Choose your day"], ["place", "Choose your place"],
  ["book", "Open the keepsake book"],
];
let stepsShown = "";
function updateSteps() {
  const strip = $("#steps");
  const done = state === "walking" ? world?.progress?.() : null;
  const next = done ? STEPS.findIndex(([key]) => !done[key]) : -1;
  const through = done && next < 0 && done.gate;
  const key = !done || through ? "" : `${STEPS.map(([k]) => (done[k] ? 1 : 0)).join("")}${next}`;
  if (key === stepsShown) return;
  stepsShown = key;
  strip.hidden = !key;
  if (!key) return;
  const hearts = document.createElement("span");
  hearts.className = "steps-hearts";
  hearts.setAttribute("aria-hidden", "true");
  for (const [k] of STEPS) {
    const heart = document.createElement("i");
    heart.textContent = done[k] ? "♥" : "♡";
    if (done[k]) heart.className = "done";
    hearts.append(heart);
  }
  // (How many are done, like the hearts: never a "4/4" beside an empty heart.)
  const words = document.createElement("span");
  words.textContent = next < 0 ? "Go through the big gate ♡" : `${STEPS.filter(([k]) => done[k]).length}/${STEPS.length} · ${STEPS[next][1]}`;
  strip.replaceChildren(hearts, words);
}
setInterval(updateSteps, 600);

function saveSelections() {
  try {
    localStorage.setItem(CHOICES_KEY, JSON.stringify(selections));
  } catch {
    // The interactive choices still work if storage is disabled.
  }
}

function keepsakeSummary() {
  const date = selections.date ? longDate(selections.date) : "A day to choose together";
  return `${date} · ${selections.place || "A place waiting for us"} · ${selections.activity || "A little adventure"}.`;
}

// A choice made on a board (the host shows it, you tap it again).
function applyChoice(type, value) {
  if (type === "calendar") {
    selections.date = value;
    notify("Our day is saved in the keepsake book. ♡");
  } else {
    selections[type] = value;
    notify(`${value} — now part of our story. ♡`);
  }
  saveSelections();
  world?.setSelections({ ...selections });
}

// The keepsake book opens as a page to read; everything else is picked right
// on the boards (see applyChoice).
function openSlot(name, info) {
  if (info?.type !== "keepsake") return;
  $("#slot-kicker").textContent = info.kicker;
  $("#slot-title").textContent = info.title;
  $("#slot-body").textContent = keepsakeSummary();
  const control = $("#slot-control");
  control.replaceChildren();
  const note = document.createElement("span");
  note.className = "choice-note";
  note.textContent = selections.activity && selections.place && selections.date
    ? "Your choices are written into this browser’s keepsake."
    : "To complete this page, visit the adventure, calendar and map gardens.";
  control.append(note);
  $("#slot-save").textContent = "Close the book";
  $("#slot-dialog").showModal();
}
// The journey begins: the clouds part (with a rush of air) as the camera
// dives down to the question.
function partClouds() {
  $("#intro").classList.add("parting");
  sfx.whoosh?.();
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => $("#intro").classList.add("gone"), 3000);
}
$("#enter").addEventListener("click", () => {
  if (!world || state !== "intro" || editMode) return;
  partClouds();
  world.enter();
});
// Where the visitor really was (the clouds, the question, or walking, and
// where): Save and Finish go back there, whatever screens Previous and Next
// showed in between.
let checkpoint = { state: "intro" };
let browsing = false; // Previous / Next is showing a screen
function noteCheckpoint(next) {
  if (next === "walking") browsing = false; // walking only ever starts from the game itself
  if (!browsing && ["intro", "invitation", "walking"].includes(next)) checkpoint = { state: next };
}
// Edit mode's Previous / Next: the first screen, or one of the guided views.
function showScreen(id) {
  if (state === "walking") checkpoint = { state: "walking", spot: world.walkSpot() };
  browsing = true;
  if (id === "intro") {
    world.restart();
    return;
  }
  if (state === "intro") partClouds();
  world.goTo(id);
}

// ---------------------------------------------------- a share link's ✎ --
// The header's ✎ opens edit mode while the link can still be edited, and a
// badge in the corner says for how long.
const editButton = document.createElement("button");
editButton.id = "edit-link";
editButton.className = "icon-button";
editButton.type = "button";
editButton.setAttribute("aria-label", "Edit your invitation");
editButton.title = "Edit your invitation";
editButton.textContent = "✎";
editButton.hidden = true;
$(".controls").prepend(editButton);
const cornerBadge = document.createElement("div");
cornerBadge.className = "hud-badge";
cornerBadge.hidden = true;
$(".hud").prepend(cornerBadge);
function updateLinkControls() {
  if (mode !== "link" && mode !== "demo") return;
  const editable = canEdit();
  editButton.hidden = !editable || Boolean(editMode);
  cornerBadge.hidden = editButton.hidden;
  if (mode === "demo") cornerBadge.textContent = "✎ Example — try editing";
  else if (editable) cornerBadge.textContent = `✎ Editing time left: ${editTimeLeft(share.editUntil - Date.now())}`;
}
// A link and the demo are edited step by step, with the island running live beside the words (app/easy/); while
// that is open this page lets go of its own island and sound (two at once are too much for a phone), and closing
// it reloads the page with the new words. A link just made still opens in place (startEditing).
editButton.addEventListener("click", async () => {
  if (startingEdit || !canEdit()) return;
  startingEdit = true;
  const { openCardEditor } = await import("./app/easy/open-editor.js");
  startingEdit = false;
  openCardEditor({ demo, shareId, words: () => content, saveDemo, onOpen: letGo });
});
function letGo() {
  clearTimeout(toastTimer);
  jukebox.dispose();
  ambience.dispose();
  world?.dispose();
  world = null;
  try { $("#world").getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* already gone */ }
}

// While editing, every change is saved a moment later (Save saves at once).
let autosave = null;
let enterButton = null;
let retryTimer = 0;
function contentChanged(path) {
  if (path) world?.preview(content, path);
  if (editMode) autosave.schedule(content);
}
function showSaveState(saveState, result) {
  if (!editMode) return;
  clearTimeout(retryTimer);
  if (saveState === "saving") editMode.setStatus("Saving…");
  else if (saveState === "saved") editMode.setStatus("Saved ♡");
  else if (result?.error === "finalized" || result?.error === "edit_window_closed") {
    // Finished elsewhere, or the five days are up: nothing more can be saved.
    if (result.error === "finalized") share.finalized = true;
    else share.editUntil = 0;
    autosave.cancel();
    stopEditing();
    notify(result.error === "finalized" ? "This invitation has already been finished." : "The editing time is over, so the last change was not saved.");
  } else {
    editMode.setStatus("Could not save. Trying again…");
    retryTimer = setTimeout(() => autosave.flush(), 5000);
  }
}
let startingEdit = false;
async function startEditing() {
  if (editMode || startingEdit || !canEdit()) return;
  startingEdit = true;
  const { createEditMode } = await import("./app/edit-mode.js");
  startingEdit = false;
  // The start button's words are edited where they are, so the button
  // becomes plain words that look the same (the toolbar moves on).
  enterButton = $("#enter");
  const label = document.createElement("span");
  label.id = "enter";
  label.className = "enter-button";
  label.dataset.edit = "intro.button";
  label.textContent = content.intro.button;
  enterButton.replaceWith(label);
  autosave ??= createAutosave({ save: (words) => (demo ? saveDemo(words) : saveShare(shareId, words)), onState: showSaveState });
  editMode = createEditMode({
    root: $("#experience"),
    content,
    world,
    hint: demo ? "Example: changes stay in this browser only" : `Editing time left: ${editTimeLeft(share.editUntil - Date.now())}`,
    // (The demo shows the photo buttons too; a tap says where photos can be added.)
    goTo: showScreen,
    onChange: (path) => contentChanged(path),
    isDirty: () => autosave.dirty,
    // Save: saved at once, then the invitation as it will be seen (✎ goes on).
    onSave: async () => {
      const ok = await autosave.flush(content);
      if (ok) {
        stopEditing();
        notify("Saved ♡ The invitation now looks like this.");
      }
      return ok;
    },
    onFinish: finishEditing,
    onPhoto: pickPhoto,
    onPhotoRemove: removePhoto,
  });
  editMode.setScreen(world.screenNow()); // Previous / Next go on from what is in view
  updateLinkControls();
}
function stopEditing() {
  if (!editMode) return;
  clearTimeout(retryTimer);
  editMode.dispose();
  editMode = null;
  if (enterButton) {
    enterButton.textContent = content.intro.button;
    $("#enter").replaceWith(enterButton);
    enterButton = null;
  }
  // Back to where the visitor was before the screens were stepped through.
  if (browsing) {
    browsing = false;
    world?.resume(checkpoint);
  }
  updateLinkControls();
}
// Finished for good: saved, locked on the server, then shown as it will be
// seen, with the link to send.
async function finishEditing() {
  if (demo) {
    stopEditing();
    notify("This is an example. Finish for good on the link you bought ♡");
    return true;
  }
  if (!(await autosave.flush(content))) return false;
  const result = await finalizeShare(shareId);
  if (!result.ok) return false;
  share.finalized = true;
  try {
    localStorage.removeItem(CHOICES_KEY); // the invitation starts fresh
    localStorage.removeItem("petal-isle-danced"); // …the book's dance and the walk through the gate too
    localStorage.removeItem("petal-isle-through");
    sessionStorage.setItem(FINISHED_NOTE, shareId);
  } catch {
    // The link is finished all the same.
  }
  location.reload();
  return true;
}
// A photo of your own for a board's picture or the book's polaroid: shrunk
// and converted here (app/photo.js), then kept by the server, which deletes
// the one it replaces.
const SLOT_OF_PATH = Object.fromEntries(Object.entries(IMAGE_SLOTS).map(([slot, path]) => [path, slot]));
const photoInput = document.createElement("input");
photoInput.type = "file";
photoInput.accept = "image/*";
photoInput.hidden = true;
document.body.append(photoInput);
let photoPath = null;
let photoBusy = false;
function pickPhoto(path) {
  if (photoBusy || !editMode) return;
  photoPath = path;
  photoInput.value = "";
  photoInput.click();
}
function photoFailed(result) {
  if (result.error === "finalized" || result.error === "edit_window_closed") showSaveState("failed", result);
  else editMode?.setStatus(result.error === "too_large" ? "The picture is too large." : "Could not save the picture. Please try again.");
}
photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  const path = photoPath;
  if (!file || !path || !editMode || photoBusy) return;
  const { PHOTO_MAX_INPUT, compressPhoto } = await import("./app/photo.js");
  if ((file.type && !file.type.startsWith("image/")) || file.size > PHOTO_MAX_INPUT) {
    editMode.setStatus(file.size > PHOTO_MAX_INPUT ? "The picture is too large (up to 30 MB)." : "This file is not a picture.");
    return;
  }
  photoBusy = true;
  editMode.setStatus("Preparing the picture…");
  let photo = null;
  try {
    // (The demo's photos are kept in the browser, so they are made smaller.)
    photo = await compressPhoto(file, demo ? { max: DEMO_PHOTO_MAX } : {});
  } catch {
    photoBusy = false;
    editMode?.setStatus("Could not read this picture. Please choose another.");
    return;
  }
  if (demo) {
    await keepDemoPhoto(path, photo);
    photoBusy = false;
    return;
  }
  editMode?.setStatus("Saving the picture…");
  const result = await autosave.exclusive(() => uploadImage(shareId, SLOT_OF_PATH[path], photo.blob, photo));
  photoBusy = false;
  if (!result.ok) return photoFailed(result);
  setPath(content, path, result.url);
  world?.preview(content, path);
  editMode?.setStatus("Picture saved ♡");
});
// The demo (?share=test) never sends a photo anywhere: it is put into the
// demo's own words as a data address (which carries the photo's size at its
// end, as a stored photo's name does) and kept with them in this browser for
// a day. If the browser has no room, it still shows for this visit.
const DEMO_PHOTO_MAX = 960;
async function keepDemoPhoto(path, photo) {
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(photo.blob);
  });
  if (!data) {
    editMode?.setStatus("Could not read this picture. Please choose another.");
    return;
  }
  setPath(content, path, `${data}#-${photo.width}x${photo.height}.${photo.blob.type === "image/webp" ? "webp" : "jpg"}`);
  world?.preview(content, path);
  const { kept } = saveDemo(content);
  editMode?.setStatus(kept ? "Picture added ♡ It stays on this device only." : "Picture added ♡ It shows until you close the page.");
}
async function removePhoto(path) {
  if (photoBusy || !editMode) return;
  if (demo) {
    setPath(content, path, "");
    world?.preview(content, path);
    saveDemo(content);
    editMode.setStatus("Picture removed");
    return;
  }
  photoBusy = true;
  editMode.setStatus("Removing the picture…");
  const result = await autosave.exclusive(() => removeImage(shareId, SLOT_OF_PATH[path]));
  photoBusy = false;
  if (!result.ok) return photoFailed(result);
  setPath(content, path, "");
  world?.preview(content, path);
  editMode?.setStatus("Picture removed");
}
// A message on screen being edited stays up.
$("#message").addEventListener("focusin", () => editMode && clearTimeout(toastTimer));
$("#message").addEventListener("focusout", () => {
  if (!editMode) return;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#message").classList.remove("visible"), 2500);
});

// ------------------------------------------------------------ the studio --
// The bare address makes links: "🔗 Generate link" (behind the password,
// when one is set) and how many have been made so far.
let studioPassword = "";
let studioLock = null;
let studioShares = null;
const makeButton = document.createElement("button");
makeButton.id = "make-link";
makeButton.className = "hud-pill";
makeButton.type = "button";
makeButton.textContent = "🔗 Generate link";
makeButton.hidden = true;
$(".controls").prepend(makeButton);
function showStudioCount() {
  if (!studioShares) return;
  cornerBadge.hidden = false;
  cornerBadge.textContent = `🔗 ${studioShares.total} links`;
  cornerBadge.title = `${studioShares.active} being edited · ${studioShares.finalized} finished`;
}
async function openStudio() {
  const { createStudioLock } = await import("./ui/studio.js");
  const info = await studioInfo();
  if (info.ok) studioShares = info.shares;
  // Without a studio password the studio makes no links (sold links come
  // from the store); the island is simply shown.
  if (info.ok && !info.open) return;
  if (info.ok && info.locked) {
    studioLock = createStudioLock($("#experience"), {
      onUnlock: (password) => {
        studioPassword = password;
        makeButton.hidden = false;
        showStudioCount();
      },
    });
    studioLock.open();
    return;
  }
  makeButton.hidden = false;
  showStudioCount();
}
makeButton.addEventListener("click", async () => {
  const { serverTrouble, showLinkSheet } = await import("./ui/studio.js");
  makeButton.disabled = true;
  makeButton.textContent = "Generating…";
  const result = await createShare(content, studioPassword);
  makeButton.disabled = false;
  makeButton.textContent = "🔗 Generate link";
  if (result.ok) {
    try {
      sessionStorage.setItem(JUST_MADE, result.id);
    } catch {
      // It opens with ✎ instead.
    }
    if (studioShares) {
      studioShares.total += 1;
      studioShares.active += 1;
      showStudioCount();
    }
    showLinkSheet($("#experience"), {
      url: shareUrl(result.id),
      title: "Your new link is ready ♡",
      text: "Open the link and edit the invitation right away. Finish editing within 5 days, then send it to the one you love.",
    });
  } else if ((result.error === "wrong_password" || result.error === "locked_out") && studioLock) {
    makeButton.hidden = true;
    studioLock.open();
  } else notify(serverTrouble(result));
});
$("#skip").addEventListener("click", () => world?.arrive());
$("#recenter").addEventListener("click", () => world?.recenter());
$("#yes-heart").addEventListener("click", () => world?.chooseYes());
$("#no-heart").addEventListener("click", () => world?.dodge());
$("#slot-save").addEventListener("click", () => $("#slot-dialog").close());
$("#slot-dialog").addEventListener("click", (event) => {
  if (event.target === $("#slot-dialog")) $("#slot-dialog").close();
});
// Sound: the lullaby and the island's sounds start with the first tap or key
// press (browsers need one), unless they were turned off last time.
function showSound(on) {
  const button = $("#sound");
  button.setAttribute("aria-pressed", String(on));
  button.setAttribute("aria-label", on ? "Turn the sound off" : "Turn the sound on");
  button.textContent = on ? "♫" : "♪";
}
function wakeSound(event) {
  if (event.target?.closest?.("#sound")) return; // its own click decides
  if (!ambience.start()) return;
  for (const type of ["pointerup", "keydown", "touchend"]) window.removeEventListener(type, wakeSound, true);
  if (settings.get().sound && !ambience.playing) {
    ambience.setEnabled(true);
    showSound(true);
  }
}
for (const type of ["pointerup", "keydown", "touchend"]) window.addEventListener(type, wakeSound, true);
// Phones: Safari still zooms on a pinch (two fingers on the stick and a
// button, say) whatever the CSS says; its gesture events can be refused.
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
$("#sound").addEventListener("click", () => {
  if (!ambience.start()) {
    notify("Sound cannot be played in this browser.");
    return;
  }
  const on = !ambience.playing;
  ambience.setEnabled(on);
  settings.set({ sound: on });
  showSound(on);
  notify(on ? "The island’s little lullaby. ♫" : "Only quiet, and a little magic.");
});
settings.subscribe((next, patch) => {
  if ("music" in patch || "effects" in patch) ambience.setLevels({ music: next.music, nature: next.effects });
  if ("song" in patch) {
    // Saved while editing, the song becomes the invitation's own.
    if (editMode && content) {
      content.music.song = next.song;
      contentChanged(null);
    }
    jukebox.setSong(currentSong());
  }
});
// Animations rest for visitors who prefer reduced motion.
reduced.addEventListener("change", (event) => {
  paused = event.matches;
  world?.pause(paused);
});
// The invitation's server sleeps when nobody has used it for a while, and
// takes up to a minute to wake: say so while the clouds wait.
const wakeTimer = shareId && !demo ? setTimeout(() => {
  if (state === "loading") $("#enter").textContent = "Waking the invitation… one moment";
}, 6000) : 0;
Promise.all([import("./world/stage.js"), loadContent(), shareId && !demo ? loadShare(shareId, { patient: true }).finally(() => clearTimeout(wakeTimer)) : null])
  .then(async ([{ createGrove }, loaded, shared]) => {
    if (demo) {
      content = mergeContent(loaded, demoWords() || {});
    } else if (shareId) {
      if (!shared.ok) throw Object.assign(new Error(`Share link: ${shared.error}`), { code: shared.status === 404 ? "SHARE_MISSING" : "SHARE_OFFLINE" });
      share = { editUntil: shared.editUntil, finalized: shared.finalized };
      content = mergeContent(loaded, shared.content);
    } else content = loaded;
    applyIntro();
    if (!EMBED) jukebox.setSong(currentSong());
    world = await createGrove($("#world"), {
      content,
      settings,
      selections: { ...selections },
      paused,
      reducedMotion: reduced.matches,
      onState: updateState,
      onMessage: notify,
      onProject: (yes, no) => {
        for (const [button, point] of [
          [$("#yes-heart"), yes],
          [$("#no-heart"), no],
        ]) {
          const active = state === "invitation" && point.visible;
          button.hidden = !active;
          if (active) {
            button.style.left = `${point.x}px`;
            button.style.top = `${point.y}px`;
            button.style.width = `${point.width}px`;
            button.style.height = `${point.height}px`;
          }
        }
      },
      onSlot: openSlot,
      onChoose: applyChoice,
      // The dance goes on for as long as the song plays (and starts it, from the tap).
      songPlaying: () => jukebox.playing,
      onDance: () => jukebox.play(),
      onHint: (text) => {
        $("#walk-hint").hidden = !text;
        if (text) $("#walk-hint").textContent = text;
      },
      // Who you play is the invitation's own; it is chosen in edit mode only.
      character: content.character,
      chooseCharacter: () => Boolean(editMode),
      makerTools,
      onCharacter: (who) => {
        content.character = who;
        contentChanged(null);
      },
      onTour: (index, stop) => {
        if (state !== "intro") editMode?.setScreen(stop.view);
      },
      // After the dance at the keepsake book: the plan, ready to share.
      onPlanReady: () => {
        if (planComplete()) openPlan();
      },
    });
    $("#enter").disabled = false;
    setEnterLabel();
    // The soundscape follows the island's weather, the time of day, and how
    // near the water you are.
    const scapeTimer = setInterval(() => {
      const env = world?.environment;
      if (!env) return;
      const scape = world.soundscape?.() || {};
      jukebox.update({ near: scape.gramophone || 0, dancing: scape.dancing, enabled: ambience.playing, level: settings.get().music });
      ambience.setScape({ rain: env.weights.rain, wind: env.wind, night: env.night, ...scape, tune: jukebox.active ? "song" : "waltz" });
    }, 500);
    if (import.meta.hot) import.meta.hot.dispose(() => clearInterval(scapeTimer));
    updateState("intro");
    if (EMBED) {
      const { startPreview } = await import("./app/easy/embed.js");
      startPreview({ world, words: () => content, setWords: (next) => { content = next; }, applyIntro, partClouds, message: $("#message") });
      return;
    }
    if (mode === "studio") openStudio();
    if (mode === "demo") updateLinkControls();
    if (mode === "link") {
      updateLinkControls();
      setInterval(updateLinkControls, 30000);
      let justMade = null;
      let finished = null;
      try {
        justMade = sessionStorage.getItem(JUST_MADE);
        finished = sessionStorage.getItem(FINISHED_NOTE);
        if (justMade === shareId) sessionStorage.removeItem(JUST_MADE);
        if (finished === shareId) sessionStorage.removeItem(FINISHED_NOTE);
      } catch {
        // Nothing to pick up.
      }
      // A link just made opens ready to edit; one just finished shows itself
      // to send.
      if (justMade === shareId) startEditing();
      if (finished === shareId) {
        const { showLinkSheet } = await import("./ui/studio.js");
        showLinkSheet($("#experience"), {
          url: shareUrl(shareId),
          title: "The invitation is ready ♡",
          text: "Now send this link to the one you love. The invitation can no longer be edited.",
        });
      }
    }
  })
  .catch((error) => {
    console.error("Petal Isle could not initialize.", error);
    document.body.dataset.state = "error";
    $("#intro").inert = false;
    $("#intro h1").innerHTML = error.code === "SHARE_MISSING"
      ? "This link<br><em>was not found.</em>"
      : error.code === "SHARE_OFFLINE" ? "The invitation<br><em>did not load.</em>" : "The island needs<br><em>a little help.</em>";
    $("#intro p").textContent = error.code === "SHARE_MISSING"
      ? "Check the address, or ask the sender for a new link."
      : error.code === "SHARE_OFFLINE" || error.code === "SKY_ASSET"
        ? "Check your connection and try again."
        : "The 3D island did not load. Try refreshing the page, or use a browser with hardware acceleration turned on.";
    $("#enter").disabled = false;
    $("#enter").textContent = "Try again";
    $("#enter").addEventListener("click", () => location.reload());
  });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    clearTimeout(toastTimer);
    world?.dispose();
    ambience.dispose();
    jukebox.dispose();
    editMode?.dispose();
  });

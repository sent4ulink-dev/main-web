// A link and the demo are edited through the step-by-step editor, with Petal Isle itself running live beside the words
// (live-preview.js loads this page again with ?embed=1; app/easy/embed.js is what runs in there).
import { openEasyEditor, shrinkImage } from "./easy-editor.js";
import { LivePreview } from "./live-preview.js";
import { stepsFor, title } from "./easy-steps.js";
import { IMAGE_SLOTS, mergeContent, DEFAULT_CONTENT } from "../content.js";
import { finalizeShare, loadShare, removeImage, saveShare, shareUrl, uploadImage } from "../share-client.js";
import { PHOTO_MAX_INPUT, compressPhoto } from "../photo.js";

const SLOT_OF_PATH = Object.fromEntries(Object.entries(IMAGE_SLOTS).map(([slot, path]) => [path, slot]));
const DEMO_PHOTO_MAX = 960; // the demo's photos stay in the browser, so they are smaller

// A photo the browser can't read as it is (HEIC on a Mac) goes through the editor's own converter first.
async function makeSmall(file, options) {
  if (file.size > PHOTO_MAX_INPUT) throw new Error("This photo is too big (up to 30 MB).");
  try {
    return await compressPhoto(file, options);
  } catch {
    const blob = await shrinkImage(file);
    return compressPhoto(new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }), options);
  }
}
const readAsData = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Couldn’t read this photo. Please choose another."));
  reader.readAsDataURL(blob);
});
const failed = (result, fallback) => new Error(
  result.error === "too_large" ? "This photo is too big."
    : result.error === "finalized" || result.error === "edit_window_closed" ? "This link can no longer be edited." : fallback,
);

export function openCardEditor({ demo, shareId, words, saveDemo, onOpen }) {
  let until = 0;
  const store = (path) => async (file) => {
    if (demo) {
      // (the demo's photos never leave this browser: kept in its words, with their size at the end, as a stored one's name has)
      const photo = await makeSmall(file, { max: DEMO_PHOTO_MAX });
      return `${await readAsData(photo.blob)}#-${photo.width}x${photo.height}.${photo.blob.type === "image/webp" ? "webp" : "jpg"}`;
    }
    const photo = await makeSmall(file, {});
    const result = await uploadImage(shareId, SLOT_OF_PATH[path], photo.blob, photo);
    if (!result.ok) throw failed(result, "Couldn’t save the photo. Please try again.");
    return result.url;
  };
  const drop = (path) => async () => {
    if (demo) return;
    const result = await removeImage(shareId, SLOT_OF_PATH[path]);
    if (!result.ok) throw failed(result, "Couldn’t remove the photo. Please try again.");
  };
  const embed = new URL(location.href);
  embed.searchParams.set("embed", "1");
  embed.hash = "";
  const live = new LivePreview({ src: embed.href });
  openEasyEditor({
    title, live, steps: stepsFor({ store, drop }),
    load: async () => {
      if (demo) return { content: structuredClone(words()), canEdit: true };
      const result = await loadShare(shareId, { patient: true });
      if (!result.ok) throw new Error("Couldn’t load the invitation. Please try again.");
      until = result.editUntil;
      return { content: mergeContent(DEFAULT_CONTENT, result.content), canEdit: !result.finalized && result.editUntil > Date.now(), finished: result.finalized };
    },
    save: async (content, { finish } = {}) => {
      if (demo) { saveDemo(content); return; }
      const result = await saveShare(shareId, content);
      if (!result.ok) throw failed(result, "Couldn’t save. Check your internet and try again.");
      if (finish) {
        const done = await finalizeShare(shareId);
        if (!done.ok) throw failed(done, "Couldn’t finish. Please try again.");
      }
    },
    mediaURL: (name) => name,
    canFinish: !demo,
    shareUrl: demo ? "" : shareUrl(shareId),
    deadlineText: () => (demo ? "This is a demo: what you write is kept on this device only."
      : until ? `You can edit this link until ${new Date(until).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.` : ""),
    onOpen,
    done: () => location.reload(),
  });
}

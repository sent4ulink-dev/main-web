// The island as the step editor's live preview (?embed=1, inside the editor's frame): the same Petal Isle, running,
// silent, with nothing to tap. The editor (live-preview.js) says which stop to show and hands over the words as they
// are typed: the island redraws them where they show (the question stone and its hearts, the boards, the calendar
// tree, the map, the keepsake book), the first screen follows, and the Yes / No messages show as a tap would show them.

/** The leaf paths whose value differs between two contents ('character', 'activities.1.title', ...). */
function changedPaths(a, b, base = "", out = []) {
  if (a === b) return out;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) changedPaths(a[k], b[k], base ? `${base}.${k}` : k, out);
    return out;
  }
  out.push(base);
  return out;
}

/** `words()` / `setWords(next)` are the page's own content; `partClouds()` opens the first screen's clouds (main.js). */
export function startPreview({ world, words, setWords, applyIntro, partClouds, message }) {
  let scene = "intro", sub = null;
  const say = (text) => {
    message.textContent = text || "";
    message.classList.toggle("visible", Boolean(text));
  };
  // The question step's Yes and No messages (its fields marked slot 1 and 2), as a tap on the hearts shows them.
  const saying = () => (scene !== "question" ? "" : sub === 1 ? words().question.yesMessage : sub === 2 ? words().question.noMessage : "");

  function show(s, sb = null) {
    const was = scene;
    scene = s;
    sub = sb;
    say(saying());
    if (s === was) return;
    if (s === "intro") {
      world.restart();
      return;
    }
    if (document.body.dataset.state === "intro") partClouds();
    if (s === "music") world.showMusic();
    else world.goTo(s);
  }

  function setContent(next) {
    const paths = changedPaths(words(), next);
    if (!paths.length) return;
    const content = structuredClone(next);
    setWords(content);
    applyIntro();
    for (const path of paths) {
      if (path === "character") world.setCharacter(content.character);
      else world.preview(content, path);
    }
    say(saying());
  }

  // (the island follows its frame's size by itself; the Music Isle isn't one of its stops, so it is looked at again)
  function reframe() {
    if (scene === "music") setTimeout(() => world.showMusic(), 300);
  }

  window.__ez = { show, setContent, reframe, dpr: () => {} };
}

// The card as the step editor's live preview (?embed=1, inside the editor's frame): the same Halloween invitation,
// running, silent, with nothing to tap. The editor (live-preview.js) says which screen to show and hands over the words
// as they are typed; they change in place on the screen shown (the screen isn't drawn again, so nothing restarts).
import { forShowing } from './easy-steps.js';

/** `show(name)` draws a screen and `editor.decorate()` puts the words on it (app.js, inline-editor.js). */
export function startPreview({ editor, show, getScene }) {
  window.__ez = {
    show(scene) { if (scene && scene !== getScene()) show(scene); },
    setContent(content) {
      editor.content = forShowing(content);
      editor.decorate();
    },
    reframe() {},
    dpr() {},
  };
}

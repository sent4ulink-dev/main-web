import { TIME_LABELS, TIME_MODES } from "../world/environment.js";
import { button, chipGroup, el, sheet } from "./dom.js";
import { parseYouTube } from "../core/youtube.js";

// Settings sheet: while walking, a photo (and, in edit mode, the character);
// then the time of day and the sound. Every change is saved at once and
// applied live. The weather is always a surprise and the picture always the
// best the device can hold, so neither is here.
//
// What only whoever makes the invitation needs shows only while it can still
// be edited (full()): the island map, the Music Isle's song, and the camera's
// speed and direction. A finished invitation keeps the sheet short.

// songLink(link): an invitation link that carries this song; inviteSong():
// the song the invitation itself was given (if any).
export function createSettingsPanel(host, { settings, extras = () => [], songLink = null, inviteSong = () => "", full = () => true }) {
  const panel = sheet("settings-sheet", "Settings");
  const current = settings.get();

  // Your walk: rebuilt each time the sheet opens (only while walking).
  const walk = el("fieldset", "chip-group");
  const walkRow = el("div", "chips");
  walk.append(el("legend", "", "Your walk"), walkRow);
  function fillWalk() {
    const items = extras();
    walk.hidden = !items.length;
    walkRow.replaceChildren(...items.map(({ label, run }) => button(label, {
      className: "chip",
      onClick: () => {
        panel.close();
        run();
      },
    })));
  }

  const time = chipGroup("time", "Time of day", TIME_MODES.map((mode) => [mode, TIME_LABELS[mode]]), current.time, (value) => settings.set({ time: value }));

  const slider = (label, key, min, max, step) => {
    const wrap = el("label", "sheet-slider");
    wrap.append(el("span", "", label));
    const input = el("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings.get()[key]);
    input.addEventListener("input", () => settings.set({ [key]: Number(input.value) }));
    wrap.append(input);
    return wrap;
  };
  const toggle = (label, key) => {
    const wrap = el("label", "sheet-toggle");
    const input = el("input");
    input.type = "checkbox";
    input.checked = Boolean(settings.get()[key]);
    input.addEventListener("change", () => settings.set({ [key]: input.checked }));
    wrap.append(input, el("span", "", label));
    return wrap;
  };

  // The Music Isle's song: a YouTube link kept in this browser, and a link to
  // send so the one you invite hears it too (there is no server to keep it).
  const song = el("fieldset", "chip-group");
  song.append(el("legend", "", "Music Isle song"));
  const songRow = el("div", "song-row");
  const songInput = el("input", "song-input");
  songInput.type = "url";
  songInput.inputMode = "url";
  songInput.autocomplete = "off";
  songInput.placeholder = "YouTube link, e.g. https://youtu.be/…";
  songInput.setAttribute("aria-label", "YouTube link");
  songInput.value = current.song;
  const songStatus = el("p", "sheet-hint song-status");
  const idleStatus = () => (settings.get().song
    ? "This song will play when you visit the Music Isle ♡"
    : inviteSong() ? "The invitation’s song will play. You can enter a different one." : "The gramophone is playing its own waltz now.");
  songStatus.textContent = idleStatus();
  const saveSong = button("Save", {
    className: "sheet-small song-save",
    onClick: () => {
      const link = songInput.value.trim();
      if (!parseYouTube(link)) {
        songStatus.textContent = "This is not a YouTube link. For example: https://youtu.be/…";
        return;
      }
      settings.set({ song: link });
      songStatus.textContent = "Saved ♡ This song will play when you visit the Music Isle.";
    },
  });
  const clearSong = button("Clear", {
    className: "sheet-small",
    onClick: () => {
      songInput.value = "";
      settings.set({ song: "" });
      songStatus.textContent = inviteSong() ? "Cleared. The invitation’s song will play." : "Cleared. The gramophone will play its own waltz.";
    },
  });
  songInput.addEventListener("keydown", (event) => event.key === "Enter" && saveSong.click());
  songRow.append(songInput, saveSong, clearSong);
  song.append(songRow, songStatus);
  if (songLink) {
    const share = button("🔗 Copy a link to the invitation with this song", {
      className: "sheet-small",
      onClick: async () => {
        const chosen = settings.get().song || inviteSong();
        if (!chosen) {
          songStatus.textContent = "Save your song first.";
          return;
        }
        const link = songLink(chosen);
        try {
          await navigator.clipboard.writeText(link);
          songStatus.textContent = "Link copied ♡ Send it to the one you love — they will hear this song too.";
        } catch {
          prompt("Copy this link:", link);
        }
      },
    });
    song.append(share);
  }

  const camera = el("fieldset", "chip-group");
  const cameraLegend = el("legend", "", "Camera and sound");
  const cameraSpeed = slider("Camera speed", "sensitivity", 0.4, 2, 0.1);
  const cameraInvert = toggle("Invert up / down", "invertY");
  camera.append(cameraLegend, cameraSpeed, cameraInvert, slider("Music", "music", 0, 1, 0.05), slider("Sound effects", "effects", 0, 1, 0.05));

  const keys = el("details", "sheet-keys");
  keys.append(el("summary", "", "Controls"));
  const list = el("ul");
  keys.append(list);
  // What shows depends on whether the invitation can still be edited.
  function fit() {
    const all = full();
    song.hidden = !all;
    cameraSpeed.hidden = cameraInvert.hidden = !all;
    cameraLegend.textContent = all ? "Camera and sound" : "Sound";
    list.replaceChildren(...[
      "Move: WASD / arrow keys, joystick or a game controller",
      "Jump: Space / ⤒ — hold it and the bunny flaps its ears and glides",
      `Action: E / Enter · Sit: C${all ? " · Island map: M" : ""} · Take a photo: P`,
      "Look around: drag the screen or use the right stick",
    ].map((line) => el("li", "", line)));
  }

  // Credits for the artwork (some of it asks for attribution).
  const credits = el("a", "sheet-credits", "Credits");
  credits.href = "/credits.html";
  credits.target = "_blank";
  credits.rel = "noopener";

  panel.body.append(walk, song, time.element, camera, keys, credits);
  host.append(panel.dialog);

  settings.subscribe((next) => time.set(next.time));

  return {
    open() {
      fillWalk();
      fit();
      songInput.value = settings.get().song;
      songStatus.textContent = idleStatus();
      panel.open();
    },
    close: panel.close,
    dispose() {
      panel.dialog.remove();
    },
  };
}

import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, findTextPath, getPath, setPath } from "../src/app/content.js";
import { SCREENS, editInPlace, readWords, scaleFont } from "../src/app/edit-mode.js";
import { quadMapping } from "../src/core/homography.js";

// Just enough of an element to be edited in place: attributes, listeners and
// the words it holds (what a visitor types lands in textContent).
function fakeElement(path, { multiline = false, text = "" } = {}) {
  const listeners = {};
  const attributes = {};
  const element = {
    dataset: { edit: path, ...(multiline ? { multiline: "true" } : {}) },
    textContent: text,
    get innerText() { return this.textContent; },
    setAttribute: (name, value) => (attributes[name] = String(value)),
    removeAttribute: (name) => delete attributes[name],
    getAttribute: (name) => attributes[name] ?? null,
    addEventListener: (type, fn) => (listeners[type] ||= new Set()).add(fn),
    removeEventListener: (type, fn) => listeners[type]?.delete(fn),
    fire(type, extra = {}) {
      const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...extra };
      for (const fn of [...(listeners[type] || [])]) fn(event);
      return event;
    },
    blur() { this.fire("blur"); },
    type(words) {
      this.textContent = words;
      this.fire("input");
    },
  };
  return element;
}

describe("inline editing", () => {
  it("edits the very element where the words show, and the content follows", () => {
    const content = structuredClone(DEFAULT_CONTENT);
    const heading = fakeElement("map.heading", { text: content.map.heading });
    const changes = [];
    editInPlace(heading, { content, onInput: (path, words) => changes.push([path, words]) });
    expect(heading.getAttribute("contenteditable")).toBe("plaintext-only");
    heading.type("Where together?");
    expect(content.map.heading).toBe("Where together?");
    expect(changes).toEqual([["map.heading", "Where together?"]]);
  });

  it("ends words on one line with Enter, and keeps line breaks where they belong", () => {
    const content = structuredClone(DEFAULT_CONTENT);
    const title = fakeElement("activities.1.title");
    let done = null;
    editInPlace(title, { content, onDone: (path) => (done = path) });
    title.type("Picking\nflowers");
    expect(content.activities[1].title).toBe("Picking flowers");
    const enter = title.fire("keydown", { key: "Enter" });
    expect(enter.defaultPrevented).toBe(true);
    expect(done).toBe("activities.1.title");
    expect(title.getAttribute("contenteditable")).toBeNull();

    const letter = fakeElement("book.note", { multiline: true });
    editInPlace(letter, { content });
    letter.type("Dearest,\nwith you ♡\n");
    expect(content.book.note).toBe("Dearest,\nwith you ♡");
    expect(letter.fire("keydown", { key: "Enter" }).defaultPrevented).toBe(false);
  });

  it("stops listening once done, so later typing changes nothing", () => {
    const content = structuredClone(DEFAULT_CONTENT);
    const sign = fakeElement("question.yes");
    const stop = editInPlace(sign, { content, plaintext: false });
    expect(sign.getAttribute("contenteditable")).toBe("true");
    stop();
    sign.type("Of course");
    expect(content.question.yes).toBe(DEFAULT_CONTENT.question.yes);
  });

  it("reads typed words without stray spaces or breaks", () => {
    const nbsp = String.fromCharCode(160);
    expect(readWords({ dataset: {}, innerText: `Yes${nbsp}ok\r\n` })).toBe("Yes ok ");
    expect(readWords({ dataset: { multiline: "true" }, innerText: "A\r\nB\n\n" })).toBe("A\nB");
  });

  it("steps through every screen of the invitation", () => {
    expect(SCREENS.map((s) => s.id)).toEqual(["intro", "question", "activities", "calendar", "map", "keepsake"]);
  });
});

describe("words painted on the island", () => {
  const quad = [[120, 80], [380, 95], [370, 210], [130, 190]];

  it("lays the edit box exactly over the painted words", () => {
    const mapping = quadMapping(500, 100, quad);
    const corners = [[0, 0], [500, 0], [500, 100], [0, 100]].map(([x, y]) => mapping.apply(x, y));
    corners.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(quad[i][0], 6);
      expect(y).toBeCloseTo(quad[i][1], 6);
    });
  });

  it("gives the same mapping as a CSS matrix3d", () => {
    const mapping = quadMapping(500, 100, quad);
    const m = /matrix3d\((.*)\)/.exec(mapping.css)[1].split(",").map(Number);
    // Column-major 4x4, applied to (x, y, 0, 1).
    const apply = (x, y) => {
      const w = m[3] * x + m[7] * y + m[15];
      return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
    };
    for (const [x, y] of [[0, 0], [500, 100], [250, 50]]) {
      const [ax, ay] = apply(x, y);
      const [bx, by] = mapping.apply(x, y);
      expect(ax).toBeCloseTo(bx, 4);
      expect(ay).toBeCloseTo(by, 4);
    }
  });

  it("scales the painted font to the size it shows", () => {
    expect(scaleFont('italic 600 92px "Cormorant Garamond", serif', 0.25)).toBe('italic 600 23px "Cormorant Garamond", serif');
    expect(scaleFont("italic 500 52px Serif", 0.5)).toBe("italic 500 26px Serif");
  });
});

describe("content paths", () => {
  it("reads and writes words deep in the content, never inventing new ones", () => {
    const content = structuredClone(DEFAULT_CONTENT);
    setPath(content, "map.places.2.title", "Starry terrace");
    expect(getPath(content, "map.places.2.title")).toBe("Starry terrace");
    setPath(content, "map.places.9.title", "Missing");
    setPath(content, "calendar.day", "3");
    expect(content.map.places).toHaveLength(3);
    expect(content.calendar.day).toBe(DEFAULT_CONTENT.calendar.day);
  });

  it("finds which words a message shows, so it can be edited there", () => {
    const content = structuredClone(DEFAULT_CONTENT);
    expect(findTextPath(content, content.question.yesMessage)).toBe("question.yesMessage");
    expect(findTextPath(content, ` ${content.play.dance.start} `)).toBe("play.dance.start");
    expect(findTextPath(content, content.isles.music)).toBeNull(); // the signposts are not edited
    expect(findTextPath(content, "This message is not in the content")).toBeNull();
  });
});

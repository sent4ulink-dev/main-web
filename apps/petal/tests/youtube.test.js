import { describe, expect, it } from "vitest";
import { parseYouTube, youtubeLink } from "../src/core/youtube.js";

describe("reading a YouTube link", () => {
  it("understands every kind of link people paste", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&list=RD123&index=2",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "  dQw4w9WgXcQ  ",
    ]) expect(parseYouTube(link)?.id, link).toBe("dQw4w9WgXcQ");
  });

  it("keeps where the song should start", () => {
    expect(parseYouTube("https://youtu.be/dQw4w9WgXcQ?t=43")).toEqual({ id: "dQw4w9WgXcQ", start: 43 });
    expect(parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s").start).toBe(90);
    expect(parseYouTube("https://www.youtube.com/embed/dQw4w9WgXcQ?start=12").start).toBe(12);
  });

  it("turns away anything that is not a YouTube video", () => {
    for (const text of ["", "hello", "https://vimeo.com/123456", "https://www.youtube.com/@channel", "https://youtu.be/short", "https://evil.com/watch?v=dQw4w9WgXcQ"]) {
      expect(parseYouTube(text), text).toBeNull();
    }
  });

  it("writes a tidy link back", () => {
    expect(youtubeLink({ id: "dQw4w9WgXcQ", start: 0 })).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(youtubeLink({ id: "dQw4w9WgXcQ", start: 43 })).toBe("https://youtu.be/dQw4w9WgXcQ?t=43");
  });
});

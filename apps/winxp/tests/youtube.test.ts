import { describe, expect, it } from "vitest";
import { youtubeId } from "../shared/youtube";
import { contentSchema, freshContent } from "../shared/content";

describe("YouTube links saved with an invitation", () => {
  it("accepts normal video links and rejects arbitrary embed origins", () => {
    for (const url of [
      "https://youtu.be/dQw4w9WgXcQ?t=20",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ])
      expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    for (const url of [
      "javascript:alert(1)",
      "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
      "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
      "https://example.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/watch?v=bad",
    ]) {
      expect(youtubeId(url)).toBeNull();
      expect(
        contentSchema.safeParse({ ...freshContent(), youtubeUrl: url }).success,
      ).toBe(false);
    }
  });
  it("loads older invitations without a music link", () => {
    const old: Record<string, unknown> = { ...freshContent() };
    delete old.youtubeUrl;
    expect(contentSchema.parse(old).youtubeUrl).toBe("");
  });
});

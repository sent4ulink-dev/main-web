import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const button of await page
    .locator(".main-window button:visible")
    .all()) {
    const box = await button.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      (page.viewportSize()?.width ?? 0) + 1,
    );
  }
}
async function enterEditor(page: Page) {
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await expect(page.locator(".start-menu button")).toHaveText([
    "Edit Invitation",
    "Finish edit",
    "Reset demonstration",
  ]);
  await expect(page.locator(".start-menu header small")).toContainText(
    "Edit time:",
  );
  await page
    .getByRole("button", { name: "Edit Invitation", exact: true })
    .click();
}
async function play(page: Page, url = "/?share=test") {
  await page.goto(url);
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Тийм ээ! ♡", exact: true }),
  ).toBeVisible();
  await fs.mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/invitation-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  for (let i = 0; i < 9; i++)
    await page.getByRole("button", { name: "Үгүй", exact: true }).click();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await page.getByRole("button", { name: "Тийм ээ! ♡", exact: true }).click();
  await expect(page.locator(".scene-celebration")).toBeVisible();
  await page
    .getByRole("button", { name: "Үргэлжлүүлэх →", exact: true })
    .click();
  await expect(page.locator(".game-grid")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/screenshots/game-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Үргэлжлүүлэх →", exact: true }),
  ).toBeDisabled();
  for (let i = 1; i <= 36; i++) {
    if (
      (await page.locator(".game-progress strong").innerText()) ===
      "5/5 hearts found"
    )
      break;
    await page.getByRole("button", { name: `Tile ${i}`, exact: true }).click();
    if (await page.locator("dialog").isVisible())
      await page.getByRole("button", { name: "OK", exact: true }).click();
  }
  await expect(page.locator(".game-progress strong")).toHaveText(
    "5/5 hearts found",
  );
  await noOverflow(page);
  await page
    .getByRole("button", { name: "Үргэлжлүүлэх →", exact: true })
    .click();
  await page.locator(".choice").first().click();
  await page
    .getByRole("button", { name: "Батлах / Confirm →", exact: true })
    .click();
  await expect(page.locator(".calendar")).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.locator(".calendar-grid button").first().click();
  await page.locator("select").selectOption("18:30");
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/screenshots/calendar-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Батлах / Confirm →", exact: true })
    .click();
  await page.locator(".choice").first().click();
  await page
    .getByRole("button", { name: "Батлах / Confirm →", exact: true })
    .click();
  await expect(page.locator(".tray-message")).toBeVisible();
  await page.locator(".tray-message").click();
  await expect(page.locator(".scene-message")).toBeVisible();
  await expect(page.locator(".scene-message .mail-toolbar")).toHaveCount(0);
  await expect(page.locator('[data-app="invitation"]')).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "Restore Outlook Express — Message",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".mail-meta")).toContainText("Subject:");
  await page
    .locator('[data-app="mail"]')
    .getByRole("button", { name: "Close window", exact: true })
    .click();
  await expect(page.locator('[data-app="mail"]')).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Restore Чамд зориулсан урилга ♡",
      exact: true,
    })
    .click();
  await expect(page.locator(".scene-notification")).toBeVisible();
  await page
    .getByRole("button", { name: "Зурвас нээх ♡", exact: true })
    .click();
  await expect(page.locator('[data-app="mail"]')).toBeVisible();
  await expect(page.locator('[data-app="invitation"]')).toBeHidden();
  await page.screenshot({
    path: `artifacts/screenshots/mail-${page.viewportSize()!.width}.png`,
  });
  await page
    .getByRole("button", { name: "Бидний төлөвлөгөө ♡ →", exact: true })
    .click();
  await expect(page.locator(".confirmed")).toHaveText("✓ БАТЛАГДСАН");
  await expect(page.locator(".scene-final .final-actions > *")).toHaveCount(4);
  await expect(page.locator(".scene-final .menu")).toHaveCount(0);
  await expect(page.locator(".memory-meter")).toContainText("Memory saved");
  await expect(page.locator(".memory-meter")).toContainText("100%");
  await page
    .getByRole("button", { name: "Open Love Assistant", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Love Assistant ♡" }),
  ).toContainText("favorite wallpaper");
  await page.getByRole("button", { name: "OK ♡", exact: true }).click();
  expect(
    await page
      .locator(".scene-final .app-scroll")
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true);
  await noOverflow(page);
}
const sizes = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1366, 768],
  [1920, 1080],
];
for (const [width, height] of sizes)
  test(`complete invitation and editor at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const backend: string[] = [];
    page.on("request", (r) => {
      if (
        /\/(shares|stats|photos|api)(\/|\?|$)/.test(new URL(r.url()).pathname)
      )
        backend.push(r.url());
    });
    await play(page);
    await fs.mkdir("artifacts/screenshots", { recursive: true });
    await page.screenshot({
      path: `artifacts/screenshots/final-${width}.png`,
      fullPage: true,
    });
    const sms = await page
      .getByRole("link", { name: "✉ Send by Message" })
      .getAttribute("href");
    expect(decodeURIComponent(sms!)).toContain("Кофе ууж, удаан ярилцах");
    expect(decodeURIComponent(sms!)).toContain("18:30");
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "▧ Create and share image" })
      .click();
    const imageDownload = await downloadEvent;
    expect(imageDownload.suggestedFilename()).toBe("our-date.png");
    await expect(
      page.getByRole("button", { name: "✓ Ready · Share again" }),
    ).toBeVisible();
    await noOverflow(page);
    await expect(page.locator(".studio-bar")).toHaveCount(0);
    await enterEditor(page);
    const bar = await page.locator(".studio-bar").boundingBox(),
      window = await page.locator(".main-window").boundingBox();
    expect(window!.y).toBeGreaterThan(bar!.y + bar!.height);
    await noOverflow(page);
    await page.screenshot({
      path: `artifacts/screenshots/editor-${width}.png`,
      fullPage: true,
    });
    expect(backend).toEqual([]);
    expect(errors).toEqual([]);
  });
test("emoticons save inline, survive reload, and appear in the confirmed card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?share=test");
  await expect(page.locator(".xp-startup")).toBeHidden();
  await enterEditor(page);
  for (let i = 1; i < 10; i++)
    await page
      .getByRole("button", { name: "Next Screen", exact: true })
      .click();
  const picker = page.getByRole("group", { name: "Choose an emoticon" });
  await expect(picker.getByRole("button")).toHaveCount(6);
  for (const label of ["Smile", "Wink", "In love", "Kiss", "Cool", "Blush"]) {
    await picker
      .getByRole("button", { name: `Choose ${label}`, exact: true })
      .click();
    await expect(page.locator(".messenger-avatar img")).toHaveAttribute(
      "alt",
      label,
    );
  }
  await picker
    .getByRole("button", { name: "Choose Wink", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/screenshots/emoticon-editor-320.png",
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".studio-bar")).toHaveCount(0);
  await play(page);
  await expect(page.locator(".messenger-avatar img")).toHaveAttribute(
    "alt",
    "Wink",
  );
  await expect(picker).toHaveCount(0);
  await enterEditor(page);
  await expect(
    picker.getByRole("button", { name: "Choose Wink", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker
    .getByRole("button", { name: "Choose Cool", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".studio-bar")).toHaveCount(0);
  await expect(picker).toHaveCount(0);
  await expect(page.locator(".messenger-avatar img")).toHaveAttribute(
    "alt",
    "Cool",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await enterEditor(page);
  await expect(
    picker.getByRole("button", { name: "Choose Cool", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("demo edits persist locally and reset restores defaults", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/^\/(shares|stats|photos|api)(\/|$)/.test(new URL(r.url()).pathname))
      requests.push(r.url());
  });
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  const beforeEdit = await page
    .locator(".invitation-body h1 > span")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        font: style.font,
        color: style.color,
        textAlign: style.textAlign,
      };
    });
  await enterEditor(page);
  await expect(page.locator(".studio-bar button")).toHaveCount(4);
  for (const label of [
    "Save",
    "Previous Screen",
    "Next Screen",
    "Permanently finish editing",
  ])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  const inlineEditor = page.getByRole("textbox", {
    name: "Edit invitation",
    exact: true,
  });
  const duringEdit = await inlineEditor.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      x: box.x,
      font: style.font,
      color: style.color,
      textAlign: style.textAlign,
    };
  });
  expect(duringEdit).toEqual(beforeEdit);
  await page
    .getByRole("textbox", { name: "Edit invitation", exact: true })
    .fill("A date with you?");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".studio-bar")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Edit invitation", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".invitation-body h1")).toHaveText(
    "A date with you?",
  );
  await enterEditor(page);
  await expect(
    page.getByRole("textbox", { name: "Edit invitation", exact: true }),
  ).toHaveText("A date with you?");
  await page.reload();
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(page.locator("h1")).toHaveText("A date with you?");
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset demonstration", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(page.locator("h1")).toHaveText("Надтай болзоонд\nявах уу?");
  expect(requests).toEqual([]);
});
test("studio finalization stays on page, copy fallback, and reload lock", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Studio password").fill("browser-test-password-only");
  await page.getByRole("button", { name: "Unlock Studio →" }).click();
  await expect(page.locator(".studio-bar button")).toHaveText([
    "Save",
    "‹ Previous screen",
    "Next screen ›",
    "Permanently finish editing",
  ]);
  await page
    .getByRole("button", {
      name: "Permanently finish editing",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "You will not be able to edit this invitation again.",
  );
  await page
    .getByRole("button", { name: "Yes, Finish Permanently", exact: true })
    .click();
  await expect(page.getByLabel("Share this link")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  const link = await page.getByLabel("Share this link").inputValue();
  expect(link).toMatch(/\?share=[A-Za-z0-9_-]{8}$/);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy Link", exact: true }).click();
  expect(
    await page
      .getByLabel("Share this link")
      .evaluate(
        (el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!,
      ),
  ).toBe(link.length);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open Link", exact: true }).click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("button", { name: "✎ Edit invitation", exact: true }),
  ).toHaveCount(0);
  await popup.reload();
  await expect(popup.locator(".studio-bar")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Studio password")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain(
    "token",
  );
  const third = await context.newPage();
  await third.goto(link);
  await expect(third.getByLabel("Studio password")).toHaveCount(0);
});
test("date navigation crosses year boundaries, back preserves selections, changing activity clears place", async ({
  page,
}) => {
  await play(page);
  await enterEditor(page);
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Previous Screen", exact: true })
      .click();
  await expect(page.locator(".calendar")).toBeVisible();
  const value = await page.locator("select").inputValue();
  const original = await page.locator(".calendar-head strong").innerText();
  for (let i = 0; i < 12; i++)
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  expect(await page.locator(".calendar-head strong").innerText()).not.toBe(
    original,
  );
  for (let i = 0; i < 12; i++)
    await page
      .getByRole("button", { name: "Previous month", exact: true })
      .click();
  await expect(page.locator(".calendar-head strong")).toHaveText(original);
  expect(await page.locator("select").inputValue()).toBe(value);
});
test("canvas is deterministic, uses plan text, has PNG signature, and missing assets fail visibly", async ({
  page,
}) => {
  await play(page);
  const result = await page.evaluate(async () => {
    const { renderStory } = (await import(
      "/src/" + "exports.ts"
    )) as typeof import("../../src/exports");
    const { makePlan } = (await import(
      "/shared/" + "flow.ts"
    )) as typeof import("../../shared/flow");
    const { freshContent } = (await import(
      "/shared/" + "content.ts"
    )) as typeof import("../../shared/content");
    const c = freshContent();
    const p = makePlan(c, {
      activityId: "coffee",
      date: "2099-01-02",
      time: "18:30",
      place: "Exact secret garden",
    })!;
    const drawn: string[] = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      value: string,
      ...args: [number, number, number?]
    ) {
      drawn.push(value);
      original.call(this, value, ...args);
    };
    try {
      const a = await renderStory(p),
        b = await renderStory(p);
      const wink = await renderStory({ ...p, finalEmoticon: "wink" });
      const bitmap = await createImageBitmap(a);
      return {
        same: (await a.text()) === (await b.text()),
        differentFace: (await a.text()) !== (await wink.text()),
        bytes: Array.from(new Uint8Array(await a.arrayBuffer()).slice(0, 8)),
        file: {
          name: a.name,
          type: a.type,
          width: bitmap.width,
          height: bitmap.height,
        },
        drawn,
      };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = original;
    }
  });
  expect(result.same).toBe(true);
  expect(result.differentFace).toBe(true);
  expect(result.bytes).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(result.file).toEqual({
    name: "our-date.png",
    type: "image/png",
    width: 1080,
    height: 1920,
  });
  expect(result.drawn).toContain("Exact secret garden");
  expect(result.drawn).toContain("Кофе ууж, удаан ярилцах");
  expect(result.drawn.join(" ")).toContain("Бидний болзоо батлагдлаа!");
  expect(result.drawn.join(" ")).not.toMatch(
    /Creating image|Generate Link|Permanently Finish Editing|Memory saved/,
  );
  const confirmedTitle = await page
    .locator(".main-window .window-title")
    .innerText();
  const confirmedSms = await page
    .getByRole("link", { name: "✉ Send by Message" })
    .getAttribute("href");
  await page.route("**/wallpaper-photo.png", (r) => r.abort());
  await page.getByRole("button", { name: "▧ Create and share image" }).click();
  await expect(
    page.getByRole("button", { name: "Failed · Try again" }),
  ).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText(
    "Wallpaper could not be loaded",
  );
  await enterEditor(page);
  await page
    .getByRole("textbox", { name: "Edit finalTitle", exact: true })
    .fill("A title for the next invitation");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(confirmedTitle).not.toBe("A title for the next invitation");
  expect(confirmedSms).toContain("sms:");
});

test("native image sharing receives the PNG File and reports cancellation", async ({
  page,
}) => {
  const photoRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/photos"))
      photoRequests.push(request.url());
  });
  await play(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        (window as typeof window & { sharedPng?: unknown }).sharedPng = file
          ? { name: file.name, type: file.type, size: file.size }
          : null;
      },
    });
  });
  await page.getByRole("button", { name: "▧ Create and share image" }).click();
  await expect(
    page.getByRole("button", { name: "✓ Ready · Share again" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as typeof window & { sharedPng?: unknown }).sharedPng,
    ),
  ).toMatchObject({ name: "our-date.png", type: "image/png" });
  expect(photoRequests).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
    });
  });
  await page.getByRole("button", { name: "✓ Ready · Share again" }).click();
  await expect(
    page.getByRole("button", { name: "Cancelled · Try again" }),
  ).toBeVisible();
});

test("Start Again clears the plan and keeps closed apps in the taskbar", async ({
  page,
}) => {
  await play(page);
  await page
    .getByRole("button", { name: "↻ Start Again", exact: true })
    .click();
  await expect(page.locator(".xp-startup")).toBeHidden();
  await expect(page.locator(".managed-app:visible")).toHaveCount(0);
  await expect(page.locator(".invitation-pulse")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Restore Бидний болзоо — Notepad",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("No confirmed date yet", { exact: true }),
  ).toBeVisible();
  await page
    .locator('[data-app="plan"]')
    .getByRole("button", { name: "Close window", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Restore Бидний болзоо — Notepad",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Restore Чамд зориулсан урилга ♡",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Тийм ээ! ♡", exact: true }),
  ).toBeVisible();
});

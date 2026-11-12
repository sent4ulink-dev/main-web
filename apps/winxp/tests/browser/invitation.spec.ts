import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { freshContent } from "../../shared/content";
import { mintShare } from "./mint";
import { editorFits, field, goToStep, openStepEditor, preview, saveAndSee } from "./stepEditor";
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
  // the step editor, with the desktop running live beside it
  await expect(page.locator(".ez-live.ready")).toBeVisible({ timeout: 60000 });
}
// From the desktop to the calendar: the invitation, the No/Yes buttons, the game and an activity.
async function playToCalendar(page: Page, url = "/?share=test") {
  await page.goto(url);
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Yes! ♡", exact: true }),
  ).toBeVisible();
  await fs.mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: `artifacts/screenshots/invitation-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  for (let i = 0; i < 9; i++)
    await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await page.getByRole("button", { name: "Yes! ♡", exact: true }).click();
  await expect(page.locator(".scene-celebration")).toBeVisible();
  await page
    .getByRole("button", { name: "Continue →", exact: true })
    .click();
  await expect(page.locator(".game-grid")).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/screenshots/game-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Continue →", exact: true }),
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
    .getByRole("button", { name: "Continue →", exact: true })
    .click();
  await page.locator(".choice").first().click();
  await page
    .getByRole("button", { name: "Confirm →", exact: true })
    .click();
  await expect(page.locator(".calendar")).toBeVisible();
}
async function play(page: Page, url = "/?share=test") {
  await playToCalendar(page, url);
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.locator(".calendar-grid button").first().click();
  await page.locator("select").selectOption("18:30");
  await noOverflow(page);
  await page.screenshot({
    path: `artifacts/screenshots/calendar-${page.viewportSize()!.width}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm →", exact: true })
    .click();
  await page.locator(".choice").first().click();
  await page
    .getByRole("button", { name: "Confirm →", exact: true })
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
      name: "Restore An invitation for you ♡",
      exact: true,
    })
    .click();
  await expect(page.locator(".scene-notification")).toBeVisible();
  await page
    .getByRole("button", { name: "Open message ♡", exact: true })
    .click();
  await expect(page.locator('[data-app="mail"]')).toBeVisible();
  await expect(page.locator('[data-app="invitation"]')).toBeHidden();
  await page.screenshot({
    path: `artifacts/screenshots/mail-${page.viewportSize()!.width}.png`,
  });
  await page
    .getByRole("button", { name: "Our plan ♡ →", exact: true })
    .click();
  await expect(page.locator(".confirmed")).toHaveText("✓ CONFIRMED");
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
    expect(decodeURIComponent(sms!)).toContain("Get coffee and talk for hours");
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
    await expect(page.locator(".ez")).toHaveCount(0);
    await enterEditor(page);
    await editorFits(page);
    await expect(preview(page).locator(".scene-invitation")).toBeVisible();
    await page.screenshot({
      path: `artifacts/screenshots/editor-${width}.png`,
      fullPage: true,
    });
    expect(backend).toEqual([]);
    expect(errors).toEqual([]);
  });
test("the emoticon is chosen in the editor, survives reload, and appears in the confirmed card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?share=test");
  await expect(page.locator(".xp-startup")).toBeHidden();
  await enterEditor(page);
  await goToStep(page, 7);
  const choice = (value: string) =>
    page.locator(`.ez-scroll [data-ch][data-v="${value}"]`);
  await expect(page.locator(".ez-scroll [data-ch]")).toHaveCount(6);
  for (const [value, label] of [
    ["smile", "Smile"],
    ["wink", "Wink"],
    ["love", "In love"],
    ["kiss", "Kiss"],
    ["cool", "Cool"],
    ["blush", "Blush"],
  ]) {
    await choice(value).click();
    await expect(choice(value)).toHaveClass(/\bon\b/);
    await expect(
      preview(page).locator(".messenger-avatar img"),
    ).toHaveAttribute("alt", label);
  }
  await choice("wink").click();
  await page.screenshot({
    path: "artifacts/screenshots/emoticon-editor-320.png",
  });
  await saveAndSee(page);
  await play(page);
  await expect(page.locator(".messenger-avatar img")).toHaveAttribute(
    "alt",
    "Wink",
  );
  await enterEditor(page);
  await goToStep(page, 7);
  await expect(choice("wink")).toHaveClass(/\bon\b/);
  await choice("cool").click();
  await saveAndSee(page);
  await enterEditor(page);
  await goToStep(page, 7);
  await expect(choice("cool")).toHaveClass(/\bon\b/);
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
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await enterEditor(page);
  const question = field(page, "Question", "textarea");
  await expect(question).toHaveValue("Will you\ngo on a date with me?");
  await question.fill("A date with you?");
  // the desktop in the preview follows as it is typed
  await expect(preview(page).locator(".invitation-body h1")).toHaveText(
    "A date with you?",
  );
  await saveAndSee(page);
  await expect(page.locator(".ez")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator(".invitation-body h1")).toHaveText(
    "A date with you?",
  );
  await enterEditor(page);
  await expect(field(page, "Question", "textarea")).toHaveValue(
    "A date with you?",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator("h1")).toHaveText("A date with you?");
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset demonstration", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator("h1")).toHaveText(
    "Will you\ngo on a date with me?",
  );
  expect(requests).toEqual([]);
});
test("finalizing a real invitation locks it for good; anyone with the link can still view it", async ({
  page,
  context,
  request,
}) => {
  const id = await mintShare(request);
  const link = `/?share=${id}`;
  await page.goto(link);
  await openStepEditor(page);
  await goToStep(page, 7);
  await expect(page.locator(".ez-scroll")).toContainText(
    "You can edit this link until",
  );
  await expect(page.locator(".ez-copy input")).toHaveValue(
    new RegExp(`\\?share=${id}$`),
  );
  await page.locator('.ez-scroll [data-end="finish"]').click();
  await expect(page.locator(".ez-sheet")).toContainText(
    "it can’t be edited again",
  );
  await page.locator('.ez-sheet [data-s="no"]').click();
  await expect(page.locator(".ez-sheet")).toHaveCount(0);
  expect(
    (await (await request.get(`http://127.0.0.1:3002/shares/${id}`)).json())
      .share.finalized,
  ).toBe(false);
  await page.locator('.ez-scroll [data-end="finish"]').click();
  await Promise.all([
    page.waitForNavigation(),
    page.locator('.ez-sheet [data-s="yes"]').click(),
  ]);
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Invitation", exact: true }),
  ).toHaveCount(0);
  const third = await context.newPage();
  await third.goto(link);
  await third.getByRole("button", { name: "♥ start", exact: true }).click();
  await expect(
    third.getByRole("button", { name: "Edit Invitation", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await request.put(`http://127.0.0.1:3002/shares/${id}`, {
        data: { ...freshContent(), sender: "should not persist" },
      })
    ).status(),
  ).toBe(409);
});
test("date navigation crosses year boundaries and keeps the chosen time", async ({
  page,
}) => {
  await playToCalendar(page);
  // (the first days of this month may be past already)
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.locator(".calendar-grid button").first().click();
  await page.locator("select").selectOption("18:30");
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
  expect(result.drawn).toContain("Get coffee and talk for hours");
  expect(result.drawn.join(" ")).toContain("Our date is set!");
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
  // words changed in the editor afterwards don't change the plan already confirmed on this page
  await enterEditor(page);
  await goToStep(page, 7);
  await field(page, "Last title", "textarea").fill("A title for the next invitation");
  await expect(
    preview(page).locator(".scene-final"),
  ).toContainText("A title for the next invitation");
  await expect(page.locator(".main-window .window-title")).toHaveText(
    confirmedTitle,
  );
  expect(confirmedTitle).not.toBe("A title for the next invitation");
  expect(
    await page
      .getByRole("link", { name: "✉ Send by Message" })
      .getAttribute("href"),
  ).toBe(confirmedSms);
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
      name: "Restore Our date — Notepad",
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
      name: "Restore Our date — Notepad",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Restore An invitation for you ♡",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Yes! ♡", exact: true }),
  ).toBeVisible();
});

import { test, expect, type Page } from "@playwright/test";
import { field, goToStep, openStepEditor, preview, saveAndSee } from "./stepEditor";

const invite = "Open An invitation for you ♡";
async function fits(page: Page) {
  const bounds = await page
    .locator(".managed-app:visible")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
  const workspace = await page.locator(".desktop-workspace").boundingBox();
  for (const rect of bounds) {
    expect(rect.x).toBeGreaterThanOrEqual(-1);
    expect(rect.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(rect.y).toBeGreaterThanOrEqual(workspace!.y - 1);
    expect(rect.bottom).toBeLessThanOrEqual(
      workspace!.y + workspace!.height + 1,
    );
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const size of [
  { width: 320, height: 568 },
  { width: 1366, height: 768 },
]) {
  test(`desktop apps preserve state and fit at ${size.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/?share=test");
    await expect(page.locator(".xp-startup")).toBeHidden();
    await expect(page.locator(".managed-app:visible")).toHaveCount(0);
    await expect(page.locator(".invitation-pulse")).toBeVisible();
    await page.getByRole("button", { name: invite, exact: true }).click();
    await expect(page.locator(".managed-app:visible")).toHaveCount(0);
    await page.getByRole("button", { name: invite, exact: true }).dblclick();
    const app = page.locator('[data-app="invitation"]');
    await app.getByRole("button", { name: "No", exact: true }).click();
    const response = await app.locator(".no-response").innerText();
    await app.getByRole("button", { name: "Minimize window" }).click();
    await expect(app).toBeHidden();
    await page
      .getByRole("button", {
        name: "Restore An invitation for you ♡",
        exact: true,
      })
      .click();
    await expect(app.locator(".no-response")).toHaveText(response);
    await app.getByRole("button", { name: "Maximize window" }).click();
    await fits(page);
    await app
      .getByRole("button", { name: "Restore window", exact: true })
      .click();
    await fits(page);
    await app.getByRole("button", { name: "Close window" }).click();
    await expect(app).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: "Restore An invitation for you ♡",
        exact: true,
      }),
    ).toBeVisible();
    for (const [label, id] of [
      ["My Computer", "computer"],
      ["My Documents", "documents"],
      ["Windows Media Player", "music"],
      ["Notes — Notepad", "notes"],
    ]) {
      await page
        .getByRole("button", { name: `Open ${label}`, exact: true })
        .dblclick();
      const window = page.locator(`[data-app="${id}"]`);
      await expect(window).toBeVisible();
      await fits(page);
      await window.getByRole("button", { name: "Close window" }).click();
      await expect(
        page.getByRole("button", { name: `Restore ${label}`, exact: true }),
      ).toHaveCount(0);
    }
    await page
      .getByRole("button", {
        name: "Open Windows Media Player",
        exact: true,
      })
      .dblclick();
    await page
      .getByRole("button", { name: "Play soundtrack", exact: true })
      .click();
    await page
      .locator('[data-app="music"]')
      .getByRole("button", { name: "Minimize window" })
      .click();
    await page
      .getByRole("button", {
        name: "Restore Windows Media Player",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause soundtrack", exact: true }),
    ).toBeVisible();
    await page
      .locator('[data-app="music"]')
      .getByRole("button", { name: "Close window" })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Restore Windows Media Player",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Open Windows Media Player",
        exact: true,
      })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Play soundtrack", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/screenshots/media-player-${size.width}.png`,
    });
  });
}

test("the song and the desktop note set in the editor show in the music player and Notepad", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Isolate UI tests from third-party video availability; assert the real embed URL below.
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>YouTube test player</p>",
    }),
  );
  await page.goto("/?share=test");
  await openStepEditor(page);
  await goToStep(page, 5);
  await page.locator('.ez-scroll input[type="url"]').fill("https://youtu.be/dQw4w9WgXcQ");
  await field(page, "Song title").fill("Our test song");
  // the preview opens the music player on the desktop, with the song's title
  await expect(preview(page).locator('[data-app="music"]')).toContainText("Our test song");
  await goToStep(page, 0);
  await page.locator(".ez-scroll .ez-more summary").click();
  await field(page, "The note on the desktop", "textarea").fill(
    "Good food\nGreat conversation\nYou ♡",
  );
  await saveAndSee(page);
  await expect(page.locator(".ez")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Notes — Notepad", exact: true })
    .dblclick();
  await expect(page.locator(".notes-paper")).toHaveJSProperty(
    "innerText",
    "Good food\nGreat conversation\nYou ♡",
  );
  await expect(page.locator(".notes-paper .editable")).toHaveCount(0);
  await fits(page);
  await page
    .locator('[data-app="notes"]')
    .getByRole("button", { name: "Close window" })
    .click();
  await page
    .getByRole("button", { name: "Open Windows Media Player", exact: true })
    .dblclick();
  const music = page.locator('[data-app="music"]');
  await expect(music.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
  );
  await expect(music.locator("iframe")).toHaveAttribute(
    "referrerpolicy",
    "strict-origin-when-cross-origin",
  );
  await expect(music).toContainText("Our test song");
  await expect(page.getByLabel("YouTube song link")).toHaveCount(0);
  await fits(page);
});
test("touch double-tap opens an app while a single tap selects it", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5174/?share=test");
  await expect(page.locator(".xp-startup")).toBeHidden();
  const icon = await page
    .getByRole("button", { name: invite, exact: true })
    .boundingBox();
  await page.touchscreen.tap(icon!.x + 20, icon!.y + 20);
  await expect(page.locator(".scene-invitation")).toHaveCount(0);
  // Let the first tap selection end, then perform a genuine pair of taps.
  await page.waitForTimeout(600);
  await page.touchscreen.tap(icon!.x + 20, icon!.y + 20);
  await page.touchscreen.tap(icon!.x + 20, icon!.y + 20);
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await context.close();
});

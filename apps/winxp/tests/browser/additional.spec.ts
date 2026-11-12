import { test, expect } from "@playwright/test";
import { editorFits, goToStep, openStepEditor } from "./stepEditor";
test("expired demo edit countdown disappears and the start menu still allows editing", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await page.clock.fastForward(5 * 86400000 + 1000);
  await expect(page.locator(".ez")).toHaveCount(0);
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await expect(page.locator(".start-menu header small")).toHaveText(
    "Editing time ended",
  );
  await expect(page.locator(".start-menu button")).toHaveText([
    "Edit Invitation",
    "Finish edit",
    "Reset demonstration",
  ]);
});
test("touch editor fits and can be typed in on every step at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await openStepEditor(page);
  for (let step = 0; step < 8; step++) {
    await goToStep(page, step);
    await editorFits(page);
    const box = page
      .locator(".ez-scroll .ez-f")
      .locator("input:not([type=file]), textarea")
      .first();
    await box.click();
    await expect(page.getByRole("dialog", { name: "Edit the card" })).toBeVisible();
    const before = await box.boundingBox();
    // (to the very end of the words: in a wrapped box the End key only reaches the end of the line)
    await box.evaluate((element: HTMLInputElement | HTMLTextAreaElement) => {
      if (element.type !== "url") element.setSelectionRange(element.value.length, element.value.length);
    });
    await box.pressSequentially(" ♡");
    await expect(box).toHaveValue(/♡$/);
    const after = await box.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 0);
    expect(after!.x + after!.width).toBeLessThanOrEqual(321);
  }
});
test("backend photo endpoint accepts the actual Canvas PNG and serves the same bytes", async ({
  page,
  request,
}) => {
  await page.goto("/?share=test");
  const bytes = await page.evaluate(async () => {
    const { renderStory } = (await import(
      "/src/" + "exports.ts"
    )) as typeof import("../../src/exports");
    const { makePlan } = (await import(
      "/shared/" + "flow.ts"
    )) as typeof import("../../shared/flow");
    const { freshContent } = (await import(
      "/shared/" + "content.ts"
    )) as typeof import("../../shared/content");
    const plan = makePlan(freshContent(), {
      activityId: "coffee",
      date: "2099-04-10",
      time: "19:00",
      place: "A real place",
    })!;
    return Array.from(
      new Uint8Array(await (await renderStory(plan)).arrayBuffer()),
    );
  });
  const file = Buffer.from(bytes);
  const upload = await request.post("/photos", {
    data: file,
    headers: { "Content-Type": "image/png" },
  });
  expect(upload.status()).toBe(201);
  const result = await upload.json();
  const image = await request.get(result.path);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect(await image.body()).toEqual(file);
});

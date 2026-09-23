import { test, expect } from "@playwright/test";
test("expired edit countdown disappears and locked-out studio removes the password field", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/studio/unlock", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ status: "locked_out", retryAfterMs: 86400000 }),
    }),
  );
  await page.goto("/");
  await page.getByLabel("Studio password").fill("wrong");
  await page.getByRole("button", { name: "Unlock Studio →" }).click();
  await expect(page.getByLabel("Studio password")).toHaveCount(0);
  await expect(page.getByText(/Studio locked. Try again/)).toBeVisible();
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await page.clock.fastForward(5 * 86400000 + 1000);
  await expect(page.locator(".studio-bar")).toHaveCount(0);
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
test("touch editor remains inline and usable across all screens at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open Чамд зориулсан урилга ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Invitation", exact: true })
    .click();
  for (let scene = 1; scene < 11; scene++) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const toolbar = await page.locator(".studio-bar").boundingBox(),
      window = await page.locator(".main-window").boundingBox();
    expect(window!.y).toBeGreaterThanOrEqual(toolbar!.y + toolbar!.height);
    const field = page.locator(".main-window .editable").first();
    await field.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(field).toHaveAttribute("contenteditable", "true");
    const before = await field.boundingBox();
    await field.press("End");
    await field.pressSequentially(" ♡");
    const after = await field.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x, 0);
    if (scene < 10)
      await page
        .getByRole("button", { name: "Next Screen", exact: true })
        .click();
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

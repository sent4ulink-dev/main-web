import { test, expect } from "@playwright/test";

test("the live desktop loads its styles and local artwork without a Vite error overlay", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      failed.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?share=test");
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await expect(page.locator(".scene-invitation")).toBeVisible();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.locator(".pixel-heart")).toBeVisible();
  await page
    .getByRole("button", { name: "Open Windows Media Player", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Play soundtrack", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play soundtrack", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause soundtrack", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".player-controls")).toContainText("Playing");
  await page
    .getByRole("button", { name: "Pause soundtrack", exact: true })
    .click();
  const player = await page.locator(".player-window").boundingBox(),
    taskbar = await page.locator(".taskbar").boundingBox();
  expect(player!.y + player!.height).toBeLessThanOrEqual(taskbar!.y);
  expect(failed).toEqual([]);
});

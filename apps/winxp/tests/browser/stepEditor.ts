import { expect, type Page } from "@playwright/test";
// "Edit Invitation" opens the step-by-step editor (src/easy/): a form, one step at a time, beside the desktop itself
// running live in a frame (?embed=1). These helpers drive it the way a buyer does.

/** Opens the step editor from the start menu and waits until its live preview is running. */
export async function openStepEditor(page: Page) {
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Invitation", exact: true })
    .click();
  await expect(page.locator(".ez")).toBeVisible();
  await expect(page.locator(".ez-live.ready")).toBeVisible({ timeout: 60000 });
}
/** A box in the step on screen, by (part of) its label. */
export const field = (page: Page, label: string, kind = "input") =>
  page
    .locator(".ez-scroll .ez-f", { hasText: label })
    .first()
    .locator(kind)
    .first();
/** The step at that position (0: the invitation … 7: the last screen). */
export const goToStep = (page: Page, index: number) =>
  page.locator(`.ez-pill[data-go="${index}"]`).click();
/** The desktop as it runs in the live preview. */
export const preview = (page: Page) => page.frameLocator(".ez-live iframe");
/** "Save and see it" (on the last step; elsewhere that button is "Next"): saves, closes the editor and reloads the
 *  page with the new words. */
export async function saveAndSee(page: Page) {
  await page.locator(".ez-pill").last().click();
  await Promise.all([
    page.waitForNavigation(),
    page.locator('.ez-nav [data-nav="done"]').click(),
  ]);
}
/** The editor and its preview stay inside the screen: nothing sideways, nothing cut off. */
export async function editorFits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const width = page.viewportSize()!.width;
  for (const part of [".ez", ".ez-scroll", ".ez-live"]) {
    const box = await page.locator(part).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  }
}

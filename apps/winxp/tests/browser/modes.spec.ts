import { test, expect } from "@playwright/test";
import { mintShare } from "./mint";

test("real Save persists edits; finalization locks the invitation for good", async ({
  page,
  request,
}) => {
  const id = await mintShare(request);
  await page.goto(`/?share=${id}`);
  await page
    .getByRole("button", { name: "Open An invitation for you ♡", exact: true })
    .dblclick();
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Invitation", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Edit invitation", exact: true })
    .fill("Saved on the server");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const record = await (
    await request.get(`http://127.0.0.1:3002/shares/${id}`)
  ).json();
  expect(record.share.content.invitation).toBe("Saved on the server");
  expect(record.share.editUntil - record.share.createdAt).toBe(5 * 86400000);
  expect(record.share.finalized).toBe(false);
  await expect(page.locator(".studio-bar")).toHaveCount(0);
  await expect(page.locator(".invitation-body h1")).toHaveText(
    "Saved on the server",
  );
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page.getByRole("button", { name: "Finish edit", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "You will not be able to edit this invitation again.",
  );
  await page.getByRole("button", { name: "No, Continue Editing" }).click();
  expect(
    (await (await request.get(`http://127.0.0.1:3002/shares/${id}`)).json())
      .share.finalized,
  ).toBe(false);
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page.getByRole("button", { name: "Finish edit", exact: true }).click();
  await page.getByRole("button", { name: "Yes, Finish Permanently" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (
      await request.put(`http://127.0.0.1:3002/shares/${id}`, {
        data: record.share.content,
      })
    ).status(),
  ).toBe(409);
  await page.reload();
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Invitation", exact: true }),
  ).toHaveCount(0);
});

test("failed save keeps the editor open and shows the server's error", async ({
  page,
  request,
}) => {
  const id = await mintShare(request);
  await page.goto(`/?share=${id}`);
  await page.getByRole("button", { name: "♥ start", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Invitation", exact: true })
    .click();
  await page.route(`**/shares/${id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "error", message: "Connection failed" }),
    }),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".status-error")).toContainText(
    "Connection failed",
  );
  await expect(page.locator(".studio-bar")).toBeVisible();
});

test("URL changes isolate modes; missing and disconnected invitations stay unavailable", async ({
  page,
}) => {
  await page.goto("/?share=test");
  await page.evaluate(() => {
    history.pushState({}, "", "/?share=Unknown1");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("alert")).toContainText("link is unavailable");
  await page.route("**/shares/Offline1", (route) => route.abort());
  await page.goto("/?share=Offline1");
  await expect(page.getByRole("alert")).toContainText("Could not connect");
  await page.goto("/?share=");
  await expect(page.getByRole("alert")).toContainText("invalid");
});

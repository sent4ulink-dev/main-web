import { button, el, sheet } from "./dom.js";
import { editTimeLeft, unlockStudio } from "../app/share-client.js";

// The studio's lock (its password is checked by the server only) and the
// sheet that hands over a link to copy or open.

export function createStudioLock(host, { onUnlock }) {
  const panel = sheet("studio-lock", "Invitation studio");
  panel.dialog.querySelector(".sheet-close").remove();
  // It stays until the password is right (no Escape, no backdrop).
  panel.dialog.addEventListener("cancel", (event) => event.preventDefault());
  panel.dialog.addEventListener("close", () => {
    if (!unlocked) panel.dialog.showModal();
  });
  const form = el("form", "studio-form");
  const input = el("input", "song-input studio-password");
  input.type = "password";
  input.autocomplete = "current-password";
  input.placeholder = "Password";
  input.setAttribute("aria-label", "Studio password");
  const submit = el("button", "sheet-button primary", "Open");
  submit.type = "submit";
  const status = el("p", "sheet-hint studio-status");
  status.setAttribute("role", "status");
  form.append(input, submit);
  panel.body.append(el("p", "", "Enter your password to generate a new invitation link."), form, status);
  host.append(panel.dialog);

  let unlocked = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = input.value;
    if (!password) return;
    submit.disabled = true;
    status.textContent = "Checking…";
    const result = await unlockStudio(password);
    submit.disabled = false;
    if (result.ok) {
      unlocked = true;
      panel.close();
      onUnlock(password);
      return;
    }
    input.select();
    status.textContent = result.error === "wrong_password"
      ? `Wrong password. ${result.attemptsRemaining} tries left.`
      : result.error === "locked_out"
        ? `Too many wrong attempts. You can try again in: ${editTimeLeft(result.retryAfterMs)}.`
        : serverTrouble(result);
  });
  return {
    open() {
      panel.open();
      input.focus();
    },
  };
}

// What to say when the server can't help.
export function serverTrouble(result) {
  return result.error === "not_configured"
    ? "The link storage (R2) is not set up. Set it up as described in the README."
    : "Could not reach the server. Please try again.";
}

// A link to copy or open: after making one, and once an invitation is done.
export function showLinkSheet(host, { url, title, text }) {
  const panel = sheet("link-sheet", title);
  const field = el("input", "song-input link-field");
  field.type = "text";
  field.readOnly = true;
  field.value = url;
  field.setAttribute("aria-label", "Link");
  field.addEventListener("focus", () => field.select());
  const status = el("p", "sheet-hint link-status");
  status.setAttribute("role", "status");
  const copy = button("📋 Copy", {
    className: "sheet-button primary",
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = "Copied ♡";
      } catch {
        field.focus();
        status.textContent = "Select the link and copy it yourself.";
      }
    },
  });
  const open = el("a", "sheet-button", "↗ Open");
  open.href = url;
  const actions = el("div", "sheet-actions");
  actions.append(copy, open);
  panel.body.append(el("p", "", text), field, actions, status);
  host.append(panel.dialog);
  panel.dialog.addEventListener("close", () => panel.dialog.remove());
  panel.open();
  return panel;
}

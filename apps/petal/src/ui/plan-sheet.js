import { button, el, sheet } from "./dom.js";
import {
  CALENDAR_NAME, calendarBlob, canSaveToCalendar, createImageShare, createPlanImage, planText, saveFile, smsLink,
} from "../app/plan.js";

// The finished plan to take along: a picture for the phone's share sheet, a
// text message and a calendar file. It opens after the dance at the keepsake
// book (and from ⚙ while walking); getPlan() is the plan the book shows.

const IMAGE_STATES = {
  creating: "Preparing the picture…",
  ready: "Picture ready ♡",
  shared: "Shared ♡",
  saved: "Picture saved to your device ♡",
  cancelled: "Sharing cancelled. Tap again whenever you like.",
  failed: "Could not make the picture. Please try again.",
};

export function createPlanSheet(host, { getPlan }) {
  const panel = sheet("plan-sheet", "Share your date");
  const summary = el("dl", "plan-summary");
  const imageButton = button("🖼️ Share the picture", { className: "sheet-button primary" });
  const imageStatus = el("p", "sheet-hint plan-status");
  imageStatus.setAttribute("role", "status");
  const smsButton = button("💬 Send as a message", { className: "sheet-button" });
  const calendarButton = button("📅 Save to calendar", { className: "sheet-button" });
  const calendarStatus = el("p", "sheet-hint plan-status");
  calendarStatus.setAttribute("role", "status");
  const actions = el("div", "plan-actions");
  actions.append(imageButton, smsButton, calendarButton);
  panel.body.append(summary, actions, imageStatus, calendarStatus);
  host.append(panel.dialog);

  let plan = null;
  let image = null;
  function showImageState(state, detail) {
    const key = state === "ready" && (detail === "shared" || detail === "saved") ? detail : state;
    imageStatus.textContent = IMAGE_STATES[key] || "";
    imageStatus.dataset.state = state;
    imageButton.disabled = state === "creating";
  }

  imageButton.addEventListener("click", () => image?.share());
  // The composer opens with the whole plan in it; nothing is sent.
  smsButton.addEventListener("click", () => {
    location.href = smsLink(planText(plan));
  });
  calendarButton.addEventListener("click", () => {
    if (!canSaveToCalendar(plan)) return;
    saveFile(new File([calendarBlob(plan)], CALENDAR_NAME, { type: "text/calendar" }));
    calendarStatus.textContent = "Calendar file downloaded ♡ Open it to add it to your calendar.";
  });

  return {
    open() {
      plan = getPlan();
      summary.replaceChildren(...[["Adventure", plan.activity], ["Date", plan.dateText], ["Place", plan.place]]
        .flatMap(([label, value]) => [el("dt", "", label), el("dd", "", value || "—")]));
      const canSave = canSaveToCalendar(plan);
      calendarButton.disabled = !canSave;
      calendarStatus.textContent = canSave ? "" : "You can save to your calendar once you pick a day from today onwards.";
      // The picture is made as the sheet opens, so the share sheet can open
      // right from the tap (phones only allow it straight after one).
      image = createImageShare({ makeFile: () => createPlanImage(plan), onState: showImageState });
      image.prepare();
      panel.open();
    },
    close: panel.close,
    dispose() {
      panel.dialog.remove();
    },
  };
}

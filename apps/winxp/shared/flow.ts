import type { Content } from "./content.js";
import type { EmoticonId } from "./emoticons.js";
export type Scene =
  | "boot"
  | "invitation"
  | "connecting"
  | "celebration"
  | "game"
  | "activity"
  | "date"
  | "place"
  | "notification"
  | "message"
  | "final";
export const scenes: Scene[] = [
  "boot",
  "invitation",
  "connecting",
  "celebration",
  "game",
  "activity",
  "date",
  "place",
  "notification",
  "message",
  "final",
];
export type Selection = {
  activityId: string;
  date: string;
  time: string;
  place: string;
};
export type Plan = Selection & {
  activity: string;
  sender: string;
  greeting: string;
  message: string;
  closing: string;
  finalClosing: string;
  heading: string;
  title: string;
  eventTitle: string;
  finalEmoticon: EmoticonId;
};
export type Flow = {
  scene: Scene;
  noCount: number;
  hearts: number;
  selection: Selection;
  plan: Plan | null;
};
export const initialFlow = (): Flow => ({
  scene: "boot",
  noCount: 0,
  hearts: 0,
  selection: { activityId: "", date: "", time: "", place: "" },
  plan: null,
});
export type Action =
  | { type: "next"; from: Scene; content: Content; now?: Date }
  | { type: "refresh"; content: Content }
  | { type: "no" }
  | { type: "hearts"; count: number }
  | { type: "select"; patch: Partial<Selection> }
  | { type: "back" }
  | { type: "restart" };
export function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDateTime(date: string, time: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return false;
  const d = new Date(`${date}T${time}:00`);
  return (
    Number.isFinite(+d) &&
    localDate(d) === date &&
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` ===
      time &&
    +d > +now
  );
}
export function displayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year} оны ${month} сарын ${day}`;
}
export function makePlan(
  c: Content,
  s: Selection,
  now = new Date(),
): Plan | null {
  const activity = c.activities.find((a) => a.id === s.activityId);
  if (
    !activity ||
    !s.place.trim() ||
    s.place.length > 160 ||
    !validDateTime(s.date, s.time, now)
  )
    return null;
  const vars: Record<string, string> = {
    activity: activity.name,
    date: displayDate(s.date),
    time: s.time,
    place: s.place,
    customClosing: c.customClosing,
    sender: c.sender,
  };
  return {
    ...s,
    activity: activity.name,
    sender: c.sender,
    greeting: c.greeting,
    message: c.messageTemplate.replace(
      /\{(activity|date|time|place|customClosing|sender)\}/g,
      (_, key: string) => vars[key],
    ),
    closing: c.customClosing,
    finalClosing: c.finalClosing,
    heading: c.finalHeading,
    title: c.finalTitle,
    eventTitle: c.eventTitle,
    finalEmoticon: c.finalEmoticon,
  };
}
export function transition(state: Flow, action: Action): Flow {
  if (action.type === "restart") return initialFlow();
  if (action.type === "refresh") {
    if (!state.plan) return state;
    // Refresh saved copy without changing the already confirmed date or time.
    const plan = makePlan(action.content, state.plan, new Date(0));
    return { ...state, plan, scene: plan ? state.scene : "activity" };
  }
  if (action.type === "no")
    return state.scene === "invitation"
      ? { ...state, noCount: state.noCount + 1 }
      : state;
  if (action.type === "hearts")
    return state.scene === "game"
      ? { ...state, hearts: Math.min(5, Math.max(0, action.count)) }
      : state;
  if (action.type === "select") {
    const s = { ...state.selection, ...action.patch };
    if (
      action.patch.activityId &&
      action.patch.activityId !== state.selection.activityId
    )
      s.place = "";
    return { ...state, selection: s, plan: null };
  }
  if (action.type === "back") {
    const back: Partial<Record<Scene, Scene>> = {
      date: "activity",
      place: "date",
      notification: "place",
      message: "place",
      final: "place",
    };
    return back[state.scene]
      ? { ...state, scene: back[state.scene]!, plan: null }
      : state;
  }
  if (state.scene !== action.from) return state;
  if (state.scene === "game" && state.hearts !== 5) return state;
  if (
    state.scene === "activity" &&
    !action.content.activities.some((a) => a.id === state.selection.activityId)
  )
    return state;
  if (
    state.scene === "date" &&
    !validDateTime(state.selection.date, state.selection.time, action.now)
  )
    return state;
  const plan =
    state.scene === "place"
      ? makePlan(action.content, state.selection, action.now)
      : state.plan;
  if (state.scene === "place" && !plan) return state;
  return {
    ...state,
    plan,
    scene: scenes[Math.min(scenes.indexOf(state.scene) + 1, scenes.length - 1)],
  };
}
export type Mode = "studio" | "demo" | "real";
export function resolveMode(search: string): { mode: Mode; id: string | null } {
  const id = new URLSearchParams(search).get("share");
  return id === null
    ? { mode: "studio", id: null }
    : id === "test"
      ? { mode: "demo", id }
      : { mode: "real", id };
}
export function canEdit(
  mode: Mode,
  finalized: boolean,
  editUntil: number,
  now = Date.now(),
) {
  return (
    mode === "studio" || mode === "demo" || (!finalized && editUntil > now)
  );
}
export function buildShareUrl(origin: string, id: string) {
  const url = new URL(origin);
  url.searchParams.set("share", id);
  return url.toString();
}

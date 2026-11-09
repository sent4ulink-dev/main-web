// The step editor's live preview (?embed=1): which screen the desktop shows, set straight from the step being edited
// (easy/easy-steps.js) instead of reached by playing through the invitation.
import { localDate, makePlan, type Flow, type Scene } from "../../shared/flow";
import type { Content } from "../../shared/content";

export type PreviewScene = { scene: string; sub: number | null };

const SCENE_OF: Record<string, Scene> = { plea: "invitation", music: "invitation", gamedone: "game" };

/** The flow as it would be on that screen: the No taps so far, the hearts found, the choices, and a plan made from
 *  the first activity and place (a week from today, 19:00) for the notification, the mail and the last screen. */
export function previewFlow(p: PreviewScene, content: Content, base: Flow): Flow {
  const scene = SCENE_OF[p.scene] ?? (p.scene as Scene);
  const activity = content.activities[p.sub ?? 0] ?? content.activities[0];
  const selection = {
    activityId: activity?.id ?? "",
    date: localDate(new Date(Date.now() + 7 * 86400000)),
    time: "19:00",
    place: activity?.places?.find((place) => place.trim()) ?? activity?.name ?? "",
  };
  const planned = ["notification", "message", "final"].includes(scene);
  return {
    ...base,
    scene,
    noCount: p.scene === "plea" ? (p.sub ?? 0) + 1 : 0,
    hearts: p.scene === "gamedone" ? 5 : 0,
    selection: scene === "activity" ? { ...selection, activityId: "", place: "" } : selection,
    plan: planned ? makePlan(content, selection, new Date(0)) : null,
  };
}

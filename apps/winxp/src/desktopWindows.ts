import { useCallback, useState } from "react";
import { sound } from "./sound";
export type AppId =
  "invitation" | "music" | "notes" | "computer" | "documents" | "mail" | "plan";
export const apps: Record<AppId, { title: string; icon: string }> = {
  invitation: { title: "Чамд зориулсан урилга ♡", icon: "mail" },
  music: { title: "Windows Media Player", icon: "music" },
  notes: { title: "Notes — Notepad", icon: "notes" },
  computer: { title: "My Computer", icon: "computer" },
  documents: { title: "My Documents", icon: "folder" },
  mail: { title: "Outlook Express — Message", icon: "mail" },
  plan: { title: "Бидний болзоо — Notepad", icon: "notes" },
};
export type WindowState = {
  visible: boolean;
  closed: boolean;
  maximized: boolean;
  order: number;
};
export function useDesktopWindows(muted: boolean) {
  const [windows, setWindows] = useState<Partial<Record<AppId, WindowState>>>(
    {},
  );
  const open = useCallback(
    (id: AppId) =>
      setWindows((all) => ({
        ...all,
        [id]: {
          maximized: all[id]?.maximized ?? false,
          visible: true,
          closed: false,
          order: Math.max(0, ...Object.values(all).map((w) => w.order)) + 1,
        },
      })),
    [],
  );
  const focus = (id: AppId) =>
    setWindows((all) => {
      const top = Math.max(0, ...Object.values(all).map((w) => w.order));
      if (!all[id] || all[id].order === top) return all;
      return { ...all, [id]: { ...all[id], order: top + 1 } };
    });
  const hide = useCallback(
    (id: AppId, closed = false) =>
      setWindows((all) => {
        if (!all[id]) return all;
        if (closed && id !== "invitation") {
          const next = { ...all };
          delete next[id];
          return next;
        }
        return { ...all, [id]: { ...all[id], visible: false, closed } };
      }),
    [],
  );
  const controls = (id: AppId) => ({
    maximized: windows[id]?.maximized ?? false,
    onMinimize: () => {
      sound("minimize", muted);
      hide(id);
    },
    onClose: () => hide(id, true),
    onRestore: () => {
      sound("restore", muted);
      setWindows((all) =>
        all[id]
          ? {
              ...all,
              [id]: {
                ...all[id],
                maximized: !all[id].maximized,
              },
            }
          : all,
      );
    },
  });
  return { windows, open, hide, focus, controls };
}

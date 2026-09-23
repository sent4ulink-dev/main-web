import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  contentSchema,
  freshContent,
  type Content,
  type Share,
} from "../shared/content";
import {
  buildShareUrl,
  canEdit,
  displayDate,
  initialFlow,
  resolveMode,
  scenes,
  transition,
  validDateTime,
  type Scene,
} from "../shared/flow";
import { api, ApiError, copyLink } from "./api";
import { Calendar, Dialog, Editable, Game, Icon, Window } from "./components";
import { calendar, download, renderStory, smsUrl } from "./exports";
import { sound, stopSounds } from "./sound";
import { usePlanTools } from "./webmcp";
import { MusicPlayer, PixelHeart } from "./RetroDesktop";
import { apps, useDesktopWindows, type AppId } from "./desktopWindows";
import { emoticonIds, emoticons, emoticonUrl } from "../shared/emoticons";
const demoKey = "heart-desktop-demo-v1";
const loveAssistantMessages = [
  "Your smile has been set as my favorite wallpaper. ♡",
  "No errors found — just butterflies.",
  "New memory saved successfully!",
  "You make every day a little brighter. ♡",
];
type TextKey = {
  [K in keyof Content]: Content[K] extends string | string[] ? K : never;
}[keyof Content];
function loadDraft(context: ReturnType<typeof resolveMode>) {
  if (context.mode === "demo") {
    try {
      const parsed = contentSchema.safeParse(
        JSON.parse(localStorage.getItem(demoKey) ?? "null"),
      );
      if (parsed.success) return parsed.data;
    } catch {
      /* Restore defaults if browser storage is unavailable. */
    }
  }
  return freshContent();
}
export default function App({
  search = window.location.search,
}: {
  search?: string;
}) {
  const context = resolveMode(search);
  const [content, setContent] = useState<Content>(() => loadDraft(context)),
    [flow, dispatch] = useReducer(transition, undefined, initialFlow),
    [token, setToken] = useState(""),
    [password, setPassword] = useState(""),
    [lockedUntil, setLockedUntil] = useState(0),
    [share, setShare] = useState<Share | null>(null),
    [loading, setLoading] = useState(context.mode === "real"),
    [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false),
    [editScene, setEditScene] = useState(1),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false),
    [finish, setFinish] = useState(false),
    [now, setNow] = useState(Date.now()),
    [muted, setMuted] = useState(
      () => localStorage.getItem("heart-muted") === "true",
    ),
    [imageBusy, setImageBusy] = useState(false),
    [imageStatus, setImageStatus] = useState<
      "idle" | "creating" | "ready" | "cancelled" | "failed"
    >("idle"),
    [startMenu, setStartMenu] = useState(false),
    [readLength, setReadLength] = useState(0),
    [loveAssistant, setLoveAssistant] = useState(false),
    [loveMessage, setLoveMessage] = useState(0);
  const linkInput = useRef<HTMLInputElement>(null),
    operation = useRef(false),
    imageOperation = useRef(false),
    demoUntil = useRef(Date.now() + 5 * 86400000),
    headingRef = useRef<HTMLDivElement>(null);
  const allowed = canEdit(
    context.mode,
    share?.finalized ?? false,
    share?.editUntil ?? 0,
    now,
  );
  const unlocked = context.mode !== "studio" || !!token;
  const scene: Scene = editing ? scenes[editScene] : flow.scene;
  const wm = useDesktopWindows(muted);
  const startupPlayed = useRef(false);
  const { open: openWindow, hide: hideWindow } = wm;
  const [playRequest, setPlayRequest] = useState(0);
  const storyApp: AppId =
    scene === "message" ? "mail" : scene === "final" ? "plan" : "invitation";
  const previousScene = useRef<Scene>("boot");
  const returnToApp = useRef<AppId | null>(null);
  const lastTouch = useRef<Partial<Record<AppId, number>>>({});
  useEffect(() => {
    if (scene === "boot" && !editing) {
      for (const id of ["invitation", "mail", "plan"] as AppId[])
        hideWindow(id);
    }
    if (
      editing ||
      (scene !== "boot" &&
        !(scene === "invitation" && previousScene.current === "boot"))
    ) {
      openWindow(storyApp);
      for (const id of ["invitation", "mail", "plan"] as AppId[])
        if (id !== storyApp) hideWindow(id);
    }
    if (returnToApp.current) {
      openWindow(returnToApp.current);
      returnToApp.current = null;
    }
    previousScene.current = scene;
  }, [scene, editing, storyApp, openWindow, hideWindow]);
  const launch = (id: AppId) => {
    sound("open", muted);
    openWindow(id);
  };
  const touchOpen = (id: AppId, event: ReactPointerEvent) => {
    if (event.pointerType !== "touch") return;
    const at = performance.now();
    if (at - (lastTouch.current[id] ?? 0) <= 550) {
      lastTouch.current[id] = 0;
      launch(id);
    } else {
      lastTouch.current[id] = at;
    }
  };
  const saveAndPlay = () =>
    void run(async () => {
      await save();
      returnToApp.current = "music";
      setEditing(false);
      setPlayRequest((v) => v + 1);
    });
  usePlanTools(unlocked && !editing ? flow.plan : null);
  const update = useCallback(
    (key: TextKey, value: string | string[]) =>
      setContent((c) => ({ ...c, [key]: value })),
    [],
  );
  const E = (key: TextKey, label: string = key) => (
    <Editable
      value={content[key]}
      onChange={(v) => update(key, v)}
      enabled={editing}
      label={label}
    />
  );
  const next = (from = flow.scene) => {
    if (
      (from === "date" || from === "place") &&
      !validDateTime(flow.selection.date, flow.selection.time)
    ) {
      setError("Choose a future date and time before confirming.");
      return;
    }
    sound("open", muted);
    dispatch({ type: "next", from, content });
  };
  useEffect(() => {
    if (context.mode !== "real") return;
    let alive = true;
    if (!/^[A-Za-z0-9_-]{8}$/.test(context.id ?? "")) {
      setLoadError("This invitation link is invalid.");
      setLoading(false);
      return;
    }
    api<{ share: Share }>(`/shares/${context.id}`)
      .then(({ share: s }) => {
        if (alive) {
          setShare(s);
          setContent(contentSchema.parse(s.content));
        }
      })
      .catch((e) => {
        if (alive)
          setLoadError(
            e instanceof ApiError &&
              (e.status === "missing" || e.status === "invalid")
              ? "This invitation link is unavailable. Check that you copied the complete URL."
              : "Could not connect to the invitation server. Please try again.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const until =
      context.mode === "demo" ? demoUntil.current : (share?.editUntil ?? 0);
    const timer = setTimeout(
      () => setNow(Date.now()),
      until - now < 3600000 || lockedUntil > now ? 1000 : 60000,
    );
    return () => clearTimeout(timer);
  }, [now, share, lockedUntil]);
  useEffect(() => {
    if (!allowed) setEditing(false);
  }, [allowed]);
  useEffect(() => {
    if (!unlocked || loading || editing || loadError) return;
    if (flow.scene === "boot" || flow.scene === "connecting") {
      const from = flow.scene;
      const timer = setTimeout(
        () => dispatch({ type: "next", from, content }),
        from === "boot" ? 1300 : 1700,
      );
      return () => clearTimeout(timer);
    }
  }, [flow.scene, unlocked, loading, editing, loadError, content]);
  useEffect(() => {
    if (flow.scene === "notification" && !editing) sound("notification", muted);
    if (flow.scene === "final" && !editing) sound("confirm", muted);
  }, [flow.scene, editing, muted]);
  const message = flow.plan
    ? `${flow.plan.greeting}\n\n${flow.plan.message}`
    : "";
  useEffect(() => {
    setReadLength(0);
    if (scene !== "message") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReadLength(message.length);
      return;
    }
    const timer = setInterval(
      () =>
        setReadLength((v) => {
          if (v >= message.length) clearInterval(timer);
          return v + 4;
        }),
      16,
    );
    return () => clearInterval(timer);
  }, [scene, message]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [scene]);
  async function run(fn: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      if (
        e instanceof ApiError &&
        e.status === "unauthorized" &&
        context.mode === "studio"
      ) {
        setToken("");
        setEditing(false);
        setLink("");
      }
      if (
        e instanceof ApiError &&
        (e.status === "expired" || e.status === "finalized")
      ) {
        setEditing(false);
        setShare((s) =>
          s
            ? {
                ...s,
                finalized: e.status === "finalized",
                editUntil: Math.min(s.editUntil, Date.now()),
              }
            : s,
        );
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function validated() {
    return contentSchema.parse(content);
  }
  async function save() {
    const c = validated();
    let savedShare: Share | null = null;
    if (context.mode === "demo")
      localStorage.setItem(demoKey, JSON.stringify(c));
    else if (context.mode === "real") {
      const result = await api<{ share: Share }>(
        `/shares/${context.id}`,
        "PUT",
        c,
      );
      setShare(result.share);
      savedShare = result.share;
    } else if (context.mode === "studio") {
      const result =
        share && !share.finalized && share.editUntil > Date.now()
          ? await api<{ share: Share }>(`/shares/${share.id}`, "PUT", c)
          : await api<{ share: Share }>("/shares", "POST", c, token);
      savedShare = result.share;
      setShare(savedShare);
      setLink(buildShareUrl(location.origin, savedShare.id));
    }
    setContent(c);
    setNotice("Saved! ♡");
    return savedShare;
  }
  async function unlock() {
    try {
      const result = await api<{ status: "ok"; token: string }>(
        "/api/studio/unlock",
        "POST",
        { password },
      );
      setToken(result.token);
      setEditing(true);
      setPassword("");
    } catch (e) {
      setPassword("");
      if (e instanceof ApiError) {
        if (e.status === "locked_out") {
          setLockedUntil(Date.now() + Number(e.data.retryAfterMs));
          setError(
            "Studio is locked for this IP. Please try again after the lockout.",
          );
          return;
        }
        if (e.status === "wrong") {
          setError(
            `Incorrect password. ${e.data.attemptsRemaining} attempt remaining.`,
          );
          return;
        }
      }
      throw e;
    }
  }
  function toggleSound() {
    if (!muted) stopSounds();
    setMuted((m) => {
      localStorage.setItem("heart-muted", String(!m));
      if (m) sound("click", false);
      return !m;
    });
  }
  function changeActivity(
    id: string,
    patch: Partial<Content["activities"][number]>,
  ) {
    setContent((c) => ({
      ...c,
      activities: c.activities.map((a) =>
        a.id === id ? { ...a, ...patch } : a,
      ),
    }));
  }
  const currentActivity = content.activities.find(
    (a) => a.id === flow.selection.activityId,
  );
  const selection = (
    patch: Parameters<typeof dispatch>[0] & { type: "select" },
  ) => dispatch(patch);
  async function createImage() {
    if (!flow.plan || imageOperation.current) return;
    imageOperation.current = true;
    setImageBusy(true);
    setImageStatus("creating");
    setError("");
    try {
      const file = await renderStory(flow.plan);
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: flow.plan.eventTitle });
          setImageStatus("ready");
          setNotice("Ready — image shared. ♡");
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            setImageStatus("cancelled");
            setNotice("Cancelled — the image was not shared.");
          } else {
            throw e;
          }
        }
      } else {
        download(file, "our-date.png");
        setImageStatus("ready");
        setNotice("Ready — PNG downloaded. ♡");
      }
    } catch (e) {
      setImageStatus("failed");
      setError(
        e instanceof Error
          ? e.message
          : "Image creation failed. Please try again.",
      );
    } finally {
      imageOperation.current = false;
      setImageBusy(false);
    }
  }
  const editWindowLabel = (() => {
    if (context.mode === "studio")
      return "Shared links can be edited for 5 days";
    const until =
      context.mode === "demo" ? demoUntil.current : (share?.editUntil ?? 0);
    const remaining = Math.max(0, until - now);
    if (!remaining) return "Editing time ended";
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `Edit time: ${days}d ${hours}h ${minutes}m left`;
  })();
  const toolbar = unlocked && !loadError && !loading && allowed && editing && (
    <div className="studio-bar active">
      <div className="editor-row">
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await save();
              dispatch({ type: "refresh", content: validated() });
              setEditing(false);
            })
          }
        >
          Save
        </button>
        <button
          disabled={editScene === 0}
          onClick={() => setEditScene((i) => i - 1)}
          aria-label="Previous Screen"
        >
          ‹ Previous screen
        </button>
        <button
          disabled={editScene === scenes.length - 1}
          onClick={() => setEditScene((i) => i + 1)}
          aria-label="Next Screen"
        >
          Next screen ›
        </button>
        <button disabled={busy} onClick={() => setFinish(true)}>
          Permanently finish editing
        </button>
      </div>
    </div>
  );
  const finalActions = scene === "final" && !editing && flow.plan && (
    <div className="final-actions">
      <button
        disabled={!validDateTime(flow.plan.date, flow.plan.time, new Date(now))}
        onClick={() => {
          try {
            download(
              new Blob([calendar(flow.plan!)], {
                type: "text/calendar;charset=utf-8",
              }),
              "our-date.ics",
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        ▦ Save to Calendar
      </button>
      <button
        disabled={imageBusy}
        onClick={() => void createImage()}
        aria-live="polite"
      >
        {imageStatus === "creating"
          ? "Creating…"
          : imageStatus === "ready"
            ? "✓ Ready · Share again"
            : imageStatus === "cancelled"
              ? "Cancelled · Try again"
              : imageStatus === "failed"
                ? "Failed · Try again"
                : "▧ Create and share image"}
      </button>
      <a className="button" href={smsUrl(flow.plan)}>
        ✉ Send by Message
      </a>
      <button
        onClick={() => {
          setImageStatus("idle");
          dispatch({ type: "restart" });
        }}
      >
        ↻ Start Again
      </button>
    </div>
  );
  function sceneContent(
    scene: Scene = editing ? scenes[editScene] : flow.scene,
  ) {
    if (scene === "boot" || scene === "connecting")
      return (
        <div className="center boot-content">
          <Icon />
          <h2>{E(scene === "boot" ? "bootTitle" : "connecting")}</h2>
          <div className="loading-track">
            <i />
          </div>
          <p className="subtle">heart.exe</p>
        </div>
      );
    if (scene === "invitation")
      return (
        <>
          <div className="menu">
            File <span>Edit</span>
            <span>View</span>
            <span>Favorites ♡</span>
          </div>
          <div className="invitation-body">
            <PixelHeart />
            <h1>{E("invitation")}</h1>
            <div className="invitation-actions">
              <button
                className="yes-button"
                onClick={() => {
                  if (!editing) next("invitation");
                }}
              >
                {editing ? E("yesLabel") : content.yesLabel}
              </button>
              <button
                onClick={() => {
                  if (!editing) {
                    dispatch({ type: "no" });
                    sound("error", muted);
                  }
                }}
              >
                {editing ? E("noLabel") : content.noLabel}
              </button>
            </div>
            <div className="no-response" aria-live="polite">
              {flow.noCount > 0 && !editing
                ? content.noResponses[
                    (flow.noCount - 1) % content.noResponses.length
                  ]
                : " "}
            </div>
          </div>
          <footer className="window-status">
            <span>
              <span className="green-dot" />{" "}
              {editing ? "Editing invitation" : "Waiting for a little yes…"}
            </span>
            <span>♡</span>
          </footer>
        </>
      );
    if (scene === "celebration")
      return (
        <div className="scene-body center">
          <div className="big-heart celebrate">♡</div>
          <h1>{E("celebrationTitle")}</h1>
          <p>{E("celebration")}</p>
          <button
            className="primary"
            onClick={() => {
              if (!editing) next("celebration");
            }}
          >
            Үргэлжлүүлэх →
          </button>
        </div>
      );
    if (scene === "game")
      return (
        <div className="scene-body game-body">
          <p>{E("gameInstructions")}</p>
          <Game
            content={content}
            muted={muted}
            onCount={(count) => dispatch({ type: "hearts", count })}
            editExtras={null}
          />
          <div className="actions">
            <button
              className="primary"
              disabled={flow.hearts !== 5 || editing}
              onClick={() => next("game")}
            >
              Үргэлжлүүлэх →
            </button>
          </div>
        </div>
      );
    if (scene === "activity")
      return (
        <div className="scene-body">
          <p className="section-prompt">{E("activityPrompt")}</p>
          <div className="choices">
            {content.activities.map((a, index) => (
              <div className="activity-row" key={a.id}>
                <button
                  className={`choice ${flow.selection.activityId === a.id ? "chosen" : ""}`}
                  aria-pressed={flow.selection.activityId === a.id}
                  onClick={() => {
                    if (editing) return;
                    if (flow.selection.activityId === a.id) next("activity");
                    else
                      selection({
                        type: "select",
                        patch: { activityId: a.id },
                      });
                  }}
                >
                  <span className="choice-symbol">
                    {["☕", "♨", "▣", "☀", "♧"][index % 5]}
                  </span>
                  {editing ? (
                    <Editable
                      value={a.name}
                      enabled
                      label="Activity name"
                      onChange={(v) =>
                        changeActivity(a.id, { name: String(v) })
                      }
                    />
                  ) : (
                    <span>{a.name}</span>
                  )}
                  <span>{flow.selection.activityId === a.id ? "●" : "○"}</span>
                </button>
              </div>
            ))}
          </div>
          {!editing && (
            <div className="actions">
              <button
                className="primary"
                disabled={!currentActivity}
                onClick={() => next("activity")}
              >
                Батлах / Confirm →
              </button>
            </div>
          )}
        </div>
      );
    if (scene === "date")
      return (
        <div className="scene-body">
          <p className="section-prompt">{E("datePrompt")}</p>
          <Calendar
            date={flow.selection.date}
            time={flow.selection.time}
            onChange={(patch) => selection({ type: "select", patch })}
            onConfirm={() => {
              if (!editing) next("date");
            }}
          />
          <div className="actions spread">
            <button onClick={() => dispatch({ type: "back" })}>← Буцах</button>
            <button
              className="primary"
              disabled={
                editing ||
                !validDateTime(flow.selection.date, flow.selection.time)
              }
              onClick={() => next("date")}
            >
              Батлах / Confirm →
            </button>
          </div>
        </div>
      );
    if (scene === "place")
      return (
        <div className="scene-body">
          <p className="section-prompt">{E("placePrompt")}</p>
          <p className="subtle">{currentActivity?.name}</p>
          <div className="choices">
            {(
              currentActivity ?? (editing ? content.activities[0] : undefined)
            )?.places.map((p, i) => (
              <button
                key={i}
                className={`choice ${flow.selection.place === p ? "chosen" : ""}`}
                aria-pressed={flow.selection.place === p}
                onClick={() => {
                  if (flow.selection.place === p && !editing) next("place");
                  else selection({ type: "select", patch: { place: p } });
                }}
              >
                <span>⌖</span>
                {editing ? (
                  <Editable
                    value={p}
                    enabled
                    label="Place"
                    onChange={(value) => {
                      const activity = currentActivity ?? content.activities[0];
                      changeActivity(activity.id, {
                        places: activity.places.map((place, index) =>
                          index === i ? String(value) : place,
                        ),
                      });
                    }}
                  />
                ) : (
                  <span>{p}</span>
                )}
                <span>{flow.selection.place === p ? "●" : "○"}</span>
              </button>
            ))}
          </div>
          <label className="field custom-place">
            Өөр газар / Custom place
            <input
              maxLength={160}
              value={
                currentActivity?.places.includes(flow.selection.place)
                  ? ""
                  : flow.selection.place
              }
              placeholder="Уулзах газрын нэр…"
              onChange={(e) =>
                selection({ type: "select", patch: { place: e.target.value } })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !editing) next("place");
              }}
            />
          </label>
          <div className="actions spread">
            <button onClick={() => dispatch({ type: "back" })}>← Буцах</button>
            <button
              className="primary"
              disabled={editing || !flow.selection.place.trim()}
              onClick={() => next("place")}
            >
              Батлах / Confirm →
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      );
    if (scene === "notification")
      return (
        <div className="scene-body center">
          <Icon kind="mail" />
          <h2>
            {editing
              ? E("notification")
              : content.notification.replaceAll("{sender}", content.sender)}
          </h2>
          {editing && <p>{E("sender")}</p>}
          <p className="subtle">1 unread message</p>
          <button
            className="primary"
            onClick={() => {
              if (editing) return;
              if (
                flow.plan &&
                (flow.scene === "message" || flow.scene === "final")
              ) {
                hideWindow("invitation");
                launch("mail");
              } else {
                next("notification");
              }
            }}
          >
            Зурвас нээх ♡
          </button>
        </div>
      );
    if (scene === "message")
      return (
        <>
          <div className="menu mail-menu">
            File <span>Edit</span>
            <span>View</span>
            <span>Insert</span>
            <span>Format</span>
            <span>Tools</span>
            <span>Help</span>
          </div>
          <div className="mail-meta">
            <div>From: {editing ? E("sender") : flow.plan?.sender}</div>
            <div>To: my favorite person ♡</div>
            <div>
              Subject: {editing ? E("messageTitle") : content.messageTitle}
            </div>
          </div>
          <div className="scene-body message-body">
            {editing ? (
              <>
                <p>{E("greeting")}</p>
                <p>{E("messageTemplate")}</p>
                <p>{E("customClosing")}</p>
                <small>
                  Available placeholders:{" "}
                  {
                    "{activity}, {date}, {time}, {place}, {customClosing}, {sender}"
                  }
                </small>
              </>
            ) : (
              <>
                <p className="typewriter" aria-hidden="true">
                  {message.slice(0, readLength)}
                  {readLength < message.length && (
                    <span className="cursor">▌</span>
                  )}
                </p>
                <p className="sr-only">{message}</p>
                {readLength < message.length && (
                  <button
                    className="read-all"
                    onClick={() => setReadLength(message.length)}
                  >
                    Show full message
                  </button>
                )}
                <div className="actions">
                  <button className="primary" onClick={() => next("message")}>
                    Бидний төлөвлөгөө ♡ →
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      );
    if (scene === "final")
      return (
        <>
          {finalActions}
          <div className="keepsake messenger-card">
            <div className="messenger-heading">
              <button
                className="messenger-avatar"
                aria-label={
                  editing ? "Selected emoticon" : "Open Love Assistant"
                }
                disabled={editing}
                onClick={() => setLoveAssistant(true)}
              >
                <img
                  src={emoticonUrl(
                    editing
                      ? content.finalEmoticon
                      : (flow.plan?.finalEmoticon ?? "love"),
                  )}
                  alt={
                    emoticons[
                      editing
                        ? content.finalEmoticon
                        : (flow.plan?.finalEmoticon ?? "love")
                    ].label
                  }
                />
              </button>
              <div className="messenger-heading-copy">
                <div className="messenger-presence">
                  <i /> YOU & ME <span>• Online</span>
                </div>
                <h1>{editing ? E("finalHeading") : flow.plan?.heading}</h1>
                <div className="messenger-subject">
                  {editing ? E("eventTitle") : flow.plan?.eventTitle}
                </div>
              </div>
            </div>
            {(editing || flow.plan) && (
              <>
                <dl className="messenger-details">
                  <div>
                    <dt>Үйл ажиллагаа</dt>
                    <dd>{flow.plan?.activity ?? content.activities[0].name}</dd>
                  </div>
                  <div>
                    <dt>Өдөр & цаг</dt>
                    <dd>
                      {flow.plan
                        ? `${displayDate(flow.plan.date)} · ${flow.plan.time}`
                        : "Өдөр & цагаа сонгоно ♡"}
                    </dd>
                  </div>
                  <div>
                    <dt>Уулзах газар</dt>
                    <dd>
                      {flow.plan?.place ?? content.activities[0].places[0]}
                    </dd>
                  </div>
                </dl>
                <p className="closing messenger-bubble">
                  <span>
                    {editing ? E("customClosing") : flow.plan?.closing}
                  </span>
                  <span>
                    {editing ? E("finalClosing") : flow.plan?.finalClosing}
                  </span>
                </p>
                {editing && (
                  <div
                    className="emoticon-picker"
                    role="group"
                    aria-label="Choose an emoticon"
                  >
                    <span className="emoticon-caption">
                      Emoticons <small>Choose your mood</small>
                    </span>
                    <div className="emoticon-options">
                      {emoticonIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          aria-label={`Choose ${emoticons[id].label}`}
                          aria-pressed={content.finalEmoticon === id}
                          title={`${emoticons[id].label} ${emoticons[id].code}`}
                          onClick={() =>
                            setContent((c) => ({ ...c, finalEmoticon: id }))
                          }
                        >
                          <img src={emoticonUrl(id)} alt="" />
                          <span>{emoticons[id].code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="messenger-receipt">
                  <p className="confirmed">✓ БАТЛАГДСАН</p>
                  <span>See you soon! ;)</span>
                </div>
                <div className="memory-meter" aria-label="Memory saved 100%">
                  <span>Memory saved</span>
                  <i>
                    <b />
                  </i>
                  <strong>100%</strong>
                </div>
              </>
            )}
          </div>
          <footer className="window-status">♡ Saved in our memories</footer>
        </>
      );
  }
  const titles: Record<Scene, TextKey> = {
    boot: "bootTitle",
    invitation: "invitationTitle",
    connecting: "connecting",
    celebration: "celebrationTitle",
    game: "gameTitle",
    activity: "activityTitle",
    date: "dateTitle",
    place: "placeTitle",
    notification: "messageTitle",
    message: "messageTitle",
    final: "finalTitle",
  };
  return (
    <div
      className={`desktop desktop-${scene} ${editing ? "is-editing" : ""}`}
      onPointerDownCapture={() => {
        if (!startupPlayed.current) {
          startupPlayed.current = true;
          sound("startup", muted);
        }
      }}
      onClickCapture={(e) => {
        if (
          (e.target as HTMLElement).closest("button, a") &&
          !(e.target as HTMLElement).closest(".game-grid")
        )
          sound("click", muted);
      }}
      onClick={() => {
        if (startMenu) setStartMenu(false);
      }}
    >
      {toolbar}
      {scene === "boot" && !editing && unlocked && !loading && !loadError && (
        <div
          className="xp-startup"
          role="status"
          aria-label="Windows XP starting"
        >
          <div className="startup-logo" />
          <div className="startup-progress">
            <i />
            <i />
            <i />
          </div>
          <span>{content.bootTitle}</span>
        </div>
      )}
      <div className="desktop-workspace">
        <nav className="desktop-icons" aria-label="Desktop shortcuts">
          {(
            ["computer", "documents", "music", "notes", "invitation"] as AppId[]
          ).map((id) => (
            <button
              className={`desktop-shortcut ${id === "invitation" && scene === "invitation" && !wm.windows.invitation?.visible ? "invitation-pulse" : ""}`}
              key={id}
              aria-label={`Open ${apps[id].title}`}
              title="Double-click or double-tap to open"
              onDoubleClick={() => launch(id)}
              onPointerUp={(event) => touchOpen(id, event)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  launch(id);
                }
              }}
            >
              <Icon kind={apps[id].icon} />
              <span>
                {id === "music"
                  ? "Music"
                  : id === "notes"
                    ? "Notes"
                    : apps[id].title}
              </span>
            </button>
          ))}
        </nav>
        {unlocked &&
          !loading &&
          !loadError &&
          (["music", "notes", "computer", "documents"] as AppId[]).map((id) => {
            const state = wm.windows[id];
            if (!state) return null;
            return (
              <div
                key={id}
                data-app={id}
                hidden={!state.visible}
                className={`managed-app utility-app app-${id} ${state.maximized ? "maximized" : ""}`}
                style={{ zIndex: state.order }}
                onPointerDown={() => wm.focus(id)}
              >
                <Window
                  title={apps[id].title}
                  icon={apps[id].icon}
                  controls={wm.controls(id)}
                  className={
                    id === "music"
                      ? "player-window"
                      : id === "notes"
                        ? "notes-window"
                        : "explorer-window"
                  }
                >
                  <div className="app-scroll">
                    {id === "music" ? (
                      <MusicPlayer
                        title={E("soundtrackTitle")}
                        muted={muted}
                        onMute={toggleSound}
                        editing={editing}
                        youtubeUrl={content.youtubeUrl}
                        onUrlChange={(v) => update("youtubeUrl", v)}
                        onSave={saveAndPlay}
                        busy={busy}
                        running={!state.closed}
                        playRequest={playRequest}
                      />
                    ) : id === "notes" ? (
                      <>
                        <div className="menu">
                          File <span>Edit</span>
                          <span>Format</span>
                          <span>View</span>
                          <span>Help</span>
                        </div>
                        <div className="notes-paper">
                          {E("desktopNote", "Note text")}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="menu">
                          File <span>Edit</span>
                          <span>View</span>
                          <span>Favorites</span>
                          <span>Tools</span>
                          <span>Help</span>
                        </div>
                        <div className="explorer-address">
                          Address <span>{apps[id].title}</span>
                        </div>
                        <div className="explorer-content">
                          <>
                            <h3>
                              {id === "computer"
                                ? "Files stored on this computer"
                                : "My Documents"}
                            </h3>
                            {(["invitation", "music", "notes"] as AppId[]).map(
                              (target) => (
                                <button
                                  className="explorer-file"
                                  key={target}
                                  onDoubleClick={() => launch(target)}
                                  onPointerUp={(event) =>
                                    touchOpen(target, event)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") launch(target);
                                  }}
                                >
                                  <Icon kind={apps[target].icon} />
                                  {apps[target].title}
                                </button>
                              ),
                            )}
                            {flow.plan && (
                              <button
                                className="explorer-file"
                                onDoubleClick={() => launch("plan")}
                                onPointerUp={(event) =>
                                  touchOpen("plan", event)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") launch("plan");
                                }}
                              >
                                <Icon kind="notes" />
                                Бидний болзоо.txt
                              </button>
                            )}
                          </>
                        </div>
                      </>
                    )}
                  </div>
                </Window>
              </div>
            );
          })}
        <main className="main-stage">
          <div ref={headingRef} tabIndex={-1} className="focus-anchor" />
          {!unlocked ? (
            <Window
              title="Private Studio — Sign in"
              icon="computer"
              className="lock-window"
            >
              <div className="scene-body">
                <div className="lock-icon">♡</div>
                <h1>Invitation Studio</h1>
                <p>Your little corner for a very special invitation.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(unlock);
                  }}
                >
                  {lockedUntil > now ? (
                    <p role="alert">
                      Studio locked. Try again in{" "}
                      {Math.ceil((lockedUntil - now) / 3600000)} hours.
                    </p>
                  ) : (
                    <label className="field">
                      Studio password
                      <input
                        autoFocus
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        maxLength={1024}
                      />
                    </label>
                  )}
                  <div className="actions">
                    {lockedUntil <= now && (
                      <button className="primary" disabled={busy}>
                        {busy ? "Connecting…" : "Unlock Studio →"}
                      </button>
                    )}
                    <a className="button" href="/?share=test">
                      Try the public demo
                    </a>
                  </div>
                </form>
                <small className="subtle">
                  Private studio · A new sign-in is required on every reload.
                </small>
              </div>
            </Window>
          ) : loading ? (
            <Window title="Opening invitation…">
              <div className="scene-body">
                <div className="loading-track">
                  <i />
                </div>
              </div>
            </Window>
          ) : loadError ? (
            <Window title="Invitation unavailable">
              <div className="scene-body">
                <p role="alert">{loadError}</p>
                <button onClick={() => location.reload()}>Try again</button>
              </div>
            </Window>
          ) : (
            <>
              {(["invitation", "mail", "plan"] as AppId[]).map((id) => {
                const state = wm.windows[id];
                if (!state) return null;
                const view: Scene =
                  id === "mail"
                    ? "message"
                    : id === "plan"
                      ? "final"
                      : ["message", "final"].includes(scene)
                        ? "notification"
                        : scene;
                return (
                  <div
                    key={id}
                    data-app={id}
                    hidden={!state.visible}
                    className={`managed-app story-app ${state.maximized ? "maximized" : ""}`}
                    style={{ zIndex: state.order }}
                    onPointerDown={() => wm.focus(id)}
                  >
                    <Window
                      className={`${id === storyApp ? "main-window" : "story-window"} scene-${view}`}
                      title={
                        view === "final" && !editing && flow.plan
                          ? flow.plan.title
                          : E(titles[view])
                      }
                      icon={apps[id].icon}
                      controls={wm.controls(id)}
                    >
                      <div className="app-scroll">
                        {id !== "invitation" && !editing && !flow.plan ? (
                          <div className="scene-body">
                            <h2>
                              {id === "mail"
                                ? "No new messages yet"
                                : "No confirmed date yet"}
                            </h2>
                            <p>Open your invitation to begin a new plan. ♡</p>
                            <button onClick={() => launch("invitation")}>
                              Open invitation
                            </button>
                          </div>
                        ) : (
                          sceneContent(view)
                        )}
                      </div>
                    </Window>
                  </div>
                );
              })}
            </>
          )}
          {error && (
            <div className="status-error" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
        </main>
      </div>
      {notice && (
        <div className="notice-balloon" role="status">
          <Icon kind="heart" />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {scene === "notification" && !editing && unlocked && (
        <button className="tray-message" onClick={() => next("notification")}>
          <Icon kind="mail" />
          <span>
            <strong>1 new message</strong>
            {content.notification.replaceAll("{sender}", content.sender)}
          </span>
        </button>
      )}
      <footer className="taskbar">
        <button
          className="start-button"
          aria-expanded={startMenu}
          onClick={(e) => {
            e.stopPropagation();
            setStartMenu((v) => !v);
          }}
        >
          <span>♥</span> start
        </button>
        <div className="quick-launch" aria-hidden="true">
          <Icon kind="internet" />
          <Icon kind="mail" />
        </div>
        <div className="task-list" aria-label="Running applications">
          {(Object.keys(wm.windows) as AppId[]).map((id) => (
            <button
              className={`task-button ${wm.windows[id]?.visible ? "active" : ""}`}
              key={id}
              aria-label={`Restore ${apps[id].title}`}
              onClick={() => launch(id)}
            >
              <Icon kind={apps[id].icon} />
              <span>{apps[id].title}</span>
            </button>
          ))}
        </div>
        <div className="system-tray">
          <button
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            onClick={toggleSound}
          >
            {muted ? "♫̸" : "♫"}
          </button>
          <span className="connection" title="Connection">
            ▣
          </span>
          <time>
            <span>
              {new Date(now).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <small>
              {new Date(now).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </small>
          </time>
        </div>
      </footer>
      {startMenu && (
        <div className="start-menu">
          <header>
            <strong>♡ Invitation editor</strong>
            <small>{editWindowLabel}</small>
          </header>
          {allowed && unlocked && (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setEditScene(Math.max(1, scenes.indexOf(flow.scene)));
                }}
              >
                Edit Invitation
              </button>
              <button onClick={() => setFinish(true)}>Finish edit</button>
            </>
          )}
          {context.mode === "demo" && (
            <button
              onClick={() => {
                localStorage.removeItem(demoKey);
                setContent(freshContent());
                dispatch({ type: "restart" });
                setEditing(false);
                setEditScene(1);
                setFinish(false);
                setNotice("Demonstration reset. ♡");
              }}
            >
              Reset demonstration
            </button>
          )}
        </div>
      )}
      {link && (
        <Dialog title="Your invitation is ready ♡" onClose={() => setLink("")}>
          <label className="field">
            Share this link
            <input
              ref={linkInput}
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>
            {share?.finalized
              ? "Editing is permanently finished. This invitation remains available to view."
              : "Editable for five days, or until you finish editing permanently."}
          </p>
          <div className="actions">
            <button
              onClick={() =>
                void copyLink(linkInput.current!).then((ok) => {
                  setCopied(ok);
                  if (ok) setTimeout(() => setCopied(false), 2500);
                  else
                    setNotice(
                      "Link selected. Press Ctrl+C or touch and hold to copy.",
                    );
                })
              }
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <a
              className="button primary"
              href={link}
              target="_blank"
              rel="opener"
            >
              Open Link
            </a>
            <button onClick={() => setLink("")}>Close</button>
          </div>
        </Dialog>
      )}
      {loveAssistant && (
        <Dialog
          title="Love Assistant ♡"
          onClose={() => {
            setLoveAssistant(false);
            setLoveMessage(
              (value) => (value + 1) % loveAssistantMessages.length,
            );
          }}
        >
          <div className="love-assistant-message">
            <Icon kind="heart" />
            <p>{loveAssistantMessages[loveMessage]}</p>
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                setLoveAssistant(false);
                setLoveMessage(
                  (value) => (value + 1) % loveAssistantMessages.length,
                );
              }}
            >
              OK ♡
            </button>
          </div>
        </Dialog>
      )}
      {finish && (
        <Dialog
          title="Finish editing permanently?"
          onClose={() => setFinish(false)}
        >
          <p>
            Are you sure you want to finish editing permanently? You will not be
            able to edit this invitation again.
          </p>
          {context.mode !== "real" && (
            <p>
              {context.mode === "demo"
                ? "The demo is a browser-only sandbox. This saves your changes and exits the editor; you can reset or edit the demo again."
                : "This will save your invitation and permanently finalize its link. Your in-memory studio draft stays available."}
            </p>
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const savedShare = await save();
                  if (context.mode === "real") {
                    const r = await api<{ share: Share }>(
                      `/shares/${context.id}/finalize`,
                      "POST",
                    );
                    setShare(r.share);
                  } else if (context.mode === "studio") {
                    const r = await api<{ share: Share }>(
                      `/shares/${savedShare!.id}/finalize`,
                      "POST",
                    );
                    setShare(r.share);
                    setLink(buildShareUrl(location.origin, r.share.id));
                  }
                  setFinish(false);
                  setEditing(false);
                  setNotice("Editing finished. ♡");
                })
              }
            >
              Yes, Finish Permanently
            </button>
            <button disabled={busy} onClick={() => setFinish(false)}>
              No, Continue Editing
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

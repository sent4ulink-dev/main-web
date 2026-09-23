import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { emptyBoard, reveal, found, nearby } from "../shared/game";
import { localDate, validDateTime } from "../shared/flow";
import type { Content } from "../shared/content";
import { sound } from "./sound";
export function Icon({ kind = "heart" }: { kind?: string }) {
  const id = useId();
  const paths: Record<string, ReactNode> = {
    music: (
      <>
        <path
          fill="#a3badd"
          stroke="#446394"
          d="M5 13 36 5l17 9v35L19 56 5 46Z"
        />
        <path fill="#eaf6ff" d="m9 16 25-6 13 7-28 7Z" />
        <circle
          cx="31"
          cy="34"
          r="17"
          fill="#4575c9"
          stroke="#f5fbff"
          strokeWidth="2"
        />
        <circle cx="31" cy="34" r="13" fill="#1fa4df" />
        <path
          fill="#ffb945"
          stroke="#fcf2bc"
          strokeWidth="2"
          d="m26 24 15 10-15 10Z"
        />
      </>
    ),
    notes: (
      <>
        <path fill="#aad6dc" stroke="#548aa1" d="m9 8 38-4 5 46-37 6Z" />
        <path fill="#ffffee" stroke="#a2bcc6" d="m13 7 30-3 4 42-29 4Z" />
        <path
          stroke="#7b9aaf"
          strokeWidth="2"
          d="m19 16 19-2m-18 9 19-2m-18 9 19-2m-18 9 19-2"
        />
      </>
    ),
    computer: (
      <>
        <path
          fill={`url(#${id}-case)`}
          stroke="#546a98"
          d="m34 9 15-3 7 5v34l-14 6-8-5Z"
        />
        <path stroke="#697dac" fill="#a5b6d3" d="m49 7 7 4v34l-7 3Z" />
        <path
          fill={`url(#${id}-case)`}
          stroke="#5c6395"
          d="m3 10 31-7 5 4v32L9 45l-6-4Z"
        />
        <path
          fill={`url(#${id}-screen)`}
          stroke="#fafaff"
          strokeWidth="2"
          d="m7 13 25-5v27L7 40Z"
        />
        <path
          fill="#d8e1ef"
          stroke="#7f86a0"
          d="M17 43v6l-7 3 1 3h21l6-4-11-3v-8Z"
        />
      </>
    ),
    folder: (
      <>
        <path
          fill="#fceca0"
          stroke="#c79a24"
          strokeWidth="1.2"
          d="m4 12 17-5 8 6 20-3 5 6v31L9 55l-5-5Z"
        />
        <path
          fill={`url(#${id}-folder)`}
          stroke="#b78621"
          strokeWidth="1.2"
          d="m10 24 45-8-6 32-40 7Z"
        />
        <path
          fill="none"
          stroke="#fffac2"
          strokeWidth="2"
          d="m12 27 39-7-4 25"
        />
      </>
    ),
    internet: (
      <>
        <circle cx="28" cy="28" r="22" fill="#0e9eea" />
        <g fill="none" stroke="#c8f3ff" strokeWidth="2">
          <ellipse cx="28" cy="28" rx="11" ry="22" />
          <path d="M7 28h42M10 16h36M10 40h36" />
        </g>
        <path fill="#ffda77" d="M44 54 34 44c-6-9 4-13 10-5 5-8 15-4 9 5Z" />
      </>
    ),
    bin: (
      <>
        <path
          fill={`url(#${id}-case)`}
          stroke="#8eb0c4"
          d="m10 16 5 33q15 9 30-1l5-32Z"
        />
        <ellipse
          fill="#faffff"
          stroke="#96b0c7"
          cx="30"
          cy="16"
          rx="20"
          ry="7"
        />
        <path fill="#b8cad5" d="m18 16 7-6 16 3 1 6-14 2Z" />
        <path
          fill="#65b957"
          stroke="#419847"
          d="m24 27 8-3 5 6-5 1-2-3-3 3Zm14 6 2 8-7 4 1-5 3-1-2-4Zm-10 13-8-2-1-8 4 3v3h6Z"
        />
        <path
          fill="none"
          stroke="#7298a8"
          strokeWidth="3"
          d="m23 25 0 16m10-16v16"
        />
      </>
    ),
    mail: (
      <>
        <path fill="#fff4df" d="M4 13h48v34H4z" />
        <path
          fill="none"
          stroke="#ceac65"
          strokeWidth="2"
          d="m4 13 24 20 24-20M4 47l17-21m31 21L35 26"
        />
        <path fill="#ee729a" d="M40 19C27 7 30 0 39 5c9-8 18 4 1 14" />
      </>
    ),
    heart: (
      <path
        fill="#ed6f98"
        stroke="#b34170"
        strokeWidth="1.5"
        d="M28 51 6 30C-8 11 16-2 28 16 42-2 65 11 50 30Z"
      />
    ),
  };
  return (
    <svg className="icon" viewBox="0 0 58 58" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-case`} x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset=".5" stopColor="#dce5fa" />
          <stop offset="1" stopColor="#97a5c7" />
        </linearGradient>
        <linearGradient id={`${id}-screen`} x2=".8" y2="1">
          <stop stopColor="#d7f7ff" />
          <stop offset=".5" stopColor="#72c6f5" />
          <stop offset="1" stopColor="#4377bd" />
        </linearGradient>
        <linearGradient id={`${id}-folder`} x2="0" y2="1">
          <stop stopColor="#fff599" />
          <stop offset=".4" stopColor="#ffe464" />
          <stop offset="1" stopColor="#eab332" />
        </linearGradient>
      </defs>
      {paths[kind] ?? paths.heart}
    </svg>
  );
}
export function Window({
  title,
  children,
  className = "",
  icon = "heart",
  controls,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: string;
  controls?: {
    onMinimize?: () => void;
    onRestore?: () => void;
    onClose?: () => void;
    maximized?: boolean;
  };
}) {
  return (
    <section className={`xp-window ${className}`}>
      <header className="titlebar" onDoubleClick={controls?.onRestore}>
        <span className="window-title">
          <Icon kind={icon} />
          {title}
        </span>
        <span
          className="window-chrome"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {controls ? (
            <>
              {controls.onMinimize && (
                <button
                  aria-label="Minimize window"
                  onClick={controls.onMinimize}
                >
                  _
                </button>
              )}
              {controls.onRestore && (
                <button
                  aria-label={
                    controls.maximized ? "Restore window" : "Maximize window"
                  }
                  onClick={controls.onRestore}
                >
                  {controls.maximized ? "❐" : "□"}
                </button>
              )}
              {controls.onClose && (
                <button aria-label="Close window" onClick={controls.onClose}>
                  ×
                </button>
              )}
            </>
          ) : (
            <>
              <i aria-hidden="true">_</i>
              <i aria-hidden="true">□</i>
              <i aria-hidden="true">×</i>
            </>
          )}
        </span>
      </header>
      {children}
    </section>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <Window title={title} controls={{ onClose }}>
        <div className="dialog-content">{children}</div>
      </Window>
    </dialog>,
    document.body,
  );
}
export function Editable({
  value,
  onChange,
  enabled,
  children,
  label,
}: {
  value: string | string[];
  onChange: (v: string | string[]) => void;
  enabled: boolean;
  children?: ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const display = Array.isArray(value) ? value.join("\n") : value;
  useEffect(() => {
    if (!enabled || !ref.current || document.activeElement === ref.current)
      return;
    if (ref.current.innerText !== display) ref.current.innerText = display;
  }, [display, enabled]);
  if (!enabled)
    return (
      <span>
        {children ?? (Array.isArray(value) ? value.join(" / ") : value)}
      </span>
    );
  const commit = (raw: string, removeBlankLines = false) =>
    onChange(
      Array.isArray(value)
        ? raw.split(/\r?\n/).filter((line) => !removeBlankLines || line.trim())
        : raw,
    );
  return (
    <span
      ref={ref}
      className="editable"
      role="textbox"
      tabIndex={0}
      aria-label={`Edit ${label}`}
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      onFocus={(event) => {
        if (!event.currentTarget.innerText)
          event.currentTarget.innerText = display;
      }}
      onInput={(event) => commit(event.currentTarget.innerText)}
      onBlur={(event) => commit(event.currentTarget.innerText, true)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  );
}
export function Game({
  content,
  muted,
  onCount,
  editExtras,
}: {
  content: Content;
  muted: boolean;
  onCount: (n: number) => void;
  editExtras: ReactNode;
}) {
  const [board, setBoard] = useState(emptyBoard),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const count = found(board);
  const done = count === 5;
  useEffect(() => {
    if (!board.started || done) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [board.started, done]);
  function click(index: number) {
    if (done || board.revealed.includes(index)) return;
    const next = reveal(board, index);
    setBoard(next);
    const total = found(next);
    onCount(total);
    if (next.hearts.includes(index)) {
      setMessage(
        content.heartMessages[(total - 1) % content.heartMessages.length],
      );
      sound(total === 5 ? "complete" : "heart", muted);
    } else if (next.wrong.includes(index)) {
      setError(content.wrongMessages[index % content.wrongMessages.length]);
      sound("error", muted);
    } else sound("click", muted);
  }
  return (
    <>
      <div className="game-panel">
        <div className="game-display">
          <output className="digital" aria-label="Hearts remaining">
            {String(5 - count).padStart(3, "0")}
          </output>
          <button
            aria-label="Reset Heart Sweeper"
            className="reset-game"
            onClick={() => {
              setBoard(emptyBoard());
              setElapsed(0);
              setMessage("");
              onCount(0);
            }}
          >
            ♡
          </button>
          <output className="digital" aria-label="Seconds elapsed">
            {String(Math.min(999, elapsed)).padStart(3, "0")}
          </output>
        </div>
        <div className="game-grid">
          {Array.from({ length: 36 }, (_, i) => {
            const open = board.revealed.includes(i),
              heart = board.hearts.includes(i),
              wrong = board.wrong.includes(i),
              number = nearby(board, i);
            return (
              <button
                key={i}
                className={`tile ${open ? "revealed" : ""} ${open && heart ? "heart-tile" : ""}`}
                aria-label={`Tile ${i + 1}${open ? (heart ? " heart" : wrong ? " error" : ` ${number} nearby hearts}`) : ""}`}
                aria-disabled={open || done}
                onClick={() => click(i)}
              >
                {open ? (heart ? "♥" : wrong ? "✿" : number || "·") : ""}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`game-progress ${done ? "won" : ""}`} aria-live="polite">
        <strong>{count}/5 hearts found</strong>
        <p>{done ? content.gameComplete : message || "♡ ♡ ♡ ♡ ♡"}</p>
      </div>
      {editExtras}
      {error && (
        <Dialog title="Heart Sweeper" onClose={() => setError("")}>
          <div className="error-note">
            <span>♡</span>
            <p>{error}</p>
          </div>
          <button autoFocus onClick={() => setError("")}>
            OK
          </button>
        </Dialog>
      )}
    </>
  );
}
export function Calendar({
  date,
  time,
  onChange,
  onConfirm,
}: {
  date: string;
  time: string;
  onChange: (p: { date?: string; time?: string }) => void;
  onConfirm: () => void;
}) {
  const today = new Date();
  const [month, setMonth] = useState(() => {
    const d = date ? new Date(date + "T12:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    offset = (month.getDay() + 6) % 7;
  return (
    <>
      <div className="calendar">
        <div className="calendar-head">
          <button
            aria-label="Previous month"
            onClick={() =>
              setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <strong>
            {month.getFullYear()} он · {month.getMonth() + 1} сар
          </strong>
          <button
            aria-label="Next month"
            onClick={() =>
              setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
        <div className="calendar-grid">
          {["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"].map((d) => (
            <span className="weekday" key={d}>
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = localDate(
                new Date(month.getFullYear(), month.getMonth(), i + 1),
              ),
              selected = date === day;
            return (
              <button
                key={day}
                disabled={day < localDate(today)}
                aria-label={day}
                aria-pressed={selected}
                className={
                  selected
                    ? "selected"
                    : day === localDate(today)
                      ? "today"
                      : ""
                }
                onClick={() => {
                  if (selected && validDateTime(date, time)) onConfirm();
                  else onChange({ date: day });
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <label className="field time-field">
        Цаг / Time
        <select
          value={time}
          onChange={(e) => onChange({ time: e.target.value })}
        >
          <option value="">Цагаа сонгох</option>
          {Array.from(
            { length: 48 },
            (_, i) =>
              `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
          ).map((t) => (
            <option
              key={t}
              value={t}
              disabled={!date || !validDateTime(date, t, now)}
            >
              {t}
              {date && !validDateTime(date, t, now) ? " — unavailable" : ""}
            </option>
          ))}
        </select>
      </label>
      <small className="timezone">
        {Intl.DateTimeFormat().resolvedOptions().timeZone} · local time
      </small>
      {date && time && !validDateTime(date, time, now) && (
        <p role="alert" className="error">
          Энэ цаг өнгөрсөн байна. Шинэ цаг сонгоно уу.
        </p>
      )}
    </>
  );
}

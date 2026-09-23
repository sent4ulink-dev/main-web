'use client';
import { useEffect, useRef, useState } from 'react';
import { dateConfig, planConfig, type DatePlan } from '@/lib/date-config';
import type { LoveAction } from '@/lib/love-machine';
import { renderLetter, type ShareContent } from '@/lib/share-content';
import { InlineEdit } from './InlineEdit';

export function Envelope({ open = false }: { open?: boolean }) {
  return (
    <svg
      className="pixel-envelope"
      viewBox="0 0 30 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d={
          open
            ? 'M14 0h2v2h3v2h3v2h3v2h3v2h2v14H0V10h2V8h3V6h3V4h3V2h3z'
            : 'M0 4h30v20H0z'
        }
      />
      <path
        fill="var(--lcd)"
        d={
          open
            ? 'M3 11h24v10H3zM5 9h20v2H5zM8 7h14v2H8zM11 5h8v2h-8zM14 3h2v2h-2z'
            : 'M3 7h24v14H3z'
        }
      />
      <path
        fill="currentColor"
        d="M3 7h3v2H3zm3 2h3v2H6zm3 2h3v2H9zm3 2h6v2h-6zm6-2h3v2h-3zm3-2h3v2h-3zm3-2h3v2h-3z"
      />
    </svg>
  );
}
export function MessageNotification({
  onOpen,
  sender = dateConfig.sender,
  notificationText = '1 зурвас\nирлээ',
  editing = false,
  onContentChange,
  content,
}: {
  onOpen: () => void;
  sender?: string;
  notificationText?: string;
  editing?: boolean;
  onContentChange?: (content: ShareContent) => void;
  content?: ShareContent;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <>
      <section className="message-notification transition-in">
        <button
          className="message-alert"
          ref={ref}
          onClick={onOpen}
          aria-label="Шинэ зурвасаа унших"
        >
          <Envelope />
          <span className="message-count">
            <InlineEdit
              value={notificationText}
              editing={editing}
              onChange={(value) =>
                content &&
                onContentChange?.({ ...content, notificationText: value })
              }
            />
          </span>
          <span className="message-from">
            ИЛГЭЭГЧ:{' '}
            <InlineEdit
              value={sender}
              editing={editing}
              onChange={(value) =>
                content && onContentChange?.({ ...content, sender: value })
              }
            />
          </span>
        </button>
      </section>
      {!editing && (
        <footer className="softkeys single">
          <button onClick={onOpen}>
            Унших <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
    </>
  );
}
export function NokiaMessage({
  plan,
  dispatch,
  content,
  editing = false,
  onContentChange,
}: {
  plan: DatePlan;
  dispatch: (action: LoveAction) => void;
  content: ShareContent;
  editing?: boolean;
  onContentChange?: (content: ShareContent) => void;
}) {
  const config = planConfig(plan),
    text = renderLetter(content, {
      activity: plan.activity || content.activities[0]?.label || '',
      date: config.date,
      time: config.time,
      place: plan.place || content.activities[0]?.places[0] || '',
    }),
    [visible, setVisible] = useState(0),
    [instant, setInstant] = useState(false),
    [reduced, setReduced] = useState(false),
    ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    let shown = 0;
    const timer = setInterval(() => {
      shown = Math.min(text.length, shown + 3);
      setVisible(shown);
      if (shown === text.length) clearInterval(timer);
    }, 24);
    return () => {
      clearInterval(timer);
      media.removeEventListener('change', update);
    };
  }, [text]);
  const done = editing || instant || reduced || visible >= text.length;
  return (
    <>
      <section
        ref={ref}
        tabIndex={-1}
        className="sms-scene transition-in"
        aria-labelledby="sms-title"
      >
        <header className="sms-header">
          <Envelope open />
          <h1 id="sms-title">Зурвасууд</h1>
          <span>1/1</span>
        </header>
        <div className="sms-sender">
          <span>Илгээгч:</span>
          <strong>
            <InlineEdit
              value={content.sender}
              editing={editing}
              onChange={(sender) => onContentChange?.({ ...content, sender })}
            />
          </strong>
          <span className="sms-label">ЗУРВАС</span>
        </div>
        <div className="sms-body">
          <p aria-hidden={!editing ? 'true' : undefined}>
            {editing ? (
              <InlineEdit
                className="letter-editor"
                value={content.letterBody}
                editing
                onChange={(letterBody) =>
                  onContentChange?.({ ...content, letterBody })
                }
              />
            ) : done ? (
              text
            ) : (
              text.slice(0, visible)
            )}
            {!done && <span className="sms-cursor">▮</span>}
          </p>
          {!editing && <p className="sr-only">{text}</p>}
        </div>
        <div className="sms-bottom">
          <span>♥ ЗҮРХЭНДЭЭ ХАДГАЛЛАА</span>
          {!done && (
            <button onClick={() => setInstant(true)}>БҮГДИЙГ УНШИХ</button>
          )}
        </div>
      </section>
      {!editing && (
        <footer className="softkeys picker-softkeys">
          <button onClick={() => dispatch({ type: 'BACK' })}>◀ Буцах</button>
          <button onClick={() => dispatch({ type: 'VIEW_PLAN' })}>
            Бидний болзоо <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
    </>
  );
}

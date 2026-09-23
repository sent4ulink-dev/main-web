'use client';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { World } from './World';
import { Heart, StatusBar } from './Icons';
import { LoveSnake } from './LoveSnake';
import { Ending } from './Ending';
import { useSound } from './useSound';
import { calendarEvent, localDay, planConfig } from '@/lib/date-config';
import {
  createStoryCard,
  sharePlanText,
  storyFileName,
} from '@/lib/share-card';
import { DatePickers } from './DatePickers';
import { MessageNotification, NokiaMessage } from './NokiaMessage';
import {
  initialState,
  loveReducer,
  type LoveAction,
  type Scene,
} from '@/lib/love-machine';
import { defaultShareContent, type ShareContent } from '@/lib/share-content';
import { InlineEdit } from './InlineEdit';

const editorScenes: Scene[] = [
  'INVITATION',
  'CELEBRATION',
  'GAME_PROMPT',
  'LOVE_SNAKE',
  'GAME_COMPLETE',
  'ENDING',
  'ACTIVITY_PICKER',
  'DATE_PICKER',
  'PLACE_PICKER',
  'MESSAGE_NOTIFICATION',
  'MESSAGE',
  'DATE_DETAILS',
];

const durations: Partial<Record<Scene, number>> = {
  BOOT: 1900,
  YES_PROCESSING: 850,
  CONNECTED: 950,
  CELEBRATION: 3400,
  GAME_COMPLETE: 1500,
  ENDING: 3500,
};
export function Invitation({
  content = defaultShareContent,
  editing = false,
  onContentChange,
}: {
  content?: ShareContent;
  editing?: boolean;
  onContentChange?: (content: ShareContent) => void;
}) {
  const [state, dispatch] = useReducer(loveReducer, initialState),
    [hover, setHover] = useState(false),
    [saved, setSaved] = useState(''),
    [shareStatus, setShareStatus] = useState(''),
    [sharing, setSharing] = useState(false),
    [bootFound, setBootFound] = useState(false),
    [noEditMessage, setNoEditMessage] = useState(0);
  const { enabled, enable, toggle, play } = useSound(),
    heading = useRef<HTMLElement>(null),
    current = useRef(state),
    currentContent = useRef(content),
    sharingRef = useRef(false);
  useEffect(() => {
    current.current = state;
    currentContent.current = content;
  }, [content, state]);
  const scene = state.scene,
    accepted = !['BOOT', 'INVITATION', 'YES_PROCESSING'].includes(scene);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const previewPlan = {
    activity: state.plan.activity || content.activities[0]?.label || '',
    day: state.plan.day || localDay(tomorrow),
    time: state.plan.time || '18:00',
    place: state.plan.place || content.activities[0]?.places[0] || '',
  };
  const displayPlan = editing ? previewPlan : state.plan;
  const dateConfig = planConfig(displayPlan, {
    title: content.dateTitle,
    message: content.dateMessage,
    sender: content.sender,
  });
  const isPicker = ['ACTIVITY_PICKER', 'DATE_PICKER', 'PLACE_PICKER'].includes(
    scene,
  );
  useEffect(() => {
    try {
      if (sessionStorage.getItem('little-signal-booted'))
        dispatch({ type: 'BOOT_DONE' });
    } catch {}
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setBootFound(true), 1250);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (editing) return;
    const duration = durations[scene];
    if (!duration) return;
    const timer = setTimeout(
      () => dispatch({ type: scene === 'BOOT' ? 'BOOT_DONE' : 'NEXT' }),
      duration,
    );
    return () => clearTimeout(timer);
  }, [editing, scene]);
  useEffect(() => {
    if (editing) dispatch({ type: 'GO_TO_SCENE', scene: 'INVITATION' });
  }, [editing]);
  const setField = (key: keyof ShareContent, value: string) =>
    onContentChange?.({ ...content, [key]: value });
  const editable = (key: keyof ShareContent) => (
    <InlineEdit
      value={typeof content[key] === 'string' ? content[key] : ''}
      editing={editing}
      onChange={(value) => setField(key, value)}
    />
  );
  useEffect(() => {
    if (scene !== 'BOOT') {
      try {
        sessionStorage.setItem('little-signal-booted', '1');
      } catch {}
    }
    if (scene === 'CELEBRATION' || scene === 'GAME_COMPLETE') play('success');
    if (scene === 'MESSAGE_NOTIFICATION') play('message');
    if (
      ![
        'BOOT',
        'LOVE_SNAKE',
        'YES_PROCESSING',
        'CONNECTED',
        'GAME_COMPLETE',
        'ENDING',
      ].includes(scene)
    )
      heading.current?.focus({ preventScroll: true });
  }, [scene, play]);
  const accept = () => {
    if (current.current.scene !== 'INVITATION') return;
    play('yes');
    dispatch({ type: 'ACCEPT' });
  };
  const won = useCallback(
      (score: number) => dispatch({ type: 'WON', score }),
      [],
    ),
    collect = useCallback(() => play('heart'), [play]);
  const save = () => {
    const event = calendarEvent(dateConfig),
      text =
        event ??
        `${dateConfig.title}\n\nӨДӨР: ${dateConfig.date}\nЦАГ: ${dateConfig.time}\nГАЗАР: ${dateConfig.location}\n\n${dateConfig.message}\n\nБолзоогоо хараахан товлоогүй байна.\n`;
    const url = URL.createObjectURL(
      new Blob([text], {
        type: event
          ? 'text/calendar;charset=utf-8'
          : 'text/plain;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = event ? 'our-date.ics' : 'our-date.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(event ? 'ХУАНЛИД ХАДГАЛАХ ФАЙЛ БЭЛЭН' : 'ТЭМДЭГЛЭЛ ХАДГАЛЛАА');
  };
  const sharePlan = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setShareStatus('ЗУРАГ ҮҮСГЭЖ БАЙНА...');
    try {
      const file = await createStoryCard(displayPlan);
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: 'Бидний болзоо ♥',
          text: sharePlanText(displayPlan),
          files: [file],
        });
        setShareStatus('ХУВААЛЦАХАД БЭЛЭН ♥');
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = storyFileName(displayPlan);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setShareStatus('ЗУРАГ ТАТАГДЛАА ♥');
      }
    } catch (error) {
      setShareStatus(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'ХУВААЛЦАХЫГ ЦУЦАЛЛАА'
          : 'ЗУРАГ ҮҮСГЭЖ ЧАДСАНГҮЙ',
      );
    } finally {
      setSharing(false);
      sharingRef.current = false;
    }
  };
  const planMessage = sharePlanText(displayPlan);
  const openPlanMessage = () => {
    const isAppleMobile =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    window.location.href = `sms:${isAppleMobile ? '&' : '?'}body=${encodeURIComponent(planMessage)}`;
  };
  // Optional browser-agent interface, sharing the exact reducer used by the UI.
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => Promise<unknown>;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const register = async () => {
      try {
        await context.registerTool(
          {
            name: 'respond_to_invitation',
            description:
              'Answer the invitation. Yes advances the story; No shows a playful message and stays on the invitation. Available only on the invitation screen.',
            inputSchema: {
              type: 'object',
              properties: { answer: { type: 'string', enum: ['yes', 'no'] } },
              required: ['answer'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async (input) => {
              const answer = (input as { answer?: unknown })?.answer;
              if (answer !== 'yes' && answer !== 'no')
                throw new Error('Answer must be yes or no.');
              if (current.current.scene !== 'INVITATION')
                throw new Error('The invitation is not awaiting an answer.');
              const action: LoveAction = {
                type: answer === 'yes' ? 'ACCEPT' : 'DECLINE',
              };
              dispatch(action);
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => resolve()),
                ),
              );
              return {
                scene: current.current.scene,
                message:
                  answer === 'no'
                    ? currentContent.current.noMessages[
                        current.current.noAttempts - 1
                      ]
                    : null,
              };
            },
          },
          { signal: life.signal },
        );
      } catch {
        /* Unsupported or unavailable WebMCP never blocks the invitation. */
      }
    };
    void register();
    return () => life.abort();
  }, []);
  const contents = () => {
    switch (scene) {
      case 'INVITATION':
        return (
          <>
            <p className="eyebrow">{editable('invitationEyebrow')}</p>
            <h1>{editable('invitationQuestion')}</h1>
            <Heart className="invitation-heart" />
            {editing ? (
              <div className="snake-message-editor no-message-editor">
                <button
                  onClick={() =>
                    setNoEditMessage(
                      (no) =>
                        (no - 1 + content.noMessages.length) %
                        content.noMessages.length,
                    )
                  }
                  aria-label="Өмнөх Үгүй хариу"
                >
                  ◀
                </button>
                <output className="notice">
                  <small>
                    {noEditMessage + 1}/{content.noMessages.length} · ҮГҮЙ ДАРАХАД
                  </small>
                  <InlineEdit
                    value={content.noMessages[noEditMessage]}
                    editing
                    onChange={(value) =>
                      onContentChange?.({
                        ...content,
                        noMessages: content.noMessages.map((message, index) =>
                          index === noEditMessage ? value : message,
                        ),
                      })
                    }
                  />
                </output>
                <button
                  onClick={() =>
                    setNoEditMessage(
                      (noEditMessage + 1) % content.noMessages.length,
                    )
                  }
                  aria-label="Дараагийн Үгүй хариу"
                >
                  ▶
                </button>
              </div>
            ) : state.noAttempts > 0 && (
              <output className="notice" aria-live="polite">
                <InlineEdit
                  value={content.noMessages[state.noAttempts - 1]}
                  editing={editing}
                  onChange={(value) => {
                    const noMessages = [...content.noMessages];
                    noMessages[state.noAttempts - 1] = value;
                    onContentChange?.({ ...content, noMessages });
                  }}
                />
              </output>
            )}
          </>
        );
      case 'YES_PROCESSING':
        return (
          <>
            <h1>ТҮР ХҮЛЭЭГЭЭРЭЙ...</h1>
            <p>Бидний долгионыг хайж байна.</p>
            <Heart className="invitation-heart" />
          </>
        );
      case 'CONNECTED':
        return (
          <>
            <h1>
              ХОЛБОЛТ
              <br />
              АМЖИЛТТАЙ
            </h1>
            <Heart className="invitation-heart" />
          </>
        );
      case 'CELEBRATION':
        return (
          <>
            <h1 className="small-title">{editable('successTitle')}</h1>
            <div className="heart-row">
              <Heart />
              <Heart />
              <Heart />
            </div>
            <p className="achievement">
              {editable('successAchievement')}
              <strong>{editable('successPair')}</strong>
            </p>
            <p className="subcopy">{editable('successMessage')}</p>
          </>
        );
      case 'GAME_PROMPT':
        return (
          <>
            <p className="eyebrow">{editable('gamePromptEyebrow')}</p>
            <h1 className="small-title">{editable('gamePromptTitle')}</h1>
            <p className="subcopy">{editable('gamePromptMessage')}</p>
            <div className="menu-actions">
              <button
                className="pixel-button"
                onClick={() => {
                  if (editing) return;
                  dispatch({ type: 'PLAY' });
                }}
              >
                ▶ {editable('gameStartLabel')}
              </button>
            </div>
          </>
        );
      case 'GAME_COMPLETE':
        return (
          <>
            <p className="eyebrow">{editable('gameMeterLabel')} / 100%</p>
            <h1 className="small-title">{editable('gameCompleteTitle')}</h1>
            <div className="heart-row">
              <Heart />
              <Heart />
              <Heart />
            </div>
            <p className="subcopy">{editable('gameCompleteMessage')}</p>
          </>
        );
      case 'ENDING':
        return (
          <>
            <p className="eyebrow">{editable('endingEyebrow')}</p>
            <h1 className="small-title">{editable('endingTitle')}</h1>
            <Ending />
            <p className="subcopy">{editable('endingMessage')}</p>
          </>
        );
      case 'DATE_DETAILS':
        return (
          <>
            <p className="eyebrow">{editable('dateDetailsEyebrow')}</p>
            <h1 className="small-title">
              {editable('dateTitle')} <span aria-hidden="true">♥</span>
            </h1>
            <dl className="date-grid">
              <dt>ЮУ</dt>
              <dd>{previewPlan.activity}</dd>
              <dt>ӨДӨР</dt>
              <dd>{dateConfig.date}</dd>
              <dt>ЦАГ</dt>
              <dd>{dateConfig.time}</dd>
              <dt>ГАЗАР</dt>
              <dd>{dateConfig.location}</dd>
              <dt>ТӨЛӨВ</dt>
              <dd>{editable('dateStatus')}</dd>
            </dl>
            <p className="date-message">{editable('dateMessage')}</p>
            <output className="save-feedback">
              {shareStatus || saved || 'ЧИ + БИ. ТОХИРЛОО ШҮҮ.'}
            </output>
            <div className="date-actions">
              <button className="story-share pixel-button" onClick={save}>
                ХУАНЛИД ХАДГАЛАХ <span aria-hidden="true">♥</span>
              </button>
              <button
                className="story-share pixel-button"
                onClick={sharePlan}
                disabled={sharing}
              >
                {sharing ? 'ЗУРАГ ҮҮСГЭЖ БАЙНА...' : editable('shareImageLabel')}{' '}
                <span aria-hidden="true">♥</span>
              </button>
              <button
                className="story-share pixel-button message-plan"
                onClick={openPlanMessage}
              >
                МЕССЕЖЭЭР ЯВУУЛАХ <span aria-hidden="true">▶</span>
              </button>
            </div>
          </>
        );
      default:
        return null;
    }
  };
  const classes =
    scene === 'INVITATION'
      ? 'invitation'
      : ['YES_PROCESSING', 'CONNECTED'].includes(scene)
        ? 'processing'
        : scene === 'DATE_DETAILS'
          ? 'date-scene'
          : scene === 'CELEBRATION'
            ? 'celebration'
            : 'bonus';
  return (
    <main
      className={`lcd state-${scene.toLowerCase()}`}
      onClickCapture={(event) => {
        const target = event.target as Element;
        if (target.closest('.sound-toggle')) return;
        const firstClick = enable();
        const button = target.closest(
          'button, [role="radio"], select',
        );
        if (!target.closest('[data-sound="yes"]') && (firstClick || button))
          play('nav');
      }}
    >
      <World
        together={accepted}
        celebrate={scene === 'CELEBRATION'}
        quiet={scene === 'LOVE_SNAKE' || isPicker || scene === 'MESSAGE'}
        hover={hover}
      />
      {scene !== 'BOOT' && (
        <StatusBar
          connected={accepted}
          sound={enabled}
          onSound={toggle}
          networkLabel={content.networkLabel}
        />
      )}
      {scene === 'BOOT' ? (
        <button
          className="boot"
          onClick={() => dispatch({ type: 'BOOT_DONE' })}
          aria-label="Эхлэлийг алгасах"
        >
          <span className="boot-title" aria-live="polite">
            {bootFound ? 'ДОХИО ОЛДЛОО' : 'ХОЛБОЖ БАЙНА...'}
          </span>
          <span className="boot-bars" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
          <span className="boot-tagline">БЯЦХАН ДОХИО. БЯЦХАН ХАЙР.</span>
          <span className="text-button">ҮРГЭЛЖЛҮҮЛЭХ ▶</span>
        </button>
      ) : scene === 'LOVE_SNAKE' ? (
        <LoveSnake
          onWin={won}
          onHeart={collect}
          content={content}
          editing={editing}
          onContentChange={onContentChange}
        />
      ) : isPicker ? (
        <DatePickers
          key={scene}
          scene={scene}
          plan={previewPlan}
          dispatch={dispatch}
          onSelect={() => {}}
          content={content}
          editing={editing}
          onContentChange={onContentChange}
        />
      ) : scene === 'MESSAGE_NOTIFICATION' ? (
        <MessageNotification
          sender={content.sender}
          notificationText={content.notificationText}
          editing={editing}
          content={content}
          onContentChange={onContentChange}
          onOpen={() => {
            dispatch({ type: 'OPEN_MESSAGE' });
          }}
        />
      ) : scene === 'MESSAGE' ? (
        <NokiaMessage
          plan={previewPlan}
          dispatch={dispatch}
          content={content}
          editing={editing}
          onContentChange={onContentChange}
        />
      ) : (
        <section
          ref={heading}
          tabIndex={-1}
          key={scene}
          className={`scene transition-in ${classes}`}
          aria-label="Бидний бяцхан хайрын түүх"
        >
          {contents()}
        </section>
      )}
      <div className="sr-only" aria-live="polite">
        {scene === 'YES_PROCESSING'
          ? 'Хариуг чинь хүлээн авч байна'
          : scene === 'CONNECTED'
            ? 'Холболт амжилттай'
            : scene === 'GAME_COMPLETE'
              ? 'Долоон зүрх цуглууллаа. Үе дууслаа.'
              : scene === 'ENDING'
                ? 'Төгс хос. Могой муур болон хувирч, хос дээрээ очлоо.'
                : ''}
      </div>
      {scene === 'INVITATION' && (
        <footer className="softkeys">
          <button
            data-sound="yes"
            onClick={editing ? undefined : accept}
            onPointerEnter={() => {
              setHover(true);
            }}
            onPointerLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
          >
            <span aria-hidden="true">◀</span> {editable('yesLabel')}
          </button>
          <span className="footer-note">БЯЦХАН ДОХИО. БЯЦХАН ХАЙР.</span>
          <button
            onClick={() => {
              if (!editing) dispatch({ type: 'DECLINE' });
            }}
          >
            {editable('noLabel')} <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
      {scene === 'CELEBRATION' && !editing && (
        <footer className="softkeys single">
          <button onClick={() => dispatch({ type: 'NEXT' })}>
            {content.continueLabel} <span aria-hidden="true">▶</span>
          </button>
        </footer>
      )}
      {scene === 'DATE_DETAILS' && !editing && (
        <footer className="softkeys date-softkeys">
          <button
            className="replay"
            onClick={() => {
              setSaved('');
              setShareStatus('');
              dispatch({ type: 'RETURN' });
            }}
          >
            ◀ ДАХИН
          </button>
          <span className="date-signoff">{content.dateSignoff}</span>
        </footer>
      )}
      {editing && (
        <nav className="inline-editor-nav" aria-label="Засах дэлгэц сонгох">
          <button
            onClick={() => {
              const index = editorScenes.indexOf(scene);
              dispatch({
                type: 'GO_TO_SCENE',
                scene:
                  editorScenes[
                    (index - 1 + editorScenes.length) % editorScenes.length
                  ],
              });
            }}
          >
            ◀ ӨМНӨХ
          </button>
          <span>
            {editorScenes.indexOf(scene) + 1}/{editorScenes.length} · ТЕКСТ ДЭЭР
            ДАРЖ ЗАСНА
          </span>
          <button
            onClick={() => {
              const index = editorScenes.indexOf(scene);
              dispatch({
                type: 'GO_TO_SCENE',
                scene: editorScenes[(index + 1) % editorScenes.length],
              });
            }}
          >
            ДАРААХ ▶
          </button>
        </nav>
      )}
    </main>
  );
}

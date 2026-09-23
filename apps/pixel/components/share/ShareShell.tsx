'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Invitation } from '@/components/love/Invitation';
import {
  defaultShareContent,
  sanitizeShareContent,
  type ShareContent,
} from '@/lib/share-content';

const EDIT_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const DEMO_KEY = 'little-signal-demo-share';
const OWNER_KEY = 'little-signal-owner-share';
const LOCK_ENABLED =
  (import.meta.env.VITE_LOCK_ENABLED as string | undefined) !== 'false';
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? '';

type Mode = 'studio' | 'demo' | 'real';
type UnlockResult =
  | { status: 'ok'; token: string }
  | { status: 'wrong'; attemptsRemaining: number }
  | { status: 'locked_out'; retryAfterMs: number }
  | { status: 'error'; message?: string };
type ShareRecord = {
  id: string;
  content: ShareContent;
  createdAt: string;
  editUntil: string;
  finalized: boolean;
  editToken?: string;
};

function ownerToken(id: string | null): string {
  if (!id) return '';
  try {
    const value = JSON.parse(sessionStorage.getItem(OWNER_KEY) || 'null') as {
      id?: string;
      token?: string;
    } | null;
    return value?.id === id && typeof value.token === 'string'
      ? value.token
      : '';
  } catch {
    return '';
  }
}

function modeFromLocation(): { mode: Mode; id: string | null } {
  const id = new URLSearchParams(location.search).get('share');
  if (!id) return { mode: 'studio', id: null };
  return { mode: id === 'test' ? 'demo' : 'real', id };
}

function demoRecord(): ShareRecord {
  try {
    const stored = localStorage.getItem(DEMO_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ShareRecord;
      return {
        ...parsed,
        id: 'test',
        content: sanitizeShareContent(parsed.content),
      };
    }
  } catch {}
  return {
    id: 'test',
    content: defaultShareContent,
    createdAt: new Date().toISOString(),
    editUntil: new Date(Date.now() + EDIT_WINDOW_MS).toISOString(),
    finalized: false,
  };
}

function remainingLabel(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (totalSeconds >= 3600) {
    const totalMinutes = Math.ceil(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} цаг ${minutes} мин`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function lockoutLabel(milliseconds: number): string {
  const hours = Math.max(1, Math.ceil(milliseconds / (60 * 60 * 1000)));
  return `${hours} цагийн дараа дахин оролдоно уу.`;
}

export function ShareShell() {
  const [{ mode, id }] = useState(modeFromLocation);
  const [record, setRecord] = useState<ShareRecord | null>(
    mode === 'demo' ? demoRecord : null,
  );
  const [studioContent, setStudioContent] = useState(defaultShareContent);
  const [loading, setLoading] = useState(mode === 'real');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [studioFinalized, setStudioFinalized] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [password, setPassword] = useState('');
  const [studioToken, setStudioToken] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null,
  );
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const [editToken, setEditToken] = useState(() => ownerToken(id));
  const [stats, setStats] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(false);

  const content = mode === 'studio' ? studioContent : record?.content;
  const editUntil = record ? new Date(record.editUntil).getTime() : 0;
  const lockedOut = lockoutRemaining > 0;
  const canEdit =
    (mode === 'studio' && !studioFinalized) ||
    Boolean(record && !record.finalized && editUntil > now);

  useEffect(() => {
    if (mode !== 'real' || !id) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/shares/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Хуваалцсан урилга олдсонгүй.');
        return response.json() as Promise<ShareRecord>;
      })
      .then((value) => {
        setRecord({ ...value, content: sanitizeShareContent(value.content) });
        try {
          if (ownerToken(id)) setEditing(true);
        } catch {}
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError'))
          setError(reason instanceof Error ? reason.message : 'Алдаа гарлаа.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, mode]);

  useEffect(() => {
    if (mode === 'studio' && studioToken) {
      fetch(`${API_BASE}/stats`)
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{ total?: number }>)
            : Promise.resolve(null),
        )
        .then((value) =>
          setStats(typeof value?.total === 'number' ? value.total : null),
        )
        .catch(() => {});
    }
  }, [mode, studioToken]);

  useEffect(() => {
    if (!lockedOut) return;
    const timer = setInterval(
      () => setLockoutRemaining((value) => Math.max(0, value - 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [lockedOut]);

  useEffect(() => {
    if (mode === 'studio' || !canEdit) return;
    const remaining = editUntil - Date.now();
    const interval = remaining > 60 * 60 * 1000 ? 60_000 : 1_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [canEdit, editUntil, mode]);

  useEffect(() => {
    if (!dirty.current || mode === 'studio' || !record || !canEdit) return;
    const timer = setTimeout(async () => {
      dirty.current = false;
      if (mode === 'demo') {
        localStorage.setItem(DEMO_KEY, JSON.stringify(record));
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/shares/${record.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: record.content }),
        });
        if (!response.ok) throw new Error();
      } catch {
        dirty.current = true;
        setError('Автоматаар хадгалж чадсангүй. Дахин оролдоно уу.');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [canEdit, mode, record]);

  const updateContent = useCallback(
    (next: ShareContent) => {
      if (!canEdit) return;
      if (mode === 'studio') setStudioContent(next);
      else {
        dirty.current = true;
        setRecord((current) =>
          current ? { ...current, content: next } : current,
        );
      }
    },
    [canEdit, mode],
  );

  const generateLink = async () => {
    setError('');
    setLoading(true);
    try {
      if (!API_BASE) throw new Error('API ХАЯГ ТОХИРУУЛАГДААГҮЙ БАЙНА.');
      const response = await fetch(`${API_BASE}/shares`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${studioToken}`,
        },
        body: JSON.stringify({
          content: studioContent,
          finalized: studioFinalized,
        }),
      });
      if (response.status === 401) {
        setStudioToken('');
        throw new Error('НЭВТРЭЛТ ДУУССАН. ДАХИН НЭВТЭРНЭ ҮҮ.');
      }
      if (!response.ok) throw new Error('ХОЛБООС ҮҮСГЭЖ ЧАДСАНГҮЙ.');
      const created = (await response.json()) as ShareRecord;
      sessionStorage.setItem(
        OWNER_KEY,
        JSON.stringify({ id: created.id, token: created.editToken }),
      );
      setEditToken(created.editToken ?? '');
      const url = new URL(location.origin);
      url.searchParams.set('share', created.id);
      setShareUrl(url.toString());
      setStats((value) => (value === null ? 1 : value + 1));
      setLinkDialog(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  const unlockStudio = async () => {
    if (!password || authenticating) return;
    setAuthenticating(true);
    setError('');
    try {
      if (!API_BASE) throw new Error('API ХАЯГ ТОХИРУУЛАГДААГҮЙ БАЙНА.');
      const response = await fetch(`${API_BASE}/api/studio/unlock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as UnlockResult;
      if (result.status === 'locked_out') {
        setLockoutRemaining(result.retryAfterMs);
        setAttemptsRemaining(0);
        setPassword('');
        return;
      }
      if (result.status === 'wrong') {
        setAttemptsRemaining(result.attemptsRemaining);
        setError(
          `НУУЦ ҮГ БУРУУ. ${result.attemptsRemaining} ОРОЛДЛОГО ҮЛДЛЭЭ.`,
        );
        return;
      }
      if (result.status !== 'ok' || !response.ok)
        throw new Error(
          result.status === 'error' && result.message
            ? result.message
            : 'СЕРВЕРТЭЙ ХОЛБОГДОЖ ЧАДСАНГҮЙ.',
        );
      setStudioToken(result.token);
      setAttemptsRemaining(null);
      setPassword('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Нэвтрэх боломжгүй байна.',
      );
    } finally {
      setAuthenticating(false);
    }
  };

  const finalize = async () => {
    if (mode === 'studio') {
      setStudioFinalized(true);
      setEditing(false);
      setConfirmFinalize(false);
      return;
    }
    if (!record || !canEdit || record.finalized) return;
    try {
      if (mode === 'demo') {
        const next = { ...record, finalized: true };
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        setRecord(next);
      } else {
        if (!editToken) throw new Error();
        if (dirty.current) {
          const saveResponse = await fetch(`${API_BASE}/shares/${record.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: record.content }),
          });
          if (!saveResponse.ok) throw new Error();
          dirty.current = false;
        }
        const response = await fetch(
          `${API_BASE}/shares/${record.id}/finalize`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${editToken}` },
          },
        );
        if (!response.ok) throw new Error();
        setRecord({ ...record, finalized: true });
      }
      setEditing(false);
      setConfirmFinalize(false);
      setNow(Date.now());
    } catch {
      setError('Урилгыг түгжиж чадсангүй.');
    }
  };

  const saveNow = async () => {
    if (!content || !canEdit) return;
    setError('');
    try {
      if (mode === 'studio') {
        setEditing(false);
        return;
      }
      if (!record) return;
      if (mode === 'demo') {
        localStorage.setItem(DEMO_KEY, JSON.stringify(record));
      } else {
        const response = await fetch(`${API_BASE}/shares/${record.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: record.content }),
        });
        if (!response.ok) throw new Error();
      }
      dirty.current = false;
      setEditing(false);
    } catch {
      dirty.current = true;
      setError('Засварыг хадгалж чадсангүй. Дахин оролдоно уу.');
    }
  };

  if (loading && !content)
    return <main className="share-state">УРЬЛАГЫГ АЧААЛЖ БАЙНА...</main>;
  if (error && !content) return <main className="share-state">{error}</main>;
  if (mode === 'studio' && LOCK_ENABLED && !studioToken && lockedOut)
    return (
      <main className="studio-lock">
        <section className="studio-lockout" aria-live="assertive">
          <span className="studio-lock-signal" aria-hidden="true">
            ▂▄▆█
          </span>
          <p>ХАНДАЛТ ТҮГЖИГДЛЭЭ</p>
          <h1>24 ЦАГИЙН ТҮГЖЭЭ</h1>
          <output>{lockoutLabel(lockoutRemaining)}</output>
          <small>Аюулгүй байдлын үүднээс дахин оролдох хэсгийг хаалаа.</small>
        </section>
      </main>
    );
  if (mode === 'studio' && LOCK_ENABLED && !studioToken)
    return (
      <main className="studio-lock">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void unlockStudio();
          }}
        >
          <span className="studio-lock-signal" aria-hidden="true">
            ▂▄▆█
          </span>
          <p>ХУВИЙН ХЭСЭГ</p>
          <h1>УРЬЛАГЫН СТУДИ</h1>
          <label htmlFor="studio-unlock">НУУЦ ҮГ</label>
          <input
            id="studio-unlock"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <output>{error}</output>}
          {!error && attemptsRemaining !== null && (
            <output>{attemptsRemaining} ОРОЛДЛОГО ҮЛДЛЭЭ.</output>
          )}
          <button type="submit" disabled={!password || authenticating}>
            {authenticating ? 'ШАЛГАЖ БАЙНА...' : 'НЭВТРЭХ ▶'}
          </button>
          <small>Хуудсыг дахин нээх бүрд нууц үг асууна.</small>
        </form>
      </main>
    );

  return (
    <>
      <Invitation
        content={content ?? defaultShareContent}
        editing={editing}
        onContentChange={updateContent}
      />
      {mode === 'studio' ? (
        <aside
          className={`studio-bar ${editing ? 'is-editing' : ''}`}
          aria-label="Урилгын студи"
        >
          <p>
            Засвараа хийсний дараа холбоос үүсгээрэй.
            {stats !== null && <span>{stats} холбоос үүссэн</span>}
          </p>
          {!studioFinalized && !editing && (
            <button onClick={() => setEditing(true)}>ЗАСАХ</button>
          )}
          {editing && (
            <>
              <button onClick={() => void saveNow()}>ХАДГАЛАХ</button>
              <button
                className="finalize-button"
                onClick={() => setConfirmFinalize(true)}
              >
                <span className="full-label">ЗАСВАРЫГ БҮРМӨСӨН ДУУСГАХ</span>
                <span className="compact-label">ДУУСГАХ</span>
              </button>
            </>
          )}
          {!editing && (
            <button onClick={generateLink} disabled={loading}>
              {loading ? 'ҮҮСГЭЖ БАЙНА...' : 'ХОЛБООС ҮҮСГЭХ'}
            </button>
          )}
        </aside>
      ) : (
        canEdit && (
          <aside
            className={`share-edit-tools ${editing ? 'is-editing' : ''}`}
          >
            {!editing && (
              <span className="countdown-badge">
                {mode === 'demo' ? 'ТУРШИЛТ · ' : ''}
                {remainingLabel(editUntil - now)}
              </span>
            )}
            {!editing && (
              <button onClick={() => setEditing(true)}>✎ ЗАСАХ</button>
            )}
            {editing && (
              <>
                <button onClick={() => void saveNow()}>ХАДГАЛАХ</button>
                <button
                  className="finalize-button"
                  onClick={() => setConfirmFinalize(true)}
                >
                  <span className="full-label">
                    ЗАСВАРЫГ БҮРМӨСӨН ДУУСГАХ
                  </span>
                  <span className="compact-label">ДУУСГАХ</span>
                </button>
              </>
            )}
          </aside>
        )
      )}

      {error && content && !linkDialog && (
        <output className="share-global-error">{error}</output>
      )}

      {confirmFinalize && (
        <div className="share-modal-backdrop" role="presentation">
          <dialog
            className="share-dialog finalize-dialog"
            open
            aria-modal="true"
          >
            <h2>ЗАСВАРЫГ БҮРМӨСӨН ДУУСГАХ УУ?</h2>
            <p>Дуусгасны дараа дахин засварлах боломжгүй. Итгэлтэй байна уу?</p>
            <div className="share-dialog-actions">
              <button onClick={() => setConfirmFinalize(false)}>ҮГҮЙ</button>
              <button
                className="finalize-button"
                onClick={() => void finalize()}
              >
                ТИЙМ
              </button>
            </div>
          </dialog>
        </div>
      )}

      {linkDialog && mode === 'studio' && shareUrl && (
        <div className="share-modal-backdrop" role="presentation">
          <dialog className="share-dialog" open aria-modal="true">
            <h2>ХУВААЛЦАХ ХОЛБООС</h2>
            <label htmlFor="generated-link">БЭЛЭН ХОЛБООС</label>
            <input id="generated-link" readOnly value={shareUrl} />
            <div className="share-dialog-actions">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  } catch {
                    const input =
                      document.querySelector<HTMLInputElement>(
                        '#generated-link',
                      );
                    input?.select();
                    setError('Холбоосыг гараар хуулна уу.');
                  }
                }}
              >
                {copied ? 'ХУУЛЛАА!' : 'ХОЛБООС ХУУЛАХ'}
              </button>
              <a href={shareUrl}>НЭЭХ</a>
              <button onClick={() => setLinkDialog(false)}>ХААХ</button>
            </div>
            {error && <output>{error}</output>}
          </dialog>
        </div>
      )}
    </>
  );
}

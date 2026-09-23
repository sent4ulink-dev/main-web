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
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? '';

// No public studio any more — every real invitation is minted server-to-server by
// the sent4u order Worker the moment it's paid for (see server/index.mjs's /ensure).
// A bare visit (no ?share=) has nothing to show.
type Mode = 'demo' | 'real';
type ShareRecord = {
  id: string;
  content: ShareContent;
  createdAt: string;
  editUntil: string;
  finalized: boolean;
};

function modeFromLocation(): { mode: Mode; id: string | null } {
  const id = new URLSearchParams(location.search).get('share');
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
    return `${hours}h ${minutes}m`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ShareShell() {
  const [{ mode, id }] = useState(modeFromLocation);
  // No ?share= at all: there is no public studio any more — every real invitation is
  // minted server-to-server the moment it's paid for (see server/index.mjs's /ensure),
  // so a bare visit has nothing to show.
  const notFound = id === null;
  const [record, setRecord] = useState<ShareRecord | null>(
    mode === 'demo' ? demoRecord : null,
  );
  const [loading, setLoading] = useState(mode === 'real' && !notFound);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dirty = useRef(false);

  const content = record?.content;
  const editUntil = record ? new Date(record.editUntil).getTime() : 0;
  const canEdit = Boolean(record && !record.finalized && editUntil > now);

  useEffect(() => {
    if (mode !== 'real' || !id) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/shares/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("This link isn't working.");
        return response.json() as Promise<ShareRecord>;
      })
      .then((value) => {
        setRecord({ ...value, content: sanitizeShareContent(value.content) });
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError'))
          setError(reason instanceof Error ? reason.message : 'Something went wrong.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, mode]);

  useEffect(() => {
    if (!canEdit) return;
    const remaining = editUntil - Date.now();
    const interval = remaining > 60 * 60 * 1000 ? 60_000 : 1_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [canEdit, editUntil]);

  useEffect(() => {
    if (!dirty.current || !record || !canEdit) return;
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
        setError("Couldn't autosave. Please try again.");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [canEdit, mode, record]);

  const updateContent = useCallback(
    (next: ShareContent) => {
      if (!canEdit) return;
      dirty.current = true;
      setRecord((current) =>
        current ? { ...current, content: next } : current,
      );
    },
    [canEdit],
  );

  const finalize = async () => {
    if (!record || !canEdit || record.finalized) return;
    try {
      if (mode === 'demo') {
        const next = { ...record, finalized: true };
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        setRecord(next);
      } else {
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
          { method: 'POST' },
        );
        if (!response.ok) throw new Error();
        setRecord({ ...record, finalized: true });
      }
      setEditing(false);
      setConfirmFinalize(false);
      setNow(Date.now());
    } catch {
      setError("Couldn't lock the invitation.");
    }
  };

  const saveNow = async () => {
    if (!content || !canEdit) return;
    setError('');
    try {
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
      setError("Couldn't save your edit. Please try again.");
    }
  };

  if (notFound)
    return (
      <main className="share-state">
        This link doesn&rsquo;t look right. Double-check the URL you were sent.
      </main>
    );
  if (loading && !content)
    return <main className="share-state">LOADING THE INVITATION...</main>;
  if (error && !content) return <main className="share-state">{error}</main>;

  return (
    <>
      <Invitation
        content={content ?? defaultShareContent}
        editing={editing}
        onContentChange={updateContent}
      />
      {canEdit && (
        <aside className={`share-edit-tools ${editing ? 'is-editing' : ''}`}>
          {!editing && (
            <span className="countdown-badge">
              {mode === 'demo' ? 'DEMO · ' : ''}
              {remainingLabel(editUntil - now)}
            </span>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)}>✎ EDIT</button>
          )}
          {editing && (
            <>
              <button onClick={() => void saveNow()}>SAVE</button>
              <button
                className="finalize-button"
                onClick={() => setConfirmFinalize(true)}
              >
                <span className="full-label">FINISH EDITING FOR GOOD</span>
                <span className="compact-label">FINISH</span>
              </button>
            </>
          )}
        </aside>
      )}

      {error && content && (
        <output className="share-global-error">{error}</output>
      )}

      {confirmFinalize && (
        <div className="share-modal-backdrop" role="presentation">
          <dialog
            className="share-dialog finalize-dialog"
            open
            aria-modal="true"
          >
            <h2>FINISH EDITING FOR GOOD?</h2>
            <p>Once you finish, you can't edit it again. Are you sure?</p>
            <div className="share-dialog-actions">
              <button onClick={() => setConfirmFinalize(false)}>NO</button>
              <button
                className="finalize-button"
                onClick={() => void finalize()}
              >
                YES
              </button>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
}

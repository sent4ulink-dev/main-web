import { ShareContent } from '../types';

// In dev this stays relative and hits the Vite proxy to the local Worker (see
// vite.config.ts). In production set VITE_API_BASE_URL to the deployed Worker's
// origin, e.g. https://pinky-share-api.<you>.workers.dev — see worker/wrangler.toml.
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/shares`;

export interface LoadShareResult {
  content: ShareContent;
  editUntil: number;
  finalized: boolean;
}

export async function loadShare(id: string): Promise<LoadShareResult> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to load share');
  return res.json();
}

let updateTimer: ReturnType<typeof setTimeout> | null = null;

function putShareContent(id: string, content: ShareContent): void {
  fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  }).catch(() => {
    // best-effort autosave — the next edit's debounce (or an explicit flushShare) will retry
  });
}

/** Debounced ~2s after the last change. Only call this while editing and within the edit window. */
export function updateShare(id: string, content: ShareContent): void {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => putShareContent(id, content), 2000);
}

/** Immediate, non-debounced write — what the editor toolbar's Save button calls, so
 * clicking it doesn't leave the person waiting out updateShare's 2s debounce to know
 * their edit actually went out. Also cancels any pending debounced write so the two
 * never race and send stale content after this one. */
export function flushShare(id: string, content: ShareContent): void {
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  putShareContent(id, content);
}

export async function finalizeShare(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/finalize`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to finalize share');
}

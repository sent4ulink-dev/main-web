// A link and the demo are edited through the step-by-step editor, with the card itself running live beside the words
// (live-preview.js loads this page again with ?embed=1; App.tsx shows the screen each step is about).
import { openEasyEditor } from './easy-editor.js';
import { LivePreview } from './live-preview.js';
import { steps, title, forEditing, forSaving } from './easy-steps.js';
import { flushDemoContent, getDemoContent, loadDemoContent } from '../utils/demoShare';
import { finalizeShare, loadShare } from '../utils/realShare';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

// (the app's own autosave is fire-and-forget; here a save that didn't arrive says so)
async function putShare(id, content) {
  const res = await fetch(`${API}/api/shares/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }).catch(() => null);
  if (res?.ok) return;
  const data = res ? await res.json().catch(() => ({})) : {};
  throw new Error(data.error === 'finalized' || data.error === 'edit_window_closed' ? 'This link can no longer be edited.' : 'Couldn’t save. Check your internet and try again.');
}

export function openCardEditor({ mode, shareId }) {
  const demo = mode === 'demo';
  let until = 0;
  const embed = new URL(location.href);
  embed.searchParams.set('embed', '1');
  embed.hash = '';
  const live = new LivePreview({ src: embed.href });
  const link = new URL(location.href);
  link.searchParams.delete('embed');
  link.hash = '';
  openEasyEditor({
    title, live, steps,
    load: async () => {
      if (demo) return { content: forEditing(loadDemoContent()), canEdit: true };
      const r = await loadShare(shareId);
      until = r.editUntil;
      return { content: forEditing(r.content), canEdit: !r.finalized && r.editUntil > Date.now(), finished: r.finalized };
    },
    save: async (content, { finish } = {}) => {
      const next = forSaving(content, getDemoContent());
      if (demo) { flushDemoContent(next); return; }
      await putShare(shareId, next);
      if (finish) await finalizeShare(shareId).catch(() => { throw new Error('Couldn’t finish. Please try again.'); });
    },
    mediaURL: (name) => name,
    ytCheck: `${API}/api/yt-check`,
    canFinish: !demo,
    shareUrl: demo ? '' : link.href,
    deadlineText: () => (demo ? 'This is a demo: what you write is kept on this device only.'
      : until ? `You can edit this link until ${new Date(until).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''),
    done: () => location.reload(),
  });
}

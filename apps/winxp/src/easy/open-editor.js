// A link and the demo are edited through the step-by-step editor, with the desktop itself running live beside the words
// (live-preview.js loads this page again with ?embed=1; App.tsx and easy/preview.ts show the screen each step is about).
import { openEasyEditor } from './easy-editor.js';
import { LivePreview } from './live-preview.js';
import { steps, title, forEditing, forSaving } from './easy-steps.js';
import { api, apiBase } from '../api';
import { contentSchema, freshContent } from '../../shared/content';
import { youtubeId } from '../../shared/youtube';
import { canEdit } from '../../shared/flow';

export const DEMO_KEY = 'heart-desktop-demo-v1';

function demoContent() {
  try {
    const parsed = contentSchema.safeParse(JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch { /* the sample's words */ }
  return freshContent();
}
const failed = (e) => new Error(e?.status === 'finalized' || e?.status === 'expired' ? 'This link can no longer be edited.' : 'Couldn’t save. Check your internet and try again.');

export function openCardEditor({ mode, id }) {
  const demo = mode === 'demo';
  let until = 0, last = demo ? demoContent() : freshContent();
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
      if (demo) { last = demoContent(); return { content: forEditing(last), canEdit: true }; }
      const { share } = await api(`/shares/${id}`);
      last = contentSchema.parse(share.content);
      until = share.editUntil;
      return { content: forEditing(last), canEdit: canEdit('real', share.finalized, share.editUntil, Date.now()), finished: share.finalized };
    },
    save: async (content, { finish } = {}) => {
      const next = contentSchema.parse(forSaving(content, last, (v) => Boolean(youtubeId(v))));
      if (demo) { localStorage.setItem(DEMO_KEY, JSON.stringify(next)); last = next; return; }
      try {
        const { share } = await api(`/shares/${id}`, 'PUT', next);
        last = next;
        until = share.editUntil;
        if (finish) await api(`/shares/${id}/finalize`, 'POST');
      } catch (e) { throw failed(e); }
    },
    mediaURL: (name) => name,
    ytCheck: `${apiBase}/yt-check`,
    canFinish: !demo,
    shareUrl: demo ? '' : link.href,
    deadlineText: () => (demo ? 'This is a demo: what you write is kept on this device only.'
      : until ? `You can edit this link until ${new Date(until).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''),
    done: () => location.reload(),
  });
}

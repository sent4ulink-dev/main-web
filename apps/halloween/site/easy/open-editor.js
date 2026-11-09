// A link and the demo are edited through the step-by-step editor, with the card itself running live beside the words
// (live-preview.js loads this page again with ?embed=1; easy/embed.js is what runs in there). The studio keeps editing
// in place (inline-editor.js).
import { openEasyEditor, saveKeepingLatest } from './easy-editor.js';
import { LivePreview } from './live-preview.js';
import { steps, title, forEditing, forSaving } from './easy-steps.js';
import { defaultPlan } from '../plan-core.js';
import { API_BASE } from '../config.js';

export function openCardEditor({ editor, repository, pause }) {
  const kind = repository.mode.kind;
  let revision = editor.revision, deadline = editor.editingDeadline;
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
      const d = await repository.load();
      revision = d.revision;
      deadline = d.editingDeadline ?? deadline;
      return { ...d, content: forEditing(d.content) };
    },
    save: saveKeepingLatest({
      save: (content, rev, { finish } = {}) => repository.save(forSaving(content, { plan: defaultPlan }), rev, finish),
      latest: () => repository.load(),
      getRevision: () => revision,
      setRevision: (r) => { revision = r; },
    }),
    mediaURL: (name) => name,
    ytCheck: `${API_BASE}/api/yt-check`,
    canFinish: kind === 'invitation',
    shareUrl: kind === 'invitation' ? link.href : '',
    deadlineText: () => (kind === 'invitation' && deadline ? `You can edit this link until ${new Date(deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`
      : kind === 'test' ? 'This is a demo: what you write is kept on this device only.' : ''),
    // (the game's timers stop while the editor is open; nothing is left to save on the page itself)
    onOpen: () => { pause(); editor.dirty = false; },
    done: () => location.reload(),
  });
}

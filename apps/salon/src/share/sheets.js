// Two small windows for the walkman, opened from its buttons in the scene (same look as the photo window):
//   openYouTube — paste a YouTube link for the background music (a thumbnail confirms it's right)
//   openVoice   — record a voice message (max 30 s): one big button, listen back, record again
import { parseYouTube } from '../core/youtube.js';
import { VoiceRecorder, VOICE_SECONDS } from './media.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (s) => `0:${String(Math.floor(s)).padStart(2, '0')}`;

function sheet(html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'crop-dialog sheet-dialog';
  dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

/** Resolves with the new link ('' removes it) or null (cancelled). */
export function openYouTube(current = '') {
  const dlg = sheet(`
    <p class="crop-title">🎵 Background music</p>
    <p class="sheet-text">Open your song on YouTube, tap "Share" → "Copy link", then paste it here.</p>
    <div class="yt-row"><input class="yt-input" type="url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…" value="${esc(current)}" aria-label="YouTube link"><button type="button" data-a="paste">📋 Paste</button></div>
    <div class="yt-preview"><img alt=""><span class="yt-note"></span></div>
    <div class="crop-actions">
      ${current ? '<button type="button" data-a="remove" class="crop-quiet">Remove</button>' : ''}
      <button type="button" data-a="cancel">Cancel</button>
      <button type="button" data-a="save" class="crop-main">Save</button>
    </div>`);
  const input = dlg.querySelector('.yt-input'), img = dlg.querySelector('.yt-preview img'), note = dlg.querySelector('.yt-note'), save = dlg.querySelector('[data-a="save"]');
  const check = () => {
    const v = input.value.trim(), song = parseYouTube(v);
    dlg.classList.toggle('yt-ok', !!song);
    if (song) img.src = `https://i.ytimg.com/vi/${song.id}/mqdefault.jpg`;
    note.textContent = !v ? '' : song ? '✓ This song will play' : 'This is not a YouTube link';
    save.disabled = !!v && !song;
  };
  input.addEventListener('input', check);
  check();
  return new Promise((resolve) => {
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') done(null);
      else if (a === 'remove') done('');
      else if (a === 'save') done(input.value.trim());
      else if (a === 'paste') { try { input.value = (await navigator.clipboard.readText()).trim(); check(); } catch { input.focus(); } }
    });
  });
}

/** Resolves with { blob } (new recording), { remove: true }, or null (cancelled). */
export function openVoice(currentURL = '') {
  const dlg = sheet(`
    <p class="crop-title">🎙 Voice greeting</p>
    <p class="sheet-text">Press the button and speak — it stops by itself after ${VOICE_SECONDS} seconds.</p>
    <button type="button" class="rec-btn" data-a="rec" aria-label="Record"><svg viewBox="0 0 120 120"><circle class="rec-track" cx="60" cy="60" r="54"/><circle class="rec-bar" cx="60" cy="60" r="54"/></svg><span class="rec-dot"></span></button>
    <p class="rec-time">${currentURL ? 'Recording saved' : `0:00 / ${time(VOICE_SECONDS)}`}</p>
    <div class="crop-actions rec-listen">
      <button type="button" data-a="play" ${currentURL ? '' : 'hidden'}>▶ Listen</button>
    </div>
    <div class="crop-actions">
      ${currentURL ? '<button type="button" data-a="remove" class="crop-quiet">Remove</button>' : ''}
      <button type="button" data-a="cancel">Cancel</button>
      <button type="button" data-a="save" class="crop-main" disabled>Save</button>
    </div>`);
  const btn = dlg.querySelector('.rec-btn'), bar = dlg.querySelector('.rec-bar'), label = dlg.querySelector('.rec-time');
  const play = dlg.querySelector('[data-a="play"]'), save = dlg.querySelector('[data-a="save"]');
  const C = 2 * Math.PI * 54;
  bar.style.strokeDasharray = C; bar.style.strokeDashoffset = C;
  let rec = null, blob = null, audio = null, url = currentURL;
  const stopAudio = () => { audio?.pause(); audio = null; play.textContent = '▶ Listen'; };
  return new Promise((resolve) => {
    const done = (v) => { rec?.stop(); stopAudio(); dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') return done(null);
      if (a === 'remove') return done({ remove: true });
      if (a === 'save') return done(blob ? { blob } : null);
      if (a === 'play') {
        if (audio) return stopAudio();
        audio = new Audio(url); audio.onended = stopAudio; play.textContent = '■ Stop';
        audio.play().catch(stopAudio);
        return;
      }
      if (a === 'rec') {
        if (rec) { rec.stop(); return; }
        stopAudio();
        rec = new VoiceRecorder();
        dlg.classList.add('recording'); play.hidden = true; save.disabled = true;
        let got = null;
        try {
          got = await rec.start((s) => { label.textContent = `${time(s)} / ${time(VOICE_SECONDS)}`; bar.style.strokeDashoffset = C * (1 - s / VOICE_SECONDS); });
        } catch { label.textContent = 'Microphone unavailable.'; }
        rec = null; dlg.classList.remove('recording'); bar.style.strokeDashoffset = C;
        if (got) { blob = got; url = URL.createObjectURL(got); play.hidden = false; save.disabled = false; label.textContent = '✓ Recorded — listen, then save'; }
      }
    });
  });
}

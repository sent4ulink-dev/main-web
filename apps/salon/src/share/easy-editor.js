// sent4u's step-by-step editor: a form of real text boxes, one step at a time, beside the card itself running live
// (live-preview.js), which shows whatever is typed at once. No framework and no build step: the card gives it its
// steps and a few functions (see openEasyEditor). Each card keeps its own copy of this file.

const STYLE = `
.ez,.ez *{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
.ez{--ez-bg:#12110f;--ez-card:#1b1a16;--ez-ink:#f3efe7;--ez-soft:#a9a397;--ez-line:rgba(243,239,231,.17);--ez-acc:#e4572e;--ez-acc-soft:rgba(228,87,46,.18);--ez-ok:#5fc998;--ez-warn:#ff9270;--ez-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;--ez-serif:"Cormorant Garamond",Georgia,"Times New Roman",serif;
  position:fixed;left:0;top:0;right:0;height:var(--ez-vh,100dvh);z-index:2147483000;display:flex;flex-direction:column;background:var(--ez-bg);color:var(--ez-ink);color-scheme:dark;
  font:15px/1.45 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;text-align:left;-webkit-font-smoothing:antialiased;-webkit-user-select:text;user-select:text;touch-action:manipulation;pointer-events:auto}
.ez button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.ez-top{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top))}
.ez-brand{font-family:var(--ez-serif);font-style:italic;font-weight:600;font-size:20px;line-height:1.1;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ez-status{flex:none;font-family:var(--ez-mono);font-size:11px;color:var(--ez-soft);white-space:nowrap}
.ez-status.ok{color:var(--ez-ok)}.ez-status.bad{color:var(--ez-warn);font-weight:600}
.ez-x{flex:none;width:32px;height:32px;border-radius:3px;border:1px solid var(--ez-line)!important;font-size:14px;line-height:1}
.ez-steps{flex:none;display:flex;overflow-x:auto;padding:0 8px;border-bottom:1px solid var(--ez-line);scrollbar-width:none}
.ez-steps::-webkit-scrollbar{display:none}
.ez-pill{flex:none;display:flex;align-items:baseline;gap:5px;padding:9px 8px 8px;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-soft);white-space:nowrap;border-bottom:2px solid transparent!important;margin-bottom:-1px}
.ez-pill i{font-style:normal;font-size:10.5px;opacity:.75}
.ez-pill.on{color:var(--ez-ink);border-bottom-color:var(--ez-acc)!important}.ez-pill.on i{color:var(--ez-acc);opacity:1}
.ez-pill.done i{color:var(--ez-acc);opacity:1}
.ez-main{flex:1;min-height:0;display:flex;flex-direction:column}
.ez-scroll{flex:1 1 56%;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px 16px 20px}
.ez-in{max-width:620px;margin:0 auto}
.ez-title{font-family:var(--ez-serif);font-style:italic;font-size:31px;line-height:1.08;font-weight:600;margin-bottom:5px}
.ez-hint{color:var(--ez-soft);font-size:14px;margin-bottom:6px}
.ez-card{border-top:1px solid var(--ez-line);padding-top:13px;margin-top:15px}
.ez-card h4{font-size:15px;font-weight:600}.ez-card>p{color:var(--ez-soft);font-size:13px;margin-top:1px}
.ez-f{margin-top:13px}.ez-card>.ez-f:first-child{margin-top:0}
.ez-l{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-ink);margin-bottom:6px}
.ez-l small{font-weight:400;font-size:10.5px;color:var(--ez-soft);flex:none}.ez-l small.over{color:var(--ez-warn);font-weight:600}
.ez input[type=text],.ez input[type=url],.ez input[type=date],.ez input[type=time],.ez textarea,.ez select{width:100%;display:block;border:1px solid var(--ez-line);border-radius:3px;background:var(--ez-card);color:var(--ez-ink);padding:11px 12px;font-size:16px;line-height:1.35;font-family:inherit;outline:none;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text}
.ez input::placeholder,.ez textarea::placeholder{color:#7d786d}
.ez input:focus,.ez textarea:focus,.ez select:focus{border-color:var(--ez-acc);box-shadow:inset 0 0 0 1px var(--ez-acc)}
.ez textarea{min-height:84px;resize:vertical}
.ez-help{font-size:12.5px;color:var(--ez-soft);margin-top:5px}.ez-help.ok{color:var(--ez-ok)}.ez-help.bad{color:var(--ez-warn);font-weight:500}
.ez-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ez-tpl{display:flex;flex-direction:column;gap:8px}.ez .ez-tpl textarea{min-height:0;resize:none;overflow:hidden}
.ez-tpl.inline{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px}.ez .ez-tpl.inline input[type=text]{flex:1 1 96px;width:auto;min-width:0}
.ez-lock{padding:9px 12px 11px;border:1px dashed var(--ez-line);border-radius:3px;background:rgba(243,239,231,.04);color:var(--ez-soft);font-size:14px;line-height:1.85;white-space:pre-wrap;-webkit-user-select:none;user-select:none}
.ez-lock-note{display:flex;align-items:center;gap:5px;font-family:var(--ez-mono);font-size:10.5px;line-height:1.5;color:var(--ez-soft);margin-bottom:3px;white-space:normal}.ez-lock-note svg{width:10px;height:10px;flex:none}
.ez-tk{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:1px 7px;border-radius:3px;background:var(--ez-acc-soft);color:var(--ez-ink);font-size:13px;font-weight:500;line-height:1.55;vertical-align:baseline;-webkit-user-select:none;user-select:none}
.ez-tk svg{width:10px;height:10px;flex:none;opacity:.8}.ez-tk span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ez-tpl.inline .ez-tk{padding:11px 10px;font-size:14px}
.ez-tpl-add{align-self:flex-start;padding:8px 10px;border:1px dashed var(--ez-line)!important;border-radius:3px;color:var(--ez-soft)!important;font-size:12.5px;line-height:1.25}.ez-tpl.inline .ez-tpl-add{align-self:center;padding:11px 13px}
.ez-tpl-back{flex:0 0 100%}
.ez-chip{padding:6px 9px;border-radius:3px;border:1px solid var(--ez-line)!important;color:var(--ez-soft)!important;font-size:12.5px;line-height:1.25;text-align:left}
.ez-chip.on{background:var(--ez-acc-soft)!important;border-color:var(--ez-acc)!important;color:var(--ez-ink)!important;font-weight:600}
.ez-choice{display:flex;flex-wrap:wrap;gap:8px}.ez-choice .ez-chip{padding:9px 13px;font-size:14px}
.ez-more{margin-top:13px;border-top:1px dashed var(--ez-line);padding-top:11px}.ez-more summary{cursor:pointer;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-soft)}
.ez-photo{position:relative;display:block;width:100%;aspect-ratio:16/10;max-height:230px;border:1px dashed rgba(243,239,231,.38);border-radius:3px;background:var(--ez-card) center/contain no-repeat;overflow:hidden;cursor:pointer}
.ez-photo.has{border-style:solid;border-color:var(--ez-line)}
.ez-photo input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:0}
.ez-photo span{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-family:var(--ez-mono);font-size:12px;font-weight:500;color:var(--ez-soft);pointer-events:none;text-align:center;padding:8px}
.ez-photo span b{font-size:24px;line-height:1;font-weight:400;color:var(--ez-acc)}.ez-photo.has span{display:none}
.ez-photo.busy span{display:flex;background:rgba(18,17,15,.78)}
.ez-fit{position:absolute;left:7px;top:7px;height:30px;padding:0 10px;border-radius:3px;background:rgba(18,17,15,.82)!important;color:#fff!important;font-size:12.5px;font-weight:600;z-index:2}
.ez-rm{position:absolute;right:7px;top:7px;width:30px;height:30px;border-radius:3px;background:rgba(18,17,15,.82)!important;color:#fff!important;font-size:13px;z-index:2}
.ez-yt{display:flex;gap:9px;align-items:center;margin-top:8px;padding:7px;border-radius:3px;background:var(--ez-card)}
.ez-yt img{width:68px;height:38px;border-radius:2px;object-fit:cover;flex:none;background:#333}.ez-yt b{font-size:12.5px;line-height:1.25;font-weight:500;display:block}
.ez-rec{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ez-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:9px 16px;border-radius:3px;font-weight:600!important;border:1px solid var(--ez-line)!important}
.ez-btn.main{background:var(--ez-acc)!important;border-color:var(--ez-acc)!important;color:#12110f!important}
.ez-btn.dark{background:var(--ez-ink)!important;border-color:var(--ez-ink)!important;color:#12110f!important}
.ez-btn:disabled{opacity:.5}
.ez-rec audio{height:38px;max-width:100%;flex:1 1 180px}
.ez-dock{flex:0 0 48%;min-height:0;display:flex;flex-direction:column;background:#0a0a08;border-top:1px solid var(--ez-line);padding:7px 10px 8px}
.ez-dock-l{flex:none;display:flex;align-items:center;gap:10px;color:var(--ez-soft);font-family:var(--ez-mono);font-size:10.5px;font-weight:500;margin-bottom:6px}
.ez-dock-l>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ez-dock-l>span::before{content:"";display:inline-block;width:6px;height:6px;margin-right:6px;background:var(--ez-acc);vertical-align:1px;animation:ez-rec 1.6s ease-in-out infinite}
@keyframes ez-rec{50%{opacity:.25}}
.ez-dock-l button{color:var(--ez-soft);font-family:var(--ez-mono);font-size:10.5px;font-weight:500}
.ez-dock-l [data-big]{text-decoration:underline;text-underline-offset:2px}
.ez-dev{display:flex;border:1px solid var(--ez-line);border-radius:3px;overflow:hidden}
.ez-dev button{padding:3px 8px}.ez-dev button.on{background:var(--ez-acc-soft);color:var(--ez-ink)}
.ez-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center}
.ez-live{position:relative;overflow:hidden;border-radius:3px;background:#000;flex:none}
.ez-live iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;pointer-events:none;background:#000}
.ez-live-wait{position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;color:var(--ez-soft);font-family:var(--ez-mono);font-size:11.5px;background:#0a0a08;transition:opacity .5s}
.ez-live.ready .ez-live-wait{opacity:0;pointer-events:none}
.ez-shot{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#0a0a08}
.ez-shot.on{display:flex}.ez-shot img{max-width:100%;max-height:100%;border-radius:3px;display:block}
.ez-dock.big{position:fixed;inset:0;z-index:5;flex:none;padding:12px;padding-top:max(12px,env(safe-area-inset-top))}
.ez-nav{flex:none;display:flex;gap:9px;padding:9px 12px;padding-bottom:max(9px,env(safe-area-inset-bottom));border-top:1px solid var(--ez-line)}
.ez-nav .ez-btn{flex:1}.ez-nav .back{flex:0 0 34%}
.ez.kb .ez-steps,.ez.kb .ez-nav,.ez.kb .ez-title,.ez.kb .ez-hint{display:none}
.ez.kb .ez-top{padding-top:6px;padding-bottom:6px}.ez.kb .ez-scroll{padding-top:8px}.ez.kb .ez-card:first-of-type{border-top:0;margin-top:0;padding-top:0}
.ez-end{display:flex;flex-direction:column;gap:9px;margin-top:13px}
.ez-copy{display:flex;gap:7px;margin-top:8px}.ez-copy input{flex:1;font-size:13px!important;padding:9px 10px!important;min-width:0}
.ez-sheet{position:fixed;inset:0;z-index:6;display:grid;place-items:center;background:rgba(0,0,0,.66);padding:20px}
.ez-sheet>div{background:var(--ez-card);border:1px solid var(--ez-line);border-radius:3px;padding:18px;max-width:380px;width:100%}.ez-sheet h4{font-family:var(--ez-serif);font-style:italic;font-size:24px;line-height:1.1;font-weight:600;margin-bottom:7px}.ez-sheet p{color:var(--ez-soft);margin-bottom:13px;font-size:14px}.ez-sheet .ez-end{margin-top:0}
.ez-loading{flex:1;display:grid;place-items:center;color:var(--ez-soft);font-family:var(--ez-mono);font-size:13px;text-align:center;padding:24px}
@media (min-width:900px){
  .ez-main{flex-direction:row}.ez-scroll{flex:1 1 42%;padding:26px}.ez-dock{flex:0 0 58%;border-top:0;border-left:1px solid var(--ez-line);padding:14px}
  .ez-steps{padding:0 14px}.ez-title{font-size:38px}
  .ez-nav{justify-content:center}.ez-nav .ez-btn{flex:0 1 240px}.ez-nav .back{flex:0 1 160px}
}
`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A text with parts that fill themselves in ({name}, {date}...). Those parts can't be typed over or deleted:
// only the words around them are boxes. A short word between two of them (“at”) stays with the locked part.
const LOCK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 1a3 3 0 0 0-3 3v1.2H2.4a.9.9 0 0 0-.9.9v3.9c0 .5.4.9.9.9h7.2c.5 0 .9-.4.9-.9V6.1a.9.9 0 0 0-.9-.9H9V4a3 3 0 0 0-3-3Zm1.8 4.2H4.2V4a1.8 1.8 0 0 1 3.6 0v1.2Z"/></svg>';
const tokenSplit = (f) => new RegExp(`(\\{(?:${Object.keys(f.tokens).join('|')})\\})`);
export function templateParts(value, f) {
  const bits = String(value ?? '').split(tokenSplit(f)), parts = [bits[0]], sep = f.rows ? '\n\n' : ' ';
  for (let k = 1; k < bits.length; k += 2) {
    const between = parts[parts.length - 1];
    if (parts.length > 1 && between.trim().length <= 10) { parts.pop(); parts[parts.length - 1].raw += between + bits[k]; }
    else parts.push({ raw: bits[k] });
    parts.push(bits[k + 1]);
  }
  return parts.map((p, k) => {
    if (typeof p !== 'string') return p;
    const [, pre, word, post] = /^(\s*)([\s\S]*?)(\s*)$/.exec(p), first = k === 0, last = k === parts.length - 1;
    if (!word) return { pre: first ? '' : pre || sep, word, post: last ? '' : post || sep, keep: p };
    return { pre, word, post, gap: first || last ? '' : (pre.length >= post.length ? pre : post) || sep };
  });
}
export const templateText = (parts) => parts.map((p) => p.raw ?? (p.word.trim() ? p.pre + p.word + p.post : p.keep ?? p.gap ?? '')).join('');
export function templateRestore(value, t, f) {
  const s = String(value ?? ''), names = Object.keys(f.tokens), at = names.indexOf(t), has = (x) => s.includes(`{${x}}`);
  if (!f.rows) return `{${t}} ${s}`.trim();
  if (!f.tokens[t].end) {
    const prev = names.slice(0, at).reverse().find(has), next = names.slice(at + 1).find(has);
    if (prev) return s.replace(`{${prev}}`, `{${prev}}\n{${t}}`);
    if (next) return s.replace(`{${next}}`, `{${t}}\n{${next}}`);
  }
  return `${s.trimEnd()}\n\n{${t}}`.trim();
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const getPath = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const keys = String(p).split('.'), last = keys.pop();
  const t = keys.reduce((a, k) => { if (a[k] == null) a[k] = /^\d+$/.test(k) ? [] : {}; return a[k]; }, o);
  t[last] = v;
}
const youtubeId = (text) => {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`), h = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    let id = null;
    if (h === 'youtu.be') id = u.pathname.split('/')[1];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      const [, a, b] = u.pathname.split('/');
      id = a === 'watch' ? u.searchParams.get('v') : ['shorts', 'embed', 'live', 'v'].includes(a) ? b : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
};

/** A picked picture, at most `max` px on its longer side, as WebP (JPEG where the browser can't write WebP, e.g. Safari). */
export async function shrinkImage(file, { max = 1280, quality = 0.82 } = {}) {
  const decode = async (blob) => {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* older Safari */ }
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = URL.createObjectURL(blob); });
  };
  let src;
  try { src = await decode(file); } catch {
    // an iPhone/Mac HEIC photo in a browser that can't read it: converted here, only when it is needed
    if (!/hei[cf]/i.test(`${file.type} ${file.name}`)) throw new Error('Couldn’t read that picture. Please choose a JPG or PNG.');
    try {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
      src = await decode(await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }));
    } catch { throw new Error('Couldn’t convert that HEIC picture. Please choose a JPG or PNG.'); }
  }
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); src.close?.();
  const encode = (type, q) => new Promise((res) => c.toBlob(res, type, q));
  let blob = await encode('image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', quality);
  // the card servers take at most about 700 KB per picture
  for (let q = quality - 0.14; blob && blob.size > 650e3 && q > 0.3; q -= 0.14) blob = await encode(blob.type, q);
  if (!blob) throw new Error('Couldn’t convert the picture.');
  return blob;
}

export const VOICE_SECONDS = 30;
const VOICE_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
/**
 * One voice message, made clear: the browser's own noise and echo cleaning, then a low cut for rumble and hum, a
 * gentle lift for the voice, levelling, and a gate that quiets the room between words. Recorded at 64 kbps, not 24.
 */
export class CleanRecorder {
  async start(onTick) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    let input = this.stream;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext, ctx = this.ctx = new Ctx();
      await ctx.resume();
      const src = ctx.createMediaStreamSource(this.stream);
      const filter = (type, freq, q, gain = 0) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.gain.value = gain; return f; };
      const low = filter('highpass', 90, 0.8), clarity = filter('peaking', 3000, 0.9, 2.5), air = filter('lowpass', 11500, 0.7);
      const gate = ctx.createGain(), comp = ctx.createDynamicsCompressor(), lift = ctx.createGain(), dest = ctx.createMediaStreamDestination();
      comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2; lift.gain.value = 1.5;
      const meter = ctx.createAnalyser(); meter.fftSize = 1024;
      src.connect(low); low.connect(clarity); clarity.connect(air); air.connect(gate); gate.connect(comp); comp.connect(lift); lift.connect(dest); air.connect(meter);
      const buf = new Float32Array(meter.fftSize); let floor = 0.004, last = 0;
      this.gateTimer = setInterval(() => {
        meter.getFloatTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length), now = ctx.currentTime;
        floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 1.002;   // follows the room's quiet level
        if (rms > Math.max(floor * 2.6, 0.006)) last = now;
        gate.gain.setTargetAtTime(now - last < 0.28 ? 1 : 0.14, now, now - last < 0.28 ? 0.008 : 0.09);
      }, 25);
      input = dest.stream;
    } catch { input = this.stream; }
    const mimeType = VOICE_TYPES.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    this.rec = new MediaRecorder(input, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
    const chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.done = new Promise((resolve) => {
      this.rec.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        clearInterval(this.tick); clearInterval(this.gateTimer); this.ctx?.close?.();
        const type = (this.rec.mimeType || mimeType || 'audio/webm').split(';')[0];
        resolve(chunks.length ? new Blob(chunks, { type }) : null);
      };
    });
    this.started = performance.now();
    this.rec.start(1000);
    this.tick = setInterval(() => {
      const s = (performance.now() - this.started) / 1000;
      onTick?.(Math.min(VOICE_SECONDS, s));
      if (s >= VOICE_SECONDS) this.stop();
    }, 200);
    return this.done;
  }
  stop() { if (this.rec?.state === 'recording') this.rec.stop(); }
}

/**
 * Opens the editor over the card.
 *   title                 the card's name
 *   live                  a LivePreview (live-preview.js): the card itself, running, beside the form
 *   steps                 [{ id, pill, title, hint, cards: [{ title, hint, fields: [...], more: [...] }], preview | previews }]
 *   load()                → { content, canEdit, finished } fresh from wherever the card keeps it
 *   save(content, { finish }) resolves when stored (a conflict is the card's to settle; see saveKeepingLatest)
 *   upload(blob)          → the name to keep in the content (pictures and the voice message)
 *   mediaURL(name)        → where that name can be fetched from
 *   canFinish             offer "finish for good" (not on test links)
 *   shareUrl              the link shown on the last step
 *   ytCheck               where a YouTube id is checked (default: the card's own /api/yt-check)
 * Fields: { type: 'text'|'textarea'|'template'|'date'|'time'|'choice'|'photo'|'youtube'|'voice', path or get/set, label, max,
 *           hint, placeholder, suggest: [...], options: [{value,label}], tokens, captionPath, pv (which preview), slot (which photo) }
 * Preview: { scene, sub, slots (show the focused photo's slot), crop: { x, y, w, h } (% of a phone screen, for a small dock) }
 *        | { picture(content) → Blob } (a picture drawn from the words, shown over the card)
 * Closes with cfg.done(saved): the card reloads, so it shows the new words.
 */
export function openEasyEditor(cfg) {
  if (document.querySelector('.ez')) return;
  if (!document.getElementById('ez-style')) { const s = document.createElement('style'); s.id = 'ez-style'; s.textContent = STYLE + (cfg.css || ''); document.head.append(s); const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,600&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap'; document.head.append(f); }
  const root = document.createElement('div');
  root.className = 'ez'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Edit the card');
  root.innerHTML = `<div class="ez-top"><b class="ez-brand">${esc(cfg.title)}</b><span class="ez-status" role="status"></span><button type="button" class="ez-x" aria-label="Close">✕</button></div><div class="ez-loading">Loading…</div>`;
  document.body.append(root);
  cfg.onOpen?.();
  // what happens in here stays in here: the card's own key and touch controls don't see it
  for (const type of ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'wheel', 'paste', 'input']) root.addEventListener(type, (e) => e.stopPropagation());
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const $ = (s) => root.querySelector(s);
  const statusEl = $('.ez-status');
  const status = (text, cls = '') => { statusEl.textContent = text; statusEl.className = `ez-status ${cls}`; };

  // the on-screen keyboard shrinks the visible page: the editor follows it, and the preview stays above the keyboard
  const vv = window.visualViewport;
  const fit = () => {
    const h = vv ? vv.height : innerHeight;
    root.style.setProperty('--ez-vh', `${h}px`);
    root.style.top = vv ? `${vv.offsetTop}px` : '0';
    root.classList.toggle('kb', h < screen.height * 0.62 && innerWidth < 900 && /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || ''));
    drawAll();
  };

  let content = null, stepIndex = 0, activeSlot = 0, activePv = 0, dirty = false, saved = false, saving = null, again = false, timer = 0, closed = false;
  const step = () => cfg.steps[stepIndex];
  const previewOf = (s = step()) => (s.previews ? s.previews[activePv] || s.previews[0] : s.preview);
  const read = (f) => (f.get ? f.get(content) : getPath(content, f.path));
  const write = (f, v) => { if (f.set) f.set(content, v); else setPath(content, f.path, v); };

  // ── saving: quietly after each pause in typing, at once after a file ──
  const changed = () => { dirty = true; status('Not saved yet…'); clearTimeout(timer); timer = setTimeout(saveNow, 1400); };
  async function saveNow(finish = false) {
    clearTimeout(timer);
    if (saving) { again = true; return saving; }
    if (!dirty && !finish) return true;
    status('Saving…'); dirty = false;
    saving = (async () => {
      try { await cfg.save(clone(content), { finish }); saved = true; status('Saved ✓', 'ok'); return true; }
      catch (e) { dirty = true; status(`Couldn’t save: ${e.message || 'connection problem'}`, 'bad'); clearTimeout(timer); timer = setTimeout(saveNow, 8000); return false; }
      finally { saving = null; if (again) { again = false; if (dirty) saveNow(); } }
    })();
    return saving;
  }
  addEventListener('beforeunload', guard);
  function guard(e) { if (dirty && !closed) { e.preventDefault(); e.returnValue = ''; } }

  async function close() {
    if (dirty && !await saveNow()) { if (!confirm('Your last changes aren’t saved. Close anyway?')) return; dirty = false; }
    if (saving) await saving;
    closed = true;
    removeEventListener('beforeunload', guard);
    vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit);
    cfg.live?.dispose();
    root.remove();
    document.documentElement.style.overflow = prevOverflow;
    (cfg.done || (() => { if (saved) location.reload(); }))(saved);
  }
  $('.ez-x').onclick = close;

  // ── the preview: the card itself, running live, at the part this step is about (or a picture drawn from the words) ──
  let tokenViews = [];
  let shotTimer = 0, shotN = 0, shotURL = '';
  function showPreview() {
    const p = previewOf(), live = cfg.live, dock = $('.ez-dock');
    if (!dock || !live) return;
    dock.style.display = p ? '' : 'none';
    if (!p) return;
    if (p.scene) live.show(p.scene, p.slots ? activeSlot : p.sub ?? null);
    $('.ez-shot').classList.toggle('on', !!p.picture);
    if (p.picture) paintPicture(p);
    layoutPreview();
  }
  function layoutPreview() {
    const stage = $('.ez-stage'); if (!stage || !cfg.live) return;
    const p = previewOf();
    cfg.live.fit(stage.clientWidth, stage.clientHeight, { crop: $('.ez-dock').classList.contains('big') ? null : p?.crop });
  }
  // a picture drawn from the words (the saved picture), redrawn a moment after typing stops
  function paintPicture(p) {
    clearTimeout(shotTimer);
    const img = $('.ez-shot img'), shown = !!img.getAttribute('src');
    shotTimer = setTimeout(async () => {
      const n = ++shotN;
      let blob = null;
      try { blob = await p.picture(content); } catch (e) { console.warn('preview', e); }
      if (!blob || n !== shotN || !previewOf()?.picture) return;
      if (shotURL) URL.revokeObjectURL(shotURL);
      shotURL = URL.createObjectURL(blob); img.src = shotURL;
    }, shown ? 600 : 1800);   // (the first time, the scene gets a moment to arrive)
  }
  // what is typed reaches the card a moment after typing pauses
  const typed = () => { tokenViews.forEach((v) => v()); cfg.live?.update(content); if (previewOf()?.picture) paintPicture(previewOf()); };
  const drawAll = () => { if (content) layoutPreview(); };

  // ── fields ──
  const count = (el, f, v) => { if (el) { el.textContent = f.max ? `${[...String(v)].length} / ${f.max}` : ''; } };
  function fieldHTML(f, key) {
    const label = f.label ? `<label class="ez-l" for="ez-${key}"><span>${esc(f.label)}</span><small data-n="${key}"></small></label>` : '';
    const help = f.hint ? `<p class="ez-help">${esc(f.hint)}</p>` : '';
    const chips = f.suggest ? `<div class="ez-chips">${f.suggest.map((t, i) => `<button type="button" class="ez-chip" data-sg="${key}:${i}">${esc(t)}</button>`).join('')}</div>` : '';
    switch (f.type) {
      case 'textarea': return `<div class="ez-f">${label}<textarea id="ez-${key}" data-f="${key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}"></textarea>${help}${chips}</div>`;
      case 'template': return `<div class="ez-f">${label}<div class="ez-tpl${f.rows ? '' : ' inline'}" data-tpl="${key}"></div>${help}</div>`;
      case 'date': case 'time': return `<div class="ez-f">${label}<input id="ez-${key}" data-f="${key}" type="${f.type}">${help}</div>`;
      case 'choice': return `<div class="ez-f">${label}<div class="ez-choice">${f.options.map((o) => `<button type="button" class="ez-chip" data-ch="${key}" data-v="${esc(o.value)}">${esc(o.label)}</button>`).join('')}</div>${help}</div>`;
      case 'photo': return `<div class="ez-f">${label}<label class="ez-photo" data-ph="${key}"><input type="file" accept="image/*" aria-label="${esc(f.label || 'Photo')}"><span><b>＋</b>Add a photo</span></label>${f.captionPath ? `<div class="ez-f" style="margin-top:7px"><label class="ez-l" for="ez-${key}c"><span>${esc(f.captionLabel || 'Words under the photo')}</span><small data-n="${key}c"></small></label><input id="ez-${key}c" data-cap="${key}" type="text" placeholder="${esc(f.captionPlaceholder || 'For example: Our first trip')}"></div>` : ''}${help}</div>`;
      case 'youtube': return `<div class="ez-f">${label}<input id="ez-${key}" data-yt="${key}" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://youtu.be/…"><div data-ytr="${key}"></div>${help}</div>`;
      case 'voice': return `<div class="ez-f">${label}<div class="ez-rec" data-v="${key}"></div>${help}</div>`;
      default: return `<div class="ez-f">${label}<input id="ez-${key}" data-f="${key}" type="text" placeholder="${esc(f.placeholder || '')}" autocomplete="off">${help}${chips}</div>`;
    }
  }

  // YouTube: the owner may have closed a song to other sites, so a link is checked as soon as it is pasted
  const ytChecked = new Map();
  async function checkYouTube(id) {
    if (ytChecked.has(id)) return ytChecked.get(id);
    let out = { ok: true };
    try { const r = await fetch(`${cfg.ytCheck || '/api/yt-check'}/${id}`); if (r.ok) out = await r.json(); } catch { /* can't tell: don't stop them */ }
    ytChecked.set(id, out);
    return out;
  }
  async function showYouTube(box, value) {
    const id = youtubeId(value);
    if (!String(value || '').trim()) { box.innerHTML = ''; return; }
    if (!id) { box.innerHTML = '<p class="ez-help bad">That isn’t a YouTube link. For example: https://youtu.be/abc123</p>'; return; }
    box.innerHTML = '<p class="ez-help">Checking…</p>';
    const r = await checkYouTube(id);
    if (r.ok) box.innerHTML = `<div class="ez-yt"><img alt="" src="https://i.ytimg.com/vi/${id}/mqdefault.jpg"><div><b>${esc(r.title || 'YouTube song')}</b><span class="ez-help ok">✓ It can play</span></div></div>`;
    else box.innerHTML = `<p class="ez-help bad">${r.reason === 'missing' ? 'This video can’t be found or is private. Please paste another link.' : 'The owner of this song doesn’t let it play on other sites. Please paste another link (a “lyrics” or “cover” version usually works).'}</p>`;
  }

  function mountVoice(box, f) {
    let rec = null;
    const draw = (msg = '') => {
      const cur = read(f);
      box.innerHTML = rec
        ? `<button type="button" class="ez-btn main" data-do="stop">■ Stop</button><span class="ez-help" data-t>0 s / ${VOICE_SECONDS} s</span>`
        : `${cur ? `<audio controls preload="metadata" src="${esc(cfg.mediaURL(cur))}"></audio>` : ''}<button type="button" class="ez-btn ${cur ? '' : 'dark'}" data-do="rec">🎙 ${cur ? 'Record again' : 'Record your voice'}</button>${cur ? '<button type="button" class="ez-btn" data-do="del">Remove</button>' : ''}${msg ? `<p class="ez-help bad" style="width:100%">${esc(msg)}</p>` : ''}`;
    };
    box.onclick = async (e) => {
      const act = e.target.closest('[data-do]')?.dataset.do; if (!act) return;
      if (act === 'stop') return rec?.stop();
      if (act === 'del') { write(f, ''); dirty = true; draw(); typed(); return saveNow(); }
      const r = new CleanRecorder(); rec = r; draw();
      let blob;
      try { blob = await r.start((s) => { const t = box.querySelector('[data-t]'); if (t) t.textContent = `${Math.round(s)} s / ${VOICE_SECONDS} s`; }); }
      catch { rec = null; return draw('The microphone can’t be used. Please allow it in your browser’s settings.'); }
      rec = null; draw();
      if (!blob) return;
      status('Saving…');
      try { write(f, await cfg.upload(blob)); dirty = true; draw(); typed(); await saveNow(); }
      catch (err) { status(''); draw(err.message || 'Couldn’t save.'); }
    };
    draw();
  }

  function focusField(f) {
    let moved = false;
    if (f.pv != null && f.pv !== activePv) { activePv = f.pv; moved = true; }
    if (f.slot != null && f.slot !== activeSlot) { activeSlot = f.slot; moved = true; }
    if (moved) showPreview();
  }

  function renderStep() {
    const s = step(), scroll = $('.ez-scroll'), fields = [];
    activePv = 0; activeSlot = 0; tokenViews = [];
    const add = (f) => { fields.push(f); return fieldHTML(f, fields.length - 1); };
    const cards = s.cards.map((c) => `<section class="ez-card">${c.title ? `<h4>${esc(c.title)}</h4>` : ''}${c.hint ? `<p>${esc(c.hint)}</p>` : ''}${c.title || c.hint ? '<div style="height:10px"></div>' : ''}${c.fields.map(add).join('')}${c.more ? `<details class="ez-more"><summary>${esc(c.moreLabel || 'More words')}</summary>${c.more.map(add).join('')}</details>` : ''}</section>`).join('');
    const last = stepIndex === cfg.steps.length - 1;
    scroll.innerHTML = `<div class="ez-in"><h2 class="ez-title">${esc(s.title)}</h2>${s.hint ? `<p class="ez-hint">${esc(s.hint)}</p>` : ''}${cards}${last ? endHTML() : ''}</div>`;
    scroll.scrollTop = 0;
    fields.forEach((f, i) => {
      const box = scroll.querySelector(`[data-f="${i}"]`), n = scroll.querySelector(`[data-n="${i}"]`);
      if (box) {
        box.value = read(f) ?? '';
        count(n, f, box.value);
        box.addEventListener('focus', () => { focusField(f); setTimeout(() => { fit(); box.scrollIntoView({ block: 'nearest' }); }, 280); });
        box.addEventListener('blur', () => setTimeout(fit, 120));
        box.addEventListener('input', () => {
          if (f.max && [...box.value].length > f.max) box.value = [...box.value].slice(0, f.max).join('');
          write(f, box.value); count(n, f, box.value); typed(); changed();
        });
      }
      const tpl = scroll.querySelector(`[data-tpl="${i}"]`);
      if (tpl) mountTemplate(tpl, f, i, n);
      const ytBox = scroll.querySelector(`[data-yt="${i}"]`);
      if (ytBox) {
        const out = scroll.querySelector(`[data-ytr="${i}"]`);
        ytBox.value = read(f) ?? ''; showYouTube(out, ytBox.value);
        ytBox.addEventListener('focus', () => focusField(f));
        ytBox.addEventListener('input', () => {
          const v = ytBox.value.trim();
          showYouTube(out, v);
          if (!v || youtubeId(v)) { write(f, v); typed(); changed(); }   // a half-typed link is not kept
        });
      }
      scroll.querySelectorAll(`[data-ch="${i}"]`).forEach((b) => {
        b.classList.toggle('on', String(read(f)) === b.dataset.v);
        b.addEventListener('click', () => { write(f, b.dataset.v); scroll.querySelectorAll(`[data-ch="${i}"]`).forEach((o) => o.classList.toggle('on', o === b)); focusField(f); typed(); changed(); });
      });
      scroll.querySelectorAll(`[data-sg^="${i}:"]`).forEach((b, k) => b.addEventListener('click', () => { write(f, f.suggest[k]); if (box) { box.value = f.suggest[k]; count(n, f, box.value); } focusField(f); typed(); changed(); }));
      const ph = scroll.querySelector(`[data-ph="${i}"]`);
      if (ph) mountPhoto(ph, f, i, scroll);
      const voice = scroll.querySelector(`.ez-rec[data-v="${i}"]`);
      if (voice) mountVoice(voice, f);
    });
    if (last) bindEnd();
    $('.ez-steps').innerHTML = cfg.steps.map((t, i) => `<button type="button" class="ez-pill${i === stepIndex ? ' on' : i < stepIndex ? ' done' : ''}" data-go="${i}"><i>${String(i + 1).padStart(2, '0')}</i>${esc(t.pill)}</button>`).join('');
    $('.ez-steps .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    $('.ez-nav').innerHTML = `${stepIndex ? '<button type="button" class="ez-btn back" data-nav="-1">Back</button>' : ''}${last ? '<button type="button" class="ez-btn main" data-nav="done">Save and see it</button>' : '<button type="button" class="ez-btn main" data-nav="1">Next</button>'}`;
    showPreview();
  }

  function mountTemplate(box, f, i, n) {
    const parts = templateParts(read(f), f), text = () => templateText(parts), inline = !f.rows;
    const wordHTML = (p, k) => inline
      ? `<input type="text" data-w="${k}" value="${esc(p.word)}" placeholder="…" autocomplete="off" aria-label="${esc(f.label || '')}">`
      : `<textarea data-w="${k}" rows="2" placeholder="Write your words here" aria-label="${esc(f.label || '')}">${esc(p.word)}</textarea>`;
    const missing = Object.keys(f.tokens).filter((t) => !f.tokens[t].optional && !parts.some((p) => p.raw?.includes(`{${t}}`)));
    box.innerHTML = parts.map((p, k) => {
      if (p.raw == null) return !p.word && parts.length > 1 ? `<button type="button" class="ez-tpl-add" data-at="${k}" aria-label="Add words">＋${inline ? '' : ' Add words'}</button>` : wordHTML(p, k);
      const lock = p.raw.split(tokenSplit(f)).map((x, j) => (j % 2 ? `<span class="ez-tk" data-tk="${x.slice(1, -1)}">${LOCK}<span></span></span>` : esc(x))).join('');
      return inline ? lock : `<div class="ez-lock"><div class="ez-lock-note">${LOCK}Fills itself in</div>${lock}</div>`;
    }).join('') + (missing.length ? `<div class="ez-tpl-back"><p class="ez-help">Bring back a removed part:</p><div class="ez-chips">${missing.map((t) => `<button type="button" class="ez-chip" data-back="${t}">＋ ${esc(f.tokens[t].label)}</button>`).join('')}</div></div>` : '');
    const chips = () => box.querySelectorAll('[data-tk]').forEach((c) => { const k = f.tokens[c.dataset.tk]; c.lastChild.textContent = (k.get && k.get(content)) || k.label; });
    const bind = (w) => {
      const p = parts[+w.dataset.w];
      const grow = () => { if (w.tagName === 'TEXTAREA') { w.style.height = 'auto'; w.style.height = `${w.scrollHeight + 2}px`; } };
      grow();
      w.addEventListener('focus', () => { focusField(f); setTimeout(() => { fit(); w.scrollIntoView({ block: 'nearest' }); }, 280); });
      w.addEventListener('blur', () => setTimeout(fit, 120));
      w.addEventListener('input', () => {
        p.word = w.value;
        const over = f.max ? [...text()].length - f.max : 0;
        if (over > 0) { const a = [...w.value]; w.value = a.slice(0, Math.max(0, a.length - over)).join(''); p.word = w.value; }
        grow();
        const v = text(); write(f, v); count(n, f, v); typed(); changed();
      });
    };
    box.querySelectorAll('[data-w]').forEach(bind);
    const first = box.querySelector('[data-w]'); if (first) first.id = `ez-${i}`;
    box.querySelectorAll('[data-at]').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.at; b.insertAdjacentHTML('afterend', wordHTML(parts[k], k));
      const w = b.nextElementSibling; b.remove(); bind(w); w.focus();
    }));
    box.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
      write(f, templateRestore(read(f), b.dataset.back, f)); mountTemplate(box, f, i, n); typed(); changed();
    }));
    chips(); tokenViews.push(chips); count(n, f, text());
  }

  function mountPhoto(box, f, i, scroll) {
    const input = box.querySelector('input'), paint = () => {
      const name = read(f), url = typeof name === 'string' && name ? cfg.mediaURL(name) : '';
      box.classList.toggle('has', !!url);
      box.style.backgroundImage = url ? `url("${url}")` : 'none';
      box.querySelectorAll('.ez-rm, .ez-fit').forEach((x) => x.remove());
      if (url) {
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'ez-rm'; x.textContent = '✕'; x.setAttribute('aria-label', 'Remove the photo');
        x.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          try { await f.drop?.(); } catch (err) { status(err.message || 'Couldn’t remove the photo.', 'bad'); return; }
          write(f, f.empty ?? ''); dirty = true; paint(); typed(); saveNow();
        });
        box.append(x);
        if (f.crop) {   // move and zoom the picture in its frame again
          const a = document.createElement('button');
          a.type = 'button'; a.className = 'ez-fit'; a.textContent = 'Adjust';
          a.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation(); focusField(f);
            let res = null;
            try { res = await f.crop({ url }); } catch (err) { status(err.message || 'Couldn’t open the picture.', 'bad'); return; }
            if (res?.blob) keep(res.blob);
          });
          box.append(a);
        }
      }
    };
    paint();
    box.addEventListener('click', () => focusField(f));
    // a picture fitted in the card's own window (f.crop) goes up as it is
    async function keep(blob) {
      box.classList.add('busy'); box.querySelector('span').innerHTML = 'Saving the photo…';
      try {
        write(f, await cfg.upload(blob));
        dirty = true;
        paint(); typed();
        await saveNow();
      } catch (e) { status(e.message || 'Couldn’t add that photo.', 'bad'); }
      finally { box.classList.remove('busy'); box.querySelector('span').innerHTML = '<b>＋</b>Add a photo'; }
    }
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; input.value = '';
      if (!file) return;
      focusField(f);
      if (f.crop) {
        let res = null;
        try { res = await f.crop({ file }); } catch (e) { status(e.message || 'Couldn’t read that picture.', 'bad'); return; }
        if (res?.blob) keep(res.blob);
        return;
      }
      box.classList.add('busy'); box.querySelector('span').innerHTML = 'Saving the photo…';
      try {
        if (f.store) write(f, await f.store(file));
        else write(f, await cfg.upload(await (cfg.shrink || shrinkImage)(file, f.shrink)));
        dirty = true;
        paint(); typed();
        await saveNow();
      } catch (e) { status(e.message || 'Couldn’t add that photo.', 'bad'); }
      finally { box.classList.remove('busy'); box.querySelector('span').innerHTML = '<b>＋</b>Add a photo'; }
    });
    const cap = scroll.querySelector(`[data-cap="${i}"]`);
    if (cap) {
      const n = scroll.querySelector(`[data-n="${i}c"]`), max = f.captionMax || 60;
      cap.value = getPath(content, f.captionPath) ?? ''; count(n, { max }, cap.value);
      cap.addEventListener('focus', () => { focusField(f); setTimeout(() => { fit(); cap.scrollIntoView({ block: 'nearest' }); }, 280); });
      cap.addEventListener('blur', () => setTimeout(fit, 120));
      cap.addEventListener('input', () => { if ([...cap.value].length > max) cap.value = [...cap.value].slice(0, max).join(''); setPath(content, f.captionPath, cap.value); count(n, { max }, cap.value); typed(); changed(); });
    }
  }

  function endHTML() {
    const url = cfg.shareUrl || '';
    return `${cfg.deadlineText?.() ? `<p class="ez-help" style="margin-top:12px">${esc(cfg.deadlineText())}</p>` : ''}${url ? `<section class="ez-card"><h4>Your link</h4><p>When everything is written, send this link to them.</p><div class="ez-copy"><input type="text" readonly value="${esc(url)}" aria-label="Link"><button type="button" class="ez-btn dark" data-end="copy">Copy</button></div></section>` : ''}${cfg.canFinish ? `<section class="ez-card"><h4>Finish for good</h4><p>Once finished, it can’t be edited again. Only press this when everything is ready.</p><div class="ez-end"><button type="button" class="ez-btn" data-end="finish">Finish for good</button></div></section>` : ''}`;
  }
  function bindEnd() {
    const scroll = $('.ez-scroll');
    scroll.querySelector('[data-end="copy"]')?.addEventListener('click', async (e) => {
      const input = scroll.querySelector('.ez-copy input');
      try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
      e.target.textContent = 'Copied ✓';
    });
    scroll.querySelector('[data-end="finish"]')?.addEventListener('click', () => {
      const sheet = document.createElement('div');
      sheet.className = 'ez-sheet';
      sheet.innerHTML = '<div><h4>Finish for good?</h4><p>Everything you have now is saved. After that, it can’t be edited again.</p><div class="ez-end"><button type="button" class="ez-btn main" data-s="yes">Yes, finish it</button><button type="button" class="ez-btn" data-s="no">No, keep editing</button></div></div>';
      root.append(sheet);
      sheet.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-s]')?.dataset.s; if (!c) return;
        if (c === 'no') return sheet.remove();
        e.target.disabled = true;
        dirty = true;
        if (await saveNow(true)) { saved = true; sheet.remove(); close(); } else sheet.remove();
      });
    });
  }

  function goTo(i) {
    if (i < 0 || i >= cfg.steps.length) return;
    if (dirty) saveNow();
    stepIndex = i; renderStep();
  }

  function build() {
    root.querySelector('.ez-loading').remove();
    const devices = cfg.live ? `<div class="ez-dev" role="group" aria-label="Show it as on">${['phone', 'computer'].map((d) => `<button type="button" data-dev="${d}"${cfg.live.device === d ? ' class="on"' : ''}>${d === 'phone' ? 'Phone' : 'Computer'}</button>`).join('')}</div>` : '';
    root.insertAdjacentHTML('beforeend', `<nav class="ez-steps" aria-label="Steps"></nav><div class="ez-main"><div class="ez-scroll"></div><div class="ez-dock"><div class="ez-dock-l"><span>Live preview</span>${devices}<button type="button" data-big>Full screen</button></div><div class="ez-stage"><div class="ez-shot"><img alt="The saved picture"></div></div></div></div><div class="ez-nav"></div>`);
    if (cfg.live) $('.ez-stage').prepend(cfg.live.el);
    $('.ez-steps').addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) goTo(+g.dataset.go); });
    $('.ez-nav').addEventListener('click', (e) => {
      const n = e.target.closest('[data-nav]')?.dataset.nav; if (!n) return;
      if (n === 'done') { dirty = true; saveNow().then(close); return; }
      goTo(stepIndex + +n);
    });
    $('[data-big]').addEventListener('click', (e) => {
      const big = $('.ez-dock').classList.toggle('big');
      e.target.textContent = big ? 'Back to the form' : 'Full screen';
      layoutPreview();
    });
    $('.ez-dock-l').addEventListener('click', (e) => {
      const d = e.target.closest('[data-dev]')?.dataset.dev; if (!d || !cfg.live) return;
      root.querySelectorAll('[data-dev]').forEach((b) => b.classList.toggle('on', b.dataset.dev === d));
      cfg.live.setDevice(d); layoutPreview();
    });
    new ResizeObserver(drawAll).observe($('.ez-stage'));
    cfg.live?.update(content);
    renderStep();
    fit();
  }

  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit);
  fit();
  (async () => {
    try {
      const d = await cfg.load();
      content = d.content;
      const canEdit = d.canEdit !== false, finished = !!d.finished;
      if (!canEdit || finished) {
        $('.ez-loading').innerHTML = `<div><h3 style="font-size:18px;margin-bottom:6px">${finished ? 'This card is finished' : 'The time to edit has ended'}</h3><p>The card can only be viewed now.</p></div>`;
        return;
      }
      build();
    } catch (e) {
      $('.ez-loading').innerHTML = `<div><p style="margin-bottom:12px">${esc(e.message || 'Couldn’t load.')}</p><button type="button" class="ez-btn main" data-r>Try again</button></div>`;
      $('[data-r]').onclick = () => { closed = true; root.remove(); document.documentElement.style.overflow = prevOverflow; openEasyEditor(cfg); };
    }
  })();
}

/**
 * Saves against a revision number without ever showing "changed in another window" to the customer: when the server
 * says the page's revision is old (a second tab, a phone and a Mac, a reply lost on a bad connection), the newest
 * revision is fetched and the save goes again, keeping what is on screen.
 */
export function saveKeepingLatest({ save, latest, getRevision, setRevision, onSaved }) {
  return async (content, opts) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const d = await save(content, getRevision(), opts);
        setRevision(d.revision); onSaved?.(d);
        return d;
      } catch (e) {
        if (e.status !== 409 || attempt >= 2) throw e;
        const now = await latest();
        setRevision(now.revision);
      }
    }
  };
}

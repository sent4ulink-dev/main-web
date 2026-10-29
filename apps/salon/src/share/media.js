// Photos and the voice message, made as small as they can be before they're stored:
// photos are shrunk and saved as WebP (JPEG where the browser can't write WebP, e.g. older Safari),
// the voice is recorded as mono Opus at a speech bitrate (AAC on iPhone), at most 30 seconds.

/** A picked image file, shrunk so its longer side is at most `max` px, as a WebP (or JPEG) blob. */
export async function shrinkImage(file, { max = 1280, quality = 0.8 } = {}) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read the picture.')); i.src = URL.createObjectURL(file); });
  }
  const w0 = src.width, h0 = src.height, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  src.close?.();
  return encodeCanvas(c, quality);
}

/** A canvas as a WebP blob (JPEG where the browser can't write WebP). */
export async function encodeCanvas(c, quality = 0.8) {
  const encode = (type) => new Promise((res) => c.toBlob(res, type, quality));
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
  if (!blob) throw new Error('Could not convert the picture.');
  return blob;
}

/** Ask for an image file (resolves with null when nothing was chosen). */
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export const VOICE_SECONDS = 30;
const VOICE_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];

/** Records one voice message from the microphone; stops by itself at VOICE_SECONDS. */
export class VoiceRecorder {
  async start(onTick) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const mimeType = VOICE_TYPES.find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    this.rec = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24000 });
    const chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    this.done = new Promise((resolve) => {
      this.rec.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        clearInterval(this.tick);
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

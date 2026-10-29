// Share links (?share=id): made in the studio (the bare address) or sold by
// sent4u, edited by whoever has the link for five days or
// until it is finished, then view-only. The words live on Petal Isle's
// server, which is this same site on Cloudflare (functions/api; in development
// `npm run dev` answers /api itself); this is the page's side.

export const SHARE_PARAM = "share";
// The server is this same site: functions/api on Cloudflare Pages (and the
// Vite middleware in development).
export const API_BASE = "";

export function shareIdFrom(search = location.search) {
  const id = new URLSearchParams(search).get(SHARE_PARAM);
  return id && /^[A-Za-z0-9_-]{6,32}$/.test(id) ? id : null;
}

// The link itself: this site with only ?share=id.
export function shareUrl(id, href = location.href) {
  const url = new URL(href);
  url.search = `?${SHARE_PARAM}=${id}`;
  url.hash = "";
  return url.toString();
}

// Every call answers { ok, status, error, ...body }, never throws (a lost
// connection is status 0). The server sleeps when nobody has used it for a
// while and needs up to a minute to wake (more if it must wake the shop too):
// a patient call keeps at it for up to 2½ minutes. Each try may take 50 s, and
// a try that is cut off or meets a server error (5xx, 408, 429) is made again.
async function call(path, { method = "GET", body, fetchImpl = fetch, patient = false } = {}) {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    const controller = patient ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 50000) : 0;
    try {
      const response = await fetchImpl(`${API_BASE}/api/${path}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller?.signal,
      });
      const busy = response.status >= 500 || response.status === 408 || response.status === 429;
      if (!patient || !busy || Date.now() - started > 150000) {
        const data = await response.json().catch(() => ({}));
        return { ...data, ok: response.ok, status: response.status, error: response.ok ? null : data.error || "failed" };
      }
    } catch {
      if (!patient || Date.now() - started > 150000) return { ok: false, status: 0, error: "offline" };
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)));
  }
}

export const studioInfo = (options) => call("studio", options);
export const unlockStudio = (password, options) => call("studio/unlock", { ...options, method: "POST", body: { password } });
export const createShare = (content, studioPassword, options) => call("shares", { ...options, method: "POST", body: { content, studioPassword } });
export const loadShare = (id, options) => call(`shares/${id}`, options);
export const saveShare = (id, content, options) => call(`shares/${id}`, { ...options, method: "PUT", body: { content } });
export const finalizeShare = (id, options) => call(`shares/${id}/finalize`, { ...options, method: "POST" });

// A photo for one place of the invitation (see IMAGE_SLOTS), already shrunk:
// answers its address (url). removeImage takes it away.
export async function uploadImage(id, slot, blob, { width, height }, { fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(`${API_BASE}/api/shares/${id}/images?slot=${slot}`, {
      method: "POST",
      headers: { "content-type": blob.type || "application/octet-stream", "x-image-size": `${width}x${height}` },
      body: blob,
    });
    const data = await response.json().catch(() => ({}));
    return { ...data, ok: response.ok, status: response.status, error: response.ok ? null : data.error || "failed" };
  } catch {
    return { ok: false, status: 0, error: "offline" };
  }
}
export const removeImage = (id, slot, options) => call(`shares/${id}/images?slot=${slot}`, { ...options, method: "DELETE" });

// Editing saves by itself a moment after the last change; flush() saves at
// once (the Save button, finishing). Saves never overlap, and the last words
// always win. onState("saving" | "saved" | "failed", result).
export function createAutosave({ save, delay = 2000, onState = () => {}, timers = globalThis }) {
  let timer = null;
  let latest = null;
  let running = null;
  let dirty = false;
  async function run() {
    timer = null;
    if (running) await running.catch(() => {});
    if (!dirty) return true;
    dirty = false;
    const words = latest;
    onState("saving");
    running = Promise.resolve(save(words));
    const result = await running.catch(() => ({ ok: false, error: "offline" }));
    running = null;
    if (result?.ok) {
      onState(dirty ? "saving" : "saved", result);
      return true;
    }
    dirty = true; // keep it for the next try
    onState("failed", result);
    return false;
  }
  return {
    get dirty() { return dirty || Boolean(timer) || Boolean(running); },
    schedule(content) {
      latest = content;
      dirty = true;
      if (timer) timers.clearTimeout(timer);
      timer = timers.setTimeout(run, delay);
    },
    async flush(content = latest) {
      if (content) {
        latest = content;
        dirty = true;
      }
      if (timer) timers.clearTimeout(timer);
      return run();
    },
    cancel() {
      if (timer) timers.clearTimeout(timer);
      timer = null;
      dirty = false;
    },
    // Runs work (a photo upload) between saves, never at the same time as one.
    async exclusive(work) {
      if (running) await running.catch(() => {});
      const done = Promise.resolve().then(work);
      running = done;
      try {
        return await done;
      } finally {
        if (running === done) running = null;
      }
    },
  };
}

// How long a link can still be edited: "4 days 23 hours", "5 hours 12 minutes".
export function editTimeLeft(ms) {
  if (!(ms > 0)) return "";
  const minutes = Math.ceil(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days) return hours ? `${unit(days, "day")} ${unit(hours, "hour")}` : unit(days, "day");
  if (hours) return rest ? `${unit(hours, "hour")} ${unit(rest, "minute")}` : unit(hours, "hour");
  return unit(rest, "minute");
}

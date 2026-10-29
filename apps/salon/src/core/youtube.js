// YouTube links: whatever someone pastes (a watch page, a youtu.be share
// link, Shorts, YouTube Music, an embed or live link, or just the 11-letter
// video id), read as { id, start } with the start in seconds.

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];

// "90", "90s", "1m30s", "1h2m3s" -> seconds.
function seconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}

export function parseYouTube(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  if (ID.test(raw)) return { id: raw, start: 0 };
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (HOSTS.includes(host)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(first)) id = second;
  }
  if (!id || !ID.test(id)) return null;
  return { id, start: seconds(url.searchParams.get("t") || url.searchParams.get("start")) };
}

// A tidy share link for a parsed song.
export function youtubeLink({ id, start = 0 }) {
  return `https://youtu.be/${id}${start ? `?t=${start}` : ""}`;
}

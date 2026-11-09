// The card's song: a YouTube link (texts["song:0"]), heard only. It starts on the visitor's first tap (phones allow
// sound only then), loops, and pauses with the sound button.
const HOSTS = ['https://www.youtube-nocookie.com', 'https://www.youtube.com'];
let api = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  api ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.append(tag);
  });
  return api;
}
export function youTubeId(link) {
  return /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(String(link || ''))?.[1] || null;
}
export function startSong(link) {
  const id = youTubeId(link);
  if (!id) return;
  // never hidden, and at YouTube's smallest allowed size: browsers don't run a hidden or tiny player properly
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
  document.body.append(box);
  let player = null, wanted = false, muted = false;
  const mount = (host) => {
    const query = new URLSearchParams({ enablejsapi: 1, playsinline: 1, rel: 0, controls: 0, origin: location.origin, widget_referrer: location.origin });
    const frame = document.createElement('iframe');
    frame.width = frame.height = 200;
    frame.title = 'Song';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = `${HOSTS[host]}/embed/${id}?${query}`;
    box.replaceChildren(frame);
    loadApi().then(() => {
      player = new window.YT.Player(frame, { events: {
        onReady: () => { if (wanted && !muted) player.playVideo(); },
        onStateChange: (e) => { if (e.data === 0) { player.seekTo(0); player.playVideo(); } },
        // a song that one address refuses sometimes plays from the other
        onError: () => { if (host < HOSTS.length - 1) { try { player.destroy(); } catch { /* already gone */ } mount(host + 1); } },
      } });
    });
  };
  mount(0);
  const start = () => { wanted = true; if (!muted) player?.playVideo?.(); };
  window.addEventListener('pointerdown', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  document.querySelector('#sound-toggle')?.addEventListener('click', () => { muted = !muted; if (muted) player?.pauseVideo?.(); else if (wanted) player?.playVideo?.(); });
}

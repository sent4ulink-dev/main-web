// Loading the card's photos (bundled files or uploads) as drawable images.

/** An image from a URL (null when it can't be loaded). */
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

/** Load user photos (or paint placeholders) into drawable images. `url` turns a stored src into an address. */
export async function loadPhotos(list, url) {
  const images = await Promise.all(list.map((p) => loadImage(p.src ? url(p.src) : '')));
  return list.map((p, i) => ({ image: images[i] || null, caption: p.caption, src: images[i] ? p.src : '' }));
}

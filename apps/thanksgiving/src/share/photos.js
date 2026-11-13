// The family photos on the wall, as the page sees them: loads the host's pictures into the frames (for the
// host and for every guest), and lets the host hang new ones — each picture shrunk on the phone first
// (a long side of 1280 px, a JPEG) — or take one down.

const MOST = 6;

async function shrink(file, longSide) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, longSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  img.close?.();
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
}

export class PhotoWall {
  constructor({ repo, roster, wall, ui }) {
    Object.assign(this, { repo, roster, wall, ui });
    this.urls = new Array(MOST).fill(null);
    this.removing = false;
  }

  urlOf(n) { return this.urls[n]; }

  /** Every photo the card has, into its frame. */
  async load() {
    if (!this.repo.canPhotos) return;
    const list = this.roster.photos || [];
    await Promise.all(list.map(async (v, n) => { if (v) await this._show(n, await this.repo.photoBlob(n, v)); }));
  }
  async _show(n, blob) {
    if (this.urls[n]) URL.revokeObjectURL(this.urls[n]);
    this.urls[n] = blob ? URL.createObjectURL(blob) : null;
    this.wall.setPhoto(n, blob ? await createImageBitmap(blob, { imageOrientation: 'flipY' }).catch(() => null) : null);
  }

  _chooser(multiple, onFiles) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.multiple = multiple;
    input.onchange = () => { const files = [...input.files || []]; if (files.length) onFiles(files); };
    input.click();
  }

  /** "Add photos": into the empty frames first (then over the oldest). */
  pick() {
    this._chooser(true, async (files) => {
      const versions = this.roster.photos || [];
      const order = [...Array(MOST).keys()].sort((a, b) => (versions[a] || 0) - (versions[b] || 0));
      for (const [i, f] of files.slice(0, MOST).entries()) await this._upload(order[i], f);
    });
  }

  /** The host taps a frame: hang a picture there (or, when taking photos down, take this one down). */
  tapSlot(n) {
    const has = !!(this.roster.photos || [])[n];
    if (has && confirm('Take this photo down?\n\nOK takes it down · Cancel lets you pick another picture for this frame')) { this._remove(n); return; }
    this._chooser(false, (files) => this._upload(n, files[0]));
  }

  async _upload(n, file) {
    try {
      this.ui.toast('Hanging the photo…', 6000);
      const blob = await shrink(file, this.repo.mode.kind === 'test' ? 900 : 1280);
      const d = await this.repo.uploadPhoto(n, blob);
      this.roster.photos = d.photos;
      await this._show(n, blob);
      this.ui.toast('Up on the wall 🖼');
    } catch (err) { this.ui.toast(`Couldn’t hang it — ${err.message}`, 4200); }
  }
  async _remove(n) {
    try {
      const d = await this.repo.deletePhoto(n);
      this.roster.photos = d.photos;
      await this._show(n, null);
      this.ui.toast('Taken down');
    } catch (err) { this.ui.toast(`Couldn’t take it down — ${err.message}`, 4200); }
  }
}

import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { planeRect } from '../util/textures.js';
import { plaqueTexture, SERIF } from '../world/salonTextures.js';

// Five portraits on the gallery wall, each in a gilded frame that takes the shape of its photo
// (wide or tall), varnished like an old master, with an engraved brass plaque for its caption.
// Same interface as Birthday web 1's polaroid line: cards, images, ordered, setCaption, setPhoto,
// spots, shotFor, focusPoint.

const FW = 0.085;   // frame width

/** A silhouette cameo for an empty portrait (a profile in a powdered wig), on a soft pastel ground. */
export function cameo(i, size = 768) {
  const c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 1.25);
  const x = c.getContext('2d'), w = c.width, h = c.height;
  const grounds = [['#f4d9d6', '#d9a7a9'], ['#dfe3f0', '#9fa9c9'], ['#f3e3c8', '#d2b27f'], ['#e2efe2', '#9fbfa4'], ['#efdbea', '#c49ab8']];
  const [a, b] = grounds[i % grounds.length];
  const g = x.createRadialGradient(w / 2, h * 0.45, w * 0.1, w / 2, h / 2, w * 0.8); g.addColorStop(0, a); g.addColorStop(1, b);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#2b1e2a';
  x.save(); x.translate(w / 2, h * 0.52); const s = w / 768; x.scale(i % 2 ? -s : s, s);
  // bust and profile: forehead, nose, lips, chin, neck, a ribboned queue and curls of the wig
  x.beginPath();
  x.moveTo(-60, -230); x.bezierCurveTo(40, -250, 95, -190, 100, -120); x.lineTo(132, -70); x.lineTo(104, -52);
  x.bezierCurveTo(112, -40, 104, -28, 110, -18); x.bezierCurveTo(100, -10, 106, 6, 96, 16); x.bezierCurveTo(90, 46, 60, 60, 40, 62);
  x.lineTo(46, 120); x.bezierCurveTo(130, 140, 200, 190, 220, 300); x.lineTo(-220, 300); x.bezierCurveTo(-210, 200, -150, 150, -90, 130);
  x.bezierCurveTo(-120, 60, -150, -40, -140, -120); x.bezierCurveTo(-130, -190, -110, -220, -60, -230); x.fill();
  for (const [cx, cy] of [[-120, -60], [-128, -10], [-118, 40]]) { x.beginPath(); x.ellipse(cx, cy, 34, 22, 0, 0, Math.PI * 2); x.fill(); }
  x.beginPath(); x.moveTo(-150, 30); x.bezierCurveTo(-200, 60, -200, 140, -170, 180); x.lineTo(-150, 176); x.bezierCurveTo(-170, 130, -165, 80, -140, 50); x.fill();
  x.fillStyle = '#8a1c2c'; x.beginPath(); x.ellipse(-158, 46, 22, 12, 0.6, 0, Math.PI * 2); x.fill();
  x.restore();
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 6; x.beginPath(); x.ellipse(w / 2, h / 2, w * 0.42, h * 0.43, 0, 0, Math.PI * 2); x.stroke();
  x.font = `italic 600 ${Math.round(w * 0.05)}px ${SERIF}`; x.fillStyle = 'rgba(60,30,40,0.55)'; x.textAlign = 'center';
  x.fillText('✦', w / 2, h * 0.94);
  return c;
}

/** The photo, varnished: a warm glaze, darkened edges, a faint canvas weave. */
function varnished(img, aspect, longSide = 1024) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const w = aspect >= 1 ? longSide : Math.round(longSide * aspect), h = aspect >= 1 ? Math.round(longSide / aspect) : longSide;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  // cover-fit (the frame already has the photo's shape, so this only trims rounding)
  const k = Math.max(w / iw, h / ih);
  x.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(245,214,168,0.35)'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,10,0.42)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  x.globalAlpha = 0.05; x.fillStyle = '#000';
  for (let yy = 0; yy < h; yy += 4) x.fillRect(0, yy, w, 1);
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function frameGeometry(w, h, depth = 0.05) {
  const outer = new THREE.Shape([new THREE.Vector2(-w / 2 - FW, -h / 2 - FW), new THREE.Vector2(w / 2 + FW, -h / 2 - FW), new THREE.Vector2(w / 2 + FW, h / 2 + FW), new THREE.Vector2(-w / 2 - FW, h / 2 + FW)]);
  outer.holes.push(new THREE.Path([new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(-w / 2, h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(w / 2, -h / 2)]));
  return new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.024, bevelSegments: 3, curveSegments: 4 });
}

export class Portraits {
  /** wall: { x, y, zs } on the left wall (they face +X). photos: [{ image, caption, src }] */
  constructor(scene, wall, photos) {
    this.group = new THREE.Group();
    this.group.name = 'portraits';
    scene.add(this.group);
    this.wall = wall;
    this.cards = []; this.images = [];
    this.gilt = toonMaterial({ color: new THREE.Color('#e0ad48'), emissive: new THREE.Color('#e0ad48').multiplyScalar(0.18) }, { rimScale: 2.6 });
    photos.forEach((ph, i) => this._add(ph, i));
  }

  _box(i) { return i === 2 ? [1.0, 1.32] : [0.8, 1.02]; }

  _add(ph, i) {
    const pivot = new THREE.Group();
    pivot.position.set(this.wall.x, this.wall.y + (i === 2 ? 0.05 : 0), this.wall.zs[i]);
    pivot.rotation.y = Math.PI / 2;
    this.group.add(pivot);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), toonMaterial({ color: 0xffffff }, { rimScale: 0 }));
    card.position.z = 0.03;
    card.userData.slot = i;
    pivot.add(card);
    const c = { pivot, card, frame: null, plaque: null, crest: null, w: 1, h: 1 };
    this.cards.push(c);
    this.images.push(ph);
    this._fit(i);
  }

  /** Size the frame to the photo's shape and repaint the canvas and plaque. */
  _fit(i) {
    const c = this.cards[i], ph = this.images[i];
    const img = ph.image || cameo(i);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const aspect = THREE.MathUtils.clamp(iw / ih, 9 / 16, 16 / 9);
    const [mw, mh] = this._box(i);
    const w = aspect > mw / mh ? mw : mh * aspect, h = aspect > mw / mh ? mw / aspect : mh;
    c.w = w; c.h = h;
    c.card.scale.set(w, h, 1);
    c.card.material.map?.dispose();
    c.card.material.map = varnished(img, aspect); c.card.material.needsUpdate = true;
    for (const k of ['frame', 'plaque', 'crest']) if (c[k]) { c.pivot.remove(c[k]); c[k].traverse((m) => m.geometry?.dispose()); }
    c.frame = new THREE.Mesh(frameGeometry(w, h), this.gilt);
    c.frame.castShadow = true;
    addOutline(c.frame, 0.0016);
    // corner rosettes and a crest on top
    c.crest = new THREE.Group();
    const ros = new THREE.SphereGeometry(0.032, 12, 8);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const r = new THREE.Mesh(ros, this.gilt); r.scale.set(1, 1, 0.6);
      r.position.set(sx * (w / 2 + FW / 2), sy * (h / 2 + FW / 2), 0.07); c.crest.add(r);
    }
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.gilt);
    shell.scale.set(1.3, 0.8, 0.45); shell.position.set(0, h / 2 + FW, 0.03); c.crest.add(shell);
    for (const sx of [-1, 1]) {
      const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 16, Math.PI * 1.4), this.gilt);
      scroll.position.set(sx * 0.13, h / 2 + FW + 0.02, 0.04); scroll.rotation.z = sx > 0 ? -0.3 : Math.PI + 0.3; c.crest.add(scroll);
    }
    c.crest.traverse((m) => { if (m.isMesh) addOutline(m, 0.0014); });
    c.plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), toonMaterial({ map: plaqueTexture(ph.caption || ''), emissive: new THREE.Color(0x2a1a06) }, { rimScale: 1.2 }));
    c.plaque.position.set(0, -h / 2 - FW - 0.11, 0.012);
    c.pivot.add(c.frame, c.crest, c.plaque);
  }

  /** Re-letter one plaque (index into the photos list). */
  setCaption(i, caption) {
    const c = this.cards[i], ph = this.images[i]; if (!c || !ph) return;
    ph.caption = caption;
    c.plaque.material.map?.dispose();
    c.plaque.material.map = plaqueTexture(caption || ''); c.plaque.material.needsUpdate = true;
  }

  /** A new picture for one portrait (an uploaded photo, or null for its cameo). */
  setPhoto(i, image, src = '') {
    const ph = this.images[i]; if (!ph) return;
    ph.image = image || null; ph.src = image ? src : '';
    this._fit(i);
  }

  update() {}

  /** Where each painting is on screen (for the editor's "add a photo" spots). */
  spots(camera, w, h) {
    return this.cards.map((c, slot) => {
      const rect = planeRect(c.card, camera, w, h);
      return rect && { key: `photo${slot}`, path: `photos.${slot}.src`, slot, rect, filled: !!this.images[slot]?.src };
    }).filter(Boolean);
  }

  get focusPoint() { return new THREE.Vector3(this.wall.x, this.wall.y, (this.wall.zs[0] + this.wall.zs[this.wall.zs.length - 1]) / 2); }

  /** Left to right as seen facing the wall. */
  get ordered() { return [...this.cards].sort((a, b) => b.pivot.position.z - a.pivot.position.z); }

  /** A straight-on close-up of portrait i (in screen order). */
  shotFor(i) {
    const c = this.ordered[i];
    if (!c) return null;
    const centre = c.card.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.08, 0));
    const dist = 1.05 + Math.max(c.h, c.w * 0.8) * 1.05;
    return { pos: centre.clone().add(new THREE.Vector3(dist, 0.02, 0)), target: centre, fov: 36, frameX: -0.1 };
  }
}

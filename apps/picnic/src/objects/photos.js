import * as THREE from 'three';
import { polaroidTexture, placeholderPhoto, planeRect } from '../util/textures.js';
import { wind } from '../world/wind.js';
import { toonMaterial, addOutline } from '../style/toon.js';

const PW = 0.23, PH = 0.278;   // big polaroids, easy to see from the table
const SPREAD = [0.29, 0.71];    // hung close together in the middle of the line

/** Twine strung between two points with polaroids clipped on, swinging in the breeze. */
export class PhotoLine {
  constructor(scene, a, b, photos, base) {
    this.group = new THREE.Group();
    this.group.name = 'photos';
    scene.add(this.group);
    this.a = a.clone(); this.b = b.clone();
    this.sag = 0.16;
    this.cards = [];
    this.images = [];

    // twine as a thin tube along the catenary
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(this._curve(i / 40));
    const curve = new THREE.CatmullRomCurve3(pts);
    const twine = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.002, 6), toonMaterial({ color: new THREE.Color('#d8bf93') }));
    twine.castShadow = true;
    this.group.add(twine);

    const pinMat = toonMaterial({ color: new THREE.Color('#e2a06a') });
    const pinGeo = new THREE.BoxGeometry(0.014, 0.05, 0.009);
    photos.forEach((ph, i) => this._addCard(ph, i, photos.length, pinMat, pinGeo, base));
    this.pinMat = pinMat; this.pinGeo = pinGeo; this.base = base;
  }

  _curve(s) {
    const p = this.a.clone().lerp(this.b, s);
    p.y -= Math.sin(s * Math.PI) * this.sag;
    return p;
  }

  _addCard(ph, i, n, pinMat, pinGeo, base, sOverride) {
    const s = sOverride ?? (SPREAD[0] + (i / Math.max(1, n - 1)) * (SPREAD[1] - SPREAD[0]));
    const tex = polaroidTexture(ph.image, ph.caption, 1024);
    const mat = toonMaterial({ map: tex, side: THREE.DoubleSide }, { rimScale: 0.2 });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    fit(card, tex);
    card.castShadow = true;
    addOutline(card, 0.0014);
    const pivot = new THREE.Group();
    pivot.position.copy(this._curve(s));
    const dir = this.b.clone().sub(this.a).normalize();
    pivot.rotation.y = Math.atan2(-dir.z, dir.x);
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.y = -0.008;
    pivot.add(card, pin);
    this.group.add(pivot);
    this.cards.push({ pivot, card, phase: Math.random() * 6, s });
    this.images.push(ph);
    return pivot;
  }

  /** Re-letter one polaroid (index into the photos list). */
  setCaption(i, caption) {
    const c = this.cards[i], ph = this.images[i]; if (!c || !ph) return;
    ph.caption = caption;
    c.card.material.map?.dispose();
    c.card.material.map = polaroidTexture(ph.image, caption, 1024); c.card.material.needsUpdate = true;
    fit(c.card, c.card.material.map);
  }

  /** Where each photo window is on screen (for the editor's "add a photo" spots). */
  spots(camera, w, h) {
    return this.cards.map((c, slot) => {
      const ph = c.card.material.map.userData.photo;
      const rect = planeRect(c.card, camera, w, h, { u0: ph.u0, u1: 1 - ph.u0, v0: ph.v0, v1: ph.v1 });
      return rect && { key: `photo${slot}`, path: `photos.${slot}.src`, slot, rect, filled: !!this.images[slot]?.src };
    }).filter(Boolean);
  }

  /** A new picture for one polaroid (an uploaded photo, or null for its painted placeholder). */
  setPhoto(i, image, src = '') {
    const ph = this.images[i]; if (!ph) return;
    ph.image = image || placeholderPhoto(i, ph.caption);
    ph.src = image ? src : '';
    this.setCaption(i, ph.caption);
  }

  update(t) {
    const ws = wind.uniforms.uWindStrength.value;
    for (const c of this.cards) {
      c.pivot.rotation.x = Math.sin(t * 1.7 + c.phase) * 0.12 * ws + Math.sin(t * 3.1 + c.phase * 2) * 0.04 * ws + 0.12 * ws;
      c.pivot.rotation.z = Math.sin(t * 1.1 + c.phase) * 0.05;
    }
  }

  get focusPoint() { return this._curve(0.5).add(new THREE.Vector3(0, -0.06, 0)); }

  /** Cards sorted from screen-left to screen-right (as seen from the front of the table). */
  get ordered() { return [...this.cards].sort((a, b) => b.pivot.position.z - a.pivot.position.z); }

  /** A straight-on close-up of card i: camera in front of the photo, looking at it. */
  shotFor(i, dist = 0.82) {
    const c = this.ordered[i];
    if (!c) return null;
    const centre = c.card.getWorldPosition(new THREE.Vector3());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(c.card.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
    dist *= Math.max(1, c.card.scale.y * 1.08);   // a tall (portrait) polaroid needs a step back to fit
    return { pos: centre.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.03, 0)), target: centre, fov: 34, frameX: -0.1 };
  }
}

/** The card takes the height of its polaroid (the photo's own shape), hanging from the same pin. */
function fit(card, tex) {
  const s = (tex.userData.aspect || PH / PW) / (PH / PW);
  card.scale.y = s;
  card.position.y = -PH * s / 2 - 0.016;
}

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
  return list.map((p, i) => ({ image: images[i] || placeholderPhoto(i, p.caption), caption: p.caption, src: images[i] ? p.src : '' }));
}

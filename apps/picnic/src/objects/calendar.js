import * as THREE from 'three';
import gsap from 'gsap';
import { dayTexture, LABEL } from '../util/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

const PW = 0.17, PH = 0.19;   // page size

/**
 * Wooden day-flip desk calendar on rings. Revealing it flips the three days before over the top,
 * lands on the special day, then paints a felt-tip circle around it and writes its note.
 */
export class DeskCalendar {
  constructor(parent, anchor, isoDate, label = '') {
    this.group = new THREE.Group();
    this.group.name = 'calendar';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    this.label = label;
    const wood = toonMaterial({ color: new THREE.Color('#9a6640') });

    const base = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.025, 0.022, 0.1), wood);
    base.position.y = 0.011;
    base.castShadow = true; base.receiveShadow = true;
    addOutline(base, 0.0018);
    this.group.add(base);

    // slanted board
    this.board = new THREE.Group();
    this.board.position.set(0, 0.022, 0.018);
    this.board.rotation.x = -0.24;
    this.group.add(this.board);
    const back = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.012, PH + 0.02, 0.007), wood);
    back.position.set(0, (PH + 0.02) / 2, -0.005);
    back.castShadow = true;
    addOutline(back, 0.0018);
    this.board.add(back);

    // pages hinge at the top (rings): the three days before, then the special day
    const d = new Date(`${isoDate}T12:00:00`);
    this.days = [3, 2, 1, 0].map((k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - k, 12));
    const top = PH + 0.012;
    const geo = new THREE.PlaneGeometry(PW, PH);
    geo.translate(0, -PH / 2, 0);
    this.pages = this.days.map((m, i) => {
      const last = i === this.days.length - 1;
      const page = dayTexture(m, last);
      if (last) this.markPage = page;
      const mat = toonMaterial({ map: page.texture, side: THREE.DoubleSide }, { rimScale: 0.15 });
      const pivot = new THREE.Group();
      pivot.position.set(0, top, 0.0005 + (this.days.length - i) * 0.0008);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      pivot.add(mesh);
      this.board.add(pivot);
      return pivot;
    });
    this.pageZ = this.pages.map((p) => p.position.z);

    // metal rings
    const ringMat = toonMaterial({ color: new THREE.Color('#d6d6de') }, { rimScale: 1.2 });
    for (const x of [-0.05, 0.05]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0016, 8, 24), ringMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(x, top, 0.002);
      this.board.add(ring);
    }
    this.flipped = false;
    this.hitTargets = [back, ...this.pages.map((p) => p.children[0])];
  }

  /** New special date: repaint the four day pages (and the circle). */
  setDate(iso) {
    const d = new Date(`${iso}T12:00:00`);
    this.days = [3, 2, 1, 0].map((k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - k, 12));
    this.pages.forEach((pivot, i) => {
      const last = i === this.days.length - 1, m = this.days[i];
      const page = dayTexture(m, last);
      if (last) this.markPage = page;
      const mat = pivot.children[0].material; mat.map?.dispose(); mat.map = page.texture; mat.needsUpdate = true;
    });
    if (this.flipped) this.markPage.mark(1, this.label);
  }
  setLabel(label) { this.label = label; if (this.flipped) this.markPage.mark(1, this._noLabel ? '' : label); }
  /** While editing, the note is hidden on the page (a text layer sits over it instead). */
  setLabelHidden(hidden) { this._noLabel = hidden; if (this.flipped) this.markPage.mark(1, hidden ? '' : this.label); }

  /** Screen rectangle of the note line on the special day's page (for the editing layer), or null. */
  labelRect(camera, w, h) {
    if (!this.flipped) return null;
    const mesh = this.pages[this.pages.length - 1].children[0];
    const y0 = -PH * (1 - (LABEL.bottom + LABEL.size * 0.95) / LABEL.h), y1 = -PH * (1 - (LABEL.bottom - LABEL.size * 0.3) / LABEL.h);
    const pts = [[-PW / 2 + 0.006, y0], [PW / 2 - 0.006, y1]].map(([x, y]) => mesh.localToWorld(new THREE.Vector3(x, y, 0)).project(camera));
    if (pts.some((p) => p.z > 1)) return null;
    const x0 = (pts[0].x * 0.5 + 0.5) * w, ya = (-pts[0].y * 0.5 + 0.5) * h, x1 = (pts[1].x * 0.5 + 0.5) * w, yb = (-pts[1].y * 0.5 + 0.5) * h;
    return { x: Math.min(x0, x1), y: Math.min(ya, yb), w: Math.abs(x1 - x0), h: Math.abs(yb - ya) };
  }

  /** Flip the earlier days away, then circle the date. */
  reveal() {
    if (this.flipped) return Promise.resolve();
    this.flipped = true;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.pages.slice(0, -1).forEach((p, i) => {
        // over the top of the easel, coming to rest hanging down its back
        tl.to(p.rotation, { x: -(Math.PI * 2 - 0.5), duration: 0.8, ease: 'power2.inOut' }, i * 0.42);
        tl.to(p.position, { z: -0.013 - i * 0.0009, duration: 0.8, ease: 'power2.inOut' }, i * 0.42);
      });
      const st = { k: 0 };
      tl.to(st, { k: 1, duration: 1.3, ease: 'power1.inOut', onUpdate: () => this.markPage.mark(st.k, this._noLabel ? '' : this.label) }, '+=0.15');
    });
  }

  reset() {
    this.flipped = false;
    this.pages.forEach((p, i) => { p.rotation.x = 0; p.position.z = this.pageZ[i]; });
    this.markPage.mark(0);
  }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.12, 0.02)); }
}

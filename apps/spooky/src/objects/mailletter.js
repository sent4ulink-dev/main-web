import * as THREE from 'three';
import gsap from 'gsap';
import { letterTexture } from '../util/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

const PAGE_W = 0.3, PAGE_H = 0.42;   // the letter, unrolled for reading (same shape as its texture)
const ROLL_R = 0.032, ROLL_L = PAGE_W + 0.02;

/** A rolled-up sheet: a paper tube with its spiral ends. */
function makeRoll(paper, endMat) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(ROLL_R, ROLL_R, ROLL_L, 20, 1, true), paper);
  tube.rotation.z = Math.PI / 2;
  addOutline(tube, 0.0016);
  const ends = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.RingGeometry(ROLL_R * 0.25, ROLL_R, 20), endMat);
    e.rotation.y = Math.PI / 2; e.position.x = s * ROLL_L / 2; return e;
  });
  g.add(tube, ...ends);
  g.parts = [tube, ...ends];
  return g;
}

/**
 * The invitation waits inside the coffin mailbox as a rolled-up letter tied with a purple ribbon and a wax
 * seal — no envelope. Opening it: the seal pops, the roll comes up out of the coffin, and as it floats up in
 * front of the camera the page unrolls off it — the roll turning and travelling down the page's edge, in one
 * motion with the flight. Closing rolls it back up the same way and drops it home.
 */
export class MailLetter {
  constructor(parent, anchor, content, presenter) {
    this.content = content;
    this.presenter = presenter;
    this.group = new THREE.Group();
    this.group.name = 'letter';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    this.root = parent;
    this.opened = false;
    this.reading = false;

    const paper = toonMaterial({ color: new THREE.Color('#e3d1a8') }, { rimScale: 0.8 });
    const endMat = toonMaterial({ color: new THREE.Color('#c9b386'), side: THREE.DoubleSide });
    // the roll, leaning in the coffin, tied with a ribbon and sealed
    this.roll = makeRoll(paper, endMat);
    this.roll.position.set(0, -0.02, 0.02);
    this.roll.rotation.z = 0.32;
    this.group.add(this.roll);
    const ribbonMat = toonMaterial({ color: new THREE.Color('#6a2a9a'), emissive: new THREE.Color('#240a3a') }, { rimScale: 1.4 });
    this.ribbon = new THREE.Mesh(new THREE.TorusGeometry(ROLL_R + 0.003, 0.006, 6, 24), ribbonMat);
    this.ribbon.rotation.y = Math.PI / 2;
    this.roll.add(this.ribbon);
    const wax = toonMaterial({ color: new THREE.Color('#5b1a8a'), emissive: new THREE.Color('#2a0a40') }, { rimScale: 1.6 });
    this.seal = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.006, 18), wax);
    this.seal.rotation.x = Math.PI / 2;
    this.seal.position.set(0, 0, ROLL_R + 0.004);
    addOutline(this.seal, 0.0014);
    this.roll.add(this.seal);
    this.rollHome = { pos: this.roll.position.clone(), rot: this.roll.rotation.clone() };
    this.rollOut = new THREE.Vector3(0, 0.1, 0.42);   // out through the coffin's open front

    // the sheet that flies up to be read: the page (hangs from its top edge) and the roll it comes off
    this.sheet = new THREE.Group(); this.sheet.name = 'letter-sheet'; this.sheet.visible = false;
    parent.add(this.sheet);
    const pageGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H); pageGeo.translate(0, -PAGE_H / 2, 0);   // origin: the top edge
    this.letter = new THREE.Mesh(pageGeo, toonMaterial({ map: letterTexture(content), side: THREE.DoubleSide }, { rimScale: 0 }));
    this.letter.material.map.anisotropy = 16;
    this.letter.position.y = PAGE_H / 2;          // the sheet's origin is the page's middle (for framing)
    this.sheet.add(this.letter);
    this.unroller = makeRoll(paper, endMat);
    this.sheet.add(this.unroller);
    this._setUnroll(0);

    this.hitTargets = [...this.roll.parts, this.ribbon, this.seal, this.letter];
  }

  /** k = 0 rolled up … 1 fully open: the page shows k of its length, the roll sits at its lower edge, turned. */
  _setUnroll(k) {
    this.k = k;
    this.letter.scale.y = Math.max(0.001, k);
    const m = this.letter.material.map;
    if (m) { m.repeat.y = Math.max(0.001, k); m.offset.y = 1 - Math.max(0.001, k); }   // the top of the letter shows first
    this.unroller.position.set(0, PAGE_H / 2 - PAGE_H * k - ROLL_R * 0.9, ROLL_R * 0.4);
    this.unroller.rotation.x = -(PAGE_H * k) / ROLL_R;   // turning as the paper comes off it
  }

  /** How the letter sits when it's being read (see Presenter.target). */
  get readSpec() {
    return { width: PAGE_W, height: PAGE_H + ROLL_R * 2, fillH: 0.8, fillHPortrait: 0.62, fillW: 0.9, x: -0.13, y: 0.01, xPortrait: 0, yPortrait: 0.1 };
  }

  /** Untie the roll, lift it out of the coffin, and unroll the page as it floats up to be read. */
  open(onOut) {
    if (this.reading) return Promise.resolve();
    this.reading = true;
    const R = this.roll;
    return new Promise((resolve) => {
      const tl = gsap.timeline();
      if (!this.opened) {
        this.opened = true;
        tl.to(this.seal.position, { z: ROLL_R + 0.04, duration: 0.2, ease: 'power2.out' })
          .to(this.seal.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25 }, '<0.1')
          .to(this.ribbon.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.25 }, '<')
          .to(this.ribbon.material, { opacity: 0, duration: 0.25, onStart: () => { this.ribbon.material.transparent = true; } }, '<');
      }
      // out through the coffin's front, levelling as it comes
      tl.to(R.position, { x: this.rollOut.x, y: this.rollOut.y, z: this.rollOut.z, duration: 0.9, ease: 'power2.out' })
        .to(R.rotation, { z: 0, duration: 0.9, ease: 'power2.out' }, '<')
        .add(() => {
          onOut?.();
          // the sheet takes the roll's place exactly: its (rolled) roll where the coffin roll was
          this.group.updateMatrixWorld(true);
          const rollWorld = R.getWorldPosition(new THREE.Vector3());
          const q = this.group.getWorldQuaternion(new THREE.Quaternion());
          this._setUnroll(0);
          this.sheet.quaternion.copy(q);
          this.sheet.position.copy(rollWorld).sub(this.unroller.position.clone().applyQuaternion(q));
          this.sheet.scale.setScalar(1);
          this.sheet.visible = true;
          R.visible = false;
          // flight and unrolling in one motion
          const st = { k: 0 };
          gsap.to(st, { k: 1, duration: 1.25, ease: 'power3.inOut', onUpdate: () => this._setUnroll(st.k) });
          this.presenter.present(this.sheet, this.readSpec, { duration: 1.25, scale: 1 }).then(resolve);
        });
    });
  }

  /** Roll the page back up as it drifts down, and drop the roll into the coffin. */
  close() {
    if (!this.reading) return Promise.resolve();
    this.reading = false;
    const R = this.roll, S = this.sheet;
    this.presenter.release(S);
    return new Promise((resolve) => {
      this.group.updateMatrixWorld(true);
      const q0 = S.quaternion.clone(), q1 = this.group.getWorldQuaternion(new THREE.Quaternion());
      const p0 = S.position.clone();
      const rollOutWorld = this.group.localToWorld(this.rollOut.clone());
      const st = { k: 0 };
      gsap.timeline({ onComplete: resolve })
        .to(st, {
          k: 1, duration: 1.0, ease: 'power3.inOut',
          onUpdate: () => {
            this._setUnroll(1 - st.k);
            S.quaternion.slerpQuaternions(q0, q1, st.k);
            // aim the sheet so its roll lands where the coffin roll waits
            const p1 = rollOutWorld.clone().sub(this.unroller.position.clone().applyQuaternion(S.quaternion));
            S.position.lerpVectors(p0, p1, st.k);
          },
        })
        .add(() => { S.visible = false; R.visible = true; R.position.copy(this.rollOut); R.rotation.set(0, 0, 0); })
        .to(R.position, { x: this.rollHome.pos.x, y: this.rollHome.pos.y, z: this.rollHome.pos.z, duration: 0.6, ease: 'power2.in' })
        .to(R.rotation, { z: this.rollHome.rot.z, duration: 0.6, ease: 'power2.in' }, '<');
    });
  }

  reset() {
    this.opened = false;
    this.reading = false;
    this.presenter.release(this.sheet);
    this.sheet.visible = false;
    this._setUnroll(0);
    this.roll.visible = true;
    this.roll.position.copy(this.rollHome.pos); this.roll.rotation.copy(this.rollHome.rot);
    this.seal.position.set(0, 0, ROLL_R + 0.004); this.seal.scale.setScalar(1);
    this.ribbon.scale.setScalar(1); this.ribbon.material.opacity = 1;
  }

  _swapPage(blank) {
    const m = this.letter.material; m.map?.dispose();
    m.map = letterTexture(this.content, 1024, 1434, { blank }); m.map.anisotropy = 16; m.needsUpdate = true;
    this._setUnroll(this.k);
  }
  /** Repaint the page from (edited) content. */
  setContent(content) { this.content = content; this._swapPage(this._blank); }
  /** While the words are edited on top of the page, the page shows paper only. */
  setBlank(blank) { if (this._blank === blank) return; this._blank = blank; this._swapPage(blank); }

  /** The page's rectangle on screen (CSS px within the stage), while it is being read. */
  screenRect(camera, w, h) {
    if (!this.reading) return null;
    const pts = [[-PAGE_W / 2, 0], [PAGE_W / 2, -PAGE_H]].map(([x, y]) => this.letter.localToWorld(new THREE.Vector3(x, y, 0)).project(camera));
    const x0 = (pts[0].x * 0.5 + 0.5) * w, y0 = (-pts[0].y * 0.5 + 0.5) * h, x1 = (pts[1].x * 0.5 + 0.5) * w, y1 = (-pts[1].y * 0.5 + 0.5) * h;
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  get letterCenter() { return this.letter.localToWorld(new THREE.Vector3(0, -PAGE_H / 2, 0)); }
  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.02, 0.02)); }
}

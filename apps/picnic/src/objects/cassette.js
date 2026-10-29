import * as THREE from 'three';
import gsap from 'gsap';
import { cloneModel, findNode } from '../core/assets.js';
import { toonify, toonMaterial } from '../style/toon.js';
import { cassetteLabelTexture, hubTexture, planeRect, labelPictureAspect } from '../util/textures.js';

const SCALE = 1.6;
// Measured in the model's own space (front view of the window): the clear area behind the glass and
// where the player's two spindles sit in it (as fractions of that area, from the top-left).
const WINDOW = { x: 0, y: 0.0183, w: 0.0375, h: 0.0592, z: 0.0205 };   // glass is at z ≈ 0.0222
const REELS = [[0.544, 0.162, 0.136], [0.544, 0.824, 0.136]];          // [u, v, radius / width]
export const COVER_ASPECT = labelPictureAspect(WINDOW.w / WINDOW.h, REELS);   // the label picture's shape
const SEAT = { x: -0.001, y: 0.0185, z: 0.0168 };

/**
 * Poly Haven portable cassette player. The tape (with a photo label) lies beside it; pressing play
 * opens the door and slides the tape in. Once it's in, the window shows the label — sized to the
 * window, reels over the spindles — and the reels spin while the song plays.
 */
export class CassettePlayer {
  constructor(parent, anchor, { image } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'cassette-player';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);

    const model = cloneModel('portable_cassette_player');
    toonify(model, { outline: true, width: 0.0016, tint: new THREE.Color(1.15, 1.1, 1.15), skip: (o) => o.name === 'Plane097_1' || o.name === 'Cylinder015_1' });
    // the window stays real glass: mostly clear, so the tape inside shows through
    for (const n of ['Plane097_1', 'Cylinder015_1']) {
      const g = findNode(model, n);
      if (!g) continue;
      g.material = new THREE.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.12, depthWrite: false });
      g.renderOrder = 3;
    }
    model.scale.setScalar(SCALE);
    // the model's origin sits mid-height: lift it so it stands on the table
    model.position.y = 0.056 * SCALE;
    this.group.add(model);
    this.model = model;
    this.door = findNode(model, 'portable_cassette_player_lid');
    this.tape = findNode(model, 'portable_cassette_player_casette');

    // re-pivot the door on its bottom edge (measured from its real bounds)
    if (this.door) {
      this.group.updateMatrixWorld(true);
      const parentNode = this.door.parent;
      const box = new THREE.Box3().setFromObject(this.door);
      const lo = parentNode.worldToLocal(box.min.clone()), hi = parentNode.worldToLocal(box.max.clone());
      const hinge = new THREE.Group();
      hinge.position.set((lo.x + hi.x) / 2, Math.min(lo.y, hi.y), (lo.z + hi.z) / 2);
      parentNode.add(hinge);
      this.door.position.sub(hinge.position);
      hinge.add(this.door);
      this.hinge = hinge;
    }

    const label = cassetteLabelTexture(image, { aspect: WINDOW.w / WINDOW.h, reels: REELS });
    const labelMat = toonMaterial({ map: label }, { rimScale: 0 });
    this.labelMat = labelMat;
    const hubMat = toonMaterial({ map: hubTexture(), transparent: true, alphaTest: 0.4 }, { rimScale: 0 });
    const addHubs = (parentMesh, w, h, z) => REELS.map(([u, v, r]) => {
      const hub = new THREE.Mesh(new THREE.CircleGeometry(r * w * 0.95, 28), hubMat);
      hub.position.set((u - 0.5) * w, (0.5 - v) * h, z);
      parentMesh.add(hub);
      return hub;
    });

    // what you see through the window once the tape is in: exactly the window's size, behind the glass
    this.windowLabel = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.w, WINDOW.h), labelMat);
    this.windowLabel.position.set(WINDOW.x, WINDOW.y, WINDOW.z);
    this.windowLabel.visible = false;
    model.add(this.windowLabel);
    this.hubs = addHubs(this.windowLabel, WINDOW.w, WINDOW.h, 0.0002);

    if (this.tape) {
      // the same label on the loose tape's face (+Z in the tape's own, unit-scaled space)
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.98), labelMat);
      face.position.z = 0.125;
      this.tape.add(face);
      this.face = face;
      this.tapeHubs = addHubs(face, 1.2, 1.98, 0.004);
      this.tapeScale = this.tape.scale.clone();
      // resting on the table beside the player, label up
      this.tapeRest = { x: 0.1, y: -0.0498, z: 0.045 };
      this._rest();
    }
    this.playing = false;
    this.loaded = false;
    this.hitTargets = [];
    model.traverse((o) => { if (o.isMesh) this.hitTargets.push(o); });
  }

  _rest() {
    this.tape.visible = true;
    this.windowLabel.visible = false;
    this.tape.position.set(this.tapeRest.x, this.tapeRest.y, this.tapeRest.z);
    this.tape.rotation.set(-Math.PI / 2, 0, 0.35);
    this.tape.scale.copy(this.tapeScale);
  }

  /** Open the door, slide the tape in, close the door. Resolves when ready to play. */
  /** A new picture on the label. */
  setImage(image) {
    this.labelMat.map?.dispose();
    this.labelMat.map = cassetteLabelTexture(image, { aspect: WINDOW.w / WINDOW.h, reels: REELS });
    this.labelMat.needsUpdate = true;
  }

  /** The label on screen (the loose tape's, or the one in the window once it's in). */
  labelRect(camera, w, h) {
    const m = this.loaded || !this.face ? this.windowLabel : this.face;
    return m.visible !== false && planeRect(m, camera, w, h);
  }

  load() {
    if (this.loaded) return Promise.resolve();
    this.loaded = true;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      if (this.hinge) tl.to(this.hinge.rotation, { x: 0.95, duration: 0.6, ease: 'power2.out' });
      if (this.tape) {
        // lift and stand the tape up in front of the open door …
        tl.to(this.tape.position, { x: SEAT.x, y: SEAT.y + 0.02, z: SEAT.z + 0.05, duration: 0.65, ease: 'power2.inOut' }, '+=0.05')
          .to(this.tape.rotation, { x: 0, y: 0, z: 0, duration: 0.65, ease: 'power2.inOut' }, '<')
          // … slide it into the compartment, then the window shows its label (the tape itself stays hidden
          // inside the player, so nothing pokes through the door)
          .to(this.tape.position, { y: SEAT.y, z: SEAT.z, duration: 0.45, ease: 'power2.in' })
          .add(() => { this.tape.visible = false; this.windowLabel.visible = true; });
      }
      if (this.hinge) tl.to(this.hinge.rotation, { x: 0, duration: 0.35, ease: 'power3.in' }, '+=0.05');
    });
  }

  reset() {
    this.loaded = false;
    this.playing = false;
    if (this.hinge) this.hinge.rotation.x = 0;
    if (this.tape) this._rest();
  }

  update(t, dt = 0.016) {
    // a tiny bounce to the beat while playing, reels turning
    this.model.scale.y = SCALE * (this.playing ? 1 + Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)) * 0.006 : 1);
    if (this.playing) for (const h of this.hubs) h.rotation.z -= dt * 3.2;
  }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.1, 0)); }
}

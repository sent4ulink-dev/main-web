import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial } from '../style/toon.js';
import { piece } from '../world/salon.js';
import { parchment } from '../world/salonTextures.js';

// "A little magic", 18th-century style: the quill lifts out of the inkwell by itself, writes the name in
// calligraphy on a sheet of parchment, the ink turns to gold — and (story.js) the letters fly up as stars.

const PW = 0.3, PH = 0.4;

export class Quill {
  constructor(scene, desk) {
    this.group = new THREE.Group();
    this.group.name = 'quill-magic';
    scene.add(this.group);
    const top = desk.pos.clone().add(new THREE.Vector3(0, 0.768, 0));
    this.paperTex = parchment();
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), toonMaterial({ map: this.paperTex.texture }, { rimScale: 0.2 }));
    this.paper.rotation.set(-Math.PI / 2, 0, 0.12);
    this.paper.position.copy(top).add(new THREE.Vector3(-0.02, 0.001, 0.04));
    this.paper.receiveShadow = true;
    this.group.add(this.paper);
    this.quill = piece('decor', 'quill', { outline: 0.0012 });
    this.group.add(this.quill);
    // at rest: nib in the inkwell, feather leaning back
    this.inkTip = desk.pos.clone().add(new THREE.Vector3(0.3, 0.83, -0.08));
    this.restQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0.25, 0.9, -0.35).normalize());
    this.quill.position.copy(this.inkTip);
    this.quill.quaternion.copy(this.restQuat);
    this.writeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0.35, 0.85, 0.35).normalize());
    this.written = false;
    this.name = '';
    this.hitTargets = [];
    for (const g of [this.paper, this.quill]) g.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
  }

  /** Put the quill so its nib tip (≈2.4 cm beyond its origin, along +Z) is at `point`. */
  nibAt(point) { this.quill.position.copy(point).sub(new THREE.Vector3(0, 0, 0.024).applyQuaternion(this.quill.quaternion)); }

  /** World point on the parchment at uv (0..1, from bottom-left). */
  uv(u, v, lift = 0) {
    this.paper.updateMatrixWorld(true);
    return this.paper.localToWorld(new THREE.Vector3((u - 0.5) * PW, (v - 0.5) * PH, lift));
  }

  get paperCenter() { return this.uv(0.5, 0.55, 0.02); }
  get focusPoint() { return this.uv(0.5, 0.5, 0.06); }

  /** Write the name; resolves once the ink has turned to gold. */
  write(name) {
    this.name = name;
    if (this.written) { this.paperTex.draw(1, name, 1); return Promise.resolve(); }
    const q = this.quill, st = { p: 0, glow: 0, lean: 0 };
    const lean = () => q.quaternion.slerpQuaternions(this.restQuat, this.writeQuat, st.lean);
    const start = this.uv(0.12, 0.56, 0.006);
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { this.written = true; resolve(); } })
        // up out of the inkwell, over to the page, leaning into the writing
        .to(q.position, { x: this.inkTip.x, y: this.inkTip.y + 0.12, z: this.inkTip.z, duration: 0.6, ease: 'power2.out' })
        .to(q.position, { x: start.x, y: start.y + 0.07, z: start.z, duration: 0.9, ease: 'power2.inOut' })
        .to(st, { lean: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: lean }, 0.3)
        // the name, letter by letter: the nib follows the ink, with little loops
        .to(st, {
          p: 1, duration: 2.8, ease: 'none',
          onUpdate: () => {
            const t = this.paperTex.draw(st.p, name, 0);
            this.nibAt(this.uv(Math.min(0.97, t.u) + Math.cos(st.p * 70) * 0.01, t.v + Math.sin(st.p * 70) * 0.02, 0.003 + Math.max(0, Math.sin(st.p * 140)) * 0.006));
          },
        })
        // back into the inkwell while the ink turns to gold
        .to(q.position, { x: this.inkTip.x, y: this.inkTip.y + 0.12, z: this.inkTip.z, duration: 0.9, ease: 'power2.inOut' })
        .to(st, { lean: 0, duration: 0.9, ease: 'power2.inOut', onUpdate: lean }, '<')
        .to(q.position, { y: this.inkTip.y, duration: 0.35, ease: 'power2.in' })
        .to(st, { glow: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: () => this.paperTex.draw(1, name, st.glow) }, '-=0.7');
    });
  }

  setName(name) { if (this.written) this.paperTex.draw(1, name, 1); this.name = name; }

  reset() {
    gsap.killTweensOf(this.quill.position);
    this.written = false;
    this.paperTex.draw(0, '');
    this.quill.position.copy(this.inkTip);
    this.quill.quaternion.copy(this.restQuat);
  }
}

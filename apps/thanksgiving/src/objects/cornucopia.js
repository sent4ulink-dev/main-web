import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/props.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A plain float copy of a (possibly compressed) attribute. */
function floatAttr(a) { const out = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k); return new THREE.BufferAttribute(out, a.itemSize); }

// The horn of plenty, the table's centrepiece at the far end: a pumpkin, a squash, an ear of corn, grapes,
// apples, a pear and a few autumn leaves spilling from its mouth. (It can also tuck them all back in and tip
// them out again, each piece bouncing to rest where it belongs.)

export class Cornucopia {
  constructor(parent) {
    this.root = piece('cornucopia');
    parent.add(this.root);
    this.root.position.set(-0.1, 0, 0.02);
    this.root.rotation.y = 0.15;
    this.root.scale.setScalar(0.85);
    this.root.updateMatrixWorld(true);
    // each piece of fruit gets a pivot at its own middle (so it can tumble about itself)
    this.items = [];
    const mouth = new THREE.Vector3(0.24, 0.2, 0);
    const box = new THREE.Box3(), inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const child of [...this.root.children]) {
      if (!child.name.startsWith('cp_') || child.name === 'cp_horn') continue;
      box.setFromObject(child).applyMatrix4(inv);
      const c = box.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group(); pivot.name = `${child.name}-pivot`;
      pivot.position.copy(c);
      this.root.add(pivot);
      child.position.sub(c);
      pivot.add(child);
      this.items.push({ pivot, home: c.clone(), mouth: mouth.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.08)), leaf: child.name.startsWith('cp_leaf') });
    }
    this.hitTargets = [];
    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
    this.spilled = false;
    this.tuck();
  }

  get focusPoint() { return this.root.localToWorld(new THREE.Vector3(0.1, 0.2, 0)); }

  /** Everything already out, where it belongs. */
  spillNow() {
    this.spilled = true;
    for (const it of this.items) { gsap.killTweensOf(it.pivot.position); gsap.killTweensOf(it.pivot.rotation); gsap.killTweensOf(it.pivot.scale); it.pivot.position.copy(it.home); it.pivot.scale.setScalar(1); it.pivot.rotation.set(0, 0, 0); it.pivot.visible = true; }
  }

  /** For good, as the table's centrepiece: the spilled harvest baked into one mesh per colour (a handful of
   *  draws instead of dozens). The horn itself keeps its outline. */
  bake() {
    this.spillNow();
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert(), byMat = new Map(), drop = [];
    for (const it of this.items) {
      it.pivot.traverse((o) => {
        if (!o.isMesh || o.userData.isOutline) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', floatAttr(o.geometry.attributes.position));
        if (o.geometry.attributes.normal) g.setAttribute('normal', floatAttr(o.geometry.attributes.normal));
        if (o.geometry.index) g.setIndex([...o.geometry.index.array]);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        const list = byMat.get(o.material) || []; list.push(g.index ? g.toNonIndexed() : g); byMat.set(o.material, list);
      });
      drop.push(it.pivot);
    }
    for (const p of drop) p.parent?.remove(p);
    for (const [m, gs] of byMat) { const mesh = new THREE.Mesh(mergeGeometries(gs), m); mesh.name = 'harvest-baked'; this.root.add(mesh); }
    this.items = [];
    this.baked = true;
  }

  /** Everything back inside the horn (small, out of sight). */
  tuck() {
    this.spilled = false;
    for (const it of this.items) { gsap.killTweensOf(it.pivot.position); gsap.killTweensOf(it.pivot.rotation); gsap.killTweensOf(it.pivot.scale); it.pivot.position.copy(it.mouth); it.pivot.scale.setScalar(0.25); it.pivot.rotation.set(0, 0, 0); it.pivot.visible = false; }
  }

  /** The harvest tumbles out. onBump(i) fires as each piece lands. */
  spill({ onBump = () => {} } = {}) {
    if (this.spilled) return Promise.resolve();
    this.spilled = true;
    const order = this.items.map((it, i) => i).sort((a, b) => this.items[a].leaf - this.items[b].leaf);
    const all = order.map((i, k) => new Promise((resolve) => {
      const it = this.items[i], p = it.pivot, d = 0.08 + k * 0.11;
      p.visible = true;
      const from = it.mouth.clone(), to = it.home.clone();
      const st = { u: 0 };
      gsap.to(p.scale, { x: 1, y: 1, z: 1, duration: 0.35, delay: d, ease: 'back.out(2)' });
      gsap.to(st, { u: 1, duration: it.leaf ? 1.1 : 0.7, delay: d, ease: it.leaf ? 'sine.out' : 'power1.in',
        onUpdate: () => {
          p.position.lerpVectors(from, to, st.u);
          p.position.y += Math.sin(st.u * Math.PI) * (it.leaf ? 0.22 : 0.12);
          if (it.leaf) { p.position.x += Math.sin(st.u * 9) * 0.03; p.rotation.z = Math.sin(st.u * 7) * 0.6; }
          else p.rotation.x = st.u * Math.PI * 2 * (i % 2 ? 1 : -1);
        },
        onComplete: () => {
          p.rotation.x = 0;
          if (!it.leaf) { onBump(k); gsap.fromTo(p.position, { y: to.y + 0.03 }, { y: to.y, duration: 0.35, ease: 'bounce.out' }); }
          resolve();
        } });
    }));
    return Promise.all(all);
  }
}

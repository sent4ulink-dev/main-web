import * as THREE from 'three';
import { wind } from '../world/wind.js';

// Latex balloons on strings: simple verlet-style physics with buoyancy, wind and string length.

const COLORS = [0xd8343c, 0xf2c14e, 0xf7f3e8, 0x2fa39a, 0x2b2f35, 0xe8763a];
const STRING = [1.15, 1.32, 1.05, 1.42, 1.22, 1.5];

function balloonGeometry() {
  const pts = [];
  const H = 0.36, R = 0.145, C = 0.58; // widest point at 58% of the height
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;                // 0 bottom (knot) → 1 top
    const y = t * H;
    let r;
    if (t >= C) r = R * Math.sqrt(Math.max(0, 1 - Math.pow((t - C) / (1 - C), 2)));   // round dome
    else r = R * Math.pow(Math.sin((t / C) * Math.PI / 2), 1.35);                     // tapering to the neck
    r = Math.max(r, t < 0.05 ? 0.007 : 0);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  g.translate(0, 0.012, 0);
  return g;
}

export class Balloons {
  constructor(scene, anchorWorld, count = 6) {
    this.anchor = anchorWorld.clone();
    this.group = new THREE.Group();
    this.group.name = 'balloons';
    scene.add(this.group);
    const geo = balloonGeometry();
    const knotGeo = new THREE.ConeGeometry(0.012, 0.02, 10);
    knotGeo.rotateX(Math.PI);
    knotGeo.translate(0, 0.006, 0);
    this.items = [];
    this.hitTargets = [];

    // little weight the strings are tied to: a wrapped gift box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.07), new THREE.MeshPhysicalMaterial({ color: 0xf2b8c6, roughness: 0.4, sheen: 0.6, clearcoat: 0.3 }));
    box.position.copy(this.anchor).add(new THREE.Vector3(0, 0.03, 0));
    box.castShadow = true;
    const ribbonMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.8 });
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.062, 0.012), ribbonMat);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.062, 0.074), ribbonMat);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 16), ribbonMat);
    bow.rotation.x = Math.PI / 2; bow.position.y = 0.034;
    box.add(rib1, rib2, bow);
    this.group.add(box);
    this.tie = this.anchor.clone().add(new THREE.Vector3(0, 0.07, 0));

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: COLORS[i % COLORS.length], roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08,
        sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(1, 1, 1), emissive: new THREE.Color(COLORS[i % COLORS.length]), emissiveIntensity: 0.06,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      const knot = new THREE.Mesh(knotGeo, mat);
      mesh.add(knot);
      const a = (i / count) * Math.PI * 2;
      const len = STRING[i % STRING.length];
      const p = this.tie.clone().add(new THREE.Vector3(Math.cos(a) * 0.25, len * 0.95, Math.sin(a) * 0.25));
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf5f0ea, transparent: true, opacity: 0.85 }));
      line.frustumCulled = false;
      this.group.add(mesh, line);
      mesh.userData.index = i;
      this.hitTargets.push(mesh);
      this.items.push({ mesh, line, p, prev: p.clone(), len, released: false, spin: Math.random() * 6, opacity: 1, mat });
    }
  }

  /** Release the balloon (by index, or the next one still tied). Returns its index or -1. */
  release(index) {
    const it = index !== undefined ? this.items[index] : this.items.find((b) => !b.released);
    if (!it || it.released) return -1;
    it.released = true;
    it.prev.y -= 0.02; // little upward kick
    return this.items.indexOf(it);
  }

  get remaining() { return this.items.filter((b) => !b.released).length; }

  /** Middle of the bunch still tied on (for placing text beside it). */
  get center() {
    const left = this.items.filter((b) => !b.released);
    if (!left.length) return this.tie.clone().add(new THREE.Vector3(0, 0.9, 0));
    return left.reduce((s, b) => s.add(b.p), new THREE.Vector3()).multiplyScalar(1 / left.length).add(new THREE.Vector3(0, -0.15, 0));
  }

  reset() {
    this.items.forEach((it, i) => {
      const a = (i / this.items.length) * Math.PI * 2;
      it.p.copy(this.tie).add(new THREE.Vector3(Math.cos(a) * 0.25, it.len * 0.95, Math.sin(a) * 0.25));
      it.prev.copy(it.p);
      it.released = false;
      it.mesh.visible = true; it.line.visible = true;
      it.mat.opacity = 1; it.mat.transparent = false;
    });
  }

  update(t, dt) {
    const wd = wind.uniforms.uWindDir.value, ws = wind.uniforms.uWindStrength.value;
    const step = Math.min(dt, 1 / 30);
    const up = new THREE.Vector3();
    for (const [i, it] of this.items.entries()) {
      if (!it.mesh.visible) continue;
      // verlet integrate
      const vel = it.p.clone().sub(it.prev).multiplyScalar(0.985);
      it.prev.copy(it.p);
      const gust = 0.6 + 0.4 * Math.sin(t * 0.9 + i * 1.7) + 0.3 * Math.sin(t * 2.3 + i);
      const force = up.set(wd.x * ws * gust * 0.55, it.released ? 0.9 : 1.1, wd.y * ws * gust * 0.55);
      force.x += Math.sin(t * 1.3 + i * 2.1) * 0.12;
      force.z += Math.cos(t * 1.1 + i * 1.3) * 0.12;
      it.p.add(vel).addScaledVector(force, step * step);
      if (!it.released) {
        // string constraint
        const d = it.p.clone().sub(this.tie);
        const L = d.length();
        if (L > it.len) it.p.copy(this.tie).addScaledVector(d, it.len / L);
        // balloons push each other apart
        for (const [j, o] of this.items.entries()) {
          if (j === i || o.released) continue;
          const dd = it.p.clone().sub(o.p);
          const l = dd.length();
          if (l < 0.3 && l > 1e-4) it.p.addScaledVector(dd, (0.3 - l) * 0.25 / l);
        }
      } else if (it.p.y > this.tie.y + 14) {
        it.mat.transparent = true;
        it.mat.opacity = Math.max(0, it.mat.opacity - dt * 0.5);
        if (it.mat.opacity <= 0) { it.mesh.visible = false; it.line.visible = false; }
      }
      // orient along the string, gentle spin
      it.spin += dt * 0.3;
      it.mesh.position.copy(it.p);
      const dir = it.released ? new THREE.Vector3(0, 1, 0) : it.p.clone().sub(this.tie).normalize();
      it.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      it.mesh.rotateY(it.spin);
      // string: sagging curve from tie to knot
      const pos = it.line.geometry.attributes.position;
      const end = it.released ? it.p.clone().add(new THREE.Vector3(0, -0.6, 0)) : this.tie;
      for (let k = 0; k < 16; k++) {
        const s = k / 15;
        const x = THREE.MathUtils.lerp(it.p.x, end.x, s);
        const y = THREE.MathUtils.lerp(it.p.y, end.y, s) - Math.sin(s * Math.PI) * 0.04;
        const z = THREE.MathUtils.lerp(it.p.z, end.z, s) + Math.sin(s * Math.PI * 2 + t * 2 + i) * 0.01;
        pos.setXYZ(k, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }
}

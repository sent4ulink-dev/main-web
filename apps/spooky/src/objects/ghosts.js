import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { glowTexture } from '../world/nightTextures.js';

// A cartoon sheet ghost: a round head flowing into a skirt with a wavy, rippling hem, two big black eyes,
// a mouth that can smile, say "ooo" or open wide for a BOO, and two stubby arms. It glows faintly blue.
// Origin at the bottom of the hem; 1 unit ≈ 1 m tall at scale 1.

const PROFILE = [[0, 1.0], [0.16, 0.985], [0.27, 0.93], [0.335, 0.84], [0.355, 0.73], [0.35, 0.6], [0.36, 0.45], [0.39, 0.3], [0.44, 0.15], [0.5, 0.02], [0.49, 0.0]]
  .map(([r, y]) => new THREE.Vector2(r, y));

let _glow = null;

export class Ghost {
  constructor({ scale = 1, tint = '#f3f0ff', glow = true } = {}) {
    this.group = new THREE.Group(); this.group.name = 'ghost';
    this.inner = new THREE.Group();           // bob / lean here, the outer group is positioned by the owner
    this.group.add(this.inner);
    this.group.scale.setScalar(scale);
    const geo = new THREE.LatheGeometry(PROFILE, 40);
    this.base = Float32Array.from(geo.attributes.position.array);
    this.geo = geo;
    this.mat = toonMaterial({ color: new THREE.Color(tint), emissive: new THREE.Color('#6d63b8'), emissiveIntensity: 0.35, transparent: true, opacity: 0.94, side: THREE.DoubleSide }, { rimScale: 2.2 });
    this.body = new THREE.Mesh(geo, this.mat);
    this.body.castShadow = false;
    addOutline(this.body, 0.0022, 0x1d1530);
    this.body.userData.outline.geometry = geo;   // the ink line ripples with the hem
    this.inner.add(this.body);
    // face: eyes and mouth (black, slightly domed) on the front (+Z)
    const ink = new THREE.MeshBasicMaterial({ color: 0x120c1c });
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), ink);
      e.scale.set(0.8, 1.25, 0.35);
      e.position.set(s * 0.11, 0.76, 0.322);
      e.rotation.y = s * 0.3;
      this.inner.add(e);
      return e;
    });
    // a little white shine in each eye
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyes.forEach((e) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), shine); s.position.set(0.018, 0.022, 0.05); e.add(s); });
    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), ink);
    this.mouth.position.set(0, 0.63, 0.33);
    this.inner.add(this.mouth);
    this.setFace('smile');
    // stubby arms
    this.arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.33, 0.55, 0.02);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 6, 12), this.mat);
      arm.position.set(s * 0.08, -0.06, 0); arm.rotation.z = s * 1.0;
      addOutline(arm, 0.0022, 0x1d1530);
      pivot.add(arm);
      this.inner.add(pivot);
      return pivot;
    });
    if (glow) {
      _glow ||= glowTexture(128);
      this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glow, color: 0x9fb4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.halo.scale.set(1.7, 1.7, 1); this.halo.position.y = 0.55;
      this.inner.add(this.halo);
    }
    this.phase = Math.random() * 10;
    this.wave = 1;
  }

  /** 'smile' | 'ooo' | 'boo' | 'sad' */
  setFace(kind) {
    const m = this.mouth;
    this.face = kind;
    if (kind === 'boo') { m.scale.set(1.5, 2.1, 0.5); m.position.y = 0.6; this.eyes.forEach((e) => e.scale.set(0.95, 1.5, 0.35)); }
    else if (kind === 'ooo') { m.scale.set(0.7, 1.0, 0.4); m.position.y = 0.62; this.eyes.forEach((e) => e.scale.set(0.8, 1.25, 0.35)); }
    else { m.scale.set(1.25, 0.55, 0.35); m.position.y = 0.635; this.eyes.forEach((e) => e.scale.set(0.8, 1.25, 0.35)); }
  }

  set opacity(v) { this.mat.opacity = 0.94 * v; this.mat.depthWrite = v > 0.99; if (this.halo) this.halo.material.opacity = 0.35 * v; this.group.visible = v > 0.01; }

  update(t, dt) {
    const tt = t + this.phase;
    // the hem ripples (vertices near the bottom swing up and down round the skirt)
    const pos = this.geo.attributes.position, b = this.base;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const w = THREE.MathUtils.smoothstep(0.42 - y, 0, 0.42) * this.wave;
      if (w <= 0) { pos.setXYZ(i, x, y, z); continue; }
      const a = Math.atan2(z, x);
      pos.setXYZ(i, x * (1 + 0.04 * w * Math.sin(tt * 3 + a * 2)), y + w * 0.07 * Math.sin(a * 7 + tt * 5), z * (1 + 0.04 * w * Math.sin(tt * 3 + a * 2)));
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.inner.position.y = 0.08 * Math.sin(tt * 1.8);
    this.inner.rotation.z = 0.06 * Math.sin(tt * 1.1);
    this.arms[0].rotation.z = 0.25 * Math.sin(tt * 2.4);
    this.arms[1].rotation.z = -0.25 * Math.sin(tt * 2.4 + 1);
  }
}

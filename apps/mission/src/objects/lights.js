import * as THREE from 'three';
import { wind } from '../world/wind.js';

/** Warm string lights strung between points, plus lantern glows. Fade in as the evening falls. */
export class EveningLights {
  constructor(scene, spans, lanterns = [], { warmLight = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'evening-lights';
    scene.add(this.group);
    this.level = 0;
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2a2228 });
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: new THREE.Color(1.0, 0.72, 0.38), emissiveIntensity: 0, roughness: 0.3 });
    const bulbGeo = new THREE.SphereGeometry(0.022, 12, 10);
    bulbGeo.scale(1, 1.25, 1);
    this.spans = [];
    let total = 0;
    const spanPts = spans.map(({ a, b, sag, bulbs }) => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const s = i / 48;
        const p = a.clone().lerp(b, s);
        p.y -= Math.sin(s * Math.PI) * sag;
        pts.push(p);
      }
      total += bulbs;
      return { pts, bulbs, a, b, sag };
    });
    this.bulbs = new THREE.InstancedMesh(bulbGeo, this.bulbMat, total);
    this.bulbs.frustumCulled = false;
    let k = 0;
    this.bulbData = [];
    for (const sp of spanPts) {
      const curve = new THREE.CatmullRomCurve3(sp.pts);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0035, 5), wireMat);
      this.group.add(wire);
      for (let i = 0; i < sp.bulbs; i++) {
        const s = (i + 0.5) / sp.bulbs;
        const p = curve.getPoint(s);
        this.bulbData.push({ p: p.clone().add(new THREE.Vector3(0, -0.03, 0)), phase: Math.random() * 6 });
        k++;
      }
    }
    this.group.add(this.bulbs);

    // lanterns: emissive core + bloom (no extra lights)
    this.lanternCores = lanterns.map((lan) => {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.25) }));
      core.position.set(0, 0.095, 0);
      core.visible = false;
      lan.add(core);
      return core;
    });

    // one shared warm light so the table glows at night
    if (warmLight) {
      this.warm = new THREE.PointLight(0xffb36b, 0, 9, 1.6);
      this.warm.position.set(0.4, 2.0, -0.6);
      scene.add(this.warm);
    }
    this._m = new THREE.Matrix4();
  }

  setLevel(v) { this.level = v; }

  update(t) {
    const L = this.level;
    this.bulbMat.emissiveIntensity = L * 3.2;
    const ws = wind.uniforms.uWindStrength.value;
    this.bulbData.forEach((b, i) => {
      const sway = Math.sin(t * 1.4 + b.phase) * 0.01 * ws;
      this._m.makeTranslation(b.p.x + sway, b.p.y + Math.sin(t * 1.1 + b.phase) * 0.004, b.p.z + sway * 0.5);
      this.bulbs.setMatrixAt(i, this._m);
    });
    this.bulbs.instanceMatrix.needsUpdate = true;
    for (const c of this.lanternCores) {
      c.visible = L > 0.02;
      const f = 0.85 + 0.15 * Math.sin(t * 13 + c.id) * Math.sin(t * 7.3);
      c.material.color.setRGB(1 * L * 4 * f, 0.62 * L * 4 * f, 0.25 * L * 4 * f);
    }
    if (this.warm) this.warm.intensity = L * 4.5;
  }
}

import * as THREE from 'three';

// Bursts of golden confetti (the wish granted, the family photo) or autumn leaves, fluttering down to the
// floor. One instanced draw; nothing runs while it's idle.

const PALETTES = {
  gold: [0xF2C46D, 0xE3A857, 0xFFF1C9, 0xD4A24C, 0xFFFFFF, 0xCC5500],
  leaves: [0xC2361F, 0xD96A1E, 0xE0A830, 0xB5523A, 0x8A3B22, 0xE07A1F],
};

export class Confetti {
  constructor(scene, count = 360) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.022, 0.032), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), count);
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
    this.p = new Float32Array(count * 3); this.v = new Float32Array(count * 3); this.r = new Float32Array(count * 3); this.w = new Float32Array(count * 3);
    this.alive = 0; this.floor = 0;
    this._d = new THREE.Object3D();
  }

  burst(origin, { palette = 'gold', spread = 1, floor = 0, up = 3.2 } = {}) {
    const pal = PALETTES[palette] || PALETTES.gold, c = new THREE.Color();
    this.floor = floor; this.alive = 6; this.mesh.visible = true;
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * spread;
      this.p[i * 3] = origin.x + (Math.random() - 0.5) * 0.15; this.p[i * 3 + 1] = origin.y; this.p[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.15;
      this.v[i * 3] = Math.cos(a) * s * 1.4; this.v[i * 3 + 1] = up * (0.6 + Math.random() * 0.8); this.v[i * 3 + 2] = Math.sin(a) * s * 1.4;
      for (let k = 0; k < 3; k++) { this.r[i * 3 + k] = Math.random() * 6; this.w[i * 3 + k] = (Math.random() - 0.5) * 14; }
      this.mesh.setColorAt(i, c.setHex(pal[i % pal.length]).multiplyScalar(palette === 'gold' ? 1.25 : 1));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(t, dt) {
    if (!this.mesh.visible) return;
    this.alive -= dt;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3, drag = Math.exp(-dt * 3.0);
      this.v[i3 + 1] -= 8.5 * dt;
      this.v[i3] = this.v[i3] * drag + Math.sin(t * 3 + i) * 0.25 * dt * 3;
      this.v[i3 + 2] = this.v[i3 + 2] * drag + Math.cos(t * 2.7 + i) * 0.25 * dt * 3;
      this.v[i3 + 1] = Math.max(this.v[i3 + 1] * drag, -0.6);
      if (this.p[i3 + 1] > this.floor + 0.01) {
        this.p[i3] += this.v[i3] * dt; this.p[i3 + 1] += this.v[i3 + 1] * dt; this.p[i3 + 2] += this.v[i3 + 2] * dt;
        for (let k = 0; k < 3; k++) this.r[i3 + k] += this.w[i3 + k] * dt;
      }
      this._d.position.set(this.p[i3], Math.max(this.floor + 0.01, this.p[i3 + 1]), this.p[i3 + 2]);
      this._d.rotation.set(this.r[i3], this.r[i3 + 1], this.r[i3 + 2]);
      this._d.scale.setScalar(this.alive > 0 ? 1 : Math.max(0, 1 + this.alive));
      this._d.updateMatrix();
      this.mesh.setMatrixAt(i, this._d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.alive < -1) this.mesh.visible = false;
  }
}

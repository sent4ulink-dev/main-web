import * as THREE from 'three';

// A flock of cartoon bats (the Blender bat, wings on pivots): they circle the mansion's tower, swoop past now
// and then, and — for the finale — gather round the moon in the shape of a heart.

export class Bats {
  constructor(scene, makeBat, { count = 18, centre = new THREE.Vector3(-3.4, 9, -15), moonAt = null } = {}) {
    this.group = new THREE.Group(); this.group.name = 'bats';
    scene.add(this.group);
    this.centre = centre.clone();
    this.moonAt = moonAt;
    this.items = [];
    for (let i = 0; i < count; i++) {
      const b = makeBat();
      b.scale.setScalar(1.4 + Math.random() * 0.8);
      b.userData.s0 = b.scale.x;
      this.group.add(b);
      const wl = b.getObjectByName('bat_wing_l'), wr = b.getObjectByName('bat_wing_r');
      this.items.push({ b, s0: b.scale.x, wl, wr, phase: Math.random() * 10, r: 2.5 + Math.random() * 4, h: (Math.random() - 0.5) * 3, speed: 0.5 + Math.random() * 0.5, flap: 10 + Math.random() * 6, pos: new THREE.Vector3(), target: new THREE.Vector3() });
    }
    this.mode = 'circle';
    this.k = 0;   // 0 = circling, 1 = in the heart
  }

  /** Gather round the moon as a heart (or go back to circling). */
  heart(on) { this.mode = on ? 'heart' : 'circle'; }

  _heartPoint(i, n, out) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const m = this.moonAt;
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(m.clone().normalize(), up).normalize();
    return out.copy(m).addScaledVector(right, x * 1.15).addScaledVector(up, y * 1.15 + 2.5);
  }

  update(t, dt) {
    const want = this.mode === 'heart' && this.moonAt ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * 0.9);
    const n = this.items.length, tmp = new THREE.Vector3();
    this.items.forEach((it, i) => {
      const a = t * it.speed + it.phase;
      // circling the tower, bobbing
      it.target.set(this.centre.x + Math.cos(a) * it.r, this.centre.y + it.h + Math.sin(a * 2.3) * 0.6, this.centre.z + Math.sin(a) * it.r * 0.7);
      if (this.k > 0.001) this._heartPoint(i, n, tmp).add(new THREE.Vector3(Math.sin(t * 2 + i) * 0.25, Math.cos(t * 1.7 + i) * 0.25, 0)), it.target.lerp(tmp, this.k);
      const prev = it.pos.clone();
      if (!it.init) { it.pos.copy(it.target); it.init = true; }
      it.pos.lerp(it.target, Math.min(1, dt * 2.2));
      it.b.position.copy(it.pos);
      it.b.scale.setScalar(it.s0 * (1 + this.k * 2.2));   // big enough to read as a heart round the moon
      const v = it.pos.clone().sub(prev);
      const faceY = this.moonAt ? Math.atan2(-this.moonAt.x, -this.moonAt.z) : 0;   // facing whoever looks at the moon
      if (this.k > 0.6) it.b.rotation.y += (faceY - it.b.rotation.y) * Math.min(1, dt * 4);
      else if (v.lengthSq() > 1e-6) it.b.rotation.y = Math.atan2(v.x, v.z);
      it.b.rotation.z = Math.sin(a * 3) * 0.2;
      const f = Math.sin(t * it.flap + it.phase) * 0.9;
      if (it.wl) it.wl.rotation.y = f;
      if (it.wr) it.wr.rotation.y = -f;
    });
  }
}

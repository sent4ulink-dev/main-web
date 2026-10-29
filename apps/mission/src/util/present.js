import * as THREE from 'three';
import gsap from 'gsap';

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(), _right = new THREE.Vector3();

/**
 * Floats objects up in front of the camera for reading (the letter, the new polaroid) and keeps them
 * there, framed, while the camera drifts. Each object keeps its natural size; the distance is chosen
 * so it fills the requested share of the view, and it can sit off-centre to leave room for text.
 */
export class Presenter {
  constructor(camera) {
    this.camera = camera;
    this.items = new Map();
  }

  /** spec: { width, height, fillH, fillW, x, y } — x/y shift the centre in fractions of the view. */
  target(spec, out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }) {
    const cam = this.camera;
    const portrait = cam.aspect < 1.1;
    const fillH = (portrait ? spec.fillHPortrait : spec.fillH) ?? spec.fillH ?? 0.74;
    const fillW = spec.fillW ?? 0.86;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), tanH = tanV * cam.aspect;
    const dist = Math.max(spec.height / (2 * tanV * fillH), spec.width / (2 * tanH * fillW));
    cam.getWorldDirection(_v);
    _up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    _right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const x = (portrait ? spec.xPortrait : spec.x) ?? 0, y = (portrait ? spec.yPortrait : spec.y) ?? 0;
    out.pos.copy(cam.position).addScaledVector(_v, dist)
      .addScaledVector(_right, x * 2 * dist * tanH).addScaledVector(_up, y * 2 * dist * tanV);
    out.quat.copy(cam.quaternion);
    return out;
  }

  /** Fly `obj` (a child of the scene root) from where it is to its reading pose. */
  present(obj, spec, { duration = 1.1, scale = 1 } = {}) {
    const item = { spec, k: 0, p0: obj.position.clone(), q0: obj.quaternion.clone(), s0: obj.scale.clone(), s1: new THREE.Vector3().setScalar(scale), pose: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() } };
    this.items.set(obj, item);
    return new Promise((resolve) => gsap.to(item, { k: 1, duration, ease: 'power3.inOut', onComplete: resolve }));
  }

  release(obj) { this.items.delete(obj); }
  has(obj) { return this.items.has(obj); }

  update() {
    for (const [obj, it] of this.items) {
      this.target(it.spec, it.pose);
      obj.position.lerpVectors(it.p0, it.pose.pos, it.k);
      _q.slerpQuaternions(it.q0, it.pose.quat, it.k);
      obj.quaternion.copy(_q);
      obj.scale.lerpVectors(it.s0, it.s1, it.k);
    }
  }
}

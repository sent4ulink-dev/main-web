import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/courtyard.js';
import { softSprite } from '../util/textures.js';
import { toonMaterial } from '../style/toon.js';

// The marksman's rifle on the tower (an original, generic bolt-action design with a big scope): first you see
// it, then you take aim — the view glides into the scope — then the shot: flash, kick, and the bolt cycles.

export class Sniper {
  /** rest: where the bipod stands; target: the point the rifle is laid on. */
  constructor(scene, { rest, target }) {
    this.target = target.clone();
    this.group = new THREE.Group(); this.group.name = 'sniper';
    scene.add(this.group);
    this.mount = new THREE.Group();
    this.mount.position.copy(rest).add(new THREE.Vector3(0, 0.3, 0));
    this.group.add(this.mount);
    this.kick = new THREE.Group();
    this.mount.add(this.kick);
    this.rifle = piece('tactical', 'sniper', { outline: 0.0014 });
    this.rifle.rotation.y = -Math.PI / 2;   // barrel (+X) onto +Z, so the mount can lookAt()
    this.kick.add(this.rifle);
    this.mount.lookAt(this.target);
    this.mount.updateMatrixWorld(true);
    this.bolt = this.rifle.getObjectByName('sniper_bolt');
    this.eye = this.rifle.getObjectByName('scope_eye');
    this.muzzle = this.rifle.getObjectByName('sn_muzzle');
    this.ejection = this.rifle.getObjectByName('sn_ejection');
    this.hitTargets = [];
    this.rifle.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(64, 0.25), color: 0xffd090, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.scale.setScalar(0.6); this.flash.visible = false;
    this.group.add(this.flash);
    // the spent case, kicked out by the bolt
    this.shell = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), toonMaterial({ color: new THREE.Color('#e3ad4a'), emissive: new THREE.Color('#e3ad4a').multiplyScalar(0.15) }, { rimScale: 2.4 }));
    this.shell.visible = false;
    this.group.add(this.shell);
    this._shellV = new THREE.Vector3();
    this.recoil = 0;
  }

  get center() { return this.rifle.localToWorld(new THREE.Vector3(0.1, 0.05, 0)); }
  get forward() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.mount.getWorldQuaternion(new THREE.Quaternion())); }

  /** Beside the rifle, a little behind it: the rifle up close, the courtyard far beyond the muzzle. */
  heroShot(portrait = false) {
    const f = this.forward, side = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const c = this.center;
    return portrait
      ? { pos: c.clone().addScaledVector(side, -0.72).addScaledVector(f, -0.55).add(new THREE.Vector3(0, 0.34, 0)), target: c.clone().addScaledVector(f, 0.2).add(new THREE.Vector3(0, -0.06, 0)), fov: 46, portraitFov: 66 }
      : { pos: c.clone().addScaledVector(side, -0.68).addScaledVector(f, -0.4).add(new THREE.Vector3(0, 0.3, 0)), target: c.clone().addScaledVector(f, 0.18).add(new THREE.Vector3(0, -0.04, 0)), fov: 44 };
  }

  /** The eye at the scope: position and the point it looks at. */
  eyePose() {
    const pos = this.eye.getWorldPosition(new THREE.Vector3()).addScaledVector(this.forward, -0.02);
    return { pos, look: this.target.clone() };
  }

  setVisible(v) { this.rifle.visible = v; }

  /** The shot: flash at the muzzle, the rifle kicks. */
  fire() {
    this.mount.updateMatrixWorld(true);
    this.flash.position.copy(this.muzzle.getWorldPosition(new THREE.Vector3()));
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.visible = true; this._flashT = 0.07;
    this.recoil = 1;
  }

  /** Work the bolt: up, back (the case flies out), forward, down. */
  cycleBolt() {
    const b = this.bolt;
    if (!b) return Promise.resolve();
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(b.rotation, { x: -1.1, duration: 0.12, ease: 'power2.out' })
        .to(b.position, { x: b.position.x - 0.085, duration: 0.14, ease: 'power2.out' })
        .call(() => this._eject())
        .to(b.position, { x: b.position.x, duration: 0.14, ease: 'power2.in' }, '+=0.12')
        .to(b.rotation, { x: 0, duration: 0.1, ease: 'power2.in' });
    });
  }

  _eject() {
    const p = this.ejection.getWorldPosition(new THREE.Vector3());
    const f = this.forward, side = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    this.shell.position.copy(p); this.shell.visible = true;
    this._shellV.copy(side).multiplyScalar(1.4).add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(f, -0.3);
    this._shellT = 1.4;
    this.onEject?.();
  }

  update(t, dt) {
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.kick.position.z = -0.07 * Math.sin(Math.min(1, this.recoil) * Math.PI / 2) * this.recoil;
    this.kick.rotation.x = -0.09 * this.recoil;
    if (this._flashT > 0) { this._flashT -= dt; this.flash.scale.setScalar(0.4 + Math.random() * 0.4); if (this._flashT <= 0) this.flash.visible = false; }
    if (this._shellT > 0) {
      this._shellT -= dt;
      this._shellV.y -= 9.8 * dt;
      this.shell.position.addScaledVector(this._shellV, dt);
      this.shell.rotation.x += dt * 20; this.shell.rotation.z += dt * 14;
      if (this._shellT <= 0) this.shell.visible = false;
    }
  }

  reset() { this.setVisible(true); this.recoil = 0; this.shell.visible = false; if (this.bolt) { this.bolt.rotation.x = 0; } }
}

import * as THREE from 'three';
import gsap from 'gsap';
import { assets, findNode } from '../core/assets.js';
import { toonify } from '../style/toon.js';

// From art/blender/scripts/stylized_props.py (Blender Z-up → glTF Y-up: (x, y, z) → (x, z, −y))
const H = 0.118;
const SLOT_Z = -0.012;                                   // the slot on top, slightly behind centre
const LENS = new THREE.Vector3(-0.008, 0.052, 0.06);     // front of the lens (camera-local, origin at the base)
export const FILM_W = 0.09, FILM_H = 0.109;              // instant film, white frame included

/** Instant-film look: the photo area starts murky and develops into the picture (uDevelop 0 → 1). */
function filmMaterial() {
  // starts with a 1×1 stand-in map so the shader is compiled with its texture slot during loading
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, map: blank });
  m.userData.develop = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDevelop = m.userData.develop;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDevelop;')
      .replace('#include <map_fragment>', /* glsl */ `
        #ifdef USE_MAP
          vec4 texel = texture2D( map, vMapUv );
          // photo window of polaroidTexture(): 30px margins on a 512×620 card
          float inPhoto = step(0.0586, vMapUv.x) * step(vMapUv.x, 0.9414) * step(0.2226, vMapUv.y) * step(vMapUv.y, 0.9516);
          vec3 murky = vec3(0.13, 0.14, 0.12) + vec3(0.05, 0.04, 0.06) * vMapUv.y;
          float edge = distance(vMapUv, vec2(0.5, 0.59));
          float k = smoothstep(0.0, 1.0, uDevelop * 1.35 - edge * 0.35);
          vec3 developed = mix(murky, texel.rgb * mix(vec3(0.85, 0.8, 1.0), vec3(1.0), k), k);
          texel.rgb = mix(texel.rgb, developed, inPhoto);
          diffuseColor *= texel;
        #endif`);
  };
  m.customProgramCacheKey = () => 'instant-film';
  return m;
}

/**
 * A pastel instant camera (modelled in Blender). It can be lifted and aimed, fire its flash, and
 * push a freshly taken photo up out of the slot on top.
 */
export class InstantCamera {
  constructor(parent, anchor) {
    this.group = new THREE.Group();
    this.group.name = 'instant-camera';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    // rig pivots at the camera's centre so it can turn and tilt in the air
    this.rig = new THREE.Group();
    this.rig.position.y = H / 2;
    this.group.add(this.rig);
    this.home = { pos: this.rig.position.clone(), quat: this.rig.quaternion.clone() };

    const src = findNode(assets.models.props, 'instant_camera');
    this.model = src.clone(true);
    this.model.position.set(0, -H / 2, 0);
    this.model.rotation.set(0, 0, 0);
    toonify(this.model, { outline: true, width: 0.0017 });
    this.rig.add(this.model);
    this.flash = findNode(this.model, 'instant_flash');
    if (this.flash) {
      this.flash.material = this.flash.material.clone();
      this.flash.material.emissive = new THREE.Color(1, 0.97, 0.9);
      this.flash.material.emissiveIntensity = 0;
    }
    this.shutterBtn = findNode(this.model, 'instant_shutter');
    this.shutterY = this.shutterBtn?.position.y ?? 0;

    // the photo waits inside the body, just under the slot
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(FILM_W, FILM_H), filmMaterial());
    this.photoIn = new THREE.Vector3(0, H / 2 - FILM_H / 2 - 0.006, SLOT_Z);
    this.photo.position.copy(this.photoIn);
    this.photo.visible = false;
    this.rig.add(this.photo);

    this.hitTargets = [];
    this.model.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
  }

  get focusPoint() { return this.rig.localToWorld(new THREE.Vector3(0, 0, 0)); }
  /** World pose of the lens (for rendering the shot the camera "sees"). */
  lensPose() {
    this.rig.updateMatrixWorld(true);
    const pos = this.model.localToWorld(LENS.clone());
    const quat = this.rig.getWorldQuaternion(new THREE.Quaternion());
    // a three.js camera looks down −Z; the instant camera looks down its +Z: turn half a circle
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    return { pos, quat };
  }
  /** Unit vector the lens points along (world). */
  forward() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.rig.getWorldQuaternion(new THREE.Quaternion())); }

  /** Lift off the table and aim at a world point (or, with faceDir, face that world direction). */
  raise(lookAt, { lift = 0.24, duration = 1.3 } = {}) {
    const to = this.home.pos.clone().add(new THREE.Vector3(0, lift, 0));
    // orientation that points local +Z at the target, expressed in the group's space
    const dummy = new THREE.Object3D();
    this.group.add(dummy);
    dummy.position.copy(to);
    dummy.updateMatrixWorld(true);
    dummy.lookAt(lookAt);
    const q1 = dummy.quaternion.clone();
    this.group.remove(dummy);
    return this._tweenPose(to, q1, duration);
  }

  /** Back down onto the table, facing front. */
  lower(duration = 1.1) { return this._tweenPose(this.home.pos, this.home.quat, duration, 'power2.inOut'); }

  _root() { let r = this.group; while (r.parent) r = r.parent; return r; }

  /** Leave the table and fly (world space, on a lifted arc) to `pos`, ending up aimed at `lookAt`. */
  flyTo(pos, lookAt, duration = 2.6) {
    this._root().attach(this.rig);
    const p0 = this.rig.position.clone(), q0 = this.rig.quaternion.clone();
    const dummy = new THREE.Object3D();
    dummy.position.copy(pos); dummy.lookAt(lookAt);
    const q1 = dummy.quaternion.clone();
    const mid = p0.clone().lerp(pos, 0.45); mid.y = Math.max(p0.y, pos.y) + 0.55;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, pos.clone());
    const st = { k: 0 };
    gsap.killTweensOf(this._st || {});
    this._st = st;
    return new Promise((resolve) => gsap.to(st, {
      k: 1, duration, ease: 'power2.inOut',
      onUpdate: () => {
        this.rig.position.copy(curve.getPoint(st.k));
        this.rig.quaternion.slerpQuaternions(q0, q1, THREE.MathUtils.smoothstep(st.k, 0.15, 0.85));
      },
      onComplete: resolve,
    }));
  }

  /** Turn in place (world space) to aim at `lookAt`. */
  turnTo(lookAt, duration = 1.1) {
    const dummy = new THREE.Object3D();
    dummy.position.copy(this.rig.getWorldPosition(new THREE.Vector3())); dummy.lookAt(lookAt);
    const q0 = this.rig.quaternion.clone(), q1 = dummy.quaternion.clone();
    const st = { k: 0 };
    return new Promise((resolve) => gsap.to(st, { k: 1, duration, ease: 'power3.inOut', onUpdate: () => this.rig.quaternion.slerpQuaternions(q0, q1, st.k), onComplete: resolve }));
  }

  /** Fly back and settle on the table where it started. */
  flyHome(duration = 2.4) {
    if (this.rig.parent === this.group) return this.lower(duration);
    this.group.updateMatrixWorld(true);
    const home = this.group.localToWorld(this.home.pos.clone());
    const homeQ = this.group.getWorldQuaternion(new THREE.Quaternion()).multiply(this.home.quat);
    const p0 = this.rig.position.clone(), q0 = this.rig.quaternion.clone();
    const mid = p0.clone().lerp(home, 0.5); mid.y = Math.max(p0.y, home.y) + 0.45;
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, home);
    const st = { k: 0 };
    gsap.killTweensOf(this._st || {});
    this._st = st;
    return new Promise((resolve) => gsap.to(st, {
      k: 1, duration, ease: 'power2.inOut',
      onUpdate: () => { this.rig.position.copy(curve.getPoint(st.k)); this.rig.quaternion.slerpQuaternions(q0, homeQ, st.k); },
      onComplete: () => { this._settle(); resolve(); },
    }));
  }

  _settle() {
    if (this.rig.parent !== this.group) this.group.add(this.rig);
    this.rig.position.copy(this.home.pos);
    this.rig.quaternion.copy(this.home.quat);
  }

  _tweenPose(pos, quat, duration, ease = 'power3.inOut') {
    const p0 = this.rig.position.clone(), q0 = this.rig.quaternion.clone();
    const st = { k: 0 };
    gsap.killTweensOf(this._st || {});
    this._st = st;
    return new Promise((resolve) => gsap.to(st, {
      k: 1, duration, ease,
      onUpdate: () => { this.rig.position.lerpVectors(p0, pos, st.k); this.rig.quaternion.slerpQuaternions(q0, quat, st.k); },
      onComplete: resolve,
    }));
  }

  /** Press the shutter: button dips, the flash window blazes. */
  fire() {
    if (this.shutterBtn) gsap.fromTo(this.shutterBtn.position, { y: this.shutterY - 0.003 }, { y: this.shutterY, duration: 0.25, ease: 'power2.out' });
    if (this.flash) gsap.fromTo(this.flash.material, { emissiveIntensity: 6 }, { emissiveIntensity: 0, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(this.rig.scale, { x: 0.97, y: 0.97, z: 0.97 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(3)' });
  }

  /** Push the photo up out of the top slot. Resolves when it's out. */
  eject(texture, duration = 1.7) {
    const m = this.photo.material;
    m.map = texture; m.needsUpdate = true;
    m.userData.develop.value = 0;
    this.photo.visible = true;
    this.photo.position.copy(this.photoIn);
    this.photo.rotation.set(0, 0, 0);
    this.photo.scale.setScalar(1);
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(this.photo.position, { y: this.photoIn.y + FILM_H * 0.92, duration, ease: 'none' })
        // the little motor buzz: a tiny shake while it pushes (even repeat count → ends where it began)
        .to(this.rig.rotation, { z: '+=0.012', duration: 0.08, yoyo: true, repeat: 2 * Math.round(duration / 0.32) - 1 }, 0);
    });
  }

  /** Let the photo develop (0 → 1) over `duration` seconds. */
  develop(duration = 3.5) { return gsap.to(this.photo.material.userData.develop, { value: 1, duration, ease: 'power1.inOut' }); }

  reset() {
    gsap.killTweensOf(this._st || {});
    this._settle();
    this.model.visible = true;
    this.rig.scale.setScalar(1);
    if (this.photo.parent !== this.rig) this.rig.add(this.photo);
    this.photo.visible = false;
    this.photo.position.copy(this.photoIn);
    this.photo.quaternion.identity();
    this.photo.scale.setScalar(1);
  }
}

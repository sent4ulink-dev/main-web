import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/props.js';

// The wishbone, held between two people's hands: whole and even while they hold it (no telling who'll win),
// it trembles as they pull, then SNAPS — the bigger half (with the knob at the top) stays in the winner's
// hands, the little piece in the other's.

const HALF = 0.122;   // a tip's distance from the middle, in the model
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _basis = new THREE.Matrix4();

export class Wishbone {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = 'wishbone-held';
    this.root.visible = false;
    scene.add(this.root);
    const src = piece('wishbone', { outline: 0.0012 });
    const big = src.getObjectByName('wishbone_big'), small = src.getObjectByName('wishbone_small');
    // each half hangs from its own tip (so it stays in the hand that holds it)
    this.pBig = new THREE.Group(); this.pBig.position.set(-HALF, 0, 0);
    this.pSmall = new THREE.Group(); this.pSmall.position.set(HALF, 0, 0);
    // the whole bone, as it's held: the big half and its mirror image (both arms, the knob once)
    this.whole = new THREE.Group();
    if (big) { const a = big.clone(true), m = new THREE.Group(); m.scale.x = -1; m.add(big.clone(true)); this.whole.add(a, m); }   // (mirrored through the middle)
    this.root.add(this.whole);
    if (big) { big.position.x += HALF; this.pBig.add(big); }
    if (small) { small.position.x -= HALF; this.pSmall.add(small); }
    this.root.add(this.pBig, this.pSmall);
    this.tension = 0;
    this.state = 'off';
  }

  /** A holds one end, B the other; `bigTo` (A or B) is who ends up with the bigger half. */
  hold(A, B, bigTo) {
    Object.assign(this, { A, B, bigTo, state: 'hold', tension: 0 });
    this.root.add(this.pBig, this.pSmall);
    this.pBig.position.set(-HALF, 0, 0); this.pBig.rotation.set(0, 0, 0); this.pBig.scale.setScalar(1);
    this.pSmall.position.set(HALF, 0, 0); this.pSmall.rotation.set(0, 0, 0); this.pSmall.scale.setScalar(1);
    this.pBig.visible = this.pSmall.visible = false; this.whole.visible = true;
    this.root.visible = true;
  }

  hide() { this.state = 'off'; this.root.visible = false; this.pBig.visible = this.pSmall.visible = true; this.scene.remove(this.pBig, this.pSmall); }

  /** Both hands of someone, together. */
  _grip(actor, out) { return actor.handPoint(true, out).add(actor.handPoint(false, _d)).multiplyScalar(0.5); }

  get centre() { return this.root.getWorldPosition(new THREE.Vector3()); }

  /** SNAP: the halves part, each staying with its hands. */
  snap() {
    if (this.state !== 'hold') return;
    this.state = 'snapped';
    this.whole.visible = false; this.pBig.visible = this.pSmall.visible = true;
    this.root.updateMatrixWorld(true);
    for (const p of [this.pBig, this.pSmall]) { p.getWorldPosition(_a); const s = this.root.scale.x; this.scene.attach(p); p.scale.setScalar(s); p.position.copy(_a); }
    this._snapT = 0;
  }

  update(t, dt) {
    if (this.state === 'off') return;
    const winner = this.bigTo === this.B ? this.B : this.A, loser = winner === this.A ? this.B : this.A;
    if (this.state === 'hold') {
      this._grip(this.A, _a); this._grip(this.B, _b);
      const dist = _a.distanceTo(_b);
      this.root.position.lerpVectors(_a, _b, 0.5);
      _d.subVectors(_b, _a).normalize();
      const flip = this.bigTo === this.B;   // the big half faces its winner
      // the bone lies along the line between the hands, its knob always up
      const xa = flip ? _d.clone().negate() : _d.clone(), za = new THREE.Vector3().crossVectors(xa, _up).normalize(), ya = new THREE.Vector3().crossVectors(za, xa);
      this.root.quaternion.setFromRotationMatrix(_basis.makeBasis(xa, ya, za));
      const k = this.tension;
      this.root.rotateZ(Math.sin(t * 38) * 0.04 * k);
      this.root.scale.setScalar(THREE.MathUtils.clamp(dist / (HALF * 2), 0.7, 1.25) * (1 + 0.04 * k));
      this.pBig.rotation.z = -0.12 * k; this.pSmall.rotation.z = 0.12 * k;   // the arms bend apart
    } else {
      this._snapT += dt;
      // each half rides in its hands, raised up to show it off (or held up sheepishly)
      const lift = Math.min(1, this._snapT * 2.5);
      this._grip(winner, _a); this._grip(loser, _b);
      this.pBig.position.copy(_a).add(new THREE.Vector3(0, 0.04 * lift, 0));
      this.pSmall.position.copy(_b);
      this.pBig.rotation.set(0, Math.atan2(_b.x - _a.x, _b.z - _a.z) + Math.PI / 2, -0.4 * lift + Math.sin(t * 6) * 0.05);
      this.pSmall.rotation.set(0, Math.atan2(_a.x - _b.x, _a.z - _b.z) + Math.PI / 2, 0.9 * lift);
    }
  }

  /** A little shake at the moment of breaking (scale pop). */
  pop() { gsap.fromTo(this.pBig.scale, { x: this.pBig.scale.x * 1.25 }, { x: this.pBig.scale.x, duration: 0.4, ease: 'back.out(3)' }); }
}

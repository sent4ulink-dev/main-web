import * as THREE from 'three';
import gsap from 'gsap';

const UP = new THREE.Vector3(0, 1, 0);
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);   // gentle start, gentle landing
// a view direction as yaw / pitch, so turns go the short way round with no roll
const angles = (d) => ({ yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) });
const fromAngles = (yaw, pitch, out = new THREE.Vector3()) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Cinematic camera. Between shots it glides on a gently lifted path while the view turns steadily
 * (yaw / pitch, the short way round) from the old subject to the new one, so it never swings past or
 * looks somewhere odd on the way. On top, the rendered camera follows that path through a light
 * spring: a new move started mid-way, a phone-only offset or a hand-over from the viewfinder all
 * blend in, with no jump.
 */
export class Director {
  constructor(camera, dof) {
    this.camera = camera;
    this.dof = dof;
    this.pos = camera.position.clone();
    this.target = new THREE.Vector3();
    this.fov = camera.fov;
    this.focus = 4;
    this.focusOverride = null; // e.g. the floating letter while reading
    this.orbit = 0;           // slow orbit speed (rad/s) around the current target for wide shots
    this.frameX = 0;          // landscape screens: shift the subject sideways (fraction of view width) to leave room for text
    this.mobile = new THREE.Vector3();   // phones: extra look offset of the current shot (blended, never snapped)
    this.portraitFov = 0; this.portraitBlend = 0;   // phones: a shot's own field of view (blended in)
    this._orbitAngle = 0;
    this._snap = true;
    this._follow = null;
    this.tau = 0.1;           // the follow spring's time constant (s)
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._look = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
  }

  cut(shot) {
    gsap.killTweensOf(this._st || {});
    this.mobile.copy(shot.mobileOffset || new THREE.Vector3());
    this.pos.copy(shot.pos);
    this.target.copy(shot.target);
    this.fov = shot.fov ?? 40;
    this.focus = shot.pos.distanceTo(shot.target);
    this.orbit = shot.orbit || 0;
    this._orbitAngle = 0;
    this.frameX = shot.frameX || 0;
    this.portraitBlend = shot.portraitFov ? 1 : 0; if (shot.portraitFov) this.portraitFov = shot.portraitFov;
    this._snap = true;
  }

  /**
   * Ride along with a moving object: `shotFn()` gives this frame's {pos, target, fov}. The view blends
   * from where it is into that over `blend` seconds, then sticks to it (tight spring, no lag).
   * follow(null) stops, leaving the view where it is.
   */
  follow(shotFn, blend = 0.8) {
    gsap.killTweensOf(this._st || {});
    this._follow = shotFn ? { fn: shotFn, t: 0, blend, pos: this.currentPos(), target: this.target.clone(), fov: this.fov, frameX: this.frameX, mobile: this.mobile.clone() } : null;
    this.tau = shotFn ? 0.02 : 0.1;
  }

  /** Glide to a shot. Returns a promise resolved on arrival. */
  moveTo(shot, duration = 3.2) {
    if (this._follow) this.follow(null);
    gsap.killTweensOf(this._st || {});
    const fromPos = this.currentPos(), fromTarget = this.target.clone(), fromFov = this.fov, fromFrame = this.frameX;
    const fromMobile = this.mobile.clone(), toMobile = shot.mobileOffset || new THREE.Vector3();
    const fromBlend = this.portraitBlend, toBlend = shot.portraitFov ? 1 : 0;
    if (shot.portraitFov) this.portraitFov = fromBlend > 0 ? this.portraitFov : shot.portraitFov;
    const fromPFov = this.portraitFov, toPFov = shot.portraitFov || this.portraitFov;
    // bake any orbit offset into the start point
    this.pos.copy(fromPos);
    this._orbitAngle = 0;
    this.orbit = 0;
    const toPos = shot.pos.clone(), toTarget = shot.target.clone();
    const dist = fromPos.distanceTo(toPos);
    // Short hops (one table object to the next) glide nearly straight; only long moves lift into an arc,
    // and only enough to clear the table — no swooping.
    // (a shot may name a point the glide must pass through halfway, e.g. the doorway on the way in)
    const mid = fromPos.clone().lerp(toPos, 0.5);
    if (shot.via) mid.copy(shot.via).multiplyScalar(2).addScaledVector(fromPos, -0.5).addScaledVector(toPos, -0.5);
    else if (dist > 1.6) {
      mid.y += Math.min(0.9, (dist - 1.6) * 0.14);
      const away = new THREE.Vector3(mid.x, 0, mid.z);
      if (away.lengthSq() > 1e-4) mid.addScaledVector(away.normalize(), Math.min(0.6, (dist - 1.6) * 0.08));
    }
    const curve = new THREE.QuadraticBezierCurve3(fromPos, mid, toPos);
    // the view turns from the old look direction to the new one; its distance eases between the two
    const d0 = Math.max(0.05, fromPos.distanceTo(fromTarget)), d1 = Math.max(0.05, toPos.distanceTo(toTarget));
    const a0 = angles(fromTarget.clone().sub(fromPos).normalize()), a1 = angles(toTarget.clone().sub(toPos).normalize());
    const dYaw = wrap(a1.yaw - a0.yaw);
    const turn = Math.hypot(dYaw, a1.pitch - a0.pitch);
    const st = this._st = { k: 0 };
    // long moves and big turns take a little longer; tiny ones stay quick
    const dur = this.reduceMotion ? 0.01 : duration * THREE.MathUtils.clamp(0.62 + dist / 8 + turn * 0.12, 0.7, 1.2);
    const dir = new THREE.Vector3();
    const done = new Promise((resolve) => {
      gsap.to(st, {
        k: 1, duration: dur, ease: 'none',
        onUpdate: () => {
          const k = ease(st.k);
          this.pos.copy(curve.getPoint(k));
          fromAngles(a0.yaw + dYaw * k, THREE.MathUtils.lerp(a0.pitch, a1.pitch, k), dir);
          this.target.copy(this.pos).addScaledVector(dir, d0 + (d1 - d0) * k);
          this.fov = THREE.MathUtils.lerp(fromFov, shot.fov ?? 40, k);
          this.frameX = THREE.MathUtils.lerp(fromFrame, shot.frameX || 0, k);
          this.mobile.lerpVectors(fromMobile, toMobile, k);
          this.portraitBlend = THREE.MathUtils.lerp(fromBlend, toBlend, k);
          this.portraitFov = THREE.MathUtils.lerp(fromPFov, toPFov, k);
          this.focus = this.pos.distanceTo(this.target);
        },
        onComplete: () => { this.target.copy(toTarget); this.orbit = shot.orbit || 0; this._orbitAngle = 0; resolve(); },
      });
    });
    done.duration = dur;
    return done;
  }

  currentPos() {
    if (!this._orbitAngle) return this.pos.clone();
    const off = this.pos.clone().sub(this.target);
    off.applyAxisAngle(UP, this._orbitAngle);
    return this.target.clone().add(off);
  }

  update(t, dt) {
    const f = this._follow;
    if (f) {
      f.t += dt;
      const k = ease(Math.min(1, f.t / f.blend)), s = f.fn();
      this.pos.lerpVectors(f.pos, s.pos, k);
      this.target.lerpVectors(f.target, s.target, k);
      this.fov = THREE.MathUtils.lerp(f.fov, s.fov ?? this.fov, k);
      this.frameX = THREE.MathUtils.lerp(f.frameX, 0, k);
      this.mobile.lerpVectors(f.mobile, new THREE.Vector3(), k);
      this.focus = this.pos.distanceTo(this.target);
    }
    if (this.orbit && !this.reduceMotion) this._orbitAngle += this.orbit * dt;
    const p = this.currentPos();
    const cam = this.camera;
    const amp = this.reduceMotion ? 0 : 1;
    // a barely-there breath: the frame stays steady while you read
    p.x += Math.sin(t * 0.31) * 0.003 * amp; p.y += Math.sin(t * 0.27 + 1.2) * 0.002 * amp; p.z += Math.cos(t * 0.29) * 0.003 * amp;
    const d = p.distanceTo(this.target);
    // tall/narrow screens: keep the horizontal view of a 16:10 frame and lift the subject above the card
    const aspect = cam.aspect;
    let fov = this.fov;
    const look = this._look.copy(this.target);
    if (aspect < 1.25) {
      const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) * 1.6);
      // close-ups (framed shots) come in a little tighter on phones so the object fills more of the screen
      fov = Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / aspect)) * (0.92 - 0.2 * Math.min(1, Math.abs(this.frameX) * 10)));
      if (this.portraitBlend > 0) fov = THREE.MathUtils.lerp(fov, this.portraitFov, this.portraitBlend);
      look.y -= 0.12 * Math.min(d, 3);
      look.add(this.mobile);
    } else if (this.frameX) {
      // look a little to the side so the subject sits at (0.5 + frameX) of the width
      const right = new THREE.Vector3().subVectors(this.target, p).cross(UP).normalize();
      const tanH = Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) * aspect;
      look.addScaledVector(right, -2 * this.frameX * d * tanH);
    }
    // where the camera should be this frame
    this._m.lookAt(p, look, UP);
    this._q.setFromRotationMatrix(this._m);
    if (this._snap || this.reduceMotion) {
      cam.position.copy(p); cam.quaternion.copy(this._q); cam.fov = fov;
      this._snap = false;
    } else {
      // the light spring (~0.1 s): follows the path closely, but any sudden change arrives softly
      const a = dt > 0 ? 1 - Math.exp(-Math.min(dt, 0.1) / this.tau) : 0;
      cam.position.lerp(p, a);
      cam.quaternion.slerp(this._q, a);
      cam.fov += (fov - cam.fov) * a;
    }
    cam.updateProjectionMatrix();
    if (this.dof) {
      const coc = this.dof.cocMaterial;
      const goal = this.focusOverride ?? this.focus;
      const next = THREE.MathUtils.lerp(coc.focusDistance, goal, Math.min(1, (1 - Math.exp(-dt * 2.5)) * 2));
      coc.focusDistance = next;
      coc.focusRange = Math.max(0.5, next * 0.9);
    }
  }
}

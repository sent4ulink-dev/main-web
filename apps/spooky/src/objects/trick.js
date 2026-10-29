import * as THREE from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glowTexture } from '../world/nightTextures.js';
import { toonMaterial, addOutline } from '../style/toon.js';
import { Ghost } from './ghosts.js';

// Trick or treat, at the jack-o'-lantern candy bucket on the mansion's porch.
//  Treat: the bucket erupts — a fountain of wrapped sweets showers down all round.
//  Trick: the lights die. A heartbeat. Two red eyes open in the black doorway and the door creaks open; a swarm
//         of bats bursts out past you, lightning cracks — and the ghost those eyes belonged to flies straight at
//         your face: BOO! Then a laugh, and the door slams.

const CANDY_COLORS = [0xff7a1a, 0x9b4dff, 0x62ff4e, 0xff4f9a, 0xffd23f, 0xf4f1ff, 0x2fd0c8];

function candyGeometry() {
  const body = new THREE.SphereGeometry(0.04, 12, 8); body.scale(1.35, 1, 1);
  const twist = (s) => { const c = new THREE.ConeGeometry(0.026, 0.045, 8); c.rotateZ(s * Math.PI / 2); c.translate(s * 0.068, 0, 0); return c; };
  const g = mergeGeometries([body, twist(1), twist(-1)].map((x) => x.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}

class CandyShower {
  constructor(scene, count = 140) {
    this.mesh = new THREE.InstancedMesh(candyGeometry(), new THREE.MeshToonMaterial({ color: 0xffffff }), count);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, new THREE.Color(CANDY_COLORS[i % CANDY_COLORS.length]));
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
    this.n = count;
    this.p = Array.from({ length: count }, () => new THREE.Vector3());
    this.v = Array.from({ length: count }, () => new THREE.Vector3());
    this.r = Array.from({ length: count }, () => new THREE.Euler());
    this.delay = new Float32Array(count);
    this.life = 0;
    this._d = new THREE.Object3D();
  }

  burst(at) {
    this.mesh.visible = true; this.life = 7;
    this.p.forEach((p, i) => {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 1.5;
      p.copy(at);
      this.v[i].set(Math.cos(a) * s, 4.2 + Math.random() * 3.2, Math.sin(a) * s);
      this.r[i].set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.delay[i] = Math.random() * 1.1;
    });
  }

  update(dt) {
    if (!this.mesh.visible) return;
    this.life -= dt;
    this.p.forEach((p, i) => {
      if (this.delay[i] > 0) { this.delay[i] -= dt; this._d.scale.setScalar(0); }
      else {
        const v = this.v[i];
        if (p.y > 0.04) { v.y -= 9.8 * dt; p.addScaledVector(v, dt); this.r[i].x += dt * 8; this.r[i].y += dt * 5; }
        else { p.y = 0.04; v.set(0, 0, 0); }
        this._d.scale.setScalar(Math.min(1, Math.max(0, this.life)) * 1.3);
      }
      this._d.position.copy(p); this._d.rotation.copy(this.r[i]);
      this._d.updateMatrix(); this.mesh.setMatrixAt(i, this._d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.life <= 0) this.mesh.visible = false;
  }
}

export class TrickOrTreat {
  constructor(scene, bucket, camera, { mansion = null, makeBat = null } = {}) {
    this.bucket = bucket;
    this.camera = camera;
    this.scene = scene;
    // the mansion's front door: a real one on a hinge over the painted one, with pitch dark behind it,
    // and the red eyes that open in that dark
    mansion?.updateMatrixWorld(true);
    const mark = mansion?.getObjectByName('mansion_door');
    const base = mark ? mark.getWorldPosition(new THREE.Vector3()) : this.focusPoint.add(new THREE.Vector3(0, -0.7, -1.2));
    const DW = 1.02, DH = 2.0;
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshBasicMaterial({ color: 0x050308 }));
    dark.position.copy(base).add(new THREE.Vector3(0, DH / 2, 0.03));
    scene.add(dark);
    this.door = new THREE.Group();   // the hinge, on the door's left edge
    this.door.position.copy(base).add(new THREE.Vector3(-DW / 2, 0, 0.06));
    const wood = toonMaterial({ color: new THREE.Color('#5a2430') }, { rimScale: 0.8 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, 0.06), wood);
    panel.position.set(DW / 2, DH / 2, 0); addOutline(panel, 0.0018);
    const trim = toonMaterial({ color: new THREE.Color('#3a1620') });
    for (const [y, h] of [[DH * 0.72, DH * 0.38], [DH * 0.27, DH * 0.38]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(DW * 0.72, h, 0.02), trim); r.position.set(DW / 2, y, 0.035); this.door.add(r); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), toonMaterial({ color: new THREE.Color('#d9b45a'), emissive: new THREE.Color('#3a2a08') }, { rimScale: 2 }));
    knob.position.set(DW * 0.86, DH * 0.48, 0.06);
    this.door.add(panel, knob);
    scene.add(this.door);
    this.doorPoint = base.clone().add(new THREE.Vector3(0, 1.15, 0.1));
    const eyeTex = glowTexture(64);
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      e.scale.set(0.16, 0.1, 1); e.position.copy(this.doorPoint).add(new THREE.Vector3(s * 0.13, 0.32, 0.02));
      scene.add(e); return e;
    });
    // a swarm of bats for the doorway
    this.swarm = makeBat ? Array.from({ length: 16 }, () => { const b = makeBat(); b.visible = false; b.scale.setScalar(1.6); scene.add(b); return { b, wl: b.getObjectByName('bat_wing_l'), wr: b.getObjectByName('bat_wing_r') }; }) : [];
    this.candy = new CandyShower(scene);
    bucket.updateMatrixWorld(true);
    this.hitTargets = [];
    bucket.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    // the bucket's face glows brighter when something's about to happen
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: 0xff9a3a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.setScalar(0.9);
    this.glow.position.copy(this.facePoint);
    scene.add(this.glow);
    this.ghost = new Ghost({ scale: 1.1 });
    this.ghost.opacity = 0;
    scene.add(this.ghost.group);
    this.busy = false;
  }

  get focusPoint() { return this.bucket.localToWorld(new THREE.Vector3(0, 0.25, 0)); }
  get facePoint() { const f = this.bucket.getObjectByName('face_bucket'); return f ? f.getWorldPosition(new THREE.Vector3()) : this.focusPoint; }
  get normal() { const r = this.bucket.rotation.y; return new THREE.Vector3(Math.sin(r), 0, Math.cos(r)); }

  treat() {
    if (this.busy) return Promise.resolve();
    this.busy = true;
    const b = this.bucket, s0 = b.scale.x;
    gsap.timeline({ onComplete: () => { this.busy = false; } })
      .to(b.scale, { x: s0 * 1.15, y: s0 * 0.82, z: s0 * 1.15, duration: 0.18, ease: 'power2.in' })
      .add(() => this.candy.burst(this.focusPoint.add(new THREE.Vector3(0, 0.2, 0))))
      .to(b.scale, { x: s0 * 0.92, y: s0 * 1.22, z: s0 * 0.92, duration: 0.14, ease: 'power2.out' })
      .to(b.scale, { x: s0, y: s0, z: s0, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
    return new Promise((r) => setTimeout(r, 1800));
  }

  /** The red eyes open (blinking now and then) or close. */
  showEyes(on) {
    this._eyesOn = on;
    this.eyes.forEach((e) => gsap.to(e.material, { opacity: on ? 1 : 0, duration: on ? 0.6 : 0.15 }));
  }

  openDoor(open) {
    if (!this.door) return;
    gsap.killTweensOf(this.door.rotation);
    gsap.to(this.door.rotation, { y: open ? -1.35 : 0, duration: open ? 2.4 : 0.2, ease: open ? 'power1.inOut' : 'power3.in' });   // swings out toward you, on the dark
  }

  /** Bats burst out of the doorway and stream past the camera. */
  batSwarm(seconds = 1.6) {
    const cam = this.camera.position.clone();
    this.swarm.forEach((s, i) => {
      const start = this.doorPoint.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.5, 0));
      const end = cam.clone().add(new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6), (Math.random() - 0.3) * 1.8, 0.5));
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.6 + Math.random(), 0));
      const st = { k: 0 };
      s.b.visible = true; s.b.position.copy(start);
      gsap.to(st, {
        k: 1, duration: seconds * (0.7 + Math.random() * 0.5), delay: i * 0.05, ease: 'power1.in',
        onUpdate: () => {
          const a = start.clone().lerp(mid, st.k), b = mid.clone().lerp(end, st.k), p = a.lerp(b, st.k);
          s.b.lookAt(p); s.b.position.copy(p);
          const f = Math.sin(st.k * 60 + i) * 1.0; if (s.wl) s.wl.rotation.y = f; if (s.wr) s.wr.rotation.y = -f;
        },
        onComplete: () => { s.b.visible = false; },
      });
    });
  }

  /** The ghost (red-eyed) bursts out of the doorway at the camera; onBoo fires at the scariest moment. */
  trick({ onBoo = () => {} } = {}) {
    if (this.busy) return Promise.resolve();
    this.busy = true;
    const g = this.ghost, from = this.doorPoint.clone(), cam = this.camera;
    g.eyes.forEach((e) => e.material.color.set(0xff2030));
    g.setFace('ooo');
    g.group.position.copy(from); g.group.scale.setScalar(0.2);
    const st = { k: 0, o: 0 };
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { g.opacity = 0; g.setFace('smile'); g.eyes.forEach((e) => e.material.color.set(0x120c1c)); this.busy = false; resolve(); } })
        .to(st, { o: 1, duration: 0.15, onUpdate: () => { g.opacity = st.o; } })
        .to(st, {
          k: 1, duration: 0.5, ease: 'power3.in',
          onUpdate: () => {
            // straight at your face, ending a hand's width in front of the lens, slightly below centre
            const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
            const end = cam.position.clone().addScaledVector(dir, 0.95).add(new THREE.Vector3(0, -0.62, 0));
            g.group.position.lerpVectors(from, end, st.k);
            g.group.scale.setScalar(0.3 + st.k * 1.2);
            g.group.lookAt(cam.position.x, g.group.position.y, cam.position.z);
            if (st.k > 0.55 && g.face !== 'boo') { g.setFace('boo'); onBoo(); }
          },
        }, 0.05)
        .to({}, { duration: 0.9 })
        .to(st, { o: 0, duration: 0.5, onUpdate: () => { g.opacity = st.o; } });
    });
  }

  reset() { this.ghost.opacity = 0; this.busy = false; }

  update(t, dt) {
    this.candy.update(dt);
    if (this._eyesOn) { const blink = (t % 2.6) < 0.12 ? 0.05 : 1; this.eyes.forEach((e) => { e.scale.y = 0.1 * blink; }); }
    this.glow.material.opacity = 0.35 + 0.15 * Math.sin(t * 4.2) * Math.sin(t * 2.3);
    if (this.ghost.group.visible) this.ghost.update(t, dt);
  }
}

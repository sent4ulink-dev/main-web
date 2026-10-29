import * as THREE from 'three';
import gsap from 'gsap';
import { engraving, glowTexture, CARVE, DRIP } from '../world/nightTextures.js';
import { EN_MONTHS } from '../util/textures.js';

// The date plan, written in stone: four tombstones push up out of the earth one after another — rumbling,
// tilting, dirt flying — each engraved with a time and what we'll do then. The crypt's plaque carries the
// date itself, and its door creaks open on a green glow. The plan can be saved to the calendar (.ics).

const SUNK = -1.45;

/** Dirt clods thrown up when a stone breaks the ground (one instanced draw, reused). */
class Clods {
  constructor(scene, count = 90) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshToonMaterial({ color: 0x3b2a20 }), count);
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
    this.n = count; this.p = []; this.v = []; this.life = 0;
    for (let i = 0; i < count; i++) { this.p.push(new THREE.Vector3()); this.v.push(new THREE.Vector3()); }
    this._d = new THREE.Object3D();
  }

  burst(at) {
    this.mesh.visible = true; this.life = 2.2;
    this.p.forEach((p, i) => {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.6;
      p.copy(at).add(new THREE.Vector3(Math.cos(a) * 0.25, 0.02, Math.sin(a) * 0.15));
      this.v[i].set(Math.cos(a) * s, 2 + Math.random() * 2.8, Math.sin(a) * s * 0.7);
    });
  }

  update(dt) {
    if (!this.mesh.visible) return;
    this.life -= dt;
    this.p.forEach((p, i) => {
      const v = this.v[i];
      if (p.y > 0.02) { v.y -= 9.8 * dt; p.addScaledVector(v, dt); } else { p.y = 0.02; v.set(0, 0, 0); }
      this._d.position.copy(p); this._d.rotation.set(i, i * 2, 0);
      this._d.scale.setScalar((0.6 + (i % 5) * 0.25) * Math.min(1, Math.max(0, this.life)));
      this._d.updateMatrix(); this.mesh.setMatrixAt(i, this._d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.life <= 0) this.mesh.visible = false;
  }
}

/** An engraved plan stone face: the time big, the title under it. */
function planFace(item) {
  return engraving([{ text: item.time || '', font: CARVE }, { text: item.title || '', font: CARVE }], { w: 512, h: 512, sizes: [124, 66], top: 0.3, color: '#dcffd0', lip: 'rgba(8,14,10,0.75)', glow: 'rgba(120,255,110,0.9)' });
}

/** The crypt plaque: "31" big, the month, a line. */
function plaqueFace(iso, label) {
  const d = new Date(`${iso}T12:00:00`);
  return engraving([
    { text: `${d.getDate()}`, font: CARVE, gap: 1.05 },
    { text: EN_MONTHS[d.getMonth()] || '', font: CARVE },
    { text: label || '', font: CARVE },
  ], { w: 1024, h: 512, sizes: [210, 96, 66], top: 0.27, color: '#dcffd0', lip: 'rgba(8,14,10,0.75)', glow: 'rgba(120,255,110,0.9)' });
}

export class PlanStones {
  constructor(scene, yard, content) {
    this.yard = yard;
    this.stones = yard.o.plan.map(({ t, mound }, i) => {
      t.updateMatrixWorld(true);
      // the face size from the model
      const inv = t.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3();
      t.traverse((m) => { if (m.isMesh && !m.userData.isOutline) { m.geometry.computeBoundingBox(); box.union(b.copy(m.geometry.boundingBox).applyMatrix4(inv.clone().multiply(m.matrixWorld))); } });
      const size = box.getSize(new THREE.Vector3());
      const faceEmpty = t.getObjectByName(`face_tomb_${yard.o.plan[i].kind || ''}`) || t.children[0]?.children.find((c) => /^face_/.test(c.name));
      const fp = faceEmpty ? faceEmpty.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : new THREE.Vector3(0, size.y * 0.55, size.z / 2);
      const w = size.x * 0.84;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: planFace(content.plan[i] || {}), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
      face.position.set(0, fp.y - w * 0.06, box.max.z + 0.004);
      face.renderOrder = 3;
      t.add(face);
      const restY = t.position.y;
      t.position.y = SUNK;
      mound.scale.multiplyScalar(0.001); mound.visible = false;
      const moundScale = mound.scale.clone().multiplyScalar(1000);
      return { t, mound, face, restY, moundScale, risen: false, top: box.max.y };
    });
    // the crypt: the date on the plaque, the door that creaks open on a green glow
    const crypt = yard.o.crypt;
    crypt.updateMatrixWorld(true);
    this.crypt = crypt;
    const plaque = crypt.getObjectByName('crypt_plaque');
    const pp = plaque ? crypt.worldToLocal(plaque.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(0, 2.95, 0.82);
    this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.62), new THREE.MeshBasicMaterial({ map: plaqueFace(content.date.iso, content.date.label), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    this.plaque.position.copy(pp).add(new THREE.Vector3(0, 0, 0.012));
    this.plaque.renderOrder = 3;
    crypt.add(this.plaque);
    this.door = crypt.getObjectByName('crypt_door');
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0x6bff7a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.2, 2.6, 1);
    glow.position.set(0, 1.0, 0.75);
    crypt.add(glow);
    this.doorGlow = glow;
    this.doorLight = new THREE.PointLight(0x6bff7a, 0, 6, 1.6);
    this.doorLight.position.copy(crypt.localToWorld(new THREE.Vector3(0, 1.0, 1.4)));
    scene.add(this.doorLight);
    this.clods = new Clods(scene);
    this.risen = false;
  }

  /** Where stone i's face is (world) and which way it looks. */
  facePoint(i) { const s = this.stones[i]; return s.face.getWorldPosition(new THREE.Vector3()).setY(s.restY + s.face.position.y); }
  faceNormal(i) { const r = this.stones[i].t.rotation.y; return new THREE.Vector3(Math.sin(r), 0, Math.cos(r)); }
  get plaquePoint() { return this.plaque.getWorldPosition(new THREE.Vector3()); }
  get cryptNormal() { const r = this.crypt.rotation.y; return new THREE.Vector3(Math.sin(r), 0, Math.cos(r)); }
  get centre() { const p = new THREE.Vector3(); this.stones.forEach((s) => p.add(s.t.position.clone().setY(0.7))); return p.divideScalar(this.stones.length); }

  /** One stone pushes up out of the ground. */
  rise(i, { onRumble = () => {}, onBreak = () => {} } = {}) {
    const s = this.stones[i];
    if (s.risen) return Promise.resolve();
    s.risen = true;
    const t = s.t;
    return new Promise((resolve) => {
      onRumble(i);
      gsap.timeline({ onComplete: resolve })
        .to(t.position, { y: SUNK + 0.3, duration: 0.5, ease: 'power1.in' })
        .add(() => { onBreak(i); this.clods.burst(t.position.clone().setY(0.05)); s.mound.visible = true; gsap.to(s.mound.scale, { x: s.moundScale.x, y: s.moundScale.y, z: s.moundScale.z, duration: 0.5, ease: 'back.out(2)' }); })
        .to(t.position, { y: s.restY + 0.08, duration: 0.85, ease: 'power3.out' })
        .to(t.position, { y: s.restY, duration: 0.35, ease: 'bounce.out' })
        .fromTo(t.rotation, { z: 0 }, { z: (i % 2 ? 1 : -1) * 0.07, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, '-=1.1');
    });
  }

  riseAll(opts) {
    if (this.risen) return Promise.resolve();
    this.risen = true;
    return this.stones.reduce((p, _, i) => p.then(() => { this.rise(i, opts); return new Promise((r) => setTimeout(r, 650)); }), Promise.resolve())
      .then(() => new Promise((r) => setTimeout(r, 1200)));
  }

  /** Everything up, no show (jumping ahead). */
  complete() {
    this.risen = true;
    this.stones.forEach((s, i) => { s.risen = true; s.t.position.y = s.restY; s.t.rotation.z = (i % 2 ? 1 : -1) * 0.07; s.mound.visible = true; s.mound.scale.copy(s.moundScale); });
  }

  openCrypt(open = true) {
    if (!this.door) return;
    gsap.to(this.door.rotation, { y: open ? -1.6 : 0, duration: open ? 2.4 : 1.2, ease: open ? 'power2.inOut' : 'power2.in' });
    gsap.to(this.doorGlow.material, { opacity: open ? 0.85 : 0, duration: 1.6 });
    gsap.to(this.doorLight, { intensity: open ? 4 : 0, duration: 1.6 });
  }

  setPlan(plan) { this.stones.forEach((s, i) => { s.face.material.map?.dispose(); s.face.material.map = planFace(plan[i] || {}); s.face.material.needsUpdate = true; }); }
  setDate(iso, label) { const m = this.plaque.material; m.map?.dispose(); m.map = plaqueFace(iso, label); m.needsUpdate = true; }

  reset() {
    this.risen = false;
    this.stones.forEach((s) => { gsap.killTweensOf(s.t.position); s.risen = false; s.t.position.y = SUNK; s.t.rotation.z = 0; s.mound.visible = false; s.mound.scale.copy(s.moundScale).multiplyScalar(0.001); });
    this.openCrypt(false);
  }

  update(t, dt) { this.clods.update(dt); }
}

/** The plan as a calendar file: one event per stone on the date (local time), 75 minutes each. */
export function planICS(content) {
  const pad = (n) => String(n).padStart(2, '0');
  const [y, mo, d] = content.date.iso.split('-').map(Number);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const events = content.plan.map((p, i) => {
    const [hh, mm] = (/^(\d{1,2})[:.](\d{2})/.exec(p.time || '') || [0, 19 + i, 0]).slice(1).map(Number);
    const start = new Date(y, mo - 1, d, hh, mm), end = new Date(start.getTime() + 75 * 60000);
    const f = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    return ['BEGIN:VEVENT', `UID:halloween-${content.date.iso}-${i}@sent4u.link`, `DTSTAMP:${stamp}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:🎃 ${esc(p.title)}`, `DESCRIPTION:${esc(`${content.date.label} — ${content.from} & ${content.name}`)}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sent4u//Halloween Night//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadICS(content) {
  const blob = new Blob([planICS(content)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `halloween-${content.date.iso}.ics` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export { DRIP };

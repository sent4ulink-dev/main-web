import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial, addOutline } from '../style/toon.js';
import { canvas, glowTexture, INK, DRIP, fit } from '../world/nightTextures.js';
import { Ghost } from './ghosts.js';

// The finale's spirit photograph. An old box camera on a tripod stands outside the gate. You look through its
// ground glass, press the shutter: the flash powder goes off with a white poof — and when the picture develops,
// there's someone in it who wasn't there before. (The ghost is only ever in the frame for the exposure.)

export class SpiritCamera {
  constructor(scene, cam, lookAt) {
    this.root = cam;
    this.lookAt = lookAt.clone();
    cam.updateMatrixWorld(true);
    this.lens = cam.getObjectByName('lens');
    this.pan = cam.getObjectByName('flash_pan');
    this.hitTargets = [];
    cam.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    // the flash: a white burst, a smoke puff, a light
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xfff6e0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.flashSprite.position.copy(this.panPoint); this.flashSprite.scale.setScalar(0.1);
    scene.add(this.flashSprite);
    this.puffs = Array.from({ length: 7 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color: 0xbab4c8, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(s); return s;
    });
    // the uninvited guest
    this.ghost = new Ghost({ scale: 1.15 });
    this.ghost.opacity = 0;
    scene.add(this.ghost.group);
    this._ghostOn = false;
  }

  get lensPoint() { return this.lens ? this.lens.getWorldPosition(new THREE.Vector3()) : this.root.localToWorld(new THREE.Vector3(0, 1.45, 0.25)); }
  get panPoint() { return this.pan ? this.pan.getWorldPosition(new THREE.Vector3()) : this.root.localToWorld(new THREE.Vector3(0.23, 1.8, -0.1)); }
  get center() { return this.root.localToWorld(new THREE.Vector3(0, 1.35, 0)); }
  get forward() { return this.lookAt.clone().sub(this.lensPoint).normalize(); }

  /** The camera on its tripod, from the front and to one side, the graveyard behind it. */
  heroShot(portrait = false) {
    const c = this.center, f = this.forward.setY(0).normalize(), side = new THREE.Vector3(-f.z, 0, f.x);
    // over its shoulder: the camera in the foreground, the gate and the haunted mansion beyond it
    return portrait
      ? { pos: c.clone().addScaledVector(f, -1.7).addScaledVector(side, 0.75).add(new THREE.Vector3(0, 0.35, 0)), target: c.clone().addScaledVector(f, 3.0).add(new THREE.Vector3(0, 0.2, 0)), fov: 46, portraitFov: 70 }
      : { pos: c.clone().addScaledVector(f, -1.5).addScaledVector(side, 0.95).add(new THREE.Vector3(0, 0.3, 0)), target: c.clone().addScaledVector(f, 3.0).addScaledVector(side, -0.4).add(new THREE.Vector3(0, 0.15, 0)), fov: 44, frameX: -0.12 };
  }

  /** Looking through the lens (just in front of it, so the camera itself is never in the picture). */
  eyePose() {
    const f = this.forward;
    return { pos: this.lensPoint.addScaledVector(f, 0.08), look: this.lookAt.clone() };
  }

  /** Put the ghost in the frame (for the exposure only) or take it out again. */
  photobomb(on, pose = null) {
    this._ghostOn = on;
    if (!on) { this.ghost.opacity = 0; return; }
    const p = pose?.pos || this.eyePose().pos;
    const f = pose?.quat ? new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quat) : this.forward;
    const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const at = p.clone().addScaledVector(f, 6.2).addScaledVector(right, 0.8);
    at.y = 0.55;
    const g = this.ghost;
    g.group.position.copy(at);
    g.group.lookAt(p.x, at.y, p.z);
    g.setFace('smile');
    g.opacity = 0.62;
    g.arms[1].rotation.z = -1.6;     // waving at the camera
    g.update(this._t || 0, 0);
    g.arms[1].rotation.z = -1.7;
  }

  /** Flash powder: the poof, the light, the smoke. */
  poof() {
    const at = this.panPoint;
    const fm = this.flashSprite.material;
    gsap.killTweensOf([fm, this.flashSprite.scale]);
    fm.opacity = 1; this.flashSprite.scale.setScalar(0.3);
    gsap.to(this.flashSprite.scale, { x: 2.6, y: 2.6, z: 2.6, duration: 0.18, ease: 'power2.out' });
    gsap.to(fm, { opacity: 0, duration: 0.7, delay: 0.1, ease: 'power2.in' });
    this.puffs.forEach((s, i) => {
      gsap.killTweensOf([s.material, s.position, s.scale]);
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.05, (Math.random() - 0.5) * 0.15));
      s.scale.setScalar(0.2); s.material.opacity = 0.7;
      gsap.to(s.position, { x: at.x + (Math.random() - 0.5) * 0.8, y: at.y + 0.6 + Math.random() * 0.8, z: at.z + (Math.random() - 0.5) * 0.8, duration: 2.5 + i * 0.2, ease: 'power1.out' });
      gsap.to(s.scale, { x: 1.2 + i * 0.12, y: 1.2 + i * 0.12, z: 1, duration: 2.6, ease: 'power1.out' });
      gsap.to(s.material, { opacity: 0, duration: 2.6, ease: 'power1.in' });
    });
  }

  reset() { this.photobomb(false); }

  update(t, dt) {
    this._t = t;
    if (this._ghostOn) this.ghost.update(t, dt);
  }
}

/**
 * The developed photograph, shown as a haunted polaroid: an aged card with a strip of purple washi tape, the
 * sepia photo developing in its window, a handwritten caption with little doodles (a bat, a pumpkin, stars), a
 * ghost sticker peeking over the corner — floating with a gentle sway in a soft purple glow.
 */
export class SpiritPhoto {
  constructor(scene, content) {
    this.content = content;
    this.group = new THREE.Group(); this.group.name = 'spirit-photo';
    this.group.visible = false;
    scene.add(this.group);
    this.inner = new THREE.Group();   // sways inside the presented pose
    this.group.add(this.inner);
    const CW = 0.6, CH = 0.74, P = 0.5;
    this.size = { w: CW + 0.08, h: CH + 0.1 };
    // glow behind
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xb07aff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glow.scale.set(CW * 2.1, CH * 1.9, 1); this.glow.position.z = -0.04;
    this.inner.add(this.glow);
    // the card: a thin slab (for an edge in the light) with the printed face on top
    const edge = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, 0.008), toonMaterial({ color: new THREE.Color('#d9ccb0') }, { rimScale: 0.6 }));
    edge.position.z = -0.005; addOutline(edge, 0.0016);
    this.inner.add(edge);
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: cardTexture(content), fog: false, toneMapped: false }));
    this.inner.add(this.face);
    // the photo window (its own material, so it can develop)
    this.u = { uDev: { value: 0 } };
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDev = this.u.uDev;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDev;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 c = diffuseColor.rgb; float g = dot(c, vec3(0.3, 0.59, 0.11));
          vec3 sep = mix(c, vec3(g) * vec3(1.08, 0.9, 0.68) + vec3(0.03, 0.015, 0.0), 0.68);
          vec2 q = vMapUv - 0.5; sep *= 1.0 - dot(q, q) * 1.2;
          float dev = smoothstep(0.0, 1.0, uDev * 1.4 - (1.0 - g) * 0.4);
          diffuseColor.rgb = mix(vec3(0.9, 0.86, 0.78), sep, dev);`);
    };
    mat.customProgramCacheKey = () => 'spirit-photo-v2';
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(P, P), mat);
    this.photo.position.set(0, (CH - P) / 2 - 0.05, 0.001);
    this.inner.add(this.photo);
    // washi tape across the top, a little crooked
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.07), new THREE.MeshBasicMaterial({ map: tapeTexture(), transparent: true, fog: false }));
    tape.position.set(0.02, CH / 2 - 0.005, 0.003); tape.rotation.z = -0.07;
    this.inner.add(tape);
    // the ghost sticker, peeking over the photo's corner
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ map: ghostStickerTexture(), transparent: true, fog: false }));
    sticker.position.set(CW / 2 - 0.05, this.photo.position.y + P / 2 - 0.02, 0.004); sticker.rotation.z = -0.25;
    this.inner.add(sticker);
    this.sticker = sticker;
  }

  setNames() { const m = this.face.material; m.map?.dispose(); m.map = cardTexture(this.content); m.needsUpdate = true; }

  show(image, at, lookFrom) {
    const m = this.photo.material;
    m.map?.dispose();
    m.map = new THREE.CanvasTexture(image); m.map.colorSpace = THREE.SRGBColorSpace; m.needsUpdate = true;
    this.group.position.copy(at);
    this.group.lookAt(lookFrom);
    this.group.visible = true;
    this.u.uDev.value = 0;
    this.sticker.scale.setScalar(0.001);
    gsap.to(this.u.uDev, { value: 1, duration: 3.2, delay: 0.8, ease: 'power1.inOut' });
    gsap.to(this.sticker.scale, { x: 1, y: 1, z: 1, duration: 0.5, delay: 3.6, ease: 'back.out(3)' });   // pops on once it has developed
  }

  hide() { this.group.visible = false; gsap.killTweensOf([this.u.uDev, this.sticker.scale]); }

  update(t) {
    if (!this.group.visible) return;
    this.inner.rotation.z = 0.035 * Math.sin(t * 0.9) - 0.025;
    this.inner.rotation.y = 0.05 * Math.sin(t * 0.6);
    this.inner.position.y = 0.012 * Math.sin(t * 1.3);
    this.glow.material.opacity = 0.45 + 0.12 * Math.sin(t * 2.1);
  }
}

/** The card's printed face: aged cream paper, a dark window for the photo, the caption and doodles. */
function cardTexture(content) {
  const W = 1024, H = Math.round(1024 * 0.74 / 0.6), [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f3ead6'); g.addColorStop(1, '#e2d3b3');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // age: soft stains and a darker rim
  for (let k = 0; k < 18; k++) {
    const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 120, s = ctx.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, `rgba(150,110,60,${0.05 + Math.random() * 0.06})`); s.addColorStop(1, 'rgba(150,110,60,0)');
    ctx.fillStyle = s; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,60,30,0.35)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // the photo window
  const P = Math.round(W * 0.5 / 0.6), px = (W - P) / 2, py = Math.round(H * 0.05 / 0.74) + 0;
  ctx.fillStyle = '#2a2030'; ctx.fillRect(px - 6, py - 6, P + 12, P + 12);
  // caption: the names in ink, the date small, with doodles round it
  const cy = py + P + (H - py - P) * 0.42;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3a2440';
  const names = `${content.name} & ${content.from}`;
  fit(ctx, names, 400, 92, INK, W * 0.62); ctx.fillText(names, W / 2, cy);
  const d = new Date(`${content.date.iso}T12:00:00`);
  const date = `Halloween · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  ctx.fillStyle = '#7a4a6a'; fit(ctx, date, 400, 44, DRIP, W * 0.6); ctx.fillText(date, W / 2, cy + 78);
  // doodles: a bat (left), a pumpkin (right), stars
  ctx.save(); ctx.translate(120, cy - 10); ctx.scale(2.1, 2.1); ctx.fillStyle = '#3a2440';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, -14, -30, -6); ctx.quadraticCurveTo(-22, 0, -24, 8); ctx.quadraticCurveTo(-14, 2, -8, 10); ctx.quadraticCurveTo(-4, 4, 0, 8);
  ctx.quadraticCurveTo(4, 4, 8, 10); ctx.quadraticCurveTo(14, 2, 24, 8); ctx.quadraticCurveTo(22, 0, 30, -6); ctx.quadraticCurveTo(12, -14, 0, 0); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(W - 120, cy + 6);
  ctx.fillStyle = '#ff8a2a'; ctx.strokeStyle = '#3a2440'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 0, 50, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -38); ctx.quadraticCurveTo(-24, 0, -18, 38); ctx.moveTo(18, -38); ctx.quadraticCurveTo(24, 0, 18, 38); ctx.stroke();
  ctx.fillStyle = '#3a2440'; ctx.beginPath(); ctx.moveTo(-26, -6); ctx.lineTo(-12, -6); ctx.lineTo(-19, -18); ctx.fill(); ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(26, -6); ctx.lineTo(19, -18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-22, 10); ctx.quadraticCurveTo(0, 26, 22, 10); ctx.quadraticCurveTo(0, 16, -22, 10); ctx.fill();
  ctx.strokeStyle = '#4a6a2a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(4, -52, 12, -56); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#c9a24a';
  for (const [x, y, r] of [[230, cy - 60, 10], [W - 240, cy - 64, 8], [260, cy + 70, 7], [W - 260, cy + 74, 9]]) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill(); ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function tapeTexture() {
  const [c, ctx] = canvas(256, 80);
  ctx.fillStyle = 'rgba(155,95,225,0.78)';
  ctx.beginPath(); ctx.moveTo(6, 0); for (let x = 6; x <= 250; x += 12) ctx.lineTo(x, x % 24 ? 3 : 0); ctx.lineTo(250, 80); for (let x = 250; x >= 6; x -= 12) ctx.lineTo(x, x % 24 ? 77 : 80); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let x = 20; x < 240; x += 34) { ctx.beginPath(); ctx.arc(x, 40, 7, 0, Math.PI * 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ghostStickerTexture() {
  const [c, ctx] = canvas(256, 256);
  const body = () => { ctx.beginPath(); ctx.moveTo(60, 200); ctx.lineTo(60, 110); ctx.arc(128, 110, 68, Math.PI, 0); ctx.lineTo(196, 200); for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(196 - k * 34 - 17, 230, 196 - (k + 1) * 34, 200); ctx.closePath(); };
  ctx.save(); body(); ctx.lineWidth = 22; ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
  body(); ctx.fillStyle = '#f4f0ff'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#3a2440'; ctx.stroke();
  ctx.fillStyle = '#1a1020';
  for (const x of [104, 152]) { ctx.beginPath(); ctx.ellipse(x, 112, 11, 15, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(128, 148, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,170,0.6)';
  for (const x of [88, 168]) { ctx.beginPath(); ctx.ellipse(x, 134, 12, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

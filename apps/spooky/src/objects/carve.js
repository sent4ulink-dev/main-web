import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial, addOutline } from '../style/toon.js';
import { canvas, glowTexture, CARVE } from '../world/nightTextures.js';

// The name, carved into the giant pumpkin: a knife saws across its face from left to right and, behind the
// blade, the skin opens into a jack-o'-lantern — two eyes, a nose, and the name as its grin — with candlelight
// blazing out of every cut. Afterwards the light flickers like a real candle inside.

const PHI0 = Math.PI / 2 - 0.95, PHI_L = 1.9;      // the carved patch, across the front (+Z) of the pumpkin
const TH0 = Math.PI / 2 - 0.86, TH_L = 1.6;

function faceTexture(name) {
  const W = 1024, H = 620, [c, ctx] = canvas(W, H);
  // a carved hole: the cut wall of the shell (deep orange, glowing) round the candle-lit inside (pale yellow)
  const hole = (path, lift = 9) => {
    ctx.save(); path(); ctx.fillStyle = '#e8590c'; ctx.shadowColor = 'rgba(255,150,40,0.95)'; ctx.shadowBlur = 28; ctx.fill(); ctx.restore();
    ctx.save(); path(); ctx.clip(); ctx.translate(0, -lift); path(); ctx.fillStyle = '#ffd36b'; ctx.fill();
    ctx.translate(0, -lift * 0.6); path(); ctx.fillStyle = '#fff3c4'; ctx.globalAlpha = 0.6; ctx.fill(); ctx.restore();
    ctx.save(); path(); ctx.strokeStyle = 'rgba(90,30,0,0.65)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
  };
  // crooked triangle eyes, a little nose
  for (const s of [-1, 1]) {
    hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 + s * 245, 240); ctx.lineTo(W / 2 + s * 90, 250); ctx.lineTo(W / 2 + s * 178, 105 + (s > 0 ? 10 : 0)); ctx.closePath(); });
  }
  hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 - 34, 318); ctx.lineTo(W / 2 + 34, 318); ctx.lineTo(W / 2, 262); ctx.closePath(); }, 6);
  // the grin is the name: carved letters riding a smile
  const text = [...((name || '').toUpperCase().trim() || '★')];
  let size = 168;
  const measure = () => { ctx.font = `400 ${size}px ${CARVE}`; return text.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + (text.length - 1) * size * 0.06; };
  while (measure() > W * 0.64 && size > 48) size -= 4;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const total = measure(), widths = text.map((ch) => ctx.measureText(ch).width);
  let x = W / 2 - total / 2;
  text.forEach((ch, i) => {
    const cx = x + widths[i] / 2, u = (cx - W / 2) / (W * 0.4);
    const cy = 470 - 70 * u * u + 22;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(u * 0.32); ctx.font = `400 ${size}px ${CARVE}`;
    ctx.fillStyle = '#e8590c'; ctx.shadowColor = 'rgba(255,150,40,0.95)'; ctx.shadowBlur = 26; ctx.fillText(ch, 0, 0);
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffd36b'; ctx.fillText(ch, 0, -6);
    ctx.fillStyle = 'rgba(255,243,196,0.55)'; ctx.fillText(ch, 0, -10);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(90,30,0,0.55)'; ctx.strokeText(ch, 0, 0);
    ctx.restore();
    x += widths[i] + size * 0.06;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A cartoon carving knife (origin at the blade's tip, handle up +Y). */
function makeKnife() {
  const g = new THREE.Group();
  const steel = toonMaterial({ color: new THREE.Color('#d4d9e2'), emissive: new THREE.Color('#d4d9e2').multiplyScalar(0.1) }, { rimScale: 2.6 });
  const wood = toonMaterial({ color: new THREE.Color('#6a3a1e') }, { rimScale: 0.6 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.008), steel); blade.position.y = 0.13;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), steel); tip.rotation.set(0, Math.PI / 4, Math.PI); tip.scale.z = 0.3; tip.position.y = 0.0;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.024), steel); guard.position.y = 0.255;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.14, 10), wood); handle.position.y = 0.33;
  for (const m of [blade, tip, guard, handle]) { addOutline(m, 0.0016); g.add(m); }
  return g;
}

export class Carving {
  constructor(pumpkin, name) {
    this.pumpkin = pumpkin;
    pumpkin.updateMatrixWorld(true);
    // the pumpkin's shell as an ellipsoid, measured from the model (ribs and all, the stem left out)
    const inv = pumpkin.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3();
    this.hitTargets = [];
    pumpkin.traverse((m) => {
      if (!m.isMesh || m.userData.isOutline) return;
      this.hitTargets.push(m);
      if (!/M_pumpkin/.test([].concat(m.material)[0]?.name || '')) return;
      m.geometry.computeBoundingBox();
      box.union(b.copy(m.geometry.boundingBox).applyMatrix4(inv.clone().multiply(m.matrixWorld)));
    });
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.66, 0, -0.66), new THREE.Vector3(0.66, 0.97, 0.66));
    this.C = box.getCenter(new THREE.Vector3());
    this.R = box.getSize(new THREE.Vector3()).multiplyScalar(0.5 * 1.07);   // just proud of the ribs, so no rib hides a letter
    this.u = { uReveal: { value: 0 }, uFlick: { value: 1 } };
    const mat = new THREE.MeshBasicMaterial({ map: faceTexture(name), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false, fog: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = this.u.uReveal; sh.uniforms.uFlick = this.u.uFlick;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uReveal, uFlick;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.a *= 1.0 - smoothstep(uReveal - 0.03, uReveal, vMapUv.x);   // carved only behind the knife
          diffuseColor.rgb *= uFlick * 1.15;`);
    };
    mat.customProgramCacheKey = () => 'carve-v2';
    this.face = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, PHI0, PHI_L, TH0, TH_L), mat);
    this.face.position.copy(this.C);
    this.face.scale.copy(this.R);
    this.face.renderOrder = 4;
    this.face.raycast = () => {};
    pumpkin.add(this.face);
    // the candle's light spilling out of the face
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
    this.glow.scale.set(this.R.x * 3.2, this.R.y * 2.6, 1);
    this.glow.position.copy(this.C).add(new THREE.Vector3(0, -0.02, this.R.z * 1.25));
    pumpkin.add(this.glow);
    this.knife = makeKnife();
    this.knife.scale.setScalar(1.4);
    this.knife.visible = false;
    pumpkin.add(this.knife);
    this.carved = false;
  }

  /** A point on the pumpkin's skin at patch coords (u, v) ∈ [0, 1]², and its outward normal (pumpkin space). */
  _surface(u, v, lift = 0, normal = null) {
    const phi = PHI0 + u * PHI_L, th = TH0 + v * TH_L;
    const d = new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
    if (normal) normal.set(d.x / this.R.x, d.y / this.R.y, d.z / this.R.z).normalize();
    return d.multiply(this.R).multiplyScalar(1 + lift).add(this.C);
  }

  get focusPoint() { return this.pumpkin.localToWorld(this.C.clone().add(new THREE.Vector3(0, 0.02, this.R.z * 0.6))); }
  /** Where the face is, and which way it looks (world). */
  get facePoint() { return this.pumpkin.localToWorld(this._surface(0.5, 0.5)); }
  get faceNormal() { const n = new THREE.Vector3(); this._surface(0.5, 0.5, 0, n); return n.transformDirection(this.pumpkin.matrixWorld).setY(0).normalize(); }

  setName(name) {
    const m = this.face.material; m.map?.dispose(); m.map = faceTexture(name); m.needsUpdate = true;
  }

  /** Saw the face out from left to right. onCut fires on every stroke. Resolves when done. */
  carve(seconds = 4.6, onCut = () => {}) {
    if (this.carved) return Promise.resolve();
    this.carved = true;
    const k = this.knife, n = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const st = { u: -0.02, enter: 0 };
    const placeKnife = () => {
      const u = THREE.MathUtils.clamp(st.u, 0, 1);
      const v = 0.32 + 0.3 * (0.5 + 0.5 * Math.sin(st.u * 40));     // the blade works up and down the face
      const saw = Math.sin(st.u * 260) * 0.035;                       // in and out, sawing
      const p = this._surface(u, v, 0, n);
      k.position.copy(p).addScaledVector(n, (1 - st.enter) * 0.5 + saw - 0.06 * st.enter);
      q.setFromUnitVectors(up, n);
      k.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(up, 0.6 + Math.sin(st.u * 30) * 0.2));
    };
    k.visible = true;
    placeKnife();
    let tick = -1;
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { k.visible = false; resolve(); } })
        .to(st, { enter: 1, duration: 0.5, ease: 'power2.out', onUpdate: placeKnife })
        .to(st, {
          u: 1.03, duration: seconds, ease: 'none',
          onUpdate: () => {
            this.u.uReveal.value = st.u;
            placeKnife();
            const c = Math.floor(st.u * 26);
            if (c !== tick) { tick = c; onCut(c); }
          },
        })
        .to(st, { enter: 0, duration: 0.45, ease: 'power2.in', onUpdate: placeKnife });
    });
  }

  reset() {
    gsap.killTweensOf(this.knife.position);
    this.carved = false; this.knife.visible = false;
    this.u.uReveal.value = 0; this.glow.material.opacity = 0;
  }

  /** Carved already (e.g. jumping straight to the finale). */
  complete() { this.carved = true; this.u.uReveal.value = 1.03; }

  update(t) {
    const f = 0.84 + 0.1 * Math.sin(t * 13.3) * Math.sin(t * 7.1) + 0.06 * Math.sin(t * 29);
    this.u.uFlick.value = f;
    this.glow.material.opacity = 0.45 * f * THREE.MathUtils.clamp(this.u.uReveal.value, 0, 1);
  }

  /** How bright the candle inside is, for the world's pumpkin light. */
  get light() { return 0.4 + 1.5 * THREE.MathUtils.clamp(this.u.uReveal.value, 0, 1) * this.u.uFlick.value; }
}

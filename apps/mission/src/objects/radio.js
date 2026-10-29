import * as THREE from 'three';
import { piece } from '../world/courtyard.js';
import { canvas } from '../world/courtyardTextures.js';
import { softSprite } from '../util/textures.js';

// The field radio on the crate: tap it and the song (or the recorded voice message, as a crackling radio call)
// comes over the air — the antenna tip blinks, rings of signal pulse out from it, the speaker throbs, the dial
// window's level bars dance and the tuning knob turns. Same interface as BW2's Ensemble (play/stop/press…).

export class FieldRadio {
  constructor(scene, position, yaw) {
    this.group = new THREE.Group(); this.group.name = 'radio';
    this.group.position.copy(position); this.group.rotation.y = yaw;
    scene.add(this.group);
    this.radio = piece('tactical', 'field_radio');
    this.radio.scale.setScalar(1.35);
    this.group.add(this.radio);
    this.radio.updateMatrixWorld(true);
    this.knob = this.radio.getObjectByName('radio_knob');
    this.speakerAt = this.radio.getObjectByName('speaker').position.clone();
    this.tipAt = this.radio.getObjectByName('antenna_tip').position.clone();
    this.hitTargets = [];
    this.radio.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });

    // the speaker grille's pulse (a dark disc that swells)
    this.cone = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), new THREE.MeshBasicMaterial({ color: 0x1a1c1e }));
    this.cone.position.copy(this.speakerAt).add(new THREE.Vector3(0, 0, -0.004));
    this.radio.add(this.cone);
    // the dial window: level bars drawn on a canvas
    const [c, ctx] = canvas(256, 128);
    this.cv = c; this.ctx = ctx;
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.dial = new THREE.Mesh(new THREE.PlaneGeometry(0.096, 0.046), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.dial.position.set(0.07, 0.18, 0.0925);
    this.radio.add(this.dial);
    // the antenna's beacon and the signal rings
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(64, 0.2), color: 0xff5a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.beacon.position.copy(this.tipAt); this.beacon.scale.setScalar(0.06);
    this.radio.add(this.beacon);
    this.rings = [];
    const rg = new THREE.TorusGeometry(1, 0.012, 6, 48);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.4).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = Math.PI / 2;
      m.position.copy(this.tipAt);
      m.userData.phase = i / 4;
      this.radio.add(m); this.rings.push(m);
    }
    this.levels = new Float32Array(10);
    this.playing = false; this._auto = false; this._kick = 0;
    this._draw(0);
  }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.25, 0)); }

  play() { this.playing = true; }
  stop() { this.playing = false; }
  /** Without note events (a YouTube song, a voice message), the level bars dance on their own. */
  autoplay(on) { this._auto = on; }
  /** A note was played (midi, seconds): kick the speaker and the bars. */
  press(midi = 60) { this._kick = 1; const k = Math.min(9, Math.max(0, Math.round((midi - 48) / 3))); this.levels[k] = 1; }
  reset() { this.playing = false; this._auto = false; }

  _draw(t) {
    const ctx = this.ctx, W = 256, H = 128;
    ctx.fillStyle = '#0d1a17'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(120,255,200,0.12)';
    for (let x = 8; x < W; x += 24) ctx.fillRect(x, 10, 2, H - 20);
    for (let i = 0; i < 10; i++) {
      const v = this.levels[i];
      const h = 8 + v * (H - 30);
      const g = ctx.createLinearGradient(0, H - 10, 0, H - 10 - h);
      g.addColorStop(0, '#3dffb0'); g.addColorStop(1, v > 0.75 ? '#ffd24a' : '#3dffb0');
      ctx.fillStyle = g;
      ctx.fillRect(14 + i * 23.5, H - 10 - h, 16, h);
    }
    // the tuning needle
    ctx.fillStyle = '#ff5a3a';
    ctx.fillRect(40 + (Math.sin(t * 0.4) * 0.5 + 0.5) * 170, 6, 3, H - 12);
    this.tex.needsUpdate = true;
  }

  update(t, dt) {
    for (let i = 0; i < 10; i++) {
      if (this.playing && this._auto) this.levels[i] = Math.max(this.levels[i], Math.pow(Math.abs(Math.sin(t * (3 + i * 0.7) + i * 1.3) * Math.sin(t * 1.7 + i)), 1.5));
      this.levels[i] = Math.max(this.playing ? 0.05 : 0, this.levels[i] - dt * 2.2);
    }
    if (this.playing && this._auto && Math.sin(t * 7.5) > 0.96) this._kick = 0.7;
    this._kick = Math.max(0, this._kick - dt * 7);
    this.cone.scale.setScalar(1 + this._kick * 0.25);
    this._frame = (this._frame || 0) + 1;
    if (this.playing || this._frame % 10 === 0) this._draw(t);
    if (this.knob) this.knob.rotation.z = this.playing ? this.knob.rotation.z - dt * 1.4 : this.knob.rotation.z;
    const blink = this.playing ? (Math.sin(t * 9) > 0 ? 1 : 0.2) : (Math.sin(t * 2) > 0.7 ? 0.8 : 0.1);
    this.beacon.material.opacity = blink;
    for (const r of this.rings) {
      const p = (t * 0.6 + r.userData.phase) % 1;
      r.scale.setScalar(0.05 + p * 0.55);
      r.material.opacity = this.playing ? (1 - p) * 0.8 : 0;
    }
  }
}

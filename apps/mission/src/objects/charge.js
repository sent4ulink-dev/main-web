import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/courtyard.js';
import { canvas, MONO } from '../world/courtyardTextures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

// The party charge on the barrel: a rugged olive case lying open — an LCD, a rubber keypad, toggles, three
// confetti canisters wired to the panel. It counts down with a piezo beep that hurries; the code that stops
// it is the birthday (month + day). Typed right: DEFUSED, the canisters fire confetti, the display shows the day.

const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', _: 'd' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
const KEY = 0.024, GAP = 0.007;   // key size and gap (model units, before the charge's scale)

function drawDigit(ctx, ch, x, y, w, h, on, off) {
  const t = w * 0.18, segs = SEG[ch] ?? '';
  const Hs = (sx, sy, k) => { ctx.fillStyle = segs.includes(k) ? on : off; ctx.beginPath(); ctx.moveTo(sx + t * 0.5, sy); ctx.lineTo(sx + w - t * 0.5, sy); ctx.lineTo(sx + w - t, sy + t * 0.5); ctx.lineTo(sx + t, sy + t * 0.5); ctx.lineTo(sx + t, sy - t * 0.5); ctx.lineTo(sx + w - t, sy - t * 0.5); ctx.closePath(); ctx.fill(); };
  const Vs = (sx, sy, k) => { ctx.fillStyle = segs.includes(k) ? on : off; ctx.beginPath(); ctx.moveTo(sx, sy + t * 0.5); ctx.lineTo(sx + t * 0.5, sy + t); ctx.lineTo(sx + t * 0.5, sy + h / 2 - t); ctx.lineTo(sx, sy + h / 2 - t * 0.5); ctx.lineTo(sx - t * 0.5, sy + h / 2 - t); ctx.lineTo(sx - t * 0.5, sy + t); ctx.closePath(); ctx.fill(); };
  Hs(x, y, 'a'); Hs(x, y + h / 2, 'g'); Hs(x, y + h, 'd');
  Vs(x + t * 0.5, y, 'f'); Vs(x + w - t * 0.5, y, 'b'); Vs(x + t * 0.5, y + h / 2, 'e'); Vs(x + w - t * 0.5, y + h / 2, 'c');
}

function keyTexture(label) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#2b2d2f'; ctx.fillRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(50, 40, 10, 64, 64, 90);
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = label === 'OK' ? '#7dff9a' : label === 'C' ? '#ff7a6a' : '#f2efe6';
  ctx.font = `700 ${label.length > 1 ? 48 : 70}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label === 'C' ? '✕' : label === 'OK' ? '✓' : label, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PartyCharge {
  constructor(scene, position, yaw, iso) {
    this.group = new THREE.Group(); this.group.name = 'charge';
    this.group.position.copy(position); this.group.rotation.y = yaw;
    scene.add(this.group);
    this.box = piece('tactical', 'party_charge', { outline: 0.0012 });
    this.box.scale.setScalar(1.4);
    this.group.add(this.box);
    const lid = this.box.getObjectByName('charge_lid');
    if (lid) lid.rotation.x = -1.9;   // the lid stands open, leaning back
    this.box.updateMatrixWorld(true);
    const disp = this.box.getObjectByName('pc_display').position, pad = this.box.getObjectByName('pc_keypad').position;
    // the LCD: countdown digits on top, a text line below
    const [c, ctx] = canvas(512, 210);
    this.cv = c; this.ctx = ctx;
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.display = new THREE.Mesh(new THREE.PlaneGeometry(0.112, 0.046), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.display.rotation.x = -Math.PI / 2;
    this.display.position.copy(disp).add(new THREE.Vector3(0, 0.0006, 0));
    this.box.add(this.display);
    // a status LED beside the display
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }));
    this.led.position.copy(disp).add(new THREE.Vector3(0.068, 0.003, -0.014));
    this.box.add(this.led);
    // the keypad: 12 rubber keys, each pressable
    this.keys = [];
    const rubber = toonMaterial({ color: new THREE.Color('#2b2d2f') }, { rimScale: 0.6 });
    const keyGeo = new THREE.BoxGeometry(KEY, 0.008, KEY);
    KEYS.forEach((label, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const k = new THREE.Mesh(keyGeo, rubber);
      k.position.copy(pad).add(new THREE.Vector3((col - 1) * (KEY + GAP), 0.004, (row - 1.5) * (KEY + GAP)));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(KEY * 0.92, KEY * 0.92), new THREE.MeshBasicMaterial({ map: keyTexture(label) }));
      face.rotation.x = -Math.PI / 2; face.position.y = 0.0041;
      k.add(face);
      addOutline(k, 0.0008);
      k.userData.key = label; face.userData.key = label;
      k.userData.home = k.position.y;
      this.box.add(k);
      this.keys.push(k);
    });
    this.keyTargets = this.keys.flatMap((k) => [k, k.children[0]]);
    this.hitTargets = [];
    this.box.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    this.setDate(iso);
    this.state = 'idle';
    this.entry = '';
    this._draw();
  }

  setDate(iso) {
    const d = new Date(`${iso}T12:00:00`);
    this.date = isNaN(d) ? new Date() : d;
    this.code = `${String(this.date.getMonth() + 1).padStart(2, '0')}${String(this.date.getDate()).padStart(2, '0')}`;
    if (this.state === 'done') this._draw();
  }

  /** Redraw the LCD for the current state. */
  _draw() {
    const ctx = this.ctx, W = 512, H = 210;
    ctx.fillStyle = '#0a110c'; ctx.fillRect(0, 0, W, H);
    const done = this.state === 'done', err = this._err > 0;
    const on = done ? '#4dff7a' : err ? '#ff4030' : '#ff3b26', off = done ? 'rgba(77,255,122,0.07)' : 'rgba(255,60,40,0.07)';
    let digits;
    if (done) digits = `${this.code.slice(0, 2)}${this.code.slice(2)}`;
    else { const s = Math.ceil(this.left ?? 45); digits = `${String(Math.floor(s / 60)).padStart(2, '0')}${String(s % 60).padStart(2, '0')}`; }
    const dw = 66, dh = 100, gap = 18; let x = (W - (4 * dw + 3 * gap + 26)) / 2;
    ctx.shadowColor = on; ctx.shadowBlur = 14;
    for (let i = 0; i < 4; i++) {
      drawDigit(ctx, digits[i], x, 16, dw, dh, on, off);
      x += dw + gap;
      if (i === 1) { ctx.fillStyle = on; if (done) ctx.fillRect(x - 4, 16 + dh - 8, 11, 11); else { ctx.fillRect(x - 4, 16 + dh * 0.3, 11, 11); ctx.fillRect(x - 4, 16 + dh * 0.66, 11, 11); } x += 26; }
    }
    ctx.shadowBlur = 0;
    // the text line
    ctx.font = `700 34px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let line;
    if (done) line = 'DEFUSED  ·  MONTH.DAY';
    else if (err) line = '!! ERROR !!';
    else if (this.state === 'entry' || this.entry) line = `CODE  ${(this.entry + '____').slice(0, 4).split('').join(' ').replace(/^(\S \S) /, '$1 · ')}`;
    else line = 'ARMED  ·  ENTER CODE';
    ctx.fillStyle = done ? '#4dff7a' : err ? '#ff4030' : '#ffb04a';
    ctx.fillText(line, W / 2, H - 38);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, W, H * 0.45);
    this.tex.needsUpdate = true;
  }

  get focusPoint() { return this.display.getWorldPosition(new THREE.Vector3()); }
  get keypadPoint() { return this.keys[4].getWorldPosition(new THREE.Vector3()); }
  get topPoint() { return this.group.localToWorld(new THREE.Vector3(0.19, 0.2, 0)); }
  /** Where each canister's cap is (for the confetti). */
  canisterPoints() { return [-0.105, 0, 0.105].map((z) => this.box.localToWorld(new THREE.Vector3(0.135, 0.11, z))); }

  /** Start the countdown. onBeep(urgency 0..1) every beep; resolves 'defused' or 'timeout'. */
  arm(seconds, onBeep = () => {}) {
    if (this.state !== 'idle') return Promise.resolve(this.state === 'done' ? 'done' : 'busy');
    this.state = 'armed';
    this.total = seconds; this.left = seconds; this._beepIn = 0; this._onBeep = onBeep;
    this.entry = '';
    this._draw();
    return new Promise((resolve) => { this._end = resolve; });
  }

  /** Ready for the code (the camera is at the keypad). */
  beginEntry() { if (this.state === 'armed') { this.state = 'entry'; this._draw(); } }

  /** A key was pressed: returns 'digit' | 'clear' | 'wrong' | 'right' | null. */
  press(label) {
    if (this.state !== 'entry' && this.state !== 'armed') return null;
    if (this.state === 'armed') this.state = 'entry';
    const k = this.keys.find((x) => x.userData.key === label);
    if (k) gsap.fromTo(k.position, { y: k.userData.home - 0.003 }, { y: k.userData.home, duration: 0.18, ease: 'power2.out' });
    if (this._err > 0) return null;
    let r;
    if (label === 'C') { this.entry = ''; r = 'clear'; }
    else if (label === 'OK') r = this.entry.length === 4 ? this._check() : 'wrong';
    else if (this.entry.length < 4) { this.entry += label; r = this.entry.length === 4 ? this._check() : 'digit'; }
    else r = null;
    if (r === 'wrong') { this._err = 0.9; this.entry = ''; }
    this._draw();
    return r;
  }

  _check() {
    if (this.entry !== this.code) return 'wrong';
    this.state = 'done';
    this._end?.('defused');
    return 'right';
  }

  update(t, dt) {
    if (this.state === 'armed' || this.state === 'entry') {
      this.left = Math.max(0, this.left - dt);
      const sec = Math.ceil(this.left);
      if (sec !== this._sec) { this._sec = sec; this._draw(); }
      const urgency = 1 - this.left / this.total;
      this._beepIn -= dt;
      if (this._beepIn <= 0) {
        this._beepIn = THREE.MathUtils.lerp(1.0, 0.12, Math.pow(urgency, 1.8));
        this._blink = 0.08;
        this._onBeep(urgency);
      }
      if (this.left <= 0) { this.state = 'done'; this.entry = ''; this._draw(); this._end?.('timeout'); }
    }
    if (this._err > 0) { this._err -= dt; if (this._err <= 0) this._draw(); }
    this._blink = Math.max(0, (this._blink || 0) - dt);
    const done = this.state === 'done';
    this.led.material.color.set(done ? 0x30ff60 : 0xff2a1a).multiplyScalar(done ? 1.6 + 0.6 * Math.sin(t * 3) : (this._blink > 0 ? 2.6 : 0.25));
  }

  hop() { gsap.fromTo(this.box.position, { y: 0 }, { y: 0.03, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }); }

  reset() {
    this.state = 'idle'; this.entry = ''; this._err = 0; this._sec = null;
    this._end = null; this.left = this.total || 45;
    this._draw();
  }
}

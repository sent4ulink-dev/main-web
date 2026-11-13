import * as THREE from 'three';
import { canvas, tex, FONTS, fitFont } from '../world/textures.js';

// The old console TV in the living room, painted live on a canvas: the parade in the morning (our own giant
// balloons — a turkey, a pumpkin, a star and a "100" — floating down an avenue between the crowds) and
// football in the afternoon (a kick sailing through the uprights). Drawn only while you're watching.

const W = 512, H = 384;
const rnd = (s) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

export class TV {
  constructor(root, content) {
    this.root = root;
    this.content = content;
    this.screen = root.getObjectByName('tv_screen');
    const [c, x] = canvas(W, H);
    this.c = c; this.x = x;
    this.texture = tex(c, { aniso: 4 }); this.texture.flipY = false;   // (glTF UVs)
    if (this.screen) this.screen.material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, color: new THREE.Color(1.05, 1.05, 1.05) });
    this.channel = 'parade';
    this.active = false;
    this._next = 0;
    this._flash = null;
    this.kick = 0;
    this._draw(0);
  }

  get focusPoint() { return this.screen ? this.screen.getWorldPosition(new THREE.Vector3()) : this.root.position.clone(); }
  setChannel(ch) { this.channel = ch; this._switchT = 0.35; this._draw(this._t || 0); }
  flash(text, seconds = 2.4) { this._flash = { text, until: (this._t || 0) + seconds }; }

  update(t) {
    this._t = t;
    if (!this.active || t < this._next) return;
    this._next = t + 1 / 20;
    this._draw(t);
  }

  _draw(t) {
    const x = this.x;
    if (this.channel === 'off') { x.fillStyle = '#16191B'; x.fillRect(0, 0, W, H); this._glass(); this.texture.needsUpdate = true; return; }
    if (this.channel === 'parade') this._parade(t); else this._football(t);
    if (this._switchT > 0) {   // a burst of static when the channel changes
      this._switchT -= 1 / 20;
      const img = x.getImageData(0, 0, W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = n; }
      x.putImageData(img, 0, 0);
    }
    if (this._flash && t < this._flash.until) {
      const k = 1 + 0.08 * Math.sin(t * 20);
      x.save(); x.translate(W / 2, H / 2); x.scale(k, k);
      x.font = `900 66px ${FONTS.ui}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 10; x.strokeStyle = '#6E2A12'; x.strokeText(this._flash.text, 0, 0);
      x.fillStyle = '#FFE08A'; x.fillText(this._flash.text, 0, 0);
      x.restore();
    }
    this._glass();
    this.texture.needsUpdate = true;
  }

  _glass() {
    const x = this.x;
    const g = x.createRadialGradient(W * 0.5, H * 0.5, H * 0.25, W * 0.5, H * 0.5, W * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
    const s = x.createLinearGradient(0, 0, W, H); s.addColorStop(0, 'rgba(255,255,255,0.12)'); s.addColorStop(0.3, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fillRect(0, 0, W, H);
  }

  // ── the parade ──
  _parade(t) {
    const x = this.x;
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8EC3E6'); sky.addColorStop(0.7, '#DCEBF2'); sky.addColorStop(1, '#C9C3B5');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    // the avenue's buildings on both sides, in perspective
    for (let i = 0; i < 9; i++) {
      const bw = 50 + rnd(i) * 30, bh = 120 + rnd(i + 3) * 140, bx = i * 60 - 10;
      x.fillStyle = ['#9AA6B5', '#B4A28E', '#8C98A8', '#A89A8A'][i % 4]; x.fillRect(bx, H * 0.72 - bh, bw, bh);
      x.fillStyle = 'rgba(255,240,200,0.55)';
      for (let wy = H * 0.72 - bh + 12; wy < H * 0.72 - 14; wy += 18) for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) x.fillRect(wx, wy, 6, 9);
    }
    // the balloons drifting down the avenue
    const balloons = [this._turkey, this._pumpkin, this._star, this._hundred];
    for (let k = 0; k < balloons.length; k++) {
      const period = 16, u = ((t / period + k / balloons.length) % 1);
      const bx = -120 + u * (W + 240), by = 120 + Math.sin(t * 0.9 + k * 1.7) * 10 + (k % 2) * 30;
      // handlers' ropes
      x.strokeStyle = 'rgba(60,60,60,0.6)'; x.lineWidth = 1.2;
      for (let r = -2; r <= 2; r++) { x.beginPath(); x.moveTo(bx + r * 10, by + 40); x.lineTo(bx + r * 26, H * 0.82); x.stroke(); }
      balloons[k].call(this, x, bx, by, t + k);
    }
    // the crowds and barriers along the street
    x.fillStyle = '#5E5A55'; x.fillRect(0, H * 0.82, W, H * 0.18);
    for (let i = 0; i < 90; i++) {
      const cx = (i * 37) % W + rnd(i) * 10, cy = H * 0.83 + (i % 3) * 14 + Math.abs(Math.sin(t * 3 + i)) * 2;
      x.fillStyle = ['#CC5500', '#2F4A6B', '#E3A857', '#990000', '#3F6B4A', '#F2E6D0'][i % 6]; x.beginPath(); x.arc(cx, cy, 6, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#F2C7A5'; x.beginPath(); x.arc(cx, cy - 8, 4.5, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#E8E0D2'; x.fillRect(0, H * 0.81, W, 5);
    // confetti
    for (let i = 0; i < 40; i++) {
      const cx = (rnd(i) * W + t * 20 * (0.5 + rnd(i + 9))) % W, cy = (rnd(i + 4) * H + t * 40 * (0.6 + rnd(i + 2))) % (H * 0.8);
      x.fillStyle = ['#CC5500', '#E3A857', '#990000', '#fff', '#3F6B4A'][i % 5]; x.fillRect(cx, cy, 4, 6);
    }
    this._lowerThird(`LIVE  ·  ${this.content.parade.title}`, '#990000');
  }

  _turkey(x, bx, by) {
    const fan = ['#990000', '#CC5500', '#E3A857', '#CC5500', '#990000'];
    fan.forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.ellipse(bx - 16 + i * 0 , by - 6, 20, 58, (i - 2) * 0.42, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = '#8A5A34'; x.beginPath(); x.ellipse(bx, by + 10, 44, 40, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#A06A3C'; x.beginPath(); x.arc(bx + 34, by - 22, 20, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(bx + 40, by - 26, 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#222'; x.beginPath(); x.arc(bx + 41, by - 26, 3, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#E3A857'; x.beginPath(); x.moveTo(bx + 52, by - 22); x.lineTo(bx + 64, by - 18); x.lineTo(bx + 52, by - 14); x.fill();
    x.fillStyle = '#C2361F'; x.beginPath(); x.ellipse(bx + 52, by - 8, 4, 9, 0.2, 0, Math.PI * 2); x.fill();
  }
  _pumpkin(x, bx, by) {
    x.fillStyle = '#E07A1F';
    for (const s of [-1, 0, 1]) { x.beginPath(); x.ellipse(bx + s * 22, by, 30, 38, 0, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#5E7A2E'; x.fillRect(bx - 4, by - 50, 8, 16);
    x.fillStyle = '#5A2A12'; x.beginPath(); x.arc(bx - 14, by - 6, 5, 0, Math.PI * 2); x.arc(bx + 14, by - 6, 5, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#5A2A12'; x.lineWidth = 3; x.beginPath(); x.arc(bx, by + 4, 14, 0.2, Math.PI - 0.2); x.stroke();
  }
  _star(x, bx, by) {
    x.fillStyle = '#F2C230'; x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 22 : 50; x.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r); }
    x.fill();
    x.fillStyle = '#5A2A12'; x.beginPath(); x.arc(bx - 9, by - 2, 4, 0, Math.PI * 2); x.arc(bx + 9, by - 2, 4, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#5A2A12'; x.lineWidth = 2.5; x.beginPath(); x.arc(bx, by + 6, 8, 0.3, Math.PI - 0.3); x.stroke();
  }
  _hundred(x, bx, by) {
    x.font = `900 84px ${FONTS.ui}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = '#B8862E'; x.strokeText('100', bx, by);
    x.fillStyle = '#F2C46D'; x.fillText('100', bx, by);
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(bx - 50, by - 26, 18, 6);
  }

  // ── the game ──
  _football(t) {
    const x = this.x;
    x.fillStyle = '#2C3A2E'; x.fillRect(0, 0, W, H * 0.3);
    for (let i = 0; i < 160; i++) { x.fillStyle = ['#CC5500', '#2F4A6B', '#E3A857', '#990000', '#F2E6D0'][i % 5]; x.fillRect((i * 29) % W, 30 + ((i * 13) % 70) + Math.sin(t * 6 + i) * 1.5, 4, 4); }
    // the field in perspective, with its yard lines
    const g = x.createLinearGradient(0, H * 0.3, 0, H); g.addColorStop(0, '#3E7A3A'); g.addColorStop(1, '#4E9446');
    x.fillStyle = g; x.beginPath(); x.moveTo(W * 0.2, H * 0.3); x.lineTo(W * 0.8, H * 0.3); x.lineTo(W * 1.25, H); x.lineTo(-W * 0.25, H); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const v = i / 10, y = H * 0.3 + (H * 0.7) * v * v, half = (0.3 + 0.45 * v * v) * W; x.beginPath(); x.moveTo(W / 2 - half, y); x.lineTo(W / 2 + half, y); x.stroke(); }
    // the goalposts
    x.strokeStyle = '#F2C230'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(W / 2, H * 0.36); x.lineTo(W / 2, H * 0.26); x.moveTo(W / 2 - 46, H * 0.26); x.lineTo(W / 2 + 46, H * 0.26); x.moveTo(W / 2 - 46, H * 0.26); x.lineTo(W / 2 - 46, H * 0.04); x.moveTo(W / 2 + 46, H * 0.26); x.lineTo(W / 2 + 46, H * 0.04); x.stroke();
    // the kick: a spiral from the field up through the uprights, every few seconds
    const k = (t % 4.5) / 2.2;
    if (k < 1) {
      const bx = W / 2 + Math.sin(k * 3) * 10, by = H * 0.92 - k * H * 0.78 + k * k * H * 0.12, s = 1 - k * 0.75;
      x.save(); x.translate(bx, by); x.rotate(t * 14); x.scale(s, s * 0.62);
      x.fillStyle = '#7A3E1E'; x.beginPath(); x.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-8, 0); x.lineTo(8, 0); x.stroke();
      x.restore();
    } else if (k < 1.5) {
      x.font = `900 46px ${FONTS.ui}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 8; x.strokeStyle = '#1F3A1E'; x.strokeText("IT'S GOOD!", W / 2, H * 0.55); x.fillStyle = '#FFE08A'; x.fillText("IT'S GOOD!", W / 2, H * 0.55);
    }
    // the scoreboard
    x.fillStyle = 'rgba(20,20,24,0.85)'; x.fillRect(14, 12, 230, 34);
    x.font = `800 18px ${FONTS.ui}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    x.fillText('HOME 24', 24, 29); x.fillStyle = '#E3A857'; x.fillText('AWAY 21', 112, 29); x.fillStyle = '#9ad'; x.fillText('Q3', 200, 29);
    this._lowerThird(this.content.football.title.toUpperCase(), '#2F4A6B');
  }

  _lowerThird(text, color) {
    const x = this.x;
    x.fillStyle = color; x.fillRect(0, H - 46, W, 34);
    x.fillStyle = '#F2C46D'; x.fillRect(0, H - 46, 8, 34);
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
    fitFont(x, text, '800', 20, FONTS.ui, W - 40);
    x.fillText(text, 20, H - 29);
  }
}

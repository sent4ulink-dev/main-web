import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial, addOutline } from '../style/toon.js';
import { SERIF, SCRIPT } from '../world/salonTextures.js';

// The day, 18th-century style: an almanac — a little red-leather book open on a reading stand on the mantel.
// Its pages turn over one by one (the days before) until the special day, whose number gets circled in red
// ink with its note written underneath. The note is edited by a text layer laid over the page (editor).

const PW = 0.16, PH = 0.21;                      // one page
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const LABEL = { bottom: 92, size: 66, h: 1150 };   // where the note is written on the 1024×1150 page

function roman(n) {
  const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = ''; for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

function parchmentBase(x, w, h) {
  x.fillStyle = '#f2e4c4'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(140,95,35,0.3)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(120,70,30,0.55)'; x.lineWidth = 3; x.strokeRect(46, 46, w - 92, h - 92);
  x.lineWidth = 1.2; x.strokeRect(58, 58, w - 116, h - 116);
}

function texture(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; }

/** One day's page: the month in calligraphy, the year in Roman numerals, the day big; mark() circles it. */
function dayPage(date, highlight) {
  const w = 1024, h = 1150;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const b = base.getContext('2d');
  parchmentBase(b, w, h);
  b.textAlign = 'center'; b.fillStyle = '#3a2418';
  b.font = `400 150px ${SCRIPT}`; b.fillText(EN_MONTHS[date.getMonth()], w / 2, 250);
  b.font = `600 46px ${SERIF}`; b.fillStyle = '#7a4a2a'; b.fillText(`ANNO ${roman(date.getFullYear())}`, w / 2, 320);
  b.strokeStyle = 'rgba(122,74,42,0.7)'; b.lineWidth = 2;
  b.beginPath(); b.moveTo(200, 360); b.lineTo(w / 2 - 30, 360); b.moveTo(w / 2 + 30, 360); b.lineTo(w - 200, 360); b.stroke();
  b.font = `400 40px ${SCRIPT}`; b.fillText('❦', w / 2, 374);
  b.fillStyle = '#2a1810'; b.font = `700 470px ${SERIF}`;
  const cy = 700;
  b.fillText(String(date.getDate()), w / 2, cy + 160);
  x.drawImage(base, 0, 0);
  const tex = texture(c);
  function mark(progress = 1, label = '') {
    x.drawImage(base, 0, 0);
    if (highlight && progress > 0) {
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
      const rx = 270, ry = 250;
      for (const [lw, a, wob] of [[16, 0.6, 0], [9, 0.7, 3], [4, 0.5, -4]]) {     // red ink, three strokes of the quill
        x.strokeStyle = `rgba(168,28,44,${a})`; x.lineWidth = lw;
        x.beginPath();
        const end = -0.5 + Math.PI * 2.15 * Math.min(1, progress);
        for (let t = -0.5; t <= end; t += 0.03) {
          const r = 1 + Math.sin(t * 3 + wob) * 0.03 + (t > Math.PI * 1.6 ? (t - Math.PI * 1.6) * 0.04 : 0);
          x.lineTo(w / 2 + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r);
        }
        x.stroke();
      }
      if (progress >= 1 && label) {
        x.fillStyle = '#8a1c2c'; x.textAlign = 'center';
        let s = LABEL.size; x.font = `italic 700 ${s}px ${SERIF}`;
        while (s > 24 && x.measureText(label).width > w - 160) { s -= 2; x.font = `italic 700 ${s}px ${SERIF}`; }
        x.fillText(label, w / 2, h - LABEL.bottom);
      }
      x.restore();
    }
    tex.needsUpdate = true;
  }
  return { texture: tex, mark };
}

/** The left-hand page: a title with an engraving-like sun and the city's name. */
function titlePage() {
  const w = 1024, h = 1150, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  parchmentBase(x, w, h);
  x.textAlign = 'center'; x.fillStyle = '#3a2418';
  x.font = `400 120px ${SCRIPT}`; x.fillText('Almanach', w / 2, 260);
  x.font = `600 44px ${SERIF}`; x.fillStyle = '#7a4a2a'; x.fillText('WIEN', w / 2, 330);
  x.strokeStyle = '#7a4a2a'; x.lineWidth = 4;
  x.beginPath(); x.arc(w / 2, 640, 120, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 140, 640 + Math.sin(a) * 140); x.lineTo(w / 2 + Math.cos(a) * (i % 2 ? 190 : 230), 640 + Math.sin(a) * (i % 2 ? 190 : 230)); x.stroke(); }
  x.font = `italic 600 40px ${SERIF}`; x.fillText('auf das Jahr', w / 2, 930);
  return texture(c);
}

function plainPage() {
  const w = 256, h = 288, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); parchmentBase(x, w * 4, h * 4);
  x.fillStyle = '#efe0bf'; x.fillRect(0, 0, w, h);
  return texture(c);
}

export class DeskCalendar {
  constructor(parent, anchor, isoDate, label = '') {
    this.group = new THREE.Group();
    this.group.name = 'almanac';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    this.label = label;
    const wood = toonMaterial({ color: new THREE.Color('#6a3a1c') });
    const leather = toonMaterial({ color: new THREE.Color('#7a1424') }, { rimScale: 1.2 });
    const gilt = toonMaterial({ color: new THREE.Color('#d9a845'), emissive: new THREE.Color('#d9a845').multiplyScalar(0.15) }, { rimScale: 2.2 });
    const paper = toonMaterial({ color: new THREE.Color('#efe0bf') }, { rimScale: 0.3 });
    // the reading stand: a foot, a slanted board and a little ledge
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.2), wood); foot.position.y = 0.01;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), wood); post.position.set(0, 0.07, -0.02);
    this.book = new THREE.Group();
    this.book.position.set(0, 0.13, 0.0);
    this.book.rotation.x = -1.0;                  // leaning back, open towards the viewer
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.012), wood); board.position.z = -0.012;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.016, 0.03), gilt); ledge.position.set(0, -0.128, 0.006);
    this.book.add(board, ledge);
    // the open book: covers, a rounded spine, the page blocks
    for (const sx of [-1, 1]) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.012, PH + 0.012, 0.006), leather);
      cover.position.set(sx * (PW / 2 + 0.006), 0, -0.002);
      const block = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.004, PH - 0.004, 0.012), paper);
      block.position.set(sx * (PW / 2), 0, 0.007);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.014, 0.004, 0.0065), gilt);
      edge.position.set(sx * (PW / 2 + 0.006), PH / 2 + 0.004, -0.002);
      this.book.add(cover, block, edge);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, PH + 0.012, 12), leather); spine.position.z = -0.004;
    this.book.add(spine);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), toonMaterial({ map: titlePage() }, { rimScale: 0.2 }));
    left.position.set(-PW / 2, 0, 0.0135);
    this.book.add(left);
    // the right-hand pages: the three days before, then the day — each hinged on the spine
    const d = new Date(`${isoDate}T12:00:00`);
    this.days = [3, 2, 1, 0].map((k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - k, 12));
    const geo = new THREE.PlaneGeometry(PW, PH); geo.translate(PW / 2, 0, 0);
    const back = toonMaterial({ map: plainPage() }, { rimScale: 0.2 });
    this.pages = this.days.map((day, i) => {
      const last = i === this.days.length - 1;
      const page = dayPage(day, last);
      if (last) this.markPage = page;
      const pivot = new THREE.Group();
      pivot.position.set(0, 0, 0.0135 + (this.days.length - i) * 0.0009);
      const front = new THREE.Mesh(geo, toonMaterial({ map: page.texture }, { rimScale: 0.2 }));
      const rear = new THREE.Mesh(geo, back); rear.rotation.y = Math.PI; rear.position.x = PW; rear.position.z = -0.0004;
      pivot.add(front, rear);
      pivot.userData.front = front;
      this.book.add(pivot);
      return pivot;
    });
    this.pageZ = this.pages.map((p) => p.position.z);
    this.group.add(foot, post, this.book);
    this.group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.geometry.type === 'BoxGeometry' || m.geometry.type === 'CylinderGeometry') addOutline(m, 0.0012); } });
    this.flipped = false;
    this.hitTargets = [];
    this.group.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
  }

  /** New special date: repaint the day pages (and the circle). */
  setDate(iso) {
    const d = new Date(`${iso}T12:00:00`);
    this.days = [3, 2, 1, 0].map((k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - k, 12));
    this.pages.forEach((pivot, i) => {
      const last = i === this.days.length - 1;
      const page = dayPage(this.days[i], last);
      if (last) this.markPage = page;
      const mat = pivot.userData.front.material; mat.map?.dispose(); mat.map = page.texture; mat.needsUpdate = true;
    });
    if (this.flipped) this.markPage.mark(1, this._noLabel ? '' : this.label);
  }
  setLabel(label) { this.label = label; if (this.flipped) this.markPage.mark(1, this._noLabel ? '' : label); }
  /** While editing, the note is hidden on the page (a text layer sits over it instead). */
  setLabelHidden(hidden) { this._noLabel = hidden; if (this.flipped) this.markPage.mark(1, hidden ? '' : this.label); }

  /** Screen rectangle of the note line on the day's page (for the editing layer), or null. */
  labelRect(camera, w, h) {
    if (!this.flipped) return null;
    const mesh = this.pages[this.pages.length - 1].userData.front;
    mesh.updateMatrixWorld(true);
    const yAt = (py) => PH / 2 - PH * (py / LABEL.h);
    const y0 = yAt(LABEL.h - LABEL.bottom - LABEL.size * 0.95), y1 = yAt(LABEL.h - LABEL.bottom + LABEL.size * 0.3);
    const pts = [[0.006, y0], [PW - 0.006, y1]].map(([x, y]) => mesh.localToWorld(new THREE.Vector3(x, y, 0)).project(camera));
    if (pts.some((p) => p.z > 1)) return null;
    const x0 = (pts[0].x * 0.5 + 0.5) * w, ya = (-pts[0].y * 0.5 + 0.5) * h, x1 = (pts[1].x * 0.5 + 0.5) * w, yb = (-pts[1].y * 0.5 + 0.5) * h;
    return { x: Math.min(x0, x1), y: Math.min(ya, yb), w: Math.abs(x1 - x0), h: Math.abs(yb - ya) };
  }

  /** Turn the earlier days over to the left, then circle the day in red ink. */
  reveal() {
    if (this.flipped) return Promise.resolve();
    this.flipped = true;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      this.pages.slice(0, -1).forEach((p, i) => {
        tl.to(p.rotation, { y: -Math.PI, duration: 0.85, ease: 'power2.inOut' }, i * 0.45);
        tl.to(p.position, { z: 0.0135 + 0.003 + i * 0.0009, duration: 0.85, ease: 'power2.inOut' }, i * 0.45);
      });
      const st = { k: 0 };
      tl.to(st, { k: 1, duration: 1.3, ease: 'power1.inOut', onUpdate: () => this.markPage.mark(st.k, this._noLabel ? '' : this.label) }, '+=0.15');
    });
  }

  reset() {
    this.flipped = false;
    this.pages.forEach((p, i) => { p.rotation.y = 0; p.position.z = this.pageZ[i]; });
    this.markPage.mark(0);
  }

  get focusPoint() { return this.book.localToWorld(new THREE.Vector3(PW * 0.5, 0, 0.02)); }
}

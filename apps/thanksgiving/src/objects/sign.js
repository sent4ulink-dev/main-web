import * as THREE from 'three';
import { canvas, tex, FONTS, wrapText, fitFont, longDate } from '../world/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

// The welcome easel by the door: a chalkboard. The welcome (the family's name and a few words from the host)
// is written on it in chalk as you arrive — letter by letter, a stick of chalk moving along each line — and
// when you turn to the date and the place, a felt eraser wipes the board and the chalk writes them in its
// place (and back again). Between times the chalk and the eraser rest on the easel's ledge.

const CW = 750, CH = 1024;
const CHALK = 'rgba(250,244,230,0.94)', GOLD = 'rgba(240,190,100,0.95)', PEACH = 'rgba(255,214,160,0.96)';

function leafDoodle(x, cx, cy, s, rot, color) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  x.strokeStyle = color; x.lineWidth = 3.2 / s; x.lineCap = 'round';
  x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 30 * (0.6 + 0.4 * Math.abs(Math.sin(a * 2.5)) ** 0.7) * (Math.sin(a) < -0.85 ? 0.55 : 1);
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.stroke();
  x.beginPath(); x.moveTo(0, 28); x.lineTo(0, -18); x.moveTo(0, 0); x.lineTo(-14, -14); x.moveTo(0, 0); x.lineTo(14, -14); x.stroke();
  x.restore();
}

function wheat(x, cx, cy, s, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  x.strokeStyle = 'rgba(240,200,120,0.85)'; x.lineWidth = 3; x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, 60); x.quadraticCurveTo(4, 0, 0, -60); x.stroke();
  for (let i = 0; i < 6; i++) { const y = -50 + i * 16; x.beginPath(); x.ellipse(-8, y, 5, 10, -0.5, 0, Math.PI * 2); x.ellipse(8, y, 5, 10, 0.5, 0, Math.PI * 2); x.stroke(); }
  x.restore();
}

function pumpkin(x, cx, cy) {
  x.save(); x.translate(cx, cy); x.strokeStyle = 'rgba(232,120,60,0.9)'; x.lineWidth = 4;
  for (const s of [-1, 0, 1]) { x.beginPath(); x.ellipse(s * 22, 0, 34, 38, 0, 0, Math.PI * 2); x.stroke(); }
  x.strokeStyle = 'rgba(120,170,90,0.9)'; x.beginPath(); x.moveTo(0, -38); x.quadraticCurveTo(4, -58, 15, -63); x.stroke(); x.restore();
}

/** One thing written on the board: a line of text, a stroke, a little drawing — each knows its box (for the chalk). */
function text(t, cx, cy, { size = 58, family = FONTS.hand, weight = '700', color = CHALK, maxW = 620 } = {}) {
  return {
    t, cx, cy, chars: Math.max(3, String(t).length),
    draw(x) {
      const s = fitFont(x, t, weight, size, family, maxW);
      x.font = `${weight} ${s}px ${family}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = color; x.fillText(t, cx, cy);
      x.globalAlpha = 0.18; x.fillText(t, cx + 1.5, cy + 1); x.globalAlpha = 1;   // a dusty edge
      const w = x.measureText(t).width;
      this.x0 = cx - w / 2; this.x1 = cx + w / 2; this.h = s;
    },
  };
}
function shape(draw, x0, x1, cy, h, chars = 6) { return { chars, x0, x1, cx: (x0 + x1) / 2, cy, h, draw }; }

export class WelcomeSign {
  constructor(root, scene) {
    this.root = root;
    this.face = root.getObjectByName('sign_face');
    const [c, x] = canvas(CW, CH);
    this.c = c; this.x = x;
    this.texture = tex(c); this.texture.flipY = false;   // (glTF UVs)
    if (this.face) this.face.material = new THREE.MeshBasicMaterial({ map: this.texture, color: new THREE.Color(0.9, 0.88, 0.84) });
    // the board as it is when nothing is written (old smudges, the corner doodles) — and as it is now
    const [bc, bx] = canvas(CW, CH); this.base = bc; this.bx = bx;
    this._clean(bx);
    this.mode = null; this.shown = null; this.job = null;
    this.x.drawImage(this.base, 0, 0); this.texture.needsUpdate = true;
    this._mapFace();
    // the chalk and the eraser
    this.chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.085, 10).translate(0, 0.0425, 0), toonMaterial({ color: new THREE.Color('#F7F3EA') }));
    addOutline(this.chalk, 0.0012);
    this.eraser = new THREE.Group();
    const wood = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.045), toonMaterial({ color: new THREE.Color('#A8743F') }));
    wood.position.y = 0.022; addOutline(wood, 0.0012);
    const felt = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.012, 0.042), toonMaterial({ color: new THREE.Color('#4A4448') }));
    felt.position.y = 0.006;
    this.eraser.add(wood, felt);
    scene.add(this.chalk, this.eraser);
    this._rest();
  }

  get focusPoint() { return this.face ? this.face.getWorldPosition(new THREE.Vector3()) : this.root.position.clone(); }   // the board's middle (the face's origin)
  get normal() { return new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)); }
  /** Is something (still) being chalked or wiped? */
  get busy() { return !!this.job; }

  /** From the canvas (pixels) to the board in the room: the face's UVs give its corners. */
  _mapFace() {
    this.root.updateMatrixWorld(true);
    const g = this.face?.geometry; if (!g) return;
    const pos = g.attributes.position, uv = g.attributes.uv;
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (u + v < uv.getX(a) + uv.getY(a)) a = i;          // (0,0)
      if (u - v > uv.getX(b) - uv.getY(b)) b = i;          // (1,0)
      if (v - u > uv.getY(c) - uv.getX(c)) c = i;          // (0,1)
    }
    const P = (i) => new THREE.Vector3().fromBufferAttribute(pos, i);
    const ua = new THREE.Vector2(uv.getX(a), uv.getY(a)), ub = new THREE.Vector2(uv.getX(b), uv.getY(b)), uc = new THREE.Vector2(uv.getX(c), uv.getY(c));
    const du = P(b).sub(P(a)).divideScalar(Math.max(1e-6, ub.x - ua.x)), dv = P(c).sub(P(a)).divideScalar(Math.max(1e-6, uc.y - ua.y));
    const o = P(a).addScaledVector(du, -ua.x).addScaledVector(dv, -ua.y);
    this._uv = { o, du, dv, m: this.face.matrixWorld.clone() };
    this._n = new THREE.Vector3().crossVectors(du, dv).normalize().transformDirection(this.face.matrixWorld);
    if (this._n.dot(this.normal) < 0) this._n.negate();
  }
  /** A canvas point (px) on the board, `out` metres in front of it. */
  at(px, py, out = 0.004, v = new THREE.Vector3()) {
    const U = this._uv; if (!U) return v.copy(this.focusPoint);
    v.copy(U.o).addScaledVector(U.du, px / CW).addScaledVector(U.dv, py / CH).applyMatrix4(U.m);
    return v.addScaledVector(this._n, out);
  }

  /** The chalk and the eraser back on the ledge under the board. */
  _rest() {
    const up = new THREE.Vector3(0, 1, 0);
    this.chalk.position.copy(this.at(CW * 0.72, CH * 1.035, 0.03)); this.chalk.quaternion.setFromUnitVectors(up, this._side()); this.chalk.position.y -= 0.004;
    this.eraser.position.copy(this.at(CW * 0.3, CH * 1.035, 0.03)); this.eraser.position.y -= 0.02;
    this.eraser.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), this._side()); this.eraser.rotateY(0);
  }
  _side() { return this._uv ? this._uv.du.clone().transformDirection(this._uv.m) : new THREE.Vector3(1, 0, 0); }

  _clean(x) {
    const g = x.createRadialGradient(CW / 2, CH / 2, 100, CW / 2, CH / 2, CH * 0.75);
    g.addColorStop(0, '#34443B'); g.addColorStop(1, '#232E28');
    x.fillStyle = g; x.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.02})`; x.beginPath(); x.ellipse(Math.random() * CW, Math.random() * CH, 40 + Math.random() * 120, 10 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2); x.fill(); }
    const cols = ['rgba(232,120,60,0.9)', 'rgba(240,190,90,0.9)', 'rgba(210,80,60,0.9)'];
    leafDoodle(x, 80, 80, 1.1, -0.4, cols[0]); leafDoodle(x, 672, 92, 0.95, 0.5, cols[1]); leafDoodle(x, 655, 945, 1.0, 2.6, cols[2]);
    wheat(x, 84, 920, 1.0, 0.3); wheat(x, 110, 925, 0.85, 0.6);
  }

  /** What goes on the board, in writing order. */
  _items(content, mode, greeting) {
    const out = [];
    if (mode === 'welcome') {
      out.push(text('Welcome', CW / 2, 200, { size: 112, family: FONTS.script, weight: '400', color: PEACH }));
      out.push(text('to our table', CW / 2, 290, { size: 52 }));
      out.push(shape((x) => { x.strokeStyle = 'rgba(250,244,230,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(230, 334); x.quadraticCurveTo(375, 352, 520, 334); x.stroke(); }, 230, 520, 340, 20, 5));
      out.push(text(content.family, CW / 2, 410, { size: 84, family: FONTS.title, weight: '700', maxW: 640 }));
      if (greeting) out.push(text(greeting, CW / 2, 490, { size: 46, color: GOLD }));
      // the host's few words (the first paragraph of their letter), in smaller chalk
      const L = content.letter || {}, first = (L.paragraphs || [])[0] || '';
      this.x.font = `700 43px ${FONTS.hand}`;
      let lines = wrapText(this.x, first, 610);
      if (lines.length > 4) { lines = lines.slice(0, 4); lines[3] = `${lines[3].replace(/[,.;:!?]?\s*\S*$/, '')}…`; }
      const y0 = greeting ? 550 : 510;
      lines.forEach((l, i) => out.push(text(l, CW / 2, y0 + i * 52, { size: 43 })));
      const yS = y0 + lines.length * 52 + 30;
      out.push(text(`${L.signoff || 'With love'} ${content.host || ''}`.trim(), CW / 2, yS, { size: 48, color: PEACH, maxW: 560 }));
      out.push(shape((x) => pumpkin(x, CW / 2, Math.min(925, yS + 85)), CW / 2 - 60, CW / 2 + 60, Math.min(925, yS + 85), 80, 8));
    } else {
      const d = content.date, p = content.place;
      out.push(text('Save the date', CW / 2, 190, { size: 62, color: GOLD }));
      out.push(text(longDate(d.iso), CW / 2, 272, { size: 64, family: FONTS.title, weight: '700' }));
      out.push(shape((x) => { x.strokeStyle = 'rgba(250,244,230,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(170, 328); x.lineTo(580, 328); x.stroke(); }, 170, 580, 328, 10, 5));
      out.push(text(`Doors open ${d.time}`, CW / 2, 400, { size: 56 }));
      out.push(text(`Dinner at ${d.dinner}`, CW / 2, 470, { size: 56 }));
      out.push(text(p.name, CW / 2, 575, { size: 56, color: PEACH }));
      this.x.font = `700 44px ${FONTS.hand}`;
      wrapText(this.x, p.address, 560).slice(0, 3).forEach((l, i) => out.push(text(l, CW / 2, 645 + i * 52, { size: 44, color: 'rgba(250,244,230,0.85)' })));
      if (p.note) { this.x.font = `700 38px ${FONTS.hand}`; wrapText(this.x, p.note, 560).slice(0, 2).forEach((l, i) => out.push(text(l, CW / 2, 830 + i * 46, { size: 38, color: GOLD }))); }
    }
    return out;
  }

  /** Everything written at once (editing, a reload of the words). */
  paint(content, mode = this.mode || 'welcome', { greeting = this._greeting } = {}) {
    this._finishJob();
    this.mode = mode; this.shown = mode; this._greeting = greeting;
    const x = this.x;
    x.drawImage(this.base, 0, 0);
    for (const it of this._items(content, mode, greeting)) it.draw(x);
    this.texture.needsUpdate = true;
  }

  _finishJob() { if (this.job) { const j = this.job; this.job = null; j.finish(); } }

  /** Chalk the board, line by line (resolves when done). */
  write(content, mode, { greeting = null, onStroke = () => {} } = {}) {
    this._finishJob();
    this.mode = mode; this._greeting = greeting;
    const items = this._items(content, mode, greeting);
    const x = this.x;
    // measure everything once (each item learns its width), then start from the clean board
    const [mc, mx] = canvas(8, 8); void mc;
    for (const it of items) it.draw(mx);
    const total = items.reduce((n, it) => n + it.chars, 0);
    const perChar = Math.min(0.055, 4.6 / total);
    const plan = []; let t = 0;
    for (const it of items) { const d = Math.max(0.28, it.chars * perChar); plan.push({ it, t0: t, t1: t + d }); t += d + 0.12; }
    return new Promise((resolve) => {
      let time = 0, k = -1;
      const draw = (upto) => {
        x.drawImage(this.base, 0, 0);
        for (let i = 0; i < plan.length; i++) {
          const p = plan[i];
          if (upto >= p.t1) { p.it.draw(x); continue; }
          if (upto <= p.t0) break;
          const f = (upto - p.t0) / (p.t1 - p.t0), edge = p.it.x0 + (p.it.x1 - p.it.x0) * f;
          x.save(); x.beginPath(); x.rect(0, 0, edge, CH); x.clip(); p.it.draw(x); x.restore();
          return { px: edge, py: p.it.cy + Math.sin(upto * 40) * (p.it.h || 40) * 0.12 };
        }
        return null;
      };
      this.job = {
        tick: (dt) => {
          time += dt;
          const tip = draw(time);
          const i = plan.findIndex((p) => time < p.t1);
          if (i !== k && i >= 0) { k = i; onStroke(i); }
          if (tip) {
            this.chalk.position.copy(this.at(tip.px, tip.py, 0.004));
            this.chalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this._n.clone().negate().add(new THREE.Vector3(0, -0.6, 0)).normalize());
          }
          this.texture.needsUpdate = true;
          if (time >= t) this.job.finish();
        },
        finish: () => { this.job = null; draw(1e9); this.texture.needsUpdate = true; this.shown = mode; this._rest(); resolve(); },
      };
    });
  }

  /** The eraser wipes the board clean, row by row (resolves when done). */
  erase() {
    this._finishJob();
    const x = this.x, rows = 6, dur = 1.5;
    return new Promise((resolve) => {
      let time = 0;
      const pt = (f) => {   // the eraser's zigzag path, top to bottom
        const r = Math.min(rows - 1e-6, f * rows), row = Math.floor(r), u = r - row;
        return { px: 60 + (row % 2 ? 1 - u : u) * (CW - 120), py: 90 + row * ((CH - 180) / (rows - 1)) };
      };
      let last = pt(0);
      this.job = {
        tick: (dt) => {
          time += dt;
          const f = Math.min(1, time / dur), p = pt(f);
          // wipe along the way: the clean board back, with a faint chalky smear left behind
          x.save(); x.beginPath();
          const w = 130, h = 120;
          x.rect(Math.min(last.px, p.px) - w / 2, Math.min(last.py, p.py) - h / 2, Math.abs(p.px - last.px) + w, Math.abs(p.py - last.py) + h);
          x.clip(); x.drawImage(this.base, 0, 0);
          x.fillStyle = 'rgba(255,255,255,0.035)'; x.beginPath(); x.ellipse(p.px, p.py, 70, 40, 0, 0, Math.PI * 2); x.fill();
          x.restore();
          last = p;
          this.eraser.position.copy(this.at(p.px, p.py, 0.012));
          this.eraser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._n);
          this.eraser.rotateY(Math.sin(time * 18) * 0.15);
          this.texture.needsUpdate = true;
          if (f >= 1) this.job.finish();
        },
        finish: () => {
          this.job = null;
          // what's left: a faintly smudged board (it becomes the board new words are chalked onto)
          this.bx.globalAlpha = 1;
          for (let i = 0; i < 6; i++) { this.bx.fillStyle = 'rgba(255,255,255,0.02)'; this.bx.beginPath(); this.bx.ellipse(80 + Math.random() * (CW - 160), 120 + Math.random() * (CH - 240), 140, 40, Math.random() * 0.4 - 0.2, 0, Math.PI * 2); this.bx.fill(); }
          x.drawImage(this.base, 0, 0); this.texture.needsUpdate = true;
          this.shown = null; this._rest(); resolve();
        },
      };
    });
  }

  update(dt) { this.job?.tick(Math.min(dt, 0.05)); }
}

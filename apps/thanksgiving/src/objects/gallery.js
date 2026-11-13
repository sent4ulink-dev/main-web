import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { canvas, tex, FONTS, fitFont } from '../world/textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The family's photos on the wall above the sideboard: six frames of different sizes and woods round a
// wooden plaque with the family's name. The host hangs their own pictures in them (tap a frame); until then
// they hold old painted snapshots — the farm, the pumpkin patch, a long-ago Thanksgiving.

// [along the wall (m, + toward the door), height above the floor, width, height, frame colour]
const FRAMES = [
  [0, 1.95, 0.66, 0.5, '#5A3B28'],
  [0.74, 2.2, 0.4, 0.5, '#C9A24C'],
  [0.78, 1.6, 0.46, 0.34, '#2B2422'],
  [-0.74, 2.22, 0.46, 0.34, '#F2EBDD'],
  [-0.72, 1.62, 0.38, 0.48, '#8A5A34'],
  [0, 1.4, 0.42, 0.3, '#C9A24C'],
];

/** An old snapshot, painted: a little scene in faded, warm colours. */
export function snapshot(kind, w = 512, h = 384) {
  const [c, x] = canvas(w, h);
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#E9C79A'); sky.addColorStop(1, '#F6E6C8');
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  const person = (px, py, s, col, hair) => {
    x.fillStyle = col; x.beginPath(); x.ellipse(px, py + 34 * s, 22 * s, 30 * s, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#E8B98E'; x.beginPath(); x.arc(px, py, 15 * s, 0, Math.PI * 2); x.fill();
    x.fillStyle = hair; x.beginPath(); x.arc(px, py - 4 * s, 15.5 * s, Math.PI, 0); x.fill();
  };
  if (kind === 0) {   // the farm: hills, a red barn, a tree
    x.fillStyle = '#B9A36A'; x.beginPath(); x.moveTo(0, 250); x.quadraticCurveTo(200, 190, 512, 240); x.lineTo(512, 384); x.lineTo(0, 384); x.fill();
    x.fillStyle = '#8E2F22'; x.fillRect(250, 170, 120, 90); x.beginPath(); x.moveTo(240, 172); x.lineTo(310, 120); x.lineTo(380, 172); x.fill();
    x.fillStyle = '#F2E6D0'; x.fillRect(296, 210, 28, 50);
    x.fillStyle = '#5B3A22'; x.fillRect(110, 170, 14, 90); x.fillStyle = '#C46A2A'; x.beginPath(); x.arc(117, 150, 52, 0, Math.PI * 2); x.fill();
  } else if (kind === 1) {   // the family on the porch, long ago
    x.fillStyle = '#C9A57A'; x.fillRect(0, 0, w, h); x.fillStyle = '#B08A60'; for (let i = 0; i < 9; i++) x.fillRect(0, i * 44, w, 3);
    x.fillStyle = '#8A6A4A'; x.fillRect(0, 300, w, 84);
    [[140, 150, '#6E473B', '#3B2A20'], [210, 140, '#990000', '#6B4A2F'], [290, 145, '#3F6B4A', '#1E1714'], [365, 152, '#2F4A6B', '#C4652D']].forEach(([px, py, a, b]) => person(px, py, 1.6, a, b));
    person(250, 230, 1.0, '#CC5500', '#3B2A20'); person(320, 235, 0.95, '#E3A857', '#6B4A2F');
  } else if (kind === 2) {   // the pumpkin patch
    x.fillStyle = '#9C8A55'; x.fillRect(0, 200, w, 184);
    for (let i = 0; i < 14; i++) { const px = 30 + (i * 73) % 470, py = 240 + (i % 4) * 34; x.fillStyle = '#D9782E'; x.beginPath(); x.ellipse(px, py, 22, 16, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#5E4A22'; x.fillRect(px - 2, py - 20, 4, 8); }
    person(330, 150, 1.3, '#990000', '#6B4A2F'); person(250, 175, 0.85, '#E3A857', '#C4652D');
  } else if (kind === 3) {   // the two of them, all dressed up
    x.fillStyle = '#D9C7A6'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#A88C62'; x.lineWidth = 10; x.beginPath(); x.arc(256, 260, 150, Math.PI, 0); x.stroke();
    person(215, 170, 1.7, '#2B2422', '#3B2A20'); person(300, 175, 1.7, '#F7F1E4', '#6B4A2F');
  } else if (kind === 4) {   // kids in the leaves with the dog
    x.fillStyle = '#C08A4A'; x.fillRect(0, 230, w, 154);
    for (let i = 0; i < 60; i++) { x.fillStyle = ['#C2361F', '#D96A1E', '#E0A830'][i % 3]; x.beginPath(); x.ellipse((i * 97) % w, 240 + (i * 37) % 140, 9, 5, i, 0, Math.PI * 2); x.fill(); }
    person(190, 190, 1.0, '#3F6B4A', '#1E1714'); person(280, 195, 0.95, '#CC5500', '#D9B26A');
    x.fillStyle = '#6E473B'; x.beginPath(); x.ellipse(370, 270, 34, 18, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(398, 252, 13, 0, Math.PI * 2); x.fill();
  } else {   // a Thanksgiving table, long ago
    x.fillStyle = '#B9946A'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#F2E9D8'; x.beginPath(); x.moveTo(60, 250); x.lineTo(452, 250); x.lineTo(500, 384); x.lineTo(12, 384); x.fill();
    x.fillStyle = '#C9822F'; x.beginPath(); x.ellipse(256, 270, 50, 30, 0, 0, Math.PI * 2); x.fill();
    [[90, 170], [170, 160], [342, 160], [422, 170]].forEach(([px, py], i) => person(px, py, 1.2, ['#990000', '#3F6B4A', '#2F4A6B', '#6E473B'][i], '#3B2A20'));
  }
  // faded like an old print: sepia wash, a soft vignette, a little grain
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(214,180,130,0.55)'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  const v = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,30,10,0.45)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,20,10'},0.05)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  return c;
}

export class FamilyWall {
  constructor(scene, { x, zc, floor }) {
    this.root = new THREE.Group(); this.root.name = 'family-wall';
    this.root.position.set(x, floor, zc); this.root.rotation.y = Math.PI / 2;   // (the wall at -x, facing into the room)
    scene.add(this.root);
    this.slots = [];
    this.hitTargets = [];
    FRAMES.forEach(([dz, y, w, h, col], n) => {
      const g = new THREE.Group(); g.position.set(-dz, y, 0);
      const wood = toonMaterial({ color: new THREE.Color(col) }, { rimScale: col === '#C9A24C' ? 1.6 : 0.8 });
      const t = 0.045, d = 0.035;
      const sides = [[w + t * 2, t, 0, h / 2 + t / 2], [w + t * 2, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0]].map(([bw, bh, bx, by]) => new THREE.BoxGeometry(bw, bh, d).translate(bx, by, d / 2));
      const b = new THREE.Mesh(mergeGeometries(sides), wood); addOutline(b, 0.0012); g.add(b);   // (one draw per frame)
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color('#F3EBDC') }));
      mat.position.z = 0.006; g.add(mat);
      const pm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.92, 0.9, 0.86) });
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.84, h * 0.84), pm);
      photo.position.z = 0.008; photo.userData.slot = n;
      g.add(photo);
      this.root.add(g);
      this.hitTargets.push(photo);
      this.slots.push({ g, photo, pm, w: w * 0.84, h: h * 0.84, real: false, fallback: n, painted: snapshot(n % 6) });
      this._fit(n, this.slots[n].painted);
    });
    // the plaque with the family's name
    const [pc, px] = canvas(1024, 224); this.plaqueC = pc; this.plaqueX = px;
    this.plaqueTex = tex(pc);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.03), toonMaterial({ color: new THREE.Color('#7A4F2E') }));
    board.position.set(0, 2.56, 0.015); addOutline(board, 0.0012);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.17), new THREE.MeshBasicMaterial({ map: this.plaqueTex, transparent: true }));
    face.position.set(0, 2.56, 0.031);
    this.root.add(board, face);
    this.root.updateMatrixWorld(true);
  }

  setFamily(name) {
    const x = this.plaqueX;
    x.clearRect(0, 0, 1024, 224);
    x.fillStyle = '#F6E6C8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const s = fitFont(x, name, '400', 130, FONTS.script, 900);
    x.font = `400 ${s}px ${FONTS.script}`; x.fillText(name, 512, 120);
    this.plaqueTex.needsUpdate = true;
  }

  /** Put a picture in a frame, cropped to fill it (cover). */
  _fit(n, img) {
    const s = this.slots[n];
    s.pm.map?.dispose();
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.anisotropy = 4;
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) t.flipY = false;   // (bitmaps come pre-flipped: see photos.js)
    const iw = img.width || 1, ih = img.height || 1, fa = s.w / s.h, ia = iw / ih;
    if (ia > fa) { t.repeat.set(fa / ia, 1); t.offset.set((1 - fa / ia) / 2, 0); } else { t.repeat.set(1, ia / fa); t.offset.set(0, (1 - ia / fa) / 2); }
    s.pm.map = t; s.pm.color.setRGB(1, 1, 1); s.pm.needsUpdate = true;
  }
  /** A real photo (an ImageBitmap / image / canvas) — or null to go back to the painted snapshot. */
  setPhoto(n, img) {
    const s = this.slots[n]; if (!s) return;
    s.real = !!img;
    this._fit(n, img || s.painted);
  }
  /** The painted snapshot in a frame (to look at closer), as an image URL. */
  paintedURL(n) { return this.slots[n]?.painted.toDataURL('image/jpeg', 0.9) || null; }
  get count() { return this.slots.filter((s) => s.real).length; }
  slotOf(mesh) { return mesh?.userData?.slot ?? null; }
  get centre() { return this.root.localToWorld(new THREE.Vector3(0, 1.9, 0.02)); }
  get bottomPoint() { return this.root.localToWorld(new THREE.Vector3(0, 0.95, 0.3)); }
  get halfWidth() { return 1.1; }
}

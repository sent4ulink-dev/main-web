import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { piece, Instancer, place } from '../world/props.js';
import { canvas, tex, blobTexture, glowTexture, FONTS, fitFont } from '../world/textures.js';
import { FLOOR, TABLE_TOP, TABLE_W } from '../world/layout.js';
import { Flames } from '../fx/flames.js';
import { Cornucopia } from './cornucopia.js';

// The long table: a linen cloth and a burlap runner down a wooden farmhouse table, a chair and a place
// setting (with a name card and dinner already on the plate) for everyone, and the feast down the middle —
// the turkey in pride of place, a glazed ham on a long table, candles, pies, bowls and baskets, pitchers,
// bread, butter, mini pumpkins and fallen leaves, and the horn of plenty spilling over at the far end. Each
// row has a spot on either side of the runner: a guest's potluck dish goes in theirs (so you can see who
// brought what); between the rows stand the shared things.

const DISHES = ['roll_basket', 'pumpkin_pie', 'mashed_potatoes', 'cranberry_bowl', 'gravy_boat', 'stuffing', 'green_beans', 'apple_pie', 'corn_plate', 'sweet_potato', 'pecan_pie', 'salad', 'mac_cheese', 'cider_jug', 'covered_dish', 'pitcher', 'butter_dish', 'bread_board', 'salt_pepper', 'fruit_bowl', 'deviled_eggs', 'ham'];
const MIDDLE = ['pitcher', 'bread_board', 'butter_dish', 'fruit_bowl', 'salt_pepper', 'deviled_eggs', 'gravy_boat', 'roll_basket', 'cranberry_bowl'];
const DEFAULT_ROW = ['roll_basket', 'candle', 'pumpkin_pie', 'decor', 'mashed_potatoes', 'pillar_candle', 'cranberry_bowl', 'gravy_boat', 'candle', 'stuffing', 'decor', 'green_beans', 'apple_pie', 'pillar_candle', 'corn_plate', 'candle', 'sweet_potato', 'pecan_pie', 'decor', 'salad', 'mac_cheese', 'pillar_candle'];

/** Which model shows a potluck dish, from its name. */
export function dishModel(name = '') {
  const n = name.toLowerCase();
  if (/pie|tart/.test(n)) return n.includes('pecan') ? 'pecan_pie' : n.includes('apple') ? 'apple_pie' : 'pumpkin_pie';
  if (/roll|bread|biscuit|croissant|muffin/.test(n)) return 'roll_basket';
  if (/sweet potato|yam|marshmallow/.test(n)) return 'sweet_potato';
  if (/mash|potato/.test(n)) return 'mashed_potatoes';
  if (/green bean|bean|veg|broccoli|sprout|asparagus|carrot/.test(n)) return 'green_beans';
  if (/mac|cheese|pasta|lasagna|casserole/.test(n)) return 'mac_cheese';
  if (/stuffing|dressing/.test(n)) return 'stuffing';
  if (/salad|slaw/.test(n)) return 'salad';
  if (/cranberr|sauce|jam|relish/.test(n)) return 'cranberry_bowl';
  if (/gravy/.test(n)) return 'gravy_boat';
  if (/corn/.test(n)) return 'corn_plate';
  if (/cider|juice|wine|drink|soda|punch|tea|coffee|lemonade|beer|cocoa/.test(n)) return 'cider_jug';
  return 'covered_dish';
}

export class FeastTable {
  constructor(scene) {
    this.scene = scene;
    const wood = toonMaterial({ color: new THREE.Color('#8A5A3B') });
    this.top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wood);
    this.cloth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), toonMaterial({ color: new THREE.Color('#FDFBF7') }, { rimScale: 0.6 }));
    this.runner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), toonMaterial({ color: new THREE.Color('#BFA272') }, { rimScale: 0.3 }));
    addOutline(this.cloth, 0.0018);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.top, this.cloth, this.runner, this.shadow);
    this.legs = new Instancer(scene, 'table_leg', 16);
    this.chairs = new Instancer(scene, 'chair', 60);
    this.settings = new Instancer(scene, 'place_setting', 60);
    this.plates = ['plate_food_a', 'plate_food_b', 'plate_food_c'].map((n) => new Instancer(scene, n, 24, { outline: 0 }));
    this.horn = new Cornucopia(scene);
    this.candles = new Instancer(scene, 'candle', 40, { outline: 0 });
    this.pillars = new Instancer(scene, 'pillar_candle', 30, { outline: 0 });
    this.dishes = new Map(DISHES.map((d) => [d, new Instancer(scene, d, 40)]));
    this.decor = new Map(['mini_pumpkin', 'mini_pumpkin_white', 'gourd', 'leaf_red', 'leaf_orange', 'leaf_gold', 'acorn'].map((d) => [d, new Instancer(scene, d, 120, { outline: 0 })]));
    this.turkey = piece('turkey');
    scene.add(this.turkey);
    this.glow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTexture(64), size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb460, opacity: 0.7 }));
    this.glow.frustumCulled = false;
    scene.add(this.glow);
    this.flames = null;
    this.cards = null;
    this.chairShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.8 }), 60);
    this.chairShadows.frustumCulled = false;
    scene.add(this.chairShadows);
    this.dishSpots = new Map();   // guest id → where their potluck dish stands
  }

  /** Lay the table for this layout; `guests` are the seated people in seat order: {id, name, dish}. */
  layout(lay, guests, { potluck = true } = {}) {
    this.lay = lay;
    const L = lay.L, zc = (lay.zHead + lay.zEnd) / 2, top = FLOOR + TABLE_TOP;
    this.top.scale.set(TABLE_W, 0.05, L); this.top.position.set(0, top - 0.03, zc);
    this.cloth.scale.set(TABLE_W + 0.08, 0.14, L + 0.08); this.cloth.position.set(0, top - 0.07 + 0.006, zc);
    this.runner.scale.set(0.46, 0.006, L - 0.16); this.runner.position.set(0, top + 0.01, zc);
    this.shadow.scale.set(TABLE_W + 1.6, L + 1.4, 1); this.shadow.position.set(0, FLOOR + 0.006, zc);
    // legs at the ends and every couple of metres
    let n = 0;
    const legZ = [];
    for (let z = lay.zHead - 0.12; z >= lay.zEnd + 0.1; z -= 2.0) legZ.push(z);
    if (legZ.at(-1) > lay.zEnd + 0.4) legZ.push(lay.zEnd + 0.12);
    for (const z of legZ) for (const x of [-1, 1]) this.legs.set(n++, place(x * (TABLE_W / 2 - 0.09), FLOOR, z));
    this.legs.commit(n);
    // a chair and a place setting at every seat
    const seats = lay.perSide * 2;
    for (let i = 0; i < seats; i++) {
      const s = lay.seat(i);
      this.chairs.set(i, place(s.side * 0.86, FLOOR, s.z, s.yaw));
      this.settings.set(i, place(s.side * (TABLE_W / 2), top + 0.004, s.z, s.yaw));
      this.chairShadows.setMatrixAt(i, place(s.side * 0.86, FLOOR + 0.005, s.z, 0));
    }
    this.chairs.commit(seats); this.settings.commit(seats);
    // dinner on every plate (three helpings, taken in turn)
    const pc = [0, 0, 0];
    for (let i = 0; i < seats; i++) { const s = lay.seat(i), k = i % 3; this.plates[k].set(pc[k]++, place(s.side * (TABLE_W / 2), top + 0.004, s.z, s.yaw)); }
    this.plates.forEach((p, k) => p.commit(pc[k]));
    this.chairShadows.count = seats; this.chairShadows.instanceMatrix.needsUpdate = true;
    // the feast: each row has two spots by the runner; a guest's own dish takes theirs
    const counts = new Map([...this.dishes.keys(), 'candle', 'pillar_candle', ...this.decor.keys()].map((k) => [k, 0]));
    const flamePts = [];
    const put = (kind, x, z, yaw = 0, s = 1) => {
      const inst = kind === 'candle' ? this.candles : kind === 'pillar_candle' ? this.pillars : this.dishes.get(kind) || this.decor.get(kind);
      const i = counts.get(kind); if (i >= inst.max) return;
      inst.set(i, place(x, top + 0.012, z, yaw, s)); counts.set(kind, i + 1);
      if (kind === 'candle') flamePts.push(new THREE.Vector3(x, top + 0.012 + 0.335 * s, z));
      if (kind === 'pillar_candle') flamePts.push(new THREE.Vector3(x, top + 0.012 + 0.115 * s, z));
    };
    const scatter = (x, z, k) => {
      const kinds = ['mini_pumpkin', 'leaf_red', 'mini_pumpkin_white', 'leaf_orange', 'gourd', 'leaf_gold', 'acorn'];
      for (let j = 0; j < 4; j++) {
        const kind = kinds[(k + j * 3) % kinds.length], a = k * 1.7 + j * 2.4;
        put(kind, x + Math.cos(a) * 0.07, z + Math.sin(a) * 0.12, a, kind.startsWith('leaf') ? 1.1 : 0.9);
      }
    };
    this.dishSpots.clear();
    const midRow = Math.floor((lay.perSide - 1) / 2);
    const turkeyZ = lay.seat(midRow * 2).z - (lay.perSide % 2 === 0 ? 0.31 : 0);
    this.turkey.position.set(0, top + 0.012, turkeyZ); this.turkey.rotation.y = Math.PI / 2; this.turkey.scale.setScalar(1.05);
    this.turkeyZ = turkeyZ;
    let k = 0;
    for (let row = 0; row < lay.perSide; row++) {
      const z = lay.seat(row * 2).z;
      if (Math.abs(z - turkeyZ) < 0.45) continue;   // the turkey's place
      for (const side of [-1, 1]) {
        const g = guests[row * 2 + (side < 0 ? 0 : 1)];
        const x = side * 0.12, zz = z + side * 0.06;
        if (potluck && g?.dish) {
          const m = dishModel(g.dish);
          put(m, x, zz, Math.PI / 2 + side * 0.2, 0.78);
          this.dishSpots.set(g.id, new THREE.Vector3(x, top + 0.1, zz));
        } else {
          const kind = DEFAULT_ROW[(k++ + (side > 0 ? 7 : 0)) % DEFAULT_ROW.length];
          if (kind === 'decor') scatter(x, zz, k);
          else put(kind, x, zz, Math.PI / 2 + side * 0.15, kind.includes('candle') ? 1 : 0.74);
        }
      }
      // between this row and the next: the shared things (a ham on a long table), a little autumn round them
      if (row < lay.perSide - 1) {
        const zm = z - 0.31;
        if (Math.abs(zm - turkeyZ) < 0.4) continue;
        const hamRow = lay.perSide >= 6 && row === Math.floor(lay.perSide * 0.72);
        const kind = hamRow ? 'ham' : MIDDLE[row % MIDDLE.length];
        put(kind, 0, zm, Math.PI / 2 + (row % 2 ? 0.3 : -0.2), hamRow ? 0.82 : 0.74);
        for (const sx of [-1, 1]) put(['leaf_red', 'acorn', 'leaf_gold', 'mini_pumpkin'][(row + (sx > 0 ? 2 : 0)) % 4], sx * 0.19, zm + sx * 0.05, row + sx, 0.9);
      }
    }
    // the horn of plenty at the far end, spilling toward the table
    this.horn.root.position.set(0, top + 0.012, lay.zEnd + 0.46);
    this.horn.root.rotation.set(0, -Math.PI / 2, 0);
    this.horn.root.scale.setScalar(0.52);
    if (!this.horn.baked) this.horn.bake();
    for (const [kind, c] of counts) {
      const inst = kind === 'candle' ? this.candles : kind === 'pillar_candle' ? this.pillars : this.dishes.get(kind) || this.decor.get(kind);
      inst.commit(c);
    }
    if (this.flames) this.scene.remove(this.flames.mesh);
    this.flames = flamePts.length ? new Flames(this.scene, flamePts, flamePts.map(() => 1.3)) : null;
    this.glow.geometry.dispose();
    this.glow.geometry = new THREE.BufferGeometry().setFromPoints(flamePts.map((p) => p.clone().add(new THREE.Vector3(0, 0.02, 0))));
    this._cards(lay, guests);
  }

  /** Little tent cards with everyone's name, behind their plate (one texture, one draw). */
  _cards(lay, guests) {
    if (this.cards) { this.scene.remove(this.cards); this.cards.geometry.dispose(); this.cards.material.map?.dispose(); }
    const [c, x] = canvas(1024, 1024);
    const cols = 4, rows = 16, cw = 256, ch = 64;
    x.fillStyle = '#FBF5E9'; x.fillRect(0, 0, 1024, 1024);
    const pos = [], uv = [], idx = [];
    const top = FLOOR + TABLE_TOP + 0.012;
    guests.forEach((g, i) => {
      if (!g || i >= cols * rows) return;
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      x.fillStyle = '#FBF5E9'; x.fillRect(cx + 2, cy + 2, cw - 4, ch - 4);
      x.strokeStyle = '#CC5500'; x.lineWidth = 3; x.strokeRect(cx + 8, cy + 7, cw - 16, ch - 14);
      x.fillStyle = '#6E473B'; x.textAlign = 'center'; x.textBaseline = 'middle';
      fitFont(x, g.name, '700', 34, FONTS.hand, cw - 40);
      x.fillText(g.name, cx + cw / 2, cy + ch / 2 + 2);
      const s = lay.seat(i), px = s.side * 0.3, z = s.z, w = 0.075, h = 0.04, lean = 0.014;
      const u0 = cx / 1024, u1 = (cx + cw) / 1024, v0 = 1 - (cy + ch) / 1024, v1 = 1 - cy / 1024;
      // a tent: one face toward each side of the table, each reading the right way round from its side
      for (const f of [1, -1]) {
        const xb = px + f * lean, base = pos.length / 3;
        // seen from +X the left edge is at +Z; seen from -X the left edge is at -Z
        const zl = z + f * w, zr = z - f * w;
        pos.push(xb, top, zl, xb, top, zr, px, top + h, zr, px, top + h, zl);
        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const t = tex(c); t.anisotropy = 8;
    this.cards = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, color: new THREE.Color(0.95, 0.9, 0.85) }));
    this.cards.frustumCulled = false;
    this.scene.add(this.cards);
  }

  /** Ink outlines only near the camera (far chairs, settings and dishes are too small to need them). */
  outlineNear(eye) {
    for (const inst of [this.chairs, this.settings, this.legs, ...this.dishes.values()]) inst.outlineNear(eye, 7.5);
  }

  update(t, camera) {
    if (camera && (this._oT = (this._oT || 0) - 1) <= 0) { this._oT = 15; this.outlineNear(camera.position); }
    this.flames?.update(t); this.glow.material.opacity = 0.62 + 0.08 * Math.sin(t * 5.1) * Math.sin(t * 3.3); }
}

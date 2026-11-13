import * as THREE from 'three';
import { toonMaterial, addOutline } from '../style/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { piece, Instancer, place, propMaterial } from './props.js';
import { planks, plaster, wainscot, plaid, duskView, rug, glowTexture, lawn, skyTexture, canvas, tex, FONTS } from './textures.js';
import { FLOOR, HALF_W, ROOM_H, WALL_Z, SPOTS } from './layout.js';
import { Hearth } from '../fx/hearth.js';
import { snapshot } from '../objects/gallery.js';

// The farmhouse: a porch at dusk outside (where the evening starts, under the first stars), and inside one
// long great room — plank floor, cream plaster over warm wainscot, beams, windows full of autumn sunset,
// string lights over a table that grows with the guest list, the things of a lived-in home (a bench and
// coats by the door, a china hutch, pies on the sideboard, paintings, plants), and a living room at the far
// end with the fireplace, the sofa, an armchair, the bookshelf and the TV.

const FRAME_GOLD = toonMaterial({ color: new THREE.Color('#C9A24C') }, { rimScale: 1.6 });
/** A painting in a gilt frame (a little scene, see gallery.js), facing +z. */
function painting(kind, w = 0.9, h = 0.66) {
  const g = new THREE.Group();
  // (the four sides of the frame in one mesh: one draw, one outline)
  const sides = [[w + 0.12, 0.06, 0, h / 2 + 0.03], [w + 0.12, 0.06, 0, -h / 2 - 0.03], [0.06, h, -w / 2 - 0.03, 0], [0.06, h, w / 2 + 0.03, 0]].map(([bw, bh, bx, by]) => new THREE.BoxGeometry(bw, bh, 0.04).translate(bx, by, 0.02));
  const b = new THREE.Mesh(mergeGeometries(sides), FRAME_GOLD); addOutline(b, 0.0012); g.add(b);
  const t = new THREE.CanvasTexture(snapshot(kind)); t.colorSpace = THREE.SRGBColorSpace;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.9, 0.86, 0.8) }));
  pic.position.z = 0.012; g.add(pic);
  return g;
}

/** Soft storybook clouds for the dusk sky (a canvas): lit warm from below, lilac on top. */
function cloudTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const puffs = [];
  for (let i = 0; i < 9; i++) puffs.push([90 + rnd() * 330, 130 + rnd() * 40 - Math.sin((i / 8) * Math.PI) * 50, 40 + rnd() * 45]);
  const g = x.createLinearGradient(0, 40, 0, 210);
  g.addColorStop(0, 'rgba(176,150,196,0.95)'); g.addColorStop(0.55, 'rgba(232,160,150,0.95)'); g.addColorStop(1, 'rgba(255,190,120,0.9)');
  x.fillStyle = g;
  for (const [px, py, r] of puffs) { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); }
  x.fillRect(110, 150, 300, 45);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _m = new THREE.Matrix4();

export class House {
  constructor(scene) {
    this.scene = scene;
    this.o = {};
    this._outside();
    this._room();
    this._entrance();
    this._living();
    this._lights();
  }

  // ── outside: sky, lawn, the porch and house front, autumn trees ──
  _outside() {
    const s = this.scene;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    s.add(sky);
    // the first stars, twinkling high up where the sky has gone purple
    const n = 420, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = THREE.MathUtils.degToRad(14 + Math.pow(Math.random(), 0.7) * 72);
      pos.set([Math.cos(a) * Math.cos(e) * 120, Math.sin(e) * 120, Math.sin(a) * Math.cos(e) * 120], i * 3); seed[i] = Math.random();
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.starU = { uTime: { value: 0 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starU, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute float aSeed; uniform float uTime; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float h = normalize(position).y; vA = smoothstep(0.22, 0.6, h) * (0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 2.5) + aSeed * 40.0)); gl_PointSize = 1.4 + aSeed * 2.2; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * a, a); }',
    }));
    this.stars.renderOrder = -9; this.stars.frustumCulled = false;
    s.add(this.stars);
    // a few clouds low round the horizon, lit by the sunset
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, e = THREE.MathUtils.degToRad(5 + (i % 3) * 5), r = 100;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(i + 1), transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
      sp.position.set(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r + 2, Math.sin(a) * Math.cos(e) * r);
      const w = 26 + (i % 4) * 7; sp.scale.set(w, w * 0.5, 1); sp.renderOrder = -8;
      s.add(sp); this.clouds.push({ sp, a, e, r });
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), toonMaterial({ map: lawn(), color: new THREE.Color('#d8c49a') }, { rimScale: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.005, 0);
    s.add(ground);
    const porch = piece('porch', { outline: 0.0022 });
    s.add(porch);
    this.o.porch = porch;
    this.o.door = porch.getObjectByName('front_door');
    // the rest of the house behind its front (only ever seen from the yard): siding walls and the roof
    const siding = toonMaterial({ color: new THREE.Color('#EADFC8') });
    const roofM = toonMaterial({ color: new THREE.Color('#5A3B32') });
    for (const sx of [-1, 1]) {
      // (its inner face kept clear of the room's own walls — the two at the same spot flickered)
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.45, 9), siding);
      w.position.set(sx * (HALF_W + 0.14), FLOOR + 1.72, -4.5); s.add(w);
      const r = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.1, 9.4), roofM);
      r.position.set(sx * 1.75, FLOOR + ROOM_H + 0.82, -4.4); r.rotation.z = -sx * 0.47; s.add(r); addOutline(r, 0.002);
    }
    // autumn trees round the yard (one draw for trunks, one for the leafy crowns)
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 3.2, 7), toonMaterial({ color: new THREE.Color('#4A3226') }), 14);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 1), toonMaterial({ color: new THREE.Color('#ffffff') }), 14 * 3);
    const cols = ['#C2361F', '#D96A1E', '#E0A830', '#B5523A', '#E07A1F'];
    const spots = [[-7, 2], [-9.5, -2], [-12, 5], [-6.5, -6], [7.2, 1.5], [9.8, -3], [12.5, 4], [6.8, -7], [-15, -1], [15, -1], [-4.8, 9.5], [5, 10.5], [-10, 11], [10, 12]];
    spots.forEach(([x, z], i) => {
      const h = 2.6 + (i % 3) * 0.5;
      trunks.setMatrixAt(i, place(x, h / 2 - 0.2, z, i, 1).multiply(_m.makeScale(1, h / 3.2, 1)));
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k, a = i * 2.1 + k * 2.2;
        crowns.setMatrixAt(j, place(x + Math.cos(a) * 0.7, h + 0.6 + (k === 2 ? 0.8 : 0), z + Math.sin(a) * 0.7, a, 0.85 + ((i + k) % 3) * 0.15));
        crowns.setColorAt(j, new THREE.Color(cols[(i + k) % cols.length]));
      }
    });
    s.add(trunks, crowns);
    // a stepping-stone path up to the porch, and pumpkins on the lawn
    const stone = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.36, 0.06, 10), toonMaterial({ color: new THREE.Color('#A89C8C') }), 8);
    for (let i = 0; i < 8; i++) stone.setMatrixAt(i, place(Math.sin(i * 0.9) * 0.25, 0.02, 4.0 + i * 0.75, i, 1 - i * 0.03));
    s.add(stone);
    this.o.lawnDecor = [];
    for (const [x, z, n, sc] of [[-2.2, 4.2, 'pumpkin', 1.2], [-2.7, 4.6, 'pumpkin_white', 1], [2.4, 4.4, 'pumpkin', 1.4], [2.0, 4.9, 'mums', 1], [-1.8, 5.0, 'mums', 1]]) {
      const p = piece(n); p.position.set(x, 0, z); p.scale.setScalar(sc); p.rotation.y = x; s.add(p);
      this.o.lawnDecor.push(p);
    }
    // porch lanterns and the windows glow
    const glow = glowTexture(128);
    this.glows = [];
    for (const n of ['lantern_l', 'lantern_r']) {
      const a = porch.getObjectByName(n); if (!a) continue;
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb35a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.scale.setScalar(0.9); a.getWorldPosition(g.position); s.add(g); this.glows.push(g);
    }
  }

  // ── the great room (resized to the table by layout()) ──
  _room() {
    const s = this.scene;
    this.mat = {
      floor: toonMaterial({ map: planks() }, { rimScale: 0 }),
      plaster: toonMaterial({ map: plaster(), color: new THREE.Color('#ffffff') }, { rimScale: 0 }),
      wainscot: toonMaterial({ map: wainscot() }, { rimScale: 0 }),
      beam: toonMaterial({ color: new THREE.Color('#5E3D2E') }),
      ceiling: toonMaterial({ map: plaster(), color: new THREE.Color('#efe2cc') }, { rimScale: 0 }),
    };
    const plane = (m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); s.add(p); return p; };
    this.floor = plane(this.mat.floor); this.floor.rotation.x = -Math.PI / 2;
    this.ceiling = plane(this.mat.ceiling); this.ceiling.rotation.x = Math.PI / 2;
    this.walls = [];
    for (const side of [-1, 1]) {
      const up = plane(this.mat.plaster), low = plane(this.mat.wainscot);
      up.rotation.y = low.rotation.y = -side * Math.PI / 2;
      this.walls.push({ side, up, low });
    }
    this.back = { up: plane(this.mat.plaster), low: plane(this.mat.wainscot) };
    // the inside of the front wall, with the door and its two windows cut out
    const shape = new THREE.Shape();
    shape.moveTo(-HALF_W, 0); shape.lineTo(HALF_W, 0); shape.lineTo(HALF_W, ROOM_H); shape.lineTo(-HALF_W, ROOM_H); shape.lineTo(-HALF_W, 0);
    const hole = (x0, x1, y0, y1) => { const h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.lineTo(x0, y0); shape.holes.push(h); };
    hole(-0.52, 0.52, 0, 2.14); hole(-2.35, -1.15, 0.8, 2.4); hole(1.15, 2.35, 0.8, 2.4);
    const front = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.mat.plaster);
    front.rotation.y = Math.PI; front.position.set(0, FLOOR, WALL_Z - 0.01);
    const uv = front.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
    s.add(front);
    // beams across the ceiling, the windows down both walls (each with the sunset behind it)
    this.beams = new THREE.InstancedMesh(new THREE.BoxGeometry(HALF_W * 2, 0.22, 0.2), this.mat.beam, 20);
    this.beams.frustumCulled = false; s.add(this.beams);
    this.windows = new Instancer(s, 'window', 24);
    const views = [duskView(0), duskView(1)];
    this.panes = views.map((v) => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.55), new THREE.MeshBasicMaterial({ map: v, toneMapped: false, color: new THREE.Color(0.92, 0.88, 0.85) }), 12); m.frustumCulled = false; s.add(m); return m; });
    // string lights over the table
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.6), toneMapped: false }), 240);
    this.bulbs.frustumCulled = false; s.add(this.bulbs);
    this.bulbGlow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTexture(64), size: 0.42, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc27a, opacity: 0.55 }));
    this.bulbGlow.frustumCulled = false; s.add(this.bulbGlow);
    this.wire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2a1c14 }));
    this.wire.frustumCulled = false; s.add(this.wire);
  }

  // ── by the door: the welcome easel, the sideboard (with the horn of plenty), a dressing corner ──
  _entrance() {
    const s = this.scene;
    const sign = piece('easel_sign');
    sign.position.set(SPOTS.sign.x, FLOOR, SPOTS.sign.z); sign.rotation.y = SPOTS.sign.yaw;
    s.add(sign); this.o.sign = sign;
    const sb = piece('sideboard');
    sb.position.set(SPOTS.sideboard.x, FLOOR, SPOTS.sideboard.z); sb.rotation.y = SPOTS.sideboard.yaw;
    s.add(sb); this.o.sideboard = sb;
    // the dressing corner: a round rag rug; a hay bale with pumpkins by the door
    const rg = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), toonMaterial({ map: rug() }, { rimScale: 0 }));
    rg.rotation.x = -Math.PI / 2; rg.position.set(SPOTS.dress.x, FLOOR + 0.004, SPOTS.dress.z); s.add(rg);
    // pies and candles on the sideboard (under the family's photos)
    for (const [n, dz, sc] of [['apple_pie', 0.45, 0.9], ['pumpkin', -0.55, 0.7], ['pillar_candle', 0.05, 1.1], ['pecan_pie', -0.12, 0.85]]) {
      const p = piece(n, { outline: 0 }); p.position.set(SPOTS.sideboard.x + 0.02, FLOOR + 0.88, SPOTS.sideboard.z + dz); p.scale.setScalar(sc); s.add(p);
    }
    // by the door: a bench with boots under the coat hooks
    const bench = piece('bench', { skip: /bench_things/ }); bench.position.set(HALF_W - 0.2, FLOOR, -2.05); bench.rotation.y = -Math.PI / 2; s.add(bench);
    const hooks = piece('coat_hooks', { outline: 0 }); hooks.position.set(HALF_W - 0.03, FLOOR, -2.05); hooks.rotation.y = -Math.PI / 2; s.add(hooks);
    // down the dining room: the china hutch, and a second sideboard with the pies waiting for dessert
    const hutch = piece('hutch', { skip: /hutch_china/ }); hutch.position.set(HALF_W - 0.27, FLOOR, -4.3); hutch.rotation.y = -Math.PI / 2; s.add(hutch);
    const sb2 = piece('sideboard'); sb2.position.set(-HALF_W + 0.25, FLOOR, -4.3); sb2.rotation.y = Math.PI / 2; s.add(sb2);
    for (const [n, dz, sc] of [['pumpkin_pie', 0.5, 0.95], ['pecan_pie', 0.0, 0.95], ['apple_pie', -0.5, 0.95], ['mini_pumpkin', 0.27, 1.4], ['gourd', -0.27, 1.3]]) {
      const p = piece(n, { outline: 0 }); p.position.set(-HALF_W + 0.27, FLOOR + 0.88, -4.3 + dz); p.scale.setScalar(sc); s.add(p);
    }
    const fern = piece('plant_fern', { outline: 0 }); fern.position.set(HALF_W - 0.35, FLOOR, -5.2); s.add(fern);
    const hay = piece('hay_bale'); hay.position.set(-HALF_W + 0.55, FLOOR, -0.75); hay.rotation.y = Math.PI / 2; s.add(hay);
    for (const [n, x, y, z] of [['pumpkin', -HALF_W + 0.5, FLOOR + 0.42, -0.95], ['pumpkin_white', -HALF_W + 0.55, FLOOR + 0.42, -0.5], ['mums', HALF_W - 0.4, FLOOR, -0.45], ['apple_crate', HALF_W - 0.45, FLOOR, -1.0]]) {
      const p = piece(n); p.position.set(x, y, z); p.rotation.y = x > 0 ? -Math.PI / 2 : 0.4; s.add(p);
    }
  }

  // ── the living room at the far end ──
  _living() {
    const s = this.scene;
    const sofa = piece('sofa');
    const fab = propMaterial('M_plaid'); if (fab) { fab.map = plaid(); fab.color.set('#ffffff'); fab.needsUpdate = true; }
    const tv = piece('tv'), coffee = piece('coffee_table'), fire = piece('fireplace');
    const rg = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), toonMaterial({ map: rug() }, { rimScale: 0 }));
    rg.rotation.x = -Math.PI / 2; rg.scale.set(1.25, 1, 1);
    const lamp = new THREE.Group();
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.95, 0.65), side: THREE.DoubleSide, toneMapped: false }));
    shade.position.y = 1.42;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 8), toonMaterial({ color: new THREE.Color('#2B2B2E') }));
    pole.position.y = 0.65;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), toonMaterial({ color: new THREE.Color('#2B2B2E') }));
    lamp.add(shade, pole, base);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xffb35a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    lampGlow.scale.setScalar(1.6); lampGlow.position.y = 1.42; lamp.add(lampGlow);
    tv.scale.setScalar(1.3);   // a big old console set, easy to see from the sofa
    // a "Give Thanks" pennant banner swagged over the TV
    const [bc, bx] = canvas(1024, 256);
    const cols = ['#CC5500', '#E3A857', '#990000', '#6E473B', '#F2E6D0'], word = 'GIVE THANKS';
    bx.strokeStyle = '#4A3226'; bx.lineWidth = 6; bx.beginPath(); bx.moveTo(10, 30); bx.quadraticCurveTo(512, 110, 1014, 30); bx.stroke();
    [...word].forEach((ch, i) => {
      const t = (i + 0.5) / word.length, x = 10 + t * 1004, y = 30 + 80 * 4 * t * (1 - t) * 0.5;
      if (ch === ' ') return;
      bx.fillStyle = cols[i % cols.length]; bx.beginPath(); bx.moveTo(x - 40, y); bx.lineTo(x + 40, y); bx.lineTo(x, y + 120); bx.closePath(); bx.fill();
      bx.fillStyle = i % cols.length === 4 ? '#6E473B' : '#FDFBF7'; bx.font = `800 54px ${FONTS.ui}`; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText(ch, x, y + 42);
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: tex(bc), transparent: true, color: new THREE.Color(0.95, 0.9, 0.85) }));
    this.o.banner = banner;
    s.add(sofa, tv, coffee, fire, rg, lamp, banner);
    this.o.sofa = sofa; this.o.tv = tv; this.o.coffee = coffee; this.o.fireplace = fire; this.o.livingRug = rg; this.o.lamp = lamp;
    // the fire
    this.fire = null;
    // the rest of the living room (placed by layout(), which knows where the room ends)
    this.liv = {};
    const small = new Set(['side_table', 'plant_fig', 'blanket_basket', 'wall_clock', 'pumpkin', 'mums']);
    for (const n of ['bookshelf', 'armchair', 'side_table', 'plant_fig', 'blanket_basket', 'wall_clock', 'pumpkin', 'mums']) { this.liv[n] = piece(n, small.has(n) ? { outline: 0 } : { skip: /bookshelf_books|armchair_soft/ }); s.add(this.liv[n]); }
    this.liv.overMantel = painting(0, 0.95, 0.66); s.add(this.liv.overMantel);
    // paintings between the windows down the dining room
    this.paintings = [1, 4, 2, 5, 0, 3, 1, 4].map((k) => { const g = painting(k, 0.78, 0.58); g.visible = false; s.add(g); return g; });
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffe2b8, 0x7a5236, 1.25);
    this.sun = new THREE.DirectionalLight(0xffd6a0, 1.1);
    this.sun.position.set(4, 9, 6);
    this.sun.target.position.set(0, 0, -6);
    s.add(this.hemi, this.sun, this.sun.target);
    this.tableLights = [0, 1].map(() => { const l = new THREE.PointLight(0xffb066, 3.2, 7.5, 1.6); s.add(l); return l; });
    this.fireLight = new THREE.PointLight(0xff8a3a, 2.4, 5.5, 1.8);
    s.add(this.fireLight);
  }

  /** Fit the room to the table: walls, floor, beams, windows, string lights, the living room's things. */
  layout(lay) {
    const zFront = WALL_Z - 0.01, zBack = lay.zBack, len = zFront - zBack, zc = (zFront + zBack) / 2;
    const W = HALF_W * 2;
    this.floor.scale.set(W, len, 1); this.floor.position.set(0, FLOOR, zc);
    this.mat.floor.map.repeat.set(W / 2, len / 2);
    this.ceiling.scale.set(W, len, 1); this.ceiling.position.set(0, FLOOR + ROOM_H, zc);
    this.mat.ceiling.map.repeat.set(W / 3, len / 3); this.mat.ceiling.map.wrapS = this.mat.ceiling.map.wrapT = THREE.RepeatWrapping;
    const lowH = 1.0, upH = ROOM_H - lowH;
    for (const w of this.walls) {
      w.up.scale.set(len, upH, 1); w.up.position.set(w.side * HALF_W, FLOOR + lowH + upH / 2, zc);
      w.low.scale.set(len, lowH, 1); w.low.position.set(w.side * HALF_W, FLOOR + lowH / 2, zc);
    }
    this.mat.plaster.map.repeat.set(len / 4, upH / 4); this.mat.plaster.map.wrapS = this.mat.plaster.map.wrapT = THREE.RepeatWrapping;
    this.mat.wainscot.map.repeat.set(len / 2, 1); this.mat.wainscot.map.wrapS = THREE.RepeatWrapping;
    this.back.up.scale.set(W, upH, 1); this.back.up.position.set(0, FLOOR + lowH + upH / 2, zBack);
    this.back.low.scale.set(W, lowH, 1); this.back.low.position.set(0, FLOOR + lowH / 2, zBack);
    // beams every 2.4 m
    let n = 0;
    for (let z = -1.3; z > zBack + 0.3 && n < 20; z -= 2.4) this.beams.setMatrixAt(n++, _m.makeTranslation(0, FLOOR + ROOM_H - 0.11, z));
    this.beams.count = n; this.beams.instanceMatrix.needsUpdate = true;
    // windows: down both walls, not behind the sideboard or the fireplace
    const fireZ = lay.living.coffee;
    let k = 0; const pk = [0, 0];
    for (let z = -3.1; z > zBack + 1.2; z -= 2.4) {
      for (const side of [-1, 1]) {
        if (side < 0 && Math.abs(z - SPOTS.sideboard.z) < 1.2) continue;
        if (side > 0 && Math.abs(z - fireZ) < 1.6) continue;
        if (k >= 24) break;
        const x = side * (HALF_W - 0.06), yaw = -side * Math.PI / 2;
        this.windows.set(k++, place(x, FLOOR + 1.0, z, yaw));
        const pane = this.panes[(k + (side > 0 ? 1 : 0)) % 2], i = pk[this.panes.indexOf(pane)]++;
        if (i < 12) pane.setMatrixAt(i, place(side * (HALF_W - 0.015), FLOOR + 1.0 + 0.775, z, yaw));
      }
    }
    this.windows.commit(k);
    this.panes.forEach((p, i) => { p.count = Math.min(12, pk[i]); p.instanceMatrix.needsUpdate = true; });
    // string lights: two swagged strands down the table
    this._stringLights(lay);
    // the living room
    const L = lay.living;
    this.o.tv.position.set(0, FLOOR, L.tv);
    this.o.banner.position.set(0, FLOOR + 2.15, zBack + 0.03);
    this.o.coffee.position.set(0, FLOOR, L.coffee);
    this.o.sofa.position.set(0, FLOOR, L.sofa); this.o.sofa.rotation.y = Math.PI;
    this.o.livingRug.position.set(0, FLOOR + 0.005, (L.coffee + L.sofa) / 2 - 0.2);
    this.o.fireplace.position.set(HALF_W - 0.26, FLOOR, fireZ); this.o.fireplace.rotation.y = -Math.PI / 2;
    this.o.lamp.position.set(-1.45, FLOOR, L.sofa + 0.1);
    const lv = this.liv, at = (o, x, z, yaw = 0, y = FLOOR) => { o.position.set(x, y, z); o.rotation.y = yaw; };
    at(lv.bookshelf, -HALF_W + 0.17, L.coffee - 0.25, Math.PI / 2);
    at(lv.armchair, -2.15, L.tv + 1.0, Math.atan2(0.3 + 2.15, L.tv + 0.2 - (L.tv + 1.0)));
    at(lv.side_table, -2.8, L.tv + 0.25);
    at(lv.plant_fig, HALF_W - 0.45, zBack + 0.42);
    at(lv.blanket_basket, -1.25, L.sofa - 0.42, 0.4);
    at(lv.wall_clock, 0, zBack + 0.04, 0, FLOOR + 2.95);
    at(lv.pumpkin, -1.0, L.tv + 0.05); at(lv.mums, 1.05, L.tv + 0.1);
    at(lv.overMantel, HALF_W - 0.02, fireZ, -Math.PI / 2, FLOOR + 2.15);
    // a painting between each pair of windows (clear of the hutch, the fireplace and the bookshelf)
    let pn = 0;
    for (let z = -6.7; z > zBack + 1.2 && pn < this.paintings.length; z -= 2.4) {
      for (const side of [-1, 1]) {
        if (pn >= this.paintings.length) break;
        if (side > 0 && Math.abs(z - fireZ) < 1.8) continue;
        if (side < 0 && Math.abs(z - (L.coffee - 0.25)) < 1.3) continue;
        const g = this.paintings[pn++]; g.visible = true;
        at(g, side * (HALF_W - 0.02), z, -side * Math.PI / 2, FLOOR + 1.85);
      }
    }
    for (let i = pn; i < this.paintings.length; i++) this.paintings[i].visible = false;
    this.o.fireplace.updateMatrixWorld(true);
    const spot = this.o.fireplace.getObjectByName('fire_spot').getWorldPosition(new THREE.Vector3());
    this.fire?.dispose(this.scene);
    this.fire = new Hearth(this.scene, spot.clone().add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(-1, 0, 0));
    this.fireLight.position.copy(spot).add(new THREE.Vector3(-0.6, 0.4, 0));
    if (!this.fireGlow) { this.fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xff7a2a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); this.fireGlow.scale.set(1.1, 0.8, 1); this.scene.add(this.fireGlow); }
    this.fireGlow.position.copy(spot).add(new THREE.Vector3(-0.05, 0.12, 0));
    // light over the table
    this.tableLights[0].position.set(0, FLOOR + 2.6, lay.zHead - lay.L * 0.25);
    this.tableLights[1].position.set(0, FLOOR + 2.6, lay.zHead - lay.L * 0.75);
    const reach = Math.max(7.5, lay.L * 0.45);
    for (const l of this.tableLights) l.distance = reach;
  }

  _stringLights(lay) {
    const pos = [], wire = [];
    const z0 = lay.zHead + 0.4, z1 = lay.zEnd - 0.4, y0 = FLOOR + 3.15, sag = 0.32;
    for (const x of [-0.75, 0.75]) {
      const spans = Math.max(1, Math.round((z0 - z1) / 2.2));
      let prev = null;
      for (let sp = 0; sp < spans; sp++) {
        const za = z0 - (z0 - z1) * sp / spans, zb = z0 - (z0 - z1) * (sp + 1) / spans;
        const steps = Math.max(4, Math.round((za - zb) / 0.28));
        for (let i = 0; i <= steps; i++) {
          if (sp > 0 && i === 0) continue;
          const t = i / steps, z = za + (zb - za) * t, y = y0 - sag * 4 * t * (1 - t) - Math.abs(x) * 0.0;
          const p = new THREE.Vector3(x + Math.sin(z * 3) * 0.02, y, z);
          if (prev) wire.push(prev.x, prev.y + 0.02, prev.z, p.x, p.y + 0.02, p.z);
          prev = p;
          if (i % 1 === 0) pos.push(p);
        }
      }
    }
    const n = Math.min(240, pos.length);
    for (let i = 0; i < n; i++) this.bulbs.setMatrixAt(i, _m.makeTranslation(pos[i].x, pos[i].y, pos[i].z));
    this.bulbs.count = n; this.bulbs.instanceMatrix.needsUpdate = true;
    this.bulbGlow.geometry.dispose();
    this.bulbGlow.geometry = new THREE.BufferGeometry().setFromPoints(pos.slice(0, n));
    this.wire.geometry.dispose();
    this.wire.geometry = new THREE.BufferGeometry(); this.wire.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  }

  update(t) {
    this.fire?.update(t);
    this.starU.uTime.value = t;
    const f = 0.8 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1);
    this.fireLight.intensity = 2.4 * f;
    if (this.fireGlow) this.fireGlow.material.opacity = 0.55 + 0.25 * f;
    for (const g of this.glows) g.material.opacity = 0.75 + 0.1 * Math.sin(t * 3 + g.position.x);
    this.bulbGlow.material.opacity = 0.5 + 0.05 * Math.sin(t * 1.3);
  }
}

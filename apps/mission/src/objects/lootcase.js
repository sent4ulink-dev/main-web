import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/courtyard.js';
import { canvas, toTexture, HUD, BODY, STENCIL, fit, roundRect, star } from '../world/courtyardTextures.js';

// The wish, as a case opening: the black carry case on the crate unlatches, light spills out, a strip of item
// cards rises from it and spins past a gold marker — slowing, tick… tick… tick — until it lands on the one
// golden card: ★ WISH. The other cards fade, the gold card grows, flips, and the wish is written on its back.

const CW = 0.2, CH = 0.155, GAP = 0.018, PITCH = CW + GAP;
const VIEW = 1.05;            // visible width of the strip window (m)
const N = 44, WIN = 37;       // cards on the strip; the winner's index
const TIERS = [
  { name: 'Common', color: '#5b8cff' }, { name: 'Rare', color: '#9a5bff' }, { name: 'Epic', color: '#e04fe6' },
  { name: 'Legendary', color: '#ff5b4f' },
];
const ITEMS = [['🎂', 'Cake'], ['🎁', 'Gift'], ['😂', 'Laughs'], ['✈️', 'Trips'], ['🎈', 'Balloons'], ['🎵', 'Music'], ['🎮', 'Games'], ['📸', 'Memories'], ['🍕', 'Pizza'], ['🏆', 'Wins'], ['🌙', 'Late chats'], ['☕', 'Coffee']];

function cardTexture(icon, label, color, gold = false) {
  const W = 320, H = 248, [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, gold ? '#5a4310' : '#2a2f36'); g.addColorStop(1, gold ? '#2b1f06' : '#16191d');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 18); ctx.fill();
  // the rarity glow behind the item and the coloured bar at the bottom
  const rg = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, W * 0.5);
  rg.addColorStop(0, color + 'aa'); rg.addColorStop(1, color + '00');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color; ctx.fillRect(0, H - 22, W, 22);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `110px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
  ctx.fillText(icon, W / 2, H * 0.42);
  ctx.fillStyle = '#f4f1ea';
  fit(ctx, label, 600, 34, HUD, W - 30);
  ctx.fillText(label, W / 2, H - 50);
  if (gold) { ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 8; roundRect(ctx, 4, 4, W - 8, H - 8, 16); ctx.stroke(); }
  return toTexture(c);
}

/** The back of the gold card: the wish itself. */
function wishTexture(wish) {
  const W = 640, H = 496, [c, ctx] = canvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#f2b93b'); g.addColorStop(1, '#c8861f');
  ctx.fillStyle = g; roundRect(ctx, 0, 0, W, H, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,0,0.55)'; ctx.lineWidth = 6; roundRect(ctx, 16, 16, W - 32, H - 32, 22); ctx.stroke();
  ctx.fillStyle = '#5a3500'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  star(ctx, 70, 66, 26, 11); star(ctx, W - 70, 66, 26, 11);
  ctx.font = `700 50px ${HUD}`; ctx.fillText('WISH', W / 2, 70);
  ctx.fillStyle = '#3a2200';
  // wrap the wish
  const words = (wish || '').split(/\s+/);
  let size = 46, lines;
  const wrap = () => {
    ctx.font = `500 ${size}px ${BODY}`;
    lines = []; let line = '';
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > W - 100 && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
  };
  wrap();
  while (lines.length * size * 1.25 > H - 190 && size > 22) { size -= 2; wrap(); }
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 40 + (i - (lines.length - 1) / 2) * size * 1.25));
  ctx.font = `400 22px ${STENCIL}`; ctx.fillStyle = 'rgba(70,40,0,0.7)';
  ctx.fillText('LEGENDARY  DROP', W / 2, H - 42);
  return toTexture(c);
}

export class LootCase {
  constructor(scene, position, yaw, wish = '', { scale = 1.15 } = {}) {
    this.group = new THREE.Group(); this.group.name = 'loot';
    this.group.position.copy(position); this.group.rotation.y = yaw;
    this.group.scale.setScalar(scale);
    scene.add(this.group);
    this.case = piece('tactical', 'loot_case');
    this.group.add(this.case);
    this.case.updateMatrixWorld(true);
    this.lid = this.case.getObjectByName('loot_case_lid');
    this.itemsAnchor = this.case.getObjectByName('items').position.clone();
    this.hitTargets = [];
    this.case.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });

    // stencilled markings on the shell and the lid (no glow, no shine: just the case)
    const decal = (text, sub, w, h) => {
      const [c, ctx] = canvas(1024, Math.round(1024 * h / w));
      ctx.fillStyle = 'rgba(230,226,214,0.88)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fit(ctx, text, 400, c.height * 0.5, STENCIL, c.width - 60); ctx.fillText(text, c.width / 2, c.height * (sub ? 0.38 : 0.5));
      if (sub) { ctx.font = `600 ${c.height * 0.2}px ${HUD}`; ctx.fillText(sub, c.width / 2, c.height * 0.8); }
      const t = toTexture(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      return m;
    };
    const front = decal('★ B-DAY SUPPLY ★', 'CASE No 056 · HANDLE WITH CARE', 0.44, 0.09);
    front.position.set(-0.1, 0.12, 0.2405);
    this.case.add(front);
    const top = decal('▲ THIS SIDE UP ▲', null, 0.3, 0.05);
    top.rotation.x = -Math.PI / 2; top.position.set(0.18, 0.4535, 0.13);
    this.lid.add(top);
    top.position.sub(this.lid.position);
    this.light = { intensity: 0 };

    // the strip: a dark window, the gold marker, and the cards (each with its own opacity for the fade)
    this.strip = new THREE.Group();
    this.strip.position.copy(this.itemsAnchor).add(new THREE.Vector3(0, 0.16, 0.02));
    this.strip.visible = false;
    this.group.add(this.strip);
    // while the reel spins, everything around it is dimmed (a big dark veil just behind the reel, drawn over the scene)
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x07060a, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
    this.dim.position.z = -0.03;
    this.dim.renderOrder = 8;
    this.dim.frustumCulled = false;
    this.strip.add(this.dim);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(VIEW + 0.1, CH + 0.07), new THREE.MeshBasicMaterial({ color: 0x0d1013, transparent: true, opacity: 0.72, depthWrite: false }));
    panel.position.z = -0.004;
    this.strip.add(panel);
    this.panel = panel;
    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3).multiplyScalar(2.2) });
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.006, CH + 0.06), gold); marker.position.z = 0.006;
    const triGeo = new THREE.ConeGeometry(0.014, 0.02, 3);
    const t1 = new THREE.Mesh(triGeo, gold); t1.position.set(0, CH / 2 + 0.04, 0.006); t1.rotation.z = Math.PI;
    const t2 = new THREE.Mesh(triGeo, gold); t2.position.set(0, -CH / 2 - 0.04, 0.006);
    this.strip.add(marker, t1, t2);
    this.reel = new THREE.Group();
    this.strip.add(this.reel);
    this.cards = [];
    const geo = new THREE.PlaneGeometry(CW, CH);
    const tierFor = (i) => (i % 9 === 4 ? 3 : i % 5 === 2 ? 2 : i % 3 === 1 ? 1 : 0);
    for (let i = 0; i < N; i++) {
      const winner = i === WIN;
      const [icon, label] = winner ? ['⭐', 'WISH'] : ITEMS[(i * 7 + 3) % ITEMS.length];
      const color = winner ? '#ffd24a' : TIERS[tierFor(i)].color;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: cardTexture(icon, label, color, winner), transparent: true, depthWrite: false }));
      m.position.x = i * PITCH;
      this.reel.add(m);
      this.cards.push(m);
    }
    this.strip.traverse((m) => { if (m.isMesh && m !== this.dim) m.renderOrder = 9; });
    this.winner = this.cards[WIN];
    this.back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: wishTexture(wish), transparent: true, depthWrite: false }));
    this.back.rotation.y = Math.PI;
    this.back.position.z = -0.001;
    this.winner.add(this.back);
    // the gold card glows: a warm halo behind it, and a band of light sweeping across both faces
    const halo = document.createElement('canvas'); halo.width = halo.height = 128;
    { const x = halo.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,230,150,1)'); g.addColorStop(0.45, 'rgba(255,190,70,0.55)'); g.addColorStop(1, 'rgba(255,170,40,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(CW * 2.3, CH * 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(halo), color: 0xffd070, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.halo.position.z = -0.006; this.halo.renderOrder = 8.5;
    this.winner.add(this.halo);
    this.shineU = { uT: { value: 0 }, uO: { value: 1 } };
    const shineMat = new THREE.ShaderMaterial({
      uniforms: this.shineU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uO; varying vec2 vUv;
        void main(){ float p = fract(uT * 0.45) * 2.4 - 0.7; float d = (vUv.x + vUv.y * 0.6) - p;
          float band = exp(-d * d * 90.0) * 0.85 + exp(-d * d * 12.0) * 0.18;
          float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
          float a = band * edge * uO; gl_FragColor = vec4(vec3(1.0, 0.93, 0.7) * a, a); }`,
    });
    for (const [z, ry] of [[0.0012, 0], [-0.0022, Math.PI]]) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), shineMat);
      sh.position.z = z; sh.rotation.y = ry; sh.renderOrder = 10;
      this.winner.add(sh);
    }
    this.opened = false;
    this._lastIdx = -1;
    this._offset(0);
  }

  update(t) {
    // the halo breathes and the light sweeps across
    // (softer once it's won and showing the wish, so the words stay easy to read)
    const o = this.winner.material.opacity, won = this._won;
    this.shineU.uT.value = t;
    this.shineU.uO.value = o * (won ? 0.18 : 0.6);
    this.halo.material.opacity = o * ((won ? 0.26 : 0.5) + 0.07 * Math.sin(t * 3.2));
    this.halo.scale.setScalar(1 + 0.05 * Math.sin(t * 2.4));
  }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.14, 0)); }
  /** The reel window's width in the world (for fitting it to the screen). */
  get stripWidth() { return (VIEW + 0.1) * this.group.scale.x; }
  get stripPoint() { return this.strip.getWorldPosition(new THREE.Vector3()); }

  setWish(text) {
    this.back.material.map?.dispose();
    this.back.material.map = wishTexture(text); this.back.material.needsUpdate = true;
  }

  /** Scroll the reel so that `x` (m along it) sits under the marker; fade cards towards the window's edges. */
  _offset(x) {
    this._x = x;
    this.reel.position.x = -x;
    for (const m of this.cards) {
      const px = m.position.x - x, a = Math.abs(px);
      m.visible = a < VIEW / 2 + CW;
      m.material.opacity = (this._won && m === this.winner) ? 1 : THREE.MathUtils.clamp((VIEW / 2 - a) / 0.16, 0, 1) * (this._fade ?? 1);
      if (this._won && m === this.winner) m.visible = true;
      const s = 1 + 0.08 * Math.max(0, 1 - a / (PITCH * 0.8));
      if (m !== this.winner || !this._won) m.scale.setScalar(s);
    }
  }

  /** Unlatch, spin, land on the wish. onTick fires each time a card passes the marker. */
  open(wish, { onTick = () => {}, onLatch = () => {}, onLand = () => {}, onRattle = () => {}, onBlast = () => {} } = {}) {
    if (this.opened) return Promise.resolve();
    this.opened = true;
    if (wish !== undefined) this.setWish(wish);
    this._won = false; this._fade = 1;
    this.winner.rotation.y = 0; this.winner.position.set(WIN * PITCH, 0, 0);
    const startX = 1 * PITCH;
    const land = WIN * PITCH + (Math.random() - 0.5) * CW * 0.7;   // lands a little off-centre, like a real reel
    this._offset(startX);
    const st = { x: startX };
    return new Promise((resolve) => {
      const c = this.case;
      const rattle = { k: 0 };
      gsap.timeline({ onComplete: resolve })
        // it rattles as if something inside wants out…
        .call(onRattle)
        .to(rattle, { k: 1, duration: 1.0, ease: 'power1.in', onUpdate: () => { const a = rattle.k * 0.012; c.position.set((Math.random() - 0.5) * a, Math.random() * a * 0.8, (Math.random() - 0.5) * a); c.rotation.z = (Math.random() - 0.5) * a * 2; } })
        .call(() => { c.position.set(0, 0, 0); c.rotation.z = 0; onLatch(); })
        // …the latches pop and the lid swings open
        .to(this.lid.rotation, { x: -2.0, duration: 0.7, ease: 'back.out(1.8)' }, '+=0.3')
        .call(onBlast, null, '<')
        .call(() => { this.strip.visible = true; }, null, '<0.35')
        .to(this.dim.material, { opacity: 0.62, duration: 0.6 }, '<')
        .fromTo(this.strip.scale, { x: 0.2, y: 0.01 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(1.8)' }, '<')
        .to(st, {
          x: land, duration: 6.2, ease: 'power4.out',
          onUpdate: () => {
            this._offset(st.x);
            const idx = Math.floor((st.x + PITCH / 2) / PITCH);
            if (idx !== this._lastIdx) { this._lastIdx = idx; onTick(); }
          },
        }, '<0.4')
        // settle onto the card's centre, then the win
        .to(st, { x: WIN * PITCH, duration: 0.35, ease: 'power2.inOut', onUpdate: () => this._offset(st.x) }, '+=0.25')
        .call(() => { this._won = true; onLand(); })
        .to(this, { _fade: 0, duration: 0.6, onUpdate: () => this._offset(this._x) }, '<')
        .to(this.winner.scale, { x: 1.9, y: 1.9, z: 1.9, duration: 0.7, ease: 'back.out(1.7)' }, '<')
        .to(this.winner.position, { z: 0.12, y: 0.04, duration: 0.7, ease: 'power2.out' }, '<')
        .to(this.panel.material, { opacity: 0, duration: 0.5 }, '<')
        .to(this.winner.rotation, { y: Math.PI, duration: 0.9, ease: 'power2.inOut' }, '+=0.5');
    }).then(() => { this.winner.material.opacity = 1; });
  }

  /** Leaving the scene: the lid closes and the reel goes away (so they never block other views). */
  stow() {
    if (!this.opened || this._stowed) return;
    this._stowed = true;
    gsap.killTweensOf(this.lid.rotation);
    gsap.to(this.lid.rotation, { x: 0, duration: 0.6, ease: 'power2.inOut' });
    this.strip.visible = false; this.dim.material.opacity = 0;
  }

  /** Back again: the lid opens and the won card is there. */
  unstow() {
    if (!this._stowed) return;
    this._stowed = false;
    gsap.killTweensOf(this.lid.rotation);
    gsap.to(this.lid.rotation, { x: -2.0, duration: 0.7, ease: 'back.out(1.6)' });
    this.strip.visible = true; gsap.fromTo(this.dim.material, { opacity: 0 }, { opacity: 0.62, duration: 0.6 });
  }

  /** The gold card's centre (for the camera and the sparkles). */
  get winnerPoint() { return this.winner.getWorldPosition(new THREE.Vector3()); }

  reset() {
    gsap.killTweensOf([this.dim.material, this.lid.rotation, this.strip.scale, this.winner.scale, this.winner.position, this.winner.rotation, this]);
    this.case.position.set(0, 0, 0); this.case.rotation.z = 0;
    this.opened = false; this._won = false; this._fade = 1; this._stowed = false;
    this.lid.rotation.x = 0;

    this.strip.visible = false; this.dim.material.opacity = 0;
    this.panel.material.opacity = 0.72;
    this.winner.rotation.y = 0; this.winner.position.set(WIN * PITCH, 0, 0); this.winner.scale.setScalar(1);
    this._lastIdx = -1;
    this._offset(PITCH);
  }
}

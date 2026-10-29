import * as THREE from 'three';
import { piece } from '../world/courtyard.js';
import { softSprite } from '../util/textures.js';

// The salute: grenades come lobbing over the walls — four smoke canisters that bounce across the flagstones
// and billow pink, teal, gold and violet; three party grenades that burst high over the battlements into
// fireworks and confetti; and finally a "flash" that whites out the screen and leaves the birthday greeting
// burned into your eyes as it fades. Then the fireworks take over the darkening sky.

const SMOKE_COLORS = [[1.0, 0.45, 0.68], [0.2, 0.85, 0.82], [1.0, 0.78, 0.25], [0.62, 0.42, 1.0]];
const PER_CLOUD = 90;

const smokeVert = /* glsl */ `
attribute float aLife, aSize; attribute vec3 aColor;
varying float vL; varying vec3 vC;
uniform float uPx;
void main() { vL = aLife; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uPx / -mv.z, 0.0, 420.0); gl_Position = projectionMatrix * mv; }`;
const smokeFrag = /* glsl */ `
uniform sampler2D uMap; varying float vL; varying vec3 vC;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a;
  // toon smoke: two flat tones (lit top, shaded bottom) with a soft edge
  float lit = smoothstep(0.55, 0.45, gl_PointCoord.y + (1.0 - a) * 0.2);
  vec3 col = mix(vC * 0.72, min(vec3(1.0), vC * 1.12 + 0.08), lit);
  float alpha = smoothstep(0.08, 0.5, a) * vL * 0.9;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha);
}`;

export class GrenadeShow {
  constructor(scene, { fireworks, confetti, sparkles, audio, onFlash }) {
    this.scene = scene; this.fireworks = fireworks; this.confetti = confetti; this.sparkles = sparkles; this.audio = audio; this.onFlash = onFlash;
    this.group = new THREE.Group(); this.group.name = 'grenades';
    scene.add(this.group);
    this.flying = [];
    this.timers = [];
    // smoke: one point cloud for all four clouds
    const n = PER_CLOUD * SMOKE_COLORS.length;
    const g = new THREE.BufferGeometry();
    this.sm = { pos: new Float32Array(n * 3).fill(-80), vel: new Float32Array(n * 3), life: new Float32Array(n), age: new Float32Array(n).fill(-1), size: new Float32Array(n), col: new Float32Array(n * 3), n };
    g.setAttribute('position', new THREE.BufferAttribute(this.sm.pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.sm.life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sm.size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.sm.col, 3));
    this.smoke = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: smokeVert, fragmentShader: smokeFrag, uniforms: { uMap: { value: softSprite(64, 0.35) }, uPx: { value: 900 } }, transparent: true, depthWrite: false }));
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 3;
    this.smoke.visible = false;
    this.group.add(this.smoke);
    this.clouds = [];
  }

  _grenade(kind, colorIdx = 0) {
    const g = piece('tactical', `grenade_${kind}`, { outline: 0.0012 });
    g.scale.setScalar(1.8);
    if (kind === 'smoke') g.traverse((m) => {
      if (!m.isMesh || m.userData.isOutline) return;
      if ((m.material.name || '').startsWith('M_band')) { m.material = m.material.clone(); m.material.color.setRGB(...SMOKE_COLORS[colorIdx]); }
    });
    g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    this.group.add(g);
    return g;
  }

  /** Lob a grenade from a to b, peaking `apex` metres above the higher end; then onLand(). */
  _throw(kind, a, b, { apex = 3, dur = 1.3, colorIdx = 0, bounce = false, onLand = () => {} }) {
    const g = this._grenade(kind, colorIdx);
    g.position.copy(a);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14);
    this.flying.push({ g, a: a.clone(), b: b.clone(), apex, dur, t: 0, spin, bounce, onLand, kind });
    this.audio.whoosh?.();
  }

  _at(fn, s) { const id = setTimeout(fn, s * 1000); this.timers.push(id); }

  /** The whole show; resolves as the flash fades (the fireworks then carry on by themselves). */
  run(centre) {
    this.stop();
    this.running = true;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const A = this.audio;
    return new Promise((resolve) => {
      // smoke canisters thrown in from both sides
      const smokes = [
        [V(-7.5, 2.4, 4.5), V(-3.6, 0.03, -2.6), 0], [V(7.5, 2.4, 4.5), V(3.9, 0.03, -2.2), 1],
        [V(5.5, 3.4, -8.5), V(2.6, 0.03, -4.2), 2], [V(-8.5, 3.4, -6.5), V(-5.6, 0.03, -4.4), 3],
      ];
      smokes.forEach(([a, b, c], i) => this._at(() => {
        A.pin?.();
        this._at(() => this._throw('smoke', a, b, { apex: 2.6, dur: 1.15, colorIdx: c, bounce: true, onLand: (p) => { A.clink?.(); this._at(() => this._startCloud(p, c), 0.45); } }), 0.25);
      }, i * 0.7));
      // party grenades over the walls: bursts of fireworks and confetti
      const party = [V(-3.5, 10, -10), V(0.8, 12.5, -12), V(5, 10, -9)];
      party.forEach((p, i) => this._at(() => {
        this._throw('party', V(-1 + i, 1.2, 6.5), p, { apex: 2.5, dur: 1.5, onLand: (q) => {
          this.fireworks._burst(q, i === 1 ? 'heart' : 'peony');
          this.audio.firework({ distance: 30, big: i === 1 });
          this.confetti.burst(new THREE.Vector3(q.x * 0.3, 5.5, -1.5), 1.4);
        } });
      }, 3.4 + i * 0.55));
      // the flash: it sails in, hangs a moment… and pops
      this._at(() => {
        A.pin?.();
        this._throw('flash', V(6.5, 1.6, 4.5), V(0.2, 3.1, 0.6), { apex: 1.6, dur: 1.1, onLand: (p) => {
          this._hang = { g: this.flying.length ? null : null, p };
          this._at(() => { A.flashbang?.(); this.onFlash?.(); this._clearFlying(); resolve(); }, 0.55);
        } });
      }, 6.2);
    });
  }

  _startCloud(p, c) {
    this.smoke.visible = true;
    this.audio.hiss?.(4.5);
    const sm = this.sm, base = c * PER_CLOUD;
    for (let k = 0; k < PER_CLOUD; k++) {
      const i = base + k;
      sm.age[i] = -k * (3.2 / PER_CLOUD);     // emitted over ~3 s
      sm.pos.set([p.x, p.y + 0.05, p.z], i * 3);
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.4;
      sm.vel.set([Math.cos(a) * s, 0.5 + Math.random() * 1.2, Math.sin(a) * s], i * 3);
      sm.col.set(SMOKE_COLORS[c].map((v) => v * (0.9 + Math.random() * 0.15)), i * 3);
      sm.size[i] = 0; sm.life[i] = 0;
      sm.origin = sm.origin || [];
      sm.origin[i] = p.clone();
    }
  }

  _clearFlying() { for (const f of this.flying) this.group.remove(f.g); this.flying = []; }

  stop() {
    this.running = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    this._clearFlying();
  }

  /** Clear the smoke too (a restart). */
  reset() {
    this.stop();
    this.sm.age.fill(-1); this.sm.life.fill(0); this.sm.pos.fill(-80);
    this.smoke.visible = false;
  }

  update(t, dt, camera) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const top = Math.max(f.a.y, f.b.y) + f.apex;
      // a parabola through a, the apex and b
      const y = (1 - k) * (1 - k) * f.a.y + 2 * k * (1 - k) * (2 * top - (f.a.y + f.b.y) / 2) + k * k * f.b.y;
      f.g.position.set(THREE.MathUtils.lerp(f.a.x, f.b.x, k), y, THREE.MathUtils.lerp(f.a.z, f.b.z, k));
      f.g.rotation.x += f.spin.x * dt; f.g.rotation.y += f.spin.y * dt; f.g.rotation.z += f.spin.z * dt;
      if (k >= 1 && !f.landed) {
        f.landed = true;
        if (f.bounce) {
          // two little hops across the stones, then it lies there hissing
          const dir = f.b.clone().sub(f.a).setY(0).normalize();
          f.a = f.b.clone(); f.b = f.b.clone().addScaledVector(dir, 0.7); f.apex = 0.25; f.dur = 0.35; f.t = 0; f.landed = false; f.bounce = f.bounce === true ? 1 : f.bounce + 1;
          if (f.bounce > 2) { f.bounce = false; f.spin.multiplyScalar(0); f.g.rotation.set(Math.PI / 2, f.g.rotation.y, 0); }
          if (f.bounce === 1) this.audio.clink?.();
          if (!f.bounce) { f.onLand(f.g.position.clone()); f.done = true; }
        } else if (f.kind === 'flash') {
          f.onLand(f.g.position.clone()); f.hang = 0.55; f.done = true;
        } else {
          f.onLand(f.g.position.clone());
          this.group.remove(f.g); this.flying.splice(i, 1);
        }
      }
      if (f.kind === 'flash' && f.hang > 0) { f.hang -= dt; f.g.position.y -= dt * 0.8; }
    }
    // smoke
    const sm = this.sm;
    if (this.smoke.visible) {
      let alive = 0;
      for (let i = 0; i < sm.n; i++) {
        if (sm.age[i] === -1) continue;
        sm.age[i] += dt;
        if (sm.age[i] < 0) continue;
        const a = sm.age[i];
        const life = 13;
        if (a > life) { sm.age[i] = -1; sm.life[i] = 0; sm.pos[i * 3 + 1] = -80; continue; }
        alive++;
        const drag = Math.exp(-dt * 0.9);
        sm.vel[i * 3] *= drag; sm.vel[i * 3 + 2] *= drag; sm.vel[i * 3 + 1] = sm.vel[i * 3 + 1] * drag + 0.06 * dt;
        sm.pos[i * 3] += (sm.vel[i * 3] + 0.12) * dt; sm.pos[i * 3 + 1] += sm.vel[i * 3 + 1] * dt; sm.pos[i * 3 + 2] += sm.vel[i * 3 + 2] * dt;
        sm.size[i] = Math.min(2.6, 0.5 + a * 0.55) * (0.8 + (i % 7) * 0.06);
        sm.life[i] = Math.min(1, a * 2) * Math.min(1, (life - a) / 3);
      }
      this.smoke.geometry.attributes.position.needsUpdate = true;
      this.smoke.geometry.attributes.aLife.needsUpdate = true;
      this.smoke.geometry.attributes.aSize.needsUpdate = true;
      this.smoke.geometry.attributes.aColor.needsUpdate = true;
      this.smoke.material.uniforms.uPx.value = innerHeight * Math.min(devicePixelRatio, 2) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      if (!alive && sm.age.every((v) => v === -1)) this.smoke.visible = false;
    }
  }
}

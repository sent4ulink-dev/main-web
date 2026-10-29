import * as THREE from 'three';
import { softSprite } from '../util/textures.js';
import { foodPiece } from '../world/picnic.js';

// The birthday cake (chocolate & berries, modelled in Blender) with real-time candle flames and smoke.

const flameVert = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uWind;
void main() {
  vUv = uv;
  vec3 p = position;
  float sway = (sin(uTime * 9.0 + uSeed * 7.0) * 0.5 + sin(uTime * 15.3 + uSeed * 3.0) * 0.3) * 0.0016 + uWind * 0.004;
  p.x += sway * uv.y * uv.y;
  // billboard around the vertical axis
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  mv.xy += p.xy * scale.xy;
  gl_Position = projectionMatrix * mv;
}`;

const flameFrag = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uLife;
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float flick = 0.92 + 0.08 * sin(uTime * 23.0 + uSeed * 11.0) + 0.05 * sin(uTime * 37.0 + uSeed);
  uv.y = uv.y * 1.0 + 0.35;
  // teardrop distance
  float w = mix(0.62, 0.05, clamp((uv.y + 0.6) / 1.9, 0.0, 1.0)) * flick;
  float d = length(vec2(uv.x / max(w, 0.02), (uv.y + 0.15) * 0.62));
  float body = smoothstep(1.0, 0.25, d);
  float core = smoothstep(0.55, 0.0, length(vec2(uv.x / 0.28, (uv.y + 0.55) * 1.4)));
  float blue = smoothstep(0.5, 0.0, length(vec2(uv.x / 0.3, (uv.y + 0.95) * 2.2)));
  vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.72, 0.34), body) * body * 1.9;
  col += vec3(1.0, 0.9, 0.7) * core * 2.2;
  col = mix(col, vec3(0.25, 0.45, 1.0) * 1.5, blue * 0.55);
  float a = clamp(body + core * 0.5, 0.0, 1.0) * uLife;
  gl_FragColor = vec4(col * a, a);
}`;

export class Cake {
  constructor(parent, anchor) {
    this.group = new THREE.Group();
    this.group.name = 'cake';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    this.lit = true;
    this.hitTargets = [];
    this._build();
  }

  _build() {
    const g = this.group;
    // the chocolate-and-berries cake modelled in Blender (on its stand)
    const model = foodPiece('cake', { ground: true });
    g.add(model);
    model.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
    const topY = 0.221;

    // candles
    this.candles = [];
    this.flames = [];
    const stripeMat = (c1, c2) => {
      const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.3 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uC1 = { value: new THREE.Color(c1) }; sh.uniforms.uC2 = { value: new THREE.Color(c2) };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uC1; uniform vec3 uC2;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            float st = step(0.5, fract(vUv.x * 2.0 + vUv.y * 5.0));
            diffuseColor.rgb = mix(uC1, uC2, st);`);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;');
      };
      m.defines = { USE_UV: '' };
      m.customProgramCacheKey = () => `candle-${c1}-${c2}`;
      return m;
    };
    const candleColors = [[0xf4a6b8, 0xffffff], [0xa8d8ef, 0xffffff], [0xf9e2a8, 0xffffff], [0xc9b8f0, 0xffffff], [0xbfe3c9, 0xffffff], [0xffc2a1, 0xffffff]];
    const candleGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.085, 16);
    candleGeo.translate(0, 0.0425, 0);
    const wickGeo = new THREE.CylinderGeometry(0.0006, 0.0006, 0.008, 6);
    const wickMat = new THREE.MeshStandardMaterial({ color: 0x222018, roughness: 0.9 });
    const flameGeo = new THREE.PlaneGeometry(0.013, 0.028);
    flameGeo.translate(0, 0.012, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const rr = 0.066;
      const c = new THREE.Mesh(candleGeo, stripeMat(...candleColors[i]));
      c.position.set(Math.cos(a) * rr, topY, Math.sin(a) * rr);
      c.castShadow = true;
      const wick = new THREE.Mesh(wickGeo, wickMat);
      wick.position.y = 0.089;
      c.add(wick);
      const fm = new THREE.ShaderMaterial({
        vertexShader: flameVert, fragmentShader: flameFrag, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.37 }, uLife: { value: 1 }, uWind: { value: 0 } },
      });
      const flame = new THREE.Mesh(flameGeo, fm);
      flame.position.y = 0.091;
      flame.frustumCulled = false;
      flame.renderOrder = 5;
      c.add(flame);
      g.add(c);
      this.candles.push(c);
      this.flames.push(flame);
    }
    this.topY = topY;

    // candle light (one warm light for all flames)
    this.light = new THREE.PointLight(0xffa04a, 0.0, 2.6, 2);
    this.light.position.set(0, topY + 0.11, 0);
    g.add(this.light);
    this.baseLight = 0.45;

    // smoke
    const smokeN = 6 * 40;
    const sg = new THREE.BufferGeometry();
    this.smokeData = { pos: new Float32Array(smokeN * 3), vel: new Float32Array(smokeN * 3), life: new Float32Array(smokeN), n: smokeN };
    sg.setAttribute('position', new THREE.BufferAttribute(this.smokeData.pos, 3));
    sg.setAttribute('aLife', new THREE.BufferAttribute(this.smokeData.life, 1));
    this.smoke = new THREE.Points(sg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: softSprite(64) }, uScale: { value: 900 } },
      vertexShader: 'attribute float aLife; varying float vL; uniform float uScale; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uScale * (0.006 + (1.0 - aLife) * 0.02) / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D uMap; varying float vL; void main(){ float a = texture2D(uMap, gl_PointCoord).a * vL * 0.28; if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.82, 0.8, 0.78) * a, a); }',
    }));
    this.smoke.frustumCulled = false;
    this.smoke.visible = false;
    g.add(this.smoke);
  }

  setLit(lit, instant = false) {
    this.lit = lit;
    this.flames.forEach((f, i) => {
      f.userData.target = lit ? 1 : 0;
      f.userData.delay = instant ? 0 : i * 0.09;
      if (instant) { f.material.uniforms.uLife.value = lit ? 1 : 0; f.visible = lit; }
    });
    if (!lit && !instant) this._emitSmoke();
  }

  _emitSmoke() {
    const s = this.smokeData;
    this.smoke.visible = true;
    this.candles.forEach((c, ci) => {
      for (let k = 0; k < 40; k++) {
        const i = ci * 40 + k;
        s.pos[i * 3] = c.position.x; s.pos[i * 3 + 1] = c.position.y + 0.093; s.pos[i * 3 + 2] = c.position.z;
        s.vel[i * 3] = (Math.random() - 0.5) * 0.01; s.vel[i * 3 + 1] = 0.05 + Math.random() * 0.06; s.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
        s.life[i] = -k * 0.045 - ci * 0.09; // staggered start
      }
    });
    this._smokeT = 0;
  }

  update(t, dt, windStrength = 0.5) {
    for (const f of this.flames) {
      const u = f.material.uniforms;
      u.uTime.value = t;
      u.uWind.value = windStrength;
      if (f.userData.target !== undefined) {
        if (f.userData.delay > 0) f.userData.delay -= dt;
        else {
          u.uLife.value += (f.userData.target - u.uLife.value) * Math.min(1, dt * (f.userData.target ? 3 : 9));
          f.visible = u.uLife.value > 0.01;
        }
      }
    }
    const life = this.flames.reduce((s, f) => s + f.material.uniforms.uLife.value, 0) / this.flames.length;
    const flick = 0.85 + 0.1 * Math.sin(t * 17) + 0.06 * Math.sin(t * 29 + 1.3);
    this.light.intensity = this.baseLight * life * flick;

    if (this.smoke.visible) {
      const s = this.smokeData;
      let alive = 0;
      for (let i = 0; i < s.n; i++) {
        if (s.life[i] < 0) { s.life[i] += dt; if (s.life[i] >= 0) s.life[i] = 1; else continue; }
        if (s.life[i] <= 0) continue;
        s.life[i] -= dt * 0.33;
        const i3 = i * 3;
        const y = s.pos[i3 + 1] - this.topY;
        s.vel[i3] += Math.sin(t * 2 + y * 40 + i) * 0.004 * dt * 10 + windStrength * 0.002;
        s.vel[i3 + 2] += Math.cos(t * 1.7 + y * 37 + i) * 0.004 * dt * 10;
        s.pos[i3] += s.vel[i3] * dt; s.pos[i3 + 1] += s.vel[i3 + 1] * dt; s.pos[i3 + 2] += s.vel[i3 + 2] * dt;
        alive++;
      }
      for (let i = 0; i < s.n; i++) if (s.life[i] < 0) alive++;
      this.smoke.geometry.attributes.position.needsUpdate = true;
      this.smoke.geometry.attributes.aLife.needsUpdate = true;
      if (!alive) this.smoke.visible = false;
    }
  }

  /** world position of the candle flames (for camera focus) */
  get focusPoint() {
    return this.group.localToWorld(new THREE.Vector3(0, this.topY + 0.04, 0));
  }
}

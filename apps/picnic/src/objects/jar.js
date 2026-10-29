import * as THREE from 'three';
import gsap from 'gsap';
import { softSprite } from '../util/textures.js';
import { wind } from '../world/wind.js';

// Glass wish jar full of glowing "wishes". Opening it frees them; they drift around the picnic
// as fireflies for the rest of the evening.

const N = 46;

function jarProfile() {
  const p = [[0, 0], [0.043, 0], [0.047, 0.004], [0.048, 0.012], [0.048, 0.098], [0.044, 0.112], [0.035, 0.12], [0.034, 0.128], [0.036, 0.13], [0.036, 0.136], [0.033, 0.137]];
  return p.map(([x, y]) => new THREE.Vector2(x, y));
}

export class WishJar {
  constructor(parent, anchor) {
    this.group = new THREE.Group();
    this.group.name = 'jar';
    this.group.position.copy(anchor.position);
    parent.add(this.group);
    this.opened = false;

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22,
      clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    // fresnel: glass reads at its edges, clear in the middle
    glass.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float fres = pow(max(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 0.0), 2.5);
        gl_FragColor.rgb += vec3(0.85, 0.92, 0.95) * fres * 0.45;
        gl_FragColor.a = clamp(gl_FragColor.a + fres * 0.55, 0.0, 1.0);`);
    };
    glass.customProgramCacheKey = () => 'jar-glass';
    const jar = new THREE.Mesh(new THREE.LatheGeometry(jarProfile(), 64), glass);
    jar.renderOrder = 4;
    this.group.add(jar);
    // thicker glass base reads as real glass
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.006, 48), new THREE.MeshPhysicalMaterial({ color: 0xe9f3ef, roughness: 0.08, transparent: true, opacity: 0.45, clearcoat: 1 }));
    base.position.y = 0.003;
    this.group.add(base);

    // cork + twine bow
    this.lid = new THREE.Group();
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0xc19a6b, roughness: 0.95 }));
    cork.position.y = 0.015;
    cork.castShadow = true;
    this.lid.add(cork);
    this.lid.position.y = 0.128;
    this.group.add(this.lid);
    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.0355, 0.0018, 8, 48), new THREE.MeshStandardMaterial({ color: 0xe8a3b4, roughness: 0.6 }));
    twine.rotation.x = Math.PI / 2;
    twine.position.y = 0.124;
    this.group.add(twine);
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xe8a3b4, roughness: 0.55 });
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 8, 20), bowMat);
      loop.position.set(0.038 + s * 0.008, 0.124, 0.0);
      loop.rotation.set(0, Math.PI / 2, s * 0.6);
      this.group.add(loop);
    }

    // wishes: glowing points
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.seed = new Float32Array(N);
    this.home = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.034, y = 0.015 + Math.random() * 0.09;
      this.home.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      this.seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: softSprite(64, 0.15) }, uTime: { value: 0 }, uScale: { value: 1 }, uGlow: { value: 1 } },
      vertexShader: /* glsl */ `attribute float aSeed; varying float vB; uniform float uTime; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vB = 0.55 + 0.45 * sin(uTime * (2.0 + aSeed * 3.0) + aSeed * 30.0);
          gl_PointSize = uScale * (10.0 + aSeed * 8.0) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform float uGlow; varying float vB;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a; vec3 c = mix(vec3(1.0, 0.72, 0.3), vec3(1.0, 0.95, 0.7), a);
          gl_FragColor = vec4(c * a * vB * 2.6 * uGlow, a * vB); }`,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.group.add(this.points);
    this.free = new Array(N).fill(null);
    this.hitTargets = [jar, cork];
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    gsap.timeline()
      .to(this.lid.position, { y: 0.2, duration: 0.5, ease: 'back.out(2.5)' })
      .to(this.lid.rotation, { z: 1.1, x: 0.4, duration: 0.5 }, '<')
      // the cork tips over and rolls to rest on its side, beside the jar (not in front of it)
      .to(this.lid.position, { x: 0.015, y: 0.035, z: 0.1, duration: 0.6, ease: 'bounce.out' })
      .to(this.lid.rotation, { x: Math.PI / 2, z: 0.3, duration: 0.6 }, '<');
    const now = performance.now() / 1000;
    for (let i = 0; i < N; i++) {
      // each wish gets an orbit around the picnic to settle into
      this.free[i] = {
        start: now + 0.3 + i * 0.06,
        orbitR: 0.6 + Math.random() * 3.6, orbitH: 0.4 + Math.random() * 2.2, speed: (Math.random() * 0.5 + 0.15) * (Math.random() < 0.5 ? -1 : 1),
        phase: Math.random() * Math.PI * 2,
      };
    }
  }

  reset() {
    this.opened = false;
    this.lid.position.set(0, 0.128, 0);
    this.lid.rotation.set(0, 0, 0);
    this.free.fill(null);
  }

  update(t, dt, camera, dusk = 0) {
    const u = this.points.material.uniforms;
    u.uTime.value = t;
    u.uScale.value = innerHeight * 0.0016 * Math.min(devicePixelRatio, 2);
    u.uGlow.value = 1.0 + dusk * 1.2;
    const now = performance.now() / 1000;
    const wd = wind.uniforms.uWindDir.value;
    const center = this.group.worldToLocal(new THREE.Vector3(0.6, 0, 0.6));
    for (let i = 0; i < N; i++) {
      const h = this.home[i], s = this.seed[i];
      let x = h.x + Math.sin(t * (0.8 + s) + s * 20) * 0.006;
      let y = h.y + Math.sin(t * (0.6 + s * 0.7) + s * 9) * 0.008;
      let z = h.z + Math.cos(t * (0.7 + s) + s * 13) * 0.006;
      const f = this.free[i];
      if (f && now > f.start) {
        const k = Math.min(1, (now - f.start) / 4.5);
        const e = k * k * (3 - 2 * k);
        const a = f.phase + t * f.speed * 0.4;
        const ox = center.x + Math.cos(a) * f.orbitR + Math.sin(t * 0.7 + s * 30) * 0.25 + wd.x * 0.2;
        const oy = f.orbitH + Math.sin(t * 0.9 + s * 17) * 0.25;
        const oz = center.z + Math.sin(a) * f.orbitR + Math.cos(t * 0.6 + s * 21) * 0.25 + wd.y * 0.2;
        // rise out of the jar first, then drift to the orbit
        const rise = Math.min(1, (now - f.start) / 1.2);
        x = THREE.MathUtils.lerp(x, ox, e);
        y = THREE.MathUtils.lerp(y + rise * 0.25, oy, e);
        z = THREE.MathUtils.lerp(z, oz, e);
      }
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.07, 0)); }
}

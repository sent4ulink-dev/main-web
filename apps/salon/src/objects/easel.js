import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial, addOutline } from '../style/toon.js';

// The last moment, as an 18th-century salon would keep it: a portrait of the party painted on the easel.
// A paintbrush sweeps across the canvas in diagonal strokes, top to bottom, and the picture appears behind it
// (uReveal 0 → 1, stroke band by stroke band); then a gilded frame grows round it and it floats to you.

export const CANVAS = 0.6;     // the painting is square (the capture is square)
const BANDS = 14;              // diagonal brushstroke bands
const ROT = 0.6;               // their slant (radians)

function paintMaterial() {
  const blank = new THREE.DataTexture(new Uint8Array([240, 232, 214, 255]), 1, 1); blank.needsUpdate = true;
  const m = new THREE.MeshBasicMaterial({ map: blank, side: THREE.DoubleSide });
  m.userData.reveal = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uReveal = m.userData.reveal;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uReveal;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', /* glsl */ `
        #ifdef USE_MAP
          vec2 uv = vMapUv;
          // the brush's path: diagonal bands from the top down, swept alternately left→right / right→left
          float c = cos(${ROT}), s = sin(${ROT});
          vec2 r = vec2(c * (uv.x - 0.5) - s * (uv.y - 0.5), s * (uv.x - 0.5) + c * (uv.y - 0.5)) + 0.5;
          float rows = ${BANDS.toFixed(1)};
          float row = clamp(floor((1.0 - r.y) * rows), 0.0, rows - 1.0);
          float along = mod(row, 2.0) < 0.5 ? r.x : 1.0 - r.x;
          float t = (row + clamp(along, 0.0, 1.0)) / rows;              // when the brush passes here
          float bristle = vnoise(vec2(r.x * 7.0, r.y * 300.0)) * 0.02;   // frayed, bristly stroke edges
          float k = smoothstep(t + bristle - 0.006, t + bristle + 0.006, uReveal * 1.02);   // painted once the brush has passed
          // soften the photo into dabs of paint
          vec2 dab = uv + (vec2(vnoise(uv * 140.0), vnoise(uv * 140.0 + 7.0)) - 0.5) * 0.004;
          vec4 texel = texture2D(map, dab);
          texel.rgb = mix(texel.rgb, texel.rgb * vec3(1.04, 0.98, 0.9), 0.5);
          vec3 ground = vec3(0.94, 0.9, 0.82) - vnoise(uv * 300.0) * 0.04;
          diffuseColor.rgb *= mix(ground, texel.rgb, k);
        #endif`);
  };
  m.customProgramCacheKey = () => 'easel-paint-v2';
  return m;
}

/** A painter's brush: walnut handle, brass ferrule, bristles dipped in rose paint. Origin at the bristle tip. */
function makeBrush() {
  const g = new THREE.Group();
  const wood = toonMaterial({ color: new THREE.Color('#6a3a1c') });
  const brass = toonMaterial({ color: new THREE.Color('#d9a845'), emissive: new THREE.Color('#d9a845').multiplyScalar(0.15) }, { rimScale: 2.2 });
  const hair = toonMaterial({ color: new THREE.Color('#e7c9a0') });
  const paint = toonMaterial({ color: new THREE.Color('#c8344f') });
  const parts = [
    [new THREE.ConeGeometry(0.009, 0.03, 10), paint, 0.015, true],
    [new THREE.CylinderGeometry(0.0095, 0.008, 0.02, 10), hair, 0.04],
    [new THREE.CylinderGeometry(0.0085, 0.0095, 0.028, 12), brass, 0.064],
    [new THREE.CylinderGeometry(0.0065, 0.009, 0.2, 12), wood, 0.178],
  ];
  for (const [geo, mat, y, flip] of parts) {
    const m = new THREE.Mesh(geo, mat);
    if (flip) m.rotation.x = Math.PI;   // the tip points down, to the canvas
    m.position.y = y;
    m.castShadow = true;
    addOutline(m, 0.0012);
    g.add(m);
  }
  // the handle stands out of the canvas towards the viewer: local +Y → canvas normal (+Z), tipped a little
  const holder = new THREE.Group();
  g.rotation.x = Math.PI / 2;
  holder.add(g);
  return holder;
}

export class Easel {
  constructor(scene, easelGroup) {
    this.easel = easelGroup;
    easelGroup.updateMatrixWorld(true);
    this.anchor = easelGroup.getObjectByName('canvas_anchor');
    this.painting = new THREE.Group();
    this.canvas = new THREE.Mesh(new THREE.PlaneGeometry(CANVAS, CANVAS), paintMaterial());
    this.painting.add(this.canvas);
    // the gilded frame (shown when the finished painting is brought to you)
    const gilt = toonMaterial({ color: new THREE.Color('#e0ad48'), emissive: new THREE.Color('#e0ad48').multiplyScalar(0.18) }, { rimScale: 2.6 });
    const shape = new THREE.Shape([new THREE.Vector2(-0.38, -0.38), new THREE.Vector2(0.38, -0.38), new THREE.Vector2(0.38, 0.38), new THREE.Vector2(-0.38, 0.38)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(-0.3, -0.3), new THREE.Vector2(-0.3, 0.3), new THREE.Vector2(0.3, 0.3), new THREE.Vector2(0.3, -0.3)]));
    this.frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }), gilt);
    this.frame.position.z = -0.012;
    addOutline(this.frame, 0.0015);
    this.frame.scale.setScalar(0.001);
    this.painting.add(this.frame);
    this.home();
    this.anchor.add(this.painting);
    // the brush appears when it paints
    this.brush = makeBrush();
    this.brush.visible = false;
    this.anchor.add(this.brush);
    this.hitTargets = [];
    easelGroup.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
  }

  home() {
    if (this.painting.parent !== this.anchor) this.anchor.add(this.painting);
    this.painting.position.set(0, 0, 0.012);   // just in front of the board
    this.painting.quaternion.identity();
    this.painting.scale.setScalar(1);
    this.frame.scale.setScalar(0.001);
  }

  get focusPoint() { return this.canvas.getWorldPosition(new THREE.Vector3()); }

  /** Where the brush is at reveal time p (canvas-local, metres), following the shader's path. */
  _brushAt(p) {
    const rows = BANDS, row = Math.min(rows - 1, Math.floor(p * rows)), f = p * rows - row;
    const rx = row % 2 === 0 ? f : 1 - f, ry = 1 - (row + 0.5) / rows;   // in the slanted stroke frame
    const c = Math.cos(ROT), s = Math.sin(ROT), dx = rx - 0.5, dy = ry - 0.5;
    const u = c * dx + s * dy + 0.5, v = -s * dx + c * dy + 0.5;          // back to the canvas uv
    return new THREE.Vector3((THREE.MathUtils.clamp(u, -0.05, 1.05) - 0.5) * CANVAS, (THREE.MathUtils.clamp(v, -0.05, 1.05) - 0.5) * CANVAS, 0);
  }

  /** Put the captured picture on the canvas and paint it in, brush and all. Resolves when it's finished. */
  paint(image, duration = 6) {
    const m = this.canvas.material;
    const t = new THREE.CanvasTexture(image); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    m.map?.dispose?.(); m.map = t; m.needsUpdate = true;
    m.userData.reveal.value = 0;
    const b = this.brush, start = this._brushAt(0);
    b.visible = true;
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { b.visible = false; resolve(); } })
        // the brush comes in from the side and touches down at the top of the canvas
        .fromTo(b.position, { x: CANVAS * 0.9, y: CANVAS * 0.25, z: 0.25 }, { x: start.x, y: start.y, z: 0.02, duration: 0.7, ease: 'power2.out' })
        .to(m.userData.reveal, {
          value: 1, duration, ease: 'none',
          onUpdate: () => {
            const p = m.userData.reveal.value, pos = this._brushAt(p);
            // a lively hand: it lifts at the end of each stroke and leans into the sweep
            const f = (p * BANDS) % 1, lift = 0.004 + 0.03 * Math.max(0, 1 - Math.min(f, 1 - f) * 10);
            b.position.set(pos.x, pos.y, lift);
            const dir = Math.floor(p * BANDS) % 2 === 0 ? 1 : -1;
            b.rotation.set(-0.25 + Math.sin(p * 90) * 0.04, dir * 0.35, 0);
          },
        })
        .to(b.position, { x: CANVAS * 0.9, y: -CANVAS * 0.35, z: 0.3, duration: 0.6, ease: 'power2.in' });
    });
  }

  /** The gilded frame grows round the painting (before it's carried to you). */
  frameIt() { return gsap.to(this.frame.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.4)' }); }

  reset() {
    gsap.killTweensOf([this.canvas.material.userData.reveal, this.frame.scale, this.brush.position]);
    this.canvas.material.userData.reveal.value = 0;
    this.brush.visible = false;
    this.home();
  }
}

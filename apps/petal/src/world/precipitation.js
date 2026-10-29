import * as THREE from "three";
import { seeded } from "../core/math.js";

// Rain, snow and sakura petals in one draw call. Every particle lives in a
// box that follows the camera (pushed ahead of it, where you look); the vertex
// shader moves and wraps it, so the CPU never touches a particle.
//
//   Rain fills the view with thin streaks a few metres out — nothing right
//   in front of the lens (the drops on the lens are fx/lens-drops.js).
//   Snow and petals are small and fall straight down, turning as they go.

export const PRECIPITATION = { rain: 0, snow: 1, petals: 2 };

const COUNTS = { low: 1500, medium: 2800, high: 4400 };
// Per kind: half size of the box, where particles fade in (near) and the
// share of the pool drawn at full strength.
const KINDS = {
  rain: { box: [11, 8, 11], near: [2.4, 5.2], share: 1 },
  snow: { box: [9, 5.5, 9], near: [2.6, 4.6], share: 0.85 },
  petals: { box: [9, 5.5, 9], near: [2.6, 4.6], share: 0.5 },
};

export function createPrecipitation(scene, { quality = "high" } = {}) {
  const count = COUNTS[quality] ?? COUNTS.high;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const random = seeded(77);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = random();
  // Sort by the "visibility" seed so drawing the first N instances is a fair sample.
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => seeds[a * 4 + 3] - seeds[b * 4 + 3]);
  const sorted = new Float32Array(count * 4);
  order.forEach((from, to) => sorted.set(seeds.subarray(from * 4, from * 4 + 4), to * 4));
  geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sorted, 4));
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...KINDS.rain.box) },
      uNear: { value: new THREE.Vector2(...KINDS.rain.near) },
      uMode: { value: 0 },
      uLight: { value: new THREE.Color("#ffffff") },
    },
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime, uMode;
      uniform vec3 uCenter, uBox;
      uniform vec2 uNear;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vTint;
      void main() {
        vUv = uv;
        float rain = step(uMode, 0.5);
        float petal = step(1.5, uMode);
        float speed = rain * (11.0 + aSeed.z * 4.0) + (1.0 - rain) * (0.6 + aSeed.z * 0.5);
        // Straight down, no drifting sideways.
        vec3 box = uBox * 2.0;
        vec3 p = aSeed.xyz * box;
        p.y -= uTime * speed;
        vec3 origin = uCenter - uBox;
        p = origin + mod(p - origin, box);

        vec3 toCam = cameraPosition - p;
        float dist = length(toCam);
        float edge = length((p.xz - uCenter.xz) / uBox.xz);
        vFade = smoothstep(uNear.x, uNear.y, dist) * (1.0 - smoothstep(0.75, 1.0, edge));
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 pos;
        if (rain > 0.5) {
          // A thin streak turned to face the camera; thicker far away so it
          // still covers a pixel.
          vec3 fall = vec3(0.0, -1.0, 0.0);
          vec3 side = normalize(cross(toCam, fall));
          float width = 0.012 + dist * 0.0022;
          pos = p + side * (position.x * width) - fall * (position.y * (0.9 + aSeed.w * 0.5));
          vTint = vec3(0.82, 0.87, 0.96);
        } else {
          float size = (1.0 - petal) * (0.028 + aSeed.w * 0.022) + petal * (0.036 + aSeed.w * 0.022);
          float spin = uTime * (0.6 + aSeed.z * 1.6) + aSeed.w * 6.283;
          float flip = mix(1.0, cos(uTime * (1.6 + aSeed.x * 2.0) + aSeed.y * 9.0), petal);
          vec2 q = vec2(position.x, position.y - 0.5);
          q = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * q;
          q.x *= mix(1.0, 0.3 + 0.7 * abs(flip), petal);
          pos = p + (right * q.x + up * q.y) * size * 2.0;
          vTint = mix(vec3(1.0), mix(vec3(1.0, 0.8, 0.88), vec3(1.0, 0.93, 0.96), aSeed.y), petal);
        }
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: `
      uniform float uMode;
      uniform vec3 uLight;
      varying vec2 vUv;
      varying float vFade;
      varying vec3 vTint;
      void main() {
        float a;
        if (uMode < 0.5) {
          a = (1.0 - abs(vUv.x * 2.0 - 1.0)) * sin(3.14159 * vUv.y) * 0.58;
        } else if (uMode < 1.5) {
          a = smoothstep(0.5, 0.15, length(vUv - 0.5)) * 0.9;
        } else {
          // Sakura petal: a soft ellipse with a little notch at the tip.
          vec2 q = (vUv - 0.5) * 2.0;
          float body = 1.0 - length(q * vec2(1.35, 0.95));
          float notch = smoothstep(0.08, 0.0, length(q - vec2(0.0, 0.92)) - 0.14);
          a = smoothstep(0.0, 0.12, body) * (1.0 - notch) * 0.95;
        }
        a *= vFade;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vTint * uLight, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.name = "Precipitation";
  mesh.visible = false;
  scene.add(mesh);

  let mode = "rain";
  const ahead = new THREE.Vector3();
  return {
    get mode() { return mode; },
    // kind: "rain" | "snow" | "petals"; amount 0..1.
    set(kind, amount) {
      const spec = KINDS[kind] || KINDS.rain;
      mode = kind;
      material.uniforms.uMode.value = PRECIPITATION[kind] ?? 0;
      material.uniforms.uBox.value.set(...spec.box);
      material.uniforms.uNear.value.set(...spec.near);
      geometry.instanceCount = Math.round(count * spec.share * Math.max(0, Math.min(1, amount)));
      mesh.visible = geometry.instanceCount > 0;
    },
    update(camera, time, light) {
      if (!mesh.visible) return;
      material.uniforms.uTime.value = time;
      // Centre the box ahead of the camera: particles behind it are wasted.
      camera.getWorldDirection(ahead).setY(0);
      if (ahead.lengthSq() > 1e-6) ahead.normalize();
      const box = material.uniforms.uBox.value;
      material.uniforms.uCenter.value.copy(camera.position).addScaledVector(ahead, box.x * 0.45);
      if (light) material.uniforms.uLight.value.copy(light);
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}

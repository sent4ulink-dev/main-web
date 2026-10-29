import * as THREE from "three";
import { seeded } from "../core/math.js";

// The sky above the sea of clouds, in a handful of draw calls:
//   * a dome with a day / sunset / night gradient, the sun and moon, twinkling
//     stars, a faint Milky Way, and a rainbow at the real 42° rainbow angle
//     opposite the sun (all in one fragment shader),
//   * one instanced batch of camera-facing cumulus billboards, tinted by the
//     light of the hour and sorted back to front,
//   * a shooting star now and then at night.
// Colours and positions are driven by world/environment.js through apply().

// Cloud atlas: four 256 px cumulus shapes made from blobs eroded by fractal
// noise, lit from the upper left with lavender-pink shaded undersides.
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const random = seeded(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255;
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    const u = fade(xf);
    const v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 5; o += 1) {
      sum += value(x * freq, y * freq) * amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };
}

function cloudAtlas() {
  const cell = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = cell * 2;
  const g = canvas.getContext("2d");
  const lit = [255, 253, 250];
  const shade = [196, 186, 226];
  const blush = [246, 196, 222];
  for (let k = 0; k < 4; k += 1) {
    const noise = makeNoise(101 + k * 37);
    const random = seeded(7 + k * 13);
    // Cumulus silhouette: a row of big puffs on a flat-ish base.
    const blobs = [];
    const count = 5 + k;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const x = 0.18 + t * 0.64 + (random() - 0.5) * 0.08;
      const r = 0.13 + random() * 0.1 + Math.sin(t * Math.PI) * 0.1;
      blobs.push([x, 0.62 - r * 0.55 - Math.sin(t * Math.PI) * 0.08, r]);
    }
    const density = (u, v) => {
      let d = 0;
      for (const [x, y, r] of blobs) {
        const dx = (u - x) / r;
        const dy = (v - y) / r;
        d = Math.max(d, 1 - (dx * dx + dy * dy));
      }
      d *= Math.min(1, Math.max(0, (0.74 - v) / 0.12)); // soft flat base
      const n = noise(u * 7 + k * 3, v * 7);
      return Math.max(0, d * 1.25 - (1 - n) * 0.62);
    };
    const image = g.createImageData(cell, cell);
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const u = x / cell;
        const v = y / cell;
        const d = density(u, v);
        const i = (y * cell + x) * 4;
        if (d <= 0.001) {
          image.data[i + 3] = 0;
          continue;
        }
        // Self-shadowing toward the light (upper left) plus a height gradient.
        const towardLight = density(u - 0.03, v - 0.04);
        let light = 0.55 + (towardLight - d) * -1.6 + (0.62 - v) * 0.9;
        light = Math.min(1, Math.max(0, light));
        const under = Math.min(1, Math.max(0, (v - 0.45) * 3));
        for (let c = 0; c < 3; c += 1) {
          const dark = shade[c] * (1 - under * 0.5) + blush[c] * under * 0.5;
          image.data[i + c] = dark + (lit[c] - dark) * light;
        }
        image.data[i + 3] = Math.min(255, Math.max(0, (d - 0.02) * 520));
      }
    }
    g.putImageData(image, (k % 2) * cell, Math.floor(k / 2) * cell);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color("#3f8ae6") },
      uMid: { value: new THREE.Color("#8fc2f7") },
      uHorizon: { value: new THREE.Color("#f2e6f6") },
      uBelow: { value: new THREE.Color("#7fb6f0") },
      uSunDir: { value: new THREE.Vector3(-0.55, 0.42, -0.72).normalize() },
      uSunColor: { value: new THREE.Color("#ffdcb8") },
      uSunAmount: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(0.5, 0.6, 0.6).normalize() },
      uMoonAmount: { value: 0 },
      uStars: { value: 0 },
      uRainbow: { value: 0 },
      uOvercast: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(p.xy, p.w * 0.99995, p.w);
      }`,
    fragmentShader: `
      uniform vec3 uZenith, uMid, uHorizon, uBelow, uSunDir, uSunColor, uMoonDir;
      uniform float uSunAmount, uMoonAmount, uStars, uRainbow, uOvercast, uTime;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0 + i.z * 113.0;
        #define H(o) fract(sin(n + o) * 43758.5453)
        return mix(mix(mix(H(0.0), H(1.0), f.x), mix(H(57.0), H(58.0), f.x), f.y),
                   mix(mix(H(113.0), H(114.0), f.x), mix(H(170.0), H(171.0), f.x), f.y), f.z);
      }
      vec3 spectrum(float t) {
        // t: 0 violet (inner edge) … 1 red (outer edge).
        float hue = (1.0 - t) * 0.75;
        return clamp(vec3(abs(hue * 6.0 - 3.0) - 1.0, 2.0 - abs(hue * 6.0 - 2.0), 2.0 - abs(hue * 6.0 - 4.0)), 0.0, 1.0);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uZenith, smoothstep(0.2, 0.85, h));
        c = mix(c, uBelow, smoothstep(0.0, -0.3, h));

        // Sun: disc, halo and a warm glow across the horizon it sits on.
        float sd = max(dot(d, uSunDir), 0.0);
        float clear = 1.0 - uOvercast * 0.85;
        c += uSunColor * uSunAmount * clear * (pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.1);
        c += uSunColor * uSunAmount * clear * smoothstep(0.9993, 0.9997, sd) * 1.6;
        float lowSun = 1.0 - smoothstep(0.0, 0.35, uSunDir.y);
        c += uSunColor * uSunAmount * lowSun * pow(max(0.0, 1.0 - abs(h) * 3.0), 3.0) * pow(sd, 1.5) * 0.35 * clear;

        // Night: stars, a faint Milky Way band and the moon.
        if (uStars > 0.01 && h > -0.05) {
          vec2 sc = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
          vec2 g = sc * vec2(95.0, 95.0);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float r = hash(id);
          vec2 jitter = vec2(hash(id + 7.1), hash(id + 3.7)) - 0.5;
          float star = step(0.972, r) * smoothstep(0.16, 0.0, length(f - jitter * 0.6));
          float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + r * 3.0) + r * 60.0);
          vec3 tint = mix(vec3(0.8, 0.86, 1.0), vec3(1.0, 0.9, 0.8), hash(id + 1.3));
          c += tint * star * twinkle * (0.6 + r * 1.8) * uStars * smoothstep(-0.05, 0.15, h) * clear;
          vec3 bandNormal = normalize(vec3(0.3, 0.25, 0.92));
          float band = exp(-pow(dot(d, bandNormal) / 0.2, 2.0));
          float dust = vnoise(d * 7.0) * 0.6 + vnoise(d * 15.0) * 0.4;
          c += vec3(0.55, 0.5, 0.9) * band * dust * 0.16 * uStars * clear;
        }
        if (uMoonAmount > 0.01) {
          float md = dot(d, uMoonDir);
          float disc = smoothstep(0.99955, 0.9998, md);
          float craters = 0.82 + 0.18 * vnoise(d * 260.0);
          c = mix(c, vec3(1.0, 0.97, 0.9) * craters, disc * uMoonAmount * clear);
          c += vec3(0.6, 0.66, 1.0) * pow(max(md, 0.0), 180.0) * 0.35 * uMoonAmount * clear;
        }

        // Rainbow: 40.5°–42.5° around the point opposite the sun.
        if (uRainbow > 0.01) {
          float ang = degrees(acos(clamp(dot(d, -uSunDir), -1.0, 1.0)));
          float t = (ang - 40.4) / 2.2;
          float inBand = smoothstep(-0.12, 0.08, t) * (1.0 - smoothstep(0.92, 1.12, t));
          vec3 bow = spectrum(clamp(t, 0.0, 1.0));
          float fadeFoot = smoothstep(-0.02, 0.12, h);
          c += bow * inBand * fadeFoot * uRainbow * 0.32;
          // Brighter sky inside the bow, as in the real thing.
          c += vec3(0.05) * smoothstep(40.6, 30.0, ang) * uRainbow * fadeFoot;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  dome.name = "Sky dome";
  return dome;
}

function makeShootingStar() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uFade: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uFade;
      varying vec2 vUv;
      void main() {
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float a = pow(vUv.x, 2.2) * pow(across, 2.0) * uFade;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = -6;
  return mesh;
}

export function createSky(scene, { quality = "high" } = {}) {
  const dome = makeDome();
  scene.add(dome);
  const domeUniforms = dome.material.uniforms;

  const atlas = cloudAtlas();
  const random = seeded(4242);
  const clouds = [];
  const scale = quality === "low" ? 0.65 : 1;
  const add = (count, make) => {
    for (let i = 0; i < Math.round(count * scale); i += 1) clouds.push(make(i));
  };
  // Sea of clouds below the island.
  add(64, () => {
    const a = random() * Math.PI * 2;
    const r = 5 + Math.pow(random(), 0.8) * 75;
    return { x: Math.cos(a) * r, y: -8 - r * 0.06 - random() * 3, z: Math.sin(a) * r - 4, size: 9 + r * 0.3 + random() * 9, cell: Math.floor(random() * 4), alpha: 1, speed: 0.12 + random() * 0.15 };
  });
  // Drifting clouds at island height, kept away from the gardens.
  add(14, () => {
    const a = random() * Math.PI * 2;
    const r = 16 + random() * 16;
    return { x: Math.cos(a) * r, y: -2.5 + random() * 5, z: Math.sin(a) * r - 3, size: 3.5 + random() * 4.5, cell: Math.floor(random() * 4), alpha: 0.9, speed: 0.2 + random() * 0.25 };
  });
  // High clouds that thicken when the weather turns.
  add(16, () => {
    const a = random() * Math.PI * 2;
    const r = 40 + random() * 60;
    return { x: Math.cos(a) * r, y: 24 + random() * 16, z: Math.sin(a) * r - 4, size: 22 + random() * 18, cell: Math.floor(random() * 4), alpha: 0.85, speed: 0.35 + random() * 0.3, overcast: true };
  });
  // Far horizon bank.
  add(20, (i) => {
    const a = (i / 20) * Math.PI * 2 + random() * 0.3;
    const r = 110 + random() * 40;
    return { x: Math.cos(a) * r, y: -14 + random() * 10, z: Math.sin(a) * r, size: 40 + random() * 25, cell: Math.floor(random() * 4), alpha: 1, speed: 0.3 };
  });

  const max = clouds.length + 16;
  const geometry = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  const center = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const params = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // size, cell, alpha, seed
  center.setUsage(THREE.DynamicDrawUsage);
  params.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aCenter", center);
  geometry.setAttribute("aParams", params);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uAtlas: { value: atlas },
      uHorizon: { value: new THREE.Color("#e3eefc") },
      uTint: { value: new THREE.Color("#ffffff") },
      uShadeTint: { value: new THREE.Color("#ffffff") },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aCenter;
      attribute vec4 aParams;
      uniform float uTime;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vFog;
      void main() {
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float size = aParams.x * (1.0 + 0.03 * sin(uTime * 0.3 + aParams.w));
        vec3 p = aCenter + (right * position.x + up * position.y * 0.62) * size;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float cell = aParams.y;
        vUv = (vec2(mod(cell, 2.0), floor(cell / 2.0)) + uv) * 0.5;
        float d = -mv.z;
        vAlpha = aParams.z * smoothstep(1.0, 5.0, d);
        vFog = smoothstep(90.0, 220.0, d);
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform vec3 uHorizon, uTint, uShadeTint;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vFog;
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
        vec3 col = t.rgb * mix(uShadeTint, uTint, smoothstep(0.72, 0.98, lum));
        gl_FragColor = vec4(mix(col, uHorizon, vFog * 0.65), a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  mesh.name = "Clouds";
  scene.add(mesh);

  const meteor = makeShootingStar();
  scene.add(meteor);
  let flight = null; // { from, to, t, duration }

  const order = [];
  const forward = new THREE.Vector3();
  const side = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  let overcast = 0;
  let coverage = 1;

  function puffs(list) {
    for (const item of list) if (clouds.length < max) clouds.push({ speed: 0, cell: Math.floor(random() * 4), alpha: 0.85, ...item });
  }

  return {
    // Little mist puffs (waterfall spray) join the same sorted batch.
    addPuffs: puffs,
    // state from the environment: colours, sun/moon, stars, rainbow, clouds.
    apply(state) {
      domeUniforms.uZenith.value.copy(state.zenith);
      domeUniforms.uMid.value.copy(state.mid);
      domeUniforms.uHorizon.value.copy(state.horizon);
      domeUniforms.uBelow.value.copy(state.below);
      domeUniforms.uSunDir.value.copy(state.sunDir);
      domeUniforms.uSunColor.value.copy(state.sunColor);
      domeUniforms.uSunAmount.value = state.sunAmount;
      domeUniforms.uMoonDir.value.copy(state.moonDir);
      domeUniforms.uMoonAmount.value = state.moonAmount;
      domeUniforms.uStars.value = state.stars;
      domeUniforms.uRainbow.value = state.rainbow;
      domeUniforms.uOvercast.value = state.overcast;
      material.uniforms.uTint.value.copy(state.cloudLit);
      material.uniforms.uShadeTint.value.copy(state.cloudShade);
      material.uniforms.uHorizon.value.copy(state.horizon);
      overcast = state.overcast;
      coverage = state.cloudCoverage ?? 1;
    },
    shootingStar(camera) {
      if (flight) return;
      const a = Math.random() * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a), 0.45 + Math.random() * 0.35, Math.sin(a)).normalize();
      const to = from.clone().add(new THREE.Vector3(Math.cos(a + 1.9), -0.18, Math.sin(a + 1.9)).multiplyScalar(0.28)).normalize();
      flight = { from, to, t: 0, duration: 0.9 + Math.random() * 0.5, camera };
      return from.clone();
    },
    update(camera, time, dt) {
      material.uniforms.uTime.value = time;
      domeUniforms.uTime.value = time;
      camera.getWorldDirection(forward);
      order.length = 0;
      clouds.forEach((cloud, index) => {
        if (cloud.speed) {
          cloud.x += cloud.speed * dt * (1 + overcast);
          if (Math.hypot(cloud.x, cloud.z) > 160) cloud.x -= 300;
        }
        const alpha = cloud.overcast ? cloud.alpha * overcast : cloud.alpha * coverage;
        if (alpha < 0.02) return;
        order.push([(cloud.x - camera.position.x) * forward.x + (cloud.y - camera.position.y) * forward.y + (cloud.z - camera.position.z) * forward.z, index, alpha]);
      });
      order.sort((a, b) => b[0] - a[0]);
      order.forEach(([, index, alpha], slot) => {
        const cloud = clouds[index];
        center.array.set([cloud.x, cloud.y + (cloud.bob ? Math.sin(time * 1.3 + index) * cloud.bob : 0), cloud.z], slot * 3);
        params.array.set([cloud.size, cloud.cell, alpha, index * 1.7], slot * 4);
      });
      center.needsUpdate = true;
      params.needsUpdate = true;
      geometry.instanceCount = order.length;
      dome.position.copy(camera.position);

      // Shooting star: a short bright streak across the far sky.
      if (flight) {
        flight.t += dt / flight.duration;
        const k = Math.min(1, flight.t);
        const head = flight.from.clone().lerp(flight.to, k).normalize().multiplyScalar(300).add(camera.position);
        const tail = flight.from.clone().lerp(flight.to, Math.max(0, k - 0.35)).normalize().multiplyScalar(300).add(camera.position);
        toCamera.subVectors(camera.position, head).normalize();
        side.subVectors(head, tail).cross(toCamera).normalize().multiplyScalar(0.9);
        const pos = meteor.geometry.attributes.position;
        pos.setXYZ(0, tail.x - side.x, tail.y - side.y, tail.z - side.z);
        pos.setXYZ(1, head.x - side.x, head.y - side.y, head.z - side.z);
        pos.setXYZ(2, tail.x + side.x, tail.y + side.y, tail.z + side.z);
        pos.setXYZ(3, head.x + side.x, head.y + side.y, head.z + side.z);
        pos.needsUpdate = true;
        meteor.material.uniforms.uFade.value = Math.sin(Math.PI * k);
        meteor.visible = true;
        if (flight.t >= 1) {
          flight = null;
          meteor.visible = false;
        }
      }
    },
    dispose() {
      scene.remove(dome, mesh, meteor);
      dome.geometry.dispose();
      dome.material.dispose();
      geometry.dispose();
      plane.dispose();
      material.dispose();
      atlas.dispose();
      meteor.geometry.dispose();
      meteor.material.dispose();
    },
  };
}

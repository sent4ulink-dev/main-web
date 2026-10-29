import * as THREE from 'three';
import { WIND_GLSL, wind } from './wind.js';
import { heightAt, fbm, noise2, rng } from './terrain.js';

const CELL = 9;          // metres per grass chunk (frustum-culled individually)
const RADIUS = 46;       // grass field radius around the picnic

function bladeGeometry(segments = 5) {
  const pos = [], idx = [];
  for (let i = 0; i < segments; i++) {
    const y = i / segments;
    pos.push(-0.5, y, 0, 0.5, y, 0);
  }
  pos.push(0, 1, 0); // tip
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2;
  idx.push(last, last + 1, segments * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Blade density (per m²) by distance from the picnic centre. */
function density(r) {
  if (r < 7) return 430;
  if (r < 16) return THREE.MathUtils.lerp(430, 130, (r - 7) / 9);
  return THREE.MathUtils.lerp(130, 22, Math.min(1, (r - 16) / (RADIUS - 16)));
}

export class Grass {
  /**
   * @param exclude (x,z) => 0..1 multiplier on blade height (0 removes the blade), e.g. under the table
   */
  constructor(scene, { exclude = () => 1, sunDir, sunColor }) {
    this.uniforms = {
      uSunDir: { value: sunDir || new THREE.Vector3(0.3, 0.5, 0.3) },
      uSunColor: { value: sunColor || new THREE.Color(1, 0.9, 0.7) },
      uTranslucency: { value: 1 },
    };
    const base = bladeGeometry(4);
    this.material = this._material();
    this.meshes = [];
    const rand = rng(1234);
    let total = 0;

    for (let cx = -RADIUS; cx < RADIUS; cx += CELL) {
      for (let cz = -RADIUS; cz < RADIUS; cz += CELL) {
        const ccx = cx + CELL / 2, ccz = cz + CELL / 2;
        const rc = Math.hypot(ccx, ccz);
        if (rc > RADIUS + CELL * 0.7) continue;
        const n = Math.round(density(rc) * CELL * CELL);
        const offsets = new Float32Array(n * 3);
        const params = new Float32Array(n * 4);
        let k = 0;
        for (let i = 0; i < n; i++) {
          const x = cx + rand() * CELL, z = cz + rand() * CELL;
          const r = Math.hypot(x, z);
          if (r > RADIUS) continue;
          if (rand() > density(r) / density(rc) * 1.05) continue;
          let keep = exclude(x, z);
          if (keep <= 0.02) continue;
          const field = fbm(x * 0.09 + 11.3, z * 0.09 - 4.2, 3);
          const tufts = noise2(x * 0.7, z * 0.7);
          let h = 0.13 + field * 0.34 + tufts * 0.12 + rand() * 0.1;
          h *= THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.smoothstep(r, 3.5, 7.5)) * keep;
          h *= 0.25 + 0.75 * THREE.MathUtils.smoothstep(r, RADIUS, RADIUS - 12); // fade the field edge
          const w = (0.009 + rand() * 0.008) * (1 + r / 9);
          offsets[k * 3] = x; offsets[k * 3 + 1] = heightAt(x, z) - 0.01; offsets[k * 3 + 2] = z;
          params[k * 4] = h; params[k * 4 + 1] = w; params[k * 4 + 2] = rand() * Math.PI * 2; params[k * 4 + 3] = rand();
          k++;
        }
        if (!k) continue;
        // shuffle order is already random → drawing the first N instances thins evenly
        const geo = new THREE.InstancedBufferGeometry();
        geo.index = base.index;
        geo.setAttribute('position', base.attributes.position);
        geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets.subarray(0, k * 3), 3));
        geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(params.subarray(0, k * 4), 4));
        geo.instanceCount = k;
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ccx, heightAt(ccx, ccz) + 0.3, ccz), CELL * 0.75 + 1);
        geo.boundingBox = new THREE.Box3().setFromCenterAndSize(geo.boundingSphere.center, new THREE.Vector3(CELL + 2, 3, CELL + 2));
        const mesh = new THREE.Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.userData.full = k;
        mesh.name = 'grass';
        scene.add(mesh);
        this.meshes.push(mesh);
        total += k;
      }
    }
    this.total = total;
    this.setDensity(1);
  }

  /** 0..1 — draw a fraction of blades (adaptive quality). */
  setDensity(f) {
    this.densityFactor = f;
    for (const m of this.meshes) m.geometry.instanceCount = Math.max(1, Math.floor(m.userData.full * f));
  }

  _material() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const U = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, wind.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          ${WIND_GLSL}
          attribute vec3 aOffset;
          attribute vec4 aParams;
          varying float vGT;
          varying float vGSeed;
          varying vec3 vGWorld;`)
        .replace('#include <beginnormal_vertex>', `
          float gYaw = aParams.z;
          vec3 gSide = vec3(cos(gYaw), 0.0, sin(gYaw));
          vec3 gFace = vec3(-sin(gYaw), 0.0, cos(gYaw));
          vec3 objectNormal = normalize(mix(gFace + gSide * position.x * 1.4, vec3(0.0, 1.0, 0.0), 0.3));`)
        .replace('#include <begin_vertex>', `
          float gH = aParams.x, gW = aParams.y, gSeed = aParams.w;
          float gT = position.y;
          float gLean = (0.04 + 0.22 * fract(gSeed * 7.13)) * gH;
          vec3 transformed = gSide * position.x * gW * (1.0 - pow(gT, 1.7) * 0.86)
                           + vec3(0.0, gT * gH, 0.0)
                           + gFace * gLean * gT * gT
                           + aOffset;
          // a soft sway, not a gale: smaller bend and less flutter
          transformed += windDisplace(transformed, gT * gT, gSeed, 0.18) * (0.32 + gH * 0.5);
          vGT = gT; vGSeed = gSeed; vGWorld = transformed;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vGT;
          varying float vGSeed;
          varying vec3 vGWorld;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          uniform float uTranslucency;`)
        .replace('#include <color_fragment>', `
          float s1 = fract(vGSeed * 13.7), s2 = fract(vGSeed * 91.3);
          vec3 baseC = mix(vec3(0.05, 0.14, 0.035), vec3(0.08, 0.19, 0.05), s1);
          vec3 tipC  = mix(vec3(0.24, 0.5, 0.1), vec3(0.42, 0.64, 0.17), s2);
          vec3 gc = mix(baseC, tipC, smoothstep(0.0, 1.0, vGT));
          if (s2 > 0.96) gc = mix(gc, vec3(0.62, 0.66, 0.22), 0.6 * vGT); // a few sunny-yellow blades
          diffuseColor.rgb = gc * mix(0.55, 1.0, smoothstep(0.0, 0.4, vGT));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec3 gView = normalize(vGWorld - cameraPosition);
          float back = pow(max(dot(gView, normalize(uSunDir)), 0.0), 5.0);
          totalEmissiveRadiance += uSunColor * diffuseColor.rgb * back * vGT * 1.5 * uTranslucency;`);
    };
    mat.customProgramCacheKey = () => 'grass-v4';
    return mat;
  }
}

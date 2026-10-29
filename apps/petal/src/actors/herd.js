import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useEnvironment, ENV_GLSL } from "../core/uniforms.js";

// Instanced animals with animated parts, one draw call per species.
//
// Every vertex carries the id of the part it belongs to (body, head, ears,
// wings, tail, legs, eyes…). Each animal instance carries eight animation
// channels (two vec4s). The vertex shader rotates each part around its pivot
// by up to two channels (e.g. head yaw + pitch), then by its parent's
// rotation (ears follow the head), or scales it (blinking eyelids, a puffing
// throat). The CPU only writes eight numbers per animal per frame.

export const MAX_PARTS = 10;

// Tag a geometry with a part id (and vertex colours if it has none).
export function part(id, geometry) {
  const count = geometry.attributes.position.count;
  geometry.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(count).fill(id), 1));
  return geometry;
}

export function partGeometry(pieces) {
  const merged = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  return merged;
}

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// parts: [{ pivot: [x,y,z], a?: [axis, channel, gain], b?: [axis, channel, gain],
//           parent?: partId, kind?: "rotate" | "blink" | "puff" }]
function animatedMaterial(parts, { emissive = null } = {}) {
  const n = MAX_PARTS;
  const pivot = [];
  const axisA = [];
  const axisB = [];
  const chanA = new Float32Array(n).fill(-1);
  const chanB = new Float32Array(n).fill(-1);
  const gainA = new Float32Array(n).fill(1);
  const gainB = new Float32Array(n).fill(1);
  const parent = new Float32Array(n).fill(-1);
  const kind = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const spec = parts[i] || {};
    pivot.push(new THREE.Vector3(...(spec.pivot || [0, 0, 0])));
    axisA.push(new THREE.Vector3(...AXES[spec.a?.[0] || "y"]));
    axisB.push(new THREE.Vector3(...AXES[spec.b?.[0] || "x"]));
    if (spec.a) {
      chanA[i] = spec.a[1];
      gainA[i] = spec.a[2] ?? 1;
    }
    if (spec.b) {
      chanB[i] = spec.b[1];
      gainB[i] = spec.b[2] ?? 1;
    }
    if (spec.parent !== undefined) parent[i] = spec.parent;
    kind[i] = spec.kind === "blink" ? 1 : spec.kind === "puff" ? 2 : 0;
  }
  const uniforms = {
    uPivot: { value: pivot }, uAxisA: { value: axisA }, uAxisB: { value: axisB },
    uChanA: { value: Array.from(chanA) }, uChanB: { value: Array.from(chanB) },
    uGainA: { value: Array.from(gainA) }, uGainB: { value: Array.from(gainB) },
    uParent: { value: Array.from(parent) }, uKind: { value: Array.from(kind) },
  };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (emissive) {
    material.emissive = new THREE.Color(emissive.color);
    material.emissiveIntensity = emissive.intensity;
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    useEnvironment(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        ${ENV_GLSL}
        #define PARTS ${n}
        attribute float aPart;
        attribute vec4 aAnimA;
        attribute vec4 aAnimB;
        uniform vec3 uPivot[PARTS];
        uniform vec3 uAxisA[PARTS];
        uniform vec3 uAxisB[PARTS];
        uniform float uChanA[PARTS];
        uniform float uChanB[PARTS];
        uniform float uGainA[PARTS];
        uniform float uGainB[PARTS];
        uniform float uParent[PARTS];
        uniform float uKind[PARTS];
        float herdChannel(float i) {
          if (i < -0.5) return 0.0;
          if (i < 0.5) return aAnimA.x;
          if (i < 1.5) return aAnimA.y;
          if (i < 2.5) return aAnimA.z;
          if (i < 3.5) return aAnimA.w;
          if (i < 4.5) return aAnimB.x;
          if (i < 5.5) return aAnimB.y;
          if (i < 6.5) return aAnimB.z;
          return aAnimB.w;
        }
        vec3 herdRotate(vec3 v, vec3 axis, float angle) {
          float c = cos(angle), s = sin(angle);
          return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
        }
        // Rotate by one part's own channels (point: w = 1, direction: w = 0).
        vec3 herdPart(vec3 v, int id, float w) {
          vec3 pivot = uPivot[id] * w;
          vec3 p = v - pivot;
          p = herdRotate(p, uAxisB[id], herdChannel(uChanB[id]) * uGainB[id]);
          p = herdRotate(p, uAxisA[id], herdChannel(uChanA[id]) * uGainA[id]);
          return p + pivot;
        }
        vec3 herdAnimate(vec3 v, float w) {
          int id = int(aPart + 0.5);
          float kind = uKind[id];
          if (kind > 1.5) {
            v = (v - uPivot[id] * w) * (1.0 + herdChannel(uChanA[id]) * uGainA[id]) + uPivot[id] * w;
          } else if (kind > 0.5) {
            float lid = clamp(1.0 - herdChannel(uChanA[id]), 0.08, 1.0);
            v.y = (v.y - uPivot[id].y * w) * (w > 0.5 ? lid : 1.0) + uPivot[id].y * w;
          } else {
            v = herdPart(v, id, w);
          }
          float parentId = uParent[id];
          if (parentId > -0.5) v = herdPart(v, int(parentId + 0.5), w);
          return v;
        }`)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(herdAnimate(objectNormal, 0.0));")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = herdAnimate(transformed, 1.0);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${ENV_GLSL}`)
      .replace("#include <dithering_fragment>", "gl_FragColor.rgb *= 1.0 - uWet * 0.08;\n#include <dithering_fragment>");
  };
  material.customProgramCacheKey = () => `herd-${JSON.stringify(parts)}`;
  return material;
}

// A species: count instances of one part-tagged geometry.
export function createHerd(scene, { name, geometry, parts, count, tints = ["#ffffff"], emissive = null }) {
  const material = animatedMaterial(parts, { emissive });
  const channelsA = new Float32Array(count * 4);
  const channelsB = new Float32Array(count * 4);
  const animA = new THREE.InstancedBufferAttribute(channelsA, 4);
  const animB = new THREE.InstancedBufferAttribute(channelsB, 4);
  animA.setUsage(THREE.DynamicDrawUsage);
  animB.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aAnimA", animA);
  geometry.setAttribute("aAnimB", animB);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = `Animals • ${name}`;
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) mesh.setColorAt(i, color.set(tints[i % tints.length]));
  scene.add(mesh);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  return {
    mesh,
    count,
    // Place instance i: position, heading (yaw), optional pitch / roll and squash.
    place(i, position, yaw, { pitch = 0, roll = 0, scale = 1, squash = 1 } = {}) {
      dummy.position.copy(position);
      dummy.rotation.set(pitch, yaw, roll);
      const s = Math.max(1e-4, scale);
      dummy.scale.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    },
    hide(i) {
      dummy.scale.setScalar(1e-4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    },
    // Eight animation channels for instance i.
    animate(i, c0 = 0, c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, c6 = 0, c7 = 0) {
      channelsA[i * 4] = c0;
      channelsA[i * 4 + 1] = c1;
      channelsA[i * 4 + 2] = c2;
      channelsA[i * 4 + 3] = c3;
      channelsB[i * 4] = c4;
      channelsB[i * 4 + 1] = c5;
      channelsB[i * 4 + 2] = c6;
      channelsB[i * 4 + 3] = c7;
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      animA.needsUpdate = true;
      animB.needsUpdate = true;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}

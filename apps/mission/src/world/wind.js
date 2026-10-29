import * as THREE from 'three';

// One wind for the whole meadow. Grass, leaves, cloth and the wind audio all read from it,
// so a gust you see rolling across the field is the same gust you hear in the trees.
export const wind = {
  uniforms: {
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.86, 0.51).normalize() },
    uWindStrength: { value: 0.42 },
    uGust: { value: 0.5 },
  },
  base: 0.42,   // a gentle evening breeze
  gust: 0.5,     // 0..1, slow-moving envelope (also drives audio)
  boost: 0,      // temporary extra wind (e.g. blowing out candles)

  update(t, dt) {
    // Layered slow oscillators give organic, non-repeating gusts.
    const g = 0.5
      + 0.28 * Math.sin(t * 0.21 + 1.3)
      + 0.17 * Math.sin(t * 0.47 + 0.4)
      + 0.10 * Math.sin(t * 1.13 + 2.1);
    this.gust = THREE.MathUtils.clamp(g, 0, 1);
    this.boost = Math.max(0, this.boost - dt * 0.6);
    this.uniforms.uTime.value = t;
    this.uniforms.uGust.value = this.gust;
    this.uniforms.uWindStrength.value = this.base * (0.82 + 0.32 * this.gust) + this.boost;
    // direction slowly veers ±12°
    const a = 0.54 + 0.2 * Math.sin(t * 0.05);
    this.uniforms.uWindDir.value.set(Math.cos(a), Math.sin(a));
  },
};

export const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uGust;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// World-space wind offset for a vertex. flex: 0 = rigid, 1 = fully flexible tip.
vec3 windDisplace(vec3 wpos, float flex, float phase, float flutterAmt) {
  vec2 side = vec2(-uWindDir.y, uWindDir.x);
  float travel = dot(wpos.xz, uWindDir);
  float rolling = wNoise(vec2(travel * 0.09 - uTime * 0.62, dot(wpos.xz, side) * 0.06));
  float sway = uWindStrength * (0.30 + 1.05 * rolling * (0.35 + uGust) + 0.18 * sin(uTime * 1.4 + phase * 6.2831 + travel * 0.7));
  float flutter = flutterAmt * uWindStrength * (sin(uTime * 8.7 + phase * 41.0 + wpos.y * 4.0) * 0.55 + sin(uTime * 13.3 + phase * 17.0) * 0.3);
  vec2 d = uWindDir * (sway + flutter * 0.35) + side * flutter * 0.65;
  vec3 off = vec3(d.x, 0.0, d.y) * flex;
  off.y -= dot(d, d) * flex * 0.18;
  return off;
}
`;

const FLEX = {
  // small plants: bend grows with real-world height above the plant's base
  plant: 'pow(clamp((wPos.y - wOrigin.y) / uFlexH, 0.0, 1.0), uFlexP) * uFlexA',
  // trees: tall and far from the trunk bends most
  tree: 'pow(clamp(transformed.y / uFlexH, 0.0, 1.0), uFlexP) * uFlexA * (0.35 + 0.65 * clamp(length(transformed.xz) / uFlexR, 0.0, 1.0))',
  // hanging cloth: everything below the table top edge sways, more the lower it hangs
  hang: 'clamp((uFlexH - wPos.y) / uFlexR, 0.0, 1.0) * uFlexA',
  // rigid parts that ride on a swaying stem (flower heads)
  rigid: 'uFlexA',
  // flat cloth on the ground: edges lift a little
  edge: 'uFlexA * smoothstep(uFlexR, 0.5, max(abs(vUvW.x - 0.5), abs(vUvW.y - 0.5)))',
};

/**
 * Adds wind sway to any built-in material via onBeforeCompile.
 * Also builds a matching depth material so shadows move with the leaves.
 */
export function patchWind(material, opts = {}) {
  const { mode = 'plant', height = 1, power = 1.6, amount = 0.25, radius = 1, flutter = 0.15, phaseScale = 1 } = opts;
  const extra = {
    uFlexH: { value: height }, uFlexP: { value: power }, uFlexA: { value: amount },
    uFlexR: { value: radius }, uFlutter: { value: flutter }, uPhaseScale: { value: phaseScale },
  };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, wind.uniforms, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nuniform float uFlexH, uFlexP, uFlexA, uFlexR, uFlutter, uPhaseScale;`)
      .replace('#include <project_vertex>', /* glsl */ `
        vec4 mvPosition = vec4(transformed, 1.0);
        vec3 wOrigin = modelMatrix[3].xyz;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          wOrigin = (modelMatrix * instanceMatrix[3]).xyz;
        #endif
        vec4 wPos = modelMatrix * mvPosition;
        ${mode === 'edge' ? 'vec2 vUvW = uv;' : ''}
        float wFlex = ${FLEX[mode]};
        float wPhase = wHash(floor(wOrigin.xz * 3.0)) + dot(transformed, vec3(0.37, 0.11, 0.53)) * uPhaseScale;
        wPos.xyz += windDisplace(wPos.xyz, wFlex, wPhase, uFlutter);
        mvPosition = viewMatrix * wPos;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
  material.customProgramCacheKey = () => `wind-${mode}-${material.type}`;
  material.userData.wind = extra;
  return extra;
}

/** Depth material for shadow casting that sways in sync with a wind-patched material. */
export function windDepthMaterial(source, opts) {
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: source.map || null,
    alphaMap: source.alphaMap || null,
    alphaTest: source.alphaTest || 0,
    side: source.side,
  });
  patchWind(depth, opts);
  return depth;
}

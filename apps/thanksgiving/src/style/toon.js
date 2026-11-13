import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Storybook look: soft 3-band toon shading, a warm rim glow and ink outlines on props (and on the family,
// drawn as instanced parts with their own colours: crowdMaterial).

function makeRamp(stops) {
  const w = 64;
  const data = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    let v = stops[0][1];
    for (let k = 0; k < stops.length - 1; k++) {
      const [t0, v0] = stops[k], [t1, v1] = stops[k + 1];
      if (t >= t0 && t <= t1) {
        // soft step between bands
        const s = THREE.MathUtils.smoothstep((t - t0) / (t1 - t0), 0.42, 0.58);
        v = v0 + (v1 - v0) * s;
      }
    }
    const b = Math.round(v * 255);
    data.set([b, b, b, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export const gradientMap = makeRamp([[0, 0.38], [0.35, 0.38], [0.36, 0.7], [0.7, 0.7], [0.71, 1.0], [1, 1.0]]);

export const rim = {
  color: { value: new THREE.Color(1.0, 0.78, 0.86) },
  strength: { value: 0.28 },
};

/** Toon material with a fresnel rim glow (shared rim uniforms so the mood can change globally). */
export function toonMaterial(params = {}, { rimScale = 1 } = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap, ...params });
  const rs = { value: rimScale };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = rim.color;
    sh.uniforms.uRimStrength = rim.strength;
    sh.uniforms.uRimScale = rs;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength; uniform float uRimScale;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight += uRimColor * rimF * uRimStrength * uRimScale * (0.35 + 0.65 * diffuseColor.rgb);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'toon-rim';
  m.userData.rimScale = rs;
  return m;
}

const outlineVert = /* glsl */ `
uniform float uWidth;
void main() {
  #ifdef USE_INSTANCING
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
  #else
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
  #endif
  mv.xyz += n * uWidth * clamp(-mv.z, 0.4, 6.0);
  gl_Position = projectionMatrix * mv;
}`;
const outlineFrag = /* glsl */ `
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }`;

const outlineMats = new Map();
export function outlineMaterial(width, color = 0x2a1a1e) {
  const key = `${width}-${color}`;
  if (!outlineMats.has(key)) {
    outlineMats.set(key, new THREE.ShaderMaterial({
      vertexShader: outlineVert, fragmentShader: outlineFrag, side: THREE.BackSide,
      uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(color) } },
    }));
  }
  return outlineMats.get(key);
}

const hullCache = new WeakMap();
/** The outline's own copy of a shape: welded, with smooth normals (so hard edges don't crack). */
export function hullGeometry(geometry) {
  let geo = hullCache.get(geometry);
  if (!geo) {
    // copy positions into a plain float array (meshopt/quantized glTF attributes are interleaved or packed)
    const src = geometry.attributes.position;
    const arr = new Float32Array(src.count * 3);
    for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (geometry.index) geo.setIndex(geometry.index);
    geo = mergeVertices(geo, 1e-4);
    geo.computeVertexNormals();
    hullCache.set(geometry, geo);
  }
  return geo;
}

/** Inverted-hull outline (smooth normals so hard edges don't crack). */
export function addOutline(mesh, width = 0.0028, color = 0x2a1a1e) {
  if (!mesh.isMesh || mesh.userData.outline || mesh.userData.isOutline) return;
  const geo = hullGeometry(mesh.geometry);
  const hull = new THREE.Mesh(geo, outlineMaterial(width, color));
  hull.name = `${mesh.name}-outline`;
  hull.raycast = () => {};
  hull.userData.isOutline = true;
  hull.renderOrder = -1;
  mesh.add(hull);
  mesh.userData.outline = hull;
}

/**
 * Convert every material under `root` to toon shading, keeping colour, textures and transparency.
 * opts.outline adds ink outlines; opts.tint multiplies colours; opts.keepMaps=false drops photo textures.
 */
export function toonify(root, { outline = false, width, outlineColor, tint = null, keepMaps = true, rimScale = 1, cast = true, receive = true, skip = () => false } = {}) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || skip(o)) return;
    const conv = (src) => {
      if (cache.has(src)) return cache.get(src);
      if (src.isShaderMaterial) return src;
      const color = (src.color ? src.color.clone() : new THREE.Color(1, 1, 1));
      if (tint) color.multiply(tint);
      const m = toonMaterial({
        color,
        map: keepMaps ? src.map : null,
        transparent: src.transparent,
        opacity: src.opacity,
        alphaTest: src.alphaTest,
        side: src.side,
        emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0, 0, 0),
        emissiveIntensity: src.emissiveIntensity ?? 1,
        depthWrite: src.depthWrite,
        vertexColors: src.vertexColors,
      }, { rimScale });
      m.name = src.name;
      cache.set(src, m);
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = cast; o.receiveShadow = receive;
    if (outline) addOutline(o, width, outlineColor);
  });
  return root;
}

/**
 * The family's material: toon shading where each vertex colour says what it is — alpha 1: take this
 * character's colour for the part (skin, hair, outfit; the RGB is a shade of it), alpha 0: a fixed colour.
 * The character's colour comes per instance (InstancedMesh.setColorAt).
 */
export function crowdMaterial() {
  const m = new THREE.MeshToonMaterial({ gradientMap, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = rim.color;
    sh.uniforms.uRimStrength = rim.strength;
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      #if defined( USE_COLOR_ALPHA )
        vColor = color;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(color.rgb, color.rgb * instanceColor.rgb, step(0.5, color.a));
        #endif
        vColor.a = 1.0;
      #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        vColor = vec3(1.0);
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
      #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength;')
      .replace('#include <opaque_fragment>', `
        float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight += uRimColor * rimF * uRimStrength * (0.35 + 0.65 * diffuseColor.rgb);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'crowd';
  return m;
}

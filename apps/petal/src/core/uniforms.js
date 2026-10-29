import * as THREE from "three";

// Shader uniforms shared by every material on the island. One object is
// updated once per frame (clock, wind, weather, daylight) and every shader
// that includes these names reads the same values — no per-material updates.
export const environment = {
  uTime: { value: 0 },
  // Wind strength (0 calm … 1 breeze … 2.5 gusty) and direction in xz.
  uWind: { value: 1 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
  // 0 dry … 1 soaked (rain darkens and cools surfaces).
  uWet: { value: 0 },
  // 0 … 1 snow settling on upward-facing surfaces.
  uSnow: { value: 0 },
  // 0 day … 1 deep night.
  uNight: { value: 0 },
  // Soft rim light colour for characters (follows the sky).
  uRim: { value: new THREE.Color("#ffe0ee") },
  // Where the player stands (flowers and grass bend away from it).
  uPlayer: { value: new THREE.Vector3(0, -100, 0) },
  // Animals near the player: flowers part around them too (xyz, radius).
  uPushers: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, -100, 0, 0)) },
  // The horizon colour (water reflects it) and the direction to the sun.
  uHorizon: { value: new THREE.Color("#f2e6f6") },
  uSunDir: { value: new THREE.Vector3(-0.5, 0.6, 0.6).normalize() },
};

// GLSL declarations for the uniforms above.
export const ENV_GLSL = `
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
uniform float uWet;
uniform float uSnow;
uniform float uNight;
uniform vec3 uRim;
uniform vec3 uPlayer;
uniform vec4 uPushers[6];
uniform vec3 uHorizon;
uniform vec3 uSunDir;
`;

// Attach the shared uniforms to a compiled shader.
export function useEnvironment(shader) {
  Object.assign(shader.uniforms, environment);
}

// Near fade: surfaces closer to the camera than `end` metres dissolve in a
// fine screen-door pattern (fully gone at `start`), so leaves, posts or ropes
// the camera pushes into never fill the screen. For lit materials, which
// have vViewPosition; it runs first in main() so hidden pixels cost nothing.
export function addNearFade(shader, start = 0.25, end = 0.6) {
  shader.fragmentShader = shader.fragmentShader.replace("void main() {", `float nearFadeNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
void main() {
  {
    float camDistance = length(vViewPosition);
    if (camDistance < ${end.toFixed(3)} && nearFadeNoise(gl_FragCoord.xy) > smoothstep(${start.toFixed(3)}, ${end.toFixed(3)}, camDistance)) discard;
  }`);
}

import * as THREE from "three";

// Small geometry helpers shared by the procedural models: every part is
// vertex-coloured so whole characters merge into a single draw call.

export function colored(geometry, color) {
  const c = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  return geometry;
}
export function sphere(radius, color, [x, y, z], [sx, sy, sz] = [1, 1, 1], detail = 14) {
  const g = new THREE.SphereGeometry(radius, detail, Math.round(detail * 0.75));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return colored(g, color);
}
export function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(60,40,80,0.45)");
  gradient.addColorStop(1, "rgba(60,40,80,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

import * as THREE from "three";

// A point on a mesh at texture coordinates (u, v), in world space: the
// triangle that holds (u, v) is found, then the point is interpolated in it.
export function pointAt(mesh, u, v) {
  const { position, uv, normal } = mesh.geometry.attributes;
  const index = mesh.geometry.index;
  const corner = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const count = index ? index.count / 3 : position.count / 3;
  let best = null;
  for (let t = 0; t < count; t += 1) {
    const a = corner(t, 0), b = corner(t, 1), c = corner(t, 2);
    const ua = uv.getX(a), va = uv.getY(a), ub = uv.getX(b), vb = uv.getY(b), uc = uv.getX(c), vc = uv.getY(c);
    const d = (vb - vc) * (ua - uc) + (uc - ub) * (va - vc);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((vb - vc) * (u - uc) + (uc - ub) * (v - vc)) / d;
    const l2 = ((vc - va) * (u - uc) + (ua - uc) * (v - vc)) / d;
    const l3 = 1 - l1 - l2;
    const inside = Math.min(l1, l2, l3);
    if (!best || inside > best.inside) best = { inside, a, b, c, l1, l2, l3 };
  }
  const blend = (attribute) => new THREE.Vector3()
    .addScaledVector(new THREE.Vector3().fromBufferAttribute(attribute, best.a), best.l1)
    .addScaledVector(new THREE.Vector3().fromBufferAttribute(attribute, best.b), best.l2)
    .addScaledVector(new THREE.Vector3().fromBufferAttribute(attribute, best.c), best.l3);
  return {
    point: blend(position).applyMatrix4(mesh.matrixWorld),
    normal: normal ? blend(normal).transformDirection(mesh.matrixWorld) : null,
  };
}

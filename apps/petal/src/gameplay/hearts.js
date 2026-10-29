import * as THREE from "three";

// Twelve hidden hearts that spin and bob; walk into one to collect it.

export function createHearts({ scene, positions, found = new Set(), onFound = () => {} }) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  shape.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  shape.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  shape.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 8 });
  geometry.center();
  geometry.scale(0.28, 0.28, 0.28);
  const material = new THREE.MeshLambertMaterial({ color: "#ff7fab", emissive: "#ff4f8b", emissiveIntensity: 0.45 });
  const spots = positions.map((p) => new THREE.Vector3(...p));
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
  mesh.frustumCulled = false;
  mesh.name = "Hidden hearts";
  scene.add(mesh);
  const dummy = new THREE.Object3D();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const chest = new THREE.Vector3();

  return {
    positions: spots,
    found,
    get total() { return spots.length; },
    update(time, player) {
      spots.forEach((pos, i) => {
        if (found.has(i)) {
          mesh.setMatrixAt(i, zero);
          return;
        }
        dummy.position.copy(pos);
        dummy.position.y += Math.sin(time * 2 + i) * 0.08;
        dummy.rotation.set(0, time * 1.8 + i, 0);
        dummy.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.05);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (player && pos.distanceTo(chest.copy(player).add(new THREE.Vector3(0, 0.35, 0))) < 0.75) {
          found.add(i);
          onFound(i, pos);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}

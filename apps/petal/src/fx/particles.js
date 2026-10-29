import * as THREE from "three";

// Small shared particle effects: sparkles, floating hearts, water droplets,
// dust puffs, sleepy "z"s and ripple rings. A few pooled instanced draw calls.
const MAX = 220;

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  s.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  s.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  s.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  return new THREE.ShapeGeometry(s, 4);
}

function zShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.5);
  s.lineTo(0.5, 0.5);
  s.lineTo(0.5, 0.3);
  s.lineTo(-0.15, -0.3);
  s.lineTo(0.5, -0.3);
  s.lineTo(0.5, -0.5);
  s.lineTo(-0.5, -0.5);
  s.lineTo(-0.5, -0.3);
  s.lineTo(0.15, 0.3);
  s.lineTo(-0.5, 0.3);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export function createFx(scene) {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const make = (geometry, material) => {
    const mesh = new THREE.InstancedMesh(geometry, material, MAX);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.setColorAt(0, color.set("#ffffff"));
    scene.add(mesh);
    return mesh;
  };
  const hearts = make(heartShape(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }));
  const bits = make(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ toneMapped: false }));
  const puffs = make(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }));
  const zeds = make(zShape(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }));
  const pools = { heart: hearts, bit: bits, puff: puffs, zed: zeds };
  const ringMaterial = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const ringGeometry = new THREE.RingGeometry(0.42, 0.5, 28).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 10 }, () => {
    const mesh = new THREE.Mesh(ringGeometry, ringMaterial.clone());
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, life: 0, max: 1 };
  });
  // Footprints in snow and on wet ground: a ring buffer of flat ovals.
  const PRINTS = 48;
  const printGeometry = new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2);
  printGeometry.scale(0.07, 1, 0.11);
  const printMaterial = new THREE.MeshBasicMaterial({ color: "#8f86a8", transparent: true, opacity: 0.32, depthWrite: false });
  const prints = new THREE.InstancedMesh(printGeometry, printMaterial, PRINTS);
  prints.frustumCulled = false;
  prints.count = 0;
  prints.renderOrder = 1;
  scene.add(prints);
  const printData = [];
  let nextPrint = 0;
  const particles = [];
  const spawn = (kind, position, options) => {
    if (particles.length >= MAX * 2) particles.shift();
    particles.push({ kind, pos: position.clone(), life: 0, ...options });
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  return {
    sparkle(position, count = 14, tint = "#fff3a8") {
      for (let i = 0; i < count; i += 1) {
        spawn("bit", position, { vel: new THREE.Vector3(rand(-1.3, 1.3), rand(0.8, 2.4), rand(-1.3, 1.3)), max: rand(0.5, 0.9), size: rand(0.04, 0.07), gravity: 3, color: i % 3 ? tint : "#ffffff" });
      }
    },
    hearts(position, count = 6) {
      for (let i = 0; i < count; i += 1) {
        spawn("heart", position, { vel: new THREE.Vector3(rand(-0.35, 0.35), rand(0.6, 1.1), rand(-0.35, 0.35)), max: rand(1.1, 1.7), size: rand(0.1, 0.16), gravity: -0.1, color: ["#ff7fab", "#ffb3cf", "#ff5c95", "#d9b8ff"][i % 4] });
      }
    },
    splash(position, strength = 1) {
      const n = Math.round(22 * strength);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2, s = rand(0.6, 1.8) * strength;
        spawn("bit", position, { vel: new THREE.Vector3(Math.cos(a) * s, rand(1.5, 3.4) * strength, Math.sin(a) * s), max: rand(0.5, 0.8), size: rand(0.035, 0.06), gravity: 9, color: i % 3 ? "#bfeeff" : "#ffffff" });
      }
      this.ripple(position, 1.4 * strength);
      if (strength > 0.8) setTimeout(() => this.ripple(position, 1.0), 180);
    },
    ripple(position, size = 1) {
      const ring = rings.find((r) => r.life >= r.max) || rings[0];
      ring.mesh.position.copy(position).add(new THREE.Vector3(0, 0.03, 0));
      ring.life = 0;
      ring.max = 0.9;
      ring.size = size;
      ring.mesh.visible = true;
    },
    // Soft dust kicked up by a landing or a running step.
    dust(position, strength = 1) {
      const n = Math.round(5 + strength * 7);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(0.3, 0.9) * strength;
        spawn("puff", position, { vel: new THREE.Vector3(Math.cos(a) * s, rand(0.15, 0.5), Math.sin(a) * s), max: rand(0.45, 0.8), size: rand(0.07, 0.13) * (0.7 + strength * 0.4), gravity: -0.2, color: "#f1e6dc" });
      }
    },
    zzz(position) {
      spawn("zed", position, { vel: new THREE.Vector3(rand(0.05, 0.15), 0.35, 0), max: 1.8, size: rand(0.07, 0.1), gravity: -0.05, color: "#b9a8ff" });
    },
    footprint(position, heading, side = 1) {
      const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
      printData[nextPrint] = { pos: position.clone().addScaledVector(right, side * 0.07).add(new THREE.Vector3(0, 0.012, 0)), heading, life: 0 };
      nextPrint = (nextPrint + 1) % PRINTS;
    },
    // A firework: a spark rises, then bursts into a ring of colour.
    firework(position, tint) {
      const colors = [["#ff8fb8", "#ffd6e7"], ["#ffe08a", "#fff6d0"], ["#9fd4ff", "#e6f4ff"], ["#c9b2ff", "#f0e8ff"], ["#b8f0c4", "#effff2"]];
      const [main, light] = tint ? [tint, "#ffffff"] : colors[Math.floor(Math.random() * colors.length)];
      const start = position.clone().add(new THREE.Vector3(0, -7, 0));
      spawn("bit", start, { vel: new THREE.Vector3(0, 11.2, 0), max: 0.62, size: 0.12, gravity: 1, color: "#fff6d0" });
      setTimeout(() => {
        for (let i = 0; i < 46; i += 1) {
          const u = Math.random() * 2 - 1;
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u);
          const s = rand(4.2, 5.4);
          spawn("bit", position, { vel: new THREE.Vector3(Math.cos(a) * r * s, u * s, Math.sin(a) * r * s), max: rand(1.5, 2.1), size: rand(0.2, 0.3), gravity: 2.4, color: i % 3 ? main : light });
        }
        if (Math.random() < 0.5) this.hearts(position, 6);
      }, 620);
    },
    // A little puff of breath, out towards `toward` (panting after a few hops).
    breath(position, toward) {
      for (let i = 0; i < 2; i += 1) {
        const vel = toward.clone().multiplyScalar(rand(0.22, 0.38)).add(new THREE.Vector3(rand(-0.05, 0.05), rand(0.08, 0.16), rand(-0.05, 0.05)));
        spawn("puff", position, { vel, max: rand(0.45, 0.65), size: rand(0.035, 0.05), gravity: -0.1, color: "#ffffff" });
      }
    },
    // One big heart that swells up between two bunnies, ringed by little ones.
    bigHeart(position) {
      spawn("heart", position, { vel: new THREE.Vector3(0, 0.3, 0), max: 2.2, size: 0.5, gravity: -0.04, color: "#ff5c95" });
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        spawn("heart", position, {
          vel: new THREE.Vector3(Math.cos(a) * 1.1, 0.6 + Math.sin(a) * 0.9, rand(-0.2, 0.2)),
          max: rand(1.2, 1.7), size: rand(0.09, 0.14), gravity: 0.4, color: ["#ff7fab", "#ffb3cf", "#ffffff", "#d9b8ff"][i % 4],
        });
      }
    },
    confetti(position) {
      const tints = ["#ff8fb8", "#ffe08a", "#9fd4ff", "#c9b2ff", "#ffffff"];
      for (let i = 0; i < 60; i += 1) {
        const a = Math.random() * Math.PI * 2, s = rand(1, 3.2);
        spawn(i % 3 ? "bit" : "heart", position, { vel: new THREE.Vector3(Math.cos(a) * s, rand(3, 6), Math.sin(a) * s), max: rand(1.4, 2.2), size: i % 3 ? rand(0.05, 0.09) : rand(0.12, 0.2), gravity: 4, color: tints[i % tints.length] });
      }
    },
    update(dt, camera) {
      const used = { heart: 0, bit: 0, puff: 0, zed: 0 };
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
        p.vel.y -= p.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
        const t = p.life / p.max;
        const grow = p.kind === "puff" ? 0.6 + t * 0.9 : 1;
        const scale = p.size * grow * Math.sin(Math.PI * Math.min(1, t * 1.4 + 0.1));
        dummy.position.copy(p.pos);
        if (p.kind === "heart" || p.kind === "zed") {
          dummy.quaternion.copy(camera.quaternion);
          dummy.rotateZ(Math.sin(p.life * 3) * 0.3);
        } else dummy.rotation.set(p.life * 5, p.life * 4, 0);
        dummy.scale.setScalar(Math.max(0.0001, scale));
        dummy.updateMatrix();
        const mesh = pools[p.kind];
        const index = used[p.kind]++;
        if (index >= MAX) continue;
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.set(p.color));
      }
      for (const [kind, mesh] of Object.entries(pools)) mesh.count = Math.min(used[kind], MAX);
      for (const mesh of Object.values(pools)) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      let shown = 0;
      for (let i = 0; i < printData.length; i += 1) {
        const print = printData[i];
        if (!print) continue;
        print.life += dt;
        const fade = Math.max(0, 1 - Math.max(0, print.life - 9) / 3);
        if (fade <= 0) continue;
        dummy.position.copy(print.pos);
        dummy.rotation.set(0, print.heading, 0);
        dummy.scale.setScalar(fade);
        dummy.updateMatrix();
        prints.setMatrixAt(shown, dummy.matrix);
        shown += 1;
      }
      prints.count = shown;
      prints.instanceMatrix.needsUpdate = true;
      for (const ring of rings) {
        if (ring.life >= ring.max) {
          ring.mesh.visible = false;
          continue;
        }
        ring.life += dt;
        const t = ring.life / ring.max;
        ring.mesh.scale.setScalar(0.2 + t * ring.size);
        ring.mesh.material.opacity = 0.65 * (1 - t);
      }
    },
    dispose() {
      for (const mesh of Object.values(pools)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      rings.forEach((ring) => {
        scene.remove(ring.mesh);
        ring.mesh.material.dispose();
      });
      ringGeometry.dispose();
      scene.remove(prints);
      printGeometry.dispose();
      printMaterial.dispose();
    },
  };
}

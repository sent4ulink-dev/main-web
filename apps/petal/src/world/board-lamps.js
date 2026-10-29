import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored } from "../core/geometry.js";
import { environment } from "../core/uniforms.js";
import { pointAt } from "./surface.js";

// Picture lamps for the boards, so every choice can be read at night: a
// little brass lamp over each picture of the activity board and the treasure
// map, a clip-on lamp on each page of the keepsake book and a bracket lamp on
// the tree with the carved calendar. After dark the bulb glows, a soft beam
// falls from it and the picture is lit from the top down. No real lights
// (each would cost every material on the island): the pictures' own
// materials add the lamp's warm light.

const WARM = new THREE.Color("#ffd8a0");
const BRASS = "#b8935a";
const SHADE = "#d8b071"; // a brass hood, warm inside when lit
// Where each kind of board's lamp sits, from its picture's top edge (metres
// along the picture's up, and out of it): the head (out, rise) and where its
// arm is fixed (mount up the board, depth from the picture to the board's
// surface there, measured on the island).
const MOUNTS = {
  activity: { out: 0.2, rise: 0.07, mount: 0.3, depth: 0.018, arc: 0.07 }, // on the board's top rail
  // Low on the map, just above each picture: its title starts 12 cm up.
  map: { out: 0.22, rise: 0.05, mount: 0.07, depth: -0.048, arc: 0.02 },
  book: { out: 0.24, rise: 0.12, mount: 0.005, depth: -0.015, arc: 0.07, clip: true }, // clipped to the page's top
  // On the trunk above the carving (it is tall), whose cuts also glow gold
  // after dark, so the bottom rows read as well as the top.
  calendar: { out: 0.42, rise: 0.15, mount: 0.1, depth: -0.186, arc: 0.07, reach: 1.15, glow: ["#ffcf7a", 0.75] },
};
const kindOf = (name) => (name.includes("Activity") ? "activity" : name.includes("Map") ? "map" : name.includes("Book") ? "book" : "calendar");

// The lamp for one picture: where its head is, where it shines, its arm.
function planLamp(slot) {
  slot.updateMatrixWorld(true);
  const kind = kindOf(slot.name);
  const m = MOUNTS[kind];
  const top = pointAt(slot, 0.5, 0).point; // (the pictures' tops are at v = 0)
  const bottom = pointAt(slot, 0.5, 1).point;
  const middle = pointAt(slot, 0.5, 0.5);
  const up = bottom.clone().sub(top).negate().normalize();
  const across = pointAt(slot, 1, 0.5).point.sub(pointAt(slot, 0, 0.5).point).normalize();
  const out = across.clone().cross(up).normalize();
  if (middle.normal && out.dot(middle.normal) < 0) out.negate(); // out of the picture, towards whoever looks
  const height = top.distanceTo(bottom);
  const head = top.clone().addScaledVector(out, m.out).addScaledVector(up, m.rise);
  const aim = middle.point.clone().addScaledVector(up, height * 0.12);
  const dir = aim.clone().sub(head).normalize();
  // The whole picture sits inside the lamp's cone, with a soft edge round it.
  let widest = 1;
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    widest = Math.min(widest, pointAt(slot, u, v).point.sub(head).normalize().dot(dir));
  }
  return {
    kind, slot, head, dir, up, out, height, arc: m.arc,
    glow: m.glow ? new THREE.Color(m.glow[0]).multiplyScalar(m.glow[1]) : new THREE.Color(0, 0, 0),
    anchor: top.clone().addScaledVector(up, m.mount).addScaledVector(out, m.depth),
    clip: Boolean(m.clip),
    cone: new THREE.Vector2(widest - 0.08, Math.min(0.999, widest + 0.03)),
    reach: height * 0.9 * (m.reach ?? 1),
    beam: aim.distanceTo(head) * 0.9,
    spread: Math.min(0.45, height * 0.42),
  };
}

// The picture's own material adds the lamp's warm light (after dark): bright
// near the lamp at the top, softer towards the bottom.
function lightPicture(material, lamp) {
  const uniforms = {
    uLampPos: { value: lamp.head },
    uLampDir: { value: lamp.dir },
    uLampCone: { value: lamp.cone },
    uLampReach: { value: lamp.reach },
    uLampGlow: { value: lamp.glow },
    uNight: environment.uNight,
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLampWorld;\nvarying vec3 vLampNormal;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vLampWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vLampNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform vec3 uLampPos;
        uniform vec3 uLampDir;
        uniform vec2 uLampCone;
        uniform float uLampReach;
        uniform vec3 uLampGlow;
        uniform float uNight;
        varying vec3 vLampWorld;
        varying vec3 vLampNormal;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        {
          vec3 toPoint = vLampWorld - uLampPos;
          float lampDistance = length(toPoint);
          vec3 lampRay = toPoint / max(lampDistance, 1e-4);
          float cone = smoothstep(uLampCone.x, uLampCone.y, dot(lampRay, uLampDir));
          float fall = 1.0 / (1.0 + lampDistance * lampDistance / (uLampReach * uLampReach));
          float facing = 0.35 + 0.65 * abs(dot(normalize(vLampNormal), lampRay));
          totalEmissiveRadiance += diffuseColor.rgb * vec3(${WARM.r.toFixed(3)}, ${WARM.g.toFixed(3)}, ${WARM.b.toFixed(3)}) * (uNight * 1.3 * cone * fall * facing);
          totalEmissiveRadiance += uLampGlow * diffuseColor.a * uNight; // (the carved calendar's cuts)
        }`);
  };
  material.needsUpdate = true;
}

// A soft beam from the shade to the picture: brighter by the lamp, fading
// along and at its edges.
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: environment.uNight },
    vertexShader: `
      varying float vAlong;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vAlong = 1.0 - uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uNight;
      varying float vAlong;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));
        float glow = uNight * 0.13 * pow(1.0 - vAlong, 1.2) * smoothstep(0.05, 0.7, facing);
        gl_FragColor = vec4(${WARM.r.toFixed(3)}, ${WARM.g.toFixed(3)}, ${WARM.b.toFixed(3)}, glow);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Turns geometry built along +Y so that +Y runs along `axis`, then moves it.
function placeAlong(geometry, axis, at) {
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize()));
  geometry.translate(at.x, at.y, at.z);
  return geometry;
}

export function createBoardLamps({ scene, slots }) {
  const lamps = slots.map(planLamp);
  const group = new THREE.Group();
  group.name = "Board lamps";
  scene.add(group);

  const fixtures = [];
  const shades = [];
  const bulbs = [];
  const beams = [];
  // The shade: a small bell, narrow at the back where the arm meets it.
  const bell = [];
  for (let k = 0; k <= 8; k += 1) {
    const t = k / 8;
    bell.push(new THREE.Vector2(0.016 + 0.036 * Math.pow(t, 1.4), t * 0.085));
  }
  for (const lamp of lamps) {
    const { head, dir, up, out, anchor } = lamp;
    const back = head.clone().addScaledVector(dir, -0.05);
    // The arm: out from its mount, over and down into the back of the shade.
    const path = new THREE.CatmullRomCurve3([
      anchor,
      anchor.clone().addScaledVector(lamp.clip ? up : out, 0.05),
      head.clone().addScaledVector(up, lamp.arc).addScaledVector(dir, -0.06),
      back,
    ]);
    fixtures.push(colored(new THREE.TubeGeometry(path, 24, 0.0085, 6, false), BRASS));
    // Its mount: a round plate on the board (or a clip on the page's edge).
    fixtures.push(colored(placeAlong(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 16), lamp.clip ? up : out, anchor), BRASS));
    shades.push(colored(placeAlong(new THREE.LatheGeometry(bell, 18), dir, back), SHADE));
    bulbs.push(placeAlong(new THREE.SphereGeometry(0.02, 12, 8), dir, head.clone().addScaledVector(dir, 0.01)));
    // The beam, from the shade's mouth towards the picture.
    const mouth = head.clone().addScaledVector(dir, 0.035);
    const length = Math.max(0.2, lamp.beam - 0.035);
    const beam = new THREE.CylinderGeometry(0.05, lamp.spread, length, 24, 1, true);
    beams.push(placeAlong(beam, dir.clone().negate(), mouth.clone().addScaledVector(dir, length / 2)));
    lightPicture(lamp.slot.material, lamp);
  }

  const fixtureGeometry = mergeGeometries(fixtures);
  fixtures.forEach((g) => g.dispose());
  const fixtureMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(fixtureGeometry, fixtureMaterial));

  // The hoods glow a little after dark, lit from inside by their bulbs.
  const shadeGeometry = mergeGeometries(shades);
  shades.forEach((g) => g.dispose());
  const shadeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: WARM, emissiveIntensity: 0 });
  group.add(new THREE.Mesh(shadeGeometry, shadeMaterial));

  const bulbGeometry = mergeGeometries(bulbs);
  bulbs.forEach((g) => g.dispose());
  const bulbMaterial = new THREE.MeshLambertMaterial({ color: "#fff4e0", emissive: WARM, emissiveIntensity: 0 });
  group.add(new THREE.Mesh(bulbGeometry, bulbMaterial));

  const beamGeometry = mergeGeometries(beams);
  beams.forEach((g) => g.dispose());
  const beamMat = beamMaterial();
  const beamMesh = new THREE.Mesh(beamGeometry, beamMat);
  beamMesh.renderOrder = 3;
  group.add(beamMesh);

  // A soft glow round each bulb.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  {
    const g = glowCanvas.getContext("2d");
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,236,190,0.95)");
    gradient.addColorStop(0.3, "rgba(255,210,140,0.4)");
    gradient.addColorStop(1, "rgba(255,200,130,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  }
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lamps.flatMap((l) => l.head.clone().addScaledVector(l.dir, 0.012).toArray()), 3));
  const glowMaterial = new THREE.PointsMaterial({ map: glowTexture, size: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;
  group.add(glow);

  return {
    lamps,
    update(time) {
      const night = environment.uNight.value;
      bulbMaterial.emissiveIntensity = 0.15 + night * 1.6;
      shadeMaterial.emissiveIntensity = night * 0.45;
      glowMaterial.size = night * (0.42 + Math.sin(time * 2.1) * 0.02);
      glow.visible = night > 0.02;
      beamMesh.visible = night > 0.02;
    },
    dispose() {
      scene.remove(group);
      [fixtureGeometry, shadeGeometry, bulbGeometry, beamGeometry, glowGeometry].forEach((g) => g.dispose());
      [fixtureMaterial, shadeMaterial, bulbMaterial, beamMat, glowMaterial].forEach((m) => m.dispose());
      glowTexture.dispose();
    },
  };
}

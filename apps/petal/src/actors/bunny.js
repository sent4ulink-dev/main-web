import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { colored, sphere, shadowTexture } from "../core/geometry.js";
import { Spring, clamp, damp, smoothstep } from "../core/math.js";
import { ENV_GLSL, addNearFade, useEnvironment } from "../core/uniforms.js";

// The playable bunny: a sculpted model (tools/build_bunny.py) driven by a
// procedural animation rig. Everything is computed per frame from a few
// inputs (speed, air time, sitting, gestures), so it never needs animation
// clips and stays cheap on phones:
//
//   root ─ mover (lean, bank, squash & stretch)
//          ├ hips (step bob, sway, sit) ─ body, dress (cloth shader), hands,
//          │                              head ─ face, eyes, ears (springs)
//          └ feet (stepping arcs)
//
// Secondary motion (ears, skirt, landing squash) uses damped springs.
// Facial expressions swap in small meshes: happy ^^ eyes, sleepy lids,
// heart eyes, an open mouth and a blush that deepens when she is happy.

export const CHARACTERS = {
  girl: { url: "/characters/bunny.glb?v=6", floppy: true, clothAmount: 1, label: "Girl bunny" },
  boy: { url: "/characters/bunny-boy.glb?v=3", floppy: false, clothAmount: 0.25, label: "Boy bunny" },
};

const INK = "#3d2433";
const REST_AFTER = 16; // seconds idle before sitting down for a rest
const SLEEP_AFTER = 34; // … and dozing off
const IDLE_GESTURES = ["look", "stretch", "hop", "tap", "twitch", "look", "wave"];

// ------------------------------------------------------------ materials --
// Plush fur: fine hash grain, a warm subsurface tint on the shadow side and a
// soft rim that follows the sky colour (pink by day, blue by night).
function furMaterial() {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#fff0f4", emissiveIntensity: 0.06 });
  material.onBeforeCompile = (shader) => {
    useEnvironment(shader);
    addNearFade(shader, 0.15, 0.4);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFurPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFurPos = position * 90.0;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        ${ENV_GLSL}
        varying vec3 vFurPos;
        float furHash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace("#include <dithering_fragment>", `
        float grain = furHash(vFurPos) * 0.6 + furHash(vFurPos * 2.3) * 0.4;
        gl_FragColor.rgb *= 0.94 + grain * 0.1;
        float facing = clamp(dot(normalize(normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
        float rim = pow(1.0 - facing, 2.2);
        gl_FragColor.rgb += uRim * rim * mix(0.34, 0.22, uNight);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(1.04, 0.97, 0.98), (1.0 - facing) * 0.3);
        gl_FragColor.rgb *= 1.0 - uWet * 0.12;
        #include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => "bunny-fur";
  return material;
}

// Cloth skirt: bends in the vertex shader. Below the waist it spreads over the
// seat when sitting, ripples and trails while walking, flares in the air and
// lags behind sudden moves (uLag, from a spring). The bodice stays put. It
// sways round `centre` (her middle, in the skirt's own space; by default the
// middle of its box).
function clothMaterial(geometry, { centre = null } = {}) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const uniforms = {
    uSit: { value: 0 }, uSeat: { value: 0 }, uMove: { value: 0 }, uAir: { value: 0 }, uClothTime: { value: 0 },
    uLag: { value: new THREE.Vector2() },
    // The seat surface and its front edge, in the skirt's own space.
    uSeatY: { value: -10 }, uSeatFront: { value: 10 },
    uBot: { value: box.min.y }, uWaist: { value: box.min.y + (box.max.y - box.min.y) * 0.6 },
    uCentre: { value: centre ?? new THREE.Vector2((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2) },
  };
  const material = furMaterial();
  const fur = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    fur(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uSit, uSeat, uMove, uAir, uClothTime, uBot, uWaist;
        uniform vec2 uCentre, uLag;
        uniform float uSeatY, uSeatFront;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          float span = uWaist - uBot;
          float f = clamp((uWaist - transformed.y) / span, 0.0, 1.0);
          float f2 = f * f;
          vec2 d = transformed.xz - uCentre;
          float ang = atan(d.y, d.x);
          float front = max(0.0, d.y / max(length(d), 1e-4)); // 1 at the front of the skirt
          float flare = 1.0 + f2 * (0.1 * uSit + 0.22 * uAir)
                      + f2 * 0.05 * sin(ang * 5.0 + uClothTime * 7.0) * uMove
                      + f2 * 0.018 * sin(ang * 3.0 + uClothTime * 1.6);
          d *= flare;
          d.y -= f2 * 0.12 * span * uMove;          // hem trails behind while walking
          d += uLag * f2 * span;                     // follow-through after quick moves
          // Seated: the front drapes forward over the lap and hangs over the
          // seat edge; the back and sides gather up on the seat.
          d.y += f * span * 0.62 * uSit * front;
          transformed.xz = uCentre + d;
          // On a bench only the part past the seat's front edge hangs down.
          float beyond = smoothstep(uSeatFront - 0.012, uSeatFront + 0.02, transformed.z);
          float gather = f2 * span * uSit * (1.0 - front) * mix(0.3, 0.38, uSeat);
          float hang = f2 * span * uSit * uSeat * 0.3 * beyond;
          float spread = f2 * span * uSit * (1.0 - uSeat) * 0.22; // on the grass: lies on the ground
          transformed.y += gather - hang + spread + f2 * span * 0.14 * uAir
                         - f2 * span * 0.04 * uMove * abs(sin(uClothTime * 7.0));
          // …and the rest lies on the seat, never sinking through it.
          transformed.y = mix(transformed.y, max(transformed.y, uSeatY), uSeat * uSit * (1.0 - beyond));
        }`);
  };
  material.customProgramCacheKey = () => "bunny-cloth";
  return { material, uniforms };
}

// Ears bend along their length on the CPU (a few thousand vertices).
function bendableEar(mesh) {
  const geometry = mesh.geometry;
  const src = geometry.attributes.position;
  const srcN = geometry.attributes.normal;
  const rest = new Float32Array(src.count * 3);
  const restN = new Float32Array(src.count * 3);
  for (let i = 0; i < src.count; i += 1) {
    rest.set([src.getX(i), src.getY(i), src.getZ(i)], i * 3);
    restN.set([srcN.getX(i), srcN.getY(i), srcN.getZ(i)], i * 3);
  }
  const position = new THREE.BufferAttribute(rest.slice(), 3);
  const normal = new THREE.BufferAttribute(restN.slice(), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  normal.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("normal", normal);
  geometry.computeBoundingBox();
  const base = geometry.boundingBox.min.y;
  const tip = geometry.boundingBox.max.y;
  const hinge = base + (tip - base) * 0.3;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  let lastSide = NaN;
  let lastBack = NaN;
  return {
    // side: outward flop angle (radians at the tip); back: backward curl.
    bend(side, back) {
      if (Math.abs(side - lastSide) < 0.002 && Math.abs(back - lastBack) < 0.002) return;
      lastSide = side;
      lastBack = back;
      for (let i = 0; i < position.count; i += 1) {
        const y = rest[i * 3 + 1];
        if (y <= hinge) continue;
        const s = (y - hinge) / (tip - hinge);
        e.set(-back * s, 0, side * s);
        q.setFromEuler(e);
        v.set(rest[i * 3], y - hinge, rest[i * 3 + 2]).applyQuaternion(q);
        position.setXYZ(i, v.x, v.y + hinge, v.z);
        v.set(restN[i * 3], restN[i * 3 + 1], restN[i * 3 + 2]).applyQuaternion(q);
        normal.setXYZ(i, v.x, v.y, v.z);
      }
      position.needsUpdate = true;
      normal.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------- face overlays --
// Model-space landmarks of the sculpted bunny (web axes, +z is her front).
const FACE = {
  eyes: [new THREE.Vector3(-0.088, 0.49, 0.222), new THREE.Vector3(0.088, 0.49, 0.222)],
  mouth: new THREE.Vector3(0, 0.428, 0.238),
  cheeks: [new THREE.Vector3(-0.13, 0.435, 0.205), new THREE.Vector3(0.13, 0.435, 0.205)],
};

function heartGeometry(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  s.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  s.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  s.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const g = new THREE.ShapeGeometry(s, 6);
  g.scale(size, size, size);
  return g;
}

function createFace(head, toHead) {
  const ink = new THREE.MeshBasicMaterial({ color: INK });
  const rose = new THREE.MeshBasicMaterial({ color: "#ff4f8b" });
  const mouthInk = new THREE.MeshBasicMaterial({ color: "#7a2944" });
  const blushMaterial = new THREE.MeshBasicMaterial({ color: "#ff7fa8", transparent: true, opacity: 0, depthWrite: false });
  const geometries = [];
  const arc = (up) => {
    const g = new THREE.TorusGeometry(0.026, 0.0064, 6, 16, Math.PI);
    if (!up) g.rotateZ(Math.PI);
    geometries.push(g);
    return g;
  };
  const happyArc = arc(true);
  const sleepArc = arc(false);
  const heart = heartGeometry(0.07);
  geometries.push(heart);
  // Worn out: eyes squeezed shut in a "> <", the strokes meeting towards her nose.
  const chevron = (side) => {
    const tip = new THREE.Vector3(-side * 0.011, 0, 0);
    const parts = [new THREE.SphereGeometry(0.0062, 8, 6).translate(tip.x, tip.y, 0)];
    for (const dy of [0.013, -0.013]) {
      const end = new THREE.Vector3(side * 0.013, dy, 0);
      const stroke = new THREE.CylinderGeometry(0.0058, 0.0058, tip.distanceTo(end), 6);
      stroke.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(tip).normalize()));
      stroke.translate((tip.x + end.x) / 2, (tip.y + end.y) / 2, 0);
      parts.push(stroke, new THREE.SphereGeometry(0.0058, 8, 6).translate(end.x, end.y, 0));
    }
    const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(flat);
    parts.forEach((g) => g.dispose());
    flat.forEach((g) => g.dispose());
    geometries.push(merged);
    return merged;
  };
  const chevrons = [chevron(-1), chevron(1)];
  const sets = { happy: [], asleep: [], love: [], tired: [] };
  FACE.eyes.forEach((point, i) => {
    const side = i ? 1 : -1;
    const at = toHead(point);
    for (const [key, geometry, material] of [["happy", happyArc, ink], ["asleep", sleepArc, ink], ["love", heart, rose], ["tired", chevrons[i], ink]]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(at);
      if (key === "asleep") mesh.position.y -= 0.012;
      mesh.rotation.y = side * 0.34;
      mesh.visible = false;
      head.add(mesh);
      sets[key].push(mesh);
    }
  });
  const mouthGeometry = new THREE.SphereGeometry(0.02, 12, 8);
  mouthGeometry.scale(1.15, 1, 0.32);
  geometries.push(mouthGeometry);
  const mouth = new THREE.Mesh(mouthGeometry, mouthInk);
  mouth.position.copy(toHead(FACE.mouth));
  mouth.scale.setScalar(0.001);
  head.add(mouth);
  // A little pink tongue, out when she pants.
  const tongueMaterial = new THREE.MeshBasicMaterial({ color: "#ff7d9c" });
  const tongueGeometry = new THREE.SphereGeometry(0.0105, 10, 8);
  tongueGeometry.scale(1.3, 0.8, 0.75);
  geometries.push(tongueGeometry);
  const tongue = new THREE.Mesh(tongueGeometry, tongueMaterial);
  tongue.position.copy(toHead(FACE.mouth.clone().add(new THREE.Vector3(0, -0.012, 0.007))));
  tongue.visible = false;
  head.add(tongue);
  // A drop of sweat that runs down the side of her head after hard work.
  const dropGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.5), new THREE.Vector2(0.09, 0.3), new THREE.Vector2(0.2, 0.05), new THREE.Vector2(0.27, -0.15),
    new THREE.Vector2(0.25, -0.32), new THREE.Vector2(0.15, -0.43), new THREE.Vector2(0, -0.47),
  ], 12);
  dropGeometry.scale(0.045, 0.045, 0.045);
  geometries.push(dropGeometry);
  const sweatMaterial = new THREE.MeshBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0.92, depthWrite: false });
  const sweat = new THREE.Mesh(dropGeometry, sweatMaterial);
  const sweatAt = toHead(new THREE.Vector3(0.21, 0.615, 0.155));
  sweat.visible = false;
  sweat.renderOrder = 3;
  head.add(sweat);
  const blushGeometry = new THREE.CircleGeometry(0.034, 16);
  geometries.push(blushGeometry);
  const blush = FACE.cheeks.map((point, i) => {
    const side = i ? 1 : -1;
    const normal = new THREE.Vector3(side * 0.52, -0.2, 0.83).normalize();
    const mesh = new THREE.Mesh(blushGeometry, blushMaterial);
    mesh.position.copy(toHead(point.clone().addScaledVector(normal, 0.01)));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.renderOrder = 3;
    head.add(mesh);
    return mesh;
  });
  let shown = null;
  let winking = -1;
  return {
    // Which eye set replaces the normal eyes ("happy", "asleep", "love" or null).
    showEyes(kind) {
      if (kind === shown) return;
      shown = kind;
      winking = -1;
      for (const [key, meshes] of Object.entries(sets)) meshes.forEach((m) => (m.visible = key === kind));
    },
    // One eye squeezed shut in a happy arc (index 0 or 1), or none (-1).
    wink(index) {
      if (index === winking) return;
      winking = index;
      sets.happy.forEach((m, i) => (m.visible = shown === "happy" || i === index));
    },
    setMouth(open) {
      mouth.scale.set(open > 0.02 ? 1 : 0.001, Math.max(0.001, open), 1);
    },
    setTongue(amount) {
      tongue.visible = amount > 0.02;
      tongue.scale.setScalar(Math.max(0.001, amount));
    },
    // A sweat drop part way down her head (t: 0..1), or none (t < 0).
    setSweat(t) {
      sweat.visible = t >= 0 && t < 1;
      if (!sweat.visible) return;
      sweat.scale.setScalar(Math.max(0.001, Math.min(1, t / 0.15)));
      sweat.position.copy(sweatAt);
      sweat.position.y -= t * 0.06;
      sweatMaterial.opacity = 0.92 * Math.min(1, (1 - t) / 0.2);
    },
    setBlush(amount) {
      blushMaterial.opacity = amount * 0.55;
      blush.forEach((m) => (m.visible = amount > 0.02));
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      [ink, rose, mouthInk, blushMaterial, tongueMaterial, sweatMaterial].forEach((m) => m.dispose());
    },
  };
}

// ---------------------------------------------------------------- holding --
function createHoldables(hands) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bouquet = new THREE.Group();
  hands[1].add(bouquet);
  bouquet.scale.setScalar(1 / (hands[1].scale.x || 1)); // hands are scaled nodes after compression
  const colors = ["#ff8fb8", "#ffffff", "#c9b2ff", "#ffc3d9", "#fff0a0", "#9fd4ff"];
  const bloomGeometries = colors.map((color) => mergeGeometries([
    sphere(0.028, color, [0, 0, 0], [1, 0.7, 1], 8),
    sphere(0.01, "#ffd86b", [0, 0.018, 0], [1, 1, 1], 5),
  ]));
  const blooms = [];
  for (let i = 0; i < 12; i += 1) {
    const a = i * 2.4;
    const r = 0.02 + (i % 4) * 0.018;
    const bloom = new THREE.Mesh(bloomGeometries[i % bloomGeometries.length], material);
    bloom.position.set(Math.cos(a) * r, 0.14 + (i % 3) * 0.02, Math.sin(a) * r + 0.02);
    bloom.visible = false;
    bouquet.add(bloom);
    blooms.push(bloom);
  }
  const stemGeometry = colored(new THREE.CylinderGeometry(0.015, 0.01, 0.16, 6).translate(0, 0.07, 0.02), "#6fb47d");
  bouquet.add(new THREE.Mesh(stemGeometry, material));
  bouquet.visible = false;
  const carrotGeometry = mergeGeometries([
    colored(new THREE.ConeGeometry(0.035, 0.13, 7).rotateX(Math.PI).translate(0, 0.02, 0.03), "#ff9a4d"),
    colored(new THREE.ConeGeometry(0.03, 0.08, 5).translate(0, 0.12, 0.03), "#6fbf7f"),
  ]);
  const carrot = new THREE.Mesh(carrotGeometry, material);
  carrot.scale.setScalar(1 / (hands[0].scale.x || 1));
  carrot.visible = false;
  hands[0].add(carrot);
  let carrots = 0;
  let busyPaw = false; // the left paw is holding something else (an umbrella)

  // A pointer stick for showing things: a slim wand with a candy-pink heart
  // at its tip and a ribbon at the grip, one per paw (+y runs grip to tip).
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.5);
  heartShape.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  heartShape.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  heartShape.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  heartShape.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const tipGeometry = new THREE.ExtrudeGeometry(heartShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 10 });
  tipGeometry.center();
  tipGeometry.scale(0.085, 0.085, 0.085);
  tipGeometry.translate(0, 0.43, 0);
  const pointerGeometry = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.007, 0.01, 0.4, 8).translate(0, 0.2, 0), "#c98e5e"),
    colored(tipGeometry.toNonIndexed(), "#ff6f9f"),
    sphere(0.016, "#ffd86b", [0, 0.405, 0], [1, 1, 1], 8),
    sphere(0.022, "#ffb3cf", [0, 0.02, 0], [1, 0.6, 1], 8),
  ].map((g) => (g.index ? g.toNonIndexed() : g)));
  tipGeometry.dispose();
  const pointers = hands.map((hand) => {
    const stick = new THREE.Mesh(pointerGeometry, material);
    stick.scale.setScalar(1 / (hand.scale.x || 1));
    stick.visible = false;
    hand.add(stick);
    return stick;
  });
  return {
    bouquet,
    carrot,
    pointers,
    set(flowers, count) {
      carrots = count;
      bouquet.visible = flowers > 0;
      blooms.forEach((bloom, i) => (bloom.visible = i < flowers));
      carrot.visible = carrots > 0 && !busyPaw;
    },
    leftPawBusy(on) {
      if (on === busyPaw) return;
      busyPaw = on;
      carrot.visible = carrots > 0 && !busyPaw;
    },
    dispose() {
      bloomGeometries.forEach((g) => g.dispose());
      stemGeometry.dispose();
      carrotGeometry.dispose();
      pointerGeometry.dispose();
      material.dispose();
    },
  };
}

// The two eyes come as one mesh; split it into a left and a right eye (same
// node transform, so blinking still scales both) so one can wink on its own.
// Returns the pair node and its two eye meshes ([0] is her right, at -x).
function splitEyes(eyes) {
  let source = eyes.isMesh ? eyes : null;
  if (!source && eyes.children.length === 1 && eyes.children[0].isMesh && eyes.children[0].matrix.equals(new THREE.Matrix4())) source = eyes.children[0];
  if (!source || !eyes.parent) return { node: eyes, sides: null };
  const flat = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry;
  const position = flat.attributes.position;
  const halves = [[], []];
  for (let t = 0; t + 2 < position.count; t += 3) {
    halves[position.getX(t) + position.getX(t + 1) + position.getX(t + 2) < 0 ? 0 : 1].push(t);
  }
  const read = (a, v, c) => (c === 0 ? a.getX(v) : c === 1 ? a.getY(v) : c === 2 ? a.getZ(v) : a.getW(v));
  const pair = new THREE.Group();
  pair.name = "Bunny_Eyes";
  pair.position.copy(eyes.position);
  pair.quaternion.copy(eyes.quaternion);
  pair.scale.copy(eyes.scale);
  const sides = halves.map((triangles, i) => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(flat.attributes)) {
      const out = new Float32Array(triangles.length * 3 * a.itemSize);
      let k = 0;
      for (const t of triangles) {
        for (let v = t; v < t + 3; v += 1) for (let c = 0; c < a.itemSize; c += 1) out[k++] = read(a, v, c);
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    const mesh = new THREE.Mesh(geometry, source.material);
    mesh.name = i ? "Bunny_EyeL" : "Bunny_EyeR";
    pair.add(mesh);
    return mesh;
  });
  eyes.parent.add(pair);
  eyes.parent.remove(eyes);
  if (flat !== source.geometry) flat.dispose();
  source.geometry.dispose();
  return { node: pair, sides };
}

// Which eye looks through the telescope (her left, +x) and which one winks.
const SCOPE_EYE = 1;
const WINK_EYE = 0;

// She holds the umbrella out by her left cheek, so the shaft passes a few
// centimetres clear of her big head (hips space: the head is a 0.245 m ball
// centred 0.51 m up), with the canopy leaning in over her ears.
const UMBRELLA_GRIP = new THREE.Vector3(-0.26, 0.36, 0.19);
const UMBRELLA_TIP = new THREE.Vector3(-0.1, 1.14, 0.03);
// The scarf's knit ring (hips space): under her head, round her collar.
const SCARF = { y: 0.285, radius: 0.152, tube: 0.025 };

// --------------------------------------------------------------- outfits --
// Weather outfits: a striped umbrella in the rain, a knitted scarf in the snow.
function createOutfits(hips) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const geometries = [];
  const keep = (g) => (geometries.push(g), g);

  // Umbrella: eight pink and white gores, a wooden tip and a slim shaft. It
  // pivots (sways) at the bottom of the shaft, just below her paw.
  const axis = UMBRELLA_TIP.clone().sub(UMBRELLA_GRIP);
  const shaftLength = axis.length() + 0.1;
  axis.normalize();
  const umbrella = new THREE.Group();
  umbrella.position.copy(UMBRELLA_GRIP).addScaledVector(axis, -0.1);
  hips.add(umbrella);
  const stick = new THREE.Group();
  stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  umbrella.add(stick);
  const canopyGeometry = keep(new THREE.ConeGeometry(0.44, 0.17, 16, 2, true));
  canopyGeometry.translate(0, -0.085, 0);
  {
    const pos = canopyGeometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const gore = Math.floor(((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 2;
      c.set(gore ? "#ff8fb8" : "#fff4f8");
      // Scalloped rim: the edge between ribs sags a little.
      if (pos.getY(i) < -0.16) pos.setY(i, pos.getY(i) - 0.012 * Math.abs(Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 4)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    canopyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    canopyGeometry.computeVertexNormals();
  }
  const canopy = new THREE.Group();
  canopy.position.set(0, shaftLength, 0);
  canopy.add(new THREE.Mesh(canopyGeometry, material));
  canopy.add(new THREE.Mesh(keep(colored(new THREE.SphereGeometry(0.018, 8, 6).translate(0, 0.01, 0), "#c9925f")), material));
  stick.add(canopy);
  const shaftGeometry = keep(colored(new THREE.CylinderGeometry(0.008, 0.008, shaftLength, 6).translate(0, shaftLength / 2, 0), "#9a6a4a"));
  stick.add(new THREE.Mesh(shaftGeometry, material));
  umbrella.visible = false;

  // Scarf: a chunky knit ring with stripes and a tail that flutters. It is
  // wound round her neck below her head, over her collar, and its tail hangs
  // down over her front, angled out so it lies on her clothes.
  const scarf = new THREE.Group();
  scarf.position.set(0, SCARF.y, 0);
  hips.add(scarf);
  const ringGeometry = keep(new THREE.TorusGeometry(SCARF.radius, SCARF.tube, 10, 32));
  ringGeometry.rotateX(Math.PI / 2);
  const stripe = (geometry, along) => {
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      c.set(Math.floor(along(pos, i) * 22) % 3 === 0 ? "#fff4ec" : "#e8505f");
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  };
  stripe(ringGeometry, (pos, i) => (Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / Math.PI);
  scarf.add(new THREE.Mesh(ringGeometry, material));
  const tailGeometry = keep(new THREE.BoxGeometry(0.055, 0.11, 0.02, 1, 4, 1).translate(0, -0.055, 0));
  stripe(tailGeometry, (pos, i) => -pos.getY(i) * 2.2);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(Math.sin(0.6) * (SCARF.radius + 0.016), -0.012, Math.cos(0.6) * (SCARF.radius + 0.016));
  tailPivot.rotation.y = 0.6;
  scarf.add(tailPivot);
  const tail = new THREE.Mesh(tailGeometry, material);
  tailPivot.add(tail);
  scarf.visible = false;

  const open = new Spring(90, 10, 0);
  let umbrellaAmount = 0;
  let scarfAmount = 0;
  // Which paw holds the umbrella: 0 (her own -x side, as it is made) or 1,
  // the same umbrella mirrored to her other side.
  let paw = 0;
  function holdIn(next) {
    paw = next ? 1 : 0;
    const flip = paw ? -1 : 1;
    const along = axis.clone();
    along.x *= flip;
    umbrella.position.copy(UMBRELLA_GRIP).addScaledVector(axis, -0.1);
    umbrella.position.x *= flip;
    stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
  }
  return {
    get umbrella() { return umbrellaAmount; },
    get umbrellaPaw() { return paw; },
    get scarf() { return scarf.visible; },
    update(time, dt, { rain, snow, move, sway, run, hand = 0 }) {
      if ((hand ? 1 : 0) !== paw) holdIn(hand);
      umbrellaAmount = damp(umbrellaAmount, rain > 0.45 ? 1 : 0, 3, dt);
      scarfAmount = damp(scarfAmount, snow > 0.35 ? 1 : 0, 3, dt);
      const opened = clamp(open.update(rain > 0.45 ? 1 : 0, dt), 0, 1.15);
      umbrella.visible = umbrellaAmount > 0.02;
      umbrella.scale.setScalar(Math.max(0.001, umbrellaAmount));
      canopy.scale.set(0.25 + opened * 0.75, 0.6 + opened * 0.4, 0.25 + opened * 0.75);
      umbrella.rotation.set(-move * 0.06 - run * 0.05, 0, (clamp(sway * 0.6, -0.04, 0.12) + Math.sin(time * 1.3) * 0.02) * (paw ? -1 : 1));
      scarf.visible = scarfAmount > 0.02;
      scarf.scale.setScalar(Math.max(0.001, 0.6 + scarfAmount * 0.4));
      tail.rotation.x = -0.32 - move * 0.7 - run * 0.4 - Math.sin(time * 9) * 0.12 * move;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      material.dispose();
    },
  };
}

// --------------------------------------------------------------- reach --
// How far her body and outfit reach out from her middle, by height and by
// direction, in the hips' space: measured once from the meshes, so her paws
// can be kept outside them. The skirt's sway is added as it moves.
const REACH_STEP = 0.01; // height bands
const REACH_SECTORS = 24; // directions round her
const PAW_RADIUS = 0.05;
const sectorOf = (x, z) => ((Math.floor(((Math.atan2(x, z) + Math.PI) / (Math.PI * 2)) * REACH_SECTORS) % REACH_SECTORS) + REACH_SECTORS) % REACH_SECTORS;

function measureReach(hips, nodes, cloth) {
  hips.updateMatrixWorld(true);
  const toHips = new THREE.Matrix4().copy(hips.matrixWorld).invert();
  const bands = Math.round(0.5 / REACH_STEP) + 1;
  const table = (fill) => Array.from({ length: bands }, () => new Float32Array(REACH_SECTORS).fill(fill));
  const reach = { still: table(0), skirt: table(0), bend: new Float32Array(bands), span: 0 };
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const column = new THREE.Vector3();
  const { uWaist, uBot } = cloth?.uniforms ?? {};
  for (const node of nodes) {
    node.traverse((mesh) => {
      if (!mesh.isMesh) return;
      m.multiplyMatrices(toHips, mesh.matrixWorld);
      const isCloth = Boolean(uWaist) && mesh.material === cloth.material;
      const span = isCloth ? uWaist.value - uBot.value : 0;
      if (isCloth) reach.span = span * column.setFromMatrixColumn(m, 1).length(); // in the hips' units
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) {
        v.fromBufferAttribute(position, i);
        const bend = isCloth ? clamp((uWaist.value - v.y) / span, 0, 1) : 0;
        v.applyMatrix4(m);
        const band = Math.round(v.y / REACH_STEP);
        if (band < 0 || band >= bands) continue;
        const row = (bend > 0 ? reach.skirt : reach.still)[band];
        const sector = sectorOf(v.x, v.z);
        row[sector] = Math.max(row[sector], Math.hypot(v.x, v.z));
        reach.bend[band] = Math.max(reach.bend[band], bend);
      }
    });
  }
  return reach;
}

// How far out they reach at height y, towards angle (the skirt as it is now).
function reachAt(reach, y, angle, u) {
  const band = Math.round(y / REACH_STEP);
  if (band < 0 || band >= reach.bend.length) return 0;
  const f = reach.bend[band];
  const sway = 1 + f * f * (0.1 * u.uSit.value + 0.22 * u.uAir.value + 0.05 * u.uMove.value + 0.018);
  const shift = (f * f * (0.12 * u.uMove.value + u.uLag.value.length()) + f * 0.62 * u.uSit.value) * reach.span;
  const middle = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * REACH_SECTORS);
  let out = 0;
  for (let k = -1; k <= 1; k += 1) {
    const sector = (((middle + k) % REACH_SECTORS) + REACH_SECTORS) % REACH_SECTORS;
    const skirt = reach.skirt[band][sector];
    out = Math.max(out, reach.still[band][sector], skirt > 0 ? skirt * sway + shift : 0);
  }
  return out;
}

// Moves a paw (its centre, in the hips' space) straight out from her middle
// until it is clear of her body and outfit, all the way up and down the paw.
function clearOfOutfit(reach, paw, u, scarf = false) {
  if (!reach) return;
  if (scarf) {
    // Off the knit ring: away from its core circle by its thickness and a paw.
    const r = Math.hypot(paw.x, paw.z) || 1e-4;
    const dr = r - SCARF.radius;
    const dy = paw.y - SCARF.y;
    const d = Math.hypot(dr, dy) || 1e-4;
    const clear = SCARF.tube + PAW_RADIUS + 0.004;
    if (d < clear) {
      const k = clear / d;
      const r2 = SCARF.radius + dr * k;
      paw.y = SCARF.y + dy * k;
      paw.x *= r2 / r;
      paw.z *= r2 / r;
    }
  }
  const angle = Math.atan2(paw.x, paw.z);
  let need = 0;
  for (let k = -4; k <= 4; k += 1) {
    const dy = (PAW_RADIUS * k) / 4;
    const out = reachAt(reach, paw.y + dy, angle, u);
    if (out > 0) need = Math.max(need, out + Math.sqrt(PAW_RADIUS * PAW_RADIUS - dy * dy) + 0.004);
  }
  const r = Math.hypot(paw.x, paw.z);
  if (r >= need) return;
  if (r < 1e-4) paw.z = need;
  else paw.multiply(new THREE.Vector3(need / r, 1, need / r));
}

// ------------------------------------------------------------------ rig --
// parts: { body, dress, dressMesh, head, eyes, hands[2], feet[2], ears[2] (nodes), earMeshes[2] }
function createRig(parts, { floppy, clothAmount, toHead, scale = 1.12 }) {
  const { body, dress, head, hands, feet } = parts;
  const { node: eyes, sides: eyeSides } = splitEyes(parts.eyes);
  const cloth = parts.cloth;
  const dressMesh = parts.dressMesh;
  const toDress = new THREE.Matrix4();
  const seatPoint = new THREE.Vector3();
  const root = new THREE.Group();
  root.name = "Player bunny";
  const mover = new THREE.Group();
  root.add(mover);
  const hips = new THREE.Group();
  mover.add(hips);
  hips.add(body, dress, head, ...hands);
  mover.add(...feet);
  root.scale.setScalar(scale);

  const handBase = hands.map((h) => h.position.clone());
  const footBase = feet.map((f) => f.position.clone());
  const handRest = hands.map((h) => h.quaternion.clone());
  const footRest = feet.map((f) => f.quaternion.clone());
  const headRest = head.quaternion.clone();
  const eyeScale = eyes.scale.y; // compression stores part sizes as node scales
  const ears = parts.ears.map((node, i) => ({
    node,
    side: i ? 1 : -1,
    rest: node.quaternion.clone(),
    bender: bendableEar(parts.earMeshes[i]),
    back: new Spring(70, 7.5, 0),
    flop: new Spring(80, 8, 0),
  }));
  const face = createFace(head, toHead);
  const eyePoints = FACE.eyes.map((point) => toHead(point)); // in head space
  const outfitReach = cloth?.uniforms ? measureReach(hips, [body, dress], cloth) : null;
  const hold = createHoldables(hands);
  const outfit = createOutfits(hips);
  const weather = { rain: 0, snow: 0 };

  const shadowMap = shadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.55).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }),
  );
  shadow.renderOrder = 1;
  root.add(shadow);

  // Blend weights and springs.
  const w = { sit: 0, seat: 0, peek: 0, air: 0, glide: 0, move: 0, run: 0, rest: 0, sleep: 0, wade: 0, rail: 0, point: 0, hold: 0 };
  // Hand in hand with the other bunny: the paw that holds, and how far she
  // leans on him (-1..1, towards her own +x side).
  const holdAt = new THREE.Vector3();
  const holdTo = new THREE.Vector3();
  let cuddle = 0;
  const pointAt = new THREE.Vector3();
  const pointFrom = new THREE.Vector3();
  const pointQuat = new THREE.Quaternion();
  const handQuat = new THREE.Quaternion();
  const UP_Y = new THREE.Vector3(0, 1, 0);
  const restAim = new THREE.Vector3();
  const rootQuat = new THREE.Quaternion();
  // The wand never goes through her head (a 0.245 ball centred 0.51 up, in
  // the hips' space): it is tilted out until it clears, heart and all.
  const HEAD_CENTRE = new THREE.Vector3(0, 0.51, 0.01);
  const PAW_CLEAR = 0.33; // a paw's centre stays this far from it (head and paw radii)
  const headAt = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const hipsScale = new THREE.Vector3();
  function clearOfHead(from, aim) {
    hips.localToWorld(headAt.copy(HEAD_CENTRE));
    const scale = hips.getWorldScale(hipsScale).x;
    const radius = 0.3 * scale;
    const length = 0.47 * scale; // grip to the top of the heart
    for (let k = 0; k < 4; k += 1) {
      const along = clamp(nearest.subVectors(headAt, from).dot(aim), 0, length);
      if (along === 0) return; // her head is behind the paw: nothing to clear
      nearest.copy(from).addScaledVector(aim, along);
      if (nearest.distanceTo(headAt) >= radius) return;
      // Push the nearest point out to the head's edge and aim through it.
      nearest.sub(headAt);
      if (nearest.lengthSq() < 1e-8) nearest.set(aim.z, 0, -aim.x);
      nearest.setLength(radius * 1.03).add(headAt);
      aim.subVectors(nearest, from).normalize();
    }
  }
  const squash = new Spring(160, 11, 0);
  const lagX = new Spring(60, 7, 0);
  const lagZ = new Spring(60, 7, 0);
  let phase = 0;
  let leanPitch = 0;
  let leanRoll = 0;
  let headYaw = 0;
  let headPitch = 0;
  let blinkAt = 2 + Math.random() * 3;
  let cheer = 0;
  let action = null; // { type, t, duration }
  let idleClock = 0;
  let nextIdle = 5 + Math.random() * 4;
  let expression = { kind: null, until: 0 };
  let blushLevel = 0;
  let clock = 0;
  let pantPhase = 0; // the rhythm of her panting: quick at first, slowing as she recovers
  let zzzTimer = 0;
  let lastStep = 0;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const tmp = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const lastHead = new THREE.Vector3();
  let headVy = 0;
  let events = () => {};

  function express(kind, seconds = 1.6) {
    expression = { kind, until: clock + seconds };
  }

  function gesture(type, duration) {
    action = { type, t: 0, duration };
  }

  return {
    root,
    shadow,
    head,
    set onEvent(fn) { events = fn; },
    cheer() {
      cheer = 1;
      express("happy", 1.4);
    },
    express,
    // Short gestures: pick, pull, pet, wave, cheer, stretch, hop, tap, look,
    // twitch, yawn, dance, twirl, clap, bow, tiptoe, pant, push.
    play: gesture,
    handWorld(index, target) {
      return hands[index].getWorldPosition(target);
    },
    // Where her telescope eye is, relative to her feet in her own frame
    // (metres; +z ahead, +y up). It depends only on her pose.
    scopeEyeOffset(target) {
      head.localToWorld(target.copy(eyePoints[SCOPE_EYE]));
      return root.worldToLocal(target).multiplyScalar(root.scale.x);
    },
    setHolding(flowers, carrots) {
      hold.set(flowers, carrots);
    },
    // Weather outfits (0..1 weights of rain and snow).
    setWeather(rain, snow) {
      weather.rain = rain;
      weather.snow = snow;
    },
    get asleep() { return w.sleep > 0.6; },
    // s: { speed, run, grounded, vy, gliding, turn, accel, sitting, seat, scope,
    //      wading, swing, idle, look (world point or null), landed (impact m/s),
    //      hold (a world point a paw holds on to, or null), holdHand (which
    //      paw), cuddle (-1..1: leaning on someone at her own +x side),
    //      umbrellaHand (the paw the umbrella is in: 0, or 1 for the other side) }
    update(time, dt, s) {
      clock = time;
      const idle = s.idle || 0;
      const resting = idle > REST_AFTER && s.grounded && !s.sitting && !s.rail && !s.scope && !action;
      w.sit = damp(w.sit, s.sitting || resting ? 1 : 0, resting ? 3 : 8, dt);
      w.rest = damp(w.rest, resting ? 1 : 0, 3, dt);
      w.sleep = damp(w.sleep, idle > SLEEP_AFTER && (resting || (s.sitting && !s.scope && !s.swing)) ? 1 : 0, idle > SLEEP_AFTER ? 0.8 : 6, dt);
      w.seat = damp(w.seat, s.seat ? 1 : 0, 8, dt);
      w.peek = damp(w.peek, s.scope ? 1 : 0, 6, dt);
      w.air = damp(w.air, s.grounded ? 0 : 1, 12, dt);
      w.glide = damp(w.glide, s.gliding ? 1 : 0, 9, dt);
      w.wade = damp(w.wade, s.wading ? 1 : 0, 6, dt);
      w.rail = damp(w.rail, s.rail ? 1 : 0, 6, dt);
      w.point = damp(w.point, s.point ? 1 : 0, 7, dt);
      if (s.point) pointAt.copy(s.point);
      w.hold = damp(w.hold, s.hold ? 1 : 0, 9, dt);
      if (s.hold) holdAt.copy(s.hold);
      cuddle = damp(cuddle, s.cuddle || 0, 4, dt);
      const speed = s.grounded ? s.speed : 0;
      w.move = damp(w.move, clamp(speed / 2.2, 0, 1) * (1 - w.sit), 10, dt);
      w.run = damp(w.run, s.run || 0, 6, dt);
      const move = w.move;
      const run = w.run * move;

      // ------------------------------------------------ gestures --
      if (!action && idle > 4 && move < 0.05 && w.sit < 0.1 && s.grounded && !s.scope && !s.rail) {
        idleClock += dt;
        if (idleClock > nextIdle) {
          idleClock = 0;
          nextIdle = 5 + Math.random() * 5;
          const type = IDLE_GESTURES[Math.floor(Math.random() * IDLE_GESTURES.length)];
          gesture(type, type === "look" ? 2.6 : type === "stretch" ? 1.8 : type === "wave" ? 1.6 : 1.1);
        }
      } else idleClock = 0;
      if (idle > SLEEP_AFTER - 3 && idle < SLEEP_AFTER - 3 + dt * 1.5 && !action) gesture("yawn", 2.2);

      let bend = 0, lean = 0, reachR = 0, reachL = 0, stroke = 0, lift = 0, tug = 0, squint = 0;
      let armsUp = 0, waveHand = 0, hopUp = 0, tap = 0, lookSweep = 0, twitch = 0, yawn = 0, dance = 0;
      let spin = 0, clap = 0, bow = 0, tiptoe = 0, pant = 0, pantP = 0, push = 0;
      if (action) {
        action.t += dt;
        const p = Math.min(1, action.t / action.duration);
        const env = smoothstep(0, 0.15, p) * (1 - smoothstep(0.82, 1, p));
        switch (action.type) {
          case "pick":
            bend = smoothstep(0, 0.35, p) * (1 - smoothstep(0.55, 0.9, p));
            reachR = bend;
            lift = Math.sin(Math.PI * smoothstep(0.55, 1, p)) * 0.8;
            break;
          case "pull":
            bend = smoothstep(0, 0.25, p) * (1 - smoothstep(0.78, 0.95, p));
            reachR = reachL = bend;
            tug = p > 0.28 && p < 0.78 ? Math.sin(((p - 0.28) / 0.5) * Math.PI * 4) * 0.5 + 0.5 : 0;
            lift = Math.sin(Math.PI * smoothstep(0.78, 1, p));
            break;
          case "pet":
            lean = env;
            stroke = Math.sin(action.t * 11) * lean;
            squint = lean;
            break;
          case "wave":
            waveHand = env;
            break;
          case "cheer":
            armsUp = env;
            hopUp = Math.max(0, Math.sin(p * Math.PI * 2)) * env;
            break;
          case "stretch":
            armsUp = Math.sin(Math.PI * p);
            squint = armsUp;
            break;
          case "hop":
            hopUp = Math.max(0, Math.sin(p * Math.PI * 2));
            break;
          case "tap":
            tap = Math.max(0, Math.sin(action.t * 18)) * env;
            break;
          case "look":
            lookSweep = Math.sin(p * Math.PI * 2) * env;
            break;
          case "twitch":
            twitch = env;
            break;
          case "yawn":
            yawn = Math.sin(Math.PI * p);
            armsUp = yawn * 0.6;
            squint = yawn;
            break;
          case "dance":
            dance = env;
            break;
          case "twirl":
            // A full turn on the spot, up on her toes, paws out.
            spin = smoothstep(0.08, 0.86, p) * Math.PI * 2;
            hopUp = Math.sin(Math.PI * p) * 0.75;
            armsUp = env * 0.55;
            break;
          case "clap":
            clap = env;
            break;
          case "bow":
            // A little bow, paws together in front.
            bow = Math.sin(Math.PI * p);
            bend = bow * 0.7;
            break;
          case "tiptoe":
            // Up on her toes, stretching for something just out of reach.
            tiptoe = env;
            squint = Math.max(squint, env * 0.6);
            break;
          case "pant":
            // Catching her breath after all that hopping.
            pant = env;
            pantP = p;
            break;
          case "push":
            // Both paws up and out in front, a lean into it and back.
            push = Math.sin(Math.PI * p);
            break;
          default:
            break;
        }
        if (p >= 1) action = null;
      }
      cheer = Math.max(0, cheer - dt * 1.8);
      const hop = (cheer > 0 ? Math.sin((1 - cheer) * Math.PI) : 0) + hopUp * 0.6;

      // ---------------------------------------------- locomotion --
      const cycles = s.grounded && speed > 0.05 ? 2.2 + speed * 1.2 : 0;
      phase += dt * cycles * Math.PI * 2;
      const stepIndex = Math.floor(phase / Math.PI);
      if (stepIndex !== lastStep) {
        lastStep = stepIndex;
        if (move > 0.25) events("step", stepIndex & 1);
      }
      const sinP = Math.sin(phase);
      const stepAmp = (0.075 + run * 0.04) * move;
      const lift0 = (0.045 + run * 0.045) * move;
      const bob = Math.abs(sinP) * (0.045 + run * 0.035) * move;
      const sway = sinP * 0.05 * move * (1 - run * 0.4) + dance * Math.sin(time * 6) * 0.12;

      // Lean into speed and acceleration, bank into turns.
      const wantPitch = move * 0.06 + run * 0.16 + clamp((s.accel || 0) * 0.02, -0.12, 0.12) * move;
      const wantRoll = clamp(-(s.turn || 0) * speed * 0.05, -0.28, 0.28);
      leanPitch = damp(leanPitch, wantPitch, 10, dt);
      leanRoll = damp(leanRoll, wantRoll, 8, dt);

      // Squash on landing, stretch while rising.
      if (s.landed > 1.2) {
        squash.impulse(-Math.min(9, s.landed) * 0.55);
        lagZ.impulse(-Math.min(6, s.landed) * 0.2);
      }
      const stretchTarget = s.grounded ? 0 : clamp((s.vy || 0) * 0.018, -0.06, 0.11);
      const sq = clamp(squash.update(stretchTarget, dt), -0.28, 0.2);
      mover.scale.set(1 / Math.sqrt(1 + sq), 1 + sq, 1 / Math.sqrt(1 + sq));
      mover.rotation.set(leanPitch * 0.5, spin, leanRoll * 0.6);

      const breathe = Math.sin(time * (w.sleep > 0.5 ? 1.2 : 2.2)) * (0.006 + w.sleep * 0.006);
      // On the grass she sinks down onto her bottom; on a seat she rests on it.
      // Panting: hard heaves, one every 0.3 s at first and slower as she
      // gets her breath back (the huffs and puffs keep the same time).
      if (pant > 0) pantPhase += (dt * Math.PI * 2) / (0.3 + pantP * 0.12);
      else pantPhase = 0;
      const heave = pant * Math.sin(pantPhase);
      hips.position.y = bob + breathe - w.sit * (0.09 - 0.065 * w.seat) - w.rest * 0.012 - w.wade * 0.04 + hop * 0.12 - bend * 0.03 + tap * 0.004
        + tiptoe * 0.045 + heave * 0.012 - pant * 0.016;
      hips.rotation.set(
        leanPitch * 0.5 + bend * 0.42 + lean * 0.2 - tug * 0.18 + w.peek * 0.16 - w.sit * 0.08
          + (s.grounded ? 0 : clamp(-(s.vy || 0) * 0.03, -0.2, 0.25)) + (s.swing || 0) * 0.3 + w.glide * 0.12 + w.sleep * 0.1
          + w.rail * (0.1 + Math.sin(time * 1.3) * 0.02) + pant * 0.28 - tiptoe * 0.05 + push * 0.2,
        sinP * 0.06 * move,
        sway + leanRoll * 0.3 + tiptoe * Math.sin(time * 7.5) * 0.045 - cuddle * 0.05,
      );

      // --------------------------------------------------- head --
      let wantYaw = 0;
      let wantPitchHead = 0;
      if (s.look && w.sleep < 0.3) {
        root.worldToLocal(tmp.copy(s.look));
        tmp.y -= 0.55;
        const yaw = Math.atan2(tmp.x, tmp.z);
        if (Math.abs(yaw) < 1.6) {
          wantYaw = clamp(yaw, -0.95, 0.95);
          wantPitchHead = clamp(-Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.45, 0.35);
        }
      }
      wantYaw = (wantYaw * (1 - move * 0.6) + lookSweep * 0.8) * (1 - w.peek);
      headYaw = damp(headYaw, wantYaw, 5, dt);
      headPitch = damp(headPitch, wantPitchHead * (1 - move * 0.5) * (1 - w.peek), 5, dt);
      e.set(
        headPitch - move * 0.05 + (s.grounded ? 0 : -0.1) - hop * 0.12 + bend * 0.15 - tug * 0.1 - w.peek * 0.12
          + w.sleep * 0.32 + yawn * -0.25 + armsUp * -0.12 + pant * (0.24 - pantP * 0.12) + heave * 0.06 - tiptoe * 0.08,
        headYaw - sinP * 0.06 * move,
        Math.sin(time * 0.9) * 0.07 * (1 - move) * (1 - w.sleep) + sinP * 0.035 * move + lean * 0.15 + w.peek * 0.12
          + w.sleep * 0.2 + dance * Math.sin(time * 6 + 1) * 0.15 - cuddle * 0.24,
      );
      head.quaternion.copy(headRest).multiply(q.setFromEuler(e));

      // ------------------------------------------------ face --
      blinkAt -= dt;
      if (blinkAt < -0.14) blinkAt = Math.random() < 0.2 ? 0.2 : 2 + Math.random() * 3.5;
      const now = time;
      let eyesKind = expression.until > now ? expression.kind : null;
      if (w.sleep > 0.55) eyesKind = "asleep";
      else if (cheer > 0.35 || squint > 0.5) eyesKind = eyesKind === "love" ? "love" : "happy";
      if (pant > 0.25 && w.sleep <= 0.55) eyesKind = "tired";
      face.showEyes(eyesKind === "surprised" ? null : eyesKind);
      eyes.visible = !eyesKind || eyesKind === "surprised";
      const lid = eyesKind === "surprised" ? 1.18 : w.sleep > 0.3 ? 1 - w.sleep * 0.8 : blinkAt < 0 ? 0.12 : 1;
      eyes.scale.y = eyeScale * lid;
      // At the telescope one eye is pressed to the eyepiece and the other is
      // squeezed shut in a happy wink.
      const winking = Boolean(eyeSides) && w.peek > 0.5 && eyes.visible;
      if (eyeSides) eyeSides[WINK_EYE].visible = !winking;
      face.wink(winking ? WINK_EYE : -1);
      const mouthOpen = Math.max(yawn * 1.2, cheer * 0.9, eyesKind === "surprised" ? 0.9 : 0, armsUp * 0.4 * (1 - yawn), s.grounded ? 0 : 0.35 * w.glide,
        tiptoe * 0.3, pant * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(pantPhase))));
      face.setMouth(mouthOpen);
      face.setTongue(pant * (0.85 + 0.15 * Math.sin(pantPhase)));
      face.setSweat(pant > 0.05 ? clamp((pantP - 0.08) / 0.8, 0, 1) : -1);
      const wantBlush = clamp((eyesKind === "love" ? 1 : eyesKind === "happy" ? 0.7 : 0) + stroke * 0.3 + lean * 0.4 + pant * 0.85
        + Math.abs(cuddle) * 0.6 + w.hold * 0.25, 0, 1);
      blushLevel = damp(blushLevel, wantBlush, 4, dt);
      face.setBlush(blushLevel);
      if (w.sleep > 0.8) {
        zzzTimer -= dt;
        if (zzzTimer <= 0) {
          zzzTimer = 1.6;
          events("zzz", head.getWorldPosition(tmp).clone().add(new THREE.Vector3(0.12, 0.3, 0)));
        }
      }

      // ------------------------------------------------ feet --
      feet.forEach((foot, i) => {
        const p = phase + i * Math.PI;
        const swing = Math.max(0, -Math.sin(p)); // lifted during the forward swing
        foot.position.copy(footBase[i]);
        foot.position.z += Math.cos(p) * stepAmp;
        foot.position.y += swing * lift0;
        // Tucked up in the air, dangling while gliding.
        foot.position.y += w.air * (0.035 - w.glide * 0.06) - (s.grounded ? 0 : 0.01) + tiptoe * 0.022;
        foot.position.z += w.air * 0.04 + tug * 0.04;
        // Sitting: legs forward (on a seat they hang and kick happily).
        foot.position.y += w.sit * (0.02 - w.seat * 0.13) + w.sit * w.seat * Math.max(0, Math.sin(time * 2.2 + i * Math.PI)) * 0.03 * (1 - w.sleep);
        foot.position.z += w.sit * 0.21;
        foot.position.x += (i ? 1 : -1) * w.rest * 0.02;
        if (i === 0) foot.position.y += tap * 0.03;
        e.set(-Math.sin(p) * 0.35 * move + w.sit * (w.seat * 0.5 - 0.2) + w.air * 0.25 + (i === 0 ? -tap * 0.5 : 0) + tiptoe * 0.55, 0, 0);
        foot.quaternion.copy(footRest[i]).multiply(q.setFromEuler(e));
      });

      // ------------------------------------------------ hands --
      const up = w.air * (0.13 + w.glide * 0.08) + hop * 0.14;
      if ((w.peek > 0.01 && s.grip) || w.point > 0.01 || w.hold > 0.01) root.updateMatrixWorld(true);
      hands.forEach((hand, i) => {
        const side = i ? 1 : -1;
        const p = phase + (i ? 0 : Math.PI);
        const reach = i ? reachR : reachL;
        hand.position.copy(handBase[i]);
        // Arms swing opposite the legs; pump higher when running.
        hand.position.z += Math.cos(p) * (0.06 + run * 0.05) * move;
        hand.position.y += Math.max(0, Math.cos(p)) * run * 0.05;
        hand.position.x += side * (hop * 0.03 - reach * 0.05 + w.glide * 0.1 + armsUp * 0.03) + (i ? stroke * 0.05 : 0);
        hand.position.y += up - reach * 0.16 + (i ? lift * 0.1 : lift * 0.06) + (i ? lean * 0.06 : 0) - w.sit * 0.05 + armsUp * 0.3;
        hand.position.z += reach * 0.13 + (i && hold.bouquet.visible ? 0.05 : 0) + (i ? lean * 0.17 : 0) + w.sit * 0.09 - armsUp * 0.05;
        hand.position.x -= side * w.sit * 0.04 * (1 - w.sleep); // paws together on the lap
        // Paws on the telescope tube, one each side, just ahead of her face.
        if (w.peek > 0.01 && s.grip) {
          hips.worldToLocal(tmp.copy(s.grip));
          tmp.x += side * 0.085;
          tmp.y -= 0.045;
          hand.position.lerp(tmp, w.peek);
        }
        if (i === 1 && waveHand > 0) {
          hand.position.y += waveHand * 0.32;
          hand.position.x += waveHand * (0.05 + Math.sin(time * 14) * 0.05);
        }
        if (dance > 0) hand.position.y += dance * Math.max(0, Math.sin(time * 6 + i * Math.PI)) * 0.25;
        // Clapping: paws meet in front of her chest a few times a second.
        if (clap > 0) {
          const apart = 0.5 + 0.5 * Math.cos(time * 15);
          hand.position.lerp(tmp.set(side * (0.028 + apart * 0.07), 0.31 + apart * 0.02, 0.15), clap);
        }
        if (bow > 0) hand.position.lerp(tmp.set(side * 0.035, 0.24, 0.13), bow * 0.8);
        // Panting: paws down on her knees.
        if (pant > 0) hand.position.lerp(tmp.set(side * 0.11, 0.2 + heave * 0.012, 0.13), pant * 0.75);
        // Pushing (the swing): both paws up and out in front.
        if (push > 0) hand.position.lerp(tmp.set(side * 0.085, 0.47, 0.2), push);
        // On tiptoe the free paw goes up too, for balance.
        if (tiptoe > 0 && i !== (s.pointHand ?? 1)) hand.position.y += tiptoe * (0.07 + Math.sin(time * 7.5 + 1) * 0.02);
        // Paws resting on the balloon basket's rim (a wave still lifts one).
        if (w.rail > 0.01) {
          const rest = w.rail * (i === 1 ? 1 - waveHand : 1);
          hand.position.lerp(tmp.set(side * 0.15, 0.3 + Math.sin(time * 2 + i) * 0.01, 0.31), rest);
        }
        if (twitch > 0 && i === 1) hand.position.y += twitch * 0.1;
        if (i === outfit.umbrellaPaw && outfit.umbrella > 0.01) {
          const grip = outfit.umbrella * (1 - w.glide);
          tmp.copy(UMBRELLA_GRIP).setY(UMBRELLA_GRIP.y + (w.sit > 0.5 ? -0.03 : 0));
          if (i) tmp.x = -tmp.x;
          hand.position.lerp(tmp, grip);
        }
        // Showing something: the paw with the pointer reaches out towards it,
        // up at shoulder height (the arm is ~0.22 long from the shoulder).
        if (w.point > 0.01 && i === (s.pointHand ?? 1)) {
          hips.worldToLocal(pointFrom.copy(pointAt));
          const shoulder = tmp.set(side * 0.12, 0.36, 0.04);
          const reachDir = pointFrom.sub(shoulder).normalize();
          const target = shoulder.clone().addScaledVector(reachDir, 0.22 + tiptoe * 0.06);
          target.y = Math.max(target.y, 0.26);
          // Never through her own head (a 0.245 ball centred 0.51 up).
          const fromHead = target.clone().sub(tmp.set(0, 0.51, 0.01));
          if (fromHead.length() < 0.32) target.copy(tmp).add(fromHead.setLength(0.32));
          hand.position.lerp(target, w.point);
        }
        // Hand in hand: this paw goes out to the other bunny's (an arm's
        // length at most). A paw with an umbrella in it stays where it is.
        if (w.hold > 0.01 && i === (s.holdHand ?? 0)) {
          hips.worldToLocal(holdTo.copy(holdAt));
          const shoulder = tmp.set(side * 0.12, 0.3, 0.03);
          holdTo.sub(shoulder);
          if (holdTo.length() > 0.27) holdTo.setLength(0.27);
          hand.position.lerp(holdTo.add(shoulder), w.hold * (i === outfit.umbrellaPaw ? 1 - outfit.umbrella : 1));
        }
        // Whatever the pose (a cheer, a dance, a wave, a yawn), a paw never
        // ends up inside her clothes, her tummy or her head: it slides out
        // round them. (At the telescope the paws hold the tube just in front
        // of her face.)
        if (w.peek < 0.5) clearOfOutfit(outfitReach, hand.position, cloth.uniforms, outfit.scarf);
        if (w.peek < 0.5) {
          const fromHead = tmp.subVectors(hand.position, HEAD_CENTRE);
          if (fromHead.length() < PAW_CLEAR) {
            if (fromHead.lengthSq() < 1e-6) fromHead.set(side, 0, 0);
            hand.position.copy(HEAD_CENTRE).add(fromHead.setLength(PAW_CLEAR));
          }
        }
        if (i === 0) hold.leftPawBusy(outfit.umbrellaPaw === 0 && outfit.umbrella > 0.5);
        e.set(0, 0, side * (w.glide * 0.6 + armsUp * 0.4) + (i === 1 ? waveHand * Math.sin(time * 14) * 0.4 : 0));
        hand.quaternion.copy(handRest[i]).multiply(q.setFromEuler(e));
      });
      hold.pointers.forEach((stick, i) => {
        stick.visible = Boolean(s.pointer) && i === (s.pointHand ?? 1);
        if (!stick.visible) return;
        hands[i].updateWorldMatrix(true, false);
        hands[i].getWorldPosition(pointFrom);
        // Resting: tip up, leaning out to her side (clear of her face) and a
        // little forward; showing something: at it.
        root.getWorldQuaternion(rootQuat);
        restAim.set((Math.sign(handBase[i].x) || (i ? 1 : -1)) * 0.55, 1, 0.18).applyQuaternion(rootQuat).normalize();
        const aim = w.point > 0.01 ? tmp.subVectors(pointAt, pointFrom).normalize().lerp(restAim, 1 - w.point) : tmp.copy(restAim);
        clearOfHead(pointFrom, aim.normalize());
        pointQuat.setFromUnitVectors(UP_Y, aim);
        hands[i].getWorldQuaternion(handQuat);
        stick.quaternion.copy(handQuat.invert().multiply(pointQuat));
      });
      // Under the balloon, on the swing or at the telescope the umbrella stays shut.
      outfit.update(time, dt, { rain: s.shelter ? 0 : weather.rain, snow: weather.snow, move, sway, run, hand: s.umbrellaHand ?? 0 });

      // -------------------------------------------------- ears --
      head.getWorldPosition(headWorld);
      if (dt > 0) headVy = damp(headVy, (headWorld.y - lastHead.y) / dt, 12, dt);
      lastHead.copy(headWorld);
      const speedDrag = move * 0.25 + run * 0.4;
      const fallLift = s.grounded ? 0 : clamp(-(s.vy || 0) * 0.08, -0.3, 0.6);
      ears.forEach((ear, i) => {
        const bounce = Math.sin(phase * 2 + 0.6 + i) * 0.22 * move;
        const inertia = clamp(-headVy * 0.12, -0.35, 0.35);
        let backTarget;
        let flopTarget;
        if (ear.side < 0 && floppy) {
          // Lop ear: folds forward, springs up when she's happy or falling.
          backTarget = -0.95 + hop * 0.6 + w.air * 0.55 - bounce * 0.4 - squint * 0.2 + speedDrag * 0.6 + fallLift + inertia + w.sleep * -0.15 - pant * 0.2;
          flopTarget = ear.side * (0.28 + bounce * 0.3 + w.sleep * 0.2 + pant * 0.2);
        } else {
          backTarget = 0.22 + bounce * 0.5 - w.air * 0.3 + squint * 0.25 + speedDrag + fallLift * 0.5 + inertia + w.sleep * 0.5 + pant * 0.55;
          flopTarget = ear.side * (0.06 + bounce * 0.2 + w.sleep * 0.35 + pant * 0.3);
        }
        if (twitch > 0 && i === 1) backTarget -= Math.sin(time * 30) * 0.25 * twitch;
        // Up in the balloon the breeze streams her ears back.
        backTarget += w.rail * (0.45 + Math.sin(time * 9 + i) * 0.08);
        const back = ear.back.update(backTarget, dt);
        const flop = ear.flop.update(flopTarget, dt);
        const wiggle = Math.sin(time * 3 + i * 1.3) * 0.05;
        // Gliding: both ears spread out and flutter like little wings.
        const flutter = w.glide * Math.sin(time * 38 + i * Math.PI) * 0.35;
        e.set(-0.06 - move * 0.2 + w.air * 0.3 + wiggle - hop * 0.2 + bend * 0.3 + flutter * 0.4, 0, -ear.side * (0.18 + w.glide * 0.9) + flutter);
        ear.node.quaternion.copy(ear.rest).multiply(q.setFromEuler(e));
        ear.bender.bend(flop, back);
      });

      // ------------------------------------------------ cloth --
      const lagTargetX = clamp(-(s.turn || 0) * speed * 0.04, -0.25, 0.25);
      const lagTargetZ = clamp(-(s.accel || 0) * 0.02, -0.25, 0.25);
      // (His shorts are stiffer than her skirt: they barely sway.)
      cloth.uniforms.uLag.value.set(lagX.update(lagTargetX, dt) * clothAmount, lagZ.update(lagTargetZ, dt) * clothAmount);
      if (w.seat > 0.01 && w.sit > 0.01 && dressMesh) {
        // Where the seat top and its front edge are, seen from the skirt.
        root.updateMatrixWorld(true);
        toDress.copy(dressMesh.matrixWorld).invert();
        seatPoint.copy(root.position).applyMatrix4(toDress);
        cloth.uniforms.uSeatY.value = seatPoint.y + 0.006;
        const edge = s.seatEdge ?? 0.1;
        seatPoint.set(root.position.x + Math.sin(root.rotation.y) * edge, root.position.y, root.position.z + Math.cos(root.rotation.y) * edge).applyMatrix4(toDress);
        cloth.uniforms.uSeatFront.value = seatPoint.z;
      } else {
        cloth.uniforms.uSeatY.value = -10;
        cloth.uniforms.uSeatFront.value = 10;
      }
      cloth.uniforms.uSit.value = w.sit * clothAmount;
      cloth.uniforms.uSeat.value = w.seat;
      cloth.uniforms.uMove.value = move * clothAmount;
      cloth.uniforms.uAir.value = Math.max(w.air, w.glide) * clothAmount;
      cloth.uniforms.uClothTime.value = time;
    },
    dispose() {
      root.traverse((object) => object.geometry?.dispose());
      face.dispose();
      hold.dispose();
      outfit.dispose();
      parts.materials.forEach((m) => m.dispose());
      shadow.material.dispose();
      shadowMap.dispose();
    },
  };
}

// ----------------------------------------------------------- loaders --
export async function loadBunny(style = "girl") {
  const spec = CHARACTERS[style] || CHARACTERS.girl;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(spec.url);
  const get = (name) => {
    const node = gltf.scene.getObjectByName(name);
    if (!node) throw new Error(`Bunny part ${name} is missing`);
    return node;
  };
  const meshOf = (node) => {
    let found = null;
    node.traverse((o) => {
      if (!found && o.isMesh && !o.name.startsWith("Bunny_Bow")) found = o;
    });
    return found;
  };
  gltf.scene.updateMatrixWorld(true);
  const body = get("Bunny_Body");
  const dress = get("Bunny_Dress");
  const head = get("Bunny_Head");
  const eyes = get("Bunny_Eyes");
  const hands = [get("Bunny_HandL"), get("Bunny_HandR")];
  const feet = [get("Bunny_FootL"), get("Bunny_FootR")];
  const earNodes = [get("Bunny_EarL"), get("Bunny_EarR")];
  const dressMesh = meshOf(dress);
  // Her middle (the model's origin) in the skirt's own space: the tail on the
  // back of the skirt makes its box lopsided.
  const middle = dressMesh.worldToLocal(new THREE.Vector3(0, 0, 0));
  const cloth = clothMaterial(dressMesh.geometry, { centre: new THREE.Vector2(middle.x, middle.z) });
  const fur = furMaterial();
  const eyeMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: "#ffffff" });
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    object.material.dispose();
    object.material = object === dressMesh ? cloth.material : object.name === "Bunny_Eyes" ? eyeMaterial : fur;
  });
  // Face landmarks in head space (robust to compression node scales).
  const headInverse = head.matrixWorld.clone().invert();
  const toHead = (modelPoint) => modelPoint.clone().applyMatrix4(gltf.scene.matrixWorld).applyMatrix4(headInverse);
  return createRig(
    { body, dress, dressMesh, head, eyes, hands, feet, ears: earNodes, earMeshes: earNodes.map(meshOf), cloth, materials: [fur, cloth.material, eyeMaterial] },
    { floppy: spec.floppy, clothAmount: spec.clothAmount, toHead },
  );
}

// A simple procedural bunny with the same rig, used if the model can't load.
export function createFallbackBunny() {
  const fur = furMaterial();
  const part = (geometry, name) => {
    const mesh = new THREE.Mesh(geometry, fur);
    mesh.name = name;
    return mesh;
  };
  const body = part(mergeGeometries([sphere(0.13, "#fff6f0", [0, 0.2, 0], [1, 0.95, 0.92], 16), sphere(0.045, "#ffffff", [0, 0.17, -0.14])]), "Bunny_Body");
  const skirt = new THREE.CylinderGeometry(0.11, 0.2, 0.2, 24, 4, true).translate(0, 0.12, 0);
  const dressMesh = new THREE.Mesh(colored(skirt, "#ffa9c8"), fur);
  const cloth = clothMaterial(dressMesh.geometry);
  dressMesh.material = cloth.material;
  const dress = new THREE.Group();
  dress.add(dressMesh);
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.01);
  head.add(part(mergeGeometries([
    sphere(0.235, "#fff6f0", [0, 0, 0], [1.05, 0.95, 1], 20),
    sphere(0.014, "#ff86ad", [0, -0.03, 0.228], [1.3, 0.9, 0.7], 8),
  ]), "Bunny_Face"));
  const eyes = part(mergeGeometries([
    sphere(0.046, INK, [-0.088, 0, 0], [0.86, 1.15, 0.5], 12),
    sphere(0.046, INK, [0.088, 0, 0], [0.86, 1.15, 0.5], 12),
  ]), "Bunny_Eyes");
  eyes.position.set(0, -0.01, 0.2);
  head.add(eyes);
  const earMeshes = [-1, 1].map((side) => {
    const mesh = part(sphere(0.055, "#fff6f0", [0, 0.16, 0], [1, 2.8, 0.66], 12), side < 0 ? "Bunny_EarL" : "Bunny_EarR");
    const node = new THREE.Group();
    node.position.set(side * 0.1, 0.14, -0.03);
    node.add(mesh);
    head.add(node);
    return { node, mesh };
  });
  const hands = [-1, 1].map((side) => {
    const hand = part(sphere(0.046, "#fff6f0", [0, 0, 0], [1, 1, 1], 10), "Bunny_Hand");
    hand.position.set(side * 0.155, 0.21, 0.05);
    return hand;
  });
  const feet = [-1, 1].map((side) => {
    const foot = part(sphere(0.058, "#fff6f0", [0, 0, 0.02], [1, 0.62, 1.35], 10), "Bunny_Foot");
    foot.position.set(side * 0.08, 0.03, 0);
    return foot;
  });
  const toHead = (modelPoint) => modelPoint.clone().sub(head.position);
  return createRig(
    { body, dress, dressMesh, head, eyes, hands, feet, ears: earMeshes.map((x) => x.node), earMeshes: earMeshes.map((x) => x.mesh), cloth, materials: [fur, cloth.material] },
    { floppy: true, clothAmount: 1, toHead, scale: 1.18 },
  );
}

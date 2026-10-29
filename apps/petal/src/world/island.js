import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { slotContent, createSlotTexture, slotPhotoRegions, slotTextRegions, SLOT_NAMES } from "./slot-art.js";
import { createMapBalloon } from "./map-balloon.js";
import { ENV_GLSL, addNearFade, environment, useEnvironment } from "../core/uniforms.js";
import { createLayout } from "./layout.js";

export { TOUR_STOPS } from "./slot-art.js";

const MODEL_URL = "/island/petal-isle-cute.glb?v=31";

// Every island shader reads the shared environment uniforms (clock, wind,
// wetness, snow, night) from core/uniforms.js, updated once per frame.
function patch(material, { vertexHead = "", vertexBody = "", project = "", fragmentHead = "", fragmentBody = "", key = "", nearFade = false }) {
  material.onBeforeCompile = (shader) => {
    useEnvironment(shader);
    if (nearFade) addNearFade(shader, 0.2, 0.5);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${ENV_GLSL}\n${vertexHead}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertexBody}`);
    if (project) shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", project);
    if (fragmentHead || fragmentBody) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${ENV_GLSL}\n${fragmentHead}`)
        .replace("#include <dithering_fragment>", `${fragmentBody}\n#include <dithering_fragment>`);
    }
  };
  if (key) material.customProgramCacheKey = () => key;
  return material;
}

// Seamless 512px tile of hand-placed little blossoms or leaves.
function paintedTileTexture(kind) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const random = (() => {
    let seed = kind === "blossom" ? 11 : 29;
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  })();
  const wrap = (x, y, draw) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      if (x + dx > -40 && x + dx < size + 40 && y + dy > -40 && y + dy < size + 40) draw(x + dx, y + dy);
    }
  };
  if (kind === "blossom") {
    g.fillStyle = "#f0b3cc";
    g.fillRect(0, 0, size, size);
    const petals = ["#ffe0ec", "#ffcfe1", "#fff1f6", "#ffffff", "#ffbcd5", "#f0e4ff", "#ffd8e7"];
    for (let i = 0; i < 420; i += 1) {
      const x = random() * size, y = random() * size;
      const r = 9 + random() * 11;
      const color = petals[Math.floor(random() * petals.length)];
      const turn = random() * Math.PI;
      wrap(x, y, (px, py) => {
        g.fillStyle = "rgba(190,90,130,0.2)";
        g.beginPath();
        g.arc(px + 2, py + 3, r * 1.05, 0, Math.PI * 2);
        g.fill();
        for (let k = 0; k < 5; k += 1) {
          const a = turn + (k / 5) * Math.PI * 2;
          g.fillStyle = color;
          g.beginPath();
          g.ellipse(px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.55, r * 0.52, r * 0.4, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = random() > 0.5 ? "#ffd86b" : "#f08db3";
        g.beginPath();
        g.arc(px, py, r * 0.22, 0, Math.PI * 2);
        g.fill();
      });
    }
  } else {
    g.fillStyle = "#4f9a67";
    g.fillRect(0, 0, size, size);
    const greens = ["#6fbf7f", "#86cf8a", "#5aad73", "#9ad98f", "#4c9868"];
    for (let i = 0; i < 700; i += 1) {
      const x = random() * size, y = random() * size;
      const r = 8 + random() * 10;
      const a = random() * Math.PI * 2;
      const color = greens[Math.floor(random() * greens.length)];
      wrap(x, y, (px, py) => {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(px, py, r, r * 0.5, a, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(40,90,60,0.35)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(px - Math.cos(a) * r * 0.8, py - Math.sin(a) * r * 0.8);
        g.lineTo(px + Math.cos(a) * r * 0.8, py + Math.sin(a) * r * 0.8);
        g.stroke();
      });
    }
    const tiny = ["#ffffff", "#ffd0e2", "#e7dbff"];
    for (let i = 0; i < 70; i += 1) {
      const x = random() * size, y = random() * size, r = 4 + random() * 3;
      const color = tiny[Math.floor(random() * tiny.length)];
      wrap(x, y, (px, py) => {
        g.fillStyle = color;
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath();
          g.arc(px + Math.cos(a) * r * 0.6, py + Math.sin(a) * r * 0.6, r * 0.45, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#ffd86b";
        g.beginPath();
        g.arc(px, py, r * 0.25, 0, Math.PI * 2);
        g.fill();
      });
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Tri-planar projection: no UVs needed, no visible seams on round shapes.
function triplanar(material, texture, scale) {
  material.onBeforeCompile = (shader) => {
    useEnvironment(shader);
    addNearFade(shader, 0.3, 0.75);
    shader.uniforms.uTri = { value: texture };
    shader.uniforms.uTriScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        varying vec3 vTriPos;
        varying vec3 vTriNormal;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vTriPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vTriNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        ${ENV_GLSL}
        uniform sampler2D uTri;
        uniform float uTriScale;
        varying vec3 vTriPos;
        varying vec3 vTriNormal;`)
      .replace("#include <map_fragment>", `
        vec3 triN = normalize(vTriNormal);
        vec3 triW = pow(abs(triN), vec3(4.0));
        triW /= triW.x + triW.y + triW.z;
        vec3 triP = vTriPos * uTriScale;
        vec3 triC = texture2D(uTri, triP.zy).rgb * triW.x + texture2D(uTri, triP.xz).rgb * triW.y + texture2D(uTri, triP.xy).rgb * triW.z;
        diffuseColor.rgb *= triC;
        float snowCap = smoothstep(0.25, 0.75, triN.y) * smoothstep(0.0, 0.9, uSnow * 1.2 - (1.0 - dot(triC, vec3(0.33))) * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.97, 1.0), snowCap);
        diffuseColor.rgb *= 1.0 - uWet * 0.15;
      `);
  };
  material.customProgramCacheKey = () => `triplanar-${scale}`;
  return material;
}

// Realistic surface detail for the merged island: each vertex carries a
// surface id (_surface: 1 grass, 2 stone, 3 bark, 4 wood, 5 path). The shader
// projects the matching channel of one tiling detail texture from three axes,
// tints the painted colour with it and bends the normal for real relief.
function detailMaterial(detail, quality) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!detail) return material;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    useEnvironment(shader);
    addNearFade(shader, 0.2, 0.5);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        attribute float _surface;
        varying float vSurface;
        varying vec3 vDetailPos;
        varying vec3 vDetailNormal;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vSurface = _surface;
        vDetailPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vDetailNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        ${ENV_GLSL}
        uniform sampler2D uDetail;
        varying float vSurface;
        varying vec3 vDetailPos;
        varying vec3 vDetailNormal;`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        // Snow settles on upward faces in soft drifts (smooth noise from the
        // detail texture at a large scale); the relief underneath fades out.
        vec3 wn = normalize(vDetailNormal);
        float up = smoothstep(0.45, 0.85, wn.y);
        float drift = texture2D(uDetail, vDetailPos.xz * 0.13).a;
        float snowMask = up * smoothstep(0.05, 0.45, uSnow * 1.3 - drift * 0.35);
        float surf = floor(vSurface + 0.5);
        if (surf > 0.5) {
          // Channel mask and texture scale (tiles per metre) for this surface.
          vec4 mask = surf == 1.0 ? vec4(0.0, 0.0, 0.0, 1.0)
                    : surf == 2.0 ? vec4(0.0, 0.0, 1.0, 0.0)
                    : surf == 3.0 ? vec4(0.0, 1.0, 0.0, 0.0)
                    : surf == 4.0 ? vec4(1.0, 0.0, 0.0, 0.0)
                    : vec4(0.0, 0.0, 1.0, 0.0);
          float scale = surf == 1.0 ? 0.9 : surf == 2.0 ? 0.55 : surf == 3.0 ? 1.1 : surf == 4.0 ? 1.6 : 0.75;
          float strength = surf == 1.0 ? 0.35 : surf == 2.0 ? 0.55 : surf == 3.0 ? 0.6 : surf == 4.0 ? 0.45 : 0.12;
          vec3 w = pow(abs(normalize(vDetailNormal)), vec3(4.0));
          w /= w.x + w.y + w.z;
          vec3 p = vDetailPos * scale;
          float h = dot(texture2D(uDetail, p.zy), mask) * w.x
                  + dot(texture2D(uDetail, p.xz), mask) * w.y
                  + dot(texture2D(uDetail, p.xy), mask) * w.z;
          diffuseColor.rgb *= 1.0 + (h - 0.5) * strength * 1.6 * (1.0 - snowMask);
          #ifdef DETAIL_BUMP
            // Screen-space bump from the detail height (no tangents needed).
            vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
            float hx = dFdx(h), hy = dFdy(h);
            vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
            float det = dot(dpdx, r1);
            vec3 grad = sign(det) * (hx * r1 + hy * r2);
            normal = normalize(abs(det) * normal - grad * strength * 0.9 * (1.0 - snowMask * 0.9));
          #endif
        }
        // Snow on top; rain darkens and cools everything, most on open ground.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.96, 1.0) * (0.95 + drift * 0.07), snowMask);
        diffuseColor.rgb *= 1.0 - uWet * (0.2 * up + 0.08) * (1.0 - snowMask);`)
      .replace("#include <dithering_fragment>", `
        {
          float up = smoothstep(0.45, 0.85, normalize(vDetailNormal).y);
          float grazing = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          gl_FragColor.rgb += uWet * grazing * up * 0.2 * vec3(0.8, 0.85, 1.0) * (1.0 - uNight * 0.6);
          // A few glints in fresh snow where the sun catches it.
          float glint = step(0.9975, fract(sin(dot(floor(vDetailPos.xz * 38.0), vec2(12.9898, 78.233))) * 43758.5453));
          gl_FragColor.rgb += glint * up * smoothstep(0.6, 1.0, uSnow) * 0.35 * (1.0 - uNight);
        }
        #include <dithering_fragment>`);
  };
  if (quality !== "low") material.defines = { DETAIL_BUMP: "" };
  material.customProgramCacheKey = () => `island-detail-${quality}`;
  return material;
}

function makeMaterials(detail, quality) {
  const palette = detailMaterial(detail, quality);

  // Flowers lean very slightly in a slow breeze; only the heads move.
  const flowers = patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
    key: "island-flowers",
    nearFade: true,
    vertexHead: "varying float vSnowTip;",
    project: `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec3 root = instanceMatrix[3].xyz;
      #else
        vec3 root = vec3(0.0);
      #endif
      // Height above the flower's root in metres (instances are scaled).
      float stemH = clamp(mvPosition.y - root.y, 0.0, 0.6);
      float bend = stemH * stemH * 4.0;
      // Gusts roll across the meadow along the wind; each head also nods.
      float along = dot(root.xz, uWindDir);
      float gust = 0.5 + 0.5 * sin(along * 0.85 - uTime * 2.1);
      float nod = sin(uTime * 1.7 + root.x * 1.7 + root.z * 1.3);
      vec2 push = uWindDir * uWind * (0.02 + 0.045 * gust) + vec2(uWindDir.y, -uWindDir.x) * nod * 0.012 * uWind;
      // Bend away from the bunny as she walks through.
      vec2 away = root.xz - uPlayer.xz;
      float near = (1.0 - smoothstep(0.12, 0.62, length(away))) * step(abs(root.y - uPlayer.y), 0.7);
      push += normalize(away + vec2(1e-4)) * near * 0.4;
      // …and around the animals nearby.
      for (int k = 0; k < 6; k++) {
        vec4 pusher = uPushers[k];
        vec2 apart = root.xz - pusher.xz;
        float touch = (1.0 - smoothstep(pusher.w * 0.35, pusher.w, length(apart))) * step(abs(root.y - pusher.y), 0.6) * step(0.001, pusher.w);
        push += normalize(apart + vec2(1e-4)) * touch * 0.32;
      }
      mvPosition.xz += push * bend;
      mvPosition.y -= dot(push, push) * bend * 0.5;
      vSnowTip = stemH;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `,
    fragmentHead: "varying float vSnowTip;",
    fragmentBody: `
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.96, 0.97, 1.0), uSnow * 0.35 * smoothstep(0.02, 0.2, vSnowTip));
      gl_FragColor.rgb *= 1.0 - uWet * 0.12;
    `,
  });

  // Canopy and bushes are static; their surface is painted with thousands of
  // tiny flowers / leaves by a tiling texture projected from three axes.
  const blossomTexture = paintedTileTexture("blossom");
  const leafTexture = paintedTileTexture("leaf");
  const blossom = triplanar(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ffc2da", emissiveIntensity: 0.12 }), blossomTexture, 0.9);
  const foliage = triplanar(new THREE.MeshLambertMaterial({ vertexColors: true }), leafTexture, 0.85);

  // Waterfalls: falling white streaks over clear turquoise water, foam at the
  // lip, and a soft fade into the mist below. Flat pools get gentle ripples.
  const water = patch(
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    {
      vertexHead: `varying vec3 vWaterPos;
        varying float vFlat;`,
      vertexBody: `vWaterPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vFlat = abs(normal.y);`,
      fragmentHead: `
        varying vec3 vWaterPos;
        varying float vFlat;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
        }`,
      fragmentBody: `
        vec3 deep = mix(vec3(0.42, 0.78, 0.9), vec3(0.11, 0.18, 0.42), uNight);
        vec3 foam = mix(vec3(1.0), vec3(0.55, 0.62, 0.85), uNight);
        float across = (vWaterPos.x + vWaterPos.z) * 9.0;
        float fall = wNoise(vec2(across, vWaterPos.y * 1.6 + uTime * 3.2)) * 0.65 + wNoise(vec2(across * 2.3, vWaterPos.y * 3.1 + uTime * 5.0)) * 0.35;
        float streak = smoothstep(0.5, 0.85, fall);
        float ripple = wNoise(vWaterPos.xz * (6.0 + uWet * 6.0) + uTime * (0.6 + uWet * 1.4));
        float flatness = smoothstep(0.6, 0.9, vFlat);
        vec3 col = mix(mix(deep, foam, streak * 0.85), mix(deep * 1.1, foam, smoothstep(0.62, 0.9, ripple) * 0.5), flatness);
        // Still water mirrors the sky at grazing angles and sparkles in the sun.
        vec3 viewDir = normalize(cameraPosition - vWaterPos);
        vec2 wobble = vec2(wNoise(vWaterPos.xz * 3.1 + uTime * 0.45), wNoise(vWaterPos.zx * 2.7 - uTime * 0.38)) - 0.5;
        vec3 waterNormal = normalize(vec3(wobble.x * 0.35, 1.0, wobble.y * 0.35));
        float fresnel = pow(1.0 - clamp(dot(viewDir, waterNormal), 0.0, 1.0), 3.0);
        col = mix(col, uHorizon * mix(1.05, 0.55, uNight), fresnel * 0.6 * flatness);
        float glint = pow(max(dot(reflect(-viewDir, waterNormal), uSunDir), 0.0), 140.0);
        col += vec3(1.0, 0.96, 0.9) * glint * 1.6 * flatness * (1.0 - uNight) * (1.0 - uWet * 0.8) * step(0.0, uSunDir.y);
        gl_FragColor.rgb = col;
        float fade = mix(smoothstep(-3.0, -1.2, vWaterPos.y), 1.0, flatness);
        gl_FragColor.a = mix(0.62 + streak * 0.38, 0.85, flatness) * fade;
      `,
    },
  );

  const glow = patch(new THREE.MeshBasicMaterial({ vertexColors: true, color: "#ffffff", toneMapped: false }), {
    fragmentBody: "gl_FragColor.rgb *= 1.25 + 0.6 * uNight + 0.12 * sin(uTime * 2.3);",
  });

  glow.name = "lamp-glow";
  const stone = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ffb8d2", emissiveIntensity: 0 });
  return { palette, flowers, foliage, blossom, water, glow, stone, textures: [blossomTexture, leafTexture, ...(detail ? [detail] : [])] };
}

// A tiny painted matcap gives the heart stones a glossy candy look for the
// cost of a single texture lookup.
function candyMatcap(base, light, shadow) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const body = g.createRadialGradient(size * 0.42, size * 0.38, size * 0.05, size * 0.5, size * 0.5, size * 0.52);
  body.addColorStop(0, light);
  body.addColorStop(0.45, base);
  body.addColorStop(1, shadow);
  g.fillStyle = body;
  g.fillRect(0, 0, size, size);
  const shine = g.createRadialGradient(size * 0.34, size * 0.28, 0, size * 0.34, size * 0.28, size * 0.16);
  shine.addColorStop(0, "rgba(255,255,255,0.95)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = shine;
  g.fillRect(0, 0, size, size);
  const rim = g.createRadialGradient(size * 0.5, size * 0.5, size * 0.4, size * 0.5, size * 0.5, size * 0.5);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(255,240,250,0.55)");
  g.fillStyle = rim;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Wooden signs: bold upright letters with a dark outline (thin italics on
// light wood couldn't be read from a few steps away), a little lit; after
// dark their glow grows (boost).
const signLettering = (text, extra = {}) => ({
  w: 1024, h: 256, size: 150, color: "#fff7e8", font: "700", outline: "#5a3420", glow: 0.35, boost: 2, lines: (c) => [text(c)], ...extra,
});

// A sign at a turning off the path: its number, then the garden's name (a
// long name goes on two lines, broken at the space nearest its middle).
export function turningLines(number, name) {
  const words = String(name).trim();
  const first = `${number} · `;
  if (words.length <= 14 || !words.includes(" ")) return [first + words];
  let cut = -1;
  for (let i = words.indexOf(" "); i >= 0; i = words.indexOf(" ", i + 1)) {
    if (cut < 0 || Math.abs(i - words.length / 2) < Math.abs(cut - words.length / 2)) cut = i;
  }
  return [first + words.slice(0, cut), words.slice(cut + 1)];
}
const turningSign = (number, name) => signLettering(name, { size: 128, lines: (c) => turningLines(number, name(c)) });

// Lettering planes on the stone, hearts, map and signs; redrawn from content.
// `night`: the colour (and strength) its letters glow in after dark; `edit`:
// the words it shows, editable in place in edit mode (the island names on
// the signposts are not).
const MAP_GLOW = ["#ffd9a0", 1.4];
const LETTERING = {
  TEXT_Question: { w: 1024, h: 560, size: 118, color: "#b0527a", font: "italic 600", night: ["#ffc8df", 0.7], edit: "question.text", lines: (c) => c.question.text.split(/\r?\n/) },
  TEXT_Yes: { w: 256, h: 128, size: 92, color: "#ffffff", font: "italic 700", shadow: "#b8406f", night: ["#ffffff", 0.35], edit: "question.yes", lines: (c) => [c.question.yes] },
  TEXT_No: { w: 256, h: 128, size: 92, color: "#ffffff", font: "italic 700", shadow: "#6e5aa8", night: ["#ffffff", 0.35], edit: "question.no", lines: (c) => [c.question.no] },
  TEXT_Map: { w: 1024, h: 96, size: 64, color: "#8a5a3c", font: "italic 600", night: MAP_GLOW, edit: "map.heading", lines: (c) => [c.map.heading] },
  TEXT_Place_1: { w: 512, h: 96, size: 62, color: "#8a5a3c", font: "italic 600", night: MAP_GLOW, edit: "map.places.0.title", lines: (c) => [c.map.places[0].title] },
  TEXT_Place_2: { w: 512, h: 96, size: 62, color: "#8a5a3c", font: "italic 600", night: MAP_GLOW, edit: "map.places.1.title", lines: (c) => [c.map.places[1].title] },
  TEXT_Place_3: { w: 512, h: 96, size: 62, color: "#8a5a3c", font: "italic 600", night: MAP_GLOW, edit: "map.places.2.title", lines: (c) => [c.map.places[2].title] },
  // The islands' names: where each bridge lands, and at the crossroads.
  TEXT_Isle_W: signLettering((c) => c.isles.meadow),
  TEXT_Isle_E: signLettering((c) => c.isles.pond),
  TEXT_Isle_N: signLettering((c) => c.isles.grove),
  TEXT_Isle_M: signLettering((c) => c.isles.music),
  TEXT_Isle_W2: signLettering((c) => c.isles.meadow),
  TEXT_Isle_E2: signLettering((c) => c.isles.pond),
  TEXT_Isle_N2: signLettering((c) => c.isles.grove),
  TEXT_Isle_M2: signLettering((c) => c.isles.music),
  // The turnings off the path, numbered in the order they are walked.
  TEXT_Isle_A: turningSign(1, (c) => c.isles.activity),
  TEXT_Isle_C: turningSign(2, (c) => c.isles.calendar),
  TEXT_Isle_P: turningSign(3, (c) => c.isles.map),
  TEXT_Isle_K: turningSign(4, (c) => c.isles.keepsake),
  TEXT_Sign: signLettering(() => "", { w: 1024, h: 476, size: 120, edit: "question.sign", lines: (c) => c.question.sign.split(/\r?\n/) }),
};

function createLettering(name) {
  const spec = LETTERING[name.replace(/\.\d+$/, "")];
  if (!spec) return null;
  const canvas = document.createElement("canvas");
  canvas.width = spec.w;
  canvas.height = spec.h;
  const g = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;
  const family = '"Cormorant Garamond", Georgia, serif';
  // The lines, their size (as large as fits) and the room each takes.
  function layout(content) {
    const lines = spec.lines(content).map((line) => line.trim()).filter(Boolean).slice(0, 5);
    const step = spec.h / Math.max(1, lines.length);
    let size = Math.min(spec.size, step * 0.92);
    g.font = `${spec.font} ${size}px ${family}`;
    const widest = Math.max(1, ...lines.map((line) => g.measureText(line).width));
    if (widest > spec.w * 0.92) size *= (spec.w * 0.92) / widest;
    return { lines, size, step };
  }
  function draw(content) {
    const { lines, size, step } = layout(content);
    g.clearRect(0, 0, spec.w, spec.h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `${spec.font} ${size}px ${family}`;
    lines.forEach((line, index) => {
      const y = step * (index + 0.5);
      if (spec.shadow) {
        g.fillStyle = spec.shadow;
        g.globalAlpha = 0.45;
        g.fillText(line, spec.w / 2 + 3, y + 4);
        g.globalAlpha = 1;
      }
      if (spec.outline) {
        g.lineJoin = "round";
        g.lineWidth = size * 0.17;
        g.strokeStyle = spec.outline;
        g.strokeText(line, spec.w / 2, y);
      }
      g.fillStyle = spec.color;
      g.fillText(line, spec.w / 2, y);
    });
    texture.needsUpdate = true;
  }
  // Where its words are, to edit them in place: the whole plane, a line each.
  function regions(content) {
    if (!spec.edit) return [];
    const { size, step } = layout(content);
    return [{ path: spec.edit, multiline: /^question\.(text|sign)$/.test(spec.edit),x: 0, y: 0, w: spec.w, h: spec.h, font: `${spec.font} ${size}px ${family}`, lineHeight: step, color: spec.color }];
  }
  return { texture, draw, regions, edit: spec.edit ?? null, glow: spec.glow ?? 0, night: spec.night ?? null, boost: spec.boost ?? 0 };
}

// After dark the lettering glows, so it can still be read: its letters light
// up in their night colour, and the signs' own glow grows.
function glowAtNight(material, { night, boost }) {
  if (!night && !boost) return;
  const uniforms = {
    uNight: environment.uNight,
    uGlowColor: { value: night ? new THREE.Color(night[0]).multiplyScalar(night[1]) : new THREE.Color(0, 0, 0) },
    uGlowBoost: { value: boost },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;\nuniform vec3 uGlowColor;\nuniform float uGlowBoost;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance *= 1.0 + uNight * uGlowBoost;
        totalEmissiveRadiance += uGlowColor * diffuseColor.a * uNight;`);
  };
}

// One draw call for every butterfly: wings flap in the vertex shader.
function createButterflies(count) {
  const shape = [];
  const wing = (sx, sy, scale) => {
    // Rounded wing fan: centre + 7 rim points.
    const pts = [];
    for (let i = 0; i <= 6; i += 1) {
      const a = (i / 6) * Math.PI * 0.95 + (sy > 0 ? 0.05 : Math.PI * 1.02);
      const r = scale * (0.75 + 0.25 * Math.sin(a * 2));
      pts.push([sx * Math.abs(Math.cos(a)) * r + sx * 0.04, Math.sin(a) * r * 0.9]);
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      shape.push([sx * 0.02, 0, 1], [...pts[i], 0], [...pts[i + 1], 0]);
    }
  };
  wing(1, 1, 1);
  wing(-1, 1, 1);
  wing(1, -1, 0.68);
  wing(-1, -1, 0.68);
  const positions = [];
  const colors = [];
  for (const [x, y, centre] of shape) {
    positions.push(x, 0, -y);
    const edge = centre ? 0 : 1;
    colors.push(1 - edge * 0.1, 1 - edge * 0.25, 1 - edge * 0.05);
  }
  // Tiny body.
  const body = [
    [0, 0.02, 0.45], [0.03, 0.02, -0.45], [-0.03, 0.02, -0.45],
  ];
  for (const p of body) {
    positions.push(...p);
    colors.push(0.35, 0.25, 0.35);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) phases[i] = i * 1.37;
  geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));

  const material = patch(
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }),
    {
      vertexHead: "attribute float aPhase;",
      vertexBody: `
        float flap = sin(uTime * 13.0 + aPhase) * 0.9 + 0.35;
        float side = sign(transformed.x);
        float ax = abs(transformed.x);
        transformed.y += sin(flap) * ax;
        transformed.x = side * cos(flap) * ax;
      `,
    },
  );
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  const tints = ["#ffb3d1", "#b9a8ff", "#9fd9ff", "#ffe39a", "#ffc4a8"];
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) mesh.setColorAt(i, color.set(tints[i % tints.length]));
  mesh.name = "Butterflies";
  return mesh;
}

// Drifting sakura petals and celebration hearts share one instanced system.
function createPetals(count) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0.5, 0.35, 0, 0, 0, 0, -0.5, -0.35, 0, 0, 0, 0.08, 0], 3),
  );
  geometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
  geometry.computeVertexNormals();
  const material = patch(new THREE.MeshBasicMaterial({ color: "#ffd1e3", side: THREE.DoubleSide, toneMapped: false }), {
    fragmentBody: "gl_FragColor.rgb *= 1.0 - uNight * 0.6;",
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.name = "Drifting petals";
  const tints = ["#ffd1e3", "#ffc0d8", "#fff0f6", "#e9dcff"];
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) mesh.setColorAt(i, color.set(tints[i % tints.length]));
  return mesh;
}

function createHearts(count) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(-0.55, -0.1, -0.6, 0.45, -0.28, 0.5);
  shape.bezierCurveTo(-0.1, 0.52, 0, 0.35, 0, 0.25);
  shape.bezierCurveTo(0, 0.35, 0.1, 0.52, 0.28, 0.5);
  shape.bezierCurveTo(0.6, 0.45, 0.55, -0.1, 0, -0.5);
  const geometry = new THREE.ShapeGeometry(shape, 5);
  const material = new THREE.MeshBasicMaterial({ color: "#ff8fb8", side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.name = "Celebration hearts";
  const tints = ["#ff8fb8", "#ffb3cf", "#ff6f9f", "#d9b8ff", "#fff0f6"];
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) mesh.setColorAt(i, color.set(tints[i % tints.length]));
  mesh.count = 0;
  return mesh;
}

export async function createCuteIsland(scene, onProgress = () => {}, { quality = "high", content, selections = {}, layout = createLayout(null) } = {}) {
  // Canvas lettering needs the web fonts loaded first (they're loaded on demand);
  // do not wait more than 2 s for them.
  const sample = "Petal Isle 2026";
  await Promise.race([
    Promise.all([
      document.fonts?.load('italic 600 64px "Cormorant Garamond"', sample),
      document.fonts?.load('700 64px "Cormorant Garamond"', sample),
      document.fonts?.load('600 64px "Cormorant Garamond"', sample),
      document.fonts?.load('600 32px "Nunito"', sample),
      document.fonts?.load('700 32px "Nunito"', sample),
    ]).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL, onProgress);
  const world = gltf.scene;
  world.name = "Petal Isle";
  scene.add(world);

  const detail = await new THREE.TextureLoader().loadAsync("/textures/detail.webp?v=1").catch(() => null);
  if (detail) {
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    detail.colorSpace = THREE.NoColorSpace;
    detail.anisotropy = 8;
  }
  const materials = makeMaterials(detail, quality);
  const gemYes = new THREE.MeshMatcapMaterial({ matcap: candyMatcap("#ff86b3", "#ffe1ee", "#c94d82") });
  const gemNo = new THREE.MeshMatcapMaterial({ matcap: candyMatcap("#a996f2", "#efe8ff", "#6f5cc0") });
  const textures = [gemYes.matcap, gemNo.matcap, ...materials.textures];
  const slots = [];
  const painters = [];
  const disposables = new Set(Object.values(materials).filter((value) => value.isMaterial));
  disposables.add(gemYes).add(gemNo);
  const flowerMeshes = [];
  const keep = { low: 0.5, medium: 0.75, high: 1 }[quality] ?? 1;

  world.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const old = object.material;
    const materialName = old?.name || "";
    const name = object.name;
    if (SLOT_NAMES.includes(name)) {
      const painter = createSlotTexture(name);
      painters.push({ kind: "slot", name, object, painter });
      textures.push(painter.texture);
      // The calendar is carved into the trunk: only its cuts are drawn, over
      // the bark.
      const carved = name === "SLOT_01_Calendar";
      object.material = carved
        ? new THREE.MeshLambertMaterial({ map: painter.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ map: painter.texture, emissive: "#7d4863", emissiveIntensity: 0.04, side: THREE.DoubleSide });
      if (carved) object.renderOrder = 2;
      disposables.add(object.material);
      object.userData.selectable = true;
      slots.push(object);
    } else if (name.startsWith("TEXT_")) {
      const painter = createLettering(name);
      if (painter) {
        painters.push({ kind: "text", name, object, painter });
        textures.push(painter.texture);
        object.material = new THREE.MeshLambertMaterial({
          map: painter.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide,
          ...(painter.glow ? { emissive: "#ffffff", emissiveMap: painter.texture, emissiveIntensity: painter.glow } : {}),
        });
        glowAtNight(object.material, painter);
        disposables.add(object.material);
        object.renderOrder = 2;
      } else object.visible = false;
    } else if (materialName === "Flowers") {
      object.material = materials.flowers;
      if (object.isInstancedMesh) flowerMeshes.push(object);
    } else if (materialName === "Foliage") object.material = materials.foliage;
    else if (materialName === "Blossom") object.material = materials.blossom;
    else if (materialName === "Water") object.material = materials.water;
    else if (materialName === "Glow") object.material = materials.glow;
    else if (materialName === "Gem yes") object.material = gemYes;
    else if (materialName === "Gem no") object.material = gemNo;
    else if (materialName === "Question stone") object.material = materials.stone;
    else object.material = materials.palette;
    if (old && old !== object.material) old.dispose();
  });

  // Lower quality tiers draw fewer of the smallest flowers; composition is kept
  // because instances were written in scatter order.
  if (keep < 1) {
    const matrix = new THREE.Matrix4();
    for (const mesh of flowerMeshes) {
      const total = mesh.count;
      const kept = Math.max(8, Math.round(total * keep));
      for (let i = 0; i < kept; i += 1) {
        mesh.getMatrixAt(Math.floor((i * total) / kept), matrix);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.count = kept;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Split every big flower batch by island region (the same regions the
  // island mesh is merged by), so the renderer skips islands out of view and
  // phones can skip distant ones — without multiplying draw calls.
  const flowerChunks = [];
  const regionOf = (x, z) => layout.regionOf(x, z);
  {
    const local = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();
    const where = new THREE.Vector3();
    const tint = new THREE.Color();
    world.updateMatrixWorld(true);
    for (const mesh of flowerMeshes) {
      if (mesh.count < 120 || !mesh.parent) {
        flowerChunks.push(mesh);
        continue;
      }
      const groups = new Map();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, local);
        where.setFromMatrixPosition(worldMatrix.multiplyMatrices(mesh.matrixWorld, local));
        const key = regionOf(where.x, where.z);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
      }
      if (groups.size < 2) {
        mesh.computeBoundingSphere();
        flowerChunks.push(mesh);
        continue;
      }
      for (const [key, indices] of groups) {
        const chunk = new THREE.InstancedMesh(mesh.geometry, mesh.material, indices.length);
        chunk.name = `${mesh.name} • ${key}`;
        chunk.position.copy(mesh.position);
        chunk.quaternion.copy(mesh.quaternion);
        chunk.scale.copy(mesh.scale);
        indices.forEach((from, to) => {
          mesh.getMatrixAt(from, local);
          chunk.setMatrixAt(to, local);
          if (mesh.instanceColor) chunk.setColorAt(to, mesh.getColorAt(from, tint));
        });
        chunk.computeBoundingSphere();
        mesh.parent.add(chunk);
        flowerChunks.push(chunk);
      }
      mesh.parent.remove(mesh);
      mesh.dispose();
    }
  }
  let detailDistance = Infinity;
  const chunkCentre = new THREE.Vector3();

  const butterflyCount = quality === "low" ? 8 : 14;
  const butterflies = createButterflies(butterflyCount);
  world.add(butterflies);
  const butterflyAnchors = [
    [-5.5, 2.8, 4.1], [-5.0, 2.2, 1.3], [-4.8, 2.6, -1.5], [-1.2, 3.6, -3.2],
    [2.8, 2.3, 0.2], [4.2, 2.7, -2.4], [5.8, 2.8, -4.1], [6.1, 3.2, 3.9],
    [0.3, 5.2, -0.8], [-6.3, 2.1, -0.7], [3.7, 2.2, 3.2], [-1.8, 2.7, 3.1],
    [-6.4, 2.4, 5.2], [-4.6, 2.3, 5.4],
  ].map((point) => new THREE.Vector3(...layout.spot(point))); // (written down in the first layout: each goes with its garden)

  const petalCount = quality === "low" ? 36 : 72;
  const petals = createPetals(petalCount);
  world.add(petals);
  const [treeX, , treeZ] = layout.spot([-0.55, 0, -4.55], 3);
  const petalSeeds = Array.from({ length: petalCount }, (_, i) => ({
    x: treeX + THREE.MathUtils.seededRandom(i + 1) * 20 - 11,
    z: treeZ + THREE.MathUtils.seededRandom(i + 101) * 16 - 8,
    speed: 0.25 + THREE.MathUtils.seededRandom(i + 201) * 0.3,
    offset: THREE.MathUtils.seededRandom(i + 301) * 10,
    spin: 0.5 + THREE.MathUtils.seededRandom(i + 401) * 1.5,
  }));

  const heartCount = 40;
  const hearts = createHearts(heartCount);
  world.add(hearts);
  let heartBurst = -1;

  const find = (test) => {
    let found = null;
    world.traverse((object) => {
      if (!found && test(object.name.toLowerCase().replace(/[^a-z0-9]/g, ""))) found = object;
    });
    return found;
  };
  const heart = find((name) => name.startsWith("littleengravedheart"));
  // The engraved heart glows on "yes" (scaling it would push it through the stone).
  const heartGlow = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#ff5c95", emissiveIntensity: 0 });
  disposables.add(heartGlow);
  if (heart) heart.material = heartGlow;
  const yesChoice = find((name) => name.startsWith("yesheart"));
  const noChoice = find((name) => name.startsWith("noheart"));
  const yesLabel = find((name) => name.startsWith("textyes"));
  const noLabel = find((name) => name.startsWith("textno"));
  if (!yesChoice || !noChoice) throw new Error("The Yes and No heart stones are missing from the island export.");
  // The gate's two leaves, each hinged at its pillar (gameplay/gate.js swings them).
  const gateLeaves = [find((name) => name.startsWith("gateleafl")), find((name) => name.startsWith("gateleafr"))].filter(Boolean);
  // Keep each heart's label glued to it when the heart wobbles.
  if (yesLabel) yesChoice.attach(yesLabel);
  if (noLabel) noChoice.attach(noLabel);
  const heartOrigin = new THREE.Vector3();
  yesChoice.geometry.computeBoundingBox();
  yesChoice.localToWorld(yesChoice.geometry.boundingBox.getCenter(heartOrigin));
  world.worldToLocal(heartOrigin);
  const yesBase = yesChoice.position.clone();

  // Mist puffs where each waterfall ends (lowest points of each stream).
  const mistPoints = [];
  world.traverse((object) => {
    if (!object.isMesh || object.material !== materials.water) return;
    const position = object.geometry.attributes.position;
    const lowest = new Map();
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      const key = `${Math.round(v.x / 1.2)},${Math.round(v.z / 1.2)}`;
      const best = lowest.get(key);
      if (!best || v.y < best.y) lowest.set(key, v.clone());
    }
    for (const point of lowest.values()) {
      if (point.y > -0.8) continue;
      mistPoints.push({ x: point.x, y: point.y + 0.2, z: point.z, size: 2.2, alpha: 0.75, bob: 0.08 });
      mistPoints.push({ x: point.x + 0.5, y: point.y - 0.4, z: point.z + 0.3, size: 3.2, alpha: 0.6, bob: 0.1 });
    }
  });

  let currentContent = content;
  let currentSelections = selections;
  // Which surfaces show the words at a content path (null: all of them).
  const SLOT_PATHS = [["activities.0.", 1], ["activities.1.", 2], ["activities.2.", 3], ["map.places.0.", 4], ["map.places.1.", 5], ["map.places.2.", 6]];
  function shows({ kind, name, painter }, path) {
    if (!path) return true;
    if (kind === "text") return painter.edit === path;
    if (path.startsWith("calendar.")) return name === "SLOT_01_Calendar";
    if (path.startsWith("book.")) return name.startsWith("SLOT_08") || name.startsWith("SLOT_09");
    return SLOT_PATHS.some(([prefix, index]) => path.startsWith(prefix) && name === SLOT_NAMES[index]);
  }
  function paint(path = null) {
    const info = slotContent(currentContent);
    for (const entry of painters) {
      const { kind, name, object, painter } = entry;
      if (kind === "slot") object.userData.content = info[name];
      if (!shows(entry, path)) continue;
      if (kind === "slot") painter.draw(currentContent, currentSelections);
      else painter.draw(currentContent);
    }
  }
  paint();
  const measure = document.createElement("canvas").getContext("2d");

  // A little balloon tours the treasure map's places.
  const mapBalloon = createMapBalloon(world, slots, { reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
  if (mapBalloon) textures.push(...mapBalloon.textures);

  const dummy = new THREE.Object3D();
  return {
    world,
    slots,
    mistPoints,
    setContent(next) {
      currentContent = next;
      paint();
    },
    // Edit mode: new words at `path`, redrawn on the surfaces that show them.
    preview(next, path) {
      currentContent = next;
      paint(path);
    },
    // Edit mode: every editable piece of words on the island, with the plane
    // it is painted on and where on it (canvas pixels).
    editRegions() {
      const out = [];
      for (const { kind, name, object, painter } of painters) {
        const image = painter.texture.image;
        const found = kind === "slot" ? slotTextRegions(name, currentContent, measure) : painter.regions(currentContent);
        const photos = kind === "slot" ? slotPhotoRegions(name, currentContent, measure).map((region) => ({ ...region, kind: "photo" })) : [];
        for (const region of [...found, ...photos]) out.push({ ...region, key: `${name}:${region.path}`, mesh: object, canvas: { w: image.width, h: image.height } });
      }
      return out;
    },
    setSelections(next) {
      currentSelections = next;
      paint();
    },
    yesChoice,
    noChoice,
    gateLeaves,
    butterflies: [],
    shrine: {
      reset() {
        heartGlow.emissiveIntensity = 0;
        materials.stone.emissiveIntensity = 0;
        heartBurst = -1;
        hearts.count = 0;
      },
      celebrate() {
        heartGlow.emissiveIntensity = 0.9;
        materials.stone.emissiveIntensity = 0.16;
        heartBurst = environment.uTime.value;
      },
    },
    // Hide every flower instance for which hide(worldPosition) is true.
    clearFlowers(hide) {
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      const local = new THREE.Matrix4();
      const worldMatrix = new THREE.Matrix4();
      const where = new THREE.Vector3();
      let hidden = 0;
      world.updateMatrixWorld(true);
      for (const chunk of flowerChunks) {
        let changed = false;
        for (let i = 0; i < chunk.count; i += 1) {
          chunk.getMatrixAt(i, local);
          if (local.elements[0] === 0 && local.elements[5] === 0) continue;
          where.setFromMatrixPosition(worldMatrix.multiplyMatrices(chunk.matrixWorld, local));
          if (hide(where)) {
            chunk.setMatrixAt(i, zero);
            hidden += 1;
            changed = true;
          }
        }
        if (changed) chunk.instanceMatrix.needsUpdate = true;
      }
      return hidden;
    },
    // Flowers further than this from the camera are skipped (phones while walking).
    setDetailDistance(distance) {
      detailDistance = distance;
      if (!Number.isFinite(distance)) flowerChunks.forEach((chunk) => (chunk.visible = true));
    },
    cull(camera) {
      if (!Number.isFinite(detailDistance)) return;
      for (const chunk of flowerChunks) {
        const sphere = chunk.boundingSphere;
        if (!sphere) continue;
        chunkCentre.copy(sphere.center).applyMatrix4(chunk.matrixWorld);
        chunk.visible = chunkCentre.distanceTo(camera.position) - sphere.radius < detailDistance;
      }
    },
    update(time, dt, celebrating = false) {
      environment.uTime.value = time;
      mapBalloon?.update(time, dt);
      const shelter = (1 - environment.uNight.value) * (1 - environment.uWet.value);
      world.position.y = Math.sin(time * 0.42) * 0.03;
      yesChoice.position.y = yesBase.y + Math.max(0, Math.sin(time * 2.2)) * 0.035;

      butterflyAnchors.slice(0, butterflies.count).forEach((anchor, index) => {
        const seed = index * 1.73;
        const x = anchor.x + Math.sin(time * 0.47 + seed) * (0.45 + (index % 3) * 0.12);
        const y = anchor.y + Math.sin(time * 0.88 + seed) * 0.26 + (celebrating ? Math.sin(time * 1.6 + index) * 0.15 : 0);
        const z = anchor.z + Math.cos(time * 0.41 + seed) * 0.5;
        dummy.position.set(x, y, z);
        const vx = Math.cos(time * 0.47 + seed) * 0.47;
        const vz = -Math.sin(time * 0.41 + seed) * 0.41 * 0.5;
        dummy.rotation.set(0, Math.atan2(vx, vz), 0);
        dummy.scale.setScalar(Math.max(0.0001, (0.11 + (index % 3) * 0.02) * shelter));
        dummy.updateMatrix();
        butterflies.setMatrixAt(index, dummy.matrix);
      });
      butterflies.instanceMatrix.needsUpdate = true;

      petalSeeds.forEach((seed, index) => {
        const t = (time * seed.speed + seed.offset) % 10;
        dummy.position.set(
          seed.x + Math.sin(time * 0.6 + seed.offset) * 0.8 + t * 0.35,
          7.5 - t * 0.85,
          seed.z + Math.cos(time * 0.5 + seed.offset) * 0.6,
        );
        dummy.rotation.set(time * seed.spin, time * seed.spin * 0.7, seed.offset);
        dummy.scale.setScalar(0.07 * Math.min(1, t * 2, (10 - t) * 2));
        dummy.updateMatrix();
        petals.setMatrixAt(index, dummy.matrix);
      });
      petals.instanceMatrix.needsUpdate = true;

      if (heartBurst >= 0) {
        const age = time - heartBurst;
        hearts.count = heartCount;
        for (let i = 0; i < heartCount; i += 1) {
          const t = (age * (0.3 + (i % 5) * 0.05) + i / heartCount) % 1;
          const angle = i * 2.399;
          const radius = 0.35 + t * (0.9 + (i % 4) * 0.2);
          dummy.position.set(
            heartOrigin.x + Math.cos(angle + t * 2) * radius,
            heartOrigin.y + t * 2.6,
            heartOrigin.z + Math.sin(angle + t * 2) * radius * 0.6,
          );
          dummy.rotation.set(0, Math.sin(time * 2 + i) * 0.6, Math.sin(time * 3 + i) * 0.25);
          dummy.scale.setScalar(0.13 * Math.sin(Math.PI * t) * (0.7 + (i % 3) * 0.2));
          dummy.updateMatrix();
          hearts.setMatrixAt(i, dummy.matrix);
        }
        hearts.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      textures.forEach((texture) => texture.dispose());
      disposables.forEach((material) => material.dispose());
      const geometries = new Set();
      world.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material && !disposables.has(object.material)) object.material.dispose();
      });
      geometries.forEach((geometry) => geometry.dispose());
      scene.remove(world);
    },
  };
}

import * as THREE from 'three';
import { canvas } from '../world/nightTextures.js';

// Little jack-o'-lantern faces for the ordinary pumpkins: a glowing carved face on a curved patch of the skin,
// turned to look at the path. Four expressions, shared by every pumpkin.

const PHI0 = Math.PI / 2 - 0.85, PHI_L = 1.7, TH0 = Math.PI / 2 - 0.8, TH_L = 1.5;
let faces = null;

function faceTextures() {
  if (faces) return faces;
  const draw = (fn) => {
    const W = 512, H = 300, [c, ctx] = canvas(W, H);
    const hole = (path) => {
      ctx.save(); path(); ctx.fillStyle = '#e8590c'; ctx.shadowColor = 'rgba(255,150,40,0.95)'; ctx.shadowBlur = 16; ctx.fill(); ctx.restore();
      ctx.save(); path(); ctx.clip(); ctx.translate(0, -5); path(); ctx.fillStyle = '#ffd36b'; ctx.fill(); ctx.restore();
    };
    fn(ctx, W, H, hole);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const tri = (ctx, x, y, w, h, flip = 1) => { ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2 * flip); ctx.lineTo(x + w / 2, y + h / 2 * flip); ctx.lineTo(x, y - h / 2 * flip); ctx.closePath(); };
  faces = [
    // classic: triangle eyes, a toothy grin
    draw((ctx, W, H, hole) => {
      hole(() => tri(ctx, W / 2 - 95, 105, 80, 70)); hole(() => tri(ctx, W / 2 + 95, 105, 80, 70)); hole(() => tri(ctx, W / 2, 160, 34, 30));
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 - 150, 195); ctx.quadraticCurveTo(W / 2, 290, W / 2 + 150, 195); ctx.lineTo(W / 2 + 95, 212); ctx.lineTo(W / 2 + 70, 196); ctx.lineTo(W / 2 + 40, 222); ctx.lineTo(W / 2, 205); ctx.lineTo(W / 2 - 40, 222); ctx.lineTo(W / 2 - 70, 196); ctx.lineTo(W / 2 - 95, 212); ctx.closePath(); });
    }),
    // spooky: slanted angry eyes, a jagged frown
    draw((ctx, W, H, hole) => {
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 - 150, 80); ctx.lineTo(W / 2 - 40, 120); ctx.lineTo(W / 2 - 120, 140); ctx.closePath(); });
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 + 150, 80); ctx.lineTo(W / 2 + 40, 120); ctx.lineTo(W / 2 + 120, 140); ctx.closePath(); });
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 - 130, 230); for (let k = 0; k <= 8; k++) ctx.lineTo(W / 2 - 130 + k * 32.5, k % 2 ? 200 : 228); ctx.lineTo(W / 2 + 120, 262); ctx.quadraticCurveTo(W / 2, 230, W / 2 - 120, 262); ctx.closePath(); });
    }),
    // surprised: round eyes, an "O" mouth
    draw((ctx, W, H, hole) => {
      for (const s of [-1, 1]) hole(() => { ctx.beginPath(); ctx.ellipse(W / 2 + s * 90, 110, 38, 46, 0, 0, Math.PI * 2); });
      hole(() => { ctx.beginPath(); ctx.ellipse(W / 2, 220, 42, 50, 0, 0, Math.PI * 2); });
    }),
    // cheeky: a wink and a crooked smile
    draw((ctx, W, H, hole) => {
      hole(() => tri(ctx, W / 2 - 95, 110, 82, 72));
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 + 40, 112); ctx.quadraticCurveTo(W / 2 + 95, 80, W / 2 + 150, 112); ctx.lineTo(W / 2 + 140, 124); ctx.quadraticCurveTo(W / 2 + 95, 100, W / 2 + 50, 124); ctx.closePath(); });
      hole(() => { ctx.beginPath(); ctx.moveTo(W / 2 - 130, 200); ctx.quadraticCurveTo(W / 2 + 10, 285, W / 2 + 150, 180); ctx.quadraticCurveTo(W / 2 + 20, 240, W / 2 - 130, 200); ctx.closePath(); });
    }),
  ];
  return faces;
}

/** Put a glowing face on `pumpkin` (a placed prop group), looking toward world point `lookAt`. */
export function addJackFace(pumpkin, lookAt, kind = 0) {
  pumpkin.updateMatrixWorld(true);
  const inv = pumpkin.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3();
  pumpkin.traverse((m) => {
    if (!m.isMesh || m.userData.isOutline || !/M_pumpkin/.test([].concat(m.material)[0]?.name || '')) return;
    m.geometry.computeBoundingBox();
    box.union(b.copy(m.geometry.boundingBox).applyMatrix4(inv.clone().multiply(m.matrixWorld)));
  });
  if (box.isEmpty()) return null;
  const C = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).multiplyScalar(0.5 * 1.07);
  const mat = new THREE.MeshBasicMaterial({ map: faceTextures()[kind % 4], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false, fog: false });
  mat.color.setScalar(1.25);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, PHI0, PHI_L, TH0, TH_L), mat);
  face.position.copy(C); face.scale.copy(R);
  face.raycast = () => {};
  face.renderOrder = 4;
  // turn the face (patch centred on local +Z) toward lookAt
  const p = pumpkin.worldToLocal(lookAt.clone());
  face.rotation.y = Math.atan2(p.x - C.x, p.z - C.z);
  pumpkin.add(face);
  return face;
}

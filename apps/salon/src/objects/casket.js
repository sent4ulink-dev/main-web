import * as THREE from 'three';
import gsap from 'gsap';
import { toonMaterial } from '../style/toon.js';
import { piece } from '../world/salon.js';
import { SERIF, SCRIPT } from '../world/salonTextures.js';

// The wish casket: a velvet-and-gilt jewel box on the tea table. It opens, and a little scroll rises out
// of it and unrolls in the air with the birthday wish written on it.

function scrollTexture(text) {
  const w = 512, h = 640, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#f4e8c8'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(150,100,40,0.3)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#8a1c2c'; x.textAlign = 'center';
  x.font = `400 70px ${SCRIPT}`; x.fillText('✦', w / 2, 110);
  x.fillStyle = '#3a2228';
  // wrap the wish onto lines
  let size = 44; const words = String(text || '').split(/\s+/);
  const lay = () => {
    x.font = `italic 600 ${size}px ${SERIF}`;
    const lines = []; let line = '';
    for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (x.measureText(t).width > w - 90 && line) { lines.push(line); line = wd; } else line = t; }
    if (line) lines.push(line);
    return lines;
  };
  let lines = lay();
  while (lines.length * size * 1.25 > h - 220 && size > 22) { size -= 2; lines = lay(); }
  lines.forEach((l, i) => x.fillText(l, w / 2, 170 + size + i * size * 1.25));
  x.strokeStyle = 'rgba(138,28,44,0.6)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(w * 0.3, h - 70); x.bezierCurveTo(w * 0.42, h - 45, w * 0.58, h - 95, w * 0.7, h - 70); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class Casket {
  constructor(scene, pos, rotY = 0) {
    this.group = piece('table', 'casket');
    this.group.position.copy(pos); this.group.rotation.y = rotY;
    scene.add(this.group);
    this.group.updateMatrixWorld(true);
    this.lid = this.group.getObjectByName('casket_lid');
    this.anchor = this.group.getObjectByName('scroll_anchor');
    // the scroll: a rolled cylinder that rises, then the sheet unrolls downwards from it
    this.scroll = new THREE.Group();
    this.roll = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 16), toonMaterial({ color: new THREE.Color('#efe0bd') }, { rimScale: 0.4 }));
    this.roll.rotation.z = Math.PI / 2;
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.003, 6, 16), toonMaterial({ color: new THREE.Color('#8a1c2c') }));
    ribbon.rotation.y = Math.PI / 2;
    this.roll.add(ribbon);
    const sheetGeo = new THREE.PlaneGeometry(0.15, 0.19); sheetGeo.translate(0, -0.095, 0);
    this.sheet = new THREE.Mesh(sheetGeo, toonMaterial({ map: scrollTexture(''), side: THREE.DoubleSide }, { rimScale: 0.2 }));
    this.sheet.scale.y = 0.001;
    this.scroll.add(this.roll, this.sheet);
    this.scroll.visible = false;
    this.anchor.add(this.scroll);
    this.opened = false;
    this.hitTargets = [];
    this.group.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
  }

  setWish(text) { this.sheet.material.map?.dispose(); this.sheet.material.map = scrollTexture(text); this.sheet.material.needsUpdate = true; }

  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, 0.07, 0)); }
  /** Where the unrolled wish hangs (world). */
  get scrollPoint() { return this.anchor.localToWorld(new THREE.Vector3(0, 0.2, 0)); }

  open(text) {
    if (this.opened) return Promise.resolve();
    this.opened = true;
    this.setWish(text);
    this.scroll.visible = true;
    this.scroll.position.set(0, 0, 0);
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(this.lid.rotation, { x: -1.95, duration: 1.0, ease: 'back.out(1.6)' })
        .to(this.scroll.position, { y: 0.29, duration: 1.3, ease: 'power2.out' }, '-=0.3')
        .to(this.scroll.rotation, { y: Math.PI * 2, duration: 1.3, ease: 'power2.out' }, '<')
        .to(this.sheet.scale, { y: 1, duration: 0.9, ease: 'power2.out' });
    });
  }

  reset() {
    gsap.killTweensOf([this.lid.rotation, this.scroll.position, this.scroll.rotation, this.sheet.scale]);
    this.opened = false;
    this.lid.rotation.x = 0;
    this.scroll.visible = false;
    this.scroll.rotation.set(0, 0, 0);
    this.sheet.scale.y = 0.001;
  }
}

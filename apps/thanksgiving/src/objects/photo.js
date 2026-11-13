import * as THREE from 'three';
import gsap from 'gsap';
import { piece } from '../world/props.js';
import { canvas, tex, FONTS, fitFont, longDate } from '../world/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

// The family photo: a camera on a tripod at the head of the table (it only turns up for the photo), and the
// picture itself, developing as a polaroid that floats up in front of you.

export class TripodCamera {
  constructor(scene) {
    this.root = piece('tripod_camera');
    this.root.visible = false;
    scene.add(this.root);
    this.bulb = this.root.getObjectByName('tc_bulb') || null;
    this.hitTargets = [];
    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) this.hitTargets.push(o); });
  }
  place(x, y, z, yaw) { this.root.position.set(x, y, z); this.root.rotation.y = yaw; this.root.updateMatrixWorld(true); }
  get lensPoint() { return this.root.getObjectByName('lens').getWorldPosition(new THREE.Vector3()); }
  get facing() { return new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)); }
  show(v) { this.root.visible = v; }
}

export class Polaroid {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.visible = false;
    this.size = { w: 0.56, h: 0.5 };
    const frame = new THREE.Mesh(new THREE.BoxGeometry(this.size.w, this.size.h, 0.008), toonMaterial({ color: new THREE.Color('#FBF6EC') }, { rimScale: 0.4 }));
    addOutline(frame, 0.0012);
    this.photoMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.375), this.photoMat);
    this.photo.position.set(0, 0.04, 0.0045);
    const [c, x] = canvas(512, 96); this.capC = c; this.capX = x;
    this.capTex = tex(c);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.094), new THREE.MeshBasicMaterial({ map: this.capTex, transparent: true }));
    cap.position.set(0, -0.19, 0.0046);
    this.group.add(frame, this.photo, cap);
    scene.add(this.group);
    this.develop = 0;
  }

  caption(content) {
    const x = this.capX;
    x.clearRect(0, 0, 512, 96);
    x.fillStyle = '#6E473B'; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitFont(x, `${content.family} · Thanksgiving`, '700', 44, FONTS.hand, 480);
    x.fillText(`${content.family} · Thanksgiving`, 256, 38);
    x.font = `600 22px ${FONTS.ui}`; x.fillStyle = '#CC5500';
    x.fillText(longDate(content.date.iso), 256, 76);
    this.capTex.needsUpdate = true;
  }

  /** Show a captured picture (a canvas): it develops from dark to full colour. */
  show(shot, content) {
    this.photoMat.map?.dispose();
    const t = new THREE.CanvasTexture(shot); t.colorSpace = THREE.SRGBColorSpace;
    this.photoMat.map = t; this.photoMat.color.setRGB(0.05, 0.04, 0.04); this.photoMat.needsUpdate = true;
    this.caption(content);
    this.group.visible = true;
    gsap.to(this.photoMat.color, { r: 1, g: 1, b: 1, duration: 3.2, ease: 'power2.inOut' });
  }
  hide() { this.group.visible = false; }
  update(t) { if (this.group.visible) this.group.rotation.z = Math.sin(t * 0.8) * 0.02; }
}

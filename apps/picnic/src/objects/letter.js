import * as THREE from 'three';
import gsap from 'gsap';
import { paperTexture, letterTexture, envelopeTexture, flapTexture } from '../util/textures.js';
import { toonMaterial, addOutline } from '../style/toon.js';

const W = 0.165, D = 0.115;
const PAGE_W = 0.15, PAGE_H = 0.21;   // A5 letter, unfolded for reading

function sealGeometry(r = 0.019) {
  const shape = new THREE.Shape();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.07 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11) + 0.04 * Math.sin(a * 17 + 2));
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0022, bevelSegments: 5, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function heartEmboss(s = 0.0085) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -s);
  sh.bezierCurveTo(s * 0.3, -s * 0.6, s * 1.1, -s * 0.15, s, s * 0.4);
  sh.bezierCurveTo(s * 0.9, s * 0.95, s * 0.25, s * 1.0, 0, s * 0.55);
  sh.bezierCurveTo(-s * 0.25, s * 1.0, -s * 0.9, s * 0.95, -s, s * 0.4);
  sh.bezierCurveTo(-s * 1.1, -s * 0.15, -s * 0.3, -s * 0.6, 0, -s);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0008, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Envelope standing on a little easel, facing the camera: a back panel and a front pocket with the
 * letter between them, and a flap hinged over the top edge. Opening it breaks the seal, folds the flap
 * back, slides the letter up out of the opening and hands it to the Presenter, which floats it up in
 * front of the camera to be read (above the table, never cutting into it).
 */
export class Letter {
  constructor(parent, anchor, content, presenter) {
    this.content = content;
    this.presenter = presenter;
    // outer: position + face the camera; inner: stand the flat envelope up, leaning back
    this.group = new THREE.Group();
    this.group.name = 'letter';
    this.group.position.copy(anchor.position);
    this.group.rotation.y = anchor.yaw || 0;
    parent.add(this.group);
    const lean = 0.3;
    this.env = new THREE.Group();
    this.env.rotation.x = Math.PI / 2 - lean;
    this.env.position.y = (D / 2) * Math.cos(lean) + 0.006;
    this.group.add(this.env);
    this.opened = false;
    this.reading = false;

    // little easel behind the envelope
    const wood = toonMaterial({ color: new THREE.Color('#8a5a36') });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.008), wood);
    back.position.set(0, 0.052, -0.037); back.rotation.x = -lean;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.012), wood);
    lip.position.set(0, 0.004, 0.012);
    for (const m of [back, lip]) { m.castShadow = true; addOutline(m, 0.002); this.group.add(m); }

    const frontMat = toonMaterial({ map: envelopeTexture(content.name) }, { rimScale: 0.5 });
    const inner = toonMaterial({ map: paperTexture({ tint: '#efe4d8' }), side: THREE.DoubleSide }, { rimScale: 0.3 });
    const flapMat = toonMaterial({ map: flapTexture(), side: THREE.DoubleSide }, { rimScale: 0.5 });

    // back panel (y −0.0012…0) and front pocket (y 0.0022…0.0034); +Y faces the camera
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(W, 0.0012, D), inner);
    backPanel.position.y = -0.0006;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(W, 0.0012, D), [inner, inner, frontMat, inner, inner, inner]);
    pocket.position.y = 0.0028;
    for (const m of [backPanel, pocket]) { m.castShadow = true; m.receiveShadow = true; this.env.add(m); }
    addOutline(pocket, 0.0018);

    // the folded letter inside, between the panels; unfolded to full size when reading
    this.letter = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), toonMaterial({ map: letterTexture(content), side: THREE.DoubleSide }, { rimScale: 0 }));
    this.frontMat = frontMat;
    this.letter.scale.set(W * 0.9 / PAGE_W, D * 0.9 / PAGE_H, 1);
    this.letter.rotation.x = -Math.PI / 2;
    this.letter.position.set(0, 0.0011, 0.001);
    this.env.add(this.letter);
    this.letterHome = { pos: this.letter.position.clone(), rot: this.letter.rotation.clone(), scale: this.letter.scale.clone() };
    // fully out of the opening, just above the envelope and a little in front of it
    this.letterOut = new THREE.Vector3(0, 0.016, -D * 0.5 - D * 0.45 - 0.006);

    // flap hinged on the top edge (local −Z is "up" once the envelope stands), in front of the pocket
    this.flapPivot = new THREE.Group();
    this.flapPivot.position.set(0, 0.0042, -D / 2);
    this.env.add(this.flapPivot);
    const flapGeo = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0.012, D * 0.62), new THREE.Vector2(-0.012, D * 0.62)]));
    flapGeo.rotateX(Math.PI / 2);
    const flap = new THREE.Mesh(flapGeo, flapMat);
    flap.castShadow = true;
    addOutline(flap, 0.0016);
    this.flapPivot.add(flap);

    const wax = toonMaterial({ color: new THREE.Color('#9a1428') }, { rimScale: 1.2 });
    this.seal = new THREE.Group();
    const sealMesh = new THREE.Mesh(sealGeometry(), wax);
    const emb = new THREE.Mesh(heartEmboss(), wax);
    emb.position.y = 0.0036;
    this.seal.add(sealMesh, emb);
    this.seal.position.set(0, 0.0002, D * 0.55);
    addOutline(sealMesh, 0.0015);
    this.flapPivot.add(this.seal);

    this.hitTargets = [pocket, backPanel, flap, sealMesh, emb, this.letter];
  }

  /** How the letter sits when it's being read (see Presenter.target). */
  get readSpec() {
    return { width: PAGE_W, height: PAGE_H, fillH: 0.8, fillHPortrait: 0.62, fillW: 0.9, x: -0.13, y: 0.01, xPortrait: 0, yPortrait: 0.1 };
  }

  /** Open the envelope and float the letter up in front of the camera. onOut fires once it's clear of the envelope. */
  open(onOut) {
    if (this.reading) return Promise.resolve();
    this.reading = true;
    const L = this.letter;
    return new Promise((resolve) => {
      const tl = gsap.timeline();
      if (!this.opened) {
        this.opened = true;
        // the seal pops, the flap swings up and folds back over the top edge
        tl.to(this.seal.position, { y: 0.004, duration: 0.18, ease: 'power2.out' })
          .to(this.flapPivot.rotation, { x: -Math.PI * 1.22, duration: 1.0, ease: 'power3.inOut' }, '+=0.05');
      }
      // slide straight up out of the opening (between the panels), then lift clear of the pocket
      tl.to(L.position, { z: this.letterOut.z, duration: 0.85, ease: 'power2.inOut' }, '-=0.2')
        .to(L.position, { y: this.letterOut.y, duration: 0.3, ease: 'power2.out' })
        .add(() => {
          onOut?.();
          let root = this.group;
          while (root.parent) root = root.parent;
          root.attach(L);
          this.presenter.present(L, this.readSpec, { duration: 1.2, scale: 1 }).then(resolve);
        });
    });
  }

  /** Put the letter back into the envelope. */
  close() {
    if (!this.reading) return Promise.resolve();
    this.reading = false;
    const L = this.letter;
    this.presenter.release(L);
    return new Promise((resolve) => {
      this.env.attach(L);
      const p0 = L.position.clone(), q0 = L.quaternion.clone(), s0 = L.scale.clone();
      const home = new THREE.Quaternion().setFromEuler(this.letterHome.rot);
      const st = { k: 0 };
      gsap.timeline({ onComplete: resolve })
        .to(st, {
          k: 1, duration: 1.0, ease: 'power3.inOut',
          onUpdate: () => {
            L.position.lerpVectors(p0, this.letterOut, st.k);
            L.quaternion.slerpQuaternions(q0, home, st.k);
            L.scale.lerpVectors(s0, this.letterHome.scale, st.k);
          },
        })
        .to(L.position, { y: this.letterHome.pos.y, duration: 0.25, ease: 'power2.in' })
        .to(L.position, { z: this.letterHome.pos.z, duration: 0.6, ease: 'power2.inOut' });
    });
  }

  reset() {
    this.opened = false;
    this.reading = false;
    this.presenter.release(this.letter);
    this.env.attach(this.letter);
    this.flapPivot.rotation.x = 0;
    this.seal.position.y = 0.0002;
    this.letter.position.copy(this.letterHome.pos);
    this.letter.rotation.copy(this.letterHome.rot);
    this.letter.scale.copy(this.letterHome.scale);
  }

  /** Repaint the envelope and the page from (edited) content. */
  setContent(content) {
    this.content = content;
    const swap = (mat, tex) => { mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true; };
    swap(this.frontMat, envelopeTexture(content.name));
    swap(this.letter.material, letterTexture(content, 1024, 1434, { blank: this._blank }));
  }
  /** While the words are edited on top of the page, the page shows paper only. */
  setBlank(blank) {
    if (this._blank === blank) return;
    this._blank = blank;
    const m = this.letter.material; m.map?.dispose(); m.map = letterTexture(this.content, 1024, 1434, { blank }); m.needsUpdate = true;
  }
  /** The page's rectangle on screen (CSS px within the stage), while it is being read. */
  screenRect(camera, w, h) {
    if (!this.reading) return null;
    const pts = [[-PAGE_W / 2, PAGE_H / 2], [PAGE_W / 2, -PAGE_H / 2]].map(([x, y]) => this.letter.localToWorld(new THREE.Vector3(x, y, 0)).project(camera));
    const x0 = (pts[0].x * 0.5 + 0.5) * w, y0 = (-pts[0].y * 0.5 + 0.5) * h, x1 = (pts[1].x * 0.5 + 0.5) * w, y1 = (-pts[1].y * 0.5 + 0.5) * h;
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  /** World-space centre of the letter (for placing the text beside it while reading). */
  get letterCenter() { return this.letter.getWorldPosition(new THREE.Vector3()); }
  get focusPoint() { return this.group.localToWorld(new THREE.Vector3(0, D * 0.5, 0)); }
}

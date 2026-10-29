import * as THREE from 'three';
import { Witch, Zombie, Jack } from '../objects/characters.js';
import { Ghost } from '../objects/ghosts.js';
import { glowTexture } from '../world/nightTextures.js';

// The big night in the sky: witches loop round in front of the moon on their broomsticks, flinging glowing
// potion bottles high into the air that burst into fireworks; ghosts do loop-the-loops and spin for joy; and
// down on the ground a row of zombies boogies. Everything is placed relative to where you watch from.

const PHONE = matchMedia('(pointer: coarse)').matches;

const POTIONS = [
  { color: 0x7dff6a, pal: [[0.45, 1.0, 0.4], [0.9, 1.0, 0.8]] },
  { color: 0xb36bff, pal: [[0.7, 0.4, 1.0], [0.95, 0.85, 1.0]] },
  { color: 0xff8a2a, pal: [[1.0, 0.55, 0.15], [1.0, 0.9, 0.6]] },
  { color: 0xff5fd2, pal: [[1.0, 0.4, 0.85], [1.0, 0.85, 0.95]] },
];

function bottle(color) {
  const g = new THREE.Group();
  const glass = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  glass.color.multiplyScalar(1.6);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), glass);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8), glass); neck.position.y = 0.26;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.08, 8), new THREE.MeshBasicMaterial({ color: 0x8a5a30 })); cork.position.y = 0.39;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(64), color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.4);
  g.add(body, neck, cork, glow);
  return g;
}

export class Celebration {
  /** from: where you watch; dir: the way you look (toward the moon); fireworks: the Fireworks; onThrow/onBurst: sounds. */
  constructor(scene, { from, dir, fireworks, onThrow = () => {}, onBurst = () => {} }) {
    this.scene = scene;
    this.fireworks = fireworks;
    this.onThrow = onThrow; this.onBurst = onBurst;
    this.group = new THREE.Group(); this.group.name = 'celebration'; this.group.visible = false;
    scene.add(this.group);
    const d = dir.clone().normalize(), flat = d.clone().setY(0).normalize();
    this.side = new THREE.Vector3(-flat.z, 0, flat.x);   // to the right as you look
    this.up = new THREE.Vector3(0, 1, 0);
    this.skyC = from.clone().addScaledVector(d, 21).add(new THREE.Vector3(0, -1.5, 0));      // the witches' loop
    this.ghostC = from.clone().addScaledVector(d, 12).add(new THREE.Vector3(0, -1.0, 0));    // the ghosts' playground
    this.flat = flat;
    this.witches = [new Witch({ height: 2.6 }), new Witch({ height: 2.3 })];
    this.witches.forEach((w) => this.group.add(w.group));
    this.ghosts = [0, 1, 2].map(() => { const g = new Ghost({ scale: 1.5 }); this.group.add(g.group); return g; });
    // zombies and pumpkin-headed Jacks partying in a row on the ground, a few steps ahead
    const ground = from.clone().addScaledVector(flat, 7.2); ground.y = 0;
    const face = Math.atan2(-flat.x, -flat.z);   // facing you
    this.zombies = [-1.6, 0, 1.6].map((o, i) => {
      const z = new Zombie({ height: 1.35 });
      z.group.position.copy(ground).addScaledVector(this.side, o).addScaledVector(flat, Math.abs(o) * 0.3);
      z.group.rotation.y = face + o * 0.12;
      this.group.add(z.group);
      return z;
    });
    this.jacks = [-0.8, 0.8].map((o) => {
      const j = new Jack({ height: 1.15 });
      j.group.position.copy(ground).addScaledVector(this.side, o).addScaledVector(flat, 0.9);
      j.group.rotation.y = face;
      this.group.add(j.group);
      return j;
    });
    this.bottles = [];
    this._throwT = 1.2;
    this.active = false;
  }

  /** show: the finale — every firework in the sky is one of the witches' potions, thrown thick and fast at first. */
  start({ show = false } = {}) {
    if (!this.active) this.zombies.forEach((z, i) => { setTimeout(() => (i % 2 ? z.cheer() : z.dance()), i * 260); });
    if (!this.active || show) this._throwT = show ? 0.4 : 1.0;
    this.active = true; this.group.visible = true;
    this.show = show; this.showT = 0;
  }
  stop() { this.zombies.forEach((z) => z.idle()); this.active = false; this.group.visible = false; this.bottles.forEach((b) => this.group.remove(b.mesh)); this.bottles = []; }

  /** Fling a potion: it arcs from the witch's hand up and away to the very spot where it bursts. */
  _throw(w) {
    const p = POTIONS[Math.floor(Math.random() * POTIONS.length)];
    const mesh = bottle(p.color);
    const from = w.group.position.clone().add(new THREE.Vector3(0, 0.6, 0));
    const to = from.clone().addScaledVector(this.flat, 16 + Math.random() * 8).addScaledVector(this.side, (Math.random() - 0.5) * 10);
    to.y = from.y + 9 + Math.random() * 5;
    mesh.position.copy(from);
    this.group.add(mesh);
    this.bottles.push({ mesh, p, from, to, t: 0, dur: 1.15 + Math.random() * 0.35, spin: (Math.random() - 0.5) * 12 });
    this.onThrow(from);
  }

  update(t, dt) {
    if (!this.active) return;
    const S = this.side, U = this.up, F = this.flat;
    // witches: wide figure-of-eight loops in front of the moon, banking into the turns
    this.witches.forEach((w, i) => {
      const a = t * (0.42 + i * 0.07) + i * Math.PI;
      const prev = w.group.position.clone();
      w.group.position.copy(this.skyC).addScaledVector(S, Math.sin(a) * 9).addScaledVector(U, Math.sin(2 * a) * 2.6 + i * 1.5).addScaledVector(F, Math.cos(a) * 4);
      const v = w.group.position.clone().sub(prev);
      if (v.lengthSq() > 1e-8) w.group.rotation.set(0, Math.atan2(v.x, v.z), -Math.cos(a) * 0.45);
      w.update(t, dt);
    });
    // ghosts: loop-the-loops and spins
    this.ghosts.forEach((g, i) => {
      const a = t * 0.9 + i * 2.1;
      g.group.position.copy(this.ghostC).addScaledVector(S, Math.cos(a * 0.6) * (3 + i * 1.6)).addScaledVector(U, Math.sin(a * 1.2) * 1.8 + i * 0.8).addScaledVector(F, Math.sin(a * 0.6) * 2);
      g.group.rotation.set(Math.sin(a) * 0.5, a * 1.5, Math.cos(a * 1.3) * 0.4);
      g.setFace(Math.sin(a * 0.5) > 0.6 ? 'ooo' : 'smile');
      g.update(t, dt);
      g.arms[0].rotation.z = 1.2 + 0.4 * Math.sin(t * 6 + i); g.arms[1].rotation.z = -1.2 - 0.4 * Math.sin(t * 6 + i + 1);
    });
    this.zombies.forEach((z) => z.update(t, dt));
    this.jacks.forEach((j) => j.update(t, dt));
    // the potions: up, spinning, and — at the top of the arc — BOOM
    this._throwT -= dt;
    this.showT += dt;
    if (this._throwT <= 0) {
      this._throw(this.witches[Math.floor(Math.random() * this.witches.length)]);
      // the finale's show: a potion every ~0.8 s for the first 40 s, then a gentle trickle; the sky chapter: every ~2 s
      this._throwT = this.show ? (this.showT < 40 ? (PHONE ? 0.8 : 0.55) + Math.random() * 0.5 : 2.2 + Math.random() * 2) : 1.3 + Math.random() * 1.1;   // phones: a little sparser
    }
    for (let k = this.bottles.length - 1; k >= 0; k--) {
      const b = this.bottles[k];
      b.t = Math.min(1, b.t + dt / b.dur);
      const e = 1 - (1 - b.t) * (1 - b.t);   // fast off the hand, slowing as it climbs
      b.mesh.position.lerpVectors(b.from, b.to, e).y += 3 * 4 * e * (1 - e);   // a lofted arc
      b.mesh.rotation.z += b.spin * dt;
      b.mesh.scale.setScalar(1 + e * 1.4);   // easier to follow as it flies away
      if (b.t >= 1) {
        this.fireworks._burst(b.to.clone(), ['peony', 'ring', 'glitter', 'heart', 'crossette'][Math.floor(Math.random() * 5)], b.p.pal);   // right where it ended up
        this.fireworks.flash = Math.max(this.fireworks.flash, 0.6);
        this.onBurst(b.to);
        this.group.remove(b.mesh);
        this.bottles.splice(k, 1);
      }
    }
  }
}

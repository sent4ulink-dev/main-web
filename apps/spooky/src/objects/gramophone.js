import * as THREE from 'three';
import { canvas } from '../world/nightTextures.js';
import { Ghost } from './ghosts.js';
import { Witch, Zombie } from './characters.js';

// The haunted gramophone: the record spins, notes curl out of the horn — and the party turns up: a ghost floats
// round it, a witch circles overhead on her broomstick, and a zombie claws his way up out of the ground to dance.
// When the music stops they all slip away again.

function noteTextures() {
  return ['♪', '♫', '♬'].map((ch) => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 100px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(180,255,170,0.95)'; ctx.shadowBlur = 16;
    ctx.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export class Gramophone {
  constructor(scene, gram) {
    this.root = gram;
    gram.updateMatrixWorld(true);
    this.record = gram.getObjectByName('gramophone_record');
    this.horn = gram.getObjectByName('horn_mouth');
    this.hitTargets = [];
    gram.traverse((m) => { if (m.isMesh && !m.userData.isOutline) this.hitTargets.push(m); });
    const tex = noteTextures();
    this.notes = Array.from({ length: 12 }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex[i % 3], color: new THREE.Color(i % 2 ? '#9dff8a' : '#d6a8ff').multiplyScalar(1.4), transparent: true, depthWrite: false, fog: false }));
      s.visible = false; s.scale.setScalar(0.2);
      scene.add(s);
      return { s, age: 99, life: 3.2, x: 0, z: 0, phase: 0 };
    });
    this._noteT = 0;
    // the dancers
    this.ghost = new Ghost({ scale: 0.7 });
    this.ghost.opacity = 0;
    scene.add(this.ghost.group);
    this.witch = new Witch({ height: 1.05 });
    this.witch.group.visible = false;
    scene.add(this.witch.group);
    this.zombie = new Zombie({ height: 1.15 });
    this.zombie.group.visible = false;
    scene.add(this.zombie.group);
    this.party = 0;   // 0 = gone, 1 = all here
    this.centre = gram.localToWorld(new THREE.Vector3(0, 0, 0.2));
    this.playing = false;
    this.beat = 0;
  }

  get focusPoint() { return this.root.localToWorld(new THREE.Vector3(0, 0.95, 0)); }
  get hornPoint() { return this.horn ? this.horn.getWorldPosition(new THREE.Vector3()) : this.focusPoint; }
  get normal() { const r = this.root.rotation.y; return new THREE.Vector3(Math.sin(r), 0, Math.cos(r)); }

  play() { this.playing = true; }
  stop() { this.playing = false; }
  /** A note was played (from the organ): the ghosts hop, a note flies. */
  pulse(strength = 1) { this.beat = Math.max(this.beat, strength); this._emit(); }
  reset() { this.playing = false; this.party = 0; this.ghost.opacity = 0; this.witch.group.visible = false; this.zombie.group.visible = false; this._zDancing = false; this.zombie.idle(); }

  _emit() {
    const n = this.notes.find((x) => x.age > x.life);
    if (!n) return;
    n.age = 0; n.x = (Math.random() - 0.5) * 0.3; n.z = (Math.random() - 0.5) * 0.3; n.phase = Math.random() * 6;
  }

  update(t, dt) {
    if (this.record) this.record.rotation.y -= dt * (this.playing ? 3.5 : 0);
    if (this.playing) { this._noteT -= dt; if (this._noteT <= 0) { this._emit(); this._noteT = 0.45; } }
    const h = this.hornPoint;
    for (const n of this.notes) {
      n.age += dt;
      const k = n.age / n.life;
      n.s.visible = k < 1;
      if (!n.s.visible) continue;
      n.s.position.set(h.x + n.x + Math.sin(n.age * 2.2 + n.phase) * 0.18, h.y + 0.1 + n.age * 0.42, h.z + n.z + Math.cos(n.age * 1.7 + n.phase) * 0.1);
      n.s.material.opacity = Math.sin(Math.min(k, 1) * Math.PI);
      n.s.material.rotation = Math.sin(n.age * 2 + n.phase) * 0.35;
    }
    this.beat = Math.max(0, this.beat - dt * 3);
    // the party comes and goes with the music
    this.party += ((this.playing ? 1 : 0) - this.party) * Math.min(1, dt * 1.2);
    const k = this.party, C = this.centre, n = this.normal, side = new THREE.Vector3(n.z, 0, -n.x);
    // the ghost floats round the gramophone
    this.ghost.opacity = k;
    if (k > 0.01) {
      this.ghost.update(t, dt);
      const a = t * 0.7;
      this.ghost.group.position.copy(C).add(new THREE.Vector3(Math.cos(a) * 1.15, 0.3 + 0.18 * Math.abs(Math.sin(t * 2.1)), Math.sin(a) * 1.15));
      this.ghost.group.rotation.y = -a;
      this.ghost.arms[0].rotation.z = 0.9 + 0.5 * Math.sin(t * 4.8);
      this.ghost.arms[1].rotation.z = -0.9 - 0.5 * Math.sin(t * 4.8 + 1);
    }
    // the witch swoops in from the sky and circles overhead, banking into the turn
    this.witch.group.visible = k > 0.01;
    if (k > 0.01) {
      this.witch.update(t, dt);
      const a = -t * 0.75, r = 1.45 + (1 - k) * 8, h = 1.6 + (1 - k) * 6;
      this.witch.group.position.copy(C).addScaledVector(n, -0.9).add(new THREE.Vector3(Math.cos(a) * r, h + 0.25 * Math.sin(t * 1.7), Math.sin(a) * r));   // circling just behind it
      this.witch.group.rotation.set(0, -a + Math.PI, 0.35);   // facing along the circle, leaning in
    }
    // the zombie claws up out of the ground beside it and boogies (and sinks back down after)
    this.zombie.group.visible = k > 0.02;
    if (k <= 0.02 && this._zDancing) { this._zDancing = false; this.zombie.idle(); }
    if (k > 0.02) {
      if (!this._zDancing) { this._zDancing = true; this.zombie.dance(); }
      this.zombie.update(t, dt);
      this.zombie.group.position.copy(C).addScaledVector(side, 0.95).addScaledVector(n, 0.75);
      this.zombie.group.position.y = -1.65 * (1 - Math.min(1, k * 1.15));
      this.zombie.group.rotation.y = Math.atan2(n.x, n.z) - 0.35;
    }
  }
}

import * as THREE from 'three';
import { Witch, Zombie, Jack } from './characters.js';
import { Ghost } from './ghosts.js';
import { MOON_DIR } from '../world/nightsky.js';

// The cast of the story picture, posed round the carved pumpkin for the backdrop render only: a zombie waving on
// one side, a ghost on the other, and a witch zooming past the moon. Hidden the rest of the time.

export class Posers {
  constructor(scene, hide = []) {
    this.hide = hide;   // props that would stand in the way of the picture (a lamp post)
    this.group = new THREE.Group(); this.group.name = 'posers'; this.group.visible = false;
    scene.add(this.group);
    this.zombie = new Zombie({ height: 1.45 });
    this.ghost = new Ghost({ scale: 0.95 });
    this.witch = new Witch({ height: 1.9 });
    this.jack = new Jack({ height: 1.2 });
    this.group.add(this.zombie.group, this.ghost.group, this.witch.group, this.jack.group);
  }

  /** shot: { pos, at (the pumpkin's face), n (its normal), side (right as seen) } from Story.posterShot(). */
  show(on, shot = null) {
    this.group.visible = on;
    this.hide.forEach((o) => { o.visible = !on; });
    if (!on || !shot) return;
    const { pos, at, n, side } = shot;
    const ground = at.clone().setY(0);
    const face = (o) => { o.rotation.y = Math.atan2(pos.x - o.position.x, pos.z - o.position.z); };
    // the zombie beside the pumpkin, arms up mid-boogie
    this.zombie.group.position.copy(ground).addScaledVector(side, 1.45).addScaledVector(n, -1.1);
    face(this.zombie.group);
    this.zombie.pose('Wave', 0.45);
    // the ghost floating on the other side, waving
    this.ghost.group.position.copy(ground).addScaledVector(side, -0.9).addScaledVector(n, -0.6).add(new THREE.Vector3(0, 2.15, 0));
    face(this.ghost.group);
    this.ghost.setFace('smile'); this.ghost.opacity = 1; this.ghost.update(0.6, 0);
    this.ghost.arms[1].rotation.z = -1.7;
    // the witch flying past the moon
    this.witch.group.position.copy(pos).addScaledVector(MOON_DIR, 13).addScaledVector(side, -2.6).add(new THREE.Vector3(0, 2.0, 0));
    this.witch.group.rotation.set(0, Math.atan2(-side.x, -side.z), 0.25);   // flying across, toward the moon
    this.witch.update(0.4, 1 / 60);
    // Jack peeking out from behind the pumpkin on the other side
    this.jack.group.position.copy(ground).addScaledVector(side, -1.5).addScaledVector(n, -0.5);
    face(this.jack.group);
    this.jack.update(0.15, 1 / 60);
  }
}

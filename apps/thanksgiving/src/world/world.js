import * as THREE from 'three';
import { assets } from '../core/assets.js';
import { House } from './house.js';
import { FeastTable } from '../objects/table.js';
import { Crowd } from '../party/crowd.js';
import { TableLife } from '../party/life.js';
import { defaultLook } from '../share/guests-core.js';
import { layoutFor, FLOOR, TABLE_W, TABLE_TOP } from './layout.js';

// The evening's world: the house, the long table and the family sitting round it. setGuests() re-seats
// everybody whenever the guest list (or someone's look, answer or dish) changes.

const HIP_Y = FLOOR + 0.54;   // a seated character's hips, on the chair cushion

export class World {
  constructor(scene) {
    this.scene = scene;
    this.house = new House(scene);
    this.table = new FeastTable(scene);
    this.crowd = new Crowd(scene, assets.models.avatar);
    this.life = new TableLife(this);   // the chatting, eating, laughing at the table
    this.seated = [];            // the guests at the table, in seat order
    this.actors = new Map();     // guest id → their character at the table
    this.lay = null;
  }

  /** Who sits down: everyone invited, except those who said they can't come (when answers are shown). */
  static seatedOf(guests, { hideNo = true } = {}) { return guests.filter((g) => !(hideNo && g.rsvp === 'no')); }

  setGuests(guests, { party, hideNo = true } = {}) {
    const seated = World.seatedOf(guests, { hideNo });
    const lay = layoutFor(seated.length);
    const relayout = !this.lay || lay.perSide !== this.lay.perSide;
    this.lay = lay;
    this.seated = seated;
    if (relayout) this.house.layout(lay);
    this.table.layout(lay, seated, { potluck: party?.potluck !== false });
    // the cloth (as table.js lays it, a little over the top for the plates) is where hands rest, never sink in
    const zc = (lay.zHead + lay.zEnd) / 2, half = (lay.L + 0.08) / 2;
    this.crowd.table = { x: (TABLE_W + 0.08) / 2, z0: zc + half, z1: zc - half, top: FLOOR + TABLE_TOP + 0.012, bottom: FLOOR + TABLE_TOP - 0.134 };
    // characters: keep the ones still here (they don't jump), add the new ones, drop the gone
    const keep = new Set(seated.map((g) => g.id));
    for (const [id, a] of this.actors) if (!keep.has(id)) { this.crowd.remove(a); this.actors.delete(id); }
    seated.forEach((g, i) => {
      const look = g.look || defaultLook(g);
      let a = this.actors.get(g.id);
      if (!a) { a = this.crowd.add({ look, kid: g.age === 'child', sex: g.sex, name: g.name, id: g.id }); this.actors.set(g.id, a); }
      else if (JSON.stringify(a.look) !== JSON.stringify(look)) a.set(look);
      a.kid = g.age === 'child'; a.sex = g.sex; a.name = g.name; a.guest = g;
      a.home = this.seatPose(i);
      if (!a.away) this.sit(a);
    });
    this.crowd.dirty = true;
  }

  /** Seat i: where the hips go and which way they face. */
  seatPose(i) {
    const s = this.lay.seat(i);
    return { pos: new THREE.Vector3(s.side * 0.8, HIP_Y, s.z), yaw: s.yaw, side: s.side, z: s.z };
  }
  sit(a) { a.away = false; a.path = null; a.hold = null; a.setPose('sit'); a.pos.copy(a.home.pos); a.yaw = a.home.yaw; a.show(true); }
  /** Everyone back in their seats (after the game, after the photo outside). */
  sitAll() { for (const a of this.actors.values()) { this.sit(a); a.lookAt = null; a.scripted = false; a.play('idle'); } }

  /** A spot on the floor for someone standing (hips height for a standing character; `ground` = the floor's height). */
  standAt(a, x, z, yaw, ground = FLOOR) { a.away = true; a.path = null; a.setPose('stand'); a.pos.set(x, ground + 0.37 * a.scale, z); a.yaw = yaw; a.show(true); }
  /** Where someone stands up beside their chair (to walk away from the table). */
  besideChair(a) { const h = a.home; return new THREE.Vector3(h.side * 1.42, FLOOR + 0.37 * a.scale, h.z); }

  /** Where the table's middle is (for cameras), and its far end. */
  get tableCentre() { return new THREE.Vector3(0, FLOOR + 0.9, this.lay.mid); }
  get tableWidth() { return TABLE_W; }

  update(t, dt, camera) {
    this.life.update(t);
    this.house.update(t);
    this.table.update(t, camera);
    this.crowd.update(t, dt, camera);
  }
}

export { HIP_Y };

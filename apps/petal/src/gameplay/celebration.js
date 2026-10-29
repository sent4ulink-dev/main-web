import * as THREE from "three";
import { boardFrame } from "../actors/host.js";
import { footing } from "../world/pathfind.js";
import { drawDateBanner } from "../world/slot-art.js";
import { listing, longDate } from "../core/dates.js";
import { fitPose, framePose } from "./framing.js";

// The keepsake book: once the day, the adventure and the place are chosen, a
// tap on the book brings the two bunnies together in front of it for a little
// dance (a wave, a cheer, a twirl, a dance and a clap, a bow and a heart)
// under a ribbon that says it's a date. Your own bunny steps aside for a
// stand-in that looks just like her and is put back where the stand-in ends.
// A tap, or a push on the controls, ends it early.

const FOCUS_TIME = 1.1;
const GAP = 0.45; // each bunny stands this far either side of the middle
const GATHER_LIMIT = 3.5; // seconds for your stand-in to reach her spot
const BANNER = { width: 2.6, height: 0.975, above: 0.62 }; // metres; centre above the book's top
const CLAP_RATE = 15; // the rig's clap: paws meet when cos(time * 15) = -1

// The dance, cue by cue (seconds after both bunnies are in place).
const CUES = [
  [0, "greet"],
  [1.3, "cheer"],
  [2.4, "twirl"],
  [3.5, "dance"],
  [5.5, "clap"],
  [6.8, "bow"],
  [8.0, "heart"],
  [8.6, "farewell"],
  [9.8, "end"],
];

const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

export function createCelebration({
  scene, camera, walker, island, cast, fx, sfx, getSelections, notify = () => {}, isWalking, muteHints = () => {}, onScene = () => {},
  onEnd = () => {},
  onDanced = () => {},
  stays = () => false, // the other bunny stays with you afterwards (gameplay/couple.js)
}) {
  const { host, partner } = cast;
  const pages = island.slots.filter((slot) => slot.userData.content?.type === "keepsake");
  const frame = pages.length ? boardFrame(pages) : null;
  const bookTop = frame ? Math.max(...frame.points.map((p) => p.box.max.y)) : 0;
  let show = null;
  const focus = { from: null, to: null, t: 0 };
  let back = null; // easing the camera back after a show seen from a tour stop

  // The ribbon: a sprite over the book.
  const bannerCanvas = document.createElement("canvas");
  bannerCanvas.width = 1024;
  bannerCanvas.height = 384;
  const bannerTexture = new THREE.CanvasTexture(bannerCanvas);
  bannerTexture.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: bannerTexture, transparent: true, depthWrite: false, opacity: 0 }));
  banner.visible = false;
  banner.renderOrder = 5;
  scene.add(banner);

  // Two spots in front of the book, side by side, with room to twirl: the
  // pair nearest to 1.3 m out and centred on the book.
  function spots() {
    const map = walker.map;
    let best = null;
    for (let front = 0.9; front < 2.35; front += 0.1) {
      for (let shift = -1.2; shift < 1.25; shift += 0.1) {
        const score = Math.abs(front - 1.3) + Math.abs(shift) * 0.8;
        if (best && score >= best.score) continue;
        const mid = frame.centre.clone().addScaledVector(frame.normal, front).addScaledVector(frame.side, shift);
        const a = mid.clone().addScaledVector(frame.side, -GAP);
        const b = mid.clone().addScaledVector(frame.side, GAP);
        const ha = footing(map, a.x, a.z, 0.24);
        const hb = ha === null ? null : footing(map, b.x, b.z, 0.24);
        if (hb === null || Math.abs(ha - hb) > 0.2) continue;
        best = { score, pair: [a.setY(ha), b.setY(hb)] };
      }
    }
    return best?.pair ?? null;
  }

  function cameraRig(cam, dt) {
    if (!focus.from) focus.from = { position: cam.position.clone(), quaternion: cam.quaternion.clone(), fov: cam.fov };
    focus.t = Math.min(1, focus.t + dt / FOCUS_TIME);
    const k = smooth(focus.t);
    cam.position.lerpVectors(focus.from.position, focus.to.position, k);
    cam.quaternion.slerpQuaternions(focus.from.quaternion, focus.to.quaternion, k);
    cam.fov = THREE.MathUtils.lerp(focus.from.fov, focus.to.fov, k);
    cam.updateProjectionMatrix();
  }

  const both = (fn) => [host, partner].forEach(fn);
  // Turned to the other one, and a third of the way to you so you see their faces.
  const towards = (a, b) => () => {
    const other = yawTo(a.position, b.position);
    return other + wrap(yawTo(a.position, camera.position) - other) * 0.35;
  };
  const facingEachOther = () => {
    host.turnTo(towards(host, partner));
    partner.turnTo(towards(partner, host));
    host.lookAt(show.heads.partner);
    partner.lookAt(show.heads.host);
  };
  const facingYou = () => both((b) => {
    b.turnTo(null);
    b.lookAt(null);
  });

  function cue(name) {
    const mid = show.middle;
    if (name === "greet") {
      facingEachOther();
      both((b) => {
        b.play("wave", 1.3);
        b.express("happy", 1.3);
      });
      sfx.twinkle?.();
    } else if (name === "cheer") {
      facingYou();
      both((b) => {
        b.cheer();
        b.express("love", 2.4);
      });
      fx.hearts(mid.clone().add(new THREE.Vector3(0, 1.2, 0)), 10);
      sfx.fanfare();
    } else if (name === "twirl") {
      both((b) => {
        b.play("twirl", 1.0);
        fx.sparkle(b.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 16, "#ffe7a8");
      });
      sfx.twirl?.();
    } else if (name === "dance") {
      both((b) => {
        b.play("dance", 2.0);
        b.express("happy", 3.2);
      });
      fx.confetti(mid.clone().add(new THREE.Vector3(0, 1.6, 0)));
      show.lit = true;
      show.bannerAt = show.t;
      banner.visible = true;
      notify(show.summary);
      sfx.jingle?.();
    } else if (name === "clap") {
      both((b) => b.play("clap", 1.2));
      show.clapUntil = show.t + 1.2;
    } else if (name === "bow") {
      facingEachOther();
      both((b) => {
        b.play("bow", 1.1);
        b.express("love", 1.8);
      });
      sfx.chime();
    } else if (name === "heart") {
      const above = mid.clone().add(new THREE.Vector3(0, 1.2, 0));
      fx.bigHeart?.(above);
      fx.sparkle(above, 24, "#ffd6ea");
      sfx.kiss?.();
    } else if (name === "farewell") {
      facingYou();
      host.play("wave", 1.2);
      show.bannerOut = show.t;
    } else if (name === "end") {
      finish();
    }
  }

  // Both in place: the dance begins.
  function begin() {
    show.phase = "dance";
    show.t = 0;
    show.next = 0;
  }

  function finish() {
    const s = show;
    show = null;
    if (!(s.walking && stays())) host.vanish();
    host.holdWand(true);
    host.lookAt(null);
    host.turnTo(null);
    banner.visible = false;
    if (s.walking) {
      // Back to your own bunny, the follow camera on the side the dance was
      // seen from (it had a clear view).
      walker.placeAt(partner.position, partner.heading, { cameraFrom: focus.to.position });
      partner.vanish({ quiet: true });
      walker.setHidden(false);
      walker.setFrozen(false);
      walker.setCameraOverride(null);
    } else {
      partner.vanish();
      back = { from: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov }, to: s.saved, t: 0 };
    }
    muteHints(false);
    onScene(false);
    onEnd();
  }

  return {
    get active() { return Boolean(show); },
    // Where the book is (boardFrame) and how high it reaches, for the trail.
    frame,
    bookTop,
    // A tap on the book. True if it was handled here (a dance, or a word
    // about what is still missing).
    start(slot) {
      if (show || !frame || !pages.includes(slot)) return false;
      const chosen = getSelections();
      const missing = [!chosen.date && "a day from the calendar", !chosen.activity && "an adventure", !chosen.place && "a place from the map"].filter(Boolean);
      if (missing.length) {
        notify(`First choose ${listing(missing)}, then we can celebrate here ♡`);
        return true;
      }
      const places = spots();
      if (!places) return false;
      const walking = isWalking();
      // You take the spot nearer to where you are.
      const [left, right] = places;
      const near = walking && walker.position.distanceToSquared(right) < walker.position.distanceToSquared(left);
      const yours = near ? right : left;
      const theirs = near ? left : right;
      const middle = left.clone().add(right).multiplyScalar(0.5);
      drawDateBanner(bannerCanvas, chosen);
      bannerTexture.needsUpdate = true;
      banner.position.copy(frame.centre).addScaledVector(frame.normal, 0.25).setY(bookTop + BANNER.above);
      const date = longDate(chosen.date);
      show = {
        phase: "gather", clock: 0, t: 0, next: 0, walking, yours, middle, lit: false,
        bannerAt: -1, bannerOut: -1, clapUntil: -1, lastClap: null,
        summary: `${date} · ${chosen.place} · ${chosen.activity}. It’s a date! ♡`,
        heads: { host: new THREE.Vector3(), partner: new THREE.Vector3() },
        saved: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov },
      };
      // The camera takes in the book, the ribbon over it and the two of them.
      const box = new THREE.Box3();
      frame.points.forEach((p) => box.union(p.box));
      // Looking down a little, so the pages show over their heads: a clear
      // side to look from, then fitted to the book, the ribbon and the two.
      const top = bookTop + BANNER.above + BANNER.height / 2;
      const base = framePose(walker.map, camera.aspect, frame, {
        bottom: Math.min(left.y, right.y),
        top,
        width: Math.max(frame.half, GAP + 0.7, BANNER.width / 2) * 2 + 0.8,
        target: frame.centre.clone().addScaledVector(frame.normal, 0.5),
        framings: [[1, 0.46, 50], [1, 0.6, 50], [0.85, 0.55, 58], [0.85, 0.75, 58], [0.7, 0.7, 66], [0.7, 0.95, 66]],
      });
      const points = [];
      for (const sign of [-1, 1]) {
        points.push(
          frame.centre.clone().addScaledVector(frame.side, sign * frame.half).setY(bookTop),
          frame.centre.clone().addScaledVector(frame.side, sign * frame.half).setY(box.min.y),
          banner.position.clone().addScaledVector(frame.side, sign * BANNER.width / 2).setY(top + 0.3), // headroom under the page header
        );
        for (const spot of places) {
          points.push(spot.clone().addScaledVector(frame.side, sign * 0.35), spot.clone().addScaledVector(frame.side, sign * 0.35).setY(spot.y + 1.15));
        }
      }
      focus.to = fitPose(base.position, points, { fov: base.fov, aspect: camera.aspect, map: walker.map }) || base;
      focus.from = null;
      focus.t = 0;
      back = null;
      muteHints(true);
      onScene(true);
      // The book has been opened with the whole plan made: that counts from
      // here on, even if the dance is cut short.
      onDanced();
      // The host pops in beside your spot; your stand-in walks over to hers.
      host.holdWand(false);
      host.pointAt(null);
      host.hop(0);
      host.appear(theirs, yawTo(theirs, yours));
      host.turnTo(towards(host, partner));
      partner.turnTo(null);
      partner.lookAt(null);
      if (walking) {
        partner.appear(walker.position, walker.heading, { quiet: true });
        partner.setHolding?.(...walker.holding);
        walker.setHidden(true);
        walker.setFrozen(true);
        walker.setCameraOverride(cameraRig);
        partner.runTo(yours, () => {
          if (show?.phase === "gather") begin();
        }, 2.2);
      } else {
        partner.appear(yours, yawTo(yours, theirs));
        begin();
      }
      return true;
    },
    // A tap or a push on the controls: wrap up now.
    skip() {
      if (show) finish();
    },
    // Leaving walking or the tour stop: put everything away at once and let
    // go of the camera (the tour flies on from wherever it is).
    cancel() {
      if (!show) return;
      finish();
      back = null;
    },
    // The book's pages glow while they dance (null: leave the glow alone).
    glow(slot, time) {
      if (!show?.lit || !pages.includes(slot)) return null;
      return 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(time * 4));
    },
    update(time, dt) {
      if (back) {
        back.t = Math.min(1, back.t + dt / 0.9);
        const k = smooth(back.t);
        camera.position.lerpVectors(back.from.position, back.to.position, k);
        camera.quaternion.slerpQuaternions(back.from.quaternion, back.to.quaternion, k);
        camera.fov = THREE.MathUtils.lerp(back.from.fov, back.to.fov, k);
        camera.updateProjectionMatrix();
        if (back.t >= 1) back = null;
      }
      if (!show) return;
      show.clock += dt;
      if (show.walking && walker.urge > 0.3) {
        finish();
        return;
      }
      if (!show.walking) cameraRig(camera, dt);
      show.heads.host.copy(host.position).setY(host.position.y + 0.55);
      show.heads.partner.copy(partner.position).setY(partner.position.y + 0.55);
      if (show.phase === "gather") {
        if (show.clock > GATHER_LIMIT) {
          // Still on her way: she skips the rest of the walk.
          partner.appear(show.yours, yawTo(show.yours, host.position), { quiet: true });
          begin();
        }
        return;
      }
      show.t += dt;
      while (show && show.next < CUES.length && show.t >= CUES[show.next][0]) cue(CUES[show.next++][1]);
      if (!show) return;
      // A clap each time their paws meet.
      if (show.t < show.clapUntil) {
        const beat = Math.floor((time * CLAP_RATE + Math.PI) / (Math.PI * 2));
        if (show.lastClap !== null && beat !== show.lastClap) sfx.clap?.();
        show.lastClap = beat;
      }
      // The ribbon pops up (with a little overshoot), bobs, and fades away.
      if (show.bannerAt >= 0) {
        const t = show.t - show.bannerAt;
        const pop = Math.min(1, t / 0.45);
        const overshoot = 1 + Math.sin(pop * Math.PI) * 0.12;
        const out = show.bannerOut >= 0 ? Math.max(0, 1 - (show.t - show.bannerOut) / 0.8) : 1;
        const s = smooth(pop) * overshoot;
        banner.scale.set(BANNER.width * s, BANNER.height * s, 1);
        banner.material.opacity = Math.min(1, pop * 1.6) * out;
        banner.position.y = bookTop + BANNER.above + Math.sin(time * 2.1) * 0.035;
      }
    },
    dispose() {
      scene.remove(banner);
      banner.material.dispose();
      bannerTexture.dispose();
    },
  };
}

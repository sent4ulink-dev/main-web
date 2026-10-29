import * as THREE from "three";
import { calendarTap, shiftMonth } from "../world/slot-art.js";
import { UPRIGHT_FRAMINGS, boxCorners, fitPose, framePose } from "./framing.js";

// Picking on the boards, with no dialog: the first tap on the calendar, the
// activity board or the treasure map frames it with the camera and brings out
// the host (the other bunny) with its wand. Tap a picture (or a day) and the
// host runs over to point at it; tap the same one again and it is chosen, the
// host cheers, and the camera goes back to where it was. Walking off or
// tapping away from the board closes it.
//
// On a phone held upright the board fills the width of the screen and the
// host waits in front of it, under the pictures, rather than beside it; on
// small screens the camera also moves in on the picture being shown (its
// neighbours peeking in at the sides) so its words can be read.

const TYPES = { calendar: "calendar", activity: "activity", place: "place" };
const CALENDAR = { width: 768, height: 1024 }; // the calendar canvas (slot-art.js)
const FOCUS_TIME = 0.9;
const AFTER_CHOICE = 2.6; // seconds of cheering before the view closes
const PEEK = 0.55; // metres of each neighbour shown beside a close-up picture
// How much of the screen the board (or a close-up) fills: a little room round
// it, so a phone shows the pictures beside it too.
const FILL = 0.84;
const HOST_HEIGHT = 1.05;
const HOST_HALF = 0.3; // half its width, paws and ears and all
// Close-ups on an upright phone look down a little more, so the host and
// whatever stands in front of the board stay under the picture.
const CLOSE_FRAMINGS = [[0.75, 0.45, 66], [0.75, 0.65, 66], [0.65, 0.55, 74], [0.65, 0.8, 74]];

// On an upright phone the header takes the top of the screen (the joystick
// and buttons step aside while picking): boards are framed below it.
const UPRIGHT_SAFE = { top: 0.8, bottom: -0.85 };

// The host's outline at a spot, for framing.
function hostPoints(spot, side) {
  const points = [];
  for (const sign of [-1, 1]) {
    const edge = spot.clone().addScaledVector(side, sign * HOST_HALF);
    points.push(edge.clone(), edge.setY(spot.y + HOST_HEIGHT));
  }
  return points;
}

const smooth = (t) => t * t * (3 - 2 * t);
const poseOf = (cam) => ({ position: cam.position.clone(), quaternion: cam.quaternion.clone(), fov: cam.fov });
// A patch of a board round a point (a week on the calendar), as a picture.
function around(f, point) {
  const corners = [];
  for (const across of [-0.5, 0.5]) {
    for (const up of [-0.4, 0.4]) {
      for (const out of [-0.05, 0.05]) corners.push(point.clone().addScaledVector(f.side, across).addScaledVector(f.normal, out).setY(point.y + up));
    }
  }
  return { centre: point.clone(), box: new THREE.Box3().setFromPoints(corners) };
}

export function createChooser({
  camera, walker, island, host, getContent, getSelections, onChoose, notify = () => {}, isWalking, muteHints = () => {},
  viewport = () => ({ width: innerWidth, height: innerHeight }), onPicking = () => {},
}) {
  let board = null; // the host station being picked from
  let layout = "side"; // where the host stands: "side" of the board, or in "front" of it
  let candidate = null; // { slot } on the activity board / map, { date } on the calendar
  let viewMonth = null; // the month being browsed on the calendar ("YYYY-MM")
  let closing = 0;
  let mode = null; // "walk": the follow camera is lent to us; "tour": we move the camera ourselves
  let saved = null; // the tour's camera, to go back to
  let back = null; // easing back to it after closing
  const focus = { from: null, to: null, t: 1 };

  // A phone held upright: the host waits in front of the board.
  const upright = () => camera.aspect < 1.1;
  // A small screen: the camera moves in on the picture being shown.
  const small = () => upright() || Math.min(viewport().width, viewport().height) < 520;

  function repaint() {
    island.setSelections({ ...getSelections(), viewMonth, candidate: candidate?.date ?? null });
  }

  // The whole board, and the host waiting at its spot.
  function overview(station) {
    const f = station.frame;
    const map = walker.map;
    const box = new THREE.Box3();
    f.points.forEach((p) => box.union(p.box));
    const wait = host.readyFor(station.key, layout);
    if (layout === "side") {
      return framePose(map, camera.aspect, f, { bottom: Math.min(box.min.y, wait.y), top: box.max.y, width: (f.half + 1.9) * 2 });
    }
    const base = framePose(map, camera.aspect, f, {
      bottom: Math.min(box.min.y, wait.y), top: box.max.y, width: f.half * 2 + 0.3, ...uprightFraming(),
    });
    const points = [...boxCorners(box), ...hostPoints(wait, f.side)];
    return fitPose(base.position, points, { fov: base.fov, aspect: camera.aspect, fill: FILL, map, ...safeArea() }) || base;
  }
  // On an upright phone: a taller view from closer in, nothing big in front,
  // and the board kept clear of the controls.
  const uprightFraming = () => (upright() ? { framings: UPRIGHT_FRAMINGS, foreground: true } : {});
  const safeArea = () => (upright() ? { safe: UPRIGHT_SAFE } : {});

  // Close in on one picture, its neighbours peeking in at the sides, with the
  // host where it is going to stand.
  function closeUp(station, picture, spot, peek = PEEK) {
    const f = station.frame;
    const map = walker.map;
    const { box } = picture;
    const half = (Math.abs((box.max.x - box.min.x) * f.side.x) + Math.abs((box.max.z - box.min.z) * f.side.z)) / 2;
    const near = { centre: picture.centre, normal: f.normal, side: f.side, half, points: [picture] };
    const base = framePose(map, camera.aspect, near, {
      bottom: Math.min(box.min.y, spot.y), top: box.max.y, width: half * 2 + peek * 2, ...(upright() ? { framings: CLOSE_FRAMINGS } : {}),
    });
    const points = [...boxCorners(box), ...hostPoints(spot, f.side)];
    for (const sign of [-1, 1]) {
      const edge = picture.centre.clone().addScaledVector(f.side, sign * (half + peek));
      points.push(edge.clone().setY(box.min.y), edge.setY(box.max.y));
    }
    return fitPose(base.position, points, { fov: base.fov, aspect: camera.aspect, fill: FILL, map, ...safeArea() }) || base;
  }

  function aimAt(pose) {
    focus.from = null; // taken from wherever the camera is on the next frame
    focus.to = pose;
    focus.t = 0;
  }
  function cameraRig(cam, dt) {
    if (!focus.to) return;
    if (!focus.from) focus.from = poseOf(cam);
    focus.t = Math.min(1, focus.t + dt / FOCUS_TIME);
    const k = smooth(focus.t);
    cam.position.lerpVectors(focus.from.position, focus.to.position, k);
    cam.quaternion.slerpQuaternions(focus.from.quaternion, focus.to.quaternion, k);
    cam.fov = THREE.MathUtils.lerp(focus.from.fov, focus.to.fov, k);
    cam.updateProjectionMatrix();
  }

  function choose(type, value) {
    candidate = null;
    onChoose(type, value);
    repaint();
    host.celebrate();
    closing = AFTER_CHOICE;
  }

  const api = {
    get active() { return Boolean(board); },
    get candidateSlot() { return candidate?.slot ?? null; },
    // Is this slot part of a picking board?
    picks(slot) { return Boolean(TYPES[slot?.userData.content?.type]); },
    // First tap on a board: frame it and bring out the host.
    open(slot) {
      const type = TYPES[slot?.userData.content?.type];
      const station = type && host.stations.find((s) => s.key === type);
      if (!station) return false;
      board = station;
      layout = upright() ? "front" : "side";
      candidate = null;
      viewMonth = null;
      closing = 0;
      host.present(station.key, { layout });
      muteHints(true);
      onPicking(true);
      mode = isWalking() ? "walk" : "tour";
      if (mode === "walk") {
        walker.setCameraOverride(cameraRig);
        walker.setHidden?.(true); // your bunny steps out of the shot
      } else {
        saved = back ? back.to : poseOf(camera);
        back = null;
      }
      aimAt(overview(station));
      notify(type === "calendar" ? "Tap your day, then tap again to choose it. Tapping an empty spot closes this ♡" : "Tap one, then tap again to choose it. Tapping an empty spot closes this ♡");
      return true;
    },
    // A tap while a board is open: a raycast hit on one of the slots, or null.
    tap(hit) {
      if (!board || closing > 0) return;
      const slot = hit?.object;
      if (!slot || !board.frame.points.some((p) => p.slot === slot)) {
        api.close();
        return;
      }
      const info = slot.userData.content;
      if (info.type === "calendar") {
        if (!hit.uv) return;
        const shown = { ...getSelections(), viewMonth };
        const tap = calendarTap(getContent(), shown, hit.uv.x * CALENDAR.width, hit.uv.y * CALENDAR.height, CALENDAR.width);
        if (!tap) return;
        if (tap.step) {
          viewMonth = shiftMonth(getContent(), shown, tap.step);
          candidate = null;
          repaint();
          host.show(hit.point.clone(), 0.15);
          if (small()) aimAt(overview(board)); // the whole new month
        } else if (candidate?.date === tap.date) {
          choose("calendar", tap.date);
        } else {
          candidate = { date: tap.date };
          repaint();
          const spot = host.show(hit.point.clone(), 0.15);
          // On a small screen, in on that week (most of the month still in view).
          if (spot && small()) aimAt(closeUp(board, around(board.frame, hit.point), spot, 0.08));
        }
        return;
      }
      if (candidate?.slot === slot) {
        choose(info.type, info.value);
        return;
      }
      candidate = { slot };
      const picture = board.frame.points.find((p) => p.slot === slot);
      const size = picture.box.getSize(new THREE.Vector3());
      const spot = host.show(picture.centre.clone(), Math.hypot(size.x, size.z) / 2);
      if (spot && small()) aimAt(closeUp(board, picture, spot));
    },
    // release: leave the camera where it is (something else is about to move it).
    close({ release = false } = {}) {
      if (!board) return;
      board = null;
      candidate = null;
      viewMonth = null;
      closing = 0;
      host.leave();
      muteHints(false);
      onPicking(false);
      if (mode === "walk") {
        walker.setCameraOverride(null);
        walker.setHidden?.(false);
      } else if (mode === "tour" && saved && !release) {
        back = { from: poseOf(camera), to: saved, t: 0 };
      }
      mode = null;
      focus.to = null;
      repaint();
    },
    update(dt) {
      if (back) {
        back.t = Math.min(1, back.t + dt / FOCUS_TIME);
        const k = smooth(back.t);
        camera.position.lerpVectors(back.from.position, back.to.position, k);
        camera.quaternion.slerpQuaternions(back.from.quaternion, back.to.quaternion, k);
        camera.fov = THREE.MathUtils.lerp(back.from.fov, back.to.fov, k);
        camera.updateProjectionMatrix();
        if (back.t >= 1) back = null;
      }
      if (!board) return;
      if (mode === "tour") cameraRig(camera, dt);
      if (closing > 0) {
        closing -= dt;
        if (closing <= 0) api.close();
        return;
      }
      // Walking off closes the board.
      if (mode === "walk" && walker.speed > 0.6) api.close();
    },
  };
  return api;
}

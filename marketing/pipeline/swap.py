# Put a screen recording (a video or a folder of frames) into the tracked phone. The green itself is the matte:
# fingers, nails, the notch and the rounded bezel stay exactly as filmed.
# python swap.py clip.mp4 recording out.mp4 offset_s [dy]
#   recording: a video file, or a folder of numbered frames at 24 fps; offset_s: recording time at the clip's first frame
#   dy: shift the page down (+) / up (-) inside the screen, in recording px, so a button sits under the finger
import cv2, numpy as np, json, sys, glob, os

vid, rec, out, offset = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
dy = int(sys.argv[5]) if len(sys.argv) > 5 else 0
S = np.array(json.load(open(vid + '.track.json')), np.float32)


def shift(f):
    if dy > 0: return cv2.copyMakeBorder(f, dy, 0, 0, 0, cv2.BORDER_REPLICATE)[:f.shape[0]]
    if dy < 0: return cv2.copyMakeBorder(f[-dy:], 0, -dy, 0, 0, cv2.BORDER_REPLICATE)
    return f


if os.path.isdir(rec):
    files = sorted(glob.glob(os.path.join(rec, '*.jpg')) + glob.glob(os.path.join(rec, '*.png')))
    RT = np.arange(len(files)) / 24.0; load = lambda k: shift(cv2.imread(files[k]))
else:
    rc = cv2.VideoCapture(rec); RT, RF = [], []
    while True:
        ok, f = rc.read()
        if not ok: break
        RT.append(rc.get(cv2.CAP_PROP_POS_MSEC) / 1000.0); RF.append(shift(f))
    RT = np.array(RT); load = lambda k: RF[k]

cap = cv2.VideoCapture(vid); fps = cap.get(cv2.CAP_PROP_FPS) or 24; W, H = int(cap.get(3)), int(cap.get(4))
vw = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H)); i = 0; noise = np.random.default_rng(3)
while True:
    ok, fr = cap.read()
    if not ok: break
    q = S[min(i, len(S) - 1)]; c = q.mean(0); qo = c + (q - c) * 1.02             # slight overscan under the bezel
    k = int(np.clip(np.searchsorted(RT, offset + i / fps, side='right') - 1, 0, len(RT) - 1)); r = load(k)
    rh, rw = r.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [rw, 0], [rw, rh], [0, rh]]), qo)
    warped = cv2.warpPerspective(r, M, (W, H), flags=cv2.INTER_AREA).astype(np.float32)
    warped = cv2.GaussianBlur(warped, (0, 0), 0.55) + noise.normal(0, 1.6, warped.shape)
    f = fr.astype(np.float32); b, g, rr = cv2.split(f); mx = np.maximum(b, rr)
    region = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(region, (c + (q - c) * 1.05).astype(np.int32), 255)
    alpha = np.clip((g - mx - 22) / 33.0, 0, 1) * (region > 0)
    core = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(core, (c + (q - c) * 0.95).astype(np.int32), 255)
    holes = ((alpha < 0.5) & (core > 0)).astype(np.uint8)                         # compression pin-holes only
    n, lab, st, _ = cv2.connectedComponentsWithStats(holes, connectivity=8)
    small = np.zeros(n, bool); small[1:] = st[1:, cv2.CC_STAT_AREA] < 40; alpha[small[lab]] = 1.0
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (3, 3), 0)
    w = cv2.GaussianBlur((region > 0).astype(np.float32), (0, 0), 12)              # smooth despill, no edges
    base = cv2.merge([b, g - np.maximum(0, g - mx - 4) * w, rr])
    a = alpha[..., None]
    vw.write((warped * a + base * (1 - a)).clip(0, 255).astype(np.uint8)); i += 1
vw.release(); print(out, i, 'frames')

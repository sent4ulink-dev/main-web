# Track a chroma-green phone screen through a video: fit its 4 straight sides each frame (RANSAC on the outermost
# boundary points, so notches and fingers don't pull the edges in), let hidden sides follow the visible ones, smooth.
# python track.py clip.mp4  ->  clip.mp4.track.json (per-frame 4 corners: top-left, top-right, bottom-right, bottom-left)
import cv2, numpy as np, json, sys

rng = np.random.default_rng(1)


def order(p):
    # clockwise from the phone's own top-left: the top is the short edge nearer the image top
    c = p.mean(0); p = p[np.argsort(np.arctan2(p[:, 1] - c[1], p[:, 0] - c[0]))]
    L = [np.linalg.norm(p[(k + 1) % 4] - p[k]) for k in range(4)]
    short = [0, 2] if L[0] + L[2] < L[1] + L[3] else [1, 3]
    k = min(short, key=lambda k: (p[k][1] + p[(k + 1) % 4][1]))
    return np.array([p[(k + j) % 4] for j in range(4)], np.float32)


def green(fr):
    f = fr.astype(np.int16); g = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    return cv2.morphologyEx(((g > 35) * 255).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))


def boundary(m):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return max(cnts, key=cv2.contourArea).reshape(-1, 2).astype(np.float32) if cnts else None


def ransac_line(pts, it=160, tol=1.8):
    best, bc = None, 0
    for _ in range(it):
        i, j = rng.integers(0, len(pts), 2)
        if i == j: continue
        d = pts[j] - pts[i]; n = np.linalg.norm(d)
        if n < 8: continue
        nn = np.array([-d[1], d[0]]) / n; c = np.abs((pts - pts[i]) @ nn) < tol; k = c.sum()
        if k > bc: bc, best = k, c
    if best is None: return None, 0
    vx, vy, x0, y0 = cv2.fitLine(pts[best], cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    return (np.array([x0, y0]), np.array([vx, vy])), int(bc)


def inter(l1, l2):
    (p1, d1), (p2, d2) = l1, l2; A = np.array([d1, -d2]).T
    if abs(np.linalg.det(A)) < 1e-6: return None
    return p1 + np.linalg.solve(A, p2 - p1)[0] * d1


def proj(p, l):
    p0, d = l; return p0 + ((p - p0) @ d) * d


def step(fr, prev, pred):
    P = boundary(green(fr))
    if P is None: return pred, [False] * 4
    lines, ok = [], []
    for i in range(4):
        a, b = pred[i], pred[(i + 1) % 4]; L = np.linalg.norm(b - a); u = (b - a) / L; n = np.array([-u[1], u[0]])
        if (pred.mean(0) - a) @ n > 0: n = -n                       # normal points out of the screen
        t = (P - a) @ u; d = (P - a) @ n
        win = (t > 0.06 * L) & (t < 0.94 * L) & (np.abs(d) < 18)
        sel = P[win]
        if len(sel) > 20:                                           # the real edge is the outermost line
            dd = d[win]; sel = sel[dd >= np.percentile(dd, 85) - 4]
        line, cnt = ransac_line(sel) if len(sel) > 20 else (None, 0)
        good = line is not None and cnt >= 0.35 * 0.88 * L
        if good:
            good = np.arccos(np.clip(abs(line[1] @ u), 0, 1)) < np.radians(6) and abs((line[0] - a) @ n) < 18
        lines.append(line if good else None); ok.append(good)
    cur = np.full((4, 2), np.nan, np.float32)
    for c in range(4):
        if ok[c - 1] and ok[c]:
            x = inter(lines[c - 1], lines[c])
            if x is not None: cur[c] = x
    have = ~np.isnan(cur[:, 0])
    guess = pred
    if have.sum() >= 2:
        M, _ = cv2.estimateAffinePartial2D(prev[have].reshape(-1, 1, 2), cur[have].reshape(-1, 1, 2))
        if M is not None: guess = cv2.transform(prev.reshape(-1, 1, 2), M).reshape(4, 2)
    out = cur.copy()
    for c in range(4):
        if have[c]: continue
        side = lines[c - 1] if ok[c - 1] else (lines[c] if ok[c] else None)
        out[c] = proj(guess[c], side) if side is not None else guess[c]
    return out.astype(np.float32), ok


def quad_of_image(img):
    """The screen corners in a single still (used to place tap targets on start frames)."""
    q = order(cv2.boxPoints(cv2.minAreaRect(cv2.convexHull(boundary(green(img))))).astype(np.float32))
    for _ in range(4): q, _ = step(img, q, q)
    return q


def track(path):
    cap = cv2.VideoCapture(path); frames = []
    while True:
        ok, f = cap.read()
        if not ok: break
        frames.append(f)
    s0 = int(np.argmax([int((green(f) > 0).sum()) for f in frames]))   # start from the least covered frame
    Q = [None] * len(frames); Q[s0] = quad_of_image(frames[s0]); seen = []
    for order_ in (range(s0 + 1, len(frames)), range(s0 - 1, -1, -1)):
        prev = prev2 = Q[s0]
        for i in order_:
            q, ok = step(frames[i], prev, prev + (prev - prev2) * 0.5); Q[i] = q; seen.append(sum(ok)); prev2, prev = prev, q
    S = np.array(Q, np.float32).reshape(len(Q), 8)
    k = cv2.getGaussianKernel(5, 0.8).ravel(); pad = np.pad(S, ((2, 2), (0, 0)), mode='edge')
    S = np.array([np.convolve(pad[:, c], k, mode='valid') for c in range(8)]).T.reshape(len(Q), 4, 2)
    return S, frames, seen


if __name__ == '__main__':
    S, frames, seen = track(sys.argv[1])
    d2 = np.abs(S[2:] - 2 * S[1:-1] + S[:-2]).max(axis=(1, 2))
    miss = []
    for i, f in enumerate(frames):
        m = green(f) > 0; q = np.zeros(m.shape, np.uint8); cv2.fillConvexPoly(q, S[i].astype(np.int32), 1)
        miss.append(int((m & (cv2.dilate(q, np.ones((5, 5), np.uint8)) == 0)).sum()))
    print(sys.argv[1], 'sides seen %.2f/4' % np.mean(seen), '| jerk median %.2f max %.2f' % (np.median(d2), d2.max()),
          '| green outside quad median', int(np.median(miss)), 'max', max(miss))
    json.dump(S.tolist(), open(sys.argv[1] + '.track.json', 'w'))

# Where does the finger touch the screen? Fingertip per frame in page coordinates (390x844), from the tracked screen.
# python finger.py clip.mp4  ->  prints the tip every 2 frames and writes clip.mp4.tips.json
import cv2, numpy as np, json, sys

PW, PH = 390, 844
path = sys.argv[1]; S = np.array(json.load(open(path + '.track.json')), np.float32)
cap = cv2.VideoCapture(path); out = []; i = 0
dst = np.float32([[0, 0], [PW, 0], [PW, PH], [0, PH]])
while True:
    ok, fr = cap.read()
    if not ok: break
    page = cv2.warpPerspective(fr, cv2.getPerspectiveTransform(S[min(i, len(S) - 1)], dst), (PW, PH))
    f = page.astype(np.int16); occ = ((f[..., 1] - np.maximum(f[..., 0], f[..., 2])) < 22).astype(np.uint8) * 255
    occ[:, :8] = 0; occ[:, -8:] = 0; occ[:8, :] = 0; occ[-8:, :] = 0; occ[:60, 120:270] = 0       # bezel, notch
    occ = cv2.morphologyEx(occ, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(occ); tip = None
    if n > 1:
        j = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        if st[j, cv2.CC_STAT_AREA] > 400:
            ys, xs = np.nonzero(lab == j)
            edges = {'b': (ys > PH - 30).sum(), 'r': (xs > PW - 30).sum(), 'l': (xs < 30).sum(), 't': (ys < 30).sum()}
            e = max(edges, key=edges.get)
            k = {'b': np.argmin(ys), 't': np.argmax(ys), 'r': np.argmin(xs), 'l': np.argmax(xs)}[e]
            tip = [int(xs[k]), int(ys[k]), int(st[j, cv2.CC_STAT_AREA]), e]
    out.append(tip); i += 1
json.dump(out, open(path + '.tips.json', 'w'))
print(path, ' '.join(f"{t/24:.2f}:{v[0]},{v[1]}" for t, v in enumerate(out) if v and t % 2 == 0))

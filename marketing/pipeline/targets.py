# Draw dark-green tap targets onto start frames, exactly where the real buttons will be once the screen is replaced.
# Dark green (0,118,0) is still inside the chroma key, so the target disappears in the final composite.
# python targets.py in.png out.png pill:cx,cy,w,h [circle:cx,cy,r ...]     (page coordinates, 390x844)
import cv2, numpy as np, sys
from track import quad_of_image

PW, PH = 390, 844
src, dst = sys.argv[1], sys.argv[2]
im = cv2.imread(src); q = quad_of_image(im)
M = cv2.getPerspectiveTransform(np.float32([[0, 0], [PW, 0], [PW, PH], [0, PH]]), q)
page = np.zeros((PH, PW), np.uint8)
for spec in sys.argv[3:]:
    kind, nums = spec.split(':'); v = [int(x) for x in nums.split(',')]
    if kind == 'pill':
        cx, cy, w, h = v; r = h // 2
        cv2.rectangle(page, (cx - w // 2 + r, cy - r), (cx + w // 2 - r, cy + r), 255, -1)
        cv2.circle(page, (cx - w // 2 + r, cy), r, 255, -1); cv2.circle(page, (cx + w // 2 - r, cy), r, 255, -1)
    else:
        cx, cy, r = v; cv2.circle(page, (cx, cy), r, 255, -1)
m = cv2.warpPerspective(page, M, (im.shape[1], im.shape[0]))
im[m > 128] = (0, 118, 0); cv2.imwrite(dst, im)
print(dst, 'screen quad', q.round(1).tolist())

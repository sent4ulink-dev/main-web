# Edit the ad frame by frame from a JSON plan: phone clips (already composited) and full-screen card footage,
# joined by cuts, whip-pans or a zoom into / out of the phone screen; then captions and audio with ffmpeg.
# python edit.py plan.json
# plan: {"out": "final.mp4", "audio": "mix.wav", "segments": [ {"kind": "clip", "file": "s2.mp4", "from": 0.2, "dur": 2.3,
#        "track": "k2.mp4.track.json", "in": "whip|zoomout|cut", "out": "whip|zoomin|cut"} | {"kind": "fs", "frames": "dir", "from": 1.0,
#        "dur": 2.4, "in": ..., "out": ...} ], "captions": [{"s":..,"e":..,"text":..,"y":0.7,"x":"c"|0.04, "plate": false}]}
import cv2, numpy as np, json, sys, glob, os, subprocess
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 720, 1280, 24
PAGE_AR = 390 / 844
plan = json.load(open(sys.argv[1]))
FONT = os.environ.get('CAPTION_FONT', os.path.join(os.environ.get('HF_WORKFLOWS', ''), 'video-montage/scripts/fonts/Metropolis-ExtraBold.ttf'))


def fs_frame(img):
    """Full-screen card footage: scale the 390x844 page to the frame width, crop the middle."""
    h = int(round(W / PAGE_AR)); im = cv2.resize(img, (W, h), interpolation=cv2.INTER_AREA)
    y0 = (h - H) // 2; return im[y0:y0 + H]


FS_RECT = np.float32([[0, -(W / PAGE_AR - H) / 2], [W, -(W / PAGE_AR - H) / 2], [W, H + (W / PAGE_AR - H) / 2], [0, H + (W / PAGE_AR - H) / 2]])


def seg_frames(sg):
    n = int(round(sg['dur'] * FPS))
    if sg['kind'] == 'clip':
        cap = cv2.VideoCapture(sg['file']); cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(sg['from'] * FPS))); out = []
        for _ in range(n):
            ok, f = cap.read()
            if not ok: f = out[-1].copy()
            out.append(cv2.resize(f, (W, H)))
        return out
    files = sorted(glob.glob(os.path.join(sg['frames'], '*.jpg'))); k0 = int(round(sg['from'] * FPS))
    return [fs_frame(cv2.imread(files[min(k0 + i, len(files) - 1)])) for i in range(n)]


def ease(p): return p * p * (3 - 2 * p)


def zoom(frames, track, first_frame_index, into, z=10):
    """Push into (or pull out of) the phone screen: the screen's content quad grows until it fills the frame."""
    S = np.array(json.load(open(track)), np.float32); n = len(frames)
    idx = range(n - z, n) if into else range(0, z)
    for j, i in enumerate(idx):
        q = S[min(first_frame_index + i, len(S) - 1)] * [W / 720, H / 1280]; c = q.mean(0); qo = c + (q - c) * 1.02
        p = ease((j + 1) / z) if into else ease(1 - j / z)
        target = (1 - p) * qo + p * FS_RECT
        M = cv2.getPerspectiveTransform(qo.astype(np.float32), target.astype(np.float32))
        frames[i] = cv2.warpPerspective(frames[i], M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return frames


def whip_out(frames, k=5):
    for j in range(k):
        i = len(frames) - k + j; p = ease((j + 1) / k); off = int(p * W * 0.55); blur = 1 + int(90 * p)
        f = np.roll(frames[i], -off, axis=1); frames[i] = cv2.blur(f, (blur, 1))
    return frames


def whip_in(frames, k=5):
    for j in range(k):
        p = ease(1 - j / k); off = int(p * W * 0.55); blur = 1 + int(90 * p)
        f = np.roll(frames[j], off, axis=1); frames[j] = cv2.blur(f, (blur, 1))
    return frames


video = []
for sg in plan['segments']:
    fr = seg_frames(sg)
    if sg['kind'] == 'clip':
        first = int(round(sg['from'] * FPS))
        if sg.get('out') == 'zoomin': fr = zoom(fr, sg['track'], first, True)
        if sg.get('in') == 'zoomout': fr = zoom(fr, sg['track'], first, False)
    if sg.get('out') == 'whip': fr = whip_out(fr)
    if sg.get('in') == 'whip': fr = whip_in(fr)
    if sg.get('in') == 'xfade' and video:            # blend into the end of the previous segment (overlap of 6 frames)
        k = min(6, len(video), len(fr))
        for j in range(k):
            a = (j + 1) / (k + 1); video[len(video) - k + j] = cv2.addWeighted(video[len(video) - k + j], 1 - a, fr[j], a, 0)
        fr = fr[k:]
    video += fr
print('frames', len(video), 'seconds', len(video) / FPS)


def render_caption(text, size, plate, maxw):
    f = ImageFont.truetype(FONT, size); d = ImageDraw.Draw(Image.new('L', (1, 1))); lines = [text]
    if d.textlength(text, font=f) > W * maxw:
        ws = text.split(); best = None
        for i in range(1, len(ws)):
            a, b = ' '.join(ws[:i]), ' '.join(ws[i:]); m = max(d.textlength(a, font=f), d.textlength(b, font=f))
            if best is None or m < best[0]: best = (m, [a, b])
        lines = best[1]
    lh = int(size * 1.18); tw = int(max(d.textlength(l, font=f) for l in lines)); pad = 22 if plate else 10
    img = Image.new('RGBA', (tw + 2 * pad + 12, lh * len(lines) + 2 * pad), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    if plate: dr.rounded_rectangle((0, 0, img.width - 1, img.height - 1), 26, fill=(255, 255, 255, 245))
    for i, l in enumerate(lines):
        x = (img.width - d.textlength(l, font=f)) / 2; y = pad + i * lh
        if plate: dr.text((x, y), l, font=f, fill=(60, 20, 5, 255))
        else: dr.text((x, y), l, font=f, fill=(255, 255, 255, 255), stroke_width=max(3, size // 9), stroke_fill=(0, 0, 0, 255))
    return np.array(img)


caps = []
for c in plan.get('captions', []):
    side = c.get('x', 'c') != 'c'
    img = render_caption(c['text'], c.get('size', 46 if not side else 40), c.get('plate', False), 0.86 if not side else 0.44)
    h, w = img.shape[:2]; x = (W - w) // 2 if not side else int(c['x'] * W); y = int(c['y'] * H - h / 2)
    caps.append((int(c['s'] * FPS), int(c['e'] * FPS), x, y, img))
for (a, b, x, y, img) in caps:
    alpha = img[..., 3:4].astype(np.float32) / 255; rgb = img[..., :3][..., ::-1].astype(np.float32)
    for i in range(a, min(b, len(video))):
        fade = min(1.0, (i - a + 1) / 2)
        roi = video[i][y:y + img.shape[0], x:x + img.shape[1]].astype(np.float32)
        al = alpha[:roi.shape[0], :roi.shape[1]] * fade
        video[i][y:y + roi.shape[0], x:x + roi.shape[1]] = (rgb[:roi.shape[0], :roi.shape[1]] * al + roi * (1 - al)).astype(np.uint8)

tmp = plan['out'] + '.silent.mp4'
vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'), FPS, (W, H))
for f in video: vw.write(f)
vw.release()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-i', plan['audio'], '-map', '0:v', '-map', '1:a', '-t', f'{len(video) / FPS:.3f}',
                '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', plan['out']], check=True)
os.remove(tmp); print('wrote', plan['out'])

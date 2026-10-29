# Cuts the sent4u logo out of its purple background (colour unmixing over a 3-colour palette) and builds the brand files.
# Usage: python marketing/brand/build-brand.py marketing/brand/sent4u-logo-original.webp assets/brand  (needs pillow + numpy; delete the _preview/_icons check images afterwards)
import sys, os
import numpy as np
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float64)
H, W, _ = rgb.shape

D = np.array([41, 9, 52.])      # background / ink purple
C = np.array([251, 243, 232.])  # cream
P = np.array([253, 88, 108.])   # pink
INK = np.array([41, 9, 52.])    # cream parts become this on a light background

# p - D = wC (C - D) + wP (P - D): least squares per pixel, then clamp
M = np.stack([C - D, P - D], axis=1)            # 3x2
pinv = np.linalg.pinv(M)                        # 2x3
w = (rgb - D) @ pinv.T                          # HxWx2
w = np.clip(w, 0, None)
a = w.sum(-1)
over = a > 1
w[over] /= a[over][:, None]
a = np.clip(a, 0, 1)
a = np.clip((a - 0.04) / 0.96, 0, 1)            # drop the faint background noise
safe = np.maximum(a, 1e-6)[..., None]
fg = np.clip((rgb - (1 - a[..., None]) * D) / safe, 0, 255)           # true colours, background unmixed
wsum = np.maximum(w.sum(-1, keepdims=True), 1e-6)
light = (w[..., :1] * INK + w[..., 1:] * P) / wsum                    # cream -> ink, pink stays

def rgba(col):
  return Image.fromarray(np.dstack([col, a * 255]).round().astype(np.uint8), 'RGBA')

dark_im, light_im = rgba(fg), rgba(light)

# split into the mark (card + plane) and the wordmark by the empty rows between them
rows = (a > 0.5).sum(1)
ys = np.where(rows > 0)[0]
gaps = [y for y in range(ys[0], ys[-1]) if rows[y] == 0]
split = gaps[len(gaps) // 2] if gaps else None
print('content rows', ys[0], ys[-1], 'gap', gaps[:1], gaps[-1:] if gaps else None)

def bbox(y0, y1):
  m = a[y0:y1] > 0.02
  yy, xx = np.where(m)
  return (xx.min(), y0 + yy.min(), xx.max() + 1, y0 + yy.max() + 1)

mark_box = bbox(0, split)
word_box = bbox(split, H)
print('mark', mark_box, 'word', word_box)

def crop(im, b): return im.crop(b)

def resize(im, size):  # premultiplied, so edges don't pick up a dark fringe
  return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')

def horizontal(im, height):
  mk, wd = crop(im, mark_box), crop(im, word_box)
  wh = wd.height
  mh = round(wh * 2.0)                          # mark is twice the wordmark's height
  mw = round(mk.width * mh / mk.height)
  gap = round(wh * 0.42)
  big = Image.new('RGBA', (mw + gap + wd.width, mh), (0, 0, 0, 0))
  big.alpha_composite(resize(mk, (mw, mh)), (0, 0))
  big.alpha_composite(wd, (mw + gap, round((mh - wh) / 2)))
  w_ = round(big.width * height / big.height)
  return resize(big, (w_, height))

def stacked(im, width):
  b = (min(mark_box[0], word_box[0]), mark_box[1], max(mark_box[2], word_box[2]), word_box[3])
  st = crop(im, b)
  return resize(st, (width, round(st.height * width / st.width)))

for name, im in (('logo', dark_im), ('logo-light', light_im)):
  h = horizontal(im, 120)
  h.save(f'{out}/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
  print(name, h.size, os.path.getsize(f'{out}/{name}.webp'))
s = stacked(dark_im, 400)
s.save(f'{out}/logo-stack.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
print('logo-stack', s.size, os.path.getsize(f'{out}/logo-stack.webp'))
# the logo's text alone, for the cards: cream for dark scenes, ink for light ones
for name, im in (('wordmark', dark_im), ('wordmark-ink', light_im)):
  wd = crop(im, word_box)
  wd = resize(wd, (round(wd.width * 128 / wd.height), 128))
  wd.save(f'{out}/{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
  print(name, wd.size, os.path.getsize(f'{out}/{name}.webp'))

# icons: the mark on the logo's own purple, rounded for browser tabs, square for Apple (iOS rounds it itself)
TILE = (41, 9, 52, 255)
def tile(size, rounded, fill=0.8):
  S = 1024
  t = Image.new('RGBA', (S, S), (0, 0, 0, 0))
  if rounded:
    ImageDraw.Draw(t).rounded_rectangle((0, 0, S - 1, S - 1), radius=round(S * 0.22), fill=TILE)
  else:
    t.paste(TILE, (0, 0, S, S))
  mk = crop(dark_im, mark_box)
  mw = round(S * fill); mh = round(mk.height * mw / mk.width)
  t.alpha_composite(resize(mk, (mw, mh)), ((S - mw) // 2, (S - mh) // 2))
  return resize(t, (size, size))

ico = [tile(s_, True, 0.86) for s_ in (16, 32, 48)]
ico[2].save(f'{out}/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
tile(192, True).save(f'{out}/icon-192.png', optimize=True)
tile(180, False, 0.74).convert('RGB').save(f'{out}/apple-touch-icon.png', optimize=True)

# previews to check by eye
def on(bg, im, pad=24):
  c = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), bg)
  c.alpha_composite(im, (pad, pad)); return c
h = horizontal(dark_im, 160); hl = horizontal(light_im, 160)
sheet = Image.new('RGBA', (h.width + 48, (h.height + 48) * 3 + s.height // 2 + 48), (255, 255, 255, 255))
sheet.alpha_composite(on((8, 8, 12, 255), h), (0, 0))
sheet.alpha_composite(on((239, 240, 250, 255), hl), (0, h.height + 48))
sheet.alpha_composite(on((255, 0, 255, 255), h), (0, 2 * (h.height + 48)))
sheet.alpha_composite(on((8, 8, 12, 255), resize(s, (s.width // 2, s.height // 2))), (0, 3 * (h.height + 48)))
sheet.convert('RGB').save(f'{out}/_preview.png')
icons = Image.new('RGBA', (16 + 32 + 48 + 192 + 180 + 120, 200), (240, 240, 240, 255))
x = 10
for im in ico + [tile(192, True), tile(180, False, 0.74)]:
  icons.alpha_composite(im, (x, 4)); x += im.width + 10
icons.convert('RGB').save(f'{out}/_icons.png')

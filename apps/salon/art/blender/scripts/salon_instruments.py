# Classical-era instruments for Birthday web 2 (original models, made in Blender for this project).
# Run: blender -b --factory-startup --python salon_instruments.py -- <out.glb> [preview.png]
#
#   fortepiano      — a Viennese fortepiano (c. 1790): long walnut wing case on five square tapered legs,
#                     gilded bands. The keys are made in three.js on `keys_origin` (left-front of the key bed,
#                     keys run along +X for KEYS_W). `fortepiano_lid` is its own node, origin on the hinge
#                     (the spine, left edge), so it can swing open; `fortepiano_prop` holds it.
#   harp            — a gilded pedal harp; `harp_strings` is its own node (they shimmer when played)
#   violin, cello   — lying flat on their backs (top up, scroll towards +Y), origin at the body centre
#   violin_bow, cello_bow — along +X, origin at the middle
#   music_stand     — turned walnut stand; the sheet (a three.js plane) sits on `sheet_anchor`
import bpy, sys, math, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector

OUT, PREVIEW = args()
start()

KEYS_W = 0.86

# ── fortepiano ───────────────────────────────────────────
def fortepiano():
    W = 0.98
    bent = [(0.49, 0.0), (0.49, 0.38), (0.46, 0.75), (0.37, 1.12), (0.22, 1.5), (0.04, 1.82), (-0.16, 2.03), (-0.3, 2.1)]
    case = [(-0.49, 0.0), (-0.44, 0.0), (-0.44, 0.24), (0.44, 0.24), (0.44, 0.0)] + bent + [(-0.49, 2.1)]
    parts = [slab("fp_case", case, 0.64, 0.9, WALNUT, bev=0.008)]
    # gilded bands: a slim moulding round the bottom and the top edge of the case
    outline = [(-0.49, 0.0)] + bent + [(-0.49, 2.1)]
    grow = lambda pts, d: [(x + (d if x > -0.48 else -d), y + (d if y > 2.05 else (-d if y < 0.01 else 0))) for x, y in pts]
    parts.append(slab("fp_band_lo", grow(outline, 0.008), 0.625, 0.65, GOLD, bev=0.003))
    parts.append(slab("fp_band_hi", grow(outline, 0.006), 0.885, 0.9, GOLD, bev=0.002))
    # key bed, key cheeks and the name board behind the keys
    parts.append(box("fp_keybed", WALNUT, (0.9, 0.3, 0.07), loc=(0, 0.1, 0.675)))
    for sx in (-1, 1):
        parts.append(box(f"fp_cheek{sx}", WALNUT, (0.05, 0.3, 0.12), loc=(sx * 0.465, 0.1, 0.72), bev=0.006))
    parts.append(box("fp_nameboard", MAHOG, (0.88, 0.02, 0.12), loc=(0, 0.245, 0.83), bev=0.002))
    parts.append(box("fp_name_gold", GOLD, (0.22, 0.006, 0.035), loc=(0, 0.233, 0.835), bev=0.001))
    # five square tapered legs with gilded collars (seg=4 lathe → square section)
    legs = [(-0.42, 0.06), (0.42, 0.06), (-0.43, 1.05), (0.33, 1.1), (-0.36, 1.95)]
    for i, (x, y) in enumerate(legs):
        leg = lathe(f"fp_leg{i}", [(0.022, 0), (0.026, 0.03), (0.022, 0.06), (0.03, 0.4), (0.04, 0.6), (0.04, 0.64)], WALNUT, seg=4, angle=30)
        leg.rotation_euler = (0, 0, math.pi / 4); leg.location = (x, y, 0); apply_tf(leg)
        col = lathe(f"fp_collar{i}", [(0.034, 0.52), (0.046, 0.53), (0.046, 0.56), (0.034, 0.57)], GOLD, seg=4, angle=30)
        col.rotation_euler = (0, 0, math.pi / 4); col.location = (x, y, 0); apply_tf(col)
        foot = lathe(f"fp_foot{i}", [(0.02, 0), (0.028, 0.012), (0.028, 0.03), (0.02, 0.04)], GOLD, seg=4, angle=30)
        foot.rotation_euler = (0, 0, math.pi / 4); foot.location = (x, y, 0); apply_tf(foot)
        parts += [leg, col, foot]
    # music desk: a gilded lyre-topped rack leaning back over the front of the case
    desk = box("fp_desk", WALNUT, (0.56, 0.018, 0.3), loc=(0, 0.42, 1.04), bev=0.004)
    desk.rotation_euler = (math.radians(-14), 0, 0); apply_tf(desk)
    ledge = box("fp_desk_ledge", GOLD, (0.58, 0.05, 0.016), loc=(0, 0.38, 0.9), bev=0.003)
    parts += [desk, ledge]
    body = join(parts, "fp_body")
    # the lid: case outline (behind the name board), origin on the hinge along the spine
    lid_outline = [(-0.49, 0.26), (0.49, 0.26)] + bent[1:] + [(-0.49, 2.1)]
    lid = slab("fortepiano_lid", grow(lid_outline, 0.006), 0.9, 0.918, WALNUT, bev=0.004)
    gild = slab("fp_lid_gild", [(x * 0.92, 0.26 + (y - 0.26) * 0.95) for x, y in lid_outline], 0.918, 0.921, GOLD, bev=0)
    lid = join([lid, gild], "fortepiano_lid")
    bpy.context.scene.cursor.location = (-0.495, 0, 0.91)
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    prop = box("fortepiano_prop", WALNUT, (0.018, 0.018, 0.5), loc=(0.36, 1.05, 1.15), bev=0.003)
    bpy.context.scene.cursor.location = (0.36, 1.05, 0.9)
    bpy.ops.object.select_all(action='DESELECT'); prop.select_set(True); bpy.context.view_layer.objects.active = prop
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    lid = pivot(lid); prop = pivot(prop)
    keys = empty("keys_origin", (-KEYS_W / 2, -0.035, 0.742))
    sheet = empty("fp_sheet_anchor", (0, 0.405, 1.05))
    g = group("fortepiano", [body, lid, prop], [keys, sheet])
    g["keys_w"] = KEYS_W
    return g

# ── pedal harp ───────────────────────────────────────────
def harp():
    parts = []
    parts.append(box("hp_base", GOLD, (0.3, 0.46, 0.1), loc=(0, 0.06, 0.07), bev=0.012))
    for x in (-0.12, 0.12):
        for y in (-0.13, 0.25):
            parts.append(prim("uv", "hp_foot", GOLD_DK, loc=(x, y, 0.02), scale=(0.03, 0.03, 0.022), segments=12, ring_count=8))
    # the column with its crown
    parts.append(lathe("hp_column", [(0.04, 0.1), (0.032, 0.18), (0.03, 1.5), (0.036, 1.52)], GOLD, seg=16))
    parts.append(lathe("hp_crown", [(0.036, 1.52), (0.06, 1.56), (0.05, 1.6), (0.075, 1.66), (0.06, 1.72), (0.02, 1.76), (0.0, 1.78)], GOLD, seg=16))
    for o in parts[-2:]: o.location.y = -0.19; apply_tf(o)
    # soundbox: a tapered body slanting from the base to the top of the neck
    sb = [(0.0, -0.04 + 0.47 * t, 0.12 + 1.33 * t) for t in [i / 12 for i in range(13)]]
    parts.append(tube("hp_soundbox", sb, 1.0, WALNUT, seg=12, radii=[0.11 - 0.075 * i / 12 for i in range(13)]))
    board = tube("hp_board", [(0.0, p[1] - 0.06, p[2]) for p in sb], 1.0, GOLD_DK, seg=8, radii=[0.06 - 0.04 * i / 12 for i in range(13)])
    parts.append(board)
    neck = smooth_path([(0, -0.2, 1.6), (0, -0.04, 1.47), (0, 0.16, 1.58), (0, 0.33, 1.55), (0, 0.45, 1.47)], 10)
    parts.append(tube("hp_neck", neck, 0.03, GOLD, seg=10))
    body = join(parts, "hp_body")
    # strings: from the soundboard straight up to the neck (every 7th one red, as on period harps)
    strings = []
    def neck_z(y):
        best = min(neck, key=lambda p: abs(p[1] - y)); return best[2] - 0.03
    n = 22
    for k in range(n):
        t = 0.06 + 0.86 * k / (n - 1)
        y, z0 = -0.04 + 0.47 * t - 0.07, 0.12 + 1.33 * t
        z1 = neck_z(y)
        if z1 - z0 < 0.05: continue
        strings.append(cyl(f"hs{k}", ROSE_DK if k % 7 == 0 else STRING, 0.0022, z1 - z0, loc=(0, y, (z0 + z1) / 2), seg=5))
    s = join(strings, "harp_strings")
    return group("harp", [body, s])

# ── violin family (one outline, scaled) ──────────────────
HW = [(0.0, 0.016), (0.008, 0.05), (0.025, 0.08), (0.055, 0.098), (0.09, 0.102), (0.12, 0.095), (0.148, 0.073),
      (0.163, 0.058), (0.18, 0.054), (0.196, 0.059), (0.212, 0.069), (0.24, 0.079), (0.27, 0.082), (0.3, 0.076),
      (0.325, 0.06), (0.343, 0.038), (0.356, 0.012)]

def outline(scale):
    right = [(w * scale, y * scale) for y, w in HW]
    left = [(-x, y) for x, y in reversed(right)]
    return right + left[1:-1]

def string_instrument(name, k, thick, neck_len):
    L = 0.356 * k
    o = [(x, y - L / 2) for x, y in outline(k)]           # body centred on the origin
    # counter-clockwise: the right side runs bottom→top, so reverse to go round the other way
    o = list(reversed(o))
    parts = [slab(f"{name}_body", o, 0, thick, SPRUCE, bev=thick * 0.32, bev_seg=4)]
    parts.append(slab(f"{name}_purfle", [(x * 0.97, y * 0.97) for x, y in o], thick - 0.001, thick + 0.0008, MAHOG, bev=0))
    # f-holes (two dark slits), bridge, tailpiece, fingerboard, neck, pegbox and scroll
    for sx in (-1, 1):
        f = box(f"{name}_f{sx}", INK, (0.006 * k, 0.07 * k, 0.003), loc=(sx * 0.038 * k, -0.005 * k, thick + 0.001), bev=0)
        f.rotation_euler = (0, 0, sx * 0.12); apply_tf(f); parts.append(f)
    parts.append(box(f"{name}_bridge", IVORY, (0.042 * k, 0.004 * k, 0.03 * k), loc=(0, -0.02 * k, thick + 0.015 * k), bev=0.001))
    parts.append(box(f"{name}_tail", EBONY, (0.04 * k, 0.11 * k, 0.012), loc=(0, -0.11 * k, thick + 0.008), bev=0.004))
    top = L / 2
    parts.append(box(f"{name}_board", EBONY, (0.03 * k, 0.27 * k, 0.012), loc=(0, top - 0.02 * k, thick + 0.018 * k), bev=0.003))
    parts.append(box(f"{name}_neck", SPRUCE, (0.024 * k, neck_len, 0.022 * k), loc=(0, top + neck_len / 2, thick * 0.6 + 0.004), bev=0.004))
    pb = top + neck_len
    parts.append(box(f"{name}_pegbox", SPRUCE, (0.024 * k, 0.07 * k, 0.026 * k), loc=(0, pb + 0.035 * k, thick * 0.6 + 0.01 * k), bev=0.004))
    scroll = prim("torus", f"{name}_scroll", SPRUCE, loc=(0, pb + 0.08 * k, thick * 0.6 + 0.018 * k), rot=(0, math.pi / 2, 0),
                  major_radius=0.014 * k, minor_radius=0.008 * k, major_segments=16, minor_segments=8)
    parts.append(smooth(scroll))
    for i, sx in enumerate((-1, -1, 1, 1)):
        peg = cyl(f"{name}_peg{i}", EBONY, 0.004 * k, 0.05 * k, loc=(sx * 0.02 * k, pb + (0.02 + 0.018 * (i % 2)) * k, thick * 0.6 + 0.012 * k), rot=(0, math.pi / 2, 0), seg=8)
        parts.append(peg)
    for i in range(4):
        x = (i - 1.5) * 0.0065 * k
        parts.append(tube(f"{name}_str{i}", [(x, -0.06 * k, thick + 0.016), (x, -0.02 * k, thick + 0.031 * k), (x, top + neck_len, thick + 0.026 * k)], 0.0007 * k, STRING, seg=4))
    return join(parts, name)

def bow(name, length, k=1.0):
    half = length / 2
    stick = tube(f"{name}_stick", [(-half, 0, 0.012 * k), (0, 0, 0.018 * k), (half, 0, 0.012 * k)], 0.0045 * k, MAHOG, seg=6)
    hair = box(f"{name}_hair", IVORY, (length * 0.94, 0.008 * k, 0.0015), loc=(0.01, 0, -0.004 * k), bev=0)
    frog = box(f"{name}_frog", EBONY, (0.045 * k, 0.012 * k, 0.025 * k), loc=(-half + 0.04 * k, 0, 0.004 * k), bev=0.003)
    frog_g = box(f"{name}_frog_g", SILVER, (0.012 * k, 0.013 * k, 0.026 * k), loc=(-half + 0.015 * k, 0, 0.004 * k), bev=0.002)
    tip = box(f"{name}_tip", IVORY, (0.018 * k, 0.01 * k, 0.026 * k), loc=(half - 0.006, 0, 0.004 * k), bev=0.003)
    return keep(join([stick, hair, frog, frog_g, tip], name))

# ── music stand ──────────────────────────────────────────
def music_stand():
    parts = [lathe("ms_col", [(0.03, 0.12), (0.022, 0.2), (0.016, 0.5), (0.02, 0.55), (0.014, 0.6), (0.014, 1.0), (0.02, 1.02)], WALNUT, seg=14)]
    parts.append(lathe("ms_knob", [(0.035, 0.1), (0.045, 0.13), (0.03, 0.17), (0.0, 0.18)], GOLD, seg=14))
    for i in range(3):
        a = i * 2 * math.pi / 3
        leg = smooth_path([(0, 0, 0.14), (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.08), (math.cos(a) * 0.24, math.sin(a) * 0.24, 0.02)], 8)
        parts.append(tube(f"ms_leg{i}", leg, 0.014, WALNUT, seg=8))
        parts.append(prim("uv", f"ms_toe{i}", GOLD, loc=(math.cos(a) * 0.245, math.sin(a) * 0.245, 0.018), scale=(0.02, 0.02, 0.016), segments=10, ring_count=6))
    # lyre rack, leaning back
    rack = [box("ms_board", WALNUT, (0.5, 0.012, 0.34), loc=(0, 0.0, 1.18), bev=0.004),
            box("ms_ledge", GOLD, (0.52, 0.045, 0.014), loc=(0, -0.025, 1.01), bev=0.003)]
    lyre = smooth_path([(-0.12, 0.008, 1.06), (-0.17, 0.008, 1.2), (-0.1, 0.008, 1.32), (0, 0.008, 1.26), (0.1, 0.008, 1.32), (0.17, 0.008, 1.2), (0.12, 0.008, 1.06)], 8)
    rack.append(tube("ms_lyre", lyre, 0.007, GOLD, seg=6))
    for r in rack:
        r.rotation_euler = (math.radians(-16), 0, 0); r.location.z += 0
        bpy.context.scene.cursor.location = (0, 0, 1.02)
        apply_tf(r)
    body = join(parts + rack, "ms_body")
    sheet = empty("sheet_anchor", (0, -0.02, 1.19))
    sheet.rotation_euler = (math.radians(-16), 0, 0)
    return group("music_stand", [body], [sheet])

fortepiano()
harp()
keep(string_instrument("violin", 1.0, 0.036, 0.13))
keep(string_instrument("cello", 2.1, 0.12, 0.3))
bow("violin_bow", 0.74)
bow("cello_bow", 0.71, 1.3)
music_stand()
finish(OUT, PREVIEW, cols=4, cell=2.4)

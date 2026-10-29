# Furniture and decor of a Classical-era Viennese salon for Birthday web 2 (original models, made in Blender).
# Run: blender -b --factory-startup --python salon_decor.py -- <out.glb> [preview.png]
#
# Floor pieces stand on z = 0 facing -Y. Wall pieces (fireplace, sconce, mirror_frame, curtain, valance) have
# their back on the wall plane y = 0 and come out towards -Y. The chandelier hangs from z = 0 (its hook).
# Empties named flame_* mark candle tips (the app puts flames there); `fire_anchor` the hearth fire.
import bpy, bmesh, sys, math, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector, Matrix

OUT, PREVIEW = args()
start()
LEATHER = mat("M_leather", (0.2, 0.33, 0.24), 0.6)
BOOK_RED = mat("M_book_red", (0.5, 0.12, 0.1), 0.6)
BOOK_BLUE = mat("M_book_blue", (0.16, 0.2, 0.38), 0.6)

def upright(ob, y=0.0, z=0.0):
    """Turn a piece modelled in the XY plane (extruded along +Z) to stand in the XZ plane, facing -Y."""
    ob.rotation_euler = (math.pi / 2, 0, 0); ob.location = (0, y, z); apply_tf(ob)
    return ob

def ellipse(rx, ry, n=48, cy=0.0):
    return [(rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]

def candle(name, loc, h=0.1, r=0.011, flames=None, parent_list=None):
    c = cyl(name, WAX, r, h, loc=(loc[0], loc[1], loc[2] + h / 2), seg=12)
    w = cyl(name + "_wick", WICK, 0.0012, 0.012, loc=(loc[0], loc[1], loc[2] + h + 0.004), seg=4)
    if flames is not None: flames.append((loc[0], loc[1], loc[2] + h + 0.01))
    return [c, w]

def cup_at(name, loc, r=0.03, metal=GOLD):
    return lathe(name, [(0.008, -0.03), (0.012, -0.012), (r, -0.004), (r * 1.05, 0.0), (r * 0.5, 0.006)], metal, seg=16) if False else \
        move(lathe(name, [(0.006, -0.028), (0.011, -0.014), (r, -0.004), (r * 1.04, 0.0), (r * 0.45, 0.004), (0.0, 0.004)], metal, seg=16), loc)

def move(ob, loc):
    ob.location = loc; apply_tf(ob); return ob

def anchors(prefix, pts):
    return [empty(f"{prefix}{i}", p) for i, p in enumerate(pts)]

# ── seating ──────────────────────────────────────────────
def leg(name, x, y, h=0.4, r=0.02):
    return move(lathe(name, [(r * 0.75, 0), (r, 0.02), (r * 0.8, 0.04), (r, h * 0.75), (r * 1.3, h * 0.83), (r * 1.5, h * 0.92), (r * 1.5, h)], GOLD, seg=14), (x, y, 0))

def chair():
    p = [leg(f"ch_leg{i}", x, y) for i, (x, y) in enumerate([(-0.2, -0.19), (0.2, -0.19), (-0.18, 0.18), (0.18, 0.18)])]
    p.append(box("ch_rail", GOLD, (0.46, 0.44, 0.06), loc=(0, 0, 0.41), bev=0.012))
    p.append(box("ch_cushion", VELVET, (0.43, 0.41, 0.07), loc=(0, -0.005, 0.465), bev=0.028))
    for sx in (-1, 1):
        p.append(tube(f"ch_post{sx}", [(sx * 0.17, 0.2, 0.43), (sx * 0.165, 0.215, 0.56), (sx * 0.15, 0.225, 0.66)], 0.016, GOLD, seg=8))
    p.append(upright(ring_slab("ch_medal", ellipse(0.19, 0.25), ellipse(0.155, 0.215), -0.016, 0.016, GOLD, bev=0.006), y=0.225, z=0.88))
    p.append(upright(slab("ch_pad", ellipse(0.158, 0.218), -0.018, 0.018, VELVET, bev=0.014, bev_seg=4), y=0.225, z=0.88))
    p.append(prim("uv", "ch_knot", GOLD, loc=(0, 0.225, 1.14), scale=(0.035, 0.022, 0.03), segments=12, ring_count=8))
    for sx in (-1, 1):
        p.append(prim("uv", f"ch_bow{sx}", GOLD, loc=(sx * 0.05, 0.225, 1.14), scale=(0.04, 0.012, 0.022), segments=10, ring_count=6))
    return keep(join(p, "chair"))

def settee():
    W = 1.5
    p = [leg(f"st_leg{i}", x, y) for i, (x, y) in enumerate([(-0.7, -0.26), (0.7, -0.26), (-0.68, 0.24), (0.68, 0.24), (0, -0.26), (0, 0.24)])]
    p.append(box("st_rail", GOLD, (W, 0.6, 0.07), loc=(0, 0, 0.41), bev=0.014))
    p.append(box("st_cushion", VELVET, (W - 0.06, 0.56, 0.09), loc=(0, -0.01, 0.48), bev=0.035))
    top = lambda x: 0.48 + 0.1 * math.cos(math.pi * x / W) ** 2
    n = 24
    outer = [(-W / 2 + W * i / n, 0.0) for i in range(n + 1)] + [(W / 2 - W * i / n, top(W / 2 - W * i / n)) for i in range(n + 1)]
    inner = [(x * 0.94, 0.05 if y == 0.0 else y - 0.05) for x, y in outer]
    frame = upright(ring_slab("st_back", outer, inner, -0.018, 0.018, GOLD, bev=0.006), y=0.28, z=0.45)
    pad = upright(slab("st_pad", inner, -0.02, 0.02, VELVET, bev=0.016, bev_seg=4), y=0.28, z=0.45)
    p += [frame, pad]
    for sx in (-1, 1):
        arm = smooth_path([(sx * 0.72, 0.24, 0.45), (sx * 0.74, 0.1, 0.66), (sx * 0.75, -0.12, 0.68), (sx * 0.74, -0.26, 0.6), (sx * 0.72, -0.26, 0.45)], 8)
        p.append(tube(f"st_arm{sx}", arm, 0.024, GOLD, seg=8))
        p.append(box(f"st_armpad{sx}", VELVET, (0.07, 0.36, 0.05), loc=(sx * 0.745, -0.02, 0.69), bev=0.02))
    return keep(join(p, "settee"))

# ── tables ───────────────────────────────────────────────
def round_table():
    top = cyl("rt_top", MAHOG, 0.62, 0.035, loc=(0, 0, 0.74), seg=48, bev=0.006)
    ped = lathe("rt_ped", [(0.1, 0.1), (0.07, 0.16), (0.05, 0.3), (0.065, 0.36), (0.045, 0.45), (0.05, 0.62), (0.09, 0.7), (0.12, 0.72)], MAHOG, seg=20)
    feet = []
    for i in range(3):
        a = i * 2 * math.pi / 3 + math.pi / 2
        c, s = math.cos(a), math.sin(a)
        feet.append(tube(f"rt_foot{i}", smooth_path([(c * 0.05, s * 0.05, 0.14), (c * 0.2, s * 0.2, 0.12), (c * 0.33, s * 0.33, 0.04), (c * 0.36, s * 0.36, 0.0)], 8), 0.026, GOLD_DK, seg=8,
                         radii=None))
    table = join([top, ped] + feet, "round_table")
    # the linen cloth: a skirt with soft folds and a scalloped hem
    bm = bmesh.new(); N, M = 96, 14
    zt = 0.762
    centre = bm.verts.new((0, 0, zt + 0.004))
    rows = []
    for j in range(M + 1):
        v = j / M; row = []
        for i in range(N):
            th = 2 * math.pi * i / N
            L = 0.44 + 0.06 * math.sin(5 * th) ** 2
            if j == 0: r, z = 0.64, zt + 0.004
            else:
                r = 0.665 + 0.06 * v ** 1.6 + 0.028 * v * math.sin(10 * th)
                z = zt - L * v + (0.012 * (1 - v) ** 8)
            row.append(bm.verts.new((r * math.cos(th), r * math.sin(th), z)))
        rows.append(row)
    for i in range(N): bm.faces.new((centre, rows[0][i], rows[0][(i + 1) % N]))
    for a, b in zip(rows[:-1], rows[1:]):
        for i in range(N): bm.faces.new((a[i], a[(i + 1) % N], b[(i + 1) % N], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    hem = [tuple(rows[-1][i % N].co) for i in range(N + 1)]
    cloth = new_obj("tablecloth", bm, LINEN)
    sol = cloth.modifiers.new("sol", 'SOLIDIFY'); sol.thickness = 0.006
    smooth(cloth, 80)
    lace = tube("tc_lace", [(x * 1.004, y * 1.004, z - 0.006) for x, y, z in hem], 0.01, PORCELAIN, seg=6)
    cloth = join([cloth, lace], "tablecloth")
    # a rose satin runner across the cloth, hanging down both sides
    bm = bmesh.new(); path = []
    for k in range(41):
        x = -0.86 + 1.72 * k / 40
        ax = abs(x)
        z = zt + 0.012 if ax < 0.64 else zt + 0.012 - (ax - 0.64) * 0.5 - max(0, ax - 0.7) * 2.6
        rr = min(ax, 0.705)
        path.append((math.copysign(rr + max(0, ax - 0.705) * 0.15, x), z))
    vs = [(bm.verts.new((x, -0.17, z)), bm.verts.new((x, 0.17, z))) for x, z in path]
    for (a0, a1), (b0, b1) in zip(vs[:-1], vs[1:]): bm.faces.new((a0, b0, b1, a1))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    run = new_obj("runner", bm, ROSE)
    s2 = run.modifiers.new("sol", 'SOLIDIFY'); s2.thickness = 0.005
    smooth(run, 80)
    keep(run)
    keep(cloth)
    return keep(table)

def writing_desk():
    p = [box("wd_top", WALNUT, (1.0, 0.55, 0.035), loc=(0, 0, 0.745), bev=0.008),
         box("wd_leather", LEATHER, (0.86, 0.42, 0.004), loc=(0, 0, 0.764), bev=0),
         box("wd_apron", WALNUT, (0.92, 0.48, 0.1), loc=(0, 0, 0.67), bev=0.006),
         box("wd_drawer", GOLD, (0.08, 0.01, 0.025), loc=(0, -0.245, 0.67), bev=0.003)]
    for i, (x, y) in enumerate([(-0.43, -0.2), (0.43, -0.2), (-0.43, 0.2), (0.43, 0.2)]):
        sx, sy = math.copysign(1, x), math.copysign(1, y)
        path = smooth_path([(x, y, 0.62), (x + sx * 0.035, y + sy * 0.035, 0.46), (x - sx * 0.005, y - sy * 0.005, 0.2), (x + sx * 0.03, y + sy * 0.03, 0.035)], 8)
        p.append(tube(f"wd_leg{i}", path, 1.0, WALNUT, seg=8, radii=[0.032 - 0.015 * k / (len(path) - 1) for k in range(len(path))]))
        p.append(prim("uv", f"wd_toe{i}", GOLD, loc=(x + sx * 0.03, y + sy * 0.03, 0.02), scale=(0.025, 0.025, 0.02), segments=10, ring_count=6))
        p.append(prim("uv", f"wd_mount{i}", GOLD, loc=(x, y, 0.62), scale=(0.03, 0.03, 0.035), segments=10, ring_count=6))
    desk = join(p, "writing_desk")
    # inkwell set on a silver tray
    ink = [lathe("ink_tray", [(0.0, 0.0), (0.11, 0.0), (0.12, 0.012), (0.105, 0.014), (0.0, 0.012)], SILVER, seg=24),
           move(lathe("ink_pot", [(0.0, 0.0), (0.032, 0.0), (0.036, 0.03), (0.026, 0.05), (0.014, 0.056), (0.0, 0.054)], CRYSTAL, seg=20), (-0.04, 0, 0.012)),
           move(cyl("ink_ink", INK, 0.026, 0.004, seg=16), (-0.04, 0, 0.052)),
           move(lathe("sand_pot", [(0.0, 0.0), (0.028, 0.0), (0.03, 0.045), (0.02, 0.05), (0.0, 0.05)], SILVER, seg=16), (0.055, 0, 0.012))]
    keep(join(ink, "inkwell"))
    # the quill: a long white feather, origin at the nib, lying along +Y
    q = []
    vane = []
    for k in range(25):
        t = k / 24
        w = 0.0 if t < 0.18 else 0.024 * math.sin(math.pi * min(1, (t - 0.18) / 0.82)) ** 0.7
        vane.append((t * 0.3, w))
    outline = [(x * 0.0 + w * 1.0 if False else w, y) for y, w in vane] + [(-w * 0.6, y) for y, w in reversed(vane)]
    q.append(slab("quill_vane", outline, -0.0015, 0.0015, FEATHER, bev=0.001, bev_seg=1))
    q.append(tube("quill_shaft", [(0, -0.01, 0), (0, 0.1, 0.002), (0, 0.3, 0.004)], 0.0022, IVORY, seg=6))
    q.append(prim("cone", "quill_nib", INK, loc=(0, -0.016, 0), rot=(math.pi / 2, 0, 0), radius1=0.0028, radius2=0.0004, depth=0.014, vertices=8))
    keep(join(q, "quill"))
    return keep(desk)

def easel():
    lean = -0.18
    front = []
    for sx in (-1, 1):
        front.append(tube(f"es_leg{sx}", [(sx * 0.34, 0, 0), (sx * 0.08, 0, 1.78)], 0.02, WALNUT, seg=6))
    front += [box("es_ledge", WALNUT, (0.78, 0.07, 0.03), loc=(0, -0.03, 0.74), bev=0.005),
              box("es_lip", WALNUT, (0.78, 0.012, 0.03), loc=(0, -0.065, 0.765), bev=0.003),
              box("es_mast", WALNUT, (0.04, 0.03, 1.72), loc=(0, 0.01, 0.92), bev=0.004),
              box("es_clamp", WALNUT, (0.3, 0.05, 0.035), loc=(0, -0.02, 1.43), bev=0.005),
              box("es_canvas", CANVAS, (0.66, 0.028, 0.66), loc=(0, -0.05, 1.1), bev=0.004)]
    tilt = Matrix.Rotation(lean, 4, 'X')   # every part leans together about the feet (the floor pivot)
    for o in front:
        o.matrix_world = tilt @ o.matrix_world; apply_tf(o)
    back = tube("es_back", [(0, 0.36, 1.6), (0, 0.88, 0)], 0.018, WALNUT, seg=6)   # behind the leaning mast
    body = join(front + [back], "es_body")
    c = Vector((0, -0.065, 1.1)); c.rotate(__import__("mathutils").Euler((lean, 0, 0)))
    anchor = empty("canvas_anchor", tuple(c)); anchor.rotation_euler = (lean, 0, 0)
    # palette with dabs of paint, hanging on the ledge corner
    pal = slab("es_palette", ellipse(0.13, 0.09, 32), -0.004, 0.004, WALNUT, bev=0.002)
    dabs = [prim("uv", f"dab{i}", m, loc=(0.08 * math.cos(1.0 + i * 0.7), 0.055 * math.sin(1.0 + i * 0.7), 0.006), scale=(0.014, 0.014, 0.006), segments=8, ring_count=5)
            for i, m in enumerate([ROSE_DK, COBALT, GOLD, LEAF, PORCELAIN, BERRY])]
    palette = join([pal] + dabs, "palette")
    palette.rotation_euler = (math.radians(70), 0, math.radians(-20)); palette.location = (0.45, -0.18, 0.62); apply_tf(palette)
    return group("easel", [body, palette], [anchor])

# ── lights: chandelier, candelabra, sconce ──────────────
def chandelier():
    p = []; fl = []
    p.append(lathe("cd_col", [(0.0, -1.22), (0.03, -1.2), (0.05, -1.12), (0.03, -1.05), (0.07, -0.98), (0.11, -0.9), (0.07, -0.82),
                              (0.04, -0.7), (0.06, -0.6), (0.035, -0.5), (0.05, -0.42), (0.03, -0.3), (0.02, -0.1), (0.03, 0.0)], GOLD, seg=20))
    p.append(prim("ico", "cd_ball", CRYSTAL, loc=(0, 0, -1.28), subdivisions=2, radius=0.06))
    p.append(smooth(prim("torus", "cd_ring", GOLD, loc=(0, 0, -0.9), major_radius=0.44, minor_radius=0.014, major_segments=48, minor_segments=8)))
    tiers = [(8, 0.5, -0.9, -0.74), (6, 0.3, -0.5, -0.38)]
    tips = []
    for n, R, z0, zc in tiers:
        for i in range(n):
            a = 2 * math.pi * i / n + (0.3 if n == 6 else 0)
            c, s = math.cos(a), math.sin(a)
            arm = smooth_path([(c * 0.05, s * 0.05, z0 + 0.05), (c * R * 0.45, s * R * 0.45, z0 - 0.06), (c * R * 0.85, s * R * 0.85, z0 - 0.02), (c * R, s * R, zc - 0.03)], 8)
            p.append(tube(f"cd_arm{n}_{i}", arm, 0.011, GOLD, seg=6))
            p.append(cup_at(f"cd_cup{n}_{i}", (c * R, s * R, zc), 0.032))
            p += candle(f"cd_candle{n}_{i}", (c * R, s * R, zc + 0.004), h=0.1, r=0.011, flames=fl)
            p.append(prim("ico", f"cd_drop{n}_{i}", CRYSTAL, loc=(c * R, s * R, zc - 0.06), subdivisions=1, radius=0.018))
            tips.append((c * R, s * R, zc - 0.03))
    # crystal garlands between the lower arms and from the column
    for i in range(8):
        a0, a1 = 2 * math.pi * i / 8, 2 * math.pi * (i + 1) / 8
        A = Vector((math.cos(a0) * 0.5, math.sin(a0) * 0.5, -0.78)); B = Vector((math.cos(a1) * 0.5, math.sin(a1) * 0.5, -0.78))
        for k in range(1, 10):
            t = k / 10; q = A.lerp(B, t); q.z -= 0.09 * math.sin(math.pi * t)
            p.append(prim("ico", f"cd_bead{i}_{k}", CRYSTAL, loc=tuple(q), subdivisions=1, radius=0.009))
        T = Vector((0, 0, -0.42)); P = Vector((math.cos(a0) * 0.42, math.sin(a0) * 0.42, -0.86))
        for k in range(1, 9):
            t = k / 9; q = T.lerp(P, t); q.z -= 0.07 * math.sin(math.pi * t)
            p.append(prim("ico", f"cd_str{i}_{k}", CRYSTAL, loc=tuple(q), subdivisions=1, radius=0.008))
    p.append(tube("cd_chain", [(0, 0, 0.0), (0, 0, 0.6)], 0.012, GOLD_DK, seg=6))
    p.append(lathe("cd_canopy", [(0.0, 0.56), (0.12, 0.58), (0.14, 0.6), (0.0, 0.62)], GOLD, seg=20))
    body = join(p, "cd_body")
    return group("chandelier", [body], anchors("flame_", fl))

def candelabra():
    p = [lathe("cb_base", [(0.0, 0.0), (0.09, 0.0), (0.095, 0.015), (0.06, 0.03), (0.07, 0.05), (0.03, 0.08), (0.022, 0.2), (0.035, 0.24),
                           (0.018, 0.3), (0.016, 0.36), (0.03, 0.38)], GOLD, seg=20)]
    fl = []
    p.append(cup_at("cb_cupc", (0, 0, 0.42), 0.03)); p += candle("cb_cc", (0, 0, 0.424), h=0.12, flames=fl)
    p.append(cyl("cb_stem", GOLD, 0.012, 0.05, loc=(0, 0, 0.4), seg=10))
    for i in range(4):
        a = 2 * math.pi * i / 4 + math.pi / 4; c, s = math.cos(a), math.sin(a)
        arm = smooth_path([(c * 0.02, s * 0.02, 0.36), (c * 0.1, s * 0.1, 0.33), (c * 0.16, s * 0.16, 0.36), (c * 0.17, s * 0.17, 0.38)], 8)
        p.append(tube(f"cb_arm{i}", arm, 0.008, GOLD, seg=6))
        p.append(cup_at(f"cb_cup{i}", (c * 0.17, s * 0.17, 0.385), 0.026))
        p += candle(f"cb_c{i}", (c * 0.17, s * 0.17, 0.388), h=0.11, flames=fl)
    body = join(p, "cb_body")
    return group("candelabra", [body], anchors("flame_", fl))

def sconce():
    fl = []
    p = [upright(ring_slab("sc_plate", ellipse(0.07, 0.13), ellipse(0.04, 0.1), 0, 0.02, GOLD, bev=0.004), y=0.0, z=0.0)]
    p.append(upright(slab("sc_mirror", ellipse(0.042, 0.102), 0.0, 0.012, CRYSTAL, bev=0.002), y=0.0, z=0.0))
    for sx in (-1, 1):
        arm = smooth_path([(0, -0.02, -0.06), (sx * 0.08, -0.12, -0.1), (sx * 0.15, -0.16, -0.03), (sx * 0.16, -0.16, 0.0)], 8)
        p.append(tube(f"sc_arm{sx}", arm, 0.009, GOLD, seg=6))
        p.append(cup_at(f"sc_cup{sx}", (sx * 0.16, -0.16, 0.005), 0.026))
        p += candle(f"sc_c{sx}", (sx * 0.16, -0.16, 0.008), h=0.1, flames=fl)
    body = join(p, "sc_body")
    return group("sconce", [body], anchors("flame_", fl))

# ── fireplace, clock, mirror ─────────────────────────────
def fireplace():
    p = []
    for sx in (-1, 1):
        p.append(box(f"fp_pil{sx}", MARBLE, (0.22, 0.38, 1.04), loc=(sx * 0.74, -0.19, 0.52), bev=0.01))
        p.append(box(f"fp_pilpanel{sx}", MARBLE_PK, (0.12, 0.01, 0.78), loc=(sx * 0.74, -0.385, 0.55), bev=0.004))
        p.append(box(f"fp_base{sx}", MARBLE, (0.26, 0.42, 0.08), loc=(sx * 0.74, -0.2, 0.04), bev=0.008))
        p.append(prim("uv", f"fp_rosette{sx}", GOLD, loc=(sx * 0.74, -0.39, 1.12), scale=(0.05, 0.02, 0.05), segments=14, ring_count=8))
    p.append(box("fp_frieze", MARBLE, (1.7, 0.36, 0.18), loc=(0, -0.18, 1.13), bev=0.01))
    p.append(box("fp_frieze_panel", MARBLE_PK, (1.1, 0.01, 0.1), loc=(0, -0.365, 1.13), bev=0.003))
    p.append(tube("fp_garland", smooth_path([(-0.5, -0.375, 1.16), (-0.25, -0.38, 1.09), (0, -0.375, 1.15), (0.25, -0.38, 1.09), (0.5, -0.375, 1.16)], 8), 0.012, GOLD, seg=6))
    p.append(box("fp_shelf_mould", MARBLE, (1.82, 0.42, 0.04), loc=(0, -0.2, 1.24), bev=0.012))
    p.append(box("fp_shelf", MARBLE, (1.94, 0.47, 0.05), loc=(0, -0.22, 1.285), bev=0.014))
    p.append(box("fp_inner", SOOT, (1.28, 0.3, 1.04), loc=(0, -0.12, 0.52), bev=0))
    p.append(box("fp_hearth", MARBLE_PK, (2.0, 0.66, 0.03), loc=(0, -0.42, 0.015), bev=0.006))
    for i, (x, rz) in enumerate([(-0.12, 0.25), (0.12, -0.25), (0.0, 1.5)]):
        lg = cyl(f"fp_log{i}", LOG, 0.05, 0.5, loc=(x, -0.18, 0.09 + (0.06 if i == 2 else 0)), rot=(0, math.pi / 2, rz), seg=10)
        p.append(lg)
    for i in range(5):
        p.append(prim("cone", f"fp_ember{i}", FIRE, loc=(-0.16 + 0.08 * i, -0.18, 0.2), radius1=0.045, radius2=0.0, depth=0.16 + 0.05 * (i % 2), vertices=8))
    p.append(tube("fp_fender", [(-0.62, -0.62, 0.06), (-0.6, -0.68, 0.06), (0.6, -0.68, 0.06), (0.62, -0.62, 0.06)], 0.014, GOLD, seg=6))
    body = join(p, "fp_body")
    return group("fireplace", [body], [empty("fire_anchor", (0, -0.2, 0.14))])

def mantel_clock():
    p = [box("mc_base", GOLD, (0.42, 0.17, 0.05), loc=(0, 0, 0.025), bev=0.01),
         box("mc_case", GOLD_DK, (0.28, 0.13, 0.3), loc=(0, 0, 0.2), bev=0.014),
         move(lathe("mc_dome", [(0.0, 0.0), (0.12, 0.0), (0.13, 0.02), (0.1, 0.06), (0.05, 0.1), (0.04, 0.13), (0.06, 0.15), (0.03, 0.19), (0.0, 0.2)], GOLD, seg=24), (0, 0, 0.35))]
    for sx in (-1, 1):
        p.append(move(lathe(f"mc_col{sx}", [(0.022, 0), (0.016, 0.02), (0.014, 0.26), (0.022, 0.29), (0.022, 0.3)], GOLD, seg=12), (sx * 0.17, -0.02, 0.05)))
        p.append(prim("uv", f"mc_urn{sx}", GOLD, loc=(sx * 0.17, -0.02, 0.37), scale=(0.028, 0.028, 0.035), segments=12, ring_count=8))
    p.append(cyl("mc_bezel", GOLD, 0.1, 0.02, loc=(0, -0.07, 0.24), rot=(math.pi / 2, 0, 0), seg=32, bev=0.004))
    p.append(cyl("mc_dial", DIAL, 0.085, 0.02, loc=(0, -0.073, 0.24), rot=(math.pi / 2, 0, 0), seg=32))
    for k in range(12):
        a = 2 * math.pi * k / 12
        p.append(box(f"mc_tick{k}", INK, (0.004, 0.003, 0.014 if k % 3 else 0.022), loc=(math.sin(a) * 0.07, -0.0835, 0.24 + math.cos(a) * 0.07), rot=(0, -a, 0), bev=0))
    body = join(p, "mc_body")
    hands = []
    for name, L, w in (("clock_hour", 0.045, 0.007), ("clock_minute", 0.068, 0.005)):
        h = box(name, INK, (w, 0.003, L), loc=(0, -0.087 if name == "clock_hour" else -0.09, 0.24 + L / 2 - 0.008), bev=0)
        bpy.context.scene.cursor.location = (0, -0.088, 0.24)
        bpy.ops.object.select_all(action='DESELECT'); h.select_set(True); bpy.context.view_layer.objects.active = h
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        hands.append(pivot(h))
    hands.append(cyl("mc_pin", GOLD, 0.008, 0.012, loc=(0, -0.092, 0.24), rot=(math.pi / 2, 0, 0), seg=10))
    return group("mantel_clock", [body] + hands)

def mirror_frame():
    W, H = 1.1, 1.6
    n = 20
    def outline(w, h, arch):
        pts = [(-w / 2, 0.0), (w / 2, 0.0)]
        pts += [(w / 2, h - arch)]
        pts += [(w / 2 * math.cos(math.pi * k / n), h - arch + arch * math.sin(math.pi * k / n)) for k in range(1, n)]
        pts += [(-w / 2, h - arch)]
        return pts
    o = outline(W, H, 0.3); i = outline(W - 0.16, H - 0.16, 0.24)
    i = [(x, y + 0.08) for x, y in i]
    o = o[:2] + o[2:]; i = i[:2] + i[2:]
    frame = upright(ring_slab("mf_frame", o, i, 0.0, 0.05, GOLD, bev=0.012), y=0.0, z=0.0)
    inner = upright(ring_slab("mf_inner", [(x * 0.985, (y - 0.08) * 0.985 + 0.08) for x, y in i], [(x * 0.95, (y - 0.08) * 0.97 + 0.085) for x, y in i], 0.0, 0.06, GOLD_DK, bev=0.004), y=0.0, z=0.0)
    crest = [prim("uv", "mf_crest", GOLD, loc=(0, -0.04, H + 0.05), scale=(0.12, 0.04, 0.09), segments=16, ring_count=10)]
    for sx in (-1, 1):
        crest.append(tube(f"mf_scroll{sx}", smooth_path([(0, -0.04, H + 0.02), (sx * 0.16, -0.04, H + 0.1), (sx * 0.26, -0.04, H + 0.02), (sx * 0.22, -0.04, H - 0.05)], 8), 0.016, GOLD, seg=6))
    body = join([frame, inner] + crest, "mirror_frame")
    body["glass_w"] = W - 0.16; body["glass_h"] = H - 0.16
    return keep(body)

# ── bust, roses, curtains, books ────────────────────────
def bust():
    p = [lathe("bu_ped", [(0.0, 0.0), (0.2, 0.0), (0.2, 0.06), (0.16, 0.09), (0.14, 0.12), (0.12, 0.2), (0.11, 0.9), (0.14, 0.95), (0.17, 0.98), (0.17, 1.02), (0.0, 1.02)], MARBLE, seg=24)]
    p.append(lathe("bu_socle", [(0.0, 1.02), (0.08, 1.02), (0.06, 1.06), (0.05, 1.1), (0.0, 1.1)], MARBLE, seg=20))
    p.append(prim("uv", "bu_chest", MARBLE, loc=(0, 0, 1.2), scale=(0.2, 0.12, 0.13), segments=24, ring_count=12))
    p.append(cyl("bu_neck", MARBLE, 0.05, 0.1, loc=(0, 0.0, 1.32), seg=14))
    p.append(prim("uv", "bu_head", MARBLE, loc=(0, -0.01, 1.45), scale=(0.085, 0.095, 0.105), segments=20, ring_count=12))
    p.append(prim("cone", "bu_nose", MARBLE, loc=(0, -0.1, 1.45), rot=(math.radians(-80), 0, 0), radius1=0.018, radius2=0.004, depth=0.035, vertices=8))
    import random; random.seed(3)
    for k in range(16):   # wild, swept-back hair
        a = random.uniform(0, 2 * math.pi); e = random.uniform(0.1, 1.2)
        loc = (math.cos(a) * 0.075 * math.cos(e), 0.02 + math.sin(a) * 0.06 * math.cos(e) + 0.02, 1.47 + 0.07 * math.sin(e))
        p.append(prim("uv", f"bu_hair{k}", MARBLE, loc=loc, scale=(0.045, 0.045, 0.035), segments=10, ring_count=6))
    p.append(tube("bu_scarf", smooth_path([(-0.06, -0.08, 1.3), (0, -0.11, 1.27), (0.06, -0.08, 1.3)], 6), 0.018, MARBLE, seg=6))
    return keep(join(p, "bust"))

def rose(name, loc, r, material, tilt=(0, 0)):
    parts = [prim("uv", name + "_c", material, loc=(0, 0, r * 0.3), scale=(r * 0.5, r * 0.5, r * 0.55), segments=12, ring_count=8)]
    for k in range(6):
        a = 2 * math.pi * k / 6 + (0.4 if k % 2 else 0)
        pet = prim("uv", f"{name}_p{k}", material, loc=(math.cos(a) * r * 0.42, math.sin(a) * r * 0.42, r * 0.15), scale=(r * 0.5, r * 0.18, r * 0.55), segments=10, ring_count=6,
                   rot=(math.radians(-25), 0, a + math.pi / 2))
        parts.append(pet)
    ro = join(parts, name)
    ro.rotation_euler = (tilt[0], tilt[1], 0); ro.location = loc; apply_tf(ro)
    return ro

def leafy(name, loc, rot, s=0.05):
    lf = prim("uv", name, LEAF, loc=loc, rot=rot, scale=(s * 0.45, s, s * 0.08), segments=10, ring_count=6)
    return lf

def vase_roses():
    p = [lathe("va_body", [(0.0, 0.0), (0.06, 0.0), (0.065, 0.02), (0.045, 0.05), (0.04, 0.08), (0.08, 0.16), (0.09, 0.22), (0.075, 0.28), (0.06, 0.3), (0.08, 0.33), (0.075, 0.34)], PORCELAIN, seg=24)]
    p.append(lathe("va_band", [(0.088, 0.19), (0.092, 0.2), (0.092, 0.235), (0.088, 0.245)], COBALT, seg=24, cap_top=False, cap_bottom=False))
    p.append(lathe("va_rim", [(0.079, 0.33), (0.083, 0.335), (0.083, 0.345), (0.079, 0.35)], GOLD, seg=24, cap_top=False, cap_bottom=False))
    mats = [ROSE, CREAM_ROSE, ROSE_DK, ROSE, CREAM_ROSE, ROSE, ROSE_DK, CREAM_ROSE, ROSE, ROSE, CREAM_ROSE, ROSE_DK, ROSE]
    k = 0
    for ring, (n, R, z, tilt) in enumerate([(1, 0.0, 0.5, 0.0), (5, 0.08, 0.47, 0.45), (7, 0.15, 0.41, 0.85)]):
        for i in range(n):
            a = 2 * math.pi * i / max(n, 1) + ring * 0.3
            loc = (math.cos(a) * R, math.sin(a) * R, z)
            ro = rose(f"va_rose{k}", (0, 0, 0), 0.045, mats[k % len(mats)])
            ro.rotation_euler = (tilt * math.sin(a) * -1, tilt * math.cos(a), 0); ro.location = loc; apply_tf(ro)
            p.append(ro); k += 1
    for i in range(9):
        a = 2 * math.pi * i / 9 + 0.2
        p.append(leafy(f"va_leaf{i}", (math.cos(a) * 0.17, math.sin(a) * 0.17, 0.36), (math.radians(60) * math.sin(a), math.radians(-60) * math.cos(a), a)))
    return keep(join(p, "vase_roses"))

def single_rose():
    r = rose("rose", (0, 0, 0), 0.04, ROSE)
    l1 = leafy("rose_l1", (0.045, 0.0, 0.0), (0, 0.3, 0.2), 0.045)
    l2 = leafy("rose_l2", (-0.04, 0.02, 0.0), (0, -0.3, 2.6), 0.04)
    return keep(join([r, l1, l2], "rose"))

def curtain():
    W, H, nx, nz = 1.0, 3.7, 44, 48
    tie = 0.6   # tie-back height (fraction from the bottom)
    bm = bmesh.new(); grid = []
    for j in range(nz + 1):
        v = j / nz                      # 0 = bottom, 1 = top
        z = H * v
        row = []
        pinch = math.exp(-((v - tie) / 0.18) ** 2)
        for i in range(nx + 1):
            u = i / nx
            x = u * W
            gather = 1 - 0.68 * pinch if v < tie else 1 - 0.68 * pinch * (1 - (v - tie) / (1 - tie)) ** 0.6
            x = x * gather
            amp = 0.035 + 0.03 * (1 - v)
            y = -amp * math.sin(u * 2 * math.pi * 6.5) - 0.06 * pinch * u
            if v < tie: x += (1 - v / tie) ** 2 * u * 0.12      # flares again below the tie-back
            row.append(bm.verts.new((x, y - 0.08, z)))
        grid.append(row)
    for a, b in zip(grid[:-1], grid[1:]):
        for i in range(nx): bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cu = new_obj("cu_cloth", bm, VELVET)
    s = cu.modifiers.new("sol", 'SOLIDIFY'); s.thickness = 0.012
    smooth(cu, 80)
    tieb = prim("torus", "cu_tie", GOLD, loc=(0.12, -0.13, H * tie), rot=(0, math.pi / 2, 0), major_radius=0.12, minor_radius=0.018, major_segments=24, minor_segments=8)
    tassel = prim("cone", "cu_tassel", GOLD, loc=(0.22, -0.16, H * tie - 0.14), radius1=0.04, radius2=0.012, depth=0.16, vertices=12)
    knob = prim("uv", "cu_tknob", GOLD, loc=(0.22, -0.16, H * tie - 0.04), scale=(0.025, 0.025, 0.025), segments=10, ring_count=6)
    return keep(join([cu, smooth(tieb), tassel, knob], "curtain"))

def valance():
    W, n = 2.6, 60
    bm = bmesh.new(); rows = []
    for j in range(9):
        v = j / 8
        row = []
        for i in range(n + 1):
            u = i / n; x = -W / 2 + W * u
            sag = 0.38 * abs(math.sin(3 * math.pi * u)) ** 0.8
            z = -v * (0.08 + sag)
            y = -0.06 - 0.06 * math.sin(math.pi * v) * (0.4 + abs(math.sin(3 * math.pi * u)))
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for a, b in zip(rows[:-1], rows[1:]):
        for i in range(n): bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    hem = [tuple(v.co) for v in rows[-1]]
    va = new_obj("va_cloth", bm, VELVET)
    s = va.modifiers.new("sol", 'SOLIDIFY'); s.thickness = 0.012
    smooth(va, 80)
    fringe = tube("va_fringe", [(x, y - 0.01, z - 0.012) for x, y, z in hem], 0.014, GOLD, seg=6)
    parts = [va, fringe, box("va_board", GOLD, (W + 0.1, 0.12, 0.08), loc=(0, -0.06, 0.03), bev=0.012)]
    for k in range(4):
        x = -W / 2 + W * k / 3
        parts.append(prim("cone", f"va_tassel{k}", GOLD, loc=(x, -0.13, -0.18), radius1=0.035, radius2=0.01, depth=0.15, vertices=10))
    return keep(join(parts, "valance"))

def books():
    p = []
    for k, (w, h, m, rz) in enumerate([(0.24, 0.05, BOOK_RED, 0.05), (0.22, 0.045, BOOK_BLUE, -0.08), (0.2, 0.04, LEATHER, 0.12), (0.18, 0.035, BOOK_RED, -0.02)]):
        z = sum(x[1] for x in [(0.24, 0.05), (0.22, 0.045), (0.2, 0.04), (0.18, 0.035)][:k])
        b = box(f"bk{k}", m, (w, w * 0.72, h), loc=(0, 0, z + h / 2), bev=0.004)
        pg = box(f"bkp{k}", PAPER, (w * 0.96, w * 0.68, h * 0.8), loc=(0.004, 0, z + h / 2), bev=0)
        g = box(f"bkg{k}", GOLD, (0.004, w * 0.73, h * 0.2), loc=(-w / 2 + 0.03, 0, z + h / 2), bev=0)
        for o in (b, pg, g):
            o.rotation_euler = (0, 0, rz); apply_tf(o)
        p += [b, pg, g]
    return keep(join(p, "books"))

chair(); settee(); round_table(); writing_desk(); easel()
chandelier(); candelabra(); sconce()
fireplace(); mantel_clock(); mirror_frame()
bust(); vase_roses(); single_rose(); curtain(); valance(); books()
finish(OUT, PREVIEW, cols=6, cell=2.4)

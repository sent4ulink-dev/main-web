# Courtyard props for Birthday web 3 — ORIGINAL designs made in Blender for this project.
# Run: blender -b --factory-startup --python courtyard_props.py -- <out.glb> [preview.png]
#   cake          — two tiers (olive fondant + cream) with drips, on a wooden board; custom prop `top`
#   lantern_wall  — a pierced brass lantern on a wall bracket (`flame_0` inside); lantern_floor — a big one
#   palm          — a date palm, ~5.5 m; palm_small
#   pallet_board  — an upright wooden pallet on two feet, for the polaroids (front face at y = -0.07)
#   gift_a / gift_b — wrapped presents; pot_plant — terracotta pot with a shrub; party_hat
import bpy, bmesh, sys, math, os, random
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector, Matrix

OUT, PREVIEW = args()
start()
random.seed(11)

BOARD = mat("M_crate", (0.66, 0.46, 0.26), 0.8)
BOARD_DK = mat("M_crate_dark", (0.46, 0.31, 0.17), 0.8)
OLIVE_ICING = mat("M_icing_olive", (0.47, 0.55, 0.3), 0.55)
CREAM = mat("M_icing_cream", (0.99, 0.94, 0.84), 0.55)
CHOC = mat("M_choc", (0.33, 0.18, 0.1), 0.35)
TAN_ICING = mat("M_icing_tan", (0.85, 0.7, 0.45), 0.55)
SPRINKLE_R = mat("M_sprinkle_red", (0.9, 0.2, 0.2), 0.4)
SPRINKLE_Y = mat("M_sprinkle_yellow", (1.0, 0.8, 0.2), 0.4)
BRASS = mat("M_gold", (0.92, 0.66, 0.28), 0.35, 0.85)
GLASS = mat("M_lantern_glass", (1.0, 0.72, 0.36), 0.2, emit=(1.0, 0.55, 0.2))
IRON = mat("M_iron", (0.12, 0.11, 0.1), 0.6, 0.5)
TRUNK = mat("M_trunk", (0.5, 0.36, 0.22), 0.9)
TRUNK_DK = mat("M_trunk_dark", (0.38, 0.26, 0.15), 0.9)
FROND = mat("M_frond", (0.36, 0.56, 0.24), 0.7)
FROND_DK = mat("M_frond_dark", (0.24, 0.42, 0.18), 0.7)
TERRACOTTA = mat("M_terracotta", (0.78, 0.42, 0.26), 0.85)
SHRUB = mat("M_shrub", (0.33, 0.52, 0.24), 0.8)
RED_PAPER = mat("M_wrap_red", (0.86, 0.2, 0.18), 0.5)
TEAL_PAPER = mat("M_wrap_teal", (0.16, 0.6, 0.6), 0.5)
RIBBON_GOLD = mat("M_gold_ribbon", (0.98, 0.78, 0.3), 0.35, 0.6)
RIBBON_W = mat("M_ribbon_white", (0.97, 0.96, 0.93), 0.5)
HAT_A = mat("M_hat_blue", (0.2, 0.45, 0.85), 0.5)

def cake():
    p = [lathe("ck_board", [(0.0, 0.0), (0.22, 0.0), (0.225, 0.012), (0.22, 0.024), (0.0, 0.024)], BOARD, seg=40)]
    z = 0.024
    tiers = [(0.16, 0.12, OLIVE_ICING, TAN_ICING), (0.11, 0.1, CREAM, CHOC)]
    for i, (r, h, body, drip) in enumerate(tiers):
        p.append(lathe(f"ck_tier{i}", [(0.0, z), (r, z), (r * 1.01, z + 0.01), (r * 1.01, z + h - 0.012), (r * 0.98, z + h), (0.0, z + h)], body, seg=48))
        # a glossy drip over the top edge: a cap plus drops of different lengths
        p.append(lathe(f"ck_cap{i}", [(0.0, z + h - 0.002), (r * 0.99, z + h - 0.002), (r * 1.025, z + h - 0.012), (r * 1.03, z + h - 0.02), (r * 1.0, z + h + 0.004), (0.0, z + h + 0.006)], drip, seg=48))
        n = 18 - i * 5
        for k in range(n):
            a = 2 * math.pi * (k + random.random() * 0.4) / n
            L = 0.02 + random.random() * (0.045 if i == 0 else 0.035)
            x, y = math.cos(a) * r * 1.022, math.sin(a) * r * 1.022
            p.append(tube(f"ck_drip{i}_{k}", [(x, y, z + h - 0.012), (x, y, z + h - 0.012 - L)], 0.0075, drip, seg=6, radii=[1.0, 0.85]))
            p.append(prim("uv", f"ck_dripend{i}_{k}", drip, loc=(x, y, z + h - 0.012 - L), scale=(0.0082, 0.0082, 0.0095), segments=8, ring_count=5))
        # piped pearls round the base
        m = int(r * 150)
        for k in range(m):
            a = 2 * math.pi * k / m
            p.append(prim("uv", f"ck_pearl{i}_{k}", CREAM if i == 0 else TAN_ICING, loc=(math.cos(a) * r * 1.02, math.sin(a) * r * 1.02, z + 0.007), scale=(0.0075, 0.0075, 0.0068), segments=8, ring_count=5))
        z += h
    top = z + 0.006
    # sprinkles on the top tier
    for k in range(40):
        a = random.random() * math.pi * 2; rr = math.sqrt(random.random()) * 0.085
        p.append(box(f"ck_spr{k}", SPRINKLE_R if k % 2 else SPRINKLE_Y, (0.012, 0.003, 0.003), loc=(math.cos(a) * rr, math.sin(a) * rr, top + 0.001), rot=(0, 0, random.random() * 3), bev=0))
    # sugar stars round the lower tier
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.25
        st = star_prism(f"ck_star{k}", 0.022, 0.006, RIBBON_GOLD)
        st.rotation_euler = (math.pi / 2, 0, a + math.pi / 2)
        st.location = (math.cos(a) * 0.164, math.sin(a) * 0.164, 0.024 + 0.06)
        apply_tf(st); p.append(st)
    ck = join(p, "cake")
    ck["top"] = top
    print("CAKE_TOP", top)
    return keep(ck)

def star_prism(name, r, depth, material):
    pts = []
    for k in range(10):
        a = math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return slab(name, pts, -depth / 2, depth / 2, material, bev=0.0015, bev_seg=2)

def lantern(name, s=1.0, wall=True):
    p = []
    # body: a six-sided brass cage with glowing panels, a dome and finial
    p.append(lathe(f"{name}_base", [(0, 0), (0.07 * s, 0), (0.08 * s, 0.015 * s), (0.065 * s, 0.03 * s), (0, 0.03 * s)], BRASS, seg=6))
    p.append(lathe(f"{name}_glass", [(0, 0.03 * s), (0.062 * s, 0.03 * s), (0.075 * s, 0.11 * s), (0.062 * s, 0.19 * s), (0, 0.19 * s)], GLASS, seg=6, angle=10))
    for k in range(6):
        a = k * math.pi / 3
        p.append(tube(f"{name}_rib{k}", [(math.cos(a) * 0.063 * s, math.sin(a) * 0.063 * s, 0.03 * s), (math.cos(a) * 0.077 * s, math.sin(a) * 0.077 * s, 0.11 * s), (math.cos(a) * 0.063 * s, math.sin(a) * 0.063 * s, 0.19 * s)], 0.005 * s, BRASS, seg=4))
    p.append(lathe(f"{name}_dome", [(0, 0.188 * s), (0.075 * s, 0.188 * s), (0.06 * s, 0.22 * s), (0.03 * s, 0.25 * s), (0.008 * s, 0.28 * s), (0, 0.29 * s)], BRASS, seg=12))
    p.append(prim("uv", f"{name}_fin", BRASS, loc=(0, 0, 0.3 * s), scale=(0.014 * s,) * 3, segments=8, ring_count=5))
    p.append(smooth(prim("torus", f"{name}_ring", BRASS, loc=(0, 0, 0.325 * s), rot=(math.pi / 2, 0, 0), major_radius=0.016 * s, minor_radius=0.003 * s, major_segments=12, minor_segments=4)))
    body = join(p, f"{name}_body")
    anchors = [empty("flame_0", (0, 0, 0.1 * s))]
    if wall:
        # hang it from a curly iron bracket fixed to the wall behind (+Y)
        body.location = (0, -0.2, -0.36); apply_tf(body)
        anchors[0].location = (0, -0.2, -0.26)
        br = [tube(f"{name}_arm", smooth_path([(0, 0.0, 0), (0, -0.1, 0.02), (0, -0.2, 0.0)], 6), 0.009, IRON, seg=6),
              tube(f"{name}_curl", smooth_path([(0, 0.0, -0.12), (0, -0.06, -0.08), (0, -0.09, -0.02), (0, -0.05, 0.0)], 6), 0.006, IRON, seg=6),
              box(f"{name}_plate", IRON, (0.05, 0.01, 0.16), loc=(0, 0.0, -0.05), bev=0.003),
              tube(f"{name}_chain", [(0, -0.2, 0.0), (0, -0.2, -0.03)], 0.004, IRON, seg=4)]
        body = join([body] + br, f"{name}_body")
    return group(name, [body], anchors)

def frond(name, length, droop, width, material):
    """A palm frond: a V-folded blade with notched leaflets along a drooping rib (built along +Y)."""
    n = 18
    bm = bmesh.new(); prev = None
    pts = []
    for i in range(n + 1):
        t = i / n
        y = t * length
        zc = math.sin(t * math.pi * 0.55) * length * 0.25 - droop * t * t * length
        pts.append((y, zc))
    for i, (y, zc) in enumerate(pts):
        t = i / n
        w = width * math.sin(math.pi * min(1.0, t * 1.1 + 0.05)) * (0.55 if i % 2 else 1.0)   # notched edge
        c = bm.verts.new((0, y, zc + 0.02))
        l = bm.verts.new((-w, y, zc - w * 0.35)); r = bm.verts.new((w, y, zc - w * 0.35))
        if prev:
            pc, pl, pr = prev
            bm.faces.new((pl, pc, c, l)); bm.faces.new((pc, pr, r, c))
        prev = (c, l, r)
    ob = new_obj(name, bm, material)
    sol = ob.modifiers.new("s", 'SOLIDIFY'); sol.thickness = 0.01
    apply_mods(ob)
    return smooth(ob, 50)

def palm(name, height=5.4, lean=0.25, n_fronds=11):
    p = []
    seg = 16
    path = [(math.sin(t * 1.2) * lean * t, 0, t * height) for t in [k / seg for k in range(seg + 1)]]
    for k in range(seg):   # stacked bark rings (slightly flared), alternating tones
        a, b = Vector(path[k]), Vector(path[k + 1])
        r0 = 0.17 - 0.05 * k / seg
        ring = lathe(f"{name}_ring{k}", [(0, 0), (r0 * 0.92, 0), (r0 * 1.08, (b - a).length * 0.85), (r0 * 0.9, (b - a).length), (0, (b - a).length)], TRUNK if k % 2 else TRUNK_DK, seg=10, angle=30)
        d = (b - a).normalized()
        ring.matrix_world = Matrix.Translation(a) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        apply_tf(ring); p.append(ring)
    top = Vector(path[-1])
    p.append(prim("uv", f"{name}_crown", TRUNK_DK, loc=top, scale=(0.2, 0.2, 0.16), segments=10, ring_count=6))
    for k in range(n_fronds):
        a = 2 * math.pi * k / n_fronds + random.random() * 0.3
        L = random.uniform(1.8, 2.4)
        f = frond(f"{name}_frond{k}", L, random.uniform(0.25, 0.5), 0.32, FROND if k % 2 else FROND_DK)
        tilt = random.uniform(-0.15, 0.35)
        f.matrix_world = Matrix.Translation(top + Vector((0, 0, 0.05))) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'X')
        apply_tf(f); p.append(f)
    # date clusters
    for k in range(3):
        a = k * 2.1
        p.append(prim("ico", f"{name}_dates{k}", mat("M_dates", (0.85, 0.5, 0.15), 0.6), loc=top + Vector((math.cos(a) * 0.18, math.sin(a) * 0.18, -0.15)), scale=(0.09, 0.09, 0.14), subdivisions=1))
    return keep(join(p, name))

def pallet_board():
    p = []
    W, H = 1.25, 1.0
    for k in range(6):        # face slats with small gaps
        z = 0.12 + k * (H / 6)
        p.append(box(f"pb_slat{k}", BOARD if k % 2 else BOARD_DK, (W, 0.022, H / 6 - 0.025), loc=(0, -0.06, z + H / 12), bev=0.004))
    for sx in (-1, 0, 1):     # stringers behind
        p.append(box(f"pb_str{sx}", BOARD_DK, (0.08, 0.08, H + 0.04), loc=(sx * (W / 2 - 0.06), 0.0, 0.12 + H / 2), bev=0.006))
    for sx in (-1, 1):        # feet
        p.append(box(f"pb_foot{sx}", BOARD_DK, (0.09, 0.5, 0.06), loc=(sx * (W / 2 - 0.06), 0.05, 0.03), bev=0.006))
        p.append(box(f"pb_leg{sx}", BOARD_DK, (0.07, 0.07, 0.14), loc=(sx * (W / 2 - 0.06), 0.0, 0.08), bev=0.006))
    for k in range(10):       # nail heads
        p.append(cyl(f"pb_nail{k}", IRON, 0.006, 0.004, loc=((k % 5 - 2) * (W / 2 - 0.06) / 2 * (1 if k < 5 else 1), -0.072, 0.18 + (k // 5) * 0.82), rot=(math.pi / 2, 0, 0), seg=8))
    return keep(join(p, "pallet_board"))

def gift(name, size, paper, ribbon):
    w, d, h = size
    p = [box(f"{name}_box", paper, (w, d, h), loc=(0, 0, h / 2), bev=0.006),
         box(f"{name}_lid", paper, (w + 0.012, d + 0.012, h * 0.2), loc=(0, 0, h - h * 0.1 + 0.004), bev=0.005),
         box(f"{name}_rx", ribbon, (w + 0.016, d * 0.16, h + 0.012), loc=(0, 0, h / 2 + 0.004), bev=0.002),
         box(f"{name}_ry", ribbon, (w * 0.16, d + 0.016, h + 0.012), loc=(0, 0, h / 2 + 0.004), bev=0.002)]
    for sx in (-1, 1):
        p.append(smooth(prim("torus", f"{name}_loop{sx}", ribbon, loc=(sx * w * 0.14, 0, h + 0.035), rot=(math.pi / 2, 0.5 * sx, 0), major_radius=w * 0.13, minor_radius=w * 0.035, major_segments=16, minor_segments=6)))
    return keep(join(p, name))

def pot_plant():
    p = [lathe("pp_pot", [(0, 0), (0.16, 0), (0.2, 0.3), (0.22, 0.32), (0.22, 0.36), (0.19, 0.36), (0.18, 0.33), (0, 0.33)], TERRACOTTA, seg=24)]
    for k in range(9):
        a = k * 2.4; r = 0.08 + (k % 3) * 0.05
        p.append(prim("ico", f"pp_bush{k}", SHRUB, loc=(math.cos(a) * r, math.sin(a) * r, 0.45 + (k % 4) * 0.07), scale=(0.16, 0.16, 0.14), subdivisions=2))
    return keep(join(p, "pot_plant"))

def party_hat():
    p = [prim("cone", "ph_cone", HAT_A, loc=(0, 0, 0.09), radius1=0.06, radius2=0.004, depth=0.18, vertices=20)]
    for k in range(4):
        p.append(smooth(prim("torus", f"ph_band{k}", SPRINKLE_Y, loc=(0, 0, 0.03 + k * 0.04), major_radius=0.056 - k * 0.0125, minor_radius=0.004, major_segments=20, minor_segments=4)))
    p.append(prim("ico", "ph_pom", RIBBON_W, loc=(0, 0, 0.185), scale=(0.02,) * 3, subdivisions=2))
    return keep(join(p, "party_hat"))

cake()
lantern("lantern_wall", 1.0, wall=True)
lantern("lantern_floor", 1.8, wall=False)
palm("palm", 5.6, 0.35, 12)
OBJECTS["palm"].scale = (1, 1, 1)
palm("palm_small", 3.6, 0.2, 9)
pallet_board()
gift("gift_a", (0.3, 0.3, 0.24), RED_PAPER, RIBBON_GOLD)
gift("gift_b", (0.22, 0.2, 0.16), TEAL_PAPER, RIBBON_W)
pot_plant(); party_hat()
finish(OUT, PREVIEW, cols=5, cell=2.0, bg=(0.5, 0.42, 0.33))

# Halloween web — original cartoon props, modelled in Blender for this project.
# Run: blender -b --factory-startup --python halloween_props.py -- <out.glb> [preview.png]
# Floor props stand on z = 0, front facing -Y (glTF +Z). Moving parts sit under pivot empties (salon_lib.pivot).
import bpy, bmesh, sys, math, os, random
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector, Matrix

OUT, PREVIEW = args()
start()
random.seed(31)

STONE = mat("M_stone", (0.5, 0.52, 0.58), 0.85)
STONE_DK = mat("M_stone_dark", (0.36, 0.37, 0.43), 0.85)
MOSS = mat("M_moss", (0.28, 0.42, 0.22), 0.9)
IRON = mat("M_iron", (0.09, 0.08, 0.11), 0.5, 0.6)
PUMPKIN = mat("M_pumpkin", (0.98, 0.48, 0.07), 0.5)
PUMPKIN_DK = mat("M_pumpkin_dark", (0.8, 0.33, 0.04), 0.5)
STEM = mat("M_stem", (0.33, 0.3, 0.12), 0.8)
BARK = mat("M_bark", (0.2, 0.15, 0.14), 0.9)
BARK_DK = mat("M_bark_dark", (0.13, 0.1, 0.1), 0.9)
WOOD = mat("M_wood_old", (0.38, 0.27, 0.19), 0.85)
WOOD_DK = mat("M_wood_old_dark", (0.25, 0.17, 0.12), 0.85)
POT = mat("M_cauldron", (0.1, 0.1, 0.12), 0.45, 0.5)
LOG = mat("M_log", (0.28, 0.17, 0.1), 0.85)
BONE = mat("M_bone", (0.93, 0.9, 0.8), 0.6)
GLOW = mat("M_window_glow", (1.0, 0.72, 0.3), 0.4, emit=(1.0, 0.62, 0.2))
GLOW_G = mat("M_window_green", (0.55, 1.0, 0.45), 0.4, emit=(0.35, 0.9, 0.3))
WALL = mat("M_mansion_wall", (0.36, 0.3, 0.4), 0.85)
WALL_DK = mat("M_mansion_wall_dark", (0.26, 0.21, 0.3), 0.85)
ROOF = mat("M_roof", (0.17, 0.14, 0.22), 0.8)
TRIM = mat("M_trim", (0.14, 0.12, 0.17), 0.7)
BRASS = mat("M_gold", (0.85, 0.62, 0.25), 0.35, 0.8)
LEATHER = mat("M_leather", (0.12, 0.1, 0.1), 0.7)
BELLOWS = mat("M_bellows", (0.2, 0.08, 0.1), 0.8)
FUR = mat("M_bat", (0.16, 0.12, 0.2), 0.8)
WING = mat("M_bat_wing", (0.27, 0.18, 0.32), 0.7)
CROW = mat("M_crow", (0.07, 0.07, 0.1), 0.6)
BEAK = mat("M_beak", (0.95, 0.65, 0.2), 0.5)
EYE = mat("M_eye_glow", (1.0, 0.85, 0.2), 0.3, emit=(1.0, 0.7, 0.1))
WAX = mat("M_wax", (0.95, 0.92, 0.82), 0.5)
SHROOM = mat("M_shroom", (0.62, 0.3, 0.85), 0.5, emit=(0.25, 0.08, 0.4))
SHROOM_STEM = mat("M_shroom_stem", (0.88, 0.84, 0.76), 0.6)
DIRT = mat("M_dirt", (0.22, 0.16, 0.12), 0.95)
FIRE = mat("M_fire", (1.0, 0.55, 0.15), 0.6, emit=(1.0, 0.45, 0.1))

def move(ob, loc, rot=None):
    if rot: ob.rotation_euler = rot
    ob.location = loc; apply_tf(ob); return ob

def prof(name, pts, thick, m, bev=0.012, y=0.0):
    """A 2D outline in the XZ plane (x, z), extruded `thick` along Y (centred on y)."""
    ob = slab(name, pts, -thick / 2, thick / 2, m, bev=bev, bev_seg=2)
    ob.rotation_euler = (math.pi / 2, 0, 0); ob.location = (0, y, 0); apply_tf(ob)
    return ob

def origin_to(ob, at):
    bpy.context.scene.cursor.location = at
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

def arch(w, h, n=16, pointed=False):
    """Outline of a slab with an arched (or pointed gothic) top: (x, z) counter-clockwise from bottom-left."""
    r = w / 2; pts = [(-r, 0), (r, 0), (r, h - r)]
    for k in range(1, n):
        a = math.pi * k / n
        if pointed:
            t = k / n; x = r * math.cos(a); z = h - r + r * math.sin(a) * (1 + 0.55 * (1 - abs(1 - 2 * t)))
        else:
            x = r * math.cos(a); z = h - r + r * math.sin(a)
        pts.append((x, z))
    pts.append((-r, h - r))
    return pts

# ── graves ────────────────────────────────────────────────
def moss_patches(name, w, h, t, n=5):
    out = []
    for k in range(n):
        x = (random.random() - 0.5) * w * 0.8; z = random.random() * h * 0.35
        out.append(move(prim("ico", f"{name}_moss{k}", MOSS, scale=(0.06 + random.random() * 0.05, 0.03, 0.04), subdivisions=1), (x, -t / 2 - 0.005, z + 0.05)))
    return out

def tombstone(name, kind):
    w, h, t = {"round": (0.7, 1.05, 0.16), "gothic": (0.62, 1.2, 0.16), "cross": (0.5, 1.15, 0.14), "small": (0.5, 0.65, 0.14)}[kind]
    p = [box(f"{name}_base", STONE_DK, (w + 0.16, t + 0.16, 0.12), loc=(0, 0, 0.06), bev=0.02)]
    if kind == "cross":
        p.append(prof(f"{name}_v", [(-0.07, 0.12), (0.07, 0.12), (0.07, h), (-0.07, h)], t, STONE))
        p.append(prof(f"{name}_h", [(-w / 2, h - 0.38), (w / 2, h - 0.38), (w / 2, h - 0.24), (-w / 2, h - 0.24)], t, STONE))
        face = (0, -t / 2 - 0.003, h - 0.31)
    else:
        outline = [(x, z + 0.12) for x, z in arch(w, h, 16, pointed=(kind == "gothic"))]
        if kind == "small":   # a chunk broken off the top corner
            outline = [(x, min(z, 0.12 + h - 0.06 - max(0, x) * 0.5)) for x, z in outline]
        p.append(prof(f"{name}_slab", outline, t, STONE))
        # a carved border just inside the edge
        inner = [(x * 0.84, 0.12 + (z - 0.12) * 0.9 + 0.03) for x, z in outline]
        p.append(prof(f"{name}_inset", inner, 0.006, STONE_DK, bev=0.002, y=-t / 2 - 0.002))
        face = (0, -t / 2 - 0.006, 0.12 + h * 0.48)
    for k in range(2):   # cracks
        x0 = (random.random() - 0.5) * w * 0.6
        p.append(tube(f"{name}_crack{k}", [(x0, -t / 2 - 0.004, 0.2 + k * 0.2), (x0 + 0.05, -t / 2 - 0.004, 0.32 + k * 0.2), (x0 + 0.02, -t / 2 - 0.004, 0.42 + k * 0.2)], 0.004, STONE_DK, seg=4))
    p += moss_patches(name, w, h, t)
    body = join(p, f"{name}_body")
    return group(name, [body], [empty(f"face_{name}", face)])

def dirt_mound():
    m = prim("uv", "dirt_mound", DIRT, loc=(0, 0, 0), scale=(0.55, 1.0, 0.18), segments=20, ring_count=10)
    for v in m.data.vertices:
        if v.co.z < 0: v.co.z = 0
        v.co.z *= 1 + 0.15 * math.sin(v.co.x * 20) * math.cos(v.co.y * 13)
    return keep(smooth(m, 60))

# ── fence and gate ────────────────────────────────────────
def picket(name, x, h, top=True):
    p = [cyl(f"{name}_bar", IRON, 0.012, h, loc=(x, 0, h / 2), seg=6)]
    if top: p.append(prim("cone", f"{name}_tip", IRON, loc=(x, 0, h + 0.05), radius1=0.03, radius2=0.0, depth=0.1, vertices=6))
    return p

def fence_section():
    L, H = 2.0, 1.25
    p = [box("fs_rail_lo", IRON, (L, 0.03, 0.03), loc=(0, 0, 0.18), bev=0.004), box("fs_rail_hi", IRON, (L, 0.03, 0.03), loc=(0, 0, H - 0.12), bev=0.004)]
    for k in range(9): p += picket(f"fs_p{k}", -L / 2 + 0.11 + k * (L - 0.22) / 8, H)
    p.append(box("fs_post", IRON, (0.07, 0.07, H + 0.15), loc=(L / 2, 0, (H + 0.15) / 2), bev=0.008))
    p.append(prim("uv", "fs_ball", IRON, loc=(L / 2, 0, H + 0.2), scale=(0.055,) * 3, segments=12, ring_count=8))
    return keep(join(p, "fence_section"))

def gate():
    W, H = 1.15, 2.0
    parts = []
    for sx in (-1, 1):   # stone pillars with a ball cap
        px = sx * (W + 0.32)
        parts.append(box(f"g_pillar{sx}", STONE, (0.5, 0.5, 2.6), loc=(px, 0, 1.3), bev=0.03))
        parts.append(box(f"g_cap{sx}", STONE_DK, (0.62, 0.62, 0.12), loc=(px, 0, 2.66), bev=0.02))
        parts.append(prim("uv", f"g_ball{sx}", STONE, loc=(px, 0, 2.9), scale=(0.2,) * 3, segments=18, ring_count=10))
        parts += [move(m, (px, 0, 0)) for m in moss_patches(f"g_pm{sx}", 0.4, 2.0, 0.5, 3)]   # on the pillar's face (not floating in the gateway)
    # the iron arch over the gate, with a little bat silhouette on top
    arc = [(W * math.cos(a), 0, 2.45 + 0.45 * math.sin(a)) for a in [math.pi * k / 20 for k in range(21)]]
    parts.append(tube("g_arch", arc, 0.022, IRON, seg=6))
    parts.append(tube("g_arch2", [(x * 0.9, 0, z - 0.12) for x, _, z in arc], 0.014, IRON, seg=6))
    frame = join(parts, "g_frame")
    leaves = []
    for sx, nm in ((-1, "gate_left"), (1, "gate_right")):
        lp = []
        x0, x1 = (-W, -0.02) if sx < 0 else (0.02, W)
        lp.append(box(f"{nm}_lo", IRON, (W - 0.02, 0.035, 0.035), loc=((x0 + x1) / 2, 0, 0.2), bev=0.004))
        lp.append(box(f"{nm}_hi", IRON, (W - 0.02, 0.035, 0.035), loc=((x0 + x1) / 2, 0, H - 0.25), bev=0.004))
        lp.append(box(f"{nm}_st", IRON, (0.05, 0.05, H), loc=(x0 if sx < 0 else x1, 0, H / 2), bev=0.006))
        for k in range(6):
            x = x0 + 0.1 + k * (x1 - x0 - 0.2) / 5
            lp += picket(f"{nm}_p{k}", x, H - 0.05 + 0.18 * math.sin(math.pi * (k + 0.5) / 6))
        for k in range(2):   # curls
            cx = x0 + (x1 - x0) * (0.3 + 0.4 * k)
            lp.append(smooth(prim("torus", f"{nm}_curl{k}", IRON, loc=(cx, 0, H - 0.45), rot=(math.pi / 2, 0, 0), major_radius=0.1, minor_radius=0.012, major_segments=16, minor_segments=4)))
        leaf = join(lp, nm)
        origin_to(leaf, ((-W if sx < 0 else W), 0, 0))
        leaves.append(pivot(leaf))
    return group("gate", [frame] + leaves)

# ── the dead tree with five branches to hang photos from ──
def dead_tree():
    p = []
    trunk = [(0, 0, 0), (0.05, 0.02, 1.0), (-0.08, 0, 2.0), (0.06, 0.03, 2.9), (0.0, 0, 3.4)]
    p.append(tube("dt_trunk", smooth_path(trunk, 8), 0.32, BARK, seg=12, radii=[1.25] + [1.0 - 0.6 * k / 32 for k in range(1, 33)]))
    for k in range(5):   # roots
        a = k * 2 * math.pi / 5 + 0.3
        p.append(tube(f"dt_root{k}", smooth_path([(0, 0, 0.35), (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.08), (math.cos(a) * 0.95, math.sin(a) * 0.95, -0.04)], 6), 0.13, BARK_DK, seg=8, radii=[1.0] * 3 + [0.6] * 7 + [0.3] * 3))
    # branches: (start height, direction angle, length, rise) → the tip is where a photo hangs
    hangs = []
    specs = [(1.9, 2.6, 1.9, 0.5), (2.4, 0.4, 1.8, 0.7), (2.9, 3.5, 1.5, 0.9), (3.1, 1.0, 1.6, 1.0), (3.3, 2.0, 1.3, 1.3)]
    for k, (z0, a, L, rise) in enumerate(specs):
        ax, ay = math.cos(a), math.sin(a) * 0.45
        pts = [(0, 0, z0), (ax * L * 0.4, ay * L * 0.4, z0 + rise * 0.5), (ax * L * 0.75, ay * L * 0.75, z0 + rise * 0.8), (ax * L, ay * L, z0 + rise * 0.75)]
        p.append(tube(f"dt_br{k}", smooth_path(pts, 8), 0.11, BARK, seg=8, radii=[1.0 - 0.75 * i / 24 for i in range(25)]))
        for j in range(2):   # twigs
            t0 = 0.5 + j * 0.25
            bx, by, bz = ax * L * t0, ay * L * t0, z0 + rise * (0.3 + 0.5 * t0)
            p.append(tube(f"dt_tw{k}{j}", [(bx, by, bz), (bx + ax * 0.25 + 0.1, by, bz + 0.35), (bx + ax * 0.32 + 0.15 * (j - 0.5), by, bz + 0.6)], 0.025, BARK_DK, seg=5, radii=[1, 0.6, 0.2]))
        hangs.append(empty(f"hang_{k}", (ax * L * 0.82, ay * L * 0.82, z0 + rise * 0.8 - 0.03)))
    p.append(prim("ico", "dt_knot", BARK_DK, loc=(0.0, -0.3, 1.4), scale=(0.12, 0.06, 0.16), subdivisions=1))
    body = join(p, "dt_body")
    return group("dead_tree", [body], hangs)

# ── pumpkins ──────────────────────────────────────────────
def pumpkin(name, r, ribs=9, squash=0.78, giant=False):
    pk = prim("uv", f"{name}_body", PUMPKIN, scale=(r, r, r * squash), segments=48, ring_count=24)
    for v in pk.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + 0.07 * math.cos(ribs * a)
        v.co.x *= k; v.co.y *= k
        if abs(v.co.z) > r * squash * 0.85: v.co.z *= 0.92   # dimples top and bottom
    pk.location = (0, 0, r * squash * 0.98); apply_tf(pk)
    smooth(pk, 80)
    stem = tube(f"{name}_stem", smooth_path([(0, 0, r * squash * 1.85), (0.02 * r, 0, r * squash * 2.15), (0.12 * r, 0.02 * r, r * squash * 2.3)], 6), 0.08 * r, STEM, seg=8, radii=[1.2, 1.0, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.42, 0.4, 0.38])
    parts = [pk, stem]
    if giant:   # a curly vine and a leaf
        parts.append(tube(f"{name}_vine", [(0.1 * r * math.cos(t), 0.1 * r * math.sin(t) + 0.15 * r, r * squash * 2.0 + 0.02 * t) for t in [k * 0.3 for k in range(30)]], 0.012 * r, STEM, seg=5))
        leaf = prim("uv", f"{name}_leaf", MOSS, loc=(-0.3 * r, 0.1 * r, r * squash * 1.95), rot=(0.4, 0.3, 0.8), scale=(0.28 * r, 0.16 * r, 0.02 * r), segments=12, ring_count=6)
        parts.append(leaf)
    body = join(parts, name if not giant else f"{name}_body")
    return keep(body) if not giant else group(name, [body], [empty("carve", (0, -r * 0.93, r * squash))])

# ── cauldron over a fire ──────────────────────────────────
def cauldron():
    p = [lathe("ca_pot", [(0.0, 0.25), (0.25, 0.22), (0.42, 0.34), (0.48, 0.52), (0.45, 0.7), (0.4, 0.78), (0.43, 0.81), (0.41, 0.84), (0.36, 0.8), (0.0, 0.8)], POT, seg=36)]
    p.append(smooth(prim("torus", "ca_rim", POT, loc=(0, 0, 0.82), major_radius=0.41, minor_radius=0.035, major_segments=40, minor_segments=8)))
    for k in range(3):
        a = k * 2 * math.pi / 3
        p.append(tube(f"ca_leg{k}", [(math.cos(a) * 0.3, math.sin(a) * 0.3, 0.3), (math.cos(a) * 0.4, math.sin(a) * 0.4, 0.12), (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.0)], 0.035, POT, seg=6))
    for sx in (-1, 1): p.append(smooth(prim("torus", f"ca_ear{sx}", POT, loc=(sx * 0.47, 0, 0.66), rot=(math.pi / 2, 0, 0), major_radius=0.06, minor_radius=0.015, major_segments=12, minor_segments=4)))
    for k in range(4):   # logs crossed under it
        a = k * math.pi / 4
        p.append(cyl(f"ca_log{k}", LOG, 0.06, 0.6, loc=(0, 0, 0.07 + k * 0.01), rot=(math.pi / 2, 0, a), seg=10, bev=0.01))
    for k in range(10):   # ring of stones
        a = k * 2 * math.pi / 10
        p.append(prim("ico", f"ca_st{k}", STONE, loc=(math.cos(a) * 0.62, math.sin(a) * 0.62, 0.05), scale=(0.1, 0.08, 0.07), subdivisions=1))
    body = join(p, "ca_body")
    return group("cauldron", [body], [empty("brew", (0, 0, 0.76)), empty("fire", (0, 0, 0.12))])

# ── the coffin mailbox ────────────────────────────────────
def coffin_mailbox():
    out = [(-0.14, 0), (0.14, 0), (0.22, 0.42), (0.12, 0.62), (-0.12, 0.62), (-0.22, 0.42)]
    post = [box("cm_post", WOOD_DK, (0.1, 0.1, 1.1), loc=(0, 0.06, 0.55), bev=0.01)]
    box_body = slab("cm_box", [(x, y) for x, y in out], -0.12, 0.08, WOOD, bev=0.008)   # lies in XY: rotate up
    box_body.rotation_euler = (math.pi / 2, 0, 0); box_body.location = (0, 0.06, 1.05); apply_tf(box_body)
    post.append(box_body)
    post.append(box("cm_flag", mat("M_flag_red", (0.75, 0.12, 0.12), 0.6), (0.02, 0.12, 0.1), loc=(0.24, 0.06, 1.5), bev=0.003))
    post.append(box("cm_flagpost", IRON, (0.015, 0.015, 0.22), loc=(0.235, 0.06, 1.4), bev=0.002))
    body = join(post, "cm_body")
    lid = slab("coffin_lid", [(x * 1.04, y * 1.02 - 0.006) for x, y in out], 0.0, 0.03, WOOD_DK, bev=0.008)
    lid.rotation_euler = (math.pi / 2, 0, 0); lid.location = (0, -0.12, 1.05); apply_tf(lid)
    cross = [box("cl_v", BONE, (0.03, 0.006, 0.26), loc=(0, -0.155, 1.4), bev=0.002), box("cl_h", BONE, (0.15, 0.006, 0.03), loc=(0, -0.155, 1.46), bev=0.002)]
    lid = join([lid] + cross, "coffin_lid")
    origin_to(lid, (-0.22, -0.12, 1.47))
    lid = pivot(lid)
    return group("coffin_mailbox", [body, lid], [empty("letter_spot", (0, -0.02, 1.32))])

# ── the crypt where the date is carved ────────────────────
def crypt():
    p = []
    for k in range(3): p.append(box(f"cr_step{k}", STONE_DK, (3.0 - k * 0.25, 2.6 - k * 0.2, 0.15), loc=(0, 0.1 * k, 0.075 + k * 0.15), bev=0.015))
    p.append(box("cr_body", STONE, (2.3, 2.0, 2.4), loc=(0, 0.35, 1.65), bev=0.03))
    for sx in (-1, 1):
        p.append(cyl(f"cr_col{sx}", STONE, 0.13, 2.3, loc=(sx * 0.95, -0.75, 1.6), seg=16))
        p.append(box(f"cr_colbase{sx}", STONE_DK, (0.34, 0.34, 0.12), loc=(sx * 0.95, -0.75, 0.51), bev=0.01))
        p.append(box(f"cr_colcap{sx}", STONE_DK, (0.34, 0.34, 0.12), loc=(sx * 0.95, -0.75, 2.78), bev=0.01))
    p.append(box("cr_lintel", STONE_DK, (2.5, 0.5, 0.25), loc=(0, -0.55, 2.95), bev=0.02))
    ped = prof("cr_ped", [(-1.3, 0), (1.3, 0), (0, 0.75)], 0.5, STONE, y=-0.55)
    ped.location = (0, 0, 3.07); apply_tf(ped); p.append(ped)
    p.append(prim("uv", "cr_skull", BONE, loc=(0, -0.81, 3.3), scale=(0.13, 0.08, 0.12), segments=14, ring_count=8))
    for sx in (-1, 1): p.append(prim("uv", f"cr_eye{sx}", IRON, loc=(sx * 0.045, -0.89, 3.31), scale=(0.03, 0.01, 0.035), segments=8, ring_count=5))
    p.append(box("cr_frame", STONE_DK, (1.2, 0.06, 1.95), loc=(0, -0.66, 1.35), bev=0.01))
    p += moss_patches("cr", 2.0, 2.4, 2.0, 7)
    body = join(p, "cr_body")
    door = [box("crypt_door_slab", IRON, (1.0, 0.06, 1.8), loc=(0, -0.69, 1.32), bev=0.01)]
    for k in range(4): door.append(box(f"cd_bar{k}", BRASS, (0.9, 0.02, 0.025), loc=(0, -0.725, 0.6 + k * 0.45), bev=0.004))
    door.append(smooth(prim("torus", "cd_ring", BRASS, loc=(0.32, -0.74, 1.3), rot=(math.pi / 2, 0, 0), major_radius=0.06, minor_radius=0.012, major_segments=14, minor_segments=4)))
    d = join(door, "crypt_door")
    origin_to(d, (-0.5, -0.69, 0.42))
    d = pivot(d)
    return group("crypt", [body, d], [empty("crypt_plaque", (0, -0.82, 2.95))])

# ── lights, gramophone, little things ─────────────────────
def lamp_post():
    p = [cyl("lp_base", IRON, 0.12, 0.25, loc=(0, 0, 0.125), seg=10, bev=0.01), cyl("lp_pole", IRON, 0.045, 2.6, loc=(0, 0, 1.5), seg=10)]
    p.append(tube("lp_arm", smooth_path([(0, 0, 2.7), (0, 0, 2.95), (0.25, 0, 3.05), (0.45, 0, 2.9)], 6), 0.025, IRON, seg=6))
    p.append(lathe("lp_cage", [(0.0, 2.45), (0.08, 2.45), (0.13, 2.55), (0.13, 2.78), (0.04, 2.86), (0.0, 2.86)], IRON, seg=6))
    p.append(lathe("lp_glass", [(0.0, 2.5), (0.115, 2.52), (0.115, 2.76), (0.0, 2.78)], GLOW, seg=6))
    body = join(p, "lp_body")
    body.location.x -= 0.45; apply_tf(body)
    return group("lamp_post", [body], [empty("flame_lamp", (0, 0, 2.62))])

def gramophone():
    p = [box("gr_table", WOOD_DK, (0.6, 0.5, 0.05), loc=(0, 0, 0.75), bev=0.01)]
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(cyl(f"gr_leg{sx}{sy}", WOOD_DK, 0.025, 0.75, loc=(sx * 0.25, sy * 0.2, 0.375), seg=8))
    p.append(box("gr_case", WOOD, (0.4, 0.4, 0.16), loc=(0, 0, 0.86), bev=0.012))
    p.append(cyl("gr_crank", BRASS, 0.01, 0.12, loc=(0.24, 0, 0.88), rot=(0, math.pi / 2, 0), seg=6))
    # an open bell with a thin lip and a deep, dark throat (not a lid over the mouth)
    outer = [(0.025, 0.0), (0.03, 0.12), (0.06, 0.3), (0.13, 0.45), (0.26, 0.55), (0.28, 0.56)]
    inner = [(0.265, 0.553), (0.2, 0.507), (0.11, 0.425), (0.048, 0.285), (0.02, 0.13), (0.0, 0.09)]
    horn = lathe("gr_horn", outer + inner, BRASS, seg=32, cap_top=False)
    horn.data.materials.append(mat("M_horn_throat", (0.16, 0.09, 0.05), 0.6, 0.3))
    for k, poly in enumerate(horn.data.polygons):
        if len(outer) * 32 <= k < (len(outer) + len(inner) - 1) * 32: poly.material_index = 1   # the inner wall (the lip stays brass)
    horn.rotation_euler = (math.radians(35), 0, 0); horn.location = (0.08, 0.06, 1.0); apply_tf(horn)   # the bell leans forward, over the record
    p.append(horn)
    p.append(tube("gr_neck", [(0.08, 0.12, 0.94), (0.08, 0.08, 1.0)], 0.02, BRASS, seg=8))
    p.append(tube("gr_arm", [(0.12, 0.12, 0.95), (0.05, 0.02, 0.96), (-0.02, -0.06, 0.955)], 0.008, BRASS, seg=6))
    body = join(p, "gr_body")
    rec = [cyl("gr_record", IRON, 0.15, 0.008, loc=(0, 0, 0.945), seg=32), cyl("gr_label", mat("M_label_purple", (0.5, 0.15, 0.6), 0.6), 0.05, 0.009, loc=(0, 0, 0.946), seg=20)]
    r = join(rec, "gramophone_record")
    origin_to(r, (0, 0, 0.945))
    return group("gramophone", [body, pivot(r)], [empty("horn_mouth", (0.08, -0.25, 1.4))])

def bat():
    p = [prim("uv", "bt_body", FUR, scale=(0.07, 0.06, 0.09), segments=14, ring_count=10)]
    for sx in (-1, 1):
        p.append(prim("cone", f"bt_ear{sx}", FUR, loc=(sx * 0.035, 0, 0.1), rot=(0, sx * 0.3, 0), radius1=0.025, radius2=0.0, depth=0.06, vertices=8))
        p.append(prim("uv", f"bt_eye{sx}", EYE, loc=(sx * 0.025, -0.055, 0.04), scale=(0.012,) * 3, segments=8, ring_count=5))
    body = join(p, "bt_body")
    wings = []
    for sx, nm in ((-1, "bat_wing_l"), (1, "bat_wing_r")):
        pts = [(0.0, 0.0), (0.12, 0.05), (0.22, 0.02), (0.3, -0.04), (0.22, -0.04), (0.17, -0.09), (0.11, -0.05), (0.05, -0.08)]
        w = slab(nm, [(sx * x, y) for x, y in (pts if sx > 0 else pts[::-1])], -0.004, 0.004, WING, bev=0.002)
        w.rotation_euler = (math.pi / 2, 0, 0); w.location = (sx * 0.05, 0, 0.03); apply_tf(w)
        origin_to(w, (sx * 0.05, 0, 0.03))
        wings.append(pivot(w))
    return group("bat", [body] + wings)

def crow():
    p = [prim("uv", "cw_body", CROW, loc=(0, 0.02, 0.13), scale=(0.08, 0.13, 0.08), segments=16, ring_count=10),
         prim("uv", "cw_head", CROW, loc=(0, -0.11, 0.21), scale=(0.055,) * 3, segments=14, ring_count=8),
         prim("cone", "cw_beak", BEAK, loc=(0, -0.17, 0.2), rot=(math.pi / 2, 0, 0), radius1=0.018, radius2=0.0, depth=0.06, vertices=8),
         box("cw_tail", CROW, (0.06, 0.12, 0.015), loc=(0, 0.17, 0.1), rot=(0.4, 0, 0), bev=0.004)]
    for sx in (-1, 1):
        p.append(prim("uv", f"cw_eye{sx}", EYE, loc=(sx * 0.028, -0.14, 0.23), scale=(0.01,) * 3, segments=8, ring_count=5))
        p.append(move(prim("uv", f"cw_wing{sx}", CROW, scale=(0.025, 0.12, 0.05), segments=10, ring_count=6), (sx * 0.07, 0.04, 0.14), (0.2, sx * 0.1, 0)))
        p.append(tube(f"cw_leg{sx}", [(sx * 0.025, 0.0, 0.07), (sx * 0.025, 0.0, 0.0)], 0.005, BEAK, seg=4))
    return keep(join(p, "crow"))

def candy_bucket():
    p = [lathe("cb_pail", [(0.0, 0.0), (0.14, 0.0), (0.17, 0.08), (0.18, 0.18), (0.17, 0.24), (0.15, 0.25), (0.15, 0.23), (0.0, 0.22)], PUMPKIN, seg=32, cap_top=False)]
    p.append(tube("cb_handle", [(-0.16, 0, 0.22), (-0.1, 0, 0.42), (0.1, 0, 0.42), (0.16, 0, 0.22)], 0.008, IRON, seg=6))
    for k in range(10): p.append(prim("uv", f"cb_candy{k}", mat(f"M_candy{k % 4}", [(0.9, 0.2, 0.3), (0.3, 0.7, 0.95), (0.95, 0.85, 0.2), (0.5, 0.9, 0.4)][k % 4], 0.4), loc=(math.cos(k * 2.4) * 0.08, math.sin(k * 2.4) * 0.08, 0.23 + (k % 3) * 0.015), scale=(0.035, 0.022, 0.022), segments=10, ring_count=6))
    return group("candy_bucket", [join(p, "cb_body")], [empty("face_bucket", (0, -0.175, 0.13))])

def box_camera():
    p = [box("bc_back", WOOD, (0.24, 0.12, 0.24), loc=(0, 0.14, 1.45), bev=0.01)]
    for k in range(4): p.append(box(f"bc_bel{k}", BELLOWS, (0.2 - k * 0.012, 0.045, 0.2 - k * 0.012), loc=(0, 0.06 - k * 0.045, 1.45), bev=0.006))
    p.append(box("bc_front", WOOD, (0.18, 0.04, 0.18), loc=(0, -0.13, 1.45), bev=0.008))
    p.append(cyl("bc_lens", BRASS, 0.05, 0.08, loc=(0, -0.18, 1.45), rot=(math.pi / 2, 0, 0), seg=20, bev=0.004))
    p.append(cyl("bc_glass", mat("M_lens", (0.2, 0.5, 0.6), 0.1), 0.04, 0.005, loc=(0, -0.222, 1.45), rot=(math.pi / 2, 0, 0), seg=20))
    p.append(box("bc_cloth", LEATHER, (0.3, 0.08, 0.3), loc=(0, 0.25, 1.44), bev=0.02))
    for k in range(3):   # tripod
        a = k * 2 * math.pi / 3 + 0.5
        p.append(tube(f"bc_leg{k}", [(0, 0.05, 1.32), (math.cos(a) * 0.45, math.sin(a) * 0.45 + 0.05, 0.0)], 0.018, WOOD_DK, seg=6))
    p.append(tube("bc_flashpole", [(0.14, 0.12, 1.5), (0.22, 0.1, 1.72)], 0.008, IRON, seg=5))
    p.append(lathe("bc_flashpan", [(0.0, 0.0), (0.07, 0.01), (0.08, 0.025), (0.0, 0.02)], IRON, seg=14))
    p[-1].location = (0.23, 0.1, 1.73); apply_tf(p[-1])
    return group("box_camera", [join(p, "bc_body")], [empty("flash_pan", (0.23, 0.1, 1.77)), empty("lens", (0, -0.23, 1.45))])

def candles():
    p = []; anchors = []
    for k, (x, y, h) in enumerate([(0, 0, 0.3), (0.09, 0.04, 0.22), (-0.08, 0.05, 0.18), (0.03, -0.08, 0.14)]):
        p.append(cyl(f"cn_c{k}", WAX, 0.035, h, loc=(x, y, h / 2), seg=12))
        p.append(tube(f"cn_drip{k}", [(x + 0.03, y - 0.015, h - 0.01), (x + 0.036, y - 0.02, h - 0.08)], 0.008, WAX, seg=5))
        p.append(cyl(f"cn_w{k}", IRON, 0.003, 0.02, loc=(x, y, h + 0.01), seg=4))
        anchors.append(empty(f"flame_c{k}", (x, y, h + 0.02)))
    p.append(cyl("cn_pool", WAX, 0.16, 0.012, loc=(0, 0, 0.006), seg=20))
    return group("candles", [join(p, "cn_body")], anchors)

def skull():
    p = [prim("uv", "sk_head", BONE, loc=(0, 0, 0.11), scale=(0.1, 0.11, 0.1), segments=16, ring_count=10),
         box("sk_jaw", BONE, (0.11, 0.08, 0.05), loc=(0, -0.05, 0.03), bev=0.015)]
    for sx in (-1, 1): p.append(prim("uv", f"sk_eye{sx}", IRON, loc=(sx * 0.035, -0.095, 0.12), scale=(0.028, 0.02, 0.03), segments=10, ring_count=6))
    p.append(prim("cone", "sk_nose", IRON, loc=(0, -0.105, 0.075), rot=(math.pi / 2, 0, 0), radius1=0.015, radius2=0.0, depth=0.02, vertices=3))
    return keep(join(p, "skull"))

def mushrooms():
    p = []
    for k, (x, y, s) in enumerate([(0, 0, 1.0), (0.12, 0.05, 0.7), (-0.1, 0.08, 0.55), (0.05, -0.1, 0.45)]):
        p.append(cyl(f"ms_stem{k}", SHROOM_STEM, 0.02 * s, 0.14 * s, loc=(x, y, 0.07 * s), seg=8))
        cap = prim("uv", f"ms_cap{k}", SHROOM, loc=(x, y, 0.14 * s), scale=(0.07 * s, 0.07 * s, 0.045 * s), segments=14, ring_count=8)
        for v in cap.data.vertices:
            if v.co.z < 0.14 * s: v.co.z = 0.14 * s - (0.14 * s - v.co.z) * 0.2
        p.append(cap)
    return keep(join(p, "mushrooms"))

def rock():
    r = prim("ico", "rock", STONE_DK, loc=(0, 0, 0.12), scale=(0.3, 0.24, 0.18), subdivisions=2)
    for v in r.data.vertices: v.co *= 0.85 + random.random() * 0.3
    return keep(r)

# ── the haunted mansion ───────────────────────────────────
def mansion():
    p = []
    W, D, H1, H2 = 8.0, 5.0, 3.2, 3.0
    p.append(box("mn_found", STONE_DK, (W + 0.4, D + 0.4, 0.6), loc=(0, 0, 0.3), bev=0.03))
    p.append(box("mn_floor1", WALL, (W, D, H1), loc=(0, 0, 0.6 + H1 / 2), bev=0.03))
    p.append(box("mn_band", TRIM, (W + 0.2, D + 0.2, 0.18), loc=(0, 0, 0.6 + H1), bev=0.02))
    p.append(box("mn_floor2", WALL_DK, (W - 0.6, D - 0.4, H2), loc=(0, 0, 0.6 + H1 + H2 / 2), bev=0.03, rot=(0, 0.02, 0)))
    # crooked gable roof
    roof = prof("mn_roof", [(-W / 2 - 0.4, 0), (W / 2 + 0.4, 0), (0.3, 2.8)], D + 0.6, ROOF, bev=0.03)
    roof.location = (0, 0, 0.6 + H1 + H2); apply_tf(roof); p.append(roof)
    # front gable over the door
    gable = prof("mn_gable", [(-1.6, 0), (1.6, 0), (0, 1.5)], 0.4, WALL_DK, y=-D / 2 + 0.1)
    gable.location = (0, 0, 0.6 + H1 + 0.1); apply_tf(gable); p.append(gable)
    # the tower (left), with a witch-hat roof
    tx = -W / 2 + 0.6
    p.append(cyl("mn_tower", WALL, 1.25, 9.0, loc=(tx, -D / 2 + 0.6, 4.5), seg=12))
    p.append(cyl("mn_towerband", TRIM, 1.32, 0.18, loc=(tx, -D / 2 + 0.6, 7.0), seg=12))
    cone = prim("cone", "mn_towerroof", ROOF, loc=(tx, -D / 2 + 0.6, 10.2), radius1=1.55, radius2=0.0, depth=2.6, vertices=12)
    for v in cone.data.vertices:   # a little crooked tip
        if v.co.z > 0.5: v.co.x += (v.co.z - 0.5) * 0.25
    p.append(cone)
    p.append(cyl("mn_vane", IRON, 0.02, 0.8, loc=(tx + 0.35, -D / 2 + 0.6, 11.8), seg=6))
    # chimney, crooked
    p.append(box("mn_chim", STONE, (0.6, 0.6, 2.2), loc=(2.6, 0.6, 0.6 + H1 + H2 + 1.4), rot=(0, 0.12, 0), bev=0.02))
    # porch: deck, steps, columns, roof
    p.append(box("mn_porch", WOOD_DK, (3.4, 1.8, 0.2), loc=(0.6, -D / 2 - 0.9, 0.6), bev=0.02))
    for k in range(3): p.append(box(f"mn_step{k}", WOOD, (1.8, 0.35, 0.2), loc=(0.6, -D / 2 - 1.95 - k * 0.32, 0.45 - k * 0.2), bev=0.015))
    for sx in (-1, 1): p.append(cyl(f"mn_pcol{sx}", WOOD, 0.08, 2.4, loc=(0.6 + sx * 1.5, -D / 2 - 1.65, 1.9), seg=10))
    proof = prof("mn_proof", [(-1.95, 0), (1.95, 0), (1.95, 0.12), (0, 0.6), (-1.95, 0.12)], 2.0, ROOF)
    proof.location = (0.6, -D / 2 - 0.9, 3.1); apply_tf(proof); p.append(proof)
    for k in range(5): p.append(box(f"mn_rail{k}", WOOD, (0.04, 0.04, 0.6), loc=(-0.8 + k * 0.25 if k < 3 else 1.8 + (k - 3) * 0.25, -D / 2 - 1.75, 1.0), bev=0.005))
    # the door
    p.append(box("mn_doorframe", TRIM, (1.2, 0.1, 2.3), loc=(0.6, -D / 2 - 0.02, 1.85), bev=0.02))
    p.append(box("mn_door", WOOD_DK, (1.0, 0.1, 2.1), loc=(0.6, -D / 2 - 0.05, 1.75), bev=0.015))
    p.append(prim("uv", "mn_knob", BRASS, loc=(0.92, -D / 2 - 0.11, 1.7), scale=(0.04,) * 3, segments=10, ring_count=6))
    # windows: frames, glowing panes (some boarded), shutters askew
    wins = [(-2.6, 2.1, True), (2.7, 2.1, True), (-2.6, 5.2, False), (0.6, 5.2, True), (2.7, 5.2, True), (tx, 3.4, True), (tx, 6.0, False), (tx, 8.0, True)]
    for k, (x, z, lit) in enumerate(wins):
        on_tower = abs(x - tx) < 0.01
        y = (-D / 2 + 0.6 - 1.24) if on_tower else (-D / 2 - 0.02 if z < 4 else -D / 2 + 0.18)
        w, h = (0.6, 1.0) if on_tower else (0.9, 1.3)
        p.append(box(f"mn_wf{k}", TRIM, (w + 0.16, 0.12, h + 0.16), loc=(x, y, z), bev=0.015))
        pane = GLOW if (lit and k % 3) else (GLOW_G if lit else IRON)
        p.append(box(f"mn_wp{k}", pane, (w, 0.13, h), loc=(x, y - 0.005, z), bev=0.0))
        p.append(box(f"mn_wbar{k}", TRIM, (0.04, 0.14, h), loc=(x, y - 0.01, z), bev=0.0))
        p.append(box(f"mn_wbar2{k}", TRIM, (w, 0.14, 0.04), loc=(x, y - 0.01, z), bev=0.0))
        if not on_tower:
            p.append(move(box(f"mn_shut{k}", WOOD_DK, (0.35, 0.05, h + 0.1), bev=0.01), (x - w / 2 - 0.25, y - 0.05, z), (0, 0.15 * (1 if k % 2 else -1), 0)))
        if not lit:   # boarded up
            for b in range(2): p.append(move(box(f"mn_board{k}{b}", WOOD, (w + 0.2, 0.05, 0.12), bev=0.008), (x, y - 0.08, z - 0.2 + b * 0.4), (0, 0.3 * (1 if b else -1), 0)))
    # round attic window in the gable
    p.append(cyl("mn_attic", GLOW_G, 0.32, 0.12, loc=(0, -D / 2 - 0.12, 0.6 + H1 + 0.75), rot=(math.pi / 2, 0, 0), seg=20))
    p.append(smooth(prim("torus", "mn_atticring", TRIM, loc=(0, -D / 2 - 0.16, 0.6 + H1 + 0.75), rot=(math.pi / 2, 0, 0), major_radius=0.34, minor_radius=0.05, major_segments=24, minor_segments=6)))
    body = join(p, "mansion_body")
    return group("mansion", [body], [empty("mansion_door", (0.6, -D / 2 - 0.2, 0.7)), empty("smoke", (2.75, 0.6, 0.6 + H1 + H2 + 2.6))])

for kind in ("round", "gothic", "cross", "small"): tombstone(f"tomb_{kind}", kind)
dirt_mound(); fence_section(); gate(); dead_tree()
pumpkin("pumpkin_giant", 0.62, giant=True); pumpkin("pumpkin", 0.2); pumpkin("pumpkin_tall", 0.17, ribs=7, squash=1.05)
cauldron(); coffin_mailbox(); crypt(); lamp_post(); gramophone(); bat(); crow(); candy_bucket(); box_camera(); candles(); skull(); mushrooms(); rock()
mansion()
finish(OUT, PREVIEW, cols=6, cell=3.0, bg=(0.18, 0.15, 0.24))

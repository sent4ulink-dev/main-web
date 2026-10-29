# Tactical-themed props for Birthday web 3 — ORIGINAL designs made in Blender for this project (no game assets).
# Run: blender -b --factory-startup --python tactical_props.py -- <out.glb> [preview.png]
#
# Floor props stand on z = 0, front facing -Y (glTF +Z). Moving parts sit under pivot empties (salon_lib.pivot).
#   rifle      — a stylised, generic tactical rifle (not a replica of any real or game weapon); along +X, origin at
#                the grip; empties `muzzle` and `ejection`
#   party_timer — a toy "party timer": display window (`display` empty), keypad, three wires, party poppers, a bow;
#                `timer_led` blinks
#   field_radio — antenna, speaker grille (`speaker` empty), dial, `radio_knob` (pivot), a handset on a coiled cord
#   loot_case  — a long carry case; `loot_case_lid` hinges at the back; `items` empty above the open case
#   footlocker — the big olive trunk; `footlocker_lid` hinges at the back
import bpy, bmesh, sys, math, os, random
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector, Matrix

OUT, PREVIEW = args()
start()
random.seed(5)

CRATE = mat("M_crate", (0.66, 0.46, 0.26), 0.8)
CRATE_DK = mat("M_crate_dark", (0.46, 0.31, 0.17), 0.8)
OLIVE = mat("M_olive", (0.33, 0.37, 0.21), 0.6)
OLIVE_DK = mat("M_olive_dark", (0.22, 0.25, 0.14), 0.6)
CASE_BLK = mat("M_case_black", (0.13, 0.13, 0.14), 0.5)
STEEL = mat("M_steel", (0.6, 0.62, 0.65), 0.35, 0.8)
GUNMETAL = mat("M_gunmetal", (0.17, 0.18, 0.2), 0.4, 0.6)
POLY = mat("M_polymer", (0.14, 0.14, 0.15), 0.6)
TAN = mat("M_tan", (0.72, 0.6, 0.42), 0.6)
ORANGE = mat("M_orange", (0.98, 0.5, 0.1), 0.5)
RED_W = mat("M_wire_red", (0.85, 0.12, 0.12), 0.4)
BLUE_W = mat("M_wire_blue", (0.12, 0.35, 0.85), 0.4)
YEL_W = mat("M_wire_yellow", (0.95, 0.8, 0.12), 0.4)
LED = mat("M_led", (1.0, 0.15, 0.1), 0.3, emit=(1.0, 0.1, 0.05))
SCREEN = mat("M_screen", (0.05, 0.08, 0.06), 0.2)
SANDBAG = mat("M_sandbag", (0.78, 0.67, 0.47), 0.9)
RUBBER = mat("M_rubber", (0.07, 0.07, 0.07), 0.8)
LENS = mat("M_lens", (0.2, 0.55, 0.65), 0.1)
BRASS = mat("M_brass", (0.9, 0.68, 0.28), 0.3, 0.85)
FOAM = mat("M_foam", (0.2, 0.2, 0.22), 0.95)
CHALK = mat("M_chalk", (0.12, 0.15, 0.13), 0.9)
RUST = mat("M_rust", (0.55, 0.33, 0.18), 0.8)

def move(ob, loc, rot=None):
    if rot: ob.rotation_euler = rot
    ob.location = loc; apply_tf(ob); return ob

def edges_frame(name, w, d, h, t, material, z0=0.0, inset=0.0):
    """Battens along all 12 edges of a w×d×h box (slightly proud of its faces)."""
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box(f"{name}_v{sx}{sy}", material, (t, t, h), loc=(sx * (w / 2 - inset), sy * (d / 2 - inset), z0 + h / 2), bev=0.004))
        for sz in (0, 1):
            parts.append(box(f"{name}_x{sx}{sz}", material, (t, d, t), loc=(sx * (w / 2 - inset), 0, z0 + sz * h + (t / 2 if sz == 0 else -t / 2)), bev=0.004))
    for sy in (-1, 1):
        for sz in (0, 1):
            parts.append(box(f"{name}_y{sy}{sz}", material, (w, t, t), loc=(0, sy * (d / 2 - inset), z0 + sz * h + (t / 2 if sz == 0 else -t / 2)), bev=0.004))
    return parts

# ── crates and cases ─────────────────────────────────────
def crate(name, w, d, h):
    p = [box(f"{name}_body", CRATE, (w - 0.02, d - 0.02, h - 0.02), loc=(0, 0, h / 2), bev=0.006)]
    for k in range(1, 4):   # plank seams
        z = h * k / 4
        for sy in (-1, 1): p.append(box(f"{name}_seam{k}{sy}", CRATE_DK, (w - 0.06, 0.004, 0.008), loc=(0, sy * (d / 2 - 0.009), z), bev=0))
        for sx in (-1, 1): p.append(box(f"{name}_seamS{k}{sx}", CRATE_DK, (0.004, d - 0.06, 0.008), loc=(sx * (w / 2 - 0.009), 0, z), bev=0))
    p += edges_frame(name, w, d, h, 0.055, CRATE_DK)
    for sx in (-1, 1):          # rope handles on the sides
        hd = prim("torus", f"{name}_rope{sx}", CANVAS_ROPE, loc=(sx * (w / 2 + 0.012), 0, h * 0.62), rot=(0, math.pi / 2, 0), major_radius=0.07, minor_radius=0.012, major_segments=16, minor_segments=6)
        p.append(smooth(hd))
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (0, 1):
                p.append(box(f"{name}_corner{sx}{sy}{sz}", STEEL, (0.07, 0.07, 0.07), loc=(sx * (w / 2 - 0.02), sy * (d / 2 - 0.02), 0.035 + sz * (h - 0.07)), bev=0.008))
    return keep(join(p, name))

CANVAS_ROPE = mat("M_rope", (0.7, 0.6, 0.42), 0.9)

def ammo_box():
    p = [box("ab_body", OLIVE, (0.3, 0.15, 0.17), loc=(0, 0, 0.085), bev=0.01),
         box("ab_lid", OLIVE_DK, (0.31, 0.16, 0.035), loc=(0, 0, 0.18), bev=0.008),
         box("ab_latch", STEEL, (0.05, 0.012, 0.06), loc=(0.12, -0.082, 0.15), bev=0.004)]
    p.append(tube("ab_handle", [(-0.06, 0, 0.198), (-0.05, 0, 0.225), (0.05, 0, 0.225), (0.06, 0, 0.198)], 0.006, STEEL, seg=6))
    for k in range(3): p.append(box(f"ab_rib{k}", OLIVE_DK, (0.006, 0.152, 0.13), loc=(-0.1 + k * 0.1, 0, 0.08), bev=0.002))
    return keep(join(p, "ammo_box"))

def hard_case():
    p = [box("hc_body", CASE_BLK, (0.62, 0.42, 0.13), loc=(0, 0, 0.065), bev=0.03),
         box("hc_lid", CASE_BLK, (0.63, 0.43, 0.08), loc=(0, 0, 0.17), bev=0.03)]
    for k in range(4): p.append(box(f"hc_rib{k}", POLY, (0.5, 0.012, 0.012), loc=(0, -0.12 + k * 0.08, 0.212), bev=0.004))
    for sx in (-1, 1): p.append(box(f"hc_latch{sx}", ORANGE, (0.06, 0.02, 0.05), loc=(sx * 0.18, -0.218, 0.13), bev=0.006))
    p.append(tube("hc_handle", [(-0.08, -0.215, 0.11), (-0.08, -0.25, 0.1), (0.08, -0.25, 0.1), (0.08, -0.215, 0.11)], 0.012, POLY, seg=6))
    return keep(join(p, "hard_case"))

def footlocker():
    W, D, H = 1.36, 0.62, 0.46
    body = [box("fl_body", OLIVE, (W, D, H), loc=(0, 0, H / 2), bev=0.012)]
    body += edges_frame("fl_edge", W, D, H, 0.035, STEEL, inset=0.004)
    for sx in (-1, 1):
        body.append(tube(f"fl_handle{sx}", [(sx * (W / 2 + 0.005), -0.08, 0.3), (sx * (W / 2 + 0.05), -0.07, 0.27), (sx * (W / 2 + 0.05), 0.07, 0.27), (sx * (W / 2 + 0.005), 0.08, 0.3)], 0.012, STEEL, seg=6))
    for sx in (-1, 1): body.append(box(f"fl_latch{sx}", STEEL, (0.08, 0.02, 0.07), loc=(sx * 0.4, -D / 2 - 0.01, H - 0.04), bev=0.006))
    b = join(body, "fl_body")
    lid = [box("fl_lid", OLIVE_DK, (W + 0.02, D + 0.02, 0.09), loc=(0, 0, H + 0.045), bev=0.014)]
    lid += edges_frame("fl_lidedge", W + 0.02, D + 0.02, 0.09, 0.03, STEEL, z0=H, inset=0.004)
    lid.append(box("fl_chalk", CHALK, (W - 0.12, 0.006, 0.0001 + 0.001), loc=(0, 0, H + 0.002), bev=0))
    lid = join(lid, "footlocker_lid")
    bpy.context.scene.cursor.location = (0, D / 2 + 0.01, H)
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    lid = pivot(lid)
    return group("footlocker", [b, lid])

def loot_case():
    W, D, H = 0.9, 0.34, 0.1
    body = [box("lc_body", CASE_BLK, (W, D, H), loc=(0, 0, H / 2), bev=0.02),
            box("lc_foam", FOAM, (W - 0.06, D - 0.06, 0.01), loc=(0, 0, H - 0.004), bev=0)]
    for sx in (-1, 1): body.append(box(f"lc_latch{sx}", ORANGE, (0.07, 0.02, 0.05), loc=(sx * 0.28, -D / 2 - 0.006, H - 0.005), bev=0.006))
    body.append(box("lc_stripe", ORANGE, (W + 0.004, D + 0.004, 0.012), loc=(0, 0, H - 0.03), bev=0.002))
    b = join(body, "lc_body")
    lid = [box("lc_lid", CASE_BLK, (W + 0.01, D + 0.01, 0.07), loc=(0, 0, H + 0.035), bev=0.025)]
    for k in range(5): lid.append(box(f"lc_rib{k}", POLY, (0.012, D - 0.04, 0.01), loc=(-0.3 + k * 0.15, 0, H + 0.074), bev=0.003))
    lid.append(box("lc_badge", ORANGE, (0.12, 0.08, 0.006), loc=(0, 0, H + 0.074), bev=0.003))
    lid = join(lid, "loot_case_lid")
    bpy.context.scene.cursor.location = (0, D / 2, H)
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    lid = pivot(lid)
    return group("loot_case", [b, lid], [empty("items", (0, 0, H + 0.22))])

# ── gear ─────────────────────────────────────────────────
def rifle():
    p = []
    p.append(box("rf_receiver", GUNMETAL, (0.32, 0.05, 0.075), loc=(0.02, 0, 0.0), bev=0.008))
    p.append(box("rf_rail", POLY, (0.34, 0.03, 0.012), loc=(0.06, 0, 0.044), bev=0.002))
    for k in range(14): p.append(box(f"rf_tooth{k}", POLY, (0.008, 0.034, 0.008), loc=(-0.1 + k * 0.024, 0, 0.053), bev=0))
    p.append(box("rf_guard", TAN, (0.3, 0.058, 0.064), loc=(0.32, 0, 0.004), bev=0.012))
    for k in range(5): p.append(box(f"rf_slot{k}", POLY, (0.03, 0.06, 0.016), loc=(0.22 + k * 0.05, 0, 0.004), bev=0.004))
    p.append(cyl("rf_barrel", GUNMETAL, 0.011, 0.2, loc=(0.56, 0, 0.006), rot=(0, math.pi / 2, 0), seg=12))
    p.append(cyl("rf_brake", GUNMETAL, 0.019, 0.065, loc=(0.67, 0, 0.006), rot=(0, math.pi / 2, 0), seg=12, bev=0.003))
    for k in range(3): p.append(box(f"rf_port{k}", POLY, (0.008, 0.042, 0.006), loc=(0.65 + k * 0.016, 0, 0.022), bev=0))
    p.append(box("rf_stock", TAN, (0.2, 0.044, 0.06), loc=(-0.24, 0, -0.008), bev=0.012))
    p.append(box("rf_stockbar", POLY, (0.16, 0.03, 0.018), loc=(-0.22, 0, -0.06), bev=0.006))
    p.append(box("rf_butt", RUBBER, (0.03, 0.05, 0.13), loc=(-0.355, 0, -0.03), bev=0.01))
    p.append(move(box("rf_grip", POLY, (0.036, 0.042, 0.11), loc=(0, 0, 0), bev=0.01), (-0.045, 0, -0.08), (0, math.radians(-14), 0)))
    p.append(smooth(prim("torus", "rf_tguard", POLY, loc=(0.015, 0, -0.045), rot=(math.pi / 2, 0, 0), major_radius=0.028, minor_radius=0.005, major_segments=16, minor_segments=6)))
    p.append(move(box("rf_mag", TAN, (0.052, 0.03, 0.14), loc=(0, 0, 0), bev=0.008), (0.085, 0, -0.1), (0, math.radians(10), 0)))
    p.append(move(box("rf_mag2", TAN, (0.05, 0.03, 0.05), loc=(0, 0, 0), bev=0.008), (0.1, 0, -0.18), (0, math.radians(22), 0)))
    p.append(box("rf_mount", POLY, (0.06, 0.03, 0.02), loc=(0.04, 0, 0.065), bev=0.004))
    p.append(cyl("rf_optic", POLY, 0.022, 0.08, loc=(0.04, 0, 0.095), rot=(0, math.pi / 2, 0), seg=16, bev=0.003))
    p.append(cyl("rf_lens", LENS, 0.019, 0.004, loc=(0.082, 0, 0.095), rot=(0, math.pi / 2, 0), seg=16))
    p.append(cyl("rf_lensb", LENS, 0.019, 0.004, loc=(-0.002, 0, 0.095), rot=(0, math.pi / 2, 0), seg=16))
    for sy in (-1, 1):   # bipod, deployed
        p.append(tube(f"rf_bipod{sy}", [(0.42, 0, -0.03), (0.45, sy * 0.06, -0.12), (0.47, sy * 0.1, -0.2)], 0.007, POLY, seg=6))
        p.append(prim("uv", f"rf_foot{sy}", RUBBER, loc=(0.47, sy * 0.1, -0.2), scale=(0.014, 0.014, 0.01), segments=8, ring_count=5))
    body = join(p, "rf_body")
    return group("rifle", [body], [empty("muzzle", (0.71, 0, 0.006)), empty("ejection", (0.05, 0.03, 0.025))])

def party_timer():
    p = [box("pt_body", OLIVE_DK, (0.26, 0.14, 0.075), loc=(0, 0, 0.0375), bev=0.012),
         box("pt_panel", CASE_BLK, (0.15, 0.006, 0.05), loc=(-0.035, -0.072, 0.04), bev=0.004)]
    for r in range(3):
        for c in range(3):
            p.append(box(f"pt_key{r}{c}", STEEL, (0.016, 0.006, 0.012), loc=(0.07 + c * 0.02, -0.072, 0.058 - r * 0.017), bev=0.002))
    for k, m in enumerate((RED_W, BLUE_W, YEL_W)):
        y = -0.03 + k * 0.03
        p.append(tube(f"pt_wire{k}", smooth_path([(-0.12, y, 0.07), (-0.07, y - 0.01, 0.11 + k * 0.01), (0.03, y + 0.01, 0.1), (0.11, y, 0.07)], 6), 0.005, m, seg=6))
    for k, m in enumerate((GOLD, ROSE, COBALT)):   # party poppers strapped on top
        cone = prim("cone", f"pt_pop{k}", m, loc=(-0.06 + k * 0.06, 0.03, 0.12), rot=(math.radians(-70), 0, 0), radius1=0.022, radius2=0.006, depth=0.1, vertices=12)
        p.append(cone)
    p.append(box("pt_tape", YEL_W, (0.22, 0.03, 0.01), loc=(0, 0.035, 0.085), bev=0.002))
    for sx in (-1, 1):
        lp = smooth(prim("torus", f"pt_bow{sx}", ROSE_DK, loc=(sx * 0.03, -0.02, 0.1), rot=(math.pi / 2, 0.3 * sx, 0), major_radius=0.026, minor_radius=0.007, major_segments=16, minor_segments=6))
        p.append(lp)
    p.append(prim("uv", "pt_knot", ROSE_DK, loc=(0, -0.02, 0.095), scale=(0.014, 0.012, 0.012), segments=10, ring_count=6))
    body = join(p, "pt_body")
    led = prim("uv", "timer_led", LED, loc=(0.1, -0.074, 0.065), scale=(0.006, 0.006, 0.006), segments=10, ring_count=6)
    return group("party_timer", [body, pivot(led)], [empty("display", (-0.035, -0.0755, 0.04))])

def field_radio():
    p = [box("fr_body", OLIVE, (0.34, 0.16, 0.26), loc=(0, 0, 0.13), bev=0.02),
         box("fr_panel", OLIVE_DK, (0.3, 0.01, 0.2), loc=(0, -0.082, 0.13), bev=0.006)]
    p.append(cyl("fr_grille", CASE_BLK, 0.065, 0.012, loc=(-0.07, -0.088, 0.13), rot=(math.pi / 2, 0, 0), seg=28))
    for k in range(1, 5):
        p.append(smooth(prim("torus", f"fr_ring{k}", POLY, loc=(-0.07, -0.094, 0.13), rot=(math.pi / 2, 0, 0), major_radius=0.014 * k, minor_radius=0.003, major_segments=24, minor_segments=4)))
    p.append(box("fr_dial", LENS, (0.1, 0.008, 0.05), loc=(0.07, -0.088, 0.18), bev=0.004))
    p.append(cyl("fr_knob2", POLY, 0.016, 0.03, loc=(0.11, -0.095, 0.09), rot=(math.pi / 2, 0, 0), seg=14, bev=0.003))
    p.append(tube("fr_handle", [(-0.12, 0, 0.26), (-0.11, 0, 0.31), (0.11, 0, 0.31), (0.12, 0, 0.26)], 0.012, POLY, seg=6))
    p.append(tube("fr_antenna", [(0.14, 0.04, 0.26), (0.15, 0.045, 0.5), (0.17, 0.05, 0.72)], 0.005, POLY, seg=6))
    p.append(prim("uv", "fr_tip", POLY, loc=(0.17, 0.05, 0.725), scale=(0.012, 0.012, 0.012), segments=10, ring_count=6))
    # handset hanging on the side, on a coiled cord
    p.append(move(box("fr_handset", POLY, (0.04, 0.05, 0.17), loc=(0, 0, 0), bev=0.015), (-0.2, -0.02, 0.17), (0, math.radians(8), 0)))
    coil = [(-0.19 + 0.012 * math.cos(t * 10), -0.03 + 0.012 * math.sin(t * 10), 0.08 - 0.06 * t) for t in [k / 60 for k in range(61)]]
    p.append(tube("fr_cord", coil, 0.003, POLY, seg=4))
    body = join(p, "fr_body")
    knob = cyl("radio_knob", POLY, 0.022, 0.03, loc=(0.06, -0.095, 0.09), rot=(math.pi / 2, 0, 0), seg=16, bev=0.003)
    return group("field_radio", [body, pivot(knob)], [empty("speaker", (-0.07, -0.1, 0.13)), empty("antenna_tip", (0.17, 0.05, 0.73))])

def helmet():
    p = [prim("uv", "hm_shell", OLIVE, loc=(0, 0, 0.0), scale=(0.13, 0.15, 0.13), segments=28, ring_count=14)]
    bm_cut = p[0]
    # keep only the top half: squash the lower verts up to the rim
    for v in bm_cut.data.vertices:
        if v.co.z < 0.02: v.co.z = 0.02
    p.append(smooth(prim("torus", "hm_rim", OLIVE_DK, loc=(0, 0, 0.022), major_radius=0.138, minor_radius=0.01, major_segments=32, minor_segments=6)))
    for sx in (-1, 1): p.append(box(f"hm_rail{sx}", POLY, (0.012, 0.12, 0.025), loc=(sx * 0.125, 0, 0.06), bev=0.004))
    p.append(box("hm_mount", POLY, (0.05, 0.02, 0.04), loc=(0, -0.145, 0.08), bev=0.006))
    # goggles resting on the brow
    p.append(smooth(prim("torus", "hm_strap", RUBBER, loc=(0, 0, 0.09), rot=(math.radians(18), 0, 0), major_radius=0.135, minor_radius=0.009, major_segments=32, minor_segments=6)))
    for sx in (-1, 1):
        p.append(move(prim("uv", f"hm_lens{sx}", LENS, loc=(0, 0, 0), scale=(0.045, 0.02, 0.032), segments=16, ring_count=8), (sx * 0.05, -0.135, 0.1)))
        p.append(move(prim("torus", f"hm_lensrim{sx}", RUBBER, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), major_radius=0.042, minor_radius=0.008, major_segments=20, minor_segments=6), (sx * 0.05, -0.13, 0.1)))
    h = join(p, "helmet")
    h.location.z = -0.02; apply_tf(h)
    return keep(h)

def sandbag():
    sb = prim("uv", "sandbag", SANDBAG, loc=(0, 0, 0.065), scale=(0.24, 0.13, 0.07), segments=20, ring_count=10)
    for v in sb.data.vertices:
        n = 1 + 0.06 * math.sin(v.co.x * 40) * math.cos(v.co.y * 30)
        v.co.x *= n; v.co.y *= n
        if v.co.z < 0.0: v.co.z *= 0.4      # flat bottom
    sb.location.z = 0.0; apply_tf(sb)
    return keep(smooth(sb, 70))

def barrel():
    p = [lathe("br_body", [(0.0, 0.0), (0.28, 0.0), (0.29, 0.02), (0.29, 0.86), (0.28, 0.88), (0.0, 0.88)], OLIVE_DK, seg=32)]
    for z in (0.2, 0.44, 0.68):
        p.append(smooth(prim("torus", f"br_rib{z}", OLIVE, loc=(0, 0, z), major_radius=0.292, minor_radius=0.012, major_segments=40, minor_segments=6)))
    p.append(cyl("br_cap", STEEL, 0.035, 0.02, loc=(0.15, 0.05, 0.885), seg=12))
    return keep(join(p, "barrel"))

def jerrycan():
    p = [box("jc_body", RUST, (0.34, 0.16, 0.46), loc=(0, 0, 0.23), bev=0.025),
         box("jc_x1", RUST, (0.3, 0.17, 0.02), loc=(0, 0, 0.23), rot=(0, 0.9, 0), bev=0.006),
         box("jc_x2", RUST, (0.3, 0.17, 0.02), loc=(0, 0, 0.23), rot=(0, -0.9, 0), bev=0.006),
         cyl("jc_spout", STEEL, 0.03, 0.05, loc=(0.12, 0, 0.48), seg=12)]
    for k in range(3): p.append(box(f"jc_h{k}", RUST, (0.03, 0.03, 0.06), loc=(-0.1 + k * 0.08, 0, 0.49), bev=0.006))
    return keep(join(p, "jerrycan"))

def grenades():
    # smoke canister: the coloured band is its own material (the app tints it per grenade)
    BAND = mat("M_band", (0.95, 0.4, 0.6), 0.5)
    p = [cyl("gs_can", OLIVE_DK, 0.032, 0.12, loc=(0, 0, 0.06), seg=20, bev=0.004),
         cyl("gs_band", BAND, 0.0325, 0.025, loc=(0, 0, 0.08), seg=20),
         cyl("gs_top", STEEL, 0.02, 0.02, loc=(0, 0, 0.128), seg=14)]
    p.append(box("gs_spoon", STEEL, (0.012, 0.01, 0.1), loc=(0.032, 0, 0.09), rot=(0, 0.12, 0), bev=0.003))
    p.append(smooth(prim("torus", "gs_ring", STEEL, loc=(-0.02, 0, 0.14), rot=(math.pi / 2, 0, 0), major_radius=0.014, minor_radius=0.0025, major_segments=16, minor_segments=4)))
    keep(join(p, "grenade_smoke"))
    # party grenade: a round "pineapple" with a ribbon bow — a toy
    q = [prim("uv", "gp_body", OLIVE, loc=(0, 0, 0.045), scale=(0.038, 0.038, 0.045), segments=16, ring_count=10)]
    for k in range(4):
        q.append(smooth(prim("torus", f"gp_groove{k}", OLIVE_DK, loc=(0, 0, 0.02 + k * 0.016), major_radius=0.035 - abs(k - 1.5) * 0.004, minor_radius=0.003, major_segments=20, minor_segments=4)))
    q.append(cyl("gp_fuse", STEEL, 0.012, 0.03, loc=(0, 0, 0.098), seg=12))
    for sx in (-1, 1):
        q.append(smooth(prim("torus", f"gp_bow{sx}", ROSE, loc=(sx * 0.016, 0, 0.12), rot=(math.pi / 2, 0.4 * sx, 0), major_radius=0.016, minor_radius=0.004, major_segments=14, minor_segments=4)))
    keep(join(q, "grenade_party"))
    r = [cyl("gf_can", STEEL, 0.025, 0.11, loc=(0, 0, 0.055), seg=18, bev=0.003)]
    for k in range(6):
        a = k * math.pi / 3
        r.append(cyl(f"gf_hole{k}", POLY, 0.006, 0.004, loc=(math.cos(a) * 0.025, math.sin(a) * 0.025, 0.06), rot=(0, math.pi / 2, a), seg=8))
    r.append(cyl("gf_top", POLY, 0.016, 0.02, loc=(0, 0, 0.118), seg=12))
    keep(join(r, "grenade_flash"))

def shell():
    s = [cyl("sh_case", BRASS, 0.0045, 0.024, loc=(0, 0, 0.012), seg=10), cyl("sh_rim", BRASS, 0.005, 0.002, loc=(0, 0, 0.001), seg=10)]
    return keep(join(s, "shell"))

crate("crate_big", 0.9, 0.62, 0.62)
crate("crate_small", 0.62, 0.5, 0.46)
ammo_box(); hard_case(); footlocker()
import tactical_extra; tactical_extra.build(globals())
field_radio(); helmet(); sandbag(); barrel(); jerrycan(); grenades(); shell()
finish(OUT, PREVIEW, cols=5, cell=1.6, bg=(0.5, 0.42, 0.33))

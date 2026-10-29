# The birthday tea table of an 18th-century Viennese salon (original models, made in Blender for Birthday web 2).
# Run: blender -b --factory-startup --python salon_table.py -- <out.glb> [preview.png]
#   cake          — three white tiers with rose-pink swags, sugar pearls and roses; `cake["top"]` = top height
#   teapot, cup, sugar_bowl, chocolate_pot — white porcelain with cobalt bands and gilt rims
#   cake_stand    — a three-tier silver stand with macarons and petits fours
#   pineapple     — the centrepiece of every grand Georgian / Viennese table
#   casket + casket_lid (origin on its hinge) — the wish casket
#   salver        — the silver tray the letter arrives on
#   candlestick, gift
import bpy, sys, math, os, random
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from salon_lib import *
from mathutils import Vector

OUT, PREVIEW = args()
start()
random.seed(7)

def move(ob, loc):
    ob.location = loc; apply_tf(ob); return ob

def pearls(name, R, z, n, r, material=PORCELAIN):
    return [prim("uv", f"{name}{i}", material, loc=(math.cos(2 * math.pi * i / n) * R, math.sin(2 * math.pi * i / n) * R, z), scale=(r, r, r), segments=8, ring_count=5) for i in range(n)]

def sugar_rose(name, loc, r, material):
    parts = [prim("uv", name + "c", material, loc=(0, 0, r * 0.3), scale=(r * 0.5, r * 0.5, r * 0.5), segments=10, ring_count=6)]
    for k in range(5):
        a = 2 * math.pi * k / 5
        parts.append(prim("uv", f"{name}p{k}", material, loc=(math.cos(a) * r * 0.42, math.sin(a) * r * 0.42, r * 0.12), scale=(r * 0.48, r * 0.16, r * 0.45), segments=8, ring_count=5, rot=(math.radians(-25), 0, a + math.pi / 2)))
    ro = join(parts, name)
    return move(ro, loc)

def cake():
    p = [lathe("ck_board", [(0.0, 0.0), (0.2, 0.0), (0.205, 0.012), (0.195, 0.018), (0.0, 0.018)], SILVER, seg=40)]
    z = 0.018
    tiers = [(0.16, 0.11), (0.115, 0.095), (0.075, 0.085)]
    for i, (r, h) in enumerate(tiers):
        p.append(lathe(f"ck_tier{i}", [(0.0, z), (r, z), (r * 1.01, z + 0.01), (r * 1.01, z + h - 0.012), (r * 0.98, z + h), (0.0, z + h)], CAKE, seg=48))
        # rose-pink swags round the side and a ring of sugar pearls at the base and the top edge
        n = 8 + i * -2 + 4
        for k in range(n):
            a0 = 2 * math.pi * k / n
            sw = [(math.cos(a0 + 2 * math.pi / n * t) * r * 1.03, math.sin(a0 + 2 * math.pi / n * t) * r * 1.03, z + h - 0.02 - 0.025 * math.sin(math.pi * t)) for t in [j / 8 for j in range(9)]]
            p.append(tube(f"ck_swag{i}_{k}", sw, 0.0055, ICING_PK, seg=6))
            p.append(prim("uv", f"ck_drop{i}_{k}", ICING_PK, loc=(math.cos(a0) * r * 1.035, math.sin(a0) * r * 1.035, z + h - 0.03), scale=(0.008, 0.008, 0.012), segments=8, ring_count=5))
        p += pearls(f"ck_pb{i}_", r * 1.012, z + 0.006, int(r * 160), 0.0055)
        p += pearls(f"ck_pt{i}_", r * 0.99, z + h - 0.002, int(r * 150), 0.0048)
        z += h
    top = z
    # sugar roses on the tiers' shoulders and a crown of roses on top
    for i, (r, h) in enumerate(tiers[:2]):
        zz = 0.018 + sum(t[1] for t in tiers[:i + 1])
        for k in range(5):
            a = 2 * math.pi * k / 5 + i
            p.append(sugar_rose(f"ck_rose{i}_{k}", (math.cos(a) * (r * 0.85), math.sin(a) * (r * 0.85), zz), 0.018, [ROSE, CREAM_ROSE, ROSE_DK][k % 3]))
    for k in range(3):
        a = 2 * math.pi * k / 3
        p.append(sugar_rose(f"ck_crown{k}", (math.cos(a) * 0.022, math.sin(a) * 0.022, top), 0.016, [ROSE, CREAM_ROSE, ROSE_DK][k]))
    ck = join(p, "cake")
    ck["top"] = top
    print("CAKE_TOP", top)
    return keep(ck)

def porcelain_body(name, prof):
    body = lathe(name, prof, PORCELAIN, seg=32)
    return body

def band(name, r, z, h=0.008, material=COBALT):
    return lathe(name, [(r, z), (r * 1.015, z + 0.001), (r * 1.015, z + h - 0.001), (r, z + h)], material, seg=32, cap_top=False, cap_bottom=False)

def teapot():
    p = [porcelain_body("tp_body", [(0.0, 0.0), (0.045, 0.0), (0.05, 0.006), (0.07, 0.03), (0.075, 0.06), (0.068, 0.09), (0.05, 0.11), (0.042, 0.115), (0.0, 0.115)])]
    p.append(band("tp_band", 0.074, 0.05))
    p.append(lathe("tp_lid", [(0.0, 0.112), (0.045, 0.112), (0.04, 0.125), (0.02, 0.135), (0.012, 0.14), (0.016, 0.15), (0.0, 0.158)], PORCELAIN, seg=24))
    p.append(lathe("tp_rim", [(0.043, 0.111), (0.047, 0.113), (0.047, 0.117), (0.043, 0.118)], GOLD, seg=24, cap_top=False, cap_bottom=False))
    p.append(tube("tp_spout", smooth_path([(0.06, 0, 0.04), (0.095, 0, 0.065), (0.115, 0, 0.1), (0.125, 0, 0.11)], 6), 1.0, PORCELAIN, seg=8, radii=None) if False else
             tube("tp_spout", smooth_path([(0.06, 0, 0.04), (0.095, 0, 0.065), (0.115, 0, 0.1), (0.128, 0, 0.112)], 6), 0.012, PORCELAIN, seg=8))
    p.append(smooth(prim("torus", "tp_handle", PORCELAIN, loc=(-0.078, 0, 0.065), rot=(math.pi / 2, 0, 0), major_radius=0.03, minor_radius=0.007, major_segments=20, minor_segments=8)))
    return keep(join(p, "teapot"))

def cup():
    p = [lathe("cu_saucer", [(0.0, 0.0), (0.03, 0.0), (0.06, 0.006), (0.068, 0.012), (0.066, 0.014), (0.0, 0.01)], PORCELAIN, seg=32)]
    p.append(lathe("cu_srim", [(0.066, 0.0118), (0.069, 0.0125), (0.069, 0.0145), (0.066, 0.015)], GOLD, seg=32, cap_top=False, cap_bottom=False))
    p.append(lathe("cu_cup", [(0.0, 0.01), (0.02, 0.01), (0.03, 0.02), (0.038, 0.045), (0.04, 0.058), (0.036, 0.058), (0.034, 0.046), (0.025, 0.024), (0.0, 0.022)], PORCELAIN, seg=32, cap_top=False))
    p.append(band("cu_band", 0.037, 0.04, 0.006))
    p.append(cyl("cu_tea", CHOCOLATE, 0.034, 0.002, loc=(0, 0, 0.05), seg=24))
    p.append(smooth(prim("torus", "cu_handle", PORCELAIN, loc=(0.043, 0, 0.04), rot=(math.pi / 2, 0, 0), major_radius=0.012, minor_radius=0.0035, major_segments=16, minor_segments=6)))
    return keep(join(p, "cup"))

def sugar_bowl():
    p = [lathe("sb_body", [(0.0, 0.0), (0.03, 0.0), (0.045, 0.02), (0.05, 0.045), (0.042, 0.06), (0.0, 0.06)], PORCELAIN, seg=28),
         band("sb_band", 0.049, 0.035), lathe("sb_lid", [(0.0, 0.06), (0.044, 0.06), (0.03, 0.075), (0.01, 0.08), (0.014, 0.09), (0.0, 0.095)], PORCELAIN, seg=24)]
    p.append(prim("uv", "sb_knob", GOLD, loc=(0, 0, 0.096), scale=(0.01, 0.01, 0.01), segments=10, ring_count=6))
    return keep(join(p, "sugar_bowl"))

def chocolate_pot():
    # tall silver pot with a straight wooden handle at a right angle to the spout (as in 18th-century Vienna)
    p = [lathe("cp_body", [(0.0, 0.0), (0.045, 0.0), (0.05, 0.01), (0.055, 0.08), (0.05, 0.15), (0.042, 0.17), (0.0, 0.17)], SILVER, seg=28),
         lathe("cp_lid", [(0.0, 0.168), (0.044, 0.168), (0.036, 0.18), (0.012, 0.19), (0.0, 0.2)], SILVER, seg=24),
         prim("uv", "cp_finial", GOLD, loc=(0, 0, 0.205), scale=(0.012, 0.012, 0.016), segments=10, ring_count=6),
         tube("cp_spout", smooth_path([(0.045, 0, 0.12), (0.07, 0, 0.14), (0.085, 0, 0.16)], 6), 0.009, SILVER, seg=8),
         cyl("cp_handle", WALNUT, 0.011, 0.12, loc=(0, -0.11, 0.1), rot=(math.pi / 2, 0, 0), seg=10),
         cyl("cp_socket", SILVER, 0.013, 0.03, loc=(0, -0.055, 0.1), rot=(math.pi / 2, 0, 0), seg=10)]
    return keep(join(p, "chocolate_pot"))

def macaron(name, loc, material, r=0.014):
    a = prim("uv", name + "a", material, loc=(loc[0], loc[1], loc[2] + r * 0.45), scale=(r, r, r * 0.42), segments=12, ring_count=6)
    b = prim("uv", name + "b", material, loc=(loc[0], loc[1], loc[2] + r * 1.15), scale=(r, r, r * 0.42), segments=12, ring_count=6)
    f = cyl(name + "f", CAKE, r * 0.85, r * 0.3, loc=(loc[0], loc[1], loc[2] + r * 0.8), seg=12)
    return [a, b, f]

def petit_four(name, loc, s=0.02, icing=ICING_PK):
    b = box(name, CAKE, (s, s, s * 0.8), loc=(loc[0], loc[1], loc[2] + s * 0.4), bev=0.003)
    t = box(name + "t", icing, (s * 1.02, s * 1.02, s * 0.25), loc=(loc[0], loc[1], loc[2] + s * 0.8), bev=0.004)
    c = prim("uv", name + "c", BERRY, loc=(loc[0], loc[1], loc[2] + s * 1.05), scale=(s * 0.18, s * 0.18, s * 0.18), segments=8, ring_count=5)
    return [b, t, c]

def cake_stand():
    p = [lathe("cs_col", [(0.0, 0.0), (0.06, 0.0), (0.065, 0.01), (0.02, 0.03), (0.012, 0.36), (0.02, 0.37), (0.0, 0.39)], SILVER, seg=24)]
    for i, (r, z) in enumerate([(0.15, 0.04), (0.115, 0.17), (0.08, 0.29)]):
        p.append(lathe(f"cs_plate{i}", [(0.0, z), (r * 0.6, z), (r, z + 0.012), (r * 1.02, z + 0.018), (r * 0.98, z + 0.016), (0.0, z + 0.006)], SILVER, seg=36))
        n = [9, 7, 4][i]
        for k in range(n):
            a = 2 * math.pi * k / n + i
            loc = (math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, z + 0.008)
            if (k + i) % 2: p += macaron(f"cs_mac{i}_{k}", loc, [MACARON_GN, MACARON_LV, ICING_PK][k % 3])
            else: p += petit_four(f"cs_pf{i}_{k}", loc, 0.022, [ICING_PK, MACARON_LV, CAKE][k % 3])
    return keep(join(p, "cake_stand"))

def pineapple():
    p = [lathe("pa_bowl", [(0.0, 0.0), (0.05, 0.0), (0.04, 0.02), (0.03, 0.05), (0.09, 0.08), (0.11, 0.1), (0.1, 0.105), (0.0, 0.09)], SILVER, seg=32)]
    body = lathe("pa_body", [(0.0, 0.09), (0.05, 0.095), (0.068, 0.13), (0.072, 0.17), (0.064, 0.21), (0.045, 0.24), (0.0, 0.245)], PINEAPPLE, seg=32)
    p.append(body)
    for k in range(40):   # the diamond scales
        a = k * 2.39996; t = (k + 0.5) / 40
        z = 0.1 + 0.135 * t; r = 0.07 * math.sin(math.pi * (0.15 + 0.75 * t)) + 0.004
        p.append(prim("uv", f"pa_scale{k}", GOLD_DK, loc=(math.cos(a) * r, math.sin(a) * r, z), scale=(0.008, 0.008, 0.008), segments=6, ring_count=4))
    for k in range(14):   # the crown of leaves
        a = 2 * math.pi * k / 14 + (0.2 if k % 2 else 0)
        tilt = 0.25 + 0.35 * (k % 2)
        lf = prim("cone", f"pa_leaf{k}", LEAF, loc=(math.cos(a) * 0.015, math.sin(a) * 0.015, 0.29 - 0.02 * (k % 2)), radius1=0.012, radius2=0.0, depth=0.11 - 0.02 * (k % 2), vertices=4,
                  rot=(tilt * math.sin(a) * -1, tilt * math.cos(a), 0))
        lf.scale = (1, 0.35, 1); apply_tf(lf)
        p.append(lf)
    for k in range(10):   # grapes spilling round the bowl
        a = 2 * math.pi * k / 10
        p.append(prim("uv", f"pa_grape{k}", MACARON_LV if k % 3 else BERRY, loc=(math.cos(a) * 0.085, math.sin(a) * 0.085, 0.11), scale=(0.014, 0.014, 0.014), segments=10, ring_count=6))
    return keep(join(p, "pineapple"))

def casket():
    W, D, H = 0.2, 0.13, 0.08
    body = [box("ca_box", VELVET, (W, D, H), loc=(0, 0, H / 2 + 0.012), bev=0.006),
            box("ca_base", GOLD, (W + 0.016, D + 0.016, 0.014), loc=(0, 0, 0.007), bev=0.004),
            box("ca_band", GOLD, (W + 0.004, D + 0.004, 0.01), loc=(0, 0, H + 0.008), bev=0.002),
            box("ca_lock", GOLD, (0.03, 0.006, 0.03), loc=(0, -D / 2 - 0.002, H - 0.005), bev=0.003)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            body.append(prim("uv", "ca_foot", GOLD, loc=(sx * W * 0.45, sy * D * 0.42, 0.006), scale=(0.012, 0.012, 0.01), segments=8, ring_count=5))
    inner = box("ca_lining", ROSE, (W - 0.02, D - 0.02, 0.004), loc=(0, 0, H + 0.004), bev=0)
    b = join(body + [inner], "ca_body")
    lid = [box("ca_lid", VELVET, (W + 0.006, D + 0.006, 0.035), loc=(0, 0, H + 0.03), bev=0.012),
           box("ca_lidband", GOLD, (W + 0.012, D + 0.012, 0.008), loc=(0, 0, H + 0.016), bev=0.002),
           prim("uv", "ca_gem", BERRY, loc=(0, 0, H + 0.05), scale=(0.016, 0.016, 0.01), segments=12, ring_count=8),
           smooth(prim("torus", "ca_gemset", GOLD, loc=(0, 0, H + 0.048), major_radius=0.02, minor_radius=0.004, major_segments=20, minor_segments=6))]
    lid = join(lid, "casket_lid")
    bpy.context.scene.cursor.location = (0, D / 2, H + 0.014)
    bpy.ops.object.select_all(action='DESELECT'); lid.select_set(True); bpy.context.view_layer.objects.active = lid
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    lid = pivot(lid)
    return group("casket", [b, lid], [empty("scroll_anchor", (0, 0, H + 0.01))])

def salver():
    p = [lathe("sv_tray", [(0.0, 0.006), (0.14, 0.006), (0.16, 0.012), (0.17, 0.02), (0.165, 0.022), (0.15, 0.014), (0.0, 0.012)], SILVER, seg=48)]
    for i in range(3):
        a = 2 * math.pi * i / 3
        p.append(prim("uv", f"sv_foot{i}", SILVER, loc=(math.cos(a) * 0.11, math.sin(a) * 0.11, 0.004), scale=(0.012, 0.012, 0.006), segments=8, ring_count=5))
    return keep(join(p, "salver"))

def candlestick():
    p = [lathe("cn_stick", [(0.0, 0.0), (0.05, 0.0), (0.052, 0.01), (0.03, 0.025), (0.012, 0.05), (0.016, 0.12), (0.011, 0.16), (0.02, 0.2), (0.024, 0.205), (0.012, 0.21), (0.0, 0.21)], SILVER, seg=24)]
    p.append(cyl("cn_candle", WAX, 0.011, 0.12, loc=(0, 0, 0.27), seg=12))
    p.append(cyl("cn_wick", WICK, 0.0012, 0.012, loc=(0, 0, 0.336), seg=4))
    body = join(p, "cn_body")
    return group("candlestick", [body], [empty("flame_0", (0, 0, 0.34))])

def gift():
    p = [box("gf_box", PORCELAIN, (0.16, 0.16, 0.12), loc=(0, 0, 0.06), bev=0.006),
         box("gf_lid", PORCELAIN, (0.168, 0.168, 0.03), loc=(0, 0, 0.125), bev=0.006),
         box("gf_rib1", ROSE_DK, (0.172, 0.03, 0.142), loc=(0, 0, 0.071), bev=0.002),
         box("gf_rib2", ROSE_DK, (0.03, 0.172, 0.142), loc=(0, 0, 0.071), bev=0.002)]
    for sx in (-1, 1):
        lp = smooth(prim("torus", f"gf_loop{sx}", ROSE_DK, loc=(sx * 0.03, 0, 0.16), rot=(math.pi / 2, 0.3 * sx, 0), major_radius=0.028, minor_radius=0.008, major_segments=16, minor_segments=6))
        lp.scale = (1, 1, 0.7); apply_tf(lp); p.append(lp)
    p.append(prim("uv", "gf_knot", ROSE_DK, loc=(0, 0, 0.152), scale=(0.016, 0.014, 0.012), segments=10, ring_count=6))
    return keep(join(p, "gift"))

cake(); teapot(); cup(); sugar_bowl(); chocolate_pot(); cake_stand(); pineapple(); casket(); salver(); candlestick(); gift()
finish(OUT, PREVIEW, cols=6, cell=0.6, bg=(0.3, 0.16, 0.18))

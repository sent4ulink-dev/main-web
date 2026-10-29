# The two rifles of Birthday web 3, modelled in detail — original, generic designs (not replicas of any real
# product or game asset):
#   rifle  — an AK-style assault rifle (wood furniture, stamped receiver, curved magazine), light bipod, sling
#   sniper — a long bolt-action marksman rifle with a big scope, thumbhole stock, bipod and monopod
# Along +X, origin at the grip; Blender Z up, the rifle's right side is -Y (faces the camera in the app).
import bpy, math
from salon_lib import *

def build(M):
    OLIVE, STEEL, CASE_BLK, POLY, GUNMETAL, RUBBER, LENS = (M[k] for k in ('OLIVE', 'STEEL', 'CASE_BLK', 'POLY', 'GUNMETAL', 'RUBBER', 'LENS'))
    BLUED = mat("M_blued", (0.11, 0.12, 0.14), 0.35, 0.7)
    WORN = mat("M_worn_steel", (0.42, 0.44, 0.47), 0.3, 0.85)

    def move(ob, loc, rot=None):
        if rot: ob.rotation_euler = rot
        ob.location = loc; apply_tf(ob); return ob

    def prof(name, pts, thick, m, bev=0.006, y=0.0):
        ob = slab(name, pts, -thick / 2, thick / 2, m, bev=bev, bev_seg=2)
        ob.rotation_euler = (math.pi / 2, 0, 0); ob.location = (0, y, 0); apply_tf(ob)
        return ob

    def xcyl(name, m, r, x0, x1, z=0.0, y=0.0, seg=14, bev=0.0):
        return cyl(name, m, r, x1 - x0, loc=((x0 + x1) / 2, y, z), rot=(0, math.pi / 2, 0), seg=seg, bev=bev)

    def ring(name, m, r, t, x, z=0.0, y=0.0, seg=18):
        return smooth(prim("torus", name, m, loc=(x, y, z), rot=(0, math.pi / 2, 0), major_radius=r, minor_radius=t, major_segments=seg, minor_segments=5))

    def origin_to(ob, at):
        bpy.context.scene.cursor.location = at
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    # ═════════════════ AK-style rifle ═════════════════
    def ak_rifle():
        WOOD = mat("M_ak_wood", (0.5, 0.24, 0.1), 0.5)
        GRAIN = mat("M_ak_grain", (0.34, 0.15, 0.06), 0.55)
        MAG = mat("M_ak_mag", (0.18, 0.18, 0.2), 0.45, 0.5)
        p = []
        # stamped receiver: body, dust cover with ribs and the spring button, rivets, ejection port
        p.append(box("ak_recv", BLUED, (0.31, 0.04, 0.05), loc=(0.03, 0, 0.0), bev=0.005))
        p.append(xcyl("ak_cover", BLUED, 0.0205, -0.11, 0.15, z=0.026, seg=18))
        for k in range(3): p.append(xcyl(f"ak_crib{k}", WORN, 0.0212, -0.06 + k * 0.035, -0.054 + k * 0.035, z=0.026, seg=18))
        p.append(xcyl("ak_button", WORN, 0.006, -0.125, -0.108, z=0.028, seg=10))
        p.append(box("ak_port", POLY, (0.07, 0.004, 0.016), loc=(0.07, -0.021, 0.016), bev=0.001))
        for k, (x, z) in enumerate([(-0.07, -0.012), (-0.03, -0.015), (0.06, -0.015), (0.1, -0.012), (0.14, -0.015)]):
            for sy in (-1, 1): p.append(cyl(f"ak_rivet{k}{sy}", WORN, 0.0035, 0.003, loc=(x, sy * 0.0205, z), rot=(math.pi / 2, 0, 0), seg=8))
        # rear sight: base, leaf, notch
        p.append(box("ak_rsbase", BLUED, (0.05, 0.026, 0.02), loc=(0.165, 0, 0.038), bev=0.003))
        p.append(move(box("ak_rsleaf", WORN, (0.045, 0.02, 0.004), bev=0.001), (0.17, 0, 0.05), (0, -0.08, 0)))
        p.append(box("ak_rsnotch", POLY, (0.006, 0.006, 0.006), loc=(0.15, 0, 0.054), bev=0))
        # selector lever (long plate with a tab), charging handle, trigger, mag catch
        p.append(move(box("ak_selector", WORN, (0.12, 0.004, 0.014), bev=0.001), (0.03, -0.0225, 0.008), (0.08, 0, 0)))
        p.append(box("ak_seltab", WORN, (0.012, 0.012, 0.01), loc=(0.085, -0.027, 0.0), bev=0.002))
        p.append(tube("ak_chg", [(0.13, -0.021, 0.016), (0.13, -0.046, 0.016)], 0.0045, WORN, seg=6))
        p.append(prim("uv", "ak_chgknob", WORN, loc=(0.13, -0.048, 0.016), scale=(0.008, 0.007, 0.008), segments=10, ring_count=6))
        p.append(move(box("ak_trigger", WORN, (0.006, 0.006, 0.022), bev=0.001), (0.0, 0, -0.035), (0, 0.25, 0)))
        p.append(box("ak_tguard", BLUED, (0.075, 0.016, 0.004), loc=(0.005, 0, -0.058), bev=0.001))
        p.append(box("ak_tguard_f", BLUED, (0.004, 0.016, 0.03), loc=(0.04, 0, -0.043), bev=0.001))
        p.append(box("ak_magcatch", BLUED, (0.008, 0.02, 0.022), loc=(0.05, 0, -0.035), bev=0.002))
        # wood stock with grain, steel butt plate with a trap door, sling loop
        p.append(prof("ak_stock", [(-0.125, 0.02), (-0.125, -0.03), (-0.5, -0.1), (-0.53, -0.1), (-0.53, -0.02), (-0.5, 0.0)], 0.042, WOOD))
        for k in range(4): p.append(prof(f"ak_sgrain{k}", [(-0.16 - k * 0.07, -0.005 - k * 0.012), (-0.24 - k * 0.07, -0.022 - k * 0.012), (-0.24 - k * 0.07, -0.018 - k * 0.012), (-0.16 - k * 0.07, -0.001 - k * 0.012)], 0.0435, GRAIN, bev=0.0005))
        p.append(box("ak_butt", BLUED, (0.012, 0.044, 0.1), loc=(-0.537, 0, -0.05), bev=0.003))
        p.append(box("ak_trap", WORN, (0.004, 0.022, 0.03), loc=(-0.544, 0, -0.055), bev=0.001))
        p.append(smooth(prim("torus", "ak_sloop", WORN, loc=(-0.46, 0, -0.1), rot=(0, 0, 0), major_radius=0.012, minor_radius=0.0025, major_segments=12, minor_segments=4)))
        # pistol grip with grooves
        p.append(prof("ak_grip", [(-0.055, -0.022), (-0.015, -0.022), (-0.04, -0.13), (-0.082, -0.13)], 0.036, WOOD))
        for k in range(5): p.append(move(box(f"ak_ggroove{k}", GRAIN, (0.003, 0.037, 0.04), bev=0), (-0.05 - k * 0.005 + 0.006, 0, -0.07 - k * 0.012), (0, 0.22, 0)))
        # barrel, handguards with grooves, retainer bands, gas tube with vents, gas block, front sight, brake, rod
        p.append(xcyl("ak_barrel", BLUED, 0.0105, 0.18, 0.74))
        p.append(prof("ak_lowguard", [(0.19, -0.036), (0.43, -0.031), (0.43, 0.012), (0.19, 0.016)], 0.05, WOOD))
        for k in range(3): p.append(box(f"ak_groove{k}", GRAIN, (0.2, 0.0515, 0.004), loc=(0.31, 0, -0.024 + k * 0.012), bev=0))
        p.append(xcyl("ak_ferrule", BLUED, 0.026, 0.18, 0.195, z=-0.005, seg=16))
        p.append(xcyl("ak_band", BLUED, 0.027, 0.425, 0.44, z=-0.005, seg=16))
        p.append(xcyl("ak_gastube", BLUED, 0.0115, 0.19, 0.46, z=0.042, seg=12))
        p.append(prof("ak_upguard", [(0.19, 0.03), (0.38, 0.03), (0.38, 0.062), (0.19, 0.062)], 0.034, WOOD, bev=0.008))
        for k in range(3): p.append(cyl(f"ak_vent{k}", POLY, 0.003, 0.025, loc=(0.4 + k * 0.012, 0, 0.042), rot=(math.pi / 2, 0, 0), seg=8))
        p.append(box("ak_gasblock", BLUED, (0.035, 0.03, 0.062), loc=(0.475, 0, 0.022), bev=0.004))
        p.append(smooth(prim("torus", "ak_fswivel", WORN, loc=(0.475, 0, -0.02), rot=(math.pi / 2, 0, 0), major_radius=0.009, minor_radius=0.0022, major_segments=12, minor_segments=4)))
        p.append(box("ak_fsbase", BLUED, (0.03, 0.026, 0.035), loc=(0.665, 0, 0.018), bev=0.003))
        p.append(box("ak_bayolug", BLUED, (0.025, 0.012, 0.014), loc=(0.665, 0, -0.016), bev=0.002))
        p.append(box("ak_fspost", WORN, (0.004, 0.004, 0.03), loc=(0.665, 0, 0.052), bev=0.0005))
        p.append(ring("ak_fshood", BLUED, 0.016, 0.0028, 0.665, z=0.05))
        p.append(xcyl("ak_brake", BLUED, 0.0145, 0.735, 0.79, seg=14, bev=0.002))
        p.append(move(box("ak_brakecut", POLY, (0.02, 0.032, 0.006), bev=0), (0.786, 0, 0.012), (0, 0.5, 0)))
        p.append(xcyl("ak_rod", WORN, 0.0028, 0.2, 0.68, z=-0.022, seg=6))
        p.append(box("ak_rodtab", WORN, (0.008, 0.008, 0.01), loc=(0.68, 0, -0.024), bev=0.001))
        # the curved magazine: segments along an arc, ribs, front and rear lugs, worn edges
        prev = (0.06, -0.025); pts = []
        for k in range(6):
            t = (k + 1) / 6
            pts.append((0.06 + 0.075 * t ** 1.6, -0.025 - 0.215 * t))
        for k, (x1, z1) in enumerate(pts):
            x0, z0 = prev
            ang = math.atan2(x1 - x0, z0 - z1)
            seg = box(f"ak_mag{k}", MAG, (0.05, 0.026, math.hypot(x1 - x0, z1 - z0) + 0.006), bev=0.003)
            seg.rotation_euler = (0, -ang, 0); seg.location = ((x0 + x1) / 2, 0, (z0 + z1) / 2); apply_tf(seg); p.append(seg)
            if k in (1, 3, 5):
                rib = box(f"ak_magrib{k}", WORN, (0.052, 0.027, 0.004), bev=0.0008)
                rib.rotation_euler = (0, -ang, 0); rib.location = ((x0 + x1) / 2, 0, (z0 + z1) / 2); apply_tf(rib); p.append(rib)
            prev = (x1, z1)
        p.append(box("ak_maglug", MAG, (0.012, 0.022, 0.012), loc=(0.083, 0, -0.022), bev=0.002))
        # light bipod (folding), and a canvas sling hanging between the swivels
        for sy in (-1, 1):
            p.append(tube(f"ak_bipod{sy}", [(0.52, 0, -0.022), (0.545, sy * 0.06, -0.14), (0.565, sy * 0.1, -0.26)], 0.0055, BLUED, seg=6))
            p.append(cyl(f"ak_bicollar{sy}", WORN, 0.008, 0.02, loc=(0.545, sy * 0.06, -0.14), seg=10))
            p.append(prim("uv", f"ak_foot{sy}", RUBBER, loc=(0.565, sy * 0.1, -0.26), scale=(0.013, 0.013, 0.009), segments=8, ring_count=5))
        p.append(box("ak_bimount", BLUED, (0.03, 0.03, 0.02), loc=(0.52, 0, -0.018), bev=0.003))
        sling = tube("ak_sling", smooth_path([(0.475, 0.0, -0.028), (0.2, 0.004, -0.16), (-0.15, 0.004, -0.2), (-0.46, 0.0, -0.11)], 10), 0.006, OLIVE, seg=6)
        sling.scale = (1, 0.35, 1); apply_tf(sling); p.append(sling)
        body = join(p, "ak_body")
        return group("rifle", [body], [empty("muzzle", (0.8, 0, 0.0)), empty("ejection", (0.07, -0.03, 0.02))])

    # ═════════════════ the marksman rifle ═════════════════
    def sniper():
        GREEN = mat("M_sniper_green", (0.27, 0.36, 0.22), 0.55)
        GREEN_DK = mat("M_sniper_green_dk", (0.19, 0.26, 0.15), 0.55)
        T = 0.05
        p = []
        # thumbhole chassis
        p.append(prof("sn_butt", [(-0.6, -0.15), (-0.5, -0.15), (-0.46, 0.04), (-0.6, 0.05)], T, GREEN))
        p.append(prof("sn_upper", [(-0.48, -0.015), (-0.08, -0.005), (-0.08, 0.03), (-0.48, 0.04)], T * 0.9, GREEN))
        p.append(prof("sn_cheek", [(-0.44, 0.03), (-0.24, 0.03), (-0.26, 0.068), (-0.43, 0.07)], T * 0.85, GREEN_DK))
        for k in range(2): p.append(cyl(f"sn_cheekknob{k}", GUNMETAL, 0.009, 0.012, loc=(-0.4 + k * 0.11, -0.028, 0.045), rot=(math.pi / 2, 0, 0), seg=12, bev=0.002))
        p.append(prof("sn_lower", [(-0.49, -0.15), (-0.13, -0.14), (-0.11, -0.105), (-0.48, -0.11)], T * 0.9, GREEN))
        p.append(prof("sn_grip", [(-0.14, -0.14), (-0.075, -0.14), (-0.02, -0.005), (-0.09, -0.005)], T * 0.95, GREEN))
        for k in range(6): p.append(move(box(f"sn_gtex{k}", GREEN_DK, (0.003, 0.049, 0.05), bev=0), (-0.09 + k * 0.009, 0, -0.075 + k * 0.004), (0, 0.42, 0)))
        p.append(prof("sn_fore", [(-0.08, -0.07), (0.44, -0.05), (0.44, 0.008), (-0.08, 0.012)], 0.062, GREEN))
        for k in range(4): p.append(prof(f"sn_vent{k}", [(0.12 + k * 0.075, -0.035), (0.17 + k * 0.075, -0.035), (0.17 + k * 0.075, -0.01), (0.12 + k * 0.075, -0.01)], 0.064, POLY, bev=0.003))
        for sy in (-1, 1):   # side accessory rails on the forend
            p.append(box(f"sn_srail{sy}", POLY, (0.16, 0.008, 0.014), loc=(0.33, sy * 0.034, -0.022), bev=0.001))
            for k in range(7): p.append(box(f"sn_srt{sy}{k}", POLY, (0.008, 0.01, 0.017), loc=(0.26 + k * 0.022, sy * 0.034, -0.022), bev=0))
        # butt: spacers, ribbed rubber pad, monopod
        for k in range(2): p.append(box(f"sn_spacer{k}", GREEN_DK, (0.008, 0.052, 0.19), loc=(-0.603 - k * 0.009, 0, -0.05), bev=0.002))
        p.append(box("sn_pad", RUBBER, (0.025, 0.054, 0.2), loc=(-0.632, 0, -0.05), bev=0.008))
        for k in range(5): p.append(box(f"sn_padrib{k}", POLY, (0.027, 0.056, 0.004), loc=(-0.632, 0, -0.12 + k * 0.035), bev=0))
        p.append(xcyl("sn_monopod_m", GUNMETAL, 0.012, -0.47, -0.43, z=-0.15, seg=10))
        p.append(cyl("sn_monopod", GUNMETAL, 0.008, 0.12, loc=(-0.45, 0, -0.21), seg=10))
        p.append(cyl("sn_monofoot", RUBBER, 0.016, 0.012, loc=(-0.45, 0, -0.272), seg=12))
        # action: receiver, bolt shroud, ejection port, screws, rail with teeth, magazine, trigger, guard, mag release
        p.append(xcyl("sn_action", GUNMETAL, 0.024, -0.1, 0.22, z=0.035, seg=18, bev=0.003))
        p.append(xcyl("sn_shroud", GUNMETAL, 0.018, -0.15, -0.1, z=0.035, seg=16, bev=0.003))
        p.append(box("sn_port", POLY, (0.07, 0.004, 0.018), loc=(0.02, -0.024, 0.045), bev=0.001))
        for k, x in enumerate((-0.05, 0.16)): p.append(cyl(f"sn_ascrew{k}", STEEL, 0.004, 0.004, loc=(x, -0.024, 0.02), rot=(math.pi / 2, 0, 0), seg=8))
        p.append(box("sn_rail", POLY, (0.32, 0.026, 0.012), loc=(0.05, 0, 0.064), bev=0.002))
        for k in range(13): p.append(box(f"sn_rt{k}", POLY, (0.008, 0.03, 0.007), loc=(-0.095 + k * 0.024, 0, 0.072), bev=0))
        p.append(box("sn_mag", GUNMETAL, (0.075, 0.042, 0.09), loc=(0.05, 0, -0.07), bev=0.006))
        for k in range(3): p.append(box(f"sn_magrib{k}", POLY, (0.077, 0.044, 0.004), loc=(0.05, 0, -0.05 - k * 0.022), bev=0))
        p.append(box("sn_magrel", STEEL, (0.012, 0.046, 0.01), loc=(0.095, 0, -0.04), bev=0.002))
        p.append(smooth(prim("torus", "sn_tguard", POLY, loc=(-0.02, 0, -0.05), rot=(math.pi / 2, 0, 0), major_radius=0.03, minor_radius=0.005, major_segments=16, minor_segments=6)))
        p.append(move(box("sn_trigger", STEEL, (0.006, 0.006, 0.025), bev=0.001), (-0.02, 0, -0.045), (0, 0.3, 0)))
        # the barrel: fluted, a three-port muzzle brake with top vents, a thread cap
        p.append(xcyl("sn_barrel", GUNMETAL, 0.0135, 0.22, 0.88, z=0.035, seg=16))
        for k in range(12): p.append(xcyl(f"sn_flute{k}", POLY, 0.0141, 0.3 + k * 0.035, 0.31 + k * 0.035, z=0.035, seg=16))
        p.append(xcyl("sn_brake", GUNMETAL, 0.021, 0.88, 0.97, z=0.035, seg=16, bev=0.003))
        for k in range(3): p.append(box(f"sn_bslot{k}", POLY, (0.012, 0.046, 0.014), loc=(0.9 + k * 0.022, 0, 0.035), bev=0))
        for k in range(3): p.append(cyl(f"sn_btop{k}", POLY, 0.0035, 0.044, loc=(0.9 + k * 0.022, 0, 0.035), seg=8))
        p.append(xcyl("sn_cap", STEEL, 0.017, 0.97, 0.975, z=0.035, seg=16))
        # the scope: tube, big objective with sunshade, eyepiece with magnification ring, turrets with knurling,
        # parallax knob, flip-up lens caps, rings with screws
        SY = 0.115
        p.append(xcyl("sn_tube", POLY, 0.018, -0.12, 0.22, z=SY, seg=20, bev=0.002))
        obj = lathe("sn_obj", [(0.0, 0.0), (0.018, 0.0), (0.031, 0.05), (0.034, 0.1), (0.0, 0.1)], POLY, seg=28)
        obj.rotation_euler = (0, math.pi / 2, 0); obj.location = (0.22, 0, SY); apply_tf(obj); p.append(obj)
        p.append(xcyl("sn_shade", POLY, 0.0345, 0.32, 0.37, z=SY, seg=28))
        p.append(ring("sn_shadering", GUNMETAL, 0.0345, 0.003, 0.33, z=SY, seg=28))
        eye = lathe("sn_eye", [(0.0, 0.0), (0.025, 0.0), (0.024, 0.04), (0.018, 0.06), (0.0, 0.06)], POLY, seg=24)
        eye.rotation_euler = (0, -math.pi / 2, 0); eye.location = (-0.12, 0, SY); apply_tf(eye); p.append(eye)
        for k in range(6): p.append(ring(f"sn_magring{k}", GUNMETAL, 0.0245, 0.0018, -0.155 + k * 0.006, z=SY, seg=22))
        p.append(cyl("sn_lens_f", LENS, 0.031, 0.003, loc=(0.371, 0, SY), rot=(0, math.pi / 2, 0), seg=28))
        p.append(cyl("sn_lens_b", LENS, 0.02, 0.003, loc=(-0.181, 0, SY), rot=(0, math.pi / 2, 0), seg=20))
        for (nm, loc, rot) in (("sn_turret_e", (0.06, 0, SY + 0.03), (0, 0, 0)), ("sn_turret_w", (0.06, -0.03, SY), (math.pi / 2, 0, 0)), ("sn_parallax", (0.06, 0.03, SY), (math.pi / 2, 0, 0))):
            p.append(cyl(nm, POLY, 0.013, 0.028, loc=loc, rot=rot, seg=16, bev=0.002))
        for k in range(3): p.append(cyl(f"sn_knurl{k}", GUNMETAL, 0.0138, 0.0025, loc=(0.06, 0, SY + 0.022 + k * 0.006), seg=16))
        for k in range(3): p.append(cyl(f"sn_knurlw{k}", GUNMETAL, 0.0138, 0.0025, loc=(0.06, -0.022 - k * 0.006, SY), rot=(math.pi / 2, 0, 0), seg=16))
        p.append(move(cyl("sn_capf", POLY, 0.036, 0.004, seg=24), (0.395, 0, SY + 0.03), (0, math.pi / 2 - 1.3, 0)))
        p.append(move(cyl("sn_capb", POLY, 0.026, 0.004, seg=20), (-0.19, 0, SY + 0.026), (0, math.pi / 2 + 1.3, 0)))
        for k in range(2):
            x = -0.03 + k * 0.17
            p.append(ring(f"sn_ring{k}", GUNMETAL, 0.02, 0.005, x, z=SY, seg=20))
            p.append(box(f"sn_mount{k}", GUNMETAL, (0.018, 0.022, 0.035), loc=(x, 0, 0.085), bev=0.002))
            for sx in (-1, 1): p.append(cyl(f"sn_rscrew{k}{sx}", STEEL, 0.0028, 0.004, loc=(x + sx * 0.006, 0, SY + 0.026), seg=8))
        # bipod: adapter, upper legs with collars, lower extensions, feet
        p.append(box("sn_biad", GUNMETAL, (0.04, 0.04, 0.024), loc=(0.4, 0, -0.06), bev=0.004))
        for sy in (-1, 1):
            p.append(tube(f"sn_bipod{sy}", [(0.4, sy * 0.012, -0.06), (0.42, sy * 0.06, -0.16)], 0.009, POLY, seg=8))
            p.append(cyl(f"sn_bicol{sy}", GUNMETAL, 0.011, 0.018, loc=(0.42, sy * 0.06, -0.16), rot=(sy * 0.4, 0.15, 0), seg=10))
            p.append(tube(f"sn_bileg{sy}", [(0.42, sy * 0.06, -0.16), (0.45, sy * 0.12, -0.3)], 0.006, GUNMETAL, seg=8))
            p.append(prim("uv", f"sn_foot{sy}", RUBBER, loc=(0.45, sy * 0.12, -0.3), scale=(0.015, 0.015, 0.011), segments=8, ring_count=5))
        p.append(smooth(prim("torus", "sn_sstud", STEEL, loc=(0.4, 0, -0.078), rot=(math.pi / 2, 0, 0), major_radius=0.008, minor_radius=0.002, major_segments=12, minor_segments=4)))
        body = join(p, "sn_body")
        bolt = join([xcyl("sn_boltbody", STEEL, 0.012, -0.125, -0.035, z=0.035, seg=12),
                     tube("sn_boltarm", [(-0.06, -0.012, 0.035), (-0.065, -0.06, 0.01)], 0.0045, STEEL, seg=6),
                     prim("uv", "sn_boltknob", GUNMETAL, loc=(-0.065, -0.063, 0.005), scale=(0.013,) * 3, segments=12, ring_count=8)], "sniper_bolt")
        origin_to(bolt, (-0.06, 0, 0.035))
        bolt = pivot(bolt)
        return group("sniper", [body, bolt], [empty("scope_eye", (-0.2, 0, SY)), empty("sn_muzzle", (0.98, 0, 0.035)), empty("sn_ejection", (0.02, -0.03, 0.05))])

    ak_rifle(); sniper()

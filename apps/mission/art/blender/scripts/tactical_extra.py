# More original gear for Birthday web 3 (imported by tactical_props.py; uses its palette).
import bpy, math
from salon_lib import *

def build(M):
    OLIVE, OLIVE_DK, STEEL, CASE_BLK, POLY, ORANGE, LED, YEL_W, RED_W, BLUE_W, GUNMETAL, RUBBER, LENS, CRATE, CRATE_DK = (
        M[k] for k in ('OLIVE', 'OLIVE_DK', 'STEEL', 'CASE_BLK', 'POLY', 'ORANGE', 'LED', 'YEL_W', 'RED_W', 'BLUE_W', 'GUNMETAL', 'RUBBER', 'LENS', 'CRATE', 'CRATE_DK'))

    def move(ob, loc, rot=None):
        if rot: ob.rotation_euler = rot
        ob.location = loc; apply_tf(ob); return ob

    def origin_to(ob, at):
        bpy.context.scene.cursor.location = at
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    # ── the party charge: a rugged olive case lying open with a control panel (display + keypad are built in
    #    the app on the `display` / `keypad` anchors), toggles, LEDs, three confetti canisters and wires ──
    def party_charge():
        W, D, H, t = 0.42, 0.27, 0.11, 0.012
        body = [box("pc_floor", OLIVE_DK, (W, D, t), loc=(0, 0, t / 2), bev=0.004)]
        for sy in (-1, 1): body.append(box(f"pc_wy{sy}", OLIVE, (W, t, H), loc=(0, sy * (D / 2 - t / 2), H / 2), bev=0.004))
        for sx in (-1, 1): body.append(box(f"pc_wx{sx}", OLIVE, (t, D - 2 * t, H), loc=(sx * (W / 2 - t / 2), 0, H / 2), bev=0.004))
        for sy in (-1, 1): body.append(box(f"pc_rimy{sy}", STEEL, (W + 0.006, 0.016, 0.008), loc=(0, sy * (D / 2 - 0.005), H - 0.004), bev=0.002))
        for sx in (-1, 1): body.append(box(f"pc_rimx{sx}", STEEL, (0.016, D - 0.026, 0.008), loc=(sx * (W / 2 - 0.005), 0, H - 0.004), bev=0.002))
        for sx in (-1, 1):
            body.append(box(f"pc_latch{sx}", STEEL, (0.04, 0.012, 0.035), loc=(sx * 0.13, -D / 2 - 0.006, H - 0.02), bev=0.003))
            body.append(tube(f"pc_handle{sx}", [(sx * (W / 2 + 0.004), -0.05, 0.07), (sx * (W / 2 + 0.03), -0.04, 0.06), (sx * (W / 2 + 0.03), 0.04, 0.06), (sx * (W / 2 + 0.004), 0.05, 0.07)], 0.006, STEEL, seg=6))
        PX = -0.07
        body.append(box("pc_panel", CASE_BLK, (0.25, 0.2, 0.014), loc=(PX, -0.01, 0.075), bev=0.004))
        body.append(box("pc_bezel", POLY, (0.125, 0.06, 0.006), loc=(PX - 0.05, 0.035, 0.084), bev=0.002))
        for k, (x, y) in enumerate([(PX - 0.115, 0.08), (PX + 0.115, 0.08), (PX - 0.115, -0.1), (PX + 0.115, -0.1)]):
            body.append(cyl(f"pc_screw{k}", STEEL, 0.005, 0.004, loc=(x, y, 0.083), seg=8))
        for k in range(2):
            x = PX - 0.09 + k * 0.035
            body.append(cyl(f"pc_tbase{k}", STEEL, 0.008, 0.008, loc=(x, -0.03, 0.086), seg=10))
            body.append(move(cyl(f"pc_tog{k}", STEEL, 0.0025, 0.03, seg=6), (x, -0.036, 0.1), (0.5, 0, 0)))
            body.append(box(f"pc_guard{k}", ORANGE, (0.004, 0.022, 0.016), loc=(x + 0.011, -0.03, 0.09), bev=0.001))
        amber = mat("M_led_amber", (1.0, 0.65, 0.1), 0.3, emit=(1.0, 0.55, 0.05))
        green = mat("M_led_green", (0.2, 1.0, 0.3), 0.3, emit=(0.1, 0.9, 0.2))
        for k, m in enumerate((LED, amber, green)):
            body.append(prim("uv", f"pc_led{k}", m, loc=(PX - 0.095 + k * 0.022, -0.075, 0.085), scale=(0.005, 0.005, 0.004), segments=10, ring_count=6))
        for k in range(3):
            y = -0.075 + k * 0.075
            body.append(cyl(f"pc_can{k}", OLIVE, 0.028, 0.085, loc=(0.135, y, 0.055), seg=18, bev=0.003))
            body.append(cyl(f"pc_band{k}", YEL_W, 0.0285, 0.012, loc=(0.135, y, 0.07), seg=18))
            body.append(cyl(f"pc_cap{k}", STEEL, 0.016, 0.012, loc=(0.135, y, 0.103), seg=12))
        body.append(box("pc_strap", CASE_BLK, (0.07, D - 0.03, 0.01), loc=(0.135, 0, 0.05), bev=0.002))
        for k, m in enumerate((RED_W, BLUE_W, YEL_W)):
            y = -0.075 + k * 0.075
            body.append(tube(f"pc_wire{k}", smooth_path([(PX + 0.12, -0.06 + k * 0.05, 0.082), (0.06, -0.05 + k * 0.05, 0.125), (0.135, y, 0.112)], 6), 0.0035, m, seg=6))
        coil = [(0.0 + 0.008 * math.cos(u * 12), 0.1 + 0.008 * math.sin(u * 12), 0.02 + 0.07 * u) for u in [i / 50 for i in range(51)]]
        body.append(tube("pc_coil", coil, 0.0025, CASE_BLK, seg=4))
        b = join(body, "pc_body")
        lid = [box("pc_lid", OLIVE, (W, D, 0.035), loc=(0, 0, H + 0.0175), bev=0.006)]
        for k in range(3): lid.append(box(f"pc_lrib{k}", OLIVE_DK, (W - 0.06, 0.012, 0.006), loc=(0, -0.08 + k * 0.08, H + 0.037), bev=0.002))
        lid = join(lid, "charge_lid")
        origin_to(lid, (0, D / 2, H))
        lid = pivot(lid)
        lid.rotation_euler.x = math.radians(105)   # standing open
        return group("party_charge", [b, lid], [empty("pc_display", (PX - 0.05, 0.035, 0.0875)), empty("pc_keypad", (PX + 0.06, -0.012, 0.0825))])

    # ── the marksman's tower: four posts, a plank deck with railings (open at the front, -Y), a ladder ──
    def sniper_tower():
        S, Hd = 2.2, 3.3
        p = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                p.append(box(f"st_post{sx}{sy}", CRATE_DK, (0.14, 0.14, Hd + 1.05), loc=(sx * (S / 2 - 0.07), sy * (S / 2 - 0.07), (Hd + 1.05) / 2), bev=0.01))
        for k in range(9):
            p.append(box(f"st_plank{k}", CRATE if k % 2 else CRATE_DK, (S + 0.06, S / 9 - 0.012, 0.05), loc=(0, -S / 2 + (k + 0.5) * S / 9, Hd), bev=0.006))
        for sy in (-1, 1): p.append(box(f"st_joist{sy}", CRATE_DK, (S, 0.12, 0.16), loc=(0, sy * (S / 2 - 0.07), Hd - 0.1), bev=0.008))
        for z in (Hd + 0.5, Hd + 0.95):
            p.append(box(f"st_railb{z}", CRATE, (S, 0.06, 0.08), loc=(0, S / 2 - 0.07, z), bev=0.006))
            for sx in (-1, 1): p.append(box(f"st_rails{sx}{z}", CRATE, (0.06, S, 0.08), loc=(sx * (S / 2 - 0.07), 0, z), bev=0.006))
        for sx in (-1, 1):
            for sy in (-1, 1):
                br = box(f"st_brace{sx}{sy}", CRATE_DK, (0.07, 0.07, 3.3), bev=0.006)
                br.rotation_euler = (0, sx * 0.55, 0); br.location = (0, sy * (S / 2 - 0.07), 1.6); apply_tf(br)
                p.append(br)
        for sx in (-1, 1): p.append(box(f"st_ladr{sx}", CRATE, (0.06, 0.06, Hd + 0.3), loc=(0.55 + sx * 0.22, S / 2 + 0.22, (Hd + 0.3) / 2), bev=0.005))
        for k in range(10): p.append(box(f"st_rung{k}", CRATE_DK, (0.44, 0.045, 0.045), loc=(0.55, S / 2 + 0.22, 0.25 + k * 0.33), bev=0.004))
        return keep(join(p, "sniper_tower"))


    # ── the loot case, bigger and taller, with more detail: ribbed shell, steel corner guards, three latches,
    #    fold-down end handles, a front carry handle, a pressure valve, padlock loops, hinges, stack bumps, feet,
    #    foam with cut-outs inside. `loot_case_lid` hinges at the back; `items` empty above the open case. ──
    def loot_case_v2():
        W, D, H, LH = 1.0, 0.46, 0.3, 0.13
        FOAM = mat("M_foam", (0.2, 0.2, 0.22), 0.95)
        body = [box("lc_shell", CASE_BLK, (W, D, H), loc=(0, 0, H / 2), bev=0.03)]
        for k in range(3):   # ribs round the shell
            z = 0.06 + k * 0.085
            body.append(box(f"lc_rib{k}", POLY, (W + 0.012, D + 0.012, 0.014), loc=(0, 0, z), bev=0.005))
        body.append(box("lc_band", ORANGE, (W + 0.008, D + 0.008, 0.016), loc=(0, 0, H - 0.03), bev=0.004))
        for sx in (-1, 1):
            for sy in (-1, 1):
                for z in (0.03, H - 0.03):
                    body.append(box(f"lc_corner{sx}{sy}{z}", STEEL, (0.06, 0.06, 0.06), loc=(sx * (W / 2 - 0.022), sy * (D / 2 - 0.022), z), bev=0.012))
                body.append(box(f"lc_foot{sx}{sy}", RUBBER, (0.06, 0.05, 0.02), loc=(sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), -0.008), bev=0.005))
        for k, x in enumerate((-0.33, 0.0, 0.33)):   # three latches with padlock loops
            body.append(box(f"lc_latch{k}", ORANGE, (0.085, 0.03, 0.075), loc=(x, -D / 2 - 0.014, H - 0.02), bev=0.008))
            body.append(box(f"lc_latchpin{k}", STEEL, (0.095, 0.012, 0.012), loc=(x, -D / 2 - 0.012, H - 0.06), bev=0.003))
            body.append(smooth(prim("torus", f"lc_loop{k}", STEEL, loc=(x + 0.065, -D / 2 - 0.01, H - 0.04), rot=(math.pi / 2, 0, 0), major_radius=0.012, minor_radius=0.003, major_segments=12, minor_segments=4)))
        body.append(tube("lc_carry", [(-0.12, -D / 2 - 0.005, 0.2), (-0.11, -D / 2 - 0.05, 0.19), (0.11, -D / 2 - 0.05, 0.19), (0.12, -D / 2 - 0.005, 0.2)], 0.014, POLY, seg=8))
        body.append(cyl("lc_valve", STEEL, 0.022, 0.016, loc=(0.42, -D / 2 - 0.006, 0.12), rot=(math.pi / 2, 0, 0), seg=16, bev=0.003))
        body.append(cyl("lc_valvecap", POLY, 0.014, 0.012, loc=(0.42, -D / 2 - 0.017, 0.12), rot=(math.pi / 2, 0, 0), seg=12))
        for sx in (-1, 1):   # fold-down end handles in recesses
            body.append(box(f"lc_recess{sx}", POLY, (0.01, 0.22, 0.09), loc=(sx * (W / 2 + 0.002), 0, 0.17), bev=0.004))
            body.append(tube(f"lc_endh{sx}", [(sx * (W / 2 + 0.006), -0.08, 0.2), (sx * (W / 2 + 0.03), -0.07, 0.15), (sx * (W / 2 + 0.03), 0.07, 0.15), (sx * (W / 2 + 0.006), 0.08, 0.2)], 0.01, STEEL, seg=6))
        for k, x in enumerate((-0.33, 0.0, 0.33)):   # hinges at the back
            body.append(cyl(f"lc_hinge{k}", STEEL, 0.012, 0.11, loc=(x, D / 2 + 0.008, H), rot=(0, math.pi / 2, 0), seg=12))
        body.append(box("lc_foam", FOAM, (W - 0.06, D - 0.06, 0.012), loc=(0, 0, H - 0.008), bev=0))
        for k, (x, w) in enumerate(((-0.28, 0.3), (0.12, 0.22), (0.36, 0.12))):
            body.append(box(f"lc_cut{k}", POLY, (w, D - 0.16, 0.004), loc=(x, 0, H - 0.001), bev=0))
        b = join(body, "lc_body")
        lid = [box("lc_lid", CASE_BLK, (W + 0.008, D + 0.008, LH), loc=(0, 0, H + LH / 2), bev=0.035)]
        lid.append(box("lc_lidpanel", POLY, (W - 0.16, D - 0.12, 0.012), loc=(0, 0, H + LH + 0.002), bev=0.006))
        for k in range(6): lid.append(box(f"lc_lrib{k}", CASE_BLK, (0.016, D - 0.14, 0.014), loc=(-0.35 + k * 0.14, 0, H + LH + 0.008), bev=0.004))
        for sx in (-1, 1):
            for sy in (-1, 1):
                lid.append(cyl(f"lc_bump{sx}{sy}", POLY, 0.022, 0.012, loc=(sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), H + LH + 0.004), seg=14, bev=0.003))
                lid.append(box(f"lc_lcorner{sx}{sy}", STEEL, (0.06, 0.06, 0.06), loc=(sx * (W / 2 - 0.022), sy * (D / 2 - 0.022), H + LH - 0.026), bev=0.012))
        lid.append(box("lc_badge", ORANGE, (0.16, 0.08, 0.006), loc=(0, 0, H + LH + 0.012), bev=0.003))
        lid = join(lid, "loot_case_lid")
        origin_to(lid, (0, D / 2, H))
        lid = pivot(lid)
        return group("loot_case", [b, lid], [empty("items", (0, 0, H + 0.36))])

    party_charge(); sniper_tower(); loot_case_v2()
    import rifles; rifles.build(M)   # the AK-style rifle and the marksman rifle, in detail

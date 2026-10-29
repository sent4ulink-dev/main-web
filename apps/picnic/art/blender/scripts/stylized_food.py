# Stylized picnic food, presents and birthday cake for Birthday web 1 (original models, made in Blender).
# Run: blender -b --factory-startup --python stylized_food.py -- <out.glb> [preview.png]
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None
random.seed(3)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── helpers ─────────────────────────────────────────────
MATS = {}
def mat(name, rgb, rough=0.6, metal=0.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = 'BLENDED'
    MATS[name] = m
    return m

def new_obj(name, bm, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if material: ob.data.materials.append(material)
    return ob

def lathe(name, prof, material, seg=48, smooth=True):
    """prof: list of (radius, z) from bottom to top."""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        ring = []
        n = 1 if r < 1e-6 else seg
        for i in range(n):
            a = 2 * math.pi * i / seg
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for r0, r1 in zip(rings[:-1], rings[1:]):
        if len(r0) == 1 and len(r1) == 1: continue
        if len(r0) == 1:
            for i in range(seg): bm.faces.new((r0[0], r1[i], r1[(i + 1) % seg]))
        elif len(r1) == 1:
            for i in range(seg): bm.faces.new((r0[i], r0[(i + 1) % seg], r1[0]))
        else:
            for i in range(seg): bm.faces.new((r0[i], r0[(i + 1) % seg], r1[(i + 1) % seg], r1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, material)
    if smooth: shade(ob)
    return ob

def shade(ob, angle=50):
    for p in ob.data.polygons: p.use_smooth = True
    m = ob.modifiers.new("smooth", 'NODES') if False else None
    ob.data.set_sharp_from_angle(angle=math.radians(angle)) if hasattr(ob.data, "set_sharp_from_angle") else None

def prim(kind, name, material, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    fn = {"cube": bpy.ops.mesh.primitive_cube_add, "uv": bpy.ops.mesh.primitive_uv_sphere_add,
          "ico": bpy.ops.mesh.primitive_ico_sphere_add, "cyl": bpy.ops.mesh.primitive_cylinder_add,
          "cone": bpy.ops.mesh.primitive_cone_add, "torus": bpy.ops.mesh.primitive_torus_add}[kind]
    fn(location=loc, rotation=rot, **kw)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if material: ob.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob

def bevel(ob, w=0.004, seg=3):
    m = ob.modifiers.new("bev", 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    return ob

def subsurf(ob, lv=2):
    m = ob.modifiers.new("sub", 'SUBSURF'); m.levels = lv; m.render_levels = lv
    return ob

def smooth_all(ob):
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def join(objs, name):
    for o in objs: apply_mods(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    return ob

def displace_verts(ob, fn):
    for v in ob.data.vertices:
        v.co = fn(v.co.copy())

def leaf(name, material, length=0.06, width=0.022, bend=0.25):
    bm = bmesh.new()
    n = 10
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        w = math.sin(math.pi * t) ** 0.8 * width / 2
        z = math.sin(t * math.pi * 0.5) * bend * length * t
        left.append(bm.verts.new((t * length, w, z)))
        right.append(bm.verts.new((t * length, -w, z)))
    mid = [bm.verts.new((t * length, 0, math.sin(t * math.pi * 0.5) * bend * length * t + 0.002)) for t in [i / n for i in range(n + 1)]]
    for i in range(n):
        bm.faces.new((left[i], left[i + 1], mid[i + 1], mid[i]))
        bm.faces.new((mid[i], mid[i + 1], right[i + 1], right[i]))
    ob = new_obj(name, bm, material)
    smooth_all(ob)
    return ob

# ── palette (illustration colours) ──────────────────────
WHITE = mat("M_plate_white", (0.93, 0.92, 0.88), 0.35)
CRUST = mat("M_crust", (0.86, 0.58, 0.28), 0.7)
CHERRY = mat("M_cherry", (0.55, 0.06, 0.1), 0.35)
BOTTLE = mat("M_bottle", (0.06, 0.22, 0.12), 0.15)
LABEL = mat("M_label", (0.95, 0.89, 0.76), 0.7)
LABEL_RED = mat("M_label_red", (0.62, 0.08, 0.12), 0.6)
FOIL = mat("M_foil", (0.42, 0.04, 0.08), 0.3, 0.3)
GLASS = mat("M_glass", (0.85, 0.92, 0.95), 0.05, 0, 0.3)
WINE = mat("M_wine", (0.42, 0.02, 0.07), 0.2)
BOARD = mat("M_board", (0.72, 0.47, 0.25), 0.7)
SAUSAGE = mat("M_sausage", (0.52, 0.2, 0.12), 0.45)
LEAF = mat("M_leaf", (0.22, 0.52, 0.18), 0.6)
CHEESE = mat("M_cheese", (0.99, 0.8, 0.32), 0.55)
BLUEBERRY = mat("M_blueberry", (0.16, 0.18, 0.48), 0.4)
RASPBERRY = mat("M_raspberry", (0.82, 0.12, 0.28), 0.5)
STRAWBERRY = mat("M_strawberry", (0.86, 0.1, 0.14), 0.35)
DIP = mat("M_dip", (0.96, 0.84, 0.48), 0.5)
OLIVE = mat("M_olive", (0.34, 0.19, 0.11), 0.35)
WICKER = mat("M_wicker", (0.78, 0.53, 0.27), 0.8)
BREAD = mat("M_bread", (0.86, 0.56, 0.26), 0.75)
BREAD_LIGHT = mat("M_bread_light", (0.96, 0.8, 0.52), 0.8)
GRAPE = mat("M_grape", (0.38, 0.16, 0.44), 0.3)
GINGHAM = mat("M_gingham", (0.85, 0.2, 0.22), 0.8)
POT_RED = mat("M_pot_red", (0.82, 0.25, 0.25), 0.5)
SOIL = mat("M_soil", (0.25, 0.15, 0.09), 0.9)
PLANT = mat("M_plant", (0.2, 0.55, 0.25), 0.6)
METAL = mat("M_metal", (0.78, 0.78, 0.8), 0.25, 1.0)
HANDLE = mat("M_handle", (0.6, 0.34, 0.18), 0.6)
CHOC = mat("M_choc", (0.28, 0.13, 0.08), 0.35)
CHOC_GLAZE = mat("M_choc_glaze", (0.22, 0.09, 0.06), 0.15)
CREAM = mat("M_cream", (0.98, 0.93, 0.84), 0.5)
SPONGE = mat("M_sponge", (0.93, 0.76, 0.5), 0.8)
STAND = mat("M_stand_white", (0.95, 0.95, 0.93), 0.25)

objects = {}
def keep(ob):
    objects[ob.name] = ob
    return ob

# ── lattice cherry pie on a plate ───────────────────────
def make_pie():
    parts = []
    parts.append(lathe("pie_plate", [(0, 0), (0.12, 0), (0.15, 0.012), (0.158, 0.016), (0.152, 0.018), (0.14, 0.014), (0.11, 0.006), (0, 0.006)], WHITE, 64))
    parts.append(lathe("pie_tin", [(0, 0.006), (0.095, 0.006), (0.112, 0.036), (0, 0.036)], CRUST, 64))
    fill = lathe("pie_fill", [(0, 0.03), (0.104, 0.03), (0.104, 0.038), (0, 0.04)], CHERRY, 64)
    displace_verts(fill, lambda c: c + Vector((0, 0, (math.sin(c.x * 140) * math.cos(c.y * 130)) * 0.002 if c.z > 0.034 else 0)))
    parts.append(fill)
    rim = prim("torus", "pie_rim", CRUST, loc=(0, 0, 0.04), major_radius=0.108, minor_radius=0.013, major_segments=96, minor_segments=12)
    def crimp(c):
        a = math.atan2(c.y, c.x)
        r = math.hypot(c.x, c.y)
        k = 1 + 0.035 * math.sin(a * 22)
        return Vector((c.x * k, c.y * k, c.z + 0.002 * math.cos(a * 22)))
    displace_verts(rim, crimp)
    smooth_all(rim)
    parts.append(rim)
    # woven lattice
    R = 0.1
    for axis in (0, 1):
        for i, d in enumerate([-0.066, -0.022, 0.022, 0.066]):
            L = 2 * math.sqrt(max(R * R - d * d, 0.0001))
            bm = bmesh.new()
            segs = 24
            verts = []
            for s in range(segs + 1):
                t = -L / 2 + L * s / segs
                z = 0.044 + 0.003 * math.sin((t / 0.03) * math.pi + (i + axis) * math.pi)
                row = []
                for w, h in ((-0.009, 0), (0.009, 0), (0.009, 0.005), (-0.009, 0.005)):
                    p = (t, d + w, z + h) if axis == 0 else (d + w, t, z + h)
                    row.append(bm.verts.new(p))
                verts.append(row)
            for s in range(segs):
                a, b = verts[s], verts[s + 1]
                for k in range(4):
                    bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
            bm.faces.new(tuple(reversed(verts[0]))); bm.faces.new(tuple(verts[-1]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            strip = new_obj(f"pie_strip_{axis}_{i}", bm, CRUST)
            bevel(strip, 0.002, 2); smooth_all(strip)
            parts.append(strip)
    keep(join(parts, "pie"))

# ── wine bottle + glass ─────────────────────────────────
def make_bottle():
    body = lathe("bottle_body", [(0, 0), (0.035, 0), (0.037, 0.006), (0.037, 0.19), (0.033, 0.212), (0.019, 0.236), (0.0132, 0.252), (0.0132, 0.29), (0.0148, 0.293), (0.0148, 0.3), (0, 0.3)], BOTTLE, 48)
    label = lathe("bottle_label", [(0.0376, 0.07), (0.0376, 0.16)], LABEL, 48, smooth=True)
    # make the label a closed band (inner side too)
    lab_in = lathe("bottle_label_in", [(0.0372, 0.16), (0.0372, 0.07)], LABEL, 48)
    emblem = prim("cyl", "bottle_emblem", LABEL_RED, loc=(0, -0.0378, 0.118), rot=(math.pi / 2, 0, 0), radius=0.014, depth=0.0012, vertices=32)
    foil = lathe("bottle_foil", [(0.0138, 0.262), (0.0156, 0.262), (0.0156, 0.302), (0, 0.303)], FOIL, 32)
    keep(join([body, label, lab_in, emblem, foil], "bottle"))

    glass = lathe("glass", [(0, 0), (0.036, 0), (0.036, 0.004), (0.006, 0.008), (0.004, 0.02), (0.004, 0.085), (0.012, 0.092), (0.032, 0.11), (0.041, 0.14), (0.04, 0.175), (0.036, 0.2), (0.034, 0.2), (0.038, 0.175), (0.039, 0.14), (0.03, 0.112), (0.011, 0.096), (0, 0.095)], GLASS, 48)
    keep(glass)
    wine = lathe("glass_wine", [(0, 0.097), (0.011, 0.098), (0.029, 0.113), (0.036, 0.135), (0, 0.135)], WINE, 48)
    keep(wine)

# ── sausage coil on a cutting board ─────────────────────
def make_sausage_board():
    board = prim("cube", "board_body", BOARD, loc=(0, 0, 0.011), scale=(0.19, 0.115, 0.011))
    handle = prim("cube", "board_handle", BOARD, loc=(0.235, 0, 0.011), scale=(0.06, 0.032, 0.011))
    for o in (board, handle): bevel(o, 0.008, 3)
    b = join([board, handle], "board_tmp")
    hole = prim("cyl", "board_hole", None, loc=(0.27, 0, 0.011), radius=0.011, depth=0.05, vertices=24)
    mod = b.modifiers.new("hole", 'BOOLEAN'); mod.object = hole; mod.operation = 'DIFFERENCE'
    apply_mods(b); bpy.data.objects.remove(hole)
    smooth_all(b)
    # spiral sausage as a bevelled curve
    cu = bpy.data.curves.new("sausage_curve", 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    pts = []
    turns, r0, r1 = 2.3, 0.022, 0.09
    n = 140
    for i in range(n):
        t = i / (n - 1)
        a = t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((math.cos(a) * r, math.sin(a) * r, 0.022 + 0.017))
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    cu.bevel_depth = 0.0165; cu.bevel_resolution = 6; cu.use_fill_caps = True
    so = bpy.data.objects.new("sausage", cu); scene.collection.objects.link(so)
    bpy.context.view_layer.objects.active = so
    so.select_set(True)
    bpy.ops.object.convert(target='MESH')
    so = bpy.context.active_object
    so.data.materials.append(SAUSAGE)
    smooth_all(so)
    l1 = leaf("board_leaf1", LEAF, 0.06, 0.026); l1.location = (0.08, 0.06, 0.06); l1.rotation_euler = (0.2, -0.2, 2.4)
    l2 = leaf("board_leaf2", LEAF, 0.05, 0.022); l2.location = (0.1, 0.05, 0.055); l2.rotation_euler = (0.1, -0.3, 1.6)
    for l in (l1, l2):
        bpy.context.view_layer.objects.active = l; l.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    keep(join([b, so, l1, l2], "sausage_board"))

# ── cheese wedges on a little plate ─────────────────────
def make_cheese():
    plate = lathe("cheese_plate", [(0, 0), (0.06, 0), (0.078, 0.01), (0.082, 0.013), (0.078, 0.014), (0.06, 0.006), (0, 0.006)], WHITE, 48)
    wedges = []
    for k, (ox, oy, rz) in enumerate([(-0.03, -0.015, 0.3), (0.0, 0.02, -0.5)]):
        bm = bmesh.new()
        tri = [(0, 0), (0.07, -0.02), (0.07, 0.02)]
        bottom = [bm.verts.new((x, y, 0)) for x, y in tri]
        top = [bm.verts.new((x, y, 0.032)) for x, y in tri]
        bm.faces.new(tuple(reversed(bottom))); bm.faces.new(tuple(top))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
        w = new_obj(f"cheese_{k}", bm, CHEESE)
        bevel(w, 0.003, 2)
        apply_mods(w)
        for (hx, hy, hz, hr) in [(0.045, -0.012, 0.016, 0.006), (0.058, 0.01, 0.024, 0.005), (0.03, 0.006, 0.032, 0.005), (0.07, 0.0, 0.01, 0.006)]:
            s = prim("uv", "hole", None, loc=(hx, hy, hz), radius=hr, segments=16, ring_count=8)
            mod = w.modifiers.new("h", 'BOOLEAN'); mod.object = s; mod.operation = 'DIFFERENCE'
            apply_mods(w); bpy.data.objects.remove(s)
        w.location = (ox, oy, 0.006); w.rotation_euler = (0, 0, rz)
        bpy.context.view_layer.objects.active = w; w.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        wedges.append(w)
    keep(join([plate] + wedges, "cheese"))

def bowl(name, r=0.06, h=0.045, color=WHITE):
    return lathe(name, [(0, 0), (r * 0.55, 0), (r * 0.85, h * 0.35), (r, h), (r * 0.95, h + 0.002), (r * 0.8, h * 0.4), (0, h * 0.18)], color, 48)

def make_bowls():
    # berries
    b = bowl("berry_bowl_body", 0.062, 0.045)
    parts = [b]
    for i in range(46):
        a = random.random() * math.tau; rr = math.sqrt(random.random()) * 0.048
        z = 0.03 + (0.05 - rr) * 0.45 + random.random() * 0.006
        if random.random() < 0.6:
            o = prim("uv", "bb", BLUEBERRY, loc=(math.cos(a) * rr, math.sin(a) * rr, z), radius=0.0085, segments=12, ring_count=8)
        else:
            o = prim("ico", "rb", RASPBERRY, loc=(math.cos(a) * rr, math.sin(a) * rr, z), radius=0.0095, subdivisions=2)
            o.scale = (1, 1, 1.15)
        smooth_all(o)
        parts.append(o)
    keep(join(parts, "berry_bowl"))
    # dip with a basil leaf
    d = bowl("dip_bowl_body", 0.048, 0.035)
    dip = lathe("dip", [(0, 0.022), (0.04, 0.026), (0.03, 0.03), (0.012, 0.034), (0, 0.035)], DIP, 48)
    l = leaf("dip_leaf", LEAF, 0.045, 0.02); l.location = (0.0, 0.0, 0.036); l.rotation_euler = (0, -0.25, 0.7)
    bpy.context.view_layer.objects.active = l; l.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    keep(join([d, dip, l], "dip_bowl"))
    # olives
    o = bowl("olive_bowl_body", 0.05, 0.032)
    parts = [o]
    for i in range(16):
        a = random.random() * math.tau; rr = math.sqrt(random.random()) * 0.034
        ol = prim("uv", "ol", OLIVE, loc=(math.cos(a) * rr, math.sin(a) * rr, 0.026 + random.random() * 0.012), radius=0.009, segments=12, ring_count=8)
        ol.scale = (1.35, 0.95, 0.95); ol.rotation_euler = (0, 0, random.random() * 3)
        bpy.context.view_layer.objects.active = ol; ol.select_set(True); bpy.ops.object.transform_apply(rotation=True, scale=True)
        smooth_all(ol)
        parts.append(ol)
    keep(join(parts, "olive_bowl"))

# ── bread basket with loaves and grapes ─────────────────
def make_bread_basket():
    basket = lathe("basket_body", [(0, 0), (0.13, 0), (0.15, 0.04), (0.165, 0.1), (0.17, 0.112), (0.162, 0.114), (0.153, 0.1), (0.14, 0.04), (0, 0.008)], WICKER, 64)
    basket.scale = (1.25, 0.85, 1)
    bpy.context.view_layer.objects.active = basket; basket.select_set(True); bpy.ops.object.transform_apply(scale=True)
    def weave(c):
        a = math.atan2(c.y, c.x)
        r = math.hypot(c.x, c.y)
        if r < 0.05: return c
        k = 1 + 0.02 * math.sin(c.z * 260) * (0.6 + 0.4 * math.sin(a * 40))
        return Vector((c.x * k, c.y * k, c.z))
    subsurf(basket, 1); apply_mods(basket)
    displace_verts(basket, weave)
    smooth_all(basket)
    handle = prim("torus", "basket_handle", WICKER, loc=(0, 0, 0.11), rot=(math.pi / 2, 0, 0), major_radius=0.16, minor_radius=0.011, major_segments=64, minor_segments=10)
    # keep only the upper half of the handle
    bm = bmesh.new(); bm.from_mesh(handle.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.11 - 0.005], context='VERTS')
    bm.to_mesh(handle.data); bm.free()
    smooth_all(handle)
    # gingham cloth: lies inside the basket and hangs over the rim in soft flaps
    bm = bmesh.new()
    fl = bm.verts.layers.float.new('flap')
    NX, NY = 44, 32
    grid = []
    for j in range(NY + 1):
        row = []
        for i in range(NX + 1):
            x = (i / NX - 0.5) * 0.5; y = (j / NY - 0.5) * 0.36
            e = math.hypot(x / 0.205, y / 0.14)
            ang = math.atan2(y, x)
            flap = max(0.0, math.cos(ang * 2 + 0.6)) ** 2   # two soft flaps over the rim
            if e < 1:
                z = 0.104 - (1 - e) ** 0.7 * 0.03
            else:
                z = 0.114 - (e - 1) * (0.06 + 0.45 * flap)
                k = 1 + (e - 1) * 0.12
                x, y = x / k, y / k
            z += 0.004 * math.sin(ang * 6 + e * 3)
            v = bm.verts.new((x, y, max(z, 0.04)))
            v[fl] = flap
            row.append(v)
        grid.append(row)
    for j in range(NY):
        for i in range(NX):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    # trim the square corners so the flaps are rounded
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.hypot(v.co.x / 0.205, v.co.y / 0.14) > 1.04 + v[fl] * 0.3], context='VERTS')
    cloth = new_obj("basket_cloth", bm, GINGHAM)
    sol = cloth.modifiers.new("thick", 'SOLIDIFY'); sol.thickness = 0.003
    smooth_all(cloth)
    loaves = []
    for (x, y, rz, s) in [(-0.07, -0.01, 0.4, 1.0), (0.04, -0.035, -0.2, 0.9)]:
        lo = prim("uv", "loaf", BREAD, loc=(x, y, 0.118 + 0.02 * s), radius=0.055, segments=32, ring_count=16)
        lo.scale = (1.1 * s, 0.85 * s, 0.62 * s)
        bpy.context.view_layer.objects.active = lo; lo.select_set(True); bpy.ops.object.transform_apply(scale=True)
        # light score marks pressed into the crust
        for k in (-1, 1):
            cut = prim("cube", "cut", BREAD_LIGHT, loc=(x + k * 0.018, y, 0.118 + 0.02 * s + 0.033 * s), rot=(0, 0, rz + k * 0.55), scale=(0.0035, 0.03 * s, 0.003))
            bevel(cut, 0.002, 2); smooth_all(cut)
            loaves.append(cut)
        smooth_all(lo)
        loaves.append(lo)
    bag = prim("uv", "baguette", BREAD, loc=(0.05, 0.05, 0.14), radius=0.03, segments=32, ring_count=12)
    bag.scale = (5.0, 1.0, 0.9); bag.rotation_euler = (0, -0.5, 0.5)
    bpy.context.view_layer.objects.active = bag; bag.select_set(True); bpy.ops.object.transform_apply(rotation=True, scale=True)
    smooth_all(bag)
    grapes = []
    for i in range(30):
        t = i / 30
        layer = int(t * 5)
        a = random.random() * math.tau
        rr = (1 - layer / 5) * 0.035 * random.uniform(0.3, 1)
        g = prim("uv", "grape", GRAPE, loc=(-0.13 + math.cos(a) * rr, 0.07 + math.sin(a) * rr, 0.16 - layer * 0.014), radius=0.011, segments=14, ring_count=10)
        smooth_all(g)
        grapes.append(g)
    gl = leaf("grape_leaf", LEAF, 0.08, 0.06, 0.15); gl.location = (-0.17, 0.06, 0.17); gl.rotation_euler = (0.3, -0.4, 2.6)
    bpy.context.view_layer.objects.active = gl; gl.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True)
    keep(join([basket, handle, cloth, bag, gl] + loaves + grapes, "bread_basket"))

# ── potted plant ────────────────────────────────────────
def make_plant():
    pot = lathe("pot", [(0, 0), (0.036, 0), (0.046, 0.07), (0.05, 0.072), (0.05, 0.082), (0.043, 0.082), (0.04, 0.07), (0, 0.065)], WHITE, 48)
    band = lathe("pot_band", [(0.0445, 0.05), (0.0475, 0.05), (0.0485, 0.06), (0.0455, 0.06)], POT_RED, 48)
    soil = prim("cyl", "soil", SOIL, loc=(0, 0, 0.074), radius=0.041, depth=0.004, vertices=32)
    leaves = []
    for i in range(9):
        a = i / 9 * math.tau + random.random() * 0.3
        l = leaf(f"pl{i}", PLANT, random.uniform(0.09, 0.13), 0.03, 0.4)
        l.location = (0, 0, 0.075)
        l.rotation_euler = (0, -random.uniform(0.6, 1.1), a)
        bpy.context.view_layer.objects.active = l; l.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True)
        leaves.append(l)
    keep(join([pot, band, soil] + leaves, "potted_plant"))

# ── cutlery + napkin ────────────────────────────────────
def make_cutlery():
    kh = prim("cube", "knife_handle", HANDLE, loc=(-0.06, 0, 0.006), scale=(0.05, 0.009, 0.006)); bevel(kh, 0.004, 3)
    bm = bmesh.new()
    pts = [(0, -0.009), (0.11, -0.009), (0.125, 0.0), (0.11, 0.009), (0, 0.009)]
    bot = [bm.verts.new((x - 0.01, y, 0.003)) for x, y in pts]; top = [bm.verts.new((x - 0.01, y, 0.0055)) for x, y in pts]
    bm.faces.new(tuple(reversed(bot))); bm.faces.new(tuple(top))
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bm.faces.new((bot[i], bot[j], top[j], top[i]))
    blade = new_obj("knife_blade", bm, METAL); bevel(blade, 0.001, 2)
    keep(join([kh, blade], "knife"))
    fh = prim("cube", "fork_handle", HANDLE, loc=(-0.06, 0, 0.006), scale=(0.05, 0.009, 0.006)); bevel(fh, 0.004, 3)
    neck = prim("cube", "fork_neck", METAL, loc=(0.015, 0, 0.005), scale=(0.028, 0.006, 0.0018))
    head = prim("cube", "fork_head", METAL, loc=(0.05, 0, 0.005), scale=(0.01, 0.013, 0.0018))
    tines = [prim("cube", f"tine{i}", METAL, loc=(0.075, -0.0105 + i * 0.007, 0.005), scale=(0.018, 0.0016, 0.0016)) for i in range(4)]
    keep(join([fh, neck, head] + tines, "fork"))
    nap = prim("cube", "napkin", GINGHAM, loc=(0, 0, 0.002), scale=(0.11, 0.11, 0.002)); bevel(nap, 0.0015, 2)
    subsurf(nap, 2); apply_mods(nap)
    displace_verts(nap, lambda c: c + Vector((0, 0, 0.004 * math.sin(c.x * 40) * math.cos(c.y * 35))))
    keep(nap)

# ── presents ────────────────────────────────────────────
PRESENT_STYLES = [
    ("present_pink", (0.16, 0.16, 0.14), (0.95, 0.55, 0.65), (0.98, 0.95, 0.92)),
    ("present_mint", (0.13, 0.13, 0.11), (0.52, 0.84, 0.72), (0.98, 0.84, 0.3)),
    ("present_lilac", (0.2, 0.14, 0.12), (0.72, 0.6, 0.92), (0.9, 0.25, 0.4)),
    ("present_gold", (0.1, 0.1, 0.1), (0.98, 0.78, 0.3), (0.85, 0.2, 0.3)),
    ("present_blue", (0.14, 0.1, 0.16), (0.48, 0.66, 0.92), (0.98, 0.95, 0.92)),
]
def make_presents():
    for name, (w, d, h), body_c, rib_c in PRESENT_STYLES:
        bm_ = mat(f"M_{name}", body_c, 0.55)
        rb = mat(f"M_{name}_ribbon", rib_c, 0.3)
        box = prim("cube", f"{name}_box", bm_, loc=(0, 0, h / 2), scale=(w / 2, d / 2, h / 2)); bevel(box, 0.006, 3)
        lid = prim("cube", f"{name}_lid", bm_, loc=(0, 0, h + 0.008), scale=(w / 2 + 0.006, d / 2 + 0.006, 0.012)); bevel(lid, 0.005, 3)
        r1 = prim("cube", f"{name}_r1", rb, loc=(0, 0, h / 2 + 0.006), scale=(w / 2 + 0.008, 0.012, h / 2 + 0.016)); bevel(r1, 0.002, 2)
        r2 = prim("cube", f"{name}_r2", rb, loc=(0, 0, h / 2 + 0.006), scale=(0.012, d / 2 + 0.008, h / 2 + 0.016)); bevel(r2, 0.002, 2)
        top = h + 0.022
        loops = []
        for s in (-1, 1):
            lp = prim("torus", f"{name}_loop", rb, loc=(s * 0.026, 0, top + 0.016), rot=(math.pi / 2, s * 0.5, 0), major_radius=0.024, minor_radius=0.007, major_segments=32, minor_segments=10)
            lp.scale = (1, 0.55, 1)
            bpy.context.view_layer.objects.active = lp; lp.select_set(True); bpy.ops.object.transform_apply(scale=True)
            loops.append(lp)
            tail = prim("cube", f"{name}_tail", rb, loc=(s * 0.03, 0.02, top - 0.002), rot=(0, 0, s * 0.6), scale=(0.035, 0.009, 0.0025))
            loops.append(tail)
        knot = prim("uv", f"{name}_knot", rb, loc=(0, 0, top + 0.008), radius=0.011, segments=16, ring_count=10)
        for o in [box, lid, r1, r2, knot] + loops: smooth_all(o)
        keep(join([box, lid, r1, r2, knot] + loops, name))

# ── birthday cake: chocolate & berries ──────────────────
def make_cake():
    stand = lathe("cake_stand", [(0, 0), (0.07, 0), (0.075, 0.006), (0.03, 0.014), (0.02, 0.05), (0.03, 0.07), (0.165, 0.074), (0.168, 0.08), (0.155, 0.082), (0, 0.082)], STAND, 64)
    z0 = 0.082
    R = 0.118
    layers = [(CHOC, 0.035), (CREAM, 0.022), (SPONGE, 0.03), (CREAM, 0.018), (CHOC, 0.03)]
    parts = [stand]
    z = z0
    for k, (m, hgt) in enumerate(layers):
        r = R - (0.003 if m is CREAM else 0)
        parts.append(lathe(f"cake_layer{k}", [(0, z), (r, z), (r, z + hgt), (0, z + hgt)], m, 72))
        z += hgt
    top = z
    # piped swirl on the cream band
    for i in range(36):
        a = i / 36 * math.tau
        s = prim("uv", "swirl", CREAM, loc=(math.cos(a) * (R + 0.002), math.sin(a) * (R + 0.002), z0 + 0.035 + 0.011 + 0.006 * math.sin(i * 1.7)), radius=0.006, segments=10, ring_count=6)
        smooth_all(s); parts.append(s)
    # glossy chocolate glaze with drips
    drips = []
    rnd = random.Random(9)
    for i in range(22): drips.append((i / 22 * math.tau + rnd.uniform(-0.1, 0.1), rnd.uniform(0.01, 0.045), rnd.uniform(0.12, 0.22)))
    def drip_len(a):
        L = 0.006
        for da, ln, w in drips:
            d = abs((a - da + math.pi * 3) % math.tau - math.pi)
            t = max(0, 1 - d / w)
            L = max(L, 0.006 + ln * t ** 0.55)
        return L
    bm = bmesh.new()
    NA, NV = 144, 14
    grid = []
    for i in range(NA):
        a = i / NA * math.tau
        L = drip_len(a)
        row = []
        for j in range(NV + 1):
            v = j / NV
            if v < 0.35:
                q = v / 0.35; ang = q * math.pi / 2
                r = R - 0.012 + math.sin(ang) * 0.016; zz = top + 0.004 - (1 - math.cos(ang)) * 0.01
            else:
                q = (v - 0.35) / 0.65
                bulb = 1 if q < 0.85 else math.sqrt(max(0, 1 - ((q - 0.85) / 0.15) ** 2))
                r = R + 0.004 * (0.5 + 0.5 * bulb); zz = top + 0.004 - 0.01 - q * L
            row.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, zz)))
        grid.append(row)
    for i in range(NA):
        a_, b_ = grid[i], grid[(i + 1) % NA]
        for j in range(NV):
            bm.faces.new((a_[j], b_[j], b_[j + 1], a_[j + 1]))
    capv = [bm.verts.new((0, 0, top + 0.004))]
    for i in range(NA):
        bm.faces.new((capv[0], grid[(i + 1) % NA][0], grid[i][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    glaze = new_obj("cake_glaze", bm, CHOC_GLAZE); smooth_all(glaze)
    parts.append(glaze)
    # cream dollops + berries on top
    for i in range(10):
        a = i / 10 * math.tau
        d = prim("cone", "dollop", CREAM, loc=(math.cos(a) * 0.092, math.sin(a) * 0.092, top + 0.014), radius1=0.014, radius2=0.002, depth=0.022, vertices=16)
        displace_verts(d, lambda c: Vector((c.x * (1 + 0.15 * math.sin(math.atan2(c.y, c.x) * 8)), c.y * (1 + 0.15 * math.sin(math.atan2(c.y, c.x) * 8)), c.z)))
        smooth_all(d); parts.append(d)
        bb = prim("uv", "topberry", BLUEBERRY if i % 2 else RASPBERRY, loc=(math.cos(a) * 0.092, math.sin(a) * 0.092, top + 0.03), radius=0.008, segments=12, ring_count=8)
        smooth_all(bb); parts.append(bb)
    for i in range(14):
        a = rnd.random() * math.tau; rr = rnd.random() * 0.06
        kind = rnd.random()
        if kind < 0.35:
            o = prim("uv", "straw", STRAWBERRY, loc=(math.cos(a) * rr, math.sin(a) * rr, top + 0.018), radius=0.013, segments=14, ring_count=10)
            o.scale = (1, 1, 1.3)
        elif kind < 0.7:
            o = prim("uv", "blue", BLUEBERRY, loc=(math.cos(a) * rr, math.sin(a) * rr, top + 0.012), radius=0.008, segments=12, ring_count=8)
        else:
            o = prim("ico", "rasp", RASPBERRY, loc=(math.cos(a) * rr, math.sin(a) * rr, top + 0.014), radius=0.0095, subdivisions=2)
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.transform_apply(scale=True)
        smooth_all(o); parts.append(o)
    for i in range(4):
        a = rnd.random() * math.tau
        l = leaf("mint", LEAF, 0.03, 0.016); l.location = (math.cos(a) * 0.04, math.sin(a) * 0.04, top + 0.03); l.rotation_euler = (0.3, -0.4, a)
        bpy.context.view_layer.objects.active = l; l.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True)
        parts.append(l)
    cake = join(parts, "cake")
    cake["top"] = top
    keep(cake)
    print("CAKE_TOP", top)

make_pie(); make_bottle(); make_sausage_board(); make_cheese(); make_bowls(); make_bread_basket()
make_plant(); make_cutlery(); make_presents(); make_cake()

# lay everything out in a grid (for preview); the app re-positions by name
COLS, CELL = 5, 0.5
for k, (name, ob) in enumerate(objects.items()):
    ob.location = ((k % COLS) * CELL, -(k // COLS) * CELL, 0)
    dims = ob.dimensions
    print("OBJ", name, "dims", tuple(round(d, 3) for d in dims), "tris", sum(len(p.vertices) - 2 for p in ob.data.polygons))
x = COLS * CELL
rows = (len(objects) + COLS - 1) // COLS

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_extras=True)
print("exported", OUT)

if PREVIEW:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 700
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.78, 0.74, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); scene.collection.objects.link(sun)
    sun.data.energy = 3.5; sun.rotation_euler = (0.7, 0.2, 0.8)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam)
    scene.render.resolution_x, scene.render.resolution_y = 1500, 1300
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = COLS * CELL * 1.05
    cy = -(rows - 1) * CELL / 2
    cam.location = ((COLS - 1) * CELL / 2, cy - 2.2, 2.2); cam.rotation_euler = (math.radians(45), 0, 0)
    scene.camera = cam
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    print("preview", PREVIEW)

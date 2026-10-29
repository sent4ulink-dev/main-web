# Shared helpers for the Birthday web 2 salon props (original models, made in Blender 5.x, headless).
# Conventions (Blender, Z-up): every prop stands on z = 0, centred on x/y, its front facing -Y
# (glTF +Z after export). Names of objects (and of empties used as anchors) are what the app looks up.
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

scene = bpy.context.scene
OBJECTS = {}

def start():
    # (run with --factory-startup; the palette below is created on import, so only clear the default objects)
    global scene
    scene = bpy.context.scene
    for o in list(scene.objects): bpy.data.objects.remove(o, do_unlink=True)
    OBJECTS.clear()
    return scene

def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return (a[0] if a else "out.glb"), (a[1] if len(a) > 1 else None)

MATS = {}
def mat(name, rgb, rough=0.6, metal=0.0, emit=None):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 1.0
    MATS[name] = m
    return m

# ── palette: a candle-lit Classical salon (cartoon, rich but soft) ──
WALNUT = mat("M_walnut", (0.33, 0.16, 0.08), 0.5)
MAHOG = mat("M_mahogany", (0.40, 0.12, 0.07), 0.45)
GOLD = mat("M_gold", (0.96, 0.73, 0.32), 0.3, 0.85)
GOLD_DK = mat("M_gold_dark", (0.70, 0.48, 0.18), 0.4, 0.8)
IVORY = mat("M_ivory", (0.97, 0.94, 0.86), 0.35)
EBONY = mat("M_ebony", (0.06, 0.05, 0.05), 0.35)
VELVET = mat("M_velvet", (0.52, 0.06, 0.13), 0.8)
VELVET_DK = mat("M_velvet_dark", (0.34, 0.03, 0.08), 0.85)
MARBLE = mat("M_marble", (0.93, 0.91, 0.88), 0.3)
MARBLE_PK = mat("M_marble_pink", (0.86, 0.74, 0.72), 0.3)
PORCELAIN = mat("M_porcelain", (0.98, 0.97, 0.95), 0.25)
COBALT = mat("M_cobalt", (0.18, 0.28, 0.62), 0.3)
SILVER = mat("M_silver", (0.82, 0.83, 0.86), 0.25, 0.85)
LINEN = mat("M_linen", (0.97, 0.95, 0.90), 0.8)
ROSE = mat("M_rose", (0.95, 0.56, 0.64), 0.6)
ROSE_DK = mat("M_rose_dark", (0.82, 0.30, 0.42), 0.6)
CREAM_ROSE = mat("M_rose_cream", (0.99, 0.88, 0.78), 0.6)
LEAF = mat("M_leaf", (0.26, 0.47, 0.25), 0.6)
WAX = mat("M_wax", (0.98, 0.95, 0.86), 0.5)
WICK = mat("M_wick", (0.1, 0.08, 0.06), 0.8)
STRING = mat("M_string", (0.92, 0.86, 0.66), 0.4, 0.4)
SPRUCE = mat("M_spruce", (0.78, 0.45, 0.17), 0.35)   # violin varnish
CRYSTAL = mat("M_crystal", (0.86, 0.92, 1.0), 0.05)
PAPER = mat("M_paper", (0.96, 0.92, 0.80), 0.8)
INK = mat("M_ink", (0.08, 0.07, 0.1), 0.4)
FEATHER = mat("M_feather", (0.98, 0.97, 0.94), 0.7)
CANVAS = mat("M_canvas", (0.93, 0.89, 0.80), 0.9)
DIAL = mat("M_dial", (0.98, 0.97, 0.93), 0.3)
CAKE = mat("M_cake", (0.99, 0.95, 0.90), 0.6)
ICING_PK = mat("M_icing_pink", (0.98, 0.72, 0.78), 0.55)
BERRY = mat("M_berry", (0.78, 0.10, 0.18), 0.35)
PINEAPPLE = mat("M_pineapple", (0.86, 0.62, 0.22), 0.6)
CHOCOLATE = mat("M_choc", (0.36, 0.20, 0.12), 0.5)
MACARON_GN = mat("M_macaron_green", (0.70, 0.86, 0.64), 0.6)
MACARON_LV = mat("M_macaron_lav", (0.80, 0.70, 0.92), 0.6)
FIRE = mat("M_fire", (1.0, 0.55, 0.15), 0.6, emit=(1.0, 0.45, 0.1))
LOG = mat("M_log", (0.25, 0.14, 0.08), 0.8)
SOOT = mat("M_soot", (0.10, 0.07, 0.06), 0.9)

# ── building blocks ──
def link(ob):
    scene.collection.objects.link(ob)
    return ob

def new_obj(name, bm, material=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me))
    if material: ob.data.materials.append(material)
    return ob

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

def box(name, material, size, loc=(0, 0, 0), bev=0.004, rot=(0, 0, 0)):
    ob = prim("cube", name, material, loc=loc, scale=(size[0] / 2, size[1] / 2, size[2] / 2), rot=rot)
    if bev: bevel(ob, bev)
    return ob

def cyl(name, material, r, h, loc=(0, 0, 0), rot=(0, 0, 0), seg=24, bev=0.0):
    ob = prim("cyl", name, material, loc=loc, rot=rot, radius=r, depth=h, vertices=seg)
    if bev: bevel(ob, bev)
    return smooth(ob)

def bevel(ob, w=0.004, seg=3, angle=40):
    m = ob.modifiers.new("bev", 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    return ob

def subsurf(ob, lv=2):
    m = ob.modifiers.new("sub", 'SUBSURF'); m.levels = lv; m.render_levels = lv
    return ob

def smooth(ob, angle=40):
    for p in ob.data.polygons: p.use_smooth = True
    if hasattr(ob.data, "set_sharp_from_angle"): ob.data.set_sharp_from_angle(angle=math.radians(angle))
    return ob

def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def apply_tf(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def join(objs, name):
    objs = [o for o in objs if o]
    for o in objs: apply_mods(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name; ob.data.name = name
    apply_tf(ob)
    return ob

def lathe(name, prof, material, seg=40, cap_top=True, cap_bottom=True, angle=55):
    """Turned shape from a (radius, z) profile, bottom to top."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        r = max(r, 1e-4)
        rings.append([bm.verts.new((math.cos(2 * math.pi * i / seg) * r, math.sin(2 * math.pi * i / seg) * r, z)) for i in range(seg)])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for i in range(seg): bm.faces.new((r0[i], r0[(i + 1) % seg], r1[(i + 1) % seg], r1[i]))
    if cap_bottom: bm.faces.new(rings[0][::-1])
    if cap_top: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return smooth(new_obj(name, bm, material), angle)

def slab(name, outline, z0, z1, material, bev=0.004, bev_seg=3):
    """Extrude a closed 2D outline [(x, y), …] (counter-clockwise) from z0 to z1."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in outline]
    hi = [bm.verts.new((x, y, z1)) for x, y in outline]
    n = len(outline)
    bm.faces.new(lo[::-1]); bm.faces.new(hi)
    for i in range(n): bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, material)
    if bev: bevel(ob, bev, bev_seg, 30)
    return smooth(ob, 35)

def ring_slab(name, outer, inner, z0, z1, material, bev=0.003):
    """A frame: outline with a hole (both lists of the same length, counter-clockwise)."""
    bm = bmesh.new(); n = len(outer)
    ol = [bm.verts.new((x, y, z0)) for x, y in outer]; oh = [bm.verts.new((x, y, z1)) for x, y in outer]
    il = [bm.verts.new((x, y, z0)) for x, y in inner]; ih = [bm.verts.new((x, y, z1)) for x, y in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ol[i], ol[j], oh[j], oh[i]))          # outside wall
        bm.faces.new((ih[i], ih[j], il[j], il[i]))          # inside wall
        bm.faces.new((oh[i], oh[j], ih[j], ih[i]))          # top
        bm.faces.new((il[i], il[j], ol[j], ol[i]))          # bottom
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm, material)
    if bev: bevel(ob, bev, 2, 30)
    return smooth(ob, 35)

def tube(name, pts, radius, material, seg=10, radii=None, closed=False):
    """A tube along 3D points (a poly curve with a round bevel), turned into a mesh."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius; cu.bevel_resolution = max(1, seg // 4); cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
        if radii: sp.points[i].radius = radii[i]
    sp.use_cyclic_u = closed
    ob = link(bpy.data.objects.new(name, cu))
    ob.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.active_object; ob.name = name
    return smooth(ob, 60)

def smooth_path(ctrl, n=24):
    """Catmull-Rom through control points → n points per segment."""
    out = []
    P = [Vector(c) for c in ctrl]
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)))
    out.append(tuple(P[-1]))
    return out

def empty(name, loc, parent=None):
    e = link(bpy.data.objects.new(name, None))
    e.location = loc
    if parent: e.parent = parent
    return e

def group(name, children, anchors=()):
    root = link(bpy.data.objects.new(name, None))
    for c in children: c.parent = root
    for a in anchors: a.parent = root
    return keep(root)

def pivot(ob, name=None):
    """Put a moving part under an empty at its origin (the hinge / axle), so the app rotates the empty:
    mesh compression may move a mesh node's own origin, never an empty's."""
    name = name or ob.name
    ob.name = name + "_mesh"; ob.data.name = name + "_mesh"    # free the name first (else Blender adds .001)
    e = link(bpy.data.objects.new(name, None))
    e.matrix_world = ob.matrix_world.copy()
    ob.parent = e
    ob.matrix_parent_inverse.identity()
    ob.location = (0, 0, 0); ob.rotation_euler = (0, 0, 0); ob.scale = (1, 1, 1)
    return e

def keep(ob):
    OBJECTS[ob.name] = ob
    return ob

def tris(ob):
    if ob.type != 'MESH': return sum(tris(c) for c in ob.children)
    return sum(len(p.vertices) - 2 for p in ob.data.polygons) + sum(tris(c) for c in ob.children)

def finish(out, preview=None, cols=5, cell=1.6, bg=(0.25, 0.12, 0.14)):
    # every prop gets an empty root named after it: the app resets the root's transform (the preview grid
    # position) without touching the mesh nodes, which carry the compression offsets
    for name, ob in list(OBJECTS.items()):
        if ob.type != 'MESH': continue
        ob.name = name + "_mesh"; ob.data.name = name + "_mesh"
        root = link(bpy.data.objects.new(name, None))
        for k in ob.keys():
            if not k.startswith("_"): root[k] = ob[k]
        ob.parent = root
        OBJECTS[name] = root
    for k, (name, ob) in enumerate(OBJECTS.items()):
        ob.location = ((k % cols) * cell, -(k // cols) * cell, 0)
        print("OBJ", name, "tris", tris(ob))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_extras=True)
    print("exported", out)
    if not preview: return
    rows = (len(OBJECTS) + cols - 1) // cols
    scene.render.engine = 'BLENDER_EEVEE'
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (*bg, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.2
    sun = link(bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')))
    sun.data.energy = 3.5; sun.rotation_euler = (0.8, 0.2, 0.6)
    cam = link(bpy.data.objects.new("cam", bpy.data.cameras.new("cam")))
    scene.render.resolution_x, scene.render.resolution_y = 1600, max(600, int(1600 * rows / cols))
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = cols * cell * 1.02
    cam.location = ((cols - 1) * cell / 2, -(rows - 1) * cell / 2 - 6, 5.2); cam.rotation_euler = (math.radians(52), 0, 0)
    scene.camera = cam
    scene.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    print("preview", preview)
